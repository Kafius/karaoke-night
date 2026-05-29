const { Redis } = require('@upstash/redis');

// The Upstash Marketplace integration sets KV_REST_API_* (Vercel-style) and/or
// UPSTASH_REDIS_REST_* env vars. Support whichever pair is present.
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const QUEUE_KEY = 'karaoke:queue';
const DELETED_KEY = 'karaoke:deleted';
const DELETED_MAX = 100; // keep the most recent N deletions for recovery

async function readList(key) {
  try {
    const list = await redis.get(key);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

async function writeList(key, list) {
  await redis.set(key, list);
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

  if (!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL)) {
    res.status(500).json({ error: 'storage not configured' });
    return;
  }

  let queue = await readList(QUEUE_KEY);
  let deleted = await readList(DELETED_KEY);

  const send = (status) => res.status(status || 200).json({ queue, deleted });

  if (req.method === 'GET') { send(); return; }

  if (req.method === 'POST') {
    const b = await body(req);
    const singer = clean(b.singer, 60);
    const song = clean(b.song, 120);
    const artist = clean(b.artist, 80);
    if (!singer || !song) { res.status(400).json({ error: 'singer and song required' }); return; }
    queue.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      singer, song, artist, done: false
    });
    await writeList(QUEUE_KEY, queue);
    send();
    return;
  }

  if (req.method === 'PATCH') {
    const b = await body(req);

    if (b.action === 'reorder' && Array.isArray(b.order)) {
      const map = {};
      queue.forEach((x) => (map[x.id] = x));
      const next = b.order.map((id) => map[id]).filter(Boolean);
      queue.forEach((x) => { if (!b.order.includes(x.id)) next.push(x); });
      queue = next;
      await writeList(QUEUE_KEY, queue);
      send();
      return;
    }

    if (b.action === 'restore') {
      const idx = deleted.findIndex((x) => x.id === b.id);
      if (idx !== -1) {
        const item = deleted.splice(idx, 1)[0];
        delete item.deletedAt;
        queue.push(item);
        await writeList(QUEUE_KEY, queue);
        await writeList(DELETED_KEY, deleted);
      }
      send();
      return;
    }

    const item = queue.find((x) => x.id === b.id);
    if (!item) { send(404); return; }
    if (typeof b.done === 'boolean') item.done = b.done;
    if (b.singer != null) item.singer = clean(b.singer, 60);
    if (b.song != null) item.song = clean(b.song, 120);
    if (b.artist != null) item.artist = clean(b.artist, 80);
    await writeList(QUEUE_KEY, queue);
    send();
    return;
  }

  if (req.method === 'DELETE') {
    const b = await body(req);

    // Permanently empty the recently-deleted bin.
    if (b.action === 'purgeAll') {
      deleted = [];
      await writeList(DELETED_KEY, deleted);
      send();
      return;
    }

    // Permanently remove a single entry from the recently-deleted bin.
    if (b.action === 'purge' && b.id) {
      deleted = deleted.filter((x) => x.id !== b.id);
      await writeList(DELETED_KEY, deleted);
      send();
      return;
    }

    // Clear the whole queue — but keep everything recoverable in the bin.
    if (b.all === true) {
      const stamped = queue.map((x) => Object.assign({}, x, { deletedAt: Date.now() }));
      deleted = stamped.reverse().concat(deleted).slice(0, DELETED_MAX);
      queue = [];
      await writeList(QUEUE_KEY, queue);
      await writeList(DELETED_KEY, deleted);
      send();
      return;
    }

    // Soft-delete a single entry: move it from the queue into the bin.
    const idx = queue.findIndex((x) => x.id === b.id);
    if (idx !== -1) {
      const item = Object.assign({}, queue.splice(idx, 1)[0], { deletedAt: Date.now() });
      deleted.unshift(item);
      deleted = deleted.slice(0, DELETED_MAX);
      await writeList(QUEUE_KEY, queue);
      await writeList(DELETED_KEY, deleted);
    }
    send();
    return;
  }

  res.status(405).json({ error: 'method not allowed' });
};
