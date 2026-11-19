// ============================================================================
// math + procedural helpers (load-time only unless noted)
// ============================================================================
const { sin, cos, sqrt, min, max, abs, floor, ceil, PI, pow, atan2, hypot, exp, round } = Math;
const TAU = PI * 2;
let _seed = 20261110;
const rnd = () => {
  _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rr = (a, b) => a + (b - a) * rnd();
// each generator system starts its own random stream, so the systems stay independent
const rseed = (s) => { _seed = (20261110 + Math.imul(s, 7919)) | 0; };
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };

const ihash = (x, y, z) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const vnoise = (x, y, z) => {
  const ix = floor(x), iy = floor(y), iz = floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const a = mix(mix(ihash(ix, iy, iz), ihash(ix + 1, iy, iz), fx), mix(ihash(ix, iy + 1, iz), ihash(ix + 1, iy + 1, iz), fx), fy);
  const b = mix(mix(ihash(ix, iy, iz + 1), ihash(ix + 1, iy, iz + 1), fx), mix(ihash(ix, iy + 1, iz + 1), ihash(ix + 1, iy + 1, iz + 1), fx), fy);
  return mix(a, b, fz);
};
const fbm = (x, y, z, o = 4) => {
  let a = 0.5, s = 0;
  for (let i = 0; i < o; i++) { s += a * vnoise(x, y, z); x = x * 2.03 + 17.1; y = y * 2.03 + 31.7; z = z * 2.03 + 5.3; a *= 0.5; }
  return s / (1 - 2 * a);
};

// quaternion helpers (return plain arrays; load-time only)
const qAxis = (x, y, z, a) => { const l = hypot(x, y, z) || 1, s = sin(a / 2) / l; return [x * s, y * s, z * s, cos(a / 2)]; };
const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qRand = () => { const q = [rr(-1, 1), rr(-1, 1), rr(-1, 1), rr(-1, 1)]; const l = hypot(...q) || 1; return q.map((v) => v / l); };
// shortest rotation taking +Y to n
const qFromY = (nx, ny, nz) => {
  if (ny < -0.9999) return [1, 0, 0, 0];
  const q = [nz, 0, -nx, 1 + ny]; const l = hypot(...q); return q.map((v) => v / l);
};

// world grid
// The world is endless: a window of CHK-metre square chunks around the camera is generated on demand. Voxels are VS
// metres, on a grid anchored at the world origin (chunk i covers voxels CVX*i .. CVX*i+CVX-1). A chunk's density grid
// is GN voxels wide: its CVX core voxels plus MG on each side, so neighbouring chunks agree on the rock between them.
// NY reaches 15 m above the sea so that islands can rise out of it.
const NY = 96, VS = 0.75, OY = -56, CHK = 96, CVX = 128, MG = 4, GN = CVX + 2 * MG;
const YTOP = OY + (NY - 1) * VS;
const CELLS = 4, CELLW = 24; // culling grid over XZ, per chunk
const RAD = 2, KS = 7; // chunks kept around the camera's (radius), and chunk slots per side in the windowed textures
const NCHUNK = 7; // 3 small + 3 large rock chunk meshes + pebbles

// ---------------------------------------------------------------- ocean swell
// A sum of Gerstner waves: long swells from one direction with a spread of shorter ones across it. Deep-water dispersion
// (w = sqrt(g k)) sets each wave's speed, so the long ones outrun the short ones as at sea. Per wave: wavelength (m),
// amplitude (m), angle from the main direction (rad), phase. The same numbers drive the surface mesh (shaders.js) and
// the swimmer's ceiling (swellY), so the two always agree.
const SWELL_DIR = 0.55, SWELL_Q = 3; // Q: crest sharpness, sum of Q k A stays well below 1 so crests never fold over
const SWELL = [[150, 0.42, 0, 0], [96, 0.3, 0.22, 1.9], [64, 0.2, -0.3, 4.1], [41, 0.13, 0.45, 0.7],
  [27, 0.08, -0.55, 2.8], [18, 0.055, 0.8, 5.3], [12.5, 0.035, -0.9, 3.6], [8.7, 0.022, 1.2, 0.4]]
  .map(([L, A, a, ph]) => { const k = TAU / L; return [cos(SWELL_DIR + a), sin(SWELL_DIR + a), k, A, sqrt(9.81 * k), ph, L]; });
