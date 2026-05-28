const DATA_LAYER_REQUIRED_ENV_KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const CORE_REQUIRED_ENV_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXTAUTH_SECRET",
  "INTERNAL_API_KEY",
  "CRON_SECRET",
] as const;

const SMTP_REQUIRED_ENV_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
] as const;

const validatedScopes = new Set<string>();

function getMissingKeys(keys: readonly string[]) {
  return keys.filter((key) => {
    const value = process.env[key];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

export function assertEnv(keys: readonly string[], scope = "runtime") {
  const missing = getMissingKeys(keys);
  if (missing.length) {
    throw new Error(
      `Missing required environment variables for ${scope}: ${missing.join(", ")}`
    );
  }
}

export function getEnvVar(key: string, scope = "runtime") {
  const value = process.env[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required environment variable ${key} for ${scope}`);
  }
  return value;
}

export function validateDataLayerEnv() {
  const scope = "planxo-data-layer";
  if (validatedScopes.has(scope)) return;

  assertEnv(DATA_LAYER_REQUIRED_ENV_KEYS, scope);

  validatedScopes.add(scope);
}

export function validateCoreEnv() {
  const scope = "planxo-core";
  if (validatedScopes.has(scope)) return;

  validateDataLayerEnv();
  assertEnv(CORE_REQUIRED_ENV_KEYS, scope);

  const hasResend =
    typeof process.env.RESEND_API_KEY === "string" &&
    process.env.RESEND_API_KEY.trim().length > 0;
  const hasSmtp = getMissingKeys(SMTP_REQUIRED_ENV_KEYS).length === 0;

  if (!hasResend && !hasSmtp) {
    throw new Error(
      "Missing email environment configuration for planxo-core: set RESEND_API_KEY or full SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM"
    );
  }

  validatedScopes.add(scope);
}
