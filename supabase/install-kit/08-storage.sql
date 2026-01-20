-- ============================================================
-- CERTIFY AI - Script de Instalación #8: Storage Buckets
-- Versión: 1.0
-- Autor: Rodrigo Osorio
-- Fecha: Enero 2026
-- ============================================================
-- Ejecutar DESPUÉS de 07-cron-jobs.sql
-- ============================================================

-- ============================================================
-- BUCKET 1: Documentos de Técnicos
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'technician-docs',
    'technician-docs',
    true,  -- público para acceso a URLs
    10485760,  -- 10MB límite
    ARRAY[
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/octet-stream'
    ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- BUCKET 2: Documentos de Empresas
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'company-docs',
    'company-docs',
    true,  -- público para acceso a URLs
    10485760,  -- 10MB límite
    ARRAY[
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/octet-stream'
    ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- POLÍTICAS DE STORAGE
-- ============================================================

-- Política para technician-docs: permitir acceso autenticado
CREATE POLICY "Allow authenticated uploads to technician-docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'technician-docs');

CREATE POLICY "Allow authenticated reads from technician-docs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'technician-docs');

CREATE POLICY "Allow authenticated updates to technician-docs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'technician-docs');

CREATE POLICY "Allow authenticated deletes from technician-docs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'technician-docs');

-- Política para company-docs: permitir acceso autenticado
CREATE POLICY "Allow authenticated uploads to company-docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-docs');

CREATE POLICY "Allow authenticated reads from company-docs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'company-docs');

CREATE POLICY "Allow authenticated updates to company-docs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'company-docs');

CREATE POLICY "Allow authenticated deletes from company-docs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'company-docs');

-- ============================================================
-- Verificación
-- ============================================================
-- SELECT * FROM storage.buckets;
-- Resultado esperado: 2 buckets (technician-docs, company-docs)
-- ============================================================
