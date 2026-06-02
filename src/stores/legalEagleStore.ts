import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { modelChatApi } from '../services/api';

// Shared Legal Eagle conversation store. Both the floating FAB widget and the
// full-screen AiChatScreen subscribe to this single store, so they share the
// same history + the same in-flight state. History is persisted per-user in
// AsyncStorage (mirrors the web's `legalEagle:history:{uid}` localStorage key).

export interface LEMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const MAX_MESSAGES = 50;
const keyFor = (uid: string) => `legalEagle:history:${uid}`;

interface LEState {
  uid: string | null;
  messages: LEMessage[];
  loading: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  hydrate: (uid: string | null) => Promise<void>;
  send: (text: string) => Promise<void>;
  clear: () => Promise<void>;
}

export const useLegalEagleStore = create<LEState>((set, get) => ({
  uid: null,
  messages: [],
  loading: false,
  open: false,

  setOpen: (open) => set({ open }),

  hydrate: async (uid) => {
    if (!uid) {
      set({ uid: null, messages: [] });
      return;
    }
    // Already hydrated for this user — keep the in-memory history.
    if (get().uid === uid) return;
    try {
      const raw = await AsyncStorage.getItem(keyFor(uid));
      const messages = raw ? (JSON.parse(raw) as LEMessage[]) : [];
      set({ uid, messages });
    } catch {
      set({ uid, messages: [] });
    }
  },

  send: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().loading) return;
    const uid = get().uid;

    const userMsg: LEMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    const withUser = [...get().messages, userMsg].slice(-MAX_MESSAGES);
    set({ messages: withUser, loading: true });

    try {
      const history = withUser.map((m) => ({ role: m.role, content: m.content }));
      const { data } = await modelChatApi.chatCompletion(history);
      const content: string =
        data?.response || data?.message || data?.reply || 'I could not generate a response.';
      const assistantMsg: LEMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content,
        timestamp: new Date().toISOString(),
      };
      const updated = [...get().messages, assistantMsg].slice(-MAX_MESSAGES);
      set({ messages: updated, loading: false });
      if (uid) AsyncStorage.setItem(keyFor(uid), JSON.stringify(updated)).catch(() => {});
    } catch {
      const errMsg: LEMessage = {
        id: `e_${Date.now()}`,
        role: 'assistant',
        content: 'I encountered an error reaching the assistant. Please try again.',
        timestamp: new Date().toISOString(),
      };
      const updated = [...get().messages, errMsg].slice(-MAX_MESSAGES);
      set({ messages: updated, loading: false });
    }
  },

  clear: async () => {
    const uid = get().uid;
    set({ messages: [] });
    if (uid) AsyncStorage.removeItem(keyFor(uid)).catch(() => {});
  },
}));
