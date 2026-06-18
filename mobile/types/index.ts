// types/index.ts
// Shared TypeScript types and interfaces matching the Horizon OS Prisma schema.

// ─── Enum-like Types ──────────────────────────────────────────────────────────
export type UserRole = 'OWNER' | 'ADMIN' | 'PERM_EMPLOYEE' | 'TEMP_EMPLOYEE';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'HOLIDAY';

export type JobStatus =
  | 'ASSIGNED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'VERIFIED'
  | 'CANCELLED';

export type JobType = 'REPAIR' | 'INSTALLATION' | 'MAINTENANCE' | 'INSPECTION' | 'DELIVERY';

export type ToolCondition = 'GOOD' | 'FAIR' | 'DAMAGED' | 'LOST' | 'RETIRED';

export type ToolIssuanceStatus = 'ISSUED' | 'RETURNED' | 'LOST' | 'DAMAGED';

export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type SyncDirection = 'UPLOAD' | 'DOWNLOAD';

export type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED' | 'CONFLICT';

// ─── Core Interfaces ──────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  employmentType: string;
  baseSalary: number;
  workStartTime: string;
  employmentStart: string;
  employmentEnd?: string | null;
  phone?: string | null;
  deviceToken?: string | null;
  isActive: boolean;
  firmId: number;
  createdAt: string;
  updatedAt: string;
}

export interface Firm {
  id: number;
  name: string;
  gstin?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
  id: number;
  userId: number;
  date: string;
  checkInTime?: string | null;
  checkInLat?: number | null;
  checkInLng?: number | null;
  checkInPhoto?: string | null;
  checkOutTime?: string | null;
  lateMinutes: number;
  status: AttendanceStatus;
  firmId: number;
  createdAt: string;
  updatedAt: string;
  user?: User;
  firm?: Firm;
}

export interface PerformanceReport {
  id: number;
  userId: number;
  month: number;
  year: number;
  totalPresent: number;
  totalAbsent: number;
  totalLateDays: number;
  totalLateMinutes: number;
  jobsCompleted: number;
  toolIncidents: number;
  disciplineScore: number;
  baseSalary: number;
  deductionAmount: number;
  deductionReason?: string | null;
  bonusAmount: number;
  bonusReason?: string | null;
  ownerApproved: boolean;
  approvedById?: number | null;
  approvedAt?: string | null;
  finalSalary: number;
  firmId: number;
  createdAt: string;
  updatedAt: string;
  user?: User;
  approvedBy?: User | null;
  firm?: Firm;
}

export interface Tool {
  id: number;
  name: string;
  toolCode: string;
  category: string;
  condition: ToolCondition;
  currentHolderId?: number | null;
  purchasePrice: number;
  replacementCost: number;
  photoUrl?: string | null;
  notes?: string | null;
  isActive: boolean;
  firmId: number;
  createdAt: string;
  updatedAt: string;
  currentHolder?: User | null;
  firm?: Firm;
}

export interface ToolIssuance {
  id: number;
  toolId: number;
  userId: number;
  jobCardId?: number | null;
  issuedAt: string;
  returnedAt?: string | null;
  issuedCondition: ToolCondition;
  returnCondition?: ToolCondition | null;
  penaltyAmount: number;
  penaltyApproved: boolean;
  penaltyNote?: string | null;
  status: ToolIssuanceStatus;
  firmId: number;
  createdAt: string;
  updatedAt: string;
  tool?: Tool;
  user?: User;
  jobCard?: JobCard | null;
  firm?: Firm;
}

export interface ConsumableMaterial {
  id: number;
  name: string;
  materialCode: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  purchasePrice: number;
  category?: string | null;
  shelfLocation?: string | null;
  isActive: boolean;
  firmId: number;
  createdAt: string;
  updatedAt: string;
  firm?: Firm;
}

export interface MaterialUsageLog {
  id: number;
  materialId: number;
  userId: number;
  jobCardId?: number | null;
  quantityTaken: number;
  quantityUsed: number;
  quantityReturned: number;
  overuseFlag: boolean;
  ownerReviewed: boolean;
  takenAt: string;
  completedAt?: string | null;
  notes?: string | null;
  firmId: number;
  createdAt: string;
  updatedAt: string;
  material?: ConsumableMaterial;
  user?: User;
  jobCard?: JobCard | null;
  firm?: Firm;
}

