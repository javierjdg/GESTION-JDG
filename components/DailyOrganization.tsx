
import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { TrashIcon, CalendarIcon, SaveIcon, CheckCircleIcon } from './icons';

// Exported types for App.tsx usage
export interface WorkerOrg {
  id: number;
  nombre: string;
  color: string;
  asignado: boolean;
  isManual?: boolean;
}

export interface JobOrg {
  id: number;
  nombre: string;
  color: string;
  trabajadores: WorkerOrg[];
}

export interface DailyOrgData {
  trabajos: JobOrg[];
  trabajadores: WorkerOrg[];
  fecha: string;
  lastUpdated?: number; // Timestamp para notificaciones
}

interface DailyOrganizationProps {
  isReadOnly?: boolean;
  onBack?: () => void;
  data: DailyOrgData;
  onUpdate: (newData: DailyOrgData) => void;
  onChangeDate: (newDate: string) => void;
  onMarkSeen?: () => void; // Prop para limpiar notificación
}

const DailyOrganization: React.FC<DailyOrganizationProps> = ({ isReadOnly = false, onBack, data, onUpdate, onChangeDate, onMarkSeen }) => {
  // ESTADO LOCAL para edición
  const [localData, setLocalData] = useState<DailyOrgData>(data);
  const [isDirty, setIsDirty] = useState(false); // Para saber hay cambios sin guardar
  const [isSaving, setIsSaving] = useState(false);
  const autoSaveTimeoutRef = useRef<any>(null);

  const [colorIdx, setColorIdx] = useState(14);
  const [nuevo, setNuevo] = useState('');
  const [nuevoT, setNuevoT] = useState('');
  const [dragged, setDragged] = useState<WorkerOrg | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nombreEdit, setNombreEdit] = useState('');

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Cuando se monta el componente en modo lectura (Técnico), marcar como visto
  useEffect(() => {
      if (isReadOnly && onMarkSeen) {
          onMarkSeen();
      }
  }, [isReadOnly, onMarkSeen]);

  // Sincronizar data externa si cambia
  useEffect(() => {
      setLocalData(data);
  }, [data]);

  const updateLocal = (newData: DailyOrgData) => {
      setLocalData(newData);
      setIsDirty(true);
      setIsSaving(true);

      if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
      }

      // Guardado automático: Propagar cambios inmediatamente al componente padre
      onUpdate({
          ...newData,
          lastUpdated: Date.now()
      });

      autoSaveTimeoutRef.current = setTimeout(() => {
          setIsDirty(false);
          setIsSaving(false);
      }, 1000);
  };

  const handleSave = () => {
      // Actualizamos el timestamp para disparar notificaciones a los técnicos
      const dataToSave = {
          ...localData,
          lastUpdated: Date.now()
      };
      onUpdate(dataToSave);
      setIsDirty(false);
      toast.success(`Organización del ${localData.fecha} guardada correctamente.`);
  };

  const handleDateChangeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVal = e.target.value;
      if (!newVal) return; // Previene fecha vacía si el navegador fuerza el borrado

      if (isDirty) {
          if (!window.confirm("⚠️ Tienes cambios SIN GUARDAR en este día.\n\nSi cambias de fecha sin guardar, perderás los cambios actuales.\n\n¿Continuar sin guardar?")) {
              e.preventDefault();
              return;
          }
      }
      onChangeDate(newVal);
  };

  const colors = ['#E63946','#F77F00','#06D6A0','#118AB2','#073B4C','#D62828','#FCA311','#14213D','#00B4D8','#0077B6'];
  
  const addTrabajo = () => {
    if (nuevo.trim()) {
      const newJob: JobOrg = { id: Date.now(), nombre: nuevo, color: colors[colorIdx % colors.length], trabajadores: [] };
      updateLocal({
        ...localData,
        trabajos: [...localData.trabajos, newJob]
      });
      setColorIdx(colorIdx + 1);
      setNuevo('');
    }
  };

  const addTrabajador = () => {
    if (nuevoT.trim()) {
      const newWorker: WorkerOrg = { id: Date.now(), nombre: nuevoT, color: colors[colorIdx % colors.length], asignado: false, isManual: true };
      updateLocal({
        ...localData,
        trabajadores: [...localData.trabajadores, newWorker]
      });
      setColorIdx(colorIdx + 1);
      setNuevoT('');
    }
  };

  const delTrabajo = (id: number) => {
    const t = localData.trabajos.find(x => x.id === id);
    if (t) {
        const newWorkers = localData.trabajadores.map(x => t.trabajadores.some(y => y.id === x.id) ? { ...x, asignado: false } : x);
        const newJobs = localData.trabajos.filter(x => x.id !== id);
        updateLocal({ ...localData, trabajos: newJobs, trabajadores: newWorkers });
    }
  };

  const delTrabajador = (id: number) => {
    const newJobs = localData.trabajos.map(t => ({ ...t, trabajadores: t.trabajadores.filter(x => x.id !== id) }));
    const newWorkers = localData.trabajadores.filter(x => x.id !== id);
    updateLocal({ ...localData, trabajos: newJobs, trabajadores: newWorkers });
  };

  const drop = (e: React.DragEvent, trabajo: JobOrg) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (dragged && !dragged.asignado) {
      const newJobs = localData.trabajos.map(t => t.id === trabajo.id ? { ...t, trabajadores: [...t.trabajadores, dragged] } : t);
      const newWorkers = localData.trabajadores.map(t => t.id === dragged.id ? { ...t, asignado: true } : t);
      updateLocal({ ...localData, trabajos: newJobs, trabajadores: newWorkers });
    }
    setDragged(null);
  };

  const remove = (tId: number, trId: number) => {
    const newJobs = localData.trabajos.map(t => t.id === tId ? { ...t, trabajadores: t.trabajadores.filter(x => x.id !== trId) } : t);
    const newWorkers = localData.trabajadores.map(t => t.id === trId ? { ...t, asignado: false } : t);
    updateLocal({ ...localData, trabajos: newJobs, trabajadores: newWorkers });
  };

  const iniciarEdicion = (id: number, nombreActual: string) => {
    if (isReadOnly) return;
    setEditandoId(id);
    setNombreEdit(nombreActual);
  };

  const guardarEdicion = () => {
    if (nombreEdit.trim() && editandoId) {
      const newJobs = localData.trabajos.map(t => 
        t.id === editandoId ? { ...t, nombre: nombreEdit.trim() } : t
      );
      updateLocal({ ...localData, trabajos: newJobs });
    }
    setEditandoId(null);
    setNombreEdit('');
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setNombreEdit('');
  };

  const exportar = () => {
    const blob = new Blob([JSON.stringify(localData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asignaciones-${localData.fecha}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const d = JSON.parse(ev.target?.result as string);
          if (Array.isArray(d.trabajos) && Array.isArray(d.trabajadores)) {
             updateLocal({
                 trabajos: d.trabajos,
                 trabajadores: d.trabajadores,
                 fecha: d.fecha || localData.fecha
             });
             toast.success('✓ Importado correctamente (Recuerda GUARDAR)');
          } else {
             toast.error('Formato de archivo incorrecto');
          }
        } catch { toast.error('✗ Error al leer archivo'); }
      };
      reader.readAsText(file);
    }
  };

  const reset = () => {
    if (window.confirm('¿Borrar toda la organización diaria actual?')) {
        updateLocal({
            trabajos: [],
            trabajadores: [],
            fecha: localData.fecha 
        });
    }
  };

  const disponibles = localData.trabajadores.filter(t => !t.asignado);

  return (
    <div className="text-gray-900 dark:text-gray-200 animate-fade-in">
        <style>
            {`
                input[type="date"]::-webkit-clear-button {
                    display: none;
                }
                input[type="date"]::-webkit-inner-spin-button {
                    display: none;
                }
            `}
        </style>
        {onBack && (
            <button 
                onClick={onBack}
                className="mb-4 flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors py-2 px-4 rounded hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent hover:border-gray-300 dark:hover:border-gray-700"
            >
                ← Volver al Menú
            </button>
        )}

        <div className="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6 shadow-md">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-brand-teal dark:text-brand-lime flex items-center gap-2">
                 <CalendarIcon className="w-8 h-8" />
                 Organización Diaria
              </h1>
              {isReadOnly ? (
                  <p className="text-xs text-brand-teal mt-1 flex items-center gap-1">👁️ Modo Lectura - Historial</p>
              ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Arrastra trabajadores a las obras</p>
              )}
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 items-end md:items-center w-full md:w-auto">
              {/* Selector de Fecha */}
              <div className="relative">
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Fecha Visualizada</label>
                  <input 
                    type="date" 
                    required
                    value={localData.fecha} 
                    onChange={handleDateChangeInput} 
                    className={`px-4 py-2 bg-gray-50 dark:bg-gray-800 border-2 ${isDirty ? 'border-orange-400' : 'border-gray-300 dark:border-gray-600'} rounded-lg text-gray-900 dark:text-white font-bold cursor-pointer hover:border-brand-teal transition-colors shadow-sm`} 
                  />
              </div>

              {/* Botón Guardar - SOLO ADMIN */}
              {!isReadOnly && (
                  <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 italic">
                          {isSaving ? "⚡ Guardando en la nube..." : "✓ Autoguardado activo"}
                      </span>
                      <button 
                        onClick={handleSave}
                        disabled={!isDirty && !isSaving}
                        className={`px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg transition-all transform active:scale-95 ${
                            isSaving
                            ? 'bg-orange-500 text-white animate-pulse'
                            : isDirty 
                            ? 'bg-green-600 hover:bg-green-500 text-white' 
                            : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <SaveIcon className="w-5 h-5" />
                        {isSaving ? 'GUARDANDO...' : isDirty ? 'GUARDAR' : 'GUARDADO'}
                      </button>
                  </div>
              )}
            </div>
          </div>

          {!isReadOnly && (
            <>
              {isDirty && !isSaving && (
                  <div className="mb-4 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 p-3 rounded-lg border border-orange-200 dark:border-orange-800 flex items-center justify-center gap-2 text-sm font-bold animate-pulse">
                      ⚠️ Tienes cambios temporales listos para sincronizar en la nube.
                  </div>
              )}

              <div className="flex gap-2 mb-6 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg flex-wrap border border-gray-200 dark:border-gray-700">
                <button onClick={exportar} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm shadow-sm">📥 Exportar</button>
                <label className="px-4 py-2 bg-brand-teal text-white rounded-lg hover:bg-teal-600 cursor-pointer text-sm shadow-sm">
                  📤 Importar
                  <input type="file" accept=".json" onChange={importar} className="hidden" />
                </label>
                <button onClick={reset} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 text-sm shadow-sm">🗑️ Resetear</button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-blue-600 dark:text-blue-400 mb-3">🏢 Agregar Trabajo</h3>
                  <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={nuevo} 
                        onChange={(e) => setNuevo(e.target.value)} 
                        placeholder="Nombre del trabajo" 
                        className="flex-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-teal outline-none" 
                        onKeyPress={(e) => e.key === 'Enter' && addTrabajo()} 
                    />
                    <button onClick={addTrabajo} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow-sm">+</button>
                  </div>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-green-600 dark:text-green-400 mb-3">👥 Agregar Trabajador</h3>
                  <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={nuevoT} 
                        onChange={(e) => setNuevoT(e.target.value)} 
                        placeholder="Nombre del trabajador" 
                        className="flex-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-teal outline-none" 
                        onKeyPress={(e) => e.key === 'Enter' && addTrabajador()} 
                    />
                    <button onClick={addTrabajador} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 shadow-sm">+</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-brand-panel rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">👥 Disponibles <span className="text-sm bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full text-gray-700 dark:text-white">{disponibles.length}</span></h2>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {disponibles.map(t => (
                <div 
                    key={t.id} 
                    draggable={!isReadOnly} 
                    onDragStart={() => !isReadOnly && setDragged(t)} 
                    className={`flex items-center justify-between p-4 rounded-xl border-2 border-dashed transition-all transform ${!isReadOnly ? 'cursor-move hover:shadow-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:-translate-y-1' : ''}`} 
                    style={{ borderColor: t.color }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }}></div>
                    <span className="font-bold text-lg text-gray-800 dark:text-white break-words">{t.nombre}</span>
                  </div>
                  {!isReadOnly && (
                    <button onClick={() => delTrabajador(t.id)} className="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 p-2">
                        <TrashIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              {disponibles.length === 0 && <p className="text-center text-gray-500 py-8">Todos asignados</p>}
            </div>
          </div>

          <div className="lg:col-span-3 grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {localData.trabajos.map(trabajo => (
              <div 
                key={trabajo.id} 
                onDragOver={(e) => e.preventDefault()} 
                onDrop={(e) => drop(e, trabajo)} 
                className="bg-white dark:bg-brand-panel rounded-xl shadow-lg overflow-hidden border-2 border-dashed flex flex-col" 
                style={{ borderColor: trabajo.color }}
              >
                <div className="p-4 text-white font-bold" style={{ backgroundColor: trabajo.color }}>
                  <div className="flex justify-between items-center mb-2 gap-2">
                    {editandoId === trabajo.id && !isReadOnly ? (
                      <div className="flex-1 flex gap-1">
                        <input 
                          type="text" 
                          value={nombreEdit} 
                          onChange={(e) => setNombreEdit(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') guardarEdicion();
                            if (e.key === 'Escape') cancelarEdicion();
                          }}
                          className="flex-1 px-2 py-1 rounded text-gray-900 text-base"
                          autoFocus
                        />
                        <button 
                          onClick={guardarEdicion}
                          className="px-2 bg-green-500 hover:bg-green-600 rounded text-sm"
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <h3 
                        className={`text-lg flex-1 drop-shadow-md break-words ${!isReadOnly ? 'cursor-pointer hover:opacity-80' : ''}`} 
                        onClick={() => iniciarEdicion(trabajo.id, trabajo.nombre)}
                        title={!isReadOnly ? "Clic para editar" : ""}
                      >
                        {trabajo.nombre}
                      </h3>
                    )}
                    {!isReadOnly && (
                        <button 
                        onClick={() => delTrabajo(trabajo.id)} 
                        className="hover:opacity-80 flex-shrink-0 text-white"
                        >
                        <TrashIcon className="w-5 h-5" />
                        </button>
                    )}
                  </div>
                  <div className="text-xs text-center border-t border-white border-opacity-30 pt-2 text-white/90">📅 {new Date(localData.fecha).toLocaleDateString('es-ES')}</div>
                </div>
                <div className="p-4 flex-1 bg-gray-50 dark:bg-gray-900/30">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Asignados</span>
                    <span className="bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded-full text-xs text-gray-600 dark:text-gray-300">{(trabajo.trabajadores || []).length}</span>
                  </div>
                  <div className="space-y-3 min-h-[100px]">
                    {(trabajo.trabajadores || []).map(t => (
                      <div key={t.id} className="flex items-center justify-between p-3 rounded-lg shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }}></div>
                          <span className="text-base font-bold text-gray-800 dark:text-gray-100 break-words">{t.nombre}</span>
                        </div>
                        {!isReadOnly && (
                            <button onClick={() => remove(trabajo.id, t.id)} className="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 text-xs flex-shrink-0 p-1">
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        )}
                      </div>
                    ))}
                    {(!trabajo.trabajadores || trabajo.trabajadores.length === 0) && (
                      <div className="text-center text-gray-500 py-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                        <p className="text-xs">
                            {isReadOnly ? 'Sin personal asignado' : 'Arrastra trabajadores aquí'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
    </div>
  );
};

export default DailyOrganization;
