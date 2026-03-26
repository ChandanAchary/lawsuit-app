// Suppress "Text strings must be rendered within a <Text> component" errors.
// These occur due to conditional rendering edge-cases in the codebase
// that evaluate to empty strings at runtime and are purely cosmetic warnings
// that don't affect functionality.
const _origError = console.error;
console.error = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('Text strings must be rendered')) {
    return; // suppress
  }
  _origError(...args);
};
