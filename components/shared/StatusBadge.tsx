// Optimizado por Rodrigo Osorio - v0.1: Componentes memoizados para evitar re-renders innecesarios
import React, { memo } from 'react';
import { ComplianceStatus } from '../../types';

// Constantes fuera del componente para evitar recreacion en cada render
const STATUS_STYLES = {
  [ComplianceStatus.VALID]: "bg-green-100 text-green-700 border-green-200",
  [ComplianceStatus.EXPIRING_SOON]: "bg-yellow-100 text-yellow-800 border-yellow-200",
  [ComplianceStatus.EXPIRED]: "bg-red-100 text-red-700 border-red-200",
  [ComplianceStatus.MISSING]: "bg-red-50 text-red-600 border-red-100",
  [ComplianceStatus.PENDING]: "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_LABELS = {
  [ComplianceStatus.VALID]: "Válido",
  [ComplianceStatus.EXPIRING_SOON]: "Por Vencer",
  [ComplianceStatus.EXPIRED]: "Vencido",
  [ComplianceStatus.MISSING]: "Faltante",
  [ComplianceStatus.PENDING]: "Pendiente",
};

export const StatusBadge = memo(({ status, hideLabel = false }: { status: ComplianceStatus; hideLabel?: boolean }) => {
  if (hideLabel) {
    // Solo mostrar un indicador de color sin texto
    const dotColors: Record<ComplianceStatus, string> = {
      [ComplianceStatus.VALID]: "bg-green-500",
      [ComplianceStatus.EXPIRING_SOON]: "bg-yellow-500",
      [ComplianceStatus.EXPIRED]: "bg-red-500",
      [ComplianceStatus.MISSING]: "bg-red-400",
      [ComplianceStatus.PENDING]: "bg-slate-400",
    };
    return (
      <span className={`w-3 h-3 rounded-full ${dotColors[status]} ring-2 ring-slate-900`} />
    );
  }

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
});

export const ScoreBadge = memo(({ score }: { score: number }) => {
  let colorClass = "bg-green-100 text-green-700";
  if (score < 50) colorClass = "bg-red-100 text-red-700";
  else if (score < 90) colorClass = "bg-yellow-100 text-yellow-800";

  return (
    <span className={`px-2 py-1 rounded-md text-xs font-bold ${colorClass}`}>
      {score}%
    </span>
  );
});