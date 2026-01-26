// Rodrigo Osorio v0.20 - Versión estable sin react-window
import React, { useEffect, useState, memo, useCallback, useMemo } from 'react';
import {
    Search, Plus, ChevronRight, Upload, Download, Loader2, Calendar, Activity, Lock, Thermometer, Plane
} from 'lucide-react';
import {
    getTechniciansLight, getCompanies, getBranches, getTechTypes,
    addTechnician, linkTechnicianToServiceProvider, getActiveAbsences, getServiceProviders, getTechnicians
} from '../services/dataService';
import { Technician, ComplianceStatus, Company, Branch, TechnicianType, ServiceProvider } from '../types';
import { StatusBadge, ScoreBadge } from '../components/shared/StatusBadge';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../context/AuthContext';
import { Skeleton } from '../components/shared/Skeleton';
import { BulkTechnicianUploadModal } from '../components/BulkTechnicianUploadModal';
import { TechnicianAbsenceModal } from '../components/TechnicianAbsenceModal';
import { NewTechnicianModal } from '../components/technicians/NewTechnicianModal';
import { TechnicianDetail } from '../components/technicians/TechnicianDetail';

// --- SUB-COMPONENT: TECHNICIAN ROW (Memoized) ---
const TechnicianRowItem = memo(({
    tech,
    absence,
    onSelect,
    onAbsence
}: {
    tech: Technician;
    absence: any;
    onSelect: (id: string) => void;
    onAbsence: (tech: Technician) => void;
}) => {
    // Determinar color del avatar según estado
    const isCompliant = tech.overallStatus === ComplianceStatus.VALID;
    const avatarBgColor = isCompliant ? 'bg-green-600' : 'bg-slate-200';
    const avatarTextColor = isCompliant ? 'text-white' : 'text-slate-600';

    // Indicadores de estado (Puntos)
    const isExpired = tech.overallStatus === ComplianceStatus.EXPIRED;
    const isPendingOrMissing = tech.overallStatus === ComplianceStatus.PENDING || tech.overallStatus === ComplianceStatus.MISSING;
    const isExpiringSoon = tech.overallStatus === ComplianceStatus.EXPIRING_SOON;

    // Obtener iniciales del nombre
    const initials = tech.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    return (
        <div
            className="flex items-center hover:bg-slate-50 cursor-pointer border-b border-slate-100 transition-colors px-6 py-3"
            onClick={() => onSelect(tech.id)}
        >
            <div className="flex-1 flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                    {/* Avatar con color condicional */}
                    <div className={`w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center font-bold text-sm ${avatarBgColor} ${avatarTextColor}`}>
                        {tech.avatarUrl && !tech.avatarUrl.includes('ui-avatars') ? (
                            <img src={tech.avatarUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                            <span>{initials}</span>
                        )}
                    </div>
                    {tech.isBlocked && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white p-0.5 rounded-full border border-white shadow-sm z-10">
                            <Lock size={8} fill="currentColor" />
                        </div>
                    )}
                    {(isExpired || isPendingOrMissing || isExpiringSoon) && (
                        <div className={`absolute -top-1 -left-1 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 ${isExpired ? 'bg-red-500' : 'bg-amber-500'
                            }`} title={isExpired ? 'Vencido' : 'Pendiente / Por Vencer'} />
                    )}
                    {absence && (
                        <div className="absolute -bottom-1 -right-1 bg-orange-500 text-white p-0.5 rounded-full border border-white shadow-sm ring-1 ring-orange-500/20 z-10">
                            {absence.type === 'VACATION' ? <Plane size={8} /> :
                                absence.type === 'MEDICAL_LEAVE' ? <Thermometer size={8} /> : <Activity size={8} />}
                        </div>
                    )}
                </div>
                <div className="min-w-0">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5 truncate text-sm">
                        {tech.name}
                        {tech.isBlocked && <span className="text-[8px] bg-red-50 text-red-600 px-1 py-0.5 rounded font-black uppercase tracking-tighter">Bloqueado</span>}
                        {absence && (
                            <span className="bg-orange-100 text-orange-600 text-[8px] px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-0.5">
                                <Calendar size={8} /> {absence.type === 'VACATION' ? 'VACACIONES' : 'LICENCIA'}
                            </span>
                        )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{tech.rut}</div>
                </div>
            </div>

            <div className="w-32 hidden md:block text-slate-600 text-xs truncate px-2 font-medium">{tech.technicianTypeName || tech.role}</div>
            <div className="w-40 hidden lg:block text-slate-600 text-xs truncate px-2">
                {tech.epsNames && tech.epsNames.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                        {tech.epsNames.map((name, i) => (
                            <span key={i} className="bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold uppercase truncate max-w-[120px]">
                                {name}
                            </span>
                        ))}
                    </div>
                ) : (
                    <span className="text-slate-300 italic">Sin EPS</span>
                )}
            </div>
            <div className="w-32 hidden sm:block text-slate-600 text-xs truncate px-2">{tech.branch}</div>
            <div className="w-24 flex justify-center px-2">
                <ScoreBadge score={tech.complianceScore} />
            </div>
            <div className="w-32 flex justify-start px-2">
                <StatusBadge status={tech.overallStatus} />
            </div>
            <div className="w-20 flex justify-end gap-2 items-center">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onAbsence(tech);
                    }}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-orange-500 transition-all"
                    title="Gestionar Ausencias"
                >
                    <Calendar size={16} />
                </button>
                <ChevronRight size={18} className="text-slate-300" />
            </div>
        </div>
    );
});

