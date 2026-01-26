// Componente PasswordReveal - Rodrigo Osorio v0.2
// Muestra contraseñas ocultas con auditoría de acceso, verificación de permisos y estilo mejorado

import React, { useState } from 'react';
import { Eye, EyeOff, Shield, Loader2, Lock } from 'lucide-react';
import { logPasswordAccess } from '../services/auditService';
import { useAuth } from '../context/AuthContext';

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
    const { hasPermission } = useAuth();

    // Verificar permiso para ver contraseñas
    const canViewPasswords = hasPermission('view_portal_passwords');

    const handleToggle = async () => {
        if (isVisible) {
            // Solo ocultar, no registrar
            setIsVisible(false);
            return;
        }

        // Verificar permiso antes de revelar
        if (!canViewPasswords) {
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
            <code className="bg-white border border-red-100 px-2 py-1 rounded text-sm font-mono text-red-600">
                {isVisible ? password : '••••••••'}
            </code>

            <button
                onClick={handleToggle}
                disabled={isLogging || (!isVisible && !canViewPasswords)}
                className={`p-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                   ${!canViewPasswords && !isVisible
                        ? 'text-red-300 cursor-not-allowed'
                        : 'hover:bg-red-50 text-red-500 hover:text-red-700'}`}
                title={
                    !canViewPasswords && !isVisible
                        ? 'Sin permisos para ver contraseñas'
                        : isVisible
                            ? 'Ocultar contraseña'
                            : 'Ver contraseña (se registrará el acceso)'
                }
            >
                {isLogging ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : !canViewPasswords && !isVisible ? (
                    <Lock className="w-4 h-4" />
                ) : isVisible ? (
                    <EyeOff className="w-4 h-4" />
                ) : (
                    <Eye className="w-4 h-4" />
                )}
            </button>

            {/* Indicador de que el acceso fue auditado */}
            {hasBeenRevealed && !isVisible && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Auditado
                </span>
            )}
        </div>
    );
};

export default PasswordReveal;
