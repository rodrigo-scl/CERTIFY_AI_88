#!/bin/sh
# ============================================================
# CERTIFY AI - Entrypoint Script
# Inyecta variables de entorno en runtime
# ============================================================

# Crear archivo de configuración de entorno para el frontend
cat > /usr/share/nginx/html/env-config.js << EOF
window._env_ = {
  VITE_SUPABASE_URL: "${VITE_SUPABASE_URL}",
  VITE_SUPABASE_ANON_KEY: "${VITE_SUPABASE_ANON_KEY}",
  VITE_DB_MODE: "${VITE_DB_MODE:-supabase_cloud}"
};
EOF

echo "✅ Environment configuration injected"
echo "   DB Mode: ${VITE_DB_MODE:-supabase_cloud}"
echo "   Supabase URL: ${VITE_SUPABASE_URL:-not set}"

# Ejecutar comando original (nginx)
exec "$@"
