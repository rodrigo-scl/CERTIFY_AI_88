import React, { useState, useEffect, useRef, memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Layers, Building2, Shield, Mail, Phone, Globe, UserCheck, Lock, Search,
    Download, ChevronDown, Plus, FileText, CheckSquare, Square, Eye,
    MoreVertical, ExternalLink, Trash2, Users, Upload, Loader2, AlertCircle, FolderOpen, Building2 as Building
} from 'lucide-react';
import {
    getCompanies,
    getIndustries,
    getCompanyServiceProviders,
    getServiceProviders,
    getSupplierPortals,
    getTechniciansByCompany,
    getDocumentTypes,
    unlinkCompanyFromTechnician,
    toggleTechnicianStatus,
    toggleTechnicianCompanyBlock,
    updateCompany,
    deleteCompanyCredential,
    updateCompanyTechRequirements,
    linkCompanyToServiceProvider,
    unlinkCompanyFromServiceProvider,
    calculateCompanyCredentialStatus,
    updateCompanyDocRequirements,
    addCredentialToTechnician,
    addCompanyCredential,
    logDownloadAudit
} from '../../services/dataService';
import {
    viewDocument,
    downloadCompanyZip,
    extractPathFromUrl,
    CompanyZipType,
    openDocumentInNewWindow
} from '../../services/storageService';
import { formatDateForDB, formatDateForDisplay, isValidDateFormat, validateDateRange } from '../../services/dateUtils';
import {
    Company,
    Technician,
    CompanyCredential,
    DocumentType,
    ServiceProvider,
    SupplierPortal,
    ComplianceStatus
} from '../../types';
import { StatusBadge, ScoreBadge } from '../shared/StatusBadge';
import { PasswordReveal } from '../PasswordReveal';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { AssignTechnicianModal, UploadDocModal, ManageReqModal, EditCompanyModal } from './CompanyModals';
import { supabase } from '../../services/supabaseClient';

interface CompanyDetailProps {
    company: Company;
    onBack: () => void;
}

