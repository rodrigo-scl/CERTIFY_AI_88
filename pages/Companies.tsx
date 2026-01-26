// Rodrigo Osorio v0.14 - Versión estable sin react-window
import React, { useEffect, useState, memo, useCallback, useMemo } from 'react';
import {
    Search, Plus, Download, Loader2, Building2, Layers, ArrowUpDown, FileText
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import {
    getCompaniesLight, getIndustries, getDocumentTypes, getServiceProviders,
    getBranches, getCompanies, getTechniciansByCompany, getCompanyServiceProviders,
    linkCompanyToServiceProvider, addCompany, getTechnicians
} from '../services/dataService';
import { Company, CompanyLight, Industry, DocumentType, ServiceProvider, Branch, ComplianceStatus } from '../types';
import { ScoreBadge } from '../components/shared/StatusBadge';
import { Skeleton } from '../components/shared/Skeleton';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { CompanyDetail } from '../components/companies/CompanyDetail';
import { NewCompanyModal } from '../components/companies/NewCompanyModal';

// --- SUB-COMPONENT: COMPANY ROW (Memoized) ---
const CompanyRowItem = memo(({
    company,
    holdingName,
    onSelect,
    onExportSummary,
    onExportMaster,
    exportingId
}: {
    company: CompanyLight;
    holdingName: string | null;
    onSelect: (id: string) => void;
    onExportSummary: (id: string) => void;
    onExportMaster: (id: string) => void;
    exportingId: string | null;
}) => {
    return (
        <div className="flex items-center hover:bg-slate-50 border-b border-slate-100 transition-colors px-6 py-3">
            <div className="flex-1 flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${company.type === 'HOLDING' ? 'bg-purple-50 text-purple-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    {company.type === 'HOLDING' ? <Layers size={18} /> : <Building2 size={18} />}
                </div>
                <div className="min-w-0">
                    <button
                        onClick={() => onSelect(company.id)}
                        className="font-bold text-slate-900 truncate max-w-[250px] hover:text-brand-600 hover:underline transition-all text-left block text-sm"
                    >
                        {company.name}
                    </button>
                    {holdingName && (
                        <div className="text-[10px] text-slate-400 truncate flex items-center gap-1 font-bold">
                            <Layers size={10} /> {holdingName}
                        </div>
                    )}
                </div>
            </div>

            <div className="w-32 hidden md:block text-slate-600 font-mono text-xs px-2">{company.rut}</div>
            <div className="w-40 hidden sm:block text-slate-600 text-xs truncate px-2">{company.industry || '-'}</div>
            <div className="w-24 px-2 text-center">
                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase ${company.type === 'HOLDING' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                    {company.type === 'HOLDING' ? 'Holding' : 'Filial'}
                </span>
            </div>
            <div className="w-20 flex justify-center px-2">
                <ScoreBadge score={company.technicianComplianceScore} />
            </div>
            <div className="w-20 flex justify-center px-2">
                <ScoreBadge score={company.companyComplianceScore} />
            </div>
            <div className="w-24 flex justify-end gap-2 items-center">
                <button
                    onClick={() => onExportSummary(company.id)}
                    disabled={exportingId === company.id}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-brand-600 transition-all disabled:opacity-50"
                    title="Resumen"
                >
                    {exportingId === company.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                </button>
                <button
                    onClick={() => onExportMaster(company.id)}
                    disabled={exportingId === company.id}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-purple-600 transition-all disabled:opacity-50"
                    title="Maestro"
                >
                    {exportingId === company.id ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                </button>
            </div>
        </div>
    );
});

export const Companies = () => {
    const { hasPermission } = useAuth();
    const [companies, setCompanies] = useState<CompanyLight[]>([]);
    const [industries, setIndustries] = useState<Industry[]>([]);
    const [techDocs, setTechDocs] = useState<DocumentType[]>([]);
    const [companyDocs, setCompanyDocs] = useState<DocumentType[]>([]);
    const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);

    const [loading, setLoading] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [exportingId, setExportingId] = useState<string | null>(null);
    const [exportingMaster, setExportingMaster] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'HOLDING' | 'SUBSIDIARY'>('all');
    const [complianceFilter, setComplianceFilter] = useState<'all' | 'compliant' | 'warning' | 'critical'>('all');
    const [sortField, setSortField] = useState<'name' | 'rut' | 'industry' | 'type' | 'techScore' | 'companyScore'>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const handleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const debouncedSearch = useDebounce(searchTerm, 300);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [allCompanies, allIndustries, allDocs, allSPs, allBranches] = await Promise.all([
                getCompaniesLight(),
                getIndustries(),
                getDocumentTypes(),
                getServiceProviders(),
                getBranches()
            ]);
            setCompanies(allCompanies);
            setIndustries(allIndustries);
            setTechDocs(allDocs.filter(d => d.scope === 'TECHNICIAN'));
            setCompanyDocs(allDocs.filter(d => d.scope === 'COMPANY'));
            setServiceProviders(allSPs);
            setBranches(allBranches);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const getHoldingName = useCallback((holdingId?: string) => {
        if (!holdingId) return null;
        return companies.find(c => c.id === holdingId)?.name || null;
    }, [companies]);

    const handleSelectCompany = async (companyId: string) => {
        setLoadingDetail(true);
        try {
            const allCompanies = await getCompanies();
            const company = allCompanies.find(c => c.id === companyId);
            setSelectedCompany(company || null);
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleCreate = async (data: any) => {
        const { serviceProviderIds, ...companyData } = data;
        const created = await addCompany(companyData);
        if (serviceProviderIds && created?.id) {
            for (const spId of serviceProviderIds) {
                await linkCompanyToServiceProvider(created.id, spId);
            }
        }
        loadData();
        setIsModalOpen(false);
    };

    // --- Export Functions ---
    const handleExportSummary = useCallback(async (companyId: string) => {
        setExportingId(companyId);
        try {
            const c = companies.find(x => x.id === companyId);
            if (!c) return;
            const headers = ['Empresa', 'RUT', 'Industria', 'Tipo', 'Cumplimiento Téc %', 'Total Técnicos', 'Cumplimiento Emp %'];
            const row = [c.name, c.rut, c.industry || '-', c.type, `${c.technicianComplianceScore}%`, c.technicianCount, `${c.companyComplianceScore}%`];
            const csv = [headers.join(','), row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')].join('\n');
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `resumen_${c.name.replace(/\s+/g, '_')}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
        } finally { setExportingId(null); }
    }, [companies]);

    const handleExportMaster = useCallback(async (companyId: string) => {
        setExportingId(companyId);
        try {
            const c = companies.find(x => x.id === companyId);
            if (!c) return;
            const techData = await getTechniciansByCompany(companyId);
            const companyEPS = await getCompanyServiceProviders(companyId);
            const epsNames = companyEPS.map(sp => sp.name).join(' | ') || 'Sin EPS';
            const headers = ['Técnico', 'RUT', 'Sucursal', 'EPS', 'Estado', '% Cumplimiento', 'Faltantes'];
            const rows = techData.map(t => {
                const missing = t.credentials.filter(cr => cr.status !== ComplianceStatus.VALID).map(cr => `${cr.documentTypeName} (${cr.status})`).join(' | ');
                return [t.name, t.rut, t.branch || '-', epsNames, t.overallStatus, `${t.complianceScore}%`, missing || 'Al día'];
            });
            const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `maestro_${c.name.replace(/\s+/g, '_')}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
        } finally { setExportingId(null); }
    }, [companies]);

    const handleExportMasterSheet = useCallback(async () => {
        setExportingMaster(true);
        try {
            const [allTechs, allCompanies, { data: epsRelations }] = await Promise.all([
                getTechnicians(), getCompanies(),
                supabase.from('company_service_providers').select('company_id, service_providers(name)').eq('is_active', true)
            ]);
            const epsMap: Record<string, string[]> = {};
            (epsRelations || []).forEach((rel: any) => {
                if (!epsMap[rel.company_id]) epsMap[rel.company_id] = [];
                if (rel.service_providers?.name) epsMap[rel.company_id].push(rel.service_providers.name);
            });
            const headers = ['Empresa', 'Técnico', 'RUT', 'Sucursal', 'EPS', 'Estado', '%', 'Faltantes'];
            const rows: string[][] = [];
            allCompanies.forEach(comp => {
                const assigned = allTechs.filter(t => t.companyIds.includes(comp.id));
                const eps = epsMap[comp.id]?.join(' | ') || 'Sin EPS';
                if (assigned.length === 0) rows.push([comp.name, 'SIN TÉCNICOS', '-', '-', eps, '-', '-', '-']);
                else assigned.forEach(tech => {
                    const missing = tech.credentials.filter(cr => cr.status !== ComplianceStatus.VALID).map(cr => cr.documentTypeName).join(' | ');
                    rows.push([comp.name, tech.name, tech.rut, tech.branch || '-', eps, tech.overallStatus, `${tech.complianceScore}%`, missing || 'Al día']);
                });
            });
            const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `REPORTE_MAESTRO_CERTIFY_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
        } finally { setExportingMaster(false); }
    }, []);

    const filteredData = useMemo(() => {
        let res = companies.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                c.rut.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                (c.industry || '').toLowerCase().includes(debouncedSearch.toLowerCase());
            const matchesType = typeFilter === 'all' || c.type === typeFilter;
            const matchesCompliance = complianceFilter === 'all' || (() => {
                const s = c.technicianComplianceScore;
                if (complianceFilter === 'compliant') return s >= 100;
                if (complianceFilter === 'warning') return s >= 80 && s < 100;
                if (complianceFilter === 'critical') return s < 80;
                return true;
            })();
            return matchesSearch && matchesType && matchesCompliance;
        });
        res.sort((a, b) => {
            let comp = 0;
            if (sortField === 'techScore') {
                comp = a.technicianComplianceScore - b.technicianComplianceScore;
            } else if (sortField === 'companyScore') {
                comp = a.companyComplianceScore - b.companyComplianceScore;
            } else {
                comp = (a[sortField] || '').toString().localeCompare((b[sortField] || '').toString());
            }
            return sortDirection === 'asc' ? comp : -comp;
        });
        return res;
    }, [companies, debouncedSearch, typeFilter, complianceFilter, sortField, sortDirection]);

    // Pagination
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    if (selectedCompany) return <CompanyDetail company={selectedCompany} onBack={() => setSelectedCompany(null)} />;

    if (loading && companies.length === 0) return (
        <div className="space-y-6">
            <div className="flex justify-between items-end"><div className="space-y-2"><Skeleton width={200} height={32} /><Skeleton width={300} height={16} /></div></div>
            <Skeleton height={60} className="rounded-xl" />
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden p-6 space-y-4">
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="flex gap-4 items-center"><Skeleton width={32} height={32} /><div className="flex-1 px-2"><Skeleton width="30%" height={16} /></div><Skeleton width={80} height={20} /><Skeleton width={100} height={24} /></div>)}
            </div>
        </div>
    );

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Gestión de Empresas</h1>
                    <p className="text-slate-500 text-sm">Administra holdings, sucursales y sus requisitos</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExportMasterSheet} disabled={exportingMaster} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-slate-200 border border-slate-200 transition-all text-sm disabled:opacity-50">
                        {exportingMaster ? <><Loader2 size={16} className="animate-spin" /> Generando...</> : <><Download size={16} /> Reporte Maestro</>}
                    </button>
                    {hasPermission('create_companies') && (
                        <button onClick={() => setIsModalOpen(true)} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-brand-700 text-sm">
                            <Plus size={16} /> Nueva Empresa
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 shrink-0">
                <div className="flex-1 relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Buscar por nombre, RUT o industria..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
                <div className="flex gap-2">
                    <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none">
                        <option value="all">Tipo: Todos</option>
                        <option value="HOLDING">Holdings</option>
                        <option value="SUBSIDIARY">Filiales</option>
                    </select>
                    <select value={complianceFilter} onChange={e => setComplianceFilter(e.target.value as any)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none">
                        <option value="all">Cumplimiento: Todos</option>
                        <option value="compliant">100% OK</option>
                        <option value="warning">80-99%</option>
                        <option value="critical">&lt; 80%</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex bg-slate-50 border-b border-slate-200 text-slate-500 font-medium text-[10px] uppercase tracking-wider px-6 py-3 shrink-0">
                    <button onClick={() => handleSort('name')} className={`flex-1 flex items-center gap-1 hover:text-slate-900 transition-colors ${sortField === 'name' ? 'text-brand-600' : ''}`}>
                        Empresa <ArrowUpDown size={12} />
                    </button>
                    <button onClick={() => handleSort('rut')} className={`w-32 hidden md:flex items-center gap-1 px-2 hover:text-slate-900 transition-colors ${sortField === 'rut' ? 'text-brand-600' : ''}`}>
                        RUT <ArrowUpDown size={10} />
                    </button>
                    <button onClick={() => handleSort('industry')} className={`w-40 hidden sm:flex items-center gap-1 px-2 hover:text-slate-900 transition-colors ${sortField === 'industry' ? 'text-brand-600' : ''}`}>
                        Industria <ArrowUpDown size={10} />
                    </button>
                    <button onClick={() => handleSort('type')} className={`w-24 flex items-center justify-center gap-1 px-2 hover:text-slate-900 transition-colors ${sortField === 'type' ? 'text-brand-600' : ''}`}>
                        Tipo <ArrowUpDown size={10} />
                    </button>
                    <button onClick={() => handleSort('techScore')} className={`w-20 flex items-center justify-center gap-1 px-2 hover:text-slate-900 transition-colors ${sortField === 'techScore' ? 'text-brand-600' : ''}`}>
                        Téc. % <ArrowUpDown size={10} />
                    </button>
                    <button onClick={() => handleSort('companyScore')} className={`w-20 flex items-center justify-center gap-1 px-2 hover:text-slate-900 transition-colors ${sortField === 'companyScore' ? 'text-brand-600' : ''}`}>
                        Emp. % <ArrowUpDown size={10} />
                    </button>
                    <div className="w-24"></div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {paginatedData.length > 0 ? (
                        paginatedData.map(company => (
                            <CompanyRowItem
                                key={company.id}
                                company={company}
                                holdingName={getHoldingName(company.holdingId)}
                                onSelect={handleSelectCompany}
                                onExportSummary={handleExportSummary}
                                onExportMaster={handleExportMaster}
                                exportingId={exportingId}
                            />
                        ))
                    ) : (
                        <div className="p-8 text-center text-slate-500">No se encontraron empresas</div>
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

            <NewCompanyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleCreate} industries={industries} holdings={companies.filter(c => c.type === 'HOLDING')} techDocs={techDocs} companyDocs={companyDocs} serviceProviders={serviceProviders} />
        </div>
    );
};