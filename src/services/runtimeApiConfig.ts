import { API_BASE_URL, DEFAULT_API_BASE_URL, normalizeApiBaseUrl } from '../constants';
import { storage } from './storage';

let currentApiBaseUrl = API_BASE_URL || normalizeApiBaseUrl(DEFAULT_API_BASE_URL);
let initialized = false;

export const initRuntimeApiConfig = async (): Promise<string> => {
  if (initialized) return currentApiBaseUrl;

  // Build-time env URL must win after each deploy so installed apps move to the new server.
  const buildTimeBaseUrl = normalizeApiBaseUrl(API_BASE_URL || DEFAULT_API_BASE_URL);
  if (buildTimeBaseUrl) {
    currentApiBaseUrl = buildTimeBaseUrl;
    void storage.setApiBaseUrl(buildTimeBaseUrl).catch(() => {});
    initialized = true;
    return currentApiBaseUrl;
  }

  const cached = await storage.getApiBaseUrl().catch(() => null);
  const normalizedCached = normalizeApiBaseUrl(cached || '');
  if (!buildTimeBaseUrl && normalizedCached) {
    currentApiBaseUrl = normalizedCached;
  }

  initialized = true;
  return currentApiBaseUrl;
};

export const maybeRefreshRuntimeApiConfig = async (): Promise<string> => {
  if (!initialized) {
    return initRuntimeApiConfig();
  }
  return currentApiBaseUrl;
};

export const getRuntimeApiBaseUrl = (): string => currentApiBaseUrl;

export const getRuntimeApiUrl = (): string => `${currentApiBaseUrl}/api/v1`;
