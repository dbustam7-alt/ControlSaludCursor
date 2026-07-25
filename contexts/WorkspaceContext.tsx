'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { createClient } from '@/utils/supabase/client';

export interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'family';
  createdBy: string;
  createdAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  email: string;
  displayName: string;
  role: 'admin' | 'member';
  relationship: 'patient' | 'sibling' | 'child' | 'parent' | 'caregiver' | 'doctor' | 'other';
  joinedAt: string;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  members: WorkspaceMember[];
  loading: boolean;
  switchWorkspace: (workspaceId: string) => void;
  createWorkspace: (name: string, type: 'personal' | 'family') => Promise<{ success: boolean; data?: Workspace; error?: string }>;
  inviteMember: (email: string, relationship: WorkspaceMember['relationship'], displayName: string) => Promise<{ success: boolean; error?: string }>;
  removeMember: (memberId: string) => Promise<{ success: boolean; error?: string }>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const MOCK_WORKSPACES: Workspace[] = [
  {
    id: 'personal-workspace-id',
    name: 'Mi Salud (Personal)',
    type: 'personal',
    createdBy: '00000000-0000-0000-0000-000000000000',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'family-workspace-id',
    name: 'Familia Bustamante (Compartido)',
    type: 'family',
    createdBy: '00000000-0000-0000-0000-000000000000',
    createdAt: new Date().toISOString(),
  },
];

