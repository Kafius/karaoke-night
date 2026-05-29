const fs = require('fs');
const path = require('path');

const FILE = path.join('/tmp', 'karaoke-queue.json');

function read() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function write(list) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(list));
  } catch (e) {}
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

  let list = read();

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
    write(list);
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
      write(next);
      res.status(200).json(next);
      return;
    }

    const item = list.find((x) => x.id === b.id);
    if (!item) { res.status(404).json({ error: 'not found' }); return; }
    if (typeof b.done === 'boolean') item.done = b.done;
    if (b.singer != null) item.singer = clean(b.singer, 60);
    if (b.song != null) item.song = clean(b.song, 120);
    if (b.artist != null) item.artist = clean(b.artist, 80);
    write(list);
    res.status(200).json(list);
    return;
  }

  if (req.method === 'DELETE') {
    const b = await body(req);
    if (b.all === true) { write([]); res.status(200).json([]); return; }
    list = list.filter((x) => x.id !== b.id);
    write(list);
    res.status(200).json(list);
    return;
  }

  res.status(405).json({ error: 'method not allowed' });
};
