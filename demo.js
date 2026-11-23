// =====================================================================
// MODO DEMO — imita al backend (apps-script/Ventas.gs) guardando todo en
// este navegador, con datos de ejemplo. Se usa mientras VENTAS_WEBAPP_URL
// esté vacía. Para empezar de cero: DemoBackend.reiniciar().
// =====================================================================
const DemoBackend = (() => {
  const CLAVE = 'vt_demo_v6';
  let db = null;
  const ahora = () => new Date().toISOString();
  const rid = p => p + '-' + Math.random().toString(36).slice(2, 10);
  const d = n => sumarDias(hoyISO(), n);
  const ts = (n, h) => { const x = parseD(d(n)); x.setHours(h || 10, Math.floor(Math.random() * 59)); return x.toISOString(); };
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(db)); } catch (e) { console.warn('Demo: localStorage lleno', e); } };
  const tocar = () => { db.version = String(Date.now()); };

  function semilla() {
    const U = [
      { correo: 'admin@demo.com', nombre: 'Administrador del sistema', rol: 'admin', activo: true, telefono: '', cargo: 'Administrador', supervisor: '' },
      { correo: 'gerente@demo.com', nombre: 'Laura Gómez', rol: 'gerencia', activo: true, telefono: '310 555 0101', cargo: 'Gerente comercial', supervisor: '' },
      { correo: 'supervisor@demo.com', nombre: 'Marta Supervisora', rol: 'supervisor', activo: true, telefono: '313 555 0404', cargo: 'Supervisora comercial', supervisor: '' },
      { correo: 'carlos.ruiz@gmail.com', nombre: 'Carlos Ruiz', rol: 'comercial', activo: true, telefono: '311 555 0202', cargo: 'Asesor comercial', supervisor: 'supervisor@demo.com' },
      { correo: 'andrea.mejia@gmail.com', nombre: 'Andrea Mejía', rol: 'comercial', activo: true, telefono: '312 555 0303', cargo: 'Asesora comercial', supervisor: '' }
    ];
    const ej = [
      ['Juan Pablo Torres', '3104567890', 'Mazda', 'CX-30', 'Grand Touring 2026', 'Formulario', 'cotizado', 1, '10:00', 'carlos.ruiz@gmail.com', -12, 138900000, 'Crédito'],
      ['María Fernanda López', '3157778899', 'Kia', 'Sportage', 'Vibrant 2026', 'Campaña', 'cita', 0, '15:30', 'andrea.mejia@gmail.com', -6, 152000000, 'Retoma + crédito'],
      ['Andrés Felipe Rojas', '3001234567', 'Toyota', 'Corolla Cross', 'XEI Híbrida 2026', 'Instagram', 'contactado', -2, '', 'carlos.ruiz@gmail.com', -9, 149900000, 'Crédito'],
      ['Luisa Martínez', '3209876543', 'Renault', 'Duster', 'Intens 2026', 'WhatsApp', 'nuevo', 0, '11:00', 'andrea.mejia@gmail.com', -1, 99990000, 'Por definir'],
      ['Camilo Herrera', '3015556677', 'Chevrolet', 'Tracker', 'Premier 2026', 'Referido', 'negociacion', 2, '09:30', 'carlos.ruiz@gmail.com', -20, 118000000, 'Contado'],
      ['Diana Patricia Castro', '3118889900', 'BYD', 'Dolphin Mini', '2026', 'KOMMO', 'credito', 3, '', 'andrea.mejia@gmail.com', -18, 79990000, 'Crédito'],
      ['Sebastián Moreno', '3162223344', 'Mazda', '2 Sedán', 'Touring 2026', 'Llamada entrante', 'aprobado', 1, '16:00', 'carlos.ruiz@gmail.com', -25, 94900000, 'Crédito'],
      ['Natalia Vargas', '3184445566', 'Volkswagen', 'T-Cross', 'Highline 2026', 'Vitrina / showroom', 'facturado', 4, '', 'andrea.mejia@gmail.com', -30, 129990000, 'Contado'],
      ['Jorge Iván Ramírez', '3006667788', 'Nissan', 'Kicks', 'Exclusive 2026', 'TuCarro / Marketplace', 'entregado', null, '', 'carlos.ruiz@gmail.com', -45, 112000000, 'Crédito'],
      ['Paola Andrea Gil', '3129990011', 'Hyundai', 'Tucson', 'Limited 2026', 'Campaña', 'perdido', null, '', 'andrea.mejia@gmail.com', -28, 165000000, 'Crédito'],
      ['Ricardo Salazar', '3193334455', 'Suzuki', 'Swift', 'Hybrid 2026', 'Feria / evento', 'cita', -1, '10:30', 'supervisor@demo.com', -4, 78900000, 'Retoma + contado'],
      ['Valentina Ospina', '3141112233', 'Kia', 'Picanto', 'Zenith 2026', 'TikTok', 'contactado', 5, '', 'andrea.mejia@gmail.com', -3, 66990000, 'Crédito'],
      ['Hernán Darío Pérez', '3027778811', 'Toyota', 'Hilux', 'SRV 4x4 2026', 'Cliente antiguo', 'entregado', null, '', 'andrea.mejia@gmail.com', -60, 219900000, 'Leasing'],
      ['Carolina Ríos', '3175553311', 'Chevrolet', 'Onix', 'Turbo RS 2026', 'WhatsApp', 'perdido', null, '', 'carlos.ruiz@gmail.com', -15, 82990000, 'Crédito']
    ];
    const ciudades = ['Bogotá D.C.', 'Bogotá D.C.', 'Chía', 'Bogotá D.C.', 'Soacha'];
    U.forEach((u, i) => Object.assign(u, { documento: String(1010200300 + i * 1111), ciudad: ciudades[i], direccion: '', contactoEmergencia: '', telEmergencia: '', foto: '', creado: ts(-40, 9), origen: 'manual' }));
    const leads = [], cots = []; let nCot = 0;
    const camino = ['nuevo', 'contactado', 'cita', 'cotizado', 'negociacion', 'credito', 'aprobado', 'facturado', 'entregado'];
    ej.forEach((x, i) => {
      const [prospecto, telefono, marca, referencia, version, origen, estado, seg, hora, comercial, contacto, valor, pago] = x;
      const id = String(23841 + i * 13);   // # que trae el lead desde la app de origen (KOMMO, campaña…)
      const l = { id, fechaContacto: d(contacto), prospecto, telefono, correo: prospecto.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '.' + (i + 1) + '@correo.com', documento: String(52000000 + i * 734521), ciudad: ['Bogotá D.C.', 'Medellín', 'Cali', 'Chía'][i % 4],
        marca, referencia, version, origen, estado, fechaSeguimiento: seg === null ? '' : d(seg), horaSeguimiento: hora, comercial, valorEstimado: valor, formaPago: pago, retoma: /Retoma/.test(pago) ? 'Chevrolet Spark GT 2017' : '',
        observaciones: i % 3 === 0 ? 'Le interesa color gris; decide con la esposa.' : '', historial: [], seguimientos: [], creado: ts(contacto, 9), creadoPor: comercial };
      l.historial.push({ id: rid('H'), fecha: ts(contacto, 9), de: '', a: 'nuevo', nota: 'Lead creado', usuario: comercial });
      const hasta = estado === 'perdido' ? 3 : camino.indexOf(estado);
      for (let k = 1; k <= hasta; k++) {
        const dia = Math.min(-1, contacto + Math.round((k / Math.max(hasta, 1)) * (-contacto - 1)));
        l.historial.push({ id: rid('H'), fecha: ts(dia, 11), de: camino[k - 1], a: camino[k], nota: '', usuario: comercial });
        l.seguimientos.push({ id: rid('S'), fecha: ts(dia, 10), medio: ['Llamada', 'WhatsApp', 'Visita en vitrina'][k % 3], resultado: ['Interesado', 'Agenda cita / visita', 'Agenda prueba de manejo', 'Solicita cotización', 'Pide descuento / mejor precio', 'Radicó crédito', 'Separó el vehículo', 'Separó el vehículo', 'Otro'][k - 1] || 'Interesado', nota: '', usuario: comercial });
      }
      if (estado === 'perdido') { l.motivoPerdida = i === 9 ? 'Crédito negado' : 'Compró otra marca'; l.historial.push({ id: rid('H'), fecha: ts(-2, 12), de: 'cita', a: 'perdido', nota: 'Motivo: ' + l.motivoPerdida, usuario: comercial }); l.fechaCierre = d(-2); }
      if (GANADOS.includes(estado)) l.fechaVenta = d(estado === 'entregado' ? Math.round(contacto / 3) : -2);
      if (estado === 'entregado') l.fechaCierre = d(-1);
      if (seg !== null && seg < 0) l.seguimientos.push({ id: rid('S'), fecha: ts(seg - 2, 15), medio: 'Llamada', resultado: 'No contestó', nota: '', proximaFecha: d(seg), usuario: comercial });
      if (camino.indexOf(estado) >= 4 || (estado === 'perdido' && i === 9)) {
        nCot++;
        const c = { id: `COT-${hoyISO().slice(0, 4)}-${String(nCot).padStart(4, '0')}`, leadId: id, tipo: 'generada', fecha: d(contacto + 3), validezDias: 8, estado: GANADOS.includes(estado) ? 'aceptada' : estado === 'perdido' ? 'rechazada' : 'enviada',
          cliente: { nombre: prospecto, documento: l.documento, telefono, correo: l.correo, ciudad: l.ciudad }, vehiculo: { marca, referencia, version: version.replace(/ ?\d{4}$/, ''), modelo: (version.match(/\d{4}/) || [''])[0], color: 'Gris' },
          precioLista: valor, descuento: Math.round(valor * 0.02 / 100000) * 100000, accesorios: [{ desc: 'Kit de carretera y tapetes', valor: 450000 }], tramites: 1850000, soat: 980000, otros: 0,
          formaPago: /Contado/.test(pago) ? 'Contado' : pago === 'Leasing' ? 'Leasing' : 'Crédito', entidad: /Contado/.test(pago) ? '' : 'Banco de Occidente', cuotaInicial: Math.round(valor * 0.3 / 1e6) * 1e6, retomaDesc: l.retoma, retomaValor: l.retoma ? 25000000 : 0,
          plazoMeses: 60, tasaMensual: 1.45, observaciones: 'Incluye bono de la marca por tiempo limitado.', condiciones: CONDICIONES_COT, comercial, creado: ts(contacto + 3, 12), usuario: comercial };
        calcularCot(c); cots.push(c);
      }
      leads.push(l);
    });
    // cierres de venta de ejemplo (uno por debajo de la cotización, otro con documentos pendientes)
    leads.filter(l => GANADOS.includes(l.estado)).forEach((l, i) => {
      const c = cots.filter(x => x.leadId === l.id)[0]; const cot = c ? c.total : l.valorEstimado;
      const venta = i === 0 ? cot - 2500000 : cot;
      l.venta = { fecha: l.fechaVenta, factura: 'FV-' + (1201 + i), cotizacionId: c ? c.id : '', valorCotizado: cot, valorVenta: venta, valorNeto: Math.round(cot * 0.86 / 100000) * 100000,
        membresia: 1800000, mesesAdmin: i === 0 ? 2 : 1, valorMesAdmin: 350000, observaciones: '', registradoPor: l.comercial, registrado: ts(-2, 16),
        documentos: l.estado === 'entregado' ? { factura: { nombre: 'factura.pdf', demo: true }, homologacion: { nombre: 'homologacion.pdf', demo: true }, aduana: { nombre: 'aduana.pdf', demo: true }, contrato: { nombre: 'contrato.pdf', demo: true } } : { factura: { nombre: 'factura.pdf', demo: true } } };
    });
    leads.forEach(l => { l.nCotizaciones = cots.filter(c => c.leadId === l.id).length; l.nombreComercial = U.find(u => u.correo === l.comercial).nombre; l.actualizado = ahora(); });
    return { usuarios: U, leads, cotizaciones: cots, seq: { LEAD: leads.length, COT: nCot }, archivos: {}, version: String(Date.now()) };
  }
  function cargar() {
    if (db) return db;
    try { db = JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) { db = null; }
    if (!db) { db = semilla(); guardar(); }
    if (!db.claves) { db.claves = { 'gerente@demo.com': 'Demo2026*' }; guardar(); }
    db.leads.forEach(l => { if (l.estado === 'prueba') l.estado = 'cita'; });
    return db;
  }
  const usuarioDe = token => { const c = String(token || '').replace(/^demo:/, ''); const u = db.usuarios.find(x => x.correo === c); return u && u.activo ? u : null; };
  const verTodoU = u => ['admin', 'gerencia'].includes(u.rol);
  const alcance = u => { if (verTodoU(u)) return null; const s = new Set([u.correo]); if (u.rol === 'supervisor') db.usuarios.forEach(x => x.supervisor === u.correo && s.add(x.correo)); return s; };
  const puedeVer = (u, l) => { const a = alcance(u); return !a || a.has(l.comercial); };
  const unir = (a, b) => { const m = new Map(); (a || []).concat(b || []).forEach(x => x && x.id && m.set(x.id, Object.assign({}, m.get(x.id) || {}, x))); return [...m.values()].sort((x, y) => String(x.fecha).localeCompare(String(y.fecha))); };
  const copia = o => JSON.parse(JSON.stringify(o));
  const claveOk = c => String(c || '').length >= 8 && /[A-Za-z]/.test(c) && /\d/.test(c);
  const conClave = u => Object.assign(copia(u), { tieneClave: !!(db.claves || {})[u.correo] });

  const acciones = {
    solicitarCodigo(p) {
      const c = String(p.correo || '').trim().toLowerCase(); const u = db.usuarios.find(x => x.correo === c);
      if (u && !u.activo) throw new Error('Tu usuario está inactivo. Comunícate con gerencia o el administrador.');
      if (!u) {
        if (!p.registro) throw new Error('Este correo no está registrado. Usa "Crear cuenta" para registrarte (en el demo también puedes usar gerente@demo.com, supervisor@demo.com o carlos.ruiz@gmail.com).');
        const err = validarPerfil(p.registro); if (err) throw new Error(err);
        db.pendientes = db.pendientes || {}; db.pendientes[c] = Object.assign({}, p.registro, { origen: 'Código al correo' });
      }
      return { ok: true, enviado: true, codigoDemo: '123456', nuevo: !u };
    },
    verificarCodigo(p) {
      if (p.codigo !== '123456') throw new Error('Código incorrecto (en el demo es 123456)');
      const c = String(p.correo).toLowerCase();
      if (!db.usuarios.find(x => x.correo === c)) {
        const r = (db.pendientes || {})[c]; if (!r) throw new Error('Este correo no está registrado');
        db.usuarios.push(Object.assign({ correo: c, rol: 'comercial', activo: true, cargo: 'Asesor comercial', supervisor: '', creado: ahora() }, r)); delete db.pendientes[c]; tocar();
      }
      const u = db.usuarios.find(x => x.correo === c); return { ok: true, token: 'demo:' + u.correo, usuario: copia(u) };
    },
    cerrarSesion() { return { ok: true }; },
    ingresarClave(p) {
      const c = String(p.correo || '').trim().toLowerCase(), u = db.usuarios.find(x => x.correo === c);
      if (!u || !(db.claves || {})[c] || db.claves[c] !== p.clave) throw new Error('Correo o contraseña incorrectos (en el demo: gerente@demo.com / Demo2026*)');
      if (!u.activo) throw new Error('Tu usuario está inactivo. Comunícate con gerencia o el administrador.');
      return { ok: true, token: 'demo:' + u.correo, usuario: conClave(u) };
    },
    cambiarClave(p, u) {
      db.claves = db.claves || {};
      if (db.claves[u.correo] && db.claves[u.correo] !== p.actual) throw new Error('La contraseña actual no es correcta');
      if (!claveOk(p.nueva)) throw new Error('La contraseña debe tener mínimo 8 caracteres, con letras y números');
      db.claves[u.correo] = p.nueva; tocar(); return { ok: true, usuario: conClave(u) };
    },
    // "Continuar con Google" simulado: el token del demo trae el perfil en base64 (el real lo valida Google en el backend)
    ingresarGoogle(p) {
      let g; try { g = JSON.parse(decodeURIComponent(escape(atob(String(p.credential).split('.')[1])))); } catch (e) { throw new Error('Respuesta de Google inválida'); }
      const c = String(g.email).toLowerCase(), u = db.usuarios.find(x => x.correo === c);
      if (u) { if (!u.activo) throw new Error('Tu usuario está inactivo. Comunícate con gerencia o el administrador.'); return { ok: true, token: 'demo:' + u.correo, usuario: copia(u) }; }
      db.gpend = db.gpend || {}; const rt = rid('G'); db.gpend[rt] = { correo: c, nombre: g.name || '', foto: g.picture || '' };
      return { ok: true, nuevo: true, registroToken: rt, correo: c, nombre: g.name || '', foto: g.picture || '' };
    },
    completarRegistro(p) {
      const g = (db.gpend || {})[p.registroToken]; if (!g) throw new Error('El registro venció. Vuelve a hacer clic en "Continuar con Google".');
      const err = validarPerfil(p.datos || {}); if (err) throw new Error(err);
      if (!db.usuarios.find(x => x.correo === g.correo)) db.usuarios.push(Object.assign({ correo: g.correo, rol: 'comercial', activo: true, cargo: 'Asesor comercial', supervisor: '', creado: ahora(), origen: 'Google' }, p.datos, { foto: p.datos.foto || g.foto }));
      delete db.gpend[p.registroToken]; tocar();
      const u = db.usuarios.find(x => x.correo === g.correo); return { ok: true, token: 'demo:' + u.correo, usuario: copia(u) };
    },
    guardarPerfil(p, u) {
      const err = validarPerfil(p.datos || {}); if (err) throw new Error(err);
      const d = p.datos; Object.assign(u, { nombre: d.nombre, telefono: d.telefono, documento: d.documento, ciudad: d.ciudad, direccion: d.direccion, contactoEmergencia: d.contactoEmergencia, telEmergencia: d.telEmergencia, foto: d.foto || '' });
      tocar(); return { ok: true, usuario: copia(u) };
    },
    obtenerDatos(p, u) {
      if (p.version && p.version === db.version) return { sinCambios: true, version: db.version };
      const leads = db.leads.filter(l => puedeVer(u, l)); const ids = new Set(leads.map(l => l.id));
      return { version: db.version, usuario: conClave(u), usuarios: db.usuarios.map(conClave), leads: copia(leads), cotizaciones: copia(db.cotizaciones.filter(c => ids.has(c.leadId))), empresa: EMPRESA, validezCotizacion: 8 };
    },
    guardarLead(p, u) {
      const lead = copia(p.lead);
      if (!String(lead.prospecto || '').trim()) throw new Error('El nombre del prospecto es obligatorio');
      if (lead.estado === 'perdido' && !lead.motivoPerdida) throw new Error('Indica el motivo por el que se perdió el lead');
      if (lead.estado === 'prueba') lead.estado = 'cita';
      const esNuevo = !!lead.nuevo || !lead.id; delete lead.nuevo;
      if (esNuevo && lead.id && db.leads.some(x => String(x.id).toLowerCase() === String(lead.id).toLowerCase())) throw new Error('Ya existe el lead #' + lead.id);
      const previo = esNuevo ? null : db.leads.find(x => x.id === lead.id);
      const just = String(lead.justificacionRetroceso || '').trim(); delete lead.justificacionRetroceso;
      if (previo && esRetroceso(previo.estado, lead.estado)) {
        if (u.rol === 'comercial') throw new Error('No puedes devolver el lead a "' + EST[lead.estado].t + '": solo el supervisor o gerencia pueden hacerlo, con una justificación');
        if (just.length < 10) throw new Error('Escribe la justificación para volver a un estado anterior (mínimo 10 caracteres)');
      }
      if (previo) {
        if (!puedeVer(u, previo)) throw new Error('Este lead pertenece a otro comercial');
        if (u.rol === 'comercial') lead.comercial = previo.comercial;
        lead.historial = unir(previo.historial, lead.historial); lead.seguimientos = unir(previo.seguimientos, lead.seguimientos);
        lead.creado = previo.creado; lead.creadoPor = previo.creadoPor;
      } else {
        if (!lead.id) { db.seq.LEAD++; lead.id = 'L-' + String(db.seq.LEAD).padStart(4, '0'); } lead.creado = ahora(); lead.creadoPor = u.correo;
        if (u.rol === 'comercial' || !lead.comercial) lead.comercial = u.correo;
        lead.historial = lead.historial && lead.historial.length ? lead.historial : [{ id: rid('H'), fecha: ahora(), de: '', a: lead.estado, nota: 'Lead creado', usuario: u.correo }];
      }
      const alc = alcance(u); if (alc && !alc.has(lead.comercial)) throw new Error('Solo puedes asignar leads a comerciales de tu equipo');
      const com = db.usuarios.find(x => x.correo === lead.comercial); if (!com) throw new Error('Comercial no registrado');
      if (previo) lead.venta = previo.venta;
      const cambia = !previo || previo.estado !== lead.estado;
      if (cambia && GANADOS.includes(lead.estado) && !(lead.venta && lead.venta.valorVenta > 0)) throw new Error('Para pasar a ' + EST[lead.estado].t + ' registra el cierre de venta');
      if (cambia && lead.estado === 'entregado' && docsFaltantes(lead.venta).length) throw new Error('Para finalizar como Entregado faltan documentos: ' + docsFaltantes(lead.venta).map(k => DOCS_VENTA[k]).join(', '));
      lead.nombreComercial = com.nombre;
      if (GANADOS.includes(lead.estado)) lead.fechaVenta = lead.fechaVenta || hoyISO(); else delete lead.fechaVenta;
      if (FINALES.includes(lead.estado)) lead.fechaCierre = lead.fechaCierre || hoyISO(); else delete lead.fechaCierre;
      lead.nCotizaciones = db.cotizaciones.filter(c => c.leadId === lead.id).length; lead.actualizado = ahora();
      if (previo) db.leads[db.leads.indexOf(previo)] = lead; else db.leads.push(lead);
      tocar(); return { ok: true, lead: copia(lead) };
    },
    guardarCotizacion(p, u) {
      const cot = copia(p.cotizacion); const lead = db.leads.find(x => x.id === cot.leadId);
      if (!lead) throw new Error('No existe el lead'); if (!puedeVer(u, lead)) throw new Error('Este lead pertenece a otro comercial');
      const previa = cot.id ? db.cotizaciones.find(x => x.id === cot.id) : null;
      if (!previa) { db.seq.COT++; cot.id = `COT-${hoyISO().slice(0, 4)}-${String(db.seq.COT).padStart(4, '0')}`; cot.creado = ahora(); cot.usuario = u.correo; cot.estado = cot.estado || 'emitida'; }
      else { cot.creado = previa.creado; cot.archivo = cot.archivo || previa.archivo; }
      cot.comercial = lead.comercial; cot.nombreComercial = lead.nombreComercial; cot.actualizado = ahora();
      if (p.pdfBase64) cot.archivo = { nombre: cot.id + '.pdf', mime: 'application/pdf', demo: true };
      if (p.archivo && p.archivo.base64) {
        if (p.archivo.base64.length > 3.5e6) throw new Error('En el modo demo el archivo cargado debe pesar menos de 2,5 MB (con el backend real el límite es 8 MB)');
        db.archivos[cot.id] = p.archivo; cot.archivo = { nombre: p.archivo.nombre, mime: p.archivo.mime };
      }
      if (previa) db.cotizaciones[db.cotizaciones.indexOf(previa)] = cot; else db.cotizaciones.push(cot);
      if (!previa) {
        if (EST[lead.estado].i < EST.cotizado.i) { lead.historial.push({ id: rid('H'), fecha: ahora(), de: lead.estado, a: 'cotizado', nota: 'Cotización ' + cot.id, usuario: u.correo }); lead.estado = 'cotizado'; }
        lead.seguimientos.push({ id: rid('S'), fecha: ahora(), medio: 'Cotización', resultado: cot.tipo === 'cargada' ? 'Cotización cargada' : 'Cotización emitida', nota: `${cot.id} · ${cot.vehiculo.marca} ${cot.vehiculo.referencia} · ${fmtCOP(cot.total)}`, usuario: u.correo });
      }
      lead.nCotizaciones = db.cotizaciones.filter(c => c.leadId === lead.id).length; lead.actualizado = ahora();
      tocar(); return { ok: true, cotizacion: copia(cot), lead: copia(lead) };
    },
    guardarVenta(p, u) {
      const l = db.leads.find(x => x.id === p.leadId); if (!l || !puedeVer(u, l)) throw new Error('No tienes acceso a este lead');
      if (p.estado && esRetroceso(l.estado, p.estado) && u.rol === 'comercial') throw new Error('No puedes reabrir este lead: solo el supervisor o gerencia pueden hacerlo');
      const e = p.venta || {}; if (!(e.valorVenta > 0)) throw new Error('Indica el valor real de la venta'); if (!(e.valorNeto > 0)) throw new Error('Indica el valor neto del vehículo');
      const cot = db.cotizaciones.find(c => c.id === e.cotizacionId && c.leadId === l.id);
      l.venta = Object.assign({}, e, { valorCotizado: cot ? cot.total : 0, documentos: (l.venta || {}).documentos || {}, registradoPor: (l.venta || {}).registradoPor || u.correo, actualizado: ahora() });
      if (cot) cot.estado = 'aceptada';
      if (p.estado === 'entregado' && docsFaltantes(l.venta).length) throw new Error('Para finalizar como Entregado faltan documentos: ' + docsFaltantes(l.venta).map(k => DOCS_VENTA[k]).join(', '));
      if (p.estado && p.estado !== l.estado) { const c = calcVenta(l.venta); l.historial.push({ id: rid('H'), fecha: ahora(), de: l.estado, a: p.estado, nota: `Venta ${fmtCOP(l.venta.valorVenta)} (${c.comparacion.toLowerCase()}) · membresía ${fmtCOP(l.venta.membresia)}`, usuario: u.correo }); l.estado = p.estado; }
      if (GANADOS.includes(l.estado)) l.fechaVenta = l.venta.fecha; if (FINALES.includes(l.estado)) l.fechaCierre = l.fechaCierre || hoyISO();
      l.actualizado = ahora(); tocar(); return { ok: true, lead: copia(l) };
    },
    subirDocumentoVenta(p, u) {
      const l = db.leads.find(x => x.id === p.leadId); if (!l || !puedeVer(u, l)) throw new Error('No tienes acceso a este lead');
      if (!l.venta) throw new Error('Primero registra el cierre de venta');
      if (p.archivo.base64.length > 3.5e6) throw new Error('En el modo demo cada documento debe pesar menos de 2,5 MB (con el backend real, 8 MB)');
      db.archivos['venta:' + l.id + ':' + p.tipo] = p.archivo; l.venta.documentos[p.tipo] = { nombre: p.archivo.nombre, mime: p.archivo.mime, demo: true };
      tocar(); return { ok: true, lead: copia(l) };
    },
    obtenerDocumento(p) {
      const a = db.archivos['venta:' + p.leadId + ':' + p.tipo];
      if (a) return { ok: true, nombre: a.nombre, mime: a.mime, base64: a.base64 };
      return { ok: true, nombre: p.tipo + '_ejemplo.txt', mime: 'text/plain', base64: btoa('Documento de ejemplo del modo demo (' + p.tipo + ')') };
    },
    obtenerArchivo(p) { const a = db.archivos[p.cotizacionId]; if (!a) throw new Error('El archivo no está en este navegador'); return { ok: true, nombre: a.nombre, mime: a.mime, base64: a.base64 }; },
    enviarCotizacion(p, u) {
      const c = db.cotizaciones.find(x => x.id === p.cotizacionId); const l = db.leads.find(x => x.id === c.leadId);
      if (c.estado === 'emitida') c.estado = 'enviada';
      l.seguimientos.push({ id: rid('S'), fecha: ahora(), medio: 'Correo', resultado: 'Cotización enviada', nota: `${c.id} enviada a ${p.para}`, usuario: u.correo });
      tocar(); return { ok: true, cotizacion: copia(c), lead: copia(l) };
    },
    guardarUsuario(p, u) {
      if (!verTodoU(u)) throw new Error('Solo gerencia o un administrador pueden gestionar usuarios');
      const n = Object.assign({}, p.usuario); const ex = db.usuarios.find(x => x.correo === n.correo);
      if (n.correo === u.correo && (n.activo === false || n.rol !== u.rol)) throw new Error('No puedes desactivar ni cambiar el perfil de tu propio usuario');
      if (u.rol !== 'admin' && (n.rol === 'admin' || (ex && ex.rol === 'admin'))) throw new Error('Solo un administrador puede crear o modificar administradores');
      if (n.rol !== 'comercial') n.supervisor = '';
      if (ex && ex.rol === 'supervisor' && n.rol !== 'supervisor') db.usuarios.forEach(x => { if (x.supervisor === ex.correo) x.supervisor = ''; });
      const clave = n.clave, quitar = n.quitarClave; delete n.clave; delete n.quitarClave;
      if (clave && !claveOk(clave)) throw new Error('La contraseña debe tener mínimo 8 caracteres, con letras y números');
      if (ex) Object.assign(ex, n); else db.usuarios.push(n);
      db.claves = db.claves || {}; if (clave) db.claves[n.correo] = clave; else if (quitar) delete db.claves[n.correo];
      tocar(); return { ok: true, usuarios: db.usuarios.map(conClave) };
    },
    enviarInforme(p, u) {
      const pend = db.leads.filter(l => l.comercial === u.correo && esActivo(l) && l.fechaSeguimiento && l.fechaSeguimiento <= hoyISO()).length;
      const ay = sumarDias(hoyISO(), -1); const ids = new Set(db.leads.filter(l => puedeVer(u, l)).map(l => l.id));
      const g = db.leads.filter(l => ids.has(l.id)).reduce((s, l) => s + (l.seguimientos || []).filter(x => isoDe(new Date(x.fecha)) === ay && x.medio !== 'Cotización').length, 0);
      return u.rol === 'comercial' ? { ok: true, tipo: 'agenda', para: u.correo + ' (simulado en el demo)', pendientes: pend } : { ok: true, tipo: 'informe', para: u.correo + ' (simulado en el demo)', gestiones: g, desde: ay, hasta: ay };
    }
  };
  return {
    async llamar(p) {
      cargar(); await new Promise(r => setTimeout(r, 120));
      try {
        const publica = ['solicitarCodigo', 'verificarCodigo', 'ingresarGoogle', 'completarRegistro', 'ingresarClave', 'ping'].includes(p.accion);
        const u = publica ? null : usuarioDe(p.token);
        if (!publica && !u) return { error: 'sesion' };
        if (!acciones[p.accion]) return { error: 'accion desconocida: ' + p.accion };
        const r = acciones[p.accion](p, u); guardar(); return r;
      } catch (e) { return { error: e.message }; }
    },
    reiniciar() { localStorage.removeItem(CLAVE); db = null; location.reload(); }
  };
})();
