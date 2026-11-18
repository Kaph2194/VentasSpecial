/**
 * =====================================================================
 *  BACKEND DE VENTAS — Seguimiento comercial de vehículos (Google Apps Script)
 * ---------------------------------------------------------------------
 *  Basado en el backend del módulo de Cartera (SpecialTO).
 *
 *  Se crea e implementa DESDE LA CUENTA DUEÑA del sistema (p.ej. ventas@empresa.com).
 *  Esa cuenta guarda la hoja de cálculo, las cotizaciones en Drive, envía los
 *  correos y tiene el calendario "Ventas - Seguimientos". Cada comercial entra
 *  a la app con SU correo personal: recibe un código de acceso en ese correo y
 *  los seguimientos de sus leads le llegan como invitación a su propio calendario.
 *
 *  Qué hace:
 *    1. Usuarios (comerciales y administradores) y acceso con código al correo.
 *    2. Leads: # lead consecutivo, datos del prospecto, vehículo de interés,
 *       estados hasta la finalización (entregado o perdido) con historial.
 *    3. Gestiones / seguimientos con próxima fecha y hora -> evento en el
 *       calendario con el comercial como invitado (recordatorios).
 *    4. Cotizaciones: consecutivo, PDF guardado en Drive, cotizaciones cargadas
 *       (PDF/imagen), envío por correo con el PDF adjunto.
 *    5. Agenda diaria por correo a cada comercial y resumen gerencial.
 *
 *  Instalación: ver VENTAS_SETUP.md.
 * =====================================================================
 */

const CONFIG = {
  EMPRESA: {
    nombre: 'Special Car',
    nit: '',
    direccion: '',
    ciudad: 'Bogotá D.C.',
    telefono: '',
    correo: '',
    web: ''
  },
  NOMBRE_REMITENTE: 'Ventas - Special Car',
  ZONA: 'America/Bogota',
  URL_APP: '',                       // URL pública de la app (GitHub Pages); se pone en los correos y eventos
  SHEET_ID: '',                      // vacío = se crea "Ventas - Seguimiento comercial" en el Drive de la cuenta dueña
  CALENDARIO_NOMBRE: 'Ventas - Seguimientos',  // '' = calendario principal de la cuenta dueña
  ENVIAR_INVITACIONES: true,         // el comercial recibe la invitación (así queda en SU calendario, sea Gmail u otro)
  DURACION_EVENTO_MIN: 30,
  CARPETA_COTIZACIONES: 'Ventas - Cotizaciones',
  VALIDEZ_COTIZACION_DIAS: 8,
  DURACION_SESION_DIAS: 30,          // días que la app recuerda el ingreso en ese navegador
  ADMINS: [],                        // correos que siempre son administradores (además de la cuenta dueña)
  HORA_AGENDA: 7,                    // hora (0-23) del correo diario de agenda / resumen
  ENVIAR_AGENDA_COMERCIALES: true,   // cada comercial recibe sus seguimientos vencidos y del día
  ENVIAR_RESUMEN_GERENCIA: true,     // los administradores reciben el resumen diario
  DIAS_SIN_GESTION_ALERTA: 3         // leads activos sin gestión en N días aparecen en el resumen
};

// ===================== CATÁLOGOS (mismos que ventas.js) =====================
const ESTADOS_ = [
  ['nuevo', 'Nuevo'], ['contactado', 'Contactado'], ['cita', 'Cita / visita agendada'], ['prueba', 'Prueba de manejo'],
  ['cotizado', 'Cotizado'], ['negociacion', 'Negociación'], ['credito', 'Crédito en estudio'], ['aprobado', 'Aprobado / separado'],
  ['facturado', 'Facturado'], ['entregado', 'Entregado'], ['perdido', 'Perdido']
];
const ESTADO_TXT_ = {}; ESTADOS_.forEach(e => ESTADO_TXT_[e[0]] = e[1]);
const ORDEN_ESTADO_ = {}; ESTADOS_.forEach((e, i) => ORDEN_ESTADO_[e[0]] = i);
const FINALES_ = ['entregado', 'perdido'];
const GANADOS_ = ['facturado', 'entregado'];
const esActivo_ = l => FINALES_.indexOf(l.estado) < 0;

// ===================== WEB APP =====================
function doGet() {
  return json_({ ok: true, servicio: 'ventas-seguimiento-comercial', disparador: asegurarDisparador_() });
}

function doPost(e) {
  try {
    const p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    asegurarDisparador_();
    // acciones públicas (sin sesión)
    switch (p.accion) {
      case 'ping':            return json_({ ok: true, empresa: CONFIG.EMPRESA.nombre });
      case 'solicitarCodigo': return json_(solicitarCodigo_(p.correo));
      case 'verificarCodigo': return json_(verificarCodigo_(p.correo, p.codigo));
    }
    const u = usuarioDeToken_(p.token);
    if (!u) return json_({ error: 'sesion' });
    switch (p.accion) {
      case 'cerrarSesion':       PropertiesService.getScriptProperties().deleteProperty('SES_' + p.token); return json_({ ok: true });
      case 'obtenerDatos':       return json_(obtenerDatos_(u, p.version));
      case 'guardarLead':        return json_(guardarLead_(u, p.lead));
      case 'guardarCotizacion':  return json_(guardarCotizacion_(u, p.cotizacion, p.pdfBase64, p.archivo));
      case 'obtenerArchivo':     return json_(obtenerArchivo_(u, p.cotizacionId));
      case 'enviarCotizacion':   return json_(enviarCotizacion_(u, p));
      case 'guardarUsuario':     return json_(guardarUsuario_(u, p.usuario));
      case 'enviarInforme':      return json_(enviarInformeAhora_(u));
      default: return json_({ error: 'accion desconocida: ' + p.accion });
    }
  } catch (err) {
    console.error(err);
    return json_({ error: String(err && err.message || err) });
  }
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ===================== HOJA DE CÁLCULO =====================
function libro_() {
  const props = PropertiesService.getScriptProperties();
  const id = CONFIG.SHEET_ID || props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.create('Ventas - Seguimiento comercial');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}
function hoja_(nombre, encabezados) {
  const ss = libro_();
  let h = ss.getSheetByName(nombre);
  if (!h) {
    h = ss.insertSheet(nombre);
    if (encabezados) { h.getRange(1, 1, 1, encabezados.length).setValues([encabezados]).setFontWeight('bold').setBackground('#2c4887').setFontColor('#ffffff'); h.setFrozenRows(1); }
    const def = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
    if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  }
  return h;
}
function versionActual_() { return PropertiesService.getScriptProperties().getProperty('VERSION') || '0'; }
function tocarVersion_() { PropertiesService.getScriptProperties().setProperty('VERSION', String(Date.now())); }
// Consecutivos (# lead, # cotización). Se llaman siempre dentro del lock.
function siguiente_(clave) {
  const props = PropertiesService.getScriptProperties();
  const n = (Number(props.getProperty('SEQ_' + clave)) || 0) + 1;
  props.setProperty('SEQ_' + clave, String(n));
  return n;
}
const pad_ = (n, l) => ('00000000' + n).slice(-Math.max(l, String(n).length));

// ===================== USUARIOS Y ACCESO =====================
const ENC_USUARIOS = ['Correo', 'Nombre', 'Rol', 'Activo', 'Teléfono', 'Cargo', 'Creado', 'Último ingreso'];
function correoOk_(c) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c); }
function normCorreo_(c) { return String(c || '').trim().toLowerCase(); }

