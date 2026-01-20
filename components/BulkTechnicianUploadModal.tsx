import React, { useState, useRef } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle2, Loader2, Info, FileSpreadsheet } from 'lucide-react';
import { Branch, ServiceProvider, ComplianceStatus, TechnicianType } from '../types';
import { checkRutsExist, bulkAddTechnicians } from '../services/dataService';

interface BulkTechnicianUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    branches: Branch[];
    serviceProviders: ServiceProvider[];
    technicianTypes: TechnicianType[];
}

interface ParsedTech {
    nombre: string;
    rut: string;
    email: string;
    telefono: string;
    cargo: string;
    status: 'pending' | 'valid' | 'duplicate' | 'invalid';
    error?: string;
}

export const BulkTechnicianUploadModal = ({
    isOpen,
    onClose,
    onSuccess,
    branches,
    serviceProviders,
    technicianTypes
}: BulkTechnicianUploadModalProps) => {
    const [step, setStep] = useState<'upload' | 'preview' | 'processing' | 'success'>('upload');
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedEPS, setSelectedEPS] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [technicians, setTechnicians] = useState<ParsedTech[]>([]);
    const [isChecking, setIsChecking] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const downloadTemplate = () => {
        const headers = ['Nombre', 'RUT', 'Email', 'Telefono']; // Rodrigo Osorio v0.15 - Cargo eliminado del CSV para ser estandarizado vía UI
        const examples = [
            ['Juan Perez', '12345678-9', 'juan@ejemplo.com', '+56912345678'],
            ['Maria Garcia', '98765432-1', 'maria@ejemplo.com', '']
        ];

        const csvContent = [
            headers.join(','),
            ...examples.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'plantilla_carga_tecnicos.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);

            // Skip header
            const dataLines = lines.slice(1);
            const parsed: ParsedTech[] = dataLines.map(line => {
                const parts = line.split(',').map(p => p.trim());
                return {
                    nombre: parts[0] || '',
                    rut: parts[1] || '',
                    email: parts[2] || '',
                    telefono: parts[3] || '',
                    cargo: '', // Se ignorará el del CSV
                    status: 'pending'
                };
            }).filter(t => t.nombre && t.rut);

            if (parsed.length === 0) {
                alert('El archivo no contiene datos válidos o está vacío.');
                return;
            }

            setTechnicians(parsed);
            setStep('preview');

            // Validar duplicados contra la base de datos
            setIsChecking(true);
            try {
                const ruts = parsed.map(t => t.rut);
                const existingRuts = await checkRutsExist(ruts);

                setTechnicians(prev => prev.map(t => {
                    if (existingRuts.includes(t.rut)) {
                        return { ...t, status: 'duplicate', error: 'RUT ya registrado' };
                    }
                    if (!t.nombre || !t.rut) {
                        return { ...t, status: 'invalid', error: 'Datos incompletos' };
                    }
                    return { ...t, status: 'valid' };
                }));
            } catch (err) {
                console.error(err);
            } finally {
                setIsChecking(false);
            }
        };
        reader.readAsText(file);
    };

    const handleProcess = async () => {
        // Cargo (selectedType) y EPS (selectedEPS) son obligatorios
        if (!selectedEPS || !selectedType) {
            alert('Por favor selecciona la EPS y el Cargo del técnico. Son campos obligatorios.');
            return;
        }

        // Sucursal es opcional pero requiere alerta si no se selecciona
        if (!selectedBranch) {
            const confirmNoBranch = window.confirm('No has seleccionado una sucursal. Los técnicos se cargarán sin sucursal asignada. ¿Deseas continuar?');
            if (!confirmNoBranch) return;
        }

        const validTechs = technicians.filter(t => t.status === 'valid');
        if (validTechs.length === 0) {
            alert('No hay técnicos válidos para cargar.');
            return;
        }

        setIsSaving(true);
        setStep('processing');
        try {
            await bulkAddTechnicians(validTechs, selectedBranch || '', selectedEPS, selectedType);
            setStep('success');
        } catch (err) {
            console.error(err);
            alert('Ocurrió un error al procesar la carga.');
            setStep('preview');
        } finally {
            setIsSaving(false);
        }
    };

    const reset = () => {
        setStep('upload');
        setTechnicians([]);
        setSelectedBranch('');
        setSelectedEPS('');
        setSelectedType('');
    };

    const validCount = technicians.filter(t => t.status === 'valid').length;
    const errorCount = technicians.length - validCount;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-slate-900 px-8 py-6 flex justify-between items-center text-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-500/20 rounded-xl text-brand-400">
                            <Upload size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Carga Masiva de Técnicos</h2>
                            <p className="text-xs text-slate-400 font-medium">Importación rápida desde archivo CSV</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    {step === 'upload' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 ml-1">Sucursal a Asignar</label>
                                    <select
                                        value={selectedBranch}
                                        onChange={(e) => setSelectedBranch(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                    >
                                        <option value="">Selecciona Sucursal...</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-1">
                                        EPS (Empresa Prestadora)
                                        <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={selectedEPS}
                                        onChange={(e) => setSelectedEPS(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                    >
                                        <option value="">Selecciona EPS...</option>
                                        {serviceProviders.map(sp => (
                                            <option key={sp.id} value={sp.id}>{sp.name} {sp.rut ? `(${sp.rut})` : ''}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-1">
                                        Cargo / Tipo de Técnico
                                        <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={selectedType}
                                        onChange={(e) => setSelectedType(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                    >
                                        <option value="">Selecciona Cargo...</option>
                                        {technicianTypes.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={`flex flex-col items-center justify-center border-2 border-dashed rounded-3xl p-12 transition-all group ${(!selectedEPS || !selectedType) ? 'border-slate-100 bg-slate-50/30 opacity-60 grayscale' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-brand-300'}`}>
                                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <FileSpreadsheet size={32} className={(!selectedEPS || !selectedType) ? 'text-slate-300' : 'text-brand-500'} />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800">
                                    {(!selectedEPS || !selectedType) ? 'Selecciona EPS y Cargo para continuar' : 'Haz clic para subir tu archivo'}
                                </h3>
                                <p className="text-sm text-slate-500 mt-1 mb-6 text-center">Solo archivos .csv con el formato especificado</p>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept=".csv"
                                    disabled={!selectedEPS || !selectedType}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={!selectedEPS || !selectedType}
                                    className="bg-brand-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-700 shadow-lg shadow-brand-500/20 transition-all active:scale-95 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed"
                                >
                                    Elegir Archivo
                                </button>
                            </div>

                            <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex gap-4">
                                <div className="p-2 bg-blue-100 rounded-lg shrink-0 h-fit">
                                    <Info className="text-blue-600" size={20} />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold text-blue-900">¿No tienes el formato?</h4>
                                    <p className="text-xs text-blue-700 leading-relaxed">Descarga nuestra plantilla oficial para asegurar que los datos se carguen correctamente sin errores.</p>
                                    <button
                                        onClick={downloadTemplate}
                                        className="mt-3 text-xs font-bold text-blue-600 flex items-center gap-1.5 hover:underline"
                                    >
                                        <Download size={14} /> Descargar Plantilla .CSV
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-6 animate-in fade-in scale-in-95">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Previsualización de Carga</h3>
                                    <p className="text-sm text-slate-500">Se han detectado {technicians.length} registros en el archivo</p>
                                </div>
                                <div className="flex gap-2 text-xs font-bold">
                                    <div className="px-3 py-1 bg-green-50 text-green-600 rounded-lg flex items-center gap-1.5">
                                        <CheckCircle2 size={14} /> {validCount} Válidos
                                    </div>
                                    {errorCount > 0 && (
                                        <div className="px-3 py-1 bg-red-50 text-red-600 rounded-lg flex items-center gap-1.5">
                                            <AlertCircle size={14} /> {errorCount} Duplicados/Errores
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="border border-slate-100 rounded-2xl overflow-hidden overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[10px]">Nombre</th>
                                            <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[10px]">RUT</th>
                                            <th className="px-4 py-3 text-center font-bold text-slate-600 uppercase tracking-wider text-[10px]">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {technicians.map((t, i) => (
                                            <tr key={i} className={t.status === 'valid' ? '' : 'bg-slate-50/50'}>
                                                <td className="px-4 py-3 font-medium text-slate-800">{t.nombre}</td>
                                                <td className="px-4 py-3 text-slate-600">{t.rut}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {isChecking ? (
                                                        <Loader2 size={14} className="animate-spin text-slate-300 mx-auto" />
                                                    ) : t.status === 'valid' ? (
                                                        <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-bold text-[10px] uppercase">
                                                            <CheckCircle2 size={10} /> Ok
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-0.5 rounded-full font-bold text-[10px] uppercase" title={t.error}>
                                                            <AlertCircle size={10} /> {t.status === 'duplicate' ? 'Duplicado' : 'Error'}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div className="text-xs text-slate-500">
                                    <p>Asignando a: <span className="font-bold text-slate-700">{branches.find(b => b.id === selectedBranch)?.name || '-'}</span></p>
                                    <p>EPS: <span className="font-bold text-slate-700">{serviceProviders.find(sp => sp.id === selectedEPS)?.name || '-'}</span></p>
                                    <p>Cargo: <span className="font-bold text-slate-700">{technicianTypes.find(tt => tt.id === selectedType)?.name || '-'}</span></p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={reset}
                                        className="px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
                                    >
                                        Cambiar Archivo
                                    </button>
                                    <button
                                        onClick={handleProcess}
                                        disabled={validCount === 0 || isChecking}
                                        className="bg-brand-600 text-white px-8 py-2 rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
                                    >
                                        Iniciar Carga
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="py-20 flex flex-col items-center justify-center animate-pulse">
                            <div className="w-20 h-20 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                            <h3 className="text-xl font-bold text-slate-800">Procesando Importación...</h3>
                            <p className="text-slate-500 mt-2">Cargando técnicos al sistema y vinculando documentos base.</p>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="py-12 flex flex-col items-center justify-center text-center animate-in zoom-in-95">
                            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/10">
                                <CheckCircle2 size={48} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900">¡Carga Completada con Éxito!</h3>
                            <p className="text-slate-500 mt-2 max-w-sm mx-auto">Los técnicos han sido registrados y asociados a su correspondiente sucursal y EPS.</p>

                            <div className="mt-10 flex gap-4">
                                <button
                                    onClick={onClose}
                                    className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                                >
                                    Ver Técnicos
                                </button>
                                <button
                                    onClick={reset}
                                    className="text-slate-600 px-6 py-3 rounded-xl font-bold hover:bg-slate-100 transition-all"
                                >
                                    Cargar Más
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
