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
      // Map filter keys to backend query params
      const params: Record<string, unknown> = { page, limit };
      if (filters?.search) params.q = filters.search;
      if (filters?.specialization) params.specialization = filters.specialization;
      if (filters?.location) params.city = filters.location;
      if (filters?.maxFee) params.maxFee = filters.maxFee;
      if (filters?.language) params.languages = filters.language;
      if (filters?.sortBy) params.sortBy = filters.sortBy;
      if (filters?.sortOrder) params.order = filters.sortOrder;
      const { data } = await lawyersApi.getAll(params);
      const items = data.items || data.lawyers || [];
      const specs = new Set<string>();
      const locs = new Set<string>();
      const langs = new Set<string>();
      items.forEach((l: any) => {
        (l.specializations || l.specialization || []).forEach((s: string) => specs.add(s));
        if (l.city) locs.add(l.city);
        if (l.location) locs.add(l.location);
        (l.languages || []).forEach((lang: string) => langs.add(lang));
      });
      set({
        lawyers: items.map((l: any) => ({
          ...l,
          specialization: l.specializations || l.specialization || [],
          location: l.city || l.location || '',
          fee: l.feePerConsultation || l.fee || 0,
          reviewsCount: l.totalReviews || l.reviewsCount || 0,
        })),
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
