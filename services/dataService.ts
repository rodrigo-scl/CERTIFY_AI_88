import {
  Technician, Company, Credential, ComplianceStatus, Branch, WorkArea, Industry,
  DocumentType, AppUser, AreaTask, SLAType, TechnicianType, CompanyCredential,
  ServiceProvider, TechnicianServiceProvider, CompanyServiceProvider, SupplierPortal,
  TechnicianAbsence, AbsenceType, AvailabilityStatus, Holiday
} from '../types';
import { supabase } from './supabaseClient';
import { clearCache, CACHE_KEYS, getCachedOrFetch, CACHE_TTL } from './cacheService';
import { encryptText, decryptText } from './cryptoService';
import { logger } from './logger';

// --- HELPER: STATUS CALCULATION ---
const calculateStatus = (expiryDate?: string): ComplianceStatus => {
  if (!expiryDate) return ComplianceStatus.PENDING;
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return ComplianceStatus.EXPIRED;
  else if (diffDays <= 30) return ComplianceStatus.EXPIRING_SOON;
  else return ComplianceStatus.VALID;
};

// --- HELPER: SLA CALCULATION ---
const addBusinessDays = (startDate: Date, days: number): Date => {
  let count = 0;
  let currentDate = new Date(startDate);
  while (count < days) {
    currentDate.setDate(currentDate.getDate() + 1);
    const dayOfWeek = currentDate.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }
  return currentDate;
};

const addCalendarDays = (startDate: Date, days: number): Date => {
  const result = new Date(startDate);
  result.setDate(result.getDate() + days);
  return result;
};

// --- CORE: RECALCULATE & PERSIST STATUS ---
// Optimizado por Rodrigo Osorio - v0.1: Acepta datos pre-cargados para evitar queries redundantes
interface RecalculateOptions {
  docTypes?: DocumentType[];
  companies?: Company[];
}

// Rodrigo Osorio v0.8 - Exportar función para poder recalcular manualmente desde frontend
export const recalculateAndSaveTechnicianStatus = async (
  tech: Technician,
  options: RecalculateOptions = {}
) => {
  // Usar datos pre-cargados si estan disponibles, sino cargar
  const allDocTypes = options.docTypes || await getDocumentTypes();
  const companies = options.companies || await getCompanies();

  const globalDocs = allDocTypes.filter(d => d.isGlobal && d.scope === 'TECHNICIAN').map(d => d.id);
  let allRequiredDocIds = new Set(globalDocs);

  // Obtener requisitos de las empresas del tecnico
  tech.companyIds.forEach(cId => {
    const company = companies.find(c => c.id === cId);
    if (company) {
      company.requiredDocTypes.forEach(dId => allRequiredDocIds.add(dId));
    }
  });

  const requiredIdsArray = Array.from(allRequiredDocIds);
  const totalDocs = requiredIdsArray.length;

  let newScore = 100;
  let newStatus = ComplianceStatus.VALID;

  if (totalDocs > 0) {
    let validCount = 0;
    let hasExpired = false;
    let hasMissing = false;
    let hasExpiring = false;
    let hasPending = false;

    requiredIdsArray.forEach(reqDocId => {
      const cred = tech.credentials.find(c => c.documentTypeId === reqDocId);

      if (!cred) {
        hasMissing = true;
      } else {
        // Rodrigo Osorio v0.8 - Documentos VALID y EXPIRING_SOON cuentan como cumplimiento
        if (cred.status === ComplianceStatus.VALID || cred.status === ComplianceStatus.EXPIRING_SOON) validCount++;
        if (cred.status === ComplianceStatus.EXPIRED) hasExpired = true;
        if (cred.status === ComplianceStatus.MISSING) hasMissing = true;
        if (cred.status === ComplianceStatus.EXPIRING_SOON) hasExpiring = true;
        if (cred.status === ComplianceStatus.PENDING) hasPending = true;
      }
    });

    newScore = Math.round((validCount / totalDocs) * 100);

    if (hasExpired || hasMissing) {
      newStatus = hasExpired ? ComplianceStatus.EXPIRED : ComplianceStatus.MISSING;
    } else if (hasPending) {
      newStatus = ComplianceStatus.PENDING;
    } else if (hasExpiring) {
      newStatus = ComplianceStatus.EXPIRING_SOON;
    }
  }

  // Actualizar en DB
  await supabase
    .from('technicians')
    .update({
      compliance_score: newScore,
      overall_status: newStatus
    })
    .eq('id', tech.id);

  // Actualizar referencia local
  tech.complianceScore = newScore;
  tech.overallStatus = newStatus;
};

// --- RODRIGO OSORIO v0.13: CUMPLIMIENTO POR EMPRESA ---
// Calcula el cumplimiento de técnicos respecto a los requisitos específicos de UNA empresa

export interface TechnicianComplianceDetail {
  technicianId: string;
  technicianName: string;
  requiredDocs: number;
  validDocs: number;
  percentage: number;
  isFullyCompliant: boolean;
}

export interface CompanyTechnicianCompliance {
  companyId: string;
  companyName: string;
  totalTechnicians: number;
  fullyCompliantTechnicians: number;
  compliancePercentage: number;
  isAtRisk: boolean;
  techniciansDetail: TechnicianComplianceDetail[];
}

/**
 * Calcula el cumplimiento de UN técnico respecto a los requisitos de UNA empresa específica
 */
export const calculateTechnicianComplianceForCompany = (
  technician: Technician,
  company: Company
): TechnicianComplianceDetail => {
  const requiredDocIds = company.requiredDocTypes || [];
  const totalRequired = requiredDocIds.length;

  if (totalRequired === 0) {
    return {
      technicianId: technician.id,
      technicianName: technician.name,
      requiredDocs: 0,
      validDocs: 0,
      percentage: 100,
      isFullyCompliant: true
    };
  }

  let validCount = 0;
  requiredDocIds.forEach(docId => {
    const cred = technician.credentials?.find(c => c.documentTypeId === docId);
    if (cred && (cred.status === ComplianceStatus.VALID || cred.status === ComplianceStatus.EXPIRING_SOON)) {
      validCount++;
    }
  });

  const percentage = Math.round((validCount / totalRequired) * 100);

  return {
    technicianId: technician.id,
    technicianName: technician.name,
    requiredDocs: totalRequired,
    validDocs: validCount,
    percentage,
    isFullyCompliant: percentage === 100
  };
};

/**
 * Calcula el cumplimiento de TODOS los técnicos de UNA empresa
 */
export const calculateCompanyTechnicianCompliance = async (
  companyId: string
): Promise<CompanyTechnicianCompliance> => {
  const [companies, technicians, activeAbsences] = await Promise.all([
    getCompanies(),
    getTechnicians(),
    getActiveAbsences()
  ]);

  const company = companies.find(c => c.id === companyId);
  if (!company) {
    return {
      companyId,
      companyName: 'Desconocida',
      totalTechnicians: 0,
      fullyCompliantTechnicians: 0,
      compliancePercentage: 0,
      isAtRisk: true,
      techniciansDetail: []
    };
  }

  const absentTechIds = new Set(activeAbsences.map(a => a.technicianId));

  // Filtrar técnicos de esta empresa que estén operativamente activos
  const companyTechnicians = technicians.filter(t =>
    t.companyIds?.includes(companyId) && !absentTechIds.has(t.id)
  );

  const techniciansDetail = companyTechnicians.map(tech =>
    calculateTechnicianComplianceForCompany(tech, company)
  );

  const fullyCompliantCount = techniciansDetail.filter(t => t.isFullyCompliant).length;
  const total = techniciansDetail.length;
  const compliancePercentage = total > 0 ? Math.round((fullyCompliantCount / total) * 100) : 0;

  return {
    companyId: company.id,
    companyName: company.name,
    totalTechnicians: total,
    fullyCompliantTechnicians: fullyCompliantCount,
    compliancePercentage,
    isAtRisk: compliancePercentage < 50 || total === 0,
    techniciansDetail
  };
};

/**
 * Obtiene TODAS las empresas que están en riesgo (<50% cumplimiento o sin técnicos 100%)
 */
export const getCompaniesAtRisk = async (): Promise<CompanyTechnicianCompliance[]> => {
  const [companies, technicians] = await Promise.all([
    getCompanies(),
    getTechnicians()
  ]);

  const results: CompanyTechnicianCompliance[] = [];

  for (const company of companies) {
    const companyTechnicians = technicians.filter(t => t.companyIds?.includes(company.id));

    if (companyTechnicians.length === 0) {
      // Empresa sin técnicos asignados - puede o no ser riesgo dependiendo del contexto
      continue;
    }

    const techniciansDetail = companyTechnicians.map(tech =>
      calculateTechnicianComplianceForCompany(tech, company)
    );

    const fullyCompliantCount = techniciansDetail.filter(t => t.isFullyCompliant).length;
    const total = techniciansDetail.length;
    const compliancePercentage = total > 0 ? Math.round((fullyCompliantCount / total) * 100) : 0;

    if (compliancePercentage < 50) {
      results.push({
        companyId: company.id,
        companyName: company.name,
        totalTechnicians: total,
        fullyCompliantTechnicians: fullyCompliantCount,
        compliancePercentage,
        isAtRisk: true,
        techniciansDetail
      });
    }
  }

  // Ordenar por % de menor a mayor (más crítico primero)
  return results.sort((a, b) => a.compliancePercentage - b.compliancePercentage);
};

// --- TECHNICIANS ---

