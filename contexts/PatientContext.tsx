'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useWorkspaces } from './WorkspaceContext';
import { createClient } from '@/utils/supabase/client';

export type PatientRelationship = 'self' | 'parent' | 'sibling' | 'child' | 'spouse' | 'other';

export interface Patient {
  id: string;
  workspaceId: string;
  fullName: string;
  relationship: PatientRelationship;
  birthDate: string | null;
  notes: string | null;
  email: string | null;
  linkedUserId: string | null;
}

interface CreatePatientInput {
  fullName: string;
  relationship: PatientRelationship;
  birthDate?: string;
  notes?: string;
  email?: string;
  /** Si hay email, también invitar al grupo familiar como miembro */
  inviteToWorkspace?: boolean;
}

interface PatientContextType {
  patients: Patient[];
  activePatient: Patient | null;
  /** null = ver todos los pacientes / registros sin asignar */
  filterPatientId: string | null;
  loading: boolean;
  setFilterPatientId: (patientId: string | null) => void;
  createPatient: (data: CreatePatientInput) => Promise<{ success: boolean; data?: Patient; error?: string }>;
  updatePatient: (
    patientId: string,
    data: Partial<Pick<Patient, 'fullName' | 'relationship' | 'birthDate' | 'notes' | 'email'>>
  ) => Promise<{ success: boolean; error?: string }>;
  deletePatient: (patientId: string) => Promise<{ success: boolean; error?: string }>;
  refreshPatients: () => Promise<void>;
}

const PatientContext = createContext<PatientContextType | undefined>(undefined);

const MOCK_PATIENTS: Patient[] = [
  {
    id: 'patient-self',
    workspaceId: 'personal-workspace-id',
    fullName: 'Yo (Personal)',
    relationship: 'self',
    birthDate: null,
    notes: null,
    email: 'demo.familiar@controlsalud.com',
    linkedUserId: '00000000-0000-0000-0000-000000000000',
  },
  {
    id: 'patient-papa',
    workspaceId: 'family-workspace-id',
    fullName: 'Papá',
    relationship: 'parent',
    birthDate: null,
    notes: 'Paciente principal - monitoreo familiar',
    email: null,
    linkedUserId: null,
  },
  {
    id: 'patient-mama',
    workspaceId: 'family-workspace-id',
    fullName: 'Mamá',
    relationship: 'parent',
    birthDate: null,
    notes: 'Paciente principal - monitoreo familiar',
    email: null,
    linkedUserId: null,
  },
];

function mapPatient(p: any): Patient {
  return {
    id: p.id,
    workspaceId: p.workspace_id ?? p.workspaceId,
    fullName: p.full_name ?? p.fullName,
    relationship: p.relationship,
    birthDate: p.birth_date ?? p.birthDate ?? null,
    notes: p.notes ?? null,
    email: p.email ?? null,
    linkedUserId: p.linked_user_id ?? p.linkedUserId ?? null,
  };
}

function toMemberRelationship(
  relationship: PatientRelationship
): 'patient' | 'sibling' | 'child' | 'parent' | 'caregiver' | 'doctor' | 'other' {
  if (relationship === 'self') return 'patient';
  if (relationship === 'spouse') return 'other';
  return relationship;
}

