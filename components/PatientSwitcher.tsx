'use client';

import React, { useState } from 'react';
import { usePatients, Patient, PatientRelationship } from '@/contexts/PatientContext';
import { useWorkspaces } from '@/contexts/WorkspaceContext';
import { User, ChevronDown, Plus, Check, Users, X, Mail, BadgeCheck, Pencil } from 'lucide-react';

const RELATIONSHIP_LABELS: Record<PatientRelationship, string> = {
  self: 'Yo / Titular',
  parent: 'Padre / Madre',
  sibling: 'Hermano(a)',
  child: 'Hijo(a)',
  spouse: 'Cónyuge / Pareja',
  other: 'Otro',
};

export const PatientSwitcher: React.FC = () => {
  const { activeWorkspace } = useWorkspaces();
  const {
    patients,
    filterPatientId,
    setFilterPatientId,
    createPatient,
    updatePatient,
    loading,
  } = usePatients();

  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState<PatientRelationship>('parent');
  const [inviteToWorkspace, setInviteToWorkspace] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeWorkspace) return null;

  const activeLabel =
    filterPatientId === null
      ? 'Todos los pacientes'
      : patients.find((p) => p.id === filterPatientId)?.fullName || 'Paciente';

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setRelationship('parent');
    setInviteToWorkspace(true);
    setError(null);
  };

  const openEdit = (p: Patient, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPatient(p);
    setFullName(p.fullName);
    setEmail(p.email || '');
    setRelationship(p.relationship);
    setError(null);
    setIsOpen(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    setFormLoading(true);
    setError(null);
    const res = await createPatient({
      fullName: fullName.trim(),
      relationship,
      email: email.trim() || undefined,
      inviteToWorkspace,
    });
    setFormLoading(false);

    if (res.success) {
      resetForm();
      setIsCreateOpen(false);
      setIsOpen(false);
    } else {
      setError(res.error || 'No se pudo crear el paciente.');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient || !fullName.trim()) return;

    setFormLoading(true);
    setError(null);
    const res = await updatePatient(editingPatient.id, {
      fullName: fullName.trim(),
      relationship,
      email: email.trim() || null,
    });
    setFormLoading(false);

    if (res.success) {
      setEditingPatient(null);
      resetForm();
    } else {
      setError(res.error || 'No se pudo actualizar el paciente.');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="flex items-center gap-2 w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <User className="h-4 w-4 text-indigo-600 shrink-0" />
        <span className="flex-1 text-left truncate">{activeLabel}</span>
        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-100 shadow-soft p-2 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Filtrar por paciente
            </div>

            <button
              onClick={() => {
                setFilterPatientId(null);
                setIsOpen(false);
              }}
              className={`flex items-center justify-between w-full px-3 py-2 text-sm rounded-xl transition-colors ${
                filterPatientId === null
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Todos los pacientes
              </span>
              {filterPatientId === null && <Check className="h-4 w-4 shrink-0" />}
            </button>

            <div className="space-y-0.5 max-h-52 overflow-y-auto my-1">
              {patients.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-1 rounded-xl ${
                    filterPatientId === p.id ? 'bg-indigo-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <button
                    onClick={() => {
                      setFilterPatientId(p.id);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between flex-1 min-w-0 px-3 py-2 text-sm rounded-xl transition-colors ${
                      filterPatientId === p.id
                        ? 'text-indigo-700 font-semibold'
                        : 'text-slate-700'
                    }`}
                  >
                    <span className="truncate text-left min-w-0">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{p.fullName}</span>
                        {p.linkedUserId && (
                          <BadgeCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" aria-label="Cuenta vinculada" />
                        )}
                      </span>
                      <span className="block text-[10px] font-medium text-slate-400 truncate">
                        {RELATIONSHIP_LABELS[p.relationship]}
                        {p.email ? ` · ${p.email}` : ' · Sin correo'}
                      </span>
                    </span>
                    {filterPatientId === p.id && <Check className="h-4 w-4 shrink-0 ml-1" />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => openEdit(p, e)}
                    className="p-2 text-slate-400 hover:text-indigo-600 shrink-0"
                    title="Editar paciente"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {patients.length === 0 && (
                <p className="px-3 py-2 text-xs text-slate-500">
                  Aún no hay pacientes. Agrega a papá, mamá u otro familiar.
                </p>
              )}
            </div>

            <div className="border-t border-slate-100 pt-1 mt-1">
              <button
                onClick={() => {
                  resetForm();
                  setIsCreateOpen(true);
                  setIsOpen(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-xl transition-colors font-medium"
              >
                <Plus className="h-4 w-4 text-emerald-600" />
                Agregar paciente
              </button>
            </div>
          </div>
        </>
      )}

      {(isCreateOpen || editingPatient) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => {
              setIsCreateOpen(false);
              setEditingPatient(null);
            }}
          />
          <form
            onSubmit={editingPatient ? handleUpdate : handleCreate}
            className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-soft border border-slate-100 z-10 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editingPatient ? 'Editar paciente' : 'Nuevo paciente'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingPatient(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              {editingPatient
                ? 'Actualiza el nombre, correo o relación. El correo permite vincular su cuenta individual.'
                : 'Crea el perfil de cuidado (ej. Papá, Mamá). El correo vincula su cuenta cuando inicie sesión.'}
            </p>

            {error && (
              <div className="mb-3 text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Nombre del paciente
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Papá, Mamá, Juan Pérez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                />
              </div>

              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 uppercase tracking-wider">
                  <Mail className="h-3.5 w-3.5" />
                  Correo electrónico
                </label>
                <input
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
                <p className="text-[11px] text-indigo-700/80 leading-relaxed">
                  Recomendado: así cada persona tiene un perfil individual vinculado a su cuenta, como el tuyo.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Relación familiar
                </label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value as PatientRelationship)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                >
                  {Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {!editingPatient && activeWorkspace.type === 'family' && email.trim() && (
                <label className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inviteToWorkspace}
                    onChange={(e) => setInviteToWorkspace(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-slate-700 leading-relaxed">
                    <span className="font-semibold block mb-0.5">Invitar al grupo familiar</span>
                    Podrá iniciar sesión y ver/editar la información compartida de este grupo.
                  </span>
                </label>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingPatient(null);
                }}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-60"
              >
                {formLoading ? 'Guardando...' : editingPatient ? 'Guardar cambios' : 'Crear paciente'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
