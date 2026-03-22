import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../constants';
import { storage } from './storage';

class SocketService {
  private socket: Socket | null = null;
  private handlers: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  async connect(): Promise<void> {
    if (this.socket) {
      // Reuse existing client instance; Socket.IO will reconnect when needed.
      if (!this.socket.connected) this.socket.connect();
      return;
    }

    const token = await storage.getToken();
    if (!token) return;

    this.socket = io(API_BASE_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
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

    this.socket.on('connect_error', (err) => {
      console.warn('[Socket] Connect error:', err?.message || 'unknown error');
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
