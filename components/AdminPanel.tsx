/// <reference types="vite/client" />
import React, { useState, useRef, useEffect, useMemo, useTransition } from 'react';
import { GoogleMap, Marker, useJsApiLoader, InfoWindow } from '@react-google-maps/api';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawPdfHeaderLogo } from '../utils/pdfLogo';
import { AppData, TechUser, WorkReport, ProjectData, Budget, ProjectAttachment } from '../App';
import { TrashIcon, PlusIcon, DownloadIcon, UserIcon, TruckIcon, FileTextIcon, FilterIcon, EditIcon, SaveIcon, XIcon, LockIcon, UploadIcon, CloudIcon, CalendarIcon, ChartPieIcon, ClockIcon, EyeIcon, AlertIcon, ChevronDownIcon, ChevronRightIcon, BriefcaseIcon, SearchIcon, CheckCircleIcon, XCircleIcon, MapIcon, RefreshCwIcon, ShieldCheckIcon, ImageIcon } from './icons';
import DailyOrganization, { DailyOrgData } from './DailyOrganization';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, googleLogout, isGoogleConnected, verifyGmailScope } from '../utils/authService';
import { sendFinishedProjectEmail, DEFAULT_COMPLETION_RECIPIENT, generateFinishedProjectPDF } from '../utils/gmailService';

interface AdminPanelProps {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  onGoToVacations?: () => void;
  onDeleteReport: (id: string) => void;
  onManualBackup?: () => void;
  onUpdateReport: (report: WorkReport, shouldRedirect: boolean) => Promise<void>;
  onEditReport?: (report: WorkReport) => void;
  onSaveProject: (project: ProjectData) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  onRecoverProjects?: () => Promise<void>;
  onRestoreFullBackup?: (backupId: string) => Promise<void>;
  onDailyOrgUpdate?: (newOrg: DailyOrgData) => void | Promise<void>;
  onDailyOrgDateChange?: (newDate: string) => void;
  onUpdateTechnicians?: (newTechs: TechUser[]) => Promise<void>;
  onUpdateVehicles?: (newVehicles: string[]) => Promise<void>;
}

// Helpers for calculations
const calculateDuration = (start: string, end: string): number => {
    if (!start || !end || !start.includes(':') || !end.includes(':')) return 0;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    const diff = (h2 + m2/60) - (h1 + m1/60);
    return diff > 0 ? diff : 0;
};

