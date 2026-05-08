import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { storage } from './storage';
import { getRuntimeApiUrl, maybeRefreshRuntimeApiConfig } from './runtimeApiConfig';

let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];
// Lazy reference to auth store to avoid circular import
let _resetAuth: (() => void) | null = null;
const getResetAuth = () => {
  if (!_resetAuth) {
    const { useAuthStore } = require('../stores/authStore');
    _resetAuth = () => useAuthStore.getState().logout();
  }
  return _resetAuth;
};

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
};

const shouldSkipRefreshForRequest = (url?: string): boolean => {
  if (!url) return false;

  // Ignore query string and support relative or absolute URLs.
  const cleanUrl = url.split('?')[0] || '';

  return (
    cleanUrl.includes('/auth/login') ||
    cleanUrl.includes('/auth/register') ||
    cleanUrl.includes('/auth/verify-otp') ||
    cleanUrl.includes('/auth/request-otp') ||
    cleanUrl.includes('/auth/restore-password') ||
    cleanUrl.includes('/auth/logout') ||
    cleanUrl.includes('/auth/refresh')
  );
};

const shouldInvalidateSessionOnRefreshError = (error: any): boolean => {
  const status = error?.response?.status;
  if (status === 401 || status === 403) return true;

  const message = String(
    error?.response?.data?.error || error?.response?.data?.message || error?.message || ''
  ).toLowerCase();

  // Some APIs use 400 for invalid/expired refresh tokens.
  if (status === 400 && /(refresh|token|jwt|session|expired|invalid)/.test(message)) {
    return true;
  }

  return false;
};

