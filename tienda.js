// Tienda 3DSnapTech — código compartido por tienda.html y producto.html.
// Los productos se cargan desde productos.json.
// El carrito vive solo en el navegador del cliente; el pedido se envía por WhatsApp.
var WHATSAPP = '573207283295';
var CATEGORIAS = {
  figuras: 'Figuras y coleccionables',
  accesorios: 'Accesorios',
  hogar: 'Hogar y organización',
  regalos: 'Regalos personalizados'
};
var productos = [];
var nequiQR = '';
var nequiLlave = '';
var temporadaId = '';
var carrito = leerCarrito();

function leerCarrito() {
  try {
    var data = JSON.parse(localStorage.getItem('3dsnap-carrito') || '[]');
    return Array.isArray(data) ? data : [];
  } catch (e) { return []; }
}
function guardarCarrito() {
  try { localStorage.setItem('3dsnap-carrito', JSON.stringify(carrito)); } catch (e) {}
}
function pesos(n) { return '$ ' + Number(n).toLocaleString('es-CO') + ' COP'; }
function el(tag, cls, text) {
  var node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}
function buscar(id) {
  for (var i = 0; i < productos.length; i++) if (productos[i].id === id) return productos[i];
  return null;
}
function urlProducto(p) { return 'producto.html?id=' + encodeURIComponent(p.id); }
// Solo se aceptan rutas locales o https para imágenes y videos, y colores en formato #hex.
function imagenSegura(src) { return /^(https:\/\/|[\w\-\/.]+$)/.test(src || '') && !/^\/\//.test(src) ? src : ''; }
function colorSeguro(hex) { return /^#[0-9a-fA-F]{3,8}$/.test(hex || '') ? hex : '#cccccc'; }
// Texto corto del precio: "Desde $X" si tiene tamaños, el precio único, o "Precio por confirmar".
function precioCorto(p) {
  if (p.sinPrecio) return 'Precio por confirmar';
  if (p.tamanos && p.tamanos.length > 1) return 'Desde ' + pesos(Math.min.apply(null, p.tamanos.map(function(t){ return t.precio; })));
  return pesos(p.precio);
}
// Precio según el tamaño elegido; sin tamaños, el precio único del producto.
function precioDe(p, tamano) {
  if (p.tamanos) for (var i = 0; i < p.tamanos.length; i++) if (p.tamanos[i].nombre === tamano) return p.tamanos[i].precio;
  return p.precio;
}

// Los videos se reproducen solo mientras se ven en pantalla, para no gastar datos.
var videoObserver = 'IntersectionObserver' in window ? new IntersectionObserver(function(entries){
  entries.forEach(function(e){
    if (e.isIntersecting) { var p = e.target.play(); if (p && p.catch) p.catch(function(){}); }
    else e.target.pause();
  });
}, { threshold: 0.4 }) : null;
function crearVideo(src, poster, etiqueta) {
  var vid = el('video');
  vid.muted = true; vid.loop = true; vid.playsInline = true;
  vid.setAttribute('muted', ''); vid.setAttribute('playsinline', '');
  vid.preload = 'none';
  if (poster) vid.poster = poster;
  vid.src = src;
  vid.setAttribute('aria-label', etiqueta);
  if (videoObserver) videoObserver.observe(vid);
  return vid;
}

// ---------- carrito ----------
function agregar(id, color, tamano, cantidad) {
  tamano = tamano || '';
  cantidad = Math.max(1, Math.min(99, cantidad || 1));
  var item = carrito.filter(function(x){ return x.id === id && x.color === color && (x.tamano || '') === tamano; })[0];
  if (item) item.cantidad = Math.min(99, item.cantidad + cantidad);
  else carrito.push({ id: id, color: color, tamano: tamano, cantidad: cantidad });
  guardarCarrito();
  pintarCarrito();
  abrirCarrito();
}
function lineasValidas() {
  return carrito.filter(function(x){ var p = buscar(x.id); return p && precioDe(p, x.tamano) > 0; });
}
function totalCarrito() {
  return lineasValidas().reduce(function(s, x){ return s + precioDe(buscar(x.id), x.tamano) * x.cantidad; }, 0);
}
function pintarCarrito() {
  var lineas = lineasValidas();
  var unidades = lineas.reduce(function(s, x){ return s + x.cantidad; }, 0);
  var count = document.getElementById('cart-count');
  count.textContent = unidades;
  count.hidden = unidades === 0;

  document.getElementById('drawer-title').textContent = 'Tu carrito';
  document.getElementById('drawer-foot').hidden = false;
  var body = document.getElementById('drawer-body');
  body.textContent = '';
  if (lineas.length === 0) {
    body.appendChild(el('p', 'empty', productos.length ? 'Tu carrito está vacío.' : 'La tienda abre muy pronto. Por ahora puedes pedir tu pieza por WhatsApp.'));
  }
  lineas.forEach(function(x){
    var p = buscar(x.id);
    var row = el('div', 'line');
    var img = el('img');
    var src = imagenSegura(p.imagen);
    if (src) img.src = src;
    img.alt = '';
    row.appendChild(img);

    var mid = el('div');
    mid.appendChild(el('b', null, p.nombre));
    var detalle = [x.tamano, x.color].filter(Boolean).join(' · ');
    if (detalle) mid.appendChild(el('small', null, detalle));
    var qty = el('div', 'qty');
    var menos = el('button', null, '−'); menos.type = 'button'; menos.setAttribute('aria-label', 'Quitar uno');
    var mas = el('button', null, '+'); mas.type = 'button'; mas.setAttribute('aria-label', 'Agregar uno');
    menos.addEventListener('click', function(){ x.cantidad = Math.max(1, x.cantidad - 1); guardarCarrito(); pintarCarrito(); });
    mas.addEventListener('click', function(){ x.cantidad = Math.min(99, x.cantidad + 1); guardarCarrito(); pintarCarrito(); });
    qty.appendChild(menos); qty.appendChild(el('span', null, x.cantidad)); qty.appendChild(mas);
    mid.appendChild(qty);
    row.appendChild(mid);

    var right = el('div');
    right.appendChild(el('div', 'amt', pesos(precioDe(p, x.tamano) * x.cantidad)));
    var rm = el('button', 'rm', 'Quitar'); rm.type = 'button';
    rm.addEventListener('click', function(){ carrito.splice(carrito.indexOf(x), 1); guardarCarrito(); pintarCarrito(); });
    right.appendChild(rm);
    row.appendChild(right);
    body.appendChild(row);
  });
  document.getElementById('cart-total').textContent = pesos(totalCarrito());
  document.getElementById('checkout').disabled = lineas.length === 0;
}

function mensajePedido() {
  var texto = 'Hola 3DSnapTech, quiero hacer este pedido:\n';
  lineasValidas().forEach(function(x){
    var p = buscar(x.id);
    var detalle = [x.tamano, x.color].filter(Boolean).join(', ');
    texto += '\n• ' + x.cantidad + ' × ' + p.nombre + (detalle ? ' (' + detalle + ')' : '') + ' — ' + pesos(precioDe(p, x.tamano) * x.cantidad);
  });
  texto += '\n\nTotal: ' + pesos(totalCarrito()) + '\nPago por Nequi. Te envío el comprobante por aquí.';
  return texto;
}

function mostrarPago() {
  document.getElementById('drawer-title').textContent = 'Pago con Nequi';
  document.getElementById('drawer-foot').hidden = true;
  var body = document.getElementById('drawer-body');
  body.textContent = '';
  var pay = el('div', 'pay');
  pay.appendChild(el('div', 'total-row', null));
  pay.firstChild.appendChild(el('span', null, 'Total a pagar'));
  pay.firstChild.appendChild(el('span', null, pesos(totalCarrito())));

  var pasos = el('ol');
  (nequiQR ? [
    'Escanea el código QR con tu app Nequi y paga el total.',
    'Envíanos tu pedido por WhatsApp con el botón de abajo.',
    'Adjunta el comprobante del pago en el chat.',
    'Confirmamos tu pago y coordinamos el envío.'
  ] : [
    'Envíanos tu pedido por WhatsApp con el botón de abajo.',
    'Te compartimos los datos de pago Nequi.',
    'Adjunta el comprobante del pago en el chat.',
    'Confirmamos tu pago y coordinamos el envío.'
  ]).forEach(function(t){ pasos.appendChild(el('li', null, t)); });
  pay.appendChild(pasos);

  var qrSrc = imagenSegura(nequiQR);
  if (qrSrc) {
    var qr = el('img', 'qr'); qr.src = qrSrc; qr.alt = 'Código QR de Nequi para pagar';
    pay.appendChild(qr);
    pay.appendChild(el('p', 'qr-note', 'Desde el celular: haz captura de pantalla del QR y súbela en Nequi.'));
  }
  if (nequiLlave) {
    var llave = el('div', 'llave');
    llave.appendChild(el('small', null, 'O paga con la llave Nequi Negocios'));
    llave.appendChild(el('b', null, nequiLlave));
    pay.appendChild(llave);
  }

  var enviar = el('a', 'btn', 'Enviar pedido por WhatsApp →');
  enviar.href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(mensajePedido());
  enviar.target = '_blank';
  enviar.rel = 'noopener';
  enviar.style.cssText = 'width:100%; justify-content:center; margin-top:22px;';
  pay.appendChild(enviar);

  var back = el('button', 'back', '← Volver al carrito'); back.type = 'button';
  back.addEventListener('click', pintarCarrito);
  pay.appendChild(back);
  body.appendChild(pay);
}

function abrirCarrito() {
  pintarCarrito();
  document.getElementById('drawer').classList.add('show');
  document.getElementById('overlay').classList.add('show');
}
function cerrarCarrito() {
  document.getElementById('drawer').classList.remove('show');
  document.getElementById('overlay').classList.remove('show');
}
document.getElementById('cart-open').addEventListener('click', abrirCarrito);
document.getElementById('cart-close').addEventListener('click', cerrarCarrito);
document.getElementById('overlay').addEventListener('click', cerrarCarrito);
document.getElementById('checkout').addEventListener('click', mostrarPago);
document.addEventListener('keydown', function(e){ if (e.key === 'Escape') cerrarCarrito(); });

// ---------- carga de productos ----------
// Un producto sin precio válido se muestra como "Precio por confirmar"; uno con oculto: true no se muestra.
function validarProducto(p) {
  if (!p || typeof p.id !== 'string' || typeof p.nombre !== 'string' || !CATEGORIAS.hasOwnProperty(p.categoria)) return false;
  if (p.oculto === true) return false;
  if (p.colores && !Array.isArray(p.colores)) return false;
  if (p.galeria && !Array.isArray(p.galeria)) return false;
  if (p.descripcionLarga && !Array.isArray(p.descripcionLarga)) return false;
  if (p.tamanos) {
    p.tamanos = Array.isArray(p.tamanos) ? p.tamanos.filter(function(t){ return t && typeof t.nombre === 'string' && t.nombre && typeof t.precio === 'number' && t.precio > 0; }) : [];
    if (p.tamanos.length) p.precio = p.tamanos[0].precio;
    else delete p.tamanos;
  }
  p.sinPrecio = !(typeof p.precio === 'number' && p.precio > 0);
  return true;
}
function enlaceCotizar(p) {
  return 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent('Hola 3DSnapTech, quiero cotizar el producto: ' + p.nombre);
}
function cargarTienda(listo) {
  fetch('productos.json', { cache: 'no-cache' })
    .then(function(r){ return r.ok ? r.json() : {}; })
    .then(function(data){
      productos = Array.isArray(data.productos) ? data.productos.filter(validarProducto) : [];
      nequiQR = typeof data.nequiQR === 'string' ? data.nequiQR : '';
      nequiLlave = typeof data.nequiLlave === 'string' && /^[\w@.\-]{1,40}$/.test(data.nequiLlave) ? data.nequiLlave : '';
      temporadaId = typeof data.temporada === 'string' ? data.temporada : '';
    })
    .catch(function(){ productos = []; })
    .then(function(){ listo(); pintarCarrito(); });
}

// Cerrar el menú desplegable al tocar fuera de él
document.addEventListener('click', function(e){
  document.querySelectorAll('.nav-drop.open').forEach(function(d){ if (!d.contains(e.target)) d.classList.remove('open'); });
});
