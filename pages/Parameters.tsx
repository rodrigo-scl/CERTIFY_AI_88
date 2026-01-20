import React, { useState, useEffect } from 'react';
import {
    Layers, Shield, FileText, Briefcase, Plus, Save, Trash2, CheckCircle,
    Server, AlertCircle, RefreshCw, User as UserIcon, FolderOpen, Wrench, Lock, Activity, Eye, Play, AlertTriangle, Loader2,
    Building2, Phone, Mail, MapPin, X, Edit2, CheckSquare, Square, Globe, Link as LinkIcon, CalendarDays
} from 'lucide-react';
import {
    getIndustries, addIndustry, deleteIndustry,
    getDocumentTypes, addDocumentType, deleteDocumentType,
    getAreas, addArea, deleteArea,
    getTechTypes, addTechType, deleteTechType,
    getServiceProviders, addServiceProvider, deleteServiceProvider, updateServiceProvider,
    getSupplierPortals, addSupplierPortal, updateSupplierPortal, deleteSupplierPortal,
    updateIndustry, updateDocumentType, updateArea, updateTechType,
    getHolidays, addHoliday, deleteHoliday
} from '../services/dataService';
import { Industry, DocumentType, AppUser, WorkArea, TechnicianType, SLAType, DocScope, RenewalType, RenewalUnit, ServiceProvider, SupplierPortal, Holiday } from '../types';
import { Pagination } from '../components/shared/Pagination';
import { usePagination } from '../hooks/usePagination';
import { RolePermissionsMatrix } from '../components/RolePermissionsMatrix';

// --- SUB-COMPONENTS FOR MASTER DATA ---

