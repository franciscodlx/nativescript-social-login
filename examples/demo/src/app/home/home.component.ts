import { Component, NO_ERRORS_SCHEMA, signal } from '@angular/core';
import {
  NativeScriptCommonModule,
  NativeScriptFormsModule,
} from '@nativescript/angular';
import { isAuthError } from '@franciscodlxdev/nativescript-auth-core';
import type {
  CodeRequiredStep,
  EntraStep,
} from '@franciscodlxdev/nativescript-entra-native-auth';
import { ENTRA_DEMO, ENTRA_REAL, ENTRA_REDIRECT_URI, entra } from '../entra';
import { PROVIDERS, type DemoProvider, type SignedIn } from '../providers';

type Session =
  | { status: 'idle' }
  | { status: 'working'; provider: string }
  | { status: 'done'; result: SignedIn }
  | { status: 'failed'; message: string };

function describeError(error: unknown): string {
  return isAuthError(error)
    ? `ERROR ${error.code}: ${error.message}`
    : error instanceof Error
      ? error.message
      : String(error);
}

@Component({
  selector: 'Home',
  templateUrl: './home.component.html',
  imports: [NativeScriptCommonModule, NativeScriptFormsModule],
  schemas: [NO_ERRORS_SCHEMA],
})
export class HomeComponent {
  readonly providers = PROVIDERS;
  readonly session = signal<Session>({ status: 'idle' });

  readonly entraReal = ENTRA_REAL;
  email = ENTRA_DEMO.email;
  password = ENTRA_DEMO.password;
  code = ENTRA_DEMO.code;
  readonly entraStep = signal<CodeRequiredStep | null>(null);

  busy(): boolean {
    return this.session().status === 'working';
  }

  async signIn(provider: DemoProvider): Promise<void> {
    this.session.set({ status: 'working', provider: provider.label });
    try {
      this.session.set({ status: 'done', result: await provider.signIn() });
    } catch (error) {
      this.session.set({ status: 'failed', message: describeError(error) });
    }
  }

  async entraSignIn(): Promise<void> {
    await this.runEntra(() =>
      entra.signIn({
        username: this.email,
        password: this.password || undefined,
      })
    );
  }

  async entraSubmitCode(): Promise<void> {
    const step = this.entraStep();
    if (step) {
      await this.runEntra(() => entra.submitCode(step, this.code));
    }
  }

  private async runEntra(next: () => Promise<EntraStep>): Promise<void> {
    this.session.set({ status: 'working', provider: 'Entra' });
    try {
      let step = await next();
      if (step.type === 'browser_required') {
        const tokens = await entra.signInWithBrowser({
          redirectUri: ENTRA_REDIRECT_URI,
          loginHint: step.username,
        });
        step = { type: 'signed_in', tokens };
      }
      if (step.type === 'code_required') {
        this.entraStep.set(step);
        this.session.set({ status: 'idle' });
        return;
      }
      if (step.type !== 'signed_in') {
        throw new Error(`Entra needs "${step.type}"; this demo only signs in.`);
      }
      this.entraStep.set(null);
      const claims = step.tokens.idTokenClaims ?? {};
      this.session.set({
        status: 'done',
        result: {
          provider: 'Entra',
          id: String(step.tokens.profile?.id ?? claims.sub ?? ''),
          name: step.tokens.profile?.name,
          email: step.tokens.profile?.email,
        },
      });
    } catch (error) {
      this.session.set({ status: 'failed', message: describeError(error) });
    }
  }
}
