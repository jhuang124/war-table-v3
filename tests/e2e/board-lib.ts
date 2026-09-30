// The round-6 board the v3 screenshot tools and the table / squint checks share (_claude/v3/PLAN.md).
import { scenario } from './lib';
import type { GameState, Phase } from '../../src/engine';

export const PLAYERS = [
  { name: 'John', color: 'crimson', kind: 'human' },
  { name: 'Sam', color: 'cobalt', kind: 'human' },
  { name: 'Priya', color: 'amber', kind: 'ai', difficulty: 'normal' },
  { name: 'Theo', color: 'emerald', kind: 'ai', difficulty: 'normal' },
] as never;
const own = (t: string[]) => Object.fromEntries(t.map((x) => [x, [0, 2]]));

/** Round 6: John holds a band from Scandinavia to India and all of South America; the rest is spread out. */
export function restBoard(phase: Phase, mutate?: (s: GameState) => void): GameState {
  return scenario(
    {
      ...own(['ural', 'ukraine', 'afghanistan', 'middle_east', 'india', 'scandinavia', 'egypt', 'north_africa', 'brazil', 'peru', 'venezuela', 'argentina']),
      ural: [0, 19],
      brazil: [0, 7],
    } as never,
    phase,
    {
      players: PLAYERS,
      fill: (_t, i) => [1 + (i % 3), 1 + ((i * 7) % 5)],
      mutate: (s) => {
        s.round = 6;
        s.territories.siberia = { owner: 1, armies: 12 };
        s.territories.china = { owner: 2, armies: 9 };
        s.territories.eastern_us = { owner: 3, armies: 14 };
        // cards in hand (the strip counts them)
        s.players[0].cards = [
          { id: 0, territory: 'ural', symbol: 'infantry' },
          { id: 1, territory: 'peru', symbol: 'cavalry' },
        ] as never;
        s.players[1].cards = [
          { id: 2, territory: 'china', symbol: 'artillery' },
          { id: 3, territory: 'egypt', symbol: 'infantry' },
          { id: 4, territory: 'congo', symbol: 'cavalry' },
        ] as never;
        s.players[3].cards = [{ id: 5, territory: 'siam', symbol: 'infantry' }] as never;
        mutate?.(s);
      },
    },
  );
}

