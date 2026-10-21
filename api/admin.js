// Panel de administración de la tienda: lista los productos y guarda tamaños, precios y visibilidad
// en productos.json del repositorio de GitHub. Vercel publica el cambio automáticamente.
//
// Variables de entorno (se configuran en Vercel, nunca en el código):
//   ADMIN_PASSWORD  contraseña del panel
//   GITHUB_TOKEN    token de GitHub con permiso "Contents: Read and write" solo sobre este repositorio
//   GITHUB_REPO     opcional, por defecto uruzinfo1-art/3dsnaptech-web
const crypto = require('crypto');

const REPO = process.env.GITHUB_REPO || 'uruzinfo1-art/3dsnaptech-web';
const ARCHIVO = 'productos.json';
const RAMA = 'main';
const ORIGENES = ['https://www.3dsnaptech.com', 'https://3dsnaptech.com'];
const MAX_FALLOS = 5;
const VENTANA_MS = 15 * 60 * 1000;
const fallos = new Map(); // ip -> { n, desde }  (por instancia; frena intentos repetidos)

function ipDe(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'desconocida';
}
function bloqueado(ip) {
  const f = fallos.get(ip);
  if (!f) return false;
  if (Date.now() - f.desde > VENTANA_MS) { fallos.delete(ip); return false; }
  return f.n >= MAX_FALLOS;
}
function registrarFallo(ip) {
  const f = fallos.get(ip);
  if (!f || Date.now() - f.desde > VENTANA_MS) fallos.set(ip, { n: 1, desde: Date.now() });
  else f.n++;
}
function claveCorrecta(clave) {
  const real = process.env.ADMIN_PASSWORD || '';
  if (!real || typeof clave !== 'string' || clave.length > 200) return false;
  const a = crypto.createHash('sha256').update(clave).digest();
  const b = crypto.createHash('sha256').update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

async function github(ruta, opciones) {
  const r = await fetch('https://api.github.com/repos/' + REPO + ruta, Object.assign({}, opciones, {
    headers: {
      'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': '3dsnaptech-admin',
      'Content-Type': 'application/json'
    }
  }));
  if (!r.ok) { const e = new Error('github ' + r.status); e.status = r.status; throw e; }
  return r.json();
}
async function leerCatalogo() {
  const f = await github('/contents/' + ARCHIVO + '?ref=' + RAMA);
  return { sha: f.sha, datos: JSON.parse(Buffer.from(f.content, 'base64').toString('utf8')) };
}

// Valida un tamaño enviado desde el panel. Devuelve null si está vacío, o lanza si es inválido.
function tamanoValido(t) {
  if (!t || (t.nombre === '' && (t.precio === '' || t.precio == null))) return null;
  const nombre = String(t.nombre || '').trim();
  const precio = Number(t.precio);
  if (!/^[\p{L}\p{N} .,/×x"'-]{1,20}$/u.test(nombre)) throw new Error('nombre');
  if (!Number.isInteger(precio) || precio < 1000 || precio > 50000000) throw new Error('precio');
  return { nombre: nombre, precio: precio };
}

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido' }); return; }
  const origen = req.headers.origin;
  if (origen && ORIGENES.indexOf(origen) === -1 && !/^https:\/\/3dsnaptech-[\w-]+\.vercel\.app$/.test(origen)) {
    res.status(403).json({ error: 'Origen no permitido' }); return;
  }
  if (!process.env.ADMIN_PASSWORD || !process.env.GITHUB_TOKEN) {
    res.status(503).json({ error: 'El panel todavía no está configurado en Vercel.' }); return;
  }

  const ip = ipDe(req);
  if (bloqueado(ip)) { res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' }); return; }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (!claveCorrecta(body.clave)) {
    registrarFallo(ip);
    await new Promise(function (r) { setTimeout(r, 800); });
    res.status(401).json({ error: 'Contraseña incorrecta.' }); return;
  }
  fallos.delete(ip);

  try {
    if (body.accion === 'listar') {
      const { datos } = await leerCatalogo();
      res.status(200).json({ productos: (datos.productos || []).map(function (p) {
        return { id: p.id, nombre: p.nombre, imagen: p.imagen, tamanos: p.tamanos || [], oculto: p.oculto === true };
      }) });
      return;
    }

    if (body.accion === 'guardar') {
      const cambios = Array.isArray(body.cambios) ? body.cambios : null;
      if (!cambios || cambios.length > 500) { res.status(400).json({ error: 'Datos inválidos.' }); return; }
      const { sha, datos } = await leerCatalogo();
      const porId = new Map((datos.productos || []).map(function (p) { return [p.id, p]; }));
      let modificados = 0;
      for (const c of cambios) {
        const p = c && porId.get(c.id);
        if (!p) { res.status(400).json({ error: 'Producto desconocido.' }); return; }
        let tamanos;
        try {
          tamanos = (Array.isArray(c.tamanos) ? c.tamanos.slice(0, 2) : []).map(tamanoValido).filter(Boolean);
        } catch (e) {
          res.status(400).json({ error: 'Revisa ' + p.nombre + ': ' + (e.message === 'precio' ? 'el precio debe ser un número entero entre 1.000 y 50.000.000.' : 'el tamaño debe tener máximo 20 letras o números.') });
          return;
        }
        if (tamanos.length) p.tamanos = tamanos; else delete p.tamanos;
        delete p.precio;
        if (c.oculto === true) p.oculto = true; else delete p.oculto;
        modificados++;
      }
      const contenido = Buffer.from(JSON.stringify(datos, null, 2) + '\n', 'utf8').toString('base64');
      await github('/contents/' + ARCHIVO, {
        method: 'PUT',
        body: JSON.stringify({ message: 'Panel: actualizar precios y visibilidad (' + modificados + ' productos)', content: contenido, sha: sha, branch: RAMA })
      });
      res.status(200).json({ ok: true, modificados: modificados });
      return;
    }

    res.status(400).json({ error: 'Acción desconocida.' });
  } catch (e) {
    console.error('admin:', e.status || '', e.message);
    res.status(e.status === 409 ? 409 : 502).json({ error: e.status === 409 ? 'Alguien guardó cambios al mismo tiempo. Recarga e intenta de nuevo.' : 'No se pudo conectar con GitHub. Intenta de nuevo.' });
  }
};
