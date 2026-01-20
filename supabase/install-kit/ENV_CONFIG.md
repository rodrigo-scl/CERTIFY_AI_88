# 🔐 Configuración de Variables de Entorno

Este documento detalla todas las variables de entorno necesarias para CERTIFY AI.

---

## 📱 Variables del Frontend (.env)

Crear archivo `.env` en la raíz del proyecto frontend:

```env
# Supabase - Obtener desde Dashboard > Settings > API
VITE_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# Opcional: Modo de desarrollo
VITE_DEV_MODE=false
```

### ¿Dónde obtener estos valores?

1. Ir a [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleccionar tu proyecto
3. Ir a **Settings** → **API**
4. Copiar:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

---

## 🔧 Secrets de Supabase (Edge Functions)

Configurar usando Supabase CLI:

```bash
# Iniciar sesión
supabase login

# Vincular proyecto
supabase link --project-ref TU_PROJECT_REF

# Configurar secrets
supabase secrets set GEMINI_API_KEY=tu-api-key-de-gemini
```

### Secrets Requeridos

| Secret | Descripción | Dónde obtenerlo |
|--------|-------------|-----------------|
| `GEMINI_API_KEY` | API Key de Google Gemini | [Google AI Studio](https://aistudio.google.com/apikey) |

### Secrets Automáticos (ya disponibles)

Estas variables las proporciona Supabase automáticamente en Edge Functions:

- `SUPABASE_URL` - URL del proyecto
- `SUPABASE_ANON_KEY` - Clave pública
- `SUPABASE_SERVICE_ROLE_KEY` - Clave de servicio (admin)

---

## 🔒 Variable de Encriptación (Opcional)

Para usar una clave de encriptación personalizada:

```bash
# En Supabase Dashboard > SQL Editor
ALTER DATABASE postgres SET app.encryption_key = 'tu-clave-secreta-aqui';
```

> ⚠️ **IMPORTANTE:** Si cambias la clave de encriptación, los datos existentes no podrán ser desencriptados con la nueva clave.

---

## 📋 Checklist de Configuración

- [ ] Archivo `.env` creado en frontend
- [ ] `VITE_SUPABASE_URL` configurado
- [ ] `VITE_SUPABASE_ANON_KEY` configurado
- [ ] Supabase CLI instalado
- [ ] Proyecto vinculado con `supabase link`
- [ ] `GEMINI_API_KEY` configurado (si usas IA)
- [ ] Edge Functions desplegadas

---

## 🧪 Verificar Configuración

### Frontend

```bash
# En la raíz del proyecto
npm run dev

# Debería iniciar sin errores de credenciales
```

### Edge Functions

```bash
# Ver logs de funciones
supabase functions logs certify-ai

# Invocar función de prueba
curl -X POST https://TU_PROJECT_REF.supabase.co/functions/v1/recalculate-status
```

---

## 🔄 Rotación de Credenciales

Para rotar credenciales de forma segura:

1. **API Keys de Supabase:**
   - Dashboard > Settings > API > Regenerate API Keys

2. **Gemini API Key:**
   - Crear nueva key en Google AI Studio
   - Actualizar con `supabase secrets set GEMINI_API_KEY=nueva-key`
   - Eliminar key antigua en Google AI Studio

3. **Clave de Encriptación:**
   - ⚠️ NO rotar sin migrar datos primero
   - Contactar desarrollador para proceso de migración

---

**Versión:** 1.0  
**Autor:** Rodrigo Osorio
