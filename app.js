let DATOS_DTES = {};
let DATOS_REMATES = {};
let DATOS_ALIASES = {};
const USUARIOS = {"leoqui1991@gmail.com": {"pass": "36604114", "nombre": "Leo", "mustChange": false}, "lorenzolavaselli@gmail.com": {"pass": "123456", "nombre": "Lorenzo", "mustChange": true}, "fernandodavidurcelay@gmail.com": {"pass": "123456", "nombre": "Fernando", "mustChange": true}, "darwashsa@gmail.com": {"pass": "123456", "nombre": "Darwash SA", "mustChange": true}};
function hashStr(s){let h=0;for(let i=0;i<s.length;i++)h=(Math.imul(31,h)+s.charCodeAt(i))|0;return String(h);} function getUsuarios(){const base={};for(const [email,u] of Object.entries(USUARIOS))base[email]={passHash:hashStr(u.pass),nombre:u.nombre,mustChange:u.mustChange};return base;} function getSession(){try{const s=JSON.parse(localStorage.getItem('dw_session')||'null');if(s&&s.exp>Date.now())return s;}catch(e){}return null;} function setSession(email,nombre){localStorage.setItem('dw_session',JSON.stringify({email,nombre,exp:Date.now()+8*3600*1000}));} function clearSession(){localStorage.removeItem('dw_session');}
function getSidebarCollapsed(){try{return localStorage.getItem('dw_sidebar_collapsed')==='true';}catch(e){return false;}}
function setSidebarCollapsed(v){try{localStorage.setItem('dw_sidebar_collapsed',v?'true':'false');}catch(e){}}
function esc(v){return String(v??'—').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}
function normalizarEstado(s){
  const v=(s||'').toLowerCase();
  if(v.includes('vigente')||v==='vig') return 'VIGENTE';
  if(v.includes('cerr')) return 'CERRADO';
  if(v.includes('anul')) return 'ANULADO';
  if(v.includes('elim')) return 'ELIMINADO';
  if(v.includes('caduc')) return 'CADUCADO';
  if(v.includes('emit')) return 'EMITIDO';
  if(v.includes('venc')) return 'VENCIDO';
  return (s||'').toUpperCase()||'—';
}
function badgeClass(s){const n=normalizarEstado(s).toLowerCase(); if(n==='vigente') return 'vigente'; if(n==='cerrado') return 'cerrado'; if(n==='anulado') return 'anulado'; if(n==='eliminado') return 'anulado'; if(n==='caducado') return 'vencido'; if(n==='vencido') return 'vencido'; if(n==='emitido') return 'vigente'; return '';}
function cleanEstado(estado){return (estado||'').replace(/\s*\([^)]*\)\s*/g,'').trim();}
// Consignatarias que asigna el scraper por CUIT del consignatario (dtes_maestro.json → consignataria)
const CONSIGNATARIAS=['DARWASH SA','BULLTRADE','UT DW-FERNANDEZ'];
// La UT va primero: su nombre completo también contiene "DARWASH"
function consClass(v){const s=(v||'').toUpperCase(); if(s.startsWith('UT ')||s.includes('FERNANDEZ')) return 'ut'; if(s.includes('DARWASH')) return 'dar'; if(s.includes('BULLTRADE')) return 'bull'; return 'other';}
function prettyCons(v){const c=consClass(v); return '<span class="cons-chip"><span class="dot '+(c==='other'?'':c)+'"></span>'+esc(v||'-')+'</span>'}
// === Taxonomía canónica de categorías — única fuente de verdad ===
// 7 categorías unificadas. NOVILLO absorbe Novillo+Novillito; MEJ absorbe Torito/MEJ.
// "Mamón" legacy NO se canoniza: se preserva literal en su call site para no perder el dato.
const CATEGORIAS_CANONICAS=['TERNERO','TERNERA','NOVILLO','VAQUILLONA','VACA','MEJ','TORO'];
const CATEGORIA_CANONICA_ABBR={TERNERO:'TRO',TERNERA:'TRA',NOVILLO:'NOV',VAQUILLONA:'VQ',VACA:'VA',MEJ:'MEJ',TORO:'TO'};
const CATEGORIA_RAW_TO_CANONICA={
  // capitalización del maestro JSON (remates_maestro.json)
  'Ternero':'TERNERO','Ternera':'TERNERA',
  'Novillo':'NOVILLO','Novillito':'NOVILLO',
  'Vaquillona':'VAQUILLONA','Vaca':'VACA',
  'Torito/MEJ':'MEJ','Toro':'TORO'
};
// Aliases case-insensitive (lowercase de Supabase egresos_hacienda + plurales/variantes)
const CATEGORIA_ALIASES_LC={
  'ternero':'TERNERO','terneros':'TERNERO',
  'ternera':'TERNERA','terneras':'TERNERA',
  'novillo':'NOVILLO','novillos':'NOVILLO',
  'novillito':'NOVILLO','novillitos':'NOVILLO',
  'vaquillona':'VAQUILLONA','vaquillonas':'VAQUILLONA',
  'vaquilla':'VAQUILLONA','vaquillas':'VAQUILLONA',
  'vaca':'VACA','vacas':'VACA',
  'torito/mej':'MEJ','torito':'MEJ','toritos':'MEJ','mej':'MEJ',
  'toro':'TORO','toros':'TORO'
};
// Devuelve canónica o null (callers deciden qué hacer con null — típicamente "Mamón" legacy)
function canonizarCategoria(raw){
  if(raw==null||raw==='') return null;
  const key=String(raw).trim();
  if(CATEGORIA_RAW_TO_CANONICA[key]) return CATEGORIA_RAW_TO_CANONICA[key];
  return CATEGORIA_ALIASES_LC[key.toLowerCase()] || null;
}
// Mantenida por compatibilidad. Ahora delega al mapping canónico; Mamón → fallback "MAM".
function abreviarCategoria(cat){
  const canon=canonizarCategoria(cat);
  if(canon) return CATEGORIA_CANONICA_ABBR[canon];
  return String(cat||'').substring(0,3).toUpperCase();
}
// Agrupa un objeto crudo de categorías de un registro Supabase (ingresos/egresos_hacienda)
// por canónicas. Categorías no canonizables (ej. "Mamón" legacy) se preservan literal con
// su key original — para no perder el dato histórico. Filtra valores <=0.
function agruparCategoriasReg(rawCats){
  const out={};
  for(const [k,v] of Object.entries(rawCats||{})){
    const n=Number(v||0);
    if(n<=0) continue;
    const canon=canonizarCategoria(k);
    const key=canon||k;
    out[key]=(out[key]||0)+n;
  }
  return out;
}
const app=document.getElementById('app'); const modalBg=document.getElementById('modalBg'); const modal=document.getElementById('modal');
function renderLogin(err=''){
  app.innerHTML=''
    +'<div class="login">'
    +  '<div class="login-card">'
    +    '<img src="drw-logo-full.png" alt="Darwash" class="login-logo">'
    +    '<h1 class="login-title">Iniciar sesión</h1>'
    +    '<input id="lemail" class="input" placeholder="Email" type="email" autocomplete="username">'
    +    '<input id="lpass" class="input" placeholder="Contraseña" type="password" autocomplete="current-password">'
    +    '<button id="loginBtn" class="btn btn-primary login-btn">Entrar</button>'
    +    '<div class="login-error">'+(err?'⚠ '+esc(err):'')+'</div>'
    +  '</div>'
    +'</div>';
  document.getElementById('loginBtn').onclick=function(){
    const email=(document.getElementById('lemail').value||'').trim().toLowerCase();
    const pass=document.getElementById('lpass').value||'';
    const u=getUsuarios()[email];
    if(!u) return renderLogin('Email no registrado.');
    if(u.passHash!==hashStr(pass)) return renderLogin('Contraseña incorrecta.');
    setSession(email,u.nombre);
    iniciarApp();
  };
}
// ══════════════════════════════════════════════════════════════
// DETALLE DTE — datos oficiales por sección. Se abre sobre la vista (modal en escritorio,
// pantalla completa en celular) así al cerrar quedan evento, filtros y scroll como estaban.
// Acepta el N° de DTE o el objeto del maestro (compatibilidad con llamadas viejas).
// ══════════════════════════════════════════════════════════════
function openDetalle(arg){
  const nro=String(typeof arg==='object'&&arg?arg.nro_dte:arg||'');
  if(!nro) return;
  const m=idxDtes().get(nro)||null;
  const evRef=idxEventos().get(nro)||null;
  const r=evRef?remateDe(evRef.codigo):null;
  const d=r?(modeloEvento(r).docs.find(x=>x.nro===nro)||null):null;
  modal.classList.remove('modal-wide'); modal.classList.add('modal-dte');

  const val=(v,mono)=>sinDato(v)?'<span class="dd-na">sin dato</span>':(mono?'<span class="mono">'+esc(v)+'</span>':esc(v));
  const campo=(l,v,o)=>'<div class="dd-f'+(o&&o.full?' full':'')+'"><span class="dd-l">'+esc(l)+'</span><span class="dd-v">'+(o&&o.html?v:val(v,o&&o.mono))+'</span></div>';
  const seccion=(t,html,extra)=>'<section class="dd-sec"><h3 class="dd-h">'+esc(t)+(extra?'<span class="dd-h-x">'+extra+'</span>':'')+'</h3><div class="dd-grid">'+html+'</div></section>';
  const g=(k)=>m?m[k]:undefined;

  if(!m&&!d){
    modal.innerHTML='<div class="modal-head"><div><div class="modal-title-top">Detalle DTE</div><div class="modal-title is-code">'+esc(nro)+'</div></div><button id="closeModal" class="modal-close" aria-label="Cerrar">×</button></div>'
      +'<div class="modal-body">'+estadoVacio('DTE no encontrado','El documento no está en los datos cargados (dtes_maestro.json ni eventos).')+'</div>';
    modalBg.style.display='flex'; document.getElementById('closeModal').onclick=closeDetalle; return;
  }
  const estado=m?normalizarEstado(m.estado):d.estado;
  const estadoRaw=m?m.estado:(d.filas[0]||{}).estado;
  const cerrado=estado==='CERRADO';

  // Identificación y estado
  const destTipo=(()=>{const fe=m&&m.destino_es_feria!=null?m.destino_es_feria:d&&d.destino_es_feria, ff=m&&m.destino_es_frigorifico!=null?m.destino_es_frigorifico:d&&d.destino_es_frigorifico;
    if(fe==null&&ff==null) return null; return fe?'Feria':ff?'Frigorífico':'Establecimiento u otro (no feria ni frigorífico)';})();
  const ident=campo('Estado',estadoPill(estado)+(cleanEstado(estadoRaw)!==estadoRaw?' <span class="dd-small">'+esc(estadoRaw)+'</span>':''),{html:true})
    +(m&&!sinDato(m.estado_detalle)&&normalizarEstado(m.estado_detalle)!==estado?campo('Estado en detalle SIGSA',m.estado_detalle):'')
    +(d&&d.difEstado?campo('Estado en listado del evento',estadoPill(d.estadoEvento)+' <span class="dd-small">el listado del evento puede venir atrasado</span>',{html:true}):'')
    +campo('Motivo',g('motivo_detalle')||d&&d.motivo)
    // Campos que solo existen en dtes_maestro: si el DTE no está ahí no se listan vacíos
    +(m?campo('Tipo',g('tipo'),{mono:true})
      +campo('Tipo (detalle)',g('tipo_movimiento_detalle'),{mono:true})
      +campo('Autogestión',g('autogestion'))
      +campo('Consignataria (app)',g('consignataria'))
      +campo('Consignatario SIGSA',g('consignatario_nombre'))
      +campo('ID movimiento',g('id_movimiento'),{mono:true})
      +campo('Guía',g('nro_guia'),{mono:true})
      +campo('TRI',g('nro_tri'),{mono:true})
      +campo('Certificado de faena',g('nro_certificado_faena'),{mono:true})
      :'<div class="dd-empty full">No está en dtes_maestro.json (DTE de otra consignataria del evento): solo hay datos del listado del evento.</div>');
  const origen=campo('Emisor / productor',(m&&m.emisor_nombre)||d&&d.emisor,{full:true})
    +campo('CUIT emisor',(m&&m.emisor_cuit)||d&&d.emisor_cuit,{mono:true})
    +campo('RENSPA origen',(m&&m.renspa_origen)||d&&d.renspa_origen,{mono:true});
  const destino=campo('Receptor',(m&&m.receptor_nombre)||d&&d.receptor,{full:true})
    +campo('CUIT receptor',(m&&m.receptor_cuit)||d&&d.receptor_cuit,{mono:true})
    +campo('RENSPA destino',(m&&m.renspa_destino)||d&&d.renspa_destino,{mono:true})
    +campo('Tipo de destino',destTipo)
    +(m?campo('Usuario de faena',g('usuario_faena_nombre')):'')
    +(d&&d.sentido==='SALIDA'?campo('Comprador (listado del evento)',d.comprador):'');
  let evento;
  if(r&&d){
    const al=aliasEvento(r.codigo), inf=r.info||{};
    evento=campo('Evento','<button class="link-btn js-ir-evento" data-cod="'+esc(r.codigo)+'">'+esc(al||r.codigo)+'</button>'+(al?' <span class="mono dd-small">'+esc(r.codigo)+'</span>':''),{html:true,full:true})
      +campo('Sentido en el evento',d.sentido==='ENTRADA'?'Entrada a feria':d.sentido==='SALIDA'?'Salida de feria':d.sentido)
      +campo('Fechas del evento',(inf.Inicio||'—')+' → '+(inf.Fin||'—'),{mono:true})
      +campo('Estado del evento (SIGSA)',inf.Estado)
      +campo('Apto China (listado)',APTO_LBL[d.apto]);
  }else evento='<div class="dd-empty">No figura en los eventos cargados (remates_maestro.json).</div>';

  // Hacienda declarada
  let filasH=[], fuenteH='';
  if(m&&Array.isArray(m.animales_detalle)&&m.animales_detalle.length){
    filasH=m.animales_detalle.map(a=>({esp:a.especie,cat:a.categoria,desp:Number(a.despachados)||0,rec:Number(a.recibidos)||0})); fuenteH='detalle SIGSA';
  }else if(d&&Object.keys(d.catsRaw).length){
    filasH=d.filas.map(f=>({esp:f.especie,cat:f.categoria,desp:Number(f.enviado)||0,rec:Number(f.recibido)||0})); fuenteH='listado del evento';
  }else if(m&&m.cantidad_enviados!=null){
    filasH=[{esp:'',cat:m.categoria_detalle,desp:Number(m.cantidad_enviados)||0,rec:null}]; fuenteH='detalle SIGSA (sin desglose)';
  }
  const recCell=v=>cerrado&&v!=null?fmtN(v):'<span class="dd-na">'+(ESTADOS_EXCLUIDOS.has(estado)?'—':'sin cierre')+'</span>';
  let hacienda;
  if(filasH.length){
    const tD=filasH.reduce((s,x)=>s+x.desp,0), tR=filasH.reduce((s,x)=>s+(x.rec||0),0);
    hacienda='<div class="modal-table-wrap"><table class="modal-table dd-table"><thead><tr><th>Especie</th><th>Categoría SENASA</th><th class="num">Despachadas (declaradas)</th><th class="num">Recibidas en cierre SIGSA</th></tr></thead><tbody>'
      +filasH.map(x=>'<tr><td>'+esc(x.esp||'—')+'</td><td>'+esc(x.cat||'—')+'</td><td class="num mono">'+fmtN(x.desp)+'</td><td class="num mono">'+recCell(x.rec)+'</td></tr>').join('')
      +'<tr class="tot"><td>Total</td><td></td><td class="num mono">'+fmtN(tD)+'</td><td class="num mono">'+recCell(filasH.some(x=>x.rec!=null)?tR:null)+'</td></tr></tbody></table></div>'
      +'<div class="dd-note">Fuente: '+esc(fuenteH)+'. "Recibidas" es lo que registró el destino al cerrar el DTE en SIGSA; no es un conteo físico de Darwash. '
      +(cerrado?'':'Este DTE no está cerrado: no hay recepción registrada.')
      +(ESTADOS_EXCLUIDOS.has(estado)?' DTE '+estado.toLowerCase()+': no suma a las cabezas declaradas.':'')+'</div>';
  }else hacienda='<div class="dd-empty">Sin detalle de hacienda cargado'+(m&&m.detalle_cargado===false?'':' para este DTE')+'. Se completa cuando el scraper enriquece el documento.</div>';

  const fechas=campo('Emisión',g('fecha_emision_detalle')||g('fecha_emision'),{mono:true})
    +campo('Carga',g('fecha_carga')||d&&d.fecha,{mono:true})
    +campo('Vencimiento',g('fecha_vencimiento_detalle')||g('fecha_vencimiento'),{mono:true})
    +(m?campo('Caduca',g('fecha_caduca'),{mono:true})
      +campo('Arribo',g('fecha_arribo'),{mono:true}):'');
  const sanidad=campo('Última aftosa',g('fecha_ultima_aftosa')||(d&&d.filas[0]&&d.filas[0].fecha_aftosa),{mono:true})
    +(m?campo('Anteúltima aftosa',g('fecha_anteultima_aftosa'),{mono:true})
      +campo('Última brucelosis',g('fecha_ultima_brucelosis'),{mono:true}):'');
  const fts=v=>{const x=parseExtraccion(v);return x?fmtFH(x,true):v;};
  const fuente=m
    ?campo('Listado SIGSA leído',fts(m.ts_scrape),{mono:true})
     +campo('Detalle SIGSA leído',m.detalle_cargado?fts(m.detalle_actualizado_ts):null,{mono:true})
     +campo('Maestro DTE extraído',fmtFH(fechaExtraccion('dtes'),true),{mono:true})
    :'<div class="dd-empty">Este DTE no está en dtes_maestro.json: los datos salen del listado del evento.</div>';

  modal.innerHTML='<div class="modal-head">'
      +'<div><div class="modal-title-top">Detalle DTE</div><div class="modal-title is-code">'+esc(nro)+'</div>'
      +'<div class="dd-sub">'+estadoPill(estado)+'<span>'+esc((m&&m.emisor_nombre)||d&&d.emisor||'')+'</span>'+(d?'<span class="sent '+(d.sentido==='ENTRADA'?'ent':'sal')+'">'+(d.sentido==='ENTRADA'?'ENT':'SAL')+'</span>':'')+'</div></div>'
      +'<button id="closeModal" class="modal-close" aria-label="Cerrar">×</button>'
    +'</div>'
    +'<div class="modal-body dd-body">'
      +seccion('Identificación y estado',ident)
      +'<div class="dd-2col">'+seccion('Origen',origen)+seccion('Destino',destino)+'</div>'
      +seccion('Relación con el evento',evento)
      +'<section class="dd-sec"><h3 class="dd-h">Categorías y cantidades declaradas</h3>'+hacienda+'</section>'
      +'<div class="dd-2col">'+seccion('Fechas',fechas)+seccion('Sanidad declarada',sanidad)+'</div>'
      +seccion('Fuente del dato',fuente)
    +'</div>'
    +'<div class="modal-footer"><span class="dd-small mono">'+esc(nro)+'</span><button class="btn-secondary" id="dd-cerrar">Cerrar</button></div>';
  modalBg.style.display='flex';
  modal.scrollTop=0; const mb=modal.querySelector('.modal-body'); if(mb) mb.scrollTop=0;
  document.getElementById('closeModal').onclick=closeDetalle;
  document.getElementById('dd-cerrar').onclick=closeDetalle;
  modal.querySelectorAll('.js-ir-evento').forEach(b=>b.onclick=()=>{closeDetalle(); if(window.irAEvento) window.irAEvento(b.dataset.cod);});
}
function closeDetalle(){modalBg.style.display='none'; modal.classList.remove('modal-wide','modal-dte');}
modalBg.onclick=function(e){if(e.target===modalBg) closeDetalle();};
document.addEventListener('keydown',function(e){if(e.key==='Escape' && modalBg.style.display==='flex')closeDetalle();});
async function mostrarLinkRemate(codigo,tipo){
  let url='https://darwashsa-ux.github.io/darwash-dte/'+tipo+'.html?remate='+encodeURIComponent(codigo);
  if(tipo==='egreso'){
    // Sin clave de carga válida no se muestra un link que no carga.
    const tok=await claveCargaPara(codigo);
    if(!tok) return;
    url=linkEgreso(codigo,tok);
  }
  modal.classList.remove('modal-wide');
  const tipoLbl=tipo==='egreso'?'Link de egreso':'Link de ingreso';
  const tipoLow=tipo==='egreso'?'egreso':'ingreso';
  const aliases=DATOS_ALIASES||{};
  const alias=aliases[codigo]||'';
  const tituloRef=alias||codigo;
  const mensaje='Hola, este es el link para registrar el '+tipoLow+' del remate '+tituloRef+':\n\n'+url;
  const tituloHtml=alias
    ? '<div class="modal-title">'+esc(alias)+'</div><div class="modal-title-top" style="margin-top:4px;margin-bottom:0;text-transform:none;letter-spacing:0">'+esc(codigo)+'</div>'
    : '<div class="modal-title is-code">'+esc(codigo)+'</div>';
  modal.innerHTML='<div class="modal-head">'
    +'<div><div class="modal-title-top">'+esc(tipoLbl)+'</div>'+tituloHtml+'</div>'
    +'<button class="modal-close" id="link-close" aria-label="Cerrar">×</button>'
    +'</div>'
    +'<div class="modal-body">'
      +'<div class="modal-title-top" style="margin-bottom:8px">Link único para este remate</div>'
      +'<div class="link-box" id="link-box">'+esc(url)+'</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px">'
        +'<button id="btn-copy" class="btn-secondary">Copiar link</button>'
        +'<button id="btn-wsp" class="btn-whatsapp">WhatsApp</button>'
      +'</div>'
    +'</div>';
  modalBg.style.display='flex';
  document.getElementById('link-close').onclick=closeDetalle;
  const btnCopy=document.getElementById('btn-copy');
  btnCopy.onclick=async function(){
    const orig=btnCopy.innerHTML;
    try{
      await navigator.clipboard.writeText(url);
      btnCopy.innerHTML='✓ Copiado';
      setTimeout(()=>{btnCopy.innerHTML=orig;},2000);
    }catch(e){
      // Fallback: seleccionar el texto del link para copia manual
      const box=document.getElementById('link-box');
      const range=document.createRange(); range.selectNodeContents(box);
      const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      btnCopy.innerHTML='Seleccionado — Ctrl+C';
      setTimeout(()=>{btnCopy.innerHTML=orig;},3000);
    }
  };
  document.getElementById('btn-wsp').onclick=function(){
    window.open('https://wa.me/?text='+encodeURIComponent(mensaje),'_blank');
  };
}
// ══════════════════════════════════════════════════════════════
// CAPA DE DATOS — carga por fuente, refresco, errores y fechas
// Cada fuente guarda su propio estado: si una actualización falla se conserva lo último
// que cargó bien y se avisa. La fecha que se muestra es la de EXTRACCIÓN de SIGSA (scraper),
// no la hora en que el navegador consultó el archivo.
// ══════════════════════════════════════════════════════════════
const TZ_AR='America/Argentina/Buenos_Aires';
// El scraper corre en Argentina y escribe hora local sin zona ("2026-11-09T20:34:25.272442").
// Se interpreta explícitamente como -03:00 para no depender de la zona del navegador.
function parseExtraccion(v){
  if(!v) return null;
  let s=String(v).trim().replace(/(\.\d{3})\d+/,'$1');
  if(!/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) s+='-03:00';
  const d=new Date(s); return isNaN(d.getTime())?null:d;
}
// Siempre 24 h: "es-AR" en Chrome devuelve 12 h sin a.m./p.m. (20:34 se veía 08:34).
function fmtFH(d,conAnio){
  if(!d) return '—';
  const o={timeZone:TZ_AR,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'};
  if(conAnio) o.year='numeric';
  return d.toLocaleString('es-AR',o);
}
function fmtHora(d){return d?d.toLocaleTimeString('es-AR',{timeZone:TZ_AR,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}):'—';}
function fmtRelDesde(d){
  if(!d) return '';
  const m=Math.round((Date.now()-d.getTime())/60000);
  if(m<1) return 'recién'; if(m<60) return 'hace '+m+' min';
  const h=Math.floor(m/60); if(h<48) return 'hace '+h+' h';
  return 'hace '+Math.floor(h/24)+' d';
}
function fmtN(n){return Number(n||0).toLocaleString('es-AR');}
function ymd(dmy){const m=/^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(dmy||''));return m?m[3]+m[2]+m[1]:'';}
function sinDato(v){return v==null||v===''||v==='-'||v==='—';}

