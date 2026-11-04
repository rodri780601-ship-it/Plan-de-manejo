/* ==========================================================================
   Proyecto de ejemplo completo con datos FICTICIOS ("Fundo Los Coihues").
   Se construye en tiempo de ejecución: la cartografía se define en UTM 18S y
   se convierte con Geo; las superficies, distancias, estados de desarrollo
   y volúmenes se toman de los propios cálculos de la aplicación para que el
   ejemplo sea coherente entre capítulos.
   Ningún dato (personas, RUT, roles, resoluciones, coordenadas) es real.
   ========================================================================== */
'use strict';

(function () {
  const ZONA = 18;
  const pk = (key, v) => { if (!(CAT.L[key] || []).includes(v)) console.warn('Ejemplo: valor fuera de lista', key, v); return v; };
  const rows = arr => arr.map(r => Object.assign({ _id: uid() }, r));
  const iso = d => d.toISOString().slice(0, 10);
  const r1 = x => Math.round(x * 10) / 10;

  function prng(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  /* ------------------------- geometrías en UTM 18S ------------------------- */
  const rect = (e1, n1, e2, n2) => ({ type: 'Polygon', coordinates: [[[e1, n1], [e2, n1], [e2, n2], [e1, n2], [e1, n1]]] });
  const line = pts => ({ type: 'LineString', coordinates: pts });
  const pt = (e, n) => ({ type: 'Point', coordinates: [e, n] });

  const G = {
    predio: rect(727000, 5596000, 728000, 5596800),
    r1: rect(727100, 5596150, 727600, 5596550),   // 20 ha
    r2: rect(727650, 5596100, 727950, 5596600),   // 15 ha
    r3: rect(727100, 5596600, 727500, 5596750),   //  6 ha
    estero: line([[727640, 5596100], [727615, 5596250], [727625, 5596450], [727610, 5596650], [727640, 5596800]]),
    humedal: rect(727750, 5596650, 727850, 5596750),
    zonaProt: rect(727605, 5596100, 727655, 5596800),
    camino1: line([[727050, 5595900], [727050, 5596050], [727800, 5596050]]),
    camino2: line([[727050, 5596050], [727050, 5596750]]),
    caminoProy: line([[727050, 5596350], [727300, 5596350]]),
    viaR2: line([[727700, 5596050], [727700, 5596100]]),
    cancha: pt(727070, 5596330),
    casa: pt(727130, 5596070),
    galpon: pt(727190, 5596075),
    cortaf1: line([[727090, 5596150], [727090, 5596550]]),
    cortaf2: line([[727100, 5596770], [727400, 5596770]]),
    cerco: line([[727090, 5596590], [727510, 5596590], [727510, 5596760], [727090, 5596760]]),
    zanja: line([[727150, 5596680], [727450, 5596680]]),
    area: rect(727150, 5596620, 727450, 5596730),
    sendero: line([[727120, 5596640], [727250, 5596660], [727380, 5596700], [727480, 5596720]]),
    letrero: pt(727120, 5596640),
    estacion: pt(727380, 5596700),
    michay: pt(727560, 5596640),
    alerce: pt(727020, 5596420)
  };
  const ref = {
    acceso: [727050, 5596000], infra: [727130, 5596070], rodal: [727100, 5596350], otra: [727640, 5596100]
  };

  /* Parcelas: grilla de 100 m dentro de cada rodal */
  function gridParcelas(rod, e0, n0, nx, ny) {
    const out = []; let k = 1;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) out.push({ rod, parc: k++, e: e0 + 100 * i, n: n0 + 100 * j });
    return out;
  }
  const PARC = gridParcelas('1', 727150, 5596250, 5, 2).concat(gridParcelas('2', 727730, 5596200, 2, 4));

  /* ------------------------- inventario sintético ------------------------- */
  const MIX = {
    '1': [['Nothofagus obliqua', .45], ['Nothofagus alpina', .25], ['Nothofagus dombeyi', .20], ['Laurelia sempervirens', .05], ['Persea lingue', .05]],
    '2': [['Nothofagus dombeyi', .25], ['Eucryphia cordifolia', .20], ['Laurelia sempervirens', .15], ['Aextoxicon punctatum', .15], ['Persea lingue', .08], ['Weinmannia trichosperma', .07], ['Drimys winteri', .05], ['Amomyrtus luma', .05]]
  };
  const ALT = { 'Nothofagus obliqua': 22, 'Nothofagus alpina': 22, 'Nothofagus dombeyi': 24, 'Laurelia sempervirens': 18, 'Persea lingue': 16, 'Eucryphia cordifolia': 20, 'Aextoxicon punctatum': 16, 'Weinmannia trichosperma': 20, 'Drimys winteri': 12, 'Amomyrtus luma': 10 };

  function inventario() {
    const rnd = prng(20260101), out = [];
    const pickSp = mix => { let u = rnd(), a = 0; for (const [sp, p] of mix) { a += p; if (u <= a) return sp; } return mix[0][0]; };
    for (const p of PARC) {
      const reg = p.rod === '1';
      const n = Math.round((reg ? 52 : 40) + (rnd() - .5) * (reg ? 20 : 16));
      for (let i = 0; i < n; i++) {
        const sp = pickSp(MIX[p.rod]);
        const d = Math.min(reg ? 60 : 90, 8 + (-Math.log(1 - rnd())) * (reg ? 12 : 14));
        let m = 'P';
        if (reg) m = d < 18 ? (rnd() < .55 ? 'X' : 'P') : (d >= 24 && sp !== 'Laurelia sempervirens' && rnd() < .30 ? 'F' : (rnd() < .15 ? 'X' : 'P'));
        else m = rnd() < .16 ? 'X' : (d >= 40 && rnd() < .35 ? 'F' : 'P');
        out.push([p.rod, String(p.parc), sp, d.toFixed(1), m]);
      }
    }
    return out;
  }

  /* ------------------------- construcción del estado ------------------------- */
  function construir() {
    const y0 = new Date().getFullYear(), hoyIso = iso(new Date());
    const PROY = 'FC-2025-0456';
    const A = (g) => Geo.area(g), L_ = (g) => Geo.length(g);
    const dist = (a, b) => Geo.distance(a, b);

    for (const k of Object.keys(S)) delete S[k];
    Object.assign(S, nuevoEstado());
    S.modo = 'ambas';
    ['sol3', 'sol4', 'c3', 'c743', 'c75', 'c81', 'c82', 'c83', 'c841', 'c842', 'c85', 'c86', 'c91', 'c92', 'c101', 'c102'].forEach(k => S.opt[k] = true);

    const f = S.f, T = S.t;
    const sup = g => A(g) / 10000;

    /* ---------------- Solicitud ---------------- */
    f.sol_incendio = 'No'; f.sol_cup = 'CUP-2026-000123';
    T.sol_int = rows([
      { nombre: 'Carlos Andrés Muñoz Fuentealba', rut: '12345678', calidad: pk('Propietario_1', 'Propietario/a'), tipo: 'PPF', genero: 'Masculino', etnia: 'No aplica', domicilio: 'Camino a Coñaripe km 12, Panguipulli', ciudad: 'Panguipulli', email: 'cmunoz@ejemplo.cl', fono: '+56 9 5555 0101' },
      { nombre: 'Rosa Elena Fuentealba Painemal', rut: '8765432', calidad: pk('Propietario_1', 'Propietario/a'), tipo: 'PPF', genero: 'Femenino', etnia: 'Mapuche', domicilio: 'Camino a Coñaripe km 12, Panguipulli', ciudad: 'Panguipulli', email: 'rfuentealba@ejemplo.cl', fono: '+56 9 5555 0102' }
    ]);
    f.rl_nombre = 'Marcela Paz Muñoz Fuentealba'; f.rl_rut = '16543210'; f.rl_dom = 'Calle Etchegaray 123, oficina 4'; f.rl_ciudad = 'Panguipulli'; f.rl_email = 'mmunoz@ejemplo.cl'; f.rl_fono = '+56 9 5555 0103';
    f.ce_nombre = 'Sociedad Agrícola y Forestal Los Coihues Ltda.'; f.ce_rut = '76123456'; f.ce_dom = 'Av. O\'Higgins 456'; f.ce_ciudad = 'Valdivia'; f.ce_email = 'contacto@loscoihues.ejemplo.cl'; f.ce_fono = '+56 63 255 0100';
    f.pr_nombre = 'Fundo Los Coihues'; f.pr_difrol = 'no'; f.pr_fojas = '1234 vta.'; f.pr_num = '987'; f.pr_anio = '2012'; f.pr_cbr = 'Panguipulli';
    f.pr_cert = ''; f.pr_certf = '';
    T.sol_rol = rows([{ rol: '00123-00045', comuna: 'Panguipulli' }]);
    f.pr_suptotal = sup(G.predio).toFixed(2);
    f.sol_fecha = hoyIso; f.sol_ciudad = 'Panguipulli';

    /* ---------------- Cap. 1 ---------------- */
    f.pm_suptitulo = sup(G.predio).toFixed(2); f.pm_supet = sup(G.predio).toFixed(2); f.pm_huso = String(ZONA);
    const rf = (lab, desc, c) => ({ ref: lab, desc, este: String(c[0]), norte: String(c[1]) });
    T.c1_ref = rows([
      rf('Acceso predial', 'Portón principal en camino Panguipulli–Coñaripe, km 12', ref.acceso),
      rf('Infraestructura', 'Casa patronal y galpón', ref.infra),
      rf('Acceso rodal', 'Entrada al rodal 1 desde camino interno', ref.rodal),
      rf('Otra', 'Vertiente de origen del estero El Canelo', ref.otra)
    ]);
    f.c1_vias = 'Desde Panguipulli se toma el camino a Coñaripe (ruta pavimentada) por 12 km hasta el portón del fundo, a mano derecha. Desde ahí un camino interno de ripio recorre el borde poniente del predio y llega a los rodales 1 y 3; el rodal 2 se alcanza por una vía de ingreso desde el camino interior sur. Contacto para acceso al predio: Manuel Soto (capataz), +56 9 5555 0110.';

    /* ---------------- Cap. 2 / 3 ---------------- */
    f.au_nombre = 'Camila Fernanda Soto Alarcón'; f.au_rut = '15678901'; f.au_prof = pk('Autor', 'Ingeniero Forestal');
    f.au_dir = 'Calle Pedro de Valdivia 789, of. 12, Valdivia'; f.au_email = 'csoto@consultora.ejemplo.cl'; f.au_fono = '+56 9 5555 0120';
    T.c3_proy = rows([{ id: PROY, anio: '2025', literal: pk('Literal', 'b'), concurso: 'Pequeños propietarios forestales' }]);
    f.c3_obs = 'Proyecto adjudicado para actividades de manejo en los rodales 1 y 3 del predio (datos de ejemplo).';
    f.c3_just = 'El Plan de Manejo incorpora el rodal 2 (15 ha), no considerado en el proyecto adjudicado, para dar continuidad al manejo de la unidad. Las actividades de los rodales 1 y 3 coinciden con las del proyecto.';

    /* ---------------- Cap. 4 ---------------- */
    f.c41 = 'El Fundo Los Coihues se ubica en la precordillera de la comuna de Panguipulli, a 12 km del pueblo, en un paisaje de bosque nativo secundario de la Cordillera de los Andes, rodeado por predios con uso agrícola-ganadero y plantaciones. El estero El Canelo, que nace en una vertiente dentro del predio, abastece de agua a dos familias aguas abajo. No hay líneas de alta tensión ni gasoductos en el predio; una línea de media tensión (23 kV) bordea el límite oriente. El predio no colinda con áreas del SNASPE; el Parque Nacional Villarrica se encuentra a más de 20 km.';
    const dMin = g => Math.min(...['r1', 'r2', 'r3'].map(k => dist(G[k], g)));
    T.t421 = rows([
      { sp: 'Berberidopsis corallina (michay rojo)', dist: String(r1(dMin(G.michay))) },
      { sp: 'Fitzroya cupressoides (alerce)', dist: String(r1(dMin(G.alerce))) }
    ]);
    f.c421_buf = 'Se definió un área buffer de 20 m de radio alrededor de cada individuo en categoría de conservación, dentro de la cual no se realizarán intervenciones, tránsito de maquinaria ni acopio de productos. Cada ejemplar se señalizará en terreno con cinta y estaca.';
    f.c421_obs = 'Los individuos se georreferenciaron con GPS de mano (error ±5 m) durante el recorrido del predio.';
    T.t422 = rows([
      { sp: 'Pudu pudu (pudú)', ref: pk('Fuente_Fauna', 'Observación directa'), pres: pk('Permanencia', 'Permanente') },
      { sp: 'Dromiciops gliroides (monito del monte)', ref: pk('Fuente_Fauna', 'Bibliografía'), pres: pk('Permanencia', 'Permanente') },
      { sp: 'Leopardus guigna (güiña)', ref: pk('Fuente_Fauna', 'Terceros'), pres: pk('Permanencia', 'Estacional') },
      { sp: 'Campephilus magellanicus (carpintero negro)', ref: pk('Fuente_Fauna', 'Observación directa'), pres: pk('Permanencia', 'Permanente') }
    ]);
    f.c422_obs = 'Se observaron huellas y fecas de pudú en el rodal 2, y cavidades de alimentación de carpintero negro en árboles muertos en pie. Se conservarán los árboles con cavidades y los individuos senescentes que no representen riesgo.';

    /* ---------------- Cap. 5 ---------------- */
    const TF = { '1': 'Roble - Raulí - Coigüe', '2': 'Siempreverde', '3': 'Siempreverde' };
    const STF = { '1': 'Renoval y bosque puro secundario', '2': 'De Tolerantes', '3': 'Con Intolerantes Emergentes' };
    const geomR = { '1': G.r1, '2': G.r2, '3': G.r3 };
    T.t511 = rows([
      { rodal: '1', sup: sup(G.r1).toFixed(2), tf: pk('Tipo_Forestal', TF['1']), stf: STF['1'], est: pk('Estructura', 'Regular'), estr: pk('Estratos', 'Uniestratificado'), edd: [], cont: pk('Continuidad', 'Homogénea') },
      { rodal: '2', sup: sup(G.r2).toFixed(2), tf: pk('Tipo_Forestal', TF['2']), stf: STF['2'], est: pk('Estructura', 'Irregular'), estr: pk('Estratos', 'Multiestratificado'), edd: ['No aplica'], cont: pk('Continuidad', 'Heterogénea') },
      { rodal: '3', sup: sup(G.r3).toFixed(2), tf: pk('Tipo_Forestal', TF['3']), stf: STF['3'], est: pk('Estructura', 'Irregular'), estr: pk('Estratos', 'Biestratificado'), edd: ['No aplica'], cont: pk('Continuidad', 'Claros pequeños') }
    ]);
    f.c511_obs = 'Los rodales se delimitaron sobre ortofoto y recorrido de terreno según tipo forestal, estructura y estado de desarrollo. El rodal 1 es un renoval de roble-raulí-coigüe originado tras la corta de los años 80; el rodal 2 es un bosque siempreverde irregular; el rodal 3 es un bosque siempreverde con claros, destinado a recuperación y uso recreativo.';
    T.t512 = rows([
      { rodal: '1', dom: 'Nothofagus obliqua', sec: 'Nothofagus alpina', ori: pk('Origen_regeneración', 'Monte alto'), cob: pk('Cobertura_arbórea', 'Semi cerrado'), san: pk('Estado_sanitario', 'Bueno'), age: [pk('Agente', 'Ganado')] },
      { rodal: '2', dom: 'Nothofagus dombeyi', sec: 'Eucryphia cordifolia', ori: pk('Origen_regeneración', 'Monte alto'), cob: pk('Cobertura_arbórea', 'Cerrado'), san: pk('Estado_sanitario', 'Regular'), age: [pk('Agente', 'Hongos'), pk('Agente', 'Factores abióticos')] },
      { rodal: '3', dom: 'Laurelia sempervirens', sec: 'Drimys winteri', ori: pk('Origen_regeneración', 'Monte medio'), cob: pk('Cobertura_arbórea', 'Semi abierto'), san: pk('Estado_sanitario', 'Regular'), age: [pk('Agente', 'Ganado'), pk('Agente', 'Vegetación dañina')] }
    ]);
    f.c512_obs = 'La sanidad se evaluó visualmente en el recorrido de las parcelas. En el rodal 2 se observó pudrición en algunos ejemplares de gran diámetro y árboles volcados por viento.';
    T.t513 = rows([
      { rodal: '1', sp: 'Nothofagus obliqua', ab50: pk('Abundancia_relativa', 'Frecuente'), ab51: pk('Abundancia_relativa', 'Escasa'), ori: pk('Origen_regeneración', 'Monte alto'), dist: pk('Distribución', 'En mosaico') },
      { rodal: '2', sp: 'Nothofagus dombeyi', ab50: pk('Abundancia_relativa', 'Abundante'), ab51: pk('Abundancia_relativa', 'Frecuente'), ori: pk('Origen_regeneración', 'Monte alto'), dist: pk('Distribución', 'Homogénea') },
      { rodal: '3', sp: 'Drimys winteri', ab50: pk('Abundancia_relativa', 'Escasa'), ab51: pk('Abundancia_relativa', 'Escasa'), ori: pk('Origen_regeneración', 'Monte bajo'), dist: pk('Distribución', 'En mosaico') }
    ]);
    f.c513_obs = 'La regeneración se concentra en claros. Los principales factores de riesgo para su establecimiento son la competencia de quila (Chusquea quila) y el ramoneo por ganado vacuno proveniente de predios vecinos.';
    T.t514 = rows([{ rodal: '3', act: [pk('Actividad_01', 'Plantacion suplementaria (300 pl/ha)')], enr: pk('Monto_rodal', 'Parcial'), lit: pk('Literal', 'b'), monto: '12.50', res: '125', resf: '2018-06-15' }]);
    f.c514_b = 'Los rodales 1 y 2 fueron intervenidos con cortas selectivas no planificadas hasta fines de los años 80. El rodal 3 recibió una plantación suplementaria en 2018 con una prendimiento cercano al 70 %. No se registran otras intervenciones ni incendios.';
    f.c514_c = 'Sin observaciones adicionales.';

    // 5.2 hidrografía: distancias calculadas con la geometría del ejemplo
    const t52 = [];
    for (const r of ['1', '2', '3']) {
      t52.push({ rodal: r, nom: 'Estero El Canelo', tipo: pk('H2O', 'Estero'), temp: pk('Temporalidad', 'Permanente'), ubi: pk('Ubicación', 'Fuera'), dist: String(r1(dist(geomR[r], G.estero))), afl: 'Río Enco', sec: pk('Sección', CAT.L['Sección'][2]) });
    }
    for (const r of ['2', '3']) {
      t52.push({ rodal: r, nom: 'Vega El Canelo', tipo: pk('H2O', 'Humedal'), temp: pk('Temporalidad', 'Permanente'), ubi: pk('Ubicación', 'Fuera'), dist: String(r1(dist(geomR[r], G.humedal))), afl: '', sec: '' });
    }
    T.t52 = rows(t52);
    f.c52_obs = 'Las distancias se calcularon con la cartografía digital. Los tres rodales están a menos de 200 m del estero, por lo que se clasifican como bosque nativo de conservación y protección y se aplican las zonas de protección del D.S. N° 82/2010.';

    const pend = CAT.L.Pendiente;
    T.t531 = rows([
      { rodal: '1', alt: '440', rel: pk('Posición_fisiográfica', 'Ladera media'), exp: pk('Exposición', 'SW'), pend: pend[0] },
      { rodal: '2', alt: '470', rel: pk('Posición_fisiográfica', 'Ladera superior'), exp: pk('Exposición', 'S'), pend: pend[1] },
      { rodal: '3', alt: '455', rel: pk('Posición_fisiográfica', 'Terraza'), exp: pk('Exposición', 'Sin exposición'), pend: pend[0] }
    ]);
    f.c531_obs = 'La pendiente del rodal 2 limita el uso de maquinaria; el madereo se hará con bueyes y huinche manual.';
    T.t532 = rows([
      { rodal: '1', tipo: pk('Tipo_suelo', 'Trumao'), tex: pk('Textura', 'Franca'), estr: pk('si_no', 'si'), cap: pk('Clase_capacidad', 'VI'), prof: '60', serie: 'Panguipulli', form: 'Franco limosa, pardo oscura', ero: pk('Erosión', '< Moderada'), fra: pk('Fragilidad', 'No') },
      { rodal: '2', tipo: pk('Tipo_suelo', 'Trumao'), tex: pk('Textura', 'Limosa'), estr: pk('si_no', 'si'), cap: pk('Clase_capacidad', 'VII'), prof: '45', serie: 'Liquiñe', form: 'Limosa, pardo oscura', ero: pk('Erosión', 'Moderada'), fra: pk('Fragilidad', 'a)') },
      { rodal: '3', tipo: pk('Tipo_suelo', 'Trumao'), tex: pk('Textura', 'Franca'), estr: pk('si_no', 'si'), cap: pk('Clase_capacidad', 'VI'), prof: '80', serie: 'Panguipulli', form: 'Franco limosa, pardo oscura', ero: pk('Erosión', '< Moderada'), fra: pk('Fragilidad', 'No') }
    ]);
    f.c532_obs = 'Suelos de origen volcánico, profundos y bien drenados. Se evaluó la profundidad efectiva con calicatas de 1 m en cada rodal. El rodal 2 presenta fragilidad por pendiente superior al 15 %.';
    T.t541 = rows([
      { rodal: '1', pd: '850', pn: 'Sector Los Laureles', rd: '600', rn: 'Camping Río Enco' },
      { rodal: '2', pd: '', pn: '', rd: '', rn: '' },
      { rodal: '3', pd: '900', pn: 'Sector Los Laureles', rd: '', rn: '' }
    ]);
    f.c541_obs = 'Cerca del predio hay un camping familiar de temporada y viviendas rurales dispersas. No se esperan molestias por las faenas, que se coordinarán con los vecinos.';
    const dInfra = r => Math.min(dist(geomR[r], G.casa), dist(geomR[r], G.galpon));
    T.t542 = rows([
      { rodal: '1', nom: 'Casa patronal y galpón del fundo', dist: String(Math.round(dInfra('1'))) },
      { rodal: '2', nom: 'Línea eléctrica de media tensión 23 kV', dist: '120' }
    ]);
    f.c542_obs = 'Las faenas de corta en el rodal 1 se realizarán con dirección de caída hacia el interior del rodal y alejada de la infraestructura.';
    T.t55 = rows([
      { rods: ['2'], fac: [pk('Restricciones_medio', 'Topografía'), pk('Restricciones_medio', 'Hidrografía')], desc: 'Pendiente de 30 a 45 % y cercanía al estero El Canelo; se limita la maquinaria y se respetan las fajas de protección.' },
      { rods: ['1', '2', '3'], fac: [pk('Restricciones_medio', 'Fauna')], desc: 'Presencia de pudú y carpintero negro; se conservan árboles con cavidades y no se interviene en época reproductiva (octubre–febrero).' }
    ]);
    f.c55_obs = 'Sin otras restricciones relevantes.';

    /* ---------------- Cap. 6 / 7 ---------------- */
    T.t6 = rows([
      { obj: pk('Objetivo_de_manejo', 'Maderero'), rods: ['1'], esp: 'Mejorar la calidad y el crecimiento de los árboles de futuro de roble, raulí y coigüe mediante raleo, para producir madera aserrable de calidad en el largo plazo.' },
      { obj: pk('Objetivo_de_manejo', 'Maderero'), rods: ['2'], esp: 'Mantener la estructura irregular y favorecer la regeneración mediante cortas selectivas que extraigan árboles dominados, enfermos y de mala forma.' },
      { obj: pk('Objetivo_de_manejo', 'No maderero'), rods: ['3'], esp: 'Recuperar el bosque con claros, controlar especies exóticas, proteger la regeneración del ganado y habilitar un sendero interpretativo.' }
    ]);
    f.c6_fund = 'El predio combina producción maderera sustentable (rodales 1 y 2) con conservación de biodiversidad y uso recreativo (rodal 3). Las intervenciones son de baja intensidad y mantienen la cobertura del bosque, la protección del estero y el hábitat de fauna en categoría de conservación.';
    T.t71 = rows([
      { rods: ['1'], est: pk('Estructura01', 'Regular'), met: pk('Método_de_Manejo', 'Monte alto'), corta: pk('Método_de_Corta_y_Regeneración', 'Selectiva'), sp: 'Nothofagus obliqua, Nothofagus alpina, Nothofagus dombeyi' },
      { rods: ['2'], est: pk('Estructura01', 'Irregular'), met: pk('Método_de_Manejo', 'Monte alto'), corta: pk('Método_de_Corta_y_Regeneración', 'Selectiva'), sp: 'Nothofagus dombeyi, Eucryphia cordifolia' }
    ]);
    f.c71_a = 'Manejo de monte alto. En el rodal 1 se aplica raleo por lo bajo y selectivo sobre árboles de futuro marcados; en el rodal 2 se mantiene la estructura irregular mediante corta selectiva por grupos pequeños.';
    f.c71_b = 'Rodal 1: raleo que extrae árboles dominados, bifurcados o enfermos, liberando la copa de los árboles de futuro. Rodal 2: corta selectiva de árboles de mal estado sanitario, muertos en pie con riesgo y algunos dominantes para abrir claros de regeneración.';
    f.c71_c = 'No se utiliza otro método de corta.';
    f.c72_fund = 'No se propone cambio del estado de desarrollo de los rodales respecto del determinado por el inventario.';

    /* ---------------- Cap. 12: inventario (antes de calendarios y volúmenes) ---------------- */
    S.inv = { tipo: 'Monopódico', rows: inventario() };
    const fechaMuestreo = iso(new Date(new Date().getFullYear(), 2, 15));
    S.rod['1'] = { tf: TF['1'], stf: STF['1'], est: 'Regular', sup: sup(G.r1).toFixed(2), muestreo: 'Sistemático', forma: 'Circular', tam: '500', fecha: fechaMuestreo, dmin: 5, sp1: 'Nothofagus obliqua', sp2: 'Nothofagus alpina', sp3: 'Nothofagus dombeyi' };
    S.rod['2'] = { tf: TF['2'], stf: STF['2'], est: 'Irregular', sup: sup(G.r2).toFixed(2), muestreo: 'Sistemático', forma: 'Circular', tam: '500', fecha: fechaMuestreo, dmin: 5, sp1: 'Nothofagus dombeyi', sp2: 'Eucryphia cordifolia', sp3: 'Laurelia sempervirens' };
    for (const [sp, h] of Object.entries(ALT)) S.vol[sp] = { h: String(h), expr: '0.0000412*DAP^1.95*H^0.92', fte: 'Función ficticia de ejemplo (no usar en proyectos reales)', anio: '2026' };
    for (const p of PARC) S.coord[p.rod + '|' + p.parc] = { huso: String(ZONA), este: String(p.e), norte: String(p.n) };
    Inv.invalidate();

    const res = { '1': Inv.resultado('1'), '2': Inv.resultado('2') };
    const eddCat = e => (CAT.L.Estado_DD.find(x => x.toLowerCase() === String(e).toLowerCase()) || e);
    if (res['1'] && res['1'].edd && res['1'].edd !== 'No aplica') T.t511[0].edd = [eddCat(res['1'].edd)];
    const gFin = r => res[r] ? round(res[r].tot.gFin, 2) : '';
    const volExt = r => res[r] ? Math.max(10, Math.round((res[r].tot.vIni - res[r].tot.vFin) * num(S.rod[r].sup) / 10) * 10) : 100;
    f.c1211 = 'Muestreo sistemático con parcelas circulares de 500 m² distribuidas en una grilla de 100 m dentro de cada rodal (10 parcelas en el rodal 1 y 8 en el rodal 2), con diámetro mínimo de registro de 5 cm. El tamaño y número de parcelas permiten cubrir la variabilidad del rodal y cumplen el diámetro mínimo exigido.';
    f.c1212 = 'Las parcelas se identificaron en terreno con estaca numerada y cinta y se georreferenciaron con GPS de mano. Los árboles a extraer se marcaron con pintura en el fuste (X), los de futuro con cinta (F) y el resto permanece (P). Datos ficticios generados para este ejemplo.';

    /* ---------------- Cap. 7 (continuación) ---------------- */
    T.t731 = rows([
      { rodal: '1', act: pk('Actividad', 'Raleo latizal alto'), ini: String(y0 + 1), fin: String(y0 + 2), conc: PROY },
      { rodal: '1', act: pk('Actividad', 'Poda latizal alto'), ini: String(y0 + 2), fin: String(y0 + 3), conc: PROY },
      { rodal: '2', act: pk('Actividad', 'Corta para bosques irregulares'), ini: String(y0 + 1), fin: String(y0 + 3), conc: '' }
    ]);
    f.c731_obs = 'Las faenas se programan fuera de la temporada de nidificación y reproducción de fauna (octubre–febrero) y en meses de suelo seco.';
    T.t732 = rows([
      { rodal: '1', act: pk('Actividad_01', 'Raleo latizal alto'), par: pk('Parámetro', 'Área basal'), val: String(gFin('1')), uni: pk('Unidad2', 'm²/ha'), anio: String(y0 + 2) },
      { rodal: '2', act: pk('Actividad_01', 'Corta para bosques irregulares'), par: pk('Parámetro', 'Área basal'), val: String(gFin('2')), uni: pk('Unidad2', 'm²/ha'), anio: String(y0 + 3) }
    ]);
    f.c732_obs = 'El valor corresponde al área basal residual esperada según el inventario.';
    const intens = r => res[r] ? Math.round((1 - res[r].tot.gFin / res[r].tot.gIni) * 100) : 0;
    f.c741_a = `Rodal 1: raleo selectivo que extrae cerca del ${intens('1')} % del área basal inicial, por lo bajo, sobre árboles marcados. Rodal 2: corta selectiva de baja intensidad (cerca del ${intens('2')} % del área basal) sobre árboles marcados.`;
    f.c741_b = 'Se dejan los árboles de futuro (buena forma, copa bien desarrollada y sin daños), una distribución espacial uniforme y todos los ejemplares de especies en categoría de conservación. En el rodal 2 se conservan árboles con cavidades y de gran diámetro.';
    f.c741_c = 'Los árboles a extraer se marcan con pintura roja a la altura del pecho y con una marca en la base; los árboles de futuro se marcan con cinta azul.';
    f.c741_d = 'En las franjas de protección del estero y la vega no se realizan cortas; las faenas en bosque de conservación y protección se hacen con baja intensidad, caída dirigida y madereo con bueyes, evitando el cruce de cursos de agua.';
    S.c742['1'] = CAT.L.Coberturas[4]; S.c742['2'] = CAT.L.Coberturas[3];
    f.c742_obs = 'La cobertura residual se estimó en terreno con densiómetro esférico en las parcelas de muestreo.';
    T.t743 = rows([{ rodal: '2', ini: String(y0 + 2), fin: String(y0 + 4), sp: 'Nothofagus dombeyi', treg: pk('Tipos_de_regeneración', 'Mixta'), tpla: pk('Tipos_de_planta_02', 'Cepellón'), dens: '400', vast: '600' }]);
    f.c743_a = 'Se favorece la regeneración natural en los claros abiertos y se complementa con plantación de coigüe en los sectores sin regeneración suficiente, previa limpieza de quila y protección contra ganado.';
    f.c743_b = 'Se evaluará el prendimiento al segundo año y se repondrá si es inferior al 80 %.';
    T.t75 = rows([{ rodal: '1', sp: 'Nothofagus obliqua', tipo: pk('Poda', 'Poda latizal alto'), apodar: '200', alt: '4.50', copa: '60' }]);
    f.c75_p = 'Poda de formación en los 200 mejores árboles de futuro por hectárea hasta 4,5 m, manteniendo al menos 60 % de copa viva. Se realiza con serrucho de poda en época de receso vegetativo y corte limpio junto al cuello de la rama.';

    /* ---------------- Cap. 8 ---------------- */
    T.t81 = rows([
      { rodal: '3', act: pk('Actividad_establecimiento', 'Plantación suplementaria'), sp: 'Nothofagus alpina', tpla: pk('Tipos_de_planta_02', 'Cepellón'), dens: '300', sup: '', ini: String(y0 + 1), fin: String(y0 + 2), conc: PROY },
      { rodal: '3', act: pk('Actividad_establecimiento', 'Estab. regeneración natural'), sp: 'Nothofagus dombeyi', tpla: '', dens: '', sup: '5000', ini: String(y0 + 1), fin: String(y0 + 2), conc: PROY }
    ]);
    f.c81_d = 'Plantación suplementaria con 300 plantas/ha de raulí en cepellón en los claros del rodal 3, con hoyadura manual y fertilización inicial. En 0,5 ha se establece regeneración natural mediante limpieza de quila, escarificado manual y cercado.';
    T.t82 = rows([{ rodal: '3', act: pk('Zanja_de_infiltracion', 'Zanja de infiltracion (330 ml/ha)'), aso: pk('Plantacion_suplementaria', 'Plantacion suplementaria (330 pl/ha)'), cant: '330', ini: String(y0 + 1), fin: String(y0 + 2), conc: PROY }]);
    f.c82_d = 'Zanjas de infiltración en curvas de nivel en los sectores con escurrimiento superficial del rodal 3, con una sección de 0,3 × 0,4 m y espaciadas según la pendiente, previas a la plantación.';
    const largoCerco = L_(G.cerco) / 1000;
    T.t83 = rows([{ rodal: '3', act: pk('Cerco', 'Cerco nuevo de alambre de púa'), aso: pk('Actividad_complementaria_cerco', 'Plantacion suplementaria (300 pl/ha)'), kmc: largoCerco.toFixed(2), kmr: '0', npl: '', ini: String(y0 + 1), fin: String(y0 + 1), conc: PROY }]);
    f.c83_d = 'Cerco perimetral de 5 hebras de alambre de púa con postes de roble cada 3 m, para excluir el ganado del rodal 3 durante el establecimiento de la regeneración y la plantación.';
    T.t841 = rows([{ rodal: '3', letr: '4', est: '2', supu: '25', faja: '3', calz: '1.5', long: (L_(G.sendero) / 1000).toFixed(2), ini: String(y0 + 2), fin: String(y0 + 3), conc: PROY }]);
    f.c841_a = 'Sendero interpretativo "Bosque del Canelo" asociado a la oferta de turismo rural de la familia propietaria.';
    f.c841_b = `Sendero peatonal de ${fmt(L_(G.sendero) / 1000, 2)} km con 1,5 m de calzada y 3 m de faja, trazado sobre terraza sin movimiento de tierra relevante, con 2 estaciones de observación de 25 m² y 4 letreros informativos.`;
    f.c841_c = 'Mantención anual de la calzada y las señales (poda de ramas, limpieza de drenajes y reposición de letreros) en primavera.';
    T.t842 = rows([{ rodal: '3', cant: '3', sp: 'Nothofagus dombeyi', marc: 'Marcación con pintura y numeración en el fuste' }]);
    f.c842_j = 'Se extraen 3 individuos de coigüe de pequeño diámetro que obstruyen el trazado y no pueden ser evitados sin alargar el sendero dentro de la faja de protección.';
    T.t85 = rows([{ rodal: '2', causa: pk('Causa_de_muerte', 'Viento'), cond: pk('Condición_de_la_madera', 'Muerta en pie'), sp: 'Nothofagus dombeyi', prod: [pk('Productos_primarios', 'Leña')], ini: String(y0 + 1), fin: String(y0 + 2), cant: '40', uni: pk('Unidad5', 'm³') }]);
    f.c85_a = 'Se extrae sólo madera muerta por viento que no sirve de hábitat (sin cavidades), con motosierra y madereo con bueyes por huellas existentes, sin abrir nuevos caminos.';
    f.c85_b = 'Se conservan los troncos con cavidades y una parte de la madera caída como refugio de fauna. No se afecta la regeneración por el uso de huellas existentes.';
    T.t86 = rows([{ rodal: '3', act: 'Control manual de zarzamora (Rubus ulmifolius)', par: 'Cobertura de zarzamora menor a 10 %', ini: String(y0 + 1), fin: String(y0 + 2), conc: PROY }]);
    f.c86_p = 'Corte y extracción manual de las plantas de zarzamora, con retiro de las raíces, y disposición del material fuera del bosque. Se repite una vez al año hasta lograr el parámetro técnico.';

    /* ---------------- Cap. 9 ---------------- */
    T.t91 = rows([
      { rodal: '1', cod: 'C1', tipo: pk('Actividad_camino', 'Camino (construir)'), temp: pk('Temporalidad_caminos', 'Temporales'), cant: '', ancho: '4', largo: String(Math.round(L_(G.caminoProy))), pend: '8', ini: String(y0 + 1), fin: String(y0 + 1) },
      { rodal: '1', cod: 'A1', tipo: pk('Actividad_camino', 'Cancha de acopio'), temp: pk('Temporalidad_caminos', 'Temporales'), cant: '1', ancho: '20', largo: '20', pend: '2', ini: String(y0 + 1), fin: String(y0 + 1) },
      { rodal: '2', cod: 'C2', tipo: pk('Actividad_camino', 'Camino (habilitar)'), temp: pk('Temporalidad_caminos', 'Permanentes'), cant: '', ancho: '4', largo: String(Math.round(L_(G.viaR2))), pend: '10', ini: String(y0 + 1), fin: String(y0 + 1) }
    ]);
    f.c91_a = 'Camino de 250 m y 4 m de ancho para acceder al rodal 1, con cancha de acopio de 20 × 20 m en el borde poniente. En el rodal 2 se habilita una vía de 50 m sobre una huella existente.';
    f.c91_b = 'El material excavado se usa en el relleno del mismo camino o se dispone en lugares planos, estables y alejados del estero, sin cubrir vegetación.';
    f.c91_c = 'Cunetas laterales con descarga en canales de disipación y alcantarillas de tubo en los puntos bajos. El agua se descarga sobre vegetación a más de 30 m del estero.';
    f.c91_d = 'No se construyen caminos dentro de las zonas de protección del estero ni de la vega.';
    f.c91_e = 'Después de cada faena se repara la cuneta y se limpian las alcantarillas. Luego de la cosecha, el camino temporal se cierra y se estabiliza con ramas.';
    T.t92 = rows([
      { rodal: '1', act: pk('Actividad_fuego', 'Cortafuego'), ancho: '5', largo: String(Math.round(L_(G.cortaf1))), cob: '', dens: '', altp: '', ini: String(y0 + 1), fin: String(y0 + 1), conc: PROY },
      { rodal: '3', act: pk('Actividad_fuego', 'Cortacombustible'), ancho: '3', largo: String(Math.round(L_(G.cortaf2))), cob: '40', dens: '300', altp: '50', ini: String(y0 + 1), fin: String(y0 + 2), conc: PROY }
    ]);
    f.c92_a = 'Cortafuego de 5 m de ancho en el borde poniente del rodal 1, limpio hasta el suelo mineral, y cortacombustible de 3 m en el borde norte del rodal 3, con raleo, poda y retiro del material combustible.';
    f.c92_b = 'Se limpian cada año antes del verano (noviembre).';

    /* ---------------- Cap. 10 / 11 ---------------- */
    f.c101 = 'En el rodal 1 el madereo se hace con tractor agrícola con huinche por el camino proyectado y la cancha de acopio. En el rodal 2, por la pendiente, se usan bueyes y huinche manual con huellas de madereo existentes, sin pasar por el estero.';
    T.t102 = rows([
      { rodal: '1', cant: String(volExt('1')), uni: pk('Unidad6', 'm³'), prod: [pk('Productos_primarios', 'Troza pulpable'), pk('Productos_primarios', 'Leña')] },
      { rodal: '2', cant: String(volExt('2')), uni: pk('Unidad6', 'm³'), prod: [pk('Productos_primarios', 'Troza aserrable'), pk('Productos_primarios', 'Leña')] }
    ]);
    f.c102_obs = 'Volúmenes estimados con el inventario y la intervención propuesta (12.3), redondeados a 10 m³. Más el volumen de madera muerta del 8.5.';
    f.c111_a = 'Se conservan los árboles con cavidades, las especies en categoría de conservación y las franjas de protección. No se interviene entre octubre y febrero. Se prohíbe la caza y la extracción de especies de fauna.';
    f.c111_b = 'Cortas de baja intensidad que mantienen la cobertura. Se evitan cortas en zonas visibles desde el camino y se oculta el material residual.';
    f.c112_a = 'Monitoreo anual del rodal para detectar plagas y enfermedades. Se retiran y se destruyen los árboles con ataque severo y se evita dejar residuos de corta en pie cerca del bosque sano.';
    f.c112_b = 'El cerco de exclusión impide el ingreso de ganado. Se controla la liebre y el conejo con trampas selectivas, donde sea necesario.';
    f.c113_a = 'Vigilancia permanente por el capataz y los vecinos, con aviso a CONAF (130) y a Bomberos de Panguipulli al detectar humo. Se dispone de teléfono satelital en la época de mayor riesgo.';
    f.c113_b = 'Dotación de herramientas de combate (palas, rastrillos, bateas con agua) en la casa patronal y la cancha de acopio, y personal capacitado en primer ataque.';
    f.c113_c = 'Los residuos de corta se pican y se dispersan, o se disponen en andanas fuera del bosque, y se mantiene limpio el cortafuego. No se hacen quemas.';
    f.c114_a = 'Cortas de baja intensidad con cobertura permanente, caída dirigida, uso de huellas existentes, madereo con bueyes y obras de cunetas, canales de disipación y alcantarillas.';
    f.c114_b = 'No se interviene, transita ni deposita material en las franjas de protección de estero y vega. Se señalizan los límites con cinta y estacas antes de las faenas.';
    f.c114_c = 'Según el D.S. N° 82/2010, en el estero (sección mayor a 0,5 m²) con pendiente menor a 30 % (rodal 1) se excluye la intervención en los primeros 10 m; con pendiente de 30 a 45 % (rodal 2) se aplica además manejo limitado hasta los 20 m. Se mantiene una faja de 10 m en el rodal 1 y de 20 m en el rodal 2, y de 10 m en el borde de la vega.';
    f.c114_d = 'Los caminos se construyen en época seca, con cunetas, alcantarillas y descarga de aguas sobre vegetación a más de 30 m del estero, sin cruzar cursos de agua.';
    f.c115 = 'Limpieza de quila, protección de la regeneración con cerco, riego de apoyo en el primer verano si fuese necesario y reposición de plantas muertas. Control del prendimiento al segundo año.';
    f.c116 = 'Capacitación del personal en medidas de seguridad, de ambiente y de manejo de fauna, y entrega de copias del Plan de Manejo al capataz y contratistas.';

    /* ---------------- Cap. 14 ---------------- */
    f.f14_lugar = 'Panguipulli'; f.f14_fecha = hoyIso;

    /* ---------------- Cap. 13: cartografía ---------------- */
    const C = S.carto = { huso: String(ZONA), layers: {}, plano: {}, predio: 'Fundo_Los_Coihues' };
    const gll = g => Geo.geomFromUTM(g, ZONA);
    const nombre = C.predio, fuente = 'Elaboración propia';
    const add = (capa, g, p) => { (C.layers[capa] = C.layers[capa] || []).push({ id: uid(), g: gll(g), p: Object.assign({ Nom_Predio: nombre }, p) }); };
    const xy = g => { const c = Geo.points(g)[0]; return { Coord_X: Math.round(c[0]), Coord_Y: Math.round(c[1]) }; };
    const area = g => round(A(g) / 10000, 2), km = (g, d = 3) => round(L_(g) / 1000, d);

    add('Limite_Predial', G.predio, { Rol: '00123-00045', Comuna: 'Panguipulli', Sup_ha: area(G.predio), Fuente: fuente });
    for (const r of ['1', '2', '3']) add('Rodales', geomR[r], { N_Rodal: r, Tipo_Bos: 'BN', Tipo_For: TIPO_FOR_COD[TF[r]], Sup_ha: area(geomR[r]), Fuente: fuente });
    for (const p of PARC) { const g = pt(p.e, p.n); add('Parcela', g, Object.assign({ N_Rodal: p.rod, N_Parc: p.parc, Fuente: fuente }, xy(g))); }
    for (const [lab, desc, c] of [['Acceso predial', 'Portón principal en camino Panguipulli–Coñaripe, km 12', ref.acceso], ['Infraestructura', 'Casa patronal y galpón', ref.infra], ['Acceso rodal', 'Entrada al rodal 1 desde camino interno', ref.rodal], ['Otra', 'Vertiente de origen del estero El Canelo', ref.otra]]) {
      const g = pt(c[0], c[1]); add('Referencia', g, Object.assign({ Nom_Pto: `${lab}: ${desc}`.slice(0, 100), Fuente: fuente }, xy(g)));
    }
    add('Area', G.area, { N_Area: 1, Tipo_Bos: 'BN', Sup_ha: area(G.area), Fuente: fuente });
    add('Sendero', G.sendero, { N_Send: 1, Long_Send: km(G.sendero), Fuente: fuente });
    add('Instalacion', G.letrero, Object.assign({ Tipo_Inst: '1', N_Estac: '', Sup_Estac: null, Fuente: fuente }, xy(G.letrero)));
    add('Instalacion', G.estacion, Object.assign({ Tipo_Inst: '2', N_Estac: '1', Sup_Estac: 25, Fuente: fuente }, xy(G.estacion)));
    add('Especie_Cons', G.michay, Object.assign({ Nom_Esp: 'Berberidopsis corallina', Fuente: fuente }, xy(G.michay)));
    add('Especie_Cons', G.alerce, Object.assign({ Nom_Esp: 'Fitzroya cupressoides', Fuente: fuente }, xy(G.alerce)));
    for (const g0 of [G.michay, G.alerce]) { const b = Geo.circle(Geo.points(g0)[0], 20); add('Area_Buffer', b, { Sup_ha: area(b), Fuente: fuente }); }
    add('Zona_Proteccion', G.zonaProt, { Tipo_Perma: '1', Sup_ha: area(G.zonaProt), Fuente: fuente });
    add('Cercos', G.cerco, { Tipo_Cerco: '1', Long_Cerco: km(G.cerco), Fuente: fuente });
    add('Cortafuegos', G.cortaf1, { N_Faja: 1, Long_Faja: km(G.cortaf1), Fuente: fuente });
    add('Cortafuegos', G.cortaf2, { N_Faja: 2, Long_Faja: km(G.cortaf2), Fuente: fuente });
    add('Obras_Erosion', G.zanja, { Long_km: km(G.zanja), Fuente: fuente });
    add('Caminos_Proyect', G.caminoProy, { Tipo_Cam: '2', Long_km: km(G.caminoProy), Fuente: fuente });
    add('Cancha_Acopio', G.cancha, Object.assign({ Nom_Infra: 'Cancha de acopio rodal 1', Fuente: fuente }, xy(G.cancha)));
    add('Vias_Ingreso', G.viaR2, { Long_km: km(G.viaR2), Fuente: fuente });
    const fr = 'IGM 1:50.000 y ortofoto';
    add('Hidrografia', G.estero, { Tip_Dren: '2', Tipo_Perma: '1', Long_km: km(G.estero), Fuente: fr });
    add('Cuerpo_Agua', G.humedal, { Tipo_Cuerp: '4', Tipo_Perma: '1', Sup_ha: area(G.humedal), Fuente: fr });
    add('Caminos', G.camino1, { Tipo_Cam: '2', Long_km: km(G.camino1), Fuente: fr });
    add('Caminos', G.camino2, { Tipo_Cam: '2', Long_km: km(G.camino2), Fuente: fr });
    add('Infraestructura', G.casa, Object.assign({ Nom_Infra: 'Casa patronal', Fuente: fr }, xy(G.casa)));
    add('Infraestructura', G.galpon, Object.assign({ Nom_Infra: 'Galpón', Fuente: fr }, xy(G.galpon)));

    C.plano = { tipo: 'rodales', papel: 'A3', orient: 'h', escala: 5000, autorPlano: f.au_nombre, fecha: hoyIso };
    Inv.invalidate();
  }

  App.cargarEjemplo = async function () {
    const hay = (S.f && (S.f.pr_nombre || (S.inv && S.inv.rows.length)));
    if (hay && !await confirmar('Se reemplazará el proyecto actual de este navegador por el proyecto de ejemplo con datos ficticios. ¿Continuar? (Exporte primero si desea conservar el actual)', 'Cargar ejemplo')) return;
    try {
      construir();
      if (typeof Carto !== 'undefined' && Carto.reload) Carto.reload();
      App.save(); App.navRefresh(); App.go('sol');
      toast('Proyecto de ejemplo cargado (datos ficticios). Revise cada capítulo y el panel de Revisión.', 'ok');
    } catch (e) { console.error(e); toast('No se pudo cargar el ejemplo: ' + e.message, 'err'); }
  };
})();
