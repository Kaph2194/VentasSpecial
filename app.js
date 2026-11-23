// =====================================================================
// VENTAS — Seguimiento comercial de vehículos
// ---------------------------------------------------------------------
// Adaptado del módulo de Cartera de SpecialTO. Núcleo de la app:
// configuración, catálogos, utilidades, acceso por correo, sincronización
// con el backend (apps-script/Ventas.gs) y navegación entre vistas.
// =====================================================================

// URL del Web App (Apps Script implementado desde la cuenta dueña — ver VENTAS_SETUP.md).
// Mientras esté vacía la app funciona en MODO DEMO: datos de ejemplo guardados en este navegador.
const VENTAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwgbdo6VV1pcxVM1iw_9nvvOmhDAG-NxsKIvRrD1Ojl-n-QpFO0D9lKxkOJVfwuL3Y/exec';
// DEMO_POR_DEFECTO = true: la página abre en modo demo (datos de ejemplo en el navegador) y con ?real usa el backend.
// Cuando el equipo empiece a usarla, cambiar a false: abrirá con el backend y ?demo seguirá mostrando el demo.
const DEMO_POR_DEFECTO = true;
const MODO_DEMO = !/^https:\/\/script\.google(usercontent)?\.com\//.test(VENTAS_WEBAPP_URL) || /[?&]demo\b/.test(location.search) || (DEMO_POR_DEFECTO && !/[?&]real\b/.test(location.search));

// Datos de la empresa para el encabezado de las cotizaciones (el backend los reemplaza con su CONFIG.EMPRESA)
// ID de cliente OAuth de Google para "Continuar con Google" (el mismo de CONFIG.GOOGLE_CLIENT_ID en Ventas.gs).
// Vacío = solo ingreso con código al correo. Ver VENTAS_SETUP.md, sección "Ingreso con Google".
const GOOGLE_CLIENT_ID = '820863349253-ih6mgrjnksm2rjlrg08597bk8c1umcmn.apps.googleusercontent.com';

let EMPRESA = { nombre: 'Special Car', nit: '', direccion: '', ciudad: 'Bogotá D.C.', telefono: '', correo: '', web: '' };
let VALIDEZ_COTIZACION = 8;
// Versión de apps-script/Ventas.gs que espera esta página
const VERSION_BACKEND_ESPERADA = '2026-11-23.1';
let _avisoVersion = false;

// ===== CATÁLOGOS =====
const ESTADOS = [
  { k: 'nuevo', t: 'Nuevo', c: 'st-nuevo' },
  { k: 'contactado', t: 'Contactado', c: 'st-contactado' },
  { k: 'cita', t: 'Cita / visita agendada', c: 'st-cita' },
  { k: 'cotizado', t: 'Cotizado', c: 'st-cotizado' },
  { k: 'negociacion', t: 'Negociación', c: 'st-negociacion' },
  { k: 'credito', t: 'Crédito en estudio', c: 'st-credito' },
  { k: 'aprobado', t: 'Aprobado / separado', c: 'st-aprobado' },
  { k: 'facturado', t: 'Facturado', c: 'st-facturado' },
  { k: 'entregado', t: 'Entregado', c: 'st-entregado' },
  { k: 'perdido', t: 'Perdido', c: 'st-perdido' }
];
const EST = {}; ESTADOS.forEach((e, i) => { EST[e.k] = Object.assign({ i }, e); });
// "Prueba de manejo" ya no es un estado: los leads antiguos en ese estado se muestran como "Cita / visita"
EST.prueba = Object.assign({}, EST.cita, { k: 'prueba', t: 'Prueba de manejo (anterior)' });
const normalizarLead = l => { if (l && l.estado === 'prueba') l.estado = 'cita'; return l; };
// Un asesor solo avanza: volver a un estado anterior (o reabrir un perdido) lo hace supervisor, gerencia o admin, con justificación
function esRetroceso(de, a) {
  if (!de || de === a || a === 'perdido') return false;
  if (de === 'perdido') return true;
  return (EST[a] || EST.nuevo).i < (EST[de] || EST.nuevo).i;
}
const puedeRetroceder = () => rolActual() !== 'comercial';
// Selector de ciudad: lista de ciudades de Colombia + "Otra…" (el valor queda en el input #id)
const ALIAS_CIUDAD = { 'bogota': 'Bogotá D.C.', 'bogotá': 'Bogotá D.C.', 'bogota d.c.': 'Bogotá D.C.', 'bogotá dc': 'Bogotá D.C.', 'medellin': 'Medellín', 'cucuta': 'Cúcuta', 'chia': 'Chía', 'ibague': 'Ibagué', 'monteria': 'Montería', 'popayan': 'Popayán', 'quibdo': 'Quibdó', 'itagui': 'Itagüí', 'fusagasuga': 'Fusagasugá', 'facatativa': 'Facatativá', 'cajica': 'Cajicá', 'girardot': 'Girardot', 'tulua': 'Tuluá', 'jamundi': 'Jamundí', 'apartado': 'Apartadó', 'magangue': 'Magangué', 'ocana': 'Ocaña', 'giron': 'Girón', 'san andres': 'San Andrés', 'inirida': 'Inírida', 'mitu': 'Mitú', 'puerto carreno': 'Puerto Carreño', 'san jose del guaviare': 'San José del Guaviare' };
const normCiudad = c => { c = String(c || '').trim(); return ALIAS_CIUDAD[c.toLowerCase()] || c; };
function htmlCiudad(id, valor, requerido) {
  valor = normCiudad(valor); const enLista = !valor || CIUDADES.includes(valor);
  return `<select id="${id}_sel" class="sel-ciudad" onchange="elegirCiudad('${id}',this)"><option value="">— Selecciona${requerido ? '' : ' (opcional)'} —</option>${CIUDADES.map(c => `<option ${c === valor ? 'selected' : ''}>${esc(c)}</option>`).join('')}<option value="__otra" ${enLista ? '' : 'selected'}>Otra…</option></select>
    <input id="${id}" class="inp-otra ${enLista ? 'hidden' : ''}" value="${esc(valor)}" placeholder="Escribe la ciudad"/>`;
}
function elegirCiudad(id, sel) { const inp = $(id); if (sel.value === '__otra') { inp.value = ''; inp.classList.remove('hidden'); inp.focus(); } else { inp.value = sel.value; inp.classList.add('hidden'); } }
const FINALES = ['entregado', 'perdido'];
const GANADOS = ['facturado', 'entregado'];
const esActivo = l => !FINALES.includes(l.estado);
const ORIGENES = ['Campaña', 'WhatsApp', 'Formulario', 'KOMMO', 'Instagram', 'Facebook', 'TikTok', 'Página web / Google', 'Llamada entrante', 'Vitrina / showroom',
  'Referido', 'Cliente antiguo', 'Base de datos', 'Feria / evento', 'TuCarro / Marketplace', 'Correo electrónico', 'Otro'];