// Rodrigo Osorio v0.12 - Optimizado con caché para mejor performance en uso masivo
// v0.14 - Filtrado por sucursales
export const getTechnicians = async (branchIds?: string[]): Promise<Technician[]> => {
  const allTechs = await getCachedOrFetch<Technician[]>(CACHE_KEYS.TECHNICIANS, async () => {
    // Usar RPC segura que devuelve JSON con datos desencriptados y relaciones
    const { data, error } = await supabase.rpc('get_technicians_full');

    if (error) { console.error("Error fetching technicians", error); return []; }

    return (data || []).map((item: any) => {
      const t = item.j;
      return {
        id: t.id,
        name: t.name,
        rut: t.rut,
        email: t.email,
        phone: t.phone,
        branch_id: t.branch_id,
        branch: t.branches?.name || 'Sin Asignar',
        branchId: t.branch_id,
        technicianTypeId: t.technician_type_id,
        role: t.role || t.technician_types?.name || 'Técnico',
        isActive: t.is_active,
        complianceScore: t.compliance_score || 0,
        overallStatus: t.overall_status || ComplianceStatus.PENDING,
        avatarUrl: t.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=0D8ABC&color=fff`,
        companyIds: (t.technician_companies || []).map((tc: any) => tc.company_id),
        isBlocked: (t.technician_companies || []).some((tc: any) => tc.is_blocked),
        credentials: (t.credentials || []).map((c: any) => ({
          id: c.id,
          technicianId: c.technician_id,
          documentTypeId: c.document_type_id,
          documentTypeName: c.document_types?.name || 'Documento',
          fileUrl: c.file_url,
          status: c.status,
          issueDate: c.issue_date,
          expiryDate: c.expiry_date,
          portalCertifiedAt: c.portal_certified_at,
          portalCertifiedBy: c.portal_certified_by,
          portalCertifiedByName: c.portal_certified_by_name
        })),
        createdAt: t.created_at
      };
    });
  }, CACHE_TTL.MEDIUM);

  if (branchIds && branchIds.length > 0) {
    return allTechs.filter(t => t.branchId && branchIds.includes(t.branchId));
  }
  return allTechs;
};



// Optimizado por Rodrigo Osorio - v0.1: Query directa en vez de cargar todos los tecnicos
export const getTechnicianById = async (id: string): Promise<Technician | undefined> => {
  // Usar RPC segura
  const { data, error } = await supabase.rpc('get_technician_detail', { tech_id: id }).single();

  if (error || !data) {
    if (error) console.error("Error fetching technician detail", error);
    return undefined;
  }

  const t = data.j; // El objeto JSON retorna en propiedad 'j'

  return {
    id: t.id,
    name: t.name,
    rut: t.rut,
    email: t.email,
    phone: t.phone,
    branch: t.branches?.name || '',
    branchId: t.branch_id, // ID para edicion
    role: t.role || t.technician_types?.name || '',
    technicianTypeId: t.technician_type_id,
    isActive: t.is_active,
    avatarUrl: t.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=random`,
    complianceScore: t.compliance_score || 0,
    overallStatus: t.overall_status || ComplianceStatus.PENDING,
    companyIds: (t.technician_companies || []).map((tc: any) => tc.company_id),
    blockedCompanyIds: (t.technician_companies || []).filter((tc: any) => tc.is_blocked).map((tc: any) => tc.company_id),
    credentials: (t.credentials || []).map((c: any) => ({
      id: c.id,
      technicianId: c.technician_id,
      documentTypeId: c.document_type_id,
      documentTypeName: c.document_types?.name || 'Documento',
      fileUrl: c.file_url,
      issueDate: c.issue_date,
      expiryDate: c.expiry_date,
      status: c.status,
      portalCertifiedAt: c.portal_certified_at,
      portalCertifiedBy: c.portal_certified_by,
      portalCertifiedByName: c.portal_certified_by_name
    }))
  };
};

// Rodrigo Osorio v0.12 - Obtener técnicos de una empresa específica (Filtrado en servidor)
export const getTechniciansByCompany = async (companyId: string): Promise<Technician[]> => {
  // Usar RPC segura
  const { data, error } = await supabase.rpc('get_technicians_by_company_secure', { p_company_id: companyId });

  if (error) {
    console.error("Error fetching company technicians", error);
    return [];
  }

  return (data || []).map((item: any) => {
    const t = item.j;
    return {
      id: t.id,
      name: t.name,
      rut: t.rut,
      email: t.email,
      phone: t.phone,
      branch: t.branches?.name || '',
      branchId: t.branch_id,
      role: t.role || t.technician_types?.name || '',
      technicianTypeId: t.technician_type_id,
      isActive: t.is_active,
      avatarUrl: t.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=random`,
      complianceScore: t.compliance_score || 0,
      overallStatus: t.overall_status || ComplianceStatus.PENDING,
      companyIds: (t.technician_companies || []).map((tc: any) => tc.company_id),
      blockedCompanyIds: (t.technician_companies || []).filter((tc: any) => tc.is_blocked).map((tc: any) => tc.company_id),
      credentials: (t.credentials || []).map((c: any) => ({
        id: c.id,
        technicianId: c.technician_id,
        documentTypeId: c.document_type_id,
        documentTypeName: c.document_types?.name || 'Documento',
        fileUrl: c.file_url,
        issueDate: c.issue_date,
        expiryDate: c.expiry_date,
        status: c.status
      }))
    };
  });
};

// Versión ligera para listas rápidas
// Rodrigo Osorio v0.14 - Soporte para sucursales
export const getTechniciansLight = async (branchIds?: string[]): Promise<Partial<Technician>[]> => {
  const allTechs = await getCachedOrFetch<any[]>(CACHE_KEYS.TECHNICIANS_LIGHT, async () => {
    // Usar RPC segura
    const { data, error } = await supabase.rpc('get_technicians_light_secure');
    if (error) { logger.error("Error fetching technicians light", error); return []; }

    return (data || []).map((item: any) => {
      const t = item.j;
      return {
        id: t.id,
        name: t.name,
        rut: t.rut,
        email: t.email,
        phone: t.phone,
        branch: t.branches?.name || 'Sin Asignar',
        branchId: t.branch_id,
        role: t.role || t.technician_types?.name || 'Técnico',
        overallStatus: t.overall_status || ComplianceStatus.PENDING,
        complianceScore: t.compliance_score || 0,
        avatarUrl: t.avatar_url
      };
    });
  }, CACHE_TTL.SHORT);

  if (branchIds && branchIds.length > 0) {
    return allTechs.filter(t => t.branchId && branchIds.includes(t.branchId));
  }
  return allTechs;
};


// Rodrigo Osorio v0.15 - Soporte para Carga Masiva (Bulk Upload)
export const checkRutsExist = async (ruts: string[]): Promise<string[]> => {
  if (!ruts.length) return [];
  const { data, error } = await supabase
    .from('technicians')
    .select('rut')
    .in('rut', ruts);

  if (error) {
    console.error("Error checking RUTs", error);
    return [];
  }
  return data.map((t: any) => t.rut);
};

export const bulkAddTechnicians = async (
  technicians: any[],
  branchId: string,
  serviceProviderId: string,
  technicianTypeId: string
) => {
  // 1. Preparar datos de técnicos
  const techsToInsert = technicians.map(t => ({
    name: t.nombre,
    rut: t.rut,
    email: t.email,
    phone: t.telefono,
    branch_id: branchId,
    technician_type_id: technicianTypeId,
    role: 'Técnico', // v0.15 - Se asume cargo genérico, el tipo define la especialidad
    is_active: true,
    compliance_score: 0,
    overall_status: ComplianceStatus.PENDING,
    avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(t.nombre)}&background=random`
  }));

  // 2. Insertar técnicos
  const { data: createdTechs, error } = await supabase
    .from('technicians')
    .insert(techsToInsert)
    .select('id, rut');

  if (error) throw error;

  // 3. Vincular a la EPS (Empresa Prestadora de Servicio)
  const spLinks = createdTechs.map(t => ({
    technician_id: t.id,
    service_provider_id: serviceProviderId,
    is_active: true
  }));
  await supabase.from('technician_service_providers').insert(spLinks);

  // 4. Asignar Documentos Globales (PENDIENTE)
  const docTypes = await getDocumentTypes();
  const globalDocIds = docTypes.filter(d => d.isGlobal && d.scope === 'TECHNICIAN').map(d => d.id);

  if (globalDocIds.length > 0 && createdTechs.length > 0) {
    const credsToInsert: any[] = [];
    createdTechs.forEach(t => {
      globalDocIds.forEach(docId => {
        credsToInsert.push({
          technician_id: t.id,
          document_type_id: docId,
          status: ComplianceStatus.PENDING
        });
      });
    });

    // Insertar credenciales en lotes si es necesario (aquí directo)
    const { error: credError } = await supabase.from('credentials').insert(credsToInsert);
    if (credError) console.error("Error creating bulk credentials", credError);
  }

  // 5. Limpiar caché
  clearCache(CACHE_KEYS.TECHNICIANS);
  return createdTechs;
};

// --- ABSENCES / AVAILABILITY (Rodrigo Osorio v0.15) ---

export const getTechnicianAbsences = async (techId: string): Promise<TechnicianAbsence[]> => {
  const { data, error } = await supabase
    .from('technician_absences')
    .select('*')
    .eq('technician_id', techId)
    .order('start_date', { ascending: false });

  if (error) {
    console.error("Error fetching absences", error);
    return [];
  }

  return (data || []).map(a => ({
    id: a.id,
    technicianId: a.technician_id,
    type: a.type as AbsenceType,
    startDate: a.start_date,
    endDate: a.end_date,
    comments: a.comments,
    createdAt: a.created_at
  }));
};

export const addTechnicianAbsence = async (absence: Omit<TechnicianAbsence, 'id'>): Promise<TechnicianAbsence> => {
  const { data, error } = await supabase
    .from('technician_absences')
    .insert({
      technician_id: absence.technicianId,
      type: absence.type,
      start_date: absence.startDate,
      end_date: absence.endDate,
      comments: absence.comments
    })
    .select()
    .single();

  if (error) throw error;

  // Limpiar caché de técnicos ya que el estado de disponibilidad puede cambiar
  clearCache(CACHE_KEYS.TECHNICIANS);
  clearCache(CACHE_KEYS.TECHNICIANS_LIGHT);

  return {
    id: data.id,
    technicianId: data.technician_id,
    type: data.type as AbsenceType,
    startDate: data.start_date,
    endDate: data.end_date,
    comments: data.comments,
    createdAt: data.created_at
  };
};

export const deleteTechnicianAbsence = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('technician_absences')
    .delete()
    .eq('id', id);

  if (error) throw error;

  clearCache(CACHE_KEYS.TECHNICIANS);
  clearCache(CACHE_KEYS.TECHNICIANS_LIGHT);
};

export const getTechnicianAvailability = async (techId: string): Promise<{ status: AvailabilityStatus, absence?: TechnicianAbsence }> => {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('technician_absences')
    .select('*')
    .eq('technician_id', techId)
    .lte('start_date', today)
    .gte('end_date', today)
    .maybeSingle();

  if (error) {
    console.error("Error checking availability", error);
    return { status: 'AVAILABLE' };
  }

  if (!data) return { status: 'AVAILABLE' };

  return {
    status: data.type as AvailabilityStatus,
    absence: {
      id: data.id,
      technicianId: data.technician_id,
      type: data.type as AbsenceType,
      startDate: data.start_date,
      endDate: data.end_date,
      comments: data.comments
    }
  };
};

export const getActiveAbsences = async (): Promise<TechnicianAbsence[]> => {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('technician_absences')
    .select('*')
    .lte('start_date', today)
    .gte('end_date', today);

  if (error) {
    console.error("Error fetching active absences", error);
    return [];
  }

  return (data || []).map(a => ({
    id: a.id,
    technicianId: a.technician_id,
    type: a.type as AbsenceType,
    startDate: a.start_date,
    endDate: a.end_date
  }));
};


export const addTechnician = async (techData: Partial<Technician>): Promise<Technician> => {
  // 1. Create Technician
  const { data: tech, error } = await supabase
    .from('technicians')
    .insert({
      name: techData.name,
      rut: techData.rut,
      email: techData.email,
      phone: techData.phone,
      branch_id: techData.branch, // UI passes ID here usually
      technician_type_id: techData.technicianTypeId,
      role: techData.role || 'Técnico', // fallback
      is_active: true,
      compliance_score: 100,
      overall_status: 'VALID',
      avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(techData.name || 'User')}&background=random`
    })
    .select()
    .single();

  if (error) throw error;

  // 2. Link Companies
  if (techData.companyIds && techData.companyIds.length > 0) {
    const pivotData = techData.companyIds.map(cId => ({
      technician_id: tech.id,
      company_id: cId
    }));
    await supabase.from('technician_companies').insert(pivotData);
  }

  // 3. Auto-assign Global Docs (Placeholders)
  const docTypes = await getDocumentTypes();
  const globalDocs = docTypes.filter(d => d.isGlobal && d.scope === 'TECHNICIAN');

  // Add Company requirements as well
  let requiredDocIds = new Set(globalDocs.map(d => d.id));
  if (techData.companyIds) {
    const companies = await getCompanies();
    techData.companyIds.forEach(cId => {
      const comp = companies.find(c => c.id === cId);
      if (comp) comp.requiredDocTypes.forEach(id => requiredDocIds.add(id));
    });
  }

  if (requiredDocIds.size > 0) {
    const credsToInsert = Array.from(requiredDocIds).map(docId => ({
      technician_id: tech.id,
      document_type_id: docId,
      status: 'PENDING'
    }));
    await supabase.from('credentials').insert(credsToInsert);
  }

  // 4. Return complete object
  const newTech = await getTechnicianById(tech.id);
  if (newTech) await recalculateAndSaveTechnicianStatus(newTech);

  // Invalidar cache de técnicos
  clearCache(CACHE_KEYS.TECHNICIANS);

  return newTech!;
};

// --- COMPANIES ---

// Rodrigo Osorio v0.12 - Optimizado con caché para mejor performance
// Rodrigo Osorio v0.12 - Optimizado con caché para mejor performance
export const getCompanies = async (): Promise<Company[]> => {
  return getCachedOrFetch<Company[]>(CACHE_KEYS.COMPANIES, async () => {
    // Usar RPC segura
    const { data, error } = await supabase.rpc('get_companies_full');

    if (error) { console.error(error); return []; }

    return (data || []).map((item: any) => {
      const c = item.j;
      return {
        id: c.id,
        name: c.name,
        rut: c.rut,
        industry: c.industry,
        type: c.type,
        holdingId: c.holding_id,
        logoUrl: c.logo_url,
        address: c.address,
        contactName: c.contact_name,
        contactEmail: c.contact_email,
        contactPhone: c.contact_phone,
        // Rodrigo Osorio v0.12 - Portal de proveedores centralizado
        supplierPortalId: c.supplier_portal_id,
        supplierPortal: c.supplier_portals ? {
          id: c.supplier_portals.id,
          name: c.supplier_portals.name,
          url: c.supplier_portals.url,
          username: c.supplier_portals.username,
          password: c.supplier_portals.password,
          isActive: c.supplier_portals.is_active
        } : undefined,
        // Legacy fields (mantener para retrocompatibilidad)
        portalUrl: c.portal_url,
        portalUser: c.portal_user,
        portalPassword: c.portal_password,
        requiredDocTypes: (c.company_requirements || [])
          .filter((r: any) => r.requirement_scope === 'TECHNICIAN')
          .map((r: any) => r.document_type_id),
        requiredDocTypeIdsForCompany: (c.company_requirements || [])
          .filter((r: any) => r.requirement_scope === 'COMPANY')
          .map((r: any) => r.document_type_id),
        credentials: (c.company_credentials || []).map((cc: any) => ({
          id: cc.id,
          companyId: c.id,
          documentTypeId: cc.document_type_id,
          documentTypeName: cc.document_types?.name,
          fileUrl: cc.file_url,
          issueDate: cc.issue_date,
          expiryDate: cc.expiry_date,
          status: cc.status
        }))
      };
    });
  }, CACHE_TTL.MEDIUM);
};

// Rodrigo Osorio v0.12 - Versión ligera para listas con información de cumplimiento dual
export interface CompanyLight {
  id: string;
  name: string;
  rut: string;
  industry: string;
  type: string;
  holdingId?: string;
  requiredDocTypesCount: number;
  requiredDocTypesForCompanyCount: number;
  // Información de cumplimiento documental de la empresa
  companyComplianceScore: number; // 0-100, porcentaje de cumplimiento de docs de empresa
  companyDocsTotal: number;        // Total de documentos requeridos por la empresa
  companyDocsValid: number;        // Documentos válidos de la empresa
  // Información de cumplimiento de técnicos asignados
  technicianComplianceScore: number; // 0-100, promedio de cumplimiento de técnicos
  technicianCount: number;           // Total de técnicos asignados
  technicianValidCount: number;      // Técnicos que cumplen al 100%
  branchIds: string[];               // IDs de sucursales donde tiene técnicos
}

export const getCompaniesLight = async (): Promise<CompanyLight[]> => {
  return getCachedOrFetch<CompanyLight[]>(CACHE_KEYS.COMPANIES_LIGHT, async () => {
    // 1. Obtener empresas con requisitos y credenciales usando RPC segura
    const { data: rpcData, error: compError } = await supabase.rpc('get_companies_light_secure');

    if (compError) { console.error(compError); return []; }

    const companies = (rpcData || []).map((item: any) => item.j);

    // 2. Obtener TODAS las relaciones técnico-empresa de una vez (Bulk fetch)
    // De O(n) queries a O(1) query.
    const { data: techRelations, error: relError } = await supabase
      .from('technician_companies')
      .select(`
        company_id,
        technician:technicians (
          id, 
          compliance_score, 
          overall_status,
          branch_id,
          credentials (document_type_id, status)
        )
      `);

    if (relError) { console.error(relError); return []; }

    // Agrupar relaciones por empresa para procesamiento eficiente O(n)
    const relationsByCompany = techRelations.reduce((acc: any, rel: any) => {
      if (!acc[rel.company_id]) acc[rel.company_id] = [];
      acc[rel.company_id].push(rel.technician);
      return acc;
    }, {});

    // 3. Mapear todo en memoria (Procesamiento O(n) local)
    return companies.map((c: any) => {
      const techReqs = c.company_requirements?.filter((r: any) => r.requirement_scope === 'TECHNICIAN') || [];
      const compReqs = c.company_requirements?.filter((r: any) => r.requirement_scope === 'COMPANY') || [];
      const requiredTechDocIds = techReqs.map((r: any) => r.document_type_id);

      // Cumplimiento interno de la empresa
      const companyDocsValid = c.company_credentials?.filter((cc: any) =>
        cc.status === 'VALID' && compReqs.some((r: any) => r.document_type_id === cc.document_type_id)
      ).length || 0;

      const companyDocsTotal = compReqs.length;
      const companyComplianceScore = companyDocsTotal === 0 ? 100 : Math.round((companyDocsValid / companyDocsTotal) * 100);

      // Cumplimiento de técnicos para ESTA empresa específica
      const assignedTechs = relationsByCompany[c.id] || [];
      const technicianCount = assignedTechs.length;

      let validTechsForThisCompanyCount = 0;
      if (technicianCount > 0 && requiredTechDocIds.length > 0) {
        validTechsForThisCompanyCount = assignedTechs.filter((tech: any) => {
          const validDocs = tech.credentials?.filter((cred: any) =>
            (cred.status === 'VALID' || cred.status === 'EXPIRING_SOON') &&
            requiredTechDocIds.includes(cred.document_type_id)
          ) || [];
          return validDocs.length === requiredTechDocIds.length;
        }).length;
      } else if (technicianCount > 0) {
        // Si no hay requisitos específicos, usamos el status global
        validTechsForThisCompanyCount = assignedTechs.filter((t: any) => t.overall_status === ComplianceStatus.VALID).length;
      }

      const technicianComplianceScore = technicianCount === 0 ? 100 : Math.round((validTechsForThisCompanyCount / technicianCount) * 100);

      return {
        id: c.id,
        name: c.name,
        rut: c.rut || '',
        industry: c.industry || '',
        type: c.type || 'SUBSIDIARY',
        holdingId: c.holding_id,
        requiredDocTypesCount: techReqs.length,
        requiredDocTypesForCompanyCount: compReqs.length,
        companyComplianceScore,
        companyDocsTotal,
        companyDocsValid,
        technicianComplianceScore,
        technicianCount,
        technicianValidCount: validTechsForThisCompanyCount,
        branchIds: Array.from(new Set(assignedTechs.map((t: any) => t.branch_id).filter(Boolean))) as string[]
      };
    });
  }, CACHE_TTL.MEDIUM);
};

export const addCompany = async (company: Partial<Company>): Promise<Company> => {
  const { data: newComp, error } = await supabase
    .from('companies')
    .insert({
      name: company.name,
      rut: company.rut,
      industry: company.industry,
      type: company.type,
      holding_id: company.holdingId || null,
      address: company.address,
      contact_name: company.contactName
    })
    .select()
    .single();

  if (error) throw error;

  // Insert Requirements
  const reqsToInsert = [];
  if (company.requiredDocTypes) {
    reqsToInsert.push(...company.requiredDocTypes.map(id => ({
      company_id: newComp.id,
      document_type_id: id,
      requirement_scope: 'TECHNICIAN'
    })));
  }
  if (company.requiredDocTypeIdsForCompany) {
    reqsToInsert.push(...company.requiredDocTypeIdsForCompany.map(id => ({
      company_id: newComp.id,
      document_type_id: id,
      requirement_scope: 'COMPANY'
    })));
  }

  if (reqsToInsert.length > 0) {
    await supabase.from('company_requirements').insert(reqsToInsert);
  }

  // Invalidar cache de empresas (ambas versiones)
  clearCache(CACHE_KEYS.COMPANIES);
  clearCache(CACHE_KEYS.COMPANIES_LIGHT);

  return (await getCompanies()).find(c => c.id === newComp.id)!;
}

// --- BRANCHES ---

// Rodrigo Osorio v0.3 - Optimizado con cache y agregación O(n)
// v0.15 - Corregido cálculo de cumplimiento: cuenta técnicos VALID, no promedio de scores
export const getBranches = async (): Promise<Branch[]> => {
  return getCachedOrFetch<Branch[]>(CACHE_KEYS.BRANCHES, async () => {
    // Queries en paralelo para mejor performance
    const [branchesResult, techStatsResult] = await Promise.all([
      supabase.from('branches').select('*').order('name'),
      supabase.from('technicians').select('branch_id, overall_status')
    ]);

    if (branchesResult.error) return [];

    const branches = branchesResult.data;
    const techStats = techStatsResult.data || [];

    // Agregar estadísticas: contar total y cuántos están VALID
    const statsByBranch = techStats.reduce((acc: Record<string, { count: number; validCount: number }>, t: any) => {
      if (!t.branch_id) return acc;
      if (!acc[t.branch_id]) {
        acc[t.branch_id] = { count: 0, validCount: 0 };
      }
      acc[t.branch_id].count++;
      // Un técnico cumple si su status es VALID (100% de docs requeridos)
      if (t.overall_status === 'VALID') {
        acc[t.branch_id].validCount++;
      }
      return acc;
    }, {});

    // Mapear branches con estadísticas: cumplimiento = % de técnicos VALID
    return branches.map((b: any) => {
      const stats = statsByBranch[b.id] || { count: 0, validCount: 0 };
      return {
        id: b.id,
        name: b.name,
        location: b.location,
        technicianCount: stats.count,
        // Cumplimiento = porcentaje de técnicos que están al 100%
        complianceScore: stats.count > 0 ? Math.round((stats.validCount / stats.count) * 100) : 0
      };
    });
  }, CACHE_TTL.EXTRA_LONG);
};

// Rodrigo Osorio v0.15 - Ranking de sucursales pre-calculado (Snapshot cada 3h)
export interface BranchRanking {
  branchId: string;
  branchName: string;
  totalTechs: number;
  techComplianceRate: number;
  epsComplianceRate: number;
  globalScore: number;
  lastUpdated: string;
}

export const getBranchRanking = async (): Promise<BranchRanking[]> => {
  const { data, error } = await supabase
    .from('branch_compliance_ranking')
    .select('*')
    .order('global_score', { ascending: false });

  if (error) {
    console.error("Error fetching branch ranking:", error);
    return [];
  }

  return data.map(r => ({
    branchId: r.branch_id,
    branchName: r.branch_name,
    totalTechs: r.total_techs,
    techComplianceRate: r.tech_compliance_rate,
    epsComplianceRate: r.eps_compliance_rate,
    globalScore: r.global_score,
    lastUpdated: r.last_updated
  }));
};

export const addBranch = async (branchData: Partial<Branch>): Promise<Branch> => {
  const { data, error } = await supabase
    .from('branches')
    .insert({ name: branchData.name, location: branchData.location })
    .select()
    .single();
  if (error) throw error;
  return { ...data, technicianCount: 0, complianceScore: 0 };
};

// --- AREAS ---

// Rodrigo Osorio v0.11 - Con cache optimizado para datos semi-estáticos
export const getAreas = async (): Promise<WorkArea[]> => {
  return getCachedOrFetch<WorkArea[]>(CACHE_KEYS.AREAS, async () => {
    const { data, error } = await supabase.from('work_areas').select('*').order('name');
    if (error) return [];
    return data.map((a: any) => ({
      id: a.id,
      name: a.name,
      slaDays: a.sla_days,
      slaType: a.sla_type,
      criticality: a.criticality,
      complianceScore: a.compliance_score || 100
    }));
  }, CACHE_TTL.EXTRA_LONG); // Áreas de trabajo son datos semi-estáticos
};

// Rodrigo Osorio v0.2 - Mejorado con manejo de errores
export const addArea = async (area: Partial<WorkArea>): Promise<{ success: boolean; data?: WorkArea; error?: string }> => {
  const { data, error } = await supabase.from('work_areas').insert({
    name: area.name,
    sla_days: area.slaDays,
    sla_type: area.slaType,
    criticality: area.criticality
  }).select().single();

  if (error) {
    console.error('Error adding area:', error);
    return { success: false, error: error.message };
  }

  return {
    success: true,
    data: {
      id: data.id,
      name: data.name,
      slaDays: data.sla_days,
      slaType: data.sla_type,
      criticality: data.criticality,
      complianceScore: 100
    }
  };
};

export const deleteArea = async (id: string): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('work_areas').delete().eq('id', id);
  if (error) {
    console.error('Error deleting area:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
};

// --- USERS & ROLES ---

export const getUsers = async (): Promise<AppUser[]> => {
  // 1. Fetch users
  const { data: users, error } = await supabase
    .from('app_users')
    .select('*')
    .order('name');
  if (error) return [];

  // 2. Fetch all branch assignments in one go
  const { data: assignments, error: assignError } = await supabase
    .from('user_branches')
    .select('user_id, branch_id');

  const assignmentsByUser = (assignments || []).reduce((acc: any, curr: any) => {
    if (!acc[curr.user_id]) acc[curr.user_id] = [];
    acc[curr.user_id].push(curr.branch_id);
    return acc;
  }, {});

  return users.map((u: any) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    lastLogin: u.last_login,
    assignedBranchIds: assignmentsByUser[u.id] || []
  }));
};

export const addUser = async (user: any): Promise<{ success: boolean; data?: any; error?: string }> => {
  const { data, error } = await supabase
    .from('app_users')
    .insert({
      name: user.name,
      email: user.email,
      role: user.role,
      status: 'ACTIVE'
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  // If branches are provided, link them
  if (user.assignedBranchIds && user.assignedBranchIds.length > 0) {
    const links = user.assignedBranchIds.map((bId: string) => ({
      user_id: data.id,
      branch_id: bId
    }));
    await supabase.from('user_branches').insert(links);
  }

  return { success: true, data };
};

export const updateUserBranches = async (userId: string, branchIds: string[]): Promise<{ success: boolean; error?: string }> => {
  // 1. Delete existing
  const { error: delError } = await supabase
    .from('user_branches')
    .delete()
    .eq('user_id', userId);

  if (delError) return { success: false, error: delError.message };

  // 2. Insert new ones
  if (branchIds.length > 0) {
    const links = branchIds.map(bId => ({
      user_id: userId,
      branch_id: bId
    }));
    const { error: insError } = await supabase
      .from('user_branches')
      .insert(links);

    if (insError) return { success: false, error: insError.message };
  }

  return { success: true };
};

// --- DOC TYPES ---

export const getDocumentTypes = async (): Promise<DocumentType[]> => {
  const { data, error } = await supabase.from('document_types').select('*');
  if (error) return [];
  return data.map((d: any) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    areaId: d.area_id,
    scope: d.scope,
    isGlobal: d.is_global,
    isActive: d.is_active,
    renewalType: d.renewal_type,
    renewalFrequency: d.renewal_frequency,
    renewalUnit: d.renewal_unit,
    renewalDayOfMonth: d.renewal_day_of_month
  }));
};

// Optimizado por Rodrigo Osorio - v0.1: Query directa en vez de cargar todos los tipos
export const getDocumentTypeById = async (id: string): Promise<DocumentType | undefined> => {
  const { data: d, error } = await supabase
    .from('document_types')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !d) return undefined;

  return {
    id: d.id,
    name: d.name,
    description: d.description,
    areaId: d.area_id,
    scope: d.scope,
    isGlobal: d.is_global,
    isActive: d.is_active,
    renewalType: d.renewal_type,
    renewalFrequency: d.renewal_frequency,
    renewalUnit: d.renewal_unit,
    renewalDayOfMonth: d.renewal_day_of_month
  };
}

// Rodrigo Osorio v0.2 - Mejorado con manejo de errores
export const addDocumentType = async (doc: Partial<DocumentType>): Promise<{ success: boolean; data?: DocumentType; error?: string }> => {
  const { data, error } = await supabase.from('document_types').insert({
    name: doc.name,
    description: doc.description,
    area_id: doc.areaId,
    scope: doc.scope,
    is_global: doc.isGlobal,
    is_active: doc.isActive,
    renewal_type: doc.renewalType,
    renewal_frequency: doc.renewalFrequency,
    renewal_unit: doc.renewalUnit,
    renewal_day_of_month: doc.renewalDayOfMonth
  }).select().single();

  if (error) {
    console.error('Error adding document type:', error);
    return { success: false, error: error.message };
  }

  return {
    success: true,
    data: {
      id: data.id,
      name: data.name,
      description: data.description,
      areaId: data.area_id,
      scope: data.scope,
      isGlobal: data.is_global,
      isActive: data.is_active,
      renewalType: data.renewal_type,
      renewalFrequency: data.renewal_frequency,
      renewalUnit: data.renewal_unit,
      renewalDayOfMonth: data.renewal_day_of_month
    }
  };
};

export const deleteDocumentType = async (id: string): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('document_types').delete().eq('id', id);
  if (error) {
    console.error('Error deleting document type:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
};

// --- ASSIGNMENTS & CREDENTIALS ---

// Optimizado por Rodrigo Osorio - v0.1: Carga datos en batch y evita N queries en el loop
export const assignTechniciansToCompany = async (companyId: string, techIds: string[]) => {
  if (techIds.length === 0) return;

  // 1. Crear enlaces
  const links = techIds.map(tId => ({ technician_id: tId, company_id: companyId }));
  const { error } = await supabase.from('technician_companies').upsert(links, { onConflict: 'technician_id, company_id' });
  if (error) console.error(error);

  // 2. Pre-cargar todos los datos necesarios en paralelo
  const [companies, docTypes, existingCredsResult] = await Promise.all([
    getCompanies(),
    getDocumentTypes(),
    supabase
      .from('credentials')
      .select('technician_id, document_type_id')
      .in('technician_id', techIds)
  ]);

  const company = companies.find(c => c.id === companyId);

  if (company && company.requiredDocTypes && company.requiredDocTypes.length > 0) {
    // Crear mapa de credenciales existentes por tecnico
    const existingCredsByTech = new Map<string, Set<string>>();
    (existingCredsResult.data || []).forEach((c: any) => {
      if (!existingCredsByTech.has(c.technician_id)) {
        existingCredsByTech.set(c.technician_id, new Set());
      }
      existingCredsByTech.get(c.technician_id)!.add(c.document_type_id);
    });

    // Preparar todas las credenciales a insertar en batch
    const allCredsToInsert: any[] = [];

    for (const tId of techIds) {
      const existingIds = existingCredsByTech.get(tId) || new Set();

      const toInsert = company.requiredDocTypes
        .filter(docId => !existingIds.has(docId))
        .map(docId => ({
          technician_id: tId,
          document_type_id: docId,
          status: 'PENDING'
        }));

      allCredsToInsert.push(...toInsert);
    }

    // Insertar todas las credenciales en una sola operacion
    if (allCredsToInsert.length > 0) {
      await supabase.from('credentials').insert(allCredsToInsert);
    }

    // Recalcular status para cada tecnico usando datos pre-cargados
    for (const tId of techIds) {
      const tech = await getTechnicianById(tId);
      if (tech) await recalculateAndSaveTechnicianStatus(tech, { docTypes, companies });
    }
  }
};

export const linkCompanyToTechnician = async (techId: string, companyId: string) => {
  await assignTechniciansToCompany(companyId, [techId]);
};

export const unlinkCompanyFromTechnician = async (techId: string, companyId: string) => {
  await supabase
    .from('technician_companies')
    .delete()
    .match({ technician_id: techId, company_id: companyId });

  const tech = await getTechnicianById(techId);
  if (tech) await recalculateAndSaveTechnicianStatus(tech);
};

export const toggleTechnicianStatus = async (techId: string, isActive: boolean) => {
  await supabase.from('technicians').update({ is_active: isActive }).eq('id', techId);
};

export const toggleTechnicianCompanyBlock = async (techId: string, companyId: string, blocked: boolean) => {
  await supabase
    .from('technician_companies')
    .update({ is_blocked: blocked })
    .match({ technician_id: techId, company_id: companyId });
};

// Rodrigo Osorio v0.4 - Fecha de emisión obligatoria también en renovaciones
export const updateCredential = async (
  techId: string,
  credentialId: string,
  newDate: string,
  fileUrl: string | undefined,
  issueDate: string  // Ahora obligatorio también en renovaciones
) => {
  const status = calculateStatus(newDate);
  const updateData: any = {
    expiry_date: newDate,
    status: status,
    issue_date: issueDate  // Siempre actualizar fecha de emisión
  };

  if (fileUrl) {
    updateData.file_url = fileUrl;
  }

  await supabase
    .from('credentials')
    .update(updateData)
    .eq('id', credentialId);

  const tech = await getTechnicianById(techId);
  if (tech) await recalculateAndSaveTechnicianStatus(tech);

  // Invalidar cache
  clearCache(CACHE_KEYS.TECHNICIANS);
};

// Rodrigo Osorio v0.3 - Fecha de emisión obligatoria para nuevos documentos
export const addCredentialToTechnician = async (
  techId: string,
  docTypeId: string,
  expiryDate: string,       // Obligatorio
  fileUrl: string | undefined,
  issueDate: string         // Obligatorio para nuevos documentos
) => {
  const status = calculateStatus(expiryDate);

  const { data: existing } = await supabase
    .from('credentials')
    .select('id')
    .match({ technician_id: techId, document_type_id: docTypeId })
    .single();

  const credData: any = {
    expiry_date: expiryDate,
    status,
    issue_date: issueDate
  };

  if (fileUrl) {
    credData.file_url = fileUrl;
  }

  if (existing) {
    await supabase
      .from('credentials')
      .update(credData)
      .eq('id', existing.id);
  } else {
    await supabase.from('credentials').insert({
      technician_id: techId,
      document_type_id: docTypeId,
      ...credData
    });
  }

  const tech = await getTechnicianById(techId);
  if (tech) await recalculateAndSaveTechnicianStatus(tech);

  // Invalidar cache
  clearCache(CACHE_KEYS.TECHNICIANS);
};

// Rodrigo Osorio v0.2 - Eliminar credencial de tecnico con su archivo
export const deleteCredential = async (credentialId: string, fileUrl?: string) => {
  // Eliminar archivo del storage si existe
  if (fileUrl && fileUrl.includes('technician-docs')) {
    const { deleteDocument, extractPathFromUrl } = await import('./storageService');
    const path = extractPathFromUrl(fileUrl, 'technician');
    if (path) {
      await deleteDocument('technician', path);
    }
  }

  await supabase.from('credentials').delete().eq('id', credentialId);

  // Invalidar cache porque las credenciales afectan estado del técnico
  clearCache(CACHE_KEYS.TECHNICIANS);
};

// Rodrigo Osorio v0.16 - Nueva función para certificar carga en portal externo
export const certifyCredentialInPortal = async (credentialId: string, userId: string): Promise<{ success: boolean; error?: string }> => {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('credentials')
    .update({
      portal_certified_at: now,
      portal_certified_by: userId
    })
    .eq('id', credentialId);

  if (error) {
    console.error("Error certifying credential", error);
    return { success: false, error: error.message };
  }

  // Invalidar cache
  clearCache(CACHE_KEYS.TECHNICIANS);
  return { success: true };
};

// --- COMPANY REQUIREMENTS & CREDENTIALS ---

// Optimizado por Rodrigo Osorio - v0.1: Carga datos una vez y los reutiliza en el loop
// Rodrigo Osorio v0.8 - Usa UPSERT para evitar conflictos 409 en llamadas simultáneas
export const updateCompanyTechRequirements = async (companyId: string, docIds: string[]) => {
  // 1. Obtener requisitos existentes
  const { data: existing } = await supabase
    .from('company_requirements')
    .select('document_type_id')
    .match({ company_id: companyId, requirement_scope: 'TECHNICIAN' });

  const existingIds = new Set((existing || []).map(r => r.document_type_id));
  const newIds = new Set(docIds);

  // 2. Identificar qué eliminar y qué agregar
  const toDelete = [...existingIds].filter(id => !newIds.has(id));
  const toAdd = [...newIds].filter(id => !existingIds.has(id));

  // 3. Eliminar los que ya no están
  if (toDelete.length > 0) {
    await supabase
      .from('company_requirements')
      .delete()
      .match({ company_id: companyId, requirement_scope: 'TECHNICIAN' })
      .in('document_type_id', toDelete);
  }

  // 4. Insertar solo los nuevos (evita conflictos)
  if (toAdd.length > 0) {
    const toInsert = toAdd.map(dId => ({
      company_id: companyId,
      document_type_id: dId,
      requirement_scope: 'TECHNICIAN'
    }));
    await supabase.from('company_requirements').insert(toInsert);
  }

  // 3. Pre-cargar datos para evitar queries en el loop
  const [techs, docTypes, companies] = await Promise.all([
    getTechnicians(),
    getDocumentTypes(),
    getCompanies()
  ]);

  const companyTechs = techs.filter(t => t.companyIds.includes(companyId));

  // Preparar todas las credenciales a insertar en batch
  const credsToInsert: any[] = [];

  for (const tech of companyTechs) {
    for (const dId of docIds) {
      if (!tech.credentials.some(c => c.documentTypeId === dId)) {
        credsToInsert.push({
          technician_id: tech.id,
          document_type_id: dId,
          status: 'PENDING'
        });
      }
    }
  }

  // Insertar todas las credenciales en una sola operacion
  if (credsToInsert.length > 0) {
    await supabase.from('credentials').insert(credsToInsert);
  }

  // Recalcular status usando datos pre-cargados
  for (const tech of companyTechs) {
    await recalculateAndSaveTechnicianStatus(tech, { docTypes, companies });
  }
};

// Rodrigo Osorio v0.5 - Gestionar requisitos documentales de la empresa misma
export const updateCompanyDocRequirements = async (
  companyId: string,
  docIds: string[]
): Promise<{ success: boolean; error?: string }> => {
  try {
    // 1. Obtener requisitos existentes de la empresa (scope COMPANY)
    const { data: existing } = await supabase
      .from('company_requirements')
      .select('document_type_id')
      .match({ company_id: companyId, requirement_scope: 'COMPANY' });

    const existingIds = new Set((existing || []).map(r => r.document_type_id));
    const newIds = new Set(docIds);

    // 2. Identificar qué eliminar y qué agregar
    const toDelete = [...existingIds].filter(id => !newIds.has(id));
    const toAdd = [...newIds].filter(id => !existingIds.has(id));

    // 3. Eliminar los que ya no están
    if (toDelete.length > 0) {
      await supabase
        .from('company_requirements')
        .delete()
        .match({ company_id: companyId, requirement_scope: 'COMPANY' })
        .in('document_type_id', toDelete);
    }

    // 4. Insertar solo los nuevos (evita conflictos)
    if (toAdd.length > 0) {
      const toInsert = toAdd.map(dId => ({
        company_id: companyId,
        document_type_id: dId,
        requirement_scope: 'COMPANY'
      }));
      await supabase.from('company_requirements').insert(toInsert);
    }

    // 5. Crear credenciales pendientes para documentos nuevos requeridos
    const { data: existingCreds } = await supabase
      .from('company_credentials')
      .select('document_type_id')
      .eq('company_id', companyId);

    const existingCredIds = new Set((existingCreds || []).map(c => c.document_type_id));
    const credsToInsert: any[] = [];

    for (const dId of docIds) {
      if (!existingCredIds.has(dId)) {
        credsToInsert.push({
          company_id: companyId,
          document_type_id: dId,
          status: 'PENDING'
        });
      }
    }

    // Insertar credenciales pendientes en batch
    if (credsToInsert.length > 0) {
      await supabase.from('company_credentials').insert(credsToInsert);
    }

    // 6. Invalidar cache
    clearCache(CACHE_KEYS.COMPANIES);

    return { success: true };
  } catch (err: any) {
    console.error('Error al actualizar requisitos de empresa:', err);
    return { success: false, error: err.message || 'Error al actualizar requisitos' };
  }
};

// Rodrigo Osorio v0.5 - Calcular estado de cumplimiento documental de la empresa
export const calculateCompanyCredentialStatus = (
  company: Company,
  allDocTypes: DocumentType[]
): {
  requiredCount: number;
  uploadedCount: number;
  validCount: number;
  complianceScore: number;
  overallStatus: ComplianceStatus;
} => {
  const requiredDocIds = company.requiredDocTypeIdsForCompany || [];
  const credentials = company.credentials || [];

  const requiredCount = requiredDocIds.length;

  if (requiredCount === 0) {
    return {
      requiredCount: 0,
      uploadedCount: 0,
      validCount: 0,
      complianceScore: 100,
      overallStatus: ComplianceStatus.VALID
    };
  }

  // Contar documentos cargados (tienen archivo)
  const uploadedDocs = credentials.filter(c =>
    requiredDocIds.includes(c.documentTypeId) && c.fileUrl
  );
  const uploadedCount = uploadedDocs.length;

  // Contar documentos válidos
  const validDocs = uploadedDocs.filter(c =>
    c.status === ComplianceStatus.VALID || c.status === ComplianceStatus.EXPIRING_SOON
  );
  const validCount = validDocs.length;

  // Calcular score
  const complianceScore = Math.round((validCount / requiredCount) * 100);

  // Determinar estado general
  let overallStatus: ComplianceStatus;
  const hasExpired = credentials.some(c =>
    requiredDocIds.includes(c.documentTypeId) && c.status === ComplianceStatus.EXPIRED
  );
  const hasMissing = uploadedCount < requiredCount;
  const hasExpiringSoon = uploadedDocs.some(c => c.status === ComplianceStatus.EXPIRING_SOON);

  if (hasExpired || hasMissing) {
    overallStatus = ComplianceStatus.EXPIRED;
  } else if (hasExpiringSoon) {
    overallStatus = ComplianceStatus.EXPIRING_SOON;
  } else if (validCount === requiredCount) {
    overallStatus = ComplianceStatus.VALID;
  } else {
    overallStatus = ComplianceStatus.PENDING;
  }

  return {
    requiredCount,
    uploadedCount,
    validCount,
    complianceScore,
    overallStatus
  };
};

// Rodrigo Osorio v0.3 - Fecha de emisión obligatoria para nuevos documentos
export const addCompanyCredential = async (
  companyId: string,
  docTypeId: string,
  expiryDate: string,       // Obligatorio
  fileUrl: string | undefined,
  issueDate: string         // Obligatorio para nuevos documentos
) => {
  const status = calculateStatus(expiryDate);
  const insertData: any = {
    company_id: companyId,
    document_type_id: docTypeId,
    expiry_date: expiryDate,
    status,
    issue_date: issueDate
  };

  if (fileUrl) {
    insertData.file_url = fileUrl;
  }

  const { data, error } = await supabase.from('company_credentials')
    .insert(insertData)
    .select()
    .single();

  if (error) return null;
  return { ...data, companyId: data.company_id } as any;
};

// Rodrigo Osorio v0.2 - Eliminar credencial de empresa con su archivo
export const deleteCompanyCredential = async (companyId: string, credentialId: string, fileUrl?: string) => {
  // Eliminar archivo del storage si existe
  if (fileUrl && fileUrl.includes('company-docs')) {
    const { deleteDocument, extractPathFromUrl } = await import('./storageService');
    const path = extractPathFromUrl(fileUrl, 'company');
    if (path) {
      await deleteDocument('company', path);
    }
  }

  await supabase.from('company_credentials').delete().eq('id', credentialId);
};

// Rodrigo Osorio v0.2 - Actualizado para soportar URLs reales de archivos
export const updateCompanyCredential = async (
  companyId: string,
  credentialId: string,
  newDate: string,
  fileUrl?: string,
  issueDate?: string
) => {
  const status = calculateStatus(newDate);
  const updateData: any = {
    expiry_date: newDate,
    status
  };

  if (fileUrl) {
    updateData.file_url = fileUrl;
  }
  if (issueDate) {
    updateData.issue_date = issueDate;
  }

  await supabase.from('company_credentials').update(updateData).eq('id', credentialId);
};

// --- SETTINGS (Tech Types, Industries) ---
// Rodrigo Osorio v0.2 - CRUD completo para configuraciones

export const getTechTypes = async (): Promise<TechnicianType[]> => {
  const { data } = await supabase.from('technician_types').select('*');
  return data || [];
};

export const addTechType = async (name: string, description: string): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('technician_types').insert({ name, description });
  if (error) {
    console.error('Error adding tech type:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
};

export const deleteTechType = async (id: string): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('technician_types').delete().eq('id', id);
  if (error) {
    console.error('Error deleting tech type:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
};

export const getIndustries = async (): Promise<Industry[]> => {
  const { data } = await supabase.from('industries').select('*');
  return data || [];
};

export const addIndustry = async (name: string): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('industries').insert({ name });
  if (error) {
    console.error('Error adding industry:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
};

export const deleteIndustry = async (id: string): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('industries').delete().eq('id', id);
  if (error) {
    console.error('Error deleting industry:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
};




// Optimizado por Rodrigo Osorio - v0.1: Retorna datos cargados para evitar duplicacion en Dashboard
// v0.14 - Filtrado por sucursales
// Rodrigo Osorio v0.16 - Versión optimizada que solo devuelve contadores para el Dashboard
export const getDashboardStatsSummary = async (branchIds?: string[]) => {
  return await getCachedOrFetch(CACHE_KEYS.DASHBOARD_STATS, async () => {
    // Usar una RPC que solo devuelva los contadores calculados en el servidor
    // Si no existe, usamos una versión ligera aquí
    const [techs, comps, activeAbsences] = await Promise.all([
      getTechniciansLight(branchIds),
      getCompaniesLight(),
      getActiveAbsences()
    ]);

    const absentTechIds = new Set(activeAbsences.map(a => a.technicianId));
    const activeTechs = techs.filter(t => !absentTechIds.has(t.id));

    // Calcular tasa de cumplimiento
    const compliantTechs = activeTechs.filter(t => t.overallStatus === ComplianceStatus.VALID).length;
    const rate = activeTechs.length > 0 ? Math.round((compliantTechs / activeTechs.length) * 100) : 0;

    return {
      totalTechnicians: activeTechs.length,
      totalCompanies: comps.length,
      complianceRate: rate,
      totalCredentials: 0 // Se omiten para performance si no se usan
    };
  }, CACHE_TTL.SHORT);
};

export const logDownloadAudit = async (params: {
  userId: string;
  email: string;
  actionType: 'DOWNLOAD_SINGLE' | 'DOWNLOAD_ZIP';
  resourceName: string;
  resourcePath?: string;
}): Promise<void> => {
  try {
    const { userId, email, actionType, resourceName, resourcePath } = params;
    const [emailEnc, nameEnc, pathEnc] = await Promise.all([
      encryptText(email),
      encryptText(resourceName),
      resourcePath ? encryptText(resourcePath) : Promise.resolve(null)
    ]);
    const { error } = await supabase
      .from('download_audits')
      .insert({
        user_id: userId,
        user_email_enc: emailEnc,
        action_type: actionType,
        resource_name_enc: nameEnc,
        resource_path_enc: pathEnc
      });
    if (error) console.error('Error logging download audit:', error);
  } catch (err) {
    console.error('Unexpected error in logDownloadAudit:', err);
  }
};

/**
 * Rodrigo Osorio v0.17 - Obtener reportes de auditoría de descargas (desencriptados)
 * Solo para administradores.
 */
export const getDownloadAudits = async (): Promise<AuditLog[]> => {
  try {
    const { data, error } = await supabase
      .from('download_audits')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Desencriptar en paralelo para mejor performance
    const decryptedLogs = await Promise.all(data.map(async (log: any) => {
      try {
        const [email, name, path] = await Promise.all([
          decryptText(log.user_email_enc),
          decryptText(log.resource_name_enc),
          log.resource_path_enc ? decryptText(log.resource_path_enc) : Promise.resolve(undefined)
        ]);

        return {
          id: log.id,
          userId: log.user_id,
          userEmail: email,
          actionType: log.action_type,
          resourceName: name,
          resourcePath: path,
          createdAt: log.created_at
        };
      } catch (e) {
        console.error('Error decrypting log entry:', log.id, e);
        return {
          id: log.id,
          userId: log.user_id,
          userEmail: '[ERROR_DECRYPTION]',
          actionType: log.action_type,
          resourceName: '[ERROR_DECRYPTION]',
          createdAt: log.created_at
        };
      }
    }));

    return decryptedLogs;
  } catch (err) {
    console.error('Error fetching download audits:', err);
    return [];
  }
};

export const getDashboardStats = async (branchIds?: string[]) => {
  // Mantener por compatibilidad pero optimizar usando versiones Light
  const [techs, comps, activeAbsences] = await Promise.all([
    getTechnicians(branchIds),
    getCompanies(),
    getActiveAbsences()
  ]);

  const absentTechIds = new Set(activeAbsences.map(a => a.technicianId));
  const activeTechs = techs.filter(t => !absentTechIds.has(t.id));

  const credsCount = activeTechs.reduce((acc, t) => acc + t.credentials.length, 0);

  // Calcular tasa de cumplimiento solo para técnicos activos operacionales
  const compliantTechs = activeTechs.filter(t => t.overallStatus === ComplianceStatus.VALID).length;
  const rate = activeTechs.length > 0 ? Math.round((compliantTechs / activeTechs.length) * 100) : 0;

  return {
    totalTechnicians: activeTechs.length,
    totalCompanies: comps.length,
    totalCredentials: credsCount,
    complianceRate: rate,
    // Retornar datos para reutilizacion
    technicians: activeTechs,
    companies: comps,
    allTechnicians: techs, // Por si se necesita el total absoluto
    activeAbsences
  };
};

/**
 * Obtiene solo los técnicos con problemas (Vencidos, Pendientes, Faltantes)
 * con un límite opcional para performance en el Dashboard.
 */
export const getProblematicTechniciansSummary = async (limit: number = 10, branchIds?: string[]): Promise<Technician[]> => {
  const techs = await getTechnicians(branchIds);
  return techs
    .filter(t =>
      t.overallStatus === ComplianceStatus.EXPIRED ||
      t.overallStatus === ComplianceStatus.MISSING ||
      t.overallStatus === ComplianceStatus.PENDING
    )
    .slice(0, limit);
};


export const getAreaTasks = async (areaId: string): Promise<AreaTask[]> => {
  // Real implementation: Fetch techs, filter by docs in area, check SLA
  const area = (await getAreas()).find(a => a.id === areaId);
  if (!area) return [];

  const techs = await getTechnicians();
  const allDocs = await getDocumentTypes();
  const areaDocs = allDocs.filter(d => d.areaId === areaId);
  const tasks: AreaTask[] = [];

  for (const tech of techs) {
    areaDocs.forEach(doc => {
      const cred = tech.credentials.find(c => c.documentTypeId === doc.id);

      // Check if this doc is actually required for this tech
      const isRequired = doc.isGlobal || tech.companyIds.some(cId => {
        // We'd need to look up company requirements again efficiently
        // For now, assuming if credential exists (even PENDING), it's required
        return true;
      });

      if (!isRequired) return;

      if (!cred || cred.status === ComplianceStatus.MISSING || cred.status === ComplianceStatus.PENDING || cred.status === ComplianceStatus.EXPIRED || cred.status === ComplianceStatus.EXPIRING_SOON) {
        const triggerDate = new Date(); // Ideally this would be the expiry date or creation date of pending cred
        const deadline = area.slaType === 'BUSINESS'
          ? addBusinessDays(triggerDate, area.slaDays)
          : addCalendarDays(triggerDate, area.slaDays);

        tasks.push({
          technicianName: tech.name,
          technicianId: tech.id,
          documentName: doc.name,
          status: cred ? cred.status : ComplianceStatus.MISSING,
          triggerDate,
          deadlineDate: deadline,
          isOverdue: new Date() > deadline
        });
      }
    });
  }
  return tasks;
};

export const getExpiredTechnicians = async () => {
  const techs = await getTechnicians();
  return techs.filter(t => t.overallStatus === ComplianceStatus.EXPIRED || t.overallStatus === ComplianceStatus.MISSING);
};

// =============================================
// EMPRESAS PRESTADORAS DE SERVICIO (EPS)
// Rodrigo Osorio v0.7
// =============================================

// Obtener todas las EPS (usando función RPC segura para datos encriptados)
export const getServiceProviders = async (): Promise<ServiceProvider[]> => {
  const { data, error } = await supabase.rpc('get_all_service_providers_decrypted');

  if (error) { console.error("Error fetching service providers", error); return []; }

  return (data || []).map((sp: any) => ({
    id: sp.id,
    name: sp.name,
    rut: sp.rut,
    industry: sp.industry,
    contactEmail: sp.contact_email,
    contactPhone: sp.contact_phone,
    address: sp.address,
    isActive: sp.is_active,
    createdAt: sp.created_at
  }));
};

// Agregar nueva EPS
export const addServiceProvider = async (sp: Partial<ServiceProvider>): Promise<{ success: boolean; error?: string; id?: string }> => {
  const { data, error } = await supabase
    .from('service_providers')
    .insert({
      name: sp.name,
      rut: sp.rut,
      industry: sp.industry,
      contact_email: sp.contactEmail,
      contact_phone: sp.contactPhone,
      address: sp.address,
      is_active: sp.isActive ?? true
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding service provider", error);
    return { success: false, error: error.message };
  }
  return { success: true, id: data.id };
};

// Eliminar EPS
export const deleteServiceProvider = async (id: string): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase
    .from('service_providers')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Error deleting service provider", error);
    return { success: false, error: error.message };
  }
  return { success: true };
};

// Obtener EPS de un técnico
export const getTechnicianServiceProviders = async (technicianId: string): Promise<ServiceProvider[]> => {
  const { data, error } = await supabase
    .from('technician_service_providers')
    .select(`
      service_provider_id,
      is_active,
      service_providers (*)
    `)
    .eq('technician_id', technicianId)
    .eq('is_active', true);

  if (error) { console.error("Error fetching technician service providers", error); return []; }

  return data.map((row: any) => ({
    id: row.service_providers.id,
    name: row.service_providers.name,
    rut: row.service_providers.rut,
    industry: row.service_providers.industry,
    contactEmail: row.service_providers.contact_email,
    contactPhone: row.service_providers.contact_phone,
    address: row.service_providers.address,
    isActive: row.service_providers.is_active,
    createdAt: row.service_providers.created_at
  }));
};

// Vincular técnico a EPS (Relación 1:1 enforced)
export const linkTechnicianToServiceProvider = async (technicianId: string, serviceProviderId: string): Promise<{ success: boolean; error?: string }> => {
  // Primero desvincular cualquier EPS anterior para asegurar 1:1
  const { error: deleteError } = await supabase
    .from('technician_service_providers')
    .delete()
    .eq('technician_id', technicianId);

  if (deleteError) {
    console.error("Error unlinking previous EPS", deleteError);
  }

  const { error } = await supabase
    .from('technician_service_providers')
    .insert({
      technician_id: technicianId,
      service_provider_id: serviceProviderId,
      is_active: true
    });

  if (error) {
    console.error("Error linking technician to service provider", error);
    return { success: false, error: error.message };
  }
  return { success: true };
};

// Desvincular técnico de EPS
export const unlinkTechnicianFromServiceProvider = async (technicianId: string, serviceProviderId: string): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase
    .from('technician_service_providers')
    .delete()
    .eq('technician_id', technicianId)
    .eq('service_provider_id', serviceProviderId);

  if (error) {
    console.error("Error unlinking technician from service provider", error);
    return { success: false, error: error.message };
  }
  return { success: true };
};

// Obtener EPS de una empresa cliente
export const getCompanyServiceProviders = async (companyId: string): Promise<ServiceProvider[]> => {
  const { data, error } = await supabase
    .from('company_service_providers')
    .select(`
      service_provider_id,
      is_active,
      contract_start,
      contract_end,
      service_providers (*)
    `)
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (error) { console.error("Error fetching company service providers", error); return []; }

  return data.map((row: any) => ({
    id: row.service_providers.id,
    name: row.service_providers.name,
    rut: row.service_providers.rut,
    industry: row.service_providers.industry,
    contactEmail: row.service_providers.contact_email,
    contactPhone: row.service_providers.contact_phone,
    address: row.service_providers.address,
    isActive: row.service_providers.is_active,
    createdAt: row.service_providers.created_at
  }));
};

// Vincular empresa cliente a EPS
export const linkCompanyToServiceProvider = async (companyId: string, serviceProviderId: string): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase
    .from('company_service_providers')
    .upsert({
      company_id: companyId,
      service_provider_id: serviceProviderId,
      is_active: true
    }, { onConflict: 'company_id,service_provider_id' });

  if (error) {
    console.error("Error linking company to service provider", error);
    return { success: false, error: error.message };
  }
  return { success: true };
};

// Desvincular empresa cliente de EPS
export const unlinkCompanyFromServiceProvider = async (companyId: string, serviceProviderId: string): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase
    .from('company_service_providers')
    .delete()
    .eq('company_id', companyId)
    .eq('service_provider_id', serviceProviderId);

  if (error) {
    console.error("Error unlinking company from service provider", error);
    return { success: false, error: error.message };
  }
  return { success: true };
};

export const getAvailableTechniciansForCompany = async (companyId: string): Promise<Technician[]> => {
  // 1. Obtener EPS de la empresa
  const companyEPS = await getCompanyServiceProviders(companyId);
  const companyEPSIds = companyEPS.map(sp => sp.id);

  if (companyEPSIds.length === 0) return [];

  // 2. Obtener IDs de técnicos en esas EPS (Filtrado en servidor)
  const { data: techSPData, error } = await supabase
    .from('technician_service_providers')
    .select('technician_id')
    .in('service_provider_id', companyEPSIds)
    .eq('is_active', true);

  if (error) { console.error("Error fetching available technician IDs", error); return []; }

  const eligibleTechIds = [...new Set(techSPData.map((row: any) => row.technician_id))];

  if (eligibleTechIds.length === 0) return [];

  // 3. Obtener datos completos SOLO de esos técnicos (Targeted query)
  // Usamos una query específica en vez de cargar todos los técnicos del sistema
  // 3. Obtener datos completos SOLO de esos técnicos (Targeted query)
  // Usamos una query específica en vez de cargar todos los técnicos del sistema
  const { data, error: techError } = await supabase.rpc('get_technicians_by_ids_secure', { p_ids: eligibleTechIds });

  if (techError) { console.error("Error fetching available technicians data", techError); return []; }

  return (data || []).map((item: any) => {
    const t = item.j;
    return {
      id: t.id,
      name: t.name,
      rut: t.rut,
      email: t.email,
      phone: t.phone,
      branch: t.branches?.name || '',
      branchId: t.branch_id,
      role: t.role || t.technician_types?.name || '',
      technicianTypeId: t.technician_type_id,
      isActive: t.is_active,
      avatarUrl: t.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=0D8ABC&color=fff`,
      complianceScore: t.compliance_score || 0,
      overallStatus: t.overall_status || ComplianceStatus.PENDING,
      companyIds: (t.technician_companies || []).map((tc: any) => tc.company_id),
      blockedCompanyIds: (t.technician_companies || []).filter((tc: any) => tc.is_blocked).map((tc: any) => tc.company_id),
      credentials: (t.credentials || []).map((c: any) => ({
        id: c.id,
        technicianId: c.technician_id,
        documentTypeId: c.document_type_id,
        documentTypeName: c.document_types?.name || 'Documento',
        fileUrl: c.file_url,
        issueDate: c.issue_date,
        expiryDate: c.expiry_date,
        status: c.status
      }))
    };
  });

};

// =============================================
// ACTUALIZACIONES (UPDATE)
// Rodrigo Osorio v0.8
// =============================================

export const updateServiceProvider = async (id: string, payload: Partial<ServiceProvider>): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase
    .from('service_providers')
    .update({
      name: payload.name,
      rut: payload.rut,
      industry: payload.industry,
      contact_email: payload.contactEmail,
      contact_phone: payload.contactPhone,
      address: payload.address,
      is_active: payload.isActive
    })
    .eq('id', id);

  if (error) {
    console.error("Error updating service provider", error);
    return { success: false, error: error.message };
  }
  return { success: true };
};

