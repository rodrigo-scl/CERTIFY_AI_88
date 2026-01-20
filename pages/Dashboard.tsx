// Rodrigo Osorio v0.11 - Dashboard optimizado con debouncing para escalabilidad
import React, { useEffect, useState, useMemo, memo, useCallback } from 'react';
import {
  Users, Building2, FileCheck, AlertTriangle, RefreshCw,
  ChevronRight, LayoutDashboard, ClipboardList, Search,
  ChevronLeft, ChevronsLeft, ChevronsRight, Filter, ArrowUpDown,
  Zap, TrendingUp, ShieldCheck, Activity
} from 'lucide-react';
import {
  getDashboardStats, getCompanies, getCompaniesLight, getCompaniesAtRisk,
  CompanyTechnicianCompliance, getBranchRanking, BranchRanking, getDashboardStatsSummary,
  getProblematicTechniciansSummary
} from '../services/dataService';
import { StatusBadge } from '../components/shared/StatusBadge';
import { Technician, Company, ComplianceStatus } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { Skeleton } from '../components/shared/Skeleton';
import { useAuth } from '../context/AuthContext';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip
} from 'recharts';

// Barra de progreso compacta para tabla
const MiniProgressBar = memo(({ percentage }: { percentage: number }) => (
  <div className="flex items-center gap-2 min-w-[100px]">
    <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full ${percentage >= 80 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
        style={{ width: `${percentage}%` }}
      />
    </div>
    <span className={`text-xs font-medium w-10 text-right ${percentage >= 80 ? 'text-green-600' : percentage >= 50 ? 'text-yellow-600' : 'text-red-600'
      }`}>
      {percentage}%
    </span>
  </div>
));

// Metric Card Minimalista
const MetricCard = memo(({ label, value, subValue, status }: {
  label: string;
  value: string | number;
  subValue?: string;
  status?: 'good' | 'warning' | 'critical';
}) => {
  const statusColors = {
    good: 'text-emerald-600',
    warning: 'text-amber-600',
    critical: 'text-rose-600'
  };

  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-black tracking-tighter ${status ? statusColors[status] : 'text-slate-900'}`}>
          {value}
        </span>
        {subValue && <span className="text-xs font-bold text-slate-400">{subValue}</span>}
      </div>
    </div>
  );
});

// Compliance Bar Minimalista
const ComplianceBar = memo(({ rate, label }: { rate: number; label: string }) => (
  <div className="flex-1">
    <div className="flex justify-between items-center mb-2">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
      <span className={`text-sm font-black ${rate >= 80 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-rose-600'
        }`}>{rate}%</span>
    </div>
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-1000 ${rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-rose-500'
          }`}
        style={{ width: `${rate}%` }}
      />
    </div>
  </div>
));

// Tipo para datos de empresa procesados
interface CompanyAccreditationData {
  id: string;
  name: string;
  industry: string;
  totalTechs: number;
  validTechs: number;
  techPercentage: number;
  totalDocs: number;
  loadedDocs: number;
  docPercentage: number;
  overallStatus: 'critical' | 'warning' | 'good';
}