// 1. AREAS CONFIGURATION
const AreasSettings = () => {
    const [areas, setAreas] = useState<WorkArea[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<WorkArea>>({
        name: '', slaDays: 30, slaType: 'CALENDAR', criticality: 'MEDIUM'
    });

    const [editingArea, setEditingArea] = useState<WorkArea | null>(null);
    const [editData, setEditData] = useState<Partial<WorkArea>>({});
    const [showEditModal, setShowEditModal] = useState(false);

    useEffect(() => { getAreas().then(setAreas); }, []);

    const openEditArea = (area: WorkArea) => {
        setEditingArea(area);
        setEditData({ name: area.name, slaDays: area.slaDays, slaType: area.slaType, criticality: area.criticality });
        setShowEditModal(true);
    };

    const handleUpdateArea = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingArea) return;
        setLoading(true);
        const result = await updateArea(editingArea.id, editData);
        if (!result.success) {
            alert(result.error || 'Error al actualizar');
            setLoading(false);
            return;
        }
        setAreas(await getAreas());
        setShowEditModal(false);
        setEditingArea(null);
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return;
        setLoading(true);
        setError(null);

        const result = await addArea(formData);
        if (!result.success) {
            setError(result.error || 'Error al guardar área');
            setLoading(false);
            return;
        }

        setAreas(await getAreas());
        setShowForm(false);
        setFormData({ name: '', slaDays: 30, slaType: 'CALENDAR', criticality: 'MEDIUM' });
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Eliminar esta área? Esta acción no se puede deshacer.')) return;
        setLoading(true);
        const result = await deleteArea(id);
        if (!result.success) {
            alert(result.error || 'Error al eliminar');
        }
        setAreas(await getAreas());
        setLoading(false);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 animate-in fade-in">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FolderOpen size={20} className="text-brand-600" /> Gestión de Áreas y SLA
                </h3>
                <button onClick={() => setShowForm(!showForm)} className="text-brand-600 font-medium text-sm hover:underline flex items-center gap-1">
                    {showForm ? 'Cancelar' : '+ Nueva Área'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="mb-6 bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Área</label>
                            <input className="w-full border border-slate-300 rounded-lg px-3 py-2" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Operaciones" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">SLA (Días)</label>
                            <input type="number" className="w-full border border-slate-300 rounded-lg px-3 py-2" value={formData.slaDays} onChange={e => setFormData({ ...formData, slaDays: parseInt(e.target.value) })} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo SLA</label>
                            <select className="w-full border border-slate-300 rounded-lg px-3 py-2" value={formData.slaType} onChange={e => setFormData({ ...formData, slaType: e.target.value as SLAType })}>
                                <option value="CALENDAR">Días Corridos</option>
                                <option value="BUSINESS">Días Hábiles</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Criticidad</label>
                            <select className="w-full border border-slate-300 rounded-lg px-3 py-2" value={formData.criticality} onChange={e => setFormData({ ...formData, criticality: e.target.value as any })}>
                                <option value="LOW">Baja</option>
                                <option value="MEDIUM">Media</option>
                                <option value="HIGH">Alta</option>
                            </select>
                        </div>
                    </div>
                    <button type="submit" className="mt-4 bg-brand-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700">Guardar Área</button>
                </form>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                        <tr>
                            <th className="px-4 py-3 font-medium">Nombre</th>
                            <th className="px-4 py-3 font-medium">SLA</th>
                            <th className="px-4 py-3 font-medium">Criticidad</th>
                            <th className="px-4 py-3 font-medium text-right">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {areas.map(area => (
                            <tr key={area.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-medium text-slate-900">{area.name}</td>
                                <td className="px-4 py-3 text-slate-600">{area.slaDays} días ({area.slaType === 'BUSINESS' ? 'Hábiles' : 'Corridos'})</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${area.criticality === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {area.criticality === 'HIGH' ? 'ALTA' : area.criticality === 'MEDIUM' ? 'MEDIA' : 'BAJA'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right flex gap-2 justify-end">
                                    <button
                                        onClick={() => openEditArea(area)}
                                        className="text-slate-400 hover:text-blue-600 cursor-pointer disabled:opacity-50"
                                        title="Editar"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(area.id)}
                                        className="text-slate-400 hover:text-red-500 cursor-pointer disabled:opacity-50"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {error && (
                <div className="mt-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            {showEditModal && editingArea && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h4 className="font-bold text-slate-900">Editar Área</h4>
                            <button onClick={() => setShowEditModal(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <form onSubmit={handleUpdateArea} className="p-5 space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={editData.name || ''} onChange={e => setEditData({ ...editData, name: e.target.value })} required />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">SLA (Días)</label>
                                    <input type="number" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={editData.slaDays || 30} onChange={e => setEditData({ ...editData, slaDays: parseInt(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo SLA</label>
                                    <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={editData.slaType || 'CALENDAR'} onChange={e => setEditData({ ...editData, slaType: e.target.value as SLAType })}>
                                        <option value="CALENDAR">Días Corridos</option>
                                        <option value="BUSINESS">Días Hábiles</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Criticidad</label>
                                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={editData.criticality || 'MEDIUM'} onChange={e => setEditData({ ...editData, criticality: e.target.value as any })}>
                                    <option value="LOW">Baja</option>
                                    <option value="MEDIUM">Media</option>
                                    <option value="HIGH">Alta</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-3">
                                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button type="submit" disabled={loading} className="px-5 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                                    {loading ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// 2. TECH TYPES CONFIGURATION
const TechTypesSettings = () => {
    const [types, setTypes] = useState<TechnicianType[]>([]);
    const [newType, setNewType] = useState({ name: '', description: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [editingType, setEditingType] = useState<TechnicianType | null>(null);
    const [editData, setEditData] = useState<Partial<TechnicianType>>({});
    const [showEditModal, setShowEditModal] = useState(false);

    useEffect(() => { getTechTypes().then(setTypes); }, []);

    const openEditType = (tt: TechnicianType) => {
        setEditingType(tt);
        setEditData({ name: tt.name, description: tt.description });
        setShowEditModal(true);
    };

    const handleUpdateType = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingType) return;
        setLoading(true);
        const result = await updateTechType(editingType.id, editData);
        if (!result.success) {
            alert(result.error || 'Error al actualizar');
            setLoading(false);
            return;
        }
        setTypes(await getTechTypes());
        setShowEditModal(false);
        setEditingType(null);
        setLoading(false);
    };

    const handleAdd = async () => {
        if (!newType.name) return;
        setLoading(true);
        setError(null);

        const result = await addTechType(newType.name, newType.description);
        if (!result.success) {
            setError(result.error || 'Error al agregar tipo');
            setLoading(false);
            return;
        }

        setTypes(await getTechTypes());
        setNewType({ name: '', description: '' });
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Eliminar este tipo de técnico?')) return;
        setLoading(true);
        const result = await deleteTechType(id);
        if (!result.success) {
            alert(result.error || 'Error al eliminar');
        }
        setTypes(await getTechTypes());
        setLoading(false);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 animate-in fade-in">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Wrench size={20} className="text-brand-600" /> Tipos de Técnico
            </h3>
            <div className="flex gap-4 mb-8 bg-slate-50 p-4 rounded-lg border border-slate-100 items-end">
                <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Nombre</label>
                    <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none" value={newType.name} onChange={e => setNewType({ ...newType, name: e.target.value })} placeholder="Ej: Electricista" disabled={loading} />
                </div>
                <div className="flex-[2]">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Descripción</label>
                    <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none" value={newType.description} onChange={e => setNewType({ ...newType, description: e.target.value })} placeholder="Descripción del rol..." disabled={loading} />
                </div>
                <button onClick={handleAdd} disabled={loading} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700 h-[42px] disabled:opacity-50 flex items-center justify-center">
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                </button>
            </div>

            {error && (
                <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            <div className="grid gap-4">
                {types.map(t => (
                    <div key={t.id} className="p-4 border border-slate-200 rounded-lg flex justify-between items-center bg-white group hover:border-brand-300 transition-colors">
                        <div>
                            <h4 className="font-semibold text-slate-800">{t.name}</h4>
                            <p className="text-sm text-slate-500">{t.description}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => openEditType(t)} disabled={loading} className="text-slate-400 hover:text-blue-600 disabled:opacity-50" title="Editar">
                                <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleDelete(t.id)} disabled={loading} className="text-slate-400 hover:text-red-500 disabled:opacity-50" title="Eliminar">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {showEditModal && editingType && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h4 className="font-bold text-slate-900">Editar Tipo de Técnico</h4>
                            <button onClick={() => setShowEditModal(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <form onSubmit={handleUpdateType} className="p-5 space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={editData.name || ''} onChange={e => setEditData({ ...editData, name: e.target.value })} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={editData.description || ''} onChange={e => setEditData({ ...editData, description: e.target.value })} />
                            </div>
                            <div className="flex justify-end gap-3 pt-3">
                                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button type="submit" disabled={loading} className="px-5 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                                    {loading ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// 3. INDUSTRIES CONFIGURATION
const IndustriesSettings = () => {
    const [industries, setIndustries] = useState<Industry[]>([]);
    const [newIndustry, setNewIndustry] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    useEffect(() => { getIndustries().then(setIndustries); }, []);

    const handleAdd = async () => {
        if (!newIndustry.trim()) return;
        setLoading(true);
        setError(null);

        const result = await addIndustry(newIndustry);
        if (!result.success) {
            setError(result.error || 'Error al agregar industria');
            setLoading(false);
            return;
        }

        setIndustries(await getIndustries());
        setNewIndustry('');
        setLoading(false);
    }

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Eliminar esta industria?')) return;
        setLoading(true);
        const result = await deleteIndustry(id);
        if (!result.success) {
            alert(result.error || 'Error al eliminar');
        }
        setIndustries(await getIndustries());
        setLoading(false);
    };

    const startEdit = (ind: Industry) => {
        setEditingId(ind.id);
        setEditingName(ind.name);
    };

    const handleEditSave = async () => {
        if (!editingId) return;
        setLoading(true);
        const result = await updateIndustry(editingId, editingName);
        if (!result.success) {
            alert(result.error || 'Error al actualizar');
            setLoading(false);
            return;
        }
        setIndustries(await getIndustries());
        setEditingId(null);
        setEditingName('');
        setLoading(false);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 animate-in fade-in">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Briefcase size={20} className="text-brand-600" /> Industrias
            </h3>
            <div className="flex gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Nombre de nueva industria..."
                    className="flex-1 border border-slate-200 rounded-lg px-4 py-2 text-slate-900 bg-white outline-none focus:ring-2 focus:ring-brand-500"
                    value={newIndustry}
                    onChange={(e) => setNewIndustry(e.target.value)}
                    disabled={loading}
                />
                <button onClick={handleAdd} disabled={loading} className="bg-brand-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-700 flex items-center gap-2 disabled:opacity-50">
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Agregar
                </button>
            </div>

            {error && (
                <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {industries.map(ind => (
                    <div key={ind.id} className="p-4 border border-slate-200 rounded-lg flex justify-between items-center group hover:border-brand-300 transition-colors bg-slate-50/50">
                        {editingId === ind.id ? (
                            <input
                                className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-sm mr-2"
                                value={editingName}
                                onChange={e => setEditingName(e.target.value)}
                                disabled={loading}
                            />
                        ) : (
                            <span className="font-medium text-slate-700">{ind.name}</span>
                        )}
                        <div className="flex items-center gap-2">
                            {editingId === ind.id ? (
                                <>
                                    <button onClick={handleEditSave} disabled={loading} className="text-green-600 hover:text-green-700 text-sm">Guardar</button>
                                    <button onClick={() => { setEditingId(null); setEditingName(''); }} className="text-slate-500 text-sm">Cancelar</button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => startEdit(ind)} disabled={loading} className="text-slate-400 hover:text-blue-600 disabled:opacity-50">
                                        <FileText size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(ind.id)}
                                        disabled={loading}
                                        className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// 4. DOCUMENT TYPES CONFIGURATION
const DocTypesSettings = () => {
    const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
    const [areas, setAreas] = useState<WorkArea[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<Partial<DocumentType>>({
        name: '', description: '', areaId: '',
        scope: 'TECHNICIAN',
        isGlobal: false,
        isActive: true,
        renewalType: 'FIXED',
        renewalFrequency: 1,
        renewalUnit: 'MONTHS',
        renewalDayOfMonth: 1
    });

    const [editingDoc, setEditingDoc] = useState<DocumentType | null>(null);
    const [editData, setEditData] = useState<Partial<DocumentType>>({});
    const [showEditModal, setShowEditModal] = useState(false);

    useEffect(() => {
        getDocumentTypes().then(setDocTypes);
        getAreas().then(setAreas);
    }, []);

    const openEditDoc = (doc: DocumentType) => {
        setEditingDoc(doc);
        setEditData({
            name: doc.name,
            description: doc.description,
            areaId: doc.areaId,
            scope: doc.scope,
            isGlobal: doc.isGlobal,
            isActive: doc.isActive,
            renewalType: doc.renewalType,
            renewalFrequency: doc.renewalFrequency,
            renewalUnit: doc.renewalUnit,
            renewalDayOfMonth: doc.renewalDayOfMonth
        });
        setShowEditModal(true);
    };

    const handleUpdateDoc = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingDoc) return;
        setLoading(true);
        const result = await updateDocumentType(editingDoc.id, editData);
        if (!result.success) {
            alert(result.error || 'Error al actualizar');
            setLoading(false);
            return;
        }
        setDocTypes(await getDocumentTypes());
        setShowEditModal(false);
        setEditingDoc(null);
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.areaId) {
            setError("Campos obligatorios: Nombre, Área");
            return;
        }
        setLoading(true);
        setError(null);

        const result = await addDocumentType(formData);
        if (!result.success) {
            setError(result.error || 'Error al guardar tipo de documento');
            setLoading(false);
            return;
        }

        setDocTypes(await getDocumentTypes());
        setShowForm(false);
        setFormData({
            name: '', description: '', areaId: '', scope: 'TECHNICIAN', isGlobal: false, isActive: true,
            renewalType: 'FIXED', renewalFrequency: 1, renewalUnit: 'MONTHS', renewalDayOfMonth: 1
        });
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Eliminar este tipo de documento? Esto puede afectar credenciales existentes.')) return;
        setLoading(true);
        const result = await deleteDocumentType(id);
        if (!result.success) {
            alert(result.error || 'Error al eliminar');
        }
        setDocTypes(await getDocumentTypes());
        setLoading(false);
    };

    const getAreaName = (areaId?: string) => areas.find(a => a.id === areaId)?.name || '-';

    const {
        paginatedData: paginatedDocs,
        currentPage,
        totalPages,
        totalItems,
        itemsPerPage,
        setPage,
        setItemsPerPage
    } = usePagination<DocumentType>(docTypes, { initialItemsPerPage: 10 });

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 animate-in fade-in">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FileText size={20} className="text-brand-600" /> Tipos de Documentos
                </h3>
                <button onClick={() => setShowForm(!showForm)} className="text-brand-600 font-medium text-sm hover:underline flex items-center gap-1">
                    {showForm ? 'Cancelar' : '+ Nuevo Tipo'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="mb-8 bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <h4 className="font-semibold text-slate-900 mb-4 border-b border-slate-200 pb-2">Crear Nuevo Tipo de Documento</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-700 mb-1">Nombre del Documento *</label>
                            <input required className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-brand-500"
                                value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Licencia Clase B" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción Breve</label>
                            <textarea rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-brand-500 resize-none"
                                value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Área Responsable *</label>
                            <select required className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                                value={formData.areaId} onChange={e => setFormData({ ...formData, areaId: e.target.value })}>
                                <option value="">Seleccionar Área...</option>
                                {areas.map(area => (<option key={area.id} value={area.id}>{area.name}</option>))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 border-t border-slate-200 pt-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Ámbito (Scope)</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="scope" checked={formData.scope === 'TECHNICIAN'} onChange={() => setFormData({ ...formData, scope: 'TECHNICIAN' })} />
                                    <span className="text-sm">Técnico</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="scope" checked={formData.scope === 'COMPANY'} onChange={() => setFormData({ ...formData, scope: 'COMPANY' })} />
                                    <span className="text-sm">Empresa</span>
                                </label>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Obligatoriedad Global</label>
                            <div className="flex items-center gap-2">
                                <div className={`relative w-11 h-6 transition-colors rounded-full cursor-pointer ${formData.isGlobal ? 'bg-brand-600' : 'bg-slate-300'}`} onClick={() => setFormData({ ...formData, isGlobal: !formData.isGlobal })}>
                                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.isGlobal ? 'translate-x-5' : ''}`}></div>
                                </div>
                                <span className="text-sm text-slate-600">{formData.isGlobal ? 'Sí, requerido para todos' : 'No, asignación manual'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-slate-200 mb-6">
                        <label className="block text-sm font-bold text-slate-700 mb-3">Tipo de Renovación</label>
                        <div className="flex gap-6 mb-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="renewal" checked={formData.renewalType === 'FIXED'} onChange={() => setFormData({ ...formData, renewalType: 'FIXED' })} />
                                <span className="text-sm font-medium">Fija (Por fecha de vencimiento)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="renewal" checked={formData.renewalType === 'PERIODIC'} onChange={() => setFormData({ ...formData, renewalType: 'PERIODIC' })} />
                                <span className="text-sm font-medium">Periódica (Recurrente)</span>
                            </label>
                        </div>

                        {formData.renewalType === 'PERIODIC' && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Frecuencia</label>
                                    <input type="number" min="1" className="w-full border border-slate-300 rounded px-3 py-1.5"
                                        value={formData.renewalFrequency} onChange={e => setFormData({ ...formData, renewalFrequency: parseInt(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Unidad</label>
                                    <select className="w-full border border-slate-300 rounded px-3 py-1.5"
                                        value={formData.renewalUnit} onChange={e => setFormData({ ...formData, renewalUnit: e.target.value as RenewalUnit })}>
                                        <option value="DAYS">Días</option>
                                        <option value="MONTHS">Meses</option>
                                    </select>
                                </div>
                                {formData.scope === 'COMPANY' && formData.renewalUnit === 'MONTHS' && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Día Vencimiento (1-31)</label>
                                        <input type="number" min="1" max="31" className="w-full border border-slate-300 rounded px-3 py-1.5"
                                            value={formData.renewalDayOfMonth} onChange={e => setFormData({ ...formData, renewalDayOfMonth: parseInt(e.target.value) })} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancelar</button>
                        <button type="submit" disabled={loading} className="bg-brand-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-700 flex items-center gap-2">
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Guardar Documento
                        </button>
                    </div>
                </form>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                        <tr>
                            <th className="px-4 py-3 font-medium">Nombre</th>
                            <th className="px-4 py-3 font-medium">Área</th>
                            <th className="px-4 py-3 font-medium">Ámbito</th>
                            <th className="px-4 py-3 font-medium">Regla Renovación</th>
                            <th className="px-4 py-3 font-medium text-center">Global</th>
                            <th className="px-4 py-3 font-medium text-center">Activo</th>
                            <th className="px-4 py-3 font-medium text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {paginatedDocs.map(doc => (
                            <tr key={doc.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-medium text-slate-800">{doc.name}</td>
                                <td className="px-4 py-3 text-slate-600"><span className="px-2 py-0.5 bg-slate-100 rounded text-xs">{getAreaName(doc.areaId)}</span></td>
                                <td className="px-4 py-3 text-slate-600">{doc.scope === 'TECHNICIAN' ? 'Técnico' : 'Empresa'}</td>
                                <td className="px-4 py-3 text-slate-600">
                                    {doc.renewalType === 'FIXED' ? 'Fija' : `Cada ${doc.renewalFrequency} ${doc.renewalUnit === 'MONTHS' ? 'Meses' : 'Días'}`}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {doc.isGlobal ? <CheckCircle size={16} className="text-purple-500 mx-auto" /> : <span className="text-slate-300">-</span>}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <div className={`w-2 h-2 rounded-full mx-auto ${doc.isActive ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                                </td>
                                <td className="px-4 py-3 text-right flex gap-2 justify-end">
                                    <button onClick={() => openEditDoc(doc)} className="text-slate-400 hover:text-blue-600"><Edit2 size={16} /></button>
                                    <button onClick={() => handleDelete(doc.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setPage} onItemsPerPageChange={setItemsPerPage} className="border-t border-slate-100" />
            </div>

            {showEditModal && editingDoc && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0">
                            <h4 className="font-bold text-slate-900">Editar Tipo de Documento</h4>
                            <button onClick={() => setShowEditModal(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <form onSubmit={handleUpdateDoc} className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                                    <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={editData.name || ''} onChange={e => setEditData({ ...editData, name: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Área</label>
                                    <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={editData.areaId || ''} onChange={e => setEditData({ ...editData, areaId: e.target.value })}>
                                        <option value="">Seleccionar...</option>
                                        {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Ámbito</label>
                                    <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={editData.scope || 'TECHNICIAN'} onChange={e => setEditData({ ...editData, scope: e.target.value as DocScope })}>
                                        <option value="TECHNICIAN">Técnico</option>
                                        <option value="COMPANY">Empresa</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-4">
                                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-slate-600 text-sm hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button type="submit" disabled={loading} className="px-5 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// 5. EMPRESAS PRESTADORAS DE SERVICIO
const ServiceProvidersSettings = () => {
    const [providers, setProviders] = useState<ServiceProvider[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<ServiceProvider>>({
        name: '', rut: '', industry: '', contactEmail: '', contactPhone: '', address: '', isActive: true
    });
    const [editingProvider, setEditingProvider] = useState<ServiceProvider | null>(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editData, setEditData] = useState<Partial<ServiceProvider>>({});

    useEffect(() => { getServiceProviders().then(setProviders); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return;
        setLoading(true);
        const result = await addServiceProvider(formData);
        if (!result.success) { setError(result.error || 'Error'); setLoading(false); return; }
        setProviders(await getServiceProviders());
        setShowForm(false);
        setFormData({ name: '', rut: '', industry: '', contactEmail: '', contactPhone: '', address: '', isActive: true });
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Eliminar?')) return;
        setLoading(true);
        await deleteServiceProvider(id);
        setProviders(await getServiceProviders());
        setLoading(false);
    };

    const openEdit = (sp: ServiceProvider) => {
        setEditingProvider(sp);
        setEditData({ name: sp.name, rut: sp.rut, industry: sp.industry, contactEmail: sp.contactEmail, contactPhone: sp.contactPhone, address: sp.address, isActive: sp.isActive });
        setEditModalOpen(true);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProvider) return;
        setLoading(true);
        await updateServiceProvider(editingProvider.id, editData);
        setProviders(await getServiceProviders());
        setEditModalOpen(false);
        setLoading(false);
    };

    const { paginatedData, currentPage, totalPages, totalItems, itemsPerPage, setPage, setItemsPerPage } = usePagination<ServiceProvider>(providers, { initialItemsPerPage: 10 });

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 animate-in fade-in">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Building2 size={20} className="text-purple-600" /> Empresas Prestadoras</h3>
                <button onClick={() => setShowForm(!showForm)} className="text-brand-600 font-medium text-sm hover:underline">{showForm ? 'Cancelar' : '+ Nueva'}</button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="mb-8 bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input required className="border p-2 rounded" placeholder="Nombre" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        <input className="border p-2 rounded" placeholder="RUT" value={formData.rut} onChange={e => setFormData({ ...formData, rut: e.target.value })} />
                    </div>
                    <button className="mt-4 bg-purple-600 text-white px-4 py-2 rounded">Guardar</button>
                </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedData.map(sp => (
                    <div key={sp.id} className="border p-4 rounded-xl relative group bg-slate-50/50">
                        <h4 className="font-bold">{sp.name}</h4>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-2">
                            <button onClick={() => openEdit(sp)} className="text-blue-500"><Edit2 size={16} /></button>
                            <button onClick={() => handleDelete(sp.id)} className="text-red-500"><Trash2 size={16} /></button>
                        </div>
                    </div>
                ))}
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setPage} onItemsPerPageChange={setItemsPerPage} className="mt-4" />

            {editModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-xl w-full max-w-md">
                        <h4 className="font-bold mb-4">Editar</h4>
                        <input className="w-full border p-2 mb-4" value={editData.name || ''} onChange={e => setEditData({ ...editData, name: e.target.value })} />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setEditModalOpen(false)}>Cancelar</button>
                            <button onClick={handleUpdate} className="bg-purple-600 text-white px-4 py-2 rounded">Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// 6. PORTALES DE PROVEEDORES
const SupplierPortalsSettings = () => {
    const [portals, setPortals] = useState<SupplierPortal[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<SupplierPortal>>({ name: '', url: '', username: '', password: '', isActive: true });

    useEffect(() => { getSupplierPortals().then(setPortals); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await addSupplierPortal(formData);
        setPortals(await getSupplierPortals());
        setShowForm(false);
        setFormData({ name: '', url: '', username: '', password: '', isActive: true });
    };

    const { paginatedData, currentPage, totalPages, totalItems, itemsPerPage, setPage, setItemsPerPage } = usePagination<SupplierPortal>(portals, { initialItemsPerPage: 10 });

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 animate-in fade-in">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Globe size={20} className="text-indigo-600" /> Portales</h3>
                <button onClick={() => setShowForm(!showForm)} className="text-brand-600 font-medium text-sm">{showForm ? 'Cancelar' : '+ Nuevo'}</button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="p-4 bg-slate-50 border rounded-xl mb-4">
                    <input required className="w-full border p-2 mb-2" placeholder="Nombre" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    <input required className="w-full border p-2 mb-2" placeholder="URL" value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} />
                    <button className="bg-indigo-600 text-white px-4 py-2 rounded">Guardar</button>
                </form>
            )}

            <table className="w-full text-sm">
                <thead className="bg-slate-50">
                    <tr><th className="p-2 text-left">Nombre</th><th className="p-2 text-left">URL</th></tr>
                </thead>
                <tbody>
                    {paginatedData.map(p => (
                        <tr key={p.id} className="border-b">
                            <td className="p-2">{p.name}</td>
                            <td className="p-2 font-mono text-xs">{p.url}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setPage} onItemsPerPageChange={setItemsPerPage} className="mt-4" />
        </div>
    );
};

// 7. FERIADOS NACIONALES (Rodrigo Osorio v0.16)
const HolidaysSettings = () => {
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newHoliday, setNewHoliday] = useState({ date: '', name: '', isRecurring: false });

    useEffect(() => { getHolidays().then(setHolidays); }, []);

    const handleAdd = async () => {
        if (!newHoliday.date || !newHoliday.name.trim()) {
            setError('Fecha y nombre son requeridos');
            return;
        }
        setLoading(true);
        setError(null);
        const result = await addHoliday(newHoliday.date, newHoliday.name.trim(), newHoliday.isRecurring);
        if (!result.success) {
            setError(result.error || 'Error al agregar feriado');
            setLoading(false);
            return;
        }
        setHolidays(await getHolidays());
        setNewHoliday({ date: '', name: '', isRecurring: false });
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Eliminar este feriado?')) return;
        setLoading(true);
        await deleteHoliday(id);
        setHolidays(await getHolidays());
        setLoading(false);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 animate-in fade-in">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <CalendarDays size={20} className="text-rose-600" /> Feriados Nacionales
            </h3>
            <p className="text-sm text-slate-500 mb-6">
                Configure los días feriados del país. Estos se mostrarán en rojo en el calendario de disponibilidad.
            </p>

            {/* Formulario para agregar */}
            <div className="flex flex-wrap gap-4 mb-8 bg-slate-50 p-4 rounded-lg border border-slate-100 items-end">
                <div className="flex-1 min-w-[140px]">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Fecha</label>
                    <input
                        type="date"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                        value={newHoliday.date}
                        onChange={e => setNewHoliday({ ...newHoliday, date: e.target.value })}
                        disabled={loading}
                    />
                </div>
                <div className="flex-[2] min-w-[200px]">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Nombre del feriado</label>
                    <input
                        type="text"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                        value={newHoliday.name}
                        onChange={e => setNewHoliday({ ...newHoliday, name: e.target.value })}
                        placeholder="Ej: Año Nuevo"
                        disabled={loading}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
                        <input
                            type="checkbox"
                            checked={newHoliday.isRecurring}
                            onChange={e => setNewHoliday({ ...newHoliday, isRecurring: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                            disabled={loading}
                        />
                        Anual
                    </label>
                </div>
                <button
                    onClick={handleAdd}
                    disabled={loading}
                    className="bg-rose-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-rose-700 h-[42px] disabled:opacity-50 flex items-center justify-center"
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                </button>
            </div>

            {error && (
                <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            {/* Lista de feriados */}
            {holidays.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <CalendarDays size={48} className="mx-auto mb-3 opacity-50" />
                    <p>No hay feriados configurados</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {holidays.map(h => (
                        <div key={h.id} className="p-4 border border-slate-200 rounded-lg flex justify-between items-center group hover:border-rose-300 transition-colors bg-slate-50/50">
                            <div>
                                <span className="inline-block px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-xs font-bold mb-1">
                                    {formatDate(h.date)}
                                </span>
                                <h4 className="font-semibold text-slate-800">{h.name}</h4>
                                {h.isRecurring && (
                                    <span className="text-xs text-slate-400">🔄 Se repite cada año</span>
                                )}
                            </div>
                            <button
                                onClick={() => handleDelete(h.id)}
                                disabled={loading}
                                className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- MAIN PARAMETERS PAGE ---

export const Parameters = () => {
    const [activeTab, setActiveTab] = useState('areas');

    const tabs = [
        { id: 'areas', label: 'Áreas', icon: FolderOpen },
        { id: 'tech-types', label: 'Tipos de Técnico', icon: Wrench },
        { id: 'industries', label: 'Industrias', icon: Briefcase },
        { id: 'doc-types', label: 'Tipos de Documento', icon: FileText },
        { id: 'eps', label: 'Empresas Prestadoras', icon: Building2 },
        { id: 'portals', label: 'Portales de Proveedores', icon: Globe },
        { id: 'holidays', label: 'Feriados', icon: CalendarDays },
        { id: 'roles', label: 'Roles y Permisos', icon: Shield },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-black text-slate-900">Parámetros</h2>
                <p className="text-sm text-slate-500 font-medium">Administración del sistema y datos maestros</p>
            </div>

            <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit overflow-x-auto max-w-full no-scrollbar">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap
                ${activeTab === tab.id
                                    ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
                        >
                            <Icon size={18} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            <div className="mt-6">
                {activeTab === 'areas' && <AreasSettings />}
                {activeTab === 'tech-types' && <TechTypesSettings />}
                {activeTab === 'industries' && <IndustriesSettings />}
                {activeTab === 'doc-types' && <DocTypesSettings />}
                {activeTab === 'eps' && <ServiceProvidersSettings />}
                {activeTab === 'portals' && <SupplierPortalsSettings />}
                {activeTab === 'holidays' && <HolidaysSettings />}
                {activeTab === 'roles' && <RolePermissionsMatrix />}
            </div>
        </div>
    );
};


