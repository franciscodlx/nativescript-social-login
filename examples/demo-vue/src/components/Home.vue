<template>
  <Frame>
    <Page>
      <ActionBar title="Social login · NativeScript-Vue" />

      <ScrollView>
        <StackLayout class="page">
          <Label
            class="note"
            textWrap="true"
            text="Providers without a client ID in src/config.ts use the local mocks."
          />

          <ActivityIndicator v-if="busy" :busy="true" margin="16" />
          <Label
            v-else-if="failure"
            class="bad"
            textWrap="true"
            automationText="error"
            :text="failure"
            margin="0 0 12 0"
          />
          <StackLayout
            v-else-if="signedIn"
            automationText="result"
            margin="0 0 12 0"
          >
            <Label class="ok" :text="`SIGNED IN (${signedIn.provider})`" />
            <Label class="mono" :text="`id: ${signedIn.id}`" />
            <Label class="mono" :text="`name: ${signedIn.name}`" />
            <Label class="mono" :text="`username: ${signedIn.username}`" />
            <Label class="mono" :text="`email: ${signedIn.email}`" />
          </StackLayout>

          <!-- X goes through the useProviderLogin composable. -->
          <Button
            class="provider"
            automationText="sign-in-x"
            :isEnabled="!busy"
            :backgroundColor="X_PROVIDER.color"
            :text="`Sign in with X${X_PROVIDER.real ? '' : ' (mock)'}`"
            @tap="signInWithX"
          />

          <!-- The rest exchange the code on a backend (see providers.ts). -->
          <Button
            v-for="provider in PROVIDERS"
            :key="provider.id"
            class="provider"
            :automationText="`sign-in-${provider.id}`"
            :isEnabled="!busy"
            :backgroundColor="provider.color"
            :text="`Sign in with ${provider.label}${provider.real ? '' : ' (mock)'}`"
            @tap="signIn(provider)"
          />

          <Label
            class="section"
            :text="`Microsoft Entra (native auth)${ENTRA_REAL ? '' : ' · mock'}`"
          />
          <TextField
            v-model="email"
            class="field"
            hint="Email"
            keyboardType="email"
            autocapitalizationType="none"
          />
          <TextField
            v-model="password"
            class="field"
            hint="Password (empty: email code)"
            :secure="true"
          />
          <template v-if="entraStep">
            <TextField
              v-model="code"
              class="field"
              :hint="`Code sent to ${entraStep.sentTo ?? entraStep.username}`"
              keyboardType="number"
            />
            <Button
              class="provider"
              backgroundColor="#0078d4"
              automationText="entra-code"
              :isEnabled="!busy"
              text="Submit code"
              @tap="entraSubmitCode"
            />
          </template>
          <Button
            v-else
            class="provider"
            backgroundColor="#0078d4"
            automationText="entra-sign-in"
            :isEnabled="!busy"
            text="Sign in with Entra"
            @tap="entraSignIn"
          />
        </StackLayout>
      </ScrollView>
    </Page>
  </Frame>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef } from 'nativescript-vue';
import { isAuthError } from '@franciscodlxdev/nativescript-auth-core';
import type {
  CodeRequiredStep,
  EntraStep,
} from '@franciscodlxdev/nativescript-entra-native-auth';
import { useProviderLogin } from '@franciscodlxdev/nativescript-social-login-vue';
import { ENTRA_DEMO, ENTRA_REAL, ENTRA_REDIRECT_URI, entra } from '../entra';
import {
  PROVIDERS,
  X_LOGIN,
  X_OPTIONS,
  X_PROVIDER,
  xSummary,
  type DemoProvider,
  type SignedIn,
} from '../providers';

function describeError(error: unknown): string {
  return isAuthError(error)
    ? `ERROR ${error.code}: ${error.message}`
    : error instanceof Error
      ? error.message
      : String(error);
}

// Providers that go through a backend, and Entra.
const working = ref(false);
const result = shallowRef<SignedIn | null>(null);
const error = ref<string | null>(null);

// X: the composable owns loading, result and error.
const x = useProviderLogin(X_LOGIN, X_OPTIONS);
const xProfile = computed(() => {
  try {
    return x.result.value ? xSummary(x.result.value.profile) : null;
  } catch (e) {
    return describeError(e);
  }
});
const lastWasX = ref(false);

const busy = computed(() => working.value || x.loading.value);
const signedIn = computed(() =>
  lastWasX.value
    ? typeof xProfile.value === 'object'
      ? xProfile.value
      : null
    : result.value
);
const failure = computed(() => {
  if (!lastWasX.value) return error.value;
  if (x.error.value) return describeError(x.error.value);
  return typeof xProfile.value === 'string' ? xProfile.value : null;
});

async function signInWithX(): Promise<void> {
  lastWasX.value = true;
  await x.signIn();
}

async function run(next: () => Promise<SignedIn | null>): Promise<void> {
  lastWasX.value = false;
  working.value = true;
  error.value = null;
  result.value = null;
  try {
    result.value = await next();
  } catch (e) {
    error.value = describeError(e);
  } finally {
    working.value = false;
  }
}

function signIn(provider: DemoProvider): Promise<void> {
  return run(() => provider.signIn());
}

// Entra (native auth): email and password, or a one-time code.
const email = ref(ENTRA_DEMO.email);
const password = ref(ENTRA_DEMO.password);
const code = ref(ENTRA_DEMO.code);
const entraStep = shallowRef<CodeRequiredStep | null>(null);

function entraSignIn(): Promise<void> {
  return runEntra(() =>
    entra.signIn({
      username: email.value,
      password: password.value || undefined,
    })
  );
}

function entraSubmitCode(): Promise<void> {
  const step = entraStep.value;
  return step
    ? runEntra(() => entra.submitCode(step, code.value))
    : Promise.resolve();
}

function runEntra(next: () => Promise<EntraStep>): Promise<void> {
  return run(async () => {
    let step = await next();
    if (step.type === 'browser_required') {
      const tokens = await entra.signInWithBrowser({
        redirectUri: ENTRA_REDIRECT_URI,
        loginHint: step.username,
      });
      step = { type: 'signed_in', tokens };
    }
    if (step.type === 'code_required') {
      entraStep.value = step;
      return null;
    }
    if (step.type !== 'signed_in') {
      throw new Error(`Entra needs "${step.type}"; this demo only signs in.`);
    }
    entraStep.value = null;
    const claims = step.tokens.idTokenClaims ?? {};
    return {
      provider: 'Entra',
      id: String(step.tokens.profile?.id ?? claims.sub ?? ''),
      name: step.tokens.profile?.name,
      email: step.tokens.profile?.email,
    };
  });
}
</script>
