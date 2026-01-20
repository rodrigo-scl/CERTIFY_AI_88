-- ============================================================
-- CERTIFY AI - Script de Instalación #5: Vistas Seguras
-- Versión: 1.0
-- Autor: Rodrigo Osorio
-- Fecha: Enero 2026
-- ============================================================
-- Ejecutar DESPUÉS de 04-triggers.sql
-- ============================================================

-- ============================================================
-- VISTAS SEGURAS CON DESENCRIPTACIÓN
-- ============================================================

-- Vista segura de empresas (desencripta datos automáticamente)
CREATE OR REPLACE VIEW public.companies_secure AS
SELECT 
    id,
    decrypt_rut(name_encrypted) AS name,
    decrypt_rut(rut_encrypted) AS rut,
    industry,
    type,
    holding_id,
    logo_url,
    decrypt_rut(address_encrypted) AS address,
    decrypt_rut(contact_name_encrypted) AS contact_name,
    decrypt_rut(contact_email_encrypted) AS contact_email,
    decrypt_rut(contact_phone_encrypted) AS contact_phone,
    decrypt_rut(portal_user_encrypted) AS portal_user,
    decrypt_rut(portal_password_encrypted) AS portal_password,
    created_at,
    supplier_portal_id
FROM companies;

-- Vista segura de técnicos (desencripta datos automáticamente)
CREATE OR REPLACE VIEW public.technicians_secure AS
SELECT 
    id,
    decrypt_rut(name_encrypted) AS name,
    decrypt_rut(rut_encrypted) AS rut,
    decrypt_rut(email_encrypted) AS email,
    decrypt_rut(phone_encrypted) AS phone,
    branch_id,
    technician_type_id,
    role,
    is_active,
    compliance_score,
    overall_status,
    avatar_url,
    created_at
FROM technicians;

-- ============================================================
-- NOTA IMPORTANTE SOBRE LAS VISTAS
-- ============================================================
-- Estas vistas usan SECURITY DEFINER en la función decrypt_rut
-- lo que significa que solo usuarios autenticados pueden ver
-- los datos desencriptados.
--
-- Para usar las vistas:
-- SELECT * FROM companies_secure;
-- SELECT * FROM technicians_secure;
--
-- Si necesitas acceso desde RPC, usa las funciones:
-- SELECT * FROM get_companies_decrypted();
-- SELECT * FROM get_technicians_decrypted();
-- ============================================================
