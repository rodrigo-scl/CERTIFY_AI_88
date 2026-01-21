import { useEffect, useCallback, useRef } from 'react';
import { logger } from '../services/logger';

// Eventos que se consideran "actividad"
const ACTIVITY_EVENTS = [
    'mousedown',
    'mousemove',
    'keydown',
    'scroll',
    'touchstart',
    'click'
];

/**
 * Hook para cerrar sesión automáticamente tras inactividad
 * @param timeoutMs Tiempo en ms antes del logout (default: 30 min)
 * @param onLogout Función a ejecutar al expirar el tiempo (logout)
 * @param isActive Flag para activar/desactivar el hook (ej: solo si user está logueado)
 */
export const useAutoLogout = (
    timeoutMs: number = 30 * 60 * 1000,
    onLogout: () => void,
    isActive: boolean = true
) => {
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const lastActivityRef = useRef<number>(Date.now());

    const resetTimer = useCallback(() => {
        if (!isActive) return;

        // Throttle: Solo resetear si han pasado más de 1s para evitar sobrecarga en mousemove
        if (Date.now() - lastActivityRef.current < 1000) return;

        lastActivityRef.current = Date.now();

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
            logger.warn(`Auto-logout triggered due to inactivity (${timeoutMs}ms)`);
            onLogout();
        }, timeoutMs);
    }, [isActive, onLogout, timeoutMs]);

    useEffect(() => {
        if (!isActive) return;

        // Iniciar timer inicial
        resetTimer();

        // Agregar listeners
        ACTIVITY_EVENTS.forEach(event => {
            window.addEventListener(event, resetTimer);
        });

        // Cleanup
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            ACTIVITY_EVENTS.forEach(event => {
                window.removeEventListener(event, resetTimer);
            });
        };
    }, [isActive, resetTimer]);
};