// the surface mesh: rings x segments of a disc around the camera
const SURF_R = LV > 1 ? 64 : 96, SURF_S = LV > 1 ? 96 : 128;
// height of the surface above (x, z) at time t: Gerstner waves also move water sideways, so first find the rest point
// that ends up over (x, z) (a few fixed-point steps), then take its height
function swellY(x, z, t) {
  let px = x, pz = z, y = 0;
  for (let it = 0; it < 4; it++) {
    let dx = 0, dz = 0; y = 0;
    for (const [Dx, Dz, k, A, w, ph] of SWELL) {
      const th = k * (Dx * px + Dz * pz) - w * t + ph, c = cos(th);
      dx += SWELL_Q * A * Dx * c; dz += SWELL_Q * A * Dz * c; y += A * sin(th);
    }
    px = x - dx; pz = z - dz;
  }
  return y;
}

// ---------------------------------------------------------------- sandy islands
// One candidate per ISLE m square cell (about half of them have one), none near the start, plus one designed island east
// of it. An island is [x, z, R, H, p1, p2, p3]: coast radius R (the coast wanders +-27% around it with the angle), peak
// H m above the sea, phases p1..p3 for the coast and the dunes. Its height profile (isleH, and isl in the density shader,
// which must agree) is a dome of dunes on land, then a sandy shelf that drops to the sea floor within ISLE_SLOPE m.
const ISLE = 320, ISLE_SLOPE = 62;
const ISLANDS = [[200, -20, 42, 7.5, 1.1, 4.2, 2.6]];
const isleFoot = (I) => I[2] * 1.27 + ISLE_SLOPE;
function islesNear(x0, z0, x1, z1) {
  const out = [];
  const hit = (I) => { const r = isleFoot(I); return I[0] + r > x0 && I[0] - r < x1 && I[1] + r > z0 && I[1] - r < z1; };
  for (const I of ISLANDS) if (hit(I)) out.push(I);
  for (let a = floor((x0 - 200) / ISLE); a <= floor((x1 + 200) / ISLE); a++) for (let b = floor((z0 - 200) / ISLE); b <= floor((z1 + 200) / ISLE); b++) {
    const r = (k) => ihash(a, b, 90 + k), x = (a + 0.25 + 0.5 * r(1)) * ISLE, z = (b + 0.25 + 0.5 * r(2)) * ISLE, R = 26 + 30 * r(3);
    if (r(0) > 0.5 || hypot(x, z) < 330 + R) continue;
    const I = [x, z, R, min(3 + R * 0.12 * (0.4 + r(4)), 10.5), r(5) * TAU, r(6) * TAU, r(7) * TAU];
    if (hit(I)) out.push(I);
  }
  return out;
}
// height of the island ground (without the rock) at (x, z): -1e3 away from all of them
function isleH(isles, x, z) {
  let h = -1e3;
  for (const [cx, cz, R, H, p1, p2, p3] of isles) {
    const dx = x - cx, dz = z - cz, r = hypot(dx, dz), th = atan2(dz, dx);
    const Rm = R * (1 + 0.14 * sin(3 * th + p1) + 0.08 * sin(5 * th + p2) + 0.05 * sin(8 * th + p3)), e = r - Rm;
    let y;
    if (e < 0) {
      const s = r / Rm, b = H * pow(max(1 - s * s, 0), 1.4);
      y = b + (sin(x * 0.21 + p1 * 3) * sin(z * 0.17 + p2 * 3) * 0.5 + sin((x * 0.6 - z * 0.8) * 0.11 + p3) * 0.4) * sstep(0.3, 2.5, b);
    } else y = -0.09 * e - 0.012 * e * e;
    h = max(h, y);
  }
  return h;
}

