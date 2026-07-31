
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import UserLogin from './components/UserLogin';
import ReportForm from './components/ReportForm';
import AdminPanel from './components/AdminPanel';
import TechDashboard from './components/TechDashboard';
import DailyOrganization, { DailyOrgData } from './components/DailyOrganization';
import VacationManager from './components/VacationManager';
import { Logo } from './components/Logo';
import { LogOutIcon, WifiIcon, CloudIcon, AlertIcon, XIcon, CheckCircleIcon, SunIcon, MoonIcon } from './components/icons';

// IMPORTANTE: Esta URL DEBE estar entre comillas dobles ""
const GOOGLE_DRIVE_WEBHOOK = "https://script.google.com/macros/s/AKfycbxCp4zaMn_dbdqoAm6G4Cw62gxKBrCac7snYqDRspM_6xCLRWKEbenCrQWx50N4awRMAQ/exec";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAoOTrebLLn_uKMJ3YhJMzIhh_cFJsO1FQ",
  authDomain: "proyecto-pruebas-jdg.firebaseapp.com",
  projectId: "proyecto-pruebas-jdg",
  storageBucket: "proyecto-pruebas-jdg.firebasestorage.app",
  messagingSenderId: "626150922206",
  appId: "1:626150922206:web:746a8b498765ccb153ef4f",
  measurementId: "G-FQHXF1NYBR"
};

export interface ExpenseTicket {
  type: string;
  data: string; 
  timestamp: number;
  driveUrl?: string; 
}

export interface MaterialItem {
  id: number;       // timestamp usado como key única
  quantity: string; // cantidad libre (ej: "3", "1.5", "2 cajas")
  description: string; // descripción del material
}

export interface WorkReport {
  id: string;
  technician: string;
  projectNum: string; 
  date: string;
  startTime: string;
  endTime: string;
  overtimeHours: number;
  overtimeType: 'NORMAL' | 'NOCTURNA' | 'FINDE SEMANA';
  overtimeStatus?: 'pending' | 'validated' | 'none';
  description: string;
  vehicle: string;
  isDriver: boolean;
  driverTripType?: 'IDA' | 'VUELTA' | 'IDA_Y_VUELTA';
  isNightShift?: boolean;
  isOvernight?: boolean;
  expenses: {
    food: number;
    gas: number;
    parking: number;
    others: number;
    othersDesc: string;
  };
  imageNames: string[];
  tickets?: ExpenseTicket[];
  materials?: MaterialItem[];
}

export interface VacationRequest {
  id: string;
  userId: string;
  userName: string;
  startDate: string;
  endDate: string;
  days: number;
  type: 'vacation' | 'sick' | 'personal';
  status: 'pending' | 'approved' | 'rejected' | 'cancel_requested';
  requestDate: string;
}

export interface TechUser {
  id: string;
  name: string;
  password: string;
  active?: boolean;
}

export interface ProjectAttachment {
  name: string;
  data: string; // base64
  type: string; // mime type
}

export interface ProjectData {
  id: string; // El ID calculado ej: 26001
  name: string;
  client: string;
  budgetNum: string;
  valuation: 'POR HORAS' | 'PRECIO CERRADO' | 'PRESUPUESTO';
  responsibleTech: string;
  startDate: string;
  isFinished: boolean;
  isInvoiced: boolean;
  hasWarning?: boolean; // Nuevo campo para check de aviso
  warningDate?: string; // Fecha en la que se activó el aviso
  notes: string;
  location?: string; // Ciudad o pueblo para el mapa
  attachments?: ProjectAttachment[];
}

export interface Budget {
  id: string;
  budgetNum: string; // Numero de 5 cifras manual
  name: string;
  client: string;
  deliveryDate: string;
  excelName: string;
  hasFolderData: boolean;
  isFinished: boolean;
  isAccepted: boolean;
  comments: string;
}

export interface AppData {
  technicians: TechUser[];
  projectsDetailed: ProjectData[]; // Única fuente de verdad para obras
  budgets: Budget[]; // Nueva colección de presupuestos
  vehicles: string[];
  reports: WorkReport[];
  deletedReports?: WorkReport[]; // Papelera de reciclaje
  dailyOrg: DailyOrgData;
  dailyOrgHistory?: Record<string, DailyOrgData>; // Historial de organizaciones por fecha
  vacationRequests: VacationRequest[];
  holidays: string[];
  adminPassword?: string;
  firebaseConfig?: string;
  expensesPayments?: Record<string, boolean>; // Registro de pagos de gastos { "WeekRange_TechName": true }
}

const DEFAULT_DAILY_ORG: DailyOrgData = {
    trabajos: [
        { id: 1, nombre: 'EUIPO', color: '#E63946', trabajadores: [] },
        { id: 2, nombre: 'HOSPITAL ALICANTE FASE 5', color: '#06D6A0', trabajadores: [] },
        { id: 3, nombre: 'RENFE', color: '#118AB2', trabajadores: [] }
    ],
    trabajadores: [
        { id: 1, nombre: 'OSCAR', color: '#F77F00', asignado: false },
        { id: 2, nombre: 'FAURA', color: '#C1121F', asignado: false },
        { id: 3, nombre: 'PABLO', color: '#2A9D8F', asignado: false },
        { id: 4, nombre: 'ALEJANDRO', color: '#06D6A0', asignado: false },
        { id: 5, nombre: 'ALBERTO', color: '#E76F51', asignado: false },
        { id: 6, nombre: 'ANTONIO', color: '#AE2012', asignado: false },
        { id: 7, nombre: 'VICTOR', color: '#264653', asignado: false },
        { id: 8, nombre: 'DAVID', color: '#8338EC', asignado: false },
        { id: 9, nombre: 'ROUBERT', color: '#780000', asignado: false },
        { id: 10, nombre: 'GIAMMARIO', color: '#8338EC', asignado: false },
        { id: 11, nombre: 'ALVARO', color: '#118AB2', asignado: false },
        { id: 12, nombre: 'RDL1', color: '#003049', asignado: false },
        { id: 13, nombre: 'KIKO', color: '#073B4C', asignado: false }
    ],
    fecha: new Date().toISOString().split('T')[0],
    lastUpdated: Date.now() // Timestamp inicial
};

const INITIAL_DATA: AppData = {
  technicians: [],
  projectsDetailed: [],
  budgets: [],
  vehicles: [],
  reports: [],
  vacationRequests: [],
  holidays: ['2025-01-01', '2025-01-06', '2025-04-18', '2025-04-21', '2025-05-01', '2025-08-15', '2025-10-12', '2025-11-01', '2025-12-06', '2025-12-08', '2025-12-25'],
  dailyOrg: DEFAULT_DAILY_ORG,
  dailyOrgHistory: {},
  adminPassword: 'admin',
  firebaseConfig: JSON.stringify(FIREBASE_CONFIG),
  expensesPayments: {}
};

