const request = require('supertest');

const BASE_URL = process.env.BASE_URL || 'https://eli10-app-olxw.vercel.app';

describe('Backend refactor (Milestone B)', () => {
  test('server still boots — / returns 200', async () => {
    const res = await request(BASE_URL).get('/');
    expect(res.status).toBe(200);
  });

  test('unknown route returns 404 JSON via new 404 handler', async () => {
    const res = await request(BASE_URL).get('/__not_a_real_route__');
    expect(res.status).toBe(404);
  });

  test('GET /teams/:user_id rejects non-UUID (regression from Milestone A)', async () => {
    const res = await request(BASE_URL).get('/teams/not-a-uuid');
    expect([400, 401]).toContain(res.status);
  });

  test('/reminders/notify without cron secret returns 401', async () => {
    const res = await request(BASE_URL).post('/reminders/notify').send({});
    expect(res.status).toBe(401);
  });
});
