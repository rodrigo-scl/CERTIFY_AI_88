// Componente de Matriz de Permisos por Rol - Rodrigo Osorio v1.0
// Muestra y permite gestionar dinámicamente los permisos en la base de datos

import React, { useState, useEffect } from 'react';
import {
    Shield, Eye, Edit, Trash2, Upload, Download, Users, Building2,
    FileText, Settings, ChartBar, Lock, CheckCircle, XCircle, MinusCircle,
    Loader2, AlertCircle, RefreshCw
} from 'lucide-react';
import { getRoleConfigs, getRolePermissions, toggleRolePermission } from '../services/dataService';
import { RoleConfig, RolePermission } from '../types';

// Definición de estructura de permisos y sus llaves de base de datos
const PERMISSION_STRUCTURE = [
    {
        category: 'Técnicos',
        icon: Users,
        items: [
            { name: 'Ver técnicos', key: 'view_technicians' },
            { name: 'Crear técnicos', key: 'create_technicians' },
            { name: 'Editar técnicos', key: 'edit_technicians' },
            { name: 'Eliminar técnicos', key: 'delete_technicians' },
            { name: 'Cargar documentos', key: 'upload_docs_technician' },
            { name: 'Descargar documentos', key: 'download_docs_technician' },
        ]
    },
    {
        category: 'Empresas',
        icon: Building2,
        items: [
            { name: 'Ver empresas', key: 'view_companies' },
            { name: 'Crear empresas', key: 'create_companies' },
            { name: 'Editar empresas', key: 'edit_companies' },
            { name: 'Eliminar empresas', key: 'delete_companies' },
            { name: 'Gestionar requisitos', key: 'manage_requirements' },
        ]
    },
    {
        category: 'Documentos',
        icon: FileText,
        items: [
            { name: 'Ver documentos', key: 'view_documents' },
            { name: 'Subir documentos', key: 'upload_documents' },
            { name: 'Eliminar documentos', key: 'delete_documents' },
            { name: 'Certificar en portal', key: 'certify_portal' },
        ]
    },
    {
        category: 'Configuración',
        icon: Settings,
        items: [
            { name: 'Ver parámetros', key: 'view_parameters' },
            { name: 'Editar parámetros', key: 'edit_parameters' },
            { name: 'Gestionar usuarios', key: 'manage_users' },
            { name: 'Ver auditoría', key: 'view_audit' },
        ]
    },
    {
        category: 'Seguridad',
        icon: Lock,
        items: [
            { name: 'Ver contraseñas de portales', key: 'view_portal_passwords' },
            { name: 'Ver log de accesos', key: 'view_access_logs' },
            { name: 'Bloquear técnicos', key: 'block_technicians' },
        ]
    },
    {
        category: 'Reportes',
        icon: ChartBar,
        items: [
            { name: 'Ver dashboard', key: 'view_dashboard' },
            { name: 'Descargar reportes', key: 'download_reports' },
            { name: 'Usar asistente IA', key: 'use_ai' },
        ]
    },
];

interface RolePermissionsMatrixProps {
    className?: string;
}

