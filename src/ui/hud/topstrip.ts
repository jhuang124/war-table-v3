// Top of the board (docs/INK.md B5 "In-game HUD"): the seats as ink rings on the paper, in turn order,
// the territory count inside each ring and the name beside it; the game's ensō at the top right is the
// menu, with the words `Reset view` beside it only while the camera is off home.
//   (11) John   (9) Sam   (8) Ochre   ( ) Sage                                   Reset view   (ensō)
// The current seat's ring is inked at full strength and its name underlined in a hairline; the others
// stay quieter. Losing a territory dims your ring for 300 ms (A5). An eliminated seat's ring dries out
// over a breath (v3 "the exhale"), is empty and faintly cracked, and says who did it.
// v3 (_claude/v3/PLAN.md §2–3, John 2026-09-30 "fuller, not busier"): under each ring, one short brush tick
// per continent the seat holds, in that continent's printed tint (the colour its name is printed in on the
// board), and the seat's card count; the turned-wood cup sits on the paper beside the current seat's ring
// and slides to the next seat when the turn passes (cup.ts). The ring keeps one numeral, territories: the
// win condition counts them, and a second numeral per seat read as clutter; the army read is the board's
// stack heights (the seat's total is in its label for screen readers).
// v3 AI (quietly): an AI seat's personality in small caps under its name (desktop; phones keep it in the
// ring's title), and, when it holds a grudge of 2 or more, one short slanted brush tick under its ring in
// the grudged seat's colour ('Holds a grudge against Sam'). The 2-player neutral seat is a dimmed ring
// with its count and no name underline; the cup never goes to it. Choosing a truce partner lights the
// rings that can take one (the others step back); a tap on a lit ring offers the truce.

import type { SeatChipVM, UiIntent } from '../../game/viewModel';
import { PLAYER_COLORS, continentInk } from '../../shared/palette';
import { CONTINENT_IDS, CONTINENTS } from '../../engine/mapData';
import { brushMark } from '../../shared/enso';
import { Cup } from './cup';
import { drawIn, emblem, ensoEl, h, hashSeed, motion, pop, ringEl, setEmblem, setEnso, setStyle, setText, toggle } from '../dom';

class Chip {
  readonly el: HTMLDivElement;
  private pers: HTMLSpanElement;
  private ring: HTMLSpanElement;
  private mark: SVGSVGElement;
  private emb: SVGSVGElement;
  private name: HTMLSpanElement;
  private terr: HTMLSpanElement;
  private by: HTMLSpanElement;
  private marks: HTMLSpanElement;
  private marksKey = '';
  private vm: SeatChipVM | null = null;

