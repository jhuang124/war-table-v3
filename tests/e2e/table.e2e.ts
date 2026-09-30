// The table cues (_claude/v3/PLAN.md §2–3, §5), logic lane: the turn banner arrives with the turn, the
// ledger writes one plain sentence per event over a scripted turn, a captured continent's outline takes
// its holder's colour, every stone is sized by its count, the numeral centred on it
// reads the count, and the cup sits beside the current seat's ring.
import { ONE_HUMAN, check, clickBtn, clickT, finish, idle, loadScenario, open, scenario, seg, state, ui } from './lib';
import { openDevice } from './mobile-lib';
import type { Page } from 'playwright';
import { PLAYER_COLORS } from '../../src/shared/palette';
import { TERRITORY_IDS } from '../../src/engine';

const results: string[] = [];
const { browser, page, errors } = await open();

type Dbg = {
  tokens: { stoneOf: (id: string) => { n: number; dPx: number; capPx: number; alpha: number }; dminPx: number; dmaxPx: number; sizeScale: number };
  continents: { state: () => Record<string, { holder: number; amount: number; color: [number, number, number] }> };
};
const dbg = `(window.__board).__debug`;
const stoneOf = (id: string) => page.evaluate(([d, t]) => (eval(d) as Dbg).tokens.stoneOf(t), [dbg, id] as const);
const sizes = () => page.evaluate((d) => { const k = (eval(d) as Dbg).tokens; return { dmin: k.dminPx * k.sizeScale, dmax: k.dmaxPx * k.sizeScale }; }, dbg);

// --- 1. stones: size = army count (area-linear, capped), the numeral centred on it ---------------------
{
  await loadScenario(page, scenario({ ural: [0, 19], ukraine: [0, 6], siberia: [1, 12], china: [2, 5], india: [0, 25], peru: [0, 1] }, { kind: 'attack' }));
  const s = (await state(page))!;
  // ten territories, drawn by a fixed shuffle (deterministic), always including the denomination edges
  const pick = ['ural', 'ukraine', 'siberia', 'china', 'india', 'peru', ...TERRITORY_IDS.filter((_, i) => (i * 7) % 11 === 3)].slice(0, 10);
  const bad: string[] = [];
  for (const t of pick) {
    const n = (s.territories as Record<string, { armies: number }>)[t].armies;
    const st = await stoneOf(t);
    const { dmin, dmax } = await sizes();
    // area-linear: d = dmin + (dmax − dmin) · √(min(n, 30) / 30), then this territory's cap
    const want = Math.min(dmin + (dmax - dmin) * Math.sqrt(Math.min(n, 30) / 30), Math.max(dmin, st.capPx));
    if (st.n !== n || Math.abs(st.dPx - want) > 0.05) bad.push(`${t}: ${n} armies, stone ${st.dPx.toFixed(1)} px (want ${want.toFixed(1)})`);
    const txt = await page.evaluate((id) => document.querySelector(`.rb-badge[data-t="${id}"] .n`)?.textContent ?? '', t);
    if (txt !== String(n)) bad.push(`${t}: numeral "${txt}" for ${n}`);
  }
  check(bad.length === 0, `10 stones sized by their counts (area-linear, capped), numerals match (${bad.join('; ') || pick.join(', ')})`, results);
  // larger means more, to the cap; the numeral carries the rest
  const h = await Promise.all(['peru', 'china', 'ukraine', 'ural'].map(stoneOf));
  check(h[0].dPx < h[1].dPx && h[1].dPx < h[2].dPx && h[2].dPx <= h[3].dPx, `larger means more: 1 → 5 → 6 → 19 armies are ${h.map((x) => x.dPx.toFixed(1)).join(' · ')} px across`, results);
  // the cup: beside the current seat's ring
  const cup = await page.evaluate(() => {
    const c = document.querySelector<HTMLElement>('[data-testid="cup"]');
    const ring = document.querySelector<HTMLElement>('.seat-chip.current .sc-ring');
    if (!c || !ring) return null;
    const cb = c.querySelector('.cup-body')!.getBoundingClientRect();
    const rb = ring.getBoundingClientRect();
    return { dx: rb.left - cb.right, dy: Math.abs(cb.bottom - rb.bottom), h: cb.height, rh: rb.height };
  });
  check(!!cup && cup.dx >= -4 && cup.dx <= 12 && cup.dy <= 10 && cup.h >= cup.rh * 0.5, `the cup sits beside the current seat's ring (${JSON.stringify(cup)})`, results);
}

