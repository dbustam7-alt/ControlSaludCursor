'use client';

import React, { useState } from 'react';
import { useWorkspaces, WorkspaceMember } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronDown, Plus, Users, Mail, User, Shield, Check, Trash2, X } from 'lucide-react';

export const WorkspaceSwitcher: React.FC = () => {
  const { 
    workspaces, 
    activeWorkspace, 
    members, 
    switchWorkspace, 
    createWorkspace, 
    inviteMember, 
    removeMember 
  } = useWorkspaces();
  const { user } = useAuth();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  // Form states
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRelation, setInviteRelation] = useState<WorkspaceMember['relationship']>('sibling');
  const [newWsName, setNewWsName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    
    setLoading(true);
    setError(null);
    const res = await createWorkspace(newWsName, 'family');
    setLoading(false);
    
    if (res.success) {
      setNewWsName('');
      setIsCreateOpen(false);
      setIsOpen(false);
    } else {
      setError(res.error || 'Error al crear el espacio de trabajo.');
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;

    setLoading(true);
    setError(null);
    const res = await inviteMember(inviteEmail, inviteRelation, inviteName);
    setLoading(false);

    if (res.success) {
      setInviteEmail('');
      setInviteName('');
      setInviteRelation('sibling');
      setIsInviteOpen(false);
    } else {
      setError(res.error || 'Error al enviar la invitación.');
    }
  };

  const relationshipLabels: Record<WorkspaceMember['relationship'], string> = {
    patient: 'Paciente Principal',
    sibling: 'Hermano(a)',
    child: 'Hijo(a)',
    parent: 'Padre / Madre',
    caregiver: 'Cuidador(a)',
    doctor: 'Médico(a)',
    other: 'Otro familiar/Contacto',
  };

  return (
    <div className="relative">
      {/* Selector Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-sm transition-colors text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <Users className="h-4 w-4 text-indigo-600" />
        <span className="max-w-[140px] sm:max-w-[200px] truncate">
          {activeWorkspace ? activeWorkspace.name : 'Cargando espacio...'}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-slate-100 shadow-soft p-2 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              Tus Espacios de Trabajo
            </div>
            
            <div className="space-y-1 max-h-48 overflow-y-auto my-1">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    switchWorkspace(ws.id);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between w-full px-3 py-2 text-sm rounded-xl transition-colors ${
                    activeWorkspace?.id === ws.id
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{ws.name}</span>
                  {activeWorkspace?.id === ws.id && <Check className="h-4 w-4 shrink-0" />}
                </button>
              ))}
            </div>

            <div className="border-t border-slate-100 my-1 pt-1 space-y-1">
              {activeWorkspace?.type === 'family' && (
                <button
                  onClick={() => {
                    setIsInviteOpen(true);
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-xl transition-colors font-medium"
                >
                  <Plus className="h-4 w-4 text-indigo-600" />
                  Invitar Familiar
                </button>
              )}

              <button
                onClick={() => {
                  setIsCreateOpen(true);
                  setIsOpen(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-xl transition-colors font-medium"
              >
                <Plus className="h-4 w-4 text-emerald-600" />
                Nuevo Grupo Familiar
              </button>
            </div>

            {activeWorkspace?.type === 'family' && (
              <div className="border-t border-slate-100 mt-2 pt-2 px-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Miembros ({members.length})
                </div>
                <div className="space-y-2 max-h-36 overflow-y-auto mb-1">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2 text-xs">
                      <div className="truncate">
                        <p className="font-semibold text-slate-800 truncate">{m.displayName}</p>
                        <p className="text-slate-500 truncate">{relationshipLabels[m.relationship]}</p>
                      </div>
                      {m.role === 'admin' ? (
                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-bold uppercase text-[9px] shrink-0">
                          Admin
                        </span>
                      ) : (
                        user?.email === m.email || members.find(item => item.email === user?.email)?.role === 'admin' ? (
                          <button
                            onClick={() => removeMember(m.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors shrink-0"
                            title="Eliminar miembro"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        ) : null
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* CREATE WORKSPACE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsCreateOpen(false)} />
          <form onSubmit={handleCreateWorkspace} className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-soft border border-slate-100 z-10 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Crear Espacio Familiar</h3>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && <div className="mb-4 text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">{error}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre del Grupo Familiar</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Familia Bustamante, Casa Abuelos"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-xl transition-colors"
              >
                {loading ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* INVITE MEMBER MODAL */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsInviteOpen(false)} />
          <form onSubmit={handleInviteMember} className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-soft border border-slate-100 z-10 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Invitar Familiar a {activeWorkspace?.name}</h3>
              <button type="button" onClick={() => setIsInviteOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && <div className="mb-4 text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">{error}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre Completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Ej. Laura Bustamante"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="ejemplo@correo.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Parentesco / Rol</label>
                <div className="relative">
                  <Shield className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <select
                    value={inviteRelation}
                    onChange={(e) => setInviteRelation(e.target.value as WorkspaceMember['relationship'])}
                    className="w-full pl-10 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800 appearance-none"
                  >
                    <option value="sibling">Hermano(a)</option>
                    <option value="child">Hijo(a)</option>
                    <option value="parent">Padre / Madre</option>
                    <option value="caregiver">Cuidador(a)</option>
                    <option value="doctor">Médico(a)</option>
                    <option value="patient">Paciente</option>
                    <option value="other">Otro</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsInviteOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-xl transition-colors"
              >
                {loading ? 'Invitando...' : 'Invitar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
