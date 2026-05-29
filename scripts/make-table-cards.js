// Generates a print-ready PDF full of identical QR-code cards to cut out and
// place on tables. Each card links guests to the song-request page.
//
// Usage:  npm i pdfkit qrcode   (one-time, dev only)
//         node scripts/make-table-cards.js [url]
// Output: karaoke-table-cards.pdf  (US Letter, 3x4 = 12 cards per page)

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const URL = process.argv[2] || 'https://karaoke-night-cyan.vercel.app';
const OUT = path.join(__dirname, '..', 'karaoke-table-cards.pdf');

const PURPLE = '#7c2db8';
const DARK = '#1c1530';
const GRAY = '#6b6480';

const COLS = 3;
const ROWS = 4;
const MARGIN = 36; // 0.5"

async function main() {
  // Crisp QR as a PNG buffer; scaled down in the PDF for sharp printing.
  const qrBuf = await QRCode.toBuffer(URL, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 10,
    color: { dark: '#0f0a1e', light: '#ffffff' },
  });

  const doc = new PDFDocument({ size: 'letter', margin: 0 });
  const stream = fs.createWriteStream(OUT);
  doc.pipe(stream);

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const cellW = (pageW - MARGIN * 2) / COLS;
  const cellH = (pageH - MARGIN * 2) / ROWS;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = MARGIN + c * cellW;
      const y = MARGIN + r * cellH;
      drawCard(doc, x, y, cellW, cellH, qrBuf);
    }
  }

  doc.end();
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
  console.log('Wrote ' + OUT + '  (' + COLS * ROWS + ' cards, url: ' + URL + ')');
}

function drawCard(doc, x, y, w, h, qrBuf) {
  // Dashed cut border.
  doc.save();
  doc.lineWidth(0.5).dash(3, { space: 3 }).strokeColor('#bbbbbb');
  doc.rect(x + 2, y + 2, w - 4, h - 4).stroke();
  doc.undash();
  doc.restore();

  const pad = 10;
  let cy = y + pad + 2;

  doc.fillColor(PURPLE).font('Helvetica-Bold').fontSize(12)
    .text('KARAOKE NIGHT', x, cy, { width: w, align: 'center' });
  cy += 15;

  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9)
    .text('Scan to request a song', x, cy, { width: w, align: 'center' });
  cy += 14;

  const qrSize = Math.min(w, h) - 78;
  const qrX = x + (w - qrSize) / 2;
  doc.image(qrBuf, qrX, cy, { width: qrSize, height: qrSize });
  cy += qrSize + 6;

  doc.fillColor(GRAY).font('Helvetica').fontSize(7)
    .text(URL.replace(/^https?:\/\//, ''), x, cy, { width: w, align: 'center' });
}

main().catch((e) => { console.error(e); process.exit(1); });
