# Rediseño documental — v1.1 (09/11/2026)

La app pasa a ser una **consulta de documentos oficiales SENASA (DTE) por evento**.
Recorrido: elegir evento → resumen documental → filtrar DTE → detalle.
La gestión física (corrales, stock, balanza, martillo) es de la app de Remates.

## Qué cambió

| Área | Antes | Ahora |
|---|---|---|
| Vista principal | "Remates": una fila por DTE × categoría, tarjeta "Remate activo" | **Eventos**: una fila por DTE, selector con buscador y ‹ ›, ruta `#/evento/<código>` |
| Estado del evento | "Remate activo" si no estaba CERRADA | El estado que informa SIGSA (`PENDIENTE`, `CERRADA`…), sin inferencias |
| Cabezas | Σ enviados **incluyendo anulados**, con el fallback `recibido=0 → enviado` y badges de "drift" | **Cab. declaradas** = Σ despachadas del DTE, por sentido (entrada/salida), **sin anulados ni eliminados**, con el criterio escrito en la tarjeta. Se borró el fallback y las alertas de drift |
| Estado del DTE | El del listado del evento | El del propio DTE (maestro). Si el evento informa otro, va con `*` y figura en el detalle (157 casos al 09/11, ej. evento `EMITIDO` y DTE ya `CADUCADO`) |
| Totales | Mezclados | **Totales del evento** (tarjeta, fijos) vs. **Consulta** (barra de la tabla, siguen los filtros) |
| Categorías | Tags informativos; ovinos se perdían | Chips que filtran (se marcan y se quitan); se ven todas, incluso las no bovinas |
| Detalle DTE | 10 cajas + vacunas + tabla | Secciones: identificación/estado, origen, destino, relación con el evento (link), hacienda declarada (despachadas vs recibidas en cierre SIGSA), fechas, sanidad y fuente del dato. Pantalla completa en celular |
| Todos los DTE | KPIs siempre del maestro completo | KPIs **de la consulta**, con el alcance escrito; columnas Cab. (`s/d` si falta detalle) y Evento (link) |
| Datos | Carga única; un error mostraba "No hay remates cargados" | Estado por fuente, refresco manual y cada 10 min, aviso si falla conservando lo último, error ≠ vacío ≠ sin resultados |
| Fechas | `toLocaleString('es-AR')` → **20:34 se veía 08:34** | Extracción interpretada como hora AR (-03:00), en formato 24 h. Por fuente: DTE y Eventos, más la hora de consulta aparte |
| Búsqueda | Texto libre | Además: CUIT, RENSPA y DTE con o sin guiones o puntos |
| Excel | Mismas filas | Mismo alcance que la consulta. El de evento agrega el estado del DTE, el estado del listado y si suma o no |

Bug corregido de paso: el primer render de "Remates" mostraba "No hay remates cargados" debajo de la tarjeta, porque `selected` se inicializaba después de usarse.

**Se preservó todo esto**: Ver ingresos/egresos (editar, WhatsApp, PDF, Excel), Atar DTE, links de ingreso y egreso con claves, alias por evento (`rem_nombres` + `remates_alias.json`), sidebar colapsable, login y Feria en Vivo.

Archivos: `app.js` (vista Eventos, detalle, consulta global, capa de datos y shell), `documental.css` (nuevo, carga último) y `index.html` (+1 línea de css).
No se tocaron ingreso.html, egreso.html, hacienda-feria.html, croquis-feria.html, Supabase ni los JSON.

## Funciones heredadas: propuesta de separación (no ejecutada)

