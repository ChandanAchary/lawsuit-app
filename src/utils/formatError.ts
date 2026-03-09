export function formatErrorMessage(msg: any): string {
  if (typeof msg === 'string') return msg;
  if (msg == null) return '';
  if (typeof msg === 'object') {
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