// ========================================
// PORTALES DE PROVEEDORES (Rodrigo Osorio v0.12)
// Sistema centralizado de gestión de portales
// ========================================

export const getSupplierPortals = async (): Promise<SupplierPortal[]> => {
  const { data, error } = await supabase
    .from('supplier_portals')
    .select('*')
    .order('name');

  if (error) {
    console.error("Error fetching supplier portals", error);
    return [];
  }

  return data.map((sp: any) => ({
    id: sp.id,
    name: sp.name,
    url: sp.url,
    username: sp.username,
    password: sp.password,
    isActive: sp.is_active,
    createdAt: sp.created_at,
    updatedAt: sp.updated_at
  }));
};

export const getSupplierPortalById = async (id: string): Promise<SupplierPortal | null> => {
  const { data, error } = await supabase
    .from('supplier_portals')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error("Error fetching supplier portal", error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    url: data.url,
    username: data.username,
    password: data.password,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
};

export const addSupplierPortal = async (portal: Partial<SupplierPortal>): Promise<{ success: boolean; error?: string; id?: string }> => {
  const { data, error } = await supabase
    .from('supplier_portals')
    .insert({
      name: portal.name,
      url: portal.url,
      username: portal.username,
      password: portal.password,
      is_active: portal.isActive ?? true
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding supplier portal", error);
    return { success: false, error: error.message };
  }

  return { success: true, id: data.id };
};

export const updateSupplierPortal = async (id: string, payload: Partial<SupplierPortal>): Promise<{ success: boolean; error?: string }> => {
  const updateData: any = {};

  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.url !== undefined) updateData.url = payload.url;
  if (payload.username !== undefined) updateData.username = payload.username;
  if (payload.password !== undefined) updateData.password = payload.password;
  if (payload.isActive !== undefined) updateData.is_active = payload.isActive;

  const { error } = await supabase
    .from('supplier_portals')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error("Error updating supplier portal", error);
    return { success: false, error: error.message };
  }
  return { success: true };
};

