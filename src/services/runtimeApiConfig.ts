import { API_BASE_URL, DEFAULT_API_BASE_URL, REMOTE_API_CONFIG_URL, normalizeApiBaseUrl } from '../constants';
import { storage } from './storage';

const REMOTE_FETCH_TIMEOUT_MS = 6000;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

let currentApiBaseUrl = API_BASE_URL || normalizeApiBaseUrl(DEFAULT_API_BASE_URL);
let initialized = false;
let lastRefreshedAt = 0;
let refreshPromise: Promise<string> | null = null;

const parseRemoteApiBaseUrl = (payload: any): string => {
  if (!payload || typeof payload !== 'object') return '';
  const candidate =
    (typeof payload.apiBaseUrl === 'string' && payload.apiBaseUrl) ||
    (typeof payload.api_url === 'string' && payload.api_url) ||
    (typeof payload.baseUrl === 'string' && payload.baseUrl) ||
    (typeof payload.url === 'string' && payload.url) ||
    '';

  if (!candidate) return '';
  return normalizeApiBaseUrl(candidate);
};

const fetchRemoteApiBaseUrl = async (): Promise<string> => {
  if (!REMOTE_API_CONFIG_URL) return '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(REMOTE_API_CONFIG_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return '';

    const data = await response.json();
    return parseRemoteApiBaseUrl(data);
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
};

const updateCurrentApiBaseUrl = async (nextBaseUrl: string): Promise<string> => {
  const normalized = normalizeApiBaseUrl(nextBaseUrl);
  if (!normalized) return currentApiBaseUrl;

  currentApiBaseUrl = normalized;
  lastRefreshedAt = Date.now();
  await storage.setApiBaseUrl(normalized).catch(() => {});
  return currentApiBaseUrl;
};

const refreshFromRemote = async (): Promise<string> => {
  const remote = await fetchRemoteApiBaseUrl();
  if (!remote) {
    lastRefreshedAt = Date.now();
    return currentApiBaseUrl;
  }
  return updateCurrentApiBaseUrl(remote);
};

export const initRuntimeApiConfig = async (): Promise<string> => {
  if (initialized) return currentApiBaseUrl;

  // Build-time env URL must win after each deploy so installed apps move to the new server.
  const buildTimeBaseUrl = normalizeApiBaseUrl(API_BASE_URL || DEFAULT_API_BASE_URL);
  if (buildTimeBaseUrl) {
    currentApiBaseUrl = buildTimeBaseUrl;
    await storage.setApiBaseUrl(buildTimeBaseUrl).catch(() => {});
  }

  const cached = await storage.getApiBaseUrl().catch(() => null);
  const normalizedCached = normalizeApiBaseUrl(cached || '');
  if (!buildTimeBaseUrl && normalizedCached) {
    currentApiBaseUrl = normalizedCached;
  }

  await refreshFromRemote();
  initialized = true;
  return currentApiBaseUrl;
};

export const maybeRefreshRuntimeApiConfig = async (): Promise<string> => {
  if (!initialized) {
    return initRuntimeApiConfig();
  }

  const now = Date.now();
  if (now - lastRefreshedAt < REFRESH_INTERVAL_MS) {
    return currentApiBaseUrl;
  }

  if (!refreshPromise) {
    refreshPromise = refreshFromRemote().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

export const getRuntimeApiBaseUrl = (): string => currentApiBaseUrl;

export const getRuntimeApiUrl = (): string => `${currentApiBaseUrl}/api/v1`;
