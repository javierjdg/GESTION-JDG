
import React, { useState, useMemo } from 'react';
import { WorkReport } from '../App';
import { PlusIcon, SearchIcon, EditIcon, FileTextIcon, CalendarIcon, ClockIcon, ChartPieIcon } from './icons';

interface TechDashboardProps {
  reports: WorkReport[];
  projects: string[];
  onNewReport: () => void;
  onEditReport: (report: WorkReport) => void;
  onViewDailyOrg: () => void;
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

const TechDashboard: React.FC<TechDashboardProps> = ({ reports, projects, onNewReport, onEditReport, onViewDailyOrg }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDate, setSearchDate] = useState('');

  // Helper para resolver el nombre completo de una obra
  const resolveProjectFullName = (num: string) => {
    return projects.find(p => p.startsWith(num)) || num;
  };

  // 1. Filter reports based on search inputs
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

  // 2. Group Filtered Reports by Month and then by Week
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

  // Calculations for Summary View (Hours and Expenses by Week)
  const summariesByWeek = useMemo(() => {
    const groups: Record<string, { regHours: number, otNormal: number, otNight: number, otWeekend: number, totalExpenses: number }> = {};
    
    reports.forEach(r => {
        const week = getWeekRange(r.date);
        if (!groups[week]) {
            groups[week] = { regHours: 0, otNormal: 0, otNight: 0, otWeekend: 0, totalExpenses: 0 };
        }
        
        // Hours
        groups[week].regHours += calculateDuration(r.startTime, r.endTime);
        const ot = r.overtimeHours || 0;
        const type = r.overtimeType || 'NORMAL';
        if (type === 'NORMAL') groups[week].otNormal += ot;
        else if (type === 'NOCTURNA') groups[week].otNight += ot;
        else if (type === 'FINDE SEMANA') groups[week].otWeekend += ot;
        
        // Expenses
        groups[week].totalExpenses += r.expenses.food + r.expenses.gas + r.expenses.parking + r.expenses.others;
    });
    
    // Convert to array and sort by week (descending)
    return Object.entries(groups).sort((a, b) => {
        return b[0].localeCompare(a[0]);
    });
  }, [reports]);

  // Calculate CURRENT WEEK expenses
  const currentWeekExpenses = useMemo(() => {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
      const monday = new Date(now);
      monday.setDate(diff);
      monday.setHours(0,0,0,0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23,59,59,999);

      return reports.reduce((total, r) => {
          const reportDate = new Date(r.date);
          if (reportDate >= monday && reportDate <= sunday) {
             return total + r.expenses.food + r.expenses.gas + r.expenses.parking + r.expenses.others;
          }
          return total;
      }, 0);
  }, [reports]);

