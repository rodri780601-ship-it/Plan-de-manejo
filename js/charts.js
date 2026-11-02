/* ==========================================================================
   Gráficos SVG (sin dependencias): barras apiladas, líneas, eje secundario,
   intervalos de confianza.
   ========================================================================== */
'use strict';

const Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const PAL = ['#2f6b3f', '#c8862a', '#3a76a8', '#8e4f8a', '#7a7a72'];
  const s = (tag, attrs, ...kids) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs || {}) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    for (const c of kids.flat()) if (c != null) el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    return el;
  };
  function nice(max) {
    if (!(max > 0)) return { max: 1, step: 0.25 };
    const exp = Math.pow(10, Math.floor(Math.log10(max)));
    const f = max / exp; const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    const top = nf * exp; const step = top / 5;
    return { max: Math.ceil(max / step) * step, step };
  }
  const CSS = '.ct{font:600 13px system-ui,sans-serif;fill:#1d2a20}.tk{font:11px system-ui,sans-serif;fill:#4a554c}.tk.b{font-weight:700;fill:#1d2a20}.at{font:600 11px system-ui,sans-serif;fill:#33403a}.lg{font:11px system-ui,sans-serif;fill:#33403a}.grid{stroke:#e3e7e1;stroke-width:1}.axis{stroke:#6c776e;stroke-width:1.2}';
  const style = () => s('style', null, CSS);
  const tick = v => Math.abs(v) >= 1000 ? fmt(v, 0) : Math.abs(v) >= 10 ? fmt(v, 0) : fmt(v, Math.abs(v) < 1 && v !== 0 ? 2 : 1);

  /** cfg: {title, labels, xTitle, yTitle, bars:[{name,data,color,dash}], stacked, line:{name,data,color,pct}, lines:[{name,data,color}], width, height} */
  function combo(cfg) {
    const W = cfg.width || 640, H = cfg.height || 300, cid = 'h' + Math.random().toString(36).slice(2, 8);
    const m = { l: 62, r: cfg.line ? 56 : 18, t: cfg.title ? 34 : 14, b: 58 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const labels = cfg.labels || [];
    const n = Math.max(1, labels.length);
    const bars = cfg.bars || [], lines = cfg.lines || [];
    let ymax = 0;
    for (let i = 0; i < n; i++) {
      if (cfg.stacked) ymax = Math.max(ymax, bars.reduce((a, b) => a + (+b.data[i] || 0), 0));
      else bars.forEach(b => ymax = Math.max(ymax, +b.data[i] || 0));
      lines.forEach(l => ymax = Math.max(ymax, +l.data[i] || 0));
    }
    const sc = nice(ymax * 1.05);
    const y = v => m.t + ph - (v / sc.max) * ph;
    const bw = pw / n;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': cfg.title || 'Gráfico' });
    svg.appendChild(style());
    svg.appendChild(s('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff' }));
    if (cfg.title) svg.appendChild(s('text', { x: W / 2, y: 20, 'text-anchor': 'middle', class: 'ct' }, cfg.title));
    for (let v = 0; v <= sc.max + 1e-9; v += sc.step) {
      svg.appendChild(s('line', { x1: m.l, x2: m.l + pw, y1: y(v), y2: y(v), class: 'grid' }));
      svg.appendChild(s('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'tk' }, tick(v)));
    }
    // barras
    const nb = cfg.stacked ? 1 : Math.max(1, bars.length);
    const gap = Math.min(10, bw * 0.18), inner = (bw - gap) / nb;
    for (let i = 0; i < n; i++) {
      let acc = 0;
      bars.forEach((b, bi) => {
        const v = +b.data[i] || 0; if (!v) return;
        const x = m.l + i * bw + gap / 2 + (cfg.stacked ? 0 : bi * inner);
        const y0 = cfg.stacked ? y(acc + v) : y(v), hh = cfg.stacked ? y(acc) - y(acc + v) : y(0) - y(v);
        const r = s('rect', { x, y: y0, width: Math.max(1, inner - 1), height: Math.max(0, hh), fill: b.dash ? 'url(#' + cid + bi + ')' : (b.color || PAL[bi]), stroke: b.dash ? (b.color || PAL[bi]) : 'none', 'stroke-dasharray': b.dash ? '4 2' : null, 'stroke-width': b.dash ? 1.2 : null });
        r.appendChild(s('title', null, `${labels[i]} · ${b.name}: ${fmt(v, 2)}`));
        svg.appendChild(r);
        if (cfg.stacked) acc += v;
      });
    }
    const defs = s('defs');
    bars.forEach((b, bi) => { if (b.dash) defs.appendChild(s('pattern', { id: cid + bi, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, s('rect', { width: 6, height: 6, fill: '#fff' }), s('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: b.color || PAL[bi], 'stroke-width': 2, opacity: .55 }))); });
    svg.insertBefore(defs, svg.firstChild);
    // líneas primarias
    lines.forEach((l, li) => {
      const pts = []; l.data.forEach((v, i) => { if (v !== '' && v != null && isFinite(v)) pts.push([m.l + i * bw + bw / 2, y(+v)]); });
      if (pts.length) svg.appendChild(s('polyline', { points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: l.color || PAL[li], 'stroke-width': 2.2, 'stroke-dasharray': l.dash ? '5 3' : null }));
      pts.forEach(p => svg.appendChild(s('circle', { cx: p[0], cy: p[1], r: 2.8, fill: l.color || PAL[li] })));
    });
    // línea secundaria (%)
    if (cfg.line) {
      const L2 = cfg.line, vals = L2.data.map(v => (v === '' || v == null || !isFinite(v)) ? null : +v);
      const mx = cfg.line.pct ? 1 : nice(Math.max(...vals.filter(v => v != null), 0.0001)).max;
      const y2 = v => m.t + ph - (v / mx) * ph;
      for (let k = 0; k <= 4; k++) { const v = mx * k / 4; svg.appendChild(s('text', { x: m.l + pw + 6, y: y2(v) + 4, class: 'tk' }, L2.pct ? Math.round(v * 100) + '%' : tick(v))); }
      const pts = []; vals.forEach((v, i) => { if (v != null) pts.push([m.l + i * bw + bw / 2, y2(v)]); });
      if (pts.length) svg.appendChild(s('polyline', { points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: L2.color || '#b23b2e', 'stroke-width': 2, 'stroke-dasharray': '1 0' }));
      pts.forEach((p, i) => { const c = s('circle', { cx: p[0], cy: p[1], r: 3, fill: '#fff', stroke: L2.color || '#b23b2e', 'stroke-width': 2 }); svg.appendChild(c); });
      svg.appendChild(s('text', { x: W - 8, y: m.t + ph / 2, transform: `rotate(90 ${W - 8} ${m.t + ph / 2})`, 'text-anchor': 'middle', class: 'at' }, L2.name));
    }
    // ejes
    svg.appendChild(s('line', { x1: m.l, x2: m.l + pw, y1: y(0), y2: y(0), class: 'axis' }));
    const every = Math.ceil(n / 24);
    labels.forEach((lb, i) => { if (i % every) return; svg.appendChild(s('text', { x: m.l + i * bw + bw / 2, y: m.t + ph + 15, 'text-anchor': 'middle', class: 'tk' }, String(lb))); });
    if (cfg.xTitle) svg.appendChild(s('text', { x: m.l + pw / 2, y: m.t + ph + 32, 'text-anchor': 'middle', class: 'at' }, cfg.xTitle));
    if (cfg.yTitle) svg.appendChild(s('text', { x: 14, y: m.t + ph / 2, transform: `rotate(-90 14 ${m.t + ph / 2})`, 'text-anchor': 'middle', class: 'at' }, cfg.yTitle));
    // leyenda
    const leg = bars.map((b, i) => ({ name: b.name, color: b.color || PAL[i], dash: b.dash, type: 'bar' })).concat(lines.map((l, i) => ({ name: l.name, color: l.color || PAL[i], type: 'line', dash: l.dash })));
    if (cfg.line) leg.push({ name: cfg.line.name, color: cfg.line.color || '#b23b2e', type: 'line' });
    let lx = m.l; const ly = H - 12;
    leg.forEach(it => {
      if (it.type === 'bar') svg.appendChild(s('rect', { x: lx, y: ly - 9, width: 12, height: 10, fill: it.dash ? '#fff' : it.color, stroke: it.color, 'stroke-dasharray': it.dash ? '3 2' : null }));
      else svg.appendChild(s('line', { x1: lx, x2: lx + 14, y1: ly - 4, y2: ly - 4, stroke: it.color, 'stroke-width': 2.4, 'stroke-dasharray': it.dash ? '4 2' : null }));
      const t = s('text', { x: lx + 18, y: ly, class: 'lg' }, it.name); svg.appendChild(t);
      lx += 26 + Math.min(220, String(it.name).length * 6.4);
    });
    return svg;
  }

  /** Intervalos de confianza: groups [{label, lo, mean, hi, color}] */
  function ci(cfg) {
    const W = cfg.width || 300, H = cfg.height || 260, m = { l: 62, r: 16, t: 32, b: 40 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const g = cfg.groups.filter(x => isFinite(x.mean));
    const vals = g.flatMap(x => [x.lo, x.hi, x.mean]).filter(isFinite);
    let mn = Math.min(...vals), mx = Math.max(...vals);
    if (!vals.length) { mn = 0; mx = 1; }
    const pad = (mx - mn) * 0.25 || Math.abs(mx) * 0.1 || 1; mn = Math.max(0, mn - pad); mx = mx + pad;
    const y = v => m.t + ph - (v - mn) / (mx - mn) * ph;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': cfg.title });
    svg.appendChild(style());
    svg.appendChild(s('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff' }));
    svg.appendChild(s('text', { x: W / 2, y: 18, 'text-anchor': 'middle', class: 'ct' }, cfg.title));
    for (let k = 0; k <= 4; k++) { const v = mn + (mx - mn) * k / 4; svg.appendChild(s('line', { x1: m.l, x2: m.l + pw, y1: y(v), y2: y(v), class: 'grid' })); svg.appendChild(s('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'tk' }, tick(v))); }
    const bw = pw / Math.max(1, cfg.groups.length);
    cfg.groups.forEach((x, i) => {
      const cx = m.l + bw * i + bw / 2, col = x.color || PAL[i];
      svg.appendChild(s('text', { x: cx, y: H - 16, 'text-anchor': 'middle', class: 'tk' }, x.label));
      if (!isFinite(x.mean)) return;
      if (isFinite(x.lo) && isFinite(x.hi)) {
        svg.appendChild(s('line', { x1: cx, x2: cx, y1: y(x.lo), y2: y(x.hi), stroke: col, 'stroke-width': 2 }));
        [x.lo, x.hi].forEach(v => svg.appendChild(s('line', { x1: cx - 10, x2: cx + 10, y1: y(v), y2: y(v), stroke: col, 'stroke-width': 2 })));
        svg.appendChild(s('text', { x: cx + 14, y: y(x.hi) + 4, class: 'tk' }, tick(x.hi)));
        svg.appendChild(s('text', { x: cx + 14, y: y(x.lo) + 4, class: 'tk' }, tick(x.lo)));
      }
      svg.appendChild(s('rect', { x: cx - 5, y: y(x.mean) - 5, width: 10, height: 10, fill: col, transform: `rotate(45 ${cx} ${y(x.mean)})` }));
      svg.appendChild(s('text', { x: cx - 14, y: y(x.mean) + 4, 'text-anchor': 'end', class: 'tk b' }, tick(x.mean)));
    });
    if (cfg.yTitle) svg.appendChild(s('text', { x: 14, y: m.t + ph / 2, transform: `rotate(-90 14 ${m.t + ph / 2})`, 'text-anchor': 'middle', class: 'at' }, cfg.yTitle));
    return svg;
  }
  /** Convierte un SVG en imagen PNG (dataURL) para PDF */
  function toPng(svg, scale = 2) {
    return new Promise(res => {
      const xml = new XMLSerializer().serializeToString(svg);
      const vb = svg.viewBox.baseVal; const img = new Image();
      img.onload = () => { const c = document.createElement('canvas'); c.width = vb.width * scale; c.height = vb.height * scale; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); res(c); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"').replace(/xmlns="http:\/\/www.w3.org\/2000\/svg" xmlns="http:\/\/www.w3.org\/2000\/svg"/, 'xmlns="http://www.w3.org/2000/svg"'));
    });
  }
  return { combo, ci, toPng, PAL };
})();
