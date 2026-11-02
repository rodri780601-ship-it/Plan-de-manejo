/* ==========================================================================
   Geo: proyecciones (WGS84 geográficas, UTM, Web Mercator), operaciones
   geométricas planas en UTM, lectura/escritura de Shapefile (SHP/SHX/DBF/
   PRJ/CPG), KML y GeoJSON. Sin dependencias.
   ========================================================================== */
'use strict';

const Geo = (() => {
  /* ---------------- Proyecciones ---------------- */
  const A = 6378137, F = 1 / 298.257223563, E2 = F * (2 - F), EP2 = E2 / (1 - E2), K0 = 0.9996;
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const zoneOf = lon => Math.floor((lon + 180) / 6) + 1;
  function toUTM(lon, lat, zone, south = true) {
    zone = zone || zoneOf(lon);
    const phi = lat * D2R, lam = lon * D2R, lam0 = ((zone - 1) * 6 - 180 + 3) * D2R;
    const sin = Math.sin(phi), cos = Math.cos(phi), tan = Math.tan(phi);
    const N = A / Math.sqrt(1 - E2 * sin * sin), T = tan * tan, C = EP2 * cos * cos, Aa = cos * (lam - lam0);
    const e4 = E2 * E2, e6 = e4 * E2;
    const M = A * ((1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi - (3 * E2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi) + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi) - (35 * e6 / 3072) * Math.sin(6 * phi));
    const x = K0 * N * (Aa + (1 - T + C) * Aa ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Aa ** 5 / 120) + 500000;
    let y = K0 * (M + N * tan * (Aa * Aa / 2 + (5 - T + 9 * C + 4 * C * C) * Aa ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Aa ** 6 / 720));
    if (south) y += 10000000;
    return [x, y];
  }
  function fromUTM(x, y, zone, south = true) {
    const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
    x -= 500000; if (south) y -= 10000000;
    const M = y / K0, e4 = E2 * E2, e6 = e4 * E2;
    const mu = M / (A * (1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256));
    const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
    const sin = Math.sin(p1), cos = Math.cos(p1), tan = Math.tan(p1);
    const N1 = A / Math.sqrt(1 - E2 * sin * sin), T1 = tan * tan, C1 = EP2 * cos * cos, R1 = A * (1 - E2) / Math.pow(1 - E2 * sin * sin, 1.5), D = x / (N1 * K0);
    const lat = p1 - (N1 * tan / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6 / 720);
    const lon = (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5 / 120) / cos;
    return [((zone - 1) * 6 - 180 + 3) + lon * R2D, lat * R2D];
  }
  const RM = 6378137;
  const merc = (lon, lat) => [RM * lon * D2R, RM * Math.log(Math.tan(Math.PI / 4 + Math.max(-85.06, Math.min(85.06, lat)) * D2R / 2))];
  const unmerc = (x, y) => [x / RM * R2D, (2 * Math.atan(Math.exp(y / RM)) - Math.PI / 2) * R2D];

  /* ---------------- Recorrer geometrías ---------------- */
  function mapCoords(g, fn) {
    const m = c => fn(c[0], c[1]);
    switch (g.type) {
      case 'Point': return { type: g.type, coordinates: m(g.coordinates) };
      case 'MultiPoint': case 'LineString': return { type: g.type, coordinates: g.coordinates.map(m) };
      case 'MultiLineString': case 'Polygon': return { type: g.type, coordinates: g.coordinates.map(r => r.map(m)) };
      case 'MultiPolygon': return { type: g.type, coordinates: g.coordinates.map(p => p.map(r => r.map(m))) };
    }
    return g;
  }
  const geomToUTM = (g, zone) => mapCoords(g, (x, y) => toUTM(x, y, zone));
  const geomFromUTM = (g, zone) => mapCoords(g, (x, y) => fromUTM(x, y, zone));
  function allCoords(g) {
    const out = []; const walk = a => { if (typeof a[0] === 'number') out.push(a); else a.forEach(walk); }; walk(g.coordinates); return out;
  }
  function bbox(g) {
    const c = allCoords(g); if (!c.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of c) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    return [x0, y0, x1, y1];
  }
  function mergeBbox(a, b) { if (!a) return b; if (!b) return a; return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]; }
  const polys = g => g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  const lines = g => g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : [];
  const points = g => g.type === 'Point' ? [g.coordinates] : g.type === 'MultiPoint' ? g.coordinates : [];

  /* ---------------- Medidas en plano UTM ---------------- */
  function ringArea(r) { let s = 0; for (let i = 0, n = r.length; i < n - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return s / 2; }
  function area(g) { return polys(g).reduce((s, p) => s + Math.abs(ringArea(p[0])) - p.slice(1).reduce((a, h) => a + Math.abs(ringArea(h)), 0), 0); }
  function length(g) { let s = 0; for (const l of (g.type === 'LineString' || g.type === 'MultiLineString') ? lines(g) : []) for (let i = 1; i < l.length; i++) s += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]); return s; }
  function centroid(g) {
    if (g.type === 'Point') return g.coordinates;
    const ps = polys(g);
    if (ps.length) {
      let best = null, ba = -1; for (const p of ps) { const a = Math.abs(ringArea(p[0])); if (a > ba) { ba = a; best = p[0]; } }
      let cx = 0, cy = 0, a6 = 0; for (let i = 0; i < best.length - 1; i++) { const f = best[i][0] * best[i + 1][1] - best[i + 1][0] * best[i][1]; cx += (best[i][0] + best[i + 1][0]) * f; cy += (best[i][1] + best[i + 1][1]) * f; a6 += f * 3; }
      const c = a6 ? [cx / a6, cy / a6] : best[0];
      return pointInPolygon(c, { type: 'Polygon', coordinates: [best] }) ? c : interiorPoint(best);
    }
    const c = allCoords(g); if (!c.length) return null;
    const ls = lines(g); if (ls.length) { const l = ls[0]; return l[Math.floor(l.length / 2)]; }
    return [c.reduce((s, p) => s + p[0], 0) / c.length, c.reduce((s, p) => s + p[1], 0) / c.length];
  }
  function interiorPoint(ring) {
    const b = bbox({ type: 'LineString', coordinates: ring }), y = (b[1] + b[3]) / 2, xs = [];
    for (let i = 0; i < ring.length - 1; i++) { const [x1, y1] = ring[i], [x2, y2] = ring[i + 1]; if ((y1 > y) !== (y2 > y)) xs.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1)); }
    xs.sort((a, b) => a - b); return xs.length >= 2 ? [(xs[0] + xs[1]) / 2, y] : ring[0];
  }
  function pointInRing(p, r) {
    let inside = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
      if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function pointInPolygon(p, g) { return polys(g).some(poly => pointInRing(p, poly[0]) && !poly.slice(1).some(h => pointInRing(p, h))); }
  function segDist(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }
  function segInter(a, b, c, d) {
    const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
    if (Math.abs(den) < 1e-12) return null;
    const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { t, u, p: [a[0] + t * r[0], a[1] + t * r[1]] };
  }
  function boundaryDist(p, g) { let m = Infinity; for (const l of lines(g)) for (let i = 1; i < l.length; i++) m = Math.min(m, segDist(p, l[i - 1], l[i])); return m; }
  /** distancia mínima entre dos geometrías (0 si se intersectan) */
  function distance(g1, g2) {
    const P1 = points(g1), P2 = points(g2), L1 = lines(g1), L2 = lines(g2);
    if (polys(g2).length && allCoords(g1).some(p => pointInPolygon(p, g2))) return 0;
    if (polys(g1).length && allCoords(g2).some(p => pointInPolygon(p, g1))) return 0;
    let m = Infinity;
    const segs = L => { const o = []; for (const l of L) for (let i = 1; i < l.length; i++) o.push([l[i - 1], l[i]]); return o; };
    const S1 = segs(L1), S2 = segs(L2);
    for (const [a, b] of S1) for (const [c, d] of S2) { if (segInter(a, b, c, d)) return 0; m = Math.min(m, segDist(a, c, d), segDist(b, c, d), segDist(c, a, b), segDist(d, a, b)); }
    for (const p of P1) { for (const [c, d] of S2) m = Math.min(m, segDist(p, c, d)); for (const q of P2) m = Math.min(m, Math.hypot(p[0] - q[0], p[1] - q[1])); }
    for (const q of P2) for (const [a, b] of S1) m = Math.min(m, segDist(q, a, b));
    return m;
  }
  /** Autointersecciones de anillos (polígono no válido) */
  function selfIntersections(g) {
    const out = [];
    for (const poly of polys(g)) for (const r of poly) {
      const n = r.length - 1;
      for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const x = segInter(r[i], r[i + 1], r[j], r[j + 1]); if (x) out.push(x.p);
      }
    }
    for (const l of (g.type === 'LineString' ? [g.coordinates] : [])) { /* líneas pueden cruzarse */ }
    return out;
  }
  /** ¿g está contenido en container? tolerancia en metros */
  function within(g, container, tol = 0.5) {
    for (const p of allCoords(g)) if (!pointInPolygon(p, container) && boundaryDist(p, container) > tol) return false;
    for (const l1 of lines(g)) for (const l2 of lines(container)) for (let i = 1; i < l1.length; i++) for (let j = 1; j < l2.length; j++) {
      const x = segInter(l1[i - 1], l1[i], l2[j - 1], l2[j]);
      if (x && x.t > 1e-6 && x.t < 1 - 1e-6 && x.u > 1e-6 && x.u < 1 - 1e-6) {
        const mid1 = [(l1[i - 1][0] + x.p[0]) / 2, (l1[i - 1][1] + x.p[1]) / 2], mid2 = [(l1[i][0] + x.p[0]) / 2, (l1[i][1] + x.p[1]) / 2];
        if ((!pointInPolygon(mid1, container) && boundaryDist(mid1, container) > tol) || (!pointInPolygon(mid2, container) && boundaryDist(mid2, container) > tol)) return false;
      }
    }
    return true;
  }
  /** superficie aproximada de traslape entre polígonos (m²), 0 si sólo comparten borde */
  function overlapArea(g1, g2) {
    const b1 = bbox(g1), b2 = bbox(g2);
    if (!b1 || !b2 || b1[2] <= b2[0] || b2[2] <= b1[0] || b1[3] <= b2[1] || b2[3] <= b1[1]) return 0;
    let s = 0;
    for (const p1 of polys(g1)) for (const p2 of polys(g2)) for (const r of clipPolygon(p1[0], p2[0])) s += Math.abs(ringArea(r));
    return s;
  }

  /* ---------------- Recorte de polígonos (Greiner–Hormann) ---------------- */
  function clipPolygon(subject, clip) {
    const close = r => (r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) ? r.slice(0, -1) : r.slice();
    let S = close(subject), C = close(clip);
    // perturbación mínima para evitar degeneraciones (vértices sobre aristas)
    const eps = 1e-7;
    C = C.map(([x, y], i) => [x + eps * ((i * 7919) % 13 - 6) * 0.13, y + eps * ((i * 104729) % 11 - 5) * 0.17]);
    const mk = (pts) => { const nodes = pts.map(p => ({ x: p[0], y: p[1], inter: false, entry: false, neighbor: null, alpha: 0, visited: false })); nodes.forEach((n, i) => { n.next = nodes[(i + 1) % nodes.length]; n.prev = nodes[(i - 1 + nodes.length) % nodes.length]; }); return nodes; };
    const sN = mk(S), cN = mk(C);
    const insert = (start, end, node) => { let cur = start.next; while (cur !== end && cur.alpha < node.alpha) cur = cur.next; node.next = cur; node.prev = cur.prev; cur.prev.next = node; cur.prev = node; };
    let any = false;
    for (const s0 of sN) {
      const s1 = s0.next.inter ? null : null;
      let sEnd = s0.next; while (sEnd.inter) sEnd = sEnd.next;
      for (const c0 of cN) {
        let cEnd = c0.next; while (cEnd.inter) cEnd = cEnd.next;
        const x = segInter([s0.x, s0.y], [sEnd.x, sEnd.y], [c0.x, c0.y], [cEnd.x, cEnd.y]);
        if (x && x.t > 0 && x.t < 1 && x.u > 0 && x.u < 1) {
          any = true;
          const a = { x: x.p[0], y: x.p[1], inter: true, alpha: x.t, visited: false }, b = { x: x.p[0], y: x.p[1], inter: true, alpha: x.u, visited: false };
          a.neighbor = b; b.neighbor = a; insert(s0, sEnd, a); insert(c0, cEnd, b);
        }
      }
    }
    if (!any) {
      if (pointInRing(S[0], C.concat([C[0]]))) return [S.concat([S[0]])];
      if (pointInRing(C[0], S.concat([S[0]]))) return [C.concat([C[0]])];
      return [];
    }
    const mark = (startNode, other) => {
      let inside = pointInRing([startNode.x, startNode.y], other.concat([other[0]]));
      let n = startNode;
      do { if (n.inter) { n.entry = !inside; inside = !inside; } n = n.next; } while (n !== startNode);
    };
    mark(sN[0], C); mark(cN[0], S);
    const result = [];
    const firstUnvisited = () => { let n = sN[0]; do { if (n.inter && !n.visited) return n; n = n.next; } while (n !== sN[0]); return null; };
    let cur;
    while ((cur = firstUnvisited())) {
      const ring = []; let n = cur;
      let guard = 0;
      do {
        n.visited = true; if (n.neighbor) n.neighbor.visited = true;
        ring.push([n.x, n.y]);
        if (n.entry) { do { n = n.next; ring.push([n.x, n.y]); if (n.inter) { n.visited = true; if (n.neighbor) n.neighbor.visited = true; } } while (!n.inter); }
        else { do { n = n.prev; ring.push([n.x, n.y]); if (n.inter) { n.visited = true; if (n.neighbor) n.neighbor.visited = true; } } while (!n.inter); }
        n = n.neighbor;
        if (++guard > 10000) break;
      } while (!(n.x === cur.x && n.y === cur.y) || !n.visited && false);
      const clean = []; for (const p of ring) { const l = clean[clean.length - 1]; if (!l || Math.hypot(l[0] - p[0], l[1] - p[1]) > 1e-6) clean.push(p); }
      while (clean.length > 1 && Math.hypot(clean[0][0] - clean[clean.length - 1][0], clean[0][1] - clean[clean.length - 1][1]) < 1e-6) clean.pop();
      if (clean.length >= 3) { clean.push(clean[0]); if (Math.abs(ringArea(clean)) > 1e-6) result.push(clean); }
    }
    return result;
  }
  function clipLine(line, poly) {
    const out = []; let cur = [];
    const inside = p => pointInPolygon(p, poly);
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i], ts = [0, 1];
      for (const l of lines(poly)) for (let j = 1; j < l.length; j++) { const x = segInter(a, b, l[j - 1], l[j]); if (x) ts.push(x.t); }
      ts.sort((x, y) => x - y);
      for (let k = 1; k < ts.length; k++) {
        const t0 = ts[k - 1], t1 = ts[k]; if (t1 - t0 < 1e-9) continue;
        const pt = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        if (inside(pt((t0 + t1) / 2))) { const p0 = pt(t0), p1 = pt(t1); if (!cur.length) cur.push(p0); cur.push(p1); }
        else if (cur.length) { if (cur.length > 1) out.push(cur); cur = []; }
      }
    }
    if (cur.length > 1) out.push(cur);
    return out;
  }
  /** Recorta una geometría UTM al polígono contenedor; devuelve geometría o null */
  function clipTo(g, container) {
    if (g.type === 'Point') return pointInPolygon(g.coordinates, container) ? g : null;
    if (g.type === 'MultiPoint') { const c = g.coordinates.filter(p => pointInPolygon(p, container)); return c.length ? { type: 'MultiPoint', coordinates: c } : null; }
    if (g.type === 'LineString' || g.type === 'MultiLineString') {
      const parts = lines(g).flatMap(l => clipLine(l, container));
      return !parts.length ? null : parts.length === 1 ? { type: 'LineString', coordinates: parts[0] } : { type: 'MultiLineString', coordinates: parts };
    }
    const parts = [];
    for (const p of polys(g)) for (const cp of polys(container)) for (const r of clipPolygon(p[0], cp[0])) parts.push([r]);
    return !parts.length ? null : parts.length === 1 ? { type: 'Polygon', coordinates: parts[0] } : { type: 'MultiPolygon', coordinates: parts };
  }
  function circle(c, r, n = 72) { const ring = []; for (let i = 0; i <= n; i++) { const a = 2 * Math.PI * i / n; ring.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); } return { type: 'Polygon', coordinates: [ring] }; }

  /* ---------------- PRJ ---------------- */
  function prjUTM(zone) {
    const cm = zone * 6 - 183;
    return `PROJCS["WGS_1984_UTM_Zone_${zone}S",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",10000000.0],PARAMETER["Central_Meridian",${cm}.0],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]`;
  }
  function parsePrj(txt) {
    if (!txt) return { kind: 'unknown' };
    const t = txt.replace(/\s+/g, ' ');
    const wgs = /WGS[_ ]?(19)?84|WGS 84|SIRGAS/i.test(t);
    const datum = (t.match(/DATUM\["([^"]+)"/i) || [])[1] || '';
    if (/PROJCS/i.test(t)) {
      let zone = null, south = /False_Northing",\s*10000000|south|Zone_\d+S|zone \d+S/i.test(t);
      const m = t.match(/UTM[_ ]zone[_ ](\d{1,2})\s*([NS])?/i); if (m) { zone = Number(m[1]); if (m[2]) south = m[2].toUpperCase() === 'S'; }
      const cm = t.match(/Central_Meridian",\s*(-?[\d.]+)/i); if (!zone && cm) zone = Math.round((Number(cm[1]) + 183) / 6);
      if (!/Transverse_Mercator|UTM/i.test(t)) return { kind: 'other', wgs, datum, txt };
      return { kind: 'utm', zone, south, wgs, datum };
    }
    if (/GEOGCS/i.test(t)) return { kind: 'geo', wgs, datum };
    return { kind: 'unknown' };
  }

  /* ---------------- Lectura de Shapefile ---------------- */
  function parseShp(buf) {
    const dv = new DataView(buf), out = [];
    let p = 100;
    while (p + 8 <= buf.byteLength) {
      const len = dv.getInt32(p + 4, false) * 2; const s = p + 8; p = s + len;
      if (s + 4 > buf.byteLength) break;
      const type = dv.getInt32(s, true);
      if (type === 0) { out.push(null); continue; }
      if (type === 1 || type === 11 || type === 21) { out.push({ type: 'Point', coordinates: [dv.getFloat64(s + 4, true), dv.getFloat64(s + 12, true)] }); continue; }
      if (type === 8 || type === 18 || type === 28) {
        const np = dv.getInt32(s + 36, true), pts = [];
        for (let i = 0; i < np; i++) pts.push([dv.getFloat64(s + 40 + i * 16, true), dv.getFloat64(s + 48 + i * 16, true)]);
        out.push(np === 1 ? { type: 'Point', coordinates: pts[0] } : { type: 'MultiPoint', coordinates: pts }); continue;
      }
      if ([3, 5, 13, 15, 23, 25].includes(type)) {
        const nParts = dv.getInt32(s + 36, true), nPts = dv.getInt32(s + 40, true);
        const parts = []; for (let i = 0; i < nParts; i++) parts.push(dv.getInt32(s + 44 + i * 4, true));
        const base = s + 44 + nParts * 4, pts = [];
        for (let i = 0; i < nPts; i++) pts.push([dv.getFloat64(base + i * 16, true), dv.getFloat64(base + i * 16 + 8, true)]);
        const rings = parts.map((st, i) => pts.slice(st, i + 1 < nParts ? parts[i + 1] : nPts));
        if (type % 10 === 3) out.push(rings.length === 1 ? { type: 'LineString', coordinates: rings[0] } : { type: 'MultiLineString', coordinates: rings });
        else out.push(assemblePolygon(rings));
        continue;
      }
      out.push(null);
    }
    return out;
  }
  function assemblePolygon(rings) {
    const outers = [], holes = [];
    for (const r of rings) { if (r.length < 4) continue; (ringArea(r) < 0 ? outers : holes).push(r); }
    if (!outers.length) { outers.push(...holes.splice(0)); }
    const polysOut = outers.map(o => [o]);
    for (const hl of holes) { const t = polysOut.find(p => pointInRing(hl[0], p[0])); if (t) t.push(hl); else polysOut.push([hl.slice().reverse()]); }
    return polysOut.length === 1 ? { type: 'Polygon', coordinates: polysOut[0] } : { type: 'MultiPolygon', coordinates: polysOut };
  }
  function parseDbf(buf, encoding) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    const nRec = dv.getUint32(4, true), hLen = dv.getUint16(8, true), rLen = dv.getUint16(10, true);
    const fields = [];
    for (let p = 32; p < hLen - 1 && u8[p] !== 0x0D; p += 32) {
      let name = ''; for (let i = 0; i < 11 && u8[p + i]; i++) name += String.fromCharCode(u8[p + i]);
      fields.push({ name, type: String.fromCharCode(u8[p + 11]), len: u8[p + 16], dec: u8[p + 17] });
    }
    let dec;
    const tryEnc = enc => { try { return new TextDecoder(enc, { fatal: enc === 'utf-8' }); } catch (e) { return null; } };
    if (encoding) dec = tryEnc(encoding.toLowerCase().replace(/^(\d{3,4})$/, 'windows-$1').replace('ansi_1252', 'windows-1252'));
    const records = [];
    let utfOk = true;
    if (!dec) { dec = tryEnc('utf-8'); try { for (let i = 0; i < Math.min(nRec, 200); i++) dec.decode(u8.subarray(hLen + i * rLen, hLen + (i + 1) * rLen)); } catch (e) { utfOk = false; } if (!utfOk) dec = new TextDecoder('windows-1252'); }
    for (let i = 0; i < nRec; i++) {
      const base = hLen + i * rLen; if (base + rLen > u8.length) break;
      if (u8[base] === 0x2A) { records.push(null); continue; }
      let p = base + 1; const rec = {};
      for (const f of fields) {
        let raw; try { raw = dec.decode(u8.subarray(p, p + f.len)); } catch (e) { raw = new TextDecoder('windows-1252').decode(u8.subarray(p, p + f.len)); }
        raw = raw.replace(/\u0000/g, '').trim(); p += f.len;
        if (f.type === 'N' || f.type === 'F') rec[f.name] = raw === '' || /^\*+$/.test(raw) ? null : Number(raw);
        else if (f.type === 'L') rec[f.name] = /^[TtYy]/.test(raw);
        else if (f.type === 'D') rec[f.name] = raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}` : raw;
        else rec[f.name] = raw;
      }
      records.push(rec);
    }
    return { fields, records };
  }
  /** files: {nombre: Uint8Array|ArrayBuffer} -> [{name, geomType, features:[{geometry, properties}], prj, fields}] (coords lon/lat) */
  function readShapefiles(files, defaultZone) {
    const byBase = {};
    for (const [name, data] of Object.entries(files)) {
      const m = name.match(/^(.*)\.(shp|dbf|prj|cpg|shx)$/i); if (!m || /__MACOSX/.test(name)) continue;
      (byBase[m[1]] = byBase[m[1]] || {})[m[2].toLowerCase()] = data;
    }
    const out = [];
    for (const [base, f] of Object.entries(byBase)) {
      if (!f.shp) continue;
      const ab = x => x instanceof ArrayBuffer ? x : x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength);
      const txt = x => x ? new TextDecoder('utf-8').decode(x instanceof ArrayBuffer ? new Uint8Array(x) : x) : '';
      const geoms = parseShp(ab(f.shp));
      const db = f.dbf ? parseDbf(ab(f.dbf), txt(f.cpg).trim()) : { fields: [], records: [] };
      const prj = parsePrj(txt(f.prj));
      const warn = [];
      if (!f.prj) warn.push('Sin archivo .prj: se asume ' + (geoms.some(g => g && Math.abs(allCoords(g)[0] ? allCoords(g)[0][0] : 0) > 180) ? `UTM huso ${defaultZone}S WGS 84` : 'coordenadas geográficas WGS 84'));
      if (!f.dbf) warn.push('Sin archivo .dbf (sin atributos).');
      if (!f.shx) warn.push('Sin archivo .shx (índice).');
      if (prj.kind !== 'unknown' && !prj.wgs) warn.push(`Datum ${prj.datum || 'desconocido'} distinto de WGS 84: CONAF exige WGS 84. Reproyecte la capa antes de entregarla.`);
      if (prj.kind === 'other') warn.push('Proyección no soportada (sólo UTM o geográficas).');
      const feats = [];
      geoms.forEach((g, i) => {
        if (!g) return;
        let gg = g;
        const c0 = allCoords(g)[0] || [0, 0];
        const isUtm = prj.kind === 'utm' || (prj.kind === 'unknown' && Math.abs(c0[0]) > 180);
        if (isUtm) gg = mapCoords(g, (x, y) => fromUTM(x, y, prj.zone || defaultZone, prj.south !== false));
        feats.push({ geometry: gg, properties: db.records[i] || {} });
      });
      const gt = feats.length ? feats[0].geometry.type.replace('Multi', '') : 'Desconocida';
      out.push({ name: base.split('/').pop(), geomType: gt, features: feats, fields: db.fields, prj, warn });
    }
    return out;
  }

  /* ---------------- Escritura de Shapefile ---------------- */
  const SHPTYPE = { Point: 1, LineString: 3, Polygon: 5 };
  /** feats: [{geometry (UTM), properties}] ; fields: [{n,t:'C'|'N',l,d}] -> {shp, shx, dbf} Uint8Array */
  function writeShapefile(geomType, feats, fields) {
    const st = SHPTYPE[geomType];
    const recs = feats.map(f => encodeGeom(st, f.geometry));
    const fileLen = 100 + recs.reduce((s, r) => s + 8 + r.byteLength, 0);
    const shp = new DataView(new ArrayBuffer(fileLen)), shx = new DataView(new ArrayBuffer(100 + 8 * recs.length));
    let bb = null; feats.forEach(f => bb = mergeBbox(bb, bbox(f.geometry))); bb = bb || [0, 0, 0, 0];
    const header = (dv, len) => {
      dv.setInt32(0, 9994, false); dv.setInt32(24, len / 2, false); dv.setInt32(28, 1000, true); dv.setInt32(32, st, true);
      dv.setFloat64(36, bb[0], true); dv.setFloat64(44, bb[1], true); dv.setFloat64(52, bb[2], true); dv.setFloat64(60, bb[3], true);
    };
    header(shp, fileLen); header(shx, 100 + 8 * recs.length);
    let p = 100; const u = new Uint8Array(shp.buffer);
    recs.forEach((r, i) => {
      shp.setInt32(p, i + 1, false); shp.setInt32(p + 4, r.byteLength / 2, false);
      shx.setInt32(100 + i * 8, p / 2, false); shx.setInt32(104 + i * 8, r.byteLength / 2, false);
      u.set(new Uint8Array(r), p + 8); p += 8 + r.byteLength;
    });
    return { shp: new Uint8Array(shp.buffer), shx: new Uint8Array(shx.buffer), dbf: writeDbf(fields, feats.map(f => f.properties)) };
  }
  function encodeGeom(st, g) {
    if (st === 1) { const c = points(g)[0]; const dv = new DataView(new ArrayBuffer(20)); dv.setInt32(0, 1, true); dv.setFloat64(4, c[0], true); dv.setFloat64(12, c[1], true); return dv.buffer; }
    let parts;
    if (st === 3) parts = lines(g);
    else {
      parts = [];
      for (const poly of polys(g)) poly.forEach((r, i) => { const cw = ringArea(r) < 0; parts.push(i === 0 ? (cw ? r : r.slice().reverse()) : (cw ? r.slice().reverse() : r)); });
    }
    const nPts = parts.reduce((s, x) => s + x.length, 0);
    const dv = new DataView(new ArrayBuffer(44 + 4 * parts.length + 16 * nPts));
    const b = bbox({ type: 'MultiLineString', coordinates: parts }) || [0, 0, 0, 0];
    dv.setInt32(0, st, true); dv.setFloat64(4, b[0], true); dv.setFloat64(12, b[1], true); dv.setFloat64(20, b[2], true); dv.setFloat64(28, b[3], true);
    dv.setInt32(36, parts.length, true); dv.setInt32(40, nPts, true);
    let k = 0; parts.forEach((pt, i) => { dv.setInt32(44 + i * 4, k, true); k += pt.length; });
    let o = 44 + 4 * parts.length;
    for (const pt of parts) for (const c of pt) { dv.setFloat64(o, c[0], true); dv.setFloat64(o + 8, c[1], true); o += 16; }
    return dv.buffer;
  }
  function utf8Trunc(s, max) { let b = enc.encode(s); if (b.length <= max) return b; let str = s; while (enc.encode(str).length > max) str = str.slice(0, -1); return enc.encode(str); }
  function writeDbf(fields, rows) {
    const hLen = 32 + 32 * fields.length + 1, rLen = 1 + fields.reduce((s, f) => s + f.l, 0);
    const buf = new Uint8Array(hLen + rLen * rows.length + 1), dv = new DataView(buf.buffer);
    const d = new Date();
    buf[0] = 0x03; buf[1] = d.getFullYear() - 1900; buf[2] = d.getMonth() + 1; buf[3] = d.getDate();
    dv.setUint32(4, rows.length, true); dv.setUint16(8, hLen, true); dv.setUint16(10, rLen, true); buf[29] = 0x00;
    fields.forEach((f, i) => {
      const p = 32 + i * 32; for (let k = 0; k < Math.min(10, f.n.length); k++) buf[p + k] = f.n.charCodeAt(k);
      buf[p + 11] = f.t.charCodeAt(0); buf[p + 16] = f.l; buf[p + 17] = f.d || 0;
    });
    buf[hLen - 1] = 0x0D;
    rows.forEach((r, i) => {
      let p = hLen + i * rLen; buf[p++] = 0x20;
      for (const f of fields) {
        const v = r[f.n]; let bytes;
        if (f.t === 'N') {
          let s = (v == null || v === '' || !isFinite(Number(v))) ? '' : Number(v).toFixed(f.d || 0);
          if (s.length > f.l) s = '*'.repeat(f.l);
          bytes = enc.encode(s.padStart(f.l, ' '));
        } else {
          const b = utf8Trunc(v == null ? '' : String(v), f.l); bytes = new Uint8Array(f.l).fill(0x20); bytes.set(b);
        }
        buf.set(bytes, p); p += f.l;
      }
    });
    buf[buf.length - 1] = 0x1A;
    return buf;
  }

  /* ---------------- KML / GeoJSON ---------------- */
  function parseKml(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const out = [];
    const coords = el => (el.textContent || '').trim().split(/\s+/).map(s => s.split(',').map(Number)).filter(c => c.length >= 2 && isFinite(c[0])).map(c => [c[0], c[1]]);
    const geomOf = pm => {
      const gs = [];
      for (const p of pm.getElementsByTagName('Point')) gs.push({ type: 'Point', coordinates: coords(p.getElementsByTagName('coordinates')[0])[0] });
      for (const l of pm.getElementsByTagName('LineString')) gs.push({ type: 'LineString', coordinates: coords(l.getElementsByTagName('coordinates')[0]) });
      for (const pg of pm.getElementsByTagName('Polygon')) {
        const rings = [];
        for (const b of pg.getElementsByTagName('outerBoundaryIs')) rings.push(coords(b.getElementsByTagName('coordinates')[0]));
        for (const b of pg.getElementsByTagName('innerBoundaryIs')) rings.push(coords(b.getElementsByTagName('coordinates')[0]));
        gs.push({ type: 'Polygon', coordinates: rings });
      }
      return gs;
    };
    for (const pm of doc.getElementsByTagName('Placemark')) {
      const props = {}; const nm = pm.getElementsByTagName('name')[0]; if (nm) props.Nombre = nm.textContent.trim();
      for (const d of pm.getElementsByTagName('Data')) props[d.getAttribute('name')] = (d.getElementsByTagName('value')[0] || {}).textContent;
      for (const d of pm.getElementsByTagName('SimpleData')) props[d.getAttribute('name')] = d.textContent;
      for (const g of geomOf(pm)) out.push({ geometry: g, properties: props });
    }
    return out;
  }
  function toKml(name, feats) {
    const x = s => esc(s);
    const cs = r => r.map(c => `${c[0].toFixed(8)},${c[1].toFixed(8)},0`).join(' ');
    const g2k = g => {
      if (g.type === 'Point') return `<Point><coordinates>${cs([g.coordinates])}</coordinates></Point>`;
      if (g.type === 'LineString') return `<LineString><tessellate>1</tessellate><coordinates>${cs(g.coordinates)}</coordinates></LineString>`;
      if (g.type === 'Polygon') return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${cs(g.coordinates[0])}</coordinates></LinearRing></outerBoundaryIs>${g.coordinates.slice(1).map(r => `<innerBoundaryIs><LinearRing><coordinates>${cs(r)}</coordinates></LinearRing></innerBoundaryIs>`).join('')}</Polygon>`;
      if (g.type.startsWith('Multi')) return `<MultiGeometry>${g.coordinates.map(c => g2k({ type: g.type.slice(5), coordinates: c })).join('')}</MultiGeometry>`;
      return '';
    };
    return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${x(name)}</name>` +
      feats.map(f => `<Placemark><name>${x(f.label || '')}</name><ExtendedData>${Object.entries(f.properties).map(([k, v]) => `<Data name="${x(k)}"><value>${x(v == null ? '' : v)}</value></Data>`).join('')}</ExtendedData>${g2k(f.geometry)}</Placemark>`).join('') + '</Document></kml>';
  }
  function parseGeoJSON(obj) {
    const feats = obj.type === 'FeatureCollection' ? obj.features : obj.type === 'Feature' ? [obj] : [{ type: 'Feature', geometry: obj, properties: {} }];
    return feats.filter(f => f.geometry).map(f => ({ geometry: f.geometry, properties: f.properties || {} }));
  }
  /** Separa geometrías múltiples en partes simples */
  function explode(g) {
    if (g.type === 'MultiPolygon') return g.coordinates.map(c => ({ type: 'Polygon', coordinates: c }));
    if (g.type === 'MultiLineString') return g.coordinates.map(c => ({ type: 'LineString', coordinates: c }));
    if (g.type === 'MultiPoint') return g.coordinates.map(c => ({ type: 'Point', coordinates: c }));
    return [g];
  }

  return { toUTM, fromUTM, zoneOf, merc, unmerc, mapCoords, geomToUTM, geomFromUTM, allCoords, bbox, mergeBbox, polys, lines, points, area, length, centroid, pointInPolygon, pointInRing, segDist, distance, selfIntersections, within, overlapArea, clipPolygon, clipTo, circle, prjUTM, parsePrj, parseShp, parseDbf, readShapefiles, writeShapefile, writeDbf, parseKml, toKml, parseGeoJSON, explode, ringArea };
})();
