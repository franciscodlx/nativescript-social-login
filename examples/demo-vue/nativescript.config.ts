import { NativeScriptConfig } from '@nativescript/core';

export default {
  // Its own app id, so it installs next to examples/demo (Angular). Both
  // register the same URL schemes: on Android keep only one installed while
  // testing, or the system asks which app should open the redirect.
  id: 'dev.franciscodlx.socialauth.nsvuedemo',
  appPath: 'src',
  appResourcesPath: 'App_Resources',
  android: {
    v8Flags: '--expose_gc',
    markingMode: 'none',
  },
} as NativeScriptConfig;
