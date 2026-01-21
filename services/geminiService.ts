// Rodrigo Osorio v0.6 - Servicio Certify AI con soporte EPS
import { supabase } from './supabaseClient';
import { getTechnicians, getCompanies, getServiceProviders, getBranchesWithStats } from './dataService';
import { logger } from './logger';

export interface AIResponse {
  answer: string;
  success: boolean;
  error?: string;
}

// Verifica si el contexto está vacío o no tiene datos útiles
const isEmptyContext = (ctx: any): boolean => {
  if (!ctx) return true;
  if (typeof ctx !== 'object') return true;
  if (Object.keys(ctx).length === 0) return true;
  // Verificar si tiene técnicos o empresas con datos
  const hasTechs = ctx.technicians && Array.isArray(ctx.technicians) && ctx.technicians.length > 0;
  const hasCompanies = ctx.companies && Array.isArray(ctx.companies) && ctx.companies.length > 0;
  return !hasTechs && !hasCompanies;
};

// Obtiene relaciones técnico-EPS en batch
const getTechnicianEPSRelations = async (): Promise<Map<string, string[]>> => {
  const { data, error } = await supabase
    .from('technician_service_providers')
    .select('technician_id, service_provider_id')
    .eq('is_active', true);

  if (error || !data) return new Map();

  const map = new Map<string, string[]>();
  for (const row of data) {
    const existing = map.get(row.technician_id) || [];
    existing.push(row.service_provider_id);
    map.set(row.technician_id, existing);
  }
  return map;
};

// Obtiene relaciones empresa-EPS en batch
const getCompanyEPSRelations = async (): Promise<Map<string, string[]>> => {
  const { data, error } = await supabase
    .from('company_service_providers')
    .select('company_id, service_provider_id')
    .eq('is_active', true);

  if (error || !data) return new Map();

  const map = new Map<string, string[]>();
  for (const row of data) {
    const existing = map.get(row.company_id) || [];
    existing.push(row.service_provider_id);
    map.set(row.company_id, existing);
  }
  return map;
};

export interface AIResponse {
  answer: string;
  suggestions: string[];
}

