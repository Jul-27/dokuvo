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

  test('styles.css declares :root exactly once', async () => {
    const res = await request(BASE_URL).get('/styles.css');
    const matches = res.text.match(/^:root\s*{/gm) || [];
    expect(matches.length).toBe(1);
  });

  test('styles.css declares body exactly once at top of file', async () => {
    const res = await request(BASE_URL).get('/styles.css');
    // Match top-level "body { ... }" rule (not nested selectors like ".foo body").
    const matches = res.text.match(/^body\s*{/gm) || [];
    expect(matches.length).toBe(1);
  });

  test('app HTML defines a single modal factory', async () => {
    const res = await request(BASE_URL).get('/app');
    const matches = res.text.match(/function createModalOverlay\s*\(/g) || [];
    expect(matches.length).toBe(1);
  });

  test('app HTML modal factory sets role="dialog" and aria-modal', async () => {
    const res = await request(BASE_URL).get('/app');
    expect(res.text).toMatch(/setAttribute\(['"]role['"],\s*['"]dialog['"]\)/);
    expect(res.text).toMatch(/setAttribute\(['"]aria-modal['"],\s*['"]true['"]\)/);
  });
});
