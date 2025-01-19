declare module '*.json' {
  const value: string; // Treated as Base64 string
  export default value;
}

declare module '*.bin' {
  const value: string; // Base64 string
  export default value;
}