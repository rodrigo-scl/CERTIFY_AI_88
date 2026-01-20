-- ============================================================
-- CERTIFY AI - Script de Instalación #3: Funciones RPC
-- Versión: 1.0
-- Autor: Rodrigo Osorio
-- Fecha: Enero 2026
-- ============================================================
-- Ejecutar DESPUÉS de 02-tables.sql
-- ============================================================

-- ============================================================
-- FUNCIONES DE ENCRIPTACIÓN
-- ============================================================

-- Función para encriptar datos sensibles
CREATE OR REPLACE FUNCTION public.encrypt_rut(plain_text TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  IF plain_text IS NULL OR plain_text = '' THEN
    RETURN NULL;
  END IF;
  
  encryption_key := current_setting('app.encryption_key', true);
  IF encryption_key IS NULL OR encryption_key = '' THEN
    encryption_key := 'certify-ai-rut-key-2026';
  END IF;
  
  RETURN pgp_sym_encrypt(plain_text, encryption_key);
END;
$$;

-- Función para desencriptar datos sensibles
CREATE OR REPLACE FUNCTION public.decrypt_rut(encrypted_rut BYTEA)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- SEGURIDAD: Verificar que hay un usuario autenticado
  IF auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Acceso no autorizado: Se requiere sesión activa.';
  END IF;

  IF encrypted_rut IS NULL THEN
    RETURN NULL;
  END IF;
  
  encryption_key := current_setting('app.encryption_key', true);
  IF encryption_key IS NULL OR encryption_key = '' THEN
    encryption_key := 'certify-ai-rut-key-2026';
  END IF;
  
  RETURN pgp_sym_decrypt(encrypted_rut, encryption_key);
EXCEPTION WHEN OTHERS THEN
  RETURN '[Error de seguridad/acceso]';
END;
$$;

-- ============================================================
-- TRIGGERS DE ENCRIPTACIÓN
-- ============================================================

-- Trigger para encriptar datos de empresas
CREATE OR REPLACE FUNCTION public.encrypt_company_data_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.name IS NOT NULL 
     AND NEW.name != '' 
     AND NEW.name NOT LIKE '[%ENCRIPTADO%]' THEN
    NEW.name_encrypted := encrypt_rut(NEW.name);
  END IF;
  IF NEW.rut IS NOT NULL 
     AND NEW.rut != '' 
     AND NEW.rut NOT LIKE 'XX%' 
     AND NEW.rut NOT LIKE '77.XXX%' THEN
    NEW.rut_encrypted := encrypt_rut(NEW.rut);
  END IF;
  IF NEW.address IS NOT NULL AND NEW.address != '' THEN
    NEW.address_encrypted := encrypt_rut(NEW.address);
  END IF;
  IF NEW.contact_name IS NOT NULL AND NEW.contact_name != '' THEN
    NEW.contact_name_encrypted := encrypt_rut(NEW.contact_name);
  END IF;
  IF NEW.contact_email IS NOT NULL AND NEW.contact_email != '' THEN
    NEW.contact_email_encrypted := encrypt_rut(NEW.contact_email);
  END IF;
  IF NEW.contact_phone IS NOT NULL AND NEW.contact_phone != '' THEN
    NEW.contact_phone_encrypted := encrypt_rut(NEW.contact_phone);
  END IF;
  IF NEW.portal_user IS NOT NULL AND NEW.portal_user != '' THEN
    NEW.portal_user_encrypted := encrypt_rut(NEW.portal_user);
  END IF;
  IF NEW.portal_password IS NOT NULL AND NEW.portal_password != '' THEN
    NEW.portal_password_encrypted := encrypt_rut(NEW.portal_password);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger para encriptar datos de técnicos
CREATE OR REPLACE FUNCTION public.encrypt_technician_data_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.name IS NOT NULL AND NEW.name != '' THEN
    NEW.name_encrypted := encrypt_rut(NEW.name);
  END IF;
  IF NEW.rut IS NOT NULL AND NEW.rut != '' THEN
    NEW.rut_encrypted := encrypt_rut(NEW.rut);
  END IF;
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN
    NEW.email_encrypted := encrypt_rut(NEW.email);
  END IF;
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    NEW.phone_encrypted := encrypt_rut(NEW.phone);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger para encriptar datos de EPS
CREATE OR REPLACE FUNCTION public.encrypt_service_provider_data_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.name IS NOT NULL AND NEW.name != '' THEN
    NEW.name_encrypted := encrypt_rut(NEW.name);
  END IF;
  IF NEW.rut IS NOT NULL AND NEW.rut != '' THEN
    NEW.rut_encrypted := encrypt_rut(NEW.rut);
  END IF;
  IF NEW.contact_email IS NOT NULL AND NEW.contact_email != '' THEN
    NEW.contact_email_encrypted := encrypt_rut(NEW.contact_email);
  END IF;
  IF NEW.contact_phone IS NOT NULL AND NEW.contact_phone != '' THEN
    NEW.contact_phone_encrypted := encrypt_rut(NEW.contact_phone);
  END IF;
  IF NEW.address IS NOT NULL AND NEW.address != '' THEN
    NEW.address_encrypted := encrypt_rut(NEW.address);
  END IF;
  RETURN NEW;
END;
$$;

-- Interceptor para limpiar datos planos después de encriptar (companies)
CREATE OR REPLACE FUNCTION public.intercept_company_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Limpiar campos planos después de encriptar
  NEW.name := NULL;
  NEW.rut := NULL;
  NEW.address := NULL;
  NEW.contact_name := NULL;
  NEW.contact_email := NULL;
  NEW.contact_phone := NULL;
  NEW.portal_user := NULL;
  NEW.portal_password := NULL;
  RETURN NEW;
END;
$$;

-- Interceptor para limpiar datos planos después de encriptar (technicians)
CREATE OR REPLACE FUNCTION public.intercept_technician_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.name := NULL;
  NEW.rut := NULL;
  NEW.email := NULL;
  NEW.phone := NULL;
  RETURN NEW;
END;
$$;

-- ============================================================
-- FUNCIONES DE ACTUALIZACIÓN DE TIMESTAMPS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_supplier_portals_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ============================================================
-- FUNCIONES RPC PARA CONSULTAS SEGURAS
-- ============================================================

-- Obtener empresas con datos desencriptados (lista ligera)
CREATE OR REPLACE FUNCTION public.get_companies_light()
RETURNS TABLE (
  id UUID,
  name TEXT,
  rut TEXT,
  industry TEXT,
  type TEXT,
  holding_id UUID,
  logo_url TEXT,
  supplier_portal_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Acceso no autorizado';
  END IF;

  RETURN QUERY
  SELECT 
    c.id,
    decrypt_rut(c.name_encrypted) as name,
    decrypt_rut(c.rut_encrypted) as rut,
    c.industry,
    c.type,
    c.holding_id,
    c.logo_url,
    c.supplier_portal_id
  FROM companies c
  ORDER BY decrypt_rut(c.name_encrypted);
END;
$$;

-- Obtener empresas con todos los datos desencriptados
CREATE OR REPLACE FUNCTION public.get_companies_decrypted()
RETURNS TABLE (
  id UUID,
  name TEXT,
  rut TEXT,
  industry TEXT,
  type TEXT,
  holding_id UUID,
  logo_url TEXT,
  address TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  portal_user TEXT,
  portal_password TEXT,
  supplier_portal_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Acceso no autorizado';
  END IF;

  RETURN QUERY
  SELECT 
    c.id,
    decrypt_rut(c.name_encrypted),
    decrypt_rut(c.rut_encrypted),
    c.industry,
    c.type,
    c.holding_id,
    c.logo_url,
    decrypt_rut(c.address_encrypted),
    decrypt_rut(c.contact_name_encrypted),
    decrypt_rut(c.contact_email_encrypted),
    decrypt_rut(c.contact_phone_encrypted),
    decrypt_rut(c.portal_user_encrypted),
    decrypt_rut(c.portal_password_encrypted),
    c.supplier_portal_id,
    c.created_at
  FROM companies c
  ORDER BY decrypt_rut(c.name_encrypted);
END;
$$;

-- Obtener técnicos con datos desencriptados
CREATE OR REPLACE FUNCTION public.get_technicians_decrypted()
RETURNS TABLE (
  id UUID,
  name TEXT,
  rut TEXT,
  email TEXT,
  phone TEXT,
  branch_id UUID,
  technician_type_id UUID,
  role TEXT,
  is_active BOOLEAN,
  compliance_score INTEGER,
  overall_status TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Acceso no autorizado';
  END IF;

  RETURN QUERY
  SELECT 
    t.id,
    decrypt_rut(t.name_encrypted),
    decrypt_rut(t.rut_encrypted),
    decrypt_rut(t.email_encrypted),
    decrypt_rut(t.phone_encrypted),
    t.branch_id,
    t.technician_type_id,
    t.role,
    t.is_active,
    t.compliance_score,
    t.overall_status,
    t.avatar_url,
    t.created_at
  FROM technicians t
  ORDER BY decrypt_rut(t.name_encrypted);
END;
$$;

-- ============================================================
-- FUNCIÓN DE RECÁLCULO AUTOMÁTICO DE ESTADOS
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_credential_statuses()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Actualizar estados de credenciales basado en fechas de vencimiento
  
  -- EXPIRED: Fecha de vencimiento pasada
  UPDATE credentials
  SET status = 'EXPIRED'
  WHERE expiry_date < CURRENT_DATE
    AND status != 'EXPIRED';

  -- EXPIRING_SOON: Vence en los próximos 30 días
  UPDATE credentials
  SET status = 'EXPIRING_SOON'
  WHERE expiry_date >= CURRENT_DATE
    AND expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    AND status NOT IN ('EXPIRED', 'EXPIRING_SOON');

  -- VALID: Fecha de vencimiento a más de 30 días
  UPDATE credentials
  SET status = 'VALID'
  WHERE expiry_date > CURRENT_DATE + INTERVAL '30 days'
    AND file_url IS NOT NULL
    AND status NOT IN ('VALID');

  -- Recalcular estados generales de técnicos
  
  -- Si tienen EXPIRED, marcar como EXPIRED
  UPDATE technicians t
  SET overall_status = 'EXPIRED'
  WHERE EXISTS (
    SELECT 1 FROM credentials c 
    WHERE c.technician_id = t.id AND c.status = 'EXPIRED'
  )
  AND t.overall_status != 'EXPIRED';

  -- Si tienen MISSING (sin archivo), marcar como MISSING
  UPDATE technicians t
  SET overall_status = 'MISSING'
  WHERE EXISTS (
    SELECT 1 FROM credentials c 
    WHERE c.technician_id = t.id AND c.status = 'MISSING'
  )
  AND NOT EXISTS (
    SELECT 1 FROM credentials c 
    WHERE c.technician_id = t.id AND c.status = 'EXPIRED'
  )
  AND t.overall_status != 'MISSING';

  -- Si tienen PENDING, marcar como PENDING
  UPDATE technicians t
  SET overall_status = 'PENDING'
  WHERE NOT EXISTS (
    SELECT 1 FROM credentials c 
    WHERE c.technician_id = t.id AND c.status IN ('EXPIRED', 'MISSING')
  )
  AND EXISTS (
    SELECT 1 FROM credentials c 
    WHERE c.technician_id = t.id AND c.status = 'PENDING'
  )
  AND t.overall_status NOT IN ('EXPIRED', 'MISSING', 'PENDING');

  -- Si tienen EXPIRING_SOON, marcar como EXPIRING_SOON
  UPDATE technicians t
  SET overall_status = 'EXPIRING_SOON'
  WHERE NOT EXISTS (
    SELECT 1 FROM credentials c 
    WHERE c.technician_id = t.id AND c.status IN ('EXPIRED', 'MISSING', 'PENDING')
  )
  AND EXISTS (
    SELECT 1 FROM credentials c 
    WHERE c.technician_id = t.id AND c.status = 'EXPIRING_SOON'
  )
  AND t.overall_status != 'EXPIRING_SOON';

  -- Si todos están VALID, marcar como VALID
  UPDATE technicians t
  SET overall_status = 'VALID'
  WHERE NOT EXISTS (
    SELECT 1 FROM credentials c 
    WHERE c.technician_id = t.id AND c.status IN ('EXPIRED', 'MISSING', 'PENDING', 'EXPIRING_SOON')
  )
  AND EXISTS (
    SELECT 1 FROM credentials c 
    WHERE c.technician_id = t.id
  )
  AND t.overall_status != 'VALID';

END;
$$;

-- ============================================================
-- Verificación
-- ============================================================
-- SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace;
-- ============================================================