function leerUsuarios_() {
  const h = hoja_('Usuarios', ENC_USUARIOS);
  if (h.getLastRow() < 2) asegurarUsuariosIniciales_(h);
  const n = h.getLastRow() - 1;
  if (n < 1) return [];
  const admins = CONFIG.ADMINS.map(normCorreo_).concat([normCorreo_(Session.getEffectiveUser().getEmail())]);
  return h.getRange(2, 1, n, ENC_USUARIOS.length).getValues().filter(f => f[0]).map((f, i) => {
    const correo = normCorreo_(f[0]);
    return { fila: i + 2, correo: correo, nombre: String(f[1] || correo), rol: admins.indexOf(correo) >= 0 || /admin/i.test(f[2]) ? 'admin' : 'comercial',
      activo: !/^(no|false|0|inactivo)$/i.test(String(f[3]).trim()), telefono: String(f[4] || ''), cargo: String(f[5] || '') };
  });
}
function asegurarUsuariosIniciales_(h) {
  const dueno = normCorreo_(Session.getEffectiveUser().getEmail());
  const lista = [dueno].concat(CONFIG.ADMINS.map(normCorreo_)).filter((c, i, a) => c && a.indexOf(c) === i);
  lista.forEach(c => h.appendRow([c, c === dueno ? 'Administrador' : c, 'Administrador', 'Sí', '', 'Gerente comercial', new Date(), '']));
}
function usuarioPorCorreo_(correo) { correo = normCorreo_(correo); return leerUsuarios_().filter(u => u.correo === correo)[0] || null; }
const publico_ = u => ({ correo: u.correo, nombre: u.nombre, rol: u.rol, activo: u.activo, telefono: u.telefono, cargo: u.cargo });

/** Envía un código de 6 dígitos al correo del comercial (válido 10 minutos). */
function solicitarCodigo_(correo) {
  correo = normCorreo_(correo);
  if (!correoOk_(correo)) throw new Error('Escribe un correo válido');
  const u = usuarioPorCorreo_(correo);
  if (!u || !u.activo) throw new Error('Este correo no está autorizado. Pide al administrador que te registre en la app.');
  const cache = CacheService.getScriptCache();
  const nEnvios = Number(cache.get('OTPN_' + correo)) || 0;
  if (nEnvios >= 5) throw new Error('Pediste demasiados códigos. Espera 15 minutos e inténtalo de nuevo.');
  cache.put('OTPN_' + correo, String(nEnvios + 1), 900);
  const codigo = String(100000 + Math.floor(Math.random() * 900000));
  cache.put('OTP_' + correo, JSON.stringify({ c: codigo, i: 0 }), 600);
  MailApp.sendEmail(correo, 'Tu código de acceso: ' + codigo, 'Tu código para entrar a la app de Ventas es ' + codigo + '. Vence en 10 minutos.', {
    name: CONFIG.NOMBRE_REMITENTE,
    htmlBody: '<div style="' + S_.wrap + ';max-width:460px">' + logoCorreo_() + '<h1 style="' + S_.h1 + '">Código de acceso</h1>' +
      '<p style="font-size:13px">Hola ' + esc_(u.nombre) + ', este es tu código para entrar a la app de seguimiento comercial:</p>' +
      '<p style="font-size:34px;font-weight:800;letter-spacing:8px;color:#2c4887;margin:18px 0">' + codigo + '</p>' +
      '<p style="font-size:12px;color:#6b7280">Vence en 10 minutos. Si no lo pediste, ignora este correo.</p></div>'
  });
  return { ok: true, enviado: true };
}
function verificarCodigo_(correo, codigo) {
  correo = normCorreo_(correo);
  const cache = CacheService.getScriptCache();
  const raw = cache.get('OTP_' + correo);
  if (!raw) throw new Error('El código venció o no se ha pedido. Solicita uno nuevo.');
  const o = JSON.parse(raw);
  if (String(codigo || '').replace(/\D/g, '') !== o.c) {
    o.i++;
    if (o.i >= 5) { cache.remove('OTP_' + correo); throw new Error('Demasiados intentos. Solicita un código nuevo.'); }
    cache.put('OTP_' + correo, JSON.stringify(o), 600);
    throw new Error('Código incorrecto (' + (5 - o.i) + ' intento(s) más)');
  }
  cache.remove('OTP_' + correo);
  const u = usuarioPorCorreo_(correo);
  if (!u || !u.activo) throw new Error('Usuario inactivo');
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  const props = PropertiesService.getScriptProperties();
  limpiarSesiones_(props);
  props.setProperty('SES_' + token, JSON.stringify({ c: correo, e: Date.now() + CONFIG.DURACION_SESION_DIAS * 86400000 }));
  try { hoja_('Usuarios', ENC_USUARIOS).getRange(u.fila, 8).setValue(new Date()); } catch (e) {}
  return { ok: true, token: token, usuario: publico_(u) };
}
function limpiarSesiones_(props) {
  const ahora = Date.now(), todo = props.getProperties();
  Object.keys(todo).forEach(k => { if (k.indexOf('SES_') === 0) { try { if (JSON.parse(todo[k]).e < ahora) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); } } });
}
function usuarioDeToken_(token) {
  if (!token) return null;
  const raw = PropertiesService.getScriptProperties().getProperty('SES_' + token);
  if (!raw) return null;
  let s; try { s = JSON.parse(raw); } catch (e) { return null; }
  if (s.e < Date.now()) return null;
  const u = usuarioPorCorreo_(s.c);
  return u && u.activo ? u : null;
}
function guardarUsuario_(u, nuevo) {
  if (u.rol !== 'admin') throw new Error('Solo un administrador puede gestionar usuarios');
  const correo = normCorreo_(nuevo && nuevo.correo);
  if (!correoOk_(correo)) throw new Error('Correo inválido');
  if (correo === u.correo && nuevo.activo === false) throw new Error('No puedes desactivar tu propio usuario');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const h = hoja_('Usuarios', ENC_USUARIOS);
    const ex = leerUsuarios_().filter(x => x.correo === correo)[0];
    const fila = [correo, String(nuevo.nombre || correo).trim(), nuevo.rol === 'admin' ? 'Administrador' : 'Comercial', nuevo.activo === false ? 'No' : 'Sí',
      String(nuevo.telefono || '').trim(), String(nuevo.cargo || '').trim()];
    if (ex) h.getRange(ex.fila, 1, 1, fila.length).setValues([fila]);
    else h.appendRow(fila.concat([new Date(), '']));
    tocarVersion_();
  } finally { lock.releaseLock(); }
  return { ok: true, usuarios: leerUsuarios_().map(publico_) };
}

