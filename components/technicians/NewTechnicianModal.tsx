import React, { useState, memo, useEffect } from 'react';
import { X, UserPlus, Search, CheckSquare, Square, Building2, AlertCircle } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { Company, Branch, TechnicianType, ServiceProvider, Technician } from '../../types';

interface NewTechnicianModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (formData: any) => void;
    branches: Branch[];
    types: TechnicianType[];
    companies: Company[];
    serviceProviders: ServiceProvider[];
    editingTech?: Technician;
    initialEPSIds?: string[];
}

export const NewTechnicianModal = memo(({
    isOpen,
    onClose,
    onSave,
    branches,
    types,
    companies,
    serviceProviders,
    editingTech,
    initialEPSIds
}: NewTechnicianModalProps) => {
    const [formData, setFormData] = useState({
        name: '', rut: '', email: '', phone: '', branch: '', technicianTypeId: ''
    });
    const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
    const [selectedEPSIds, setSelectedEPSIds] = useState<Set<string>>(new Set());
    const [companySearch, setCompanySearch] = useState('');
    const isEdit = Boolean(editingTech);

    const debouncedCompanySearch = useDebounce(companySearch, 300);

    useEffect(() => {
        if (isOpen && editingTech) {
            setFormData({
                name: editingTech.name || '',
                rut: editingTech.rut || '',
                email: editingTech.email || '',
                phone: editingTech.phone || '',
                branch: editingTech.branchId || '',
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

    // Función para formatear nombre con primera letra mayúscula en cada palabra
    const toTitleCase = (str: string): string => {
        return str
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
            .trim();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (selectedEPSIds.size === 0) {
            alert('Debe seleccionar una Empresa Prestadora de Servicio (EPS)');
            return;
        }

        const dataToSave = {
            ...formData,
            name: toTitleCase(formData.name), // Formatear nombre con Title Case
            companyIds: Array.from(selectedCompanyIds),
            serviceProviderIds: Array.from(selectedEPSIds).slice(0, 1),
            id: editingTech?.id
        };

        onSave(dataToSave);
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
                        {isEdit ? 'Guardar Cambios' : 'Crear Técnico'}
                    </button>
                </div>
            </div>
        </div>
    );
});
