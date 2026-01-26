// Optimizado por Rodrigo Osorio - v0.10: Performance mejorada con memoización
import React, { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, MapPin, FolderOpen, Settings,
  Menu, X, Bell, Bot, LogOut, Sparkles, MessageSquare, Copy, Check,
  AlertTriangle, Clock, FileText, BarChart3, ChevronLeft, ChevronRight, Briefcase, Sliders, CalendarDays, ShieldCheck
} from 'lucide-react';
import { sendMessageToAssistant } from '../services/geminiService';
import { useAuth } from '../context/AuthContext';
import { signOut } from '../services/authService';
import { SimpleMarkdown } from './shared/SimpleMarkdown';
import { AlertBanner } from './shared/AlertBanner';
import { getComplianceAlerts, ComplianceAlert } from '../services/alertService';
import { GlobalSearch } from './shared/GlobalSearch';
import { logger } from '../services/logger';
import { useFaviconBadge } from '../hooks/useFaviconBadge';
import { useAutoLogout } from '../hooks/useAutoLogout';

interface LayoutProps {
  children?: React.ReactNode;
}

// Rodrigo Osorio v0.8 - Sidebar colapsable para ganar espacio horizontal
// Componente memoizado para evitar re-renders cuando cambia el estado del sidebar
const SidebarItem = memo(({ to, icon: Icon, label, active, collapsed }: { to: string, icon: any, label: string, active: boolean, collapsed: boolean }) => (
  <Link
    to={to}
    className={`flex items-center ${collapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 rounded-xl transition-colors duration-200 group
      ${active
        ? 'bg-white/10 text-white shadow-lg backdrop-blur-md border border-white/10'
        : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
  >
    <Icon size={20} className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`} />
    {!collapsed && <span className="font-medium truncate">{label}</span>}
  </Link>
));

// Rodrigo Osorio v0.3 - Certify AI Modal mejorado
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