// ===================== LEADS =====================
const ENC_LEADS = ['# Lead', 'Fecha contacto', 'Prospecto', 'Teléfono', 'Correo', 'Documento', 'Ciudad', 'Marca', 'Referencia', 'Versión / Modelo',
  'Origen', 'Estado', 'Fecha seguimiento', 'Hora', 'Comercial', 'Nombre comercial', 'Valor estimado', 'Forma de pago', 'Motivo pérdida', 'Observaciones',
  '# Cotizaciones', 'Última gestión', 'Fecha venta', 'Creado', 'Actualizado', 'JSON'];

function leerLeads_() {
  const h = hoja_('Leads', ENC_LEADS);
  const n = h.getLastRow() - 1;
  if (n < 1) return [];
  return h.getRange(2, ENC_LEADS.length, n, 1).getValues().map((f, i) => {
    try { const o = JSON.parse(f[0]); o._fila = i + 2; return o; } catch (e) { return null; }
  }).filter(Boolean);
}
function puedeVer_(u, lead) { return u.rol === 'admin' || normCorreo_(lead.comercial) === u.correo; }
function limpio_(o) { const c = JSON.parse(JSON.stringify(o)); delete c._fila; return c; }

// Une dos listas por id (nada de lo ya guardado se pierde si otro navegador manda una copia vieja)
function unir_(previa, nueva) {
  const mapa = {}, orden = [];
  (previa || []).concat(nueva || []).forEach(x => { if (!x || !x.id) return; if (!mapa[x.id]) orden.push(x.id); mapa[x.id] = Object.assign({}, mapa[x.id] || {}, x); });
  return orden.map(id => mapa[id]).sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));
}

function guardarLead_(u, lead) {
  if (!lead) throw new Error('Lead inválido');
  if (!String(lead.prospecto || '').trim()) throw new Error('El nombre del prospecto es obligatorio');
  if (!String(lead.telefono || '').trim()) throw new Error('El teléfono es obligatorio');
  if (!ESTADO_TXT_[lead.estado]) lead.estado = 'nuevo';
  if (lead.estado === 'perdido' && !String(lead.motivoPerdida || '').trim()) throw new Error('Indica el motivo por el que se perdió el lead');
  const usuarios = leerUsuarios_();
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  let res;
  try {
    const todos = leerLeads_();
    const previo = lead.id ? todos.filter(x => x.id === lead.id)[0] || null : null;
    const ahora = new Date().toISOString();
    if (previo) {
      if (!puedeVer_(u, previo)) throw new Error('Este lead pertenece a otro comercial');
      if (u.rol !== 'admin') lead.comercial = previo.comercial;     // solo el administrador reasigna
      lead.historial = unir_(previo.historial, lead.historial);
      lead.seguimientos = unir_(previo.seguimientos, lead.seguimientos);
      lead.creado = previo.creado; lead.creadoPor = previo.creadoPor; lead.eventId = previo.eventId; lead.eventoInvitado = previo.eventoInvitado;
    } else {
      lead.id = 'L-' + pad_(siguiente_('LEAD'), 4);
      lead.creado = ahora; lead.creadoPor = u.correo;
      if (u.rol !== 'admin' || !lead.comercial) lead.comercial = u.correo;
      lead.historial = lead.historial || [];
      if (!lead.historial.length) lead.historial.push({ id: 'H-' + Utilities.getUuid().slice(0, 8), fecha: ahora, de: '', a: lead.estado, nota: 'Lead creado', usuario: u.correo });
    }
    lead.comercial = normCorreo_(lead.comercial);
    const com = usuarios.filter(x => x.correo === lead.comercial)[0];
    if (!com) throw new Error('El comercial asignado no está registrado: ' + lead.comercial);
    lead.nombreComercial = com.nombre;
    // si cambió el estado y el navegador no dejó el registro en el historial, se agrega aquí
    if (previo && previo.estado !== lead.estado && !(lead.historial || []).some(x => x.a === lead.estado && String(x.fecha) >= String(previo.actualizado || ''))) {
      lead.historial.push({ id: 'H-' + Utilities.getUuid().slice(0, 8), fecha: ahora, de: previo.estado, a: lead.estado, nota: '', usuario: u.correo });
    }
    if (GANADOS_.indexOf(lead.estado) >= 0) lead.fechaVenta = lead.fechaVenta || hoyISO_(); else delete lead.fechaVenta;
    if (FINALES_.indexOf(lead.estado) >= 0) lead.fechaCierre = lead.fechaCierre || hoyISO_(); else delete lead.fechaCierre;
    lead.actualizado = ahora; lead.actualizadoPor = u.correo;
    lead.nCotizaciones = leerCotizaciones_().filter(c => c.leadId === lead.id).length;
    try { sincronizarEventoLead_(lead, previo); } catch (e) { console.warn('Calendario ' + lead.id, e); lead.errorCalendario = String(e.message || e); }
    escribirLead_(lead, previo ? previo._fila : null);
    registrarBitacora_(lead, previo);
    tocarVersion_();
    res = { ok: true, lead: limpio_(lead) };
  } finally { lock.releaseLock(); }
  return res;
}

function escribirLead_(l, fila) {
  const h = hoja_('Leads', ENC_LEADS);
  const ult = (l.seguimientos || []).slice(-1)[0];
  const datos = [l.id, l.fechaContacto || '', l.prospecto || '', "'" + String(l.telefono || ''), l.correo || '', l.documento ? "'" + l.documento : '', l.ciudad || '',
    l.marca || '', l.referencia || '', l.version || '', l.origen || '', ESTADO_TXT_[l.estado] || l.estado, l.fechaSeguimiento || '', l.horaSeguimiento || '',
    l.comercial, l.nombreComercial || '', Number(l.valorEstimado) || '', l.formaPago || '', l.motivoPerdida || '', l.observaciones || '', l.nCotizaciones || 0,
    ult ? String(ult.fecha).slice(0, 10) + ' · ' + (ult.medio || '') + ' · ' + (ult.resultado || '') : '', l.fechaVenta || '', l.creado ? new Date(l.creado) : '', new Date(), JSON.stringify(limpio_(l))];
  if (fila) h.getRange(fila, 1, 1, datos.length).setValues([datos]);
  else h.appendRow(datos);
}

