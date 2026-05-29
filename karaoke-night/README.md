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

## Note on storage
The queue is stored in the serverless function's /tmp. It's perfect for a
single event but is NOT permanent — it can reset if the app redeploys or goes
idle for a long time. To make it permanent, create a free Vercel KV / Upstash
Redis store and swap the read()/write() functions in api/queue.js to use it.
