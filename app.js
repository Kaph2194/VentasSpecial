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
let EMPRESA = { nombre: 'Special Car', nit: '', direccion: '', ciudad: 'Bogotá D.C.', telefono: '', correo: '', web: '' };
let VALIDEZ_COTIZACION = 8;
// Versión de apps-script/Ventas.gs que espera esta página
const VERSION_BACKEND_ESPERADA = '2026-11-18.4';
let _avisoVersion = false;

// ===== CATÁLOGOS =====
const ESTADOS = [
  { k: 'nuevo', t: 'Nuevo', c: 'st-nuevo' },
  { k: 'contactado', t: 'Contactado', c: 'st-contactado' },
  { k: 'cita', t: 'Cita / visita agendada', c: 'st-cita' },
  { k: 'prueba', t: 'Prueba de manejo', c: 'st-prueba' },
  { k: 'cotizado', t: 'Cotizado', c: 'st-cotizado' },
  { k: 'negociacion', t: 'Negociación', c: 'st-negociacion' },
  { k: 'credito', t: 'Crédito en estudio', c: 'st-credito' },
  { k: 'aprobado', t: 'Aprobado / separado', c: 'st-aprobado' },
  { k: 'facturado', t: 'Facturado', c: 'st-facturado' },
  { k: 'entregado', t: 'Entregado', c: 'st-entregado' },
  { k: 'perdido', t: 'Perdido', c: 'st-perdido' }
];
const EST = {}; ESTADOS.forEach((e, i) => { EST[e.k] = Object.assign({ i }, e); });
const FINALES = ['entregado', 'perdido'];
const GANADOS = ['facturado', 'entregado'];
const esActivo = l => !FINALES.includes(l.estado);
const ORIGENES = ['Vitrina / showroom', 'Llamada entrante', 'WhatsApp', 'Página web', 'Facebook / Instagram', 'TikTok', 'Referido', 'Cliente antiguo', 'Base de datos', 'Feria / evento', 'TuCarro / Marketplace', 'Otro'];
const MEDIOS = ['Llamada', 'WhatsApp', 'Correo', 'Visita en vitrina', 'Videollamada', 'Redes sociales', 'Otro'];
const RESULTADOS = [
  { t: 'No contestó', c: 'res-mal' }, { t: 'Número errado', c: 'res-mal' }, { t: 'Interesado', c: 'res-ok' },
  { t: 'Solicita cotización', c: 'res-info' }, { t: 'Agenda cita / visita', c: 'res-ok' }, { t: 'Agenda prueba de manejo', c: 'res-ok' },
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

// ===== ACCESO CON CORREO PERSONAL (código de 6 dígitos) =====
let _registro = false;
function modoRegistro(on) {
  _registro = !!on;
  document.querySelectorAll('.lg-reg').forEach(x => x.classList.toggle('hidden', !_registro));
  $('lg-ayuda1').classList.toggle('hidden', _registro);
  $('lg-tab-entrar').classList.toggle('activo', !_registro); $('lg-tab-registro').classList.toggle('activo', _registro);
  $('lg-btn1').textContent = _registro ? 'Registrarme: enviarme el código' : 'Enviarme un código de acceso';
  setTimeout(() => $(_registro ? 'lg-nombre' : 'lg-correo').focus(), 50);
}
function mostrarLogin() {
  $('login').classList.remove('hidden'); $('app').classList.add('hidden');
  if (/[?&]registro\b/.test(location.search)) setTimeout(() => modoRegistro(true), 0);
  $('lg-paso1').classList.remove('hidden'); $('lg-paso2').classList.add('hidden');
  $('lg-demo').classList.toggle('hidden', !MODO_DEMO);
  try { $('lg-correo').value = localStorage.getItem('vt_ultimo_correo') || ''; } catch (e) {}
  setTimeout(() => $('lg-correo').focus(), 50);
}
async function pedirCodigo(ev) {
  if (ev) ev.preventDefault();
  const correo = $('lg-correo').value.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) { mostrarToast('Escribe tu correo electrónico', 'error'); return; }
  let registro = null;
  if (_registro) {
    registro = { nombre: $('lg-nombre').value.trim(), telefono: $('lg-tel').value.trim() };
    if (registro.nombre.split(/\s+/).length < 2) { mostrarToast('Escribe tu nombre y apellido', 'error'); return; }
    if (registro.telefono.replace(/\D/g, '').length < 7) { mostrarToast('Escribe tu número de celular', 'error'); return; }
  }
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
    } catch (e) { mostrarToast(e.message, 'error'); if (/no está registrado/.test(e.message) && !_registro) modoRegistro(true); }
  });
}
async function verificarCodigo(ev) {
  if (ev) ev.preventDefault();
  const correo = $('lg-para').textContent, codigo = $('lg-codigo').value.trim();
  if (!/^\d{6}$/.test(codigo)) { mostrarToast('El código tiene 6 dígitos', 'error'); return; }
  await conEspera($('lg-btn2'), async () => {
    try {
      const r = await api('verificarCodigo', { correo, codigo });
      S.token = r.token; S.usuario = r.usuario;
      try { localStorage.setItem('vt_token', r.token); localStorage.setItem('vt_usuario', JSON.stringify(r.usuario)); } catch (e) {}
      entrarApp();
    } catch (e) { mostrarToast(e.message, 'error'); }
  });
}
function cerrarSesion(silencioso) {
  if (!silencioso && S.token) api('cerrarSesion').catch(() => {});
  S.token = null; S.usuario = null; S.leads = []; S.cotizaciones = []; S.version = null;
  try { localStorage.removeItem('vt_token'); localStorage.removeItem('vt_usuario'); } catch (e) {}
  mostrarLogin();
}
function entrarApp() {
  $('login').classList.add('hidden'); $('app').classList.remove('hidden');
  $('user-chip').innerHTML = `<b>${esc(S.usuario.nombre)}</b><small>${esc(S.usuario.correo)} · ${ROLES[rolActual()]}${esSupervisor() ? ' · equipo de ' + S.usuarios.filter(u => u.supervisor === S.usuario.correo).length : ''}</small>`;
  $('nav-usuarios').classList.toggle('hidden', !gestionaUsuarios());
  $('banner-demo').classList.toggle('hidden', !MODO_DEMO);
  document.body.classList.toggle('es-admin', veEquipo());
  irAVista(S.vista || 'leads');
  sincronizar(true).then(abrirDesdeHash);
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
        S.version = r.version; S.usuario = r.usuario || S.usuario; S.usuarios = r.usuarios || [];
        S.leads = r.leads || []; S.cotizaciones = r.cotizaciones || [];
        if (r.empresa) EMPRESA = Object.assign({}, EMPRESA, r.empresa);
        if (r.validezCotizacion) VALIDEZ_COTIZACION = r.validezCotizacion;
        S.hoja = r.hoja || ''; S.carpeta = r.carpeta || '';
        if (!MODO_DEMO && r.versionBackend !== VERSION_BACKEND_ESPERADA && !_avisoVersion) { _avisoVersion = true; $('banner-version').classList.remove('hidden'); }
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
  const r = await api('guardarLead', { lead });
  const i = S.leads.findIndex(x => x.id === r.lead.id);
  if (i >= 0) S.leads[i] = r.lead; else S.leads.unshift(r.lead);
  S.version = null;
  if (r.lead.errorCalendario) mostrarToast('Guardado, pero no se pudo agendar en el calendario: ' + r.lead.errorCalendario, 'error');
  return r.lead;
}
function upsertCotizacion(c) { const i = S.cotizaciones.findIndex(x => x.id === c.id); if (i >= 0) S.cotizaciones[i] = c; else S.cotizaciones.unshift(c); }
function upsertLead(l) { if (!l) return; const i = S.leads.findIndex(x => x.id === l.id); if (i >= 0) S.leads[i] = l; else S.leads.unshift(l); }

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
    return `<tr class="${u.activo ? '' : 'fila-inactiva'} ${esRegistroNuevo(u) ? 'fila-nuevo' : ''}"><td><b>${esc(u.nombre)}</b>${esRegistroNuevo(u) ? ' <span class="st st-cotizado">Nuevo</span>' : ''}${u.creado ? `<div class="td-sub">Desde ${fmtD(String(u.creado).slice(0, 10))}</div>` : ''}</td><td>${esc(u.correo)}</td><td><span class="st ${ROL_CLS[u.rol]}">${ROLES[u.rol]}</span></td>
      <td>${u.rol === 'supervisor' ? `<span class="td-sub2">Equipo: ${equipo.length ? equipo.map(x => esc(x.nombre)).join(', ') : '<i>sin asignar</i>'}</span>` : u.rol === 'comercial' ? (u.supervisor ? esc(nombreUsuario(u.supervisor)) : '<span class="cell-n">Sin supervisor</span>') : '<span class="cell-n">Ve todo</span>'}</td>
      <td>${esc(u.telefono || '—')}</td><td>${esc(u.cargo || '—')}</td><td>${u.activo ? '<span class="txt-g">Activo</span>' : '<span class="txt-r">Inactivo</span>'}</td>
      <td style="text-align:center">${mios.filter(esActivo).length}</td><td class="td-acc">${u.rol === 'admin' && rolActual() !== 'admin' ? '' : `<button class="btn-notif" onclick="abrirUsuario('${esc(u.correo)}')">✏️ Editar</button>`}</td></tr>`;
  }).join('') || '<tr><td colspan="9" class="empty-msg">Sin usuarios</td></tr>';
}
function abrirUsuario(correo) {
  const u = S.usuarios.find(x => x.correo === correo) || { correo: '', nombre: '', rol: 'comercial', activo: true, telefono: '', cargo: 'Asesor comercial', supervisor: '' };
  const sups = S.usuarios.filter(x => x.rol === 'supervisor' && x.activo && x.correo !== u.correo);
  const roles = Object.entries(ROLES).filter(([k]) => k !== 'admin' || rolActual() === 'admin');
  const desc = { comercial: 've y gestiona solo sus leads', supervisor: 've los leads y estadísticas de su equipo', gerencia: 've todo, asigna supervisores y gestiona usuarios', admin: 've todo y gestiona usuarios y administradores' };
  abrirModal(correo ? 'Editar usuario' : 'Nuevo usuario', `
    <div class="form-grid">
      <div class="form-group"><label>Correo personal *</label><input id="us_correo" type="email" value="${esc(u.correo)}" ${correo ? 'disabled' : ''} placeholder="nombre@gmail.com"/></div>
      <div class="form-group"><label>Nombre completo *</label><input id="us_nombre" value="${esc(u.nombre)}"/></div>
      <div class="form-group"><label>Perfil</label><select id="us_rol" onchange="$('us_sup_box').classList.toggle('hidden',this.value!=='comercial')">${roles.map(([k, t]) => `<option value="${k}" ${u.rol === k ? 'selected' : ''}>${t} — ${desc[k]}</option>`).join('')}</select></div>
      <div class="form-group ${u.rol === 'comercial' ? '' : 'hidden'}" id="us_sup_box"><label>Supervisor a cargo</label><select id="us_sup"><option value="">— Sin supervisor —</option>${sups.map(x => `<option value="${esc(x.correo)}" ${u.supervisor === x.correo ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Teléfono (sale en las cotizaciones)</label><input id="us_tel" value="${esc(u.telefono)}"/></div>
      <div class="form-group"><label>Cargo</label><input id="us_cargo" value="${esc(u.cargo)}"/></div>
      <div class="form-group"><label>Estado</label><select id="us_activo"><option value="1">Activo</option><option value="0" ${u.activo ? '' : 'selected'}>Inactivo (no puede ingresar)</option></select></div>
    </div>
    <p class="nota-cal">Cada persona entra con este correo: recibe un código de 6 dígitos en ese buzón. Los comerciales se asignan a un <b>supervisor</b>, que verá los leads, la agenda y las estadísticas de su equipo.${sups.length ? '' : ' Aún no hay usuarios con perfil Supervisor: créalos primero para poder asignarles comerciales.'}</p>`,
    `<button class="btn btn-primary-dark" onclick="guardarUsuario(this)">💾 Guardar</button>`, 'modal-md');
}
async function guardarUsuario(btn) {
  const usuario = { correo: $('us_correo').value.trim().toLowerCase(), nombre: $('us_nombre').value.trim(), telefono: $('us_tel').value.trim(), cargo: $('us_cargo').value.trim(),
    rol: $('us_rol').value, supervisor: $('us_rol').value === 'comercial' ? $('us_sup').value : '', activo: $('us_activo').value === '1' };
  if (!usuario.correo || !usuario.nombre) { mostrarToast('Correo y nombre son obligatorios', 'error'); return; }
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
function textoEvento(l) { return { t: `🚗 Seguimiento ${l.id} · ${l.prospecto}${l.marca ? ' · ' + l.marca + ' ' + (l.referencia || '') : ''}`, d: `Prospecto: ${l.prospecto}\nTeléfono: ${l.telefono}\nWhatsApp: ${linkWa(l.telefono)}\nVehículo: ${[l.marca, l.referencia, l.version].filter(Boolean).join(' ')}\nEstado: ${EST[l.estado].t}` }; }
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
