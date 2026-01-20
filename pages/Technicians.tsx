// Rodrigo Osorio v0.11 - Optimización de búsqueda con debouncing para escalabilidad
import React, { useEffect, useState, memo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Filter, Plus, ChevronRight, ChevronLeft, Upload, Calendar, Download, Building, Briefcase, Trash2, Folder, X, UserPlus, Link as LinkIcon, AlertCircle, CheckSquare, Square, Loader2, Building2 } from 'lucide-react';
import {
    getTechnicians, getTechniciansLight, getTechnicianById, getCompanies, getBranches, getTechTypes,
    addTechnician, linkCompanyToTechnician, unlinkCompanyFromTechnician, getDocumentTypes, getAreas, updateCredential,
    getServiceProviders, getTechnicianServiceProviders, linkTechnicianToServiceProvider, unlinkTechnicianFromServiceProvider,
    updateTechnician, recalculateAndSaveTechnicianStatus, getActiveAbsences, getTechnicianAvailability,
    certifyCredentialInPortal, logDownloadAudit
} from '../services/dataService';
import { uploadTechnicianDocument, viewDocument, downloadTechnicianZip, extractPathFromUrl } from '../services/storageService';
import { formatDateForDB, formatDateForDisplay, isValidDateFormat, validateDateRange, formatTimestampToLocal } from '../services/dateUtils';
import { Technician, ComplianceStatus, Credential, Company, Branch, TechnicianType, WorkArea, DocumentType, ServiceProvider } from '../types';
import { StatusBadge, ScoreBadge } from '../components/shared/StatusBadge';
import { FileUpload } from '../components/shared/FileUpload';
import { DateInput } from '../components/shared/DateInput';
import { Pagination } from '../components/shared/Pagination';
import { usePagination } from '../hooks/usePagination';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../context/AuthContext';
import { Skeleton } from '../components/shared/Skeleton';
import { Lock, Thermometer, Plane, Activity } from 'lucide-react';
import { BulkTechnicianUploadModal } from '../components/BulkTechnicianUploadModal';
import { TechnicianAbsenceModal } from '../components/TechnicianAbsenceModal';

