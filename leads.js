// =====================================================================
// LEADS — tabla / tablero por estado, ficha del prospecto, cambios de
// estado hasta la finalización, gestiones con próximo seguimiento y agenda.
// (Equivalente a "Placas", "Gestiones" y "Agenda" del módulo de Cartera.)
// =====================================================================

let leadsModo = 'tablero';               // 'tablero' (Kanban, por defecto) | 'tabla'
let leadsOrden = { campo: 'fechaSeguimiento', dir: 1 };
let leadsFiltrados = [];

// ===== FILTROS =====
// El backend ya entrega solo lo que el perfil puede ver (comercial: suyos · supervisor: su equipo · gerencia/admin: todo)
function leadsVisibles() { return S.leads; }
function filtrarLeads(ignorarEstado) {
  const q = normTxt($('lBuscar').value), est = $('lEstado').value, com = $('lComercial').value, marca = $('lMarca').value,
    origen = $('lOrigen').value, seg = $('lSeg').value, desde = $('lDesde').value, hasta = $('lHasta').value;
  return leadsVisibles().filter(l => {
    if (!ignorarEstado) {
      if (est === 'activos' && !esActivo(l)) return false;
      if (est === 'finales' && esActivo(l)) return false;
      if (est && EST[est] && l.estado !== est) return false;
    }
    if (com && l.comercial !== com) return false;
    if (marca && l.marca !== marca) return false;
    if (origen && l.origen !== origen) return false;
    if (desde && String(l.fechaContacto) < desde) return false;
    if (hasta && String(l.fechaContacto) > hasta) return false;
    if (seg) {
      const d = l.fechaSeguimiento ? diasR(l.fechaSeguimiento) : null;
      if (!esActivo(l)) return false;
      if (seg === 'vencido' && !(d !== null && d < 0)) return false;
      if (seg === 'hoy' && d !== 0) return false;
      if (seg === 'semana' && !(d !== null && d >= 0 && d <= 7)) return false;
      if (seg === 'sin' && l.fechaSeguimiento) return false;
      if (seg === 'singestion' && !(Date.now() - new Date(ultimaActividad(l)).getTime() > 3 * 86400000)) return false;
    }
    if (q && !normTxt(`${l.id} ${l.prospecto} ${l.telefono} ${l.correo} ${l.documento} ${l.marca} ${l.referencia} ${l.version} ${l.ciudad} ${nombreUsuario(l.comercial)}`).includes(q)) return false;
    return true;
  });
}
function ordenarLeads(campo) { leadsOrden = leadsOrden.campo === campo ? { campo, dir: -leadsOrden.dir } : { campo, dir: ['fechaContacto', 'id'].includes(campo) ? -1 : 1 }; renderTablaLeads(); }
function valorOrden(l, c) {
  if (c === 'fechaSeguimiento') return esActivo(l) ? (l.fechaSeguimiento ? l.fechaSeguimiento + (l.horaSeguimiento || '') : '9999') : 'zzzz';
  if (c === 'estado') return EST[l.estado].i;
  if (c === 'id') return Number(String(l.id).replace(/\D/g, '')) || 0;
  if (c === 'comercial') return nombreUsuario(l.comercial);
  return String(l[c] || '').toLowerCase();
}
function limpiarFiltrosLeads() { ['lBuscar', 'lComercial', 'lMarca', 'lOrigen', 'lSeg', 'lDesde', 'lHasta'].forEach(id => $(id).value = ''); $('lEstado').value = 'activos'; renderLeads(); }
function filtrarPorEstado(k) { const s = $('lEstado'); s.value = s.value === k ? 'activos' : k; renderLeads(); }
function filtrarSeg(k) { const s = $('lSeg'); s.value = s.value === k ? '' : k; renderLeads(); }
function cambiarModoLeads(m) { leadsModo = m; renderLeads(); }

