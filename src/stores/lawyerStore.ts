import { create } from 'zustand';
import { lawyersApi } from '../services/api';
import { Lawyer, LawyerFilterOptions } from '../types';

interface LawyerState {
  lawyers: Lawyer[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  limit: number;
  filterOptions: { specializations: string[]; locations: string[]; languages: string[] };
  fetchLawyers: (filters?: LawyerFilterOptions, page?: number, limit?: number) => Promise<void>;
  fetchLawyerById: (id: string) => Promise<Lawyer>;
}

export const useLawyerStore = create<LawyerState>((set) => ({
  lawyers: [],
  loading: false,
  error: null,
  total: 0,
  page: 1,
  limit: 10,
  filterOptions: { specializations: [], locations: [], languages: [] },

  fetchLawyers: async (filters, page = 1, limit = 10) => {
    set({ loading: true, error: null });
    try {
      const params: Record<string, unknown> = { page, limit, ...filters };
      const { data } = await lawyersApi.getAll(params);
      const items = data.items || data.lawyers || [];
      const specs = new Set<string>();
      const locs = new Set<string>();
      const langs = new Set<string>();
      items.forEach((l: Lawyer) => {
        l.specialization?.forEach((s: string) => specs.add(s));
        if (l.location) locs.add(l.location);
        l.languages?.forEach((lang: string) => langs.add(lang));
      });
      set({
        lawyers: items,
        total: data.total || items.length,
        page,
        limit,
        loading: false,
        filterOptions: {
          specializations: Array.from(specs),
          locations: Array.from(locs),
          languages: Array.from(langs),
        },
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchLawyerById: async (id) => {
    const { data } = await lawyersApi.getById(id);
    return data.lawyer || data;
  },
}));