// Bitácora plana (una fila por cambio de estado o gestión) para filtrar en Sheets
const ENC_BITACORA = ['Fecha', '# Lead', 'Prospecto', 'Comercial', 'Tipo', 'Medio', 'Resultado / estado', 'Detalle', 'Próximo seguimiento', 'Usuario', 'ID'];
function registrarBitacora_(l, previo) {
  const ya = {};
  if (previo) (previo.historial || []).concat(previo.seguimientos || []).forEach(x => ya[x.id] = true);
  const filas = [];
  (l.historial || []).filter(x => !ya[x.id]).forEach(x => filas.push([new Date(x.fecha), l.id, l.prospecto, l.nombreComercial, 'Estado', '',
    (x.de ? (ESTADO_TXT_[x.de] || x.de) + ' → ' : '') + (ESTADO_TXT_[x.a] || x.a), x.nota || '', '', x.usuario || '', x.id]));
  (l.seguimientos || []).filter(x => !ya[x.id]).forEach(x => filas.push([new Date(x.fecha), l.id, l.prospecto, l.nombreComercial, 'Gestión', x.medio || '',
    x.resultado || '', x.nota || '', x.proximaFecha ? x.proximaFecha + (x.proximaHora ? ' ' + x.proximaHora : '') : '', x.usuario || '', x.id]));
  if (!filas.length) return;
  const h = hoja_('Bitacora', ENC_BITACORA);
  h.getRange(h.getLastRow() + 1, 1, filas.length, ENC_BITACORA.length).setValues(filas);
}

// ===================== CALENDARIO =====================
function calendario_() {
  if (!CONFIG.CALENDARIO_NOMBRE) return CalendarApp.getDefaultCalendar();
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('CALENDARIO_ID');
  if (id) { const c = CalendarApp.getCalendarById(id); if (c) return c; }
  const c = CalendarApp.getCalendarsByName(CONFIG.CALENDARIO_NOMBRE)[0] || CalendarApp.createCalendar(CONFIG.CALENDARIO_NOMBRE, { timeZone: CONFIG.ZONA, color: CalendarApp.Color.BLUE });
  props.setProperty('CALENDARIO_ID', c.getId());
  return c;
}
function borrarEvento_(cal, id) {
  if (!id) return;
  try { const ev = cal.getEventById(id); if (ev) ev.deleteEvent(); } catch (e) { console.warn('No se pudo borrar evento ' + id, e); }
}
function fechaHora_(iso, hora) {
  const p = String(iso).split('-').map(Number);
  const h = String(hora || '').match(/^(\d{1,2}):(\d{2})/);
  return h ? new Date(p[0], p[1] - 1, p[2], Number(h[1]), Number(h[2])) : new Date(p[0], p[1] - 1, p[2]);
}
function diaSiguiente_(iso) { const d = fechaHora_(iso); d.setDate(d.getDate() + 1); return Utilities.formatDate(d, CONFIG.ZONA, 'yyyy-MM-dd'); }
/**
 * Un evento por lead (el próximo seguimiento), en el calendario de la cuenta dueña
 * con el comercial como invitado: le llega la invitación y queda en SU calendario
 * (Gmail, Outlook, etc.). Si se reprograma o se reasigna, el comercial recibe la
 * actualización. Al cerrar el lead (entregado / perdido) el evento se cancela.
 * Usa el servicio avanzado "Google Calendar API" (activado en appsscript.json).
 */
function sincronizarEventoLead_(l, previo) {
  const calId = calendario_().getId();
  const envio = CONFIG.ENVIAR_INVITACIONES ? 'all' : 'none';
  if (!esActivo_(l) || !l.fechaSeguimiento) {
    if (l.eventId) { try { Calendar.Events.remove(calId, l.eventId, { sendUpdates: envio }); } catch (e) { console.warn('Evento ya borrado ' + l.eventId); } }
    delete l.eventId; delete l.eventoInvitado; return;
  }
  const ult = (l.seguimientos || []).slice(-1)[0];
  const desc = 'Prospecto: ' + l.prospecto + '\nTeléfono: ' + l.telefono + '\nWhatsApp: https://wa.me/' + telWa_(l.telefono) +
    (l.correo ? '\nCorreo: ' + l.correo : '') + '\nVehículo: ' + [l.marca, l.referencia, l.version].filter(String).join(' ') +
    '\nEstado: ' + (ESTADO_TXT_[l.estado] || l.estado) + '\nOrigen: ' + (l.origen || '') + '\nComercial: ' + (l.nombreComercial || l.comercial) +
    (ult ? '\n\nÚltima gestión (' + String(ult.fecha).slice(0, 10) + ', ' + (ult.medio || '') + '): ' + (ult.resultado || '') + (ult.nota ? ' — ' + ult.nota : '') : '') +
    (l.observaciones ? '\n\nObservaciones: ' + l.observaciones : '') + (CONFIG.URL_APP ? '\n\nAbrir en la app: ' + CONFIG.URL_APP + '#lead=' + l.id : '');
  const conHora = /^\d{1,2}:\d{2}/.test(l.horaSeguimiento || '');
  const inicio = fechaHora_(l.fechaSeguimiento, l.horaSeguimiento);
  const f = d => Utilities.formatDate(d, CONFIG.ZONA, "yyyy-MM-dd'T'HH:mm:ss");
  const dueno = normCorreo_(Session.getEffectiveUser().getEmail());
  const recurso = {
    summary: '🚗 Seguimiento ' + l.id + ' · ' + l.prospecto + (l.marca ? ' · ' + l.marca + ' ' + (l.referencia || '') : ''),
    description: desc,
    start: conHora ? { dateTime: f(inicio), timeZone: CONFIG.ZONA } : { date: l.fechaSeguimiento },
    end: conHora ? { dateTime: f(new Date(inicio.getTime() + CONFIG.DURACION_EVENTO_MIN * 60000)), timeZone: CONFIG.ZONA } : { date: diaSiguiente_(l.fechaSeguimiento) },
    attendees: l.comercial === dueno ? [] : [{ email: l.comercial, displayName: l.nombreComercial || '' }],
    guestsCanSeeOtherGuests: false, guestsCanInviteOthers: false,
    reminders: { useDefault: false, overrides: conHora ? [{ method: 'popup', minutes: 30 }, { method: 'popup', minutes: 24 * 60 }, { method: 'email', minutes: 60 }]
      : [{ method: 'popup', minutes: 15 * 60 }, { method: 'email', minutes: 15 * 60 }] }   // todo el día: el día anterior 9:00 a.m.
  };
  // solo se notifica al comercial si cambió la fecha, la hora o el comercial (no por cada gestión)
  const cambio = !previo || previo.fechaSeguimiento !== l.fechaSeguimiento || (previo.horaSeguimiento || '') !== (l.horaSeguimiento || '') || previo.comercial !== l.comercial || !esActivo_(previo);
  if (l.eventId) {
    try { l.eventId = Calendar.Events.update(recurso, calId, l.eventId, { sendUpdates: cambio ? envio : 'none' }).id; l.eventoInvitado = l.comercial; return; }
    catch (e) { console.warn('No se pudo actualizar el evento ' + l.eventId + ', se crea de nuevo', e); }
  }
  l.eventId = Calendar.Events.insert(recurso, calId, { sendUpdates: envio }).id;
  l.eventoInvitado = l.comercial;
}
function telWa_(t) { let d = String(t || '').replace(/\D/g, ''); if (d.length === 10 && d.charAt(0) === '3') d = '57' + d; return d; }

