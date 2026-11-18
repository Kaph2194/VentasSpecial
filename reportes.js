// =====================================================================
// REPORTERÍA — indicadores por periodo, embudo, comerciales, marcas,
// orígenes, motivos de pérdida, tendencia; exporta a Excel e imprime.
// El administrador ve a todo el equipo; el comercial ve solo lo suyo.
// =====================================================================

function rangoReporte() {
  const p = $('rPeriodo').value, h = hoyISO(), d = new Date();
  $('rFechas').classList.toggle('hidden', p !== 'custom');
  if (p === 'mes') return [h.slice(0, 8) + '01', h, 'Este mes'];
  if (p === 'mesant') { const a = new Date(d.getFullYear(), d.getMonth() - 1, 1), b = new Date(d.getFullYear(), d.getMonth(), 0); return [isoDe(a), isoDe(b), a.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })]; }
  if (p === '30') return [sumarDias(h, -29), h, 'Últimos 30 días'];
  if (p === '90') return [sumarDias(h, -89), h, 'Últimos 90 días'];
  if (p === 'anio') return [h.slice(0, 4) + '-01-01', h, 'Año ' + h.slice(0, 4)];
  if (p === 'todo') return ['0000-00-00', '9999-12-31', 'Todo el histórico'];
  const a = $('rDesde').value || h.slice(0, 8) + '01', b = $('rHasta').value || h; return [a, b, `${fmtD(a)} a ${fmtD(b)}`];
}
const enRango = (f, [a, b]) => { const x = String(f || '').slice(0, 10); return x && x >= a && x <= b; };
function valorVenta(l) {
  if (l.venta && Number(l.venta.valorVenta) > 0) return Number(l.venta.valorVenta);
  const cs = cotizacionesDe(l.id); const c = cs.find(x => x.estado === 'aceptada') || cs[0];
  return c ? Number(c.total) || 0 : Number(l.valorEstimado) || 0;
}
function datosReporte() {
  const r = rangoReporte(), com = $('rComercial').value, marca = $('rMarca').value;
  const leads = leadsVisibles().filter(l => (!com || l.comercial === com) && (!marca || l.marca === marca));
  const ids = new Set(leads.map(l => l.id));
  const cots = S.cotizaciones.filter(c => ids.has(c.leadId));
  const nuevos = leads.filter(l => enRango(l.fechaContacto, r));
  const ventas = leads.filter(l => GANADOS.includes(l.estado) && enRango(l.fechaVenta, r));
  const perdidos = leads.filter(l => l.estado === 'perdido' && enRango(l.fechaCierre || l.actualizado, r));
  const cotR = cots.filter(c => enRango(c.fecha, r));
  const gest = []; leads.forEach(l => (l.seguimientos || []).forEach(s => { if (enRango(s.fecha, r) && s.medio !== 'Cotización') gest.push(Object.assign({ lead: l }, s)); }));
  const activos = leads.filter(esActivo);
  const vencidos = activos.filter(l => l.fechaSeguimiento && diasR(l.fechaSeguimiento) < 0);
  const diasCierre = ventas.map(l => (parseD(l.fechaVenta) - parseD(l.fechaContacto)) / 86400000).filter(n => n >= 0);
  return { r, leads, cots, nuevos, ventas, perdidos, cotR, gest, activos, vencidos,
    valorVentas: ventas.reduce((s, l) => s + valorVenta(l), 0), valorCot: cotR.reduce((s, c) => s + (Number(c.total) || 0), 0),
    conversion: ventas.length + perdidos.length ? Math.round(ventas.length / (ventas.length + perdidos.length) * 100) : null,
    diasCierre: diasCierre.length ? Math.round(diasCierre.reduce((a, b) => a + b, 0) / diasCierre.length) : null };
}
// Barras horizontales (una sola serie, un solo tono; el valor va escrito al lado y en el tooltip)
function barras(filas, fmt, vacio) {
  if (!filas.length) return `<div class="empty-msg empty-sm">${vacio || 'Sin datos en el periodo'}</div>`;
  const max = Math.max(1, ...filas.map(f => f.v));
  return `<div class="rbars">${filas.map(f => `<div class="rbar" title="${esc(f.t)}: ${esc(fmt ? fmt(f.v) : f.v)}${f.extra ? ' · ' + esc(f.extra) : ''}" ${f.click ? `onclick="${f.click}"` : ''}>
    <span class="rbar-t">${f.badge || esc(f.t)}</span><span class="rbar-track"><span class="rbar-fill" style="width:${Math.max(f.v ? 2 : 0, Math.round(f.v / max * 100))}%"></span></span>
    <span class="rbar-v">${esc(fmt ? fmt(f.v) : f.v)}${f.extra ? `<small>${esc(f.extra)}</small>` : ''}</span></div>`).join('')}</div>`;
}
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
function agrupar(lista, clave) { const m = {}; lista.forEach(x => { const k = clave(x) || 'Sin definir'; (m[k] = m[k] || []).push(x); }); return m; }

