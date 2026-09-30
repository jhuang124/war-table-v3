// Samples the chosen reference board (_claude/moodboard/chosen-silver-ink-board.png) for the v3 palette:
// the median colour of each wash over hand-picked territory patches (clear of the numerals and the
// coasts), and the paper. A tool, not in test:e2e. Usage: npx tsx tests/e2e/palette-sample.ts
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { GPU_ARGS } from './lib';

const IMG = process.env.IMG ?? '_claude/moodboard/chosen-silver-ink-board.png';
// [label, x, y, w, h] in the 1672×941 reference
const PATCHES: [string, number, number, number, number][] = process.env.PATCHES ? JSON.parse(process.env.PATCHES) : [
  ['vermilion', 60, 60, 40, 40], // Alaska, left of the 3
  ['vermilion', 250, 200, 40, 40], // central US
  ['vermilion', 670, 340, 40, 40], // North Africa
  ['vermilion', 830, 560, 30, 40], // South Africa
  ['vermilion', 1400, 70, 50, 40], // Kamchatka
  ['slate', 220, 75, 40, 30], // Canada
  ['slate', 380, 230, 30, 40], // Eastern US
  ['slate', 1230, 190, 40, 30], // Mongolia
  ['slate', 1400, 620, 50, 40], // Australia
  ['slate', 820, 390, 50, 30], // Egypt
  ['ochre', 140, 180, 40, 30], // Western US
  ['ochre', 1060, 200, 40, 30], // Kazakhstan
  ['ochre', 450, 470, 40, 40], // Brazil
  ['ochre', 860, 450, 40, 30], // East Africa
  ['sage', 1100, 60, 60, 30], // Siberia
  ['sage', 1340, 230, 40, 40], // China
  ['sage', 670, 420, 40, 30], // West Africa
  ['sage', 300, 560, 40, 40], // Argentina
  ['paper', 560, 450, 60, 60],
  ['paper', 1100, 480, 60, 60],
  ['paper', 60, 520, 60, 60],
];

const b64 = readFileSync(IMG).toString('base64');
const browser = await chromium.launch({ args: GPU_ARGS });
const page = await browser.newPage();
await page.addInitScript('window.__name = (f) => f');
await page.goto('about:blank');
const out = await page.evaluate(
  async ([src, patches]) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const by: Record<string, number[][]> = {};
    for (const [label, x, y, w, h] of patches as [string, number, number, number, number][]) {
      const d = g.getImageData(x, y, w, h).data;
      const arr = (by[label] ??= []);
      for (let i = 0; i < d.length; i += 4) arr.push([d[i], d[i + 1], d[i + 2]]);
    }
    const med = (v: number[]) => {
      const s = [...v].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)];
    };
    const res: Record<string, string> = {};
    for (const [k, px] of Object.entries(by)) {
      // median per channel of the pixels near the patch's median luminance (drops ink specks)
      const L = px.map((p) => 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]);
      const mL = med(L);
      const keep = px.filter((_, i) => Math.abs(L[i] - mL) < 22);
      const hex = [0, 1, 2].map((ch) => med(keep.map((p) => p[ch])).toString(16).padStart(2, '0')).join('');
      res[k] = '#' + hex;
    }
    return res;
  },
  [b64, PATCHES] as const,
);
console.log(JSON.stringify(out, null, 2));
await browser.close();
