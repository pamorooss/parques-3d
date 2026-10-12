// Catálogo de elementos del parque. Precios: tarifa pública bolakids.com (2026-10-09)
// salvo los marcados est (estimación) o pendiente (sin precio: 0, editable).
//
// place: 'cell' dentro del módulo · 'face' pegado a la cara frontal · 'hang' colgado del techo
//        · 'exit' sale del módulo hacia fuera (toboganes, rampas)
// dims(s, el): medidas por defecto en cm { l: largo (X), a: ancho/fondo (Z), h: alto }. El usuario
//        puede cambiarlas en cada pieza (el.size) y el modelo 3D y el presupuesto las usan.
// slots: colores. Las piezas con tres colores usan las claves a, b, c (c opcional) y, si tienen
//        `estilos`, un acabado (liso, mitades, rayas, franjas, cuadros).

export const CATEGORIES = [
  { id: 'accesos', name: 'Accesos y toboganes' },
  { id: 'piscina', name: 'Piscina y bolas' },
  { id: 'juegos',  name: 'Juegos y figuras' },
  { id: 'redes',   name: 'Redes y cintas' },
  { id: 'cierres', name: 'Paredes y cierres' },
  { id: 'suelos',  name: 'Suelos' },
];

const pvc = (key, name, def) => ({ key, name, palette: 'pvc', default: def });
// Tres colores: A obligatorio, B y C opcionales ('ninguno' = sin usar).
const c3 = (a, b = 'ninguno', c = 'ninguno') => [
  { ...pvc('a', 'Color A', a) }, { ...pvc('b', 'Color B', b), optional: true }, { ...pvc('c', 'Color C', c), optional: true },
];
const ud = (key, concepto, precio, flags = {}) => () => [{ key, concepto, cantidad: 1, unidad: 'ud', precio, ...flags }];
const pend = (key, concepto) => ud(key, concepto, 0, { pendiente: true });
const caida = (s, min) => Math.max(s.caida || 0, min);

