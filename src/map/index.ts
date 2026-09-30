// Board geometry for the renderer and UI, read through the map-pack loader (src/map/registry.ts,
// docs/MAPS.md). Generated per pack by `npm run build:map -- --map <id>` into maps/<id>/board.json and
// checked by `npm run verify:map -- --map <id>`. Coordinates: board units, origin bottom-left, +x east,
// +y north.
//
// BOARD is the board this page boots on (registry.activeMapId(): ?map=<id> in dev/e2e builds, else the
// saved game's config.mapId, else classic). Importers keep `import { BOARD } from './map'`.

import type { TerritoryId } from '../engine/types';
import type { BoardGeometry, SeaLaneGeom, Vec2 } from './types';
import { activeBoard } from './registry';

export type * from './types';
export {
  listMaps, getBoard, activeMapId, activeBoard, resolveMapId, mapIdOf, laneShores, anchorClearanceOf, DEFAULT_MAP_ID,
  type MapInfo,
} from './registry';

export const BOARD: BoardGeometry = activeBoard();

/** Where the army piece + count badge sits (inside the main polygon, ≥ ANCHOR_CLEARANCE from its edge). */
export function territoryAnchor(t: TerritoryId): Vec2 {
  return BOARD.territories[t].anchor;
}

/** Guaranteed free radius around `territoryAnchor` inside the tile (board units); every pack keeps it. */
export const ANCHOR_CLEARANCE = 1.3;

const laneIndex = new Map<string, SeaLaneGeom>();
for (const lane of BOARD.seaLanes) {
  laneIndex.set(`${lane.a}|${lane.b}`, lane);
  laneIndex.set(`${lane.b}|${lane.a}`, lane);
}

/** The sea lane joining two territories, if their border is a sea crossing (null for land borders). */
export function seaLaneBetween(a: TerritoryId, b: TerritoryId): SeaLaneGeom | null {
  return laneIndex.get(`${a}|${b}`) ?? null;
}
