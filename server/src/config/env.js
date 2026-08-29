import dotenv from 'dotenv';

dotenv.config();

function required(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name, fallback = '') {
  return process.env[name] ?? fallback;
}

function bool(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === '1';
}

function int(name, fallback) {
  const raw = process.env[name];
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const isTest = process.env.NODE_ENV === 'test';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isTest,
  isProduction: process.env.NODE_ENV === 'production',
  port: int('PORT', 4000),
  clientUrl: optional('CLIENT_URL', 'http://localhost:5173'),

  // Auth — a throwaway secret is fine only for the test runner
  jwtSecret: isTest ? optional('JWT_SECRET', 'test-secret') : required('JWT_SECRET'),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '12h'),

  // Alerting
  discordWebhookUrl: optional('DISCORD_WEBHOOK_URL', ''),

  // Shared secret for the external ticket auto-create endpoint. When empty, the
  // endpoint is open (dev only) and logs a warning on each call.
  integrationApiKey: optional('INTEGRATION_API_KEY', ''),

  // Background jobs
  enableCron: bool('ENABLE_CRON', true) && !isTest,
  problemDetection: {
    threshold: int('PROBLEM_DETECTION_THRESHOLD', 3),
    windowMinutes: int('PROBLEM_DETECTION_WINDOW_MINUTES', 120),
  },

  seed: {
    adminEmail: optional('SEED_ADMIN_EMAIL', 'admin@helpdesk.local'),
    adminPassword: optional('SEED_ADMIN_PASSWORD', 'Admin!2345'),
    defaultPassword: optional('SEED_DEFAULT_PASSWORD', 'Passw0rd!'),
  },
};
