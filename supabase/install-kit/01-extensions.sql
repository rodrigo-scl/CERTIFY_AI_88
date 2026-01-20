-- ============================================================
-- CERTIFY AI - Script de Instalación #1: Extensiones
-- Versión: 1.0
-- Autor: Rodrigo Osorio
-- Fecha: Enero 2026
-- ============================================================
-- Ejecutar este script PRIMERO antes de cualquier otro.
-- ============================================================

-- 1. Habilitar extensión para generación de UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- 2. Habilitar extensión para encriptación de datos sensibles
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 3. Habilitar extensión para jobs programados (requiere plan Pro+)
-- NOTA: Si estás en plan Free, esta línea fallará. Puedes comentarla.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- ============================================================
-- Verificación
-- ============================================================
-- Ejecuta esta consulta para verificar que las extensiones están instaladas:
--
-- SELECT extname, extversion FROM pg_extension 
-- WHERE extname IN ('uuid-ossp', 'pgcrypto', 'pg_cron');
--
-- Resultado esperado: 3 filas (o 2 si pg_cron no está disponible)
-- ============================================================
