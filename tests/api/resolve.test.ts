import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { ApiClient } from '../../src/api/client.js';
import { resolveProjectId, resolveAssigneeId } from '../../src/api/resolve.js';

let agent: MockAgent;
beforeEach(() => {
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
});
afterEach(async () => { await agent.close(); });

const client = () => new ApiClient({ baseUrl: 'http://api.test', token: 't' });

describe('resolveProjectId', () => {
  it('returns id for matching code', async () => {
    agent.get('http://api.test').intercept({ path: '/api/projects', method: 'GET' })
      .reply(200, { data: [{ id: 5, code: 'RVV', title: 'Revvork' }] });
    expect(await resolveProjectId(client(), 'RVV')).toBe(5);
  });
  it('throws ApiError 404 for unknown code', async () => {
    agent.get('http://api.test').intercept({ path: '/api/projects', method: 'GET' })
      .reply(200, { data: [] });
    const { ApiError } = await import('../../src/api/errors.js');
    await expect(resolveProjectId(client(), 'XXX')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('resolveAssigneeId', () => {
  it('returns id for matching email', async () => {
    agent.get('http://api.test').intercept({ path: '/api/users', method: 'GET' })
      .reply(200, { data: [{ id: 3, email: 'budi@co.com', name: 'Budi', role: 'user' }] });
    expect(await resolveAssigneeId(client(), 'budi@co.com')).toBe(3);
  });
  it('returns numeric id directly without API call', async () => {
    expect(await resolveAssigneeId(client(), '7')).toBe(7);
  });
  it('throws ApiError 404 for unknown email', async () => {
    agent.get('http://api.test').intercept({ path: '/api/users', method: 'GET' })
      .reply(200, { data: [] });
    const { ApiError } = await import('../../src/api/errors.js');
    await expect(resolveAssigneeId(client(), 'ghost@co.com')).rejects.toBeInstanceOf(ApiError);
  });
});
