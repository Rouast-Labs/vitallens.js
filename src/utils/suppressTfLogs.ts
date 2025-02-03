// List of substrings to filter out in console warnings.
const filteredMessages = [
  'already registered',
  'Platform node has already been set. Overwriting the platform with node.'
];

// Save a reference to the original console.warn
const originalWarn = console.warn;

// Override console.warn
console.warn = (message, ...args) => {
  if (
    typeof message === 'string' &&
    filteredMessages.some((filter) => message.includes(filter))
  ) {
    return;
  }
  originalWarn(message, ...args);
};