/** Ejecutar a mano si se borraron eventos o se cambió de calendario: vuelve a crear/actualizar todos. */
function resincronizarCalendarios() {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    let n = 0;
    leerLeads_().forEach(l => { try { sincronizarEventoLead_(l, null); escribirLead_(l, l._fila); n++; } catch (e) { console.warn(l.id, e); } });
    tocarVersion_();
    return n + ' leads sincronizados';
  } finally { lock.releaseLock(); }
}

// ===================== COTIZACIONES =====================
const ENC_COT = ['N° Cotización', 'Fecha', '# Lead', 'Prospecto', 'Comercial', 'Marca', 'Referencia', 'Versión / Modelo', 'Precio lista', 'Descuento', 'Total',
  'Forma de pago', 'Cuota inicial', 'Plazo (meses)', 'Cuota mensual', 'Estado', 'Válida hasta', 'Tipo', 'Archivo', 'FileId', 'Actualizado', 'JSON'];
function leerCotizaciones_() {
  const h = hoja_('Cotizaciones', ENC_COT);
  const n = h.getLastRow() - 1;
  if (n < 1) return [];
  return h.getRange(2, ENC_COT.length, n, 1).getValues().map((f, i) => { try { const o = JSON.parse(f[0]); o._fila = i + 2; return o; } catch (e) { return null; } }).filter(Boolean);
}
function carpetaCotizaciones_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('CARPETA_COT_ID');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  const it = DriveApp.getFoldersByName(CONFIG.CARPETA_COTIZACIONES);
  const f = it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.CARPETA_COTIZACIONES);
  props.setProperties({ CARPETA_COT_ID: f.getId(), CARPETA_COT_URL: f.getUrl() });
  return f;
}
function subcarpeta_(padre, nombre) { const it = padre.getFoldersByName(nombre); return it.hasNext() ? it.next() : padre.createFolder(nombre); }
function nombreArchivo_(s) { return String(s || '').replace(/[\\/:*?"<>|#]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120); }

function guardarCotizacion_(u, cot, pdfBase64, archivo) {
  if (!cot || !cot.leadId) throw new Error('Cotización inválida');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  let lead, res;
  try {
    lead = leerLeads_().filter(x => x.id === cot.leadId)[0];
    if (!lead) throw new Error('No existe el lead ' + cot.leadId);
    if (!puedeVer_(u, lead)) throw new Error('Este lead pertenece a otro comercial');
    const todas = leerCotizaciones_();
    const previa = cot.id ? todas.filter(x => x.id === cot.id)[0] || null : null;
    const ahora = new Date().toISOString();
    if (!previa) {
      const anio = hoyISO_().slice(0, 4);
      cot.id = 'COT-' + anio + '-' + pad_(siguiente_('COT_' + anio), 4);
      cot.creado = ahora; cot.usuario = u.correo;
      cot.estado = cot.estado || 'emitida';
    } else { cot.creado = previa.creado; cot.usuario = previa.usuario; cot.archivo = cot.archivo || previa.archivo; }
    cot.comercial = lead.comercial; cot.nombreComercial = lead.nombreComercial;
    cot.fecha = cot.fecha || hoyISO_();
    cot.actualizado = ahora;
    // archivo en Drive: PDF generado por la app o archivo cargado (PDF / imagen)
    const blob = pdfBase64 ? Utilities.newBlob(Utilities.base64Decode(pdfBase64), 'application/pdf', nombreArchivo_(cot.id + ' - ' + lead.prospecto + ' - ' + [cot.vehiculo && cot.vehiculo.marca, cot.vehiculo && cot.vehiculo.referencia].filter(String).join(' ')) + '.pdf')
      : archivo && archivo.base64 ? Utilities.newBlob(Utilities.base64Decode(archivo.base64), archivo.mime || 'application/octet-stream', nombreArchivo_(cot.id + ' - ' + (archivo.nombre || 'cotizacion'))) : null;
    if (blob) {
      const carpeta = subcarpeta_(carpetaCotizaciones_(), nombreArchivo_(lead.id + ' - ' + lead.prospecto));
      const f = carpeta.createFile(blob);
      if (previa && previa.archivo && previa.archivo.fileId) { try { DriveApp.getFileById(previa.archivo.fileId).setTrashed(true); } catch (e) {} }
      cot.archivo = { fileId: f.getId(), url: f.getUrl(), nombre: archivo && archivo.nombre || f.getName(), mime: blob.getContentType() };
    }
    escribirCotizacion_(cot, previa ? previa._fila : null);
    // el lead pasa a "Cotizado" si estaba en una etapa anterior y queda la gestión registrada
    const previoLead = JSON.parse(JSON.stringify(lead));
    if (!previa) {
      if (ORDEN_ESTADO_[lead.estado] < ORDEN_ESTADO_.cotizado) {
        lead.historial = (lead.historial || []).concat([{ id: 'H-' + Utilities.getUuid().slice(0, 8), fecha: ahora, de: lead.estado, a: 'cotizado', nota: 'Cotización ' + cot.id, usuario: u.correo }]);
        lead.estado = 'cotizado';
      }
      lead.seguimientos = (lead.seguimientos || []).concat([{ id: 'S-' + Utilities.getUuid().slice(0, 8), fecha: ahora, medio: 'Cotización', resultado: cot.tipo === 'cargada' ? 'Cotización cargada' : 'Cotización emitida',
        nota: cot.id + ' · ' + [cot.vehiculo && cot.vehiculo.marca, cot.vehiculo && cot.vehiculo.referencia].filter(String).join(' ') + ' · ' + cop_(cot.total), usuario: u.correo }]);
    }
    lead.nCotizaciones = leerCotizaciones_().filter(c => c.leadId === lead.id).length;
    lead.actualizado = ahora;
    escribirLead_(lead, lead._fila);
    registrarBitacora_(lead, previoLead);
    tocarVersion_();
    res = { ok: true, cotizacion: limpio_(cot), lead: limpio_(lead) };
  } finally { lock.releaseLock(); }
  return res;
}
function escribirCotizacion_(c, fila) {
  const h = hoja_('Cotizaciones', ENC_COT);
  const v = c.vehiculo || {};
  const est = { emitida: 'Emitida', enviada: 'Enviada', aceptada: 'Aceptada', rechazada: 'Rechazada' };
  const datos = [c.id, c.fecha, c.leadId, (c.cliente || {}).nombre || '', c.nombreComercial || c.comercial, v.marca || '', v.referencia || '', [v.version, v.modelo].filter(String).join(' '),
    Number(c.precioLista) || '', Number(c.descuento) || '', Number(c.total) || 0, c.formaPago || '', Number(c.cuotaInicial) || '', Number(c.plazoMeses) || '', Number(c.cuotaMensual) || '',
    est[c.estado] || c.estado || '', c.validaHasta || '', c.tipo === 'cargada' ? 'Cargada' : 'Generada', c.archivo ? c.archivo.url : '', c.archivo ? c.archivo.fileId : '', new Date(), JSON.stringify(limpio_(c))];
  if (fila) h.getRange(fila, 1, 1, datos.length).setValues([datos]);
  else h.appendRow(datos);
  h.getRange(fila || h.getLastRow(), 9, 1, 7).setNumberFormat('$#,##0');
}
function cotAccesible_(u, id) {
  const c = leerCotizaciones_().filter(x => x.id === id)[0];
  if (!c) throw new Error('No existe la cotización ' + id);
  if (u.rol !== 'admin' && normCorreo_(c.comercial) !== u.correo) throw new Error('Esta cotización pertenece a otro comercial');
  return c;
}
function obtenerArchivo_(u, id) {
  const c = cotAccesible_(u, id);
  if (!c.archivo || !c.archivo.fileId) throw new Error('La cotización no tiene archivo guardado');
  const b = DriveApp.getFileById(c.archivo.fileId).getBlob();
  return { ok: true, nombre: c.archivo.nombre || b.getName(), mime: b.getContentType(), base64: Utilities.base64Encode(b.getBytes()) };
}
/** Envía la cotización al cliente desde la cuenta dueña, con copia y respuesta al comercial. */
function enviarCotizacion_(u, p) {
  const c = cotAccesible_(u, p.cotizacionId);
  const para = String(p.para || '').trim();
  if (!correoOk_(para)) throw new Error('Correo del cliente inválido');
  if (!c.archivo || !c.archivo.fileId) throw new Error('La cotización no tiene PDF guardado. Ábrela y guárdala de nuevo.');
  const com = usuarioPorCorreo_(c.comercial) || u;
  const blob = DriveApp.getFileById(c.archivo.fileId).getBlob();
  const cuerpo = String(p.mensaje || '');
  MailApp.sendEmail(para, String(p.asunto || 'Cotización ' + c.id), cuerpo, {
    name: com.nombre + ' - ' + CONFIG.EMPRESA.nombre, replyTo: com.correo, cc: com.correo, attachments: [blob],
    htmlBody: '<div style="' + S_.wrap + ';max-width:640px;font-size:13px;white-space:pre-wrap">' + esc_(cuerpo) + '</div>'
  });
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  let lead;
  try {
    const ahora = new Date().toISOString();
    if (c.estado === 'emitida') { c.estado = 'enviada'; c.actualizado = ahora; escribirCotizacion_(c, c._fila); }
    lead = leerLeads_().filter(x => x.id === c.leadId)[0];
    if (lead) {
      const s = { id: 'S-' + Utilities.getUuid().slice(0, 8), fecha: ahora, medio: 'Correo', resultado: 'Cotización enviada', nota: c.id + ' enviada a ' + para, usuario: u.correo };
      const previo = JSON.parse(JSON.stringify(lead));
      lead.seguimientos = (lead.seguimientos || []).concat([s]); lead.actualizado = ahora;
      escribirLead_(lead, lead._fila); registrarBitacora_(lead, previo);
    }
    tocarVersion_();
  } finally { lock.releaseLock(); }
  return { ok: true, cotizacion: limpio_(c), lead: lead ? limpio_(lead) : null };
}

// ===================== LECTURA PARA LA APP =====================
function obtenerDatos_(u, version) {
  const v = versionActual_();
  if (version && version === v) return { sinCambios: true, version: v };
  const leads = leerLeads_().filter(l => puedeVer_(u, l)).map(limpio_);
  const ids = {}; leads.forEach(l => ids[l.id] = true);
  const cots = leerCotizaciones_().filter(c => ids[c.leadId]).map(limpio_);
  return { version: v, usuario: publico_(u), usuarios: leerUsuarios_().map(publico_), leads: leads, cotizaciones: cots,
    empresa: CONFIG.EMPRESA, validezCotizacion: CONFIG.VALIDEZ_COTIZACION_DIAS, calendario: CONFIG.CALENDARIO_NOMBRE || 'principal',
    hoja: u.rol === 'admin' ? libro_().getUrl() : '', carpeta: u.rol === 'admin' ? (PropertiesService.getScriptProperties().getProperty('CARPETA_COT_URL') || '') : '' };
}

// ===================== INFORMES POR CORREO =====================
const S_ = {
  wrap: 'font-family:Segoe UI,Arial,sans-serif;color:#1f2937;max-width:1000px;margin:0 auto',
  h1: 'font-size:20px;color:#2c4887;margin:0 0 2px',
  sub: 'color:#6b7280;font-size:12px;margin:0 0 18px',
  h2: 'font-size:14px;color:#2c4887;margin:20px 0 8px;border-bottom:2px solid #e5e7eb;padding-bottom:5px',
  tbl: 'width:100%;border-collapse:collapse;font-size:11px',
  th: 'background:#2c4887;color:#fff;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase',
  td: 'padding:4px 6px;border-bottom:1px solid #eee',
  kpi: 'padding:12px;border-radius:8px;text-align:center;border:1.5px solid #e5e7eb'
};
// Logo en los correos (se toma de la app publicada: CONFIG.URL_APP + /img/logo-azul.png)
function logoCorreo_() { return CONFIG.URL_APP ? '<img src="' + CONFIG.URL_APP.replace(/\/+$/, '') + '/img/logo-azul.png" alt="' + esc_(CONFIG.EMPRESA.nombre) + '" style="height:46px;margin:0 0 12px"><br>' : ''; }
function kpis_(lista) {
  return '<table style="width:100%;border-collapse:separate;border-spacing:8px 0;margin:0 -8px 8px"><tr>' + lista.map(k =>
    '<td style="' + S_.kpi + ';background:' + k[2] + '"><div style="font-size:20px;font-weight:800;color:' + k[3] + '">' + k[0] + '</div><div style="font-size:11px;color:#6b7280">' + k[1] + '</div></td>').join('') + '</tr></table>';
}
function tabla_(enc, filas, derecha) {
  derecha = derecha || [];
  return '<table style="' + S_.tbl + '"><thead><tr>' + enc.map((h, i) => '<th style="' + S_.th + (derecha.indexOf(i) >= 0 ? ';text-align:right' : '') + '">' + h + '</th>').join('') + '</tr></thead><tbody>' +
    filas.map((f, j) => '<tr' + (j % 2 ? ' bgcolor="#f9fafb"' : '') + '>' + f.map((c, i) => '<td style="' + S_.td + (derecha.indexOf(i) >= 0 ? ';text-align:right;white-space:nowrap' : '') + '">' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
}
const enlaceApp_ = id => CONFIG.URL_APP ? ' <a href="' + CONFIG.URL_APP + '#lead=' + id + '">abrir</a>' : '';
function filaAgenda_(l, hoy) {
  const ult = (l.seguimientos || []).slice(-1)[0];
  return [l.fechaSeguimiento < hoy ? '<span style="color:#b91c1c;font-weight:700">' + fmt_(l.fechaSeguimiento) + '</span>' : '<b>HOY</b>' + (l.horaSeguimiento ? ' ' + l.horaSeguimiento : ''),
    '<b>' + esc_(l.id) + '</b>' + enlaceApp_(l.id), esc_(l.prospecto), '<a href="https://wa.me/' + telWa_(l.telefono) + '">' + esc_(l.telefono) + '</a>',
    esc_([l.marca, l.referencia].filter(String).join(' ')), esc_(ESTADO_TXT_[l.estado] || l.estado), ult ? esc_(String(ult.resultado || '') + (ult.nota ? ' — ' + String(ult.nota).slice(0, 70) : '')) : 'Sin gestión'];
}
function htmlAgenda_(u, leads) {
  const hoy = hoyISO_();
  const pend = leads.filter(l => esActivo_(l) && l.fechaSeguimiento && l.fechaSeguimiento <= hoy).sort((a, b) => (a.fechaSeguimiento + (a.horaSeguimiento || '')).localeCompare(b.fechaSeguimiento + (b.horaSeguimiento || '')));
  const sinFecha = leads.filter(l => esActivo_(l) && !l.fechaSeguimiento);
  return '<div style="' + S_.wrap + '">' + logoCorreo_() + '<h1 style="' + S_.h1 + '">Tu agenda comercial de hoy</h1>' +
    '<p style="' + S_.sub + '">' + esc_(u.nombre) + ' — ' + fechaLarga_() + '</p>' +
    kpis_([[pend.filter(l => l.fechaSeguimiento < hoy).length, 'Seguimientos vencidos', '#fef2f2', '#b91c1c'], [pend.filter(l => l.fechaSeguimiento === hoy).length, 'Para hoy', '#eff6ff', '#1d4ed8'],
      [leads.filter(esActivo_).length, 'Leads activos', '#f0fdf4', '#15803d'], [sinFecha.length, 'Activos sin fecha de seguimiento', '#fffbeb', '#92400e']]) +
    '<h2 style="' + S_.h2 + '">Seguimientos vencidos y de hoy (' + pend.length + ')</h2>' +
    (pend.length ? tabla_(['Fecha', '# Lead', 'Prospecto', 'Teléfono', 'Vehículo', 'Estado', 'Última gestión'], pend.map(l => filaAgenda_(l, hoy))) : '<p style="' + S_.sub + '">Nada pendiente 🎉</p>') +
    (sinFecha.length ? '<h2 style="' + S_.h2 + '">Leads activos sin fecha de seguimiento (' + sinFecha.length + ')</h2>' +
      tabla_(['# Lead', 'Prospecto', 'Teléfono', 'Vehículo', 'Estado'], sinFecha.map(l => ['<b>' + esc_(l.id) + '</b>' + enlaceApp_(l.id), esc_(l.prospecto), esc_(l.telefono), esc_([l.marca, l.referencia].filter(String).join(' ')), esc_(ESTADO_TXT_[l.estado])])) : '') +
    '<p style="font-size:10px;color:#9ca3af;text-align:center;margin-top:24px">Enviado automáticamente — ' + esc_(CONFIG.EMPRESA.nombre) + ' · Seguimiento comercial</p></div>';
}
function htmlResumen_(leads, cots, usuarios) {
  const hoy = hoyISO_(), mes = hoy.slice(0, 7), ayer = Utilities.formatDate(new Date(Date.now() - 86400000), CONFIG.ZONA, 'yyyy-MM-dd');
  const activos = leads.filter(esActivo_);
  const vencidos = activos.filter(l => l.fechaSeguimiento && l.fechaSeguimiento < hoy);
  const ventasMes = leads.filter(l => GANADOS_.indexOf(l.estado) >= 0 && String(l.fechaVenta || '').slice(0, 7) === mes);
  const cotMes = cots.filter(c => String(c.fecha).slice(0, 7) === mes);
  const nuevosMes = leads.filter(l => String(l.fechaContacto || l.creado).slice(0, 7) === mes);
  const limite = Date.now() - CONFIG.DIAS_SIN_GESTION_ALERTA * 86400000;
  const ultimaAct = l => Math.max.apply(null, [new Date(l.creado || 0).getTime()].concat((l.seguimientos || []).map(s => new Date(s.fecha).getTime())));
  const sinGestion = activos.filter(l => ultimaAct(l) < limite);
  const porCom = usuarios.filter(x => x.activo).map(x => {
    const mios = leads.filter(l => l.comercial === x.correo);
    const gAyer = mios.reduce((s, l) => s + (l.seguimientos || []).filter(g => String(g.fecha).slice(0, 10) === ayer || String(g.fecha).slice(0, 10) === hoy).length, 0);
    return [esc_(x.nombre), mios.filter(l => String(l.fechaContacto || l.creado).slice(0, 7) === mes).length, mios.filter(esActivo_).length,
      mios.filter(l => esActivo_(l) && l.fechaSeguimiento && l.fechaSeguimiento < hoy).length, gAyer,
      cots.filter(c => c.comercial === x.correo && String(c.fecha).slice(0, 7) === mes).length,
      mios.filter(l => GANADOS_.indexOf(l.estado) >= 0 && String(l.fechaVenta || '').slice(0, 7) === mes).length];
  }).filter(f => f.slice(1).some(n => n > 0));
  const embudo = ESTADOS_.map(e => [esc_(e[1]), leads.filter(l => l.estado === e[0]).length]).filter(f => f[1] > 0);
  return '<div style="' + S_.wrap + '">' + logoCorreo_() + '<h1 style="' + S_.h1 + '">Resumen comercial diario</h1>' +
    '<p style="' + S_.sub + '">' + esc_(CONFIG.EMPRESA.nombre) + ' — ' + fechaLarga_() + '</p>' +
    kpis_([[nuevosMes.length, 'Leads nuevos del mes', '#eff6ff', '#1d4ed8'], [activos.length, 'Leads activos', '#f0fdf4', '#15803d'],
      [vencidos.length, 'Seguimientos vencidos', '#fef2f2', '#b91c1c'], [cotMes.length + ' · ' + cop_(cotMes.reduce((s, c) => s + (Number(c.total) || 0), 0)), 'Cotizaciones del mes', '#fffbeb', '#92400e'],
      [ventasMes.length, 'Ventas del mes', '#ecfdf5', '#047857']]) +
    '<h2 style="' + S_.h2 + '">Por comercial</h2>' +
    (porCom.length ? tabla_(['Comercial', 'Nuevos mes', 'Activos', 'Vencidos', 'Gestiones ayer/hoy', 'Cotizaciones mes', 'Ventas mes'], porCom, [1, 2, 3, 4, 5, 6]) : '<p style="' + S_.sub + '">Sin actividad</p>') +
    '<h2 style="' + S_.h2 + '">Embudo actual</h2>' + tabla_(['Estado', 'Leads'], embudo, [1]) +
    '<h2 style="' + S_.h2 + '">Seguimientos vencidos (' + vencidos.length + ')</h2>' +
    (vencidos.length ? tabla_(['Fecha', '# Lead', 'Prospecto', 'Teléfono', 'Vehículo', 'Estado', 'Última gestión'], vencidos.slice(0, 80).map(l => filaAgenda_(l, hoy))) : '<p style="' + S_.sub + '">Ninguno</p>') +
    '<h2 style="' + S_.h2 + '">Leads activos sin gestión en ' + CONFIG.DIAS_SIN_GESTION_ALERTA + ' días (' + sinGestion.length + ')</h2>' +
    (sinGestion.length ? tabla_(['# Lead', 'Prospecto', 'Comercial', 'Vehículo', 'Estado'], sinGestion.slice(0, 80).map(l => ['<b>' + esc_(l.id) + '</b>', esc_(l.prospecto), esc_(l.nombreComercial || l.comercial), esc_([l.marca, l.referencia].filter(String).join(' ')), esc_(ESTADO_TXT_[l.estado])])) : '<p style="' + S_.sub + '">Ninguno</p>') +
    '<p style="font-size:10px;color:#9ca3af;text-align:center;margin-top:24px">Enviado automáticamente — Seguimiento comercial · Confidencial</p></div>';
}
function pdf_(html, nombre) {
  return Utilities.newBlob('<html><head><meta charset="UTF-8"></head><body style="margin:24px">' + html + '</body></html>', 'text/html', nombre + '.html').getAs('application/pdf').setName(nombre + '.pdf');
}
function enviarAgenda_(u, leads) {
  const mios = leads.filter(l => l.comercial === u.correo);
  const hoy = hoyISO_();
  const n = mios.filter(l => esActivo_(l) && l.fechaSeguimiento && l.fechaSeguimiento <= hoy).length;
  MailApp.sendEmail(u.correo, '[AGENDA VENTAS] ' + n + ' seguimiento(s) pendientes · ' + fmt_(hoy), 'Tu agenda comercial de hoy.', { htmlBody: htmlAgenda_(u, mios), name: CONFIG.NOMBRE_REMITENTE });
  return n;
}
function enviarResumen_(para, leads, cots, usuarios) {
  const html = htmlResumen_(leads, cots, usuarios);
  MailApp.sendEmail(para, '[RESUMEN COMERCIAL] ' + fmt_(hoyISO_()), 'Resumen comercial diario.', { htmlBody: html, name: CONFIG.NOMBRE_REMITENTE, attachments: [pdf_(html, 'Resumen_comercial_' + hoyISO_())] });
}
function enviarInformeAhora_(u) {
  const leads = leerLeads_().map(limpio_);
  if (u.rol === 'admin') { enviarResumen_(u.correo, leads, leerCotizaciones_().map(limpio_), leerUsuarios_()); return { ok: true, tipo: 'resumen', para: u.correo }; }
  return { ok: true, tipo: 'agenda', para: u.correo, pendientes: enviarAgenda_(u, leads) };
}
/** Lo ejecuta el disparador diario (HORA_AGENDA). */
function informeDiarioAutomatico() {
  if (Number(Utilities.formatDate(new Date(), CONFIG.ZONA, 'u')) === 7) return;   // domingo no
  const leads = leerLeads_().map(limpio_), usuarios = leerUsuarios_().filter(x => x.activo), hoy = hoyISO_();
  if (CONFIG.ENVIAR_AGENDA_COMERCIALES) usuarios.forEach(u => {
    try { if (leads.some(l => l.comercial === u.correo && esActivo_(l) && (!l.fechaSeguimiento || l.fechaSeguimiento <= hoy))) enviarAgenda_(u, leads); }
    catch (e) { console.warn('Agenda ' + u.correo, e); }
  });
  if (CONFIG.ENVIAR_RESUMEN_GERENCIA && leads.length) {
    const cots = leerCotizaciones_().map(limpio_);
    usuarios.filter(u => u.rol === 'admin').forEach(u => { try { enviarResumen_(u.correo, leads, cots, usuarios); } catch (e) { console.warn('Resumen ' + u.correo, e); } });
  }
}

// ===================== DISPARADORES Y CONFIGURACIÓN =====================
function asegurarDisparador_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const clave = 'DISPARADOR_V1_' + CONFIG.HORA_AGENDA;
    if (props.getProperty(clave) && ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'informeDiarioAutomatico')) return true;
    instalarDisparadores();
    props.setProperty(clave, new Date().toISOString());
    return true;
  } catch (e) { console.warn('No se pudo instalar el disparador', e); return false; }
}
function instalarDisparadores() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'informeDiarioAutomatico').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('informeDiarioAutomatico').timeBased().everyDays(1).atHour(CONFIG.HORA_AGENDA).inTimezone(CONFIG.ZONA).create();
  return 'Correo diario programado a las ' + CONFIG.HORA_AGENDA + ':00 (' + CONFIG.ZONA + ')';
}
/**
 * EJECUTAR UNA VEZ desde el editor con la cuenta dueña: pide todos los permisos,
 * crea la hoja, el calendario y la carpeta, registra al dueño como administrador
 * y programa el correo diario. El resultado queda en el "Registro de ejecución".
 */
