-- ============================================================
-- CERTIFY AI - Script de Instalación #6: Políticas RLS
-- Versión: 1.0
-- Autor: Rodrigo Osorio
-- Fecha: Enero 2026
-- ============================================================
-- Ejecutar DESPUÉS de 05-views.sql
-- ============================================================

-- ============================================================
-- POLÍTICAS PARA CATÁLOGOS BASE
-- ============================================================

-- Industries
CREATE POLICY "Allow authenticated users to manage industries"
ON public.industries FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Technician Types
CREATE POLICY "Allow authenticated users to manage technician_types"
ON public.technician_types FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Work Areas
CREATE POLICY "Allow authenticated users to manage work_areas"
ON public.work_areas FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Areas
CREATE POLICY "Users can read areas"
ON public.areas FOR SELECT
TO public
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert areas"
ON public.areas FOR INSERT
TO public
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update areas"
ON public.areas FOR UPDATE
TO public
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete areas"
ON public.areas FOR DELETE
TO public
USING (auth.role() = 'authenticated');

-- ============================================================
-- POLÍTICAS PARA ORGANIZACIÓN
-- ============================================================

-- Branches
CREATE POLICY "Allow authenticated users to manage branches"
ON public.branches FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- App Users
CREATE POLICY "Perfiles visibles para autenticados"
ON public.app_users FOR SELECT
TO public
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated select on app_users"
ON public.app_users FOR SELECT
TO authenticated
USING (true);

-- User Branches
CREATE POLICY "Users can view their own branch assignments"
ON public.user_branches FOR SELECT
TO public
USING (user_id IN (
    SELECT app_users.id FROM app_users
    WHERE app_users.email = (auth.jwt() ->> 'email')
));

CREATE POLICY "Admins can manage user branches"
ON public.user_branches FOR ALL
TO public
USING (EXISTS (
    SELECT 1 FROM app_users
    WHERE app_users.email = (auth.jwt() ->> 'email')
    AND (app_users.role = 'Administrador' OR app_users.role = 'Superadministrador')
));

-- ============================================================
-- POLÍTICAS PARA PORTALES Y PROVEEDORES
-- ============================================================

-- Supplier Portals
CREATE POLICY "Allow authenticated users to manage supplier_portals"
ON public.supplier_portals FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Service Providers
CREATE POLICY "Allow authenticated users to manage service_providers"
ON public.service_providers FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================================
-- POLÍTICAS PARA EMPRESAS
-- ============================================================

-- Companies (datos encriptados)
CREATE POLICY "Allow authenticated select on companies"
ON public.companies FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated insert on companies"
ON public.companies FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update on companies"
ON public.companies FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated delete on companies"
ON public.companies FOR DELETE
TO authenticated
USING (true);

-- Company Service Providers
CREATE POLICY "Allow authenticated users to manage company_service_providers"
ON public.company_service_providers FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================================
-- POLÍTICAS PARA TÉCNICOS
-- ============================================================

-- Technicians (datos encriptados)
CREATE POLICY "Allow authenticated select on technicians"
ON public.technicians FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated insert on technicians"
ON public.technicians FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update on technicians"
ON public.technicians FOR UPDATE
TO authenticated
USING (true);

-- Technician Companies
CREATE POLICY "Allow authenticated users to manage technician_companies"
ON public.technician_companies FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Technician Service Providers
CREATE POLICY "Allow authenticated users to manage technician_service_providers"
ON public.technician_service_providers FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Technician Absences
CREATE POLICY "Allow authenticated users to manage technician_absences"
ON public.technician_absences FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================================
-- POLÍTICAS PARA DOCUMENTOS
-- ============================================================

-- Document Types
CREATE POLICY "Allow authenticated users to manage document_types"
ON public.document_types FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Credentials
CREATE POLICY "Allow authenticated users to manage credentials"
ON public.credentials FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Company Credentials
CREATE POLICY "Allow authenticated users to manage company_credentials"
ON public.company_credentials FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Company Requirements
CREATE POLICY "Allow authenticated users to manage company_requirements"
ON public.company_requirements FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================================
-- POLÍTICAS PARA SISTEMA
-- ============================================================

-- System Settings
CREATE POLICY "Allow authenticated users to manage system_settings"
ON public.system_settings FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- AI Usage
CREATE POLICY "Allow authenticated users to manage ai_usage"
ON public.ai_usage FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Download Audits
CREATE POLICY "Allow authenticated users to manage download_audits"
ON public.download_audits FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Holidays
CREATE POLICY "Allow authenticated users to manage holidays"
ON public.holidays FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================================
-- Verificación
-- ============================================================
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
-- Resultado esperado: 35+ políticas
-- ============================================================