// ===== VISTA LEADS =====
function renderLeads() {
  const mios = leadsVisibles(), act = mios.filter(esActivo);
  const venc = act.filter(l => l.fechaSeguimiento && diasR(l.fechaSeguimiento) < 0).length;
  const hoy = act.filter(l => l.fechaSeguimiento && diasR(l.fechaSeguimiento) === 0).length;
  const sin = act.filter(l => !l.fechaSeguimiento).length;
  const mes = hoyISO().slice(0, 7);
  $('k-activos').textContent = act.length;
  $('k-activos-sub').textContent = `${mios.filter(l => String(l.fechaContacto).slice(0, 7) === mes).length} nuevos este mes`;
  $('k-hoy').textContent = hoy; $('k-venc').textContent = venc; $('k-sin').textContent = sin;
  $('k-ventas').textContent = mios.filter(l => GANADOS.includes(l.estado) && String(l.fechaVenta || '').slice(0, 7) === mes).length;
  // chips del embudo (cuentan con los demás filtros aplicados)
  const base = filtrarLeads(true), est = $('lEstado').value;
  $('embudo-chips').innerHTML = ESTADOS.map(e => { const n = base.filter(l => l.estado === e.k).length;
    return `<button class="chip-est ${est === e.k ? 'activo' : ''} ${n ? '' : 'vacio'}" onclick="filtrarPorEstado('${e.k}')"><span class="st ${e.c}">${esc(e.t)}</span><b>${n}</b></button>`; }).join('');
  document.querySelectorAll('.kpi-click').forEach(k => k.classList.toggle('activo', k.dataset.seg === $('lSeg').value));
  $('btn-modo-tabla').classList.toggle('activo', leadsModo === 'tabla'); $('btn-modo-tablero').classList.toggle('activo', leadsModo === 'tablero');
  $('leads-tabla').classList.toggle('hidden', leadsModo !== 'tabla'); $('leads-tablero').classList.toggle('hidden', leadsModo !== 'tablero');
  $('sec-embudo').classList.toggle('hidden', leadsModo === 'tablero');
  $('lEstado').classList.toggle('hidden', leadsModo === 'tablero');   // en Kanban los estados son las columnas
  $('th-comercial').classList.toggle('hidden', !esAdmin());
  if (leadsModo === 'tabla') renderTablaLeads(); else renderTablero();
}
function renderTablaLeads() {
  leadsFiltrados = filtrarLeads();
  const { campo, dir } = leadsOrden;
  leadsFiltrados.sort((a, b) => { const x = valorOrden(a, campo), y = valorOrden(b, campo); return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * dir; });
  $('l-count').textContent = `${leadsFiltrados.length} lead(s)`;
  document.querySelectorAll('#tablaLeads th[data-ord]').forEach(th => { th.classList.toggle('ord-activo', th.dataset.ord === campo); th.dataset.dir = dir > 0 ? '▲' : '▼'; });
  const tb = $('tbodyLeads');
  if (!leadsVisibles().length) { tb.innerHTML = `<tr><td colspan="13" class="empty-msg">Aún no tienes leads.<br><br><button class="btn btn-primary-dark" onclick="abrirFormLead()">+ Crear el primer lead</button></td></tr>`; return; }
  if (!leadsFiltrados.length) { tb.innerHTML = '<tr><td colspan="13" class="empty-msg">Sin resultados con esos filtros</td></tr>'; return; }
  tb.innerHTML = leadsFiltrados.map(l => {
    const u = ultimaGestion(l), nc = cotizacionesDe(l.id).length;
    const d = l.fechaSeguimiento ? diasR(l.fechaSeguimiento) : null;
    return `<tr class="${!esActivo(l) ? (l.estado === 'perdido' ? 'fila-perdido' : 'fila-ganado') : d !== null && d < 0 ? 'fila-vencido' : ''}">
      <td class="td-id"><a href="#lead=${esc(l.id)}" onclick="event.preventDefault();abrirFicha('${esc(l.id)}')">${esc(l.id)}</a></td>
      <td class="td-nombre" onclick="abrirFicha('${esc(l.id)}')" title="${esc(l.prospecto)}">${esc(l.prospecto)}<div class="td-sub">${esc([l.ciudad, l.origen].filter(Boolean).join(' · '))}</div></td>
      <td class="td-contacto"><a href="${linkWa(l.telefono)}" target="_blank" rel="noopener" title="WhatsApp">${esc(l.telefono)}</a>${l.correo ? `<div class="td-sub">${esc(l.correo)}</div>` : ''}</td>
      <td>${fmtD(l.fechaContacto)}</td>
      <td>${badgeSeguimiento(l)}</td>
      <td><b>${esc(l.marca || '—')}</b></td>
      <td class="td-ref" title="${esc([l.referencia, l.version].filter(Boolean).join(' '))}">${esc(l.referencia || '—')}${l.version ? `<div class="td-sub">${esc(l.version)}</div>` : ''}</td>
      <td><select class="sel-st ${EST[l.estado].c}" onchange="cambiarEstadoRapido('${esc(l.id)}',this)">${ESTADOS.map(e => `<option value="${e.k}" ${e.k === l.estado ? 'selected' : ''} ${!puedeRetroceder() && esRetroceso(l.estado, e.k) ? 'disabled' : ''}>${esc(e.t)}</option>`).join('')}</select></td>
      <td class="${esAdmin() ? '' : 'hidden'} td-sub2">${esc(nombreUsuario(l.comercial))}</td>
      <td style="text-align:center">${nc ? `<button class="link-btn" onclick="abrirFicha('${esc(l.id)}','cotizaciones')">${nc}</button>` : '<span class="cell-n">0</span>'}</td>
      <td class="td-gestion" onclick="abrirFicha('${esc(l.id)}','gestion')">${u ? `<span class="res-tag ${CLASE_RES(u.resultado)}">${esc(u.resultado)}</span><div class="td-sub">${fmtFH(u.fecha)} · ${esc(u.medio || '')}</div>` : '<span class="cell-n">Sin gestión</span>'}</td>
      <td class="td-acc">
        <button class="btn-notif btn-gestion" onclick="abrirFicha('${esc(l.id)}','gestion')" title="Registrar llamada, WhatsApp, visita…">📞 Gestión</button>
        <button class="btn-notif" onclick="abrirFormCotizacion('${esc(l.id)}')" title="Nueva cotización">📄 Cotizar</button>
      </td></tr>`;
  }).join('');
}

