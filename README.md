# Karaoke Night — shared song request app

A live, shared karaoke queue. Guests scan a QR code, add songs, and the host
manages everything from a control panel. The queue is shared across all phones.

## Pages
- `/`      → guest song request page (this is what the QR code points to)
- `/host`  → host console: add, edit, remove, reorder, mark sung, clear

## Deploy to Vercel (~2 min, free)

### Easiest: drag-and-drop
1. Go to https://vercel.com/new
2. Drag this whole folder into the import box (or connect a Git repo)
3. Click Deploy. No settings to change.
4. You'll get a URL like https://your-app.vercel.app

### Or via CLI
    npm i -g vercel
    vercel login
    vercel deploy --prod

## After deploying
- Guest URL:  https://YOUR-APP.vercel.app
- Host URL:   https://YOUR-APP.vercel.app/host
- Make a QR code for the guest URL at any free QR generator and print it.

## Storage (durable — Upstash Redis)
The queue is stored in an Upstash Redis store, so it's shared across all phones
and survives redeploys/idle. One-time setup:

1. In the Vercel dashboard for this project, go to **Storage → Create Database
   → Upstash (Redis)** (Marketplace) and connect it to the project. The free
   tier is plenty for an event.
2. Connecting it automatically adds the env vars the app reads:
   `KV_REST_API_URL` + `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` +
   `UPSTASH_REDIS_REST_TOKEN`).
3. Redeploy (or `vercel deploy --prod`) so the function picks up the vars.

For local dev, run `vercel env pull .env.local` to pull those vars, then
`vercel dev`. The queue lives under the Redis key `karaoke:queue`.
