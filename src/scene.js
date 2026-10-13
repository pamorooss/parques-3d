import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { setViewport } from './textures.js';

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e6e4dd');

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 300);
  camera.position.set(7, 5.5, 9);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(1.5, 0.6, 1.5);
  controls.maxPolarAngle = Math.PI / 2 - 0.01;
  controls.enableDamping = true; controls.dampingFactor = 0.12;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a968a, 0.95));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(8, 14, 6); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: '#d9d6cd', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.userData = { type: 'ground' };
  scene.add(ground);

  let grid = null, gridVisible = true;
  function setGridVisible(v) { gridVisible = v; if (grid) grid.visible = v; }
  function setGrid(V) {
    if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); }
    const n = 40;
    grid = new THREE.GridHelper(n * V, n, 0xa9a69c, 0xc6c3b9);
    grid.position.y = 0.002; grid.visible = gridVisible;
    // centrar la rejilla en las líneas de módulo
    grid.position.x = (n % 2) * V / 2; grid.position.z = (n % 2) * V / 2;
    scene.add(grid);
  }
  setGrid(1);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(clientX, clientY, objects, recursive = true) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(objects, recursive);
    return hits.length ? hits[0] : null;
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false); setViewport(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  function resetView(box) {
    if (!box) { camera.position.set(7, 5.5, 9); controls.target.set(1.5, 0.6, 1.5); return; }
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const d = Math.max(size.x, size.z, size.y * 1.5) * 1.6 + 3;
    controls.target.copy(c).setY(Math.min(c.y, size.y * 0.4));
    camera.position.set(c.x + d * 0.7, size.y + d * 0.55, c.z + d * 0.8);
  }

  // En modo visita o vuelo la cámara la mueve otro: OrbitControls queda desactivado y no se actualiza.
  function render() { if (controls.enabled) controls.update(); renderer.render(scene, camera); }
  return { renderer, scene, camera, controls, ground, setGrid, setGridVisible, pick, resize, render, resetView };
}
