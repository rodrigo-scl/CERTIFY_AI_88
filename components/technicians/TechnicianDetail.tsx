import React, { useState, useEffect, memo } from 'react';
import {
    ChevronLeft,
    Folder,
    Download,
    Plus,
    Loader2,
    AlertCircle,
    Calendar,
    CheckSquare,
    Square,
    Upload,
    Building,
    Building2,
    Activity,
    Thermometer,
    Plane,
    Lock,
    X
} from 'lucide-react';
import {
    getTechnicianById,
    getCompanies,
    getAreas,
    getDocumentTypes,
    getServiceProviders,
    getTechnicianServiceProviders,
    updateTechnician,
    linkCompanyToTechnician,
    unlinkCompanyFromTechnician,
    updateCredential,
    linkTechnicianToServiceProvider,
    unlinkTechnicianFromServiceProvider,
    getBranches,
    getTechTypes,
    recalculateAndSaveTechnicianStatus,
    getTechnicianAvailability,
    certifyCredentialInPortal,
    logDownloadAudit
} from '../../services/dataService';
import {
    uploadTechnicianDocument,
    viewDocument,
    downloadTechnicianZip,
    extractPathFromUrl
} from '../../services/storageService';
import {
    formatDateForDB,
    formatDateForDisplay,
    isValidDateFormat,
    validateDateRange,
    formatTimestampToLocal
} from '../../services/dateUtils';
import {
    Technician,
    ComplianceStatus,
    Credential,
    Company,
    Branch,
    TechnicianType,
    WorkArea,
    DocumentType,
    ServiceProvider
} from '../../types';
import { StatusBadge, ScoreBadge } from '../shared/StatusBadge';
import { FileUpload } from '../shared/FileUpload';
import { DateInput } from '../shared/DateInput';
import { useAuth } from '../../context/AuthContext';
import { NewTechnicianModal } from './NewTechnicianModal';
import { TechnicianAbsenceModal } from '../TechnicianAbsenceModal';

interface TechnicianDetailProps {
    techId: string;
    onBack: () => void;
}

