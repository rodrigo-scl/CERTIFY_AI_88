import React, { useState, useEffect, memo } from 'react';
import { X, Search, CheckSquare, Square, Building, Briefcase, ChevronRight, ArrowUpDown } from 'lucide-react';
import { Company, Industry, DocumentType, ServiceProvider } from '../../types';

interface NewCompanyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    industries: Industry[];
    holdings: Company[];
    techDocs: DocumentType[];
    companyDocs: DocumentType[];
    serviceProviders: ServiceProvider[];
}

export const NewCompanyModal = memo(({
    isOpen,
    onClose,
    onSave,
    industries,
    holdings,
    techDocs,
    companyDocs,
    serviceProviders
}: NewCompanyModalProps) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '',
        industry: '',
        type: 'SUBSIDIARY',
        parentId: '',
        serviceProviderId: ''
    });
    const [selectedTechDocIds, setSelectedTechDocIds] = useState<Set<string>>(new Set());
    const [selectedCompDocIds, setSelectedCompDocIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setFormData({ name: '', industry: '', type: 'SUBSIDIARY', parentId: '', serviceProviderId: '' });
            setSelectedTechDocIds(new Set(techDocs.filter(d => d.isGlobalRequirement).map(d => d.id)));
            setSelectedCompDocIds(new Set(companyDocs.filter(d => d.isGlobalRequirement).map(d => d.id)));
        }
    }, [isOpen, techDocs, companyDocs]);

    if (!isOpen) return null;

    const handleNext = () => setStep(s => s + 1);
    const handleSave = () => {
        onSave({
            ...formData,
            requiredDocTypes: Array.from(selectedTechDocIds),
            requiredCompanyDocTypes: Array.from(selectedCompDocIds)
        });
        onClose();
    };

    const toggleDoc = (id: string, scope: 'TECHNICIAN' | 'COMPANY') => {
        if (scope === 'TECHNICIAN') {
            const next = new Set(selectedTechDocIds);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            setSelectedTechDocIds(next);
        } else {
            const next = new Set(selectedCompDocIds);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            setSelectedCompDocIds(next);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-brand-50">
                    <div>
                        <h3 className="font-bold text-brand-900 text-lg flex items-center gap-2">
                            <Building size={20} /> Nueva Empresa
                        </h3>
                        <div className="flex gap-4 mt-1">
                            <div className={`text-[10px] font-black uppercase tracking-widest ${step === 1 ? 'text-brand-600' : 'text-slate-400'}`}>1. Básicos</div>
                            <div className={`text-[10px] font-black uppercase tracking-widest ${step === 2 ? 'text-brand-600' : 'text-slate-400'}`}>2. Requisitos</div>
                        </div>
                    </div>
                    <button onClick={onClose}><X size={20} className="text-brand-700" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    {step === 1 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Nombre Comercial</label>
                                    <input required className="w-full border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-500"
                                        value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Minera Escondida" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Rubro / Industria</label>
                                    <select required className="w-full border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                                        value={formData.industry} onChange={e => setFormData({ ...formData, industry: e.target.value })}>
                                        <option value="">Seleccionar...</option>
                                        {industries.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Tipo de Empresa</label>
                                    <select className="w-full border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                                        value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })}>
                                        <option value="SUBSIDIARY">Sucursal / Proyecto</option>
                                        <option value="HOLDING">Holding (Padre)</option>
                                    </select>
                                </div>
                                {formData.type === 'SUBSIDIARY' && (
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Holding Perteneciente</label>
                                        <select className="w-full border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                                            value={formData.parentId} onChange={e => setFormData({ ...formData, parentId: e.target.value })}>
                                            <option value="">Sin Holding (Independiente)</option>
                                            {holdings.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2">Requisitos para Técnicos</h4>
                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                                    {techDocs.map(doc => (
                                        <div
                                            key={doc.id}
                                            onClick={() => toggleDoc(doc.id, 'TECHNICIAN')}
                                            className={`p-3 rounded-lg border cursor-pointer flex items-center transition-all ${selectedTechDocIds.has(doc.id) ? 'bg-brand-50 border-brand-200' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                                        >
                                            <div className={`mr-3 ${selectedTechDocIds.has(doc.id) ? 'text-brand-600' : 'text-slate-300'}`}>
                                                {selectedTechDocIds.has(doc.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                                            </div>
                                            <span className="text-sm font-medium text-slate-700">{doc.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2">Requisitos de la Empresa</h4>
                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                                    {companyDocs.map(doc => (
                                        <div
                                            key={doc.id}
                                            onClick={() => toggleDoc(doc.id, 'COMPANY')}
                                            className={`p-3 rounded-lg border cursor-pointer flex items-center transition-all ${selectedCompDocIds.has(doc.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                                        >
                                            <div className={`mr-3 ${selectedCompDocIds.has(doc.id) ? 'text-indigo-600' : 'text-slate-300'}`}>
                                                {selectedCompDocIds.has(doc.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                                            </div>
                                            <span className="text-sm font-medium text-slate-700">{doc.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                    <button type="button" onClick={onClose} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg">Cancelar</button>
                    <div className="flex gap-3">
                        {step === 1 ? (
                            <button onClick={handleNext} disabled={!formData.name || !formData.industry}
                                className="bg-brand-600 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-brand-700 flex items-center gap-2 disabled:opacity-50">
                                Siguiente <ChevronRight size={18} />
                            </button>
                        ) : (
                            <button onClick={handleSave} className="bg-emerald-600 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-emerald-700">
                                Crear Proyecto
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});
