
import React, { useState } from 'react';
import { TechUser } from '../App';
import { Logo } from './Logo';
import { CalendarIcon, PwaIcon, SunIcon, MoonIcon } from './icons';

interface LoginProps {
  onLogin: (role: 'admin' | 'tech', username?: string) => void;
  technicians: TechUser[];
  adminPwd?: string;
  onViewDailyOrg: () => void;
  toggleTheme: () => void;
  isDark: boolean;
  hasUnreadOrg?: boolean;
}

const UserLogin: React.FC<LoginProps> = ({ onLogin, technicians, adminPwd = 'admin', onViewDailyOrg, toggleTheme, isDark, hasUnreadOrg }) => {
  const [step, setStep] = useState<'role' | 'password' | 'tech-select'>('role');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'tech' | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [selectedTech, setSelectedTech] = useState<TechUser | null>(null);
  const [showPwaGuide, setShowPwaGuide] = useState(false);

  const handleRoleSelect = (role: 'admin' | 'tech') => {
    setSelectedRole(role);
    setStep(role === 'admin' ? 'password' : 'tech-select');
    setError('');
    setPassword('');
  };

  const handleTechSelect = (tech: TechUser) => {
    setSelectedTech(tech);
    setStep('password');
  };

  const verifyLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRole === 'admin') {
      if (password === adminPwd) {
        onLogin('admin');
      } else {
        setError('Contraseña incorrecta');
      }
    } else {
      if (selectedTech && password === selectedTech.password) {
        onLogin('tech', selectedTech.name);
      } else {
        setError('Contraseña incorrecta');
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] p-4 relative">
       {/* Theme Toggle on Login Screen */}
       <button 
        onClick={toggleTheme} 
        className="absolute top-4 right-4 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg text-gray-600 dark:text-yellow-400 hover:scale-110 transition-transform z-50 border border-gray-200 dark:border-gray-700"
      >
        {isDark ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
      </button>

      <div className="bg-white dark:bg-brand-panel p-8 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md relative overflow-hidden transition-colors duration-300 z-10">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-lime to-brand-teal"></div>
        
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <Logo className="h-20 w-auto" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white tracking-wide">ACCESO PLATAFORMA</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Gestión de Partes y Obras</p>
        </div>

        {step === 'role' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => handleRoleSelect('tech')}
                className="bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 p-6 rounded-xl flex flex-col items-center transition-all border border-gray-200 dark:border-gray-700 hover:border-brand-lime group shadow-sm"
              >
                <span className="text-4xl mb-3 transform group-hover:scale-110 transition-transform">👷</span>
                <span className="font-semibold text-gray-700 dark:text-gray-200 group-hover:text-brand-teal dark:group-hover:text-brand-lime">Técnico</span>
              </button>
              <button 
                onClick={() => handleRoleSelect('admin')}
                className="bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 p-6 rounded-xl flex flex-col items-center transition-all border border-gray-200 dark:border-gray-700 hover:border-brand-teal group shadow-sm"
              >
                <span className="text-4xl mb-3 transform group-hover:scale-110 transition-transform">👔</span>
                <span className="font-semibold text-gray-700 dark:text-gray-200 group-hover:text-brand-teal">Admin</span>
              </button>
            </div>
            
            <button 
                onClick={onViewDailyOrg}
                className="relative w-full bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800 p-4 rounded-xl flex items-center justify-center gap-3 transition-all border border-gray-200 dark:border-gray-700 hover:border-brand-teal dark:hover:border-brand-lime/50 group"
            >
                {hasUnreadOrg && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full border-2 border-white dark:border-brand-panel animate-pulse shadow-md"></span>
                )}
                <CalendarIcon className="w-6 h-6 text-brand-teal dark:text-brand-lime" />
                <span className="font-bold text-gray-600 dark:text-gray-300 group-hover:text-brand-teal dark:group-hover:text-white">📅 Ver Organización Diaria</span>
            </button>

            {/* PWA GUIDE CALLOUT */}
            <div className="pwa-hide mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
               <button 
                  onClick={() => setShowPwaGuide(!showPwaGuide)}
                  className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-brand-teal dark:hover:text-brand-lime transition-colors bg-gray-50 dark:bg-gray-900/30 p-3 rounded-lg border border-gray-200 dark:border-gray-800"
               >
                  <div className="flex items-center gap-2">
                    <PwaIcon className="w-4 h-4" />
                    <span>¿Cómo instalar en el móvil?</span>
                  </div>
                  <span>{showPwaGuide ? '✕' : '👁️'}</span>
               </button>

               {showPwaGuide && (
                 <div className="mt-3 text-[10px] space-y-3 text-gray-600 dark:text-gray-400 animate-fade-in bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
                    <div>
                      <p className="text-brand-teal dark:text-brand-lime font-bold uppercase mb-1">🤖 Android (Chrome):</p>
                      <p>Pulsa los <span className="text-gray-900 dark:text-white font-bold">3 puntos (⋮)</span> arriba a la derecha y elige <span className="text-gray-900 dark:text-white font-bold">"Instalar aplicación"</span>.</p>
                    </div>
                    <div>
                      <p className="text-brand-teal dark:text-brand-teal font-bold uppercase mb-1">🍎 iPhone (Safari):</p>
                      <p>Pulsa <span className="text-gray-900 dark:text-white font-bold">Compartir (↑)</span> abajo y elige <span className="text-gray-900 dark:text-white font-bold">"Añadir a pantalla de inicio"</span>.</p>
                    </div>
                 </div>
               )}
            </div>
          </div>
        )}

        {step === 'tech-select' && (
          <div>
            <label className="block text-sm font-medium text-brand-teal dark:text-brand-lime mb-3 uppercase tracking-wider">Selecciona tu perfil</label>
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
              {technicians.map(tech => (
                <button
                  key={tech.id}
                  onClick={() => handleTechSelect(tech)}
                  className="w-full text-left p-4 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-l-4 border-transparent hover:border-brand-teal dark:hover:border-brand-lime flex items-center justify-between group border border-gray-200 dark:border-transparent"
                >
                  <span className="font-medium text-gray-700 dark:text-gray-200">{tech.name}</span>
                  <span className="text-gray-400 group-hover:text-brand-teal dark:group-hover:text-white">➜</span>
                </button>
              ))}
              {technicians.length === 0 && <p className="text-center py-4 text-gray-500 text-xs italic">No hay técnicos registrados</p>}
            </div>
            <button onClick={() => setStep('role')} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-white w-full text-center py-2">← Volver</button>
          </div>
        )}

        {step === 'password' && (
          <form onSubmit={verifyLogin} className="space-y-6">
             <div className="text-center">
               <span className="text-xs text-gray-500 uppercase tracking-widest">Iniciando sesión como</span>
               <div className="text-lg font-bold text-brand-teal dark:text-brand-lime mt-1">
                 {selectedRole === 'admin' ? 'Administrador' : selectedTech?.name}
               </div>
             </div>
            <div>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none text-center tracking-widest text-lg placeholder-gray-400 dark:placeholder-gray-600 transition-colors"
                  placeholder="CONTRASEÑA"
                  autoFocus
                />
              </div>
            </div>
            {error && <p className="text-red-500 dark:text-red-400 text-sm text-center bg-red-100 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-900/50">{error}</p>}
            <button
              type="submit"
              className="w-full bg-brand-teal hover:bg-teal-700 text-white font-bold py-4 rounded-lg transition-colors shadow-lg shadow-brand-teal/20"
            >
              ENTRAR
            </button>
            <button type="button" onClick={() => setStep('role')} className="w-full text-sm text-gray-500 hover:text-gray-800 dark:hover:text-white text-center">
              Cancelar
            </button>
          </form>
        )}
        
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
           <p className="text-[10px] text-gray-500 dark:text-gray-600 uppercase tracking-[2px]">JDG Teleco v3.6 Cloud</p>
        </div>
      </div>
    </div>
  );
};

export default UserLogin;
