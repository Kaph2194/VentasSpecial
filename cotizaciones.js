// =====================================================================
// COTIZACIONES — se crean en la app (PDF generado aquí y guardado en Drive)
// o se cargan (PDF / imagen del concesionario). Se descargan en PDF, se
// comparten por WhatsApp y se envían por correo con el PDF adjunto.
// =====================================================================

const ESTADOS_COT = { emitida: { t: 'Emitida', c: 'st-contactado' }, enviada: { t: 'Enviada', c: 'st-cita' }, aceptada: { t: 'Aceptada', c: 'st-facturado' }, rechazada: { t: 'Rechazada', c: 'st-perdido' } };
const CONDICIONES_COT = 'Precios en pesos colombianos sujetos a cambio sin previo aviso y a disponibilidad de inventario. ' +
  'La simulación de crédito es informativa: la tasa, el plazo y la cuota definitivos dependen de la aprobación de la entidad financiera. ' +
  'Esta cotización no constituye reserva ni separación del vehículo.';
let _cot = null;          // cotización en edición
let LOGO = null;          // img/logo-blanco.png convertido a dataURL para el PDF

const cotVencida = c => ['emitida', 'enviada'].includes(c.estado) && c.validaHasta && c.validaHasta < hoyISO();
function badgeCot(c) { const e = ESTADOS_COT[c.estado] || ESTADOS_COT.emitida; return cotVencida(c) ? '<span class="st st-perdido" title="Pasó la fecha de validez">Vencida</span>' : `<span class="st ${e.c}">${e.t}</span>`; }
function botonesCot(c) {
  return `<button class="btn-notif" onclick="descargarCotizacion('${esc(c.id)}')" title="Descargar PDF">⬇ PDF</button>
    <button class="btn-notif btn-wa-sm" onclick="compartirCotizacion('${esc(c.id)}')" title="Compartir por WhatsApp">📤</button>
    <button class="btn-notif" onclick="abrirEnvioCorreo('${esc(c.id)}')" title="Enviar por correo con el PDF adjunto">✉️</button>
    ${c.tipo !== 'cargada' ? `<button class="btn-notif" onclick="abrirFormCotizacion('${esc(c.leadId)}','${esc(c.id)}')" title="Editar">✏️</button>` : ''}`;
}

// ===== CÁLCULOS =====
function cuotaMensual(capital, tasaMesPct, meses) {
  capital = Number(capital) || 0; meses = Number(meses) || 0; const i = (Number(tasaMesPct) || 0) / 100;
  if (capital <= 0 || meses <= 0) return 0;
  return i ? capital * i / (1 - Math.pow(1 + i, -meses)) : capital / meses;
}
function calcularCot(c) {
  const acc = (c.accesorios || []).reduce((s, a) => s + (Number(a.valor) || 0), 0);
  c.totalAccesorios = acc;
  c.total = Math.max(0, (Number(c.precioLista) || 0) - (Number(c.descuento) || 0) + acc + (Number(c.tramites) || 0) + (Number(c.soat) || 0) + (Number(c.otros) || 0));
  const credito = /cr[eé]dito|leasing/i.test(c.formaPago || '');
  c.saldoFinanciar = credito ? Math.max(0, c.total - (Number(c.cuotaInicial) || 0) - (Number(c.retomaValor) || 0)) : 0;
  c.cuotaMensual = credito ? Math.round(cuotaMensual(c.saldoFinanciar, c.tasaMensual, c.plazoMeses)) : 0;
  c.validaHasta = sumarDias(c.fecha || hoyISO(), Number(c.validezDias) || VALIDEZ_COTIZACION);
  return c;
}

