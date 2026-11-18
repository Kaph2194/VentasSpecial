// =====================================================================
// CIERRE DE VENTA — al facturar: valor real de venta vs. cotización,
// membresía, meses de administración cubiertos por el comercial, valor
// neto del vehículo (rentabilidad real) y los 4 documentos obligatorios
// (factura, ficha de homologación, certificado de aduana, contrato de membresía).
// =====================================================================

const DOCS_VENTA = { factura: 'Factura', homologacion: 'Ficha de homologación', aduana: 'Certificado de aduana', contrato: 'Contrato de membresía' };
const docsFaltantes = v => Object.keys(DOCS_VENTA).filter(k => !(v && v.documentos && v.documentos[k] && (v.documentos[k].fileId || v.documentos[k].demo)));
const pct1 = x => x === null || x === undefined || isNaN(x) ? '—' : (x * 100).toFixed(1).replace('.', ',') + '%';

// Misma fórmula que el backend (calcVenta_)
function calcVenta(v) {
  const n = x => Number(x) || 0;
  const venta = n(v.valorVenta), neto = n(v.valorNeto), cot = n(v.valorCotizado), memb = n(v.membresia), costoAdm = n(v.mesesAdmin) * n(v.valorMesAdmin);
  const r = { diferencia: cot ? venta - cot : null, pctDiferencia: cot ? (venta - cot) / cot : null,
    comparacion: !cot ? 'Sin cotización' : venta === cot ? 'Igual a la cotización' : venta < cot ? 'Por debajo de la cotización' : 'Por encima de la cotización',
    utilidadVehiculo: venta - neto, margenVenta: venta ? (venta - neto) / venta : null, margenCosto: neto ? (venta - neto) / neto : null, costoAdmin: costoAdm };
  r.utilidadTotal = r.utilidadVehiculo + memb - costoAdm;
  r.margenTotal = venta + memb ? r.utilidadTotal / (venta + memb) : null;
  return r;
}
function badgeComparacion(c) {
  if (c.diferencia === null) return '<span class="st st-nuevo">Sin cotización de referencia</span>';
  if (c.diferencia === 0) return '<span class="st st-facturado">✔ Igual a la cotización</span>';
  if (c.diferencia < 0) return `<span class="st st-perdido">▼ Por debajo de la cotización: ${fmtCOP(c.diferencia)} (${pct1(c.pctDiferencia)})</span>`;
  return `<span class="st st-aprobado">▲ Por encima de la cotización: +${fmtCOP(c.diferencia)} (+${pct1(c.pctDiferencia)})</span>`;
}

