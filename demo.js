// =====================================================================
// MODO DEMO — imita al backend (apps-script/Ventas.gs) guardando todo en
// este navegador, con datos de ejemplo. Se usa mientras VENTAS_WEBAPP_URL
// esté vacía. Para empezar de cero: DemoBackend.reiniciar().
// =====================================================================
const DemoBackend = (() => {
  const CLAVE = 'vt_demo_v1';
  let db = null;
  const ahora = () => new Date().toISOString();
  const rid = p => p + '-' + Math.random().toString(36).slice(2, 10);
  const d = n => sumarDias(hoyISO(), n);
  const ts = (n, h) => { const x = parseD(d(n)); x.setHours(h || 10, Math.floor(Math.random() * 59)); return x.toISOString(); };
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(db)); } catch (e) { console.warn('Demo: localStorage lleno', e); } };
  const tocar = () => { db.version = String(Date.now()); };

  function semilla() {
    const U = [
      { correo: 'gerente@demo.com', nombre: 'Laura Gómez', rol: 'admin', activo: true, telefono: '310 555 0101', cargo: 'Gerente comercial' },
      { correo: 'carlos.ruiz@gmail.com', nombre: 'Carlos Ruiz', rol: 'comercial', activo: true, telefono: '311 555 0202', cargo: 'Asesor comercial' },
      { correo: 'andrea.mejia@gmail.com', nombre: 'Andrea Mejía', rol: 'comercial', activo: true, telefono: '312 555 0303', cargo: 'Asesora comercial' }
    ];
    const ej = [
      ['Juan Pablo Torres', '3104567890', 'Mazda', 'CX-30', 'Grand Touring 2026', 'Página web', 'cotizado', 1, '10:00', 'carlos.ruiz@gmail.com', -12, 138900000, 'Crédito'],
      ['María Fernanda López', '3157778899', 'Kia', 'Sportage', 'Vibrant 2026', 'Vitrina / showroom', 'prueba', 0, '15:30', 'andrea.mejia@gmail.com', -6, 152000000, 'Retoma + crédito'],
      ['Andrés Felipe Rojas', '3001234567', 'Toyota', 'Corolla Cross', 'XEI Híbrida 2026', 'Facebook / Instagram', 'contactado', -2, '', 'carlos.ruiz@gmail.com', -9, 149900000, 'Crédito'],
      ['Luisa Martínez', '3209876543', 'Renault', 'Duster', 'Intens 2026', 'WhatsApp', 'nuevo', 0, '11:00', 'andrea.mejia@gmail.com', -1, 99990000, 'Por definir'],
      ['Camilo Herrera', '3015556677', 'Chevrolet', 'Tracker', 'Premier 2026', 'Referido', 'negociacion', 2, '09:30', 'carlos.ruiz@gmail.com', -20, 118000000, 'Contado'],
      ['Diana Patricia Castro', '3118889900', 'BYD', 'Dolphin Mini', '2026', 'Página web', 'credito', 3, '', 'andrea.mejia@gmail.com', -18, 79990000, 'Crédito'],
      ['Sebastián Moreno', '3162223344', 'Mazda', '2 Sedán', 'Touring 2026', 'Llamada entrante', 'aprobado', 1, '16:00', 'carlos.ruiz@gmail.com', -25, 94900000, 'Crédito'],
      ['Natalia Vargas', '3184445566', 'Volkswagen', 'T-Cross', 'Highline 2026', 'Vitrina / showroom', 'facturado', 4, '', 'andrea.mejia@gmail.com', -30, 129990000, 'Contado'],
      ['Jorge Iván Ramírez', '3006667788', 'Nissan', 'Kicks', 'Exclusive 2026', 'TuCarro / Marketplace', 'entregado', null, '', 'carlos.ruiz@gmail.com', -45, 112000000, 'Crédito'],
      ['Paola Andrea Gil', '3129990011', 'Hyundai', 'Tucson', 'Limited 2026', 'Facebook / Instagram', 'perdido', null, '', 'andrea.mejia@gmail.com', -28, 165000000, 'Crédito'],
      ['Ricardo Salazar', '3193334455', 'Suzuki', 'Swift', 'Hybrid 2026', 'Feria / evento', 'cita', -1, '10:30', 'carlos.ruiz@gmail.com', -4, 78900000, 'Retoma + contado'],
      ['Valentina Ospina', '3141112233', 'Kia', 'Picanto', 'Zenith 2026', 'TikTok', 'contactado', 5, '', 'andrea.mejia@gmail.com', -3, 66990000, 'Crédito'],
      ['Hernán Darío Pérez', '3027778811', 'Toyota', 'Hilux', 'SRV 4x4 2026', 'Cliente antiguo', 'entregado', null, '', 'andrea.mejia@gmail.com', -60, 219900000, 'Leasing'],
      ['Carolina Ríos', '3175553311', 'Chevrolet', 'Onix', 'Turbo RS 2026', 'Página web', 'perdido', null, '', 'carlos.ruiz@gmail.com', -15, 82990000, 'Crédito']
    ];
    const leads = [], cots = []; let nCot = 0;
    const camino = ['nuevo', 'contactado', 'cita', 'prueba', 'cotizado', 'negociacion', 'credito', 'aprobado', 'facturado', 'entregado'];
    ej.forEach((x, i) => {
      const [prospecto, telefono, marca, referencia, version, origen, estado, seg, hora, comercial, contacto, valor, pago] = x;
      const id = 'L-' + String(i + 1).padStart(4, '0');
      const l = { id, fechaContacto: d(contacto), prospecto, telefono, correo: prospecto.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '.' + (i + 1) + '@correo.com', documento: String(52000000 + i * 734521), ciudad: ['Bogotá', 'Medellín', 'Cali', 'Chía'][i % 4],
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
    leads.forEach(l => { l.nCotizaciones = cots.filter(c => c.leadId === l.id).length; l.nombreComercial = U.find(u => u.correo === l.comercial).nombre; l.actualizado = ahora(); });
    return { usuarios: U, leads, cotizaciones: cots, seq: { LEAD: leads.length, COT: nCot }, archivos: {}, version: String(Date.now()) };
  }
  function cargar() {
    if (db) return db;
    try { db = JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) { db = null; }
    if (!db) { db = semilla(); guardar(); }
    return db;
  }
  const usuarioDe = token => { const c = String(token || '').replace(/^demo:/, ''); const u = db.usuarios.find(x => x.correo === c); return u && u.activo ? u : null; };
  const puedeVer = (u, l) => u.rol === 'admin' || l.comercial === u.correo;
  const unir = (a, b) => { const m = new Map(); (a || []).concat(b || []).forEach(x => x && x.id && m.set(x.id, Object.assign({}, m.get(x.id) || {}, x))); return [...m.values()].sort((x, y) => String(x.fecha).localeCompare(String(y.fecha))); };
  const copia = o => JSON.parse(JSON.stringify(o));

  const acciones = {
    solicitarCodigo(p) {
      const c = String(p.correo || '').trim().toLowerCase(); const u = db.usuarios.find(x => x.correo === c);
      if (!u || !u.activo) throw new Error('Este correo no está autorizado. En el demo usa gerente@demo.com, carlos.ruiz@gmail.com o andrea.mejia@gmail.com');
      return { ok: true, enviado: true, codigoDemo: '123456' };
    },
    verificarCodigo(p) {
      if (p.codigo !== '123456') throw new Error('Código incorrecto (en el demo es 123456)');
      const u = db.usuarios.find(x => x.correo === String(p.correo).toLowerCase()); return { ok: true, token: 'demo:' + u.correo, usuario: copia(u) };
    },
    cerrarSesion() { return { ok: true }; },
    obtenerDatos(p, u) {
      if (p.version && p.version === db.version) return { sinCambios: true, version: db.version };
      const leads = db.leads.filter(l => puedeVer(u, l)); const ids = new Set(leads.map(l => l.id));
      return { version: db.version, usuario: copia(u), usuarios: copia(db.usuarios), leads: copia(leads), cotizaciones: copia(db.cotizaciones.filter(c => ids.has(c.leadId))), empresa: EMPRESA, validezCotizacion: 8 };
    },
    guardarLead(p, u) {
      const lead = copia(p.lead);
      if (!String(lead.prospecto || '').trim()) throw new Error('El nombre del prospecto es obligatorio');
      if (lead.estado === 'perdido' && !lead.motivoPerdida) throw new Error('Indica el motivo por el que se perdió el lead');
      const previo = lead.id ? db.leads.find(x => x.id === lead.id) : null;
      if (previo) {
        if (!puedeVer(u, previo)) throw new Error('Este lead pertenece a otro comercial');
        if (u.rol !== 'admin') lead.comercial = previo.comercial;
        lead.historial = unir(previo.historial, lead.historial); lead.seguimientos = unir(previo.seguimientos, lead.seguimientos);
        lead.creado = previo.creado; lead.creadoPor = previo.creadoPor;
      } else {
        db.seq.LEAD++; lead.id = 'L-' + String(db.seq.LEAD).padStart(4, '0'); lead.creado = ahora(); lead.creadoPor = u.correo;
        if (u.rol !== 'admin' || !lead.comercial) lead.comercial = u.correo;
        lead.historial = lead.historial && lead.historial.length ? lead.historial : [{ id: rid('H'), fecha: ahora(), de: '', a: lead.estado, nota: 'Lead creado', usuario: u.correo }];
      }
      const com = db.usuarios.find(x => x.correo === lead.comercial); if (!com) throw new Error('Comercial no registrado');
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
    obtenerArchivo(p) { const a = db.archivos[p.cotizacionId]; if (!a) throw new Error('El archivo no está en este navegador'); return { ok: true, nombre: a.nombre, mime: a.mime, base64: a.base64 }; },
    enviarCotizacion(p, u) {
      const c = db.cotizaciones.find(x => x.id === p.cotizacionId); const l = db.leads.find(x => x.id === c.leadId);
      if (c.estado === 'emitida') c.estado = 'enviada';
      l.seguimientos.push({ id: rid('S'), fecha: ahora(), medio: 'Correo', resultado: 'Cotización enviada', nota: `${c.id} enviada a ${p.para}`, usuario: u.correo });
      tocar(); return { ok: true, cotizacion: copia(c), lead: copia(l) };
    },
    guardarUsuario(p, u) {
      if (u.rol !== 'admin') throw new Error('Solo un administrador puede gestionar usuarios');
      const n = p.usuario; const ex = db.usuarios.find(x => x.correo === n.correo);
      if (n.correo === u.correo && n.activo === false) throw new Error('No puedes desactivar tu propio usuario');
      if (ex) Object.assign(ex, n); else db.usuarios.push(n);
      tocar(); return { ok: true, usuarios: copia(db.usuarios) };
    },
    enviarInforme(p, u) {
      const pend = db.leads.filter(l => l.comercial === u.correo && esActivo(l) && l.fechaSeguimiento && l.fechaSeguimiento <= hoyISO()).length;
      return { ok: true, tipo: u.rol === 'admin' ? 'resumen' : 'agenda', para: u.correo + ' (simulado en el demo)', pendientes: pend };
    }
  };
  return {
    async llamar(p) {
      cargar(); await new Promise(r => setTimeout(r, 120));
      try {
        const publica = ['solicitarCodigo', 'verificarCodigo', 'ping'].includes(p.accion);
        const u = publica ? null : usuarioDe(p.token);
        if (!publica && !u) return { error: 'sesion' };
        if (!acciones[p.accion]) return { error: 'accion desconocida: ' + p.accion };
        const r = acciones[p.accion](p, u); guardar(); return r;
      } catch (e) { return { error: e.message }; }
    },
    reiniciar() { localStorage.removeItem(CLAVE); db = null; location.reload(); }
  };
})();
