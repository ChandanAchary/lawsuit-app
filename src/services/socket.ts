import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../constants';
import { authApi } from './api';
import { storage } from './storage';

class SocketService {
  private socket: Socket | null = null;
  private handlers: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  private lastConnectErrorLogAt = 0;
  private lastConnectErrorMessage = '';
  private recoveringAuth = false;

  private async getSocketAuth() {
    const token = await storage.getToken();
    return token ? { token } : null;
  }

  private async recoverAuthAndReconnect(): Promise<void> {
    if (this.recoveringAuth) return;
    this.recoveringAuth = true;
    try {
      // This request uses the existing axios interceptor, which can refresh
      // access tokens with refresh token when needed.
      await authApi.getMe();
      const nextAuth = await this.getSocketAuth();
      if (this.socket && nextAuth) {
        this.socket.auth = nextAuth;
        if (!this.socket.connected) this.socket.connect();
      }
    } catch {
      // No-op: auth store/app flow handles invalid sessions.
    } finally {
      this.recoveringAuth = false;
    }
  }

  async connect(): Promise<void> {
    if (this.socket) {
      // Reuse existing client instance; Socket.IO will reconnect when needed.
      if (!this.socket.connected) {
        const auth = await this.getSocketAuth();
        if (!auth) return;
        this.socket.auth = auth;
        this.socket.connect();
      }
      return;
    }

    const auth = await this.getSocketAuth();
    if (!auth) return;

    this.socket = io(API_BASE_URL, {
      auth,
      // Allow polling fallback when websocket handshake is slow/blocked on mobile networks.
      transports: ['websocket', 'polling'],
      timeout: 30000,
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected');
    });

    this.socket.on('disconnect', (reason) => {
      // Transport errors are transient during reload/network changes.
      if (reason === 'transport error' || reason === 'transport close') return;
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.io.on('reconnect_attempt', async () => {
      // Keep auth in sync when access token is refreshed in API interceptors.
      const nextAuth = await this.getSocketAuth();
      if (nextAuth) this.socket!.auth = nextAuth;
    });

    this.socket.on('connect_error', (err) => {
      const message = err?.message || 'unknown error';
      const now = Date.now();
      const shouldLog =
        message !== this.lastConnectErrorMessage ||
        now - this.lastConnectErrorLogAt >= 15000;

      if (shouldLog) {
        console.warn('[Socket] Connect error:', message);
        this.lastConnectErrorMessage = message;
        this.lastConnectErrorLogAt = now;
      }

      if (message === 'Authentication error') {
        void this.recoverAuthAndReconnect();
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.handlers.clear();
  }

  on(event: string, callback: (...args: unknown[]) => void): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(callback);
    this.socket?.on(event, callback);

    return () => {
      this.handlers.get(event)?.delete(callback);
      this.socket?.off(event, callback);
    };
  }

  emit(event: string, ...args: unknown[]): void {
    this.socket?.emit(event, ...args);
  }

  joinChat(chatId: string): void {
    this.emit('chat:join', { chatId });
  }

  sendMessage(data: { chatId: string; text: string; attachments?: string[] }): void {
    this.emit('chat:message:new', data);
  }

  startTyping(chatId: string): void {
    this.emit('chat:typing:start', { chatId });
  }

  stopTyping(chatId: string): void {
    this.emit('chat:typing:stop', { chatId });
  }

  markRead(chatId: string, messageId: string): void {
    this.emit('chat:message:read', { chatId, messageId });
  }

  markDelivered(chatId: string, messageId: string): void {
    this.emit('chat:message:delivered', { chatId, messageId });
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
