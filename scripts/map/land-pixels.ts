// Counts land pixels in board screenshots (the owner-coloured washes; ocean, mist, ink and the HUD's
// dark bands don't count) and writes a mask beside each for a sanity look.
//   npx tsx scripts/map/land-pixels.ts artifacts/maps/classic-rest.png artifacts/maps/true-world-rest.png

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const files = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
const page = await browser.newPage();
const rows: string[] = [];
for (const f of files) {
  const b64 = readFileSync(resolve(f)).toString('base64');
  const r = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    let land = 0;
    for (let i = 0; i < d.data.length; i += 4) {
      const R = d.data[i], G = d.data[i + 1], B = d.data[i + 2];
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      // Owner washes are saturated and mid-bright; the indigo ocean and its mist are dark.
      const isLand = mx - mn >= 40 && mx >= 95;
      if (isLand) land++;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = isLand ? 255 : 0;
      d.data[i + 3] = 255;
    }
    ctx.putImageData(d, 0, 0);
    return { w: c.width, h: c.height, land, mask: c.toDataURL('image/png').split(',')[1] };
  }, `data:image/png;base64,${b64}`);
  writeFileSync(resolve(f.replace(/\.png$/, '-mask.png')), Buffer.from(r.mask, 'base64'));
  rows.push(`${f}: ${r.w}×${r.h}, land ${r.land} px (${((100 * r.land) / (r.w * r.h)).toFixed(1)}% of the frame)`);
}
await browser.close();
for (const r of rows) console.log(r);