export const sendMessageToAssistant = async (message: string, contextData?: any): Promise<AIResponse> => {
  try {
    let clientContext = contextData;

    // Si no hay contexto o está vacío, obtener datos frescos de la DB
    if (isEmptyContext(clientContext)) {
      try {
        // Obtener datos en paralelo incluyendo EPS y Sucursales
        const [techData, companyData, epsData, techEPSMap, companyEPSMap, branchStats] = await Promise.all([
          getTechnicians(),
          getCompanies(),
          getServiceProviders(),
          getTechnicianEPSRelations(),
          getCompanyEPSRelations(),
          getBranchesWithStats()
        ]);

        // Crear mapa de EPS por ID para lookup rápido
        const epsById = new Map(epsData.map(eps => [eps.id, eps.name]));

        // --- 1. PROCESAMIENTO GLOBAL ---
        let totalTechs = techData.length;
        let totalCompliant = 0;
        let totalExpiredDocs = 0;
        let docsExpiringWeek = 0;
        const now = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(now.getDate() + 7);

        // Mapa de Empresas para lookup rápido
        const companyMap = new Map(companyData.map(c => [c.id, c.name]));

        // --- 2. PROCESAMIENTO DE TÉCNICOS ---
        // Enriquecer y Ordenar técnicos
        const enrichedTechnicians = techData.map(t => {
          const techEPSIds = techEPSMap.get(t.id) || [];
          const techEPSNames = techEPSIds.map(id => epsById.get(id)).filter(Boolean);

          // Resolver nombres de empresas directamente
          const companyNames = (t.companyIds || []).map(id => companyMap.get(id)).filter(Boolean);

          let techExpiredDocs = 0;
          let techExpiringSoon = 0;
          let hasCritical = false;

          // Analizar credenciales
          const refinedCredentials = t.credentials?.map(c => {
            let statusEs = c.status;
            const expiryDate = c.expiryDate ? new Date(c.expiryDate) : null;

            if (c.status === 'EXPIRED') {
              statusEs = '!!VENCIDO!!';
              techExpiredDocs++;
              totalExpiredDocs++;
              hasCritical = true;
            } else if (c.status === 'PENDING') {
              statusEs = 'Pendiente';
            } else if (c.status === 'APPROVED') {
              statusEs = 'Aprobado';
            }

            if (expiryDate && expiryDate <= nextWeek && expiryDate >= now) {
              docsExpiringWeek++;
              techExpiringSoon++;
            }

            return {
              type: c.documentTypeName,
              status: statusEs,
              expiry: c.expiryDate
            };
          }) || [];

          if (t.overallStatus === 'VALID' || t.overallStatus === 'APPROVED') totalCompliant++;

          return {
            id: t.id,
            name: t.name,
            rut: t.rut,
            companies: companyNames, // Ahora sabe en qué empresas trabaja
            status: t.overallStatus === 'EXPIRED' ? '!!VENCIDO!!' :
              t.overallStatus === 'PENDING' ? 'Pendiente' :
                t.overallStatus === 'VALID' ? 'Aprobado' : t.overallStatus,
            score: t.complianceScore,
            eps: techEPSNames,
            credentials: refinedCredentials.slice(0, 10),
            stats: {
              expired: techExpiredDocs,
              expiringSoon: techExpiringSoon,
              totalDocs: refinedCredentials.length
            },
            isCritical: hasCritical
          };
        }).sort((a, b) => {
          if (a.isCritical && !b.isCritical) return -1;
          if (!a.isCritical && b.isCritical) return 1;
          return (a.score || 0) - (b.score || 0);
        });

        // --- 3. PROCESAMIENTO DE EMPRESAS (Corrección Lógica) ---
        const enrichedCompanies = companyData.map(c => {
          // Filtrar técnicos que pertenecen explícitamente a esta empresa
          const companyTechs = techData.filter(t => t.companyIds && t.companyIds.includes(c.id));

          const compTotalTechs = companyTechs.length;
          const compValidTechs = companyTechs.filter(t => t.overallStatus === 'VALID' || t.overallStatus === 'APPROVED').length;
          const complianceRate = compTotalTechs > 0 ? Math.round((compValidTechs / compTotalTechs) * 100) : 0;

          const compExpiredDocs = companyTechs.reduce((acc, t) => {
            // Solo contar documentos que afectan a esta empresa? 
            // Por simplicidad contamos todos los vencidos del técnico, 
            // idealmente filtraríamos credentials por companyId si tuvieramos esa data granular aquí.
            return acc + (t.credentials?.filter(cr => cr.status === 'EXPIRED').length || 0);
          }, 0);

          // Technicians names for context
          const techNames = companyTechs.map(t => t.name).slice(0, 50); // Limit to avoid context overflow

          const compEPSIds = companyEPSMap.get(c.id) || [];
          const compEPSNames = compEPSIds.map(id => epsById.get(id)).filter(Boolean);

          return {
            id: c.id,
            name: c.name,
            industry: c.industry,
            eps: compEPSNames,
            stats: {
              complianceRate: `${complianceRate}%`,
              totalTechs: compTotalTechs,
              validTechs: compValidTechs,
              expiredDocsGlobal: compExpiredDocs
            },
            techniciansVignette: techNames
          };
        }).sort((a, b) => {
          // Sort by lowest compliance rate ascending
          return parseInt(a.stats.complianceRate) - parseInt(b.stats.complianceRate);
        });

        // --- 4. PROCESAMIENTO DE EPS ---
        const enrichedEPS = epsData.map(eps => {
          // Empresas atendidas (Direct relationship)
          const servedCompanies = companyData.filter(c => {
            const cEps = companyEPSMap.get(c.id) || [];
            return cEps.includes(eps.id);
          }).map(c => c.name);

          // Técnicos en esta EPS (Direct relationship)
          const epsTechsCount = techData.filter(t => {
            const tEps = techEPSMap.get(t.id) || [];
            return tEps.includes(eps.id);
          }).length;

          return {
            name: eps.name,
            servedCompanies: servedCompanies,
            techCount: epsTechsCount,
            coverage: servedCompanies.length > 0 ? 'Activa' : 'Sin asignación'
          };
        });

        // --- CONTEXTO FINAL ---
        clientContext = {
          globalStats: {
            totalTechnicians: totalTechs,
            compliancePercentage: totalTechs > 0 ? Math.round((totalCompliant / totalTechs) * 100) + '%' : '0%',
            totalExpiredDocuments: totalExpiredDocs,
            documentsExpiringThisWeek: docsExpiringWeek,
            urgentCases: enrichedTechnicians.filter(t => t.isCritical).length
          },
          technicians: enrichedTechnicians.slice(0, 50),
          companies: enrichedCompanies,
          epsToCompaniesMapping: enrichedEPS, // Renombrado para mayor claridad del AI
        };
      } catch (err) {
        logger.error("Error building AI context:", err);
        clientContext = { technicians: [], companies: [], serviceProviders: [], globalStats: {} };
      }
    }

    // Get current user ID for quota tracking
    const { data: { user } } = await supabase.auth.getUser();

    // Llamar a la Edge Function (context is built server-side now)
    const { data, error } = await supabase.functions.invoke('certify-ai', {
      body: { message, userId: user?.id }
    });

    if (error) {
      logger.error("Edge Function Error:", error);

      // Si la función no existe, dar instrucciones
      if (error.message?.includes('not found') || error.message?.includes('404')) {
        return {
          answer: `La función Certify AI no está configurada. 

Para activarla:
1. Ve al Dashboard de Supabase
2. Navega a Edge Functions
3. Despliega la función 'certify-ai'
4. Configura el secret GEMINI_API_KEY`,
          suggestions: []
        };
      }

      throw error;
    }

    return {
      answer: data?.answer || "No se recibió respuesta del asistente.",
      suggestions: data?.suggestions || []
    };

  } catch (error: any) {
    logger.error("Certify AI Error:", error);

    // Mensajes de error más amigables
    if (error.message?.includes('rate limit') || error.message?.includes('429')) {
      return { answer: "Has alcanzado el límite de consultas. Espera un momento antes de intentar de nuevo.", suggestions: [] };
    }

    if (error.message?.includes('GEMINI_API_KEY')) {
      return { answer: "La API de Gemini no está configurada. Contacta al administrador.", suggestions: [] };
    }

    return { answer: `Error al conectar con Certify AI: ${error.message || 'Error desconocido'}`, suggestions: [] };
  }
};

// Función para verificar si el servicio está disponible
export const checkAIServiceStatus = async (): Promise<{ available: boolean; message: string }> => {
  try {
    const { error } = await supabase.functions.invoke('certify-ai', {
      body: { message: 'ping' }
    });

    if (error) {
      return { available: false, message: error.message };
    }

    return { available: true, message: 'Servicio disponible' };
  } catch (err: any) {
    return { available: false, message: err.message || 'Error de conexión' };
  }
};