import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle, Trash2, Plus, Loader2, Thermometer, Plane, Activity } from 'lucide-react';
import { Technician, TechnicianAbsence, AbsenceType } from '../types';
import { getTechnicianAbsences, addTechnicianAbsence, deleteTechnicianAbsence } from '../services/dataService';
import { formatDateForDisplay } from '../services/dateUtils';

interface TechnicianAbsenceModalProps {
    isOpen: boolean;
    onClose: () => void;
    technician: Technician;
    onUpdate?: () => void;
}

export const TechnicianAbsenceModal = ({
    isOpen,
    onClose,
    technician,
    onUpdate
}: TechnicianAbsenceModalProps) => {
    const [absences, setAbsences] = useState<TechnicianAbsence[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [newType, setNewType] = useState<AbsenceType>('VACATION');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [comments, setComments] = useState('');

    useEffect(() => {
        if (isOpen && technician.id) {
            loadAbsences();
        }
    }, [isOpen, technician.id]);

    const loadAbsences = async () => {
        setLoading(true);
        try {
            const data = await getTechnicianAbsences(technician.id);
            setAbsences(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!startDate || !endDate) return;

        setSaving(true);
        try {
            await addTechnicianAbsence({
                technicianId: technician.id,
                type: newType,
                startDate,
                endDate,
                comments
            });
            setShowForm(false);
            resetForm();
            await loadAbsences();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error(error);
            alert('Error al guardar la ausencia');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Estás seguro de eliminar este registro?')) return;

        try {
            await deleteTechnicianAbsence(id);
            await loadAbsences();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error(error);
        }
    };

    const resetForm = () => {
        setNewType('VACATION');
        setStartDate('');
        setEndDate('');
        setComments('');
    };

    if (!isOpen) return null;

    const getAbsenceIcon = (type: AbsenceType) => {
        switch (type) {
            case 'VACATION': return <Plane className="text-blue-500" size={18} />;
            case 'MEDICAL_LEAVE': return <Thermometer className="text-red-500" size={18} />;
            default: return <Activity className="text-slate-500" size={18} />;
        }
    };

    const getAbsenceLabel = (type: AbsenceType) => {
        switch (type) {
            case 'VACATION': return 'Vacaciones';
            case 'MEDICAL_LEAVE': return 'Licencia Médica';
            default: return 'Otro / Ausencia';
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-slate-900 px-8 py-6 flex justify-between items-center text-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-500/20 rounded-xl text-brand-400">
                            <Calendar size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Gestión de Disponibilidad</h2>
                            <p className="text-xs text-slate-400 font-medium">{technician.name} ({technician.rut})</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    {!showForm ? (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-800">Historial de Ausencias</h3>
                                <button
                                    onClick={() => setShowForm(true)}
                                    className="bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-brand-700 transition-all active:scale-95"
                                >
                                    <Plus size={16} /> Reportar Ausencia
                                </button>
                            </div>

                            {loading ? (
                                <div className="py-12 flex justify-center">
                                    <Loader2 className="animate-spin text-brand-500" size={32} />
                                </div>
                            ) : absences.length === 0 ? (
                                <div className="py-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                    <Calendar className="mx-auto text-slate-300 mb-2" size={40} />
                                    <p className="text-slate-500 font-medium">No hay ausencias registradas</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {absences.map(absence => (
                                        <div key={absence.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group hover:shadow-md transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2.5 bg-slate-50 rounded-xl">
                                                    {getAbsenceIcon(absence.type)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 flex items-center gap-2">
                                                        {getAbsenceLabel(absence.type)}
                                                        {new Date(absence.startDate) <= new Date() && new Date(absence.endDate) >= new Date() && (
                                                            <span className="bg-orange-100 text-orange-600 text-[10px] uppercase px-2 py-0.5 rounded-full font-black animate-pulse">
                                                                ACTUAL
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                        <Calendar size={12} />
                                                        {formatDateForDisplay(absence.startDate)} al {formatDateForDisplay(absence.endDate)}
                                                    </div>
                                                    {absence.comments && (
                                                        <p className="text-[11px] text-slate-400 mt-1 italic">"{absence.comments}"</p>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(absence.id)}
                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <Plus className="text-brand-500" /> Nuevo Reporte de Ausencia
                            </h3>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2 col-span-2">
                                        <label className="text-sm font-bold text-slate-700 ml-1">Tipo de Ausencia</label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { id: 'VACATION', label: 'Vacaciones', icon: Plane, color: 'text-blue-500', bg: 'bg-blue-50' },
                                                { id: 'MEDICAL_LEAVE', label: 'Licencia', icon: Thermometer, color: 'text-red-500', bg: 'bg-red-50' },
                                                { id: 'OTHER', label: 'Otro', icon: Activity, color: 'text-slate-500', bg: 'bg-slate-50' }
                                            ].map(opt => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => setNewType(opt.id as AbsenceType)}
                                                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${newType === opt.id ? 'border-brand-500 bg-brand-50/20' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                                                >
                                                    <opt.icon size={20} className={opt.color} />
                                                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{opt.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 ml-1">Fecha Inicio</label>
                                        <input
                                            type="date"
                                            required
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 ml-1">Fecha Término</label>
                                        <input
                                            type="date"
                                            required
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                        />
                                    </div>

                                    <div className="space-y-2 col-span-2">
                                        <label className="text-sm font-bold text-slate-700 ml-1">Comentarios (Opcional)</label>
                                        <textarea
                                            placeholder="Indique motivo o detalles adicionales..."
                                            value={comments}
                                            onChange={(e) => setComments(e.target.value)}
                                            rows={3}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all resize-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving || !startDate || !endDate}
                                        className="flex-1 bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 transition-all shadow-lg active:scale-95 flex justify-center items-center gap-2"
                                    >
                                        {saving && <Loader2 className="animate-spin" size={18} />}
                                        {saving ? 'Guardando...' : 'Confirmar Reporte'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex items-center gap-3">
                    <div className="p-1.5 bg-blue-100 rounded text-blue-600">
                        <AlertCircle size={14} />
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                        Nota: Al marcar un técnico como ausente durante un rango de fechas, el sistema lo excluirá automáticamente de los reportes operativos y operativos de cumplimiento durante dicho periodo.
                    </p>
                </div>
            </div>
        </div>
    );
};
