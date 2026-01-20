-- Migración: Tabla maestra de portales de proveedores
-- Rodrigo Osorio v0.12 - Sistema centralizado de gestión de portales
-- Fecha: 2025-12-16
-- Descripción: Crea tabla supplier_portals y agrega relación en companies

-- Tabla maestra de portales de proveedores
CREATE TABLE IF NOT EXISTS supplier_portals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    username TEXT,
    password TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Agregar columna en companies para referenciar al portal
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS supplier_portal_id UUID REFERENCES supplier_portals(id) ON DELETE SET NULL;

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_supplier_portals_active ON supplier_portals(is_active);
CREATE INDEX IF NOT EXISTS idx_companies_supplier_portal ON companies(supplier_portal_id);

-- Políticas RLS para supplier_portals (solo usuarios autenticados)
ALTER TABLE supplier_portals ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas si ya existen (para evitar errores en re-ejecución)
DROP POLICY IF EXISTS "Allow authenticated users to read supplier portals" ON supplier_portals;
DROP POLICY IF EXISTS "Allow authenticated users to manage supplier portals" ON supplier_portals;

-- Permitir lectura a usuarios autenticados
CREATE POLICY "Allow authenticated users to read supplier portals" 
ON supplier_portals FOR SELECT 
TO authenticated 
USING (true);

-- Permitir todas las operaciones a usuarios autenticados
CREATE POLICY "Allow authenticated users to manage supplier portals" 
ON supplier_portals FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_supplier_portals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe para evitar duplicados
DROP TRIGGER IF EXISTS trigger_update_supplier_portals_updated_at ON supplier_portals;

CREATE TRIGGER trigger_update_supplier_portals_updated_at
BEFORE UPDATE ON supplier_portals
FOR EACH ROW
EXECUTE FUNCTION update_supplier_portals_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE supplier_portals IS 'Lista maestra de portales de proveedores con credenciales centralizadas';
COMMENT ON COLUMN companies.supplier_portal_id IS 'Referencia al portal de proveedores asignado a esta empresa';

-- Instrucciones de ejecución:
-- 1. Abre el SQL Editor en tu proyecto Supabase
-- 2. Copia y pega este contenido completo
-- 3. Ejecuta presionando "Run" o Ctrl+Enter
-- 4. Verifica que se creó la tabla supplier_portals y la columna supplier_portal_id en companies