// Principales ciudades de Colombia (capitales y municipios grandes); "Otra" permite escribir una distinta
const CIUDADES = ['Bogotá D.C.', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga', 'Cúcuta', 'Pereira', 'Santa Marta', 'Ibagué', 'Manizales', 'Villavicencio',
  'Pasto', 'Neiva', 'Armenia', 'Montería', 'Valledupar', 'Sincelejo', 'Popayán', 'Tunja', 'Riohacha', 'Yopal', 'Florencia', 'Quibdó', 'Arauca', 'Mocoa', 'Leticia',
  'San Andrés', 'San José del Guaviare', 'Inírida', 'Mitú', 'Puerto Carreño', 'Soacha', 'Chía', 'Zipaquirá', 'Funza', 'Mosquera', 'Madrid', 'Facatativá', 'Cajicá',
  'Fusagasugá', 'Girardot', 'Bello', 'Itagüí', 'Envigado', 'Sabaneta', 'Rionegro', 'Soledad', 'Malambo', 'Floridablanca', 'Girón', 'Piedecuesta', 'Barrancabermeja',
  'Dosquebradas', 'Palmira', 'Tuluá', 'Buga', 'Cartago', 'Jamundí', 'Buenaventura', 'Duitama', 'Sogamoso', 'Apartadó', 'Turbo', 'Maicao', 'Magangué', 'Ocaña', 'Pitalito', 'Ipiales', 'Tumaco'];
const MEDIOS = ['Llamada', 'WhatsApp', 'Correo', 'Visita en vitrina', 'Videollamada', 'Redes sociales', 'Otro'];
const RESULTADOS = [
  { t: 'No contestó', c: 'res-mal' }, { t: 'Número errado', c: 'res-mal' }, { t: 'Interesado', c: 'res-ok' },
  { t: 'Solicita cotización', c: 'res-info' }, { t: 'Agenda cita / visita', c: 'res-ok' },
  { t: 'Lo está pensando', c: 'res-warn' }, { t: 'Pide descuento / mejor precio', c: 'res-warn' }, { t: 'Radicó crédito', c: 'res-info' },
  { t: 'Separó el vehículo', c: 'res-ok' }, { t: 'No interesado', c: 'res-mal' }, { t: 'Compró en otro lado', c: 'res-mal' }, { t: 'Otro', c: 'res-info' }
];
const CLASE_RES = t => (RESULTADOS.find(r => r.t === t) || { c: /cotizaci/i.test(t) ? 'res-info' : 'res-info' }).c;
const MOTIVOS_PERDIDA = ['Precio', 'Compró otra marca', 'Compró en otro concesionario', 'Compró usado', 'Crédito negado', 'Desistió de la compra', 'No se pudo contactar', 'Tiempo de entrega', 'Valor de la retoma', 'Otro'];
const FORMAS_PAGO = ['Contado', 'Crédito', 'Leasing', 'Retoma + crédito', 'Retoma + contado', 'Por definir'];
const MARCAS = ['Chevrolet', 'Renault', 'Kia', 'Mazda', 'Toyota', 'Nissan', 'Hyundai', 'Volkswagen', 'Ford', 'Suzuki', 'BYD', 'Mercedes-Benz', 'BMW', 'Audi', 'Peugeot', 'Citroën', 'Jeep', 'Mitsubishi', 'Honda', 'Subaru', 'Volvo', 'MG', 'Chery', 'JAC', 'Great Wall', 'DFSK', 'Changan', 'Foton', 'JMC', 'Isuzu', 'Hino', 'Volvo Buses'];

// ===== ESTADO DE LA APP =====
const S = { token: null, usuario: null, usuarios: [], leads: [], cotizaciones: [], version: null, vista: 'leads', hoja: '', carpeta: '', ultimaSync: null };
// Perfiles: comercial (sus leads) · supervisor (su equipo) · gerencia y administrador (todo)
const ROLES = { comercial: 'Comercial', supervisor: 'Supervisor', gerencia: 'Gerencia', admin: 'Administrador' };
const ROL_CLS = { comercial: 'st-contactado', supervisor: 'st-prueba', gerencia: 'st-aprobado', admin: 'st-cita' };
const rolActual = () => (S.usuario && S.usuario.rol) || 'comercial';
const verTodo = () => ['admin', 'gerencia'].includes(rolActual());
const esSupervisor = () => rolActual() === 'supervisor';
const veEquipo = () => rolActual() !== 'comercial';          // ve leads de otros comerciales (columna y filtro "Comercial")
const gestionaUsuarios = () => verTodo();
const esAdmin = veEquipo;                                     // compatibilidad con el código anterior
// Comerciales a los que el usuario puede asignar leads
function asignables() {
  if (verTodo()) return S.usuarios.filter(u => u.activo);
  if (esSupervisor()) return S.usuarios.filter(u => u.activo && (u.correo === S.usuario.correo || u.supervisor === S.usuario.correo));
  return S.usuarios.filter(u => u.correo === S.usuario.correo);
}

// ===== UTILIDADES =====
const fmtCOP = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isoDe = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoyISO = () => isoDe(new Date());
const parseD = s => { if (!s) return null; const d = new Date(String(s).slice(0, 10) + 'T00:00:00'); return isNaN(d) ? null : d; };
const fmtD = s => { const d = parseD(s); return d ? d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'; };
const fmtFH = s => { const d = new Date(s); return isNaN(d) ? '—' : d.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); };
const diasR = s => { const d = parseD(s); if (!d) return null; const h = parseD(hoyISO()); return Math.round((d - h) / 86400000); };
const sumarDias = (iso, n) => { const d = parseD(iso) || new Date(); d.setDate(d.getDate() + n); return isoDe(d); };
const uid = p => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const normTxt = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const telWa = t => { let d = String(t || '').replace(/\D/g, ''); if (d.length === 10 && d[0] === '3') d = '57' + d; return d; };
const nombreUsuario = c => (S.usuarios.find(u => u.correo === c) || {}).nombre || c || '—';
const ahoraISO = () => new Date().toISOString();
const $ = id => document.getElementById(id);

