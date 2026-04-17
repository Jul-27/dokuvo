const request = require('supertest');

const BASE_URL = process.env.BASE_URL || 'https://eli10-app-olxw.vercel.app';

describe('Security hardening (Milestone A)', () => {
  test('/create-checkout without auth returns 401', async () => {
    const res = await request(BASE_URL).post('/create-checkout').send({});
    expect(res.status).toBe(401);
  });

  test('/kalender-alarm without auth returns 401', async () => {
    const res = await request(BASE_URL).post('/kalender-alarm').send({ titel: 'x', datum: '2030-01-01' });
    expect(res.status).toBe(401);
  });

  test('/upload-avatar with invalid file_ext returns 400 or 401', async () => {
    const res = await request(BASE_URL).post('/upload-avatar').send({
      user_id: '00000000-0000-0000-0000-000000000000',
      image_base64: 'AAAA',
      file_ext: '../../evil'
    });
    expect([400, 401]).toContain(res.status);
  });

  test('/shared/:id returns 404 for unknown id', async () => {
    const res = await request(BASE_URL).get('/shared/__does_not_exist__');
    expect(res.status).toBe(404);
  });

  test('verifyUser rejects non-UUID user_id with 400 or 401', async () => {
    const res = await request(BASE_URL).get('/chat/not-a-uuid');
    expect([400, 401]).toContain(res.status);
  });

  test('response includes helmet security headers', async () => {
    const res = await request(BASE_URL).get('/');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