function configurarTodo() {
  const info = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
  if (info.getAuthorizationStatus() === ScriptApp.AuthorizationStatus.REQUIRED) { console.warn('Faltan permisos: ' + info.getAuthorizationUrl()); ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL); }
  const ss = libro_();
  hoja_('Leads', ENC_LEADS); hoja_('Cotizaciones', ENC_COT); hoja_('Bitacora', ENC_BITACORA);
  const us = leerUsuarios_();
  console.log('Hoja: ' + ss.getUrl());
  console.log('Usuarios: ' + us.map(u => u.correo + ' (' + u.rol + ')').join(', '));
  console.log('Calendario: ' + calendario_().getName());
  console.log('Carpeta de cotizaciones: ' + carpetaCotizaciones_().getUrl());
  console.log(instalarDisparadores());
  tocarVersion_();
}
/** Prueba manual: envía la agenda y el resumen a la cuenta dueña. */
function probarCorreos() {
  const yo = usuarioPorCorreo_(Session.getEffectiveUser().getEmail());
  console.log(JSON.stringify(enviarInformeAhora_(yo)));
}

// ===================== UTILIDADES =====================
function hoyISO_() { return Utilities.formatDate(new Date(), CONFIG.ZONA, 'yyyy-MM-dd'); }
function fmt_(iso) { if (!iso) return '—'; const p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso); }
function fechaLarga_() { const m = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']; const p = hoyISO_().split('-'); return Number(p[2]) + ' de ' + m[Number(p[1]) - 1] + ' de ' + p[0]; }
function cop_(n) { n = Math.round(Number(n) || 0); return '$ ' + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.').replace(/^/, n < 0 ? '-' : ''); }
function esc_(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
