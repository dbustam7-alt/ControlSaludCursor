'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaces } from '@/contexts/WorkspaceContext';
import { createClient } from '@/utils/supabase/client';
import { Search, Plus, Trash2, X, Pill, Calendar, Clock, MessageSquare, Edit2, Play, Pause, FileText, Check } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { usePatients } from '@/contexts/PatientContext';

export interface Medication {
  id: string;
  workspaceId: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate: string | null;
  status: 'active' | 'paused' | 'completed';
  notes: string | null;
  attachmentUrl: string | null;
  fileHash?: string | null;
  patientId?: string | null;
}

const MOCK_MEDICATIONS: Medication[] = [
  {
    id: 'med-1',
    workspaceId: 'family-workspace-id',
    name: 'Metformina 850mg',
    dosage: '1 tableta',
    frequency: 'Con el almuerzo y cena (Cada 12 horas)',
    startDate: '2026-01-01',
    endDate: null,
    status: 'active',
    notes: 'Tratamiento de diabetes tipo 2. Tomar con abundante agua.',
    attachmentUrl: null,
  },
  {
    id: 'med-2',
    workspaceId: 'family-workspace-id',
    name: 'Enalapril 10mg',
    dosage: '1/2 tableta',
    frequency: 'En ayunas (Cada 24 horas)',
    startDate: '2026-01-15',
    endDate: null,
    status: 'active',
    notes: 'Control de presión arterial. Monitorear si hay tos seca continua.',
    attachmentUrl: null,
  },
  {
    id: 'med-3',
    workspaceId: 'family-workspace-id',
    name: 'Amoxicilina 500mg',
    dosage: '1 cápsula',
    frequency: 'Cada 8 horas',
    startDate: '2026-04-10',
    endDate: '2026-04-17',
    status: 'completed',
    notes: 'Antibiótico para la infección dental. Completar los 7 días estrictamente.',
    attachmentUrl: null,
  }
];

