# Scripts de Inicialización

Este directorio contiene scripts para inicializar y configurar los recursos necesarios del proyecto.

## Inicialización de Buckets de Storage

### Problema

Si recibes el error "Bucket not found" al intentar subir documentos, significa que los buckets de Supabase Storage no han sido creados.

### Solución Rápida (Recomendada)

**Usar el script SQL directamente en Supabase Dashboard:**

1. Ve al [Dashboard de Supabase](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **SQL Editor** en el menú lateral
4. Abre el archivo `scripts/initStorage.sql`
5. Copia y pega todo el contenido en el editor SQL
6. Haz clic en **Run** o presiona `Ctrl+Enter` (o `Cmd+Enter` en Mac)

Este script:
- ✅ Crea los buckets `technician-docs` y `company-docs` si no existen
- ✅ Configura los límites de tamaño (10MB) y tipos MIME permitidos
- ✅ Establece las políticas RLS (Row Level Security) para permitir operaciones a usuarios autenticados

### Solución Alternativa: Script TypeScript

Si prefieres usar el script TypeScript:

```bash
# Ejecutar el script de inicialización
npx tsx scripts/initStorage.ts
```

**Nota:** Este script requiere permisos adecuados. Si usas la `anon` key, puede que necesites usar la `service_role` key temporalmente para crear los buckets.

### Verificación

Después de ejecutar el script, puedes verificar que los buckets fueron creados:

1. Ve a **Storage** en el Dashboard de Supabase
2. Deberías ver dos buckets:
   - `technician-docs`
   - `company-docs`

### Políticas de Seguridad

Los buckets están configurados como **privados** y solo permiten operaciones a usuarios autenticados:

- ✅ SELECT (descargar documentos)
- ✅ INSERT (subir documentos)
- ✅ UPDATE (actualizar documentos)
- ✅ DELETE (eliminar documentos)

### Solución de Problemas

**Error: "Bucket not found"**
- Asegúrate de haber ejecutado el script SQL en Supabase Dashboard
- Verifica que los buckets existan en la sección Storage del Dashboard

**Error: "Permission denied"**
- Verifica que las políticas RLS estén configuradas correctamente
- Asegúrate de estar autenticado en la aplicación

**Error al ejecutar script TypeScript**
- Verifica que tengas `tsx` instalado: `npm install -g tsx`
- O usa `npx tsx` para ejecutarlo sin instalación global
- Si el error persiste, usa el script SQL directamente en el Dashboard

