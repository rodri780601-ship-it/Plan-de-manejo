/* ==========================================================================
   Aplicación: estado, navegación, motor de formularios y tablas, guardado,
   revisión e impresión.
   ========================================================================== */
'use strict';

const STORE_KEY = 'pmfbn_proyecto_v1';
const S = {}; // estado global
let calcRegistry = [];   // elementos calculados en la vista actual
let currentView = 'inicio';

function nuevoEstado() {
  return {
    version: 1, creado: new Date().toISOString(), modo: 'ambas', opt: {},
    f: {}, t: {},
    inv: { tipo: 'Monopódico', rows: [] },
    rod: {}, vol: {}, coord: {}, c72: {}, c742: {},
    carto: { huso: '', layers: {}, plano: {} }
  };
}

const App = {
  /* ---------- acceso a datos ---------- */
  f(k) { return S.f[k] == null ? '' : S.f[k]; },
  t(id) { return S.t[id] || (S.t[id] = []); },
  rodales() {
    const set = [];
    for (const r of App.t('t511')) { const v = String(r.rodal || '').trim(); if (v && !set.includes(v)) set.push(v); }
    return set;
  },
  rodalInfo(rod) { return App.t('t511').find(r => String(r.rodal).trim() === String(rod).trim()) || {}; },
  proyectos() { return S.opt.c3 ? App.t('c3_proy').map(r => r.id).filter(Boolean) : []; },
  interesado() { return App.t('sol_int')[0] || {}; },
  roles() { return App.t('sol_rol').filter(r => r.rol || r.comuna); },
  ubicacion() {
    const c = (App.roles()[0] || {}).comuna;
    const row = CAT.COMUNAS.find(x => x[0] === c);
    const comunas = [...new Set(App.roles().map(r => r.comuna).filter(Boolean))].join(', ');
    return { comuna: comunas, provincia: row ? row[1] : '', region: row ? row[2] : '' };
  },
  flora(sp) { return CAT.FLORA.find(x => x[0] === sp) || ['', '', '', '']; },
  fauna(sp) { return CAT.FAUNA.find(x => x[0] === sp) || ['', '', '']; },
  supAfecta() { return App.t('t511').reduce((s, r) => s + (num(r.sup) || 0), 0); },
  sup91(r) {
    const a = num(r.ancho), l = num(r.largo), c = num(r.cant);
    if (!isFinite(a) || !isFinite(l)) return NaN;
    if (/^Camino/.test(r.tipo || '')) return a * l / 10000;
    return isFinite(c) ? c * a * l / 10000 : NaN;
  },
  alerta18(r) {
    const rows = App.t('t91').filter(x => x.rodal === r.rodal);
    const sup = rows.reduce((s, x) => s + (App.sup91(x) || 0), 0);
    const sr = num(App.rodalInfo(r.rodal).sup);
    if (!isFinite(sr) || sr <= 0 || !sup) return '';
    return sup / sr >= 0.18 ? `Área alterada = ${fmt(sup / sr * 100, 1)} % de la superficie del rodal (≥ 18 %)` : '';
  },
  especiesLista() {
    const inv = [...new Set(S.inv.rows.map(r => r[2]).filter(Boolean))];
    return [...new Set(inv.concat(L.Especies_01))].sort((a, b) => a.localeCompare(b, 'es'));
  },

  /* ---------- tipo de bosque y zonas RSAH (7.4.1) ---------- */
  tipoBosque(rod) {
    const hid = App.t('t52').filter(r => r.rodal === rod && isNum(r.dist));
    const fis = App.t('t531').find(r => r.rodal === rod);
    const sue = App.t('t532').find(r => r.rodal === rod);
    const dis = hid.length ? (Math.min(...hid.map(r => num(r.dist))) < 200 ? 1 : 2) : 0;
    const pen = fis && fis.pend ? (/≥ 45|≥ 60/.test(fis.pend) ? 1 : 2) : 0;
    const fra = sue && sue.fra ? (sue.fra !== 'No' ? 1 : 2) : 0;
    if (dis + pen + fra === 0) return 'Sin información';
    return (dis === 1 || pen === 1 || fra === 1) ? 'Conservación y protección' : 'Uso múltiple';
  },
  zonasRSAH(rod) {
    const hid = App.t('t52').filter(r => r.rodal === rod && r.tipo);
    if (!hid.length) return 'Sin información';
    const fis = App.t('t531').find(r => r.rodal === rod) || {};
    const p = fis.pend || '';
    const pc = p === '< 30' ? 0 : p === '≥ 30 ᴧ < 45' ? 1 : /≥ 45|≥ 60/.test(p) ? 2 : -1;
    const out = new Set();
    for (const h of hid) {
      const d = num(h.dist), t = h.tipo;
      if (!isFinite(d)) { out.add('Sin información (distancia)'); continue; }
      const curso = ['Arroyo', 'Estero', 'Quebrada', 'Río', 'Otro'].includes(t);
      const cuerpo = ['Lago', 'Laguna', 'Embalse', 'Manantial'].includes(t);
      const gradual = (lim1, lim2) => {
        if (pc < 0) return 'Sin información (pendiente)';
        if (pc === 0) return d < 10 ? 'Exclusión de intervención' : 'No aplican';
        if (pc === 1) return d < 10 ? 'Exclusión de intervención y Manejo limitado' : d < lim1 ? 'Manejo limitado' : 'No aplican';
        return d < 10 ? 'Exclusión de intervención y Manejo limitado' : d < lim2 ? 'Manejo limitado' : 'No aplican';
      };
      if (curso) {
        const s = h.sec || '';
        if (!s) out.add('Sin información (sección de cauce)');
        else if (s === '≤ 0,2m²') out.add('No aplican');
        else if (s === '> 0,2 ᴧ ≤ 0,5m²') out.add(d < 5 ? 'Exclusión de intervención' : 'No aplican');
        else out.add(gradual(20, 30));
      } else if (cuerpo) out.add(gradual(20, 30));
      else if (t === 'Humedal') out.add(d < 10 ? 'Exclusión de intervención' : 'No aplican');
      else if (t === 'Glaciar') out.add(d < 500 ? 'Exclusión de intervención' : 'No aplican');
    }
    if (out.size > 1) out.delete('No aplican');
    return [...out].join('; ');
  },
  render741() {
    const rods = App.rodales();
    const acts = rod => App.t('t731').filter(r => r.rodal === rod && r.act).map(r => r.act);
    const lista = rods.filter(r => acts(r).length).length ? rods.filter(r => acts(r).length) : rods;
    if (!lista.length) return h('p', { class: 'muted' }, 'Defina rodales en 5.1.1 y actividades en 7.3.1.');
    return h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl ro' },
      h('thead', null, h('tr', null, h('th', null, 'Rodal'), h('th', null, 'Tipo de bosque'), h('th', null, 'Zonas protección RSAH'), h('th', null, 'Actividad(es)'))),
      h('tbody', null, lista.map(rod => {
        const tb = App.tipoBosque(rod);
        return h('tr', null, h('td', null, rod), h('td', { class: tb === 'Conservación y protección' ? 'hl' : '' }, tb), h('td', null, App.zonasRSAH(rod)), h('td', null, acts(rod).join(', ') || '—'));
      }))));
  },
  renderFirmas() {
    const ints = App.t('sol_int').filter(r => r.nombre);
    const firm = (nombre, rol, rut) => h('div', { class: 'firma' }, h('div', { class: 'linea' }), h('b', null, nombre || '______________________'), h('span', null, rol), rut ? h('span', { class: 'muted' }, 'RUT ' + rutFmt(rut)) : null);
    return h('div', { class: 'firmas' },
      ints.length ? ints.map(i => firm(i.nombre, 'Interesado/a', i.rut)) : firm('', 'Interesado/a'),
      App.f('rl_nombre') ? firm(App.f('rl_nombre'), 'Representante legal', App.f('rl_rut')) : null,
      firm(App.f('au_nombre'), 'Autor/a del Plan de Manejo', App.f('au_rut')));
  },
  importarRodalesInventario() {
    const rods = [...new Set(S.inv.rows.map(r => String(r[0] || '').trim()).filter(Boolean))];
    if (!rods.length) { toast('No hay rodales en el inventario (12.2).', 'warn'); return; }
    const t = App.t('t511'); let n = 0;
    for (const rod of rods) {
      let row = t.find(r => String(r.rodal).trim() === rod);
      const c = S.rod[rod] || {};
      if (!row) { row = { _id: uid(), rodal: rod }; t.push(row); n++; }
      if (c.tf && !row.tf) row.tf = c.tf;
      if (c.stf && !row.stf) row.stf = c.stf;
      if (c.est && !row.est) row.est = c.est;
      if (c.sup && !row.sup) row.sup = c.sup;
      const res = Inv.resultado(rod);
      if (res && res.edd && !row.edd) row.edd = [res.edd];
    }
    App.changed(true); toast(`${n} rodal(es) agregados; datos completados desde el inventario.`, 'ok');
  },

  /* ---------- persistencia ---------- */
  save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); $('#saved').textContent = 'Guardado ' + new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { $('#saved').textContent = 'Sin guardado local (use Exportar proyecto)'; }
  },
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { }
    Object.assign(S, nuevoEstado(), d || {});
  },
  exportJSON() {
    const name = 'PMFBN_' + safeName(App.f('pr_nombre') || 'proyecto') + '_' + hoy() + '.json';
    download(name, JSON.stringify(S), 'application/json'); toast('Proyecto exportado.', 'ok');
  },
  async importJSON(file) {
    try {
      const d = JSON.parse(await readFile(file, 'text'));
      if (!d || !d.f || !d.t) throw new Error('Archivo no corresponde a un proyecto PMFBN');
      for (const k of Object.keys(S)) delete S[k];
      Object.assign(S, nuevoEstado(), d); Inv.invalidate(); Carto.reload && Carto.reload();
      App.save(); App.go(currentView === 'inicio' ? 'sol' : currentView); App.navRefresh();
      toast('Proyecto cargado.', 'ok');
    } catch (e) { toast('No se pudo cargar: ' + e.message, 'err'); }
  },
  async nuevo() {
    if (!await confirmar('Se borrarán todos los datos del proyecto actual de este navegador. ¿Continuar? (Exporte primero si desea conservarlo)', 'Crear nuevo')) return;
    for (const k of Object.keys(S)) delete S[k];
    Object.assign(S, nuevoEstado()); Inv.invalidate(); Carto.reload && Carto.reload(); App.save(); App.go('inicio'); App.navRefresh();
  },
  changed: null, // se define más abajo
  _saveDeb: null,

  /* ---------- navegación ---------- */
  visibleChap(c) {
    if (c.modo === 'corta' && S.modo === 'otras') return false;
    if (c.modo === 'otras' && S.modo === 'corta') return false;
    return true;
  },
  navRefresh() {
    const nav = $('#nav'); nav.innerHTML = '';
    for (const c of CHAPTERS) {
      if (!App.visibleChap(c)) continue;
      nav.appendChild(h('button', { class: 'nav-i' + (currentView === c.id ? ' on' : ''), 'data-v': c.id, onclick: () => App.go(c.id) },
        h('span', { class: 'nav-n' }, c.n), h('span', { class: 'nav-t' }, c.t)));
    }
    $('#proj-name').textContent = App.f('pr_nombre') || 'Proyecto sin nombre';
  },
  go(id) {
    if (currentView === '13' && id !== '13' && Carto.leave) Carto.leave();
    currentView = id; calcRegistry = [];
    const main = $('#main'); main.innerHTML = ''; main.scrollTop = 0;
    $$('.nav-i').forEach(b => b.classList.toggle('on', b.dataset.v === id));
    document.body.dataset.view = id;
    if (id === 'inicio') main.appendChild(App.renderInicio());
    else if (id === 'revision') main.appendChild(App.renderRevision());
    else if (id === '12') main.appendChild(Inv.render());
    else if (id === '13') main.appendChild(Carto.render());
    else main.appendChild(App.renderChapter(id));
    App.refreshCalcs();
    if (window.innerWidth < 900) document.body.classList.remove('nav-open');
  },
  rerender() { const sc = $('#main').scrollTop; App.go(currentView); $('#main').scrollTop = sc; },

  /* ---------- vistas ---------- */
  renderInicio() {
    const modos = [
      ['corta', 'Sólo corta de bosque', 'Capítulos 1–7, 9–14. Requiere inventario forestal (Cap. 12).'],
      ['otras', 'Sólo otras actividades', 'Capítulos 1–6, 8–11, 13–14. Sin inventario.'],
      ['ambas', 'Corta de bosque y otras actividades', 'Todos los capítulos.']
    ];
    const fileIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: e => e.target.files[0] && App.importJSON(e.target.files[0]) });
    return h('div', { class: 'view inicio' },
      h('section', { class: 'hero' },
        h('div', null,
          h('p', { class: 'eyebrow' }, 'Ley N° 20.283 · Corporación Nacional Forestal'),
          h('h1', null, 'Plan de Manejo Forestal de Bosque Nativo'),
          h('p', { class: 'lead' }, 'Formulario digital con todos los capítulos del PMFBN, cálculos automáticos del inventario, gráficos del análisis cuantitativo y cartografía digital georreferenciada según los requerimientos técnicos de CONAF.')),
        h('div', { class: 'hero-actions' },
          h('button', { class: 'btn primary', onclick: () => App.go('sol') }, 'Comenzar / continuar'),
          h('button', { class: 'btn', onclick: () => fileIn.click() }, 'Abrir proyecto (.json)'),
          h('button', { class: 'btn', onclick: () => App.exportJSON() }, 'Exportar proyecto'),
          h('button', { class: 'btn demo', title: 'Carga un Plan de Manejo completo con datos ficticios', onclick: () => App.cargarEjemplo() }, 'Proyecto de Ejemplo'),
          h('button', { class: 'btn ghost', onclick: () => App.nuevo() }, 'Nuevo proyecto'), fileIn)),
      h('section', { class: 'card' },
        h('h2', null, 'Tipo de actividades del Plan'),
        h('p', { class: 'muted' }, 'Según el Cuadro N° 1 de las Consideraciones para la formulación del PMFBN, determina qué capítulos se completan.'),
        h('div', { class: 'modos' }, modos.map(([v, t, d]) => h('label', { class: 'modo' + (S.modo === v ? ' on' : '') },
          h('input', { type: 'radio', name: 'modo', value: v, checked: S.modo === v, onchange: () => { S.modo = v; App.changed(); App.navRefresh(); App.rerender(); } }),
          h('b', null, t), h('span', null, d))))),
      h('section', { class: 'card' },
        h('h2', null, 'Cómo trabajar'),
        h('ol', { class: 'pasos' },
          h('li', null, h('b', null, 'Solicitud y Capítulos 1–3: '), 'datos del interesado, predio, autor y concurso. Se replican automáticamente en el resto del Plan.'),
          h('li', null, h('b', null, 'Capítulo 12 (inventario): '), 'ingrese o importe desde Excel el registro de parcelas (12.2); configure cada rodal en 12.3. Las tablas de rodal, estadígrafos, gráficos y los cuadros 7.2, 7.4.2, 12.1.x se calculan solos.'),
          h('li', null, h('b', null, 'Capítulos 4–11: '), 'cuadros con las mismas listas desplegables y validaciones del formulario oficial.'),
          h('li', null, h('b', null, 'Capítulo 13 (cartografía): '), 'dibuje sobre mapas abiertos o suba shapefiles; valide atributos y exporte las capas SHP (WGS 84 / UTM) y el plano en PDF.'),
          h('li', null, h('b', null, 'Revisión: '), 'lista de pendientes y errores, impresión del Plan y de la Solicitud.')),
        h('p', { class: 'muted small' }, 'Los datos se guardan automáticamente en este navegador. Exporte el proyecto (.json) para respaldarlo o trabajar en otro equipo.')));
  },

  renderChapter(chap) {
    const wrap = h('div', { class: 'view' });
    const c = CHAPTERS.find(x => x.id === chap);
    wrap.appendChild(h('header', { class: 'view-h' }, h('p', { class: 'eyebrow' }, chap === 'sol' ? 'Solicitud relativa a la Ley N° 20.283' : 'Capítulo ' + chap), h('h1', null, c ? c.t : '')));
    for (const sec of SCHEMA.filter(s => s.chap === chap)) wrap.appendChild(App.renderSection(sec));
    return wrap;
  },
  renderSection(sec) {
    const card = h('section', { class: 'card', id: 'sec-' + sec.id });
    const head = h('div', { class: 'card-h' }, h('h2', null, sec.title));
    if (sec.opt) {
      const on = !!S.opt[sec.id];
      head.appendChild(h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: on, onchange: e => { S.opt[sec.id] = e.target.checked; App.changed(); App.rerender(); } }), h('span', null, on ? 'Incluida' : 'No aplica')));
    }
    card.appendChild(head);
    if (sec.help) card.appendChild(h('p', { class: 'help' }, sec.help));
    if (sec.opt && !S.opt[sec.id]) { card.classList.add('off'); return card; }
    for (const it of sec.items || []) card.appendChild(App.renderItem(it));
    for (const tx of sec.extraText || []) card.appendChild(App.renderItem(Object.assign({ type: 'text' }, tx)));
    return card;
  },
  renderItem(it) {
    switch (it.type) {
      case 'fields': return h('div', { class: 'grid' }, it.fields.map(f => App.renderField(f)));
      case 'table': return App.renderTable(it);
      case 'text': {
        const ta = h('textarea', { rows: 4, placeholder: it.ph || '', value: App.f(it.k), oninput: e => { S.f[it.k] = e.target.value; App.changed(); autoGrow(e.target); } });
        setTimeout(() => autoGrow(ta), 0);
        return h('label', { class: 'fld full' }, h('span', { class: 'lbl' }, it.l), ta);
      }
      case 'note': return h('p', { class: 'note ' + (it.cls || '') }, it.text);
      case 'actions': return h('div', { class: 'actions' }, it.actions.map(a => h('button', { class: 'btn sm', onclick: a.fn }, a.label)));
      case 'custom': { const box = h('div', { class: 'custom' }); box.appendChild(it.render()); calcRegistry.push({ el: box, fn: () => { box.innerHTML = ''; box.appendChild(it.render()); }, heavy: true }); return box; }
    }
    return h('div');
  },
  renderField(f) {
    const lab = h('label', { class: 'fld' + (f.w === 2 ? ' w2' : '') }, h('span', { class: 'lbl' }, f.l, f.req ? h('i', { class: 'req', title: 'Obligatorio' }, '*') : null));
    let inp;
    const set = v => { S.f[f.k] = v; App.changed(); };
    if (f.t === 'fixed') inp = h('div', { class: 'ro-val' }, f.v);
    else if (f.t === 'calc') {
      inp = h('div', { class: 'ro-val calc' });
      const fn = () => { const v = f.calc(); inp.textContent = typeof v === 'number' ? fmt(v, f.dec != null ? f.dec : 2) : (v || '—'); };
      calcRegistry.push({ el: inp, fn });
    } else if (f.t === 'sel') {
      inp = h('select', { onchange: e => set(e.target.value) }, f.o.map(o => h('option', { value: o, selected: App.f(f.k) === o }, o || '— seleccione —')));
    } else if (f.t === 'rut') {
      const dv = h('span', { class: 'dv' }, App.f(f.k) ? '-' + rutDV(App.f(f.k)) : '');
      const i = h('input', { type: 'text', inputmode: 'numeric', value: App.f(f.k), placeholder: '12345678', oninput: e => { const v = e.target.value.replace(/[^\d]/g, ''); e.target.value = v; dv.textContent = v ? '-' + rutDV(v) : ''; set(v); } });
      inp = h('div', { class: 'rut' }, i, dv);
    } else {
      const type = { date: 'date', email: 'email', num: 'text', int: 'text' }[f.t] || 'text';
      inp = h('input', { type, value: App.f(f.k), inputmode: (f.t === 'num' || f.t === 'int') ? 'decimal' : null,
        oninput: e => { let v = e.target.value; if (f.upper) { v = v.toUpperCase(); e.target.value = v; } set(v); validField(e.target, f, v); } });
      setTimeout(() => validField(inp, f, App.f(f.k)), 0);
    }
    lab.appendChild(inp);
    if (f.note) lab.appendChild(h('span', { class: 'hint' }, f.note));
    return lab;
  },

  /* ---------- tablas dinámicas ---------- */
  renderTable(it) {
    const rows = App.t(it.id);
    if (it.fixedRows) {
      for (const label of it.fixedRows) if (!rows.find(r => r.ref === label)) rows.push({ _id: uid(), ref: label });
    }
    if (it.minRows && rows.length < it.minRows) for (let i = rows.length; i < it.minRows; i++) rows.push({ _id: uid() });
    rows.forEach(r => { if (!r._id) r._id = uid(); });
    const box = h('div', { class: 'tbl-block' });
    if (it.title) box.appendChild(h('h3', null, it.title));
    const tbody = h('tbody');
    const table = h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, it.cols.map(c => h('th', { style: { minWidth: (c.w || 100) + 'px' } }, c.l)), it.fixedRows ? null : h('th', { class: 'act' }, ''))),
      tbody);
    const drawRows = () => {
      tbody.innerHTML = '';
      rows.forEach((r, ri) => {
        const tr = h('tr');
        for (const c of it.cols) tr.appendChild(App.renderCell(it, c, r, tr));
        if (!it.fixedRows) tr.appendChild(h('td', { class: 'act' },
          h('button', { class: 'icon-btn', title: 'Duplicar fila', 'aria-label': 'Duplicar fila', onclick: () => { const cp = clone(r); cp._id = uid(); if (it.key) cp[it.key] = ''; rows.splice(ri + 1, 0, cp); App.changed(true); App.rerender(); } }, '⧉'),
          h('button', { class: 'icon-btn del', title: 'Eliminar fila', 'aria-label': 'Eliminar fila', onclick: () => { rows.splice(ri, 1); App.changed(true); App.rerender(); } }, '×')));
        tbody.appendChild(tr);
      });
      if (!rows.length) tbody.appendChild(h('tr', null, h('td', { colspan: it.cols.length + 1, class: 'empty' }, 'Sin filas. Use “Agregar fila”.')));
    };
    drawRows();
    if (it.footer) {
      const tf = h('tfoot');
      for (const fo of it.footer) {
        const tr = h('tr');
        it.cols.forEach((c, i) => {
          if (i === 0) tr.appendChild(h('td', { class: 'ft-l' }, fo.label));
          else if (c.k === fo.col) { const td = h('td', { class: 'ft-v' }); calcRegistry.push({ el: td, fn: () => td.textContent = fo.fn(rows) }); tr.appendChild(td); }
          else tr.appendChild(h('td'));
        });
        if (!it.fixedRows) tr.appendChild(h('td'));
        tf.appendChild(tr);
      }
      table.appendChild(tf);
    }
    box.appendChild(h('div', { class: 'tbl-wrap' }, table));
    if (!it.fixedRows) box.appendChild(h('div', { class: 'tbl-tools' },
      h('button', { class: 'btn sm', onclick: () => { rows.push({ _id: uid() }); App.changed(true); App.rerender(); } }, '+ Agregar fila'),
      it.cols[0].t === 'rod' ? h('button', { class: 'btn sm ghost', onclick: () => { let n = 0; for (const rod of App.rodales()) if (!rows.find(r => r.rodal === rod)) { rows.push({ _id: uid(), rodal: rod }); n++; } if (n) { App.changed(true); App.rerender(); } else toast('Todos los rodales ya tienen fila.'); } }, 'Una fila por rodal') : null));
    return box;
  },
  renderCell(it, c, r, tr) {
    const td = h('td', { class: 'c-' + c.t });
    tr._dyn = tr._dyn || [];
    const listKey = (it.id === 't511' && c.k === 'rodal') || (it.id === 'c3_proy' && c.k === 'id');
    const set = v => {
      r[c.k] = v; App.changed(listKey); validCell(td, c, r, it);
      tr._dyn.forEach(f => f());
      if (listKey) App.refreshListSelects();
    };
    let el;
    switch (c.t) {
      case 'label': el = h('span', { class: 'lbl-cell' }, r[c.k]); break;
      case 'fixed': el = h('span', { class: 'lbl-cell' }, c.v); break;
      case 'auto': {
        el = h('span', { class: 'auto' });
        calcRegistry.push({ el, fn: () => { el.textContent = c.calc(r) || ''; if (c.flag) { const m = c.flag(r); td.classList.toggle('flag', !!m); td.title = m || ''; } } });
        break;
      }
      case 'comuna': {
        el = h('select', { onchange: e => set(e.target.value) }, h('option', { value: '' }, ''));
        const byReg = {};
        for (const [com, prov, reg] of CAT.COMUNAS) (byReg[reg] = byReg[reg] || []).push(com);
        for (const reg of Object.keys(byReg).sort((a, b) => a.localeCompare(b, 'es'))) el.appendChild(h('optgroup', { label: reg }, byReg[reg].sort((a, b) => a.localeCompare(b, 'es')).map(x => h('option', { value: x, selected: r[c.k] === x }, x))));
        break;
      }
      case 'sel': case 'rod': case 'proj': {
        el = h('select', { onchange: e => set(e.target.value) });
        el._fill = () => {
          let list = c.t === 'rod' ? App.rodales() : c.t === 'proj' ? App.proyectos() : (typeof c.o === 'function' ? c.o(r) : c.o);
          const cur = r[c.k] || '';
          if (cur && !list.includes(cur)) list = list.concat([cur]);
          el.innerHTML = ''; el.appendChild(h('option', { value: '' }, ''));
          list.forEach(o => el.appendChild(h('option', { value: o, selected: cur === o }, o)));
        };
        el._fill();
        if (c.t === 'rod' || c.t === 'proj') el.dataset.list = c.t;
        if (typeof c.o === 'function') tr._dyn.push(el._fill);
        break;
      }
      case 'multi': case 'rods': {
        el = multiSelect(c.t === 'rods' ? () => App.rodales() : (typeof c.o === 'function' ? () => c.o(r) : c.o), Array.isArray(r[c.k]) ? r[c.k] : (r[c.k] ? [r[c.k]] : []), v => set(v));
        break;
      }
      case 'sp': case 'flora': case 'fauna': case 'serie': {
        const dl = { sp: 'dl-especies', flora: 'dl-flora', fauna: 'dl-fauna', serie: 'dl-series' }[c.t];
        el = h('input', { type: 'text', list: dl, value: r[c.k] || '', placeholder: c.t === 'serie' ? 'Sin clasificar' : 'Nombre científico', oninput: e => set(e.target.value) });
        break;
      }
      case 'date': el = h('input', { type: 'date', value: r[c.k] || '', onchange: e => set(e.target.value) }); break;
      case 'rut': {
        const dv = h('span', { class: 'dv' }, r[c.k] ? '-' + rutDV(r[c.k]) : '');
        el = h('div', { class: 'rut' }, h('input', { type: 'text', inputmode: 'numeric', value: r[c.k] || '', oninput: e => { const v = e.target.value.replace(/[^\d]/g, ''); e.target.value = v; dv.textContent = v ? '-' + rutDV(v) : ''; set(v); } }), dv);
        break;
      }
      default: {
        const numeric = ['num', 'int', 'year', 'dec3'].includes(c.t);
        el = h('input', { type: c.t === 'email' ? 'email' : 'text', value: r[c.k] == null ? '' : r[c.k], placeholder: c.ph || '', inputmode: numeric ? 'decimal' : null,
          disabled: c.dis && c.dis(r), oninput: e => set(e.target.value) });
        if (c.dis) tr._dyn.push(() => { el.disabled = c.dis(r); });
      }
    }
    td.appendChild(el);
    setTimeout(() => validCell(td, c, r, it), 0);
    return td;
  },
  refreshListSelects() { $$('select[data-list]').forEach(s => s._fill && s._fill()); },

  /* ---------- recálculo ---------- */
  refreshCalcs(light) {
    for (const x of calcRegistry) { if (light && x.heavy) continue; try { x.fn(); } catch (e) { console.warn(e); } }
  },

  /* ---------- revisión ---------- */
  revisar() {
    const out = [];
    const add = (chap, sec, msg, lvl = 'err') => out.push({ chap, sec, msg, lvl });
    for (const sec of SCHEMA) {
      const chap = CHAPTERS.find(c => c.id === sec.chap);
      if (chap && !App.visibleChap(chap)) continue;
      if (sec.opt && !S.opt[sec.id]) continue;
      for (const it of sec.items || []) {
        if (it.type === 'fields') for (const f of it.fields) {
          if (f.req && !String(App.f(f.k)).trim()) add(sec.chap, sec.title, `Falta: ${f.l}`);
          const m = fieldMsg(f, App.f(f.k)); if (m) add(sec.chap, sec.title, `${f.l}: ${m}`);
        }
        if (it.type === 'table') {
          const rows = App.t(it.id);
          rows.forEach((r, i) => {
            const vacía = it.cols.every(c => r[c.k] == null || r[c.k] === '' || (Array.isArray(r[c.k]) && !r[c.k].length) || c.t === 'label' || c.t === 'auto' || c.t === 'fixed');
            if (vacía && !it.fixedRows) { add(sec.chap, sec.title, `Fila ${i + 1} vacía`, 'warn'); return; }
            for (const c of it.cols) {
              const m = cellMsg(c, r, it); if (m) add(sec.chap, sec.title, `Fila ${i + 1}, ${c.l}: ${m}`, m.startsWith('Advertencia') ? 'warn' : 'err');
              if (c.flag) { const fm = c.flag(r); if (fm) add(sec.chap, sec.title, `Fila ${i + 1}: ${fm}`, 'warn'); }
            }
          });
        }
      }
    }
    // coherencias
    const rods = App.rodales();
    if (!rods.length) add('5', '5.1.1', 'No se han definido rodales.');
    if (S.modo !== 'otras') {
      const inv = new Set(S.inv.rows.map(r => String(r[0] || '').trim()).filter(Boolean));
      if (!inv.size) add('12', '12.2', 'No hay datos de inventario (registro de parcelas).');
      for (const r of inv) {
        if (!rods.includes(r)) add('12', '12.2', `El rodal ${r} del inventario no está definido en 5.1.1`, 'warn');
        const res = Inv.resultado(r); if (!res) add('12', '12.3', `Rodal ${r}: complete la configuración de 12.3 (muestreo y tamaño de parcela).`);
        else if (res.edd === '' && res.necesitaEdd) add('12', '12.3', `Rodal ${r}: seleccione el estado de desarrollo (DMC menor al límite de latizal).`);
        if (res && !res.marcado && res.residualPendiente) add('12', '12.3.9', `Rodal ${r}: complete la tabla de rodal residual (sin marcación en parcelas).`, 'warn');
      }
      for (const sp of new Set(S.inv.rows.map(r => r[2]).filter(Boolean))) if (!(S.vol[sp] && S.vol[sp].expr)) add('12', '12.1.3', `Sin función de volumen para ${sp}`, 'warn');
    }
    for (const r of App.t('t532')) if (isNum(r.prof) && num(r.prof) < 10) add('5', '5.3.2', `Rodal ${r.rodal}: profundidad < 10 cm, se prohíbe la corta (Art. 9° D.S. 82/2010).`);
    const st = num(App.f('pr_suptotal')), sa = App.supAfecta();
    if (isFinite(st) && sa > st) add('sol', '5. Predio', 'La superficie afecta supera la superficie total del predio.');
    for (const c of (Carto.validar ? Carto.validar() : [])) add('13', 'Cartografía', c.msg, c.lvl);
    return out;
  },
  renderRevision() {
    const items = App.revisar();
    const errs = items.filter(x => x.lvl === 'err'), warns = items.filter(x => x.lvl !== 'err');
    const nameFor = id => (CHAPTERS.find(c => c.id === id) || {}).t || id;
    const list = arr => h('ul', { class: 'rev' }, arr.map(x => h('li', { class: x.lvl }, h('button', { class: 'linkish', onclick: () => App.go(x.chap) }, (x.chap === 'sol' ? 'Solicitud' : 'Cap. ' + x.chap) + ' · ' + x.sec), ' — ', x.msg)));
    return h('div', { class: 'view' },
      h('header', { class: 'view-h' }, h('p', { class: 'eyebrow' }, 'Revisión y exportación'), h('h1', null, 'Estado del Plan de Manejo')),
      h('section', { class: 'card' },
        h('div', { class: 'kpis' },
          h('div', { class: 'kpi ' + (errs.length ? 'bad' : 'good') }, h('b', null, errs.length), h('span', null, 'errores')),
          h('div', { class: 'kpi ' + (warns.length ? 'mid' : 'good') }, h('b', null, warns.length), h('span', null, 'advertencias')),
          h('div', { class: 'kpi' }, h('b', null, App.rodales().length), h('span', null, 'rodales')),
          h('div', { class: 'kpi' }, h('b', null, fmt(App.supAfecta(), 2)), h('span', null, 'ha solicitadas'))),
        h('div', { class: 'actions' },
          h('button', { class: 'btn primary', onclick: () => Print.plan() }, 'Imprimir / PDF del Plan de Manejo'),
          h('button', { class: 'btn', onclick: () => Print.solicitud() }, 'Imprimir / PDF de la Solicitud'),
          h('button', { class: 'btn', onclick: () => Inv.exportXlsx() }, 'Excel de parcelas (12.2)'),
          h('button', { class: 'btn', onclick: () => App.exportJSON() }, 'Exportar proyecto (.json)'),
          h('button', { class: 'btn', onclick: () => App.go('13') }, 'Cartografía y plano')),
        h('p', { class: 'muted small' }, 'Entregables a CONAF: Solicitud firmada; Plan de Manejo impreso y firmado (excepto 12.3); PDF de la sección 12.3 por rodal; Excel de parcelas; planos en papel; cartografía digital georreferenciada; documentación legal y autorización de ingreso al predio.')),
      errs.length ? h('section', { class: 'card' }, h('h2', null, 'Errores'), list(errs)) : null,
      warns.length ? h('section', { class: 'card' }, h('h2', null, 'Advertencias'), list(warns)) : null,
      !items.length ? h('section', { class: 'card' }, h('p', null, 'No se detectaron errores ni advertencias.')) : null);
  }
};

