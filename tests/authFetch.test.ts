import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test through the public api object. Since api.ts uses global fetch + localStorage,
// we mock those at the global level.

// We need to import api lazily after setting up mocks, because the module reads API_URL at load time.
let api: typeof import('../services/api')['api'];

const mockFetch = vi.fn();
const mockReload = vi.fn();

beforeEach(async () => {
  // Reset modules so each test has a clean isRefreshing/refreshPromise state
  vi.resetModules();
  mockFetch.mockReset();
  mockReload.mockReset();

  // --- Mock fetch ---
  globalThis.fetch = mockFetch;

  // --- Mock localStorage ---
  const store: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { for (const k in store) delete store[k]; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true, configurable: true });

  // --- Mock location.reload ---
  Object.defineProperty(globalThis, 'location', {
    value: { reload: mockReload },
    writable: true,
    configurable: true,
  });

  // Pre-set a valid token so authFetch sends Authorization header
  mockLocalStorage.setItem('devflow_token', 'valid-token');
  mockLocalStorage.setItem('devflow_refresh_token', 'valid-refresh');

  // Dynamically import to pick up fresh mocks
  const mod = await import('../services/api');
  api = mod.api;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Helper: create a mock Response
const mockResponse = (status: number, body: unknown = {}, ok?: boolean): Response => {
  return {
    ok: ok ?? (status >= 200 && status < 300),
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    headers: new Headers(),
    redirected: false,
    statusText: status === 200 ? 'OK' : 'Error',
    type: 'basic' as ResponseType,
    url: '',
    clone: vi.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
    formData: vi.fn(),
    bytes: vi.fn(),
  } as unknown as Response;
};

describe('authFetch - successful requests', () => {
  it('should pass Authorization header when token exists', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, [{ id: 'u1', name: 'Admin' }]));

    const result = await api.getUsers();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/users');
    expect(opts.headers).toHaveProperty('Authorization', 'Bearer valid-token');
    expect(result).toEqual([{ id: 'u1', name: 'Admin' }]);
  });

  it('should pass method and body for POST requests', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200));

    await api.createSprint({ id: 's1', name: 'Sprint 1', goal: '', startDate: '2026-01-01', endDate: '2026-01-14', status: 'active' } as any);

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(opts.body).toContain('"name":"Sprint 1"');
  });
});

describe('authFetch - 401 → token refresh → retry', () => {
  it('should refresh token and retry on 401', async () => {
    // First call: 401
    mockFetch.mockResolvedValueOnce(mockResponse(401));

    // Refresh call: success
    mockFetch.mockResolvedValueOnce(mockResponse(200, { token: 'new-token', refreshToken: 'new-refresh' }));

    // Retry call: success with data
    mockFetch.mockResolvedValueOnce(mockResponse(200, [{ id: 'u1', name: 'Admin' }]));

    const result = await api.getUsers();

    // 3 fetch calls: original, refresh, retry
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Refresh call should hit /auth/refresh
    expect(mockFetch.mock.calls[1][0]).toContain('/auth/refresh');

    // New token stored
    expect(localStorage.getItem('devflow_token')).toBe('new-token');
    expect(localStorage.getItem('devflow_refresh_token')).toBe('new-refresh');

    // Final result is from the retried request
    expect(result).toEqual([{ id: 'u1', name: 'Admin' }]);
  });

  it('should logout and throw when refresh fails', async () => {
    // First call: 401
    mockFetch.mockResolvedValueOnce(mockResponse(401));

    // Refresh call: also fails
    mockFetch.mockResolvedValueOnce(mockResponse(401, {}, false));

    await expect(api.getUsers()).rejects.toThrow('Sessão expirada');

    // Tokens removed
    expect(localStorage.getItem('devflow_token')).toBeNull();
    expect(localStorage.getItem('devflow_refresh_token')).toBeNull();

    // Page reload triggered
    expect(mockReload).toHaveBeenCalledOnce();
  });

  it('should logout when no refresh token available', async () => {
    localStorage.removeItem('devflow_refresh_token');

    // First call: 401
    mockFetch.mockResolvedValueOnce(mockResponse(401));

    await expect(api.getUsers()).rejects.toThrow('Sessão expirada');
    expect(mockReload).toHaveBeenCalledOnce();
  });
});

describe('authFetch - non-401 errors', () => {
  it('should throw on non-ok responses without triggering refresh', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(500, { error: 'Internal error' }, false));

    await expect(api.getUsers()).rejects.toThrow('Falha ao carregar usuários');

    // Only 1 fetch call (no refresh attempt)
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});