const FUENTES={
  dtes:   {url:'dtes_maestro.json',   label:'DTE',     valida:j=>j&&Array.isArray(j.dtes)},
  remates:{url:'remates_maestro.json',label:'Eventos', valida:j=>j&&Array.isArray(j.remates)}
};
// estado: 'pendiente' | 'ok' | 'error'. cargado=true si alguna vez cargó bien (hay datos en memoria).
const CARGA={
  dtes:   {estado:'pendiente',error:'',consultado:null,cargado:false},
  remates:{estado:'pendiente',error:'',consultado:null,cargado:false}
};
async function traerJson(url,forzar){
  const ctl=typeof AbortController!=='undefined'?new AbortController():null;
  const to=ctl?setTimeout(()=>ctl.abort(),25000):null;
  try{
    const res=await fetch(forzar?url+'?_='+Date.now():url,{cache:forzar?'no-store':'default',signal:ctl?ctl.signal:undefined});
    if(!res.ok) throw new Error('HTTP '+res.status);
    try{ return await res.json(); }catch(e){ throw new Error('JSON inválido'); }
  }catch(e){
    if(e&&e.name==='AbortError') throw new Error('tiempo de espera agotado');
    if(e instanceof TypeError) throw new Error('sin conexión');
    throw e;
  }finally{ if(to) clearTimeout(to); }
}
let _idxDtes=null,_idxEventos=null; const _cacheModelos=new Map();
async function cargarDatos(forzar){
  const tareas=Object.entries(FUENTES).map(async([k,f])=>{
    const st=CARGA[k];
    try{
      const j=await traerJson(f.url,forzar);
      if(!f.valida(j)) throw new Error('formato inesperado');
      if(k==='dtes') DATOS_DTES=j; else DATOS_REMATES=j;
      st.estado='ok'; st.error=''; st.cargado=true;
    }catch(e){
      st.estado='error'; st.error=(e&&e.message)||String(e);
      console.error('[datos] '+f.url+': '+st.error);
    }finally{ st.consultado=new Date(); }
  });
  const alias=traerJson('remates_alias.json',forzar)
    .then(a=>{if(a&&typeof a==='object'&&!Array.isArray(a)) DATOS_ALIASES=a;})
    .catch(()=>{/* alias opcional */});
  await Promise.all([...tareas,alias]);
  _idxDtes=null; _idxEventos=null; _cacheModelos.clear();
}
function fechaExtraccion(k){return CARGA[k].cargado?parseExtraccion((k==='dtes'?DATOS_DTES:DATOS_REMATES).fecha_extraccion):null;}

// ── Índices ──
function idxDtes(){
  if(!_idxDtes) _idxDtes=new Map((DATOS_DTES.dtes||[]).map(d=>[String(d.nro_dte),d]));
  return _idxDtes;
}
// documento → {codigo, sentido}. Un DTE figura en un solo evento (verificado en los datos).
function idxEventos(){
  if(!_idxEventos){
    _idxEventos=new Map();
    for(const r of (DATOS_REMATES.remates||[])) for(const f of (r.filas||[])){
      const k=String(f.documento||''); if(k&&!_idxEventos.has(k)) _idxEventos.set(k,{codigo:r.codigo,sentido:String(f.tipo_movimiento||'').toUpperCase()});
    }
  }
  return _idxEventos;
}
function remateDe(codigo){return (DATOS_REMATES.remates||[]).find(r=>r.codigo===codigo)||null;}
function eventosOrdenados(){
  return (DATOS_REMATES.remates||[]).slice().sort((a,b)=>{
    const c=ymd((b.info||{}).Inicio).localeCompare(ymd((a.info||{}).Inicio));
    return c||String(b.codigo).localeCompare(String(a.codigo));
  });
}
function aliasEvento(codigo){
  let loc={}; try{loc=JSON.parse(localStorage.getItem('rem_nombres')||'{}')||{};}catch(e){}
  return loc[codigo]||(DATOS_ALIASES||{})[codigo]||'';
}

// ── Estados documentales (SIGSA) ──
// ANULADO / ELIMINADO: el documento no vale → no suma cabezas.
// VENCIDO / CADUCADO / SIN ARRIBO: documento válido sin cierre en término → suma, pero se informa aparte.
const ESTADOS_EXCLUIDOS=new Set(['ANULADO','ELIMINADO']);
const ESTADOS_SIN_CIERRE=new Set(['VENCIDO','CADUCADO','SIN ARRIBO']);
const ESTADO_ORDEN=['EMITIDO','VIGENTE','CERRADO','VENCIDO','SIN ARRIBO','CADUCADO','ANULADO','ELIMINADO'];
function ordenEstado(a,b){const ia=ESTADO_ORDEN.indexOf(a),ib=ESTADO_ORDEN.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib)||String(a).localeCompare(String(b));}
function estadoCls(e){return String(e||'').toLowerCase().replace(/\s+/g,'-');}
function estadoPill(e,titulo){return '<span class="estado-pill '+estadoCls(e)+'"'+(titulo?' title="'+esc(titulo)+'"':'')+'>'+esc(e||'—')+'</span>';}
function aptoVal(v){return sinDato(v)?'sin':/^si$/i.test(String(v))?'si':'no';}
const APTO_LBL={si:'Apto',no:'No apto',sin:'Sin dato'};
function ordenCats(keys){
  return keys.slice().sort((a,b)=>{const ia=CATEGORIAS_CANONICAS.indexOf(a),ib=CATEGORIAS_CANONICAS.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib)||String(a).localeCompare(String(b));});
}
// Cabezas declaradas de un DTE del maestro: lo despachado según el detalle SIGSA.
// null = dato faltante (detalle no cargado), distinto de 0.
function cabDte(d){
  if(!d) return null;
  if(d.total_despachados!=null) return Number(d.total_despachados)||0;
  if(d.cantidad_enviados!=null) return Number(d.cantidad_enviados)||0;
  if(Array.isArray(d.animales_detalle)&&d.animales_detalle.length) return d.animales_detalle.reduce((s,a)=>s+(Number(a.despachados)||0),0);
  return null;
}
// Búsqueda: texto libre + números normalizados (CUIT/RENSPA/DTE con o sin guiones/puntos).
function coincideBusqueda(q,campos){
  const s=String(q||'').trim().toLowerCase(); if(!s) return true;
  const soloNum=/^[\d\s.\-\/]+$/.test(s), dig=s.replace(/\D/g,'');
  return campos.some(v=>{
    const t=String(v==null?'':v).toLowerCase();
    if(t.includes(s)) return true;
    return soloNum&&dig.length>=4&&t.replace(/\D/g,'').includes(dig);
  });
}

// ── Modelo documental de un evento: una fila por DTE ──
// remates_maestro trae una fila por (DTE × categoría). Se agrupa por documento.
// Estado: manda el del propio DTE (maestro). El del listado del evento puede venir atrasado
// (157 casos al 09/11: evento EMITIDO y DTE ya CADUCADO/CERRADO); se conserva para el detalle.
function modeloEvento(r){
  if(!r) return null;
  if(_cacheModelos.has(r.codigo)) return _cacheModelos.get(r.codigo);
  const idx=idxDtes(), docs=new Map();
  for(const f of (r.filas||[])){
    const nro=String(f.documento||''); if(!nro) continue;
    let d=docs.get(nro);
    if(!d){
      const m=idx.get(nro)||null, estEv=normalizarEstado(f.estado);
      d={nro,m,sentido:String(f.tipo_movimiento||'').toUpperCase(),
        estadoEvento:estEv, estado:m?normalizarEstado(m.estado):estEv,
        emisor:f.emisor_nombre||(m&&m.emisor_nombre)||'', emisor_cuit:f.emisor_cuit||(m&&m.emisor_cuit)||'',
        renspa_origen:f.origen||(m&&m.renspa_origen)||'',
        receptor:f.receptor_nombre||(m&&m.receptor_nombre)||'', receptor_cuit:f.receptor_cuit||(m&&m.receptor_cuit)||'',
        renspa_destino:(m&&m.renspa_destino)||'',
        comprador:f.comprador||'', destino_es_feria:f.destino_es_feria, destino_es_frigorifico:f.destino_es_frigorifico,
        motivo:f.motivo||(m&&m.motivo_detalle)||'', apto:aptoVal(f.apto_china),
        fecha:(m&&m.fecha_carga)||f.fecha_movimiento||'', tipo:(m&&m.tipo)||'',
        cats:{}, catsRaw:{}, cab:0, rec:0, filas:[]};
      docs.set(nro,d);
    }
    const n=Number(f.enviado)||0, raw=f.categoria||'Sin categoría', key=canonizarCategoria(raw)||raw;
    d.cats[key]=(d.cats[key]||0)+n; d.catsRaw[raw]=(d.catsRaw[raw]||0)+n;
    d.cab+=n; d.rec+=Number(f.recibido)||0; d.filas.push(f);
  }
  const lista=[...docs.values()];
  const mk=()=>({dtes:0,cab:0,cats:{},excl:{dtes:0,cab:0},sinCierre:0});
  const tot={ENTRADA:mk(),SALIDA:mk(),OTRO:mk(),porEstado:{},dtes:lista.length};
  for(const d of lista){
    d.excluido=ESTADOS_EXCLUIDOS.has(d.estado);
    d.difEstado=!!d.m&&d.estado!==d.estadoEvento;
    const t=tot[d.sentido]||tot.OTRO;
    t.dtes++; tot.porEstado[d.estado]=(tot.porEstado[d.estado]||0)+1;
    if(d.excluido){t.excl.dtes++;t.excl.cab+=d.cab;continue;}
    if(ESTADOS_SIN_CIERRE.has(d.estado)) t.sinCierre++;
    t.cab+=d.cab;
    for(const [k,v] of Object.entries(d.cats)) t.cats[k]=(t.cats[k]||0)+v;
  }
  const mod={r,docs:lista,tot};
  _cacheModelos.set(r.codigo,mod);
  return mod;
}
function composicionHtml(cats){
  const ks=ordenCats(Object.keys(cats).filter(k=>cats[k]>0));
  if(!ks.length) return '<span class="dd-na">sin dato</span>';
  return ks.map(k=>'<span class="comp" title="'+esc(k)+'"><b>'+esc(abreviarCategoria(k))+'</b>'+fmtN(cats[k])+'</span>').join('');
}

// ── Multi-select (patrón existente de filtros) ──
function msDropdown(id,label,opts,sel){
  const allSel=!sel.length;
  const lbl=allSel?label:(sel.length===1?((opts.find(o=>o.v===sel[0])||{}).l||sel[0]):sel.length+' sel.');
  const items=opts.map(o=>'<label class="ms-item"><input type="checkbox" value="'+esc(o.v)+'" '+(sel.includes(o.v)?'checked':'')+'><span>'+esc(o.l)+'</span></label>').join('');
  return '<div class="ms-wrap" id="'+id+'"><button class="ms-btn select '+(allSel?'':'ms-active')+'" type="button">'+esc(lbl)+' <span class="ms-arrow">▾</span></button>'
    +'<div class="ms-panel" style="display:none"><label class="ms-item ms-all"><input type="checkbox" value="__all__" '+(allSel?'checked':'')+'>Todos</label>'+items+'</div></div>';
}
function bindMs(host,id,arr,redraw){
  const wrap=host.querySelector('#'+id); if(!wrap) return;
  const btn=wrap.querySelector('.ms-btn'), panel=wrap.querySelector('.ms-panel');
  btn.onclick=function(e){e.stopPropagation();host.querySelectorAll('.ms-panel').forEach(p=>{if(p!==panel)p.style.display='none';});panel.style.display=panel.style.display==='none'?'block':'none';};
  panel.querySelectorAll('input[type=checkbox]').forEach(chk=>chk.onchange=function(){
    if(this.value==='__all__') arr.length=0;
    else{const i=arr.indexOf(this.value); if(this.checked){if(i<0)arr.push(this.value);}else if(i>=0)arr.splice(i,1);}
    redraw({keepPanel:id});
  });
}
function toggleIn(arr,v){const i=arr.indexOf(v); if(i<0)arr.push(v); else arr.splice(i,1);}
// Conserva foco y cursor del input activo entre re-renders
function capturarFoco(host){
  const a=document.activeElement;
  if(!a||!host.contains(a)||!a.id) return null;
  return {id:a.id,s:a.selectionStart,e:a.selectionEnd};
}
function restaurarFoco(host,f){
  if(!f) return; const el=host.querySelector('#'+f.id); if(!el) return;
  el.focus(); try{if(f.s!=null)el.setSelectionRange(f.s,f.e);}catch(e){}
}
function estadoVacio(titulo,texto,accion){
  return '<div class="empty-state"><div class="empty-title">'+esc(titulo)+'</div>'+(texto?'<div class="empty-text">'+texto+'</div>':'')+(accion||'')+'</div>';
}
function errorCarga(k){
  const st=CARGA[k];
  return '<div class="empty-state is-error"><div class="empty-title">No se pudieron cargar los '+esc(FUENTES[k].label)+'</div>'
    +'<div class="empty-text mono">'+esc(FUENTES[k].url)+' · '+esc(st.error||'error')+'</div>'
    +'<button class="btn btn-ghost cyan btn-sm js-reintentar">↻ Reintentar</button></div>';
}

// ══════════════════════════════════════════════════════════════
// VISTA EVENTOS — consulta documental por evento
// Evento → resumen documental → filtrar DTE → detalle.
// Las cabezas son las DECLARADAS en los DTE (despachadas según SIGSA). No es recepción física.
// ══════════════════════════════════════════════════════════════
const ICO={
  chevL:'<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 3 5 8l5 5"/></svg>',
  chevR:'<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m6 3 5 5-5 5"/></svg>',
  chevD:'<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m3 6 5 5 5-5"/></svg>',
  cal:'<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4.5" width="14" height="12" rx="1.5"/><path d="M3 8.5h14M7 2.5v4M13 2.5v4"/></svg>',
  doc:'<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 2.5h7l3.5 3.5v11.5h-10.5z"/><path d="M12 2.5V6h3.5M7.5 10h5M7.5 13h5"/></svg>',
  grid:'<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/></svg>',
  refresh:'<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3"/></svg>',
  search:'<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>',
  dl:'<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10"/></svg>',
  x:'<svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m4 4 8 8M12 4l-8 8"/></svg>'
};