const api: AxiosInstance = axios.create({
  baseURL: getRuntimeApiUrl(),
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  await maybeRefreshRuntimeApiConfig();
  config.baseURL = getRuntimeApiUrl();
  const token = await storage.getToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const shouldSkipRefresh = shouldSkipRefreshForRequest(originalRequest?.url);
    if (error.response?.status === 401 && !originalRequest?._retry && !shouldSkipRefresh) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const refreshToken = await storage.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${getRuntimeApiUrl()}/auth/refresh`, { refreshToken });
        const newToken = data.accessToken || data.token;
        await storage.setToken(newToken);
        if (data.refreshToken) await storage.setRefreshToken(data.refreshToken);
        processQueue(null, newToken);
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (shouldInvalidateSessionOnRefreshError(refreshError)) {
          await storage.clear();
          try { getResetAuth()(); } catch {}
        }
        throw refreshError;
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

// ─── Auth API ───────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: string;
    courtId?: string;
    courtDetails?: {
      name: string;
      type: string;
      address: string;
      pincode: string;
      state: string;
      district: string;
      city?: string;
    };
    registrationNumber?: string;
  }) =>
    api.post('/auth/register', data),
  verifyOtp: (identifier: string, code: string) => api.post('/auth/verify-otp', { identifier, code }),
  requestOtp: (identifier: string) => api.post('/auth/request-otp', { identifier }),
  getMe: () => api.get('/auth/me'),
  restorePassword: (identifier: string, code: string, password: string) =>
    api.put('/auth/restore-password', { identifier, code, password }),
  // Required for org-onboarded lawyers and super-admin-invited admins on first
  // login. Server-side mustChangePasswordGuard returns 403 on all other routes
  // until this clears.
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  logout: () => api.post('/auth/logout'),
};

// ─── Lawyers API ────────────────────────────────────────────
export const lawyersApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/lawyers', { params }),
  getById: (id: string) => api.get(`/lawyers/${encodeURIComponent(id)}`),
  getPublicProfile: (id: string) => api.get(`/lawyers/${encodeURIComponent(id)}/profile`),
  update: (id: string, data: Record<string, unknown>) => api.put(`/lawyers/${encodeURIComponent(id)}`, data),
  apply: (data: Record<string, unknown>) => api.post('/lawyers/apply', data),
  getReviews: (id: string, params?: Record<string, unknown>) => api.get(`/lawyers/${encodeURIComponent(id)}/reviews`, { params }),
  postReview: (id: string, data: { rating: number; comment?: string }) => api.post(`/lawyers/${encodeURIComponent(id)}/reviews`, data),
  getReviewEligibility: (id: string, params?: { appointmentId?: string }) =>
    api.get(`/lawyers/${encodeURIComponent(id)}/review-eligibility`, { params }),
};

// ─── Appointments API ───────────────────────────────────────
export const appointmentsApi = {
  create: (data: Record<string, unknown>) => api.post('/appointments', data),
  book: (data: { lawyerId: string; scheduledAt: string; durationMins?: number; notes?: string; paymentMethod?: 'wallet' | 'razorpay' }) =>
    api.post('/appointments/book', data),
  confirmPayment: (data: { appointmentId: string; razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) =>
    api.post(`/appointments/${encodeURIComponent(data.appointmentId)}/confirm-payment`, data),
  getAll: (params?: Record<string, unknown>) => api.get('/appointments', { params }),
  getById: (id: string) => api.get(`/appointments/${encodeURIComponent(id)}`),
  reschedule: (id: string, scheduledAt: string) =>
    api.put(`/appointments/${encodeURIComponent(id)}/reschedule`, { scheduledAt }),
  cancel: (id: string) => api.post(`/appointments/${encodeURIComponent(id)}/cancel`),
  updateStatus: (id: string, status: string) =>
    api.put(`/appointments/${encodeURIComponent(id)}/status`, { status }),
  attend: (id: string, attended?: boolean) => api.post(`/appointments/${encodeURIComponent(id)}/attend`, { attended }),
  availability: (data: { lawyerId: string; date: string }) =>
    api.post('/appointments/availability', data),
  updateAgreementUrl: (data: { appointmentId: string; agreementUrl: string }) =>
    api.post('/appointments/update-agreement-url', data),
  accept: (id: string) => api.post(`/appointments/${encodeURIComponent(id)}/accept`),
  reject: (id: string, reason?: string) => api.post(`/appointments/${encodeURIComponent(id)}/reject`, { reason }),
  complete: (id: string) => api.post(`/appointments/${encodeURIComponent(id)}/complete`),
  confirmRazorpay: (id: string, data: { appointmentId: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    api.post(`/appointments/${encodeURIComponent(id)}/confirm-payment`, data),
  getAllAppointments: () => api.get('/appointments/getall'),
};

// ─── Cases API ──────────────────────────────────────────────
export const casesApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/cases', { params }),
  getById: (id: string) => api.get(`/cases/${encodeURIComponent(id)}`),
  create: (data: { title: string; description?: string; category: string; appointmentId: string; clientId: string }) =>
    api.post('/cases', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/cases/${encodeURIComponent(id)}`, data),
  updateResolution: (id: string, method: string) =>
    api.put(`/cases/${encodeURIComponent(id)}/resolution-method`, { resolutionMethod: method }),
  getTimeline: (id: string) => api.get(`/cases/${encodeURIComponent(id)}/timeline`),
  addTimeline: (id: string, data: { title: string; description?: string; eventDate: string; type?: string }) =>
    api.post(`/cases/${encodeURIComponent(id)}/timeline`, data),
  getHearings: (id: string) => api.get(`/cases/${encodeURIComponent(id)}/hearings`),
  addHearing: (id: string, data: { date: string; court?: string; judge?: string; purpose?: string; notes?: string }) =>
    api.post(`/cases/${encodeURIComponent(id)}/hearings`, data),
  getDocuments: (id: string) => api.get(`/cases/${encodeURIComponent(id)}/documents`),
  // Saves an already-uploaded file's metadata onto the case. The actual
  // bytes are uploaded directly to Cloudinary via storageApi.getCloudinarySignature
  // first; this call only persists the resulting URL + filename + mime so
  // the server can later run OCR / AI on it.
  uploadDocument: (id: string, data: { fileurl: string; fileName: string; mimeType: string; size?: number }) =>
    api.post(`/cases/${encodeURIComponent(id)}/saveDocuments`, data),
  getPresignedUrl: (caseId: string, fileName?: string, mimeType?: string) =>
    api.get(`/cases/${encodeURIComponent(caseId)}/getpresignedUrl`, { params: { fileName, mimeType } }),
  // (Use casesApi.uploadDocument above to persist a single uploaded
  //  document — the server endpoint accepts a flat body, not a
  //  { documents: [...] } array, so a multi-doc helper would mis-shape.)
  extractText: (caseId: string, documentId: string) => api.post(`/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(documentId)}/extract`),
  summarize: (caseId: string, documentId: string) => api.post(`/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(documentId)}/summarize`),
  askQuestion: (caseId: string, documentId: string, question: string) => api.post(`/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(documentId)}/ask`, { question }),
  getTasks: (caseId: string) => api.get(`/cases/${encodeURIComponent(caseId)}/tasks`),
  createTask: (caseId: string, data: { title: string; description?: string; assignedToId?: string; dueDate?: string }) =>
    api.post(`/cases/${encodeURIComponent(caseId)}/tasks`, data),
  updateTask: (taskId: string, data: Record<string, unknown>) =>
    api.put(`/cases/tasks/${encodeURIComponent(taskId)}`, data),
  closeCase: (
    caseId: string,
    data: {
      status: 'CLOSED' | 'WON' | 'LOST' | 'SETTLED';
      settlementAmount?: number;
      settlementTerms?: string;
      closureNotes?: string;
    },
  ) =>
    api.post(`/cases/${encodeURIComponent(caseId)}/close`, data),
  getAllCases: () => api.get('/cases/getall/cases'),
  createByLawyer: (data: Record<string, unknown>) => api.post('/cases/create/case/details/lawyer', data),
  acceptCase: (caseId: string) => api.post(`/cases/accept/case/${encodeURIComponent(caseId)}`),
  getCaseDetails: (caseId: string) => api.get(`/cases/get/details/${encodeURIComponent(caseId)}`),
  addTimelineEvent: (caseId: string, data: { title: string; description?: string; eventDate: string }) =>
    api.post(`/cases/add/timeline/event/${encodeURIComponent(caseId)}`, data),
  getTimelineEvents: (caseId: string) => api.get(`/cases/timeline/events/${encodeURIComponent(caseId)}`),
  getCaseHearings: (caseId: string) => api.get(`/cases/hearings/${encodeURIComponent(caseId)}`),
};

// ─── Users API ──────────────────────────────────────────────
export const usersApi = {
  getMe: () => api.get('/users/me'),
  updateMe: (data: Record<string, unknown>) => api.put('/users/me', data),
  deleteMe: () => api.delete('/users/me'),
  getPresignedUrl: (fileName: string, mimeType: string) =>
    api.post('/users/presigned-url', { fileName, mimeType }),
  getUploadSignature: () => api.get('/users/me/upload-signature'),
  getClientInformation: () => api.get('/users/client-information'),
  postClientInformation: (data: Record<string, unknown>) => api.post('/users/client-information', data),
  getLawyerInformation: () => api.get('/users/lawyer-information'),
  postLawyerInformation: (data: Record<string, unknown>) => api.post('/users/lawyer-information', data),
  registerFcmToken: (token: string) => api.post('/users/fcm-token', { fcmToken: token }),
  removeFcmToken: (token: string) => api.delete('/users/fcm-token', { data: { fcmToken: token } }),
  getUserById: (id: string) => api.get(`/users/${encodeURIComponent(id)}`),
};

