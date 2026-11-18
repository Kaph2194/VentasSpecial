# Ventas — Seguimiento comercial de vehículos · Instalación

App para el equipo comercial, construida sobre el módulo de **Cartera** de SpecialTO (misma arquitectura: página web en GitHub Pages + backend en Google Apps Script con Sheets, Calendar, Drive y Gmail).

## Qué hace

| Función | Detalle |
|---|---|
| **Ingreso por correo personal** | Cada comercial escribe su correo (Gmail, Hotmail, corporativo…) y recibe un **código de 6 dígitos**. Solo entran los correos registrados por el administrador. La sesión se recuerda 30 días en ese navegador. |
| **Leads** | **# Lead** consecutivo (L-0001…), nombre del prospecto, teléfono (enlace a WhatsApp), correo, cédula, ciudad, **fecha de contacto**, **fecha y hora de seguimiento**, **marca** y **referencia** del vehículo, versión, origen, forma de pago, retoma, valor estimado, observaciones. Aviso de duplicado por teléfono. |
| **Vista Kanban** | Vista principal de los leads: una columna por estado y en cada tarjeta **solo el nombre del prospecto** (borde rojo = seguimiento vencido, azul = hoy, ámbar = sin fecha). Al hacer clic se abre la ficha con todo lo necesario para gestionar: WhatsApp/llamada, vehículo, próximo seguimiento, registro de gestión, cotizaciones, cierre de venta e historial. Arrastrar la tarjeta cambia el estado. También hay vista de tabla. |
| **Estados hasta la finalización** | Nuevo → Contactado → Cita / visita → Prueba de manejo → Cotizado → Negociación → Crédito en estudio → Aprobado / separado → Facturado → **Entregado** (fin, venta) · o **Perdido** (fin, con motivo obligatorio). Cada cambio queda en el historial con fecha y usuario. Se cambia desde la tabla, la ficha (barra de pasos) o arrastrando en el **tablero**. |
| **Gestiones** | Llamada, WhatsApp, visita… con resultado, detalle y **próximo seguimiento**; botones rápidos "No contestó" / "Respondió". |
| **Recordatorios en el calendario** | Cada fecha de seguimiento crea un evento en el calendario **"Ventas - Seguimientos"** de la cuenta dueña con el **comercial como invitado**: le llega la invitación y queda en **su propio calendario**. Si se reprograma o se reasigna, recibe la actualización; al cerrar el lead, el evento se cancela. Además, cada mañana (lun–sáb, 7:00) cada comercial recibe **por correo su agenda** (vencidos, hoy y leads sin fecha). |
| **Cotizaciones** | Se **crean** en la app (precio, descuento, accesorios, trámites, SOAT, retoma, contado o crédito con cálculo de cuota) con número consecutivo **COT-2026-0001**, o se **cargan** (PDF/imagen del concesionario). Se **descargan en PDF**, se **comparten por WhatsApp** (en el celular, con el PDF adjunto) y se **envían por correo** con el PDF, copia al comercial y respuesta a su correo. Todas quedan en Drive, en una carpeta por lead. Al crear la primera, el lead pasa a "Cotizado". |
| **Reportes** | Por periodo, comercial y marca: leads nuevos, gestiones, cotizaciones y valor cotizado, ventas y valor vendido, tasa de cierre, tiempo promedio de cierre, embudo, resultados por comercial, marcas, referencias, origen de los leads (con % que compró), motivos de pérdida, tendencia semanal. **Excel** (leads, cotizaciones, historial, comerciales), **imprimir/PDF** y **resumen diario por correo** a los administradores. |
| **Cierre de venta** | Al pasar a **Facturado** se registra: **valor real de venta** (la app lo compara con la cotización y avisa si quedó **igual o por debajo**, con la diferencia en $ y %), **valor neto del vehículo** (utilidad y **% de ganancia real** sobre la venta y sobre el neto), valor cobrado como **MEMBRESÍA**, **meses de administración cubiertos por el comercial** (y su costo si se indica el valor mensual) y la utilidad total. Se adjuntan **Factura, Ficha de homologación, Certificado de aduana y Contrato de membresía**: los 4 son obligatorios para finalizar como **Entregado**. Todo queda en la pestaña *Ventas* de la hoja y en Drive. |
| **Perfiles** | **Comercial**: ve y gestiona solo sus leads. **Supervisor**: ve los leads, la agenda y las estadísticas de **su equipo** (los comerciales que gerencia le asigna en 👥 Usuarios) y puede reasignar dentro de su equipo. **Gerencia**: ve todo, reasigna, crea usuarios y asigna supervisores. **Administrador**: igual que gerencia y además es el único que crea o modifica administradores. |
| **Informe día vencido** | Cada mañana (7:00, lunes a sábado) llega a **ceo@specialcar.com.co** el informe de las gestiones del **día anterior** (el lunes trae sábado y domingo): totales, resultados por comercial, detalle de cada gestión, cambios de estado, cotizaciones, ventas con su rentabilidad y seguimientos vencidos, con PDF y CSV adjuntos. Cada supervisor recibe el mismo informe solo con su equipo, y cada comercial su agenda del día. |