function renderEventos(){
  const host=document.createElement('div');
  const st={codigo:null,q:'',sentidos:[],estados:[],cats:[],motivos:[],aptos:[],sortKey:'fecha',sortDir:'desc',mas:false,picker:false,pq:'',limite:200};
  function limpiarFiltros(){st.q='';st.sentidos=[];st.estados=[];st.cats=[];st.motivos=[];st.aptos=[];st.limite=200;}
  function hayFiltros(){return !!(st.q||st.sentidos.length||st.estados.length||st.cats.length||st.motivos.length||st.aptos.length);}
  host.seleccionar=function(cod){ if(cod&&cod!==st.codigo){st.codigo=cod;limpiarFiltros();} st.picker=false; draw(); if(typeof setRuta==='function') setRuta('rem',st.codigo); };
  host.codigoActual=()=>st.codigo;
  host.refresh=()=>draw();
  // Un solo listener para cerrar paneles (antes se sumaba uno por cada render)
  document.addEventListener('click',e=>{
    if(!e.target.closest('.ms-wrap')){host.querySelectorAll('.ms-panel').forEach(p=>p.style.display='none');}
    if(st.picker&&!e.target.closest('.ev-picker')){st.picker=false;draw();}
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&st.picker){st.picker=false;draw();}});

  function filtrar(mod){
    let rows=mod.docs.filter(d=>
      (!st.sentidos.length||st.sentidos.includes(d.sentido))&&
      (!st.estados.length||st.estados.includes(d.estado))&&
      (!st.cats.length||st.cats.some(c=>(d.cats[c]||0)>0))&&
      (!st.motivos.length||st.motivos.includes(d.motivo))&&
      (!st.aptos.length||st.aptos.includes(d.apto))&&
      coincideBusqueda(st.q,[d.nro,d.emisor,d.emisor_cuit,d.renspa_origen,d.receptor,d.receptor_cuit,d.renspa_destino,d.comprador]));
    const k=st.sortKey, dir=st.sortDir==='asc'?1:-1;
    const val=d=>k==='fecha'?ymd(d.fecha)+d.nro:k==='cab'?d.cab:k==='estado'?String(ESTADO_ORDEN.indexOf(d.estado)).padStart(2,'0'):k==='destino'?(d.comprador||d.receptor):d[k];
    rows.sort((a,b)=>{const x=val(a),y=val(b);const c=(typeof x==='number'&&typeof y==='number')?x-y:String(x??'').localeCompare(String(y??''),'es',{numeric:true});return c*dir||a.nro.localeCompare(b.nro);});
    return rows;
  }

  function pickerHtml(evs){
    const q=st.pq.trim();
    const items=evs.filter(r=>coincideBusqueda(q,[r.codigo,aliasEvento(r.codigo),(r.info||{})['Predio ferial'],r.organizador,(r.info||{}).Inicio])).map(r=>{
      const mod=modeloEvento(r), info=r.info||{}, al=aliasEvento(r.codigo), est=String(info.Estado||'').toUpperCase();
      return '<button class="evp-item'+(r.codigo===st.codigo?' is-on':'')+'" data-cod="'+esc(r.codigo)+'">'
        +'<span class="evp-main"><span class="evp-name">'+esc(al||r.codigo)+'</span>'+(al?'<span class="evp-code mono">'+esc(r.codigo)+'</span>':'')+'</span>'
        +'<span class="evp-date mono">'+esc(info.Inicio||'—')+' → '+esc(info.Fin||'—')+'</span>'
        +'<span class="evp-num mono" title="DTE del evento">'+fmtN(mod.tot.dtes)+' DTE</span>'
        +'<span class="evp-num mono" title="Cabezas declaradas en DTE de entrada (sin anulados)">'+fmtN(mod.tot.ENTRADA.cab)+' cab</span>'
        +'<span class="ev-estado sm '+estadoCls(est)+'">'+esc(est||'s/d')+'</span>'
      +'</button>';
    }).join('');
    return '<div class="evp-panel"><div class="evp-search">'+ICO.search+'<input id="evp-q" class="input" placeholder="Buscar evento: alias, código, fecha…" value="'+esc(st.pq)+'"/></div>'
      +'<div class="evp-list">'+(items||'<div class="evp-empty">Ningún evento coincide.</div>')+'</div></div>';
  }

  function draw(opt){
    opt=opt||{};
    const foco=capturarFoco(host);
    const scrollPicker=(host.querySelector('.evp-list')||{}).scrollTop||0;
    if(!CARGA.remates.cargado){
      host.innerHTML='<div class="wrap">'+(CARGA.remates.estado==='pendiente'?estadoVacio('Cargando eventos…',''):errorCarga('remates'))+'</div>';
      const b=host.querySelector('.js-reintentar'); if(b) b.onclick=()=>window.refrescarDatos&&window.refrescarDatos();
      return;
    }
    const evs=eventosOrdenados();
    if(!evs.length){host.innerHTML='<div class="wrap">'+estadoVacio('Sin eventos','remates_maestro.json no informa eventos todavía.')+'</div>';return;}
    if(!st.codigo||!remateDe(st.codigo)) st.codigo=evs[0].codigo;
    const pos=evs.findIndex(r=>r.codigo===st.codigo);
    const r=evs[pos], info=r.info||{}, mod=modeloEvento(r), T=mod.tot;
    const alias=aliasEvento(r.codigo), estSig=String(info.Estado||'').toUpperCase();
    const ext=parseExtraccion(r.fecha_extraccion);
    const rows=filtrar(mod);

    // ── Barra de evento ──
    const toolbar='<div class="ev-toolbar">'
      +'<div class="ev-picker">'
        +'<button class="ev-picker-btn" id="ev-picker-btn" aria-expanded="'+st.picker+'"><span class="lbl">Evento</span><span class="val">'+esc(alias||r.codigo)+'</span><span class="ev-estado sm '+estadoCls(estSig)+'">'+esc(estSig||'s/d')+'</span>'+ICO.chevD+'</button>'
        +(st.picker?pickerHtml(evs):'')
      +'</div>'
      +'<div class="ev-nav">'
        +'<button class="icon-btn" id="ev-prev" '+(pos>=evs.length-1?'disabled':'')+' title="Evento anterior">'+ICO.chevL+'</button>'
        +'<span class="ev-pos mono">'+(pos+1)+' / '+evs.length+'</span>'
        +'<button class="icon-btn" id="ev-next" '+(pos<=0?'disabled':'')+' title="Evento más reciente">'+ICO.chevR+'</button>'
      +'</div>'
    +'</div>';

    // ── Tarjeta del evento ──
    const chipsCat=(sent)=>{
      const cats=T[sent].cats, ks=ordenCats(Object.keys(cats).filter(k=>cats[k]>0));
      if(!ks.length) return '<span class="dd-na">'+(T[sent].dtes?'sin cabezas declaradas vigentes':'sin DTE de '+sent.toLowerCase())+'</span>';
      return ks.map(k=>'<button class="tag tag-btn'+(st.cats.includes(k)?' is-on':'')+'" data-cat="'+esc(k)+'" title="Filtrar por '+esc(k)+'"><span>'+esc(k)+'</span> <span class="num">'+fmtN(cats[k])+'</span>'+(st.cats.includes(k)?'<span class="x">'+ICO.x+'</span>':'')+'</button>').join('');
    };
    const estadosKs=Object.keys(T.porEstado).sort(ordenEstado);
    const chipsEst=estadosKs.map(e=>'<button class="est-chip '+estadoCls(e)+(st.estados.includes(e)?' is-on':'')+'" data-est="'+esc(e)+'"><span class="dot"></span>'+esc(e)+' <b class="mono">'+T.porEstado[e]+'</b>'+(st.estados.includes(e)?'<span class="x">'+ICO.x+'</span>':'')+'</button>').join('');
    const excl=T.ENTRADA.excl.dtes+T.SALIDA.excl.dtes+T.OTRO.excl.dtes, exclCab=T.ENTRADA.excl.cab+T.SALIDA.excl.cab+T.OTRO.excl.cab;
    const sinC=T.ENTRADA.sinCierre+T.SALIDA.sinCierre+T.OTRO.sinCierre;
    const criterio='Cabezas declaradas = suma de cabezas despachadas que figuran en los DTE (SIGSA). No es recepción física. '
      +(excl?'Excluye '+excl+' DTE anulado'+(excl>1?'s':'')+'/eliminado'+(excl>1?'s':'')+' ('+fmtN(exclCab)+' cab.). ':'Sin DTE anulados ni eliminados. ')
      +(sinC?'Incluye '+sinC+' DTE vencido'+(sinC>1?'s':'')+'/caducado'+(sinC>1?'s':'')+'/sin arribo. ':'')
      +'Novillo agrupa Novillo y Novillito; MEJ agrupa Torito/MEJ.';
    const cons=(r.consignatarios||[]).map(c=>c.nombre).filter(Boolean);
    const card='<section class="ev-card">'
      +'<div class="ev-head">'
        +'<div class="ev-id">'
          +'<div class="ev-status"><span class="ev-estado '+estadoCls(estSig)+'">'+esc(estSig||'Sin estado')+'</span><span class="ev-status-src">estado informado por SIGSA</span></div>'
          +'<input class="remate-name ev-alias" data-codigo="'+esc(r.codigo)+'" placeholder="Nombrar evento…" value="'+esc(alias)+'" title="Alias local del evento (se guarda en este navegador)"/>'
          +'<div class="ev-code mono">'+esc(r.codigo)+'</div>'
          +'<div class="ev-meta"><span class="mono">'+esc(info.Inicio||'—')+' → '+esc(info.Fin||'—')+'</span>'
            +(info['Predio ferial']?'<span class="sep">·</span><span>Predio '+esc(info['Predio ferial'])+'</span>':'')
            +(r.organizador&&r.organizador!==info['Predio ferial']?'<span class="sep">·</span><span>Organiza '+esc(r.organizador)+'</span>':'')
          +'</div>'
          +(r.compartido&&cons.length?'<div class="ev-meta"><span class="ev-tag">Compartido</span>'+cons.map(esc).join('<span class="sep">·</span>')+'</div>':'')
        +'</div>'
        +'<div class="ev-stats">'
          +'<div class="stat-pill amber"><span class="num">'+fmtN(T.dtes)+'</span><span class="lbl">DTE</span><span class="sub mono">'+T.ENTRADA.dtes+' ent · '+T.SALIDA.dtes+' sal</span></div>'
          +'<div class="stat-pill"><span class="num">'+fmtN(T.ENTRADA.cab)+'</span><span class="lbl">Cab. declaradas</span><span class="sub mono">entrada</span></div>'
          +'<div class="stat-pill'+(T.SALIDA.dtes?'':' muted')+'"><span class="num">'+(T.SALIDA.dtes?fmtN(T.SALIDA.cab):'0')+'</span><span class="lbl">Cab. declaradas</span><span class="sub mono">'+(T.SALIDA.dtes?'salida':'sin DTE de salida')+'</span></div>'
        +'</div>'
      +'</div>'
      +'<div class="ev-rows">'
        +'<div class="ev-row"><span class="ev-row-lbl">Entrada</span><div class="ev-row-val">'+chipsCat('ENTRADA')+'</div></div>'
        +(T.SALIDA.dtes?'<div class="ev-row"><span class="ev-row-lbl">Salida</span><div class="ev-row-val">'+chipsCat('SALIDA')+'</div></div>':'')
        +'<div class="ev-row"><span class="ev-row-lbl">Estado DTE</span><div class="ev-row-val">'+chipsEst+'</div></div>'
      +'</div>'
      +'<div class="ev-criterio">'+esc(criterio)+'</div>'
      +'<div class="ev-foot">'
        +'<span class="ev-foot-src mono" title="Fecha en que el scraper leyó este evento de SIGSA">Extraído '+esc(fmtFH(ext,true))+(ext?' · '+esc(fmtRelDesde(ext)):'')+'</span>'
        +'<div class="ev-ops" title="Circuitos operativos de remitos — se mantienen acá hasta migrarlos a la app de Remates">'
          +'<span class="ev-ops-lbl">Remitos y enlaces</span>'
          +'<button class="btn btn-ghost btn-xs ver-ing-btn" data-codigo="'+esc(r.codigo)+'">Ingresos</button>'
          +'<button class="btn btn-ghost btn-xs ver-egr-btn" data-codigo="'+esc(r.codigo)+'">Egresos</button>'
          +'<button class="btn btn-ghost btn-xs link-rem-btn" data-codigo="'+esc(r.codigo)+'" data-tipo="ingreso">Link ingreso</button>'
          +'<button class="btn btn-ghost btn-xs link-rem-btn" data-codigo="'+esc(r.codigo)+'" data-tipo="egreso">Link egreso</button>'
        +'</div>'
      +'</div>'
    +'</section>';

    // ── Filtros ──
    const opt_=(arr,lbl)=>arr.map(v=>({v,l:lbl?lbl(v):v}));
    const sentidosAll=[...new Set(mod.docs.map(d=>d.sentido))].sort();
    const estadosAll=[...new Set(mod.docs.map(d=>d.estado))].sort(ordenEstado);
    const catsAll=ordenCats([...new Set(mod.docs.flatMap(d=>Object.keys(d.cats)))]);
    const motivosAll=[...new Set(mod.docs.map(d=>d.motivo).filter(Boolean))].sort();
    const masActivos=st.motivos.length+st.aptos.length;
    const filtros='<div class="filters-bar ev-filters">'
      +'<div class="filter-field search"><span class="lbl">Buscar</span><input class="input" id="ev-q" placeholder="N° DTE, productor, CUIT, RENSPA…" value="'+esc(st.q)+'"/></div>'
      +'<div class="filter-field"><span class="lbl">Sentido</span>'+msDropdown('f-sent','Todos',opt_(sentidosAll,v=>v==='ENTRADA'?'Entrada':v==='SALIDA'?'Salida':v),st.sentidos)+'</div>'
      +'<div class="filter-field"><span class="lbl">Estado</span>'+msDropdown('f-est','Todos',opt_(estadosAll),st.estados)+'</div>'
      +'<div class="filter-field"><span class="lbl">Categoría</span>'+msDropdown('f-cat','Todas',opt_(catsAll),st.cats)+'</div>'
      +'<button class="btn btn-ghost btn-sm'+(st.mas||masActivos?' ms-active':'')+'" id="f-mas">Más filtros'+(masActivos?' ('+masActivos+')':'')+'</button>'
      +(st.mas||masActivos?'<div class="filter-field"><span class="lbl">Motivo</span>'+msDropdown('f-mot','Todos',opt_(motivosAll),st.motivos)+'</div>'
        +'<div class="filter-field"><span class="lbl">Apto China</span>'+msDropdown('f-apto','Todos',[{v:'si',l:'Apto'},{v:'no',l:'No apto'},{v:'sin',l:'Sin dato'}],st.aptos)+'</div>':'')
      +'<div class="filter-actions">'
        +'<button class="btn btn-ghost btn-sm" id="f-clear" '+(hayFiltros()?'':'disabled')+'>Limpiar filtros</button>'
        +'<button class="btn btn-ghost cyan btn-sm" id="f-export" '+(rows.length?'':'disabled')+' title="Exporta los DTE que se ven en la consulta (una fila por categoría)">'+ICO.dl+' Excel · '+rows.length+' DTE</button>'
      +'</div>'
    +'</div>';
    const activos=[];
    if(st.q) activos.push(['q','','Búsqueda: “'+st.q+'”']);
    st.sentidos.forEach(v=>activos.push(['sent',v,'Sentido: '+v]));
    st.estados.forEach(v=>activos.push(['est',v,'Estado: '+v]));
    st.cats.forEach(v=>activos.push(['cat',v,'Categoría: '+v]));
    st.motivos.forEach(v=>activos.push(['mot',v,'Motivo: '+v]));
    st.aptos.forEach(v=>activos.push(['apto',v,'Apto China: '+APTO_LBL[v]]));
    const activosHtml=activos.length?'<div class="active-filters">'+activos.map(a=>'<button class="af-chip" data-k="'+a[0]+'" data-v="'+esc(a[1])+'">'+esc(a[2])+ICO.x+'</button>').join('')+'</div>':'';

    // ── Totales de la consulta ──
    const vig=rows.filter(d=>!d.excluido), exclQ=rows.length-vig.length;
    const cabQ=vig.reduce((s,d)=>s+d.cab,0);
    const cabCats=st.cats.length?vig.reduce((s,d)=>s+st.cats.reduce((a,c)=>a+(d.cats[c]||0),0),0):null;
    const porSent={}; vig.forEach(d=>{porSent[d.sentido]=(porSent[d.sentido]||0)+d.cab;});
    const consulta='<div class="q-totals">'
      +'<span class="q-lbl">Consulta</span>'
      +'<span><b class="mono">'+rows.length+'</b> de '+mod.docs.length+' DTE</span>'
      +'<span class="sep">·</span><span><b class="mono">'+fmtN(cabQ)+'</b> cab. declaradas'+(Object.keys(porSent).length>1?' <span class="muted">(ent '+fmtN(porSent.ENTRADA||0)+' · sal '+fmtN(porSent.SALIDA||0)+')</span>':'')+'</span>'
      +(cabCats!=null?'<span class="sep">·</span><span><b class="mono">'+fmtN(cabCats)+'</b> de '+esc(st.cats.join(', '))+'</span>':'')
      +(exclQ?'<span class="sep">·</span><span class="muted">'+exclQ+' anulado'+(exclQ>1?'s':'')+'/eliminado'+(exclQ>1?'s':'')+' listado'+(exclQ>1?'s':'')+', no suma'+(exclQ>1?'n':'')+'</span>':'')
    +'</div>';

    // ── Tabla ──
    const cols=[['sentido','',''],['nro','N° DTE','c-nro'],['fecha','Carga','c-fecha'],['emisor','Productor / origen','c-orig'],['destino','Destino / comprador','c-dest'],['motivo','Motivo','c-mot'],[null,'Composición','c-comp'],['cab','Cab.','c-cab num'],['estado','Estado','c-est'],[null,'','c-go']];
    const th=cols.map(([k,l,c])=>{
      if(!k) return '<th class="'+c+'">'+esc(l)+'</th>';
      const on=st.sortKey===k; return '<th class="sorter '+c+(on?' is-sorted':'')+'" data-sort="'+k+'">'+esc(l)+'<span class="sort-ico">'+(on?(st.sortDir==='asc'?'↑':'↓'):'↕')+'</span></th>';
    }).join('');
    const vis=rows.slice(0,st.limite);
    const body=vis.map(d=>{
      const dest=d.sentido==='SALIDA'&&d.comprador?d.comprador:d.receptor;
      const destSub=d.sentido==='SALIDA'&&d.comprador&&d.comprador!==d.receptor?d.receptor:d.renspa_destino;
      return '<tr class="dte-row'+(d.excluido?' is-excl':'')+'" data-dte="'+esc(d.nro)+'" tabindex="0">'
        +'<td class="c-sent"><span class="sent '+(d.sentido==='ENTRADA'?'ent':d.sentido==='SALIDA'?'sal':'')+'" title="'+esc(d.sentido)+'">'+(d.sentido==='ENTRADA'?'ENT':d.sentido==='SALIDA'?'SAL':esc(d.sentido.slice(0,3)))+'</span></td>'
        +'<td class="c-nro mono">'+esc(d.nro)+'</td>'
        +'<td class="c-fecha mono">'+esc(d.fecha||'—')+'</td>'
        +'<td class="c-orig"><span class="main" title="'+esc(d.emisor)+'">'+esc(d.emisor||'—')+'</span><span class="sub mono">'+esc(d.renspa_origen||'')+(d.emisor_cuit?' · '+esc(d.emisor_cuit):'')+'</span></td>'
        +'<td class="c-dest"><span class="main" title="'+esc(dest)+'">'+esc(dest||'—')+'</span><span class="sub mono">'+esc(destSub||'')+'</span></td>'
        +'<td class="c-mot">'+esc(d.motivo||'—')+'</td>'
        +'<td class="c-comp">'+composicionHtml(d.cats)+'</td>'
        +'<td class="c-cab num mono">'+fmtN(d.cab)+'</td>'
        +'<td class="c-est">'+estadoPill(d.estado,d.difEstado?'En el listado del evento figura '+d.estadoEvento:'')+(d.difEstado?'<span class="est-dif" title="El listado del evento informa '+esc(d.estadoEvento)+'">*</span>':'')+'</td>'
        +'<td class="c-go">'+ICO.chevR+'</td>'
      +'</tr>';
    }).join('');
    let tabla;
    if(!mod.docs.length) tabla=estadoVacio('El evento no tiene DTE informados','SIGSA todavía no lista documentos para '+esc(r.codigo)+'.');
    else if(!rows.length) tabla=estadoVacio('Ningún DTE coincide con la consulta','Probá con otros filtros.','<button class="btn btn-ghost cyan btn-sm js-clear">Limpiar filtros</button>');
    else tabla='<div class="tbl-scroll"><table class="dte-table doc-table"><thead><tr>'+th+'</tr></thead><tbody>'+body+'</tbody></table></div>'
      +(rows.length>vis.length?'<div class="more-row"><button class="btn btn-ghost btn-sm" id="ev-more">Mostrar '+Math.min(200,rows.length-vis.length)+' más · quedan '+(rows.length-vis.length)+'</button></div>':'')
      +(rows.some(d=>d.difEstado)?'<div class="tbl-note">* El estado mostrado es el del DTE; el listado del evento informa otro (ver detalle).</div>':'');

    host.innerHTML='<div class="wrap ev-wrap">'+toolbar+card+filtros+activosHtml
      +'<div class="table-wrap"><div class="table-head-bar"><span class="table-title">Documentos del evento</span>'+consulta+'</div>'+tabla+'</div></div>';

    // ── Listeners ──
    const $=s=>host.querySelector(s);
    $('#ev-picker-btn').onclick=e=>{e.stopPropagation();st.picker=!st.picker;st.pq='';draw();if(st.picker){const i=$('#evp-q');if(i)i.focus();}};
    if(st.picker){
      const l=$('.evp-list'); if(l) l.scrollTop=scrollPicker;
      const pi=$('#evp-q'); if(pi) pi.oninput=e=>{st.pq=e.target.value;draw();};
      host.querySelectorAll('.evp-item').forEach(b=>b.onclick=e=>{e.stopPropagation();host.seleccionar(b.dataset.cod);});
    }
    const prev=$('#ev-prev'); if(prev) prev.onclick=()=>{if(pos<evs.length-1)host.seleccionar(evs[pos+1].codigo);};
    const next=$('#ev-next'); if(next) next.onclick=()=>{if(pos>0)host.seleccionar(evs[pos-1].codigo);};
    host.querySelectorAll('.ev-alias').forEach(inp=>{
      inp.onchange=()=>{let n={};try{n=JSON.parse(localStorage.getItem('rem_nombres')||'{}')||{};}catch(e){} n[inp.dataset.codigo]=inp.value.trim();try{localStorage.setItem('rem_nombres',JSON.stringify(n));}catch(e){} };
      inp.onkeydown=e=>{if(e.key==='Enter')inp.blur();};
    });
    host.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{toggleIn(st.cats,b.dataset.cat);st.limite=200;draw();});
    host.querySelectorAll('[data-est]').forEach(b=>b.onclick=()=>{toggleIn(st.estados,b.dataset.est);st.limite=200;draw();});
    host.querySelectorAll('.af-chip').forEach(b=>b.onclick=()=>{
      const k=b.dataset.k,v=b.dataset.v, m={sent:st.sentidos,est:st.estados,cat:st.cats,mot:st.motivos,apto:st.aptos};
      if(k==='q') st.q=''; else toggleIn(m[k],v); draw();
    });
    const q=$('#ev-q'); if(q) q.oninput=e=>{st.q=e.target.value;st.limite=200;draw();};
    bindMs(host,'f-sent',st.sentidos,draw); bindMs(host,'f-est',st.estados,draw); bindMs(host,'f-cat',st.cats,draw);
    bindMs(host,'f-mot',st.motivos,draw); bindMs(host,'f-apto',st.aptos,draw);
    if(opt.keepPanel){const p=host.querySelector('#'+opt.keepPanel+' .ms-panel'); if(p) p.style.display='block';}
    $('#f-mas').onclick=()=>{st.mas=!st.mas;draw();};
    const clr=()=>{limpiarFiltros();draw();};
    $('#f-clear').onclick=clr; host.querySelectorAll('.js-clear').forEach(b=>b.onclick=clr);
    $('#f-export').onclick=()=>exportEvento(rows,r);
    const more=$('#ev-more'); if(more) more.onclick=()=>{st.limite+=200;draw();};
    host.querySelectorAll('.sorter').forEach(t=>t.onclick=()=>{const k=t.dataset.sort; if(st.sortKey===k) st.sortDir=st.sortDir==='asc'?'desc':'asc'; else {st.sortKey=k; st.sortDir=(k==='cab'||k==='fecha')?'desc':'asc';} draw();});
    host.querySelectorAll('.dte-row').forEach(tr=>{
      tr.onclick=()=>openDetalle(tr.dataset.dte);
      tr.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();openDetalle(tr.dataset.dte);}};
    });
    host.querySelectorAll('.ver-ing-btn').forEach(b=>b.onclick=()=>verIngresos(b.dataset.codigo));
    host.querySelectorAll('.ver-egr-btn').forEach(b=>b.onclick=()=>verEgresos(b.dataset.codigo));
    host.querySelectorAll('.link-rem-btn').forEach(b=>b.onclick=()=>mostrarLinkRemate(b.dataset.codigo,b.dataset.tipo));
    restaurarFoco(host,foco);
  }
  draw();
  return host;
}

