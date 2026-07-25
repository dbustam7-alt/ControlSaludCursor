'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaces } from '@/contexts/WorkspaceContext';
import { createClient } from '@/utils/supabase/client';
import { Calendar, Clock, MapPin, Search, Plus, Trash2, CheckCircle, Clock3, AlertCircle, X, MessageSquare } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

export interface Appointment {
  id: string;
  workspaceId: string;
  doctorName: string;
  specialty: string;
  location: string | null;
  dateTime: string;
  status: 'pending' | 'completed';
  notes: string | null;
}

const DEFAULT_MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: 'appt-1',
    workspaceId: 'family-workspace-id',
    doctorName: 'Dr. Humberto Martínez',
    specialty: 'Cardiología',
    location: 'Clínica Las Condes, Consultorio 402',
    dateTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days in the future
    status: 'pending',
    notes: 'Llevar los últimos exámenes de sangre y el electrocardiograma anterior.',
  },
  {
    id: 'appt-2',
    workspaceId: 'family-workspace-id',
    doctorName: 'Dra. María Elisa Gómez',
    specialty: 'Geriatría',
    location: 'Hospital Clínico UC, Piso 5',
    dateTime: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(), // 4 days in past
    status: 'completed',
    notes: 'Control de rutina mensual. Recetó aumento de dosis de Enalapril.',
  },
  {
    id: 'appt-3',
    workspaceId: 'personal-workspace-id',
    doctorName: 'Dr. Carlos Soler',
    specialty: 'Dermatología',
    location: 'Centro Médico San Joaquín',
    dateTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(), // 10 days in future
    status: 'pending',
    notes: 'Revisión de lunares en la espalda.',
  }
];

