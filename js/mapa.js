/* ==========================================================================
   Capítulo 13: Cartografía digital georreferenciada.
   Mapa interactivo propio (teselas OpenStreetMap / OpenTopoMap / Esri /
   CARTO), capas según "Requerimientos técnicos para la presentación de
   cartografía digital georreferenciada ante CONAF" (v6.0, 2025), carga de
   shapefiles, validación, exportación SHP UTM WGS 84 y plano en PDF.
   ========================================================================== */
'use strict';

/* ------------------------------ Capas ------------------------------ */
const COD = {
  Tipo_Bos: [['BN', 'Bosque nativo'], ['PL', 'Plantación forestal']],
  Tipo_For: Object.entries(TIPO_FOR_COD).map(([k, v]) => [v, k]),
  Tip_Dren: [[1, 'Río'], [2, 'Estero'], [3, 'Arroyo'], [4, 'Quebrada']],
  Tipo_Perma: [[1, 'Permanente'], [2, 'No permanente']],
  Tipo_Cuerp: [[1, 'Lago'], [2, 'Laguna'], [3, 'Tranque'], [4, 'Humedal'], [5, 'Río'], [6, 'Otro']],
  Tipo_Cam: [[1, 'Camino principal'], [2, 'Camino secundario'], [3, 'Camino regional de acceso'], [4, 'Otro']],
  Tipo_Cerco: [[1, 'Cerco nuevo alambre de púa'], [2, 'Reparación cerco alambre de púa'], [3, 'Cerco nuevo de malla']],
  Tipo_Inst: [[1, 'Letrero'], [2, 'Estación de observación']],
  Cat_Erosio: [[1, 'Moderada'], [2, 'Severa'], [3, 'Muy severa']]
};
const A_ = {
  pred: { n: 'Nom_Predio', t: 'C', l: 100, auto: 'predio', d: 'Nombre del predio (abreviado)' },
  fte: { n: 'Fuente', t: 'C', l: 120, req: true, d: 'Fuente (elaboración propia, N° resolución anterior o fuente reconocida)' },
  sup: { n: 'Sup_ha', t: 'N', l: 12, dec: 2, auto: 'area', d: 'Superficie calculada por el SIG (ha)' },
  x: { n: 'Coord_X', t: 'N', l: 10, dec: 0, auto: 'x', d: 'Coordenada UTM Este (m)' },
  y: { n: 'Coord_Y', t: 'N', l: 10, dec: 0, auto: 'y', d: 'Coordenada UTM Norte (m)' },
  rodal: { n: 'N_Rodal', t: 'C', l: 20, req: true, list: 'rodales', d: 'Nombre o número del rodal' },
  tbos: { n: 'Tipo_Bos', t: 'C', l: 2, req: true, cod: 'Tipo_Bos', def: 'BN' },
  tfor: { n: 'Tipo_For', t: 'N', l: 2, dec: 0, req: true, cod: 'Tipo_For', auto: 'tipofor' },
  km: n => ({ n, t: 'N', l: 12, dec: 3, auto: 'km', d: 'Longitud calculada por el SIG (km)' })
};
const CAPAS = [
  { k: 'Limite_Predial', n: 'Límite predial', g: 'Polygon', grp: 'propia', req: true, st: { c: '#d7191c', w: 2.6, dash: [12, 4, 3, 4], fill: null }, attrs: [A_.pred, { n: 'Rol', t: 'C', l: 100, auto: 'rol', d: 'Rol(es) de avalúo' }, { n: 'Comuna', t: 'C', l: 60, auto: 'comuna' }, A_.sup, A_.fte] },
  { k: 'Rodales', n: 'Rodales a intervenir', g: 'Polygon', grp: 'propia', req: true, label: 'N_Rodal', st: { c: '#f0b400', w: 2.2, fill: 'rgba(240,180,0,.18)' }, attrs: [A_.pred, A_.rodal, A_.tbos, A_.tfor, A_.sup, A_.fte] },
  { k: 'Parcela', n: 'Parcelas de inventario', g: 'Point', grp: 'propia', reqCorta: true, label: 'N_Parc', st: { c: '#c51b7d', r: 4.5, sym: 'circle' }, attrs: [A_.pred, A_.rodal, { n: 'N_Parc', t: 'N', l: 6, dec: 0, req: true, d: 'Número de la parcela' }, A_.x, A_.y, A_.fte] },
  { k: 'Referencia', n: 'Puntos de referencia', g: 'Point', grp: 'propia', req: true, label: 'Nom_Pto', st: { c: '#1a1a1a', r: 5, sym: 'star' }, attrs: [A_.pred, { n: 'Nom_Pto', t: 'C', l: 100, req: true, list: 'refs', d: 'Nombre del punto (acceso predial, entrada al rodal, casa administración…)' }, A_.x, A_.y, A_.fte] },
  { k: 'Area', n: 'Áreas de actividades bonificables', g: 'Polygon', grp: 'propia', label: 'N_Area', st: { c: '#1b9e77', w: 1.8, fill: 'rgba(27,158,119,.22)', dash: [5, 3] }, attrs: [A_.pred, { n: 'N_Area', t: 'N', l: 4, dec: 0, req: true, d: 'Número de área' }, A_.tbos, A_.sup, A_.fte] },
  { k: 'Sendero', n: 'Senderos', g: 'LineString', grp: 'propia', label: 'N_Send', st: { c: '#8c510a', w: 2.2, dash: [6, 3] }, attrs: [A_.pred, { n: 'N_Send', t: 'N', l: 4, dec: 0, req: true, d: 'Número del sendero' }, A_.km('Long_Send'), A_.fte] },
  { k: 'Instalacion', n: 'Instalaciones de senderos', g: 'Point', grp: 'propia', st: { c: '#8c510a', r: 4.5, sym: 'square' }, attrs: [A_.pred, { n: 'Tipo_Inst', t: 'C', l: 1, req: true, cod: 'Tipo_Inst' }, { n: 'N_Estac', t: 'C', l: 10, d: 'Número de la estación' }, { n: 'Sup_Estac', t: 'N', l: 10, dec: 2, d: 'Superficie de la estación (m²)' }, A_.x, A_.y, A_.fte] },
  { k: 'Especie_Cons', n: 'Especies en categoría de conservación', g: 'Point', grp: 'propia', label: 'Nom_Esp', st: { c: '#6a3d9a', r: 4.5, sym: 'tri' }, attrs: [A_.pred, { n: 'Nom_Esp', t: 'C', l: 100, req: true, list: 'flora', d: 'Nombre científico' }, A_.x, A_.y, A_.fte] },
  { k: 'Area_Buffer', n: 'Áreas buffer', g: 'Polygon', grp: 'propia', st: { c: '#6a3d9a', w: 1.5, fill: 'rgba(106,61,154,.12)', dash: [4, 3] }, attrs: [A_.pred, A_.sup, A_.fte] },
  { k: 'Zona_Proteccion', n: 'Zonas de protección', g: 'Polygon', grp: 'propia', st: { c: '#2c7fb8', w: 1.4, fill: 'rgba(44,127,184,.18)', hatch: true }, attrs: [A_.pred, { n: 'Tipo_Perma', t: 'C', l: 1, cod: 'Tipo_Perma' }, A_.sup, A_.fte] },
  { k: 'Cercos', n: 'Cercos construidos o reparados', g: 'LineString', grp: 'propia', st: { c: '#444', w: 1.6, dash: [2, 3] }, attrs: [A_.pred, { n: 'Tipo_Cerco', t: 'C', l: 1, req: true, cod: 'Tipo_Cerco' }, A_.km('Long_Cerco'), A_.fte] },
  { k: 'Cortafuegos', n: 'Cortafuegos y cortacombustibles', g: 'LineString', grp: 'propia', st: { c: '#e6550d', w: 2.4, dash: [8, 3] }, attrs: [A_.pred, { n: 'N_Faja', t: 'N', l: 4, dec: 0, d: 'Número de la faja' }, A_.km('Long_Faja'), A_.fte] },
  { k: 'Obras_Erosion', n: 'Obras de control de erosión', g: 'LineString', grp: 'propia', st: { c: '#7f2704', w: 1.6 }, attrs: [A_.pred, A_.km('Long_km'), A_.fte] },
  { k: 'Caminos_Proyect', n: 'Caminos proyectados', g: 'LineString', grp: 'propia', st: { c: '#636363', w: 2, dash: [7, 4] }, attrs: [A_.pred, { n: 'Tipo_Cam', t: 'C', l: 1, req: true, cod: 'Tipo_Cam' }, A_.km('Long_km'), A_.fte] },
  { k: 'Cancha_Acopio', n: 'Canchas de acopio', g: 'Point', grp: 'propia', st: { c: '#636363', r: 5, sym: 'square' }, attrs: [A_.pred, { n: 'Nom_Infra', t: 'C', l: 100, d: 'Nombre' }, A_.x, A_.y, A_.fte] },
  { k: 'Vias_Ingreso', n: 'Vías de ingreso a rodales', g: 'LineString', grp: 'propia', st: { c: '#984ea3', w: 1.8, dash: [3, 3] }, attrs: [A_.pred, A_.km('Long_km'), A_.fte] },
  { k: 'Hidrografia', n: 'Red hidrográfica', g: 'LineString', grp: 'reconocida', st: { c: '#1f78b4', w: 1.8 }, attrs: [A_.pred, { n: 'Tip_Dren', t: 'C', l: 1, req: true, cod: 'Tip_Dren' }, { n: 'Tipo_Perma', t: 'C', l: 1, req: true, cod: 'Tipo_Perma' }, A_.km('Long_km'), A_.fte] },
  { k: 'Cuerpo_Agua', n: 'Cuerpos de agua y humedales', g: 'Polygon', grp: 'reconocida', st: { c: '#1f78b4', w: 1.2, fill: 'rgba(31,120,180,.35)' }, attrs: [A_.pred, { n: 'Tipo_Cuerp', t: 'C', l: 1, req: true, cod: 'Tipo_Cuerp' }, { n: 'Tipo_Perma', t: 'C', l: 1, cod: 'Tipo_Perma' }, A_.sup, A_.fte] },
  { k: 'Caminos', n: 'Caminos existentes', g: 'LineString', grp: 'reconocida', noClip: true, st: { c: '#252525', w: 2.4 }, attrs: [A_.pred, { n: 'Tipo_Cam', t: 'C', l: 1, req: true, cod: 'Tipo_Cam' }, A_.km('Long_km'), A_.fte] },
  { k: 'Infraestructura', n: 'Infraestructura presente en el predio', g: 'Point', grp: 'reconocida', label: 'Nom_Infra', st: { c: '#252525', r: 5, sym: 'house' }, attrs: [A_.pred, { n: 'Nom_Infra', t: 'C', l: 100, req: true, d: 'Nombre (casa, galpón…)' }, A_.x, A_.y, A_.fte] },
  { k: 'Curvas_Nivel', n: 'Curvas de nivel', g: 'LineString', grp: 'reconocida', label: 'Cot_Curva', st: { c: '#a6761d', w: 0.8 }, attrs: [A_.pred, { n: 'Cot_Curva', t: 'N', l: 6, dec: 0, req: true, d: 'Cota (m s.n.m.)' }, A_.fte] },
  { k: 'RodalesPM', n: 'Rodales con Plan de Manejo aprobado', g: 'Polygon', grp: 'concurso', label: 'N_RodalPM', st: { c: '#33a02c', w: 1.6, fill: 'rgba(51,160,44,.12)', dash: [6, 2] }, attrs: [A_.pred, { n: 'N_RodalPM', t: 'C', l: 20, req: true }, A_.tbos, Object.assign({}, A_.tfor, { auto: null }), A_.sup, { n: 'N_ResPM', t: 'C', l: 30, req: true, d: 'N° Resolución PM aprobado' }, A_.fte] },
  { k: 'RodalesBono', n: 'Rodales con bonificaciones pagadas', g: 'Polygon', grp: 'concurso', label: 'N_RodalBon', st: { c: '#ff7f00', w: 1.6, fill: 'rgba(255,127,0,.12)', dash: [2, 2] }, attrs: [A_.pred, { n: 'N_RodalBon', t: 'C', l: 20, req: true, d: 'N_RodalBono (truncado a 10 caracteres por el formato DBF)' }, A_.tbos, Object.assign({}, A_.tfor, { auto: null }), A_.sup, { n: 'N_ResBono', t: 'C', l: 30, req: true, d: 'N° Resolución bono aprobado' }, A_.fte] }
];
const CAPA = Object.fromEntries(CAPAS.map(c => [c.k, c]));
const GRUPOS = { propia: 'Capas de elaboración propia', reconocida: 'Capas de fuentes reconocidas', concurso: 'Capas exigidas en Concurso' };

