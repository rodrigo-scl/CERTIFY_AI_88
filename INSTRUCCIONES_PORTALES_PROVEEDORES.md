# Instrucciones de Implementación - Portales de Proveedores v0.12
**Desarrollado por: Rodrigo Osorio**  
**Fecha: 16 de Diciembre, 2025**

## Resumen
Se ha implementado un sistema centralizado de gestión de portales de proveedores que permite:
- Crear y gestionar una lista maestra de portales en Configuración
- Asignar un portal específico a cada empresa
- Visualizar la información del portal directamente desde la página de la empresa

---

## Pasos para Activar la Funcionalidad

### 1. Ejecutar Migración de Base de Datos ⚠️ IMPORTANTE

El archivo SQL de migración se encuentra en:
```
supabase/migrations/create_supplier_portals_table.sql
```

**Instrucciones de ejecución:**
1. Abre tu proyecto Supabase en el navegador
2. Ve a **SQL Editor** en el menú lateral
3. Crea una nueva query
4. Copia y pega el contenido completo del archivo `create_supplier_portals_table.sql`
5. Ejecuta la query presionando **"Run"** o `Ctrl+Enter`
6. Verifica que se completó exitosamente sin errores

**Qué hace la migración:**
- Crea la tabla `supplier_portals` con campos: id, name, url, username, password, is_active
- Agrega la columna `supplier_portal_id` a la tabla `companies`
- Crea índices para optimizar consultas
- Configura políticas RLS para seguridad
- Agrega trigger para actualizar `updated_at` automáticamente

### 2. Reiniciar el Servidor de Desarrollo

Después de ejecutar la migración:
```bash
# Detén el servidor si está corriendo (Ctrl+C)
# Luego reinicia:
npm run dev
```

---

## Cómo Usar la Nueva Funcionalidad

### A. Crear Portales de Proveedores (Configuración)

1. Ve a **Configuración** en el menú lateral
2. Selecciona la pestaña **"Portales de Proveedores"**
3. Haz clic en **"+ Nuevo Portal"**
4. Completa el formulario:
   - **Nombre del Portal*** (requerido): Ej. "Portal ABC Proveedores"
   - **URL del Portal*** (requerido): Ej. "https://portal.ejemplo.com"
   - **Usuario de Acceso** (opcional): Credencial de acceso
   - **Contraseña** (opcional): Contraseña de acceso
5. Haz clic en **"Guardar"**

**Gestión de portales:**
- **Editar**: Haz clic en el ícono de lápiz para modificar un portal
- **Eliminar**: Haz clic en el ícono de basura (solo si no está asignado a empresas)
- **Estado**: Indica si el portal está activo o inactivo

### B. Asignar Portal a una Empresa

1. Ve a **Empresas** en el menú lateral
2. Selecciona una empresa de la lista
3. Haz clic en **"Editar"** (ícono de lápiz en la esquina superior derecha)
4. En el formulario de edición, busca el campo **"Portal de Proveedores"**
5. Selecciona un portal del dropdown (o "Sin portal asignado" para quitar)
6. Haz clic en **"Guardar cambios"**

### C. Visualizar Portal Asignado

En la vista de detalle de una empresa:
- Ve a la sección de información de contacto
- El campo **"Portal Proveedores"** mostrará:
  - **Nombre del portal** con enlace directo (se abre en nueva pestaña)
  - **Usuario de acceso** (si está configurado)
  - **Contraseña** (oculta con puntos por seguridad)

---

## Arquitectura Técnica

### Archivos Modificados

1. **`types.ts`**
   - Nueva interfaz `SupplierPortal`
   - Actualización de interfaz `Company` con campos `supplierPortalId` y `supplierPortal`

2. **`services/dataService.ts`**
   - `getSupplierPortals()` - Obtener todos los portales
   - `getSupplierPortalById(id)` - Obtener portal por ID
   - `addSupplierPortal(portal)` - Crear nuevo portal
   - `updateSupplierPortal(id, payload)` - Actualizar portal
   - `deleteSupplierPortal(id)` - Eliminar portal (con validación de uso)
   - Actualización de `getCompanies()` para incluir join con `supplier_portals`
   - Actualización de `updateCompany()` para manejar `supplier_portal_id`

3. **`pages/Settings.tsx`**
   - Nuevo componente `SupplierPortalsSettings`
   - Nueva pestaña en navegación: "Portales de Proveedores"
   - Tabla con paginación para gestionar portales
   - Formularios de creación y edición

4. **`pages/Companies.tsx`**
   - Actualización de visualización de portal en detalle de empresa
   - Selector de portal en formulario de edición
   - Carga de portales disponibles al iniciar

### Base de Datos

**Nueva Tabla: `supplier_portals`**
```sql
- id (UUID, primary key)
- name (TEXT, requerido)
- url (TEXT, requerido)
- username (TEXT, opcional)
- password (TEXT, opcional)
- is_active (BOOLEAN, default: true)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

**Tabla Modificada: `companies`**
```sql
- supplier_portal_id (UUID, foreign key a supplier_portals)
```

---

## Consideraciones de Seguridad

1. **Contraseñas**: Las contraseñas de portales se almacenan en texto plano en la base de datos. Para mayor seguridad, considera implementar encriptación.

2. **Políticas RLS**: Ya están configuradas para que solo usuarios autenticados puedan acceder a los portales.

3. **Visualización**: Las contraseñas se ocultan en la UI (se muestran como ••••••••).

---

## Retrocompatibilidad

El sistema mantiene los campos legacy (`portal_url`, `portal_user`, `portal_password`) en la tabla `companies` para:
- No romper empresas existentes con datos en esos campos
- Permitir migración gradual
- Mostrar portales legacy con etiqueta "(Legacy)" en la UI

**Migración futura opcional:**
Puedes crear un script para migrar datos legacy a la nueva tabla de portales.

---

## Verificación del Sistema

### Checklist de Pruebas

- [ ] La migración SQL se ejecutó sin errores
- [ ] Puedes crear un nuevo portal en Configuración
- [ ] Puedes editar un portal existente
- [ ] No puedes eliminar un portal asignado a una empresa
- [ ] Puedes asignar un portal a una empresa desde el formulario de edición
- [ ] El portal asignado se muestra correctamente en la vista de empresa
- [ ] El enlace del portal abre en una nueva pestaña
- [ ] Puedes desasignar un portal seleccionando "Sin portal asignado"

---

## Soporte y Mantenimiento

**Versión:** 0.12  
**Desarrollado por:** Rodrigo Osorio

Si encuentras algún problema:
1. Verifica que la migración SQL se ejecutó correctamente
2. Revisa la consola del navegador en busca de errores
3. Verifica que el servidor esté reiniciado después de la migración

---

## Próximos Pasos Sugeridos

1. **Encriptación de contraseñas**: Implementar encriptación para mayor seguridad
2. **Migración de datos**: Crear script para migrar portales legacy
3. **Auditoría**: Registrar cambios en portales para trazabilidad
4. **Notificaciones**: Alertar cuando un portal esté inactivo