export const PatientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isDemoMode } = useAuth();
  const { activeWorkspace } = useWorkspaces();
  const supabase = createClient();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [filterPatientId, setFilterPatientIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activePatient =
    filterPatientId ? patients.find((p) => p.id === filterPatientId) || null : null;

  const setFilterPatientId = (patientId: string | null) => {
    setFilterPatientIdState(patientId);
    if (activeWorkspace) {
      if (patientId) {
        localStorage.setItem(`active_patient_${activeWorkspace.id}`, patientId);
      } else {
        localStorage.removeItem(`active_patient_${activeWorkspace.id}`);
      }
    }
  };

  const refreshPatients = async () => {
    if (!activeWorkspace || !user) {
      setPatients([]);
      setFilterPatientIdState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (isDemoMode) {
        const saved = localStorage.getItem('demo_patients');
        let list: Patient[] = saved ? JSON.parse(saved) : MOCK_PATIENTS;
        if (!saved) {
          localStorage.setItem('demo_patients', JSON.stringify(MOCK_PATIENTS));
        }
        const filtered = list.filter((p) => p.workspaceId === activeWorkspace.id);
        setPatients(filtered);

        const savedPatientId = localStorage.getItem(`active_patient_${activeWorkspace.id}`);
        if (savedPatientId && filtered.some((p) => p.id === savedPatientId)) {
          setFilterPatientIdState(savedPatientId);
        } else {
          setFilterPatientIdState(null);
        }
        return;
      }

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .order('full_name', { ascending: true });

      if (error) throw error;

      let mapped: Patient[] = (data || []).map(mapPatient);

      // En espacio personal, crear paciente "Yo" automáticamente si no hay ninguno
      if (mapped.length === 0 && activeWorkspace.type === 'personal') {
        const { data: created, error: createErr } = await supabase
          .from('patients')
          .insert({
            workspace_id: activeWorkspace.id,
            full_name: user.displayName || 'Yo',
            relationship: 'self',
            email: user.email || null,
            linked_user_id: user.id,
            created_by: user.id,
          })
          .select()
          .single();

        if (!createErr && created) {
          mapped = [mapPatient(created)];
        }
      }

      // En grupo familiar: el creador siempre debe figurar como paciente vinculado
      if (activeWorkspace.type === 'family') {
        const hasSelf =
          mapped.some((p) => p.linkedUserId === user.id) ||
          mapped.some((p) => p.relationship === 'self') ||
          mapped.some((p) => (p.email || '').toLowerCase() === (user.email || '').toLowerCase());

        if (!hasSelf && user.email) {
          const { data: created, error: createErr } = await supabase
            .from('patients')
            .insert({
              workspace_id: activeWorkspace.id,
              full_name: user.displayName || user.email.split('@')[0],
              relationship: 'self',
              email: user.email.toLowerCase(),
              linked_user_id: user.id,
              created_by: user.id,
            })
            .select()
            .single();

          if (!createErr && created) {
            mapped = [...mapped, mapPatient(created)].sort((a, b) =>
              a.fullName.localeCompare(b.fullName)
            );
          }
        }
      }

      setPatients(mapped);

      const savedPatientId = localStorage.getItem(`active_patient_${activeWorkspace.id}`);
      if (savedPatientId && mapped.some((p) => p.id === savedPatientId)) {
        setFilterPatientIdState(savedPatientId);
      } else {
        setFilterPatientIdState(null);
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id, user?.id, isDemoMode]);

  const createPatient: PatientContextType['createPatient'] = async ({
    fullName,
    relationship,
    birthDate,
    notes,
    email,
    inviteToWorkspace = true,
  }) => {
    if (!activeWorkspace || !user) {
      return { success: false, error: 'No hay espacio de trabajo activo.' };
    }

    const normalizedEmail = email?.trim() ? email.trim().toLowerCase() : null;

    if (isDemoMode) {
      const newPatient: Patient = {
        id: `patient-demo-${Date.now()}`,
        workspaceId: activeWorkspace.id,
        fullName: fullName.trim(),
        relationship,
        birthDate: birthDate || null,
        notes: notes || null,
        email: normalizedEmail,
        linkedUserId: null,
      };
      const saved = localStorage.getItem('demo_patients');
      const list: Patient[] = saved ? JSON.parse(saved) : [];
      const updated = [...list, newPatient];
      localStorage.setItem('demo_patients', JSON.stringify(updated));
      setPatients((prev) => [...prev, newPatient]);
      setFilterPatientId(newPatient.id);
      return { success: true, data: newPatient };
    }

    try {
      const { data, error } = await supabase
        .from('patients')
        .insert({
          workspace_id: activeWorkspace.id,
          full_name: fullName.trim(),
          relationship,
          birth_date: birthDate || null,
          notes: notes || null,
          email: normalizedEmail,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      const mapped = mapPatient(data);

      // Invitar al correo al grupo (para que pueda iniciar sesión y ver el espacio)
      if (normalizedEmail && inviteToWorkspace && activeWorkspace.type === 'family') {
        const { data: existingMembers } = await supabase
          .from('workspace_members')
          .select('id')
          .eq('workspace_id', activeWorkspace.id)
          .ilike('email', normalizedEmail)
          .limit(1);

        if (!existingMembers || existingMembers.length === 0) {
          const { error: inviteError } = await supabase.from('workspace_members').insert({
            workspace_id: activeWorkspace.id,
            email: normalizedEmail,
            display_name: fullName.trim(),
            relationship: toMemberRelationship(relationship),
            role: 'member',
          });
          if (inviteError) {
            console.warn('Paciente creado, pero no se pudo invitar al grupo:', inviteError.message);
          }
        }
      }

      setPatients((prev) => [...prev, mapped].sort((a, b) => a.fullName.localeCompare(b.fullName)));
      setFilterPatientId(mapped.id);
      return { success: true, data: mapped };
    } catch (err: any) {
      console.error('Error creating patient:', err);
      const msg = err.message || 'Error al crear el paciente.';
      if (msg.includes('patients_workspace_email_unique')) {
        return { success: false, error: 'Ya existe un paciente con ese correo en este grupo.' };
      }
      return { success: false, error: msg };
    }
  };

  const updatePatient: PatientContextType['updatePatient'] = async (patientId, data) => {
    if (isDemoMode) {
      const saved = localStorage.getItem('demo_patients');
      const list: Patient[] = saved ? JSON.parse(saved) : [];
      const updated = list.map((p) =>
        p.id === patientId
          ? {
              ...p,
              fullName: data.fullName ?? p.fullName,
              relationship: data.relationship ?? p.relationship,
              birthDate: data.birthDate !== undefined ? data.birthDate : p.birthDate,
              notes: data.notes !== undefined ? data.notes : p.notes,
              email: data.email !== undefined ? data.email : p.email,
            }
          : p
      );
      localStorage.setItem('demo_patients', JSON.stringify(updated));
      setPatients(updated.filter((p) => p.workspaceId === activeWorkspace?.id));
      return { success: true };
    }

    try {
      const payload: any = {};
      if (data.fullName !== undefined) payload.full_name = data.fullName;
      if (data.relationship !== undefined) payload.relationship = data.relationship;
      if (data.birthDate !== undefined) payload.birth_date = data.birthDate;
      if (data.notes !== undefined) payload.notes = data.notes;
      if (data.email !== undefined) payload.email = data.email?.trim() ? data.email.trim().toLowerCase() : null;

      const { data: updatedRow, error } = await supabase
        .from('patients')
        .update(payload)
        .eq('id', patientId)
        .select()
        .single();
      if (error) throw error;

      const mapped = mapPatient(updatedRow);
      setPatients((prev) => prev.map((p) => (p.id === patientId ? mapped : p)));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al actualizar el paciente.' };
    }
  };

  const deletePatient: PatientContextType['deletePatient'] = async (patientId) => {
    if (isDemoMode) {
      const saved = localStorage.getItem('demo_patients');
      const list: Patient[] = saved ? JSON.parse(saved) : [];
      const updated = list.filter((p) => p.id !== patientId);
      localStorage.setItem('demo_patients', JSON.stringify(updated));
      setPatients(updated.filter((p) => p.workspaceId === activeWorkspace?.id));
      if (filterPatientId === patientId) setFilterPatientId(null);
      return { success: true };
    }

    try {
      const { error } = await supabase.from('patients').delete().eq('id', patientId);
      if (error) throw error;
      setPatients((prev) => prev.filter((p) => p.id !== patientId));
      if (filterPatientId === patientId) setFilterPatientId(null);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al eliminar el paciente.' };
    }
  };

  return (
    <PatientContext.Provider
      value={{
        patients,
        activePatient,
        filterPatientId,
        loading,
        setFilterPatientId,
        createPatient,
        updatePatient,
        deletePatient,
        refreshPatients,
      }}
    >
      {children}
    </PatientContext.Provider>
  );
};

export function usePatients() {
  const ctx = useContext(PatientContext);
  if (!ctx) {
    throw new Error('usePatients must be used within a PatientProvider');
  }
  return ctx;
}

/**
 * Filtro de paciente compatible con datos legacy:
 * - "Todos" (null): muestra todo
 * - Paciente concreto: su info + registros sin asignar (patient_id null)
 *   para que citas/órdenes/meds previos a perfiles no "desaparezcan"
 */
export function matchesPatientFilter(
  recordPatientId: string | null | undefined,
  filterPatientId: string | null
): boolean {
  if (filterPatientId === null) return true;
  return recordPatientId === filterPatientId || recordPatientId == null;
}
