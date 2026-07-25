'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaces } from '@/contexts/WorkspaceContext';
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher';
import { AppointmentModule } from '@/components/AppointmentModule';
import { OrderModule } from '@/components/OrderModule';
import { MedicationModule } from '@/components/MedicationModule';
import { AiDocumentScanner } from '@/components/AiDocumentScanner';
import { 
  HeartPulse, Sparkles, Calendar, FileText, Pill, LogOut, ShieldAlert,
  Clock, AlertCircle, CheckCircle2, User, HelpCircle, Mail, AlertTriangle, Play, Users
} from 'lucide-react';

export default function Home() {
  const { user, loading, isDemoMode, signInWithEmail, signInWithGoogle, signOut, enableDemoMode } = useAuth();
  const { activeWorkspace, loading: workspacesLoading } = useWorkspaces();

  // Tab State
  const [activeTab, setActiveTab] = useState<'appointments' | 'orders' | 'medications'>('appointments');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSent, setAuthSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setAuthLoading(true);
    setAuthError(null);
    const res = await signInWithEmail(emailInput);
    setAuthLoading(false);

    if (res.success) {
      setAuthSent(true);
    } else {
      setAuthError(res.error || 'Ocurrió un error al enviar el enlace.');
    }
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
    const res = await signInWithGoogle();
    setAuthLoading(false);
    if (res.error) {
      setAuthError(res.error);
    }
  };

  const handleScannerSaveSuccess = (type: 'appointment' | 'order' | 'medication') => {
    // Switch to the relevant tab of the saved item
    if (type === 'appointment') setActiveTab('appointments');
    else if (type === 'order') setActiveTab('orders');
    else if (type === 'medication') setActiveTab('medications');
    
    // Refresh page states or let children re-trigger fetch
    window.location.reload();
  };

  if (loading || (user && workspacesLoading)) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="p-4 bg-white rounded-2xl shadow-soft border border-slate-100 flex flex-col items-center gap-4 max-w-xs w-full text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-10 w-16 border-b-2 border-indigo-600" />
            <HeartPulse className="h-6 w-6 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Cargando tu Portal de Salud...</p>
            <p className="text-xs text-slate-500 mt-1">Espera un momento, por favor.</p>
          </div>
        </div>
      </div>
    );
  }

  // LOGIN PAGE (If not logged in and not in Demo Mode)
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/60 p-8 shadow-soft flex flex-col text-center">
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-indigo-soft">
              <HeartPulse className="h-7 w-7" />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold text-slate-900 leading-none">ControlSalud</h1>
              <p className="text-xs text-slate-500 mt-1">Gestión y Control Médico Familiar</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2">Ingresa a tu cuenta</h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Coordina recetas, citas y exámenes médicos con tus hermanos, padres o cuidadores en un solo espacio compartido.
          </p>

          {authError && (
            <div className="mb-4 text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200 text-left flex items-start gap-2">
              <AlertCircle className="h-4.5 w-4.5 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {authSent ? (
            <div className="mb-6 p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 text-left">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="font-bold text-sm">Enlace enviado</span>
              </div>
              <p className="text-xs text-emerald-600 leading-relaxed">
                Hemos enviado un enlace de acceso mágico a <strong>{emailInput}</strong>. Revísalo e ingresa directamente haciendo clic en el botón.
              </p>
              <button 
                onClick={() => setAuthSent(false)} 
                className="mt-4 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                Volver a ingresar correo
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="nombre@correo.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-sm font-semibold text-white rounded-xl shadow-indigo-soft transition-colors"
              >
                {authLoading ? 'Enviando enlace...' : 'Enviar Enlace de Acceso'}
              </button>
            </form>
          )}

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center text-xs font-bold text-slate-400 uppercase"><span className="bg-white px-3">O ingresa con</span></div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={authLoading}
            className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-sm font-semibold text-slate-700 rounded-xl flex items-center justify-center gap-2 transition-colors mb-4 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.66l3.15-3.15C17.45 1.81 14.94 1 12 1 7.35 1 3.39 3.65 1.5 7.42l3.78 2.93c.89-2.67 3.4-4.31 6.72-4.31z" />
              <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.47h6.46c-.28 1.48-1.12 2.74-2.38 3.58l3.7 2.87c2.16-2 3.41-4.94 3.41-8.56z" />
              <path fill="#FBBC05" d="M5.28 14.65c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18L1.5 7.36C.54 9.25 0 11.56 0 13.92s.54 4.67 1.5 6.56l3.78-2.93-1-.9z" />
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.7-2.87c-1.03.69-2.35 1.11-4.26 1.11-3.32 0-5.83-2.14-6.72-4.81l-3.78 2.93C3.39 20.35 7.35 23 12 23z" />
            </svg>
            Ingresar con Google
          </button>

          <button
            onClick={enableDemoMode}
            className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 border border-emerald-200 transition-colors"
          >
            <Play className="h-4 w-4 shrink-0" fill="currentColor" />
            Ingresar en Modo Demo (Probar Gratis)
          </button>

          <p className="mt-6 text-[11px] text-slate-400">
            Al ingresar aceptas nuestras políticas de privacidad y uso confidencial de datos de salud de acuerdo a normativas locales.
          </p>
        </div>
      </div>
    );
  }

  // DASHBOARD MAIN PAGE
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* GLOBAL NAVBAR HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-indigo-soft shrink-0">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div className="hidden sm:block">
              <span className="block text-sm font-bold text-slate-900 leading-none">ControlSalud</span>
              <span className="block text-[10px] text-slate-500 mt-0.5 font-medium">Gestión Familiar</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {isDemoMode && (
              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold uppercase tracking-wider hidden md:inline">
                Modo Demo
              </span>
            )}

            {/* Workspace switcher and management */}
            <WorkspaceSwitcher />

            {/* Gemini AI Scanner Button */}
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-indigo-soft transition-all"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Escanear con IA</span>
              <span className="sm:hidden">IA</span>
            </button>

            {/* Logout user info */}
            <div className="flex items-center pl-2 border-l border-slate-200 gap-2">
              <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs" title={user.email}>
                {user.displayName.substring(0, 2).toUpperCase()}
              </div>
              <button
                onClick={signOut}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-900 transition-colors"
                title="Cerrar Sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* DASHBOARD CONTENT BODY */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          
          {/* LEFT COLUMN: ACTIVE WORKSPACE INFO & ALERT SUMMARY */}
          <section className="space-y-4 lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-soft">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Grupo Familiar Activo
              </h2>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold rounded-xl flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {activeWorkspace ? activeWorkspace.name : 'Espacio'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeWorkspace?.type === 'personal' ? 'Uso Personal' : 'Espacio Colaborativo'}
                  </p>
                </div>
              </div>
            </div>

            {/* ADHERENCE ALERT SUMMARY */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-soft space-y-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Resumen de Alertas
              </h2>
              
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-150">
                  <Calendar className="h-5 w-5 text-amber-700 shrink-0" />
                  <div className="text-xs">
                    <span className="block font-bold text-amber-800">Próximas Citas</span>
                    <span className="block text-amber-600 mt-0.5 font-medium">Controles médicos al día.</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-rose-50/50 rounded-xl border border-rose-150">
                  <FileText className="h-5 w-5 text-rose-700 shrink-0" />
                  <div className="text-xs">
                    <span className="block font-bold text-rose-800">Órdenes Médicas</span>
                    <span className="block text-rose-600 mt-0.5 font-medium">1 examen vence esta semana.</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-150">
                  <Pill className="h-5 w-5 text-indigo-700 shrink-0" />
                  <div className="text-xs">
                    <span className="block font-bold text-indigo-800">Medicamentos</span>
                    <span className="block text-indigo-600 mt-0.5 font-medium">Atorvastatina requiere reposición.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* DEMO MODE EXPLAINER */}
            {isDemoMode && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 shadow-sm text-left">
                <h4 className="text-xs font-bold text-amber-800 flex items-center gap-1">
                  <AlertTriangle className="h-4.5 w-4.5" />
                  Modo Demo de Prueba
                </h4>
                <p className="text-[11px] text-amber-700 mt-1.5 leading-relaxed">
                  Estás probando la plataforma sin sincronizar con la base de datos remota de Supabase. Los datos que agregues se guardarán localmente.
                </p>
                <p className="text-[11px] text-amber-700 mt-1 font-semibold">
                  ¡Puedes probar el escáner IA de recetas de inmediato!
                </p>
              </div>
            )}
          </section>

          {/* RIGHT COLUMN: INTERACTIVE TABS & MODULE LAYOUT */}
          <section className="space-y-6 lg:col-span-3">
            {/* Horizontal Module Tabs */}
            <div className="flex border-b border-slate-200 gap-1.5 scrollbar-thin overflow-x-auto pb-px">
              <button
                onClick={() => setActiveTab('appointments')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all shrink-0 ${
                  activeTab === 'appointments'
                    ? 'border-indigo-600 text-indigo-700 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Calendar className="h-4.5 w-4.5" />
                Citas Médicas
              </button>
              
              <button
                onClick={() => setActiveTab('orders')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all shrink-0 ${
                  activeTab === 'orders'
                    ? 'border-indigo-600 text-indigo-700 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <FileText className="h-4.5 w-4.5" />
                Órdenes y Exámenes
              </button>
              
              <button
                onClick={() => setActiveTab('medications')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all shrink-0 ${
                  activeTab === 'medications'
                    ? 'border-indigo-600 text-indigo-700 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Pill className="h-4.5 w-4.5" />
                Tratamientos y Stock
              </button>
            </div>

            {/* ACTIVE MODULE CONTAINER */}
            <div className="bg-slate-50 min-h-[400px]">
              {activeTab === 'appointments' && <AppointmentModule />}
              {activeTab === 'orders' && <OrderModule />}
              {activeTab === 'medications' && <MedicationModule />}
            </div>
          </section>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 ControlSalud. Desarrollado de forma segura con Next.js, Supabase, Vercel, y Google Gemini AI.</p>
        </div>
      </footer>

      {/* GLOBAL SCANNER MODAL */}
      <AiDocumentScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSaveSuccess={handleScannerSaveSuccess}
      />
    </div>
  );
}
