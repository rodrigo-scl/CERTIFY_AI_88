-- ============================================================
-- CERTIFY AI - Script de Actualización de Seguridad #9
-- Versión: 1.1
-- Autor: Rodrigo Osorio
-- Fecha: Enero 2026
-- ============================================================
-- IMPORTANTE: Ejecutar DESPUÉS de verificar que la app funciona
-- con los cambios de Edge Functions
-- ============================================================

-- ============================================================
-- PASO 1: Cambiar buckets a privados
-- ============================================================
-- NOTA: Esto requiere que TODAS las URLs de archivos se generen
-- con signedUrl en lugar de getPublicUrl

UPDATE storage.buckets 
SET public = false 
WHERE id IN ('technician-docs', 'company-docs');

-- ============================================================
-- PASO 2: Tabla de Auditoría de Acceso a Contraseñas
-- ============================================================
-- Registra quién ve contraseñas de portales de proveedores

CREATE TABLE IF NOT EXISTS public.password_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_email TEXT NOT NULL,
    user_name TEXT,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('supplier_portal', 'company')),
    entity_id UUID NOT NULL,
    entity_name TEXT NOT NULL,
    accessed_at TIMESTAMPTZ DEFAULT now(),
    ip_address TEXT,
    user_agent TEXT
);

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_password_access_log_user ON public.password_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_password_access_log_entity ON public.password_access_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_password_access_log_date ON public.password_access_log(accessed_at DESC);

-- Habilitar RLS
ALTER TABLE public.password_access_log ENABLE ROW LEVEL SECURITY;

-- Política: Cualquier usuario autenticado puede insertar (registrar su propio acceso)
DROP POLICY IF EXISTS "Users can log their own password access" ON public.password_access_log;
CREATE POLICY "Users can log their own password access"
ON public.password_access_log FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política: Solo admins pueden ver el log completo
DROP POLICY IF EXISTS "Admins can view password access logs" ON public.password_access_log;
CREATE POLICY "Admins can view password access logs"
ON public.password_access_log FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM app_users 
    WHERE email = auth.jwt()->>'email' 
    AND role IN ('Administrador', 'Superadministrador')
));

-- Comentario de documentación
COMMENT ON TABLE public.password_access_log IS 'Registro de auditoría para acceso a contraseñas de portales de proveedores';

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- Ejecutar para confirmar el cambio:
-- SELECT id, name, public FROM storage.buckets;
-- Resultado esperado: public = false para ambos buckets

-- ============================================================
-- ROLLBACK (si algo falla)
-- ============================================================
-- UPDATE storage.buckets SET public = true WHERE id IN ('technician-docs', 'company-docs');
-- DROP TABLE IF EXISTS public.password_access_log;
