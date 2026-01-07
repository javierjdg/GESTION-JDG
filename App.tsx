
import React, { useState, useEffect, useRef, useMemo } from 'react';
import UserLogin from './components/UserLogin';
import ReportForm from './components/ReportForm';
import AdminPanel from './components/AdminPanel';
import TechDashboard from './components/TechDashboard';
import DailyOrganization, { DailyOrgData } from './components/DailyOrganization';
import VacationManager from './components/VacationManager';
import { Logo } from './components/Logo';
import { LogOutIcon, WifiIcon, CloudIcon, AlertIcon, XIcon, CheckCircleIcon } from './components/icons';

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

export interface WorkReport {
  id: string;
  technician: string;
  projectNum: string; 
  date: string;
  startTime: string;
  endTime: string;
  overtimeHours: number;
  overtimeType: 'NORMAL' | 'NOCTURNA' | 'FINDE SEMANA';
  description: string;
  vehicle: string;
  isDriver: boolean;
  driverTripType?: 'IDA' | 'VUELTA' | 'IDA_Y_VUELTA';
  expenses: {
    food: number;
    gas: number;
    parking: number;
    others: number;
    othersDesc: string;
  };
  imageNames: string[];
  tickets?: ExpenseTicket[];
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
}

export interface AppData {
  technicians: TechUser[];
  projects: string[];
  vehicles: string[];
  reports: WorkReport[];
  dailyOrg: DailyOrgData;
  vacationRequests: VacationRequest[];
  holidays: string[];
  adminPassword?: string;
  firebaseConfig?: string;
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
    fecha: new Date().toISOString().split('T')[0]
};