export const MedicationModule: React.FC = () => {
  const { user, isDemoMode } = useAuth();
  const { activeWorkspace } = useWorkspaces();
  const { filterPatientId, patients } = usePatients();
  const supabase = createClient();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'completed'>('all');

  // New Medication Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Deletion Confirmation State
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Fetch medications
  useEffect(() => {
    if (!activeWorkspace) return;

    if (isDemoMode) {
      const saved = localStorage.getItem('demo_medications');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Medication[];
          setMedications(parsed.filter(m => m.workspaceId === activeWorkspace.id));
        } catch (e) {
          console.error(e);
        }
      } else {
        localStorage.setItem('demo_medications', JSON.stringify(MOCK_MEDICATIONS));
        setMedications(MOCK_MEDICATIONS.filter(m => m.workspaceId === activeWorkspace.id));
      }
      setLoading(false);
      return;
    }

    const fetchMedications = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('medications')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
          .order('name', { ascending: true });

        if (error) throw error;

        const mapped: Medication[] = (data || []).map((m: any) => ({
          id: m.id,
          workspaceId: m.workspace_id,
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          startDate: m.start_date,
          endDate: m.end_date,
          status: m.status,
          notes: m.notes,
          attachmentUrl: m.attachment_url,
          fileHash: m.file_hash,
          patientId: m.patient_id,
        }));

        setMedications(mapped);
      } catch (err) {
        console.error('Error fetching medications:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMedications();
  }, [activeWorkspace, isDemoMode]);

  const saveMedicationsState = (updatedList: Medication[]) => {
    if (isDemoMode) {
      const saved = localStorage.getItem('demo_medications');
      let fullList: Medication[] = [];
      if (saved) {
        try {
          fullList = JSON.parse(saved) as Medication[];
        } catch (e) {
          fullList = MOCK_MEDICATIONS;
        }
      }
      const otherWorkspaces = fullList.filter(m => m.workspaceId !== activeWorkspace?.id);
      const merged = [...otherWorkspaces, ...updatedList];
      localStorage.setItem('demo_medications', JSON.stringify(merged));
    }
    setMedications(updatedList);
  };

  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dosage.trim() || !frequency.trim() || !startDate || !activeWorkspace) return;

    setFormError(null);

    // Check for duplicate name + dosage (mismo paciente)
    const isDuplicate = medications.some(m => 
      m.name.toLowerCase().trim() === name.toLowerCase().trim() &&
      m.dosage.toLowerCase().trim() === dosage.toLowerCase().trim() &&
      (m.patientId || null) === (filterPatientId || null)
    );

    if (isDuplicate) {
      setFormError(`El medicamento "${name}" con la dosis "${dosage}" ya se encuentra registrado en este espacio de trabajo.`);
      return;
    }

    const endStr = endDate ? endDate : null;

    if (isDemoMode) {
      const newMed: Medication = {
        id: `med-demo-${Date.now()}`,
        workspaceId: activeWorkspace.id,
        name,
        dosage,
        frequency,
        startDate,
        endDate: endStr,
        status: 'active',
        notes: notes.trim() || null,
        attachmentUrl: attachmentUrl.trim() || null,
        patientId: filterPatientId,
      };

      const updated = [newMed, ...medications];
      saveMedicationsState(updated);
      resetForm();
      setIsFormOpen(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('medications')
        .insert({
          workspace_id: activeWorkspace.id,
          name,
          dosage,
          frequency,
          start_date: startDate,
          end_date: endStr,
          status: 'active',
          notes: notes.trim() || null,
          attachment_url: attachmentUrl.trim() || null,
          patient_id: filterPatientId,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      const newMed: Medication = {
        id: data.id,
        workspaceId: data.workspace_id,
        name: data.name,
        dosage: data.dosage,
        frequency: data.frequency,
        startDate: data.start_date,
        endDate: data.end_date,
        status: data.status,
        notes: data.notes,
        attachmentUrl: data.attachment_url,
        patientId: data.patient_id,
      };

      setMedications([newMed, ...medications]);
      resetForm();
      setIsFormOpen(false);
    } catch (err: any) {
      console.error('Error creating medication:', err);
      setFormError(err.message || 'Error al guardar el medicamento.');
    }
  };

  const handleToggleStatus = async (med: Medication, forceStatus?: Medication['status']) => {
    let newStatus: Medication['status'] = 'active';
    
    if (forceStatus) {
      newStatus = forceStatus;
    } else {
      if (med.status === 'active') {
        newStatus = 'paused';
      } else if (med.status === 'paused') {
        newStatus = 'active';
      } else if (med.status === 'completed') {
        newStatus = 'active';
      }
    }

    if (isDemoMode) {
      const updated = medications.map(m => m.id === med.id ? { ...m, status: newStatus } : m);
      saveMedicationsState(updated);
      return;
    }

    try {
      const { error } = await supabase
        .from('medications')
        .update({ status: newStatus })
        .eq('id', med.id);

      if (error) throw error;

      setMedications(medications.map(m => m.id === med.id ? { ...m, status: newStatus } : m));
    } catch (err) {
      console.error('Error toggling medication status:', err);
    }
  };

  const handleDeleteMedication = async () => {
    if (!deleteTargetId) return;

    if (isDemoMode) {
      const updated = medications.filter(m => m.id !== deleteTargetId);
      saveMedicationsState(updated);
      setDeleteTargetId(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('medications')
        .delete()
        .eq('id', deleteTargetId);

      if (error) throw error;

      setMedications(medications.filter(m => m.id !== deleteTargetId));
      setDeleteTargetId(null);
    } catch (err) {
      console.error('Error deleting medication:', err);
    }
  };

  const handleDownloadAttachment = async (path: string) => {
    if (path.startsWith('http') || path.startsWith('blob:')) {
      window.open(path, '_blank');
      return;
    }

    if (isDemoMode) {
      alert('Las visualizaciones de documentos reales no están disponibles en Modo Demo.');
      return;
    }
    
    try {
      // Generar una URL firmada de 5 minutos
      const { data, error } = await supabase
        .storage
        .from('medical-documents')
        .createSignedUrl(path, 300);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      console.error('Error generating signed URL:', err);
      alert('No se pudo acceder al documento. Asegúrate de tener permisos suficientes.');
    }
  };

  const resetForm = () => {
    setName('');
    setDosage('');
    setFrequency('');
    setStartDate('');
    setEndDate('');
    setNotes('');
    setAttachmentUrl('');
    setFormError(null);
  };

  const filteredMedications = medications.filter(med => {
    const matchesSearch = 
      med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (med.notes && med.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = 
      statusFilter === 'all' || 
      med.status === statusFilter;

    const matchesPatient =
      filterPatientId === null ||
      med.patientId === filterPatientId;

    return matchesSearch && matchesStatus && matchesPatient;
  });

  const getPatientName = (patientId?: string | null) => {
    if (!patientId) return null;
    return patients.find((p) => p.id === patientId)?.fullName || null;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    const dateObj = new Date(dateStr + 'T12:00:00');
    return dateObj.toLocaleDateString('es-ES', options);
  };

  return (
    <div className="space-y-6">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar medicamentos o principios activos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Status filters */}
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
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === 'active' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Activos
            </button>
            <button
              onClick={() => setStatusFilter('paused')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === 'paused' ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Pausados
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === 'completed' ? 'bg-slate-50 text-slate-700' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Terminados
            </button>
          </div>

          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-indigo-soft transition-colors w-full sm:w-auto shrink-0"
          >
            <Plus className="h-4 w-4" />
            Nuevo Medicamento
          </button>
        </div>
      </div>

      {/* Main Listing Area */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-4 text-sm text-slate-500">Cargando medicamentos...</p>
        </div>
      ) : filteredMedications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center max-w-lg mx-auto shadow-sm">
          <div className="p-4 bg-slate-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <Pill className="h-8 w-8 text-slate-400" />
          </div>
          <h4 className="text-base font-bold text-slate-900">No se encontraron medicamentos</h4>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            {searchTerm || statusFilter !== 'all'
              ? 'No hay medicamentos registrados que coincidan con los filtros aplicados.'
              : 'Registra los tratamientos de tu familia, configura sus dosis, horarios e indicaciones para coordinar su cuidado.'}
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <button
              onClick={() => setIsFormOpen(true)}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition-colors"
            >
              <Plus className="h-4 w-4" />
              Registrar Primer Medicamento
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMedications.map((med) => {
            const isActive = med.status === 'active';
            const isPaused = med.status === 'paused';
            const isCompleted = med.status === 'completed';

            return (
              <div
                key={med.id}
                className="bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 shadow-soft p-5 flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-150 rounded-full text-xs font-semibold">
                      <Pill className="h-3.5 w-3.5" />
                      {med.dosage}
                    </span>

                    {/* Status badge */}
                    {isCompleted ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full text-xs font-semibold">
                        Terminado
                      </span>
                    ) : isPaused ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
                        <Pause className="h-3 w-3 shrink-0" />
                        Pausado
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
                        <Play className="h-3 w-3 shrink-0" fill="currentColor" />
                        Activo
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-1 truncate">
                    {med.name}
                  </h3>
                  {getPatientName(med.patientId) && (
                    <p className="text-xs font-semibold text-indigo-600 mb-1">
                      Paciente: {getPatientName(med.patientId)}
                    </p>
                  )}
                  <p className="text-sm font-semibold text-indigo-600 flex items-center gap-1.5 mb-4">
                    <Clock className="h-4 w-4 shrink-0" />
                    {med.frequency}
                  </p>

                  <div className="space-y-2 text-sm text-slate-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Inicio: <strong>{formatDate(med.startDate)}</strong></span>
                    </div>
                    {med.endDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                        <span>Término: <strong>{formatDate(med.endDate)}</strong></span>
                      </div>
                    )}

                    {med.attachmentUrl && (
                      <div className="flex items-center gap-2 pt-1">
                        <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                        <button
                          onClick={() => handleDownloadAttachment(med.attachmentUrl!)}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline font-bold text-xs"
                        >
                          Ver receta original digitalizada
                        </button>
                      </div>
                    )}

                    {med.notes && (
                      <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-600 leading-relaxed italic">
                          "{med.notes}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3.5 flex items-center justify-between gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <button
                        onClick={() => handleToggleStatus(med, 'paused')}
                        className="text-xs font-bold px-3 py-2 rounded-xl border bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 transition-colors"
                      >
                        Pausar
                      </button>
                    ) : isPaused ? (
                      <button
                        onClick={() => handleToggleStatus(med, 'active')}
                        className="text-xs font-bold px-3 py-2 rounded-xl border bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 transition-colors"
                      >
                        Reanudar
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleStatus(med, 'active')}
                        className="text-xs font-bold px-3 py-2 rounded-xl border bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 transition-colors"
                      >
                        Habilitar
                      </button>
                    )}

                    {!isCompleted && (
                      <button
                        onClick={() => handleToggleStatus(med, 'completed')}
                        className="text-xs font-bold px-3 py-2 rounded-xl border bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 transition-colors"
                      >
                        Terminar Tratamiento
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setDeleteTargetId(med.id)}
                    className="text-slate-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                    title="Eliminar medicamento"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* NEW MEDICATION FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
          <form
            onSubmit={handleAddMedication}
            className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-soft border border-slate-100 z-10 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Registrar Nuevo Medicamento</h3>
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
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre del Medicamento</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Metformina 850mg, Ibuprofeno 400mg"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Dosis / Formato</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 1 tableta, 5ml, 2 pufs"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Frecuencia</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Cada 8 horas, 1 vez al día"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha de Inicio</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha de Término (Opcional)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">URL o Ruta del Adjunto (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. id_workspace/nombre_archivo.pdf"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notas / Indicaciones Especiales (Opcional)</label>
                <textarea
                  rows={3}
                  placeholder="Ej. Tomar después del desayuno. No mezclar con alcohol."
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
                Guardar Tratamiento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CONFIRM DELETION MODAL */}
      <ConfirmModal
        isOpen={deleteTargetId !== null}
        title="¿Eliminar medicamento del plan?"
        message="¿Estás seguro de que deseas eliminar este medicamento de tu plan familiar? Se perderán todos los datos de dosificación y alertas asociadas."
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={handleDeleteMedication}
        onCancel={() => setDeleteTargetId(null)}
        variant="danger"
      />
    </div>
  );
};
