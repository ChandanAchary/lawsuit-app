import { INDIA_STATES_LIST } from '../constants/indiaStates';
import { addressApi } from '../services/api';

const normalizeStringList = (list: unknown): string[] => {
  if (!Array.isArray(list)) return [];
  return list
    .map((item: any) => (typeof item === 'string' ? item : item?.name))
    .filter((item: any) => typeof item === 'string' && item.trim().length > 0);
};

export const loadStateOptions = async (): Promise<string[]> => {
  try {
    const { data } = await addressApi.getStates();
    const list = normalizeStringList(data?.states || data?.data?.states || []);
    return list.length ? list : INDIA_STATES_LIST;
  } catch {
    return INDIA_STATES_LIST;
  }
};

export const loadDistrictOptions = async (state: string): Promise<string[]> => {
  if (!state?.trim()) return [];
  try {
    const { data } = await addressApi.getDistrictsByState(state.trim());
    return normalizeStringList(data?.districts || data?.data?.districts || []);
  } catch {
    return [];
  }
};
