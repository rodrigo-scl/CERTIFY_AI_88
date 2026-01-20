-- ============================================================
-- CERTIFY AI - Script de Instalación #7: Cron Jobs
-- Versión: 1.0
-- Autor: Rodrigo Osorio
-- Fecha: Enero 2026
-- ============================================================
-- Ejecutar DESPUÉS de 06-rls-policies.sql
-- NOTA: Requiere extensión pg_cron (plan Pro o superior)
-- ============================================================

-- ============================================================
-- JOB 1: Recálculo diario de estados de credenciales
-- Ejecuta a las 9:00 AM todos los días
-- ============================================================

SELECT cron.schedule(
    'recalculate-credential-statuses',    -- nombre del job
    '0 9 * * *',                          -- cron expression: 9 AM diario
    'SELECT recalculate_credential_statuses()'
);

-- ============================================================
-- JOB 2: Refresh de vista materializada de ranking
-- Ejecuta cada 3 horas
-- ============================================================

SELECT cron.schedule(
    'refresh-branch-ranking',             -- nombre del job
    '0 */3 * * *',                        -- cron expression: cada 3 horas
    'REFRESH MATERIALIZED VIEW CONCURRENTLY branch_compliance_ranking'
);

-- ============================================================
-- GESTIÓN DE JOBS
-- ============================================================

-- Ver todos los jobs programados:
-- SELECT * FROM cron.job;

-- Ver historial de ejecuciones:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Desactivar un job temporalmente:
-- UPDATE cron.job SET active = false WHERE jobname = 'recalculate-credential-statuses';

-- Eliminar un job:
-- SELECT cron.unschedule('nombre-del-job');

-- ============================================================
-- ALTERNATIVA SIN pg_cron
-- ============================================================
-- Si no tienes pg_cron disponible, puedes usar:
--
-- 1. Edge Functions con Supabase Cron (recomendado)
--    - Deploy la función recalculate-status
--    - Configurar cron en Supabase Dashboard
--
-- 2. Llamada manual desde frontend
--    - Llamar a recalculate_credential_statuses() periódicamente
--
-- 3. GitHub Actions o servicio externo
--    - Ejecutar la función via HTTP trigger
-- ============================================================