// Export del evento: una fila por DTE × categoría (mismo grano que el export anterior) con el
// estado del DTE y la marca de si suma o no a las cabezas declaradas.
function exportEvento(docs,r){
  const filas=[];
  for(const d of docs) for(const f of d.filas) filas.push({
    evento:r.codigo, alias:aliasEvento(r.codigo), tipo_movimiento:f.tipo_movimiento, documento:d.nro, fecha_carga:d.fecha,
    emisor_nombre:d.emisor, emisor_cuit:d.emisor_cuit, renspa_origen:d.renspa_origen,
    receptor_nombre:d.receptor, receptor_cuit:d.receptor_cuit, renspa_destino:d.renspa_destino, comprador:f.comprador||'',
    categoria:f.categoria, motivo:f.motivo, apto_china:f.apto_china, estado_dte:d.estado, estado_listado_evento:d.estadoEvento,
    suma:d.excluido?'NO (anulado/eliminado)':'SI', enviado:Number(f.enviado)||0, recibido:Number(f.recibido)||0
  });
  exportToExcel(filas,[
    ['evento','Evento'],['alias','Alias'],['tipo_movimiento','Sentido'],['documento','Nro. DTE'],['fecha_carga','Fecha carga'],
    ['emisor_nombre','Emisor'],['emisor_cuit','CUIT Emisor'],['renspa_origen','RENSPA Origen'],
    ['receptor_nombre','Receptor'],['receptor_cuit','CUIT Receptor'],['renspa_destino','RENSPA Destino'],['comprador','Comprador'],
    ['categoria','Categoría'],['motivo','Motivo'],['apto_china','Apto China'],['estado_dte','Estado DTE'],['estado_listado_evento','Estado en listado del evento'],
    ['suma','Suma a declaradas'],['enviado','Cab. declaradas (despachadas)'],['recibido','Recibidas registradas en SIGSA']
  ],'Evento_'+String(r.codigo||'').replace(/[\/.]/g,'-'));
}

// ══════════════════════════════════════════════════════════════
// CONSULTA GLOBAL DE DTE — todo dtes_maestro.json, con indicadores DE LA CONSULTA
// (antes los KPI mostraban siempre el total del maestro aunque la tabla estuviera filtrada).
// ══════════════════════════════════════════════════════════════
function renderDtes(){
  const wrap=document.createElement('div');
  const ini={q:'',cons:'todas',est:'todos',periodo:'7d',fechaDesde:'',fechaHasta:'',sortKey:'fecha_carga',sortDir:'desc',limite:300};
  let st=Object.assign({},ini);
  wrap.refresh=()=>draw();
  const PERIODOS=[['hoy','Hoy'],['7d','Últimos 7 días'],['30d','Últimos 30 días'],['mes','Este mes'],['todo','Todos'],['custom','Personalizado']];
  // Grupos de estado para los indicadores (mismo criterio que en eventos)
  const GRUPOS=[
    ['cerr','Cerrados',e=>e==='CERRADO','cerrado'],
    ['tran','Emitidos / vigentes',e=>e==='EMITIDO'||e==='VIGENTE','emitido'],
    ['sinc','Vencidos / caducados / sin arribo',e=>ESTADOS_SIN_CIERRE.has(e),'vencido'],
    ['excl','Anulados / eliminados',e=>ESTADOS_EXCLUIDOS.has(e),'anulado']
  ];
  function rango(){
    const hoy=new Date(); hoy.setHours(23,59,59,999); const desde=new Date(); desde.setHours(0,0,0,0);
    if(st.periodo==='hoy') return {desde,hasta:hoy};
    if(st.periodo==='7d'){desde.setDate(desde.getDate()-7);return {desde,hasta:hoy};}
    if(st.periodo==='30d'){desde.setDate(desde.getDate()-30);return {desde,hasta:hoy};}
    if(st.periodo==='mes'){desde.setDate(1);return {desde,hasta:hoy};}
    if(st.periodo==='custom'){
      const d=st.fechaDesde?new Date(st.fechaDesde+'T00:00:00'):null, h=st.fechaHasta?new Date(st.fechaHasta+'T23:59:59'):null;
      return {desde:d,hasta:h};
    }
    return {desde:null,hasta:null};
  }
  const fechaDe=s=>{const p=String(s||'').split('/');return p.length===3?new Date(+p[2],+p[1]-1,+p[0]):null;};
  function draw(){
    const foco=capturarFoco(wrap);
    if(!CARGA.dtes.cargado){
      wrap.innerHTML='<div class="wrap">'+(CARGA.dtes.estado==='pendiente'?estadoVacio('Cargando DTE…',''):errorCarga('dtes'))+'</div>';
      const b=wrap.querySelector('.js-reintentar'); if(b) b.onclick=()=>window.refrescarDatos&&window.refrescarDatos();
      return;
    }
    const all=DATOS_DTES.dtes||[], ev=idxEventos(), {desde,hasta}=rango();
    let rows=all.filter(d=>{
      if(st.cons!=='todas'&&(d.consignataria||'')!==st.cons) return false;
      if(st.est!=='todos'&&normalizarEstado(d.estado)!==st.est) return false;
      if(desde||hasta){const fc=fechaDe(d.fecha_carga); if(!fc) return false; if(desde&&fc<desde) return false; if(hasta&&fc>hasta) return false;}
      return coincideBusqueda(st.q,[d.nro_dte,d.emisor_nombre,d.emisor_cuit,d.renspa_origen,d.receptor_nombre,d.receptor_cuit,d.renspa_destino,d.consignataria,d.usuario_faena_nombre]);
    });
    const k=st.sortKey, dir=st.sortDir==='asc'?1:-1;
    const sv=d=>k==='fecha_carga'||k==='fecha_vencimiento'?ymd(d[k])+d.nro_dte:k==='cab'?(cabDte(d)??-1):k==='estado'?normalizarEstado(d.estado):d[k];
    rows.sort((a,b)=>{const x=sv(a),y=sv(b);const c=(typeof x==='number'&&typeof y==='number')?x-y:String(x??'').localeCompare(String(y??''),'es',{numeric:true});return c*dir;});

    // Indicadores de la consulta
    const kp={n:rows.length,cab:0,sinCab:0}; GRUPOS.forEach(g=>kp[g[0]]=0);
    for(const d of rows){
      const e=normalizarEstado(d.estado); const gr=GRUPOS.find(g=>g[2](e)); if(gr) kp[gr[0]]++;
      if(!ESTADOS_EXCLUIDOS.has(e)){const c=cabDte(d); if(c==null) kp.sinCab++; else kp.cab+=c;}
    }
    const perLbl=(PERIODOS.find(p=>p[0]===st.periodo)||[])[1]||'';
    const alcance='Indicadores de la consulta: '+perLbl.toLowerCase()+(st.cons!=='todas'?' · '+st.cons:'')+(st.est!=='todos'?' · '+st.est:'')+(st.q?' · “'+st.q+'”':'')+' — '+fmtN(rows.length)+' de '+fmtN(all.length)+' DTE del maestro';
    const kpi='<div class="kpi-scope">'+esc(alcance)+'</div><div class="kpi-grid kpi-6">'
      +'<div class="kpi-card total"><span class="kpi-label">DTE en la consulta</span><span class="kpi-num'+(kp.n?'':' zero')+'">'+fmtN(kp.n)+'</span></div>'
      +GRUPOS.map(g=>'<div class="kpi-card st-'+g[3]+'"><span class="kpi-label">'+g[1]+'</span><span class="kpi-num'+(kp[g[0]]?'':' zero')+'">'+fmtN(kp[g[0]])+'</span></div>').join('')
      +'<div class="kpi-card total"><span class="kpi-label">Cab. declaradas</span><span class="kpi-num'+(kp.cab?'':' zero')+'">'+fmtN(kp.cab)+'</span>'
        +'<span class="kpi-sub">sin anulados'+(kp.sinCab?' · '+kp.sinCab+' DTE sin detalle (no suman)':'')+'</span></div>'
    +'</div>';

    const consOpts=[...CONSIGNATARIAS,...new Set(all.map(x=>x.consignataria).filter(v=>v&&!CONSIGNATARIAS.includes(v)))];
    const estOpts=[...new Set(all.map(x=>normalizarEstado(x.estado)).filter(Boolean))].sort(ordenEstado);
    const hay=st.q||st.cons!=='todas'||st.est!=='todos'||st.periodo!==ini.periodo;
    const filtros='<div class="filters-bar">'
      +'<div class="filter-field search"><span class="lbl">Buscar</span><input class="input" id="q" placeholder="N° DTE, productor, CUIT, RENSPA…" value="'+esc(st.q)+'"/></div>'
      +'<div class="filter-field"><span class="lbl">Período (carga)</span><select class="select" id="d-periodo">'+PERIODOS.map(([v,l])=>'<option value="'+v+'" '+(st.periodo===v?'selected':'')+'>'+l+'</option>').join('')+'</select>'
        +(st.periodo==='custom'?'<div class="date-pair"><input type="date" class="input" id="d-desde" value="'+esc(st.fechaDesde)+'" title="Desde"/><input type="date" class="input" id="d-hasta" value="'+esc(st.fechaHasta)+'" title="Hasta"/></div>':'')+'</div>'
      +'<div class="filter-field"><span class="lbl">Consignataria</span><select class="select" id="cons"><option value="todas">Todas</option>'+consOpts.map(v=>'<option '+(v===st.cons?'selected':'')+' value="'+esc(v)+'">'+esc(v)+'</option>').join('')+'</select></div>'
      +'<div class="filter-field"><span class="lbl">Estado</span><select class="select" id="est"><option value="todos">Todos</option>'+estOpts.map(v=>'<option '+(v===st.est?'selected':'')+' value="'+esc(v)+'">'+esc(v)+'</option>').join('')+'</select></div>'
      +'<div class="filter-actions">'
        +'<button class="btn btn-ghost btn-sm" id="d-clear" '+(hay?'':'disabled')+'>Limpiar filtros</button>'
        +'<button class="btn btn-ghost cyan btn-sm" id="d-export" '+(rows.length?'':'disabled')+' title="Exporta todos los DTE de la consulta">'+ICO.dl+' Excel · '+fmtN(rows.length)+' DTE</button>'
      +'</div></div>';

    const cols=[['consignataria','Consignataria',''],['nro_dte','N° DTE','c-nro'],['tipo','Tipo','c-tipo'],['emisor_nombre','Origen','c-orig'],
      ['receptor_nombre','Destino','c-dest'],['estado','Estado','c-est'],['fecha_carga','Carga','c-fecha'],['fecha_vencimiento','Venc.','c-fecha'],
      ['cab','Cab.','c-cab num'],[null,'Evento','c-ev'],[null,'','c-go']];
    const th=cols.map(([k,l,c])=>{if(!k) return '<th class="'+c+'">'+esc(l)+'</th>'; const on=st.sortKey===k; return '<th class="sorter '+c+(on?' is-sorted':'')+'" data-sort="'+k+'">'+esc(l)+'<span class="sort-ico">'+(on?(st.sortDir==='asc'?'↑':'↓'):'↕')+'</span></th>';}).join('');
    const vis=rows.slice(0,st.limite);
    const body=vis.map(d=>{
      const e=normalizarEstado(d.estado), c=cabDte(d), evr=ev.get(String(d.nro_dte));
      return '<tr class="dte-row'+(ESTADOS_EXCLUIDOS.has(e)?' is-excl':'')+'" data-dte="'+esc(d.nro_dte)+'" tabindex="0">'
        +'<td>'+prettyCons(d.consignataria)+'</td>'
        +'<td class="c-nro mono">'+esc(d.nro_dte)+'</td>'
        +'<td class="c-tipo mono">'+esc(d.tipo||'—')+'</td>'
        +'<td class="c-orig"><span class="main" title="'+esc(d.emisor_nombre||'')+'">'+esc(d.emisor_nombre||'—')+'</span><span class="sub mono">'+esc(d.renspa_origen||'')+(d.emisor_cuit?' · '+esc(d.emisor_cuit):'')+'</span></td>'
        +'<td class="c-dest"><span class="main" title="'+esc(d.receptor_nombre||'')+'">'+esc(d.receptor_nombre||'—')+'</span><span class="sub mono">'+esc(d.renspa_destino||'')+(d.receptor_cuit?' · '+esc(d.receptor_cuit):'')+'</span></td>'
        +'<td class="c-est">'+estadoPill(e,d.estado)+'</td>'
        +'<td class="c-fecha mono">'+esc(d.fecha_carga||'—')+'</td>'
        +'<td class="c-fecha mono">'+esc(d.fecha_vencimiento||'—')+'</td>'
        +'<td class="c-cab num mono">'+(c==null?'<span class="dd-na" title="Detalle no cargado">s/d</span>':fmtN(c))+'</td>'
        +'<td class="c-ev">'+(evr?'<button class="link-btn js-ev" data-cod="'+esc(evr.codigo)+'" title="'+esc(evr.codigo)+'">'+esc(aliasEvento(evr.codigo)||evr.codigo)+'</button>':'<span class="dd-na">—</span>')+'</td>'
        +'<td class="c-go">'+ICO.chevR+'</td>'
      +'</tr>';
    }).join('');
    const tabla=rows.length
      ?'<div class="tbl-scroll"><table class="dte-table doc-table global-table"><thead><tr>'+th+'</tr></thead><tbody>'+body+'</tbody></table></div>'
        +(rows.length>vis.length?'<div class="more-row"><button class="btn btn-ghost btn-sm" id="d-more">Mostrar '+Math.min(300,rows.length-vis.length)+' más · quedan '+fmtN(rows.length-vis.length)+'</button></div>':'')
      :estadoVacio(all.length?'Ningún DTE coincide con la consulta':'El maestro no tiene DTE',all.length?'Revisá el período: por defecto se muestran los últimos 7 días.':'',all.length?'<button class="btn btn-ghost cyan btn-sm js-clear">Limpiar filtros</button>':'');

    wrap.innerHTML='<div class="wrap">'+kpi+filtros
      +'<div class="table-wrap"><div class="table-head-bar"><span class="table-title">Documentos de tránsito</span><span class="table-count">'+fmtN(rows.length)+' de '+fmtN(all.length)+'</span></div>'+tabla+'</div></div>';

    const $=s=>wrap.querySelector(s);
    $('#q').oninput=e=>{st.q=e.target.value;st.limite=300;draw();};
    $('#cons').onchange=e=>{st.cons=e.target.value;st.limite=300;draw();};
    $('#est').onchange=e=>{st.est=e.target.value;st.limite=300;draw();};
    $('#d-periodo').onchange=e=>{st.periodo=e.target.value;st.limite=300;draw();};
    const dd=$('#d-desde'); if(dd) dd.onchange=e=>{st.fechaDesde=e.target.value;draw();};
    const dh=$('#d-hasta'); if(dh) dh.onchange=e=>{st.fechaHasta=e.target.value;draw();};
    const clr=()=>{st=Object.assign({},ini);draw();};
    $('#d-clear').onclick=clr; wrap.querySelectorAll('.js-clear').forEach(b=>b.onclick=clr);
    $('#d-export').onclick=()=>exportDtes(rows);
    const more=$('#d-more'); if(more) more.onclick=()=>{st.limite+=300;draw();};
    wrap.querySelectorAll('.sorter').forEach(t=>t.onclick=()=>{const k=t.dataset.sort; if(st.sortKey===k) st.sortDir=st.sortDir==='asc'?'desc':'asc'; else {st.sortKey=k;st.sortDir=(k==='fecha_carga'||k==='cab')?'desc':'asc';} draw();});
    wrap.querySelectorAll('.dte-row').forEach(tr=>{
      tr.onclick=e=>{if(e.target.closest('.js-ev')) return; openDetalle(tr.dataset.dte);};
      tr.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();openDetalle(tr.dataset.dte);}};
    });
    wrap.querySelectorAll('.js-ev').forEach(b=>b.onclick=e=>{e.stopPropagation(); if(window.irAEvento) window.irAEvento(b.dataset.cod);});
    restaurarFoco(wrap,foco);
  }
  draw(); return wrap;
}
function exportDtes(rows){
  const ev=idxEventos();
  const data=rows.map(d=>{const c=cabDte(d), e=ev.get(String(d.nro_dte)); return Object.assign({},d,{
    _estado_norm:normalizarEstado(d.estado), _cab:c==null?'':c, _evento:e?e.codigo:'', _alias:e?aliasEvento(e.codigo):'', _sentido:e?e.sentido:''});});
  exportToExcel(data,[
    ['consignataria','Consignataria'],['nro_dte','Nro. DTE'],['emisor_nombre','Emisor'],
    ['emisor_cuit','CUIT Emisor'],['renspa_origen','RENSPA Origen'],['receptor_nombre','Receptor'],
    ['receptor_cuit','CUIT Receptor'],['renspa_destino','RENSPA Destino'],['tipo','Tipo'],
    ['estado','Estado'],['_estado_norm','Estado (normalizado)'],['fecha_emision','Fecha Emisión'],['fecha_carga','Fecha Carga'],['fecha_vencimiento','Vencimiento'],
    ['motivo_detalle','Motivo'],['_cab','Cab. declaradas (despachadas)'],['usuario_faena_nombre','Usuario faena'],
    ['_evento','Evento'],['_alias','Alias evento'],['_sentido','Sentido en evento']
  ],'DTEs_Darwash');
}
const SB_URL='https://qkrrumlbvspbxjoxvxho.supabase.co';
const SB_KEY='sb_publishable_ZKjsxf9lkh4tgkhAayDvbA_6DOE7E6d';
// Clave de lectura de remitos (token con alcance lectura_egresos). NUNCA va escrita en el
// código (el repo es público): llega una vez por ?t=… en el link que pasa Darwash, o se pega
// cuando el dashboard la pide, y queda guardada en este navegador. El ?t= se saca de la barra.
const LECTURA_KEY='dw_lectura_egresos';
function leerLecturaToken(){try{return localStorage.getItem(LECTURA_KEY)||'';}catch(e){return '';}}
function guardarLecturaToken(v){try{if(v)localStorage.setItem(LECTURA_KEY,v);else localStorage.removeItem(LECTURA_KEY);}catch(e){}}
(function(){try{const u=new URL(location.href);const q=(u.searchParams.get('t')||'').trim();if(q){guardarLecturaToken(q);u.searchParams.delete('t');history.replaceState(null,'',u.pathname+u.search+u.hash);}}catch(e){}})();
// Clave de CARGA de remitos (token con alcance egreso), aparte de la de lectura: es la que
// llevan los links de egreso que arma el dashboard (&t=). Tampoco va en el código: llega una
// vez por ?te=… o se pide; se guarda en este navegador y se borra si la base la rechaza.
const CARGA_KEY='dw_carga_egreso';
const PEDIR_CARGA='Clave de CARGA de egresos (no la de lectura). Se guarda en este navegador.';
function leerCargaToken(){try{return localStorage.getItem(CARGA_KEY)||'';}catch(e){return '';}}
function guardarCargaToken(v){try{if(v)localStorage.setItem(CARGA_KEY,v);else localStorage.removeItem(CARGA_KEY);}catch(e){}}
(function(){try{const u=new URL(location.href);const q=(u.searchParams.get('te')||'').trim();if(q){guardarCargaToken(q);u.searchParams.delete('te');history.replaceState(null,'',u.pathname+u.search+u.hash);}}catch(e){}})();
function linkEgreso(codigo,tok){return 'https://darwashsa-ux.github.io/darwash-dte/egreso.html?remate='+encodeURIComponent(codigo)+'&t='+encodeURIComponent(tok);}
// Clave de carga válida para ese remate, o '' (y ya avisó por qué). Si no hay guardada, la pide.
// Se valida contra la base cada vez: una de lectura o una vencida no pasa y se borra.
async function claveCargaPara(codigo){
  let tok=leerCargaToken();
  if(!tok){
    tok=(prompt(PEDIR_CARGA)||'').trim();
    if(!tok) return '';
    guardarCargaToken(tok);
  }
  let r;
  try{
    const res=await fetch(SB_URL+'/rest/v1/rpc/cargadores_para_egreso',{
      method:'POST',
      headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({p_token:tok})
    });
    r=await res.json();
    if(!res.ok) r={ok:false,error:'http_'+res.status};
  }catch(e){ r={ok:false,error:'red'}; }
  if(r&&r.ok===true){
    if(r.remate&&r.remate!==codigo){ alert('La clave de carga guardada es del remate '+r.remate+', no de '+codigo+'. Pedí la clave de este remate.'); return ''; }
    return tok;
  }
  if(r&&r.error==='token_invalido'){ guardarCargaToken(''); alert('La clave de carga venció o no es válida (¿pegaste la de lectura?). Volvé a intentar para pegar la correcta.'); return ''; }
  alert('No se pudo verificar la clave de carga ('+((r&&r.error)||'error')+'). Reintentá.');
  return '';
}
// Botones "Registrar primer egreso" / "Nuevo egreso". La pestaña se abre dentro del clic (si no,
// el navegador la bloquea) y recién después se valida la clave; si no sirve, se cierra.
async function abrirEgreso(ev,codigo){
  if(ev) ev.preventDefault();
  if(!leerCargaToken()){ const v=(prompt(PEDIR_CARGA)||'').trim(); if(!v) return; guardarCargaToken(v); }
  const w=window.open('about:blank','_blank');
  const tok=await claveCargaPara(codigo);
  if(!tok){ if(w) w.close(); return; }
  if(w) w.location.href=linkEgreso(codigo,tok); else location.href=linkEgreso(codigo,tok);
}

