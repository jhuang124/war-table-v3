// How an AI with a personality handles truces: whether to accept an offer, and whom to offer one.
// Deterministic (no randomness): the same board always gets the same answer. The classic AI (no
// personality) never proposes and always declines.

import { grudgeOf, offerBetween, recentlyRebuffed, truceBetween } from '../diplomacy';
import { ADJACENCY, TERRITORY_IDS } from '../mapData';
import type { GameState, PlayerId, TruceProposal } from '../types';
import { TEMPERAMENTS } from './personality';

interface Border {
  /** Armies `them` has on territories touching `me`. */
  theirs: number;
  /** Armies `me` has on territories touching `them`. */
  mine: number;
}

function border(s: GameState, me: PlayerId, them: PlayerId): Border {
  let theirs = 0;
  let mine = 0;
  for (const t of TERRITORY_IDS) {
    const x = s.territories[t];
    if (x.owner !== me && x.owner !== them) continue;
    const other = x.owner === me ? them : me;
    if (!ADJACENCY[t].some((n) => s.territories[n].owner === other)) continue;
    if (x.owner === me) mine += x.armies;
    else theirs += x.armies;
  }
  return { theirs, mine };
}

function share(s: GameState, p: PlayerId): number {
  let n = 0;
  for (const t of TERRITORY_IDS) if (s.territories[t].owner === p) n++;
  return n / TERRITORY_IDS.length;
}

/** Opponent seats (not neutral, not eliminated) that border `me`. */
function neighbourSeats(s: GameState, me: PlayerId): Set<PlayerId> {
  const out = new Set<PlayerId>();
  for (const t of TERRITORY_IDS) {
    if (s.territories[t].owner !== me) continue;
    for (const n of ADJACENCY[t]) {
      const o = s.territories[n].owner;
      if (o >= 0 && o !== me && !s.players[o].neutral && !s.players[o].eliminated) out.add(o);
    }
  }
  return out;
}

/** Offer score from the answering seat's side; > 0 = accept. */
export function truceScore(s: GameState, offer: TruceProposal): number {
  const me = offer.to;
  const from = offer.from;
  const pl = s.players[me];
  if (!pl?.personality || pl.neutral) return -Infinity;
  const T = TEMPERAMENTS[pl.personality];
  const b = border(s, me, from);
  if (b.theirs === 0 && b.mine === 0) return -Infinity; // nothing to agree on
  const ratio = b.theirs / Math.max(1, b.mine);
  const others = [...neighbourSeats(s, me)].filter((o) => o !== from && !truceBetween(s, me, o));
  let v = T.acceptBias + Math.max(-1, Math.min(1.5, ratio - 0.8)) + (others.length > 0 ? 0.6 : -0.8);
  v -= grudgeOf(s, me, from) * 0.5;
  v -= (s.players[from]?.truceBreaks ?? 0) * 0.8;
  if (share(s, from) >= 0.45) v -= 3; // don't hold the door for the runaway leader
  if (pl.personality === 'opportunist' && ratio < 0.6) v -= 1.5; // they're weak: better eaten than befriended
  if (pl.personality === 'warlord') {
    let theirT = 0;
    for (const t of TERRITORY_IDS) if (s.territories[t].owner === from) theirT++;
    if (theirT <= 4) v -= 3; // prey
  }
  return v;
}

/** Would the AI seat `offer.to` accept? The classic AI never does. */
export function acceptsTruce(s: GameState, offer: TruceProposal): boolean {
  return truceScore(s, offer) > 0;
}

/**
 * The truce this AI would offer at the start of its turn, or null. It only asks when it faces two or
 * more rivals (a truce frees one front), never a seat it holds a grudge against, never the runaway
 * leader, never a classic AI (they always refuse), and a human only when config.diplomacy is on.
 */
export function chooseTruceProposal(s: GameState, me: PlayerId): TruceProposal | null {
  const pl = s.players[me];
  if (!pl?.personality || pl.neutral) return null;
  // A human seat on autoplay speaks for a human: only with diplomacy on.
  if (pl.kind === 'human' && !s.config.diplomacy) return null;
  const T = TEMPERAMENTS[pl.personality];
  if (T.proposeBias <= 0) return null;
  if (s.diplomacy?.proposedOn[me] === s.turn) return null;
  const seats = neighbourSeats(s, me);
  if (seats.size < 2) return null;
  let best: PlayerId = -1;
  let bestV = 0;
  for (const z of seats) {
    const zp = s.players[z];
    if (truceBetween(s, me, z) || offerBetween(s, me, z)) continue;
    if (zp.kind === 'human' && !s.config.diplomacy) continue;
    if (zp.kind === 'ai' && !zp.personality) continue;
    if (recentlyRebuffed(s, me, z)) continue;
    if (grudgeOf(s, me, z) >= 1.5) continue;
    if (share(s, z) >= 0.45) continue;
    const b = border(s, me, z);
    const ratio = b.theirs / Math.max(1, b.mine);
    if (ratio < 0.7) continue; // not a real threat: no need for peace
    if (pl.personality === 'opportunist' && ratio < 1) continue; // it befriends only the strong
    const v = ratio * T.proposeBias;
    if (v > bestV) {
      bestV = v;
      best = z;
    }
  }
  if (best < 0 || bestV < 0.8) return null;
  return { from: me, to: best, rounds: T.truceRounds, kind: 'noAttack' };
}
