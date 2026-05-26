# CLAUDE.md — darwash-dte (Feria en Vivo)

## Carpeta oficial
**La única carpeta de trabajo es `C:\Dev\darwash-dte`** (fuera de OneDrive).
En la **PC LEO** se clona en **la misma ruta `C:\Dev\darwash-dte`**.
**NO trabajar nunca desde OneDrive** — corrompe `.git/objects` y desincroniza ramas.
Las copias viejas están archivadas en `C:\Users\darwa\VIEJO\` (no usar; sólo backup).
Para abrir el proyecto: `ABRIR_FERIA.bat` en el escritorio (hace `cd`, `git pull`, abre Pages y lanza `claude`).

## Qué es
Módulo **Feria en Vivo** de **Darwash SA** (feria ganadera en Vicuña Mackenna, Córdoba).
Maneja hacienda en **153 corrales + balanza**. Dos flujos:
- **Feria de remate** (ventas con remate activo).
- **Extraferia** (entradas/salidas/movimientos internos por fuera del remate).

## Stack
- **HTML/JS puro sin framework**, monolítico. Cada pantalla es un `.html` autocontenido con su `<style>` y `<script>` adentro.
- **Backend Supabase REST por fetch directo** (sin SDK).
- Constantes `SB_URL` y `SB_KEY` **hardcodeadas en cada HTML**.
- **Login local** en `localStorage.dw_session` (no auth de Supabase).

## Archivos clave
- `index.html` — landing.
- `ingreso.html` — carga de DTEs durante remate. Tiene **buscador de clientes andando** (autocompletado contra `remate_clientes` que guarda `cuit + id_cuenta_auxi`). Es el patrón a replicar cuando haya que tocar otros formularios.
- `hacienda-feria.html` — extraferia. **3 modos** en un mismo archivo: `entrada` (crea tropa), `interno` (mueve tropa entre corrales), `salida` (cierra tropa). El modo se decide por `?modo=` en la URL.
- `egreso.html` — flujo de egreso.
- `croquis-feria.html` — croquis interactivo de los **153 corrales** con stock por corral.
- `app.js` — tablero Feria en Vivo, login, navegación.

## Tablas Supabase (proyecto `darwash-operaciones`)
- **`tropas`** — unidad central. Cada lote/tropa que entra a feria.
  Columnas nuevas: `id_cuenta_auxi`, `cuit`, `detalle_lote`.
- **`movimientos_corral`** — todos los movimientos de hacienda. FK a `tropas` con `ON DELETE CASCADE`.
- **`remate_clientes`** — **padrón de 2850 clientes**. Columnas: `id_cuenta_auxi`, `cuit`, `razon_social`, `tipo_persona`, `categoria_iva`, `localidad`.
- **`ingresos_hacienda`** — registros de ingreso durante remate (los que carga `ingreso.html`).

## Función SQL
- **`get_stock_actual()`** — calcula el stock actual por corral. La usan **tablero** y **croquis** (vía concepto). Si tocás algo que afecte stock, replicá esta lógica, no la dupliques en JS.

## Regla de oro de los datos
**El "dueño" de cada tropa se guarda por CÓDIGO (`id_cuenta_auxi`), nunca tipeado a mano.**
El nombre que se muestra sale del padrón (`razon_social`). Esto evita datos sucios por errores de tipeo / mayúsculas / espacios.
Cuando armes un campo "empresa/propietario/cliente" nuevo, usá el patrón de autocompletado de `ingreso.html` y guardá `id_cuenta_auxi` + `cuit` junto con el nombre.

## Cuidado
**Tablero, croquis y `get_stock_actual()` leen la columna `empresa` de `tropas`.**
NO cambiar la semántica de esa columna sin avisar — si lo hacés, también hay que actualizar la SQL y los dos consumidores.
