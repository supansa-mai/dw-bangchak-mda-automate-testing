import 'dotenv/config';

const environments = {
  dev: {
    // TODO: fill in once confirmed (DEV uses mock SSO)
    baseURL: '',
    timeoutScale: 1,
  },
  uat: {
    // TODO: fill in once confirmed
    baseURL: '',
    // Raise if UAT turns out slower than dev: every timeout in the config and scaled() is multiplied by it
    timeoutScale: 1,
  },
};

type EnvName = keyof typeof environments;

export const ENV_NAME = (process.env.TEST_ENV ?? 'uat') as EnvName;
if (!(ENV_NAME in environments)) {
  throw new Error(`TEST_ENV must be one of ${Object.keys(environments).join(', ')}, got "${ENV_NAME}"`);
}

const selected = environments[ENV_NAME];

/** BASE_URL in .env overrides the committed URL, e.g. for a preview deploy */
export const baseURL = process.env.BASE_URL || selected.baseURL;
if (!baseURL) {
  throw new Error(`No base URL for "${ENV_NAME}": set it in config/environments.ts (or BASE_URL in .env)`);
}

/** A timeout in ms scaled for the env; use it for every hard-coded timeout */
export const scaled = (ms: number) => ms * selected.timeoutScale;