export const Technicians = () => {
    const { user, isBranchManager, hasPermission } = useAuth();
    const [technicians, setTechnicians] = useState<Technician[]>([]);
    const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | ComplianceStatus>('all');
    const [branchFilter, setBranchFilter] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
    const [selectedTechForAbsence, setSelectedTechForAbsence] = useState<Technician | null>(null);
    const [activeAbsences, setActiveAbsences] = useState<any[]>([]);
    const [exportingReport, setExportingReport] = useState(false);

    // Sorting
    const [sortBy, setSortBy] = useState<keyof Technician | 'name' | 'technicianTypeName' | 'epsNames' | 'branch' | 'complianceScore' | 'overallStatus'>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Auxiliary data
    const [branches, setBranches] = useState<Branch[]>([]);
    const [techTypes, setTechTypes] = useState<TechnicianType[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);

    const STATUS_LABELS: Record<ComplianceStatus, string> = {
        [ComplianceStatus.VALID]: 'Al día',
        [ComplianceStatus.EXPIRING_SOON]: 'Por vencer',
        [ComplianceStatus.EXPIRED]: 'Vencido',
        [ComplianceStatus.MISSING]: 'Faltante',
        [ComplianceStatus.PENDING]: 'Pendiente'
    };

    const refreshList = useCallback(async () => {
        setLoading(true);
        try {
            const [techs, absences] = await Promise.all([
                getTechniciansLight(isBranchManager ? user?.assignedBranchIds : undefined),
                getActiveAbsences()
            ]);
            setTechnicians(techs as Technician[]);
            setActiveAbsences(absences);
        } finally {
            setLoading(false);
        }
    }, [isBranchManager, user?.assignedBranchIds]);

    useEffect(() => {
        const loadAllData = async () => {
            await Promise.all([
                refreshList(),
                getBranches().then(setBranches),
                getTechTypes().then(setTechTypes),
                getCompanies().then(setCompanies),
                getServiceProviders().then(setServiceProviders)
            ]);

            const params = new URLSearchParams(window.location.hash.split('?')[1]);
            const techId = params.get('id');
            if (techId) setSelectedTechId(techId);
        };
        loadAllData();
    }, [refreshList]);

    const handleCreate = useCallback(async (formData: any) => {
        const { serviceProviderIds, ...techData } = formData;
        const result = await addTechnician(techData);
        if (result && serviceProviderIds && serviceProviderIds.length > 0) {
            for (const spId of serviceProviderIds) {
                await linkTechnicianToServiceProvider(result.id, spId);
            }
        }
        refreshList();
        setIsModalOpen(false);
    }, [refreshList]);

    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    const filteredData = useMemo(() => {
        let result = [...technicians]; // Clone to avoid mutation if sorting in place

        // Filtering
        if (statusFilter !== 'all') {
            result = result.filter(t => t.overallStatus === statusFilter);
        }
        if (branchFilter !== 'all') {
            result = result.filter(t => t.branchId === branchFilter);
        }
        if (debouncedSearchTerm) {
            const searchLower = debouncedSearchTerm.toLowerCase();
            result = result.filter(t =>
                t.name.toLowerCase().includes(searchLower) ||
                t.rut.includes(debouncedSearchTerm) ||
                t.email?.toLowerCase().includes(searchLower)
            );
        }

        // Sorting
        result.sort((a, b) => {
            let valA: any;
            let valB: any;

            // Handle special cases
            if (sortBy === 'complianceScore') {
                valA = a.complianceScore ?? 0;
                valB = b.complianceScore ?? 0;
                return sortOrder === 'asc' ? valA - valB : valB - valA;
            }

            if (sortBy === 'epsNames') {
                valA = a.epsNames?.join(', ') || '';
                valB = b.epsNames?.join(', ') || '';
                return sortOrder === 'asc'
                    ? valA.localeCompare(valB)
                    : valB.localeCompare(valA);
            }

            if (sortBy === 'overallStatus') {
                // Order by status priority: EXPIRED > EXPIRING_SOON > PENDING/MISSING > VALID
                const statusOrder: Record<ComplianceStatus, number> = {
                    [ComplianceStatus.EXPIRED]: 4,
                    [ComplianceStatus.EXPIRING_SOON]: 3,
                    [ComplianceStatus.PENDING]: 2,
                    [ComplianceStatus.MISSING]: 2,
                    [ComplianceStatus.VALID]: 1
                };
                valA = statusOrder[a.overallStatus] ?? 0;
                valB = statusOrder[b.overallStatus] ?? 0;
                return sortOrder === 'asc' ? valA - valB : valB - valA;
            }

            // Default string comparison
            valA = a[sortBy] || '';
            valB = b[sortBy] || '';

            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortOrder === 'asc'
                    ? valA.localeCompare(valB)
                    : valB.localeCompare(valA);
            }

            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortOrder === 'asc' ? valA - valB : valB - valA;
            }

            return 0;
        });

        return result;
    }, [technicians, debouncedSearchTerm, statusFilter, branchFilter, sortBy, sortOrder]);

    // Pagination logic
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleExportReport = useCallback(async () => {
        setExportingReport(true);
        try {
            const fullTechs = await getTechnicians();
            const headers = ['Nombre', 'RUT', 'Tipo', 'EPS', 'Sucursal', 'Estado', 'Cumplimiento %', 'Vencidos', 'Pendientes', 'OK', 'Faltantes'];
            const rows = fullTechs.map(tech => {
                const vencidos = tech.credentials.filter(c => c.status === ComplianceStatus.EXPIRED);
                const pendientes = tech.credentials.filter(c => c.status === ComplianceStatus.PENDING || c.status === ComplianceStatus.MISSING);
                const ok = tech.credentials.filter(c => c.status === ComplianceStatus.VALID);
                const missingDetails = [...vencidos, ...pendientes].map(c => `${c.documentTypeName} (${c.status === ComplianceStatus.EXPIRED ? 'VENCIDO' : 'PENDIENTE'})`).join(' | ');

                return [
                    tech.name, tech.rut, tech.technicianTypeName || tech.role, tech.epsNames?.join(' | ') || '-', tech.branch || '-',
                    tech.overallStatus, tech.complianceScore,
                    vencidos.length, pendientes.length, ok.length, missingDetails || 'Ninguno'
                ];
            });

            const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `reporte_cumplimiento_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error('Error exporting report:', error);
        } finally {
            setExportingReport(false);
        }
    }, []);

    if (selectedTechId) {
        return <TechnicianDetail techId={selectedTechId} onBack={() => {
            window.history.pushState({}, '', window.location.hash.split('?')[0]);
            setSelectedTechId(null);
            refreshList(); // Refrescar datos al volver
        }} />;
    }

    if (loading && technicians.length === 0) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-end"><div className="space-y-2"><Skeleton width={200} height={32} /><Skeleton width={300} height={16} /></div></div>
                <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="flex gap-4 items-center">
                            <Skeleton variant="circular" width={40} height={40} />
                            <div className="flex-1 space-y-2"><Skeleton width="40%" height={16} /><Skeleton width="20%" height={12} /></div>
                            <Skeleton width={60} height={24} /><Skeleton width={100} height={24} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Gestión de Técnicos</h1>
                    <p className="text-slate-500 text-sm">Administra el personal, sus sucursales y documentos</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExportReport} disabled={exportingReport} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-slate-200 border border-slate-200 transition-all disabled:opacity-50 text-sm">
                        {exportingReport ? <><Loader2 size={16} className="animate-spin" /> Generando...</> : <><Download size={16} /> Reporte</>}
                    </button>
                    {hasPermission('create_technicians') && (
                        <>
                            <button onClick={() => setIsBulkModalOpen(true)} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-slate-200 border border-slate-200 transition-all text-sm">
                                <Upload size={16} /> Masiva
                            </button>
                            <button onClick={() => setIsModalOpen(true)} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-brand-700 shadow-sm transition-all text-sm">
                                <Plus size={16} /> Nuevo
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 shrink-0">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder="Buscar por nombre, RUT o email..." className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex gap-2">
                    <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 text-sm font-medium outline-none bg-white">
                        <option value="all">Todas las sucursales</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 text-sm font-medium outline-none bg-white">
                        <option value="all">Todos los estados</option>
                        {Object.values(ComplianceStatus).map(s => (
                            <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider px-6 py-3 shrink-0 select-none">
                    <div
                        className="flex-1 cursor-pointer hover:text-brand-600 flex items-center gap-1"
                        onClick={() => {
                            if (sortBy === 'name') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            else { setSortBy('name'); setSortOrder('asc'); }
                        }}
                    >
                        Nombre / RUT {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </div>
                    <button
                        className="w-32 hidden md:flex items-center gap-1 px-2 cursor-pointer hover:text-brand-600 transition-colors"
                        onClick={() => {
                            if (sortBy === 'technicianTypeName') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            else { setSortBy('technicianTypeName'); setSortOrder('asc'); }
                        }}
                    >
                        Tipo {sortBy === 'technicianTypeName' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                    <button
                        className="w-40 hidden lg:flex items-center gap-1 px-2 cursor-pointer hover:text-brand-600 transition-colors"
                        onClick={() => {
                            if (sortBy === 'epsNames') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            else { setSortBy('epsNames'); setSortOrder('asc'); }
                        }}
                    >
                        EPS {sortBy === 'epsNames' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                    <button
                        className="w-32 hidden sm:flex items-center gap-1 px-2 cursor-pointer hover:text-brand-600 transition-colors"
                        onClick={() => {
                            if (sortBy === 'branch') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            else { setSortBy('branch'); setSortOrder('asc'); }
                        }}
                    >
                        Sucursal {sortBy === 'branch' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                    <button
                        className="w-24 flex items-center justify-center gap-1 px-2 cursor-pointer hover:text-brand-600 transition-colors"
                        onClick={() => {
                            if (sortBy === 'complianceScore') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            else { setSortBy('complianceScore'); setSortOrder('asc'); }
                        }}
                    >
                        Score {sortBy === 'complianceScore' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                    <button
                        className="w-32 flex items-center gap-1 px-2 cursor-pointer hover:text-brand-600 transition-colors"
                        onClick={() => {
                            if (sortBy === 'overallStatus') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            else { setSortBy('overallStatus'); setSortOrder('asc'); }
                        }}
                    >
                        Estado {sortBy === 'overallStatus' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                    <div className="w-20"></div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {paginatedData.length > 0 ? (
                        paginatedData.map(tech => (
                            <TechnicianRowItem
                                key={tech.id}
                                tech={tech}
                                absence={activeAbsences.find(a => a.technicianId === tech.id)}
                                onSelect={setSelectedTechId}
                                onAbsence={(t) => {
                                    setSelectedTechForAbsence(t);
                                    setIsAbsenceModalOpen(true);
                                }}
                            />
                        ))
                    ) : (
                        <div className="p-8 text-center text-slate-500">No se encontraron técnicos</div>
                    )}
                </div>

                {totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between shrink-0">
                        <span className="text-xs text-slate-500">
                            {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredData.length)} de {filteredData.length}
                        </span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30">«</button>
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30">‹</button>
                            <span className="px-3 py-1 text-sm">{currentPage} / {totalPages}</span>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30">›</button>
                            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30">»</button>
                        </div>
                    </div>
                )}
            </div>

            <NewTechnicianModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleCreate} branches={branches} types={techTypes} companies={companies} serviceProviders={serviceProviders} />
            <BulkTechnicianUploadModal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} onSuccess={() => { setIsBulkModalOpen(false); refreshList(); }} branches={branches} serviceProviders={serviceProviders} technicianTypes={techTypes} />
            {selectedTechForAbsence && <TechnicianAbsenceModal isOpen={isAbsenceModalOpen} onClose={() => { setIsAbsenceModalOpen(false); setSelectedTechForAbsence(null); }} technician={selectedTechForAbsence} onUpdate={refreshList} />}
        </div>
    );
};