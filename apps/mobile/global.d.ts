// React Native runtime global (Buffer is set in src/polyfills.ts).
declare var global: typeof globalThis & { Buffer: typeof import('buffer').Buffer };