const BASES = {
  osm: { n: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19, att: '© colaboradores de OpenStreetMap' },
  topo: { n: 'OpenTopoMap (relieve)', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', sub: 'abc', max: 17, att: '© OpenStreetMap, SRTM · estilo © OpenTopoMap (CC-BY-SA)' },
  esri: { n: 'Imagen satelital (Esri)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', max: 19, att: 'Imágenes © Esri, Maxar, Earthstar Geographics' },
  carto: { n: 'CARTO claro', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', sub: 'abcd', max: 19, att: '© OpenStreetMap © CARTO' },
  none: { n: 'Sin mapa base', url: null, max: 22, att: '' }
};

/* ------------------------------ Motor de mapa ------------------------------ */
class MapView {
  constructor(canvas, host) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.host = host;
    this.z = 5; this.c = Geo.merc(-71.5, -37.5); this.base = 'osm'; this.tiles = new Map();
    this.ptrs = new Map(); this.dirty = true; this.hover = null;
    this.resize(); new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    const loop = () => { if (this.dirty) { this.dirty = false; this.draw(); } this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
    this.bind();
  }
  destroy() { cancelAnimationFrame(this.raf); }
  resize() {
    const r = this.cv.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    this.w = Math.max(200, r.width); this.h = Math.max(200, r.height); this.dpr = dpr;
    this.cv.width = this.w * dpr; this.cv.height = this.h * dpr; this.cv.style.width = this.w + 'px'; this.cv.style.height = this.h + 'px';
    this.dirty = true;
  }
  get res() { return 2 * Math.PI * 6378137 / 256 / Math.pow(2, this.z); }
  px(ll) { const m = Geo.merc(ll[0], ll[1]); return [(m[0] - this.c[0]) / this.res + this.w / 2, (this.c[1] - m[1]) / this.res + this.h / 2]; }
  ll(x, y) { return Geo.unmerc(this.c[0] + (x - this.w / 2) * this.res, this.c[1] - (y - this.h / 2) * this.res); }
  setZoom(z, ax, ay) {
    z = Math.max(2, Math.min(21, z));
    if (ax != null) { const before = this.ll(ax, ay); this.z = z; const m = Geo.merc(before[0], before[1]); this.c = [m[0] - (ax - this.w / 2) * this.res, m[1] + (ay - this.h / 2) * this.res]; }
    else this.z = z;
    this.dirty = true; this.host.onView && this.host.onView();
  }
  fit(bb, pad = 40) {
    if (!bb) return;
    const a = Geo.merc(bb[0], bb[1]), b = Geo.merc(bb[2], bb[3]);
    const dx = Math.max(10, b[0] - a[0]), dy = Math.max(10, b[1] - a[1]);
    this.c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const res = Math.max(dx / (this.w - 2 * pad), dy / (this.h - 2 * pad));
    this.z = Math.min(19, Math.log2(2 * Math.PI * 6378137 / 256 / res)); this.dirty = true;
  }
  tile(z, x, y) {
    const B = BASES[this.base]; if (!B.url) return null;
    const n = 1 << z, xx = ((x % n) + n) % n; if (y < 0 || y >= n) return null;
    const key = this.base + '/' + z + '/' + xx + '/' + y;
    let t = this.tiles.get(key);
    if (!t) {
      const img = new Image(); img.crossOrigin = 'anonymous';
      t = { img, ok: false }; this.tiles.set(key, t);
      img.onload = () => { t.ok = true; this.dirty = true; }; img.onerror = () => { t.err = true; };
      const s = B.sub ? B.sub[(xx + y) % B.sub.length] : '';
      img.src = B.url.replace('{z}', z).replace('{x}', xx).replace('{y}', y).replace('{s}', s);
      if (this.tiles.size > 600) { const k = this.tiles.keys().next().value; this.tiles.delete(k); }
    }
    return t;
  }
  draw() {
    const g = this.ctx, dpr = this.dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#eef0ea'; g.fillRect(0, 0, this.w, this.h);
    const B = BASES[this.base];
    if (B.url) {
      const tz = Math.max(0, Math.min(B.max, Math.round(this.z))), sc = Math.pow(2, this.z - tz), size = 256 * sc;
      const W = 2 * Math.PI * 6378137, wpx = m => [(m[0] + W / 2) / W * 256 * (1 << tz), (W / 2 - m[1]) / W * 256 * (1 << tz)];
      const cw = wpx(this.c);
      const x0 = Math.floor((cw[0] - this.w / 2 / sc) / 256), x1 = Math.floor((cw[0] + this.w / 2 / sc) / 256);
      const y0 = Math.floor((cw[1] - this.h / 2 / sc) / 256), y1 = Math.floor((cw[1] + this.h / 2 / sc) / 256);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const t = this.tile(tz, x, y); if (!t || !t.ok) continue;
        const sx = (x * 256 - cw[0]) * sc + this.w / 2, sy = (y * 256 - cw[1]) * sc + this.h / 2;
        g.drawImage(t.img, Math.round(sx), Math.round(sy), Math.ceil(size) + 1, Math.ceil(size) + 1);
      }
    }
    this.host.drawVectors(g, this);
    this.drawScale(g);
  }
  drawScale(g) {
    const lat = this.ll(this.w / 2, this.h / 2)[1], mpp = this.res * Math.cos(lat * Math.PI / 180);
    let m = mpp * 110; const p = Math.pow(10, Math.floor(Math.log10(m))); m = m / p >= 5 ? 5 * p : m / p >= 2 ? 2 * p : p;
    const w = m / mpp, x = 12, y = this.h - 16;
    g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(x - 4, y - 16, w + 50, 22);
    g.strokeStyle = '#222'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y - 6); g.stroke();
    g.fillStyle = '#222'; g.font = '11px system-ui,sans-serif'; g.fillText(m >= 1000 ? (m / 1000) + ' km' : m + ' m', x + w + 5, y);
  }
  bind() {
    const cv = this.cv;
    cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); this.setZoom(this.z + (e.deltaY < 0 ? 0.5 : -0.5), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); const r = cv.getBoundingClientRect();
      const p = { x: e.clientX - r.left, y: e.clientY - r.top, sx: e.clientX - r.left, sy: e.clientY - r.top, moved: false };
      this.ptrs.set(e.pointerId, p);
      if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.z }; }
      else if (e.button === 0 || e.pointerType !== 'mouse') this.host.onDown && this.host.onDown(p, e);
    });
    cv.addEventListener('pointermove', e => {
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      this.host.onHover && this.host.onHover(x, y);
      const p = this.ptrs.get(e.pointerId); if (!p) return;
      if (this.ptrs.size === 2 && this.pinch) { p.x = x; p.y = y; const [a, b] = [...this.ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); this.setZoom(this.pinch.z + Math.log2(d / this.pinch.d), (a.x + b.x) / 2, (a.y + b.y) / 2); return; }
      const dx = x - p.x, dy = y - p.y;
      if (Math.hypot(x - p.sx, y - p.sy) > 4) p.moved = true;
      p.x = x; p.y = y;
      if (p.moved && this.host.onDrag && this.host.onDrag(x, y, p)) return;
      if (p.moved) { this.c = [this.c[0] - dx * this.res, this.c[1] + dy * this.res]; this.dirty = true; }
    });
    const up = e => {
      const p = this.ptrs.get(e.pointerId); this.ptrs.delete(e.pointerId);
      if (this.ptrs.size < 2) this.pinch = null;
      if (!p) return;
      this.host.onUp && this.host.onUp(p, e);
      if (!p.moved && e.button !== 2) this.host.onClick && this.host.onClick(p.x, p.y, e);
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('dblclick', e => { const r = cv.getBoundingClientRect(); if (!(this.host.onDbl && this.host.onDbl(e.clientX - r.left, e.clientY - r.top))) this.setZoom(this.z + 1, e.clientX - r.left, e.clientY - r.top); });
    cv.addEventListener('contextmenu', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); this.host.onRight && this.host.onRight(e.clientX - r.left, e.clientY - r.top); });
  }
}