export const TechnicianDetail = memo(({ techId, onBack }: TechnicianDetailProps) => {
    const { canEdit, hasPermission, user } = useAuth();
    const [tech, setTech] = useState<Technician | undefined>(undefined);
    const [allCompanies, setAllCompanies] = useState<Company[]>([]);
    const [showCompanyModal, setShowCompanyModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [areas, setAreas] = useState<WorkArea[]>([]);
    const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [techTypes, setTechTypes] = useState<TechnicianType[]>([]);

    const [techServiceProviders, setTechServiceProviders] = useState<ServiceProvider[]>([]);
    const [allServiceProviders, setAllServiceProviders] = useState<ServiceProvider[]>([]);
    const [showEPSModal, setShowEPSModal] = useState(false);
    const [epsLoading, setEpsLoading] = useState(false);

    const [updatingCred, setUpdatingCred] = useState<Credential | null>(null);
    const [issueDate, setIssueDate] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [downloadingZip, setDownloadingZip] = useState(false);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
    const [availability, setAvailability] = useState<{ status: string, absence?: any }>({ status: 'AVAILABLE' });
    const [certifyingId, setCertifyingId] = useState<string | null>(null);
    const [showAddCredModal, setShowAddCredModal] = useState(false);

    const loadData = async () => {
        const t = await getTechnicianById(techId);
        if (t) {
            await recalculateAndSaveTechnicianStatus(t);
            const updatedTech = await getTechnicianById(techId);
            setTech(updatedTech ? { ...updatedTech } : undefined);
            const avail = await getTechnicianAvailability(techId);
            setAvailability(avail);
        } else {
            setTech(undefined);
        }

        const [c, a, d, techEPS, allEPS] = await Promise.all([
            getCompanies(),
            getAreas(),
            getDocumentTypes(),
            getTechnicianServiceProviders(techId),
            getServiceProviders()
        ]);

        setAllCompanies(c);
        setAreas(a);
        setDocTypes(d);
        setTechServiceProviders(techEPS);
        setAllServiceProviders(allEPS);
    };

    const handleUpdateTech = async (formData: any) => {
        if (!tech) return;
        const { serviceProviderIds, companyIds, ...data } = formData;
        const result = await updateTechnician(tech.id, data);
        if (!result.success) {
            alert(result.error || 'No se pudo actualizar el técnico');
            return;
        }

        const currentCompanies = new Set(tech.companyIds || []);
        const incomingCompanies = new Set(companyIds || []);
        for (const id of Array.from(incomingCompanies)) {
            if (!currentCompanies.has(id)) await linkCompanyToTechnician(tech.id, id as string);
        }
        for (const id of Array.from(currentCompanies)) {
            if (!incomingCompanies.has(id)) await unlinkCompanyFromTechnician(tech.id, id as string);
        }

        const currentEPSIds = techServiceProviders.map(sp => sp.id);
        const incomingEPSId = serviceProviderIds?.[0];

        if (incomingEPSId && !currentEPSIds.includes(incomingEPSId)) {
            await linkTechnicianToServiceProvider(tech.id, incomingEPSId as string);
        } else if (!incomingEPSId && currentEPSIds.length > 0) {
            for (const id of currentEPSIds) {
                await unlinkTechnicianFromServiceProvider(tech.id, id);
            }
        }

        await loadData();
        setShowEditModal(false);
    };

    const handleOpenEditModal = async () => {
        if (branches.length === 0) {
            const b = await getBranches();
            setBranches(b);
        }
        if (techTypes.length === 0) {
            const tt = await getTechTypes();
            setTechTypes(tt);
        }
        setShowEditModal(true);
    };

    useEffect(() => {
        loadData();
    }, [techId]);

    const handleLinkCompany = async (companyId: string) => {
        if (!canEdit) return;
        await linkCompanyToTechnician(techId, companyId);
        loadData();
        setShowCompanyModal(false);
    };

    const handleUnlinkCompany = async (companyId: string) => {
        if (!canEdit) return;
        if (window.confirm("¿Estás seguro? Desvincular la empresa no elimina los documentos históricos.")) {
            await unlinkCompanyFromTechnician(techId, companyId);
            loadData();
        }
    };

    const handleUpdateCredential = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit || !tech || !updatingCred) return;

        if (!issueDate || !isValidDateFormat(issueDate)) {
            setUploadError('Ingresa una fecha de emisión válida (dd-mm-aaaa)');
            return;
        }

        if (!expiryDate || !isValidDateFormat(expiryDate)) {
            setUploadError('Ingresa una fecha de vencimiento válida (dd-mm-aaaa)');
            return;
        }

        if (!validateDateRange(issueDate, expiryDate)) {
            setUploadError('La fecha de emisión debe ser anterior o igual a la de vencimiento');
            return;
        }

        setUploading(true);
        setUploadError(null);

        try {
            let fileUrl: string | undefined;

            if (selectedFile) {
                const result = await uploadTechnicianDocument(
                    tech.id,
                    updatingCred.documentTypeName,
                    selectedFile,
                    updatingCred.fileUrl
                );

                if (!result.success) {
                    setUploadError(result.error || 'Error al subir el archivo');
                    setUploading(false);
                    return;
                }
                fileUrl = result.url;
            }

            const issueDateDB = formatDateForDB(issueDate);
            const expiryDateDB = formatDateForDB(expiryDate);

            await updateCredential(tech.id, updatingCred.id, expiryDateDB, fileUrl, issueDateDB);
            setUpdatingCred(null);
            setIssueDate('');
            setExpiryDate('');
            setSelectedFile(null);
            loadData();
        } catch (err: any) {
            setUploadError(err.message || 'Error al actualizar credencial');
        } finally {
            setUploading(false);
        }
    };

    const handleDownloadCredential = async (cred: Credential) => {
        if (!cred.fileUrl || downloadingId) return;

        const filePath = extractPathFromUrl(cred.fileUrl, 'technician');
        if (!filePath) {
            alert('Error: No se pudo determinar la ruta del archivo');
            return;
        }

        setDownloadingId(cred.id);
        try {
            const result = await viewDocument(
                'technician',
                filePath,
                cred.documentTypeName,
                'application/pdf'
            );

            if (result.success) {
                if (user) {
                    await logDownloadAudit({
                        userId: user.id,
                        email: user.email,
                        actionType: 'DOWNLOAD_SINGLE',
                        resourceName: cred.documentTypeName,
                        resourcePath: filePath
                    });
                }
            } else {
                alert('No se pudo abrir el documento: ' + result.error);
            }
        } catch (err) {
            console.error('Error al descargar credencial:', err);
            alert('Error al procesar el archivo');
        } finally {
            setDownloadingId(null);
        }
    };

    const handleDownloadAllCredentials = async () => {
        if (!tech) return;

        setDownloadingZip(true);
        try {
            const result = await downloadTechnicianZip({
                technician: {
                    id: tech.id,
                    name: tech.name,
                    rut: tech.rut
                },
                credentials: tech.credentials,
                documentTypes: docTypes
            });

            if (result.success) {
                if (user) {
                    await logDownloadAudit({
                        userId: user.id,
                        email: user.email,
                        actionType: 'DOWNLOAD_ZIP',
                        resourceName: `Carpeta_${tech.name}_${tech.rut}`,
                        resourcePath: `tech/${tech.id}`
                    });
                }
            } else {
                alert(result.error || 'Error al generar el archivo ZIP');
            }
        } catch (err) {
            alert('Error al generar el archivo ZIP');
        } finally {
            setDownloadingZip(false);
        }
    };

    const openUpdateModal = (cred: Credential) => {
        if (!canEdit) return;
        setUpdatingCred(cred);
        setSelectedFile(null);
        setUploadError(null);

        const today = new Date();
        const todayDB = today.toISOString().split('T')[0];
        setIssueDate(formatDateForDisplay(todayDB));

        if (cred.expiryDate) {
            const nextYear = new Date();
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            const nextYearDB = nextYear.toISOString().split('T')[0];
            setExpiryDate(formatDateForDisplay(nextYearDB));
        } else {
            const nextYear = new Date();
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            const defaultDateDB = nextYear.toISOString().split('T')[0];
            setExpiryDate(formatDateForDisplay(defaultDateDB));
        }
    }

    const handleCertifyPortal = async (credId: string, companyId?: string) => {
        if (!user) return;

        const loadId = companyId ? `${credId}-${companyId}` : credId;
        setCertifyingId(loadId);

        try {
            const result = await certifyCredentialInPortal(credId, user.id, companyId);
            if (result.success) {
                await loadData();
            } else {
                alert("Error al certificar: " + result.error);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setCertifyingId(null);
        }
    };

    const getAreaNameForDoc = (docTypeId: string) => {
        const docType = docTypes.find(d => d.id === docTypeId);
        if (!docType || !docType.areaId) return 'General';
        const area = areas.find(a => a.id === docType.areaId);
        return area ? area.name : 'General';
    };

    if (!tech) return <div>Loading...</div>;

    const associatedCompanies = allCompanies.filter(c => tech.companyIds.includes(c.id));
    const availableCompanies = allCompanies.filter(c => !tech.companyIds.includes(c.id));

    const dateRangeError = (issueDate && expiryDate && isValidDateFormat(issueDate) && isValidDateFormat(expiryDate) && !validateDateRange(issueDate, expiryDate))
        ? 'La fecha de vencimiento debe ser posterior a la emisión'
        : undefined;

    return (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <button onClick={onBack} className="text-slate-500 hover:text-slate-900 flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-all mb-6">
                <ChevronLeft size={14} strokeWidth={3} /> Volver a lista
            </button>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {(() => {
                    const hasExpired = tech.credentials.some(c => c.status === ComplianceStatus.EXPIRED);
                    const hasExpiringSoon = tech.credentials.some(c => c.status === ComplianceStatus.EXPIRING_SOON);
                    const hasPending = tech.credentials.some(c => c.status === ComplianceStatus.MISSING || c.status === ComplianceStatus.PENDING);
                    const isOnVacation = availability.status === 'VACATION';
                    const isOnMedicalLeave = availability.status === 'MEDICAL_LEAVE';
                    const isFullyCompliant = tech.complianceScore === 100;

                    const fullyCompliantClients = associatedCompanies.filter(comp => {
                        const reqDocs = comp.requiredDocTypes || [];
                        if (reqDocs.length === 0) return true;
                        const requiredCredentials = tech.credentials.filter(c => reqDocs.includes(c.documentTypeId));
                        const validOrExpiring = requiredCredentials.filter(c =>
                            c.status === ComplianceStatus.VALID || c.status === ComplianceStatus.EXPIRING_SOON
                        ).length;
                        return validOrExpiring === reqDocs.length;
                    });

                    let bannerConfig: { icon: React.ReactNode; text: string; subtext?: string; bgClass: string };

                    if (isOnVacation) {
                        bannerConfig = {
                            icon: <Plane size={18} />,
                            text: '🏖️ EN VACACIONES',
                            subtext: availability.absence ? `Hasta el ${formatDateForDisplay(availability.absence.endDate)}` : undefined,
                            bgClass: 'bg-orange-500 text-white'
                        };
                    } else if (isOnMedicalLeave) {
                        bannerConfig = {
                            icon: <Thermometer size={18} />,
                            text: '🏥 LICENCIA MÉDICA',
                            subtext: availability.absence ? `Hasta el ${formatDateForDisplay(availability.absence.endDate)}` : undefined,
                            bgClass: 'bg-orange-500 text-white'
                        };
                    } else if (hasExpired) {
                        bannerConfig = {
                            icon: <AlertCircle size={18} />,
                            text: '❌ NO HABILITADO',
                            subtext: 'Documentos vencidos',
                            bgClass: 'bg-red-600 text-white'
                        };
                    } else if (isFullyCompliant && hasExpiringSoon) {
                        bannerConfig = {
                            icon: <CheckSquare size={18} />,
                            text: '✅ HABILITADO 100%',
                            subtext: 'Documentos por vencer próximamente',
                            bgClass: 'bg-yellow-500 text-white'
                        };
                    } else if (isFullyCompliant) {
                        bannerConfig = {
                            icon: <CheckSquare size={18} />,
                            text: '✅ HABILITADO 100%',
                            subtext: 'Todos los documentos al día',
                            bgClass: 'bg-emerald-600 text-white'
                        };
                    } else if (fullyCompliantClients.length > 0 && fullyCompliantClients.length < associatedCompanies.length) {
                        const clientNames = fullyCompliantClients.length === 1
                            ? fullyCompliantClients[0].name
                            : `${fullyCompliantClients.length} clientes`;
                        bannerConfig = {
                            icon: <Activity size={18} />,
                            text: `⚠️ HABILITADO SOLO PARA ${clientNames.toUpperCase()}`,
                            subtext: fullyCompliantClients.length > 1 ? fullyCompliantClients.map(c => c.name).join(', ') : undefined,
                            bgClass: 'bg-yellow-500 text-white'
                        };
                    } else if (hasPending) {
                        bannerConfig = {
                            icon: <AlertCircle size={18} />,
                            text: '📋 NO HABILITADO',
                            subtext: 'Documentos pendientes por subir',
                            bgClass: 'bg-red-600 text-white'
                        };
                    } else {
                        bannerConfig = {
                            icon: <CheckSquare size={18} />,
                            text: '✅ HABILITADO 100%',
                            bgClass: 'bg-emerald-600 text-white'
                        };
                    }

                    return (
                        <div className={`px-6 py-2 flex items-center gap-3 ${bannerConfig.bgClass}`}>
                            {bannerConfig.icon}
                            <span className="font-bold text-sm">{bannerConfig.text}</span>
                            {bannerConfig.subtext && (
                                <span className="text-xs opacity-90">- {bannerConfig.subtext}</span>
                            )}
                            <button
                                onClick={() => setIsAbsenceModalOpen(true)}
                                className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors"
                            >
                                Gestionar Ausencias
                            </button>
                            <div className="ml-auto flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1">
                                <div className="w-16 h-1.5 bg-white/30 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${tech.complianceScore === 100 && !hasExpiringSoon ? 'bg-emerald-400' :
                                            tech.complianceScore === 100 && hasExpiringSoon ? 'bg-amber-400' :
                                                'bg-red-400'
                                            }`}
                                        style={{ width: `${tech.complianceScore}%` }}
                                    />
                                </div>
                                <span className={`text-lg font-bold ${tech.complianceScore === 100 && !hasExpiringSoon ? 'text-emerald-100' :
                                    tech.complianceScore === 100 && hasExpiringSoon ? 'text-amber-100' :
                                        'text-white'
                                    }`}>{tech.complianceScore}%</span>
                            </div>
                        </div>
                    );
                })()}

                <div className="p-6 flex flex-col md:flex-row gap-6 items-start justify-between">
                    <div className="flex items-center gap-4">
                        <img
                            src={tech.avatarUrl}
                            alt={tech.name}
                            className="w-20 h-20 rounded-full object-cover border-4 border-slate-50"
                        />
                        <div className="relative">
                            {canEdit && (
                                <button
                                    onClick={handleOpenEditModal}
                                    className="absolute -top-6 left-0 text-[10px] px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 bg-white shadow-sm transition-all"
                                >
                                    Editar
                                </button>
                            )}
                            <h2 className="text-2xl font-bold text-slate-900">{tech.name}</h2>
                            <p className="text-slate-500">{tech.technicianTypeName || tech.role} &bull; {tech.rut}</p>
                            <div className="mt-2 flex items-center gap-3 flex-wrap">
                                <StatusBadge status={tech.overallStatus} />
                                {tech.isBlocked && (
                                    <div className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                                        <Lock size={12} fill="currentColor" />
                                        <span>Bloqueado</span>
                                    </div>
                                )}
                                <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg uppercase tracking-wider">
                                    <Building size={12} /> {tech.branch}
                                </span>
                                {techServiceProviders.length > 0 && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase ml-2">EPS:</span>
                                        {techServiceProviders.map(sp => (
                                            <span key={sp.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                                                {sp.name}
                                            </span>
                                        ))}
                                        {canEdit && (
                                            <button onClick={() => setShowEPSModal(true)} className="text-[10px] text-purple-600 hover:text-purple-800 font-bold bg-purple-50 w-5 h-5 flex items-center justify-center rounded-full border border-purple-200">+</button>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="mt-2 flex items-center gap-4 text-xs">
                                <a href={`mailto:${tech.email}`} className="flex items-center gap-1 text-brand-600 hover:underline">
                                    <span className="text-slate-400">📧</span> {tech.email}
                                </a>
                                {tech.phone && (
                                    <span className="flex items-center gap-1 text-slate-600">
                                        <span className="text-slate-400">📱</span> {tech.phone}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end pt-2">
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Acreditado para:</span>
                            {associatedCompanies.length === 0 ? (
                                <span className="text-xs text-slate-400 italic">Sin asignar</span>
                            ) : (
                                associatedCompanies.map(comp => {
                                    const reqDocs = comp.requiredDocTypes || [];
                                    const requiredCredentials = tech.credentials.filter(c => reqDocs.includes(c.documentTypeId));
                                    const validOrExpiring = requiredCredentials.filter(c =>
                                        c.status === ComplianceStatus.VALID || c.status === ComplianceStatus.EXPIRING_SOON
                                    ).length;
                                    const companyScore = reqDocs.length > 0 ? Math.round((validOrExpiring / reqDocs.length) * 100) : 100;
                                    return (
                                        <span key={comp.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${companyScore === 100 ? 'bg-green-50 text-green-700 border-green-200' : companyScore >= 67 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                            {comp.name} <span className="font-bold">{companyScore}%</span>
                                        </span>
                                    );
                                })
                            )}
                            {canEdit && (
                                <button onClick={() => setShowCompanyModal(true)} className="text-[10px] text-brand-600 hover:text-brand-800 font-medium">+</button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                            <Folder size={20} className="text-brand-600" /> Documentos y Credenciales
                        </h3>
                        <div className="flex gap-2">
                            {tech.credentials.filter(c => c.fileUrl).length > 0 && (
                                <button
                                    onClick={handleDownloadAllCredentials}
                                    disabled={downloadingZip}
                                    className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 border border-blue-200 disabled:opacity-50"
                                >
                                    {downloadingZip ? (
                                        <><Loader2 size={16} className="animate-spin" /> Generando ZIP...</>
                                    ) : (
                                        <><Download size={16} /> Descargar Todas ({tech.credentials.filter(c => c.fileUrl).length})</>
                                    )}
                                </button>
                            )}
                            {canEdit && (
                                <button onClick={() => setShowAddCredModal(true)} className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700">
                                    <Plus size={16} /> Agregar Credencial
                                </button>
                            )}
                        </div>
                    </div>

                    <div>
                        {tech.credentials.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <AlertCircle size={48} className="mx-auto mb-3 opacity-20" />
                                <p>No hay credenciales cargadas.</p>
                            </div>
                        ) : (() => {
                            const isFullyCertified = (cred: Credential) => {
                                if (cred.status !== ComplianceStatus.VALID && cred.status !== ComplianceStatus.EXPIRING_SOON) return false;
                                const requiredBy = associatedCompanies.filter(comp => comp.requiredDocTypes.includes(cred.documentTypeId));
                                if (requiredBy.length > 0) {
                                    const certifications = cred.portalCertifications || [];
                                    const certifiedCompanyIds = new Set(certifications.map(pc => pc.companyId));
                                    return requiredBy.every(comp => certifiedCompanyIds.has(comp.id));
                                }
                                return !!cred.portalCertifiedAt;
                            };

                            const sortedCredentials = [...tech.credentials].sort((a, b) => {
                                const priority: Record<string, number> = {
                                    [ComplianceStatus.EXPIRED]: 0,
                                    [ComplianceStatus.PENDING]: 1,
                                    [ComplianceStatus.MISSING]: 2,
                                    [ComplianceStatus.EXPIRING_SOON]: 3,
                                    [ComplianceStatus.VALID]: 4
                                };
                                return (priority[a.status] || 5) - (priority[b.status] || 5);
                            });

                            const segmentValid = sortedCredentials.filter(c => isFullyCertified(c));
                            const segmentUrgent = sortedCredentials.filter(c => !isFullyCertified(c));

                            const renderCredential = (cred: Credential) => {
                                const requiredBy = associatedCompanies.filter(c => c.requiredDocTypes.includes(cred.documentTypeId));
                                const isPendingOrMissing = cred.status === ComplianceStatus.MISSING || cred.status === ComplianceStatus.PENDING;
                                const isExpired = cred.status === ComplianceStatus.EXPIRED;
                                const hasNoFile = !cred.fileUrl;
                                const hasManualCert = cred.portalCertifiedAt;
                                const isCertifyingManual = certifyingId === `${cred.id}-manual`;
                                const isManualDisabled = hasManualCert || isCertifyingManual || !canEdit || isExpired || hasNoFile;

                                return (
                                    <div key={cred.id} className={`p-4 transition-colors border-b border-slate-100 last:border-0 ${isExpired ? 'bg-red-50/50' : isPendingOrMissing ? 'bg-amber-50/50' : 'hover:bg-slate-50'}`}>
                                        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_auto] gap-4 items-center">
                                            <div className="flex items-start gap-4">
                                                <div className={`p-2.5 rounded-lg cursor-help transition-all shadow-sm shrink-0 ${isExpired ? 'bg-red-100 text-red-600' :
                                                    isPendingOrMissing ? 'bg-amber-100 text-amber-600' :
                                                        isFullyCertified(cred) ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                                                    }`}>
                                                    <Calendar size={18} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-semibold text-slate-900 truncate text-sm">{cred.documentTypeName}</h4>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">
                                                            Área: {getAreaNameForDoc(cred.documentTypeId)}
                                                        </span>
                                                        <span className="text-xs text-slate-500">
                                                            {isPendingOrMissing ? 'Documento Requerido' : `Vence: ${formatDateForDisplay(cred.expiryDate || '')}`}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-center flex-wrap gap-1.5 min-h-[40px] px-4">
                                                {requiredBy.length > 0 ? (
                                                    requiredBy.map(c => {
                                                        const certInfo = cred.portalCertifications?.find(pc => pc.companyId === c.id);
                                                        const isCertified = !!certInfo;
                                                        const isCertifyingThis = certifyingId === `${cred.id}-${c.id}`;
                                                        const isDisabled = isCertified || isCertifyingThis || !canEdit || isExpired || hasNoFile;

                                                        return (
                                                            <button
                                                                key={c.id}
                                                                onClick={() => !isDisabled && handleCertifyPortal(cred.id, c.id)}
                                                                disabled={isDisabled}
                                                                className={`text-[10px] px-3 py-1 rounded-full border font-bold flex items-center gap-1 transition-all ${isCertified ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                                    (hasNoFile || isExpired) ? 'bg-red-50 text-red-600 border-red-200 opacity-70' :
                                                                        'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'
                                                                    }`}
                                                            >
                                                                {isCertifyingThis ? <Loader2 size={10} className="animate-spin" /> :
                                                                    isCertified ? <CheckSquare size={10} /> :
                                                                        (hasNoFile || isExpired) ? <AlertCircle size={10} /> : <Square size={10} />}
                                                                {c.name}
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <button
                                                        onClick={() => !isManualDisabled && handleCertifyPortal(cred.id)}
                                                        disabled={isManualDisabled}
                                                        className={`text-[10px] px-3 py-1 rounded-full border font-bold flex items-center gap-1 transition-all ${hasManualCert ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                            (hasNoFile || isExpired) ? 'bg-red-50 text-red-600 border-red-200 opacity-70' :
                                                                'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                                            }`}
                                                    >
                                                        {isCertifyingManual ? <Loader2 size={10} className="animate-spin" /> :
                                                            hasManualCert ? <CheckSquare size={10} /> :
                                                                (hasNoFile || isExpired) ? <AlertCircle size={10} /> : <Upload size={10} />}
                                                        Carga Manual
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-end gap-2 md:border-l md:border-slate-100 md:pl-4 min-w-[120px]">
                                                {!isPendingOrMissing && cred.fileUrl && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDownloadCredential(cred); }}
                                                        disabled={downloadingId === cred.id}
                                                        className="p-1.5 text-slate-400 hover:text-brand-600 transition-colors disabled:opacity-50 rounded hover:bg-slate-100"
                                                    >
                                                        {downloadingId === cred.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                                    </button>
                                                )}
                                                {canEdit && (
                                                    <button
                                                        onClick={() => openUpdateModal(cred)}
                                                        className={`min-w-[90px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap text-center ${isPendingOrMissing || isExpired ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                                                            }`}
                                                    >
                                                        {isPendingOrMissing ? 'Subir Ahora' : 'Renovar'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            };

                            return (
                                <>
                                    {segmentUrgent.length > 0 && (
                                        <div>
                                            <div className="px-5 py-3 bg-red-100 border-b border-red-200 flex items-center gap-2">
                                                <AlertCircle size={16} className="text-red-600" />
                                                <span className="text-sm font-bold text-red-800">REQUIEREN ACCIÓN ({segmentUrgent.length})</span>
                                            </div>
                                            {segmentUrgent.map(renderCredential)}
                                        </div>
                                    )}
                                    {segmentValid.length > 0 && (
                                        <div>
                                            <div className="px-5 py-3 bg-green-50 border-b border-green-100 flex items-center gap-2">
                                                <CheckSquare size={16} className="text-green-600" />
                                                <span className="text-sm font-bold text-green-800">AL DÍA ({segmentValid.length})</span>
                                            </div>
                                            {segmentValid.map(renderCredential)}
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {showEPSModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-purple-50">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <Building2 size={18} className="text-purple-600" /> Vincular EPS
                            </h3>
                            <button onClick={() => setShowEPSModal(false)}><X size={20} className="text-slate-400" /></button>
                        </div>
                        <div className="p-2 max-h-[300px] overflow-y-auto">
                            {allServiceProviders.filter(sp => !techServiceProviders.some(tsp => tsp.id === sp.id)).map(sp => (
                                <button
                                    key={sp.id}
                                    onClick={async () => {
                                        setEpsLoading(true);
                                        await linkTechnicianToServiceProvider(techId, sp.id);
                                        const updated = await getTechnicianServiceProviders(techId);
                                        setTechServiceProviders(updated);
                                        setEpsLoading(false);
                                        setShowEPSModal(false);
                                    }}
                                    disabled={epsLoading}
                                    className="w-full text-left px-4 py-3 hover:bg-purple-50 border-b border-slate-50 last:border-0 flex justify-between items-center group"
                                >
                                    <div>
                                        <div className="font-medium text-slate-800">{sp.name}</div>
                                        <div className="text-xs text-slate-500">{sp.industry}</div>
                                    </div>
                                    {epsLoading ? <Loader2 size={18} className="animate-spin text-purple-600" /> : <Plus size={18} className="text-slate-300 group-hover:text-purple-600" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showCompanyModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-900">Asignar Cliente</h3>
                            <button onClick={() => setShowCompanyModal(false)}><X size={20} className="text-slate-400" /></button>
                        </div>
                        <div className="p-2 max-h-[300px] overflow-y-auto">
                            {availableCompanies.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => handleLinkCompany(c.id)}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between items-center group"
                                >
                                    <div>
                                        <div className="font-medium text-slate-800">{c.name}</div>
                                        <div className="text-xs text-slate-500">{c.industry}</div>
                                    </div>
                                    <Plus size={18} className="text-slate-300 group-hover:text-brand-600" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {updatingCred && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-brand-50">
                            <h3 className="font-bold text-slate-900">{updatingCred.status === ComplianceStatus.MISSING ? 'Subir' : 'Renovar'} Credencial</h3>
                            <button onClick={() => setUpdatingCred(null)}><X size={20} className="text-slate-400" /></button>
                        </div>
                        <form onSubmit={handleUpdateCredential} className="p-6 space-y-4">
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <span className="text-xs font-bold text-slate-500">Documento</span>
                                <div className="text-slate-900 font-medium">{updatingCred.documentTypeName}</div>
                            </div>
                            <DateInput label="Emisión" value={issueDate} onChange={setIssueDate} required disabled={uploading} />
                            <DateInput label="Vencimiento" value={expiryDate} onChange={setExpiryDate} required disabled={uploading} error={dateRangeError} />
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Archivo</label>
                                <FileUpload onFileSelect={setSelectedFile} selectedFile={selectedFile} disabled={uploading} />
                            </div>
                            {uploadError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{uploadError}</div>}
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setUpdatingCred(null)} className="px-4 py-2 text-slate-600 text-sm font-medium" disabled={uploading}>Cancelar</button>
                                <button type="submit" className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2" disabled={uploading || !!dateRangeError}>
                                    {uploading && <Loader2 size={16} className="animate-spin" />}
                                    {uploading ? 'Subiendo...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <NewTechnicianModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                onSave={handleUpdateTech}
                branches={branches}
                types={techTypes}
                companies={allCompanies}
                serviceProviders={allServiceProviders}
                editingTech={tech}
                initialEPSIds={techServiceProviders.map(sp => sp.id)}
            />

            {showAddCredModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-bold text-slate-900">Agregar Credencial</h3>
                                <p className="text-xs text-slate-500 mt-1">Selecciona los documentos para el técnico</p>
                            </div>
                            <button onClick={() => setShowAddCredModal(false)}><X size={20} className="text-slate-400" /></button>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto p-4 space-y-2">
                            {docTypes.filter(dt => dt.category === 'TECH' && !tech.credentials.map(c => c.documentTypeId).includes(dt.id)).map(docType => (
                                <button
                                    key={docType.id}
                                    onClick={async () => {
                                        await updateCredential(tech.id, docType.id, { status: ComplianceStatus.PENDING });
                                        await loadData();
                                        setShowAddCredModal(false);
                                    }}
                                    className="w-full text-left p-4 border border-slate-200 rounded-lg hover:border-brand-300 hover:bg-brand-50/50 flex justify-between items-center group"
                                >
                                    <div>
                                        <h4 className="font-semibold text-slate-900 group-hover:text-brand-700">{docType.name}</h4>
                                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">Área: {areas.find(a => a.id === docType.areaId)?.name || 'Sin área'}</span>
                                    </div>
                                    <Plus size={20} className="text-slate-300 group-hover:text-brand-600" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {isAbsenceModalOpen && (
                <TechnicianAbsenceModal
                    isOpen={isAbsenceModalOpen}
                    onClose={() => setIsAbsenceModalOpen(false)}
                    technician={tech}
                    onUpdate={loadData}
                />
            )}
        </div>
    );
});
