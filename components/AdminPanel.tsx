
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppData, TechUser, WorkReport } from '../App';
import { TrashIcon, PlusIcon, DownloadIcon, UserIcon, TruckIcon, FileTextIcon, FilterIcon, EditIcon, SaveIcon, XIcon, LockIcon, UploadIcon, CloudIcon, CalendarIcon, ChartPieIcon, ClockIcon, EyeIcon, AlertIcon } from './icons';
import DailyOrganization from './DailyOrganization';

interface AdminPanelProps {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  onGoToVacations?: () => void;
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

const AdminPanel: React.FC<AdminPanelProps> = ({ data, setData, onGoToVacations, onDeleteReport }) => {
  const [tab, setTab] = useState<'techs' | 'projects' | 'reports' | 'settings' | 'daily' | 'vehicles' | 'expenses'>('reports');
  const [reportViewMode, setReportViewMode] = useState<'list' | 'by_project' | 'by_hours'>('list');
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
  
  const [selectedImage, setSelectedImage] = useState<{data: string, type: string} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportImportInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data.firebaseConfig) {
        setFirebaseConfigInput(data.firebaseConfig);
    }
  }, [data.firebaseConfig]);

  const resolveProjectFullName = (num: string) => {
      return data.projects.find(p => p.startsWith(num)) || num;
  };

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
    if (window.confirm('⚠️ ¿BORRAR TODAS LAS OBRAS?')) {
        setData(prev => ({ ...prev, projects: [] }));
    }
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
        alert(`Importadas ${count} obras.`);
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
                else if (char === ',' && !inQuotes) { values.push(current); current = ''; }
                else { current += char; }
            }
            values.push(current);
            const reportId = values[0];
            if (data.reports.some(r => r.id === reportId) || newReports.some(r => r.id === reportId)) {
                skippedCount++;
                continue;
            }
            const report: WorkReport = {
                id: reportId, date: values[1], technician: values[2], projectNum: values[3],
                startTime: values[4], endTime: values[5], vehicle: values[6], isDriver: values[7] === 'SI',
                driverTripType: (values[8] as any) || undefined, description: values[9]?.replace(/;/g, ','),
                expenses: {
                    food: Number(values[10]) || 0, gas: Number(values[11]) || 0, parking: Number(values[12]) || 0,
                    others: Number(values[13]) || 0, othersDesc: values[14]?.replace(/;/g, ',') || ''
                },
                overtimeHours: Number(values[15]) || 0, overtimeType: (values[16] as any) || 'NORMAL', imageNames: []
            };
            newReports.push(report);
            importedCount++;
        }
        if (importedCount > 0) {
            setData(prev => ({ ...prev, reports: [...newReports, ...prev.reports] }));
            alert(`${importedCount} partes añadidos.`);
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

  const projectsSummary = useMemo(() => {
    const summary: Record<string, { count: number, food: number, gas: number, parking: number, others: number, ot: number }> = {};
    filteredReports.forEach(r => {
        if (!summary[r.projectNum]) summary[r.projectNum] = { count: 0, food: 0, gas: 0, parking: 0, others: 0, ot: 0 };
        summary[r.projectNum].count++;
        summary[r.projectNum].food += r.expenses.food;
        summary[r.projectNum].gas += r.expenses.gas;
        summary[r.projectNum].parking += r.expenses.parking;
        summary[r.projectNum].others += r.expenses.others;
        summary[r.projectNum].ot += r.overtimeHours || 0;
    });
    return Object.entries(summary).sort((a, b) => b[1].count - a[1].count);
  }, [filteredReports]);

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
    const headers = ['ID', 'Fecha', 'Técnico', 'Obra Completa', 'Num Obra', 'Entrada', 'Salida', 'Vehículo', 'Conductor', 'Trayecto', 'Desc. Trabajo', 'Gasto Comida', 'Gasto Gasolina', 'Gasto Parking', 'Gasto Otros', 'Desc. Otros', 'Horas Extra', 'Tipo Extra'].join(',');
    const rows = filteredReports.map(r => {
      const cleanDesc = r.description.replace(/(\r\n|\n|\r)/gm, " ").replace(/,/g, ";");
      const cleanOtherDesc = r.expenses.othersDesc.replace(/,/g, ";");
      const fullName = resolveProjectFullName(r.projectNum).replace(/,/g, " -");
      return [r.id, r.date, r.technician, `"${fullName}"`, r.projectNum, r.startTime, r.endTime, r.vehicle, r.isDriver ? 'SI' : 'NO', r.isDriver ? (r.driverTripType || '') : '', `"${cleanDesc}"`, r.expenses.food, r.expenses.gas, r.expenses.parking, r.expenses.others, `"${cleanOtherDesc}"`, r.overtimeHours || 0, r.overtimeType || 'NORMAL'].join(',');
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `partes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const toggleExpandReport = (id: string) => setExpandedReportId(prev => prev === id ? null : id);

  return (
    <div className="bg-brand-panel rounded-xl shadow-xl border border-gray-700 overflow-hidden min-h-[600px]">
      
      {pendingRequests.length > 0 && (
        <div className="bg-orange-600/20 border-b border-orange-500/50 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse-slow">
            <div className="flex items-center gap-3">
                <div className="bg-orange-600 p-2 rounded-lg text-white"><AlertIcon className="w-5 h-5" /></div>
                <div>
                    <p className="text-white font-black uppercase text-xs tracking-widest text-orange-400">Atención Admin</p>
                    <p className="text-orange-200 text-sm">{pendingRequests.length} solicitudes de vacaciones pendientes.</p>
                </div>
            </div>
            <button onClick={onGoToVacations} className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg">Revisar</button>
        </div>
      )}

      {selectedImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedImage(null)}>
          <div className="absolute top-6 right-6 flex gap-4">
              <button onClick={(e) => { e.stopPropagation(); const link = document.createElement('a'); link.href = selectedImage.data; link.download = `TICKET_${selectedImage.type.toUpperCase()}.jpg`; link.click(); }} className="bg-brand-teal text-white p-3 rounded-full shadow-xl"><DownloadIcon className="w-6 h-6" /></button>
              <button className="bg-white/10 text-white p-3 rounded-full" onClick={() => setSelectedImage(null)}><XIcon className="w-6 h-6" /></button>
          </div>
          <img src={selectedImage.data} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10" />
        </div>
      )}

      <div className="flex border-b border-gray-700 bg-brand-dark overflow-x-auto">
        <button onClick={() => setTab('reports')} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap ${tab === 'reports' ? 'text-brand-lime border-b-2 border-brand-lime bg-brand-panel' : 'text-gray-400'}`}><FileTextIcon className="w-4 h-4" /> Base de Datos</button>
        <button onClick={() => setTab('expenses')} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap ${tab === 'expenses' ? 'text-brand-lime border-b-2 border-brand-lime bg-brand-panel' : 'text-gray-400'}`}><ChartPieIcon className="w-4 h-4" /> Gastos</button>
        <button onClick={() => setTab('techs')} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap ${tab === 'techs' ? 'text-brand-teal border-b-2 border-brand-teal bg-brand-panel' : 'text-gray-400'}`}><UserIcon className="w-4 h-4" /> Técnicos</button>
        <button onClick={() => setTab('projects')} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap ${tab === 'projects' ? 'text-brand-teal border-b-2 border-brand-teal bg-brand-panel' : 'text-gray-400'}`}>🚧 Obras</button>
        <button onClick={() => setTab('vehicles')} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap ${tab === 'vehicles' ? 'text-brand-teal border-b-2 border-brand-teal bg-brand-panel' : 'text-gray-400'}`}><TruckIcon className="w-4 h-4" /> Vehículos</button>
        <button onClick={() => setTab('daily')} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap ${tab === 'daily' ? 'text-brand-teal border-b-2 border-brand-teal bg-brand-panel' : 'text-gray-400'}`}><CalendarIcon className="w-4 h-4" /> Org. Diaria</button>
        <button onClick={() => setTab('settings')} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap ${tab === 'settings' ? 'text-brand-teal border-b-2 border-brand-teal bg-brand-panel' : 'text-gray-400'}`}><LockIcon className="w-4 h-4" /> Configuración</button>
      </div>

      <div className="p-6">
        {tab === 'reports' && (
          <div>
            <div className="flex gap-2 mb-4 bg-gray-900 p-2 rounded-lg border border-gray-700 max-w-fit flex-wrap">
                <button onClick={() => setReportViewMode('list')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${reportViewMode === 'list' ? 'bg-brand-lime text-brand-dark' : 'text-gray-400'}`}><FileTextIcon className="w-3 h-3" /> Listado</button>
                <button onClick={() => setReportViewMode('by_project')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${reportViewMode === 'by_project' ? 'bg-brand-teal text-white' : 'text-gray-400'}`}><ChartPieIcon className="w-3 h-3" /> Por Obra</button>
                <button onClick={() => setReportViewMode('by_hours')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${reportViewMode === 'by_hours' ? 'bg-brand-teal text-white' : 'text-gray-400'}`}><ClockIcon className="w-3 h-3" /> Horas</button>
            </div>

            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <select value={filterTech} onChange={e => setFilterTech(e.target.value)} className="bg-gray-800 border border-gray-600 text-sm rounded-lg p-2.5 text-white outline-none">
                    <option value="">Técnicos...</option>
                    {data.technicians.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                 </select>
                 <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="bg-gray-800 border border-gray-600 text-sm rounded-lg p-2.5 text-white outline-none">
                    <option value="">Obras...</option>
                    {data.projects.map(p => <option key={p} value={p}>{p}</option>)}
                 </select>
                 <input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} className="bg-gray-800 border border-gray-600 text-sm rounded-lg p-2.5 text-white outline-none [color-scheme:dark]" />
                 <input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} className="bg-gray-800 border border-gray-600 text-sm rounded-lg p-2.5 text-white outline-none [color-scheme:dark]" />
            </div>

            {reportViewMode === 'list' && (
                <>
                    <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
                        <h3 className="text-lg font-bold text-white">Registro de Actividad</h3>
                        <div className="flex gap-2">
                            <button onClick={downloadCSV} className="bg-brand-teal text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold"><DownloadIcon className="w-4 h-4" /> CSV</button>
                            <label className="bg-brand-lime text-brand-dark px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold cursor-pointer">
                                <UploadIcon className="w-4 h-4" /> Importar
                                <input type="file" ref={reportImportInputRef} onChange={handleImportReports} accept=".csv" className="hidden" />
                            </label>
                        </div>
                    </div>
                    
                    <div className="space-y-8">
                        {Object.entries(groupedReports).map(([monthLabel, weeks]) => (
                            <div key={monthLabel} className="space-y-4">
                                <div className="bg-brand-teal/20 border-l-4 border-brand-teal px-4 py-2 flex items-center gap-3">
                                    <h4 className="text-brand-teal font-black text-lg">{monthLabel}</h4>
                                </div>
                                {Object.entries(weeks).sort((a, b) => b[1][0].date.localeCompare(a[1][0].date)).map(([weekRange, reports]) => (
                                    <div key={weekRange} className="ml-4 space-y-2 overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-[10px] text-gray-500 uppercase bg-gray-900/30">
                                                <tr>
                                                    <th className="px-4 py-2 w-10"></th>
                                                    <th className="px-4 py-2">Fecha</th>
                                                    <th className="px-4 py-2">Técnico</th>
                                                    <th className="px-4 py-2">Obra</th>
                                                    <th className="px-4 py-2 text-right">Gastos</th>
                                                    <th className="px-4 py-2 text-center"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reports.map((report) => {
                                                    const total = Object.values(report.expenses).reduce((a: number, b: any) => (typeof b === 'number' ? a + b : a), 0) as number;
                                                    const isExpanded = expandedReportId === report.id;
                                                    return (
                                                        <React.Fragment key={report.id}>
                                                            <tr className="bg-gray-800/40 border-b border-gray-700/50 hover:bg-gray-800 transition-colors">
                                                                <td className="px-4 py-2"><button onClick={() => toggleExpandReport(report.id)} className="text-brand-teal"><EyeIcon className="w-4 h-4" /></button></td>
                                                                <td className="px-4 py-2 font-mono text-xs">{formatDateToSpanish(report.date)}</td>
                                                                <td className="px-4 py-2 text-xs font-bold text-gray-300">{report.technician}</td>
                                                                <td className="px-4 py-2 text-xs text-brand-teal">{resolveProjectFullName(report.projectNum)}</td>
                                                                <td className="px-4 py-2 text-right text-xs">{total > 0 ? `${total.toFixed(2)}€` : '-'}</td>
                                                                <td className="px-4 py-2 text-center">
                                                                    <button onClick={() => onDeleteReport(report.id)} className="text-red-500/50 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                                                                </td>
                                                            </tr>
                                                            {isExpanded && (
                                                                <tr className="bg-gray-900">
                                                                    <td colSpan={6} className="p-4 border-l-4 border-brand-teal">
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                            <div className="space-y-2">
                                                                                <p className="text-[10px] uppercase text-gray-500">Descripción</p>
                                                                                <p className="text-xs text-gray-300 bg-gray-800 p-2 rounded">{report.description}</p>
                                                                                <p className="text-[10px] uppercase text-gray-500 mt-2">Vehículo</p>
                                                                                <p className="text-xs text-white">{report.vehicle} {report.isDriver ? '(Conductor)' : ''}</p>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[10px] uppercase text-gray-500">Tickets</p>
                                                                                <div className="flex gap-2 mt-1 overflow-x-auto pb-2">
                                                                                    {report.tickets?.map((t, idx) => (
                                                                                        <img key={idx} src={t.data} onClick={() => setSelectedImage({data: t.data, type: t.type})} className="w-16 h-16 object-cover rounded cursor-pointer hover:border-brand-lime border border-gray-700" />
                                                                                    ))}
                                                                                </div>
                                                                            </div>
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
                                ))}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {reportViewMode === 'by_project' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projectsSummary.map(([projectNum, summary]) => (
                        <div key={projectNum} className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                            <h4 className="text-brand-teal font-black text-sm mb-2">{resolveProjectFullName(projectNum)}</h4>
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>Partes: {summary.count}</span>
                                <span className="text-brand-lime font-bold">Total: {(summary.food + summary.gas + summary.parking + summary.others).toFixed(2)}€</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {reportViewMode === 'by_hours' && (
                <div className="space-y-6">
                    {hoursSummary.map(([week, techs]) => (
                        <div key={week} className="bg-gray-900/30 rounded-xl border border-gray-700 overflow-hidden">
                            <div className="bg-gray-800 p-3 text-xs font-bold text-brand-teal uppercase">Semana: {week}</div>
                            <table className="w-full text-xs text-left">
                                <thead><tr className="text-gray-500 bg-black/20">
                                    <th className="px-4 py-2">Técnico</th>
                                    <th className="px-4 py-2 text-right">Horas</th>
                                    <th className="px-4 py-2 text-right">Extras</th>
                                </tr></thead>
                                <tbody>
                                    {(Object.entries(techs) as [string, any][]).map(([tech, h]) => (
                                        <tr key={tech} className="border-t border-gray-800">
                                            <td className="px-4 py-2 font-bold">{tech}</td>
                                            <td className="px-4 py-2 text-right">{h.reg.toFixed(1)}h</td>
                                            <td className="px-4 py-2 text-right text-yellow-500">+{h.ot.toFixed(1)}h</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            )}
          </div>
        )}

        {tab === 'expenses' && (
            <div className="space-y-6">
                <h3 className="text-lg font-bold text-white mb-4">Resumen de Gastos por Técnico y Semana</h3>
                <div className="space-y-8">
                    {weeklyExpensesSummary.map(([week, techs]) => (
                        <div key={week} className="bg-gray-900/30 rounded-xl border border-gray-700 overflow-hidden shadow-lg">
                            <div className="bg-gray-800 p-3 border-b border-gray-700 flex items-center gap-2">
                                <ChartPieIcon className="w-4 h-4 text-brand-lime" />
                                <span className="text-brand-lime font-black text-sm uppercase tracking-widest">Semana: {week}</span>
                            </div>
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {Object.entries(techs).map(([tech, total]) => (
                                    <div key={tech} className="bg-gray-950 p-4 rounded-xl border border-gray-800 flex flex-col justify-center items-center gap-1 group hover:border-brand-teal transition-all">
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{tech}</span>
                                        <span className="text-lg font-black text-white font-mono">{(total as number).toFixed(2)}€</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {weeklyExpensesSummary.length === 0 && <p className="text-center text-gray-500 py-10 italic">No hay registros de gastos actualmente.</p>}
                </div>
            </div>
        )}

        {tab === 'techs' && (
            <div className="space-y-4">
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 flex flex-col sm:flex-row gap-2">
                    <input type="text" placeholder="Nombre" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2" />
                    <input type="password" placeholder="Pass" value={newTechPwd} onChange={e => setNewTechPwd(e.target.value)} className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2" />
                    <button onClick={() => handleAdd('techs')} className="bg-brand-teal text-white px-6 py-2 rounded-lg font-bold">Añadir</button>
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
                                    <div className="w-8 h-8 bg-brand-teal/20 rounded-full flex items-center justify-center text-brand-teal font-bold">{t.name.charAt(0)}</div>
                                    <div><p className="font-bold text-sm text-gray-200">{t.name}</p></div>
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
            <div className="space-y-4">
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                    <div className="flex gap-2 mb-4">
                        <input type="text" placeholder="Ej: 24001 - HOSPITAL" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2" />
                        <button onClick={() => handleAdd('projects')} className="bg-brand-teal text-white px-6 py-2 rounded-lg font-bold">Añadir</button>
                    </div>
                    <div className="flex gap-2">
                        <label className="text-xs text-brand-lime cursor-pointer bg-brand-lime/10 p-2 rounded-lg border border-brand-lime/20 flex items-center gap-2">
                            <UploadIcon className="w-4 h-4" /> Importar TXT
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.csv" className="hidden" />
                        </label>
                        <button onClick={handleDeleteAllProjects} className="text-xs text-red-400 bg-red-900/10 p-2 rounded-lg border border-red-900/20">Borrar Todo</button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {data.projects.map((p, i) => (
                    <div key={i} className="bg-gray-900/30 px-3 py-2 rounded-lg border border-gray-700 flex justify-between items-center group">
                        <span className="text-xs text-gray-300 font-mono truncate">{p}</span>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100">
                            <button onClick={() => startEditing(i, p, 'projects')} className="text-gray-500 hover:text-brand-teal"><EditIcon className="w-3 h-3" /></button>
                            <button onClick={() => handleDelete('projects', i)} className="text-gray-500 hover:text-red-500"><TrashIcon className="w-3 h-3" /></button>
                        </div>
                    </div>
                ))}
                </div>
            </div>
        )}

        {tab === 'vehicles' && (
            <div className="space-y-4">
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 flex flex-col sm:flex-row gap-2">
                    <input type="text" placeholder="Nombre/Matrícula del Vehículo" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2" />
                    <button onClick={() => handleAdd('vehicles')} className="bg-brand-teal text-white px-6 py-2 rounded-lg font-bold">Añadir</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                                    <div className="w-8 h-8 bg-brand-teal/20 rounded-full flex items-center justify-center text-brand-teal font-bold"><TruckIcon className="w-4 h-4" /></div>
                                    <p className="font-bold text-sm text-gray-200">{v}</p>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEditing(i, v, 'vehicles')} className="text-gray-500 hover:text-brand-teal"><EditIcon className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete('vehicles', i)} className="text-gray-500 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
                {data.vehicles.length === 0 && <p className="col-span-full text-center py-10 text-gray-500 italic">No hay vehículos registrados.</p>}
                </div>
            </div>
        )}

        {tab === 'daily' && (<DailyOrganization isReadOnly={false} data={data.dailyOrg} onUpdate={(newOrg) => setData(prev => ({...prev, dailyOrg: newOrg}))} />)}

        {tab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-700">
                    <h3 className="text-lg font-bold text-white mb-4">Configuración</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-gray-500 uppercase mb-1">Pass Admin</label>
                            <input type="text" value={newAdminPwd} onChange={e => setNewAdminPwd(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white font-mono" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 uppercase mb-1">Firebase Config</label>
                            <textarea value={firebaseConfigInput} onChange={e => setFirebaseConfigInput(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono text-[9px]" rows={5} />
                        </div>
                        <button onClick={savePasswords} className="w-full bg-brand-teal text-white font-bold py-3 rounded-xl">Guardar</button>
                        {pwdMsg && <p className="text-center text-xs text-green-400">{pwdMsg}</p>}
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
