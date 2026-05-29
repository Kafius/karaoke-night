const { Redis } = require('@upstash/redis');

// The Upstash Marketplace integration sets KV_REST_API_* (Vercel-style) and/or
// UPSTASH_REDIS_REST_* env vars. Support whichever pair is present.
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const KEY = 'karaoke:queue';

async function read() {
  try {
    const list = await redis.get(KEY);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

async function write(list) {
  await redis.set(KEY, list);
}

function body(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { resolve({}); }
    });
  });
}

function clean(s, max) {
  return String(s == null ? '' : s).trim().slice(0, max || 120);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (!redis.url && !(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL)) {
    res.status(500).json({ error: 'storage not configured' });
    return;
  }

  let list = await read();

  if (req.method === 'GET') {
    res.status(200).json(list);
    return;
  }

  if (req.method === 'POST') {
    const b = await body(req);
    const singer = clean(b.singer, 60);
    const song = clean(b.song, 120);
    const artist = clean(b.artist, 80);
    if (!singer || !song) { res.status(400).json({ error: 'singer and song required' }); return; }
    list.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      singer, song, artist, done: false
    });
    await write(list);
    res.status(200).json(list);
    return;
  }

  if (req.method === 'PATCH') {
    const b = await body(req);

    if (b.action === 'reorder' && Array.isArray(b.order)) {
      const map = {};
      list.forEach((x) => (map[x.id] = x));
      const next = b.order.map((id) => map[id]).filter(Boolean);
      list.forEach((x) => { if (!b.order.includes(x.id)) next.push(x); });
      await write(next);
      res.status(200).json(next);
      return;
    }

    const item = list.find((x) => x.id === b.id);
    if (!item) { res.status(404).json({ error: 'not found' }); return; }
    if (typeof b.done === 'boolean') item.done = b.done;
    if (b.singer != null) item.singer = clean(b.singer, 60);
    if (b.song != null) item.song = clean(b.song, 120);
    if (b.artist != null) item.artist = clean(b.artist, 80);
    await write(list);
    res.status(200).json(list);
    return;
  }

  if (req.method === 'DELETE') {
    const b = await body(req);
    if (b.all === true) { await write([]); res.status(200).json([]); return; }
    list = list.filter((x) => x.id !== b.id);
    await write(list);
    res.status(200).json(list);
    return;
  }

  res.status(405).json({ error: 'method not allowed' });
};