export const ELEMENTS = {
  // --- Piscina y bolas -----------------------------------------------------
  piscina: {
    name: 'Piscina de bolas', cat: 'piscina', place: 'cell',
    desc: 'Borde de espuma D40 forrado en PVC ignífugo, base de madera. Por defecto llena el módulo.',
    slots: [pvc('borde', 'Borde', 'rojo'), { key: 'bolas', name: 'Bolas', palette: 'bolas', default: 'multicolor' }],
    dims: s => ({ l: s.vano, a: s.fondo || s.vano, h: 40 }),
    budget: (el, s, d) => {
      const perim = 2 * (d.l + d.a) / 100;
      const bolas = Math.round((d.l / 100) * (d.a / 100) * s.bolasPorM2);
      return [
        { key: 'piscina_borde', concepto: 'Piscina de bolas: borde de espuma', detalle: `${d.l}×${d.a} cm, perímetro ${perim.toFixed(1)} m`, cantidad: perim, unidad: 'm', precio: 80, est: true },
        { key: 'bolas', concepto: 'Bolas 85 mm certificadas', detalle: `${s.bolasPorM2} bolas/m²`, cantidad: bolas, unidad: 'ud', precio: 0.2625 },
      ];
    },
  },
  bolas: {
    name: 'Bolas sueltas', cat: 'piscina', place: 'cell',
    desc: 'Zona de bolas sin piscina (el módulo o sus redes hacen de contención). La altura es la profundidad de bolas.',
    slots: [{ key: 'bolas', name: 'Bolas', palette: 'bolas', default: 'multicolor' }],
    dims: s => ({ l: s.vano, a: s.fondo || s.vano, h: 30 }),
    budget: (el, s, d) => [{ key: 'bolas', concepto: 'Bolas 85 mm certificadas', detalle: `${s.bolasPorM2} bolas/m²`, cantidad: Math.round((d.l / 100) * (d.a / 100) * s.bolasPorM2 * (d.h / 30)), unidad: 'ud', precio: 0.2625 }],
  },
  canasta: {
    name: 'Canasta de bolas', cat: 'piscina', place: 'cell',
    desc: 'Tela PVC con orificio central sujeta en una esquina de la piscina.',
    slots: [pvc('color', 'Color', 'azul')], dims: () => ({ l: 80, a: 80, h: 5 }),
    budget: ud('canasta', 'Canasta', 60),
  },

  // --- Accesos -------------------------------------------------------------
  escalera1: { name: 'Escalera 1 escalón', cat: 'accesos', place: 'cell', slots: c3('blanco'), dims: s => ({ l: s.vano, a: 30, h: 15 }), budget: ud('escalera1', 'Escalera 1 escalón', 80, { est: true }), steps: 1 },
  escalera2: { name: 'Escalera 2 escalones', cat: 'accesos', place: 'cell', slots: c3('blanco'), dims: s => ({ l: s.vano, a: 60, h: 30 }), budget: ud('escalera2', 'Escalera 2 escalones', 130, { est: true }), steps: 2 },
  escalera3: { name: 'Escalera 3 escalones', cat: 'accesos', place: 'cell', slots: c3('blanco'), dims: s => ({ l: s.vano, a: 90, h: 45 }), budget: ud('escalera3', 'Escalera 3 escalones', 180), steps: 3 },
  rampa_grande: {
    name: 'Rampa grande 10 escalones', cat: 'accesos', place: 'exit',
    desc: '10 escalones de espuma D40 y PVC ignífugo. El alto se ajusta a la planta; cambia largo, ancho o alto en la pieza.',
    slots: c3('azul', 'verde'), dims: s => ({ l: 210, a: 100, h: caida(s, 100) }),
    budget: ud('rampa_grande', 'Rampa grande de acceso (10 escalones)', 1250, { est: true }), steps: 10,
  },
  rampa_mediana: {
    name: 'Rampa mediana 6 escalones', cat: 'accesos', place: 'exit',
    desc: '6 escalones de espuma D40 y PVC ignífugo.',
    slots: c3('azul', 'morado'), dims: s => ({ l: 126, a: 55, h: caida(s, 60) }),
    budget: ud('rampa_mediana', 'Rampa mediana de acceso (6 escalones)', 700, { est: true }), steps: 6,
  },
  tobogan_recto: {
    name: 'Tobogán recto', cat: 'accesos', place: 'exit', desc: 'Ancho 65 cm por defecto (editable). Color B para los laterales.',
    slots: c3('amarillo'), dims: s => ({ l: Math.round(caida(s, 50) * 1.7 + 60), a: 65, h: caida(s, 50) }),
    budget: pend('tobogan_recto', 'Tobogán recto'),
  },
  tobogan_curvo: {
    name: 'Tobogán curvo', cat: 'accesos', place: 'exit', desc: 'Color B para los laterales.',
    slots: c3('rojo'), dims: s => ({ l: Math.round(caida(s, 50) * 1.5 + 60), a: 120, h: caida(s, 50) }),
    budget: pend('tobogan_curvo', 'Tobogán curvo'),
  },
  tobogan_espiral: {
    name: 'Tobogán tubo espiral', cat: 'accesos', place: 'exit',
    slots: c3('verde'), dims: s => ({ l: 160, a: 160, h: caida(s, 50) }),
    budget: pend('tobogan_espiral', 'Tobogán tubo espiral cerrado'),
  },

  // --- Juegos y figuras ------------------------------------------------------
  saco_grande: { name: 'Saco colgante grande', cat: 'juegos', place: 'hang', desc: '30 cm Ø × 100 cm.', slots: c3('azul', 'amarillo'), estilos: true, estilo: 'mitades', dims: () => ({ l: 30, a: 30, h: 100 }), budget: ud('saco_grande', 'Saco colgante grande 30×100', 120) },
  saco_pequeno: { name: 'Saco colgante pequeño', cat: 'juegos', place: 'hang', desc: '15 cm Ø × 70 cm.', slots: c3('fucsia', 'verde'), estilos: true, estilo: 'mitades', dims: () => ({ l: 15, a: 15, h: 70 }), budget: ud('saco_pequeno', 'Saco colgante pequeño 15×70', 80) },
  sacos_fila: {
    name: 'Fila de sacos colgantes', cat: 'juegos', place: 'hang', desc: 'Varios sacos colgados en fila a lo ancho del módulo (uno cada 25 cm). Los colores se alternan.',
    slots: c3('azul', 'amarillo', 'fucsia'), estilos: true, estilo: 'liso', dims: s => ({ l: s.vano, a: 24, h: 100 }),
    budget: (el, s, d) => [{ key: 'saco_grande', concepto: 'Saco colgante grande 30×100', cantidad: Math.max(2, Math.floor(d.l / 25)), unidad: 'ud', precio: 120 }],
  },
  sacos_diagonal: {
    name: 'Sacos diagonales', cat: 'juegos', place: 'cell', desc: 'Sacos inclinados 45° que cruzan el módulo de lado a lado, en serie. Los colores se alternan.',
    slots: c3('azul', 'verde', 'amarillo'), estilos: true, estilo: 'liso', dims: s => ({ l: s.vano, a: s.fondo || s.vano, h: s.altura }),
    budget: (el, s, d) => [{ key: 'saco_diagonal', concepto: 'Saco diagonal 45° (lado a lado)', cantidad: Math.max(1, Math.floor(d.l / 40)), unidad: 'ud', precio: 0, pendiente: true }],
  },
  boya: { name: 'Boya con cuerda', cat: 'juegos', place: 'hang', slots: c3('verde'), dims: () => ({ l: 40, a: 40, h: 50 }), budget: ud('boya', 'Boya de barco con cuerda', 70) },
  cuerdas: { name: 'Cuerdas trepadoras', cat: 'juegos', place: 'hang', desc: 'Cuerdas con nudos color cáñamo.', slots: [], dims: s => ({ l: s.vano, a: 20, h: s.altura }), budget: pend('cuerdas', 'Cuerdas trepadoras cáñamo (juego de 3)') },
  piramide: { name: 'Pirámide', cat: 'juegos', place: 'cell', slots: c3('fucsia'), estilos: true, dims: () => ({ l: 60, a: 60, h: 60 }), budget: ud('piramide', 'Pirámide de espuma', 160) },
  cubo: { name: 'Cubo', cat: 'juegos', place: 'cell', slots: c3('naranja'), estilos: true, dims: () => ({ l: 50, a: 50, h: 50 }), budget: ud('cubo', 'Cubo de espuma', 120, { est: true }) },
  cilindro: { name: 'Cilindro', cat: 'juegos', place: 'cell', desc: 'Color B para la tapa.', slots: c3('azul', 'amarillo'), estilos: true, dims: () => ({ l: 60, a: 60, h: 50 }), budget: ud('cilindro', 'Cilindro de espuma', 120) },
  hexagono: { name: 'Hexágono de espuma', cat: 'juegos', place: 'cell', desc: 'Prisma hexagonal de espuma forrada. Cambia el alto para hacer escalones (20, 30, 40 cm).', slots: c3('rojo'), estilos: true, dims: () => ({ l: 60, a: 52, h: 30 }), budget: pend('hexagono', 'Hexágono de espuma') },
  semicilindros: {
    name: 'Semicilindros sobre base', cat: 'juegos', place: 'cell', desc: 'Tres medios cilindros de espuma sobre una colchoneta base.',
    slots: [...c3('verde', 'azul', 'amarillo'), pvc('base', 'Base', 'naranja')], dims: () => ({ l: 120, a: 100, h: 40 }),
    budget: pend('semicilindros', 'Semicilindros de espuma sobre base (3)'),
  },
  rodillo: { name: 'Rodillo giratorio', cat: 'juegos', place: 'cell', desc: 'Espuma D40 con tubo galvanizado central.', slots: c3('amarillo'), estilos: true, dims: s => ({ l: s.vano - 20, a: 50, h: 50 }), budget: ud('rodillo', 'Rodillo giratorio horizontal', 180) },
  puente_tibetano: { name: 'Puente tibetano', cat: 'juegos', place: 'cell', desc: 'Tablas de madera con espuma D80 unidas con cadenas.', slots: c3('azul', 'amarillo'), dims: s => ({ l: s.vano, a: 60, h: 20 }), budget: ud('puente_tibetano', 'Puente tibetano (pasarela)', 425) },
  puente_fijo: { name: 'Puente fijo con cuerdas', cat: 'juegos', place: 'cell', desc: 'Pasarela recta con cuerdas en V.', slots: c3('azul'), dims: s => ({ l: s.vano, a: 60, h: 90 }), budget: pend('puente_fijo', 'Puente fijo con cuerdas (puente en V)') },
  tunel_cintas: { name: 'Túnel de cintas', cat: 'juegos', place: 'cell', desc: 'Puente tubular de cintas tejidas.', slots: c3('fucsia', 'verde'), dims: s => ({ l: s.vano, a: 70, h: 70 }), budget: ud('tunel_cintas', 'Túnel / puente tubular de cintas', 195) },
  prot_cama: { name: 'Protección cama elástica', cat: 'juegos', place: 'cell', slots: c3('verde'), dims: s => ({ l: s.vano, a: s.fondo || s.vano, h: 10 }), budget: ud('prot_cama', 'Protección de cama elástica', 625) },

  // --- Redes y cintas ----------------------------------------------------------
  tunel_red: { name: 'Túnel de red', cat: 'redes', place: 'cell', slots: [{ key: 'color', name: 'Color', palette: 'red', default: 'azul' }], dims: s => ({ l: s.vano, a: 70, h: 70 }), budget: pend('tunel_red', 'Túnel de red tubular') },
  red_cintas: {
    name: 'Red de cintas tejida', cat: 'redes', place: 'cell', desc: 'Cintas de PVC tejidas y cosidas en cruz. Suelo o paso horizontal.',
    slots: c3('azul'), dims: s => ({ l: s.vano, a: s.fondo || s.vano, h: 4 }),
    budget: (el, s, d) => [{ key: 'red_cintas', concepto: 'Red de cintas tejida', detalle: `${d.l}×${d.a} cm`, cantidad: +((d.l / 100) * (d.a / 100)).toFixed(2), unidad: 'm²', precio: 0, pendiente: true }],
  },
  red_cintas_hueco: {
    name: 'Red de cintas con hueco', cat: 'redes', place: 'cell', desc: 'Red de cintas tejida con hueco central ribeteado para pasar.',
    slots: c3('verde'), dims: s => ({ l: s.vano, a: s.fondo || s.vano, h: 4 }),
    budget: (el, s, d) => [{ key: 'red_cintas_hueco', concepto: 'Red de cintas con hueco central', detalle: `${d.l}×${d.a} cm`, cantidad: +((d.l / 100) * (d.a / 100)).toFixed(2), unidad: 'm²', precio: 0, pendiente: true }],
  },
  red_arana: {
    name: 'Red tela de araña', cat: 'redes', place: 'cell', desc: 'Cuerda trenzada en tela de araña con aro central.',
    slots: [pvc('cuerda', 'Cuerda', 'negro'), pvc('aro', 'Aro', 'rojo')], dims: s => ({ l: s.vano, a: s.fondo || s.vano, h: 6 }),
    budget: pend('red_arana', 'Red tela de araña con aro'),
  },
  red_trepa: { name: 'Red trepadora cáñamo', cat: 'redes', place: 'face', slots: [], dims: s => ({ l: s.vano, a: 3, h: s.altura }), budget: pend('red_trepa', 'Red de abordaje / trepa (cáñamo)') },

  // --- Paredes y cierres --------------------------------------------------
  pared_cuadrada: {
    name: 'Pared rectangular', cat: 'cierres', place: 'cell', desc: 'Panel de espuma forrado para tapar laterales (rampas, huecos). Medidas editables.',
    slots: c3('azul'), estilos: true, dims: s => ({ l: s.vano, a: 6, h: 100 }),
    budget: (el, s, d) => [{ key: 'pared_cuadrada', concepto: 'Pared rectangular de espuma', detalle: `${d.l}×${d.h} cm`, cantidad: +((d.l / 100) * (d.h / 100)).toFixed(2), unidad: 'm²', precio: 0, pendiente: true }],
  },
  pared_triangular: {
    name: 'Pared triangular', cat: 'cierres', place: 'cell', desc: 'Panel triangular para cerrar el lateral de una rampa: largo = largo de la rampa, alto = su alto.',
    slots: c3('azul'), dims: s => ({ l: 210, a: 6, h: caida(s, 100) }),
    budget: (el, s, d) => [{ key: 'pared_triangular', concepto: 'Pared triangular de espuma', detalle: `${d.l}×${d.h} cm`, cantidad: +((d.l / 100) * (d.h / 100) / 2).toFixed(2), unidad: 'm²', precio: 0, pendiente: true }],
  },
  protector_columna: {
    name: 'Protector de columna', cat: 'cierres', place: 'cell', desc: 'Perfil en L de espuma forrada para esquinas y columnas del local.',
    slots: c3('amarillo'), dims: s => ({ l: 20, a: 20, h: s.altura }),
    budget: (el, s, d) => [{ key: 'protector_columna', concepto: 'Protector de columna en L', detalle: `${d.h} cm de alto`, cantidad: 1, unidad: 'ud', precio: 0, pendiente: true }],
  },
  cortina: { name: 'Cortina de tiras', cat: 'cierres', place: 'face', desc: 'Las tiras alternan los colores elegidos.', slots: c3('morado', 'verde'), dims: s => ({ l: s.vano, a: 3, h: Math.round(s.altura * 0.8) }), budget: ud('cortina', 'Cortina de tiras PVC', 120) },
  panel_acceso: { name: 'Panel de acceso', cat: 'cierres', place: 'face', desc: 'Madera 2 cm + espuma D20, círculo central.', slots: c3('azul'), dims: s => ({ l: s.vano, a: 6, h: s.vano }), budget: pend('panel_acceso', 'Panel de acceso con círculo') },
  cremallera: { name: 'Cremallera de acceso', cat: 'cierres', place: 'face', slots: c3('rojo'), dims: s => ({ l: 8, a: 2, h: Math.round(s.altura * 0.8) }), budget: ud('cremallera', 'Cremallera de acceso en red', 60) },
  zapatero: { name: 'Zapatero', cat: 'cierres', place: 'face', desc: 'Bolsillos de PVC. Color B para los bolsillos.', slots: c3('azul', 'fucsia'), dims: () => ({ l: 120, a: 5, h: 120 }), budget: ud('zapatero', 'Zapatero PVC 120×120', 120) },

  // --- Suelos -------------------------------------------------------------
  tatami: { name: 'Tatami puzzle', cat: 'suelos', place: 'cell', desc: 'Puzzle 100×100×2 cm bicolor.', slots: c3('rojo', 'azul'), dims: s => ({ l: s.vano, a: s.fondo || s.vano, h: 2 }), budget: (el, s, d) => [{ key: 'tatami', concepto: 'Tatami puzzle 100×100×2', cantidad: Math.ceil((d.l / 100) * (d.a / 100)), unidad: 'ud', precio: 23.99 }] },
};

