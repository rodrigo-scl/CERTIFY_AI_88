// Rodrigo Osorio v0.2 - Servicio de Alertas de Cumplimiento (Optimizado con Cache)
import { getTechnicians, getCompanies } from './dataService';
import { getCachedOrFetch, CACHE_KEYS, CACHE_TTL } from './cacheService';
import { logger } from './logger';
import { ComplianceStatus, Technician, Company } from '../types';

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface ComplianceAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  count?: number;
  link?: string;
  dismissable: boolean;
}

// Calcula días hasta vencimiento
const getDaysUntilExpiry = (expiryDate: string): number => {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Genera alertas a partir de los datos (función pura, sin side effects)
const generateAlerts = (technicians: Technician[], companies: Company[]): ComplianceAlert[] => {
  const alerts: ComplianceAlert[] = [];

  // 1. ALERTA CRÍTICA: Técnicos con documentos vencidos
  const techsWithExpired = technicians.filter(t =>
    t.credentials?.some(c => c.status === ComplianceStatus.EXPIRED)
  );
  if (techsWithExpired.length > 0) {
    alerts.push({
      id: 'techs-expired',
      severity: 'CRITICAL',
      title: 'Documentos Vencidos',
      message: `${techsWithExpired.length} técnico${techsWithExpired.length > 1 ? 's' : ''} tiene${techsWithExpired.length > 1 ? 'n' : ''} documentos VENCIDOS`,
      count: techsWithExpired.length,
      link: '/technicians',
      dismissable: true
    });
  }

  // 2. ALERTA ADVERTENCIA: Documentos por vencer esta semana (7 días)
  let docsExpiringSoon = 0;
  technicians.forEach(t => {
    t.credentials?.forEach(c => {
      if (c.expiryDate) {
        const days = getDaysUntilExpiry(c.expiryDate);
        if (days > 0 && days <= 7) {
          docsExpiringSoon++;
        }
      }
    });
  });
  if (docsExpiringSoon > 0) {
    alerts.push({
      id: 'docs-expiring-week',
      severity: 'WARNING',
      title: 'Vencimiento Próximo',
      message: `${docsExpiringSoon} documento${docsExpiringSoon > 1 ? 's' : ''} vence${docsExpiringSoon > 1 ? 'n' : ''} esta semana`,
      count: docsExpiringSoon,
      link: '/technicians',
      dismissable: true
    });
  }

  // 3. ALERTA CRÍTICA: Empresas sin técnicos con 100% cumplimiento
  const companiesWithoutCompliant: string[] = [];
  for (const company of companies) {
    const companyTechs = technicians.filter(t => t.companyIds?.includes(company.id));
    if (companyTechs.length > 0) {
      const compliantTechs = companyTechs.filter(t => t.overallStatus === ComplianceStatus.VALID);
      if (compliantTechs.length === 0) {
        companiesWithoutCompliant.push(company.name);
      }
    }
  }
  if (companiesWithoutCompliant.length > 0) {
    alerts.push({
      id: 'companies-no-compliant',
      severity: 'CRITICAL',
      title: 'Sin Técnicos Válidos',
      message: companiesWithoutCompliant.length === 1
        ? `${companiesWithoutCompliant[0]} no tiene técnicos con 100% cumplimiento`
        : `${companiesWithoutCompliant.length} empresas sin técnicos con 100% cumplimiento`,
      count: companiesWithoutCompliant.length,
      link: '/companies',
      dismissable: true
    });
  }

  // 4. ALERTA ADVERTENCIA: Empresas con bajo cumplimiento (<30%)
  const companiesLowCompliance: Array<{ name: string, pct: number }> = [];
  for (const company of companies) {
    const companyTechs = technicians.filter(t => t.companyIds?.includes(company.id));
    if (companyTechs.length >= 3) {
      const compliantTechs = companyTechs.filter(t => t.overallStatus === ComplianceStatus.VALID);
      const pct = Math.round((compliantTechs.length / companyTechs.length) * 100);
      if (pct > 0 && pct < 30) {
        companiesLowCompliance.push({ name: company.name, pct });
      }
    }
  }
  if (companiesLowCompliance.length > 0) {
    const worst = companiesLowCompliance.sort((a, b) => a.pct - b.pct)[0];
    alerts.push({
      id: 'companies-low-compliance',
      severity: 'WARNING',
      title: 'Bajo Cumplimiento',
      message: companiesLowCompliance.length === 1
        ? `${worst.name} tiene solo ${worst.pct}% de técnicos cumpliendo`
        : `${companiesLowCompliance.length} empresas con menos del 30% de cumplimiento`,
      count: companiesLowCompliance.length,
      link: '/companies',
      dismissable: true
    });
  }

  // 5. ALERTA INFO: Técnicos sin documentos asignados (pendientes)
  const techsWithPending = technicians.filter(t =>
    t.overallStatus === ComplianceStatus.PENDING ||
    t.credentials?.every(c => c.status === ComplianceStatus.PENDING)
  );
  if (techsWithPending.length > 0) {
    alerts.push({
      id: 'techs-pending',
      severity: 'INFO',
      title: 'Documentos Pendientes',
      message: `${techsWithPending.length} técnico${techsWithPending.length > 1 ? 's' : ''} sin documentación completa`,
      count: techsWithPending.length,
      link: '/technicians',
      dismissable: true
    });
  }

  // 6. ALERTA INFO: Documentos por vencer en 30 días
  let docsExpiring30Days = 0;
  technicians.forEach(t => {
    t.credentials?.forEach(c => {
      if (c.status === ComplianceStatus.EXPIRING_SOON) {
        docsExpiring30Days++;
      }
    });
  });
  if (docsExpiring30Days > 0 && docsExpiringSoon === 0) {
    alerts.push({
      id: 'docs-expiring-month',
      severity: 'INFO',
      title: 'Renovaciones Próximas',
      message: `${docsExpiring30Days} documento${docsExpiring30Days > 1 ? 's' : ''} por vencer en los próximos 30 días`,
      count: docsExpiring30Days,
      link: '/technicians',
      dismissable: true
    });
  }

  // Ordenar por severidad: CRITICAL > WARNING > INFO
  const severityOrder: Record<AlertSeverity, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
};

/**
 * Obtiene alertas de cumplimiento usando cache para evitar queries redundantes
 * @param preloadedData - Datos pre-cargados opcionales (para evitar queries si ya tienes los datos)
 */
export const getComplianceAlerts = async (preloadedData?: {
  technicians?: Technician[];
  companies?: Company[];
}): Promise<ComplianceAlert[]> => {
  try {
    // Si hay datos pre-cargados, usarlos directamente
    if (preloadedData?.technicians && preloadedData?.companies) {
      return generateAlerts(preloadedData.technicians, preloadedData.companies);
    }

    // Usar cache para evitar queries redundantes
    const [technicians, companies] = await Promise.all([
      getCachedOrFetch<Technician[]>(
        CACHE_KEYS.TECHNICIANS,
        getTechnicians,
        CACHE_TTL.MEDIUM
      ),
      getCachedOrFetch<Company[]>(
        CACHE_KEYS.COMPANIES,
        getCompanies,
        CACHE_TTL.MEDIUM
      )
    ]);

    return generateAlerts(technicians, companies);

  } catch (error) {
    logger.error('Error fetching compliance alerts', error);
    return [];
  }
};

// Verifica si hay alertas críticas
export const hasCriticalAlerts = async (): Promise<boolean> => {
  const alerts = await getComplianceAlerts();
  return alerts.some(a => a.severity === 'CRITICAL');
};

// Obtiene conteo de alertas por severidad
export const getAlertCounts = async (): Promise<Record<AlertSeverity, number>> => {
  const alerts = await getComplianceAlerts();
  return {
    CRITICAL: alerts.filter(a => a.severity === 'CRITICAL').length,
    WARNING: alerts.filter(a => a.severity === 'WARNING').length,
    INFO: alerts.filter(a => a.severity === 'INFO').length
  };
};
