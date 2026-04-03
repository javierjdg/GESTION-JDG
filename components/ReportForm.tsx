
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { WorkReport, ExpenseTicket, ProjectData } from '../App';
import { SaveIcon, ChevronDownIcon, TrashIcon, CameraIcon, ImageIcon } from './icons';

interface ReportFormProps {
  projects: ProjectData[];
  vehicles: string[];
  initialData?: WorkReport | null;
  onSave: (report: WorkReport) => void;
  onCancel: () => void;
}

const ReportForm: React.FC<ReportFormProps> = ({ projects, vehicles, initialData, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    id: '',
    projectNum: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '07:30',
    endTime: '15:30',
    overtimeHours: 0,
    overtimeType: 'NORMAL' as 'NORMAL' | 'NOCTURNA' | 'FINDE SEMANA',
    description: '',
    vehicle: '',
    isDriver: false,
    driverTripType: '' as 'IDA' | 'VUELTA' | 'IDA_Y_VUELTA' | '',
    expenses: {
      food: 0,
      gas: 0,
      parking: 0,
      others: 0,
      othersDesc: ''
    },
    tickets: [] as ExpenseTicket[]
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCompressing, setIsCompressing] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id,
        projectNum: initialData.projectNum,
        date: initialData.date,
        startTime: initialData.startTime,
        endTime: initialData.endTime,
        overtimeHours: initialData.overtimeHours || 0,
        overtimeType: initialData.overtimeType || 'NORMAL',
        description: initialData.description,
        vehicle: initialData.vehicle,
        isDriver: initialData.isDriver,
        driverTripType: initialData.driverTripType || '',
        expenses: { ...initialData.expenses },
        tickets: initialData.tickets || []
      });
    }
  }, [initialData]);

  // Filtramos las obras: Mostramos solo las NO terminadas, O la que ya está seleccionada (para ediciones)
  const availableProjects = useMemo(() => {
    let filtered = [...projects]
      .filter(p => !p.isFinished || (initialData && p.id === initialData.projectNum))
      .reverse(); // Las más nuevas primero
      
    if (projectSearch.trim()) {
        const term = projectSearch.toLowerCase();
        filtered = filtered.filter(p => 
            p.id.toLowerCase().includes(term) || 
            p.name.toLowerCase().includes(term)
        );
    }
    return filtered;
  }, [projects, initialData, projectSearch]);

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; 
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.5));
      };
    });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.projectNum) newErrors.projectNum = 'Requerido';
    
    if (formData.isDriver) {
        if (!formData.vehicle) newErrors.vehicle = 'Requerido al ser conductor';
        if (!formData.driverTripType) newErrors.driverTripType = 'Requerido';
    } else {
        if (!formData.vehicle) newErrors.vehicle = 'Requerido';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isCompressing) return;

    onSave({
      id: formData.id || Date.now().toString(),
      technician: '',
      projectNum: formData.projectNum,
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      overtimeHours: formData.overtimeHours,
      overtimeType: formData.overtimeType,
      description: formData.description,
      vehicle: formData.vehicle,
      isDriver: formData.isDriver,
      driverTripType: formData.isDriver ? (formData.driverTripType as any) : undefined,
      expenses: formData.expenses,
      imageNames: [],
      tickets: formData.tickets
    });
  };

  const handleExpenseChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      expenses: { ...prev.expenses, [field]: field === 'othersDesc' ? value : Number(value) }
    }));
  };

  const openCamera = (type: string) => {
    if (cameraInputRef.current) {
      cameraInputRef.current.dataset.type = type;
      cameraInputRef.current.click();
    }
  };

  const openGallery = (type: string) => {
    if (galleryInputRef.current) {
      galleryInputRef.current.dataset.type = type;
      galleryInputRef.current.click();
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const type = e.target.dataset.type || 'General';
    if (!file) return;

    setIsCompressing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const originalBase64 = event.target?.result as string;
      const compressedBase64 = await compressImage(originalBase64);
      
      setFormData(prev => ({
        ...prev,
        tickets: [...prev.tickets, { type, data: compressedBase64, timestamp: Date.now() }]
      }));
      setIsCompressing(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeTicket = (timestamp: number) => {
    setFormData(prev => ({
      ...prev,
      tickets: prev.tickets.filter(t => t.timestamp !== timestamp)
    }));
  };

  return (
    <div className="bg-white dark:bg-brand-panel rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6 shadow-xl relative pb-20 transition-colors duration-300">
      <div className="absolute top-0 left-0 w-full h-1 bg-brand-teal rounded-t-xl"></div>
      
      {isCompressing && (
        <div className="absolute inset-0 z-50 bg-white/70 dark:bg-brand-dark/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl">
           <div className="w-12 h-12 border-4 border-brand-teal border-t-brand-lime rounded-full animate-spin mb-4"></div>
           <p className="text-sm font-black text-brand-teal dark:text-brand-lime uppercase tracking-widest animate-pulse">Optimizando Imagen...</p>
        </div>
      )}

      <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-800 dark:text-white">
        <span className="text-brand-teal dark:text-brand-lime">{initialData ? '✏️' : '📝'}</span> {initialData ? 'Editar Parte' : 'Nuevo Parte'}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        
        <input 
            type="file" 
            ref={cameraInputRef} 
            accept="image/*" 
            capture="environment" 
            className="hidden" 
            onChange={onFileChange} 
        />

        <input 
            type="file" 
            ref={galleryInputRef} 
            accept="image/*" 
            className="hidden" 
            onChange={onFileChange} 
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-brand-teal dark:text-brand-lime mb-1">Obra *</label>
            <div className="relative">
                <select
                value={formData.projectNum}
                onChange={e => setFormData({...formData, projectNum: e.target.value})}
                className={`w-full bg-gray-50 dark:bg-gray-900 border ${errors.projectNum ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-lg pl-4 pr-10 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-teal outline-none appearance-none`}
                >
                <option value="">Seleccionar Obra...</option>
                {availableProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.id} - {p.name}</option>
                ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                    <ChevronDownIcon className="w-5 h-5" />
                </div>
            </div>
             {errors.projectNum && <p className="text-red-400 text-xs mt-1">{errors.projectNum}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-brand-teal dark:text-brand-lime mb-1">Fecha *</label>
            <input
              type="date"
              value={formData.date}
              onChange={e => setFormData({...formData, date: e.target.value})}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-teal outline-none dark:[color-scheme:dark] cursor-pointer"
            />
          </div>
        </div>

        {/* Buscador de Obra */}
        <div>
            <input
                type="text"
                placeholder="Buscar obra por nombre o número..."
                value={projectSearch}
                onChange={e => setProjectSearch(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-teal outline-none"
            />
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Entrada</label>
                    <input
                    type="time"
                    value={formData.startTime}
                    onChange={e => setFormData({...formData, startTime: e.target.value})}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-teal outline-none dark:[color-scheme:dark] cursor-pointer"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Salida</label>
                    <input
                    type="time"
                    value={formData.endTime}
                    onChange={e => setFormData({...formData, endTime: e.target.value})}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-teal outline-none dark:[color-scheme:dark] cursor-pointer"
                    />
                </div>
            </div>
            
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                 <h4 className="text-sm font-medium text-brand-teal dark:text-brand-lime mb-2 uppercase tracking-wide">Horas Extra</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Nº Horas</label>
                        <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={formData.overtimeHours}
                        onChange={e => setFormData({...formData, overtimeHours: Number(e.target.value)})}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-teal outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de Hora</label>
                        <div className="relative">
                            <select
                                value={formData.overtimeType}
                                onChange={e => setFormData({...formData, overtimeType: e.target.value as any})}
                                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg pl-4 pr-10 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-teal outline-none appearance-none"
                            >
                                <option value="NORMAL">NORMAL</option>
                                <option value="NOCTURNA">NOCTURNA</option>
                                <option value="FINDE SEMANA">FINDE SEMANA</option>
                            </select>
                             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                                <ChevronDownIcon className="w-4 h-4" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div>
           <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Descripción del Trabajo</label>
           <textarea
             rows={3}
             value={formData.description}
             onChange={e => setFormData({...formData, description: e.target.value})}
             className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-teal outline-none"
             placeholder="Detalla las tareas realizadas..."
           />
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-brand-teal dark:text-brand-lime mb-2">Vehículo *</label>
          <div className="relative">
            <select
                value={formData.vehicle}
                onChange={e => setFormData({...formData, vehicle: e.target.value})}
                className={`w-full bg-white dark:bg-gray-800 border ${errors.vehicle ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-lg pl-4 pr-10 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-teal outline-none appearance-none mb-3`}
            >
                <option value="">Seleccionar vehículo...</option>
                {vehicles.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400 pb-3">
                <ChevronDownIcon className="w-5 h-5" />
            </div>
          </div>
          {errors.vehicle && <p className="text-red-400 text-xs mb-2">{errors.vehicle}</p>}
          
          <div className="flex flex-col gap-2">
            <label className="flex items-center space-x-3 cursor-pointer">
                <input 
                type="checkbox" 
                checked={formData.isDriver}
                onChange={e => setFormData({...formData, isDriver: e.target.checked})}
                className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-brand-teal focus:ring-brand-teal bg-white dark:bg-gray-800"
                />
                <span className="text-gray-700 dark:text-gray-300">He sido el conductor</span>
            </label>

            {formData.isDriver && (
                <div className="ml-8 mt-1">
                    <label className="block text-xs text-brand-teal mb-1">Trayecto realizado *</label>
                    <div className="relative">
                        <select
                            value={formData.driverTripType}
                            onChange={e => setFormData({...formData, driverTripType: e.target.value as any})}
                            className={`w-full bg-white dark:bg-gray-800 border ${errors.driverTripType ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-lg pl-3 pr-8 py-2 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-teal outline-none appearance-none`}
                        >
                            <option value="">Seleccionar trayecto...</option>
                            <option value="IDA">A LA IDA</option>
                            <option value="VUELTA">A LA VUELTA</option>
                            <option value="IDA_Y_VUELTA">IDA Y VUELTA</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                            <ChevronDownIcon className="w-4 h-4" />
                        </div>
                    </div>
                    {errors.driverTripType && <p className="text-red-400 text-xs mt-1">{errors.driverTripType}</p>}
                </div>
            )}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
           <h3 className="text-gray-700 dark:text-gray-300 font-medium mb-3">Gastos y Tickets (€)</h3>
           <div className="space-y-4">
             {[
               { field: 'food', label: 'Comida' },
               { field: 'gas', label: 'Gasolina' },
               { field: 'parking', label: 'Parking' }
             ].map((item) => (
               <div key={item.field} className="flex items-end gap-2">
                  <div className="flex-1">
                      <label className="text-xs text-gray-500">{item.label}</label>
                      <input 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        value={(formData.expenses as any)[item.field] || ''} 
                        onChange={e => handleExpenseChange(item.field, e.target.value)} 
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-2 text-gray-900 dark:text-white focus:border-brand-teal outline-none" 
                      />
                  </div>
                  <div className="flex gap-1">
                      <button type="button" onClick={() => openCamera(item.label)} className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 p-2.5 rounded text-brand-teal dark:text-brand-lime border border-gray-300 dark:border-gray-600 transition-colors">
                        <CameraIcon className="w-5 h-5" />
                      </button>
                      <button type="button" onClick={() => openGallery(item.label)} className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 p-2.5 rounded text-brand-teal border border-gray-300 dark:border-gray-600 transition-colors">
                        <ImageIcon className="w-5 h-5" />
                      </button>
                  </div>
               </div>
             ))}

             <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-end gap-2 mb-2">
                    <div className="flex-1">
                        <label className="text-xs text-gray-500 mb-1 block">Otros (Ferretería, etc.)</label>
                        <div className="flex gap-2">
                            <input type="number" min="0" step="0.01" placeholder="0.00 €" value={formData.expenses.others || ''} onChange={e => handleExpenseChange('others', e.target.value)} className="w-1/3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-2 text-gray-900 dark:text-white focus:border-brand-teal outline-none" />
                            <input type="text" placeholder="Concepto (ej. Ferretería)" value={formData.expenses.othersDesc} onChange={e => handleExpenseChange('othersDesc', e.target.value)} className="w-2/3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-2 text-gray-900 dark:text-white text-sm focus:border-brand-teal outline-none" />
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <button type="button" onClick={() => openCamera('Otros')} className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 p-2.5 rounded text-brand-teal dark:text-brand-lime border border-gray-300 dark:border-gray-600 transition-colors">
                            <CameraIcon className="w-5 h-5" />
                        </button>
                        <button type="button" onClick={() => openGallery('Otros')} className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 p-2.5 rounded text-brand-teal border border-gray-300 dark:border-gray-600 transition-colors">
                            <ImageIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
             </div>
           </div>

           {formData.tickets.length > 0 && (
             <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-[10px] uppercase font-bold text-gray-500 mb-3 tracking-widest">Tickets Adjuntos</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {formData.tickets.map((t) => (
                    <div key={t.timestamp} className="relative aspect-square bg-gray-100 dark:bg-gray-950 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700 group">
                      <img src={t.data} className="w-full h-full object-cover opacity-90 dark:opacity-70 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute top-1 left-1 bg-brand-teal/80 px-1.5 py-0.5 rounded text-[8px] font-bold text-white shadow-sm">{t.type}</div>
                      <button onClick={() => removeTicket(t.timestamp)} className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 p-1.5 rounded-full text-white shadow-lg backdrop-blur-sm transition-all"><TrashIcon className="w-3 h-3"/></button>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[9px] text-gray-500 italic text-center">Imágenes comprimidas para el servidor.</p>
             </div>
           )}
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-transparent border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isCompressing}
            className="flex-1 bg-brand-teal text-white py-3 rounded-lg hover:bg-teal-600 font-bold flex justify-center items-center gap-2 shadow-lg shadow-brand-teal/20 disabled:opacity-50"
          >
            <SaveIcon className="w-5 h-5" />
            {initialData ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReportForm;
