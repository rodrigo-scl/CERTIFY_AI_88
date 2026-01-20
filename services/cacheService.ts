// Rodrigo Osorio v0.1 - Sistema de Cache en Memoria con TTL
// Optimiza la performance evitando queries redundantes a Supabase

interface CacheEntry<T> {
  data: T;
  expiry: number; // timestamp
}

// Cache en memoria
const cache = new Map<string, CacheEntry<any>>();

// Claves predefinidas para datos comunes
export const CACHE_KEYS = {
  TECHNICIANS: 'technicians',
  COMPANIES: 'companies',
  COMPANIES_LIGHT: 'companies_light',
  SERVICE_PROVIDERS: 'service_providers',
  DOCUMENT_TYPES: 'document_types',
  BRANCHES: 'branches',
  INDUSTRIES: 'industries',
  AREAS: 'areas',
  TECH_TYPES: 'tech_types',
  TECHNICIANS_LIGHT: 'technicians_light',
} as const;

// Rodrigo Osorio v0.12 - TTL optimizados para escalabilidad y uso masivo
// TTL predefinidos (en milisegundos)
export const CACHE_TTL = {
  SHORT: 1 * 60 * 1000,       // 1 minuto - para datos muy dinámicos (credenciales, estados)
  MEDIUM: 5 * 60 * 1000,      // 5 minutos - para técnicos/empresas (aumentado desde 3 min para reducir queries)
  LONG: 15 * 60 * 1000,       // 15 minutos - para catálogos (aumentado desde 10 min)
  EXTRA_LONG: 30 * 60 * 1000, // 30 minutos - para datos estáticos (tipos de doc, áreas, sucursales)
} as const;

/**
 * Obtiene datos del cache si existen y no han expirado
 * @param key - Clave del cache
 * @returns Los datos o null si no existen/expiraron
 */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);

  if (!entry) return null;

  // Verificar si expiró
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }

  return entry.data as T;
}

/**
 * Guarda datos en el cache con un TTL específico
 * @param key - Clave del cache
 * @param data - Datos a guardar
 * @param ttlMs - Tiempo de vida en milisegundos
 */
export function setCache<T>(key: string, data: T, ttlMs: number = CACHE_TTL.MEDIUM): void {
  cache.set(key, {
    data,
    expiry: Date.now() + ttlMs
  });
}

/**
 * Limpia el cache (todo o una clave específica)
 * @param key - Clave específica a limpiar (opcional, si no se pasa limpia todo)
 */
export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

/**
 * Invalida caches relacionados cuando se modifica una entidad
 * Útil para llamar después de operaciones CRUD
 */
export function invalidateRelatedCaches(entityType: 'technician' | 'company' | 'credential' | 'branch' | 'all'): void {
  switch (entityType) {
    case 'technician':
      clearCache(CACHE_KEYS.TECHNICIANS);
      clearCache(CACHE_KEYS.BRANCHES); // Los técnicos afectan estadísticas de sucursales
      break;
    case 'company':
      clearCache(CACHE_KEYS.COMPANIES);
      clearCache(CACHE_KEYS.COMPANIES_LIGHT);
      break;
    case 'credential':
      clearCache(CACHE_KEYS.TECHNICIANS);
      break;
    case 'branch':
      clearCache(CACHE_KEYS.BRANCHES);
      break;
    case 'all':
      clearCache();
      break;
  }
}

/**
 * Wrapper para funciones async que cachea automáticamente el resultado
 * Rodrigo Osorio v0.12 - Optimizado con stale-while-revalidate para mejor UX
 * @param key - Clave del cache
 * @param fetchFn - Función que obtiene los datos
 * @param ttlMs - TTL para el cache
 * @returns Los datos (del cache o frescos)
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlMs: number = CACHE_TTL.MEDIUM
): Promise<T> {
  // Intentar obtener del cache
  const cached = getCached<T>(key);
  if (cached !== null) {
    // Estrategia stale-while-revalidate: retornar cache inmediatamente
    // y actualizar en background si está cerca de expirar
    const entry = cache.get(key);
    if (entry) {
      const timeUntilExpiry = entry.expiry - Date.now();
      const refreshThreshold = ttlMs * 0.2; // Refrescar cuando queda 20% del TTL

      // Si el cache está cerca de expirar, actualizar en background
      if (timeUntilExpiry < refreshThreshold) {
        // No esperar la actualización, retornar cache inmediatamente
        fetchFn().then(freshData => {
          setCache(key, freshData, ttlMs);
        }).catch(err => {
          console.warn(`Error al actualizar cache en background para ${key}:`, err);
        });
      }
    }
    return cached;
  }

  // Si no está en cache, obtener datos frescos
  const freshData = await fetchFn();

  // Guardar en cache
  setCache(key, freshData, ttlMs);

  return freshData;
}

/**
 * Obtiene estadísticas del cache (útil para debugging)
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
}

/**
 * Verifica si una clave existe en el cache y no ha expirado
 */
export function isCached(key: string): boolean {
  return getCached(key) !== null;
}