// ─── Chat API ───────────────────────────────────────────────
export const chatApi = {
  createChat: (otherUserId: string, caseId?: string) => api.post('/chat', { otherUserId, caseId }),
  getOrCreateAppointmentChat: (appointmentId: string) => api.get(`/chat/appointment/${encodeURIComponent(appointmentId)}`),
  getChats: () => api.get('/chat'),
  getMessages: (chatId: string, params?: Record<string, unknown>) =>
    api.get(`/chat/${encodeURIComponent(chatId)}/messages`, { params }),
  sendMessage: (chatId: string, data: { text: string; attachments?: string[] }) =>
    api.post(`/chat/${encodeURIComponent(chatId)}/messages`, data),
  getParticipants: (chatId: string) => api.get(`/chat/${encodeURIComponent(chatId)}/participants`),
};

// ─── Notifications API ──────────────────────────────────────
export const notificationsApi = {
  getAll: (params?: { page?: number; limit?: number }) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.put(`/notifications/${encodeURIComponent(id)}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  delete: (id: string) => api.delete(`/notifications/${encodeURIComponent(id)}`),
};

// ─── Wallet API ─────────────────────────────────────────────
export const walletApi = {
  getBalance: () => api.get('/wallet/balance'),
  getTransactions: (params?: { page?: number; limit?: number; type?: string }) =>
    api.get('/wallet/transactions', { params }),
  addMoney: (amount: number) => api.post('/wallet/add-money', { amount }),
  confirmAddMoney: (data: { paymentId: string; razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) =>
    api.post('/wallet/confirm-add-money', data),
  withdraw: (amount: number, bankAccountId?: string) =>
    api.post('/wallet/withdraw', { amount, bankAccountId }),
  transfer: (toUserId: string, amount: number, description?: string) =>
    api.post('/wallet/transfer', { toUserId, amount, description }),
};

// ─── Model / AI Chat API ────────────────────────────────────
export const modelChatApi = {
  chatCompletion: (messages: { role: string; content: string }[]) =>
    api.post('/model/chat', { messages }),
};

// ─── Agreement Templates API ────────────────────────────────
export const agreementTemplatesApi = {
  getAll: () => api.get('/agreement-templates'),
  getById: (id: string) => api.get(`/agreement-templates/${encodeURIComponent(id)}`),
  create: (data: { title: string; description?: string; content: string; category?: string }) =>
    api.post('/agreement-templates', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/agreement-templates/${encodeURIComponent(id)}`, data),
  delete: (id: string) => api.delete(`/agreement-templates/${encodeURIComponent(id)}`),
};

// ─── Admin API ──────────────────────────────────────────────
export const adminApi = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsers: (params?: Record<string, unknown>) =>
    api.get('/admin/users', { params }),
  getUserById: (id: string) => api.get(`/admin/users/${encodeURIComponent(id)}`),
  toggleVerification: (id: string, isVerified: boolean) =>
    api.put(`/admin/users/${encodeURIComponent(id)}/verification`, { isVerified }),
  getNotVerifiedClients: () => api.get('/admin/not-verified-client'),
  getNotVerifiedLawyers: () => api.get('/admin/not-verified-lawyers'),

  // Single source of truth for the admin "Verify user" toggle. The earlier
  // /admin/:id/verifylawyer + /admin/:id/verifyclient routes were removed
  // server-side (Phase 1) and silently 404'd the mobile, leaving the
  // lawyer.isVerified flag false even after the admin tapped Verify — which
  // is why client / admin / super-admin views all kept showing "Not Verified
  // by Any Court". This calls the live /admin/users/:id/verification toggle
  // which actually flips lawyer.isVerified (and client.isVerified) in DB.
  setUserVerified: (id: string, isVerified: boolean) =>
    api.put(`/admin/users/${encodeURIComponent(id)}/verification`, { isVerified }),
};

// ─── Admin Management API (SUPER_ADMIN only) ───────────────
// Phase 1 super-admin: manage the admin team. Server enforces SUPER_ADMIN
// level via requireAdminLevel middleware; the FE hides the entry point.
export const adminManagementApi = {
  list: (params?: { level?: 'SUPER_ADMIN' | 'ADMIN'; isActive?: boolean; page?: number; limit?: number }) =>
    api.get('/admin/admins', { params }),
  getById: (id: string) => api.get(`/admin/admins/${encodeURIComponent(id)}`),
  // Every new admin is created at ADMIN level — the platform has exactly one
  // SUPER_ADMIN (the seed) and the role is non-grantable from the API.
  create: (data: { name: string; email: string; phone: string; permissions?: string[] }) =>
    api.post('/admin/admins', data),
  update: (
    id: string,
    data: Partial<{
      name: string;
      phone: string;
      avatarUrl: string | null;
      permissions: string[];
      isActive: boolean;
    }>,
  ) => api.put(`/admin/admins/${encodeURIComponent(id)}`, data),
  delete: (id: string) => api.delete(`/admin/admins/${encodeURIComponent(id)}`),
};

// ─── Booking Payouts API (SUPER_ADMIN only) ────────────────
// Booking fees are received into the platform (super admin) wallet first
// and then disbursed to the beneficiary lawyer / organization. Server
// enforces SUPER_ADMIN level via requireAdminLevel middleware.
export type PayoutStatus = 'HELD_BY_PLATFORM' | 'PAYABLE' | 'PAID_OUT' | 'REFUNDED';
export type BeneficiaryType = 'LAWYER' | 'ORGANIZATION';

export const payoutsApi = {
  list: (params?: {
    payoutStatus?: PayoutStatus;
    beneficiaryType?: BeneficiaryType;
    page?: number;
    limit?: number;
  }) => api.get('/admin/payouts', { params }),
  summary: () => api.get('/admin/payouts/summary'),
  disburse: (paymentId: string, data?: { providerPayoutId?: string; notes?: string }) =>
    api.post(`/admin/payouts/${encodeURIComponent(paymentId)}/disburse`, data ?? {}),
  refund: (paymentId: string, data: { reason: string; partialAmount?: number }) =>
    api.post(`/admin/payouts/${encodeURIComponent(paymentId)}/refund`, data),
  openDispute: (paymentId: string, data: { reason: string }) =>
    api.post(`/admin/payouts/${encodeURIComponent(paymentId)}/dispute`, data),
  resolveDispute: (
    paymentId: string,
    data: { outcome: 'release' | 'refund' | 'split'; resolution: string; refundAmount?: number },
  ) => api.post(`/admin/payouts/${encodeURIComponent(paymentId)}/dispute/resolve`, data),
};

