// SVG preview of a board (continent colours with per-territory tints, badge circles, names, lanes,
// labels) + Playwright screenshots into artifacts/map/<id>/, and the pack's small thumbnail.

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BoardGeometry, PolygonGeom } from '../../src/map/types';
import type { LoadedPack } from './pack';
import type { PreviewShot } from './recipe';

type Hsl = [number, number, number];
const CONT_COLORS: Record<string, Hsl> = {
  north_america: [38, 62, 58],
  south_america: [8, 55, 52],
  europe: [215, 45, 55],
  africa: [28, 55, 45],
  asia: [110, 32, 45],
  australia: [285, 30, 55],
};
const FALLBACK: Hsl[] = [[38, 62, 58], [8, 55, 52], [215, 45, 55], [28, 55, 45], [110, 32, 45], [285, 30, 55], [175, 40, 45], [330, 40, 55]];
const contColor = (pack: LoadedPack, c: string): Hsl =>
  CONT_COLORS[c] ?? FALLBACK[Math.max(0, pack.rules.continents.findIndex((x) => x.id === c)) % FALLBACK.length];

function hsl([h, s, l]: Hsl) {
  return `hsl(${h} ${s}% ${l}%)`;
}

function pathOf(pg: PolygonGeom, H: number): string {
  const ring = (r: [number, number][]) =>
    'M' + r.map(([x, y]) => `${x.toFixed(3)},${(H - y).toFixed(3)}`).join('L') + 'Z';
  return ring(pg.outer) + pg.holes.map(ring).join('');
}

type TKey = keyof BoardGeometry['territories'];
type CKey = keyof BoardGeometry['continents'];

export function boardSvg(
  b: BoardGeometry,
  pack: LoadedPack,
  opts: { viewBox?: [number, number, number, number]; pxWidth: number; minClear: number; bare?: boolean },
) {
  const H = b.height;
  const vb = opts.viewBox ?? [0, 0, b.width, b.height];
  const pxH = Math.round((opts.pxWidth * vb[3]) / vb[2]);
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.pxWidth}" height="${pxH}" viewBox="${vb.join(' ')}" ` +
      `font-family="Georgia, 'Times New Roman', serif">`,
  );
  parts.push(`<rect x="-5" y="-5" width="${b.width + 10}" height="${b.height + 10}" fill="#0d2a33"/>`);
  parts.push(`<rect x="0" y="0" width="${b.width}" height="${b.height}" fill="#123a45" stroke="#b08d4a" stroke-width="0.12"/>`);
  if (!opts.bare) {
    // graticule every 10 units
    for (let x = 10; x < b.width; x += 10) parts.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#1d4d5a" stroke-width="0.04"/>`);
    for (let y = 10; y < H; y += 10) parts.push(`<line x1="0" y1="${H - y}" x2="${b.width}" y2="${H - y}" stroke="#1d4d5a" stroke-width="0.04"/>`);
  }
  for (const pg of b.decorativeLand) parts.push(`<path d="${pathOf(pg, H)}" fill="#6f6a58" stroke="#4d493c" stroke-width="0.05" fill-rule="evenodd"/>`);
  // territories
  const ids = pack.territoryIds as TKey[];
  const contIndex = new Map<string, number>();
  for (const t of ids) {
    const c = pack.continentOf[t];
    const k = contIndex.get(c) ?? 0;
    contIndex.set(c, k + 1);
    const [h, s, l] = contColor(pack, c);
    const tint: Hsl = [h + ((k * 7) % 5) * 3 - 6, s, l + ((k % 4) - 1.5) * 5];
    const tg = b.territories[t];
    for (const pg of tg.polygons)
      parts.push(`<path d="${pathOf(pg, H)}" fill="${hsl(tint)}" stroke="#1b1b1b" stroke-width="0.07" stroke-linejoin="round" fill-rule="evenodd"/>`);
  }
  // lanes, with a tick at each shore point
  for (const lane of b.seaLanes) {
    for (const seg of lane.segments)
      parts.push(
        `<polyline points="${seg.map(([x, y]) => `${x},${H - y}`).join(' ')}" fill="none" stroke="#f3e7c6" stroke-width="0.12" stroke-dasharray="0.35 0.25" stroke-linecap="round" opacity="0.9"/>`,
      );
    if (!opts.bare) {
      const last = lane.segments[lane.segments.length - 1];
      for (const [x, y] of lane.shore ?? [lane.segments[0][0], last[last.length - 1]])
        parts.push(`<circle cx="${x}" cy="${H - y}" r="0.14" fill="#f3e7c6"/>`);
    }
  }
  if (opts.bare) {
    parts.push('</svg>');
    return parts.join('\n');
  }
  // anchors (badge circle at the required clearance)
  for (const t of ids) {
    const tg = b.territories[t];
    const [x, y] = tg.anchor;
    parts.push(`<circle cx="${x}" cy="${H - y}" r="${opts.minClear}" fill="none" stroke="#fff8" stroke-width="0.06" stroke-dasharray="0.2 0.12"/>`);
    parts.push(`<circle cx="${x}" cy="${H - y}" r="0.62" fill="#12151a" stroke="#f0e6cc" stroke-width="0.12"/>`);
    parts.push(`<text x="${x}" y="${H - y + 0.24}" font-size="0.66" font-family="Helvetica, Arial" font-weight="700" fill="#f4ecd8" text-anchor="middle">3</text>`);
    const [lx, ly] = tg.labelAnchor;
    parts.push(
      `<text x="${lx}" y="${H - ly + 0.2}" font-size="0.55" fill="#161310" text-anchor="middle" font-weight="600" letter-spacing="0.02">${pack.names[t].toUpperCase()}</text>`,
    );
  }
  // continent + ocean labels
  for (const c of Object.keys(b.continents) as CKey[]) {
    const cg = b.continents[c];
    const cr = pack.rules.continents.find((x) => x.id === c)!;
    const [x, y] = cg.labelAnchor;
    if (cg.labelRoom) parts.push(`<rect x="${x - cg.labelRoom / 2}" y="${H - y - 0.65}" width="${cg.labelRoom}" height="1.3" fill="#ffffff08" stroke="#ffffff22" stroke-width="0.04"/>`);
    parts.push(
      `<text x="${x}" y="${H - y + 0.4}" font-size="1.1" fill="${hsl(contColor(pack, c))}" text-anchor="middle" letter-spacing="0.12" font-weight="700"${cg.labelRoom ? ` textLength="${Math.min(cg.labelRoom, 0.78 * (cr.name.length + 5))}" lengthAdjust="spacingAndGlyphs"` : ''}>${cr.name.toUpperCase()} · +${cr.bonus}</text>`,
    );
  }
  for (const o of b.oceanLabels)
    parts.push(
      `<text x="${o.at[0]}" y="${H - o.at[1] + o.size * 0.35}" font-size="${o.size}" fill="#7fa6ad" font-style="italic" text-anchor="middle" letter-spacing="0.2">${o.text}</text>`,
    );
  parts.push('</svg>');
  return parts.join('\n');
}