export interface JobCard {
  id: number;
  jobNumber: string;
  clientName: string;
  clientPhone?: string | null;
  siteAddress?: string | null;
  mapsLink?: string | null;
  jobType: JobType;
  equipmentNotes?: string | null;
  notes?: string | null;
  assignedToId: number;
  scheduledDate: string;
  estimatedDuration?: string | null;
  status: JobStatus;
  arrivedAt?: string | null;
  arrivedLat?: number | null;
  arrivedLng?: number | null;
  completedAt?: string | null;
  verifiedAt?: string | null;
  verifiedById?: number | null;
  workSummary?: string | null;
  completionPhoto?: string | null;
  issuesFound?: string | null;
  nextVisitNeeded: boolean;
  clientId?: number | null;
  createdById: number;
  firmId: number;
  createdAt: string;
  updatedAt: string;
  assignedTo?: User;
  createdBy?: User;
  verifiedBy?: User | null;
  siteVisits?: SiteVisit[];
  toolIssuances?: ToolIssuance[];
  materialUsageLogs?: MaterialUsageLog[];
  firm?: Firm;
}

export interface SiteVisit {
  id: number;
  jobCardId: number;
  userId: number;
  arrivedAt: string;
  arrivedLat?: number | null;
  arrivedLng?: number | null;
  departedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  jobCard?: JobCard;
  user?: User;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  purchasePrice: number;
  minSellingPrice: number;
  maxSellingPrice: number;
  customerPrice: number;
  currentStock: number;
  reorderLevel: number;
  shelfLocation?: string | null;
  unit: string;
  isActive: boolean;
  firmId: number;
  createdAt: string;
  updatedAt: string;
  firm?: Firm;
}

export interface Sale {
  id: number;
  productId: number;
  userId: number;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  purchasePriceSnapshot: number;
  marginAmount: number;
  marginPercent: number;
  clientId?: number | null;
  notes?: string | null;
  firmId: number;
  createdAt: string;
  updatedAt: string;
  product?: Product;
  user?: User;
  firm?: Firm;
}

export interface AntifraudFlag {
  id: number;
  userId: number;
  productId: number;
  flagType: string;
  details?: string | null;
  consecutiveCount: number;
  reviewed: boolean;
  reviewedById?: number | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  firmId: number;
  createdAt: string;
  updatedAt: string;
  user?: User;
  product?: Product;
  reviewedBy?: User | null;
  firm?: Firm;
}

export interface QuotationItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Quotation {
  id: number;
  quotationNumber: string;
  clientName: string;
  clientPhone?: string | null;
  clientAddress?: string | null;
  validityDays: number;
  items: string; // Stored as JSON string
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  status: QuotationStatus;
  pdfUrl?: string | null;
  whatsappSent: boolean;
  sentAt?: string | null;
  convertedInvoiceId?: number | null;
  assignedToId?: number | null;
  notes?: string | null;
  firmId: number;
  createdAt: string;
  updatedAt: string;
  assignedTo?: User | null;
  firm?: Firm;
}

export interface SystemAlert {
  id: number;
  type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  relatedEntity?: string | null;
  relatedId?: number | null;
  targetUserId?: number | null;
  isRead: boolean;
  isDismissed: boolean;
  firmId: number;
  createdAt: string;
  updatedAt: string;
  targetUser?: User | null;
  firm?: Firm;
}

export interface SyncLog {
  id: number;
  deviceId: string;
  userId: number;
  direction: SyncDirection;
  entity: string;
  entityId?: number | null;
  action: SyncAction;
  payload?: string | null; // Stored as JSON string
  syncedAt?: string | null;
  status: SyncStatus;
  errorMessage?: string | null;
  createdAt: string;
  user?: User;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface AuthUser {
  id: number;
  firmId: number;
  username: string;
  fullName: string;
  role: UserRole;
  email?: string | null;
  phone?: string | null;
}

export interface SyncQueueItem {
  id: number;
  entity: string;
  entityId: string;
  action: SyncAction;
  payload: string;
  createdAt: string;
  synced: number;
}
