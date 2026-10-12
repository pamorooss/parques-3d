// Catálogo de elementos del parque. Precios: tarifa pública bolakids.com (2026-10-09)
// salvo los marcados est (estimación) o pendiente (sin precio: 0, editable).
//
// place: 'cell' dentro del módulo · 'face' pegado a la cara frontal · 'hang' colgado del techo
//        · 'exit' sale del módulo hacia fuera (toboganes, rampas)

export const CATEGORIES = [
  { id: 'accesos', name: 'Accesos y toboganes' },
  { id: 'piscina', name: 'Piscina de bolas' },
  { id: 'juegos',  name: 'Juegos' },
  { id: 'cierres', name: 'Paneles y cierres' },
  { id: 'suelos',  name: 'Suelos' },
];

const pvc = (key, name, def) => ({ key, name, palette: 'pvc', default: def });

export const ELEMENTS = {
  // --- Piscina -----------------------------------------------------------
  piscina: {
    name: 'Piscina de bolas', cat: 'piscina', place: 'cell',
    desc: 'Borde de espuma D40 forrado en PVC ignífugo, base de madera. Llena el módulo.',
    slots: [pvc('borde', 'Borde', 'rojo'), { key: 'bolas', name: 'Bolas', palette: 'bolas', default: 'multicolor' }],
    dims: s => ({ l: s.vano, a: s.fondo || s.vano, h: 40 }),
    budget: (el, s) => {
      const fondo = s.fondo || s.vano;
      const perim = 2 * (s.vano + fondo) / 100;
      const bolas = Math.round((s.vano / 100) * (fondo / 100) * s.bolasPorM2);
      return [
        { key: 'piscina_borde', concepto: 'Piscina de bolas: borde de espuma', detalle: `${s.vano}×${fondo} cm, perímetro ${perim.toFixed(1)} m`, cantidad: perim, unidad: 'm', precio: 80, est: true },
        { key: 'bolas', concepto: 'Bolas 85 mm certificadas', detalle: `${s.bolasPorM2} bolas/m²`, cantidad: bolas, unidad: 'ud', precio: 0.2625 },
      ];
    },
  },
  canasta: {
    name: 'Canasta de bolas', cat: 'piscina', place: 'cell',
    desc: 'Tela PVC con orificio central sujeta en una esquina de la piscina.',
    slots: [pvc('color', 'Color', 'azul')], dims: () => ({ l: 80, a: 80, h: 5 }),
    budget: () => [{ key: 'canasta', concepto: 'Canasta', cantidad: 1, unidad: 'ud', precio: 60 }],
  },
  escalera1: { name: 'Escalera 1 escalón', cat: 'accesos', place: 'cell', slots: [pvc('color', 'Color', 'blanco')], dims: s => ({ l: s.vano, a: 30, h: 15 }), budget: () => [{ key: 'escalera1', concepto: 'Escalera 1 escalón', cantidad: 1, unidad: 'ud', precio: 80, est: true }], steps: 1 },
  escalera2: { name: 'Escalera 2 escalones', cat: 'accesos', place: 'cell', slots: [pvc('color', 'Color', 'blanco')], dims: s => ({ l: s.vano, a: 60, h: 30 }), budget: () => [{ key: 'escalera2', concepto: 'Escalera 2 escalones', cantidad: 1, unidad: 'ud', precio: 130, est: true }], steps: 2 },
  escalera3: { name: 'Escalera 3 escalones', cat: 'accesos', place: 'cell', slots: [pvc('color', 'Color', 'blanco')], dims: s => ({ l: s.vano, a: 90, h: 45 }), budget: () => [{ key: 'escalera3', concepto: 'Escalera 3 escalones', cantidad: 1, unidad: 'ud', precio: 180 }], steps: 3 },

  // --- Accesos -------------------------------------------------------------
  rampa_grande: {
    name: 'Rampa grande 10 escalones', cat: 'accesos', place: 'exit',
    desc: '210×100 cm, 10 escalones de 100×21×10 cm, espuma D40 y PVC ignífugo.',
    slots: [pvc('a', 'Color A', 'azul'), pvc('b', 'Color B', 'verde')], dims: () => ({ l: 210, a: 100, h: 100 }),
    budget: () => [{ key: 'rampa_grande', concepto: 'Rampa grande de acceso (10 escalones)', cantidad: 1, unidad: 'ud', precio: 1250, est: true }],
  },
  rampa_mediana: {
    name: 'Rampa mediana 6 escalones', cat: 'accesos', place: 'exit',
    desc: '126×55 cm, 6 escalones de 55×21×10 cm.',
    slots: [pvc('a', 'Color A', 'azul'), pvc('b', 'Color B', 'morado')], dims: () => ({ l: 126, a: 55, h: 60 }),
    budget: () => [{ key: 'rampa_mediana', concepto: 'Rampa mediana de acceso (6 escalones)', cantidad: 1, unidad: 'ud', precio: 700, est: true }],
  },
  tobogan_recto: {
    name: 'Tobogán recto', cat: 'accesos', place: 'exit',
    slots: [pvc('color', 'Color', 'amarillo')], dims: (s, el) => ({ l: Math.round(Math.max(s.caida ?? el.y * s.altura, 50) * 1.7 + 60), a: 60, h: Math.max(s.caida ?? el.y * s.altura, 50) }),
    budget: () => [{ key: 'tobogan_recto', concepto: 'Tobogán recto', cantidad: 1, unidad: 'ud', precio: 0, pendiente: true }],
  },
  tobogan_curvo: {
    name: 'Tobogán curvo', cat: 'accesos', place: 'exit',
    slots: [pvc('color', 'Color', 'rojo')], dims: (s, el) => ({ l: Math.round(Math.max(s.caida ?? el.y * s.altura, 50) * 1.5 + 60), a: 120, h: Math.max(s.caida ?? el.y * s.altura, 50) }),
    budget: () => [{ key: 'tobogan_curvo', concepto: 'Tobogán curvo', cantidad: 1, unidad: 'ud', precio: 0, pendiente: true }],
  },
  tobogan_espiral: {
    name: 'Tobogán tubo espiral', cat: 'accesos', place: 'exit',
    slots: [pvc('color', 'Color', 'verde')], dims: (s, el) => ({ l: 160, a: 160, h: Math.max(s.caida ?? el.y * s.altura, 50) }),
    budget: () => [{ key: 'tobogan_espiral', concepto: 'Tobogán tubo espiral cerrado', cantidad: 1, unidad: 'ud', precio: 0, pendiente: true }],
  },

  // --- Juegos ----------------------------------------------------------------
  saco_grande: { name: 'Saco colgante grande', cat: 'juegos', place: 'hang', desc: '30 cm Ø × 100 cm.', slots: [pvc('a', 'Color A', 'azul'), pvc('b', 'Color B', 'amarillo')], dims: () => ({ l: 30, a: 30, h: 100 }), budget: () => [{ key: 'saco_grande', concepto: 'Saco colgante grande 30×100', cantidad: 1, unidad: 'ud', precio: 120 }] },
  saco_pequeno: { name: 'Saco colgante pequeño', cat: 'juegos', place: 'hang', desc: '15 cm Ø × 70 cm.', slots: [pvc('a', 'Color A', 'fucsia'), pvc('b', 'Color B', 'verde')], dims: () => ({ l: 15, a: 15, h: 70 }), budget: () => [{ key: 'saco_pequeno', concepto: 'Saco colgante pequeño 15×70', cantidad: 1, unidad: 'ud', precio: 80 }] },
  boya: { name: 'Boya con cuerda', cat: 'juegos', place: 'hang', slots: [pvc('color', 'Color', 'verde')], dims: () => ({ l: 40, a: 40, h: 50 }), budget: () => [{ key: 'boya', concepto: 'Boya de barco con cuerda', cantidad: 1, unidad: 'ud', precio: 70 }] },
  cuerdas: { name: 'Cuerdas trepadoras', cat: 'juegos', place: 'hang', desc: 'Cuerdas con nudos color cáñamo.', slots: [], dims: s => ({ l: s.vano, a: 20, h: s.altura }), budget: () => [{ key: 'cuerdas', concepto: 'Cuerdas trepadoras cáñamo (juego de 3)', cantidad: 1, unidad: 'ud', precio: 0, pendiente: true }] },
  piramide: { name: 'Pirámide', cat: 'juegos', place: 'cell', slots: [pvc('color', 'Color', 'fucsia')], dims: () => ({ l: 60, a: 60, h: 60 }), budget: () => [{ key: 'piramide', concepto: 'Pirámide de espuma', cantidad: 1, unidad: 'ud', precio: 160 }] },
  cubo: { name: 'Cubo', cat: 'juegos', place: 'cell', slots: [pvc('color', 'Color', 'naranja')], dims: () => ({ l: 50, a: 50, h: 50 }), budget: () => [{ key: 'cubo', concepto: 'Cubo de espuma', cantidad: 1, unidad: 'ud', precio: 120, est: true }] },
  cilindro: { name: 'Cilindro', cat: 'juegos', place: 'cell', slots: [pvc('a', 'Lateral', 'azul'), pvc('b', 'Tapa', 'amarillo')], dims: () => ({ l: 60, a: 60, h: 50 }), budget: () => [{ key: 'cilindro', concepto: 'Cilindro de espuma', cantidad: 1, unidad: 'ud', precio: 120 }] },
  rodillo: { name: 'Rodillo giratorio', cat: 'juegos', place: 'cell', desc: 'Espuma D40 con tubo galvanizado central.', slots: [pvc('color', 'Color', 'amarillo')], dims: s => ({ l: s.vano - 20, a: 50, h: 50 }), budget: () => [{ key: 'rodillo', concepto: 'Rodillo giratorio horizontal', cantidad: 1, unidad: 'ud', precio: 180 }] },
  puente_tibetano: { name: 'Puente tibetano', cat: 'juegos', place: 'cell', desc: 'Tablas de madera con espuma D80 unidas con cadenas.', slots: [pvc('a', 'Tabla A', 'azul'), pvc('b', 'Tabla B', 'amarillo')], dims: s => ({ l: s.vano, a: 60, h: 20 }), budget: () => [{ key: 'puente_tibetano', concepto: 'Puente tibetano (pasarela)', cantidad: 1, unidad: 'ud', precio: 425 }] },
  puente_fijo: { name: 'Puente fijo con cuerdas', cat: 'juegos', place: 'cell', desc: 'Pasarela recta con cuerdas en V.', slots: [pvc('color', 'Color', 'azul')], dims: s => ({ l: s.vano, a: 60, h: 90 }), budget: () => [{ key: 'puente_fijo', concepto: 'Puente fijo con cuerdas (puente en V)', cantidad: 1, unidad: 'ud', precio: 0, pendiente: true }] },
  tunel_cintas: { name: 'Túnel de cintas', cat: 'juegos', place: 'cell', desc: 'Puente tubular de cintas tejidas.', slots: [pvc('a', 'Cinta A', 'fucsia'), pvc('b', 'Cinta B', 'verde')], dims: s => ({ l: s.vano, a: 70, h: 70 }), budget: () => [{ key: 'tunel_cintas', concepto: 'Túnel / puente tubular de cintas', cantidad: 1, unidad: 'ud', precio: 195 }] },
  tunel_red: { name: 'Túnel de red', cat: 'juegos', place: 'cell', slots: [{ key: 'color', name: 'Color', palette: 'red', default: 'azul' }], dims: s => ({ l: s.vano, a: 70, h: 70 }), budget: () => [{ key: 'tunel_red', concepto: 'Túnel de red tubular', cantidad: 1, unidad: 'ud', precio: 0, pendiente: true }] },
  prot_cama: { name: 'Protección cama elástica', cat: 'juegos', place: 'cell', slots: [pvc('color', 'Color', 'verde')], dims: s => ({ l: s.vano, a: s.fondo || s.vano, h: 10 }), budget: () => [{ key: 'prot_cama', concepto: 'Protección de cama elástica', cantidad: 1, unidad: 'ud', precio: 625 }] },

  // --- Paneles y cierres --------------------------------------------------
  cortina: { name: 'Cortina de tiras', cat: 'cierres', place: 'face', slots: [pvc('a', 'Tira A', 'morado'), pvc('b', 'Tira B', 'verde')], dims: s => ({ l: s.vano, a: 3, h: Math.round(s.altura * 0.8) }), budget: () => [{ key: 'cortina', concepto: 'Cortina de tiras PVC', cantidad: 1, unidad: 'ud', precio: 120 }] },
  panel_acceso: { name: 'Panel de acceso', cat: 'cierres', place: 'face', desc: 'Madera 2 cm + espuma D20, círculo central.', slots: [pvc('color', 'Color', 'azul')], dims: s => ({ l: s.vano, a: 6, h: s.vano }), budget: () => [{ key: 'panel_acceso', concepto: 'Panel de acceso con círculo', cantidad: 1, unidad: 'ud', precio: 0, pendiente: true }] },
  cremallera: { name: 'Cremallera de acceso', cat: 'cierres', place: 'face', slots: [pvc('color', 'Color', 'rojo')], dims: s => ({ l: 8, a: 2, h: Math.round(s.altura * 0.8) }), budget: () => [{ key: 'cremallera', concepto: 'Cremallera de acceso en red', cantidad: 1, unidad: 'ud', precio: 60 }] },
  zapatero: { name: 'Zapatero', cat: 'cierres', place: 'face', desc: '120×120 cm, bolsillos de PVC.', slots: [pvc('a', 'Fondo', 'azul'), pvc('b', 'Bolsillos', 'fucsia')], dims: () => ({ l: 120, a: 5, h: 120 }), budget: () => [{ key: 'zapatero', concepto: 'Zapatero PVC 120×120', cantidad: 1, unidad: 'ud', precio: 120 }] },
  red_trepa: { name: 'Red trepadora cáñamo', cat: 'cierres', place: 'face', slots: [], dims: s => ({ l: s.vano, a: 3, h: s.altura }), budget: () => [{ key: 'red_trepa', concepto: 'Red de abordaje / trepa (cáñamo)', cantidad: 1, unidad: 'ud', precio: 0, pendiente: true }] },

  // --- Suelos -------------------------------------------------------------
  tatami: { name: 'Tatami puzzle', cat: 'suelos', place: 'cell', desc: 'Puzzle 100×100×2 cm bicolor.', slots: [pvc('a', 'Color A', 'rojo'), pvc('b', 'Color B', 'azul')], dims: s => ({ l: s.vano, a: s.fondo || s.vano, h: 2 }), budget: (el, s) => [{ key: 'tatami', concepto: 'Tatami puzzle 100×100×2', cantidad: Math.ceil((s.vano / 100) * ((s.fondo || s.vano) / 100)), unidad: 'ud', precio: 23.99 }] },
};

export function elementDef(type) { return ELEMENTS[type]; }
export function defaultColors(type) {
  const d = ELEMENTS[type]; const c = {};
  for (const s of d.slots) c[s.key] = s.default;
  return c;
}

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