// ── WhatsApp desde modal Ver Ingresos ────────────────────
function compartirWhatsAppReg(reg){
  var sep='\u2501'.repeat(18);
  var bull='\u2022';
  // Canonizar antes de listar (Novillito viejo se fusiona en Novillo; Mamón legacy preserva literal)
  var cats=Object.entries(agruparCategoriasReg(reg.categorias))
    .map(function(kv){return '  '+bull+' '+kv[0]+': '+kv[1];}).join('\n');
  var msg=''
    +'\uD83D\uDC04 *REMITO DE INGRESO \u2014 DARWASH SA*\n'
    +sep+'\n'
    +'\uD83D\uDCC5 '+(reg.fecha||'\u2014')+'  \uD83D\uDD50 '+(reg.hora_descarga||'\u2014')+'\n'
    +'\uD83D\uDCCB Remate: '+(reg.remate||'\u2014')+'\n'
    +(reg.nro_dte?'\uD83D\uDCC4 DTE: '+reg.nro_dte+'\n':'')
    +(reg.productor?'\uD83D\uDC64 Productor: '+reg.productor+'\n':'')
    +(reg.transportista?'\uD83D\uDE9B Transporte: '+reg.transportista+(reg.patente?' ('+reg.patente+')':'')+'\n':'')
    +sep+'\n'
    +'*HACIENDA:*\n'+(cats||'  Sin detalle')+'\n'
    +sep+'\n'
    +'*TOTAL: '+(reg.total_cabezas||0)+' cabezas*'
    +(reg.observaciones?'\n\n\uD83D\uDCAC _'+reg.observaciones+'_':'');
  // Copiar al portapapeles y abrir WhatsApp
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(msg).then(function(){
      window.open('https://wa.me/','_blank');
      setTimeout(function(){alert('\u2705 Mensaje copiado!\nPegalo en el chat de WhatsApp (Ctrl+V)');},800);
    }).catch(function(){
      window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
    });
  }else{
    window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
  }
}

// ── CATEGORÍAS disponibles para form de Ingreso/Egreso ──────
// 7 canónicas con capitalización original (compatible con lo guardado en Supabase ingresos_hacienda).
// Eliminados: 'Novillito' (unificado a 'Novillo') y 'Mamón' (descontinuado).
const CATS_INGRESO=['Novillo','Vaquillona','Vaca','Ternero','Ternera','Toro','Torito/MEJ'];

async function verIngresos(codigoRemate){
  const modalBg=document.getElementById('modalBg');
  const modal=document.getElementById('modal');
  modal.classList.add('modal-wide');
  const session=getSession();
  const esLeo=session&&session.email==='leoqui1991@gmail.com';
  let regsCache=[]; // shared con export

  function headerHtml(extraSubtitle){
    return '<div class="modal-head">'
      +'<div><div class="modal-title-top">Registros de ingreso</div><div class="modal-title is-code">'+esc(codigoRemate)+'</div>'
        +(extraSubtitle?'<div class="modal-title-top" style="margin-top:6px;margin-bottom:0">'+extraSubtitle+'</div>':'')
      +'</div>'
      +'<button id="closeModal" class="modal-close" aria-label="Cerrar">×</button>'
    +'</div>';
  }

  async function cargarYRenderizar(){
    modal.innerHTML=headerHtml()+'<div class="modal-body" style="text-align:center;color:var(--muted);padding:32px">Cargando registros…</div>';
    modalBg.style.display='flex';
    document.getElementById('closeModal').onclick=closeDetalle;

    const url=SB_URL+'/rest/v1/ingresos_hacienda?remate=eq.'+encodeURIComponent(codigoRemate)+'&order=ts.desc';
    const r=await fetch(url,{headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY}});
    const regs=await r.json();
    // Blindaje: Supabase devuelve objeto de error (no array) ante 4xx/5xx/RLS/JWT.
    // Distinguimos "respuesta inválida" (mostrar error real) de "array vacío" (sin registros).
    if(!r.ok || !Array.isArray(regs)){
      const det = (regs && (regs.message||regs.details||regs.hint))
        ? (regs.message||'') + (regs.details?' — '+regs.details:'') + (regs.hint?' ('+regs.hint+')':'')
        : 'Respuesta inesperada del servidor';
      regsCache=[];
      modal.innerHTML=headerHtml()
        +'<div class="modal-body"><div class="modal-feedback error">'
        +'⚠️ No se pudieron cargar los ingresos (HTTP '+r.status+')<br>'
        +'<span style="font-family:var(--mono);font-size:12px">'+esc(det)+'</span>'
        +'</div></div>';
      document.getElementById('closeModal').onclick=closeDetalle;
      return;
    }
    regsCache=regs;
    if(regs.length===0){
      modal.innerHTML=headerHtml()
        +'<div class="modal-body" style="text-align:center;color:var(--muted);padding:32px">Sin registros aún.<br><br>'
        +'<a href="ingreso.html?remate='+encodeURIComponent(codigoRemate)+'" target="_blank" style="color:var(--cyan)">→ Registrar primer ingreso</a>'
        +'</div>';
      document.getElementById('closeModal').onclick=closeDetalle;
      return;
    }

    const totalCabezas=regs.reduce((a,r)=>a+(r.total_cabezas||0),0);
    const catTotals={};
    regs.forEach(r=>{Object.entries(agruparCategoriasReg(r.categorias)).forEach(([k,v])=>{catTotals[k]=(catTotals[k]||0)+v;});});
    const catChips=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<span class="chip chip-ingreso">'+esc(k)+': '+v+'</span>').join('');

    const rows=regs.map(reg=>{
      const cats=Object.entries(agruparCategoriasReg(reg.categorias)).map(([k,v])=>'<span class="chip chip-ingreso">'+esc(k)+':'+v+'</span>').join('');
      const accionesBtns=[];
      accionesBtns.push('<button class="row-action-btn wa ing-wsp-btn" data-id="'+esc(reg.id)+'" title="Compartir por WhatsApp">💬</button>');
      if(esLeo){
        accionesBtns.push('<button class="row-action-btn ing-edit-btn" data-id="'+esc(reg.id)+'" title="Editar">✏️</button>');
        accionesBtns.push('<button class="row-action-btn danger ing-del-btn" data-id="'+esc(reg.id)+'" title="Eliminar">🗑</button>');
      }
      const accionesCell='<td><div class="row-actions">'+accionesBtns.join('')+'</div></td>';
      const pdfCell=reg.pdf_url
        ?'<td><a href="'+esc(reg.pdf_url)+'" target="_blank" style="color:var(--cyan);font-size:12px;white-space:nowrap">📄 PDF</a></td>'
        :'<td style="color:var(--muted);font-size:12px">—</td>';
      const fotosCell=(reg.fotos&&Object.keys(reg.fotos).length>0)
        ?'<td><div style="display:flex;gap:4px;flex-wrap:wrap">'+Object.values(reg.fotos).map(url=>'<a href="'+esc(url)+'" target="_blank"><img src="'+esc(url)+'" style="width:32px;height:32px;object-fit:cover;border-radius:4px;border:1px solid var(--border)"/></a>').join('')+'</div></td>'
        :'<td style="color:var(--muted);font-size:12px">—</td>';

      return '<tr data-id="'+esc(reg.id)+'">'
        +'<td style="white-space:nowrap;font-family:var(--mono);font-weight:500">'+esc(reg.hora_descarga||'—')+'</td>'
        +'<td style="white-space:nowrap;font-family:var(--mono);font-size:12px">'+esc(reg.fecha||'—')+'</td>'
        +'<td style="white-space:nowrap;font-family:var(--mono);font-size:12px;color:var(--cyan)">'+esc(reg.nro_dte||'—')+'</td>'
        +'<td>'+esc(reg.productor||'—')+'</td>'
        +'<td style="white-space:nowrap">'+esc(reg.transportista||'—')+(reg.patente?' <span style="color:var(--muted);font-family:var(--mono);font-size:11px">'+esc(reg.patente)+'</span>':'')+'</td>'
        +'<td class="num" style="font-weight:600;color:#00A86B">'+esc(reg.total_cabezas||0)+'</td>'
        +'<td>'+cats+'</td>'
        +'<td style="font-size:11px;color:var(--muted);font-style:italic;max-width:180px">'+esc(reg.observaciones||'')+'</td>'
        +pdfCell
        +fotosCell
        +accionesCell
        +'</tr>';
    }).join('');

    modal.innerHTML=headerHtml()
      +'<div class="modal-summary">'
        +'<div class="modal-summary-kpi"><span class="label">Total ingresado</span><span class="value is-ingreso">'+totalCabezas+' <span style="font-size:13px;color:var(--muted);font-weight:400">cab.</span></span></div>'
        +'<div class="modal-summary-chips">'+catChips+'</div>'
        +'<a href="ingreso.html?remate='+encodeURIComponent(codigoRemate)+'" target="_blank" class="btn-secondary" style="margin-left:auto;text-decoration:none">📋 Nuevo ingreso</a>'
      +'</div>'
      +'<div class="modal-body" style="padding-top:0">'
        +'<div class="modal-table-wrap" style="margin-top:8px"><table class="modal-table">'
        +'<thead><tr>'
        +'<th>Hora</th><th>Fecha</th><th>DTE</th><th>Productor</th><th>Transporte</th>'
        +'<th class="num">Cab.</th><th>Categorías</th><th>Obs.</th><th>PDF</th><th>Fotos</th><th></th>'
        +'</tr></thead><tbody>'+rows+'</tbody></table></div>'
      +'</div>'
      +'<div class="modal-footer">'
        +'<div id="ing-feedback"></div>'
        +'<button id="ing-export" class="btn-export">↓ Exportar Excel</button>'
      +'</div>';

    document.getElementById('closeModal').onclick=closeDetalle;
    document.getElementById('ing-export').onclick=()=>exportarIngresosExcel(regsCache, codigoRemate);

    // ── Listeners ──
    modal.querySelectorAll('.ing-wsp-btn').forEach(btn=>{
      btn.onclick=(e)=>{
        e.stopPropagation();
        const reg=regsCache.find(r=>String(r.id)===String(btn.dataset.id));
        if(reg) compartirWhatsAppReg(reg);
      };
    });
    if(esLeo){
      modal.querySelectorAll('.ing-edit-btn').forEach(btn=>{
        btn.onclick=(e)=>{e.stopPropagation(); mostrarFormEdicion(btn.dataset.id, regsCache, codigoRemate);};
      });
      modal.querySelectorAll('.ing-del-btn').forEach(btn=>{
        btn.onclick=(e)=>{e.stopPropagation(); confirmarEliminar(btn, codigoRemate);};
      });
    }
  }

  // ── Formulario de edición ─────────────────────────────
  function mostrarFormEdicion(id, regs, codigoRemate){
    modal.classList.remove('modal-wide');
    const reg=regs.find(r=>String(r.id)===String(id));
    if(!reg) return;
    const cats=agruparCategoriasReg(reg.categorias);
    const catInputs=CATS_INGRESO.map(cat=>
      '<div class="box">'
        +'<div class="box-label">'+esc(cat)+'</div>'
        +'<input type="number" min="0" id="ecat_'+cat.replace(/[^a-z]/gi,'_')+'" value="'+(cats[canonizarCategoria(cat)]||cats[cat]||0)+'" class="cat-input-pill">'
      +'</div>'
    ).join('');

    modal.innerHTML=
      '<div class="modal-head">'
        +'<div><div class="modal-title-top">Editando remito</div><div class="modal-title is-code">'+esc(reg.nro_dte||'—')+' · '+esc(reg.fecha||'—')+'</div></div>'
        +'<button id="closeModal" class="modal-close" aria-label="Cancelar">×</button>'
      +'</div>'
      +'<div class="modal-body">'
        +'<div class="grid-2">'
          +'<div><label class="form-label">Nro. DTE</label><input id="e_nro_dte" class="form-input" value="'+esc(reg.nro_dte||'')+'"></div>'
          +'<div><label class="form-label">Hora descarga</label><input id="e_hora" class="form-input" type="time" value="'+esc(reg.hora_descarga||'')+'"></div>'
          +'<div><label class="form-label">Productor / Procedencia</label><input id="e_productor" class="form-input" value="'+esc(reg.productor||'')+'"></div>'
          +'<div><label class="form-label">Transportista</label><input id="e_transportista" class="form-input" value="'+esc(reg.transportista||'')+'"></div>'
          +'<div><label class="form-label">Patente</label><input id="e_patente" class="form-input" value="'+esc(reg.patente||'')+'" style="text-transform:uppercase"></div>'
          +'<div><label class="form-label">Observaciones</label><input id="e_obs" class="form-input" value="'+esc(reg.observaciones||'')+'"></div>'
        +'</div>'
        +'<div class="section-header">Cantidad por categoría</div>'
        +'<div class="grid-3" style="grid-template-columns:repeat(4,1fr)">'+catInputs+'</div>'
        +'<div id="e_msg"></div>'
      +'</div>'
      +'<div class="modal-footer">'
        +'<button class="btn-secondary" id="e_cancel">Cancelar</button>'
        +'<button id="e_guardar" class="btn-primary">Guardar cambios</button>'
      +'</div>';

    document.getElementById('closeModal').onclick=()=>cargarYRenderizar();
    document.getElementById('e_cancel').onclick=()=>cargarYRenderizar();

    document.getElementById('e_guardar').onclick=async()=>{
      const btn=document.getElementById('e_guardar');
      const msg=document.getElementById('e_msg');
      msg.className='modal-feedback';
      msg.textContent='';
      btn.disabled=true; btn.textContent='Guardando…';

      const nuevasCats={};
      let total=0;
      CATS_INGRESO.forEach(cat=>{
        const inp=document.getElementById('ecat_'+cat.replace(/[^a-z]/gi,'_'));
        const v=parseInt(inp?.value||0)||0;
        if(v>0){nuevasCats[cat]=v; total+=v;}
      });
      for(const [k,v] of Object.entries(reg.categorias||{})){
        const n=Number(v||0);
        if(n>0 && !canonizarCategoria(k)){nuevasCats[k]=n; total+=n;}
      }

      const payload={
        nro_dte:document.getElementById('e_nro_dte').value.trim(),
        hora_descarga:document.getElementById('e_hora').value.trim(),
        productor:document.getElementById('e_productor').value.trim(),
        transportista:document.getElementById('e_transportista').value.trim(),
        patente:document.getElementById('e_patente').value.trim().toUpperCase(),
        observaciones:document.getElementById('e_obs').value.trim(),
        categorias:nuevasCats,
        total_cabezas:total,
      };

      try{
        const r=await fetch(SB_URL+'/rest/v1/ingresos_hacienda?id=eq.'+encodeURIComponent(id),{
          method:'PATCH',
          headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
          body:JSON.stringify(payload)
        });
        if(!r.ok) throw new Error('Error '+r.status);
        msg.className='modal-feedback success';
        msg.textContent='✅ Remito actualizado correctamente';
        setTimeout(()=>cargarYRenderizar(),1000);
      }catch(e){
        msg.className='modal-feedback error';
        msg.textContent='❌ Error al guardar: '+e.message;
        btn.disabled=false; btn.textContent='Guardar cambios';
      }
    };
  }

  // ── Confirmar eliminación ─────────────────────────────
  // Mejora vs versión previa: feedback visual (loading state + opacity + disabled),
  // mensaje de error inline en el footer del modal en vez de alert(), y stopPropagation
  // en el botón origen (ya lo hace el caller) para evitar bubble accidental al tr.
  function confirmarEliminar(btnEl, codigoRemate){
    const id=btnEl.dataset.id;
    const reg=regsCache.find(r=>String(r.id)===String(id));
    const refInfo=reg?(reg.nro_dte||reg.fecha||id):id;
    if(!confirm('⚠️ ¿Eliminar el remito '+refInfo+'?\n\nEsta acción no se puede deshacer.')) return;

    const feedback=document.getElementById('ing-feedback');
    const orig=btnEl.innerHTML;
    btnEl.disabled=true;
    btnEl.style.opacity='0.5';
    btnEl.innerHTML='…';
    if(feedback){feedback.className=''; feedback.textContent='';}

    fetch(SB_URL+'/rest/v1/ingresos_hacienda?id=eq.'+encodeURIComponent(id),{
      method:'DELETE',
      headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Prefer':'return=minimal'}
    }).then(r=>{
      if(!r.ok) throw new Error('HTTP '+r.status);
      cargarYRenderizar();
    }).catch(e=>{
      btnEl.disabled=false;
      btnEl.style.opacity='';
      btnEl.innerHTML=orig;
      if(feedback){
        feedback.className='modal-feedback error';
        feedback.textContent='❌ No se pudo eliminar: '+e.message;
      } else {
        alert('❌ No se pudo eliminar: '+e.message);
      }
    });
  }

  try{
    await cargarYRenderizar();
  }catch(e){
    modal.innerHTML=headerHtml()
      +'<div class="modal-body">'
        +'<div class="modal-feedback error">'+esc(e.message)+'</div>'
      +'</div>';
    document.getElementById('closeModal').onclick=closeDetalle;
  }
}

