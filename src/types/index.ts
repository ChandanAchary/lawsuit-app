// ─── Enums ──────────────────────────────────────────────────
export enum UserRole {
  CLIENT = 'CLIENT',
  LAWYER = 'LAWYER',
  ADMIN = 'ADMIN',
}

export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  ATTENDED = 'ATTENDED',
  MISSED = 'MISSED',
  RESCHEDULED = 'RESCHEDULED',
}

export enum CaseStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  CLOSED = 'CLOSED',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum TransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
  WITHDRAWAL = 'WITHDRAWAL',
  REFUND = 'REFUND',
  PAYMENT = 'PAYMENT',
  TRANSFER = 'TRANSFER',
}

export enum TransactionStatus {
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum NotificationType {
  APPOINTMENT_BOOKED = 'APPOINTMENT_BOOKED',
  APPOINTMENT_CONFIRMED = 'APPOINTMENT_CONFIRMED',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
  APPOINTMENT_REMINDER = 'APPOINTMENT_REMINDER',
  APPOINTMENT_RESCHEDULED = 'APPOINTMENT_RESCHEDULED',
  NEW_MESSAGE = 'NEW_MESSAGE',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  WALLET_CREDIT = 'WALLET_CREDIT',
  WALLET_DEBIT = 'WALLET_DEBIT',
  CONSULTATION_COMPLETED = 'CONSULTATION_COMPLETED',
  REVIEW_RECEIVED = 'REVIEW_RECEIVED',
  CASE_UPDATE = 'CASE_UPDATE',
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
  VIDEO_CALL = 'VIDEO_CALL',
  TASK_ASSIGNED = 'TASK_ASSIGNED',
}

export enum ResolutionMethod {
  TRIAL = 'TRIAL',
  MEDIATION = 'MEDIATION',
  ARBITRATION = 'ARBITRATION',
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

// ─── Interfaces ─────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  isVerified?: boolean;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Lawyer {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  specialization: string[];
  experienceYears: number;
  rating: number;
  fee: number;
  location: string;
  languages: string[];
  isVerified: boolean;
  reviewsCount: number;
  distance?: number;
  bio?: string;
  licenseNumber?: string;
  barCouncilId?: string;
}

export interface Appointment {
  id: string;
  lawyerId: string;
  clientId: string;
  lawyer?: { name: string; avatar?: string; specialization?: string[]; fee?: number };
  client?: { name: string; avatar?: string; email?: string; phone?: string };
  scheduledAt: string;
  durationMins: number;
  status: AppointmentStatus;
  notes?: string;
  meetLink?: string;
  agreementUrl?: string;
  paymentId?: string;
  payment?: { amount: number; status: PaymentStatus };
  caseId?: string;
  createdAt: string;
}

export interface Case {
  id: string;
  caseNumber?: string;
  title: string;
  description?: string;
  category?: string;
  status: CaseStatus;
  resolutionMethod?: ResolutionMethod;
  clientId: string;
  lawyerId: string;
  appointmentId?: string;
  client?: { id: string; name: string; avatar?: string; email?: string; phone?: string };
  lawyer?: { id: string; name: string; avatar?: string; specialization?: string[] };
  court?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  caseId: string;
  name: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  size?: number;
  uploadedBy: string;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  caseId: string;
  title: string;
  description?: string;
  eventDate: string;
  type?: string;
  createdAt: string;
}

export interface Hearing {
  id: string;
  caseId: string;
  date: string;
  court?: string;
  judge?: string;
  purpose?: string;
  outcome?: string;
  notes?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  attachments?: string[];
  createdAt: string;
  readAt?: string;
}

export interface Chat {
  id: string;
  participants: { id: string; name: string; avatar?: string }[];
  lastMessage?: ChatMessage;
  createdAt: string;
}

export interface AgreementTemplate {
  id: string;
  lawyerId: string;
  title: string;
  description?: string;
  content: string;
  category: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  walletId?: string;
  userId?: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  description?: string;
  referenceId?: string;
  counterpartyId?: string;
  bankAccountId?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: { appointmentId?: string; chatId?: string; caseId?: string; referenceId?: string };
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

export interface AvailabilitySlot {
  time: string;
  available: boolean;
}

export interface LawyerFilterOptions {
  search?: string;
  specialization?: string;
  location?: string;
  maxFee?: number;
  language?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

export interface BankAccount {
  id: string;
  userId: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  accountHolderName: string;
  isDefault?: boolean;
}

export interface Review {
  id: string;
  lawyerId: string;
  clientId: string;
  rating: number;
  comment?: string;
  client?: { name: string; avatar?: string };
  createdAt: string;
}
