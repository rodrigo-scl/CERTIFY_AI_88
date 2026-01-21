
import React, { useState } from 'react';
import { Lock, check, alertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { logger } from '../services/logger';
import { useNavigate } from 'react-router-dom';

interface ChangePasswordModalProps {
    onSuccess: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onSuccess }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }
        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // 1. Actualizar contraseña
            const { error: updateError } = await supabase.auth.updateUser({ password: password });
            if (updateError) throw updateError;

            // 2. Eliminar la bandera must_change_password
            const { error: metaError } = await supabase.auth.updateUser({
                data: { must_change_password: false }
            });

            if (metaError) throw metaError;

            logger.info('Password changed successfully');
            onSuccess();
        } catch (err: any) {
            logger.error('Error updating password', err);
            setError('Error al actualizar contraseña. Intente nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
        window.location.reload(); // Force reload to clear state
    };

    return (
        <div className="fixed inset-0 bg-slate-900/95 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
                <div className="bg-orange-500 p-6 flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3 text-white">
                        <Lock size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-white">Cambio de Contraseña Requerido</h2>
                    <p className="text-orange-50 text-sm mt-1">Por seguridad, debes configurar una nueva contraseña para continuar.</p>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Nueva Contraseña</label>
                            <input
                                type="password"
                                required
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Confirmar Contraseña</label>
                            <input
                                type="password"
                                required
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center gap-2">
                                <span className="font-bold">Error:</span> {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Actualizar y Entrar'}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                        <button
                            onClick={handleLogout}
                            className="text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors"
                        >
                            Cancelar y Cerrar Sesión
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
