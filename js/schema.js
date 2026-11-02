/* ==========================================================================
   Esquema del Plan de Manejo Forestal de Bosque Nativo (Ley 20.283)
   Reproduce capítulos, cuadros, columnas y listas del formulario CONAF.
   ========================================================================== */
'use strict';

const L = CAT.L;
const lst = k => L[k] || [];
const year0 = () => new Date().getFullYear();

/* Reglas de calendario tomadas de las validaciones del formulario Excel */
const ruleIni = { min: () => year0(), max: () => year0() + 10, msg: 'Año de inicio debe ser ≥ año actual y ≤ año actual + 10' };
const ruleFin = n => ({ fin: 'ini', plus: n, msg: `Término debe estar entre el inicio y el inicio + ${n} años` });

/* Tipos de columna:
   txt, area, num (2 dec), int, dec3, year, date, sel, multi, rod (rodal), rods (varios rodales), sp (especie),
   proj (ID proyecto concurso), auto (calculado) */
const SCHEMA = [
  /* ------------------------------ SOLICITUD ------------------------------ */
  { id: 'sol1', chap: 'sol', title: '1. Tipo de solicitud', items: [
    { type: 'fields', fields: [
      { k: 'sol_tipo', l: 'Tipo de solicitud', t: 'fixed', v: 'PLAN DE MANEJO FORESTAL DE BOSQUE NATIVO', w: 2 },
      { k: 'sol_incendio', l: 'Área afectada por incendios forestales', t: 'sel', o: ['', 'Sí', 'No'] },
      { k: 'sol_cup', l: 'Sistema Unificado de Permisos CUP N°', t: 'txt', upper: true }
    ] }
  ] },
  { id: 'sol2', chap: 'sol', title: '2. Interesado/a', help: 'Puede agregar más de un interesado/a (copropietarios). El primero se usará en el resto del Plan de Manejo.', items: [
    { type: 'table', id: 'sol_int', minRows: 1, cols: [
      { k: 'nombre', l: 'Nombre o razón social', t: 'txt', w: 220, req: true },
      { k: 'rut', l: 'RUT (sin DV)', t: 'rut', w: 110, req: true },
      { k: 'calidad', l: 'Calidad', t: 'sel', o: lst('Propietario_1'), w: 170 },
      { k: 'tipo', l: 'Tipo de propietario/a', t: 'sel', o: lst('Interesado'), w: 120 },
      { k: 'genero', l: 'Género', t: 'sel', o: lst('Genero'), w: 100 },
      { k: 'etnia', l: 'Etnia', t: 'sel', o: lst('Etnia'), w: 120 },
      { k: 'domicilio', l: 'Domicilio', t: 'txt', w: 180 },
      { k: 'ciudad', l: 'Ciudad (o pueblo)', t: 'txt', w: 120 },
      { k: 'email', l: 'E-mail', t: 'email', w: 160 },
      { k: 'fono', l: 'Teléfono', t: 'txt', w: 100 }
    ] }
  ] },
  { id: 'sol3', chap: 'sol', title: '3. Representante legal', opt: true, items: [
    { type: 'fields', fields: [
      { k: 'rl_nombre', l: 'Nombre', t: 'txt', w: 2 }, { k: 'rl_rut', l: 'RUT (sin DV)', t: 'rut' },
      { k: 'rl_dom', l: 'Domicilio', t: 'txt', w: 2 }, { k: 'rl_ciudad', l: 'Ciudad (o pueblo)', t: 'txt' },
      { k: 'rl_email', l: 'E-mail', t: 'email' }, { k: 'rl_fono', l: 'Teléfono', t: 'txt' }
    ] }
  ] },
  { id: 'sol4', chap: 'sol', title: '4. Cesionario/a', opt: true, help: 'Completar sólo en caso de solicitudes de bonificación, cuando el/la solicitante sea cesionario/a en virtud de la transferencia de la bonificación.', items: [
    { type: 'fields', fields: [
      { k: 'ce_nombre', l: 'Nombre o razón social', t: 'txt', w: 2 }, { k: 'ce_rut', l: 'RUT (sin DV)', t: 'rut' },
      { k: 'ce_dom', l: 'Domicilio', t: 'txt', w: 2 }, { k: 'ce_ciudad', l: 'Ciudad (o pueblo)', t: 'txt' },
      { k: 'ce_email', l: 'E-mail', t: 'email' }, { k: 'ce_fono', l: 'Teléfono', t: 'txt' }
    ] }
  ] },
  { id: 'sol5', chap: 'sol', title: '5. Predio', items: [
    { type: 'fields', fields: [
      { k: 'pr_nombre', l: 'Nombre del predio', t: 'txt', w: 2, req: true },
      { k: 'pr_difrol', l: 'Requiere DIFROL', t: 'sel', o: ['', 'si', 'no'] },
      { k: 'pr_fojas', l: 'Inscrito a fojas', t: 'txt' }, { k: 'pr_num', l: 'N°', t: 'txt' },
      { k: 'pr_anio', l: 'Del Registro de Propiedad del año', t: 'int', min: 1800, max: 2100 },
      { k: 'pr_cbr', l: 'Del Conservador de Bienes Raíces de', t: 'txt', w: 2 },
      { k: 'pr_cert', l: 'N° Certificado del M. Bs. Nac. (cuando corresponda)', t: 'txt' },
      { k: 'pr_certf', l: 'de fecha', t: 'date' }
    ] },
    { type: 'table', id: 'sol_rol', title: 'Rol(es) de avalúo SII', minRows: 1, cols: [
      { k: 'rol', l: 'Rol avalúo SII', t: 'txt', w: 140, req: true },
      { k: 'comuna', l: 'Comuna', t: 'comuna', w: 200, req: true }
    ] },
    { type: 'fields', fields: [
      { k: 'pr_suptotal', l: 'Superficie total del predio (ha)', t: 'num', req: true },
      { k: 'pr_supafecta', l: 'Superficie afecta a solicitud (ha)', t: 'calc', calc: () => App.supAfecta(), dec: 2, note: 'Suma de superficies del cuadro 5.1.1' }
    ] }
  ] },
  { id: 'sol6', chap: 'sol', title: 'Declaración y firma', items: [
    { type: 'note', text: 'Declaro bajo juramento que los datos consignados en la presente solicitud son verdaderos, que conozco y deseo acogerme a las disposiciones de la ley N° 20.283.' },
    { type: 'fields', fields: [
      { k: 'sol_fecha', l: 'Fecha', t: 'date', req: true }, { k: 'sol_ciudad', l: 'Ciudad', t: 'txt' }
    ] },
    { type: 'note', cls: 'muted', text: 'Nota: La solicitud que antecede no acredita resolución o certificación inmediata. La Corporación no ingresará a trámite las solicitudes incompletas, enmendadas o que no acompañen la documentación requerida.' }
  ] },

  /* ------------------------------ CAPÍTULO 1 ------------------------------ */
  { id: 'c1', chap: '1', title: '1 Antecedentes generales', help: 'La información del interesado y del predio se completa automáticamente desde la Solicitud.', items: [
    { type: 'fields', fields: [
      { k: 'v_int', l: 'Nombre o razón social del/de la interesado/a', t: 'calc', calc: () => App.interesado().nombre, w: 2 },
      { k: 'v_rut', l: 'RUT', t: 'calc', calc: () => rutFmt(App.interesado().rut) },
      { k: 'v_pred', l: 'Nombre del predio', t: 'calc', calc: () => App.f('pr_nombre'), w: 2 },
      { k: 'v_reg', l: 'Región', t: 'calc', calc: () => App.ubicacion().region },
      { k: 'v_prov', l: 'Provincia', t: 'calc', calc: () => App.ubicacion().provincia },
      { k: 'v_rol', l: 'Rol avalúo SII', t: 'calc', calc: () => App.roles().map(r => r.rol).join(', ') },
      { k: 'v_com', l: 'Comuna', t: 'calc', calc: () => App.ubicacion().comuna },
      { k: 'pm_suptitulo', l: 'Superficie total del predio (ha) según Título de dominio', t: 'num' },
      { k: 'pm_supet', l: 'Superficie total del predio (ha) según Estudio Técnico', t: 'num', note: 'Obtenida de la cartografía digital georreferenciada (capa Límite predial). Use “Sincronizar” en Cartografía.' }
    ] },
    { type: 'fields', fields: [{ k: 'pm_huso', l: 'Coordenadas UTM (Datum WGS 84) – Huso', t: 'sel', o: ['', '18', '19'] }] },
    { type: 'table', id: 'c1_ref', title: 'Punto(s) de referencia del predio', fixedRows: ['Acceso predial', 'Infraestructura', 'Acceso rodal', 'Otra'], cols: [
      { k: 'ref', l: 'Referencia', t: 'label', w: 130 },
      { k: 'desc', l: 'Descripción', t: 'txt', w: 330 },
      { k: 'este', l: 'Este (m)', t: 'int', min: 200000, max: 800000, w: 110 },
      { k: 'norte', l: 'Norte (m)', t: 'int', min: 3000000, max: 9000000, w: 120 }
    ] },
    { type: 'text', k: 'c1_vias', l: 'Vías de acceso al predio y datos de contacto', ph: 'Describa en forma resumida las vías de acceso al predio y a los rodales, y los datos de terceros (nombre y teléfono) que CONAF deba contactar para acceder al predio.' }
  ] },
  /* ------------------------------ CAPÍTULO 2 ------------------------------ */
  { id: 'c2', chap: '2', title: '2 Antecedentes del autor/a del Plan de Manejo', help: 'Ingeniero Forestal, Ingeniero Agrónomo especializado o Profesional relacionado con las Ciencias Forestales con postítulo o postgrado (Art. 7° Ley 20.283).', items: [
    { type: 'fields', fields: [
      { k: 'au_nombre', l: 'Nombre', t: 'txt', w: 2, req: true }, { k: 'au_rut', l: 'RUT (sin DV)', t: 'rut', req: true },
      { k: 'au_prof', l: 'Profesión', t: 'sel', o: [''].concat(lst('Autor')), w: 2, req: true },
      { k: 'au_dir', l: 'Dirección', t: 'txt', w: 2 },
      { k: 'au_email', l: 'E-mail', t: 'email' }, { k: 'au_fono', l: 'Fono contacto', t: 'txt' }
    ] }
  ] },
  /* ------------------------------ CAPÍTULO 3 ------------------------------ */
  { id: 'c3', chap: '3', title: '3 Participación en el Fondo Concursable', opt: true, help: 'Sólo cuando corresponda a Proyecto adjudicado en el Fondo de Conservación, Recuperación y Manejo Sustentable del Bosque Nativo.', items: [
    { type: 'table', id: 'c3_proy', cols: [
      { k: 'id', l: 'ID Proyecto', t: 'txt', w: 140, req: true },
      { k: 'anio', l: 'Año', t: 'int', min: 2009, max: 2100, w: 80 },
      { k: 'literal', l: 'Literal', t: 'sel', o: lst('Literal'), w: 80 },
      { k: 'concurso', l: 'Concurso de', t: 'sel', o: ['Pequeños propietarios forestales', 'Otros interesados'], w: 220 }
    ] },
    { type: 'text', k: 'c3_obs', l: 'Observaciones' },
    { type: 'text', k: 'c3_just', l: 'Justificación técnica en caso de diferencias entre Proyecto adjudicado y Plan de Manejo' }
  ] },
  /* ------------------------------ CAPÍTULO 4 ------------------------------ */
  { id: 'c41', chap: '4', title: '4.1 Descripción de aspectos relevantes del predio y su entorno inmediato', items: [
    { type: 'text', k: 'c41', l: 'Descripción', ph: 'Contexto de bosque, cuenca abastecedora de agua, desertificación o sequía, líneas de alta tensión, gasoductos, carreteras, cercanía a SNASPE, centros poblados, sitios patrimoniales, etc.' }
  ] },
  { id: 'c421', chap: '4', title: '4.2.1 Flora en categoría de conservación', help: 'Especies en categoría de conservación a menos de 100 m del límite del conjunto de rodales. La categoría, inclusión en el D.S. N° 68/2009 y fuente se completan automáticamente.', items: [
    { type: 'table', id: 't421', cols: [
      { k: 'sp', l: 'Especie(s)', t: 'flora', w: 280 },
      { k: 'ds68', l: 'DS N°68', t: 'auto', w: 70, calc: r => App.flora(r.sp)[1] },
      { k: 'cat', l: 'Categoría de conservación', t: 'auto', w: 170, calc: r => App.flora(r.sp)[2] },
      { k: 'fte', l: 'Fuente*', t: 'auto', w: 70, calc: r => App.flora(r.sp)[3] },
      { k: 'dist', l: 'Distancia rodal (m)', t: 'num', w: 110 }
    ] },
    { type: 'note', cls: 'muted', text: '(*) PCE = Proceso de Clasificación de Especies; LRN = Libro Rojo Nacional.' },
    { type: 'text', k: 'c421_buf', l: 'Criterios para la definición de área buffer para la no alteración de hábitat' },
    { type: 'text', k: 'c421_obs', l: 'Observaciones' }
  ] },
  { id: 'c422', chap: '4', title: '4.2.2 Fauna en categoría de conservación', items: [
    { type: 'table', id: 't422', cols: [
      { k: 'sp', l: 'Especie(s)', t: 'fauna', w: 300 },
      { k: 'cat', l: 'Categoría de conservación', t: 'auto', w: 150, calc: r => App.fauna(r.sp)[1] },
      { k: 'fte', l: 'Fuente*', t: 'auto', w: 70, calc: r => App.fauna(r.sp)[2] },
      { k: 'ref', l: 'Referencia', t: 'sel', o: lst('Fuente_Fauna'), w: 150 },
      { k: 'pres', l: 'Presencia', t: 'sel', o: lst('Permanencia'), w: 120 }
    ] },
    { type: 'note', cls: 'muted', text: '(*) PCE = Proceso de Clasificación de Especies; LRN = Libro Rojo Nacional.' },
    { type: 'text', k: 'c422_obs', l: 'Observaciones', ph: 'Elementos adicionales: nidos, madrigueras, huellas, fecas, etc.' }
  ] },
  /* ------------------------------ CAPÍTULO 5 ------------------------------ */
  { id: 'c511', chap: '5', title: '5.1.1 Definición de los rodales', help: 'Los rodales aquí definidos alimentan las listas de todo el Plan de Manejo. Pueden importarse desde el inventario (Capítulo 12) y la superficie desde la cartografía.', items: [
    { type: 'actions', actions: [{ label: 'Importar rodales desde inventario', fn: () => App.importarRodalesInventario() }, { label: 'Actualizar superficies desde cartografía', fn: () => Carto.syncSuperficies() }] },
    { type: 'table', id: 't511', key: 'rodal', cols: [
      { k: 'rodal', l: 'Rodal', t: 'txt', w: 70, req: true, unique: true },
      { k: 'sup', l: 'Superficie (ha)', t: 'num', w: 90, req: true },
      { k: 'tf', l: 'Tipo Forestal', t: 'sel', o: lst('Tipo_Forestal'), w: 170, req: true },
      { k: 'stf', l: 'Subtipo forestal', t: 'sel', o: r => CAT.SUBTIPOS[r.tf] || [], w: 200 },
      { k: 'est', l: 'Estructura actual', t: 'sel', o: lst('Estructura'), w: 100 },
      { k: 'estr', l: 'Estratos', t: 'sel', o: lst('Estratos'), w: 130 },
      { k: 'edd', l: 'Estado(s) de desarrollo*', t: 'multi', o: lst('Estado_DD').concat(['No aplica']), w: 200 },
      { k: 'cont', l: 'Continuidad', t: 'sel', o: lst('Continuidad'), w: 140 }
    ], footer: [{ col: 'sup', fn: rows => fmt(rows.reduce((s, r) => s + (num(r.sup) || 0), 0), 2) + ' ha', label: 'Total' }] },
    { type: 'note', cls: 'muted', text: '(*) En bosques biestratificados, multiestratificados o irregulares puede seleccionar más de un estado de desarrollo. Se excluyen los tipos forestales Alerce, Araucaria y Palma chilena (bosques de preservación).' },
    { type: 'text', k: 'c511_obs', l: 'Criterios para la definición de los rodales y observaciones' }
  ] },
  { id: 'c512', chap: '5', title: '5.1.2 Descripción cualitativa', items: [
    { type: 'table', id: 't512', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'dom', l: 'Especie(s) dominante(s)', t: 'sp', w: 200 },
      { k: 'sec', l: 'Especie(s) secundaria(s)', t: 'sp', w: 200 },
      { k: 'ori', l: 'Origen', t: 'sel', o: lst('Origen_regeneración'), w: 110 },
      { k: 'cob', l: 'Cobertura de copas', t: 'sel', o: lst('Cobertura_arbórea'), w: 120 },
      { k: 'san', l: 'Sanidad – Estado', t: 'sel', o: lst('Estado_sanitario'), w: 90 },
      { k: 'age', l: 'Agente(s) de daño', t: 'multi', o: lst('Agente'), w: 180 }
    ] },
    { type: 'text', k: 'c512_obs', l: 'Observaciones' }
  ] },
  { id: 'c513', chap: '5', title: '5.1.3 Caracterización de la regeneración', items: [
    { type: 'table', id: 't513', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'sp', l: 'Especie(s) predominante(s)', t: 'sp', w: 240 },
      { k: 'ab50', l: 'Abundancia < 50 cm', t: 'sel', o: lst('Abundancia_relativa'), w: 120 },
      { k: 'ab51', l: 'Abundancia ≥ 50 cm*', t: 'sel', o: lst('Abundancia_relativa'), w: 120 },
      { k: 'ori', l: 'Origen de la regeneración', t: 'sel', o: lst('Origen_regeneración'), w: 130 },
      { k: 'dist', l: 'Distribución', t: 'sel', o: lst('Distribución'), w: 120 }
    ] },
    { type: 'note', cls: 'muted', text: '(*) Considerar altura de hasta 1 m en condiciones áridas o semiáridas o 2 m en otras condiciones.' },
    { type: 'text', k: 'c513_obs', l: 'Factores de riesgo al establecimiento y observaciones' }
  ] },
  { id: 'c514', chap: '5', title: '5.1.4 Antecedentes históricos del(los) rodal(es)', items: [
    { type: 'table', id: 't514', title: 'a) Bonificaciones anteriores', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'act', l: 'Actividad(es) bonificada(s) en el rodal', t: 'multi', o: lst('Actividad_01'), w: 260 },
      { k: 'enr', l: 'En rodal', t: 'sel', o: lst('Monto_rodal'), w: 100 },
      { k: 'lit', l: 'Literal', t: 'sel', o: lst('Literal'), w: 60 },
      { k: 'monto', l: 'Monto (UTM/ha)', t: 'num', w: 100 },
      { k: 'res', l: 'Resolución N°', t: 'txt', w: 100 },
      { k: 'resf', l: 'Fecha', t: 'date', w: 130 }
    ] },
    { type: 'text', k: 'c514_b', l: 'b) Historia del rodal y análisis del efecto de la última intervención sobre el recurso' },
    { type: 'text', k: 'c514_c', l: 'c) Observaciones' }
  ] },
  { id: 'c52', chap: '5', title: '5.2 Hidrografía', help: 'Si el rodal se encuentra a menos de 200 m de manantiales, cuerpos o cursos de agua naturales, es bosque nativo de conservación y protección. La distancia puede calcularse desde la cartografía.', items: [
    { type: 'actions', actions: [{ label: 'Calcular distancias desde cartografía', fn: () => Carto.calcDistHidro() }] },
    { type: 'table', id: 't52', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'nom', l: 'Nombre', t: 'txt', w: 150, ph: 'sin nombre' },
      { k: 'tipo', l: 'Tipo', t: 'sel', o: lst('H2O'), w: 110 },
      { k: 'temp', l: 'Temporalidad', t: 'sel', o: lst('Temporalidad'), w: 110 },
      { k: 'ubi', l: 'Ubicación', t: 'sel', o: lst('Ubicación'), w: 100 },
      { k: 'dist', l: 'Distancia al rodal (m)', t: 'num', w: 110 },
      { k: 'afl', l: 'Afluente de', t: 'txt', w: 140 },
      { k: 'sec', l: 'Sección de cauce', t: 'sel', o: lst('Sección'), w: 130 }
    ] },
    { type: 'text', k: 'c52_obs', l: 'Observaciones' }
  ] },
  { id: 'c531', chap: '5', title: '5.3.1 Fisiografía', items: [
    { type: 'table', id: 't531', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'alt', l: 'Altitud (m s.n.m.)', t: 'int', min: 0, max: 6000, w: 100 },
      { k: 'rel', l: 'Forma del relieve', t: 'sel', o: lst('Posición_fisiográfica'), w: 150 },
      { k: 'exp', l: 'Exposición', t: 'sel', o: lst('Exposición'), w: 120 },
      { k: 'pend', l: 'Pendiente predominante (%)', t: 'sel', o: lst('Pendiente'), w: 150 }
    ] },
    { type: 'text', k: 'c531_obs', l: 'Factores limitantes' }
  ] },
  { id: 'c532', chap: '5', title: '5.3.2 Características de suelo', help: 'En suelos de profundidad menor a 10 cm se prohíbe la corta de bosque nativo (Art. 9°, D.S. N° 82/2010 MINAGRI).', items: [
    { type: 'table', id: 't532', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'tipo', l: 'Tipo de suelo', t: 'sel', o: lst('Tipo_suelo'), w: 120 },
      { k: 'tex', l: 'Textura', t: 'sel', o: lst('Textura'), w: 100 },
      { k: 'estr', l: 'Estructura', t: 'sel', o: lst('si_no'), w: 70 },
      { k: 'cap', l: 'Capacidad de uso', t: 'sel', o: lst('Clase_capacidad'), w: 80 },
      { k: 'prof', l: 'Profundidad (cm)', t: 'int', min: 10, max: 1000, w: 90, minMsg: 'En suelos de profundidad menor a 10 cm se prohíbe la corta de bosque nativo (Art. 9°, D.S. N°82/2010).', warn: r => num(r.prof) >= 10 && num(r.prof) < 20 ? 'Suelo delgado (10–20 cm)' : '' },
      { k: 'serie', l: 'Nombre de la serie', t: 'serie', w: 150 },
      { k: 'form', l: 'Fórmula', t: 'txt', w: 110 },
      { k: 'ero', l: 'Grado de erosión', t: 'sel', o: lst('Erosión'), w: 110 },
      { k: 'fra', l: 'Fragilidad*', t: 'sel', o: lst('Fragilidad'), w: 70 }
    ] },
    { type: 'note', cls: 'muted', text: '(*) Fragilidad según Art. 22° del D.S. N° 193/1998 MINAGRI: a) pendiente > 15%; b) textura arenosa o no estructurados; c) profundidad efectiva ≤ 0,5 m; d) pedregosidad superficial > 10% y/o en el perfil > 30%; e) rocosidad superficial > 10% y/o en el perfil > 30%; f) riesgo cierto de deslizamientos o remoción en masa; g) riesgo cierto de erosión superficial.' },
    { type: 'text', k: 'c532_obs', l: 'Factores limitantes' }
  ] },
  { id: 'c541', chap: '5', title: '5.4.1 Caracterización social', help: 'Sectores o centros poblados y sectores de recreación o turismo a menos de 1 km del rodal.', items: [
    { type: 'table', id: 't541', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'pd', l: 'Centros poblados – Distancia (m)', t: 'num', max: 1000, w: 120 },
      { k: 'pn', l: 'Centros poblados – Nombre', t: 'txt', w: 180 },
      { k: 'rd', l: 'Recreación/turismo – Distancia (m)', t: 'num', max: 1000, w: 120 },
      { k: 'rn', l: 'Recreación/turismo – Nombre', t: 'txt', w: 180 }
    ] },
    { type: 'text', k: 'c541_obs', l: 'Descripción' }
  ] },
  { id: 'c542', chap: '5', title: '5.4.2 Presencia de construcciones, estructuras, infraestructuras críticas o estratégicas', items: [
    { type: 'table', id: 't542', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'nom', l: 'Nombre', t: 'txt', w: 380 },
      { k: 'dist', l: 'Distancia (m)', t: 'num', max: 1000, w: 110 }
    ] },
    { type: 'text', k: 'c542_obs', l: 'Descripción' }
  ] },
  { id: 'c55', chap: '5', title: '5.5 Restricciones según variables del medio natural', items: [
    { type: 'table', id: 't55', cols: [
      { k: 'rods', l: 'Rodal(es)', t: 'rods', w: 120 },
      { k: 'fac', l: 'Factor(es) de restricción', t: 'multi', o: lst('Restricciones_medio'), w: 220 },
      { k: 'desc', l: 'Breve descripción', t: 'txt', w: 360 }
    ] },
    { type: 'text', k: 'c55_obs', l: 'Observaciones' }
  ] },
  /* ------------------------------ CAPÍTULO 6 ------------------------------ */
  { id: 'c6', chap: '6', title: '6 Definición de los objetivos de manejo', items: [
    { type: 'table', id: 't6', cols: [
      { k: 'obj', l: 'Objetivo de manejo', t: 'sel', o: lst('Objetivo_de_manejo'), w: 130 },
      { k: 'rods', l: 'Rodal(es)', t: 'rods', w: 140 },
      { k: 'esp', l: 'Objetivo(s) específico(s)', t: 'txt', w: 420 }
    ] },
    { type: 'text', k: 'c6_fund', l: 'Fundamentación y descripción' }
  ] },
  /* ------------------------------ CAPÍTULO 7 ------------------------------ */
  { id: 'c71', chap: '7', title: '7.1 Bosque futuro esperado', items: [
    { type: 'table', id: 't71', cols: [
      { k: 'rods', l: 'Rodal(es)', t: 'rods', w: 110 },
      { k: 'est', l: 'Estructura deseada', t: 'sel', o: lst('Estructura01'), w: 100 },
      { k: 'met', l: 'Método de manejo', t: 'sel', o: lst('Método_de_Manejo'), w: 130 },
      { k: 'corta', l: 'Método de corta de regeneración', t: 'sel', o: lst('Método_de_Corta_y_Regeneración'), w: 150 },
      { k: 'sp', l: 'Especie(s) a favorecer', t: 'sp', w: 220 }
    ] },
    { type: 'text', k: 'c71_a', l: 'a) Descripción del método de manejo' },
    { type: 'text', k: 'c71_b', l: 'b) Descripción del tratamiento silvícola a aplicar' },
    { type: 'text', k: 'c71_c', l: 'c) Fundamentación si se trata de otro método de corta (Art. 25°, D.S. N° 259/1980 MINAGRI)' }
  ] },
  { id: 'c72', chap: '7', title: '7.2 Estado de desarrollo por rodal', help: 'Se genera automáticamente desde el análisis del inventario (12.3). Para recalcular el DMC excluyendo diámetros extremos ingrese Ø mínimo y máximo: se exige que el rango contenga al menos el 95 % de los individuos.', items: [
    { type: 'custom', render: () => Inv.render72() }
  ] , extraText: [{ k: 'c72_fund', l: 'Fundamentación del cambio de estado de desarrollo por rodal' }] },
  { id: 'c731', chap: '7', title: '7.3.1 Calendarización de actividades inmediatas*', items: [
    { type: 'table', id: 't731', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'act', l: 'Actividad', t: 'sel', o: lst('Actividad'), w: 330 },
      { k: 'ini', l: 'Inicio', t: 'year', rule: ruleIni, w: 80 },
      { k: 'fin', l: 'Término', t: 'year', rule: { fn: (r) => {
          const fin = ['Corta a tala rasa', 'Corta cosecha', 'Corta de regeneración', 'Corta final', 'Corta semillera'].includes(r.act);
          const a = num(r.ini), b = num(r.fin); if (!isFinite(a) || !isFinite(b)) return '';
          if (fin) return (b === a || b === a + 1) ? '' : 'Para cortas finales/de regeneración el término debe ser el mismo año de inicio o el siguiente';
          return (b >= a && b <= a + 4) ? '' : 'Término debe estar entre el inicio y el inicio + 4 años'; } }, w: 80 },
      { k: 'conc', l: 'Concurso', t: 'proj', w: 110 }
    ] },
    { type: 'note', cls: 'muted', text: '(*) Conjunto de actividades a realizar cuyo resultado se expresa en el cuadro 7.4.2 y en la tabla residual de la sección 12.3.9.' },
    { type: 'text', k: 'c731_obs', l: 'Observaciones' }
  ] },
  { id: 'c732', chap: '7', title: '7.3.2 Programa de actividades según parámetro de desarrollo del rodal', items: [
    { type: 'table', id: 't732', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'act', l: 'Actividad', t: 'sel', o: lst('Actividad_01'), w: 250 },
      { k: 'par', l: 'Parámetro', t: 'sel', o: lst('Parámetro'), w: 140 },
      { k: 'val', l: 'Valor', t: 'dec3', w: 80 },
      { k: 'uni', l: 'Unidad', t: 'sel', o: lst('Unidad2'), w: 80 },
      { k: 'anio', l: 'Año referencial', t: 'year', w: 90 }
    ] },
    { type: 'text', k: 'c732_obs', l: 'Observaciones' }
  ] },
  { id: 'c741', chap: '7', title: '7.4.1 Actividades de corta', help: 'El tipo de bosque (Conservación y protección / Uso múltiple) y las zonas de protección del Reglamento de Suelos, Aguas y Humedales (D.S. N° 82/2010) se determinan automáticamente con los datos de 5.2, 5.3.1 y 5.3.2.', items: [
    { type: 'custom', render: () => App.render741() },
    { type: 'text', k: 'c741_a', l: 'a) Prescripción técnica de cada actividad' },
    { type: 'text', k: 'c741_b', l: 'b) Criterios de selección de los árboles a dejar' },
    { type: 'text', k: 'c741_c', l: 'c) Características de la marcación, cuando corresponda' },
    { type: 'text', k: 'c741_d', l: 'd) Justificación técnica de los métodos a utilizar en bosques de conservación y protección, y zonas RSAH' }
  ] },
  { id: 'c742', chap: '7', title: '7.4.2 Efecto de la intervención inmediata', help: 'Se calcula automáticamente desde el inventario. Seleccione la cobertura residual estimada.', items: [
    { type: 'custom', render: () => Inv.render742() },
    { type: 'text', k: 'c742_obs', l: 'Observaciones' }
  ] },
  { id: 'c743', chap: '7', title: '7.4.3 Compromiso de regeneración o reforestación', opt: true, items: [
    { type: 'table', id: 't743', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'ini', l: 'Inicio', t: 'year', rule: ruleIni, w: 80 },
      { k: 'fin', l: 'Término', t: 'year', rule: ruleFin(4), w: 80 },
      { k: 'sp', l: 'Especie(s)', t: 'sp', w: 200 },
      { k: 'treg', l: 'Tipo de regeneración', t: 'sel', o: lst('Tipos_de_regeneración'), w: 120 },
      { k: 'tpla', l: 'Tipo de planta', t: 'sel', o: lst('Tipos_de_planta_02'), w: 110 },
      { k: 'dens', l: 'Densidad objetivo – Plantas o cepas/ha', t: 'int', w: 110 },
      { k: 'vast', l: 'Densidad objetivo – Vástagos/ha', t: 'int', w: 110 }
    ] },
    { type: 'text', k: 'c743_a', l: 'a) Prescripción técnica y actividades preparatorias' },
    { type: 'text', k: 'c743_b', l: 'b) Observaciones' }
  ] },
  { id: 'c75', chap: '7', title: '7.5 Descripción de la poda', opt: true, items: [
    { type: 'table', id: 't75', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'sp', l: 'Especie(s) a podar', t: 'sp', w: 200 },
      { k: 'tipo', l: 'Tipo de poda', t: 'sel', o: lst('Poda'), w: 170 },
      { k: 'dens', l: 'Densidad (árb./ha)', t: 'auto', w: 90, calc: r => { const x = Inv.resultado(r.rodal); return x ? fmt(x.tot.nIni, 0) : ''; } },
      { k: 'apodar', l: 'A podar (árb./ha)', t: 'int', w: 90 },
      { k: 'alt', l: 'Altura de poda (m)', t: 'num', w: 90 },
      { k: 'copa', l: 'Copa viva remanente (%)', t: 'num', max: 100, w: 100 }
    ] },
    { type: 'text', k: 'c75_p', l: 'Prescripción técnica' }
  ] },
  /* ------------------------------ CAPÍTULO 8 ------------------------------ */
  { id: 'c81', chap: '8', title: '8.1 Plantación suplementaria, siembra directa y establecimiento de la regeneración natural', opt: true, items: [
    { type: 'table', id: 't81', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'act', l: 'Actividad', t: 'sel', o: lst('Actividad_establecimiento'), w: 170 },
      { k: 'sp', l: 'Especie(s)', t: 'sp', w: 180 },
      { k: 'tpla', l: 'Plantación – Tipo de planta', t: 'sel', o: lst('Tipos_de_planta_02'), w: 110 },
      { k: 'dens', l: 'Plantación – Densidad (pla./ha)', t: 'int', w: 100 },
      { k: 'sup', l: 'Siembra o establecimiento – Superficie (m²)', t: 'num', w: 120 },
      { k: 'ini', l: 'Inicio', t: 'year', rule: ruleIni, w: 75 },
      { k: 'fin', l: 'Término', t: 'year', rule: ruleFin(5), w: 75 },
      { k: 'conc', l: 'Concurso', t: 'proj', w: 100 }
    ] },
    { type: 'text', k: 'c81_d', l: 'Descripción detallada de la actividad o conjunto de tratamientos a realizar' }
  ] },
  { id: 'c82', chap: '8', title: '8.2 Construcción de obras de control de erosión', opt: true, items: [
    { type: 'table', id: 't82', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'act', l: 'Actividad', t: 'sel', o: lst('Zanja_de_infiltracion'), w: 200 },
      { k: 'aso', l: 'Actividad asociada', t: 'sel', o: lst('Plantacion_suplementaria'), w: 220 },
      { k: 'cant', l: 'Dimensión – Cantidad', t: 'int', w: 90 },
      { k: 'uni', l: 'Unidad', t: 'fixed', v: 'ml/ha', w: 60 },
      { k: 'ini', l: 'Inicio', t: 'year', rule: ruleIni, w: 75 },
      { k: 'fin', l: 'Término', t: 'year', rule: ruleFin(5), w: 75 },
      { k: 'conc', l: 'Concurso', t: 'proj', w: 100 }
    ] },
    { type: 'text', k: 'c82_d', l: 'Descripción detallada de la actividad a realizar' }
  ] },
  { id: 'c83', chap: '8', title: '8.3 Construcción de cercos o protección individual', opt: true, items: [
    { type: 'table', id: 't83', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'act', l: 'Actividad', t: 'sel', o: lst('Cerco'), w: 220 },
      { k: 'aso', l: 'Actividad asociada', t: 'sel', o: lst('Actividad_complementaria_cerco'), w: 220 },
      { k: 'kmc', l: 'Cerco (km) a construir', t: 'num', w: 90 },
      { k: 'kmr', l: 'Cerco (km) a reparar', t: 'num', w: 90 },
      { k: 'npl', l: 'Protección N° plantas', t: 'int', w: 90 },
      { k: 'ini', l: 'Inicio', t: 'year', rule: ruleIni, w: 75 },
      { k: 'fin', l: 'Término', t: 'year', rule: ruleFin(4), w: 75 },
      { k: 'conc', l: 'Concurso', t: 'proj', w: 100 }
    ] },
    { type: 'text', k: 'c83_d', l: 'Descripción detallada de la actividad a realizar' }
  ] },
  { id: 'c841', chap: '8', title: '8.4.1 Construcción de senderos para recreación y turismo – Características del sendero', opt: true, items: [
    { type: 'table', id: 't841', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'letr', l: 'Letreros (N°)', t: 'int', w: 80 },
      { k: 'est', l: 'Estaciones – Cantidad', t: 'int', w: 90 },
      { k: 'supu', l: 'Estaciones – Sup. unitaria (m²)', t: 'num', w: 110 },
      { k: 'faja', l: 'Ancho faja (m)', t: 'num', w: 80 },
      { k: 'calz', l: 'Ancho calzada (m)', t: 'num', w: 90 },
      { k: 'long', l: 'Longitud (km)', t: 'num', w: 80 },
      { k: 'ini', l: 'Inicio', t: 'year', rule: ruleIni, w: 75 },
      { k: 'fin', l: 'Término', t: 'year', rule: ruleFin(4), w: 75 },
      { k: 'conc', l: 'Concurso', t: 'proj', w: 100 }
    ] },
    { type: 'text', k: 'c841_a', l: 'a) Iniciativa o proyecto turístico asociado, cuando corresponda' },
    { type: 'text', k: 'c841_b', l: 'b) Descripción detallada del sendero' },
    { type: 'text', k: 'c841_c', l: 'c) Actividades de mantención y periodicidad' }
  ] },
  { id: 'c842', chap: '8', title: '8.4.2 Corta excepcional de individuos para la construcción de senderos', opt: true, items: [
    { type: 'table', id: 't842', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'cant', l: 'Cantidad', t: 'int', w: 90 },
      { k: 'sp', l: 'Especie(s)', t: 'sp', w: 260 },
      { k: 'marc', l: 'Modo de marcación', t: 'txt', w: 240 }
    ] },
    { type: 'text', k: 'c842_j', l: 'Justificación de la extracción de individuos' }
  ] },
  { id: 'c85', chap: '8', title: '8.5 Extracción de maderas muertas en bosque nativo', opt: true, items: [
    { type: 'table', id: 't85', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'causa', l: 'Causa de muerte', t: 'sel', o: lst('Causa_de_muerte'), w: 120 },
      { k: 'cond', l: 'Condición de la madera', t: 'sel', o: lst('Condición_de_la_madera'), w: 140 },
      { k: 'sp', l: 'Especie(s)', t: 'sp', w: 160 },
      { k: 'prod', l: 'Producto(s)', t: 'multi', o: lst('Productos_primarios'), w: 160 },
      { k: 'ini', l: 'Inicio', t: 'year', rule: ruleIni, w: 75 },
      { k: 'fin', l: 'Término', t: 'year', rule: ruleFin(4), w: 75 },
      { k: 'cant', l: 'Volumen estimado – Cantidad', t: 'int', w: 100 },
      { k: 'uni', l: 'Unidad', t: 'sel', o: lst('Unidad5'), w: 70 }
    ] },
    { type: 'text', k: 'c85_a', l: 'a) Descripción técnica detallada del modo de extracción y madereo' },
    { type: 'text', k: 'c85_b', l: 'b) Impacto sobre la regeneración, reforestación y fauna del rodal' }
  ] },
  { id: 'c86', chap: '8', title: '8.6 Otras actividades', opt: true, items: [
    { type: 'table', id: 't86', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'act', l: 'Actividad', t: 'txt', w: 240 },
      { k: 'par', l: 'Parámetro técnico', t: 'txt', w: 200 },
      { k: 'ini', l: 'Inicio', t: 'year', rule: ruleIni, w: 75 },
      { k: 'fin', l: 'Término', t: 'year', rule: ruleFin(4), w: 75 },
      { k: 'conc', l: 'Concurso', t: 'proj', w: 100 }
    ] },
    { type: 'text', k: 'c86_p', l: 'Prescripción técnica' }
  ] },
  /* ------------------------------ CAPÍTULO 9 ------------------------------ */
  { id: 'c91', chap: '9', title: '9.1 Construcción y habilitación de caminos forestales, y otras estructuras', opt: true, help: 'La superficie se calcula automáticamente. Se destaca en rojo cuando el área alterada alcanza o supera el 18 % de la superficie del rodal.', items: [
    { type: 'table', id: 't91', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'cod', l: 'Código', t: 'txt', w: 70 },
      { k: 'tipo', l: 'Tipo', t: 'sel', o: lst('Actividad_camino'), w: 140 },
      { k: 'temp', l: 'Temporalidad', t: 'sel', o: lst('Temporalidad_caminos'), w: 110 },
      { k: 'cant', l: 'Cantidad', t: 'int', w: 70, dis: r => /^Camino/.test(r.tipo || '') },
      { k: 'ancho', l: 'Ancho (m)', t: 'num', w: 70 },
      { k: 'largo', l: 'Largo (m)', t: 'int', w: 80 },
      { k: 'sup', l: 'Sup. (ha)', t: 'auto', w: 80, calc: r => { const s = App.sup91(r); return isFinite(s) ? fmt(s, 2) : ''; }, flag: r => App.alerta18(r) },
      { k: 'pend', l: 'Pendiente máx (%)', t: 'num', w: 90 },
      { k: 'ini', l: 'Inicio', t: 'year', rule: ruleIni, w: 75 },
      { k: 'fin', l: 'Término', t: 'year', rule: ruleFin(4), w: 75 }
    ], footer: [{ col: 'sup', label: 'Total', fn: rows => fmt(rows.reduce((s, r) => s + (App.sup91(r) || 0), 0), 2) }] },
    { type: 'text', k: 'c91_a', l: 'a) Descripción técnica detallada' },
    { type: 'text', k: 'c91_b', l: 'b) Tratamiento del material de derrame de caminos forestales' },
    { type: 'text', k: 'c91_c', l: 'c) Obras de arte, obras de drenaje y modo de descarga de aguas' },
    { type: 'text', k: 'c91_d', l: 'd) Justificación de construcción de caminos en zonas de protección' },
    { type: 'text', k: 'c91_e', l: 'e) Actividades de mantención y periodicidad' }
  ] },
  { id: 'c92', chap: '9', title: '9.2 Protección contra incendios forestales (adicionales a las medidas de protección)', opt: true, items: [
    { type: 'table', id: 't92', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'act', l: 'Actividad', t: 'sel', o: lst('Actividad_fuego'), w: 140 },
      { k: 'ancho', l: 'Ancho (m)', t: 'num', w: 70 },
      { k: 'largo', l: 'Largo (m)', t: 'num', w: 80 },
      { k: 'sup', l: 'Sup. (ha)', t: 'auto', w: 80, calc: r => (isNum(r.ancho) && isNum(r.largo)) ? fmt(num(r.ancho) * num(r.largo) / 10000, 2) : '' },
      { k: 'cob', l: 'Cobertura copas (%)*', t: 'num', max: 100, w: 90 },
      { k: 'dens', l: 'Densidad (árb./ha)*', t: 'int', w: 90 },
      { k: 'altp', l: 'Altura poda (%)', t: 'num', max: 100, w: 80 },
      { k: 'ini', l: 'Inicio', t: 'year', rule: ruleIni, w: 75 },
      { k: 'fin', l: 'Término', t: 'year', rule: ruleFin(4), w: 75 },
      { k: 'conc', l: 'Concurso', t: 'proj', w: 100 }
    ] },
    { type: 'note', cls: 'muted', text: '(*) Residual luego de la intervención.' },
    { type: 'text', k: 'c92_a', l: 'a) Descripción detallada de la actividad a realizar y sus prescripciones técnicas' },
    { type: 'text', k: 'c92_b', l: 'b) Actividades de mantención y periodicidad' }
  ] },
  /* ------------------------------ CAPÍTULO 10 ------------------------------ */
  { id: 'c101', chap: '10', title: '10.1 Método de madereo (en cosechas o cortas intermedias)', opt: true, items: [
    { type: 'text', k: 'c101', l: 'Descripción' }
  ] },
  { id: 'c102', chap: '10', title: '10.2 Volúmenes estimados para solicitar Guías de Libre Tránsito', opt: true, items: [
    { type: 'table', id: 't102', cols: [
      { k: 'rodal', l: 'Rodal', t: 'rod', w: 70 },
      { k: 'cant', l: 'Volumen – Cantidad', t: 'int', w: 110 },
      { k: 'uni', l: 'Unidad', t: 'sel', o: lst('Unidad6'), w: 70 },
      { k: 'prod', l: 'Productos primarios estimados a extraer', t: 'multi', o: lst('Productos_primarios'), w: 360 }
    ], footer: [
      { col: 'cant', label: 'Total m³', fn: rows => fmt(rows.filter(r => r.uni === 'm³').reduce((s, r) => s + (num(r.cant) || 0), 0), 0) },
      { col: 'cant', label: 'Total Tn', fn: rows => fmt(rows.filter(r => r.uni === 'Tn').reduce((s, r) => s + (num(r.cant) || 0), 0), 0) }
    ] },
    { type: 'text', k: 'c102_obs', l: 'Observaciones' }
  ] },
  /* ------------------------------ CAPÍTULO 11 ------------------------------ */
  { id: 'c111', chap: '11', title: '11.1 Conservación de la diversidad biológica', items: [
    { type: 'text', k: 'c111_a', l: 'a) Medidas para la conservación y protección de la flora y la fauna' },
    { type: 'text', k: 'c111_b', l: 'b) Medidas de mantención y protección del valor paisajístico' }
  ] },
  { id: 'c112', chap: '11', title: '11.2 Sanidad y vitalidad del bosque', items: [
    { type: 'text', k: 'c112_a', l: 'a) Medidas de protección, prevención y control contra plagas y enfermedades forestales' },
    { type: 'text', k: 'c112_b', l: 'b) Medidas de protección contra fauna dañina' }
  ] },
  { id: 'c113', chap: '11', title: '11.3 Incendios forestales', items: [
    { type: 'text', k: 'c113_a', l: 'a) Modo de alerta para la detección de incendios forestales' },
    { type: 'text', k: 'c113_b', l: 'b) Medidas para un primer control de incendios forestales' },
    { type: 'text', k: 'c113_c', l: 'c) Medidas preventivas y manejo de combustibles post intervención' }
  ] },
  { id: 'c114', chap: '11', title: '11.4 Suelos, aguas y humedales', items: [
    { type: 'text', k: 'c114_a', l: 'a) Medidas para el control de la erosión y la generación de sedimentos' },
    { type: 'text', k: 'c114_b', l: 'b) Medidas para evitar o minimizar la alteración de los humedales, manantiales, cuerpos y cursos de agua' },
    { type: 'text', k: 'c114_c', l: 'c) Ancho de la(s) faja(s) de protección y su justificación técnica' },
    { type: 'text', k: 'c114_d', l: 'd) Medidas a implementar en la construcción de caminos' }
  ] },
  { id: 'c115', chap: '11', title: '11.5 Al establecimiento de la regeneración y/o reforestación', items: [
    { type: 'text', k: 'c115', l: 'Medidas que aseguren el establecimiento de la regeneración y/o reforestación' }
  ] },
  { id: 'c116', chap: '11', title: '11.6 Otras medidas de protección', items: [
    { type: 'text', k: 'c116', l: 'Medidas de protección pertinentes a este Plan de Manejo y sus objetivos' }
  ] },
  /* ------------------------------ CAPÍTULO 12 ------------------------------ */
  { id: 'c12', chap: '12', title: '12 Información cuantitativa del recurso a intervenir', custom: 'inv' },
  /* ------------------------------ CAPÍTULO 13 ------------------------------ */
  { id: 'c13', chap: '13', title: '13 Cartografía', custom: 'carto' },
  /* ------------------------------ CAPÍTULO 14 ------------------------------ */
  { id: 'c14', chap: '14', title: '14 Firmas del interesado/a y del autor/a del Plan de Manejo', items: [
    { type: 'custom', render: () => App.renderFirmas() },
    { type: 'fields', fields: [{ k: 'f14_lugar', l: 'Lugar', t: 'txt' }, { k: 'f14_fecha', l: 'Fecha', t: 'date' }] },
    { type: 'note', text: 'Las personas firmantes declaran bajo juramento que los datos proporcionados en el presente Plan de Manejo son verdaderos.' }
  ] }
];

