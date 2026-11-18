// ============================================================================
// world layout + procedural content generation (load-time only)
// ============================================================================

// designed rock masses: ax, az, bx, bz, radius, top, overhang, waist
const MESAS = [
  [-37, -42, -33, -22, 9, -7, 3.5, 2], [-29, -15, -33, 5, 12, -14, 3, 2], [-36, 11, -30, 27, 9, -5, 4, 2],   // west wall of the main canyon
  [30, -45, 35, -27, 9, -9, 4, 2], [37, -20, 31, -3, 11, -16, 3, 2], [32, 5, 35, 9, 7, -8, 4, 2],          // east wall
  [19, -15, 19, -15, 4.4, -6, 2, 1.5],   // pillar with window
  [6, -88, 6, -88, 10, -34, 0, 0],       // mound in the kelp basin
  [0, -106, 0, -106, 8, 3, 2, 2],        // pillar reaching the surface
  [44, 6, 47, -8, 7, -17, 3, 1],         // ship supports
  [33, 29, 37, 12, 9, -19, -6.5, 0],     // sloped sunlit wall beside the wreck
  [74, 14, 74, 14, 8, -15, 3, 1],
  [-84, -34, -80, -12, 10, -7, 6, 2], [-78, -6, -83, 12, 12, -13, 5, 2], [-82, 18, -79, 32, 9, -8, 6, 2],   // sponge canyon west wall
  [-17, 62, -19, 78, 10, -6, 9, 3], [-21, 84, -18, 100, 11, -9, 8, 3],     // grotto overhang cliff
  [22, 67, 24, 80, 7, -11, 6, 2],        // grotto coral rock
  [-16, 122, 34, 122, 9, -27, 3, 2],     // grotto far wall
];
// vertical ring arches: cx, cy, cz, yaw, major radius, minor radius, y squash
const ARCHES = [
  [-23, -9.5, -16, 0.3, 4.2, 1.4, 1.2],
  [0, -45, -34, 1.57, 14, 2.7, 1.2],
  [-40, -45, 44, 1.57, 10, 2.2, 1.3],
];
// carved tunnels: ax, ay, az, radius, bx, by, bz
const HOLES = [
  [19, -21, -23, 2.5, 19, -21, -7],
  [9, -37, 108, 4.2, 9, -34, 136],
];
// regions kept free of random mesas: ax, az, bx, bz, radius, softness
const CLEARS = [
  [0, -45, 0, 35, 22, 10], [0, -86, 0, -86, 46, 12], [42, 24, 74, 6, 22, 10], [72, -26, 72, -26, 26, 10],
  [-60, -36, -60, 36, 13, 8], [-60, 42, -18, 46, 12, 8], [4, 58, 8, 100, 24, 10], [-34, -74, -56, -46, 11, 8],
];
const PURPLE = [6, 84];
const zoneP = (x, z) => sstep(44, 26, hypot(x - PURPLE[0], z - PURPLE[1]));
const MAGENTA = [[14, 6, 13], [-4, 20, 9], [6, 84, 30], [-58, 8, 10], [50, 30, 12], [8, -70, 10], [-12, -98, 9], [-36, 44, 9], [-46, -60, 9], [24, 42, 8], [-56, 26, 9], [-44, 38, 8], [-10, 44, 8], [12, 24, 8], [-50, -45, 8]];
const magAt = (x, z) => {
  let m = sstep(0.54, 0.66, fbm(x * 0.03, 7, z * 0.03, 3)) * 0.9;
  for (const p of MAGENTA) m = max(m, sstep(p[2], p[2] * 0.45, hypot(x - p[0], z - p[1])));
  return m * sstep(0.3, 0.55, fbm(x * 0.17, 1, z * 0.17, 2) + m * 0.25);
};

// Rock masses of one chunk: the designed ones near the start, plus hashed candidates (one per PCELL square, one arch per
// chunk square) elsewhere. Everything that can reach the chunk's density grid is included, in a fixed global order, so
// neighbouring chunks compute the same rock where they overlap.
const PCELL = 56, HOME = 200;
function chunkPrims(ci, cj) {
  const x0 = ci * CHK, x1 = x0 + CHK, z0 = cj * CHK, z1 = z0 + CHK, mg = MG * VS;
  const hit = (ax, az, bx, bz, r) => min(ax, bx) - r < x1 + mg && max(ax, bx) + r > x0 - mg && min(az, bz) - r < z1 + mg && max(az, bz) + r > z0 - mg;
  const mesas = [], arches = [], holes = [], clears = [];
  for (const m of MESAS) if (hit(m[0], m[1], m[2], m[3], m[4] + max(m[6], 0) + 26)) mesas.push(m);
  for (let a = floor((x0 - 90) / PCELL); a <= floor((x1 + 90) / PCELL); a++) for (let b = floor((z0 - 90) / PCELL); b <= floor((z1 + 90) / PCELL); b++) {
    const r = (k) => ihash(a, b, 20 + k), ax = (a + r(1)) * PCELL, az = (b + r(2)) * PCELL;
    if (r(0) > 0.55 || (abs(ax) < HOME && abs(az) < HOME)) continue;
    const ang = r(3) * TAU, len = r(4) < 0.5 ? 0 : 8 + r(5) * 18, rad = 6 + r(6) * 6, over = r(8) * 6;
    const m = [ax, az, ax + cos(ang) * len, az + sin(ang) * len, rad, -30 + r(7) * 24, over, r(9) * 3];
    if (hit(m[0], m[1], m[2], m[3], rad + over + 26)) mesas.push(m);
  }
  for (const m of ARCHES) if (hit(m[0], m[2], m[0], m[2], m[4] + m[5] + 26)) arches.push(m);
  for (let a = ci - 1; a <= ci + 1; a++) for (let b = cj - 1; b <= cj + 1; b++) {
    const r = (k) => ihash(a, b, 60 + k), x = (a + 0.15 + r(1) * 0.7) * CHK, z = (b + 0.15 + r(2) * 0.7) * CHK;
    if (r(0) > 0.3 || (abs(x) < HOME && abs(z) < HOME)) continue;
    const m = [x, -45 + r(3) * 5 - 2, z, r(4) * PI, 8 + r(5) * 6, 1.8 + r(6) * 1, 1.2];
    if (hit(x, z, x, z, m[4] + m[5] + 26)) arches.push(m);
  }
  for (const m of HOLES) if (hit(m[0], m[2], m[4], m[6], m[3] + 26)) holes.push(m);
  for (const m of CLEARS) if (hit(m[0], m[1], m[2], m[3], m[4] + m[5] + 26)) clears.push(m);
  const a = [];
  for (const m of mesas) a.push(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7]);
  for (const m of arches) a.push(m[0], m[1], m[2], m[3], m[4], m[5], m[6], 0);
  for (const m of holes) a.push(m[0], m[1], m[2], m[3], m[4], m[5], m[6], 0);
  for (const m of clears) a.push(m[0], m[1], m[2], m[3], m[4], m[5], 0, 0);
  return { data: new Float32Array(a.length ? a : [0, 0, 0, 0]), n: [mesas.length, arches.length, holes.length, clears.length] };
}

// ---------------------------------------------------------------- terrain mesh from a chunk's density grid
// Returns the vertex/index buffers (indices sorted into the chunk's culling cells) plus the data the generators need.
function* buildTerrain(D, ci, cj) {
  const gx0 = ci * CHK - MG * VS, gz0 = cj * CHK - MG * VS, X0 = ci * CHK, Z0 = cj * CHK;
  const sn = yield* surfaceNets(D, GN, NY, GN, MG, MG + CVX, MG, MG + CVX);
  // only the vertices the owned quads use
  const map = new Int32Array(sn.nv).fill(-1); let nv = 0;
  for (let i = 0; i < sn.ni; i++) if (map[sn.idx[i]] < 0) map[sn.idx[i]] = nv++;
  const gp = new Float32Array(nv * 3);
  for (let k = 0; k < sn.nv; k++) { const m = map[k]; if (m >= 0) { gp[m * 3] = sn.pos[k * 3]; gp[m * 3 + 1] = sn.pos[k * 3 + 1]; gp[m * 3 + 2] = sn.pos[k * 3 + 2]; } }
  const smp = sampler3(D, GN, NY, GN);
  const vb = new ArrayBuffer(nv * 16), vf = new Float32Array(vb), v8 = new Int8Array(vb);
  const wp = new Float32Array(nv * 3), wn = new Float32Array(nv * 3), core = [];
  for (let k = 0; k < nv; k++) {
    if (!(k & 4095)) yield;
    const x = gp[k * 3], y = gp[k * 3 + 1], z = gp[k * 3 + 2], e = 0.8;
    let nx = smp(x - e, y, z) - smp(x + e, y, z), ny = smp(x, y - e, z) - smp(x, y + e, z), nz = smp(x, y, z - e) - smp(x, y, z + e);
    const l = hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const X = gx0 + x * VS, Y = OY + y * VS, Z = gz0 + z * VS;
    wp[k * 3] = vf[k * 4] = X; wp[k * 3 + 1] = vf[k * 4 + 1] = Y; wp[k * 3 + 2] = vf[k * 4 + 2] = Z;
    wn[k * 3] = nx; wn[k * 3 + 1] = ny; wn[k * 3 + 2] = nz;
    v8[k * 16 + 12] = round(nx * 127); v8[k * 16 + 13] = round(ny * 127); v8[k * 16 + 14] = round(nz * 127); v8[k * 16 + 15] = 127;
    if (X >= X0 && X < X0 + CHK && Z >= Z0 && Z < Z0 + CHK) core.push(k * 3);
  }
  // bucket quads into the chunk's XZ culling grid
  const nq = sn.ni / 6, key = new Uint8Array(nq), cnt = new Uint32Array(CELLS * CELLS + 1);
  const lo = new Float32Array(CELLS * CELLS).fill(1e9), hi = new Float32Array(CELLS * CELLS).fill(-1e9);
  for (let q = 0; q < nq; q++) {
    const a = map[sn.idx[q * 6]] * 3;
    const c = clamp(floor((wp[a] - X0) / CELLW), 0, CELLS - 1) + CELLS * clamp(floor((wp[a + 2] - Z0) / CELLW), 0, CELLS - 1);
    key[q] = c; cnt[c + 1]++;
    for (let j = 0; j < 6; j++) { const y = wp[map[sn.idx[q * 6 + j]] * 3 + 1]; if (y < lo[c]) lo[c] = y; if (y > hi[c]) hi[c] = y; }
  }
  for (let c = 0; c < CELLS * CELLS; c++) cnt[c + 1] += cnt[c];
  const ib = new Uint32Array(sn.ni), fill = cnt.slice();
  for (let q = 0; q < nq; q++) { const o = fill[key[q]]++ * 6; for (let j = 0; j < 6; j++) ib[o + j] = map[sn.idx[q * 6 + j]]; }
  return { vb, ib, nv, wp, wn, smp, start: cnt, lo, hi, core: Uint32Array.from(core) };
}

// Distance to the rock for collide(), in 1/127 m (> 0 in rock, clamped to +-1 m), kept only in the 4x4x4-voxel bricks near
// the surface. CI per brick (BX x BY x BX): 0 all water, 1 all rock, n brick n-2 in CG.
const BX = CVX / 4, BY = NY / 4, CGS = new Int8Array(64 * BX * BX * BY);
function* buildCollide(D) {
  const CI = new Uint16Array(BX * BX * BY), S = GN * NY; let n = 0;
  for (let bz = 0; bz < BX; bz++) {
    yield;
    for (let by = 1; by < BY - 1; by++) for (let bx = 0; bx < BX; bx++) {
      let lo = 127, hi = -127;
      for (let z = 0; z < 4; z++) for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const i = MG + bx * 4 + x + GN * (by * 4 + y + NY * (MG + bz * 4 + z)), gz = D[i + S] - D[i - S];
        const gx = D[i + 1] - D[i - 1], g = D[i + GN] - D[i - GN], l = sqrt(gx * gx + g * g + gz * gz) / 1.5;
        const q = round(clamp(D[i] / max(l, 0.05), -1, 1) * 127);
        CGS[n * 64 + x + 4 * y + 16 * z] = q; if (q < lo) lo = q; if (q > hi) hi = q;
      }
      CI[bx + BX * (by + BY * bz)] = lo === hi && lo * lo === 16129 ? +(lo > 0) : (n++, n + 1);
    }
  }
  return { CI, CG: CGS.slice(0, n * 64) };
}

