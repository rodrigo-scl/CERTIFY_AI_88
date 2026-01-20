#!/bin/sh
# ============================================================
# CERTIFY AI - Script de Migración Automática
# Versión: 1.0
# Autor: Rodrigo Osorio
# ============================================================
# Uso: ./migrate.sh
# Variables requeridas:
#   - DATABASE_URL o (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
#   - DB_MODE: supabase_cloud | postgres_local | google_cloud_sql
# ============================================================

set -e

echo "🚀 CERTIFY AI - Database Migration"
echo "=================================="

# Determinar modo de base de datos
DB_MODE=${DB_MODE:-postgres_local}
echo "📦 Modo: $DB_MODE"

# Construir connection string
if [ -n "$DATABASE_URL" ]; then
    CONN_STRING="$DATABASE_URL"
else
    DB_HOST=${DB_HOST:-localhost}
    DB_PORT=${DB_PORT:-5432}
    DB_NAME=${DB_NAME:-certify_ai}
    DB_USER=${DB_USER:-postgres}
    DB_PASSWORD=${DB_PASSWORD:-postgres}
    CONN_STRING="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
fi

echo "🔗 Conectando a base de datos..."

# Función para ejecutar SQL
run_sql() {
    local file=$1
    local name=$2
    echo "  📄 Ejecutando: $name"
    psql "$CONN_STRING" -f "$file" -v ON_ERROR_STOP=1 --quiet
}

# Esperar a que la base de datos esté disponible
echo "⏳ Esperando conexión a la base de datos..."
MAX_RETRIES=30
RETRY_COUNT=0

until psql "$CONN_STRING" -c '\q' 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ Error: No se pudo conectar a la base de datos después de $MAX_RETRIES intentos"
        exit 1
    fi
    echo "  Reintentando en 2 segundos... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

echo "✅ Conexión exitosa"

# Verificar si ya se ejecutaron migraciones
echo "🔍 Verificando estado de migraciones..."

TABLES_EXIST=$(psql "$CONN_STRING" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'technicians';" 2>/dev/null | tr -d ' ')

if [ "$TABLES_EXIST" = "1" ]; then
    echo "⚠️  Las tablas ya existen. Saltando migración inicial."
    echo "   Para forzar reinstalación, elimina las tablas manualmente."
    exit 0
fi

# Ejecutar migraciones en orden
echo ""
echo "📦 Ejecutando migraciones..."
echo "=============================="

# 1. Extensiones
if [ -f "01-extensions.sql" ]; then
    run_sql "01-extensions.sql" "Extensiones (uuid-ossp, pgcrypto)"
fi

# 2. Tablas
if [ -f "02-tables.sql" ]; then
    run_sql "02-tables.sql" "Tablas (23+ tablas)"
fi

# 3. Funciones
if [ -f "03-functions.sql" ]; then
    run_sql "03-functions.sql" "Funciones RPC (22+ funciones)"
fi

# 4. Triggers
if [ -f "04-triggers.sql" ]; then
    run_sql "04-triggers.sql" "Triggers (encriptación)"
fi

# 5. Vistas
if [ -f "05-views.sql" ]; then
    run_sql "05-views.sql" "Vistas seguras"
fi

# 6. Políticas RLS
if [ -f "06-rls-policies.sql" ]; then
    run_sql "06-rls-policies.sql" "Políticas RLS (35+ políticas)"
fi

# 7. Cron Jobs (solo si pg_cron está disponible)
if [ "$DB_MODE" != "google_cloud_sql" ] && [ -f "07-cron-jobs.sql" ]; then
    echo "  📄 Intentando configurar Cron Jobs..."
    psql "$CONN_STRING" -f "07-cron-jobs.sql" 2>/dev/null || echo "  ⚠️  pg_cron no disponible, saltando..."
fi

# 8. Storage (solo para Supabase)
if [ "$DB_MODE" = "supabase_cloud" ] || [ "$DB_MODE" = "supabase_local" ]; then
    if [ -f "08-storage.sql" ]; then
        run_sql "08-storage.sql" "Storage Buckets"
    fi
fi

echo ""
echo "=============================="
echo "✅ Migración completada exitosamente"
echo ""

# Verificar tablas creadas
TOTAL_TABLES=$(psql "$CONN_STRING" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
echo "📊 Estadísticas:"
echo "   - Tablas creadas: $TOTAL_TABLES"

# Insertar datos iniciales si es primera instalación
echo ""
echo "🌱 Insertando datos iniciales..."

psql "$CONN_STRING" --quiet << 'EOF'
-- Datos iniciales para primera instalación

-- Industrias de ejemplo
INSERT INTO industries (name) VALUES 
  ('Minería'),
  ('Construcción'),
  ('Energía'),
  ('Petróleo y Gas'),
  ('Manufactura')
ON CONFLICT DO NOTHING;

-- Tipos de técnicos
INSERT INTO technician_types (name, description) VALUES 
  ('Electricista', 'Técnico en instalaciones eléctricas'),
  ('Mecánico', 'Técnico en mantenimiento mecánico'),
  ('Instrumentista', 'Técnico en instrumentación'),
  ('Soldador', 'Técnico en soldadura industrial'),
  ('Operador', 'Operador de equipos pesados')
ON CONFLICT DO NOTHING;

-- Sucursal por defecto
INSERT INTO branches (name, location) VALUES 
  ('Casa Matriz', 'Santiago, Chile')
ON CONFLICT DO NOTHING;

-- Configuración inicial del sistema
INSERT INTO system_settings (key, value, description) VALUES 
  ('ai_quotas', '{"daily_limit": 50, "enabled": true}', 'Configuración de cuotas de IA')
ON CONFLICT (key) DO NOTHING;
EOF

echo "✅ Datos iniciales insertados"
echo ""
echo "🎉 ¡Instalación completada!"
echo "   La base de datos está lista para usar."