// ---------------------------------------------------------------- naive surface nets
// D: scalar field (>0 inside), dims nx,ny,nz. Returns grid-space positions + triangle indices.
// Quads are made for the edges that start in [x0,x1) x [z0,z1) only, so every edge belongs to exactly one chunk.
function* surfaceNets(D, nx, ny, nz, x0, x1, z0, z1) {
  let pos = new Float32Array(1 << 20), nv = 0;
  let idx = new Uint32Array(1 << 21), ni = 0;
  const sl = nx * ny;
  let cur = new Int32Array(sl), prev = new Int32Array(sl);
  for (let z = 0; z < nz - 1; z++) {
    if (!(z & 3)) yield;
    for (let y = 0; y < ny - 1; y++) {
      let i0 = nx * (y + ny * z);
      for (let x = 0; x < nx - 1; x++, i0++) {
        const d0 = D[i0], d1 = D[i0 + 1], d2 = D[i0 + nx], d3 = D[i0 + nx + 1];
        const d4 = D[i0 + sl], d5 = D[i0 + sl + 1], d6 = D[i0 + sl + nx], d7 = D[i0 + sl + nx + 1];
        const m = (d0 > 0) | ((d1 > 0) << 1) | ((d2 > 0) << 2) | ((d3 > 0) << 3) | ((d4 > 0) << 4) | ((d5 > 0) << 5) | ((d6 > 0) << 6) | ((d7 > 0) << 7);
        if (m === 0 || m === 255) continue;
        let sx = 0, sy = 0, sz = 0, n = 0, t;
        if ((d0 > 0) !== (d1 > 0)) { t = d0 / (d0 - d1); sx += t; n++; }
        if ((d2 > 0) !== (d3 > 0)) { t = d2 / (d2 - d3); sx += t; sy += 1; n++; }
        if ((d4 > 0) !== (d5 > 0)) { t = d4 / (d4 - d5); sx += t; sz += 1; n++; }
        if ((d6 > 0) !== (d7 > 0)) { t = d6 / (d6 - d7); sx += t; sy += 1; sz += 1; n++; }
        if ((d0 > 0) !== (d2 > 0)) { t = d0 / (d0 - d2); sy += t; n++; }
        if ((d1 > 0) !== (d3 > 0)) { t = d1 / (d1 - d3); sy += t; sx += 1; n++; }
        if ((d4 > 0) !== (d6 > 0)) { t = d4 / (d4 - d6); sy += t; sz += 1; n++; }
        if ((d5 > 0) !== (d7 > 0)) { t = d5 / (d5 - d7); sy += t; sx += 1; sz += 1; n++; }
        if ((d0 > 0) !== (d4 > 0)) { t = d0 / (d0 - d4); sz += t; n++; }
        if ((d1 > 0) !== (d5 > 0)) { t = d1 / (d1 - d5); sz += t; sx += 1; n++; }
        if ((d2 > 0) !== (d6 > 0)) { t = d2 / (d2 - d6); sz += t; sy += 1; n++; }
        if ((d3 > 0) !== (d7 > 0)) { t = d3 / (d3 - d7); sz += t; sx += 1; sy += 1; n++; }
        if (nv * 3 + 3 > pos.length) { const p2 = new Float32Array(pos.length * 2); p2.set(pos); pos = p2; }
        const vi = nv++;
        pos[vi * 3] = x + sx / n; pos[vi * 3 + 1] = y + sy / n; pos[vi * 3 + 2] = z + sz / n;
        const ci = x + nx * y;
        cur[ci] = vi;
        if (ni + 18 > idx.length) { const i2 = new Uint32Array(idx.length * 2); i2.set(idx); idx = i2; }
        const s0 = d0 > 0;
        let a, b, c, d;
        const own = x >= x0 && x < x1 && z >= z0 && z < z1;
        if (own && (d1 > 0) !== s0 && y > 0 && z > 0) {
          a = vi; b = cur[ci - nx]; c = prev[ci - nx]; d = prev[ci];
          if (s0) { idx[ni++] = a; idx[ni++] = b; idx[ni++] = c; idx[ni++] = a; idx[ni++] = c; idx[ni++] = d; }
          else { idx[ni++] = a; idx[ni++] = c; idx[ni++] = b; idx[ni++] = a; idx[ni++] = d; idx[ni++] = c; }
        }
        if (own && (d2 > 0) !== s0 && x > 0 && z > 0) {
          a = vi; b = prev[ci]; c = prev[ci - 1]; d = cur[ci - 1];
          if (s0) { idx[ni++] = a; idx[ni++] = b; idx[ni++] = c; idx[ni++] = a; idx[ni++] = c; idx[ni++] = d; }
          else { idx[ni++] = a; idx[ni++] = c; idx[ni++] = b; idx[ni++] = a; idx[ni++] = d; idx[ni++] = c; }
        }
        if (own && (d4 > 0) !== s0 && x > 0 && y > 0) {
          a = vi; b = cur[ci - 1]; c = cur[ci - 1 - nx]; d = cur[ci - nx];
          if (s0) { idx[ni++] = a; idx[ni++] = b; idx[ni++] = c; idx[ni++] = a; idx[ni++] = c; idx[ni++] = d; }
          else { idx[ni++] = a; idx[ni++] = c; idx[ni++] = b; idx[ni++] = a; idx[ni++] = d; idx[ni++] = c; }
        }
      }
    }
    const tmp = cur; cur = prev; prev = tmp;
  }
  return { pos: pos.subarray(0, nv * 3), idx: idx.subarray(0, ni), nv, ni };
}

