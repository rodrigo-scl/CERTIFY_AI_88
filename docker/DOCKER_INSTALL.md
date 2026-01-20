# 🐳 CERTIFY AI - Instalación con Docker

Esta guía explica cómo instalar CERTIFY AI usando Docker con diferentes backends de base de datos.

---

## ⚡ Inicio Rápido

### Prerrequisitos
- Docker Engine 20.10+
- Docker Compose v2+

### Instalación en 3 pasos

```bash
# 1. Clonar y configurar
git clone <repo> && cd CERTIFY_AI_88
cp .env.docker.example .env

# 2. Editar .env con tus credenciales de Supabase
nano .env

# 3. Levantar
docker-compose up -d
```

Acceder en: **http://localhost:3000**

---

## 🔧 Modos de Instalación

### Modo 1: Supabase Cloud (Recomendado)

Base de datos en Supabase Cloud, solo el frontend en Docker.

```bash
# Configurar .env
VITE_DB_MODE=supabase_cloud
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...

# Levantar
docker-compose --profile supabase-cloud up -d
```

> ⚠️ **Importante:** Primero ejecutar los scripts SQL del kit de instalación en tu proyecto Supabase.

---

### Modo 2: PostgreSQL Local (Self-hosted)

Todo auto-hospedado: PostgreSQL + Frontend + Migración automática.

```bash
# Configurar .env
VITE_DB_MODE=postgres_local
DB_PASSWORD=tu-password-seguro

# Levantar (crea BD y migra automáticamente)
docker-compose --profile postgres-local up -d
```

Las tablas se crean automáticamente. No necesitas ejecutar scripts SQL manualmente.

---

### Modo 3: Full Stack (con pgAdmin)

Incluye interfaz visual para administrar la base de datos.

```bash
docker-compose --profile full-stack up -d
```

Accesos:
- **App:** http://localhost:3000
- **pgAdmin:** http://localhost:5050
  - Email: admin@certify.ai
  - Password: admin2026

---

## 📊 Comparación de Modos

| Característica | Supabase Cloud | PostgreSQL Local | Google Cloud SQL |
|----------------|----------------|------------------|------------------|
| Setup inicial | Medio | Fácil | Medio |
| Costo | Gratis → Pago | Gratis | Pago |
| Edge Functions | ✅ | ❌ | ❌ |
| Backups auto | ✅ | Manual | ✅ |
| Migración auto | ❌ (manual) | ✅ | Manual |

---

## 🛠️ Comandos Útiles

```bash
# Ver logs
docker-compose logs -f app

# Reiniciar solo la app
docker-compose restart app

# Parar todo
docker-compose down

# Parar y borrar datos
docker-compose down -v

# Reconstruir después de cambios
docker-compose build --no-cache
docker-compose up -d
```

---

## 🔒 Producción

Para producción, ajustar:

```bash
# En .env
DB_PASSWORD=<password-muy-seguro>
PGADMIN_PASSWORD=<password-muy-seguro>

# Usar HTTPS (configurar reverse proxy)
# Configurar backups automáticos
```

---

## ❓ Solución de Problemas

### Error: "Cannot connect to database"
```bash
# Verificar que postgres esté corriendo
docker-compose ps

# Ver logs de la BD
docker-compose logs postgres
```

### Error: "Port already in use"
```bash
# Cambiar puerto en .env
APP_PORT=3001
```

### Migraciones no se ejecutan
```bash
# Ejecutar manualmente
docker-compose run --rm migrator
```

---

**Versión:** 1.0 | **Autor:** Rodrigo Osorio
