export enum ComplianceStatus {
  VALID = 'VALID',
  EXPIRING_SOON = 'EXPIRING_SOON', // Within 30 days
  EXPIRED = 'EXPIRED',
  MISSING = 'MISSING',
  PENDING = 'PENDING'
}

export type SLAType = 'CALENDAR' | 'BUSINESS';
export type DocScope = 'TECHNICIAN' | 'COMPANY';
export type RenewalType = 'FIXED' | 'PERIODIC';
export type RenewalUnit = 'DAYS' | 'MONTHS';

export interface DocumentType {
  id: string;
  name: string;
  description?: string;
  areaId?: string; // The area responsible

  // New Configuration Fields
  scope: DocScope;
  isGlobal: boolean;
  isActive: boolean;

  renewalType: RenewalType;
  // If Periodic
  renewalFrequency?: number;
  renewalUnit?: RenewalUnit;
  // If Periodic + Company + Months
  renewalDayOfMonth?: number;

  // Legacy/Computed
  validityDays?: number;
  industryIds?: string[];
}

export interface CompanyCredential {
  id: string;
  companyId: string;
  documentTypeId: string;
  documentTypeName: string;
  fileUrl?: string;
  issueDate?: string;
  expiryDate?: string;
  status: ComplianceStatus;
}

export interface Company {
  id: string;
  name: string;
  rut: string;
  industry: string;
  type: 'HOLDING' | 'SUBSIDIARY';
  logoUrl?: string;

  // Extended Info
  address?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;

  // Portal de Proveedores (Rodrigo Osorio v0.12)
  supplierPortalId?: string; // ID del portal asignado
  supplierPortal?: SupplierPortal; // Objeto completo del portal (cuando se hace join)

  // Legacy portal fields (mantener para retrocompatibilidad)
  portalUrl?: string;
  portalUser?: string;
  portalPassword?: string;

  // Hierarchy
  holdingId?: string; // ID of the parent holding if this is a subsidiary

  // Document Requirements
  requiredDocTypes: string[]; // IDs of required documents for TECHNICIANS working here
  requiredDocTypeIdsForCompany: string[]; // IDs of required documents for the COMPANY itself

  // Own Credentials
  credentials?: CompanyCredential[];
}

export interface Industry {
  id: string;
  name: string;
}

export interface TechnicianType {
  id: string;
  name: string;
  description?: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'ACTIVE' | 'INACTIVE';
  lastLogin?: string;
  assignedBranchIds?: string[]; // Branches assigned to this user (for Gerente de Sucursal)
}

export interface Credential {
  id: string;
  technicianId: string;
  documentTypeId: string;
  documentTypeName: string;
  fileUrl?: string;
  issueDate?: string;
  expiryDate?: string;
  status: ComplianceStatus;
  portalCertifiedAt?: string;
  portalCertifiedBy?: string;
  portalCertifiedByName?: string;
}

export interface Technician {
  id: string;
  name: string;
  rut: string;
  email: string;
  phone?: string;
  branch: string; // Nombre de la sucursal (display)
  branchId?: string; // ID de la sucursal (para edicion)
  role: string; // e.g. Electricista
  technicianTypeId?: string;
  avatarUrl?: string;

  isActive: boolean; // Global status

  companyIds: string[];
  blockedCompanyIds?: string[]; // Companies where this tech is blocked

  credentials: Credential[];
  // Computed fields
  complianceScore: number;
  overallStatus: ComplianceStatus;
}

export interface Branch {
  id: string;
  name: string;
  location: string;
  technicianCount: number;
  complianceScore: number;
}

export interface WorkArea {
  id: string;
  name: string;
  slaDays: number;
  slaType: SLAType;
  criticality: 'HIGH' | 'MEDIUM' | 'LOW';
  complianceScore: number;
}

export interface AreaTask {
  technicianName: string;
  technicianId: string;
  documentName: string;
  status: ComplianceStatus;
  triggerDate: Date; // When it expired or went missing
  deadlineDate: Date; // Calculated based on SLA
  isOverdue: boolean;
}

// Portal de Proveedores (Rodrigo Osorio v0.12)
export interface SupplierPortal {
  id: string;
  name: string;
  url: string;
  username?: string;
  password?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Empresa Prestadora de Servicio (EPS)
export interface ServiceProvider {
  id: string;
  name: string;
  rut?: string;
  industry?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  isActive: boolean;
  createdAt?: string;
}

// Relación Técnico <-> EPS
export interface TechnicianServiceProvider {
  id: string;
  technicianId: string;
  serviceProviderId: string;
  serviceProviderName?: string; // Para mostrar en UI
  joinedAt?: string;
  isActive: boolean;
}

// Relación Empresa Cliente <-> EPS
export interface CompanyServiceProvider {
  id: string;
  companyId: string;
  serviceProviderId: string;
  serviceProviderName?: string; // Para mostrar en UI
  contractStart?: string;
  contractEnd?: string;
  isActive: boolean;
}

// Ausencias / Disponibilidad (Rodrigo Osorio v0.15)
export type AbsenceType = 'VACATION' | 'MEDICAL_LEAVE' | 'OTHER';

export interface TechnicianAbsence {
  id: string;
  technicianId: string;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  comments?: string;
  createdAt?: string;
}

export type AvailabilityStatus = 'AVAILABLE' | 'VACATION' | 'MEDICAL_LEAVE' | 'OTHER';

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  actionType: string;
  resourceName: string;
  resourcePath?: string;
  createdAt: string;
}

// Feriados nacionales (Rodrigo Osorio v0.16)
export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  isRecurring: boolean;
  createdAt?: string;
}