// Memoizar el modal completo para evitar re-renders cuando no está abierto
const AIAssistantModal = memo(({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('urgente');
  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([]);

  const PROMPT_CATEGORIES = {
    urgente: {
      icon: AlertTriangle,
      label: 'Urgente',
      color: 'text-red-500',
      prompts: [
        "¿Qué técnicos tienen documentos vencidos?",
        "Lista técnicos que requieren atención urgente",
        "¿Cuántos documentos vencen esta semana?",
      ]
    },
    tecnicos: {
      icon: Users,
      label: 'Técnicos',
      color: 'text-blue-500',
      prompts: [
        "¿Hay técnicos con documentos pendientes?",
        "Resumen de cumplimiento por técnico",
        "¿Cuál es el técnico con mejor cumplimiento?",
      ]
    },
    empresas: {
      icon: Building2,
      label: 'Empresas',
      color: 'text-green-500',
      prompts: [
        "Estado de cumplimiento por empresa",
        "¿Qué empresas tienen técnicos con documentos vencidos?",
        "Resumen de documentación corporativa",
      ]
    },
    reportes: {
      icon: BarChart3,
      label: 'Reportes',
      color: 'text-purple-500',
      prompts: [
        "Dame un resumen general de cumplimiento",
        "Estadísticas de documentos por estado",
        "Redacta un correo de recordatorio para vencidos",
      ]
    },
    eps: {
      icon: Briefcase,
      label: 'EPS',
      color: 'text-orange-500',
      prompts: [
        "¿Qué EPS tenemos registradas y cuántos técnicos tiene cada una?",
        "Dame la lista de técnicos agrupados por EPS",
        "¿Qué empresas cliente atiende cada EPS?",
        "Resumen de cobertura por Empresa Prestadora de Servicio",
      ]
    },
    sucursales: {
      icon: MapPin,
      label: 'Sucursales',
      color: 'text-teal-500',
      prompts: [
        "¿Qué sucursales tenemos y cuántos técnicos hay en cada una?",
        "¿Cuál es el cumplimiento por sucursal?",
        "Lista los técnicos vencidos por sucursal",
        "¿Qué sucursal tiene el menor cumplimiento?",
      ]
    }
  };

  const handleAsk = useCallback(async (textOverride?: string) => {
    const textToUse = textOverride || query;
    if (!textToUse.trim() || loading) return;

    // Agregar mensaje del usuario al historial
    const userMessage: ChatMessage = { role: 'user', content: textToUse, timestamp: new Date() };
    setHistory(prev => [...prev, userMessage]);
    setQuery('');
    setLoading(true);

    try {
      // Get response with suggestions from Edge Function
      const response = await sendMessageToAssistant(textToUse);
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
        suggestions: response.suggestions
      };
      setHistory(prev => [...prev, assistantMessage]);
      setCurrentSuggestions(response.suggestions || []);
    } catch (err) {
      const errorMessage: ChatMessage = { role: 'assistant', content: 'Error al procesar la consulta.', timestamp: new Date() };
      setHistory(prev => [...prev, errorMessage]);
      setCurrentSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [query, loading]);

  const handleCopy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setQuery('');
  }, []);

  if (!isOpen) return null;

  const currentCategory = PROMPT_CATEGORIES[activeCategory as keyof typeof PROMPT_CATEGORIES];

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all animate-in fade-in">
      <div className="bg-white/90 backdrop-blur-xl border border-white/20 rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 flex justify-between items-center text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/20 rounded-xl">
              <Sparkles size={20} className="text-brand-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Certify AI</h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Conversational Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Limpiar historial
              </button>
            )}
            <button onClick={onClose} className="bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-all">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
          {history.length === 0 ? (
            <div className="space-y-6">
              {/* Welcome */}
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-3 border border-slate-100">
                  <Bot size={28} className="text-brand-500" />
                </div>
                <h4 className="text-slate-800 font-bold text-lg">¿En qué puedo ayudarte?</h4>
                <p className="text-sm text-slate-500 mt-1">Consulta datos en tiempo real sobre técnicos, empresas y documentos</p>
              </div>

              {/* Category Tabs */}
              <div className="flex gap-2 justify-center flex-wrap">
                {Object.entries(PROMPT_CATEGORIES).map(([key, cat]) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveCategory(key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${activeCategory === key
                        ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-300'
                        : 'bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                      <Icon size={14} className={activeCategory === key ? 'text-brand-600' : cat.color} />
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              {/* Prompts */}
              <div className="grid gap-3">
                {currentCategory.prompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleAsk(prompt)}
                    disabled={loading}
                    className="text-left p-4 rounded-2xl border border-slate-100 bg-white hover:border-brand-300 hover:bg-brand-50/50 hover:shadow-sm transition-all group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                        <MessageSquare size={16} className="text-slate-400 group-hover:text-brand-600" />
                      </div>
                      <span className="text-sm font-medium text-slate-700 group-hover:text-brand-900">{prompt}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'gap-3'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center shrink-0">
                      <Bot size={16} className="text-white" />
                    </div>
                  )}
                  <div className={`max-w-[85%] ${msg.role === 'user'
                    ? 'bg-brand-100 text-brand-900 px-4 py-2 rounded-t-xl rounded-bl-xl'
                    : 'bg-white p-4 rounded-b-xl rounded-tr-xl border border-slate-200 shadow-sm'
                    }`}>
                    {msg.role === 'assistant' ? (
                      <SimpleMarkdown
                        text={msg.content}
                        className="text-sm leading-relaxed"
                        onLinkClick={onClose}
                      />
                    ) : (
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    )}
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleCopy(msg.content)}
                          className="text-xs text-slate-400 hover:text-brand-600 flex items-center gap-1 transition-colors"
                        >
                          {copied ? <Check size={12} /> : <Copy size={12} />}
                          {copied ? 'Copiado' : 'Copiar'}
                        </button>
                        <span className="text-xs text-slate-300">
                          <Clock size={10} className="inline mr-1" />
                          {msg.timestamp.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center shrink-0">
                    <Bot size={16} className="text-white" />
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-brand-500 border-t-transparent"></div>
                      Analizando...
                    </div>
                  </div>
                </div>
              )}

              {/* Follow-up Suggestions */}
              {!loading && currentSuggestions.length > 0 && history.length > 0 && (
                <div className="mt-4 p-3 bg-gradient-to-r from-slate-50 to-brand-50/50 rounded-xl border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 mb-2">Preguntas relacionadas:</p>
                  <div className="flex flex-wrap gap-2">
                    {currentSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAsk(suggestion)}
                        className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-full text-slate-700 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAsk()}
              placeholder="Escribe tu pregunta aquí..."
              disabled={loading}
              className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all text-sm disabled:opacity-50"
            />
            <button
              onClick={() => handleAsk()}
              disabled={loading || !query.trim()}
              className="bg-brand-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              ) : (
                'Enviar'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const { user, isAdmin, hasPermission } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Rodrigo Osorio v0.8 - sidebar colapsable sin romper UX

  // Rodrigo Osorio v1.0 - Sistema de alertas optimizado (sin recarga en cada navegación)
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
  const [showAlertBanner, setShowAlertBanner] = useState<boolean>(() => {
    const saved = localStorage.getItem('certify_show_alerts');
    return saved !== 'false';
  });

  // Cargar alertas solo al montar + intervalo de 5 minutos (NO en cada cambio de ruta)
  useEffect(() => {
    if (!showAlertBanner) return;

    // Carga inicial
    getComplianceAlerts().then(setAlerts).catch(logger.error);

    // Actualizar cada 5 minutos para mantener datos frescos sin sobrecargar
    const interval = setInterval(() => {
      getComplianceAlerts().then(setAlerts).catch(logger.error);
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [showAlertBanner]); // Sin location.pathname - evita queries en cada navegación

  // Memoizar el toggle de alertas
  const toggleAlertBanner = useCallback(() => {
    const newValue = !showAlertBanner;
    setShowAlertBanner(newValue);
    localStorage.setItem('certify_show_alerts', String(newValue));
  }, [showAlertBanner]);

  const isActive = useCallback((path: string) => {
    if (path === '/') return location.pathname === '/';
    // Rodrigo Osorio v1.0 - Usar startsWith para que las sub-rutas mantengan resaltado el ítem padre
    return location.pathname.startsWith(path);
  }, [location.pathname]);

  // Rodrigo Osorio v1.0 - Actualizar favicon con badge
  useFaviconBadge(alerts.length);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (err) {
      logger.error('Error al cerrar sesión:', err);
    } finally {
      // Forzar recarga completa para limpiar todo el estado
      window.location.href = window.location.origin + '/#/login';
      window.location.reload();
    }
  }, []);

  // Rodrigo Osorio v1.0 - Auto-Logout por inactividad (30 min)
  useAutoLogout(30 * 60 * 1000, handleSignOut, !!user);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar - Desktop & Mobile */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 ${sidebarCollapsed ? 'w-24' : 'w-72'} bg-slate-900 text-white transform transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0
      `}>
        <div className="h-full flex flex-col glass-dark border-r border-white/5">
          <div className={`p-8 flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-4'}`}>
            <div className="w-10 h-10 bg-brand-500 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/20 rotate-3 hover:rotate-0 transition-transform duration-300 cursor-pointer">
              <span className="font-black text-white text-xl">C</span>
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col">
                <h1 className="text-xl font-bold tracking-tight leading-none">Certify</h1>
                <span className="text-[10px] text-slate-500 font-semibold tracking-widest mt-1">MANAGEMENT</span>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="ml-auto hidden lg:inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
          <nav className={`flex-1 ${sidebarCollapsed ? 'px-1' : 'px-3'} py-6 space-y-1 overflow-y-auto`}>
            <SidebarItem key="nav-dash" to="/" icon={LayoutDashboard} label="Dashboard" active={isActive('/')} collapsed={sidebarCollapsed} />
            <SidebarItem key="nav-tech" to="/technicians" icon={Users} label="Técnicos" active={isActive('/technicians')} collapsed={sidebarCollapsed} />
            <SidebarItem key="nav-comp" to="/companies" icon={Building2} label="Empresas" active={isActive('/companies')} collapsed={sidebarCollapsed} />
            <SidebarItem key="nav-bran" to="/branches" icon={MapPin} label="Sucursales" active={isActive('/branches')} collapsed={sidebarCollapsed} />
            <SidebarItem key="nav-avail" to="/availability" icon={CalendarDays} label="Disponibilidad" active={isActive('/availability')} collapsed={sidebarCollapsed} />

            {(isAdmin || hasPermission('view_parameters') || hasPermission('view_audit')) && (
              <div className="pt-4 pb-2">
                {!sidebarCollapsed && <div className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 opacity-50">Administración</div>}
                {hasPermission('view_parameters') && (
                  <SidebarItem key="nav-para" to="/parameters" icon={Sliders} label="Parámetros" active={isActive('/parameters')} collapsed={sidebarCollapsed} />
                )}
                {isAdmin && (
                  <SidebarItem key="nav-sett" to="/settings" icon={Settings} label="Configuración" active={isActive('/settings')} collapsed={sidebarCollapsed} />
                )}
                {hasPermission('view_audit') && (
                  <SidebarItem key="nav-audit" to="/audit" icon={ShieldCheck} label="Auditoría" active={isActive('/audit')} collapsed={sidebarCollapsed} />
                )}
              </div>
            )}
          </nav>

          <div className={`p-6 border-t border-white/5 ${sidebarCollapsed ? 'items-center' : ''}`}>
            <div className={`flex ${sidebarCollapsed ? 'flex-col items-center gap-4' : 'items-center gap-4'} mb-6 p-2 rounded-2xl transition-colors hover:bg-white/5`}>
              <div className="relative">
                <img
                  src={`https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=0ea5e9&color=fff&bold=true`}
                  alt="User"
                  className="w-10 h-10 rounded-2xl shadow-lg"
                  loading="lazy"
                />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></div>
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate tracking-tight">{user?.name || 'Invitado'}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{user?.role || 'Visitante'}</p>
                </div>
              )}
            </div>
            <button
              onClick={handleSignOut}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-center gap-2'} px-4 py-3 text-xs font-bold text-slate-500 hover:text-white hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all duration-300`}
            >
              <LogOut size={16} /> {!sidebarCollapsed && 'Cerrar Sesión'}
            </button>
          </div>
        </div>
      </aside >

      {/* Overlay for mobile */}
      {
        sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )
      }

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
        {/* Alert Banner - Rodrigo Osorio v0.9 */}
        {showAlertBanner && alerts.length > 0 && (
          <AlertBanner
            alerts={alerts}
            autoRotateInterval={5000}
            onDismiss={(id) => setAlerts(prev => prev.filter(a => a.id !== id))}
            onClose={toggleAlertBanner}
          />
        )}


        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 h-20 flex items-center justify-between px-8 sm:px-12 shrink-0 z-20 gap-4">
          <div className="flex items-center gap-6 shrink-0">
            <button
              className="md:hidden p-3 text-slate-600 hover:bg-slate-100 rounded-2xl transition-colors"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu size={24} />
            </button>
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight capitalize hidden sm:block">
                {(() => {
                  if (location.pathname === '/') return 'Resumen General';
                  const primaryPath = location.pathname.split('/')[1];
                  const titleMap: Record<string, string> = {
                    'technicians': 'Técnicos',
                    'companies': 'Empresas',
                    'branches': 'Sucursales',
                    'settings': 'Configuración',
                    'parameters': 'Parámetros',
                    'availability': 'Disponibilidad',
                    'audit': 'Auditoría'
                  };
                  return titleMap[primaryPath] || primaryPath;
                })()}
              </h2>
              <p className="text-xs text-slate-400 font-medium hidden sm:block">
                {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>

          {/* Global Search - Rodrigo Osorio v0.11 */}
          <div className="flex-1 max-w-xl mx-auto hidden md:block">
            <GlobalSearch />
          </div>

          <div className="flex items-center gap-6 shrink-0">
            <button
              onClick={() => setAiModalOpen(true)}
              className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-brand-600 hover:shadow-lg hover:shadow-brand-500/20 transition-all duration-300"
            >
              <Sparkles size={16} className="text-brand-400" />
              Certify AI
            </button>
            <div className="h-10 w-[1px] bg-slate-100 mx-2"></div>
            <div className="relative group cursor-pointer">
              <div className="p-2.5 bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-brand-500 rounded-xl transition-all">
                <Bell size={20} />
              </div>
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-auto p-4 sm:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      <AIAssistantModal isOpen={aiModalOpen} onClose={() => setAiModalOpen(false)} />
    </div >
  );
};