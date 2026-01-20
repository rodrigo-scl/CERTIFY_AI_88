// Rodrigo Osorio v0.20 - Reporte de Auditoría Integral (Descargas + Contraseñas)
import React, { useEffect, useState } from 'react';
import {
    Shield, Clock, Mail, FileText, Search, Download,
    ShieldCheck, AlertCircle, Loader2, Key, Eye, User,
    ExternalLink, Calendar
} from 'lucide-react';
import { getDownloadAudits } from '../services/dataService';
import { getPasswordAccessLogs, PasswordAccessLog } from '../services/auditService';
import { useAuth } from '../context/AuthContext';
import { AuditLog } from '../types';
import { formatTimestampToLocal } from '../services/dateUtils';

type AuditTab = 'downloads' | 'passwords';

export const AuditLogs = () => {
    const { isAdmin } = useAuth();
    const [activeTab, setActiveTab] = useState<AuditTab>('downloads');
    const [downloadLogs, setDownloadLogs] = useState<AuditLog[]>([]);
    const [passwordLogs, setPasswordLogs] = useState<PasswordAccessLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'downloads') {
                const data = await getDownloadAudits();
                setDownloadLogs(data);
            } else {
                const data = await getPasswordAccessLogs();
                setPasswordLogs(data);
            }
        } catch (error) {
            console.error(`Error loading ${activeTab} logs:`, error);
        } finally {
            setLoading(false);
        }
    };

    const filteredDownloadLogs = downloadLogs.filter(log =>
        log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.resourceName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredPasswordLogs = passwordLogs.filter(log =>
        log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entityName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isAdmin) {
        return (
            <div className="flex h-[400px] items-center justify-center p-6 text-center">
                <div className="max-w-md">
                    <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Acceso Denegado</h2>
                    <p className="text-slate-500">Solo los administradores tienen permiso para ver los registros de auditoría de seguridad.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="text-brand-600" /> Centro de Auditoría
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Supervisión de seguridad y acceso a datos sensibles.</p>
                </div>

                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                <button
                    onClick={() => { setActiveTab('downloads'); setSearchTerm(''); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'downloads' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <FileText size={16} /> Descargas de Documentos
                </button>
                <button
                    onClick={() => { setActiveTab('passwords'); setSearchTerm(''); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'passwords' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Key size={16} /> Acceso a Contraseñas
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha y Hora</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuario</th>
                                {activeTab === 'downloads' ? (
                                    <>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Acción</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Recurso</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Portal/Entidad</th>
                                    </>
                                )}
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-6 py-8 h-16 bg-slate-50/10"></td>
                                    </tr>
                                ))
                            ) : (activeTab === 'downloads' ? filteredDownloadLogs : filteredPasswordLogs).length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                                        No se encontraron registros de auditoría.
                                    </td>
                                </tr>
                            ) : activeTab === 'downloads' ? (
                                filteredDownloadLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-sm text-slate-700">
                                                <Clock size={14} className="text-slate-400" />
                                                {formatTimestampToLocal(log.createdAt)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-[10px]">
                                                    {log.userEmail.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="text-sm font-medium text-slate-900">{log.userEmail}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${log.actionType === 'DOWNLOAD_ZIP' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {log.actionType === 'DOWNLOAD_ZIP' ? 'ZIP' : 'Archivo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 max-w-xs">
                                            <div className="flex items-center gap-2 text-sm text-slate-700 truncate" title={log.resourceName}>
                                                <FileText size={14} className="text-slate-400" />
                                                {log.resourceName}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-1 text-[10px] text-brand-600 font-bold bg-brand-50 px-2 py-0.5 rounded border border-brand-100">
                                                <ShieldCheck size={12} /> ENCRIPTADO
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                filteredPasswordLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-sm text-slate-700">
                                                <Calendar size={14} className="text-slate-400" />
                                                {formatTimestampToLocal(log.accessedAt)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-[10px]">
                                                    {log.userName?.charAt(0).toUpperCase() || <User size={12} />}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-slate-900">{log.userName}</div>
                                                    <div className="text-[10px] text-slate-400">{log.userEmail}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600">
                                                <Eye size={12} /> REVELAR PW
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 max-w-xs">
                                            <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                                                <ExternalLink size={14} className="text-slate-400" />
                                                {log.entityName}
                                            </div>
                                            <div className="text-[10px] text-slate-400">ID: {log.entityId.substring(0, 8)}...</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-1 text-[10px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-100">
                                                <Activity size={12} /> AUDITADO
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 flex gap-4 items-start">
                <ShieldCheck className="text-brand-600 shrink-0 mt-0.5" size={20} />
                <div>
                    <h4 className="text-brand-900 font-bold text-sm">Registro de Auditoría de Alta Fidelidad</h4>
                    <p className="text-brand-800 text-xs mt-1 leading-relaxed">
                        Estos logs son inmutables y registran cada interacción con datos sensibles.
                        {activeTab === 'passwords'
                            ? ' El registro de contraseñas detecta cuándo el campo oculto fue revelado por un usuario.'
                            : ' Los registros de descarga están protegidos con encriptación a nivel de base de datos.'
                        }
                    </p>
                </div>
            </div>
        </div>
    );
};
