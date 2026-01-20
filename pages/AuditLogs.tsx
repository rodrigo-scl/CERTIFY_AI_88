// Rodrigo Osorio v0.17 - Reporte de Auditoría de Descargas (Encriptado)
import React, { useEffect, useState } from 'react';
import { Shield, Clock, Mail, FileText, Search, Download, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { getDownloadAudits } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { AuditLog } from '../types';
import { formatTimestampToLocal } from '../services/dateUtils';

export const AuditLogs = () => {
    const { user, isAdmin } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadLogs = async () => {
            setLoading(true);
            try {
                const data = await getDownloadAudits();
                setLogs(data);
            } catch (error) {
                console.error('Error loading audit logs:', error);
            } finally {
                setLoading(false);
            }
        };

        loadLogs();
    }, []);

    const filteredLogs = logs.filter(log =>
        log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.resourceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.actionType.toLowerCase().includes(searchTerm.toLowerCase())
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="text-brand-600" /> Auditoría de Descargas
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Registro de acceso a documentos sensibles con encriptación AES-256 en base de datos.</p>
                </div>

                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por email o recurso..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha y Hora</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuario</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Acción</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Recurso</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Seguridad</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-6 py-8 h-16 bg-slate-50/10"></td>
                                    </tr>
                                ))
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                                        No se encontraron registros de auditoría.
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-sm text-slate-700">
                                                <Clock size={14} className="text-slate-400" />
                                                {formatTimestampToLocal(log.createdAt)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                                                    {log.userEmail.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="text-sm font-medium text-slate-900">{log.userEmail}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${log.actionType === 'DOWNLOAD_ZIP'
                                                ? 'bg-purple-100 text-purple-700'
                                                : 'bg-emerald-100 text-emerald-700'
                                                }`}>
                                                {log.actionType === 'DOWNLOAD_ZIP' ? 'Carpeta ZIP' : 'Documento Único'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 max-w-xs">
                                            <div className="flex items-center gap-2 text-sm text-slate-700 truncate" title={log.resourceName}>
                                                <FileText size={14} className="text-brand-500" />
                                                {log.resourceName}
                                            </div>
                                            {log.resourcePath && (
                                                <div className="text-[10px] text-slate-400 mt-0.5 truncate">{log.resourcePath}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 text-xs text-brand-600 font-medium bg-brand-50 px-2 py-1 rounded w-fit border border-brand-100">
                                                <Shield size={12} /> AES-256
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
                    <h4 className="text-brand-900 font-bold text-sm">Protección de Datos Activa</h4>
                    <p className="text-brand-800 text-xs mt-1 leading-relaxed">
                        Todos los registros en esta tabla se almacenan de forma irreconocible en la base de datos (encriptados).
                        Solo se desencriptan en la memoria local tras verificar que tu sesión tiene el rol de Administrador.
                    </p>
                </div>
            </div>
        </div>
    );
};
