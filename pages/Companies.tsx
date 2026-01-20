// Rodrigo Osorio v0.11 - Optimización de búsqueda con debouncing para escalabilidad
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import {
    Building2, ChevronRight, FileText, Plus, X, ArrowLeft, CheckSquare, Square,
    Users, Layers, Search, Mail, Phone, Globe, Lock, Download, MoreVertical,
    Trash2, Upload, AlertCircle, Calendar, UserCheck, Shield, Eye, ChevronDown, ExternalLink, Loader2
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
    getCompanies, getCompaniesLight, CompanyLight, getIndustries, getDocumentTypes, addCompany, getTechnicians, getTechniciansByCompany,
    getDocumentTypeById, assignTechniciansToCompany, unlinkCompanyFromTechnician,
    addCredentialToTechnician, updateCompanyTechRequirements, addCompanyCredential,
    deleteCompanyCredential, toggleTechnicianStatus, toggleTechnicianCompanyBlock,
    getServiceProviders, getCompanyServiceProviders, linkCompanyToServiceProvider,
    unlinkCompanyFromServiceProvider, getAvailableTechniciansForCompany, updateCompany,
    updateCompanyDocRequirements, calculateCompanyCredentialStatus, getSupplierPortals,
    getBranches, logDownloadAudit
} from '../services/dataService';
import {
    uploadTechnicianDocument, uploadCompanyDocument, viewDocument, downloadCompanyZip, CompanyZipType, extractPathFromUrl
} from '../services/storageService';
import { formatDateForDB, formatDateForDisplay, isValidDateFormat, validateDateRange } from '../services/dateUtils';
import { DateInput } from '../components/shared/DateInput';
import { Company, Industry, DocumentType, Technician, ComplianceStatus, CompanyCredential, ServiceProvider, SupplierPortal, Branch } from '../types';
import { StatusBadge, ScoreBadge } from '../components/shared/StatusBadge';
import { FileUpload } from '../components/shared/FileUpload';
import { Pagination } from '../components/shared/Pagination';
import { usePagination } from '../hooks/usePagination';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../context/AuthContext';
import { Skeleton } from '../components/shared/Skeleton';

// --- SUB-COMPONENT: COMPANY DETAIL ---

