// A map pack's build recipe (docs/MAPS.md): how scripts/map/pipeline.ts turns Natural Earth into
// maps/<id>/board.json. One per generated pack, in scripts/map/packs/<id>/index.ts, exporting `recipe`.
// The pack's rules.json (territory ids, names, continents) and topology.json (borders, sea lanes) are
// read from maps/<id>/; the recipe only says where each territory is on the globe and how to draw it.

import type { BoardProjection } from './projection';

/** A territory id from rules.json, an alias from `aliases`, 'decor' (neutral land) or 'drop'. */
export type Resolved = string;
export interface PolyInfo {
  lon: number;
  lat: number;
  /** approx area in square degrees */
  area: number;
}
/**
 * Which territory a Natural Earth country (or part of it) becomes. Either a fixed result, or:
 *   poly(c)  — decided per polygon (island) from its centroid; return undefined to fall through
 *   pixel(l) — decided per pixel from its lon/lat (used to split big countries)
 */
export type Rule =
  | Resolved
  | {
      poly?: (c: PolyInfo) => Resolved | undefined;
      pixel?: (lon: number, lat: number) => Resolved;
      default?: Resolved;
    };

export interface LaneHint {
  /** lon/lat hints: the lane starts at the coast point of a (ends at b's) nearest the hint. */
  ha?: [number, number];
  hb?: [number, number];
}

export interface Tuning {
  /** Raster resolution (pixels per board unit). */
  px: number;
  /** Anchor clearance the build must reach (board units); must equal pack.json anchorClearance. */
  minClearance: number;
  /** What the raster stage aims for, so the vector smoothing still clears minClearance. */
  targetClearance: number;
  /** Minimum water gap between land that must not touch (lane pairs, non-neighbours, decor). */
  gap: number;
  /** Wider water between the two ends of a sea lane, so the crossing reads on the board. */
  laneGap: number;
  /** Growth: at most this many 2 px rounds, claiming water within growthReach × target of the badge spot. */
  maxGrowthRounds: number;
  growthReach: number;
  /** Coast blur sigmas (px) before and after the growth loop. */
  coastSigma: [number, number];
  /** Arc stylisation: Douglas–Peucker tolerance (px), Chaikin rounds, final tolerance (px). */
  simplify: { tol: number; smooth: number; tol2: number };
  /** Minimum speck sizes kept, in square board units: territory pieces, decorative pieces. */
  speck: { terr: number; decor: number; terrLate: number };
  /** Enclosed water smaller than this (square units) is filled. */
  lakeMax: number;
}

export const DEFAULT_TUNING: Tuning = {
  px: 20,
  minClearance: 1.3,
  targetClearance: 1.5,
  gap: 0.4,
  laneGap: 0.8,
  maxGrowthRounds: 3,
  growthReach: 3.5,
  coastSigma: [1.1, 0.9],
  simplify: { tol: 1.35, smooth: 2, tol2: 0.22 },
  speck: { terr: 0.12, decor: 0.4, terrLate: 0.15 },
  lakeMax: 1.2,
};

export interface PreviewShot {
  name: string;
  /** Frame these territories' bboxes... */
  territories?: string[];
  /** ...or this lon/lat box [west, south, east, north]. */
  lonLat?: [number, number, number, number];
  pad: number;
  px: number;
}

export interface MapRecipe {
  /** Natural Earth countries file in node_modules/world-atlas. */
  source: 'countries-50m.json' | 'countries-10m.json';
  projection: BoardProjection;
  /** Natural Earth country name → rule. Countries without a rule are dropped (and logged). */
  assign: Record<string, Rule>;
  /**
   * Extra raster labels that belong to a territory but keep their own coastline (classic: Ireland is
   * Great Britain's, but must not fuse onto Britain). alias → territory id.
   */
  aliases?: Record<string, string>;
  /** Oriented stretch about an island territory's centroid before rasterising. */
  islandXform?: Record<string, { along: number; across: number; angle: number }>;
  /** When water is carved between one of these and other land, the gap is split instead of eating it. */
  protectedIslands: string[];
  /** Territories allowed to grow a little into the sea to reach targetClearance. */
  autoFatten: string[];
  /** Lane endpoint hints, keyed 'a|b' as the lane is listed in topology.json. */
  laneHints?: Record<string, LaneHint>;
  /** lon/lat near which each continent's name + bonus goes (on clear water). */
  continentLabelHints: Record<string, [number, number]>;
  oceanLabels: { text: string; hint: [number, number]; size: number }[];
  tuning: Tuning;
  /** The human-readable `projection` note written into board.json. */
  describe(): string;
  /** Close-ups verify:map renders besides the whole board (artifacts/map/<id>/). */
  previews?: PreviewShot[];
}
