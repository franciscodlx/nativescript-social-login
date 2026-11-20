# nativescript-social-login

Plugins de login social para NativeScript (Angular, Vue, Solid o TypeScript) con un núcleo compartido: OAuth 2.0 + PKCE en el navegador del sistema, sin `clientSecret` en la app y con la misma API en todos los proveedores. Es la versión para NativeScript de [rn-social-login](https://github.com/franciscodlx/rn-social-login) y [flutter_social_login](https://github.com/franciscodlx/flutter_social_login).

```ts
const { code, codeVerifier } = await linkedInLogin.signIn({ clientId, redirectUri });
```

## Paquetes

| Paquete                                                                  | Qué hace                                                           | Estado             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------ |
| [`@franciscodlxdev/nativescript-auth-core`](packages/auth-core)              | PKCE, `state`/`nonce`, navegador del sistema, errores normalizados | Probado con mock   |
| [`@franciscodlxdev/nativescript-linkedin-login`](packages/linkedin-login)    | LinkedIn con OpenID Connect                                        | Probado con mock   |
| [`@franciscodlxdev/nativescript-x-login`](packages/x-login)                  | X con OAuth 2.0 + PKCE                                             | Probado con mock   |
| [`@franciscodlxdev/nativescript-mercadolibre-login`](packages/mercadolibre-login) | Mercado Libre con selector de país                            | Probado con mock   |
| [`@franciscodlxdev/nativescript-twitch-login`](packages/twitch-login)        | Twitch con OIDC                                                    | Probado con mock   |
| [`@franciscodlxdev/nativescript-oauth-presets`](packages/oauth-presets)      | GitHub, Discord, Slack y Strava                                    | Probado con mock   |
| [`@franciscodlxdev/nativescript-telegram-login`](packages/telegram-login)    | Telegram con OpenID Connect                                        | Probado con mock   |
| [`@franciscodlxdev/nativescript-tiktok-login`](packages/tiktok-login)        | TikTok Login Kit (flujo web)                                       | Probado con mock   |
| [`@franciscodlxdev/nativescript-entra-native-auth`](packages/entra-native-auth) | Entra External ID: alta, login y reset sin navegador            | Probado con mock   |

"Probado con mock": iOS (simulador) y Android (emulador) contra `tools/mock-idp` y los backends de `tools/`. El flujo es el mismo que ya se probó con cuentas reales en React Native y Flutter.

Cada proveedor es un paquete independiente (versión, changelog y publicación propios) que solo aporta endpoints, scopes y mapeo de perfil; el flujo y la seguridad viven en el núcleo. Los paquetes no dependen de Angular: funcionan igual con Vue, Solid o TypeScript sin framework.

## Estructura

```
packages/auth-core          núcleo (acceso nativo desde TypeScript: ASWebAuthenticationSession y Custom Tabs)
packages/<proveedor>        un paquete TypeScript por proveedor sobre el núcleo
examples/demo               app NativeScript + Angular con todos los proveedores
tools/mock-idp              proveedor OAuth/OIDC local, sin credenciales reales
tools/mock-entra            imita la API de native authentication de Entra
tools/<proveedor>-backend   backends de ejemplo: redirect https y canje con el secret
```

## Desarrollo

Requiere Node 24, pnpm 12, Xcode, CocoaPods y Android SDK con JDK 17.

```sh
pnpm install
pnpm test          # pruebas unitarias (vitest)
pnpm typecheck
pnpm lint
pnpm build
```

Probar el flujo completo, sin cuenta en ningún proveedor: ver [CONTRIBUTING.md](CONTRIBUTING.md). Vulnerabilidades: [SECURITY.md](SECURITY.md).

## Licencia

MIT
