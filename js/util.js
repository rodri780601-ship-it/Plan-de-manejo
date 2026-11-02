/* ==========================================================================
   Utilidades generales: DOM, formato, estadística, expresiones, ZIP, XLSX, PDF
   Sin dependencias externas.
   ========================================================================== */
'use strict';

/* ---------- DOM ---------- */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'list' && k !== 'form') { try { el[k] = v; } catch (e) { el.setAttribute(k, v); } }
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function uid() { return Math.random().toString(36).slice(2, 10); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }

/* ---------- Formato numérico (es-CL) ---------- */
function num(v) {
  if (v == null || v === '') return NaN;
  if (typeof v === 'number') return v;
  let s = String(v).trim().replace(/\s/g, '');
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}
function isNum(v) { return !isNaN(num(v)); }
function fmt(v, dec = 2, opts = {}) {
  const n = typeof v === 'number' ? v : num(v);
  if (!isFinite(n)) return opts.blank != null ? opts.blank : '';
  return n.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtPct(v, dec = 1) { return isFinite(v) ? fmt(v * 100, dec) + ' %' : ''; }
function round(v, d = 2) { const p = Math.pow(10, d); return Math.round(v * p) / p; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function hoy() { const d = new Date(); return d.toISOString().slice(0, 10); }
function fechaLarga(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${d} de ${meses[m - 1]} de ${y}`;
}

/* ---------- RUT chileno ---------- */
function rutDV(rut) {
  let s = String(rut || '').replace(/\./g, '').split('-')[0].replace(/\D/g, '');
  if (!s) return '';
  let suma = 0, m = 2;
  for (let i = s.length - 1; i >= 0; i--) { suma += Number(s[i]) * m; m = m === 7 ? 2 : m + 1; }
  const dv = 11 - (suma % 11);
  return dv === 11 ? '0' : dv === 10 ? 'K' : String(dv);
}
function rutFmt(rut) {
  const s = String(rut || '').replace(/\./g, '').split('-')[0].replace(/\D/g, '');
  if (!s) return '';
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + rutDV(s);
}

/* ---------- Estadística ---------- */
const Stat = {
  mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN; },
  variance(a) { if (a.length < 2) return NaN; const m = Stat.mean(a); return a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1); },
  sd(a) { return Math.sqrt(Stat.variance(a)); },
  lgamma(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  },
  betacf(a, b, x) {
    const MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300;
    let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let hh = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; hh *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
      const del = d * c; hh *= del; if (Math.abs(del - 1) < EPS) break;
    }
    return hh;
  },
  ibeta(x, a, b) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(Stat.lgamma(a + b) - Stat.lgamma(a) - Stat.lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * Stat.betacf(a, b, x) / a : 1 - bt * Stat.betacf(b, a, 1 - x) / b;
  },
  /** Equivalente a INV.T.2C / T.INV.2T de Excel */
  tinv2(p, df) {
    if (!(df >= 1)) return NaN;
    const two = t => Stat.ibeta(df / (df + t * t), df / 2, 0.5);
    let lo = 0, hi = 1e4;
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (two(mid) > p) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  },
  /** INTERVALO.CONFIANZA.NORM(0,05; sd; n) */
  confNorm(sd, n) { return 1.959963984540054 * sd / Math.sqrt(n); }
};

/* ---------- Evaluador de expresiones tipo Excel (funciones de volumen) ---------- */
const Expr = {
  compile(src) {
    if (src == null) throw new Error('Expresión vacía');
    let s = String(src).trim().replace(/^=/, '');
    if (!s) throw new Error('Expresión vacía');
    const semi = s.includes(';');
    const toks = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.,]/.test(c) && !(c === ',' && !semi)) {
        let j = i; while (j < s.length && /[0-9.,eE]/.test(s[j])) {
          if ((s[j] === 'e' || s[j] === 'E') && /[+-]/.test(s[j + 1])) j++;
          if (s[j] === ',' && !semi) break; j++;
        }
        let t = s.slice(i, j); if (semi) t = t.replace(/\./g, '').replace(',', '.');
        toks.push({ t: 'n', v: parseFloat(t) }); i = j; continue;
      }
      if (/[A-Za-zÁÉÍÓÚáéíóúÑñ_]/.test(c)) {
        let j = i; while (j < s.length && /[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ_.]/.test(s[j])) j++;
        toks.push({ t: 'id', v: s.slice(i, j).toUpperCase() }); i = j; continue;
      }
      if ('+-*/^()'.includes(c)) { toks.push({ t: c }); i++; continue; }
      if (c === ';' || c === ',') { toks.push({ t: ',' }); i++; continue; }
      throw new Error('Carácter no válido: ' + c);
    }
    let p = 0;
    const peek = () => toks[p], next = () => toks[p++];
    const expect = t => { const k = next(); if (!k || k.t !== t) throw new Error('Se esperaba ' + t); };
    const F = {
      LN: Math.log, LOG10: Math.log10, EXP: Math.exp, SQRT: Math.sqrt, RAIZ: Math.sqrt, ABS: Math.abs,
      LOG: (x, b) => b == null ? Math.log10(x) : Math.log(x) / Math.log(b),
      POWER: Math.pow, POTENCIA: Math.pow, PI: () => Math.PI, EXP10: x => Math.pow(10, x),
      MIN: Math.min, MAX: Math.max, ROUND: (x, d) => round(x, d || 0), REDONDEAR: (x, d) => round(x, d || 0)
    };
    const VARS = { DAP: 'd', DAT: 'd', D: 'd', DMC: 'd', H: 'h', HT: 'h', ALTURA: 'h' };
    function prim() {
      const k = next();
      if (!k) throw new Error('Expresión incompleta');
      if (k.t === 'n') return () => k.v;
      if (k.t === '(') { const e = add(); expect(')'); return e; }
      if (k.t === '-') { const e = prim(); return v => -e(v); }
      if (k.t === '+') return prim();
      if (k.t === 'id') {
        if (peek() && peek().t === '(') {
          next(); const fn = F[k.v]; if (!fn) throw new Error('Función desconocida: ' + k.v);
          const args = [];
          if (peek() && peek().t !== ')') { args.push(add()); while (peek() && peek().t === ',') { next(); args.push(add()); } }
          expect(')');
          return v => fn(...args.map(a => a(v)));
        }
        if (k.v === 'PI') return () => Math.PI;
        const vn = VARS[k.v]; if (!vn) throw new Error('Variable desconocida: ' + k.v + ' (use DAP, DAT o H)');
        return v => v[vn];
      }
      throw new Error('Símbolo inesperado');
    }
    function pow() { let a = prim(); while (peek() && peek().t === '^') { next(); const b = prim(); const x = a; a = v => Math.pow(x(v), b(v)); } return a; }
    function mul() { let a = pow(); while (peek() && (peek().t === '*' || peek().t === '/')) { const op = next().t, b = pow(), x = a; a = op === '*' ? v => x(v) * b(v) : v => x(v) / b(v); } return a; }
    function add() { let a = mul(); while (peek() && (peek().t === '+' || peek().t === '-')) { const op = next().t, b = mul(), x = a; a = op === '+' ? v => x(v) + b(v) : v => x(v) - b(v); } return a; }
    const f = add();
    if (p < toks.length) throw new Error('Sobran símbolos al final');
    return (d, h) => f({ d, h });
  }
};

/* ---------- CRC32 / ZIP ---------- */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
const enc = new TextEncoder();
function toU8(d) { return d instanceof Uint8Array ? d : d instanceof ArrayBuffer ? new Uint8Array(d) : enc.encode(String(d)); }

const Zip = {
  /** files: [{name, data}] -> Blob (método STORE, compatible con cualquier descompresor) */
  build(files) {
    const parts = [], central = []; let offset = 0;
    const now = new Date();
    const dtime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const ddate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const f of files) {
      const name = enc.encode(f.name), data = toU8(f.data), crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dtime, true); lh.setUint16(12, ddate, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dtime, true); ch.setUint16(14, ddate, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const csize = central.reduce((s, x) => s + x.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  },
  /** Lee un ZIP (ArrayBuffer) -> {nombre: Uint8Array} */
  async read(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf);
    let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('Archivo ZIP no válido');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
    const out = {};
    for (let i = 0; i < n; i++) {
      const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      const nameBytes = u8.subarray(p + 46, p + 46 + nl);
      const name = (flags & 0x800) ? new TextDecoder('utf-8').decode(nameBytes) : new TextDecoder('ibm866').decode(nameBytes);
      p += 46 + nl + xl + cl;
      const lnl = dv.getUint16(lo + 26, true), lxl = dv.getUint16(lo + 28, true);
      const data = u8.subarray(lo + 30 + lnl + lxl, lo + 30 + lnl + lxl + csize);
      if (name.endsWith('/')) continue;
      if (method === 0) out[name] = data.slice();
      else if (method === 8) out[name] = await Zip.inflate(data);
      else throw new Error('Método de compresión no soportado en ' + name);
    }
    return out;
  },
  async inflate(data) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Su navegador no soporta descompresión ZIP; actualícelo.');
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([data]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
};

/* ---------- Descargas ---------- */
function download(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'application/octet-stream' });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
function readFile(file, as = 'arraybuffer') {
  return new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej;
    if (as === 'text') r.readAsText(file); else if (as === 'dataurl') r.readAsDataURL(file); else r.readAsArrayBuffer(file);
  });
}
function safeName(s, max = 60) {
  return String(s || 'Predio').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
    .replace(/[^A-Za-z0-9_-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, max) || 'Predio';
}

/* ---------- XLSX mínimo (lectura y escritura) ---------- */
const Xlsx = {
  colName(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; },
  colIndex(s) { let n = 0; for (const c of s) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; },
  /** sheets: [{name, rows:[[...]]}] -> Blob */
  write(sheets) {
    const x = s => esc(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    const files = [];
    files.push({ name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' + sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' });
    files.push({ name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' });
    files.push({ name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map((s, i) => `<sheet name="${x(s.name).slice(0, 31)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>' });
    files.push({ name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` });
    files.push({ name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>' });
    sheets.forEach((s, si) => {
      const rows = s.rows.map((r, ri) => `<row r="${ri + 1}">` + r.map((v, ci) => {
        const ref = Xlsx.colName(ci) + (ri + 1), st = ri === 0 && s.header !== false ? ' s="1"' : '';
        if (v == null || v === '') return '';
        if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
        return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${x(v)}</t></is></c>`;
      }).join('') + '</row>').join('');
      files.push({ name: `xl/worksheets/sheet${si + 1}.xml`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>` });
    });
    return new Blob([Zip.build(files)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  },
  /** Lee la primera hoja (o la indicada) -> matriz de valores */
  async read(buf, sheetIndex = 0) {
    const files = await Zip.read(buf), dec = new TextDecoder('utf-8');
    const xml = n => files[n] ? new DOMParser().parseFromString(dec.decode(files[n]), 'application/xml') : null;
    const wb = xml('xl/workbook.xml'); if (!wb) throw new Error('No es un archivo XLSX válido');
    const sheetsEl = Array.from(wb.getElementsByTagName('sheet'));
    const rels = xml('xl/_rels/workbook.xml.rels');
    const rid = sheetsEl[sheetIndex].getAttribute('r:id') || sheetsEl[sheetIndex].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    let target = Array.from(rels.getElementsByTagName('Relationship')).find(r => r.getAttribute('Id') === rid).getAttribute('Target');
    target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    const ss = [], sst = xml('xl/sharedStrings.xml');
    if (sst) for (const si of sst.getElementsByTagName('si')) ss.push(Array.from(si.getElementsByTagName('t')).map(t => t.textContent).join(''));
    const sh = xml(target), out = [];
    for (const row of sh.getElementsByTagName('row')) {
      const r = Number(row.getAttribute('r')) - 1; const arr = out[r] = out[r] || [];
      for (const c of row.getElementsByTagName('c')) {
        const ref = c.getAttribute('r'), col = Xlsx.colIndex(ref.replace(/\d+/g, '')), t = c.getAttribute('t');
        const vEl = c.getElementsByTagName('v')[0];
        let v = vEl ? vEl.textContent : null;
        if (t === 's') v = ss[Number(v)];
        else if (t === 'inlineStr') v = Array.from(c.getElementsByTagName('t')).map(x => x.textContent).join('');
        else if (t === 'b') v = v === '1';
        else if (v != null && t !== 'str') v = Number(v);
        arr[col] = v;
      }
    }
    for (let i = 0; i < out.length; i++) out[i] = out[i] || [];
    return out;
  }
};

/* ---------- PDF mínimo con imágenes JPEG (para planos y reportes) ---------- */
const Pdf = {
  /** pages: [{wmm, hmm, jpeg: dataURL}] -> Blob */
  build(pages) {
    const chunks = [], offsets = []; let pos = 0;
    const push = s => { const u = typeof s === 'string' ? enc.encode(s) : s; chunks.push(u); pos += u.length; };
    const obj = (i, body) => { offsets[i] = pos; push(`${i} 0 obj\n`); if (typeof body === 'string') push(body); else body(); push('\nendobj\n'); };
    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    const n = pages.length, pageIds = [];
    let id = 3;
    const plan = pages.map(p => { const o = { page: id++, content: id++, img: id++ }; pageIds.push(o.page); return o; });
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Kids [${pageIds.map(i => i + ' 0 R').join(' ')}] /Count ${n} >>`);
    pages.forEach((p, i) => {
      const o = plan[i], W = p.wmm * 72 / 25.4, H = p.hmm * 72 / 25.4;
      const b64 = p.jpeg.split(',')[1], bin = atob(b64), img = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k++) img[k] = bin.charCodeAt(k);
      const cs = `q ${W.toFixed(2)} 0 0 ${H.toFixed(2)} 0 0 cm /Im0 Do Q`;
      obj(o.page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Resources << /XObject << /Im0 ${o.img} 0 R >> >> /Contents ${o.content} 0 R >>`);
      obj(o.content, `<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
      obj(o.img, () => { push(`<< /Type /XObject /Subtype /Image /Width ${p.pxw} /Height ${p.pxh} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`); push(img); push('\nendstream'); });
    });
    const xref = pos, total = 3 + n * 3;
    let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
    for (let i = 1; i < total; i++) x += String(offsets[i] || 0).padStart(10, '0') + ' 00000 n \n';
    push(x + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(chunks, { type: 'application/pdf' });
  }
};

/* ---------- Notificaciones y diálogos ---------- */
function toast(msg, type = 'info', ms = 4200) {
  let box = $('#toasts'); if (!box) { box = h('div', { id: 'toasts' }); document.body.appendChild(box); }
  const t = h('div', { class: 'toast ' + type, role: 'status' }, msg);
  box.appendChild(t); setTimeout(() => t.classList.add('out'), ms); setTimeout(() => t.remove(), ms + 400);
}
function modal(title, body, buttons = [{ label: 'Cerrar' }], opts = {}) {
  return new Promise(res => {
    const close = v => { ov.remove(); res(v); };
    const ov = h('div', { class: 'modal-ov', onclick: e => { if (e.target === ov && !opts.persist) close(null); } },
      h('div', { class: 'modal' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-label': title },
        h('div', { class: 'modal-h' }, h('h3', null, title), h('button', { class: 'icon-btn', 'aria-label': 'Cerrar', onclick: () => close(null) }, '×')),
        h('div', { class: 'modal-b' }, body),
        h('div', { class: 'modal-f' }, buttons.map(b => h('button', { class: 'btn ' + (b.cls || ''), onclick: () => close(b.value !== undefined ? b.value : b.label) }, b.label)))));
    document.body.appendChild(ov);
    const f = ov.querySelector('input,select,textarea'); if (f) setTimeout(() => f.focus(), 30);
  });
}
async function confirmar(msg, ok = 'Aceptar') { return (await modal('Confirmar', h('p', null, msg), [{ label: 'Cancelar', value: false }, { label: ok, value: true, cls: 'primary' }])) === true; }
