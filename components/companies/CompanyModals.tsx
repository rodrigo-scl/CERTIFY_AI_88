import React, { useState, useEffect, memo, useCallback } from 'react';
import { X, Search, CheckSquare, Square, Upload, Loader2, AlertCircle } from 'lucide-react';
import { getTechnicians } from '../../services/dataService';
import { uploadCompanyDocument, uploadTechnicianDocument } from '../../services/storageService';
import { Technician, DocumentType, ComplianceStatus } from '../../types';
import { FileUpload } from '../shared/FileUpload';
import { DateInput } from '../shared/DateInput';
import { formatDateForDB, formatDateForDisplay, isValidDateFormat, validateDateRange } from '../../services/dateUtils';
import { usePagination } from '../../hooks/usePagination';
import { Pagination } from '../shared/Pagination';
import { useDebounce } from '../../hooks/useDebounce';

// --- AssignTechnicianModal ---
export const AssignTechnicianModal = memo(({ isOpen, onClose, companyId, currentTechIds, onAssign }: any) => {
    const [techs, setTechs] = useState<Technician[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 300);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            getTechnicians().then(data => {
                setTechs(data);
                setLoading(false);
            });
        }
    }, [isOpen]);

    const filtered = techs.filter(t =>
        !currentTechIds.includes(t.id) &&
        (t.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || t.rut.includes(debouncedSearch))
    );

    const { paginatedData, currentPage, totalPages, totalItems, itemsPerPage, setPage, setItemsPerPage } = usePagination(filtered, { initialItemsPerPage: 8 });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-brand-50">
                    <h3 className="font-bold text-slate-900">Vincular Técnico</h3>
                    <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
                </div>
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o RUT..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500">Cargando técnicos...</div>
                    ) : paginatedData.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">No se encontraron técnicos disponibles</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {paginatedData.map((t: Technician) => (
                                <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
                                            {t.avatarUrl && <img src={t.avatarUrl} alt="" className="w-full h-full object-cover" />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900">{t.name}</div>
                                            <div className="text-xs text-slate-400">{t.rut} &bull; {t.role}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onAssign(t.id)}
                                        className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-brand-700 transition-colors"
                                    >
                                        Asignar
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
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
        </div>
    );
});

