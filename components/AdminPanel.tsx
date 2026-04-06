/// <reference types="vite/client" />
import React, { useState, useRef, useEffect, useMemo, useTransition } from 'react';
import { GoogleMap, Marker, useJsApiLoader, InfoWindow } from '@react-google-maps/api';
import { toast } from 'sonner';
import { AppData, TechUser, WorkReport, ProjectData, Budget } from '../App';
import { TrashIcon, PlusIcon, DownloadIcon, UserIcon, TruckIcon, FileTextIcon, FilterIcon, EditIcon, SaveIcon, XIcon, LockIcon, UploadIcon, CloudIcon, CalendarIcon, ChartPieIcon, ClockIcon, EyeIcon, AlertIcon, ChevronDownIcon, ChevronRightIcon, BriefcaseIcon, SearchIcon, CheckCircleIcon, MapIcon, RefreshCwIcon, ShieldCheckIcon } from './icons';
import DailyOrganization, { DailyOrgData } from './DailyOrganization';

interface AdminPanelProps {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  onGoToVacations?: () => void;
  onDeleteReport: (id: string) => void;
  onManualBackup?: () => void;
  onUpdateReport: (report: WorkReport, shouldRedirect: boolean) => Promise<void>;
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

const getDaysDiff = (dateStr?: string) => {
    if (!dateStr) return 0;
    const start = new Date(dateStr);
    const now = new Date();
    // Reset hours to compare dates only
    start.setHours(0,0,0,0);
    now.setHours(0,0,0,0);
    const diffTime = now.getTime() - start.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
};

const MapComponent = ({ projects, selectedProjectId, onSelectProject }: { projects: ProjectData[], selectedProjectId?: string | null, onSelectProject?: (id: string | null) => void }) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const mapRef = useRef<google.maps.Map | null>(null);
  
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey
  });

  const [markers, setMarkers] = useState<any[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<any | null>(null);

  useEffect(() => {
    if (isLoaded && window.google && apiKey) {
      const geocoder = new window.google.maps.Geocoder();
      const newMarkers: any[] = [];
      const projectsWithLocation = projects.filter(p => p.location);
      
      if (projectsWithLocation.length === 0) return;

      projectsWithLocation.forEach(p => {
        geocoder.geocode({ address: p.location }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            newMarkers.push({ id: p.id, position: results[0].geometry.location, name: p.name });
            if (newMarkers.length === projectsWithLocation.length) {
              setMarkers([...newMarkers]);
            }
          } else {
            console.error(`Geocode failed for ${p.location}: ${status}`);
          }
        });
      });
    }
  }, [isLoaded, projects, apiKey]);

  useEffect(() => {
    if (markers.length > 0 && mapRef.current) {
        if (selectedProjectId) {
            const marker = markers.find(m => m.id === selectedProjectId);
            if (marker) {
                setSelectedMarker(marker);
                mapRef.current.panTo(marker.position);
                mapRef.current.setZoom(15);
            }
        } else {
            setSelectedMarker(null);
            const bounds = new window.google.maps.LatLngBounds();
            markers.forEach(m => bounds.extend(m.position));
            mapRef.current.fitBounds(bounds);
            // Si solo hay un marcador, fitBounds puede poner un zoom demasiado alto
            if (markers.length === 1) {
                mapRef.current.setZoom(12);
            }
        }
    }
  }, [selectedProjectId, markers, isLoaded]);

  const onMapLoad = (map: google.maps.Map) => {
    mapRef.current = map;
    if (markers.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        markers.forEach(m => bounds.extend(m.position));
        map.fitBounds(bounds);
    }
  };

  if (!apiKey) {
    return (
      <div className="w-full h-[600px] bg-yellow-50 dark:bg-yellow-900/20 flex flex-col items-center justify-center rounded-xl border border-yellow-200 dark:border-yellow-800 p-6 text-center">
        <AlertIcon className="w-12 h-12 text-yellow-500 mb-4" />
        <h3 className="text-lg font-bold text-yellow-700 dark:text-yellow-400 mb-2">Falta la API Key de Google Maps</h3>
        <p className="text-sm text-yellow-600 dark:text-yellow-300 max-w-md">
          Para que el mapa funcione, debes configurar la variable <b>VITE_GOOGLE_MAPS_API_KEY</b> en los ajustes de la aplicación.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full h-[600px] bg-red-50 dark:bg-red-900/20 flex flex-col items-center justify-center rounded-xl border border-red-200 dark:border-red-800 p-6 text-center">
        <AlertIcon className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">Error al cargar el mapa</h3>
        <p className="text-sm text-red-600 dark:text-red-300 max-w-md">
          Hubo un problema al cargar Google Maps. Por favor, verifica que la API Key en la configuración sea correcta y tenga la facturación activada.
        </p>
      </div>
    );
  }

  return isLoaded ? (
    <GoogleMap 
      mapContainerStyle={{ width: '100%', height: '600px' }} 
      center={{ lat: 40.416775, lng: -3.703790 }} 
      zoom={6}
      onLoad={onMapLoad}
    >
      {markers.map(m => (
        <Marker 
          key={m.id} 
          position={m.position} 
          title={m.name} 
          onClick={() => {
              setSelectedMarker(m);
              if (onSelectProject) onSelectProject(m.id);
          }}
        />
      ))}
      {selectedMarker && (
        <InfoWindow
          position={selectedMarker.position}
          onCloseClick={() => {
              setSelectedMarker(null);
              if (onSelectProject) onSelectProject(null);
          }}
        >
          <div className="p-2 text-gray-900">
            <h3 className="font-bold text-lg text-gray-900">{selectedMarker.name}</h3>
            <p className="text-sm text-gray-700">Ubicación: {projects.find(p => p.id === selectedMarker.id)?.location}</p>
            <button 
              className="mt-2 text-blue-600 underline text-sm font-medium"
              onClick={() => {
                window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(projects.find(p => p.id === selectedMarker.id)?.location || '')}`, '_blank');
              }}
            >
              Cómo llegar (Google Maps)
            </button>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  ) : <div className="w-full h-[600px] bg-gray-100 dark:bg-gray-800 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700">Cargando mapa...</div>;
};

const AdminPanel: React.FC<AdminPanelProps> = ({ data, setData, onGoToVacations, onDeleteReport, onManualBackup, onUpdateReport }) => {
  const [isPending, startTransition] = useTransition();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [expandedTechId, setExpandedTechId] = useState<string | null>(null);
  const [expandedTechMonths, setExpandedTechMonths] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<'techs' | 'projects' | 'budgets' | 'reports' | 'settings' | 'daily' | 'vehicles' | 'expenses' | 'map' | 'overtime'>('reports');
  const [reportViewMode, setReportViewMode] = useState<'list' | 'by_project' | 'by_hours' | 'overtime' | 'tech_overtime' | 'trash'>('list');
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [showValidatedOvertime, setShowValidatedOvertime] = useState(false);
  const [showPendingOvertime, setShowPendingOvertime] = useState(true);
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
  
  // Backups State
  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estado para controlar qué semanas están expandidas
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});

  const [selectedImage, setSelectedImage] = useState<{data: string, type: string} | null>(null);
  
  // Estados para Gestión de Obras
  const [projectForm, setProjectForm] = useState<ProjectData>({
    id: '', name: '', client: '', budgetNum: '', valuation: 'POR HORAS',
    responsibleTech: '', startDate: '', isFinished: false, isInvoiced: false,
    hasWarning: false, warningDate: '', notes: '', location: ''
  });
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [idMode, setIdMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  
  // Estado para las secciones desplegables de Obras
  const [expandedProjectSections, setExpandedProjectSections] = useState<Record<string, boolean>>({
      green: true, orange: true, red: true, blue: true, finished: false, invoiced: false
  });

  const archiveRef = useRef<HTMLDivElement>(null);

  // Estados para Presupuestos
  const [budgetForm, setBudgetForm] = useState<Budget>({
    id: '', budgetNum: '', name: '', client: '', deliveryDate: '',
    excelName: '', hasFolderData: false, isFinished: false, isAccepted: false, comments: ''
  });
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetSearchTerm, setBudgetSearchTerm] = useState('');
  const [mapSearchTerm, setMapSearchTerm] = useState('');

  // Refs de inputs
  const reportImportInputRef = useRef<HTMLInputElement>(null);
  const projectsImportRef = useRef<HTMLInputElement>(null);
  const budgetsImportRef = useRef<HTMLInputElement>(null);
  const techsImportRef = useRef<HTMLInputElement>(null);
  const vehiclesImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data.firebaseConfig) {
        setFirebaseConfigInput(data.firebaseConfig);
    }
  }, [data.firebaseConfig]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const currentWeek = getWeekRange(today);
    setExpandedWeeks(prev => {
        if (Object.keys(prev).length === 0) {
            return { [currentWeek]: true };
        }
        return prev;
    });
  }, []);

  useEffect(() => {
    if (tab === 'projects' && !isEditingProject && idMode === 'AUTO') {
        const yearPrefix = new Date().getFullYear().toString().slice(-2);
        const existingIds = (data.projectsDetailed || [])
            .map(p => p.id)
            .filter(id => id.startsWith(yearPrefix) && !isNaN(Number(id.slice(2))))
            .map(id => parseInt(id.slice(2)));
        
        const nextSeq = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        const nextId = `${yearPrefix}${nextSeq.toString().padStart(3, '0')}`;
        setProjectForm(prev => ({ ...prev, id: nextId }));
    }
  }, [tab, data.projectsDetailed, isEditingProject, idMode]);

  const generateNextProjectId = () => {
        const yearPrefix = new Date().getFullYear().toString().slice(-2);
        const existingIds = (data.projectsDetailed || [])
            .map(p => p.id)
            .filter(id => id.startsWith(yearPrefix) && !isNaN(Number(id.slice(2))))
            .map(id => parseInt(id.slice(2)));
        
        const nextSeq = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        return `${yearPrefix}${nextSeq.toString().padStart(3, '0')}`;
  };

  const resolveProjectFullName = (num: string) => {
      const detailed = (data.projectsDetailed || []).find(p => p.id === num);
      if (detailed) return detailed.name;
      return num;
  };

  const viewProjectHistory = (projectId: string) => {
      setFilterProject(projectId);
      setFilterTech('');
      setFilterDateStart('');
      setFilterDateEnd('');
      setReportViewMode('list');
      setTab('reports');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sendToDailyOrg = (p: ProjectData) => {
      const jobName = `${p.id} - ${p.name}`;
      const colors = ['#E63946','#F77F00','#06D6A0','#118AB2','#073B4C','#D62828','#FCA311','#14213D','#00B4D8','#0077B6'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      let shouldSwitch = true;

      setData(prev => {
          const currentJobs = prev.dailyOrg?.trabajos || [];
          const exists = currentJobs.some(j => j.nombre === jobName);
          if (exists) {
             if(!window.confirm(`La obra "${jobName}" ya está en la organización de hoy. ¿Añadir otra vez?`)) {
                 shouldSwitch = false;
                 return prev;
             }
          }
          const newJob = { id: Date.now(), nombre: jobName, color: randomColor, trabajadores: [] };
          return { ...prev, dailyOrg: { ...prev.dailyOrg, trabajos: [...currentJobs, newJob] } };
      });

      if (shouldSwitch) {
          setTab('daily');
          window.scrollTo({ top: 0, behavior: 'smooth' });
      }
  };

  const toggleExpensePayment = (week: string, tech: string) => {
      const key = `${week}_${tech}`;
      setData(prev => {
          const currentStatus = prev.expensesPayments?.[key] || false;
          return { ...prev, expensesPayments: { ...(prev.expensesPayments || {}), [key]: !currentStatus } };
      });
  };

  const pendingRequests = useMemo(() => {
    return (data.vacationRequests || []).filter(r => r.status === 'pending' || r.status === 'cancel_requested');
  }, [data.vacationRequests]);

  const pendingOvertimeReports = useMemo(() => {
    return data.reports.filter(r => r.overtimeHours > 0 && r.overtimeStatus !== 'validated');
  }, [data.reports]);

  const upcomingAbsences = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    return (data.vacationRequests || []).filter(r => {
        if (r.status !== 'approved') return false;
        
        const [y, m, d] = r.startDate.split('-').map(Number);
        const start = new Date(y, m-1, d);
        
        const diffTime = start.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays > 0 && diffDays <= 4; 
    }).sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [data.vacationRequests]);

  const uniqueClients = useMemo(() => {
      const clients = new Set((data.projectsDetailed || []).map(p => p.client).filter(Boolean));
      (data.budgets || []).forEach(b => { if(b.client) clients.add(b.client); });
      return Array.from(clients).sort();
  }, [data.projectsDetailed, data.budgets]);

  // CATEGORIZACION DE OBRAS EN 6 GRUPOS
  const categorizedProjects = useMemo(() => {
      const groups = {
          green: [] as ProjectData[],
          orange: [] as ProjectData[],
          red: [] as ProjectData[],
          blue: [] as ProjectData[],
          finished: [] as ProjectData[],
          invoiced: [] as ProjectData[]
      };

      const lowerTerm = projectSearchTerm.toLowerCase();
      const filtered = (data.projectsDetailed || []).filter(p => 
          p.id.toLowerCase().includes(lowerTerm) || 
          p.name.toLowerCase().includes(lowerTerm) ||
          (p.client && p.client.toLowerCase().includes(lowerTerm))
      );

      filtered.forEach(p => {
          if (p.isInvoiced) {
              groups.invoiced.push(p);
          } else if (p.isFinished) {
              groups.finished.push(p);
          } else if (p.hasWarning) {
              const diff = getDaysDiff(p.warningDate);
              if (diff <= 2) groups.green.push(p);
              else if (diff <= 5) groups.orange.push(p);
              else groups.red.push(p);
          } else {
              groups.blue.push(p);
          }
      });

      // Ordenar cada grupo por ID descendente
      Object.keys(groups).forEach(key => {
          (groups as any)[key].sort((a: ProjectData, b: ProjectData) => b.id.localeCompare(a.id));
      });

      return groups;
  }, [data.projectsDetailed, projectSearchTerm]);

  const toggleProjectSection = (section: string) => {
      setExpandedProjectSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const sortedBudgets = useMemo(() => {
      let result = [...(data.budgets || [])];

      if (budgetSearchTerm) {
          const lowerTerm = budgetSearchTerm.toLowerCase();
          result = result.filter(b => 
              b.name.toLowerCase().includes(lowerTerm) ||
              (b.client && b.client.toLowerCase().includes(lowerTerm)) ||
              (b.budgetNum && b.budgetNum.includes(lowerTerm)) ||
              (b.excelName && b.excelName.toLowerCase().includes(lowerTerm))
          );
      }

      return result.sort((a, b) => {
          // 1. Terminados al final
          if (a.isFinished !== b.isFinished) return a.isFinished ? 1 : -1;
          // 2. Orden cronológico inverso (más nuevos primero)
          return b.id.localeCompare(a.id);
      });
  }, [data.budgets, budgetSearchTerm]);

  const handleAdd = (type: 'techs' | 'vehicles') => {
    if (!newItemName.trim()) return;
    setData(prev => {
      if (type === 'techs') {
        const newTech: TechUser = { id: Date.now().toString(), name: newItemName, password: newTechPwd || '1234' };
        return { ...prev, technicians: [...prev.technicians, newTech] };
      }
      if (type === 'vehicles') return { ...prev, vehicles: [...prev.vehicles, newItemName] };
      return prev;
    });
    setNewItemName('');
    setNewTechPwd('');
  };

  const handleSaveProject = () => {
      if (!projectForm.name || !projectForm.client) { toast.error("Faltan datos obligatorios"); return; }
      if (!projectForm.id) { toast.error("El ID de obra es obligatorio."); return; }

      if (!isEditingProject) {
          const exists = data.projectsDetailed.some(p => p.id === projectForm.id);
          if (exists) { toast.error(`ERROR: El ID ${projectForm.id} ya existe.`); return; }
      }
      
      const finalProject = { ...projectForm };
      if (finalProject.hasWarning && !finalProject.warningDate) {
          finalProject.warningDate = new Date().toISOString().split('T')[0];
      } else if (!finalProject.hasWarning) {
          finalProject.warningDate = '';
      }

      startTransition(() => {
          setData(prev => {
              let updatedDetailed = [...(prev.projectsDetailed || [])];
              if (isEditingProject) {
                  const idx = updatedDetailed.findIndex(p => p.id === finalProject.id);
                  if (idx >= 0) updatedDetailed[idx] = finalProject;
              } else {
                  updatedDetailed.push(finalProject);
              }
              return { ...prev, projectsDetailed: updatedDetailed };
          });
          resetProjectForm();
      });
  };

  const handleSaveBudget = () => {
      if (!budgetForm.name || !budgetForm.client) { toast.error("Faltan datos obligatorios"); return; }
      const finalBudget = { ...budgetForm, id: budgetForm.id || Date.now().toString() };
      let newProjectCreated = false;
      let newProjectId = '';

      startTransition(() => {
          setData(prev => {
              let updatedBudgets = [...(prev.budgets || [])];
              const idx = updatedBudgets.findIndex(b => b.id === finalBudget.id);
              if (idx >= 0) updatedBudgets[idx] = finalBudget;
              else updatedBudgets = [finalBudget, ...updatedBudgets];

              let updatedProjects = [...prev.projectsDetailed];
              if (finalBudget.isAccepted) {
                  newProjectId = generateNextProjectId();
                  const newProject: ProjectData = {
                      id: newProjectId, name: finalBudget.name, client: finalBudget.client,
                      budgetNum: finalBudget.budgetNum, valuation: 'PRESUPUESTO', responsibleTech: '',
                      startDate: new Date().toISOString().split('T')[0], isFinished: false, isInvoiced: false,
                      hasWarning: false, warningDate: '', notes: `Generado desde presupuesto: ${finalBudget.comments}`
                  };
                  while (updatedProjects.some(p => p.id === newProject.id)) {
                      const num = parseInt(newProject.id.slice(2)) + 1;
                      newProject.id = `${newProject.id.slice(0,2)}${num.toString().padStart(3, '0')}`;
                  }
                  updatedProjects.push(newProject);
                  newProjectCreated = true;
              }
              return { ...prev, budgets: updatedBudgets, projectsDetailed: updatedProjects };
          });

          if (newProjectCreated) toast.success(`✅ Obra creada automáticamente con ID: ${newProjectId}`);
          resetBudgetForm();
      });
  };

  const editBudget = (b: Budget) => { setBudgetForm(b); setIsEditingBudget(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const deleteBudget = (id: string) => { if (!window.confirm("¿Eliminar presupuesto?")) return; setData(prev => ({ ...prev, budgets: prev.budgets.filter(b => b.id !== id) })); };
  const resetBudgetForm = () => { setBudgetForm({ id: '', budgetNum: '', name: '', client: '', deliveryDate: '', excelName: '', hasFolderData: false, isFinished: false, isAccepted: false, comments: '' }); setIsEditingBudget(false); };

  const editProject = (p: ProjectData) => { setProjectForm(p); setIsEditingProject(true); setIdMode('AUTO'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const deleteProject = (id: string) => { if (!window.confirm("¿Eliminar obra?")) return; setData(prev => ({ ...prev, projectsDetailed: prev.projectsDetailed.filter(p => p.id !== id) })); };
  const resetProjectForm = () => { setProjectForm({ id: '', name: '', client: '', budgetNum: '', valuation: 'POR HORAS', responsibleTech: '', startDate: '', isFinished: false, isInvoiced: false, hasWarning: false, warningDate: '', notes: '', location: '' }); setIsEditingProject(false); setIdMode('AUTO'); };

  const handleDelete = (type: 'techs' | 'vehicles', index: number) => {
    if (!window.confirm(`¿Eliminar elemento?`)) return;
    setData(prev => {
      if (type === 'techs') return { ...prev, technicians: prev.technicians.filter((_, i) => i !== index) };
      if (type === 'vehicles') return { ...prev, vehicles: prev.vehicles.filter((_, i) => i !== index) };
      return prev;
    });
  };

  const startEditing = (index: number, item: any, type: 'techs' | 'vehicles') => {
    setEditingIndex(index);
    if (type === 'techs') { const t = item as TechUser; setEditValue(t.name); setEditPwdValue(t.password); }
    else { setEditValue(item as string); }
  };

  const cancelEditing = () => { setEditingIndex(null); setEditValue(''); setEditPwdValue(''); };

  const saveEditing = (type: 'techs' | 'vehicles') => {
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
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, ''));
            const reportId = values[0];
            if (data.reports.some(r => r.id === reportId) || newReports.some(r => r.id === reportId)) continue;
            
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
            toast.success(`${importedCount} partes añadidos.`);
        }
        if (reportImportInputRef.current) reportImportInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleExportJSON = (type: 'projects' | 'budgets' | 'techs' | 'vehicles') => {
      let exportData: any;
      if(type === 'projects') exportData = data.projectsDetailed;
      else if(type === 'budgets') exportData = data.budgets;
      else if(type === 'techs') exportData = data.technicians;
      else if(type === 'vehicles') exportData = data.vehicles;

      const fileName = `jdg_${type}_${new Date().toISOString().split('T')[0]}.json`;
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>, type: 'projects' | 'budgets' | 'techs' | 'vehicles') => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const json = JSON.parse(event.target?.result as string);
              if (!Array.isArray(json)) { toast.error("Lista inválida."); return; }
              
              setData(prev => {
                  let newData = { ...prev };
                  if (type === 'projects') {
                      const current = [...(prev.projectsDetailed || [])];
                      json.forEach((item: ProjectData) => {
                          if(!item.id) return;
                          const idx = current.findIndex(p => p.id === item.id);
                          if (idx >= 0) current[idx] = item; else current.push(item);
                      });
                      newData.projectsDetailed = current;
                  } else if (type === 'budgets') {
                      const current = [...(prev.budgets || [])];
                      json.forEach((item: Budget) => {
                          if(!item.id) return;
                          const idx = current.findIndex(b => b.id === item.id);
                          if (idx >= 0) current[idx] = item; else current.push(item);
                      });
                      newData.budgets = current;
                  } else if (type === 'techs') {
                      // Para técnicos y vehículos reemplazamos o añadimos
                      const current = [...(prev.technicians || [])];
                      json.forEach((item: TechUser) => {
                          if(!item.id) return;
                          const idx = current.findIndex(t => t.id === item.id);
                          if (idx >= 0) current[idx] = item; else current.push(item);
                      });
                      newData.technicians = current;
                  } else if (type === 'vehicles') {
                      const current = [...(prev.vehicles || [])];
                      json.forEach((item: string) => {
                          if(!current.includes(item)) current.push(item);
                      });
                      newData.vehicles = current;
                  }
                  toast.success(`✅ Datos de ${type} importados correctamente.`);
                  return newData;
              });
          } catch (err) { toast.error("Error al procesar el archivo JSON"); }
          if (e.target) e.target.value = ''; 
      };
      reader.readAsText(file);
  };

  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const testFirebaseConnection = async () => {
      setIsTestingConnection(true);
      try {
          const fb = (window as any).firebase;
          if (!fb) throw new Error("Firebase no inicializado");
          const db = fb.app().firestore();
          // Intentar leer un documento inexistente para forzar el check de permisos/conexión
          await db.collection("jdg_teleco_test").doc("ping").get();
          toast.success("Conexión con Firebase establecida correctamente.");
      } catch (e: any) {
          console.error(e);
          if (e.message && e.message.includes("permission-denied")) {
              toast.error("Error de permisos: Revisa las reglas de seguridad de Firestore.");
          } else {
              toast.error("Error de conexión: " + e.message);
          }
      } finally {
          setIsTestingConnection(false);
      }
  };

  const fetchBackups = async () => {
      setIsLoadingBackups(true);
      try {
          const fb = (window as any).firebase;
          if (!fb) return;
          const db = fb.app().firestore();
          // Fetch all backup root documents (they are lightweight since heavy data is in subcollections)
          const snapshot = await db.collection('jdg_teleco_backups').get();
          
          const list: any[] = [];
          snapshot.forEach((doc: any) => {
              list.push({ id: doc.id, ...doc.data() });
          });
          // Sort client side
          list.sort((a, b) => b.id.localeCompare(a.id));
          
          setBackupsList(list);
      } catch (e: any) {
          console.error("Error fetching backups", e);
          if (e.code === 'permission-denied') {
              toast.error("⛔ BLOQUEO DE SEGURIDAD DETECTADO. Revisa las reglas de Firestore.");
          } else {
              toast.error("Error al cargar copias de seguridad: " + e.message);
          }
      } finally {
          setIsLoadingBackups(false);
      }
  };

  const restoreBackup = async (backupId: string) => {
      if(!window.confirm(`⚠️ PELIGRO: Esto sobrescribirá TODOS los datos actuales con la copia del ${backupId}.\n\n¿Estás seguro de continuar?`)) return;
      
      try {
          const fb = (window as any).firebase;
          const db = fb.app().firestore();
          
          // 1. Obtener documento principal
          const doc = await db.collection('jdg_teleco_backups').doc(backupId).get();
          if(!doc.exists) {
              toast.error("Error: La copia de seguridad no existe.");
              return;
          }
          
          let restoredData = doc.data() as AppData;

          // 2. Reconstruir Reports desde Shards
          const reportsSnap = await db.collection('jdg_teleco_backups').doc(backupId).collection('reports_shards').get();
          let allReports: WorkReport[] = [];
          if (!reportsSnap.empty) {
              reportsSnap.forEach((d: any) => {
                  if(d.data().items) allReports.push(...d.data().items);
              });
              restoredData.reports = allReports;
          }

          // 3. Reconstruir Historial desde Shards
          const histSnap = await db.collection('jdg_teleco_backups').doc(backupId).collection('history_shards').get();
          let fullHistory: any = {};
          if (!histSnap.empty) {
              histSnap.forEach((d: any) => {
                  if(d.data().items) Object.assign(fullHistory, d.data().items);
              });
              restoredData.dailyOrgHistory = fullHistory;
          }

          setData(restoredData);
          
          // 4. Sincronizar con Firestore (Opcional pero recomendado)
          if (fb && fb.app().firestore()) {
              const db = fb.app().firestore();
              const reportsRef = db.collection("jdg_teleco").doc("main_db").collection("reports");
              
              // Subir reportes restaurados usando múltiples batches si es necesario
              if (restoredData.reports && restoredData.reports.length > 0) {
                  const reportsToSync = restoredData.reports;
                  const batchSize = 450;
                  for (let i = 0; i < reportsToSync.length; i += batchSize) {
                      const batch = db.batch();
                      const currentBatch = reportsToSync.slice(i, i + batchSize);
                      currentBatch.forEach(r => {
                          batch.set(reportsRef.doc(r.id), r);
                      });
                      await batch.commit();
                  }
              }
          }

          toast.success(`✅ Sistema restaurado correctamente al estado: ${backupId}\n\nSe han restaurado ${restoredData.reports?.length || 0} partes de trabajo.`);

      } catch (e: any) {
          console.error("Restore error", e);
          toast.error("Error restaurando copia: " + e.message);
      }
  };

  const handleExportFullJSON = () => {
    setIsExporting(true);
    try {
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        link.href = url;
        link.download = `JDG_TELECO_FULL_BACKUP_${date}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Copia de seguridad JSON descargada.");
    } catch (e) {
        toast.error("Error al exportar JSON");
    } finally {
        setIsExporting(false);
    }
  };

  const handleImportFullJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("¿Estás seguro de que quieres importar este archivo? SOBREESCRIBIRÁ todos los datos actuales.")) {
        e.target.value = '';
        return;
    }

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedData = JSON.parse(event.target?.result as string);
            // Validación básica
            if (!importedData.technicians || !importedData.reports) {
                throw new Error("Formato de archivo inválido");
            }
            setData(importedData);
            toast.success("Datos importados correctamente.");
        } catch (err) {
            toast.error("Error al importar el archivo JSON.");
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    reader.readAsText(file);
  };

  const filteredReports = useMemo(() => {
    return data.reports.filter(r => {
        if (filterTech && r.technician !== filterTech) return false;
        if (filterProject) {
            const projectFilter = filterProject.toLowerCase();
            const projectFull = resolveProjectFullName(r.projectNum).toLowerCase();
            if (!projectFull.includes(projectFilter) && !r.projectNum.includes(projectFilter)) return false;
        }
        if (filterDateStart && r.date < filterDateStart) return false;
        if (filterDateEnd && r.date > filterDateEnd) return false;
        return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [data.reports, filterTech, filterProject, filterDateStart, filterDateEnd, data.projectsDetailed]);

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

  const groupedExpenses = useMemo(() => {
    const tree: Record<string, Record<string, Record<string, number>>> = {};
    const dateMap: Record<string, string> = {}; 
    filteredReports.forEach(r => {
        const mLabel = getMonthYearLabel(r.date);
        const wLabel = getWeekRange(r.date);
        const total = r.expenses.food + r.expenses.gas + r.expenses.parking + r.expenses.others;
        if (total === 0) return; 
        if (!tree[mLabel]) tree[mLabel] = {};
        if (!tree[mLabel][wLabel]) tree[mLabel][wLabel] = {};
        tree[mLabel][wLabel][r.technician] = (tree[mLabel][wLabel][r.technician] || 0) + total;
        if (!dateMap[mLabel] || r.date > dateMap[mLabel]) dateMap[mLabel] = r.date;
        if (!dateMap[wLabel] || r.date > dateMap[wLabel]) dateMap[wLabel] = r.date;
    });
    return { tree, dateMap };
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

  const downloadCSV = () => {
    const headers = ['ID', 'Fecha', 'Técnico', 'Obra Completa', 'Num Obra', 'Entrada', 'Salida', 'Vehículo', 'Conductor', 'Trayecto', 'Desc. Trabajo', 'Gasto Comida', 'Gasto Gasolina', 'Gasto Parking', 'Gasto Otros', 'Desc. Otros', 'Horas Extra', 'Tipo Extra'].join(',');
    const rows = filteredReports.map(r => {
      const cleanDesc = r.description.replace(/(\r\n|\n|\r)/gm, " ").replace(/,/g, ";");
      const cleanOtherDesc = r.expenses.othersDesc.replace(/,/g, ";");
      const fullName = resolveProjectFullName(r.projectNum).replace(/,/g, " -");
      return [r.id, r.date, r.technician, `"${fullName}"`, r.projectNum, r.startTime, r.endTime, r.vehicle, r.isDriver ? 'SI' : 'NO', r.isDriver ? (r.driverTripType || '') : '', `"${cleanDesc}"`, r.expenses.food, r.expenses.gas, r.expenses.parking, r.expenses.others, `"${cleanOtherDesc}"`, r.overtimeHours || 0, r.overtimeType || 'NORMAL'].join(',');
    });
    const csvContent = "data:text/csv;charset=utf-8," + ["sep=,", headers, ...rows].join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `partes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const toggleExpandReport = (id: string) => setExpandedReportId(prev => prev === id ? null : id);
  const toggleWeekExpansion = (week: string) => setExpandedWeeks(prev => ({ ...prev, [week]: !prev[week] }));
  
  const getWarningStyle = (date?: string) => {
      if (!date) return '';
      const diff = getDaysDiff(date);
      if (diff <= 2) return 'bg-green-100 dark:bg-green-900/30 border-green-500 dark:border-green-600';
      if (diff <= 5) return 'bg-orange-100 dark:bg-orange-900/30 border-orange-500 dark:border-orange-600';
      return 'bg-red-100 dark:bg-red-900/30 border-red-500 dark:border-red-600 animate-pulse-slow';
  };
  const getWarningBadge = (date?: string) => {
      if (!date) return null;
      const diff = getDaysDiff(date);
      if (diff <= 2) return <span className="bg-green-200 text-green-800 text-[9px] font-black px-2 py-0.5 rounded">AVISO: {diff} días</span>;
      if (diff <= 5) return <span className="bg-orange-200 text-orange-800 text-[9px] font-black px-2 py-0.5 rounded">AVISO: {diff} días</span>;
      return <span className="bg-red-200 text-red-800 text-[9px] font-black px-2 py-0.5 rounded animate-pulse">AVISO: {diff} días</span>;
  };

  const getBudgetStyle = (b: Budget) => {
      if (b.isFinished || b.isAccepted || b.deliveryDate) return 'bg-white dark:bg-brand-panel border-gray-200 dark:border-gray-700';
      const created = parseInt(b.id);
      if (isNaN(created)) return 'bg-white dark:bg-brand-panel border-gray-200 dark:border-gray-700';
      const diff = Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24));
      if (diff < 2) return 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-600';
      if (diff < 5) return 'bg-orange-50 dark:bg-orange-900/20 border-orange-500 dark:border-orange-600';
      return 'bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-600 animate-pulse-slow';
  };

  const openGoogleCalendar = (p: ProjectData) => {
      if (!p.startDate) { toast.error('Por favor selecciona una fecha de inicio primero.'); return; }
      const title = encodeURIComponent(`${p.id} - ${p.name}`);
      const details = encodeURIComponent(`Cliente: ${p.client}\nResponsable: ${p.responsibleTech || 'Sin asignar'}`);
      const start = p.startDate.replace(/-/g, '');
      const end = start;
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${start}/${end}`;
      window.open(url, '_blank');
  };

  const handleDailyOrgUpdate = (newOrg: DailyOrgData) => {
    setData(prev => {
        const history = { ...(prev.dailyOrgHistory || {}) };
        if (newOrg && newOrg.fecha) history[newOrg.fecha] = newOrg;
        return { ...prev, dailyOrg: newOrg, dailyOrgHistory: history };
    }); 
  };

  const handleDailyOrgDateChange = (newDate: string) => {
    setData(prev => {
        const existingData = prev.dailyOrgHistory?.[newDate];
        let orgToLoad: DailyOrgData;
        if (existingData) {
            orgToLoad = existingData;
        } else {
            const currentWorkers = prev.dailyOrg?.trabajadores || [];
            const cleanWorkers = currentWorkers.map(w => ({ ...w, asignado: false }));
            orgToLoad = { fecha: newDate, trabajos: [], trabajadores: cleanWorkers };
        }
        return { ...prev, dailyOrg: orgToLoad };
    });
  };

  // RENDER DE FILA DE OBRA
  const renderProjectRow = (p: ProjectData) => {
      const isInactive = p.isFinished || p.isInvoiced;
      const warningStyle = !isInactive && p.hasWarning ? getWarningStyle(p.warningDate) : '';
      
      return (
          <div key={p.id} className={`bg-white dark:bg-brand-panel p-5 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group hover:border-brand-teal/50 transition-all ${isInactive ? 'opacity-60 border-gray-300 dark:border-gray-800 bg-gray-100 dark:bg-gray-900/20' : warningStyle ? warningStyle : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="flex-1 w-full">
                  <div className="flex items-center gap-3 mb-1">
                      <button onClick={() => viewProjectHistory(p.id)} className={`font-black px-2 py-0.5 rounded text-sm tracking-wider hover:scale-105 transition-transform cursor-pointer ${isInactive ? 'bg-gray-200 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300' : 'bg-brand-teal/10 dark:bg-brand-teal/20 text-brand-teal hover:bg-brand-teal hover:text-white'}`} title="Ver historial de partes">{p.id}</button>
                      <span className={`font-bold uppercase text-sm truncate ${isInactive ? 'text-gray-500 line-through decoration-brand-teal/50' : 'text-gray-900 dark:text-white'}`}>{p.name}</span>
                      {!isInactive && (
                          <>
                              <button onClick={(e) => { e.stopPropagation(); sendToDailyOrg(p); }} className="ml-2 bg-brand-teal/10 dark:bg-brand-teal/20 hover:bg-brand-teal hover:text-white text-brand-teal dark:text-brand-lime p-1.5 rounded-lg transition-colors shadow-sm" title="Enviar a Organización Diaria"><CalendarIcon className="w-4 h-4" /></button>
                              <button onClick={(e) => { e.stopPropagation(); openGoogleCalendar(p); }} className="ml-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-400 p-1.5 rounded-lg transition-colors shadow-sm" title="Agendar en Google Calendar"><CalendarIcon className="w-4 h-4" /></button>
                          </>
                      )}
                      {p.isFinished && <span className="bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 text-[9px] font-black px-2 py-0.5 rounded uppercase border border-green-200 dark:border-green-800">Terminada</span>}
                      {p.isInvoiced && <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[9px] font-black px-2 py-0.5 rounded uppercase border border-blue-200 dark:border-blue-800">Facturada</span>}
                      {!isInactive && p.hasWarning && getWarningBadge(p.warningDate)}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-[10px] text-gray-400 uppercase font-medium">
                      <div><span className="block text-gray-500 dark:text-gray-600 mb-0.5">Cliente</span><span className="text-gray-700 dark:text-gray-300">{p.client}</span></div>
                      <div><span className="block text-gray-500 dark:text-gray-600 mb-0.5">Responsable</span><span className="text-gray-700 dark:text-gray-300">{p.responsibleTech || '-'}</span></div>
                      <div><span className="block text-gray-500 dark:text-gray-600 mb-0.5">Valoración</span><span className="text-gray-700 dark:text-gray-300">{p.valuation}</span></div>
                      <div><span className="block text-gray-500 dark:text-gray-600 mb-0.5">Presupuesto</span><span className="text-gray-700 dark:text-gray-300">{p.budgetNum || '-'}</span></div>
                  </div>
                  {p.notes && <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-800"><p className="text-[10px] text-gray-500 italic truncate">{p.notes}</p></div>}
              </div>
              <div className="flex gap-2 self-end md:self-center">
                  <button onClick={() => editProject(p)} className="p-2 text-gray-400 hover:text-brand-teal bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"><EditIcon className="w-4 h-4" /></button>
                  <button onClick={() => deleteProject(p.id)} className="p-2 text-gray-400 hover:text-red-500 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" /></button>
              </div>
          </div>
      );
  };

  return (
    <div className="bg-white dark:bg-brand-panel rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[600px] transition-colors duration-300">
      
      {/* VACATION ALERTS */}
      {upcomingAbsences.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 p-3">
            <div className="flex items-center gap-2 mb-2">
                <CalendarIcon className="w-4 h-4 text-brand-teal" />
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-teal dark:text-brand-lime">Próximas Ausencias (4 días)</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {upcomingAbsences.map(r => {
                    const [y, m, d] = r.startDate.split('-').map(Number);
                    const start = new Date(y, m-1, d);
                    const today = new Date(); today.setHours(0,0,0,0);
                    const diff = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    
                    let colorClass = "bg-green-100 text-green-800 border-green-200";
                    if (diff <= 2) colorClass = "bg-orange-100 text-orange-800 border-orange-200";
                    if (diff <= 1) colorClass = "bg-red-100 text-red-800 border-red-200 animate-pulse";

                    return (
                        <div key={r.id} className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 shadow-sm ${colorClass}`}>
                            <span className="uppercase">{r.userName}</span>
                            <span>➜</span>
                            <span>{diff === 1 ? 'MAÑANA' : `en ${diff} días`}</span>
                            <span className="opacity-60 font-mono">({formatDateToSpanish(r.startDate)})</span>
                        </div>
                    );
                })}
            </div>
        </div>
      )}

      {pendingRequests.length > 0 && (
        <div className="bg-orange-100 dark:bg-orange-600/20 border-b border-orange-200 dark:border-orange-500/50 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse-slow">
            <div className="flex items-center gap-3">
                <div className="bg-orange-500 dark:bg-orange-600 p-2 rounded-lg text-white"><AlertIcon className="w-5 h-5" /></div>
                <div>
                    <p className="text-orange-800 dark:text-orange-400 font-black uppercase text-xs tracking-widest">Atención Admin</p>
                    <p className="text-orange-700 dark:text-orange-200 text-sm">{pendingRequests.length} solicitudes de vacaciones pendientes.</p>
                </div>
            </div>
            <button onClick={onGoToVacations} className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg">Revisar</button>
        </div>
      )}

      {pendingOvertimeReports.length > 0 && (
        <div className="bg-yellow-100 dark:bg-yellow-600/20 border-b border-yellow-200 dark:border-yellow-500/50 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse-slow">
            <div className="flex items-center gap-3">
                <div className="bg-yellow-500 dark:bg-yellow-600 p-2 rounded-lg text-white"><ClockIcon className="w-5 h-5" /></div>
                <div>
                    <p className="text-yellow-800 dark:text-yellow-400 font-black uppercase text-xs tracking-widest">Horas Extra Pendientes</p>
                    <p className="text-yellow-700 dark:text-yellow-200 text-sm">Tienes {pendingOvertimeReports.length} partes con horas extra pendientes de validar.</p>
                </div>
            </div>
            <button 
              onClick={() => {
                setTab('reports');
                setReportViewMode('overtime');
              }} 
              className="bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg"
            >
              Revisar Horas
            </button>
        </div>
      )}

      {selectedImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedImage(null)}>
          <div className="absolute top-6 right-6 flex gap-4">
              <button onClick={(e) => { e.stopPropagation(); const link = document.createElement('a'); link.href = selectedImage.data; link.download = `TICKET_${selectedImage.type.toUpperCase()}.jpg`; link.click(); }} className="bg-brand-teal text-white p-3 rounded-full shadow-xl"><DownloadIcon className="w-6 h-6" /></button>
              <button className="bg-white/10 text-white p-3 rounded-full" onClick={() => setSelectedImage(null)}><XIcon className="w-6 h-6" /></button>
          </div>
          {selectedImage.data && <img src={selectedImage.data} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10" />}
        </div>
      )}

      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-brand-dark overflow-x-auto transition-colors duration-300">
        <button onClick={() => setTab('reports')} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${tab === 'reports' ? 'text-brand-teal dark:text-brand-lime border-b-2 border-brand-teal dark:border-brand-lime bg-white dark:bg-brand-panel' : 'text-gray-500 dark:text-gray-400'}`}><FileTextIcon className="w-4 h-4" /> Base de Datos</button>
        <button onClick={() => setTab('expenses')} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${tab === 'expenses' ? 'text-brand-teal dark:text-brand-lime border-b-2 border-brand-teal dark:border-brand-lime bg-white dark:bg-brand-panel' : 'text-gray-500 dark:text-gray-400'}`}><ChartPieIcon className="w-4 h-4" /> Gastos</button>
        <button onClick={() => setTab('budgets')} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${tab === 'budgets' ? 'text-brand-teal dark:text-brand-teal border-b-2 border-brand-teal dark:border-brand-teal bg-white dark:bg-brand-panel' : 'text-gray-500 dark:text-gray-400'}`}><FileTextIcon className="w-4 h-4" /> Presupuestos</button>
        <button onClick={() => setTab('projects')} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${tab === 'projects' ? 'text-brand-teal dark:text-brand-teal border-b-2 border-brand-teal dark:border-brand-teal bg-white dark:bg-brand-panel' : 'text-gray-500 dark:text-gray-400'}`}><BriefcaseIcon className="w-4 h-4" /> Gestión Obras</button>
        <button onClick={() => setTab('daily')} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${tab === 'daily' ? 'text-brand-teal dark:text-brand-teal border-b-2 border-brand-teal dark:border-brand-teal bg-white dark:bg-brand-panel' : 'text-gray-500 dark:text-gray-400'}`}><CalendarIcon className="w-4 h-4" /> Org. Diaria</button>
        <button onClick={() => setTab('map')} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${tab === 'map' ? 'text-brand-teal dark:text-brand-teal border-b-2 border-brand-teal dark:border-brand-teal bg-white dark:bg-brand-panel' : 'text-gray-500 dark:text-gray-400'}`}><MapIcon className="w-4 h-4" /> Mapa Obras</button>
        <button onClick={() => setTab('techs')} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${tab === 'techs' ? 'text-brand-teal dark:text-brand-teal border-b-2 border-brand-teal dark:border-brand-teal bg-white dark:bg-brand-panel' : 'text-gray-500 dark:text-gray-400'}`}><UserIcon className="w-4 h-4" /> Técnicos</button>
        <button onClick={() => setTab('vehicles')} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${tab === 'vehicles' ? 'text-brand-teal dark:text-brand-teal border-b-2 border-brand-teal dark:border-brand-teal bg-white dark:bg-brand-panel' : 'text-gray-500 dark:text-gray-400'}`}><TruckIcon className="w-4 h-4" /> Vehículos</button>
        <button onClick={() => setTab('settings')} className={`px-4 md:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${tab === 'settings' ? 'text-brand-teal dark:text-brand-teal border-b-2 border-brand-teal dark:border-brand-teal bg-white dark:bg-brand-panel' : 'text-gray-500 dark:text-gray-400'}`}><LockIcon className="w-4 h-4" /> Configuración</button>
      </div>

      <div className="p-6">
        
        {tab === 'reports' && (
          <div>
            <div className="flex gap-2 mb-4 bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border border-gray-200 dark:border-gray-700 max-w-fit flex-wrap">
                <button onClick={() => setReportViewMode('list')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${reportViewMode === 'list' ? 'bg-brand-teal dark:bg-brand-lime text-white dark:text-brand-dark' : 'text-gray-500 dark:text-gray-400'}`}><FileTextIcon className="w-3 h-3" /> Listado</button>
                <button onClick={() => setReportViewMode('by_project')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${reportViewMode === 'by_project' ? 'bg-brand-teal text-white' : 'text-gray-500 dark:text-gray-400'}`}><ChartPieIcon className="w-3 h-3" /> Por Obra</button>
                <button onClick={() => setReportViewMode('by_hours')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${reportViewMode === 'by_hours' ? 'bg-brand-teal text-white' : 'text-gray-500 dark:text-gray-400'}`}><ClockIcon className="w-3 h-3" /> Horas</button>
                <button onClick={() => setReportViewMode('overtime')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${reportViewMode === 'overtime' ? 'bg-brand-teal text-white' : 'text-gray-500 dark:text-gray-400'}`}><ClockIcon className="w-3 h-3" /> Horas Extra</button>
                <button onClick={() => setReportViewMode('tech_overtime')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${reportViewMode === 'tech_overtime' ? 'bg-brand-teal text-white' : 'text-gray-500 dark:text-gray-400'}`}><UserIcon className="w-3 h-3" /> Horas Extra Técnicos</button>
                <button onClick={() => setReportViewMode('trash')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${reportViewMode === 'trash' ? 'bg-red-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-red-500'}`}><TrashIcon className="w-3 h-3" /> Papelera</button>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700 mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <select value={filterTech} onChange={e => setFilterTech(e.target.value)} className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm rounded-lg p-2.5 text-gray-900 dark:text-white outline-none">
                    <option value="">Técnicos...</option>
                    {data.technicians.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                 </select>
                 <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm rounded-lg p-2.5 text-gray-900 dark:text-white outline-none">
                    <option value="">Obras...</option>
                    {data.projectsDetailed.map(p => <option key={p.id} value={p.id}>{p.id} - {p.name}</option>)}
                 </select>
                 <input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm rounded-lg p-2.5 text-gray-900 dark:text-white outline-none dark:[color-scheme:dark]" />
                 <input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm rounded-lg p-2.5 text-gray-900 dark:text-white outline-none dark:[color-scheme:dark]" />
            </div>
            {reportViewMode === 'overtime' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">Revisión de Horas Extra</h3>
                  {data.reports.filter(r => r.overtimeHours > 0 && r.overtimeStatus !== 'validated').length > 0 && (
                    <button 
                      onClick={async () => {
                        const pending = data.reports.filter(r => r.overtimeHours > 0 && r.overtimeStatus !== 'validated');
                        if (window.confirm(`¿Validar los ${pending.length} partes pendientes?`)) {
                          for (const r of pending) {
                            await onUpdateReport({ ...r, overtimeStatus: 'validated' }, false);
                          }
                          toast.success(`${pending.length} partes validados`);
                        }
                      }}
                      className="bg-brand-teal text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-teal-600 transition-colors"
                    >
                      Validar Todo
                    </button>
                  )}
                </div>

                <div className="mb-8">
                  <button onClick={() => setShowPendingOvertime(!showPendingOvertime)} className="flex items-center gap-2 text-gray-700 dark:text-gray-200 font-bold hover:text-brand-teal">
                    {showPendingOvertime ? <ChevronDownIcon className="w-5 h-5" /> : <ChevronRightIcon className="w-5 h-5" />}
                    Horas por Validar ({data.reports.filter(r => r.overtimeHours > 0 && r.overtimeStatus !== 'validated').length})
                  </button>
                  
                  {showPendingOvertime && (
                    <div className="space-y-4 mt-4">
                      {data.reports
                        .filter(r => r.overtimeHours > 0 && r.overtimeStatus !== 'validated')
                        .map(r => {
                          console.log('Report ID:', r.id, 'Status:', r.overtimeStatus);
                          return (
                          <div key={r.id} className="p-4 rounded-lg border bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-bold text-gray-800 dark:text-white">{r.technician} - {r.projectNum}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-300">{r.date} | {r.overtimeHours}h ({r.overtimeType})</p>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => { 
                                  const week = getWeekRange(r.date);
                                  console.log('Expanding week:', week, 'Report ID:', r.id);
                                  // Limpiamos filtros para asegurar que el parte sea visible
                                  setFilterTech('');
                                  setFilterProject('');
                                  setFilterDateStart('');
                                  setFilterDateEnd('');
                                  setExpandedWeeks(prev => {
                                    const next = { ...prev, [week]: true };
                                    console.log('New expandedWeeks:', next);
                                    return next;
                                  });
                                  setReportViewMode('list'); 
                                  setExpandedReportId(r.id); 
                                  console.log('Setting expandedReportId to:', r.id);
                                }} className="text-brand-teal hover:underline text-sm font-bold">Ver Parte</button>
                                <button onClick={async () => {
                                  await onUpdateReport({ ...r, overtimeStatus: 'validated' }, false);
                                }} className="bg-green-600 text-white px-3 py-1 rounded text-sm font-bold">Validar</button>
                              </div>
                            </div>
                          </div>
                        )})}
                    </div>
                  )}
                </div>
                
                <div className="mt-8">
                  <button onClick={() => setShowValidatedOvertime(!showValidatedOvertime)} className="flex items-center gap-2 text-gray-700 dark:text-gray-200 font-bold hover:text-brand-teal">
                    {showValidatedOvertime ? <ChevronDownIcon className="w-5 h-5" /> : <ChevronRightIcon className="w-5 h-5" />}
                    Horas Validadas ({data.reports.filter(r => r.overtimeHours > 0 && r.overtimeStatus === 'validated').length})
                  </button>
                  {showValidatedOvertime && (
                    <div className="space-y-4 mt-4">
                      {data.reports
                        .filter(r => r.overtimeHours > 0 && r.overtimeStatus === 'validated')
                        .map(r => (
                          <div key={r.id} className="p-4 rounded-lg border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-bold text-gray-800 dark:text-white">{r.technician} - {r.projectNum}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-300">{r.date} | {r.overtimeHours}h ({r.overtimeType})</p>
                              </div>
                              <button onClick={() => { 
                                const week = getWeekRange(r.date);
                                console.log('Expanding week (validated):', week, 'Report ID:', r.id);
                                // Limpiamos filtros para asegurar que el parte sea visible
                                setFilterTech('');
                                setFilterProject('');
                                setFilterDateStart('');
                                setFilterDateEnd('');
                                setExpandedWeeks(prev => ({ ...prev, [week]: true }));
                                setReportViewMode('list'); 
                                setExpandedReportId(r.id); 
                                console.log('Setting expandedReportId (validated) to:', r.id);
                              }} className="text-brand-teal hover:underline text-sm font-bold">Ver Parte</button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {reportViewMode === 'tech_overtime' && (
              <div className="space-y-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <ClockIcon className="w-5 h-5 text-brand-teal" /> Historial Horas Extra por Técnico
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-8">
                  {data.technicians.map(tech => {
                    // Agrupación por MESES para este técnico
                    const techReports = data.reports.filter(r => r.technician === tech.name && r.overtimeHours > 0);
                    if (techReports.length === 0) return null;

                    const monthlyGroups: Record<string, { label: string, total: number, norm: number, noct: number, finde: number }> = {};
                    techReports.forEach(r => {
                      const date = new Date(r.date);
                      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                      const label = getMonthYearLabel(r.date);
                      if (!monthlyGroups[key]) monthlyGroups[key] = { label, total: 0, norm: 0, noct: 0, finde: 0 };
                      const ot = r.overtimeHours;
                      monthlyGroups[key].total += ot;
                      if (r.overtimeType === 'NORMAL') monthlyGroups[key].norm += ot;
                      else if (r.overtimeType === 'NOCTURNA') monthlyGroups[key].noct += ot;
                      else if (r.overtimeType === 'FINDE SEMANA') monthlyGroups[key].finde += ot;
                    });

                    const sortedMonths = Object.entries(monthlyGroups).sort((a, b) => b[0].localeCompare(a[0]));

                    return (
                      <div key={tech.id} className="bg-white dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal font-bold">
                            {tech.name.charAt(0)}
                          </div>
                          <h4 className="font-black text-gray-800 dark:text-white uppercase tracking-wider">{tech.name}</h4>
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {sortedMonths.map(([monthKey, monthData]) => (
                            <div key={monthKey} className="bg-brand-dark p-4 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden group">
                              <div className="absolute top-0 right-0 w-1 h-full bg-brand-teal opacity-40 group-hover:opacity-100 transition-opacity"></div>
                              <div className="flex justify-between items-start mb-4">
                                <h5 className="text-white font-black text-sm tracking-widest uppercase">{monthData.label}</h5>
                                <span className="text-brand-lime font-black text-2xl tracking-tighter">{monthData.total}h</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="bg-white/5 p-2 rounded-lg text-center">
                                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Norm</p>
                                  <p className="text-white font-black text-sm">{monthData.norm}</p>
                                </div>
                                <div className="bg-white/5 p-2 rounded-lg text-center">
                                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Noc</p>
                                  <p className="text-white font-black text-sm">{monthData.noct}</p>
                                </div>
                                <div className="bg-white/5 p-2 rounded-lg text-center">
                                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Fin</p>
                                  <p className="text-white font-black text-sm">{monthData.finde}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {reportViewMode === 'list' && (
                <>
                    <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">Registro de Actividad</h3>
                        <div className="flex gap-2">
                            <button onClick={downloadCSV} className="bg-brand-teal text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold"><DownloadIcon className="w-4 h-4" /> CSV</button>
                            <label className="bg-brand-lime text-brand-dark px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold cursor-pointer hover:bg-lime-400">
                                <UploadIcon className="w-4 h-4" /> Importar
                                <input type="file" ref={reportImportInputRef} onChange={handleImportReports} accept=".csv" className="hidden" />
                            </label>
                        </div>
                    </div>
                    
                    <div className="space-y-12">
                        {Object.entries(groupedReports).map(([monthLabel, weeks]) => (
                            <div key={monthLabel} className="space-y-6">
                                <div className="bg-brand-teal/10 dark:bg-brand-teal/20 border-l-4 border-brand-teal px-4 py-3 flex items-center gap-3">
                                    <h4 className="text-brand-teal dark:text-brand-teal font-black text-xl tracking-widest">{monthLabel}</h4>
                                </div>
                                {Object.entries(weeks).sort((a, b) => b[1][0].date.localeCompare(a[1][0].date)).map(([weekRange, reports]) => {
                                    const isExpanded = !!expandedWeeks[weekRange];
                                    return (
                                        <div key={weekRange} className="space-y-3">
                                            <div 
                                                onClick={() => toggleWeekExpansion(weekRange)}
                                                className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800/50 pb-2 mb-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/20 transition-colors px-1 rounded"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-brand-teal dark:text-brand-lime text-2xl leading-none">•</span>
                                                    <span className="text-brand-teal dark:text-brand-lime font-black text-[11px] uppercase tracking-[2px]">SEMANA: {weekRange}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{reports.length} partes</span>
                                                    <ChevronDownIcon className={`w-4 h-4 text-gray-600 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                                </div>
                                            </div>
                                            {isExpanded && (
                                                <div className="overflow-x-auto animate-fade-in">
                                                    <table className="w-full text-left">
                                                        <thead className="text-[10px] text-gray-500 uppercase bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800">
                                                            <tr>
                                                                <th className="px-3 py-3 w-8"></th>
                                                                <th className="px-3 py-3 w-28">Fecha</th>
                                                                <th className="px-3 py-3 w-40">Técnico</th>
                                                                <th className="px-3 py-3 w-24 text-brand-teal">Obra</th>
                                                                <th className="px-3 py-3">Desc.</th>
                                                                <th className="px-3 py-3 text-right">Extras</th>
                                                                <th className="px-3 py-3 text-right">Gastos</th>
                                                                <th className="px-3 py-3 text-center">Acción</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800/50">
                                                            {reports.map((report) => {
                                                                const total = Object.values(report.expenses).reduce((a: number, b: any) => (typeof b === 'number' ? a + b : a), 0) as number;
                                                                const isReportExpanded = expandedReportId === report.id;
                                                                return (
                                                                    <React.Fragment key={report.id}>
                                                                        <tr className={`${report.overtimeHours > 0 ? (report.overtimeStatus === 'validated' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-orange-50 dark:bg-orange-900/20') : 'bg-white dark:bg-gray-800/20'} hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors group`}>
                                                                            <td className="px-3 py-3">
                                                                                <button onClick={() => toggleExpandReport(report.id)} className="text-gray-400 hover:text-brand-teal transition-colors"><EyeIcon className="w-4 h-4" /></button>
                                                                            </td>
                                                                            <td className="px-3 py-3 font-mono text-[11px] text-gray-500 dark:text-gray-400">{report.date}</td>
                                                                            <td className="px-3 py-3 text-xs font-black text-gray-700 dark:text-gray-200">{report.technician}</td>
                                                                            <td className="px-3 py-3 text-xs font-bold text-brand-teal/80">
                                                                                {report.projectNum}
                                                                                {resolveProjectFullName(report.projectNum) !== report.projectNum && (<span className="font-normal text-gray-500 dark:text-gray-400 ml-1">- {resolveProjectFullName(report.projectNum)}</span>)}
                                                                            </td>
                                                                            <td className="px-3 py-3 text-[11px] text-gray-500 italic max-w-xs truncate">{report.description || 'Sin descripción'}</td>
                                                                            <td className="px-3 py-3 text-right font-black text-xs text-yellow-600 dark:text-yellow-500">{report.overtimeHours > 0 ? `+${report.overtimeHours}h (${report.overtimeStatus === 'validated' ? 'Validado' : 'Pendiente'})` : '-'}</td>
                                                                            <td className="px-3 py-3 text-right text-xs font-black text-gray-800 dark:text-white">{total > 0 ? `${total.toFixed(2)}€` : '-'}</td>
                                                                            <td className="px-3 py-3 text-center">
                                                                                <button onClick={() => onDeleteReport(report.id)} className="text-red-500/30 hover:text-red-500 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                                                            </td>
                                                                        </tr>
                                                                        {isReportExpanded && (
                                                                            <tr className="bg-gray-50 dark:bg-gray-900/60">
                                                                                <td colSpan={8} className="p-4 border-l-4 border-brand-teal">
                                                                                    {/* ... Detalle reporte ... */}
                                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                                                        <div className="space-y-4">
                                                                                            <div>
                                                                                                <p className="text-[10px] uppercase font-black text-gray-500 tracking-widest mb-1">Descripción Completa</p>
                                                                                                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed bg-white dark:bg-gray-950/50 p-3 rounded-lg border border-gray-200 dark:border-gray-800">{report.description}</p>
                                                                                            </div>
                                                                                            <div className="grid grid-cols-2 gap-4">
                                                                                                <div>
                                                                                                    <p className="text-[10px] uppercase font-black text-gray-500 tracking-widest mb-1">Vehículo</p>
                                                                                                    <p className="text-xs text-gray-700 dark:text-white font-bold">{report.vehicle} {report.isDriver ? '(Conductor)' : ''}</p>
                                                                                                </div>
                                                                                                <div>
                                                                                                    <p className="text-[10px] uppercase font-black text-gray-500 tracking-widest mb-1">Horario</p>
                                                                                                    <p className="text-xs text-gray-700 dark:text-white font-mono">{report.startTime} - {report.endTime}</p>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                        <div>
                                                                                            <p className="text-[10px] uppercase font-black text-gray-500 tracking-widest mb-3">Evidencias / Tickets</p>
                                                                                            <div className="flex gap-3 mt-1 overflow-x-auto pb-2 custom-scrollbar">
                                                                                                {report.tickets?.map((t, idx) => (
                                                                                                    <div key={idx} className="relative group/img flex-shrink-0">
                                                                                                        {t.data && <img src={t.data} onClick={() => setSelectedImage({data: t.data, type: t.type})} className="w-20 h-20 object-cover rounded-lg cursor-pointer hover:border-brand-lime border-2 border-gray-300 dark:border-gray-800 transition-all" />}
                                                                                                        <div className="absolute top-0 right-0 p-1 opacity-0 group-hover/img:opacity-100 transition-opacity"><span className="bg-brand-teal text-[8px] font-bold px-1 rounded text-white">{t.type}</span></div>
                                                                                                    </div>
                                                                                                ))}
                                                                                                {(!report.tickets || report.tickets.length === 0) && <p className="text-[10px] text-gray-500 italic">No hay archivos adjuntos.</p>}
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
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                        {filteredReports.length === 0 && (<div className="py-20 text-center"><FileTextIcon className="w-12 h-12 text-gray-300 dark:text-gray-800 mx-auto mb-4" /><p className="text-gray-500 font-bold uppercase text-xs tracking-[3px]">Sin resultados en la búsqueda</p></div>)}
                    </div>
                </>
            )}
            {reportViewMode === 'by_project' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projectsSummary.map(([projectNum, summary]) => (
                        <div key={projectNum} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                            <h4 className="text-brand-teal font-black text-sm mb-2">{resolveProjectFullName(projectNum)}</h4>
                            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                <span>Partes: {summary.count}</span>
                                <span className="text-brand-teal dark:text-brand-lime font-bold">Total: {(summary.food + summary.gas + summary.parking + summary.others).toFixed(2)}€</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {reportViewMode === 'by_hours' && (
                <div className="space-y-6">
                    {hoursSummary.map(([week, techs]) => (
                        <div key={week} className="bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="bg-gray-100 dark:bg-gray-800 p-3 text-xs font-bold text-brand-teal uppercase">Semana: {week}</div>
                            <table className="w-full text-xs text-left">
                                <thead><tr className="text-gray-500 bg-black/5 dark:bg-black/20"><th className="px-4 py-2">Técnico</th><th className="px-4 py-2 text-right">Horas</th><th className="px-4 py-2 text-right">Extras</th></tr></thead>
                                <tbody>
                                    {(Object.entries(techs) as [string, any][]).map(([tech, h]) => (
                                        <tr key={tech} className="border-t border-gray-200 dark:border-gray-800"><td className="px-4 py-2 font-bold text-gray-700 dark:text-gray-300">{tech}</td><td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">{h.reg.toFixed(1)}h</td><td className="px-4 py-2 text-right text-yellow-600 dark:text-yellow-500">+{h.ot.toFixed(1)}h</td></tr>
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
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Control de Gastos</h3>
                {Object.keys(groupedExpenses.tree).sort((a,b) => groupedExpenses.dateMap[b].localeCompare(groupedExpenses.dateMap[a])).map((month) => {
                    const weeksInMonth = groupedExpenses.tree[month];
                    return (
                        <div key={month} className="space-y-4">
                            <div className="bg-brand-teal/10 dark:bg-brand-teal/20 border-l-4 border-brand-teal px-4 py-3 flex items-center gap-3">
                                <h4 className="text-brand-teal dark:text-brand-teal font-black text-xl tracking-widest">{month}</h4>
                            </div>
                            
                            {Object.keys(weeksInMonth).sort((a,b) => groupedExpenses.dateMap[b].localeCompare(groupedExpenses.dateMap[a])).map((week) => {
                                const isExpanded = !!expandedWeeks[week];
                                const techs = weeksInMonth[week];
                                const totalWeek: number = (Object.values(techs) as number[]).reduce((a, b) => a + b, 0);

                                return (
                                    <div key={week} className="bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                                        <div onClick={() => toggleWeekExpansion(week)} className="bg-gray-100 dark:bg-gray-800 p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <ChartPieIcon className="w-4 h-4 text-brand-teal dark:text-brand-lime" />
                                                <span className="text-brand-teal dark:text-brand-lime font-black text-sm uppercase tracking-widest">Semana: {week}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Total: {totalWeek.toFixed(2)}€</span>
                                                <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                            </div>
                                        </div>
                                        
                                        {isExpanded && (
                                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
                                                {Object.entries(techs).map(([tech, rawTotal]) => {
                                                    const total = Number(rawTotal);
                                                    const paymentKey = `${week}_${tech}`;
                                                    const isPaid = data.expensesPayments?.[paymentKey] || false;
                                                    
                                                    return (
                                                        <div key={tech} className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 group relative ${isPaid ? 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-600' : 'bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 hover:border-brand-teal'}`}>
                                                            <div className="flex justify-between items-start">
                                                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{tech}</span>
                                                                {isPaid && <CheckCircleIcon className="w-4 h-4 text-green-600 dark:text-green-400" />}
                                                            </div>
                                                            <div className="flex justify-between items-end">
                                                                <span className={`text-lg font-black font-mono ${isPaid ? 'text-green-800 dark:text-green-300' : 'text-gray-800 dark:text-white'}`}>{total.toFixed(2)}€</span>
                                                                <label className="flex items-center gap-2 cursor-pointer">
                                                                    <input type="checkbox" checked={isPaid} onChange={() => toggleExpensePayment(week, tech)} className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                                                                    <span className="text-[9px] uppercase font-bold text-gray-500 select-none">Pagado</span>
                                                                </label>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        )}

        {tab === 'techs' && (
            <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-gray-400 font-black uppercase text-[11px] tracking-[3px] flex items-center gap-2">
                        <UserIcon className="w-4 h-4" /> Gestión de Técnicos
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={() => handleExportJSON('techs')} className="text-[10px] font-bold uppercase bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-brand-teal hover:bg-gray-300 dark:hover:bg-gray-700 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 shadow-sm">
                            <DownloadIcon className="w-3 h-3" /> Exportar
                        </button>
                        <label className="text-[10px] font-bold uppercase bg-brand-teal/10 dark:bg-brand-teal/20 text-brand-teal hover:bg-brand-teal hover:text-white px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 cursor-pointer shadow-sm">
                            <UploadIcon className="w-3 h-3" /> Importar
                            <input type="file" ref={techsImportRef} onChange={(e) => handleImportJSON(e, 'techs')} accept=".json" className="hidden" />
                        </label>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-2">
                    <input type="text" placeholder="Nombre" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white" />
                    <input type="password" placeholder="Pass" value={newTechPwd} onChange={e => setNewTechPwd(e.target.value)} className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white" />
                    <button onClick={() => handleAdd('techs')} className="bg-brand-teal text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-teal-600 transition-colors">Añadir</button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                {(data.technicians || []).map((t, i) => {
                    const techReports = data.reports.filter(r => r.technician === t.name);
                    const groupedByMonth: Record<string, { label: string, reports: WorkReport[] }> = {};
                    techReports.forEach(r => {
                        const d = new Date(r.date);
                        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        const label = getMonthYearLabel(r.date);
                        if (!groupedByMonth[key]) groupedByMonth[key] = { label, reports: [] };
                        groupedByMonth[key].reports.push(r);
                    });
                    const sortedMonths = Object.entries(groupedByMonth).sort((a, b) => b[0].localeCompare(a[0]));
                    const isExpanded = expandedTechId === t.id;

                    return (
                        <div key={t.id || i} className="space-y-2">
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center group shadow-sm hover:border-brand-teal/50 transition-all">
                                {editingIndex === i ? (
                                    <div className="flex-1 flex gap-2">
                                        <input value={editValue} onChange={e => setEditValue(e.target.value)} className="flex-1 bg-gray-50 dark:bg-gray-900 border border-brand-teal rounded px-2 py-1 text-xs text-gray-900 dark:text-white" />
                                        <input value={editPwdValue} onChange={e => setEditPwdValue(e.target.value)} className="flex-1 bg-gray-50 dark:bg-gray-900 border border-brand-teal rounded px-2 py-1 text-xs text-gray-900 dark:text-white" />
                                        <button onClick={() => saveEditing('techs')} className="text-green-500"><SaveIcon className="w-4 h-4" /></button>
                                        <button onClick={cancelEditing} className="text-red-500"><XIcon className="w-4 h-4" /></button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-brand-teal/10 dark:bg-brand-teal/20 rounded-full flex items-center justify-center text-brand-teal font-bold">{t.name.charAt(0)}</div>
                                            <div>
                                                <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{t.name}</p>
                                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{techReports.length} partes registrados</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <button 
                                                onClick={() => setExpandedTechId(isExpanded ? null : t.id)}
                                                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${isExpanded ? 'bg-brand-teal text-white border-brand-teal' : 'text-brand-teal border-brand-teal/30 hover:bg-brand-teal/5'}`}
                                            >
                                                {isExpanded ? 'Ocultar Historial' : 'Ver Historial'}
                                            </button>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => startEditing(i, t, 'techs')} className="text-gray-400 dark:text-gray-500 hover:text-brand-teal"><EditIcon className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete('techs', i)} className="text-gray-400 dark:text-gray-500 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            {isExpanded && (
                                <div className="ml-4 pl-4 border-l-2 border-brand-teal/30 space-y-4 py-2 animate-fade-in">
                                    {sortedMonths.length === 0 ? (
                                        <p className="text-xs text-gray-500 italic">Este técnico aún no tiene partes registrados.</p>
                                    ) : (
                                        sortedMonths.map(([monthKey, monthData]) => {
                                            const isMonthExpanded = !!expandedTechMonths[`${t.id}_${monthKey}`];
                                            return (
                                                <div key={monthKey} className="space-y-2">
                                                    <button 
                                                        onClick={() => setExpandedTechMonths(prev => ({ ...prev, [`${t.id}_${monthKey}`]: !isMonthExpanded }))}
                                                        className="flex items-center justify-between w-full bg-gray-50 dark:bg-gray-900/40 p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-brand-teal/30 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <CalendarIcon className="w-4 h-4 text-brand-teal" />
                                                            <span className="text-xs font-black uppercase tracking-widest text-gray-700 dark:text-gray-300">{monthData.label}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[10px] font-bold text-gray-500">{monthData.reports.length} partes</span>
                                                            <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isMonthExpanded ? 'rotate-180' : ''}`} />
                                                        </div>
                                                    </button>
                                                    
                                                    {isMonthExpanded && (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pl-2 animate-fade-in">
                                                            {monthData.reports.sort((a,b) => b.date.localeCompare(a.date)).map(r => (
                                                                <div 
                                                                    key={r.id} 
                                                                    onClick={() => {
                                                                        setFilterTech(t.name);
                                                                        setFilterDateStart(r.date);
                                                                        setFilterDateEnd(r.date);
                                                                        setReportViewMode('list');
                                                                        setTab('reports');
                                                                        setExpandedReportId(r.id);
                                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                                    }}
                                                                    className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:border-brand-teal cursor-pointer transition-all group/report"
                                                                >
                                                                    <div className="flex justify-between items-start mb-1">
                                                                        <span className="text-[10px] font-black text-brand-teal">{r.date}</span>
                                                                        <EyeIcon className="w-3 h-3 text-gray-300 group-hover/report:text-brand-teal transition-colors" />
                                                                    </div>
                                                                    <p className="text-xs font-bold text-gray-800 dark:text-white truncate">{resolveProjectFullName(r.projectNum)}</p>
                                                                    <p className="text-[10px] text-gray-500 italic truncate mt-1">{r.description || 'Sin descripción'}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
                {(data.technicians || []).length === 0 && <p className="col-span-full text-center py-8 text-gray-500 text-xs italic">No hay técnicos registrados.</p>}
                </div>
            </div>
        )}

        {tab === 'vehicles' && (
            <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-gray-400 font-black uppercase text-[11px] tracking-[3px] flex items-center gap-2">
                        <TruckIcon className="w-4 h-4" /> Gestión de Vehículos
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={() => handleExportJSON('vehicles')} className="text-[10px] font-bold uppercase bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-brand-teal hover:bg-gray-300 dark:hover:bg-gray-700 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 shadow-sm">
                            <DownloadIcon className="w-3 h-3" /> Exportar
                        </button>
                        <label className="text-[10px] font-bold uppercase bg-brand-teal/10 dark:bg-brand-teal/20 text-brand-teal hover:bg-brand-teal hover:text-white px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 cursor-pointer shadow-sm">
                            <UploadIcon className="w-3 h-3" /> Importar
                            <input type="file" ref={vehiclesImportRef} onChange={(e) => handleImportJSON(e, 'vehicles')} accept=".json" className="hidden" />
                        </label>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-2">
                    <input type="text" placeholder="Nombre/Matrícula del Vehículo" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white" />
                    <button onClick={() => handleAdd('vehicles')} className="bg-brand-teal text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-teal-600 transition-colors">Añadir</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(data.vehicles || []).map((v, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center group shadow-sm hover:border-brand-teal/50 transition-all">
                        {editingIndex === i ? (
                            <div className="flex-1 flex gap-2">
                                <input value={editValue} onChange={e => setEditValue(e.target.value)} className="flex-1 bg-gray-50 dark:bg-gray-900 border border-brand-teal rounded px-2 py-1 text-xs text-gray-900 dark:text-white" />
                                <button onClick={() => saveEditing('vehicles')} className="text-green-500"><SaveIcon className="w-4 h-4" /></button>
                                <button onClick={cancelEditing} className="text-red-500"><XIcon className="w-4 h-4" /></button>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-brand-teal/10 dark:bg-brand-teal/20 rounded-full flex items-center justify-center text-brand-teal font-bold"><TruckIcon className="w-4 h-4" /></div>
                                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{v}</p>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEditing(i, v, 'vehicles')} className="text-gray-400 dark:text-gray-500 hover:text-brand-teal"><EditIcon className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete('vehicles', i)} className="text-gray-400 dark:text-gray-500 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
                {(data.vehicles || []).length === 0 && <p className="col-span-full text-center py-8 text-gray-500 text-xs italic">No hay vehículos registrados.</p>}
                </div>
            </div>
        )}

        {tab === 'budgets' && (
            <div className="space-y-6">
                <div className="bg-white dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl">
                   <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <span className="text-brand-teal dark:text-brand-lime">{isEditingBudget ? '✏️' : '+'}</span> 
                            {isEditingBudget ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}
                        </h3>
                        {isEditingBudget && (
                            <button onClick={resetBudgetForm} className="text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 px-3 py-1.5 rounded text-gray-500 dark:text-gray-300">
                                Cancelar
                            </button>
                        )}
                   </div>
                   {/* ... (Budget form content) ... */}
                   <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] text-gray-500 uppercase font-black mb-1">Nombre del Presupuesto (Descripción)</label>
                                <input type="text" placeholder="Descripción breve..." value={budgetForm.name} onChange={e => setBudgetForm({...budgetForm, name: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-500 uppercase font-black mb-1">Cliente</label>
                                <input type="text" list="client-options-budget" placeholder="" value={budgetForm.client} onChange={e => setBudgetForm({...budgetForm, client: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none" />
                                <datalist id="client-options-budget">{uniqueClients.map(client => (<option key={client} value={client} />))}</datalist>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[10px] text-gray-500 uppercase font-black mb-1">Número de Presupuesto</label>
                                <input type="text" placeholder="5 cifras" value={budgetForm.budgetNum} onChange={e => setBudgetForm({...budgetForm, budgetNum: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-500 uppercase font-black mb-1">Fecha de Entrega</label>
                                <input type="date" value={budgetForm.deliveryDate} onChange={e => setBudgetForm({...budgetForm, deliveryDate: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none dark:[color-scheme:dark]" />
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-500 uppercase font-black mb-1">Nombre de la Excel</label>
                                <input type="text" value={budgetForm.excelName} onChange={e => setBudgetForm({...budgetForm, excelName: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
                             <label className="flex items-center gap-3 cursor-pointer bg-gray-100 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                                 <input type="checkbox" checked={budgetForm.hasFolderData} onChange={e => setBudgetForm({...budgetForm, hasFolderData: e.target.checked})} className="w-5 h-5 rounded border-gray-400 dark:border-gray-600 text-brand-teal bg-white dark:bg-gray-800 focus:ring-0" />
                                 <span className="text-xs font-bold uppercase text-gray-700 dark:text-white">Datos Carpeta</span>
                             </label>
                             <label className="flex items-center gap-3 cursor-pointer bg-gray-100 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                                 <input type="checkbox" checked={budgetForm.isFinished} onChange={e => setBudgetForm({...budgetForm, isFinished: e.target.checked})} className="w-5 h-5 rounded border-gray-400 dark:border-gray-600 text-brand-teal bg-white dark:bg-gray-800 focus:ring-0" />
                                 <span className="text-xs font-bold uppercase text-gray-700 dark:text-white">Terminado</span>
                             </label>
                             <label className="flex items-center gap-3 cursor-pointer bg-gray-100 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                                 <input type="checkbox" checked={budgetForm.isAccepted} onChange={e => setBudgetForm({...budgetForm, isAccepted: e.target.checked})} className="w-5 h-5 rounded border-gray-400 dark:border-gray-600 text-brand-teal bg-white dark:bg-gray-800 focus:ring-0" />
                                 <span className="text-xs font-bold uppercase text-gray-700 dark:text-white">Aceptado (Crear Obra)</span>
                             </label>
                        </div>
                        <div>
                            <label className="block text-[10px] text-gray-500 uppercase font-black mb-1">Datos / Comentarios</label>
                            <textarea placeholder="Comentarios adicionales..." rows={3} value={budgetForm.comments} onChange={e => setBudgetForm({...budgetForm, comments: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none" />
                        </div>
                   </div>
                   <button onClick={handleSaveBudget} className="w-full mt-6 bg-brand-teal hover:bg-teal-600 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                       <SaveIcon className="w-5 h-5" /> {isEditingBudget ? 'Actualizar Presupuesto' : 'Crear Presupuesto'}
                   </button>
                </div>

                <div className="space-y-4 pt-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-3">
                        <h3 className="text-gray-400 font-black uppercase text-[11px] tracking-[3px] flex items-center gap-2">
                            <FileTextIcon className="w-4 h-4" /> Listado de Presupuestos
                        </h3>
                        <div className="flex gap-2">
                            <button onClick={() => handleExportJSON('budgets')} className="text-[10px] font-bold uppercase bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-brand-teal hover:bg-gray-300 dark:hover:bg-gray-700 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 shadow-sm">
                                <DownloadIcon className="w-3 h-3" /> Exportar
                            </button>
                            <label className="text-[10px] font-bold uppercase bg-brand-teal/10 dark:bg-brand-teal/20 text-brand-teal hover:bg-brand-teal hover:text-white px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 cursor-pointer shadow-sm">
                                <UploadIcon className="w-3 h-3" /> Importar
                                <input type="file" ref={budgetsImportRef} onChange={(e) => handleImportJSON(e, 'budgets')} accept=".json" className="hidden" />
                            </label>
                        </div>
                    </div>

                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="🔍 Buscar presupuesto por Nombre, Cliente, Nº..." 
                            value={budgetSearchTerm} 
                            onChange={(e) => setBudgetSearchTerm(e.target.value)} 
                            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none transition-colors shadow-sm" 
                        />
                        <div className="absolute left-3 top-3.5 text-gray-400"><SearchIcon className="w-4 h-4" /></div>
                    </div>

                    <div className="space-y-3">
                        {sortedBudgets.map((b) => (
                             <div key={b.id} className={`p-5 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group hover:border-brand-teal/50 transition-all shadow-sm ${getBudgetStyle(b)}`}>
                                  <div className="flex-1 w-full">
                                      <div className="flex flex-wrap items-center gap-3 mb-2">
                                          <span className="font-black uppercase text-sm text-gray-900 dark:text-white truncate">{b.name}</span>
                                          {b.budgetNum && <span className="text-xs font-mono text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">#{b.budgetNum}</span>}
                                          {b.isAccepted && <span className="bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 text-[9px] font-black px-2 py-0.5 rounded uppercase border border-green-200 dark:border-green-800">Aceptado</span>}
                                          {b.isFinished && <span className="bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 text-[9px] font-black px-2 py-0.5 rounded uppercase border border-teal-200 dark:border-teal-800">Terminado</span>}
                                          {b.hasFolderData && <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[9px] font-black px-2 py-0.5 rounded uppercase border border-blue-200 dark:border-blue-800">Datos Carpeta</span>}
                                          {getBudgetStyle(b).includes('red') && <span className="text-[9px] px-2 py-0.5 rounded ml-2 bg-red-100 text-red-700 font-bold animate-pulse">Sin fecha</span>}
                                      </div>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] text-gray-400 uppercase font-medium">
                                          <div><span className="block text-gray-500 dark:text-gray-600 mb-0.5">Cliente</span><span className="text-gray-700 dark:text-gray-300">{b.client}</span></div>
                                          <div><span className="block text-gray-500 dark:text-gray-600 mb-0.5">Entrega</span><span className="text-gray-700 dark:text-gray-300">{b.deliveryDate || '-'}</span></div>
                                          <div className="col-span-2"><span className="block text-gray-500 dark:text-gray-600 mb-0.5">Excel</span><span className="text-gray-700 dark:text-gray-300 truncate">{b.excelName || '-'}</span></div>
                                      </div>
                                      {b.comments && <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-800"><p className="text-[10px] text-gray-500 italic truncate">{b.comments}</p></div>}
                                  </div>
                                  <div className="flex gap-2 self-end md:self-center">
                                      <button onClick={() => editBudget(b)} className="p-2 text-gray-400 hover:text-brand-teal bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"><EditIcon className="w-4 h-4" /></button>
                                      <button onClick={() => deleteBudget(b.id)} className="p-2 text-gray-400 hover:text-red-500 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                  </div>
                             </div>
                        ))}
                        {sortedBudgets.length === 0 && <p className="text-center py-8 text-gray-500 text-xs italic">No hay presupuestos registrados.</p>}
                    </div>
                </div>
            </div>
        )}

        {tab === 'projects' && (
            <div className="space-y-6">
                <div className="bg-white dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl">
                   {/* ... Formulario Project ... */}
                   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <span className="text-brand-teal dark:text-brand-lime">{isEditingProject ? '✏️' : '+'}</span> 
                            {isEditingProject ? 'Editar Obra' : 'Alta de Nueva Obra'}
                        </h3>
                        <div className="flex items-center gap-3">
                            {!isEditingProject && (
                                <div className="flex bg-gray-100 dark:bg-gray-950 rounded-lg p-1 border border-gray-200 dark:border-gray-800">
                                    <button onClick={() => setIdMode('AUTO')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-md transition-all tracking-wider ${idMode === 'AUTO' ? 'bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-md' : 'text-gray-500 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-400'}`}>Automático</button>
                                    <button onClick={() => { setIdMode('MANUAL'); setProjectForm(prev => ({...prev, id: ''})); }} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-md transition-all tracking-wider ${idMode === 'MANUAL' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-500 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-400'}`}>Manual</button>
                                </div>
                            )}
                            {isEditingProject && (
                                <button onClick={resetProjectForm} className="text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 px-4 py-2 rounded-lg text-gray-500 dark:text-gray-300 border border-gray-200 dark:border-gray-700">Cancelar Edición</button>
                            )}
                        </div>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        <div className={`relative p-6 rounded-2xl border-2 transition-all group ${idMode === 'MANUAL' ? 'border-orange-500/30 bg-orange-50 dark:bg-orange-500/5' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'}`}>
                             <div className="text-center space-y-2">
                                <label className={`block text-[10px] uppercase font-black tracking-[2px] mb-2 ${idMode === 'MANUAL' ? 'text-orange-500 dark:text-orange-400' : 'text-gray-400 dark:text-gray-500'}`}>{idMode === 'MANUAL' ? 'INTRODUCE Nº OBRA' : 'PRÓXIMO ID AUTOMÁTICO'}</label>
                                {idMode === 'AUTO' || isEditingProject ? (
                                    <div className="text-4xl font-black text-gray-800 dark:text-white tracking-widest font-mono py-2">{projectForm.id}</div>
                                ) : (
                                     <input type="text" value={projectForm.id} onChange={e => setProjectForm({...projectForm, id: e.target.value})} className="w-full bg-transparent border-b-2 border-orange-500/50 text-3xl font-black text-gray-900 dark:text-white text-center focus:border-orange-500 outline-none py-2 placeholder-gray-400 dark:placeholder-gray-700 font-mono" placeholder="Nº OBRA" autoFocus />
                                )}
                             </div>
                        </div>

                        <div>
                             <label className="block text-[10px] text-gray-500 uppercase font-black mb-2 ml-1">Nombre de Obra</label>
                             <input type="text" placeholder="Ej: REFORMA HOSPITAL..." value={projectForm.name} onChange={e => setProjectForm({...projectForm, name: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-4 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none transition-colors shadow-sm" />
                        </div>

                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                 <label className="block text-[10px] text-gray-500 uppercase font-black mb-2 ml-1">Nombre de Cliente</label>
                                 <input type="text" list="client-options" placeholder="" value={projectForm.client} onChange={e => setProjectForm({...projectForm, client: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none" />
                                 <datalist id="client-options">{uniqueClients.map(client => (<option key={client} value={client} />))}</datalist>
                            </div>
                             <div>
                                 <label className="block text-[10px] text-gray-500 uppercase font-black mb-1">Número Presupuesto</label>
                                 <input type="number" placeholder="" value={projectForm.budgetNum} onChange={e => setProjectForm({...projectForm, budgetNum: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none" />
                            </div>
                             <div>
                                 <label className="block text-[10px] text-gray-500 uppercase font-black mb-1">Valoración</label>
                                 <select value={projectForm.valuation} onChange={e => setProjectForm({...projectForm, valuation: e.target.value as any})} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none">
                                     <option value="POR HORAS">POR HORAS</option>
                                     <option value="PRECIO CERRADO">PRECIO CERRADO</option>
                                     <option value="PRESUPUESTO">PRESUPUESTO</option>
                                 </select>
                            </div>
                             <div>
                                 <label className="block text-[10px] text-gray-500 uppercase font-black mb-1">Técnico Responsable</label>
                                 <select value={projectForm.responsibleTech} onChange={e => setProjectForm({...projectForm, responsibleTech: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none">
                                     <option value="">Sin Asignar</option>
                                     {data.technicians.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                 </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                             <div>
                                 <label className="block text-[10px] text-gray-500 uppercase font-black mb-1">Fecha Inicio</label>
                                 <input type="date" value={projectForm.startDate} onChange={e => setProjectForm({...projectForm, startDate: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none dark:[color-scheme:dark]" />
                             </div>
                             <div className="flex flex-wrap gap-4 items-center h-full">
                                 <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                                     <input type="checkbox" checked={projectForm.isFinished} onChange={e => setProjectForm({...projectForm, isFinished: e.target.checked})} className="w-4 h-4 text-brand-teal rounded focus:ring-0" />
                                     <span className="text-xs font-bold uppercase text-gray-700 dark:text-gray-300">Terminada</span>
                                 </label>
                                 <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                                     <input type="checkbox" checked={projectForm.isInvoiced} onChange={e => setProjectForm({...projectForm, isInvoiced: e.target.checked})} className="w-4 h-4 text-blue-500 rounded focus:ring-0" />
                                     <span className="text-xs font-bold uppercase text-gray-700 dark:text-gray-300">Facturada</span>
                                 </label>
                                 <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                                     <input type="checkbox" checked={projectForm.hasWarning} onChange={e => setProjectForm({...projectForm, hasWarning: e.target.checked})} className="w-4 h-4 text-orange-500 rounded focus:ring-0" />
                                     <span className="text-xs font-bold uppercase text-gray-700 dark:text-gray-300">Aviso (2m)</span>
                                 </label>
                             </div>
                        </div>

                        <div className="mt-4">
                             <label className="block text-[10px] text-gray-500 uppercase font-black mb-1">Ubicación (Ciudad/Pueblo)</label>
                             <input type="text" value={projectForm.location || ''} onChange={e => setProjectForm({...projectForm, location: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none" placeholder="Ej: Madrid, Barcelona..." />
                        </div>

                        <div className="mt-4">
                             <label className="block text-[10px] text-gray-500 uppercase font-black mb-1">Notas / Observaciones</label>
                             <textarea rows={2} value={projectForm.notes} onChange={e => setProjectForm({...projectForm, notes: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none" placeholder="Detalles extra de la obra..."></textarea>
                        </div>

                        <button onClick={handleSaveProject} className="w-full mt-6 bg-brand-teal hover:bg-teal-600 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                             <SaveIcon className="w-5 h-5" /> {isEditingProject ? 'Actualizar Obra' : 'Crear Obra'}
                        </button>
                   </div>
                </div>

                <div className="space-y-4 pt-4">
                    <div className="relative">
                        <input type="text" placeholder="🔍 Buscar obra por ID, Nombre, Cliente..." value={projectSearchTerm} onChange={(e) => setProjectSearchTerm(e.target.value)} className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none transition-colors shadow-sm" />
                        <div className="absolute left-3 top-3.5 text-gray-400"><SearchIcon className="w-4 h-4" /></div>
                    </div>

                    {/* Categorized Lists */}
                    {Object.entries(categorizedProjects).map(([key, list]: [string, any]) => {
                        if (list.length === 0) return null;
                        const config: any = {
                            green: { label: 'Obras Activas (Recientes)', color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' },
                            orange: { label: 'Obras Activas (+2 meses)', color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-200' },
                            red: { label: 'Obras Activas (+5 meses)', color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-200' },
                            blue: { label: 'Otras Activas', color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
                            finished: { label: 'Terminadas', color: 'text-gray-600', bg: 'bg-gray-200', border: 'border-gray-300' },
                            invoiced: { label: 'Facturadas', color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200' }
                        }[key];
                        
                        const isExpanded = expandedProjectSections[key];

                        return (
                            <div key={key} className={`rounded-xl border ${config.border} overflow-hidden shadow-sm`}>
                                <button onClick={() => toggleProjectSection(key)} className={`w-full flex justify-between items-center p-3 ${config.bg} ${config.color} font-black uppercase text-xs tracking-widest`}>
                                    <span>{config.label} ({list.length})</span>
                                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                                {isExpanded && (
                                    <div className="p-3 space-y-3 bg-gray-50 dark:bg-gray-900/20">
                                        {(list as any[]).map(p => renderProjectRow(p))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {tab === 'reports' && reportViewMode === 'trash' && (
            <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <TrashIcon className="w-5 h-5 text-red-600" />
                        <div>
                            <h3 className="font-bold text-red-800 dark:text-red-300">Papelera de Reciclaje</h3>
                            <p className="text-xs text-red-600 dark:text-red-400">Los partes borrados se guardan aquí temporalmente (máx. 50).</p>
                        </div>
                    </div>
                    <button onClick={() => setData(prev => ({ ...prev, deletedReports: [] }))} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-red-700 transition-colors">
                        Vaciar Papelera
                    </button>
                </div>

                {(!data.deletedReports || data.deletedReports.length === 0) ? (
                    <div className="text-center py-20 bg-white dark:bg-brand-panel rounded-xl border border-gray-200 dark:border-gray-700">
                        <TrashIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 font-bold">La papelera está vacía</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {[...data.deletedReports].reverse().map((r: any) => (
                            <div key={r.id} className="bg-white dark:bg-brand-panel p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center shadow-sm">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-black text-brand-teal">{r.date}</span>
                                        <span className="text-xs font-bold text-gray-400">•</span>
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{r.technician}</span>
                                    </div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">{resolveProjectFullName(r.projectNum)}</p>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1 italic">Borrado el: {r.deletedAt ? new Date(r.deletedAt).toLocaleString() : 'N/A'}</p>
                                </div>
                                <button 
                                    onClick={() => {
                                        setData(prev => ({
                                            ...prev,
                                            reports: [r, ...prev.reports],
                                            deletedReports: (prev.deletedReports || []).filter(dr => dr.id !== r.id)
                                        }));
                                        toast.success("Parte restaurado correctamente");
                                    }}
                                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2"
                                >
                                    <RefreshCwIcon className="w-4 h-4" /> Restaurar
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {tab === 'map' && (
            <div className="bg-white dark:bg-brand-panel rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[600px] transition-colors duration-300 p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <h3 className="text-gray-900 dark:text-white font-black uppercase text-lg tracking-widest flex items-center gap-2">
                        <MapIcon className="w-6 h-6 text-brand-teal" /> Mapa de Obras Activas
                    </h3>
                    <div className="relative w-full md:w-72">
                        <input 
                            type="text" 
                            placeholder="Buscar obra en mapa..." 
                            value={mapSearchTerm} 
                            onChange={(e) => setMapSearchTerm(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none"
                        />
                        <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {(() => {
                            const filtered = data.projectsDetailed.filter(p => 
                                !p.isFinished && 
                                p.location && 
                                (p.name.toLowerCase().includes(mapSearchTerm.toLowerCase()) || 
                                 p.id.toLowerCase().includes(mapSearchTerm.toLowerCase()) ||
                                 (p.client && p.client.toLowerCase().includes(mapSearchTerm.toLowerCase())))
                            );
                            
                            if (filtered.length === 0) {
                                return <p className="text-gray-500 text-sm">No se han encontrado obras con esos criterios.</p>;
                            }
                            
                            return filtered.map(p => (
                                <div 
                                    key={p.id} 
                                    onClick={() => setSelectedProjectId(p.id)}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${selectedProjectId === p.id ? 'bg-brand-teal/10 border-brand-teal shadow-md' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}
                                >
                                    <h4 className={`font-bold ${selectedProjectId === p.id ? 'text-brand-teal' : 'text-gray-900 dark:text-white'}`}>{p.name}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{p.location}</p>
                                </div>
                            ));
                        })()}
                    </div>
                    <div className="md:col-span-2">
                        {(() => {
                            const filtered = data.projectsDetailed.filter(p => 
                                !p.isFinished && 
                                p.location && 
                                (p.name.toLowerCase().includes(mapSearchTerm.toLowerCase()) || 
                                 p.id.toLowerCase().includes(mapSearchTerm.toLowerCase()) ||
                                 (p.client && p.client.toLowerCase().includes(mapSearchTerm.toLowerCase())))
                            );
                            
                            if (filtered.length > 0) {
                                return (
                                    <MapComponent 
                                        projects={filtered} 
                                        selectedProjectId={selectedProjectId}
                                        onSelectProject={setSelectedProjectId}
                                    />
                                );
                            }
                            
                            return (
                                <div className="w-full h-[600px] bg-gray-100 dark:bg-gray-800 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700">
                                    <p className="text-gray-500">Sin resultados para mostrar en el mapa</p>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>
        )}
        
        {tab === 'daily' && (
             <DailyOrganization 
                data={data.dailyOrg} 
                onUpdate={handleDailyOrgUpdate}
                onChangeDate={handleDailyOrgDateChange}
                isReadOnly={false}
             />
        )}

        {tab === 'settings' && (
            <div className="space-y-6">
                <div className="bg-white dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <LockIcon className="w-5 h-5 text-brand-teal" /> Seguridad y Configuración
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Contraseña Administrador</label>
                            <input type="text" value={newAdminPwd} onChange={e => setNewAdminPwd(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-gray-900 dark:text-white focus:border-brand-teal outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Configuración Firebase (JSON)</label>
                            <textarea rows={4} value={firebaseConfigInput} onChange={e => setFirebaseConfigInput(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-xs font-mono text-gray-900 dark:text-white focus:border-brand-teal outline-none" placeholder='{"apiKey": "...", ...}' />
                        </div>
                    </div>
                    <button onClick={savePasswords} className="mt-4 bg-brand-teal text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-teal-600 transition-colors">
                        Guardar Configuración
                    </button>
                    <button onClick={testFirebaseConnection} disabled={isTestingConnection} className="mt-4 ml-4 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-6 py-2 rounded-lg font-bold shadow-md hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
                        {isTestingConnection ? 'Probando...' : 'Probar Conexión'}
                    </button>
                    {pwdMsg && <p className="mt-2 text-green-600 font-bold text-sm animate-pulse">{pwdMsg}</p>}
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-xl">
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-4 flex items-center gap-2">
                        <ShieldCheckIcon className="w-5 h-5" /> Recomendaciones de Seguridad
                    </h3>
                    <div className="space-y-3 text-sm text-blue-700 dark:text-blue-400">
                        <p>Para garantizar que sus datos estén 100% seguros, le recomendamos seguir estos pasos en su consola de Firebase:</p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li><strong>Reglas de Seguridad:</strong> Configure reglas que solo permitan leer/escribir si el usuario está autenticado.</li>
                            <li><strong>Backups Externos:</strong> Use el botón "Descargar JSON" semanalmente y guarde el archivo en un lugar seguro fuera de la nube.</li>
                            <li><strong>Papelera:</strong> Los partes borrados se guardan en la pestaña "Papelera" de Reportes antes de eliminarse definitivamente.</li>
                            <li><strong>Imágenes:</strong> Las fotos de los tickets se suben a Google Drive para no saturar la base de datos y tener un respaldo visual independiente.</li>
                        </ul>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <CloudIcon className="w-5 h-5 text-brand-teal" /> Copias de Seguridad (Backups)
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="space-y-4">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Opciones de Nube</p>
                            <div className="flex flex-wrap gap-3">
                                <button onClick={onManualBackup} className="bg-brand-teal hover:bg-teal-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2">
                                    <PlusIcon className="w-4 h-4" /> Crear Backup Nube
                                </button>
                                <button onClick={fetchBackups} className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 border border-gray-200 dark:border-gray-700">
                                    <DownloadIcon className="w-4 h-4" /> Ver Historial Nube
                                </button>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Opciones Locales (Archivo)</p>
                            <div className="flex flex-wrap gap-3">
                                <button onClick={handleExportFullJSON} disabled={isExporting} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2">
                                    <DownloadIcon className="w-4 h-4" /> {isExporting ? 'Exportando...' : 'Descargar JSON'}
                                </button>
                                <label className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer">
                                    <UploadIcon className="w-4 h-4" /> {isImporting ? 'Importando...' : 'Importar JSON'}
                                    <input type="file" ref={fileInputRef} onChange={handleImportFullJSON} accept=".json" className="hidden" />
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${data.reports.length > 0 ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
                                <div>
                                    <p className="text-sm font-bold text-gray-800 dark:text-white">Estado de la Base de Datos</p>
                                    <p className="text-xs text-gray-500">{data.reports.length} partes registrados • {data.technicians.length} técnicos</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Última Sincronización</p>
                                <p className="text-xs font-bold text-brand-teal">{new Date().toLocaleTimeString()}</p>
                            </div>
                        </div>
                    </div>

                    {isLoadingBackups && <p className="text-sm text-gray-500 animate-pulse flex items-center gap-2"><ClockIcon className="w-4 h-4" /> Cargando copias de seguridad de la nube...</p>}

                    {!isLoadingBackups && backupsList.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Copias disponibles en Firestore</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                                {backupsList.map((bk) => (
                                    <div key={bk.id} className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-brand-teal/30 transition-all">
                                        <div>
                                            <p className="font-bold text-sm text-gray-800 dark:text-white">{bk.id}</p>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{(bk.technicians || []).length} técnicos • {(bk.projectsDetailed || []).length} obras</p>
                                        </div>
                                        <button onClick={() => restoreBackup(bk.id)} className="text-[10px] font-black uppercase tracking-widest bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/50 px-4 py-2 rounded-lg hover:bg-red-600 hover:text-white transition-all">
                                            Restaurar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default AdminPanel;