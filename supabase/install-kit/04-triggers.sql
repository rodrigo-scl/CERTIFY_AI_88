-- ============================================================
-- CERTIFY AI - Script de Instalación #4: Triggers
-- Versión: 1.0
-- Autor: Rodrigo Osorio
-- Fecha: Enero 2026
-- ============================================================
-- Ejecutar DESPUÉS de 03-functions.sql
-- ============================================================

-- ============================================================
-- TRIGGERS DE ENCRIPTACIÓN
-- ============================================================

-- Trigger para encriptar datos de empresas (INSERT y UPDATE)
DROP TRIGGER IF EXISTS trg_encrypt_company_data ON public.companies;
CREATE TRIGGER trg_encrypt_company_data
    BEFORE INSERT OR UPDATE ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION encrypt_company_data_trigger();

-- Trigger para limpiar datos planos de empresas
DROP TRIGGER IF EXISTS trg_intercept_company_insert ON public.companies;
CREATE TRIGGER trg_intercept_company_insert
    BEFORE INSERT OR UPDATE ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION intercept_company_insert();

-- Trigger para encriptar datos de técnicos (INSERT y UPDATE)
DROP TRIGGER IF EXISTS trg_encrypt_technician_data ON public.technicians;
CREATE TRIGGER trg_encrypt_technician_data
    BEFORE INSERT OR UPDATE ON public.technicians
    FOR EACH ROW
    EXECUTE FUNCTION encrypt_technician_data_trigger();

-- Trigger para limpiar datos planos de técnicos
DROP TRIGGER IF EXISTS trg_intercept_technician_insert ON public.technicians;
CREATE TRIGGER trg_intercept_technician_insert
    BEFORE INSERT OR UPDATE ON public.technicians
    FOR EACH ROW
    EXECUTE FUNCTION intercept_technician_insert();

-- Trigger para encriptar datos de EPS (INSERT y UPDATE)
DROP TRIGGER IF EXISTS trg_encrypt_service_provider_data ON public.service_providers;
CREATE TRIGGER trg_encrypt_service_provider_data
    BEFORE INSERT OR UPDATE ON public.service_providers
    FOR EACH ROW
    EXECUTE FUNCTION encrypt_service_provider_data_trigger();

-- ============================================================
-- TRIGGERS DE TIMESTAMPS
-- ============================================================

-- Trigger para actualizar updated_at en áreas
DROP TRIGGER IF EXISTS update_areas_updated_at ON public.areas;
CREATE TRIGGER update_areas_updated_at
    BEFORE UPDATE ON public.areas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para actualizar updated_at en portales de proveedores
DROP TRIGGER IF EXISTS trigger_update_supplier_portals_updated_at ON public.supplier_portals;
CREATE TRIGGER trigger_update_supplier_portals_updated_at
    BEFORE UPDATE ON public.supplier_portals
    FOR EACH ROW
    EXECUTE FUNCTION update_supplier_portals_updated_at();

-- ============================================================
-- Verificación
-- ============================================================
-- SELECT trigger_name, event_object_table FROM information_schema.triggers 
-- WHERE trigger_schema = 'public';
-- ============================================================