function badgeEstado(k) { const e = EST[k] || EST.nuevo; return `<span class="st ${e.c}">${esc(e.t)}</span>`; }
function badgeSeguimiento(l) {
  if (!esActivo(l)) return '<span class="cell-n">—</span>';
  if (!l.fechaSeguimiento) return '<span class="seg-badge seg-sin" title="Sin fecha de seguimiento">Sin fecha</span>';
  const d = diasR(l.fechaSeguimiento), h = l.horaSeguimiento ? ' ' + esc(l.horaSeguimiento) : '';
  if (d < 0) return `<span class="seg-badge seg-venc" title="Vencido hace ${-d} día(s)">${fmtD(l.fechaSeguimiento)}${h}<small>vencido ${-d}d</small></span>`;
  if (d === 0) return `<span class="seg-badge seg-hoy">Hoy${h}</span>`;
  if (d === 1) return `<span class="seg-badge seg-pronto">Mañana${h}</span>`;
  return `<span class="seg-badge">${fmtD(l.fechaSeguimiento)}${h}</span>`;
}
function linkWa(tel, texto) { const n = telWa(tel); return n ? `https://wa.me/${n}${texto ? '?text=' + encodeURIComponent(texto) : ''}` : '#'; }
function ultimaGestion(l) { return (l.seguimientos || []).slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0] || null; }
function ultimaActividad(l) {
  const f = [l.creado].concat((l.seguimientos || []).map(s => s.fecha)).concat((l.historial || []).map(h => h.fecha)).filter(Boolean).sort();
  return f[f.length - 1] || null;
}
function cotizacionesDe(leadId) { return S.cotizaciones.filter(c => c.leadId === leadId).sort((a, b) => String(b.creado || b.fecha).localeCompare(String(a.creado || a.fecha))); }

let _toastT = null;
function mostrarToast(msg, tipo) {
  const t = $('toast'); t.textContent = msg; t.className = `toast toast-${tipo || 'info'}`;
  clearTimeout(_toastT); _toastT = setTimeout(() => t.classList.add('hidden'), tipo === 'error' ? 6000 : 3500);
}
function descargarBlob(blob, nombre) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
const blobABase64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(b); });
function base64ABlob(b64, mime) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime || 'application/octet-stream' }); }

// Botón ocupado mientras se espera al backend
async function conEspera(btn, fn) {
  const b = btn && btn.tagName ? btn : null; const txt = b ? b.innerHTML : '';
  if (b) { b.disabled = true; b.innerHTML = '⏳ Guardando…'; }
  try { return await fn(); } finally { if (b && document.body.contains(b)) { b.disabled = false; b.innerHTML = txt; } }
}

// ===== BACKEND =====
async function api(accion, datos) {
  const payload = Object.assign({}, datos || {}, { accion, token: S.token });
  let d;
  if (MODO_DEMO) d = await DemoBackend.llamar(payload);
  else {
    const r = await fetch(VENTAS_WEBAPP_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    d = await r.json();
  }
  if (d && d.error === 'sesion') { cerrarSesion(true); throw new Error('Tu sesión venció. Vuelve a ingresar con tu correo.'); }
  if (d && d.error) throw new Error(d.error);
  return d;
}

// ===== PERFIL DEL USUARIO (registro y "Mi perfil") =====
// Obligatorio: nombre, celular, cédula y ciudad (el correo ya viene del ingreso). Opcional: foto, dirección y contacto de emergencia.
const _fotos = {};
const perfilIncompleto = u => !u || !u.telefono || !u.documento || !u.ciudad;
function iniciales(nombre) { return String(nombre || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase(); }
function avatarHTML(u, tam) {
  tam = tam || 30;
  return u && u.foto ? `<img class="avatar" src="${esc(u.foto)}" alt="" referrerpolicy="no-referrer" style="width:${tam}px;height:${tam}px">`
    : `<span class="avatar avatar-ini" style="width:${tam}px;height:${tam}px;font-size:${Math.round(tam * 0.4)}px">${esc(iniciales(u && u.nombre))}</span>`;
}
function camposPerfil(px, d) {
  d = d || {}; _fotos[px] = d.foto || '';
  const f = (id, label, val, extra) => `<div class="form-group"><label>${label}</label><input id="${px}_${id}" value="${esc(val || '')}" ${extra || ''}/></div>`;
  return `<div class="pf-foto"><span id="${px}_avatar">${avatarHTML({ nombre: d.nombre, foto: d.foto }, 64)}</span>
      <div><label class="btn btn-sm btn-outline-dark pf-foto-btn">📷 ${d.foto ? 'Cambiar foto' : 'Agregar foto'} (opcional)<input type="file" accept="image/*" onchange="elegirFoto('${px}',this)" hidden/></label>
      <button type="button" class="link-btn ${d.foto ? '' : 'hidden'}" id="${px}_quitar" onclick="quitarFoto('${px}')">Quitar</button></div></div>
    <div class="pf-grid">
      ${f('nombre', 'Nombre y apellido *', d.nombre, 'autocomplete="name" placeholder="Como aparecerá en las cotizaciones"')}
      ${f('telefono', 'Celular *', d.telefono, 'type="tel" autocomplete="tel" placeholder="300 123 4567"')}
      ${f('documento', 'Cédula *', d.documento, 'inputmode="numeric" placeholder="Número de documento"')}
      <div class="form-group"><label>Ciudad *</label>${htmlCiudad(px + '_ciudad', d.ciudad, true)}</div>
      <div class="pf-ancho">${f('direccion', 'Dirección', d.direccion, 'autocomplete="street-address"')}</div>
      ${f('contactoEmergencia', 'Contacto de emergencia', d.contactoEmergencia, 'placeholder="Nombre y parentesco"')}
      ${f('telEmergencia', 'Teléfono de emergencia', d.telEmergencia, 'type="tel"')}
    </div>`;
}
function leerPerfil(px) {
  const v = id => (($(px + '_' + id) || {}).value || '').trim();
  return { nombre: v('nombre').replace(/\s+/g, ' '), telefono: v('telefono'), documento: v('documento'), ciudad: v('ciudad'), direccion: v('direccion'),
    contactoEmergencia: v('contactoEmergencia'), telEmergencia: v('telEmergencia'), foto: _fotos[px] || '' };
}
function validarPerfil(d) {
  if (d.nombre.split(' ').length < 2 || d.nombre.length < 5) return 'Escribe tu nombre y apellido';
  if (d.telefono.replace(/\D/g, '').length < 7) return 'Escribe tu número de celular';
  if (d.documento.replace(/\W/g, '').length < 5) return 'Escribe tu número de cédula';
  if (d.ciudad.length < 3) return 'Escribe tu ciudad';
  return null;
}
// Recorta la foto en cuadrado y la reduce a 192 px (queda de ~15 KB)
async function elegirFoto(px, input) {
  const f = input.files[0]; if (!f) return;
  if (!/^image\//.test(f.type)) { mostrarToast('Elige una imagen', 'error'); return; }
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(f); });
    const lado = Math.min(img.naturalWidth, img.naturalHeight), cv = document.createElement('canvas'); cv.width = cv.height = 192;
    cv.getContext('2d').drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, 192, 192);
    let q = 0.85, url = cv.toDataURL('image/jpeg', q); while (url.length > 40000 && q > 0.4) { q -= 0.1; url = cv.toDataURL('image/jpeg', q); }
    _fotos[px] = url; $(px + '_avatar').innerHTML = avatarHTML({ foto: url }, 64); $(px + '_quitar').classList.remove('hidden');
  } catch (e) { mostrarToast('No se pudo leer la imagen', 'error'); }
}
function quitarFoto(px) { _fotos[px] = ''; $(px + '_avatar').innerHTML = avatarHTML({ nombre: ($(px + '_nombre') || {}).value }, 64); $(px + '_quitar').classList.add('hidden'); }