// --- SUB-COMPONENT: DETAIL VIEW ---
// Memoizar el componente de detalle para evitar re-renders innecesarios
const TechnicianDetail = memo(({ techId, onBack }: { techId: string, onBack: () => void }) => {
    const { canEdit, hasPermission } = useAuth();
    const [tech, setTech] = useState<Technician | undefined>(undefined);
    const [allCompanies, setAllCompanies] = useState<Company[]>([]);
    const [showCompanyModal, setShowCompanyModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [areas, setAreas] = useState<WorkArea[]>([]);
    const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [techTypes, setTechTypes] = useState<TechnicianType[]>([]);

    // EPS (Empresas Prestadoras de Servicio)
    const [techServiceProviders, setTechServiceProviders] = useState<ServiceProvider[]>([]);
    const [allServiceProviders, setAllServiceProviders] = useState<ServiceProvider[]>([]);
    const [showEPSModal, setShowEPSModal] = useState(false);
    const [epsLoading, setEpsLoading] = useState(false);

    // Credential Update State
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

    const { user } = useAuth(); // Para obtener el ID del usuario certificador

    // Rodrigo Osorio v0.11 - Optimizado: cargar solo datos esenciales inicialmente
    const loadData = async () => {
        const t = await getTechnicianById(techId);
        // Rodrigo Osorio v0.8 - Recalcular score al cargar para aplicar nueva lógica (VALID + EXPIRING_SOON)
        if (t) {
            await recalculateAndSaveTechnicianStatus(t);
            // Recargar técnico para obtener el score actualizado
            const updatedTech = await getTechnicianById(techId);
            setTech(updatedTech ? { ...updatedTech } : undefined);

            // Cargar disponibilidad (Rodrigo Osorio v0.15)
            const avail = await getTechnicianAvailability(techId);
            setAvailability(avail);
        } else {
            setTech(undefined);
        }

        // Cargar solo datos esenciales en paralelo
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

        // Cargar branches y types solo cuando sea necesario (para el modal de edición)
        // Se cargarán on-demand cuando se abra el modal
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
        Array.from(incomingCompanies).forEach(async (id) => {
            if (!currentCompanies.has(id)) await linkCompanyToTechnician(tech.id, id as string);
        });
        Array.from(currentCompanies).forEach(async (id) => {
            if (!incomingCompanies.has(id)) await unlinkCompanyFromTechnician(tech.id, id as string);
        });

        const currentEPSIds = techServiceProviders.map(sp => sp.id);
        const incomingEPSId = serviceProviderIds?.[0]; // Solo permitimos una EPS

        if (incomingEPSId && !currentEPSIds.includes(incomingEPSId)) {
            await linkTechnicianToServiceProvider(tech.id, incomingEPSId as string);
        } else if (!incomingEPSId && currentEPSIds.length > 0) {
            // Desvincular todas si no hay ninguna seleccionada
            for (const id of currentEPSIds) {
                await unlinkTechnicianFromServiceProvider(tech.id, id);
            }
        }

        await loadData();
        setShowEditModal(false);
    };

    // Rodrigo Osorio v0.11 - Cargar branches y types on-demand cuando se abre el modal
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
        loadData(); // Reload to see new missing docs
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

        // Validar fecha de emisión
        if (!issueDate || !isValidDateFormat(issueDate)) {
            setUploadError('Ingresa una fecha de emisión válida (dd-mm-aaaa)');
            return;
        }

        // Validar fecha de vencimiento
        if (!expiryDate || !isValidDateFormat(expiryDate)) {
            setUploadError('Ingresa una fecha de vencimiento válida (dd-mm-aaaa)');
            return;
        }

        // Validar que emisión <= vencimiento
        if (!validateDateRange(issueDate, expiryDate)) {
            setUploadError('La fecha de emisión debe ser anterior o igual a la de vencimiento');
            return;
        }

        setUploading(true);
        setUploadError(null);

        try {
            let fileUrl: string | undefined;

            // Subir archivo si se selecciono uno
            if (selectedFile) {
                // Pasar el URL del archivo antiguo para que se elimine automaticamente
                const result = await uploadTechnicianDocument(
                    tech.id,
                    updatingCred.documentTypeName,
                    selectedFile,
                    updatingCred.fileUrl // Eliminar archivo antiguo si existe
                );

                if (!result.success) {
                    setUploadError(result.error || 'Error al subir el archivo');
                    setUploading(false);
                    return;
                }
                fileUrl = result.url;
            }

            // Convertir fechas de dd-mm-aaaa a yyyy-mm-dd antes de enviar a BD
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
            // Rodrigo Osorio v0.17 - Usar viewDocument que maneja la desencriptación client-side
            const result = await viewDocument(
                'technician',
                filePath,
                cred.documentTypeName,
                'application/pdf' // Mime type por defecto, el servicio intentará detectarlo
            );

            if (result.success) {
                // Rodrigo Osorio v0.17 - Registrar auditoría
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

    // Rodrigo Osorio v0.5 - Descargar todos los documentos del técnico como ZIP
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
                // Rodrigo Osorio v0.17 - Registrar auditoría
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

        // Fecha de emisión: usar fecha actual como sugerencia para la renovación
        const today = new Date();
        const todayDB = today.toISOString().split('T')[0];
        setIssueDate(formatDateForDisplay(todayDB));

        // Convertir fecha de vencimiento de BD (yyyy-mm-dd) a formato dd-mm-aaaa
        if (cred.expiryDate) {
            // Sugerir un año después de la fecha actual para la renovación
            const nextYear = new Date();
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            const nextYearDB = nextYear.toISOString().split('T')[0];
            setExpiryDate(formatDateForDisplay(nextYearDB));
        } else {
            // Fecha por defecto: un año desde hoy
            const nextYear = new Date();
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            const defaultDateDB = nextYear.toISOString().split('T')[0];
            setExpiryDate(formatDateForDisplay(defaultDateDB));
        }
    }

    // Rodrigo Osorio v0.16 - Manejador para certificar en portal externo
    const handleCertifyPortal = async (credId: string) => {
        if (!user) return;
        setCertifyingId(credId);
        try {
            const result = await certifyCredentialInPortal(credId, user.id);
            if (result.success) {
                await loadData(); // Recargar para ver el cambio
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

    // Validacion de fechas en tiempo real - Rodrigo Osorio v0.12
    const dateRangeError = (issueDate && expiryDate && isValidDateFormat(issueDate) && isValidDateFormat(expiryDate) && !validateDateRange(issueDate, expiryDate))
        ? 'La fecha de vencimiento debe ser posterior a la emisión'
        : undefined;

    return (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <button onClick={onBack} className="text-slate-500 hover:text-slate-900 flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-all mb-6">
                <ChevronLeft size={14} strokeWidth={3} /> Volver a lista
            </button>

            {/* Header Profile - UX Mejorado v0.16 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Alert Banner for Non-Compliant */}
                {tech.overallStatus !== ComplianceStatus.VALID && (
                    <div className={`px-6 py-3 flex items-center gap-3 ${tech.overallStatus === ComplianceStatus.EXPIRED ? 'bg-red-500 text-white' :
                        tech.overallStatus === ComplianceStatus.EXPIRING_SOON ? 'bg-amber-500 text-white' :
                            'bg-slate-500 text-white'
                        }`}>
                        <AlertCircle size={20} />
                        <span className="font-bold">
                            {tech.overallStatus === ComplianceStatus.EXPIRED ? '⚠️ DOCUMENTOS VENCIDOS - Requiere acción inmediata' :
                                tech.overallStatus === ComplianceStatus.EXPIRING_SOON ? '⏰ Documentos por vencer próximamente' :
                                    '📋 Documentos pendientes por subir'}
                        </span>
                    </div>
                )}

                <div className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                    <div className="flex items-center gap-4">
                        <img
                            src={tech.avatarUrl}
                            alt={tech.name}
                            className="w-20 h-20 rounded-full object-cover border-4 border-slate-50"
                            loading="lazy"
                            decoding="async"
                        />
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">{tech.name}</h2>
                            <p className="text-slate-500">{tech.role} &bull; {tech.rut}</p>
                            <div className="mt-3 flex items-center gap-3">
                                <StatusBadge status={tech.overallStatus} />
                                {tech.isBlocked && (
                                    <div className="blocked-tech-indicator" title="Técnico Bloqueado">
                                        <Lock size={12} fill="currentColor" />
                                        <span className="text-[10px] font-black uppercase ml-1">Bloqueado</span>
                                    </div>
                                )}
                                <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg uppercase tracking-wider">
                                    <Building size={12} /> {tech.branch}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 items-center">
                        {canEdit && (
                            <button
                                onClick={handleOpenEditModal}
                                className="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                            >
                                Editar
                            </button>
                        )}
                        {tech.credentials.filter(c => c.fileUrl).length > 0 && (
                            <button
                                onClick={handleDownloadAllCredentials}
                                disabled={downloadingZip}
                                className="text-sm px-4 py-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {downloadingZip ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Generando...
                                    </>
                                ) : (
                                    <>
                                        <Folder size={16} />
                                        Descargar Carpeta
                                    </>
                                )}
                            </button>
                        )}
                        {/* Compliance Score with Progress Bar */}
                        <div className="text-center px-4 py-2 bg-slate-50 rounded-lg border border-slate-100 min-w-[120px]">
                            <span className={`block text-2xl font-bold ${tech.complianceScore === 100 ? 'text-green-600' : tech.complianceScore < 50 ? 'text-red-600' : 'text-yellow-600'}`}>
                                {tech.complianceScore}%
                            </span>
                            <div className="w-full h-2 bg-slate-200 rounded-full mt-1 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${tech.complianceScore === 100 ? 'bg-green-500' :
                                        tech.complianceScore < 50 ? 'bg-red-500' : 'bg-yellow-500'
                                        }`}
                                    style={{ width: `${tech.complianceScore}%` }}
                                />
                            </div>
                            <span className="text-xs text-slate-500 uppercase tracking-wide">Cumplimiento</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Companies & Info */}
                <div className="space-y-6">
                    {/* Empresas Prestadoras de Servicio */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <Building2 size={18} className="text-purple-600" /> Empresas Prestadoras
                            </h3>
                            {canEdit && (
                                <button onClick={() => setShowEPSModal(true)} className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded font-medium hover:bg-purple-100 transition-colors">
                                    + Vincular
                                </button>
                            )}
                        </div>

                        {techServiceProviders.length === 0 ? (
                            <div className="text-center py-4 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
                                <AlertCircle size={18} className="mx-auto mb-1 text-amber-500" />
                                Sin empresa prestadora asignada
                                <p className="text-xs mt-1">Debe estar vinculado a al menos una EPS</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {techServiceProviders.map(sp => (
                                    <div key={sp.id} className="flex justify-between items-center p-3 bg-purple-50/50 rounded-lg border border-purple-100">
                                        <div>
                                            <div className="font-semibold text-sm text-slate-800">{sp.name}</div>
                                            {sp.industry && <div className="text-xs text-slate-500">{sp.industry}</div>}
                                        </div>
                                        {canEdit && (
                                            <button
                                                onClick={async () => {
                                                    setEpsLoading(true);
                                                    await unlinkTechnicianFromServiceProvider(techId, sp.id);
                                                    const updated = await getTechnicianServiceProviders(techId);
                                                    setTechServiceProviders(updated);
                                                    setEpsLoading(false);
                                                }}
                                                disabled={epsLoading}
                                                className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Associated Companies Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <Briefcase size={18} className="text-brand-600" /> Empresas Cliente
                            </h3>
                            {canEdit && (
                                <button onClick={() => setShowCompanyModal(true)} className="text-xs bg-brand-50 text-brand-700 px-2 py-1 rounded font-medium hover:bg-brand-100 transition-colors">
                                    + Asignar
                                </button>
                            )}
                        </div>

                        {associatedCompanies.length === 0 ? (
                            <div className="text-center py-4 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
                                Sin empresas cliente asignadas
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {associatedCompanies.map(comp => {
                                    // Rodrigo Osorio v0.8 - Calcular cumplimiento específico para cada empresa
                                    const reqDocs = comp.requiredDocTypes || [];
                                    const requiredCredentials = tech.credentials.filter(c => reqDocs.includes(c.documentTypeId));
                                    const validOrExpiring = requiredCredentials.filter(c =>
                                        c.status === ComplianceStatus.VALID || c.status === ComplianceStatus.EXPIRING_SOON
                                    ).length;
                                    const companyScore = reqDocs.length > 0
                                        ? Math.round((validOrExpiring / reqDocs.length) * 100)
                                        : 100;

                                    return (
                                        <div key={comp.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-semibold text-sm text-slate-800">{comp.name}</div>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${companyScore === 100 ? 'bg-green-100 text-green-700' :
                                                        companyScore >= 67 ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-red-100 text-red-700'
                                                        }`}>
                                                        {companyScore}%
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500">{comp.industry}</div>
                                            </div>
                                            {canEdit && (
                                                <button onClick={() => handleUnlinkCompany(comp.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Disponibilidad (v0.15 - Rodrigo Osorio) */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <Calendar size={18} className="text-orange-600" /> Disponibilidad
                            </h3>
                            <button
                                onClick={() => setIsAbsenceModalOpen(true)}
                                className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded font-medium hover:bg-orange-100 transition-colors flex items-center gap-1"
                            >
                                <Plus size={12} /> Gestionar
                            </button>
                        </div>

                        <div className={`p-4 rounded-xl flex items-center gap-4 transition-all ${availability.status === 'AVAILABLE' ? 'bg-emerald-50 border border-emerald-100' : 'bg-orange-50 border border-orange-100'}`}>
                            <div className={`p-2.5 rounded-xl ${availability.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                                {availability.status === 'AVAILABLE' ? <CheckSquare size={20} /> :
                                    availability.status === 'VACATION' ? <Plane size={20} /> : <Thermometer size={20} />}
                            </div>
                            <div>
                                <div className={`font-bold text-sm ${availability.status === 'AVAILABLE' ? 'text-emerald-800' : 'text-orange-800'}`}>
                                    {availability.status === 'AVAILABLE' ? 'Disponible / Activo' :
                                        availability.status === 'VACATION' ? 'En Vacaciones' :
                                            availability.status === 'MEDICAL_LEAVE' ? 'Licencia Médica' : 'No Disp.'}
                                </div>
                                {availability.status !== 'AVAILABLE' && availability.absence ? (
                                    <div className="text-[10px] text-orange-600 font-bold uppercase tracking-tight">
                                        Hasta el {formatDateForDisplay(availability.absence.endDate)}
                                    </div>
                                ) : (
                                    <div className="text-[10px] text-emerald-600 font-medium">Operacionalmente habilitado</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Basic Info Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                        <h3 className="font-bold text-slate-900 mb-4">Información de Contacto</h3>
                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="block text-slate-400 text-xs">Email</span>
                                <a href={`mailto:${tech.email}`} className="text-brand-600 hover:underline">{tech.email}</a>
                            </div>
                            <div>
                                <span className="block text-slate-400 text-xs">Teléfono</span>
                                <span className="text-slate-700">{tech.phone || 'No registrado'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Documents */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                                <Folder size={20} className="text-brand-600" /> Documentos y Credenciales
                            </h3>
                            <div className="flex gap-2">
                                {/* Rodrigo Osorio v0.5 - Botón para descargar todos los documentos */}
                                {tech.credentials.filter(c => c.fileUrl).length > 0 && (
                                    <button
                                        onClick={handleDownloadAllCredentials}
                                        disabled={downloadingZip}
                                        className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {downloadingZip ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                Generando ZIP...
                                            </>
                                        ) : (
                                            <>
                                                <Download size={16} />
                                                Descargar Todas ({tech.credentials.filter(c => c.fileUrl).length})
                                            </>
                                        )}
                                    </button>
                                )}
                                {canEdit && (
                                    <button className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700">
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
                                    <p className="text-xs mt-1">Asigna empresas para generar requerimientos automáticos.</p>
                                </div>
                            ) : (() => {
                                // Sort credentials by priority: EXPIRED/PENDING first, then EXPIRING_SOON, then VALID
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

                                const urgentCreds = sortedCredentials.filter(c =>
                                    c.status === ComplianceStatus.EXPIRED ||
                                    c.status === ComplianceStatus.PENDING ||
                                    c.status === ComplianceStatus.MISSING
                                );
                                const warningCreds = sortedCredentials.filter(c => c.status === ComplianceStatus.EXPIRING_SOON);
                                const validCreds = sortedCredentials.filter(c => c.status === ComplianceStatus.VALID);

                                const renderCredential = (cred: Credential) => {
                                    const requiredBy = associatedCompanies.filter(c => c.requiredDocTypes.includes(cred.documentTypeId));
                                    const isPendingOrMissing = cred.status === ComplianceStatus.MISSING || cred.status === ComplianceStatus.PENDING;
                                    const isExpired = cred.status === ComplianceStatus.EXPIRED;

                                    return (
                                        <div key={cred.id} className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors border-b border-slate-100 last:border-0 ${isExpired ? 'bg-red-50/50' : isPendingOrMissing ? 'bg-amber-50/50' : 'hover:bg-slate-50'
                                            }`}>
                                            <div className="flex items-start gap-4">
                                                <div
                                                    title={
                                                        isExpired ? "Documento Vencido: Requiere actualización inmediata" :
                                                            isPendingOrMissing ? "Documento Pendiente: El archivo aún no ha sido cargado" :
                                                                cred.status === ComplianceStatus.VALID
                                                                    ? (cred.portalCertifiedAt
                                                                        ? "Al día: Documento válido y certificado en el portal externo"
                                                                        : "Pendiente de Portal: El archivo está subido pero aún no ha sido certificado en el portal externo")
                                                                    : "Estado del documento"
                                                    }
                                                    className={`p-3 rounded-lg mt-1 cursor-help transition-all shadow-sm ${cred.status === ComplianceStatus.VALID
                                                        ? (cred.portalCertifiedAt ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600') :
                                                        cred.status === ComplianceStatus.EXPIRED ? 'bg-red-100 text-red-600' :
                                                            isPendingOrMissing ? 'bg-amber-100 text-amber-600' :
                                                                'bg-yellow-100 text-yellow-600'
                                                        }`}>
                                                    <Calendar size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold text-slate-900 truncate">{cred.documentTypeName}</h4>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100 whitespace-nowrap">
                                                            Área: {getAreaNameForDoc(cred.documentTypeId)}
                                                        </span>
                                                        <span className="text-sm text-slate-500">
                                                            {isPendingOrMissing ? 'Documento Requerido' : `Vence: ${formatDateForDisplay(cred.expiryDate || '')}`}
                                                        </span>
                                                    </div>

                                                    {/* Portal Certification Status */}
                                                    {cred.portalCertifiedAt && (
                                                        <div className="mt-2 flex items-center gap-2 text-[11px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100 w-fit">
                                                            <CheckSquare size={12} className="shrink-0" />
                                                            <span>
                                                                Portal: Certificado {cred.portalCertifiedByName ? `por ${cred.portalCertifiedByName}` : ''} el {formatTimestampToLocal(cred.portalCertifiedAt)}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {requiredBy.length > 0 && (
                                                        <div className="flex gap-1 mt-2 flex-wrap">
                                                            <span className="text-xs text-slate-500 font-medium mr-1 py-0.5 whitespace-nowrap">Requerido por:</span>
                                                            {requiredBy.map(c => (
                                                                <span key={c.id} className="text-[10px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded border border-brand-100 font-bold whitespace-nowrap">
                                                                    {c.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 self-end sm:self-center">
                                                <StatusBadge status={cred.status} />
                                                {!isPendingOrMissing && cred.fileUrl && (
                                                    <div className="flex items-center gap-2">
                                                        {/* Certificar portal button */}
                                                        {canEdit && !cred.portalCertifiedAt && (
                                                            <button
                                                                onClick={() => handleCertifyPortal(cred.id)}
                                                                disabled={certifyingId === cred.id}
                                                                className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-md text-xs font-bold hover:bg-indigo-100 transition-all border border-indigo-200 shadow-sm disabled:opacity-50"
                                                                title="Certificar que se cargó en el portal externo"
                                                            >
                                                                {certifyingId === cred.id ? (
                                                                    <Loader2 size={14} className="animate-spin" />
                                                                ) : (
                                                                    <Upload size={14} />
                                                                )}
                                                                Certificar Portal
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDownloadCredential(cred);
                                                            }}
                                                            disabled={downloadingId === cred.id}
                                                            className="p-2 text-slate-400 hover:text-brand-600 transition-colors disabled:opacity-50"
                                                            title="Ver documento (desencriptado)"
                                                        >
                                                            {downloadingId === cred.id ? (
                                                                <Loader2 size={18} className="animate-spin" />
                                                            ) : (
                                                                <Download size={18} />
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                                {canEdit && (
                                                    <button
                                                        onClick={() => openUpdateModal(cred)}
                                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${isPendingOrMissing || isExpired
                                                            ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm'
                                                            : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                                                            }`}>
                                                        {isPendingOrMissing ? 'Subir Ahora' : isExpired ? 'Renovar Urgente' : 'Renovar'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                };

                                return (
                                    <>
                                        {/* Urgent Section */}
                                        {urgentCreds.length > 0 && (
                                            <div>
                                                <div className="px-5 py-3 bg-red-100 border-b border-red-200 flex items-center gap-2">
                                                    <AlertCircle size={16} className="text-red-600" />
                                                    <span className="text-sm font-bold text-red-800">REQUIEREN ACCIÓN ({urgentCreds.length})</span>
                                                </div>
                                                {urgentCreds.map(renderCredential)}
                                            </div>
                                        )}

                                        {/* Warning Section */}
                                        {warningCreds.length > 0 && (
                                            <div>
                                                <div className="px-5 py-3 bg-amber-100 border-b border-amber-200 flex items-center gap-2">
                                                    <AlertCircle size={16} className="text-amber-600" />
                                                    <span className="text-sm font-bold text-amber-800">POR VENCER PRONTO ({warningCreds.length})</span>
                                                </div>
                                                {warningCreds.map(renderCredential)}
                                            </div>
                                        )}

                                        {/* Valid Section */}
                                        {validCreds.length > 0 && (
                                            <div>
                                                <div className="px-5 py-3 bg-green-50 border-b border-green-100 flex items-center gap-2">
                                                    <CheckSquare size={16} className="text-green-600" />
                                                    <span className="text-sm font-bold text-green-800">AL DÍA ({validCreds.length})</span>
                                                </div>
                                                {validCreds.map(renderCredential)}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </div>

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
                                    !techServiceProviders.some(tsp => tsp.id === sp.id)
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
                                            await linkTechnicianToServiceProvider(techId, sp.id);
                                            const updated = await getTechnicianServiceProviders(techId);
                                            setTechServiceProviders(updated);
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

            {/* Modal for Assigning Company */}
            {showCompanyModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-900">Asignar Empresa Cliente</h3>
                            <button onClick={() => setShowCompanyModal(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <div className="p-2 max-h-[300px] overflow-y-auto">
                            {availableCompanies.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-sm">Todas las empresas disponibles ya están asignadas.</div>
                            ) : (
                                availableCompanies.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => handleLinkCompany(c.id)}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between group"
                                    >
                                        <div>
                                            <div className="font-medium text-slate-800">{c.name}</div>
                                            <div className="text-xs text-slate-500">{c.industry}</div>
                                        </div>
                                        <Plus size={18} className="text-slate-300 group-hover:text-brand-600" />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for Uploading/Renewing Credential */}
            {updatingCred && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-brand-50">
                            <h3 className="font-bold text-slate-900">
                                {updatingCred.status === ComplianceStatus.MISSING || updatingCred.status === ComplianceStatus.PENDING ? 'Subir Credencial' : 'Renovar Credencial'}
                            </h3>
                            <button onClick={() => setUpdatingCred(null)} disabled={uploading}>
                                <X size={20} className="text-slate-400 hover:text-slate-600" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateCredential} className="p-6 space-y-4">
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
                                <span className="text-xs font-bold text-slate-500 block">Documento</span>
                                <div className="text-slate-900 font-medium">{updatingCred.documentTypeName}</div>
                            </div>

                            <DateInput
                                label="Nueva Fecha de Emisión"
                                value={issueDate}
                                onChange={setIssueDate}
                                required
                                disabled={uploading}
                            />

                            <DateInput
                                label="Nueva Fecha de Vencimiento"
                                value={expiryDate}
                                onChange={setExpiryDate}
                                required
                                disabled={uploading}
                                error={dateRangeError}
                            />

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Archivo del Documento</label>
                                <FileUpload
                                    onFileSelect={setSelectedFile}
                                    selectedFile={selectedFile}
                                    disabled={uploading}
                                />
                            </div>

                            {uploadError && (
                                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                                    <AlertCircle size={18} />
                                    {uploadError}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setUpdatingCred(null)}
                                    className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded-lg"
                                    disabled={uploading}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 flex items-center gap-2 disabled:opacity-50"
                                    disabled={uploading || !!dateRangeError}
                                >
                                    {uploading && <Loader2 size={16} className="animate-spin" />}
                                    {uploading ? 'Subiendo...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Edit Technician */}
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

        </div>
    );
});

// --- MODAL: NEW TECHNICIAN ---
// Memoizar el modal para evitar re-renders cuando no está abierto
const NewTechnicianModal = memo(({ isOpen, onClose, onSave, branches, types, companies, serviceProviders, editingTech, initialEPSIds }: any) => {
    const [formData, setFormData] = useState({
        name: '', rut: '', email: '', phone: '', branch: '', technicianTypeId: ''
    });
    const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
    const [selectedEPSIds, setSelectedEPSIds] = useState<Set<string>>(new Set());
    const [companySearch, setCompanySearch] = useState('');
    const isEdit = Boolean(editingTech);

    // Rodrigo Osorio v0.11 - Debounce para búsqueda de empresas en modal
    const debouncedCompanySearch = useDebounce(companySearch, 300);

    React.useEffect(() => {
        if (isOpen && editingTech) {
            setFormData({
                name: editingTech.name || '',
                rut: editingTech.rut || '',
                email: editingTech.email || '',
                phone: editingTech.phone || '',
                branch: editingTech.branchId || '', // Usar branchId para el select
                technicianTypeId: editingTech.technicianTypeId || ''
            });
            setSelectedCompanyIds(new Set(editingTech.companyIds || []));
            setSelectedEPSIds(new Set(initialEPSIds || []));
        } else if (isOpen && !editingTech) {
            setFormData({ name: '', rut: '', email: '', phone: '', branch: '', technicianTypeId: '' });
            setSelectedCompanyIds(new Set());
            setSelectedEPSIds(new Set());
            setCompanySearch('');
        }
    }, [isOpen, editingTech, initialEPSIds]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validar que tenga exactamente una EPS (REGLA 1:1)
        if (selectedEPSIds.size === 0) {
            alert('Debe seleccionar una Empresa Prestadora de Servicio (EPS)');
            return;
        }

        const dataToSave = {
            ...formData,
            companyIds: Array.from(selectedCompanyIds),
            serviceProviderIds: Array.from(selectedEPSIds).slice(0, 1), // Enforzar 1:1
            id: editingTech?.id
        };

        onSave(dataToSave);
        // Reset local state
        setSelectedCompanyIds(new Set());
        setSelectedEPSIds(new Set());
        setCompanySearch('');
    };

    const toggleCompany = (id: string) => {
        const next = new Set(selectedCompanyIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedCompanyIds(next);
    };

    const toggleEPS = (id: string) => {
        const next = new Set(selectedEPSIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedEPSIds(next);
    };


    // Filter companies: Search matches name + Type != HOLDING
    const filteredCompanies = companies.filter((c: Company) =>
        c.type !== 'HOLDING' &&
        c.name.toLowerCase().includes(debouncedCompanySearch.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-brand-50 shrink-0">
                    <h3 className="font-bold text-brand-900 text-lg flex items-center gap-2">
                        <UserPlus size={20} /> {isEdit ? 'Editar Técnico' : 'Nuevo Técnico'}
                    </h3>
                    <button onClick={onClose}><X size={20} className="text-brand-700 hover:text-brand-900" /></button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* Column 1: Personal Info */}
                        <div className="space-y-4">
                            <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Información Personal</h4>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo *</label>
                                <input required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Juan Pérez" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">RUT *</label>
                                <input required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={formData.rut} onChange={e => setFormData({ ...formData, rut: e.target.value })} placeholder="12.345.678-9" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input type="email" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="juan@email.com" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                                <input type="tel" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+56 9..." />
                            </div>
                        </div>

                        {/* Column 2: Internal Org + EPS */}
                        <div className="space-y-4">
                            <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Clasificación Organizacional</h4>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Sucursal *</label>
                                <select required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={formData.branch} onChange={e => setFormData({ ...formData, branch: e.target.value })}>
                                    <option value="">Seleccionar...</option>
                                    {branches.map((b: Branch) => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Técnico *</label>
                                <select required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={formData.technicianTypeId} onChange={e => setFormData({ ...formData, technicianTypeId: e.target.value })}>
                                    <option value="">Seleccionar...</option>
                                    {types.map((t: TechnicianType) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>

                            {/* EPS Selection */}
                            <div className="mt-4 pt-4 border-t border-slate-200">
                                <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                                    <Building2 size={16} className="text-purple-600" />
                                    Empresa Prestadora *
                                    <span className="text-xs font-normal bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full ml-auto">{selectedEPSIds.size} seleccionadas</span>
                                </h4>

                                {(!serviceProviders || serviceProviders.length === 0) ? (
                                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-700">
                                        <AlertCircle size={14} className="inline mr-1" />
                                        No hay EPS registradas. Créalas en Configuración.
                                    </div>
                                ) : (
                                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 max-h-[150px] overflow-y-auto">
                                        {serviceProviders.map((sp: ServiceProvider) => {
                                            const isSelected = selectedEPSIds.has(sp.id);
                                            return (
                                                <div
                                                    key={sp.id}
                                                    onClick={() => toggleEPS(sp.id)}
                                                    className={`flex items-center p-2.5 cursor-pointer transition-all border-b border-slate-100 last:border-0 ${isSelected
                                                        ? 'bg-purple-50'
                                                        : 'bg-white hover:bg-slate-50'
                                                        }`}
                                                >
                                                    <div className={`mr-2 ${isSelected ? 'text-purple-600' : 'text-slate-300'}`}>
                                                        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                                    </div>
                                                    <div>
                                                        <div className={`text-sm font-medium ${isSelected ? 'text-purple-900' : 'text-slate-700'}`}>
                                                            {sp.name}
                                                        </div>
                                                        {sp.industry && <div className="text-xs text-slate-500">{sp.industry}</div>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Column 3: Associated Companies */}
                        <div className="space-y-4 flex flex-col h-full">
                            <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4 flex items-center justify-between">
                                <span>Empresas Asociadas</span>
                                <span className="text-xs font-normal bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">{selectedCompanyIds.size} seleccionadas</span>
                            </h4>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar empresa..."
                                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    value={companySearch}
                                    onChange={(e) => setCompanySearch(e.target.value)}
                                />
                            </div>

                            <div className="flex-1 border border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex flex-col min-h-[250px] max-h-[350px]">
                                <div className="overflow-y-auto p-2 space-y-1 flex-1">
                                    {filteredCompanies.length === 0 ? (
                                        <div className="text-center text-slate-400 py-8 text-sm">
                                            No se encontraron empresas
                                        </div>
                                    ) : (
                                        filteredCompanies.map((comp: Company) => {
                                            const isSelected = selectedCompanyIds.has(comp.id);
                                            return (
                                                <div
                                                    key={comp.id}
                                                    onClick={() => toggleCompany(comp.id)}
                                                    className={`flex items-center p-3 rounded-lg cursor-pointer transition-all border ${isSelected
                                                        ? 'bg-brand-50 border-brand-200'
                                                        : 'bg-white border-transparent hover:border-slate-200'
                                                        }`}
                                                >
                                                    <div className={`mr-3 ${isSelected ? 'text-brand-600' : 'text-slate-300'}`}>
                                                        {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                                    </div>
                                                    <div>
                                                        <div className={`text-sm font-medium ${isSelected ? 'text-brand-900' : 'text-slate-700'}`}>
                                                            {comp.name}
                                                        </div>
                                                        <div className="text-xs text-slate-500">{comp.industry}</div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </form>

                <div className="flex justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50 shrink-0">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
                    <button onClick={handleSubmit} className="bg-brand-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brand-700 text-sm shadow-sm">
                        Crear Técnico
                    </button>
                </div>
            </div>

            {/* Modal de Ausencias */}
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


// --- MAIN COMPONENT: LIST VIEW ---

export const Technicians = () => {
    const { user, canEdit, isBranchManager, hasPermission } = useAuth();
    const [originalTechnicians, setOriginalTechnicians] = useState<Technician[]>([]);
    const [technicians, setTechnicians] = useState<Technician[]>([]);
    const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortField, setSortField] = useState<'name' | 'branch' | 'role' | 'complianceScore'>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [statusFilter, setStatusFilter] = useState<'all' | ComplianceStatus>('all');
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
    const [selectedTechForAbsence, setSelectedTechForAbsence] = useState<Technician | null>(null);
    const [activeAbsences, setActiveAbsences] = useState<any[]>([]);
    const [exportingReport, setExportingReport] = useState(false);
    // currentPage and itemsPerPage are handled by usePagination

    // Create Modal State
    const [branches, setBranches] = useState<Branch[]>([]);
    const [techTypes, setTechTypes] = useState<TechnicianType[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);

    // Export compliance report to CSV
    const handleExportReport = useCallback(async () => {
        setExportingReport(true);
        try {
            // Get full technician data for export
            const fullTechs = await getTechnicians();

            // Build CSV content
            const headers = ['Nombre', 'RUT', 'Sucursal', 'Estado', 'Cumplimiento %', 'Documentos Vencidos', 'Documentos Pendientes', 'Documentos OK', 'Detalle Faltantes'];

            const rows = fullTechs.map(tech => {
                const vencidos = tech.credentials.filter(c => c.status === ComplianceStatus.EXPIRED);
                const pendientes = tech.credentials.filter(c => c.status === ComplianceStatus.PENDING || c.status === ComplianceStatus.MISSING);
                const ok = tech.credentials.filter(c => c.status === ComplianceStatus.VALID);

                // Include status for each missing document
                const missingDetails = [...vencidos, ...pendientes].map(c => {
                    const name = c.documentTypeName || `Documento ${c.documentTypeId}`;
                    const statusText = c.status === ComplianceStatus.EXPIRED ? 'VENCIDO' : 'PENDIENTE';
                    return `${name} (${statusText})`;
                });

                const faltantes = missingDetails.length > 0 ? missingDetails.join(' | ') : 'Ninguno';

                const statusLabel = tech.overallStatus === ComplianceStatus.VALID ? 'HABILITADO' :
                    tech.overallStatus === ComplianceStatus.EXPIRED ? 'VENCIDO' :
                        tech.overallStatus === ComplianceStatus.EXPIRING_SOON ? 'POR VENCER' : 'PENDIENTE';

                return [
                    tech.name,
                    tech.rut,
                    tech.branch || '-',
                    statusLabel,
                    tech.complianceScore,
                    vencidos.length,
                    pendientes.length,
                    ok.length,
                    faltantes
                ];
            });

            // Create CSV
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            // Download
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

    useEffect(() => {
        const loadDocs = async () => {
            setLoading(true);
            try {
                // Rodrigo Osorio v0.16 - Solo cargar versión ligera inicialmente
                const data = await getTechniciansLight(isBranchManager ? user?.assignedBranchIds : undefined);
                setTechnicians(data as Technician[]);

                // Si hay un ID en la URL, seleccionarlo automáticamente
                const params = new URLSearchParams(window.location.hash.split('?')[1]);
                const techId = params.get('id');
                if (techId) {
                    setSelectedTechId(techId);
                }

                // Rodrigo Osorio v0.12 - Filtrar por estado si está presente en la URL
                const statusParam = params.get('status');
                if (statusParam && Object.values(ComplianceStatus).includes(statusParam as ComplianceStatus)) {
                    setStatusFilter(statusParam as ComplianceStatus);
                }

            } catch (error) {
                console.error("Error loading technicians:", error);
            } finally {
                setLoading(false);
            }
        };
        loadDocs();
    }, [isBranchManager, user?.assignedBranchIds]);

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


    // Rodrigo Osorio v0.11 - Cargar datos en paralelo para mejor performance
    useEffect(() => {
        const loadAllData = async () => {
            await Promise.all([
                refreshList(),
                getBranches().then(setBranches),
                getTechTypes().then(setTechTypes),
                getCompanies().then(setCompanies),
                getServiceProviders().then(setServiceProviders)
            ]);
        };
        loadAllData();
    }, [refreshList]);

    const handleCreate = useCallback(async (formData: any) => {
        const { serviceProviderIds, ...techData } = formData;
        const result = await addTechnician(techData);

        // Vincular EPS al técnico recién creado
        if (result && serviceProviderIds && serviceProviderIds.length > 0) {
            for (const spId of serviceProviderIds) {
                await linkTechnicianToServiceProvider(result.id, spId);
            }
        }

        refreshList();
        setIsModalOpen(false);
    }, [refreshList]);

    // Rodrigo Osorio v0.11 - Debounce para búsqueda en lista de técnicos
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    // Rodrigo Osorio v0.11 - Memoizar filtrado para evitar recálculos en cada render
    const filtered = React.useMemo(() => {
        let result = technicians;

        // Filtrado por estado (v0.12)
        if (statusFilter !== 'all') {
            result = result.filter(t => t.overallStatus === statusFilter);
        }

        if (!debouncedSearchTerm) return result;

        const searchLower = debouncedSearchTerm.toLowerCase();
        return result.filter(t =>
            t.name.toLowerCase().includes(searchLower) ||
            t.rut.includes(debouncedSearchTerm) ||
            t.email?.toLowerCase().includes(searchLower)
        );
    }, [technicians, debouncedSearchTerm, statusFilter]);

    // Paginación
    const {
        paginatedData,
        currentPage,
        totalPages,
        totalItems,
        itemsPerPage,
        setPage,
        setItemsPerPage
    } = usePagination<Technician>(filtered, { initialItemsPerPage: 10 });

    if (selectedTechId) {
        return <TechnicianDetail techId={selectedTechId} onBack={() => {
            window.history.pushState({}, '', window.location.hash.split('?')[0]);
            setSelectedTechId(null);
        }} />;
    }

    if (loading && technicians.length === 0) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-end">
                    <div className="space-y-2">
                        <Skeleton width={200} height={32} />
                        <Skeleton width={300} height={16} />
                    </div>
                </div>
                <Skeleton height={80} className="rounded-xl" />
                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                    <div className="p-6 space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="flex gap-4 items-center">
                                <Skeleton variant="circular" width={40} height={40} />
                                <div className="space-y-2 flex-1">
                                    <Skeleton width="40%" height={16} />
                                    <Skeleton width="20%" height={12} />
                                </div>
                                <Skeleton width={60} height={24} />
                                <Skeleton width={100} height={24} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Gestión de Técnicos</h1>
                    <p className="text-slate-500">Administra el personal, sus sucursales y documentos</p>
                </div>
                <div className="flex gap-2">
                    {/* Export Report Button */}
                    <button
                        onClick={handleExportReport}
                        disabled={exportingReport}
                        className="bg-slate-100 text-slate-700 px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-slate-200 border border-slate-200 transition-all disabled:opacity-50"
                    >
                        {exportingReport ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Generando...
                            </>
                        ) : (
                            <>
                                <Download size={18} />
                                Descargar Reporte
                            </>
                        )}
                    </button>
                    {hasPermission('create_technicians') && (
                        <>
                            <button
                                onClick={() => setIsBulkModalOpen(true)}
                                className="bg-slate-100 text-slate-700 px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-slate-200 border border-slate-200 transition-all"
                            >
                                <Upload size={18} />
                                Carga Masiva
                            </button>
                            <button onClick={() => setIsModalOpen(true)} className="bg-brand-600 text-white px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-brand-700 shadow-sm transition-all">
                                <Plus size={18} />
                                Nuevo Técnico
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, RUT o email..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-50 flex items-center gap-2">
                        <Filter size={18} /> Filtros
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <tr>
                            <th className="px-6 py-4 font-medium">Nombre / RUT</th>
                            <th className="px-6 py-4 font-medium hidden md:table-cell">Rol</th>
                            <th className="px-6 py-4 font-medium hidden sm:table-cell">Sucursal</th>
                            <th className="px-6 py-4 font-medium text-center">Score</th>
                            <th className="px-6 py-4 font-medium">Estado</th>
                            <th className="px-6 py-4 font-medium text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {paginatedData.map((tech) => (
                            <tr
                                key={tech.id}
                                className="hover:bg-slate-50 cursor-pointer transition-colors"
                                onClick={() => setSelectedTechId(tech.id)}
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <div className="w-10 h-10 rounded-2xl bg-slate-200 overflow-hidden shrink-0">
                                                {tech.avatarUrl && (
                                                    <img
                                                        src={tech.avatarUrl}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                        loading="lazy"
                                                    />
                                                )}
                                            </div>
                                            {tech.isBlocked && (
                                                <div className="absolute -top-1 -right-1 bg-red-500 text-white p-0.5 rounded-full border-2 border-white shadow-sm">
                                                    <Lock size={8} fill="currentColor" />
                                                </div>
                                            )}
                                            {activeAbsences.find(a => a.technicianId === tech.id) && (
                                                <div className="absolute -bottom-1 -right-1 bg-orange-500 text-white p-0.5 rounded-full border-2 border-white shadow-sm ring-2 ring-orange-500/20">
                                                    {activeAbsences.find(a => a.technicianId === tech.id)?.type === 'VACATION' ? <Plane size={8} /> :
                                                        activeAbsences.find(a => a.technicianId === tech.id)?.type === 'MEDICAL_LEAVE' ? <Thermometer size={8} /> : <Activity size={8} />}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                                {tech.name}
                                                {tech.isBlocked && <span className="text-[8px] bg-red-50 text-red-600 px-1 py-0.5 rounded font-black uppercase tracking-tighter">Blocking</span>}
                                                {activeAbsences.find(a => a.technicianId === tech.id) && (
                                                    <span className="bg-orange-100 text-orange-600 text-[8px] px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-0.5">
                                                        <Calendar size={8} /> {activeAbsences.find(a => a.technicianId === tech.id)?.type === 'VACATION' ? 'VACACIONES' : 'LICENCIA'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{tech.rut}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-600 hidden md:table-cell">{tech.role}</td>
                                <td className="px-6 py-4 text-slate-600 hidden sm:table-cell">{tech.branch}</td>
                                <td className="px-6 py-4 text-center">
                                    <ScoreBadge score={tech.complianceScore} />
                                </td>
                                <td className="px-6 py-4">
                                    <StatusBadge status={tech.overallStatus} />
                                </td>
                                <td className="px-6 py-4 text-right text-slate-400">
                                    <div className="flex justify-end gap-2 items-center">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedTechForAbsence(tech as Technician);
                                                setIsAbsenceModalOpen(true);
                                            }}
                                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-orange-500 transition-all group/abs"
                                            title="Gestionar Ausencias"
                                        >
                                            <Calendar size={16} className="group-hover/abs:scale-110 transition-transform" />
                                        </button>
                                        <ChevronRight size={18} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                        No se encontraron técnicos
                    </div>
                )}

                {/* Paginación */}
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setPage}
                    onItemsPerPageChange={setItemsPerPage}
                    className="border-t border-slate-100"
                />
            </div>

            <NewTechnicianModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleCreate}
                branches={branches}
                types={techTypes}
                companies={companies}
                serviceProviders={serviceProviders}
            />

            <BulkTechnicianUploadModal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
                onSuccess={() => {
                    setIsBulkModalOpen(false);
                    refreshList();
                }}
                branches={branches}
                serviceProviders={serviceProviders}
                technicianTypes={techTypes}
            />

            {
                selectedTechForAbsence && (
                    <TechnicianAbsenceModal
                        isOpen={isAbsenceModalOpen}
                        onClose={() => {
                            setIsAbsenceModalOpen(false);
                            setSelectedTechForAbsence(null);
                        }}
                        technician={selectedTechForAbsence}
                        onUpdate={refreshList}
                    />
                )
            }
        </div >
    );
};