import { getStore } from '@netlify/blobs';

// API de la app: login y parques guardados en la nube (Netlify Blobs).
// Usuario y contraseña se leen de las variables de entorno APP_USER y APP_PASS
// (Site configuration → Environment variables en Netlify). Nunca van en el código.

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
// Tolerante con espacios o comillas pegados al valor al escribirlo en el panel de Netlify.
const clean = s => String(s || '').trim().replace(/^["']+|["']+$/g, '').trim();
const creds = () => ({ user: clean(process.env.APP_USER), pass: clean(process.env.APP_PASS) });

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
// El token es un hash de usuario+contraseña+secreto: si cambia la contraseña, caducan todas las sesiones.
const tokenFor = ({ user, pass }) => sha(`${user}\n${pass}\n${process.env.APP_SECRET || 'parques-3d'}`);

async function authorized(req) {
  const c = creds(); if (!c.user || !c.pass) return false;
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') && h.slice(7) === await tokenFor(c);
}
const slug = s => String(s || 'parque').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'parque';

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, '');
  const parts = path.split('/').filter(Boolean);

  // Diagnóstico sin secretos: ¿están las variables y tienen la pinta esperada?
  if (parts[0] === 'health') {
    const c = creds();
    return json({ version: 3, userSet: !!c.user, passSet: !!c.pass, userOk: c.user.toLowerCase() === 'bolakids', passLen: c.pass.length, rawUserLen: (process.env.APP_USER || '').length, rawPassLen: (process.env.APP_PASS || '').length });
  }
  if (parts[0] === 'login' && req.method === 'POST') {
    const c = creds();
    if (!c.user || !c.pass) return json({ error: 'Faltan APP_USER y APP_PASS en las variables de entorno de Netlify.' }, 503);
    const body = await req.json().catch(() => ({}));
    const ok = clean(body.user).toLowerCase() === c.user.toLowerCase() && clean(body.pass) === c.pass; // usuario sin distinguir mayúsculas
    if (ok) return json({ token: await tokenFor(c) });
    return json({ error: 'Usuario o contraseña incorrectos.' }, 401);
  }
  if (!(await authorized(req))) return json({ error: 'No autorizado' }, 401);

  const store = getStore('parques');
  const index = async () => (await store.get('_index', { type: 'json' })) || {};
  const saveIndex = idx => store.setJSON('_index', idx);

  if (parts[0] === 'parques') {
    const id = parts[1];
    if (req.method === 'GET' && !id) {
      const idx = await index();
      return json(Object.values(idx).sort((a, b) => (b.updated || '').localeCompare(a.updated || '')));
    }
    if (req.method === 'GET') {
      const data = await store.get('p_' + id, { type: 'json' });
      return data ? json(data) : json({ error: 'No existe' }, 404);
    }
    if (req.method === 'PUT') {
      const data = await req.json().catch(() => null);
      if (!data || typeof data !== 'object') return json({ error: 'Datos no válidos' }, 400);
      const key = id || (slug(data.settings && data.settings.nombre) + '-' + Date.now().toString(36));
      const idx = await index();
      idx[key] = { id: key, nombre: (data.settings && data.settings.nombre) || 'Parque sin título', cliente: (data.settings && data.settings.cliente) || '', updated: new Date().toISOString(), modulos: (data.modules || []).length, piezas: (data.elements || []).length };
      await store.setJSON('p_' + key, data);
      await saveIndex(idx);
      return json(idx[key]);
    }
    if (req.method === 'DELETE' && id) {
      const idx = await index(); delete idx[id];
      await store.delete('p_' + id); await saveIndex(idx);
      return json({ ok: true });
    }
  }
  return json({ error: 'Ruta no encontrada' }, 404);
};

export const config = { path: '/api/*' };
