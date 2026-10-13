// Grabación de vídeo de la vista 3D con MediaRecorder. Se graba desde un canvas 2D
// intermedio: en cada frame se copia el canvas WebGL y se pinta encima el rótulo
// (nombre del parque y logo), que así forman parte del vídeo.
const MIMES = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
export const extFor = mime => /mp4/.test(mime || '') ? 'mp4' : 'webm';

export class Recorder {
  constructor(sc) {
    this.sc = sc; this.recording = false; this.rec = null; this.chunks = []; this.t0 = 0; this.overlay = null;
    this.canvas = document.createElement('canvas'); this.ctx = this.canvas.getContext('2d');
  }
  static supported() { return typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream; }
  static mime() { return Recorder.supported() ? (MIMES.find(m => MediaRecorder.isTypeSupported(m)) || '') : ''; }

  start({ overlay = null, fps = 30 } = {}) {
    if (this.recording) return;
    const src = this.sc.renderer.domElement;
    this.canvas.width = src.width; this.canvas.height = src.height; this.overlay = overlay;
    this.stream = this.canvas.captureStream(fps);
    const mime = Recorder.mime();
    this.rec = new MediaRecorder(this.stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 12e6 });
    this.chunks = [];
    this.rec.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.done = new Promise(res => { this.rec.onstop = () => res(new Blob(this.chunks, { type: this.rec.mimeType || mime || 'video/webm' })); });
    this.rec.start(250); this.t0 = performance.now(); this.recording = true;
    this.frame();
  }
  get elapsed() { return this.recording ? (performance.now() - this.t0) / 1000 : 0; }

  // Llamar justo después de renderizar.
  frame() {
    if (!this.recording) return;
    const src = this.sc.renderer.domElement, c = this.canvas, g = this.ctx;
    g.drawImage(src, 0, 0, c.width, c.height);
    if (this.overlay) this.drawOverlay(g, c.width, c.height);
  }
  drawOverlay(g, W, H) {
    const { title, logo } = this.overlay; const s = Math.max(0.6, W / 1400), pad = 26 * s;
    const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
    if (title) {
      g.font = `800 ${32 * s}px "Plus Jakarta Sans", Helvetica, Arial, sans-serif`;
      const tw = g.measureText(title).width, h = 56 * s, w = tw + 44 * s;
      g.fillStyle = 'rgba(30,34,31,0.72)'; rr(pad, H - pad - h, w, h, h / 2);
      g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(title, pad + 22 * s, H - pad - h / 2 + 1.5 * s);
    }
    if (logo && logo.complete && logo.naturalWidth) {
      const lh = 50 * s, lw = lh * logo.naturalWidth / logo.naturalHeight, bh = lh + 18 * s, bw = lw + 26 * s;
      g.fillStyle = 'rgba(255,255,255,0.93)'; rr(W - pad - bw, H - pad - bh, bw, bh, 14 * s);
      g.drawImage(logo, W - pad - bw + 13 * s, H - pad - bh + 9 * s, lw, lh);
    }
  }
  async stop() {
    if (!this.recording) return null;
    this.recording = false;
    try { this.rec.requestData && this.rec.requestData(); } catch (e) { /* nada */ }
    this.rec.stop();
    const blob = await this.done;
    this.stream.getTracks().forEach(t => t.stop());
    return blob;
  }
}

export function downloadBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
