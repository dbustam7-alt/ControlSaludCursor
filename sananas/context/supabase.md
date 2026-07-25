# Supabase Schema: Control de Salud - Gestión y Control Médico Familiar

Este documento contiene el script de base de datos PostgreSQL completo para configurar el backend de Supabase. Incluye la creación de tablas, relaciones, triggers para la creación de perfiles de usuario, y políticas de seguridad de nivel de fila (Row Level Security - RLS).

Puedes ejecutar este script directamente en el **SQL Editor** de tu panel de Supabase.

---

```sql
-- 1. EXTENSIONES (Habilitar si no están habilitadas)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 2. TABLAS Y RELACIONES
-- ==========================================

-- TABLA DE PERFILES DE USUARIOS (profiles)
-- Se sincroniza automáticamente con auth.users mediante un trigger.
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA DE ESPACIOS DE TRABAJO (workspaces)
-- Permite separar la información personal de la de diferentes grupos familiares.
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('personal', 'family')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA DE MIEMBROS DE ESPACIOS DE TRABAJO (workspace_members)
-- Asocia a los usuarios/familiares invitados con un espacio de trabajo específico.
CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  relationship TEXT NOT NULL CHECK (relationship IN ('patient', 'sibling', 'child', 'parent', 'caregiver', 'doctor', 'other')),
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA DE CITAS MÉDICAS (appointments)
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  doctor_name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  location TEXT,
  date_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  notes TEXT,
  attachment_url TEXT, -- URL o path del documento médico escaneado asociado
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA DE ÓRDENES MÉDICAS Y EXÁMENES (medical_orders)
CREATE TABLE public.medical_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  exam_type TEXT NOT NULL,
  institution TEXT NOT NULL,
  required_authorization BOOLEAN NOT NULL DEFAULT FALSE,
  has_authorization BOOLEAN NOT NULL DEFAULT FALSE,
  expiration_date DATE,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA DE MEDICAMENTOS Y TRATAMIENTOS (medications)
CREATE TABLE public.medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  stock_quantity INTEGER,
  low_stock_alert INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  notes TEXT,
  attachment_url TEXT, -- URL o path de la receta médica escaneada asociada
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. TRIGGERS AUTOMÁTICOS
-- ==========================================

-- Función para crear automáticamente un perfil de usuario y un Workspace personal por defecto
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_workspace_id UUID;
BEGIN
  -- Insertar perfil
  INSERT INTO public.profiles (id, email, display_name, photo_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Crear Workspace Personal
  INSERT INTO public.workspaces (name, type, created_by)
  VALUES ('Mi Salud (Personal)', 'personal', NEW.id)
  RETURNING id INTO new_workspace_id;

  -- Agregar al creador como miembro admin de su propio workspace
  INSERT INTO public.workspace_members (workspace_id, email, display_name, role, relationship)
  VALUES (
    new_workspace_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    'admin',
    'patient'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disparador asociado a la tabla de autenticación de Supabase (auth.users)
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 4. CONTROL DE SEGURIDAD (Row Level Security - RLS)
-- ==========================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

-- 4.1 POLÍTICAS PARA: profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Función auxiliar para verificar si un usuario autenticado pertenece a un workspace
CREATE OR REPLACE FUNCTION public.is_workspace_member(workspace_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = is_workspace_member.workspace_id
    AND workspace_members.email = auth.email()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.2 POLÍTICAS PARA: workspaces
CREATE POLICY "Members can view workspaces"
  ON public.workspaces FOR SELECT
  USING (
    created_by = auth.uid() OR 
    public.is_workspace_member(id)
  );

CREATE POLICY "Creators can update workspaces"
  ON public.workspaces FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Creators can delete workspaces"
  ON public.workspaces FOR DELETE
  USING (created_by = auth.uid());

-- 4.3 POLÍTICAS PARA: workspace_members
CREATE POLICY "Members can view other workspace members"
  ON public.workspace_members FOR SELECT
  USING (
    public.is_workspace_member(workspace_id)
  );

CREATE POLICY "Workspace admins can invite/insert members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = workspace_members.workspace_id
      AND workspace_members.email = auth.email()
      AND workspace_members.role = 'admin'
    ) OR 
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = workspace_members.workspace_id
      AND workspaces.created_by = auth.uid()
    )
  );

CREATE POLICY "Workspace admins can update members"
  ON public.workspace_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = workspace_members.workspace_id
      AND workspace_members.email = auth.email()
      AND workspace_members.role = 'admin'
    )
  );

CREATE POLICY "Workspace admins or self can delete members"
  ON public.workspace_members FOR DELETE
  USING (
    email = auth.email() OR
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = workspace_members.workspace_id
      AND workspace_members.email = auth.email()
      AND workspace_members.role = 'admin'
    )
  );

-- 4.4 POLÍTICAS PARA: appointments
CREATE POLICY "Members can view appointments"
  ON public.appointments FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can insert appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can update appointments"
  ON public.appointments FOR UPDATE
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can delete appointments"
  ON public.appointments FOR DELETE
  USING (public.is_workspace_member(workspace_id));

-- 4.5 POLÍTICAS PARA: medical_orders
CREATE POLICY "Members can view medical orders"
  ON public.medical_orders FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can insert medical orders"
  ON public.medical_orders FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can update medical orders"
  ON public.medical_orders FOR UPDATE
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can delete medical orders"
  ON public.medical_orders FOR DELETE
  USING (public.is_workspace_member(workspace_id));

-- 4.6 POLÍTICAS PARA: medications
CREATE POLICY "Members can view medications"
  ON public.medications FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can insert medications"
  ON public.medications FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can update medications"
  ON public.medications FOR UPDATE
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can delete medications"
  ON public.medications FOR DELETE
  USING (public.is_workspace_member(workspace_id));


-- ==========================================
-- 5. ALMACENAMIENTO DE DOCUMENTOS (storage.objects)
-- ==========================================

-- 5.1 Crear el bucket para guardar recetas, órdenes y documentos médicos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medical-documents', 
  'medical-documents', 
  false, -- bucket privado para resguardar la privacidad de salud
  10485760, -- límite de 10MB (10 * 1024 * 1024)
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 5.2 Políticas de seguridad RLS específicas para almacenamiento
DROP POLICY IF EXISTS "Allow members to read files" ON storage.objects;
DROP POLICY IF EXISTS "Allow members to insert files" ON storage.objects;
DROP POLICY IF EXISTS "Allow members to update files" ON storage.objects;
DROP POLICY IF EXISTS "Allow members to delete files" ON storage.objects;

-- Política de Lectura (SELECT)
CREATE POLICY "Allow members to read files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'medical-documents' AND
    public.is_workspace_member(CAST(SPLIT_PART(name, '/', 1) AS UUID))
  );

-- Política de Inserción (INSERT)
CREATE POLICY "Allow members to insert files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'medical-documents' AND
    public.is_workspace_member(CAST(SPLIT_PART(name, '/', 1) AS UUID))
  );

-- Política de Actualización (UPDATE)
CREATE POLICY "Allow members to update files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'medical-documents' AND
    public.is_workspace_member(CAST(SPLIT_PART(name, '/', 1) AS UUID))
  );

-- Política de Eliminación (DELETE)
CREATE POLICY "Allow members to delete files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'medical-documents' AND
    public.is_workspace_member(CAST(SPLIT_PART(name, '/', 1) AS UUID))
  );

```