export interface PreviewOpts {
  outDir: string;
  minClear: number;
  shots: PreviewShot[];
  /** lon/lat → board (for lonLat shots); absent = lonLat shots are skipped. */
  project?: (lon: number, lat: number) => [number, number];
  /** Also write a small bare thumbnail here. */
  thumbPath?: string;
}

export async function renderPreviews(b: BoardGeometry, pack: LoadedPack, o: PreviewOpts): Promise<string[]> {
  mkdirSync(o.outDir, { recursive: true });
  const shots: { viewBox?: [number, number, number, number]; px: number; bare?: boolean; path: string }[] = [
    { px: 2400, path: resolve(o.outDir, 'preview.png') },
  ];
  for (const s of o.shots) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x: number, y: number) => {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    };
    for (const id of s.territories ?? []) {
      const bb = b.territories[id as TKey].bbox;
      add(bb[0], bb[1]);
      add(bb[2], bb[3]);
    }
    if (s.lonLat && o.project) {
      const [w, so, e, n] = s.lonLat;
      for (let k = 0; k <= 8; k++) {
        add(...o.project(w + ((e - w) * k) / 8, so));
        add(...o.project(w + ((e - w) * k) / 8, n));
        add(...o.project(w, so + ((n - so) * k) / 8));
        add(...o.project(e, so + ((n - so) * k) / 8));
      }
    }
    if (!Number.isFinite(x0)) continue;
    x0 -= s.pad;
    x1 += s.pad;
    y0 -= s.pad;
    y1 += s.pad;
    // SVG viewBox is y-down
    shots.push({ viewBox: [x0, b.height - y1, x1 - x0, y1 - y0], px: s.px, path: resolve(o.outDir, `preview-${s.name}.png`) });
  }
  if (o.thumbPath) shots.push({ px: 480, bare: true, path: o.thumbPath });
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    for (const s of shots) {
      const svg = boardSvg(b, pack, { viewBox: s.viewBox, pxWidth: s.px, minClear: o.minClear, bare: s.bare });
      if (!s.bare) writeFileSync(s.path.replace(/\.png$/, '.svg'), svg);
      const m = /height="(\d+)"/.exec(svg)!;
      await page.setViewportSize({ width: s.px, height: Number(m[1]) });
      await page.setContent(`<html><body style="margin:0;background:#0d2a33">${svg}</body></html>`);
      await page.screenshot({ path: s.path });
    }
  } finally {
    await browser.close();
  }
  return shots.map((s) => s.path);
}