// ---------------------------------------------------------------- instance stores
// Everything that lives in chunk (ci, cj): instances are placed on the chunk's own surface vertices, from random streams
// seeded by the chunk, so a chunk that is dropped and met again comes back identical. The designed content of the start
// area (hand-placed lists, set pieces) is made by whichever chunk it lies in.
function* makeChunk(D, T, ci, cj) {
  const gx0 = ci * CHK - MG * VS, gz0 = cj * CHK - MG * VS, X0 = ci * CHK, Z0 = cj * CHK, X1 = X0 + CHK, Z1 = Z0 + CHK;
  const gi = (x, y, z) => x + GN * (y + NY * z);
  const smp = T.smp;
  const Dw = (x, y, z) => smp((x - gx0) / VS, (y - OY) / VS, (z - gz0) / VS);
  const nCells = CELLS * CELLS;
  const cellOf = (x, z) => clamp(floor((x - X0) / CELLW), 0, CELLS - 1) + CELLS * clamp(floor((z - Z0) / CELLW), 0, CELLS - 1);
  const inC = (x, z) => x >= X0 && x < X1 && z >= Z0 && z < Z1;
  const cs = (n) => rseed(Math.imul(n, 73856093) ^ Math.imul(ci, 19349663) ^ Math.imul(cj, 83492791));
  const AREA = CHK * CHK / (PI * 170 * 170); // the counts below were made for a disc of 170 m
  const near = (x, z, r) => (p) => abs(p[0] - x) < r && abs(p[2] - z) < r;
  const fly = flyPts.filter(near(X0 + CHK / 2, Z0 + CHK / 2, CHK / 2 + 12)), poses = POSES.filter(near(X0 + CHK / 2, Z0 + CHK / 2, CHK / 2 + 12));
  const core = T.core, nCore = core.length;
  const big = Array.from({ length: nCells }, () => []), small = Array.from({ length: nCells }, () => []);
  // Medium and Low keep every 2nd / 4th leaf (but every kelp stem), made wider; the random stream is the same
  let nth = 0;
  const leaf = (L, x, y, z, len, yaw, tilt, wid, hA, type, s1, s2, bend) => { if (type === 1 || !(nth++ % THIN)) L[cellOf(x, z)].push(x, y, z, len, yaw, tilt, type === 1 ? wid : wid * (1 + LV / 2), hA, type, s1, s2, bend); };
  const glint = (...a) => { nth++ % THIN || glints.push(...a); };
  const solids = []; // per mesh id: arrays of 12 floats
  const props = Array.from({ length: 6 }, () => Array.from({ length: nCells }, () => []));
  const solid = (mesh, x, y, z, sc, q, mat, seed, ts = 1, bob = 0) => { (mesh > 3 && mesh < 10 ? props[mesh - 4][cellOf(x, z)] : (solids[mesh] ||= [])).push(x, y, z, sc, q[0], q[1], q[2], q[3], mat, seed, ts, bob); };
  const chunks = Array.from({ length: NCHUNK }, () => Array.from({ length: nCells }, () => []));
  const glints = [];
  const rel = (i, f, r) => { const p = POSES[i]; let fx = p[3] - p[0], fz = p[5] - p[2]; const l = hypot(fx, fz); fx /= l; fz /= l; return [p[0] + fx * f - fz * r, p[2] + fz * f + fx * r]; };
  const bubbles = [], kelpAbs = new Float32Array(GN / 2 * (NY / 2) * (GN / 2));

  // --- surface queries
  const fl = [];
  const floorsAt = (x, z) => {
    const ix = clamp(round((x - gx0) / VS), 1, GN - 2), iz = clamp(round((z - gz0) / VS), 1, GN - 2);
    fl.length = 0; let ceil = 3;
    for (let gy = NY - 2; gy >= 0; gy--) {
      const d = D[gi(ix, gy, iz)], da = D[gi(ix, gy + 1, iz)];
      if (da <= 0 && d > 0) { const y = OY + (gy + d / (d - da)) * VS; fl.push(y, min(ceil, 0) - y); } else if (da > 0 && d <= 0) ceil = OY + (gy + 0.5) * VS;
    }
    return fl;
  };
  const grad = (x, y, z) => {
    const e = 0.6; let nx = Dw(x - e, y, z) - Dw(x + e, y, z), ny = Dw(x, y - e, z) - Dw(x, y + e, z), nz = Dw(x, y, z - e) - Dw(x, y, z + e);
    const l = hypot(nx, ny, nz) || 1; return [nx / l, ny / l, nz / l];
  };
  // march from outside along -n to the surface
  const snap = (x, y, z, n) => {
    let px = x + n[0] * 2.5, py = y + n[1] * 2.5, pz = z + n[2] * 2.5, prev = Dw(px, py, pz);
    if (prev > 0) return null;
    for (let i = 0; i < 24; i++) {
      const qx = px - n[0] * 0.25, qy = py - n[1] * 0.25, qz = pz - n[2] * 0.25, d = Dw(qx, qy, qz);
      if (d > 0) { const t = prev / (prev - d); const p = [mix(px, qx, t), mix(py, qy, t), mix(pz, qz, t)]; return p.concat(grad(p[0], p[1], p[2])); }
      px = qx; py = qy; pz = qz; prev = d;
    }
    return null;
  };
  const pickV = () => core[(rnd() * nCore) | 0];
  const tangent = (n) => { let t = abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [1, 0, 0]; const l = hypot(...t); t = t.map((v) => v / l); return [t, [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]]]; };
  const nearFly = (x, y, z, r) => { for (const p of fly) if (hypot(x - p[0], z - p[2]) < r && y < p[1] + 3 && y > p[1] - 13) return true; return false; };
  const nearPose = (x, z, r = 3) => { for (const p of poses) if (hypot(x - p[0], z - p[2]) < r) return true; return false; };
  // --- kelp columns
  const column = (x, y, z, H, kind, dens = 1) => {
    const strands = 2 + (rnd() < 0.6) + (rnd() < 0.3), ph = rnd() * TAU, tw = rr(0.1, 0.28), sr = rr(0.2, 0.55), sc = rr(0.75, 1.25);
    const la = rnd() * TAU, lm = rr(0, 0.11), full = rr(0.55, 1.3) * dens;
    const stem = (s, h) => { const a = ph + s * TAU / strands + h * tw, r = sr * (1 - 0.6 * h / H), ln = lm * h * h / H; return [x + cos(a) * r + cos(la) * ln, z + sin(a) * r + sin(la) * ln, a]; };
    for (let s = 0; s < strands; s++) for (let h = 0; h < H - 1; h += 1.7) { const p = stem(s, h); leaf(big, p[0], y + h, p[1], 2.1, p[2] + PI / 2, 0.1, 0.17, h, 1, rnd(), rnd(), 0.3); }
    const n = floor(H * 30 * full);
    for (let i = 0; i < n; i++) {
      const t = pow(rnd(), 0.9), h = t * H, p = stem((rnd() * strands) | 0, h);
      const L = ((0.55 + 0.75 * rnd() * rnd()) * (1 - 0.5 * t * t) * sc + 0.25) * (kind === 1 ? 1.25 : 1.15);
      const tilt = mix(rr(0.4, 1.0), rr(0.15, 0.45), t);
      const type = kind === 1 ? (rnd() < 0.8 ? 3 : 4) : kind === 2 ? (rnd() < 0.5 ? 4 : 0) : 0;
      leaf(big, p[0], y + h, p[1], L, rnd() * TAU, tilt, L * (kind === 1 ? rr(0.09, 0.13) : rr(0.15, 0.21)) + 0.03, h, type, rnd(), rnd(), rr(0.38, 0.95));
    }
    for (let i = floor(H * (kind === 1 ? 16 : 13)); i > 0; i--) { const h = rnd() * H, a = rnd() * TAU, r = rr(0.15, 0.8) * (1 - 0.5 * h / H), ln = lm * h * h / H; glint(x + cos(a) * r + cos(la) * ln, y + h, z + sin(a) * r + sin(la) * ln, h, rnd(), kind === 1 ? rnd() : rnd() * 0.6, rr(0.018, 0.05), 0); }
    // light absorption footprint for the skylight bake
    const hx = round((x - gx0) / VS / 2), hz = round((z - gz0) / VS / 2);
    for (let hy = floor((y - OY) / VS / 2); hy <= floor((y + H - OY) / VS / 2); hy++) {
      if (hy >= 0 && hy < NY / 2 && hx > 0 && hx < GN / 2 - 1 && hz > 0 && hz < GN / 2 - 1) kelpAbs[hx + GN / 2 * (hy + NY / 2 * hz)] += 0.17;
    }
  };
  const KELPZ = [[-32, -5, 13, 0.85], [0, -86, 46, 1], [72, -26, 27, 0.9], [-60, -4, 11, 0.8], [0, -36, 12, 0.55], [-17, -8, 6, 0.8], [15, -8, 6, 0.8], [-4, 120, 20, 0.4], [-45, -63, 15, 0.9], [62, -26, 12, 0.9], [-100, 70, 30, 0.8], [100, 60, 30, 0.8], [-95, -90, 32, 0.8], [105, -85, 30, 0.7]];
  const NOKELP = [[-5, -106.5, 8], [4.6, -109.4, 10], [14.2, -112.3, 12], [-26, -100, 6], [-20.5, -101.7, 4.5], [-14.8, -104.5, 6], [-7.5, -107.8, 7], [4, 112, 11], [2, 4, 15], [42, 22, 12], [6, 78, 19], [-58, -16, 8], [9, -66, 9], [8, -76, 8]];
  const kelpDens = (x, z) => {
    for (const p of NOKELP) if (hypot(x - p[0], z - p[1]) < p[2]) return 0;
    let d = sstep(0.52, 0.64, fbm(x * 0.022, 4, z * 0.022, 3)) * 0.5;
    for (const p of KELPZ) d = max(d, p[3] * sstep(p[2], p[2] * 0.75, hypot(x - p[0], z - p[1])));
    return d;
  };
  const occ = new Set();
  cs(1);
  const tryColumn = (x, z, kind, force, dens = 1) => {
    const key = floor(x / 2.3) * 4096 + floor(z / 2.3);
    if (occ.has(key)) return;
    const f = floorsAt(x, z); const c = [];
    for (let i = 0; i < f.length; i += 2) if (f[i + 1] > 9) c.push(i);
    if (!c.length) return;
    const i = c[(rnd() * c.length) | 0], y = f[i];
    if (grad(x, y, z)[1] < 0.55) return;
    if (!force && fly.some((p) => hypot(x - p[0], z - p[2]) < 5)) return;
    occ.add(key);
    column(x, y - 0.3, z, min(f[i + 1] - rr(0.8, 5), force ? rr(30, 42) : rr(15, 40)), kind, dens);
  };
  // hand-placed columns framing the viewpoints: x, z, kind, density
  for (const p of [[...rel(0, 11, -8.5), 0], [...rel(0, 16, -10.5), 0], [...rel(0, 21, -9), 0], [...rel(0, 9, 7), 0], [...rel(0, 14, 9.5), 0], [...rel(0, 19, 8), 0], [...rel(0, 26, 6), 0],
    [...rel(5, 6.5, 5.2), 1], [...rel(5, 12, 7), 1], [...rel(5, 15, -8), 0], [...rel(5, 22, -5), 1], [...rel(3, 12, -5.5), 0], [...rel(3, 16, 5.5), 0], [...rel(3, 20, -4.5), 0], [...rel(3, 25, 6), 0], [...rel(3, 13, 8), 0], [...rel(3, 30, -7), 0], [24, 62, 1], [-6, 96, 1], [20, 96, 2], [-10, 70, 0], [16, 52, 1],
    [...rel(4, 15, -9), 0, 1.2], [...rel(4, 19, -13), 0, 1.2], [...rel(4, 23, -8.5), 0, 1.2], [...rel(4, 25, -15), 0, 1.2],
    [...rel(4, 25, 0.5), 2, 1.2], [...rel(4, 27, -3), 2, 1.2], [...rel(4, 28, 3.5), 2, 1.2], [...rel(4, 31, 0), 0, 1.3], [...rel(4, 33, -5), 0, 1.3], [...rel(4, 33, 5), 0, 1.3], [...rel(4, 21, 9), 0, 1.2], [...rel(4, 27, 11), 0, 1.2],
    [...rel(2, 6.5, -5.5), 0, 1.5], [...rel(2, 9.5, -8), 0, 1.3], [...rel(2, 8, 6), 0, 1.4], [...rel(2, 12, 3.6), 0, 1.3], [...rel(2, 17, -2.5), 0, 1.2], [...rel(2, 21, 4), 0, 1.2], [...rel(2, 12, -4.5), 2, 1.2], [...rel(2, 27, -9), 0, 1.2], [...rel(2, 30, 8.5), 0, 1.2], [...rel(2, 37, -3), 0, 1.1],
    [...rel(2, 13.5, 6.5), 0, 1.3], [...rel(2, 14.5, -7), 0, 1.3], [...rel(2, 6.5, 6.5), 0, 1.3], [...rel(2, 9, -8), 2, 1.3]]) if (inC(p[0], p[1])) tryColumn(p[0], p[1], p[2], true, p[3]);
  // random columns across the world
  cs(2);
  for (let i = 0; i < 15000 * AREA; i++) {
    if (!(i & 255)) yield;
    const x = X0 + rnd() * CHK, z = Z0 + rnd() * CHK;
    if (rnd() < kelpDens(x, z)) tryColumn(x, z, zoneP(x, z) > 0.5 && rnd() < 0.5 ? 1 : rnd() < 0.03 ? 2 : 0);
  }

  // --- clusters of ribbon leaves on the ground
  const cluster = (x, y, z, n, type, lmin, lmax, wmin, wmax, tmax, sway) => {
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, r = rnd() * 0.5, L = rr(lmin, lmax);
      leaf(big, x + cos(a) * r, y - 0.15, z + sin(a) * r, L, a, rr(0.05, tmax), rr(wmin, wmax), sway, type, rnd(), rnd(), rr(0.3, 0.8));
    }
  };
  const HOT = [[0, 5, 30], [42, 30, 24], [6, 82, 34], [-58, 10, 24], [4, -88, 30], [-36, 44, 18], [-46, -60, 20]];
  const hot = (x, z) => { let h = 0.4; for (const p of HOT) h = max(h, sstep(p[2], p[2] * 0.4, hypot(x - p[0], z - p[1]))); return h; };
  cs(3);
  for (let i = 0; i < 40000 * AREA && nCore; i++) {
    if (!(i & 1023)) yield;
    const k = pickV(), x = T.wp[k], y = T.wp[k + 1], z = T.wp[k + 2], ny = T.wn[k + 1];
    if (y > -6) continue;
    const h = hot(x, z), zp = zoneP(x, z), u = rnd();
    if (nearFly(x, y, z, 4) || hypot(x + 1, z - 2) < 9 || nearPose(x, z, 8)) continue;
    if (ny > 0.75 && u < 0.10 * h) cluster(x, y, z, 8 + rnd() * 14 | 0, 2, 1.0, 3.0, 0.13, 0.26, 0.6, 2.5);
    else if (ny > 0.6 && u < 0.10 * h + 0.07 * max(zp, h * 0.4)) cluster(x, y, z, 10 + rnd() * 18 | 0, rnd() < 0.8 ? 3 : 4, 0.9, 2.6, 0.14, 0.28, 0.9, 1.5);
    else if (ny < -0.35 && u < 0.5 * max(zp, 0.2)) { // hanging fronds
      const n = 12 + rnd() * 20 | 0;
      for (let j = 0; j < n; j++) leaf(big, x + rr(-0.6, 0.6), y + 0.2, z + rr(-0.6, 0.6), rr(0.8, 3.2), rnd() * TAU, PI - rr(0, 0.4), rr(0.08, 0.18), 0, zp > 0.3 || rnd() < 0.5 ? 6 : 0, rnd(), rnd(), rr(0.3, 0.6));
    } else if (ny > -0.2 && ny < 0.8 && u < 0.07) { // wall tufts
      const yaw = atan2(T.wn[k + 2], T.wn[k]), n = 5 + rnd() * 7 | 0;
      for (let j = 0; j < n; j++) leaf(big, x, y, z, rr(0.5, 1.4), yaw + rr(-0.9, 0.9), rr(0.3, 1.1), rr(0.06, 0.12), 0.5, zp > 0.4 && rnd() < 0.6 ? 3 : 0, rnd(), rnd(), rr(0.2, 0.6));
    }
  }
  // --- ground cover: dense carpets of small tufts in the magenta patches
  cs(4);
  for (const p of MAGENTA) for (let i = p[0] + p[2] < X0 || p[0] - p[2] >= X1 || p[1] + p[2] < Z0 || p[1] - p[2] >= Z1 ? 0 : p[2] * p[2] * PI * 45; i > 0; i--) {
    if (!(i & 1023)) yield;
    const a = rnd() * TAU, r = sqrt(rnd()) * p[2], x = p[0] + cos(a) * r, z = p[1] + sin(a) * r;
    if (rnd() > magAt(x, z) + 0.12 || !inC(x, z) || nearPose(x, z)) continue;
    const f = floorsAt(x, z); if (!f.length) continue;
    const y = f[f.length - 2]; if (grad(x, y, z)[1] < 0.7) continue;
    const nl = 2 + (rnd() * 3 | 0), yw = rnd() * TAU;
    for (let j = 0; j < nl; j++) leaf(small, x, y - 0.03, z, rr(0.08, 0.26), yw + j * TAU / nl + rr(-0.4, 0.4), rr(0.15, 0.85), rr(0.035, 0.07), 0, 5, rnd(), rnd(), rr(0.3, 0.7));
    if (rnd() < 0.3) for (let j = 0; j < 2; j++) leaf(small, x + rr(-0.2, 0.2), y - 0.04, z + rr(-0.2, 0.2), rr(0.2, 0.55), rnd() * TAU, rr(0.05, 0.6), rr(0.03, 0.06), 0, 7, rnd(), rnd(), rr(0.3, 0.8));
    if (rnd() < 0.3) glint(x, y + rr(0.08, 0.22), z, 0, rnd(), 0.82 + rnd() * 0.18, rr(0.01, 0.02), 0);
  }
  cs(5);
  for (let i = 0; i < 620000 * AREA && nCore; i++) {
    if (!(i & 1023)) yield;
    const k = pickV(), ny = T.wn[k + 1];
    if (ny < 0.72) continue;
    const x = T.wp[k] + rr(-0.45, 0.45), z = T.wp[k + 2] + rr(-0.45, 0.45), y = T.wp[k + 1];
    if (nearPose(x, z)) continue;
    const m = magAt(x, z), zp = zoneP(x, z), u = rnd();
    if (m > 0.3 && u < m * 0.9) for (let j = 0; j < 4; j++) leaf(small, x + rr(-0.1, 0.1), y - 0.05, z + rr(-0.1, 0.1), rr(0.12, 0.34), rnd() * TAU, rr(0.05, 0.75), rr(0.04, 0.08), 0, 5, rnd(), rnd(), rr(0.3, 0.7));
    else if (u < m * 0.9 + 0.5 * max(zp, hot(x, z)) * sstep(0.42, 0.6, fbm(x * 0.09, 9, z * 0.09, 2))) for (let j = 0; j < 3; j++) leaf(small, x + rr(-0.1, 0.1), y - 0.05, z + rr(-0.1, 0.1), rr(0.25, 0.7), rnd() * TAU, rr(0.1, 0.8), rr(0.05, 0.1), 0, 7, rnd(), rnd(), rr(0.3, 0.8));
  }

  // --- sponges and coral (clustered on rock)
  const spots = [];
  const ZS = [[-58, 8, 30, 1], [0, 0, 30, 0.7], [6, 84, 36, 0.9], [4, -88, 22, 0.6], [44, 20, 24, 0.5]];
  const zw = (x, z) => { let h = 0.45; for (const p of ZS) h = max(h, p[3] * sstep(p[2], p[2] * 0.4, hypot(x - p[0], z - p[1]))); return h; };
  cs(6);
  for (let i = 0; i < 13000 * AREA && nCore; i++) {
    if (!(i & 1023)) yield;
    const k = pickV(), x = T.wp[k], y = T.wp[k + 1], z = T.wp[k + 2];
    if (y > -8 || T.wn[k + 1] < -0.15 || rnd() > zw(x, z) || nearFly(x, y, z, 3)) continue;
    const n0 = [T.wn[k], T.wn[k + 1], T.wn[k + 2]], [t1, t2] = tangent(n0), coral = T.wn[k + 1] > 0.85 || rnd() < 0.35, cnt = coral ? 2 + rnd() * 5 | 0 : 3 + rnd() * 9 | 0, sd = rnd();
    for (let j = 0; j < cnt; j++) {
      const a = rr(-1, 1) * (0.5 + cnt * 0.13), b = rr(-1, 1) * (0.5 + cnt * 0.13);
      const s = snap(x + t1[0] * a + t2[0] * b, y + t1[1] * a + t2[1] * b, z + t1[2] * a + t2[2] * b, n0);
      if (!s) continue;
      let ux = s[3], uy = s[4] + (coral ? 0.9 : 1.1), uz = s[5]; const l = hypot(ux, uy, uz); ux /= l; uy /= l; uz /= l;
      const q = qMul(qFromY(ux, uy, uz), qAxis(0, 1, 0, rnd() * TAU)), sc = coral ? rr(0.5, 1.5) : rr(0.35, 0.9) * (rnd() < 0.1 ? 1.6 : 1);
      solid(coral ? 7 + (rnd() * 3 | 0) : 4 + (rnd() * 3 | 0), s[0] - ux * 0.12 * sc, s[1] - uy * 0.12 * sc, s[2] - uz * 0.12 * sc, sc, q, coral ? 5 : 4, fract(sd + rr(-0.03, 0.03)), 1, 0);
    }
    if (!coral && rnd() < 0.3) spots.push([x + n0[0], y + n0[1] + 0.5, z + n0[2]]);
  }

  // dense sponge / coral gardens: x, z, radius, count
  cs(7);
  for (const g of [[-68, -6, 9, 260], [-66, 6, 7, 160], [16, 72, 7, 200], [-6, 74, 6, 120], [-13, -2, 6, 80], [8, -88, 8, 160], [44, 12, 7, 120], [-62, 22, 6, 140], [-47, 40, 6, 140], [-30, 47, 6, 120], [-12, 48, 5, 100], [14, 28, 6, 140], [28, 45, 6, 120], [-36, -76, 6, 130], [-49, -58, 6, 130], [-58, -38, 6, 120]]) {
    // the share of the garden's disc that lies in this chunk, and the surface vertices in it
    let dn = 0, cn = 0;
    for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) { const x = g[0] + (a / 7.5 - 1) * g[2], z = g[1] + (b / 7.5 - 1) * g[2]; if (hypot(x - g[0], z - g[1]) <= g[2]) { dn++; if (inC(x, z)) cn++; } }
    if (!cn) continue;
    const cand = [];
    for (let q = 0; q < nCore; q++) { const k = core[q]; if (hypot(T.wp[k] - g[0], T.wp[k + 2] - g[1]) <= g[2] && T.wp[k + 1] <= -14 && T.wn[k + 1] >= -0.1) cand.push(k); }
    yield;
    let made = 0;
    for (let i = 0; i < 60000 && made < round(g[3] * cn / dn) && cand.length; i++) {
      const k = cand[(rnd() * cand.length) | 0], x = T.wp[k], y = T.wp[k + 1], z = T.wp[k + 2];
      if (nearFly(x, y, z, 2.2)) continue;
      made++;
      const coral = T.wn[k + 1] > 0.85 || rnd() < 0.3, nx = T.wn[k], ny = T.wn[k + 1] + (coral ? 0.9 : 1.1), nz = T.wn[k + 2], l = hypot(nx, ny, nz);
      const sc = coral ? rr(0.5, 1.4) : rr(0.35, 0.9) * (rnd() < 0.15 ? 1.7 : 1);
      solid(coral ? 7 + (rnd() * 3 | 0) : 4 + (rnd() * 3 | 0), x - nx / l * 0.1 * sc, y - ny / l * 0.1 * sc, z - nz / l * 0.1 * sc, sc, qMul(qFromY(nx / l, ny / l, nz / l), qAxis(0, 1, 0, rnd() * TAU)), coral ? 5 : 4, rnd(), 1, 0);
    }
  }
  // --- rocks: floating boulder clusters + scattered ground rocks
  const BOULD = [[-11, -11, -105, 14, 5], [-56, -19, -18, 18, 6], [10, -13, -88, 22, 7], [24, -15, -24, 22, 7], [-18, -12, 4, 14, 6], [30, -14, 30, 16, 6], [36, -12, -70, 22, 8], [-30, -13, -84, 16, 7], [-58, -14, 0, 14, 6], [19, -13, 98, 18, 6], [62, -9, 34, 14, 6]];
  // each rock has a stream of its own, so every chunk a cluster reaches makes the same rocks
  const boulders = (b, bi) => {
    for (let i = 0; i < b[3]; i++) {
      rseed(9000 + bi * 64 + i);
      const sc = rnd() < 0.12 ? rr(1.8, 3.2) : rr(0.35, 1.5);
      const x = b[0] + rr(-1, 1) * b[4], y = b[1] + rr(-1, 1) * b[4] * 0.6, z = b[2] + rr(-1, 1) * b[4];
      if (!inC(x, z) || Dw(x, y, z) > -sc) continue;
      const bob = rr(0.12, 0.4), sd = rnd();
      solid(rnd() * 4 | 0, x, min(y, -2 - sc), z, sc, qRand(), 1, sd, 1, bob);
      if (sc > 1.1) for (let j = 0; j < 7; j++) { const sx = x + rr(-1.6, 1.6) * sc, sz = z + rr(-1.6, 1.6) * sc; if (inC(sx, sz)) solid(rnd() * 4 | 0, sx, min(y, -2 - sc) + rr(-1.4, 1) * sc, sz, rr(0.1, 0.35), qRand(), 1, sd, 1, bob); }
    }
  };
  BOULD.forEach((b, bi) => { if (b[0] + b[4] + 6 >= X0 && b[0] - b[4] - 6 < X1 && b[2] + b[4] + 6 >= Z0 && b[2] - b[4] - 6 < Z1) boulders(b, bi); });
  cs(8);
  if (rnd() < 9 * AREA * 4) boulders([X0 + rr(16, CHK - 16), rr(-20, -9), Z0 + rr(16, CHK - 16), 10 + rnd() * 12 | 0, rr(5, 9)], 100 + ((ci * 31 + cj) & 255));
  cs(9);
  for (let i = 0; i < 2600 * AREA && nCore; i++) {
    const k = pickV(); if (T.wn[k + 1] < 0.7 || nearFly(T.wp[k], T.wp[k + 1], T.wp[k + 2], 6)) continue;
    const sc = rr(0.25, 1.3) * (rnd() < 0.1 ? 2 : 1);
    solid(rnd() * 4 | 0, T.wp[k], T.wp[k + 1] + sc * 0.2, T.wp[k + 2], sc, qRand(), 1, rnd(), 1, 0);
  }

  cs(10);
  for (let i = 0; i < 60000 * AREA && nCore; i++) {
    if (!(i & 1023)) yield;
    const k = pickV(), x = T.wp[k], y = T.wp[k + 1], z = T.wp[k + 2], ny = T.wn[k + 1];
    if (y > -3 || (ny > 0.8 && rnd() < 0.6) || nearFly(x, y, z, 3.5)) continue;
    const sc = (0.35 + 2.1 * pow(rnd(), 2.6)) * (ny > 0.8 ? 0.5 : 1), q = qRand();
    chunks[(sc > 1.15 ? 3 : 0) + (rnd() * 3 | 0)][cellOf(x, z)].push(x - T.wn[k] * sc * 0.3, y - ny * sc * 0.3, z - T.wn[k + 2] * sc * 0.3, sc, q[0], q[1], q[2], q[3], 1, rnd(), sc > 1.15 ? 0 : 96, 0);
  }
  cs(11);
  for (let i = 0; i < 170000 * AREA && nCore; i++) { // pebbles and rubble on the sea floor
    if (!(i & 1023)) yield;
    const k = pickV(), x = T.wp[k] + rr(-0.4, 0.4), z = T.wp[k + 2] + rr(-0.4, 0.4), y = T.wp[k + 1];
    if (T.wn[k + 1] < 0.8 || nearFly(x, y, z, 1.3)) continue;
    const sc = 0.05 + 0.3 * pow(rnd(), 2), q = qRand();
    nth++ % THIN || chunks[6][cellOf(x, z)].push(x, y - sc * 0.25, z, sc, q[0], q[1], q[2], q[3], 1, rnd(), 44, 0);
  }
  // --- set pieces
  const gy = (x, z) => { const f = floorsAt(x, z); return f.length ? f[f.length - 2] : -45; };
  if (inC(-5, -4)) solid(10, -5, gy(-5, -4) - 0.6, -4, 1, qMul(qAxis(0, 1, 0, 1.2), qMul(qAxis(0, 0, 1, 0.16), qAxis(1, 0, 0, -0.3))), 2, 0.3, 1, 0);          // whale fluke
  if (inC(59.5, 6)) solid(11, 59.5, -23, 6, 1, qMul(qAxis(0, 1, 0, -PI / 2), qMul(qAxis(0, 0, 1, -0.1), qAxis(1, 0, 0, 0.32))), 3, 0.5, 1, 0); // ship hull
  // barrel sponges in front of viewpoint 4, small sponges around the fluke base
  cs(12);
  if (inC(-5, -4)) for (const b of [[7, 3.2, 1.3, 4], [8.4, 4.6, 1.0, 6], [9.6, 2.6, 1.5, 4], [11, 5, 1.1, 5], [8, -3.6, 1.2, 4], [12.5, 2, 1.2, 6], [9, 3.9, 0.8, 4]]) { const p = rel(3, b[0], b[1]), c = POSES[3]; let ux = (c[0] - p[0]) * 0.07, uz = (c[2] - p[1]) * 0.07; const l = hypot(ux, 1, uz); solid(b[3], p[0], gy(p[0], p[1]) - 0.1, p[1], b[2], qFromY(ux / l, 1 / l, uz / l), 4, rnd(), 1, 0); }
  if (inC(-5, -4)) for (let i = 0; i < 9; i++) { const a = rnd() * TAU; const x = -5 + cos(a) * rr(1.2, 2.6), z = -4 + sin(a) * rr(1.5, 4); solid(6, x, gy(x, z) + 0.05, z, rr(0.4, 0.9), qAxis(0, 1, 0, rnd() * 6), 4, rnd(), 1, 0); }

  // --- bubbles
  const VENTS = [[4, -44, -3], [4.5, -44, -3.5], [-1, -44, 2], [2, -44, -1], [5.5, -44, -7], [3, -44, -9], [6, -44, -90], [8, -44, -84], [4, -44, -93], [-9, -44, 3], [5, -35, -86], [9, -37, -92], [40, -44, 20], [-56, -44, 12], [10, -44, 80], [-2, -44, 30], [0, -44, -30], [12, -44, 2], [6, -44, -2], [46, -44, 30], [-20, -44, -103], [-52, -44, -12], [4, -44, 70], [9, -44, -74], [4, -44, -78], [14, -44, 26], [26, -44, 40], [-45, -44, -64], [-55, -44, -40], [-58, -44, 22], [-40, -44, 40], [-14, -44, 45], [-1, -44, -9], [-7, -44, -6]];
  cs(13);
  for (const s of spots) if (rnd() < 0.28) VENTS.push(s);
  for (const v of VENTS) {
    if (!inC(v[0], v[2])) continue;
    const n = 90 + rnd() * 70 | 0, y0 = v[1] === -44 ? gy(v[0], v[2]) : v[1];
    for (let i = 0; i < n; i++) {
      const sz = rnd() < 0.24 ? rr(0.1, 0.3) : rr(0.025, 0.08);
      bubbles.push(v[0] + rr(-0.3, 0.3), y0, v[2] + rr(-0.3, 0.3), sz, rnd(), rr(1.1, 2.4) * (0.6 + sz * 3), -y0 - 0.2, rr(0.05, 0.16));
    }
  }

  // --- pack leaves (36 bytes: 8 floats + 4 unorm8), sorted by culling cell
  const pack = (L, step = 1, wm = 1) => {
    let n = 0; const start = new Uint32Array(nCells + 1);
    for (let c = 0; c < nCells; c++) { start[c] = n; n += Math.ceil(L[c].length / 12 / step); }
    start[nCells] = n;
    const buf = new ArrayBuffer(n * 36), f = new Float32Array(buf), u8 = new Uint8Array(buf), lo = new Float32Array(nCells).fill(1e9), hi = new Float32Array(nCells).fill(-1e9);
    let k = 0;
    for (let c = 0; c < nCells; c++) { const a = L[c]; for (let i = 0; i < a.length; i += 12 * step, k++) {
      for (let j = 0; j < 8; j++) f[k * 9 + j] = a[i + j];
      f[k * 9 + 6] *= wm;
      u8[k * 36 + 32] = a[i + 8]; u8[k * 36 + 33] = a[i + 9] * 255; u8[k * 36 + 34] = a[i + 10] * 255; u8[k * 36 + 35] = a[i + 11] * 255;
      const y = a[i + 1], l = a[i + 3]; if (y - l < lo[c]) lo[c] = y - l; if (y + l > hi[c]) hi[c] = y + l;
    } }
    return { buf, n, start, lo, hi };
  };

  // --- half-res volume: r = openness, g = skylight. Worked out over the whole grid (so the blur crosses the chunk's edge),
  // then the core is cut out
  const hg = GN / 2, hy = NY / 2, hc = CVX / 2, volD = new Uint8Array(hc * hy * hc * 2);
  let Lp = new Float32Array(hg * hg).fill(1), Ln = new Float32Array(hg * hg), tmp = new Float32Array(hg * hg);
  for (let y = hy - 1; y >= 0; y--) {
    yield;
    for (let z = 0; z < hg; z++) for (let x = 0; x < hg; x++) { const i = x + hg * z; tmp[i] = (Lp[x > 0 ? i - 1 : i] + 2 * Lp[i] + Lp[x < hg - 1 ? i + 1 : i]) * 0.25; }
    for (let z = 0; z < hg; z++) for (let x = 0; x < hg; x++) {
      const i = x + hg * z, b = (tmp[z > 0 ? i - hg : i] + 2 * tmp[i] + tmp[z < hg - 1 ? i + hg : i]) * 0.25;
      const g0 = gi(x * 2, y * 2, z * 2);
      const d = (D[g0] + D[g0 + 1] + D[g0 + GN] + D[g0 + GN + 1] + D[g0 + GN * NY] + D[g0 + GN * NY + 1] + D[g0 + GN * NY + GN] + D[g0 + GN * NY + GN + 1]) * 0.125;
      const l = b * clamp(0.5 - d / 1.5, 0, 1) * (1 - min(kelpAbs[x + hg * (y + hy * z)], 0.5));
      Ln[i] = l;
      const cx = x - MG / 2, cz = z - MG / 2;
      if (cx >= 0 && cx < hc && cz >= 0 && cz < hc) { const o = cx + hc * (y + hy * cz); volD[o * 2] = clamp(0.5 - d / 12, 0, 1) * 255; volD[o * 2 + 1] = min(1, b) * 255; }
    }
    const t = Lp; Lp = Ln; Ln = t;
  }

  // --- ground map of the chunk: r magenta cover, b purple zone, a sand
  const gm = new Uint8Array(128 * 128 * 4);
  for (let j = 0; j < 128; j++) for (let i = 0; i < 128; i++) {
    const x = X0 + (i + 0.5) / 128 * CHK, z = Z0 + (j + 0.5) / 128 * CHK, o = (i + 128 * j) * 4;
    gm[o] = magAt(x, z) * 255; gm[o + 2] = zoneP(x, z) * 255; gm[o + 3] = sstep(0.42, 0.6, fbm(x * 0.04, 3, z * 0.04, 3)) * 255;
  }

  // --- fish schools + mantas
  const fish = [];
  cs(14);
  const SCH = [[-2, -36, -10, 15, 520, 0.3, 1, 0.945], [8, -30, -70, 22, 420, 0.32, -1], [48, -30, 14, 18, 360, 0.3, 1], [-58, -30, -8, 11, 420, 0.28, -1, 0.3], [8, -36, 84, 16, 320, 0.28, 1],
    [-90, -28, -70, 25, 300, 0.3, 1], [95, -30, 70, 25, 300, 0.3, -1], [0, -22, 20, 30, 380, 0.34, -1], [-30, -30, -100, 18, 300, 0.3, 1], [16, -36, 30, 12, 300, 0.3, 1], [-48, -34, -58, 12, 300, 0.3, -1], [-45, -35, 38, 14, 320, 0.3, 1]];
  // Swimmers follow fixed ovals (centre, radius R, z squashed by kz, wobbling +-wy up and down, about m metres wide), so
  // they stay out of the rock if their whole oval does. Hand-placed ones are moved up or down until it does.
  const ovalClear = (x, y, z, R, kz, wy, m) => {
    for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, px = x + R * cos(a), pz = z + R * kz * sin(a); for (const dy of [-wy, 0, wy]) if (Dw(px, y + dy, pz) > -m) return false; }
    return true;
  };
  const lift = (x, y, z, R, kz, wy, m) => { for (const dy of [0, 4, -4, 8, -8, 12, 16, -12]) if (y + dy < -5 && y + dy > -42 && ovalClear(x, y + dy, z, R, kz, wy, m)) return y + dy; return y; };
  // a free oval of radius R somewhere in the chunk (all of it inside the chunk's rock field), or null
  const place = (R, kz, wy, m, y0, y1) => {
    for (let t = 0; t < 16; t++) { const x = X0 + rr(R + 4, CHK - R - 4), z = Z0 + rr(R * kz + 4, CHK - R * kz - 4), y = rr(y0, y1); if (ovalClear(x, y, z, R, kz, wy, m)) return [x, y, z]; }
    return null;
  };
  const sch = SCH.filter((q) => inC(q[0], q[2])).map((q) => { q = q.slice(); q[1] = lift(q[0], q[1], q[2], q[3], 0.6, 2.2, 4.5); return q; });
  if (rnd() < 0.6) { const R = rr(12, 24), c = place(R, 0.6, 2.2, 4.5, -40, -24); if (c) sch.push([c[0], c[1], c[2], R, 260 + rnd() * 140 | 0, rr(0.28, 0.34), rnd() < 0.5 ? 1 : -1]); }
  for (const s of sch) { const ss = s[7] === undefined ? rnd() : s[7]; for (let i = 0; i < s[4]; i++) fish.push(s[0], s[1], s[2], s[3], rnd(), s[6] * 1.9 / s[3], s[5], ss); }
  const mantas = [];
  const MANTAS = [[1, -28, 3.5, 14, 3.012, 0.085, 3.6, 0.1], [49, -31, 24.5, 5, 0.029, -0.08, 3.7, 0.4], [0, -14, -80, 34, 0.3, 0.06, 5.2, 0.7], [-50, -18, 20, 26, 5, -0.075, 3.8, 0.55], [10, -16, 86, 26, 2.2, 0.07, 4.4, 0.85], [20, -11, -20, 46, 4.2, -0.045, 5.6, 0.25]];
  for (let m of MANTAS) if (inC(m[0], m[2])) { m = m.slice(); m[1] = lift(m[0], m[1], m[2], m[3], 0.75, 2.5, 5); mantas.push(...m); }
  // Moorish idols and butterflyfish: little groups that wander the reef, [x, y, z, radius, count, size, direction]
  const reef = [[], [], [], []];
  const grp = (k, R, cnt, size) => { const c = place(R, 0.6, 1.5, 2.5, -34, -16); if (c) { const dir = rnd() < 0.5 ? 1 : -1, sd = rnd(); for (let i = 0; i < cnt; i++) reef[k].push(c[0], c[1], c[2], R, rnd(), dir * 1.9 / R, size * rr(0.9, 1.15), sd); } };
  for (const q of [[0, -9, -33, -12, 7, 6, 0.26, 1], [1, 22, -33, -6, 6, 10, 0.2, -1], [1, -40, -32, 30, 7, 12, 0.2, 1], [0, 40, -33, 30, 8, 5, 0.26, -1]]) if (inC(q[1], q[3])) { const y = lift(q[1], q[2], q[3], q[4], 0.6, 1.5, 2.5), sd = rnd(); for (let i = 0; i < q[5]; i++) reef[q[0]].push(q[1], y, q[3], q[4], rnd(), q[7] * 1.9 / q[4], q[6] * rr(0.9, 1.15), sd); }
  for (const k of [2, 3]) if (rnd() < 0.55) grp(k, rr(4, 8), 1 + rnd() * 3 | 0, 0.3);
  if (rnd() < 0.5) grp(0, rr(6, 10), 4 + rnd() * 4 | 0, 0.26);
  if (rnd() < 0.6) grp(1, rr(5, 9), 8 + rnd() * 8 | 0, 0.2);
  // sea turtles glide in wide slow ovals: [species, x, y, z, radius, phase, speed, size, seed]
  const turtles = [[], [], []], SIZE = [1, 1.1, 0.95];
  for (const q of [[0, 14, -34, -28, 9, 1.2, 0.05, 1.1, 0.31], [2, 46, -32, 18, 8, 4, -0.055, 1, 0.62], [0, -30, -36, 22, 11, 2.5, -0.045, 1.2, 0.17], [1, 0, -26, -62, 22, 0.4, 0.03, 1.1, 0.88]]) if (inC(q[1], q[3])) turtles[q[0]].push(q[1], lift(q[1], q[2], q[3], q[4], 0.75, 1.5, 3.5), q[3], ...q.slice(4));
  if (rnd() < 0.45) {
    const k = rnd() < 0.45 ? 0 : rnd() < 0.55 ? 2 : 1, R = rr(12, 24), c = place(R, 0.75, 1.5, 3.5, -34, -12);
    if (c) turtles[k].push(c[0], c[1], c[2], R, rnd() * TAU, rr(0.025, 0.05) * (rnd() < 0.5 ? 1 : -1), SIZE[k] * rr(0.85, 1.25), rnd());
  }
  // blacktip reef sharks patrol wide ovals over the reef
  const sharks = [];
  for (let n = rnd() < 0.7 ? 1 + (rnd() < 0.4) : 0; n > 0; n--) { const R = rr(16, 36), c = place(R, 0.7, 1.8, 3.5, -36, -14); if (c) sharks.push(c[0], c[1], c[2], R, rnd() * TAU, rr(0.09, 0.14) * (rnd() < 0.5 ? 1 : -1), rr(0.9, 1.4), rnd()); }
  // dolphin pods and tuna groups: members share an oval (same speed) with small offsets, [x, y, z, R, phase, speed, size, seed]
  const dolphins = [], tunas = [];
  const crowd = (arr, n, R, c, speed, size) => { const ph = rnd() * TAU, sd = rnd(); for (let i = 0; i < n; i++) arr.push(c[0] + rr(-2.5, 2.5), c[1] + rr(-1.2, 1.2), c[2] + rr(-2.5, 2.5), R * rr(0.94, 1.06), ph + rr(-0.12, 0.12), speed, size * rr(0.85, 1.12), sd + i * 0.137); };
  for (let n = rnd() < 0.55 ? 1 : 0; n > 0; n--) { const R = rr(22, 40), c = place(R + 4, 0.7, 2.5, 6, -26, -9); if (c) crowd(dolphins, 3 + rnd() * 4 | 0, R, c, rr(0.11, 0.16) * (rnd() < 0.5 ? 1 : -1), rr(0.9, 1.1)); }
  for (let n = rnd() < 0.8 ? 1 + (rnd() < 0.5) : 0; n > 0; n--) { const R = rr(14, 30), c = place(R + 4, 0.7, 2, 5, -34, -14); if (c) crowd(tunas, 7 + rnd() * 8 | 0, R, c, rr(0.16, 0.24) * (rnd() < 0.5 ? 1 : -1), rr(0.9, 1.2)); }

  // barracuda: a lone great barracuda or pair, and tight schools of chevron barracuda
  const barras = [[], []];
  for (let n = rnd() < 0.6 ? 1 : 0; n > 0; n--) { const R = rr(10, 22), c = place(R + 4, 0.7, 2, 5, -32, -12); if (c) crowd(barras[0], 1 + (rnd() < 0.35), R, c, rr(0.1, 0.15) * (rnd() < 0.5 ? 1 : -1), rr(1, 1.3)); }
  for (let n = rnd() < 0.5 ? 1 : 0; n > 0; n--) { const R = rr(12, 24), c = place(R + 4, 0.7, 2, 5, -34, -14); if (c) crowd(barras[1], 12 + rnd() * 10 | 0, R, c, rr(0.12, 0.18) * (rnd() < 0.5 ? 1 : -1), rr(0.9, 1.1)); }
  // crabs and spiny lobsters crawl in small loops over fairly flat sea floor, [x, y, z, R, phase, speed, size, seed]. The loop
  // is kept if the rock field (smoothly interpolated, unlike the voxel columns of gy) has open water just above it and rock
  // just below it all the way round.
  cs(15);
  const crawl = [[], []], CR = [[0.5, 1.4, 0.2, 0.45, 0.6, 1.3], [0.8, 1.8, 0.14, 0.3, 0.8, 1.4]];
  const loopOk = (x, y, z, R) => { for (let a = 0; a < 8; a++) { const px = x + R * cos(a * TAU / 8), pz = z + R * 0.7 * sin(a * TAU / 8); if (Dw(px, y + 0.3, pz) > 0 || Dw(px, y - 0.35, pz) <= 0) return false; } return true; };
  const addCrawler = (k, x, y, z, R) => { const c = CR[k]; crawl[k].push(x, y, z, R, rnd() * TAU, rr(c[2], c[3]) / R * (rnd() < 0.5 ? 1 : -1), rr(c[4], c[5]), rnd()); };
  for (const [k, cnt] of [[0, 28], [1, 12]]) {
    for (let n = 0, tries = 0; n < cnt && tries < 1500 && nCore; tries++) {
      const i = pickV(), x = T.wp[i], y = T.wp[i + 1], z = T.wp[i + 2], R = rr(CR[k][0], CR[k][1]);
      if (T.wn[i + 1] < 0.8 || !inC(x, z) || y > -12 || nearFly(x, y, z, 1.5) || !loopOk(x, y, z, R)) continue;
      addCrawler(k, x, y, z, R); n++;
    }
  }
  // and a few on the sand in front of the first viewpoint, so there are always some to find
  for (const [k, f, r] of [[0, 5, -1.2], [0, 6.5, 1.5], [1, 8, 0.2], [0, 9, -2.8], [1, 11, 2.6]]) {
    const [x, z] = rel(0, f, r); if (!inC(x, z)) continue;
    let lo = gy(x, z) - 1, hi = lo + 2; for (let s = 0; s < 16; s++) { const m = (lo + hi) / 2; if (Dw(x, m, z) > 0) lo = m; else hi = m; }
    const y = lo; let R = CR[k][1];
    while (R > 0.3 && !loopOk(x, y, z, R)) R *= 0.75;
    addCrawler(k, x, y, z, max(R, 0.3));
  }
  if (rnd() < 0.4) { const R = rr(20, 40), c = place(R, 0.75, 2.5, 5, -30, -10); if (c) mantas.push(c[0], c[1], c[2], R, rnd() * TAU, rr(0.045, 0.085) * (rnd() < 0.5 ? 1 : -1), rr(3.6, 5.6), rnd()); }

  const sol = { data: [], ranges: [] }; let si = 0;
  for (let m = 0; m < 12; m++) { const a = solids[m] || []; sol.ranges.push([si, a.length / 12]); si += a.length / 12; for (let i = 0; i < a.length; i++) sol.data.push(a[i]); }
  const packC = (L) => {
    let n = 0; const start = new Uint32Array(nCells + 1);
    for (let c = 0; c < nCells; c++) { start[c] = n; n += L[c].length / 12; }
    start[nCells] = n;
    const data = new Float32Array(n * 12), lo = new Float32Array(nCells).fill(1e9), hi = new Float32Array(nCells).fill(-1e9);
    let k = 0;
    for (let c = 0; c < nCells; c++) { const a = L[c]; for (let i = 0; i < a.length; i += 12) { for (let j = 0; j < 12; j++) data[k++] = a[i + j]; lo[c] = min(lo[c], a[i + 1] - 3); hi[c] = max(hi[c], a[i + 1] + 3); } }
    return { data, n, start, lo, hi };
  };
  return { glints: new Float32Array(glints), chunks: chunks.map(packC), props: props.map(packC), big: pack(big), bigF: pack(big, 2, 1.5), small: pack(small), solids: { data: new Float32Array(sol.data), ranges: sol.ranges }, bubbles: new Float32Array(bubbles), volD, gm, fish: new Float32Array(fish), mantas: new Float32Array(mantas), sharks: new Float32Array(sharks), dolphins: new Float32Array(dolphins), tunas: new Float32Array(tunas), crawl: crawl.map((c) => new Float32Array(c)), barras: barras.map((b) => new Float32Array(b)), turtles: turtles.map((t) => new Float32Array(t)), reef: reef.map((t) => new Float32Array(t)), ci, cj };
}
const fract = (x) => x - floor(x);