// ─── Court-admin authorization queue (SUPER_ADMIN only) ────
// Self-onboarded court admins land in PENDING_SUPER_ADMIN_APPROVAL with
// isAuthorized=false. Their feature routes stay locked behind
// requireCourtAdminAuthorized until an entry here flips them.
export const courtAdminApprovalApi = {
  listPending: (params?: { page?: number; limit?: number }) =>
    api.get('/admin/court-admins/pending', { params }),
  getDetail: (id: string) => api.get(`/admin/court-admins/${encodeURIComponent(id)}`),
  approve: (id: string, data?: { notes?: string }) =>
    api.post(`/admin/court-admins/${encodeURIComponent(id)}/approve`, data ?? {}),
  reject: (id: string, data: { reason: string }) =>
    api.post(`/admin/court-admins/${encodeURIComponent(id)}/reject`, data),
};

// ─── Court-admin performance + salary (SUPER_ADMIN only) ───
// Salary rupee fields are passed/returned in INR (integer). The cycle is
// keyed by (cycleMonth, cycleYear) — month is 1-12.
export type SalaryStatus = 'ACTIVE' | 'HELD' | 'PAID';

export const courtAdminPerfApi = {
  listAll: () => api.get('/admin/court-admins/performance'),
  getOne: (id: string) => api.get(`/admin/court-admins/${encodeURIComponent(id)}/performance`),
};

export const courtAdminSalaryApi = {
  getConfig: (id: string) => api.get(`/admin/court-admins/${encodeURIComponent(id)}/salary`),
  setBase: (id: string, data: { baseSalary: number; reason?: string }) =>
    api.put(`/admin/court-admins/${encodeURIComponent(id)}/salary`, data),
  hold: (id: string, data: { reason: string }) =>
    api.post(`/admin/court-admins/${encodeURIComponent(id)}/salary/hold`, data),
  release: (id: string, data?: { reason?: string }) =>
    api.post(`/admin/court-admins/${encodeURIComponent(id)}/salary/release`, data ?? {}),
  history: (id: string, limit?: number) =>
    api.get(`/admin/court-admins/${encodeURIComponent(id)}/salary/history`, { params: limit ? { limit } : {} }),
  pay: (
    id: string,
    data: { cycleMonth?: number; cycleYear?: number; bonusAmount?: number; deductionAmount?: number; notes?: string; providerPayoutId?: string },
  ) => api.post(`/admin/court-admins/${encodeURIComponent(id)}/salary/pay`, data),
  currentCycle: (params?: { cycleMonth?: number; cycleYear?: number }) =>
    api.get('/admin/salary-cycles/current', { params }),
  payoutHistory: (params?: { courtAdminId?: string; cycleMonth?: number; cycleYear?: number; page?: number; limit?: number }) =>
    api.get('/admin/salary-cycles/history', { params }),
};

// ─── Lawyer & Organization performance-based salary (SUPER_ADMIN) ──
// Polymorphic salary surface that handles both LAWYER and ORGANIZATION
// subjects through the same endpoints. The mount segment in the URL
// (`lawyers` vs `organizations`) is what tells the server which kind of
// subject this is; pass the matching `subject` value to switch between them.
//
// Net payout formula at the server, snapshotted on every payout row:
//   base + (bonusPerConsultation × completedConsultations)
//        + (bonusPerCaseClosed   × cases closed in cycle)
//        + (bonusPerWonCase      × cases won/settled in cycle)
//        + adminBonus  − adminDeduction
//
// Org subjects aggregate counts across every lawyer with
// organizationId === subjectId; org-affiliated lawyers therefore
// don't double-count when paid as LAWYER.
export type EntitySalarySubject = 'LAWYER' | 'ORGANIZATION';

const entitySalarySegment = (subject: EntitySalarySubject) =>
  subject === 'LAWYER' ? 'lawyers' : 'organizations';