const INITIAL_DATA: AppData = {
  technicians: [],
  projects: [],
  vehicles: [],
  reports: [],
  vacationRequests: [],
  holidays: ['2025-01-01', '2025-01-06', '2025-04-18', '2025-04-21', '2025-05-01', '2025-08-15', '2025-10-12', '2025-11-01', '2025-12-06', '2025-12-08', '2025-12-25'],
  dailyOrg: DEFAULT_DAILY_ORG,
  adminPassword: 'admin',
  firebaseConfig: JSON.stringify(FIREBASE_CONFIG)
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

  // Contador de vacaciones pendientes para el admin
  const pendingVacCount = useMemo(() => {
    return (data.vacationRequests || []).filter(r => r.status === 'pending' || r.status === 'cancel_requested').length;
  }, [data.vacationRequests]);

  useEffect(() => {
    let unsubConfig = () => {};
    let unsubReports = () => {};

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
            if (isSyncingRef.current) return; // Ignorar snapshots mientras el usuario está interactuando
            if (snapshot.exists) {
                const cloudConfig = snapshot.data();
                setData(prev => ({
                    ...prev,
                    ...cloudConfig,
                    reports: prev.reports 
                }));
            }
        }, (error: any) => {
            if (error.code === 'permission-denied') {
                setFirebaseError("❌ ERROR: Revisa las Reglas de Firebase y pulsa PUBLICAR.");
                setIsInitialLoading(false);
            }
        });

        unsubReports = db.collection("jdg_teleco").doc("main_db").collection("reports").onSnapshot((snapshot: any) => {
            if (isSyncingRef.current) return; // Ignorar snapshots mientras el usuario está interactuando
            const cloudReports: WorkReport[] = [];
            snapshot.forEach((doc: any) => {
                cloudReports.push(doc.data() as WorkReport);
            });
            
            isInternalUpdate.current = true;
            setData(prev => ({
                ...prev,
                reports: cloudReports.sort((a, b) => b.date.localeCompare(a.date))
            }));
            
            setHasSyncedWithCloud(true);
            setIsInitialLoading(false);
            setFirebaseError(null);
        }, (error: any) => {
            if (error.code === 'permission-denied') {
                setFirebaseError("❌ ERROR de Permisos. Revisa Firestore Rules.");
                setIsInitialLoading(false);
            }
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
    };
  }, [data.firebaseConfig]);

  // OPTIMIZACIÓN: Debounced save to avoid INP/Performance issues
  useEffect(() => {
    if (isInitialLoading) return;

    const timeoutId = setTimeout(() => {
        // Save to LocalStorage
        const serialized = JSON.stringify(data);
        localStorage.setItem('workerApp_db', serialized);

        // Save Config to Cloud if applicable
        if (isCloudConnected && hasSyncedWithCloud) {
            if (isInternalUpdate.current) {
                isInternalUpdate.current = false;
                return;
            }
            const saveToCloud = async () => {
                try {
                    const fb = (window as any).firebase;
                    if (!fb) return;
                    const db = fb.app().firestore();
                    const { reports, ...configOnly } = data;
                    const cleanConfig = JSON.parse(JSON.stringify(configOnly));
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
    if (!window.confirm('¿Eliminar este parte permanentemente?')) return;

    // Bloquear snapshots entrantes para evitar que el registro reaparezca
    isSyncingRef.current = true;

    // 1. Borrado local inmediato para feedback visual
    setData(prev => ({
        ...prev,
        reports: prev.reports.filter(r => r.id !== reportId)
    }));

    // 2. Borrado en la nube
    if (isCloudConnected) {
        try {
            const fb = (window as any).firebase;
            const db = fb.app().firestore();
            await db.collection("jdg_teleco").doc("main_db").collection("reports").doc(reportId).delete();
        } catch (e) {
            console.error("Error al borrar en la nube:", e);
        }
    }

    // Desbloquear tras un breve periodo para asegurar que el snapshot del borrado haya sido procesado
    setTimeout(() => {
        isSyncingRef.current = false;
    }, 1500);
  };

  const saveReport = async (report: WorkReport) => {
    const isDuplicate = data.reports.some(r => 
        r.technician === currentUser && 
        r.date === report.date && 
        r.id !== report.id
    );

    if (isDuplicate) {
        if (!window.confirm(`AVISO: Ya existe un parte a tu nombre para el ${report.date}.\n¿Quieres añadir otro?`)) return;
    }

    const finalReport = { ...report, technician: currentUser };
    
    // Bloquear snapshots durante la subida
    isSyncingRef.current = true;

    if (finalReport.tickets && finalReport.tickets.length > 0) {
      setIsUploadingTickets(true);
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
        } catch (e: any) {
            console.error("Firebase error", e);
        }
    }

    setTimeout(() => { isSyncingRef.current = false; }, 2000);
    setEditingReport(null);
    setView('dashboard');
  };

  return (
    <div className="min-h-screen bg-brand-dark text-gray-100 font-sans pb-20">
      
      {showConfigGuide && (
          <div className="fixed inset-0 z-[200] bg-black/95 p-6 flex items-center justify-center backdrop-blur-md overflow-y-auto">
              <div className="bg-brand-panel w-full max-w-lg rounded-2xl border border-gray-700 p-6 shadow-2xl space-y-6">
                  <div className="flex justify-between items-center">
                      <h2 className="text-xl font-black text-brand-lime uppercase tracking-widest">Guía de Solución</h2>
                      <button onClick={() => setShowConfigGuide(false)} className="p-2 bg-gray-800 rounded-full"><XIcon className="w-5 h-5"/></button>
                  </div>
                  <div className="space-y-4 text-sm text-gray-300">
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
        <div className="fixed inset-0 z-[60] bg-brand-dark/95 flex flex-col items-center justify-center backdrop-blur-sm">
            <CloudIcon className="w-16 h-16 text-brand-teal animate-bounce mb-4" />
            <p className="text-white font-black text-xl mb-2 text-center px-6">Organizando carpetas en Drive...</p>
            <p className="text-brand-lime text-xs animate-pulse uppercase tracking-widest">No cierres la aplicación</p>
        </div>
      )}

      {view !== 'login' && (
        <header className="bg-brand-panel border-b border-gray-700 p-4 sticky top-0 z-10 shadow-md">
          <div className="container mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView(userRole === 'admin' ? 'admin' : 'dashboard')}>
              <Logo className="h-8 w-auto" />
              <div>
                <h1 className="font-bold text-lg leading-tight text-white hidden sm:block">Control de Obras</h1>
                <div className="flex items-center gap-2">
                    <p className="text-[10px] text-brand-lime font-bold tracking-widest uppercase">{userRole === 'admin' ? 'ADMIN' : currentUser}</p>
                    <span className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border ${hasSyncedWithCloud ? 'text-green-400 bg-green-900/30 border-green-800' : 'text-yellow-400 bg-yellow-900/30 border-yellow-800'}`}>
                        <WifiIcon className="w-2.5 h-2.5" /> {hasSyncedWithCloud ? 'En Línea' : 'Offline'}
                    </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
                {userRole && (
                  <button 
                    onClick={() => setView('vacations')} 
                    className={`relative px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'vacations' ? 'bg-brand-teal text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                  >
                    🌴 Vacaciones
                    {userRole === 'admin' && pendingVacCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-brand-panel animate-bounce shadow-lg">
                        {pendingVacCount}
                      </span>
                    )}
                  </button>
                )}
                <button onClick={handleLogout} className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-red-400"><LogOutIcon className="w-6 h-6" /></button>
            </div>
          </div>
        </header>
      )}

      <main className={`container mx-auto p-4 ${view === 'admin' || view === 'vacations' ? 'max-w-6xl' : 'md:max-w-3xl'}`}>
        {view === 'login' && <UserLogin onLogin={handleLogin} technicians={data.technicians} adminPwd={data.adminPassword || 'admin'} onViewDailyOrg={() => setView('daily_org')} />}
        {view === 'dashboard' && <TechDashboard reports={data.reports.filter(r => r.technician === currentUser)} projects={data.projects} onNewReport={() => setView('form')} onEditReport={(r) => { setEditingReport(r); setView('form'); }} onViewDailyOrg={() => setView('daily_org')} onDeleteReport={deleteReport} />}
        {view === 'vacations' && <VacationManager role={userRole || 'tech'} currentUser={currentUser} currentUserId={currentUserId} data={data} onUpdate={(newData) => { isInternalUpdate.current = false; setData(newData); }} onBack={() => setView(userRole === 'admin' ? 'admin' : 'dashboard')} />}
        {view === 'daily_org' && <DailyOrganization isReadOnly={userRole !== 'admin'} data={data.dailyOrg} onUpdate={(newOrg) => { isInternalUpdate.current = false; setData(prev => ({...prev, dailyOrg: newOrg})); }} onBack={() => setView(userRole ? (userRole === 'admin' ? 'admin' : 'dashboard') : 'login')} />}
        {view === 'form' && <ReportForm projects={data.projects} vehicles={data.vehicles} initialData={editingReport} onSave={saveReport} onCancel={() => setView('dashboard')} />}
        {view === 'admin' && <AdminPanel data={data} setData={(updater) => { isSyncingRef.current = true; setData(updater); setTimeout(() => {isSyncingRef.current = false;}, 2000); }} onGoToVacations={() => setView('vacations')} onDeleteReport={deleteReport} />}
      </main>
    </div>
  );
};

export default App;