export const AppointmentModule: React.FC = () => {
  const { user, isDemoMode } = useAuth();
  const { activeWorkspace } = useWorkspaces();
  const supabase = createClient();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  
  // New Appointment Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Deletion Confirmation State
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Fetch appointments
  useEffect(() => {
    if (!activeWorkspace) return;

    if (isDemoMode) {
      const saved = localStorage.getItem('demo_appointments');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Appointment[];
          setAppointments(parsed.filter(a => a.workspaceId === activeWorkspace.id));
        } catch (e) {
          console.error(e);
        }
      } else {
        localStorage.setItem('demo_appointments', JSON.stringify(DEFAULT_MOCK_APPOINTMENTS));
        setAppointments(DEFAULT_MOCK_APPOINTMENTS.filter(a => a.workspaceId === activeWorkspace.id));
      }
      setLoading(false);
      return;
    }

    const fetchAppointments = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
          .order('date_time', { ascending: true });

        if (error) throw error;

        const mapped: Appointment[] = (data || []).map((appt: any) => ({
          id: appt.id,
          workspaceId: appt.workspace_id,
          doctorName: appt.doctor_name,
          specialty: appt.specialty,
          location: appt.location,
          dateTime: appt.date_time,
          status: appt.status,
          notes: appt.notes,
        }));

        setAppointments(mapped);
      } catch (err) {
        console.error('Error fetching appointments:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [activeWorkspace, isDemoMode]);

  const saveAppointmentsState = (updatedList: Appointment[]) => {
    if (isDemoMode) {
      const saved = localStorage.getItem('demo_appointments');
      let fullList: Appointment[] = [];
      if (saved) {
        try {
          fullList = JSON.parse(saved) as Appointment[];
        } catch (e) {
          fullList = DEFAULT_MOCK_APPOINTMENTS;
        }
      }
      // Replace only the ones belonging to other workspaces, and append the updated ones for this workspace
      const otherWorkspaces = fullList.filter(a => a.workspaceId !== activeWorkspace?.id);
      const merged = [...otherWorkspaces, ...updatedList];
      localStorage.setItem('demo_appointments', JSON.stringify(merged));
    }
    setAppointments(updatedList);
  };

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorName.trim() || !specialty.trim() || !date || !time || !activeWorkspace) return;

    const dateTimeStr = new Date(`${date}T${time}`).toISOString();
    setFormError(null);

    if (isDemoMode) {
      const newAppt: Appointment = {
        id: `appt-demo-${Date.now()}`,
        workspaceId: activeWorkspace.id,
        doctorName,
        specialty,
        location: location.trim() || null,
        dateTime: dateTimeStr,
        status: 'pending',
        notes: notes.trim() || null,
      };
      
      const updated = [newAppt, ...appointments].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
      saveAppointmentsState(updated);
      resetForm();
      setIsFormOpen(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('appointments')
        .insert({
          workspace_id: activeWorkspace.id,
          doctor_name: doctorName,
          specialty,
          location: location.trim() || null,
          date_time: dateTimeStr,
          status: 'pending',
          notes: notes.trim() || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      const newAppt: Appointment = {
        id: data.id,
        workspaceId: data.workspace_id,
        doctorName: data.doctor_name,
        specialty: data.specialty,
        location: data.location,
        dateTime: data.date_time,
        status: data.status,
        notes: data.notes,
      };

      const updated = [newAppt, ...appointments].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
      setAppointments(updated);
      resetForm();
      setIsFormOpen(false);
    } catch (err: any) {
      console.error('Error creating appointment:', err);
      setFormError(err.message || 'Error al guardar la cita.');
    }
  };

  const handleToggleStatus = async (appt: Appointment) => {
    const newStatus: 'pending' | 'completed' = appt.status === 'pending' ? 'completed' : 'pending';

    if (isDemoMode) {
      const updated = appointments.map(a => a.id === appt.id ? { ...a, status: newStatus } : a);
      saveAppointmentsState(updated);
      return;
    }

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appt.id);

      if (error) throw error;

      setAppointments(appointments.map(a => a.id === appt.id ? { ...a, status: newStatus } : a));
    } catch (err) {
      console.error('Error toggling appointment status:', err);
    }
  };

  const handleDeleteAppointment = async () => {
    if (!deleteTargetId) return;

    if (isDemoMode) {
      const updated = appointments.filter(a => a.id !== deleteTargetId);
      saveAppointmentsState(updated);
      setDeleteTargetId(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', deleteTargetId);

      if (error) throw error;

      setAppointments(appointments.filter(a => a.id !== deleteTargetId));
      setDeleteTargetId(null);
    } catch (err) {
      console.error('Error deleting appointment:', err);
    }
  };

  const resetForm = () => {
    setDoctorName('');
    setSpecialty('');
    setLocation('');
    setDate('');
    setTime('');
    setNotes('');
    setFormError(null);
  };

  const filteredAppointments = appointments.filter(appt => {
    const matchesSearch = 
      appt.doctorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appt.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (appt.notes && appt.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = 
      statusFilter === 'all' || 
      appt.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const formatDate = (isoStr: string) => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    return new Date(isoStr).toLocaleDateString('es-ES', options);
  };

  const formatTime = (isoStr: string) => {
    return new Date(isoStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <div className="space-y-6">
      {/* Action and search bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por doctor, especialidad o notas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Status Filter */}
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm shrink-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === 'pending' ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Pendientes
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Asistidas
            </button>
          </div>

          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-indigo-soft transition-colors w-full sm:w-auto shrink-0"
          >
            <Plus className="h-4 w-4" />
            Nueva Cita
          </button>
        </div>
      </div>

      {/* Main Listing Area */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-4 text-sm text-slate-500">Cargando citas médicas...</p>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center max-w-lg mx-auto shadow-sm">
          <div className="p-4 bg-slate-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <Calendar className="h-8 w-8 text-slate-400" />
          </div>
          <h4 className="text-base font-bold text-slate-900">No se encontraron citas</h4>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            {searchTerm || statusFilter !== 'all'
              ? 'No hay citas registradas que coincidan con los filtros aplicados.'
              : 'Empieza registrando las próximas citas médicas de tu familia para tener una mejor coordinación y recordatorios.'}
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <button
              onClick={() => setIsFormOpen(true)}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition-colors"
            >
              <Plus className="h-4 w-4" />
              Registrar Primera Cita
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAppointments.map((appt) => {
            const isPending = appt.status === 'pending';
            const apptDate = new Date(appt.dateTime);
            const isOverdue = isPending && apptDate.getTime() < Date.now();

            return (
              <div
                key={appt.id}
                className="bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 shadow-soft p-5 flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-full text-xs font-bold uppercase tracking-wider">
                      {appt.specialty}
                    </span>

                    {isPending ? (
                      isOverdue ? (
                        <span className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-semibold">
                          <AlertCircle className="h-3 w-3" />
                          Atrasada
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
                          <Clock3 className="h-3 w-3" />
                          Próxima
                        </span>
                      )
                    ) : (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
                        <CheckCircle className="h-3 w-3" />
                        Asistida
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-2 truncate">
                    {appt.doctorName}
                  </h3>

                  <div className="space-y-2.5 text-sm text-slate-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="capitalize">{formatDate(appt.dateTime)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>{formatTime(appt.dateTime)} hrs</span>
                    </div>
                    {appt.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="truncate">{appt.location}</span>
                      </div>
                    )}
                    {appt.notes && (
                      <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-600 leading-relaxed italic">
                          "{appt.notes}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3.5 flex items-center justify-between gap-2 mt-2">
                  <button
                    onClick={() => handleToggleStatus(appt)}
                    className={`text-xs font-bold px-3 py-2 rounded-xl border transition-colors ${
                      isPending
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {isPending ? 'Marcar como Asistida' : 'Marcar como Pendiente'}
                  </button>

                  <button
                    onClick={() => setDeleteTargetId(appt.id)}
                    className="text-slate-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                    title="Eliminar cita"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* NEW APPOINTMENT FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
          <form
            onSubmit={handleAddAppointment}
            className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-soft border border-slate-100 z-10 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Registrar Nueva Cita Médica</h3>
              <button type="button" onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre del Doctor(a)</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Dr. Humberto Martínez"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Especialidad</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cardiología, Pediatría"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hora</label>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Lugar / Ubicación (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Clínica Las Condes, Box 402"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notas / Preparaciones (Opcional)</label>
                <textarea
                  rows={3}
                  placeholder="Ej. Llevar exámenes anteriores, ir en ayunas de 8 horas."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors"
              >
                Guardar Cita
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CONFIRM DELETION MODAL */}
      <ConfirmModal
        isOpen={deleteTargetId !== null}
        title="¿Eliminar cita médica?"
        message="¿Estás seguro de que deseas eliminar esta cita médica? Esta acción es irreversible y tu grupo familiar perderá acceso a la información de esta cita."
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={handleDeleteAppointment}
        onCancel={() => setDeleteTargetId(null)}
        variant="danger"
      />
    </div>
  );
};
