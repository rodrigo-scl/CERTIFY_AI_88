// Rodrigo Osorio v0.10 - Simplified Settings focusing on Users/System/Security
import React, { useState, useEffect } from 'react';
import {
  Shield, Plus, Save, Trash2, X, Edit2, User as UserIcon, Server, Lock, AlertTriangle, RefreshCw, Activity, Loader2, Building2, Bot, Sparkles
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import {
  getUsers, addUser, getBranches, updateUserBranches
} from '../services/dataService';
import { AppUser, Branch } from '../types';
import { useAuth } from '../context/AuthContext';

// --- SUB-COMPONENTS FOR EACH SETTING TAB ---

// 1. USERS CONFIGURATION
const UsersSettings = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'Supervisor',
    password: 'tempPassword123!',
    assignedBranchIds: [] as string[]
  });
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getUsers().then(setUsers);
    getBranches().then(setBranches);
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email) return;
    setLoading(true);
    await addUser(newUser);
    setUsers(await getUsers());
    setNewUser({
      name: '',
      email: '',
      role: 'Supervisor',
      password: 'tempPassword123!',
      assignedBranchIds: []
    });
    setLoading(false);
  };

  const handleUpdateBranches = async (userId: string, branchIds: string[]) => {
    setLoading(true);
    const result = await updateUserBranches(userId, branchIds);
    if (result.success) {
      setUsers(await getUsers());
      setEditingUser(null);
    } else {
      alert(result.error || 'Error al actualizar sucursales');
    }
    setLoading(false);
  };

  const toggleBranch = (branchId: string, isNew: boolean = true) => {
    if (isNew) {
      setNewUser(prev => ({
        ...prev,
        assignedBranchIds: prev.assignedBranchIds.includes(branchId)
          ? prev.assignedBranchIds.filter(id => id !== branchId)
          : [...prev.assignedBranchIds, branchId]
      }));
    } else if (editingUser) {
      const currentIds = editingUser.assignedBranchIds || [];
      const newIds = currentIds.includes(branchId)
        ? currentIds.filter(id => id !== branchId)
        : [...currentIds, branchId];
      setEditingUser({ ...editingUser, assignedBranchIds: newIds });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 animate-in fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 border-r border-slate-100 pr-0 lg:pr-8">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><UserIcon size={20} className="text-brand-600" /> Invitar Usuario</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input type="email" required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white outline-none focus:border-brand-500"
                value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="email@empresa.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
              <input type="text" required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white outline-none focus:border-brand-500"
                value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="Nombre completo" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
              <select className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none bg-white font-medium text-slate-900"
                value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                <option>Administrador</option>
                <option>Supervisor</option>
                <option>Gerente de Sucursal</option>
                <option>Auditor</option>
                <option>Técnico</option>
              </select>
            </div>

            {newUser.role === 'Gerente de Sucursal' && (
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Asignar Sucursales</label>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-2">
                  {branches.map(b => (
                    <label key={b.id} className="flex items-center gap-2 p-1 hover:bg-white rounded cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={newUser.assignedBranchIds.includes(b.id)}
                        onChange={() => toggleBranch(b.id, true)}
                        className="rounded text-brand-600"
                      />
                      <span className="text-sm text-slate-700">{b.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña Temporal</label>
              <input type="text" required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none focus:border-brand-500 font-mono text-sm bg-slate-50"
                value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
            </div>
            <button disabled={loading} className="w-full bg-brand-600 text-white py-2 rounded-lg font-medium hover:bg-brand-700 mt-2 disabled:opacity-50 transition-all shadow-lg shadow-brand-500/10">
              {loading ? 'Procesando...' : 'Crear Usuario'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Usuarios Activos</h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {users.map(u => (
              <div key={u.id} className="p-4 border border-slate-100 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold overflow-hidden">
                      <img src={`https://ui-avatars.com/api/?name=${u.name}&background=random`} alt={u.name} />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{u.name}</div>
                      <div className="text-xs text-slate-50">{u.email}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded font-medium mb-1">{u.role}</span>
                    <div className="text-xs text-slate-400">Último acceso: {u.lastLogin || 'Nunca'}</div>
                  </div>
                </div>

                {u.role === 'Gerente de Sucursal' && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase">Sucursales Asignadas ({u.assignedBranchIds?.length || 0})</span>
                      <button
                        onClick={() => setEditingUser(u)}
                        className="text-xs text-brand-600 font-bold hover:underline"
                      >
                        Gestionar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {u.assignedBranchIds && u.assignedBranchIds.length > 0 ? (
                        u.assignedBranchIds.map(bId => {
                          const branch = branches.find(b => b.id === bId);
                          return branch ? (
                            <span key={bId} className="px-2 py-0.5 bg-white border border-slate-200 text-[10px] text-slate-600 rounded-full">
                              {branch.name}
                            </span>
                          ) : null;
                        })
                      ) : (
                        <span className="text-[10px] text-red-400 italic">Sin sucursales asignadas</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h4 className="font-bold text-slate-900">Gestionar Sucursales</h4>
                <p className="text-xs text-slate-500">{editingUser.name}</p>
              </div>
              <button onClick={() => setEditingUser(null)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="p-5">
              <div className="space-y-1 max-h-60 overflow-y-auto pr-2 mb-6">
                {branches.map(b => (
                  <label key={b.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={editingUser.assignedBranchIds?.includes(b.id)}
                      onChange={() => toggleBranch(b.id, false)}
                      className="rounded text-brand-600"
                    />
                    <span className="text-sm text-slate-700">{b.name}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleUpdateBranches(editingUser.id, editingUser.assignedBranchIds || [])}
                  disabled={loading}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 2. SYSTEM TOOLS
const SystemSettings = () => {
  const [running, setRunning] = useState(false);
  const [showAlerts, setShowAlerts] = useState<boolean>(() => {
    const saved = localStorage.getItem('certify_show_alerts');
    return saved !== 'false';
  });

  const handleValidate = () => { setRunning(true); setTimeout(() => setRunning(false), 2000); };

  const handleToggleAlerts = () => {
    const newValue = !showAlerts;
    setShowAlerts(newValue);
    localStorage.setItem('certify_show_alerts', String(newValue));
    window.location.reload();
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm animate-in fade-in">
      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Server size={20} className="text-brand-600" /> Herramientas del Sistema
      </h3>

      <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h4 className="font-bold text-slate-900">Banner de Alertas de Cumplimiento</h4>
              <p className="text-xs text-slate-500">Muestra alertas sobre técnicos/empresas con problemas de documentación</p>
            </div>
          </div>
          <button
            onClick={handleToggleAlerts}
            className={`relative w-14 h-7 rounded-full transition-colors ${showAlerts ? 'bg-brand-600' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${showAlerts ? 'left-8' : 'left-1'}`}></span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-slate-200 rounded-lg p-5 hover:border-brand-200 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><RefreshCw size={24} className={running ? 'animate-spin' : ''} /></div>
            <div>
              <h4 className="font-bold text-slate-900">Validador de Conformidad</h4>
              <p className="text-xs text-slate-500">Recalcula todos los estados de cumplimiento</p>
            </div>
          </div>
          <button onClick={handleValidate} disabled={running} className="w-full py-2 bg-slate-50 text-brand-600 text-sm font-bold rounded hover:bg-brand-50 transition-colors">
            {running ? 'Procesando...' : 'Ejecutar Validación'}
          </button>
        </div>

        <div className="border border-slate-200 rounded-lg p-5 hover:border-brand-200 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Activity size={24} /></div>
            <div>
              <h4 className="font-bold text-slate-900">Migración de Credenciales</h4>
              <p className="text-xs text-slate-500">Normalizar datos antiguos sin companyId</p>
            </div>
          </div>
          <button className="w-full py-2 bg-slate-50 text-slate-600 text-sm font-bold rounded hover:bg-slate-100 transition-colors">
            Iniciar Asistente
          </button>
        </div>
      </div>
    </div>
  );
};

// 3. AI SETTINGS - Quota configuration
const AISettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [usage, setUsage] = useState<{ userId: string, email: string, count: number }[]>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    // Load quota settings
    const { data: settings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'ai_quotas')
      .single();

    if (settings?.value) {
      setEnabled(settings.value.enabled ?? true);
      setDailyLimit(settings.value.daily_limit ?? 50);
    }

    // Load usage stats
    const { data: usageData } = await supabase
      .from('ai_usage')
      .select('user_id, query_count')
      .order('query_count', { ascending: false })
      .limit(20);

    // Get user emails
    if (usageData?.length) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email')
        .in('id', usageData.map(u => u.user_id));

      const userMap = new Map((users || []).map(u => [u.id, u.email]));
      setUsage(usageData.map(u => ({
        userId: u.user_id,
        email: userMap.get(u.user_id) || 'Usuario',
        count: u.query_count
      })));
    }

    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    await supabase
      .from('system_settings')
      .upsert({
        key: 'ai_quotas',
        value: { enabled, daily_limit: dailyLimit },
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
    setSaving(false);
  };

  const resetAllUsage = async () => {
    if (confirm('¿Resetear el contador de consultas de todos los usuarios?')) {
      await supabase.from('ai_usage').update({ query_count: 0, reset_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }).neq('user_id', '');
      loadSettings();
    }
  };

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm animate-in fade-in">
      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Sparkles size={20} className="text-brand-600" /> Configuración de Certify AI
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Toggle enabled */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-50 text-brand-600 rounded-lg"><Bot size={24} /></div>
              <div>
                <h4 className="font-bold text-slate-900">Cuotas de Consultas</h4>
                <p className="text-xs text-slate-500">Limitar consultas diarias por usuario</p>
              </div>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative w-14 h-7 rounded-full transition-colors ${enabled ? 'bg-brand-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'left-8' : 'left-1'}`}></span>
            </button>
          </div>
        </div>

        {/* Daily limit */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <label className="block text-sm font-bold text-slate-700 mb-2">Límite diario por usuario</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="1"
              max="500"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(parseInt(e.target.value) || 50)}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            <span className="text-sm text-slate-500">consultas/día</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-4 py-2 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Guardar Configuración
        </button>
        <button
          onClick={resetAllUsage}
          className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Resetear Contadores
        </button>
      </div>

      {/* Usage stats */}
      {usage.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-3">Uso de IA por Usuario (Hoy)</h4>
          <div className="bg-slate-50 rounded-lg border border-slate-200 divide-y divide-slate-200">
            {usage.map((u) => (
              <div key={u.userId} className="flex items-center justify-between p-3">
                <span className="text-sm text-slate-700">{u.email}</span>
                <span className={`text-sm font-bold ${u.count >= dailyLimit ? 'text-red-600' : 'text-slate-900'}`}>
                  {u.count} / {dailyLimit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// 4. SECURITY DASHBOARD
const SecuritySettings = () => {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm animate-in fade-in">
      <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
        <Lock size={20} className="text-brand-600" /> Seguridad y Auditoría
      </h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
          <div className="flex items-center gap-3">
            <Shield size={24} className="text-green-600" />
            <div>
              <div className="font-bold text-slate-900">Autenticación Supabase</div>
              <div className="text-xs text-slate-500">MFA no habilitado para todos los roles</div>
            </div>
          </div>
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Activo</span>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
          <div className="flex items-center gap-3">
            <Lock size={24} className="text-blue-600" />
            <div>
              <div className="font-bold text-slate-900">Encriptación en Reposo</div>
              <div className="text-xs text-slate-500">AES-256 habilitado en base de datos</div>
            </div>
          </div>
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Seguro</span>
        </div>
      </div>
    </div>
  );
};

// --- MAIN PAGE ---

const SettingTab = ({ label, icon: Icon, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all w-full md:w-auto
      ${active ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}
  >
    <Icon size={18} />
    {label}
  </button>
);

export const Settings = () => {
  const { isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('users');

  if (loading) return <div>Cargando...</div>;

  if (!isAdmin) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="bg-red-50 p-4 rounded-full mb-4">
          <AlertTriangle size={48} className="text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Acceso Restringido</h2>
        <p className="text-slate-500 max-w-md">No tienes permisos de Administrador para ver esta sección.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Configuración</h1>
        <p className="text-sm text-slate-500 font-medium tracking-tight">Gestión de usuarios, auditoría y seguridad del sistema</p>
      </div>

      <div className="flex flex-col md:flex-row flex-wrap gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <SettingTab label="Usuarios" icon={UserIcon} active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
        <SettingTab label="Sistema" icon={Server} active={activeTab === 'system'} onClick={() => setActiveTab('system')} />
        <SettingTab label="Certify AI" icon={Bot} active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} />
        <SettingTab label="Seguridad" icon={Shield} active={activeTab === 'security'} onClick={() => setActiveTab('security')} />
      </div>

      <div className="min-h-[500px] mt-6">
        {activeTab === 'users' && <UsersSettings />}
        {activeTab === 'system' && <SystemSettings />}
        {activeTab === 'ai' && <AISettings />}
        {activeTab === 'security' && <SecuritySettings />}
      </div>
    </div>
  );
};