// Branch Ranking Leaderboard - Snapshot cada 3h
const BranchRankingBoard = memo(({ ranking }: { ranking: BranchRanking[] }) => {
  if (!ranking || ranking.length === 0) return null;

  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/20">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Desempeño por Sucursal</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Métricas de cumplimiento corporativo</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
            Snapshot: {new Date(ranking[0].lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-50">
              <th className="pb-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Sucursal</th>
              <th className="pb-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Técnicos</th>
              <th className="pb-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">EPS (Empresa)</th>
              <th className="pb-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Cumplimiento Global</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {ranking.map((branch) => (
              <tr key={branch.branchId} className="group hover:bg-slate-50/50 transition-colors">
                <td className="py-5 px-2">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-8 bg-slate-100 rounded-full group-hover:bg-brand-500 transition-colors" />
                    <span className="text-sm font-bold text-slate-700">{branch.branchName}</span>
                  </div>
                </td>
                <td className="py-5 px-2 text-center text-sm font-bold text-slate-600">
                  {branch.techComplianceRate}%
                </td>
                <td className="py-5 px-2 text-center text-sm font-bold text-slate-600">
                  {branch.epsComplianceRate}%
                </td>
                <td className="py-5 px-2">
                  <div className="flex items-center justify-end gap-3">
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${branch.globalScore >= 80 ? 'bg-emerald-500' :
                          branch.globalScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                        style={{ width: `${branch.globalScore}%` }}
                      />
                    </div>
                    <span className={`text-sm font-black w-10 text-right ${branch.globalScore >= 80 ? 'text-emerald-600' :
                      branch.globalScore >= 50 ? 'text-amber-600' : 'text-rose-600'
                      }`}>
                      {branch.globalScore}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

// Componente principal del Dashboard
export const Dashboard = () => {
  const { user, isBranchManager } = useAuth();
  const [activeTab, setActiveTab] = useState<'resumen' | 'acreditaciones'>('resumen');
  const [stats, setStats] = useState<any>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [problemTechs, setProblemTechs] = useState<Technician[]>([]);
  const [riskCompanies, setRiskCompanies] = useState<CompanyTechnicianCompliance[]>([]);
  const [priorityTab, setPriorityTab] = useState<'techs' | 'companies'>('techs');
  const [prioritySearch, setPrioritySearch] = useState('');
  const [branchRanking, setBranchRanking] = useState<BranchRanking[]>([]);
  const [loading, setLoading] = useState(true);

  // Estado para pestaña de acreditaciones
  const [accreditationData, setAccreditationData] = useState<CompanyAccreditationData[] | null>(null);
  const [loadingAccreditation, setLoadingAccreditation] = useState(false);

  // Filtros y paginación para tabla de acreditaciones
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'warning' | 'good'>('all');
  const [sortField, setSortField] = useState<'name' | 'techPercentage' | 'docPercentage' | 'totalTechs'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Rodrigo Osorio v0.16 - Cargar datos del resumen con skeletons por componente
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const branchIds = isBranchManager ? user?.assignedBranchIds : undefined;

        // Cargar solo lo esencial para el primer render
        const [dashboardStatsSummary, rankingData] = await Promise.all([
          getDashboardStatsSummary(branchIds),
          getBranchRanking()
        ]);

        setStats(dashboardStatsSummary);
        setBranchRanking(rankingData);

        // Cargar datos de prioridad en segundo plano
        const [problematic, companiesAtRisk] = await Promise.all([
          getProblematicTechniciansSummary(10, branchIds),
          getCompaniesAtRisk()
        ]);

        setProblemTechs(problematic);
        setRiskCompanies(companiesAtRisk);

        // Opcional: Cargar lista completa solo si es necesario o en idle
        // Para esta v0.16, el dashboard no necesita los 600 técnicos cargados en memoria
      } catch (e) {
        console.error("Error loading dashboard data", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isBranchManager, user?.assignedBranchIds]);


  // Rodrigo Osorio v0.11 - Optimizado: Pre-indexar técnicos por empresa para O(1) lookup
  const loadAccreditationReport = useCallback(async () => {
    setLoadingAccreditation(true);
    try {
      // Rodrigo Osorio v0.12 - Usar versión ligera optimizada en servidor
      // Elimina la necesidad de cargar todos los técnicos y empresas en el cliente
      const companiesData = await getCompaniesLight();

      const processedData: CompanyAccreditationData[] = companiesData.map(c => {
        // Calcular estado general basado en el promedio de cumplimiento (técnicos + empresa)
        const avgPercentage = (c.technicianComplianceScore + c.companyComplianceScore) / 2;
        let overallStatus: 'critical' | 'warning' | 'good' = 'good';
        if (avgPercentage < 50) overallStatus = 'critical';
        else if (avgPercentage < 80) overallStatus = 'warning';

        return {
          id: c.id,
          name: c.name,
          industry: c.industry || 'Sin industria',
          totalTechs: c.technicianCount,
          validTechs: c.technicianValidCount,
          techPercentage: c.technicianComplianceScore,
          totalDocs: c.companyDocsTotal,
          loadedDocs: c.companyDocsValid,
          docPercentage: c.companyComplianceScore,
          overallStatus
        };
      });

      setAccreditationData(processedData);
      setCurrentPage(1);
    } catch (e) {
      console.error("Error loading accreditation data", e);
    } finally {
      setLoadingAccreditation(false);
    }
  }, []); // Ya no depende de technicians[] ya que el servidor calcula el cumplimiento

  // Rodrigo Osorio v0.11 - Debounce para búsqueda en tabla de acreditaciones
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Datos filtrados y ordenados - optimizado con useMemo y debounce
  const filteredData = useMemo(() => {
    if (!accreditationData) return [];

    let filtered = accreditationData.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        item.industry.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || item.overallStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });

    // Ordenar
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else {
        comparison = (a[sortField] as number) - (b[sortField] as number);
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [accreditationData, debouncedSearchTerm, statusFilter, sortField, sortDirection]);

  // Paginación
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // No necesitamos handleSort memoizado si los datos ya vienen ligeros,
  // pero lo mantenemos por simplicidad estructural
  const handleSort = useCallback((field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  // Rodrigo Osorio v0.16 - Los cálculos pesados ahora se omiten si no hay lista completa
  // Se prioriza la información del sumario
  const validTechsCount = useMemo(() =>
    stats?.complianceRate ? Math.round((stats.complianceRate * (stats.totalTechnicians || 0)) / 100) : 0,
    [stats]
  );

  // Rodrigo Osorio v0.11 - Optimizado: Pre-indexar técnicos por empresa
  const companiesWithCompliant = useMemo(() => {
    // Crear índice de técnicos por empresa O(n)
    const techsByCompany = new Map<string, Technician[]>();
    technicians.forEach(tech => {
      tech.companyIds?.forEach(companyId => {
        if (!techsByCompany.has(companyId)) {
          techsByCompany.set(companyId, []);
        }
        techsByCompany.get(companyId)!.push(tech);
      });
    });

    // Filtrar empresas O(m) en vez de O(n*m)
    return companies.filter(c => {
      const cTechs = techsByCompany.get(c.id) || [];
      if (cTechs.length === 0) return false;
      return cTechs.every(t => t.overallStatus === ComplianceStatus.VALID);
    });
  }, [companies, technicians]);

  // Estadísticas del filtro
  const filterStats = useMemo(() => {
    if (!accreditationData) return { critical: 0, warning: 0, good: 0 };
    return {
      critical: accreditationData.filter(d => d.overallStatus === 'critical').length,
      warning: accreditationData.filter(d => d.overallStatus === 'warning').length,
      good: accreditationData.filter(d => d.overallStatus === 'good').length
    };
  }, [accreditationData]);

  if (loading) {
    return (
      <div className="space-y-8 p-4">
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <Skeleton width={150} height={32} />
            <Skeleton width={250} height={16} />
          </div>
          <Skeleton width={200} height={40} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Skeleton height={140} className="rounded-[2rem]" />
          <Skeleton height={140} className="rounded-[2rem]" />
          <Skeleton height={140} className="rounded-[2rem]" />
          <Skeleton height={140} className="rounded-[2rem]" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Skeleton height={350} className="lg:col-span-2 rounded-[2.5rem]" />
          <Skeleton height={350} className="rounded-[2.5rem]" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return <div className="p-8 text-center text-slate-500">No hay datos disponibles.</div>;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Header con Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-xs">Estado de cumplimiento de la organización</p>
        </div>

        <div className="flex bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('resumen')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'resumen'
              ? 'bg-white text-brand-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <LayoutDashboard size={14} />
            Resumen
          </button>
          <button
            onClick={() => setActiveTab('acreditaciones')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'acreditaciones'
              ? 'bg-white text-brand-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <ClipboardList size={14} />
            Acreditaciones
          </button>
        </div>
      </div>

      {/* Pestaña: Resumen */}
      {activeTab === 'resumen' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda: Métricas y Tabla Sucursales */}
          <div className="lg:col-span-2 space-y-6">

            {/* Métricas Principales - Fila Compacta */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100">
              <div className="flex flex-wrap gap-8 divide-x divide-slate-100">
                <MetricCard
                  label="Técnicos Activos"
                  value={stats.totalTechnicians}
                  subValue={`${validTechsCount} acreditados`}
                />
                <div className="pl-8">
                  <MetricCard
                    label="Empresas"
                    value={stats.totalCompanies}
                    subValue={`${riskCompanies.length > 0 ? stats.totalCompanies - riskCompanies.length : stats.totalCompanies} al 100%`}
                  />
                </div>
                <div className="pl-8">
                  <MetricCard
                    label="Documentos Gestionados"
                    value={stats.totalCredentials}
                  />
                </div>
                <div className="pl-8">
                  <MetricCard
                    label="Atención Requerida"
                    value={problemTechs.length}
                    status={problemTechs.length > 0 ? 'critical' : 'good'}
                  />
                </div>
              </div>
            </div>

            {/* Estado de Cumplimiento - Barras Horizontales */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Estado de Cumplimiento</h3>
                <span className={`text-2xl font-black tracking-tighter ${stats.complianceRate >= 80 ? 'text-emerald-600' :
                  stats.complianceRate >= 50 ? 'text-amber-600' : 'text-rose-600'
                  }`}>
                  {stats.complianceRate}%
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ComplianceBar
                  rate={stats.totalTechnicians > 0 ? Math.round((validTechsCount / stats.totalTechnicians) * 100) : 0}
                  label="Técnicos Acreditados"
                />
                <ComplianceBar
                  rate={stats.totalCompanies > 0 ? Math.round(((stats.totalCompanies - riskCompanies.length) / stats.totalCompanies) * 100) : 0}
                  label="Empresas con Cobertura Completa"
                />
              </div>
              {problemTechs.length > 0 && (
                <p className="text-xs text-slate-400 mt-4 border-t border-slate-50 pt-4">
                  Se recomienda priorizar la gestión de <strong className="text-slate-600">{problemTechs.length} técnicos</strong> en estado crítico para evitar interrupciones operativas.
                </p>
              )}
            </div>

            {/* Tabla de Sucursales */}
            <BranchRankingBoard ranking={branchRanking} />
          </div>

          {/* Columna Derecha: Panel de Prioridad */}
          <div className="bg-white rounded-2xl p-6 flex flex-col border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Atención Requerida</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Técnicos y Empresas en Riesgo</p>
              </div>
              <span className={`text-sm font-black px-3 py-1.5 rounded-full ${(priorityTab === 'techs' ? problemTechs.length : riskCompanies.length) > 0
                ? 'bg-rose-50 text-rose-600'
                : 'bg-emerald-50 text-emerald-600'
                }`}>
                {priorityTab === 'techs' ? problemTechs.length : riskCompanies.length}
              </span>
            </div>

            {/* Tabs: Técnicos | Empresas */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setPriorityTab('techs')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${priorityTab === 'techs'
                  ? 'bg-brand-50 text-brand-600 border border-brand-200 shadow-sm'
                  : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100 hover:text-slate-700'
                  }`}
              >
                <Users size={14} className="inline mr-1.5" /> Técnicos
              </button>
              <button
                onClick={() => setPriorityTab('companies')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${priorityTab === 'companies'
                  ? 'bg-brand-50 text-brand-600 border border-brand-200 shadow-sm'
                  : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100 hover:text-slate-700'
                  }`}
              >
                <Building2 size={14} className="inline mr-1.5" /> Empresas
              </button>
            </div>

            {/* Buscador */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder={priorityTab === 'techs' ? 'Buscar técnico...' : 'Buscar empresa...'}
                value={prioritySearch}
                onChange={(e) => setPrioritySearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-slate-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
              />
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar max-h-[320px]">
              {/* Tab: Técnicos Problemáticos */}
              {priorityTab === 'techs' && (
                <>
                  {problemTechs
                    .filter(t => t.name.toLowerCase().includes(prioritySearch.toLowerCase()))
                    .length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-2 py-8">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                        <ShieldCheck size={28} className="text-emerald-500" />
                      </div>
                      <p className="text-sm font-semibold text-slate-600">Todo está al día</p>
                      <p className="text-xs text-slate-400">No hay técnicos con problemas</p>
                    </div>
                  ) : (
                    problemTechs
                      .filter(t => t.name.toLowerCase().includes(prioritySearch.toLowerCase()))
                      .slice(0, 5)
                      .map((tech) => (
                        <a key={tech.id} href={`#/technicians?id=${tech.id}`} className="group bg-slate-50 hover:bg-slate-100 p-3.5 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all cursor-pointer block hover:shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <img
                                src={tech.avatarUrl || `https://ui-avatars.com/api/?name=${tech.name}&background=f1f5f9&color=475569`}
                                alt=""
                                className="w-10 h-10 rounded-xl border border-slate-200"
                              />
                              <div className="absolute -top-1 -right-1">
                                <StatusBadge status={tech.overallStatus} hideLabel />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800 truncate group-hover:text-brand-600 transition-colors">{tech.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{tech.branch || 'Sin Sede'}</p>
                            </div>
                            <ChevronRight size={16} className="text-slate-300 group-hover:text-brand-500 transition-colors" />
                          </div>
                        </a>
                      ))
                  )}
                </>
              )}

              {/* Tab: Empresas en Riesgo */}
              {priorityTab === 'companies' && (
                <>
                  {riskCompanies
                    .filter(c => c.companyName.toLowerCase().includes(prioritySearch.toLowerCase()))
                    .length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-2 py-8">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                        <ShieldCheck size={28} className="text-emerald-500" />
                      </div>
                      <p className="text-sm font-semibold text-slate-600">Todas cumplen</p>
                      <p className="text-xs text-slate-400">No hay empresas en riesgo</p>
                    </div>
                  ) : (
                    riskCompanies
                      .filter(c => c.companyName.toLowerCase().includes(prioritySearch.toLowerCase()))
                      .slice(0, 5)
                      .map((company) => (
                        <a key={company.companyId} href={`#/companies?id=${company.companyId}`} className="group bg-slate-50 hover:bg-slate-100 p-3.5 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all cursor-pointer block hover:shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${company.compliancePercentage < 25 ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100'}`}>
                              <AlertTriangle size={18} className={company.compliancePercentage < 25 ? 'text-red-500' : 'text-amber-500'} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800 truncate group-hover:text-brand-600 transition-colors">{company.companyName}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                {company.fullyCompliantTechnicians}/{company.totalTechnicians} técnicos OK
                              </p>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className={`text-sm font-black ${company.compliancePercentage < 25 ? 'text-red-500' : 'text-amber-500'}`}>
                                {company.compliancePercentage}%
                              </span>
                              <ChevronRight size={14} className="text-slate-300 group-hover:text-brand-500 transition-colors" />
                            </div>
                          </div>
                        </a>
                      ))
                  )}
                </>
              )}
            </div>

            <a
              href={priorityTab === 'techs' ? '#/technicians' : '#/companies'}
              className="mt-4 flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-slate-900/20 hover:shadow-xl"
            >
              Gestionar todo <Activity size={14} />
            </a>
          </div>
        </div>
      )
      }

      {/* Pestaña: Acreditaciones */}
      {
        activeTab === 'acreditaciones' && (
          <div className="space-y-4">
            {/* Header y botón de carga */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-800">Reporte de Acreditaciones</h3>
                  <p className="text-xs text-slate-500">Estado de técnicos y documentos por empresa</p>
                </div>
                <button
                  onClick={loadAccreditationReport}
                  disabled={loadingAccreditation}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 text-sm"
                >
                  <RefreshCw size={14} className={loadingAccreditation ? 'animate-spin' : ''} />
                  {loadingAccreditation ? 'Cargando...' : accreditationData ? 'Actualizar' : 'Generar Reporte'}
                </button>
              </div>
            </div>

            {/* Mensaje inicial */}
            {!accreditationData && !loadingAccreditation && (
              <div className="bg-slate-50 rounded-xl p-8 text-center border-2 border-dashed border-slate-200">
                <ClipboardList size={36} className="mx-auto text-slate-400 mb-3" />
                <p className="text-slate-500 text-sm">Haz clic en "Generar Reporte" para cargar los datos</p>
              </div>
            )}

            {/* Loading */}
            {loadingAccreditation && (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="animate-spin text-brand-600 mr-2" size={20} />
                <span className="text-slate-600 text-sm">Generando reporte...</span>
              </div>
            )}

            {/* Tabla de acreditaciones */}
            {accreditationData && !loadingAccreditation && (
              <>
                {/* Filtros */}
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Búsqueda */}
                    <div className="relative flex-1">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar empresa..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>

                    {/* Filtro por estado */}
                    <div className="flex items-center gap-2">
                      <Filter size={14} className="text-slate-400" />
                      <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value as any); setCurrentPage(1); }}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="all">Todos ({accreditationData.length})</option>
                        <option value="critical">Crítico ({filterStats.critical})</option>
                        <option value="warning">Advertencia ({filterStats.warning})</option>
                        <option value="good">Al día ({filterStats.good})</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Tabla */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600 text-xs">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">
                            <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-slate-900">
                              Empresa
                              <ArrowUpDown size={12} className={sortField === 'name' ? 'text-brand-600' : ''} />
                            </button>
                          </th>
                          <th className="px-4 py-3 text-left font-medium">Industria</th>
                          <th className="px-4 py-3 text-center font-medium">
                            <button onClick={() => handleSort('totalTechs')} className="flex items-center gap-1 hover:text-slate-900 mx-auto">
                              Técnicos
                              <ArrowUpDown size={12} className={sortField === 'totalTechs' ? 'text-brand-600' : ''} />
                            </button>
                          </th>
                          <th className="px-4 py-3 text-left font-medium">
                            <button onClick={() => handleSort('techPercentage')} className="flex items-center gap-1 hover:text-slate-900">
                              Cumplimiento Técnicos
                              <ArrowUpDown size={12} className={sortField === 'techPercentage' ? 'text-brand-600' : ''} />
                            </button>
                          </th>
                          <th className="px-4 py-3 text-left font-medium">
                            <button onClick={() => handleSort('docPercentage')} className="flex items-center gap-1 hover:text-slate-900">
                              Documentos Empresa
                              <ArrowUpDown size={12} className={sortField === 'docPercentage' ? 'text-brand-600' : ''} />
                            </button>
                          </th>
                          <th className="px-4 py-3 text-center font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedData.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                              No se encontraron empresas
                            </td>
                          </tr>
                        ) : (
                          paginatedData.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <a href={`#/companies?id=${item.id}`} className="font-medium text-slate-900 hover:text-brand-600 truncate block max-w-[200px]">
                                  {item.name}
                                </a>
                              </td>
                              <td className="px-4 py-3 text-slate-600 truncate max-w-[120px]">{item.industry}</td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-slate-700">{item.validTechs}/{item.totalTechs}</span>
                              </td>
                              <td className="px-4 py-3">
                                <MiniProgressBar percentage={item.techPercentage} />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <MiniProgressBar percentage={item.docPercentage} />
                                  <span className="text-xs text-slate-400">({item.loadedDocs}/{item.totalDocs})</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${item.overallStatus === 'good' ? 'bg-green-100 text-green-700' :
                                  item.overallStatus === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                  {item.overallStatus === 'good' ? 'Al día' :
                                    item.overallStatus === 'warning' ? 'Advertencia' : 'Crítico'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginación */}
                  {totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredData.length)} de {filteredData.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronsLeft size={16} />
                        </button>
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="px-3 py-1 text-sm">
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronRight size={16} />
                        </button>
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                          className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronsRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )
      }
    </div >
  );
};
