// The dice cup (_claude/v3/PLAN.md §2 "the cup = the turn"): a turned-wood cup, an OBJECT on the paper, not
// UI. It sits beside the current seat's ring in the seat strip with a contact shadow, at the ring's scale;
// when the turn passes it slides along the strip to the next seat (400 ms); when that seat rolls it tips
// and a few dice pour out toward the ink ring on the board (the board's own dice take over as they land),
// then it rights itself. On the hand-off cover it is drawn lacquered in the next seat's colour.
// Wood, never gold: the one gold stays the UI's (docs/INK.md B2.1).
import { PLAYER_COLORS } from '../../shared/palette';
import type { PlayerColorId } from '../../engine/types';
import { EASE_BRUSH, h, motion } from '../dom';

let gid = 0;
const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const rgb = (c: number[]) => `rgb(${c.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(',')})`;
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

/** Turned wood: dark grain at the edges, the lathe's light down the left, a darker right. */
const WOOD = { edge: [58, 38, 25], light: [150, 104, 68], mid: [112, 76, 48], dark: [70, 46, 30], lip: [160, 116, 80], inside: [24, 15, 10] };

/**
 * The cup as an inline SVG (viewBox 32 × 38: the cup, a little from above, and its contact shadow).
 * `tint`: lacquered in a seat's colour (the hand-off cover) over the wood.
 */
export function cupSvg(tint?: PlayerColorId | null, cls = 'cup-svg'): string {
  const id = `cup${gid++}`;
  let w = WOOD;
  if (tint) {
    const t = hex(PLAYER_COLORS[tint].base);
    const k = 0.72;
    w = {
      edge: mix(WOOD.edge, t.map((v) => v * 0.35), k),
      light: mix(WOOD.light, t.map((v) => Math.min(255, v * 1.15)), k),
      mid: mix(WOOD.mid, t, k),
      dark: mix(WOOD.dark, t.map((v) => v * 0.6), k),
      lip: mix(WOOD.lip, t.map((v) => Math.min(255, v * 1.25)), k),
      inside: WOOD.inside,
    };
  }
  return (
    `<svg class="${cls}" viewBox="0 1.5 32 36" aria-hidden="true">` +
    `<defs>` +
    `<linearGradient id="${id}b" x1="0" x2="1" y1="0" y2="0">` +
    `<stop offset="0" stop-color="${rgb(w.edge)}"/><stop offset="0.22" stop-color="${rgb(w.light)}"/>` +
    `<stop offset="0.55" stop-color="${rgb(w.mid)}"/><stop offset="1" stop-color="${rgb(w.edge)}"/></linearGradient>` +
    `<linearGradient id="${id}l" x1="0" x2="1" y1="0" y2="0">` +
    `<stop offset="0" stop-color="${rgb(w.dark)}"/><stop offset="0.3" stop-color="${rgb(w.lip)}"/><stop offset="1" stop-color="${rgb(w.dark)}"/></linearGradient>` +
    `<filter id="${id}s" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="1.3"/></filter>` +
    `</defs>` +
    // the contact shadow on the paper, falling a little to the lower right
    `<ellipse cx="17.4" cy="34.4" rx="11.6" ry="2.6" fill="rgba(3,5,12,0.62)" filter="url(#${id}s)"/>` +
    // the foot: a turned ring a little wider than the body
    `<path d="M5.6 30.4 L26.4 30.4 L26.6 32.2 Q16 35.2 5.4 32.2 Z" fill="url(#${id}b)"/>` +
    `<path d="M5.5 30.5 Q16 33.2 26.5 30.5" fill="none" stroke="${rgb(w.dark)}" stroke-width="0.8" opacity="0.8"/>` +
    // the body: a turned cup, tapering a touch toward the mouth (a dice cup, never a bucket)
    `<path d="M8.0 7.4 L6.4 30.6 Q16 33.4 25.6 30.6 L24.0 7.4 Z" fill="url(#${id}b)"/>` +
    // turned beads round the body (they follow the curve of the base)
    `<path d="M7.6 12.2 Q16 14.6 24.4 12.2" fill="none" stroke="${rgb(w.dark)}" stroke-width="0.9" opacity="0.75"/>` +
    `<path d="M7.55 13.2 Q16 15.6 24.45 13.2" fill="none" stroke="${rgb(w.light)}" stroke-width="0.55" opacity="0.5"/>` +
    `<path d="M6.8 25.4 Q16 28.0 25.2 25.4" fill="none" stroke="${rgb(w.dark)}" stroke-width="0.9" opacity="0.7"/>` +
    `<path d="M6.75 26.4 Q16 29.0 25.25 26.4" fill="none" stroke="${rgb(w.light)}" stroke-width="0.5" opacity="0.4"/>` +
    // a few grain streaks
    `<path d="M11.4 9 Q11.2 20 11.0 31" fill="none" stroke="${rgb(w.dark)}" stroke-width="0.35" opacity="0.4"/>` +
    `<path d="M19.6 9 Q19.9 21 20.4 31.5" fill="none" stroke="${rgb(w.dark)}" stroke-width="0.35" opacity="0.35"/>` +
    // the turned lip: a rolled rim overhanging the body, its underside in shadow, then the dark mouth
    `<ellipse cx="16" cy="7.9" rx="9.6" ry="3.0" fill="${rgb(w.dark)}"/>` +
    `<ellipse cx="16" cy="7.0" rx="9.9" ry="3.0" fill="url(#${id}l)"/>` +
    `<ellipse cx="16" cy="7.2" rx="7.6" ry="2.0" fill="${rgb(w.inside)}"/>` +
    `<path d="M8.9 6.6 Q16 4.6 23.1 6.6" fill="none" stroke="${rgb(w.dark)}" stroke-width="0.4" opacity="0.6"/>` +
    `</svg>`
  );
}

