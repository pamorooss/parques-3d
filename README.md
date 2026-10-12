# BolaKids 3D · Diseñador de parques infantiles

MVP de herramienta tipo "juego de construcción" para montar parques de bolas en 3D,
sacar la imagen para el cliente, las cotas y un presupuesto a partir de las piezas colocadas.

## Arrancar

```bash
cd app
npm install     # solo la primera vez
npm run dev     # abre http://localhost:5173
```

`npm run build` genera `dist/` (estático, se puede subir a cualquier hosting).

## Cómo se usa

- **Módulo (E)**: pon ancho, fondo y alto en cm y haz clic en el suelo (cae en casillas de su propio
  tamaño y se pega a los bordes de otros módulos) o en la cara de un módulo existente (se añade pegado a esa cara; en la
  tapa, encima). Cada módulo es independiente: selecciónalo para cambiar sus medidas o su posición
  en cm sin que se muevan los de al lado. Los tubos que coinciden se comparten y las uniones
  (codos, T, cruces) se calculan solas. Clic derecho lo quita.
- **Plataforma (S)**: clic en la tapa de un módulo para poner plataforma arriba; en un lateral, en su base.
- **Red (N)**: clic en una cara lateral para poner o quitar red de protección.
- **Catálogo**: elige una pieza y haz clic en el módulo donde va: queda centrada y luego se afina en cm
  con las flechas. El fantasma naranja marca el hueco y la flecha el frente; **R** gira.
- **Seleccionar (V)**: clic en cualquier pieza para cambiar sus colores, girarla o borrarla. Con una
  pieza o un módulo seleccionado aparece el pad de flechas: el selector **Paso** elige cuánto se mueve
  (½ módulo, 1 módulo o 25/10/5/1 cm); las flechas del teclado hacen lo mismo y con Mayús mueven 1 cm.
  Planta +/− sube o baja a la siguiente altura de apoyo. En el panel Pieza se escribe la posición
  exacta X/altura/Z en cm.
- **Pintar (P)** aplica el color actual a coquillas, redes, plataformas o juegos.
- **Foto** descarga un PNG; **Ficha** abre la ficha estándar para el cliente (imagen + cotas +
  presupuesto) lista para imprimir o guardar como PDF.
- **Guardar / Abrir** exporta e importa el parque en `.json`. El trabajo en curso se guarda solo en el navegador.

## Nube y acceso

Desplegado en Netlify, la app pide usuario y contraseña y guarda los parques en Netlify Blobs
(incluido en el plan gratis). Todo va en `netlify/functions/api.mjs`; el cliente está en `src/cloud.js`.

- Credenciales: variables de entorno `APP_USER` y `APP_PASS` en Netlify (Site configuration →
  Environment variables). Opcional `APP_SECRET` para firmar las sesiones. No van en el código.
- Botones de nube en la barra superior: guardar, abrir (lista de parques) y cerrar sesión. Una vez
  guardado, cada cambio se vuelve a guardar solo a los 2,5 s.
- En local con `npm run dev` no hay API: la app funciona en "modo local" y guarda en el navegador.
  Para probar la nube en local: `APP_USER=... APP_PASS=... npx netlify-cli dev`.

## Precios

`src/catalog.js` lleva los precios públicos de bolakids.com (09/10/2026). Las partidas sin tarifa
(tubo, uniones, toboganes, panel de acceso, cuerdas, túnel de red, puente en V) salen a 0 € marcadas
"sin tarifa": se pueden teclear en la tabla del presupuesto y se guardan con el parque. Las marcadas
"estimado" son aproximaciones derivadas de la web.

## Estructura del código

- `src/thumbs.js` miniaturas 3D del catálogo (se generan al arrancar con el renderer principal) · `src/state.js` modelo (módulos libres en metros, migración de formatos antiguos) y undo/redo · `src/structure.js` deriva tubos y uniones de los módulos
- `src/catalog.js` piezas, medidas y presupuesto · `src/palette.js` cartas de color reales
- `src/budget.js` presupuesto y optimización de corte de coquillas y tubo
- `src/models.js` geometría procedural de cada pieza · `src/render.js` escena · `src/ui.js` paneles