export const deleteSupplierPortal = async (id: string): Promise<{ success: boolean; error?: string }> => {
  // Verificar si el portal está en uso por alguna empresa
  const { data: companies, error: checkError } = await supabase
    .from('companies')
    .select('id, name')
    .eq('supplier_portal_id', id)
    .limit(1);

  if (checkError) {
    console.error("Error checking portal usage", checkError);
    return { success: false, error: checkError.message };
  }

  if (companies && companies.length > 0) {
    return {
      success: false,
      error: `No se puede eliminar. El portal está asignado a ${companies.length} empresa(s).`
    };
  }

  const { error } = await supabase
    .from('supplier_portals')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Error deleting supplier portal", error);
    return { success: false, error: error.message };
  }
  return { success: true };
};

// ========================================

export const updateIndustry = async (id: string, name: string): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('industries').update({ name }).eq('id', id);
  if (error) {
    console.error("Error updating industry", error);
    return { success: false, error: error.message };
  }
  return { success: true };
};

export const updateDocumentType = async (id: string, payload: Partial<DocumentType>): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('document_types').update({
    name: payload.name,
    description: payload.description,
    is_active: payload.isActive,
    scope: payload.scope,
    renewal_type: payload.renewalType,
    renewal_frequency: payload.renewalFrequency,
    renewal_unit: payload.renewalUnit,
    renewal_day_of_month: payload.renewalDayOfMonth
  }).eq('id', id);

  if (error) {
    console.error("Error updating document type", error);
    return { success: false, error: error.message };
  }
  return { success: true };
};