// Export Ingresos a Excel — flatten categorias + datos planos del registro.
function exportarIngresosExcel(regs, codigoRemate){
  if(!regs || regs.length===0){ alert('No hay datos para exportar'); return; }
  const data=regs.map(reg=>{
    const cats=agruparCategoriasReg(reg.categorias);
    const obj={
      'Fecha': reg.fecha||'',
      'Hora': reg.hora_descarga||'',
      'Nro DTE': reg.nro_dte||'',
      'Productor': reg.productor||'',
      'Transportista': reg.transportista||'',
      'Patente': reg.patente||'',
      'Total cabezas': reg.total_cabezas||0,
    };
    CATS_INGRESO.forEach(cat=>{ obj[cat]=cats[canonizarCategoria(cat)]||cats[cat]||0; });
    obj['Observaciones']=reg.observaciones||'';
    obj['PDF']=reg.pdf_url||'';
    return obj;
  });
  const safe=String(codigoRemate||'remate').replace(/[\/.]/g,'-');
  const filename='ingresos_'+safe;
  const cols=Object.keys(data[0]).map(k=>[k,k]);
  exportToExcel(data, cols, filename);
}

function exportToExcel(rows, cols, filename) {
  if (!rows || rows.length === 0) { alert('No hay datos para exportar.'); return; }
  try {
    const data = rows.map(r => {
      const obj = {};
      cols.forEach(([k, l]) => { obj[l] = r[k] != null ? r[k] : ''; });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(data, { header: cols.map(([,l]) => l) });
    const colWidths = cols.map(([k, l]) => {
      const max = Math.max(l.length, ...rows.map(r => String(r[k] ?? '').length));
      return { wch: Math.min(Math.max(max + 2, 10), 40) };
    });
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fname = filename + '_' + date + '.xlsx';
    // Descarga via Blob — más compatible con navegadores modernos
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  } catch(e) {
    alert('Error al exportar: ' + e.message);
    console.error('Export error:', e);
  }
}

// ── Ver Egresos modal ─────────────────────────────────────
async function verEgresos(codigoRemate){
  const modalBg=document.getElementById('modalBg');
  const modal=document.getElementById('modal');
  modal.classList.add('modal-wide');

  function headerHtml(){
    return '<div class="modal-head">'
      +'<div><div class="modal-title-top">Registros de egreso</div><div class="modal-title is-code">'+esc(codigoRemate)+'</div></div>'
      +'<button id="closeModal" class="modal-close" aria-label="Cerrar">×</button>'
    +'</div>';
  }

  modal.innerHTML=headerHtml()+'<div class="modal-body" style="text-align:center;color:var(--muted);padding:32px">Cargando egresos…</div>';
  modalBg.style.display='flex';
  document.getElementById('closeModal').onclick=closeDetalle;

  try{
    // Lectura por función con token: la key pública ya no lee la tabla (03_cerrar_egresos.sql).
    let lecturaToken=leerLecturaToken();
    if(!lecturaToken){
      const v=prompt('Clave de lectura de remitos (te la pasa Darwash). Se guarda en este navegador.');
      if(v&&v.trim()){ lecturaToken=v.trim(); guardarLecturaToken(lecturaToken); }
    }
    const res=await fetch(SB_URL+'/rest/v1/rpc/egresos_de_remate',{
      method:'POST',
      headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({p_token:lecturaToken,p_remate:codigoRemate})
    });
    const resp=await res.json();
    if(resp&&resp.error==='token_invalido') guardarLecturaToken('');   // vencida: la próxima vez se vuelve a pedir
    const rows=(resp&&resp.ok===true)?resp.filas
      :(resp&&resp.error==='token_invalido')?{message:'Falta o venció la clave de lectura de remitos. Abrí el link de lectura que te pasó Darwash, o cerrá y volvé a abrir este detalle para pegarla.'}
      :resp;
    // Error de Supabase (objeto, no array) NO es lo mismo que "sin egresos".
    if(!res.ok || !Array.isArray(rows)){
      const det = (rows && (rows.message||rows.details||rows.hint))
        ? (rows.message||'') + (rows.details?' — '+rows.details:'') + (rows.hint?' ('+rows.hint+')':'')
        : 'Respuesta inesperada del servidor';
      modal.innerHTML=headerHtml()
        +'<div class="modal-body"><div class="modal-feedback error">'
        +'⚠️ No se pudieron cargar los egresos (HTTP '+res.status+')<br>'
        +'<span style="font-family:var(--mono);font-size:12px">'+esc(det)+'</span>'
        +'</div></div>';
      document.getElementById('closeModal').onclick=closeDetalle;
      return;
    }
    if(!rows.length){
      modal.innerHTML=headerHtml()
        +'<div class="modal-body" style="text-align:center;color:var(--muted);padding:32px">Sin egresos registrados.<br><br>'
        +'<a href="#" data-remate="'+esc(codigoRemate)+'" onclick="abrirEgreso(event,this.dataset.remate)" style="color:#D63B47">→ Registrar primer egreso</a>'
        +'</div>';
      document.getElementById('closeModal').onclick=closeDetalle;
      return;
    }

    // los remitos anulados (v2) se listan, pero no suman
    const vivos=rows.filter(r=>!r.anulado_at);
    const sinDte=vivos.filter(r=>!r.dte_normalizado).length;
    const totalCab=vivos.reduce((a,r)=>a+(r.total_cabezas||0),0);
    const catTotals={};
    vivos.forEach(r=>{Object.entries(agruparCategoriasReg(r.categorias)).forEach(([k,v])=>{catTotals[k]=(catTotals[k]||0)+v;});});
    const catChips=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<span class="chip chip-egreso">'+esc(k)+': '+v+'</span>').join('');

    const filas=rows.map(r=>{
      const cats=Object.entries(agruparCategoriasReg(r.categorias))
        .map(([k,v])=>'<span class="chip chip-egreso">'+esc(k)+':'+v+'</span>').join('');
      const pdfCell=r.pdf_url
        ?'<td><a href="'+esc(r.pdf_url)+'" target="_blank" style="color:var(--cyan);font-size:12px;white-space:nowrap">📄 PDF</a></td>'
        :'<td style="color:var(--muted);font-size:12px">—</td>';
      const ts=r.ts?new Date(r.ts).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
      // DTE: el atado (validado) manda; lo tipeado sin validar se ve aparte
      const ORIG={cargado:'cargado',atado_auto:'atado auto',atado_manual:'atado a mano'};
      const dteCell=r.dte_normalizado
        ?esc(r.dte_normalizado)+'<br><span style="font-family:var(--sans);font-size:11px;color:var(--muted)">'+esc(ORIG[r.dte_origen]||r.dte_origen||'')+'</span>'
        :r.nro_dte?'<span style="color:var(--muted)">'+esc(r.nro_dte)+'</span><br><span style="font-family:var(--sans);font-size:11px;color:var(--amber)">sin validar</span>'
        :'<span style="font-family:var(--sans);font-size:11px;color:var(--amber)">sin DTE</span>';
      return '<tr'+(r.anulado_at?' style="opacity:.45"':'')+'>'
        +'<td style="font-family:var(--mono);font-size:12px;white-space:nowrap">'+esc(ts)+(r.version===2?' <span style="font-size:10px;color:var(--cyan)">v2</span>':'')+(r.anulado_at?'<br><span style="font-size:11px;color:#D63B47">anulado</span>':'')+'</td>'
        +'<td style="font-weight:600">'+esc(r.tropa||'—')+'</td>'
        +'<td style="font-family:var(--mono);font-size:12px;color:var(--cyan)">'+dteCell+'</td>'
        +'<td>'+esc(r.destino||'—')+'</td>'
        +'<td>'+esc(r.transportista||'—')+'</td>'
        +'<td class="num" style="font-weight:600;color:#D63B47">'+(r.total_cabezas||0)+'</td>'
        +'<td>'+cats+'</td>'
        +pdfCell
        +'</tr>';
    }).join('');

    modal.innerHTML=headerHtml()
      +'<div class="modal-summary">'
        +'<div class="modal-summary-kpi"><span class="label">Total egresado</span><span class="value is-egreso">'+totalCab+' <span style="font-size:13px;color:var(--muted);font-weight:400">cab.</span></span></div>'
        +'<div class="modal-summary-kpi"><span class="label">Registros</span><span class="value">'+vivos.length+'</span></div>'
        +'<div class="modal-summary-kpi"><span class="label">Sin DTE</span><span class="value"'+(sinDte?' style="color:var(--amber)"':'')+'>'+sinDte+'</span></div>'
        +'<div class="modal-summary-chips">'+catChips+'</div>'
        +'<button id="egr-atar" class="btn-secondary" style="margin-left:auto">🔗 Atar DTE</button>'
        +'<a href="#" data-remate="'+esc(codigoRemate)+'" onclick="abrirEgreso(event,this.dataset.remate)" class="btn-secondary" style="text-decoration:none">⬆ Nuevo egreso</a>'
      +'</div>'
      +'<div class="modal-body" style="padding-top:0">'
        +'<div class="modal-table-wrap" style="margin-top:8px"><table class="modal-table">'
        +'<thead><tr>'
        +'<th>Fecha</th><th>Tropa</th><th>DTE</th><th>Destino</th><th>Transportista</th>'
        +'<th class="num">Cab.</th><th>Categorías</th><th>PDF</th>'
        +'</tr></thead><tbody>'+filas+'</tbody></table></div>'
      +'</div>'
      +'<div class="modal-footer">'
        +'<div></div>'
        +'<button id="egr-export" class="btn-export">↓ Exportar Excel</button>'
      +'</div>';

    document.getElementById('closeModal').onclick=closeDetalle;
    document.getElementById('egr-export').onclick=()=>exportarEgresosExcel(rows, codigoRemate);
    document.getElementById('egr-atar').onclick=()=>verAtadoDte(codigoRemate, rows);
  }catch(e){
    modal.innerHTML=headerHtml()
      +'<div class="modal-body"><div class="modal-feedback error">'+esc(e.message)+'</div></div>';
    document.getElementById('closeModal').onclick=closeDetalle;
  }
}

// Export Egresos a Excel — flatten categorias + datos planos del registro.
function exportarEgresosExcel(rows, codigoRemate){
  if(!rows || rows.length===0){ alert('No hay datos para exportar'); return; }
  const data=rows.map(r=>{
    const cats=agruparCategoriasReg(r.categorias);
    const obj={
      'Fecha': r.ts?new Date(r.ts).toLocaleString('es-AR'):'',
      'Tropa': r.tropa||'',
      'Nro DTE': r.nro_dte||'',
      'Destino': r.destino||'',
      'Transportista': r.transportista||'',
      'Total cabezas': r.total_cabezas||0,
    };
    CATS_INGRESO.forEach(cat=>{ obj[cat]=cats[canonizarCategoria(cat)]||cats[cat]||0; });
    obj['PDF']=r.pdf_url||'';
    return obj;
  });
  const safe=String(codigoRemate||'remate').replace(/[\/.]/g,'-');
  const filename='egresos_'+safe;
  const cols=Object.keys(data[0]).map(k=>[k,k]);
  exportToExcel(data, cols, filename);
}

// ══════════════════════════════════════════════════════════════
// ATADO DE DTE POSTERIOR (remito v2 · V6b)
// Cruza los remitos de un remate con los DTE de feria de dtes_maestro.json y propone el DTE de cada
// remito sin DTE. La base no sabe qué DTE existen: la sugerencia se arma acá; atar_dte_egreso solo
// aplica las reglas (1 a 1, no pisa, no ata anulados).
// Niveles (los mismos de la simulación del diseño):
//   cargado  · el remito trae un nro_dte tipeado que es un DTE válido de esta feria
//   seguro   · fecha ±1 día, cabezas exactas y (mismo destino, nombre parecido o mismas categorías), único en las dos direcciones
//   probable · fecha ±2 días, cabezas ±2 y (mismo destino o nombre parecido), único en las dos direcciones
// Cargado y seguro se atan como 'atado_auto' (la misma regla que va a usar el script); probable y
// elegido a mano, como 'atado_manual'.
// ══════════════════════════════════════════════════════════════
// Clave de ATADO (token con alcance atado_dte). Como las otras: no va en el código; llega una vez
// por ?ta=… o se pega cuando se pide, queda en este navegador y se borra si la base la rechaza.
const ATADO_KEY='dw_atado_dte';
const PEDIR_ATADO='Clave de ATADO de DTE (no la de lectura ni la de carga). Se guarda en este navegador.';
function leerAtadoToken(){try{return localStorage.getItem(ATADO_KEY)||'';}catch(e){return '';}}
function guardarAtadoToken(v){try{if(v)localStorage.setItem(ATADO_KEY,v);else localStorage.removeItem(ATADO_KEY);}catch(e){}}
(function(){try{const u=new URL(location.href);const q=(u.searchParams.get('ta')||'').trim();if(q){guardarAtadoToken(q);u.searchParams.delete('ta');history.replaceState(null,'',u.pathname+u.search+u.hash);}}catch(e){}})();

function normDte(s){
  s=String(s||'').replace(/\s+/g,'');
  if(/^\d{9}\.\d$/.test(s)) s=s.replace('.','-');
  if(/^\d{10}$/.test(s)) s=s.slice(0,9)+'-'+s.slice(9);
  return /^\d{9}-\d$/.test(s)?s:null;
}
function diaIso(s){const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||''));return m?Date.UTC(+m[1],+m[2]-1,+m[3])/864e5:null;}
function diaDmy(s){const m=/^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(s||''));return m?Date.UTC(+m[3],+m[2]-1,+m[1])/864e5:null;}
const ATADO_STOP=new Set(('SA SAS SRL SOCIEDAD ANONIMA CIA Y DE LA EL LOS LAS DEL ESTABLECIMIENTO EST FRIGORIFICO FRIG PLANTA VAQ VACA VACAS NOV NOVILLO NOVILLOS TOROS TORO '+
  'TERNERO TERNEROS TERNERA TERNERAS VAQUILLONA VAQUILLONAS HEMBRAS MACHOS INV INVERNADA CONSUMO FAENA MIX OK TROPA CAMPO JUNTO CON SAN SANTA').split(' '));
