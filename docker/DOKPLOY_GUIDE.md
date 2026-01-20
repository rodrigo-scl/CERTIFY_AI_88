# 🐳 CERTIFY AI - Guía de Deploy en Dokploy

Esta guía explica cómo desplegar CERTIFY AI en Dokploy con Supabase Cloud.

---

## ⚡ Requisitos Previos

1. **Servidor con Dokploy** instalado ([dokploy.com](https://dokploy.com))
2. **Proyecto Supabase** creado con los scripts SQL ejecutados
3. **Repositorio Git** (GitHub/GitLab/Gitea)

---

## 🚀 Deploy en 5 Minutos

### Paso 1: Preparar Repositorio

Asegúrate de que tu repositorio tenga estos archivos:
- `Dockerfile` ✅
- `docker-compose.yml` ✅
- `docker/` folder ✅

### Paso 2: Crear Proyecto en Dokploy

1. Ir a tu panel de Dokploy
2. Click en **"Create Project"**
3. Nombre: `certify-ai`

### Paso 3: Crear Servicio Docker

1. Dentro del proyecto, click **"Add Service"** → **"Docker"**
2. Configurar:

| Campo | Valor |
|-------|-------|
| **Source** | Git |
| **Repository** | Tu repo (ej: github.com/user/certify-ai) |
| **Branch** | main |
| **Build Type** | Dockerfile |
| **Dockerfile Path** | ./Dockerfile |

### Paso 4: Configurar Variables de Entorno

En la pestaña **"Environment"**, agregar:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_DB_MODE=supabase_cloud
```

### Paso 5: Configurar Dominio (Opcional)

1. Ir a pestaña **"Domains"**
2. Agregar tu dominio: `certify.tuempresa.com`
3. Habilitar **HTTPS** (Let's Encrypt automático)

### Paso 6: Deploy 🚀

Click en **"Deploy"** y esperar ~2-3 minutos.

---

## 🔧 Configuración Avanzada

### Build Args

Si necesitas inyectar variables en build-time:

```yaml
# En Dokploy → Advanced → Build Args
VITE_SUPABASE_URL=https://xxx.supabase.co
```

### Health Check

El Dockerfile ya incluye health check. Dokploy lo detectará automáticamente:

```
/health → 200 OK
```

### Recursos

Recomendación mínima:
- **CPU:** 0.5 cores
- **RAM:** 256 MB

---

## 📊 Monitoreo

### Ver Logs
```bash
# En Dokploy → Logs
# O desde terminal:
dokploy logs certify-ai
```

### Métricas
Dokploy muestra automáticamente:
- CPU usage
- Memory usage
- Network I/O

---

## 🔄 CI/CD Automático

### GitHub Actions (Opcional)

Dokploy soporta webhooks para deploy automático en cada push:

1. En Dokploy → Settings → Webhooks
2. Copiar la URL del webhook
3. En GitHub → Settings → Webhooks → Add webhook
4. Pegar URL y seleccionar "push" events

---

## 🛠️ Troubleshooting

### Error: "Build failed"
```bash
# Verificar que el Dockerfile existe
# Revisar logs de build en Dokploy
```

### Error: "Port already in use"
```bash
# Cambiar puerto en Environment:
APP_PORT=3001
```

### La app no carga datos
1. Verificar variables de Supabase en Environment
2. Verificar que los scripts SQL se ejecutaron
3. Revisar logs de la app

---

## 🎯 Checklist de Deploy

- [ ] Scripts SQL ejecutados en Supabase
- [ ] Edge Functions deployadas (`supabase functions deploy`)
- [ ] GEMINI_API_KEY configurado en Supabase
- [ ] Variables de entorno en Dokploy
- [ ] Dominio configurado (opcional)
- [ ] HTTPS habilitado (opcional)

---

**Versión:** 1.0 | **Plataforma:** Dokploy
