import * as SecureStore from 'expo-secure-store';

const KEYS = {
  TOKEN: 'lawsuit_auth_token',
  REFRESH_TOKEN: 'lawsuit_refresh_token',
  USER: 'lawsuit_user_data',
  API_BASE_URL: 'lawsuit_api_base_url',
};

export const storage = {
  getToken: async (): Promise<string | null> => {
    return SecureStore.getItemAsync(KEYS.TOKEN);
  },
  setToken: async (token: string): Promise<void> => {
    await SecureStore.setItemAsync(KEYS.TOKEN, token);
  },
  getRefreshToken: async (): Promise<string | null> => {
    return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
  },
  setRefreshToken: async (token: string): Promise<void> => {
    await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, token);
  },
  getUser: async (): Promise<Record<string, unknown> | null> => {
    const data = await SecureStore.getItemAsync(KEYS.USER);
    if (!data) return null;
    try { return JSON.parse(data); } catch { return null; }
  },
  setUser: async (user: Record<string, unknown>): Promise<void> => {
    await SecureStore.setItemAsync(KEYS.USER, JSON.stringify(user));
  },
  getApiBaseUrl: async (): Promise<string | null> => {
    return SecureStore.getItemAsync(KEYS.API_BASE_URL);
  },
  setApiBaseUrl: async (url: string): Promise<void> => {
    await SecureStore.setItemAsync(KEYS.API_BASE_URL, url);
  },
  clear: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(KEYS.TOKEN);
    await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
    await SecureStore.deleteItemAsync(KEYS.USER);
  },
};