/* ------------------------------ Módulo Carto ------------------------------ */
const Carto = (() => {
  let map = null, active = 'Rodales', tool = 'select', sel = null, drawPts = [], dragV = null, mouse = null, panel = 'attr', snapPt = null;
  const C = () => S.carto || (S.carto = { huso: '', layers: {}, plano: {} });
  const feats = k => C().layers[k] || (C().layers[k] = []);
  const zona = () => Number(C().huso || S.f.pm_huso) || autoZona() || 19;
  function autoZona() {
    const lp = feats('Limite_Predial'), all = lp.length ? lp : CAPAS.flatMap(c => feats(c.k));
    if (!all.length) return null;
    let bb = null; all.forEach(f => bb = Geo.mergeBbox(bb, Geo.bbox(f.g)));
    return Geo.zoneOf((bb[0] + bb[2]) / 2) === 18 ? 18 : 19;
  }
  const predioAbrev = () => C().predio || safeName(App.f('pr_nombre') || 'Predio', 40);
  const utm = g => Geo.geomToUTM(g, zona());

  /* --------- atributos automáticos --------- */
  function autoProps(layer, f) {
    const L = CAPA[layer]; const gu = utm(f.g);
    for (const a of L.attrs) {
      if (a.def != null && (f.p[a.n] == null || f.p[a.n] === '')) f.p[a.n] = a.def;
      if (a.n === 'Fuente' && !f.p.Fuente && L.grp === 'propia') f.p.Fuente = 'Elaboración propia';
      switch (a.auto) {
        case 'predio': f.p[a.n] = predioAbrev(); break;
        case 'rol': f.p[a.n] = App.roles().map(r => r.rol).filter(Boolean).join(', '); break;
        case 'comuna': f.p[a.n] = [...new Set(App.roles().map(r => r.comuna).filter(Boolean))].join(', '); break;
        case 'area': f.p[a.n] = round(Geo.area(gu) / 10000, 2); break;
        case 'km': f.p[a.n] = round(Geo.length(gu) / 1000, 3); break;
        case 'x': { const c = Geo.points(gu)[0] || Geo.centroid(gu); f.p[a.n] = c ? Math.round(c[0]) : null; break; }
        case 'y': { const c = Geo.points(gu)[0] || Geo.centroid(gu); f.p[a.n] = c ? Math.round(c[1]) : null; break; }
        case 'tipofor': { const tf = App.rodalInfo(f.p.N_Rodal).tf; if (tf && TIPO_FOR_COD[tf]) f.p[a.n] = TIPO_FOR_COD[tf]; break; }
      }
    }
  }
  function recomputeAll() { for (const L of CAPAS) feats(L.k).forEach(f => autoProps(L.k, f)); }
  function changed() { C(); App.changed(); if (map) map.dirty = true; }

  /* --------- dibujo de vectores --------- */
  const geomType = g => g.type.replace('Multi', '');
  function strokePath(g, ctx, mv, close) {
    const draw = arr => { arr.forEach((c, i) => { const p = mv.px(c); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); if (close) ctx.closePath(); };
    ctx.beginPath();
    if (g.type === 'LineString') draw(g.coordinates);
    else if (g.type === 'MultiLineString') g.coordinates.forEach(draw);
    else Geo.polys(g).forEach(p => p.forEach(draw));
  }
  function symbol(ctx, x, y, st, scale = 1) {
    const r = (st.r || 4.5) * scale; ctx.fillStyle = st.c; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4 * scale; ctx.beginPath();
    if (st.sym === 'square' || st.sym === 'house') { ctx.rect(x - r, y - r, 2 * r, 2 * r); if (st.sym === 'house') { ctx.moveTo(x - r * 1.3, y - r); ctx.lineTo(x, y - r * 2.1); ctx.lineTo(x + r * 1.3, y - r); } }
    else if (st.sym === 'tri') { ctx.moveTo(x, y - r * 1.3); ctx.lineTo(x + r * 1.2, y + r * .9); ctx.lineTo(x - r * 1.2, y + r * .9); ctx.closePath(); }
    else if (st.sym === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .55 : r * 1.4; ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); } ctx.closePath(); }
    else ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fill(); ctx.stroke();
  }
  let hatchPat = null;
  function drawLayer(ctx, mv, L, list, scale = 1) {
    const st = L.st;
    for (const f of list) {
      const t = geomType(f.g);
      if (t === 'Point') { for (const c of Geo.points(f.g)) { const p = mv.px(c); symbol(ctx, p[0], p[1], st, scale); } continue; }
      strokePath(f.g, ctx, mv, t === 'Polygon');
      if (t === 'Polygon' && (st.fill || st.hatch)) {
        if (st.hatch) { if (!hatchPat) { const c = document.createElement('canvas'); c.width = c.height = 8; const g = c.getContext('2d'); g.strokeStyle = st.c; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 8); g.lineTo(8, 0); g.stroke(); hatchPat = ctx.createPattern(c, 'repeat'); } ctx.fillStyle = hatchPat; ctx.fill('evenodd'); }
        if (st.fill) { ctx.fillStyle = st.fill; ctx.fill('evenodd'); }
      }
      ctx.setLineDash((st.dash || []).map(d => d * scale)); ctx.strokeStyle = st.c; ctx.lineWidth = (st.w || 1.5) * scale; ctx.stroke(); ctx.setLineDash([]);
    }
  }
  function drawLabels(ctx, mv, L, list, scale = 1) {
    if (!L.label) return;
    ctx.font = `600 ${11 * scale}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of list) {
      const v = f.p[L.label]; if (v == null || v === '') continue;
      let c = geomType(f.g) === 'Point' ? Geo.points(f.g)[0] : Geo.centroid(f.g); if (!c) continue;
      if (geomType(f.g) === 'Polygon') { const bb = Geo.bbox(f.g), up = [c[0], c[1] + (bb[3] - bb[1]) * 0.28]; if (Geo.pointInPolygon(up, f.g)) c = up; }
      const p = mv.px(c), yy = geomType(f.g) === 'Point' ? p[1] - 11 * scale : p[1];
      const txt = (L.k === 'Rodales' ? 'R-' : '') + v;
      ctx.lineWidth = 3 * scale; ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.strokeText(txt, p[0], yy);
      ctx.fillStyle = '#111'; ctx.fillText(txt, p[0], yy);
    }
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }
  const ORDER = () => CAPAS.slice().sort((a, b) => ({ Polygon: 0, LineString: 1, Point: 2 }[a.g] - { Polygon: 0, LineString: 1, Point: 2 }[b.g]));
  const visible = k => C().hidden ? !C().hidden[k] : true;
  function drawVectors(ctx, mv) {
    for (const L of ORDER()) if (visible(L.k)) drawLayer(ctx, mv, L, feats(L.k));
    for (const L of ORDER()) if (visible(L.k)) drawLabels(ctx, mv, L, feats(L.k));
    // selección
    if (sel) {
      const f = getSel(); if (f) {
        ctx.save(); const t = geomType(f.g);
        if (t !== 'Point') { strokePath(f.g, ctx, mv, t === 'Polygon'); ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 3.5; ctx.stroke(); }
        for (const v of vertices(f.g)) { const p = mv.px(v.c); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0077aa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.rect(p[0] - 4.5, p[1] - 4.5, 9, 9); ctx.fill(); ctx.stroke(); }
        for (const m of midpoints(f.g)) { const p = mv.px(m.c); ctx.fillStyle = 'rgba(0,119,170,.55)'; ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, 2 * Math.PI); ctx.fill(); }
        ctx.restore();
      }
    }
    // dibujo en curso
    if (tool !== 'select' && drawPts.length) {
      const L = CAPA[active]; ctx.save(); ctx.beginPath();
      const pts = drawPts.concat(mouse ? [mouse] : []);
      pts.forEach((c, i) => { const p = mv.px(c); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
      if (tool === 'Polygon' && pts.length > 2) { ctx.closePath(); ctx.fillStyle = 'rgba(0,229,255,.15)'; ctx.fill(); }
      ctx.strokeStyle = '#00b8d4'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
      drawPts.forEach(c => { const p = mv.px(c); ctx.fillStyle = '#00b8d4'; ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, 2 * Math.PI); ctx.fill(); });
      ctx.restore();
    }
    if (snapPt) { const p = mv.px(snapPt); ctx.strokeStyle = '#ff00aa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 8, 0, 2 * Math.PI); ctx.stroke(); }
  }

  /* --------- edición --------- */
  function getSel() { if (!sel) return null; return feats(sel.k).find(f => f.id === sel.id) || null; }
  function rings(g) {
    if (g.type === 'Point') return [[g.coordinates]];
    if (g.type === 'MultiPoint' || g.type === 'LineString') return [g.coordinates];
    if (g.type === 'MultiLineString' || g.type === 'Polygon') return g.coordinates;
    return g.coordinates.flat();
  }
  const isClosed = g => geomType(g) === 'Polygon';
  function vertices(g) { const out = []; rings(g).forEach((r, ri) => r.forEach((c, i) => { if (isClosed(g) && i === r.length - 1) return; out.push({ ri, i, c }); })); return out; }
  function midpoints(g) {
    if (geomType(g) === 'Point') return [];
    const out = []; rings(g).forEach((r, ri) => { for (let i = 0; i < r.length - 1; i++) out.push({ ri, i, c: [(r[i][0] + r[i + 1][0]) / 2, (r[i][1] + r[i + 1][1]) / 2] }); });
    return out;
  }
  function hitVertex(x, y, list) { for (const v of list) { const p = map.px(v.c); if (Math.hypot(p[0] - x, p[1] - y) < 8) return v; } return null; }
  function snap(x, y, exclude) {
    let best = null, bd = 10;
    for (const L of CAPAS) { if (!visible(L.k)) continue; for (const f of feats(L.k)) { for (const v of vertices(f.g)) { if (exclude && exclude === v.c) continue; const p = map.px(v.c); const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = v.c; } } } }
    return best ? best.slice() : null;
  }
  function hitFeature(x, y) {
    const ll = map.ll(x, y);
    const order = ORDER().slice().reverse();
    for (const L of order) {
      if (!visible(L.k)) continue;
      const list = feats(L.k);
      for (let i = list.length - 1; i >= 0; i--) {
        const f = list[i], t = geomType(f.g);
        if (t === 'Point') { for (const c of Geo.points(f.g)) { const p = map.px(c); if (Math.hypot(p[0] - x, p[1] - y) < 9) return { k: L.k, id: f.id }; } }
        else if (t === 'LineString') { for (const l of Geo.lines(f.g)) for (let j = 1; j < l.length; j++) { const a = map.px(l[j - 1]), b = map.px(l[j]); if (Geo.segDist([x, y], a, b) < 6) return { k: L.k, id: f.id }; } }
      }
    }
    for (const L of order) {
      if (!visible(L.k) || L.g !== 'Polygon') continue;
      const list = feats(L.k);
      for (let i = list.length - 1; i >= 0; i--) if (Geo.pointInPolygon(ll, list[i].g)) return { k: L.k, id: list[i].id };
    }
    return null;
  }
  function setCoord(g, v, c) {
    const r = rings(g)[v.ri]; r[v.i][0] = c[0]; r[v.i][1] = c[1];
    if (isClosed(g) && v.i === 0) { r[r.length - 1][0] = c[0]; r[r.length - 1][1] = c[1]; }
  }
  const host = {
    drawVectors,
    onHover(x, y) {
      const ll = map.ll(x, y); const [E, N] = Geo.toUTM(ll[0], ll[1], zona());
      const el = $('#map-coord'); if (el) el.textContent = `Huso ${zona()}S · E ${fmt(E, 0)} · N ${fmt(N, 0)} · ${ll[1].toFixed(5)}°, ${ll[0].toFixed(5)}°`;
      if (tool !== 'select') { const sp = snap(x, y); snapPt = sp; mouse = sp || ll; map.dirty = true; }
      else if (!dragV) { const f = getSel(); map.cv.style.cursor = f && hitVertex(x, y, vertices(f.g)) ? 'move' : 'default'; }
    },
    onDown(p) {
      if (tool !== 'select') return;
      const f = getSel(); if (!f) return;
      const v = hitVertex(p.x, p.y, vertices(f.g));
      if (v) { dragV = v; return; }
      const m = hitVertex(p.x, p.y, midpoints(f.g));
      if (m) { const r = rings(f.g)[m.ri]; r.splice(m.i + 1, 0, m.c.slice()); dragV = { ri: m.ri, i: m.i + 1, c: r[m.i + 1] }; map.dirty = true; }
    },
    onDrag(x, y) {
      if (!dragV) return false;
      const f = getSel(); const c = snap(x, y, rings(f.g)[dragV.ri][dragV.i]) || map.ll(x, y);
      snapPt = snap(x, y, rings(f.g)[dragV.ri][dragV.i]);
      setCoord(f.g, dragV, c); map.dirty = true; return true;
    },
    onUp() { if (dragV) { dragV = null; snapPt = null; const f = getSel(); if (f) { autoProps(sel.k, f); changed(); refreshPanel(); } } },
    onClick(x, y, e) {
      if (tool === 'select') { const h0 = hitFeature(x, y); sel = h0; if (h0 && h0.k !== active) { active = h0.k; refreshLayers(); } refreshPanel(); updateToolbar(); map.dirty = true; return; }
      const c = snap(x, y) || map.ll(x, y);
      if (tool === 'Point') { addFeature(active, { type: 'Point', coordinates: c }); return; }
      const last = drawPts[drawPts.length - 1];
      if (last) { const a = map.px(last), b = map.px(c); if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 3) return; }
      drawPts.push(c); map.dirty = true;
    },
    onDbl() { if (tool === 'LineString' || tool === 'Polygon') { finishDraw(); return true; } return false; },
    onRight(x, y) {
      const f = getSel(); if (!f) return;
      const v = hitVertex(x, y, vertices(f.g)); if (!v) return;
      const r = rings(f.g)[v.ri], minN = isClosed(f.g) ? 4 : 2;
      if (r.length - 1 <= minN - (isClosed(f.g) ? 0 : 1)) { toast('No se pueden quitar más vértices.', 'warn'); return; }
      r.splice(v.i, 1); if (isClosed(f.g) && v.i === 0) { r[r.length - 1] = r[0].slice(); }
      autoProps(sel.k, f); changed(); refreshPanel();
    },
    onView() { }
  };
  function finishDraw() {
    const pts = drawPts.slice(); drawPts = []; mouse = null; snapPt = null;
    if (tool === 'LineString') { if (pts.length < 2) { toast('Una línea requiere al menos 2 vértices.', 'warn'); return; } addFeature(active, { type: 'LineString', coordinates: pts }); }
    if (tool === 'Polygon') { if (pts.length < 3) { toast('Un polígono requiere al menos 3 vértices.', 'warn'); return; } addFeature(active, { type: 'Polygon', coordinates: [pts.concat([pts[0].slice()])] }); }
    map.dirty = true;
  }
  function addFeature(k, g, props = {}) {
    const f = { id: uid(), g, p: Object.assign({}, props) };
    autoProps(k, f); feats(k).push(f); sel = { k, id: f.id };
    if (tool === 'Point' && k === 'Parcela' && !f.p.N_Parc) { const ps = feats(k).map(x => num(x.p.N_Parc)).filter(isFinite); f.p.N_Parc = ps.length ? Math.max(...ps) + 1 : 1; }
    if (k === 'Rodales' && !f.p.N_Rodal) { const used = feats(k).map(x => x.p.N_Rodal); const libre = App.rodales().find(r => !used.includes(r)); if (libre) { f.p.N_Rodal = libre; autoProps(k, f); } }
    changed(); refreshLayers(); refreshPanel(); return f;
  }
  function deleteSel() {
    const f = getSel(); if (!f) return;
    const list = feats(sel.k); list.splice(list.indexOf(f), 1); sel = null; changed(); refreshLayers(); refreshPanel(); updateToolbar();
  }
  function setTool(t) {
    if (t !== 'select' && CAPA[active].g !== t) { toast(`La capa “${CAPA[active].n}” es de tipo ${geomName(CAPA[active].g)}.`, 'warn'); return; }
    tool = t; drawPts = []; mouse = null; snapPt = null; if (t !== 'select') sel = null; updateToolbar(); if (map) { map.cv.style.cursor = t === 'select' ? 'default' : 'crosshair'; map.dirty = true; }
  }
  const geomName = g => ({ Point: 'puntos', LineString: 'líneas', Polygon: 'polígonos' }[g]);
  function onKey(e) {
    if (currentView !== '13' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.key === 'Escape') { if (drawPts.length) { drawPts = []; map.dirty = true; } else { sel = null; setTool('select'); refreshPanel(); } }
    if (e.key === 'Enter' && drawPts.length) finishDraw();
    if (e.key === 'Backspace' && drawPts.length) { e.preventDefault(); drawPts.pop(); map.dirty = true; }
    if (e.key === 'Delete' && sel && !drawPts.length) deleteSel();
  }
  document.addEventListener('keydown', onKey);

  /* --------- límites y extensión --------- */
  function extent(keys) {
    let bb = null; for (const k of keys || CAPAS.map(c => c.k)) feats(k).forEach(f => bb = Geo.mergeBbox(bb, Geo.bbox(f.g))); return bb;
  }
  function zoomTo(keys) { const bb = extent(keys) || extent(); if (bb) map.fit(bb); else toast('No hay geometrías en la cartografía.', 'warn'); }

  /* --------- interfaz --------- */
  function render() {
    C(); if (!C().huso && S.f.pm_huso) C().huso = S.f.pm_huso;
    const v = h('div', { class: 'view carto-view' });
    v.appendChild(h('header', { class: 'view-h' }, h('p', { class: 'eyebrow' }, 'Capítulo 13'), h('h1', null, 'Cartografía digital georreferenciada'),
      h('p', { class: 'lead sm' }, 'Datum WGS 84 · Proyección UTM · Huso 18 o 19 Sur · Formato Shapefile (SHP, SHX, DBF, PRJ) codificación UTF-8 · Escala del plano ≤ 1:5.000.')));
    const fileIn = h('input', { type: 'file', multiple: true, hidden: true, accept: '.zip,.shp,.dbf,.shx,.prj,.cpg,.kml,.kmz,.geojson,.json', onchange: e => { importar([...e.target.files]); e.target.value = ''; } });
    const toolbar = h('div', { class: 'map-tools', id: 'map-tools' },
      h('button', { class: 'tbtn', 'data-t': 'select', title: 'Seleccionar y editar vértices (arrastrar vértice; clic derecho elimina vértice; punto medio agrega vértice)', onclick: () => setTool('select') }, '⬉ Seleccionar'),
      h('button', { class: 'tbtn', 'data-t': 'Point', title: 'Dibujar punto', onclick: () => setTool('Point') }, '• Punto'),
      h('button', { class: 'tbtn', 'data-t': 'LineString', title: 'Dibujar línea (doble clic o Enter para terminar)', onclick: () => setTool('LineString') }, '╱ Línea'),
      h('button', { class: 'tbtn', 'data-t': 'Polygon', title: 'Dibujar polígono (doble clic o Enter para terminar)', onclick: () => setTool('Polygon') }, '⬠ Polígono'),
      h('button', { class: 'tbtn', id: 'btn-del', title: 'Eliminar elemento seleccionado (Supr)', onclick: deleteSel }, '🗑 Eliminar'),
      h('span', { class: 'sep' }),
      h('button', { class: 'tbtn', title: 'Ajustar a la cartografía', onclick: () => zoomTo(feats('Limite_Predial').length ? ['Limite_Predial'] : null) }, '⤢ Ajustar'),
      h('button', { class: 'tbtn', title: 'Ir a coordenada UTM', onclick: irA }, '⌖ Ir a coordenada'),
      h('button', { class: 'tbtn accent', onclick: () => fileIn.click() }, '⇪ Subir shape / KML'), fileIn);
    const canvas = h('canvas', { class: 'map-cv', 'aria-label': 'Mapa' });
    const mapBox = h('div', { class: 'map-box' }, canvas,
      h('div', { class: 'map-coord', id: 'map-coord' }, 'Mueva el cursor sobre el mapa'),
      h('div', { class: 'map-att', id: 'map-att' }, BASES[C().base || 'osm'].att),
      h('div', { class: 'map-draw-hint', id: 'draw-hint' }));
    const settings = h('div', { class: 'carto-set' },
      h('label', null, 'Mapa base ', h('select', { onchange: e => { C().base = e.target.value; map.base = e.target.value; $('#map-att').textContent = BASES[e.target.value].att; map.dirty = true; App.changed(); } }, Object.entries(BASES).map(([k, b]) => h('option', { value: k, selected: (C().base || 'osm') === k }, b.n)))),
      h('label', null, 'Huso UTM ', h('select', { onchange: e => { C().huso = e.target.value; recomputeAll(); changed(); refreshPanel(); } }, ['', '18', '19'].map(o => h('option', { value: o, selected: String(C().huso || '') === o }, o ? o + ' Sur' : 'Automático (' + (autoZona() || 19) + ')')))),
      h('label', null, 'Nombre predio (abreviado) ', h('input', { type: 'text', value: C().predio || '', placeholder: safeName(App.f('pr_nombre') || 'Predio', 40), onchange: e => { C().predio = safeName(e.target.value, 60); e.target.value = C().predio; recomputeAll(); changed(); refreshPanel(); } })));
    const layersBox = h('aside', { class: 'layers', id: 'layers' });
    const panelBox = h('div', { class: 'carto-panel', id: 'carto-panel' });
    v.append(settings, h('div', { class: 'carto-grid' }, layersBox, h('div', { class: 'map-col' }, toolbar, mapBox)), panelBox);
    v.appendChild(h('section', { class: 'card' }, h('h2', null, 'Elementos a representar (Capítulo 13 del Plan de Manejo)'), h('div', { id: 'chk13' })));
    setTimeout(() => {
      if (map) map.destroy();
      map = new MapView(canvas, host); map.base = C().base || 'osm';
      if (C().view) { map.c = C().view.c; map.z = C().view.z; } else if (extent()) zoomTo();
      refreshLayers(); refreshPanel(); updateToolbar(); refreshChecklist();
    }, 0);
    return v;
  }
  function leave() { if (map) { C().view = { c: map.c, z: map.z }; map.destroy(); map = null; App.save(); } }
  function updateToolbar() {
    $$('#map-tools .tbtn[data-t]').forEach(b => { b.classList.toggle('on', b.dataset.t === tool); b.disabled = b.dataset.t !== 'select' && b.dataset.t !== CAPA[active].g; });
    const del = $('#btn-del'); if (del) del.disabled = !sel;
    const hint = $('#draw-hint'); if (hint) { hint.textContent = tool === 'select' ? (sel ? 'Arrastre los vértices para editar · clic en punto medio agrega vértice · clic derecho quita vértice' : '') : tool === 'Point' ? `Clic para agregar punto en “${CAPA[active].n}”` : `Clic para agregar vértices en “${CAPA[active].n}” · doble clic o Enter para terminar · Retroceso deshace · Esc cancela`; hint.hidden = !hint.textContent; }
  }
  function refreshLayers() {
    const box = $('#layers'); if (!box) return; box.innerHTML = '';
    for (const [g, title] of Object.entries(GRUPOS)) {
      box.appendChild(h('h4', null, title));
      for (const L of CAPAS.filter(c => c.grp === g)) {
        const n = feats(L.k).length, req = L.req || (L.reqCorta && S.modo !== 'otras');
        box.appendChild(h('div', { class: 'lyr' + (active === L.k ? ' on' : '') + (req && !n ? ' miss' : ''), onclick: () => { active = L.k; if (tool !== 'select' && tool !== L.g) setTool('select'); refreshLayers(); refreshPanel(); updateToolbar(); } },
          h('input', { type: 'checkbox', checked: visible(L.k), title: 'Mostrar/ocultar', onclick: e => e.stopPropagation(), onchange: e => { (C().hidden = C().hidden || {})[L.k] = !e.target.checked; map.dirty = true; App.changed(); } }),
          h('span', { class: 'sw', style: swatchStyle(L) }),
          h('span', { class: 'ln' }, L.n, req ? h('i', { class: 'req', title: 'Obligatoria' }, '*') : null),
          h('span', { class: 'cnt' }, n)));
      }
    }
  }
  function swatchStyle(L) { const st = L.st; return L.g === 'Point' ? { background: st.c, borderRadius: st.sym === 'circle' ? '50%' : '2px' } : L.g === 'LineString' ? { background: 'transparent', borderTop: `${Math.max(2, st.w)}px ${st.dash ? 'dashed' : 'solid'} ${st.c}`, height: '0', marginTop: '7px' } : { background: st.fill || 'transparent', border: `2px ${st.dash ? 'dashed' : 'solid'} ${st.c}` }; }

  /* --------- panel inferior --------- */
  function refreshPanel() {
    const box = $('#carto-panel'); if (!box) return; box.innerHTML = '';
    const tabs = [['attr', 'Tabla de atributos'], ['val', 'Validación'], ['tools', 'Herramientas'], ['exp', 'Exportar'], ['plano', 'Plano']];
    box.appendChild(h('div', { class: 'tabs' }, tabs.map(([k, t]) => h('button', { class: 'tab' + (panel === k ? ' on' : ''), onclick: () => { panel = k; refreshPanel(); } }, t, k === 'val' ? badge() : null))));
    const body = h('div', { class: 'card panel-body' }); box.appendChild(body);
    if (panel === 'attr') body.appendChild(attrTable());
    if (panel === 'val') body.appendChild(validationView());
    if (panel === 'tools') body.appendChild(toolsView());
    if (panel === 'exp') body.appendChild(exportView());
    if (panel === 'plano') body.appendChild(planoView());
    refreshChecklist();
  }
  function badge() { const v = validar(); const e = v.filter(x => x.lvl === 'err').length; return e ? h('span', { class: 'badge' }, e) : null; }
  function attrTable() {
    const L = CAPA[active], list = feats(L.k);
    const wrap = h('div');
    wrap.appendChild(h('div', { class: 'attr-h' }, h('b', null, `${L.n} `), h('span', { class: 'muted' }, `— archivo ${L.k}_${predioAbrev()} · ${geomName(L.g)} · ${list.length} elemento(s)`)));
    if (!list.length) { wrap.appendChild(h('p', { class: 'muted' }, `Sin elementos. Dibuje ${geomName(L.g)} con la barra de herramientas o suba un shapefile.`)); return wrap; }
    const thead = h('tr', null, h('th', null, '#'), L.attrs.map(a => h('th', { title: a.d || '' }, a.n, a.req ? h('i', { class: 'req' }, '*') : null, a.auto ? h('span', { class: 'auto-tag' }, 'auto') : null)), h('th'));
    const tb = h('tbody');
    list.forEach((f, i) => {
      const tr = h('tr', { class: sel && sel.id === f.id ? 'on' : '', onclick: e => { if (e.target.closest('input,select,button')) return; sel = { k: L.k, id: f.id }; map.fit(Geo.bbox(f.g), 120); map.dirty = true; refreshPanel(); updateToolbar(); } }, h('td', { class: 'idx' }, i + 1));
      for (const a of L.attrs) {
        let el;
        if (a.auto && a.auto !== 'tipofor') el = h('span', { class: 'auto' }, f.p[a.n] == null ? '' : (a.t === 'N' ? fmt(f.p[a.n], a.dec) : f.p[a.n]));
        else if (a.cod) el = h('select', { onchange: e => { f.p[a.n] = a.t === 'N' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value; changed(); } }, h('option', { value: '' }, ''), COD[a.cod].map(([c, l]) => h('option', { value: c, selected: String(f.p[a.n]) === String(c) }, `${c} = ${l}`)));
        else {
          const lid = a.list === 'rodales' ? 'dl-rod-carto' : a.list === 'flora' ? 'dl-flora' : a.list === 'refs' ? 'dl-refs' : null;
          el = h('input', { type: 'text', value: f.p[a.n] == null ? '' : f.p[a.n], list: lid, oninput: e => { f.p[a.n] = a.t === 'N' ? (e.target.value === '' ? null : num(e.target.value)) : e.target.value; if (a.n === 'N_Rodal') autoProps(L.k, f); changed(); } });
        }
        const td = h('td', null, el);
        if (a.req && (f.p[a.n] == null || f.p[a.n] === '')) td.classList.add('err');
        tr.appendChild(td);
      }
      tr.appendChild(h('td', { class: 'act' }, h('button', { class: 'icon-btn', title: 'Zoom', 'aria-label': 'Acercar al elemento', onclick: () => { map.fit(Geo.bbox(f.g), 120); } }, '⌕'), h('button', { class: 'icon-btn del', title: 'Eliminar', 'aria-label': 'Eliminar elemento', onclick: () => { list.splice(i, 1); if (sel && sel.id === f.id) sel = null; changed(); refreshLayers(); refreshPanel(); } }, '×')));
      tb.appendChild(tr);
    });
    wrap.appendChild(h('datalist', { id: 'dl-rod-carto' }, App.rodales().map(r => h('option', { value: r }))));
    wrap.appendChild(h('datalist', { id: 'dl-refs' }, ['Acceso predial', 'Entrada al rodal', 'Casa administración', 'Infraestructura', 'Acceso rodal', 'Otra'].map(r => h('option', { value: r }))));
    wrap.appendChild(h('div', { class: 'tbl-wrap attr' }, h('table', { class: 'tbl' }, h('thead', null, thead), tb)));
    wrap.appendChild(h('p', { class: 'muted small' }, 'Los atributos se exportan en el orden secuencial indicado por el documento de requerimientos técnicos (Tabla N° 1, Anexo 2). Superficies con 2 decimales (máximo admitido por SAFF), longitudes en km, coordenadas UTM en metros.'));
    return wrap;
  }

  /* --------- validación --------- */
  function validar() {
    const out = []; const add = (msg, lvl = 'err', k) => out.push({ msg, lvl, k });
    const hasAny = CAPAS.some(c => feats(c.k).length);
    if (!hasAny) { add('No se ha generado la cartografía digital (capas Límite predial, Rodales y Puntos de referencia son obligatorias).'); return out; }
    const z = zona(), az = autoZona();
    if (!C().huso && !S.f.pm_huso) add(`Huso UTM no definido: se usa ${z}S según la ubicación del predio. Defínalo en el Capítulo 1 o en la configuración del mapa.`, 'warn');
    if (az && az !== z) add(`El predio se ubica mayoritariamente en el huso ${az}, pero se configuró el huso ${z}.`, 'warn');
    for (const L of CAPAS) {
      const list = feats(L.k);
      const req = L.req || (L.reqCorta && S.modo !== 'otras' && S.inv.rows.length);
      if (req && !list.length) add(`Capa obligatoria sin elementos: ${L.n}.`, 'err', L.k);
      list.forEach((f, i) => {
        const id = `${L.n} #${i + 1}`;
        if (geomType(f.g) !== L.g) add(`${id}: tipo de geometría ${f.g.type} no corresponde a la capa (${geomName(L.g)}).`, 'err', L.k);
        if (f.g.type.startsWith('Multi') && L.g !== 'Point') add(`${id}: geometría multiparte. Cada rodal/elemento debe confeccionarse como capa monoparte (use “Separar multipartes”).`, L.k === 'Rodales' ? 'err' : 'warn', L.k);
        if (L.g === 'Polygon' && Geo.selfIntersections(utm(f.g)).length) add(`${id}: el polígono se autointersecta (geometría no válida).`, 'err', L.k);
        for (const a of L.attrs) if (a.req && (f.p[a.n] == null || f.p[a.n] === '')) add(`${id}: falta el atributo ${a.n}.`, 'err', L.k);
        if (!f.p.Fuente) add(`${id}: falta el atributo Fuente.`, L.grp === 'reconocida' ? 'err' : 'warn', L.k);
      });
    }
    // Rodales
    const rods = feats('Rodales'), lp = feats('Limite_Predial');
    const lpU = lp.map(f => utm(f.g)), defs = App.rodales();
    const seen = {};
    rods.forEach((f, i) => {
      const r = String(f.p.N_Rodal || '').trim(); if (!r) return;
      if (seen[r]) add(`Rodal ${r}: aparece en más de un polígono. Cada rodal debe ser un único polígono monoparte.`, 'err', 'Rodales'); seen[r] = true;
      if (!defs.includes(r)) add(`Rodal ${r} del mapa no está definido en el cuadro 5.1.1.`, 'err', 'Rodales');
      else {
        const sup = num(App.rodalInfo(r).sup);
        if (isFinite(sup) && Math.abs(sup - f.p.Sup_ha) > 0.01) add(`Rodal ${r}: superficie cartográfica ${fmt(f.p.Sup_ha, 2)} ha difiere de 5.1.1 (${fmt(sup, 2)} ha). Use “Actualizar superficies desde cartografía”.`, 'warn', 'Rodales');
        const tf = App.rodalInfo(r).tf; if (tf && !TIPO_FOR_COD[tf]) add(`Rodal ${r}: tipo forestal “${tf}” sin código en la Tabla N°1; describa en observaciones.`, 'warn', 'Rodales');
      }
      if (lpU.length && !lpU.some(c => Geo.within(utm(f.g), c, 1))) add(`Rodal ${r}: no está contenido dentro del límite predial.`, 'err', 'Rodales');
    });
    for (let i = 0; i < rods.length; i++) for (let j = i + 1; j < rods.length; j++) {
      const ov = Geo.overlapArea(utm(rods[i].g), utm(rods[j].g)); if (ov > 1) add(`Rodales ${rods[i].p.N_Rodal} y ${rods[j].p.N_Rodal} se traslapan (${fmt(ov, 0)} m²).`, 'err', 'Rodales');
    }
    for (const r of defs) if (rods.length && !rods.some(f => String(f.p.N_Rodal).trim() === r)) add(`Rodal ${r} (5.1.1) no tiene polígono en la cartografía.`, 'err', 'Rodales');
    // Límite predial vs superficie estudio técnico
    if (lp.length) {
      const s = lp.reduce((a, f) => a + (f.p.Sup_ha || 0), 0), et = num(S.f.pm_supet);
      if (isFinite(et) && Math.abs(et - s) > 0.01) add(`Superficie predial según cartografía (${fmt(s, 2)} ha) difiere de la superficie según Estudio Técnico del Capítulo 1 (${fmt(et, 2)} ha).`, 'warn', 'Limite_Predial');
    }
    // Parcelas
    const par = feats('Parcela');
    par.forEach((f, i) => {
      const rf = rods.find(x => String(x.p.N_Rodal).trim() === String(f.p.N_Rodal).trim());
      if (rf && !Geo.pointInPolygon(Geo.points(f.g)[0], rf.g)) add(`Parcela ${f.p.N_Parc} (rodal ${f.p.N_Rodal}) está fuera de su rodal.`, 'warn', 'Parcela');
    });
    if (S.modo !== 'otras' && par.length) {
      const inv = new Set(S.inv.rows.map(r => String(r[0]).trim() + '|' + Math.trunc(num(r[1]))));
      for (const k of inv) { const [r, p] = k.split('|'); if (!par.some(f => String(f.p.N_Rodal).trim() === r && Number(f.p.N_Parc) === Number(p))) add(`Parcela ${p} del rodal ${r} (inventario) no está en la capa Parcelas.`, 'warn', 'Parcela'); }
    }
    // Fuentes reconocidas dentro del predio
    if (lpU.length) for (const L of CAPAS.filter(c => c.grp === 'reconocida' && !c.noClip)) {
      const n = feats(L.k).filter(f => !lpU.some(c => Geo.within(utm(f.g), c, 1))).length;
      if (n) add(`${L.n}: ${n} elemento(s) exceden el límite predial. Las capas de fuentes reconocidas deben circunscribirse al predio (use “Recortar al límite predial”).`, 'warn', L.k);
    }
    // Áreas dentro de rodales
    feats('Area').forEach(f => { if (rods.length && !rods.some(r => Geo.within(utm(f.g), utm(r.g), 1))) add(`Área ${f.p.N_Area}: no está contenida en un rodal.`, 'warn', 'Area'); });
    return out;
  }
  function validationView() {
    const v = validar();
    const box = h('div');
    box.appendChild(h('div', { class: 'kpis' }, h('div', { class: 'kpi ' + (v.some(x => x.lvl === 'err') ? 'bad' : 'good') }, h('b', null, v.filter(x => x.lvl === 'err').length), h('span', null, 'errores')), h('div', { class: 'kpi mid' }, h('b', null, v.filter(x => x.lvl !== 'err').length), h('span', null, 'advertencias'))));
    if (!v.length) box.appendChild(h('p', { class: 'ok' }, '✓ La cartografía cumple las validaciones automáticas.'));
    box.appendChild(h('ul', { class: 'rev' }, v.map(x => h('li', { class: x.lvl }, x.k ? h('button', { class: 'linkish', onclick: () => { active = x.k; panel = 'attr'; refreshLayers(); refreshPanel(); updateToolbar(); zoomTo([x.k]); } }, CAPA[x.k].n) : null, x.k ? ' — ' : '', x.msg))));
    return box;
  }

  /* --------- herramientas y sincronización --------- */
  function toolsView() {
    const rad = h('input', { type: 'text', value: C().bufferR || '100', style: { width: '80px' }, inputmode: 'decimal' });
    const t = (title, desc, btn) => h('div', { class: 'tool' }, h('div', null, h('b', null, title), h('p', { class: 'muted small' }, desc)), btn);
    return h('div', { class: 'tools' },
      t('Actualizar superficies del 5.1.1', 'Copia Sup_ha de cada rodal al cuadro 5.1.1 y la superficie del límite predial al Capítulo 1 (según Estudio Técnico).', h('button', { class: 'btn sm', onclick: syncSuperficies }, 'Sincronizar')),
      t('Coordenadas de parcelas → 12.1.2', 'Copia Coord_X/Coord_Y y huso de la capa Parcelas al cuadro 12.1.2.', h('button', { class: 'btn sm', onclick: coordsParcelas }, 'Copiar')),
      t('Parcelas desde 12.1.2 → mapa', 'Crea los puntos de parcelas a partir de las coordenadas ingresadas en 12.1.2.', h('button', { class: 'btn sm', onclick: parcelasDesdeCoords }, 'Crear puntos')),
      t('Puntos de referencia ↔ Capítulo 1', 'Copia los puntos de referencia (acceso predial, infraestructura, acceso rodal, otra) entre el mapa y el cuadro del Capítulo 1.', h('div', { class: 'btns' }, h('button', { class: 'btn sm', onclick: refsAlCap1 }, 'Mapa → Cap. 1'), h('button', { class: 'btn sm', onclick: refsDesdeCap1 }, 'Cap. 1 → Mapa'))),
      t('Distancias a cursos y cuerpos de agua → 5.2', 'Calcula la menor distancia de cada rodal a la red hidrográfica y cuerpos de agua y completa el cuadro 5.2.', h('button', { class: 'btn sm', onclick: calcDistHidro }, 'Calcular')),
      t('Área buffer de especies en conservación', 'Genera polígonos de área buffer alrededor de los puntos de la capa “Especies en categoría de conservación” con el radio indicado (m).', h('div', { class: 'btns' }, rad, h('button', { class: 'btn sm', onclick: () => { C().bufferR = rad.value; bufferEspecies(num(rad.value)); } }, 'Generar'))),
      t('Recortar al límite predial', 'Recorta las capas de fuentes reconocidas (excepto caminos, que deben proyectarse hasta el camino público más cercano) al límite predial.', h('button', { class: 'btn sm', onclick: recortar }, 'Recortar')),
      t('Separar multipartes', 'Convierte las geometrías multiparte de la capa activa en elementos monoparte, conservando atributos.', h('button', { class: 'btn sm', onclick: separar }, 'Separar')),
      t('Vaciar capa activa', `Elimina todos los elementos de “${CAPA[active].n}”.`, h('button', { class: 'btn sm ghost', onclick: async () => { if (await confirmar(`¿Eliminar todos los elementos de ${CAPA[active].n}?`, 'Eliminar')) { C().layers[active] = []; sel = null; changed(); refreshLayers(); refreshPanel(); } } }, 'Vaciar')));
  }
  function syncSuperficies() {
    const rods = feats('Rodales'); let n = 0;
    for (const f of rods) { const row = App.t('t511').find(r => String(r.rodal).trim() === String(f.p.N_Rodal).trim()); if (row) { row.sup = String(round(f.p.Sup_ha, 2)); n++; } }
    const lp = feats('Limite_Predial'); if (lp.length) S.f.pm_supet = String(round(lp.reduce((a, f) => a + (f.p.Sup_ha || 0), 0), 2));
    App.changed(true); toast(`${n} rodal(es) actualizados${lp.length ? ' y superficie predial (Estudio Técnico)' : ''}.`, 'ok');
    if (currentView === '5' || currentView === '1') App.rerender();
  }
  function coordsParcelas() {
    let n = 0; for (const f of feats('Parcela')) { const key = String(f.p.N_Rodal).trim() + '|' + Number(f.p.N_Parc); S.coord[key] = { huso: String(zona()), este: String(f.p.Coord_X), norte: String(f.p.Coord_Y) }; n++; }
    App.changed(true); toast(`${n} coordenadas copiadas a 12.1.2.`, n ? 'ok' : 'warn'); if (currentView === '12') App.rerender();
  }
  function parcelasDesdeCoords() {
    let n = 0;
    for (const [key, co] of Object.entries(S.coord)) {
      if (!isNum(co.este) || !isNum(co.norte)) continue;
      const [r, p] = key.split('|');
      if (feats('Parcela').some(f => String(f.p.N_Rodal) === r && Number(f.p.N_Parc) === Number(p))) continue;
      const ll = Geo.fromUTM(num(co.este), num(co.norte), Number(co.huso) || zona());
      const f = { id: uid(), g: { type: 'Point', coordinates: ll }, p: { N_Rodal: r, N_Parc: Number(p) } }; autoProps('Parcela', f); feats('Parcela').push(f); n++;
    }
    changed(); refreshLayers(); refreshPanel(); toast(`${n} parcela(s) creadas.`, n ? 'ok' : 'warn'); if (n) zoomTo(['Parcela']);
  }
  function refsAlCap1() {
    const rows = App.t('c1_ref'); let n = 0;
    for (const f of feats('Referencia')) {
      const nm = String(f.p.Nom_Pto || ''); const lab = /acceso predial/i.test(nm) ? 'Acceso predial' : /infra|casa|galp/i.test(nm) ? 'Infraestructura' : /rodal/i.test(nm) ? 'Acceso rodal' : 'Otra';
      let row = rows.find(r => r.ref === lab); if (!row) { row = { _id: uid(), ref: lab }; rows.push(row); }
      row.este = String(f.p.Coord_X); row.norte = String(f.p.Coord_Y); if (!row.desc) row.desc = nm; n++;
    }
    S.f.pm_huso = String(zona()); App.changed(true); toast(`${n} punto(s) copiados al Capítulo 1.`, n ? 'ok' : 'warn');
  }
  function refsDesdeCap1() {
    let n = 0;
    for (const r of App.t('c1_ref')) {
      if (!isNum(r.este) || !isNum(r.norte)) continue;
      const ll = Geo.fromUTM(num(r.este), num(r.norte), zona());
      const f = { id: uid(), g: { type: 'Point', coordinates: ll }, p: { Nom_Pto: r.desc ? `${r.ref}: ${r.desc}`.slice(0, 100) : r.ref } }; autoProps('Referencia', f); feats('Referencia').push(f); n++;
    }
    changed(); refreshLayers(); refreshPanel(); toast(`${n} punto(s) creados.`, n ? 'ok' : 'warn');
  }
  function calcDistHidro() {
    const rods = feats('Rodales'), hid = feats('Hidrografia'), cue = feats('Cuerpo_Agua');
    if (!rods.length || (!hid.length && !cue.length)) { toast('Se requieren las capas Rodales e Hidrografía o Cuerpos de agua.', 'warn'); return; }
    const t52 = App.t('t52'); let n = 0;
    const tipoH = { 1: 'Río', 2: 'Estero', 3: 'Arroyo', 4: 'Quebrada' }, tipoC = { 1: 'Lago', 2: 'Laguna', 3: 'Embalse', 4: 'Humedal', 5: 'Río', 6: 'Otro' };
    for (const r of rods) {
      const ru = utm(r.g); let best = null;
      for (const [f, kind] of hid.map(f => [f, 'h']).concat(cue.map(f => [f, 'c']))) {
        const d = Geo.distance(ru, utm(f.g)); if (!best || d < best.d) best = { d, f, kind };
      }
      if (!best) continue;
      const rod = String(r.p.N_Rodal).trim();
      let row = t52.find(x => x.rodal === rod); if (!row) { row = { _id: uid(), rodal: rod }; t52.push(row); }
      row.dist = String(round(best.d, 1));
      const inside = Geo.allCoords(utm(best.f.g)).some(p => Geo.pointInPolygon(p, ru));
      row.ubi = best.d > 0.5 ? 'Fuera' : inside ? 'Dentro' : 'Contiguo';
      if (!row.tipo) row.tipo = best.kind === 'h' ? tipoH[best.f.p.Tip_Dren] || '' : tipoC[best.f.p.Tipo_Cuerp] || '';
      if (!row.temp && best.f.p.Tipo_Perma) row.temp = String(best.f.p.Tipo_Perma) === '1' ? 'Permanente' : 'Temporal';
      n++;
    }
    App.changed(true); toast(`Distancias calculadas para ${n} rodal(es) en el cuadro 5.2.`, 'ok');
    if (currentView === '5') App.rerender();
  }
  function bufferEspecies(r) {
    if (!(r > 0)) { toast('Indique un radio válido en metros.', 'warn'); return; }
    let n = 0;
    for (const f of feats('Especie_Cons')) {
      const c = Geo.points(utm(f.g))[0]; const g = Geo.geomFromUTM(Geo.circle(c, r), zona());
      const b = { id: uid(), g, p: { Fuente: 'Elaboración propia' } }; autoProps('Area_Buffer', b); feats('Area_Buffer').push(b); n++;
    }
    changed(); refreshLayers(); refreshPanel(); toast(`${n} área(s) buffer generadas.`, n ? 'ok' : 'warn');
  }
  function recortar() {
    const lp = feats('Limite_Predial'); if (!lp.length) { toast('Se requiere el límite predial.', 'warn'); return; }
    const z = zona(); let ch = 0, del = 0;
    const cont = lp.length === 1 ? utm(lp[0].g) : { type: 'MultiPolygon', coordinates: lp.flatMap(f => Geo.polys(utm(f.g))) };
    for (const L of CAPAS.filter(c => c.grp === 'reconocida' && !c.noClip)) {
      const out = [];
      for (const f of feats(L.k)) {
        const gu = utm(f.g); if (Geo.within(gu, cont, 0.5)) { out.push(f); continue; }
        const cl = Geo.clipTo(gu, cont); if (!cl) { del++; continue; }
        for (const part of Geo.explode(cl)) { const nf = { id: uid(), g: Geo.geomFromUTM(part, z), p: Object.assign({}, f.p) }; autoProps(L.k, nf); out.push(nf); }
        ch++;
      }
      C().layers[L.k] = out;
    }
    changed(); refreshLayers(); refreshPanel(); toast(`${ch} elemento(s) recortados, ${del} eliminado(s) por quedar fuera del predio.`, 'ok');
  }
  function separar() {
    const list = feats(active), out = []; let n = 0;
    for (const f of list) { const parts = Geo.explode(f.g); if (parts.length > 1) n++; parts.forEach(g => { const nf = { id: uid(), g, p: Object.assign({}, f.p) }; autoProps(active, nf); out.push(nf); }); }
    C().layers[active] = out; changed(); refreshLayers(); refreshPanel(); toast(n ? `${n} elemento(s) multiparte separados.` : 'No hay geometrías multiparte.', n ? 'ok' : 'info');
  }
  async function irA() {
    const e = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'Este (m)' }), n = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'Norte (m)' });
    const r = await modal(`Ir a coordenada UTM (huso ${zona()}S, WGS 84)`, h('div', { class: 'grid' }, h('label', { class: 'fld' }, h('span', { class: 'lbl' }, 'Este'), e), h('label', { class: 'fld' }, h('span', { class: 'lbl' }, 'Norte'), n)), [{ label: 'Cancelar', value: null }, { label: 'Ir', value: 'ok', cls: 'primary' }]);
    if (r !== 'ok' || !isNum(e.value) || !isNum(n.value)) return;
    const ll = Geo.fromUTM(num(e.value), num(n.value), zona()); map.c = Geo.merc(ll[0], ll[1]); map.setZoom(16);
    snapPt = ll; setTimeout(() => { snapPt = null; map.dirty = true; }, 2500);
  }

  /* --------- importación --------- */
  async function importar(files) {
    try {
      const bag = {}; const kml = []; const gj = [];
      for (const f of files) {
        const name = f.name;
        if (/\.zip$/i.test(name)) Object.assign(bag, await Zip.read(await readFile(f)));
        else if (/\.kmz$/i.test(name)) { const z = await Zip.read(await readFile(f)); for (const [n, d] of Object.entries(z)) if (/\.kml$/i.test(n)) kml.push({ name: n, text: new TextDecoder().decode(d) }); }
        else if (/\.kml$/i.test(name)) kml.push({ name, text: await readFile(f, 'text') });
        else if (/\.(geo)?json$/i.test(name)) gj.push({ name, obj: JSON.parse(await readFile(f, 'text')) });
        else bag[name] = new Uint8Array(await readFile(f));
      }
      const hayShp = Object.keys(bag).some(n => /\.shp$/i.test(n));
      for (const [n, d] of Object.entries(bag)) if (/\.kml$/i.test(n) && !hayShp) kml.push({ name: n, text: new TextDecoder().decode(d) });
      const sets = Geo.readShapefiles(bag, zona());
      for (const k of kml) { const fs = Geo.parseKml(k.text); groupByType(fs).forEach(([t, list]) => sets.push({ name: k.name.replace(/\.kml$/i, '') + (t ? ' (' + t + ')' : ''), geomType: t, features: list, fields: [], prj: { kind: 'geo', wgs: true }, warn: [] })); }
      for (const g of gj) { const fs = Geo.parseGeoJSON(g.obj); groupByType(fs).forEach(([t, list]) => sets.push({ name: g.name, geomType: t, features: list, fields: [], prj: { kind: 'geo', wgs: true }, warn: [] })); }
      if (!sets.length) { toast('No se encontraron capas válidas. Suba el .zip del shapefile o los archivos .shp, .dbf, .shx y .prj juntos.', 'err', 7000); return; }
      for (const s of sets) await dialogoImportar(s);
    } catch (e) { console.error(e); toast('Error al leer archivos: ' + e.message, 'err', 7000); }
  }
  function groupByType(fs) { const m = {}; fs.forEach(f => { const t = f.geometry.type.replace('Multi', ''); (m[t] = m[t] || []).push(f); }); return Object.entries(m); }
  function guessLayer(s) {
    const n = safeName(s.name).toLowerCase();
    const rules = [['Limite_Predial', /limite|predi|deslinde/], ['RodalesPM', /rodalespm/], ['RodalesBono', /rodalesbono/], ['Rodales', /rodal/], ['Parcela', /parcel/], ['Referencia', /refer|acceso/], ['Sendero', /sender/], ['Hidrografia', /hidro|drenaje|rio|estero|curso/], ['Cuerpo_Agua', /cuerpo|lago|laguna|humedal|agua/], ['Caminos', /camino|vial|ruta/], ['Curvas_Nivel', /curva|nivel|cota/], ['Infraestructura', /infra|constr|casa/], ['Cercos', /cerco/], ['Cortafuegos', /cortaf|cortac/], ['Zona_Proteccion', /protec|zona/], ['Area_Buffer', /buffer/], ['Area', /area/]];
    for (const [k, re] of rules) if (re.test(n) && CAPA[k].g === s.geomType) return k;
    return (CAPAS.find(c => c.g === s.geomType) || {}).k;
  }
  async function dialogoImportar(s) {
    const compat = CAPAS.filter(c => c.g === s.geomType);
    if (!compat.length) { toast(`Capa ${s.name}: tipo de geometría no soportado.`, 'err'); return; }
    const target = h('select', null, compat.map(c => h('option', { value: c.k, selected: c.k === guessLayer(s) }, c.n)));
    const mode = h('select', null, h('option', { value: 'add' }, 'Agregar a los elementos existentes'), h('option', { value: 'rep' }, 'Reemplazar los elementos de la capa'));
    const srcFields = s.fields.length ? s.fields.map(f => f.name) : [...new Set(s.features.flatMap(f => Object.keys(f.properties)))];
    const mapBox = h('div', { class: 'fmap' });
    const drawMap = () => {
      mapBox.innerHTML = '';
      const L = CAPA[target.value];
      mapBox.appendChild(h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, 'Atributo CONAF'), h('th', null, 'Campo del archivo'))),
        h('tbody', null, L.attrs.filter(a => !a.auto || a.auto === 'tipofor').map(a => {
          const guess = srcFields.find(x => x.toLowerCase() === a.n.toLowerCase()) || srcFields.find(x => x.toLowerCase().replace(/[^a-z]/g, '').startsWith(a.n.toLowerCase().replace(/[^a-z]/g, '').slice(0, 5))) || '';
          return h('tr', null, h('td', null, a.n, a.req ? h('i', { class: 'req' }, '*') : null), h('td', null, h('select', { 'data-a': a.n }, h('option', { value: '' }, '— no asignar —'), srcFields.map(x => h('option', { value: x, selected: x === guess }, x)))));
        }))));
    };
    target.addEventListener('change', drawMap); drawMap();
    const body = h('div', null,
      h('p', null, h('b', null, s.name), ` · ${s.features.length} elemento(s) · ${geomName(s.geomType)} · ${s.prj.kind === 'utm' ? `UTM huso ${s.prj.zone}${s.prj.south !== false ? 'S' : 'N'}` : s.prj.kind === 'geo' ? 'Geográficas' : 'Sistema no declarado'} · ${s.prj.wgs ? 'WGS 84' : (s.prj.datum || 'datum desconocido')}`),
      s.warn.length ? h('div', { class: 'alert' }, s.warn.map(w => h('p', null, w))) : null,
      h('div', { class: 'grid' }, h('label', { class: 'fld' }, h('span', { class: 'lbl' }, 'Capa de destino'), target), h('label', { class: 'fld' }, h('span', { class: 'lbl' }, 'Modo'), mode)),
      h('h4', null, 'Asignación de atributos'), mapBox,
      h('p', { class: 'muted small' }, 'Superficies, longitudes, coordenadas y nombre del predio se recalculan automáticamente.'));
    const r = await modal('Importar capa', body, [{ label: 'Omitir', value: null }, { label: 'Importar', value: 'ok', cls: 'primary' }], { wide: true, persist: true });
    if (r !== 'ok') return;
    const k = target.value, L = CAPA[k];
    const asg = {}; $$('select[data-a]', mapBox).forEach(sl => { if (sl.value) asg[sl.dataset.a] = sl.value; });
    if (mode.value === 'rep') C().layers[k] = [];
    for (const f of s.features) {
      const p = {}; for (const a of L.attrs) if (asg[a.n] != null) { let v = f.properties[asg[a.n]]; if (a.t === 'N' && v != null && v !== '') v = num(v); if (a.t === 'C' && v != null) v = String(v); p[a.n] = v; }
      if (!p.Fuente && L.grp === 'reconocida') p.Fuente = '';
      const nf = { id: uid(), g: f.geometry, p }; autoProps(k, nf); feats(k).push(nf);
    }
    active = k; changed(); refreshLayers(); refreshPanel(); updateToolbar(); zoomTo([k]);
    toast(`${s.features.length} elemento(s) importados a ${L.n}.`, 'ok');
  }

  /* --------- exportación --------- */
  function exportView() {
    const kmlChk = h('input', { type: 'checkbox', checked: C().kml !== false, onchange: e => { C().kml = e.target.checked; App.changed(); } });
    const n = CAPAS.filter(c => feats(c.k).length).length;
    return h('div', null,
      h('p', null, `Se generará una carpeta digital rotulada con el nombre del predio (${predioAbrev()}) que contiene ${n} capa(s) en formato Shapefile (SHP, SHX, DBF, PRJ y CPG UTF-8) en WGS 84 / UTM huso ${zona()} Sur, y un archivo de texto con el tipo de solicitud, nombre del predio, rol de avalúo, comuna y propietario.`),
      h('label', { class: 'chk' }, kmlChk, ' Incluir además las capas en formato KML (opcional, no reemplaza al Shapefile)'),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: exportar }, 'Descargar cartografía (.zip)'), h('button', { class: 'btn', onclick: () => download('Cartografia_' + predioAbrev() + '.geojson', JSON.stringify(toGeoJSON()), 'application/geo+json') }, 'GeoJSON (respaldo)')),
      h('ul', { class: 'muted small' }, CAPAS.filter(c => feats(c.k).length).map(c => h('li', null, `${c.k}_${predioAbrev()}.shp — ${feats(c.k).length} elemento(s); atributos: ${c.attrs.map(a => a.n).join(', ')}`))));
  }
  function toGeoJSON() { return { type: 'FeatureCollection', features: CAPAS.flatMap(c => feats(c.k).map(f => ({ type: 'Feature', geometry: f.g, properties: Object.assign({ _capa: c.k }, f.p) }))) }; }
  function exportar() {
    recomputeAll();
    const v = validar().filter(x => x.lvl === 'err');
    const z = zona(), base = predioAbrev(), files = [];
    for (const L of CAPAS) {
      const list = feats(L.k); if (!list.length) continue;
      const fields = L.attrs.map(a => ({ n: a.n, t: a.t, l: a.l, d: a.dec || 0 }));
      const fu = list.map(f => ({ geometry: utm(f.g), properties: f.p }));
      const w = Geo.writeShapefile(L.g, fu, fields);
      const nm = `${base}/${L.k}_${base}`;
      files.push({ name: nm + '.shp', data: w.shp }, { name: nm + '.shx', data: w.shx }, { name: nm + '.dbf', data: w.dbf }, { name: nm + '.prj', data: Geo.prjUTM(z) }, { name: nm + '.cpg', data: 'UTF-8' });
      if (C().kml !== false) files.push({ name: `${base}/KML/${L.k}_${base}.kml`, data: Geo.toKml(`${L.n} - ${base}`, list.map(f => ({ geometry: f.g, properties: f.p, label: f.p[L.label] || '' }))) });
    }
    if (!files.length) { toast('No hay capas con elementos para exportar.', 'warn'); return; }
    const ints = App.t('sol_int').filter(r => r.nombre).map(r => r.nombre).join('; ');
    const info = [
      'Tipo de solicitud: Plan de Manejo Forestal de Bosque Nativo (Ley N° 20.283)',
      'Nombre del predio: ' + (App.f('pr_nombre') || ''),
      'Rol de avalúo y comuna: ' + App.roles().map(r => `${r.rol} (${r.comuna})`).join('; '),
      'Nombre del propietario: ' + ints,
      '', `Sistema de referencia: Datum WGS 84, proyección UTM huso ${z} Sur (EPSG:${32700 + z}). Codificación UTF-8.`,
      'Fecha de generación: ' + new Date().toLocaleString('es-CL'),
      'Autor del Plan de Manejo: ' + (App.f('au_nombre') || '')
    ].join('\r\n');
    files.push({ name: `${base}/Antecedentes_${base}.txt`, data: '﻿' + info });
    download(`Cartografia_${base}.zip`, Zip.build(files));
    toast(v.length ? `Cartografía exportada con ${v.length} error(es) de validación pendientes.` : 'Cartografía exportada.', v.length ? 'warn' : 'ok', 6000);
  }

  /* --------- plano --------- */
  const PAPEL = { A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594], A0: [1189, 841] };
  function planoOpts() {
    const p = C().plano || (C().plano = {});
    return Object.assign({ tipo: 'rodales', papel: 'A3', orient: 'h', escala: 5000, grilla: 'auto', estilo: 'cruces', base: 'none', dpi: 200, baseCarto: 'Cartografía elaborada sobre ' + BASES[C().base || 'osm'].n + '; capas de fuentes reconocidas indicadas en atributo Fuente.', autorPlano: '', fecha: hoy(), titulo: '' }, p);
  }
  function planoView() {
    const o = planoOpts(), p = C().plano;
    const set = (k, v) => { p[k] = v; App.changed(); upd(); };
    const sel = (k, opts, lab) => h('label', { class: 'fld' }, h('span', { class: 'lbl' }, lab), h('select', { onchange: e => set(k, e.target.value) }, opts.map(([v, t]) => h('option', { value: v, selected: String(o[k]) === String(v) }, t))));
    const inp = (k, lab, w2) => h('label', { class: 'fld' + (w2 ? ' w2' : '') }, h('span', { class: 'lbl' }, lab), h('input', { type: k === 'fecha' ? 'date' : 'text', value: o[k] || '', onchange: e => set(k, e.target.value) }));
    const info = h('div', { class: 'note' });
    const prev = h('div', { class: 'plano-prev' });
    const upd = () => {
      const oo = planoOpts(), fr = frameMM(oo), ext = extentUTM(oo);
      if (!ext) { info.textContent = 'Dibuje o cargue al menos el límite predial o los rodales.'; return; }
      const need = Math.max((ext[2] - ext[0]) / (fr.w / 1000), (ext[3] - ext[1]) / (fr.h / 1000));
      const sug = [1000, 2000, 2500, 5000, 7500, 10000, 15000, 20000, 25000, 50000].find(s => s >= need * 1.08) || Math.ceil(need / 1000) * 1000;
      const fits = Number(oo.escala) >= need * 1.02;
      info.innerHTML = '';
      info.append(`Extensión a representar: ${fmt(ext[2] - ext[0], 0)} × ${fmt(ext[3] - ext[1], 0)} m. Escala mínima para que quepa en ${oo.papel}: 1:${fmt(sug, 0)}. `,
        !fits ? h('b', { class: 'bad' }, `A 1:${fmt(oo.escala, 0)} el área no cabe completa en la hoja. `) : '',
        oo.tipo === 'rodales' && Number(oo.escala) > 5000 ? h('b', { class: 'bad' }, 'Los rodales deben representarse en escala ≤ 1:5.000: use un papel mayor o varias hojas. ') : '');
    };
    upd();
    return h('div', null,
      h('p', { class: 'help' }, 'Plano en papel según la pauta: norte, grilla de coordenadas UTM con valores en el borde, escala ≤ 1:5.000 para rodales (el predio puede adaptarse según su forma o extensión) y los 6 recuadros: antecedentes prediales, cartográficos, técnicos, simbología, administrativos y uso CONAF (8 × 4 cm). Se entregan dos originales firmados.'),
      h('div', { class: 'grid g4' },
        sel('tipo', [['rodales', 'Plano de rodales'], ['predial', 'Plano predial']], 'Tipo de plano'),
        sel('papel', Object.keys(PAPEL).map(k => [k, k]), 'Tamaño de papel'),
        sel('orient', [['h', 'Horizontal'], ['v', 'Vertical']], 'Orientación'),
        sel('escala', [1000, 2000, 2500, 5000, 7500, 10000, 15000, 20000, 25000, 50000].map(s => [s, '1:' + fmt(s, 0)]), 'Escala'),
        sel('grilla', [['auto', 'Automática'], [50, '50 m'], [100, '100 m'], [200, '200 m'], [250, '250 m'], [500, '500 m'], [1000, '1.000 m']], 'Intervalo grilla UTM'),
        sel('estilo', [['cruces', 'Cruces'], ['lineas', 'Cuadrícula']], 'Estilo de grilla'),
        sel('base', [['none', 'Sin mapa base']].concat(Object.entries(BASES).filter(([k]) => k !== 'none').map(([k, b]) => [k, b.n])), 'Mapa base en el plano'),
        sel('dpi', [[150, '150 dpi'], [200, '200 dpi'], [300, '300 dpi']], 'Resolución'),
        inp('titulo', 'Título (opcional)', true), inp('autorPlano', 'Autor del plano (si corresponde)'), inp('fecha', 'Fecha de elaboración'),
        inp('baseCarto', 'Base cartográfica', true)),
      info,
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: async () => { prev.innerHTML = '<p class="muted">Generando vista previa…</p>'; const c = await renderPlano(Object.assign({}, planoOpts(), { dpi: 60 })); prev.innerHTML = ''; prev.appendChild(c); } }, 'Vista previa'),
        h('button', { class: 'btn primary', onclick: () => planoPdf() }, 'Descargar plano PDF'),
        h('button', { class: 'btn', onclick: () => planoPng() }, 'Descargar PNG')),
      prev);
  }
  function frameMM(o) {
    let [W, H] = PAPEL[o.papel] || PAPEL.A3; if (o.orient === 'v') [W, H] = [H, W];
    const m = 10, col = Math.min(105, Math.max(80, W * 0.24));
    const side = W >= H;
    return side ? { W, H, x: m + 12, y: m + 10, w: W - 2 * m - col - 4 - 24, h: H - 2 * m - 20, col: { x: W - m - col, y: m, w: col, h: H - 2 * m } }
      : { W, H, x: m + 12, y: m + 10, w: W - 2 * m - 24, h: H - 2 * m - 20 - 120, col: { x: m, y: H - m - 116, w: W - 2 * m, h: 116 } };
  }
  function extentUTM(o) {
    const keys = o.tipo === 'rodales' && feats('Rodales').length ? ['Rodales', 'Parcela', 'Area', 'Sendero'] : ['Limite_Predial', 'Rodales'];
    let bb = null; for (const k of keys) feats(k).forEach(f => bb = Geo.mergeBbox(bb, Geo.bbox(utm(f.g))));
    if (!bb) for (const L of CAPAS) feats(L.k).forEach(f => bb = Geo.mergeBbox(bb, Geo.bbox(utm(f.g))));
    return bb;
  }
  async function drawTilesUTM(ctx, base, toPx, ext, mpp, clip) {
    const B = BASES[base]; if (!B || !B.url) return true;
    const z = zona(); const c0 = Geo.fromUTM(ext[0], ext[1], z), c1 = Geo.fromUTM(ext[2], ext[3], z), c2 = Geo.fromUTM(ext[0], ext[3], z), c3 = Geo.fromUTM(ext[2], ext[1], z);
    const lon0 = Math.min(c0[0], c2[0]), lon1 = Math.max(c1[0], c3[0]), lat0 = Math.min(c0[1], c3[1]), lat1 = Math.max(c1[1], c2[1]);
    const latm = (lat0 + lat1) / 2;
    let tz = Math.round(Math.log2(156543.03392 * Math.cos(latm * Math.PI / 180) / mpp)); tz = Math.max(3, Math.min(B.max, tz));
    const n = 1 << tz, tx = lon => Math.floor((lon + 180) / 360 * n), ty = lat => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n); };
    const tl = (x, y) => [x / n * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI];
    const xs = [tx(lon0), tx(lon1)], ys = [ty(lat1), ty(lat0)];
    if ((xs[1] - xs[0] + 1) * (ys[1] - ys[0] + 1) > 400) return false;
    const jobs = [];
    for (let x = xs[0]; x <= xs[1]; x++) for (let y = ys[0]; y <= ys[1]; y++) {
      const s = B.sub ? B.sub[(x + y) % B.sub.length] : '';
      const url = B.url.replace('{z}', tz).replace('{x}', x).replace('{y}', y).replace('{s}', s);
      jobs.push(new Promise(res => { const img = new Image(); img.crossOrigin = 'anonymous'; const to = setTimeout(() => res(null), 15000); img.onload = () => { clearTimeout(to); res({ img, x, y }); }; img.onerror = () => { clearTimeout(to); res(null); }; img.src = url; }));
    }
    const tiles = (await Promise.all(jobs)).filter(Boolean);
    ctx.save(); clip();
    for (const t of tiles) {
      const P = (a, b) => { const ll = tl(a, b); const u = Geo.toUTM(ll[0], ll[1], z); return toPx(u[0], u[1]); };
      const A0 = P(t.x, t.y), A1 = P(t.x + 1, t.y), A2 = P(t.x, t.y + 1);
      ctx.setTransform((A1[0] - A0[0]) / 256, (A1[1] - A0[1]) / 256, (A2[0] - A0[0]) / 256, (A2[1] - A0[1]) / 256, A0[0], A0[1]);
      ctx.drawImage(t.img, 0, 0, 256.6, 256.6);
    }
    ctx.restore();
    return tiles.length > 0;
  }
  async function renderPlano(o) {
    const fr = frameMM(o), k = o.dpi / 25.4; // px por mm
    const cv = document.createElement('canvas'); cv.width = Math.round(fr.W * k); cv.height = Math.round(fr.H * k);
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    const mm = v => v * k;
    const ext = extentUTM(o) || [0, 0, 1, 1];
    const cx = (ext[0] + ext[2]) / 2, cy = (ext[1] + ext[3]) / 2, scale = Number(o.escala);
    const pxPerM = k * 1000 / scale;
    const fx = mm(fr.x), fy = mm(fr.y), fw = mm(fr.w), fh = mm(fr.h);
    const toPx = (E, N) => [fx + fw / 2 + (E - cx) * pxPerM, fy + fh / 2 - (N - cy) * pxPerM];
    const vext = [cx - fw / 2 / pxPerM, cy - fh / 2 / pxPerM, cx + fw / 2 / pxPerM, cy + fh / 2 / pxPerM];
    const clip = () => { g.beginPath(); g.rect(fx, fy, fw, fh); g.clip(); };
    let baseOk = true;
    if (o.base && o.base !== 'none') { try { baseOk = await drawTilesUTM(g, o.base, toPx, vext, 1 / pxPerM, clip); } catch (e) { baseOk = false; } }
    // vectores
    const z = zona(); const mv = { px: ll => { const u = Geo.toUTM(ll[0], ll[1], z); return toPx(u[0], u[1]); } };
    const s = k / 3.2; // factor de estilo
    g.save(); clip();
    const usados = [];
    for (const L of ORDER()) if (visible(L.k) && feats(L.k).length) { drawLayer(g, mv, L, feats(L.k), s); usados.push(L); }
    for (const L of ORDER()) if (visible(L.k)) drawLabels(g, mv, L, feats(L.k), s * 1.05);
    g.restore();
    // grilla UTM
    let gi = o.grilla === 'auto' ? (scale <= 2500 ? 100 : scale <= 5000 ? 200 : scale <= 10000 ? 500 : 1000) : Number(o.grilla);
    if (scale <= 5000 && o.grilla === 'auto') gi = scale <= 2000 ? 100 : 200;
    g.save(); g.strokeStyle = '#222'; g.lineWidth = Math.max(1, mm(0.18)); g.fillStyle = '#111'; g.font = `${mm(2.2)}px system-ui,sans-serif`;
    const e0 = Math.ceil(vext[0] / gi) * gi, n0 = Math.ceil(vext[1] / gi) * gi;
    clip();
    for (let E = e0; E <= vext[2]; E += gi) for (let N = n0; N <= vext[3]; N += gi) {
      const [x, y] = toPx(E, N);
      if (o.estilo === 'cruces') { g.beginPath(); g.moveTo(x - mm(2), y); g.lineTo(x + mm(2), y); g.moveTo(x, y - mm(2)); g.lineTo(x, y + mm(2)); g.stroke(); }
    }
    if (o.estilo === 'lineas') { g.globalAlpha = .55; for (let E = e0; E <= vext[2]; E += gi) { const [x] = toPx(E, 0); g.beginPath(); g.moveTo(x, fy); g.lineTo(x, fy + fh); g.stroke(); } for (let N = n0; N <= vext[3]; N += gi) { const [, y] = toPx(0, N); g.beginPath(); g.moveTo(fx, y); g.lineTo(fx + fw, y); g.stroke(); } g.globalAlpha = 1; }
    g.restore();
    // marco y etiquetas de grilla
    g.strokeStyle = '#111'; g.lineWidth = mm(0.5); g.strokeRect(fx, fy, fw, fh);
    g.fillStyle = '#111'; g.font = `${mm(2.3)}px system-ui,sans-serif`; g.textAlign = 'center';
    for (let E = e0; E <= vext[2]; E += gi) { const [x] = toPx(E, 0); const t = fmt(E, 0); g.fillText(t, x, fy - mm(1.6)); g.fillText(t, x, fy + fh + mm(3.6)); g.beginPath(); g.moveTo(x, fy); g.lineTo(x, fy - mm(1)); g.moveTo(x, fy + fh); g.lineTo(x, fy + fh + mm(1)); g.stroke(); }
    for (let N = n0; N <= vext[3]; N += gi) { const [, y] = toPx(0, N); const t = fmt(N, 0); g.save(); g.translate(fx - mm(1.8), y); g.rotate(-Math.PI / 2); g.fillText(t, 0, 0); g.restore(); g.save(); g.translate(fx + fw + mm(3.6), y); g.rotate(-Math.PI / 2); g.fillText(t, 0, 0); g.restore(); }
    g.textAlign = 'start';
    // norte
    const nx = fx + mm(14), ny = fy + mm(10);
    g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(nx - mm(7), ny - mm(4), mm(14), mm(24));
    g.fillStyle = '#111'; g.beginPath(); g.moveTo(nx, ny); g.lineTo(nx + mm(4), ny + mm(14)); g.lineTo(nx, ny + mm(11)); g.closePath(); g.fill();
    g.strokeStyle = '#111'; g.lineWidth = mm(.35); g.beginPath(); g.moveTo(nx, ny); g.lineTo(nx - mm(4), ny + mm(14)); g.lineTo(nx, ny + mm(11)); g.closePath(); g.stroke();
    g.font = `700 ${mm(4)}px system-ui,sans-serif`; g.textAlign = 'center'; g.fillText('N', nx, ny + mm(19)); g.textAlign = 'start';
    // escala gráfica
    const sbM = [50, 100, 200, 250, 500, 1000, 2000, 5000].find(v => v * pxPerM >= mm(40)) || 5000;
    const sbx = fx + mm(6), sby = fy + fh - mm(9), sbw = sbM * pxPerM;
    g.fillStyle = 'rgba(255,255,255,.88)'; g.fillRect(sbx - mm(3), sby - mm(6), sbw + mm(30), mm(12));
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#fff' : '#111'; g.fillRect(sbx + sbw / 4 * i, sby, sbw / 4, mm(1.6)); }
    g.strokeStyle = '#111'; g.lineWidth = mm(.25); g.strokeRect(sbx, sby, sbw, mm(1.6));
    g.fillStyle = '#111'; g.font = `${mm(2.4)}px system-ui,sans-serif`; g.fillText('0', sbx - mm(1), sby - mm(1.2)); g.fillText(sbM >= 1000 ? sbM / 1000 + ' km' : sbM + ' m', sbx + sbw - mm(2), sby - mm(1.2));
    g.font = `600 ${mm(2.8)}px system-ui,sans-serif`; g.fillText('Escala 1:' + fmt(scale, 0), sbx + sbw + mm(4), sby + mm(1.8));
    // recuadros
    recuadros(g, fr, mm, o, usados, gi);
    if (!baseOk) { g.fillStyle = '#a00'; g.font = `${mm(2.2)}px system-ui`; g.fillText('Mapa base no disponible (sin conexión o servidor sin permiso de exportación).', fx + mm(2), fy + fh - mm(1.5)); }
    return cv;
  }
  function recuadros(g, fr, mm, o, usados, gi) {
    const col = fr.col, X = mm(col.x), W = mm(col.w);
    const side = fr.W >= fr.H;
    let y = mm(col.y);
    const ints = App.t('sol_int').filter(r => r.nombre), ubi = App.ubicacion();
    const rods = feats('Rodales').slice().sort((a, b) => String(a.p.N_Rodal).localeCompare(String(b.p.N_Rodal), 'es', { numeric: true }));
    const areas = feats('Area');
    const supSol = rods.reduce((s, f) => s + (f.p.Sup_ha || 0), 0) + areas.reduce((s, f) => s + (f.p.Sup_ha || 0), 0);
    const supPred = feats('Limite_Predial').reduce((s, f) => s + (f.p.Sup_ha || 0), 0);
    const line = (t, x, yy, size = 2.4, bold) => { g.font = `${bold ? '700 ' : ''}${mm(size)}px system-ui,sans-serif`; g.fillText(t, x, yy); };
    const wrap = (t, x, yy, maxW, size = 2.3, lh = 3.1) => { g.font = `${mm(size)}px system-ui,sans-serif`; const words = String(t).split(' '); let cur = ''; let n = 0; for (const w of words) { const test = cur ? cur + ' ' + w : w; if (g.measureText(test).width > maxW && cur) { g.fillText(cur, x, yy + mm(lh * n)); n++; cur = w; } else cur = test; } if (cur) { g.fillText(cur, x, yy + mm(lh * n)); n++; } return n; };
    const box = (title, hMM, drawFn, bx = X, bw = W) => {
      g.strokeStyle = '#111'; g.lineWidth = mm(.35); g.strokeRect(bx, y, bw, mm(hMM));
      g.fillStyle = '#2f4f3a'; g.fillRect(bx, y, bw, mm(5)); g.fillStyle = '#fff'; line(title, bx + mm(2), y + mm(3.6), 2.6, true);
      g.fillStyle = '#111'; drawFn(bx + mm(2), y + mm(8.5), bw - mm(4)); y += mm(hMM + 2);
    };
    if (!side) { // disposición inferior: dos filas de tres recuadros
      const cols = 3, gap = mm(2), cw = (W - gap * (cols - 1)) / cols, y0 = y, rowH = (col.h - 2) / 2;
      const place = (i, title, fn) => { const bx = X + (i % cols) * (cw + gap); y = y0 + Math.floor(i / cols) * mm(rowH + 2); box(title, rowH, fn, bx, cw); };
      const fit = (t, w) => { let s2 = String(t || ''); while (s2.length > 3 && g.measureText(s2).width > w) s2 = s2.slice(0, -2); return s2 + (s2 !== String(t || '') ? '…' : ''); };
      place(0, '1. ANTECEDENTES PREDIALES', (x, yy, w) => { [['Interesado/a', ints.map(i => i.nombre).join('; ')], ['Predio', App.f('pr_nombre')], ['Rol avalúo', App.roles().map(r => r.rol).join(', ')], ['Región', ubi.region], ['Provincia', ubi.provincia], ['Comuna', ubi.comuna]].forEach(([a, b], i) => { line(a + ':', x, yy + mm(i * 7.4), 2.1, true); g.font = `${mm(2.1)}px system-ui,sans-serif`; g.fillText(fit(b, w), x, yy + mm(i * 7.4 + 3)); }); });
      place(1, '2. ANTECEDENTES CARTOGRÁFICOS', (x, yy, w) => { const n = wrap('Base cartográfica: ' + o.baseCarto, x, yy, w, 2.1, 2.8); line(`Escala 1:${fmt(o.escala, 0)}`, x, yy + mm(2.8 * n + 2), 2.3, true); line(`Datum WGS 84 · UTM huso ${zona()} Sur`, x, yy + mm(2.8 * n + 5.6), 2.1); line(`Grilla UTM cada ${gi} m`, x, yy + mm(2.8 * n + 8.8), 2.1); });
      place(2, '3. ANTECEDENTES TÉCNICOS', (x, yy, w) => { let k2 = yy; rods.concat(areas).slice(0, 9).forEach(f => { line(f.p.N_Rodal != null ? 'Rodal ' + f.p.N_Rodal : 'Área ' + (f.p.N_Area || ''), x, k2, 2.1); g.textAlign = 'right'; line(fmt(f.p.Sup_ha, 2) + ' ha', x + w, k2, 2.1); g.textAlign = 'left'; k2 += mm(3); }); line('Sup. total solicitada:', x, k2 + mm(1.5), 2.1, true); g.textAlign = 'right'; line(fmt(supSol, 2) + ' ha', x + w, k2 + mm(1.5), 2.1, true); g.textAlign = 'left'; line('Sup. predial según plano:', x, k2 + mm(5), 2.1, true); g.textAlign = 'right'; line(fmt(supPred, 2) + ' ha', x + w, k2 + mm(5), 2.1, true); g.textAlign = 'left'; });
      place(3, '4. SIMBOLOGÍA', (x, yy) => { usados.slice(0, 11).forEach((L, i) => legendItem(g, L, x, yy + mm(i * 4) - mm(1), mm)); });
      place(4, '5. ANTECEDENTES ADMINISTRATIVOS', (x, yy, w) => { line('Autor/a del Plan de Manejo:', x, yy, 2.1, true); g.font = `${mm(2.1)}px system-ui`; g.fillText(fit(App.f('au_nombre'), w), x, yy + mm(3)); g.beginPath(); g.moveTo(x + w * .4, yy + mm(10)); g.lineTo(x + w, yy + mm(10)); g.stroke(); line('Firma', x + w * .62, yy + mm(12.3), 1.9); if (o.autorPlano) line('Autor/a del plano: ' + o.autorPlano, x, yy + mm(16), 2); line('Interesado/a(s):', x, yy + mm(20), 2.1, true); g.font = `${mm(2.1)}px system-ui`; g.fillText(fit(ints.map(i => i.nombre).join('; '), w), x, yy + mm(23)); g.beginPath(); g.moveTo(x + w * .4, yy + mm(30)); g.lineTo(x + w, yy + mm(30)); g.stroke(); line('Firma', x + w * .62, yy + mm(32.3), 1.9); line('Fecha: ' + fechaLarga(o.fecha), x, yy + mm(37), 2); });
      place(5, '6. USO CONAF', (x, yy, w) => { line('N° de solicitud:', x, yy + mm(4), 2.2); g.beginPath(); g.moveTo(x, yy + mm(10)); g.lineTo(x + w, yy + mm(10)); g.stroke(); line('Fecha de ingreso:', x, yy + mm(18), 2.2); g.beginPath(); g.moveTo(x, yy + mm(24)); g.lineTo(x + w, yy + mm(24)); g.stroke(); });
      return;
    }
    // título
    g.fillStyle = '#111'; const tt = o.titulo || (o.tipo === 'rodales' ? 'PLANO DE RODALES' : 'PLANO PREDIAL');
    g.strokeRect(X, y, W, mm(15)); line(tt, X + mm(2), y + mm(5.5), 3.4, true); wrap('Plan de Manejo Forestal de Bosque Nativo · Ley N° 20.283', X + mm(2), y + mm(10), W - mm(4), 2.3); y += mm(17);
    const avail = mm(col.h) - (y - mm(col.y));
    const nRod = Math.min(rods.length + areas.length, 14);
    const hProp = 46, hCart = 26, hTec = 18 + nRod * 3.3, hSim = 10 + Math.ceil(usados.length) * 4.4, hAdm = 50, hConaf = 40;
    box('1. ANTECEDENTES PREDIALES', hProp, (x, yy, w) => {
      [['Interesado/a', ints.map(i => i.nombre).join('; ')], ['Predio', App.f('pr_nombre')], ['Rol de avalúo', App.roles().map(r => r.rol).join(', ')], ['Región', ubi.region], ['Provincia', ubi.provincia], ['Comuna', ubi.comuna]]
        .forEach(([a, b], i) => { line(a + ':', x, yy + mm(i * 6.3), 2.3, true); g.font = `${mm(2.3)}px system-ui`; const tx = String(b || ''); let t = tx; while (g.measureText(t).width > w - mm(24) && t.length > 3) t = t.slice(0, -2); g.fillText(t + (t !== tx ? '…' : ''), x + mm(23), yy + mm(i * 6.3)); });
    });
    box('2. ANTECEDENTES CARTOGRÁFICOS', hCart, (x, yy, w) => {
      const n = wrap('Base cartográfica: ' + o.baseCarto, x, yy, w, 2.2, 2.9);
      line(`Escala del plano: 1:${fmt(o.escala, 0)}`, x, yy + mm(2.9 * n + 1.5), 2.3, true);
      line(`Datum WGS 84 · Proyección UTM · Huso ${zona()} Sur · Grilla ${gi} m`, x, yy + mm(2.9 * n + 5.3), 2.2);
    });
    box('3. ANTECEDENTES TÉCNICOS', hTec, (x, yy, w) => {
      line('Rodal / Área', x, yy, 2.2, true); line('Superficie (ha)', x + w - mm(24), yy, 2.2, true);
      let k2 = yy + mm(3.4);
      rods.concat(areas).slice(0, 14).forEach(f => { line(f.p.N_Rodal != null ? 'Rodal ' + f.p.N_Rodal : 'Área ' + (f.p.N_Area || ''), x, k2, 2.2); g.textAlign = 'right'; line(fmt(f.p.Sup_ha, 2), x + w - mm(2), k2, 2.2); g.textAlign = 'left'; k2 += mm(3.3); });
      if (rods.length + areas.length > 14) { line(`… y ${rods.length + areas.length - 14} más`, x, k2, 2.1); k2 += mm(3.3); }
      g.beginPath(); g.moveTo(x, k2 - mm(2.2)); g.lineTo(x + w, k2 - mm(2.2)); g.stroke();
      line('Superficie total solicitada:', x, k2 + mm(1), 2.3, true); g.textAlign = 'right'; line(fmt(supSol, 2) + ' ha', x + w - mm(2), k2 + mm(1), 2.3, true); g.textAlign = 'left';
      line('Superficie predial según plano:', x, k2 + mm(4.4), 2.3, true); g.textAlign = 'right'; line(fmt(supPred, 2) + ' ha', x + w - mm(2), k2 + mm(4.4), 2.3, true); g.textAlign = 'left';
    });
    box('4. SIMBOLOGÍA', hSim, (x, yy) => { usados.forEach((L, i) => legendItem(g, L, x, yy + mm(i * 4.4) - mm(1.5), mm)); });
    const rest = (mm(col.y + col.h) - y) / mm(1) - hConaf - 2;
    box('5. ANTECEDENTES ADMINISTRATIVOS', Math.max(hAdm, rest), (x, yy, w) => {
      line('Autor/a del Plan de Manejo:', x, yy, 2.2, true); wrap(App.f('au_nombre') || '', x, yy + mm(3), w, 2.3);
      g.beginPath(); g.moveTo(x + w * 0.45, yy + mm(11)); g.lineTo(x + w, yy + mm(11)); g.stroke(); line('Firma', x + w * 0.68, yy + mm(13.5), 2);
      if (o.autorPlano) { line('Autor/a del plano: ' + o.autorPlano, x, yy + mm(17), 2.2); }
      line('Interesado/a(s):', x, yy + mm(21), 2.2, true); wrap(ints.map(i => i.nombre).join('; '), x, yy + mm(24), w, 2.3);
      g.beginPath(); g.moveTo(x + w * 0.45, yy + mm(33)); g.lineTo(x + w, yy + mm(33)); g.stroke(); line('Firma', x + w * 0.68, yy + mm(35.5), 2);
      line('Fecha de elaboración: ' + fechaLarga(o.fecha), x, yy + mm(40), 2.2);
    });
    // Uso CONAF 8 x 4 cm
    const cw = Math.min(W, mm(80)); y = Math.min(y, mm(col.y + col.h - hConaf));
    box('6. USO CONAF', hConaf, (x, yy, w) => { line('N° de solicitud:', x, yy + mm(4), 2.4); g.beginPath(); g.moveTo(x + mm(24), yy + mm(4.5)); g.lineTo(x + w, yy + mm(4.5)); g.stroke(); line('Fecha de ingreso:', x, yy + mm(14), 2.4); g.beginPath(); g.moveTo(x + mm(26), yy + mm(14.5)); g.lineTo(x + w, yy + mm(14.5)); g.stroke(); }, X + W - cw, cw);
  }
  function legendItem(g, L, x, y, mm) {
    const st = L.st, s = mm(1) / 3.2 * 3;
    if (L.g === 'Point') symbol(g, x + mm(3), y, st, mm(1) / 3.4);
    else if (L.g === 'LineString') { g.strokeStyle = st.c; g.lineWidth = (st.w || 1.5) * mm(1) / 3.2; g.setLineDash((st.dash || []).map(d => d * mm(1) / 3.2)); g.beginPath(); g.moveTo(x, y); g.lineTo(x + mm(7), y); g.stroke(); g.setLineDash([]); }
    else { g.fillStyle = st.fill || '#fff'; g.fillRect(x, y - mm(1.6), mm(7), mm(3.4)); g.strokeStyle = st.c; g.lineWidth = Math.max(1, (st.w || 1.5) * mm(1) / 4); g.setLineDash((st.dash || []).map(d => d * mm(1) / 4)); g.strokeRect(x, y - mm(1.6), mm(7), mm(3.4)); g.setLineDash([]); }
    g.fillStyle = '#111'; g.font = `${mm(2.3)}px system-ui,sans-serif`; g.fillText(L.n, x + mm(9.5), y + mm(0.9));
  }
  async function planoCanvas() {
    const o = planoOpts();
    if (!extentUTM(o)) { toast('No hay elementos para el plano.', 'warn'); return null; }
    toast('Generando plano…', 'info', 2500);
    let cv = await renderPlano(o);
    try { cv.toDataURL('image/jpeg', 0.5); } catch (e) { toast('El mapa base no permite exportación; se genera el plano sin mapa base.', 'warn', 6000); cv = await renderPlano(Object.assign({}, o, { base: 'none' })); }
    return { cv, o };
  }
  async function planoPdf() {
    const r = await planoCanvas(); if (!r) return; const fr = frameMM(r.o);
    const blob = Pdf.build([{ wmm: fr.W, hmm: fr.H, jpeg: r.cv.toDataURL('image/jpeg', 0.92), pxw: r.cv.width, pxh: r.cv.height }]);
    download(`Plano_${r.o.tipo}_${predioAbrev()}_1-${r.o.escala}.pdf`, blob);
  }
  async function planoPng() { const r = await planoCanvas(); if (!r) return; r.cv.toBlob(b => download(`Plano_${r.o.tipo}_${predioAbrev()}.png`, b), 'image/png'); }

  /* --------- imagen 12.3.4 --------- */
  async function imagenRodal(rod) {
    const rf = feats('Rodales').find(f => String(f.p.N_Rodal).trim() === String(rod).trim());
    const pars = feats('Parcela').filter(f => String(f.p.N_Rodal).trim() === String(rod).trim());
    if (!rf && !pars.length) { toast(`No hay polígono del rodal ${rod} ni parcelas en la cartografía.`, 'warn'); return null; }
    let bb = null; (rf ? [rf] : []).concat(pars).forEach(f => bb = Geo.mergeBbox(bb, Geo.bbox(utm(f.g))));
    const W = 1200, H = 800, pad = 60; const dx = Math.max(50, bb[2] - bb[0]), dy = Math.max(50, bb[3] - bb[1]);
    const ppm = Math.min((W - 2 * pad) / dx, (H - 2 * pad) / dy), cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
    const toPx = (E, N) => [W / 2 + (E - cx) * ppm, H / 2 - (N - cy) * ppm];
    const draw = async base => {
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.fillStyle = '#f4f5f0'; g.fillRect(0, 0, W, H);
      if (base) await drawTilesUTM(g, base, toPx, [cx - W / 2 / ppm, cy - H / 2 / ppm, cx + W / 2 / ppm, cy + H / 2 / ppm], 1 / ppm, () => { g.beginPath(); g.rect(0, 0, W, H); g.clip(); });
      const z = zona(), mv = { px: ll => { const u = Geo.toUTM(ll[0], ll[1], z); return toPx(u[0], u[1]); } };
      if (rf) { strokePath(rf.g, g, mv, true); g.strokeStyle = '#ffd400'; g.lineWidth = 4; g.stroke(); }
      g.font = '600 18px system-ui'; g.textAlign = 'center';
      for (const p of pars) { const c = mv.px(Geo.points(p.g)[0]); g.fillStyle = '#e8112d'; g.beginPath(); g.arc(c[0], c[1], 7, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText('P' + p.p.N_Parc, c[0], c[1] - 14); g.fillStyle = '#fff'; g.fillText('P' + p.p.N_Parc, c[0], c[1] - 14); }
      g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(10, 10, 330, 34); g.fillStyle = '#111'; g.font = '600 17px system-ui'; g.fillText(`Rodal ${rod} · ${pars.length} parcela(s) · Huso ${zona()}S`, 20, 33);
      return cv;
    };
    let cv = await draw('esri');
    try { return cv.toDataURL('image/jpeg', 0.88); } catch (e) { cv = await draw(null); return cv.toDataURL('image/jpeg', 0.88); }
  }

  /* --------- checklist e impresión --------- */
  const ELEMENTOS = [
    ['Límite predial.', ['Limite_Predial']], ['Grilla de coordenadas UTM.', 'plano'], ['Acceso predial y lugares de interés señalados en el Capítulo 1 del Plan de Manejo.', ['Referencia']],
    ['Red hidrográfica, cuerpos de agua y humedales, según corresponda.', ['Hidrografia', 'Cuerpo_Agua']], ['Infraestructura presente en el predio, tales como casas, galpones, etc., cuando corresponda.', ['Infraestructura']],
    ['Rodales a intervenir.', ['Rodales']], ['Zonas de protección.', ['Zona_Proteccion']], ['Puntos donde se ubiquen especies en categoría de conservación y su respectiva área buffer, cuando corresponda.', ['Especie_Cons', 'Area_Buffer']],
    ['Curvas de nivel.', ['Curvas_Nivel']], ['Parcelas de inventario.', ['Parcela']], ['Vías de ingreso a los rodales, sólo cuando éstos sean de difícil acceso.', ['Vias_Ingreso']],
    ['Áreas o puntos dentro de los rodales, donde se desarrollarán actividades bonificables (limpias, establecimiento de la regeneración, plantación suplementaria, siembra directa, protección individual de plantas, obras de control de erosión, etc.).', ['Area']],
    ['Trazado de senderos y sus instalaciones (letreros, estaciones de observación, etc.).', ['Sendero', 'Instalacion']], ['Emplazamiento de obras de control de erosión, cuando corresponda.', ['Obras_Erosion']],
    ['Caminos existentes, caminos proyectados y canchas de acopio.', ['Caminos', 'Caminos_Proyect', 'Cancha_Acopio']], ['Trazado de cercos construidos o reparados, cortafuegos y/o cortacombustibles, cuando corresponda.', ['Cercos', 'Cortafuegos']]
  ];
  function refreshChecklist() {
    const box = $('#chk13'); if (!box) return; box.innerHTML = '';
    box.appendChild(h('ul', { class: 'chk13' }, ELEMENTOS.map(([t, ks]) => { const n = ks === 'plano' ? 1 : ks.reduce((s, k) => s + feats(k).length, 0); return h('li', { class: n ? 'ok' : '' }, h('span', { class: 'mark' }, n ? '✓' : '○'), t, ks !== 'plano' ? h('span', { class: 'muted' }, ` (${n})`) : h('span', { class: 'muted' }, ' (automática en el plano)')); })));
  }
  function printLista() {
    return h('div', null, h('p', null, 'Los elementos a representar en la cartografía digital georreferenciada y planos en papel son los siguientes:'),
      h('ul', null, ELEMENTOS.map(([t]) => h('li', null, t))),
      h('p', { class: 'pnote' }, `Cartografía digital entregada en formato Shapefile, Datum WGS 84, proyección UTM huso ${zona()} Sur. Capas: ${CAPAS.filter(c => feats(c.k).length).map(c => c.n).join(', ') || '—'}.`));
  }
  function reload() { sel = null; drawPts = []; if (map) map.dirty = true; }

  return { render, leave, validar, syncSuperficies, calcDistHidro, coordsParcelas, imagenRodal, printLista, reload, CAPAS, renderPlano, exportar, _feats: feats, _addFeature: addFeature };
})();
