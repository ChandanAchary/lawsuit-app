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
      const hasGeoInputs =
        typeof filters?.latitude === 'number' ||
        typeof filters?.longitude === 'number' ||
        !!filters?.clientPincode;
      if (filters?.search) params.q = filters.search;
      if (filters?.specialization) params.specialization = filters.specialization;
      if (filters?.location && !hasGeoInputs) params.city = filters.location;
      if (filters?.maxFee) params.maxFee = filters.maxFee;
      if (filters?.language) params.languages = filters.language;
      if (typeof filters?.latitude === 'number') params.latitude = filters.latitude;
      if (typeof filters?.longitude === 'number') params.longitude = filters.longitude;
      if (typeof filters?.radius === 'number') params.radiusKm = filters.radius;
      if (filters?.clientPincode) params.clientPincode = filters.clientPincode;
      if (filters?.sortBy && filters.sortBy !== 'availability') params.sortBy = filters.sortBy;
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

      const mappedLawyers = items.map((l: any) => ({
        ...l,
        avatar: l.avatar || l.avatarUrl || (l.user && (l.user.avatar || l.user.avatarUrl)) || undefined,
        specialization: l.specializations || l.specialization || [],
        experienceYears: Number(l.experienceYears ?? l.experience ?? 0),
        distance: Number.isFinite(Number(l.distance ?? l.distanceKm ?? l.distance_km))
          ? Number(l.distance ?? l.distanceKm ?? l.distance_km)
          : undefined,
        location: [l.city, l.state].filter(Boolean).join(', ') || l.location || l.address || '',
        // feePerConsultation is stored in paise — convert to rupees
        fee: l.feePerConsultation != null ? Number(l.feePerConsultation) / 100 : (Number(l.fee) || 0),
        reviewsCount: l.totalReviews || l.reviewsCount || 0,
        rating: Number(l.rating ?? l.avgRating ?? 0),
        isAvailable: Boolean(l.isAvailable),
        bio: l.bio || null,
        organisation: l.organisation || null,
        barCouncil: l.barCouncil || null,
      }));

      // Fallback sort on client to keep list stable even if backend sort is inconsistent.
      const sortBy = filters?.sortBy;
      const sortOrder = filters?.sortOrder || 'desc';
      if (sortBy === 'experience') {
        mappedLawyers.sort((a: any, b: any) => sortOrder === 'asc'
          ? a.experienceYears - b.experienceYears
          : b.experienceYears - a.experienceYears);
      } else if (sortBy === 'rating') {
        mappedLawyers.sort((a: any, b: any) => sortOrder === 'asc' ? a.rating - b.rating : b.rating - a.rating);
      } else if (sortBy === 'fee') {
        mappedLawyers.sort((a: any, b: any) => sortOrder === 'asc' ? a.fee - b.fee : b.fee - a.fee);
      } else if (sortBy === 'availability') {
        mappedLawyers.sort((a: any, b: any) => {
          if (a.isAvailable === b.isAvailable) return b.rating - a.rating;
          return a.isAvailable ? -1 : 1;
        });
      } else if (sortBy === 'distance') {
        // Keep near-me ordering stable even when backend ordering is inconsistent.
        mappedLawyers.sort((a: any, b: any) => {
          const aDistance = typeof a.distance === 'number' ? a.distance : Number.POSITIVE_INFINITY;
          const bDistance = typeof b.distance === 'number' ? b.distance : Number.POSITIVE_INFINITY;
          return sortOrder === 'desc' ? bDistance - aDistance : aDistance - bDistance;
        });
      }

      const nextFilterOptions = {
        specializations: Array.from(specs),
        locations: Array.from(locs),
        languages: Array.from(langs),
      };

      set((state) => {
        const mergedLawyers =
          page > 1
            ? [
                ...state.lawyers,
                ...mappedLawyers.filter((candidate: any) =>
                  !state.lawyers.some((existing: any) => existing.id === candidate.id),
                ),
              ]
            : mappedLawyers;

        return {
          lawyers: mergedLawyers,
          total: data.total || items.length,
          page,
          limit,
          loading: false,
          filterOptions:
            page > 1
              ? {
                  specializations: Array.from(new Set([...state.filterOptions.specializations, ...nextFilterOptions.specializations])),
                  locations: Array.from(new Set([...state.filterOptions.locations, ...nextFilterOptions.locations])),
                  languages: Array.from(new Set([...state.filterOptions.languages, ...nextFilterOptions.languages])),
                }
              : nextFilterOptions,
        };
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
