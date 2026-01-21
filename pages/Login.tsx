
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn } from '../services/authService';
import { Lock, Mail, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { ChangePasswordModal } from '../components/ChangePasswordModal';

export const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Estado para modal de cambio de contraseña
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Rodrigo Osorio v0.17 - Capas de seguridad adicionales
  const [attempts, setAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  const [honeypot, setHoneypot] = useState(''); // Anti-bot: bots llenan este campo invisible
  const [renderTime] = useState(Date.now()); // Anti-bot: verificar tiempo mínimo de interacción

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Verificar Anti-bot (Honeypot)
    if (honeypot) return;

    // 2. Verificar Anti-bot (Tiempo mínimo de 1.5s entre render y submit)
    if (Date.now() - renderTime < 1500) {
      setError('Actividad sospechosa detectada. Intente nuevamente.');
      return;
    }

    // 3. Verificar Bloqueo por fuerza bruta
    if (lockoutTime && Date.now() < lockoutTime) {
      const remainingSeconds = Math.ceil((lockoutTime - Date.now()) / 1000);
      setError(`Demasiados intentos. Intente en ${remainingSeconds} segundos.`);
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Trim email to remove accidental whitespace from copy-paste
      await signIn(email.trim(), password);

      // Reset attempts on success
      setAttempts(0);
      setLockoutTime(null);

      // Verificación de "Forzar Cambio de Contraseña"
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.must_change_password) {
        setShowChangePassword(true);
        setLoading(false); // Stop loading, show modal
        return; // Detener navegación
      }

      navigate('/');
    } catch (err: any) {
      // Rodrigo Osorio v0.17 - Mantenemos logs limpios y seguros
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= 5) {
        const lockUntil = Date.now() + 60 * 1000; // 1 minuto de bloqueo
        setLockoutTime(lockUntil);
        setError('Cuenta bloqueada temporalmente por seguridad. Espere 1 minuto.');
      } else {
        // Traducimos errores sin exponer detalles internos
        if (err.message === 'Invalid login credentials' || err.status === 400) {
          setError('Credenciales incorrectas. Verifique sus datos.');
        } else {
          setError('Error de conexión. Intente más tarde.');
        }
      }
      setLoading(false);
    }
  };

  const handleChangePasswordSuccess = () => {
    setShowChangePassword(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {/* Modal de Cambio de Contraseña Obligatorio */}
      {showChangePassword && (
        <ChangePasswordModal onSuccess={handleChangePasswordSuccess} />
      )}

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-500">
        <div className="p-8 bg-brand-600 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-white/20"></div>
          <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm shadow-inner">
            <ShieldCheck size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Certify</h1>
          <p className="text-brand-100 text-sm mt-1 font-medium">Gestión de Acreditaciones y Cumplimiento</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Honeypot Field (Invisible para humanos) */}
            <div className="absolute opacity-0 -z-50 h-0 w-0 overflow-hidden">
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={e => setHoneypot(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Correo Electrónico</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" size={18} />
                <input
                  type="email"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-sm"
                  placeholder="ejemplo@empresa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Contraseña</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" size={18} />
                <input
                  type="password"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-xs p-3.5 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
                <div className="bg-red-600 text-white rounded-full p-1 mt-0.5">
                  <Lock size={10} />
                </div>
                <span className="font-semibold leading-relaxed">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (lockoutTime !== null && Date.now() < lockoutTime)}
              className="w-full bg-brand-600 text-white py-3.5 rounded-xl font-bold hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <ShieldCheck size={20} className="group-hover:scale-110 transition-transform" />
              )}
              {loading ? 'Verificando...' : 'Ingresar al Portal'}
            </button>
          </form>

          <div className="mt-10 text-center">
            <div className="h-px bg-slate-100 w-full mb-6 relative">
              <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-[10px] text-slate-400 font-bold uppercase tracking-widest">Acceso Seguro</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">
              Este es un sistema privado. <br />
              Si no posees credenciales de acceso, contacta al administrador de TI.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};