export type EntitySalaryConfig = {
  id: string;
  subjectType: EntitySalarySubject;
  subjectId: string;
  baseSalary: number;
  bonusPerConsultation: number;
  bonusPerCaseClosed: number;
  bonusPerWonCase: number;
  isOnHold: boolean;
  holdReason: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EntitySalaryPreview = {
  cycle: { cycleMonth: number; cycleYear: number };
  config: EntitySalaryConfig | null;
  performance: {
    consultationCount: number;
    caseClosedCount: number;
    caseWonCount: number;
    cycleStart: string;
    cycleEnd: string;
  };
  breakdown: {
    consultationBonus: number;
    caseClosedBonus: number;
    caseWonBonus: number;
    adminBonus: number;
    adminDeduction: number;
    netPayable: number;
  };
  alreadyPaid: boolean;
  existingPayout: any | null;
  // Populated by the server when the LAWYER subject belongs to an
  // organisation. The super-admin salary screen uses this to switch into
  // read-only "Managed by [Org Name]" mode and route writes through the
  // org-side surface (orgLawyerSalaryApi) instead.
  lawyerOrganization?: { id: string; name: string } | null;
};

export const entitySalaryApi = {
  getConfig: (subject: EntitySalarySubject, id: string) =>
    api.get(`/admin/${entitySalarySegment(subject)}/${encodeURIComponent(id)}/salary`),

  // Update any subset of base + bonus rates in one call. Reason is
  // optional but recorded in the audit log when present.
  setConfig: (
    subject: EntitySalarySubject,
    id: string,
    data: Partial<{
      baseSalary: number;
      bonusPerConsultation: number;
      bonusPerCaseClosed: number;
      bonusPerWonCase: number;
      reason: string;
    }>,
  ) => api.put(`/admin/${entitySalarySegment(subject)}/${encodeURIComponent(id)}/salary`, data),

  hold: (subject: EntitySalarySubject, id: string, data: { reason: string }) =>
    api.post(`/admin/${entitySalarySegment(subject)}/${encodeURIComponent(id)}/salary/hold`, data),

  release: (subject: EntitySalarySubject, id: string, data?: { reason?: string }) =>
    api.post(`/admin/${entitySalarySegment(subject)}/${encodeURIComponent(id)}/salary/release`, data ?? {}),

  // Live cycle preview — counts performance and computes the net payable
  // right now without writing anything. Safe to call on screen open.
  preview: (
    subject: EntitySalarySubject,
    id: string,
    params?: { cycleMonth?: number; cycleYear?: number },
  ) => api.get(`/admin/${entitySalarySegment(subject)}/${encodeURIComponent(id)}/salary/preview`, { params }),

  pay: (
    subject: EntitySalarySubject,
    id: string,
    data?: {
      cycleMonth?: number;
      cycleYear?: number;
      bonusAmount?: number;
      deductionAmount?: number;
      notes?: string;
      providerPayoutId?: string;
    },
  ) => api.post(`/admin/${entitySalarySegment(subject)}/${encodeURIComponent(id)}/salary/pay`, data ?? {}),

  // Append-only history of config changes (base + bonus + hold edits).
  adjustmentHistory: (subject: EntitySalarySubject, id: string, limit?: number) =>
    api.get(
      `/admin/${entitySalarySegment(subject)}/${encodeURIComponent(id)}/salary/history`,
      { params: limit ? { limit } : {} },
    ),

  // Snapshot of every cycle paid (one row per cycle).
  payoutHistory: (subject: EntitySalarySubject, id: string, limit?: number) =>
    api.get(
      `/admin/${entitySalarySegment(subject)}/${encodeURIComponent(id)}/salary/payouts`,
      { params: limit ? { limit } : {} },
    ),

  // Cycle queues — every payable subject for the current month, with the
  // live performance breakdown attached so the screen renders without
  // making N preview calls.
  payableLawyers: (params?: { cycleMonth?: number; cycleYear?: number }) =>
    api.get('/admin/lawyer-salary-cycles/current', { params }),

  payableOrganizations: (params?: { cycleMonth?: number; cycleYear?: number }) =>
    api.get('/admin/org-salary-cycles/current', { params }),

  // Read a subject's bank accounts (super-admin only). Returns same shape
  // as the user-facing /bank-accounts endpoint so the UI can render them
  // with the existing components. Used in the salary detail screen so the
  // super admin sees where to wire money for off-platform settlements.
  bankAccounts: (subject: EntitySalarySubject, id: string) =>
    api.get(`/admin/${entitySalarySegment(subject)}/${encodeURIComponent(id)}/bank-accounts`),
};

// ─── Org-managed lawyer salary (ORGANIZATION role) ─────────────────
// The org head manages performance-based salary for lawyers in their
// organisation. The platform-admin surface refuses writes for org-affiliated
// lawyers (server-side guard), so this is the only legitimate write path.
// Same payload shapes as entitySalaryApi so the FE can reuse the salary
// management screen with just the API set swapped.
export const orgLawyerSalaryApi = {
  getConfig: (lawyerId: string) =>
    api.get(`/organizations/me/lawyers/${encodeURIComponent(lawyerId)}/salary`),
  setConfig: (
    lawyerId: string,
    data: Partial<{
      baseSalary: number;
      bonusPerConsultation: number;
      bonusPerCaseClosed: number;
      bonusPerWonCase: number;
      reason: string;
    }>,
  ) => api.put(`/organizations/me/lawyers/${encodeURIComponent(lawyerId)}/salary`, data),
  hold: (lawyerId: string, data: { reason: string }) =>
    api.post(`/organizations/me/lawyers/${encodeURIComponent(lawyerId)}/salary/hold`, data),
  release: (lawyerId: string, data?: { reason?: string }) =>
    api.post(`/organizations/me/lawyers/${encodeURIComponent(lawyerId)}/salary/release`, data ?? {}),
  preview: (lawyerId: string, params?: { cycleMonth?: number; cycleYear?: number }) =>
    api.get(`/organizations/me/lawyers/${encodeURIComponent(lawyerId)}/salary/preview`, { params }),
  pay: (
    lawyerId: string,
    data?: {
      cycleMonth?: number;
      cycleYear?: number;
      bonusAmount?: number;
      deductionAmount?: number;
      notes?: string;
      providerPayoutId?: string;
    },
  ) => api.post(`/organizations/me/lawyers/${encodeURIComponent(lawyerId)}/salary/pay`, data ?? {}),
  adjustmentHistory: (lawyerId: string, limit?: number) =>
    api.get(`/organizations/me/lawyers/${encodeURIComponent(lawyerId)}/salary/history`, { params: limit ? { limit } : {} }),
  payoutHistory: (lawyerId: string, limit?: number) =>
    api.get(`/organizations/me/lawyers/${encodeURIComponent(lawyerId)}/salary/payouts`, { params: limit ? { limit } : {} }),
  bankAccounts: (lawyerId: string) =>
    api.get(`/organizations/me/lawyers/${encodeURIComponent(lawyerId)}/bank-accounts`),
};

// ─── Self-view of own performance-based salary (lawyer / org head) ──
// Returns the same payload shape the super admin sees in the detail
// screen, plus the lawyer / org's own bank accounts (via the /me/salary
// endpoint, which bundles them) so they can verify where their money
// will land before the next payout cycle.
//
// Use these from LawyerSalaryScreen + OrgSalaryScreen.
export const selfSalaryApi = {
  getMyLawyerSalary: () => api.get('/lawyers/me/salary'),
  getMyOrganizationSalary: () => api.get('/organizations/me/salary'),
};

// ─── User control (SUPER_ADMIN only) ───────────────────────
// `role` URL segment is one of CLIENT/LAWYER/ORGANIZATION/COURT_ADMIN.
// The server normalizes case but uppercase is the canonical form.
export type ControllableRole = 'CLIENT' | 'LAWYER' | 'ORGANIZATION' | 'COURT_ADMIN';

export const userControlApi = {
  ban: (role: ControllableRole, userId: string, reason: string) =>
    api.post(`/admin/users/${encodeURIComponent(role)}/${encodeURIComponent(userId)}/ban`, { reason }),
  unban: (role: ControllableRole, userId: string, reason?: string) =>
    api.post(`/admin/users/${encodeURIComponent(role)}/${encodeURIComponent(userId)}/unban`, { reason }),
  softDelete: (role: ControllableRole, userId: string, reason?: string) =>
    api.post(`/admin/users/${encodeURIComponent(role)}/${encodeURIComponent(userId)}/soft-delete`, { reason }),
  forcePasswordReset: (role: ControllableRole, userId: string, reason?: string) =>
    api.post(`/admin/users/${encodeURIComponent(role)}/${encodeURIComponent(userId)}/force-password-reset`, { reason }),
  // KYC override — only for LAWYER and ORGANIZATION (the verifiable roles).
  overrideLawyerKyc: (lawyerId: string, data: { isVerified: boolean; reason: string }) =>
    api.post(`/admin/lawyers/${encodeURIComponent(lawyerId)}/kyc-override`, data),
  overrideOrgKyc: (organizationId: string, data: { isVerified: boolean; reason: string }) =>
    api.post(`/admin/organizations/${encodeURIComponent(organizationId)}/kyc-override`, data),
};

// ─── Platform configuration (SUPER_ADMIN only) ─────────────
// Phase 1 keys: COMMISSION_PCT (0-100), GST_PCT (0-100), TDS_PCT (0-100).
// Future phases will add subscription pricing, salary template, etc.
export const platformConfigApi = {
  list: () => api.get('/admin/config'),
  upsert: (key: string, data: { value: unknown; description?: string; reason?: string }) =>
    api.put(`/admin/config/${encodeURIComponent(key)}`, data),
};

// ─── Admin audit log (SUPER_ADMIN only, read-only) ─────────
export type AuditAction =
  | 'PAYOUT_DISBURSED' | 'PAYOUT_REFUNDED' | 'PAYOUT_DISPUTE_OPENED' | 'PAYOUT_DISPUTE_RESOLVED'
  | 'COURT_ADMIN_APPROVED' | 'COURT_ADMIN_REJECTED'
  | 'LAWYER_VERIFICATION_OVERRIDDEN' | 'ORGANIZATION_VERIFICATION_OVERRIDDEN'
  | 'ADMIN_INVITED' | 'ADMIN_UPDATED' | 'ADMIN_DELETED'
  | 'PLATFORM_CONFIG_UPDATED';

export const auditLogApi = {
  list: (params?: {
    action?: AuditAction;
    actorId?: string;
    targetType?: string;
    targetId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) => api.get('/admin/audit-log', { params }),
};

// ─── Admin content & moderation (Phase 4) ──────────────────
// Reports — issue tracking. Users submit via /report; admins triage here.
export type ReportStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED';

export const adminReportsApi = {
  list: (params?: { status?: ReportStatus; q?: string; page?: number; limit?: number }) =>
    api.get('/admin/reports', { params }),
  updateStatus: (id: string, status: ReportStatus) =>
    api.patch(`/admin/reports/${encodeURIComponent(id)}`, { status }),
};

// Legal updates — admin CRUD. User-facing list lives at legalUpdatesApi.
export const adminLegalUpdatesApi = {
  create: (data: { title: string; content: string; category: string; publishedAt?: string }) =>
    api.post('/admin/legal-updates', data),
  update: (
    id: string,
    data: Partial<{ title: string; content: string; category: string; publishedAt: string }>,
  ) => api.put(`/admin/legal-updates/${encodeURIComponent(id)}`, data),
  delete: (id: string) => api.delete(`/admin/legal-updates/${encodeURIComponent(id)}`),
};

// Announcements — SUPER_ADMIN-only fan-out. Server enforces level; the
// dashboard tile is gated to SUPER_ADMIN to match.
export type AnnouncementAudience = 'ALL' | 'CLIENT' | 'LAWYER' | 'ORGANIZATION' | 'COURT_ADMIN';

export const adminAnnouncementsApi = {
  broadcast: (data: { title: string; body: string; audience?: AnnouncementAudience }) =>
    api.post('/admin/announcements', data),
};

// ─── Storage API ────────────────────────────────────────────
export const storageApi = {
  getPresignedUrl: (fileName: string, mimeType: string) =>
    api.post('/storage/presigned-url', { fileName, mimeType }),
  getCloudinarySignature: (folder: string = 'profiles') =>
    api.get('/storage/sign', { params: { folder } }),
};

// ─── eKYC API (CLIENT only) ─────────────────────────────────
// Aadhaar identity verification through Surepass. Two-step OTP:
//   1. POST initiate(aadhaar) → server hits Surepass, OTP delivered to
//      the Aadhaar-linked phone, returns { id, status, expiresAt, provider }.
//   2. POST submitOtp(submissionId, otp) → on success the Client row gets
//      ekycVerified=true + aadhaarName/last4/dob/gender mirrored.
// Server enforces aggressive rate limits (5 inits/hr, 10 OTPs/15min).
export const ekycApi = {
  getStatus: () => api.get('/ekyc/status'),
  initiateAadhaar: (aadhaar: string) =>
    api.post('/ekyc/aadhaar/initiate', { aadhaar }),
  submitOtp: (submissionId: string, otp: string) =>
    api.post('/ekyc/aadhaar/submit-otp', { submissionId, otp }),
};

// ─── Reviews API ────────────────────────────────────────────
export const reviewsApi = {
  getByLawyer: (lawyerId: string, params?: Record<string, unknown>) =>
    api.get(`/lawyers/${encodeURIComponent(lawyerId)}/reviews`, { params }),
  create: (lawyerId: string, data: { rating: number; comment?: string }) =>
    api.post(`/lawyers/${encodeURIComponent(lawyerId)}/reviews`, data),
};

// ─── Tele-Law API ───────────────────────────────────────────
export const teleLawApi = {
  getInfo: () => api.get('/tele-law/info'),
  checkEligibility: (data: { income?: number; caste?: string; gender?: string; state?: string; useProfile?: boolean }) =>
    api.post('/tele-law/check-eligibility', data),
};

// ─── Address API ────────────────────────────────────────────
export const addressApi = {
  getStates: () => api.get('/address/states'),
  getDistrictsByState: (state: string) => api.get(`/address/districts/${encodeURIComponent(state)}`),
  lookupPincode: (pincode: string) => api.get(`/address/pincode/${encodeURIComponent(pincode)}`),
};

// ─── Bank Account API ───────────────────────────────────────
export const bankAccountApi = {
  getAll: () => api.get('/bank-accounts'),
  getById: (id: string) => api.get(`/bank-accounts/${encodeURIComponent(id)}`),
  create: (data: Record<string, unknown>) => api.post('/bank-accounts', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/bank-accounts/${encodeURIComponent(id)}`, data),
  delete: (id: string) => api.delete(`/bank-accounts/${encodeURIComponent(id)}`),
  verifyUpi: (upiId: string) => api.post('/bank-accounts/verify-upi', { upiId }),
  lookupIfsc: (code: string) => api.get(`/bank-accounts/ifsc/${encodeURIComponent(code)}`),
};

// ─── Referral API ───────────────────────────────────────────
export const referralApi = {
  getCode: () => api.get('/referral/code'),
  apply: (code: string) => api.post('/referral/apply', { code }),
  getInfo: () => api.get('/referral/info'),
};

// ─── Subscription API ──────────────────────────────────────
export const subscriptionApi = {
  get: () => api.get('/subscription'),
  subscribe: () => api.post('/subscription/subscribe'),
  confirm: (data: { paymentId: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    api.post('/subscription/confirm', data),
  subscribeFromWallet: () => api.post('/subscription/subscribe-wallet'),
  cancel: () => api.post('/subscription/cancel'),
};

// ─── Dashboard API ──────────────────────────────────────────
export const dashboardApi = {
  lawyerDashboard: () => api.get('/appointments/dashboard/lawyer'),
  clientDashboard: () => api.get('/appointments/dashboard/client'),
};

// ─── Video / Meetings API ───────────────────────────────────
// Video sessions are appointment-bound on the server. The previous
// /video/chat/:chatId/session* endpoints were never implemented server-side
// and have been dropped from the mobile client too — VideoCallScreen now
// surfaces a clear "needs an appointment" message when invoked from a chat
// without an appointmentId.
export const videoApi = {
  createMeeting: (data: { appointmentId: string; meetingType?: string }) =>
    api.post('/video/meeting', data),
  getMeeting: (appointmentId: string) =>
    api.get(`/video/meeting/${encodeURIComponent(appointmentId)}`),
  endMeeting: (appointmentId: string) =>
    api.post(`/video/meeting/${encodeURIComponent(appointmentId)}/end`),
  getCallHistory: (params?: { page?: number; limit?: number }) =>
    api.get('/video/call-history', { params }),
};

// ─── Payments API ───────────────────────────────────────────
export const paymentsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/payments', { params }),
  getById: (id: string) => api.get(`/payments/${encodeURIComponent(id)}`),
  refund: (id: string, reason?: string) => api.post(`/payments/${encodeURIComponent(id)}/refund`, { reason }),
};

// ─── Court Admin API ────────────────────────────────────────
export const courtAdminApi = {
  login: (email: string, password: string) => api.post('/court-admin/login', { email, password }),
  getMe: () => api.get('/court-admin/me'),
  updateMe: (data: { name?: string; email?: string; phone?: string; avatarUrl?: string; registrationNumber?: string }) =>
    api.put('/court-admin/me', data),
  updateMyCourt: (data: {
    name?: string;
    type?: string;
    pincode?: string;
    state?: string;
    district?: string;
    city?: string;
    address?: string;
  }) => api.put('/court-admin/me/court', data),
  getPublicCourtsByPincode: (pincode: string) => api.get(`/court-admin/public/courts/by-pincode/${encodeURIComponent(pincode)}`),
  getPublicAdminsByPincode: (pincode: string) => api.get(`/court-admin/public/admins/by-pincode/${encodeURIComponent(pincode)}`),
  createCourt: (data: Record<string, unknown>) => api.post('/court-admin/courts', data),
  getCourts: () => api.get('/court-admin/courts'),
  getCourtById: (id: string) => api.get(`/court-admin/courts/${encodeURIComponent(id)}`),
  updateCourt: (id: string, data: Record<string, unknown>) => api.put(`/court-admin/courts/${encodeURIComponent(id)}`, data),
  deleteCourt: (id: string) => api.delete(`/court-admin/courts/${encodeURIComponent(id)}`),
  createAdmin: (data: Record<string, unknown>) => api.post('/court-admin/admins', data),
  getAdmins: () => api.get('/court-admin/admins'),
  getAdminById: (id: string) => api.get(`/court-admin/admins/${encodeURIComponent(id)}`),
  updateAdminStatus: (id: string, status: string) => api.put(`/court-admin/admins/${encodeURIComponent(id)}/status`, { status }),
  submitVerificationRequest: (courtAdminId: string) => api.post('/court-admin/verifications/request', { courtAdminId }),
  getMyVerificationRequests: () => api.get('/court-admin/verifications/my-requests'),
  getPendingVerifications: () => api.get('/court-admin/verifications/pending'),
  getMyVerifications: (params?: { statuses?: string; page?: number; limit?: number }) => api.get('/court-admin/verifications', { params }),
  getVerificationDocuments: async (lawyerId: string) => {
    const safeLawyerId = encodeURIComponent(lawyerId);
    try {
      return await api.get(`/court-admin/verifications/${safeLawyerId}/documents`);
    } catch (err: any) {
      const status = err?.response?.status;
      const rawMessage = err?.response?.data?.error || err?.response?.data?.message || '';
      const msg = String(rawMessage).toLowerCase();

      // Backward-compatible fallback for deployments using legacy route naming.
      if (status === 404 || msg.includes('route not found')) {
        return api.get(`/court-admin/verify/${safeLawyerId}/documents`);
      }
      throw err;
    }
  },
  // Server expects `{ status, remarks? }` per court-admin.schema.ts
  // (verifyLawyerSchema). The wider type leaked from an earlier draft and
  // sent fields the server's strict Zod parse would reject.
  verifyLawyer: (lawyerId: string, data: { status: 'APPROVED' | 'REJECTED'; remarks?: string }) =>
    api.post(`/court-admin/verify/${encodeURIComponent(lawyerId)}`, data),
  getPendingOrganizationVerifications: () => api.get('/court-admin/organization-verifications/pending'),
  getMyOrganizationVerifications: () => api.get('/court-admin/organization-verifications'),
  verifyOrganization: (organizationId: string, data: { status: 'APPROVED' | 'REJECTED'; notes?: string }) =>
    api.post(`/court-admin/verify-organization/${encodeURIComponent(organizationId)}`, data),
};

// ─── Mediation API ──────────────────────────────────────────
export const mediationApi = {
  // Invites
  createInvite: (data: {
    respondentEmail: string;
    respondentName?: string;
    respondentPhone?: string;
    disputeTitle: string;
    disputeDescription: string;
    initiatorLawyerId?: string;
  }) => api.post('/mediations/invites', data),
  getInviteByToken: (token: string) => api.get(`/mediations/invites/public/${encodeURIComponent(token)}`),
  acceptInvite: (token: string) => api.post(`/mediations/invites/${encodeURIComponent(token)}/accept`),
  declineInvite: (token: string) => api.post(`/mediations/invites/${encodeURIComponent(token)}/decline`),

  // Mediator directory / profile
  listMediators: () => api.get('/mediations/mediators'),
  updateMediatorProfile: (data: {
    isMediator: boolean;
    mediatorBio?: string;
    mediationFee?: number;
    mediationSpecializations?: string[];
  }) => api.put('/mediations/me/mediator-profile', data),

  // Mediation lifecycle
  list: () => api.get('/mediations'),
  getById: (id: string) => api.get(`/mediations/${encodeURIComponent(id)}`),
  attachRespondentLawyer: (id: string, lawyerId: string) =>
    api.post(`/mediations/${encodeURIComponent(id)}/respondent-lawyer`, { lawyerId }),
  pickMediator: (id: string, mediatorId: string) =>
    api.post(`/mediations/${encodeURIComponent(id)}/mediator-pick`, { mediatorId }),
  getRoom: (id: string) => api.get(`/mediations/${encodeURIComponent(id)}/room`),
  conclude: (id: string, data: { outcome: 'RESOLVED' | 'ESCALATED_TO_CASE'; settlementTerms?: string; closureNotes?: string }) =>
    api.post(`/mediations/${encodeURIComponent(id)}/conclude`, data),
};

// ─── Organization API ──────────────────────────────────────────
export const organizationsApi = {
  listPublic: (params?: any) => api.get('/organizations', { params }),
  getPublicById: (id: string) => api.get(`/organizations/${encodeURIComponent(id)}`),
  getMine: () => api.get('/organizations/me'),
  updateMine: (data: any) => api.put('/organizations/me', data),
  getEligibleCourtAdmins: () => api.get('/organizations/me/eligible-court-admins'),
  requestVerification: (data: any) => api.post('/organizations/me/verification-request', data),
  createLawyer: (data: any) => api.post('/organizations/me/lawyers', data),
  listLawyers: (params?: any) => api.get('/organizations/me/lawyers', { params }),
  listOrgAppointmentRequests: () => api.get('/organizations/me/appointment-requests'),
  // Server contract (assignOrgAppointmentRequestSchema):
  //   { lawyerId, paymentMethod: 'razorpay' | 'wallet' }   (paymentMethod defaults to 'razorpay')
  // - razorpay: a Payment order is created; the client is notified to pay
  //   online via the existing /appointments/confirm-payment flow.
  // - wallet:   the client's wallet is debited immediately and the Appointment
  //   row is materialised right then.
  assignAppointmentRequest: (
    id: string,
    data: { lawyerId: string; paymentMethod?: 'razorpay' | 'wallet' },
  ) => api.post(`/organizations/me/appointment-requests/${encodeURIComponent(id)}/assign`, data),
  rejectAppointmentRequest: (id: string, data: { reason?: string }) =>
    api.post(`/organizations/me/appointment-requests/${encodeURIComponent(id)}/reject`, data),
  listClientAppointmentRequests: () => api.get('/organizations/clients/me/requests'),
  cancelClientAppointmentRequest: (id: string) =>
    api.post(`/organizations/clients/me/requests/${encodeURIComponent(id)}/cancel`),
  createAppointmentRequest: (id: string, data: any) =>
    api.post(`/organizations/${encodeURIComponent(id)}/appointment-requests`, data),
};

// ─── Legal Updates API ──────────────────────────────────────
export const legalUpdatesApi = {
  getAll: (params?: { category?: string; search?: string }) =>
    api.get('/legal-updates', { params }),
};

// ─── Report / Issue Tracking API ────────────────────────────
export const reportApi = {
  create: (data: { type?: string; title: string; description: string; metadata?: any }) =>
    api.post('/report', data),
  getMyReports: () => api.get('/report'),
};

export default api;
