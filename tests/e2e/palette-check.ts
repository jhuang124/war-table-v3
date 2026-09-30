// The colour-blind check behind src/shared/palette.ts's header: every pair of seat bases under Machado 2009
// full-severity protan / deutan / tritan (and normal vision), CIEDE2000, raw and as a 0.92 wash over the
// paper (tests/e2e/colorblind.ts). The bar is ΔE ≥ 9.8 for the worst pair. Pure Node.
// Usage: npx tsx tests/e2e/palette-check.ts   (exit 1 if the bar fails)
import { PLAYER_COLORS, PLAYER_COLOR_IDS, DEFAULT_SEAT_COLORS, type PlayerPalette } from '../../src/shared/palette';
import { worstPairs } from './colorblind';

const BAR = 9.8;
const four = DEFAULT_SEAT_COLORS.map((id) => PLAYER_COLORS[id]);
const six = PLAYER_COLOR_IDS.map((id) => PLAYER_COLORS[id]);
const lines: string[] = [];
let fail = false;
for (const [label, pals] of [
  ['default four', four],
  ['all six', six],
] as const) {
  const r = worstPairs(pals as PlayerPalette[]);
  const w = r[0];
  lines.push(`${label}: worst ΔE ${w.de.toFixed(2)} (${w.sim}${w.washed ? ', washed' : ''}, ${w.a}/${w.b}); next ${r[1].de.toFixed(2)} (${r[1].sim}, ${r[1].a}/${r[1].b})`);
  if (w.de < BAR) fail = true;
}
lines.push('');
lines.push('seat       base      worst ΔE vs any (all six, any vision, raw or washed)');
for (const p of six) {
  const r = worstPairs(six).filter((x) => x.a === p.name || x.b === p.name)[0];
  lines.push(`${p.name.padEnd(10)} ${p.base}   ${r.de.toFixed(2)} (${r.sim}${r.washed ? ', washed' : ''}, vs ${r.a === p.name ? r.b : r.a})`);
}
// v3: the 2-player neutral seat's grey against each of the six (it is never beside itself).
{
  const n = PLAYER_COLORS.neutral;
  const r = worstPairs([n, ...six]).filter((x) => x.a === n.name || x.b === n.name);
  lines.push('');
  lines.push(`${n.name.padEnd(10)} ${n.base}   ${r[0].de.toFixed(2)} (${r[0].sim}${r[0].washed ? ', washed' : ''}, vs ${r[0].a === n.name ? r[0].b : r[0].a}) — worst against the six`);
  if (r[0].de < BAR) fail = true;
}
console.log(lines.join('\n'));
console.log(fail ? `\nFAIL: worst pair under ${BAR}` : `\nPASS: every pair ≥ ${BAR}`);
process.exit(fail ? 1 : 0);
