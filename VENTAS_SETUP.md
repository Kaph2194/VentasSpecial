# Ventas — Seguimiento comercial de vehículos · Instalación

App para el equipo comercial, construida sobre el módulo de **Cartera** de SpecialTO (misma arquitectura: página web en GitHub Pages + backend en Google Apps Script con Sheets, Calendar, Drive y Gmail).

## Qué hace

| Función | Detalle |
|---|---|
| **Ingreso** | **Continuar con Google** (un clic con su cuenta de Google) o, para quien no tenga cuenta de Google, con su correo y un **código de 6 dígitos**. La sesión se recuerda 30 días en ese navegador. |
| **Perfil del usuario** | Al registrarse (con Google o con código) se piden los datos de contacto: **obligatorios** nombre y apellido, correo, celular, cédula y ciudad; **opcionales** foto, dirección y contacto de emergencia. Con Google, el correo, el nombre y la foto vienen de la cuenta. Cada uno los actualiza en **Mi perfil** (clic en su foto o nombre arriba a la derecha) y a los usuarios antiguos la app les pide completarlos al entrar. La cédula, la dirección y el contacto de emergencia solo los ven gerencia, los administradores y la propia persona. |
| **Registro propio** | Comerciales y supervisores se registran solos en **Crear cuenta**, **únicamente con su cuenta de Google** (botón *Continuar con Google*; luego completan celular, cédula, ciudad y foto opcional) y **quedan como Comercial**. El código al correo queda solo para *Ingresar* de usuarios ya registrados (`CONFIG.REGISTRO_SOLO_GOOGLE`). Gerencia y administradores reciben un correo por cada registro, y en 👥 Usuarios los nuevos aparecen marcados para **cambiar el perfil a Supervisor** o **asignarles su supervisor**; a quien no pertenezca al equipo se le desactiva (un usuario inactivo no puede volver a registrarse). Se puede restringir a ciertos dominios con `CONFIG.DOMINIOS_REGISTRO` o apagar con `CONFIG.PERMITIR_REGISTRO = false`. |
| **Leads** | **# Lead** escrito a mano (el mismo número que trae la otra aplicación, p. ej. KOMMO; no se puede repetir ni cambiar después de crear), nombre del prospecto, teléfono (enlace a WhatsApp), correo, cédula, **ciudad** (lista de las principales ciudades de Colombia, con opción *Otra…*), **fecha de contacto**, **fecha y hora de seguimiento**, **marca** y **referencia** del vehículo, versión, **origen** (Campaña, WhatsApp, Formulario, KOMMO, Instagram, Facebook, TikTok, Página web / Google, Llamada entrante, Vitrina, Referido, Cliente antiguo, Base de datos, Feria / evento, TuCarro / Marketplace, Correo, Otro), forma de pago, retoma, valor estimado, observaciones. Aviso de duplicado por teléfono. |
| **Vista Kanban** | Vista principal de los leads en **2 filas de 5 columnas** (Nuevo → Entregado y Perdido; en Entregado y Perdido solo los de los últimos 30 días, con un enlace a todos los perdidos) y en cada tarjeta **solo el nombre del prospecto** (borde rojo = seguimiento vencido, azul = hoy, ámbar = sin fecha). Al hacer clic se abre la ficha con todo lo necesario para gestionar: WhatsApp/llamada, vehículo, próximo seguimiento, registro de gestión, cotizaciones, cierre de venta e historial. Arrastrar la tarjeta cambia el estado. También hay vista de tabla. |
| **Estados hasta la finalización** | Nuevo → Contactado → Cita / visita → Cotizado → Negociación → Crédito en estudio → Aprobado / separado → Facturado → **Entregado** (fin, venta) · o **Perdido** (fin, con motivo obligatorio). Cada cambio queda en el historial con fecha y usuario. **Los comerciales solo pueden avanzar**: devolver un lead a un estado anterior (o reabrir un perdido) solo lo pueden hacer el **supervisor o gerencia/administrador**, escribiendo una **justificación** (mín. 10 caracteres) que queda en el historial como «↩ Retroceso autorizado». Los leads que estaban en *Prueba de manejo* pasan a *Cita / visita*. Se cambia desde la tabla, la ficha (barra de pasos) o arrastrando en el **tablero**. |
| **Gestiones** | Llamada, WhatsApp, visita… con resultado, detalle y **próximo seguimiento**; botones rápidos "No contestó" / "Respondió". |
| **Tareas en el calendario** | Cada gestión deja agendado el siguiente seguimiento como una **tarea (☑ Tarea: …)** en el Google Calendar del comercial o supervisor dueño del lead, con lo que hay que hacer según el último resultado (volver a llamar, seguir la cotización…). Técnicamente es un evento en el calendario **"Ventas - Seguimientos"** de la cuenta dueña con el **comercial como invitado**: le llega la invitación y queda en **su propio calendario**. Si se reprograma o se reasigna, recibe la actualización; al cerrar el lead, el evento se cancela. Además, cada mañana (lun–sáb, 7:00) cada comercial recibe **por correo su agenda** (vencidos, hoy y leads sin fecha). |
| **Cotizaciones** | Se **crean** en la app (precio, descuento, accesorios, trámites, SOAT, retoma, contado o crédito con cálculo de cuota) con número consecutivo **COT-2026-0001**, o se **cargan** (PDF/imagen del concesionario). Se **descargan en PDF**, se **comparten por WhatsApp** (en el celular, con el PDF adjunto) y se **envían por correo** con el PDF, copia al comercial y respuesta a su correo. Todas quedan en Drive, en una carpeta por lead. Al crear la primera, el lead pasa a "Cotizado". |
| **Reportes** | Por periodo, comercial y marca: leads nuevos, gestiones, cotizaciones y valor cotizado, ventas y valor vendido, tasa de cierre, tiempo promedio de cierre, embudo, resultados por comercial, marcas, referencias, origen de los leads (con % que compró), motivos de pérdida, tendencia semanal. **Excel** (leads, cotizaciones, historial, comerciales), **imprimir/PDF** y **resumen diario por correo** a los administradores. |
| **Cierre de venta** | Al pasar a **Facturado** se registra: **valor real de venta** (la app lo compara con la cotización y avisa si quedó **igual o por debajo**, con la diferencia en $ y %), **valor neto del vehículo** (utilidad y **% de ganancia real** sobre la venta y sobre el neto), valor cobrado como **MEMBRESÍA**, **meses de administración cubiertos por el comercial** (y su costo si se indica el valor mensual) y la utilidad total. Se adjuntan **Factura, Ficha de homologación, Certificado de aduana y Contrato de membresía**: los 4 son obligatorios para finalizar como **Entregado**. Todo queda en la pestaña *Ventas* de la hoja y en Drive. |
| **Perfiles** | **Comercial**: ve y gestiona solo sus leads. **Supervisor**: tiene su propia **gestión comercial** (sus leads, cotizaciones y ventas, como un comercial) y además ve los leads, la agenda y las estadísticas de **su equipo** (los comerciales que gerencia le asigna en 👥 Usuarios) y puede reasignar dentro de su equipo. **Gerencia**: ve todo, reasigna, crea usuarios y asigna supervisores. **Administrador**: igual que gerencia y además es el único que crea o modifica administradores. |
| **Informe día vencido** | **Automático, sin intervención de ningún usuario** (un disparador de tiempo de Google que se instala solo y se reinstala si falta). Cada mañana (7:00, lunes a sábado), aunque no haya habido actividad, llega a **ceo@specialcar.com.co** el informe de las gestiones del **día anterior** (el lunes trae sábado y domingo): totales, resultados por comercial, detalle de cada gestión, cambios de estado, cotizaciones, ventas con su rentabilidad y seguimientos vencidos, con PDF y CSV adjuntos. Cada supervisor recibe el mismo informe solo con su equipo, y cada comercial su agenda del día. |

