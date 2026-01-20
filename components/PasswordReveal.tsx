// Componente PasswordReveal - Rodrigo Osorio v0.1
// Muestra contraseñas ocultas con auditoría de acceso

import React, { useState } from 'react';
import { Eye, EyeOff, Shield, Loader2 } from 'lucide-react';
import { logPasswordAccess } from '../services/auditService';

interface PasswordRevealProps {
    password: string;
    entityType: 'supplier_portal' | 'company';
    entityId: string;
    entityName: string;
    className?: string;
}

export const PasswordReveal: React.FC<PasswordRevealProps> = ({
    password,
    entityType,
    entityId,
    entityName,
    className = ''
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isLogging, setIsLogging] = useState(false);
    const [hasBeenRevealed, setHasBeenRevealed] = useState(false);

    const handleToggle = async () => {
        if (isVisible) {
            // Solo ocultar, no registrar
            setIsVisible(false);
            return;
        }

        // Registrar acceso antes de mostrar
        setIsLogging(true);
        try {
            await logPasswordAccess(entityType, entityId, entityName);
            setIsVisible(true);
            setHasBeenRevealed(true);
        } catch (error) {
            console.error('Error logging password access:', error);
            // Mostrar de todas formas si falla el log
            setIsVisible(true);
        } finally {
            setIsLogging(false);
        }
    };

    // Auto-ocultar después de 30 segundos
    React.useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => {
                setIsVisible(false);
            }, 30000); // 30 segundos
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    if (!password) {
        return <span className="text-gray-400 italic">Sin contraseña</span>;
    }

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono">
                {isVisible ? password : '••••••••'}
            </code>

            <button
                onClick={handleToggle}
                disabled={isLogging}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 
                   transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                   text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title={isVisible ? 'Ocultar contraseña' : 'Ver contraseña (se registrará el acceso)'}
            >
                {isLogging ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : isVisible ? (
                    <EyeOff className="w-4 h-4" />
                ) : (
                    <Eye className="w-4 h-4" />
                )}
            </button>

            {/* Indicador de que el acceso fue auditado */}
            {hasBeenRevealed && !isVisible && (
                <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Acceso registrado
                </span>
            )}
        </div>
    );
};

export default PasswordReveal;
