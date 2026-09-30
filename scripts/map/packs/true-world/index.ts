// True World recipe: the classic 42 territories and rules on an Equal Earth projection (equal-area),
// no stretched islands, no grown coasts. Pacific seam as on every world map, so the Bering Strait is the
// one crossing that runs off the edges.

import { geoEqualEarthRaw } from 'd3-geo';
import { BoardProjection, pseudoBase, type LensSpec } from '../../projection';
import { DEFAULT_TUNING, type MapRecipe } from '../../recipe';
import { RULES } from '../classic/assign';

const WIDTH = 100;
const LON_LEFT = -169.2;
/** Share of the equator across the board: the empty mid-Pacific is cropped at the sides. */
const SPAN = 0.87;
/** Meridians eased 30 % toward straight near the sides, so Alaska and Chukotka reach the edges. */
const EDGE = 0.3;
/**
 * 5 % flatter than Equal Earth. The camera fits the land's outline, and Equal Earth's land is taller
 * for its width than a 16:10 screen minus the HUD, so it framed by height with smaller armies than
 * classic. At 0.95 it frames like classic (armies the same size, a little more land on screen).
 */
const YSCALE = 0.95;
const EUROPE_M = 1.3;

const LENSES: LensSpec[] = [
  // The crowded seven, gently: half of classic's Europe magnification, same footprint.
  { name: 'europe', lon: 8, lat: 52, r0: 4.2, R: 14, m: EUROPE_M, ax: 1.2, ay: 0.95 },
];

const projection = new BoardProjection(
  pseudoBase(geoEqualEarthRaw, { width: WIDTH, lonLeft: LON_LEFT, span: SPAN, edge: EDGE, yScale: YSCALE, latBottom: -56.2, latTop: 83.8, marginBottom: 1.2, marginTop: 1.0 }),
  LENSES,
);

export const recipe: MapRecipe = {
  source: 'countries-50m.json',
  projection,
  assign: RULES,
  aliases: { ireland: 'great_britain' },
  islandXform: {},
  protectedIslands: ['iceland', 'great_britain', 'japan', 'madagascar', 'new_guinea'],
  autoFatten: [],
  continentLabelHints: {
    north_america: [-146, 24],
    south_america: [-102, -28],
    europe: [-26, 50],
    africa: [-12, -14],
    asia: [168, 44],
    australia: [128, -46],
  },
  oceanLabels: [
    { text: 'PACIFIC OCEAN', hint: [-138, 6], size: 1.25 },
    { text: 'PACIFIC OCEAN', hint: [172, 8], size: 1.1 },
    { text: 'ATLANTIC OCEAN', hint: [-42, 26], size: 1.25 },
    { text: 'INDIAN OCEAN', hint: [78, -24], size: 1.25 },
    { text: 'ARCTIC OCEAN', hint: [-10, 84], size: 0.9 },
    { text: 'SOUTHERN OCEAN', hint: [40, -50], size: 0.95 },
  ],
  laneHints: {
    // The Bering Strait: Cape Prince of Wales → west edge, east edge → Cape Dezhnev.
    'alaska|kamchatka': { ha: [-168.1, 65.6], hb: [-169.7, 66.1] },
    // Tanzania's coast to Madagascar's northern cape, clear of Mozambique (South Africa).
    'east_africa|madagascar': { ha: [40.2, -9.5], hb: [49.3, -12.1] },
  },
  tuning: { ...DEFAULT_TUNING, laneGap: 0.6 },
  describe: () =>
    `Equal Earth (equal-area), Pacific seam: central meridian ${LON_LEFT + 180}°, ${Math.round(SPAN * 100)}% of the equator across the board, ` +
    `meridians eased ${Math.round(EDGE * 100)}% toward straight at the sides, heights ×${YSCALE}, lat ≈56°S…84°N. ` +
    (LENSES.length ? `Gentle lenses: ${LENSES.map((l) => `${l.name} ×${l.m}`).join(', ')}. ` : 'No lenses. ') +
    `No stretched or grown islands. Rasterised at ${DEFAULT_TUNING.px} px/unit, borders are shared arcs (DP + Chaikin). Origin bottom-left, +y north.`,
  previews: [
    { name: 'bering-west', lonLat: [-169, 52, -145, 72], pad: 0.5, px: 1000 },
    { name: 'bering-east', lonLat: [160, 52, 190.7, 72], pad: 0.5, px: 1000 },
    { name: 'central-america', lonLat: [-118, 5, -60, 33], pad: 1, px: 1400 },
    { name: 'mediterranean', lonLat: [-12, 28, 42, 50], pad: 1, px: 1600 },
    { name: 'europe', territories: ['iceland', 'great_britain', 'western_europe', 'southern_europe', 'scandinavia', 'northern_europe'], pad: 2, px: 1600 },
    { name: 'seasia', territories: ['siam', 'indonesia', 'new_guinea', 'japan', 'india'], pad: 1.5, px: 1600 },
  ],
};
