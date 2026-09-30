// Visible water = adjacency (_claude/v3/PLAN.md §2): every sea lane is printed as a crossing — one silver
// hairline over the water you can see, with a short tick where it meets each shore — so "where can Ural
// attack?" answers itself from the board. At rest the crossings are quiet (paint, printed); they brighten
// with the selected territory, the armed attack's pair, and the hovered tile, then settle back (160 ms).
// Wrapped lanes (Alaska–Kamchatka) run off the board's edges; only their shore ends get a tick.
import * as THREE from 'three';
import type { BoardGeometry, Vec2 } from '../map/types';
import type { TerritoryId } from '../engine/types';
import { Animator, ease } from './anim';
import { INK_COAST, TILE_TOP, hexToRgb, toWorld } from './util';

const VERT = /* glsl */ `
attribute float aLane;
attribute float aSide;
attribute float aAlong;
uniform float uLit[32];
varying float vLit;
varying float vSide;
varying float vAlong;
void main() {
  vLit = uLit[int(aLane + 0.5)];
  vSide = aSide;
  vAlong = aAlong;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;
const FRAG = /* glsl */ `
uniform vec3 uInk;
uniform float uRest;
varying float vLit;
varying float vSide;
varying float vAlong;
void main() {
  // a hairline, soft at its two edges; a dry break now and then along it
  float edge = 1.0 - smoothstep(0.35, 1.0, abs(vSide));
  float dry = 0.82 + 0.18 * step(0.12, fract(vAlong * 0.9 + 0.37));
  float a = edge * dry * mix(uRest, 0.95, vLit);
  if (a < 0.004) discard;
  gl_FragColor = vec4(uInk * a, a);
}
`;

export class SeaLanes {
  group = new THREE.Group();
  private mat: THREE.ShaderMaterial;
  private mesh: THREE.Mesh | null = null;
  private lanes: { a: TerritoryId; b: TerritoryId }[] = [];
  private lit: number[];
  private goal: number[];
  private ver = 0;
  /** Board units per CSS px at the home view (the hairline is ~1.3 px, the ticks ~7 px). */
  private pxUnit = 1 / 12.7;

  constructor(
    private g: BoardGeometry,
    private anim: Animator,
  ) {
    const ink = hexToRgb(INK_COAST);
    this.lit = new Array(32).fill(0);
    this.goal = new Array(32).fill(0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uLit: { value: this.lit.slice() }, uInk: { value: new THREE.Vector3(ink[0], ink[1], ink[2]) }, uRest: { value: 0.34 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      premultipliedAlpha: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.lanes = g.seaLanes.slice(0, 32).map((l) => ({ a: l.a, b: l.b }));
    this.build();
  }

  /** Rebuild the ribbons for a new home scale (the weights are set in screen px). */
  setPxUnit(u: number): void {
    if (Math.abs(u - this.pxUnit) / this.pxUnit < 0.02) return;
    this.pxUnit = u;
    this.build();
  }

  private build(): void {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    const pos: number[] = [];
    const lane: number[] = [];
    const side: number[] = [];
    const along: number[] = [];
    const idx: number[] = [];
    const W = this.g.width;
    const hw = 0.75 * this.pxUnit;
    const tick = 3.6 * this.pxUnit;
    const y = TILE_TOP + 0.004;
    const quad = (a: Vec2, b: Vec2, h: number, li: number, s0: number) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const L = Math.hypot(dx, dy) || 1;
      const nx = (-dy / L) * h;
      const ny = (dx / L) * h;
      const base = pos.length / 3;
      const pts: [number, number, number][] = [
        [a[0] + nx, a[1] + ny, -1],
        [a[0] - nx, a[1] - ny, 1],
        [b[0] + nx, b[1] + ny, -1],
        [b[0] - nx, b[1] - ny, 1],
      ];
      pts.forEach(([x, z, sd], k) => {
        const w = toWorld(x, z, y);
        pos.push(w.x, w.y, w.z);
        lane.push(li);
        side.push(sd);
        along.push(s0 + (k >= 2 ? L : 0));
      });
      idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      return L;
    };
    this.g.seaLanes.slice(0, 32).forEach((l, li) => {
      for (const seg of l.segments) {
        let s = 0;
        for (let i = 1; i < seg.length; i++) s += quad(seg[i - 1], seg[i], hw, li, s);
        // a tick across the line at each shore end (not where a wrapped lane runs off the board)
        for (const [p, q] of [
          [seg[0], seg[1]],
          [seg[seg.length - 1], seg[seg.length - 2]],
        ] as [Vec2, Vec2][]) {
          if (p[0] < 0.6 || p[0] > W - 0.6) continue;
          const dx = q[0] - p[0];
          const dy = q[1] - p[1];
          const L = Math.hypot(dx, dy) || 1;
          const c: Vec2 = [p[0] + (dx / L) * 0.35 * tick, p[1] + (dy / L) * 0.35 * tick];
          const n: Vec2 = [-dy / L, dx / L];
          quad([c[0] - n[0] * tick, c[1] - n[1] * tick], [c[0] + n[0] * tick, c[1] + n[1] * tick], hw * 1.15, li, 0.2);
        }
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aLane', new THREE.Float32BufferAttribute(lane, 1));
    geo.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
    geo.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    // over the paper and the washes, under the pieces (8+) and the strokes (20)
    this.mesh.renderOrder = 3;
    this.group.add(this.mesh);
  }

  /** Brighten the crossings that touch `ids` (the selected territory, an armed pair, the hovered tile). */
  light(ids: Iterable<TerritoryId>): void {
    const set = new Set(ids);
    let changed = false;
    this.lanes.forEach((l, i) => {
      const g = set.has(l.a) || set.has(l.b) ? 1 : 0;
      if (g !== this.goal[i]) {
        this.goal[i] = g;
        changed = true;
      }
    });
    if (!changed) return;
    const from = this.lit.slice();
    const ver = ++this.ver;
    void this.anim.tween({
      ms: 160,
      ease: ease.outQuad,
      unscaled: true,
      update: (v) => {
        if (ver !== this.ver) return;
        for (let i = 0; i < 32; i++) this.lit[i] = from[i] + (this.goal[i] - from[i]) * v;
        (this.mat.uniforms.uLit.value as number[]).splice(0, 32, ...this.lit);
      },
    });
  }

  /** Test hook: how lit each lane is, by its two ends. */
  state(): { a: TerritoryId; b: TerritoryId; lit: number }[] {
    return this.lanes.map((l, i) => ({ ...l, lit: this.lit[i] }));
  }

  dispose(): void {
    this.mesh?.geometry.dispose();
    this.mat.dispose();
  }
}
