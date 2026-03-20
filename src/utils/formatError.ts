export function formatErrorMessage(msg: any): string {
  if (typeof msg === 'string') return msg;
  if (msg == null) return '';

  // Axios-like error shape: prefer backend-provided message over generic status text.
  const responseData = msg?.response?.data;
  if (typeof responseData?.error === 'string' && responseData.error) return responseData.error;
  if (typeof responseData?.message === 'string' && responseData.message) return responseData.message;

  if (typeof msg === 'object') {
    if (msg.error && typeof msg.error === 'object') {
      if (typeof msg.error.message === 'string' && msg.error.message) return msg.error.message;
      if (typeof msg.error.code === 'string' && msg.error.code) return msg.error.code;
    }
    if (typeof msg.message === 'string' && msg.message) return msg.message;
    if (typeof msg.error === 'string' && msg.error) return msg.error;
    try {
      return JSON.stringify(msg);
    } catch (e) {
      return String(msg);
    }
  }
  return String(msg);
}
