const TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const MAX_SIZE = 10 * 1024 * 1024;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const encoder = new TextEncoder();

function corsHeaders(request, env) {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Vary': 'Origin',
  };
}

function isAdmin(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  const given = encoder.encode(request.headers.get('Authorization') ?? '');
  const expected = encoder.encode(`Bearer ${env.ADMIN_TOKEN}`);
  return given.byteLength === expected.byteLength && crypto.subtle.timingSafeEqual(given, expected);
}

const isImage = (file) => file instanceof File && file.size > 0 && file.size <= MAX_SIZE && !!TYPES[file.type];

async function store(env, key, body, contentType) {
  await env.BUCKET.put(key, body, { httpMetadata: { contentType, cacheControl: CACHE_CONTROL } });
  return `${env.PUBLIC_URL}/${key}`;
}

async function upload(request, env) {
  const form = await request.formData().catch(() => null);
  const galaxyId = String(form?.get('galaxyId'));
  const battleId = String(form?.get('battleId'));
  const screenshot = form?.get('screenshot');
  const thumbnail = form?.get('thumbnail');

  if (!/^\d{1,3}$/.test(galaxyId) || !/^g\d+[a-z]?_[\w-]{1,60}$/.test(battleId)) return new Response('Invalid battle', { status: 400 });
  if (!isImage(screenshot) || (thumbnail && !isImage(thumbnail))) return new Response('Invalid image', { status: 400 });

  const base = `${galaxyId}/${battleId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  return Response.json({
    screenshot_url: await store(env, `${base}.${TYPES[screenshot.type]}`, screenshot, screenshot.type),
    thumbnail_url: thumbnail ? await store(env, `${base}.thumb.${TYPES[thumbnail.type]}`, thumbnail, thumbnail.type) : null,
  });
}

async function listObjects(env) {
  const keys = [];
  let cursor;
  do {
    const page = await env.BUCKET.list({ cursor, limit: 1000 });
    keys.push(...page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return Response.json(keys);
}

async function putObject(request, env, key) {
  const contentType = request.headers.get('Content-Type');
  if (!/^[\w.-]+(\/[\w.-]+)*$/.test(key) || key.includes('..')) return new Response('Invalid key', { status: 400 });
  if (!TYPES[contentType] || !request.body) return new Response('Invalid image', { status: 400 });
  return Response.json({ url: await store(env, key, request.body, contentType) });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/upload') {
      const headers = corsHeaders(request, env);
      if (request.method === 'OPTIONS') return new Response(null, { headers });
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers });
      const res = await upload(request, env);
      for (const [name, value] of Object.entries(headers)) res.headers.set(name, value);
      return res;
    }

    if (pathname === '/objects' || pathname.startsWith('/objects/')) {
      if (!isAdmin(request, env)) return new Response('Unauthorized', { status: 401 });
      if (request.method === 'GET' && pathname === '/objects') return listObjects(env);
      if (request.method === 'PUT') return putObject(request, env, decodeURIComponent(pathname.slice('/objects/'.length)));
      return new Response('Method not allowed', { status: 405 });
    }

    return new Response('Not found', { status: 404 });
  },
};