// ---------------------------------------------------------------- procedural meshes
function meshChunk(sd, sub = 2, det = sub > 2) {
  if (LV > 1 && sub > 1) sub--; // Low: a quarter of the triangles
  rseed(100 + sd);
  const pl = []; for (let i = 0; i < 4; i++) { const q = qRand(); pl.push([q[0], q[1], q[2], rr(0.8, 0.98)]); const l = hypot(q[0], q[1], q[2]) || 1; pl[i][0] /= l; pl[i][1] /= l; pl[i][2] /= l; }
  return icosphere(sub, (x, y, z) => {
    let r = 1 + (fbm(x * 1.6 + sd, y * 1.6, z * 1.6, 2) - 0.5) * 0.9 + (det ? (fbm(x * 4 + sd, y * 4, z * 4, 2) - 0.5) * 0.25 : 0);
    let px = x * r, py = y * r * 0.8, pz = z * r;
    for (const p of pl) { const d = px * p[0] + py * p[1] + pz * p[2] - p[3]; if (d > 0) { px -= p[0] * d; py -= p[1] * d; pz -= p[2] * d; } }
    return [px, py, pz];
  });
}
function meshLathe(prof, seg, lump, ribs = 0) {
  const m = new Mesh(), rings = [];
  for (const [r, h, ao] of prof) { const ring = []; for (let s = 0; s < seg; s++) { const a = s / seg * TAU, rl = r * (1 + lump * (fbm(cos(a) * 1.5 + h * 2, h * 3, sin(a) * 1.5, 2) - 0.5) + 0.07 * cos(ribs * a + h * 1.5)); ring.push(m.v(cos(a) * rl, h, sin(a) * rl, ao)); } rings.push(ring); }
  for (let k = 0; k < rings.length - 1; k++) for (let s = 0; s < seg; s++) { const s2 = (s + 1) % seg; m.quad(rings[k][s], rings[k + 1][s], rings[k + 1][s2], rings[k][s2]); }
  return m;
}
function meshCoral(fan, lo = LV > 1) {
  rseed(200 + fan);
  const m = new Mesh();
  const nrm = (v) => { const l = hypot(...v) || 1; return v.map((c) => c / l); };
  const br = (p, d, r, len, depth) => {
    const pts = [p]; let q = p;
    for (let i = 0; i < 3; i++) { d = nrm([d[0] + rr(-0.3, 0.3), d[1] + rr(-0.1, 0.3), d[2] + (fan ? rr(-0.05, 0.05) : rr(-0.3, 0.3))]); q = [q[0] + d[0] * len / 3, q[1] + d[1] * len / 3, q[2] + d[2] * len / 3]; pts.push(q); }
    if (!depth) pts.push([q[0] + d[0] * r * 1.6, q[1] + d[1] * r * 1.6, q[2] + d[2] * r * 1.6]);
    if (lo) m.tube(depth ? [pts[0], pts[3]] : [pts[0], pts[3], pts[4]], (k) => (k > 1 ? r * 0.36 : r * (1 - 0.22 * k)) * 1.25, 3, true, (k) => clamp(1 - (depth + 1 - k) / 5, 0, 1));
    else m.tube(pts, (k) => k > 3 ? r * 0.36 : r * (1 - 0.22 * k / 3), fan ? 5 : 6, true, (k) => clamp(1 - (depth + 1 - k / 3) / 5, 0, 1));
    if (depth > 0) { const n = 2 + (rnd() < 0.5); for (let i = 0; i < n; i++) br(q, nrm([d[0] + rr(-0.8, 0.8), d[1] + rr(-0.1, 0.5), d[2] + (fan ? rr(-0.08, 0.08) : rr(-0.8, 0.8))]), r * 0.78, len * 0.8, depth - 1); }
  };
  const n0 = fan ? 1 : 2 + (rnd() * 2 | 0);
  for (let i = 0; i < n0; i++) br([rr(-0.08, 0.08), 0, rr(-0.08, 0.08)], nrm([rr(-0.5, 0.5), 1, fan ? 0 : rr(-0.5, 0.5)]), fan ? 0.06 : 0.08, fan ? 0.5 : 0.45, 3);
  return m;
}
function meshTubes() {
  rseed(210);
  const m = new Mesh();
  for (let i = 0; i < 9; i++) {
    const a = rnd() * TAU, r0 = rr(0, 0.28), h = rr(0.45, 1.1), rad = rr(0.07, 0.12), lean = rr(0.05, 0.3), pts = [];
    for (let k = 0; k <= 4; k++) pts.push([cos(a) * (r0 + lean * k / 4 * h), h * k / 4, sin(a) * (r0 + lean * k / 4 * h)]);
    m.tube(pts, (k) => rad * (0.8 + 0.25 * k / 4), 12, false, (k) => 0.35 + 0.65 * k / 4);
    // rim + dark throat
    const e = pts[4], n = m.p.length / 3, c = m.v(e[0], e[1] - rad * 1.2, e[2], 0.05);
    for (let s2 = 0; s2 < 12; s2++) m.tri(n - 12 + s2, n - 12 + (s2 + 1) % 12, c);
  }
  return m;
}
// stone whale fluke: SDF of tapered capsules -> surface nets
function meshFluke() {
  const C = [];
  const chain = (pts, zs) => { for (let i = 0; i < pts.length - 1; i++) C.push([...pts[i], ...pts[i + 1], zs]); };
  chain([[0, -1.6, 3.7, 1.2], [0, 1.8, 2.35, 0.98], [0, 4.6, 1.0, 0.76], [0, 6.9, 0.1, 0.6]], 0.8);
  chain([[0, 6.6, 0.1, 0.72], [1.9, 7.9, 0, 0.98], [3.9, 8.8, -0.1, 0.9], [5.7, 9.8, -0.25, 0.64], [7.0, 11.2, -0.4, 0.38], [7.7, 12.8, -0.55, 0.2], [7.9, 14.1, -0.65, 0.1]], 0.18);
  chain([[0, 6.6, 0.1, 0.72], [-1.7, 8.3, 0.05, 0.96], [-3.3, 9.7, -0.05, 0.88], [-4.7, 11.2, -0.2, 0.64], [-5.6, 12.9, -0.4, 0.38], [-6.0, 14.6, -0.5, 0.2], [-5.9, 15.9, -0.6, 0.1]], 0.18);
  const sdf = (x, y, z) => {
    let d = 1e9;
    for (const c of C) {
      const zs = c[8], pz = z / zs, az = c[2] / zs, bz = c[6] / zs;
      const bax = c[4] - c[0], bay = c[5] - c[1], baz = bz - az, pax = x - c[0], pay = y - c[1], paz = pz - az;
      const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
      const e = (hypot(pax - bax * h, pay - bay * h, paz - baz * h) - mix(c[3], c[7], h)) * zs;
      const k = 0.45, hh = max(k - abs(d - e), 0) / k;
      d = min(d, e) - hh * hh * k * 0.25;
    }
    return d;
  };
  const vs = 0.09, ox = -7.6, oy = -2.6, oz = -2.2, nx = 186, ny = 216, nz = 76, D = new Float32Array(nx * ny * nz);
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) D[x + nx * (y + ny * z)] = -sdf(ox + x * vs, oy + y * vs, oz + z * vs);
  const sn = surfaceNetsAll(D, nx, ny, nz), smp = sampler3(D, nx, ny, nz);
  const vb = new ArrayBuffer(sn.nv * 16), f = new Float32Array(vb), s = new Int8Array(vb);
  for (let k = 0; k < sn.nv; k++) {
    const x = sn.pos[k * 3], y = sn.pos[k * 3 + 1], z = sn.pos[k * 3 + 2], e = 0.7;
    let ax = smp(x - e, y, z) - smp(x + e, y, z), ay = smp(x, y - e, z) - smp(x, y + e, z), az = smp(x, y, z - e) - smp(x, y, z + e);
    const l = hypot(ax, ay, az) || 1;
    f[k * 4] = ox + x * vs; f[k * 4 + 1] = oy + y * vs; f[k * 4 + 2] = oz + z * vs;
    s[k * 16 + 12] = round(ax / l * 127); s[k * 16 + 13] = round(ay / l * 127); s[k * 16 + 14] = round(az / l * 127); s[k * 16 + 15] = 127;
  }
  return { vb, ib: new Uint32Array(sn.idx), nv: sn.nv };
}
// sunken ship (bow at +x): keel with stem and stern posts, curved ribs, hull planking with a breach,
// raised stern castle with transom, deck remnants, two masts with yards, bowsprit
function meshShip() {
  rseed(220);
  const m = new Mesh(), Lh = 17, B = 5.6, Dp = 7.6;
  const hb = (x) => B * pow(max(1 - pow(abs(x / Lh), x < 0 ? 3.6 : 2.6), 0), 0.5);
  const dp = (x) => Dp * (1 - 0.36 * pow(abs(x / Lh), 2.5));
  const sheer = (x) => 0.5 + (x > 0 ? 3.0 : 3.8) * pow(abs(x / Lh), 2.2);
  const pt = (x, ph, off = 0) => { const b = hb(x) + off, d = dp(x) + off, s = sheer(x); return [x, s - (d + s) * pow(max(cos(ph), 0), 0.66), b * Math.sign(ph) * pow(abs(sin(ph)), 0.8)]; };
  const out = (p) => { const l = hypot(p[1] + 0.5, p[2] * 1.3) || 1; return [0, (p[1] + 0.5) / l, p[2] * 1.3 / l]; };
  const up = () => [0, 1, 0];
  const keel = [];
  for (let i = 0; i <= 44; i++) { const x = mix(-Lh - 1.0, Lh + 2.4, i / 44), e = max(abs(x) / Lh - 0.78, 0) * 4.2; keel.push([x, -dp(clamp(x, -Lh, Lh)) - 0.3 + e * e * e * 4.2, 0]); }
  m.sweep(keel, 0.55, 0.95, up);
  for (let x = -Lh + 0.7; x < Lh - 0.3; x += 0.8) {
    const a0 = rnd() < 0.1 ? rr(-0.9, -0.2) : -PI / 2, a1 = rnd() < 0.1 ? rr(0.2, 0.9) : PI / 2, pts = [];
    for (let i = 0; i <= 16; i++) pts.push(pt(x, mix(a0, a1, i / 16)));
    m.sweep(pts, 0.24, 0.3, out);
  }
  const holeX = rr(-6, 2), holeS = rnd() < 0.5 ? 1 : -1;
  const BR = [[holeX, holeS * 0.8, 3.2, 0.42], [7, -holeS * 0.95, 2.4, 0.34], [12, holeS * 0.5, 1.7, 0.28], [-11, -holeS * 0.55, 2.1, 0.3]];
  const holed = (x, ph) => { for (const h of BR) { const a = (x - h[0]) / h[2], b = (ph - h[1]) / h[3]; if (a * a + b * b < 1 + 0.45 * sin(x * 3.1 + ph * 9)) return true; } return false; };
  const NS = 14, xs = []; for (let x = -Lh + 0.35; x <= Lh - 0.3; x += 0.85) xs.push(x);
  for (let j = 0; j < NS; j++) {
    const p0 = mix(-1.5, 1.5, j / NS), p1 = mix(-1.5, 1.5, (j + 1) / NS), sg = p0 + p1 < 0 ? -1 : 1, lo = sg < 0 ? p1 : p0, hi = sg < 0 ? p0 : p1;
    let pv = null;
    for (const x of xs) {
      const cu = [m.v(...pt(x, lo, 0.27)), m.v(...pt(x, hi, 0.14)), m.v(...pt(x, lo, 0.1)), m.v(...pt(x, hi, 0.1))];
      if (pv && !holed(x - 0.42, (p0 + p1) / 2)) {
        if (sg > 0) { m.quad(pv[0], pv[1], cu[1], cu[0]); m.quad(pv[2], cu[2], cu[3], pv[3]); }
        else { m.quad(pv[0], cu[0], cu[1], pv[1]); m.quad(pv[2], pv[3], cu[3], cu[2]); }
      }
      pv = cu;
    }
  }
  for (const sgn of [-1, 1]) {
    let pts = []; for (let x = -Lh + 0.6; x <= Lh - 0.6; x += 1) pts.push(pt(x, sgn * PI / 2, 0.2)); m.sweep(pts, 0.3, 0.28, up);
    // stern castle bulwarks
    for (let j = 0; j < 3; j++) { pts = []; for (let x = -Lh + 0.4; x <= -Lh + 8.5 - j; x += 0.9) pts.push([x, sheer(x) + 0.55 + j * 0.86, sgn * (max(hb(x), 2.6) + 0.15)]); m.sweep(pts, 0.82, 0.09, () => [0, 0, sgn]); }
  }
  // transom
  for (let y = -3; y < sheer(-Lh) + 3; y += 0.86) { const w = max(1.2, 2.9 * sstep(-4.5, 1.5, y)); if (rnd() < 0.9) m.sweep([[-Lh + 0.35, y, -w], [-Lh + 0.35, y, w]], 0.82, 0.1, () => [1, 0, 0]); }
  for (let x = -Lh + 2; x < Lh - 2; x += rr(1.8, 3.2)) m.sweep([[x, sheer(x) - 0.25, -hb(x)], [x, sheer(x) - 0.2, 0], [x, sheer(x) - 0.25, hb(x)]], 0.26, 0.26, up);
  for (let z = -3.9; z <= 3.9; z += 0.62) { let x = -Lh + rr(1, 5); while (x < Lh - 4) { const x1 = min(x + rr(3, 9), Lh - 3.5); if (rnd() < 0.6) { const pts = []; for (let xx = x; xx <= x1; xx += 1) if (hb(xx) > abs(z) + 0.3) pts.push([xx, sheer(xx) - 0.05, z]); if (pts.length > 1) m.sweep(pts, 0.56, 0.07, up); } x = x1 + rr(0.5, 3); } }
  // foremast with yard, broken main mast, bowsprit
  m.sweep([[7, -Dp + 0.6, 0], [7.1, 1, 0], [7.4, 8, 0.3], [7.8, 15, 0.8]], (k) => 0.62 - k * 0.1, (k) => 0.62 - k * 0.1, () => [1, 0, 0]);
  m.sweep([[7.5, 9.5, -5.2], [7.5, 9.6, 0.3], [7.5, 9.2, 5.6]], 0.26, 0.26, up);
  m.sweep([[7.7, 13.2, -3.2], [7.7, 13.3, 3.6]], 0.2, 0.2, up);
  m.sweep([[-3, -Dp + 0.6, 0], [-3.2, 1, 0.2], [-3.9, 6, 1.0], [-5.2, 9.5, 2.6]], (k) => 0.74 - k * 0.1, (k) => 0.74 - k * 0.1, () => [1, 0, 0]);
  m.sweep([[Lh + 1.4, 2.6, 0], [Lh + 8, 5.2, 0.2]], 0.34, 0.34, up);
  return m;
}
// manta ray: span along x (half span = 1), nose +z; aux = span coordinate for the flap animation
function meshManta() {
  const m = new Mesh(), NU = 72, M = 22, rings = [];
  for (let j = 0; j <= NU; j++) {
    const u = j / NU * 2 - 1, au = abs(u);
    let zl = 0.52 - 0.74 * pow(au, 1.35) + 0.07 * exp(-pow((au - 0.13) / 0.05, 2)) - 0.05 * exp(-pow(au / 0.05, 2)) - 0.08 * pow(au, 5);
    const zt = -0.5 + 0.3 * pow(au, 0.8) + 0.02 - 0.08 * pow(au, 5);
    if (zl < zt + 0.004) zl = zt + 0.004;
    const th = 0.08 * pow(1 - au, 1.15) + 0.004 + 0.12 * exp(-pow(u / 0.2, 2)), ring = [];
    for (let k = 0; k < M; k++) { const a = k / M * TAU; ring.push(m.v(u, th * sin(a) * (0.62 + 0.38 * cos(a)), mix(zt, zl, 0.5 + 0.5 * cos(a)), u)); }
    rings.push(ring);
  }
  for (let j = 0; j < NU; j++) for (let k = 0; k < M; k++) { const k2 = (k + 1) % M; m.quad(rings[j][k], rings[j + 1][k], rings[j + 1][k2], rings[j][k2]); }
  const tail = []; for (let i = 0; i <= 8; i++) tail.push([0, 0, -0.42 - i * 0.19]);
  const n0 = m.p.length / 3;
  m.tube(tail, (k) => 0.016 * (1 - k / 9), 4, true);
  for (let k = n0; k < m.aux.length; k++) m.aux[k] = 0;
  for (const sx of [-1, 1]) { // cephalic fins
    const n1 = m.p.length / 3;
    m.tube([[sx * 0.12, -0.02, 0.48], [sx * 0.135, -0.05, 0.6], [sx * 0.115, -0.09, 0.69], [sx * 0.085, -0.125, 0.74]], (k) => 0.045 * (1 - k / 4.4), 6, true);
    for (let k = n1; k < m.aux.length; k++) m.aux[k] = sx * 0.1;
  }
  return m;
}
// shared by the dolphin and tuna: a smooth torso through (half height, half width) knots, nose at +x, and flat fin strips
function torso(m, KX, KH, KW, NR = 30, NK = 18) {
  const cr = (A, u) => { const i = min(floor(u), A.length - 2), t = u - i, p0 = A[max(i - 1, 0)], p1 = A[i], p2 = A[i + 1], p3 = A[min(i + 2, A.length - 1)];
    return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t); };
  const at = (x) => { let u = 0; while (u < KX.length - 2 && x < KX[u + 1]) u++; const t = (KX[u] - x) / (KX[u] - KX[u + 1]); return [cr(KH, u + t), cr(KW, u + t)]; };
  const x0 = KX[0], x1 = KX[KX.length - 1], rings = [];
  for (let i = 0; i < NR; i++) {
    const x = x0 - (x0 - x1) * pow(i / (NR - 1), 1.1), [h, w] = at(x), r = [];
    for (let k = 0; k < NK; k++) { const a = k / NK * TAU; r.push(m.v(x, sin(a) * h, cos(a) * w, 0)); }
    rings.push(r);
  }
  for (let i = 0; i < NR - 1; i++) for (let k = 0; k < NK; k++) { const k2 = (k + 1) % NK; m.quad(rings[i][k], rings[i + 1][k], rings[i + 1][k2], rings[i][k2]); }
  return at;
}
function finStrip(m, F, B, P, bend, rows = 5, aux = 0) {
  const row = (j) => { const t = j / rows, k = sin(PI * t); return [F, B].map((q, e) => [0, 1, 2].map((c) => q[c] + (P[c] - q[c]) * t + bend[c] * k * (1 + 0.6 * e))); };
  for (let j = 0; j < rows; j++) {
    const [f0, b0] = row(j), [f1, b1] = row(j + 1), au = aux || j / rows, ad = aux || (j + 1) / rows;
    const q = [m.v(...f0, au), m.v(...b0, au), m.v(...b1, ad), m.v(...f1, ad)];
    if (j === rows - 1) { const tp = m.v(...P, aux || 1); m.tri(q[0], q[1], tp); m.tri(q[1], q[0], tp); } else { m.quad(q[0], q[1], q[2], q[3]); m.quad(q[0], q[3], q[2], q[1]); }
  }
}
function eyes(m, at, x, f, R) {
  for (const sd of [-1, 1]) {
    const [h, w] = at(x), cx = x, cy = f * h, cz = sd * (w * sqrt(1 - f * f) + 0.003), N = 8, M = 6, g = [];
    for (let i = 0; i <= M; i++) { const th = i / M * PI, r = []; for (let k = 0; k < N; k++) { const ph = k / N * TAU; r.push(m.v(cx + R * cos(th), cy + R * sin(th) * sin(ph), cz + R * sin(th) * cos(ph), -1)); } g.push(r); }
    for (let i = 0; i < M; i++) for (let k = 0; k < N; k++) { const k2 = (k + 1) % N; m.quad(g[i][k], g[i + 1][k], g[i + 1][k2], g[i][k2]); }
  }
}
// barracuda, nose at +x, long and slim with an underbite and two widely spaced dorsals. kind 0 great (1.6 m), 1 chevron (1 m)
function meshBarracuda(kind) {
  const m = new Mesh();
  const at = torso(m, [0.8, 0.72, 0.6, 0.3, 0, -0.3, -0.55, -0.7], [0.008, 0.03, 0.055, 0.075, 0.075, 0.06, 0.03, 0.018], [0.008, 0.025, 0.045, 0.058, 0.055, 0.04, 0.02, 0.01], 26, 14);
  finStrip(m, [0.12, 0.07, 0], [0.04, 0.07, 0], [0.02, 0.15, 0], [0.02, 0, 0], 3);                          // first dorsal
  finStrip(m, [-0.34, 0.06, 0], [-0.46, 0.05, 0], [-0.5, 0.14, 0], [0.02, 0, 0], 3);                        // second dorsal
  finStrip(m, [-0.32, -0.055, 0], [-0.44, -0.05, 0], [-0.48, -0.13, 0], [0.02, 0, 0], 3);                   // anal
  for (const sd of [-1, 1]) finStrip(m, [0.26, -0.05, sd * 0.04], [0.18, -0.05, sd * 0.045], [0.14, -0.11, sd * 0.1], [0.02, 0, sd * 0.01], 3);
  finStrip(m, [-0.64, 0.008, 0], [-0.72, 0.008, 0], [-0.9, 0.17, 0], [0.04, 0, 0], 4, 0.6);                 // forked tail
  finStrip(m, [-0.64, -0.008, 0], [-0.72, -0.008, 0], [-0.9, -0.17, 0], [0.04, 0, 0], 4, 0.6);
  eyes(m, at, 0.62, 0.3, 0.016);
  return m;
}
// bottlenose dolphin, about 2.6 m long, nose at +x. Flukes are horizontal and beat up and down. aux -1: eyes
function meshDolphin() {
  const m = new Mesh();
  const at = torso(m, [1, 0.93, 0.82, 0.62, 0.3, 0, -0.3, -0.58, -0.8, -0.92], [0.008, 0.03, 0.085, 0.125, 0.145, 0.14, 0.1, 0.06, 0.03, 0.012], [0.008, 0.035, 0.07, 0.1, 0.115, 0.1, 0.07, 0.04, 0.02, 0.01], 36);
  finStrip(m, [0.12, 0.13, 0], [-0.12, 0.12, 0], [-0.12, 0.34, 0], [0.04, 0.02, 0], 6);                      // dorsal, swept back
  for (const sd of [-1, 1]) {
    finStrip(m, [0.4, -0.08, sd * 0.08], [0.22, -0.08, sd * 0.09], [0.2, -0.26, sd * 0.3], [0.05, 0, sd * 0.02], 5);   // flippers
    finStrip(m, [-0.82, 0, sd * 0.01], [-0.98, 0, sd * 0.01], [-1.08, 0.015, sd * 0.4], [0.02, 0, 0], 5);     // flukes
  }
  eyes(m, at, 0.6, 0.15, 0.022);
  return m;
}
// yellowfin tuna, about 1.3 m long, nose at +x. aux 1 on the yellow finlets and fins, -1 the eyes
function meshTuna() {
  const m = new Mesh();
  const at = torso(m, [0.7, 0.62, 0.45, 0.2, -0.05, -0.3, -0.5, -0.62], [0.01, 0.05, 0.1, 0.13, 0.115, 0.07, 0.03, 0.02], [0.01, 0.04, 0.07, 0.085, 0.075, 0.045, 0.02, 0.012], 24, 14);
  finStrip(m, [0.12, 0.12, 0], [-0.02, 0.12, 0], [-0.06, 0.28, 0], [0.04, 0.01, 0], 4, 0.8);              // first dorsal
  finStrip(m, [-0.12, 0.1, 0], [-0.25, 0.1, 0], [-0.38, 0.24, 0], [0.05, 0, 0], 4, 0.8);                  // second dorsal and anal fin
  finStrip(m, [-0.1, -0.1, 0], [-0.24, -0.1, 0], [-0.38, -0.2, 0], [0.05, 0, 0], 4, 0.8);
  for (let j = 0; j < 7; j++) { const x = -0.4 - j * 0.03; for (const s of [1, -1]) finStrip(m, [x, s * (0.04 - j * 0.003), 0], [x - 0.025, s * (0.035 - j * 0.003), 0], [x - 0.05, s * (0.075 - j * 0.004), 0], [0.01, 0, 0], 1, 1); }
  for (const sd of [-1, 1]) finStrip(m, [0.22, -0.08, sd * 0.05], [0.12, -0.08, sd * 0.06], [0.06, -0.17, sd * 0.2], [0.03, 0, sd * 0.02], 3);
  finStrip(m, [-0.56, 0.01, 0], [-0.64, 0.01, 0], [-0.82, 0.3, 0], [0.06, 0, 0], 4);                       // lunate tail
  finStrip(m, [-0.56, -0.01, 0], [-0.64, -0.01, 0], [-0.82, -0.3, 0], [0.06, 0, 0], 4);
  eyes(m, at, 0.5, 0.25, 0.022);
  return m;
}
// blacktip reef shark, about 1.8 m long, nose at +x. aux: 0..1 toward the black fin tips, -1 the eyes and mouth, -0.5 gill slits
function meshShark() {
  const m = new Mesh();
  // body profile (half height, half width) by x, smoothed through the knots with Catmull-Rom
  const KX = [0.8, 0.72, 0.55, 0.3, 0, -0.3, -0.55, -0.72], KH = [0.012, 0.05, 0.095, 0.12, 0.115, 0.08, 0.05, 0.035], KW = [0.012, 0.05, 0.085, 0.1, 0.095, 0.065, 0.04, 0.02];
  const cr = (A, u) => { const i = min(floor(u), A.length - 2), t = u - i, p0 = A[max(i - 1, 0)], p1 = A[i], p2 = A[i + 1], p3 = A[min(i + 2, A.length - 1)];
    return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t); };
  const at = (x) => { let u = 0; while (u < KX.length - 2 && x < KX[u + 1]) u++; const t = (KX[u] - x) / (KX[u] - KX[u + 1]); return [cr(KH, u + t), cr(KW, u + t)]; };
  const NR = 30, NK = 18, rings = [];
  for (let i = 0; i < NR; i++) {
    const x = 0.8 - 1.52 * pow(i / (NR - 1), 1.1), [h, w] = at(x), r = [];
    for (let k = 0; k < NK; k++) { const a = k / NK * TAU; r.push(m.v(x, sin(a) * h, cos(a) * w, 0)); }
    rings.push(r);
  }
  for (let i = 0; i < NR - 1; i++) for (let k = 0; k < NK; k++) { const k2 = (k + 1) % NK; m.quad(rings[i][k], rings[i + 1][k], rings[i + 1][k2], rings[i][k2]); }
  // point on the body surface at x, height fraction f (-1..1) and side s, pushed out by o
  const surf = (x, f, s, o) => { const [h, w] = at(x), y = f * h; return [x, y, s * (w * sqrt(max(1 - f * f, 0)) + o), ]; };
  // a flat fin as a strip of rows from the leading edge F and trailing edge B up to the tip P (both sides), swept by `bend`
  const fin = (F, B, P, bend, rows = 6) => {
    const row = (j) => { const t = j / rows, k = sin(PI * t); return [0, 1].map((e) => { const q = e ? B : F; return [q[0] + (P[0] - q[0]) * t + bend[0] * k * (1 + 0.6 * e), q[1] + (P[1] - q[1]) * t + bend[1] * k * (1 + 0.6 * e), q[2] + (P[2] - q[2]) * t + bend[2] * k * (1 + 0.6 * e)]; }); };
    for (let j = 0; j < rows; j++) {
      const [f0, b0] = row(j), [f1, b1] = row(j + 1), au = j / rows, ad = (j + 1) / rows;
      const q = [m.v(...f0, au), m.v(...b0, au), m.v(...b1, ad), m.v(...f1, ad)];
      if (j === rows - 1) { const tp = m.v(...P, 1); m.tri(q[0], q[1], tp); m.tri(q[1], q[0], tp); } else { m.quad(q[0], q[1], q[2], q[3]); m.quad(q[0], q[3], q[2], q[1]); }
    }
  };
  fin([0.16, 0.11, 0], [-0.17, 0.1, 0], [-0.1, 0.35, 0], [0.04, 0.02, 0]);                  // first dorsal
  fin([-0.46, 0.05, 0], [-0.62, 0.04, 0], [-0.54, 0.13, 0], [0.01, 0.005, 0], 3);            // second dorsal
  for (const sd of [-1, 1]) fin([0.32, -0.07, sd * 0.07], [0.12, -0.08, sd * 0.09], [0.04, -0.2, sd * 0.34], [0.05, 0, sd * 0.03], 5); // pectorals
  fin([-0.7, 0.035, 0], [-0.86, 0.02, 0], [-1.02, 0.3, 0], [0.03, 0.02, 0]);                 // tail, upper lobe
  fin([-0.7, -0.035, 0], [-0.86, 0.02, 0], [-0.92, -0.15, 0], [0.02, -0.01, 0], 4);          // lower lobe
  { const a = m.v(-0.7, 0.035, 0, 0), b = m.v(-0.86, 0.02, 0, 0), c = m.v(-0.7, -0.035, 0, 0); m.tri(a, b, c); m.tri(a, c, b); }
  // eyes: small dark spheres on each side of the snout
  for (const sd of [-1, 1]) {
    const [cx, cy, cz] = surf(0.58, 0.3, sd, 0.004), R = 0.024, N = 8, M = 6, g = [];
    for (let i = 0; i <= M; i++) { const th = i / M * PI, r = []; for (let k = 0; k < N; k++) { const ph = k / N * TAU; r.push(m.v(cx + R * cos(th), cy + R * sin(th) * sin(ph), cz + R * sin(th) * cos(ph), -1)); } g.push(r); }
    for (let i = 0; i < M; i++) for (let k = 0; k < N; k++) { const k2 = (k + 1) % N; m.quad(g[i][k], g[i + 1][k], g[i + 1][k2], g[i][k2]); }
  }
  // mouth: a dark crescent under the snout, sweeping back at the corners
  { const pts = [];
    for (let j = 0; j <= 12; j++) { const u = j / 12 * 2 - 1, x0 = 0.62 - 0.12 * u * u, [h, w] = at(x0), z = u * w * 0.75; pts.push([x0, -h * sqrt(max(1 - (z / w) ** 2, 0)) - 0.003, z]); }
    for (let j = 0; j < 12; j++) { const a = pts[j], b = pts[j + 1], d = 0.012; const q = [m.v(a[0], a[1], a[2], -1), m.v(b[0], b[1], b[2], -1), m.v(b[0] - d, b[1], b[2], -1), m.v(a[0] - d, a[1], a[2], -1)]; m.quad(q[0], q[1], q[2], q[3]); m.quad(q[0], q[3], q[2], q[1]); } }
  // five gill slits on each side
  for (const sd of [-1, 1]) for (let j = 0; j < 5; j++) {
    const x = 0.34 - j * 0.045, p = [0.6, 0.3, 0, -0.3, -0.5].map((f) => surf(x - f * 0.01, f, sd, 0.003));
    for (let k = 0; k < 4; k++) { const a = p[k], b = p[k + 1], d = 0.007; const q = [m.v(...a, -0.5), m.v(...b, -0.5), m.v(b[0] - d, b[1], b[2], -0.5), m.v(a[0] - d, a[1], a[2], -0.5)]; m.quad(q[0], q[1], q[2], q[3]); m.quad(q[0], q[3], q[2], q[1]); }
  }
  return m;
}
// tall, flat reef fishes, nose at +x: 0 Moorish idol (long snout, streamer dorsal fin), 1 butterflyfish (round disc)
function meshReef(kind) {
  const m = new Mesh();
  const KX = kind ? [0.36, 0.3, 0.12, -0.08, -0.25, -0.34] : [0.52, 0.34, 0.22, 0, -0.2, -0.3, -0.34];
  const KH = kind ? [0.01, 0.07, 0.26, 0.27, 0.14, 0.04] : [0.012, 0.04, 0.18, 0.32, 0.2, 0.07, 0.03];
  const KW = kind ? [0.01, 0.03, 0.05, 0.05, 0.03, 0.012] : [0.012, 0.025, 0.05, 0.055, 0.04, 0.02, 0.01];
  const cr = (A, u) => { const i = min(floor(u), A.length - 2), t = u - i, p0 = A[max(i - 1, 0)], p1 = A[i], p2 = A[i + 1], p3 = A[min(i + 2, A.length - 1)];
    return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t); };
  const NR = LV > 1 ? 8 : 14, NK = LV > 1 ? 6 : 10, n = KX.length, rings = [];
  for (let i = 0; i < NR; i++) {
    const x = KX[0] + (KX[n - 1] - KX[0]) * i / (NR - 1); let u = 0; while (u < n - 2 && x < KX[u + 1]) u++;
    const q = u + (KX[u] - x) / (KX[u] - KX[u + 1]), h = max(cr(KH, q), 0.008), w = max(cr(KW, q), 0.008), r = [];
    for (let k = 0; k < NK; k++) { const a = k / NK * TAU; r.push(m.v(x, sin(a) * h, cos(a) * w)); }
    rings.push(r);
  }
  for (let i = 0; i < NR - 1; i++) for (let k = 0; k < NK; k++) { const k2 = (k + 1) % NK; m.quad(rings[i][k], rings[i + 1][k], rings[i + 1][k2], rings[i][k2]); }
  const T = (a, b, c) => { m.tri(m.v(...a), m.v(...b), m.v(...c)); m.tri(m.v(...a), m.v(...c), m.v(...b)); };
  if (kind === 0) {
    T([0.12, 0.3, 0], [-0.62, 0.86, 0], [-0.2, 0.22, 0]); T([0.12, 0.3, 0], [0.02, 0.55, 0], [-0.62, 0.86, 0]); // streamer dorsal
    T([0.0, -0.3, 0], [-0.18, -0.46, 0], [-0.2, -0.2, 0]);                                                      // anal
    T([-0.3, 0.02, 0], [-0.55, 0.24, 0], [-0.46, 0, 0]); T([-0.3, -0.02, 0], [-0.46, 0, 0], [-0.55, -0.24, 0]); T([-0.3, 0.02, 0], [-0.46, 0, 0], [-0.3, -0.02, 0]);
  } else {
    T([0.14, 0.25, 0], [-0.08, 0.4, 0], [-0.26, 0.17, 0]);                                                      // dorsal
    T([0.08, -0.25, 0], [-0.1, -0.38, 0], [-0.24, -0.15, 0]);                                                   // anal
    T([-0.3, 0.05, 0], [-0.5, 0.14, 0], [-0.5, -0.14, 0]); T([-0.3, -0.05, 0], [-0.3, 0.05, 0], [-0.5, -0.14, 0]);   // rounded tail
  }
  T([0.12, -0.06, 0.04], [0.02, -0.14, 0.1], [0.06, -0.04, 0.05]); T([0.12, -0.06, -0.04], [0.02, -0.14, -0.1], [0.06, -0.04, -0.05]); // pectorals
  return m;
}
// seafloor crawlers, aux = how much a vertex moves with the walking legs (0 body, -1 eyes). 0 crab (walks sideways, +x is the
// claw end), 1 spiny lobster (walks forward, long antennae). About 0.4 m across.
function meshCrawler(kind) {
  const m = new Mesh();
  const leg = (pts, r, w0 = 0.35, w1 = 1) => m.tube(pts, (k) => r * (1 - 0.5 * k / (pts.length - 1)), 5, true, (k) => w0 + (w1 - w0) * k / (pts.length - 1));
  if (kind === 0) {
    torso(m, [0.16, 0.11, 0, -0.11, -0.16], [0.02, 0.05, 0.06, 0.05, 0.02], [0.05, 0.15, 0.21, 0.15, 0.05], 14, 12);
    for (const s of [-1, 1]) {
      for (let j = 0; j < 4; j++) { const x = 0.09 - j * 0.065, dx = (j - 1.5) * 0.04; leg([[x, 0, s * 0.15], [x + dx * 0.5, 0.07, s * 0.28], [x + dx, -0.01, s * 0.4], [x + dx * 1.2, -0.1, s * 0.43]], 0.014); }
      leg([[0.12, 0, s * 0.1], [0.24, 0.02, s * 0.15], [0.32, 0.01, s * 0.2]], 0.026, 0.12, 0.2);                       // arm
      leg([[0.3, 0.01, s * 0.2], [0.4, 0.01, s * 0.15], [0.46, 0.01, s * 0.08]], 0.032, 0.2, 0.35);                   // pincer
      leg([[0.15, 0.04, s * 0.06], [0.17, 0.09, s * 0.07]], 0.01, 0, 0);
      leg([[0.17, 0.09, s * 0.07], [0.175, 0.105, s * 0.07]], 0.02, -1, -1);                                          // eyes on stalks
    }
  } else {
    torso(m, [0.3, 0.24, 0.1, -0.1, -0.3, -0.5], [0.015, 0.06, 0.075, 0.065, 0.05, 0.04], [0.02, 0.07, 0.085, 0.075, 0.055, 0.05], 22, 12);
    finStrip(m, [-0.5, 0.01, 0], [-0.58, 0.01, 0], [-0.68, 0.01, 0], [0, 0.02, 0], 2, 0);                                // tail fan
    for (const s of [-1, 1]) { finStrip(m, [-0.5, 0.01, s * 0.03], [-0.58, 0.01, s * 0.04], [-0.67, 0.0, s * 0.11], [0, 0.02, 0], 2, 0); }
    for (const s of [-1, 1]) {
      for (let j = 0; j < 5; j++) { const x = 0.18 - j * 0.06; leg([[x, -0.02, s * 0.06], [x + 0.04, 0.0, s * 0.18], [x + 0.06, -0.04, s * 0.3], [x + 0.06, -0.1, s * 0.34]], 0.01); }
      leg([[0.27, 0.03, s * 0.02], [0.5, 0.12, s * 0.1], [0.8, 0.14, s * 0.22], [1.2, 0.1, s * 0.3]], 0.016, 0.1, 0.5);     // long antennae
      leg([[0.26, 0.05, s * 0.05], [0.4, 0.14, s * 0.12], [0.55, 0.16, s * 0.1]], 0.026, 0.1, 0.3);                       // short, thick ones
      leg([[0.26, 0.04, s * 0.06], [0.3, 0.1, s * 0.08]], 0.01, 0, 0);
      leg([[0.3, 0.1, s * 0.08], [0.305, 0.115, s * 0.08]], 0.02, -1, -1);                                              // eyes
    }
  }
  return m;
}
// boxfish, nose at +x: a rigid, rounded box with small fins that mostly just flutter
function meshBoxfish() {
  const m = new Mesh();
  const KX = [0.4, 0.34, 0.2, 0, -0.2, -0.34, -0.4], KH = [0.06, 0.17, 0.23, 0.24, 0.22, 0.15, 0.04], KW = [0.05, 0.14, 0.2, 0.21, 0.19, 0.12, 0.03];
  const cr = (A, u) => { const i = min(floor(u), A.length - 2), t = u - i, p0 = A[max(i - 1, 0)], p1 = A[i], p2 = A[i + 1], p3 = A[min(i + 2, A.length - 1)];
    return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t); };
  const NR = LV > 1 ? 10 : 16, NK = LV > 1 ? 8 : 16, n = KX.length, rings = [];
  for (let i = 0; i < NR; i++) {
    const x = KX[0] + (KX[n - 1] - KX[0]) * i / (NR - 1); let u = 0; while (u < n - 2 && x < KX[u + 1]) u++;
    const q = u + (KX[u] - x) / (KX[u] - KX[u + 1]), h = max(cr(KH, q), 0.01), w = max(cr(KW, q), 0.01), r = [];
    for (let k = 0; k < NK; k++) { const a = k / NK * TAU, c = cos(a), s = sin(a); r.push(m.v(x, Math.sign(s) * pow(abs(s), 0.5) * h, Math.sign(c) * pow(abs(c), 0.5) * w)); }
    rings.push(r);
  }
  for (let i = 0; i < NR - 1; i++) for (let k = 0; k < NK; k++) { const k2 = (k + 1) % NK; m.quad(rings[i][k], rings[i + 1][k], rings[i + 1][k2], rings[i][k2]); }
  const T = (a, b, c) => { m.tri(m.v(...a), m.v(...b), m.v(...c)); m.tri(m.v(...a), m.v(...c), m.v(...b)); };
  T([-0.05, 0.22, 0], [-0.2, 0.3, 0], [-0.24, 0.2, 0]);                                                        // dorsal
  T([-0.05, -0.22, 0], [-0.2, -0.3, 0], [-0.24, -0.2, 0]);                                                     // anal
  T([-0.38, 0.03, 0], [-0.62, 0.14, 0], [-0.62, -0.14, 0]); T([-0.38, -0.03, 0], [-0.38, 0.03, 0], [-0.62, -0.14, 0]); // tail
  T([0.14, -0.04, 0.2], [0.06, -0.1, 0.3], [0.1, 0.04, 0.22]); T([0.14, -0.04, -0.2], [0.06, -0.1, -0.3], [0.1, 0.04, -0.22]);
  return m;
}
// Sea turtles (0 green, 1 leatherback, 2 hawksbill), nose at +x, in metres. aux: 0 shell, 0.5..1 skin (0.5 + half the flap
// weight: the flipper tips move most), -1 eyes, -0.5 the line of the mouth
function meshTurtle(sp) {
  const m = new Mesh(), sgn = Math.sign;
  const P = [
    { L: 1.0, W: 0.58, Hu: 0.27, Hl: 0.07, ridges: 0, teeth: 0, tail: 0.07, head: { len: 0.2, r: 0.07, beak: 0, drop: 0.0 }, ff: { len: 0.4, c: 0.27, th: 0.04 }, rf: { len: 0.2, c: 0.14 } },
    { L: 1.7, W: 0.54, Hu: 0.3, Hl: 0.06, ridges: 1, teeth: 0, tail: 0.2, head: { len: 0.22, r: 0.075, beak: 0.3, drop: 0.01 }, ff: { len: 0.85, c: 0.26, th: 0.035 }, rf: { len: 0.3, c: 0.16 } },
    { L: 0.85, W: 0.47, Hu: 0.21, Hl: 0.06, ridges: 0, teeth: 1, tail: 0.06, head: { len: 0.27, r: 0.05, beak: 1, drop: 0.05 }, ff: { len: 0.34, c: 0.21, th: 0.035 }, rf: { len: 0.16, c: 0.12 } }][sp];
  const hl = P.L / 2, ex = LV > 1 ? 0.6 : 1;
  const planW = (t) => P.W * pow(max(sin(PI * pow(t, sp === 1 ? 0.85 : 0.72)), 0), sp === 1 ? 0.72 : 0.6) * (sp === 1 ? 1 - 0.3 * t : 1);
  // --- shell: rings from the front to the back, each a superellipse with a domed back and a flatter belly
  const NR = round(46 * ex), NK = round(40 * ex) & ~1, rings = [];
  for (let i = 0; i < NR; i++) {
    const t = i / (NR - 1), x = hl - P.L * t; let w = planW(t);
    const hu = P.Hu * pow(max(sin(PI * pow(t, 0.8)), 0), 0.55), hb = P.Hl * pow(max(sin(PI * pow(t, 0.8)), 0), 0.5);
    if (P.teeth && t > 0.72) w *= i % 2 ? 1.07 : 0.98; // serrated rear edge
    const r = [];
    for (let k = 0; k < NK; k++) {
      const a = k / NK * TAU, c = cos(a), s = sin(a), cc = sgn(c) * pow(abs(c), 0.72), sc = sgn(s) * pow(abs(s), 0.72);
      let y = (s >= 0 ? hu : hb) * sc, z = w * cc;
      // the carapace overhangs a narrower belly, with a raised rim where they meet
      if (s < 0) z *= 0.72 + 0.28 * pow(1 + sc, 2);
      z *= 1 + 0.05 * exp(-((sc / 0.1) ** 2));
      if (P.ridges && s > 0) for (const f of [0, 0.28, -0.28, 0.55, -0.55, 0.8, -0.8]) y += 0.024 * exp(-(((cc - f) / 0.075) ** 2)) * hu / P.Hu;
      r.push(m.v(x, y, z, 0));
    }
    rings.push(r);
  }
  for (let i = 0; i < NR - 1; i++) for (let k = 0; k < NK; k++) { const k2 = (k + 1) % NK; m.quad(rings[i][k], rings[i + 1][k], rings[i + 1][k2], rings[i][k2]); }
  // --- a tube along a spine of points with a flattened section (flippers, tail); `wgt` is how much it moves
  const nrm = (v) => { const l = hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const tube = (pts, chord, thick, wgt) => {
    const NS = LV > 1 ? 6 : 8, rg = [];
    for (let j = 0; j < pts.length; j++) {
      const s = j / (pts.length - 1), T = nrm([pts[min(j + 1, pts.length - 1)][0] - pts[max(j - 1, 0)][0], pts[min(j + 1, pts.length - 1)][1] - pts[max(j - 1, 0)][1], pts[min(j + 1, pts.length - 1)][2] - pts[max(j - 1, 0)][2]]);
      let C = [1 - T[0] * T[0], -T[0] * T[1], -T[0] * T[2]]; if (hypot(...C) < 0.2) C = [0, 0, 1]; C = nrm(C);
      const N = [T[1] * C[2] - T[2] * C[1], T[2] * C[0] - T[0] * C[2], T[0] * C[1] - T[1] * C[0]], c = chord(s) / 2, th = thick(s) / 2, r = [];
      for (let k = 0; k < NS; k++) { const a = k / NS * TAU, u = cos(a) * c, v = sin(a) * th; r.push(m.v(pts[j][0] + C[0] * u + N[0] * v, pts[j][1] + C[1] * u + N[1] * v, pts[j][2] + C[2] * u + N[2] * v, min(0.5 + 0.5 * wgt * s, 1))); }
      rg.push(r);
    }
    for (let j = 0; j < rg.length - 1; j++) for (let k = 0; k < NS; k++) { const k2 = (k + 1) % NS; m.quad(rg[j][k], rg[j + 1][k], rg[j + 1][k2], rg[j][k2]); }
    const e = pts[pts.length - 1], tp = m.v(e[0], e[1], e[2], min(0.5 + 0.5 * wgt, 1)), l = rg[rg.length - 1];
    for (let k = 0; k < NS; k++) m.tri(l[k], tp, l[(k + 1) % NS]);
  };
  const spine = (root, dir, len, droop, n = 14) => Array.from({ length: n }, (_, j) => { const s = j / (n - 1); return [root[0] + dir[0] * len * s, root[1] + dir[1] * len * s - droop * len * s * s, root[2] + dir[2] * len * s]; });
  for (const sd of [-1, 1]) {
    // front flippers: long and narrow, swept back; rear flippers: short paddles
    const fr = [hl - P.L * 0.27, -0.01, sd * planW(0.27) * 0.85], fd = nrm([-0.38, -0.1, sd]);
    tube(spine(fr, fd, P.ff.len, 0.12), (s) => P.ff.c * (0.85 + 0.15 * sin(PI * s * 0.9)) * (1 - 0.6 * pow(s, 4)), (s) => P.ff.th * (1 - 0.45 * s) + 0.006, 1);
    const rr_ = [hl - P.L * 0.8, -0.01, sd * planW(0.8) * 0.6], rd = nrm([-0.75, -0.05, sd * 0.7]);
    tube(spine(rr_, rd, P.rf.len, 0.05, 9), (s) => P.rf.c * (0.75 + 0.25 * sin(PI * s * 0.9)) * (1 - 0.7 * pow(s, 3)) + 0.01, (s) => 0.022 * (1 - 0.6 * s) + 0.005, 0.3);
  }
  tube(spine([-hl + 0.03, 0.0, 0], [-1, -0.05, 0], P.tail, 0, 6), (s) => 0.05 * (1 - 0.85 * s) + 0.004, (s) => 0.05 * (1 - 0.85 * s) + 0.004, 0);
  // --- head on a short neck: rings of an ellipse, a blunt round head, or a narrow hooked beak (hawksbill)
  const x0 = hl - 0.04, NH = round(16 * ex), NHK = round(16 * ex) & ~1, hr = [], B = P.head;
  const rad = (u) => B.r * (1 + 0.25 * sin(PI * u * 0.9)) * (1 - pow(u, 3) * (0.65 + 0.15 * B.beak));
  const yc = (u) => -0.015 - B.drop * pow(u, 3) * 2 - 0.06 * B.beak * pow(u, 4);
  for (let j = 0; j < NH; j++) {
    const u = j / (NH - 1), x = x0 + B.len * u, r = [];
    for (let k = 0; k < NHK; k++) { const a = k / NHK * TAU; r.push(m.v(x, yc(u) + 0.8 * rad(u) * sin(a), rad(u) * cos(a), 0.5)); }
    hr.push(r);
  }
  for (let j = 0; j < NH - 1; j++) for (let k = 0; k < NHK; k++) { const k2 = (k + 1) % NHK; m.quad(hr[j][k], hr[j][k2], hr[j + 1][k2], hr[j + 1][k]); }
  { const tp = m.v(x0 + B.len + 0.012 + 0.012 * B.beak, yc(1) - 0.004 - 0.01 * B.beak, 0, 0.5), l = hr[NH - 1]; for (let k = 0; k < NHK; k++) m.tri(l[(k + 1) % NHK], tp, l[k]); }
  // eyes and the line of the mouth, on both sides
  const eu = 0.58;
  for (const sd of [-1, 1]) {
    const R = 0.011 + 0.004 * (1 - B.beak), cx = x0 + B.len * eu, cy = yc(eu) + 0.8 * rad(eu) * 0.32, cz = sd * (rad(eu) * 0.93 + 0.003), N = 8, M = 6, g = [];
    for (let i = 0; i <= M; i++) { const th = i / M * PI, r = []; for (let k = 0; k < N; k++) { const ph = k / N * TAU; r.push(m.v(cx + R * cos(th), cy + R * sin(th) * sin(ph), cz + R * sin(th) * cos(ph) * 0.8 + sd * 0.0, -1)); } g.push(r); }
    for (let i = 0; i < M; i++) for (let k = 0; k < N; k++) { const k2 = (k + 1) % N; m.quad(g[i][k], g[i + 1][k], g[i + 1][k2], g[i][k2]); }
    const pts = []; for (let j = 0; j <= 8; j++) { const u = 0.2 + 0.8 * j / 8, r = rad(u), yy = -0.35 * 0.8 * r; pts.push([x0 + B.len * u, yc(u) + yy, sd * (sqrt(max(r * r - (yy / 0.8) ** 2, 0)) + 0.002)]); }
    for (let j = 0; j < 8; j++) { const a = pts[j], b = pts[j + 1], q = [m.v(...a, -0.5), m.v(...b, -0.5), m.v(b[0], b[1] - 0.007, b[2], -0.5), m.v(a[0], a[1] - 0.007, a[2], -0.5)]; m.quad(q[0], q[1], q[2], q[3]); m.quad(q[0], q[3], q[2], q[1]); }
  }
  return m;
}
function meshFish() {
  const m = new Mesh();
  // body profile through the knots (Catmull-Rom), 12 rings of 10 sides (6 on Low)
  const KX = [0.5, 0.3, 0.05, -0.22, -0.34], KH = [0.01, 0.13, 0.17, 0.09, 0.035], KW = [0.01, 0.05, 0.065, 0.03, 0.012];
  const cr = (A, u) => { const i = min(floor(u), A.length - 2), t = u - i, p0 = A[max(i - 1, 0)], p1 = A[i], p2 = A[i + 1], p3 = A[min(i + 2, A.length - 1)];
    return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t); };
  const NR = LV > 1 ? 7 : 12, NK = LV > 1 ? 6 : 10, rings = [];
  for (let i = 0; i < NR; i++) {
    const x = 0.5 - 0.84 * i / (NR - 1); let u = 0; while (u < 3 && x < KX[u + 1]) u++;
    const q = u + (KX[u] - x) / (KX[u] - KX[u + 1]), h = max(cr(KH, q), 0.008), w = max(cr(KW, q), 0.008), r = [];
    for (let k = 0; k < NK; k++) { const a = k / NK * TAU; r.push(m.v(x, sin(a) * h, cos(a) * w)); }
    rings.push(r);
  }
  for (let i = 0; i < NR - 1; i++) for (let k = 0; k < NK; k++) { const k2 = (k + 1) % NK; m.quad(rings[i][k], rings[i + 1][k], rings[i + 1][k2], rings[i][k2]); }
  // flat fins, seen from both sides: forked tail, dorsal, and a pectoral on each side
  const T = (a, b, c) => { m.tri(m.v(...a), m.v(...b), m.v(...c)); m.tri(m.v(...a), m.v(...c), m.v(...b)); };
  T([-0.33, 0, 0], [-0.56, 0.2, 0], [-0.46, 0.02, 0]); T([-0.33, 0, 0], [-0.46, -0.02, 0], [-0.56, -0.2, 0]); T([-0.33, 0, 0], [-0.46, 0.02, 0], [-0.46, -0.02, 0]);
  T([0.14, 0.16, 0], [-0.1, 0.3, 0], [-0.17, 0.12, 0]);
  for (const sd of [-1, 1]) T([0.2, -0.04, sd * 0.05], [0.04, -0.1, sd * 0.15], [0.1, -0.05, sd * 0.06]);
  return m;
}
