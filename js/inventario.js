/* ==========================================================================
   Capítulo 12: Inventario forestal, registro de parcelas y análisis
   cuantitativo por rodal. Replica la lógica de las macros del formulario
   (tabla de rodal convencional y Bitterlich, estadígrafos, estados de
   desarrollo, cepas, volúmenes).
   ========================================================================== */
'use strict';

const Inv = (() => {
  let cache = {}, ver = 0;
  const ESTADOS = ['Repoblado', 'Monte bravo bajo', 'Monte bravo alto', 'Latizal bajo', 'Latizal alto', 'Fustal joven', 'Fustal', 'Sobremaduro'];
  const LIM = { E: [8, 15, 25, 35, 50], O: [10, 20, 30, 50, 70] };
  const NCLASES = 29;
  let tab = '122', rodSel = null, page = 0;
  const PAGE = 150;

  const cfg = rod => S.rod[rod] || (S.rod[rod] = {});
  const simp = () => S.inv.tipo === 'Simpódico';
  const rodalesInv = () => [...new Set(S.inv.rows.map(r => String(r[0] == null ? '' : r[0]).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  const invalidate = () => { cache = {}; ver++; };

  function estadoPorDmc(dmc, lim) {
    if (!isFinite(dmc)) return '';
    if (dmc < lim[0]) return null; // requiere selección manual
    if (dmc <= lim[1]) return 'Latizal bajo';
    if (dmc <= lim[2]) return 'Latizal alto';
    if (dmc <= lim[3]) return 'Fustal joven';
    if (dmc <= lim[4]) return 'Fustal';
    return 'Sobremaduro';
  }
  function volFn(sp) {
    const v = S.vol[sp]; if (!v || !v.expr) return null;
    try { const f = Expr.compile(v.expr); const hh = num(v.h); return d => { const r = f(d, isFinite(hh) ? hh : 0); return isFinite(r) && r > 0 ? r : 0; }; } catch (e) { return null; }
  }

  /* ------------------------- cálculo por rodal ------------------------- */
  function calcular(rod) {
    const c = cfg(rod), info = App.rodalInfo(rod);
    const tf = c.tf || info.tf || '';
    const esc = tf === 'Esclerófilo';
    const bit = c.muestreo === 'Bitterlich' && !esc;
    const tam = num(c.tam);
    const trees = [];
    for (const r of S.inv.rows) {
      if (String(r[0] == null ? '' : r[0]).trim() !== rod) continue;
      const p = num(r[1]), d = num(r[3]);
      if (!isFinite(p) || !isFinite(d)) continue;
      trees.push({ parc: Math.trunc(p), cepa: String(p), sp: String(r[2] || '').trim(), d, int: String(r[4] || '').trim().toUpperCase() });
    }
    if (!trees.length) return null;
    const parcelas = [...new Set(trees.map(t => t.parc))].sort((a, b) => a - b);
    const n = parcelas.length;
    if (!(tam > 0)) return { incompleto: true, n, parcelas, trees, tf, bit, esc };
    const dmin = esc ? 0 : (c.dmin === 0 || c.dmin === '0' ? 0 : 5);
    const f = bit ? 1 : 10000 / tam, FAB = bit ? tam : 0;
    const cls = []; for (let i = 0; i < NCLASES; i++) { const lo = dmin + 5 * i, mc = lo + 2.5; cls.push({ lo, hi: lo + 5, mc, g: Math.PI * mc * mc / 40000 }); }
    const dmax = cls[NCLASES - 1].hi;
    const ci = d => d >= dmin && d < dmax ? Math.floor((d - dmin) / 5) : -1;
    const especies = [...new Set(trees.map(t => t.sp))].sort((a, b) => a.localeCompare(b, 'es'));
    const spSel = [c.sp1, c.sp2, c.sp3].filter((x, i, a) => x && especies.includes(x) && a.indexOf(x) === i);
    const grp = sp => { const i = spSel.indexOf(sp); return i >= 0 ? i : 3; };
    const marcado = trees.some(t => t.int !== '');
    const vf = {}; especies.forEach(sp => vf[sp] = volFn(sp));
    const sinVol = especies.filter(sp => !vf[sp]);
    // tabla de rodal [clase][grupo 0..4] {ni,nr,gi,gr,vi,vr}
    const T = cls.map(() => [0, 1, 2, 3, 4].map(() => ({ ni: 0, nr: 0, gi: 0, gr: 0, vi: 0, vr: 0 })));
    for (const t of trees) {
      const k = ci(t.d); if (k < 0) continue;
      const g = grp(t.sp), ext = t.int === 'X';
      const w = bit ? FAB / cls[k].g / n : f / n; // árboles/ha que representa el individuo
      const v = vf[t.sp] ? vf[t.sp](t.d) : 0;
      for (const gg of [g, 4]) { const x = T[k][gg]; x.ni += w; x.vi += v * w; if (!ext) { x.nr += w; x.vr += v * w; } }
    }
    let residualPendiente = false;
    for (let k = 0; k < NCLASES; k++) {
      if (!marcado) {
        const man = (c.resid || {})[k] || {};
        T[k][4].nr = 0; T[k][4].vr = 0;
        for (let g = 0; g < 4; g++) {
          const x = T[k][g], mv = man['g' + g];
          if (mv === '' || mv == null || !isNum(mv)) { x.nr = x.ni; if (x.ni > 0) residualPendiente = true; }
          else x.nr = Math.max(0, num(mv));
          x.vr = x.ni > 0 ? x.vi * (x.nr / x.ni) : 0;
          T[k][4].nr += x.nr; T[k][4].vr += x.vr;
        }
      }
      for (let g = 0; g < 5; g++) { const x = T[k][g]; x.gi = x.ni * cls[k].g; x.gr = x.nr * cls[k].g; }
    }
    const sum = (g, key) => T.reduce((s, row) => s + row[g][key], 0);
    const dmcOf = (G, N) => N > 0 && G > 0 ? Math.sqrt(G * 40000 / (N * Math.PI)) : NaN;
    const resumen = [0, 1, 2, 3, 4].map(g => {
      const o = { nIni: sum(g, 'ni'), nFin: sum(g, 'nr'), gIni: sum(g, 'gi'), gFin: sum(g, 'gr'), vIni: sum(g, 'vi'), vFin: sum(g, 'vr') };
      o.dmcIni = dmcOf(o.gIni, o.nIni); o.dmcFin = dmcOf(o.gFin, o.nFin); return o;
    });
    const tot = resumen[4];
    resumen.forEach(o => { o.pIni = tot.nIni ? o.nIni / tot.nIni : NaN; o.pFin = tot.nFin ? o.nFin / tot.nFin : NaN; });
    // por parcela
    const P = parcelas.map(p => {
      const ts = trees.filter(t => t.parc === p);
      const o = { parc: p, AU: 0, AV: 0, AW: 0, AY: 0, AZ: 0, BA: 0, BE: 0, sp: [0, 0, 0, 0], cepas: 0, cepasR: 0 };
      for (const t of ts) {
        const k = ci(t.d), ext = t.int === 'X';
        if (bit) {
          if (k < 0) continue;
          const nn = FAB / cls[k].g;
          o.AU += nn; o.AY += FAB; if (ext) { o.AW += nn; o.BA += FAB; } if (t.int === 'F') o.BE += nn;
        } else {
          if (t.d < dmin) continue;
          o.AU += f; if (ext) o.AW += f; if (t.int === 'F') o.BE += f;
          if (k >= 0) { o.AY += cls[k].g * f; if (ext) o.BA += cls[k].g * f; }
        }
      }
      o.AV = o.AU - o.AW; o.AZ = o.AY - o.BA; o.BD = o.AU - o.BE - o.AW;
      o.AX = o.AW > 0 && o.AU > 0 ? o.AW / o.AU : null; o.BB = o.BA > 0 && o.AY > 0 ? o.BA / o.AY : null;
      o.BF = dmcOf(o.AY, o.AU); o.BG = o.AZ > 0 ? dmcOf(o.AZ, o.AV) : 0;
      // especies por parcela (en simpódico: cepas)
      const seen = new Set();
      for (const t of ts) {
        const k = ci(t.d); if (k < 0) continue;
        if (simp()) { if (seen.has(t.cepa)) continue; seen.add(t.cepa); }
        o.sp[grp(t.sp)] += bit ? FAB / cls[k].g : f;
      }
      return o;
    });
    // estadígrafos
    const st = (arr) => {
      const m = Stat.mean(arr), sd = Stat.sd(arr), va = Stat.variance(arr), cv = sd / m, t = Stat.tinv2(0.05, n - 1);
      const e = cv * t / Math.sqrt(n), lim = Stat.confNorm(sd, n);
      return { media: m, sd, var: va, cv, t, e, lo: m - lim, hi: m + lim };
    };
    const est = { nIni: st(P.map(x => x.AU)), gIni: st(P.map(x => x.AY)), nFin: marcado ? st(P.map(x => x.AV)) : null, gFin: marcado ? st(P.map(x => x.AZ)) : null };
    // estado de desarrollo
    const lim = esc ? LIM.E : LIM.O;
    const estructura = c.est || info.est || '';
    let edd = '', necesitaEdd = false;
    if (estructura === 'Irregular') edd = 'No aplica';
    else { const e = estadoPorDmc(tot.dmcIni, lim); if (e === null) { necesitaEdd = true; edd = c.eddManual || ''; } else edd = e; }
    // 12.3.8 parcelas por estado de desarrollo
    const cuenta = key => {
      const r = { 'Monte bravo alto': 0, 'Latizal bajo': 0, 'Latizal alto': 0, 'Fustal joven': 0, 'Fustal': 0, 'Sobremaduro': 0 };
      for (const x of P) {
        const v = x[key]; if (!isFinite(v) || v <= 0) continue;
        if (v < lim[0]) r['Monte bravo alto']++;
        else if (v <= lim[1]) r['Latizal bajo']++; else if (v <= lim[2]) r['Latizal alto']++;
        else if (v <= lim[3]) r['Fustal joven']++; else if (v <= lim[4]) r['Fustal']++; else r['Sobremaduro']++;
      }
      return r;
    };
    const porEstado = { ini: cuenta('BF'), fin: marcado ? cuenta('BG') : null };
    // cepas (simpódico)
    let cep = null;
    if (simp()) {
      const cepas = {};
      for (const t of trees) {
        if (t.d < dmin) continue;
        const key = t.cepa; const cc = cepas[key] || (cepas[key] = { parc: t.parc, sp: t.sp, keep: false, any: false });
        cc.any = true; if (t.int === 'P' || t.int === 'F') cc.keep = true;
      }
      const list = Object.values(cepas);
      const multi = list.length > n; // hay cepas con más de un vástago o varias cepas por parcela
      if (multi) {
        const fac = bit ? 0 : f;
        const porParc = parcelas.map(p => { const cs = list.filter(x => x.parc === p); const ini = cs.length * fac, res = (marcado ? cs.filter(x => x.keep).length : cs.length) * fac; return { parc: p, CF: ini, CG: res, CH: ini - res, CI: ini > 0 && ini !== res ? (ini - res) / ini : null }; });
        const porSp = [0, 1, 2, 3].map(g => { const cs = list.filter(x => grp(x.sp) === g); return { ini: cs.length * fac / n, fin: (marcado ? cs.filter(x => x.keep).length : cs.length) * fac / n }; });
        const totC = { ini: list.length * fac / n, fin: (marcado ? list.filter(x => x.keep).length : list.length) * fac / n };
        porSp.forEach(o => { o.pIni = totC.ini ? o.ini / totC.ini : NaN; o.pFin = totC.fin ? o.fin / totC.fin : NaN; });
        cep = { porParc, porSp, tot: totC, est: { ini: st(porParc.map(x => x.CF)), fin: marcado ? st(porParc.map(x => x.CG)) : null } };
      }
    }
    return { rod, tf, esc, bit, n, tam, f, dmin, cls, T, resumen, tot, spSel, especies, P, est, edd, necesitaEdd, lim, porEstado, marcado, residualPendiente, cep, sinVol, parcelas, trees, estructura };
  }
  function resultado(rod) {
    if (!rod) return null;
    if (!(rod in cache)) { try { cache[rod] = calcular(rod); } catch (e) { console.error(e); cache[rod] = null; } }
    const r = cache[rod];
    return r && !r.incompleto ? r : null;
  }

  /* ------------------------- utilidades de vista ------------------------- */
  const td = (v, cls) => h('td', { class: cls || 'n' }, v);
  const n0 = v => fmt(v, 0), n2 = v => fmt(v, 2), n1 = v => fmt(v, 1);
  const pct = v => isFinite(v) ? fmt(v * 100, 1) + ' %' : '';
  function spName(r, g) { return g < r.spSel.length ? r.spSel[g] : g === 3 ? 'Otras***' : ''; }
  const lblN = () => simp() ? 'vástagos/ha' : 'árb./ha';

  /* ------------------------- 12.2 registro de parcelas ------------------------- */
  function render122() {
    const box = h('div');
    const rows = S.inv.rows;
    const errores = validarInventario();
    const tbody = h('tbody');
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    if (page >= pages) page = pages - 1;
    const draw = () => {
      tbody.innerHTML = '';
      const start = page * PAGE, end = Math.min(rows.length, start + PAGE);
      for (let i = start; i < end; i++) {
        const r = rows[i];
        const tr = h('tr', null, h('td', { class: 'idx' }, i + 1));
        [0, 1, 2, 3, 4].forEach(j => {
          const inp = h('input', { type: 'text', value: r[j] == null ? '' : r[j], list: j === 2 ? 'dl-especies' : null, 'data-r': i, 'data-c': j,
            oninput: e => { r[j] = j === 4 ? e.target.value.toUpperCase() : e.target.value; if (j === 4) e.target.value = r[j]; App.changed(); },
            onchange: () => { validarFila(tr, r); },
            onkeydown: e => navKey(e, i, j) });
          tr.appendChild(h('td', null, inp));
        });
        tr.appendChild(h('td', { class: 'act' }, h('button', { class: 'icon-btn del', title: 'Eliminar', 'aria-label': 'Eliminar fila', onclick: () => { rows.splice(i, 1); App.changed(true); rerender(); } }, '×')));
        validarFila(tr, r);
        tbody.appendChild(tr);
      }
      if (!rows.length) tbody.appendChild(h('tr', null, h('td', { colspan: 7, class: 'empty' }, 'Sin registros. Agregue filas, pegue desde Excel o importe un archivo.')));
    };
    draw();
    const fileIn = h('input', { type: 'file', accept: '.xlsx,.csv,.txt', hidden: true, onchange: e => e.target.files[0] && importar(e.target.files[0]) });
    box.append(
      h('div', { class: 'grid' },
        h('label', { class: 'fld' }, h('span', { class: 'lbl' }, 'Tipo de registro'),
          h('select', { onchange: e => { S.inv.tipo = e.target.value; App.changed(true); rerender(); } }, ['Monopódico', 'Simpódico'].map(o => h('option', { selected: S.inv.tipo === o }, o)))),
        h('div', { class: 'fld w2' }, h('span', { class: 'lbl' }, 'Instrucciones'), h('p', { class: 'hint' }, simp()
          ? 'Simpódico: en “Parcela, Cepa” use número decimal: la parte entera es la parcela y la decimal la cepa (ej.: 3.12 = parcela 3, cepa 12). Cada fila es un vástago.'
          : 'Monopódico: un registro por árbol. Repita el rodal y la parcela tantas veces como individuos registre. Parcelas: enteros correlativos ≥ 1.'))),
      h('p', { class: 'help' }, 'Intervención: “X” = árbol a extraer; “P” = permanece en pie; “F” = árbol de futuro (permanece). Déjela en blanco si no marcó en todas las parcelas: en ese caso complete la tabla de rodal residual en 12.3.9. Esta planilla se entrega a CONAF sólo como archivo Excel.'),
      h('div', { class: 'tbl-tools' },
        h('button', { class: 'btn sm', onclick: () => { const last = rows[rows.length - 1] || []; rows.push([last[0] || '', last[1] || '', '', '', '']); page = Math.floor((rows.length - 1) / PAGE); App.changed(true); rerender(); setTimeout(() => { const el = $(`input[data-r="${rows.length - 1}"][data-c="2"]`); el && el.focus(); }, 50); } }, '+ Agregar fila'),
        h('button', { class: 'btn sm', onclick: pegar }, 'Pegar desde Excel'),
        h('button', { class: 'btn sm', onclick: () => fileIn.click() }, 'Importar XLSX / CSV'),
        h('button', { class: 'btn sm', onclick: exportXlsx }, 'Exportar Excel'),
        h('button', { class: 'btn sm ghost', onclick: () => { ordenar(); App.changed(true); rerender(); } }, 'Ordenar'),
        h('button', { class: 'btn sm ghost', onclick: async () => { if (await confirmar('¿Eliminar todos los registros del inventario?', 'Eliminar')) { S.inv.rows = []; App.changed(true); rerender(); } } }, 'Vaciar'), fileIn),
      h('div', { class: 'inv-sum' }, `${rows.length} registros · ${rodalesInv().length} rodal(es) · ${new Set(rows.map(r => r[0] + '|' + Math.trunc(num(r[1])))).size} parcela(s)`,
        errores.length ? h('span', { class: 'bad' }, ` · ${errores.length} fila(s) con observaciones`) : null),
      h('div', { class: 'tbl-wrap inv' }, h('table', { class: 'tbl inv-tbl' },
        h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Rodal'), h('th', null, simp() ? 'Parcela, Cepa' : 'Parcela'), h('th', null, 'Especie'), h('th', null, 'DAP/DAT (cm)'), h('th', null, 'Intervención'), h('th', null, ''))), tbody)),
      pages > 1 ? h('div', { class: 'pager' }, h('button', { class: 'btn sm', disabled: page === 0, onclick: () => { page--; rerender(); } }, '‹ Anterior'), h('span', null, `Página ${page + 1} de ${pages}`), h('button', { class: 'btn sm', disabled: page >= pages - 1, onclick: () => { page++; rerender(); } }, 'Siguiente ›')) : null);
    return box;
  }
  function navKey(e, i, j) {
    if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const ni = e.key === 'ArrowUp' ? i - 1 : i + 1;
      const el = $(`input[data-r="${ni}"][data-c="${j}"]`);
      if (el) { e.preventDefault(); el.focus(); el.select(); }
      else if (e.key === 'Enter' && ni === S.inv.rows.length) { e.preventDefault(); const last = S.inv.rows[i]; S.inv.rows.push([last[0], last[1], '', '', '']); App.changed(true); rerender(); setTimeout(() => { const x = $(`input[data-r="${ni}"][data-c="2"]`); x && x.focus(); }, 30); }
    }
  }
  function validarFila(tr, r) {
    const m = filaMsg(r); tr.classList.toggle('err', !!m); tr.title = m;
  }
  function filaMsg(r) {
    const e = [];
    if (!String(r[0] || '').trim()) e.push('rodal vacío');
    const p = num(r[1]);
    if (!isFinite(p)) e.push('parcela no numérica');
    else if (!simp() && (p !== Math.trunc(p) || p < 1)) e.push('Monopódico: parcela debe ser entero ≥ 1');
    else if (simp() && (p === Math.trunc(p) || Math.trunc(p) < 1)) e.push('Simpódico: use decimal parcela.cepa (ej. 3.12)');
    if (!String(r[2] || '').trim()) e.push('especie vacía');
    const d = num(r[3]); if (!(d > 0)) e.push('DAP/DAT debe ser > 0'); else if (d > 300) e.push('DAP/DAT fuera de rango');
    if (r[4] && !['X', 'P', 'F'].includes(String(r[4]).toUpperCase())) e.push('intervención debe ser X, P o F');
    return e.join('; ');
  }
  function validarInventario() { return S.inv.rows.map((r, i) => [i, filaMsg(r)]).filter(x => x[1]); }
  function ordenar() {
    S.inv.rows.sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'es', { numeric: true }) || (num(a[1]) - num(b[1])) || String(a[2]).localeCompare(String(b[2]), 'es'));
  }
  function filasDesdeMatriz(m) {
    let rows = m.filter(r => r && r.some(v => v != null && v !== ''));
    if (rows.length && !isNum(rows[0][1]) && isNaN(num(rows[0][3]))) rows = rows.slice(1); // encabezado
    return rows.map(r => [r[0] == null ? '' : String(r[0]).trim(), r[1] == null ? '' : String(r[1]).trim(), r[2] == null ? '' : String(r[2]).trim(), r[3] == null ? '' : String(r[3]).trim().replace(',', '.'), r[4] == null ? '' : String(r[4]).trim().toUpperCase()]);
  }
  async function agregarFilas(nuevas) {
    if (!nuevas.length) { toast('No se encontraron filas válidas.', 'warn'); return; }
    let reemplazar = false;
    if (S.inv.rows.length) reemplazar = (await modal('Importar inventario', h('p', null, `Se leyeron ${nuevas.length} filas. ¿Reemplazar los ${S.inv.rows.length} registros actuales o agregarlas al final?`), [{ label: 'Cancelar', value: null }, { label: 'Agregar', value: false }, { label: 'Reemplazar', value: true, cls: 'primary' }])) ;
    if (reemplazar === null) return;
    S.inv.rows = reemplazar ? nuevas : S.inv.rows.concat(nuevas);
    if (nuevas.some(r => { const p = num(r[1]); return isFinite(p) && p !== Math.trunc(p); })) S.inv.tipo = 'Simpódico';
    ordenar(); App.changed(true); refreshDatalist(); rerender(); toast(`${nuevas.length} filas importadas.`, 'ok');
  }
  async function pegar() {
    const ta = h('textarea', { rows: 12, placeholder: 'Copie en Excel las columnas Rodal, Parcela, Especie, DAP/DAT, Intervención y péguelas aquí (Ctrl+V).' });
    const v = await modal('Pegar desde Excel', h('div', null, ta), [{ label: 'Cancelar', value: null }, { label: 'Importar', value: 'ok', cls: 'primary' }], { wide: true });
    if (v !== 'ok') return;
    const m = ta.value.split(/\r?\n/).map(l => l.split('\t'));
    agregarFilas(filasDesdeMatriz(m));
  }
  async function importar(file) {
    try {
      let m;
      if (/\.xlsx$/i.test(file.name)) m = await Xlsx.read(await readFile(file));
      else { const t = await readFile(file, 'text'); const sep = t.includes('\t') ? '\t' : t.split('\n')[0].includes(';') ? ';' : ','; m = t.split(/\r?\n/).map(l => l.split(sep)); }
      agregarFilas(filasDesdeMatriz(m));
    } catch (e) { toast('No se pudo leer el archivo: ' + e.message, 'err'); }
  }
  function exportXlsx() {
    const rows = [['Rodal', simp() ? 'Parcela, Cepa' : 'Parcela', 'Especie', 'Dap/Dat', 'Intervención']].concat(S.inv.rows.map(r => [r[0], isNum(r[1]) ? num(r[1]) : r[1], r[2], isNum(r[3]) ? num(r[3]) : r[3], r[4]]));
    download('12.2_Registro_parcelas_' + safeName(App.f('pr_nombre')) + '.xlsx', Xlsx.write([{ name: '12.2 Registro de parcelas', rows }]));
  }
  function refreshDatalist() { const dl = $('#dl-especies'); if (dl) { dl.innerHTML = ''; App.especiesLista().forEach(s => dl.appendChild(h('option', { value: s }))); } }

  /* ------------------------- 12.3 análisis por rodal ------------------------- */
  function render123() {
    const rods = rodalesInv();
    if (!rods.length) return h('p', { class: 'empty-state' }, 'Ingrese primero el registro de parcelas (12.2).');
    if (!rodSel || !rods.includes(rodSel)) rodSel = rods[0];
    const c = cfg(rodSel), info = App.rodalInfo(rodSel);
    if (!c.tf && info.tf) c.tf = info.tf; if (!c.stf && info.stf) c.stf = info.stf; if (!c.est && info.est) c.est = info.est; if (!c.sup && info.sup) c.sup = info.sup;
    const raw = (() => { try { return calcular(rodSel); } catch (e) { return null; } })();
    const esp = raw ? raw.especies : [];
    const esc = c.tf === 'Esclerófilo';
    const set = (k, v, re = true) => { c[k] = v; if (['tf', 'stf', 'est', 'sup'].includes(k)) { const row = App.t('t511').find(x => String(x.rodal).trim() === rodSel); if (row) row[k] = v; } App.changed(true); if (re) rerender(); };
    const sel = (k, opts, label, re = true) => h('label', { class: 'fld' }, h('span', { class: 'lbl' }, label), h('select', { onchange: e => set(k, e.target.value, re) }, [''].concat(opts).map(o => h('option', { value: o, selected: (c[k] || '') === o }, o || '—'))));
    const inp = (k, label, ph) => h('label', { class: 'fld' }, h('span', { class: 'lbl' }, label), h('input', { type: 'text', value: c[k] || '', placeholder: ph || '', inputmode: 'decimal', onchange: e => set(k, e.target.value) }));
    const muestreos = esc ? L.Muestreo2 : L.Muestreo1;
    if (esc && c.muestreo === 'Bitterlich') c.muestreo = '';
    const bit = c.muestreo === 'Bitterlich';
    const head = h('div', { class: 'card' },
      h('div', { class: 'rod-tabs' }, rods.map(r => h('button', { class: 'chip' + (r === rodSel ? ' on' : ''), onclick: () => { rodSel = r; rerender(); } }, 'Rodal ' + r))),
      h('div', { class: 'grid g4' },
        h('div', { class: 'fld' }, h('span', { class: 'lbl' }, 'Rodal'), h('div', { class: 'ro-val' }, rodSel)),
        inp('sup', 'Superficie rodal (ha)'),
        sel('tf', L.Tipo_Forestal, 'Tipo forestal'),
        sel('stf', CAT.SUBTIPOS[c.tf] || [], 'Subtipo'),
        sel('est', L.Estructura, 'Estructura'),
        sel('muestreo', muestreos, 'Tipo de muestreo'),
        h('div', { class: 'fld' }, h('span', { class: 'lbl' }, 'Parcelas (n)'), h('div', { class: 'ro-val' }, raw ? raw.n : 0)),
        inp('tam', bit ? 'Factor de área basal (FAB)' : 'Superficie parcela (m²)', bit ? 'ej. 4' : 'ej. 500'),
        bit ? h('div', { class: 'fld' }, h('span', { class: 'lbl' }, 'Forma'), h('div', { class: 'ro-val' }, 'Relascópica')) : sel('forma', ['Circular', 'Cuadrada', 'Rectangular'], 'Forma'),
        h('label', { class: 'fld' }, h('span', { class: 'lbl' }, 'Fecha muestreo'), h('input', { type: 'date', value: c.fecha || '', onchange: e => set('fecha', e.target.value, false) })),
        esc ? h('div', { class: 'fld' }, h('span', { class: 'lbl' }, 'Diámetro'), h('div', { class: 'ro-val' }, 'DAT, clases desde 0 cm')) :
          h('label', { class: 'fld' }, h('span', { class: 'lbl' }, 'Ø mínimo tabla de rodal'), h('select', { onchange: e => set('dmin', Number(e.target.value)) }, [5, 0].map(o => h('option', { value: o, selected: (c.dmin === 0 ? 0 : 5) === o }, o + ' cm'))))),
      h('div', { class: 'grid g4' },
        ['sp1', 'sp2', 'sp3'].map((k, i) => h('label', { class: 'fld' }, h('span', { class: 'lbl' }, `Especie principal ${i + 1}`), h('select', { onchange: e => set(k, e.target.value) }, [''].concat(esp).map(o => h('option', { value: o, selected: (c[k] || '') === o }, o || '—'))))),
        h('div', { class: 'fld' }, h('span', { class: 'lbl' }, 'Exportar'), h('button', { class: 'btn sm', onclick: () => imprimirRodal(rodSel) }, 'PDF sección 12.3 del rodal'))));
    const box = h('div', null, head);
    const r = resultado(rodSel);
    if (!r) { box.appendChild(h('p', { class: 'empty-state' }, 'Complete el tipo de muestreo y la superficie de parcela (o FAB) para generar el análisis.')); return box; }
    box.appendChild(analisis(r, c));
    return box;
  }

  function analisis(r, c) {
    const out = h('div', { class: 'analisis' });
    const card = (title, ...kids) => h('section', { class: 'card' }, h('h2', null, title), ...kids);
    // aviso y estado de desarrollo
    const avisos = [];
    if (!r.marcado) avisos.push('Sin marcación en parcelas (columna Intervención vacía): sólo se calculan parámetros iniciales por parcela. Complete la tabla de rodal residual (12.3.9).');
    if (r.sinVol.length) avisos.push('Especies sin función de volumen (12.1.3): ' + r.sinVol.join(', ') + '.');
    if (avisos.length) out.appendChild(h('div', { class: 'alert' }, avisos.map(a => h('p', null, a))));
    const eddBox = h('div', { class: 'edd' }, h('span', null, 'Estado de desarrollo del rodal: '));
    if (r.necesitaEdd) eddBox.appendChild(h('select', { onchange: e => { c.eddManual = e.target.value; App.changed(true); rerender(); } }, ['', 'Repoblado', 'Monte bravo bajo', 'Monte bravo alto'].map(o => h('option', { value: o, selected: (c.eddManual || '') === o }, o || 'Seleccione (DMC < ' + r.lim[0] + ' cm)'))));
    else eddBox.appendChild(h('b', null, r.edd || '—'));
    eddBox.appendChild(h('span', { class: 'muted' }, ` · DMC inicial ${n1(r.tot.dmcIni)} cm · Clases desde ${r.dmin} cm (${r.esc ? 'Esclerófilo: DAT' : 'Otros tipos: DAP'})`));
    out.appendChild(eddBox);
    // 12.3.1
    const t1 = h('table', { class: 'tbl ro num' },
      h('thead', null, h('tr', null, h('th', { rowspan: 2 }, 'Especie'), h('th', { colspan: 2 }, `Densidad (${lblN()})`), h('th', { colspan: 2 }, 'Área basal (m²/ha)'), h('th', { colspan: 2 }, 'DMC (cm)'), h('th', { colspan: 2 }, 'Participación**')),
        h('tr', null, ['Inicial', 'Final', 'Inicial', 'Final', 'Inicial', 'Final', 'Inicial', 'Final'].map(x => h('th', null, x)))),
      h('tbody', null, [0, 1, 2, 3, 4].filter(g => g < r.spSel.length || g >= 3).map(g => {
        const o = r.resumen[g];
        return h('tr', { class: g === 4 ? 'tot' : '' }, h('td', { class: 'l' }, g === 4 ? 'Total' : spName(r, g)), td(n0(o.nIni)), td(n0(o.nFin)), td(n2(o.gIni)), td(n2(o.gFin)), td(n1(o.dmcIni)), td(n1(o.dmcFin)), td(pct(o.pIni)), td(pct(o.pFin)));
      })));
    const otras = r.especies.filter(s => !r.spSel.includes(s));
    out.appendChild(card(simp() ? '12.3.1 Parámetros iniciales y finales del rodal (vástagos)' : '12.3.1 Parámetros iniciales y finales del rodal', h('div', { class: 'tbl-wrap' }, t1),
      h('p', { class: 'note muted' }, `(*) ${simp() ? 'vástagos' : 'árboles'} (**) relativa (%) en densidad (***) ${otras.join(', ') || '—'}`)));
    // 12.3.2
    const e = r.est;
    const rowE = (lbl, k, d) => h('tr', null, h('td', { class: 'l' }, lbl), td(fmtE(e.nIni[k], k, 0)), td(fmtE(e.gIni[k], k, 2)), td(e.nFin ? fmtE(e.nFin[k], k, 0) : '—'), td(e.gFin ? fmtE(e.gFin[k], k, 2) : '—'));
    const t2 = h('table', { class: 'tbl ro num' }, h('thead', null, h('tr', null, h('th', { rowspan: 2 }, 'Estadígrafos'), h('th', { colspan: 2 }, 'Inicial'), h('th', { colspan: 2 }, 'Final')), h('tr', null, ['N/ha', 'G/ha', 'N/ha', 'G/ha'].map(x => h('th', null, x)))),
      h('tbody', null, rowE('Media', 'media'), rowE('D. Estándar', 'sd'), rowE('Varianza', 'var'), rowE('C. Variación', 'cv'), rowE('t de student (95%)', 't'), rowE('E. de muestreo', 'e')));
    const ciN = Charts.ci({ title: 'Densidad', yTitle: lblN(), groups: [{ label: 'Inicial', lo: e.nIni.lo, mean: e.nIni.media, hi: e.nIni.hi }, { label: 'Final', lo: e.nFin ? e.nFin.lo : NaN, mean: e.nFin ? e.nFin.media : r.tot.nFin, hi: e.nFin ? e.nFin.hi : NaN }] });
    const ciG = Charts.ci({ title: 'Área basal', yTitle: 'm²/ha', groups: [{ label: 'Inicial', lo: e.gIni.lo, mean: e.gIni.media, hi: e.gIni.hi }, { label: 'Final', lo: e.gFin ? e.gFin.lo : NaN, mean: e.gFin ? e.gFin.media : r.tot.gFin, hi: e.gFin ? e.gFin.hi : NaN }] });
    out.appendChild(card(simp() ? '12.3.2 Estadígrafos y límites de confianza asociados (vástagos)' : '12.3.2 Estadígrafos y límites de confianza asociados', h('div', { class: 'two' }, h('div', { class: 'tbl-wrap' }, t2), h('div', { class: 'charts2' }, ciN, ciG)),
      h('p', { class: 'note muted' }, 'Límites de confianza al 95 %. E. de muestreo = CV × t / √n.')));
    // 12.3.3
    const last = lastClass(r);
    const labs = r.cls.slice(0, last + 1).map(x => x.mc);
    const ext = r.T.slice(0, last + 1).map(row => row[4].ni - row[4].nr), res = r.T.slice(0, last + 1).map(row => row[4].nr);
    out.appendChild(card('12.3.3 Efecto de la intervención sobre la distribución diamétrica', Charts.combo({ labels: labs, xTitle: 'Clases diamétricas (cm)', yTitle: `Densidad (${lblN()})`, stacked: true,
      bars: [{ name: 'Residual', data: res, color: '#2f6b3f' }, { name: 'Extracción', data: ext, color: '#2f6b3f', dash: true }],
      line: { name: 'Intensidad', data: r.T.slice(0, last + 1).map(row => row[4].ni > 0 ? (row[4].ni - row[4].nr) / row[4].ni : null), pct: true, color: '#b23b2e' }, height: 320, width: 820 })));
    // 12.3.4
    out.appendChild(card('12.3.4 Distribución espacial de las parcelas', imagenRodal(r.rod, c)));
    // 12.3.5
    const pl = r.P.map(x => x.parc);
    out.appendChild(card('12.3.5 Efecto sobre la densidad y área basal por parcela',
      Charts.combo({ title: 'Densidad', labels: pl, xTitle: 'Parcelas', yTitle: lblN(), stacked: true,
        bars: [{ name: 'Residual', data: r.P.map(x => x.BD), color: '#2f6b3f' }, { name: 'Futuro', data: r.P.map(x => x.BE), color: '#7aa36b' }, { name: 'Extracción', data: r.P.map(x => x.AW), color: '#2f6b3f', dash: true }],
        line: r.marcado ? { name: 'Intensidad', data: r.P.map(x => x.AX), pct: true } : null, width: 820, height: 300 }),
      Charts.combo({ title: 'Área basal', labels: pl, xTitle: 'Parcelas', yTitle: 'Área basal (m²/ha)', stacked: true,
        bars: [{ name: 'Residual', data: r.P.map(x => x.AZ), color: '#3a76a8' }, { name: 'Extracción', data: r.P.map(x => x.BA), color: '#3a76a8', dash: true }],
        line: r.marcado ? { name: 'Intensidad', data: r.P.map(x => x.BB), pct: true } : null, width: 820, height: 300 })));
    // 12.3.6
    const spSeries = key => [0, 1, 2, 3].filter(g => g < r.spSel.length || g === 3).map(g => ({ name: g === 3 ? 'Otras especies' : r.spSel[g], data: r.T.slice(0, last + 1).map(row => row[g][key]), color: Charts.PAL[g] }));
    out.appendChild(card('12.3.6 Efectos sobre la estructura por especies', h('div', { class: 'charts2' },
      Charts.combo({ title: 'Inicial', labels: labs, xTitle: 'Clases diamétricas (cm)', yTitle: `Densidad (${lblN()})`, lines: spSeries('ni'), width: 520, height: 300 }),
      Charts.combo({ title: 'Final', labels: labs, xTitle: 'Clases diamétricas (cm)', yTitle: `Densidad (${lblN()})`, lines: spSeries('nr'), width: 520, height: 300 }))));
    // 12.3.7
    out.appendChild(card('12.3.7 Distribución espacial por especies (inicial)', Charts.combo({ labels: pl, xTitle: 'Parcelas', yTitle: simp() ? 'Densidad (cepas/ha)' : `Densidad (${lblN()})`, stacked: true,
      bars: [0, 1, 2, 3].filter(g => g < r.spSel.length || g === 3).map(g => ({ name: g === 3 ? 'Otras' : r.spSel[g], data: r.P.map(x => x.sp[g]), color: Charts.PAL[g] })), width: 820, height: 300 })));
    // 12.3.8
    const est = ['Repoblado', 'Monte bravo bajo', 'Monte bravo alto', 'Latizal bajo', 'Latizal alto', 'Fustal joven', 'Fustal', 'Sobremaduro'];
    const lim = r.lim, rango = ['', '', `< ${lim[0]}`, `${lim[0]} – ${lim[1]}`, `> ${lim[1]} – ${lim[2]}`, `> ${lim[2]} – ${lim[3]}`, `> ${lim[3]} – ${lim[4]}`, `> ${lim[4]}`];
    const ti = Object.values(r.porEstado.ini).reduce((a, b) => a + b, 0), tf = r.porEstado.fin ? Object.values(r.porEstado.fin).reduce((a, b) => a + b, 0) : 0;
    out.appendChild(card('12.3.8 Distribución de parcelas por estado de desarrollo', h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl ro num' },
      h('thead', null, h('tr', null, h('th', { rowspan: 2 }, 'Estado'), h('th', { rowspan: 2 }, 'DMC (cm)'), h('th', { colspan: 2 }, 'N° parcelas'), h('th', { colspan: 2 }, 'Proporción')), h('tr', null, ['Inicial', 'Final', 'Inicial', 'Final'].map(x => h('th', null, x)))),
      h('tbody', null, est.map((s, i) => { const a = r.porEstado.ini[s], b = r.porEstado.fin ? r.porEstado.fin[s] : null; return h('tr', null, h('td', { class: 'l' }, s), td(rango[i], 'c'), td(a || ''), td(b || ''), td(a ? pct(a / ti) : ''), td(b ? pct(b / tf) : '')); }),
        h('tr', { class: 'tot' }, h('td', { class: 'l' }, 'Total'), td(''), td(ti), td(r.porEstado.fin ? tf : ''), td(ti ? '100,0 %' : ''), td(tf ? '100,0 %' : '')))))));
    // 12.3.9 tabla de rodal
    out.appendChild(card(simp() ? '12.3.11 Tabla de rodal inicial y residual, después de la intervención inmediata' : '12.3.9 Tabla de rodal inicial y residual, después de la intervención inmediata', tablaRodal(r, c)));
    // cepas
    if (r.cep) {
      const cp = r.cep;
      out.appendChild(card(r.marcado ? '12.3.9 Parámetros iniciales y finales del rodal (cepas)' : '12.3.9 Parámetros iniciales del rodal (cepas)',
        h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl ro num' }, h('thead', null, h('tr', null, h('th', null, 'Especie'), h('th', null, 'Densidad inicial (cepas/ha)'), h('th', null, 'Densidad final'), h('th', null, 'Participación inicial'), h('th', null, 'Participación final'))),
          h('tbody', null, [0, 1, 2, 3].filter(g => g < r.spSel.length || g === 3).map(g => h('tr', null, h('td', { class: 'l' }, spName(r, g)), td(n0(cp.porSp[g].ini)), td(n0(cp.porSp[g].fin)), td(pct(cp.porSp[g].pIni)), td(pct(cp.porSp[g].pFin)))),
            h('tr', { class: 'tot' }, h('td', { class: 'l' }, 'Total'), td(n0(cp.tot.ini)), td(n0(cp.tot.fin)), td('100,0 %'), td('100,0 %'))))),
        h('p', { class: 'note' }, `Estadígrafos cepas/ha – media ${n0(cp.est.ini.media)}, CV ${pct(cp.est.ini.cv)}, E. muestreo ${pct(cp.est.ini.e)}` + (cp.est.fin ? ` · final: media ${n0(cp.est.fin.media)}` : ''))));
      out.appendChild(card(r.marcado ? '12.3.10 Efecto sobre la densidad por parcela (cepas)' : '12.3.10 Cepas por parcela', Charts.combo({ labels: cp.porParc.map(x => x.parc), xTitle: 'Parcelas', yTitle: 'Densidad (cepas/ha)', stacked: true,
        bars: [{ name: 'Residual', data: cp.porParc.map(x => x.CG), color: '#8e4f8a' }, { name: 'Extracción', data: cp.porParc.map(x => x.CH), color: '#8e4f8a', dash: true }],
        line: r.marcado ? { name: 'Intensidad', data: cp.porParc.map(x => x.CI), pct: true } : null, width: 820, height: 300 })));
    }
    return out;
  }
  function fmtE(v, k, d) { if (!isFinite(v)) return ''; if (k === 'cv' || k === 'e') return pct(v); if (k === 't') return fmt(v, 3); if (k === 'var') return fmt(v, d === 0 ? 0 : 2); return fmt(v, d); }
  function lastClass(r) { let last = 0; r.T.forEach((row, k) => { if (row[4].ni > 0) last = k; }); return Math.max(last, 2); }

  function tablaRodal(r, c) {
    const last = lastClass(r);
    const groups = [0, 1, 2, 3].filter(g => g < r.spSel.length || g === 3);
    const editable = !r.marcado;
    c.resid = c.resid || {};
    const thead = h('thead', null,
      h('tr', null, h('th', { rowspan: 3 }, 'Rango (cm) ≤ Ø <'), h('th', { rowspan: 3 }, 'Mc'), groups.map(g => h('th', { colspan: 4 }, g === 3 ? 'Otras' : r.spSel[g])), h('th', { colspan: 4 }, 'Total')),
      h('tr', null, groups.concat([4]).map(() => [h('th', { colspan: 2 }, `N (${lblN()})`), h('th', { colspan: 2 }, 'G (m²/ha)')])),
      h('tr', null, groups.concat([4]).map(() => ['Ini.', 'Res.', 'Ini.', 'Res.'].map(x => h('th', null, x)))));
    const tbody = h('tbody');
    for (let k = 0; k <= last; k++) {
      const cl = r.cls[k], row = r.T[k];
      const tr = h('tr', null, td(`${cl.lo} – ${cl.hi}`, 'c'), td(fmt(cl.mc, 1)));
      for (const g of groups) {
        const x = row[g];
        tr.appendChild(td(n0(x.ni)));
        if (editable && x.ni > 0) {
          const cur = (c.resid[k] || {})['g' + g];
          tr.appendChild(h('td', { class: 'edit' + (cur === '' || cur == null ? ' pend' : '') }, h('input', { type: 'text', inputmode: 'decimal', value: cur == null ? '' : cur, placeholder: n0(x.ni), title: 'Densidad residual (vacío = sin extracción)',
            onchange: e => { let v = e.target.value; if (isNum(v) && num(v) > x.ni + 1e-9) { toast(`La densidad residual no puede superar la inicial (${n0(x.ni)}). Se ajustó al valor inicial.`, 'warn'); v = String(round(x.ni, 2)); } if (isNum(v) && num(v) < 0) v = '0'; (c.resid[k] = c.resid[k] || {})['g' + g] = v; App.changed(true); rerender(); } })));
        } else tr.appendChild(td(n0(x.nr)));
        tr.appendChild(td(n2(x.gi))); tr.appendChild(td(n2(x.gr)));
      }
      const t = row[4]; tr.append(td(n0(t.ni)), td(n0(t.nr)), td(n2(t.gi)), td(n2(t.gr)));
      tbody.appendChild(tr);
    }
    const trt = h('tr', { class: 'tot' }, td('Total', 'l'), td(''));
    for (const g of groups.concat([4])) { const o = r.resumen[g]; trt.append(td(n0(o.nIni)), td(n0(o.nFin)), td(n2(o.gIni)), td(n2(o.gFin))); }
    tbody.appendChild(trt);
    return h('div', null, editable ? h('p', { class: 'help' }, 'Sin marcación: ingrese la densidad residual por clase y especie (celdas celestes). Celda vacía = sin extracción en esa clase.') : null,
      h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl ro num stand' }, thead, tbody)));
  }
  function imagenRodal(rod, c) {
    const img = c.img ? h('img', { src: c.img, class: 'rod-img', alt: 'Rodal ' + rod + ' y sus parcelas' }) : h('p', { class: 'muted' }, 'Sin imagen. Genérela desde la cartografía (capas Rodales y Parcelas) o suba una imagen JPG del rodal y sus parcelas.');
    const fi = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async e => { const f = e.target.files[0]; if (!f) return; c.img = await readFile(f, 'dataurl'); App.changed(); rerender(); } });
    return h('div', null, img, h('div', { class: 'tbl-tools' },
      h('button', { class: 'btn sm', onclick: async () => { const d = await Carto.imagenRodal(rod); if (d) { c.img = d; App.changed(); rerender(); } } }, 'Generar desde cartografía'),
      h('button', { class: 'btn sm', onclick: () => fi.click() }, 'Subir imagen'), c.img ? h('button', { class: 'btn sm ghost', onclick: () => { delete c.img; App.changed(); rerender(); } }, 'Quitar') : null, fi));
  }

  /* ------------------------- 12.1 ------------------------- */
  function render121() {
    const rods = rodalesInv();
    const box = h('div');
    // 12.1.1
    box.appendChild(h('section', { class: 'card' }, h('h2', null, '12.1.1 Características generales del inventario'),
      h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl ro' }, h('thead', null, h('tr', null, ['Rodal', 'Tipo de muestreo', 'Forma de parcela', 'Tamaño (m²) / FAB', 'Ø mínimo (cm)'].map(x => h('th', null, x)))),
        h('tbody', null, rods.map(r => { const c = cfg(r); const bit = c.muestreo === 'Bitterlich'; return h('tr', null, h('td', null, r), h('td', null, c.muestreo || '—'), h('td', null, bit ? 'Relascópica' : (c.forma || '—')), h('td', { class: 'n' }, c.tam ? (bit ? 'FAB ' + c.tam : fmt(num(c.tam), 0) + ' m²') : '—'), h('td', { class: 'n' }, c.tf === 'Esclerófilo' ? 0 : (c.dmin === 0 ? 0 : 5))); })))),
      App.renderItem({ type: 'text', k: 'c1211', l: 'Justificación del tipo de muestreo; forma, tamaño de las parcelas, y diámetro mínimo' })));
    // 12.1.2
    const tb = h('tbody');
    for (const rod of rods) {
      const res = resultado(rod), parcs = res ? res.P : [...new Set(S.inv.rows.filter(r => String(r[0]).trim() === rod).map(r => Math.trunc(num(r[1]))))].filter(isFinite).sort((a, b) => a - b).map(p => ({ parc: p }));
      for (const p of parcs) {
        const key = rod + '|' + p.parc, co = S.coord[key] || (S.coord[key] = {});
        const cell = (k, min, max) => h('td', null, h('input', { type: 'text', inputmode: 'numeric', value: co[k] || '', class: co[k] && (num(co[k]) < min || num(co[k]) > max) ? 'err' : '', onchange: e => { co[k] = e.target.value; App.changed(); e.target.classList.toggle('err', !!co[k] && (num(co[k]) < min || num(co[k]) > max)); } }));
        tb.appendChild(h('tr', null, h('td', null, rod), h('td', { class: 'n' }, p.parc),
          h('td', null, h('select', { onchange: e => { co.huso = e.target.value; App.changed(); } }, ['', '18', '19'].map(o => h('option', { selected: (co.huso || S.f.pm_huso || '') === o }, o)))),
          cell('este', 200000, 800000), cell('norte', 3000000, 9000000),
          h('td', { class: 'n' }, p.AU != null ? n0(p.AU) : ''), h('td', { class: 'n' }, p.AY != null ? n2(p.AY) : '')));
      }
    }
    box.appendChild(h('section', { class: 'card' }, h('h2', null, '12.1.2 Coordenadas UTM de parcelas de muestreo y parámetros parciales'),
      h('p', { class: 'help' }, 'Densidad y área basal por parcela son referenciales para analizar la homogeneidad del rodal. Las coordenadas pueden tomarse desde la capa Parcelas de la cartografía.'),
      h('div', { class: 'tbl-tools' }, h('button', { class: 'btn sm', onclick: () => Carto.coordsParcelas() }, 'Tomar coordenadas desde cartografía')),
      h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Rodal', 'Parcela (N°)', 'Huso', 'Este (m)', 'Norte (m)', `Densidad (${lblN()})`, 'Área basal (m²/ha)'].map(x => h('th', null, x)))), tb)),
      App.renderItem({ type: 'text', k: 'c1212', l: 'Identificación de parcelas en terreno' })));
    // 12.1.3
    const esp = [...new Set(S.inv.rows.map(r => String(r[2] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    const tv = h('tbody');
    for (const sp of esp) {
      const v = S.vol[sp] || (S.vol[sp] = {});
      const test = h('td', { class: 'n test' });
      const upd = () => {
        try { const f = Expr.compile(v.expr); const val = f(30, num(v.h) || 0); test.textContent = isFinite(val) ? fmt(val, 4) + ' m³' : 'error'; test.classList.toggle('bad', !isFinite(val)); test.title = 'Volumen para DAP = 30 cm'; }
        catch (e) { test.textContent = v.expr ? e.message : ''; test.classList.toggle('bad', !!v.expr); }
      };
      upd();
      const i = (k, w, ph) => h('td', null, h('input', { type: 'text', value: v[k] || '', placeholder: ph || '', style: { width: w }, oninput: e => { v[k] = e.target.value; App.changed(); upd(); } }));
      tv.appendChild(h('tr', null, h('td', { class: 'l i' }, sp), i('h', '70px', 'm'), i('expr', '100%', 'ej. 0.0000527*DAP^2.06*H^0.80'), i('fte', '100%', 'Autor/documento'), i('anio', '64px', 'Año'), test));
    }
    box.appendChild(h('section', { class: 'card' }, h('h2', null, '12.1.3 Funciones de volumen o biomasa utilizadas'),
      h('p', { class: 'help' }, 'Escriba la expresión con la misma lógica de una fórmula Excel, sin el signo “=”, usando DAP o DAT (cm) y H (altura modal, m). Funciones: LN, LOG, EXP, POTENCIA/POWER, RAIZ/SQRT, PI(). Separador de argumentos “,” o “;”. La columna de prueba muestra el volumen para DAP = 30 cm.'),
      h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl vol' }, h('thead', null, h('tr', null, ['Especie', 'Altura (m)', 'Expresión matemática de la función', 'Fuente – Autor/documento', 'Año', 'Prueba'].map(x => h('th', null, x)))), tv)),
      !esp.length ? h('p', { class: 'muted' }, 'Las especies aparecen al ingresar el registro de parcelas.') : null));
    // 12.1.4
    const res = rods.map(resultado).filter(Boolean);
    box.appendChild(h('section', { class: 'card' }, h('h2', null, '12.1.4 Resumen del inventario'),
      h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl ro num' },
        h('thead', null, h('tr', null, h('th', { rowspan: 2 }, 'Rodal'), h('th', { rowspan: 2 }, 'Parcelas (n)'), h('th', { rowspan: 2 }, 't student (95%)'), h('th', { colspan: 2 }, 'Media'), h('th', { colspan: 2 }, 'Varianza'), h('th', { colspan: 2 }, 'Coef. variación (%)'), h('th', { colspan: 2 }, 'Error de muestreo (%)')),
          h('tr', null, [`Densidad (${lblN()})`, 'Área basal (m²/ha)', 'Densidad', 'Área basal', 'Densidad', 'Área basal', 'Densidad', 'Área basal'].map(x => h('th', null, x)))),
        h('tbody', null, res.map(r => h('tr', null, h('td', { class: 'l' }, r.rod), td(r.n), td(fmt(r.est.nIni.t, 3)), td(n0(r.est.nIni.media)), td(n2(r.est.gIni.media)), td(n0(r.est.nIni.var)), td(n2(r.est.gIni.var)), td(pct(r.est.nIni.cv)), td(pct(r.est.gIni.cv)), td(pct(r.est.nIni.e)), td(pct(r.est.gIni.e)))))))));
    // 12.1.5
    box.appendChild(h('section', { class: 'card' }, h('h2', null, '12.1.5 Intensidad de la intervención inmediata'), tabla125(res)));
    return box;
  }
  function tabla125(res) {
    const ex = (a, b) => a > 0 ? pct((a - b) / a) : '';
    return h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl ro num' },
      h('thead', null, h('tr', null, h('th', { rowspan: 2 }, 'Rodal'), h('th', { colspan: 3 }, `Densidad (${lblN()})`), h('th', { colspan: 3 }, 'Área basal (m²/ha)'), h('th', { colspan: 3 }, 'Volumen (m³/ha)')),
        h('tr', null, ['Inicial', 'Extracción', 'Final', 'Inicial', 'Extracción', 'Final', 'Inicial', 'Extracción', 'Final'].map(x => h('th', null, x)))),
      h('tbody', null, res.map(r => { const t = r.tot; return h('tr', null, h('td', { class: 'l' }, r.rod), td(n0(t.nIni)), td(ex(t.nIni, t.nFin)), td(n0(t.nFin)), td(n2(t.gIni)), td(ex(t.gIni, t.gFin)), td(n2(t.gFin)), td(n1(t.vIni)), td(ex(t.vIni, t.vFin)), td(n1(t.vFin))); }))));
  }

  /* ------------------------- 7.2 y 7.4.2 ------------------------- */
  function recalc72(r, mn, mx) {
    let N = 0, G = 0;
    r.T.forEach((row, k) => { const cl = r.cls[k]; if (cl.lo >= mn && cl.hi <= mx) { N += row[4].ni; G += row[4].gi; } });
    const share = r.tot.nIni ? N / r.tot.nIni : 0;
    const dmc = N > 0 ? Math.sqrt(G * 40000 / (N * Math.PI)) : NaN;
    const e = estadoPorDmc(dmc, r.lim);
    return { share, dmc, edd: e === null ? 'Monte bravo alto' : e };
  }
  function render72() {
    const rods = rodalesInv().map(resultado).filter(Boolean);
    if (!rods.length) return h('p', { class: 'muted' }, 'Requiere el análisis del inventario (Capítulo 12).');
    return h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl num' },
      h('thead', null, h('tr', null, h('th', { rowspan: 2 }, 'Rodal'), h('th', { colspan: 2 }, 'Estado original'), h('th', { colspan: 3 }, 'Parámetros de recálculo'), h('th', { colspan: 2 }, 'Estado modificado'), h('th', { rowspan: 2 }, 'Estado final')),
        h('tr', null, ['DMC (cm)', 'Estado', 'Ø mín', 'Ø máx', 'Árboles', 'DMC (cm)', 'Estado'].map(x => h('th', null, x)))),
      h('tbody', null, rods.map(r => {
        const m = S.c72[r.rod] || (S.c72[r.rod] = {});
        const mins = r.cls.map(c => c.lo), maxs = r.cls.map(c => c.hi);
        let rc = null, msg = '';
        if (r.edd === 'No aplica' && (m.mn || m.mx)) msg = 'Estructura irregular: no aplican estados de desarrollo.';
        else if (isNum(m.mn) && isNum(m.mx)) {
          if (num(m.mn) >= num(m.mx)) msg = 'El Ø mínimo no puede ser mayor o igual al Ø máximo.';
          else { rc = recalc72(r, num(m.mn), num(m.mx)); if (rc.share < 0.95) { msg = `El rango contiene ${fmt(rc.share * 100, 2)} % de los individuos; se requiere al menos 95 %.`; rc.ok = false; } else rc.ok = rc.edd !== r.edd; if (rc.share >= 0.95 && rc.edd === r.edd) msg = 'Sin cambios respecto del estado original.'; }
        }
        const sel = (k, list) => h('select', { onchange: e => { m[k] = e.target.value; App.changed(); App.refreshCalcs(); } }, [''].concat(list).map(o => h('option', { value: o, selected: String(m[k] || '') === String(o) }, o)));
        const final = r.edd === 'No aplica' ? 'No aplica' : (rc && rc.ok ? rc.edd : r.edd);
        return [h('tr', null, h('td', { class: 'l' }, r.rod), td(n1(r.tot.dmcIni)), td(r.edd || '—', 'l'), h('td', null, sel('mn', mins)), h('td', null, sel('mx', maxs)), td(rc ? pct(rc.share) : ''), td(rc && rc.ok ? n1(rc.dmc) : ''), td(rc && rc.ok ? rc.edd : '', 'l'), td(final + (rc && rc.ok ? ' (modificado)' : ''), 'l b')),
          msg ? h('tr', { class: 'msg' }, h('td', { colspan: 9 }, msg)) : null];
      }))));
  }
  function estadoFinal(rod) {
    const r = resultado(rod); if (!r) return '';
    const m = S.c72[rod] || {};
    if (r.edd !== 'No aplica' && isNum(m.mn) && isNum(m.mx) && num(m.mn) < num(m.mx)) { const rc = recalc72(r, num(m.mn), num(m.mx)); if (rc.share >= 0.95) return rc.edd; }
    return r.edd;
  }
  function render742() {
    const rods = rodalesInv().map(resultado).filter(Boolean);
    if (!rods.length) return h('p', { class: 'muted' }, 'Requiere el análisis del inventario (Capítulo 12).');
    return h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl num' },
      h('thead', null, h('tr', null, h('th', { rowspan: 2 }, 'Rodal'), h('th', { colspan: 5 }, 'Estado inicial'), h('th', { colspan: 4 }, 'Estado final')),
        h('tr', null, [`Densidad (${lblN()})`, 'Área basal (m²/ha)', 'DMC (cm)', 'Volumen (m³/ha)', 'Cobertura (%)', `Densidad (${lblN()})`, 'Área basal (m²/ha)', 'DMC (cm)', 'Volumen (m³/ha)'].map(x => h('th', null, x)))),
      h('tbody', null, rods.map(r => { const t = r.tot; return h('tr', null, h('td', { class: 'l' }, r.rod), td(n0(t.nIni)), td(n2(t.gIni)), td(n1(t.dmcIni)), td(n1(t.vIni)),
        h('td', null, h('select', { onchange: e => { S.c742[r.rod] = e.target.value; App.changed(); } }, [''].concat(L.Coberturas).map(o => h('option', { value: o, selected: S.c742[r.rod] === o }, o)))),
        td(n0(t.nFin)), td(n2(t.gFin)), td(n1(t.dmcFin)), td(n1(t.vFin))); }))));
  }

  /* ------------------------- vista principal cap. 12 ------------------------- */
  function render() {
    const wrap = h('div', { class: 'view', id: 'inv-view' });
    wrap.appendChild(h('header', { class: 'view-h' }, h('p', { class: 'eyebrow' }, 'Capítulo 12'), h('h1', null, 'Información cuantitativa del recurso a intervenir'),
      h('p', { class: 'lead sm' }, 'Obligatorio para rodales con corta de bosque o poda. Diámetro mínimo 5,0 cm; no se exige premuestreo ni error de muestreo mínimo.')));
    const tabs = [['122', '12.2 Registro de parcelas'], ['123', '12.3 Análisis por rodal'], ['121', '12.1 Inventario forestal']];
    wrap.appendChild(h('div', { class: 'tabs' }, tabs.map(([k, t]) => h('button', { class: 'tab' + (tab === k ? ' on' : ''), onclick: () => { tab = k; rerender(); } }, t))));
    const body = h('div', { id: 'inv-body' });
    if (tab === '122') body.appendChild(h('section', { class: 'card' }, h('h2', null, '12.2 Planilla de registro de parcelas'), render122()));
    else if (tab === '123') body.appendChild(render123());
    else body.appendChild(render121());
    wrap.appendChild(body);
    return wrap;
  }
  function rerender() { if (currentView === '12') { const sc = $('#main').scrollTop; App.go('12'); $('#main').scrollTop = sc; } }

  /* ------------------------- impresión ------------------------- */
  function imprimirRodal(rod) {
    const r = resultado(rod); if (!r) { toast('Complete la configuración del rodal.', 'warn'); return; }
    const c = cfg(rod);
    const ficha = h('table', { class: 'pfields' }, h('tbody', null,
      [['Rodal', rod], ['Superficie rodal', c.sup ? fmt(num(c.sup), 2) + ' ha' : ''], ['Tipo forestal', c.tf], ['Subtipo', c.stf], ['Estructura', c.est], ['Estado de desarrollo', r.edd], ['Muestreo', c.muestreo], ['Parcelas (n)', r.n], [r.bit ? 'FAB' : 'Superficie (m²)', c.tam], ['Forma', r.bit ? 'Relascópica' : c.forma], ['Fecha muestreo', fechaLarga(c.fecha)]]
        .map(([a, b]) => h('tr', null, h('th', null, a), h('td', null, b == null ? '' : String(b))))));
    Print.custom('12.3 Análisis cuantitativo de la intervención inmediata – Rodal ' + rod, h('div', { class: 'p123' }, ficha, analisis(r, c)));
  }
  function printResumen() {
    const res = rodalesInv().map(resultado).filter(Boolean);
    const box = h('div');
    box.appendChild(h('h3', null, '12.1.1 Características generales del inventario'));
    box.appendChild(h('table', { class: 'ptbl' }, h('thead', null, h('tr', null, ['Rodal', 'Tipo de muestreo', 'Forma', 'Tamaño (m²)/FAB'].map(x => h('th', null, x)))), h('tbody', null, rodalesInv().map(rd => { const c = cfg(rd); return h('tr', null, h('td', null, rd), h('td', null, c.muestreo || ''), h('td', null, c.muestreo === 'Bitterlich' ? 'Relascópica' : c.forma || ''), h('td', null, c.tam || '')); }))));
    box.appendChild(h('div', { class: 'ptext' }, h('b', null, 'Justificación'), h('p', null, App.f('c1211') || '—')));
    box.appendChild(h('h3', null, '12.1.2 Coordenadas UTM de parcelas de muestreo y parámetros parciales'));
    box.appendChild(h('table', { class: 'ptbl' }, h('thead', null, h('tr', null, ['Rodal', 'Parcela', 'Huso', 'Este (m)', 'Norte (m)', 'Densidad', 'Área basal (m²/ha)'].map(x => h('th', null, x)))),
      h('tbody', null, res.flatMap(r => r.P.map(p => { const co = S.coord[r.rod + '|' + p.parc] || {}; return h('tr', null, h('td', null, r.rod), h('td', null, p.parc), h('td', null, co.huso || S.f.pm_huso || ''), h('td', null, co.este || ''), h('td', null, co.norte || ''), h('td', null, n0(p.AU)), h('td', null, n2(p.AY))); })))));
    box.appendChild(h('div', { class: 'ptext' }, h('b', null, 'Identificación de parcelas en terreno'), h('p', null, App.f('c1212') || '—')));
    box.appendChild(h('h3', null, '12.1.3 Funciones de volumen o biomasa utilizadas'));
    box.appendChild(h('table', { class: 'ptbl' }, h('thead', null, h('tr', null, ['Especie', 'Altura (m)', 'Expresión', 'Fuente', 'Año'].map(x => h('th', null, x)))), h('tbody', null, Object.entries(S.vol).filter(([k, v]) => v.expr).map(([k, v]) => h('tr', null, h('td', null, k), h('td', null, v.h || ''), h('td', null, v.expr), h('td', null, v.fte || ''), h('td', null, v.anio || ''))))));
    box.appendChild(h('h3', null, '12.1.4 Resumen del inventario'));
    box.appendChild(h('table', { class: 'ptbl' }, h('thead', null, h('tr', null, ['Rodal', 'n', 't', 'Media N/ha', 'Media G/ha', 'Var N', 'Var G', 'CV N', 'CV G', 'E% N', 'E% G'].map(x => h('th', null, x)))),
      h('tbody', null, res.map(r => h('tr', null, [r.rod, r.n, fmt(r.est.nIni.t, 3), n0(r.est.nIni.media), n2(r.est.gIni.media), n0(r.est.nIni.var), n2(r.est.gIni.var), pct(r.est.nIni.cv), pct(r.est.gIni.cv), pct(r.est.nIni.e), pct(r.est.gIni.e)].map(v => h('td', null, String(v))))))));
    box.appendChild(h('h3', null, '12.1.5 Intensidad de la intervención inmediata'));
    const t = tabla125(res).querySelector('table'); t.className = 'ptbl'; box.appendChild(t);
    box.appendChild(h('p', { class: 'pnote' }, '12.2 Registro de parcelas: se entrega sólo en formato Excel. 12.3 Análisis cuantitativo: se entrega en PDF por rodal.'));
    return box;
  }

  return { render, resultado, invalidate, render72, render742, estadoFinal, exportXlsx, rodalesInv, printResumen, calcular, imprimirRodal };
})();