1. **Hecho ahora:** Feria en Vivo queda en el menú bajo "Operativo · pasa a Remates" y con la marca *heredado*. Los remitos y enlaces bajan a una fila secundaria de la tarjeta del evento.
2. **Feria en Vivo, croquis y hacienda-feria.html → app de Remates.** Hoy, con la key pública, Feria en Vivo **no puede leer** `tropas` ni `movimientos_corral`: no hay policy para `anon`, solo para `authenticated`. Desde esta app no funciona. Al migrar, dejar acá un html que redirija a la URL nueva.
3. **ingreso.html / egreso.html**: sus links circulan por WhatsApp. No moverlos sin redirect. Pueden quedar acá hasta que Remates tenga su propio formulario.
4. Cuando Remates absorba Ver ingresos/egresos y Atar DTE, se saca la fila "Remitos y enlaces" de la tarjeta.

## Seguridad — hallazgos (verificados en Supabase, solo lectura, 09/11)

1. **Credenciales en el navegador.** `app.js` línea 4 tiene `USUARIOS` con las contraseñas en texto plano, y el repo es público (también quedan en el historial de git). El login solo escribe `localStorage.dw_session`: cualquiera lo arma desde la consola y entra. Además `dtes_maestro.json` y `remates_maestro.json` (con CUIT y RENSPA de productores) se pueden bajar directo de GitHub Pages sin pasar por el login.
2. **`ingresos_hacienda`**: `anon` tiene UPDATE sobre `fotos` y `pdf_url` con policy `true`, así que cualquiera con la key pública puede reemplazar el PDF o las fotos de **cualquier** remito. Editar y Eliminar del dashboard van con la key `anon`, que no tiene UPDATE sobre esas columnas ni DELETE: **fallan en producción**. Ocultarlos con `esLeo` no protege nada.
3. **`egresos_hacienda`**: siguen vigentes el grant SELECT y la policy `anon select egresos` (`true`), aunque el front ya lee por `egresos_de_remate` con token. Revisar si el cierre de lectura (03_cerrar_egresos) quedó completo. También está `anon update egresos media` (`true`).
4. `transportistas`: UPDATE `anon` con `true`.

### Solución recomendada, en orden (no se aplicó nada)

1. **Ya:** rotar las contraseñas que figuran en `app.js` y no reutilizarlas.
2. **Supabase Auth para el dashboard** (email + contraseña o magic link) en lugar de `USUARIOS` y `dw_session`. Con el JWT `authenticated`, las policies `*_app_rw` que ya existen habilitan editar y eliminar ingresos sin abrir nada a `anon`. Para cerrar más, una tabla `app_usuarios(email, rol)` y policies de UPDATE/DELETE con `auth.jwt()->>'email' in (select email from app_usuarios where rol='admin')` en vez de `true`.
3. **Acotar `anon` sin romper el formulario público.** ingreso.html sube el PDF y las fotos justo después del INSERT, así que alcanza con una ventana corta:
   ```sql
   -- borrador: probar primero en una rama de Supabase
   drop policy "anon update ingresos media" on public.ingresos_hacienda;
   create policy "anon update ingresos media reciente" on public.ingresos_hacienda
     for update to anon
     using (ts > now() - interval '2 hours')
     with check (ts > now() - interval '2 hours');
   -- lo mismo para egresos_hacienda (ts timestamptz) y revisar transportistas
   ```
4. **Datos públicos:** si los CUIT/RENSPA no deben estar abiertos, publicar los JSON detrás de Cloudflare Access (ya hay deploy en Pages) o servirlos desde Supabase con auth. Es una decisión de negocio, no técnica.

## Pendientes / limitaciones

- En "Todos los DTE", 413 DTE sin detalle cargado muestran `s/d` en cabezas y no suman. Se completa con el backfill del scraper.
- 181 DTE de eventos compartidos (otras consignatarias) no están en el maestro: el detalle sale solo del listado del evento.
- `periodo_hasta` de `dtes_maestro.json` dice 23/09/2026 aunque la extracción es del 09/11. La app no lo usa, pero conviene corregirlo en el scraper.
- "Novillo" agrupa Novillo y Novillito (taxonomía existente de la app). En el detalle se ve la categoría SENASA original.