export const CompanyDetail = memo(({ company, onBack }: CompanyDetailProps) => {
    const navigate = useNavigate();
    const { canEdit, hasPermission } = useAuth();
    const [activeTab, setActiveTab] = useState<'TECHS' | 'DOCS' | 'REQS' | 'COMP_REQS' | 'EPS'>('TECHS');
    const [technicians, setTechnicians] = useState<Technician[]>([]);
    const [companyDocs, setCompanyDocs] = useState<CompanyCredential[]>([]);
    const [techDocTypes, setTechDocTypes] = useState<DocumentType[]>([]);
    const [allTechDocTypes, setAllTechDocTypes] = useState<DocumentType[]>([]);
    const [companyDocTypes, setCompanyDocTypes] = useState<DocumentType[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [companyEPS, setCompanyEPS] = useState<ServiceProvider[]>([]);
    const [allServiceProviders, setAllServiceProviders] = useState<ServiceProvider[]>([]);
    const [showEPSModal, setShowEPSModal] = useState(false);
    const [epsLoading, setEpsLoading] = useState(false);
    const [allSupplierPortals, setAllSupplierPortals] = useState<SupplierPortal[]>([]);
    const [industries, setIndustries] = useState<Industry[]>([]);
    const [holdings, setHoldings] = useState<Company[]>([]);

    const [requiredDocTypes, setRequiredDocTypes] = useState<string[]>(company.requiredDocTypes || []);
    const [isOptimisticUpdate, setIsOptimisticUpdate] = useState(false);
    const isOptimisticUpdateRef = useRef(false);
    const isUpdatingRef = useRef(false);
    const [companyRequiredDocs, setCompanyRequiredDocs] = useState<string[]>(company.requiredDocTypeIdsForCompany || []);

    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showUploadTechDoc, setShowUploadTechDoc] = useState<{ techId: string, name: string } | null>(null);
    const [showUploadCompDoc, setShowUploadCompDoc] = useState<string | boolean>(false);
    const [showReqModal, setShowReqModal] = useState(false);
    const [showCompanyReqModal, setShowCompanyReqModal] = useState(false);
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const [showEditCompany, setShowEditCompany] = useState(false);
    const [editCompanyData, setEditCompanyData] = useState<Partial<Company>>({ ...company });

    const [reload, setReload] = useState(0);
    const [downloading, setDownloading] = useState(false);
    const refresh = () => setReload(p => p + 1);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    const [tabsLoaded, setTabsLoaded] = useState({ TECHS: false, DOCS: false, REQS: false, COMP_REQS: false, EPS: false });

    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoading(true);
            const [allCompanies, compEPS, allEPS, allPortals, allIndustries, allDocs] = await Promise.all([
                getCompanies(),
                getCompanyServiceProviders(company.id),
                getServiceProviders(),
                getSupplierPortals(),
                getIndustries(),
                getDocumentTypes()
            ]);

            setCompanyEPS(compEPS);
            setAllServiceProviders(allEPS);
            setAllSupplierPortals(allPortals);
            setIndustries(allIndustries);
            setHoldings(allCompanies.filter(c => c.type === 'HOLDING'));
            setCompanyDocTypes(allDocs.filter(d => d.scope === 'COMPANY'));

            const updatedCompany = allCompanies.find(c => c.id === company.id);
            setCompanyDocs(updatedCompany?.credentials || []);
            setCompanyRequiredDocs(updatedCompany?.requiredDocTypeIdsForCompany || []);

            if (!isOptimisticUpdateRef.current && !isOptimisticUpdate) {
                setRequiredDocTypes(updatedCompany?.requiredDocTypes || []);
            }
            setIsLoading(false);
        };

        loadInitialData();
        setEditCompanyData({ ...company });
        setTabsLoaded({ TECHS: false, DOCS: false, REQS: false, COMP_REQS: false, EPS: false });
    }, [company.id, reload]);

    useEffect(() => {
        const loadTabData = async () => {
            if (activeTab === 'TECHS' && !tabsLoaded.TECHS) {
                setIsLoading(true);
                const companyTechs = await getTechniciansByCompany(company.id);
                setTechnicians(companyTechs);
                setTabsLoaded(prev => ({ ...prev, TECHS: true }));
                setIsLoading(false);
            } else if (activeTab === 'REQS' && !tabsLoaded.REQS) {
                const [allDocs, allCompanies] = await Promise.all([getDocumentTypes(), getCompanies()]);
                const updatedCompany = allCompanies.find(c => c.id === company.id);
                const reqs = updatedCompany?.requiredDocTypes || [];
                setTechDocTypes(allDocs.filter(d => reqs.includes(d.id)));
                setAllTechDocTypes(allDocs.filter(d => d.scope === 'TECHNICIAN'));
                setTabsLoaded(prev => ({ ...prev, REQS: true }));
            } else if (activeTab === 'COMP_REQS' && !tabsLoaded.COMP_REQS) {
                setTabsLoaded(prev => ({ ...prev, COMP_REQS: true }));
            }
        };
        loadTabData();
    }, [activeTab, company.id, tabsLoaded]);

    const reqDocs = company.requiredDocTypes || [];
    const compliantTechs = technicians.filter(tech => {
        if (reqDocs.length === 0) return true;
        const requiredCredentials = tech.credentials.filter(c => reqDocs.includes(c.documentTypeId));
        const validOrExpiring = requiredCredentials.filter(c => c.status === ComplianceStatus.VALID || c.status === ComplianceStatus.EXPIRING_SOON).length;
        return validOrExpiring === reqDocs.length;
    }).length;

    const techCompliancePct = technicians.length > 0 ? Math.round((compliantTechs / technicians.length) * 100) : 0;
    const companyDocsValid = companyDocs.every(d => d.status === ComplianceStatus.VALID);
    const isCompanyCompliant = companyDocsValid && techCompliancePct >= 80;

    const [techSearch, setTechSearch] = useState('');
    const debouncedTechSearch = useDebounce(techSearch, 300);
    const filteredTechs = technicians.filter(t => t.name.toLowerCase().includes(debouncedTechSearch.toLowerCase()) || t.rut.includes(debouncedTechSearch));

    const handleUnlink = async (techId: string) => {
        if (!hasPermission('edit_companies')) return;
        if (window.confirm('¿Desvincular técnico?')) {
            await unlinkCompanyFromTechnician(techId, company.id);
            refresh();
        }
    };

    const handleGlobalToggle = async (techId: string, currentStatus: boolean) => {
        if (!hasPermission('edit_technicians')) return;
        await toggleTechnicianStatus(techId, !currentStatus);
        refresh();
    };

    const handleCompanyBlock = async (techId: string, isBlocked: boolean) => {
        if (!hasPermission('block_technicians')) return;
        await toggleTechnicianCompanyBlock(techId, company.id, !isBlocked);
        refresh();
    };

    const handleUpdateCompany = async (newData: any) => {
        if (!hasPermission('edit_companies')) return;
        const result = await updateCompany(company.id, newData);
        if (!result.success) {
            alert(result.error);
            return;
        }
        refresh();
    };

    const handleDeleteCompDoc = async (credId: string) => {
        const doc = companyDocs.find(d => d.id === credId);
        console.log('[UI] Attempting to delete:', { credId, doc });

        // TEMP: Bypassing confirm since it's being intercepted
        // if (window.confirm('¿Eliminar documento?')) {
        console.log('[UI] User confirmed deletion');
        const result = await deleteCompanyCredential(company.id, credId, doc?.fileUrl);
        console.log('[UI] Delete result:', result);

        if (result?.success) {
            console.log('[UI] Refreshing company data from database...');
            // Reload fresh company data from DB
            const freshCompanies = await getCompanies();
            const updatedCompany = freshCompanies.find(c => c.id === company.id);
            if (updatedCompany) {
                // Update local state
                setCompanyDocs(updatedCompany.credentials || []);
                console.log('[UI] Company data refreshed successfully');
            }
        } else {
            alert('Error al eliminar el documento. Revisa la consola.');
        }
        // }
    };

    const handleDownloadDoc = async (doc: CompanyCredential) => {
        if (!doc.fileUrl || downloadingId) return;
        const filePath = extractPathFromUrl(doc.fileUrl, 'company');
        if (!filePath) return;
        setDownloadingId(doc.id);
        try {
            const result = await viewDocument('company', filePath, doc.documentTypeName, 'application/pdf');
            if (result.success) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) await logDownloadAudit({ userId: user.id, email: user.email!, actionType: 'DOWNLOAD_SINGLE', resourceName: doc.documentTypeName, resourcePath: filePath });
            }
        } finally {
            setDownloadingId(null);
        }
    };

    const handleDownloadZip = async (zipType: CompanyZipType) => {
        setDownloading(true);
        setShowDownloadMenu(false);
        try {
            const result = await downloadCompanyZip({ company: { id: company.id, name: company.name, rut: company.rut }, companyCredentials: companyDocs, technicians, documentTypes: [...techDocTypes, ...companyDocTypes], zipType });
            if (result.success) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) await logDownloadAudit({ userId: user.id, email: user.email!, actionType: 'DOWNLOAD_ZIP', resourceName: `Carpeta_${company.name}_${zipType}`, resourcePath: `company/${company.id}` });
            }
        } finally {
            setDownloading(false);
        }
    };

    const toggleRequirement = async (docId: string, isActive: boolean) => {
        if (!canEdit || isUpdatingRef.current) return;
        const nextSet = new Set(requiredDocTypes);
        if (isActive) nextSet.add(docId); else nextSet.delete(docId);
        const nextSelected = Array.from(nextSet);
        setRequiredDocTypes(nextSelected);
        setIsOptimisticUpdate(true);
        isOptimisticUpdateRef.current = true;
        isUpdatingRef.current = true;
        try {
            await updateCompanyTechRequirements(company.id, nextSelected);
            refresh();
            setTimeout(() => {
                setIsOptimisticUpdate(false);
                isOptimisticUpdateRef.current = false;
                isUpdatingRef.current = false;
            }, 1000);
        } catch (error) {
            setRequiredDocTypes(company.requiredDocTypes || []);
            setIsOptimisticUpdate(false);
            isOptimisticUpdateRef.current = false;
            isUpdatingRef.current = false;
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right duration-300 pb-12">
            <button onClick={onBack} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-sm font-medium mb-2">
                &larr; Volver a Empresas
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
                    {canEdit && (
                        <button onClick={() => setShowEditCompany(true)} className="absolute top-4 right-4 z-20 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 bg-white/80 backdrop-blur-sm">Editar</button>
                    )}
                    <div className="flex items-start gap-5 relative z-10">
                        <div className={`w-20 h-20 rounded-xl flex items-center justify-center shrink-0 ${company.type === 'HOLDING' ? 'bg-purple-100 text-purple-600' : 'bg-indigo-50 text-indigo-600'}`}>
                            {company.type === 'HOLDING' ? <Layers size={40} /> : <Building2 size={40} />}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-3xl font-bold text-slate-900">{company.name}</h2>
                            <div className="flex flex-wrap items-center gap-4 mt-2 text-slate-500 text-sm">
                                <span className="flex items-center gap-1"><Shield size={16} /> {company.rut}</span>
                                <span>{company.industry}</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${company.type === 'HOLDING' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {company.type === 'HOLDING' ? 'HOLDING' : 'FILIAL'}
                                </span>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Contacto</div>
                                    <div className="font-medium text-slate-800">{company.contactName || '-'}</div>
                                    <div className="text-slate-500 flex items-center gap-1 mt-1"><Mail size={14} /> {company.contactEmail || '-'}</div>
                                    <div className="text-slate-500 flex items-center gap-1 mt-1"><Phone size={14} /> {company.contactPhone || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Portal Proveedores</div>
                                    {company.supplierPortal ? (
                                        <>
                                            <a href={company.supplierPortal.url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline flex items-center gap-1 font-medium font-bold"><Globe size={14} /> {company.supplierPortal.name}</a>
                                            {company.portalUser && <div className="flex items-center gap-2 mt-1 text-slate-600 font-medium"><UserCheck size={14} /> {company.portalUser}</div>}
                                            {company.portalPassword && <div className="flex items-center gap-2 mt-1 text-slate-600"><Lock size={14} /><PasswordReveal password={company.portalPassword} entityType="company" entityId={company.id} entityName={company.name} /></div>}
                                        </>
                                    ) : <span className="text-slate-400 italic">Sin portal</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                        <div className="text-sm font-medium text-slate-500 mb-2">Cumplimiento Técnicos</div>
                        <div className="flex items-end gap-3"><div className="text-4xl font-bold text-slate-900">{techCompliancePct}%</div></div>
                        <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
                            <div className={`h-full ${techCompliancePct > 80 ? 'bg-green-500' : techCompliancePct > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${techCompliancePct}%` }}></div>
                        </div>
                    </div>
                    <div className={`p-5 rounded-xl shadow-sm border flex items-center justify-between ${isCompanyCompliant ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div><div className="text-sm font-bold uppercase text-slate-500 mb-1">Estado General</div><div className={`text-2xl font-bold ${isCompanyCompliant ? 'text-green-800' : 'text-red-800'}`}>{isCompanyCompliant ? 'Cumple' : 'No Cumple'}</div></div>
                        <div className={`${isCompanyCompliant ? 'text-green-500' : 'text-red-500'}`}>{isCompanyCompliant ? <UserCheck size={32} /> : <AlertCircle size={32} />}</div>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
                {['TECHS', 'DOCS', 'REQS', 'COMP_REQS', 'EPS'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === tab ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                        {tab === 'TECHS' ? 'Técnicos' : tab === 'DOCS' ? 'Docs Empresa' : tab === 'REQS' ? 'Requisitos' : tab === 'COMP_REQS' ? 'Acreditación' : 'EPS'}
                    </button>
                ))}
            </div>

            {activeTab === 'TECHS' && (
                <div className="bg-white rounded-b-xl rounded-r-xl shadow-sm border border-slate-100 min-h-[400px]">
                    <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input type="text" placeholder="Buscar..." className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm" value={techSearch} onChange={e => setTechSearch(e.target.value)} />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setShowDownloadMenu(!showDownloadMenu)} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-200 flex items-center gap-2">
                                <Download size={16} /> ZIP <ChevronDown size={14} />
                            </button>
                            {showDownloadMenu && (
                                <div className="absolute right-0 top-full mt-2 w-64 bg-white shadow-xl z-20 py-1">
                                    <button onClick={() => handleDownloadZip('valid_all')} className="w-full text-left px-4 py-2 hover:bg-slate-50">Docs Válidos</button>
                                    <button onClick={() => handleDownloadZip('all_techs')} className="w-full text-left px-4 py-2 hover:bg-slate-50">Todos los Docs</button>
                                </div>
                            )}
                            {canEdit && <button onClick={() => setShowAssignModal(true)} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium"><Plus size={16} className="inline mr-1" /> Asignar</button>}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left"><thead className="bg-slate-50"><tr><th className="px-6 py-4">Técnico</th><th className="px-6 py-4">Sucursal</th><th className="px-6 py-4 text-center">Score</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4"></th></tr></thead>
                            <tbody className="divide-y divide-slate-100">{filteredTechs.map(tech => (
                                <tr key={tech.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/technicians?id=${tech.id}`)}>
                                    <td className="px-6 py-4 flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-200"></div><div><div className="font-bold">{tech.name}</div><div className="text-xs text-slate-500">{tech.rut}</div></div></td>
                                    <td className="px-6 py-4">{tech.branch}</td>
                                    <td className="px-6 py-4 text-center"><ScoreBadge score={tech.complianceScore} /></td>
                                    <td className="px-6 py-4"><StatusBadge status={tech.overallStatus} /></td>
                                    <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}><button onClick={() => handleUnlink(tech.id)} className="text-red-500 hover:text-red-700 font-medium transition-colors">Desvincular</button></td>
                                </tr>
                            ))}</tbody></table>
                    </div>
                </div>
            )}

            {activeTab === 'DOCS' && (
                <div className="bg-white rounded-b-xl rounded-r-xl shadow-sm border border-slate-100 min-h-[400px] p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-800">Documentación Corporativa</h3>
                        <button onClick={() => setShowUploadCompDoc(true)} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                            <Upload size={16} /> Subir Documento
                        </button>
                    </div>
                    {companyDocs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                            <FolderOpen size={48} className="mb-4 opacity-20" />
                            <p>No hay documentos corporativos cargados</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {companyDocs.map(doc => (
                                <div key={doc.id} className="p-4 border border-slate-100 rounded-xl hover:shadow-md transition-all group bg-white">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                            <FileText size={20} />
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => handleDownloadDoc(doc)} className="p-1.5 text-slate-400 hover:text-brand-600 transition-colors" title="Descargar">
                                                <Download size={16} />
                                            </button>
                                            <button onClick={() => handleDeleteCompDoc(doc.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Eliminar">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <h4 className="font-bold text-slate-900 mb-1 truncate" title={doc.documentTypeName}>{doc.documentTypeName}</h4>
                                    <div className="text-xs text-slate-500 mb-3">Vence: {formatDateForDisplay(doc.expiryDate) || 'N/A'}</div>
                                    <StatusBadge status={doc.status} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'REQS' && (
                <div className="bg-white rounded-b-xl rounded-r-xl shadow-sm border border-slate-100 min-h-[400px] p-6 text-slate-800">
                    <div className="mb-6">
                        <h3 className="font-bold text-lg mb-1">Requisitos para Técnicos</h3>
                        <p className="text-sm text-slate-500">Documentos obligatorios que deben tener los técnicos para trabajar en esta empresa.</p>
                    </div>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-brand-600" /></div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {allTechDocTypes.map(doc => {
                                const isRequired = requiredDocTypes.includes(doc.id);
                                return (
                                    <div
                                        key={doc.id}
                                        onClick={() => toggleRequirement(doc.id, !isRequired)}
                                        className={`p-4 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${isRequired ? 'bg-brand-50 border-brand-200' : 'bg-white border-slate-100 hover:border-slate-200'
                                            }`}
                                    >
                                        <div className={isRequired ? 'text-brand-600' : 'text-slate-300'}>
                                            {isRequired ? <CheckSquare size={20} /> : <Square size={20} />}
                                        </div>
                                        <span className="text-sm font-bold truncate transition-colors group-hover:text-brand-700">{doc.name}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'COMP_REQS' && (
                <div className="bg-white rounded-b-xl rounded-r-xl shadow-sm border border-slate-100 min-h-[400px] p-6 text-slate-800">
                    <div className="mb-6">
                        <h3 className="font-bold text-lg mb-1">Acreditación de Empresa</h3>
                        <p className="text-sm text-slate-500">Documentación que la empresa debe cargar para estar vigente en el portal.</p>
                    </div>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-brand-600" /></div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {companyDocTypes.map(doc => {
                                const isRequired = companyRequiredDocs.includes(doc.id);
                                return (
                                    <div
                                        key={doc.id}
                                        onClick={async () => {
                                            const next = new Set(companyRequiredDocs);
                                            if (isRequired) next.delete(doc.id); else next.add(doc.id);
                                            const nextArr = Array.from(next);
                                            setCompanyRequiredDocs(nextArr);
                                            await updateCompanyDocRequirements(company.id, nextArr);
                                            refresh();
                                        }}
                                        className={`p-4 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${isRequired ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-slate-200'
                                            }`}
                                    >
                                        <div className={isRequired ? 'text-indigo-600' : 'text-slate-300'}>
                                            {isRequired ? <CheckSquare size={20} /> : <Square size={20} />}
                                        </div>
                                        <span className="text-sm font-bold truncate">{doc.name}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'EPS' && (
                <div className="bg-white rounded-b-xl rounded-r-xl shadow-sm border border-slate-100 min-h-[400px] p-6 text-slate-800">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="font-bold text-lg mb-1">Empresas Prestadoras de Servicio (EPS)</h3>
                            <p className="text-sm text-slate-500">Empresas que proveen técnicos para este proyecto/empresa.</p>
                        </div>
                        <button onClick={() => setShowEPSModal(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                            <Plus size={16} /> Vincular EPS
                        </button>
                    </div>

                    <div className="space-y-3">
                        {companyEPS.length === 0 ? (
                            <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                                <Building size={48} className="mx-auto mb-4 opacity-20" />
                                <p>No hay EPS vinculadas a esta empresa</p>
                            </div>
                        ) : (
                            companyEPS.map(eps => (
                                <div key={eps.id} className="p-4 border border-slate-100 rounded-xl flex items-center justify-between hover:bg-slate-50 transition-colors bg-white">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center font-bold">
                                            {eps.name[0]}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900">{eps.name}</div>
                                            <div className="text-xs text-slate-500">{eps.rut}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (window.confirm('¿Desvincular EPS?')) {
                                                await unlinkCompanyFromServiceProvider(company.id, eps.id);
                                                refresh();
                                                const updated = await getCompanyServiceProviders(company.id);
                                                setCompanyEPS(updated);
                                            }
                                        }}
                                        className="text-red-500 hover:text-red-700 font-medium text-sm px-4 py-2 rounded-lg hover:bg-red-50 transition-all"
                                    >
                                        Desvincular
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {showEPSModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-purple-50">
                            <h3 className="font-bold text-slate-900">Vincular Nueva EPS</h3>
                            <button onClick={() => setShowEPSModal(false)}><X size={20} className="text-slate-400" /></button>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto p-2">
                            {allServiceProviders.filter(sp => !companyEPS.some(ce => ce.id === sp.id)).map(sp => (
                                <button
                                    key={sp.id}
                                    onClick={async () => {
                                        setEpsLoading(true);
                                        await linkCompanyToServiceProvider(company.id, sp.id);
                                        const updated = await getCompanyServiceProviders(company.id);
                                        setCompanyEPS(updated);
                                        setEpsLoading(false);
                                        setShowEPSModal(false);
                                    }}
                                    className="w-full text-left p-4 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors border-b last:border-0 border-slate-50"
                                >
                                    <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded flex items-center justify-center font-bold text-xs">{sp.name[0]}</div>
                                    <span className="font-medium text-slate-700">{sp.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Modales etc. */}
            <AssignTechnicianModal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} companyId={company.id} currentTechIds={technicians.map(t => t.id)} onAssign={() => { refresh(); setShowAssignModal(false); }} />
            <UploadDocModal
                isOpen={!!showUploadTechDoc} onClose={() => setShowUploadTechDoc(null)} title={`Cargar para ${showUploadTechDoc?.name}`} docTypes={techDocTypes} entityId={showUploadTechDoc?.techId} entityType="technician"
                onSave={async (docTypeId: any, expDate: any, url: any, issueDate: any) => { if (showUploadTechDoc) { await addCredentialToTechnician(showUploadTechDoc.techId, docTypeId, expDate, url, issueDate); refresh(); setShowUploadTechDoc(null); } }}
            />
            <UploadDocModal
                isOpen={!!showUploadCompDoc} onClose={() => setShowUploadCompDoc(false)} title="Cargar Doc Corporativo"
                docTypes={companyDocTypes.filter(d => companyRequiredDocs.includes(d.id))}
                entityId={company.id} entityType="company" preselectedDocTypeId={typeof showUploadCompDoc === 'string' ? showUploadCompDoc : undefined}
                onSave={async (docTypeId: any, expDate: any, url: any, issueDate: any) => { await addCompanyCredential(company.id, docTypeId, expDate, url, issueDate); refresh(); setShowUploadCompDoc(false); }}
            />
            <EditCompanyModal
                isOpen={showEditCompany} onClose={() => setShowEditCompany(false)}
                company={company} onSave={handleUpdateCompany}
                industries={industries} holdings={holdings} supplierPortals={allSupplierPortals}
            />
        </div>
    );
});