export const RolePermissionsMatrix: React.FC<RolePermissionsMatrixProps> = ({ className = '' }) => {
    const [roles, setRoles] = useState<RoleConfig[]>([]);
    const [permissions, setPermissions] = useState<RolePermission[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null); // roleId-permKey

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [rData, pData] = await Promise.all([
            getRoleConfigs(),
            getRolePermissions()
        ]);
        setRoles(rData);
        setPermissions(pData);
        setLoading(false);
    };

    const hasPermission = (roleId: string, permKey: string) => {
        return permissions.some(p => p.roleId === roleId && p.permissionKey === permKey && p.enabled);
    };

    const handleToggle = async (roleId: string, permKey: string) => {
        // Prevención: No deshabilitar permisos esenciales de Superadministrador para evitar lock-out
        if (roleId === 'Superadministrador') {
            alert('No se pueden modificar los permisos del Superadministrador por razones de seguridad.');
            return;
        }

        const currentState = hasPermission(roleId, permKey);
        const updateKey = `${roleId}-${permKey}`;

        setUpdating(updateKey);
        const result = await toggleRolePermission(roleId, permKey, !currentState);

        if (result.success) {
            // Actualización optimista local
            setPermissions(prev => {
                const filtered = prev.filter(p => !(p.roleId === roleId && p.permissionKey === permKey));
                return [...filtered, { roleId, permissionKey: permKey, enabled: !currentState }];
            });
        } else {
            alert('Error al actualizar permiso: ' + result.error);
        }
        setUpdating(null);
    };

    if (loading) {
        return (
            <div className={`bg-white rounded-xl shadow-sm border border-slate-100 p-12 flex flex-col items-center justify-center ${className}`}>
                <Loader2 size={32} className="text-brand-600 animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Cargando matriz de permisos...</p>
            </div>
        );
    }

    return (
        <div className={`bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Shield size={20} className="text-brand-600" />
                        Matriz de Permisos Dinámica
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Gestiona en tiempo real los accesos y capacidades de cada rol
                    </p>
                </div>
                <button
                    onClick={loadData}
                    className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all"
                    title="Refrescar datos"
                >
                    <RefreshCw size={18} />
                </button>
            </div>

            {/* Role Cards */}
            <div className="p-6 border-b border-slate-100 bg-slate-50">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                    {roles.map(role => (
                        <div
                            key={role.id}
                            className={`p-3 rounded-lg border-2 bg-white text-center transition-all
                                ${role.color === 'purple' ? 'border-purple-200 bg-purple-50/30' : ''}
                                ${role.color === 'blue' ? 'border-blue-200 bg-blue-50/30' : ''}
                                ${role.color === 'indigo' ? 'border-indigo-200 bg-indigo-50/30' : ''}
                                ${role.color === 'green' ? 'border-green-200 bg-green-50/30' : ''}
                                ${role.color === 'amber' ? 'border-amber-200 bg-amber-50/30' : ''}
                                ${role.color === 'slate' ? 'border-slate-200 bg-slate-50/30' : ''}
                            `}
                        >
                            <div className={`text-sm font-bold
                                ${role.color === 'purple' ? 'text-purple-700' : ''}
                                ${role.color === 'blue' ? 'text-blue-700' : ''}
                                ${role.color === 'indigo' ? 'text-indigo-700' : ''}
                                ${role.color === 'green' ? 'text-green-700' : ''}
                                ${role.color === 'amber' ? 'text-amber-700' : ''}
                                ${role.color === 'slate' ? 'text-slate-700' : ''}
                            `}>{role.name}</div>
                            <div className="text-[10px] text-slate-500 mt-1 uppercase font-semibold tracking-wider">{role.id === 'Superadministrador' ? '🔒 Bloqueado' : '⚡ Editable'}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Permissions Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-4 text-left font-bold w-72">Categoría / Permiso</th>
                            {roles.map(role => (
                                <th key={role.id} className="px-2 py-4 text-center font-bold text-[10px] uppercase tracking-tighter">
                                    <div className="flex flex-col items-center">
                                        <span className="hidden lg:inline">{role.name}</span>
                                        <span className="lg:hidden">{role.name.substring(0, 3)}</span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {PERMISSION_STRUCTURE.map((category, catIndex) => (
                            <React.Fragment key={category.category}>
                                {/* Category Header */}
                                <tr className="bg-slate-50/50">
                                    <td colSpan={roles.length + 1} className="px-6 py-2.5">
                                        <div className="flex items-center gap-2 font-black text-[11px] text-slate-500 uppercase tracking-widest">
                                            <category.icon size={14} className="text-brand-500" />
                                            {category.category}
                                        </div>
                                    </td>
                                </tr>
                                {/* Permission Rows */}
                                {category.items.map((item, itemIndex) => (
                                    <tr
                                        key={item.key}
                                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                                    >
                                        <td className="px-6 py-3 text-slate-700 pl-12 font-medium">{item.name}</td>
                                        {roles.map(role => {
                                            const enabled = hasPermission(role.id, item.key);
                                            const isUpdating = updating === `${role.id}-${item.key}`;
                                            const isSuper = role.id === 'Superadministrador';

                                            return (
                                                <td
                                                    key={role.id}
                                                    className={`px-2 py-3 text-center ${isSuper ? 'bg-slate-50/30' : 'cursor-pointer'}`}
                                                    onClick={() => !isSuper && !isUpdating && handleToggle(role.id, item.key)}
                                                >
                                                    <div className="flex items-center justify-center relative">
                                                        {isUpdating ? (
                                                            <Loader2 size={18} className="text-brand-500 animate-spin" />
                                                        ) : enabled ? (
                                                            <CheckCircle
                                                                size={20}
                                                                className={`transition-all ${isSuper ? 'text-slate-400' : 'text-green-500 hover:scale-110'}`}
                                                            />
                                                        ) : (
                                                            <MinusCircle
                                                                size={20}
                                                                className={`transition-all ${isSuper ? 'text-slate-200' : 'text-slate-300 hover:text-red-400 hover:scale-110'}`}
                                                            />
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Legend & Help */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-6 text-xs font-semibold text-slate-500">
                    <div className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-500" />
                        <span>Habilitado</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <MinusCircle size={16} className="text-slate-300" />
                        <span>Inhabilitado</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Loader2 size={16} className="text-brand-500" />
                        <span>Sincronizando</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full font-bold uppercase border border-amber-100">
                    <AlertCircle size={12} />
                    Los cambios se aplican instantáneamente a todos los usuarios
                </div>
            </div>
        </div>
    );
};

export default RolePermissionsMatrix;

