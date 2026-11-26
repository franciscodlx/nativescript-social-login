# @franciscodlxdev/nativescript-social-login-vue

Composable de Vue 3 para la familia de login social de NativeScript (NativeScript-Vue): `loading`, `result` y `error` reactivos alrededor del `signIn` / `signOut` de cualquier proveedor. Es el equivalente del hook `useProviderLogin` de React Native.

## Compatibilidad

| Paquete | NativeScript-Vue | NativeScript  | iOS    | Android        |
| ------- | ---------------- | ------------- | ------ | -------------- |
| 0.1.x   | 3.1 (probado)    | 9.1 (probado) | ≥ 15.0 | ≥ 7.0 (API 24) |

## Instalación

```sh
ns plugin add @franciscodlxdev/nativescript-social-login-vue
ns plugin add @franciscodlxdev/nativescript-auth-core
ns plugin add @franciscodlxdev/nativescript-oauth-presets   # o el proveedor que uses
```

La configuración nativa (el esquema de tu app en Android) es la del núcleo: ver [`nativescript-auth-core`](../auth-core#instalación).

## Uso

```vue
<template>
  <StackLayout>
    <Button
      text="Continuar con GitHub"
      :isEnabled="!github.loading.value"
      @tap="signIn"
    />
    <Label v-if="github.error.value" :text="github.error.value.code" />
  </StackLayout>
</template>

<script setup lang="ts">
import { useProviderLogin } from '@franciscodlxdev/nativescript-social-login-vue';
import { githubLogin } from '@franciscodlxdev/nativescript-oauth-presets';

const github = useProviderLogin(githubLogin, {
  clientId: 'TU_CLIENT_ID',
  redirectUri: 'https://api.miapp.com/auth/github/callback',
  callbackUri: 'miapp://callback',
});

async function signIn() {
  const result = await github.signIn(); // null si falló: mira github.error
  if (!result) return;
  // El código no le sirve a la app: tu backend lo canjea con el secret.
  await fetch('https://api.miapp.com/auth/github/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: result.code,
      codeVerifier: result.codeVerifier,
      redirectUri: result.redirectUri,
    }),
  });
}
</script>
```

| Devuelve      | Qué es                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------- |
| `signIn(o?)`  | Llama al `signIn` del proveedor con tus opciones más `o`. Resuelve con el resultado o `null` |
| `signOut(o?)` | Revoca `o.token` si el proveedor lo permite y limpia `result` y `error`                      |
| `loading`     | `Ref<boolean>` de solo lectura                                                               |
| `result`      | El último `SignInResult`, o `null`                                                           |
| `error`       | El último `AuthError` (`CANCELLED` si el usuario cerró el navegador), o `null`               |
| `isAvailable` | `false` hasta que responde la verificación de la plataforma                                  |

Las opciones pueden ser un objeto, un `ref` o un getter; se leen en cada llamada. Si el componente se desmonta con el navegador abierto, el composable deja de tocar su estado.

## Licencia

MIT