function renderReportes() {
  const d = datosReporte();
  $('r-titulo').textContent = `${d.r[2]}${$('rComercial').value ? ' · ' + nombreUsuario($('rComercial').value) : verTodo() ? ' · Todo el equipo' : esSupervisor() ? ' · Mi equipo' : ''}${$('rMarca').value ? ' · ' + $('rMarca').value : ''}`;
  const kpi = (n, t, sub, cls) => `<div class="kpi-card ${cls}"><div class="kpi-info"><div class="kpi-num kpi-num-sm">${n}</div><div class="kpi-label">${t}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}</div></div>`;
  $('r-kpis').innerHTML = kpi(d.nuevos.length, 'Leads nuevos', `${d.activos.length} activos hoy`, 'kpi-total') +
    kpi(d.gest.length, 'Gestiones registradas', `${d.vencidos.length} seguimientos vencidos hoy`, 'kpi-alerta') +
    kpi(d.cotR.length, 'Cotizaciones', fmtCOP(d.valorCot), 'kpi-cot') +
    kpi(d.ventas.length, 'Ventas (facturado / entregado)', fmtCOP(d.valorVentas), 'kpi-vigente') +
    kpi(d.conversion === null ? '—' : d.conversion + '%', 'Tasa de cierre', `${d.ventas.length} ganados · ${d.perdidos.length} perdidos`, 'kpi-conv') +
    kpi(d.diasCierre === null ? '—' : d.diasCierre + ' d', 'Tiempo promedio de cierre', 'del contacto a la venta', 'kpi-tiempo');
  // Embudo: estado actual de los leads que entraron en el periodo
  $('r-embudo').innerHTML = barras(ESTADOS.map(e => ({ t: e.t, badge: badgeEstado(e.k), v: d.nuevos.filter(l => l.estado === e.k).length, extra: pct(d.nuevos.filter(l => l.estado === e.k).length, d.nuevos.length) })).filter(f => f.v), null, 'No entraron leads en el periodo');
  // Comerciales
  const coms = S.usuarios.filter(u => d.leads.some(l => l.comercial === u.correo));
  const filasCom = coms.map(u => {
    const m = l => l.comercial === u.correo;
    const v = d.ventas.filter(m), p = d.perdidos.filter(m);
    return { u, nuevos: d.nuevos.filter(m).length, activos: d.activos.filter(m).length, venc: d.vencidos.filter(m).length, gest: d.gest.filter(g => g.lead.comercial === u.correo).length,
      cot: d.cotR.filter(c => c.comercial === u.correo).length, valorCot: d.cotR.filter(c => c.comercial === u.correo).reduce((s, c) => s + (Number(c.total) || 0), 0),
      ventas: v.length, valorV: v.reduce((s, l) => s + valorVenta(l), 0), perdidos: p.length, conv: v.length + p.length ? Math.round(v.length / (v.length + p.length) * 100) + '%' : '—' };
  }).sort((a, b) => b.ventas - a.ventas || b.valorV - a.valorV || b.nuevos - a.nuevos);
  $('r-comerciales').innerHTML = `<table class="tabla-rep"><thead><tr><th>Comercial</th><th>Leads nuevos</th><th>Activos</th><th>Vencidos</th><th>Gestiones</th><th>Cotizaciones</th><th style="text-align:right">Valor cotizado</th><th>Ventas</th><th style="text-align:right">Valor ventas</th><th>Perdidos</th><th>Cierre</th></tr></thead><tbody>
    ${filasCom.map(f => `<tr><td><b>${esc(f.u.nombre)}</b></td><td>${f.nuevos}</td><td>${f.activos}</td><td class="${f.venc ? 'txt-r' : ''}">${f.venc}</td><td>${f.gest}</td><td>${f.cot}</td><td style="text-align:right">${fmtCOP(f.valorCot)}</td><td><b>${f.ventas}</b></td><td style="text-align:right"><b>${fmtCOP(f.valorV)}</b></td><td>${f.perdidos}</td><td>${f.conv}</td></tr>`).join('') || '<tr><td colspan="11" class="empty-msg">Sin datos</td></tr>'}
    </tbody></table>`;
  // Rentabilidad real (cierres de venta registrados)
  const cv = d.ventas.filter(l => l.venta);
  const sum = (lst, f) => lst.reduce((s, x) => s + (Number(f(x)) || 0), 0);
  const filaRent = (t, lst) => { const cot = lst.filter(l => l.venta.valorCotizado), bajo = cot.filter(l => l.venta.valorVenta < l.venta.valorCotizado);
    const vend = sum(lst, l => l.venta.valorVenta), neto = sum(lst, l => l.venta.valorNeto), memb = sum(lst, l => l.venta.membresia), adm = sum(lst, l => calcVenta(l.venta).costoAdmin);
    return `<tr><td><b>${t}</b></td><td>${lst.length}</td><td style="text-align:right">${fmtCOP(sum(cot, l => l.venta.valorCotizado))}</td><td style="text-align:right">${fmtCOP(vend)}</td>
      <td class="${bajo.length ? 'txt-r' : ''}">${bajo.length} · ${fmtCOP(sum(bajo, l => l.venta.valorVenta - l.venta.valorCotizado))}</td><td style="text-align:right">${fmtCOP(neto)}</td>
      <td style="text-align:right">${fmtCOP(vend - neto)}</td><td>${pct1(vend ? (vend - neto) / vend : null)}</td><td style="text-align:right">${fmtCOP(memb)}</td><td>${sum(lst, l => l.venta.mesesAdmin)}</td>
      <td style="text-align:right"><b>${fmtCOP(vend - neto + memb - adm)}</b></td><td>${lst.filter(l => docsFaltantes(l.venta).length).length || '✅'}</td></tr>`; };
  $('r-rentabilidad').innerHTML = cv.length ? `<table class="tabla-rep"><thead><tr><th>Comercial</th><th>Ventas</th><th style="text-align:right">Valor cotizado</th><th style="text-align:right">Valor vendido</th><th>Por debajo de cotización</th><th style="text-align:right">Valor neto</th><th style="text-align:right">Utilidad vehículos</th><th>% margen</th><th style="text-align:right">Membresías</th><th>Meses adm.</th><th style="text-align:right">Utilidad total</th><th>Docs pendientes</th></tr></thead><tbody>
    ${coms.map(u => { const lst = cv.filter(l => l.comercial === u.correo); return lst.length ? filaRent(esc(u.nombre), lst) : ''; }).join('')}${filaRent('TOTAL', cv)}</tbody></table>
    <table class="tabla-rep" style="margin-top:14px"><thead><tr><th># Lead</th><th>Cliente</th><th>Vehículo</th><th>Comercial</th><th style="text-align:right">Cotizado</th><th style="text-align:right">Venta real</th><th>vs cotización</th><th style="text-align:right">Neto</th><th>% ganancia</th><th style="text-align:right">Membresía</th><th>Meses adm.</th><th>Documentos</th></tr></thead><tbody>
    ${cv.map(l => { const v = l.venta, c = calcVenta(v), f = docsFaltantes(v); return `<tr><td><a href="#lead=${esc(l.id)}" onclick="event.preventDefault();abrirFicha('${esc(l.id)}','venta')">${esc(l.id)}</a></td><td>${esc(l.prospecto)}</td><td>${esc([l.marca, l.referencia].join(' '))}</td><td>${esc(nombreUsuario(l.comercial))}</td>
      <td style="text-align:right">${v.valorCotizado ? fmtCOP(v.valorCotizado) : '—'}</td><td style="text-align:right"><b>${fmtCOP(v.valorVenta)}</b></td><td class="${c.diferencia < 0 ? 'txt-r' : ''}">${c.diferencia === null ? '—' : c.diferencia === 0 ? 'Igual' : (c.diferencia > 0 ? '+' : '') + fmtCOP(c.diferencia) + ' (' + pct1(c.pctDiferencia) + ')'}</td>
      <td style="text-align:right">${fmtCOP(v.valorNeto)}</td><td>${pct1(c.margenVenta)}</td><td style="text-align:right">${fmtCOP(v.membresia)}</td><td>${v.mesesAdmin || 0}</td><td class="${f.length ? 'txt-r' : 'txt-g'}">${f.length ? 'Faltan ' + f.length : 'Completos'}</td></tr>`; }).join('')}</tbody></table>`
    : `<div class="empty-msg empty-sm">${d.ventas.length ? 'Las ventas del periodo no tienen el cierre registrado' : 'Sin ventas en el periodo'}</div>`;
  // Marcas
  const pm = agrupar(d.nuevos, l => l.marca);
  $('r-marcas').innerHTML = barras(Object.entries(pm).map(([k, l]) => ({ t: k, v: l.length, extra: `${d.ventas.filter(x => x.marca === k).length} venta(s)` })).sort((a, b) => b.v - a.v).slice(0, 12));
  const pr = agrupar(d.nuevos, l => `${l.marca} ${l.referencia}`.trim());
  $('r-referencias').innerHTML = barras(Object.entries(pr).map(([k, l]) => ({ t: k, v: l.length })).sort((a, b) => b.v - a.v).slice(0, 10));
  // Orígenes con su conversión a venta
  const po = agrupar(d.nuevos, l => l.origen);
  $('r-origenes').innerHTML = barras(Object.entries(po).map(([k, l]) => ({ t: k, v: l.length, extra: `${pct(l.filter(x => GANADOS.includes(x.estado)).length, l.length)} compró` })).sort((a, b) => b.v - a.v));
  // Motivos de pérdida
  const pp = agrupar(d.perdidos, l => l.motivoPerdida);
  $('r-perdidas').innerHTML = barras(Object.entries(pp).map(([k, l]) => ({ t: k, v: l.length, extra: pct(l.length, d.perdidos.length) })).sort((a, b) => b.v - a.v), null, 'Ningún lead perdido en el periodo');
  // Gestiones por resultado
  const pg = agrupar(d.gest, g => g.resultado);
  $('r-gestiones').innerHTML = barras(Object.entries(pg).map(([k, l]) => ({ t: k, v: l.length })).sort((a, b) => b.v - a.v).slice(0, 10), null, 'Sin gestiones en el periodo');
  // Tendencia: leads nuevos y ventas por semana (últimas 12 semanas)
  const lunes = x => { const t = parseD(x); const dd = (t.getDay() + 6) % 7; t.setDate(t.getDate() - dd); return isoDe(t); };
  const sem = []; let s0 = lunes(hoyISO()); for (let i = 11; i >= 0; i--) sem.push(sumarDias(s0, -7 * i));
  const cnt = (lista, campo, k) => lista.filter(l => l[campo] && lunes(l[campo]) === k).length;
  const maxT = Math.max(1, ...sem.map(k => cnt(d.leads, 'fechaContacto', k)));
  $('r-tendencia').innerHTML = `<div class="rcols">${sem.map(k => { const n = cnt(d.leads, 'fechaContacto', k), v = d.leads.filter(l => GANADOS.includes(l.estado) && l.fechaVenta && lunes(l.fechaVenta) === k).length;
    return `<div class="rcol" title="Semana del ${fmtD(k)}: ${n} lead(s) nuevos · ${v} venta(s)"><span class="rcol-n">${n || ''}</span><span class="rcol-bar" style="height:${Math.round(n / maxT * 100)}%"></span><span class="rcol-l">${parseD(k).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span><span class="rcol-v">${v ? '🏁' + v : ''}</span></div>`; }).join('')}</div>
    <div class="td-sub" style="margin-top:6px">Barras: leads nuevos por semana (fecha de contacto) · 🏁 ventas de la semana. Todas las semanas, sin aplicar el periodo.</div>`;
  $('btn-informe-correo').textContent = veEquipo() ? '✉️ Enviarme el informe de ayer' : '✉️ Enviarme mi agenda';
}

// ===== EXPORTAR A EXCEL =====
function exportarExcel() {
  if (typeof XLSX === 'undefined') { mostrarToast('No cargó la librería de Excel (revisa la conexión)', 'error'); return; }
  const d = datosReporte(), wb = XLSX.utils.book_new();
  const hoja = (filas, nombre, anchos) => { const ws = XLSX.utils.json_to_sheet(filas); if (anchos) ws['!cols'] = anchos.map(w => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, nombre); };
  hoja(d.leads.map(l => ({ '# Lead': l.id, 'Fecha contacto': l.fechaContacto, 'Prospecto': l.prospecto, 'Teléfono': l.telefono, 'Correo': l.correo || '', 'Documento': l.documento || '', 'Ciudad': l.ciudad || '',
    'Marca': l.marca, 'Referencia': l.referencia, 'Versión': l.version || '', 'Origen': l.origen || '', 'Estado': EST[l.estado].t, 'Fecha seguimiento': l.fechaSeguimiento || '', 'Hora': l.horaSeguimiento || '',
    'Comercial': nombreUsuario(l.comercial), 'Valor estimado': Number(l.valorEstimado) || 0, 'Forma de pago': l.formaPago || '', 'Retoma': l.retoma || '', 'Motivo pérdida': l.motivoPerdida || '',
    'Cotizaciones': cotizacionesDe(l.id).length, 'Gestiones': (l.seguimientos || []).length, 'Última gestión': (ultimaGestion(l) || {}).resultado || '', 'Fecha venta': l.fechaVenta || '', 'Valor venta': GANADOS.includes(l.estado) ? valorVenta(l) : '', 'Observaciones': l.observaciones || '' })),
    'Leads', [9, 12, 26, 14, 24, 12, 12, 12, 16, 16, 18, 18, 12, 7, 20, 14, 14, 18, 20, 8, 8, 20, 12, 14, 40]);
  hoja(d.cots.map(c => ({ 'N° cotización': c.id, 'Fecha': c.fecha, 'Válida hasta': c.validaHasta, '# Lead': c.leadId, 'Cliente': (c.cliente || {}).nombre || '', 'Marca': c.vehiculo.marca, 'Referencia': c.vehiculo.referencia,
    'Versión': [c.vehiculo.version, c.vehiculo.modelo].filter(Boolean).join(' '), 'Precio lista': Number(c.precioLista) || 0, 'Descuento': Number(c.descuento) || 0, 'Total': Number(c.total) || 0, 'Forma de pago': c.formaPago || '',
    'Cuota inicial': Number(c.cuotaInicial) || '', 'Plazo': Number(c.plazoMeses) || '', 'Cuota mensual': Number(c.cuotaMensual) || '', 'Estado': cotVencida(c) ? 'Vencida' : (ESTADOS_COT[c.estado] || {}).t, 'Tipo': c.tipo === 'cargada' ? 'Cargada' : 'Generada', 'Comercial': nombreUsuario(c.comercial) })),
    'Cotizaciones', [15, 11, 11, 9, 24, 12, 16, 18, 13, 11, 13, 12, 12, 7, 12, 10, 10, 20]);
  const g = []; d.leads.forEach(l => { (l.historial || []).forEach(h => g.push({ Fecha: fmtFH(h.fecha), '# Lead': l.id, Prospecto: l.prospecto, Tipo: 'Cambio de estado', Medio: '', 'Resultado / estado': (h.de ? EST[h.de].t + ' → ' : '') + EST[h.a].t, Detalle: h.nota || '', 'Próximo seguimiento': '', Usuario: nombreUsuario(h.usuario), _o: h.fecha }));
    (l.seguimientos || []).forEach(s => g.push({ Fecha: fmtFH(s.fecha), '# Lead': l.id, Prospecto: l.prospecto, Tipo: 'Gestión', Medio: s.medio || '', 'Resultado / estado': s.resultado || '', Detalle: s.nota || '', 'Próximo seguimiento': s.proximaFecha ? s.proximaFecha + ' ' + (s.proximaHora || '') : '', Usuario: nombreUsuario(s.usuario), _o: s.fecha })); });
  hoja(g.sort((a, b) => String(b._o).localeCompare(String(a._o))).map(x => { delete x._o; return x; }), 'Historial', [15, 9, 24, 16, 14, 30, 40, 18, 20]);
  const coms = S.usuarios.filter(u => d.leads.some(l => l.comercial === u.correo));
  hoja(coms.map(u => { const m = l => l.comercial === u.correo; const v = d.ventas.filter(m), p = d.perdidos.filter(m);
    return { Comercial: u.nombre, Correo: u.correo, 'Leads nuevos': d.nuevos.filter(m).length, Activos: d.activos.filter(m).length, 'Seguimientos vencidos': d.vencidos.filter(m).length,
      Gestiones: d.gest.filter(x => x.lead.comercial === u.correo).length, Cotizaciones: d.cotR.filter(c => c.comercial === u.correo).length, Ventas: v.length, 'Valor ventas': v.reduce((s, l) => s + valorVenta(l), 0), Perdidos: p.length }; })
    .filter(f => Object.values(f).slice(2).some(n => n)), `Comerciales ${d.r[2]}`.slice(0, 31), [22, 26, 12, 9, 12, 10, 12, 8, 14, 9]);
  hoja(d.leads.filter(l => l.venta).map(l => { const v = l.venta, c = calcVenta(v), dd = v.documentos || {};
    return { '# Lead': l.id, 'Fecha venta': v.fecha, 'Cliente': l.prospecto, 'Comercial': nombreUsuario(l.comercial), 'Marca': l.marca, 'Referencia': l.referencia, 'Estado': EST[l.estado].t, 'N° factura': v.factura || '',
      'Cotización': v.cotizacionId || '', 'Valor cotizado': Number(v.valorCotizado) || '', 'Valor venta real': Number(v.valorVenta), 'Diferencia vs cotización': c.diferencia === null ? '' : c.diferencia, '% diferencia': c.pctDiferencia === null ? '' : c.pctDiferencia,
      'Comparación': c.comparacion, 'Valor neto vehículo': Number(v.valorNeto), 'Utilidad vehículo': c.utilidadVehiculo, '% ganancia sobre venta': c.margenVenta, '% ganancia sobre neto': c.margenCosto, 'Membresía': Number(v.membresia) || 0,
      'Meses administración (comercial)': Number(v.mesesAdmin) || 0, 'Valor mes administración': Number(v.valorMesAdmin) || 0, 'Costo administración': c.costoAdmin, 'Utilidad total': c.utilidadTotal, '% margen total': c.margenTotal,
      'Factura': dd.factura ? 'Sí' : 'No', 'Ficha homologación': dd.homologacion ? 'Sí' : 'No', 'Certificado aduana': dd.aduana ? 'Sí' : 'No', 'Contrato membresía': dd.contrato ? 'Sí' : 'No' }; }), 'Ventas', [9, 11, 24, 18, 12, 14, 12, 12, 15, 14, 14, 14, 10, 24, 14, 14, 10, 10, 12, 10, 12, 12, 14, 10, 8, 8, 8, 8]);
  XLSX.writeFile(wb, `ventas_${hoyISO()}.xlsx`);
  mostrarToast('Excel descargado', 'success');
}

// ===== INFORME IMPRIMIBLE (Guardar como PDF desde el navegador) =====
function imprimirReporte() {
  const html = $('vista-reportes').querySelector('.rep-cuerpo').innerHTML;
  const w = window.open('', '_blank'); if (!w) { mostrarToast('Permite las ventanas emergentes para ver el informe', 'error'); return; }
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Informe comercial ${hoyISO()}</title><link rel="stylesheet" href="styles.css"><style>body{background:#fff;padding:24px}.no-print{margin-bottom:10px}@media print{.no-print{display:none}}.rep-grid{grid-template-columns:1fr 1fr}</style></head>
    <body><div class="no-print"><button class="btn btn-primary-dark" onclick="window.print()">Imprimir / Guardar PDF</button></div>
    <h1 class="cartera-titulo">Informe comercial — ${esc(EMPRESA.nombre)}</h1><div class="td-sub" style="margin-bottom:14px">${esc($('r-titulo').textContent)} · generado el ${new Date().toLocaleString('es-CO')} por ${esc(S.usuario.nombre)}</div>${html}</body></html>`);
  w.document.close();
}
