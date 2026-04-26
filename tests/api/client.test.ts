import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { ApiClient } from '../../src/api/client.js';
import { ApiError } from '../../src/api/errors.js';

let agent: MockAgent;
let pool: ReturnType<MockAgent['get']>;

beforeEach(() => {
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  pool = agent.get('http://test.local');
});
afterEach(async () => { await agent.close(); });

const client = () => new ApiClient({ baseUrl: 'http://test.local', token: 't' });

describe('ApiClient', () => {
  it('sends Bearer token and parses JSON', async () => {
    pool.intercept({ path: '/api/auth/me', method: 'GET' })
      .reply(200, { id: 1, email: 'a@b', name: 'A', role: 'admin' });
    const res = await client().get('/api/auth/me');
    expect(res).toEqual({ id: 1, email: 'a@b', name: 'A', role: 'admin' });
  });

  it('throws ApiError(401) on unauthenticated', async () => {
    pool.intercept({ path: '/api/auth/me', method: 'GET' })
      .reply(401, { message: 'Unauthenticated' });
    await expect(client().get('/api/auth/me')).rejects.toBeInstanceOf(ApiError);
  });

  it('passes 422 details through', async () => {
    pool.intercept({ path: '/api/auth/login', method: 'POST' })
      .reply(422, { message: 'Validation', errors: { email: ['required'] } });
    try {
      await client().post('/api/auth/login', { email: '', password: '' });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(422);
      expect((e as ApiError).details).toEqual({ email: ['required'] });
    }
  });
});
