import { AuthError } from './errors';
import type { AuthNative } from './native';
import { base64Url, sha256Base64Url } from './sha256';

// ASWebAuthenticationSessionErrorCode.CanceledLogin (a const enum in the typings).
const CANCELED_LOGIN = 1;

// Strong references: the session and its anchor provider must outlive the
// call that created them, or the runtime may collect them mid sign-in.
let session: ASWebAuthenticationSession | null = null;
let anchorProvider: NSObject | null = null;

function keyWindow(): UIWindow {
  const scenes = UIApplication.sharedApplication.connectedScenes.allObjects;
  let fallback: UIWindow | null = null;
  for (let i = 0; i < scenes.count; i++) {
    const scene = scenes.objectAtIndex(i);
    if (!(scene instanceof UIWindowScene)) {
      continue;
    }
    const windows = scene.windows;
    for (let j = 0; j < windows.count; j++) {
      const window = windows.objectAtIndex(j);
      if (window.isKeyWindow) {
        return window;
      }
      fallback = fallback ?? window;
    }
  }
  return fallback ?? UIWindow.new();
}

function getAnchorProvider(): NSObject {
  if (!anchorProvider) {
    // NSObject.extend instead of @NativeClass: this file ships as plain JS.
    const Provider = (
      NSObject as unknown as {
        extend(
          methods: object,
          options: { protocols: unknown[] }
        ): { new (): NSObject };
      }
    ).extend(
      {
        presentationAnchorForWebAuthenticationSession(): UIWindow {
          return keyWindow();
        },
      },
      { protocols: [ASWebAuthenticationPresentationContextProviding] }
    );
    anchorProvider = new Provider();
  }
  return anchorProvider;
}

function parseRedirect(redirectUri: string) {
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):(?:\/\/([^/?#]*))?([^?#]*)/.exec(
    redirectUri
  );
  return {
    scheme: match?.[1]?.toLowerCase() ?? '',
    host: match?.[2] ?? '',
    path: match?.[3] || '/',
  };
}

export const platformNative: AuthNative = {
  isAvailable: async () => true,

  async randomBase64Url(byteLength) {
    const length = Math.min(Math.max(byteLength, 1), 1024);
    const data = NSMutableData.dataWithLength(length);
    if (
      SecRandomCopyBytes(
        kSecRandomDefault,
        length,
        data.mutableBytes as interop.Pointer
      ) !== 0
    ) {
      throw new AuthError('NOT_SUPPORTED', 'Could not generate random bytes');
    }
    return base64Url(new Uint8Array(interop.bufferFromData(data)));
  },

  async sha256Base64Url(input) {
    return sha256Base64Url(input);
  },

  openAuthSession(url, redirectUri, prefersEphemeralSession) {
    const authURL = NSURL.URLWithString(url);
    const redirect = parseRedirect(redirectUri);
    if (!authURL || !/^https?:/i.test(url) || !redirect.scheme) {
      return Promise.reject(
        new AuthError(
          'INVALID_CONFIG',
          'The authorization URL must be http(s) and the redirect URI absolute'
        )
      );
    }
    if (session) {
      return Promise.reject(
        new AuthError(
          'INVALID_CONFIG',
          'Another sign-in is already in progress'
        )
      );
    }

    return new Promise<string>((resolve, reject) => {
      const completion = (callbackURL: NSURL | null, error: NSError | null) => {
        session = null;
        if (callbackURL) {
          resolve(callbackURL.absoluteString ?? '');
          return;
        }
        if (
          error?.domain === ASWebAuthenticationSessionErrorDomain &&
          error?.code === CANCELED_LOGIN
        ) {
          reject(new AuthError('CANCELLED', 'The user closed the browser'));
        } else if (error?.domain === ASWebAuthenticationSessionErrorDomain) {
          reject(
            new AuthError(
              'NOT_SUPPORTED',
              error?.localizedDescription ||
                'The sign-in could not be presented'
            )
          );
        } else {
          reject(
            new AuthError(
              'PROVIDER_ERROR',
              error?.localizedDescription || 'The sign-in failed'
            )
          );
        }
      };

      let created: ASWebAuthenticationSession;
      if (redirect.scheme === 'https') {
        // Universal Link redirect: only ASWebAuthenticationSession can
        // intercept it, starting with iOS 17.4.
        if (
          typeof ASWebAuthenticationSessionCallback === 'undefined' ||
          !redirect.host
        ) {
          reject(
            new AuthError(
              'NOT_SUPPORTED',
              'https redirect URIs need iOS 17.4 or later; use a custom scheme'
            )
          );
          return;
        }
        created =
          ASWebAuthenticationSession.alloc().initWithURLCallbackCompletionHandler(
            authURL,
            ASWebAuthenticationSessionCallback.callbackWithHTTPSHostPath(
              redirect.host,
              redirect.path
            ),
            completion
          );
      } else {
        created =
          ASWebAuthenticationSession.alloc().initWithURLCallbackURLSchemeCompletionHandler(
            authURL,
            redirect.scheme,
            completion
          );
      }

      created.presentationContextProvider =
        getAnchorProvider() as unknown as ASWebAuthenticationPresentationContextProviding;
      created.prefersEphemeralWebBrowserSession = prefersEphemeralSession;
      session = created;
      if (!created.start()) {
        session = null;
        reject(
          new AuthError('NOT_SUPPORTED', 'The sign-in could not be presented')
        );
      }
    });
  },

  async cancelAuthSession() {
    // The completion handler runs with CanceledLogin and rejects the sign-in.
    session?.cancel();
  },
};