// the whole grid at once, without waiting between slices
function surfaceNetsAll(D, nx, ny, nz) { const g = surfaceNets(D, nx, ny, nz, 0, nx, 0, nz); let r; while (!(r = g.next()).done); return r.value; }

// trilinear sampler factory over a scalar grid (grid coords)
const sampler3 = (D, nx, ny, nz) => (x, y, z) => {
  x = clamp(x, 0, nx - 1.001); y = clamp(y, 0, ny - 1.001); z = clamp(z, 0, nz - 1.001);
  const ix = x | 0, iy = y | 0, iz = z | 0, fx = x - ix, fy = y - iy, fz = z - iz;
  const i = ix + nx * (iy + ny * iz), sl = nx * ny;
  const a = mix(mix(D[i], D[i + 1], fx), mix(D[i + nx], D[i + nx + 1], fx), fy);
  const b = mix(mix(D[i + sl], D[i + sl + 1], fx), mix(D[i + sl + nx], D[i + sl + nx + 1], fx), fy);
  return mix(a, b, fz);
};

// ---------------------------------------------------------------- mesh builder (solid vertex format: f32x3 pos, snorm8x4 normal+aux)
class Mesh {
  constructor() { this.p = []; this.i = []; this.aux = []; }
  v(x, y, z, aux = 1) { this.p.push(x, y, z); this.aux.push(aux); return this.p.length / 3 - 1; }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  // box-section sweep along a polyline; faces get their own vertices (hard edges)
  sweep(pts, w, h, upFn, caps = true) {
    const rings = [];
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k], a = pts[max(k - 1, 0)], b = pts[min(k + 1, pts.length - 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2]; const tl = hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      const u0 = upFn ? upFn(p, k) : [0, 1, 0];
      let sx = u0[1] * tz - u0[2] * ty, sy = u0[2] * tx - u0[0] * tz, sz = u0[0] * ty - u0[1] * tx; const sl = hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
      const ux = ty * sz - tz * sy, uy = tz * sx - tx * sz, uz = tx * sy - ty * sx;
      const ww = typeof w === 'function' ? w(k) : w, hh = typeof h === 'function' ? h(k) : h;
      const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([e, f]) => [p[0] + sx * e * ww / 2 + ux * f * hh / 2, p[1] + sy * e * ww / 2 + uy * f * hh / 2, p[2] + sz * e * ww / 2 + uz * f * hh / 2]);
      const r = [];
      for (let s = 0; s < 4; s++) { r.push(this.v(...c[s]), this.v(...c[(s + 1) % 4])); }
      rings.push(r);
      if (caps && (k === 0 || k === pts.length - 1)) {
        const q = c.map((cc) => this.v(...cc));
        if (k === 0) this.quad(q[0], q[1], q[2], q[3]); else this.quad(q[3], q[2], q[1], q[0]);
      }
    }
    for (let k = 0; k < rings.length - 1; k++) for (let s = 0; s < 4; s++) {
      const a = rings[k][s * 2], b = rings[k][s * 2 + 1], c = rings[k + 1][s * 2 + 1], d = rings[k + 1][s * 2];
      this.quad(a, d, c, b);
    }
  }
  // round tube along polyline with radius function
  tube(pts, rad, sides = 6, capEnd = true, auxFn = null) {
    const rings = [];
    let ux = 0.31, uy = 0.9, uz = 0.3;
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k], a = pts[max(k - 1, 0)], b = pts[min(k + 1, pts.length - 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2]; const tl = hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      let sx = uy * tz - uz * ty, sy = uz * tx - ux * tz, sz = ux * ty - uy * tx; const sl = hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
      ux = ty * sz - tz * sy; uy = tz * sx - tx * sz; uz = tx * sy - ty * sx;
      const r = typeof rad === 'function' ? rad(k) : rad, ring = [];
      for (let s = 0; s < sides; s++) { const an = s / sides * TAU; ring.push(this.v(p[0] + (sx * cos(an) + ux * sin(an)) * r, p[1] + (sy * cos(an) + uy * sin(an)) * r, p[2] + (sz * cos(an) + uz * sin(an)) * r, auxFn ? auxFn(k) : min(1, 0.35 + 0.65 * k / (pts.length - 1)))); }
      rings.push(ring);
    }
    for (let k = 0; k < rings.length - 1; k++) for (let s = 0; s < sides; s++) {
      const s2 = (s + 1) % sides; this.quad(rings[k][s], rings[k][s2], rings[k + 1][s2], rings[k + 1][s]);
    }
    if (capEnd) { const e = pts[pts.length - 1], c = this.v(e[0], e[1], e[2], auxFn ? auxFn(pts.length - 1) : 1); const r = rings[rings.length - 1]; for (let s = 0; s < sides; s++) this.tri(r[s], r[(s + 1) % sides], c); }
  }
  // returns {vb: ArrayBuffer, ib: Uint32Array}; normals area-weighted; aux -> normal.w
  build(nrmFn) {
    const n = this.p.length / 3, P = this.p, I = this.i, N = new Float32Array(n * 3);
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const k of [a, b, c]) { N[k] += nx; N[k + 1] += ny; N[k + 2] += nz; }
    }
    const vb = new ArrayBuffer(n * 16), f = new Float32Array(vb), s = new Int8Array(vb);
    for (let k = 0; k < n; k++) {
      let nx = N[k * 3], ny = N[k * 3 + 1], nz = N[k * 3 + 2];
      if (nrmFn) { const q = nrmFn(P[k * 3], P[k * 3 + 1], P[k * 3 + 2], nx, ny, nz); nx = q[0]; ny = q[1]; nz = q[2]; }
      const l = hypot(nx, ny, nz) || 1;
      f[k * 4] = P[k * 3]; f[k * 4 + 1] = P[k * 3 + 1]; f[k * 4 + 2] = P[k * 3 + 2];
      s[k * 16 + 12] = round(nx / l * 127); s[k * 16 + 13] = round(ny / l * 127); s[k * 16 + 14] = round(nz / l * 127); s[k * 16 + 15] = round(clamp(this.aux[k], -1, 1) * 127);
    }
    return { vb, ib: new Uint32Array(I), nv: n };
  }
}

// icosphere with shared vertices
function icosphere(sub, fn) {
  const m = new Mesh(), t = (1 + sqrt(5)) / 2;
  let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((v) => { const l = hypot(...v); return v.map((c) => c / l); });
  let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < sub; s++) {
    const cache = new Map(), F2 = [];
    const mid = (a, b) => {
      const key = a < b ? a * 65536 + b : b * 65536 + a;
      let r = cache.get(key);
      if (r === undefined) { const p = [0, 1, 2].map((k) => V[a][k] + V[b][k]); const l = hypot(...p); V.push(p.map((c) => c / l)); r = V.length - 1; cache.set(key, r); }
      return r;
    };
    for (const [a, b, c] of F) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); F2.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    F = F2;
  }
  for (const v of V) { const p = fn ? fn(v[0], v[1], v[2]) : v; m.v(p[0], p[1], p[2]); }
  for (const f of F) m.tri(f[0], f[1], f[2]);
  return m;
}
