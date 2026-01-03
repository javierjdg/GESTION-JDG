
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppData, TechUser, WorkReport } from '../App';
import { TrashIcon, PlusIcon, DownloadIcon, UserIcon, TruckIcon, FileTextIcon, FilterIcon, EditIcon, SaveIcon, XIcon, LockIcon, UploadIcon, CloudIcon, CalendarIcon, ChartPieIcon, ClockIcon, EyeIcon, AlertIcon } from './icons';
import DailyOrganization from './DailyOrganization';

interface AdminPanelProps {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  onGoToVacations?: () => void;
}

// Helpers for calculations
const calculateDuration = (start: string, end: string): number => {
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    const diff = (h2 + m2/60) - (h1 + m1/60);
    return diff > 0 ? diff : 0;
};

const formatDateToSpanish = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
};

const getWeekRange = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay(); // 0 is Sunday
    // Adjust to Monday (1)
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(d);
    monday.setDate(diff);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const formatDate = (date: Date) => date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    return `${formatDate(monday)} - ${formatDate(sunday)}`;
};

const getMonthYearLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
};

const AdminPanel: React.FC<AdminPanelProps> = ({ data, setData, onGoToVacations }) => {
  const [tab, setTab] = useState<'techs' | 'projects' | 'reports' | 'settings' | 'daily' | 'vehicles'>('reports');
  const [reportViewMode, setReportViewMode] = useState<'list' | 'by_project' | 'by_week' | 'by_hours'>('list');
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newTechPwd, setNewTechPwd] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState(''); 
  const [editPwdValue, setEditPwdValue] = useState('');
  const [newAdminPwd, setNewAdminPwd] = useState(data.adminPassword || 'admin');
  const [pwdMsg, setPwdMsg] = useState('');
  const [firebaseConfigInput, setFirebaseConfigInput] = useState('');
  const [filterTech, setFilterTech] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  
  // Estado para el visor de fotos interno
  const [selectedImage, setSelectedImage] = useState<{data: string, type: string} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportImportInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data.firebaseConfig) {
        setFirebaseConfigInput(data.firebaseConfig);
    }
  }, [data.firebaseConfig]);

  // Solicitudes pendientes de revisión
  const pendingRequests = useMemo(() => {
    return (data.vacationRequests || []).filter(r => r.status === 'pending' || r.status === 'cancel_requested');
  }, [data.vacationRequests]);

  const handleAdd = (type: 'techs' | 'projects' | 'vehicles') => {
    if (!newItemName.trim()) return;
    setData(prev => {
      if (type === 'techs') {
        const newTech: TechUser = { id: Date.now().toString(), name: newItemName, password: newTechPwd || '1234' };
        return { ...prev, technicians: [...prev.technicians, newTech] };
      }
      if (type === 'projects') return { ...prev, projects: [...prev.projects, newItemName] };
      if (type === 'vehicles') return { ...prev, vehicles: [...prev.vehicles, newItemName] };
      return prev;
    });
    setNewItemName('');
    setNewTechPwd('');
  };

  const handleDelete = (type: 'techs' | 'projects' | 'vehicles', index: number) => {
    let itemName = "Elemento";
    if (type === 'techs' && data.technicians[index]) itemName = data.technicians[index].name;
    else if (type === 'projects' && data.projects[index]) itemName = data.projects[index];
    else if (type === 'vehicles' && data.vehicles[index]) itemName = data.vehicles[index];

    if (!window.confirm(`¿Eliminar "${itemName}"? Esta acción no se puede deshacer.`)) return;

    setData(prev => {
      if (type === 'techs') return { ...prev, technicians: prev.technicians.filter((_, i) => i !== index) };
      if (type === 'projects') return { ...prev, projects: prev.projects.filter((_, i) => i !== index) };
      if (type === 'vehicles') return { ...prev, vehicles: prev.vehicles.filter((_, i) => i !== index) };
      return prev;
    });
  };

  const handleDeleteAllProjects = () => {
    if (window.confirm('⚠️ ¿Estás seguro de que quieres BORRAR TODAS LAS OBRAS? Esta acción vaciará el listado por completo.')) {
        setData(prev => ({ ...prev, projects: [] }));
    }
  };

  const handleDeleteReport = (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este parte de trabajo permanentemente?')) return;
    setData(prev => ({ ...prev, reports: prev.reports.filter(r => r.id !== id) }));
    if (expandedReportId === id) setExpandedReportId(null);
  };

  const startEditing = (index: number, item: any, type: 'techs' | 'projects' | 'vehicles') => {
    setEditingIndex(index);
    if (type === 'techs') {
      const t = item as TechUser;
      setEditValue(t.name);
      setEditPwdValue(t.password);
    } else {
      setEditValue(item as string);
    }
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditValue('');
    setEditPwdValue('');
  };

  const saveEditing = (type: 'techs' | 'projects' | 'vehicles') => {
    if (!editValue.trim() || editingIndex === null) return;
    setData(prev => {
      let newData = { ...prev };
      if (type === 'techs') {
        const originalTech = prev.technicians[editingIndex];
        const newArr = [...prev.technicians];
        newArr[editingIndex] = { ...originalTech, name: editValue, password: editPwdValue };
        newData.technicians = newArr;
        newData.reports = prev.reports.map(r => r.technician === originalTech.name ? { ...r, technician: editValue } : r);
      } else if (type === 'vehicles') {
        const originalValue = prev.vehicles[editingIndex];
        const newArr = [...prev.vehicles];
        newArr[editingIndex] = editValue;
        newData.vehicles = newArr;
        newData.reports = prev.reports.map(r => r.vehicle === originalValue ? { ...r, vehicle: editValue } : r);
      } else if (type === 'projects') {
        const newArr = [...prev.projects];
        newArr[editingIndex] = editValue;
        newData.projects = newArr;
      }
      return newData;
    });
    cancelEditing();
  };

  const savePasswords = () => {
    setData(prev => ({ ...prev, adminPassword: newAdminPwd, firebaseConfig: firebaseConfigInput }));
    setPwdMsg('Configuración actualizada.');
    setTimeout(() => setPwdMsg(''), 3000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r\n|\n/);
      const newProjects: string[] = [];
      let count = 0;
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed) {
          const formatted = trimmed.replace(/[,;]/g, ' - ');
          if (!data.projects.includes(formatted)) { newProjects.push(formatted); count++; }
        }
      });
      if (count > 0) {
        setData(prev => ({ ...prev, projects: [...prev.projects, ...newProjects] }));
        alert(`Se han importado ${count} obras correctamente.`);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleImportReports = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const csv = event.target?.result as string;
        if (!csv) return;
        
        const lines = csv.split(/\r\n|\n/);
        if (lines.length < 2) return;

        const headers = lines[0].split(',');
        const newReports: WorkReport[] = [];
        let importedCount = 0;
        let skippedCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values: string[] = [];
            let current = '';
            let inQuotes = false;
            for (let charIdx = 0; charIdx < line.length; charIdx++) {
                const char = line[charIdx];
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) {
                    values.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current);

            const reportId = values[0];
            
            if (data.reports.some(r => r.id === reportId) || newReports.some(r => r.id === reportId)) {
                skippedCount++;
                continue;
            }

            const report: WorkReport = {
                id: reportId,
                date: values[1],
                technician: values[2],
                projectNum: values[3],
                startTime: values[4],
                endTime: values[5],
                vehicle: values[6],
                isDriver: values[7] === 'SI',
                driverTripType: (values[8] as any) || undefined,
                description: values[9]?.replace(/;/g, ','),
                expenses: {
                    food: Number(values[10]) || 0,
                    gas: Number(values[11]) || 0,
                    parking: Number(values[12]) || 0,
                    others: Number(values[13]) || 0,
                    othersDesc: values[14]?.replace(/;/g, ',') || ''
                },
                overtimeHours: Number(values[15]) || 0,
                overtimeType: (values[16] as any) || 'NORMAL',
                imageNames: []
            };
            
            newReports.push(report);
            importedCount++;
        }

        if (importedCount > 0) {
            setData(prev => ({ ...prev, reports: [...newReports, ...prev.reports] }));
            alert(`✓ Importación finalizada:\n- ${importedCount} partes nuevos añadidos.\n- ${skippedCount} duplicados omitidos.`);
        } else if (skippedCount > 0) {
            alert(`Todos los partes del archivo ya existen en la base de datos (${skippedCount} omitidos).`);
        }

        if (reportImportInputRef.current) reportImportInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const filteredReports = useMemo(() => {
    return data.reports.filter(r => {
        if (filterTech && r.technician !== filterTech) return false;
        if (filterProject && !r.projectNum.includes(filterProject.split(' - ')[0])) return false;
        if (filterDateStart && r.date < filterDateStart) return false;
        if (filterDateEnd && r.date > filterDateEnd) return false;
        return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [data.reports, filterTech, filterProject, filterDateStart, filterDateEnd]);

  const groupedReports = useMemo(() => {
    const months: Record<string, Record<string, WorkReport[]>> = {};
    filteredReports.forEach(report => {
        const monthLabel = getMonthYearLabel(report.date);
        const weekLabel = getWeekRange(report.date);
        if (!months[monthLabel]) months[monthLabel] = {};
        if (!months[monthLabel][weekLabel]) months[monthLabel][weekLabel] = [];
        months[monthLabel][weekLabel].push(report);
    });
    return months;
  }, [filteredReports]);

  // Cálculos para Resumen por Obra
  const projectsSummary = useMemo(() => {
    const summary: Record<string, { count: number, food: number, gas: number, parking: number, others: number, ot: number }> = {};
    filteredReports.forEach(r => {
        if (!summary[r.projectNum]) {
            summary[r.projectNum] = { count: 0, food: 0, gas: 0, parking: 0, others: 0, ot: 0 };
        }
        summary[r.projectNum].count++;
        summary[r.projectNum].food += r.expenses.food;
        summary[r.projectNum].gas += r.expenses.gas;
        summary[r.projectNum].parking += r.expenses.parking;
        summary[r.projectNum].others += r.expenses.others;
        summary[r.projectNum].ot += r.overtimeHours || 0;
    });
    return Object.entries(summary).sort((a, b) => b[1].count - a[1].count);
  }, [filteredReports]);

  // Cálculos para Control Horario
  const hoursSummary = useMemo(() => {
    const summary: Record<string, Record<string, { reg: number, ot: number }>> = {};
    filteredReports.forEach(r => {
        const week = getWeekRange(r.date);
        if (!summary[week]) summary[week] = {};
        if (!summary[week][r.technician]) summary[week][r.technician] = { reg: 0, ot: 0 };
        summary[week][r.technician].reg += calculateDuration(r.startTime, r.endTime);
        summary[week][r.technician].ot += r.overtimeHours || 0;
    });
    return Object.entries(summary).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredReports]);

  // Cálculos para Gastos por Semana
  const weeklyExpensesSummary = useMemo(() => {
    const summary: Record<string, Record<string, number>> = {};
    filteredReports.forEach(r => {
        const week = getWeekRange(r.date);
        if (!summary[week]) summary[week] = {};
        const total = r.expenses.food + r.expenses.gas + r.expenses.parking + r.expenses.others;
        summary[week][r.technician] = (summary[week][r.technician] || 0) + total;
    });
    return Object.entries(summary).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredReports]);

  const downloadCSV = () => {
    const headers = ['ID', 'Fecha', 'Técnico', 'Num Obra', 'Entrada', 'Salida', 'Vehículo', 'Conductor', 'Trayecto', 'Desc. Trabajo', 'Gasto Comida', 'Gasto Gasolina', 'Gasto Parking', 'Gasto Otros', 'Desc. Otros', 'Horas Extra', 'Tipo Extra'].join(',');
    const rows = filteredReports.map(r => {
      const cleanDesc = r.description.replace(/(\r\n|\n|\r)/gm, " ").replace(/,/g, ";");
      const cleanOtherDesc = r.expenses.othersDesc.replace(/,/g, ";");
      return [r.id, r.date, r.technician, r.projectNum, r.startTime, r.endTime, r.vehicle, r.isDriver ? 'SI' : 'NO', r.isDriver ? (r.driverTripType || '') : '', `"${cleanDesc}"`, r.expenses.food, r.expenses.gas, r.expenses.parking, r.expenses.others, `"${cleanOtherDesc}"`, r.overtimeHours || 0, r.overtimeType || 'NORMAL'].join(',');
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `partes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleExpandReport = (id: string) => setExpandedReportId(prev => prev === id ? null : id);

  return (
    <div className="bg-brand-panel rounded-xl shadow-xl border border-gray-700 overflow-hidden min-h-[600px]">
      
      {/* Aviso de Vacaciones Pendientes */}
      {pendingRequests.length > 0 && (
        <div className="bg-orange-600/20 border-b border-orange-500/50 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse-slow">
            <div className="flex items-center gap-3">
                <div className="bg-orange-600 p-2 rounded-lg text-white">
                    <AlertIcon className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-white font-black uppercase text-xs tracking-widest">Atención Administrador</p>
                    <p className="text-orange-200 text-sm">Tienes <span className="font-black underline">{pendingRequests.length} solicitudes</span> de vacaciones pendientes de revisión.</p>
                </div>
            </div>
            <button 
                onClick={onGoToVacations}
                className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all"
            >
                Revisar Ahora
            </button>
        </div>
      )}

      {/* Lightbox / Visor de Imagen Integrado */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedImage(null)}
        >
          <div className="absolute top-6 right-6 flex gap-4">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const link = document.createElement('a');
                  link.href = selectedImage.data;
                  link.download = `TICKET_${selectedImage.type.toUpperCase()}.jpg`;
                  link.click();
                }}
                className="bg-brand-teal text-white p-3 rounded-full shadow-xl hover:bg-teal-600 transition-all flex items-center gap-2"
              >
                <DownloadIcon className="w-6 h-6" />
                <span className="text-xs font-bold pr-1">DESCARGAR</span>
              </button>
              <button 
                className="bg-white/10 text-white p-3 rounded-full hover:bg-white/20 transition-all"
                onClick={() => setSelectedImage(null)}
              >
                <XIcon className="w-6 h-6" />
              </button>
          </div>
          <div className="max-w-4xl max-h-[85vh] relative flex flex-col items-center gap-4">
            <img 
              src={selectedImage.data} 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/10 cursor-default" 
              onClick={(e) => e.stopPropagation()}
            />
            <div className="bg-brand-panel/80 px-6 py-3 rounded-full border border-gray-700 text-brand-lime font-black tracking-widest uppercase text-sm">
                TICKET: {selectedImage.type}
            </div>
          </div>
        </div>
      )}

      <div className="flex border-b border-gray-700 bg-brand-dark overflow-x-auto">
        <button onClick={() => { setTab('reports'); cancelEditing(); }} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap ${tab === 'reports' ? 'text-brand-lime border-b-2 border-brand-lime bg-brand-panel' : 'text-gray-400 hover:text-gray-200'}`}><FileTextIcon className="w-4 h-4" /> <span className="hidden md:inline">Base de Datos</span></button>
        <button onClick={() => { setTab('techs'); cancelEditing(); }} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap ${tab === 'techs' ? 'text-brand-teal border-b-2 border-brand-teal bg-brand-panel' : 'text-gray-400 hover:text-gray-200'}`}><UserIcon className="w-4 h-4" /> <span className="hidden md:inline">Técnicos</span></button>
        <button onClick={() => { setTab('projects'); cancelEditing(); }} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap ${tab === 'projects' ? 'text-brand-teal border-b-2 border-brand-teal bg-brand-panel' : 'text-gray-400 hover:text-gray-200'}`}>🚧 <span className="hidden md:inline">Obras</span></button>
        <button onClick={() => { setTab('vehicles'); cancelEditing(); }} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap ${tab === 'vehicles' ? 'text-brand-teal border-b-2 border-brand-teal bg-brand-panel' : 'text-gray-400 hover:text-gray-200'}`}><TruckIcon className="w-4 h-4" /> <span className="hidden md:inline">Vehículos</span></button>
        <button onClick={() => { setTab('daily'); cancelEditing(); }} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap ${tab === 'daily' ? 'text-brand-teal border-b-2 border-brand-teal bg-brand-panel' : 'text-gray-400 hover:text-gray-200'}`}><CalendarIcon className="w-4 h-4" /> <span className="hidden md:inline">Org. Diaria</span></button>
        <button onClick={() => { setTab('settings'); cancelEditing(); }} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap ${tab === 'settings' ? 'text-brand-teal border-b-2 border-brand-teal bg-brand-panel' : 'text-gray-400 hover:text-gray-200'}`}><LockIcon className="w-4 h-4" /> <span className="hidden md:inline">Configuración</span></button>
      </div>

      <div className="p-6">
        {tab === 'reports' && (
          <div>
            <div className="flex gap-2 mb-4 bg-gray-900 p-2 rounded-lg border border-gray-700 max-w-fit flex-wrap">
                <button onClick={() => setReportViewMode('list')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 transition-colors ${reportViewMode === 'list' ? 'bg-brand-lime text-brand-dark' : 'text-gray-400 hover:text-white'}`}><FileTextIcon className="w-3 h-3" /> Listado</button>
                <button onClick={() => setReportViewMode('by_project')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 transition-colors ${reportViewMode === 'by_project' ? 'bg-brand-teal text-white' : 'text-gray-400 hover:text-white'}`}><ChartPieIcon className="w-3 h-3" /> Por Obra</button>
                <button onClick={() => setReportViewMode('by_week')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 transition-colors ${reportViewMode === 'by_week' ? 'bg-brand-teal text-white' : 'text-gray-400 hover:text-white'}`}><CalendarIcon className="w-3 h-3" /> Gastos Semana</button>
                <button onClick={() => setReportViewMode('by_hours')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 transition-colors ${reportViewMode === 'by_hours' ? 'bg-brand-teal text-white' : 'text-gray-400 hover:text-white'}`}><ClockIcon className="w-3 h-3" /> Control Horario</button>
            </div>

            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 mb-6">
              <div className="flex items-center gap-2 mb-3 text-brand-lime"><FilterIcon className="w-4 h-4" /><span className="font-bold text-sm uppercase tracking-wider">Filtros Activos</span></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-500 uppercase px-1">Técnico</label>
                    <select value={filterTech} onChange={e => setFilterTech(e.target.value)} className="bg-gray-800 border border-gray-600 text-sm rounded-lg p-2.5 text-white focus:ring-brand-teal focus:border-brand-teal outline-none transition-all">
                        <option value="">Todos los Técnicos</option>
                        {data.technicians.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                 </div>
                 <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-500 uppercase px-1">Obra</label>
                    <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="bg-gray-800 border border-gray-600 text-sm rounded-lg p-2.5 text-white focus:ring-brand-teal focus:border-brand-teal outline-none transition-all">
                        <option value="">Todas las Obras</option>
                        {data.projects.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                 </div>
                 <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-500 uppercase px-1">Fecha Desde</label>
                    <input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} className="bg-gray-800 border border-gray-600 text-sm rounded-lg p-2.5 text-white focus:ring-brand-teal focus:border-brand-teal outline-none transition-all [color-scheme:dark]" />
                 </div>
                 <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-500 uppercase px-1">Fecha Hasta</label>
                    <input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} className="bg-gray-800 border border-gray-600 text-sm rounded-lg p-2.5 text-white focus:ring-brand-teal focus:border-brand-teal outline-none transition-all [color-scheme:dark]" />
                 </div>
              </div>
            </div>

            {reportViewMode === 'list' && (
                <>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <h3 className="text-lg font-bold text-white">Registro Histórico de Actividad</h3>
                        <div className="flex gap-2">
                            <button onClick={downloadCSV} className="bg-brand-teal hover:bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg transition-colors border border-teal-500/30"><DownloadIcon className="w-4 h-4" /> Descargar Excel</button>
                            <label className="bg-brand-lime hover:bg-lime-600 text-brand-dark px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg transition-colors cursor-pointer">
                                <UploadIcon className="w-4 h-4" /> Subir Partes (CSV)
                                <input type="file" ref={reportImportInputRef} onChange={handleImportReports} accept=".csv" className="hidden" />
                            </label>
                        </div>
                    </div>
                    
                    <div className="space-y-8">
                        {Object.entries(groupedReports).map(([monthLabel, weeks]) => (
                            <div key={monthLabel} className="space-y-4">
                                <div className="bg-brand-teal/20 border-l-4 border-brand-teal px-4 py-2 flex items-center gap-3">
                                    <CalendarIcon className="w-5 h-5 text-brand-teal" />
                                    <h4 className="text-brand-teal font-black text-lg tracking-wider">{monthLabel}</h4>
                                </div>
                                
                                {Object.entries(weeks).sort((a, b) => b[1][0].date.localeCompare(a[1][0].date)).map(([weekRange, reports]) => (
                                    <div key={weekRange} className="ml-4 space-y-2">
                                        <div className="flex items-center justify-between border-b border-gray-700 pb-1">
                                            <div className="flex items-center gap-2 text-brand-lime font-bold text-sm">
                                                <div className="w-2 h-2 rounded-full bg-brand-lime"></div>
                                                SEMANA: {weekRange}
                                            </div>
                                            <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{reports.length} partes</span>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left text-gray-400">
                                                <thead className="text-[10px] text-gray-500 uppercase bg-gray-900/30">
                                                    <tr>
                                                        <th className="px-4 py-2 w-10"></th>
                                                        <th className="px-4 py-2">Fecha</th>
                                                        <th className="px-4 py-2">Técnico</th>
                                                        <th className="px-4 py-2">Obra</th>
                                                        <th className="px-4 py-2 text-right">Extras</th>
                                                        <th className="px-4 py-2 text-right">Gastos</th>
                                                        <th className="px-4 py-2 text-center">Acción</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {reports.map((report) => {
                                                        const totalExpenses = Object.values(report.expenses).reduce((a: number, b: any) => (typeof b === 'number' ? a + b : a), 0) as number;
                                                        const isExpanded = expandedReportId === report.id;
                                                        return (
                                                            <React.Fragment key={report.id}>
                                                                <tr className={`bg-gray-800/40 border-b border-gray-700/50 hover:bg-gray-800 transition-colors ${isExpanded ? 'bg-gray-800 border-brand-teal/30' : ''}`}>
                                                                    <td className="px-4 py-2">
                                                                        <button onClick={() => toggleExpandReport(report.id)} className="text-brand-teal hover:text-white transition-colors"><EyeIcon className="w-4 h-4" /></button>
                                                                    </td>
                                                                    <td className="px-4 py-2 whitespace-nowrap text-xs font-mono">{formatDateToSpanish(report.date)}</td>
                                                                    <td className="px-4 py-2 text-xs font-bold text-gray-300">{report.technician}</td>
                                                                    <td className="px-4 py-2 font-mono text-brand-teal text-xs">{report.projectNum}</td>
                                                                    <td className="px-4 py-2 text-right text-yellow-500 font-mono text-xs">{report.overtimeHours ? `+${report.overtimeHours}h` : ''}</td>
                                                                    <td className="px-4 py-2 text-right font-medium text-gray-300 text-xs">{totalExpenses > 0 ? `${totalExpenses.toFixed(2)}€` : '-'}</td>
                                                                    <td className="px-4 py-2 text-center">
                                                                        <button onClick={() => handleDeleteReport(report.id)} className="text-red-500/50 hover:text-red-500 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                                                    </td>
                                                                </tr>
                                                                {isExpanded && (
                                                                    <tr className="bg-gray-900 border-b border-gray-700">
                                                                        <td colSpan={7} className="p-4 relative">
                                                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-teal"></div>
                                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pl-4">
                                                                                <div className="md:col-span-2 space-y-4">
                                                                                    <div className="flex justify-between items-start">
                                                                                        <div><h4 className="text-brand-lime text-[10px] uppercase font-bold mb-1">Descripción Trabajo</h4><div className="bg-gray-800 p-3 rounded-lg text-gray-300 text-xs whitespace-pre-wrap">{report.description}</div></div>
                                                                                    </div>
                                                                                    <div className="grid grid-cols-2 gap-4">
                                                                                        <div><h4 className="text-gray-500 text-[10px] uppercase mb-1">Horario</h4><p className="text-white font-mono text-sm">{report.startTime} - {report.endTime}</p></div>
                                                                                        <div>
                                                                                            <h4 className="text-gray-500 text-[10px] uppercase mb-1">Vehículo</h4>
                                                                                            <p className="text-white text-sm">
                                                                                                {report.vehicle} {report.isDriver ? `(Conduct. - ${report.driverTripType || 'N/A'})` : ''}
                                                                                            </p>
                                                                                        </div>
                                                                                    </div>
                                                                                    {report.tickets && report.tickets.length > 0 && (
                                                                                      <div>
                                                                                        <h4 className="text-brand-lime text-[10px] uppercase font-bold mb-2">Tickets Adjuntos (Clic para ampliar)</h4>
                                                                                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                                                                          {report.tickets.map((t, idx) => (
                                                                                            <div key={idx} className="flex-shrink-0 relative group">
                                                                                              <img 
                                                                                                src={t.data} 
                                                                                                className="w-24 h-24 object-cover rounded-lg border border-gray-700 cursor-zoom-in hover:border-brand-lime transition-all transform hover:scale-105" 
                                                                                                onClick={() => setSelectedImage({data: t.data, type: t.type})} 
                                                                                              />
                                                                                              <div className="absolute bottom-1 left-1 bg-black/60 px-1 rounded text-[8px] text-white font-bold">{t.type}</div>
                                                                                            </div>
                                                                                          ))}
                                                                                        </div>
                                                                                      </div>
                                                                                    )}
                                                                                </div>
                                                                                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 h-fit"><h4 className="text-brand-lime text-[10px] uppercase font-bold mb-2">Gastos</h4><div className="space-y-1 text-xs"><div className="flex justify-between text-gray-400"><span>Comida</span><span>{report.expenses.food}€</span></div><div className="flex justify-between text-gray-400"><span>Gasolina</span><span>{report.expenses.gas}€</span></div><div className="flex justify-between text-gray-400"><span>Parking</span><span>{report.expenses.parking}€</span></div><div className="flex justify-between text-gray-400"><span>Otros</span><span>{report.expenses.others}€</span></div><div className="flex justify-between text-brand-teal font-bold border-t border-gray-700 pt-1 mt-1"><span>TOTAL</span><span>{totalExpenses.toFixed(2)}€</span></div></div></div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {reportViewMode === 'by_project' && (
                <div className="space-y-6">
                    <h3 className="text-lg font-bold text-white mb-4">Resumen de Gastos y Actividad por Obra</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {projectsSummary.map(([project, summary]) => (
                            <div key={project} className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 hover:border-brand-teal transition-all group">
                                <div className="flex justify-between items-start mb-3">
                                    <h4 className="text-brand-teal font-black text-sm font-mono truncate mr-2" title={project}>{project}</h4>
                                    <span className="bg-gray-800 text-brand-lime px-2 py-0.5 rounded text-[10px] font-bold">{summary.count} partes</span>
                                </div>
                                <div className="space-y-1 text-xs text-gray-400">
                                    <div className="flex justify-between italic"><span>Comida</span><span>{summary.food.toFixed(2)}€</span></div>
                                    <div className="flex justify-between italic"><span>Gasolina</span><span>{summary.gas.toFixed(2)}€</span></div>
                                    <div className="flex justify-between italic"><span>Otros</span><span>{(summary.parking + summary.others).toFixed(2)}€</span></div>
                                    <div className="flex justify-between text-white font-bold border-t border-gray-700 pt-1 mt-1">
                                        <span>TOTAL GASTOS</span>
                                        <span className="text-brand-lime">{(summary.food + summary.gas + summary.parking + summary.others).toFixed(2)}€</span>
                                    </div>
                                    <div className="flex justify-between text-yellow-500 font-bold mt-1 uppercase text-[10px]">
                                        <span>Horas Extra</span>
                                        <span>{summary.ot}h</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {projectsSummary.length === 0 && <p className="text-center py-10 text-gray-600">No hay datos para las obras seleccionadas.</p>}
                </div>
            )}

            {reportViewMode === 'by_hours' && (
                <div className="space-y-6">
                    <h3 className="text-lg font-bold text-white mb-4">Control Horario por Técnico y Semana</h3>
                    <div className="space-y-8">
                        {hoursSummary.map(([week, techs]) => (
                            <div key={week} className="bg-gray-900/30 rounded-xl border border-gray-700 overflow-hidden">
                                <div className="bg-gray-800 p-3 border-b border-gray-700 flex items-center gap-2">
                                    <ClockIcon className="w-4 h-4 text-brand-teal" />
                                    <span className="text-brand-teal font-black text-sm uppercase">Semana: {week}</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-900/50 text-gray-500 uppercase text-[9px]">
                                            <tr>
                                                <th className="px-4 py-2">Técnico</th>
                                                <th className="px-4 py-2 text-right">Horas Normales</th>
                                                <th className="px-4 py-2 text-right">Horas Extra</th>
                                                <th className="px-4 py-2 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800">
                                            {/* // Fix: Added type casting for Object.entries to resolve 'unknown' type errors for tech hours summary */}
                                            {(Object.entries(techs) as [string, { reg: number; ot: number }][]).map(([tech, hours]) => (
                                                <tr key={tech} className="hover:bg-gray-800/40">
                                                    <td className="px-4 py-3 font-bold text-gray-200">{tech}</td>
                                                    <td className="px-4 py-3 text-right text-gray-400 font-mono">{hours.reg.toFixed(1)}h</td>
                                                    <td className="px-4 py-3 text-right text-yellow-500 font-mono">+{hours.ot.toFixed(1)}h</td>
                                                    <td className="px-4 py-3 text-right font-black text-white font-mono">{(hours.reg + hours.ot).toFixed(1)}h</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {reportViewMode === 'by_week' && (
                <div className="space-y-6">
                    <h3 className="text-lg font-bold text-white mb-4">Resumen de Gastos por Técnico y Semana</h3>
                    <div className="space-y-8">
                        {weeklyExpensesSummary.map(([week, techs]) => (
                            <div key={week} className="bg-gray-900/30 rounded-xl border border-gray-700 overflow-hidden">
                                <div className="bg-gray-800 p-3 border-b border-gray-700 flex items-center gap-2">
                                    <ChartPieIcon className="w-4 h-4 text-brand-lime" />
                                    <span className="text-brand-lime font-black text-sm uppercase">Semana: {week}</span>
                                </div>
                                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* // Fix: Added type casting for Object.entries to resolve 'unknown' type error for total.toFixed */}
                                    {(Object.entries(techs) as [string, number][]).map(([tech, total]) => (
                                        <div key={tech} className="bg-gray-950 p-3 rounded-lg border border-gray-800 flex justify-between items-center">
                                            <span className="text-xs font-bold text-gray-400">{tech}</span>
                                            <span className="text-sm font-black text-white font-mono">{total.toFixed(2)}€</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </div>
        )}

        {/* Pestañas secundarias (Techs, Projects, etc) */}
        {tab === 'techs' && (
            <div className="space-y-6">
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                <h3 className="text-sm font-bold text-white mb-4 uppercase">Añadir Nuevo Técnico</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input type="text" placeholder="Nombre completo" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm" />
                    <input type="password" placeholder="Contraseña inicial" value={newTechPwd} onChange={e => setNewTechPwd(e.target.value)} className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm" />
                    <button onClick={() => handleAdd('techs')} className="bg-brand-teal text-white px-6 py-2 rounded-lg font-bold flex items-center justify-center gap-2"><PlusIcon className="w-4 h-4" /> Añadir</button>
                </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.technicians.map((t, i) => (
                    <div key={t.id} className="bg-gray-900/30 p-4 rounded-xl border border-gray-700 flex justify-between items-center group">
                        {editingIndex === i ? (
                            <div className="flex-1 flex gap-2">
                                <input value={editValue} onChange={e => setEditValue(e.target.value)} className="flex-1 bg-gray-800 border border-brand-teal rounded px-2 py-1 text-xs" />
                                <input value={editPwdValue} onChange={e => setEditPwdValue(e.target.value)} className="flex-1 bg-gray-800 border border-brand-teal rounded px-2 py-1 text-xs" />
                                <button onClick={() => saveEditing('techs')} className="text-green-500"><SaveIcon className="w-4 h-4" /></button>
                                <button onClick={cancelEditing} className="text-red-500"><XIcon className="w-4 h-4" /></button>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-brand-teal/20 rounded-full flex items-center justify-center text-brand-teal font-bold">{t.name.charAt(0)}</div>
                                    <div>
                                        <p className="font-bold text-sm text-gray-200">{t.name}</p>
                                        <p className="text-[10px] text-gray-500">Pass: {t.password}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEditing(i, t, 'techs')} className="text-gray-500 hover:text-brand-teal"><EditIcon className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete('techs', i)} className="text-gray-500 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
                </div>
            </div>
        )}

        {tab === 'projects' && (
            <div className="space-y-6">
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                    <h3 className="text-sm font-bold text-white mb-4 uppercase">Gestión de Obras</h3>
                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
                        <input type="text" placeholder="Ej: 24001 - HOSPITAL ALICANTE" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm" />
                        <button onClick={() => handleAdd('projects')} className="bg-brand-teal text-white px-6 py-2 rounded-lg font-bold flex items-center justify-center gap-2"><PlusIcon className="w-4 h-4" /> Añadir</button>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <label className="flex items-center gap-2 text-xs text-brand-lime cursor-pointer bg-brand-lime/10 p-2 rounded-lg border border-brand-lime/20 hover:bg-brand-lime/20 transition-all">
                            <UploadIcon className="w-4 h-4" /> Importar Obras (Archivo TXT/CSV)
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.csv" className="hidden" />
                        </label>
                        <button 
                            onClick={handleDeleteAllProjects}
                            className="flex items-center gap-2 text-xs text-red-400 cursor-pointer bg-red-900/20 p-2 rounded-lg border border-red-900/30 hover:bg-red-900/40 transition-all"
                        >
                            <TrashIcon className="w-4 h-4" /> Borrar Todas las Obras
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {data.projects.map((p, i) => (
                    <div key={i} className="bg-gray-900/30 px-4 py-2 rounded-lg border border-gray-700 flex justify-between items-center group">
                        {editingIndex === i ? (
                            <div className="flex-1 flex gap-2">
                                <input value={editValue} onChange={e => setEditValue(e.target.value)} className="flex-1 bg-gray-800 border border-brand-teal rounded px-2 py-1 text-xs" />
                                <button onClick={() => saveEditing('projects')} className="text-green-500"><SaveIcon className="w-4 h-4" /></button>
                                <button onClick={cancelEditing} className="text-red-500"><XIcon className="w-4 h-4" /></button>
                            </div>
                        ) : (
                            <>
                                <span className="text-xs text-gray-300 font-mono">{p}</span>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEditing(i, p, 'projects')} className="text-gray-500 hover:text-brand-teal"><EditIcon className="w-3 h-3" /></button>
                                    <button onClick={() => handleDelete('projects', i)} className="text-gray-500 hover:text-red-500"><TrashIcon className="w-3 h-3" /></button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
                {data.projects.length === 0 && (
                    <div className="col-span-full py-10 text-center text-gray-600 border border-dashed border-gray-800 rounded-xl">
                        No hay obras registradas.
                    </div>
                )}
                </div>
            </div>
        )}

        {tab === 'vehicles' && (
            <div className="space-y-6">
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                <h3 className="text-sm font-bold text-white mb-4 uppercase">Añadir Vehículo</h3>
                <div className="flex gap-2">
                    <input type="text" placeholder="Ej: 1234ABC - FORD TRANSIT" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm" />
                    <button onClick={() => handleAdd('vehicles')} className="bg-brand-teal text-white px-6 py-2 rounded-lg font-bold flex items-center justify-center gap-2"><PlusIcon className="w-4 h-4" /> Añadir</button>
                </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.vehicles.map((v, i) => (
                    <div key={i} className="bg-gray-900/30 p-4 rounded-xl border border-gray-700 flex justify-between items-center group">
                        {editingIndex === i ? (
                            <div className="flex-1 flex gap-2">
                                <input value={editValue} onChange={e => setEditValue(e.target.value)} className="flex-1 bg-gray-800 border border-brand-teal rounded px-2 py-1 text-xs" />
                                <button onClick={() => saveEditing('vehicles')} className="text-green-500"><SaveIcon className="w-4 h-4" /></button>
                                <button onClick={cancelEditing} className="text-red-500"><XIcon className="w-4 h-4" /></button>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-3">
                                    <TruckIcon className="w-5 h-5 text-gray-500" />
                                    <span className="text-sm font-bold text-gray-300">{v}</span>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEditing(i, v, 'vehicles')} className="text-gray-500 hover:text-brand-teal"><EditIcon className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete('vehicles', i)} className="text-gray-500 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
                </div>
            </div>
        )}

        {tab === 'daily' && (<DailyOrganization isReadOnly={false} data={data.dailyOrg} onUpdate={(newOrg) => setData(prev => ({...prev, dailyOrg: newOrg}))} />)}

        {tab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-8">
                <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><LockIcon className="w-5 h-5 text-brand-teal" /> Seguridad del Sistema</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Nueva Contraseña Admin</label>
                        <input type="text" value={newAdminPwd} onChange={e => setNewAdminPwd(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white font-mono" />
                    </div>
                    <div className="pt-4 border-t border-gray-800">
                        <h4 className="text-sm font-bold text-brand-lime flex items-center gap-2 mb-4"><CloudIcon className="w-4 h-4" /> Sincronización Cloud (Firebase)</h4>
                        <div className="bg-blue-900/20 border border-blue-900/50 p-3 rounded-lg text-xs text-blue-200 mb-4">
                            <AlertIcon className="inline w-3 h-3 mr-1" /> No modifiques esto a menos que sepas qué haces. Aquí se guarda la configuración de la base de datos remota.
                        </div>
                        <textarea value={firebaseConfigInput} onChange={e => setFirebaseConfigInput(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white font-mono text-[10px]" rows={6} placeholder='{"apiKey": "...", ...}' />
                    </div>
                    <button onClick={savePasswords} className="w-full bg-brand-teal hover:bg-teal-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
                        <SaveIcon className="w-5 h-5" /> Guardar Cambios
                    </button>
                    {pwdMsg && <p className="text-center text-xs text-green-400 font-bold animate-pulse">{pwdMsg}</p>}
                </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
