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
  uploadDocument: (id: string, data: { fileurl: string; fileName: string; mimeType: string; size?: number }) =>
    api.post(`/cases/${encodeURIComponent(id)}/documents`, data),
  getPresignedUrl: (caseId: string, fileName?: string, mimeType?: string) =>
    api.get(`/cases/${encodeURIComponent(caseId)}/getpresignedUrl`, { params: { fileName, mimeType } }),
  saveDocuments: (caseId: string, documents: { filename: string; url: string; mimeType: string; size?: number }[]) =>
    api.post(`/cases/${encodeURIComponent(caseId)}/saveDocuments`, { documents }),
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
  getPayments: (params?: Record<string, unknown>) =>
    api.get('/admin/payments', { params }),
  getWallets: () => api.get('/admin/wallets'),
  getWithdrawals: () => api.get('/admin/wallets/withdrawals'),
  reverseWithdrawal: (id: string, reason: string) =>
    api.put(`/admin/wallets/withdrawals/${encodeURIComponent(id)}/reverse`, { reason }),
  creditWallet: (userId: string, amount: number, description: string) =>
    api.post('/admin/wallets/credit', { userId, amount, description }),
  debitWallet: (userId: string, amount: number, description: string) =>
    api.post('/admin/wallets/debit', { userId, amount, description }),
  getNotVerifiedClients: () => api.get('/admin/not-verified-client'),
  getNotVerifiedLawyers: () => api.get('/admin/not-verified-lawyers'),
  verifyLawyer: (id: string) => api.put(`/admin/${encodeURIComponent(id)}/verifylawyer`),
  verifyClient: (id: string) => api.put(`/admin/${encodeURIComponent(id)}/verifyclient`),
};

// ─── Storage API ────────────────────────────────────────────
export const storageApi = {
  getPresignedUrl: (fileName: string, mimeType: string) =>
    api.post('/storage/presigned-url', { fileName, mimeType }),
  getCloudinarySignature: (folder: string = 'profiles') =>
    api.get('/storage/sign', { params: { folder } }),
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
export const videoApi = {
  createMeeting: (data: { appointmentId: string; meetingType?: string }) =>
    api.post('/video/meeting', data),
  getMeeting: (appointmentId: string) =>
    api.get(`/video/meeting/${encodeURIComponent(appointmentId)}`),
  endMeeting: (appointmentId: string) =>
    api.post(`/video/meeting/${encodeURIComponent(appointmentId)}/end`),
  createChatSession: (chatId: string) =>
    api.post(`/video/chat/${encodeURIComponent(chatId)}/session`),
  getChatSession: (chatId: string) =>
    api.get(`/video/chat/${encodeURIComponent(chatId)}/session`),
  endChatSession: (chatId: string) =>
    api.post(`/video/chat/${encodeURIComponent(chatId)}/session/end`),
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
  verifyLawyer: (lawyerId: string, data: { status: string; remarks?: string }) =>
    api.post(`/court-admin/verify/${encodeURIComponent(lawyerId)}`, data),
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

export default api;