// ===== INGRESO: con Google o con código de 6 dígitos al correo =====
let _registro = false, _gRegistro = null, _conClave = false;
// Ingreso con contraseña (la asigna gerencia o el administrador en 👥 Usuarios)
function modoClave(on) {
  _conClave = on === undefined ? !_conClave : !!on;
  $('lg-clave-box').classList.toggle('hidden', !_conClave);
  $('lg-btn1').textContent = _conClave ? 'Entrar' : 'Enviarme un código de acceso';
  $('lg-modo-clave').textContent = _conClave ? '✉️ Prefiero recibir un código al correo' : '🔑 Ingresar con contraseña';
  $('lg-ayuda1').classList.toggle('hidden', _conClave);
  if (_conClave) setTimeout(() => ($('lg-correo').value ? $('lg-clave') : $('lg-correo')).focus(), 30);
}
function modoRegistro(on) {
  _registro = !!on;
  // Crear cuenta: SOLO con la cuenta de Google (los datos de contacto se piden después, en el paso 3)
  document.querySelectorAll('.lg-reg').forEach(x => x.classList.toggle('hidden', !_registro));
  document.querySelectorAll('.lg-entrar').forEach(x => x.classList.toggle('hidden', _registro));
  $('lg-tab-entrar').classList.toggle('activo', !_registro); $('lg-tab-registro').classList.toggle('activo', _registro);
  $('lg-sub').textContent = _registro ? 'Crea tu cuenta con tu cuenta de Google' : 'Ingresa con tu cuenta de Google o con tu correo';
  iniciarGoogle();
}
function mostrarLogin() {
  $('login').classList.remove('hidden'); $('app').classList.add('hidden');
  ['lg-paso2', 'lg-paso3'].forEach(id => $(id).classList.add('hidden')); $('lg-paso1').classList.remove('hidden');
  $('lg-demo').classList.toggle('hidden', !MODO_DEMO);
  try { $('lg-correo').value = localStorage.getItem('vt_ultimo_correo') || ''; } catch (e) {}
  modoClave(false); if ($('lg-clave')) $('lg-clave').value = '';
  if (/[?&]registro\b/.test(location.search)) modoRegistro(true); else iniciarGoogle();
}
// Botón "Continuar con Google" (Google Identity Services). En el demo se simula.
function iniciarGoogle() {
  const box = $('lg-google-box'); if (!box) return;
  if (MODO_DEMO) {
    box.classList.remove('hidden'); $('lg-sin-google').classList.add('hidden');
    $('lg-google').innerHTML = `<button type="button" class="btn-google" onclick="googleDemo()"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Continuar con Google</button>`;
    return;
  }
  const id = (typeof GOOGLE_CLIENT_ID !== 'undefined' && GOOGLE_CLIENT_ID) || '';
  const hay = !!(id && window._gsiListo && window.google && google.accounts);
  $('lg-sin-google').classList.toggle('hidden', !_registro || hay);
  if (!hay) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  if (!iniciarGoogle._ok) { google.accounts.id.initialize({ client_id: id, callback: respuestaGoogle, ux_mode: 'popup', auto_select: false }); iniciarGoogle._ok = true; }
  $('lg-google').innerHTML = '';
  google.accounts.id.renderButton($('lg-google'), { theme: 'outline', size: 'large', text: _registro ? 'signup_with' : 'continue_with', shape: 'rectangular', locale: 'es', width: 320 });
}
function googleDemo() {
  const c = (!_registro && $('lg-correo').value.trim().toLowerCase()) || 'nuevo.comercial@gmail.com';
  const nombre = c.split('@')[0].split(/[._]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  respuestaGoogle({ credential: 'demo.' + btoa(unescape(encodeURIComponent(JSON.stringify({ email: c, name: nombre, picture: '' })))) + '.firma' });
}
async function respuestaGoogle(resp) {
  try {
    const r = await api('ingresarGoogle', { credential: resp.credential });
    if (r.token) return iniciarSesion(r);
    // cuenta nueva: completar datos de contacto
    _gRegistro = r;
    $('lg-paso1').classList.add('hidden'); $('lg-paso3').classList.remove('hidden');
    $('lg-g-avatar').innerHTML = avatarHTML({ nombre: r.nombre, foto: r.foto }, 44);
    $('lg-g-nombre').textContent = r.nombre || 'Cuenta de Google'; $('lg-g-correo').textContent = r.correo;
    $('lg-g-campos').innerHTML = camposPerfil('gr', { nombre: r.nombre, foto: r.foto });
    setTimeout(() => $('gr_telefono').focus(), 50);
  } catch (e) { mostrarToast(e.message, 'error'); }
}
async function terminarRegistroGoogle(ev) {
  if (ev) ev.preventDefault();
  const datos = leerPerfil('gr'), err = validarPerfil(datos); if (err) { mostrarToast(err, 'error'); return; }
  await conEspera($('lg-btn3'), async () => {
    try { iniciarSesion(await api('completarRegistro', { registroToken: _gRegistro.registroToken, datos })); mostrarToast('¡Registro completo! Bienvenido(a)', 'success'); }
    catch (e) { mostrarToast(e.message, 'error'); }
  });
}
function iniciarSesion(r) {
  S.token = r.token; S.usuario = r.usuario;
  try { localStorage.setItem('vt_token', r.token); localStorage.setItem('vt_usuario', JSON.stringify(r.usuario)); localStorage.setItem('vt_ultimo_correo', r.usuario.correo); } catch (e) {}
  entrarApp();
}
async function pedirCodigo(ev) {
  if (ev) ev.preventDefault();
  const correo = $('lg-correo').value.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) { mostrarToast('Escribe tu correo electrónico', 'error'); return; }
  if (_registro) { mostrarToast('Para crear tu cuenta usa el botón de Google', 'info'); return; }
  if (_conClave) {
    const clave = $('lg-clave').value; if (!clave) { mostrarToast('Escribe tu contraseña', 'error'); return; }
    await conEspera($('lg-btn1'), async () => {
      try { const r = await api('ingresarClave', { correo, clave }); $('lg-clave').value = ''; iniciarSesion(r); }
      catch (e) { mostrarToast(e.message, 'error'); }
    });
    return;
  }
  const registro = null;
  await conEspera($('lg-btn1'), async () => {
    try {
      const r = await api('solicitarCodigo', { correo, registro });
      try { localStorage.setItem('vt_ultimo_correo', correo); } catch (e) {}
      $('lg-paso1').classList.add('hidden'); $('lg-paso2').classList.remove('hidden');
      $('lg-para').textContent = correo; $('lg-codigo').value = '';
      if (r.codigoDemo) { $('lg-codigo').value = r.codigoDemo; mostrarToast(`Modo demo: el código es ${r.codigoDemo}`, 'info'); }
      else mostrarToast(`Te enviamos un código a ${correo}. Revisa también la carpeta de spam.`, 'success');
      if (_registro && r.nuevo === false) mostrarToast('Ese correo ya estaba registrado: entra con el código que te enviamos', 'info');
      setTimeout(() => $('lg-codigo').focus(), 50);
    } catch (e) { mostrarToast(e.message, 'error'); if (/no está registrado|Continuar con Google/.test(e.message) && !_registro) modoRegistro(true); }
  });
}
async function verificarCodigo(ev) {
  if (ev) ev.preventDefault();
  const correo = $('lg-para').textContent, codigo = $('lg-codigo').value.trim();
  if (!/^\d{6}$/.test(codigo)) { mostrarToast('El código tiene 6 dígitos', 'error'); return; }
  await conEspera($('lg-btn2'), async () => {
    try { iniciarSesion(await api('verificarCodigo', { correo, codigo })); }
    catch (e) { mostrarToast(e.message, 'error'); }
  });
}
function cerrarSesion(silencioso) {
  if (!silencioso && S.token) api('cerrarSesion').catch(() => {});
  S.token = null; S.usuario = null; S.leads = []; S.cotizaciones = []; S.version = null;
  try { localStorage.removeItem('vt_token'); localStorage.removeItem('vt_usuario'); } catch (e) {}
  try { if (window.google && google.accounts) google.accounts.id.disableAutoSelect(); } catch (e) {}
  mostrarLogin();
}
function pintarChip() {
  $('user-chip').innerHTML = `${avatarHTML(S.usuario, 32)}<span class="chip-txt"><b>${esc(S.usuario.nombre)}</b><small>${esc(S.usuario.correo)} · ${ROLES[rolActual()]}${esSupervisor() ? ' · equipo de ' + S.usuarios.filter(u => u.supervisor === S.usuario.correo).length : ''}</small></span>`;
}
function entrarApp() {
  $('login').classList.add('hidden'); $('app').classList.remove('hidden');
  pintarChip();
  $('nav-usuarios').classList.toggle('hidden', !gestionaUsuarios());
  $('banner-demo').classList.toggle('hidden', !MODO_DEMO);
  document.body.classList.toggle('es-admin', veEquipo());
  irAVista(S.vista || 'leads');
  sincronizar(true).then(() => { abrirDesdeHash(); if (perfilIncompleto(S.usuario)) abrirMiPerfil(true); });
}
// "Mi perfil": datos de contacto y foto de cada usuario
function abrirMiPerfil(obligatorio) {
  const u = S.usuario; if (!u) return;
  abrirModal(obligatorio ? '👤 Completa tu perfil' : '👤 Mi perfil', `
    ${obligatorio ? '<div class="aviso-nuevos" style="margin:0 0 14px">Para continuar completa tus datos de contacto. La foto es opcional.</div>' : ''}
    <div class="form-group" style="margin-bottom:12px"><label>Correo</label><input value="${esc(u.correo)}" disabled/></div>
    ${camposPerfil('pf', u)}
    <p class="nota-cal">Perfil: <b>${ROLES[rolActual()]}</b>${u.supervisor ? ' · Supervisor: ' + esc(nombreUsuario(u.supervisor)) : ''}. El perfil y el equipo los asigna gerencia o el administrador.</p>
    ${obligatorio ? '' : `<details class="pf-clave"><summary>🔑 ${u.tieneClave ? 'Cambiar mi contraseña' : 'Crear una contraseña (opcional)'}</summary>
      <div class="form-grid" style="margin-top:10px">
        ${u.tieneClave ? '<div class="form-group"><label>Contraseña actual</label><input type="password" id="pf_clave_act" autocomplete="current-password"/></div>' : ''}
        <div class="form-group"><label>Nueva contraseña</label><input type="password" id="pf_clave_new" autocomplete="new-password" placeholder="Mín. 8, con letras y números"/></div>
        <div class="form-group"><label>Repetir nueva</label><input type="password" id="pf_clave_rep" autocomplete="new-password"/></div>
      </div><button class="btn btn-outline-dark btn-sm" onclick="cambiarMiClave(this)">Guardar contraseña</button>
      <p class="td-sub">Con contraseña entras escribiendo tu correo y tu contraseña, sin esperar el código. Google y el código siguen funcionando.</p></details>`}`,
    `<button class="btn btn-primary-dark" onclick="guardarMiPerfil(this)">💾 Guardar</button>`, 'modal-md');
}
const claveValida = c => c.length >= 8 && /[A-Za-z]/.test(c) && /\d/.test(c);
async function cambiarMiClave(btn) {
  const nueva = $('pf_clave_new').value, rep = $('pf_clave_rep').value, actual = $('pf_clave_act') ? $('pf_clave_act').value : '';
  if (!claveValida(nueva)) { mostrarToast('La contraseña debe tener mínimo 8 caracteres, con letras y números', 'error'); return; }
  if (nueva !== rep) { mostrarToast('Las contraseñas no coinciden', 'error'); return; }
  await conEspera(btn, async () => {
    try { const r = await api('cambiarClave', { actual, nueva }); S.usuario = Object.assign({}, S.usuario, r.usuario); ['pf_clave_act', 'pf_clave_new', 'pf_clave_rep'].forEach(id => $(id) && ($(id).value = '')); mostrarToast('Contraseña guardada', 'success'); }
    catch (e) { mostrarToast(e.message, 'error'); }
  });
}
async function guardarMiPerfil(btn) {
  const datos = leerPerfil('pf'), err = validarPerfil(datos); if (err) { mostrarToast(err, 'error'); return; }
  await conEspera(btn, async () => {
    try {
      const r = await api('guardarPerfil', { datos });
      S.usuario = Object.assign({}, S.usuario, r.usuario); const i = S.usuarios.findIndex(x => x.correo === r.usuario.correo); if (i >= 0) S.usuarios[i] = Object.assign({}, S.usuarios[i], r.usuario);
      try { localStorage.setItem('vt_usuario', JSON.stringify(S.usuario)); } catch (e) {}
      pintarChip(); cerrarModal(); mostrarToast('Perfil guardado', 'success');
    } catch (e) { mostrarToast(e.message, 'error'); }
  });
}