// --- 2. a scripted turn: one ledger line per event; the continent outline takes its holder's colour ----
{
  // John holds Australia but for Eastern Australia (1 army), with 10 on New Guinea; Ural 19 faces Siberia 1.
  await loadScenario(
    page,
    scenario(
      { new_guinea: [0, 10], indonesia: [0, 2], western_australia: [0, 2], eastern_australia: [1, 1], ural: [0, 19], siberia: [1, 1], ukraine: [0, 4] },
      { kind: 'attack' },
      { players: ONE_HUMAN as never },
    ),
  );
  const log0 = (await page.evaluate(() => window.__risk.ui())) as unknown as { line: string };
  void log0;
  const lines0 = await page.evaluate(() => document.querySelectorAll('[data-testid="event-line"]').length);
  void lines0;
  const logLen = () => page.evaluate(() => window.__risk.ledger().length);
  const n0 = await logLen();
  // attack 1: Eastern Australia (a continent falls)
  await clickT(page, 'new_guinea');
  await clickT(page, 'eastern_australia');
  await clickBtn(page, 'btn-blitz');
  await idle(page);
  if ((await state(page))!.phase.kind === 'occupy') {
    await clickBtn(page, 'btn-move');
    await idle(page);
  }
  const held = await page.evaluate((d) => (eval(d) as Dbg).continents.state().australia, dbg);
  const pal = PLAYER_COLORS.crimson;
  const hx = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
  const want = hx(pal.base).map((v, i) => v + (hx(pal.light)[i] - v) * 0.45);
  const err = Math.max(...want.map((v, i) => Math.abs(v - held.color[i])));
  check(held.holder === 0 && held.amount > 0.99 && err < 0.01, `Australia's outline is inked in John's colour once he holds it (holder ${held.holder}, amount ${held.amount}, colour off by ${err.toFixed(3)})`, results);
  // attack 2: Siberia
  await clickT(page, 'ural');
  await clickT(page, 'siberia');
  await clickBtn(page, 'btn-blitz');
  await idle(page);
  if ((await state(page))!.phase.kind === 'occupy') {
    await clickBtn(page, 'btn-move');
    await idle(page);
  }
  // the banner watch goes up before the fortify that ends John's turn (Move N · end turn)
  await page.evaluate(() => {
    const w = window as unknown as { __tb: { t0: number; t1: number; text: string } };
    const turn0 = window.__risk.getState()!.turn;
    w.__tb = { t0: 0, t1: 0, text: '' };
    const tick = () => {
      const s = window.__risk.getState();
      const now = performance.now();
      if (!w.__tb.t0 && s && s.turn > turn0 && s.currentPlayer === 0) w.__tb.t0 = now;
      const a = document.querySelector('.announce')?.textContent ?? '';
      if (w.__tb.t0 && !w.__tb.t1 && /John's turn · round \d+/.test(a)) {
        w.__tb.t1 = now;
        w.__tb.text = a;
      }
      if (!w.__tb.t1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  // fortify: Ukraine → Ural, which ends the turn
  await seg(page, 'fortify');
  await idle(page);
  await clickT(page, 'ukraine');
  await clickT(page, 'ural');
  await page.waitForTimeout(100);
  if (await page.locator('[data-testid="btn-move"]').count()) await clickBtn(page, 'btn-move');
  await page.waitForFunction(() => (window as unknown as { __tb: { t1: number } }).__tb.t1 > 0, null, { timeout: 30000 }).catch(() => undefined);
  await idle(page, 30000);
  const log = await page.evaluate(() => window.__risk.ledger());
  const all = log.slice(Math.max(0, n0));
  // John's turn: every line up to the next seat's turn line
  const cut = all.findIndex((l) => l.kind === 'turn');
  const added = cut >= 0 ? all.slice(0, cut) : all;
  // his events: two engagements (both conquests), one continent gained, one fortify, the card he drew
  const kinds = added.map((l) => l.kind);
  const eng = added.filter((l) => l.kind === 'engagement');
  const cont = added.filter((l) => l.kind === 'continent');
  const fort = added.filter((l) => /moved \d+ from Ukraine to Ural/.test(l.text));
  const card = added.filter((l) => l.kind === 'card');
  check(eng.some((l) => /^John took Siberia from Ural · 19 vs 1 · lost \d+$/.test(l.text)), `the conquest reads "John took Siberia from Ural · 19 vs 1 · lost N" ("${eng[1]?.text}")`, results);
  check(n0 >= 0 && added.length === 5 && eng.length === 2 && cont.length === 1 && fort.length === 1 && card.length === 1, `the ledger wrote one line per event over John's turn: ${added.length} (${kinds.join(', ')}) — ${added.map((l) => `"${l.text}"`).join(' | ')}`, results);
  check(all.every((l) => l.text.length <= 110 && !/[!:→]/.test(l.text)), `every ledger line is one plain sentence in the house voice (≤ 110 characters, middle dots, no colon, arrow or exclamation mark)${all.filter((l) => /[!:→]/.test(l.text) || l.text.length > 110).map((l) => ` — "${l.text}"`).join('')}`, results);
  check(all.filter((l) => l.kind === 'turn').every((l) => /^.+'s turn · \d+ to place$/.test(l.text)), 'each turn opens with its own line ("Cobalt\'s turn · 4 to place")', results);
  // --- 3. the turn banner: within 300 ms of the turn starting ----------------------------------------
  const tb = await page.evaluate(() => (window as unknown as { __tb: { t0: number; t1: number; text: string } }).__tb);
  check(tb.t1 > 0 && tb.t1 - tb.t0 <= 300, `the turn banner "${tb.text.trim()}" arrives ${Math.round(tb.t1 - tb.t0)} ms after John's turn starts (≤ 300)`, results);
  check(/John's turn · round \d+ · \d+ to place/.test(tb.text), 'the banner reads "John\'s turn · round N · N to place"', results);
  const r = await page.evaluate(() => document.querySelector('[data-testid="round"]')?.textContent ?? '');
  check(/^Round \d+$/.test(r), `the dock says the round ("${r}")`, results);
  const br = /round (\d+)/.exec(tb.text)?.[1];
  check(!!br && r === `Round ${br}`, `the banner and the dock agree on the round (${br} / "${r}")`, results);
  // the dock's event line shows the latest; a tap opens the ledger by round
  const last = log[log.length - 1];
  const ev = await page.evaluate(() => document.querySelector('[data-testid="event-line"]')?.textContent ?? '');
  check(!!last && ev === last.text.replace(/-/g, '−'), `the event line reads the latest sentence ("${ev}")`, results);
  await page.waitForTimeout(1600); // the turn banner dries
  await clickBtn(page, 'events');
  await page.waitForTimeout(300);
  const ledger = await page.evaluate(() => ({
    rounds: [...document.querySelectorAll('[data-testid="log"] .lg-round')].map((r) => (r as HTMLElement).dataset.round),
    open: document.querySelectorAll('[data-testid="log"] .lg-round:not(.closed) .log-line').length,
    shown: !!document.querySelector('[data-testid="log"]')?.getBoundingClientRect().height,
  }));
  check(ledger.shown && ledger.rounds.length >= 2 && ledger.rounds[0] === br && ledger.open >= 1, `the ledger opens from the event line, by round, newest open (${JSON.stringify(ledger)})`, results);
  await page.keyboard.press('Escape');
  void ui;
}

await browser.close();

// --- 4. a stack never covers another territory's numeral, at home, on all three form factors ---------------
{
  /** Every (stack body, other numeral) overlap over 2 px², at the home view. */
  const overlaps = (p: Page) =>
    p.evaluate(() => {
      const d = (window as unknown as { __board: { __debug: { overlay: { pieceRects: (id: string) => { box: number[] } | null }; tiles: { list: { id: string }[] }; capsFloored: number; capsLowered: number } } }).__board.__debug;
      const out: string[] = [];
      const nums = new Map<string, DOMRect>();
      document.querySelectorAll<HTMLElement>('.rb-badge').forEach((b) => {
        if (b.style.visibility !== 'hidden') nums.set(b.dataset.t!, b.getBoundingClientRect());
      });
      const cr = (document.querySelector('canvas') as HTMLCanvasElement).getBoundingClientRect();
      for (const t of d.tiles.list) {
        const r = d.overlay.pieceRects(t.id);
        if (!r) continue;
        const [x0, y0, x1, y1] = [r.box[0] + cr.left, r.box[1] + cr.top, r.box[2] + cr.left, r.box[3] + cr.top];
        for (const [o, n] of nums) {
          if (o === t.id) continue;
          const w = Math.min(x1, n.right) - Math.max(x0, n.left);
          const h = Math.min(y1, n.bottom) - Math.max(y0, n.top);
          if (w > 0 && h > 0 && w * h > 2) out.push(`${t.id}'s stone over ${o}'s numeral (${Math.round(w)}×${Math.round(h)})`);
        }
      }
      return { out, floored: d.capsFloored, lowered: d.capsLowered };
    });
  const tall = scenario({}, { kind: 'attack' }, { fill: (_t, i) => [1 + (i % 3), 30] });
  const mixed = scenario({}, { kind: 'attack' }, { fill: (_t, i) => [1 + (i % 3), i % 2 ? 1 : 40] });
  for (const form of ['1440x900', 'iphone', 'iphone-land'] as const) {
    const ctx = form === '1440x900' ? await open() : await openDevice(form);
    const bad: string[] = [];
    let floored = 0;
    let lowered = 0;
    for (const s of [tall, mixed]) {
      await loadScenario(ctx.page, s);
      await ctx.page.waitForTimeout(300);
      const r = await overlaps(ctx.page);
      bad.push(...r.out);
      floored = r.floored;
      lowered = r.lowered;
    }
    check(bad.length === 0, `${form}: no stone covers another territory's numeral at home (every stone at 30 and at 1/40; ${lowered} stones held under full size to clear a neighbour, ${floored} of them at the 1-army size)${bad.length ? ` — ${bad.slice(0, 6).join('; ')}` : ''}`, results);
    errors.push(...ctx.errors);
    await ctx.browser.close();
  }
}

finish(results, errors);
