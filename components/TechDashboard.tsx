
import React, { useState, useMemo } from 'react';
import { WorkReport } from '../App';
import { PlusIcon, SearchIcon, EditIcon, TrashIcon, FileTextIcon, CalendarIcon, ClockIcon, ChartPieIcon } from './icons';

interface TechDashboardProps {
  reports: WorkReport[];
  projects: string[];
  onNewReport: () => void;
  onEditReport: (report: WorkReport) => void;
  onViewDailyOrg: () => void;
  onDeleteReport: (id: string) => void;
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

const TechDashboard: React.FC<TechDashboardProps> = ({ reports, projects, onNewReport, onEditReport, onViewDailyOrg, onDeleteReport }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDate, setSearchDate] = useState('');

  const resolveProjectFullName = (num: string) => {
    return projects.find(p => p.startsWith(num)) || num;
  };

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

  const summariesByWeek = useMemo(() => {
    const groups: Record<string, { regHours: number, ot: number, totalExpenses: number }> = {};
    reports.forEach(r => {
        const week = getWeekRange(r.date);
        if (!groups[week]) groups[week] = { regHours: 0, ot: 0, totalExpenses: 0 };
        groups[week].regHours += calculateDuration(r.startTime, r.endTime);
        groups[week].ot += r.overtimeHours || 0;
        groups[week].totalExpenses += r.expenses.food + r.expenses.gas + r.expenses.parking + r.expenses.others;
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [reports]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button onClick={onNewReport} className="bg-brand-teal text-white p-6 rounded-2xl shadow-lg transform transition active:scale-95 flex flex-col items-center justify-center gap-2 border border-teal-500/30">
            <PlusIcon className="w-8 h-8 text-brand-lime" />
            <span className="text-lg font-bold">Nuevo Parte</span>
        </button>
        <button onClick={onViewDailyOrg} className="bg-brand-panel text-white p-6 rounded-2xl shadow-lg transform transition active:scale-95 flex flex-col items-center justify-center gap-2 border border-gray-600">
            <CalendarIcon className="w-8 h-8 text-brand-lime" />
            <span className="text-lg font-bold">Organización Diaria</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-brand-panel border border-gray-700 rounded-2xl p-5 shadow-lg">
            <h4 className="text-sm font-bold text-brand-teal flex items-center gap-2 mb-4 uppercase tracking-wider">
                <ClockIcon className="w-4 h-4" /> Horas Semanales
            </h4>
            <div className="overflow-x-auto rounded-lg border border-gray-800">
                <table className="w-full text-left text-xs">
                    <thead className="bg-gray-900 text-brand-lime uppercase text-[9px]">
                        <tr><th className="px-3 py-3">Semana</th><th className="px-3 py-3 text-right">Norm.</th><th className="px-3 py-3 text-right">Ext.</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {summariesByWeek.map(([week, data]) => (
                            <tr key={`hours-${week}`} className="hover:bg-gray-800/40 transition-colors">
                                <td className="px-3 py-3 font-mono text-gray-300">{week}</td>
                                <td className="px-3 py-3 text-right text-white">{data.regHours.toFixed(1)}h</td>
                                <td className="px-3 py-3 text-right text-yellow-400">{data.ot > 0 ? `+${data.ot}h` : '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        <div className="bg-brand-panel border border-gray-700 rounded-2xl p-5 shadow-lg">
            <h4 className="text-sm font-bold text-brand-lime flex items-center gap-2 mb-4 uppercase tracking-wider">
                <ChartPieIcon className="w-4 h-4" /> Gastos
            </h4>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {summariesByWeek.map(([week, data]) => (
                    <div key={`exp-${week}`} className="flex justify-between items-center bg-gray-900/50 px-4 py-3 rounded-xl border border-gray-800">
                        <span className="text-xs text-gray-300 font-mono">{week}</span>
                        <span className="text-sm font-black text-brand-lime">{data.totalExpenses.toFixed(2)} €</span>
                    </div>
                ))}
            </div>
        </div>
      </div>

      <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 space-y-3">
        <div className="relative">
            <input type="text" placeholder="Buscar obra o descripción..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-10 pr-4 py-3 text-white outline-none" />
            <div className="absolute left-3 top-3.5 text-gray-400"><SearchIcon className="w-5 h-5" /></div>
        </div>
        <input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white outline-none text-sm [color-scheme:dark]" />
      </div>

      <div className="space-y-8">
        <h3 className="text-gray-400 font-medium mb-3 uppercase text-xs tracking-wider flex items-center gap-2"><FileTextIcon className="w-4 h-4" /> Historial de Partes</h3>
        {Object.entries(groupedReports).map(([monthLabel, weeks]) => (
            <div key={monthLabel} className="space-y-4">
                <div className="bg-brand-panel border-l-4 border-brand-teal px-4 py-2"><h4 className="text-brand-teal font-black text-sm">{monthLabel}</h4></div>
                {Object.entries(weeks).sort((a, b) => b[1][0].date.localeCompare(a[1][0].date)).map(([weekRange, reportsInWeek]) => (
                    <div key={weekRange} className="space-y-2 ml-2">
                        <div className="text-brand-lime font-bold text-[11px] px-2 py-1 bg-gray-900/40 rounded border border-gray-800/50 w-fit uppercase">Semana: {weekRange}</div>
                        <div className="space-y-3">
                            {reportsInWeek.map(report => (
                                <div key={report.id} className="bg-brand-panel p-4 rounded-xl border border-gray-700 flex justify-between items-center group shadow-sm">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-100 text-sm">{formatDateToSpanish(report.date)}</span>
                                            <span className="text-[10px] text-gray-500">#{report.id.slice(-4)}</span>
                                        </div>
                                        <div className="text-xs text-brand-lime mt-1 font-bold truncate">{resolveProjectFullName(report.projectNum)}</div>
                                        <div className="text-xs text-gray-500 mt-1 italic truncate">"{report.description || 'Sin descripción'}"</div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button onClick={() => onEditReport(report)} className="p-2 bg-gray-800 hover:bg-brand-teal rounded-lg text-brand-teal hover:text-white transition-all"><EditIcon className="w-4 h-4" /></button>
                                        <button onClick={() => onDeleteReport(report.id)} className="p-2 bg-gray-800 hover:bg-red-600 rounded-lg text-red-500/50 hover:text-white transition-all"><TrashIcon className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        ))}
      </div>
    </div>
  );
};

export default TechDashboard;
