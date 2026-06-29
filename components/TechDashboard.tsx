
import React, { useState, useMemo } from 'react';
import { WorkReport, ProjectData } from '../App';
import { PlusIcon, SearchIcon, EditIcon, TrashIcon, FileTextIcon, CalendarIcon, ClockIcon, ChartPieIcon, ChevronDownIcon, EyeIcon } from './icons';

interface TechDashboardProps {
  reports: WorkReport[];
  projects: ProjectData[];
  onNewReport: () => void;
  onEditReport: (report: WorkReport) => void;
  onViewDailyOrg: () => void;
  onDeleteReport: (id: string) => void;
  hasUnreadOrg?: boolean;
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
    const day = d.getDay(); 
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

const TechDashboard: React.FC<TechDashboardProps> = ({ reports, projects, onNewReport, onEditReport, onViewDailyOrg, onDeleteReport, hasUnreadOrg }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  const resolveProjectFullName = (num: string) => {
    const found = projects.find(p => p.id === num);
    return found ? found.name : num;
  };

  // Cálculos para las tarjetas
  const now = new Date();
  
  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff)).setHours(0,0,0,0);
  };
  const startOfCurrentWeek = getStartOfWeek(now);

  const stats = useMemo(() => {
    let currentWeekExpenses = 0;

    reports.forEach(r => {
        const rDate = new Date(r.date);
        // Gasto semana actual
        if (rDate.getTime() >= startOfCurrentWeek) {
            currentWeekExpenses += r.expenses.food + r.expenses.gas + r.expenses.parking + r.expenses.others;
        }
    });

    return { currentWeekExpenses };
  }, [reports, startOfCurrentWeek]);

  // Agrupación por SEMANAS (Para gastos y horas normales)
  const summariesByWeek = useMemo(() => {
    const groups: Record<string, { label: string, timestamp: number, regHours: number, otNorm: number, otNoct: number, otFinde: number, totalExpenses: number }> = {};
    reports.forEach(r => {
        const d = new Date(r.date);
        const day = d.getDay(); 
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
        const monday = new Date(d);
        monday.setDate(diff);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        const formatDate = (date: Date) => date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
        const label = `${formatDate(monday)} - ${formatDate(sunday)}`;
        const key = monday.toISOString().split('T')[0]; // YYYY-MM-DD

        if (!groups[key]) groups[key] = { label, timestamp: monday.getTime(), regHours: 0, otNorm: 0, otNoct: 0, otFinde: 0, totalExpenses: 0 };
        groups[key].regHours += calculateDuration(r.startTime, r.endTime);
        const ot = r.overtimeHours || 0;
        if (r.overtimeType === 'NORMAL') groups[key].otNorm += ot;
        else if (r.overtimeType === 'NOCTURNA') groups[key].otNoct += ot;
        else if (r.overtimeType === 'FINDE SEMANA') groups[key].otFinde += ot;
        
        groups[key].totalExpenses += r.expenses.food + r.expenses.gas + r.expenses.parking + r.expenses.others;
    });
    return Object.values(groups).sort((a, b) => b.timestamp - a.timestamp);
  }, [reports]);

  // Agrupación por MESES (Para historial de horas extra)
  const summariesByMonth = useMemo(() => {
      const groups: Record<string, { label: string, total: number, norm: number, noct: number, finde: number, allValidated: boolean }> = {};
      
      reports.forEach(r => {
          if (!r.overtimeHours || r.overtimeHours === 0) return;

          const date = new Date(r.date);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM para ordenar
          const label = getMonthYearLabel(r.date);

          if (!groups[key]) groups[key] = { label, total: 0, norm: 0, noct: 0, finde: 0, allValidated: true };

          const ot = r.overtimeHours;
          groups[key].total += ot;
          
          if (r.overtimeStatus !== 'validated') groups[key].allValidated = false;

          if (r.overtimeType === 'NORMAL') groups[key].norm += ot;
          else if (r.overtimeType === 'NOCTURNA') groups[key].noct += ot;
          else if (r.overtimeType === 'FINDE SEMANA') groups[key].finde += ot;
      });

      return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchesTerm = 
        r.projectNum.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDate = searchDate ? r.date === searchDate : true;
      return matchesTerm && matchesDate;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [reports, searchTerm, searchDate]);

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

  return (
    <div className="space-y-6 animate-fade-in pb-20 max-w-4xl mx-auto">
      {/* Botones Superiores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button onClick={onNewReport} className="bg-brand-teal hover:bg-teal-600 text-white p-8 rounded-2xl shadow-lg transform transition active:scale-95 flex flex-col items-center justify-center gap-3 border border-teal-400/20">
            <PlusIcon className="w-10 h-10 text-brand-lime" />
            <span className="text-xl font-bold">Nuevo Parte de Trabajo</span>
        </button>
        <button onClick={onViewDailyOrg} className="relative bg-white dark:bg-brand-panel hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-white p-8 rounded-2xl shadow-lg transform transition active:scale-95 flex flex-col items-center justify-center gap-3 border border-gray-200 dark:border-gray-700">
            {hasUnreadOrg && (
                <span className="absolute top-4 right-4 w-4 h-4 bg-red-600 rounded-full border-2 border-white dark:border-brand-panel animate-pulse shadow-md"></span>
            )}
            <CalendarIcon className="w-10 h-10 text-brand-teal dark:text-brand-lime" />
            <span className="text-xl font-bold">Ver Organización Diaria</span>
        </button>
      </div>

      {/* Tarjetas de Estadísticas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tarjeta Gasto Semanal */}
        <div className="bg-white dark:bg-brand-panel border border-gray-200 dark:border-gray-700 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
            <div className="flex items-center gap-2 mb-2">
                <CalendarIcon className="w-5 h-5 text-brand-teal dark:text-brand-lime" />
                <h4 className="text-[10px] font-black text-brand-teal dark:text-brand-lime uppercase tracking-widest">Mi Gasto Semanal</h4>
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-gray-900 dark:text-white">{stats.currentWeekExpenses.toFixed(2)}</span>
                <span className="text-3xl font-black text-gray-900 dark:text-white">€</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-2 font-medium">Lunes a Domingo (Semana actual).</p>
            <CalendarIcon className="absolute -right-4 -bottom-4 w-24 h-24 text-gray-200 dark:text-gray-800/20 pointer-events-none group-hover:scale-110 transition-transform" />
        </div>

        {/* Tarjeta Historial Horas Extra Mensuales (Lista Scroll) */}
        <div className="bg-white dark:bg-brand-panel border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-lg">
            <h4 className="text-[11px] font-black text-yellow-600 dark:text-yellow-500 flex items-center gap-2 mb-5 uppercase tracking-widest">
                <ClockIcon className="w-4 h-4" /> Historial Horas Extra
            </h4>
            <div className="space-y-3 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                {summariesByMonth.map(([key, data]) => (
                    <div key={`ot-${key}`} className="bg-gray-50 dark:bg-gray-950/80 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 group hover:border-yellow-500/50 transition-all">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-gray-600 dark:text-gray-300 font-black uppercase">{data.label}</span>
                            <span className={`text-lg font-black ${data.allValidated ? 'text-green-500' : 'text-yellow-600 dark:text-yellow-500'}`}>{data.total}h</span>
                        </div>
                        <div className="flex justify-between text-[9px] text-gray-400 font-mono uppercase">
                            <span>Norm: <b className="text-gray-600 dark:text-gray-400">{data.norm}</b></span>
                            <span>Noc: <b className="text-gray-600 dark:text-gray-400">{data.noct}</b></span>
                            <span>Fin: <b className="text-gray-600 dark:text-gray-400">{data.finde}</b></span>
                        </div>
                    </div>
                ))}
                {summariesByMonth.length === 0 && <p className="text-center text-xs text-gray-400 py-4 italic">Sin horas extra registradas.</p>}
            </div>
        </div>
      </div>

      {/* Tablas de Control Detallado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Control Horario */}
        <div className="bg-white dark:bg-brand-panel border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-lg">
            <h4 className="text-[11px] font-black text-brand-teal flex items-center gap-2 mb-5 uppercase tracking-widest">
                <ClockIcon className="w-4 h-4" /> Control Horario por Semanas
            </h4>
            <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="w-full text-left">
                    <thead className="bg-gray-100 dark:bg-gray-950 text-brand-teal dark:text-brand-lime uppercase text-[9px] font-black">
                        <tr>
                            <th className="px-3 py-3">Semana</th>
                            <th className="px-2 py-3 text-center">Norm.</th>
                            <th className="px-2 py-3 text-center">Ext.</th>
                            <th className="px-2 py-3 text-center">Noct.</th>
                            <th className="px-2 py-3 text-center">Finde</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900/30">
                        {summariesByWeek.map((data) => (
                            <tr key={`hours-${data.timestamp}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                                <td className="px-3 py-3 text-[10px] font-mono text-gray-500 dark:text-gray-400">{data.label}</td>
                                <td className="px-2 py-3 text-center text-xs text-gray-900 dark:text-white font-bold">{data.regHours.toFixed(1)}h</td>
                                <td className="px-2 py-3 text-center text-xs text-yellow-600 dark:text-yellow-500">{data.otNorm > 0 ? `${data.otNorm}h` : '-'}</td>
                                <td className="px-2 py-3 text-center text-xs text-brand-teal">{data.otNoct > 0 ? `${data.otNoct}h` : '-'}</td>
                                <td className="px-2 py-3 text-center text-xs text-orange-500">{data.otFinde > 0 ? `${data.otFinde}h` : '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Gastos Semanales */}
        <div className="bg-white dark:bg-brand-panel border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-lg">
            <h4 className="text-[11px] font-black text-brand-teal dark:text-brand-lime flex items-center gap-2 mb-5 uppercase tracking-widest">
                <ChartPieIcon className="w-4 h-4" /> Gastos Semanales
            </h4>
            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                {summariesByWeek.map((data) => (
                    <div key={`exp-${data.timestamp}`} className="flex justify-between items-center bg-gray-50 dark:bg-gray-950/80 px-4 py-4 rounded-xl border border-gray-200 dark:border-gray-800 group hover:border-brand-teal dark:hover:border-brand-lime/30 transition-all">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white dark:bg-gray-800 rounded-lg text-gray-400 dark:text-gray-500 group-hover:text-brand-teal dark:group-hover:text-brand-lime border border-gray-100 dark:border-gray-700">
                                <CalendarIcon className="w-4 h-4" />
                            </div>
                            <span className="text-xs text-gray-600 dark:text-gray-300 font-bold font-mono">{data.label}</span>
                        </div>
                        <span className="text-sm font-black text-brand-teal dark:text-brand-lime">{data.totalExpenses.toFixed(2)} €</span>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Buscador y Filtro Fecha */}
      <div className="bg-white dark:bg-brand-panel p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
        <div className="relative">
            <input 
                type="text" 
                placeholder="Buscar por nº obra o descripción..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full bg-gray-50 dark:bg-gray-900/80 border border-gray-300 dark:border-gray-700 rounded-2xl pl-12 pr-4 py-4 text-gray-900 dark:text-white outline-none focus:border-brand-teal transition-all placeholder-gray-400 dark:placeholder-gray-600" 
            />
            <div className="absolute left-4 top-4.5 text-gray-400 dark:text-gray-500"><SearchIcon className="w-6 h-6" /></div>
        </div>
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/80 border border-gray-300 dark:border-gray-700 rounded-2xl px-4 py-3">
            <span className="text-[10px] text-gray-500 font-bold uppercase whitespace-nowrap">Filtrar Fecha:</span>
            <input 
                type="date" 
                value={searchDate} 
                onChange={(e) => setSearchDate(e.target.value)} 
                className="w-full bg-transparent border-none text-gray-900 dark:text-white outline-none text-sm font-mono dark:[color-scheme:dark]" 
            />
        </div>
      </div>

      {/* Historial Detallado */}
      <div className="space-y-6 pt-4">
        <h3 className="text-gray-400 font-black mb-3 uppercase text-[11px] tracking-[3px] flex items-center gap-2">
            <FileTextIcon className="w-4 h-4" /> Historial de Partes
        </h3>
        {Object.entries(groupedReports).map(([monthLabel, weeks]) => {
            const isExpanded = !!expandedMonths[monthLabel];
            return (
                <div key={monthLabel} className="space-y-4">
                    <button 
                        onClick={() => setExpandedMonths(prev => ({ ...prev, [monthLabel]: !isExpanded }))}
                        className="w-full flex items-center justify-between bg-gray-100 dark:bg-gray-800/30 border-l-4 border-brand-teal px-4 py-3 rounded-r-xl hover:bg-gray-200 dark:hover:bg-gray-800/50 transition-colors group"
                    >
                        <h4 className="text-brand-teal font-black text-xs uppercase tracking-widest">{monthLabel}</h4>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tighter">
                                {Object.values(weeks).flat().length} partes
                            </span>
                            <ChevronDownIcon className={`w-4 h-4 text-brand-teal transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                    </button>
                    
                    {isExpanded && (
                        <div className="space-y-6 animate-fade-in">
                            {Object.entries(weeks).sort((a, b) => b[1][0].date.localeCompare(a[1][0].date)).map(([weekRange, reportsInWeek]) => (
                                <div key={weekRange} className="space-y-3 ml-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800"></div>
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{weekRange}</span>
                                        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800"></div>
                                    </div>
                                    {reportsInWeek.map(report => (
                                        <div key={report.id} className="bg-white dark:bg-brand-panel p-5 rounded-3xl border border-gray-200 dark:border-gray-800 flex justify-between items-center group shadow-md hover:border-brand-teal/30 dark:hover:border-gray-700 transition-all">
                                            <div className="flex-1 min-w-0 pr-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-gray-900 dark:text-gray-100 text-sm">{formatDateToSpanish(report.date)}</span>
                                                    <span className="text-[10px] text-gray-500 dark:text-gray-600 font-mono">#{report.id.slice(-4)}</span>
                                                    {report.isNightShift && (
                                                        <span className="px-1.5 py-0.5 text-[8px] bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 font-black rounded uppercase tracking-wider border border-indigo-200/30 dark:border-indigo-900/30">
                                                            NOCHE
                                                        </span>
                                                    )}
                                                    {report.isOvernight && (
                                                        <span className="px-1.5 py-0.5 text-[8px] bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 font-black rounded uppercase tracking-wider border border-purple-200/30 dark:border-purple-900/30">
                                                            PERNOCTA
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-brand-teal dark:text-brand-lime mt-1 font-black truncate uppercase tracking-wider">{resolveProjectFullName(report.projectNum)}</div>
                                                <div className="text-xs text-gray-600 dark:text-gray-500 mt-1.5 italic truncate line-clamp-1">"{report.description || 'Sin descripción'}"</div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <button onClick={() => onEditReport(report)} className="p-3 bg-gray-50 dark:bg-gray-900 hover:bg-brand-teal rounded-2xl text-brand-teal hover:text-white transition-all border border-gray-200 dark:border-gray-800"><EditIcon className="w-5 h-5" /></button>
                                                <button onClick={() => onDeleteReport(report.id)} className="p-3 bg-gray-50 dark:bg-gray-900 hover:bg-red-600 rounded-2xl text-red-500/60 dark:text-red-500/40 hover:text-white transition-all border border-gray-200 dark:border-gray-800"><TrashIcon className="w-5 h-5" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        })}
        {reports.length === 0 && (
            <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/20 rounded-3xl border border-dashed border-gray-300 dark:border-gray-800">
                <FileTextIcon className="w-12 h-12 text-gray-300 dark:text-gray-800 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-600 font-bold uppercase text-[10px] tracking-widest">No hay actividad registrada</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default TechDashboard;
