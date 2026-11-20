import { Application } from '@nativescript/core';
import { AuthError } from './errors';
import type { AuthNative } from './native';
import { base64Url, sha256Base64Url } from './sha256';

// Event names of AndroidApplication (activityNewIntentEvent, activityResumedEvent).
const NEW_INTENT = 'activityNewIntent';
const RESUMED = 'activityResumed';
const CUSTOM_TABS_SERVICE =
  'android.support.customtabs.action.CustomTabsService';
const EXTRA_SESSION = 'android.support.customtabs.extra.SESSION';
const EXTRA_TITLE_VISIBILITY =
  'android.support.customtabs.extra.TITLE_VISIBILITY';
const EXTRA_EPHEMERAL =
  'androidx.browser.customtabs.extra.ENABLE_EPHEMERAL_BROWSING';

interface Target {
  scheme: string;
  host: string;
  port: number;
  path: string;
}

interface Pending {
  target: Target;
  resolve(url: string): void;
  reject(error: AuthError): void;
  browserOpened: boolean;
}

let pending: Pending | null = null;

function toTarget(uri: android.net.Uri): Target {
  return {
    scheme: (uri.getScheme() ?? '').toLowerCase(),
    host: (uri.getHost() ?? '').toLowerCase(),
    port: uri.getPort(),
    path: (uri.getPath() ?? '').replace(/\/+$/, ''),
  };
}

function sameTarget(a: Target, b: Target): boolean {
  return (
    a.scheme === b.scheme &&
    a.host === b.host &&
    a.port === b.port &&
    a.path === b.path
  );
}

function activity(): android.app.Activity {
  const current =
    Application.android.foregroundActivity ?? Application.android.startActivity;
  if (!current) {
    throw new AuthError(
      'NOT_SUPPORTED',
      'There is no activity to start the sign-in from'
    );
  }
  return current;
}

function settle(outcome: { url: string } | { error: AuthError }): void {
  const current = pending;
  if (!current) {
    return;
  }
  pending = null;
  Application.android.off(NEW_INTENT, onNewIntent);
  Application.android.off(RESUMED, onResumed);
  if ('url' in outcome) {
    current.resolve(outcome.url);
  } else {
    current.reject(outcome.error);
  }
}

/** Settles with `intent`'s data when it is the redirect of this sign-in. */
function consumeRedirect(
  intent: android.content.Intent | null | undefined
): boolean {
  const data = intent?.getData();
  // Any app can fire this intent: only the redirect of this sign-in counts.
  if (!pending || !data || !sameTarget(toTarget(data), pending.target)) {
    return false;
  }
  const url = data.toString();
  // A later resume must not see the same redirect again.
  intent?.setData(null);
  settle({ url });
  return true;
}

/** The redirect reaches the app's activity (singleTask) through onNewIntent. */
function onNewIntent(args: { intent?: android.content.Intent }): void {
  consumeRedirect(args.intent);
}

/**
 * Back in the app. Usually onNewIntent already delivered the redirect; some
 * browsers close the tab first and deliver the intent a moment later, so a
 * resume without it only means "cancelled" after a grace period.
 */
function onResumed(args: { activity?: android.app.Activity }): void {
  if (!pending?.browserOpened || consumeRedirect(args.activity?.getIntent())) {
    return;
  }
  const opened = pending;
  setTimeout(() => {
    if (pending !== opened || consumeRedirect(args.activity?.getIntent())) {
      return;
    }
    settle({
      error: new AuthError('CANCELLED', 'The user closed the browser'),
    });
  }, 1500);
}

/** Package of a Custom Tabs browser, preferring the user's default browser. */
function customTabsPackage(context: android.content.Context): string | null {
  const pm = context.getPackageManager();
  const services = pm.queryIntentServices(
    new android.content.Intent(CUSTOM_TABS_SERVICE),
    0
  );
  const packages: string[] = [];
  for (let i = 0; i < services.size(); i++) {
    packages.push(services.get(i).serviceInfo.packageName);
  }
  const probe = new android.content.Intent(
    android.content.Intent.ACTION_VIEW,
    android.net.Uri.parse('https://example.com')
  );
  const preferred = pm.resolveActivity(probe, 0)?.activityInfo?.packageName;
  if (preferred && packages.includes(preferred)) {
    return preferred;
  }
  return packages[0] ?? null;
}