// ===== TABLERO (kanban): arrastrar una tarjeta cambia el estado =====
function renderTablero() {
  // 10 columnas en 2 filas de 5: Nuevo → Entregado + Perdido. Entregados y perdidos: últimos 30 días.
  const hace30 = sumarDias(hoyISO(), -30);
  const base = filtrarLeads(true);
  const lista = base.filter(l => esActivo(l) || String(l.fechaCierre || l.fechaVenta || l.actualizado || '').slice(0, 10) >= hace30);
  const cols = ESTADOS;
  $('l-count').textContent = `${lista.filter(esActivo).length} activo(s)`;
  $('leads-tablero').innerHTML = `<div class="kb-leyenda"><span><i class="kb-dot kb-venc"></i>Seguimiento vencido</span><span><i class="kb-dot kb-hoy"></i>Para hoy</span><span><i class="kb-dot kb-sin"></i>Sin fecha</span><span class="td-sub">Clic en el nombre para gestionar · arrastra la tarjeta para cambiar de estado</span><span class="kb-perdidos"><button class="link-btn" onclick="verPerdidos()">Ver todos los perdidos</button></span></div><div class="kb-cols">` + cols.map(e => {
    const items = lista.filter(l => l.estado === e.k).sort((a, b) => valorOrden(a, 'fechaSeguimiento').localeCompare(valorOrden(b, 'fechaSeguimiento')));
    return `<div class="kb-col" data-estado="${e.k}" ondragover="event.preventDefault();this.classList.add('kb-over')" ondragleave="this.classList.remove('kb-over')" ondrop="soltarEnColumna(event,'${e.k}')">
      <div class="kb-tit"><span class="st ${e.c}">${esc(e.t)}</span><b>${items.length}</b></div>${FINALES.includes(e.k) ? '<div class="td-sub kb-nota">Últimos 30 días</div>' : ''}
      <div class="kb-items">${items.map(l => { const d = esActivo(l) && l.fechaSeguimiento ? diasR(l.fechaSeguimiento) : null;
        const cls = !esActivo(l) ? '' : !l.fechaSeguimiento ? 'kb-sin' : d < 0 ? 'kb-venc' : d === 0 ? 'kb-hoy' : '';
        const tip = `${l.id} · ${[l.marca, l.referencia].filter(Boolean).join(' ')}${veEquipo() ? ' · ' + nombreUsuario(l.comercial) : ''}${l.fechaSeguimiento && esActivo(l) ? ' · seguimiento ' + fmtD(l.fechaSeguimiento) : ''}`;
        return `<button class="kb-card ${cls}" draggable="true" title="${esc(tip)}" ondragstart="event.dataTransfer.setData('text/plain','${esc(l.id)}')" onclick="abrirFicha('${esc(l.id)}')">${esc(l.prospecto)}</button>`; }).join('') || '<div class="kb-vacio">—</div>'}</div></div>`;
  }).join('') + '</div>';
}
function verPerdidos() { leadsModo = 'tabla'; $('lEstado').value = 'perdido'; renderLeads(); }
function soltarEnColumna(ev, estado) {
  ev.preventDefault(); document.querySelectorAll('.kb-over').forEach(x => x.classList.remove('kb-over'));
  const id = ev.dataTransfer.getData('text/plain'); const l = S.leads.find(x => x.id === id);
  if (l && l.estado !== estado) pedirCambioEstado(id, estado);
}