// ===== SINCRONIZACIÓN (cada minuto y al volver a la pestaña) =====
let _sync = null;
function sincronizar(forzar) {
  if (!S.token) return Promise.resolve();
  if (_sync) return _sync;
  _sync = (async () => {
    try {
      const r = await api('obtenerDatos', { version: forzar ? null : S.version });
      S.ultimaSync = new Date();
      if (!r.sinCambios) {
        S.version = r.version; S.usuario = r.usuario || S.usuario; try { localStorage.setItem('vt_usuario', JSON.stringify(S.usuario)); } catch (e) {} if ($('user-chip')) pintarChip(); S.usuarios = r.usuarios || [];
        S.leads = (r.leads || []).map(normalizarLead); S.cotizaciones = r.cotizaciones || [];
        if (r.empresa) EMPRESA = Object.assign({}, EMPRESA, r.empresa);
        if (r.validezCotizacion) VALIDEZ_COTIZACION = r.validezCotizacion;
        S.hoja = r.hoja || ''; S.carpeta = r.carpeta || '';
        if (!MODO_DEMO && String(r.versionBackend || '') < VERSION_BACKEND_ESPERADA && !_avisoVersion) { _avisoVersion = true; $('banner-version').classList.remove('hidden'); }
        cargarFiltrosDinamicos(); refrescarVista();
      }
      estadoSync(true);
    } catch (e) { console.warn(e); estadoSync(false, e.message); }
    finally { _sync = null; }
  })();
  return _sync;
}
function estadoSync(ok, msg) {
  const el = $('sync-info'); if (!el) return;
  const hora = S.ultimaSync ? S.ultimaSync.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';
  el.innerHTML = ok ? `<span class="dot dot-g"></span>${MODO_DEMO ? 'Modo demo (este navegador)' : 'Sincronizado ' + hora}${S.hoja ? ` · <a href="${esc(S.hoja)}" target="_blank" rel="noopener">Hoja</a>` : ''}${S.carpeta ? ` · <a href="${esc(S.carpeta)}" target="_blank" rel="noopener">Cotizaciones</a>` : ''}`
    : `<span class="dot dot-r"></span>Sin conexión — <button class="link-btn" onclick="sincronizar(true)" title="${esc(msg || '')}">reintentar</button>`;
}
// Re-pinta sin interrumpir si hay un modal abierto o se está escribiendo
let _renderPendiente = false;
function refrescarVista() {
  const ocupado = !$('modal').classList.contains('hidden') || (document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement.closest('.vista'));
  if (ocupado) { _renderPendiente = true; return; }
  _renderPendiente = false; renderVista();
}
// Guarda un lead en el backend y actualiza la lista con la respuesta (# lead, comercial, evento)
async function guardarLeadRemoto(lead) {
  const r = await api('guardarLead', { lead }); normalizarLead(r.lead);
  const i = S.leads.findIndex(x => x.id === r.lead.id);
  if (i >= 0) S.leads[i] = r.lead; else S.leads.unshift(r.lead);
  S.version = null;
  if (r.lead.errorCalendario) mostrarToast('Guardado, pero no se pudo agendar en el calendario: ' + r.lead.errorCalendario, 'error');
  return r.lead;
}
function upsertCotizacion(c) { const i = S.cotizaciones.findIndex(x => x.id === c.id); if (i >= 0) S.cotizaciones[i] = c; else S.cotizaciones.unshift(c); }
function upsertLead(l) { if (!l) return; normalizarLead(l); const i = S.leads.findIndex(x => x.id === l.id); if (i >= 0) S.leads[i] = l; else S.leads.unshift(l); }

