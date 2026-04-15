import { Alert } from 'react-native';

function firstZodError(node: any): string | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node._errors) && node._errors.length > 0) {
    const first = node._errors.find((e: unknown) => typeof e === 'string' && e);
    if (first) return first as string;
  }
  for (const key of Object.keys(node)) {
    if (key === '_errors') continue;
    const found = firstZodError(node[key]);
    if (found) return found;
  }
  return null;
}

function extractFromErrorPayload(payload: any): string | null {
  if (payload == null) return null;
  if (typeof payload === 'string') return payload;
  if (typeof payload !== 'object') return String(payload);

  if (typeof payload.message === 'string' && payload.message) return payload.message;
  if (typeof payload.code === 'string' && payload.code) return payload.code;

  const zod = firstZodError(payload);
  if (zod) return zod;

  return null;
}

export function formatErrorMessage(msg: any): string {
  if (typeof msg === 'string') return msg;
  if (msg == null) return '';

  // Axios-like error shape.
  const responseData = msg?.response?.data;
  if (responseData != null) {
    if (typeof responseData === 'string') return responseData;

    if (responseData.error != null) {
      if (typeof responseData.error === 'string' && responseData.error) return responseData.error;
      const fromError = extractFromErrorPayload(responseData.error);
      if (fromError) return fromError;
    }
    if (typeof responseData.message === 'string' && responseData.message) return responseData.message;

    const zod = firstZodError(responseData);
    if (zod) return zod;
  }

  if (typeof msg === 'object') {
    if (msg.error != null) {
      const fromError = extractFromErrorPayload(msg.error);
      if (fromError) return fromError;
    }
    if (typeof msg.message === 'string' && msg.message) return msg.message;

    const zod = firstZodError(msg);
    if (zod) return zod;

    try {
      return JSON.stringify(msg);
    } catch {
      return String(msg);
    }
  }
  return String(msg);
}

export function alertError(title: string, err: unknown, fallback = 'Something went wrong'): void {
  const message = formatErrorMessage(err) || fallback;
  Alert.alert(title, message);
}

/**
 * True when the error indicates the server does not expose the endpoint
 * (feature not deployed yet, or wrong base URL). Used to silence noisy
 * alerts on optional features.
 */
export function isEndpointMissing(err: any): boolean {
  const status = err?.response?.status;
  if (status === 404) {
    const msg = formatErrorMessage(err).toLowerCase();
    if (!msg || msg.includes('route not found') || msg.includes('not found')) return true;
  }
  return false;
}
