// Rodrigo Osorio v0.12 - Hook para prefetching de datos críticos
// Mejora la experiencia de usuario precargando datos que probablemente se necesitarán

import React, { useEffect, useRef } from 'react';

interface PrefetchOptions {
  enabled?: boolean;
  delay?: number; // Delay antes de hacer prefetch (para no bloquear carga inicial)
}

/**
 * Hook para prefetching de datos
 * Útil para precargar datos que probablemente se necesitarán pronto
 * 
 * @param prefetchFn - Función async que obtiene los datos
 * @param options - Opciones de prefetch
 * 
 * @example
 * // Prefetch de empresas cuando el usuario está en dashboard
 * usePrefetch(() => getCompanies(), { delay: 2000 });
 */
export function usePrefetch(
  prefetchFn: () => Promise<any>,
  options: PrefetchOptions = {}
) {
  const { enabled = true, delay = 0 } = options;
  const prefetchedRef = useRef(false);

  useEffect(() => {
    if (!enabled || prefetchedRef.current) return;

    const timer = setTimeout(() => {
      // Ejecutar prefetch en background sin bloquear
      prefetchFn().catch(err => {
        // Silenciar errores de prefetch - no es crítico si falla
        console.warn('Prefetch falló (no crítico):', err);
      });
      prefetchedRef.current = true;
    }, delay);

    return () => clearTimeout(timer);
  }, [enabled, delay, prefetchFn]);
}

/**
 * Hook para prefetching condicional basado en hover
 * Útil para precargar datos cuando el usuario hace hover sobre un elemento
 * 
 * @param prefetchFn - Función async que obtiene los datos
 * @param elementRef - Referencia al elemento que dispara el prefetch
 * 
 * @example
 * const cardRef = useRef(null);
 * useHoverPrefetch(() => getCompanyDetails(id), cardRef);
 */
export function useHoverPrefetch(
  prefetchFn: () => Promise<any>,
  elementRef: React.RefObject<HTMLElement>
) {
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    let timeoutId: NodeJS.Timeout;

    const handleMouseEnter = () => {
      // Prefetch después de 200ms de hover (evita prefetch accidental)
      timeoutId = setTimeout(() => {
        prefetchFn().catch(err => {
          console.warn('Hover prefetch falló:', err);
        });
      }, 200);
    };

    const handleMouseLeave = () => {
      clearTimeout(timeoutId);
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      clearTimeout(timeoutId);
    };
  }, [prefetchFn, elementRef]);
}