const CHAPTERS = [
  { id: 'inicio', n: '', t: 'Inicio' },
  { id: 'sol', n: 'S', t: 'Solicitud Ley 20.283' },
  { id: '1', n: '1', t: 'Antecedentes generales' },
  { id: '2', n: '2', t: 'Autor/a del Plan' },
  { id: '3', n: '3', t: 'Fondo Concursable' },
  { id: '4', n: '4', t: 'Diagnóstico predial' },
  { id: '5', n: '5', t: 'Descripción cualitativa' },
  { id: '6', n: '6', t: 'Objetivos de manejo' },
  { id: '7', n: '7', t: 'Tratamiento silvicultural', modo: 'corta' },
  { id: '8', n: '8', t: 'Otras actividades', modo: 'otras' },
  { id: '9', n: '9', t: 'Actividades de apoyo' },
  { id: '10', n: '10', t: 'Extracción de productos' },
  { id: '11', n: '11', t: 'Medidas de protección' },
  { id: '12', n: '12', t: 'Información cuantitativa', modo: 'corta' },
  { id: '13', n: '13', t: 'Cartografía' },
  { id: '14', n: '14', t: 'Firmas' },
  { id: 'revision', n: '✓', t: 'Revisión y exportación' }
];

/* Mapeo de Tipo Forestal del formulario a código Tipo_For de la cartografía (Tabla N°1, atributo 37) */
const TIPO_FOR_COD = { 'Alerce': 1, 'Araucaria': 2, 'Ciprés de la Cordillera': 3, 'Ciprés de las Guaitecas': 4, 'Coigüe de Magallanes': 5, 'Coigüe - Raulí - Tepa': 6, 'Lenga': 7, 'Roble - Raulí - Coigüe': 8, 'Roble - Hualo': 9, 'Siempreverde': 10, 'Esclerófilo': 11, 'Palma Chilena': 12 };
