// Rodrigo Osorio v0.2 - Módulo de Disponibilidad Operativa (con feriados)
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Download, Filter, Calendar, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import {
    getTechnicians, getBranches, getCompanies, getActiveAbsences, getHolidays
} from '../services/dataService';
import { Technician, Branch, Company, Holiday } from '../types';
import { supabase } from '../services/supabaseClient';
import { Skeleton } from '../components/shared/Skeleton';

// Tipos de estado de disponibilidad (numérico)
type AvailabilityStatus = '1' | '2' | '3' | '4' | '5' | '6';

interface TechnicianAvailability {
    technicianId: string;
    technicianName: string;
    branchName: string;
    companyNames: string[];
    dailyStatus: { [date: string]: AvailabilityStatus };
}

interface AbsenceRecord {
    technicianId: string;
    type: string;
    startDate: string;
    endDate: string;
}

interface CredentialExpiry {
    technicianId: string;
    documentTypeName: string;
    expiryDate: string;
}

// Leyenda de estados (orden lógico solicitado por usuario)
const STATUS_LEGEND: { code: AvailabilityStatus; label: string; color: string }[] = [
    { code: '1', label: 'Disponible y Acreditado', color: 'bg-emerald-50 text-emerald-700' },
    { code: '2', label: 'Sin Acreditación Futura (vence en período)', color: 'bg-orange-100 text-orange-700' },
    { code: '3', label: 'No Disponible - Sin Acreditación', color: 'bg-red-100 text-red-700' },
    { code: '4', label: 'No Disponible - Vacaciones', color: 'bg-amber-50 text-amber-700' },
    { code: '5', label: 'No Disponible - Licencia Médica', color: 'bg-rose-50 text-rose-700' },
    { code: '6', label: 'No Disponible - Otros', color: 'bg-slate-100 text-slate-600' },
];

// Utilidad para generar rango de fechas
const generateDateRange = (days: number): string[] => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
};

// Formatear fecha para display - solo día
const formatDay = (dateStr: string): number => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.getDate();
};

// Formatear fecha para display - solo mes
const formatMonth = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleString('es-CL', { month: 'short' }).toUpperCase();
};

// Obtener día de la semana
const getDayOfWeek = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleString('es-CL', { weekday: 'short' }).toUpperCase();
};

