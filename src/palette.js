// Paletas de color reales del fabricante.
// PVC ignífugo, coquillas y bridas: 12 colores (documento de la clienta).
export const PVC = [
  { id: 'negro',    name: 'Negro',    hex: '#1a1a1a' },
  { id: 'marron',   name: 'Marrón',   hex: '#6b3f23' },
  { id: 'beige',    name: 'Beige',    hex: '#d8c39b' },
  { id: 'blanco',   name: 'Blanco',   hex: '#f4f4f4' },
  { id: 'gris',     name: 'Gris',     hex: '#8f9296' },
  { id: 'verde',    name: 'Verde',    hex: '#2e9e4f' },
  { id: 'azul',     name: 'Azul',     hex: '#1d5fc2' },
  { id: 'amarillo', name: 'Amarillo', hex: '#f7c600' },
  { id: 'naranja',  name: 'Naranja',  hex: '#f26f21' },
  { id: 'rojo',     name: 'Rojo',     hex: '#d6222b' },
  { id: 'morado',   name: 'Morado',   hex: '#5d2d87' },
  { id: 'fucsia',   name: 'Fucsia',   hex: '#e1248c' },
];

// Red de protección: negro, blanco, azul.
export const RED = PVC.filter(c => ['negro', 'blanco', 'azul'].includes(c.id));

// Bolas 85 mm: carta "surtidos" + carta "creativos" + multicolor.
export const BOLAS = [
  { id: 'multicolor',    name: 'Multicolor',     hex: '#ffffff', mix: ['rojo', 'naranja', 'amarillo', 'verde_pistacho', 'verde_oscuro', 'turquesa', 'morado', 'fucsia', 'azul_oscuro', 'azul_pastel'] },
  { id: 'rojo',          name: 'Rojo',           hex: '#d6222b' },
  { id: 'naranja',       name: 'Naranja',        hex: '#f26f21' },
  { id: 'amarillo',      name: 'Amarillo',       hex: '#f7c600' },
  { id: 'verde_pistacho',name: 'Verde pistacho', hex: '#9ccc3c' },
  { id: 'verde_oscuro',  name: 'Verde oscuro',   hex: '#1f9a4a' },
  { id: 'turquesa',      name: 'Turquesa',       hex: '#1a9a9a' },
  { id: 'morado',        name: 'Morado',         hex: '#4a2370' },
  { id: 'fucsia',        name: 'Fucsia',         hex: '#e1248c' },
  { id: 'azul_oscuro',   name: 'Azul oscuro',    hex: '#1348b8' },
  { id: 'azul_pastel',   name: 'Azul pastel',    hex: '#2aa0e0' },
  { id: 'blanco',        name: 'Blanco',         hex: '#f4f4f4' },
  { id: 'transparente',  name: 'Transparente',   hex: '#e6edf5' },
  { id: 'gris_plata',    name: 'Gris plata',     hex: '#8a8e93' },
  { id: 'negro',         name: 'Negro',          hex: '#1a1a1a' },
  { id: 'beige',         name: 'Beige',          hex: '#cfc29a' },
  { id: 'marron',        name: 'Marrón',         hex: '#b5724a' },
  { id: 'mostaza',       name: 'Mostaza',        hex: '#d79a2b' },
  { id: 'dorado',        name: 'Dorado / oro',   hex: '#e2c27a' },
  { id: 'rosa_bebe',     name: 'Rosa bebé',      hex: '#f3a6c6' },
  { id: 'azul_bebe',     name: 'Azul bebé',      hex: '#9bb9cf' },
  { id: 'verde_bebe',    name: 'Verde bebé',     hex: '#9fd9c0' },
];

// Materiales auxiliares (no elegibles por el cliente).
export const EXTRA = {
  canamo: '#c9a86a',
  metal: '#b8bcc2',
  madera: '#b58a5a',
  cadena: '#777b80',
  lona: '#2b2b2b',
};

const ALL = [...PVC, ...BOLAS];
export function hexOf(id, fallback = '#888888') {
  if (!id) return fallback;
  if (id.startsWith('#')) return id;
  const c = ALL.find(x => x.id === id);
  if (c) return c.hex;
  return EXTRA[id] || fallback;
}
export function nameOf(id) {
  const c = ALL.find(x => x.id === id);
  return c ? c.name : id;
}
export function paletteOf(kind) {
  if (kind === 'red') return RED;
  if (kind === 'bolas') return BOLAS;
  return PVC;
}