export const updateArea = async (id: string, payload: Partial<WorkArea>): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('areas').update({
    name: payload.name,
    sla_days: payload.slaDays,
    sla_type: payload.slaType as any,
    criticality: payload.criticality as any
  }).eq('id', id);

  if (error) {
    console.error("Error updating area", error);
    return { success: false, error: error.message };
  }
  return { success: true };
};

export const updateTechType = async (id: string, payload: Partial<TechnicianType>): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('technician_types').update({
    name: payload.name,
    description: payload.description
  }).eq('id', id);

  if (error) {
    console.error("Error updating technician type", error);
    return { success: false, error: error.message };
  }
  return { success: true };
};

export const updateTechnician = async (id: string, payload: Partial<Technician>): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('technicians').update({
    name: payload.name,
    rut: payload.rut,
    email: payload.email,
    phone: payload.phone,
    branch_id: payload.branch,
    technician_type_id: payload.technicianTypeId
  }).eq('id', id);

  if (error) {
    console.error("Error updating technician", error);
    return { success: false, error: error.message };
  }

  // Invalidar cache
  clearCache(CACHE_KEYS.TECHNICIANS);

  return { success: true };
};

export const updateCompany = async (id: string, payload: Partial<Company>): Promise<{ success: boolean; error?: string }> => {
  const updateData: any = {
    name: payload.name,
    rut: payload.rut,
    industry: payload.industry,
    type: payload.type,
    address: payload.address,
    contact_name: payload.contactName,
    contact_email: payload.contactEmail,
    contact_phone: payload.contactPhone,
    portal_url: payload.portalUrl,
    portal_user: payload.portalUser,
    portal_password: payload.portalPassword
  };

  // Rodrigo Osorio v0.12 - Soporte para portal de proveedores centralizado
  if (payload.supplierPortalId !== undefined) {
    updateData.supplier_portal_id = payload.supplierPortalId;
  }

  const { error } = await supabase.from('companies').update(updateData).eq('id', id);

  if (error) {
    console.error("Error updating company", error);
    return { success: false, error: error.message };
  }

  // Invalidar cache (ambas versiones)
  clearCache(CACHE_KEYS.COMPANIES);
  clearCache(CACHE_KEYS.COMPANIES_LIGHT);

  return { success: true };
};