// ===== NAVEGACIÓN =====
const VISTAS = ['leads', 'agenda', 'cotizaciones', 'reportes', 'usuarios'];
function irAVista(v) {
  if (v === 'usuarios' && !gestionaUsuarios()) v = 'leads';
  S.vista = v;
  VISTAS.forEach(x => { $('vista-' + x).classList.toggle('hidden', x !== v); $('nav-' + x).classList.toggle('active', x === v); });
  renderVista();
}
function renderVista() {
  if (!S.usuario) return;
  ({ leads: renderLeads, agenda: renderAgenda, cotizaciones: renderCotizaciones, reportes: renderReportes, usuarios: renderUsuarios })[S.vista]();
  const venc = S.leads.filter(l => esActivo(l) && l.fechaSeguimiento && diasR(l.fechaSeguimiento) <= 0 ).length;
  const nU = gestionaUsuarios() ? S.usuarios.filter(esRegistroNuevo).length : 0;
  $('nav-usuarios').querySelector('.tab-n').textContent = nU; $('nav-usuarios').querySelector('.tab-n').classList.toggle('hidden', !nU);
  $('nav-agenda').querySelector('.tab-n').textContent = venc; $('nav-agenda').querySelector('.tab-n').classList.toggle('hidden', !venc);
}
function abrirDesdeHash() { if (/#usuarios/.test(location.hash) && gestionaUsuarios()) { irAVista('usuarios'); return; } const m = location.hash.match(/lead=([\w-]+)/); if (m && S.leads.some(l => l.id === m[1])) abrirFicha(m[1]); }

// Listas que dependen de los datos (comerciales, marcas, referencias)
function cargarFiltrosDinamicos() {
  const coms = S.usuarios.filter(u => S.leads.some(l => l.comercial === u.correo) || (u.activo && asignables().includes(u)));
  ['lComercial', 'aComercial', 'cComercial', 'rComercial'].forEach(id => {
    const s = $(id); if (!s) return; const v = s.value;
    s.innerHTML = '<option value="">Todos los comerciales</option>' + coms.map(u => `<option value="${esc(u.correo)}">${esc(u.nombre)}</option>`).join(''); s.value = v;
  });
  const marcas = [...new Set(MARCAS.concat(S.leads.map(l => l.marca).filter(Boolean)))].sort((a, b) => a.localeCompare(b));
  $('dl-marcas').innerHTML = marcas.map(m => `<option value="${esc(m)}">`).join('');
  ['lMarca', 'rMarca'].forEach(id => { const s = $(id); if (!s) return; const v = s.value; const usadas = [...new Set(S.leads.map(l => l.marca).filter(Boolean))].sort(); s.innerHTML = '<option value="">Todas las marcas</option>' + usadas.map(m => `<option>${esc(m)}</option>`).join(''); s.value = v; });
  const so = $('lOrigen'); if (so) { const v = so.value; so.innerHTML = '<option value="">Todos los orígenes</option>' + ORIGENES.map(o => `<option>${esc(o)}</option>`).join(''); so.value = v; }
}
function referenciasDe(marca) { return [...new Set(S.leads.filter(l => normTxt(l.marca) === normTxt(marca)).map(l => l.referencia).concat(S.cotizaciones.filter(c => c.vehiculo && normTxt(c.vehiculo.marca) === normTxt(marca)).map(c => c.vehiculo.referencia)).filter(Boolean))].sort(); }

// ===== MODAL GENÉRICO =====
function abrirModal(titulo, html, botones, ancho) {
  $('modalTitulo').innerHTML = titulo; $('modalContenido').innerHTML = html;
  $('modalFooter').innerHTML = `<button class="btn btn-outline-dark" onclick="cerrarModal()">Cerrar</button>` + (botones || '');
  $('modalBox').className = 'modal-box ' + (ancho || 'modal-lg');
  $('modal').classList.remove('hidden'); $('modalContenido').scrollTop = 0;
}
function cerrarModal() {
  $('modal').classList.add('hidden');
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  if (_renderPendiente) setTimeout(refrescarVista, 50); else renderVista();
}

// ===== USUARIOS (gerencia y administrador) =====
const esRegistroNuevo = u => u.activo && u.rol === 'comercial' && !u.supervisor && u.creado && (Date.now() - new Date(u.creado).getTime()) < 15 * 86400000;
function renderUsuarios() {
  const orden = { admin: 0, gerencia: 1, supervisor: 2, comercial: 3 };
  const nuevos = S.usuarios.filter(esRegistroNuevo);
  $('us-nuevos').innerHTML = nuevos.length ? `🆕 <b>${nuevos.length} registro(s) reciente(s) sin supervisor:</b> ${nuevos.map(u => `<button class="link-btn" onclick="abrirUsuario('${esc(u.correo)}')">${esc(u.nombre)}</button>`).join(', ')}. Revisa si son supervisores (cambia el perfil) o asígnales su supervisor; desactiva a quien no pertenezca al equipo.` : '';
  $('us-nuevos').classList.toggle('hidden', !nuevos.length);
  $('tbodyUsuarios').innerHTML = S.usuarios.slice().sort((a, b) => (b.activo - a.activo) || (orden[a.rol] - orden[b.rol]) || a.nombre.localeCompare(b.nombre)).map(u => {
    const mios = S.leads.filter(l => l.comercial === u.correo), equipo = S.usuarios.filter(x => x.supervisor === u.correo);
    return `<tr class="${u.activo ? '' : 'fila-inactiva'} ${esRegistroNuevo(u) ? 'fila-nuevo' : ''}"><td><div class="us-nombre">${avatarHTML(u, 34)}<div><b>${esc(u.nombre)}</b>${esRegistroNuevo(u) ? ' <span class="st st-cotizado">Nuevo</span>' : ''}<div class="td-sub">${[u.ciudad, u.documento ? 'CC ' + u.documento : '', u.creado ? 'desde ' + fmtD(String(u.creado).slice(0, 10)) : '', u.origen === 'Google' ? 'con Google' : '', u.tieneClave ? '🔑 con contraseña' : ''].filter(Boolean).map(esc).join(' · ')}${perfilIncompleto(u) ? ' · <span class="txt-r">perfil incompleto</span>' : ''}</div></div></div></td><td>${esc(u.correo)}</td><td><span class="st ${ROL_CLS[u.rol]}">${ROLES[u.rol]}</span></td>
      <td>${u.rol === 'supervisor' ? `<span class="td-sub2">Equipo: ${equipo.length ? equipo.map(x => esc(x.nombre)).join(', ') : '<i>sin asignar</i>'}</span>` : u.rol === 'comercial' ? (u.supervisor ? esc(nombreUsuario(u.supervisor)) : '<span class="cell-n">Sin supervisor</span>') : '<span class="cell-n">Ve todo</span>'}</td>
      <td>${esc(u.telefono || '—')}</td><td>${esc(u.cargo || '—')}</td><td>${u.activo ? '<span class="txt-g">Activo</span>' : '<span class="txt-r">Inactivo</span>'}</td>
      <td style="text-align:center">${mios.filter(esActivo).length}</td><td class="td-acc">${u.rol === 'admin' && rolActual() !== 'admin' ? '' : `<button class="btn-notif" onclick="abrirUsuario('${esc(u.correo)}')">✏️ Editar</button>`}</td></tr>`;
  }).join('') || '<tr><td colspan="9" class="empty-msg">Sin usuarios</td></tr>';
}
function abrirUsuario(correo) {
  const u = S.usuarios.find(x => x.correo === correo) || { correo: '', nombre: '', rol: 'comercial', activo: true, telefono: '', cargo: 'Asesor comercial', supervisor: '' };
  const sups = S.usuarios.filter(x => x.rol === 'supervisor' && x.activo && x.correo !== u.correo);
  const roles = Object.entries(ROLES).filter(([k]) => k !== 'admin' || rolActual() === 'admin');
  const desc = { comercial: 've y gestiona solo sus leads', supervisor: 'gestiona sus propios leads y ve los de su equipo con sus estadísticas', gerencia: 've todo, asigna supervisores y gestiona usuarios', admin: 've todo y gestiona usuarios y administradores' };
  abrirModal(correo ? 'Editar usuario' : 'Nuevo usuario', `
    <div class="form-grid">
      <div class="form-group"><label>Correo personal *</label><input id="us_correo" type="email" value="${esc(u.correo)}" ${correo ? 'disabled' : ''} placeholder="nombre@gmail.com"/></div>
      <div class="form-group"><label>Nombre completo *</label><input id="us_nombre" value="${esc(u.nombre)}"/></div>
      <div class="form-group"><label>Perfil</label><select id="us_rol" onchange="$('us_sup_box').classList.toggle('hidden',this.value!=='comercial')">${roles.map(([k, t]) => `<option value="${k}" ${u.rol === k ? 'selected' : ''}>${t} — ${desc[k]}</option>`).join('')}</select></div>
      <div class="form-group ${u.rol === 'comercial' ? '' : 'hidden'}" id="us_sup_box"><label>Supervisor a cargo</label><select id="us_sup"><option value="">— Sin supervisor —</option>${sups.map(x => `<option value="${esc(x.correo)}" ${u.supervisor === x.correo ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Teléfono (sale en las cotizaciones)</label><input id="us_tel" value="${esc(u.telefono)}"/></div>
      <div class="form-group"><label>Cargo</label><input id="us_cargo" value="${esc(u.cargo)}"/></div>
      <div class="form-group"><label>${u.tieneClave ? 'Nueva contraseña' : 'Contraseña (opcional)'}</label><input type="password" id="us_clave" autocomplete="new-password" placeholder="${u.tieneClave ? 'Vacía = no cambiarla' : 'Mín. 8, con letras y números'}"/>${u.tieneClave ? '<label class="chk-inline"><input type="checkbox" id="us_quitar"/> Quitar la contraseña</label>' : ''}</div>
      <div class="form-group"><label>Estado</label><select id="us_activo"><option value="1">Activo</option><option value="0" ${u.activo ? '' : 'selected'}>Inactivo (no puede ingresar)</option></select></div>
    </div>
    ${correo ? `<div class="us-datos">${avatarHTML(u, 48)}<div><b>Datos de contacto</b><div>${[u.ciudad, u.direccion].filter(Boolean).map(esc).join(' · ') || '<span class="cell-n">Sin ciudad / dirección</span>'}</div>
      <div>${u.documento ? 'Cédula ' + esc(u.documento) : '<span class="txt-r">Sin cédula</span>'}${u.contactoEmergencia || u.telEmergencia ? ' · Emergencia: ' + esc([u.contactoEmergencia, u.telEmergencia].filter(Boolean).join(' ')) : ''}</div>
      <div class="td-sub">Registro: ${esc(u.origen || 'manual')}${u.creado ? ' · ' + fmtD(String(u.creado).slice(0, 10)) : ''}. Cada persona actualiza estos datos en "Mi perfil".</div></div></div>` : ''}
    <p class="nota-cal">Cada persona entra con este correo: con su cuenta de Google, con un código de 6 dígitos que le llega a ese buzón o, si le asignas una, con <b>contraseña</b> (se guarda cifrada; cada uno puede cambiarla en Mi perfil). Los comerciales se asignan a un <b>supervisor</b>, que verá los leads, la agenda y las estadísticas de su equipo.${sups.length ? '' : ' Aún no hay usuarios con perfil Supervisor: créalos primero para poder asignarles comerciales.'}</p>`,
    `<button class="btn btn-primary-dark" onclick="guardarUsuario(this)">💾 Guardar</button>`, 'modal-md');
}
async function guardarUsuario(btn) {
  const usuario = { correo: $('us_correo').value.trim().toLowerCase(), nombre: $('us_nombre').value.trim(), telefono: $('us_tel').value.trim(), cargo: $('us_cargo').value.trim(),
    rol: $('us_rol').value, supervisor: $('us_rol').value === 'comercial' ? $('us_sup').value : '', activo: $('us_activo').value === '1' };
  if (!usuario.correo || !usuario.nombre) { mostrarToast('Correo y nombre son obligatorios', 'error'); return; }
  const clave = $('us_clave').value; if (clave) { if (!claveValida(clave)) { mostrarToast('La contraseña debe tener mínimo 8 caracteres, con letras y números', 'error'); return; } usuario.clave = clave; }
  else if ($('us_quitar') && $('us_quitar').checked) usuario.quitarClave = true;
  await conEspera(btn, async () => {
    try { const r = await api('guardarUsuario', { usuario }); S.usuarios = r.usuarios; S.version = null; cerrarModal(); cargarFiltrosDinamicos(); mostrarToast('Usuario guardado', 'success'); sincronizar(true); }
    catch (e) { mostrarToast(e.message, 'error'); }
  });
}

// ===== CALENDARIO (enlace de Google Calendar y .ics como respaldo) =====
function fechasEvento(l) {
  const f = l.fechaSeguimiento.replace(/-/g, '');
  if (!l.horaSeguimiento) { const sig = sumarDias(l.fechaSeguimiento, 1).replace(/-/g, ''); return { gc: `${f}/${sig}`, ini: `;VALUE=DATE:${f}`, fin: `;VALUE=DATE:${sig}` }; }
  const [h, m] = l.horaSeguimiento.split(':').map(Number); const fin = new Date(2000, 0, 1, h, m + 30);
  const t1 = `${f}T${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}00`, t2 = `${f}T${String(fin.getHours()).padStart(2, '0')}${String(fin.getMinutes()).padStart(2, '0')}00`;
  return { gc: `${t1}/${t2}`, ini: `;TZID=America/Bogota:${t1}`, fin: `;TZID=America/Bogota:${t2}` };
}
function textoEvento(l) { return { t: `☑ Tarea: seguimiento · ${l.prospecto} (${l.id})${l.marca ? ' · ' + l.marca + ' ' + (l.referencia || '') : ''}`, d: `Prospecto: ${l.prospecto}\nTeléfono: ${l.telefono}\nWhatsApp: ${linkWa(l.telefono)}\nVehículo: ${[l.marca, l.referencia, l.version].filter(Boolean).join(' ')}\nEstado: ${EST[l.estado].t}` }; }
function urlGoogleCalendar(l) {
  if (!l.fechaSeguimiento) return '#'; const e = textoEvento(l);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.t)}&dates=${fechasEvento(l).gc}&ctz=America/Bogota&details=${encodeURIComponent(e.d)}`;
}
function descargarICS(id) {
  const l = S.leads.find(x => x.id === id); if (!l || !l.fechaSeguimiento) { mostrarToast('El lead no tiene fecha de seguimiento', 'info'); return; }
  const e = textoEvento(l), f = fechasEvento(l), x = s => String(s).replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ventas//Seguimiento comercial//ES', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${l.id}-${l.fechaSeguimiento}@ventas`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, `DTSTART${f.ini}`, `DTEND${f.fin}`, `SUMMARY:${x(e.t)}`, `DESCRIPTION:${x(e.d)}`,
    'BEGIN:VALARM', `TRIGGER:${l.horaSeguimiento ? '-PT30M' : '-PT15H'}`, 'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio de seguimiento', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  descargarBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), `seguimiento_${l.id}.ics`);
}

// ===== INICIO =====
document.addEventListener('DOMContentLoaded', () => {
  $('modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') cerrarModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('modal').classList.contains('hidden')) cerrarModal(); });
  try { S.token = localStorage.getItem('vt_token'); S.usuario = JSON.parse(localStorage.getItem('vt_usuario') || 'null'); } catch (e) {}
  if (S.token && S.usuario) entrarApp(); else mostrarLogin();
  setInterval(() => { if (document.visibilityState === 'visible') sincronizar(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizar(); });
  document.addEventListener('focusout', () => setTimeout(() => { if (_renderPendiente) refrescarVista(); }, 300));
  window.addEventListener('hashchange', abrirDesdeHash);
});
