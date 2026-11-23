import { ENV_NAME } from './environments';

export const ROLES = ['system-admin', 'super-user', 'end-user', 'uploader'] as const;
export type Role = (typeof ROLES)[number];

/** Saved session of a role (git-ignored), written by tests/auth.setup.ts */
export const authFile = (role: Role) => `.auth/${ENV_NAME}-${role}.json`;

/** MANUAL_LOGIN=1: the tester finishes Microsoft sign-in (MFA) in a headed browser */
export const manualLogin = process.env.MANUAL_LOGIN === '1';

/** Credentials from .env, e.g. SUPER_USER_EMAIL / SUPER_USER_PASSWORD */
export function credentialsFor(role: Role) {
  const prefix = role.toUpperCase().replace('-', '_');
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) throw new Error(`Missing ${prefix}_EMAIL / ${prefix}_PASSWORD in .env`);
  return { email, password };
}