// Rodrigo Osorio v0.7 - Empresas Prestadoras de Servicio
const CompanyDetail = ({ company, onBack }: { company: Company, onBack: () => void }) => {
    const navigate = useNavigate();
    const { canEdit } = useAuth();
    const [activeTab, setActiveTab] = useState<'TECHS' | 'DOCS' | 'REQS' | 'COMP_REQS' | 'EPS'>('TECHS');
    const [technicians, setTechnicians] = useState<Technician[]>([]);
    const [companyDocs, setCompanyDocs] = useState<CompanyCredential[]>([]);
    const [techDocTypes, setTechDocTypes] = useState<DocumentType[]>([]);
    const [allTechDocTypes, setAllTechDocTypes] = useState<DocumentType[]>([]);
    const [companyDocTypes, setCompanyDocTypes] = useState<DocumentType[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // EPS (Empresas Prestadoras de Servicio)
    const [companyEPS, setCompanyEPS] = useState<ServiceProvider[]>([]);
    const [allServiceProviders, setAllServiceProviders] = useState<ServiceProvider[]>([]);
    const [showEPSModal, setShowEPSModal] = useState(false);
    const [epsLoading, setEpsLoading] = useState(false);

    // Rodrigo Osorio v0.12 - Portales de Proveedores
    const [allSupplierPortals, setAllSupplierPortals] = useState<SupplierPortal[]>([]);

    // Rodrigo Osorio v0.3 - Estado local para requisitos de documentos (para actualización optimista del toggle)
    const [requiredDocTypes, setRequiredDocTypes] = useState<string[]>(company.requiredDocTypes || []);
    // Flag para evitar que el useEffect sobrescriba el estado optimista inmediatamente después de un toggle
    const [isOptimisticUpdate, setIsOptimisticUpdate] = useState(false);
    // Ref para rastrear el estado optimista de forma síncrona (evita problemas de closure)
    const isOptimisticUpdateRef = useRef(false);
    // Rodrigo Osorio v0.8 - Ref para prevenir llamadas duplicadas simultáneas
    const isUpdatingRef = useRef(false);

    // Rodrigo Osorio v0.5 - Estado local para requisitos documentales de la empresa
    const [companyRequiredDocs, setCompanyRequiredDocs] = useState<string[]>(company.requiredDocTypeIdsForCompany || []);

    // Modals
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showUploadTechDoc, setShowUploadTechDoc] = useState<{ techId: string, name: string } | null>(null);
    const [showUploadCompDoc, setShowUploadCompDoc] = useState<string | boolean>(false); // Rodrigo Osorio v0.5 - string = docTypeId preseleccionado
    const [showReqModal, setShowReqModal] = useState(false);
    const [showCompanyReqModal, setShowCompanyReqModal] = useState(false); // Rodrigo Osorio v0.5
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const [showEditCompany, setShowEditCompany] = useState(false);
    const [editCompanyData, setEditCompanyData] = useState<Partial<Company>>({
        name: company.name,
        rut: company.rut,
        industry: company.industry,
        type: company.type,
        address: company.address,
        contactName: company.contactName,
        contactEmail: company.contactEmail,
        contactPhone: company.contactPhone,
        supplierPortalId: company.supplierPortalId, // Rodrigo Osorio v0.12
        portalUrl: company.portalUrl,
        portalUser: company.portalUser,
        portalPassword: company.portalPassword
    });

    // Reload Trigger
    const [reload, setReload] = useState(0);
    const [downloading, setDownloading] = useState(false);
    const refresh = () => setReload(p => p + 1);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    // Rodrigo Osorio v0.11 - Flags para lazy loading de tabs
    const [tabsLoaded, setTabsLoaded] = useState({
        TECHS: false,
        DOCS: false,
        REQS: false,
        COMP_REQS: false,
        EPS: false
    });

    // Rodrigo Osorio v0.11 - Cargar solo datos básicos al inicio
    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoading(true);
            // Cargar solo datos básicos (EPS, portales y empresa completa)
            const [allCompanies, compEPS, allEPS, allPortals] = await Promise.all([
                getCompanies(),
                getCompanyServiceProviders(company.id),
                getServiceProviders(),
                getSupplierPortals() // Rodrigo Osorio v0.12
            ]);

            // EPS de esta empresa
            setCompanyEPS(compEPS);
            setAllServiceProviders(allEPS);
            // Rodrigo Osorio v0.12 - Portales disponibles
            setAllSupplierPortals(allPortals);

            // Credenciales y requisitos de la empresa
            const updatedCompany = allCompanies.find(c => c.id === company.id);
            setCompanyDocs(updatedCompany?.credentials || []);

            const reqs = updatedCompany?.requiredDocTypes || [];
            if (!isOptimisticUpdateRef.current && !isOptimisticUpdate) {
                setRequiredDocTypes([...reqs]);
            }

            // Cargar datos del primer tab activo
            setIsLoading(false);
        };

        loadInitialData();
        setEditCompanyData({
            name: company.name,
            rut: company.rut,
            industry: company.industry,
            type: company.type,
            address: company.address,
            contactName: company.contactName,
            contactEmail: company.contactEmail,
            contactPhone: company.contactPhone,
            portalUrl: company.portalUrl,
            portalUser: company.portalUser,
            portalPassword: company.portalPassword
        });

        // Reset tabs loaded cuando cambia la empresa
        setTabsLoaded({ TECHS: false, DOCS: false, REQS: false, COMP_REQS: false, EPS: false });
    }, [company.id, reload]);

    // Rodrigo Osorio v0.11 - Lazy loading: cargar datos solo cuando se activa un tab
    useEffect(() => {
        const loadTabData = async () => {
            if (activeTab === 'TECHS' && !tabsLoaded.TECHS) {
                setIsLoading(true);
                const companyTechs = await getTechniciansByCompany(company.id);
                setTechnicians(companyTechs);
                setTabsLoaded(prev => ({ ...prev, TECHS: true }));
                setIsLoading(false);
            } else if (activeTab === 'DOCS' && !tabsLoaded.DOCS) {
                setIsLoading(true);
                // Docs ya se cargaron en el initial load
                setTabsLoaded(prev => ({ ...prev, DOCS: true }));
                setIsLoading(false);
            } else if (activeTab === 'REQS' && !tabsLoaded.REQS) {
                const [allDocs, allCompanies] = await Promise.all([
                    getDocumentTypes(),
                    getCompanies()
                ]);
                const updatedCompany = allCompanies.find(c => c.id === company.id);
                const reqs = updatedCompany?.requiredDocTypes || [];
                setTechDocTypes(allDocs.filter(d => reqs.includes(d.id)));
                setAllTechDocTypes(allDocs.filter(d => d.scope === 'TECHNICIAN'));
                setTabsLoaded(prev => ({ ...prev, REQS: true }));
            } else if (activeTab === 'COMP_REQS' && !tabsLoaded.COMP_REQS) {
                const allDocs = await getDocumentTypes();
                setCompanyDocTypes(allDocs.filter(d => d.scope === 'COMPANY'));
                setTabsLoaded(prev => ({ ...prev, COMP_REQS: true }));
            } else if (activeTab === 'EPS' && !tabsLoaded.EPS) {
                // EPS ya se cargaron en el initial load
                setTabsLoaded(prev => ({ ...prev, EPS: true }));
            }
        };

        loadTabData();
    }, [activeTab, company.id, tabsLoaded]);

    // Rodrigo Osorio v0.3 - Sincronizar estado local solo cuando cambie el company.id (no cuando cambie requiredDocTypes)
    // Esto evita que se sobrescriba el estado optimista cuando el usuario hace toggle
    useEffect(() => {
        // Solo actualizar si NO hay una actualización optimista en curso
        if (!isOptimisticUpdateRef.current && !isOptimisticUpdate) {
            setRequiredDocTypes(company.requiredDocTypes || []);
        }
    }, [company.id]); // Solo cuando cambia el ID de la empresa, no cuando cambia requiredDocTypes

    // Rodrigo Osorio v0.8 - Stats calculados sobre documentos requeridos por esta empresa
    const reqDocs = company.requiredDocTypes || [];

    // Calcular cuántos técnicos cumplen con los requisitos de esta empresa específica
    const compliantTechs = technicians.filter(tech => {
        if (reqDocs.length === 0) return true; // Si no hay requisitos, todos cumplen

        const requiredCredentials = tech.credentials.filter(c => reqDocs.includes(c.documentTypeId));
        const validOrExpiring = requiredCredentials.filter(c =>
            c.status === ComplianceStatus.VALID || c.status === ComplianceStatus.EXPIRING_SOON
        ).length;

        // El técnico cumple si tiene todos los documentos requeridos válidos o por vencer
        return validOrExpiring === reqDocs.length;
    }).length;

    const techCompliancePct = technicians.length > 0 ? Math.round((compliantTechs / technicians.length) * 100) : 0;

    // Company Status Logic
    const companyDocsValid = companyDocs.every(d => d.status === ComplianceStatus.VALID);
    // Simple logic: Company compliant if all its docs are valid AND > 80% techs are compliant
    const isCompanyCompliant = companyDocsValid && techCompliancePct >= 80;

    // --- TAB 1: TECHNICIANS ---

    const [techSearch, setTechSearch] = useState('');
    // Rodrigo Osorio v0.11 - Debounce para búsqueda de técnicos en detalle de empresa
    const debouncedTechSearch = useDebounce(techSearch, 300);
    const filteredTechs = technicians.filter(t => t.name.toLowerCase().includes(debouncedTechSearch.toLowerCase()) || t.rut.includes(debouncedTechSearch));

    const handleUnlink = async (techId: string) => {
        if (!canEdit) return;
        if (window.confirm('¿Desvincular técnico de esta empresa?')) {
            await unlinkCompanyFromTechnician(techId, company.id);
            refresh();
        }
    }

    const handleGlobalToggle = async (techId: string, currentStatus: boolean) => {
        if (!canEdit) return;
        await toggleTechnicianStatus(techId, !currentStatus);
        refresh();
    }

    const handleCompanyBlock = async (techId: string, isBlocked: boolean) => {
        if (!canEdit) return;
        await toggleTechnicianCompanyBlock(techId, company.id, !isBlocked);
        refresh();
    }

    const handleUpdateCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit) return;
        const result = await updateCompany(company.id, editCompanyData);
        if (!result.success) {
            alert(result.error || 'No se pudo actualizar la empresa');
            return;
        }
        setShowEditCompany(false);
        refresh();
    };

    // --- TAB 2: COMPANY DOCS ---

    const handleDeleteCompDoc = async (credId: string) => {
        if (!canEdit) return;
        const doc = companyDocs.find(d => d.id === credId);
        if (window.confirm('¿Eliminar documento?')) {
            await deleteCompanyCredential(company.id, credId, doc?.fileUrl);
            refresh();
        }
    }

    // Rodrigo Osorio v0.5 - Descarga de documento individual (abre en nueva ventana)
    const handleDownloadDoc = async (doc: CompanyCredential) => {
        if (!doc.fileUrl || downloadingId) {
            alert(downloadingId ? 'Espera a que termine la descarga actual' : 'Este documento no tiene archivo asociado');
            return;
        }

        const filePath = extractPathFromUrl(doc.fileUrl, 'company');
        if (!filePath) {
            alert('Error: No se pudo determinar la ruta del archivo');
            return;
        }

        setDownloadingId(doc.id);
        try {
            // Rodrigo Osorio v0.17 - Usar viewDocument que maneja la desencriptación client-side
            const result = await viewDocument(
                'company',
                filePath,
                doc.documentTypeName,
                'application/pdf'
            );

            if (result.success) {
                // Rodrigo Osorio v0.17 - Registrar auditoría
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await logDownloadAudit({
                        userId: user.id,
                        email: user.email!,
                        actionType: 'DOWNLOAD_SINGLE',
                        resourceName: doc.documentTypeName,
                        resourcePath: filePath
                    });
                }
            } else {
                alert('No se pudo abrir el documento: ' + result.error);
            }
        } catch (err) {
            console.error('Error al descargar documento:', err);
            alert('Error al procesar el archivo');
        } finally {
            setDownloadingId(null);
        }
    };

    // Rodrigo Osorio v0.5 - Descarga ZIP de documentos con nomenclatura específica
    const handleDownloadZip = async (zipType: CompanyZipType) => {
        setDownloading(true);
        setShowDownloadMenu(false);

        try {
            const result = await downloadCompanyZip({
                company: {
                    id: company.id,
                    name: company.name,
                    rut: company.rut
                },
                companyCredentials: companyDocs,
                technicians: technicians,
                documentTypes: [...techDocTypes, ...companyDocTypes],
                zipType: zipType
            });

            if (result.success) {
                // Rodrigo Osorio v0.17 - Registrar auditoría
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await logDownloadAudit({
                        userId: user.id,
                        email: user.email!,
                        actionType: 'DOWNLOAD_ZIP',
                        resourceName: `Carpeta_${company.name}_${zipType}`,
                        resourcePath: `company/${company.id}`
                    });
                }
            } else {
                alert(result.error || 'Error al generar el archivo ZIP');
            }
        } catch (err) {
            alert('Error al generar el archivo ZIP');
        } finally {
            setDownloading(false);
        }
    };

    // --- TAB 3: REQUIREMENTS ---

    // Rodrigo Osorio v0.8 - Función mejorada con prevención de llamadas duplicadas
    const toggleRequirement = async (docId: string, isActive: boolean) => {
        if (!canEdit || isUpdatingRef.current) return;

        // Calcular el nuevo estado
        let nextRequiredDocTypes: string[];

        setRequiredDocTypes(prev => {
            const currentSet = new Set<string>(prev);
            if (isActive) {
                currentSet.add(docId);
            } else {
                currentSet.delete(docId);
            }
            nextRequiredDocTypes = Array.from(currentSet);

            // Marcar actualización optimista
            setIsOptimisticUpdate(true);
            isOptimisticUpdateRef.current = true;

            return nextRequiredDocTypes;
        });

        // Actualizar BD
        isUpdatingRef.current = true;
        try {
            // Usamos una variable local para asegurar que enviamos el valor correcto
            const currentSet = new Set<string>(requiredDocTypes);
            if (isActive) currentSet.add(docId); else currentSet.delete(docId);
            const stateToSave = Array.from(currentSet);

            await updateCompanyTechRequirements(company.id, stateToSave);

            // Timeout de seguridad para evitar saltos en la UI mientras se propaga el cambio en Supabase
            setTimeout(() => {
                setIsOptimisticUpdate(false);
                isOptimisticUpdateRef.current = false;
                isUpdatingRef.current = false;
            }, 1000);
        } catch (error) {
            console.error('Error updating requirement:', error);
            setIsOptimisticUpdate(false);
            isOptimisticUpdateRef.current = false;
            isUpdatingRef.current = false;
            setRequiredDocTypes(company.requiredDocTypes || []);
            alert('Error al actualizar el requisito. Por favor, intente nuevamente.');
        }
    }


    return (
        <div className="space-y-6 animate-in slide-in-from-right duration-300 pb-12">
            <button onClick={onBack} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-sm font-medium mb-2">
                &larr; Volver a Empresas
            </button>

            {/* HEADER DASHBOARD */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Info */}
                <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
                    {canEdit && (
                        <button
                            onClick={() => setShowEditCompany(true)}
                            className="absolute top-4 right-4 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 bg-white/80 backdrop-blur-sm"
                        >
                            Editar
                        </button>
                    )}
                    <div className="flex items-start gap-5 relative z-10">
                        <div className={`w-20 h-20 rounded-xl flex items-center justify-center shrink-0 ${company.type === 'HOLDING' ? 'bg-purple-100 text-purple-600' : 'bg-indigo-50 text-indigo-600'}`}>
                            {company.type === 'HOLDING' ? <Layers size={40} /> : <Building2 size={40} />}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-3xl font-bold text-slate-900">{company.name}</h2>
                            <div className="flex flex-wrap items-center gap-4 mt-2 text-slate-500 text-sm">
                                <span className="flex items-center gap-1"><Shield size={16} /> {company.rut}</span>
                                <span className="hidden sm:inline">&bull;</span>
                                <span>{company.industry}</span>
                                <span className="hidden sm:inline">&bull;</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${company.type === 'HOLDING' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {company.type === 'HOLDING' ? 'HOLDING' : 'FILIAL'}
                                </span>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Contacto</div>
                                    <div className="font-medium text-slate-800">{company.contactName || 'No registrado'}</div>
                                    <div className="text-slate-500 flex items-center gap-1 mt-1">
                                        <Mail size={14} /> {company.contactEmail || '-'}
                                    </div>
                                    <div className="text-slate-500 flex items-center gap-1 mt-1">
                                        <Phone size={14} /> {company.contactPhone || '-'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Portal Proveedores</div>
                                    {company.supplierPortal ? (
                                        <>
                                            <a href={company.supplierPortal.url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline flex items-center gap-1 font-medium">
                                                <Globe size={14} /> {company.supplierPortal.name}
                                            </a>
                                            {company.supplierPortal.username && (
                                                <div className="flex items-center gap-2 mt-1 text-slate-600">
                                                    <UserCheck size={14} /> {company.supplierPortal.username}
                                                </div>
                                            )}
                                            {company.supplierPortal.password && (
                                                <div className="flex items-center gap-2 mt-1 text-slate-400">
                                                    <Lock size={14} /> ••••••••
                                                </div>
                                            )}
                                        </>
                                    ) : company.portalUrl ? (
                                        <>
                                            <a href={company.portalUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline flex items-center gap-1 font-medium">
                                                <Globe size={14} /> Ir al Portal (Legacy)
                                            </a>
                                            <div className="flex items-center gap-2 mt-1 text-slate-600">
                                                <UserCheck size={14} /> {company.portalUser}
                                            </div>
                                        </>
                                    ) : (
                                        <span className="text-slate-400 italic">Sin portal configurado</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="space-y-4">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                        <div className="text-sm font-medium text-slate-500 mb-2">Cumplimiento Técnicos</div>
                        <div className="flex items-end gap-3">
                            <div className="text-4xl font-bold text-slate-900">{techCompliancePct}%</div>
                            <div className="text-sm text-slate-500 mb-1">{compliantTechs} de {technicians.length} OK</div>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
                            <div className={`h-full ${techCompliancePct > 80 ? 'bg-green-500' : techCompliancePct > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${techCompliancePct}%` }}></div>
                        </div>
                    </div>

                    <div className={`p-5 rounded-xl shadow-sm border flex items-center justify-between ${isCompanyCompliant ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div>
                            <div className={`text-sm font-bold uppercase ${isCompanyCompliant ? 'text-green-700' : 'text-red-700'}`}>Estado General</div>
                            <div className={`text-2xl font-bold ${isCompanyCompliant ? 'text-green-800' : 'text-red-800'}`}>
                                {isCompanyCompliant ? 'Cumple' : 'No Cumple'}
                            </div>
                        </div>
                        <div className={`p-3 rounded-full ${isCompanyCompliant ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700'}`}>
                            {isCompanyCompliant ? <UserCheck size={32} /> : <AlertCircle size={32} />}
                        </div>
                    </div>
                </div>
            </div>

            {/* NAVIGATION TABS */}
            <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('TECHS')}
                    className={`px-6 py-3 font-medium text-sm flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'TECHS' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                    <Users size={18} /> Técnicos Asignados
                </button>
                <button
                    onClick={() => setActiveTab('DOCS')}
                    className={`px-6 py-3 font-medium text-sm flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'DOCS' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                    <Building2 size={18} /> Documentos de Empresa
                </button>
                <button
                    onClick={() => setActiveTab('REQS')}
                    className={`px-6 py-3 font-medium text-sm flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'REQS' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                    <FileText size={18} /> Requisitos para Técnicos
                </button>
                <button
                    onClick={() => setActiveTab('COMP_REQS')}
                    className={`px-6 py-3 font-medium text-sm flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'COMP_REQS' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                    <Shield size={18} /> Carga Documentos EPS
                </button>
                <button
                    onClick={() => setActiveTab('EPS')}
                    className={`px-6 py-3 font-medium text-sm flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'EPS' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                    <Building2 size={18} /> EPS Asignada
                    {companyEPS.length > 0 && (
                        <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs font-medium">{companyEPS.length}</span>
                    )}
                </button>
            </div>

            {/* --- TAB CONTENT: TECHNICIANS --- */}
            {activeTab === 'TECHS' && (
                <div className="bg-white rounded-b-xl rounded-r-xl shadow-sm border border-slate-100 min-h-[400px]">
                    <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar técnico..."
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                                value={techSearch}
                                onChange={e => setTechSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <div className="relative">
                                <button
                                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium text-sm hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
                                    onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                                    disabled={downloading}
                                >
                                    {downloading ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <Download size={16} />
                                    )}
                                    {downloading ? 'Generando...' : 'Descargar ZIP'}
                                    {!downloading && <ChevronDown size={14} />}
                                </button>

                                {showDownloadMenu && !downloading && (
                                    <>
                                        <div className="fixed inset-0 z-20" onClick={() => setShowDownloadMenu(false)}></div>
                                        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-100 z-30 py-1 animate-in fade-in zoom-in-95 duration-200">
                                            <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Opciones de ZIP</div>
                                            <button
                                                onClick={() => handleDownloadZip('valid_all')}
                                                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors"
                                            >
                                                Técnicos Válidos + Empresa
                                            </button>
                                            <button
                                                onClick={() => handleDownloadZip('all_techs')}
                                                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors"
                                            >
                                                Todos los documentos
                                            </button>
                                            <div className="h-px bg-slate-100 my-1"></div>
                                            <button
                                                onClick={() => handleDownloadZip('company_only')}
                                                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors"
                                            >
                                                Solo documentos de Empresa
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            {canEdit && (
                                <button
                                    onClick={() => setShowAssignModal(true)}
                                    className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium text-sm hover:bg-brand-700 flex items-center gap-2"
                                >
                                    <Plus size={16} /> Asignar Técnicos
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                <tr>
                                    <th className="px-6 py-4">Técnico</th>
                                    <th className="px-6 py-4">Sucursal</th>
                                    <th className="px-6 py-4 text-center">Docs Req.</th>
                                    <th className="px-6 py-4 text-center">Faltantes</th>
                                    <th className="px-6 py-4 text-center">Score</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredTechs.length === 0 ? (
                                    <tr><td colSpan={7} className="p-8 text-center text-slate-400">No hay técnicos asignados.</td></tr>
                                ) : (
                                    filteredTechs.map(tech => {
                                        // Rodrigo Osorio v0.8 - Calcular stats locales para esta empresa específica
                                        const reqDocs = company.requiredDocTypes;

                                        // Filtrar solo las credenciales que esta empresa requiere
                                        const requiredCredentials = tech.credentials.filter(c => reqDocs.includes(c.documentTypeId));

                                        // Contar documentos válidos o por vencer (ambos cuentan como cumplimiento)
                                        const validOrExpiring = requiredCredentials.filter(c =>
                                            c.status === ComplianceStatus.VALID || c.status === ComplianceStatus.EXPIRING_SOON
                                        ).length;

                                        // Calcular score específico para esta empresa (solo sobre documentos requeridos)
                                        const companySpecificScore = reqDocs.length > 0
                                            ? Math.round((validOrExpiring / reqDocs.length) * 100)
                                            : 100;

                                        // Calcular estado específico para esta empresa
                                        let companySpecificStatus: ComplianceStatus;
                                        if (reqDocs.length === 0) {
                                            companySpecificStatus = ComplianceStatus.VALID;
                                        } else if (validOrExpiring === reqDocs.length) {
                                            companySpecificStatus = ComplianceStatus.VALID;
                                        } else {
                                            const hasExpired = requiredCredentials.some(c => c.status === ComplianceStatus.EXPIRED);
                                            const hasMissing = reqDocs.length > requiredCredentials.length;
                                            const hasPending = requiredCredentials.some(c => c.status === ComplianceStatus.PENDING);

                                            if (hasExpired) {
                                                companySpecificStatus = ComplianceStatus.EXPIRED;
                                            } else if (hasMissing) {
                                                companySpecificStatus = ComplianceStatus.MISSING;
                                            } else if (hasPending) {
                                                companySpecificStatus = ComplianceStatus.PENDING;
                                            } else {
                                                companySpecificStatus = ComplianceStatus.PENDING;
                                            }
                                        }

                                        // Contar documentos faltantes o pendientes
                                        const missingOrPendingCount = reqDocs.length - tech.credentials.filter(c =>
                                            reqDocs.includes(c.documentTypeId) &&
                                            (c.status !== ComplianceStatus.MISSING && c.status !== ComplianceStatus.PENDING)
                                        ).length;

                                        const isBlocked = tech.blockedCompanyIds?.includes(company.id);

                                        return (
                                            <tr
                                                key={tech.id}
                                                className={`hover:bg-slate-50 group cursor-pointer ${isBlocked ? 'bg-red-50/50' : ''}`}
                                                onClick={() => navigate(`/technicians?id=${tech.id}`)}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 bg-slate-200 rounded-full overflow-hidden">
                                                            <img src={tech.avatarUrl} alt="" className="w-full h-full object-cover" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-900 hover:text-brand-600 flex items-center gap-2 group-hover:underline">
                                                                {tech.name}
                                                                <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                                                            </div>
                                                            <div className="text-xs text-slate-500">{tech.rut}</div>
                                                            {!tech.isActive && <span className="text-xs text-red-600 font-bold">Deshabilitado Global</span>}
                                                            {isBlocked && <span className="text-xs text-red-600 font-bold ml-2">Bloqueado en Empresa</span>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">{tech.branch}</td>
                                                <td className="px-6 py-4 text-center">{reqDocs.length}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${missingOrPendingCount > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {missingOrPendingCount}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center"><ScoreBadge score={companySpecificScore} /></td>
                                                <td className="px-6 py-4"><StatusBadge status={companySpecificStatus} /></td>
                                                <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex justify-end gap-2">
                                                        {canEdit && (
                                                            <button
                                                                className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded"
                                                                title="Subir Documento"
                                                                onClick={() => setShowUploadTechDoc({ techId: tech.id, name: tech.name })}
                                                            >
                                                                <Upload size={18} />
                                                            </button>
                                                        )}
                                                        <div className="relative group/menu">
                                                            <button className="p-1.5 text-slate-400 hover:text-slate-700 rounded"><MoreVertical size={18} /></button>
                                                            <div className="absolute right-0 top-full mt-1 w-52 bg-white shadow-xl rounded-lg border border-slate-100 hidden group-hover/menu:block z-20 py-1">
                                                                <Link to={`/technicians?id=${tech.id}`} className="w-full text-left px-4 py-2 text-sm text-brand-700 font-medium bg-brand-50 hover:bg-brand-100 flex items-center gap-2">
                                                                    <ExternalLink size={14} /> Ver Perfil Completo
                                                                </Link>
                                                                {canEdit && (
                                                                    <>
                                                                        <button onClick={() => setShowUploadTechDoc({ techId: tech.id, name: tech.name })} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                                                            <Upload size={14} /> Cargar Documento
                                                                        </button>
                                                                        <button onClick={() => handleCompanyBlock(tech.id, !!isBlocked)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                                                            <Lock size={14} /> {isBlocked ? 'Desbloquear' : 'Bloquear en Empresa'}
                                                                        </button>
                                                                        <button onClick={() => handleGlobalToggle(tech.id, tech.isActive)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                                                            <UserCheck size={14} /> {tech.isActive ? 'Deshabilitar Global' : 'Habilitar Global'}
                                                                        </button>
                                                                        <div className="h-px bg-slate-100 my-1"></div>
                                                                        <button onClick={() => handleUnlink(tech.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                                                            <Trash2 size={14} /> Desasignar
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- TAB CONTENT: COMPANY DOCS --- */}
            {activeTab === 'DOCS' && (
                <div className="bg-white rounded-b-xl rounded-r-xl shadow-sm border border-slate-100 min-h-[400px]">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800">Documentación Corporativa</h3>
                        <div className="flex gap-2">
                            {/* Rodrigo Osorio v0.5 - Menú de descarga con 5 opciones */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                                    disabled={downloading}
                                    className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium text-sm hover:bg-blue-100 border border-blue-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {downloading ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Generando ZIP...
                                        </>
                                    ) : (
                                        <>
                                            <Download size={16} />
                                            Descargar
                                            <ChevronDown size={16} className={`transition-transform ${showDownloadMenu ? 'rotate-180' : ''}`} />
                                        </>
                                    )}
                                </button>

                                {showDownloadMenu && !downloading && (
                                    <div className="absolute right-0 top-full mt-2 w-80 bg-white shadow-xl rounded-lg border border-slate-200 z-20 py-2">
                                        <button
                                            onClick={() => handleDownloadZip('valid_all')}
                                            className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex flex-col gap-1"
                                        >
                                            <span className="font-medium text-slate-900">Documentos válidos de técnicos y empresa</span>
                                            <span className="text-xs text-slate-500">Solo documentos con estado VÁLIDO</span>
                                        </button>
                                        <button
                                            onClick={() => handleDownloadZip('valid_techs')}
                                            className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex flex-col gap-1"
                                        >
                                            <span className="font-medium text-slate-900">Solo documentos válidos de técnicos</span>
                                            <span className="text-xs text-slate-500">Excluye documentos de empresa</span>
                                        </button>
                                        <button
                                            onClick={() => handleDownloadZip('compliant_techs')}
                                            className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex flex-col gap-1"
                                        >
                                            <span className="font-medium text-slate-900">Documentos de técnicos que cumplen (100%)</span>
                                            <span className="text-xs text-slate-500">Todos los docs de técnicos con score 100%</span>
                                        </button>
                                        <button
                                            onClick={() => handleDownloadZip('all_techs')}
                                            className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex flex-col gap-1"
                                        >
                                            <span className="font-medium text-slate-900">Todos los documentos de técnicos</span>
                                            <span className="text-xs text-slate-500">Sin filtro por estado</span>
                                        </button>
                                        <div className="h-px bg-slate-200 my-1"></div>
                                        <button
                                            onClick={() => handleDownloadZip('company_only')}
                                            className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex flex-col gap-1"
                                        >
                                            <span className="font-medium text-slate-900">Solo documentos de la empresa</span>
                                            <span className="text-xs text-slate-500">Sin documentos de técnicos</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {canEdit && (
                                <button
                                    onClick={() => setShowUploadCompDoc(true)}
                                    className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium text-sm hover:bg-brand-700 flex items-center gap-2"
                                >
                                    <Plus size={16} /> Añadir Documento
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {companyDocs.length === 0 ? (
                            <div className="col-span-full p-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
                                <FileText size={48} className="mx-auto text-slate-300 mb-3" />
                                <p className="text-slate-500">No hay documentos cargados.</p>
                                {canEdit && <button onClick={() => setShowUploadCompDoc(true)} className="text-brand-600 font-medium hover:underline mt-2">Cargar el primero</button>}
                            </div>
                        ) : (
                            companyDocs.map(doc => (
                                <div key={doc.id} className="border border-slate-200 rounded-xl p-4 hover:border-brand-300 transition-colors group">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="p-2 bg-slate-100 rounded-lg text-slate-600 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                                            <FileText size={24} />
                                        </div>
                                        {canEdit && (
                                            <div className="relative group/action">
                                                <button className="text-slate-400 hover:text-slate-700"><MoreVertical size={18} /></button>
                                                <div className="absolute right-0 top-full mt-1 w-32 bg-white shadow-lg rounded-lg border border-slate-100 hidden group-hover/action:block z-10">
                                                    <button onClick={() => alert("Editar (Mock)")} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50">Editar</button>
                                                    <button onClick={() => handleDeleteCompDoc(doc.id)} className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50">Eliminar</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <h4 className="font-bold text-slate-900 line-clamp-1">{doc.documentTypeName}</h4>
                                    <div className="text-xs text-slate-500 mt-1">
                                        {doc.issueDate && <div>Emitido: {formatDateForDisplay(doc.issueDate)}</div>}
                                        <div>Vence: {formatDateForDisplay(doc.expiryDate || '')}</div>
                                    </div>
                                    <div className="mt-4 flex items-center justify-between">
                                        <StatusBadge status={doc.status} />
                                        <div className="flex gap-2">
                                            {doc.fileUrl && (
                                                <button
                                                    onClick={() => handleDownloadDoc(doc)}
                                                    disabled={downloadingId === doc.id}
                                                    className="flex items-center gap-1.5 text-slate-400 hover:text-brand-600 transition-colors disabled:opacity-50"
                                                    title="Ver documento (desencriptado)"
                                                >
                                                    {downloadingId === doc.id ? (
                                                        <Loader2 size={18} className="animate-spin" />
                                                    ) : (
                                                        <Eye size={18} />
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* --- TAB CONTENT: REQUIREMENTS --- */}
            {activeTab === 'REQS' && (
                <div className="bg-white rounded-b-xl rounded-r-xl shadow-sm border border-slate-100 min-h-[400px]">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div>
                            <h3 className="font-bold text-slate-800">Requisitos para Técnicos</h3>
                            <p className="text-xs text-slate-500">Documentos que los técnicos deben presentar para ingresar a esta empresa</p>
                        </div>
                        {canEdit && (
                            <button
                                onClick={() => setShowReqModal(true)}
                                className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-50 flex items-center gap-2"
                            >
                                <CheckSquare size={16} /> Gestionar Requisitos
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                <tr>
                                    <th className="px-6 py-4">Documento</th>
                                    <th className="px-6 py-4">Descripción</th>
                                    <th className="px-6 py-4">Área Responsable</th>
                                    <th className="px-6 py-4 text-center">Vigencia</th>
                                    <th className="px-6 py-4 text-right">Requerido</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {allTechDocTypes.map(doc => {
                                    // Rodrigo Osorio v0.3 - Usar estado local en lugar del prop para reflejar cambios inmediatos
                                    const isRequired = requiredDocTypes.includes(doc.id);

                                    return (
                                        <tr key={doc.id} className={isRequired ? 'bg-white' : 'bg-slate-50/50 opacity-70'}>
                                            <td className="px-6 py-4 font-medium text-slate-900">{doc.name}</td>
                                            <td className="px-6 py-4 text-slate-500 max-w-xs truncate">{doc.description}</td>
                                            <td className="px-6 py-4"><span className="px-2 py-1 bg-slate-100 rounded text-xs">Área Técnica</span></td>
                                            <td className="px-6 py-4 text-center">
                                                {doc.renewalType === 'PERIODIC' ? `${doc.renewalFrequency} ${doc.renewalUnit}` : 'Fija'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    type="button"
                                                    disabled={!canEdit}
                                                    onClick={() => {

                                                        toggleRequirement(doc.id, !isRequired);
                                                    }}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 ${isRequired ? 'bg-brand-600' : 'bg-slate-300'} ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${isRequired ? 'translate-x-6' : 'translate-x-1'}`} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- TAB CONTENT: EPS (Empresas Prestadoras de Servicio) --- */}
            {activeTab === 'EPS' && (
                <div className="bg-white rounded-b-xl rounded-r-xl shadow-sm border border-slate-100 min-h-[400px]">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-purple-50/50">
                        <div>
                            <h3 className="font-bold text-slate-800">Empresas Prestadoras de Servicio</h3>
                            <p className="text-xs text-slate-500">Solo técnicos vinculados a estas EPS pueden ser asignados a esta empresa</p>
                        </div>
                        {canEdit && (
                            <button
                                onClick={() => setShowEPSModal(true)}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium text-sm hover:bg-purple-700 flex items-center gap-2"
                            >
                                <Plus size={16} /> Vincular EPS
                            </button>
                        )}
                    </div>

                    {companyEPS.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                                <AlertCircle size={32} className="text-amber-600" />
                            </div>
                            <h4 className="text-lg font-semibold text-slate-800 mb-2">Sin Empresa Prestadora Vinculada</h4>
                            <p className="text-slate-500 text-sm max-w-md mb-4">
                                Esta empresa no tiene ninguna EPS asociada. Vincula al menos una para poder asignar técnicos.
                            </p>
                            {canEdit && (
                                <button
                                    onClick={() => setShowEPSModal(true)}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium text-sm hover:bg-purple-700 flex items-center gap-2"
                                >
                                    <Plus size={16} /> Vincular Primera EPS
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {companyEPS.map(sp => (
                                <div key={sp.id} className="border border-purple-200 rounded-xl p-4 bg-purple-50/30 group hover:border-purple-400 transition-colors">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                                <Building2 size={20} className="text-purple-600" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-slate-900">{sp.name}</h4>
                                                {sp.rut && <p className="text-xs text-slate-500">{sp.rut}</p>}
                                            </div>
                                        </div>
                                        {canEdit && (
                                            <button
                                                onClick={async () => {
                                                    if (!window.confirm(`¿Desvincular ${sp.name}? Los técnicos de esta EPS ya no podrán asignarse.`)) return;
                                                    setEpsLoading(true);
                                                    await unlinkCompanyFromServiceProvider(company.id, sp.id);
                                                    const updated = await getCompanyServiceProviders(company.id);
                                                    setCompanyEPS(updated);
                                                    setEpsLoading(false);
                                                }}
                                                disabled={epsLoading}
                                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition-all disabled:opacity-50"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>

                                    {sp.industry && (
                                        <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                            {sp.industry}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* --- TAB CONTENT: COMPANY REQUIREMENTS --- */}
            {/* Rodrigo Osorio v0.5 - Requisitos documentales de la empresa */}
            {activeTab === 'COMP_REQS' && (
                <div className="bg-white rounded-b-xl rounded-r-xl shadow-sm border border-slate-100 min-h-[400px]">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div>
                            <h3 className="font-bold text-slate-800">Requisitos Documentales de la Empresa</h3>
                            <p className="text-xs text-slate-500">Documentos que esta empresa debe presentar para su acreditación</p>
                        </div>
                        {canEdit && (
                            <button
                                onClick={() => setShowCompanyReqModal(true)}
                                className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-50 flex items-center gap-2"
                            >
                                <CheckSquare size={16} /> Gestionar Requisitos
                            </button>
                        )}
                    </div>

                    <div className="p-6">
                        {companyRequiredDocs.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                                <Shield size={48} className="mx-auto text-slate-300 mb-3" />
                                <p className="text-slate-600 font-medium">No hay requisitos documentales configurados</p>
                                <p className="text-sm text-slate-500 mt-1">Usa "Gestionar Requisitos" para seleccionar los documentos que esta empresa debe presentar</p>
                                {canEdit && (
                                    <button
                                        onClick={() => setShowCompanyReqModal(true)}
                                        className="mt-4 text-brand-600 font-medium hover:underline"
                                    >
                                        Configurar Requisitos
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Resumen de cumplimiento */}
                                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                    {(() => {
                                        const status = calculateCompanyCredentialStatus(company, [...techDocTypes, ...companyDocTypes]);
                                        return (
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm text-slate-500 mb-1">Estado de Acreditación</div>
                                                    <div className="flex items-center gap-4">
                                                        <StatusBadge status={status.overallStatus} />
                                                        <span className="text-2xl font-bold text-slate-900">{status.complianceScore}%</span>
                                                    </div>
                                                </div>
                                                <div className="text-right text-sm text-slate-600">
                                                    <div><span className="font-bold text-green-600">{status.validCount}</span> de {status.requiredCount} válidos</div>
                                                    <div className="text-xs text-slate-500 mt-1">{status.uploadedCount} documentos cargados</div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Grid de documentos requeridos */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {companyRequiredDocs.map(docId => {
                                        const docType = companyDocTypes.find(d => d.id === docId);
                                        if (!docType) return null;

                                        const credential = companyDocs.find(c => c.documentTypeId === docId);
                                        const hasFile = !!credential?.fileUrl;
                                        const status = credential?.status || ComplianceStatus.MISSING;

                                        return (
                                            <div key={docId} className="border border-slate-200 rounded-lg p-4 hover:border-brand-300 transition-colors">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="p-2 bg-slate-100 rounded-lg">
                                                        <Shield size={20} className="text-slate-600" />
                                                    </div>
                                                    <StatusBadge status={status} />
                                                </div>
                                                <h4 className="font-bold text-slate-900 text-sm mb-1">{docType.name}</h4>
                                                {credential?.expiryDate && (
                                                    <div className="text-xs text-slate-500 mb-3">
                                                        Vence: {formatDateForDisplay(credential.expiryDate)}
                                                    </div>
                                                )}
                                                <div className="mt-3">
                                                    {!hasFile ? (
                                                        canEdit && (
                                                            <button
                                                                onClick={() => setShowUploadCompDoc(docId)}
                                                                className="w-full text-sm px-3 py-2 bg-brand-50 text-brand-700 rounded-lg hover:bg-brand-100 flex items-center justify-center gap-2"
                                                            >
                                                                <Upload size={14} />
                                                                Subir Documento
                                                            </button>
                                                        )
                                                    ) : (
                                                        <button
                                                            onClick={() => credential.fileUrl && openDocumentInNewWindow(credential.fileUrl)}
                                                            className="w-full text-sm px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center justify-center gap-2"
                                                        >
                                                            <Eye size={14} />
                                                            Ver Documento
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal para vincular EPS */}
            {showEPSModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-purple-50">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <Building2 size={18} className="text-purple-600" /> Vincular Empresa Prestadora
                            </h3>
                            <button onClick={() => setShowEPSModal(false)} disabled={epsLoading}>
                                <X size={20} className="text-slate-400 hover:text-slate-600" />
                            </button>
                        </div>
                        <div className="p-2 max-h-[300px] overflow-y-auto">
                            {(() => {
                                const availableEPS = allServiceProviders.filter(sp =>
                                    !companyEPS.some(csp => csp.id === sp.id)
                                );

                                if (availableEPS.length === 0) {
                                    return (
                                        <div className="p-8 text-center text-slate-500 text-sm">
                                            {allServiceProviders.length === 0
                                                ? 'No hay empresas prestadoras registradas. Créalas en Configuración.'
                                                : 'Todas las empresas prestadoras ya están vinculadas.'}
                                        </div>
                                    );
                                }

                                return availableEPS.map(sp => (
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
                                        disabled={epsLoading}
                                        className="w-full text-left px-4 py-3 hover:bg-purple-50 border-b border-slate-50 last:border-0 flex justify-between group disabled:opacity-50"
                                    >
                                        <div>
                                            <div className="font-medium text-slate-800">{sp.name}</div>
                                            {sp.industry && <div className="text-xs text-slate-500">{sp.industry}</div>}
                                        </div>
                                        {epsLoading ? (
                                            <Loader2 size={18} className="text-purple-600 animate-spin" />
                                        ) : (
                                            <Plus size={18} className="text-slate-300 group-hover:text-purple-600" />
                                        )}
                                    </button>
                                ));
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Edit Company */}
            {showEditCompany && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-900">Editar Empresa</h3>
                            <button onClick={() => setShowEditCompany(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <form onSubmit={handleUpdateCompany} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={editCompanyData.name || ''} onChange={e => setEditCompanyData({ ...editCompanyData, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">RUT</label>
                                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={editCompanyData.rut || ''} onChange={e => setEditCompanyData({ ...editCompanyData, rut: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Industria</label>
                                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={editCompanyData.industry || ''} onChange={e => setEditCompanyData({ ...editCompanyData, industry: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={editCompanyData.type || 'SUBSIDIARY'} onChange={e => setEditCompanyData({ ...editCompanyData, type: e.target.value as any })}>
                                    <option value="HOLDING">Holding</option>
                                    <option value="SUBSIDIARY">Filial</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500"
                                    value={editCompanyData.address || ''} onChange={e => setEditCompanyData({ ...editCompanyData, address: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Contacto</label>
                                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={editCompanyData.contactName || ''} onChange={e => setEditCompanyData({ ...editCompanyData, contactName: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input type="email" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={editCompanyData.contactEmail || ''} onChange={e => setEditCompanyData({ ...editCompanyData, contactEmail: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={editCompanyData.contactPhone || ''} onChange={e => setEditCompanyData({ ...editCompanyData, contactPhone: e.target.value })} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Portal de Proveedores</label>
                                <select
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={editCompanyData.supplierPortalId || ''}
                                    onChange={e => setEditCompanyData({ ...editCompanyData, supplierPortalId: e.target.value || undefined })}
                                >
                                    <option value="">Sin portal asignado</option>
                                    {allSupplierPortals.filter(p => p.isActive).map(portal => (
                                        <option key={portal.id} value={portal.id}>
                                            {portal.name} - {portal.url}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">
                                    Los portales se configuran en Configuración &gt; Portales de Proveedores
                                </p>
                            </div>
                            <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowEditCompany(false)} className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button type="submit" className="px-5 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Rodrigo Osorio v0.5 - Modal para seleccionar requisitos de empresa */}
            {showCompanyReqModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-bold text-slate-900">Requisitos Documentales de Empresa</h3>
                                <p className="text-xs text-slate-500 mt-1">Selecciona los documentos que esta empresa debe presentar</p>
                            </div>
                            <button onClick={() => setShowCompanyReqModal(false)}>
                                <X size={20} className="text-slate-400 hover:text-slate-600" />
                            </button>
                        </div>
                        <div className="p-6 max-h-[500px] overflow-y-auto">
                            <div className="space-y-2">
                                {companyDocTypes.map(doc => {
                                    const isRequired = companyRequiredDocs.includes(doc.id);
                                    return (
                                        <div
                                            key={doc.id}
                                            className={`p-3 rounded-lg border transition-colors cursor-pointer ${isRequired
                                                ? 'border-brand-300 bg-brand-50'
                                                : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                            onClick={() => {
                                                if (isRequired) {
                                                    setCompanyRequiredDocs(companyRequiredDocs.filter(id => id !== doc.id));
                                                } else {
                                                    setCompanyRequiredDocs([...companyRequiredDocs, doc.id]);
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                {isRequired ? (
                                                    <CheckSquare size={20} className="text-brand-600 flex-shrink-0" />
                                                ) : (
                                                    <Square size={20} className="text-slate-400 flex-shrink-0" />
                                                )}
                                                <div className="flex-1">
                                                    <div className="font-medium text-slate-900">{doc.name}</div>
                                                    {doc.description && (
                                                        <div className="text-xs text-slate-500 mt-0.5">{doc.description}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                            <button
                                onClick={() => {
                                    setCompanyRequiredDocs(company.requiredDocTypeIdsForCompany || []);
                                    setShowCompanyReqModal(false);
                                }}
                                className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    const result = await updateCompanyDocRequirements(company.id, companyRequiredDocs);
                                    if (result.success) {
                                        setShowCompanyReqModal(false);
                                        refresh();
                                    } else {
                                        alert(result.error || 'Error al actualizar requisitos');
                                    }
                                }}
                                className="px-5 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
                            >
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODALS --- */}

            <AssignTechnicianModal
                isOpen={showAssignModal}
                onClose={() => setShowAssignModal(false)}
                companyId={company.id}
                currentTechIds={technicians.map(t => t.id)}
                onAssign={() => { refresh(); setShowAssignModal(false); }}
            />

            <UploadDocModal
                isOpen={!!showUploadTechDoc}
                onClose={() => setShowUploadTechDoc(null)}
                title={`Cargar Doc. para ${showUploadTechDoc?.name}`}
                docTypes={techDocTypes}
                entityId={showUploadTechDoc?.techId}
                entityType="technician"
                onSave={async (docTypeId: string, expiryDate: string, fileUrl: string | undefined, issueDate: string) => {
                    if (showUploadTechDoc) {
                        await addCredentialToTechnician(showUploadTechDoc.techId, docTypeId, expiryDate, fileUrl, issueDate);
                        refresh();
                        setShowUploadTechDoc(null);
                    }
                }}
            />

            <UploadDocModal
                isOpen={!!showUploadCompDoc}
                onClose={() => setShowUploadCompDoc(false)}
                title="Cargar Documento Corporativo"
                docTypes={companyDocTypes}
                entityId={company.id}
                entityType="company"
                preselectedDocTypeId={typeof showUploadCompDoc === 'string' ? showUploadCompDoc : undefined}
                onSave={async (docTypeId: string, expiryDate: string, fileUrl: string | undefined, issueDate: string) => {
                    await addCompanyCredential(company.id, docTypeId, expiryDate, fileUrl, issueDate);
                    refresh();
                    setShowUploadCompDoc(false);
                }}
            />

            <ManageReqModal
                isOpen={showReqModal}
                onClose={() => setShowReqModal(false)}
                allDocs={allTechDocTypes}
                selectedIds={company.requiredDocTypes}
                onSave={async (ids) => {
                    await updateCompanyTechRequirements(company.id, ids);
                    refresh();
                    setShowReqModal(false);
                }}
            />

        </div>
    );
};

// --- HELPER COMPONENTS ---

const AssignTechnicianModal = ({ isOpen, onClose, companyId, currentTechIds, onAssign }: any) => {
    const [search, setSearch] = useState('');
    const [allTechs, setAllTechs] = useState<Technician[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [hasEPS, setHasEPS] = useState(true);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            // Usar la función que filtra por EPS común
            getAvailableTechniciansForCompany(companyId).then(techs => {
                setAllTechs(techs);
                setHasEPS(techs.length > 0 || techs !== null);
                setLoading(false);
            }).catch(() => {
                // Si falla (empresa sin EPS), mostrar advertencia
                setAllTechs([]);
                setHasEPS(false);
                setLoading(false);
            });
        }
    }, [isOpen, companyId]);

    if (!isOpen) return null;

    const availableTechs = allTechs
        .filter(t => !currentTechIds.includes(t.id))
        .filter(t =>
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.rut.includes(search) ||
            (t.branch && t.branch.toLowerCase().includes(search.toLowerCase()))
        );

    const handleAssign = async () => {
        await assignTechniciansToCompany(companyId, Array.from(selected));
        onAssign();
        setSelected(new Set());
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-brand-50">
                    <h3 className="font-bold text-slate-900">Asignar Técnicos</h3>
                    <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                </div>
                <div className="p-4 border-b border-slate-100">
                    <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Buscar por nombre, RUT o sucursal..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="overflow-y-auto p-2 flex-1">
                    {loading ? (
                        <div className="p-8 text-center">
                            <Loader2 size={24} className="animate-spin mx-auto text-brand-600 mb-2" />
                            <p className="text-slate-500 text-sm">Cargando técnicos disponibles...</p>
                        </div>
                    ) : !hasEPS || allTechs.length === 0 ? (
                        <div className="p-6 text-center">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <AlertCircle size={24} className="text-amber-600" />
                            </div>
                            <h4 className="font-semibold text-slate-800 mb-1">Sin técnicos disponibles</h4>
                            <p className="text-slate-500 text-sm">
                                {!hasEPS
                                    ? 'Esta empresa no tiene Empresas Prestadoras vinculadas. Vincule una EPS primero.'
                                    : 'No hay técnicos que pertenezcan a las mismas EPS que esta empresa.'}
                            </p>
                        </div>
                    ) : availableTechs.length === 0 ? (
                        <div className="p-4 text-center text-slate-500">No se encontraron técnicos con ese criterio de búsqueda.</div>
                    ) : (
                        availableTechs.map(t => (
                            <div key={t.id}
                                className={`flex items-center p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 ${selected.has(t.id) ? 'bg-blue-50' : ''}`}
                                onClick={() => {
                                    const next = new Set(selected);
                                    if (next.has(t.id)) next.delete(t.id); else next.add(t.id);
                                    setSelected(next);
                                }}
                            >
                                <div className={`mr-3 ${selected.has(t.id) ? 'text-brand-600' : 'text-slate-300'}`}>
                                    {selected.has(t.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800 text-sm">{t.name}</div>
                                    <div className="text-xs text-slate-500">{t.rut} • {t.role}</div>
                                    <div className="text-xs text-slate-400">{t.branch}</div>
                                </div>
                                <div className="ml-auto">
                                    <ScoreBadge score={t.complianceScore} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50">
                    <span className="text-sm text-slate-500">{selected.size} seleccionados</span>
                    <button onClick={handleAssign} disabled={selected.size === 0} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50">Confirmar</button>
                </div>
            </div>
        </div>
    );
};

// Rodrigo Osorio v0.5 - Modal con fechas de emisión y vencimiento obligatorias + preselección de documento
const UploadDocModal = ({ isOpen, onClose, title, docTypes, onSave, entityId, entityType, preselectedDocTypeId }: any) => {
    const [docType, setDocType] = useState(preselectedDocTypeId || '');
    const [issueDate, setIssueDate] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Rodrigo Osorio v0.5 - Actualizar docType cuando cambia el preselectedDocTypeId
    React.useEffect(() => {
        if (preselectedDocTypeId) {
            setDocType(preselectedDocTypeId);
        }
    }, [preselectedDocTypeId]);

    const handleSave = async () => {
        // Validaciones
        if (!docType) {
            setError('Selecciona un tipo de documento');
            return;
        }

        if (!issueDate || !isValidDateFormat(issueDate)) {
            setError('Ingresa una fecha de emisión válida (dd-mm-aaaa)');
            return;
        }

        if (!expiryDate || !isValidDateFormat(expiryDate)) {
            setError('Ingresa una fecha de vencimiento válida (dd-mm-aaaa)');
            return;
        }

        if (!validateDateRange(issueDate, expiryDate)) {
            setError('La fecha de emisión debe ser anterior o igual a la de vencimiento');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            let fileUrl: string | undefined;

            if (selectedFile && entityId) {
                const docTypeName = docTypes.find((d: any) => d.id === docType)?.name || 'DOCUMENTO';

                const uploadFn = entityType === 'company' ? uploadCompanyDocument : uploadTechnicianDocument;
                const result = await uploadFn(entityId, docTypeName, selectedFile);

                if (!result.success) {
                    setError(result.error || 'Error al subir archivo');
                    setUploading(false);
                    return;
                }
                fileUrl = result.url;
            }

            // Convertir fechas a formato BD antes de enviar
            const expiryDateDB = formatDateForDB(expiryDate);
            const issueDateDB = formatDateForDB(issueDate);

            await onSave(docType, expiryDateDB, fileUrl, issueDateDB);

            // Reset
            setDocType('');
            setIssueDate('');
            setExpiryDate('');
            setSelectedFile(null);
        } catch (err: any) {
            setError(err.message || 'Error al guardar');
        } finally {
            setUploading(false);
        }
    };

    const handleClose = () => {
        if (uploading) return;
        setDocType('');
        setIssueDate('');
        setExpiryDate('');
        setSelectedFile(null);
        setError(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-brand-50">
                    <h3 className="font-bold text-slate-900">{title}</h3>
                    <button onClick={handleClose} disabled={uploading}>
                        <X size={20} className="text-slate-400 hover:text-slate-600" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Tipo de Documento *
                            {preselectedDocTypeId && <span className="ml-2 text-xs text-green-600 font-normal">(pre-seleccionado)</span>}
                        </label>
                        <select
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
                            value={docType}
                            onChange={e => setDocType(e.target.value)}
                            disabled={uploading || !!preselectedDocTypeId}
                        >
                            <option value="">Seleccionar...</option>
                            {docTypes.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>

                    <DateInput
                        label="Fecha de Emisión"
                        value={issueDate}
                        onChange={setIssueDate}
                        required
                        disabled={uploading}
                    />

                    <DateInput
                        label="Fecha de Vencimiento"
                        value={expiryDate}
                        onChange={setExpiryDate}
                        required
                        disabled={uploading}
                    />

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Archivo</label>
                        <FileUpload
                            onFileSelect={setSelectedFile}
                            selectedFile={selectedFile}
                            disabled={uploading}
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={handleClose}
                            className="px-4 py-2 text-slate-600 font-medium text-sm hover:bg-slate-100 rounded-lg"
                            disabled={uploading}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-brand-600 text-white font-medium text-sm rounded-lg hover:bg-brand-700 flex items-center gap-2 disabled:opacity-50"
                            disabled={uploading}
                        >
                            {uploading && <Loader2 size={16} className="animate-spin" />}
                            {uploading ? 'Subiendo...' : 'Guardar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const ManageReqModal = ({ isOpen, onClose, allDocs, selectedIds, onSave }: any) => {
    const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
    const [search, setSearch] = useState('');

    useEffect(() => { setSelected(new Set(selectedIds)); }, [selectedIds, isOpen]);

    if (!isOpen) return null;

    const filtered = allDocs.filter((d: any) => d.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-brand-50">
                    <h3 className="font-bold text-slate-900">Gestionar Requisitos Masivos</h3>
                    <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                </div>
                <div className="p-4 border-b border-slate-100">
                    <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Buscar documento..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="overflow-y-auto p-4 flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filtered.map((d: any) => (
                        <div key={d.id}
                            onClick={() => {
                                const next = new Set(selected);
                                if (next.has(d.id)) next.delete(d.id); else next.add(d.id);
                                setSelected(next);
                            }}
                            className={`flex items-center p-3 rounded-lg cursor-pointer border ${selected.has(d.id) ? 'bg-brand-50 border-brand-200' : 'bg-white border-slate-200'}`}
                        >
                            <div className={`mr-3 ${selected.has(d.id) ? 'text-brand-600' : 'text-slate-300'}`}>
                                {selected.has(d.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                            </div>
                            <span className="text-sm font-medium text-slate-700">{d.name}</span>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium text-sm hover:bg-slate-100 rounded-lg">Cancelar</button>
                    <button onClick={() => onSave(Array.from(selected))} className="px-4 py-2 bg-brand-600 text-white font-medium text-sm rounded-lg hover:bg-brand-700">Guardar Cambios</button>
                </div>
            </div>
        </div>
    );
}

// --- SUB-COMPONENT: NEW COMPANY MODAL ---
// (Kept similar but minimal updates if needed, reusing previous logic logic structure for consistency)

const NewCompanyModal = ({ isOpen, onClose, onSave, industries, holdings, techDocs, companyDocs, serviceProviders }: any) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<Partial<Company>>({
        name: '', rut: '', industry: '', type: 'SUBSIDIARY',
        holdingId: '', requiredDocTypes: [], requiredDocTypeIdsForCompany: []
    });
    const [selectedEPS, setSelectedEPS] = useState<Set<string>>(new Set());

    if (!isOpen) return null;

    const handleNext = () => {
        if (!formData.name || !formData.rut || !formData.industry) {
            alert("Por favor completa los campos obligatorios");
            return;
        }
        if (selectedEPS.size === 0) {
            alert("Selecciona al menos una Empresa Prestadora que atenderá a esta empresa.");
            return;
        }
        setStep(2);
    };

    const handleSave = () => {
        onSave({
            ...formData,
            serviceProviderIds: Array.from(selectedEPS)
        });
        setFormData({ name: '', rut: '', industry: '', type: 'SUBSIDIARY', requiredDocTypes: [], requiredDocTypeIdsForCompany: [] });
        setSelectedEPS(new Set());
        setStep(1);
    };

    const toggleDoc = (id: string, scope: 'TECHNICIAN' | 'COMPANY') => {
        if (scope === 'TECHNICIAN') {
            const current = new Set(formData.requiredDocTypes || []);
            if (current.has(id)) current.delete(id); else current.add(id);
            setFormData({ ...formData, requiredDocTypes: Array.from(current) });
        } else {
            const current = new Set(formData.requiredDocTypeIdsForCompany || []);
            if (current.has(id)) current.delete(id); else current.add(id);
            setFormData({ ...formData, requiredDocTypeIdsForCompany: Array.from(current) });
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-brand-50 shrink-0">
                    <h3 className="font-bold text-brand-900 text-lg flex items-center gap-2">
                        <Building2 size={20} /> Nueva Empresa
                    </h3>
                    <button onClick={onClose}><X size={20} className="text-brand-700 hover:text-brand-900" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {/* Progress Stepper */}
                    <div className="flex items-center justify-center mb-8">
                        <div className={`flex items-center gap-2 text-sm font-bold ${step === 1 ? 'text-brand-600' : 'text-slate-400'}`}>
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === 1 ? 'border-brand-600 bg-brand-50' : 'border-slate-300'}`}>1</span>
                            Datos Generales
                        </div>
                        <div className="w-16 h-px bg-slate-300 mx-4"></div>
                        <div className={`flex items-center gap-2 text-sm font-bold ${step === 2 ? 'text-brand-600' : 'text-slate-400'}`}>
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === 2 ? 'border-brand-600 bg-brand-50' : 'border-slate-300'}`}>2</span>
                            Requisitos Documentales
                        </div>
                    </div>

                    {step === 1 && (
                        <div className="space-y-6 max-w-2xl mx-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Razón Social *</label>
                                    <input required className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none bg-white text-slate-900"
                                        value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Constructora ABC S.A." />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">RUT *</label>
                                    <input required className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none bg-white text-slate-900"
                                        value={formData.rut} onChange={e => setFormData({ ...formData, rut: e.target.value })} placeholder="76.xxx.xxx-x" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Industria *</label>
                                    <select required className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                                        value={formData.industry} onChange={e => setFormData({ ...formData, industry: e.target.value })}>
                                        <option value="">Seleccionar...</option>
                                        {industries.map((ind: Industry) => <option key={ind.id} value={ind.name}>{ind.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="bg-purple-50 p-6 rounded-xl border border-purple-200">
                                <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <Building2 size={18} className="text-purple-700" /> Empresa Prestadora que atenderá *
                                    <span className="ml-auto text-xs bg-white/60 text-purple-700 px-2 py-0.5 rounded-full">{selectedEPS.size} seleccionadas</span>
                                </h4>
                                {(!serviceProviders || serviceProviders.length === 0) ? (
                                    <p className="text-sm text-purple-700">No hay EPS registradas. Crea una en Configuración.</p>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {serviceProviders.map((sp: ServiceProvider) => {
                                            const isSelected = selectedEPS.has(sp.id);
                                            return (
                                                <div
                                                    key={sp.id}
                                                    onClick={() => {
                                                        const next = new Set(selectedEPS);
                                                        if (next.has(sp.id)) next.delete(sp.id); else next.add(sp.id);
                                                        setSelectedEPS(next);
                                                    }}
                                                    className={`p-3 border rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-white border-purple-300 shadow-sm' : 'bg-white/60 border-purple-100 hover:border-purple-200'}`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-4 h-4 rounded ${isSelected ? 'bg-purple-600' : 'border border-purple-300 bg-white'}`}></div>
                                                        <div>
                                                            <div className={`text-sm font-semibold ${isSelected ? 'text-purple-900' : 'text-slate-800'}`}>{sp.name}</div>
                                                            {sp.industry && <div className="text-xs text-slate-500">{sp.industry}</div>}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mt-6">
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Layers size={18} /> Estructura Corporativa</h4>

                                <div className="space-y-4">
                                    <label className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-brand-300">
                                        <div>
                                            <div className="font-bold text-slate-900">¿Es un Holding?</div>
                                            <div className="text-xs text-slate-500">Agrupa otras empresas filiales</div>
                                        </div>
                                        <div className={`w-12 h-6 rounded-full p-1 transition-colors ${formData.type === 'HOLDING' ? 'bg-brand-600' : 'bg-slate-300'}`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setFormData({ ...formData, type: formData.type === 'HOLDING' ? 'SUBSIDIARY' : 'HOLDING', holdingId: undefined });
                                            }}>
                                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${formData.type === 'HOLDING' ? 'translate-x-6' : ''}`}></div>
                                        </div>
                                    </label>

                                    {formData.type !== 'HOLDING' && (
                                        <div className="animate-in slide-in-from-top-2 fade-in">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Holding Principal (Opcional)</label>
                                            <select className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                                                value={formData.holdingId || ''}
                                                onChange={e => setFormData({ ...formData, holdingId: e.target.value })}>
                                                <option value="">-- Independiente --</option>
                                                {holdings.map((h: Company) => <option key={h.id} value={h.name}>{h.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-8">
                            {/* Section 1: Company Documents */}
                            <div>
                                <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                                    <Building2 size={18} className="text-brand-600" /> Documentos de la Empresa
                                </h4>
                                <div className="text-sm text-slate-500 mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                    Selecciona los documentos que <strong>la empresa misma</strong> debe tener vigentes (ej: Patente, Certificado Existencia).
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {companyDocs.map((doc: DocumentType) => {
                                        const isSelected = formData.requiredDocTypeIdsForCompany?.includes(doc.id);
                                        return (
                                            <div key={doc.id} onClick={() => toggleDoc(doc.id, 'COMPANY')}
                                                className={`flex items-center p-3 rounded-lg cursor-pointer border ${isSelected ? 'bg-brand-50 border-brand-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                                <div className={`mr-3 ${isSelected ? 'text-brand-600' : 'text-slate-300'}`}>
                                                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                                </div>
                                                <span className={`text-sm ${isSelected ? 'font-medium text-brand-900' : 'text-slate-700'}`}>{doc.name}</span>
                                            </div>
                                        );
                                    })}
                                    {companyDocs.length === 0 && <div className="text-sm text-slate-400 italic col-span-2">No hay tipos de documento de empresa configurados.</div>}
                                </div>
                            </div>

                            <div className="w-full h-px bg-slate-200"></div>

                            {/* Section 2: Technician Documents */}
                            <div>
                                <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                                    <Users size={18} className="text-brand-600" /> Documentos para Técnicos
                                </h4>
                                <div className="text-sm text-slate-500 mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                    Selecciona los documentos que <strong>los técnicos</strong> deben tener para trabajar en esta empresa.
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {techDocs.map((doc: DocumentType) => {
                                        const isSelected = formData.requiredDocTypes?.includes(doc.id);
                                        return (
                                            <div key={doc.id} onClick={() => toggleDoc(doc.id, 'TECHNICIAN')}
                                                className={`flex items-center p-3 rounded-lg cursor-pointer border ${isSelected ? 'bg-brand-50 border-brand-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                                <div className={`mr-3 ${isSelected ? 'text-brand-600' : 'text-slate-300'}`}>
                                                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                                </div>
                                                <span className={`text-sm ${isSelected ? 'font-medium text-brand-900' : 'text-slate-700'}`}>{doc.name}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-between p-5 border-t border-slate-100 bg-slate-50 shrink-0">
                    {step === 2 ? (
                        <button onClick={() => setStep(1)} className="flex items-center gap-2 text-slate-600 font-medium hover:text-slate-900">
                            <ArrowLeft size={16} /> Atrás
                        </button>
                    ) : (
                        <div></div> // Spacer
                    )}

                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
                        {step === 1 ? (
                            <button onClick={handleNext} className="bg-brand-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brand-700 text-sm shadow-sm flex items-center gap-2">
                                Siguiente <ChevronRight size={16} />
                            </button>
                        ) : (
                            <button onClick={handleSave} className="bg-brand-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brand-700 text-sm shadow-sm">
                                Crear Empresa
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- MAIN PAGE ---
// Rodrigo Osorio v0.8 - Lista de empresas como tabla escalable

import { ArrowUpDown, ChevronLeft as ChevronLeftIcon, ChevronsLeft, ChevronsRight, Filter } from 'lucide-react';

export const Companies = () => {
    const { canEdit } = useAuth();
    // Rodrigo Osorio v0.9 - Usa versión ligera para lista (mejor performance)
    const [companies, setCompanies] = useState<CompanyLight[]>([]);
    const [industries, setIndustries] = useState<Industry[]>([]);
    const [techDocs, setTechDocs] = useState<DocumentType[]>([]);
    const [companyDocs, setCompanyDocs] = useState<DocumentType[]>([]);
    const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Filtros y paginación
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'HOLDING' | 'SUBSIDIARY'>('all');
    const [sortField, setSortField] = useState<'name' | 'industry' | 'type'>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [complianceFilter, setComplianceFilter] = useState<'all' | 'compliant' | 'warning' | 'critical'>('all');
    const [branchFilter, setBranchFilter] = useState<string>('all');
    const [branches, setBranches] = useState<Branch[]>([]);
    const [currentPage, setCurrentPage] = useState(1);

    const itemsPerPage = 10; // Rodrigo Osorio v0.12 - Reducido para mejor UX y evitar sobrecarga

    // Obtener nombre del holding padre
    const getHoldingName = (holdingId?: string) => {
        if (!holdingId) return null;
        return companies.find(c => c.id === holdingId)?.name || null;
    };

    const loadData = async () => {
        setLoading(true);
        // Usar versión ligera para la lista (sin JOINs pesados)
        const [allCompanies, allIndustries, allDocs, allSPs, allBranches] = await Promise.all([
            getCompaniesLight(),
            getIndustries(),
            getDocumentTypes(),
            getServiceProviders(),
            getBranches()
        ]);

        setCompanies(allCompanies);
        setBranches(allBranches);
        setIndustries(allIndustries);
        setTechDocs(allDocs.filter(d => d.scope === 'TECHNICIAN'));
        setCompanyDocs(allDocs.filter(d => d.scope === 'COMPANY'));
        setServiceProviders(allSPs);
        setLoading(false);
    };

    const [exportingId, setExportingId] = useState<string | null>(null);

    // Cargar datos completos de empresa al seleccionar
    const handleSelectCompany = async (companyId: string) => {
        setLoadingDetail(true);
        const allCompanies = await getCompanies();
        const company = allCompanies.find(c => c.id === companyId);
        setSelectedCompany(company || null);
        setLoadingDetail(false);
    };

    // Exportar Resumen Empresa
    const handleExportCompanySummary = useCallback(async (companyId: string) => {
        setExportingId(companyId);
        try {
            const company = companies.find(c => c.id === companyId);
            if (!company) return;

            const headers = ['Empresa', 'RUT', 'Industria', 'Tipo', 'Cumplimiento Téc %', 'Total Técnicos', 'Técnicos OK', 'Cumplimiento Emp %', 'Docs Emp Requeridos'];
            const row = [
                company.name,
                company.rut,
                company.industry || '-',
                company.type === 'HOLDING' ? 'Holding' : 'Filial',
                `${company.technicianComplianceScore}%`,
                company.technicianCount,
                company.technicianValidCount,
                `${company.companyComplianceScore}%`,
                company.requiredDocTypesForCompanyCount
            ];

            const csvContent = [
                headers.join(','),
                row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
            ].join('\n');

            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `resumen_${company.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
        } finally {
            setExportingId(null);
        }
    }, [companies]);

    // Exportar Maestro Detallado (Empresa, Técnicos, Sucursal, EPS, Estado)
    const handleExportCompanyMaster = useCallback(async (companyId: string) => {
        setExportingId(companyId);
        try {
            const company = companies.find(c => c.id === companyId);
            if (!company) return;

            // 1. Obtener todos los técnicos asignados a ESTA empresa
            const techData = await getTechniciansByCompany(companyId);

            // 2. Obtener EPS asignadas a esta empresa
            const companyEPS = await getCompanyServiceProviders(companyId);
            const epsNames = companyEPS.map(sp => sp.name).join(' | ') || 'Sin EPS asignada';

            const headers = ['Empresa Cliente', 'Técnico', 'RUT Técnico', 'Sucursal', 'EPS (Empresa Prestadora)', 'Estado Cumplimiento', '% Cumplimiento', 'Documentos Faltantes'];

            const rows = techData.map(tech => {
                const vencidos = tech.credentials.filter(c => c.status === ComplianceStatus.EXPIRED);
                const pendientes = tech.credentials.filter(c => c.status === ComplianceStatus.PENDING || c.status === ComplianceStatus.MISSING);

                const missingDetails = [...vencidos, ...pendientes].map(c => {
                    const statusText = c.status === ComplianceStatus.EXPIRED ? 'VENCIDO' : 'PENDIENTE';
                    return `${c.documentTypeName} (${statusText})`;
                }).join(' | ') || 'Ninguno';

                return [
                    company.name,
                    tech.name,
                    tech.rut,
                    tech.branch || '-',
                    epsNames,
                    tech.overallStatus,
                    `${tech.complianceScore}%`,
                    missingDetails
                ];
            });

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `maestro_${company.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (err) {
            console.error(err);
        } finally {
            setExportingId(null);
        }
    }, [companies]);

    const [exportingMaster, setExportingMaster] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    // Rodrigo Osorio v1.0 - Sábana Maestro Operaciones (Todas las empresas + Todos los técnicos)
    const handleExportMasterSheet = useCallback(async () => {
        setExportingMaster(true);
        try {
            // 1. Cargar toda la base de datos necesaria en paralelo
            const [allTechs, allCompanies, { data: epsRelations }] = await Promise.all([
                getTechnicians(),
                getCompanies(),
                supabase.from('company_service_providers').select('company_id, service_providers(name)').eq('is_active', true)
            ]);

            const headers = [
                'Holding / Grupo',
                'Empresa Cliente',
                'RUT Empresa',
                'Técnico',
                'RUT Técnico',
                'Sucursal',
                'EPS (Empresa Prestadora)',
                'Estado Cumplimiento',
                '% Cumplimiento',
                'Documentos Faltantes'
            ];

            const rows: string[][] = [];

            // 2. Mapear EPS por empresa para acceso rápido
            const epsMap: Record<string, string[]> = {};
            (epsRelations || []).forEach((rel: any) => {
                if (!epsMap[rel.company_id]) epsMap[rel.company_id] = [];
                if (rel.service_providers?.name) epsMap[rel.company_id].push(rel.service_providers.name);
            });

            // 3. Procesar cada empresa y sus técnicos
            allCompanies.forEach(comp => {
                const assignedTechs = allTechs.filter(t => t.companyIds.includes(comp.id));
                const epsList = epsMap[comp.id]?.join(' | ') || 'Sin EPS asignada';
                const holdingName = getHoldingName(comp.holdingId) || '-';

                if (assignedTechs.length === 0) {
                    // Si no hay técnicos, al menos incluimos la fila de la empresa
                    rows.push([
                        holdingName,
                        comp.name,
                        comp.rut,
                        'SIN TÉCNICOS ASIGNADOS',
                        '-',
                        '-',
                        epsList,
                        '-',
                        '-',
                        '-'
                    ]);
                } else {
                    assignedTechs.forEach(tech => {
                        // Calcular documentos faltantes específicos
                        const vencidos = tech.credentials.filter(c => c.status === ComplianceStatus.EXPIRED);
                        const pendientes = tech.credentials.filter(c => c.status === ComplianceStatus.PENDING || c.status === ComplianceStatus.MISSING);

                        const missingDetails = [...vencidos, ...pendientes].map(c => {
                            const statusText = c.status === ComplianceStatus.EXPIRED ? 'VENCIDO' : 'PENDIENTE';
                            return `${c.documentTypeName} (${statusText})`;
                        }).join(' | ') || 'Al día';

                        const statusLabel = tech.overallStatus === ComplianceStatus.VALID ? 'HABILITADO' :
                            tech.overallStatus === ComplianceStatus.EXPIRED ? 'VENCIDO' :
                                tech.overallStatus === ComplianceStatus.EXPIRING_SOON ? 'POR VENCER' : 'PENDIENTE';

                        rows.push([
                            holdingName,
                            comp.name,
                            comp.rut,
                            tech.name,
                            tech.rut,
                            tech.branch || '-',
                            epsList,
                            statusLabel,
                            `${tech.complianceScore}%`,
                            missingDetails
                        ]);
                    });
                }
            });

            const csvContent = [
                headers.filter(h => h !== '').join(','),
                ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `SABANA_OPERACIONES_CERTIFY_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error('Error generating master sheet:', error);
            alert('Error al generar el reporte maestro');
        } finally {
            setExportingMaster(false);
        }
    }, [companies]);

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
    }

    // Holdings para el modal
    const holdings = companies.filter(c => c.type === 'HOLDING');

    // Rodrigo Osorio v0.11 - Aplicar debounce a la búsqueda para evitar filtrados excesivos
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    // Filtrar y ordenar (ahora usa debouncedSearchTerm para mejor performance)
    const filteredData = React.useMemo(() => {
        let filtered = companies.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                c.rut.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                (c.industry || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase());

            const matchesType = typeFilter === 'all' || c.type === typeFilter;

            const matchesCompliance = complianceFilter === 'all' || (() => {
                const score = c.technicianComplianceScore;
                if (complianceFilter === 'compliant') return score >= 100;
                if (complianceFilter === 'warning') return score >= 80 && score < 100;
                if (complianceFilter === 'critical') return score < 80;
                return true;
            })();

            const matchesBranch = branchFilter === 'all' || c.branchIds?.includes(branchFilter);

            return matchesSearch && matchesType && matchesCompliance && matchesBranch;
        });

        filtered.sort((a, b) => {
            let comparison = 0;
            if (sortField === 'name' || sortField === 'industry' || sortField === 'type') {
                comparison = (a[sortField] || '').localeCompare(b[sortField] || '');
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        return filtered;
    }, [companies, debouncedSearchTerm, typeFilter, complianceFilter, branchFilter, sortField, sortDirection]);

    // Paginación
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = filteredData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Estadísticas de filtro
    const typeStats = React.useMemo(() => ({
        all: companies.length,
        HOLDING: companies.filter(c => c.type === 'HOLDING').length,
        SUBSIDIARY: companies.filter(c => c.type === 'SUBSIDIARY').length
    }), [companies]);

    if (selectedCompany) {
        return <CompanyDetail company={selectedCompany} onBack={() => setSelectedCompany(null)} />;
    }

    if (loading && companies.length === 0) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-end">
                    <div className="space-y-2">
                        <Skeleton width={200} height={32} />
                        <Skeleton width={300} height={16} />
                    </div>
                </div>
                <Skeleton height={60} className="rounded-xl" />
                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                    <div className="p-6 space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="flex gap-4 items-center">
                                <Skeleton variant="rectangular" width={32} height={32} className="rounded-lg" />
                                <div className="space-y-2 flex-1">
                                    <Skeleton width="30%" height={16} />
                                    <Skeleton width="15%" height={12} />
                                </div>
                                <Skeleton width={80} height={20} />
                                <Skeleton width={100} height={24} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Empresas</h1>
                    <p className="text-slate-500 text-sm">Gestión de Holdings, Filiales y Requisitos</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExportMasterSheet}
                        disabled={exportingMaster}
                        className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-slate-200 border border-slate-200 transition-all text-sm disabled:opacity-50"
                    >
                        {exportingMaster ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Generando Sábana...
                            </>
                        ) : (
                            <>
                                <Download size={16} />
                                Descargar Reporte Maestro
                            </>
                        )}
                    </button>
                    {canEdit && (
                        <button onClick={() => setIsModalOpen(true)} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-brand-700 text-sm">
                            <Plus size={16} />
                            Nueva Empresa
                        </button>
                    )}
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="relative md:col-span-5">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, RUT o industria..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                    </div>

                    <div className="md:col-span-7 flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Filter size={14} className="text-slate-400" />
                            <select
                                value={typeFilter}
                                onChange={(e) => { setTypeFilter(e.target.value as any); setCurrentPage(1); }}
                                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                            >
                                <option value="all">Todos los Tipos</option>
                                <option value="HOLDING">Holdings</option>
                                <option value="SUBSIDIARY">Filiales</option>
                            </select>
                        </div>

                        <select
                            value={branchFilter}
                            onChange={(e) => { setBranchFilter(e.target.value); setCurrentPage(1); }}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                        >
                            <option value="all">Todas las Sucursales</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>

                        <select
                            value={complianceFilter}
                            onChange={(e) => { setComplianceFilter(e.target.value as any); setCurrentPage(1); }}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                        >
                            <option value="all">Todos los Cumplimientos</option>
                            <option value="compliant">Cumplen (100%)</option>
                            <option value="warning">En Advertencia (80-99%)</option>
                            <option value="critical">Críticas (&lt; 80%)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-400 text-sm">Cargando empresas...</div>
                ) : companies.length === 0 ? (
                    <div className="p-8 text-center">
                        <Building2 size={36} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-slate-500 text-sm">No hay empresas registradas</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-600 text-xs border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">
                                            <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-slate-900">
                                                Empresa
                                                <ArrowUpDown size={12} className={sortField === 'name' ? 'text-brand-600' : ''} />
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 text-left font-medium">RUT</th>
                                        <th className="px-4 py-3 text-left font-medium">
                                            <button onClick={() => handleSort('industry')} className="flex items-center gap-1 hover:text-slate-900">
                                                Industria
                                                <ArrowUpDown size={12} className={sortField === 'industry' ? 'text-brand-600' : ''} />
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 text-center font-medium">
                                            <button onClick={() => handleSort('type')} className="flex items-center gap-1 hover:text-slate-900 mx-auto">
                                                Tipo
                                                <ArrowUpDown size={12} className={sortField === 'type' ? 'text-brand-600' : ''} />
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 text-center font-medium">% Téc.</th>
                                        <th className="px-4 py-3 text-center font-medium">% Emp.</th>
                                        <th className="px-4 py-3 text-center font-medium">Docs Téc.</th>
                                        <th className="px-4 py-3 text-center font-medium">Docs Emp.</th>
                                        <th className="px-4 py-3 text-right font-medium">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {paginatedData.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                                                No se encontraron empresas
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedData.map(company => {
                                            const holdingName = getHoldingName(company.holdingId);
                                            return (
                                                <tr key={company.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${company.type === 'HOLDING' ? 'bg-purple-50 text-purple-600' : 'bg-indigo-50 text-indigo-600'
                                                                }`}>
                                                                {company.type === 'HOLDING' ? <Layers size={16} /> : <Building2 size={16} />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <button
                                                                    onClick={() => handleSelectCompany(company.id)}
                                                                    className="font-bold text-slate-900 truncate max-w-[200px] hover:text-brand-600 hover:underline transition-all text-left"
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
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{company.rut}</td>
                                                    <td className="px-4 py-3 text-slate-600 truncate max-w-[120px]">{company.industry || '-'}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${company.type === 'HOLDING'
                                                            ? 'bg-purple-100 text-purple-700'
                                                            : 'bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {company.type === 'HOLDING' ? 'Holding' : 'Filial'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {company.technicianCount > 0 ? (
                                                            <ScoreBadge score={company.technicianComplianceScore} />
                                                        ) : (
                                                            <span className="text-xs text-slate-400">Sin téc.</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {company.requiredDocTypesForCompanyCount > 0 ? (
                                                            <ScoreBadge score={company.companyComplianceScore} />
                                                        ) : (
                                                            <span className="text-xs text-slate-400">N/A</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-slate-600">
                                                        {company.requiredDocTypesCount}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-slate-600">
                                                        {company.requiredDocTypesForCompanyCount}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleExportCompanySummary(company.id)}
                                                                disabled={exportingId === company.id}
                                                                title="Descargar Resumen"
                                                                className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors disabled:opacity-50"
                                                            >
                                                                {exportingId === company.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                                            </button>
                                                            <button
                                                                onClick={() => handleExportCompanyMaster(company.id)}
                                                                disabled={exportingId === company.id}
                                                                title="Descargar Maestro Detallado"
                                                                className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors disabled:opacity-50"
                                                            >
                                                                {exportingId === company.id ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                                                            </button>
                                                            <button
                                                                onClick={() => handleSelectCompany(company.id)}
                                                                disabled={loadingDetail}
                                                                className="ml-1 text-brand-600 hover:text-brand-800 text-xs font-medium hover:underline disabled:opacity-50"
                                                            >
                                                                Ver detalle
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginación */}
                        {totalPages > 1 && (
                            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-xs text-slate-500">
                                    {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredData.length)} de {filteredData.length}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                                        className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                                        <ChevronsLeft size={16} />
                                    </button>
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                        className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                                        <ChevronLeftIcon size={16} />
                                    </button>
                                    <span className="px-3 py-1 text-sm">{currentPage} / {totalPages}</span>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                        className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                                        <ChevronRight size={16} />
                                    </button>
                                    <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                                        className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                                        <ChevronsRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <NewCompanyModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleCreate}
                industries={industries}
                holdings={holdings}
                techDocs={techDocs}
                companyDocs={companyDocs}
                serviceProviders={serviceProviders}
            />
        </div>
    );
};