/** A small bone die for the pour (DOM, a few px): ivory with two pips. */
function pourDie(): HTMLElement {
  const d = h('i', 'cup-die');
  d.innerHTML = `<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.2 1.6 L8.6 1.1 L8.9 8.5 L1.4 8.9 Z" fill="#e8e1d2"/><circle cx="3.4" cy="3.6" r="1" fill="#2a241c"/><circle cx="6.6" cy="6.4" r="1" fill="#2a241c"/></svg>`;
  return d;
}

/**
 * The cup in the seat strip: moves to a seat's slot, tips and pours toward a point on screen (the ink ring),
 * rights itself. Positioned in its container's coordinates.
 */
export class Cup {
  readonly el: HTMLDivElement;
  private body: HTMLDivElement;
  private x = -1;
  private y = -1;
  private tipped = false;

  constructor() {
    this.el = h('div', 'ts-cup');
    this.el.dataset.testid = 'cup';
    this.el.setAttribute('aria-hidden', 'true');
    this.body = h('div', 'cup-body');
    this.body.innerHTML = cupSvg(null);
    this.el.append(this.body);
  }

  /** Sit at (x, y) in the container (the cup's base centre). A slide (400 ms) unless `cut`. */
  moveTo(x: number, y: number, cut: boolean): void {
    if (Math.abs(x - this.x) < 0.5 && Math.abs(y - this.y) < 0.5) return;
    const first = this.x < 0;
    const from = [this.x, this.y];
    this.x = x;
    this.y = y;
    this.el.style.transform = `translate(${x}px, ${y}px)`;
    this.el.dataset.x = String(Math.round(x));
    if (first || cut || motion.reduced || typeof this.el.animate !== 'function') return;
    // the cup is picked up a hair, slides along the strip, and is set down (its shadow tightens as it lands)
    this.el.animate(
      [
        { transform: `translate(${from[0]}px, ${from[1]}px)` },
        { transform: `translate(${(from[0] + x) / 2}px, ${Math.min(from[1], y) - 3}px)`, offset: 0.5 },
        { transform: `translate(${x}px, ${y}px)` },
      ],
      { duration: 400, easing: EASE_BRUSH },
    );
  }

  /** The roll: the cup tips toward the ring and a few dice pour out toward `to` (client px); then it rights. */
  pour(to: { x: number; y: number } | null, dice: number): void {
    if (this.tipped || motion.reduced || typeof this.body.animate !== 'function') return;
    this.tipped = true;
    const tip = this.body.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-58deg)', offset: 0.35 }, { transform: 'rotate(-58deg)', offset: 0.6 }, { transform: 'rotate(0deg)' }],
      { duration: 620, easing: 'cubic-bezier(0.3, 0, 0.3, 1)' },
    );
    tip.onfinish = () => (this.tipped = false);
    if (!to) return;
    const r = this.el.getBoundingClientRect();
    const sx = r.left + r.width * 0.3;
    const sy = r.top + r.height * 0.3;
    for (let i = 0; i < Math.min(5, Math.max(1, dice)); i++) {
      const d = pourDie();
      d.style.left = `${sx}px`;
      d.style.top = `${sy}px`;
      document.body.append(d);
      const dx = to.x - sx + (i - 1.5) * 18;
      const dy = to.y - sy;
      const a = d.animate(
        [
          { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 0 },
          { transform: `translate(${dx * 0.18}px, ${dy * 0.02 - 18}px) rotate(${90 + i * 40}deg) scale(1.15)`, opacity: 1, offset: 0.2 },
          { transform: `translate(${dx}px, ${dy}px) rotate(${320 + i * 70}deg) scale(1.9)`, opacity: 0 },
        ],
        { duration: 300, delay: 90 + i * 22, easing: 'cubic-bezier(0.4, 0, 0.9, 0.6)', fill: 'both' },
      );
      a.onfinish = () => d.remove();
    }
  }
}
