import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { AppData, VacationRequest, TechUser } from '../App';
import { CalendarIcon, ClockIcon, CheckCircleIcon, XCircleIcon, PlusIcon, TrashIcon, AlertIcon, ChevronLeftIcon, ChevronRightIcon, UserIcon } from './icons';

interface VacationManagerProps {
  role: 'admin' | 'tech';
  currentUser: string;
  currentUserId: string;
  data: AppData;
  onUpdate: (data: AppData) => void;
  onBack: () => void;
}

const LIMIT_DAYS = 20;

// Paleta de colores para técnicos
const TECH_COLORS = [
    '#00797b', '#b0d12a', '#3b82f6', '#ef4444', '#f59e0b', 
    '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e',
    '#4ade80', '#fbbf24', '#f87171', '#60a5fa', '#a78bfa',
    '#2dd4bf', '#a3e635', '#fb7185', '#818cf8', '#fb923c'
];

const TYPE_CONFIG = {
    vacation: { label: 'Vacaciones', code: 'V', icon: '🌴' },
    sick: { label: 'Enfermedad', code: 'E', icon: '🤒' },
    personal: { label: 'A. Propios', code: 'A', icon: '📋' }
};

// Helper para formatear Date a YYYY-MM-DD local (evita desfases de zona horaria)
const toLocalISOString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Helper para obtener el color de un técnico de forma consistente
const getTechColor = (name: string, technicians: TechUser[]) => {
    const idx = technicians.findIndex(t => t.name === name);
    return idx !== -1 ? TECH_COLORS[idx % TECH_COLORS.length] : '#9ca3af';
};

// Helper para obtener la configuración de tipo de forma segura (maneja datos antiguos sin 'type')
const getTypeConfig = (type?: string) => {
    const t = type as keyof typeof TYPE_CONFIG;
    return TYPE_CONFIG[t] || TYPE_CONFIG.vacation;
};

const formatDateToSpanish = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
};

