-- ============================================================
-- CERTIFY AI - Script de Instalación #2: Tablas
-- Versión: 1.0
-- Autor: Rodrigo Osorio
-- Fecha: Enero 2026
-- ============================================================
-- Ejecutar DESPUÉS de 01-extensions.sql
-- ============================================================

-- ============================================================
-- CATÁLOGOS BASE
-- ============================================================

-- Industrias
CREATE TABLE IF NOT EXISTS public.industries (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tipos de Técnicos
CREATE TABLE IF NOT EXISTS public.technician_types (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Áreas de Trabajo (con SLA)
CREATE TABLE IF NOT EXISTS public.work_areas (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    sla_days INTEGER DEFAULT 30,
    sla_type TEXT CHECK (sla_type IN ('CALENDAR', 'BUSINESS')),
    criticality TEXT CHECK (criticality IN ('HIGH', 'MEDIUM', 'LOW')),
    compliance_score INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Áreas Organizacionales
CREATE TABLE IF NOT EXISTS public.areas (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ORGANIZACIÓN
-- ============================================================

-- Sucursales
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    technician_count INTEGER DEFAULT 0,
    compliance_score INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Usuarios de la Aplicación
CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'Usuario',
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Relación Usuario-Sucursales (para Gerente de Sucursal)
CREATE TABLE IF NOT EXISTS public.user_branches (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, branch_id)
);

-- ============================================================
-- PORTALES Y PROVEEDORES
-- ============================================================

-- Portales de Proveedores
CREATE TABLE IF NOT EXISTS public.supplier_portals (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT,
    username TEXT,
    password TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Empresas Prestadoras de Servicio (EPS)
CREATE TABLE IF NOT EXISTS public.service_providers (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    -- Campos encriptados
    name_encrypted BYTEA,
    rut_encrypted BYTEA,
    contact_email_encrypted BYTEA,
    contact_phone_encrypted BYTEA,
    address_encrypted BYTEA,
    -- Campos legacy (mantener vacíos, solo para retrocompatibilidad)
    name TEXT,
    rut TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,
    -- Otros campos
    industry TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- EMPRESAS CLIENTES
-- ============================================================

-- Empresas (con campos encriptados)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    -- Campos encriptados
    name_encrypted BYTEA,
    rut_encrypted BYTEA,
    address_encrypted BYTEA,
    contact_name_encrypted BYTEA,
    contact_email_encrypted BYTEA,
    contact_phone_encrypted BYTEA,
    portal_user_encrypted BYTEA,
    portal_password_encrypted BYTEA,
    -- Campos legacy (mantener vacíos)
    name TEXT,
    rut TEXT,
    address TEXT,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    portal_user TEXT,
    portal_password TEXT,
    -- Otros campos
    industry TEXT,
    type TEXT DEFAULT 'SUBSIDIARY' CHECK (type IN ('HOLDING', 'SUBSIDIARY')),
    holding_id UUID REFERENCES public.companies(id),
    logo_url TEXT,
    supplier_portal_id UUID REFERENCES public.supplier_portals(id),
    portal_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Relación Empresa-EPS
CREATE TABLE IF NOT EXISTS public.company_service_providers (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    service_provider_id UUID NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
    contract_start DATE,
    contract_end DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_id, service_provider_id)
);

-- ============================================================
-- TÉCNICOS
-- ============================================================

-- Técnicos (con campos encriptados)
CREATE TABLE IF NOT EXISTS public.technicians (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    -- Campos encriptados
    name_encrypted BYTEA,
    rut_encrypted BYTEA,
    email_encrypted BYTEA,
    phone_encrypted BYTEA,
    -- Campos legacy (mantener vacíos)
    name TEXT,
    rut TEXT,
    email TEXT,
    phone TEXT,
    -- Otros campos
    branch_id UUID REFERENCES public.branches(id),
    technician_type_id UUID REFERENCES public.technician_types(id),
    role TEXT,
    is_active BOOLEAN DEFAULT true,
    compliance_score INTEGER DEFAULT 100,
    overall_status TEXT DEFAULT 'MISSING' CHECK (overall_status IN ('VALID', 'EXPIRING_SOON', 'EXPIRED', 'MISSING', 'PENDING')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Relación Técnico-Empresas
CREATE TABLE IF NOT EXISTS public.technician_companies (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    technician_id UUID NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    is_blocked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(technician_id, company_id)
);

-- Relación Técnico-EPS
CREATE TABLE IF NOT EXISTS public.technician_service_providers (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    technician_id UUID NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
    service_provider_id UUID NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
    joined_at DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(technician_id, service_provider_id)
);

-- Ausencias de Técnicos
CREATE TABLE IF NOT EXISTS public.technician_absences (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    technician_id UUID NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('VACATION', 'MEDICAL_LEAVE', 'OTHER')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- DOCUMENTOS Y CREDENCIALES
-- ============================================================

-- Tipos de Documentos
CREATE TABLE IF NOT EXISTS public.document_types (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    area_id UUID REFERENCES public.areas(id),
    scope TEXT DEFAULT 'TECHNICIAN' CHECK (scope IN ('TECHNICIAN', 'COMPANY')),
    is_global BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    renewal_type TEXT DEFAULT 'PERIODIC' CHECK (renewal_type IN ('FIXED', 'PERIODIC')),
    renewal_frequency INTEGER,
    renewal_unit TEXT CHECK (renewal_unit IN ('DAYS', 'MONTHS')),
    renewal_day_of_month INTEGER,
    validity_days INTEGER DEFAULT 365,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Credenciales de Técnicos
CREATE TABLE IF NOT EXISTS public.credentials (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    technician_id UUID NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
    document_type_id UUID NOT NULL REFERENCES public.document_types(id),
    file_url TEXT,
    issue_date DATE,
    expiry_date DATE,
    status TEXT DEFAULT 'MISSING' CHECK (status IN ('VALID', 'EXPIRING_SOON', 'EXPIRED', 'MISSING', 'PENDING')),
    portal_certified_at TIMESTAMPTZ,
    portal_certified_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Credenciales de Empresas
CREATE TABLE IF NOT EXISTS public.company_credentials (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    document_type_id UUID NOT NULL REFERENCES public.document_types(id),
    file_url TEXT,
    issue_date DATE,
    expiry_date DATE,
    status TEXT DEFAULT 'MISSING' CHECK (status IN ('VALID', 'EXPIRING_SOON', 'EXPIRED', 'MISSING', 'PENDING')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Requerimientos por Empresa
CREATE TABLE IF NOT EXISTS public.company_requirements (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    document_type_id UUID NOT NULL REFERENCES public.document_types(id),
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_id, document_type_id)
);

-- ============================================================
-- SISTEMA
-- ============================================================

-- Configuración del Sistema
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Control de Uso de IA
CREATE TABLE IF NOT EXISTS public.ai_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    query_count INTEGER DEFAULT 0,
    last_query_at TIMESTAMPTZ,
    reset_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Auditoría de Descargas
CREATE TABLE IF NOT EXISTS public.download_audits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    user_email_enc TEXT NOT NULL,
    action_type TEXT NOT NULL,
    resource_name_enc TEXT NOT NULL,
    resource_path_enc TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Feriados Nacionales
CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    is_recurring BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- VISTA MATERIALIZADA (para ranking de sucursales)
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.branch_compliance_ranking AS
SELECT 
    b.id,
    b.name,
    b.location,
    COUNT(t.id) as technician_count,
    COALESCE(AVG(t.compliance_score), 0) as avg_compliance_score,
    COUNT(CASE WHEN t.overall_status = 'VALID' THEN 1 END) as valid_count,
    COUNT(CASE WHEN t.overall_status = 'EXPIRED' THEN 1 END) as expired_count,
    COUNT(CASE WHEN t.overall_status = 'MISSING' THEN 1 END) as missing_count
FROM public.branches b
LEFT JOIN public.technicians t ON t.branch_id = b.id AND t.is_active = true
GROUP BY b.id, b.name, b.location;

-- Índice único para refresh concurrente
CREATE UNIQUE INDEX IF NOT EXISTS idx_branch_ranking_id ON public.branch_compliance_ranking(id);

-- ============================================================
-- HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================

ALTER TABLE public.industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_portals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_service_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_service_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Verificación
-- ============================================================
-- SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
-- Resultado esperado: 23+ tablas
-- ============================================================
