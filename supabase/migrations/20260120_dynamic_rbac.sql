-- RBAC Migration: Dynamic Role Permissions
-- Rodrigo Osorio v1.0 - 2026

-- 1. Create role configuration table
CREATE TABLE IF NOT EXISTS public.role_configs (
    id TEXT PRIMARY KEY, -- 'Superadministrador', 'Administrador', etc.
    name TEXT NOT NULL,
    color TEXT NOT NULL, -- 'purple', 'blue', etc.
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create permissions mapping table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    role_id TEXT REFERENCES public.role_configs(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL, -- e.g., 'view_technicians'
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(role_id, permission_key)
);

-- 3. Enable RLS
ALTER TABLE public.role_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 4. Policies (Initially only Admins can manage these)
CREATE POLICY "Allow authenticated to read roles" ON public.role_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admins to manage roles" ON public.role_configs FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM app_users WHERE email = auth.jwt()->>'email' AND role IN ('Administrador', 'Superadministrador'))
);

CREATE POLICY "Allow authenticated to read permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admins to manage permissions" ON public.role_permissions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM app_users WHERE email = auth.jwt()->>'email' AND role IN ('Administrador', 'Superadministrador'))
);

-- 5. Seed Roles
INSERT INTO public.role_configs (id, name, color, description) VALUES
('Superadministrador', 'Superadministrador', 'purple', 'Control total del sistema'),
('Administrador', 'Administrador', 'blue', 'Gestión completa de datos'),
('Gestor', 'Gestor', 'indigo', 'Gestión operativa avanzada'),
('Supervisor', 'Supervisor', 'green', 'Supervisión y edición de datos'),
('Gerente de Sucursal', 'Gerente de Sucursal', 'amber', 'Gestión de su sucursal asignada'),
('Visualizador', 'Visualizador', 'slate', 'Solo lectura de información')
ON CONFLICT (id) DO UPDATE SET color = EXCLUDED.color, description = EXCLUDED.description;

-- 6. Helper for Batch Seeding Permissions
-- Permissions mapping from the previous matrix
DO $$ 
DECLARE 
    roles TEXT[] := ARRAY['Superadministrador', 'Administrador', 'Gestor', 'Supervisor', 'Gerente de Sucursal', 'Visualizador'];
    role_record TEXT;
BEGIN
    -- This is a simplified migration. Usually, we would map each hardcoded permission.
    -- For speed, we will seed the current state:
    
    -- Técnicos
    INSERT INTO public.role_permissions (role_id, permission_key) VALUES
    ('Superadministrador', 'view_technicians'), ('Administrador', 'view_technicians'), ('Gestor', 'view_technicians'), ('Supervisor', 'view_technicians'), ('Gerente de Sucursal', 'view_technicians'), ('Visualizador', 'view_technicians'),
    ('Superadministrador', 'create_technicians'), ('Administrador', 'create_technicians'), ('Gestor', 'create_technicians'), ('Supervisor', 'create_technicians'), ('Gerente de Sucursal', 'create_technicians'),
    ('Superadministrador', 'edit_technicians'), ('Administrador', 'edit_technicians'), ('Gestor', 'edit_technicians'), ('Supervisor', 'edit_technicians'), ('Gerente de Sucursal', 'edit_technicians'),
    ('Superadministrador', 'delete_technicians'), ('Administrador', 'delete_technicians'),
    ('Superadministrador', 'upload_docs_technician'), ('Administrador', 'upload_docs_technician'), ('Gestor', 'upload_docs_technician'), ('Supervisor', 'upload_docs_technician'), ('Gerente de Sucursal', 'upload_docs_technician'),
    ('Superadministrador', 'download_docs_technician'), ('Administrador', 'download_docs_technician'), ('Gestor', 'download_docs_technician'), ('Supervisor', 'download_docs_technician'), ('Gerente de Sucursal', 'download_docs_technician'), ('Visualizador', 'download_docs_technician'),
    
    -- Empresas
    ('Superadministrador', 'view_companies'), ('Administrador', 'view_companies'), ('Gestor', 'view_companies'), ('Supervisor', 'view_companies'), ('Gerente de Sucursal', 'view_companies'), ('Visualizador', 'view_companies'),
    ('Superadministrador', 'create_companies'), ('Administrador', 'create_companies'), ('Gestor', 'create_companies'),
    ('Superadministrador', 'edit_companies'), ('Administrador', 'edit_companies'), ('Gestor', 'edit_companies'), ('Supervisor', 'edit_companies'),
    ('Superadministrador', 'delete_companies'), ('Administrador', 'delete_companies'),
    ('Superadministrador', 'manage_requirements'), ('Administrador', 'manage_requirements'), ('Gestor', 'manage_requirements'), ('Supervisor', 'manage_requirements'),
    
    -- Documentos
    ('Superadministrador', 'view_documents'), ('Administrador', 'view_documents'), ('Gestor', 'view_documents'), ('Supervisor', 'view_documents'), ('Gerente de Sucursal', 'view_documents'), ('Visualizador', 'view_documents'),
    ('Superadministrador', 'upload_documents'), ('Administrador', 'upload_documents'), ('Gestor', 'upload_documents'), ('Supervisor', 'upload_documents'), ('Gerente de Sucursal', 'upload_documents'),
    ('Superadministrador', 'delete_documents'), ('Administrador', 'delete_documents'),
    ('Superadministrador', 'certify_portal'), ('Administrador', 'certify_portal'), ('Gestor', 'certify_portal'), ('Supervisor', 'certify_portal'),
    
    -- Configuración
    ('Superadministrador', 'view_parameters'), ('Administrador', 'view_parameters'), ('Gestor', 'view_parameters'), ('Supervisor', 'view_parameters'), ('Visualizador', 'view_parameters'),
    ('Superadministrador', 'edit_parameters'), ('Administrador', 'edit_parameters'),
    ('Superadministrador', 'manage_users'), ('Administrador', 'manage_users'),
    ('Superadministrador', 'view_audit'), ('Administrador', 'view_audit'),
    
    -- Seguridad
    ('Superadministrador', 'view_portal_passwords'), ('Administrador', 'view_portal_passwords'), ('Gestor', 'view_portal_passwords'), ('Supervisor', 'view_portal_passwords'), ('Gerente de Sucursal', 'view_portal_passwords'),
    ('Superadministrador', 'view_access_logs'), ('Administrador', 'view_access_logs'),
    ('Superadministrador', 'block_technicians'), ('Administrador', 'block_technicians'), ('Gestor', 'block_technicians'), ('Supervisor', 'block_technicians'), ('Gerente de Sucursal', 'block_technicians'),
    
    -- Reportes
    ('Superadministrador', 'view_dashboard'), ('Administrador', 'view_dashboard'), ('Gestor', 'view_dashboard'), ('Supervisor', 'view_dashboard'), ('Gerente de Sucursal', 'view_dashboard'), ('Visualizador', 'view_dashboard'),
    ('Superadministrador', 'download_reports'), ('Administrador', 'download_reports'), ('Gestor', 'download_reports'), ('Supervisor', 'download_reports'), ('Gerente de Sucursal', 'download_reports'), ('Visualizador', 'download_reports'),
    ('Superadministrador', 'use_ai'), ('Administrador', 'use_ai'), ('Gestor', 'use_ai'), ('Supervisor', 'use_ai'), ('Gerente de Sucursal', 'use_ai'), ('Visualizador', 'use_ai')
    ON CONFLICT DO NOTHING;
END $$;