const formatDateToSpanish = (dateStr: string) => {
    if (!dateStr || !dateStr.includes('-')) return dateStr || '';
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
      
      if (projectsWithLocation.length === 0) {
        setMarkers([]);
        return;
      }

      let processedCount = 0;

      const checkCompletion = () => {
        processedCount++;
        if (processedCount === projectsWithLocation.length) {
          setMarkers([...newMarkers]);
        }
      };

      const parseCoordinates = (loc: string): { lat: number; lng: number } | null => {
        if (!loc) return null;
        
        // 1. Match @latitude,longitude
        const atMatch = loc.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (atMatch) {
          const lat = parseFloat(atMatch[1]);
          const lng = parseFloat(atMatch[2]);
          if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
        }
        
        // 2. Match q=latitude,longitude or ll=latitude,longitude
        const qMatch = loc.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (qMatch) {
          const lat = parseFloat(qMatch[1]);
          const lng = parseFloat(qMatch[2]);
          if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
        }
        
        // 3. Match pure "latitude,longitude"
        const simpleMatch = loc.match(/^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/);
        if (simpleMatch) {
          const lat = parseFloat(simpleMatch[1]);
          const lng = parseFloat(simpleMatch[2]);
          if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
        }

        return null;
      };

      projectsWithLocation.forEach(p => {
        const directCoords = parseCoordinates(p.location);
        if (directCoords) {
          const pos = new window.google.maps.LatLng(directCoords.lat, directCoords.lng);
          newMarkers.push({ id: p.id, position: pos, name: p.name });
          checkCompletion();
        } else if (p.location.startsWith('http://') || p.location.startsWith('https://') || p.location.startsWith('www.')) {
          console.warn(`No se pudieron extraer coordenadas del enlace: ${p.location}`);
          checkCompletion();
        } else {
          geocoder.geocode({ address: p.location }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
              newMarkers.push({ id: p.id, position: results[0].geometry.location, name: p.name });
            } else {
              console.warn(`Geocode failed for ${p.location}: ${status}`);
            }
            checkCompletion();
          });
        }
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
      {markers.map((m, mIdx) => (
        <Marker 
          key={`${m.id}-${mIdx}`} 
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

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  data, 
  setData, 
  onGoToVacations, 
  onDeleteReport, 
  onManualBackup, 
  onUpdateReport, 
  onEditReport, 
  onSaveProject, 
  onDeleteProject, 
  onRecoverProjects, 
  onRestoreFullBackup, 
  onDailyOrgUpdate, 
  onDailyOrgDateChange,
  onUpdateTechnicians,
  onUpdateVehicles
}) => {
  const [isPending, startTransition] = useTransition();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [expandedTechId, setExpandedTechId] = useState<string | null>(null);
  const [expandedTechMonths, setExpandedTechMonths] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<'techs' | 'projects' | 'budgets' | 'reports' | 'settings' | 'daily' | 'vehicles' | 'expenses' | 'map' | 'overtime'>('reports');
  const [reportViewMode, setReportViewMode] = useState<'list' | 'by_project' | 'by_hours' | 'overtime' | 'tech_overtime' | 'trash'>('list');
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [showValidatedOvertime, setShowValidatedOvertime] = useState(false);
  const [showPendingOvertime, setShowPendingOvertime] = useState(true);
  const [selectedMonthForReport, setSelectedMonthForReport] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newTechPwd, setNewTechPwd] = useState('');
  const [editingTechId, setEditingTechId] = useState<string | null>(null);
  const [editTechName, setEditTechName] = useState('');
  const [editTechPwd, setEditTechPwd] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState(''); 
  const [editPwdValue, setEditPwdValue] = useState('');
  const [newAdminPwd, setNewAdminPwd] = useState(data.adminPassword || 'admin');
  const [pwdMsg, setPwdMsg] = useState('');
  const [firebaseConfigInput, setFirebaseConfigInput] = useState('');
  const [filterTech, setFilterTech] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  
  // Backups State
  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estado para controlar qué semanas están expandidas
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});

  const [selectedImage, setSelectedImage] = useState<{data: string, type: string, name?: string} | null>(null);
  
  // Estados para Gestión de Obras
  const [projectForm, setProjectForm] = useState<ProjectData>({
    id: '', name: '', client: '', budgetNum: '', valuation: 'POR HORAS',
    responsibleTech: '', startDate: '', isFinished: false, isInvoiced: false,
    invoiceNum: '',
    hasWarning: false, warningDate: '', notes: '', location: '', attachments: []
  });
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [idMode, setIdMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [projectFilterTab, setProjectFilterTab] = useState<'all' | 'active' | 'warning' | 'finished' | 'invoiced'>('all');
  
  // Estado para las secciones desplegables de Obras
  const [expandedProjectSections, setExpandedProjectSections] = useState<Record<string, boolean>>({
      green: true, orange: true, red: true, blue: true, finished: true, invoiced: true
  });

  const archiveRef = useRef<HTMLDivElement>(null);

  // Estados para Presupuestos
  const [budgetForm, setBudgetForm] = useState<Budget>({
    id: '', budgetNum: '', name: '', client: '', deliveryDate: '',
    excelName: '', hasFolderData: false, isFinished: false, isAccepted: false, isRejected: false, comments: ''
  });
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetSearchTerm, setBudgetSearchTerm] = useState('');
  const [budgetFilterTab, setBudgetFilterTab] = useState<'all' | 'active' | 'finished' | 'accepted' | 'rejected'>('all');
  const [expandedBudgetSections, setExpandedBudgetSections] = useState<Record<string, boolean>>({
    active: true,
    finished: true,
    accepted: true,
    rejected: true
  });
  const [mapSearchTerm, setMapSearchTerm] = useState('');

  // Google Workspace / Gmail OAuth State
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [hasGmailPermission, setHasGmailPermission] = useState<boolean>(false);
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false);

  // Completion Email Modal State
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionModalProject, setCompletionModalProject] = useState<ProjectData | null>(null);
  const [completionRecipient, setCompletionRecipient] = useState<string>(DEFAULT_COMPLETION_RECIPIENT);
  const [completionCustomNotes, setCompletionCustomNotes] = useState<string>('');
  const [isSendingCompletionEmail, setIsSendingCompletionEmail] = useState(false);
  const [isResendMode, setIsResendMode] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      async (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        if (token) {
          const hasScope = await verifyGmailScope(token);
          setHasGmailPermission(hasScope);
        } else {
          setHasGmailPermission(false);
        }
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        setHasGmailPermission(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setIsGoogleLoggingIn(true);
    try {
      const res = await googleSignIn(true);
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        const hasScope = await verifyGmailScope(res.accessToken);
        setHasGmailPermission(hasScope);
        if (hasScope) {
          toast.success(`Conectado a Gmail como ${res.user.email} con permisos de envío`);
        } else {
          toast.warning(`Conectado como ${res.user.email}. Por favor asegúrate de conceder permisos de envío en Google.`);
        }
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        toast.info("Ventana de inicio de sesión cerrada por el usuario.");
      } else {
        console.error(err);
        toast.error(`Error al conectar con Google: ${err.message || 'Operación cancelada'}`);
      }
    } finally {
      setIsGoogleLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await googleLogout();
      setGoogleUser(null);
      setGoogleToken(null);
      setHasGmailPermission(false);
      toast.success("Desconectado de Google");
    } catch (err: any) {
      toast.error("Error al desconectar de Google");
    }
  };

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

  const resolveProjectClient = (num: string) => {
      const detailed = (data.projectsDetailed || []).find(p => p.id === num);
      return detailed?.client || '';
  };

  const viewProjectHistory = (projectId: string) => {
      setFilterProject(projectId);
      setFilterTech('');
      setFilterClient('');
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
        if (r.status !== 'approved' || !r.startDate) return false;
        
        const [y, m, d] = r.startDate.split('-').map(Number);
        const start = new Date(y, m-1, d);
        
        const diffTime = start.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays > 0 && diffDays <= 4; 
    }).sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
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
          (p.client && p.client.toLowerCase().includes(lowerTerm)) ||
          (p.responsibleTech && p.responsibleTech.toLowerCase().includes(lowerTerm)) ||
          (p.invoiceNum && p.invoiceNum.toLowerCase().includes(lowerTerm)) ||
          (p.budgetNum && p.budgetNum.toLowerCase().includes(lowerTerm)) ||
          (p.location && p.location.toLowerCase().includes(lowerTerm)) ||
          (p.notes && p.notes.toLowerCase().includes(lowerTerm))
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
          (groups as any)[key].sort((a: ProjectData, b: ProjectData) => (b.id || '').localeCompare(a.id || ''));
      });

      return groups;
  }, [data.projectsDetailed, projectSearchTerm]);

  const toggleProjectSection = (section: string) => {
      setExpandedProjectSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleBudgetSection = (section: string) => {
      setExpandedBudgetSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const categorizedBudgets = useMemo(() => {
      const groups = {
          active: [] as Budget[],
          finished: [] as Budget[],
          accepted: [] as Budget[],
          rejected: [] as Budget[]
      };

      const lowerTerm = budgetSearchTerm.toLowerCase();
      const filtered = (data.budgets || []).filter(b => 
          (b.name && b.name.toLowerCase().includes(lowerTerm)) ||
          (b.client && b.client.toLowerCase().includes(lowerTerm)) ||
          (b.budgetNum && b.budgetNum.toLowerCase().includes(lowerTerm)) ||
          (b.excelName && b.excelName.toLowerCase().includes(lowerTerm)) ||
          (b.comments && b.comments.toLowerCase().includes(lowerTerm))
      );

      filtered.forEach(b => {
          if (b.isRejected) {
              groups.rejected.push(b);
          } else if (b.isAccepted) {
              groups.accepted.push(b);
          } else if (b.isFinished) {
              groups.finished.push(b);
          } else {
              groups.active.push(b);
          }
      });

      // Ordenar cada grupo cronológicamente inverso (más nuevos primero)
      Object.keys(groups).forEach(key => {
          (groups as any)[key].sort((a: Budget, b: Budget) => (b.id || '').localeCompare(a.id || ''));
      });

      return groups;
  }, [data.budgets, budgetSearchTerm]);

  const sortedBudgets = useMemo(() => {
      let result = [...(data.budgets || [])];

      if (budgetSearchTerm) {
          const lowerTerm = budgetSearchTerm.toLowerCase();
          result = result.filter(b => 
              (b.name && b.name.toLowerCase().includes(lowerTerm)) ||
              (b.client && b.client.toLowerCase().includes(lowerTerm)) ||
              (b.budgetNum && b.budgetNum.toLowerCase().includes(lowerTerm)) ||
              (b.excelName && b.excelName.toLowerCase().includes(lowerTerm)) ||
              (b.comments && b.comments.toLowerCase().includes(lowerTerm))
          );
      }

      return result.sort((a, b) => {
          if (a.isFinished !== b.isFinished) return a.isFinished ? 1 : -1;
          return (b.id || '').localeCompare(a.id || '');
      });
  }, [data.budgets, budgetSearchTerm]);

  const toggleBudgetAccepted = async (b: Budget) => {
      const newAccepted = !b.isAccepted;
      const updated: Budget = {
          ...b,
          isAccepted: newAccepted,
          isRejected: newAccepted ? false : b.isRejected
      };
      setData(prev => ({
          ...prev,
          budgets: (prev.budgets || []).map(item => item.id === b.id ? updated : item)
      }));
      if (newAccepted) {
          const newProjectId = generateNextProjectId();
          const newProject: ProjectData = {
              id: newProjectId, name: b.name, client: b.client,
              budgetNum: b.budgetNum, valuation: 'PRESUPUESTO', responsibleTech: '',
              startDate: new Date().toISOString().split('T')[0], isFinished: false, isInvoiced: false,
              hasWarning: false, warningDate: '', notes: `Generado desde presupuesto: ${b.comments || ''}`
          };
          await onSaveProject(newProject);
          toast.success(`✅ Presupuesto aceptado y Obra creada con ID: ${newProjectId}`);
      } else {
          toast.success("Presupuesto marcado como no aceptado");
      }
  };

  const toggleBudgetRejected = (b: Budget) => {
      const newRejected = !b.isRejected;
      const updated: Budget = {
          ...b,
          isRejected: newRejected,
          isAccepted: newRejected ? false : b.isAccepted
      };
      setData(prev => ({
          ...prev,
          budgets: (prev.budgets || []).map(item => item.id === b.id ? updated : item)
      }));
      toast.success(newRejected ? "Presupuesto marcado como Rechazado" : "Presupuesto desmarcado de Rechazado");
  };

  const toggleBudgetFinished = (b: Budget) => {
      const newFinished = !b.isFinished;
      const updated: Budget = {
          ...b,
          isFinished: newFinished
      };
      setData(prev => ({
          ...prev,
          budgets: (prev.budgets || []).map(item => item.id === b.id ? updated : item)
      }));
      toast.success(newFinished ? "Presupuesto marcado como Terminado" : "Presupuesto desmarcado de Terminado");
  };

  const handleAdd = async (type: 'techs' | 'vehicles') => {
    const trimmedName = newItemName.trim();
    if (!trimmedName) return;

    if (type === 'techs') {
      const existing = (data.technicians || []).some(
        t => t.name.trim().toUpperCase() === trimmedName.toUpperCase()
      );
      if (existing) {
        toast.error(`Ya existe un técnico con el nombre "${trimmedName}".`);
        return;
      }
      const newTech: TechUser = {
        id: Date.now().toString(),
        name: trimmedName,
        password: newTechPwd.trim() || '1234',
        active: true
      };
      const updatedTechs = [...(data.technicians || []), newTech];
      if (onUpdateTechnicians) {
        await onUpdateTechnicians(updatedTechs);
      } else {
        setData(prev => ({ ...prev, technicians: updatedTechs }));
      }
      toast.success(`Técnico ${newTech.name} añadido`);
    } else if (type === 'vehicles') {
      const existing = (data.vehicles || []).some(
        v => v.trim().toUpperCase() === trimmedName.toUpperCase()
      );
      if (existing) {
        toast.error(`Ya existe un vehículo con el nombre "${trimmedName}".`);
        return;
      }
      const updatedVehicles = [...(data.vehicles || []), trimmedName];
      if (onUpdateVehicles) {
        await onUpdateVehicles(updatedVehicles);
      } else {
        setData(prev => ({ ...prev, vehicles: updatedVehicles }));
      }
      toast.success(`Vehículo ${trimmedName} añadido`);
    }

    setNewItemName('');
    setNewTechPwd('');
  };

  const handleQuickInvoice = async (p: ProjectData) => {
      if (p.isInvoiced) {
          const action = window.prompt(
              `Obra ${p.id} ya está facturada con Factura Nº "${p.invoiceNum || ''}".\n\n- Escribe un nuevo número de factura para actualizarlo.\n- Escribe "BORRAR" para desmarcarla como facturada.\n- O pulsa Cancelar para salir sin cambios:`,
              p.invoiceNum || ''
          );
          if (action === null) return;
          if (action.trim().toUpperCase() === 'BORRAR' || action.trim() === '') {
              await onSaveProject({ ...p, isInvoiced: false, invoiceNum: '' });
              toast.success(`Obra ${p.id} desmarcada de facturada.`);
          } else {
              await onSaveProject({ ...p, isInvoiced: true, invoiceNum: action.trim() });
              toast.success(`Factura actualizada para la obra ${p.id}: ${action.trim()}`);
          }
      } else {
          const invNum = window.prompt(
              `Introduce el NÚMERO DE FACTURA obligatorio para dar por facturada la obra ${p.id} (${p.name}):`,
              p.invoiceNum || ''
          );
          if (invNum === null) return;
          if (!invNum.trim()) {
              toast.error("⚠️ Para dar la obra por facturada es OBLIGATORIO indicar el Número de Factura.");
              return;
          }
          await onSaveProject({ ...p, isInvoiced: true, invoiceNum: invNum.trim(), isFinished: true });
          toast.success(`✅ Obra ${p.id} marcada como FACTURADA (Factura: ${invNum.trim()})`);
      }
  };

  const handleSaveProject = () => {
      if (!projectForm.name || !projectForm.client) { toast.error("Faltan datos obligatorios (Nombre y Cliente)"); return; }
      if (!projectForm.id) { toast.error("El ID de obra es obligatorio."); return; }

      if (projectForm.isInvoiced && !projectForm.invoiceNum?.trim()) {
          toast.error("⚠️ Para dar por facturada la obra es OBLIGATORIO indicar el Número de Factura.");
          return;
      }

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

      const existingProject = data.projectsDetailed.find(p => p.id === finalProject.id);
      const isNewlyFinished = finalProject.isFinished && (!existingProject || !existingProject.isFinished);

      if (isNewlyFinished) {
          setCompletionModalProject(finalProject);
          setCompletionRecipient(DEFAULT_COMPLETION_RECIPIENT);
          setCompletionCustomNotes('');
          setIsResendMode(false);
          setShowCompletionModal(true);
          return;
      }

      setIsSavingProject(true);
      setTimeout(async () => {
          try {
              await onSaveProject(finalProject);
              resetProjectForm();
          } finally {
              setIsSavingProject(false);
          }
      }, 10);
  };

  const handleToggleFinished = (p: ProjectData) => {
      setCompletionModalProject(p);
      setCompletionRecipient(DEFAULT_COMPLETION_RECIPIENT);
      setCompletionCustomNotes('');
      if (p.isFinished) {
          setIsResendMode(true);
          setShowCompletionModal(true);
      } else {
          setIsResendMode(false);
          setShowCompletionModal(true);
      }
  };

  const handleConfirmSendCompletion = async () => {
      if (!completionModalProject) return;
      setIsSendingCompletionEmail(true);

      try {
          let token = googleToken;
          let hasScope = token ? await verifyGmailScope(token) : false;

          // Si no hay token o no tiene permisos de envío de Gmail, solicitar consentimiento explícito
          if (!token || !hasScope) {
              toast.info("Solicitando permisos de Gmail a Google para poder enviar el correo...", { duration: 4000 });
              const authRes = await googleSignIn(true);
              if (!authRes?.accessToken) {
                  toast.error("No se pudo obtener la autorización de Google.");
                  setIsSendingCompletionEmail(false);
                  return;
              }
              token = authRes.accessToken;
              setGoogleUser(authRes.user);
              setGoogleToken(token);
              hasScope = await verifyGmailScope(token);
              setHasGmailPermission(hasScope);
          }

          const projectReports = data.reports.filter(r => r.projectNum === completionModalProject.id);

          toast.loading(`Generando informe PDF y enviando correo a ${completionRecipient}...`, { id: 'send-completion' });

          try {
              await sendFinishedProjectEmail({
                  project: completionModalProject,
                  reports: projectReports,
                  recipientEmail: completionRecipient,
                  additionalNotes: completionCustomNotes,
                  accessToken: token
              });
          } catch (sendErr: any) {
              const isScopeError = sendErr?.isScopeError || sendErr?.message?.includes('insufficient') || sendErr?.message?.includes('scope') || sendErr?.status === 403;
              if (isScopeError) {
                  toast.loading("Actualizando permisos de Gmail con Google...", { id: 'send-completion' });
                  const reAuth = await googleSignIn(true);
                  if (reAuth?.accessToken) {
                      token = reAuth.accessToken;
                      setGoogleUser(reAuth.user);
                      setGoogleToken(token);
                      setHasGmailPermission(true);
                      await sendFinishedProjectEmail({
                          project: completionModalProject,
                          reports: projectReports,
                          recipientEmail: completionRecipient,
                          additionalNotes: completionCustomNotes,
                          accessToken: token
                      });
                  } else {
                      throw sendErr;
                  }
              } else {
                  throw sendErr;
              }
          }

          const updatedProject: ProjectData = { ...completionModalProject, isFinished: true };
          await onSaveProject(updatedProject);

          toast.success(`✅ Correo enviado a ${completionRecipient} con el PDF de partes y albaranes. Obra marcada como terminada.`, { id: 'send-completion', duration: 5000 });
          setShowCompletionModal(false);
          if (isEditingProject && projectForm.id === completionModalProject.id) {
              resetProjectForm();
          }
      } catch (err: any) {
          if (err?.code === 'auth/popup-closed-by-user') {
              toast.dismiss('send-completion');
              toast.info("Ventana de Google cerrada. Pulsa de nuevo para autorizar el envío cuando desees.");
          } else {
              console.error("Error al enviar email de finalización:", err);
              toast.error(`Error al enviar el correo: ${err.message || 'Error de conexión'}`, { id: 'send-completion', duration: 6000 });
          }
      } finally {
          setIsSendingCompletionEmail(false);
      }
  };

  const handleFinishWithoutEmail = async () => {
      if (!completionModalProject) return;
      try {
          const updatedProject: ProjectData = { ...completionModalProject, isFinished: true };
          await onSaveProject(updatedProject);
          toast.success(`Obra ${updatedProject.id} guardada como TERMINADA (sin enviar correo).`);
          setShowCompletionModal(false);
          if (isEditingProject && projectForm.id === completionModalProject.id) {
              resetProjectForm();
          }
      } catch (err: any) {
          toast.error("Error al guardar la obra.");
      }
  };

  const handleReactivateProject = async () => {
      if (!completionModalProject) return;
      try {
          const updatedProject: ProjectData = { ...completionModalProject, isFinished: false };
          await onSaveProject(updatedProject);
          toast.success(`Obra ${updatedProject.id} reactivada (marcada como activa).`);
          setShowCompletionModal(false);
          if (isEditingProject && projectForm.id === completionModalProject.id) {
              setProjectForm(prev => ({ ...prev, isFinished: false }));
          }
      } catch (err: any) {
          toast.error("Error al reactivar la obra.");
      }
  };

  const handleSaveBudget = () => {
      if (!budgetForm.name || !budgetForm.client) { toast.error("Faltan datos obligatorios"); return; }
      const finalBudget = { ...budgetForm, id: budgetForm.id || Date.now().toString() };

      setIsSavingBudget(true);
      setTimeout(async () => {
          try {
              setData(prev => {
                  let updatedBudgets = [...(prev.budgets || [])];
                  const idx = updatedBudgets.findIndex(b => b.id === finalBudget.id);
                  if (idx >= 0) updatedBudgets[idx] = finalBudget;
                  else updatedBudgets = [finalBudget, ...updatedBudgets];
                  return { ...prev, budgets: updatedBudgets };
              });

              if (finalBudget.isAccepted) {
                  const newProjectId = generateNextProjectId();
                  const newProject: ProjectData = {
                      id: newProjectId, name: finalBudget.name, client: finalBudget.client,
                      budgetNum: finalBudget.budgetNum, valuation: 'PRESUPUESTO', responsibleTech: '',
                      startDate: new Date().toISOString().split('T')[0], isFinished: false, isInvoiced: false,
                      hasWarning: false, warningDate: '', notes: `Generado desde presupuesto: ${finalBudget.comments}`
                  };
                  await onSaveProject(newProject);
                  toast.success(`✅ Obra creada automáticamente con ID: ${newProjectId}`);
              }
              resetBudgetForm();
          } finally {
              setIsSavingBudget(false);
          }
      }, 10);
  };

  const editBudget = (b: Budget) => { setBudgetForm(b); setIsEditingBudget(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const deleteBudget = (id: string) => { if (!window.confirm("¿Eliminar presupuesto?")) return; setData(prev => ({ ...prev, budgets: prev.budgets.filter(b => b.id !== id) })); };
  const resetBudgetForm = () => { setBudgetForm({ id: '', budgetNum: '', name: '', client: '', deliveryDate: '', excelName: '', hasFolderData: false, isFinished: false, isAccepted: false, isRejected: false, comments: '' }); setIsEditingBudget(false); };

  const editProject = (p: ProjectData) => { setProjectForm({ invoiceNum: '', ...p }); setIsEditingProject(true); setIdMode('AUTO'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const deleteProject = (id: string) => { 
      onDeleteProject(id);
  };
  const resetProjectForm = () => { setProjectForm({ id: '', name: '', client: '', budgetNum: '', valuation: 'POR HORAS', responsibleTech: '', startDate: '', isFinished: false, isInvoiced: false, invoiceNum: '', hasWarning: false, warningDate: '', notes: '', location: '', attachments: [] }); setIsEditingProject(false); setIdMode('AUTO'); };
  
  const handleProjectFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB limit per file

    Array.from(files).forEach((file: File) => {
      if (file.size > MAX_FILE_SIZE) {
          toast.error(`El archivo ${file.name} es demasiado grande. Máximo 2MB.`);
          return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const newAttachment: ProjectAttachment = {
          name: file.name,
          data: base64,
          type: file.type
        };
        setProjectForm(prev => ({
          ...prev,
          attachments: [...(prev.attachments || []), newAttachment]
        }));
      };
      reader.onerror = () => {
          toast.error(`Error al leer el archivo ${file.name}`);
      };
      reader.readAsDataURL(file);
    });
    // Limpiar el input para permitir subir el mismo archivo si se borra
    e.target.value = '';
  };

  const removeProjectAttachment = (index: number) => {
    setProjectForm(prev => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, i) => i !== index)
    }));
  };

  const generateProjectPDF = (p: ProjectData) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Top accent bar
    doc.setFillColor(0, 121, 123); // Teal
    doc.rect(0, 0, 210, 3.5, 'F');

    // Logo in top-left corner
    drawPdfHeaderLogo(doc, { isLandscape: false, x: 14, y: 7, width: 48, height: 17.14 });
    
    // Right-aligned header metadata
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.text(`FICHA DE OBRA: ${p.id}`, 196, 14, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generado el: ${new Date().toLocaleString('es-ES')}`, 196, 19, { align: 'right' });

    doc.setFont('helvetica', 'oblique');
    doc.setFontSize(8.5);
    doc.setTextColor(75, 85, 99);
    doc.text(`Cliente: ${p.client || '-'}  |  Estado: ${p.isFinished ? 'TERMINADA' : 'ACTIVA'}`, 196, 24, { align: 'right' });

    // Decorative divider line
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.4);
    doc.line(14, 28, 196, 28);

    const tableData = [
      ['ID OBRA', p.id],
      ['NOMBRE', p.name],
      ['CLIENTE', p.client],
      ['TÉCNICO RESPONSABLE', p.responsibleTech || 'Sin asignar'],
      ['VALORACIÓN', p.valuation],
      ['Nº PRESUPUESTO', p.budgetNum || '-'],
      ['FECHA INICIO', formatDateToSpanish(p.startDate)],
      ['UBICACIÓN', p.location || '-'],
      ['ESTADO', p.isFinished ? 'TERMINADA' : 'ACTIVA'],
      ['FACTURADA', p.isInvoiced ? `SÍ ${p.invoiceNum ? `(Nº Factura: ${p.invoiceNum})` : ''}` : 'NO'],
    ];

    autoTable(doc, {
      startY: 33,
      head: [['Campo', 'Información']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [0, 121, 123] }, // brand-teal
      styles: { fontSize: 9.5, cellPadding: 3.5 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 55, textColor: [31, 41, 55] },
        1: { cellWidth: 'auto', textColor: [55, 65, 81] }
      }
    });

    if (p.notes) {
      const finalY = (doc as any).lastAutoTable?.finalY || 140;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(0, 121, 123);
      doc.text('NOTAS / OBSERVACIONES:', 14, finalY + 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      const splitNotes = doc.splitTextToSize(p.notes, 182);
      doc.text(splitNotes, 14, finalY + 18);
    }

    doc.save(`Obra_${p.id}.pdf`);
    toast.success("PDF generado correctamente con membrete oficial");
  };

  const handleDeleteTech = async (tech: TechUser) => {
    if (!window.confirm(`¿Eliminar al técnico "${tech.name}"?`)) return;
    const updated = (data.technicians || []).filter(t => t.id !== tech.id);
    if (onUpdateTechnicians) {
      await onUpdateTechnicians(updated);
    } else {
      setData(prev => ({ ...prev, technicians: updated }));
    }
    toast.success(`Técnico ${tech.name} eliminado`);
  };

  const startEditingTech = (tech: TechUser) => {
    setEditingTechId(tech.id);
    setEditTechName(tech.name);
    setEditTechPwd(tech.password || '');
  };

  const cancelEditingTech = () => {
    setEditingTechId(null);
    setEditTechName('');
    setEditTechPwd('');
  };

  const saveEditingTech = async () => {
    if (!editTechName.trim() || !editingTechId) return;
    const originalTech = (data.technicians || []).find(t => t.id === editingTechId);
    if (!originalTech) return;

    const trimmedNewName = editTechName.trim();
    const updatedTechs = (data.technicians || []).map(t => {
      if (t.id === editingTechId) {
        return { ...t, name: trimmedNewName, password: editTechPwd.trim() || '1234' };
      }
      return t;
    });

    if (onUpdateTechnicians) {
      await onUpdateTechnicians(updatedTechs);
    } else {
      setData(prev => ({
        ...prev,
        technicians: updatedTechs,
        reports: prev.reports.map(r => r.technician === originalTech.name ? { ...r, technician: trimmedNewName } : r)
      }));
    }
    cancelEditingTech();
    toast.success("Técnico actualizado correctamente");
  };

  const handleToggleTechActive = async (tech: TechUser) => {
    const updatedTechs = (data.technicians || []).map(t => {
      if (t.id === tech.id) {
        return { ...t, active: t.active === false ? true : false };
      }
      return t;
    });
    if (onUpdateTechnicians) {
      await onUpdateTechnicians(updatedTechs);
    } else {
      setData(prev => ({ ...prev, technicians: updatedTechs }));
    }
    toast.success(`Estado de ${tech.name} actualizado`);
  };

  const handleToggleTechVacations = async (tech: TechUser) => {
    const updatedTechs = (data.technicians || []).map(t => {
      if (t.id === tech.id) {
        return { ...t, hideInVacations: !t.hideInVacations };
      }
      return t;
    });
    if (onUpdateTechnicians) {
      await onUpdateTechnicians(updatedTechs);
    } else {
      setData(prev => ({ ...prev, technicians: updatedTechs }));
    }
    toast.success(`Visibilidad en vacaciones de ${tech.name} actualizada`);
  };

  const handleDeleteVehicle = async (vehicleName: string) => {
    if (!window.confirm(`¿Eliminar vehículo "${vehicleName}"?`)) return;
    const updated = (data.vehicles || []).filter(v => v !== vehicleName);
    if (onUpdateVehicles) {
      await onUpdateVehicles(updated);
    } else {
      setData(prev => ({ ...prev, vehicles: updated }));
    }
    toast.success("Vehículo eliminado");
  };

  const startEditingVehicle = (index: number, v: string) => {
    setEditingIndex(index);
    setEditValue(v);
  };

  const cancelEditingVehicle = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  const saveEditingVehicle = async () => {
    if (!editValue.trim() || editingIndex === null) return;
    const originalValue = (data.vehicles || [])[editingIndex];
    const trimmedNew = editValue.trim();
    const updatedVehicles = [...(data.vehicles || [])];
    updatedVehicles[editingIndex] = trimmedNew;

    if (onUpdateVehicles) {
      await onUpdateVehicles(updatedVehicles);
    } else {
      setData(prev => ({
        ...prev,
        vehicles: updatedVehicles,
        reports: prev.reports.map(r => r.vehicle === originalValue ? { ...r, vehicle: trimmedNew } : r)
      }));
    }
    cancelEditingVehicle();
    toast.success("Vehículo actualizado");
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
          list.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
          
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
      if (onRestoreFullBackup) {
          await onRestoreFullBackup(backupId);
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
        if (filterTech) {
            if (filterTech === '__NO_TECH__') {
                if (r.technician && r.technician.trim()) return false;
            } else if (r.technician !== filterTech) {
                return false;
            }
        }
        if (filterClient) {
            const clientLower = filterClient.toLowerCase();
            const projectClient = resolveProjectClient(r.projectNum).toLowerCase();
            if (projectClient !== clientLower) return false;
        }
        if (filterProject) {
            const projectFilter = filterProject.toLowerCase();
            const projectFull = resolveProjectFullName(r.projectNum).toLowerCase();
            if (!projectFull.includes(projectFilter) && !r.projectNum.includes(projectFilter)) return false;
        }
        if (filterDateStart && r.date < filterDateStart) return false;
        if (filterDateEnd && r.date > filterDateEnd) return false;
        return true;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [data.reports, filterTech, filterClient, filterProject, filterDateStart, filterDateEnd, data.projectsDetailed]);

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
    return Object.entries(summary).sort((a, b) => (b[0] || '').localeCompare(a[0] || ''));
  }, [filteredReports]);

  const downloadCSV = () => {
    const maxMaterials = filteredReports.reduce((max, r) => Math.max(max, (r.materials?.length || 0)), 0);
    const materialHeaderCols: string[] = [];
    for (let i = 0; i < maxMaterials; i++) {
      materialHeaderCols.push(`Cant Mat ${i + 1}`, `Desc Mat ${i + 1}`);
    }

    const headers = ['ID', 'Fecha', 'Tecnico', 'Obra Completa', 'Num Obra', 'Entrada', 'Salida', 'Vehiculo', 'Conductor', 'Trayecto', 'Desc. Trabajo', 'Gasto Comida', 'Gasto Gasolina', 'Gasto Parking', 'Gasto Otros', 'Desc. Otros', 'Horas Extra', 'Tipo Extra', 'Horas Trabajadas', ...materialHeaderCols].join(',');
    
    let totalFood = 0;
    let totalGas = 0;
    let totalParking = 0;
    let totalOthers = 0;
    let totalOvertime = 0;
    let totalWorkedHours = 0;

    const rows = filteredReports.map(r => {
      const id = r.id || '';
      const date = r.date || '';
      const technician = r.technician || '';
      const prNum = r.projectNum || '';
      const fullName = resolveProjectFullName(prNum).replace(/"/g, '""').replace(/,/g, " -");
      
      const startTime = r.startTime || '';
      const endTime = r.endTime || '';
      const vehicle = r.vehicle || '';
      const isDriverVal = r.isDriver ? 'SI' : 'NO';
      const tripType = r.isDriver ? (r.driverTripType || '') : '';
      
      const cleanDesc = (r.description || '').replace(/(\r\n|\n|\r)/gm, " ").replace(/"/g, '""').replace(/,/g, ";");
      
      const exp = r.expenses || { food: 0, gas: 0, parking: 0, others: 0, othersDesc: '' };
      const foodVal = Number(exp.food || 0);
      const gasVal = Number(exp.gas || 0);
      const parkingVal = Number(exp.parking || 0);
      const othersVal = Number(exp.others || 0);
      const cleanOtherDesc = (exp.othersDesc || '').replace(/(\r\n|\n|\r)/gm, " ").replace(/"/g, '""').replace(/,/g, ";");
      
      const otHours = Number(r.overtimeHours || 0);
      const otType = r.overtimeType || 'NORMAL';
      
      const workedHours = calculateDuration(startTime, endTime);
      
      // Accumulate
      totalFood += foodVal;
      totalGas += gasVal;
      totalParking += parkingVal;
      totalOthers += othersVal;
      totalOvertime += otHours;
      totalWorkedHours += workedHours;

      const materialCells: string[] = [];
      for (let i = 0; i < maxMaterials; i++) {
        const m = r.materials?.[i];
        if (!m) {
          materialCells.push('""', '""');
        } else {
          const cleanQty = String(m.quantity || '').replace(/"/g, '""').replace(/,/g, ".");
          const cleanMatDesc = String(m.description || '').replace(/(\r\n|\n|\r)/gm, " ").replace(/"/g, '""').replace(/,/g, ";");
          materialCells.push(`"${cleanQty}"`, `"${cleanMatDesc}"`);
        }
      }

      return [
        id,
        date,
        technician,
        `"${fullName}"`,
        prNum,
        startTime,
        endTime,
        vehicle,
        isDriverVal,
        tripType,
        `"${cleanDesc}"`,
        foodVal,
        gasVal,
        parkingVal,
        othersVal,
        `"${cleanOtherDesc}"`,
        otHours,
        otType,
        workedHours.toFixed(2),
        ...materialCells
      ].join(',');
    });

    // Fila vacía separadora
    const emptyRow = [
      ...Array(19).fill(''),
      ...Array(maxMaterials * 2).fill('')
    ].join(',');

    // Fila Total
    const totalRow = [
      'Total', // col 1 (ID)
      '', '', '', '', '', '', '', '', '', '', // cols 2-11 vacíos
      totalFood.toFixed(2), // col 12
      totalGas.toFixed(2), // col 13
      totalParking.toFixed(2), // col 14
      totalOthers.toFixed(2), // col 15
      '', // col 16
      '', // col 17 (vaciada en la fila Total, para cumplir con el ejemplo visual del usuario)
      '', // col 18
      totalWorkedHours.toFixed(2), // col 19 (Horas Trabajadas)
      ...Array(maxMaterials * 2).fill('')
    ].join(',');

    // Fila TOTAL HORAS
    const totalHoursVal = totalWorkedHours + totalOvertime;
    const hoursRow = [
      ...Array(16).fill(''),
      'TOTAL HORAS',
      '',
      totalHoursVal.toFixed(2),
      ...Array(maxMaterials * 2).fill('')
    ].join(',');

    // Fila TOTAL GASTOS
    const totalExpensesVal = totalFood + totalGas + totalParking + totalOthers;
    const expensesRow = [
      ...Array(16).fill(''),
      'TOTAL GASTOS',
      '',
      totalExpensesVal.toFixed(2),
      ...Array(maxMaterials * 2).fill('')
    ].join(',');

    const csvContent = ["sep=,", headers, ...rows, emptyRow, totalRow, hoursRow, expensesRow].join('\n');
    const encoder = new TextEncoder();
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const csvBytes = encoder.encode(csvContent);
    const blob = new Blob([bom, csvBytes], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    let fileNameParts = ['partes'];
    if (filterProject) {
      const sanitizedProject = filterProject.replace(/[^a-zA-Z0-9_-]/g, '');
      fileNameParts.push(`obra_${sanitizedProject}`);
    }
    if (filterDateStart) {
      fileNameParts.push(`desde_${filterDateStart}`);
    }
    if (filterDateEnd) {
      fileNameParts.push(`hasta_${filterDateEnd}`);
    }
    if (!filterProject && !filterDateStart && !filterDateEnd) {
      fileNameParts.push(new Date().toISOString().split('T')[0]);
    }
    const fileName = `${fileNameParts.join('_')}.csv`;

    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const drawHeader = (pageDoc: jsPDF) => {
      // Top accent bar
      pageDoc.setFillColor(0, 121, 123); // Teal #00797b
      pageDoc.rect(0, 0, 297, 4, 'F');

      // DRAW LOGO in top-left corner
      drawPdfHeaderLogo(pageDoc, { isLandscape: true, x: 15, y: 7, width: 56, height: 20 });

      // Right Side metadata/title
      pageDoc.setFont('helvetica', 'bold');
      pageDoc.setFontSize(14);
      pageDoc.setTextColor(31, 41, 55); // Gray-800
      pageDoc.text('INFORME DE ACTIVIDAD INDUSTRIAL', 282, 17, { align: 'right' });

      pageDoc.setFont('helvetica', 'normal');
      pageDoc.setFontSize(8.5);
      pageDoc.setTextColor(107, 114, 128); // Gray-500
      const nowStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      pageDoc.text(`Generado el: ${nowStr}`, 282, 22, { align: 'right' });

      // Filter subtitle
      let filterText = 'Filtros: ';
      const filtersActive: string[] = [];
      if (filterTech) filtersActive.push(`Técnico: ${filterTech}`);
      if (filterClient) filtersActive.push(`Cliente: ${filterClient}`);
      if (filterProject) filtersActive.push(`Obra: ${filterProject} (${resolveProjectFullName(filterProject)})`);
      if (filterDateStart || filterDateEnd) {
        if (filterDateStart && filterDateEnd) filtersActive.push(`Fechas: ${formatDateToSpanish(filterDateStart)} al ${formatDateToSpanish(filterDateEnd)}`);
        else if (filterDateStart) filtersActive.push(`Desde: ${formatDateToSpanish(filterDateStart)}`);
        else if (filterDateEnd) filtersActive.push(`Hasta: ${formatDateToSpanish(filterDateEnd)}`);
      }
      if (filtersActive.length === 0) {
        filterText += 'Todos los registros';
      } else {
        filterText += filtersActive.join(' | ');
      }
      pageDoc.setFont('helvetica', 'oblique');
      pageDoc.setFontSize(8.5);
      pageDoc.setTextColor(75, 85, 99); // Gray-600
      pageDoc.text(filterText, 282, 27, { align: 'right' });

      // Decorative divider line
      pageDoc.setDrawColor(229, 231, 235); // Border gray-200
      pageDoc.setLineWidth(0.4);
      pageDoc.line(15, 36, 282, 36);
    };

    const drawSummaryCards = (pageDoc: jsPDF) => {
      let totalFood = 0;
      let totalGas = 0;
      let totalParking = 0;
      let totalOthers = 0;
      let totalOvertime = 0;
      let totalWorkedHours = 0;

      filteredReports.forEach(r => {
        totalWorkedHours += calculateDuration(r.startTime, r.endTime);
        totalOvertime += Number(r.overtimeHours || 0);
        totalFood += Number(r.expenses?.food || 0);
        totalGas += Number(r.expenses?.gas || 0);
        totalParking += Number(r.expenses?.parking || 0);
        totalOthers += Number(r.expenses?.others || 0);
      });

      const totalExpenses = totalFood + totalGas + totalParking + totalOthers;
      const totalHours = totalWorkedHours + totalOvertime;

      const cards = [
        { label: 'PARTES REGISTRADOS', value: `${filteredReports.length} partes`, sub: 'Filtrados para el informe' },
        { label: 'HORAS REGULARES', value: `${totalWorkedHours.toFixed(2)} h`, sub: 'Horario entrada/salida' },
        { label: 'HORAS EXTRAORD.', value: `${totalOvertime.toFixed(2)} h`, sub: 'Pendientes o validadas' },
        { label: 'DIETAS Y GASTOS', value: `${totalExpenses.toFixed(2)} €`, sub: `Comida: ${totalFood.toFixed(1)}€, Gas: ${totalGas.toFixed(1)}€` }
      ];

      const cardW = 63;
      const cardH = 15;
      const startX = 15;
      const startY = 40;
      const gap = 5;

      cards.forEach((c, i) => {
        const x = startX + i * (cardW + gap);
        pageDoc.setFillColor(249, 250, 251); // background
        pageDoc.setDrawColor(229, 231, 235); // border
        pageDoc.setLineWidth(0.3);
        pageDoc.roundedRect(x, startY, cardW, cardH, 2, 2, 'FD');

        // Accent tag bar on the left of each card
        const accentCol = i === 3 ? [176, 209, 42] : [0, 121, 123];
        pageDoc.setFillColor(accentCol[0], accentCol[1], accentCol[2]); // Lime for expenses, Teal for others
        pageDoc.rect(x, startY, 2, cardH, 'F');

        pageDoc.setFont('helvetica', 'bold');
        pageDoc.setFontSize(7.5);
        pageDoc.setTextColor(107, 114, 128);
        pageDoc.text(c.label, x + 5, startY + 4);

        pageDoc.setFont('helvetica', 'bold');
        pageDoc.setFontSize(11);
        pageDoc.setTextColor(17, 24, 39);
        pageDoc.text(c.value, x + 5, startY + 9.5);

        pageDoc.setFont('helvetica', 'normal');
        pageDoc.setFontSize(7);
        pageDoc.setTextColor(156, 163, 175);
        pageDoc.text(c.sub, x + 5, startY + 13.5);
      });
    };

    // Prepare rows for the table
    const rows = filteredReports.map(r => {
      const dateStr = formatDateToSpanish(r.date);
      const techStr = r.technician || '';
      const projectStr = `${r.projectNum}\n${resolveProjectFullName(r.projectNum)}`;
      const hoursStr = `${r.startTime} - ${r.endTime}`;
      const durationStr = `${calculateDuration(r.startTime, r.endTime).toFixed(2)} h`;
      const otStr = r.overtimeHours ? `${r.overtimeHours.toFixed(2)} h\n(${r.overtimeType})` : '0.00 h';
      const vehStr = r.vehicle + (r.isDriver ? `\n(Cond. ${r.driverTripType || ''})` : '');
      const descStr = r.description || '';
      
      const expenseList: string[] = [];
      if (r.expenses.food > 0) expenseList.push(`Comida: ${r.expenses.food.toFixed(2)}€`);
      if (r.expenses.gas > 0) expenseList.push(`Gas.: ${r.expenses.gas.toFixed(2)}€`);
      if (r.expenses.parking > 0) expenseList.push(`Park.: ${r.expenses.parking.toFixed(2)}€`);
      if (r.expenses.others > 0) {
        const descOpt = r.expenses.othersDesc ? ` (${r.expenses.othersDesc})` : '';
        expenseList.push(`Otros: ${r.expenses.others.toFixed(2)}€${descOpt}`);
      }
      const expStr = expenseList.length > 0 ? expenseList.join('\n') : '-';
      
      const matStr = (r.materials || []).length > 0
        ? r.materials.map(m => `• ${m.quantity} ${m.description}`).join('\n')
        : '-';

      return {
        date: dateStr,
        tech: techStr,
        project: projectStr,
        hours: hoursStr,
        duration: durationStr,
        overtime: otStr,
        vehicle: vehStr,
        desc: descStr,
        expenses: expStr,
        materials: matStr
      };
    });

    // Draw page 1 summary first
    drawHeader(doc);
    drawSummaryCards(doc);

    // Call autoTable to draw the records
    autoTable(doc, {
      startY: 59,
      margin: { top: 41, bottom: 15, left: 15, right: 15 },
      columns: [
        { header: 'Fecha', dataKey: 'date' },
        { header: 'Técnico', dataKey: 'tech' },
        { header: 'Obra', dataKey: 'project' },
        { header: 'Horario', dataKey: 'hours' },
        { header: 'Duración', dataKey: 'duration' },
        { header: 'H. Extra', dataKey: 'overtime' },
        { header: 'Vehículo', dataKey: 'vehicle' },
        { header: 'Descripción de Trabajo', dataKey: 'desc' },
        { header: 'Dietas / Gastos', dataKey: 'expenses' },
        { header: 'Materiales', dataKey: 'materials' }
      ],
      body: rows,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        font: 'helvetica',
        cellPadding: 2,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [0, 121, 123],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        valign: 'middle'
      },
      columnStyles: {
        date: { cellWidth: 16, halign: 'center' },
        tech: { cellWidth: 20 },
        project: { cellWidth: 32 },
        hours: { cellWidth: 18, halign: 'center' },
        duration: { cellWidth: 15, halign: 'center' },
        overtime: { cellWidth: 22, halign: 'center' },
        vehicle: { cellWidth: 25 },
        desc: { cellWidth: 55 },
        expenses: { cellWidth: 32 },
        materials: { cellWidth: 32 }
      },
      didDrawPage: (data) => {
        // Draw standard page header for non-first pages (and first pages is handled by startY)
        if (data.pageNumber > 1) {
          drawHeader(doc);
        }
        
        // Left footer banner
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(156, 163, 175);
        doc.text('JDG TELECO S.L. - Sistema de Gestión Interna de Partes Industriales', 15, 202);
      }
    });

    // Realize page number stamps on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(156, 163, 175);
      doc.text(`Página ${i} de ${totalPages}`, 282, 202, { align: 'right' });
    }

    // Prepare filename
    let fileNameParts = ['partes'];
    if (filterProject) {
      const sanitizedProject = filterProject.replace(/[^a-zA-Z0-9_-]/g, '');
      fileNameParts.push(`obra_${sanitizedProject}`);
    }
    if (filterDateStart) {
      fileNameParts.push(`desde_${filterDateStart}`);
    }
    if (filterDateEnd) {
      fileNameParts.push(`hasta_${filterDateEnd}`);
    }
    if (!filterProject && !filterDateStart && !filterDateEnd) {
      fileNameParts.push(new Date().toISOString().split('T')[0]);
    }
    const fileName = `${fileNameParts.join('_')}.pdf`;

    // Save and download PDF
    doc.save(fileName);
  };

  const getMonthYearLabelFromKey = (key: string) => {
    const [year, month] = key.split('-');
    const dateObj = new Date(Number(year), Number(month) - 1, 15);
    return dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  const downloadMonthlyOvertimeAllTechsExcel = (monthKey: string) => {
    if (!monthKey) return;
    const monthLabel = getMonthYearLabelFromKey(monthKey);
    const monthReports = data.reports.filter(r => {
      if (r.overtimeHours <= 0) return false;
      const date = new Date(r.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return key === monthKey;
    });

    if (monthReports.length === 0) {
      toast.error(`No hay horas extra registradas para el mes de ${monthLabel}`);
      return;
    }

    // Group by technician
    const techGroups: Record<string, { norm: number, noct: number, finde: number, total: number, nights: number, overnights: number }> = {};
    monthReports.forEach(r => {
      const tech = r.technician;
      if (!techGroups[tech]) {
        techGroups[tech] = { norm: 0, noct: 0, finde: 0, total: 0, nights: 0, overnights: 0 };
      }
      const ot = Number(r.overtimeHours || 0);
      techGroups[tech].total += ot;
      if (r.overtimeType === 'NORMAL') techGroups[tech].norm += ot;
      else if (r.overtimeType === 'NOCTURNA') techGroups[tech].noct += ot;
      else if (r.overtimeType === 'FINDE SEMANA') techGroups[tech].finde += ot;

      if (r.isNightShift) techGroups[tech].nights += 1;
      if (r.isOvernight) techGroups[tech].overnights += 1;
    });

    const headers = [
      'Técnico',
      'Horas Normales',
      'Horas Nocturnas',
      'Horas Fin de Semana',
      'Total Horas Extra',
      'Noches (Recuento)',
      'Pernoctas (Recuento)'
    ].join(',');

    const rows = Object.entries(techGroups)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([techName, stats]) => {
        const escape = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
        return [
          escape(techName),
          stats.norm.toFixed(2),
          stats.noct.toFixed(2),
          stats.finde.toFixed(2),
          stats.total.toFixed(2),
          stats.nights,
          stats.overnights
        ].join(',');
      });

    const csvContent = ["sep=,", headers, ...rows].join('\n');
    const encoder = new TextEncoder();
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const csvBytes = encoder.encode(csvContent);
    const blob = new Blob([bom, csvBytes], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    const label = monthLabel.replace(/\s+/g, '_').toLowerCase();
    link.setAttribute("download", `resumen_horas_extra_tecnicos_${label}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Excel exportado correctamente para el mes de ${monthLabel}`);
  };

  const downloadMonthlyOvertimeAllTechsPDF = (monthKey: string) => {
    if (!monthKey) return;
    const monthLabel = getMonthYearLabelFromKey(monthKey);
    const monthReports = data.reports.filter(r => {
      if (r.overtimeHours <= 0) return false;
      const date = new Date(r.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return key === monthKey;
    });

    if (monthReports.length === 0) {
      toast.error(`No hay horas extra registradas para el mes de ${monthLabel}`);
      return;
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const drawHeader = (pageDoc: jsPDF) => {
      pageDoc.setFillColor(0, 121, 123); // Teal
      pageDoc.rect(0, 0, 297, 4, 'F');

      // DRAW LOGO in top-left corner
      drawPdfHeaderLogo(pageDoc, { isLandscape: true, x: 15, y: 7, width: 56, height: 20 });

      pageDoc.setFont('helvetica', 'bold');
      pageDoc.setFontSize(14);
      pageDoc.setTextColor(31, 41, 55);
      pageDoc.text('INFORME MENSUAL DE HORAS EXTRAORDINARIAS (RESUMEN)', 282, 17, { align: 'right' });

      pageDoc.setFont('helvetica', 'normal');
      pageDoc.setFontSize(8.5);
      pageDoc.setTextColor(107, 114, 128);
      const nowStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      pageDoc.text(`Generado el: ${nowStr}`, 282, 22, { align: 'right' });

      pageDoc.setFont('helvetica', 'bold');
      pageDoc.setFontSize(9);
      pageDoc.setTextColor(75, 85, 99);
      pageDoc.text(`Período: ${monthLabel}  |  Resumen por Técnico`, 282, 27, { align: 'right' });

      pageDoc.setDrawColor(229, 231, 235);
      pageDoc.setLineWidth(0.4);
      pageDoc.line(15, 36, 282, 36);
    };

    const drawSummaryCards = (pageDoc: jsPDF) => {
      let totalOt = 0;
      let totalNorm = 0;
      let totalNoct = 0;
      let totalFinde = 0;
      let nightsCount = 0;
      let overnightsCount = 0;

      monthReports.forEach(r => {
        const ot = Number(r.overtimeHours || 0);
        totalOt += ot;
        if (r.overtimeType === 'NORMAL') totalNorm += ot;
        else if (r.overtimeType === 'NOCTURNA') totalNoct += ot;
        else if (r.overtimeType === 'FINDE SEMANA') totalFinde += ot;

        if (r.isNightShift) nightsCount += 1;
        if (r.isOvernight) overnightsCount += 1;
      });

      const cards = [
        { label: 'HORAS EXTRA TOTALES', value: `${totalOt.toFixed(2)} h`, sub: 'Acumulado mes' },
        { label: 'HORAS NORMALES', value: `${totalNorm.toFixed(2)} h`, sub: 'Tipo NORMAL' },
        { label: 'HORAS NOCTURNAS', value: `${totalNoct.toFixed(2)} h`, sub: 'Tipo NOCTURNA' },
        { label: 'FIN DE SEMANA', value: `${totalFinde.toFixed(2)} h`, sub: 'Tipo FINDE' },
        { label: '🌙 NOCHES', value: `${nightsCount}`, sub: 'Recuento Noche' },
        { label: '🏨 PERNOCTAS', value: `${overnightsCount}`, sub: 'Recuento Pernocta' }
      ];

      const cardW = 40;
      const cardH = 15;
      const startX = 15;
      const startY = 40;
      const gap = 5.4;

      cards.forEach((c, i) => {
        const x = startX + i * (cardW + gap);
        pageDoc.setFillColor(249, 250, 251);
        pageDoc.setDrawColor(229, 231, 235);
        pageDoc.setLineWidth(0.3);
        pageDoc.roundedRect(x, startY, cardW, cardH, 2, 2, 'FD');

        let accentCol = [0, 121, 123];
        if (i === 0) accentCol = [176, 209, 42];
        else if (i === 4) accentCol = [99, 102, 241];
        else if (i === 5) accentCol = [168, 85, 247];

        pageDoc.setFillColor(accentCol[0], accentCol[1], accentCol[2]);
        pageDoc.rect(x, startY, 2, cardH, 'F');

        pageDoc.setFont('helvetica', 'bold');
        pageDoc.setFontSize(6.5);
        pageDoc.setTextColor(107, 114, 128);
        pageDoc.text(c.label, x + 4, startY + 4);

        pageDoc.setFont('helvetica', 'bold');
        pageDoc.setFontSize(10.5);
        if (i === 4) pageDoc.setTextColor(79, 70, 229);
        else if (i === 5) pageDoc.setTextColor(147, 51, 234);
        else pageDoc.setTextColor(17, 24, 39);
        pageDoc.text(c.value, x + 4, startY + 9.5);

        pageDoc.setFont('helvetica', 'normal');
        pageDoc.setFontSize(6.5);
        pageDoc.setTextColor(156, 163, 175);
        pageDoc.text(c.sub, x + 4, startY + 13.5);
      });
    };

    // Group by technician
    const techGroups: Record<string, { norm: number, noct: number, finde: number, total: number, nights: number, overnights: number }> = {};
    monthReports.forEach(r => {
      const tech = r.technician;
      if (!techGroups[tech]) {
        techGroups[tech] = { norm: 0, noct: 0, finde: 0, total: 0, nights: 0, overnights: 0 };
      }
      const ot = Number(r.overtimeHours || 0);
      techGroups[tech].total += ot;
      if (r.overtimeType === 'NORMAL') techGroups[tech].norm += ot;
      else if (r.overtimeType === 'NOCTURNA') techGroups[tech].noct += ot;
      else if (r.overtimeType === 'FINDE SEMANA') techGroups[tech].finde += ot;

      if (r.isNightShift) techGroups[tech].nights += 1;
      if (r.isOvernight) techGroups[tech].overnights += 1;
    });

    const rows = Object.entries(techGroups)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([techName, stats]) => {
        return {
          technician: techName,
          norm: `${stats.norm.toFixed(2)} h`,
          noct: `${stats.noct.toFixed(2)} h`,
          finde: `${stats.finde.toFixed(2)} h`,
          total: `${stats.total.toFixed(2)} h`,
          nights: `${stats.nights}`,
          overnights: `${stats.overnights}`
        };
      });

    drawHeader(doc);
    drawSummaryCards(doc);

    autoTable(doc, {
      startY: 59,
      margin: { top: 41, bottom: 15, left: 15, right: 15 },
      columns: [
        { header: 'Técnico', dataKey: 'technician' },
        { header: 'Horas Normales', dataKey: 'norm' },
        { header: 'Horas Nocturnas', dataKey: 'noct' },
        { header: 'Horas Fin de Semana', dataKey: 'finde' },
        { header: 'Total Horas Extra', dataKey: 'total' },
        { header: 'Noches (Recuento)', dataKey: 'nights' },
        { header: 'Pernoctas (Recuento)', dataKey: 'overnights' }
      ],
      body: rows,
      theme: 'grid',
      styles: {
        fontSize: 8.5,
        font: 'helvetica',
        cellPadding: 3,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [0, 121, 123],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
        valign: 'middle'
      },
      columnStyles: {
        technician: { cellWidth: 57, fontStyle: 'bold' },
        norm: { cellWidth: 35, halign: 'center' },
        noct: { cellWidth: 35, halign: 'center' },
        finde: { cellWidth: 35, halign: 'center' },
        total: { cellWidth: 35, halign: 'center', fontStyle: 'bold' },
        nights: { cellWidth: 35, halign: 'center' },
        overnights: { cellWidth: 35, halign: 'center' }
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          drawHeader(doc);
        }
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(156, 163, 175);
        doc.text('JDG TELECO S.L. - Sistema de Gestión Interna de Partes Industriales', 15, 202);
      }
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(`Página ${i} de ${totalPages}`, 282, 202, { align: 'right' });
    }

    const label = monthLabel.replace(/\s+/g, '_').toLowerCase();
    doc.save(`resumen_horas_extra_tecnicos_${label}.pdf`);
    toast.success(`PDF exportado correctamente para el mes de ${monthLabel}`);
  };

  const downloadTechMonthPDF = (techName: string, monthKey: string, monthData: any, monthReports: WorkReport[]) => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const drawHeader = (pageDoc: jsPDF) => {
      // Top accent bar
      pageDoc.setFillColor(0, 121, 123); // Teal #00797b
      pageDoc.rect(0, 0, 297, 4, 'F');

      // DRAW LOGO in top-left corner
      drawPdfHeaderLogo(pageDoc, { isLandscape: true, x: 15, y: 7, width: 56, height: 20 });

      // Right Side metadata/title
      pageDoc.setFont('helvetica', 'bold');
      pageDoc.setFontSize(14);
      pageDoc.setTextColor(31, 41, 55); // Gray-800
      pageDoc.text('INFORME DE HORAS EXTRAORDINARIAS', 282, 17, { align: 'right' });

      pageDoc.setFont('helvetica', 'normal');
      pageDoc.setFontSize(8.5);
      pageDoc.setTextColor(107, 114, 128); // Gray-500
      const nowStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      pageDoc.text(`Generado el: ${nowStr}`, 282, 22, { align: 'right' });

      // Period and technician subtitle
      pageDoc.setFont('helvetica', 'bold');
      pageDoc.setFontSize(9);
      pageDoc.setTextColor(75, 85, 99); // Gray-600
      pageDoc.text(`Técnico: ${techName.toUpperCase()}  |  Período: ${monthData.label}`, 282, 27, { align: 'right' });

      // Decorative divider line
      pageDoc.setDrawColor(229, 231, 235); // Border gray-200
      pageDoc.setLineWidth(0.4);
      pageDoc.line(15, 36, 282, 36);
    };

    const drawSummaryCards = (pageDoc: jsPDF) => {
      const nightsCount = monthReports.filter(r => r.isNightShift).length;
      const overnightsCount = monthReports.filter(r => r.isOvernight).length;

      const cards = [
        { label: 'HORAS EXTRA TOTALES', value: `${monthData.total.toFixed(2)} h`, sub: 'Acumulado mes' },
        { label: 'HORAS NORMALES', value: `${monthData.norm.toFixed(2)} h`, sub: 'Tipo NORMAL' },
        { label: 'HORAS NOCTURNAS', value: `${monthData.noct.toFixed(2)} h`, sub: 'Tipo NOCTURNA' },
        { label: 'FIN DE SEMANA', value: `${monthData.finde.toFixed(2)} h`, sub: 'Tipo FINDE' },
        { label: '🌙 NOCHES', value: `${nightsCount}`, sub: 'Recuento Noche' },
        { label: '🏨 PERNOCTAS', value: `${overnightsCount}`, sub: 'Recuento Pernocta' }
      ];

      const cardW = 40;
      const cardH = 15;
      const startX = 15;
      const startY = 40;
      const gap = 5.4;

      cards.forEach((c, i) => {
        const x = startX + i * (cardW + gap);
        pageDoc.setFillColor(249, 250, 251); // background
        pageDoc.setDrawColor(229, 231, 235); // border
        pageDoc.setLineWidth(0.3);
        pageDoc.roundedRect(x, startY, cardW, cardH, 2, 2, 'FD');

        // Accent tag bar on the left of each card
        let accentCol = [0, 121, 123]; // Teal
        if (i === 0) accentCol = [176, 209, 42]; // Lime
        else if (i === 4) accentCol = [99, 102, 241]; // Indigo for Noche
        else if (i === 5) accentCol = [168, 85, 247]; // Purple for Pernocta

        pageDoc.setFillColor(accentCol[0], accentCol[1], accentCol[2]);
        pageDoc.rect(x, startY, 2, cardH, 'F');

        pageDoc.setFont('helvetica', 'bold');
        pageDoc.setFontSize(6.5);
        pageDoc.setTextColor(107, 114, 128);
        pageDoc.text(c.label, x + 4, startY + 4);

        pageDoc.setFont('helvetica', 'bold');
        pageDoc.setFontSize(10.5);
        if (i === 4) pageDoc.setTextColor(79, 70, 229); // Indigo text for nights
        else if (i === 5) pageDoc.setTextColor(147, 51, 234); // Purple text for overnights
        else pageDoc.setTextColor(17, 24, 39);
        pageDoc.text(c.value, x + 4, startY + 9.5);

        pageDoc.setFont('helvetica', 'normal');
        pageDoc.setFontSize(6.5);
        pageDoc.setTextColor(156, 163, 175);
        pageDoc.text(c.sub, x + 4, startY + 13.5);
      });
    };

    // Prepare rows for the table
    const rows = monthReports.map(r => {
      const dateStr = formatDateToSpanish(r.date);
      const projectStr = `${r.projectNum} - ${resolveProjectFullName(r.projectNum)}`;
      const durationStr = `${calculateDuration(r.startTime, r.endTime).toFixed(2)} h (${r.startTime} - ${r.endTime})`;
      const otStr = `${r.overtimeHours.toFixed(2)} h`;
      let otTypeStr = r.overtimeType || 'NORMAL';
      if (r.isNightShift) otTypeStr += ' (NOCHE)';
      if (r.isOvernight) otTypeStr += ' (PERNOCTA)';
      const statusStr = r.overtimeStatus === 'validated' ? 'Validado' : 'Pendiente';
      const descStr = r.description || '';

      return {
        date: dateStr,
        project: projectStr,
        duration: durationStr,
        overtime: otStr,
        overtimeType: otTypeStr,
        status: statusStr,
        desc: descStr
      };
    });

    drawHeader(doc);
    drawSummaryCards(doc);

    autoTable(doc, {
      startY: 59,
      margin: { top: 41, bottom: 15, left: 15, right: 15 },
      columns: [
        { header: 'Fecha', dataKey: 'date' },
        { header: 'Obra / Proyecto', dataKey: 'project' },
        { header: 'Horario Jornada', dataKey: 'duration' },
        { header: 'Horas Extra', dataKey: 'overtime' },
        { header: 'Tipo Hora Extra', dataKey: 'overtimeType' },
        { header: 'Estado', dataKey: 'status' },
        { header: 'Descripción / Tareas', dataKey: 'desc' }
      ],
      body: rows,
      theme: 'grid',
      styles: {
        fontSize: 8,
        font: 'helvetica',
        cellPadding: 2.5,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [0, 121, 123],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
        valign: 'middle'
      },
      columnStyles: {
        date: { cellWidth: 20, halign: 'center' },
        project: { cellWidth: 50 },
        duration: { cellWidth: 40, halign: 'center' },
        overtime: { cellWidth: 22, halign: 'center' },
        overtimeType: { cellWidth: 28, halign: 'center' },
        status: { cellWidth: 22, halign: 'center' },
        desc: { cellWidth: 85 }
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          drawHeader(doc);
        }
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(156, 163, 175);
        doc.text('JDG TELECO S.L. - Sistema de Gestión Interna de Partes Industriales', 15, 202);
      }
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(156, 163, 175);
      doc.text(`Página ${i} de ${totalPages}`, 282, 202, { align: 'right' });
    }

    const sanitizedTech = techName.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    const fileName = `horas_extra_${sanitizedTech}_${monthKey}.pdf`;
    doc.save(fileName);
  };

  const downloadOvertimePDF = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const overtimeReports = data.reports.filter(r => {
      if (r.overtimeHours <= 0) return false;
      if (filterTech && r.technician !== filterTech) return false;
      if (filterProject && r.projectNum !== filterProject) return false;
      if (filterDateStart && r.date < filterDateStart) return false;
      if (filterDateEnd && r.date > filterDateEnd) return false;
      return true;
    });

    if (overtimeReports.length === 0) {
      toast.error('No hay horas extra que coincidan con los filtros actuales para generar el PDF.');
      return;
    }

    const drawHeader = (pageDoc: jsPDF) => {
      // Top accent bar
      pageDoc.setFillColor(0, 121, 123); // Teal #00797b
      pageDoc.rect(0, 0, 297, 4, 'F');

      // DRAW LOGO in top-left corner
      drawPdfHeaderLogo(pageDoc, { isLandscape: true, x: 15, y: 7, width: 56, height: 20 });

      // Right Side metadata/title
      pageDoc.setFont('helvetica', 'bold');
      pageDoc.setFontSize(14);
      pageDoc.setTextColor(31, 41, 55); // Gray-800
      pageDoc.text('REPORTE GENERAL DE HORAS EXTRA', 282, 17, { align: 'right' });

      pageDoc.setFont('helvetica', 'normal');
      pageDoc.setFontSize(8.5);
      pageDoc.setTextColor(107, 114, 128); // Gray-500
      const nowStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      pageDoc.text(`Generado el: ${nowStr}`, 282, 22, { align: 'right' });

      // Filter subtitle
      let filterText = 'Filtros: ';
      const filtersActive: string[] = [];
      if (filterTech) filtersActive.push(`Técnico: ${filterTech}`);
      if (filterClient) filtersActive.push(`Cliente: ${filterClient}`);
      if (filterProject) filtersActive.push(`Obra: ${filterProject}`);
      if (filterDateStart || filterDateEnd) {
        if (filterDateStart && filterDateEnd) filtersActive.push(`Fechas: ${formatDateToSpanish(filterDateStart)} al ${formatDateToSpanish(filterDateEnd)}`);
        else if (filterDateStart) filtersActive.push(`Desde: ${formatDateToSpanish(filterDateStart)}`);
        else if (filterDateEnd) filtersActive.push(`Hasta: ${formatDateToSpanish(filterDateEnd)}`);
      }
      if (filtersActive.length === 0) {
        filterText += 'Todos los registros de horas extra';
      } else {
        filterText += filtersActive.join(' | ');
      }
      pageDoc.setFont('helvetica', 'oblique');
      pageDoc.setFontSize(8.5);
      pageDoc.setTextColor(75, 85, 99); // Gray-600
      pageDoc.text(filterText, 282, 27, { align: 'right' });

      // Decorative divider line
      pageDoc.setDrawColor(229, 231, 235); // Border gray-200
      pageDoc.setLineWidth(0.4);
      pageDoc.line(15, 36, 282, 36);
    };

    const drawSummaryCards = (pageDoc: jsPDF) => {
      let totalOvertime = 0;
      let totalNorm = 0;
      let totalNoct = 0;
      let totalFinde = 0;
      let nightsCount = 0;
      let overnightsCount = 0;
 
      overtimeReports.forEach(r => {
        const ot = Number(r.overtimeHours || 0);
        totalOvertime += ot;
        if (r.overtimeType === 'NORMAL') totalNorm += ot;
        else if (r.overtimeType === 'NOCTURNA') totalNoct += ot;
        else if (r.overtimeType === 'FINDE SEMANA') totalFinde += ot;
        
        if (r.isNightShift) nightsCount += 1;
        if (r.isOvernight) overnightsCount += 1;
      });
 
      const cards = [
        { label: 'HORAS EXTRA EXTRAORDINARIAS', value: `${totalOvertime.toFixed(2)} h`, sub: `${overtimeReports.length} partes` },
        { label: 'HORAS NORMALES', value: `${totalNorm.toFixed(2)} h`, sub: 'Tipo NORMAL' },
        { label: 'HORAS NOCTURNAS', value: `${totalNoct.toFixed(2)} h`, sub: 'Tipo NOCTURNA' },
        { label: 'FIN DE SEMANA', value: `${totalFinde.toFixed(2)} h`, sub: 'Tipo FINDE' },
        { label: '🌙 NOCHES', value: `${nightsCount}`, sub: 'Recuento Noche' },
        { label: '🏨 PERNOCTAS', value: `${overnightsCount}`, sub: 'Recuento Pernocta' }
      ];
 
      const cardW = 40;
      const cardH = 15;
      const startX = 15;
      const startY = 40;
      const gap = 5.4;
 
      cards.forEach((c, i) => {
        const x = startX + i * (cardW + gap);
        pageDoc.setFillColor(249, 250, 251); // background
        pageDoc.setDrawColor(229, 231, 235); // border
        pageDoc.setLineWidth(0.3);
        pageDoc.roundedRect(x, startY, cardW, cardH, 2, 2, 'FD');
 
        // Accent tag bar on the left of each card
        let accentCol = [0, 121, 123]; // Teal
        if (i === 0) accentCol = [176, 209, 42]; // Lime
        else if (i === 4) accentCol = [99, 102, 241]; // Indigo for Noche
        else if (i === 5) accentCol = [168, 85, 247]; // Purple for Pernocta
 
        pageDoc.setFillColor(accentCol[0], accentCol[1], accentCol[2]);
        pageDoc.rect(x, startY, 2, cardH, 'F');
 
        pageDoc.setFont('helvetica', 'bold');
        pageDoc.setFontSize(6.5);
        pageDoc.setTextColor(107, 114, 128);
        pageDoc.text(c.label, x + 4, startY + 4);
 
        pageDoc.setFont('helvetica', 'bold');
        pageDoc.setFontSize(10.5);
        if (i === 4) pageDoc.setTextColor(79, 70, 229); // Indigo text for nights
        else if (i === 5) pageDoc.setTextColor(147, 51, 234); // Purple text for overnights
        else pageDoc.setTextColor(17, 24, 39);
        pageDoc.text(c.value, x + 4, startY + 9.5);
 
        pageDoc.setFont('helvetica', 'normal');
        pageDoc.setFontSize(6.5);
        pageDoc.setTextColor(156, 163, 175);
        pageDoc.text(c.sub, x + 4, startY + 13.5);
      });
    };

    const rows = overtimeReports.map(r => {
      const dateStr = formatDateToSpanish(r.date);
      const techStr = r.technician || '';
      const projectStr = `${r.projectNum} - ${resolveProjectFullName(r.projectNum)}`;
      const durationStr = `${calculateDuration(r.startTime, r.endTime).toFixed(2)} h (${r.startTime} - ${r.endTime})`;
      const otStr = `${r.overtimeHours.toFixed(2)} h`;
      let otTypeStr = r.overtimeType || 'NORMAL';
      if (r.isNightShift) otTypeStr += ' (NOCHE)';
      if (r.isOvernight) otTypeStr += ' (PERNOCTA)';
      const statusStr = r.overtimeStatus === 'validated' ? 'Validado' : 'Pendiente';
      const descStr = r.description || '';

      return {
        date: dateStr,
        tech: techStr,
        project: projectStr,
        duration: durationStr,
        overtime: otStr,
        overtimeType: otTypeStr,
        status: statusStr,
        desc: descStr
      };
    });

    drawHeader(doc);
    drawSummaryCards(doc);

    autoTable(doc, {
      startY: 59,
      margin: { top: 41, bottom: 15, left: 15, right: 15 },
      columns: [
        { header: 'Fecha', dataKey: 'date' },
        { header: 'Técnico', dataKey: 'tech' },
        { header: 'Obra / Proyecto', dataKey: 'project' },
        { header: 'Horario', dataKey: 'duration' },
        { header: 'Horas Extra', dataKey: 'overtime' },
        { header: 'Tipo', dataKey: 'overtimeType' },
        { header: 'Estado', dataKey: 'status' },
        { header: 'Descripción / Tareas', dataKey: 'desc' }
      ],
      body: rows,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        font: 'helvetica',
        cellPadding: 2,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [0, 121, 123],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        valign: 'middle'
      },
      columnStyles: {
        date: { cellWidth: 16, halign: 'center' },
        tech: { cellWidth: 20 },
        project: { cellWidth: 42 },
        duration: { cellWidth: 32, halign: 'center' },
        overtime: { cellWidth: 20, halign: 'center' },
        overtimeType: { cellWidth: 24, halign: 'center' },
        status: { cellWidth: 20, halign: 'center' },
        desc: { cellWidth: 93 }
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          drawHeader(doc);
        }
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(156, 163, 175);
        doc.text('JDG TELECO S.L. - Sistema de Gestión Interna de Partes Industriales', 15, 202);
      }
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(156, 163, 175);
      doc.text(`Página ${i} de ${totalPages}`, 282, 202, { align: 'right' });
    }

    doc.save(`reporte_general_horas_extra_${new Date().toISOString().split('T')[0]}.pdf`);
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
      if (b.isRejected) return 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 opacity-85';
      if (b.isAccepted) return 'bg-green-50/60 dark:bg-green-950/20 border-green-200 dark:border-green-900/40';
      if (b.isFinished) return 'bg-teal-50/60 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900/40';
      if (!b.deliveryDate) return 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800';
      return 'bg-white dark:bg-brand-panel border-gray-200 dark:border-gray-700';
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
        
        // Armonización con los técnicos registrados del sistema
        const colors = ['#E63946','#F77F00','#06D6A0','#118AB2','#073B4C','#D62828','#FCA311','#14213D','#00B4D8','#0077B6'];
        const activeTechs = (prev.technicians || []).filter(t => t.active !== false);
        const excludedNames = new Set((newOrg.excluidos || []).map(e => e.trim().toUpperCase()));
        const registeredNames = new Set(activeTechs.map(t => t.name.trim().toUpperCase()));
        const assignedNames = new Set<string>();
        (newOrg.trabajos || []).forEach(job => {
            (job.trabajadores || []).forEach(w => {
                assignedNames.add(w.nombre.trim().toUpperCase());
            });
        });
        let updatedWorkers = (newOrg.trabajadores || []).map(w => {
            const isActuallyAssigned = assignedNames.has(w.nombre.trim().toUpperCase());
            return { ...w, asignado: isActuallyAssigned };
        }).filter(w => {
            const nameUpper = w.nombre.trim().toUpperCase();
            if (excludedNames.has(nameUpper) && !assignedNames.has(nameUpper)) {
                return false;
            }
            return registeredNames.has(nameUpper) || assignedNames.has(nameUpper) || w.isManual;
        });
        const existingNames = new Set(updatedWorkers.map(w => w.nombre.trim().toUpperCase()));
        activeTechs.forEach((t, i) => {
            const nameUpper = t.name.trim().toUpperCase();
            if (!existingNames.has(nameUpper) && !excludedNames.has(nameUpper)) {
                updatedWorkers.push({
                    id: Number(t.id) || Date.now() + i,
                    nombre: nameUpper,
                    color: colors[i % colors.length],
                    asignado: assignedNames.has(nameUpper)
                });
            }
        });
        const harmonizedOrg = { ...newOrg, trabajadores: updatedWorkers };

        if (harmonizedOrg && harmonizedOrg.fecha) history[harmonizedOrg.fecha] = harmonizedOrg;

        // Limita el historial a los últimos 60 días
        const keys = Object.keys(history).sort((a, b) => b.localeCompare(a));
        if (keys.length > 60) {
            keys.slice(60).forEach(k => delete history[k]);
        }

        // Guardado directo en Firestore daily_orgs si está disponible
        if (harmonizedOrg && harmonizedOrg.fecha) {
            try {
                const fb = (window as any).firebase;
                if (fb) {
                    const db = fb.app().firestore();
                    const safeOrg = JSON.parse(JSON.stringify(harmonizedOrg));
                    db.collection("jdg_teleco").doc("main_db").collection("daily_orgs").doc(harmonizedOrg.fecha).set(safeOrg).catch(() => {});
                }
            } catch (_) {}
        }

        return { ...prev, dailyOrg: harmonizedOrg, dailyOrgHistory: history };
    }); 
  };

  const handleDailyOrgDateChange = (newDate: string) => {
    setData(prev => {
        const history = { ...(prev.dailyOrgHistory || {}) };
        if (prev.dailyOrg?.fecha) {
            history[prev.dailyOrg.fecha] = prev.dailyOrg;
        }

        const existingData = history[newDate];
        let orgToLoad: DailyOrgData;
        if (existingData) {
            orgToLoad = existingData;
        } else {
            const currentWorkers = prev.dailyOrg?.trabajadores || [];
            const cleanWorkers = currentWorkers.map(w => ({ ...w, asignado: false }));
            orgToLoad = { fecha: newDate, trabajos: [], trabajadores: cleanWorkers, lastUpdated: Date.now() };
        }

        // Armonización con los técnicos registrados del sistema
        const colors = ['#E63946','#F77F00','#06D6A0','#118AB2','#073B4C','#D62828','#FCA311','#14213D','#00B4D8','#0077B6'];
        const activeTechs = (prev.technicians || []).filter(t => t.active !== false);
        const excludedNames = new Set((orgToLoad.excluidos || []).map(e => e.trim().toUpperCase()));
        const registeredNames = new Set(activeTechs.map(t => t.name.trim().toUpperCase()));
        const assignedNames = new Set<string>();
        (orgToLoad.trabajos || []).forEach(job => {
            (job.trabajadores || []).forEach(w => {
                assignedNames.add(w.nombre.trim().toUpperCase());
            });
        });
        let updatedWorkers = (orgToLoad.trabajadores || []).map(w => {
            const isActuallyAssigned = assignedNames.has(w.nombre.trim().toUpperCase());
            return { ...w, asignado: isActuallyAssigned };
        }).filter(w => {
            const nameUpper = w.nombre.trim().toUpperCase();
            if (excludedNames.has(nameUpper) && !assignedNames.has(nameUpper)) {
                return false;
            }
            return registeredNames.has(nameUpper) || assignedNames.has(nameUpper) || w.isManual;
        });
        const existingNames = new Set(updatedWorkers.map(w => w.nombre.trim().toUpperCase()));
        activeTechs.forEach((t, i) => {
            const nameUpper = t.name.trim().toUpperCase();
            if (!existingNames.has(nameUpper) && !excludedNames.has(nameUpper)) {
                updatedWorkers.push({
                    id: Number(t.id) || Date.now() + i,
                    nombre: nameUpper,
                    color: colors[i % colors.length],
                    asignado: assignedNames.has(nameUpper)
                });
            }
        });
        const harmonizedOrg = { ...orgToLoad, trabajadores: updatedWorkers };
        history[newDate] = harmonizedOrg;

        return { ...prev, dailyOrg: harmonizedOrg, dailyOrgHistory: history };
    });
  };

  // RENDER DE FILA DE OBRA
  const renderProjectRow = (p: ProjectData, keyPrefix: string | number = 0) => {
      const isInactive = p.isFinished || p.isInvoiced;
      const warningStyle = !isInactive && p.hasWarning ? getWarningStyle(p.warningDate) : '';
      
      return (
          <div key={`${p.id}-${keyPrefix}`} className={`bg-white dark:bg-brand-panel p-5 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group hover:border-brand-teal/50 transition-all ${isInactive ? 'opacity-70 border-gray-300 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/20' : warningStyle ? warningStyle : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="flex-1 min-w-0 w-full">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                      <button onClick={() => viewProjectHistory(p.id)} className={`font-black px-2 py-0.5 rounded text-sm tracking-wider hover:scale-105 transition-transform cursor-pointer ${isInactive ? 'bg-gray-200 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300' : 'bg-brand-teal/10 dark:bg-brand-teal/20 text-brand-teal hover:bg-brand-teal hover:text-white'}`} title="Ver historial de partes">{p.id}</button>
                      <span className={`font-bold uppercase text-sm truncate ${isInactive ? 'text-gray-600 dark:text-gray-400 line-through decoration-brand-teal/50' : 'text-gray-900 dark:text-white'}`}>{p.name}</span>
                      {!isInactive && (
                          <div className="flex items-center gap-1">
                              <button onClick={(e) => { e.stopPropagation(); sendToDailyOrg(p); }} className="bg-brand-teal/10 dark:bg-brand-teal/20 hover:bg-brand-teal hover:text-white text-brand-teal dark:text-brand-lime p-1.5 rounded-lg transition-colors shadow-sm" title="Enviar a Organización Diaria"><CalendarIcon className="w-4 h-4" /></button>
                              <button onClick={(e) => { e.stopPropagation(); openGoogleCalendar(p); }} className="bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-400 p-1.5 rounded-lg transition-colors shadow-sm" title="Agendar en Google Calendar"><CalendarIcon className="w-4 h-4" /></button>
                          </div>
                      )}
                      {p.isFinished && <span className="bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-[9px] font-black px-2 py-0.5 rounded uppercase border border-teal-200 dark:border-teal-800">Terminada</span>}
                      {p.isInvoiced && (
                          <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[9px] font-black px-2 py-0.5 rounded uppercase border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                              <span>💰 Facturada</span>
                              {p.invoiceNum && <span className="font-mono underline">({p.invoiceNum})</span>}
                          </span>
                      )}
                      {!isInactive && p.hasWarning && getWarningBadge(p.warningDate)}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-2 text-[10px] text-gray-400 uppercase font-medium">
                      <div><span className="block text-gray-500 dark:text-gray-600 mb-0.5">Cliente</span><span className="text-gray-700 dark:text-gray-300 truncate block">{p.client}</span></div>
                      <div><span className="block text-gray-500 dark:text-gray-600 mb-0.5">Responsable</span><span className="text-gray-700 dark:text-gray-300 truncate block">{p.responsibleTech || '-'}</span></div>
                      <div><span className="block text-gray-500 dark:text-gray-600 mb-0.5">Valoración</span><span className="text-gray-700 dark:text-gray-300 truncate block">{p.valuation}</span></div>
                      <div><span className="block text-gray-500 dark:text-gray-600 mb-0.5">Presupuesto</span><span className="text-gray-700 dark:text-gray-300 truncate block">{p.budgetNum || '-'}</span></div>
                      {p.invoiceNum ? (
                          <div><span className="block text-purple-600 dark:text-purple-400 mb-0.5 font-bold">Nº Factura</span><span className="text-purple-700 dark:text-purple-300 font-mono font-bold truncate block">{p.invoiceNum}</span></div>
                      ) : p.location ? (
                          <div><span className="block text-gray-500 dark:text-gray-600 mb-0.5">Ubicación</span><span className="text-gray-700 dark:text-gray-300 truncate block">{p.location}</span></div>
                      ) : null}
                  </div>
                  {p.notes && <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-800"><p className="text-[10px] text-gray-500 italic truncate w-full">{p.notes}</p></div>}
                  {p.attachments && p.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                          {p.attachments.map((att, idx) => (
                              <button 
                                  key={idx} 
                                  onClick={() => setSelectedImage({data: att.data, type: att.type, name: att.name})}
                                  className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-[9px] font-bold text-gray-500 hover:text-brand-teal transition-colors"
                              >
                                  {att.type.includes('pdf') ? <FileTextIcon className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                                  <span className="truncate max-w-[100px]">{att.name}</span>
                              </button>
                          ))}
                      </div>
                  )}
              </div>
              <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
                  <button 
                      onClick={() => handleToggleFinished(p)} 
                      className={`p-2 rounded-lg transition-all cursor-pointer ${
                          p.isFinished 
                              ? 'text-teal-700 bg-teal-100 dark:bg-teal-900/40 hover:bg-teal-200 dark:hover:bg-teal-900/60 border border-teal-300 dark:border-teal-800 shadow-sm' 
                              : 'text-gray-400 hover:text-teal-600 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`} 
                      title={p.isFinished ? "Obra Terminada (Clic para reenviar informe con partes a m.domingogarcia29@gmail.com o reactivar)" : "Dar obra por Terminada y enviar correo con partes a m.domingogarcia29@gmail.com"}
                  >
                      <CheckCircleIcon className="w-4 h-4" />
                  </button>
                  <button 
                      onClick={() => handleQuickInvoice(p)} 
                      className={`p-2 rounded-lg transition-all cursor-pointer ${
                          p.isInvoiced 
                              ? 'text-purple-700 bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-900/60 border border-purple-300 dark:border-purple-800' 
                              : 'text-gray-400 hover:text-purple-600 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`} 
                      title={p.isInvoiced ? `Obra Facturada (Factura Nº ${p.invoiceNum || '-'}). Clic para editar/desmarcar` : "Dar obra por facturada (requiere Nº Factura)"}
                  >
                      <CheckCircleIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => generateProjectPDF(p)} className="p-2 text-gray-400 hover:text-brand-teal bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Generar PDF de Obra"><FileTextIcon className="w-4 h-4" /></button>
                  <button onClick={() => editProject(p)} className="p-2 text-gray-400 hover:text-brand-teal bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Editar Obra"><EditIcon className="w-4 h-4" /></button>
                  <button onClick={() => deleteProject(p.id)} className="p-2 text-gray-400 hover:text-red-500 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Eliminar Obra"><TrashIcon className="w-4 h-4" /></button>
              </div>
          </div>
      );
  };

  // RENDER DE FILA DE PRESUPUESTO
  const renderBudgetRow = (b: Budget, keyPrefix: string | number = 0) => {
      const budgetStyle = getBudgetStyle(b);
      return (
          <div key={`${b.id}-${keyPrefix}`} className={`p-5 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group hover:border-brand-teal/50 transition-all shadow-sm ${budgetStyle}`}>
              <div className="flex-1 min-w-0 w-full">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      {b.budgetNum && (
                          <span className="font-mono font-black px-2 py-0.5 rounded text-xs tracking-wider bg-brand-teal/10 dark:bg-brand-teal/20 text-brand-teal">
                              #{b.budgetNum}
                          </span>
                      )}
                      <span className="font-bold uppercase text-sm text-gray-900 dark:text-white truncate">
                          {b.name}
                      </span>
                      {b.isAccepted && (
                          <span className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-[9px] font-black px-2 py-0.5 rounded uppercase border border-green-200 dark:border-green-800 flex items-center gap-1">
                              ✓ Aceptado
                          </span>
                      )}
                      {b.isRejected && (
                          <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[9px] font-black px-2 py-0.5 rounded uppercase border border-red-200 dark:border-red-800 flex items-center gap-1">
                              ✕ Rechazado
                          </span>
                      )}
                      {b.isFinished && !b.isAccepted && !b.isRejected && (
                          <span className="bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-[9px] font-black px-2 py-0.5 rounded uppercase border border-teal-200 dark:border-teal-800">
                              Terminado
                          </span>
                      )}
                      {b.hasFolderData && (
                          <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[9px] font-black px-2 py-0.5 rounded uppercase border border-blue-200 dark:border-blue-800">
                              Datos Carpeta
                          </span>
                      )}
                      {!b.isFinished && !b.isAccepted && !b.isRejected && !b.deliveryDate && (
                          <span className="text-[9px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-900/40 animate-pulse">
                              Sin fecha
                          </span>
                      )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-[10px] text-gray-400 uppercase font-medium">
                      <div>
                          <span className="block text-gray-500 dark:text-gray-600 mb-0.5">Cliente</span>
                          <span className="text-gray-700 dark:text-gray-300 font-semibold truncate block">{b.client || '-'}</span>
                      </div>
                      <div>
                          <span className="block text-gray-500 dark:text-gray-600 mb-0.5">Fecha Entrega</span>
                          <span className="text-gray-700 dark:text-gray-300 font-semibold truncate block">{b.deliveryDate || 'No fijada'}</span>
                      </div>
                      <div className="col-span-2">
                          <span className="block text-gray-500 dark:text-gray-600 mb-0.5">Archivo Excel</span>
                          <span className="text-gray-700 dark:text-gray-300 font-mono truncate block">{b.excelName || '-'}</span>
                      </div>
                  </div>
                  {b.comments && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                          <p className="text-[10px] text-gray-500 italic truncate w-full">{b.comments}</p>
                      </div>
                  )}
              </div>
              <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
                  <button 
                      onClick={() => toggleBudgetAccepted(b)} 
                      className={`p-2 rounded-lg transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer ${
                          b.isAccepted 
                              ? 'bg-green-600 text-white hover:bg-green-700' 
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30'
                      }`}
                      title={b.isAccepted ? 'Desmarcar Aceptado' : 'Aceptar Presupuesto (Crear Obra)'}
                  >
                      <CheckCircleIcon className="w-4 h-4" />
                  </button>
                  <button 
                      onClick={() => toggleBudgetRejected(b)} 
                      className={`p-2 rounded-lg transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer ${
                          b.isRejected 
                              ? 'bg-red-600 text-white hover:bg-red-700' 
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
                      }`}
                      title={b.isRejected ? 'Desmarcar Rechazado' : 'Marcar como Rechazado'}
                  >
                      <XCircleIcon className="w-4 h-4" />
                  </button>
                  <button 
                      onClick={() => editBudget(b)} 
                      className="p-2 text-gray-400 hover:text-brand-teal bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer" 
                      title="Editar presupuesto"
                  >
                      <EditIcon className="w-4 h-4" />
                  </button>
                  <button 
                      onClick={() => deleteBudget(b.id)} 
                      className="p-2 text-gray-400 hover:text-red-500 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer" 
                      title="Eliminar presupuesto"
                  >
                      <TrashIcon className="w-4 h-4" />
                  </button>
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
                {upcomingAbsences.map((r, idx) => {
                    if (!r.startDate || !r.startDate.includes('-')) return null;
                    const [y, m, d] = r.startDate.split('-').map(Number);
                    const start = new Date(y, m-1, d);
                    const today = new Date(); today.setHours(0,0,0,0);
                    const diff = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    
                    let colorClass = "bg-green-100 text-green-800 border-green-200";
                    if (diff <= 2) colorClass = "bg-orange-100 text-orange-800 border-orange-200";
                    if (diff <= 1) colorClass = "bg-red-100 text-red-800 border-red-200 animate-pulse";

                    return (
                        <div key={`${r.id || 'vac'}-${idx}`} className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 shadow-sm ${colorClass}`}>
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
              <button onClick={(e) => { 
                  e.stopPropagation(); 
                  const link = document.createElement('a'); 
                  link.href = selectedImage.data; 
                  const ext = selectedImage.type?.split('/')[1] || 'DOC';
                  link.download = selectedImage.name || `ARCHIVO_${selectedImage.type?.toUpperCase().split('/')[1] || 'DOC'}`; 
                  link.click(); 
              }} className="bg-brand-teal text-white p-3 rounded-full shadow-xl"><DownloadIcon className="w-6 h-6" /></button>
              <button className="bg-white/10 text-white p-3 rounded-full" onClick={() => setSelectedImage(null)}><XIcon className="w-6 h-6" /></button>
          </div>
          {selectedImage.data && (
            selectedImage.type.includes('pdf') ? (
              <iframe src={selectedImage.data} className="w-full h-full max-w-4xl max-h-[85vh] rounded-lg shadow-2xl bg-white" />
            ) : (
              <img src={selectedImage.data} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10" />
            )
          )}
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
        
        {/* Google Workspace / Gmail status */}
        <div className="ml-auto flex items-center pr-4 py-2">
          {googleUser && hasGmailPermission ? (
            <div className="flex items-center gap-2 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold hidden sm:inline">Gmail:</span>
              <span className="truncate max-w-[130px]" title={googleUser.email || ''}>{googleUser.email}</span>
              <button onClick={handleGoogleLogout} className="text-gray-400 hover:text-red-500 ml-1 text-xs font-bold" title="Desconectar cuenta Google">✕</button>
            </div>
          ) : googleUser && !hasGmailPermission ? (
            <button
              onClick={handleGoogleLogin}
              disabled={isGoogleLoggingIn}
              className="flex items-center gap-2 text-xs bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 px-3 py-1.5 rounded-xl text-amber-800 dark:text-amber-200 hover:bg-amber-100 shadow-sm font-bold transition-all whitespace-nowrap cursor-pointer"
              title="Cuenta conectada, pero falta autorizar permiso de envío de correos"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="truncate max-w-[110px]">{googleUser.email}</span>
              <span className="bg-amber-200 dark:bg-amber-900/60 px-1.5 py-0.5 rounded text-[10px] font-black text-amber-900 dark:text-amber-100">Autorizar Gmail</span>
            </button>
          ) : (
            <button 
              onClick={handleGoogleLogin} 
              disabled={isGoogleLoggingIn}
              className="flex items-center gap-2 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-3 py-1.5 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm font-bold transition-all whitespace-nowrap cursor-pointer" 
              title="Conectar con Google para permitir envío de correos de obras terminadas a m.domingogarcia29@gmail.com"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <span>{isGoogleLoggingIn ? 'Conectando...' : 'Conectar Gmail'}</span>
            </button>
          )}
        </div>
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
            
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700 mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                 <select value={filterTech} onChange={e => setFilterTech(e.target.value)} className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm rounded-lg p-2.5 text-gray-900 dark:text-white outline-none">
                    <option value="">Técnicos...</option>
                    <option value="__NO_TECH__">⚠️ Sin Técnico Asignado</option>
                    {data.technicians.filter(t => t.active !== false).map((t, idx) => <option key={`${t.id}-${idx}`} value={t.name}>{t.name}</option>)}
                 </select>
                 <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm rounded-lg p-2.5 text-gray-900 dark:text-white outline-none">
                    <option value="">Clientes...</option>
                    {uniqueClients.map((c, idx) => <option key={`${c}-${idx}`} value={c}>{c}</option>)}
                 </select>
                 <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm rounded-lg p-2.5 text-gray-900 dark:text-white outline-none">
                    <option value="">Obras...</option>
                    {data.projectsDetailed
                        .filter(p => !filterClient || (p.client && p.client.toLowerCase() === filterClient.toLowerCase()))
                        .map((p, idx) => <option key={`${p.id}-${idx}`} value={p.id}>{p.id} - {p.name}</option>)}
                 </select>
                 <input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm rounded-lg p-2.5 text-gray-900 dark:text-white outline-none dark:[color-scheme:dark]" />
                 <input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm rounded-lg p-2.5 text-gray-900 dark:text-white outline-none dark:[color-scheme:dark]" />
            </div>
            {reportViewMode === 'overtime' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">Revisión de Horas Extra</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={downloadOvertimePDF}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
                    >
                      <FileTextIcon className="w-4 h-4" /> PDF General
                    </button>
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
                        .map((r, rIdx) => {
                          console.log('Report ID:', r.id, 'Status:', r.overtimeStatus);
                          return (
                          <div key={`${r.id || 'ot'}-${rIdx}`} className="p-4 rounded-lg border bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-bold text-gray-800 dark:text-white">{r.technician} - {r.projectNum}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-300 flex flex-wrap items-center gap-1.5">
                                  <span>{r.date} | {r.overtimeHours}h ({r.overtimeType})</span>
                                  {r.isNightShift && <span className="px-1.5 py-0.5 text-[9px] bg-indigo-500/20 text-indigo-400 font-black rounded uppercase tracking-wider border border-indigo-500/30">NOCHE</span>}
                                  {r.isOvernight && <span className="px-1.5 py-0.5 text-[9px] bg-purple-500/20 text-purple-400 font-black rounded uppercase tracking-wider border border-purple-500/30">PERNOCTA</span>}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => { 
                                  const week = getWeekRange(r.date);
                                  console.log('Expanding week:', week, 'Report ID:', r.id);
                                  // Limpiamos filtros para asegurar que el parte sea visible
                                  setFilterTech('');
                                  setFilterClient('');
                                  setFilterProject('');
                                  setFilterDateStart('');
                                  setFilterDateEnd('');
                                  setExpandedWeeks({ [week]: true });
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
                        .map((r, rIdx) => (
                          <div key={`${r.id || 'otv'}-${rIdx}`} className="p-4 rounded-lg border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-bold text-gray-800 dark:text-white">{r.technician} - {r.projectNum}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-300 flex flex-wrap items-center gap-1.5">
                                  <span>{r.date} | {r.overtimeHours}h ({r.overtimeType})</span>
                                  {r.isNightShift && <span className="px-1.5 py-0.5 text-[9px] bg-indigo-500/20 text-indigo-400 font-black rounded uppercase tracking-wider border border-indigo-500/30">NOCHE</span>}
                                  {r.isOvernight && <span className="px-1.5 py-0.5 text-[9px] bg-purple-500/20 text-purple-400 font-black rounded uppercase tracking-wider border border-purple-500/30">PERNOCTA</span>}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <button onClick={() => { 
                                  const week = getWeekRange(r.date);
                                  console.log('Expanding week (validated):', week, 'Report ID:', r.id);
                                  // Limpiamos filtros para asegurar que el parte sea visible
                                  setFilterTech('');
                                  setFilterClient('');
                                  setFilterProject('');
                                  setFilterDateStart('');
                                  setFilterDateEnd('');
                                  setExpandedWeeks({ [week]: true });
                                  setReportViewMode('list'); 
                                  setExpandedReportId(r.id); 
                                  console.log('Setting expandedReportId (validated) to:', r.id);
                                }} className="text-brand-teal hover:underline text-sm font-bold">Ver Parte</button>
                                <button onClick={async () => {
                                  await onUpdateReport({ ...r, overtimeStatus: 'pending' }, false);
                                  toast.info(`Las horas extra de ${r.technician} han vuelto a estado Pendiente de Validación.`);
                                }} className="bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 dark:text-amber-300 px-3 py-1 rounded text-sm font-bold transition-colors">Desvalidar</button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {reportViewMode === 'tech_overtime' && (() => {
              const allOvertimeReports = data.reports.filter(r => r.overtimeHours > 0);
              const availableMonths = (Array.from(new Set(allOvertimeReports.map(r => {
                const d = new Date(r.date);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              }))) as string[]).sort((a, b) => b.localeCompare(a));

              const activeMonthKey = selectedMonthForReport || (availableMonths[0] || '');

              return (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                      <ClockIcon className="w-5 h-5 text-brand-teal" /> Historial Horas Extra por Técnico
                    </h3>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-200 dark:border-gray-700/80">
                    <div className="space-y-1">
                      <h4 className="font-bold text-gray-800 dark:text-white text-sm">Generar Informe Mensual (Todos los Técnicos)</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Descarga el resumen completo de horas extra, noches y pernoctas para el mes seleccionado.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        value={activeMonthKey}
                        onChange={e => setSelectedMonthForReport(e.target.value)}
                        className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm rounded-lg px-3 py-2 text-gray-900 dark:text-white outline-none font-bold"
                      >
                        <option value="">Seleccionar mes...</option>
                        {availableMonths.map(monthKey => (
                          <option key={monthKey} value={monthKey}>
                            {getMonthYearLabelFromKey(monthKey)}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          if (!activeMonthKey) {
                            toast.error("Por favor selecciona un mes de la lista");
                            return;
                          }
                          downloadMonthlyOvertimeAllTechsExcel(activeMonthKey);
                        }}
                        disabled={!activeMonthKey}
                        className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                          activeMonthKey
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <FileTextIcon className="w-4 h-4" /> Exportar XLS
                      </button>
                      <button
                        onClick={() => {
                          if (!activeMonthKey) {
                            toast.error("Por favor selecciona un mes de la lista");
                            return;
                          }
                          downloadMonthlyOvertimeAllTechsPDF(activeMonthKey);
                        }}
                        disabled={!activeMonthKey}
                        className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                          activeMonthKey
                            ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <FileTextIcon className="w-4 h-4" /> Exportar PDF
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-8 mt-4">
                    {data.technicians.map((tech, techIdx) => {
                      // Agrupación por MESES para este técnico
                      const techReports = data.reports.filter(r => r.technician === tech.name && r.overtimeHours > 0);
                      if (techReports.length === 0) return null;

                      const monthlyGroups: Record<string, { label: string, total: number, norm: number, noct: number, finde: number, nights: number, overnights: number }> = {};
                      techReports.forEach(r => {
                        const date = new Date(r.date);
                        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                        const label = getMonthYearLabel(r.date);
                        if (!monthlyGroups[key]) monthlyGroups[key] = { label, total: 0, norm: 0, noct: 0, finde: 0, nights: 0, overnights: 0 };
                        const ot = r.overtimeHours;
                        monthlyGroups[key].total += ot;
                        if (r.overtimeType === 'NORMAL') monthlyGroups[key].norm += ot;
                        else if (r.overtimeType === 'NOCTURNA') monthlyGroups[key].noct += ot;
                        else if (r.overtimeType === 'FINDE SEMANA') monthlyGroups[key].finde += ot;
                        
                        if (r.isNightShift) monthlyGroups[key].nights += 1;
                        if (r.isOvernight) monthlyGroups[key].overnights += 1;
                      });

                      const sortedMonths = Object.entries(monthlyGroups).sort((a, b) => (b[0] || '').localeCompare(a[0] || ''));

                      return (
                        <div key={`${tech.id || 'tech'}-${techIdx}`} className="bg-white dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                          <div className="bg-gray-50 dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal font-bold">
                              {tech.name.charAt(0)}
                            </div>
                            <h4 className="font-black text-gray-800 dark:text-white uppercase tracking-wider">{tech.name}</h4>
                          </div>
                          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {sortedMonths.map(([monthKey, monthData]) => {
                              const monthReports = techReports.filter(r => {
                                const date = new Date(r.date);
                                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                                return key === monthKey;
                              });
                              const isMonthExpanded = !!expandedTechMonths[`${tech.name}_${monthKey}`];

                              return (
                                <div key={monthKey} className="bg-brand-dark p-4 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden group flex flex-col justify-between">
                                <div className="absolute top-0 right-0 w-1 h-full bg-brand-teal opacity-40 group-hover:opacity-100 transition-opacity"></div>
                                <div>
                                  <div className="flex justify-between items-start mb-4">
                                    <div>
                                      <h5 className="text-white font-black text-sm tracking-widest uppercase">{monthData.label}</h5>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          downloadTechMonthPDF(tech.name, monthKey, monthData, monthReports);
                                        }}
                                        className="mt-2 flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-colors shadow-md"
                                      >
                                        <FileTextIcon className="w-3 h-3" /> PDF
                                      </button>
                                    </div>
                                    <span className="text-brand-lime font-black text-2xl tracking-tighter">{monthData.total}h</span>
                                  </div>
                                  <div className="grid grid-cols-5 gap-1.5">
                                    <div className="bg-white/5 p-1.5 rounded-lg text-center flex flex-col justify-center min-w-0">
                                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider truncate mb-0.5" title="Horas Normales">Norm</p>
                                      <p className="text-white font-black text-xs sm:text-sm">{monthData.norm}</p>
                                    </div>
                                    <div className="bg-white/5 p-1.5 rounded-lg text-center flex flex-col justify-center min-w-0">
                                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider truncate mb-0.5" title="Horas Nocturnas">Noc</p>
                                      <p className="text-white font-black text-xs sm:text-sm">{monthData.noct}</p>
                                    </div>
                                    <div className="bg-white/5 p-1.5 rounded-lg text-center flex flex-col justify-center min-w-0">
                                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider truncate mb-0.5" title="Horas Fin de Semana">Fin</p>
                                      <p className="text-white font-black text-xs sm:text-sm">{monthData.finde}</p>
                                    </div>
                                    <div className="bg-white/5 p-1.5 rounded-lg text-center flex flex-col justify-center min-w-0 border border-indigo-500/20">
                                      <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider truncate mb-0.5" title="Noches">🌙 Noc</p>
                                      <p className="text-indigo-300 font-black text-xs sm:text-sm">{monthData.nights}</p>
                                    </div>
                                    <div className="bg-white/5 p-1.5 rounded-lg text-center flex flex-col justify-center min-w-0 border border-purple-500/20">
                                      <p className="text-[9px] text-purple-400 font-bold uppercase tracking-wider truncate mb-0.5" title="Pernoctas">🏨 Per</p>
                                      <p className="text-purple-300 font-black text-xs sm:text-sm">{monthData.overnights}</p>
                                    </div>
                                  </div>
                                </div>

                                <button
                                  onClick={() => setExpandedTechMonths(prev => ({ ...prev, [`${tech.name}_${monthKey}`]: !isMonthExpanded }))}
                                  className="mt-4 w-full flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-colors"
                                >
                                  {isMonthExpanded ? (
                                    <>
                                      <ChevronDownIcon className="w-4 h-4 rotate-180 transition-transform" />
                                      Ocultar Partes
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDownIcon className="w-4 h-4 transition-transform" />
                                      Ver Partes ({monthReports.length})
                                    </>
                                  )}
                                </button>

                                {isMonthExpanded && (
                                  <div className="mt-4 pt-4 border-t border-white/10 space-y-2 animate-fade-in text-left w-full">
                                    <h6 className="text-[10px] font-black tracking-wider uppercase text-gray-400 mb-2">Partes de {tech.name} - {monthData.label}</h6>
                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                      {monthReports.map((r, rIdx) => (
                                        <div key={`${r.id || 'mr'}-${rIdx}`} className="bg-white/5 p-3 rounded-lg border border-white/5 flex flex-col justify-between items-start gap-2 hover:bg-white/10 transition-colors">
                                          <div className="w-full">
                                            <div className="flex justify-between items-center gap-2">
                                              <span className="text-[11px] font-black text-brand-lime">{formatDateToSpanish(r.date)}</span>
                                              <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${r.overtimeStatus === 'validated' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'}`}>
                                                {r.overtimeStatus === 'validated' ? 'Validado' : 'Pendiente'}
                                              </span>
                                            </div>
                                            <p className="text-xs text-white font-bold mt-1 line-clamp-1">{r.projectNum} - {resolveProjectFullName(r.projectNum)}</p>
                                            {r.description && <p className="text-[10px] text-gray-400 italic mt-0.5 line-clamp-2">{r.description}</p>}
                                          </div>
                                          <div className="flex items-center gap-2 w-full justify-between pt-1 border-t border-white/5">
                                            <div className="flex flex-wrap gap-1 items-center">
                                              <span className="text-white font-black text-[9px] bg-white/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                +{r.overtimeHours}h ({r.overtimeType})
                                              </span>
                                              {r.isNightShift && (
                                                <span className="text-[8px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                                                  Noche
                                                </span>
                                              )}
                                              {r.isOvernight && (
                                                <span className="text-[8px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                                                  Pernocta
                                                </span>
                                              )}
                                            </div>
                                            <button 
                                              onClick={() => {
                                                const week = getWeekRange(r.date);
                                                setFilterTech('');
                                                setFilterProject('');
                                                setFilterDateStart('');
                                                setFilterDateEnd('');
                                                setExpandedWeeks({ [week]: true });
                                                setReportViewMode('list');
                                                setExpandedReportId(r.id);
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                              }} 
                                              className="text-brand-teal hover:text-brand-teal/80 hover:underline text-[10px] font-black uppercase tracking-wider whitespace-nowrap"
                                            >
                                              Ver Parte
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )})()}

            {reportViewMode === 'list' && (
                <>
                    <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">Registro de Actividad</h3>
                        <div className="flex gap-2">
                            <button onClick={downloadCSV} className="bg-brand-teal hover:bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm transition-colors"><DownloadIcon className="w-4 h-4" /> CSV</button>
                            <button onClick={downloadPDF} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm transition-colors"><FileTextIcon className="w-4 h-4" /> PDF</button>
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
                                {Object.entries(weeks).sort((a, b) => (b[1][0]?.date || '').localeCompare(a[1][0]?.date || '')).map(([weekRange, reports]) => {
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
                                                            {reports.map((report, rIdx) => {
                                                                const total = Object.values(report.expenses).reduce((a: number, b: any) => (typeof b === 'number' ? a + b : a), 0) as number;
                                                                const isReportExpanded = expandedReportId === report.id;
                                                                return (
                                                                    <React.Fragment key={`${report.id || 'rep'}-${rIdx}`}>
                                                                        <tr className={`${report.overtimeHours > 0 ? (report.overtimeStatus === 'validated' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-orange-50 dark:bg-orange-900/20') : 'bg-white dark:bg-gray-800/20'} hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors group`}>
                                                                            <td className="px-3 py-3">
                                                                                <button onClick={() => toggleExpandReport(report.id)} className="text-gray-400 hover:text-brand-teal transition-colors"><EyeIcon className="w-4 h-4" /></button>
                                                                            </td>
                                                                            <td className="px-3 py-3 font-mono text-[11px] text-gray-500 dark:text-gray-400">{report.date}</td>
                                                                            <td className="px-3 py-3 text-xs font-black text-gray-700 dark:text-gray-200">
                                                                                {report.technician && report.technician.trim() ? (
                                                                                    report.technician
                                                                                ) : (
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <span className="px-2 py-0.5 text-[10px] bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 font-bold rounded border border-red-300 dark:border-red-800 animate-pulse">
                                                                                            ⚠️ Sin técnico
                                                                                        </span>
                                                                                        <select
                                                                                            defaultValue=""
                                                                                            onChange={async (e) => {
                                                                                                const newTech = e.target.value;
                                                                                                if (!newTech) return;
                                                                                                await onUpdateReport({ ...report, technician: newTech }, false);
                                                                                                toast.success(`Técnico ${newTech} asignado correctamente.`);
                                                                                            }}
                                                                                            className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-1 text-gray-900 dark:text-white outline-none cursor-pointer"
                                                                                        >
                                                                                            <option value="" disabled>Asignar...</option>
                                                                                            {data.technicians.filter(t => t.active !== false).map((t, tIdx) => (
                                                                                                <option key={`${t.id || 'tech'}-${tIdx}`} value={t.name}>{t.name}</option>
                                                                                            ))}
                                                                                        </select>
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-3 py-3 text-xs font-bold text-brand-teal/80">
                                                                                {report.projectNum}
                                                                                {resolveProjectFullName(report.projectNum) !== report.projectNum && (<span className="font-normal text-gray-500 dark:text-gray-400 ml-1">- {resolveProjectFullName(report.projectNum)}</span>)}
                                                                            </td>
                                                                            <td className="px-3 py-3 text-[11px] text-gray-500 italic max-w-xs truncate">{report.description || 'Sin descripción'}</td>
                                                                            <td className="px-3 py-3 text-right font-black text-xs text-yellow-600 dark:text-yellow-500">{report.overtimeHours > 0 ? `+${report.overtimeHours}h (${report.overtimeStatus === 'validated' ? 'Validado' : 'Pendiente'})` : '-'}</td>
                                                                            <td className="px-3 py-3 text-right text-xs font-black text-gray-800 dark:text-white">{total > 0 ? `${total.toFixed(2)}€` : '-'}</td>
                                                                            <td className="px-3 py-3 text-center">
                                                                                {onEditReport && (
                                                                                    <button onClick={() => onEditReport(report)} className="text-gray-400 hover:text-brand-teal transition-colors mr-2.5" title="Editar parte">
                                                                                        <EditIcon className="w-4 h-4" />
                                                                                    </button>
                                                                                )}
                                                                                <button onClick={() => onDeleteReport(report.id)} className="text-red-500/30 hover:text-red-500 transition-colors" title="Eliminar parte"><TrashIcon className="w-4 h-4" /></button>
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
                                                                                            {(report.isNightShift || report.isOvernight) && (
                                                                                                <div className="flex flex-wrap gap-2 mt-2">
                                                                                                    {report.isNightShift && (
                                                                                                        <span className="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border border-indigo-200 dark:border-indigo-900/30">
                                                                                                            🌙 Noche
                                                                                                        </span>
                                                                                                    )}
                                                                                                    {report.isOvernight && (
                                                                                                        <span className="inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border border-purple-200 dark:border-purple-900/30">
                                                                                                            🏨 Pernocta
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                        <div>
                                                                                            <p className="text-[10px] uppercase font-black text-gray-500 tracking-widest mb-3">Evidencias / Tickets</p>
                                                                                            <div className="flex gap-3 mt-1 overflow-x-auto pb-2 custom-scrollbar">
                                                                                                {report.tickets?.map((t, idx) => (
                                                                                                    <div key={idx} className="relative group/img flex-shrink-0">
                                                                                                        {t.data ? (
                                                                                                            <img src={t.data} onClick={() => setSelectedImage({data: t.data, type: t.type})} className="w-20 h-20 object-cover rounded-lg cursor-pointer hover:border-brand-lime border-2 border-gray-300 dark:border-gray-800 transition-all" />
                                                                                                        ) : (
                                                                                                            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center p-1 text-center">
                                                                                                                <CloudIcon className="w-6 h-6 text-brand-teal mb-1" />
                                                                                                                <span className="text-[7px] font-black text-gray-500 uppercase leading-none">En Drive</span>
                                                                                                            </div>
                                                                                                        )}
                                                                                                        <div className="absolute top-0 right-0 p-1 opacity-0 group-hover/img:opacity-100 transition-opacity"><span className="bg-brand-teal text-[8px] font-bold px-1 rounded text-white">{t.type}</span></div>
                                                                                                    </div>
                                                                                                ))}
                                                                                                {(!report.tickets || report.tickets.length === 0) && <p className="text-[10px] text-gray-500 italic">No hay archivos adjuntos.</p>}
                                                                                            </div>

                                                                                            {/* Desglose de gastos solicitado por el usuario */}
                                                                                            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-800">
                                                                                                <p className="text-[9px] uppercase font-black text-gray-400 tracking-widest mb-2">Desglose de Gastos</p>
                                                                                                <div className="flex flex-wrap gap-2">
                                                                                                    {report.expenses.food > 0 && (
                                                                                                        <div className="bg-white dark:bg-gray-950/40 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 flex flex-col">
                                                                                                            <span className="text-[8px] text-gray-500 font-bold uppercase">Comida</span>
                                                                                                            <span className="text-xs font-black text-brand-teal">{report.expenses.food.toFixed(2)}€</span>
                                                                                                        </div>
                                                                                                    )}
                                                                                                    {report.expenses.gas > 0 && (
                                                                                                        <div className="bg-white dark:bg-gray-950/40 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 flex flex-col">
                                                                                                            <span className="text-[8px] text-gray-500 font-bold uppercase">Gasolina</span>
                                                                                                            <span className="text-xs font-black text-brand-teal">{report.expenses.gas.toFixed(2)}€</span>
                                                                                                        </div>
                                                                                                    )}
                                                                                                    {report.expenses.parking > 0 && (
                                                                                                        <div className="bg-white dark:bg-gray-950/40 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 flex flex-col">
                                                                                                            <span className="text-[8px] text-gray-500 font-bold uppercase">Parking</span>
                                                                                                            <span className="text-xs font-black text-brand-teal">{report.expenses.parking.toFixed(2)}€</span>
                                                                                                        </div>
                                                                                                    )}
                                                                                                    {report.expenses.others > 0 && (
                                                                                                        <div className="bg-white dark:bg-gray-950/40 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 flex flex-col">
                                                                                                            <span className="text-[8px] text-gray-500 font-bold uppercase">Otros ({report.expenses.othersDesc || 'Sin desc.'})</span>
                                                                                                            <span className="text-xs font-black text-brand-teal">{report.expenses.others.toFixed(2)}€</span>
                                                                                                        </div>
                                                                                                    )}
                                                                                                    {total === 0 && <p className="text-[10px] text-gray-500 italic">Sin gastos registrados</p>}
                                                                                                </div>
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
                    {projectsSummary.map(([projectNum, summary], pIdx) => (
                        <div key={`psum-${projectNum}-${pIdx}`} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
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
                    {hoursSummary.map(([week, techs], wIdx) => (
                        <div key={`hsum-${week}-${wIdx}`} className="bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="bg-gray-100 dark:bg-gray-800 p-3 text-xs font-bold text-brand-teal uppercase">Semana: {week}</div>
                            <table className="w-full text-xs text-left">
                                <thead><tr className="text-gray-500 bg-black/5 dark:bg-black/20"><th className="px-4 py-2">Técnico</th><th className="px-4 py-2 text-right">Horas</th><th className="px-4 py-2 text-right">Extras</th></tr></thead>
                                <tbody>
                                    {(Object.entries(techs) as [string, any][]).map(([tech, h], tIdx) => (
                                        <tr key={`htech-${tech}-${tIdx}`} className="border-t border-gray-200 dark:border-gray-800"><td className="px-4 py-2 font-bold text-gray-700 dark:text-gray-300">{tech}</td><td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">{h.reg.toFixed(1)}h</td><td className="px-4 py-2 text-right text-yellow-600 dark:text-yellow-500">+{h.ot.toFixed(1)}h</td></tr>
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
                {Object.keys(groupedExpenses.tree).sort((a,b) => (groupedExpenses.dateMap[b] || '').localeCompare(groupedExpenses.dateMap[a] || '')).map((month, mIdx) => {
                    const weeksInMonth = groupedExpenses.tree[month];
                    return (
                        <div key={`exp-m-${month}-${mIdx}`} className="space-y-4">
                            <div className="bg-brand-teal/10 dark:bg-brand-teal/20 border-l-4 border-brand-teal px-4 py-3 flex items-center gap-3">
                                <h4 className="text-brand-teal dark:text-brand-teal font-black text-xl tracking-widest">{month}</h4>
                            </div>
                            
                            {Object.keys(weeksInMonth).sort((a,b) => (groupedExpenses.dateMap[b] || '').localeCompare(groupedExpenses.dateMap[a] || '')).map((week, wIdx) => {
                                const isExpanded = !!expandedWeeks[week];
                                const techs = weeksInMonth[week];
                                const totalWeek: number = (Object.values(techs) as number[]).reduce((a, b) => a + b, 0);

                                return (
                                    <div key={`exp-w-${week}-${wIdx}`} className="bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
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
                                                {Object.entries(techs).map(([tech, rawTotal], tIdx) => {
                                                    const total = Number(rawTotal);
                                                    const paymentKey = `${week}_${tech}`;
                                                    const isPaid = data.expensesPayments?.[paymentKey] || false;
                                                    
                                                    return (
                                                        <div key={`exp-t-${tech}-${tIdx}`} className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 group relative ${isPaid ? 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-600' : 'bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 hover:border-brand-teal'}`}>
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
                {[...(data.technicians || [])].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })).map((t) => {
                    const techReports = data.reports.filter(r => r.technician === t.name);
                    const groupedByMonth: Record<string, { label: string, reports: WorkReport[] }> = {};
                    techReports.forEach(r => {
                        const d = new Date(r.date);
                        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        const label = getMonthYearLabel(r.date);
                        if (!groupedByMonth[key]) groupedByMonth[key] = { label, reports: [] };
                        groupedByMonth[key].reports.push(r);
                    });
                    const sortedMonths = Object.entries(groupedByMonth).sort((a, b) => (b[0] || '').localeCompare(a[0] || ''));
                    const isExpanded = expandedTechId === t.id;
                    const isEditing = editingTechId === t.id;

                    return (
                        <div key={t.id || t.name} className="space-y-2">
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center group shadow-sm hover:border-brand-teal/50 transition-all">
                                {isEditing ? (
                                    <div className="flex-1 flex gap-2">
                                        <input value={editTechName} onChange={e => setEditTechName(e.target.value)} className="flex-1 bg-gray-50 dark:bg-gray-900 border border-brand-teal rounded px-2 py-1 text-xs text-gray-900 dark:text-white" placeholder="Nombre" />
                                        <input value={editTechPwd} onChange={e => setEditTechPwd(e.target.value)} className="flex-1 bg-gray-50 dark:bg-gray-900 border border-brand-teal rounded px-2 py-1 text-xs text-gray-900 dark:text-white" placeholder="Contraseña" />
                                        <button onClick={saveEditingTech} className="text-green-500 hover:text-green-600 p-1"><SaveIcon className="w-4 h-4" /></button>
                                        <button onClick={cancelEditingTech} className="text-red-500 hover:text-red-600 p-1"><XIcon className="w-4 h-4" /></button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-brand-teal/10 dark:bg-brand-teal/20 rounded-full flex items-center justify-center text-brand-teal font-bold">{t.name.charAt(0)}</div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{t.name}</p>
                                                    {t.active === false ? (
                                                        <span className="bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-[9px] font-black px-1.5 py-0.5 rounded uppercase border border-red-200 dark:border-red-900/40">Inactivo</span>
                                                    ) : (
                                                        <span className="bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 text-[9px] font-black px-1.5 py-0.5 rounded uppercase border border-green-200 dark:border-green-900/40">Activo</span>
                                                    )}
                                                    {t.hideInVacations && (
                                                        <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[9px] font-black px-1.5 py-0.5 rounded uppercase border border-amber-200 dark:border-amber-900/40">Oculto en Vacaciones</span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{techReports.length} partes registrados</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <label className="flex items-center gap-1.5 cursor-pointer bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-brand-teal/50 transition-all select-none">
                                                <input 
                                                    type="checkbox" 
                                                    checked={t.active !== false} 
                                                    onChange={() => handleToggleTechActive(t)}
                                                    className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-700 text-brand-teal focus:ring-brand-teal focus:ring-0 cursor-pointer" 
                                                />
                                                <span className="text-[10px] uppercase font-black text-gray-600 dark:text-gray-400">Activo</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-brand-teal/50 transition-all select-none">
                                                <input 
                                                    type="checkbox" 
                                                    checked={!t.hideInVacations} 
                                                    onChange={() => handleToggleTechVacations(t)}
                                                    className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-700 text-brand-teal focus:ring-brand-teal focus:ring-0 cursor-pointer" 
                                                />
                                                <span className="text-[10px] uppercase font-black text-gray-600 dark:text-gray-400">Vacaciones</span>
                                            </label>
                                            <button 
                                                onClick={() => setExpandedTechId(isExpanded ? null : t.id)}
                                                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${isExpanded ? 'bg-brand-teal text-white border-brand-teal' : 'text-brand-teal border-brand-teal/30 hover:bg-brand-teal/5'}`}
                                            >
                                                {isExpanded ? 'Ocultar Historial' : 'Ver Historial'}
                                            </button>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => startEditingTech(t)} className="text-gray-400 dark:text-gray-500 hover:text-brand-teal" title="Editar técnico"><EditIcon className="w-4 h-4" /></button>
                                                <button onClick={() => handleDeleteTech(t)} className="text-gray-400 dark:text-gray-500 hover:text-red-500" title="Eliminar técnico"><TrashIcon className="w-4 h-4" /></button>
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
                                                            {monthData.reports.sort((a,b) => (b.date || '').localeCompare(a.date || '')).map((r, rIdx) => (
                                                                <div 
                                                                    key={`${r.id || 'techrep'}-${rIdx}`} 
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
                    <div key={v || i} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center group shadow-sm hover:border-brand-teal/50 transition-all">
                        {editingIndex === i ? (
                            <div className="flex-1 flex gap-2">
                                <input value={editValue} onChange={e => setEditValue(e.target.value)} className="flex-1 bg-gray-50 dark:bg-gray-900 border border-brand-teal rounded px-2 py-1 text-xs text-gray-900 dark:text-white" />
                                <button onClick={saveEditingVehicle} className="text-green-500 hover:text-green-600 p-1"><SaveIcon className="w-4 h-4" /></button>
                                <button onClick={cancelEditingVehicle} className="text-red-500 hover:text-red-600 p-1"><XIcon className="w-4 h-4" /></button>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-brand-teal/10 dark:bg-brand-teal/20 rounded-full flex items-center justify-center text-brand-teal font-bold"><TruckIcon className="w-4 h-4" /></div>
                                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{v}</p>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEditingVehicle(i, v)} className="text-gray-400 dark:text-gray-500 hover:text-brand-teal" title="Editar vehículo"><EditIcon className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteVehicle(v)} className="text-gray-400 dark:text-gray-500 hover:text-red-500" title="Eliminar vehículo"><TrashIcon className="w-4 h-4" /></button>
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 py-2">
                             <label className="flex items-center gap-3 cursor-pointer bg-gray-100 dark:bg-gray-800/50 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                                 <input type="checkbox" checked={budgetForm.hasFolderData} onChange={e => setBudgetForm({...budgetForm, hasFolderData: e.target.checked})} className="w-4 h-4 rounded border-gray-400 dark:border-gray-600 text-brand-teal bg-white dark:bg-gray-800 focus:ring-0 cursor-pointer" />
                                 <span className="text-xs font-bold uppercase text-gray-700 dark:text-white">Datos Carpeta</span>
                             </label>
                             <label className="flex items-center gap-3 cursor-pointer bg-gray-100 dark:bg-gray-800/50 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                                 <input type="checkbox" checked={budgetForm.isFinished} onChange={e => setBudgetForm({...budgetForm, isFinished: e.target.checked})} className="w-4 h-4 rounded border-gray-400 dark:border-gray-600 text-brand-teal bg-white dark:bg-gray-800 focus:ring-0 cursor-pointer" />
                                 <span className="text-xs font-bold uppercase text-gray-700 dark:text-white">Terminado</span>
                             </label>
                             <label className="flex items-center gap-3 cursor-pointer bg-gray-100 dark:bg-gray-800/50 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                                 <input 
                                     type="checkbox" 
                                     checked={budgetForm.isAccepted} 
                                     onChange={e => {
                                         const val = e.target.checked;
                                         setBudgetForm({
                                             ...budgetForm, 
                                             isAccepted: val, 
                                             isRejected: val ? false : budgetForm.isRejected
                                         });
                                     }} 
                                     className="w-4 h-4 rounded border-gray-400 dark:border-gray-600 text-brand-teal bg-white dark:bg-gray-800 focus:ring-0 cursor-pointer" 
                                 />
                                 <span className="text-xs font-bold uppercase text-gray-700 dark:text-white">Aceptado (Crear Obra)</span>
                             </label>
                             <label className="flex items-center gap-3 cursor-pointer bg-gray-100 dark:bg-gray-800/50 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                                 <input 
                                     type="checkbox" 
                                     checked={budgetForm.isRejected || false} 
                                     onChange={e => {
                                         const val = e.target.checked;
                                         setBudgetForm({
                                             ...budgetForm, 
                                             isRejected: val, 
                                             isAccepted: val ? false : budgetForm.isAccepted
                                         });
                                     }} 
                                     className="w-4 h-4 rounded border-gray-400 dark:border-gray-600 text-red-500 bg-white dark:bg-gray-800 focus:ring-0 cursor-pointer" 
                                 />
                                 <span className="text-xs font-bold uppercase text-red-600 dark:text-red-400">Rechazado</span>
                             </label>
                        </div>
                        <div>
                            <label className="block text-[10px] text-gray-500 uppercase font-black mb-1">Datos / Comentarios</label>
                            <textarea placeholder="Comentarios adicionales..." rows={3} value={budgetForm.comments} onChange={e => setBudgetForm({...budgetForm, comments: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none" />
                        </div>
                   </div>
                   <button 
                       onClick={handleSaveBudget} 
                       disabled={isSavingBudget} 
                       className="w-full mt-6 bg-brand-teal hover:bg-teal-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                   >
                       {isSavingBudget ? (
                           <>
                               <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                               <span>Guardando Presupuesto...</span>
                           </>
                       ) : (
                           <>
                               <SaveIcon className="w-5 h-5" /> {isEditingBudget ? 'Actualizar Presupuesto' : 'Crear Presupuesto'}
                           </>
                       )}
                   </button>
                </div>

                <div className="space-y-4 pt-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-3">
                        <h3 className="text-gray-400 font-black uppercase text-[11px] tracking-[3px] flex items-center gap-2">
                            <FileTextIcon className="w-4 h-4" /> Listado de Presupuestos
                        </h3>
                        <div className="flex gap-2">
                            <button onClick={() => handleExportJSON('budgets')} className="text-[10px] font-bold uppercase bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-brand-teal hover:bg-gray-300 dark:hover:bg-gray-700 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 shadow-sm cursor-pointer">
                                <DownloadIcon className="w-3 h-3" /> Exportar
                            </button>
                            <label className="text-[10px] font-bold uppercase bg-brand-teal/10 dark:bg-brand-teal/20 text-brand-teal hover:bg-brand-teal hover:text-white px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 cursor-pointer shadow-sm">
                                <UploadIcon className="w-3 h-3" /> Importar
                                <input type="file" ref={budgetsImportRef} onChange={(e) => handleImportJSON(e, 'budgets')} accept=".json" className="hidden" />
                            </label>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                        <div className="relative flex-1">
                            <input 
                                type="text" 
                                placeholder="🔍 Buscar presupuesto por Nombre, Cliente, Nº, Archivo..." 
                                value={budgetSearchTerm} 
                                onChange={(e) => setBudgetSearchTerm(e.target.value)} 
                                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none transition-colors shadow-sm" 
                            />
                            <div className="absolute left-3 top-3 text-gray-400"><SearchIcon className="w-4 h-4" /></div>
                        </div>

                        {/* SUB-PESTAÑAS DE FILTRO */}
                        <div className="flex flex-wrap gap-1.5 bg-gray-100 dark:bg-gray-900/60 p-1.5 rounded-xl border border-gray-200 dark:border-gray-800">
                            <button
                                onClick={() => setBudgetFilterTab('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                                    budgetFilterTab === 'all'
                                        ? 'bg-brand-teal text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-gray-800'
                                }`}
                            >
                                <span>Todos</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${budgetFilterTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                                    {(data.budgets || []).length}
                                </span>
                            </button>
                            <button
                                onClick={() => setBudgetFilterTab('active')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                                    budgetFilterTab === 'active'
                                        ? 'bg-amber-600 text-white shadow-sm'
                                        : 'text-amber-700 dark:text-amber-400 hover:bg-amber-100/60 dark:hover:bg-amber-950/40'
                                }`}
                            >
                                <span>Pendientes</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${budgetFilterTab === 'active' ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'}`}>
                                    {categorizedBudgets.active.length}
                                </span>
                            </button>
                            <button
                                onClick={() => setBudgetFilterTab('finished')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                                    budgetFilterTab === 'finished'
                                        ? 'bg-teal-600 text-white shadow-sm'
                                        : 'text-teal-700 dark:text-teal-400 hover:bg-teal-100/60 dark:hover:bg-teal-950/40'
                                }`}
                            >
                                <span>Terminados</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${budgetFilterTab === 'finished' ? 'bg-white/20 text-white' : 'bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300'}`}>
                                    {categorizedBudgets.finished.length}
                                </span>
                            </button>
                            <button
                                onClick={() => setBudgetFilterTab('accepted')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                                    budgetFilterTab === 'accepted'
                                        ? 'bg-green-600 text-white shadow-sm'
                                        : 'text-green-700 dark:text-green-400 hover:bg-green-100/60 dark:hover:bg-green-950/40'
                                }`}
                            >
                                <span>Aceptados</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${budgetFilterTab === 'accepted' ? 'bg-white/20 text-white' : 'bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300'}`}>
                                    {categorizedBudgets.accepted.length}
                                </span>
                            </button>
                            <button
                                onClick={() => setBudgetFilterTab('rejected')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                                    budgetFilterTab === 'rejected'
                                        ? 'bg-red-600 text-white shadow-sm'
                                        : 'text-red-700 dark:text-red-400 hover:bg-red-100/60 dark:hover:bg-red-950/40'
                                }`}
                            >
                                <span>Rechazados</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${budgetFilterTab === 'rejected' ? 'bg-white/20 text-white' : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'}`}>
                                    {categorizedBudgets.rejected.length}
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6 pt-2">
                        {/* SECCIÓN 1: PENDIENTES / EN ELABORACIÓN */}
                        {(budgetFilterTab === 'all' || budgetFilterTab === 'active') && (
                            <div className="space-y-3">
                                <button 
                                    onClick={() => toggleBudgetSection('active')}
                                    className="w-full flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 font-bold uppercase text-xs tracking-wider cursor-pointer hover:bg-amber-100/60 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${expandedBudgetSections.active ? '' : '-rotate-90'}`} />
                                        <span>⏳ Presupuestos Pendientes / En Elaboración ({categorizedBudgets.active.length})</span>
                                    </div>
                                    <span className="text-[10px] font-normal lowercase text-amber-700 dark:text-amber-400">
                                        {expandedBudgetSections.active ? 'Plegar' : 'Desplegar'}
                                    </span>
                                </button>
                                {expandedBudgetSections.active && (
                                    <div className="space-y-3 pl-1 sm:pl-2">
                                        {categorizedBudgets.active.map((b, idx) => renderBudgetRow(b, `b-act-${idx}`))}
                                        {categorizedBudgets.active.length === 0 && (
                                            <p className="text-center py-4 text-gray-400 text-xs italic bg-gray-50/50 dark:bg-gray-900/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                                                No hay presupuestos pendientes.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SECCIÓN 2: TERMINADOS */}
                        {(budgetFilterTab === 'all' || budgetFilterTab === 'finished') && (
                            <div className="space-y-3">
                                <button 
                                    onClick={() => toggleBudgetSection('finished')}
                                    className="w-full flex items-center justify-between p-3 rounded-xl bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40 text-teal-800 dark:text-teal-300 font-bold uppercase text-xs tracking-wider cursor-pointer hover:bg-teal-100/60 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${expandedBudgetSections.finished ? '' : '-rotate-90'}`} />
                                        <span>📋 Presupuestos Terminados ({categorizedBudgets.finished.length})</span>
                                    </div>
                                    <span className="text-[10px] font-normal lowercase text-teal-700 dark:text-teal-400">
                                        {expandedBudgetSections.finished ? 'Plegar' : 'Desplegar'}
                                    </span>
                                </button>
                                {expandedBudgetSections.finished && (
                                    <div className="space-y-3 pl-1 sm:pl-2">
                                        {categorizedBudgets.finished.map((b, idx) => renderBudgetRow(b, `b-fin-${idx}`))}
                                        {categorizedBudgets.finished.length === 0 && (
                                            <p className="text-center py-4 text-gray-400 text-xs italic bg-gray-50/50 dark:bg-gray-900/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                                                No hay presupuestos terminados.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SECCIÓN 3: ACEPTADOS */}
                        {(budgetFilterTab === 'all' || budgetFilterTab === 'accepted') && (
                            <div className="space-y-3">
                                <button 
                                    onClick={() => toggleBudgetSection('accepted')}
                                    className="w-full flex items-center justify-between p-3 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 text-green-800 dark:text-green-300 font-bold uppercase text-xs tracking-wider cursor-pointer hover:bg-green-100/60 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${expandedBudgetSections.accepted ? '' : '-rotate-90'}`} />
                                        <span>✅ Presupuestos Aceptados ({categorizedBudgets.accepted.length})</span>
                                    </div>
                                    <span className="text-[10px] font-normal lowercase text-green-700 dark:text-green-400">
                                        {expandedBudgetSections.accepted ? 'Plegar' : 'Desplegar'}
                                    </span>
                                </button>
                                {expandedBudgetSections.accepted && (
                                    <div className="space-y-3 pl-1 sm:pl-2">
                                        {categorizedBudgets.accepted.map((b, idx) => renderBudgetRow(b, `b-acc-${idx}`))}
                                        {categorizedBudgets.accepted.length === 0 && (
                                            <p className="text-center py-4 text-gray-400 text-xs italic bg-gray-50/50 dark:bg-gray-900/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                                                No hay presupuestos aceptados.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SECCIÓN 4: RECHAZADOS */}
                        {(budgetFilterTab === 'all' || budgetFilterTab === 'rejected') && (
                            <div className="space-y-3">
                                <button 
                                    onClick={() => toggleBudgetSection('rejected')}
                                    className="w-full flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-800 dark:text-red-300 font-bold uppercase text-xs tracking-wider cursor-pointer hover:bg-red-100/60 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${expandedBudgetSections.rejected ? '' : '-rotate-90'}`} />
                                        <span>❌ Presupuestos Rechazados ({categorizedBudgets.rejected.length})</span>
                                    </div>
                                    <span className="text-[10px] font-normal lowercase text-red-700 dark:text-red-400">
                                        {expandedBudgetSections.rejected ? 'Plegar' : 'Desplegar'}
                                    </span>
                                </button>
                                {expandedBudgetSections.rejected && (
                                    <div className="space-y-3 pl-1 sm:pl-2">
                                        {categorizedBudgets.rejected.map((b, idx) => renderBudgetRow(b, `b-rej-${idx}`))}
                                        {categorizedBudgets.rejected.length === 0 && (
                                            <p className="text-center py-4 text-gray-400 text-xs italic bg-gray-50/50 dark:bg-gray-900/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                                                No hay presupuestos rechazados.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {(data.budgets || []).length === 0 && (
                            <p className="text-center py-8 text-gray-500 text-xs italic">No hay presupuestos registrados.</p>
                        )}
                    </div>
                </div>
            </div>
        )}

        {tab === 'projects' && (
            <div className="space-y-6">
                <div className="bg-white dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl">
                   {/* Formulario Obra */}
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
                                     {data.technicians.filter(t => t.active !== false).map((t, idx) => <option key={`${t.id || 'tech'}-${idx}`} value={t.name}>{t.name}</option>)}
                                 </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 md:col-span-2">
                             <div>
                                 <label className="block text-[10px] text-gray-500 uppercase font-black mb-1">Fecha Inicio</label>
                                 <input type="date" value={projectForm.startDate} onChange={e => setProjectForm({...projectForm, startDate: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none dark:[color-scheme:dark]" />
                             </div>
                             <div className="flex flex-wrap gap-4 items-center h-full">
                                 <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                     <input type="checkbox" checked={projectForm.isFinished} onChange={e => setProjectForm({...projectForm, isFinished: e.target.checked})} className="w-4 h-4 text-teal-600 rounded focus:ring-0" />
                                     <span className="text-xs font-bold uppercase text-gray-700 dark:text-gray-300">Terminada</span>
                                 </label>
                                 <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                     <input type="checkbox" checked={projectForm.isInvoiced} onChange={e => setProjectForm({...projectForm, isInvoiced: e.target.checked, isFinished: e.target.checked ? true : projectForm.isFinished})} className="w-4 h-4 text-purple-600 rounded focus:ring-0" />
                                     <span className="text-xs font-bold uppercase text-gray-700 dark:text-gray-300">Facturada</span>
                                 </label>
                                 <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                     <input type="checkbox" checked={projectForm.hasWarning} onChange={e => setProjectForm({...projectForm, hasWarning: e.target.checked})} className="w-4 h-4 text-orange-500 rounded focus:ring-0" />
                                     <span className="text-xs font-bold uppercase text-gray-700 dark:text-gray-300">Aviso (2m)</span>
                                 </label>
                             </div>
                        </div>

                        {projectForm.isFinished && (
                            <div className="md:col-span-2 p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800 text-teal-800 dark:text-teal-200 text-xs flex items-center gap-2 animate-fade-in shadow-sm">
                                <span className="text-base">✉️</span>
                                <div>
                                    <p className="font-bold">Notificación por Correo al Guardar:</p>
                                    <p className="text-[11px] opacity-90">Se abrirá la confirmación para enviar el correo a <strong>{DEFAULT_COMPLETION_RECIPIENT}</strong> con el PDF oficial de partes y albaranes.</p>
                                </div>
                            </div>
                        )}

                        {/* Campo obligatorio de Número de Factura si la obra está marcada como facturada */}
                        {projectForm.isInvoiced && (
                            <div className="md:col-span-2 p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border-2 border-purple-300 dark:border-purple-800 animate-fade-in shadow-sm">
                                <label className="block text-[11px] text-purple-800 dark:text-purple-300 uppercase font-black mb-1.5 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <span>📄 Número de Factura</span>
                                        <span className="text-red-500 font-black text-xs">* (Obligatorio para facturar)</span>
                                    </span>
                                    <span className="text-[10px] font-normal text-purple-600 dark:text-purple-400 lowercase">Requerido</span>
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="Ej: F-2026/001, FACT-105..." 
                                    value={projectForm.invoiceNum || ''} 
                                    onChange={e => setProjectForm({...projectForm, invoiceNum: e.target.value})} 
                                    className="w-full bg-white dark:bg-gray-800 border-2 border-purple-400 dark:border-purple-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white font-mono font-bold focus:border-brand-teal outline-none shadow-sm" 
                                    autoFocus
                                    required
                                />
                                <p className="text-[10px] text-purple-700/80 dark:text-purple-400/80 mt-1 font-medium">
                                    Indica el número de la factura emitida para poder dar por facturada la obra.
                                </p>
                            </div>
                        )}

                        <div className="mt-4">
                             <label className="block text-[10px] text-gray-500 uppercase font-black mb-1">Ubicación (Ciudad/Pueblo)</label>
                             <input type="text" value={projectForm.location || ''} onChange={e => setProjectForm({...projectForm, location: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none" placeholder="Ej: Madrid, Barcelona..." />
                        </div>

                        <div className="mt-4">
                             <label className="block text-[10px] text-gray-500 uppercase font-black mb-1">Notas / Observaciones</label>
                             <textarea rows={2} value={projectForm.notes} onChange={e => setProjectForm({...projectForm, notes: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none" placeholder="Detalles extra de la obra..."></textarea>
                        </div>

                        <div className="mt-4 md:col-span-2">
                             <label className="block text-[10px] text-gray-500 uppercase font-black mb-2 ml-1">Documentación Adjunta (PDF / Imágenes)</label>
                             <div className="flex flex-wrap gap-3 mb-3">
                                 {projectForm.attachments?.map((att, idx) => (
                                     <div key={idx} className="relative group bg-gray-100 dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-2 max-w-[200px]">
                                         <div className="w-8 h-8 rounded bg-brand-teal/10 flex items-center justify-center text-brand-teal">
                                             {att.type.includes('pdf') ? <FileTextIcon className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                                         </div>
                                         <span className="text-[10px] font-bold truncate flex-1">{att.name}</span>
                                         <button onClick={() => removeProjectAttachment(idx)} className="text-red-500 hover:text-red-700 p-1">
                                             <XIcon className="w-3 h-3" />
                                         </button>
                                     </div>
                                 ))}
                             </div>
                             <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-4 hover:border-brand-teal cursor-pointer transition-all group">
                                 <UploadIcon className="w-5 h-5 text-gray-400 group-hover:text-brand-teal" />
                                 <span className="text-xs font-bold text-gray-500 group-hover:text-brand-teal uppercase tracking-widest">Subir Documentos</span>
                                 <input type="file" multiple accept="image/*,.pdf" onChange={handleProjectFileChange} className="hidden" />
                             </label>
                        </div>

                        <button 
                            onClick={handleSaveProject} 
                            disabled={isSavingProject} 
                            className="w-full mt-6 md:col-span-2 bg-brand-teal hover:bg-teal-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                             {isSavingProject ? (
                                 <>
                                     <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                     <span>Guardando Obra...</span>
                                 </>
                             ) : (
                                 <>
                                     <SaveIcon className="w-5 h-5" /> {isEditingProject ? 'Actualizar Obra' : 'Crear Obra'}
                                 </>
                             )}
                        </button>
                   </div>
                </div>

                {/* Listado de Obras con Menú de Estado y Acordeones Desplegables */}
                <div className="bg-white dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
                        <div>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <span>📁 Listado de Obras</span>
                                <span className="text-xs bg-brand-teal/10 text-brand-teal px-2.5 py-1 rounded-full font-bold">
                                    Total: {data.projectsDetailed?.length || 0}
                                </span>
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">Organización estructurada por estado operativo y facturación</p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <button 
                                onClick={() => {
                                    const allExpanded = Object.values(expandedProjectSections).every(v => v);
                                    setExpandedProjectSections({
                                        green: !allExpanded,
                                        orange: !allExpanded,
                                        red: !allExpanded,
                                        blue: !allExpanded,
                                        finished: !allExpanded,
                                        invoiced: !allExpanded
                                    });
                                }}
                                className="text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 font-bold transition-colors cursor-pointer"
                            >
                                {Object.values(expandedProjectSections).every(v => v) ? 'Plegar Todas' : 'Desplegar Todas'}
                            </button>
                        </div>
                    </div>

                    {/* Menú de Filtro por Estado (Pestañas de Obras) */}
                    <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800 pb-4">
                        <button
                            onClick={() => setProjectFilterTab('all')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-2 cursor-pointer ${
                                projectFilterTab === 'all'
                                    ? 'bg-brand-teal text-white shadow-md'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            <span>Todas</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${projectFilterTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                                {data.projectsDetailed?.length || 0}
                            </span>
                        </button>

                        <button
                            onClick={() => setProjectFilterTab('active')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-2 cursor-pointer ${
                                projectFilterTab === 'active'
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                            }`}
                        >
                            <span>🟢 Activas</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${projectFilterTab === 'active' ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'}`}>
                                {categorizedProjects.green.length + categorizedProjects.orange.length + categorizedProjects.red.length + categorizedProjects.blue.length}
                            </span>
                        </button>

                        <button
                            onClick={() => setProjectFilterTab('warning')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-2 cursor-pointer ${
                                projectFilterTab === 'warning'
                                    ? 'bg-orange-500 text-white shadow-md'
                                    : 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40'
                            }`}
                        >
                            <span>⚠️ Con Aviso</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${projectFilterTab === 'warning' ? 'bg-white/20 text-white' : 'bg-orange-100 dark:bg-orange-900/60 text-orange-700 dark:text-orange-300'}`}>
                                {categorizedProjects.green.length + categorizedProjects.orange.length + categorizedProjects.red.length}
                            </span>
                        </button>

                        <button
                            onClick={() => setProjectFilterTab('finished')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-2 cursor-pointer ${
                                projectFilterTab === 'finished'
                                    ? 'bg-teal-600 text-white shadow-md'
                                    : 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/40'
                            }`}
                        >
                            <span>🏁 Terminadas</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${projectFilterTab === 'finished' ? 'bg-white/20 text-white' : 'bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300'}`}>
                                {categorizedProjects.finished.length}
                            </span>
                        </button>

                        <button
                            onClick={() => setProjectFilterTab('invoiced')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-2 cursor-pointer ${
                                projectFilterTab === 'invoiced'
                                    ? 'bg-purple-600 text-white shadow-md'
                                    : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40'
                            }`}
                        >
                            <span>💰 Facturadas</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${projectFilterTab === 'invoiced' ? 'bg-white/20 text-white' : 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300'}`}>
                                {categorizedProjects.invoiced.length}
                            </span>
                        </button>
                    </div>

                    {/* Buscador de Obras */}
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="🔍 Buscar obra por ID, Nombre, Cliente, Nº Factura, Técnico, Presupuesto..." 
                            value={projectSearchTerm} 
                            onChange={(e) => setProjectSearchTerm(e.target.value)} 
                            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 dark:text-white focus:border-brand-teal outline-none transition-colors shadow-sm" 
                        />
                        <div className="absolute left-3 top-3.5 text-gray-400"><SearchIcon className="w-4 h-4" /></div>
                        {projectSearchTerm && (
                            <button 
                                onClick={() => setProjectSearchTerm('')} 
                                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                <XIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Mensaje si no hay resultados */}
                    {Object.values(categorizedProjects).every(l => (l as any[]).length === 0) && (
                        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-8 rounded-2xl text-center space-y-4">
                            <div className="text-4xl">🔍</div>
                            <h4 className="text-lg font-bold text-orange-800 dark:text-orange-300">No se han encontrado obras</h4>
                            <p className="text-sm text-orange-700 dark:text-orange-400 max-w-md mx-auto">
                                No coinciden obras con el filtro o la búsqueda actual.
                            </p>
                            {onRecoverProjects && (
                                <button 
                                    onClick={onRecoverProjects}
                                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mx-auto"
                                >
                                    <RefreshCwIcon className="w-5 h-5" /> RECUPERAR OBRAS DESDE BACKUP
                                </button>
                            )}
                        </div>
                    )}

                    {/* Secciones Desplegables de Obras */}
                    <div className="space-y-4">
                        {/* SECCIÓN 1: Obras Activas (Recientes <= 2 meses) */}
                        {(projectFilterTab === 'all' || projectFilterTab === 'active' || projectFilterTab === 'warning') && (
                            <div className="space-y-3">
                                <button 
                                    onClick={() => toggleProjectSection('green')}
                                    className="w-full flex items-center justify-between p-3 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 text-green-800 dark:text-green-300 font-bold uppercase text-xs tracking-wider cursor-pointer hover:bg-green-100/60 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${expandedProjectSections.green ? '' : '-rotate-90'}`} />
                                        <span>🟢 Obras Activas con Aviso Reciente (≤ 2 meses) ({categorizedProjects.green.length})</span>
                                    </div>
                                    <span className="text-[10px] font-normal lowercase text-green-700 dark:text-green-400">
                                        {expandedProjectSections.green ? 'Plegar' : 'Desplegar'}
                                    </span>
                                </button>
                                {expandedProjectSections.green && (
                                    <div className="space-y-3 pl-1 sm:pl-2">
                                        {categorizedProjects.green.map((p, idx) => renderProjectRow(p, `p-grn-${idx}`))}
                                        {categorizedProjects.green.length === 0 && (
                                            <p className="text-center py-4 text-gray-400 text-xs italic bg-gray-50/50 dark:bg-gray-900/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                                                No hay obras en este estado.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SECCIÓN 2: Obras Activas (+2 meses) */}
                        {(projectFilterTab === 'all' || projectFilterTab === 'active' || projectFilterTab === 'warning') && (
                            <div className="space-y-3">
                                <button 
                                    onClick={() => toggleProjectSection('orange')}
                                    className="w-full flex items-center justify-between p-3 rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 text-orange-800 dark:text-orange-300 font-bold uppercase text-xs tracking-wider cursor-pointer hover:bg-orange-100/60 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${expandedProjectSections.orange ? '' : '-rotate-90'}`} />
                                        <span>🟠 Obras Activas (+2 meses) ({categorizedProjects.orange.length})</span>
                                    </div>
                                    <span className="text-[10px] font-normal lowercase text-orange-700 dark:text-orange-400">
                                        {expandedProjectSections.orange ? 'Plegar' : 'Desplegar'}
                                    </span>
                                </button>
                                {expandedProjectSections.orange && (
                                    <div className="space-y-3 pl-1 sm:pl-2">
                                        {categorizedProjects.orange.map((p, idx) => renderProjectRow(p, `p-org-${idx}`))}
                                        {categorizedProjects.orange.length === 0 && (
                                            <p className="text-center py-4 text-gray-400 text-xs italic bg-gray-50/50 dark:bg-gray-900/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                                                No hay obras en este estado.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SECCIÓN 3: Obras Activas (+5 meses) */}
                        {(projectFilterTab === 'all' || projectFilterTab === 'active' || projectFilterTab === 'warning') && (
                            <div className="space-y-3">
                                <button 
                                    onClick={() => toggleProjectSection('red')}
                                    className="w-full flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-800 dark:text-red-300 font-bold uppercase text-xs tracking-wider cursor-pointer hover:bg-red-100/60 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${expandedProjectSections.red ? '' : '-rotate-90'}`} />
                                        <span>🔴 Obras Activas (+5 meses) ({categorizedProjects.red.length})</span>
                                    </div>
                                    <span className="text-[10px] font-normal lowercase text-red-700 dark:text-red-400">
                                        {expandedProjectSections.red ? 'Plegar' : 'Desplegar'}
                                    </span>
                                </button>
                                {expandedProjectSections.red && (
                                    <div className="space-y-3 pl-1 sm:pl-2">
                                        {categorizedProjects.red.map((p, idx) => renderProjectRow(p, `p-red-${idx}`))}
                                        {categorizedProjects.red.length === 0 && (
                                            <p className="text-center py-4 text-gray-400 text-xs italic bg-gray-50/50 dark:bg-gray-900/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                                                No hay obras en este estado.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SECCIÓN 4: Otras Obras Activas */}
                        {(projectFilterTab === 'all' || projectFilterTab === 'active') && (
                            <div className="space-y-3">
                                <button 
                                    onClick={() => toggleProjectSection('blue')}
                                    className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-blue-800 dark:text-blue-300 font-bold uppercase text-xs tracking-wider cursor-pointer hover:bg-blue-100/60 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${expandedProjectSections.blue ? '' : '-rotate-90'}`} />
                                        <span>🔵 Otras Obras Activas ({categorizedProjects.blue.length})</span>
                                    </div>
                                    <span className="text-[10px] font-normal lowercase text-blue-700 dark:text-blue-400">
                                        {expandedProjectSections.blue ? 'Plegar' : 'Desplegar'}
                                    </span>
                                </button>
                                {expandedProjectSections.blue && (
                                    <div className="space-y-3 pl-1 sm:pl-2">
                                        {categorizedProjects.blue.map((p, idx) => renderProjectRow(p, `p-blu-${idx}`))}
                                        {categorizedProjects.blue.length === 0 && (
                                            <p className="text-center py-4 text-gray-400 text-xs italic bg-gray-50/50 dark:bg-gray-900/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                                                No hay otras obras activas.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SECCIÓN 5: Obras Terminadas */}
                        {(projectFilterTab === 'all' || projectFilterTab === 'finished') && (
                            <div className="space-y-3">
                                <button 
                                    onClick={() => toggleProjectSection('finished')}
                                    className="w-full flex items-center justify-between p-3 rounded-xl bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40 text-teal-800 dark:text-teal-300 font-bold uppercase text-xs tracking-wider cursor-pointer hover:bg-teal-100/60 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${expandedProjectSections.finished ? '' : '-rotate-90'}`} />
                                        <span>🏁 Obras Terminadas ({categorizedProjects.finished.length})</span>
                                    </div>
                                    <span className="text-[10px] font-normal lowercase text-teal-700 dark:text-teal-400">
                                        {expandedProjectSections.finished ? 'Plegar' : 'Desplegar'}
                                    </span>
                                </button>
                                {expandedProjectSections.finished && (
                                    <div className="space-y-3 pl-1 sm:pl-2">
                                        {categorizedProjects.finished.map((p, idx) => renderProjectRow(p, `p-fin-${idx}`))}
                                        {categorizedProjects.finished.length === 0 && (
                                            <p className="text-center py-4 text-gray-400 text-xs italic bg-gray-50/50 dark:bg-gray-900/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                                                No hay obras terminadas.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SECCIÓN 6: Obras Facturadas */}
                        {(projectFilterTab === 'all' || projectFilterTab === 'invoiced') && (
                            <div className="space-y-3">
                                <button 
                                    onClick={() => toggleProjectSection('invoiced')}
                                    className="w-full flex items-center justify-between p-3 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 text-purple-800 dark:text-purple-300 font-bold uppercase text-xs tracking-wider cursor-pointer hover:bg-purple-100/60 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${expandedProjectSections.invoiced ? '' : '-rotate-90'}`} />
                                        <span>💰 Obras Facturadas ({categorizedProjects.invoiced.length})</span>
                                    </div>
                                    <span className="text-[10px] font-normal lowercase text-purple-700 dark:text-purple-400">
                                        {expandedProjectSections.invoiced ? 'Plegar' : 'Desplegar'}
                                    </span>
                                </button>
                                {expandedProjectSections.invoiced && (
                                    <div className="space-y-3 pl-1 sm:pl-2">
                                        {categorizedProjects.invoiced.map((p, idx) => renderProjectRow(p, `p-inv-${idx}`))}
                                        {categorizedProjects.invoiced.length === 0 && (
                                            <p className="text-center py-4 text-gray-400 text-xs italic bg-gray-50/50 dark:bg-gray-900/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                                                No hay obras facturadas.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
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
                        {[...data.deletedReports].reverse().map((r: any, idx: number) => (
                            <div key={`${r.id || 'del'}-${idx}`} className="bg-white dark:bg-brand-panel p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center shadow-sm">
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
                            
                            return filtered.map((p, idx) => (
                                <div 
                                    key={`${p.id}-${idx}`} 
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
                history={data.dailyOrgHistory}
                onUpdate={onDailyOrgUpdate || handleDailyOrgUpdate}
                onChangeDate={onDailyOrgDateChange || handleDailyOrgDateChange}
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
                                {onRecoverProjects && (
                                    <button onClick={onRecoverProjects} className="bg-orange-100 dark:bg-orange-900/40 hover:bg-orange-200 dark:hover:bg-orange-800 text-orange-700 dark:text-orange-300 px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 border border-orange-200 dark:border-orange-800">
                                        <RefreshCwIcon className="w-4 h-4" /> Recuperar Obras
                                    </button>
                                )}
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
                                {backupsList.map((bk, idx) => (
                                    <div key={`${bk.id}-${idx}`} className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-brand-teal/30 transition-all">
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

      {/* MODAL DE CONFIRMACIÓN DE ENVÍO DE CORREO DE OBRA TERMINADA */}
      {showCompletionModal && completionModalProject && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-brand-panel w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Header del Modal */}
            <div className="bg-gradient-to-r from-teal-700 to-teal-900 p-5 text-white flex justify-between items-start">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/30 text-teal-100 text-xs font-bold uppercase mb-1">
                  <span>✉️</span>
                  <span>{isResendMode ? 'Reenviar Notificación' : 'Certificación y Notificación de Obra'}</span>
                </div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>Obra: {completionModalProject.id}</span>
                  <span className="text-sm font-normal opacity-90 truncate max-w-xs">- {completionModalProject.name}</span>
                </h3>
                <p className="text-xs text-teal-100 mt-0.5">
                  Cliente: <strong className="text-white">{completionModalProject.client || '-'}</strong> | Técnico: <strong className="text-white">{completionModalProject.responsibleTech || 'Sin asignar'}</strong>
                </p>
              </div>
              <button 
                onClick={() => !isSendingCompletionEmail && setShowCompletionModal(false)}
                className="text-teal-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                disabled={isSendingCompletionEmail}
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido con scroll */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar text-sm">
              
              {/* Notificación informativa */}
              <div className="p-3.5 bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-xl text-teal-900 dark:text-teal-200 text-xs flex items-start gap-2.5">
                <span className="text-base">📢</span>
                <div>
                  <p className="font-bold">Notificación de Obra Terminada:</p>
                  <p className="mt-0.5 text-gray-600 dark:text-gray-300">
                    Se enviará un correo oficial a la dirección indicada adjuntando el <strong>documento PDF con todos los partes de trabajo</strong> de esta obra, junto a los <strong>textos/observaciones y albaranes</strong> registrados.
                  </p>
                </div>
              </div>

              {/* Destinatario */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Enviar Correo a:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={completionRecipient}
                    onChange={e => setCompletionRecipient(e.target.value)}
                    className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white focus:border-brand-teal outline-none font-medium"
                    placeholder="m.domingogarcia29@gmail.com"
                    disabled={isSendingCompletionEmail}
                  />
                  {completionRecipient !== DEFAULT_COMPLETION_RECIPIENT && (
                    <button 
                      type="button" 
                      onClick={() => setCompletionRecipient(DEFAULT_COMPLETION_RECIPIENT)}
                      className="text-xs text-brand-teal hover:underline px-2 cursor-pointer font-bold"
                    >
                      Restablecer
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Dirección configurada: <strong>{DEFAULT_COMPLETION_RECIPIENT}</strong>
                </p>
              </div>

              {/* Resumen de partes de trabajo a adjuntar */}
              {(() => {
                const projectReports = data.reports.filter(r => r.projectNum === completionModalProject.id);
                let totalWorkHrs = 0;
                let totalOtHrs = 0;
                let totalExp = 0;
                projectReports.forEach(r => {
                  totalWorkHrs += calculateDuration(r.startTime, r.endTime);
                  totalOtHrs += Number(r.overtimeHours || 0);
                  totalExp += (Number(r.expenses?.food || 0) + Number(r.expenses?.gas || 0) + Number(r.expenses?.parking || 0) + Number(r.expenses?.others || 0));
                });

                return (
                  <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase text-gray-700 dark:text-gray-300">
                        📄 Partes de Trabajo de la Obra ({projectReports.length})
                      </span>
                      <span className="text-xs font-bold text-teal-700 dark:text-teal-400">
                        {totalWorkHrs.toFixed(1)}h normales · {totalOtHrs.toFixed(1)}h extra · {totalExp.toFixed(2)}€
                      </span>
                    </div>

                    {projectReports.length > 0 ? (
                      <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar text-xs">
                        {projectReports.slice(0, 6).map((r, rIdx) => (
                          <div key={`${r.id || 'rep'}-${rIdx}`} className="flex items-center justify-between bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-800">
                            <span className="font-mono text-gray-500">{formatDateToSpanish(r.date)}</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">{r.technician}</span>
                            <span className="text-gray-500 truncate max-w-[200px]">{r.description || 'Sin descripción'}</span>
                          </div>
                        ))}
                        {projectReports.length > 6 && (
                          <p className="text-[11px] text-center text-gray-500 italic pt-1">
                            ... y {projectReports.length - 6} parte(s) más incluidos en el PDF
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                        ⚠️ No se han registrado partes para esta obra. Se enviará la ficha técnica completa con las observaciones.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Textos y notas de la obra */}
              {completionModalProject.notes && completionModalProject.notes.trim() && (
                <div className="bg-teal-50/50 dark:bg-teal-950/20 rounded-xl p-3.5 border border-teal-200 dark:border-teal-900/40">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300 block mb-1">
                    📝 Texto / Observaciones registradas en la obra:
                  </span>
                  <p className="text-xs text-gray-700 dark:text-gray-300 italic whitespace-pre-wrap">
                    "{completionModalProject.notes}"
                  </p>
                </div>
              )}

              {/* Albaranes y adjuntos */}
              <div>
                <span className="text-xs font-bold uppercase text-gray-700 dark:text-gray-300 block mb-1.5">
                  📎 Archivos y Albaranes que se enviarán adjuntos:
                </span>
                <div className="flex flex-wrap gap-2">
                  <div className="inline-flex items-center gap-1.5 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">
                    <FileTextIcon className="w-3.5 h-3.5" />
                    <span>Obra_{completionModalProject.id}_Partes.pdf (PDF Oficial)</span>
                  </div>
                  {completionModalProject.attachments && completionModalProject.attachments.length > 0 ? (
                    completionModalProject.attachments.map((att, idx) => (
                      <div key={`att-${att.name || ''}-${idx}`} className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm">
                        {att.type?.includes('pdf') ? <FileTextIcon className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                        <span className="truncate max-w-[150px]">{att.name}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 italic">No hay albaranes adicionales en la ficha de la obra.</span>
                  )}
                </div>
              </div>

              {/* Comentarios o texto extra opcional */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Texto o Comentario adicional para el correo (opcional):
                </label>
                <textarea
                  rows={2}
                  value={completionCustomNotes}
                  onChange={e => setCompletionCustomNotes(e.target.value)}
                  placeholder="Detalles adicionales sobre la finalización o entrega..."
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-xs text-gray-900 dark:text-white focus:border-brand-teal outline-none"
                  disabled={isSendingCompletionEmail}
                />
              </div>

              {/* Estado de conexión con Google / Gmail */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                {googleUser && hasGmailPermission ? (
                  <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-xs text-emerald-800 dark:text-emerald-200 font-medium">
                        Conectado a Gmail como <strong>{googleUser.email}</strong> (Permisos de envío activos)
                      </span>
                    </div>
                    <button 
                      type="button" 
                      onClick={handleGoogleLogout} 
                      className="text-xs text-gray-500 hover:text-red-500 font-bold cursor-pointer"
                    >
                      Cambiar cuenta
                    </button>
                  </div>
                ) : googleUser && !hasGmailPermission ? (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="text-xs text-amber-800 dark:text-amber-200">
                      <strong>Permiso de envío pendiente:</strong> Conectado como <strong>{googleUser.email}</strong>, pero se requiere autorizar el permiso de envío de correos por Gmail.
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={isGoogleLoggingIn}
                        className="bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer transition-colors"
                      >
                        <span>{isGoogleLoggingIn ? 'Autorizando...' : 'Conceder Permiso Gmail'}</span>
                      </button>
                      <button 
                        type="button" 
                        onClick={handleGoogleLogout} 
                        className="text-xs text-gray-500 hover:text-red-500 font-bold cursor-pointer px-1"
                      >
                        Cambiar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="text-xs text-amber-800 dark:text-amber-200">
                      <strong>Conexión con Gmail requerida:</strong> Se necesita conectar tu cuenta de Google para enviar el correo a {completionRecipient}.
                    </div>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isGoogleLoggingIn}
                      className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-gray-50 shadow-sm whitespace-nowrap cursor-pointer"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                      </svg>
                      <span>{isGoogleLoggingIn ? 'Conectando...' : 'Conectar con Google'}</span>
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* Footer con botones de confirmación */}
            <div className="bg-gray-50 dark:bg-gray-800/80 p-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCompletionModal(false)}
                  disabled={isSendingCompletionEmail}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                {isResendMode ? (
                  <button
                    type="button"
                    onClick={handleReactivateProject}
                    disabled={isSendingCompletionEmail}
                    className="px-4 py-2 text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 rounded-xl transition-colors cursor-pointer"
                  >
                    Reactivar Obra (Marcar Activa)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinishWithoutEmail}
                    disabled={isSendingCompletionEmail}
                    className="px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer"
                  >
                    Marcar Terminada (Sin Correo)
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleConfirmSendCompletion}
                disabled={isSendingCompletionEmail}
                className="bg-brand-teal hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
              >
                {isSendingCompletionEmail ? (
                  <>
                    <RefreshCwIcon className="w-4 h-4 animate-spin" />
                    <span>Enviando correo y PDF...</span>
                  </>
                ) : (
                  <>
                    <span>✉️</span>
                    <span>{isResendMode ? `Reenviar Correo a ${completionRecipient}` : 'Confirmar, Enviar Correo y Finalizar'}</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;