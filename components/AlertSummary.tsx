'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaces } from '@/contexts/WorkspaceContext';
import { createClient } from '@/utils/supabase/client';
import { 
  Calendar, FileText, Pill, AlertTriangle, Clock, 
  CheckCircle2, Bell, Sparkles, ChevronRight 
} from 'lucide-react';

interface AlertSummaryProps {
  setActiveTab: (tab: 'appointments' | 'orders' | 'medications') => void;
}

interface AlertItem {
  id: string;
  category: 'appointment' | 'order' | 'medication';
  title: string;
  subtitle: string;
  severity: 'critical' | 'warning' | 'info';
  dateStr?: string;
  notes?: string | null;
}

export const AlertSummary: React.FC<AlertSummaryProps> = ({ setActiveTab }) => {
  const { user, isDemoMode } = useAuth();
  const { activeWorkspace } = useWorkspaces();
  const supabase = createClient();

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeWorkspace) return;

    const loadAlerts = async () => {
      setLoading(true);
      const computedAlerts: AlertItem[] = [];

      try {
        let appointmentsList: any[] = [];
        let ordersList: any[] = [];
        let medicationsList: any[] = [];

        // 1. FETCH DATA (Demo Mode vs Database Mode)
        if (isDemoMode) {
          const apptsSaved = localStorage.getItem('demo_appointments');
          appointmentsList = apptsSaved ? JSON.parse(apptsSaved) : [];
          appointmentsList = appointmentsList.filter(a => a.workspaceId === activeWorkspace.id);

          const ordersSaved = localStorage.getItem('demo_orders');
          ordersList = ordersSaved ? JSON.parse(ordersSaved) : [];
          ordersList = ordersList.filter(o => o.workspaceId === activeWorkspace.id);

          const medsSaved = localStorage.getItem('demo_medications');
          medicationsList = medsSaved ? JSON.parse(medsSaved) : [];
          medicationsList = medicationsList.filter(m => m.workspaceId === activeWorkspace.id);
        } else {
          // Appointments
          const { data: apptsData } = await supabase
            .from('appointments')
            .select('*')
            .eq('workspace_id', activeWorkspace.id)
            .eq('status', 'pending');
          appointmentsList = apptsData || [];

          // Orders
          const { data: ordersData } = await supabase
            .from('medical_orders')
            .select('*')
            .eq('workspace_id', activeWorkspace.id)
            .eq('status', 'pending');
          ordersList = ordersData || [];

          // Medications
          const { data: medsData } = await supabase
            .from('medications')
            .select('*')
            .eq('workspace_id', activeWorkspace.id)
            .eq('status', 'active');
          medicationsList = medsData || [];
        }

        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        // 2. PROCESS APPOINTMENTS (Citas Médicas)
        appointmentsList.forEach((appt: any) => {
          const apptDateStr = appt.dateTime || appt.date_time;
          if (!apptDateStr) return;
          
          const apptDate = new Date(apptDateStr);
          const diffTime = apptDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const docName = appt.doctorName || appt.doctor_name;
          const spec = appt.specialty;

          // Severity calculation
          if (diffDays < 0) {
            computedAlerts.push({
              id: `appt-alert-${appt.id}`,
              category: 'appointment',
              title: `Cita médica ATRASADA`,
              subtitle: `Con el Dr(a). ${docName} (Era el ${apptDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })})`,
              severity: 'critical',
              dateStr: 'Vencida',
              notes: appt.notes
            });
          } else if (diffDays >= 0 && diffDays <= 1) {
            computedAlerts.push({
              id: `appt-alert-${appt.id}`,
              category: 'appointment',
              title: `Cita médica MAÑANA`,
              subtitle: `Con el Dr(a). ${docName} (${spec})`,
              severity: 'critical',
              dateStr: apptDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) + ' hrs',
              notes: appt.notes
            });
          } else if (diffDays > 1 && diffDays <= 3) {
            computedAlerts.push({
              id: `appt-alert-${appt.id}`,
              category: 'appointment',
              title: `Cita médica próxima`,
              subtitle: `En ${diffDays} días con Dr(a). ${docName}`,
              severity: 'warning',
              dateStr: apptDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
              notes: appt.notes
            });
          }
        });

        // 3. PROCESS MEDICAL ORDERS (Órdenes y Exámenes)
        ordersList.forEach((order: any) => {
          const expDateStr = order.expirationDate || order.expiration_date;
          if (!expDateStr) return;

          const expDate = new Date(expDateStr + 'T12:00:00');
          const diffTime = expDate.getTime() - startOfToday.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const exam = order.examType || order.exam_type;

          if (diffDays < 0) {
            computedAlerts.push({
              id: `order-alert-${order.id}`,
              category: 'order',
              title: `Orden médica VENCIDA`,
              subtitle: `"${exam}" expiró hace ${Math.abs(diffDays)} días`,
              severity: 'critical',
              dateStr: expDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
              notes: order.notes
            });
          } else if (diffDays >= 0 && diffDays <= 4) {
            computedAlerts.push({
              id: `order-alert-${order.id}`,
              category: 'order',
              title: `Orden médica por vencer`,
              subtitle: `"${exam}" vence en ${diffDays} días`,
              severity: 'critical',
              dateStr: expDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
              notes: order.notes
            });
          } else if (diffDays > 4 && diffDays <= 10) {
            computedAlerts.push({
              id: `order-alert-${order.id}`,
              category: 'order',
              title: `Orden médica por realizar`,
              subtitle: `"${exam}" (Vence en ${diffDays} días)`,
              severity: 'warning',
              dateStr: expDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
              notes: order.notes
            });
          }
        });

        // 4. PROCESS MEDICATIONS (Tratamientos / Medicamentos)
        medicationsList.forEach((med: any) => {
          const medNameStr = med.name;
          const dosageStr = med.dosage;
          const freqStr = med.frequency;
          const endDateStr = med.endDate || med.end_date;

          if (endDateStr) {
            const endDate = new Date(endDateStr + 'T12:00:00');
            const diffTime = endDate.getTime() - startOfToday.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
              computedAlerts.push({
                id: `med-alert-${med.id}`,
                category: 'medication',
                title: `Tratamiento FINALIZADO`,
                subtitle: `El ciclo de "${medNameStr}" terminó`,
                severity: 'info',
                dateStr: 'Terminado',
                notes: med.notes
              });
            } else if (diffDays >= 0 && diffDays <= 3) {
              computedAlerts.push({
                id: `med-alert-${med.id}`,
                category: 'medication',
                title: `Últimas dosis de tratamiento`,
                subtitle: `"${medNameStr}" finaliza en ${diffDays} días`,
                severity: 'warning',
                dateStr: `Termina el ${endDate.getDate()}/${endDate.getMonth() + 1}`,
                notes: med.notes
              });
            }
          } else {
            // Tratamiento crónico/continuo sin fecha de término
            // Solo lo listamos como info si no hay alertas críticas/warnings para no saturar,
            // pero podemos listarlo de forma elegante.
          }
        });

        // Sort alerts: critical first, then warning, then info
        computedAlerts.sort((a, b) => {
          const severityWeight = { critical: 3, warning: 2, info: 1 };
          return severityWeight[b.severity] - severityWeight[a.severity];
        });

        setAlerts(computedAlerts);
      } catch (err) {
        console.error('Error computing health alerts:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAlerts();

    // Listen to tab updates or manual changes to reload alerts on dashboard
    const handleStorageChange = () => loadAlerts();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [activeWorkspace, isDemoMode]);

  const handleAlertClick = (category: AlertItem['category']) => {
    if (category === 'appointment') setActiveTab('appointments');
    else if (category === 'order') setActiveTab('orders');
    else if (category === 'medication') setActiveTab('medications');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/85 p-5 shadow-soft space-y-4">
      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Bell className="h-4 w-4 text-indigo-500 animate-swing" />
          Alertas Familiares {alerts.length > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-extrabold rounded-full">
              {alerts.length}
            </span>
          )}
        </h2>
        
        {alerts.length > 0 && (
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider animate-pulse">
            Requiere Atención
          </span>
        )}
      </div>

      {loading ? (
        <div className="py-6 text-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-2 text-[10px] text-slate-400">Analizando alertas de salud...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-emerald-50/50 border border-emerald-150 p-4 rounded-xl text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
          <h4 className="text-xs font-bold text-emerald-900">¡Todo al día!</h4>
          <p className="text-[10px] text-emerald-600 mt-1 leading-relaxed">
            No tienes citas próximas críticas ni recetas vencidas en el espacio de trabajo activo. ¡Sigue así!
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
          {alerts.map((alert) => {
            const isCritical = alert.severity === 'critical';
            const isWarning = alert.severity === 'warning';

            const severityClass = isCritical
              ? 'bg-rose-50/75 border-rose-150 text-rose-850 hover:bg-rose-100/60'
              : isWarning
              ? 'bg-amber-50/75 border-amber-150 text-amber-850 hover:bg-amber-100/60'
              : 'bg-indigo-50/65 border-indigo-100 text-indigo-850 hover:bg-indigo-50';

            const iconClass = isCritical
              ? 'text-rose-600 bg-rose-100'
              : isWarning
              ? 'text-amber-600 bg-amber-100'
              : 'text-indigo-600 bg-indigo-100';

            return (
              <div
                key={alert.id}
                onClick={() => handleAlertClick(alert.category)}
                className={`group flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 shadow-soft ${severityClass}`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${iconClass}`}>
                  {alert.category === 'appointment' && <Calendar className="h-3.5 w-3.5" />}
                  {alert.category === 'order' && <FileText className="h-3.5 w-3.5" />}
                  {alert.category === 'medication' && <Pill className="h-3.5 w-3.5" />}
                </div>

                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-extrabold leading-snug tracking-tight">
                      {alert.title}
                    </span>
                    {alert.dateStr && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                        isCritical ? 'bg-rose-100/80 text-rose-700' : isWarning ? 'bg-amber-100/80 text-amber-700' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {alert.dateStr}
                      </span>
                    )}
                  </div>
                  
                  <span className="block text-[10px] opacity-90 mt-0.5 leading-snug truncate">
                    {alert.subtitle}
                  </span>
                  
                  {alert.notes && (
                    <span className="block text-[9px] opacity-75 mt-1 leading-normal italic line-clamp-1 border-l-2 pl-1 border-current">
                      "{alert.notes}"
                    </span>
                  )}
                </div>

                <ChevronRight className="h-3.5 w-3.5 self-center opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-current shrink-0 ml-1" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