// ===== FORMULARIO =====
function abrirFormCotizacion(leadId, cotId) {
  const l = S.leads.find(x => x.id === leadId); if (!l) return;
  const prev = cotId ? S.cotizaciones.find(c => c.id === cotId) : null;
  _cot = prev ? JSON.parse(JSON.stringify(prev)) : {
    leadId, tipo: 'generada', fecha: hoyISO(), validezDias: VALIDEZ_COTIZACION, estado: 'emitida',
    cliente: { nombre: l.prospecto, documento: l.documento || '', telefono: l.telefono, correo: l.correo || '', ciudad: l.ciudad || '' },
    vehiculo: { marca: l.marca || '', referencia: l.referencia || '', version: l.version || '', modelo: String(new Date().getFullYear() + (new Date().getMonth() >= 9 ? 1 : 0)), color: '' },
    precioLista: l.valorEstimado || '', descuento: 0, accesorios: [], tramites: '', soat: '', otros: '', otrosDesc: '',
    formaPago: /cr[eé]dito/i.test(l.formaPago) ? 'Crédito' : /leasing/i.test(l.formaPago) ? 'Leasing' : 'Contado',
    entidad: '', cuotaInicial: '', retomaDesc: l.retoma || '', retomaValor: '', plazoMeses: 60, tasaMensual: 1.5,
    observaciones: '', condiciones: CONDICIONES_COT };
  const c = _cot, v = c.vehiculo, cl = c.cliente;
  const num = (id, val, ph) => `<input type="number" min="0" step="1000" id="${id}" value="${esc(val === 0 ? 0 : val || '')}" placeholder="${ph || '0'}" oninput="leerFormCot()"/>`;
  abrirModal(prev ? `Editar cotización ${esc(c.id)}` : `Nueva cotización — ${esc(l.id)} · ${esc(l.prospecto)}`, `
    <div class="cot-layout">
     <div class="cot-form">
      <div class="form-grid form-grid-3">
        <div class="form-group"><label>N° cotización</label><input value="${esc(c.id || 'Se asigna al guardar')}" disabled/></div>
        <div class="form-group"><label>Fecha</label><input type="date" id="cq_fecha" value="${esc(c.fecha)}" oninput="leerFormCot()"/></div>
        <div class="form-group"><label>Validez (días)</label><input type="number" min="1" max="90" id="cq_validez" value="${esc(c.validezDias)}" oninput="leerFormCot()"/></div>
      </div>
      <div class="form-sect">Cliente</div>
      <div class="form-grid form-grid-3">
        <div class="form-group span-2"><label>Nombre</label><input id="cq_cnombre" value="${esc(cl.nombre)}"/></div>
        <div class="form-group"><label>Cédula / NIT</label><input id="cq_cdoc" value="${esc(cl.documento)}"/></div>
        <div class="form-group"><label>Teléfono</label><input id="cq_ctel" value="${esc(cl.telefono)}"/></div>
        <div class="form-group"><label>Correo</label><input id="cq_ccorreo" value="${esc(cl.correo)}"/></div>
        <div class="form-group"><label>Ciudad</label><input id="cq_cciudad" value="${esc(cl.ciudad)}"/></div>
      </div>
      <div class="form-sect">Vehículo</div>
      <div class="form-grid form-grid-3">
        <div class="form-group"><label>Marca *</label><input id="cq_marca" list="dl-marcas" value="${esc(v.marca)}" oninput="actualizarDlReferencias('cq_marca','dl-refs')"/></div>
        <div class="form-group"><label>Referencia *</label><input id="cq_ref" list="dl-refs" value="${esc(v.referencia)}"/></div>
        <div class="form-group"><label>Versión</label><input id="cq_version" value="${esc(v.version)}" placeholder="Ej: Touring AT"/></div>
        <div class="form-group"><label>Año modelo</label><input id="cq_modelo" value="${esc(v.modelo)}"/></div>
        <div class="form-group"><label>Color</label><input id="cq_color" value="${esc(v.color)}"/></div>
      </div>
      <div class="form-sect">Valores</div>
      <div class="form-grid form-grid-3">
        <div class="form-group"><label>Precio de lista *</label>${num('cq_precio', c.precioLista)}</div>
        <div class="form-group"><label>Descuento</label>${num('cq_desc', c.descuento)}</div>
        <div class="form-group"><label>Matrícula y trámites</label>${num('cq_tram', c.tramites)}</div>
        <div class="form-group"><label>SOAT</label>${num('cq_soat', c.soat)}</div>
        <div class="form-group"><label>Otros cargos</label>${num('cq_otros', c.otros)}</div>
        <div class="form-group"><label>Descripción otros</label><input id="cq_otrosdesc" value="${esc(c.otrosDesc || '')}" placeholder="Ej: póliza todo riesgo" oninput="leerFormCot()"/></div>
      </div>
      <div class="cot-acc-head"><label>Accesorios</label><button class="btn btn-sm btn-outline-dark" onclick="leerFormCot();_cot.accesorios.push({desc:'',valor:''});pintarAccesorios()">+ Accesorio</button></div>
      <div id="cq_accesorios"></div>
      <div class="form-sect">Forma de pago</div>
      <div class="form-grid form-grid-3">
        <div class="form-group"><label>Forma de pago</label><select id="cq_pago" onchange="leerFormCot()">${['Contado', 'Crédito', 'Leasing'].map(f => `<option ${c.formaPago === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
        <div class="form-group cq-cred"><label>Entidad financiera</label><input id="cq_entidad" value="${esc(c.entidad)}" placeholder="Banco / financiera"/></div>
        <div class="form-group cq-cred"><label>Cuota inicial</label>${num('cq_inicial', c.cuotaInicial)}</div>
        <div class="form-group"><label>Retoma (vehículo usado)</label><input id="cq_retdesc" value="${esc(c.retomaDesc)}" placeholder="Ej: Spark GT 2018"/></div>
        <div class="form-group"><label>Valor retoma</label>${num('cq_retval', c.retomaValor)}</div>
        <div class="form-group cq-cred"><label>Plazo (meses)</label><input type="number" min="1" max="120" id="cq_plazo" value="${esc(c.plazoMeses)}" oninput="leerFormCot()"/></div>
        <div class="form-group cq-cred"><label>Tasa mes vencido (%)</label><input type="number" min="0" max="5" step="0.01" id="cq_tasa" value="${esc(c.tasaMensual)}" oninput="leerFormCot()"/></div>
      </div>
      <div class="form-group" style="margin-top:12px"><label>Observaciones (salen en el PDF)</label><textarea id="cq_obs" rows="2" placeholder="Bono de la marca, tiempo de entrega, garantía…">${esc(c.observaciones)}</textarea></div>
      <div class="form-group" style="margin-top:10px"><label>Condiciones</label><textarea id="cq_cond" rows="3">${esc(c.condiciones)}</textarea></div>
     </div>
     <div class="cot-resumen" id="cq_resumen"></div>
    </div>`,
    `<button class="btn btn-outline-dark" onclick="vistaPreviaCot()">👁 Vista previa</button>
     <button class="btn btn-primary-dark" onclick="guardarCotizacionForm(this)">💾 Guardar y descargar PDF</button>`, 'modal-xl');
  pintarAccesorios(); leerFormCot();
}
function pintarAccesorios() {
  $('cq_accesorios').innerHTML = (_cot.accesorios || []).map((a, i) => `<div class="cot-acc-row">
    <input placeholder="Descripción (ej: tapetes, polarizado, kit de carretera)" value="${esc(a.desc)}" oninput="_cot.accesorios[${i}].desc=this.value"/>
    <input type="number" min="0" step="1000" placeholder="Valor" value="${esc(a.valor)}" oninput="_cot.accesorios[${i}].valor=Number(this.value)||0;leerFormCot()"/>
    <button class="modal-close" title="Quitar" onclick="_cot.accesorios.splice(${i},1);pintarAccesorios();leerFormCot()">✕</button></div>`).join('') || '<div class="cell-n">Sin accesorios</div>';
}
function leerFormCot() {
  const c = _cot; if (!c || !$('cq_fecha')) return c;
  const v = id => ($(id) || {}).value || '', n = id => Number(v(id)) || 0;
  c.fecha = v('cq_fecha') || hoyISO(); c.validezDias = n('cq_validez') || VALIDEZ_COTIZACION;
  c.cliente = { nombre: v('cq_cnombre').trim(), documento: v('cq_cdoc').trim(), telefono: v('cq_ctel').trim(), correo: v('cq_ccorreo').trim(), ciudad: v('cq_cciudad').trim() };
  c.vehiculo = { marca: v('cq_marca').trim(), referencia: v('cq_ref').trim(), version: v('cq_version').trim(), modelo: v('cq_modelo').trim(), color: v('cq_color').trim() };
  c.precioLista = n('cq_precio'); c.descuento = n('cq_desc'); c.tramites = n('cq_tram'); c.soat = n('cq_soat'); c.otros = n('cq_otros'); c.otrosDesc = v('cq_otrosdesc').trim();
  c.formaPago = v('cq_pago'); c.entidad = v('cq_entidad').trim(); c.cuotaInicial = n('cq_inicial'); c.retomaDesc = v('cq_retdesc').trim(); c.retomaValor = n('cq_retval');
  c.plazoMeses = n('cq_plazo'); c.tasaMensual = Number(v('cq_tasa')) || 0; c.observaciones = v('cq_obs').trim(); c.condiciones = v('cq_cond').trim();
  c.accesorios = (c.accesorios || []).map(a => ({ desc: String(a.desc || '').trim(), valor: Number(a.valor) || 0 }));
  calcularCot(c);
  const cred = /cr[eé]dito|leasing/i.test(c.formaPago);
  document.querySelectorAll('.cq-cred').forEach(x => x.classList.toggle('hidden', !cred));
  const fila = (t, val, cls) => `<div class="cr-fila ${cls || ''}"><span>${t}</span><b>${val}</b></div>`;
  $('cq_resumen').innerHTML = `<div class="cr-tit">Resumen</div>
    ${fila('Precio de lista', fmtCOP(c.precioLista))}${c.descuento ? fila('Descuento', '− ' + fmtCOP(c.descuento), 'txt-g') : ''}
    ${c.totalAccesorios ? fila('Accesorios', fmtCOP(c.totalAccesorios)) : ''}${c.tramites ? fila('Matrícula y trámites', fmtCOP(c.tramites)) : ''}
    ${c.soat ? fila('SOAT', fmtCOP(c.soat)) : ''}${c.otros ? fila(esc(c.otrosDesc || 'Otros'), fmtCOP(c.otros)) : ''}
    ${fila('TOTAL', fmtCOP(c.total), 'cr-total')}
    ${cred ? `${c.cuotaInicial ? fila('Cuota inicial', '− ' + fmtCOP(c.cuotaInicial)) : ''}${c.retomaValor ? fila('Retoma', '− ' + fmtCOP(c.retomaValor)) : ''}
      ${fila('Saldo a financiar', fmtCOP(c.saldoFinanciar))}${fila(`Cuota estimada · ${c.plazoMeses || 0} meses al ${c.tasaMensual || 0}% MV`, fmtCOP(c.cuotaMensual), 'cr-cuota')}`
      : c.retomaValor ? fila('Retoma', '− ' + fmtCOP(c.retomaValor)) + fila('Saldo a pagar', fmtCOP(Math.max(0, c.total - c.retomaValor)), 'cr-cuota') : ''}
    <div class="td-sub" style="margin-top:10px">Válida hasta ${fmtD(c.validaHasta)}</div>`;
  return c;
}
function validarCot(c) {
  if (!c.vehiculo.marca || !c.vehiculo.referencia) return 'Indica la marca y la referencia del vehículo';
  if (!(c.precioLista > 0)) return 'Indica el precio de lista';
  if (!c.cliente.nombre) return 'Indica el nombre del cliente';
  if (c.descuento > c.precioLista) return 'El descuento no puede ser mayor que el precio';
  return null;
}
function vistaPreviaCot() {
  const c = leerFormCot(); const err = validarCot(c); if (err) { mostrarToast(err, 'error'); return; }
  const prev = Object.assign({}, c, { id: c.id || 'BORRADOR' });
  const url = URL.createObjectURL(generarPDFCotizacion(prev).output('blob'));
  const w = window.open(url, '_blank'); if (!w) descargarBlob(generarPDFCotizacion(prev).output('blob'), 'vista_previa.pdf');
}
async function guardarCotizacionForm(btn) {
  const c = leerFormCot(); const err = validarCot(c); if (err) { mostrarToast(err, 'error'); return; }
  await conEspera(btn, async () => {
    try {
      let cot = c;
      if (!cot.id) { const r1 = await api('guardarCotizacion', { cotizacion: cot }); cot = r1.cotizacion; upsertCotizacion(cot); upsertLead(r1.lead); }   // 1) número consecutivo
      const pdf = generarPDFCotizacion(cot);                                                                                                               // 2) PDF con el número
      const r2 = await api('guardarCotizacion', { cotizacion: cot, pdfBase64: pdf.output('datauristring').split(',')[1] });                                  // 3) PDF a Drive
      upsertCotizacion(r2.cotizacion); upsertLead(r2.lead); S.version = null;
      pdf.save(nombrePDF(r2.cotizacion));
      cerrarModal(); mostrarToast(`Cotización ${r2.cotizacion.id} guardada y descargada`, 'success');
      abrirFicha(cot.leadId, 'cotizaciones');
    } catch (e) { mostrarToast(e.message, 'error'); }
  });
}
const nombrePDF = c => `${c.id} ${(c.cliente || {}).nombre || ''} ${c.vehiculo.marca} ${c.vehiculo.referencia}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, '_') + '.pdf';

// ===== CARGAR UNA COTIZACIÓN EXISTENTE (PDF / imagen) =====
function abrirCargaCotizacion(leadId) {
  const l = S.leads.find(x => x.id === leadId); if (!l) return;
  abrirModal(`Cargar cotización — ${esc(l.id)} · ${esc(l.prospecto)}`, `
    <div class="form-group"><label>Archivo (PDF, JPG o PNG — máx. 8 MB) *</label><input type="file" id="cc_archivo" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"/></div>
    <div class="form-grid form-grid-3" style="margin-top:12px">
      <div class="form-group"><label>Marca *</label><input id="cc_marca" list="dl-marcas" value="${esc(l.marca || '')}" oninput="actualizarDlReferencias('cc_marca','dl-refs')"/></div>
      <div class="form-group"><label>Referencia *</label><input id="cc_ref" list="dl-refs" value="${esc(l.referencia || '')}"/></div>
      <div class="form-group"><label>Versión / año</label><input id="cc_version" value="${esc(l.version || '')}"/></div>
      <div class="form-group"><label>Valor total *</label><input type="number" min="0" step="1000" id="cc_total" value="${esc(l.valorEstimado || '')}"/></div>
      <div class="form-group"><label>Forma de pago</label><select id="cc_pago">${['Contado', 'Crédito', 'Leasing'].map(f => `<option>${f}</option>`).join('')}</select></div>
      <div class="form-group"><label>Fecha</label><input type="date" id="cc_fecha" value="${hoyISO()}"/></div>
      <div class="form-group"><label>Validez (días)</label><input type="number" id="cc_validez" value="${VALIDEZ_COTIZACION}"/></div>
    </div>
    <div class="form-group" style="margin-top:10px"><label>Observaciones</label><textarea id="cc_obs" rows="2"></textarea></div>
    <p class="nota-cal">El archivo queda guardado con un número de cotización consecutivo en la carpeta de Drive del lead y se puede descargar, compartir o enviar desde la app.</p>`,
    `<button class="btn btn-primary-dark" onclick="guardarCargaCotizacion('${esc(leadId)}',this)">⬆ Cargar</button>`, 'modal-md');
  actualizarDlReferencias('cc_marca', 'dl-refs');
}
async function guardarCargaCotizacion(leadId, btn) {
  const f = $('cc_archivo').files[0]; const l = S.leads.find(x => x.id === leadId);
  if (!f) { mostrarToast('Selecciona el archivo de la cotización', 'error'); return; }
  if (f.size > 8 * 1024 * 1024) { mostrarToast('El archivo supera 8 MB', 'error'); return; }
  const total = Number($('cc_total').value) || 0;
  if (!$('cc_marca').value.trim() || !$('cc_ref').value.trim() || !total) { mostrarToast('Marca, referencia y valor total son obligatorios', 'error'); return; }
  const c = { leadId, tipo: 'cargada', estado: 'emitida', fecha: $('cc_fecha').value || hoyISO(), validezDias: Number($('cc_validez').value) || VALIDEZ_COTIZACION,
    cliente: { nombre: l.prospecto, documento: l.documento || '', telefono: l.telefono, correo: l.correo || '', ciudad: l.ciudad || '' },
    vehiculo: { marca: $('cc_marca').value.trim(), referencia: $('cc_ref').value.trim(), version: $('cc_version').value.trim(), modelo: '', color: '' },
    precioLista: total, descuento: 0, accesorios: [], total, formaPago: $('cc_pago').value, observaciones: $('cc_obs').value.trim() };
  c.validaHasta = sumarDias(c.fecha, c.validezDias);
  await conEspera(btn, async () => {
    try {
      const base64 = await blobABase64(f);
      const r = await api('guardarCotizacion', { cotizacion: c, archivo: { nombre: f.name, mime: f.type || 'application/octet-stream', base64 } });
      upsertCotizacion(r.cotizacion); upsertLead(r.lead); S.version = null;
      cerrarModal(); mostrarToast(`Cotización ${r.cotizacion.id} cargada`, 'success'); abrirFicha(leadId, 'cotizaciones');
    } catch (e) { mostrarToast(e.message, 'error'); }
  });
}

// ===== DESCARGAR / COMPARTIR / ENVIAR =====
async function archivoCotizacion(c) {
  if (c.tipo !== 'cargada') return { blob: generarPDFCotizacion(c).output('blob'), nombre: nombrePDF(c) };
  const r = await api('obtenerArchivo', { cotizacionId: c.id });
  return { blob: base64ABlob(r.base64, r.mime), nombre: r.nombre || c.id };
}
async function descargarCotizacion(id) {
  const c = S.cotizaciones.find(x => x.id === id); if (!c) return;
  try { if (c.tipo === 'cargada') mostrarToast('Descargando archivo…', 'info'); const a = await archivoCotizacion(c); descargarBlob(a.blob, a.nombre); }
  catch (e) { mostrarToast(e.message, 'error'); }
}
function textoCotizacion(c) {
  const v = c.vehiculo;
  return `Hola ${String((c.cliente || {}).nombre || '').split(' ')[0]}, te comparto la cotización ${c.id} del ${[v.marca, v.referencia, v.version, v.modelo].filter(Boolean).join(' ')} por ${fmtCOP(c.total)}` +
    (c.cuotaMensual ? `, con cuota estimada de ${fmtCOP(c.cuotaMensual)} a ${c.plazoMeses} meses` : '') + `. Válida hasta el ${fmtD(c.validaHasta)}. Quedo atento a tus comentarios. ${S.usuario.nombre} — ${EMPRESA.nombre}`;
}
// En el celular abre el menú de compartir con el PDF adjunto (WhatsApp, correo…); en el computador descarga el PDF y abre WhatsApp con el mensaje.
async function compartirCotizacion(id) {
  const c = S.cotizaciones.find(x => x.id === id); if (!c) return;
  const l = S.leads.find(x => x.id === c.leadId) || {};
  try {
    const a = await archivoCotizacion(c);
    const file = new File([a.blob], a.nombre, { type: a.blob.type || 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: c.id, text: textoCotizacion(c) }); }
    else { descargarBlob(a.blob, a.nombre); window.open(linkWa((c.cliente || {}).telefono || l.telefono, textoCotizacion(c) + ' (te adjunto el PDF)'), '_blank'); mostrarToast('PDF descargado: adjúntalo en el chat de WhatsApp que se abrió', 'info'); }
  } catch (e) { if (e.name !== 'AbortError') mostrarToast(e.message, 'error'); }
}
function abrirEnvioCorreo(id) {
  const c = S.cotizaciones.find(x => x.id === id); if (!c) return;
  const v = c.vehiculo, para = (c.cliente || {}).correo || (S.leads.find(x => x.id === c.leadId) || {}).correo || '';
  const yo = S.usuarios.find(u => u.correo === S.usuario.correo) || S.usuario;
  abrirModal(`Enviar cotización ${esc(c.id)} por correo`, `
    <div class="form-group"><label>Para *</label><input id="ec_para" type="email" value="${esc(para)}" placeholder="correo del cliente"/></div>
    <div class="form-group" style="margin-top:10px"><label>Asunto</label><input id="ec_asunto" value="${esc(`Cotización ${c.id} — ${[v.marca, v.referencia, v.version].filter(Boolean).join(' ')}`)}"/></div>
    <div class="form-group" style="margin-top:10px"><label>Mensaje</label><textarea id="ec_msg" rows="9">${esc(`Buen día ${String((c.cliente || {}).nombre || '').split(' ')[0]},\n\nAdjunto encontrarás la cotización ${c.id} del ${[v.marca, v.referencia, v.version, v.modelo].filter(Boolean).join(' ')} por un valor total de ${fmtCOP(c.total)}${c.cuotaMensual ? `, con una cuota mensual estimada de ${fmtCOP(c.cuotaMensual)} a ${c.plazoMeses} meses` : ''}.\n\nLa cotización es válida hasta el ${fmtD(c.validaHasta)}. Quedo atento a tus comentarios o para agendar una prueba de manejo.\n\nCordialmente,\n${yo.nombre}\n${yo.cargo || 'Asesor comercial'} — ${EMPRESA.nombre}\n${yo.telefono || ''}\n${yo.correo}`)}</textarea></div>
    <p class="nota-cal">${MODO_DEMO ? 'En modo demo se abre tu programa de correo y se descarga el PDF para adjuntarlo.' : `Se envía con el PDF adjunto, con copia a tu correo (${esc(S.usuario.correo)}); si el cliente responde, la respuesta te llega a ti.`}</p>`,
    `<button class="btn btn-primary-dark" onclick="enviarCotizacionCorreo('${esc(id)}',this)">✉️ Enviar</button>`, 'modal-md');
}
async function enviarCotizacionCorreo(id, btn) {
  const para = $('ec_para').value.trim(), asunto = $('ec_asunto').value.trim(), mensaje = $('ec_msg').value;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) { mostrarToast('Revisa el correo del cliente', 'error'); return; }
  if (MODO_DEMO) {
    await descargarCotizacion(id);
    location.href = `mailto:${para}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`;
    const r = await api('enviarCotizacion', { cotizacionId: id, para, asunto, mensaje }); upsertCotizacion(r.cotizacion); upsertLead(r.lead); cerrarModal(); return;
  }
  await conEspera(btn, async () => {
    try { const r = await api('enviarCotizacion', { cotizacionId: id, para, asunto, mensaje }); upsertCotizacion(r.cotizacion); upsertLead(r.lead); S.version = null; cerrarModal(); mostrarToast(`Cotización enviada a ${para}`, 'success'); }
    catch (e) { mostrarToast(e.message, 'error'); }
  });
}
async function cambiarEstadoCot(id, sel) {
  const c = S.cotizaciones.find(x => x.id === id); if (!c) return;
  const nuevo = Object.assign({}, c, { estado: sel.value });
  try {
    const r = await api('guardarCotizacion', { cotizacion: nuevo }); upsertCotizacion(r.cotizacion); upsertLead(r.lead); S.version = null; renderVista();
    if (sel.value === 'aceptada') { const l = S.leads.find(x => x.id === c.leadId); if (l && EST[l.estado].i < EST.negociacion.i) setTimeout(() => pedirCambioEstado(l.id, 'negociacion'), 200); }
    mostrarToast(`${id}: ${ESTADOS_COT[sel.value].t}`, 'success');
  } catch (e) { sel.value = c.estado; mostrarToast(e.message, 'error'); }
}