---

## Prueba rápida (sin instalar nada)

Por ahora la página publicada **abre en modo demo** (https://kaph2194.github.io/VentasSpecial/); para entrar con el backend real se agrega `?real` (https://kaph2194.github.io/VentasSpecial/?real). Cuando el equipo empiece a usarla, cambiar `DEMO_POR_DEFECTO` a `false` en `app.js`: abrirá con el backend y `?demo` seguirá mostrando el demo. El modo demo usa datos de ejemplo guardados en tu navegador. Usuarios: `gerente@demo.com` (gerencia), `supervisor@demo.com` (supervisora de Carlos), `carlos.ruiz@gmail.com`, `andrea.mejia@gmail.com` (comerciales), `admin@demo.com`. Código: `123456`.

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

### 5. Ingreso con Google (una vez, ~10 minutos)
Con la cuenta dueña (directortransporte@specialcar.com.co):
1. Abrir <https://console.cloud.google.com> → arriba, **Seleccionar proyecto → Proyecto nuevo** → nombre `Ventas Special Car` → Crear.
2. Menú ☰ → **APIs y servicios → Pantalla de consentimiento de OAuth** (o *Google Auth Platform*) → **Comenzar**: nombre de la app `Special Car - Ventas`, correo de asistencia, **Público: Externo** (para que entren correos personales como Gmail), correo de contacto → Crear.
3. En **Público**, pulsar **Publicar app** (pasa a *En producción*). Solo usa los permisos básicos (correo, nombre y foto), así que Google no exige verificación.
4. **APIs y servicios → Credenciales → + Crear credenciales → ID de cliente de OAuth** → Tipo **Aplicación web** → nombre `Ventas web` → en **Orígenes autorizados de JavaScript** agregar `https://kaph2194.github.io` → Crear.
5. Copiar el **ID de cliente** (termina en `.apps.googleusercontent.com`) y pegarlo en:
   - `Ventas.gs` → `CONFIG.GOOGLE_CLIENT_ID: '...'` (y publicar nueva versión), y
   - `app.js` → `const GOOGLE_CLIENT_ID = '...';` (o enviarlo para que lo suban a GitHub).
6. En el editor de Apps Script, ejecutar una vez `configurarTodo` y **Permitir** el permiso nuevo *"Conectarse a un servicio externo"* (lo usa el backend para validar con Google cada ingreso).

Mientras no haya ID de cliente, el botón de Google no aparece y el ingreso sigue funcionando con el código al correo.

### 6. Registrar a los comerciales
Compartir la dirección de la app con el equipo para que cada uno se registre en **Crear cuenta** (https://kaph2194.github.io/VentasSpecial/?real&registro abre directamente el registro). Todos quedan como **Comercial**. Luego, con la cuenta dueña o de gerencia, en **👥 Usuarios**: cambiar a **Supervisor** a quien corresponda y, en cada comercial, elegir su **supervisor a cargo**. También se pueden crear usuarios a mano con **+ Agregar usuario**.

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
- Para verificar el informe automático sin entrar a la app: abrir la URL `/exec` del backend en el navegador; muestra la versión, si el informe está programado, la fecha del último envío y el último error si lo hubo.
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