---

## Prueba rápida (sin instalar nada)

Abre la página con `?demo` al final (https://kaph2194.github.io/VentasSpecial/?demo) o sin backend configurado: la app entra en **modo demo** con datos de ejemplo guardados en tu navegador. Usuarios: `gerente@demo.com` (gerencia), `supervisor@demo.com` (supervisora de Carlos), `carlos.ruiz@gmail.com`, `andrea.mejia@gmail.com` (comerciales), `admin@demo.com`. Código: `123456`.

---

## Instalación (una sola vez, ~15 minutos)

### 1. Elegir la cuenta dueña
Una cuenta de Google que será la "dueña" del sistema, por ejemplo `ventas@specialcar.com.co` (o un Gmail creado para esto). Desde ella salen los correos y los códigos, y en su Drive quedan la hoja y las cotizaciones. **No uses la cuenta personal de un comercial.**

### 2. Crear el backend
1. Con la cuenta dueña, abrir <https://script.google.com> → **Nuevo proyecto** → nombre `Ventas - Seguimiento comercial`.
2. En `Código.gs`: borrar todo y pegar el contenido de [`apps-script/Ventas.gs`](apps-script/Ventas.gs).
3. Al inicio del archivo, en `CONFIG.EMPRESA`, completar nombre, NIT, dirección, teléfono, correo y web (salen en el encabezado de las cotizaciones). Ajustar `NOMBRE_REMITENTE` si se quiere.
4. ⚙️ **Configuración del proyecto** → activar *Mostrar el archivo de manifiesto "appsscript.json"* → abrir `appsscript.json` y reemplazar todo por [`apps-script/appsscript.json`](apps-script/appsscript.json) (activa el servicio avanzado de Google Calendar, necesario para que el comercial reciba las invitaciones). Guardar 💾.
5. En el editor, elegir la función **`configurarTodo`** → **Ejecutar** → **Revisar permisos** → cuenta dueña → *Configuración avanzada* → *Ir a Ventas…* → **Permitir** (Hojas de cálculo, Drive, Calendar, envío de correo).
   En el *Registro de ejecución* aparecen la URL de la hoja, el calendario y la carpeta de cotizaciones. La cuenta dueña queda registrada como **administrador**.

### 3. Publicar el backend
**Implementar → Nueva implementación** → tipo **Aplicación web**:
- Ejecutar como: **Yo (cuenta dueña)**
- Quién tiene acceso: **Cualquier usuario**

**Implementar** y copiar la **URL de la aplicación web** (termina en `/exec`).

> "Cualquier usuario" solo significa que la página puede hablar con el backend. Ningún dato sale sin un código de acceso válido enviado al correo de un usuario registrado.

### 4. Conectar la página
1. En [`app.js`](app.js), pegar la URL en `const VENTAS_WEBAPP_URL = '...';` (al inicio del archivo). **Ya está configurada** con la implementación `AKfycbwgbdo6…/exec`.
2. Publicar la carpeta en **GitHub Pages** (repositorio nuevo → *Settings → Pages → Deploy from branch → main / root*). También puede ir como subcarpeta `ventas/` del repositorio SpecialTO.
3. En `Ventas.gs`, poner esa dirección en `CONFIG.URL_APP` (por ejemplo `https://kaph2194.github.io/VentasSpecial`) y publicar una nueva versión (paso "Mantenimiento"): así los correos muestran el logo y traen un enlace directo al lead.

### 5. Registrar a los comerciales
Entrar a la app con la cuenta dueña → **👥 Usuarios → + Agregar usuario**: correo personal, nombre, perfil, teléfono y cargo (salen en las cotizaciones). Crear primero a los **supervisores** y luego, en cada comercial, elegir su **supervisor a cargo**. Cada persona ya puede entrar con su correo.

---

## Cosas a tener en cuenta

- **Calendario del comercial:** el evento llega como invitación. En Gmail se agrega solo al calendario (si el comercial tiene activado *Agregar invitaciones a mi calendario*; si no, debe aceptar la primera invitación). Los recordatorios en el calendario del comercial son los **predeterminados de su propio calendario** (Google no deja imponerlos al invitado); por eso además está el correo diario de agenda. Desde la ficha y la agenda también hay botones **📅 Google Calendar** y **📅 .ics** (Outlook/iPhone).
- **Cupo de correos de Google:** un Gmail gratuito envía ~100 correos/día desde scripts; Google Workspace, ~1.500. Cada código de acceso, agenda diaria, resumen y cotización enviada cuenta. Para un equipo grande, usar una cuenta de Workspace como dueña.
- **Datos personales:** los datos de los prospectos viven solo en la hoja de la cuenta dueña, nunca en el repositorio. Aun así, se recomienda que el repositorio sea privado.
- **Hoja de cálculo:** pestañas *Usuarios* (con la columna *Supervisor* para armar los equipos), *Leads*, *Cotizaciones*, *Ventas* (cierre y rentabilidad de cada venta, con enlaces a los documentos) y *Bitacora* (una fila por cambio de estado o gestión, ideal para tablas dinámicas). La columna *JSON* la usa la app: no editarla a mano. Los usuarios se pueden editar en la hoja o desde la app.

## Mantenimiento

- Al cambiar `Ventas.gs`: **Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión → Implementar** (así la URL no cambia).
- `resincronizarCalendarios()` vuelve a crear/actualizar los eventos de todos los leads (por ejemplo, si se borró el calendario).
- `probarCorreos()` envía ya mismo el informe a la cuenta dueña; `probarInformeCEO()` lo envía a `CONFIG.CORREO_INFORME` (ceo@specialcar.com.co). Copias adicionales: `CONFIG.CC_INFORME`.
- Para cambiar la hora del correo diario: `CONFIG.HORA_AGENDA` y publicar una nueva versión (se reprograma solo).

## Identidad visual Special Car

| Uso | Color | Dónde |
|---|---|---|
| Azul del logo (principal) | `#2C4887` | Cabecera, botones, barras de reportes, encabezado y pie del PDF, títulos de correos |
| Azul sombra del logo | `#213E80` | Degradado de la cabecera, encabezados de tablas, franja bajo el encabezado del PDF |
| Azul claro (fondos) | `#E9EEF8` | Fila de total del PDF, resaltados |
| Hover | `#3A5BA8` | Botones al pasar el mouse |
| Blanco | `#FFFFFF` | Logo sobre fondos azules |

Los colores de estado (verde = ganado, rojo = vencido/perdido, ámbar = alerta) se mantienen porque comunican significado.

Logos en `img/`: `logo-blanco.png` (transparente, para la cabecera y el PDF), `logo-azul.png` (transparente, para el ingreso y los correos) e `icono.png` (ícono del navegador). Para cambiar el logo basta con reemplazar esos archivos con el mismo nombre.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html`, `styles.css` | Página y estilos (base del módulo de Cartera, con la paleta Special Car). |
| `img/` | Logos y el ícono. |
| `app.js` | Configuración, catálogos (estados, orígenes, marcas…), ingreso por código, sincronización, usuarios. |
| `leads.js` | Tabla y tablero de leads, ficha, estados, gestiones, agenda. |
| `venta.js` | Cierre de venta: comparación con la cotización, rentabilidad, membresía, administración y documentos. |
| `cotizaciones.js` | Formulario, cálculo de crédito, PDF, carga de archivos, compartir y enviar. |
| `reportes.js` | Reportes, Excel e informe imprimible. |
| `demo.js` | Modo demo (sin backend). |
| `apps-script/Ventas.gs`, `apps-script/appsscript.json` | Backend (Sheets + Calendar + Drive + Gmail). |
