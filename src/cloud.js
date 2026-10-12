// Cliente de la API de la nube (netlify/functions/api.mjs).
// Si la API no existe (por ejemplo en `npm run dev` local) la app funciona en modo local.
const TOKEN = 'bolakids3d:token';
export const cloud = {
  available: null,   // null = sin comprobar, true/false
  token: localStorage.getItem(TOKEN) || '',

  async request(path, opts = {}) {
    const res = await fetch('/api/' + path, { ...opts, headers: { 'content-type': 'application/json', ...(this.token ? { authorization: 'Bearer ' + this.token } : {}), ...(opts.headers || {}) } });
    if (!(res.headers.get('content-type') || '').includes('json')) { const err = new Error('Sin API'); err.status = 0; throw err; } // p. ej. vite local devuelve HTML
    let data = null; try { data = await res.json(); } catch (e) { /* sin cuerpo */ }
    if (!res.ok) { const err = new Error((data && data.error) || `Error ${res.status}`); err.status = res.status; throw err; }
    return data;
  },
  // ¿Hay API y la sesión es válida? Devuelve 'ok' | 'login' | 'none' (sin nube) | 'unconfigured'.
  async probe() {
    try {
      await this.request('parques');
      this.available = true; return 'ok';
    } catch (e) {
      if (e.status === 401) { this.available = true; return 'login'; }
      if (e.status === 503) { this.available = true; return 'unconfigured'; }
      this.available = false; return 'none';
    }
  },
  async login(user, pass) {
    const r = await this.request('login', { method: 'POST', body: JSON.stringify({ user, pass }) });
    this.token = r.token; localStorage.setItem(TOKEN, r.token);
  },
  logout() { this.token = ''; localStorage.removeItem(TOKEN); },
  list() { return this.request('parques'); },
  load(id) { return this.request('parques/' + encodeURIComponent(id)); },
  save(id, state) { return this.request('parques/' + (id ? encodeURIComponent(id) : ''), { method: 'PUT', body: JSON.stringify(state) }); },
  remove(id) { return this.request('parques/' + encodeURIComponent(id), { method: 'DELETE' }); },
};
