# 📦 CERTIFY AI - Kit de Instalación Supabase

**Versión:** 1.0  
**Autor:** Rodrigo Osorio  
**Fecha:** Enero 2026

Este kit permite instalar el sistema CERTIFY AI en un nuevo proyecto de Supabase.

---

## ⚡ Requisitos Previos

1. **Cuenta Supabase** con un proyecto creado
2. **Supabase CLI** instalado (opcional, para Edge Functions)
3. **API Key de Gemini** (para el asistente IA)

---

## 🚀 Guía de Instalación Rápida

### Paso 1: Crear Proyecto Supabase

1. Ir a [supabase.com](https://supabase.com) → Dashboard
2. Click en "New Project"
3. Configurar:
   - **Name:** CERTIFY-AI (o tu nombre preferido)
   - **Region:** `sa-east-1` (Sudamérica) recomendado
   - **Password:** Generar una contraseña segura
4. Esperar a que el proyecto se inicialice (~2 min)

### Paso 2: Ejecutar Scripts SQL

Ve al **SQL Editor** en Supabase Dashboard y ejecuta los scripts **EN ORDEN**:

| # | Archivo | Descripción |
|---|---------|-------------|
| 1 | `01-extensions.sql` | Habilita extensiones requeridas |
| 2 | `02-tables.sql` | Crea todas las tablas |
| 3 | `03-functions.sql` | Funciones RPC y helpers |
| 4 | `04-triggers.sql` | Triggers de encriptación |
| 5 | `05-views.sql` | Vistas seguras |
| 6 | `06-rls-policies.sql` | Políticas de seguridad RLS |
| 7 | `07-cron-jobs.sql` | Jobs programados |
| 8 | `08-storage.sql` | Buckets de almacenamiento |

> ⚠️ **IMPORTANTE:** Ejecutar en orden. Cada script depende del anterior.

### Paso 3: Configurar Secrets

En terminal con Supabase CLI:

```bash
# Iniciar sesión
supabase login

# Vincular proyecto
supabase link --project-ref TU_PROJECT_REF

# Configurar API Key de Gemini
supabase secrets set GEMINI_API_KEY=tu-api-key-de-gemini
```

### Paso 4: Desplegar Edge Functions

```bash
# Desde la carpeta del proyecto
cd supabase/install-kit/edge-functions

# Desplegar función IA
supabase functions deploy certify-ai --no-verify-jwt

# Desplegar función de recálculo
supabase functions deploy recalculate-status --no-verify-jwt
```

### Paso 5: Configurar Aplicación Frontend

Crear archivo `.env` en la raíz del proyecto frontend:

```env
VITE_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

Obtener estos valores desde:
- **Dashboard Supabase → Settings → API**

---

## ✅ Verificación

### Verificar Extensiones
```sql
SELECT extname, extversion FROM pg_extension 
WHERE extname IN ('uuid-ossp', 'pgcrypto', 'pg_cron');
```
Debe mostrar 3 filas.

### Verificar Tablas
```sql
SELECT count(*) FROM information_schema.tables 
WHERE table_schema = 'public';
```
Debe mostrar 20+ tablas.

### Verificar RLS
```sql
SELECT tablename, policyname FROM pg_policies 
WHERE schemaname = 'public';
```
Debe mostrar 35+ políticas.

### Verificar Cron Jobs
```sql
SELECT jobid, schedule, command FROM cron.job;
```
Debe mostrar 2 jobs.

---

## 🔐 Datos Iniciales (Opcional)

Después de la instalación, puedes cargar datos de prueba:

```sql
-- Insertar industrias de ejemplo
INSERT INTO industries (name) VALUES 
  ('Minería'),
  ('Construcción'),
  ('Energía'),
  ('Petróleo y Gas');

-- Insertar tipos de técnicos
INSERT INTO technician_types (name, description) VALUES 
  ('Electricista', 'Técnico en instalaciones eléctricas'),
  ('Mecánico', 'Técnico en mantenimiento mecánico'),
  ('Instrumentista', 'Técnico en instrumentación');

-- Insertar sucursal por defecto
INSERT INTO branches (name, location) VALUES 
  ('Casa Matriz', 'Santiago, Chile');
```

---

## 🛠️ Solución de Problemas

### Error: "extension pg_cron is not available"
- Contactar soporte Supabase para habilitar `pg_cron` en tu proyecto

### Error: "permission denied for schema cron"
- El plan Free no incluye `pg_cron`. Requiere plan Pro o superior

### Las funciones de encriptación no funcionan
- Verificar que `pgcrypto` esté habilitado:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  ```

### Edge Functions no responden
- Verificar que los secrets estén configurados
- Revisar logs: `supabase functions logs certify-ai`

---

## 📁 Estructura de Archivos

```
install-kit/
├── README.md                 # Esta guía
├── 01-extensions.sql         # Extensiones PostgreSQL
├── 02-tables.sql             # Definición de tablas
├── 03-functions.sql          # Funciones RPC
├── 04-triggers.sql           # Triggers automáticos
├── 05-views.sql              # Vistas seguras
├── 06-rls-policies.sql       # Políticas RLS
├── 07-cron-jobs.sql          # Jobs programados
├── 08-storage.sql            # Buckets de storage
├── ENV_CONFIG.md             # Guía de variables de entorno
└── edge-functions/
    ├── certify-ai/
    │   └── index.ts          # Asistente IA
    └── recalculate-status/
        └── index.ts          # Recálculo de estados
```

---

## 📞 Soporte

- **Desarrollador:** Rodrigo Osorio
- **Proyecto:** CERTIFY AI
- **Versión Kit:** 1.0

---

**NOTA:** Este kit está diseñado para Supabase. No es compatible con otras plataformas PostgreSQL sin modificaciones.
