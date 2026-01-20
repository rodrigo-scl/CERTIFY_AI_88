// Rodrigo Osorio v0.5 - Hook reutilizable para paginación
import { useState, useMemo, useCallback } from 'react';

interface UsePaginationOptions {
  initialPage?: number;
  initialItemsPerPage?: number;
}

interface UsePaginationReturn<T> {
  // Datos paginados
  paginatedData: T[];

  // Estado actual
  currentPage: number;
  itemsPerPage: number;
  totalPages: number;
  totalItems: number;

  // Controles
  setPage: (page: number) => void;
  setItemsPerPage: (items: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  firstPage: () => void;
  lastPage: () => void;

  // Helpers
  isFirstPage: boolean;
  isLastPage: boolean;
  startIndex: number;
  endIndex: number;
}

export function usePagination<T>(
  data: T[],
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
  const { initialPage = 1, initialItemsPerPage = 10 } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [itemsPerPage, setItemsPerPageState] = useState(initialItemsPerPage);

  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // Ajustar página si excede el total (por ejemplo, al filtrar)
  const safePage = useMemo(() => {
    if (currentPage > totalPages) return totalPages;
    if (currentPage < 1) return 1;
    return currentPage;
  }, [currentPage, totalPages]);

  // Calcular índices
  const startIndex = (safePage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  // Datos de la página actual
  const paginatedData = useMemo(() => {
    const items = Array.isArray(data) ? data : [];
    return items.slice(startIndex, endIndex);
  }, [data, startIndex, endIndex]);

  // Controles
  const setPage = useCallback((page: number) => {
    const newPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(newPage);
  }, [totalPages]);

  const setItemsPerPage = useCallback((items: number) => {
    setItemsPerPageState(items);
    setCurrentPage(1); // Reset a primera página al cambiar items por página
  }, []);

  const nextPage = useCallback(() => {
    if (safePage < totalPages) {
      setCurrentPage(safePage + 1);
    }
  }, [safePage, totalPages]);

  const prevPage = useCallback(() => {
    if (safePage > 1) {
      setCurrentPage(safePage - 1);
    }
  }, [safePage]);

  const firstPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const lastPage = useCallback(() => {
    setCurrentPage(totalPages);
  }, [totalPages]);

  return {
    paginatedData,
    currentPage: safePage,
    itemsPerPage,
    totalPages,
    totalItems,
    setPage,
    setItemsPerPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    isFirstPage: safePage === 1,
    isLastPage: safePage === totalPages,
    startIndex,
    endIndex
  };
}

export default usePagination;