// ===== CAMBIO DE ESTADO =====
function cambiarEstadoRapido(id, sel) {
  const l = S.leads.find(x => x.id === id); if (!l) return;
  const nuevo = sel.value; sel.value = l.estado;    // se aplica cuando el backend confirma
  pedirCambioEstado(id, nuevo);
}
// Pide nota (y motivo si es "Perdido") antes de cambiar el estado
function pedirCambioEstado(id, nuevo) {
  const l = S.leads.find(x => x.id === id); if (!l || l.estado === nuevo) return;
  const atras = esRetroceso(l.estado, nuevo);
  if (atras && !puedeRetroceder()) { mostrarToast(`No puedes devolver el lead a “${EST[nuevo].t}”: solo el supervisor o gerencia pueden hacerlo, con una justificación.`, 'error'); return; }
  // la venta pide el cierre: valor real, valor neto, membresía, meses de administración y documentos
  if ((!atras || !l.venta) && (nuevo === 'facturado' || (nuevo === 'entregado' && (!l.venta || docsFaltantes(l.venta).length)))) { abrirCierreVenta(id, nuevo); return; }
  const e = EST[nuevo], fin = FINALES.includes(nuevo);
  abrirModal(`Cambiar estado — ${esc(l.id)} · ${esc(l.prospecto)}`, `
    <div class="cambio-est">${badgeEstado(l.estado)} <span>${atras ? '↩' : '→'}</span> ${badgeEstado(nuevo)}</div>
    ${atras ? `<div class="aviso-retroceso">↩ <b>${l.estado === 'perdido' ? 'Reabrir un lead perdido' : 'Volver a un estado anterior'}</b>: queda registrado en el historial con tu nombre y la justificación.</div>
      <div class="form-group" style="margin-top:12px"><label>Justificación *</label><textarea id="ce_just" rows="2" placeholder="Ej: el banco negó el crédito y el cliente volvió a negociar otra referencia"></textarea></div>` : ''}
    ${nuevo === 'perdido' ? `<div class="form-group" style="margin-top:14px"><label>Motivo de pérdida *</label><select id="ce_motivo"><option value="">— Selecciona —</option>${MOTIVOS_PERDIDA.map(m => `<option ${l.motivoPerdida === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div>` : ''}
    <div class="form-group" style="margin-top:14px"><label>Nota (opcional)</label><textarea id="ce_nota" rows="2" placeholder="${nuevo === 'perdido' ? 'Ej: compró un Kia Sportage en otro concesionario' : nuevo === 'facturado' ? 'Ej: factura FV-1234, entrega programada' : 'Detalle del avance'}"></textarea></div>
    ${!fin ? `<div class="form-grid" style="margin-top:12px"><div class="form-group"><label>Próximo seguimiento</label><input type="date" id="ce_fecha" value="${esc(l.fechaSeguimiento && diasR(l.fechaSeguimiento) >= 0 ? l.fechaSeguimiento : sumarDias(hoyISO(), 2))}"/></div>
      <div class="form-group"><label>Hora</label><input type="time" id="ce_hora" value="${esc(l.horaSeguimiento || '09:00')}"/></div></div>`
      : `<p class="nota-cal">${nuevo === 'perdido' ? '✖ El lead se cierra como <b>perdido</b>' : '✅ El lead finaliza como <b>venta entregada</b>'}: se cancela el seguimiento pendiente en el calendario.</p>`}`,
    `<button class="btn btn-primary-dark" onclick="confirmarCambioEstado('${esc(id)}','${nuevo}',this)">Cambiar a “${esc(e.t)}”</button>`, 'modal-md');
}
async function confirmarCambioEstado(id, nuevo, btn) {
  const orig = S.leads.find(x => x.id === id); if (!orig) return;
  const l = JSON.parse(JSON.stringify(orig));
  const nota = ($('ce_nota') || {}).value || '';
  if (nuevo === 'perdido') { const m = $('ce_motivo').value; if (!m) { mostrarToast('Selecciona el motivo de pérdida', 'error'); return; } l.motivoPerdida = m; }
  else delete l.motivoPerdida;
  const atras = esRetroceso(orig.estado, nuevo), just = (($('ce_just') || {}).value || '').trim();
  if (atras && just.length < 10) { mostrarToast('Escribe la justificación (mínimo 10 caracteres)', 'error'); return; }
  if (atras) l.justificacionRetroceso = just;
  if ($('ce_fecha')) { l.fechaSeguimiento = $('ce_fecha').value || ''; l.horaSeguimiento = $('ce_hora').value || ''; }
  l.historial = (l.historial || []).concat([{ id: uid('H'), fecha: ahoraISO(), de: l.estado, a: nuevo, nota: (atras ? '↩ Retroceso autorizado: ' + just + (nota.trim() ? ' · ' : '') : '') + nota.trim() + (nuevo === 'perdido' ? (nota.trim() ? ' · ' : '') + 'Motivo: ' + l.motivoPerdida : ''), usuario: S.usuario.correo }]);
  l.estado = nuevo;
  await conEspera(btn, async () => {
    try { await guardarLeadRemoto(l); cerrarModal(); mostrarToast(`${l.id}: ${EST[nuevo].t}`, 'success'); if (nuevo === 'facturado') sugerirSiguiente(l.id); }
    catch (e) { mostrarToast(e.message, 'error'); }
  });
}
function sugerirSiguiente(id) { setTimeout(() => mostrarToast('🎉 ¡Venta facturada! Cuando entregues el vehículo, pasa el lead a “Entregado” para finalizarlo.', 'success'), 400); }

// ===== FORMULARIO NUEVO / EDITAR LEAD =====
function abrirFormLead(id) {
  const l = id ? JSON.parse(JSON.stringify(S.leads.find(x => x.id === id))) : {
    fechaContacto: hoyISO(), estado: 'nuevo', origen: '', formaPago: 'Por definir', fechaSeguimiento: sumarDias(hoyISO(), 1), horaSeguimiento: '09:00', comercial: S.usuario.correo };
  const coms = asignables().concat(S.usuarios.filter(u => u.correo === l.comercial && !asignables().includes(u)));
  abrirModal(id ? `Editar lead ${esc(l.id)}` : 'Nuevo lead', `
    <input type="hidden" id="lf_id" value="${esc(l.id || '')}"/>
    <div class="form-sect">Prospecto</div>
    <div class="form-grid form-grid-3">
      <div class="form-group"><label># Lead *</label><input id="lf_numero" value="${esc(l.id || '')}" ${id ? 'disabled title="El número del lead no se cambia después de creado"' : ''} placeholder="Número en la app de origen" maxlength="30" autocomplete="off"/></div>
      <div class="form-group span-2"><label>Nombre del prospecto *</label><input id="lf_prospecto" value="${esc(l.prospecto || '')}" placeholder="Nombre y apellido"/></div>
      <div class="form-group"><label>Teléfono / celular *</label><input id="lf_tel" type="tel" value="${esc(l.telefono || '')}" placeholder="300 123 4567"/></div>
      <div class="form-group"><label>Correo</label><input id="lf_correo" type="email" value="${esc(l.correo || '')}"/></div>
      <div class="form-group"><label>Cédula / NIT</label><input id="lf_doc" value="${esc(l.documento || '')}"/></div>
      <div class="form-group"><label>Ciudad</label>${htmlCiudad('lf_ciudad', l.ciudad)}</div>
      <div class="form-group"><label>Fecha de contacto *</label><input id="lf_fcontacto" type="date" value="${esc(l.fechaContacto || hoyISO())}"/></div>
      <div class="form-group"><label>Origen del lead</label><select id="lf_origen"><option value="">— Selecciona —</option>${(l.origen && !ORIGENES.includes(l.origen) ? [l.origen] : []).concat(ORIGENES).map(o => `<option ${l.origen === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>
    </div>
    <div class="form-sect">Vehículo de interés</div>
    <div class="form-grid form-grid-3">
      <div class="form-group"><label>Marca del vehículo *</label><input id="lf_marca" list="dl-marcas" value="${esc(l.marca || '')}" oninput="actualizarDlReferencias('lf_marca','dl-refs')" placeholder="Ej: Mazda"/></div>
      <div class="form-group"><label>Referencia del vehículo *</label><input id="lf_ref" list="dl-refs" value="${esc(l.referencia || '')}" placeholder="Ej: CX-30"/></div>
      <div class="form-group"><label>Versión / año modelo</label><input id="lf_version" value="${esc(l.version || '')}" placeholder="Ej: Grand Touring 2026"/></div>
      <div class="form-group"><label>Valor estimado (COP)</label><input id="lf_valor" type="number" min="0" step="100000" value="${esc(l.valorEstimado || '')}"/></div>
      <div class="form-group"><label>Forma de pago</label><select id="lf_pago">${FORMAS_PAGO.map(f => `<option ${l.formaPago === f ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Vehículo de retoma</label><input id="lf_retoma" value="${esc(l.retoma || '')}" placeholder="Ej: Chevrolet Spark 2018"/></div>
    </div>
    <div class="form-sect">Seguimiento</div>
    <div class="form-grid form-grid-3">
      <div class="form-group"><label>Estado</label><select id="lf_estado" ${id ? 'disabled title="Cámbialo desde la ficha o la tabla para que quede en el historial"' : ''}>${ESTADOS.filter(e => !FINALES.includes(e.k) || l.estado === e.k).map(e => `<option value="${e.k}" ${e.k === l.estado ? 'selected' : ''}>${esc(e.t)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Fecha de seguimiento ${esActivo(l) ? '*' : ''}</label><input id="lf_fseg" type="date" value="${esc(l.fechaSeguimiento || '')}"/></div>
      <div class="form-group"><label>Hora (opcional)</label><input id="lf_hseg" type="time" value="${esc(l.horaSeguimiento || '')}"/></div>
      ${esAdmin() ? `<div class="form-group"><label>Comercial asignado</label><select id="lf_comercial">${coms.map(u => `<option value="${esc(u.correo)}" ${u.correo === l.comercial ? 'selected' : ''}>${esc(u.nombre)}</option>`).join('')}</select></div>` : ''}
    </div>
    <div class="form-group" style="margin-top:12px"><label>Observaciones</label><textarea id="lf_obs" rows="2" placeholder="Necesidad, color preferido, presupuesto, quién decide la compra…">${esc(l.observaciones || '')}</textarea></div>
    <p class="nota-cal">📅 La fecha de seguimiento se agenda en ${veEquipo() ? 'el calendario del comercial asignado' : 'tu calendario'} (invitación a ${esc(esAdmin() ? 'su' : 'tu')} correo) con recordatorio.${MODO_DEMO ? ' <b>En modo demo</b> usa el botón 📅 de la agenda para agregarlo.' : ''}</p>`,
    `<button class="btn btn-primary-dark" onclick="guardarFormLead(this)">💾 ${id ? 'Guardar cambios' : 'Crear lead'}</button>`);
  actualizarDlReferencias('lf_marca', 'dl-refs');
  if (!id) setTimeout(() => { const ae = document.activeElement; if (!ae || !ae.closest('#modal') || ae.tagName === 'BUTTON') $('lf_numero').focus(); }, 60);
}
function actualizarDlReferencias(inputId, dlId) { const m = ($(inputId) || {}).value || ''; $(dlId).innerHTML = referenciasDe(m).map(r => `<option value="${esc(r)}">`).join(''); }
async function guardarFormLead(btn) {
  const id = $('lf_id').value; const previo = id ? S.leads.find(x => x.id === id) : null;
  const l = previo ? JSON.parse(JSON.stringify(previo)) : { historial: [], seguimientos: [] };
  const v = k => ($(k) || {}).value !== undefined ? $(k).value.trim() : '';
  Object.assign(l, { prospecto: v('lf_prospecto'), telefono: v('lf_tel'), correo: v('lf_correo').toLowerCase(), documento: v('lf_doc'), ciudad: v('lf_ciudad'),
    fechaContacto: v('lf_fcontacto'), origen: v('lf_origen'), marca: v('lf_marca'), referencia: v('lf_ref'), version: v('lf_version'),
    valorEstimado: Number(v('lf_valor')) || 0, formaPago: v('lf_pago'), retoma: v('lf_retoma'), fechaSeguimiento: v('lf_fseg'), horaSeguimiento: v('lf_hseg'), observaciones: v('lf_obs') });
  if (!previo) {
    l.estado = v('lf_estado') || 'nuevo';
    // número del lead tal como viene de la app de origen (KOMMO, campaña, formulario…)
    const num = v('lf_numero').replace(/\s+/g, '');
    if (!num) { mostrarToast('Escribe el # del lead (el número que trae de la app de origen)', 'error'); $('lf_numero').focus(); return; }
    if (!/^[A-Za-z0-9#._-]{1,30}$/.test(num)) { mostrarToast('El # del lead solo admite letras, números y . _ - #', 'error'); return; }
    const ya = S.leads.find(x => String(x.id).toLowerCase() === num.toLowerCase());
    if (ya) { mostrarToast(`Ya existe el lead #${ya.id} (${ya.prospecto}, ${nombreUsuario(ya.comercial)})`, 'error'); return; }
    l.id = num; l.nuevo = true;
  }
  if ($('lf_comercial')) l.comercial = $('lf_comercial').value; else if (!previo) l.comercial = S.usuario.correo;
  const falta = [['prospecto', 'el nombre del prospecto'], ['telefono', 'el teléfono'], ['fechaContacto', 'la fecha de contacto'], ['marca', 'la marca'], ['referencia', 'la referencia']].find(([k]) => !l[k]);
  if (falta) { mostrarToast(`Falta ${falta[1]}`, 'error'); return; }
  if (String(l.telefono).replace(/\D/g, '').length < 7) { mostrarToast('Revisa el teléfono', 'error'); return; }
  if (l.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(l.correo)) { mostrarToast('Revisa el correo del prospecto', 'error'); return; }
  if (esActivo(l) && !l.fechaSeguimiento) { mostrarToast('Indica la fecha de seguimiento', 'error'); return; }
  if (!previo) { // posible duplicado por teléfono
    const dup = S.leads.find(x => esActivo(x) && telWa(x.telefono) === telWa(l.telefono));
    if (dup && !confirm(`Ya existe el lead activo ${dup.id} (${dup.prospecto}, ${nombreUsuario(dup.comercial)}) con ese teléfono. ¿Crear otro de todas formas?`)) return;
  }
  await conEspera(btn, async () => {
    try {
      const g = await guardarLeadRemoto(l);
      cerrarModal(); mostrarToast(previo ? `Lead ${g.id} actualizado` : `Lead ${g.id} creado y agendado`, 'success');
      if (!previo) abrirFicha(g.id);
    } catch (e) { mostrarToast(e.message, 'error'); }
  });
}

// ===== FICHA DEL LEAD =====
function abrirFicha(id, foco) {
  const l = S.leads.find(x => x.id === id); if (!l) { mostrarToast('No se encontró el lead ' + id, 'error'); return; }
  history.replaceState(null, '', '#lead=' + id);
  const act = esActivo(l), cots = cotizacionesDe(id), idxE = EST[l.estado].i;
  const pasos = ESTADOS.filter(e => e.k !== 'perdido').map(e => EST[e.k]);
  const timeline = [].concat((l.historial || []).map(h => ({ f: h.fecha, tipo: 'estado', h })), (l.seguimientos || []).map(s => ({ f: s.fecha, tipo: 'gestion', s })))
    .sort((a, b) => String(b.f).localeCompare(String(a.f)));
  const saludo = `Hola ${String(l.prospecto).split(' ')[0]}, te saluda ${S.usuario.nombre} de ${EMPRESA.nombre}. `;
  abrirModal(`<span class="td-id">${esc(l.id)}</span> ${esc(l.prospecto)} ${badgeEstado(l.estado)}`, `
    <div class="ficha-top">
      <div class="ficha-datos">
        <div><a class="btn btn-sm btn-wa" href="${linkWa(l.telefono, saludo)}" target="_blank" rel="noopener">WhatsApp ${esc(l.telefono)}</a>
          <a class="btn btn-sm btn-outline-dark" href="tel:${esc(String(l.telefono).replace(/\s/g, ''))}">📞 Llamar</a>
          ${l.correo ? `<a class="btn btn-sm btn-outline-dark" href="mailto:${esc(l.correo)}">✉️ ${esc(l.correo)}</a>` : ''}</div>
        <div class="ficha-grid">
          <div><label>Vehículo</label><b>${esc([l.marca, l.referencia].filter(Boolean).join(' ') || '—')}</b>${l.version ? `<small>${esc(l.version)}</small>` : ''}</div>
          <div><label>Fecha de contacto</label><b>${fmtD(l.fechaContacto)}</b><small>${esc(l.origen || 'Origen sin definir')}</small></div>
          <div><label>Próximo seguimiento</label><b>${badgeSeguimiento(l)}</b></div>
          <div><label>Comercial</label><b>${esc(nombreUsuario(l.comercial))}</b><small>${esc(l.comercial)}</small></div>
          <div><label>Forma de pago</label><b>${esc(l.formaPago || '—')}</b>${l.retoma ? `<small>Retoma: ${esc(l.retoma)}</small>` : ''}</div>
          <div><label>Valor estimado</label><b>${l.valorEstimado ? fmtCOP(l.valorEstimado) : '—'}</b>${l.documento ? `<small>CC/NIT ${esc(l.documento)}</small>` : ''}</div>
        </div>
        ${l.observaciones ? `<div class="ficha-obs">📝 ${esc(l.observaciones)}</div>` : ''}
        ${l.estado === 'perdido' ? `<div class="ficha-obs txt-r">✖ Perdido: ${esc(l.motivoPerdida || '')}</div>` : ''}
      </div>
    </div>
    <div class="stepper">${pasos.map(e => `<button class="paso ${e.i < idxE && l.estado !== 'perdido' ? 'hecho' : ''} ${e.k === l.estado ? 'actual' : ''} ${!puedeRetroceder() && esRetroceso(l.estado, e.k) ? 'bloqueado' : ''}" onclick="pedirCambioEstado('${esc(l.id)}','${e.k}')" title="${!puedeRetroceder() && esRetroceso(l.estado, e.k) ? 'Solo supervisor o gerencia pueden volver a un estado anterior' : 'Cambiar a ' + esc(e.t)}"><span>${e.i + 1}</span>${esc(e.t)}</button>`).join('')}
      <button class="paso paso-perdido ${l.estado === 'perdido' ? 'actual' : ''}" onclick="pedirCambioEstado('${esc(l.id)}','perdido')">✖ Perdido</button></div>

    ${act ? `<div class="form-sect" id="sec-gestion">Registrar gestión</div>
    <div class="gest-rapida">
      <span class="td-sub">Rápido:</span>
      <button class="btn btn-sm btn-outline-dark" onclick="gestionRapida('${esc(l.id)}','Llamada','No contestó',this)">📵 No contestó</button>
      <button class="btn btn-sm btn-outline-dark" onclick="gestionRapida('${esc(l.id)}','WhatsApp','Interesado',this)">💬 Respondió por WhatsApp</button>
    </div>
    <div class="form-grid form-grid-4" style="margin-top:10px">
      <div class="form-group"><label>Medio</label><select id="gs_medio">${MEDIOS.map(m => `<option>${esc(m)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Resultado *</label><select id="gs_res"><option value="">— Selecciona —</option>${RESULTADOS.map(r => `<option>${esc(r.t)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Próximo seguimiento</label><input type="date" id="gs_fecha" value="${sumarDias(hoyISO(), 2)}"/></div>
      <div class="form-group"><label>Hora</label><input type="time" id="gs_hora" value="${esc(l.horaSeguimiento || '09:00')}"/></div>
    </div>
    <div class="form-grid" style="margin-top:10px;grid-template-columns:2fr 1fr">
      <div class="form-group"><label>Detalle</label><textarea id="gs_nota" rows="2" placeholder="Qué se habló, objeciones, compromisos…"></textarea></div>
      <div class="form-group"><label>Avanzar estado a</label><select id="gs_estado"><option value="">Mantener: ${esc(EST[l.estado].t)}</option>${ESTADOS.filter(e => !FINALES.includes(e.k) && !GANADOS.includes(e.k) && e.k !== l.estado && !esRetroceso(l.estado, e.k)).map(e => `<option value="${e.k}">${esc(e.t)}</option>`).join('')}</select></div>
    </div>
    <div class="gest-envio"><button class="btn btn-primary-dark" onclick="guardarGestion('${esc(l.id)}',this)">💾 Guardar gestión y agendar</button>
      ${l.fechaSeguimiento ? `<a class="btn btn-sm btn-outline-dark" href="${urlGoogleCalendar(l)}" target="_blank" rel="noopener" title="Agregar el seguimiento actual a Google Calendar">📅 Google Calendar</a><button class="btn btn-sm btn-outline-dark" onclick="descargarICS('${esc(l.id)}')" title="Para Outlook / iPhone">📅 .ics</button>` : ''}</div>` : ''}

    ${htmlVentaFicha(l)}
    <div class="form-sect" id="sec-cotizaciones">Cotizaciones (${cots.length})</div>
    <div class="gest-envio" style="margin:0 0 10px"><button class="btn btn-sm btn-primary-dark" onclick="abrirFormCotizacion('${esc(l.id)}')">📄 Nueva cotización</button>
      <button class="btn btn-sm btn-outline-dark" onclick="abrirCargaCotizacion('${esc(l.id)}')">⬆ Cargar cotización (PDF / imagen)</button></div>
    ${cots.length ? `<table class="tabla-mini"><thead><tr><th>N°</th><th>Fecha</th><th>Vehículo</th><th style="text-align:right">Total</th><th>Pago</th><th>Estado</th><th></th></tr></thead><tbody>
      ${cots.map(c => `<tr><td><b>${esc(c.id)}</b>${c.tipo === 'cargada' ? '<div class="td-sub">Cargada</div>' : ''}</td><td>${fmtD(c.fecha)}</td><td>${esc([c.vehiculo.marca, c.vehiculo.referencia, c.vehiculo.version].filter(Boolean).join(' '))}</td>
        <td style="text-align:right"><b>${fmtCOP(c.total)}</b></td><td>${esc(c.formaPago || '—')}</td><td>${badgeCot(c)}</td>
        <td class="td-acc">${botonesCot(c)}</td></tr>`).join('')}</tbody></table>` : '<div class="cell-n" style="padding:6px 0 4px">Aún no hay cotizaciones para este lead.</div>'}

    <div class="form-sect">Historial (${timeline.length})</div>
    <div class="timeline">${timeline.map(x => x.tipo === 'estado' ? `<div class="tl-item tl-estado"><div class="tl-f">${fmtFH(x.f)}</div><div>${x.h.de ? badgeEstado(x.h.de) + ' → ' : ''}${badgeEstado(x.h.a)} ${x.h.nota ? `<div class="tl-nota">${esc(x.h.nota)}</div>` : ''}<div class="td-sub">${esc(nombreUsuario(x.h.usuario))}</div></div></div>`
      : `<div class="tl-item"><div class="tl-f">${fmtFH(x.f)}<small>${esc(x.s.medio || '')}</small></div><div><span class="res-tag ${CLASE_RES(x.s.resultado)}">${esc(x.s.resultado)}</span>${x.s.nota ? `<div class="tl-nota">${esc(x.s.nota)}</div>` : ''}${x.s.proximaFecha ? `<div class="td-sub">Próximo seguimiento: ${fmtD(x.s.proximaFecha)} ${esc(x.s.proximaHora || '')}</div>` : ''}<div class="td-sub">${esc(nombreUsuario(x.s.usuario))}</div></div></div>`).join('') || '<div class="cell-n">Sin movimientos</div>'}</div>`,
    `<button class="btn btn-outline-dark" onclick="abrirFormLead('${esc(l.id)}')">✏️ Editar datos</button>`);
  if (foco) setTimeout(() => { const s = $(foco === 'cotizaciones' ? 'sec-cotizaciones' : foco === 'venta' ? 'sec-venta' : 'sec-gestion'); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
}

// ===== GESTIONES =====
async function guardarGestion(id, btn) {
  const orig = S.leads.find(x => x.id === id); if (!orig) return;
  const res = $('gs_res').value, nota = $('gs_nota').value.trim(), fecha = $('gs_fecha').value, hora = $('gs_hora').value, nuevoEst = $('gs_estado').value;
  if (!res) { mostrarToast('Selecciona el resultado de la gestión', 'error'); return; }
  if (!fecha) { mostrarToast('Indica la fecha del próximo seguimiento', 'error'); return; }
  const l = JSON.parse(JSON.stringify(orig));
  l.seguimientos = (l.seguimientos || []).concat([{ id: uid('S'), fecha: ahoraISO(), medio: $('gs_medio').value, resultado: res, nota, proximaFecha: fecha, proximaHora: hora, usuario: S.usuario.correo }]);
  l.fechaSeguimiento = fecha; l.horaSeguimiento = hora;
  if (nuevoEst) { l.historial = (l.historial || []).concat([{ id: uid('H'), fecha: ahoraISO(), de: l.estado, a: nuevoEst, nota: res + (nota ? ' — ' + nota : ''), usuario: S.usuario.correo }]); l.estado = nuevoEst; }
  else if (l.estado === 'nuevo' && !/no contest|errado/i.test(res)) { l.historial = (l.historial || []).concat([{ id: uid('H'), fecha: ahoraISO(), de: 'nuevo', a: 'contactado', nota: 'Primer contacto: ' + res, usuario: S.usuario.correo }]); l.estado = 'contactado'; }
  await conEspera(btn, async () => {
    try { await guardarLeadRemoto(l); mostrarToast(`Gestión guardada · próximo seguimiento ${fmtD(fecha)}${hora ? ' ' + hora : ''}`, 'success'); abrirFicha(id); }
    catch (e) { mostrarToast(e.message, 'error'); }
  });
}
async function gestionRapida(id, medio, res, btn) {
  const orig = S.leads.find(x => x.id === id); if (!orig) return;
  const l = JSON.parse(JSON.stringify(orig));
  const prox = res === 'No contestó' ? sumarDias(hoyISO(), 1) : (l.fechaSeguimiento && diasR(l.fechaSeguimiento) > 0 ? l.fechaSeguimiento : sumarDias(hoyISO(), 2));
  l.seguimientos = (l.seguimientos || []).concat([{ id: uid('S'), fecha: ahoraISO(), medio, resultado: res, nota: '', proximaFecha: prox, proximaHora: l.horaSeguimiento || '', usuario: S.usuario.correo }]);
  l.fechaSeguimiento = prox;
  if (l.estado === 'nuevo' && res !== 'No contestó') { l.historial = (l.historial || []).concat([{ id: uid('H'), fecha: ahoraISO(), de: 'nuevo', a: 'contactado', nota: 'Primer contacto', usuario: S.usuario.correo }]); l.estado = 'contactado'; }
  await conEspera(btn, async () => {
    try { await guardarLeadRemoto(l); mostrarToast(`${res} · se reagendó para ${fmtD(prox)}`, 'success'); abrirFicha(id); }
    catch (e) { mostrarToast(e.message, 'error'); }
  });
}

// ===== AGENDA =====
function renderAgenda() {
  const com = $('aComercial').value, dias = Number($('aDias').value) || 7;
  const lim = sumarDias(hoyISO(), dias);
  const base = leadsVisibles().filter(l => esActivo(l) && (!com || l.comercial === com));
  const items = base.filter(l => l.fechaSeguimiento && l.fechaSeguimiento <= lim).sort((a, b) => (a.fechaSeguimiento + (a.horaSeguimiento || '99')).localeCompare(b.fechaSeguimiento + (b.horaSeguimiento || '99')));
  const sinFecha = base.filter(l => !l.fechaSeguimiento);
  const grupos = {};
  items.forEach(l => { const k = l.fechaSeguimiento < hoyISO() ? '__venc' : l.fechaSeguimiento; (grupos[k] = grupos[k] || []).push(l); });
  const item = (l, venc) => { const u = ultimaGestion(l); return `<div class="agenda-item">
      <span class="agenda-hora">${venc ? fmtD(l.fechaSeguimiento) : esc(l.horaSeguimiento || 'Todo el día')}</span>
      <span class="td-id" onclick="abrirFicha('${esc(l.id)}')">${esc(l.id)}</span>
      <span class="agenda-nombre" onclick="abrirFicha('${esc(l.id)}')"><b>${esc(l.prospecto)}</b><small>${esc([l.marca, l.referencia].filter(Boolean).join(' '))}${esAdmin() ? ' · 👤 ' + esc(nombreUsuario(l.comercial)) : ''}</small></span>
      ${badgeEstado(l.estado)}
      <span class="agenda-ult">${u ? `<span class="res-tag ${CLASE_RES(u.resultado)}">${esc(u.resultado)}</span>` : '<span class="cell-n">Sin gestión</span>'}</span>
      <span class="agenda-acc"><a class="btn-notif btn-wa-sm" href="${linkWa(l.telefono)}" target="_blank" rel="noopener">WhatsApp</a>
        <button class="btn-notif btn-gestion" onclick="abrirFicha('${esc(l.id)}','gestion')">📞 Gestión</button>
        ${l.fechaSeguimiento ? `<a class="btn-notif" href="${urlGoogleCalendar(l)}" target="_blank" rel="noopener" title="Agregar a Google Calendar">📅</a>` : ''}</span></div>`; };
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
  $('lista-agenda').innerHTML = (Object.keys(grupos).sort().map(k => `<div class="agenda-dia ${k === '__venc' ? 'agenda-venc' : k === hoyISO() ? 'agenda-hoy' : ''}">
      <div class="agenda-tit">${k === '__venc' ? '⚠️ Vencidos — pendientes de días anteriores' : k === hoyISO() ? 'Hoy · ' + fmtD(k) : cap(parseD(k).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long' }))}<span>${grupos[k].length}</span></div>
      ${grupos[k].map(l => item(l, k === '__venc')).join('')}</div>`).join('') +
    (sinFecha.length ? `<div class="agenda-dia agenda-sin"><div class="agenda-tit">Leads activos sin fecha de seguimiento<span>${sinFecha.length}</span></div>${sinFecha.map(l => item(l, false)).join('')}</div>` : '')) ||
    '<div class="empty-msg">No hay seguimientos pendientes en el periodo 🎉</div>';
  $('a-resumen').textContent = `${items.filter(l => l.fechaSeguimiento < hoyISO()).length} vencidos · ${items.filter(l => l.fechaSeguimiento === hoyISO()).length} hoy · ${items.filter(l => l.fechaSeguimiento > hoyISO()).length} próximos`;
}
async function enviarAgendaCorreo(btn) {
  await conEspera(btn, async () => {
    try { const r = await api('enviarInforme'); mostrarToast(r.tipo === 'informe' ? `Informe de gestiones (${fmtD(r.desde)}${r.hasta !== r.desde ? ' a ' + fmtD(r.hasta) : ''}: ${r.gestiones}) enviado a ${r.para}` : `Agenda enviada a ${r.para} (${r.pendientes} pendientes)`, 'success'); }
    catch (e) { mostrarToast(e.message, 'error'); }
  });
}