// =============================================
// CERTIFY AI: BRANCH INTELLIGENCE
// Rodrigo Osorio v1.0
// =============================================

export interface BranchStats {
  id: string;
  name: string;
  location: string;
  companies: {
    companyId: string;
    companyName: string;
    totalTechs: number;
    validTechs: number;
    compliancePercentage: number;
    expiredTechs: Array<{ name: string; rut: string; type: string }>;
  }[];
}

export const getBranchesWithStats = async (): Promise<BranchStats[]> => {
  return getCachedOrFetch<BranchStats[]>('BRANCHES_AI_STATS', async () => {
    try {
      // 1. Cargar datos base en paralelo (aprovechando caché de dataService)
      const [allTechs, allCompanies, { data: branches }] = await Promise.all([
        getTechnicians(),
        getCompanies(),
        supabase.from('branches').select('id, name, location').order('name')
      ]);

      if (!branches) return [];

      // Mapa de empresas para búsqueda rápida de nombre
      const companyMap = new Map(allCompanies.map(c => [c.id, c.name]));

      // 2. Estructura base de resultados
      const branchStatsMap = new Map<string, BranchStats>();
      branches.forEach((b: any) => {
        branchStatsMap.set(b.id, {
          id: b.id,
          name: b.name,
          location: b.location,
          companies: []
        });
      });

      // 3. Auxiliar para agrupar techs por Branch -> Company
      // Estructura: BranchID -> CompanyID -> { total, valid, expiredList }
      const grouping: Record<string, Record<string, { total: number, valid: number, expired: any[] }>> = {};

      allTechs.forEach(t => {
        if (!t.branchId) return; // Técnico sin sucursal
        if (!grouping[t.branchId]) grouping[t.branchId] = {};

        t.companyIds.forEach(compId => {
          if (!grouping[t.branchId][compId]) {
            grouping[t.branchId][compId] = { total: 0, valid: 0, expired: [] };
          }

          const group = grouping[t.branchId][compId];
          group.total++;

          // Criterio de "Habilitado" para esta empresa
          // Simplificado: Si el técnico está VALID overall es válido.
          // (Para más precisión usaríamos el cálculo por empresa, pero overall es buena aprox)
          if (t.overallStatus === 'VALID') {
            group.valid++;
          }

          if (t.overallStatus === 'EXPIRED') {
            group.expired.push({
              name: t.name,
              rut: t.rut,
              type: t.role // Usamos rol como tipo
            });
          }
        });
      });

      // 4. Construir resultado final
      const finalResults: BranchStats[] = [];

      branchStatsMap.forEach((stats, branchId) => {
        const branchGrouping = grouping[branchId] || {};

        const companyStats = Object.entries(branchGrouping).map(([compId, data]) => {
          const compName = companyMap.get(compId) || 'Empresa Desconocida';
          // Calcular porcentaje
          const pct = data.total === 0 ? 0 : Math.round((data.valid / data.total) * 100);

          return {
            companyId: compId,
            companyName: compName,
            totalTechs: data.total,
            validTechs: data.valid,
            compliancePercentage: pct,
            expiredTechs: data.expired
          };
        }).sort((a, b) => b.totalTechs - a.totalTechs); // Ordenar por volumen

        // Agregar solo si tiene empresas
        if (companyStats.length > 0) {
          stats.companies = companyStats;
          finalResults.push(stats);
        }
      });

      return finalResults.sort((a, b) => a.name.localeCompare(b.name));

    } catch (e) {
      console.error("Error building Branch Stats for AI", e);
      return [];
    }
  }, CACHE_TTL.SHORT); // Cache corto para datos vivos
};

// --- HOLIDAYS / FERIADOS (Rodrigo Osorio v0.16) ---

export const getHolidays = async (): Promise<Holiday[]> => {
  const { data, error } = await supabase
    .from('holidays')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    console.error("Error fetching holidays", error);
    return [];
  }

  return (data || []).map(h => ({
    id: h.id,
    date: h.date,
    name: h.name,
    isRecurring: h.is_recurring || false,
    createdAt: h.created_at
  }));
};

export const addHoliday = async (date: string, name: string, isRecurring: boolean = false): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase
    .from('holidays')
    .insert({
      date,
      name,
      is_recurring: isRecurring
    });

  if (error) {
    if (error.code === '23505') { // Unique violation
      return { success: false, error: 'Ya existe un feriado para esta fecha' };
    }
    return { success: false, error: error.message };
  }

  return { success: true };
};

export const deleteHoliday = async (id: string): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase
    .from('holidays')
    .delete()
    .eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
};