export function elementDef(type) { return ELEMENTS[type]; }
export function defaultColors(type) {
  const d = ELEMENTS[type]; const c = {};
  for (const s of d.slots) c[s.key] = s.default;
  return c;
}
// Medidas efectivas (cm) de una pieza: las del catálogo salvo lo que el usuario haya cambiado.
export function elementDims(el, s) {
  const d = ELEMENTS[el.type].dims(s, el);
  const o = el.size || {};
  return { l: o.l > 0 ? o.l : d.l, a: o.a > 0 ? o.a : d.a, h: o.h > 0 ? o.h : d.h };
}
// Colores activos de una pieza de tres colores (ids), en orden A, B, C.
export function activeColors(el) {
  const slots = ELEMENTS[el.type].slots;
  const ids = ['a', 'b', 'c'].map(k => { const v = el.colors && el.colors[k]; if (v !== undefined) return v; const sl = slots.find(s => s.key === k); return sl ? sl.default : undefined; }).filter(id => id && id !== 'ninguno');
  return ids.length ? ids : ['azul'];
}
export function elementStyle(el) { const d = ELEMENTS[el.type]; return d.estilos ? (el.estilo || d.estilo || 'liso') : 'liso'; }

// Partidas genéricas (no son elementos): claves y precios por defecto.
export const GENERIC_PRICES = {
  tubo_m:       { concepto: 'Tubo acero galvanizado Ø48', unidad: 'm', precio: 0, pendiente: true },
  union:        { concepto: 'Uniones Ø48', unidad: 'ud', precio: 0, pendiente: true },
  coquilla:     { concepto: 'Coquilla 248 cm', unidad: 'ud', precio: 17.99 },
  bridas_pack:  { concepto: 'Bridas cabeza plana 400×9 (pack)', unidad: 'pack', precio: 23.99 },
  red_m2:       { concepto: 'Red protección 3×3 cm homologada', unidad: 'm²', precio: 10 },
  bridas_red:   { concepto: 'Bridas sujeta redes (pack)', unidad: 'pack', precio: 18 },
  plataforma_m2:{ concepto: 'Plataforma suelo madera 2 cm + espuma D80 + PVC', unidad: 'm²', precio: 80 },
  tapones:      { concepto: 'Tapones antivandálicos (pack)', unidad: 'pack', precio: 18 },
};