// ===== VISTA COTIZACIONES =====
function renderCotizaciones() {
  const q = normTxt($('cBuscar').value), est = $('cEstado').value, com = $('cComercial').value, desde = $('cDesde').value, hasta = $('cHasta').value;
  const visibles = esAdmin() ? S.cotizaciones : S.cotizaciones.filter(c => c.comercial === S.usuario.correo);
  const lista = visibles.filter(c => {
    if (est === 'vencida' ? !cotVencida(c) : est && c.estado !== est) return false;
    if (com && c.comercial !== com) return false;
    if (desde && c.fecha < desde) return false; if (hasta && c.fecha > hasta) return false;
    if (q && !normTxt(`${c.id} ${c.leadId} ${(c.cliente || {}).nombre} ${c.vehiculo.marca} ${c.vehiculo.referencia} ${c.vehiculo.version}`).includes(q)) return false;
    return true;
  }).sort((a, b) => String(b.creado || b.fecha).localeCompare(String(a.creado || a.fecha)));
  $('c-count').textContent = `${lista.length} cotización(es) · ${fmtCOP(lista.reduce((s, c) => s + (Number(c.total) || 0), 0))}`;
  $('th-c-comercial').classList.toggle('hidden', !esAdmin());
  $('tbodyCot').innerHTML = lista.map(c => `<tr class="${cotVencida(c) ? 'fila-vencido' : ''}">
    <td class="td-id">${esc(c.id)}${c.tipo === 'cargada' ? '<div class="td-sub">Cargada</div>' : ''}</td><td>${fmtD(c.fecha)}</td><td>${fmtD(c.validaHasta)}</td>
    <td><a href="#lead=${esc(c.leadId)}" onclick="event.preventDefault();abrirFicha('${esc(c.leadId)}','cotizaciones')">${esc(c.leadId)}</a></td>
    <td class="td-nombre">${esc((c.cliente || {}).nombre || '')}</td>
    <td><b>${esc(c.vehiculo.marca)}</b> ${esc(c.vehiculo.referencia)}<div class="td-sub">${esc([c.vehiculo.version, c.vehiculo.modelo].filter(Boolean).join(' '))}</div></td>
    <td class="td-valor">${fmtCOP(c.total)}</td><td>${esc(c.formaPago || '—')}${c.cuotaMensual ? `<div class="td-sub">${fmtCOP(c.cuotaMensual)} × ${c.plazoMeses}</div>` : ''}</td>
    <td><select class="sel-st ${cotVencida(c) ? 'st-perdido' : (ESTADOS_COT[c.estado] || {}).c}" onchange="cambiarEstadoCot('${esc(c.id)}',this)">${Object.entries(ESTADOS_COT).map(([k, e]) => `<option value="${k}" ${k === c.estado ? 'selected' : ''}>${e.t}${k === c.estado && cotVencida(c) ? ' (vencida)' : ''}</option>`).join('')}</select></td>
    <td class="${esAdmin() ? '' : 'hidden'} td-sub2">${esc(nombreUsuario(c.comercial))}</td>
    <td class="td-acc">${botonesCot(c)}</td></tr>`).join('') || `<tr><td colspan="11" class="empty-msg">${visibles.length ? 'Sin resultados' : 'Aún no hay cotizaciones. Créalas desde la ficha de un lead (botón 📄 Cotizar).'}</td></tr>`;
}

