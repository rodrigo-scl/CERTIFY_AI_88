// Rodrigo Osorio v0.11 - Hook de debouncing para optimizar búsquedas en tiempo real
// Previene ejecuciones excesivas de filtros/queries al escribir rápidamente

import { useEffect, useState } from 'react';

/**
 * Hook que retrasa la actualización de un valor hasta que el usuario
 * deja de escribir por un período determinado.
 * 
 * Uso ideal: Inputs de búsqueda, filtros, validaciones costosas
 * 
 * @param value - Valor a debounce
 * @param delay - Delay en milisegundos (default: 300ms)
 * @returns Valor debounced
 * 
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 300);
 * 
 * useEffect(() => {
 *   // Este efecto solo se ejecuta 300ms después de que el usuario deja de escribir
 *   performExpensiveSearch(debouncedSearch);
 * }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Crear timer que actualiza el valor después del delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Limpiar timer si el valor cambia antes del delay
    // Esto previene actualizaciones innecesarias
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

