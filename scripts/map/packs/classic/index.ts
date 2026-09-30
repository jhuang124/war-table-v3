// Classic recipe: Miller cylindrical with a Pacific seam, six smooth lenses (Europe, Central America,
// SE Asia, the northern Andes, Japan, New Guinea) and stretched islands, so every army badge fits.
// Must keep producing the pre-pack board byte for byte (verify:map checks the hash).

import { BoardProjection, millerBase } from '../../projection';
import { DEFAULT_TUNING, type MapRecipe } from '../../recipe';
import { RULES } from './assign';
import {
  AUTO_FATTEN, CONTINENT_LABEL_HINTS, GAP, GROWTH_REACH, ISLAND_XFORM, LANE_GAP, LENSES, MAX_GROWTH_ROUNDS,
  MIN_CLEARANCE, OCEAN_LABELS, PROTECTED_ISLANDS, PX, TARGET_CLEARANCE,
} from './config';

const WIDTH = 100;
const LON_LEFT = -169.2;
const MARGIN_X = 2.4;

const projection = new BoardProjection(
  millerBase({ width: WIDTH, lonLeft: LON_LEFT, marginX: MARGIN_X, latBottom: -56.2, latTop: 83.8, marginBottom: 1.4, marginTop: 1.2 }),
  LENSES,
);

export const recipe: MapRecipe = {
  source: 'countries-50m.json',
  projection,
  assign: RULES,
  aliases: { ireland: 'great_britain' },
  islandXform: ISLAND_XFORM,
  protectedIslands: PROTECTED_ISLANDS,
  autoFatten: AUTO_FATTEN,
  continentLabelHints: CONTINENT_LABEL_HINTS,
  oceanLabels: OCEAN_LABELS,
  tuning: {
    ...DEFAULT_TUNING,
    px: PX,
    minClearance: MIN_CLEARANCE,
    targetClearance: TARGET_CLEARANCE,
    gap: GAP,
    laneGap: LANE_GAP,
    maxGrowthRounds: MAX_GROWTH_ROUNDS,
    growthReach: GROWTH_REACH,
  },
  describe: () =>
    `Miller cylindrical, Pacific seam: lon ${LON_LEFT}°…${LON_LEFT + 360}° squeezed into x∈[2.4, ${WIDTH - 2.4}] ` +
    `(so the Bering Strait sits just inside both edges), lat ≈56°S…84°N. Smooth monotone lenses enlarge ` +
    LENSES.map((l) => `${l.name} ×${l.m}`).join(', ') +
    `; islands stretched (${Object.entries(ISLAND_XFORM).map(([t, x]) => `${t} ×${x!.along}/${x!.across}`).join(', ')}) and locally grown ` +
    `to fit an army badge. Rasterised at ${PX} px/unit, borders are shared arcs (DP + Chaikin). ` +
    `Origin bottom-left, +y north.`,
  previews: [
    { name: 'europe', territories: ['iceland', 'great_britain', 'western_europe', 'southern_europe', 'scandinavia', 'northern_europe'], pad: 2, px: 1600 },
    { name: 'seasia', territories: ['siam', 'indonesia', 'new_guinea', 'japan', 'india'], pad: 1.5, px: 1600 },
    { name: 'americas', territories: ['western_us', 'eastern_us', 'central_america', 'venezuela', 'quebec'], pad: 1.5, px: 1600 },
  ],
};
