// The colour-blind check behind src/shared/palette.ts's header (docs/INK.md A7): every pair of seat bases,
// under Machado 2009 full-severity protan / deutan / tritan simulation (and normal vision), CIEDE2000, on
// the raw hexes and as a 0.92 wash over the #101a30 paper. The bar is ΔE ≥ 9.8 for the worst pair.
// Pure Node, no browser. The CLI is tests/e2e/palette-check.ts.
import type { PlayerPalette } from '../../src/shared/palette';

type V3 = [number, number, number];
const hex = (h: string): V3 => {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const mul = (m: number[][], v: V3): V3 => [0, 1, 2].map((i) => m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2]) as V3;

// Machado, Oliveira & Fernandes 2009, severity 1.0 (applied in linear RGB).
const SIM: Record<string, number[][] | null> = {
  normal: null,
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

function lab(rgbLin: V3): V3 {
  const [r, g, b] = rgbLin.map((c) => Math.max(0, Math.min(1, c)));
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 (Sharma, Wu & Dalal 2005). */
export function de2000(a: V3, b: V3): number {
  const [L1, a1, b1] = a;
  const [L2, a2, b2] = b;
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h = (x: number, y: number) => {
    if (x === 0 && y === 0) return 0;
    const t = Math.atan2(y, x) / rad;
    return t < 0 ? t + 360 : t;
  };
  const h1p = h(a1p, b1);
  const h2p = h(a2p, b2);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lmp = (L1 + L2) / 2;
  const Cmp = (C1p + C2p) / 2;
  let hmp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hmp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
    else hmp = (h1p + h2p) / 2;
  }
  const T = 1 - 0.17 * Math.cos((hmp - 30) * rad) + 0.24 * Math.cos(2 * hmp * rad) + 0.32 * Math.cos((3 * hmp + 6) * rad) - 0.2 * Math.cos((4 * hmp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hmp - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lmp - 50) ** 2) / Math.sqrt(20 + (Lmp - 50) ** 2);
  const SC = 1 + 0.045 * Cmp;
  const SH = 1 + 0.015 * Cmp * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}

const PAPER = hex('#101a30');
/** The colour as seen: raw, or a 0.92 wash over the paper (mixed in display space, as the shaders do). */
function seen(h: string, washed: boolean, sim: string): V3 {
  let c = hex(h);
  if (washed) c = c.map((v, i) => PAPER[i] + (v - PAPER[i]) * 0.92) as V3;
  let l = c.map(lin) as V3;
  const m = SIM[sim];
  if (m) l = mul(m, l);
  return lab(l);
}

export interface PairResult {
  a: string;
  b: string;
  sim: string;
  washed: boolean;
  de: number;
}

export function worstPairs(pals: Pick<PlayerPalette, 'name' | 'base'>[]): PairResult[] {
  const out: PairResult[] = [];
  for (let i = 0; i < pals.length; i++)
    for (let j = i + 1; j < pals.length; j++)
      for (const sim of Object.keys(SIM))
        for (const washed of [false, true]) out.push({ a: pals[i].name, b: pals[j].name, sim, washed, de: de2000(seen(pals[i].base, washed, sim), seen(pals[j].base, washed, sim)) });
  return out.sort((x, y) => x.de - y.de);
}

