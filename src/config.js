// Ajustes editables del parque. Todo en centímetros salvo que se indique.
export const DEFAULT_SETTINGS = {
  nombre: 'Parque sin título',
  cliente: '',
  referencia: '',     // referencia del presupuesto (ficha)
  validez: 30,        // días de validez del presupuesto
  vano: 100,          // ancho del módulo (distancia entre postes)
  altura: 150,        // altura de cada planta
  coquillaLargo: 248, // largo de la coquilla de serie
  tuboLargos: '100, 215', // largos de tubo disponibles para el cálculo de corte
  bridasPorCoquilla: 3,
  bridasPorPack: 100,
  bridasRedPorMetro: 2,
  bridasRedPorPack: 100,
  bolasPorM2: 500,    // bolas por m² de piscina (profundidad habitual)
  iva: 21,
  margen: 0,          // % sobre el subtotal
  colorCoquilla: 'azul',
  colorRed: 'negro',
  colorSuelo: 'azul',
  mostrarCotas: true,
};

export const UNIONES = {
  embellecedor: { name: 'Embellecedor para tubo', ref: 'PMAEPT48112' },
  empalme:      { name: 'Unión tubo empalme recto', ref: 'PMA0848125' },
  codo90:       { name: 'Unión codo 90°', ref: 'PMA0648125' },
  tcorta:       { name: 'Unión tubo T corta', ref: 'PMA0248125' },
  codotriple:   { name: 'Unión codo triple', ref: 'PMA1848125' },
  cruzfija:     { name: 'Unión cruz fija', ref: 'PMA2248125' },
  triple:       { name: 'Unión triple', ref: 'PMA2048125' },
  cruz4:        { name: 'Unión cruz 4 salidas', ref: 'PMA2648125' },
  cruz5:        { name: 'Unión cruz 4 salidas + T (nudo de 6)', ref: 'PMA2648125+PMA0248125' },
  placabase:    { name: 'Unión placa base redonda', ref: 'PMA1048125' },
};
