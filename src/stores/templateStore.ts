import { create } from 'zustand';
import { agreementTemplatesApi } from '../services/api';
import { AgreementTemplate } from '../types';

interface TemplateState {
  templates: AgreementTemplate[];
  loading: boolean;
  error: string | null;
  fetchTemplates: () => Promise<void>;
  createTemplate: (data: { title: string; description?: string; content: string; category?: string }) => Promise<void>;
  updateTemplate: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],
  loading: false,
  error: null,

  fetchTemplates: async () => {
    set({ loading: true });
    try {
      const { data } = await agreementTemplatesApi.getAll();
      const list = data.data || data.templates || data.items || [];
      set({ templates: Array.isArray(list) ? list : [], loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  createTemplate: async (payload) => {
    await agreementTemplatesApi.create(payload);
    get().fetchTemplates();
  },

  updateTemplate: async (id, payload) => {
    await agreementTemplatesApi.update(id, payload);
    get().fetchTemplates();
  },

  deleteTemplate: async (id) => {
    await agreementTemplatesApi.delete(id);
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));
  },
}));
