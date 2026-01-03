
import React, { useState, useMemo } from 'react';
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

    const holidays = useMemo(() => data.holidays || [], [data.holidays]);

    const calculateBusinessDays = (start: string, end: string) => {
        const d1 = new Date(start);
        const d2 = new Date(end);
        let count = 0;
        const current = new Date(d1);
        while (current <= d2) {
            const dayOfWeek = current.getDay();
            const dateStr = current.toISOString().split('T')[0];
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
            const dateStr = date.toISOString().split('T')[0];
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
            requestDate: new Date().toISOString().split('T')[0]
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
        if (holidays.includes(newHoliday)) return alert('Este festivo ya está registrado.');
        
        onUpdate({
            ...data,
            holidays: [...holidays, newHoliday].sort()
        });
        setNewHoliday('');
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
        const techSummary = data.technicians.map((t) => {
            const reqs = (data.vacationRequests || []).filter(r => r.userName === t.name && r.status === 'approved');
            const used = reqs.reduce((s, r) => s + r.days, 0);
            return { name: t.name, used, color: getTechColor(t.name, data.technicians) };
        });

        return (
            <div className="space-y-6 animate-fade-in pb-10">
                <div className="flex justify-between items-center bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                    <h2 className="text-xl font-bold text-brand-lime flex items-center gap-2">🌴 Gestión de Personal</h2>
                    <button onClick={onBack} className="text-xs text-gray-400 hover:text-white underline">← Volver</button>
                </div>

                {/* Registro Manual y Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-brand-panel p-6 rounded-2xl border border-gray-700 shadow-xl">
                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-widest">
                            <PlusIcon className="w-4 h-4 text-brand-lime" /> Registrar Día Manualmente
                        </h3>
                        <form onSubmit={handleRequest} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] text-gray-500 uppercase mb-1 font-bold">Técnico</label>
                                    <select required value={adminSelectedTech} onChange={e => setAdminSelectedTech(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm text-white focus:border-brand-teal outline-none">
                                        <option value="">Seleccionar técnico...</option>
                                        {data.technicians.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-500 uppercase mb-1 font-bold">Tipo de Día</label>
                                    <select value={reqType} onChange={e => setReqType(e.target.value as any)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm text-white focus:border-brand-teal outline-none">
                                        <option value="vacation">🌴 Vacaciones</option>
                                        <option value="sick">🤒 Enfermedad</option>
                                        <option value="personal">📋 Asuntos Propios</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-500 uppercase mb-1 font-bold">Desde</label>
                                    <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm text-white focus:border-brand-teal outline-none [color-scheme:dark]" />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-500 uppercase mb-1 font-bold">Hasta</label>
                                    <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm text-white focus:border-brand-teal outline-none [color-scheme:dark]" />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-brand-teal hover:bg-teal-600 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                                <PlusIcon className="w-5 h-5" /> CREAR REGISTRO DIRECTO
                            </button>
                            {msg && <p className="text-center text-xs text-brand-lime font-bold">{msg}</p>}
                        </form>
                    </div>

                    <div className="bg-brand-panel p-6 rounded-2xl border border-gray-700 shadow-xl overflow-hidden h-full">
                        <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-widest">Resumen Vacacional</h3>
                        <div className="overflow-y-auto max-h-[220px] custom-scrollbar">
                            <table className="w-full text-xs">
                                <thead className="text-gray-500 border-b border-gray-800">
                                    <tr><th className="text-left pb-2">Técnico</th><th className="text-right pb-2">Usados</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {techSummary.map(t => (
                                        <tr key={t.name} className="hover:bg-gray-800/20">
                                            <td className="py-2 flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }}></div>
                                                <span className="text-gray-300 font-bold">{t.name}</span>
                                            </td>
                                            <td className="py-2 text-right font-mono text-brand-lime">{t.used}/20</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Gestión de Festivos */}
                <div className="bg-brand-panel p-6 rounded-2xl border border-gray-700 shadow-xl">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-widest">
                        <CalendarIcon className="w-4 h-4 text-brand-lime" /> Gestión de Festivos Locales
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                        <div className="flex-1">
                            <label className="block text-[10px] text-gray-500 uppercase mb-1 font-bold">Nuevo Festivo</label>
                            <input 
                                type="date" 
                                value={newHoliday} 
                                onChange={e => setNewHoliday(e.target.value)} 
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm text-white focus:border-brand-teal outline-none [color-scheme:dark]" 
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
                            <div key={h} className="bg-gray-900 border border-gray-700 px-3 py-2 rounded-lg flex items-center gap-2 group transition-all hover:border-red-500/50">
                                <span className="text-xs font-mono text-gray-300">{formatDateToSpanish(h)}</span>
                                <button onClick={() => removeHoliday(h)} className="text-gray-500 hover:text-red-500">
                                    <TrashIcon className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                        {holidays.length === 0 && <p className="text-xs text-gray-500 italic">No hay festivos locales registrados.</p>}
                    </div>
                </div>

                {/* Calendario Admin */}
                <div className="bg-brand-panel rounded-2xl border border-gray-700 shadow-xl overflow-hidden">
                    <div className="p-4 bg-gray-800/50 border-b border-gray-700 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <h3 className="font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 text-brand-teal" />
                                {viewDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
                            </h3>
                            <div className="flex gap-1">
                                <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 transition-colors"><ChevronLeftIcon className="w-5 h-5"/></button>
                                <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 transition-colors"><ChevronRightIcon className="w-5 h-5"/></button>
                            </div>
                        </div>
                        <div className="flex gap-3 text-[9px] text-gray-500 font-bold uppercase overflow-x-auto">
                            <div className="flex items-center gap-1"><span className="font-black text-gray-300">V</span> Vac.</div>
                            <div className="flex items-center gap-1"><span className="font-black text-gray-300">E</span> Enf.</div>
                            <div className="flex items-center gap-1"><span className="font-black text-gray-300">A</span> A.P.</div>
                        </div>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-900/50 border-b border-gray-700">
                                    <th className="sticky left-0 z-20 bg-gray-900 px-4 py-2 text-left text-[10px] font-black text-gray-500 uppercase border-r border-gray-700 min-w-[120px]">Técnico</th>
                                    {calendarDays.map(d => (
                                        <th key={d.day} className={`px-1 py-2 text-center min-w-[30px] border-r border-gray-800/30 ${d.isWeekend || d.isHoliday ? 'bg-gray-800/30' : ''}`}>
                                            <p className={`text-[10px] font-bold ${d.isHoliday ? 'text-red-500' : 'text-gray-500'}`}>{d.label}</p>
                                            <p className={`text-xs ${d.isHoliday ? 'text-red-400 font-black' : 'text-gray-300'}`}>{d.day}</p>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.technicians.map((tech) => (
                                    <tr key={tech.name} className="border-b border-gray-800/50 hover:bg-gray-800/20 group">
                                        <td className="sticky left-0 z-20 bg-brand-panel px-4 py-3 border-r border-gray-700">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: getTechColor(tech.name, data.technicians) }}></div>
                                                <span className="text-xs font-bold text-gray-300 group-hover:text-white transition-colors">{tech.name}</span>
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
                                                <td key={d.day} className={`p-0 border-r border-gray-800/30 h-10 relative ${d.isHoliday ? 'bg-red-900/10' : d.isWeekend ? 'bg-gray-800/20' : ''}`}></td>
                                            );

                                            const config = getTypeConfig(activeRequest.type);
                                            const color = getTechColor(tech.name, data.technicians);

                                            return (
                                                <td 
                                                    key={d.day} 
                                                    className={`p-0 border-r border-gray-800/30 h-10 relative ${d.isHoliday ? 'bg-red-900/10' : d.isWeekend ? 'bg-gray-800/20' : ''}`}
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
                <div className="bg-brand-panel p-5 rounded-xl border border-gray-700 shadow-lg">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <UserIcon className="w-4 h-4" /> Código de Colores Equipo
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {data.technicians.map(t => (
                            <div key={t.id} className="flex items-center gap-2 bg-gray-900/40 p-2 rounded-lg border border-gray-800">
                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getTechColor(t.name, data.technicians) }}></div>
                                <span className="text-[10px] font-bold text-gray-300 truncate">{t.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bandeja de Solicitudes */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Bandeja de Entrada ({inbox.length})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {inbox.map(r => {
                            const config = getTypeConfig(r.type);
                            const color = getTechColor(r.userName, data.technicians);
                            return (
                                <div key={r.id} className={`bg-brand-panel p-4 rounded-xl border flex justify-between items-center shadow-lg ${r.status === 'cancel_requested' ? 'border-orange-500' : 'border-gray-700'}`}>
                                    <div className="flex gap-3">
                                        <div className="w-1.5 rounded-full" style={{ backgroundColor: color }}></div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-white text-lg">{r.userName}</p>
                                                <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">{config.icon} {config.label}</span>
                                            </div>
                                            <p className="text-sm text-brand-teal font-mono">{formatDateToSpanish(r.startDate)} - {formatDateToSpanish(r.endDate)}</p>
                                            {r.status === 'cancel_requested' && <p className="text-[10px] text-orange-400 font-bold uppercase mt-1">⚠️ Petición de ANULACIÓN</p>}
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
            <div className="flex justify-between items-center bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                <h2 className="text-xl font-bold text-brand-teal flex items-center gap-2">🌴 Mis Vacaciones y Ausencias</h2>
                <button onClick={onBack} className="text-xs text-gray-400 hover:text-white underline">← Volver</button>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="bg-brand-panel p-4 rounded-2xl border border-gray-700 shadow-lg text-center">
                    <p className="text-[10px] text-gray-500 uppercase mb-1">Total Año</p>
                    <p className="text-2xl font-black text-white">{LIMIT_DAYS}</p>
                </div>
                <div className="bg-brand-panel p-4 rounded-2xl border border-brand-lime/30 shadow-lg text-center">
                    <p className="text-[10px] text-gray-500 uppercase mb-1">Días Usados</p>
                    <p className="text-2xl font-black text-brand-lime">{usedDays}</p>
                </div>
                <div className="bg-brand-panel p-4 rounded-2xl border border-orange-500/30 shadow-lg text-center">
                    <p className="text-[10px] text-gray-500 uppercase mb-1">Disponibles</p>
                    <p className={`text-2xl font-black ${LIMIT_DAYS - usedDays <= 0 ? 'text-red-500' : 'text-white'}`}>{LIMIT_DAYS - usedDays}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Formulario Solicitud */}
                <div className="bg-brand-panel p-6 rounded-2xl border border-gray-700 shadow-xl h-fit">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <PlusIcon className="w-5 h-5 text-brand-teal" /> Nueva Solicitud
                    </h3>
                    <form onSubmit={handleRequest} className="space-y-4">
                        <div>
                            <label className="block text-xs text-gray-500 uppercase mb-1">Motivo de la ausencia</label>
                            <select value={reqType} onChange={e => setReqType(e.target.value as any)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm text-white focus:border-brand-teal outline-none">
                                <option value="vacation">🌴 Vacaciones</option>
                                <option value="sick">🤒 Enfermedad</option>
                                <option value="personal">📋 Asuntos Propios</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-500 uppercase mb-1">Inicio</label>
                                <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm text-white focus:border-brand-teal outline-none [color-scheme:dark]" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 uppercase mb-1">Fin</label>
                                <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm text-white focus:border-brand-teal outline-none [color-scheme:dark]" />
                            </div>
                        </div>
                        {currentBusinessDays > 0 && (
                            <div className="bg-brand-teal/10 p-3 rounded-lg border border-brand-teal/30 flex justify-between items-center">
                                <span className="text-xs text-brand-teal font-bold uppercase">Días laborables calculados:</span>
                                <span className="text-lg font-black text-brand-teal">{currentBusinessDays}</span>
                            </div>
                        )}
                        {msg && <p className={`text-xs text-center p-2 rounded ${msg.includes('✓') ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>{msg}</p>}
                        <button type="submit" disabled={currentBusinessDays <= 0} className="w-full bg-brand-teal hover:bg-teal-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                            <CalendarIcon className="w-5 h-5" /> ENVIAR PETICIÓN
                        </button>
                    </form>
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
                                <div key={r.id} className="bg-gray-900/50 p-4 rounded-xl border border-gray-800 flex justify-between items-center group shadow-sm">
                                    <div className="flex-1 min-w-0 pr-2">
                                        <div className="flex items-center gap-2">
                                            <p className="text-white font-bold text-sm font-mono truncate">{formatDateToSpanish(r.startDate)} al {formatDateToSpanish(r.endDate)}</p>
                                            <span className="text-[10px] opacity-60">{config.icon}</span>
                                        </div>
                                        <div className="flex gap-2 mt-1 flex-wrap">
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                                r.status === 'approved' ? 'bg-green-900/30 text-green-400 border-green-800' :
                                                r.status === 'rejected' ? 'bg-red-900/30 text-red-400 border-red-800' :
                                                r.status === 'cancel_requested' ? 'bg-orange-900/30 text-orange-400 border-orange-800' :
                                                'bg-blue-900/30 text-blue-400 border-blue-800'
                                            }`}>
                                                {r.status === 'cancel_requested' ? 'ANULACIÓN PENDIENTE' : r.status.toUpperCase()}
                                            </span>
                                            <span className="text-[9px] text-gray-600 font-bold uppercase">{r.days} días ({config.label})</span>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                        {r.status === 'pending' && (
                                            <button onClick={() => deleteRequest(r.id)} className="text-gray-700 hover:text-red-500 transition-colors p-2" title="Eliminar solicitud pendiente">
                                                <TrashIcon className="w-4 h-4"/>
                                            </button>
                                        )}
                                        {r.status === 'approved' && (
                                            <button onClick={() => requestCancellation(r.id)} className="text-xs bg-orange-900/20 hover:bg-orange-900/40 text-orange-500 border border-orange-900 px-3 py-1 rounded-lg font-bold transition-all" title="Solicitar cambio/borrado">
                                                SOLICITAR ANULACIÓN
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {userRequests.length === 0 && <p className="text-center py-10 text-gray-700 border border-dashed border-gray-800 rounded-xl italic text-sm">No hay registros.</p>}
                    </div>
                </div>
            </div>
            
            <div className="bg-blue-900/10 p-4 rounded-xl border border-blue-900/30 flex gap-3">
                <AlertIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <p className="text-xs text-gray-400 leading-relaxed">
                    Si necesitas cambiar días ya aprobados (en verde), pulsa el botón <b>"SOLICITAR ANULACIÓN"</b>. El administrador recibirá tu petición y procederá a borrar los días para que puedas pedirlos de nuevo.
                </p>
            </div>
        </div>
    );
};

export default VacationManager;
