# ⚠️ Checklist: Antes de Dockerizar o Hacer Público

**Autor:** Rodrigo Osorio  
**Fecha:** Enero 2026

---

## 🔒 Estado Actual de Seguridad

| Aspecto | Estado | Acción Requerida |
|---------|--------|------------------|
| Repo privado en GitHub | ✅ Seguro | Mantener así |
| `.env.local` en Git | ⚠️ Aceptable (privado) | Eliminar antes de dockerizar |
| Claves encriptación client-side | ⚠️ Riesgo interno | Migrar a server-side si se expone a externos |
| RLS permisivo | ⚠️ Funcional | Reforzar si escala usuarios |

---

## 📋 Tareas ANTES de Dockerizar

### 1. Eliminar `.env.local` del repositorio

```bash
# Eliminar del tracking (mantiene el archivo local)
git rm --cached .env.local

# Confirmar cambio
git commit -m "chore: remove .env.local from Git tracking"

# Push a GitHub
git push origin main
```

### 2. Verificar que `.gitignore` protege los archivos

El archivo ya está configurado correctamente:
```gitignore
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
```

### 3. Crear archivo `.env` para Docker

Copiar la plantilla y configurar en el servidor:
```bash
cp .env.docker.example .env
```

Luego editar con las credenciales de producción (nunca commitear este archivo).

### 4. Rotar credenciales de Supabase

Antes de desplegar en producción:
1. Ir a [Supabase Dashboard](https://supabase.com/dashboard) → Settings → API
2. Regenerar la **anon key**
3. Actualizar el nuevo valor en `.env` del servidor

---

## 🐳 Configuración Docker Segura

### docker-compose.yml (NO incluir credenciales hardcodeadas)

```yaml
services:
  app:
    build: .
    env_file:
      - .env  # Cargar variables desde archivo externo
    # O usar variables de entorno del sistema:
    # environment:
    #   - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
    #   - VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
```

---

## ⚡ Resumen Rápido

| Cuándo | Qué hacer |
|--------|-----------|
| **Ahora (desarrollo local)** | Nada, el repo privado es suficiente |
| **Antes de dockerizar** | `git rm --cached .env.local` |
| **Antes de hacer público** | Rotar TODAS las credenciales de Supabase |
| **Antes de exponer a clientes externos** | Migrar encriptación a server-side |

---

> **Nota:** Este checklist asume que el proyecto permanece en un repositorio privado de GitHub. Si cambias a público, todas las credenciales del historial de Git quedan expuestas y debes rotarlas inmediatamente.
