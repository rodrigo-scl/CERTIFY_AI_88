# Configuración de Variables de Entorno - Certify AI

**Versión:** 0.11  
**Autor:** Rodrigo Osorio  
**Fecha:** Diciembre 2025

## ⚠️ Acción Requerida: Crear archivo .env

Para que la aplicación funcione correctamente, debes crear manualmente el archivo `.env` en la raíz del proyecto.

## Pasos para Configurar

### 1. Crear el archivo .env

En la raíz del proyecto (donde está el `package.json`), crea un archivo llamado `.env` con el siguiente contenido:

```env
# Configuración de Supabase - Certify AI
VITE_SUPABASE_URL=https://mxjpeadstmfzkeitvnhy.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14anBlYWRzdG1memtlaXR2bmh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NTgxMzAsImV4cCI6MjA4MDQzNDEzMH0.Xrw2XDWMMQn76WYBWj-XVG20aFcMcegw6IJSkuP9GO4
```

### 2. Verificar que el archivo esté protegido

El archivo `.gitignore` ya está configurado para NO subir el archivo `.env` a git. Verifica que esté presente:

```gitignore
# Environment variables - Seguridad
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
```

### 3. Configurar Gemini API (Edge Functions)

La API Key de Gemini **NO** debe estar en el archivo `.env` del cliente. Debe configurarse como secret en Supabase:

```bash
# En tu terminal, con Supabase CLI instalado
supabase secrets set GEMINI_API_KEY=tu-api-key-aqui
```

**¿Por qué?**  
- Las Edge Functions se ejecutan en el servidor de Supabase
- Exponer la API key en el cliente es un riesgo de seguridad
- Los secrets de Supabase están encriptados y protegidos

## 📋 Cambios de Seguridad Implementados

### Migración de Credenciales

**Antes (v0.10):**
```typescript
// ❌ INSEGURO - Credenciales hardcodeadas
const SUPABASE_URL = 'https://mxjpeadstmfzkeitvnhy.supabase.co';
const SUPABASE_KEY = 'eyJhbGci...';
```

**Ahora (v0.11):**
```typescript
// ✅ SEGURO - Variables de entorno
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

### Logging Condicional

**Antes:**
```typescript
console.log('[Storage]', operation); // ❌ Visible en producción
```

**Ahora:**
```typescript
import { logger } from './logger';
logger.log('[Storage]', operation); // ✅ Solo en desarrollo
```

## 🛡️ Buenas Prácticas de Seguridad

### ✅ QUÉ HACER

1. **Siempre usar variables de entorno** para credenciales
2. **Verificar que .env esté en .gitignore** antes de hacer commit
3. **Rotar credenciales periódicamente** en Supabase Dashboard
4. **Usar diferentes credenciales** para desarrollo y producción
5. **Configurar secrets en Edge Functions** para API keys de terceros

### ❌ QUÉ NO HACER

1. **NUNCA** subir el archivo `.env` a git
2. **NUNCA** compartir credenciales por email o chat
3. **NUNCA** exponer API keys en el código del cliente
4. **NUNCA** commitear credenciales de producción
5. **NUNCA** usar las mismas credenciales en múltiples entornos

## 🔍 Verificar la Configuración

Para verificar que todo está configurado correctamente:

1. **El archivo `.env` debe existir** en la raíz del proyecto
2. **Las variables deben estar definidas** sin espacios alrededor del `=`
3. **No usar comillas** alrededor de los valores
4. **Reiniciar el servidor de desarrollo** después de crear/modificar `.env`

```bash
# Detener el servidor (Ctrl+C)
# Iniciar de nuevo
npm run dev
```

## ❓ Solución de Problemas

### Error: "Faltan las credenciales de Supabase"

**Causa:** El archivo `.env` no existe o las variables no están definidas.

**Solución:**
1. Verifica que el archivo `.env` exista en la raíz
2. Asegúrate de que las variables tengan el prefijo `VITE_`
3. Reinicia el servidor de desarrollo

### Error: "Cannot find module './logger'"

**Causa:** El archivo `services/logger.ts` no se encuentra.

**Solución:** El archivo debe haber sido creado automáticamente. Verifica que exista en `services/logger.ts`.

### La app funciona pero los logs siguen apareciendo

**Causa:** Estás en modo desarrollo.

**Solución:** Esto es normal. Los logs solo se ocultan en producción. Para verificar:
```bash
npm run build
npm run preview
```

## 📞 Soporte

Si tienes problemas con la configuración, contacta a:
- **Desarrollador:** Rodrigo Osorio
- **Versión:** 0.11

---

**NOTA IMPORTANTE:** Este archivo contiene información sensible sobre la configuración. No debe compartirse públicamente.

