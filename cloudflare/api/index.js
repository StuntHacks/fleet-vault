import data from '../../src/data.json';

const BASE = '/fleet-vault';
const PAGE = 1000;
const CACHE_SECONDS = 300;

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
};

const json = (body, status = 200) => new Response(JSON.stringify(body, null, 2), {
  status,
  headers: {
    ...HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': status === 200 ? `public, max-age=${CACHE_SECONDS}` : 'no-store',
  },
});

async function query(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` },
  });

  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

async function solutionsFor(env, galaxyId) {
  const all = [];

  for (let from = 0; ; from += PAGE) {
    const page = await query(env, `solutions_ranked?galaxy_id=eq.${galaxyId}&select=*&order=battle_id,combat_stats,rank_in_group,id&offset=${from}&limit=${PAGE}`);
    all.push(...page);

    if (page.length < PAGE) return all;
  }
}

function orderBattles(battles, order) {
  if (!order?.length) return battles;
  const ordered = order.map((id) => battles.find((b) => b.id === id)).filter(Boolean);
  return [...ordered, ...battles.filter((b) => !ordered.includes(b))];
}

const displayOrder = (a, b) =>
  a.combat_stats - b.combat_stats
  || Number(b.verified_at != null) - Number(a.verified_at != null)
  || (a.fr_total ?? a.fr_used) - (b.fr_total ?? b.fr_used);

const entry = ({ galaxy_id, battle_id, rank_in_group, ...rest }) => rest;

async function galaxy(env, id) {
  const info = data.galaxies[id - 1];
  if (!info) return null;

  const [row] = await query(env, `galaxies?id=eq.${id}&select=hidden,battle_order`);
  if (!row || row.hidden) return null;

  const byBattle = {};
  for (const s of await solutionsFor(env, id)) (byBattle[s.battle_id] ??= []).push(s);

  return {
    galaxy: id,
    name: info.name,
    battles: orderBattles(info.battles, row.battle_order).map((b) => {
      const list = byBattle[b.id] ?? [];

      return {
        id: b.id,
        name: b.name,
        boss: !!b.boss,
        solutions: list.filter((s) => s.rank_in_group === 1).sort(displayOrder).map(entry),
        obsolete: list.filter((s) => s.rank_in_group > 1).sort(displayOrder).map(entry),
      };
    }),
  };
}

async function handle(request, env) {
  const { pathname } = new URL(request.url);
  const match = pathname.match(new RegExp(`^${BASE}/g/(\\d{1,3})/?$`));
  if (!match) return json({ error: 'Not found' }, 404);

  const result = await galaxy(env, parseInt(match[1], 10));
  return result ? json(result) : json({ error: 'Galaxy not found' }, 404);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: HEADERS });
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'Method not allowed' }, 405);

    const url = new URL(request.url);
    const key = new Request(url.origin + url.pathname);
    const cached = await caches.default.match(key);
    if (cached) return cached;

    let response;
    try {
      response = await handle(request, env);
    } catch (e) {
      console.error(e);
      return json({ error: 'Upstream error' }, 502);
    }

    if (response.status === 200) ctx.waitUntil(caches.default.put(key, response.clone()));
    return response;
  },
};
