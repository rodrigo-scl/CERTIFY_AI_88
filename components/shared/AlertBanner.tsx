// Rodrigo Osorio v0.1 - Banner de Alertas con Carrusel
import React, { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, AlertCircle, Info, X, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { ComplianceAlert, AlertSeverity } from '../../services/alertService';

interface AlertBannerProps {
  alerts: ComplianceAlert[];
  autoRotateInterval?: number; // ms, default 5000
  onDismiss?: (alertId: string) => void;
  onClose?: () => void;
}

// Configuración de estilos por severidad
const severityStyles: Record<AlertSeverity, { bg: string; border: string; text: string; icon: string }> = {
  CRITICAL: {
    bg: 'bg-gradient-to-r from-red-600 to-red-500',
    border: 'border-red-700',
    text: 'text-white',
    icon: 'text-red-100'
  },
  WARNING: {
    bg: 'bg-gradient-to-r from-amber-500 to-orange-400',
    border: 'border-amber-600',
    text: 'text-white',
    icon: 'text-amber-100'
  },
  INFO: {
    bg: 'bg-gradient-to-r from-blue-500 to-cyan-500',
    border: 'border-blue-600',
    text: 'text-white',
    icon: 'text-blue-100'
  }
};

// Iconos por severidad
const SeverityIcon = memo(({ severity, className }: { severity: AlertSeverity; className?: string }) => {
  switch (severity) {
    case 'CRITICAL':
      return <AlertTriangle className={className} size={18} />;
    case 'WARNING':
      return <AlertCircle className={className} size={18} />;
    case 'INFO':
      return <Info className={className} size={18} />;
  }
});

export const AlertBanner = memo(({
  alerts,
  autoRotateInterval = 5000,
  onDismiss,
  onClose
}: AlertBannerProps) => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Filtrar alertas no descartadas
  const visibleAlerts = alerts.filter(a => !dismissedIds.has(a.id));

  // Auto-rotación
  useEffect(() => {
    if (visibleAlerts.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % visibleAlerts.length);
    }, autoRotateInterval);

    return () => clearInterval(timer);
  }, [visibleAlerts.length, autoRotateInterval, isPaused]);

  // Reset index si se descarta la alerta actual
  useEffect(() => {
    if (currentIndex >= visibleAlerts.length) {
      setCurrentIndex(Math.max(0, visibleAlerts.length - 1));
    }
  }, [visibleAlerts.length, currentIndex]);

  const handlePrev = useCallback(() => {
    setCurrentIndex(prev => prev === 0 ? visibleAlerts.length - 1 : prev - 1);
  }, [visibleAlerts.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % visibleAlerts.length);
  }, [visibleAlerts.length]);

  const handleDismiss = useCallback((alertId: string) => {
    setDismissedIds(prev => new Set([...prev, alertId]));
    onDismiss?.(alertId);
  }, [onDismiss]);

  const handleClick = useCallback((link?: string) => {
    if (link) {
      navigate(link);
    }
  }, [navigate]);

  // No mostrar si no hay alertas visibles
  if (visibleAlerts.length === 0) {
    return null;
  }

  const currentAlert = visibleAlerts[currentIndex];

  // Guard adicional por si currentAlert es undefined
  if (!currentAlert) {
    return null;
  }

  const styles = severityStyles[currentAlert.severity];

  return (
    <div
      className={`${styles.bg} ${styles.border} border-b shadow-sm transition-all duration-300`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="max-w-screen-2xl mx-auto px-4">
        <div className="flex items-center justify-between h-10 gap-4">

          {/* Navegación izquierda */}
          {visibleAlerts.length > 1 && (
            <button
              onClick={handlePrev}
              className={`${styles.text} opacity-70 hover:opacity-100 transition-opacity p-1`}
              aria-label="Alerta anterior"
            >
              <ChevronLeft size={18} />
            </button>
          )}

          {/* Contenido central */}
          <div
            className="flex-1 flex items-center justify-center gap-3 cursor-pointer group"
            onClick={() => handleClick(currentAlert.link)}
          >
            <SeverityIcon severity={currentAlert.severity} className={styles.icon} />

            <div className={`flex items-center gap-2 ${styles.text}`}>
              <span className="font-semibold text-sm">{currentAlert.title}:</span>
              <span className="text-sm opacity-95">{currentAlert.message}</span>
            </div>

            {currentAlert.link && (
              <ExternalLink
                size={14}
                className={`${styles.text} opacity-0 group-hover:opacity-70 transition-opacity`}
              />
            )}
          </div>

          {/* Indicadores de página */}
          {visibleAlerts.length > 1 && (
            <div className="flex items-center gap-1.5">
              {visibleAlerts.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentIndex
                      ? `${styles.text} bg-current`
                      : `${styles.text} bg-current opacity-40`
                    }`}
                  aria-label={`Ir a alerta ${idx + 1}`}
                />
              ))}
            </div>
          )}

          {/* Navegación derecha */}
          {visibleAlerts.length > 1 && (
            <button
              onClick={handleNext}
              className={`${styles.text} opacity-70 hover:opacity-100 transition-opacity p-1`}
              aria-label="Siguiente alerta"
            >
              <ChevronRight size={18} />
            </button>
          )}

          {/* Botón cerrar alerta individual */}
          {currentAlert.dismissable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss(currentAlert.id);
              }}
              className={`${styles.text} opacity-70 hover:opacity-100 transition-opacity p-1 ml-2`}
              aria-label="Descartar alerta"
            >
              <X size={16} />
            </button>
          )}

          {/* Botón cerrar todo el banner */}
          {onClose && (
            <button
              onClick={onClose}
              className={`${styles.text} opacity-70 hover:opacity-100 transition-opacity p-1 border-l border-white/20 pl-3 ml-1`}
              aria-label="Cerrar banner de alertas"
              title="Ocultar todas las alertas"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// Versión compacta para mostrar solo conteo
export const AlertBadge = memo(({
  criticalCount,
  warningCount,
  onClick
}: {
  criticalCount: number;
  warningCount: number;
  onClick?: () => void;
}) => {
  const totalCount = criticalCount + warningCount;

  if (totalCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
      title={`${criticalCount} críticas, ${warningCount} advertencias`}
    >
      <AlertTriangle size={20} className={criticalCount > 0 ? 'text-red-500' : 'text-amber-500'} />
      <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white ${criticalCount > 0 ? 'bg-red-500' : 'bg-amber-500'
        }`}>
        {totalCount > 9 ? '9+' : totalCount}
      </span>
    </button>
  );
});

