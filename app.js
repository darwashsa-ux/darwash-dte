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
function consClass(v){const s=(v||'').toUpperCase(); if(s.includes('DARWASH')) return 'dar'; if(s.includes('BULLTRADE')) return 'bull'; return 'other';}
function prettyCons(v){return '<span class="cons-chip"><span class="dot '+(consClass(v)==='dar'?'dar':consClass(v)==='bull'?'bull':'')+'"></span>'+esc(v||'-')+'</span>'}
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
// Suma ingresos del remate agrupando por categoría canónica.
// Devuelve {TERNERO:{enviadas,recibidas}, ...} con default 0/0.
// Categorías no canonizables (Mamón legacy) NO se cuentan acá.
function normalizarCategoriasRemate(remate){
  const acc=Object.fromEntries(CATEGORIAS_CANONICAS.map(c=>[c,{enviadas:0,recibidas:0}]));
  if(!remate||!Array.isArray(remate.filas)) return acc;
  for(const f of remate.filas){
    if(!String(f.tipo_movimiento||'').toLowerCase().includes('entrada')) continue;
    const canon=canonizarCategoria(f.categoria);
    if(!canon) continue;
    const env=Number(f.enviado ||0);
    const rec=Number(f.recibido||0);
    acc[canon].enviadas +=env;
    // Asunción: recibido=0 significa "sin conteo manual cargado todavía", no "0 cabezas
    // llegaron". Usamos enviado como fallback. El badge de drift solo se dispara cuando
    // recibido está realmente poblado (>0) Y difiere de enviado. Si en el futuro el
    // extractor backend empieza a poblar recibido siempre con el conteo real, eliminar
    // este fallback y todos los cards van a empezar a mostrar drift verdadero.
    acc[canon].recibidas+=rec>0?rec:env;
  }
  return acc;
}
// Suma totales sobre todas las categorías canónicas
function totalRemate(catsNorm){
  const t={enviadas:0,recibidas:0};
  for(const c of CATEGORIAS_CANONICAS){
    t.enviadas +=catsNorm[c].enviadas;
    t.recibidas+=catsNorm[c].recibidas;
  }
  return t;
}
// Determina nivel de drift: null | 'warn' (|diff|≤5) | 'alert' (|diff|>5). diff = recibidas - enviadas.
function driftLevel(diff){
  const d=Math.abs(diff);
  if(d===0) return null;
  if(d<=5)  return 'warn';
  return 'alert';
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
    async function init(){
      try{
        const [r1,r2,r3]=await Promise.all([
          fetch('dtes_maestro.json'),
          fetch('remates_maestro.json'),
          fetch('remates_alias.json').catch(()=>null)
        ]);
        DATOS_DTES=await r1.json();
        DATOS_REMATES=await r2.json();
        if(r3 && r3.ok){
          try{
            const a=await r3.json();
            if(a && typeof a==='object' && !Array.isArray(a)) DATOS_ALIASES=a;
          }catch(_){}
        }
      }catch(e){console.error('Error cargando datos:',e);}
      renderApp();
    }
    init();
  };
}
function openDetalle(d){
  if(!d) return;
  modal.classList.remove('modal-wide');

  // ── Sección: info general (10 boxes) ──
  const infoItems=[
    ['Consignatario',d.consignatario_nombre,false],
    ['Tipo',d.tipo_movimiento_detalle,false],
    ['Motivo',d.motivo_detalle,false],
    ['Estado',d.estado_detalle,false],
    ['Guía',d.nro_guia,true],
    ['TRI',d.nro_tri,true],
    ['Certificado faena',d.nro_certificado_faena,true],
    ['Emisión',d.fecha_emision_detalle,true],
    ['Vencimiento',d.fecha_vencimiento_detalle,true],
    ['Caduca',d.fecha_caduca,true],
  ];
  const infoHtml='<div class="grid-4">'+infoItems.map(it=>{
    const empty=!it[1];
    return '<div class="box"><div class="box-label">'+esc(it[0])+'</div><div class="box-value'+(it[2]?' box-value-mono':'')+(empty?' box-value-empty':'')+'">'+esc(it[1]||'—')+'</div></div>';
  }).join('')+'</div>';

  // ── Sección: vacunas (3 boxes ámbar) ──
  const vacunas=[
    ['Última Aftosa',d.fecha_ultima_aftosa],
    ['Anteúltima Aftosa',d.fecha_anteultima_aftosa],
    ['Última Brucelosis',d.fecha_ultima_brucelosis],
  ];
  const vacHtml='<div class="section-header">Datos de vacunación</div>'
    +'<div class="grid-3">'+vacunas.map(it=>'<div class="box box-amber"><div class="box-label">'+esc(it[0])+'</div><div class="box-value box-value-mono'+(it[1]?'':' box-value-empty')+'">'+esc(it[1]||'—')+'</div></div>').join('')+'</div>';

  // ── Sección: animales movidos (tabla) ──
  const animales=d.animales_detalle||[];
  let animHtml='<div class="section-header">Animales movidos</div>';
  if(animales.length>0){
    const filas=animales.map(a=>'<tr>'
      +'<td>'+esc(a.especie||'Bovinos')+'</td>'
      +'<td style="color:var(--text-2)">'+esc(a.categoria||'—')+'</td>'
      +'<td class="num" style="font-weight:600">'+esc(a.despachados||0)+'</td>'
      +'<td class="num" style="color:'+((a.recibidos||0)>0?'var(--text)':'var(--muted)')+'">'+esc(a.recibidos||0)+'</td>'
      +'</tr>').join('');
    const totDesp=animales.reduce((s,a)=>s+(a.despachados||0),0);
    const totRec=animales.reduce((s,a)=>s+(a.recibidos||0),0);
    animHtml+='<div class="modal-table-wrap"><table class="modal-table">'
      +'<thead><tr><th>Especie</th><th>Categoría</th><th class="num">Despachados</th><th class="num">Recibidos</th></tr></thead>'
      +'<tbody>'+filas
        +'<tr style="border-top:2px solid var(--border)"><td style="font-weight:600">Total</td><td></td><td class="num" style="font-weight:600">'+totDesp+'</td><td class="num" style="color:var(--muted)">'+totRec+'</td></tr>'
      +'</tbody>'
      +'</table></div>';
  }else if(d.cantidad_enviados){
    animHtml+='<div class="grid-2"><div class="box"><div class="box-label">Categoría</div><div class="box-value">'+esc(d.categoria_detalle||d.categoria||'—')+'</div></div>'
      +'<div class="box"><div class="box-label">Cantidad enviados</div><div class="box-value" style="font-size:16px;color:var(--cyan)">'+esc(d.cantidad_enviados||0)+'</div></div></div>';
  }else{
    animHtml+='<div style="color:var(--muted);font-size:12px;padding:12px 0">Sin detalle cargado — corré el scraper para enriquecer este DTE.</div>';
  }

  modal.innerHTML=
    '<div class="modal-head">'
      +'<div><div class="modal-title-top">Detalle DTE</div><div class="modal-title is-code">'+esc(d.nro_dte)+'</div></div>'
      +'<button id="closeModal" class="modal-close" aria-label="Cerrar">×</button>'
    +'</div>'
    +'<div class="modal-body">'
      +infoHtml
      +vacHtml
      +animHtml
    +'</div>';

  modalBg.style.display='flex';
  document.getElementById('closeModal').onclick=closeDetalle;
}
function closeDetalle(){modalBg.style.display='none'; modal.classList.remove('modal-wide');} modalBg.onclick=function(e){if(e.target===modalBg) closeDetalle();};
document.addEventListener('keydown',function(e){if(e.key==='Escape' && modalBg.style.display==='flex')closeDetalle();});
function mostrarLinkRemate(codigo,tipo){
  modal.classList.remove('modal-wide');
  const url='https://darwashsa-ux.github.io/darwash-dte/'+tipo+'.html?remate='+encodeURIComponent(codigo);
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
function remateTipoClass(t){const s=String(t||'').toLowerCase(); if(s.includes('entrada')) return 'row-entrada'; if(s.includes('salida')) return 'row-salida'; return '';}
function calcMovSummary(filas){
  // ingresos/egresos.total y .categorias[CANON] devuelven {enviadas, recibidas} para exponer drift.
  // Filas con categoría no canonizable (Mamón legacy) suman a `total` pero no al breakdown.
  const mkAcc=()=>({total:{enviadas:0,recibidas:0},categorias:Object.fromEntries(CATEGORIAS_CANONICAS.map(c=>[c,{enviadas:0,recibidas:0}]))});
  const ingresos=mkAcc();
  const egresos=mkAcc();
  const stats={faena:0,invernada:0,aptoSi:0,aptoNo:0,vacaFaenaNoApto:0};
  (filas||[]).forEach(f=>{
    const env=Number(f.enviado )||0;
    const rec=Number(f.recibido)||0;
    // Misma asunción que normalizarCategoriasRemate: recibido=0 = "sin conteo cargado",
    // fallback a enviado para que detail panel y hero card muestren los mismos números.
    // Drift real solo cuando rec > 0 Y rec !== env. Ver comment ahí para context completo.
    const recAdj=rec>0?rec:env;
    // Para SENASA stats (faena/invernada/apto) usamos el comportamiento histórico recibido||enviado
    // que privilegia el conteo real cuando llegó a corral.
    const cantidad=rec||env||0;
    const cat=f.categoria||'Sin categoria';
    const canon=canonizarCategoria(cat);
    const t=String(f.tipo_movimiento||'').toLowerCase();
    const motivo=String(f.motivo||'').toLowerCase();
    const apto=String(f.apto_china||'').toLowerCase();
    if(t.includes('entrada')){
      ingresos.total.enviadas +=env; ingresos.total.recibidas+=recAdj;
      if(canon){ ingresos.categorias[canon].enviadas+=env; ingresos.categorias[canon].recibidas+=recAdj; }
    }else if(t.includes('salida')){
      egresos.total.enviadas +=env; egresos.total.recibidas+=recAdj;
      if(canon){ egresos.categorias[canon].enviadas+=env; egresos.categorias[canon].recibidas+=recAdj; }
    }
    if(motivo.includes('faena'))stats.faena+=cantidad;
    else if(motivo.includes('invernada'))stats.invernada+=cantidad;
    if(/^si$/i.test(apto))stats.aptoSi+=cantidad;
    else if(/^no$/i.test(apto))stats.aptoNo+=cantidad;
    if(/vaca/i.test(cat)&&motivo.includes('faena')&&/^no$/i.test(apto))stats.vacaFaenaNoApto+=cantidad;
  });
  return{ingresos,egresos,stats};
}
// `total` y `categorias[k]` son objetos {enviadas, recibidas}. El número grande muestra `enviadas`;
// el badge .drift-badge aparece cuando difieren. (Función actualmente no se invoca — se mantiene en sync con el shape nuevo.)
function renderSummaryBox(title,total,categorias,inOut){
  const entries=Object.entries(categorias).filter(([,v])=>v.enviadas>0||v.recibidas>0).sort((a,b)=>b[1].enviadas-a[1].enviadas);
  const totDiff=total.recibidas-total.enviadas;
  const totLevel=driftLevel(totDiff);
  const totBadge=totLevel?' <span class="drift-badge '+totLevel+'">⚠ '+(totDiff>0?'+':'')+totDiff+'</span>':'';
  const totTitle=totLevel?'title="Enviadas: '+total.enviadas+' · Recibidas: '+total.recibidas+'"':'';
  const pills=entries.map(([cat,v])=>{
    const d=v.recibidas-v.enviadas, lv=driftLevel(d);
    const suffix=lv?' <span class="drift-suffix '+lv+'">'+(d>0?'+':'')+d+'</span>':'';
    const ttl=lv?' title="Enviadas: '+v.enviadas+' · Recibidas: '+v.recibidas+'"':'';
    return '<div class="cat-pill '+inOut+'"'+ttl+'><span class="cat-code">'+esc(abreviarCategoria(cat))+'</span><span class="cat-num">'+esc(v.enviadas)+'</span>'+suffix+'</div>';
  }).join('');
  return '<div class="summary-box"><div class="summary-head '+inOut+'" '+totTitle+'><div><div class="small" style="text-transform:uppercase;letter-spacing:1px">'+title+'</div><div class="summary-big">'+total.enviadas.toLocaleString()+totBadge+'</div></div></div><div class="summary-cats">'+(entries.length?pills:'<div class="small">Sin movimientos</div>')+'</div></div>';
}
function renderRemates(){const rems=DATOS_REMATES.remates||[]; const host=document.createElement('div'); let selected=null,expandedCompact=null,q='',tipos=[],estados=[],categorias_f=[],motivos=[],aptoChinas=[],sortKey=null,sortDir='asc'; function aptoChinaVal(f){const v=f.apto_china||f['Apto China']||f.aptoChina; return !v?'sin':/^si$/i.test(String(v))?'si':'no';} function draw(){const rem=rems[selected]||null;
// Nombres por evento guardados en localStorage
const remNombres=JSON.parse(localStorage.getItem('rem_nombres')||'{}');

// Principal: el más reciente por fecha de Inicio, sin importar el estado. Se renderiza
// arriba como heroCard (siempre expandido). Los demás van a la lista compact (colapsados
// por default, click expande/colapsa un único item a la vez via expandedCompact).
function parseDate(s){if(!s||s==='-')return 0; const p=s.split('/'); return p.length===3?new Date(+p[2],+p[1]-1,+p[0]).getTime():0;}
const aliases=DATOS_ALIASES||{};
const allEntries=rems.map((r,origIdx)=>({r,origIdx,t:parseDate((r.info||{})['Inicio']||'')}));
allEntries.sort((a,b)=>b.t-a.t);
const mainEntry=allEntries[0]||null;
const mainIdx=mainEntry?.origIdx ?? null;
const otherEntries=allEntries.slice(1);
// Inicializar selected al principal en primera pasada (null sentinel).
if(selected===null) selected=mainIdx ?? 0;

// ── HERO CARD (remate activo) — Design system: .remate-card ────
function heroCard(r,origIdx){
  const isBull=((r.info||{}).consignataria||'').toUpperCase().includes('BULLTRADE');
  const dtes=new Set((r.filas||[]).map(f=>f.documento)).size;
  const nombre=remNombres[r.codigo||'']||aliases[r.codigo||'']||'';
  const inicio=esc((r.info||{})['Inicio']||'-');
  const fin=esc((r.info||{})['Fin']||'-');
  const predio=esc((r.info||{})['Predio ferial']||(r.info||{}).consignataria||'');
  const isActive=origIdx===selected;
  const cod=esc(r.codigo||'');
  // Label dinámico: si el remate más reciente está CERRADA, decir "Remate activo" miente.
  const statusLabel=String((r.info||{}).Estado||'').toUpperCase()==='CERRADA' ? 'Último remate' : 'Remate activo';

  // Tags de categorías canónicas con enviadas > 0 (sin slice, sin umbral) — ordenados desc por enviadas.
  // El número grande del tag = enviadas. Sufijo (±N) cuando recibidas !== enviadas.
  const catsCanon=normalizarCategoriasRemate(r);
  const tot=totalRemate(catsCanon);
  const totDiff=tot.recibidas-tot.enviadas;
  const totLevel=driftLevel(totDiff);
  const tagsHtml=Object.entries(catsCanon).filter(([,v])=>v.enviadas>0||v.recibidas>0)
    .sort((a,b)=>b[1].enviadas-a[1].enviadas)
    .map(([k,v])=>{
      const d=v.recibidas-v.enviadas, lv=driftLevel(d);
      const suffix=lv?' <span class="drift-suffix '+lv+'">'+(d>0?'+':'')+d+'</span>':'';
      const ttl=lv?' title="Enviadas: '+v.enviadas+' · Recibidas: '+v.recibidas+'"':'';
      return '<span class="tag"'+ttl+'><span>'+esc(k)+'</span> <span class="num">'+v.enviadas+'</span>'+suffix+'</span>';
    }).join('');

  // Drift assertion en consola: lista categorías afectadas para drilldown rápido.
  if(totLevel){
    const catsDrift=CATEGORIAS_CANONICAS
      .filter(c=>catsCanon[c].recibidas!==catsCanon[c].enviadas)
      .map(c=>c+' '+(catsCanon[c].recibidas-catsCanon[c].enviadas))
      .join(', ');
    console.warn('[drift] Remate '+(r.codigo||'?')+': enviadas='+tot.enviadas+' recibidas='+tot.recibidas+' diff='+totDiff+' (categorías afectadas: '+catsDrift+')');
  }

  // Placeholder serif italic cuando no hay nombre — handled by ::placeholder en CSS
  return '<div class="remate-card rem-hero'+(isActive?' active':'')+(isBull?' rem-bulltrade':' rem-darwash')+'" data-i="'+origIdx+'">'
    +'<div class="remate-info">'
      +'<div class="remate-status">'+statusLabel+'</div>'
      +'<input class="remate-name rem-name-input" data-codigo="'+cod+'" placeholder="Nombre del evento…" value="'+esc(nombre)+'" onclick="event.stopPropagation()" />'
      +'<div class="remate-code">'+esc(r.codigo||'—')+'</div>'
      +'<div class="remate-meta">'
        +'<span>'+inicio+' → '+fin+'</span>'
        +(predio?'<span class="sep">·</span><span>'+predio+'</span>':'')
      +'</div>'
      +(tagsHtml?'<div class="remate-tags">'+tagsHtml+'</div>':'')
    +'</div>'
    +'<div class="remate-stats">'
      +'<div class="stat-pill"'+(totLevel?' title="Enviadas: '+tot.enviadas+' · Recibidas: '+tot.recibidas+'"':'')+'>'
        +'<span class="stat-pill-row">'
          +'<span class="num">'+tot.enviadas+'</span>'
          +(totLevel?'<span class="drift-badge '+totLevel+'">⚠ '+(totDiff>0?'+':'')+totDiff+'</span>':'')
        +'</span>'
        +'<span class="lbl">Animales</span>'
      +'</div>'
      +'<div class="stat-pill amber">'
        +'<span class="num">'+dtes+'</span>'
        +'<span class="lbl">DTEs</span>'
      +'</div>'
    +'</div>'
    +'<div class="remate-actions">'
      +'<button class="btn btn-ghost cyan ver-ing-btn" data-codigo="'+cod+'" onclick="event.stopPropagation()">👁 Ver ingresos</button>'
      +'<button class="btn btn-ghost red link-rem-btn" data-codigo="'+cod+'" data-tipo="egreso" onclick="event.stopPropagation()">⬆ Registrar egreso</button>'
      +'<button class="btn btn-ghost cyan ver-egr-btn" data-codigo="'+cod+'" onclick="event.stopPropagation()">👁 Ver egresos</button>'
      +'<button class="btn btn-primary link-rem-btn" data-codigo="'+cod+'" data-tipo="ingreso" onclick="event.stopPropagation()">+ Registrar ingreso</button>'
    +'</div>'
  +'</div>';
}

// ── COMPACT CARD (variante chiquita de .remate-card) ─────────
// Render con .remate-actions SIEMPRE incluido — la animación CSS lo colapsa/expande
// según la clase .expanded del padre. expandedCompact (closure de renderRemates) controla
// qué item está expandido; un solo item a la vez.
function compactCard(r,origIdx){
  const isBull=((r.info||{}).consignataria||'').toUpperCase().includes('BULLTRADE');
  const titulo=remNombres[r.codigo||'']||aliases[r.codigo||'']||'';
  const dtes=new Set((r.filas||[]).map(f=>f.documento)).size;
  const inicio=esc((r.info||{})['Inicio']||'-');
  const fin=esc((r.info||{})['Fin']||'-');
  const isActive=origIdx===selected;
  const cod=esc(r.codigo||'');
  const rawCod=r.codigo||'';
  const isExpanded=expandedCompact===rawCod;
  const tot=totalRemate(normalizarCategoriasRemate(r));
  const totDiff=tot.recibidas-tot.enviadas, totLevel=driftLevel(totDiff);

  return '<div class="remate-card compact rem-past-row'+(isActive?' active':'')+(isExpanded?' expanded':'')+(isBull?' rem-bulltrade':' rem-darwash')+'" data-i="'+origIdx+'" data-codigo="'+cod+'">'
    +'<div class="remate-info">'
      +'<input class="remate-name rem-name-input" data-codigo="'+cod+'" placeholder="Nombre del evento…" value="'+esc(titulo)+'" onclick="event.stopPropagation()" />'
      +'<div class="remate-code">'+esc(r.codigo||'—')+'</div>'
      +'<div class="remate-meta">'
        +'<span>'+inicio+' → '+fin+'</span>'
      +'</div>'
    +'</div>'
    +'<div class="remate-stats">'
      +'<div class="stat-pill"'+(totLevel?' title="Enviadas: '+tot.enviadas+' · Recibidas: '+tot.recibidas+'"':'')+'>'
        +'<span class="stat-pill-row">'
          +'<span class="num">'+tot.enviadas+'</span>'
          +(totLevel?'<span class="drift-badge '+totLevel+'">⚠ '+(totDiff>0?'+':'')+totDiff+'</span>':'')
        +'</span>'
        +'<span class="lbl">Animales</span>'
      +'</div>'
      +'<div class="stat-pill amber">'
        +'<span class="num">'+dtes+'</span>'
        +'<span class="lbl">DTEs</span>'
      +'</div>'
    +'</div>'
    +'<div class="remate-actions">'
      +'<button class="btn btn-ghost cyan ver-ing-btn" data-codigo="'+cod+'" onclick="event.stopPropagation()">👁 Ver ingresos</button>'
      +'<button class="btn btn-ghost red link-rem-btn" data-codigo="'+cod+'" data-tipo="egreso" onclick="event.stopPropagation()">⬆ Registrar egreso</button>'
      +'<button class="btn btn-ghost cyan ver-egr-btn" data-codigo="'+cod+'" onclick="event.stopPropagation()">👁 Ver egresos</button>'
      +'<button class="btn btn-primary link-rem-btn" data-codigo="'+cod+'" data-tipo="ingreso" onclick="event.stopPropagation()">+ Registrar ingreso</button>'
    +'</div>'
  +'</div>';
}

const heroHtml=mainEntry
  ? heroCard(mainEntry.r, mainEntry.origIdx)
  : '<div class="rem-no-active" style="padding:24px 18px;background:var(--surface);border:1px dashed var(--border);border-radius:var(--r-lg);text-align:center;color:var(--muted);font-size:13px">No hay remates cargados.</div>';
const pastHtml=otherEntries.length>0
  ?'<div class="rem-past-section">'
    +'<button class="prev-toggle" id="rem-past-toggle"><span id="rem-past-label">Ver '+otherEntries.length+' remate'+(otherEntries.length>1?'s':'')+' anterior'+(otherEntries.length>1?'es':'')+'</span></button>'
    +'<div class="rem-past-list" id="rem-past-list" style="display:none">'
      +otherEntries.map(({r,origIdx})=>compactCard(r,origIdx)).join('')
    +'</div>'
  +'</div>'
  :'';

const cards=heroHtml+pastHtml; let detail=''; let exportRows=[]; if(rem){ const tiposAll=Array.from(new Set((rem.filas||[]).map(f=>f.tipo_movimiento).filter(Boolean))).sort(); const estadosAll=Array.from(new Set((rem.filas||[]).map(f=>normalizarEstado(f.estado)).filter(Boolean))).sort(); const categoriasAll=Array.from(new Set((rem.filas||[]).map(f=>canonizarCategoria(f.categoria)).filter(Boolean))).sort(); const motivosAll=Array.from(new Set((rem.filas||[]).map(f=>f.motivo).filter(Boolean))).sort(); exportRows=(rem.filas||[]).filter(f=>(!tipos.length||tipos.includes(f.tipo_movimiento))&&(!estados.length||estados.includes(normalizarEstado(f.estado)))&&(!categorias_f.length||categorias_f.includes(canonizarCategoria(f.categoria)||''))&&(!motivos.length||motivos.includes(f.motivo||''))&&(!aptoChinas.length||aptoChinas.includes(aptoChinaVal(f)))); if(q){const qq=q.toLowerCase(); exportRows=exportRows.filter(f=>Object.values(f).some(v=>String(v||'').toLowerCase().includes(qq)));} if(sortKey){ exportRows=[...exportRows].sort((a,b)=>{const av=a[sortKey]??''; const bv=b[sortKey]??''; const anum=['enviado','recibido'].includes(sortKey)?(Number(av)||0):null; const bnum=['enviado','recibido'].includes(sortKey)?(Number(bv)||0):null; const cmp=anum!==null?(anum-bnum):String(av).localeCompare(String(bv)); return sortDir==='asc'?cmp:-cmp;}); } const sums=calcMovSummary(exportRows); const s=sums.stats;

// Cat mini-grid — siempre las 7 canónicas (con 0 cuando no hay datos).
// `cats[CANON]` es {enviadas, recibidas}. La celda muestra `enviadas` como número grande;
// si la categoría tiene drift (recibidas !== enviadas) se agrega .has-drift + sufijo (±N) y tooltip.
function catMiniGridHtml(cats){
  const c=cats||{};
  return CATEGORIAS_CANONICAS.map(canon=>{
    const v=c[canon]||{enviadas:0,recibidas:0};
    const env=Number(v.enviadas||0), rec=Number(v.recibidas||0);
    const has=env>0||rec>0;
    const diff=rec-env, lv=driftLevel(diff);
    const cls='cat-mini '+(has?'has':'empty')+(lv?' has-drift '+lv:'');
    const suffix=lv?'<span class="drift-suffix '+lv+'">'+(diff>0?'+':'')+diff+'</span>':'';
    const ttl=lv?' title="Enviadas: '+env+' · Recibidas: '+rec+'"':'';
    return '<div class="'+cls+'"'+ttl+'><span class="code">'+CATEGORIA_CANONICA_ABBR[canon]+'</span><span class="num">'+env+'</span>'+suffix+'</div>';
  }).join('');
}

// Warn row + Stats grid (Ingresos verde / Egresos rojo / SENASA 2x2)
const warnRow=s.vacaFaenaNoApto>0
  ? '<div class="warn-row"><strong>'+s.vacaFaenaNoApto+' vacas faena</strong> · marcadas como <strong>NO APTO CHINA</strong></div>'
  : '';

const ingTot=sums.ingresos.total;
const egrTot=sums.egresos.total;
const ingDiff=ingTot.recibidas-ingTot.enviadas, ingLevel=driftLevel(ingDiff);
const egrDiff=egrTot.recibidas-egrTot.enviadas, egrLevel=driftLevel(egrDiff);
const driftBadge=(level,diff)=>level?'<span class="drift-badge '+level+'">⚠ '+(diff>0?'+':'')+diff+'</span>':'';
const driftTitle=(level,t)=>level?' title="Enviadas: '+t.enviadas+' · Recibidas: '+t.recibidas+'"':'';

const summary=warnRow
  +'<div class="stats-grid" style="margin-top:14px">'
    // Ingresos (verde) — con cat-mini-grid 4x2
    +'<div class="metric-card ingresos">'
      +'<div class="metric-head">'
        +'<span class="metric-label"><span class="arrow">↓</span> Ingresos</span>'
      +'</div>'
      +'<div class="metric-num'+(ingTot.enviadas===0?' zero':'')+'"'+driftTitle(ingLevel,ingTot)+'>'+ingTot.enviadas+driftBadge(ingLevel,ingDiff)+'</div>'
      +'<div class="cat-mini-grid">'+catMiniGridHtml(sums.ingresos.categorias)+'</div>'
    +'</div>'
    // Egresos (rojo) — número + sub solo cuando es 0
    +'<div class="metric-card egresos">'
      +'<div class="metric-head">'
        +'<span class="metric-label"><span class="arrow">↑</span> Egresos</span>'
      +'</div>'
      +'<div class="metric-num'+(egrTot.enviadas===0?' zero':'')+'"'+driftTitle(egrLevel,egrTot)+'>'+egrTot.enviadas+driftBadge(egrLevel,egrDiff)+'</div>'
      +(egrTot.enviadas===0
        ? '<div class="metric-sub">Sin egresos registrados en este remate</div>'
        : '')
    +'</div>'
    // SENASA — sub-grilla 2x2 (Faena / Invernada / Apto / No apto)
    +'<div class="senasa-card">'
      +'<div class="senasa-grid">'
        +'<div class="senasa-cell faena"><span class="lbl">Faena</span><span class="num">'+s.faena+'</span></div>'
        +'<div class="senasa-cell invernada"><span class="lbl">Invernada</span><span class="num">'+s.invernada+'</span></div>'
        +'<div class="senasa-cell apto"><span class="lbl">Apto China</span><span class="num">'+s.aptoSi+'</span></div>'
        +'<div class="senasa-cell no-apto"><span class="lbl">No apto</span><span class="num">'+s.aptoNo+'</span></div>'
      +'</div>'
    +'</div>'
  +'</div>';
function msDropdown(id,label,opts,sel){
  const allSel=!sel.length;
  const lbl=allSel?label:(sel.length===1?opts.find(o=>o.v===sel[0])?.l||sel[0]:sel.length+' sel.');
  const items=opts.map(o=>{
    const chk=sel.includes(o.v)?'checked':'';
    return '<label class="ms-item"><input type="checkbox" value="'+esc(o.v)+'" '+chk+'><span>'+esc(o.l)+'</span></label>';
  }).join('');
  return '<div class="ms-wrap" id="'+id+'"><button class="ms-btn select '+(allSel?'':'ms-active')+'" type="button">'+esc(lbl)+' <span class="ms-arrow">▾</span></button>'
    +'<div class="ms-panel" style="display:none">'
    +'<label class="ms-item ms-all"><input type="checkbox" value="__all__" '+(allSel?'checked':'')+'>Todos</label>'
    +items+'</div></div>';
}
const tiposOpts=tiposAll.map(v=>({v,l:v}));
const estadosOpts=estadosAll.map(v=>({v,l:v}));
const categoriasOpts=categoriasAll.map(v=>({v,l:v}));
const motivosOpts=motivosAll.map(v=>({v,l:v}));
const aptoOpts=[{v:'si',l:'Apto'},{v:'no',l:'No apto'},{v:'sin',l:'Sin dato'}];
const header=''
  +'<div class="filters-bar rem-filters-bar">'
    +'<div class="filter-field search">'
      +'<span class="lbl">Buscar</span>'
      +'<input class="input" id="r-q" placeholder="Doc, emisor, receptor…" value="'+esc(q)+'"/>'
    +'</div>'
    +'<div class="filter-field"><span class="lbl">Tipo</span>'+msDropdown('r-tipo','Todos',tiposOpts,tipos)+'</div>'
    +'<div class="filter-field"><span class="lbl">Estado</span>'+msDropdown('r-est','Todos',estadosOpts,estados)+'</div>'
    +'<div class="filter-field"><span class="lbl">Categoría</span>'+msDropdown('r-cat','Todas',categoriasOpts,categorias_f)+'</div>'
    +'<div class="filter-field"><span class="lbl">Motivo</span>'+msDropdown('r-motivo','Todos',motivosOpts,motivos)+'</div>'
    +'<div class="filter-field"><span class="lbl">Apto China</span>'+msDropdown('r-apto','Todos',aptoOpts,aptoChinas)+'</div>'
    +'<div class="filter-actions">'
      +'<button class="btn btn-ghost btn-sm" id="r-clear">Limpiar</button>'
      +'<button class="btn btn-ghost cyan btn-sm" id="r-export">⬇ Excel</button>'
    +'</div>'
  +'</div>';

const cols=[
  {key:'tipo_movimiento', label:'Tipo',        thClass:'col-tipo'},
  {key:'documento',       label:'Documento',   thClass:'col-num numeric'},
  {key:'emisor_nombre',   label:'Emisor',      thClass:'col-origen'},
  {key:'receptor_nombre', label:'Receptor',    thClass:'col-destino'},
  {key:'categoria',       label:'Categoría',   thClass:''},
  {key:'fecha_movimiento',label:'Fecha Mov.',  thClass:'col-fecha'},
  {key:'motivo',          label:'Motivo',      thClass:''},
  {key:'estado',          label:'Estado',      thClass:''},
  {key:'apto_china',      label:'Apto China',  thClass:''},
  {key:'enviado',         label:'Env.',        thClass:'col-cant numeric'},
  {key:'recibido',        label:'Rec.',        thClass:'col-cant numeric'}
];
const th=cols.map(c=>{
  const icon=sortKey===c.key?(sortDir==='asc'?' ↑':' ↓'):'<span style="opacity:.35"> ↕</span>';
  return '<th class="sorter '+c.thClass+'" data-sort="'+c.key+'" style="cursor:pointer;user-select:none">'+esc(c.label)+icon+'</th>';
}).join('');

function aptoChinaBadge(f){
  const v=f.apto_china||f['Apto China']||f.aptoChina;
  const lbl=!v?'Sin dato':/^si$/i.test(String(v))?'Apto':'No apto';
  const cls=!v?'apto-sin':/^si$/i.test(String(v))?'apto-si':'apto-no';
  return {lbl,cls};
}

const body=exportRows.map(f=>{
  const ac=aptoChinaBadge(f);
  const tipoLow=String(f.tipo_movimiento||'').toLowerCase();
  const tipoTag=tipoLow.includes('entrada')?'entrada':tipoLow.includes('salida')?'salida':'';
  const estadoCanon=normalizarEstado(f.estado).toLowerCase();
  return '<tr'+(tipoTag?' data-tipo="'+tipoTag+'"':'')+'>'
    +'<td class="col-tipo">'+esc(f.tipo_movimiento||'—')+'</td>'
    +'<td class="col-num numeric dte-link" data-doc="'+esc(f.documento||'')+'">'+esc(f.documento||'—')+'</td>'
    +'<td class="col-origen" title="'+esc(f.emisor_nombre||'')+'">'+esc(f.emisor_nombre||'—')+'</td>'
    +'<td class="col-destino" title="'+esc(f.receptor_nombre||'')+'">'+esc(f.receptor_nombre||'—')+'</td>'
    +'<td>'+esc(f.categoria||'—')+'</td>'
    +'<td class="col-fecha">'+esc(f.fecha_movimiento||'—')+'</td>'
    +'<td>'+esc(f.motivo||'—')+'</td>'
    +'<td><span class="estado-pill '+estadoCanon+'">'+esc(cleanEstado(f.estado)||'—')+'</span></td>'
    +'<td><span class="apto-china-pill '+ac.cls+'">'+esc(ac.lbl)+'</span></td>'
    +'<td class="col-cant numeric">'+esc(f.enviado||0)+'</td>'
    +'<td class="col-cant numeric">'+esc(f.recibido||0)+'</td>'
  +'</tr>';
}).join('');

detail='<div class="section-caption"><span>'+esc(rem.codigo||'Remate')+'</span><span class="right">'+esc((rem.info||{})['Predio ferial']||'')+'</span></div>'
  +summary
  +header
  +'<div class="table-wrap">'
    +'<div class="table-head-bar">'
      +'<span class="table-title">Movimientos del remate</span>'
      +'<span class="table-count">'+exportRows.length+' de '+(rem.filas||[]).length+'</span>'
    +'</div>'
    +'<div style="overflow-x:auto">'
      +'<table class="dte-table"><thead><tr>'+th+'</tr></thead><tbody>'+body+'</tbody></table>'
    +'</div>'
  +'</div>';
} else { detail='<div class="small">No hay remates cargados.</div>'; } const wasSearch=document.activeElement&&document.activeElement.id==='r-q'&&host.contains(document.activeElement); const selStart=wasSearch?document.activeElement.selectionStart:0; const selEnd=wasSearch?document.activeElement.selectionEnd:0; host.innerHTML='<div class="wrap"><div class="rem-grid">'+cards+'</div>'+detail+'</div>'; // Hero card click
    host.querySelectorAll('.rem-hero').forEach(hero=>{
      hero.onclick=function(){const prev=selected;selected=Number(hero.dataset.i);if(prev!==selected){q='';tipos=[];estados=[];categorias_f=[];motivos=[];aptoChinas=[];}draw();};
    });
    // Toggle del menú "Ver…" en past rows
    host.querySelectorAll('.ver-menu-btn').forEach(btn=>{
      btn.onclick=function(e){
        e.stopPropagation();
        const panel=btn.nextElementSibling;
        const wasOpen=panel && panel.style.display==='flex';
        host.querySelectorAll('.ver-menu-panel').forEach(p=>p.style.display='none');
        if(panel && !wasOpen) panel.style.display='flex';
      };
    });
    // Botones "Registrar ingreso/egreso" → modal con link único
    host.querySelectorAll('.link-rem-btn').forEach(btn=>{
      btn.onclick=function(e){
        e.stopPropagation();
        mostrarLinkRemate(btn.dataset.codigo,btn.dataset.tipo);
      };
    });
    // Click en compact card: alterna expanded del item + actualiza selected para el detalle.
    // Guard contra clicks en los 4 botones de acción (ver-ing/ver-egr no llaman stopPropagation,
    // link-rem sí pero por defensa incluimos los 3).
    host.querySelectorAll('.rem-past-row').forEach(el=>el.onclick=function(e){
      if(e.target.closest('.ver-ing-btn, .ver-egr-btn, .link-rem-btn')) return;
      const codigo=el.dataset.codigo||'';
      const prev=selected;
      selected=Number(el.dataset.i);
      if(prev!==selected){q='';tipos=[];estados=[];categorias_f=[];motivos=[];aptoChinas=[];}
      expandedCompact=(expandedCompact===codigo)?null:codigo;
      draw();
    });
    // Toggle anteriores
    const tog=host.querySelector('#rem-past-toggle');
    if(tog){tog.onclick=function(e){e.stopPropagation();const list=host.querySelector('#rem-past-list');const lbl=host.querySelector('#rem-past-label');if(list){const open=list.style.display==='none';list.style.display=open?'block':'none';tog.classList.toggle('is-open',open);if(lbl)lbl.textContent=open?'Ocultar anteriores':'Ver '+otherEntries.length+' remate'+(otherEntries.length>1?'s':'')+' anterior'+(otherEntries.length>1?'es':'');}};}
    // Si el selected es un remate de la lista compact, abrir el panel
    if(otherEntries.some(p=>p.origIdx===selected)){const list=host.querySelector('#rem-past-list');const lbl=host.querySelector('#rem-past-label');if(list){list.style.display='block';if(tog)tog.classList.add('is-open');if(lbl)lbl.textContent='Ocultar anteriores';}}
    // Name inputs
    host.querySelectorAll('.rem-name-input').forEach(inp=>{
      inp.onchange=function(e){e.stopPropagation();const cod=inp.dataset.codigo;const nombres=JSON.parse(localStorage.getItem('rem_nombres')||'{}');nombres[cod]=inp.value.trim();localStorage.setItem('rem_nombres',JSON.stringify(nombres));};
      inp.onkeydown=function(e){if(e.key==='Enter'){inp.blur();}};
    }); host.querySelectorAll('.dte-link').forEach(el=>el.onclick=function(){const d=(DATOS_DTES.dtes||[]).find(x=>String(x.nro_dte)===String(el.dataset.doc)); openDetalle(d);});
    host.querySelectorAll('.ver-ing-btn').forEach(el=>el.onclick=function(){verIngresos(el.dataset.codigo);});
    host.querySelectorAll('.ver-egr-btn').forEach(el=>el.onclick=function(){verEgresos(el.dataset.codigo);}); const rq=host.querySelector('#r-q'); if(rq){rq.oninput=e=>{q=e.target.value; draw();}; if(wasSearch){rq.focus(); rq.setSelectionRange(selStart,selEnd);}} 
function bindMs(id,arr){
  const wrap=host.querySelector('#'+id); if(!wrap) return;
  const btn=wrap.querySelector('.ms-btn');
  const panel=wrap.querySelector('.ms-panel');
  btn.onclick=function(e){
    e.stopPropagation();
    // Cerrar otros
    host.querySelectorAll('.ms-panel').forEach(p=>{if(p!==panel)p.style.display='none';});
    panel.style.display=panel.style.display==='none'?'block':'none';
  };
  panel.querySelectorAll('input[type=checkbox]').forEach(chk=>{
    chk.onchange=function(){
      if(this.value==='__all__'){arr.length=0;}
      else{
        const i=arr.indexOf(this.value);
        if(this.checked){if(i<0)arr.push(this.value);}
        else{if(i>=0)arr.splice(i,1);}
      }
      draw();
    };
  });
}
bindMs('r-tipo',tipos);
bindMs('r-est',estados);
bindMs('r-cat',categorias_f);
bindMs('r-motivo',motivos);
bindMs('r-apto',aptoChinas);
// Cerrar dropdowns al click fuera
document.addEventListener('click',function msClose(e){
  if(!host.contains(e.target)){host.querySelectorAll('.ms-panel').forEach(p=>p.style.display='none');}
},true);
 host.querySelectorAll('.sorter').forEach(th=>th.onclick=function(){const k=this.dataset.sort; if(sortKey===k){sortDir=sortDir==='asc'?'desc':'asc';} else {sortKey=k; sortDir='asc';} draw();}); const rexp=host.querySelector('#r-export'); if(rexp) rexp.onclick=()=>exportRemates(exportRows); const rclr=host.querySelector('#r-clear'); if(rclr) rclr.onclick=()=>{tipos=[];estados=[];categorias_f=[];motivos=[];aptoChinas=[];draw();}; }
 draw(); return host; }
function renderDtes(){
  const wrap=document.createElement('div');
  let q='',cons='todas',est='todos',periodo='7d',fechaDesde='',fechaHasta='';
  let sortKey=null,sortDir='asc';

  // Columnas: 11 finales (RENSPAs van como sub de Origen/Destino)
  const COLS=[
    {key:'consignataria',     label:'Consignataria',  thClass:''},
    {key:'nro_dte',           label:'N° DTE',         thClass:'col-num numeric'},
    {key:'tipo',              label:'Tipo',           thClass:'col-tipo'},
    {key:'emisor_nombre',     label:'Origen',         thClass:'col-origen'},
    {key:'emisor_cuit',       label:'CUIT Emisor',    thClass:'col-cuit'},
    {key:'receptor_nombre',   label:'Destino',        thClass:'col-destino'},
    {key:'receptor_cuit',     label:'CUIT Receptor',  thClass:'col-cuit'},
    {key:'estado',            label:'Estado',         thClass:''},
    {key:'fecha_carga',       label:'Carga',          thClass:'col-fecha'},
    {key:'fecha_vencimiento', label:'Vencimiento',    thClass:'col-fecha'},
    {key:null,                label:'',               thClass:'actions'}
  ];

  function parseFecha(str){
    if(!str) return null;
    const p=str.split('/');
    if(p.length===3) return new Date(p[2],p[1]-1,p[0]);
    return null;
  }

  function getDesdeHasta(){
    const hoy=new Date(); hoy.setHours(23,59,59);
    const desde=new Date();
    if(periodo==='hoy'){desde.setHours(0,0,0); return{desde,hasta:hoy};}
    if(periodo==='7d'){desde.setDate(desde.getDate()-7); return{desde,hasta:hoy};}
    if(periodo==='30d'){desde.setDate(desde.getDate()-30); return{desde,hasta:hoy};}
    if(periodo==='mes'){desde.setDate(1); desde.setHours(0,0,0); return{desde,hasta:hoy};}
    if(periodo==='todo') return{desde:null,hasta:null};
    if(periodo==='custom'){
      const d=fechaDesde?new Date(fechaDesde):null;
      const h=fechaHasta?new Date(fechaHasta):null;
      if(h) h.setHours(23,59,59);
      return{desde:d,hasta:h};
    }
    return{desde:null,hasta:null};
  }

  function draw(){
    // Capturar foco y cursor ANTES de tocar el DOM
    const activeId=document.activeElement&&wrap.contains(document.activeElement)?document.activeElement.id:null;
    const selStart=activeId==='q'&&document.activeElement.selectionStart!=null?document.activeElement.selectionStart:0;
    const selEnd  =activeId==='q'&&document.activeElement.selectionEnd  !=null?document.activeElement.selectionEnd  :0;

    const all=DATOS_DTES.dtes||[];
    const {desde,hasta}=getDesdeHasta();

    let rows=all.filter(d=>{
      if(cons!=='todas'&&(d.consignataria||'')!==cons) return false;
      if(est!=='todos'&&normalizarEstado(d.estado)!==est) return false;
      if(desde||hasta){
        const fc=parseFecha(d.fecha_carga);
        if(!fc) return false;
        if(desde&&fc<desde) return false;
        if(hasta&&fc>hasta) return false;
      }
      return true;
    });

    if(q){const s=q.toLowerCase(); rows=rows.filter(r=>Object.values(r).some(v=>String(v||'').toLowerCase().includes(s)));}

    // Ordenar
    if(sortKey){
      rows=[...rows].sort((a,b)=>{
        const av=a[sortKey]??'';
        const bv=b[sortKey]??'';
        const isDate=/^\d{2}\/\d{2}\/\d{4}$/.test(String(av));
        let cmp;
        if(isDate){
          const toYMD=s=>s.split('/').reverse().join('');
          cmp=toYMD(String(av)).localeCompare(toYMD(String(bv)));
        } else {
          cmp=String(av).localeCompare(String(bv),'es',{numeric:true});
        }
        return sortDir==='asc'?cmp:-cmp;
      });
    }

    const consOpts=['todas',...Array.from(new Set(all.map(x=>x.consignataria).filter(Boolean)))];
    const estOpts=['todos',...Array.from(new Set(all.map(x=>normalizarEstado(x.estado)).filter(Boolean))).values()].sort();
    const total=all.length,vig=all.filter(x=>/vigente/i.test(x.estado||'')).length,venc=all.filter(x=>/vencido/i.test(x.estado||'')).length,anu=all.filter(x=>/anulado/i.test(x.estado||'')).length;

    const periodos=[['hoy','Hoy'],['7d','7 días'],['30d','30 días'],['mes','Este mes'],['todo','Todos'],['custom','Personalizado']];
    const periodoSelect='<select class="select" id="d-periodo">'+periodos.map(([v,l])=>'<option '+(periodo===v?'selected':'')+' value="'+v+'">'+l+'</option>').join('')+'</select>';
    const customInputs=periodo==='custom'
      ? '<div style="display:flex;gap:6px;margin-top:4px">'
        +'<input type="date" class="input" id="d-desde" value="'+fechaDesde+'" title="Desde"/>'
        +'<input type="date" class="input" id="d-hasta" value="'+fechaHasta+'" title="Hasta"/>'
        +'</div>'
      : '';

    // Filas: 11 columnas (Consignataria / N° DTE / Tipo / Origen / CUIT Em / Destino / CUIT Rec / Estado / Carga / Venc / Acciones)
    const rowsHtml=rows.map(d=>{
      const estadoCanon=normalizarEstado(d.estado).toLowerCase();
      const origenSub=d.renspa_origen?'<span class="sub">'+esc(d.renspa_origen)+'</span>':'';
      const destinoSub=d.renspa_destino?'<span class="sub">'+esc(d.renspa_destino)+'</span>':'';
      return '<tr>'
        +'<td>'+prettyCons(d.consignataria)+'</td>'
        +'<td class="col-num numeric dte-open" data-dte="'+esc(d.nro_dte)+'">'+esc(d.nro_dte)+'</td>'
        +'<td class="col-tipo">'+esc(d.tipo||'—')+'</td>'
        +'<td class="col-origen" title="'+esc(d.emisor_nombre||'')+'">'+esc(d.emisor_nombre||'—')+origenSub+'</td>'
        +'<td class="col-cuit">'+esc(d.emisor_cuit||'—')+'</td>'
        +'<td class="col-destino" title="'+esc(d.receptor_nombre||'')+'">'+esc(d.receptor_nombre||'—')+destinoSub+'</td>'
        +'<td class="col-cuit">'+esc(d.receptor_cuit||'—')+'</td>'
        +'<td><span class="estado-pill '+estadoCanon+'">'+esc(cleanEstado(d.estado)||'—')+'</span></td>'
        +'<td class="col-fecha">'+esc(d.fecha_carga||'—')+'</td>'
        +'<td class="col-fecha">'+esc(d.fecha_vencimiento||'—')+'</td>'
        +'<td class="actions"><button class="row-action icon-only ver-btn" data-dte="'+esc(d.nro_dte)+'" title="Ver detalle">⋯</button></td>'
      +'</tr>';
    }).join('');

    const thHtml=COLS.map(c=>{
      if(!c.key) return '<th class="'+c.thClass+'"></th>';
      const icon=sortKey===c.key?(sortDir==='asc'?' ↑':' ↓'):'<span style="opacity:.35"> ↕</span>';
      return '<th class="sorter '+c.thClass+'" data-sort="'+c.key+'" style="cursor:pointer;user-select:none">'+esc(c.label)+icon+'</th>';
    }).join('');

    // KPI cards (4) — sub vacío per Q6
    const kpiHtml=''
      +'<div class="kpi-grid">'
        +'<div class="kpi-card total"><span class="kpi-label">Total DTEs</span><span class="kpi-num">'+total+'</span></div>'
        +'<div class="kpi-card vigentes"><span class="kpi-label">Vigentes</span><span class="kpi-num">'+vig+'</span></div>'
        +'<div class="kpi-card vencidos"><span class="kpi-label">Vencidos</span><span class="kpi-num">'+venc+'</span></div>'
        +'<div class="kpi-card anulados"><span class="kpi-label">Anulados</span><span class="kpi-num">'+anu+'</span></div>'
      +'</div>';

    // Filter bar — 4 filter-fields + filter-actions (Limpiar + Excel)
    const filtersHtml=''
      +'<div class="filters-bar">'
        +'<div class="filter-field search">'
          +'<span class="lbl">Buscar</span>'
          +'<input class="input" id="q" placeholder="N° DTE, RENSPA, productor, consignataria…" value="'+esc(q)+'"/>'
        +'</div>'
        +'<div class="filter-field">'
          +'<span class="lbl">Período</span>'
          +periodoSelect
          +customInputs
        +'</div>'
        +'<div class="filter-field">'
          +'<span class="lbl">Consignataria</span>'
          +'<select class="select" id="cons">'
            +'<option '+(cons==='todas'?'selected':'')+' value="todas">Todas</option>'
            +consOpts.filter(v=>v!=='todas').map(v=>'<option '+(v===cons?'selected':'')+' value="'+esc(v)+'">'+esc(v)+'</option>').join('')
          +'</select>'
        +'</div>'
        +'<div class="filter-field">'
          +'<span class="lbl">Estado</span>'
          +'<select class="select" id="est">'
            +'<option '+(est==='todos'?'selected':'')+' value="todos">Todos</option>'
            +estOpts.filter(v=>v!=='todos').map(v=>'<option '+(v===est?'selected':'')+' value="'+esc(v)+'">'+esc(v)+'</option>').join('')
          +'</select>'
        +'</div>'
        +'<div class="filter-actions">'
          +'<button class="btn btn-ghost btn-sm" id="d-clear">Limpiar</button>'
          +'<button class="btn btn-ghost cyan btn-sm" id="d-export">⬇ Excel</button>'
        +'</div>'
      +'</div>';

    wrap.innerHTML='<div class="wrap">'
      +kpiHtml
      +filtersHtml
      +'<div class="table-wrap">'
        +'<div class="table-head-bar">'
          +'<span class="table-title">Documentos de tránsito</span>'
          +'<span class="table-count">'+rows.length+' de '+all.length+'</span>'
        +'</div>'
        +'<div style="overflow-x:auto">'
          +'<table class="dte-table"><thead><tr>'+thHtml+'</tr></thead><tbody>'+rowsHtml+'</tbody></table>'
        +'</div>'
      +'</div>'
    +'</div>';

    const qq=wrap.querySelector('#q');
    if(qq){
      qq.oninput=e=>{q=e.target.value;draw();};
      if(activeId==='q'){qq.focus();try{qq.setSelectionRange(selStart,selEnd);}catch(e){}}
    }
    wrap.querySelector('#cons').onchange=e=>{cons=e.target.value;draw();};
    wrap.querySelector('#est').onchange=e=>{est=e.target.value;draw();};
    wrap.querySelector('#d-periodo').onchange=e=>{periodo=e.target.value;draw();};
    const dd=wrap.querySelector('#d-desde'); if(dd) dd.onchange=e=>{fechaDesde=e.target.value;draw();};
    const dh=wrap.querySelector('#d-hasta'); if(dh) dh.onchange=e=>{fechaHasta=e.target.value;draw();};
    wrap.querySelectorAll('.ver-btn,.dte-open').forEach(el=>el.onclick=function(){
      const d=(DATOS_DTES.dtes||[]).find(x=>String(x.nro_dte)===String(el.dataset.dte));
      openDetalle(d);
    });
    wrap.querySelectorAll('.sorter').forEach(th=>th.onclick=function(){
      const k=this.dataset.sort;
      if(sortKey===k){sortDir=sortDir==='asc'?'desc':'asc';}
      else{sortKey=k;sortDir='asc';}
      draw();
    });
    const dexp=wrap.querySelector('#d-export'); if(dexp) dexp.onclick=()=>exportDtes(rows);
    const dclr=wrap.querySelector('#d-clear');
    if(dclr) dclr.onclick=()=>{
      q='';cons='todas';est='todos';periodo='7d';fechaDesde='';fechaHasta='';
      sortKey=null;sortDir='asc';
      draw();
    };
  }
  draw(); return wrap;
}
const SB_URL='https://qkrrumlbvspbxjoxvxho.supabase.co';
const SB_KEY='sb_publishable_ZKjsxf9lkh4tgkhAayDvbA_6DOE7E6d';

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
    regsCache=Array.isArray(regs)?regs:[];

    if(!regs||regs.length===0){
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
function exportDtes(rows) {
  exportToExcel(rows, [
    ['consignataria','Consignataria'],['nro_dte','Nro. DTE'],['emisor_nombre','Emisor'],
    ['emisor_cuit','CUIT Emisor'],['renspa_origen','RENSPA Origen'],['receptor_nombre','Receptor'],
    ['receptor_cuit','CUIT Receptor'],['renspa_destino','RENSPA Destino'],['tipo','Tipo'],
    ['estado','Estado'],['fecha_carga','Fecha Carga'],['fecha_vencimiento','Vencimiento']
  ], 'DTEs_Darwash');
}
function exportRemates(rows) {
  exportToExcel(rows, [
    ['tipo_movimiento','Tipo'],['documento','Documento'],['emisor_nombre','Emisor'],
    ['receptor_nombre','Receptor'],['categoria','Categoría'],['fecha_movimiento','Fecha Mov.'],
    ['motivo','Motivo'],['estado','Estado'],['apto_china','Apto China'],
    ['enviado','Enviado'],['recibido','Recibido']
  ], 'Remates_Darwash');
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
    const res=await fetch(SB_URL+'/rest/v1/egresos_hacienda?remate=eq.'+encodeURIComponent(codigoRemate)+'&order=ts.desc',{
      headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY}
    });
    const rows=await res.json();
    if(!Array.isArray(rows)||!rows.length){
      modal.innerHTML=headerHtml()
        +'<div class="modal-body" style="text-align:center;color:var(--muted);padding:32px">Sin egresos registrados.<br><br>'
        +'<a href="egreso.html?remate='+encodeURIComponent(codigoRemate)+'" target="_blank" style="color:#D63B47">→ Registrar primer egreso</a>'
        +'</div>';
      document.getElementById('closeModal').onclick=closeDetalle;
      return;
    }

    const totalCab=rows.reduce((a,r)=>a+(r.total_cabezas||0),0);
    const catTotals={};
    rows.forEach(r=>{Object.entries(agruparCategoriasReg(r.categorias)).forEach(([k,v])=>{catTotals[k]=(catTotals[k]||0)+v;});});
    const catChips=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<span class="chip chip-egreso">'+esc(k)+': '+v+'</span>').join('');

    const filas=rows.map(r=>{
      const cats=Object.entries(agruparCategoriasReg(r.categorias))
        .map(([k,v])=>'<span class="chip chip-egreso">'+esc(k)+':'+v+'</span>').join('');
      const pdfCell=r.pdf_url
        ?'<td><a href="'+esc(r.pdf_url)+'" target="_blank" style="color:var(--cyan);font-size:12px;white-space:nowrap">📄 PDF</a></td>'
        :'<td style="color:var(--muted);font-size:12px">—</td>';
      const ts=r.ts?new Date(r.ts).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
      return '<tr>'
        +'<td style="font-family:var(--mono);font-size:12px;white-space:nowrap">'+esc(ts)+'</td>'
        +'<td style="font-weight:600">'+esc(r.tropa||'—')+'</td>'
        +'<td style="font-family:var(--mono);font-size:12px;color:var(--cyan)">'+esc(r.nro_dte||'—')+'</td>'
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
        +'<div class="modal-summary-kpi"><span class="label">Registros</span><span class="value">'+rows.length+'</span></div>'
        +'<div class="modal-summary-chips">'+catChips+'</div>'
        +'<a href="egreso.html?remate='+encodeURIComponent(codigoRemate)+'" target="_blank" class="btn-secondary" style="margin-left:auto;text-decoration:none">⬆ Nuevo egreso</a>'
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

function renderApp(){
  const s=getSession();
  if(!s) return renderLogin();

  const ultimaFecha=DATOS_DTES.fecha_extraccion
    ? new Date(DATOS_DTES.fecha_extraccion).toLocaleString('es-AR')
    : '—';

  app.innerHTML=''
    +'<div class="app-shell">'
    +  '<aside class="sidebar" id="sidebar">'
    +    '<div class="sidebar-brand">'
    +      '<div class="brand-logo-mark"><img src="drw-icon.png" alt="DRW"></div>'
    +      '<div class="brand-wordmark">Darwash</div>'
    +      '<button class="sidebar-toggle" id="sidebar-toggle" title="Colapsar sidebar" aria-label="Colapsar sidebar">'
    +        '<span class="toggle-icon">‹</span>'
    +      '</button>'
    +    '</div>'
    +    '<nav class="sidebar-nav">'
    +      '<div class="nav-section-label">Operaciones</div>'
    +      '<button class="nav-item active" data-view="rem" data-tooltip="Remates">'
    +        '<span class="nav-icon">📊</span>'
    +        '<span class="nav-label">Remates</span>'
    +      '</button>'
    +      '<button class="nav-item" data-view="dte" data-tooltip="DTEs">'
    +        '<span class="nav-icon">📄</span>'
    +        '<span class="nav-label">DTEs</span>'
    +      '</button>'
    +      '<button class="nav-item" data-view="feria" data-tooltip="Feria en Vivo">'
    +        '<span class="nav-icon">🐄</span>'
    +        '<span class="nav-label">Feria en Vivo</span>'
    +      '</button>'
    +    '</nav>'
    +    '<div class="sidebar-footer">'
    +      '<div class="sidebar-version">v1.0</div>'
    +    '</div>'
    +  '</aside>'
    +  '<div class="sidebar-overlay" id="sidebar-overlay"></div>'
    +  '<div class="main-area">'
    +    '<header class="topbar">'
    +      '<button class="hamburger" id="hamburger" aria-label="Menu">☰</button>'
    +      '<div class="topbar-title">'
    +        '<div class="topbar-main">SIGSA / SENASA</div>'
    +        '<div class="topbar-sub">TABLERO</div>'
    +      '</div>'
    +      '<div class="topbar-right">'
    +        '<div class="last-update" id="last-update-pill">'
    +          '<span class="last-update-label">🕐 Actualizado</span>'
    +          '<span class="last-update-value">'+esc(ultimaFecha)+'</span>'
    +        '</div>'
    +        '<div class="user-pill">'
    +          '<span class="user-name" id="user-name">'+esc(s.nombre)+'</span>'
    +          '<button id="logoutBtn" class="logout-btn">Salir</button>'
    +        '</div>'
    +      '</div>'
    +    '</header>'
    +    '<main class="content-area" id="content"></main>'
    +  '</div>'
    +'</div>';

  const content=document.getElementById('content');
  const remView=renderRemates();
  const dteView=renderDtes();
  const feriaView=(()=>{
    const root=document.createElement('div');
    let lastFetchTs=null, pollHandle=null, lastDataHash=null, firstLoad=true;

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
      const ultPorTropa=new Map();
      for(const m of movs) if(!ultPorTropa.has(m.tropa_id)) ultPorTropa.set(m.tropa_id,m);
      const rows=[];
      for(const t of tropas){
        const m=ultPorTropa.get(t.id);
        const corral=m?m.corral_destino:null;
        if(!corral) continue;
        rows.push({
          corral,
          empresa:t.empresa||t.propietario||'—',
          categoria:t.categoria||'—',
          cabezas:m?m.cabezas:t.cabezas_inicial,
          desde:m?m.created_at:t.created_at,
          codigo:t.codigo_tropa
        });
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

    const draw=({tropas,movs})=>{
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
        +'<a href="hacienda-feria.html" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;padding:10px 16px;background:var(--cyan);color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:13px;font-family:var(--sans);">+ Nuevo movimiento</a>'
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
          return '<tr style="background:'+bg+';">'
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
  dteView.style.display='none';
  feriaView.style.display='none';

  // Sidebar nav (reemplaza .tab → .nav-item, dataset.tab → dataset.view)
  document.querySelectorAll('.nav-item').forEach(btn=>btn.onclick=function(){
    document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    const v=btn.dataset.view;
    remView.style.display=v==='rem'?'block':'none';
    dteView.style.display=v==='dte'?'block':'none';
    feriaView.style.display=v==='feria'?'block':'none';
    document.body.classList.remove('sidebar-open');
  });

  // Hamburguesa: drawer mobile
  document.getElementById('hamburger').onclick=function(){
    document.body.classList.toggle('sidebar-open');
  };
  document.getElementById('sidebar-overlay').onclick=function(){
    document.body.classList.remove('sidebar-open');
  };

  // Sidebar colapsable (desktop): aplicar estado persistido + handler
  if(getSidebarCollapsed()){
    document.querySelector('.app-shell').classList.add('sidebar-collapsed');
  }
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
    clearSession();
    renderLogin();
  };
}

async function init() {
  try {
    const [r1, r2, r3] = await Promise.all([
      fetch('dtes_maestro.json'),
      fetch('remates_maestro.json'),
      fetch('remates_alias.json').catch(()=>null)
    ]);
    DATOS_DTES = await r1.json();
    DATOS_REMATES = await r2.json();
    if(r3 && r3.ok){
      try{
        const a=await r3.json();
        if(a && typeof a==='object' && !Array.isArray(a)) DATOS_ALIASES=a;
      }catch(_){ /* alias inválido — fallback {} silencioso */ }
    }
  } catch(e) { console.error('Error cargando datos:', e); }
  renderApp();
}
init();
