const request = require('supertest');

const BASE_URL = process.env.BASE_URL || 'https://eli10-app-olxw.vercel.app';

describe('Frontend smoke (Milestone C)', () => {
  test('GET /app returns 200 HTML', async () => {
    const res = await request(BASE_URL).get('/app');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  test('GET / (landing) returns 200 HTML', async () => {
    const res = await request(BASE_URL).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  test('GET /styles.css returns 200 CSS', async () => {
    const res = await request(BASE_URL).get('/styles.css');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/css/);
  });

  test('app HTML contains expected screen markers', async () => {
    const res = await request(BASE_URL).get('/app');
    expect(res.text).toContain('id="authScreen"');
    expect(res.text).toContain('id="appScreen"');
  });

  test('styles.css declares the design tokens', async () => {
    const res = await request(BASE_URL).get('/styles.css');
    // Baseline: 2 occurrences (legacy duplicate). Tightened to ===1 in Task 2.
    const matches = res.text.match(/^:root\s*{/gm) || [];
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
