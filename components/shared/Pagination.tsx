// Rodrigo Osorio v0.5 - Componente de paginación reutilizable
import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (items: number) => void;
  showItemsPerPage?: boolean;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  showItemsPerPage = true,
  className = ''
}) => {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const itemsPerPageOptions = [10, 25, 50, 100];

  // Generar números de página visibles
  const getVisiblePages = (): (number | string)[] => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    
    if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, '...', totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
    }

    return pages;
  };

  if (totalItems === 0) return null;

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 ${className}`}>
      {/* Info de items */}
      <div className="text-sm text-slate-500">
        Mostrando <span className="font-medium text-slate-700">{startItem}</span> a{' '}
        <span className="font-medium text-slate-700">{endItem}</span> de{' '}
        <span className="font-medium text-slate-700">{totalItems}</span> resultados
      </div>

      <div className="flex items-center gap-4">
        {/* Selector de items por página */}
        {showItemsPerPage && onItemsPerPageChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Por página:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="px-2 py-1 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {itemsPerPageOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        )}

        {/* Controles de navegación */}
        <div className="flex items-center gap-1">
          {/* Primera página */}
          <button
            onClick={() => onPageChange(1)}
            disabled={!canGoPrev}
            className={`p-1.5 rounded-lg transition-colors ${
              canGoPrev 
                ? 'hover:bg-slate-100 text-slate-600' 
                : 'text-slate-300 cursor-not-allowed'
            }`}
            title="Primera página"
          >
            <ChevronsLeft size={18} />
          </button>

          {/* Anterior */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!canGoPrev}
            className={`p-1.5 rounded-lg transition-colors ${
              canGoPrev 
                ? 'hover:bg-slate-100 text-slate-600' 
                : 'text-slate-300 cursor-not-allowed'
            }`}
            title="Anterior"
          >
            <ChevronLeft size={18} />
          </button>

          {/* Números de página */}
          <div className="flex items-center gap-1 mx-2">
            {getVisiblePages().map((page, idx) => (
              page === '...' ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">...</span>
              ) : (
                <button
                  key={page}
                  onClick={() => onPageChange(page as number)}
                  className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  {page}
                </button>
              )
            ))}
          </div>

          {/* Siguiente */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!canGoNext}
            className={`p-1.5 rounded-lg transition-colors ${
              canGoNext 
                ? 'hover:bg-slate-100 text-slate-600' 
                : 'text-slate-300 cursor-not-allowed'
            }`}
            title="Siguiente"
          >
            <ChevronRight size={18} />
          </button>

          {/* Última página */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={!canGoNext}
            className={`p-1.5 rounded-lg transition-colors ${
              canGoNext 
                ? 'hover:bg-slate-100 text-slate-600' 
                : 'text-slate-300 cursor-not-allowed'
            }`}
            title="Última página"
          >
            <ChevronsRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Pagination;

