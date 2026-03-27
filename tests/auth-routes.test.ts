// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';

const mockDb = {
  prepare: vi.fn(),
};

const mockRotateRefreshToken = vi.fn();
const mockGenerateToken = vi.fn();
const mockGenerateRefreshToken = vi.fn();
const mockCleanupExpiredTokens = vi.fn();

vi.mock('../server/db.js', () => ({
  default: mockDb,
}));

vi.mock('../server/middleware/auth.js', () => ({
  generateToken: mockGenerateToken,
  generateRefreshToken: mockGenerateRefreshToken,
  rotateRefreshToken: mockRotateRefreshToken,
  cleanupExpiredTokens: mockCleanupExpiredTokens,
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'u-1', role: 'user' };
    next();
  },
}));

vi.mock('../server/validation.js', () => ({
  loginSchema: {},
  registerSchema: {},
  updateProfileSchema: {},
  updatePasswordSchema: {},
  refreshTokenSchema: {},
  validate: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../server/utils.js', () => ({
  uid: () => 'u-100',
  sendError: (res: any, status: number, error: string, details?: string) => {
    const body: Record<string, string> = { error };
    if (details) body.details = details;
    return res.status(status).json(body);
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    compareSync: vi.fn(),
    hashSync: vi.fn(() => 'hashed-pass'),
  },
  compareSync: vi.fn(),
  hashSync: vi.fn(() => 'hashed-pass'),
}));

const makePrepare = ({ get, all, run }: { get?: any; all?: any; run?: any }) => ({
  get: vi.fn(() => get),
  all: vi.fn(() => all ?? []),
  run: vi.fn(() => run ?? { changes: 1 }),
});

const request = async (app: express.Express, path: string, init?: RequestInit) => {
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;

  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, init);
    const body = await res.json();
    return { res, body };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
};

describe('auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /auth/refresh returns 401 for invalid refresh token', async () => {
    mockRotateRefreshToken.mockReturnValue(null);

    const { default: authRouter } = await import('../server/routes/auth.js');
    const app = express();
    app.use(express.json());
    app.use('/auth', authRouter);

    const { res, body } = await request(app, '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'invalid' }),
    });

    expect(res.status).toBe(401);
    expect(body.error).toBe('Refresh token inválido ou expirado');
  });

  it('POST /auth/refresh returns new token pair when valid', async () => {
    mockRotateRefreshToken.mockReturnValue({ accessToken: 'new-access', refreshToken: 'new-refresh' });

    const { default: authRouter } = await import('../server/routes/auth.js');
    const app = express();
    app.use(express.json());
    app.use('/auth', authRouter);

    const { res, body } = await request(app, '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'valid-token' }),
    });

    expect(res.status).toBe(200);
    expect(body).toEqual({ token: 'new-access', refreshToken: 'new-refresh' });
  });

  it('POST /auth/login returns 401 when user does not exist', async () => {
    const invalidPassword = String.fromCodePoint(120);
    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('FROM users WHERE email')) return makePrepare({ get: undefined });
      if (sql.includes('FROM groups g')) return makePrepare({ all: [] });
      return makePrepare({});
    });

    const { default: authRouter } = await import('../server/routes/auth.js');
    const app = express();
    app.use(express.json());
    app.use('/auth', authRouter);

    const { res, body } = await request(app, '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'none@devflow.test', password: invalidPassword }),
    });

    expect(res.status).toBe(401);
    expect(body.error).toBe('Credenciais inválidas');
  });

  it('POST /auth/register returns 403 when self-register is disabled', async () => {
    const strongPassword = ['Strong', 'P4ss'].join('');
    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT value FROM settings WHERE key')) {
        return makePrepare({ get: { value: 'false' } });
      }
      return makePrepare({});
    });

    const { default: authRouter } = await import('../server/routes/auth.js');
    const app = express();
    app.use(express.json());
    app.use('/auth', authRouter);

    const { res, body } = await request(app, '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@devflow.test',
        password: strongPassword,
      }),
    });

    expect(res.status).toBe(403);
    expect(body.error).toBe('Cadastro automático está desabilitado');
  });
});