// ===== PDF (jsPDF + AutoTable) =====
const txtPDF = s => String(s === null || s === undefined ? '' : s).replace(/ | /g, ' ').replace(/[^\x00-\xFF]/g, '');
const copPDF = n => txtPDF(fmtCOP(n));
function generarPDFCotizacion(c) {
  calcularCot(c);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 14;
  const azul = [44, 72, 135], azulOsc = [33, 62, 128], gris = [107, 114, 128];
  const com = S.usuarios.find(u => u.correo === c.comercial) || S.usuarios.find(u => u.correo === S.usuario.correo) || S.usuario;
  // Encabezado
  doc.setFillColor(...azul); doc.rect(0, 0, W, 32, 'F'); doc.setFillColor(...azulOsc); doc.rect(0, 32, W, 1.6, 'F');
  let x = M;
  if (LOGO) { try { const lh = 21, lw = LOGO.w * lh / LOGO.h; doc.addImage(LOGO.data, 'PNG', M, 5.5, lw, lh); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.3); doc.line(M + lw + 4, 8, M + lw + 4, 25); x = M + lw + 8; } catch (e) {} }
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(txtPDF(EMPRESA.nombre), x, 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  const lineaEmp = [EMPRESA.nit ? 'NIT ' + EMPRESA.nit : '', EMPRESA.direccion, EMPRESA.ciudad].filter(Boolean).join(' · ');
  const lineaEmp2 = [EMPRESA.telefono, EMPRESA.correo, EMPRESA.web].filter(Boolean).join(' · ');
  if (lineaEmp) doc.text(txtPDF(lineaEmp), x, 19); if (lineaEmp2) doc.text(txtPDF(lineaEmp2), x, 23.5);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('COTIZACIÓN', W - M, 12, { align: 'right' });
  doc.setFontSize(11); doc.text(txtPDF(c.id), W - M, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(txtPDF(`Fecha: ${fmtD(c.fecha)}   ·   Válida hasta: ${fmtD(c.validaHasta)}`), W - M, 24, { align: 'right' });
  // Cliente y vehículo
  const cl = c.cliente || {}, v = c.vehiculo || {};
  const caja = (tit, filas, x0, w) => {
    doc.setDrawColor(229, 231, 235); doc.setFillColor(249, 250, 251); doc.roundedRect(x0, 38, w, 34, 2, 2, 'FD');
    doc.setTextColor(...azul); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(tit, x0 + 4, 44);
    filas.forEach(([k, val], i) => { doc.setTextColor(...gris); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text(k, x0 + 4, 50 + i * 5);
      doc.setTextColor(31, 41, 55); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text(txtPDF(val || '-').slice(0, 48), x0 + 26, 50 + i * 5); });
  };
  const wc = (W - 2 * M - 6) / 2;
  caja('CLIENTE', [['Nombre', cl.nombre], ['Cédula / NIT', cl.documento], ['Teléfono', cl.telefono], ['Correo', cl.correo || cl.ciudad]], M, wc);
  caja('VEHÍCULO', [['Marca', v.marca], ['Referencia', v.referencia], ['Versión', [v.version, v.modelo].filter(Boolean).join(' · ')], ['Color', v.color]], M + wc + 6, wc);
  // Valores
  const filas = [['Precio de lista', copPDF(c.precioLista)]];
  if (c.descuento) filas.push(['Descuento', '- ' + copPDF(c.descuento)]);
  (c.accesorios || []).filter(a => a.valor || a.desc).forEach(a => filas.push(['Accesorio: ' + txtPDF(a.desc || 'sin descripción'), copPDF(a.valor)]));
  if (c.tramites) filas.push(['Matrícula y trámites', copPDF(c.tramites)]);
  if (c.soat) filas.push(['SOAT', copPDF(c.soat)]);
  if (c.otros) filas.push([txtPDF(c.otrosDesc || 'Otros cargos'), copPDF(c.otros)]);
  doc.autoTable({ startY: 78, head: [['Concepto', 'Valor']], body: filas, foot: [['TOTAL', copPDF(c.total)]], theme: 'grid', margin: { left: M, right: M },
    headStyles: { fillColor: azul, fontSize: 8.5 }, bodyStyles: { fontSize: 8.5, textColor: [31, 41, 55] }, footStyles: { fillColor: [233, 238, 248], textColor: azul, fontSize: 10.5, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', cellWidth: 48 } }, didParseCell: d => { if (d.section !== 'body' && d.column.index === 1) d.cell.styles.halign = 'right'; } });
  let y = doc.lastAutoTable.finalY + 7;
  // Forma de pago
  const cred = /cr[eé]dito|leasing/i.test(c.formaPago || '');
  const pago = [['Forma de pago', txtPDF(c.formaPago || 'Contado') + (c.entidad ? ' · ' + txtPDF(c.entidad) : '')]];
  if (c.retomaValor) pago.push(['Retoma' + (c.retomaDesc ? ': ' + txtPDF(c.retomaDesc) : ''), '- ' + copPDF(c.retomaValor)]);
  if (cred) {
    if (c.cuotaInicial) pago.push(['Cuota inicial', copPDF(c.cuotaInicial)]);
    pago.push(['Saldo a financiar', copPDF(c.saldoFinanciar)], ['Plazo / tasa', `${c.plazoMeses || 0} meses · ${String(c.tasaMensual || 0).replace('.', ',')}% mes vencido`], ['Cuota mensual estimada*', copPDF(c.cuotaMensual)]);
  } else if (c.retomaValor) pago.push(['Saldo a pagar', copPDF(Math.max(0, c.total - c.retomaValor))]);
  doc.autoTable({ startY: y, head: [['Forma de pago', '']], body: pago, theme: 'grid', margin: { left: M, right: M }, headStyles: { fillColor: azul, fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5, textColor: [31, 41, 55] }, columnStyles: { 1: { halign: 'right', cellWidth: 70 } },
    didParseCell: d => { if (d.section === 'body' && /Cuota mensual/.test(d.row.raw[0])) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [236, 253, 245]; } } });
  y = doc.lastAutoTable.finalY + 6;
  const parrafo = (tit, texto, tam) => {
    if (!texto) return; const lineas = doc.splitTextToSize(txtPDF(texto), W - 2 * M);
    if (y + 6 + lineas.length * 3.6 > H - 40) { doc.addPage(); y = 18; }
    doc.setTextColor(...azul); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text(tit, M, y);
    doc.setTextColor(55, 65, 81); doc.setFont('helvetica', 'normal'); doc.setFontSize(tam || 8); doc.text(lineas, M, y + 4.5); y += 6 + lineas.length * 3.6;
  };
  parrafo('Observaciones', c.observaciones, 8.5);
  parrafo('Condiciones', (cred ? '*' : '') + (c.condiciones || CONDICIONES_COT), 7.2);
  // Asesor
  if (y > H - 38) { doc.addPage(); y = 18; }
  y = Math.max(y + 4, H - 40);
  doc.setDrawColor(156, 163, 175); doc.line(M, y, M + 70, y);
  doc.setTextColor(31, 41, 55); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(txtPDF(com.nombre || ''), M, y + 5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...gris);
  doc.text(txtPDF([com.cargo || 'Asesor comercial', com.telefono, com.correo].filter(Boolean).join(' · ')), M, y + 9.5);
  // Pie
  const n = doc.internal.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFillColor(...azul); doc.rect(0, H - 4, W, 4, 'F'); doc.setFontSize(7); doc.setTextColor(...gris); doc.text(txtPDF(`${EMPRESA.nombre} · ${c.id}`), M, H - 8); doc.text(`Página ${i} de ${n}`, W - M, H - 8, { align: 'right' }); }
  doc.setProperties({ title: `Cotización ${c.id}`, author: txtPDF(com.nombre || EMPRESA.nombre), subject: txtPDF(`${v.marca} ${v.referencia}`) });
  return doc;
}
// Logo de Special Car (versión blanca) para el encabezado azul del PDF: img/logo-blanco.png
(function cargarLogo() {
  const img = new Image();
  img.onload = () => { try { const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight; cv.getContext('2d').drawImage(img, 0, 0); LOGO = { data: cv.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight }; } catch (e) {} };
  img.src = 'img/logo-blanco.png';
})();
