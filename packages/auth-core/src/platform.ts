import { AuthError } from './errors';
import type { AuthNative } from './native';

// Resolved only outside iOS and Android (unit tests, a web build): the
// bundler picks platform.ios.ts / platform.android.ts on devices.
const unsupported = (): never => {
  throw new AuthError(
    'NOT_SUPPORTED',
    'The system browser sign-in only runs on iOS and Android'
  );
};

export const platformNative: AuthNative = {
  isAvailable: async () => false,
  randomBase64Url: async () => unsupported(),
  sha256Base64Url: async () => unsupported(),
  openAuthSession: async () => unsupported(),
  cancelAuthSession: async () => undefined,
};