const MOCK_MEMBERS: WorkspaceMember[] = [
  {
    id: 'm1',
    workspaceId: 'family-workspace-id',
    email: 'demo.familiar@controlsalud.com',
    displayName: 'Usuario Demo Familiar',
    role: 'admin',
    relationship: 'caregiver',
    joinedAt: new Date().toISOString(),
  },
  {
    id: 'm2',
    workspaceId: 'family-workspace-id',
    email: 'laura.bustamante@email.com',
    displayName: 'Laura Bustamante',
    role: 'member',
    relationship: 'child',
    joinedAt: new Date().toISOString(),
  },
  {
    id: 'm3',
    workspaceId: 'family-workspace-id',
    email: 'andres.bustamante@email.com',
    displayName: 'Andrés Bustamante',
    role: 'member',
    relationship: 'sibling',
    joinedAt: new Date().toISOString(),
  },
];

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isDemoMode } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    if (isDemoMode) {
      setWorkspaces(MOCK_WORKSPACES);
      
      // Default to active family workspace or personal
      const savedActiveId = localStorage.getItem('active_workspace_id');
      const found = MOCK_WORKSPACES.find(w => w.id === savedActiveId) || MOCK_WORKSPACES[1];
      setActiveWorkspace(found);
      setLoading(false);
      return;
    }

    const fetchWorkspacesAndMembers = async () => {
      setLoading(true);
      try {
        // Query user's workspaces from Supabase
        const { data: workspaceData, error: wsError } = await supabase
          .from('workspaces')
          .select(`
            id,
            name,
            type,
            created_by,
            created_at
          `);

        if (wsError) throw wsError;

        const mappedWorkspaces: Workspace[] = (workspaceData || []).map((ws: any) => ({
          id: ws.id,
          name: ws.name,
          type: ws.type,
          createdBy: ws.created_by,
          createdAt: ws.created_at,
        }));

        setWorkspaces(mappedWorkspaces);

        // Determine active workspace
        let selectedWs: Workspace | null = null;
        const savedActiveId = localStorage.getItem('active_workspace_id');
        
        if (savedActiveId) {
          selectedWs = mappedWorkspaces.find(w => w.id === savedActiveId) || null;
        }

        if (!selectedWs && mappedWorkspaces.length > 0) {
          selectedWs = mappedWorkspaces[0];
        }

        setActiveWorkspace(selectedWs);
      } catch (err) {
        console.error('Error fetching workspaces:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspacesAndMembers();
  }, [user, isDemoMode]);

  // Load members whenever active workspace changes
  useEffect(() => {
    if (!activeWorkspace) {
      setMembers([]);
      return;
    }

    if (isDemoMode) {
      if (activeWorkspace.id === 'family-workspace-id') {
        setMembers(MOCK_MEMBERS);
      } else {
        // Personal workspace has only the main user
        setMembers([
          {
            id: 'm-personal',
            workspaceId: activeWorkspace.id,
            email: user?.email || '',
            displayName: user?.displayName || '',
            role: 'admin',
            relationship: 'patient',
            joinedAt: new Date().toISOString(),
          }
        ]);
      }
      return;
    }

    const fetchMembers = async () => {
      try {
        const { data: memberData, error: mError } = await supabase
          .from('workspace_members')
          .select(`
            id,
            workspace_id,
            email,
            display_name,
            role,
            relationship,
            joined_at
          `)
          .eq('workspace_id', activeWorkspace.id);

        if (mError) throw mError;

        const mappedMembers: WorkspaceMember[] = (memberData || []).map((m: any) => ({
          id: m.id,
          workspaceId: m.workspace_id,
          email: m.email,
          displayName: m.display_name,
          role: m.role,
          relationship: m.relationship,
          joinedAt: m.joined_at,
        }));

        setMembers(mappedMembers);
      } catch (err) {
        console.error('Error fetching workspace members:', err);
      }
    };

    fetchMembers();
  }, [activeWorkspace, isDemoMode, user]);

  const switchWorkspace = (workspaceId: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (ws) {
      setActiveWorkspace(ws);
      localStorage.setItem('active_workspace_id', workspaceId);
    }
  };

  const createWorkspace = async (name: string, type: 'personal' | 'family') => {
    if (isDemoMode) {
      const newWs: Workspace = {
        id: `demo-${Date.now()}`,
        name,
        type,
        createdBy: user?.id || '',
        createdAt: new Date().toISOString(),
      };
      const updated = [...workspaces, newWs];
      setWorkspaces(updated);
      setActiveWorkspace(newWs);
      localStorage.setItem('active_workspace_id', newWs.id);
      return { success: true, data: newWs };
    }

    try {
      const { data, error } = await supabase
        .from('workspaces')
        .insert({
          name,
          type,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      const newWs: Workspace = {
        id: data.id,
        name: data.name,
        type: data.type,
        createdBy: data.created_by,
        createdAt: data.created_at,
      };

      setWorkspaces([...workspaces, newWs]);
      setActiveWorkspace(newWs);
      localStorage.setItem('active_workspace_id', newWs.id);

      return { success: true, data: newWs };
    } catch (err: any) {
      console.error('Error creating workspace:', err);
      return { success: false, error: err.message || 'Error al crear el espacio de trabajo.' };
    }
  };

  const inviteMember = async (email: string, relationship: WorkspaceMember['relationship'], displayName: string) => {
    if (!activeWorkspace) return { success: false, error: 'No hay un espacio de trabajo activo.' };

    if (isDemoMode) {
      const newMember: WorkspaceMember = {
        id: `m-demo-${Date.now()}`,
        workspaceId: activeWorkspace.id,
        email,
        displayName,
        role: 'member',
        relationship,
        joinedAt: new Date().toISOString(),
      };
      setMembers([...members, newMember]);
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: activeWorkspace.id,
          email,
          display_name: displayName,
          relationship,
          role: 'member',
        });

      if (error) throw error;

      // Reload members
      const { data: memberData } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', activeWorkspace.id);

      const mappedMembers: WorkspaceMember[] = (memberData || []).map((m: any) => ({
        id: m.id,
        workspaceId: m.workspace_id,
        email: m.email,
        displayName: m.display_name,
        role: m.role,
        relationship: m.relationship,
        joinedAt: m.joined_at,
      }));

      setMembers(mappedMembers);

      return { success: true };
    } catch (err: any) {
      console.error('Error inviting workspace member:', err);
      return { success: false, error: err.message || 'Error al invitar al familiar.' };
    }
  };

  const removeMember = async (memberId: string) => {
    if (isDemoMode) {
      setMembers(members.filter(m => m.id !== memberId));
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      setMembers(members.filter(m => m.id !== memberId));
      return { success: true };
    } catch (err: any) {
      console.error('Error removing workspace member:', err);
      return { success: false, error: err.message || 'Error al revocar el acceso del miembro.' };
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        members,
        loading,
        switchWorkspace,
        createWorkspace,
        inviteMember,
        removeMember,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspaces = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspaces must be used within a WorkspaceProvider');
  }
  return context;
};