// ===== FORMULARIO DE CIERRE =====
let _cierre = null;    // { leadId, destino }
function abrirCierreVenta(id, destino) {
  const l = S.leads.find(x => x.id === id); if (!l) return;
  const v = l.venta || {}, cots = cotizacionesDe(id);
  const ref = cots.find(c => c.id === v.cotizacionId) || cots.find(c => c.estado === 'aceptada') || cots[0];
  _cierre = { leadId: id, destino: destino || (GANADOS.includes(l.estado) ? l.estado : 'facturado') };
  const num = (idc, val, ph) => `<input type="number" min="0" step="1000" id="${idc}" value="${esc(val || val === 0 ? val : '')}" placeholder="${ph || '0'}" oninput="calcCierre()"/>`;
  const docs = v.documentos || {};
  abrirModal(`${l.venta ? 'Cierre de venta' : '🏁 Registrar venta'} — ${esc(l.id)} · ${esc(l.prospecto)}`, `
    <div class="cot-layout">
     <div class="cot-form">
      <div class="form-sect">Venta</div>
      <div class="form-grid form-grid-3">
        <div class="form-group span-2"><label>Cotización de referencia</label><select id="vt_cot" onchange="calcCierre()"><option value="">— Sin cotización —</option>
          ${cots.map(c => `<option value="${esc(c.id)}" data-total="${Number(c.total) || 0}" ${ref && ref.id === c.id ? 'selected' : ''}>${esc(c.id)} · ${esc([c.vehiculo.marca, c.vehiculo.referencia].join(' '))} · ${fmtCOP(c.total)}${c.estado === 'aceptada' ? ' (aceptada)' : ''}</option>`).join('')}</select></div>
        <div class="form-group"><label>Fecha de venta</label><input type="date" id="vt_fecha" value="${esc(v.fecha || hoyISO())}"/></div>
        <div class="form-group"><label>Valor real de venta *</label>${num('vt_venta', v.valorVenta || (ref ? ref.total : ''))}</div>
        <div class="form-group"><label>Valor neto del vehículo *</label>${num('vt_neto', v.valorNeto, 'Costo / valor neto')}</div>
        <div class="form-group"><label>N° de factura</label><input id="vt_factura" value="${esc(v.factura || '')}" placeholder="FV-0000"/></div>
      </div>
      <div class="form-sect">Membresía y administración</div>
      <div class="form-grid form-grid-3">
        <div class="form-group"><label>Valor cobrado como MEMBRESÍA</label>${num('vt_memb', v.membresia)}</div>
        <div class="form-group"><label>Meses de administración cubiertos por el comercial</label><input type="number" min="0" max="120" step="1" id="vt_meses" value="${esc(v.mesesAdmin || 0)}" oninput="calcCierre()"/></div>
        <div class="form-group"><label>Valor mensual de administración</label>${num('vt_valmes', v.valorMesAdmin, 'Para calcular el costo')}</div>
      </div>
      <div class="form-group" style="margin-top:10px"><label>Observaciones</label><textarea id="vt_obs" rows="2" placeholder="Condiciones de la negociación, descuentos autorizados…">${esc(v.observaciones || '')}</textarea></div>
      <div class="form-sect">Documentos (obligatorios para finalizar como Entregado)</div>
      <div class="docs-venta">${Object.entries(DOCS_VENTA).map(([k, t]) => `<div class="doc-row ${docs[k] ? 'doc-ok' : ''}">
        <span class="doc-ico">${docs[k] ? '✅' : '📎'}</span><span class="doc-t"><b>${t}</b>${docs[k] ? `<small>${esc(docs[k].nombre || '')}</small>` : '<small>Pendiente</small>'}</span>
        <input type="file" id="vt_doc_${k}" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"/>
        ${docs[k] ? `<button class="btn-notif" onclick="descargarDocumentoVenta('${esc(id)}','${k}')">⬇</button>` : ''}</div>`).join('')}</div>
      <p class="td-sub" style="margin-top:6px">PDF o imagen, máx. 8 MB cada uno. Se guardan en Drive, en la carpeta del lead.</p>
     </div>
     <div class="cot-resumen" id="vt_resumen"></div>
    </div>`,
    `<button class="btn btn-primary-dark" onclick="guardarCierreVenta(this)">💾 ${GANADOS.includes(l.estado) ? 'Guardar cierre' : 'Registrar venta → Facturado'}</button>
     ${l.estado !== 'entregado' ? `<button class="btn btn-dark" onclick="guardarCierreVenta(this,'entregado')" title="Requiere los 4 documentos">✅ Guardar y finalizar como Entregado</button>` : ''}`, 'modal-xl');
  calcCierre();
}
function leerCierre() {
  const sel = $('vt_cot'), opt = sel.options[sel.selectedIndex], n = idc => Number(($(idc) || {}).value) || 0;
  return { cotizacionId: sel.value, valorCotizado: sel.value ? Number(opt.dataset.total) || 0 : 0, fecha: $('vt_fecha').value || hoyISO(), factura: $('vt_factura').value.trim(),
    valorVenta: n('vt_venta'), valorNeto: n('vt_neto'), membresia: n('vt_memb'), mesesAdmin: n('vt_meses'), valorMesAdmin: n('vt_valmes'), observaciones: $('vt_obs').value.trim() };
}
function calcCierre() {
  if (!$('vt_resumen')) return;
  const v = leerCierre(), c = calcVenta(v);
  const fila = (t, val, cls) => `<div class="cr-fila ${cls || ''}"><span>${t}</span><b>${val}</b></div>`;
  $('vt_resumen').innerHTML = `<div class="cr-tit">Validación de la venta</div>
    ${fila('Valor cotizado', v.valorCotizado ? fmtCOP(v.valorCotizado) : '—')}${fila('Valor real de venta', fmtCOP(v.valorVenta), 'cr-total')}
    <div style="margin:8px 0 10px">${badgeComparacion(c)}</div>
    <div class="cr-tit" style="margin-top:6px">Rentabilidad real</div>
    ${fila('Valor neto del vehículo', fmtCOP(v.valorNeto))}
    ${fila('Utilidad del vehículo', fmtCOP(c.utilidadVehiculo), c.utilidadVehiculo < 0 ? 'txt-r' : '')}
    ${fila('% ganancia sobre la venta', pct1(c.margenVenta))}${fila('% ganancia sobre el valor neto', pct1(c.margenCosto))}
    ${fila('+ Membresía', fmtCOP(v.membresia))}
    ${fila(`− Administración (${v.mesesAdmin || 0} mes(es))`, c.costoAdmin ? fmtCOP(c.costoAdmin) : v.mesesAdmin ? 'Indica el valor mensual' : fmtCOP(0))}
    ${fila('Utilidad total', fmtCOP(c.utilidadTotal), 'cr-cuota')}${fila('% margen total', pct1(c.margenTotal))}`;
}
async function guardarCierreVenta(btn, destinoBoton) {
  const id = _cierre.leadId, l = S.leads.find(x => x.id === id); const venta = leerCierre();
  if (!(venta.valorVenta > 0)) { mostrarToast('Indica el valor real de la venta', 'error'); return; }
  if (!(venta.valorNeto > 0)) { mostrarToast('Indica el valor neto del vehículo', 'error'); return; }
  const archivos = Object.keys(DOCS_VENTA).map(k => ({ k, f: $('vt_doc_' + k).files[0] })).filter(x => x.f);
  const grande = archivos.find(x => x.f.size > 8 * 1024 * 1024); if (grande) { mostrarToast(`${DOCS_VENTA[grande.k]} supera 8 MB`, 'error'); return; }
  const destino = destinoBoton || _cierre.destino;
  if (destino === 'entregado') {
    const faltan = docsFaltantes(l.venta).filter(k => !archivos.some(a => a.k === k));
    if (faltan.length) { mostrarToast('Para finalizar como Entregado faltan: ' + faltan.map(k => DOCS_VENTA[k]).join(', '), 'error'); return; }
  }
  const c = calcVenta(venta);
  if (c.diferencia !== null && c.diferencia < 0 && !confirm(`La venta (${fmtCOP(venta.valorVenta)}) está ${fmtCOP(-c.diferencia)} por debajo de la cotización (${pct1(c.pctDiferencia)}). ¿Registrar de todas formas?`)) return;
  await conEspera(btn, async () => {
    try {
      // 1) valores (y paso a Facturado si aún no es venta)
      const primero = GANADOS.includes(l.estado) ? null : 'facturado';
      let r = await api('guardarVenta', { leadId: id, venta, estado: primero });
      upsertLead(r.lead);
      // 2) documentos, uno por uno
      for (const a of archivos) {
        btn.innerHTML = `⏳ Subiendo ${DOCS_VENTA[a.k]}…`;
        r = await api('subirDocumentoVenta', { leadId: id, tipo: a.k, archivo: { nombre: a.f.name, mime: a.f.type || 'application/octet-stream', base64: await blobABase64(a.f) } });
        upsertLead(r.lead);
      }
      // 3) finalizar como Entregado si se pidió
      if (destino === 'entregado' && S.leads.find(x => x.id === id).estado !== 'entregado') { r = await api('guardarVenta', { leadId: id, venta, estado: 'entregado' }); upsertLead(r.lead); }
      const cq = S.cotizaciones.find(c => c.id === venta.cotizacionId); if (cq) cq.estado = 'aceptada';
      S.version = null; cerrarModal();
      const fin = S.leads.find(x => x.id === id);
      mostrarToast(`${id}: ${EST[fin.estado].t} · venta ${fmtCOP(venta.valorVenta)} · ${c.comparacion.toLowerCase()}${docsFaltantes(fin.venta).length ? ' · faltan ' + docsFaltantes(fin.venta).length + ' documento(s)' : ''}`, 'success');
      abrirFicha(id, 'venta');
    } catch (e) { mostrarToast(e.message, 'error'); }
  });
}
async function descargarDocumentoVenta(leadId, tipo) {
  try { const r = await api('obtenerDocumento', { leadId, tipo }); descargarBlob(base64ABlob(r.base64, r.mime), r.nombre || (tipo + '.pdf')); }
  catch (e) { mostrarToast(e.message, 'error'); }
}
// Bloque de la ficha del lead
function htmlVentaFicha(l) {
  if (!l.venta) return GANADOS.includes(l.estado) ? `<div class="form-sect" id="sec-venta">Cierre de venta</div><div class="ficha-obs txt-r">Esta venta no tiene el cierre registrado. <button class="btn btn-sm btn-primary-dark" onclick="abrirCierreVenta('${esc(l.id)}')">🏁 Registrar cierre</button></div>` : '';
  const v = l.venta, c = calcVenta(v), falt = docsFaltantes(v), d = v.documentos || {};
  return `<div class="form-sect" id="sec-venta">Cierre de venta ${falt.length ? `<span class="st st-perdido">Faltan ${falt.length} documento(s)</span>` : '<span class="st st-facturado">Documentos completos</span>'}</div>
    <div class="venta-grid">
      <div><label>Venta real</label><b>${fmtCOP(v.valorVenta)}</b><small>${fmtD(v.fecha)}${v.factura ? ' · ' + esc(v.factura) : ''}</small></div>
      <div><label>Cotizado</label><b>${v.valorCotizado ? fmtCOP(v.valorCotizado) : '—'}</b><small>${esc(v.cotizacionId || '')}</small></div>
      <div><label>Valor neto</label><b>${fmtCOP(v.valorNeto)}</b><small>Utilidad ${fmtCOP(c.utilidadVehiculo)}</small></div>
      <div><label>% ganancia</label><b>${pct1(c.margenVenta)}</b><small>${pct1(c.margenCosto)} sobre el neto</small></div>
      <div><label>Membresía</label><b>${fmtCOP(v.membresia)}</b><small>${v.mesesAdmin || 0} mes(es) de administración</small></div>
      <div><label>Utilidad total</label><b class="${c.utilidadTotal < 0 ? 'txt-r' : 'txt-g'}">${fmtCOP(c.utilidadTotal)}</b><small>${pct1(c.margenTotal)}</small></div>
    </div>
    <div style="margin:8px 0">${badgeComparacion(c)}</div>
    <div class="docs-mini">${Object.entries(DOCS_VENTA).map(([k, t]) => d[k] ? `<button class="doc-chip doc-ok" onclick="descargarDocumentoVenta('${esc(l.id)}','${k}')" title="Descargar">✅ ${t}</button>` : `<span class="doc-chip">📎 ${t}: pendiente</span>`).join('')}
      <button class="btn btn-sm btn-outline-dark" onclick="abrirCierreVenta('${esc(l.id)}')">✏️ Editar cierre / adjuntar</button></div>`;
}
