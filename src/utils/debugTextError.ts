// This script patches console.error to add stack traces for JSX text rendering errors
// and should be imported at the very top of App.tsx

const originalConsoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Text strings must be rendered')) {
    // Capture stack trace
    const err = new Error('TEXT_STRING_TRACE');
    originalConsoleError('=== TEXT STRING ERROR TRACE ===');
    originalConsoleError(err.stack);
    originalConsoleError('=== END TRACE ===');
  }
  originalConsoleError(...args);
};
