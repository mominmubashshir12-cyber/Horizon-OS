// Shared TypeScript types and interfaces for the entire Horizon OS backend.

import { Request } from 'express';

// ─── ENUMS / UNION TYPES ───────────────────────────────────────────────────────

export type UserRole = 'OWNER' | 'ADMIN' | 'PERM_EMPLOYEE' | 'TEMP_EMPLOYEE';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'HOLIDAY';

export type JobStatus =
  | 'UNASSIGNED'
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

export type FlagType =
  | 'BELOW_MIN_PRICE'
  | 'CONSECUTIVE_MIN_PRICE'
  | 'UNUSUAL_DISCOUNT'
  | 'HIGH_VOLUME'
  | 'PRICE_OVERRIDE';

// ─── API RESPONSE ──────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

// ─── AUTH TYPES ────────────────────────────────────────────────────────────────

export interface TokenPayload {
  userId: number;
  username: string;
  role: UserRole;
  firmId: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    username: string;
    fullName: string;
    role: UserRole;
    firmId: number;
  };
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

// ─── USER ──────────────────────────────────────────────────────────────────────

export interface CreateUserRequest {
  username: string;
  password: string;
  fullName: string;
  role?: UserRole;
  employmentType?: string;
  baseSalary?: number;
  workStartTime?: string;
  phone?: string;
  firmId?: number;
}

export interface UpdateUserRequest {
  fullName?: string;
  role?: UserRole;
  employmentType?: string;
  baseSalary?: number;
  workStartTime?: string;
  phone?: string;
  deviceToken?: string;
  isActive?: boolean;
  employmentEnd?: string;
}

// ─── ATTENDANCE ────────────────────────────────────────────────────────────────

export interface CheckInRequest {
  userId: number;
  latitude?: number;
  longitude?: number;
  photo?: string;
}

export interface CheckOutRequest {
  userId: number;
}

// ─── JOB CARD ──────────────────────────────────────────────────────────────────

export interface CreateJobCardRequest {
  clientName: string;
  clientPhone?: string;
  siteAddress?: string;
  mapsLink?: string;
  jobType?: JobType;
  equipmentNotes?: string;
  notes?: string;
  assignedEmployeeIds?: number[];
  requiredTools?: number[];
  requiredMaterials?: { materialId: number; quantity: number }[];
  scheduledDate: string;
  estimatedDuration?: string;
}

export interface UpdateJobStatusRequest {
  status: JobStatus;
  latitude?: number;
  longitude?: number;
  workSummary?: string;
  completionPhoto?: string;
  issuesFound?: string;
  nextVisitNeeded?: boolean;
}

// ─── TOOL ──────────────────────────────────────────────────────────────────────

export interface CreateToolRequest {
  name: string;
  toolCode: string;
  category: string;
  condition?: ToolCondition;
  purchasePrice?: number;
  replacementCost?: number;
  photoUrl?: string;
  notes?: string;
}

export interface IssueToolRequest {
  toolId: number;
  userId: number;
  jobCardId?: number;
  condition?: ToolCondition;
}

export interface ReturnToolRequest {
  returnCondition: ToolCondition;
  penaltyAmount?: number;
  penaltyNote?: string;
}

// ─── MATERIAL ──────────────────────────────────────────────────────────────────

export interface CreateMaterialRequest {
  name: string;
  materialCode: string;
  unit: string;
  currentStock?: number;
  reorderLevel?: number;
  purchasePrice?: number;
  category?: string;
  shelfLocation?: string;
}

export interface TakeMaterialRequest {
  materialId: number;
  userId: number;
  jobCardId?: number;
  quantityTaken: number;
  notes?: string;
}

// ─── PRODUCT / SALE ────────────────────────────────────────────────────────────

export interface CreateProductRequest {
  name: string;
  sku: string;
  category: string;
  purchasePrice?: number;
  minSellingPrice?: number;
  maxSellingPrice?: number;
  customerPrice?: number;
  currentStock?: number;
  reorderLevel?: number;
  shelfLocation?: string;
  unit?: string;
}

export interface CreateSaleRequest {
  productId: number;
  quantity: number;
  unitPrice: number;
  clientId?: number;
  notes?: string;
}

// ─── QUOTATION ─────────────────────────────────────────────────────────────────

export interface QuotationItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface CreateQuotationRequest {
  clientName: string;
  clientPhone?: string;
  clientAddress?: string;
  validityDays?: number;
  items: QuotationItem[];
  notes?: string;
  assignedToId?: number;
}

// ─── SYSTEM ALERT ──────────────────────────────────────────────────────────────

export interface CreateAlertRequest {
  type: string;
  severity?: AlertSeverity;
  title: string;
  message: string;
  relatedEntity?: string;
  relatedId?: number;
  targetUserId?: number;
}

// ─── SYNC ──────────────────────────────────────────────────────────────────────

export interface SyncPayload {
  deviceId: string;
  direction: SyncDirection;
  entity: string;
  entityId?: number;
  action: SyncAction;
  payload?: Record<string, unknown>;
}

// ─── PAGINATION ────────────────────────────────────────────────────────────────

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
