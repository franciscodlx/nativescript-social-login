import { NativeScriptConfig } from '@nativescript/core';

export default {
  id: 'dev.franciscodlx.socialauth.nsdemo',
  appPath: 'src',
  appResourcesPath: 'App_Resources',
  // pnpm workspace: dependencies are hoisted to the repository root.
  android: {
    v8Flags: '--expose_gc',
    markingMode: 'none',
  },
} as NativeScriptConfig;