export const platformNative: AuthNative = {
  async isAvailable() {
    const probe = new android.content.Intent(
      android.content.Intent.ACTION_VIEW,
      android.net.Uri.parse('https://example.com')
    ).addCategory(android.content.Intent.CATEGORY_BROWSABLE);
    return probe.resolveActivity(activity().getPackageManager()) != null;
  },

  async randomBase64Url(byteLength) {
    const length = Math.min(Math.max(byteLength, 1), 1024);
    const bytes = Array.create('byte', length);
    new java.security.SecureRandom().nextBytes(bytes);
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      out[i] = bytes[i] & 0xff;
    }
    return base64Url(out);
  },

  async sha256Base64Url(input) {
    return sha256Base64Url(input);
  },

  openAuthSession(url, redirectUri, prefersEphemeralSession) {
    const authUri = android.net.Uri.parse(url);
    const redirect = android.net.Uri.parse(redirectUri);
    if (
      !['http', 'https'].includes((authUri.getScheme() ?? '').toLowerCase()) ||
      !redirect.getScheme()
    ) {
      return Promise.reject(
        new AuthError(
          'INVALID_CONFIG',
          'The authorization URL must be http(s) and the redirect URI absolute'
        )
      );
    }
    if (pending) {
      return Promise.reject(
        new AuthError(
          'INVALID_CONFIG',
          'Another sign-in is already in progress'
        )
      );
    }

    let current: android.app.Activity;
    try {
      current = activity();
    } catch (error) {
      return Promise.reject(error);
    }

    // Without an intent-filter the browser would have nowhere to go back to.
    const back = new android.content.Intent(
      android.content.Intent.ACTION_VIEW,
      redirect
    )
      .addCategory(android.content.Intent.CATEGORY_BROWSABLE)
      .setPackage(current.getPackageName());
    if (back.resolveActivity(current.getPackageManager()) == null) {
      return Promise.reject(
        new AuthError(
          'INVALID_CONFIG',
          `No intent-filter for "${redirect.getScheme()}": add it to the app's main activity in AndroidManifest.xml (see the README)`
        )
      );
    }

    return new Promise<string>((resolve, reject) => {
      pending = {
        target: toTarget(redirect),
        resolve,
        reject,
        browserOpened: false,
      };
      Application.android.on(NEW_INTENT, onNewIntent);
      Application.android.on(RESUMED, onResumed);

      const intent = new android.content.Intent(
        android.content.Intent.ACTION_VIEW,
        authUri
      );
      const packageName = customTabsPackage(
        current as unknown as android.content.Context
      );
      if (packageName) {
        // A Custom Tabs intent is a VIEW intent with these extras: no need
        // for the androidx.browser library.
        const extras = new android.os.Bundle();
        extras.putBinder(EXTRA_SESSION, null);
        intent.putExtras(extras);
        intent.putExtra(EXTRA_TITLE_VISIBILITY, 1);
        if (prefersEphemeralSession) {
          intent.putExtra(EXTRA_EPHEMERAL, true);
        }
        intent.setPackage(packageName);
      } else {
        intent.addCategory(android.content.Intent.CATEGORY_BROWSABLE);
      }

      try {
        current.startActivity(intent);
        if (pending) {
          pending.browserOpened = true;
        }
      } catch {
        settle({
          error: new AuthError(
            'NOT_SUPPORTED',
            'No browser is available to sign in'
          ),
        });
      }
    });
  },

  async cancelAuthSession() {
    if (!pending) {
      return;
    }
    // Bring the app back above the tab; the tab closes with the task's top.
    const current = activity();
    const intent = new android.content.Intent(
      current as unknown as android.content.Context,
      current.getClass()
    ).addFlags(
      android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP |
        android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP
    );
    settle({ error: new AuthError('CANCELLED', 'The sign-in was cancelled') });
    current.startActivity(intent);
  },
};
