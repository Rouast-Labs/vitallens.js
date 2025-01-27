const originalWarn = console.warn;

console.warn = (message, ...args) => {
  // Suppress specific TensorFlow.js warnings
  if (
    message.includes('is already registered') ||
    message.includes('was already registered') ||
    message.includes('has already been set')
  ) {
    return;
  }

  // Call the original console.warn for other warnings
  originalWarn(message, ...args);
};
