# Tests de Integración - Sistema de Storage

Autor: Rodrigo Osorio  
Versión: 0.1

## Descripción

Este directorio contiene tests de integración completos para el sistema de almacenamiento de documentos (Supabase Storage).

## Requisitos Previos

Antes de ejecutar los tests, asegúrate de:

1. **Configurar Supabase Storage**
   - Ejecutar el script `scripts/initStorage.sql` en el SQL Editor de Supabase Dashboard
   - Esto creará los buckets necesarios y configurará las políticas RLS

2. **Verificar Credenciales**
   - Las credenciales en `services/supabaseClient.ts` deben ser válidas
   - Los buckets `technician-docs` y `company-docs` deben existir y ser públicos

3. **Instalar Dependencias**
   ```bash
   npm install
   ```

## Ejecutar Tests

### Modo único (ejecutar una vez)
```bash
npm test
```

### Modo watch (re-ejecutar al cambiar archivos)
```bash
npm run test:watch
```

### Con interfaz UI
```bash
npm run test:ui
```

## Cobertura de Tests

Los tests cubren los siguientes escenarios:

### 1. Validación de Archivos
- ✅ Rechazo de archivos sin tipo MIME
- ✅ Rechazo de archivos demasiado grandes (>10MB)
- ✅ Rechazo de extensiones no permitidas (.exe, etc.)
- ✅ Validación de coincidencia entre extensión y MIME type
- ✅ Verificación de firma de archivo (magic numbers)
- ✅ Aceptación de archivos válidos (PDF, JPG, PNG, DOC, DOCX)

### 2. Operaciones de Storage
- ✅ Upload de documentos de técnicos
- ✅ Upload de documentos de empresas
- ✅ Download de documentos
- ✅ Eliminación de documentos
- ✅ Reemplazo automático de archivos antiguos

### 3. Extracción de Paths
- ✅ Extracción correcta de path desde URLs
- ✅ Manejo de URLs inválidas

### 4. Rollback Transaccional
- ✅ Rollback automático si falla operación de BD
- ✅ Commit exitoso cuando todo funciona
- ✅ Limpieza de archivos huérfanos

### 5. Manejo de Errores
- ✅ Buckets inexistentes
- ✅ Archivos no encontrados
- ✅ Validaciones de entrada

## Limpieza Automática

Los tests crean archivos temporales durante su ejecución. El sistema de limpieza automática se encarga de:

- Eliminar todos los archivos de prueba al finalizar
- Registrar warnings si algún archivo no puede eliminarse
- Usar IDs únicos basados en timestamp para evitar colisiones

## Notas Importantes

1. **Timeout**: Los tests de integración tienen timeouts extendidos (15-20s) debido a operaciones de red
2. **Datos Reales**: Los tests interactúan con Supabase real, no mocks
3. **Limpieza**: Siempre se ejecuta el cleanup al finalizar los tests
4. **Logs**: Los tests generan logs estructurados que puedes revisar en la consola

## Troubleshooting

### Error: "Bucket not found"
- Ejecuta el script `scripts/initStorage.sql` en Supabase Dashboard

### Error: "Network error" o timeouts
- Verifica tu conexión a internet
- Confirma que las credenciales de Supabase son válidas
- Revisa que el proyecto de Supabase esté activo

### Tests fallan por validación de firma
- Asegúrate de que los archivos de prueba tienen las firmas correctas (magic numbers)
- Los tests crean archivos mínimos válidos automáticamente

## Próximos Pasos

Mejoras futuras para los tests:

- [ ] Tests de concurrencia (múltiples uploads simultáneos)
- [ ] Tests de límites de rate (throttling)
- [ ] Tests de permisos RLS con diferentes usuarios
- [ ] Tests de rendimiento (tiempo de upload/download)
- [ ] Mocks para testing sin conexión a Supabase