const App: React.FC = () => {
  const [view, setView] = useState<'login' | 'dashboard' | 'form' | 'admin' | 'daily_org' | 'vacations'>('login');
  const [userRole, setUserRole] = useState<'admin' | 'tech' | null>(null);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [editingReport, setEditingReport] = useState<WorkReport | null>(null);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [hasSyncedWithCloud, setHasSyncedWithCloud] = useState(false);
  const [isUploadingTickets, setIsUploadingTickets] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [showConfigGuide, setShowConfigGuide] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [lastBackupStatus, setLastBackupStatus] = useState<string>('');
  
  // Estado para notificaciones
  const [hasUnseenDailyOrg, setHasUnseenDailyOrg] = useState(false);
  
  // Estado local para la visualización segura de organización diaria por parte de técnicos (copia local de lectura)
  const [techViewOrg, setTechViewOrg] = useState<DailyOrgData | null>(null);
  
  const isInternalUpdate = useRef(false);
  const isSyncingRef = useRef(false);
  const firebaseRef = useRef<any>(null);

  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem('workerApp_db');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...INITIAL_DATA, ...parsed };
      } catch (e) {
        return INITIAL_DATA;
      }
    }
    return INITIAL_DATA;
  });

  // Theme Logic
  useEffect(() => {
    const savedTheme = localStorage.getItem('app_theme') as 'light' | 'dark' | null;
    if (savedTheme) {
        setTheme(savedTheme);
    } else {
        // Default to dark
        setTheme('dark');
    }
  }, []);

  useEffect(() => {
      const root = window.document.documentElement;
      if (theme === 'dark') {
          root.classList.add('dark');
      } else {
          root.classList.remove('dark');
      }
      localStorage.setItem('app_theme', theme);
  }, [theme]);

  // Request Notification Permission on Mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  // Check for updates in Daily Org to trigger notifications
  useEffect(() => {
    if (userRole === 'admin') return; // Admin doesn't need notifications about their own changes

    const lastSeenTs = localStorage.getItem('lastSeenDailyOrgTs');
    const currentTs = data.dailyOrg.lastUpdated || 0;

    if (!lastSeenTs || Number(lastSeenTs) < currentTs) {
        setHasUnseenDailyOrg(true);
        
        // 1. Try to set App Badge (Standard PWA / Median)
        if ('setAppBadge' in navigator) {
            navigator.setAppBadge(1).catch(() => {});
        }

        // 2. Send System Notification (if updated recently - e.g., within last hour to avoid notify on stale load)
        const isRecentUpdate = (Date.now() - currentTs) < 3600000; // 1 hour
        if (isRecentUpdate && 'Notification' in window && Notification.permission === 'granted' && !document.hasFocus()) {
             new Notification('JDG Teleco', {
                 body: '📋 La organización diaria ha sido actualizada.',
                 icon: '/vite.svg', // Fallback icon
                 tag: 'daily-org-update'
             });
        }
    } else {
        setHasUnseenDailyOrg(false);
        if ('clearAppBadge' in navigator) {
            navigator.clearAppBadge().catch(() => {});
        }
    }
  }, [data.dailyOrg.lastUpdated, userRole]);

  const markDailyOrgAsSeen = () => {
      setHasUnseenDailyOrg(false);
      localStorage.setItem('lastSeenDailyOrgTs', (data.dailyOrg.lastUpdated || Date.now()).toString());
      if ('clearAppBadge' in navigator) {
          navigator.clearAppBadge().catch(() => {});
      }
  };

  const toggleTheme = () => {
      setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Contador de vacaciones pendientes para el admin
  const pendingVacCount = useMemo(() => {
    return (data.vacationRequests || []).filter(r => r.status === 'pending' || r.status === 'cancel_requested').length;
  }, [data.vacationRequests]);

  useEffect(() => {
    let unsubConfig = () => {};
    let unsubReports = () => {};
    let unsubProjects = () => {};

    const initializeFirebaseSync = async () => {
      const fb = (window as any).firebase;
      if (!fb) {
          setTimeout(initializeFirebaseSync, 500);
          return;
      }

      const configStr = data.firebaseConfig || JSON.stringify(FIREBASE_CONFIG);
      if (configStr.includes("TU_NUEVA_API_KEY_AQUI") || configStr.includes("apiKey: \"\"")) {
          setIsInitialLoading(false);
          return;
      }

      try {
        const config = JSON.parse(configStr);
        const app = !fb.apps.length ? fb.initializeApp(config) : fb.app();
        const db = app.firestore();
        firebaseRef.current = fb;

        setIsCloudConnected(true);

        unsubConfig = db.collection("jdg_teleco").doc("main_db").onSnapshot((snapshot: any) => {
            if (isSyncingRef.current) return; 
            if (snapshot.exists) {
                const cloudConfig = snapshot.data();
                if (Object.keys(cloudConfig).length > 0) {
                    isInternalUpdate.current = true;
                    setData(prev => {
                        // Ignoramos projectsDetailed del documento principal ya que ahora usamos subcolección
                        const { projectsDetailed, ...rest } = cloudConfig;
                        return {
                            ...prev,
                            ...rest,
                            reports: prev.reports,
                            projectsDetailed: prev.projectsDetailed
                        };
                    });
                }
            }
        }, (error: any) => {
            if (error.code === 'permission-denied') {
                setFirebaseError("❌ ERROR: Revisa las Reglas de Firebase y pulsa PUBLICAR.");
                setIsInitialLoading(false);
            }
        });

        unsubReports = db.collection("jdg_teleco").doc("main_db").collection("reports").onSnapshot((snapshot: any) => {
            if (isSyncingRef.current) return; 
            
            const cloudReports: WorkReport[] = [];
            snapshot.forEach((doc: any) => {
                cloudReports.push(doc.data() as WorkReport);
            });
            
            setData(prev => {
                // Si la nube está vacía y ya hemos sincronizado antes, permitimos que se vacíe localmente
                if (snapshot.empty && !hasSyncedWithCloud) {
                    console.warn("Sincronización inicial: La nube está vacía. Manteniendo datos locales por seguridad.");
                    return prev;
                }

                isInternalUpdate.current = true;
                return {
                    ...prev,
                    reports: cloudReports.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                };
            });
            
            setHasSyncedWithCloud(true);
            setIsInitialLoading(false);
            setFirebaseError(null);
        }, (error: any) => {
            if (error.code === 'permission-denied') {
                setFirebaseError("❌ ERROR de Permisos. Revisa Firestore Rules.");
                setIsInitialLoading(false);
            }
        });

        unsubProjects = db.collection("jdg_teleco").doc("main_db").collection("projects").onSnapshot((snapshot: any) => {
            if (isSyncingRef.current) return; 
            
            const cloudProjects: ProjectData[] = [];
            snapshot.forEach((doc: any) => {
                cloudProjects.push(doc.data() as ProjectData);
            });
            
            setData(prev => {
                // Si la subcolección está vacía y ya hemos sincronizado antes, permitimos que se vacíe localmente
                // Si es la primera carga y está vacía, mantenemos lo local por seguridad
                if (snapshot.empty && !hasSyncedWithCloud) return prev;

                isInternalUpdate.current = true;
                return {
                    ...prev,
                    projectsDetailed: cloudProjects.sort((a, b) => (b.id || '').localeCompare(a.id || ''))
                };
            });
        });

      } catch (e) {
        setIsCloudConnected(false);
        setIsInitialLoading(false);
      }
    };
    initializeFirebaseSync();
    return () => {
        unsubConfig();
        unsubReports();
        unsubProjects();
    };
  }, [data.firebaseConfig]);

  // HELPER: Guardado Seguro en Fragmentos (Chunking) para superar limite 1MB
  const saveBackupToFirestore = async (db: any, collectionName: string, docId: string, dataToSave: AppData) => {
      // Separamos los datos pesados (Reports, Projects, History y Papelera) de la configuración ligera
      const { reports, dailyOrgHistory, projectsDetailed, deletedReports, ...coreData } = dataToSave;
      
      // Limpiar datos pesados (imágenes base64) antes de guardar en la nube
      const cleanedReports = reports.map(r => {
          if (r.tickets && r.tickets.some(t => t.data && t.data.length > 1000)) {
              return {
                  ...r,
                  tickets: r.tickets.map(t => ({
                      ...t,
                      data: t.driveUrl?.includes('✅') ? '' : t.data
                  }))
              };
          }
          return r;
      });
      
      // Limpiar y reducir deletedReports para evitar inflar el backup
      const cleanedDeletedReports = (deletedReports || [])
          .slice(0, 15)
          .map(r => ({
              ...r,
              tickets: [] // Limpiamos tickets de la papelera en copia de seguridad
          }));
      
      (coreData as any).deletedReports = cleanedDeletedReports;

      // Limpiar datos de adjuntos pesados (base64) de obras en copias de seguridad
      const cleanedProjectsDetailed = (projectsDetailed || []).map(p => {
          if (p.attachments && p.attachments.length > 0) {
              return {
                  ...p,
                  attachments: p.attachments.map(att => ({
                      ...att,
                      data: "" // Limpiamos el base64 de los adjuntos en la copia de seguridad para ahorrar espacio
                  }))
              };
          }
          return p;
      });
      
      const rootRef = db.collection(collectionName).doc(docId);
      
      let currentBatch = db.batch();
      let operationCount = 0;

      const commitBatchIfNeeded = async () => {
          if (operationCount >= 450) {
              await currentBatch.commit();
              currentBatch = db.batch();
              operationCount = 0;
          }
      };
      
      // 1. Guardar documento raíz (configuración, techs, vehicles, etc.) 
      currentBatch.set(rootRef, coreData);
      operationCount++;

      // 2. Guardar Reports en subcolección 'reports_shards' (Chunking)
      const CHUNK_SIZE_REPORTS = 15; // Reducido para evitar límite de 1MB por documento (muy seguro)
      const reportsRef = rootRef.collection('reports_shards');
      
      for (let i = 0; i < cleanedReports.length; i += CHUNK_SIZE_REPORTS) {
          await commitBatchIfNeeded();
          const chunk = cleanedReports.slice(i, i + CHUNK_SIZE_REPORTS);
          const chunkRef = reportsRef.doc(`chunk_${Math.floor(i / CHUNK_SIZE_REPORTS)}`);
          currentBatch.set(chunkRef, { items: chunk });
          operationCount++;
      }

      // 2.5 Guardar Projects en subcolección 'projects_shards' (Chunking)
      if (cleanedProjectsDetailed && cleanedProjectsDetailed.length > 0) {
          const CHUNK_SIZE_PROJECTS = 3; // Reducido a 3 para garantizar no superar el límite de 1MB por documento
          const projectsShardsRef = rootRef.collection('projects_shards');
          
          for (let i = 0; i < cleanedProjectsDetailed.length; i += CHUNK_SIZE_PROJECTS) {
              await commitBatchIfNeeded();
              const chunk = cleanedProjectsDetailed.slice(i, i + CHUNK_SIZE_PROJECTS);
              const chunkRef = projectsShardsRef.doc(`chunk_${Math.floor(i / CHUNK_SIZE_PROJECTS)}`);
              currentBatch.set(chunkRef, { items: chunk });
              operationCount++;
          }
      }

      // 3. Guardar Historial en subcolección 'history_shards'
      if (dailyOrgHistory) {
          const historyKeys = Object.keys(dailyOrgHistory);
          const CHUNK_SIZE_HISTORY = 15; // Reducido para evitar límite de 1MB por documento
          const historyRef = rootRef.collection('history_shards');
          
          for (let i = 0; i < historyKeys.length; i += CHUNK_SIZE_HISTORY) {
              await commitBatchIfNeeded();
              const keysChunk = historyKeys.slice(i, i + CHUNK_SIZE_HISTORY);
              const chunkObj: any = {};
              keysChunk.forEach(k => chunkObj[k] = dailyOrgHistory[k]);
              
              const chunkRef = historyRef.doc(`chunk_${Math.floor(i / CHUNK_SIZE_HISTORY)}`);
              currentBatch.set(chunkRef, { items: chunkObj });
              operationCount++;
          }
      }

      if (operationCount > 0) {
          await currentBatch.commit();
      }
  };

  // FUNCION BACKUP DIARIO (AUTOMATICO)
  const performDailyBackup = async (currentData: AppData) => {
    const today = new Date().toISOString().split('T')[0];
    const lastBackup = localStorage.getItem('last_daily_backup');

    if (lastBackup === today) return; // Ya hecha hoy

    // SAFETY GUARD
    if (!currentData.technicians || currentData.technicians.length === 0) {
        return;
    }

    try {
        const fb = (window as any).firebase;
        if (!fb) return;
        const db = fb.app().firestore();
        
        await saveBackupToFirestore(db, "jdg_teleco_backups", today, JSON.parse(JSON.stringify(currentData)));
        
        localStorage.setItem('last_daily_backup', today);
        setLastBackupStatus(`Backup automático: ${today}`);
    } catch (e) {
        console.error("Error backup diario", e);
    }
  };

  // FUNCION BACKUP MANUAL
  const performManualBackup = async () => {
    if (!isCloudConnected) {
        toast.error("⚠️ No hay conexión con la nube. No se puede realizar el backup.");
        return;
    }
    const today = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toLocaleTimeString().replace(/:/g, '-');
    const backupId = `MANUAL_${today}_${timestamp}`;
    
    try {
        const fb = (window as any).firebase;
        const db = fb.app().firestore();
        
        await saveBackupToFirestore(db, "jdg_teleco_backups", backupId, JSON.parse(JSON.stringify(data)));

        toast.success(`✅ Copia de seguridad manual creada exitosamente.\n\nID: ${backupId}`);
        setLastBackupStatus(`Backup Manual: ${today} ${timestamp}`);
    } catch (e: any) {
        console.error(e);
        if (e.code === 'permission-denied') {
            toast.error("❌ ERROR DE PERMISOS: No se pudo crear el backup. Revisa las reglas de Firestore.");
        } else {
            toast.error("❌ Error al crear copia de seguridad: " + e.message);
        }
    }
  };

  // OPTIMIZACIÓN: Debounced save + BACKUP CHECK
  useEffect(() => {
    if (isInitialLoading) return;

    const timeoutId = setTimeout(() => {
        // Save to LocalStorage
        let dataToSave = { ...data };
        try {
            // Limpiar datos pesados (imágenes base64) antes de guardar en localStorage
            if (dataToSave.reports) {
                dataToSave.reports = dataToSave.reports.map(r => {
                    if (r.tickets && r.tickets.some(t => t.data && t.data.length > 1000)) {
                        return {
                            ...r,
                            tickets: r.tickets.map(t => ({
                                ...t,
                                data: t.driveUrl?.includes('✅') ? '' : t.data
                            }))
                        };
                    }
                    return r;
                });
            }

            // También limpiar adjuntos de obras si son pesados para localStorage
            if (dataToSave.projectsDetailed) {
                dataToSave.projectsDetailed = dataToSave.projectsDetailed.map(p => {
                    if (p.attachments && p.attachments.some(att => att.data && att.data.length > 5000)) {
                        return {
                            ...p,
                            attachments: p.attachments.map(att => ({ ...att, data: '' })) // Limpiar base64 en local si es muy pesado
                        };
                    }
                    return p;
                });
            }
            
            const serialized = JSON.stringify(dataToSave);
            localStorage.setItem('workerApp_db', serialized);
        } catch (e) {
            console.error("Error saving to localStorage (QuotaExceeded):", e);
            // Si sigue fallando, guardar una versión más ligera
            try {
                const lighterData = { ...dataToSave };
                if (lighterData.reports) lighterData.reports = lighterData.reports.slice(0, 50);
                if (lighterData.projectsDetailed) {
                    lighterData.projectsDetailed = lighterData.projectsDetailed.map(p => ({ ...p, attachments: [] }));
                }
                localStorage.setItem('workerApp_db', JSON.stringify(lighterData));
            } catch (e2) {
                console.error("Error saving lighter version to localStorage:", e2);
            }
        }

        // Save Config to Cloud if applicable
        if (isCloudConnected && hasSyncedWithCloud) {
            
            // INTENTO DE BACKUP DIARIO
            performDailyBackup(data);

            if (isInternalUpdate.current) {
                isInternalUpdate.current = false;
                return;
            }
            const saveToCloud = async () => {
                try {
                    const fb = (window as any).firebase;
                    if (!fb) return;
                    const db = fb.app().firestore();
                    const { reports, projectsDetailed, ...configOnly } = data;

                    if ((!configOnly.technicians || configOnly.technicians.length === 0) && (!projectsDetailed || projectsDetailed.length === 0)) {
                        return;
                    }

                    const cleanConfig = JSON.parse(JSON.stringify(configOnly));
                    
                    // Limitar el historial a los últimos 30 días antes de guardar
                    if (cleanConfig.dailyOrgHistory) {
                        const keys = Object.keys(cleanConfig.dailyOrgHistory).sort((a, b) => b.localeCompare(a));
                        if (keys.length > 30) {
                            keys.slice(30).forEach(k => delete cleanConfig.dailyOrgHistory[k]);
                        }
                    }

                    await db.collection("jdg_teleco").doc("main_db").set(cleanConfig);
                } catch (e: any) {
                    console.error("Cloud sync error", e);
                }
            };
            saveToCloud();
        }
    }, 800); 

    return () => clearTimeout(timeoutId);
  }, [data, isCloudConnected, hasSyncedWithCloud, isInitialLoading]);

  const handleLogin = (role: 'admin' | 'tech', username?: string) => {
    setUserRole(role);
    if (username) {
        setCurrentUser(username);
        const tech = data.technicians.find(t => t.name === username);
        if (tech) setCurrentUserId(tech.id);
    }
    setView(role === 'admin' ? 'admin' : 'dashboard');
  };

  const handleLogout = () => {
    setUserRole(null);
    setCurrentUser('');
    setCurrentUserId('');
    setEditingReport(null);
    setView('login');
  };

  const deleteReport = async (reportId: string) => {
    if (!window.confirm('¿Mover este parte a la papelera de reciclaje?')) return;

    isSyncingRef.current = true;
    isInternalUpdate.current = false;

    const reportToDelete = data.reports.find(r => r.id === reportId);

    setData(prev => ({
        ...prev,
        reports: prev.reports.filter(r => r.id !== reportId),
        deletedReports: [
            ...(prev.deletedReports || []),
            ...(reportToDelete ? [{ ...reportToDelete, deletedAt: new Date().toISOString() }] : [])
        ].slice(-50) // Mantener solo los últimos 50 borrados
    }));

    if (isCloudConnected) {
        try {
            const fb = (window as any).firebase;
            const db = fb.app().firestore();
            // Borrar de la colección principal
            await db.collection("jdg_teleco").doc("main_db").collection("reports").doc(reportId).delete();
            
            // Opcional: Guardar en una colección de "papelera" en la nube
            if (reportToDelete) {
                await db.collection("jdg_teleco_trash").doc(reportId).set({
                    ...reportToDelete,
                    deletedAt: new Date().toISOString()
                });
            }
            
            toast.success("Parte movido a la papelera");
        } catch (e) {
            console.error("Error al borrar en la nube:", e);
            toast.error("Error al eliminar en la nube");
        }
    } else {
        toast.success("Parte movido a la papelera local");
    }

    setTimeout(() => {
        isSyncingRef.current = false;
    }, 1500);
  };

  const saveReport = async (report: WorkReport, shouldRedirect: boolean = true) => {
    const techName = report.technician?.trim() || (currentUser && currentUser !== 'ADMIN' ? currentUser : '');
    if (!techName) {
      toast.error("Error: No se puede guardar un parte sin técnico asignado.");
      return;
    }

    const finalReport = { ...report, technician: techName };

    // Evitamos window.confirm bloqueante si es posible, o lo manejamos rápido
    const isDuplicate = data.reports.some(r => 
        r.technician === finalReport.technician && 
        r.date === finalReport.date && 
        r.id !== finalReport.id
    );

    if (isDuplicate && currentUser && currentUser !== 'ADMIN') {
        if (!window.confirm(`AVISO: Ya existe un parte para ${finalReport.technician} en la fecha ${finalReport.date}.\n¿Quieres añadir otro?`)) return;
    }
    
    isSyncingRef.current = true;
    isInternalUpdate.current = false;

    try {
        if (finalReport.tickets && finalReport.tickets.length > 0) {
          setIsUploadingTickets(true);
          toast.info("Subiendo tickets a Drive...");
          for (let i = 0; i < finalReport.tickets.length; i++) {
            const ticket = finalReport.tickets[i];
            if (ticket.driveUrl && ticket.driveUrl.includes('✅')) continue; 

            try {
              await fetch(GOOGLE_DRIVE_WEBHOOK, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({
                  technician: currentUser,
                  base64: ticket.data, 
                  filename: `TICKET_${ticket.type.toUpperCase().replace(/\s+/g, '_')}_${finalReport.date}_${i+1}.jpg`,
                  reportDate: finalReport.date 
                })
              });
              finalReport.tickets[i].driveUrl = '✅ Subido y Organizado';
              // Ya NO limpiamos t.data para que sea visible en el detalle
            } catch (e) {
              console.error("Error Drive:", e);
              finalReport.tickets[i].driveUrl = '❌ Error';
            }
          }
          setIsUploadingTickets(false);
        }

        setData(prev => {
          const existingIndex = prev.reports.findIndex(r => r.id === finalReport.id);
          let updatedReports;
          if (existingIndex >= 0) {
            updatedReports = [...prev.reports];
            updatedReports[existingIndex] = finalReport;
          } else {
            updatedReports = [finalReport, ...prev.reports];
          }
          return { ...prev, reports: updatedReports };
        });

        if (isCloudConnected) {
            try {
                const fb = (window as any).firebase;
                const db = fb.app().firestore();
                const firestorePayload = JSON.parse(JSON.stringify(finalReport));
                await db.collection("jdg_teleco").doc("main_db").collection("reports").doc(finalReport.id).set(firestorePayload);
                toast.success("Parte guardado en la nube");
            } catch (e: any) {
                console.error("Firebase error", e);
                toast.error("Error al sincronizar con la nube");
            }
        } else {
            toast.success("Parte guardado localmente");
        }
    } finally {
        isSyncingRef.current = false;
        if (shouldRedirect) {
            setEditingReport(null);
            setView('dashboard');
        }
    }
  };

  const saveProject = async (project: ProjectData) => {
    isSyncingRef.current = true;
    isInternalUpdate.current = false;

    try {
        setData(prev => {
            const existingIndex = prev.projectsDetailed.findIndex(p => p.id === project.id);
            let updatedProjects;
            if (existingIndex >= 0) {
                updatedProjects = [...prev.projectsDetailed];
                updatedProjects[existingIndex] = project;
            } else {
                updatedProjects = [project, ...prev.projectsDetailed];
            }
            return { ...prev, projectsDetailed: updatedProjects };
        });

        if (isCloudConnected) {
            try {
                const fb = (window as any).firebase;
                const db = fb.app().firestore();
                const firestorePayload = JSON.parse(JSON.stringify(project));
                await db.collection("jdg_teleco").doc("main_db").collection("projects").doc(project.id).set(firestorePayload);
                toast.success("Obra guardada en la nube");
            } catch (e: any) {
                console.error("Firebase project save error", e);
                toast.error("Error al sincronizar obra con la nube");
            }
        } else {
            toast.success("Obra guardada localmente");
        }
    } finally {
        isSyncingRef.current = false;
    }
  };

  const recoverProjectsFromBackup = async () => {
    if (!isCloudConnected) {
        toast.error("⚠️ No hay conexión con la nube.");
        return;
    }
    
    try {
        const fb = (window as any).firebase;
        const db = fb.app().firestore();
        
        toast.info("Buscando obras en copias de seguridad...");
        
        // Buscamos en los últimos 15 backups (orden descendente por ID que es la fecha)
        const backupsSnap = await db.collection('jdg_teleco_backups').get();
        const backups = backupsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.id || '').localeCompare(a.id || ''))
            .slice(0, 15);
        
        if (backups.length === 0) {
            toast.error("No se encontraron copias de seguridad.");
            return;
        }

        for (const bData of backups) {
            let projectsToUse = (bData as any).projectsDetailed;
            if (!projectsToUse || projectsToUse.length === 0) {
                // Soportar el nuevo formato de backup donde projectsDetailed se guarda en shards
                const projectsSnap = await db.collection('jdg_teleco_backups').doc(bData.id).collection('projects_shards').get();
                if (!projectsSnap.empty) {
                    let allProjects: ProjectData[] = [];
                    projectsSnap.forEach((d: any) => {
                        if (d.data().items) allProjects.push(...d.data().items);
                    });
                    projectsToUse = allProjects;
                }
            }

            if (projectsToUse && projectsToUse.length > 0) {
                const count = projectsToUse.length;
                if (window.confirm(`He encontrado una copia (${bData.id}) con ${count} obras. ¿Deseas restaurar estas obras?\n\n(Esto recuperará las obras desaparecidas sin afectar a tus partes actuales)`)) {
                    
                    setData(prev => {
                        const merged = [...projectsToUse];
                        prev.projectsDetailed.forEach(p => {
                            if (!merged.find(mp => mp.id === p.id)) {
                                merged.push(p);
                            }
                        });
                        return {
                            ...prev,
                            projectsDetailed: merged.sort((a, b) => (b.id || '').localeCompare(a.id || ''))
                        };
                    });

                    // Migrar inmediatamente a la nueva colección para que no vuelvan a desaparecer
                    const projectsRef = db.collection("jdg_teleco").doc("main_db").collection("projects");
                    const batch = db.batch();
                    projectsToUse.forEach((p: any) => {
                        batch.set(projectsRef.doc(p.id), p);
                    });
                    await batch.commit();

                    toast.success(`✅ ${count} obras restauradas y sincronizadas correctamente.`);
                    return;
                }
            }
        }
        
        toast.error("No se encontraron obras en las copias de seguridad recientes.");
    } catch (e: any) {
        console.error("Error en recuperación:", e);
        toast.error("Error al intentar recuperar: " + e.message);
    }
  };

  const restoreFullBackup = async (backupId: string) => {
    if (!isCloudConnected) {
        toast.error("⚠️ No hay conexión con la nube para restaurar.");
        return;
    }

    if(!window.confirm(`⚠️ PELIGRO: Esto sobrescribirá TODOS los datos actuales con la copia del ${backupId}.\n\n¿Estás seguro de continuar?`)) return;

    isSyncingRef.current = true;
    isInternalUpdate.current = false;
    setIsInitialLoading(true);

    try {
        const fb = (window as any).firebase;
        const db = fb.app().firestore();
        
        // 1. Obtener documento principal del backup
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

        // 3.5 Reconstruir Projects desde Shards (con fallback por si es un backup antiguo donde projectsDetailed estaba en el documento raíz)
        const projectsSnap = await db.collection('jdg_teleco_backups').doc(backupId).collection('projects_shards').get();
        if (!projectsSnap.empty) {
            let allProjects: ProjectData[] = [];
            projectsSnap.forEach((d: any) => {
                if(d.data().items) allProjects.push(...d.data().items);
            });
            restoredData.projectsDetailed = allProjects;
        } else if (!restoredData.projectsDetailed) {
            restoredData.projectsDetailed = [];
        }

        // 4. LIMPIEZA Y SINCRONIZACIÓN (CRÍTICO)
        
        // A. Limpiar y Sincronizar Reportes
        const reportsRef = db.collection("jdg_teleco").doc("main_db").collection("reports");
        const currentReportsSnap = await reportsRef.get();
        
        // Borrar actuales en bloques de 450
        if (!currentReportsSnap.empty) {
            const docs = currentReportsSnap.docs;
            for (let i = 0; i < docs.length; i += 450) {
                const batch = db.batch();
                docs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
        }

        // Subir nuevos
        if (restoredData.reports && restoredData.reports.length > 0) {
            const reportsToSync = restoredData.reports;
            for (let i = 0; i < reportsToSync.length; i += 450) {
                const batch = db.batch();
                reportsToSync.slice(i, i + 450).forEach(r => {
                    batch.set(reportsRef.doc(r.id), r);
                });
                await batch.commit();
            }
        }

        // B. Limpiar y Sincronizar Obras
        const projectsRef = db.collection("jdg_teleco").doc("main_db").collection("projects");
        const currentProjectsSnap = await projectsRef.get();
        
        // Borrar actuales en bloques de 450
        if (!currentProjectsSnap.empty) {
            const docs = currentProjectsSnap.docs;
            for (let i = 0; i < docs.length; i += 450) {
                const batch = db.batch();
                docs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
        }

        // Subir nuevos
        if (restoredData.projectsDetailed && restoredData.projectsDetailed.length > 0) {
            const projectsToSync = restoredData.projectsDetailed;
            for (let i = 0; i < projectsToSync.length; i += 450) {
                const batch = db.batch();
                projectsToSync.slice(i, i + 450).forEach(p => {
                    batch.set(projectsRef.doc(p.id), p);
                });
                await batch.commit();
            }
        }

        // C. Sincronizar Configuración General
        const { reports, projectsDetailed, dailyOrgHistory, ...configOnly } = restoredData;
        
        // Limitar historial a 30 días para no saturar el documento principal
        if (dailyOrgHistory) {
            const keys = Object.keys(dailyOrgHistory).sort((a, b) => b.localeCompare(a));
            const limitedHistory: any = {};
            keys.slice(0, 30).forEach(k => {
                limitedHistory[k] = dailyOrgHistory[k];
            });
            (configOnly as any).dailyOrgHistory = limitedHistory;
        }

        const cleanConfig = JSON.parse(JSON.stringify(configOnly));
        await db.collection("jdg_teleco").doc("main_db").set(cleanConfig);

        // 5. Actualizar estado local
        setData(restoredData);
        toast.success(`✅ Sistema restaurado y sincronizado correctamente al estado: ${backupId}`);

    } catch (e: any) {
        console.error("Restore error", e);
        toast.error("Error restaurando copia: " + e.message);
    } finally {
        setIsInitialLoading(false);
        setTimeout(() => {
            isSyncingRef.current = false;
        }, 3000);
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!window.confirm('¿Eliminar esta obra permanentemente?')) return;

    isSyncingRef.current = true;
    isInternalUpdate.current = false;

    try {
        setData(prev => ({
            ...prev,
            projectsDetailed: prev.projectsDetailed.filter(p => p.id !== projectId)
        }));

        if (isCloudConnected) {
            try {
                const fb = (window as any).firebase;
                const db = fb.app().firestore();
                await db.collection("jdg_teleco").doc("main_db").collection("projects").doc(projectId).delete();
                toast.success("Obra eliminada de la nube");
            } catch (e) {
                console.error("Error al borrar obra en la nube:", e);
                toast.error("Error al eliminar obra en la nube");
            }
        } else {
            toast.success("Obra eliminada localmente");
        }
    } finally {
        isSyncingRef.current = false;
    }
  };

  // Función para armonizar la lista de trabajadores de la organización con los técnicos del sistema
  const harmonizeWorkers = (org: DailyOrgData, technicians: TechUser[]): DailyOrgData => {
      if (!org) return org;
      const colors = ['#E63946','#F77F00','#06D6A0','#118AB2','#073B4C','#D62828','#FCA311','#14213D','#00B4D8','#0077B6'];
      const activeTechs = (technicians || []).filter(t => t.active !== false);

      const excludedNames = new Set((org.excluidos || []).map(e => e.trim().toUpperCase()));
      const registeredNames = new Set(activeTechs.map(t => t.name.trim().toUpperCase()));
      const assignedNames = new Set<string>();

      (org.trabajos || []).forEach(job => {
          (job.trabajadores || []).forEach(w => {
              assignedNames.add(w.nombre.trim().toUpperCase());
          });
      });

      // Mapeamos trabajadores existentes
      let updatedWorkers = (org.trabajadores || []).map(w => {
          const isActuallyAssigned = assignedNames.has(w.nombre.trim().toUpperCase());
          return {
              ...w,
              asignado: isActuallyAssigned
          };
      }).filter(w => {
          const nameUpper = w.nombre.trim().toUpperCase();
          if (excludedNames.has(nameUpper) && !assignedNames.has(nameUpper)) {
              return false;
          }
          return registeredNames.has(nameUpper) || assignedNames.has(nameUpper) || w.isManual;
      });

      // Añadir técnicos nuevos que no existían en esta organización
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

      return {
          ...org,
          trabajadores: updatedWorkers
      };
  };

  // Manejo de actualización de Daily Organization (CON ARMONIZACIÓN DE TRABAJADORES)
  const handleDailyOrgUpdate = (newOrg: DailyOrgData) => {
      isSyncingRef.current = true;
      isInternalUpdate.current = false; 
      setData(prev => {
          const history = { ...(prev.dailyOrgHistory || {}) };
          
          // Armonizamos la organización antes de archivarla en history
          const harmonizedOrg = harmonizeWorkers(newOrg, prev.technicians);

          if (harmonizedOrg && harmonizedOrg.fecha) {
              history[harmonizedOrg.fecha] = harmonizedOrg;
          }
          
          // Limitar el historial a los últimos 30 días para evitar exceder el límite de 1MB en Firestore
          const keys = Object.keys(history).sort((a, b) => b.localeCompare(a));
          if (keys.length > 30) {
              keys.slice(30).forEach(k => delete history[k]);
          }

          return {
              ...prev, 
              dailyOrg: harmonizedOrg,
              dailyOrgHistory: history
          };
      }); 
      setTimeout(() => { isSyncingRef.current = false; }, 2000);
  };

  // Manejo de cambio de fecha en Daily Organization (CARGA DE DATOS + ARMONIZACIÓN)
  const handleDailyOrgDateChange = (newDate: string) => {
      const existingData = data.dailyOrgHistory?.[newDate];
      let orgToLoad: DailyOrgData;

      if (existingData) {
          orgToLoad = existingData;
      } else {
          // Nueva fecha: mantenemos trabajadores de la organización activos pero limpios de asignaciones
          const currentWorkers = data.dailyOrg?.trabajadores || [];
          const cleanWorkers = currentWorkers.map(w => ({ ...w, asignado: false }));
          orgToLoad = {
              fecha: newDate,
              trabajos: [],
              trabajadores: cleanWorkers,
              lastUpdated: Date.now()
          };
      }

      // Armonizamos técnicos registrados en el sistema
      const harmonizedOrg = harmonizeWorkers(orgToLoad, data.technicians);

      isSyncingRef.current = true;
      isInternalUpdate.current = false;
      setData(prev => ({ ...prev, dailyOrg: harmonizedOrg }));
      setTimeout(() => { isSyncingRef.current = false; }, 2000);
  };

  // Manejo de cambio de fecha en Daily Organization para TÉCNICOS (SOLO LOCAL - NO ESCRIBE NI MODIFICA LA BASE DE DATOS)
  const handleTechDateChange = (newDate: string) => {
      const existingData = data.dailyOrgHistory?.[newDate];
      let orgToLoad: DailyOrgData;

      if (existingData) {
          orgToLoad = JSON.parse(JSON.stringify(existingData));
      } else {
          // Nueva fecha limpia local
          const currentWorkers = techViewOrg?.trabajadores || data.dailyOrg?.trabajadores || [];
          const cleanWorkers = currentWorkers.map(w => ({ ...w, asignado: false }));
          orgToLoad = {
              fecha: newDate,
              trabajos: [],
              trabajadores: cleanWorkers,
              lastUpdated: Date.now()
          };
      }

      const harmonizedOrg = harmonizeWorkers(orgToLoad, data.technicians);
      setTechViewOrg(harmonizedOrg);
  };

  // Sincronizar en tiempo real los cambios del Admin para el Técnico si visualiza el mismo día
  useEffect(() => {
    if (userRole === 'admin' || !techViewOrg || view !== 'daily_org') return;
    const currentViewDate = techViewOrg.fecha;
    const updatedServerOrg = data.dailyOrgHistory?.[currentViewDate] || (data.dailyOrg?.fecha === currentViewDate ? data.dailyOrg : null);
    if (updatedServerOrg) {
        const harmonized = harmonizeWorkers(JSON.parse(JSON.stringify(updatedServerOrg)), data.technicians);
        if (JSON.stringify(harmonized) !== JSON.stringify(techViewOrg)) {
            setTechViewOrg(harmonized);
        }
    }
  }, [data.dailyOrg, data.dailyOrgHistory, view, userRole, data.technicians]);

  // Estabilizador de Organización Diaria: Si la fecha está en el pasado,
  // cambiamos automáticamente la fecha por defecto a HOY para forzar la consistencia de los datos del día (SOLO PARA ADMINISTRADORES)
  useEffect(() => {
    if (isInitialLoading || userRole !== 'admin') return;
    const today = new Date().toISOString().split('T')[0];
    if (data.dailyOrg?.fecha && data.dailyOrg.fecha < today) {
        handleDailyOrgDateChange(today);
    }
  }, [isInitialLoading, userRole]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-brand-dark text-gray-900 dark:text-gray-100 font-sans pb-20 transition-colors duration-300">
      <Toaster position="top-center" richColors />
      {showConfigGuide && (
          <div className="fixed inset-0 z-[200] bg-black/95 p-6 flex items-center justify-center backdrop-blur-md overflow-y-auto">
              <div className="bg-white dark:bg-brand-panel w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-2xl space-y-6">
                  <div className="flex justify-between items-center">
                      <h2 className="text-xl font-black text-brand-teal dark:text-brand-lime uppercase tracking-widest">Guía de Solución</h2>
                      <button onClick={() => setShowConfigGuide(false)} className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full"><XIcon className="w-5 h-5"/></button>
                  </div>
                  <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                      <p>Para que las fotos se guarden organizadas en Drive:</p>
                      <ul className="list-disc ml-5 space-y-2">
                        <li>Asegúrate de haber pegado el código actualizado en Google Apps Script.</li>
                        <li>Haz clic en "Nueva Implementación" en el editor de Google.</li>
                        <li>Copia la URL generada y pégala en <code>App.tsx</code> (la constante <code>GOOGLE_DRIVE_WEBHOOK</code>).</li>
                      </ul>
                  </div>
                  <button onClick={() => setShowConfigGuide(false)} className="w-full bg-brand-teal text-white py-4 rounded-xl font-bold uppercase tracking-widest">Cerrar</button>
              </div>
          </div>
      )}

      {firebaseError && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white p-3 text-center text-xs font-bold shadow-xl flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2">
                <AlertIcon className="w-4 h-4" />
                <span>{firebaseError}</span>
            </div>
            <button onClick={() => setShowConfigGuide(true)} className="bg-white text-red-600 px-3 py-1 rounded-full uppercase text-[10px] font-black">Ayuda</button>
        </div>
      )}

      {isUploadingTickets && (
        <div className="fixed inset-0 z-[60] bg-white/90 dark:bg-brand-dark/95 flex flex-col items-center justify-center backdrop-blur-sm">
            <CloudIcon className="w-16 h-16 text-brand-teal animate-bounce mb-4" />
            <p className="text-gray-900 dark:text-white font-black text-xl mb-2 text-center px-6">Organizando carpetas en Drive...</p>
            <p className="text-brand-teal dark:text-brand-lime text-xs animate-pulse uppercase tracking-widest">No cierres la aplicación</p>
        </div>
      )}

      {view !== 'login' && (
        <header className="bg-white dark:bg-brand-panel border-b border-gray-200 dark:border-gray-700 p-4 sticky top-0 z-10 shadow-md transition-colors duration-300">
          <div className="container mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView(userRole === 'admin' ? 'admin' : 'dashboard')}>
              <Logo className="h-8 w-auto" />
              <div>
                <h1 className="font-bold text-lg leading-tight text-gray-900 dark:text-white hidden sm:block">Control de Obras</h1>
                <div className="flex items-center gap-2">
                    <p className="text-[10px] text-brand-teal dark:text-brand-lime font-bold tracking-widest uppercase">{userRole === 'admin' ? 'ADMIN' : currentUser}</p>
                    <span className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border ${hasSyncedWithCloud ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800' : 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800'}`}>
                        <WifiIcon className="w-2.5 h-2.5" /> {hasSyncedWithCloud ? 'En Línea' : 'Offline'}
                    </span>
                    {lastBackupStatus && <span className="text-[8px] text-gray-400">({lastBackupStatus})</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
                 <button onClick={toggleTheme} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 transition-colors">
                    {theme === 'dark' ? <SunIcon className="w-6 h-6 text-yellow-400" /> : <MoonIcon className="w-6 h-6 text-brand-dark" />}
                 </button>
                {userRole && (
                  <button 
                    onClick={() => setView('vacations')} 
                    className={`relative px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'vacations' ? 'bg-brand-teal text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-brand-teal dark:hover:text-white'}`}
                  >
                    🌴 Vacaciones
                    {userRole === 'admin' && pendingVacCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-brand-panel animate-bounce shadow-lg">
                        {pendingVacCount}
                      </span>
                    )}
                  </button>
                )}
                <button onClick={handleLogout} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-red-500 transition-colors"><LogOutIcon className="w-6 h-6" /></button>
            </div>
          </div>
        </header>
      )}

      <main className={`container mx-auto p-4 ${view === 'admin' || view === 'vacations' ? 'max-w-6xl' : 'md:max-w-3xl'}`}>
        <AnimatePresence mode="wait">
          {view === 'login' && (
            <motion.div key="login" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <UserLogin onLogin={handleLogin} technicians={data.technicians} adminPwd={data.adminPassword || 'admin'} onViewDailyOrg={() => {
                const todayStr = new Date().toISOString().split('T')[0];
                const existingOrg = data.dailyOrgHistory?.[todayStr];
                const orgToLoad = existingOrg ? JSON.parse(JSON.stringify(existingOrg)) : JSON.parse(JSON.stringify(data.dailyOrg));
                setTechViewOrg(harmonizeWorkers(orgToLoad, data.technicians));
                setView('daily_org');
              }} toggleTheme={toggleTheme} isDark={theme === 'dark'} hasUnreadOrg={hasUnseenDailyOrg} />
            </motion.div>
          )}
          {view === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <TechDashboard reports={data.reports.filter(r => r.technician === currentUser)} projects={data.projectsDetailed} onNewReport={() => setView('form')} onEditReport={(r) => { setEditingReport(r); setView('form'); }} onViewDailyOrg={() => {
                const todayStr = new Date().toISOString().split('T')[0];
                const existingOrg = data.dailyOrgHistory?.[todayStr];
                const orgToLoad = existingOrg ? JSON.parse(JSON.stringify(existingOrg)) : JSON.parse(JSON.stringify(data.dailyOrg));
                setTechViewOrg(harmonizeWorkers(orgToLoad, data.technicians));
                setView('daily_org');
              }} onDeleteReport={deleteReport} hasUnreadOrg={hasUnseenDailyOrg} />
            </motion.div>
          )}
          {view === 'vacations' && (
            <motion.div key="vacations" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}>
              <VacationManager role={userRole || 'tech'} currentUser={currentUser} currentUserId={currentUserId} data={data} onUpdate={(newData) => { isSyncingRef.current = true; isInternalUpdate.current = false; setData(newData); setTimeout(() => {isSyncingRef.current = false;}, 2000); }} onBack={() => setView(userRole === 'admin' ? 'admin' : 'dashboard')} />
            </motion.div>
          )}
          
          {view === 'daily_org' && (
            <motion.div key="daily_org" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <DailyOrganization 
                  key={userRole === 'admin' ? data.dailyOrg.fecha : (techViewOrg?.fecha || 'tech_default')} 
                  isReadOnly={userRole !== 'admin'} 
                  data={userRole === 'admin' ? data.dailyOrg : (techViewOrg || data.dailyOrg)} 
                  onUpdate={userRole === 'admin' ? handleDailyOrgUpdate : () => {}}
                  onChangeDate={userRole === 'admin' ? handleDailyOrgDateChange : handleTechDateChange}
                  onBack={() => setView(userRole ? (userRole === 'admin' ? 'admin' : 'dashboard') : 'login')}
                  onMarkSeen={markDailyOrgAsSeen} 
              />
            </motion.div>
          )}
          
          {view === 'form' && (
            <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }}>
              <ReportForm 
                projects={data.projectsDetailed} 
                vehicles={data.vehicles} 
                technicians={data.technicians}
                currentUser={currentUser}
                userRole={userRole}
                initialData={editingReport} 
                onSave={saveReport} 
                onCancel={() => setView(userRole === 'admin' ? 'admin' : 'dashboard')} 
              />
            </motion.div>
          )}
          {view === 'admin' && (
            <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <AdminPanel 
                    data={data} 
                    setData={(updater) => { isSyncingRef.current = true; isInternalUpdate.current = false; setData(updater); setTimeout(() => {isSyncingRef.current = false;}, 2000); }} 
                    onGoToVacations={() => setView('vacations')} 
                    onDeleteReport={deleteReport} 
                    onManualBackup={performManualBackup} 
                    onUpdateReport={saveReport}
                    onEditReport={(r) => { setEditingReport(r); setView('form'); }}
                    onSaveProject={saveProject}
                    onDeleteProject={deleteProject}
                    onRecoverProjects={recoverProjectsFromBackup}
                    onRestoreFullBackup={restoreFullBackup}
                />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default App;