// --- UploadDocModal ---
export const UploadDocModal = memo(({ isOpen, onClose, title, docTypes, onSave, entityId, entityType, preselectedDocTypeId }: any) => {
    const [docTypeId, setDocTypeId] = useState('');
    const [issueDate, setIssueDate] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setDocTypeId(preselectedDocTypeId || '');
            setIssueDate('');
            setExpiryDate('');
            setFile(null);
            setError(null);
        }
    }, [isOpen, preselectedDocTypeId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!docTypeId || !issueDate || !expiryDate || !file) {
            setError('Todos los campos son obligatorios');
            return;
        }

        if (!isValidDateFormat(issueDate) || !isValidDateFormat(expiryDate)) {
            setError('Formato de fecha inválido (dd-mm-aaaa)');
            return;
        }

        if (!validateDateRange(issueDate, expiryDate)) {
            setError('La fecha de emisión debe ser anterior a la de vencimiento');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            const docType = docTypes.find((d: any) => d.id === docTypeId);
            const res = entityType === 'COMPANY'
                ? await uploadCompanyDocument(entityId, docType?.name, file)
                : await uploadTechnicianDocument(entityId, docType?.name, file);

            if (res.success) {
                await onSave(docTypeId, formatDateForDB(expiryDate), res.url, formatDateForDB(issueDate));
                onClose();
            } else {
                setError(res.error || 'Error al subir archivo');
            }
        } catch (err: any) {
            setError(err.message || 'Error inesperado');
        } finally {
            setUploading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-brand-50">
                    <h3 className="font-bold text-slate-900">{title}</h3>
                    <button onClick={onClose} disabled={uploading}><X size={20} className="text-slate-400" /></button>
                </div>
                <form onSubmit={handleSave} className="p-6 space-y-4">
                    {!preselectedDocTypeId && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Documento</label>
                            <select
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                                value={docTypeId} onChange={e => setDocTypeId(e.target.value)} required
                            >
                                <option value="">Seleccionar...</option>
                                {docTypes.map((dt: any) => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                            </select>
                        </div>
                    )}
                    <DateInput label="Fecha de Emisión" value={issueDate} onChange={setIssueDate} required disabled={uploading} />
                    <DateInput label="Fecha de Vencimiento" value={expiryDate} onChange={setExpiryDate} required disabled={uploading} />
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Archivo (PDF)</label>
                        <FileUpload onFileSelect={setFile} selectedFile={file} disabled={uploading} />
                    </div>
                    {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2"><AlertCircle size={18} /> {error}</div>}
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 text-sm font-medium" disabled={uploading}>Cancelar</button>
                        <button type="submit" className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2" disabled={uploading}>
                            {uploading && <Loader2 size={16} className="animate-spin" />}
                            {uploading ? 'Subiendo...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
});

// --- ManageReqModal ---
export const ManageReqModal = memo(({ isOpen, onClose, allDocs, selectedIds, onSave }: any) => {
    const [ids, setIds] = useState<Set<string>>(new Set(selectedIds));

    useEffect(() => {
        setIds(new Set(selectedIds));
    }, [isOpen, selectedIds]);

    const toggle = (id: string) => {
        const next = new Set(ids);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setIds(next);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-brand-50">
                    <h3 className="font-bold text-slate-900">Gestionar Requisitos</h3>
                    <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {allDocs.map((dt: any) => (
                        <div
                            key={dt.id}
                            onClick={() => toggle(dt.id)}
                            className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${ids.has(dt.id) ? 'bg-brand-50 border-brand-200' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                        >
                            <div className={`mr-3 ${ids.has(dt.id) ? 'text-brand-600' : 'text-slate-300'}`}>
                                {ids.has(dt.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                            </div>
                            <div className="text-sm font-medium text-slate-700">{dt.name}</div>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium">Cancelar</button>
                    <button
                        onClick={() => onSave(Array.from(ids))}
                        className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-brand-700"
                    >
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
});
// --- EditCompanyModal ---
export const EditCompanyModal = memo(({ isOpen, onClose, company, onSave, industries, holdings, supplierPortals }: any) => {
    const [formData, setFormData] = useState<any>({ ...company });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData({ ...company });
        }
    }, [isOpen, company]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await onSave(formData);
        setSaving(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-brand-50">
                    <h3 className="font-bold text-slate-900">Editar Empresa: {company.name}</h3>
                    <button onClick={onClose} disabled={saving}><X size={20} className="text-slate-400" /></button>
                </div>
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Comercial</label>
                            <input required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                                value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">RUT</label>
                            <input required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                                value={formData.rut || ''} onChange={e => setFormData({ ...formData, rut: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Industria</label>
                            <select required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                                value={formData.industry || ''} onChange={e => setFormData({ ...formData, industry: e.target.value })}>
                                <option value="">Seleccionar...</option>
                                {industries.map((i: any) => <option key={i.id} value={i.name}>{i.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                                value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                <option value="HOLDING">HOLDING</option>
                                <option value="SUBSIDIARY">FILIAL</option>
                            </select>
                        </div>
                        {formData.type === 'SUBSIDIARY' && (
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Holding (Padre)</label>
                                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                                    value={formData.holdingId || ''} onChange={e => setFormData({ ...formData, holdingId: e.target.value })}>
                                    <option value="">Sin Padre</option>
                                    {holdings.filter((h: any) => h.id !== company.id).map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-brand-700 mb-4">Información de Contacto</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre</label>
                                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                                    value={formData.contactName || ''} onChange={e => setFormData({ ...formData, contactName: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                                <input type="email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                                    value={formData.contactEmail || ''} onChange={e => setFormData({ ...formData, contactEmail: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teléfono</label>
                                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                                    value={formData.contactPhone || ''} onChange={e => setFormData({ ...formData, contactPhone: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-brand-700 mb-4">Portal de Proveedores</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Portal Asignado</label>
                                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                                    value={formData.supplierPortalId || ''} onChange={e => setFormData({ ...formData, supplierPortalId: e.target.value })}>
                                    <option value="">Sin Portal</option>
                                    {supplierPortals.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Usuario Portal</label>
                                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                                    value={formData.portalUser || ''} onChange={e => setFormData({ ...formData, portalUser: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password Portal</label>
                                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                                    value={formData.portalPassword || ''} onChange={e => setFormData({ ...formData, portalPassword: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <button type="button" onClick={onClose} className="px-6 py-2 text-slate-600 font-bold hover:bg-slate-50 rounded-lg" disabled={saving}>Cancelar</button>
                        <button type="submit" className="bg-brand-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-brand-700 flex items-center gap-2" disabled={saving}>
                            {saving && <Loader2 size={16} className="animate-spin" />}
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
});