App.changed = function (structural) {
  Inv.invalidate();
  clearTimeout(App._saveDeb); App._saveDeb = setTimeout(App.save, 600);
  clearTimeout(App._calcDeb); App._calcDeb = setTimeout(() => App.refreshCalcs(!structural), 120);
  if (structural) $('#proj-name').textContent = App.f('pr_nombre') || 'Proyecto sin nombre';
  $('#saved').textContent = 'Guardando…';
};

/* ---------- validación ---------- */
function fieldMsg(f, v) {
  if (v == null || v === '') return '';
  if (f.t === 'num' && !isNum(v)) return 'debe ser numérico';
  if (f.t === 'num' && isNum(v) && Math.abs(num(v) * 100 - Math.round(num(v) * 100)) > 1e-6) return 'máximo 2 decimales';
  if (f.t === 'int' && !(Number.isInteger(num(v)))) return 'debe ser número entero';
  if ((f.t === 'int' || f.t === 'num') && f.min != null && num(v) < f.min) return `mínimo ${f.min}`;
  if ((f.t === 'int' || f.t === 'num') && f.max != null && num(v) > f.max) return `máximo ${f.max}`;
  if (f.t === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return 'correo no válido';
  return '';
}
function validField(el, f, v) { const m = fieldMsg(f, v); el.classList.toggle('err', !!m); el.title = m; }
function cellMsg(c, r, it) {
  const v = r[c.k];
  if (c.req && (v == null || v === '' || (Array.isArray(v) && !v.length))) return 'obligatorio';
  if (v == null || v === '') return '';
  if (c.t === 'num' || c.t === 'dec3') {
    if (!isNum(v)) return 'debe ser numérico';
    const d = c.t === 'dec3' ? 3 : 2, n = num(v);
    if (Math.abs(n * Math.pow(10, d) - Math.round(n * Math.pow(10, d))) > 1e-6) return `máximo ${d} decimales`;
    if (n < 0) return 'no puede ser negativo';
    if (c.max != null && n > c.max) return `máximo ${c.max}`;
  }
  if (c.t === 'int' || c.t === 'year') {
    if (!Number.isInteger(num(v))) return 'debe ser número entero';
    if (c.t === 'year' && String(Math.trunc(num(v))).length !== 4) return 'año de 4 dígitos';
    if (c.min != null && num(v) < c.min) return c.minMsg || `mínimo ${c.min}`;
    if (c.max != null && num(v) > c.max) return `máximo ${c.max}`;
  }
  if (c.rule) {
    const R = c.rule;
    if (R.fn) { const m = R.fn(r); if (m) return m; }
    else if (R.fin) { const a = num(r[R.fin]), b = num(v); if (isFinite(a) && isFinite(b) && (b < a || b > a + R.plus)) return R.msg; }
    else if (R.min) { const n = num(v); if (n < R.min() || n > R.max()) return R.msg; }
  }
  if (c.unique && it) { const rows = App.t(it.id).filter(x => String(x[c.k]).trim() === String(v).trim()); if (rows.length > 1) return 'valor repetido'; }
  if (c.t === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return 'correo no válido';
  if (c.t === 'flora' && !CAT.FLORA.find(x => x[0] === v)) return 'Advertencia: especie no figura en el listado de clasificación';
  if (c.t === 'fauna' && !CAT.FAUNA.find(x => x[0] === v)) return 'Advertencia: especie no figura en el listado de clasificación';
  if (c.warn) { const w = c.warn(r); if (w) return 'Advertencia: ' + w; }
  return '';
}
function validCell(td, c, r, it) {
  const m = cellMsg(c, r, it);
  td.classList.toggle('err', !!m && !m.startsWith('Advertencia'));
  td.classList.toggle('warn', !!m && m.startsWith('Advertencia'));
  if (!c.flag) td.title = m || '';
}
function autoGrow(ta) { ta.style.height = 'auto'; ta.style.height = Math.max(90, ta.scrollHeight + 2) + 'px'; }

/* ---------- selector múltiple ---------- */
function multiSelect(optSrc, value, onChange) {
  let sel = value.slice();
  let options = typeof optSrc === 'function' ? optSrc() : optSrc;
  const btn = h('button', { type: 'button', class: 'multi' });
  const paint = () => { btn.textContent = sel.length ? sel.join(', ') : '— seleccione —'; btn.classList.toggle('empty', !sel.length); };
  paint();
  btn.addEventListener('click', e => {
    e.preventDefault();
    $$('.pop').forEach(p => p.remove());
    if (typeof optSrc === 'function') options = optSrc();
    const pop = h('div', { class: 'pop' },
      options.length > 8 ? h('input', { type: 'search', placeholder: 'Filtrar…', oninput: ev => { const q = ev.target.value.toLowerCase(); $$('label', pop).forEach(l => l.style.display = l.textContent.toLowerCase().includes(q) ? '' : 'none'); } }) : null,
      h('div', { class: 'pop-list' }, options.map(o => h('label', null, h('input', { type: 'checkbox', checked: sel.includes(o), onchange: ev => { if (ev.target.checked) sel.push(o); else sel = sel.filter(x => x !== o); sel.sort((a, b) => options.indexOf(a) - options.indexOf(b)); paint(); onChange(sel.slice()); } }), ' ', o))),
      h('div', { class: 'pop-f' }, h('button', { class: 'btn sm', type: 'button', onclick: () => pop.remove() }, 'Listo')));
    document.body.appendChild(pop);
    const rc = btn.getBoundingClientRect();
    pop.style.left = Math.min(rc.left, window.innerWidth - 330) + 'px';
    pop.style.top = (rc.bottom + 4 + 320 > window.innerHeight ? Math.max(8, rc.top - 324) : rc.bottom + 4) + 'px';
    setTimeout(() => document.addEventListener('mousedown', function off(ev) { if (!pop.contains(ev.target) && ev.target !== btn) { pop.remove(); document.removeEventListener('mousedown', off); } }), 0);
  });
  return btn;
}

/* ---------- impresión ---------- */
const Print = {
  open(title, content) {
    const area = $('#print-area'); area.innerHTML = '';
    area.appendChild(h('div', { class: 'pdoc' }, h('p', { class: 'paviso' }, AVISO_MAQUETA), content));
    document.title = title;
    document.body.classList.add('printing');
    setTimeout(() => { window.print(); }, 250);
  },
  val(v) { return Array.isArray(v) ? v.join(', ') : (v == null ? '' : String(v)); },
  section(sec) {
    const out = [h('h3', null, sec.title)];
    if (sec.opt && !S.opt[sec.id]) { out.push(h('p', { class: 'na' }, 'No aplica.')); return out; }
    for (const it of sec.items || []) out.push(Print.item(it));
    for (const tx of sec.extraText || []) out.push(Print.item(Object.assign({ type: 'text' }, tx)));
    return out;
  },
  item(it) {
    if (it.type === 'fields') return h('table', { class: 'pfields' }, h('tbody', null, it.fields.map(f => {
      let v = f.t === 'fixed' ? f.v : f.t === 'calc' ? f.calc() : App.f(f.k);
      if (f.t === 'rut' && v) v = rutFmt(v);
      if (typeof v === 'number') v = fmt(v, 2);
      if (f.t === 'date' && v) v = fechaLarga(v);
      return h('tr', null, h('th', null, f.l), h('td', null, Print.val(v)));
    })));
    if (it.type === 'table') {
      const rows = App.t(it.id).filter(r => it.cols.some(c => c.t !== 'label' && r[c.k] != null && r[c.k] !== ''));
      return h('div', null, it.title ? h('h4', null, it.title) : null, h('table', { class: 'ptbl' },
        h('thead', null, h('tr', null, it.cols.map(c => h('th', null, c.l)))),
        h('tbody', null, rows.length ? rows.map(r => h('tr', null, it.cols.map(c => {
          let v = c.t === 'auto' ? c.calc(r) : c.t === 'fixed' ? c.v : r[c.k];
          if (c.t === 'rut' && v) v = rutFmt(v);
          if (c.t === 'num' && isNum(v)) v = fmt(v, 2);
          return h('td', null, Print.val(v));
        }))) : h('tr', null, h('td', { colspan: it.cols.length, class: 'na' }, 'Sin información.')))));
    }
    if (it.type === 'text') return h('div', { class: 'ptext' }, h('b', null, it.l), h('p', null, App.f(it.k) || '—'));
    if (it.type === 'note') return h('p', { class: 'pnote' }, it.text);
    if (it.type === 'custom') return it.render();
    return h('span');
  },
  header(title) {
    return h('div', { class: 'phead' }, h('div', null, h('b', null, 'CORPORACIÓN NACIONAL FORESTAL'), h('span', null, title)), h('div', { class: 'pconaf' }, h('span', null, 'N° (Uso CONAF)'), h('span', null, 'Fecha')));
  },
  plan() {
    const parts = [Print.header('PLAN DE MANEJO FORESTAL DE BOSQUE NATIVO · LEY N° 20.283')];
    for (const c of CHAPTERS) {
      if (['inicio', 'sol', 'revision'].includes(c.id) || !App.visibleChap(c)) continue;
      if (c.id === '3' && !S.opt.c3) { parts.push(h('h2', null, '3 ' + c.t), h('p', { class: 'na' }, 'No aplica.')); continue; }
      if (c.id === '12') { parts.push(h('h2', { class: 'pb' }, '12 Información cuantitativa del recurso a intervenir'), Inv.printResumen()); continue; }
      if (c.id === '13') { parts.push(h('h2', null, '13 Cartografía'), Carto.printLista()); continue; }
      parts.push(h('h2', { class: ['5', '7', '12', '14'].includes(c.id) ? 'pb' : '' }, c.n + ' ' + c.t.toUpperCase()));
      for (const sec of SCHEMA.filter(s => s.chap === c.id)) parts.push(...Print.section(sec));
    }
    Print.open('Plan de Manejo - ' + (App.f('pr_nombre') || ''), parts);
  },
  solicitud() {
    const parts = [Print.header('SOLICITUD RELATIVA A LA LEY N° 20.283')];
    for (const sec of SCHEMA.filter(s => s.chap === 'sol')) parts.push(...Print.section(sec));
    parts.push(h('div', { class: 'firmas' }, App.t('sol_int').filter(r => r.nombre).map(i => h('div', { class: 'firma' }, h('div', { class: 'linea' }), h('b', null, i.nombre), h('span', null, 'Firma interesado/a')))));
    Print.open('Solicitud Ley 20.283', parts);
  },
  custom(title, node) { Print.open(title, [Print.header(title), node]); }
};
window.addEventListener('afterprint', () => { document.body.classList.remove('printing'); document.title = 'PMFBN · Plan de Manejo Forestal de Bosque Nativo'; });

/* ---------- arranque ---------- */
function initApp() {
  App.load();
  const dls = h('div', { hidden: true },
    h('datalist', { id: 'dl-especies' }, App.especiesLista().map(s => h('option', { value: s }))),
    h('datalist', { id: 'dl-flora' }, CAT.FLORA.map(s => h('option', { value: s[0] }))),
    h('datalist', { id: 'dl-fauna' }, CAT.FAUNA.map(s => h('option', { value: s[0] }))),
    h('datalist', { id: 'dl-series' }, ['Sin clasificar'].concat(L.Series_suelos).map(s => h('option', { value: s }))));
  document.body.appendChild(dls);
  $('#menu-btn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  $('#btn-export').addEventListener('click', () => App.exportJSON());
  $('#btn-rev').addEventListener('click', () => App.go('revision'));
  App.navRefresh();
  const hash = location.hash.replace('#', '');
  App.go(CHAPTERS.find(c => c.id === hash) ? hash : 'inicio');
  window.addEventListener('beforeunload', () => App.save());
}
document.addEventListener('DOMContentLoaded', initApp);