export const Availability = () => {
    const [loading, setLoading] = useState(true);
    const [technicians, setTechnicians] = useState<Technician[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
    const [credentialExpiries, setCredentialExpiries] = useState<CredentialExpiry[]>([]);

    // Filtros
    const [periodDays, setPeriodDays] = useState<15 | 30 | 60 | 90>(30);
    const [branchFilter, setBranchFilter] = useState<string>('all');
    const [companyFilter, setCompanyFilter] = useState<string>('all');
    const [technicianFilter, setTechnicianFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<AvailabilityStatus | 'all'>('all');
    const [showLegend, setShowLegend] = useState(false);
    const [holidays, setHolidays] = useState<Holiday[]>([]);

    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    // Cargar datos
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [techs, branchList, companyList, holidayList] = await Promise.all([
                    getTechnicians(),
                    getBranches(),
                    getCompanies(),
                    getHolidays()
                ]);

                const todayStr = new Date().toLocaleDateString('sv-SE');
                // Obtener todas las ausencias (no solo las activas hoy)
                const { data: allAbsences } = await supabase
                    .from('technician_absences')
                    .select('*')
                    .gte('end_date', todayStr);

                // Obtener vencimientos de credenciales
                const maxDate = new Date();
                maxDate.setDate(maxDate.getDate() + 90);
                const { data: expiries } = await supabase
                    .from('credentials')
                    .select(`
            technician_id,
            expiry_date,
            document_types (name)
          `)
                    .lte('expiry_date', maxDate.toISOString().split('T')[0])
                    .gte('expiry_date', todayStr);

                setTechnicians(techs);
                setBranches(branchList);
                setCompanies(companyList);
                setHolidays(holidayList);
                setAbsences((allAbsences || []).map(a => ({
                    technicianId: a.technician_id,
                    type: a.type,
                    startDate: a.start_date,
                    endDate: a.end_date
                })));
                setCredentialExpiries((expiries || []).map(e => ({
                    technicianId: e.technician_id,
                    documentTypeName: (e.document_types as any)?.name || '',
                    expiryDate: e.expiry_date
                })));
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // Generar rango de fechas basado en el período seleccionado
    const dateRange = useMemo(() => generateDateRange(periodDays), [periodDays]);

    // Rodrigo Osorio v0.16 - Determinar tipo de día (H=Hábil, F=Feriado, FDS=Fin de Semana)
    const getDayType = useCallback((dateStr: string): 'H' | 'F' | 'FDS' => {
        const date = new Date(dateStr + 'T00:00:00');
        const dayOfWeek = date.getDay();
        const isHoliday = holidays.some(h => h.date === dateStr);

        if (isHoliday) return 'F';
        if (dayOfWeek === 0 || dayOfWeek === 6) return 'FDS'; // Domingo o Sábado
        return 'H';
    }, [holidays]);

    // Calcular disponibilidad
    const availabilityData = useMemo((): TechnicianAvailability[] => {
        // Filtrar técnicos
        let filteredTechs = technicians;

        if (branchFilter !== 'all') {
            filteredTechs = filteredTechs.filter(t => t.branchId === branchFilter);
        }

        if (companyFilter !== 'all') {
            filteredTechs = filteredTechs.filter(t => t.companyIds?.includes(companyFilter));
        }

        if (technicianFilter !== 'all') {
            filteredTechs = filteredTechs.filter(t => t.id === technicianFilter);
        }

        return filteredTechs.map(tech => {
            // Empresas del técnico (filtradas si hay filtro de empresa)
            const techCompanyIds = tech.companyIds || [];
            const techCompanyNames = companyFilter !== 'all'
                ? companies.filter(c => c.id === companyFilter).map(c => c.name)
                : companies.filter(c => techCompanyIds.includes(c.id)).map(c => c.name);

            // Calcular estado para cada día
            const dailyStatus: { [date: string]: AvailabilityStatus } = {};

            dateRange.forEach(date => {
                // 1. Verificar si está actualmente sin acreditación
                if (tech.overallStatus === 'EXPIRED' || tech.overallStatus === 'MISSING' || tech.overallStatus === 'PENDING') {
                    dailyStatus[date] = '3'; // Sin Acreditación
                    return;
                }

                // 2. Verificar si tiene credencial que vence en o antes de esta fecha
                const expiringCred = credentialExpiries.find(e =>
                    e.technicianId === tech.id && e.expiryDate <= date
                );
                if (expiringCred) {
                    dailyStatus[date] = '2'; // Sin Acreditación Futura
                    return;
                }

                // 3. Verificar ausencias
                const absenceForDate = absences.find(a =>
                    a.technicianId === tech.id &&
                    a.startDate <= date &&
                    a.endDate >= date
                );

                if (absenceForDate) {
                    switch (absenceForDate.type) {
                        case 'VACATION':
                            dailyStatus[date] = '4'; // Vacaciones
                            break;
                        case 'MEDICAL_LEAVE':
                            dailyStatus[date] = '5'; // Licencia Médica
                            break;
                        default:
                            dailyStatus[date] = '6'; // Otros
                    }
                    return;
                }

                // 4. Si pasa todas las verificaciones, está disponible
                dailyStatus[date] = '1'; // Disponible y Acreditado
            });

            return {
                technicianId: tech.id,
                technicianName: tech.name,
                branchName: tech.branch || 'Sin Sucursal',
                companyNames: techCompanyNames,
                dailyStatus
            };
        });
    }, [technicians, companies, absences, credentialExpiries, dateRange, branchFilter, companyFilter, technicianFilter]);

    // Filtrar por estado (después del cálculo de disponibilidad)
    const filteredAvailabilityData = useMemo(() => {
        if (statusFilter === 'all') return availabilityData;

        // Filtrar técnicos que tengan al menos un día con el estado seleccionado
        return availabilityData.filter(tech =>
            Object.values(tech.dailyStatus).some(status => status === statusFilter)
        );
    }, [availabilityData, statusFilter]);

    // Calcular totales por día (usando datos filtrados)
    const dailyTotals = useMemo(() => {
        const totals: { [date: string]: number } = {};
        dateRange.forEach(date => {
            totals[date] = filteredAvailabilityData.filter(t => t.dailyStatus[date] === '1').length;
        });
        return totals;
    }, [filteredAvailabilityData, dateRange]);

    // Paginación
    const totalPages = Math.ceil(filteredAvailabilityData.length / itemsPerPage);
    const paginatedData = filteredAvailabilityData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Resetear página cuando cambian los filtros
    useEffect(() => {
        setCurrentPage(1);
    }, [branchFilter, companyFilter, technicianFilter, statusFilter]);

    // Exportar a CSV - Rodrigo Osorio v0.2: Agregada compatibilidad con Excel (BOM) y sanitización de comas
    const exportToCSV = useCallback(() => {
        // Sanitizar campos para evitar que los delimitadores rompan el CSV
        // Usamos punto y coma (;) por ser el estándar de Excel en sistemas en español (Chile/Latam)
        const delimiter = ';';
        const sanitize = (val: any) => {
            const str = String(val ?? '');
            // Escapar comillas dobles duplicándolas y envolver en comillas
            return `"${str.replace(/"/g, '""')}"`;
        };

        const headers = [
            sanitize('Técnico'),
            sanitize('Sucursal'),
            sanitize('Empresas'),
            ...dateRange.map(d => sanitize(`${formatDay(d)} ${formatMonth(d)}`))
        ];

        const rows = filteredAvailabilityData.map(t => [
            sanitize(t.technicianName),
            sanitize(t.branchName),
            sanitize(t.companyNames.join('; ')),
            ...dateRange.map(d => sanitize(t.dailyStatus[d] || '1')) // Default a 1 si por algún motivo no hay status
        ]);

        // Añadir fila de totales
        rows.push([
            sanitize('TOTAL DISPONIBLES'),
            sanitize(''),
            sanitize(''),
            ...dateRange.map(d => sanitize(dailyTotals[d]?.toString() || '0'))
        ]);

        // Fila de leyenda para explicar los códigos
        const legendText = 'LEYENDA: ' + STATUS_LEGEND.map(s => `${s.code}=${s.label}`).join(' | ');
        const legendRow = [sanitize(legendText)];

        // Rodrigo Osorio v0.16 - Fila de tipo de día (H/F/FDS)
        const dayTypeRow = [
            sanitize('TIPO DÍA'),
            sanitize(''),
            sanitize(''),
            ...dateRange.map(d => sanitize(getDayType(d)))
        ];

        // Unir con el delimitador seleccionado y usar saltos de línea Windows (\r\n) para máxima compatibilidad
        const csvContent = [legendRow, headers, dayTypeRow, ...rows].map(row => row.join(delimiter)).join('\r\n');

        // Agregar BOM (Byte Order Mark) para que Excel reconozca el archivo como UTF-8
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `disponibilidad_${new Date().toLocaleDateString('sv-SE')}.csv`;
        link.click();
    }, [availabilityData, dateRange, dailyTotals, getDayType]);

    // Obtener color para el estado
    const getStatusStyle = (status: AvailabilityStatus): string => {
        const found = STATUS_LEGEND.find(s => s.code === status);
        return found ? found.color : 'bg-slate-50 text-slate-500';
    };

    if (loading) {
        return (
            <div className="space-y-6 p-4">
                <Skeleton height={60} />
                <Skeleton height={400} />
            </div>
        );
    }

    return (
        <div className="space-y-3 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                    <h1 className="text-xl font-black text-slate-900">Disponibilidad Operativa</h1>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Capacidad por técnico</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-all"
                    >
                        <Download size={14} /> Exportar CSV
                    </button>
                </div>
            </div>

            {/* Leyenda - Ahora clicable para filtrar */}
            <div className="bg-white rounded-xl p-4 border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estados de Disponibilidad</p>
                    {statusFilter !== 'all' && (
                        <button
                            onClick={() => setStatusFilter('all')}
                            className="text-xs text-brand-600 hover:text-brand-700 font-bold underline"
                        >
                            Limpiar filtro
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap gap-3">
                    {STATUS_LEGEND.map(s => (
                        <button
                            key={s.code}
                            onClick={() => setStatusFilter(s.code)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all hover:ring-2 hover:ring-brand-500 hover:scale-105 ${s.color} ${statusFilter === s.code ? 'ring-2 ring-brand-600 font-black shadow-lg' : ''
                                }`}
                        >
                            <span className="font-black">{s.code}</span>
                            <span className="font-medium opacity-80">=</span>
                            <span className="font-medium">{s.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Filtros - Compactos */}
            <div className="bg-white rounded-xl p-2 border border-slate-100">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1">
                        <Filter size={12} className="text-slate-400" />
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Filtros</span>
                    </div>

                    <div className="flex items-center gap-1">
                        <Calendar size={12} className="text-slate-400" />
                        <select
                            value={periodDays}
                            onChange={(e) => setPeriodDays(Number(e.target.value) as any)}
                            className="px-2 py-1 border border-slate-200 rounded-lg text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                        >
                            <option value={15}>15 d</option>
                            <option value={30}>30 d</option>
                            <option value={60}>60 d</option>
                            <option value={90}>90 d</option>
                        </select>
                    </div>

                    <select
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                        className="px-2 py-1 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    >
                        <option value="all">Sucursal: Todas</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>

                    <select
                        value={companyFilter}
                        onChange={(e) => setCompanyFilter(e.target.value)}
                        className="px-2 py-1 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    >
                        <option value="all">Empresa: Todas</option>
                        {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>

                    <select
                        value={technicianFilter}
                        onChange={(e) => setTechnicianFilter(e.target.value)}
                        className="px-2 py-1 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white max-w-[150px]"
                    >
                        <option value="all">Técnico: Todos</option>
                        {technicians.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tabla de Disponibilidad con scrollbar visible */}
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar" style={{
                    scrollbarWidth: 'auto',
                    scrollbarColor: '#cbd5e1 #f1f5f9'
                }}>
                    <style>{`
                        .custom-scrollbar::-webkit-scrollbar {
                            height: 12px;
                            width: 12px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-track {
                            background: #f1f5f9;
                            border-radius: 6px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb {
                            background: #cbd5e1;
                            border-radius: 6px;
                            border: 2px solid #f1f5f9;
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                            background: #94a3b8;
                        }
                    `}</style>
                    <table className="w-full text-sm">
                        <thead>
                            {/* Fila de indicadores H/F/FDS - Rodrigo Osorio v0.16 */}
                            <tr className="bg-slate-100 border-b border-slate-200">
                                <th className="sticky left-0 bg-slate-100 z-10 px-2 py-1"></th>
                                <th className="px-0.5 py-1"></th>
                                <th className="px-0.5 py-1"></th>
                                {dateRange.map(date => {
                                    const type = getDayType(date);
                                    return (
                                        <th key={`type-${date}`} className="px-0.5 py-1 text-center">
                                            <span className={`text-[9px] font-black ${type === 'F' ? 'text-red-600 bg-red-50 px-1 py-0.5 rounded' :
                                                type === 'FDS' ? 'text-slate-400' :
                                                    'text-emerald-600'
                                                }`}>
                                                {type}
                                            </span>
                                        </th>
                                    );
                                })}
                            </tr>
                            {/* Fila de fechas */}
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="sticky left-0 bg-slate-50 z-10 px-2 py-1 text-left text-[8px] font-black text-slate-500 uppercase tracking-widest min-w-[180px]">
                                    Técnico
                                </th>
                                <th className="px-0.5 py-1 text-left text-[8px] font-black text-slate-500 uppercase tracking-widest min-w-[70px]">
                                    Sucursal
                                </th>
                                <th className="px-0.5 py-1 text-left text-[8px] font-black text-slate-500 uppercase tracking-widest min-w-[90px]">
                                    Empresas
                                </th>
                                {dateRange.map(date => {
                                    const dayOfWeek = getDayOfWeek(date);
                                    const dayType = getDayType(date);
                                    const isWeekend = dayOfWeek === 'SAB' || dayOfWeek === 'DOM';
                                    const isHoliday = dayType === 'F';
                                    const isRedDay = dayOfWeek === 'DOM' || isHoliday;
                                    return (
                                        <th
                                            key={date}
                                            className={`px-0 py-1 text-center text-[7px] font-black uppercase tracking-tight min-w-[35px] ${isWeekend || isHoliday ? 'bg-slate-100' : ''}`}
                                        >
                                            <div className={isRedDay ? 'text-red-500' : isWeekend ? 'text-slate-400' : 'text-slate-500'}>
                                                {dayOfWeek}
                                            </div>
                                            <div className={`text-[10px] font-black ${isRedDay ? 'text-red-500' : 'text-slate-700'}`}>
                                                {formatDay(date)}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={3 + dateRange.length} className="px-4 py-12 text-center text-sm text-slate-400">
                                        No hay técnicos que coincidan con los filtros seleccionados
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {paginatedData.map(tech => (
                                        <tr key={tech.technicianId} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="sticky left-0 bg-white z-10 px-2 py-0.5 font-bold text-slate-700 text-[11px] leading-tight whitespace-nowrap">
                                                {tech.technicianName}
                                            </td>
                                            <td className="px-1 py-0.5 text-slate-500 text-[9px] leading-tight">
                                                {tech.branchName}
                                            </td>
                                            <td className="px-1 py-0.5 text-slate-500 text-[9px] leading-tight truncate max-w-[90px]" title={tech.companyNames.join(', ')}>
                                                {tech.companyNames.length > 0 ? tech.companyNames.join(', ') : '-'}
                                            </td>
                                            {dateRange.map(date => (
                                                <td
                                                    key={date}
                                                    className={`px-0.5 py-0.5 text-center ${getDayOfWeek(date) === 'SAB' || getDayOfWeek(date) === 'DOM'
                                                        ? 'bg-slate-50'
                                                        : ''
                                                        }`}
                                                >
                                                    <span className={`inline-block px-1 py-0 rounded text-[9px] font-black ${getStatusStyle(tech.dailyStatus[date])}`}>
                                                        {tech.dailyStatus[date]}
                                                    </span>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}

                                    {/* Fila de Totales - Compacta */}
                                    <tr className="bg-slate-50 border-t-2 border-slate-200 font-black">
                                        <td className="sticky left-0 bg-slate-50 z-10 px-2 py-1 text-slate-700 text-[9px] uppercase tracking-widest">
                                            TOTAL
                                        </td>
                                        <td className="px-1 py-1"></td>
                                        <td className="px-1 py-1"></td>
                                        {dateRange.map(date => (
                                            <td
                                                key={date}
                                                className={`px-0.5 py-1 text-center ${getDayOfWeek(date) === 'SAB' || getDayOfWeek(date) === 'DOM'
                                                    ? 'bg-slate-100'
                                                    : ''
                                                    }`}
                                            >
                                                <span className={`inline-block px-1 py-0 rounded text-[9px] font-black ${dailyTotals[date] === 0 ? 'bg-red-100 text-red-700' :
                                                    dailyTotals[date] <= 2 ? 'bg-amber-100 text-amber-700' :
                                                        'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                    {dailyTotals[date]}
                                                </span>
                                            </td>
                                        ))}
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Controles de paginación */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                        <div className="text-xs text-slate-500 font-medium">
                            Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredAvailabilityData.length)} de {filteredAvailabilityData.length} técnicos
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                « Primera
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                ‹ Anterior
                            </button>
                            <span className="px-4 py-1.5 text-xs font-bold text-slate-700">
                                Página {currentPage} de {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                Siguiente ›
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                Última »
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Availability;
