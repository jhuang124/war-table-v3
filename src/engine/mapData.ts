// Canonical classic-Risk map data: 42 territories, 6 continents, 83 borders.
// Presentation lives elsewhere (src/map for geometry, src/shared/palette.ts for colors).
//
// Since the v3 map packs (docs/MAPS.md) the data itself lives in maps/classic/rules.json and
// maps/classic/topology.json, read through the one pack loader (src/map/packs.ts); this module keeps the
// same exports, in the same order, typed with the engine's ids. Every playable pack shares these rules
// and topology today (true-world extends classic), so the engine plays any of them unchanged.
// A pack with different territories needs the engine to read rules per game (docs/MAPS.md, "A new
// board"); `mapRulesOf` below is the hook for that.

import type { ContinentId, TerritoryId, CardSymbol } from './types';
import { DEFAULT_MAP_ID, mapIdOf, packData } from '../map/packs';
import type { MapRules, MapTopology } from '../map/types';

export interface ContinentInfo {
  id: ContinentId;
  name: string;
  bonus: number;
  territories: TerritoryId[];
}

export interface TerritoryInfo {
  id: TerritoryId;
  name: string;
  continent: ContinentId;
}

const CLASSIC = packData(DEFAULT_MAP_ID);
const RULES = CLASSIC.rules;
const TOPOLOGY = CLASSIC.topology;

export const CONTINENTS: Record<ContinentId, ContinentInfo> = Object.fromEntries(
  RULES.continents.map((c) => [
    c.id,
    {
      id: c.id as ContinentId,
      name: c.name,
      bonus: c.bonus,
      territories: RULES.territories.filter((t) => t.continent === c.id).map((t) => t.id as TerritoryId),
    },
  ]),
) as Record<ContinentId, ContinentInfo>;

export const CONTINENT_IDS = Object.keys(CONTINENTS) as ContinentId[];

const NAMES = Object.fromEntries(RULES.territories.map((t) => [t.id, t.name])) as Record<TerritoryId, string>;

export const TERRITORY_IDS: TerritoryId[] = CONTINENT_IDS.flatMap((c) => CONTINENTS[c].territories);

export const TERRITORIES: Record<TerritoryId, TerritoryInfo> = Object.fromEntries(
  CONTINENT_IDS.flatMap((c) =>
    CONTINENTS[c].territories.map((t) => [t, { id: t, name: NAMES[t], continent: c }]),
  ),
) as Record<TerritoryId, TerritoryInfo>;

/** The 83 undirected borders of the classic board. */
export const BORDERS: [TerritoryId, TerritoryId][] = TOPOLOGY.borders.map(([a, b]) => [a as TerritoryId, b as TerritoryId]);

export const ADJACENCY: Record<TerritoryId, TerritoryId[]> = (() => {
  const adj = Object.fromEntries(TERRITORY_IDS.map((t) => [t, [] as TerritoryId[]])) as Record<
    TerritoryId,
    TerritoryId[]
  >;
  for (const [a, b] of BORDERS) {
    adj[a].push(b);
    adj[b].push(a);
  }
  return adj;
})();

export function areAdjacent(a: TerritoryId, b: TerritoryId): boolean {
  return ADJACENCY[a].includes(b);
}

/** Card symbol printed on each territory's card: 14 of each, cycling through the canonical order. */
export const CARD_SYMBOLS: Record<TerritoryId, Exclude<CardSymbol, 'wild'>> = Object.fromEntries(
  TERRITORY_IDS.map((t, i) => [t, RULES.cardSymbols[i % RULES.cardSymbols.length]]),
) as Record<TerritoryId, Exclude<CardSymbol, 'wild'>>;

/** Default starting armies by player count (classic rules). */
export const STARTING_ARMIES: Record<number, number> = Object.fromEntries(
  Object.entries(RULES.startingArmies).map(([n, v]) => [Number(n), v]),
);

/** The map pack a config plays on: its `mapId` when that pack exists, else 'classic'. */
export { mapIdOf };

/**
 * The rules + topology a game's map pack plays by (`config.mapId`, absent = classic). Additive: the
 * engine still reads the classic constants above; this is where a per-game read would start.
 */
export function mapRulesOf(config?: { mapId?: string }): { mapId: string; rules: MapRules; topology: MapTopology } {
  const p = packData(config?.mapId);
  return { mapId: p.manifest.id, rules: p.rules, topology: p.topology };
}
