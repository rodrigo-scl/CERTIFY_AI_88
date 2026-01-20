# ============================================================
# CERTIFY AI - Dockerfile Multi-Stage
# Versión: 1.0
# Autor: Rodrigo Osorio
# ============================================================
# Soporta: Supabase Cloud, Self-hosted PostgreSQL, Google Cloud SQL
# ============================================================

# ============================================================
# STAGE 1: Build del Frontend
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --legacy-peer-deps

# Copiar código fuente
COPY . .

# Build args para variables de entorno en build time
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_DB_MODE=supabase_cloud

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_DB_MODE=$VITE_DB_MODE

# Build de producción
RUN npm run build

# ============================================================
# STAGE 2: Servidor de Producción
# ============================================================
FROM nginx:alpine AS production

# Copiar build del frontend
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuración de nginx
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copiar script de inicio que inyecta variables de entorno
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Puerto
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

# ============================================================
# STAGE 3: Migrador de Base de Datos (opcional)
# ============================================================
FROM node:20-alpine AS migrator

WORKDIR /migrations

# Instalar cliente PostgreSQL
RUN apk add --no-cache postgresql-client

# Copiar scripts SQL
COPY supabase/install-kit/*.sql ./
COPY docker/migrate.sh ./

RUN chmod +x migrate.sh

ENTRYPOINT ["./migrate.sh"]
