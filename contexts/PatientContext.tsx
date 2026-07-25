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
}

interface PatientContextType {
  patients: Patient[];
  activePatient: Patient | null;
  /** null = ver todos los pacientes / registros sin asignar */
  filterPatientId: string | null;
  loading: boolean;
  setFilterPatientId: (patientId: string | null) => void;
  createPatient: (data: {
    fullName: string;
    relationship: PatientRelationship;
    birthDate?: string;
    notes?: string;
  }) => Promise<{ success: boolean; data?: Patient; error?: string }>;
  updatePatient: (
    patientId: string,
    data: Partial<Pick<Patient, 'fullName' | 'relationship' | 'birthDate' | 'notes'>>
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
  },
  {
    id: 'patient-papa',
    workspaceId: 'family-workspace-id',
    fullName: 'Papá',
    relationship: 'parent',
    birthDate: null,
    notes: 'Paciente principal - monitoreo familiar',
  },
  {
    id: 'patient-mama',
    workspaceId: 'family-workspace-id',
    fullName: 'Mamá',
    relationship: 'parent',
    birthDate: null,
    notes: 'Paciente principal - monitoreo familiar',
  },
];

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
        } else if (activeWorkspace.type === 'personal' && filtered.length === 1) {
          setFilterPatientIdState(filtered[0].id);
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

      let mapped: Patient[] = (data || []).map((p: any) => ({
        id: p.id,
        workspaceId: p.workspace_id,
        fullName: p.full_name,
        relationship: p.relationship,
        birthDate: p.birth_date,
        notes: p.notes,
      }));

      // En espacio personal, crear paciente "Yo" automáticamente si no hay ninguno
      if (mapped.length === 0 && activeWorkspace.type === 'personal') {
        const { data: created, error: createErr } = await supabase
          .from('patients')
          .insert({
            workspace_id: activeWorkspace.id,
            full_name: user.displayName || 'Yo',
            relationship: 'self',
            created_by: user.id,
          })
          .select()
          .single();

        if (!createErr && created) {
          mapped = [
            {
              id: created.id,
              workspaceId: created.workspace_id,
              fullName: created.full_name,
              relationship: created.relationship,
              birthDate: created.birth_date,
              notes: created.notes,
            },
          ];
        }
      }

      setPatients(mapped);

      const savedPatientId = localStorage.getItem(`active_patient_${activeWorkspace.id}`);
      if (savedPatientId && mapped.some((p) => p.id === savedPatientId)) {
        setFilterPatientIdState(savedPatientId);
      } else if (activeWorkspace.type === 'personal' && mapped.length === 1) {
        setFilterPatientIdState(mapped[0].id);
        localStorage.setItem(`active_patient_${activeWorkspace.id}`, mapped[0].id);
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
  }) => {
    if (!activeWorkspace || !user) {
      return { success: false, error: 'No hay espacio de trabajo activo.' };
    }

    if (isDemoMode) {
      const newPatient: Patient = {
        id: `patient-demo-${Date.now()}`,
        workspaceId: activeWorkspace.id,
        fullName: fullName.trim(),
        relationship,
        birthDate: birthDate || null,
        notes: notes || null,
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
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      const mapped: Patient = {
        id: data.id,
        workspaceId: data.workspace_id,
        fullName: data.full_name,
        relationship: data.relationship,
        birthDate: data.birth_date,
        notes: data.notes,
      };

      setPatients((prev) => [...prev, mapped].sort((a, b) => a.fullName.localeCompare(b.fullName)));
      setFilterPatientId(mapped.id);
      return { success: true, data: mapped };
    } catch (err: any) {
      console.error('Error creating patient:', err);
      return { success: false, error: err.message || 'Error al crear el paciente.' };
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

      const { error } = await supabase.from('patients').update(payload).eq('id', patientId);
      if (error) throw error;

      setPatients((prev) =>
        prev.map((p) =>
          p.id === patientId
            ? {
                ...p,
                fullName: data.fullName ?? p.fullName,
                relationship: data.relationship ?? p.relationship,
                birthDate: data.birthDate !== undefined ? data.birthDate : p.birthDate,
                notes: data.notes !== undefined ? data.notes : p.notes,
              }
            : p
        )
      );
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
