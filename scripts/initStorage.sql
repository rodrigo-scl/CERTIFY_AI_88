-- Script SQL para inicializar buckets de Storage - Rodrigo Osorio v0.2
-- Ejecutar este script en el editor SQL de Supabase Dashboard

-- Crear bucket para documentos de técnicos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'technician-docs',
  'technician-docs',
  true, -- Bucket publico para permitir acceso via getPublicUrl
  10485760, -- 10MB en bytes
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Crear bucket para documentos de empresas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-docs',
  'company-docs',
  true, -- Bucket publico para permitir acceso via getPublicUrl
  10485760, -- 10MB en bytes
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas RLS para technician-docs
-- Eliminar políticas existentes si existen (para evitar errores al re-ejecutar)
DROP POLICY IF EXISTS "Permitir descarga de documentos de técnicos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir subida de documentos de técnicos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir actualización de documentos de técnicos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir eliminación de documentos de técnicos" ON storage.objects;

-- Permitir SELECT (descargar) a usuarios autenticados
-- Nota: Los archivos son publicos por URL, pero las operaciones requieren autenticacion
CREATE POLICY "Permitir descarga de documentos de técnicos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'technician-docs');

-- Permitir INSERT (subir) a usuarios autenticados
-- Restriccion: Solo archivos dentro del bucket correcto
CREATE POLICY "Permitir subida de documentos de técnicos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'technician-docs' 
  AND (storage.foldername(name))[1] IS NOT NULL  -- Debe tener carpeta (technicianId)
);

-- Permitir UPDATE (actualizar) a usuarios autenticados
-- Restriccion: Solo dentro del mismo bucket
CREATE POLICY "Permitir actualización de documentos de técnicos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'technician-docs')
WITH CHECK (bucket_id = 'technician-docs');

-- Permitir DELETE (eliminar) a usuarios autenticados
-- Restriccion: Solo archivos del bucket correcto
CREATE POLICY "Permitir eliminación de documentos de técnicos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'technician-docs');

-- Políticas RLS para company-docs
-- Eliminar políticas existentes si existen (para evitar errores al re-ejecutar)
DROP POLICY IF EXISTS "Permitir descarga de documentos de empresas" ON storage.objects;
DROP POLICY IF EXISTS "Permitir subida de documentos de empresas" ON storage.objects;
DROP POLICY IF EXISTS "Permitir actualización de documentos de empresas" ON storage.objects;
DROP POLICY IF EXISTS "Permitir eliminación de documentos de empresas" ON storage.objects;

-- Permitir SELECT (descargar) a usuarios autenticados
CREATE POLICY "Permitir descarga de documentos de empresas"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'company-docs');

-- Permitir INSERT (subir) a usuarios autenticados
-- Restriccion: Solo archivos dentro del bucket correcto con carpeta
CREATE POLICY "Permitir subida de documentos de empresas"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-docs'
  AND (storage.foldername(name))[1] IS NOT NULL  -- Debe tener carpeta (companyId)
);

-- Permitir UPDATE (actualizar) a usuarios autenticados
-- Restriccion: Solo dentro del mismo bucket
CREATE POLICY "Permitir actualización de documentos de empresas"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'company-docs')
WITH CHECK (bucket_id = 'company-docs');

-- Permitir DELETE (eliminar) a usuarios autenticados
-- Restriccion: Solo archivos del bucket correcto
CREATE POLICY "Permitir eliminación de documentos de empresas"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'company-docs');