const VacationManager: React.FC<VacationManagerProps> = ({ role, currentUser, currentUserId, data, onUpdate, onBack }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reqType, setReqType] = useState<'vacation' | 'sick' | 'personal'>('vacation');
    const [adminSelectedTech, setAdminSelectedTech] = useState('');
    const [newHoliday, setNewHoliday] = useState('');
    const [msg, setMsg] = useState('');
    
    const [viewDate, setViewDate] = useState(new Date());
    const [showVisibilityConfig, setShowVisibilityConfig] = useState(false);

    // Todos los técnicos activos ordenados alfabéticamente
    const sortedTechnicians = useMemo(() => {
        return [...(data.technicians || [])]
            .filter(t => t.active !== false)
            .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    }, [data.technicians]);

    // Técnicos visibles en el cuadrante de vacaciones (excluye ocultos)
    const visibleTechnicians = useMemo(() => {
        return sortedTechnicians.filter(t => !t.hideInVacations);
    }, [sortedTechnicians]);

    const hiddenCount = useMemo(() => {
        return sortedTechnicians.filter(t => t.hideInVacations).length;
    }, [sortedTechnicians]);

    const toggleTechVisibility = (techId: string) => {
        const updatedTechs = (data.technicians || []).map(t => {
            if (t.id === techId) {
                const nextState = !t.hideInVacations;
                toast.info(`Técnico "${t.name}" ${nextState ? 'ocultado' : 'visible'} en vacaciones`);
                return { ...t, hideInVacations: nextState };
            }
            return t;
        });
        onUpdate({
            ...data,
            technicians: updatedTechs
        });
    };

    const holidays = useMemo(() => data.holidays || [], [data.holidays]);

    const calculateBusinessDays = (start: string, end: string) => {
        // Parsear fechas manualmente para asegurar interpretación local
        const [y1, m1, d1_val] = start.split('-').map(Number);
        const [y2, m2, d2_val] = end.split('-').map(Number);
        const dStart = new Date(y1, m1 - 1, d1_val);
        const dEnd = new Date(y2, m2 - 1, d2_val);
        
        let count = 0;
        const current = new Date(dStart);
        while (current <= dEnd) {
            const dayOfWeek = current.getDay();
            const dateStr = toLocalISOString(current);
            if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.includes(dateStr)) {
                count++;
            }
            current.setDate(current.getDate() + 1);
        }
        return count;
    };

    const userRequests = useMemo(() => {
        return (data.vacationRequests || []).filter(r => r.userName === currentUser);
    }, [data.vacationRequests, currentUser]);

    const usedDays = useMemo(() => {
        return userRequests
            .filter(r => r.status === 'approved')
            .reduce((sum, r) => sum + r.days, 0);
    }, [userRequests]);

    const currentBusinessDays = useMemo(() => {
        if (!startDate || !endDate) return 0;
        return calculateBusinessDays(startDate, endDate);
    }, [startDate, endDate, holidays]);

    const calendarDays = useMemo(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = [];
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            const dateStr = toLocalISOString(date);
            days.push({
                day: i,
                dateStr,
                isWeekend: date.getDay() === 0 || date.getDay() === 6,
                isHoliday: holidays.includes(dateStr),
                label: ['D', 'L', 'M', 'X', 'J', 'V', 'S'][date.getDay()]
            });
        }
        return days;
    }, [viewDate, holidays]);

    const handleRequest = (e: React.FormEvent) => {
        e.preventDefault();
        const days = currentBusinessDays;
        if (days <= 0) return setMsg('Error: Fechas no laborables.');

        const isManualAdmin = role === 'admin' && adminSelectedTech !== '';
        const targetTech = isManualAdmin ? data.technicians.find(t => t.name === adminSelectedTech) : null;

        const newReq: VacationRequest = {
            id: Date.now().toString(),
            userId: isManualAdmin ? (targetTech?.id || '0') : currentUserId,
            userName: isManualAdmin ? adminSelectedTech : currentUser,
            startDate,
            endDate,
            days,
            type: reqType,
            status: isManualAdmin ? 'approved' : 'pending',
            requestDate: toLocalISOString(new Date())
        };

        onUpdate({
            ...data,
            vacationRequests: [newReq, ...(data.vacationRequests || [])]
        });

        setStartDate('');
        setEndDate('');
        setAdminSelectedTech('');
        setMsg(isManualAdmin ? '✓ Registro manual creado.' : '✓ Solicitud enviada correctamente.');
        setTimeout(() => setMsg(''), 3000);
    };

    const addHoliday = () => {
        if (!newHoliday) return;
        if (holidays.includes(newHoliday)) {
            toast.error('Este festivo ya está registrado.');
            return;
        }
        
        onUpdate({
            ...data,
            holidays: [...holidays, newHoliday].sort()
        });
        setNewHoliday('');
        toast.success('Festivo añadido correctamente.');
    };

    const removeHoliday = (hDate: string) => {
        if (!window.confirm('¿Eliminar este festivo local?')) return;
        onUpdate({
            ...data,
            holidays: holidays.filter(h => h !== hDate)
        });
    };

    const requestCancellation = (id: string) => {
        if (!window.confirm('¿Solicitar la anulación de estos días al administrador?')) return;
        onUpdate({
            ...data,
            vacationRequests: data.vacationRequests.map(r => 
                r.id === id ? { ...r, status: 'cancel_requested' } : r
            )
        });
        setMsg('✓ Petición de anulación enviada.');
        setTimeout(() => setMsg(''), 3000);
    };

    const updateStatus = (id: string, status: 'approved' | 'rejected') => {
        onUpdate({
            ...data,
            vacationRequests: data.vacationRequests.map(r => r.id === id ? { ...r, status } : r)
        });
    };

    const deleteRequest = (id: string) => {
        if (!window.confirm('¿Estás seguro de que quieres BORRAR este registro definitivamente?')) return;
        onUpdate({
            ...data,
            vacationRequests: data.vacationRequests.filter(r => r.id !== id)
        });
    };

    const changeMonth = (offset: number) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setViewDate(newDate);
    };

    if (role === 'admin') {
        const inbox = (data.vacationRequests || []).filter(r => r.status === 'pending' || r.status === 'cancel_requested');
        const techSummary = visibleTechnicians.map((t) => {
            const reqs = (data.vacationRequests || []).filter(r => r.userName === t.name && r.status === 'approved');
            const used = reqs.reduce((s, r) => s + r.days, 0);
            return { name: t.name, used, color: getTechColor(t.name, data.technicians) };
        });

        return (
            <div className="space-y-6 animate-fade-in pb-10">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-brand-teal dark:text-brand-lime flex items-center gap-2">🌴 Gestión de Personal</h2>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setShowVisibilityConfig(true)}
                            className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 transition-all flex items-center gap-1.5 shadow-sm"
                            title="Ocultar o mostrar técnicos en el cuadrante"
                        >
                            <span>👁️ Visibilidad Técnicos</span>
                            {hiddenCount > 0 && (
                                <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                                    {hiddenCount} oculto{hiddenCount > 1 ? 's' : ''}
                                </span>
                            )}
                        </button>
                        <button onClick={onBack} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white underline">← Volver</button>
                    </div>
                </div>

                {/* Registro Manual y Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white dark:bg-brand-panel p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl">
                        <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-widest">
                            <PlusIcon className="w-4 h-4 text-brand-teal dark:text-brand-lime" /> Registrar Día Manualmente
                        </h3>
                        <form onSubmit={handleRequest} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] text-gray-500 uppercase mb-1 font-bold">Técnico</label>
                                    <select required value={adminSelectedTech} onChange={e => setAdminSelectedTech(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none">
                                        <option value="">Seleccionar técnico...</option>
                                        {sortedTechnicians.map(t => (
                                            <option key={t.id} value={t.name}>
                                                {t.name}{t.hideInVacations ? ' (Oculto en Vacaciones)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-500 uppercase mb-1 font-bold">Tipo de Día</label>
                                    <select value={reqType} onChange={e => setReqType(e.target.value as any)} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none">
                                        <option value="vacation">🌴 Vacaciones</option>
                                        <option value="sick">🤒 Enfermedad</option>
                                        <option value="personal">📋 Asuntos Propios</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-500 uppercase mb-1 font-bold">Desde</label>
                                    <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none dark:[color-scheme:dark]" />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-500 uppercase mb-1 font-bold">Hasta</label>
                                    <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none dark:[color-scheme:dark]" />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-brand-teal hover:bg-teal-600 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                                <PlusIcon className="w-5 h-5" /> CREAR REGISTRO DIRECTO
                            </button>
                            {msg && <p className="text-center text-xs text-brand-teal dark:text-brand-lime font-bold">{msg}</p>}
                        </form>
                    </div>

                    <div className="bg-white dark:bg-brand-panel p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden h-full">
                        <h3 className="text-sm font-bold text-gray-400 dark:text-gray-400 mb-4 uppercase tracking-widest">Resumen Vacacional</h3>
                        <div className="overflow-y-auto max-h-[220px] custom-scrollbar">
                            <table className="w-full text-xs">
                                <thead className="text-gray-500 border-b border-gray-200 dark:border-gray-800">
                                    <tr><th className="text-left pb-2">Técnico</th><th className="text-right pb-2">Usados</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                    {techSummary.map(t => (
                                        <tr key={t.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/20">
                                            <td className="py-2 flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }}></div>
                                                <span className="text-gray-700 dark:text-gray-300 font-bold">{t.name}</span>
                                            </td>
                                            <td className="py-2 text-right font-mono text-brand-teal dark:text-brand-lime">{t.used}/20</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Gestión de Festivos */}
                <div className="bg-white dark:bg-brand-panel p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl">
                    <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-widest">
                        <CalendarIcon className="w-4 h-4 text-brand-teal dark:text-brand-lime" /> Gestión de Festivos Locales
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                        <div className="flex-1">
                            <label className="block text-[10px] text-gray-500 uppercase mb-1 font-bold">Nuevo Festivo</label>
                            <input 
                                type="date" 
                                value={newHoliday} 
                                onChange={e => setNewHoliday(e.target.value)} 
                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none dark:[color-scheme:dark]" 
                            />
                        </div>
                        <div className="flex items-end">
                            <button 
                                onClick={addHoliday} 
                                className="bg-brand-lime hover:bg-lime-500 text-brand-dark font-bold px-6 py-3 rounded-xl transition-all shadow-lg flex items-center gap-2 uppercase text-xs tracking-widest"
                            >
                                <PlusIcon className="w-4 h-4" /> Añadir Festivo
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                        {holidays.map(h => (
                            <div key={h} className="bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-2 rounded-lg flex items-center gap-2 group transition-all hover:border-red-500/50">
                                <span className="text-xs font-mono text-gray-600 dark:text-gray-300">{formatDateToSpanish(h)}</span>
                                <button onClick={() => removeHoliday(h)} className="text-gray-500 hover:text-red-500">
                                    <TrashIcon className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                        {holidays.length === 0 && <p className="text-xs text-gray-500 italic">No hay festivos locales registrados.</p>}
                    </div>
                </div>

                {/* Calendario Admin */}
                <div className="bg-white dark:bg-brand-panel rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <h3 className="font-bold text-gray-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 text-brand-teal" />
                                {viewDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
                            </h3>
                            <div className="flex gap-1">
                                <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"><ChevronLeftIcon className="w-5 h-5"/></button>
                                <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"><ChevronRightIcon className="w-5 h-5"/></button>
                            </div>
                        </div>
                        <div className="flex gap-3 text-[9px] text-gray-500 font-bold uppercase overflow-x-auto">
                            <div className="flex items-center gap-1"><span className="font-black text-gray-700 dark:text-gray-300">V</span> Vac.</div>
                            <div className="flex items-center gap-1"><span className="font-black text-gray-700 dark:text-gray-300">E</span> Enf.</div>
                            <div className="flex items-center gap-1"><span className="font-black text-gray-700 dark:text-gray-300">A</span> A.P.</div>
                        </div>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                    <th className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-left text-[10px] font-black text-gray-500 uppercase border-r border-gray-200 dark:border-gray-700 min-w-[120px]">Técnico</th>
                                    {calendarDays.map(d => (
                                        <th key={d.day} className={`px-1 py-2 text-center min-w-[30px] border-r border-gray-200 dark:border-gray-800/30 ${d.isWeekend || d.isHoliday ? 'bg-gray-100 dark:bg-gray-800/30' : ''}`}>
                                            <p className={`text-[10px] font-bold ${d.isHoliday ? 'text-red-500' : 'text-gray-500'}`}>{d.label}</p>
                                            <p className={`text-xs ${d.isHoliday ? 'text-red-400 font-black' : 'text-gray-600 dark:text-gray-300'}`}>{d.day}</p>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {visibleTechnicians.map((tech) => (
                                    <tr key={tech.name} className="border-b border-gray-200 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20 group">
                                        <td className="sticky left-0 z-20 bg-white dark:bg-brand-panel px-4 py-3 border-r border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: getTechColor(tech.name, data.technicians) }}></div>
                                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{tech.name}</span>
                                            </div>
                                        </td>
                                        {calendarDays.map(d => {
                                            const activeRequest = (data.vacationRequests || []).find(r => 
                                                r.userName === tech.name && 
                                                r.status === 'approved' && 
                                                d.dateStr >= r.startDate && 
                                                d.dateStr <= r.endDate
                                            );

                                            if (!activeRequest) return (
                                                <td key={d.day} className={`p-0 border-r border-gray-200 dark:border-gray-800/30 h-10 relative ${d.isHoliday ? 'bg-red-100 dark:bg-red-900/10' : d.isWeekend ? 'bg-gray-50 dark:bg-gray-800/20' : ''}`}></td>
                                            );

                                            const config = getTypeConfig(activeRequest.type);
                                            const color = getTechColor(tech.name, data.technicians);

                                            return (
                                                <td 
                                                    key={d.day} 
                                                    className={`p-0 border-r border-gray-200 dark:border-gray-800/30 h-10 relative ${d.isHoliday ? 'bg-red-100 dark:bg-red-900/10' : d.isWeekend ? 'bg-gray-50 dark:bg-gray-800/20' : ''}`}
                                                >
                                                    <div 
                                                        className="absolute inset-y-1 left-0 right-0 shadow-sm transition-transform hover:scale-110 z-10 flex items-center justify-center"
                                                        style={{ backgroundColor: color, opacity: 0.9 }}
                                                        title={`${activeRequest.userName}: ${config.label}`}
                                                    >
                                                        <span className="text-[11px] font-black text-white drop-shadow-md select-none">{config.code}</span>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Leyenda de Técnicos (Team Legend) */}
                <div className="bg-white dark:bg-brand-panel p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <UserIcon className="w-4 h-4" /> Código de Colores Equipo
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {visibleTechnicians.map(t => (
                            <div key={t.id} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/40 p-2 rounded-lg border border-gray-200 dark:border-gray-800">
                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getTechColor(t.name, data.technicians) }}></div>
                                <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate">{t.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bandeja de Solicitudes */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Bandeja de Entrada ({inbox.length})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {inbox.map(r => {
                            const config = getTypeConfig(r.type);
                            const color = getTechColor(r.userName, data.technicians);
                            return (
                                <div key={r.id} className={`bg-white dark:bg-brand-panel p-4 rounded-xl border flex justify-between items-center shadow-lg ${r.status === 'cancel_requested' ? 'border-orange-400 dark:border-orange-500' : 'border-gray-200 dark:border-gray-700'}`}>
                                    <div className="flex gap-3">
                                        <div className="w-1.5 rounded-full" style={{ backgroundColor: color }}></div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-gray-900 dark:text-white text-lg">{r.userName}</p>
                                                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{config.icon} {config.label}</span>
                                            </div>
                                            <p className="text-sm text-brand-teal dark:text-brand-teal font-mono">{formatDateToSpanish(r.startDate)} - {formatDateToSpanish(r.endDate)}</p>
                                            {r.status === 'cancel_requested' && <p className="text-[10px] text-orange-500 dark:text-orange-400 font-bold uppercase mt-1">⚠️ Petición de ANULACIÓN</p>}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {r.status === 'cancel_requested' ? (
                                            <>
                                                <button onClick={() => deleteRequest(r.id)} className="p-3 bg-orange-600 hover:bg-orange-500 rounded-xl text-white shadow-lg" title="Aceptar Anulación (Borrar)"><TrashIcon className="w-5 h-5"/></button>
                                                <button onClick={() => updateStatus(r.id, 'approved')} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-white shadow-lg" title="Mantener (Ignorar Anulación)"><XCircleIcon className="w-5 h-5"/></button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => updateStatus(r.id, 'approved')} className="p-3 bg-green-600 hover:bg-green-500 rounded-xl text-white shadow-lg" title="Aprobar"><CheckCircleIcon className="w-5 h-5"/></button>
                                                <button onClick={() => updateStatus(r.id, 'rejected')} className="p-3 bg-red-600 hover:bg-red-500 rounded-xl text-white shadow-lg" title="Rechazar"><XCircleIcon className="w-5 h-5"/></button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // VISTA TÉCNICO
    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex justify-between items-center bg-white dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-brand-teal flex items-center gap-2">🌴 Mis Vacaciones y Ausencias</h2>
                <button onClick={onBack} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white underline">← Volver</button>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-brand-panel p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg text-center">
                    <p className="text-[10px] text-gray-500 uppercase mb-1">Total Año</p>
                    <p className="text-2xl font-black text-gray-800 dark:text-white">{LIMIT_DAYS}</p>
                </div>
                <div className="bg-white dark:bg-brand-panel p-4 rounded-2xl border border-brand-lime shadow-lg text-center">
                    <p className="text-[10px] text-gray-500 uppercase mb-1">Días Usados</p>
                    <p className="text-2xl font-black text-brand-teal dark:text-brand-lime">{usedDays}</p>
                </div>
                <div className="bg-white dark:bg-brand-panel p-4 rounded-2xl border border-orange-500/30 shadow-lg text-center">
                    <p className="text-[10px] text-gray-500 uppercase mb-1">Disponibles</p>
                    <p className={`text-2xl font-black ${LIMIT_DAYS - usedDays <= 0 ? 'text-red-500' : 'text-gray-800 dark:text-white'}`}>{LIMIT_DAYS - usedDays}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                    {/* Formulario Solicitud */}
                    <div className="bg-white dark:bg-brand-panel p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl h-fit">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                            <PlusIcon className="w-5 h-5 text-brand-teal" /> Nueva Solicitud
                        </h3>
                        <form onSubmit={handleRequest} className="space-y-4">
                            <div>
                                <label className="block text-xs text-gray-500 uppercase mb-1">Motivo de la ausencia</label>
                                <select value={reqType} onChange={e => setReqType(e.target.value as any)} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none">
                                    <option value="vacation">🌴 Vacaciones</option>
                                    <option value="sick">🤒 Enfermedad</option>
                                    <option value="personal">📋 Asuntos Propios</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 uppercase mb-1">Inicio</label>
                                    <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none dark:[color-scheme:dark]" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 uppercase mb-1">Fin</label>
                                    <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none dark:[color-scheme:dark]" />
                                </div>
                            </div>
                            {currentBusinessDays > 0 && (
                                <div className="bg-brand-teal/10 p-3 rounded-lg border border-brand-teal/30 flex justify-between items-center">
                                    <span className="text-xs text-brand-teal font-bold uppercase">Días laborables calculados:</span>
                                    <span className="text-lg font-black text-brand-teal">{currentBusinessDays}</span>
                                </div>
                            )}
                            {msg && <p className={`text-xs text-center p-2 rounded ${msg.includes('✓') ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>{msg}</p>}
                            <button type="submit" disabled={currentBusinessDays <= 0} className="w-full bg-brand-teal hover:bg-teal-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                                <CalendarIcon className="w-5 h-5" /> ENVIAR PETICIÓN
                            </button>
                        </form>
                    </div>

                    {/* Calendario de Vacaciones (Solo Visualización) */}
                    <div className="bg-white dark:bg-brand-panel rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <h3 className="font-bold text-gray-800 dark:text-white text-xs uppercase tracking-widest flex items-center gap-2">
                                    <CalendarIcon className="w-4 h-4 text-brand-teal" />
                                    {viewDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
                                </h3>
                                <div className="flex gap-1">
                                    <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"><ChevronLeftIcon className="w-4 h-4"/></button>
                                    <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"><ChevronRightIcon className="w-4 h-4"/></button>
                                </div>
                            </div>
                            <div className="flex gap-2 text-[8px] text-gray-500 font-bold uppercase">
                                <div className="flex items-center gap-0.5"><span className="font-black text-gray-700 dark:text-gray-300">V</span> Vac.</div>
                                <div className="flex items-center gap-0.5"><span className="font-black text-gray-700 dark:text-gray-300">E</span> Enf.</div>
                                <div className="flex items-center gap-0.5"><span className="font-black text-gray-700 dark:text-gray-300">A</span> A.P.</div>
                            </div>
                        </div>

                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                        <th className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 text-left text-[9px] font-black text-gray-500 uppercase border-r border-gray-200 dark:border-gray-700 min-w-[100px]">Técnico</th>
                                        {calendarDays.map(d => (
                                            <th key={d.day} className={`px-0.5 py-1.5 text-center min-w-[24px] border-r border-gray-200 dark:border-gray-800/30 ${d.isWeekend || d.isHoliday ? 'bg-gray-100 dark:bg-gray-800/30' : ''}`}>
                                                <p className={`text-[8px] font-bold ${d.isHoliday ? 'text-red-500' : 'text-gray-500'}`}>{d.label}</p>
                                                <p className={`text-[10px] ${d.isHoliday ? 'text-red-400 font-black' : 'text-gray-600 dark:text-gray-300'}`}>{d.day}</p>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleTechnicians.map((tech) => (
                                        <tr key={tech.name} className="border-b border-gray-200 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20 group">
                                            <td className="sticky left-0 z-20 bg-white dark:bg-brand-panel px-3 py-2 border-r border-gray-200 dark:border-gray-700">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: getTechColor(tech.name, data.technicians) }}></div>
                                                    <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors truncate max-w-[80px]">{tech.name}</span>
                                                </div>
                                            </td>
                                            {calendarDays.map(d => {
                                                const activeRequest = (data.vacationRequests || []).find(r => 
                                                    r.userName === tech.name && 
                                                    r.status === 'approved' && 
                                                    d.dateStr >= r.startDate && 
                                                    d.dateStr <= r.endDate
                                                );

                                                if (!activeRequest) return (
                                                    <td key={d.day} className={`p-0 border-r border-gray-200 dark:border-gray-800/30 h-8 relative ${d.isHoliday ? 'bg-red-100 dark:bg-red-900/10' : d.isWeekend ? 'bg-gray-50 dark:bg-gray-800/20' : ''}`}></td>
                                                );

                                                const config = getTypeConfig(activeRequest.type);
                                                const color = getTechColor(tech.name, data.technicians);

                                                return (
                                                    <td 
                                                        key={d.day} 
                                                        className={`p-0 border-r border-gray-200 dark:border-gray-800/30 h-8 relative ${d.isHoliday ? 'bg-red-100 dark:bg-red-900/10' : d.isWeekend ? 'bg-gray-50 dark:bg-gray-800/20' : ''}`}
                                                    >
                                                        <div 
                                                            className="absolute inset-y-0.5 left-0 right-0 shadow-xs transition-transform hover:scale-110 z-10 flex items-center justify-center"
                                                            style={{ backgroundColor: color, opacity: 0.9 }}
                                                            title={`${activeRequest.userName}: ${config.label}`}
                                                        >
                                                            <span className="text-[9px] font-black text-white drop-shadow-md select-none">{config.code}</span>
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Historial Técnico */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <ClockIcon className="w-4 h-4" /> Historial y Estado
                    </h3>
                    <div className="space-y-3">
                        {userRequests.map(r => {
                            const config = getTypeConfig(r.type);
                            return (
                                <div key={r.id} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 flex justify-between items-center group shadow-sm">
                                    <div className="flex-1 min-w-0 pr-2">
                                        <div className="flex items-center gap-2">
                                            <p className="text-gray-900 dark:text-white font-bold text-sm font-mono truncate">{formatDateToSpanish(r.startDate)} al {formatDateToSpanish(r.endDate)}</p>
                                            <span className="text-[10px] opacity-60">{config.icon}</span>
                                        </div>
                                        <div className="flex gap-2 mt-1 flex-wrap">
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                                r.status === 'approved' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800' :
                                                r.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800' :
                                                r.status === 'cancel_requested' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800' :
                                                'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                                            }`}>
                                                {r.status === 'cancel_requested' ? 'ANULACIÓN PENDIENTE' : r.status.toUpperCase()}
                                            </span>
                                            <span className="text-[9px] text-gray-500 font-bold uppercase">{r.days} días ({config.label})</span>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                        {r.status === 'pending' && (
                                            <button onClick={() => deleteRequest(r.id)} className="text-gray-400 hover:text-red-500 p-2 transition-colors" title="Borrar solicitud">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                        {r.status === 'approved' && (
                                            <button onClick={() => requestCancellation(r.id)} className="text-gray-400 hover:text-orange-500 p-2 transition-colors" title="Solicitar Anulación">
                                                <XCircleIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {userRequests.length === 0 && <p className="text-center py-6 text-gray-400 text-xs italic">No hay solicitudes registradas.</p>}
                    </div>
                </div>
            </div>

            {/* Modal para configurar visibilidad de técnicos en vacaciones */}
            {showVisibilityConfig && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-in">
                        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-3">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                👁️ Visibilidad en Vacaciones
                            </h3>
                            <button onClick={() => setShowVisibilityConfig(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-lg font-bold">✕</button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Los técnicos marcados como <strong>Oculto</strong> no se mostrarán en el cuadrante de vacaciones ni en la leyenda. Este ajuste se guarda y sincroniza para todos los administradores.
                        </p>
                        <div className="max-h-72 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                            {sortedTechnicians.map(t => (
                                <div key={t.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl border border-gray-200 dark:border-gray-700/60">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getTechColor(t.name, data.technicians) }}></div>
                                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{t.name}</span>
                                    </div>
                                    <button
                                        onClick={() => toggleTechVisibility(t.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                            t.hideInVacations 
                                                ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                                                : 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-800'
                                        }`}
                                    >
                                        {t.hideInVacations ? '🙈 Oculto' : '👁️ Visible'}
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="pt-2 text-right">
                            <button
                                onClick={() => setShowVisibilityConfig(false)}
                                className="bg-brand-teal hover:bg-teal-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-colors shadow-md"
                            >
                                Guardar y Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VacationManager;