function atadoToks(...xs){
  const out=new Set();
  for(const x of xs){
    const t=String(x||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toUpperCase();
    for(const w of (t.match(/[A-Z]{3,}/g)||[])) if(!ATADO_STOP.has(w)) out.add(w);
  }
  return out;
}
// ratio de difflib.SequenceMatcher (sin "junk"; las palabras son cortas)
function seqRatio(a,b){
  const bloques=(alo,ahi,blo,bhi)=>{
    let bi=alo,bj=blo,bk=0,prev={};
    for(let i=alo;i<ahi;i++){
      const cur={};
      for(let j=blo;j<bhi;j++) if(a[i]===b[j]){const k=(prev[j-1]||0)+1;cur[j]=k;if(k>bk){bi=i-k+1;bj=j-k+1;bk=k;}}
      prev=cur;
    }
    return bk?bk+bloques(alo,bi,blo,bj)+bloques(bi+bk,ahi,bj+bk,bhi):0;
  };
  const t=a.length+b.length; return t?2*bloques(0,a.length,0,b.length)/t:1;
}
function nombreCoincide(A,B){
  for(const x of A) for(const y of B) if(x===y||(x.length>=5&&y.length>=5&&seqRatio(x,y)>=0.8)) return true;
  return false;
}
const ATADO_GRUESA={novillo:'N',novillito:'N',toro:'T',torito:'T','torito/mej':'T',mej:'T',vaca:'VA',vaquillona:'VQ',ternero:'TE',ternera:'TE'};
function catsGruesa(pares){
  const m={};
  for(const [k,n] of pares){const g=ATADO_GRUESA[String(k).toLowerCase()]||k; m[g]=(m[g]||0)+(+n||0);}
  return Object.fromEntries(Object.entries(m).filter(([,v])=>v).sort());
}
const mismasCats=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function dtesDeFeria(codigo){
  return (DATOS_DTES.dtes||[]).filter(d=>d.renspa_origen===codigo&&!/^(ANULADO|ELIMINADO)/.test(d.estado||'')).map(d=>{
    const an=d.animales_detalle||[];
    return {nro:d.nro_dte,dia:diaDmy(d.fecha_emision),fecha:d.fecha_emision,
      total:+(d.total_despachados??d.cantidad_enviados??an.reduce((s,a)=>s+(+a.despachados||0),0))||0,
      cats:catsGruesa(an.map(a=>[a.categoria,a.despachados])),
      est:String(d.renspa_destino||'').toUpperCase().replace(/[^0-9A-Z]/g,'').slice(0,11),
      receptor:d.receptor_nombre||d.usuario_faena_nombre||'',
      nombres:atadoToks(d.receptor_nombre,d.usuario_faena_nombre)};
  });
}
// Devuelve {porId:{id→{nivel,dte,cands}}, dtes, libres}.
// nivel: atado | cargado | seguro | probable | ambiguo | sin_candidato | repetido | anulado
// repetido = tipeó un DTE válido que ya tiene otro remito (¿remito cargado dos veces?)
function calcularAtado(codigo,rows){
  const dtes=dtesDeFeria(codigo), dset=new Map(dtes.map(d=>[d.nro,d]));
  const porId={}, usados=new Set(), usadoPor=new Map();
  const rs=[];
  for(const r of rows){
    if(r.anulado_at){porId[r.id]={nivel:'anulado'};continue;}
    if(r.dte_normalizado){porId[r.id]={nivel:'atado',dte:r.dte_normalizado,origen:r.dte_origen};usados.add(r.dte_normalizado);usadoPor.set(r.dte_normalizado,r.id);continue;}
    rs.push({id:r.id,dia:diaIso(r.fecha),total:+r.total_cabezas||0,est:r.destino_establecimiento||null,
      cats:catsGruesa(Object.entries(r.categorias||{})),nombres:atadoToks(r.destino,r.tropa),tipeado:normDte(r.nro_dte)});
  }
  for(const r of rs){
    if(!r.tipeado||!dset.has(r.tipeado)) continue;
    if(usados.has(r.tipeado)){porId[r.id]={nivel:'repetido',otro:usadoPor.get(r.tipeado),tipeado:r.tipeado};continue;}
    porId[r.id]={nivel:'cargado',dte:r.tipeado};usados.add(r.tipeado);usadoPor.set(r.tipeado,r.id);
  }
  const destino=(r,d)=>!!r.est&&r.est===d.est;
  const estricto=(r,d)=>r.dia!=null&&d.dia!=null&&Math.abs(d.dia-r.dia)<=1&&d.total===r.total&&(destino(r,d)||nombreCoincide(r.nombres,d.nombres)||mismasCats(d.cats,r.cats));
  const tolerante=(r,d)=>r.dia!=null&&d.dia!=null&&Math.abs(d.dia-r.dia)<=2&&Math.abs(d.total-r.total)<=2&&(destino(r,d)||nombreCoincide(r.nombres,d.nombres));
  const pendientes=()=>rs.filter(r=>!porId[r.id]);
  const nivel=(nombre,pred)=>{
    const cand=new Map(pendientes().map(r=>[r.id,dtes.filter(d=>!usados.has(d.nro)&&pred(r,d))]));
    const inv=new Map();
    for(const [id,ds] of cand) for(const d of ds){if(!inv.has(d.nro))inv.set(d.nro,[]);inv.get(d.nro).push(id);}
    for(const [id,ds] of cand) if(ds.length===1&&inv.get(ds[0].nro).length===1){porId[id]={nivel:nombre,dte:ds[0].nro};usados.add(ds[0].nro);}
  };
  nivel('seguro',estricto);
  nivel('probable',tolerante);
  for(const r of pendientes()){
    // varios posibles: los que pasan alguna de las dos reglas pero no quedaron únicos
    const cands=dtes.filter(d=>!usados.has(d.nro)&&(estricto(r,d)||tolerante(r,d))).map(d=>d.nro);
    porId[r.id]={nivel:cands.length?'ambiguo':'sin_candidato',cands};
  }
  // DTE libres para elegir a mano, del más parecido al menos parecido (por remito)
  const libres=dtes.filter(d=>!usados.has(d.nro));
  for(const r of rs){
    const p=porId[r.id]; if(!['ambiguo','sin_candidato','repetido'].includes(p.nivel)) continue;
    p.opciones=libres.map(d=>({d,score:(r.dia!=null&&d.dia!=null?Math.abs(d.dia-r.dia):99)*10+Math.abs(d.total-r.total)}))
      .sort((x,y)=>x.score-y.score).map(x=>x.d.nro);
  }
  return {porId,dtes:dset,libres};
}
function resumenAtado(calc){
  const c={atado:0,cargado:0,seguro:0,probable:0,ambiguo:0,sin_candidato:0,repetido:0,anulado:0};
  for(const p of Object.values(calc.porId)) c[p.nivel]=(c[p.nivel]||0)+1;
  return c;
}

const ATADO_MSG={
  token_invalido:'La clave de atado venció o no es válida. Volvé a intentar para pegar la correcta.',
  token_otro_remate:'La clave de atado es de otro remate.',
  dte_ya_atado:'Ese remito ya tiene otro DTE atado.',
  dte_en_otro_remito:'Ese DTE ya está atado a otro remito',
  remito_anulado:'El remito está anulado.',
  remito_invalido:'El remito no existe.',
  dte_formato:'El número de DTE no tiene el formato correcto.',
  dte_cargado:'El DTE se cargó en el camión: no se desata desde acá.',
  motivo_requerido:'Falta el motivo.',
  sin_dte:'El remito no tiene DTE.'
};
function msgAtado(r){return (ATADO_MSG[r&&r.error]||('Error: '+((r&&r.error)||'desconocido')))+(r&&r.otro_id?' (N° '+r.otro_id+').':'');}
async function rpcAtado(fn,args){
  try{
    const res=await fetch(SB_URL+'/rest/v1/rpc/'+fn,{method:'POST',
      headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json'},body:JSON.stringify(args)});
    let d=null; try{d=await res.json();}catch(_){}
    if(!res.ok) return {ok:false,error:'http_'+res.status};
    return d&&typeof d==='object'?d:{ok:false,error:'respuesta_vacia'};
  }catch(e){return {ok:false,error:'red'};}
}
function claveAtado(){
  let t=leerAtadoToken();
  if(!t){t=(prompt(PEDIR_ATADO)||'').trim(); if(t) guardarAtadoToken(t);}
  return t;
}
async function atarUno(id,dte,origen){
  const tok=claveAtado(); if(!tok) return {ok:false,error:'cancelado'};
  const r=await rpcAtado('atar_dte_egreso',{p_token:tok,p_id:id,p_nro_dte:dte,p_origen:origen});
  if(r.error==='token_invalido') guardarAtadoToken('');
  return r;
}
async function cargarEgresosRemate(codigo){
  const tok=leerLecturaToken();
  const r=await rpcAtado('egresos_de_remate',{p_token:tok,p_remate:codigo});
  if(r.ok===true&&Array.isArray(r.filas)) return r.filas;
  throw new Error(r.error==='token_invalido'?'Falta o venció la clave de lectura de remitos.':'No se pudieron cargar los remitos ('+(r.error||'error')+').');
}

// Pantalla "Atar DTE" dentro del modal de egresos
async function verAtadoDte(codigoRemate,rowsIniciales){
  const modal=document.getElementById('modal');
  let rows=rowsIniciales, ocupado=false;
  const fmtDia=s=>String(s||'').split('-').reverse().join('/');
  const head=()=>'<div class="modal-head"><div><div class="modal-title-top">Atar DTE a los remitos</div><div class="modal-title is-code">'+esc(codigoRemate)+'</div></div>'
    +'<button id="closeModal" class="modal-close" aria-label="Cerrar">×</button></div>';
  const badge=(t,c)=>'<span style="display:inline-block;font-size:11px;font-weight:600;padding:1px 7px;border-radius:9px;border:1px solid '+c+';color:'+c+';white-space:nowrap">'+esc(t)+'</span>';
  const NIVEL={cargado:['tipeado en el remito','var(--cyan)'],seguro:['seguro','var(--green)'],probable:['probable','var(--amber)'],
    ambiguo:['varios posibles','var(--amber)'],sin_candidato:['sin candidato','var(--muted)'],repetido:['¿remito repetido?','#D63B47']};
  const ORIGEN={cargado:'cargado en el camión',atado_auto:'atado automático',atado_manual:'atado a mano'};
  const dteTxt=(calc,nro)=>{const d=calc.dtes.get(nro); return d?esc(nro)+' · '+esc(d.fecha)+' · '+d.total+' cab · '+esc(d.receptor||'—'):esc(nro)+' <span style="color:var(--muted)">(no está en el maestro)</span>';};
  const pl=(n,uno,varios)=>n+' '+(n===1?uno:varios);
  function render(msg){
    const calc=calcularAtado(codigoRemate,rows), c=resumenAtado(calc);
    const sinDte=rows.filter(r=>!r.anulado_at&&!r.dte_normalizado);
    const autos=sinDte.filter(r=>['cargado','seguro'].includes(calc.porId[r.id].nivel));
    const filaRem=r=>'<td style="font-family:var(--mono);font-size:12px;white-space:nowrap">N° '+r.id+'<br>'+esc(fmtDia(r.fecha))+(r.version===2?' '+badge('v2','var(--cyan)'):'')+'</td>'
      +'<td>'+esc(r.destino||'—')+(r.nro_dte?'<br><span style="font-size:11px;color:var(--muted)">tipeó: '+esc(r.nro_dte)+'</span>':'')+'</td>'
      +'<td class="num" style="font-weight:600">'+(r.total_cabezas||0)+'</td>';
    const filasSin=sinDte.map(r=>{
      const p=calc.porId[r.id], [t,col]=NIVEL[p.nivel];
      let sug, acc;
      if(p.dte){
        sug=badge(t,col)+'<br><span style="font-family:var(--mono);font-size:12px">'+dteTxt(calc,p.dte)+'</span>';
        acc='<button class="btn-secondary atd-atar" data-id="'+r.id+'" data-dte="'+esc(p.dte)+'" data-origen="'+(p.nivel==='probable'?'atado_manual':'atado_auto')+'">Atar</button>';
      }else{
        sug=badge(t,col)+(p.nivel==='repetido'?'<br><span style="font-size:12px;color:var(--muted)">El DTE '+esc(p.tipeado)+' que tipeó ya es del remito N° '+esc(p.otro)+'. Si es el mismo camión, anulá uno.</span>'
          :p.cands&&p.cands.length?'<br><span style="font-size:12px;color:var(--muted)">'+p.cands.map(esc).join(' · ')+'</span>':'');
        acc='<select class="atd-sel" data-id="'+r.id+'" style="max-width:260px;font-size:12px"><option value="">Elegir DTE…</option>'
          +(p.opciones||[]).map(n=>{const d=calc.dtes.get(n);return '<option value="'+esc(n)+'">'+esc(n)+' · '+esc(d.fecha)+' · '+d.total+' cab · '+esc((d.receptor||'').slice(0,24))+'</option>';}).join('')
          +'</select> <button class="btn-secondary atd-atar-sel" data-id="'+r.id+'">Atar</button>';
      }
      return '<tr>'+filaRem(r)+'<td>'+sug+'</td><td style="white-space:nowrap">'+acc+'</td></tr>';
    }).join('');
    const atados=rows.filter(r=>!r.anulado_at&&r.dte_normalizado);
    const filasAt=atados.map(r=>'<tr>'+filaRem(r)+'<td><span style="font-family:var(--mono);font-size:12px">'+dteTxt(calc,r.dte_normalizado)+'</span><br>'
      +badge(ORIGEN[r.dte_origen]||r.dte_origen,r.dte_origen==='cargado'?'var(--cyan)':'var(--green)')+'</td>'
      +'<td>'+(r.dte_origen==='cargado'?'':'<a href="#" class="atd-desatar" data-id="'+r.id+'" style="font-size:12px;color:var(--muted)">desatar</a>')+'</td></tr>').join('');
    const th='<thead><tr><th>Remito</th><th>Destino</th><th class="num">Cab.</th><th>DTE</th><th></th></tr></thead>';
    modal.innerHTML=head()
      +'<div class="modal-summary">'
        +'<div class="modal-summary-kpi"><span class="label">Sin DTE</span><span class="value">'+sinDte.length+'</span></div>'
        +'<div class="modal-summary-kpi"><span class="label">Con DTE</span><span class="value">'+atados.length+'</span></div>'
        +'<div class="modal-summary-chips" style="font-size:12px;color:var(--muted)">'
          +[c.cargado?pl(c.cargado,'tipeado','tipeados'):'',pl(c.seguro,'seguro','seguros'),pl(c.probable,'probable','probables'),
            pl(c.ambiguo,'con varios posibles','con varios posibles'),pl(c.sin_candidato,'sin candidato','sin candidato'),
            c.repetido?pl(c.repetido,'¿repetido?','¿repetidos?'):'',pl(calc.libres.length,'DTE de la feria sin remito','DTE de la feria sin remito')].filter(Boolean).join(' · ')+'</div>'
        +(autos.length?'<button id="atd-todos" class="btn-secondary" style="margin-left:auto">'+(autos.length===1?'Atar el seguro':'Atar los '+autos.length+' seguros')+'</button>':'')
      +'</div>'
      +'<div class="modal-body" style="padding-top:0">'
        +(msg?'<div class="modal-feedback '+(msg.error?'error':'')+'" style="margin:8px 0">'+esc(msg.texto)+'</div>':'')
        +(DATOS_DTES.fecha_extraccion?'<div style="font-size:12px;color:var(--muted);margin:6px 0">DTE al '+esc(fmtFH(parseExtraccion(DATOS_DTES.fecha_extraccion),true))+'. Un DTE más nuevo aparece cuando corre el scraper.</div>':'')
        +'<div class="modal-table-wrap" style="margin-top:8px"><table class="modal-table">'+th+'<tbody>'
          +(filasSin||'<tr><td colspan="5" style="text-align:center;color:var(--muted)">Todos los remitos tienen DTE.</td></tr>')+'</tbody></table></div>'
        +(atados.length?'<details style="margin-top:14px"><summary style="cursor:pointer;font-weight:600">Remitos con DTE ('+atados.length+')</summary>'
          +'<div class="modal-table-wrap" style="margin-top:8px"><table class="modal-table">'+th+'<tbody>'+filasAt+'</tbody></table></div></details>':'')
      +'</div>'
      +'<div class="modal-footer"><button id="atd-volver" class="btn-secondary">← Volver a los remitos</button><div></div></div>';
    document.getElementById('closeModal').onclick=closeDetalle;
    document.getElementById('atd-volver').onclick=()=>verEgresos(codigoRemate);
    modal.querySelectorAll('.atd-atar').forEach(b=>b.onclick=()=>accion(()=>atarUno(+b.dataset.id,b.dataset.dte,b.dataset.origen),'N° '+b.dataset.id+' atado a '+b.dataset.dte+'.'));
    modal.querySelectorAll('.atd-atar-sel').forEach(b=>b.onclick=()=>{
      const s=modal.querySelector('.atd-sel[data-id="'+b.dataset.id+'"]'); if(!s||!s.value){alert('Elegí un DTE de la lista.');return;}
      accion(()=>atarUno(+b.dataset.id,s.value,'atado_manual'),'N° '+b.dataset.id+' atado a '+s.value+'.');
    });
    modal.querySelectorAll('.atd-desatar').forEach(a=>a.onclick=e=>{
      e.preventDefault(); const m=(prompt('¿Por qué se desata el DTE del remito N° '+a.dataset.id+'?')||'').trim(); if(!m) return;
      accion(async()=>{const tok=claveAtado(); if(!tok) return {ok:false,error:'cancelado'};
        const r=await rpcAtado('desatar_dte_egreso',{p_token:tok,p_id:+a.dataset.id,p_motivo:m}); if(r.error==='token_invalido') guardarAtadoToken(''); return r;},
        'N° '+a.dataset.id+': DTE desatado.');
    });
    const bt=document.getElementById('atd-todos');
    if(bt) bt.onclick=()=>{
      if(!confirm('Se van a atar '+autos.length+' remitos con su DTE seguro o tipeado. ¿Seguir?')) return;
      accion(async()=>{
        let ok=0; const errs=[];
        for(const r of autos){const p=calc.porId[r.id]; const x=await atarUno(r.id,p.dte,'atado_auto');
          if(x.ok) ok++; else {errs.push('N° '+r.id+': '+msgAtado(x)); if(x.error==='token_invalido'||x.error==='cancelado') break;}}
        return errs.length?{ok:false,error:'varios',texto:ok+' atados. No se pudieron: '+errs.join(' · ')}:{ok:true,texto:ok+' remitos atados.'};
      });
    };
  }
  async function accion(fn,okTxt){
    if(ocupado) return; ocupado=true;
    modal.querySelectorAll('button,select').forEach(x=>x.disabled=true);
    let r; try{ r=await fn(); }catch(e){ r={ok:false,error:'red'}; }
    if(r&&r.error==='cancelado'){ocupado=false;render();return;}
    let msg=r&&r.ok?{texto:r.texto||(r.sin_cambio?'Ya estaba atado.':okTxt)}:{error:true,texto:(r&&r.texto)||msgAtado(r)};
    try{ rows=await cargarEgresosRemate(codigoRemate); }catch(e){ msg={error:true,texto:msg.texto+' · '+e.message}; }
    ocupado=false; render(msg);
  }
  render();
}

// ── Estado de las fuentes en el encabezado + aviso si una actualización falló ──
function pillFuente(k){
  const st=CARGA[k], f=FUENTES[k], d=fechaExtraccion(k);
  const viejo=d&&(Date.now()-d.getTime())>24*3600e3;
  const cls=st.estado==='error'?'err':viejo?'stale':st.cargado?'ok':'';
  const tit='Extracción SIGSA (scraper) de '+f.url+(d?': '+fmtFH(d,true):'')+(st.consultado?' · consultado '+fmtHora(st.consultado):'')+(st.estado==='error'?' · última actualización falló: '+st.error:'');
  return '<div class="src '+cls+'" title="'+esc(tit)+'"><span class="src-dot"></span><span class="src-lbl">'+esc(f.label)+'</span>'
    +'<span class="src-val mono">'+(d?esc(fmtFH(d)):'sin dato')+'</span>'+(d?'<span class="src-rel">'+esc(fmtRelDesde(d))+'</span>':'')+'</div>';
}
function renderEstadoDatos(){
  const el=document.getElementById('fuentes'); if(!el) return;
  el.innerHTML=Object.keys(FUENTES).map(pillFuente).join('');
  const cons=Object.values(CARGA).map(x=>x.consultado).filter(Boolean).sort((a,b)=>b-a)[0];
  const ce=document.getElementById('consultado'); if(ce) ce.textContent=cons?'consultado '+fmtHora(cons):'';
  const ms=document.getElementById('mobile-src');
  if(ms) ms.innerHTML='<span class="ms-k">Extracción SIGSA</span>'+Object.keys(FUENTES).map(k=>{const d=fechaExtraccion(k),st=CARGA[k];
    return '<span class="'+(st.estado==='error'?'err':'')+'">'+esc(FUENTES[k].label)+' '+(d?esc(fmtFH(d)):'sin dato')+'</span>';}).join('<span class="sep">·</span>');
  const bn=document.getElementById('data-banner'); if(!bn) return;
  const errs=Object.keys(FUENTES).filter(k=>CARGA[k].estado==='error');
  bn.innerHTML=errs.map(k=>{
    const f=FUENTES[k], st=CARGA[k], d=fechaExtraccion(k);
    return '<div class="data-banner '+(st.cargado?'warn':'err')+'"><span class="db-ico">!</span><span>'
      +(st.cargado?'No se pudo actualizar <b>'+esc(f.label)+'</b> ('+esc(st.error)+'). Se muestran los datos extraídos el <b class="mono">'+esc(fmtFH(d,true))+'</b>.'
        :'No se pudieron cargar los <b>'+esc(f.label)+'</b> ('+esc(st.error)+').')
      +'</span><button class="btn btn-ghost btn-xs js-reintentar-top">↻ Reintentar</button></div>';
  }).join('');
  bn.querySelectorAll('.js-reintentar-top').forEach(b=>b.onclick=()=>window.refrescarDatos&&window.refrescarDatos());
}
async function iniciarApp(){
  app.innerHTML='<div class="boot"><img src="drw-icon.png" alt="Darwash" class="boot-logo"><div class="boot-txt mono">Cargando documentos SIGSA…</div></div>';
  await cargarDatos(false);
  renderApp();
}
function renderApp(){
  const s=getSession();
  if(!s) return renderLogin();
  (window._dwTimers||[]).forEach(clearInterval); window._dwTimers=[];

  app.innerHTML=''
    +'<div class="app-shell">'
    +  '<aside class="sidebar" id="sidebar">'
    +    '<div class="sidebar-brand">'
    +      '<div class="brand-logo-mark"><img src="drw-icon.png" alt="Darwash"></div>'
    +      '<div class="brand-wordmark">Darwash</div>'
    +      '<button class="sidebar-toggle" id="sidebar-toggle" title="Colapsar menú" aria-label="Colapsar menú"><span class="toggle-icon">‹</span></button>'
    +    '</div>'
    +    '<nav class="sidebar-nav">'
    +      '<div class="nav-section-label">Consulta documental</div>'
    +      '<button class="nav-item active" data-view="rem" data-tooltip="Eventos"><span class="nav-icon">'+ICO.cal+'</span><span class="nav-label">Eventos</span></button>'
    +      '<button class="nav-item" data-view="dte" data-tooltip="Todos los DTE"><span class="nav-icon">'+ICO.doc+'</span><span class="nav-label">Todos los DTE</span></button>'
    +      '<div class="nav-section-label nav-legacy">Operativo · pasa a Remates</div>'
    +      '<button class="nav-item nav-item-legacy" data-view="feria" data-tooltip="Feria en Vivo (heredado)"><span class="nav-icon">'+ICO.grid+'</span><span class="nav-label">Feria en Vivo</span></button>'
    +    '</nav>'
    +    '<div class="sidebar-footer"><div class="sidebar-version">v1.1 · documental</div></div>'
    +  '</aside>'
    +  '<div class="sidebar-overlay" id="sidebar-overlay"></div>'
    +  '<div class="main-area">'
    +    '<header class="topbar">'
    +      '<button class="hamburger" id="hamburger" aria-label="Menú">☰</button>'
    +      '<div class="topbar-title">'
    +        '<div class="topbar-main">SIGSA / SENASA</div>'
    +        '<div class="topbar-sub">DOCUMENTOS DE TRÁNSITO</div>'
    +      '</div>'
    +      '<div class="topbar-right">'
    +        '<div class="sources" id="fuentes"></div>'
    +        '<div class="refresh-box"><button class="icon-btn" id="refreshBtn" title="Volver a leer los datos publicados">'+ICO.refresh+'</button><span class="consultado mono" id="consultado"></span></div>'
    +        '<div class="user-pill">'
    +          '<span class="user-name" id="user-name">'+esc(s.nombre)+'</span>'
    +          '<button id="logoutBtn" class="logout-btn">Salir</button>'
    +        '</div>'
    +      '</div>'
    +    '</header>'
    +    '<div id="mobile-src" class="mobile-src mono"></div>'
    +    '<div id="data-banner" class="data-banner-wrap"></div>'
    +    '<main class="content-area" id="content"></main>'
    +  '</div>'
    +'</div>';

  const content=document.getElementById('content');
  const remView=renderEventos();
  const dteView=renderDtes();
  const feriaView=(()=>{
    const root=document.createElement('div');
    let lastFetchTs=null, pollHandle=null, lastDataHash=null, firstLoad=true;
    let tropaByCodigo=new Map(); // codigo_tropa → tropa (poblado en draw)

    const PALETTE=['#E6F8F8','#E6F7EF','#FBF3DC','#FCE8EA','#E8F0FA','#F5F4EE','#F0E8FA','#FAE8F0'];
    const colorEmpresa=(s)=>{
      if(!s) return 'transparent';
      let h=0; for(let i=0;i<s.length;i++) h=((h<<5)-h+s.charCodeAt(i))|0;
      return PALETTE[Math.abs(h)%PALETTE.length];
    };
    const fmtRel=(iso)=>{
      if(!iso) return '—';
      const m=Math.floor((Date.now()-new Date(iso).getTime())/60000);
      if(m<1) return 'recién';
      if(m<60) return 'hace '+m+' min';
      const h=Math.floor(m/60);
      if(h<24) return 'hace '+h+' h';
      return 'hace '+Math.floor(h/24)+' d';
    };
    const fmtDesde=(iso)=>{
      if(!iso) return '—';
      const d=new Date(iso);
      return d.toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    };

    const fetchData=async()=>{
      const h={apikey:SB_KEY,Authorization:'Bearer '+SB_KEY};
      const [tR,mR]=await Promise.all([
        fetch(SB_URL+'/rest/v1/tropas?estado=eq.activa&select=*&order=created_at.desc',{headers:h}),
        fetch(SB_URL+'/rest/v1/movimientos_corral?select=*&order=created_at.desc',{headers:h})
      ]);
      if(!tR.ok) throw new Error('tropas HTTP '+tR.status);
      if(!mR.ok) throw new Error('movimientos_corral HTTP '+mR.status);
      return {tropas:await tR.json(), movs:await mR.json()};
    };

    const computeStock=(tropas,movs)=>{
      // Accounting por movimiento: +cabezas en destino, -cabezas en origen.
      // Balance por (corral, tropa); sólo aparece si queda > 0.
      const tropaById=new Map(tropas.map(t=>[t.id,t]));
      const movsAsc=movs.slice().reverse(); // movs viene desc, acumular cronológicamente
      const balance=new Map(); // corral → Map<tropa_id, {tropa, cabezas, lastInMov}>
      for(const m of movsAsc){
        const tropa=tropaById.get(m.tropa_id);
        if(!tropa) continue;
        const cab=parseInt(m.cabezas,10)||0;
        if(m.corral_destino){
          if(!balance.has(m.corral_destino)) balance.set(m.corral_destino,new Map());
          const inner=balance.get(m.corral_destino);
          const cur=inner.get(m.tropa_id)||{tropa,cabezas:0,lastInMov:null};
          cur.cabezas+=cab; cur.lastInMov=m;
          inner.set(m.tropa_id,cur);
        }
        if(m.corral_origen){
          if(!balance.has(m.corral_origen)) balance.set(m.corral_origen,new Map());
          const inner=balance.get(m.corral_origen);
          const cur=inner.get(m.tropa_id)||{tropa,cabezas:0,lastInMov:null};
          cur.cabezas-=cab;
          inner.set(m.tropa_id,cur);
        }
      }
      const rows=[];
      for(const [corral,inner] of balance){
        for(const [,data] of inner){
          if(data.cabezas<=0) continue;
          const t=data.tropa, m=data.lastInMov;
          rows.push({
            corral,
            empresa:t.empresa||t.propietario||'—',
            categoria:t.categoria||'—',
            cabezas:data.cabezas,
            desde:m?m.created_at:t.created_at,
            codigo:t.codigo_tropa
          });
        }
      }
      rows.sort((a,b)=>{
        const an=parseInt(a.corral,10),bn=parseInt(b.corral,10);
        if(!isNaN(an)&&!isNaN(bn)&&an!==bn) return an-bn;
        return String(a.corral).localeCompare(String(b.corral));
      });
      return rows;
    };

    const drawError=(msg)=>{
      root.innerHTML='<div style="padding:48px 24px;max-width:520px;margin:0 auto;">'
        +'<div style="background:var(--red-soft);border:1px solid var(--red);border-left:3px solid var(--red);border-radius:8px;padding:24px;text-align:center;">'
          +'<div style="font-family:var(--serif);font-size:18px;font-weight:600;color:var(--red);margin-bottom:8px;">Error de conexión</div>'
          +'<div style="font-family:var(--mono);font-size:11px;color:var(--text-2);margin-bottom:18px;word-break:break-word;">'+esc(msg)+'</div>'
          +'<button class="feria-retry" style="padding:10px 18px;background:var(--cyan);color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:var(--sans);font-size:13px;">↻ Reintentar</button>'
        +'</div></div>';
      const b=root.querySelector('.feria-retry'); if(b) b.onclick=()=>load(true);
    };

    // ===== MODAL DE TROPA (singleton montado sobre document.body) =====
    // NO va sobre root: cada draw() hace root.innerHTML='...' y borraría el modal.
    // Limpiamos cualquier instancia previa por si renderApp() se re-ejecuta.
    const prevModal=document.getElementById('feria-tropa-modal-bg');
    if(prevModal) prevModal.remove();
    const tropaModalBg=document.createElement('div');
    tropaModalBg.id='feria-tropa-modal-bg';
    tropaModalBg.style.cssText='display:none;position:fixed;inset:0;background:rgba(26,26,26,0.55);z-index:9999;align-items:center;justify-content:center;padding:24px;';
    const tropaModal=document.createElement('div');
    tropaModal.style.cssText='background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--cyan);border-radius:8px;padding:22px 24px;max-width:520px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 40px rgba(0,0,0,0.15);';
    tropaModalBg.appendChild(tropaModal);
    tropaModalBg.addEventListener('click',e=>{ if(e.target===tropaModalBg) tropaModalBg.style.display='none'; });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape' && tropaModalBg.style.display==='flex') tropaModalBg.style.display='none'; });
    document.body.appendChild(tropaModalBg);

    const TIPO_MOV_LBL={extraferia_entrada:'Entrada',movimiento_interno:'Movimiento',extraferia_salida:'Salida'};

    async function openTropaModal(codigo, corralActual){
      const tropa=tropaByCodigo.get(codigo);
      if(!tropa) return;
      tropaModal.innerHTML='<div style="padding:24px;text-align:center;color:var(--muted);font-family:var(--mono);font-size:11px;letter-spacing:1px;text-transform:uppercase;">Cargando historial…</div>';
      tropaModalBg.style.display='flex';

      let movs=[];
      try{
        const res=await fetch(SB_URL+'/rest/v1/movimientos_corral?tropa_id=eq.'+encodeURIComponent(tropa.id)+'&select=*&order=created_at.asc',{
          headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}
        });
        if(!res.ok) throw new Error('HTTP '+res.status);
        movs=await res.json();
      }catch(e){
        tropaModal.innerHTML='<div style="padding:24px;text-align:center;color:var(--red);font-family:var(--mono);font-size:12px;">Error: '+esc(e.message)+'</div>';
        return;
      }

      const head='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;gap:12px;">'
        +'<div>'
          +'<div style="font-family:var(--serif);font-size:22px;font-weight:600;color:var(--text);line-height:1;">'+esc(tropa.codigo_tropa||'—')+'</div>'
          +'<div style="font-family:var(--mono);font-size:10px;color:var(--muted);letter-spacing:1.2px;text-transform:uppercase;margin-top:6px;">'
            +esc(tropa.empresa||tropa.propietario||'—')+' · '+esc(tropa.categoria||'—')+' · '+esc(tropa.cabezas_inicial)+' cab'
            +(tropa.estado==='cerrada'?' · CERRADA':'')
          +'</div>'
        +'</div>'
        +'<button class="ftm-close" style="background:transparent;border:none;color:var(--muted);font-size:26px;cursor:pointer;line-height:1;padding:0 4px;">×</button>'
        +'</div>';

      const histItems=movs.map(m=>{
        const arrow=(m.corral_origen?esc(m.corral_origen):'—')+' → '+(m.corral_destino?esc(m.corral_destino):'—');
        return '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:6px;padding:10px 12px;margin-bottom:6px;">'
          +'<div style="display:flex;justify-content:space-between;margin-bottom:4px;">'
            +'<span style="font-family:var(--mono);font-weight:700;font-size:9px;color:var(--text);letter-spacing:1.5px;text-transform:uppercase;">'+esc(TIPO_MOV_LBL[m.tipo_movimiento]||m.tipo_movimiento)+'</span>'
            +'<span style="font-family:var(--mono);font-size:10px;color:var(--muted);">'+esc(fmtDesde(m.created_at))+'</span>'
          +'</div>'
          +'<div style="font-family:var(--mono);font-size:12px;color:var(--text-2);">'+arrow+' · '+esc(m.cabezas)+' cab</div>'
          +(m.observaciones?'<div style="font-size:11px;color:var(--muted);font-style:italic;margin-top:4px;">'+esc(m.observaciones)+'</div>':'')
          +'</div>';
      }).join('');

      const histSection='<div style="margin-bottom:16px;">'
        +'<div style="font-family:var(--mono);font-weight:600;font-size:9px;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin-bottom:8px;">Historial de movimientos</div>'
        +(movs.length===0?'<div style="font-size:12px;color:var(--muted);font-style:italic;padding:12px;text-align:center;">Sin movimientos registrados.</div>':histItems)
        +'</div>';

      let actions='';
      if(tropa.estado==='activa' && corralActual){
        const idEnc=encodeURIComponent(tropa.id);
        const corralEnc=encodeURIComponent(corralActual);
        actions='<div style="display:flex;flex-direction:column;gap:8px;">'
          +'<a href="hacienda-feria.html?modo=interno&tropa_id='+idEnc+'&corral_origen='+corralEnc+'" target="_blank" rel="noopener" style="display:block;padding:12px 16px;background:var(--cyan);color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;text-align:center;font-family:var(--sans);">↔ Mover corral</a>'
          +'<a href="hacienda-feria.html?modo=salida&tropa_id='+idEnc+'&corral_origen='+corralEnc+'" target="_blank" rel="noopener" style="display:block;padding:12px 16px;background:var(--surface);border:1px solid var(--amber);color:var(--amber);text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;text-align:center;font-family:var(--sans);">⬆ Sacar de feria</a>'
          +'</div>';
      } else if(tropa.estado!=='activa'){
        actions='<div style="padding:14px;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;text-align:center;font-size:12px;color:var(--muted);font-family:var(--mono);">Tropa cerrada — sin acciones disponibles</div>';
      }

      tropaModal.innerHTML=head+histSection+actions;
      tropaModal.querySelector('.ftm-close').onclick=()=>{ tropaModalBg.style.display='none'; };
    }

    const draw=({tropas,movs})=>{
      tropaByCodigo=new Map(tropas.map(t=>[t.codigo_tropa,t]));
      const rows=computeStock(tropas,movs);
      const totalCab=rows.reduce((s,r)=>s+(parseInt(r.cabezas,10)||0),0);
      const lastMov=movs[0];
      const updTxt=lastFetchTs?lastFetchTs.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';

      const kpis='<div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);">'
        +'<div class="kpi-card total"><span class="kpi-label">Cabezas en feria</span><span class="kpi-num'+(totalCab===0?' zero':'')+'">'+totalCab+'</span></div>'
        +'<div class="kpi-card total"><span class="kpi-label">Tropas activas</span><span class="kpi-num'+(rows.length===0?' zero':'')+'">'+rows.length+'</span></div>'
        +'<div class="kpi-card total"><span class="kpi-label">Último movimiento</span><span class="kpi-num" style="font-size:20px;">'+esc(fmtRel(lastMov&&lastMov.created_at))+'</span></div>'
        +'</div>';

      const acciones='<div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 16px;gap:12px;flex-wrap:wrap;">'
        +'<div style="display:flex;gap:8px;flex-wrap:wrap;">'
          +'<a href="hacienda-feria.html" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;padding:10px 16px;background:var(--cyan);color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:13px;font-family:var(--sans);">+ Nuevo movimiento</a>'
          +'<a href="croquis-feria.html" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;padding:10px 16px;background:var(--surface);border:1px solid var(--cyan);color:var(--cyan);text-decoration:none;border-radius:6px;font-weight:600;font-size:13px;font-family:var(--sans);">🗺️ Ver Croquis</a>'
        +'</div>'
        +'<div style="display:flex;align-items:center;gap:10px;">'
          +'<span style="font-family:var(--mono);font-size:10px;color:var(--muted);letter-spacing:0.5px;">Actualizado <span class="feria-upd">'+esc(updTxt)+'</span></span>'
          +'<button class="feria-refresh" style="padding:8px 14px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text-2);border-radius:6px;font-family:var(--sans);font-size:12px;font-weight:600;cursor:pointer;">↺ Actualizar</button>'
        +'</div></div>';

      let tabla;
      if(rows.length===0){
        tabla='<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:56px 24px;text-align:center;">'
          +'<div style="font-size:48px;margin-bottom:12px;line-height:1;">🐄</div>'
          +'<div style="font-family:var(--serif);font-size:18px;font-weight:600;color:var(--text);margin-bottom:6px;">Sin hacienda en feria</div>'
          +'<div style="font-size:13px;color:var(--muted);">No hay tropas activas con corral asignado.</div>'
          +'</div>';
      } else {
        const body=rows.map(r=>{
          const bg=colorEmpresa(r.empresa);
          return '<tr data-codigo="'+esc(r.codigo)+'" data-corral="'+esc(r.corral)+'" style="background:'+bg+';cursor:pointer;">'
            +'<td style="font-family:var(--mono);font-weight:700;color:var(--text);">'+esc(r.corral)+'</td>'
            +'<td>'+esc(r.empresa)+'</td>'
            +'<td>'+esc(r.categoria)+'</td>'
            +'<td class="numeric" style="font-family:var(--mono);font-weight:600;text-align:right;">'+esc(r.cabezas)+'</td>'
            +'<td style="font-family:var(--mono);font-size:11px;color:var(--text-2);">'+esc(fmtDesde(r.desde))+'</td>'
            +'<td style="font-family:var(--mono);font-size:11px;color:var(--muted);">'+esc(r.codigo)+'</td>'
            +'</tr>';
        }).join('');
        tabla='<div class="table-wrap" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden;">'
          +'<table class="dte-table">'
          +'<thead><tr>'
            +'<th>Corral</th><th>Empresa</th><th>Categoría</th><th class="numeric">Cabezas</th><th>Desde</th><th>Tropa</th>'
          +'</tr></thead>'
          +'<tbody>'+body+'</tbody>'
          +'</table></div>';
      }

      root.innerHTML='<div style="padding:24px;max-width:1280px;margin:0 auto;">'
        +'<div style="margin-bottom:20px;">'
          +'<h2 style="font-family:var(--serif);font-size:24px;font-weight:600;color:var(--text);margin:0 0 4px;">🐄 Feria en Vivo</h2>'
          +'<div style="font-size:13px;color:var(--muted);">Stock real en corrales · refresco automático cada 30s</div>'
        +'</div>'
        +kpis
        +acciones
        +tabla
        +'</div>';

      const rb=root.querySelector('.feria-refresh'); if(rb) rb.onclick=()=>load(false);
      // Click en fila → modal de tropa con historial + acciones
      root.querySelectorAll('tr[data-codigo]').forEach(tr=>{
        tr.onclick=()=>openTropaModal(tr.dataset.codigo, tr.dataset.corral);
      });
    };

    const hashData=(d)=>{
      try{
        const slim={
          t:d.tropas.map(x=>x.id+':'+x.estado),
          m:d.movs.map(x=>x.id+':'+x.tropa_id+':'+x.corral_destino+':'+x.cabezas)
        };
        return JSON.stringify(slim);
      }catch(_){return Math.random().toString();}
    };

    const load=async(showLoadingState)=>{
      if(showLoadingState){
        root.innerHTML='<div style="padding:48px 24px;text-align:center;color:var(--muted);font-family:var(--mono);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Cargando feria…</div>';
      }
      try{
        const data=await fetchData();
        lastFetchTs=new Date();
        const h=hashData(data);
        if(h===lastDataHash && !showLoadingState){
          // Sin cambios: sólo actualizar el timestamp para no parpadear
          const up=root.querySelector('.feria-upd');
          if(up) up.textContent=lastFetchTs.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
          return;
        }
        lastDataHash=h;
        draw(data);
        firstLoad=false;
      }catch(e){
        console.error('Feria load error:',e);
        if(firstLoad) drawError(e.message||'desconocido');
      }
    };

    const startPolling=()=>{ if(!pollHandle) pollHandle=setInterval(()=>load(false),30000); };
    const stopPolling=()=>{ if(pollHandle){clearInterval(pollHandle); pollHandle=null;} };

    // Carga + polling sólo cuando la vista está visible (toggle por style.display).
    const obs=new MutationObserver(()=>{
      const visible=root.style.display!=='none';
      if(visible){ load(firstLoad); startPolling(); }
      else stopPolling();
    });
    obs.observe(root,{attributes:true,attributeFilter:['style']});

    root.innerHTML='<div style="padding:48px 24px;text-align:center;color:var(--muted);font-family:var(--mono);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Cargando feria…</div>';
    return root;
  })();
  content.appendChild(remView);
  content.appendChild(dteView);
  content.appendChild(feriaView);
  const VISTAS={rem:remView,dte:dteView,feria:feriaView};

  function mostrar(v){
    if(!VISTAS[v]) v='rem';
    for(const k in VISTAS) VISTAS[k].style.display=k===v?'block':'none';
    document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===v));
    document.body.classList.remove('sidebar-open');
  }
  // Ruta en el hash: #/evento/<codigo> · #/dte · #/feria (se puede recargar o compartir)
  window.setRuta=function(v,cod){
    const h='#/'+(v==='rem'?'evento'+(cod?'/'+encodeURIComponent(cod):''):v);
    if(location.hash!==h) history.replaceState(null,'',location.pathname+location.search+h);
  };
  function irVista(v){mostrar(v); setRuta(v,v==='rem'?remView.codigoActual():null);}
  window.irAEvento=function(cod){remView.seleccionar(cod); mostrar('rem'); window.scrollTo(0,0);};
  function aplicarRuta(){
    const m=/^#\/(evento|dte|feria)(?:\/(.+))?$/.exec(location.hash||'');
    if(!m){mostrar('rem'); return;}
    if(m[1]==='evento'){ if(m[2]){try{remView.seleccionar(decodeURIComponent(m[2]));}catch(e){}} mostrar('rem'); }
    else mostrar(m[1]);
  }
  window.onhashchange=aplicarRuta;
  aplicarRuta();
  document.querySelectorAll('.nav-item').forEach(btn=>btn.onclick=()=>irVista(btn.dataset.view));

  // Refresco: manual + cada 10 min con la pestaña visible. Si falla, quedan los datos anteriores.
  let refrescando=false;
  window.refrescarDatos=async function(){
    if(refrescando) return; refrescando=true;
    const b=document.getElementById('refreshBtn'); if(b){b.classList.add('is-busy');b.disabled=true;}
    try{ await cargarDatos(true); }
    finally{
      refrescando=false; if(b){b.classList.remove('is-busy');b.disabled=false;}
      renderEstadoDatos(); remView.refresh(); dteView.refresh();
    }
  };
  document.getElementById('refreshBtn').onclick=()=>window.refrescarDatos();
  renderEstadoDatos();
  window._dwTimers.push(setInterval(()=>{if(document.visibilityState==='visible') window.refrescarDatos();},10*60*1000));
  window._dwTimers.push(setInterval(renderEstadoDatos,60*1000));

  // Hamburguesa: drawer mobile
  document.getElementById('hamburger').onclick=function(){document.body.classList.toggle('sidebar-open');};
  document.getElementById('sidebar-overlay').onclick=function(){document.body.classList.remove('sidebar-open');};

  // Sidebar colapsable (desktop): aplicar estado persistido + handler
  if(getSidebarCollapsed()) document.querySelector('.app-shell').classList.add('sidebar-collapsed');
  const sidebarToggle=document.getElementById('sidebar-toggle');
  if(sidebarToggle){
    sidebarToggle.onclick=function(){
      const shell=document.querySelector('.app-shell');
      const willCollapse=!shell.classList.contains('sidebar-collapsed');
      shell.classList.toggle('sidebar-collapsed',willCollapse);
      setSidebarCollapsed(willCollapse);
    };
  }
  document.getElementById('logoutBtn').onclick=function(){
    (window._dwTimers||[]).forEach(clearInterval); window._dwTimers=[];
    clearSession(); renderLogin();
  };
}

function init(){ if(getSession()) iniciarApp(); else renderLogin(); }
init();