  // Calculate CURRENT MONTH Overtime Hours
  const currentMonthOT = useMemo(() => {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    return reports.reduce((acc, r) => {
        const rDate = new Date(r.date);
        if (rDate.getMonth() === curMonth && rDate.getFullYear() === curYear) {
            const h = r.overtimeHours || 0;
            const type = r.overtimeType || 'NORMAL';
            acc.total += h;
            if (type === 'NORMAL') acc.normal += h;
            else if (type === 'NOCTURNA') acc.night += h;
            else if (type === 'FINDE SEMANA') acc.weekend += h;
        }
        return acc;
    }, { total: 0, normal: 0, night: 0, weekend: 0 });
  }, [reports]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Top Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
            onClick={onNewReport}
            className="w-full bg-gradient-to-r from-brand-teal to-teal-600 hover:from-teal-500 hover:to-teal-400 text-white p-6 rounded-2xl shadow-lg transform transition active:scale-95 flex flex-col items-center justify-center gap-3 border border-teal-500/30"
        >
            <PlusIcon className="w-10 h-10 text-brand-lime" />
            <span className="text-lg font-bold">Nuevo Parte de Trabajo</span>
        </button>

        <button
            onClick={onViewDailyOrg}
            className="w-full bg-brand-panel hover:bg-gray-800 text-white p-6 rounded-2xl shadow-lg transform transition active:scale-95 flex flex-col items-center justify-center gap-3 border border-gray-600 hover:border-brand-lime"
        >
            <CalendarIcon className="w-10 h-10 text-brand-lime" />
            <span className="text-lg font-bold">Ver Organización Diaria</span>
        </button>
      </div>

      {/* Stats Cards Row (Matches user screenshot) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* MI GASTO SEMANAL */}
        <div className="bg-brand-panel p-5 rounded-2xl border border-brand-lime/30 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <CalendarIcon className="w-24 h-24 text-brand-lime" />
            </div>
            <h3 className="text-brand-lime font-medium mb-1 uppercase text-xs tracking-wider flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" /> MI GASTO SEMANAL
            </h3>
            <div className="text-4xl font-bold text-white mb-2">
                {currentWeekExpenses.toFixed(2)} €
            </div>
            <p className="text-xs text-gray-500">Lunes a Domingo (Semana actual).</p>
        </div>

        {/* HORAS EXTRA MES */}
        <div className="bg-brand-panel p-5 rounded-2xl border border-yellow-500/30 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <ClockIcon className="w-24 h-24 text-yellow-500" />
            </div>
            <h3 className="text-yellow-500 font-medium mb-1 uppercase text-xs tracking-wider flex items-center gap-2">
                <ClockIcon className="w-4 h-4" /> HORAS EXTRA MES
            </h3>
            <div className="text-4xl font-bold text-white mb-2">
                {currentMonthOT.total} h
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 border-t border-gray-700 pt-3">
                <div className="text-center">
                    <p className="text-[10px] text-gray-500 uppercase">NORM.</p>
                    <p className="text-xs font-bold text-gray-200">{currentMonthOT.normal}h</p>
                </div>
                <div className="text-center border-x border-gray-800 px-1">
                    <p className="text-[10px] text-gray-500 uppercase">NOCT.</p>
                    <p className="text-xs font-bold text-gray-200">{currentMonthOT.night}h</p>
                </div>
                <div className="text-center">
                    <p className="text-[10px] text-gray-500 uppercase">FINDE</p>
                    <p className="text-xs font-bold text-gray-200">{currentMonthOT.weekend}h</p>
                </div>
            </div>
        </div>
      </div>

      {/* Summary Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Hours Table */}
        <div className="bg-brand-panel border border-gray-700 rounded-2xl p-5 shadow-lg">
            <h4 className="text-sm font-bold text-brand-teal flex items-center gap-2 mb-4 uppercase tracking-wider">
                <ClockIcon className="w-4 h-4" /> Control Horario por Semanas
            </h4>
            <div className="overflow-x-auto rounded-lg border border-gray-800">
                <table className="w-full text-left text-xs">
                    <thead className="bg-gray-900 text-brand-lime uppercase text-[9px]">
                        <tr>
                            <th className="px-3 py-3">Semana</th>
                            <th className="px-3 py-3 text-right">Norm.</th>
                            <th className="px-3 py-3 text-right">Ext.</th>
                            <th className="px-3 py-3 text-right">Noct.</th>
                            <th className="px-3 py-3 text-right">Finde</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {summariesByWeek.map(([week, data]) => (
                            <tr key={`hours-${week}`} className="hover:bg-gray-800/40 transition-colors">
                                <td className="px-3 py-3 font-mono text-[10px] text-gray-300">{week}</td>
                                <td className="px-3 py-3 text-right font-mono text-white">{data.regHours.toFixed(1)}h</td>
                                <td className="px-3 py-3 text-right font-mono text-yellow-400">{(data.otNormal + data.otNight + data.otWeekend) > 0 ? `+${(data.otNormal + data.otNight + data.otWeekend)}h` : '-'}</td>
                                <td className="px-3 py-3 text-right text-gray-500">{data.otNight > 0 ? `${data.otNight}h` : '-'}</td>
                                <td className="px-3 py-3 text-right text-gray-500">{data.otWeekend > 0 ? `${data.otWeekend}h` : '-'}</td>
                            </tr>
                        ))}
                        {summariesByWeek.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-gray-600 italic">Sin datos registrados</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Weekly Expenses Summary */}
        <div className="bg-brand-panel border border-gray-700 rounded-2xl p-5 shadow-lg">
            <h4 className="text-sm font-bold text-brand-lime flex items-center gap-2 mb-4 uppercase tracking-wider">
                <ChartPieIcon className="w-4 h-4" /> Gastos Semanales
            </h4>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {summariesByWeek.map(([week, data]) => (
                    <div key={`exp-${week}`} className="flex justify-between items-center bg-gray-900/50 px-4 py-3 rounded-xl border border-gray-800 hover:border-brand-lime/30 transition-all">
                        <div className="flex items-center gap-3">
                            <CalendarIcon className="w-4 h-4 text-gray-500" />
                            <span className="text-xs text-gray-300 font-mono">{week}</span>
                        </div>
                        <span className="text-sm font-black text-brand-lime">{data.totalExpenses.toFixed(2)} €</span>
                    </div>
                ))}
                {summariesByWeek.length === 0 && (
                    <div className="p-8 text-center text-gray-600 border border-dashed border-gray-800 rounded-xl">No hay gastos registrados todavía.</div>
                )}
            </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 space-y-3">
        <div className="relative">
            <input 
                type="text" 
                placeholder="Buscar por nº obra o descripción..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-brand-teal outline-none placeholder-gray-500"
            />
            <div className="absolute left-3 top-3.5 text-gray-400">
                <SearchIcon className="w-5 h-5" />
            </div>
        </div>
        <div className="flex gap-2 items-center">
            <span className="text-xs text-gray-500 whitespace-nowrap">Filtrar Fecha:</span>
            <input 
                type="date" 
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-teal outline-none text-sm"
            />
            {searchDate && (
                <button onClick={() => setSearchDate('')} className="text-xs text-brand-lime underline">Borrar</button>
            )}
        </div>
      </div>

      {/* Grouped Results List */}
      <div className="space-y-8">
        <h3 className="text-gray-400 font-medium mb-3 uppercase text-sm tracking-wider flex items-center gap-2">
          <FileTextIcon className="w-4 h-4 text-brand-lime" /> Historial de Partes
        </h3>

        {Object.entries(groupedReports).map(([monthLabel, weeks]) => (
            <div key={monthLabel} className="space-y-4">
                <div className="bg-brand-panel border-l-4 border-brand-teal px-4 py-2 flex items-center gap-3 rounded-r-lg shadow-sm">
                    <h4 className="text-brand-teal font-black text-sm tracking-widest">{monthLabel}</h4>
                </div>
                
                {Object.entries(weeks).sort((a, b) => {
                    return b[1][0].date.localeCompare(a[1][0].date);
                }).map(([weekRange, reportsInWeek]) => (
                    <div key={weekRange} className="space-y-2 ml-2">
                        <div className="flex items-center gap-2 text-brand-lime font-bold text-[11px] px-2 py-1 bg-gray-900/40 rounded border border-gray-800/50 w-fit">
                            <CalendarIcon className="w-3 h-3" />
                            SEMANA: {weekRange}
                        </div>

                        <div className="space-y-3">
                            {reportsInWeek.map(report => (
                                <div key={report.id} className="bg-brand-panel p-4 rounded-xl border border-gray-700 flex justify-between items-center group hover:border-brand-teal/50 transition-colors shadow-sm">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-100 text-sm font-mono">{formatDateToSpanish(report.date)}</span>
                                            <span className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded border border-gray-700">#{report.id.slice(-4)}</span>
                                        </div>
                                        <div className="text-sm text-brand-lime mt-1 font-bold">Obra: <span className="font-mono">{resolveProjectFullName(report.projectNum)}</span></div>
                                        <div className="text-xs text-gray-400 mt-1 truncate max-w-full italic">"{report.description || 'Sin descripción'}"</div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                        <div className="text-[11px] font-mono text-gray-500 bg-gray-950 px-2 py-1 rounded">
                                            {report.startTime} - {report.endTime}
                                        </div>
                                        <button 
                                            onClick={() => onEditReport(report)}
                                            className="p-2.5 bg-gray-800 hover:bg-brand-teal rounded-xl text-brand-teal hover:text-white transition-all border border-gray-700 shadow-inner"
                                            title="Editar Parte"
                                        >
                                            <EditIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        ))}

        {Object.keys(groupedReports).length === 0 && (
            <div className="text-center py-12 bg-brand-panel rounded-2xl border border-gray-800 border-dashed">
                <p className="text-gray-500 mb-2">No hay partes registrados en este periodo.</p>
                {(searchTerm || searchDate) && <p className="text-xs text-gray-600">Prueba a limpiar los filtros de búsqueda.</p>}
            </div>
        )}
      </div>
    </div>
  );
};

export default TechDashboard;
