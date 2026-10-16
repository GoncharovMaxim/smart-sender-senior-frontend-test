import type { User, Webhook } from '../api/types';

export const MOCK_CREDENTIALS = { email: 'admin@smartsender.test', password: 'secret123' } as const;
export const CSRF_TOKEN = 'b7f3c2e1a9d84f6e8c0d2a4b6e8f1c3d';
export const SESSION_TTL_MS = 30_000;

interface MockUser extends User {
  password: string;
}

interface DeviceSession {
  userId: number;
  fingerprint: string;
}

/** Server-side session — the analog of an HttpOnly cookie, invisible to the client. */
export interface MockSession {
  userId: number;
  fingerprint: string;
  expiresAt: number;
}

export interface MockDb {
  user: MockUser;
  /** device_session_token → owner; a token is single-use. */
  deviceSessions: Map<string, DeviceSession>;
  session: MockSession | null;
  webhooks: Webhook[];
}

const TOPICS = [
  'Order created',
  'Order paid',
  'Order refunded',
  'Customer signed up',
  'Customer updated',
  'Subscription renewed',
  'Subscription cancelled',
  'Message delivered',
  'Message failed',
];
const ENVIRONMENTS = ['Production', 'Staging', 'Sandbox'];

function createWebhooks(): Webhook[] {
  const base = Date.UTC(2026, 8, 1);
  return ENVIRONMENTS.flatMap((env) => TOPICS.map((topic) => ({ env, topic }))).map(({ env, topic }, index) => ({
    id: index + 1,
    name: `${topic} · ${env}`,
    url: `https://hooks.example.com/${env.toLowerCase()}/${topic.toLowerCase().replaceAll(' ', '-')}`,
    active: index % 4 !== 0,
    created_at: new Date(base + index * 86_400_000).toISOString(),
  }));
}

export function createDb(): MockDb {
  return {
    user: {
      id: 1,
      email: MOCK_CREDENTIALS.email,
      password: MOCK_CREDENTIALS.password,
      first_name: 'Admin',
      last_name: 'Admin',
      name: 'Admin Admin',
    },
    deviceSessions: new Map(),
    session: null,
    webhooks: createWebhooks(),
  };
}