  constructor(send: (i: UiIntent) => void) {
    this.el = h('div', 'seat-chip');
    // A lit ring (choosing a truce partner) is a button: a tap offers the truce.
    this.el.addEventListener('click', () => {
      const vm = this.vm;
      if (vm?.truceTarget) send({ type: 'proposeTruce', to: vm.seat.id });
    });
    this.el.addEventListener('keydown', (e) => {
      const vm = this.vm;
      if (!vm?.truceTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      e.stopPropagation();
      send({ type: 'proposeTruce', to: vm.seat.id });
    });
    this.ring = h('span', 'sc-ring');
    this.mark = ensoEl(1, 'sc-enso', { small: true });
    this.terr = h('span', 'sc-terr num');
    // The lit ring while a truce partner is chosen: a second, finer brush ring round the seat's (ivory).
    const halo = ringEl(hashSeed('sc-halo'), 1, undefined, { cls: 'sc-halo', weight: 0.8 });
    this.ring.append(this.mark, this.terr, h('i', 'sc-crack'), halo);
    this.marks = h('span', 'sc-marks');
    const col = h('span', 'sc-col');
    col.append(this.ring, this.marks);
    const text = h('span', 'sc-text');
    this.emb = emblem('crimson', 'emb sc-emb');
    this.name = h('span', 'sc-name');
    this.by = h('span', 'sc-by hidden');
    this.pers = h('span', 'sc-pers hidden');
    const nm = h('span', 'sc-nameline');
    nm.append(this.emb, this.name);
    text.append(nm, this.by, this.pers);
    this.el.append(col, text);
  }

  update(vm: SeatChipVM): void {
    if (this.vm === vm) return;
    const prev = this.vm;
    this.vm = vm;
    const pal = PLAYER_COLORS[vm.seat.color];
    setStyle(this.el, '--seat', pal.base);
    setStyle(this.el, '--seat-light', pal.light);
    setEnso(this.mark, hashSeed(`${vm.seat.id}:${vm.seat.color}`), { small: true });
    setEmblem(this.emb, vm.seat.color, 'light');
    setText(this.name, vm.seat.name);
    setText(this.terr, vm.eliminated ? '' : String(vm.territories));
    toggle(this.el, 'current', vm.current && !vm.neutral);
    toggle(this.el, 'out', vm.eliminated);
    toggle(this.el, 'neutral', !!vm.neutral);
    const pers = !vm.eliminated && vm.personality ? vm.personality : null;
    toggle(this.pers, 'hidden', !pers);
    setText(this.pers, pers?.name ?? '');
    // Phones hide the word: the ring's title carries it (hover / long-press).
    this.el.title = pers ? `${pers.name} · ${pers.line}` : '';
    this.el.dataset.personality = pers?.name.toLowerCase() ?? '';
    const lit = !!vm.truceTarget;
    toggle(this.el, 'truce-target', lit);
    if (lit) {
      this.el.setAttribute('role', 'button');
      this.el.tabIndex = 0;
      this.el.setAttribute('aria-label', `Offer ${vm.seat.name} a truce`);
    } else if (this.el.getAttribute('role')) {
      this.el.removeAttribute('role');
      this.el.removeAttribute('tabindex');
    }
    if (lit && !prev?.truceTarget) drawIn(this.ring, 240);
    const out = vm.eliminated ? vm.out : null;
    toggle(this.by, 'hidden', !out);
    if (out) setText(this.by, `taken by ${out.by.name}`);
    this.el.dataset.testid = `seat-${vm.seat.id}`;
    this.updateMarks(vm);
    const held = (vm.continents ?? []).map((c) => CONTINENTS[c].name);
    if (!lit) this.el.setAttribute(
      'aria-label',
      vm.eliminated
        ? `${vm.seat.name}, out${out ? `, taken by ${out.by.name}` : ''}`
        : `${vm.seat.name}${pers ? `, ${pers.name}` : ''}: ${vm.territories} territories${vm.armies !== undefined ? `, ${vm.armies} armies` : ''}${held.length ? `, holds ${held.join(' and ')}` : ''}${vm.cards ? `, ${vm.cards} ${vm.cards === 1 ? 'card' : 'cards'}` : ''}${vm.grudge ? `, holds a grudge against ${vm.grudge.name}` : ''}`,
    );
    if (!prev) return;
    // Turn start (INK B4 "seat ring inks"): the ring is brushed in fresh ivory ink and dries into its wash
    // (~900 ms, with the breath line). Ivory, not gold: one gold on screen at a time (INK A9), and the
    // track / commit already holds it.
    if (vm.current && !prev.current) {
      drawIn(this.ring, 300);
      if (!motion.reduced && typeof this.mark.animate === 'function')
        this.mark.animate([{ color: '#f2ede2' }, { color: '#f2ede2', offset: 0.3 }, { color: pal.base }], { duration: 900, easing: 'cubic-bezier(0.11, 0, 0.5, 0)' });
    }
    if (prev.territories !== vm.territories && !vm.eliminated) pop(this.terr);
    // A5: your colour is eaten — the ring dims for 300 ms each time a territory goes.
    if ((vm.lostKey ?? 0) !== (prev.lostKey ?? 0) && !motion.reduced && typeof this.ring.animate === 'function')
      this.ring.animate([{ opacity: 1 }, { opacity: 0.3, offset: 0.35 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
    // The exhale (PLAN §3): the knocked-out seat's ring dries out over a breath (~1.2 s) and stays dry.
    if (vm.eliminated && !prev.eliminated && typeof this.ring.animate === 'function')
      this.ring.animate([{ opacity: 1, filter: 'saturate(1)' }, { opacity: 0.4, filter: 'saturate(0.2)' }], { duration: motion.reduced ? 150 : 1200, easing: 'cubic-bezier(0.3, 0, 0.4, 1)' });
  }

  /** Under the ring: a tick per held continent (in its printed tint), then the card count; an AI's grudge tick first. */
  private updateMarks(vm: SeatChipVM): void {
    const conts = vm.eliminated ? [] : (vm.continents ?? []);
    const cards = vm.eliminated ? 0 : (vm.cards ?? 0);
    const grudge = vm.eliminated ? null : (vm.grudge ?? null);
    const key = `${conts.join(',')}|${cards}|${grudge ? `${grudge.id}:${grudge.color}:${grudge.name}` : ''}`;
    if (key === this.marksKey) return;
    this.marksKey = key;
    this.marks.textContent = '';
    if (grudge) {
      // one short brush tick, slanted (a continent's tick stands upright), in the grudged seat's colour
      const g = h('span', 'sc-tick sc-grudge');
      g.dataset.testid = `seat-grudge-${vm.seat.id}`;
      g.dataset.against = String(grudge.id);
      g.title = `Holds a grudge against ${grudge.name}`;
      g.style.color = PLAYER_COLORS[grudge.color].light;
      g.innerHTML = `<svg viewBox="0 0 6 12" aria-hidden="true"><path d="${brushMark([[4.6, 1.2], [1.5, 10.8]], { seed: 71 + grudge.id * 5, width: 2.8 })}" fill="currentColor"/></svg>`;
      this.marks.append(g);
    }
    for (const c of conts) {
      const i = CONTINENT_IDS.indexOf(c);
      const t = h('span', 'sc-tick');
      t.dataset.continent = c;
      t.title = `Holds ${CONTINENTS[c].name}`;
      t.style.color = continentInk(i, 0.4);
      t.innerHTML = `<svg viewBox="0 0 6 12" aria-hidden="true"><path d="${brushMark([[3.3, 0.9], [2.7, 11.1]], { seed: 31 + i * 7, width: 3 })}" fill="currentColor"/></svg>`;
      this.marks.append(t);
    }
    if (cards > 0) {
      const k = h('span', 'sc-cards num');
      k.dataset.testid = `seat-cards-${vm.seat.id}`;
      k.title = `${cards} ${cards === 1 ? 'card' : 'cards'}`;
      // a card in ink (square corners: no rounded rectangles anywhere): its face, a border, a hairline inside
      k.innerHTML = `<svg viewBox="0 0 8 11" aria-hidden="true"><path d="M0.7 0.7 L7.3 0.6 L7.4 10.4 L0.6 10.4 Z" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="0.9"/><path d="M2 2 L6 2 L6 9 L2 9 Z" fill="none" stroke="currentColor" stroke-width="0.45" opacity="0.6"/></svg>`;
      k.append(document.createTextNode(String(cards)));
      this.marks.append(k);
    }
    toggle(this.marks, 'empty', !this.marks.childElementCount);
  }

  /** Where the cup sits beside this seat's ring (in the seats row's box): its slot, left of the ring. */
  cupSpot(): { x: number; y: number } {
    const col = this.ring.parentElement as HTMLElement;
    return { x: this.el.offsetLeft + col.offsetLeft - 2, y: this.el.offsetTop + col.offsetTop + this.ring.offsetHeight - 2 };
  }
}

export class TopStrip {
  readonly el: HTMLElement;
  private seats: HTMLDivElement;
  private chips: Chip[] = [];
  private reset: HTMLButtonElement;
  private menuMark: SVGSVGElement;
  private vm: SeatChipVM[] | null = null;
  private moved = false;
  private cup = new Cup();
  private cupSeat = -1;

  constructor(private send: (i: UiIntent) => void) {
    this.el = h('header', 'topstrip');
    this.el.dataset.testid = 'topstrip';
    this.seats = h('div', 'ts-seats');
    this.seats.setAttribute('aria-label', 'Players');
    const right = h('div', 'ts-right');
    // `Reset view`: the words with a hairline under them (INK2 §3.2), a 44 px hit box; never a pill.
    this.reset = h('button', 'ts-reset nofocus hidden', 'Reset view');
    this.reset.type = 'button';
    this.reset.dataset.testid = 'reset-view';
    this.reset.addEventListener('click', () => send({ type: 'resetView' }));
    const menu = h('button', 'ts-menu nofocus');
    menu.type = 'button';
    menu.dataset.testid = 'menu';
    menu.setAttribute('aria-label', 'Menu');
    this.menuMark = ensoEl(1, 'ts-enso', { small: true });
    menu.append(this.menuMark);
    menu.addEventListener('click', () => send({ type: 'overlay', overlay: 'pause' }));
    right.append(this.reset, menu);
    this.el.append(this.seats, right);
    this.seats.append(this.cup.el);
    new ResizeObserver(() => this.placeCup(true)).observe(this.seats);
  }

  /** The game's ensō (seed = the game's seed) is the menu mark. */
  setSeed(seed: number): void {
    setEnso(this.menuMark, seed, { small: true });
  }

  update(vm: SeatChipVM[]): void {
    if (this.vm === vm) return;
    this.vm = vm;
    while (this.chips.length < vm.length) {
      const c = new Chip(this.send);
      this.chips.push(c);
      this.seats.append(c.el);
    }
    while (this.chips.length > vm.length) this.chips.pop()!.el.remove();
    vm.forEach((c, i) => this.chips[i].update(c));
    // Choosing a truce partner: the lit rings stand out, the rest step back.
    toggle(this.seats, 'picking', vm.some((c) => c.truceTarget));
    this.placeCup(false);
  }

  /** The cup goes to the current seat: a slide when the turn passes, a cut on layout. */
  private placeCup(cut: boolean): void {
    const vm = this.vm;
    if (!vm) return;
    const i = vm.findIndex((c) => c.current && !c.neutral);
    toggle(this.cup.el, 'hidden', i < 0);
    if (i < 0) return;
    const chip = this.chips[i];
    if (!chip || chip.el.offsetParent === null) return;
    const p = chip.cupSpot();
    const changed = i !== this.cupSeat;
    this.cupSeat = i;
    this.cup.moveTo(p.x, p.y, cut || !changed);
  }

  /** A roll starts: the cup tips and the dice pour toward the ink ring (client px). */
  pour(to: { x: number; y: number } | null): void {
    this.cup.pour(to, 3);
  }

  /** `Reset view` beside the ensō, only while the camera is off home. */
  setViewMoved(on: boolean): void {
    if (on === this.moved) return;
    this.moved = on;
    toggle(this.reset, 'hidden', !on);
    if (on) drawIn(this.reset, 200);
  }
}
