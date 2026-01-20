// Utilidad de logging condicional - Rodrigo Osorio v0.1
// Solo muestra logs en modo desarrollo, protegiendo información sensible en producción

const isDevelopment = import.meta.env.MODE === 'development';

export const logger = {
  // Log informativo (solo en desarrollo)
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  // Advertencias (solo en desarrollo)
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  // Errores (siempre se muestran pero sanitizados en producción)
  error: (message: string, error?: any) => {
    if (isDevelopment) {
      console.error(message, error);
    } else {
      // En producción, solo mostrar mensaje genérico sin detalles técnicos
      console.error(message);
    }
  },

  // Info (solo en desarrollo)
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  // Debug (solo en desarrollo)
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  }
};

// Función para logging estructurado de operaciones (solo en desarrollo)
export const logOperation = (
  operation: string,
  category: string,
  details: Record<string, any>
) => {
  if (isDevelopment) {
    console.log(`[${category}]`, {
      operation,
      timestamp: new Date().toISOString(),
      ...details
    });
  }
};

