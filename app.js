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

  // ── Sección: info general ──
  const infoItems=[
    ['Consignatario',d.consignatario_nombre],
    ['Tipo',d.tipo_movimiento_detalle],
    ['Motivo',d.motivo_detalle],
    ['Estado',d.estado_detalle],
    ['Guía',d.nro_guia],
    ['TRI',d.nro_tri],
    ['Certificado faena',d.nro_certificado_faena],
    ['Emisión',d.fecha_emision_detalle],
    ['Vencimiento',d.fecha_vencimiento_detalle],
    ['Caduca',d.fecha_caduca],
  ];
  const infoHtml='<div class="grid">'+infoItems.map(it=>'<div class="box"><div class="k">'+esc(it[0])+'</div><div class="vv">'+esc(it[1]||'—')+'</div></div>').join('')+'</div>';

  // ── Sección: vacunas ──
  const vacunas=[
    ['Última Aftosa',d.fecha_ultima_aftosa],
    ['Anteúltima Aftosa',d.fecha_anteultima_aftosa],
    ['Última Brucelosis',d.fecha_ultima_brucelosis],
  ];
  const vacHtml='<div class="det-section-label">🩺 Datos de vacunación</div>'
    +'<div class="grid" style="grid-template-columns:repeat(3,1fr)">'+vacunas.map(it=>'<div class="box"><div class="k">'+esc(it[0])+'</div><div class="vv" style="color:var(--amber)">'+esc(it[1]||'—')+'</div></div>').join('')+'</div>';

  // ── Sección: animales movidos (tabla como SENASA) ──
  const animales=d.animales_detalle||[];
  let animHtml='<div class="det-section-label">🐄 Animales movidos</div>';
  if(animales.length>0){
    const filas=animales.map(a=>'<tr>'
      +'<td>'+esc(a.especie||'Bovinos')+'</td>'
      +'<td style="font-weight:700;color:var(--text)">'+esc(a.categoria||'—')+'</td>'
      +'<td style="text-align:right;font-weight:800;color:var(--primary);font-size:16px">'+esc(a.despachados||0)+'</td>'
      +'<td style="text-align:right;color:var(--muted)">'+esc(a.recibidos||0)+'</td>'
      +'</tr>').join('');
    const totDesp=animales.reduce((s,a)=>s+(a.despachados||0),0);
    const totRec=animales.reduce((s,a)=>s+(a.recibidos||0),0);
    animHtml+='<div class="det-table-wrap"><table class="det-table">'
      +'<thead><tr><th>Especie</th><th>Categoría</th><th style="text-align:right">Despachados</th><th style="text-align:right">Recibidos</th></tr></thead>'
      +'<tbody>'+filas+'</tbody>'
      +'<tfoot><tr>'
        +'<td colspan="2" style="font-weight:700;color:var(--muted);font-size:11px;letter-spacing:1px">TOTAL</td>'
        +'<td style="text-align:right;font-weight:800;font-size:18px;color:var(--primary)">'+totDesp+'</td>'
        +'<td style="text-align:right;font-weight:700;color:var(--muted)">'+totRec+'</td>'
      +'</tr></tfoot>'
      +'</table></div>';
  }else if(d.cantidad_enviados){
    // Fallback para DTEs sin detalle enriquecido aún
    animHtml+='<div class="box" style="margin-top:4px"><div class="k">Categoría</div><div class="vv">'+esc(d.categoria_detalle||d.categoria||'—')+'</div></div>'
      +'<div class="box"><div class="k">Cantidad enviados</div><div class="vv" style="color:var(--primary);font-size:18px;font-weight:800">'+esc(d.cantidad_enviados||0)+'</div></div>';
  }else{
    animHtml+='<div style="color:var(--muted);font-size:12px;padding:12px 0">Sin detalle cargado — corré el scraper para enriquecer este DTE.</div>';
  }

  modal.innerHTML=
    '<div class="modal-head">'
      +'<div><div class="modal-title-top">Detalle DTE</div><div class="modal-title">'+esc(d.nro_dte)+'</div></div>'
      +'<button id="closeModal" class="modal-close">Cerrar ✕</button>'
    +'</div>'
    +'<div style="padding:20px 28px 28px">'
      +infoHtml
      +vacHtml
      +animHtml
    +'</div>';

  modalBg.style.display='flex';
  document.getElementById('closeModal').onclick=closeDetalle;
}
function closeDetalle(){modalBg.style.display='none';} modalBg.onclick=function(e){if(e.target===modalBg) closeDetalle();};
document.addEventListener('keydown',function(e){if(e.key==='Escape' && modalBg.style.display==='flex')closeDetalle();});
function mostrarLinkRemate(codigo,tipo){
  const url='https://darwashsa-ux.github.io/darwash-dte/'+tipo+'.html?remate='+encodeURIComponent(codigo);
  const tipoLbl=tipo==='egreso'?'Egreso':'Ingreso';
  const tipoLow=tipo==='egreso'?'egreso':'ingreso';
  const aliases=DATOS_ALIASES||{};
  const alias=aliases[codigo]||'';
  const tituloRef=alias||codigo;
  const mensaje='Hola, este es el link para registrar el '+tipoLow+' del remate '+tituloRef+':\n\n'+url;
  const tituloHtml=alias
    ? '<div class="modal-title">'+esc(alias)+'</div><div style="font-family:monospace;font-size:11px;color:var(--muted);margin-top:4px">'+esc(codigo)+'</div>'
    : '<div class="modal-title" style="font-family:monospace;font-size:20px">'+esc(codigo)+'</div>';
  modal.innerHTML='<div class="modal-head">'
    +'<div><div class="modal-title-top">Link de '+esc(tipoLbl)+'</div>'+tituloHtml+'</div>'
    +'<button class="modal-close" id="link-close">Cerrar</button>'
    +'</div>'
    +'<div style="padding:22px 24px 26px">'
      +'<div class="small" style="margin-bottom:8px;letter-spacing:1px;text-transform:uppercase;font-size:10px">Link único para este remate</div>'
      +'<div id="link-box" style="background:#0a1410;border:1px solid rgba(0,210,132,.3);border-radius:10px;padding:14px 16px;font-family:monospace;font-size:12px;color:var(--primary);word-break:break-all;user-select:all;margin-bottom:18px;line-height:1.5">'+esc(url)+'</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
        +'<button id="btn-copy" style="padding:14px 12px;font-size:14px;font-weight:700;color:var(--primary);border:1px solid rgba(0,210,132,.4);background:rgba(0,210,132,.1);border-radius:12px;cursor:pointer;font-family:inherit">📋 Copiar link</button>'
        +'<button id="btn-wsp" style="padding:14px 12px;font-size:14px;font-weight:700;color:#fff;border:none;background:linear-gradient(135deg,#128c3a,#075e24);border-radius:12px;cursor:pointer;font-family:inherit">💬 WhatsApp</button>'
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
      btnCopy.style.background='rgba(0,210,132,.25)';
      setTimeout(()=>{btnCopy.innerHTML=orig;btnCopy.style.background='rgba(0,210,132,.1)';},2000);
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
function renderRemates(){const rems=DATOS_REMATES.remates||[]; const host=document.createElement('div'); let selected=null,q='',tipos=[],estados=[],categorias_f=[],motivos=[],aptoChinas=[],sortKey=null,sortDir='asc'; function aptoChinaVal(f){const v=f.apto_china||f['Apto China']||f.aptoChina; return !v?'sin':/^si$/i.test(String(v))?'si':'no';} function draw(){const rem=rems[selected]||null;
// Nombres por evento guardados en localStorage
const remNombres=JSON.parse(localStorage.getItem('rem_nombres')||'{}');

// Detectar remates "activos" = todos los PENDIENTE; el resto a anteriores
function parseDate(s){if(!s||s==='-')return 0; const p=s.split('/'); return p.length===3?new Date(+p[2],+p[1]-1,+p[0]).getTime():0;}
const aliases=DATOS_ALIASES||{};
const activeRems=[]; const pastRems=[];
rems.forEach((r,origIdx)=>{
  const t=parseDate((r.info||{})['Inicio']||'');
  const estado=String((r.info||{}).Estado||'').toUpperCase();
  const entry={r,origIdx,t};
  // Cualquier estado distinto a CERRADA es "activo" — incluye PENDIENTE (futuro),
  // ABIERTA (en curso), y cualquier estado nuevo que SENASA pueda introducir.
  // Esto evita que el remate del día de la feria (estado ABIERTA) caiga en pastCard
  // sin los botones de acciones.
  if(estado !== 'CERRADA') activeRems.push(entry); else pastRems.push(entry);
});
activeRems.sort((a,b)=>b.t-a.t);
pastRems.sort((a,b)=>b.t-a.t);
// Inicializar selected al primer remate activo (no-CERRADA: PENDIENTE o ABIERTA).
// Si no hay ninguno, selected queda en 0. Sentinela null en primera pasada.
if(selected===null) selected=activeRems[0]?.origIdx ?? 0;

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
      +'<div class="remate-status">Remate activo</div>'
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

// ── PAST CARD (variante compacta de .remate-card) ─────────
function pastCard(r,origIdx){
  const isBull=((r.info||{}).consignataria||'').toUpperCase().includes('BULLTRADE');
  const titulo=remNombres[r.codigo||'']||aliases[r.codigo||'']||'';
  const dtes=new Set((r.filas||[]).map(f=>f.documento)).size;
  const inicio=esc((r.info||{})['Inicio']||'-');
  const fin=esc((r.info||{})['Fin']||'-');
  const isActive=origIdx===selected;
  const cod=esc(r.codigo||'');
  const tot=totalRemate(normalizarCategoriasRemate(r));
  const totDiff=tot.recibidas-tot.enviadas, totLevel=driftLevel(totDiff);

  // Variante compacta: sin tags, sin acciones, stat pills mas chicas (CSS las shrinkea)
  return '<div class="remate-card compact rem-past-row'+(isActive?' active':'')+(isBull?' rem-bulltrade':' rem-darwash')+'" data-i="'+origIdx+'">'
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

const heroHtml=activeRems.length>0
  ? activeRems.map(({r,origIdx})=>heroCard(r,origIdx)).join('')
  : '<div class="rem-no-active" style="padding:24px 18px;background:var(--surface);border:1px dashed var(--border);border-radius:var(--r-lg);text-align:center;color:var(--muted);font-size:13px">No hay remates activos.</div>';
const pastHtml=pastRems.length>0
  ?'<div class="rem-past-section">'
    +'<button class="prev-toggle" id="rem-past-toggle"><span id="rem-past-label">Ver '+pastRems.length+' remate'+(pastRems.length>1?'s':'')+' anterior'+(pastRems.length>1?'es':'')+'</span></button>'
    +'<div class="rem-past-list" id="rem-past-list" style="display:none">'
      +pastRems.map(({r,origIdx})=>pastCard(r,origIdx)).join('')
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
    // Past rows click
    host.querySelectorAll('.rem-past-row').forEach(el=>el.onclick=function(){const prev=selected;selected=Number(el.dataset.i);if(prev!==selected){q='';tipos=[];estados=[];categorias_f=[];motivos=[];aptoChinas=[];}draw();});
    // Toggle anteriores
    const tog=host.querySelector('#rem-past-toggle');
    if(tog){tog.onclick=function(e){e.stopPropagation();const list=host.querySelector('#rem-past-list');const lbl=host.querySelector('#rem-past-label');if(list){const open=list.style.display==='none';list.style.display=open?'block':'none';tog.classList.toggle('is-open',open);if(lbl)lbl.textContent=open?'Ocultar anteriores':'Ver '+pastRems.length+' remate'+(pastRems.length>1?'s':'')+' anterior'+(pastRems.length>1?'es':'');}};}
    // Si el selected es un remate anterior, abrir el panel
    if(pastRems.some(p=>p.origIdx===selected)){const list=host.querySelector('#rem-past-list');const lbl=host.querySelector('#rem-past-label');if(list){list.style.display='block';if(tog)tog.classList.add('is-open');if(lbl)lbl.textContent='Ocultar anteriores';}}
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
  const session=getSession();
  const esLeo=session&&session.email==='leoqui1991@gmail.com';

  async function cargarYRenderizar(){
    modal.innerHTML='<div class="modal-head"><div><div class="modal-title-top">Registros de Ingreso</div><div class="modal-title" style="font-size:22px">'+esc(codigoRemate)+'</div></div><button id="closeModal" class="modal-close">Cerrar ✕</button></div><div style="padding:32px;text-align:center;color:var(--muted)">Cargando registros...</div>';
    modalBg.style.display='flex';
    document.getElementById('closeModal').onclick=closeDetalle;

    const url=SB_URL+'/rest/v1/ingresos_hacienda?remate=eq.'+encodeURIComponent(codigoRemate)+'&order=ts.desc';
    const r=await fetch(url,{headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY}});
    const regs=await r.json();

    if(!regs||regs.length===0){
      modal.innerHTML='<div class="modal-head"><div><div class="modal-title-top">Registros de Ingreso</div><div class="modal-title" style="font-size:22px">'+esc(codigoRemate)+'</div></div><button id="closeModal" class="modal-close">Cerrar ✕</button></div><div style="padding:32px;text-align:center;color:var(--muted)">Sin registros aún.<br><br><a href="ingreso.html?remate='+encodeURIComponent(codigoRemate)+'" target="_blank" style="color:var(--primary)">→ Registrar primer ingreso</a></div>';
      document.getElementById('closeModal').onclick=closeDetalle;
      return;
    }

    const totalCabezas=regs.reduce((a,r)=>a+(r.total_cabezas||0),0);
    const catTotals={};
    regs.forEach(r=>{Object.entries(agruparCategoriasReg(r.categorias)).forEach(([k,v])=>{catTotals[k]=(catTotals[k]||0)+v;});});
    const catPills=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<span style="background:rgba(0,208,132,.1);border:1px solid rgba(0,208,132,.25);border-radius:6px;padding:2px 8px;font-size:11px">'+esc(k)+': '+v+'</span>').join(' ');

    const rows=regs.map(reg=>{
      const cats=Object.entries(agruparCategoriasReg(reg.categorias)).map(([k,v])=>'<span style="font-size:10px;background:rgba(0,208,132,.08);border:1px solid rgba(0,208,132,.2);border-radius:4px;padding:1px 5px">'+esc(k)+':'+v+'</span>').join(' ');
      const accionesCell='<td style="padding:8px 10px;white-space:nowrap;display:flex;gap:4px;align-items:center">'
        +'<button class="ing-wsp-btn ghost-btn" data-id="'+esc(reg.id)+'" style="font-size:11px;padding:4px 8px;color:#25d366;border-color:rgba(37,211,102,.3)">💬 WS</button>'
        +(esLeo
          ?'<button class="ing-edit-btn ghost-btn" data-id="'+esc(reg.id)+'" style="font-size:11px;padding:4px 8px;color:var(--amber);border-color:rgba(215,165,59,.3)">✏️</button>'
           +'<button class="ing-del-btn ghost-btn" data-id="'+esc(reg.id)+'" style="font-size:11px;padding:4px 8px;color:var(--red);border-color:rgba(255,77,90,.3)">🗑</button>'
          :'')
        +'</td>';
      return '<tr style="border-bottom:1px solid rgba(15,27,28,.95)" data-id="'+esc(reg.id)+'">'
        +'<td style="padding:10px 14px;font-weight:700;color:var(--amber);white-space:nowrap">'+esc(reg.hora_descarga||'—')+'</td>'
        +'<td style="padding:10px 14px;font-size:11px;white-space:nowrap">'+esc(reg.fecha||'—')+'</td>'
        +'<td style="padding:10px 14px;font-size:11px;color:var(--primary);white-space:nowrap">'+esc(reg.nro_dte||'—')+'</td>'
        +'<td style="padding:10px 14px;font-size:12px">'+esc(reg.productor||'—')+'</td>'
        +'<td style="padding:10px 14px;font-size:12px;white-space:nowrap">'+esc(reg.transportista||'—')+(reg.patente?' <span style="color:var(--muted)">'+esc(reg.patente)+'</span>':'')+'</td>'
        +'<td style="padding:10px 14px;text-align:right;font-weight:700;color:var(--green)">'+esc(reg.total_cabezas||0)+'</td>'
        +'<td style="padding:10px 14px">'+cats+'</td>'
        +'<td style="padding:10px 14px;font-size:11px;color:var(--muted);font-style:italic">'+esc(reg.observaciones||'')+'</td>'
        +(reg.pdf_url?'<td style="padding:10px 14px"><a href="'+reg.pdf_url+'" target="_blank" style="background:rgba(100,160,255,.1);border:1px solid rgba(100,160,255,.3);border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;color:#6aabff;text-decoration:none;white-space:nowrap">📄 PDF</a></td>':'<td style="padding:10px 14px;color:var(--muted);font-size:11px">—</td>')
        +(reg.fotos&&Object.keys(reg.fotos).length>0?'<td style="padding:8px 14px"><div style="display:flex;gap:4px;flex-wrap:wrap">'+Object.values(reg.fotos).map(url=>'<a href="'+url+'" target="_blank"><img src="'+url+'" style="width:36px;height:36px;object-fit:cover;border-radius:4px;border:1px solid rgba(0,208,132,.3)"/></a>').join('')+'</div></td>':'<td style="padding:10px 14px;color:var(--muted);font-size:11px">—</td>')
        +accionesCell
        +'</tr>';
    }).join('');

    const thAcciones='<th style="padding:10px 14px;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase"></th>';

    modal.innerHTML='<div class="modal-head"><div><div class="modal-title-top">Registros de Ingreso</div><div class="modal-title" style="font-size:22px">'+esc(codigoRemate)+'</div></div><button id="closeModal" class="modal-close">Cerrar ✕</button></div>'
      +'<div style="padding:16px 24px;border-bottom:1px solid rgba(21,48,51,.95);display:flex;align-items:center;gap:16px;flex-wrap:wrap">'
      +'<div><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Total ingresado</div><div style="font-size:36px;font-weight:800;color:var(--green)">'+totalCabezas+' <span style="font-size:16px;font-weight:400">cab.</span></div></div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:6px">'+catPills+'</div>'
      +'<a href="ingreso.html?remate='+encodeURIComponent(codigoRemate)+'" target="_blank" style="margin-left:auto;background:rgba(0,208,132,.12);border:1px solid rgba(0,208,132,.3);border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;color:var(--green);text-decoration:none;white-space:nowrap">📋 Nuevo Ingreso</a>'
      +'</div>'
      +'<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">'
      +'<thead><tr style="background:rgba(4,9,10,.88);position:sticky;top:0">'
      +'<th style="padding:10px 14px;text-align:left;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase;white-space:nowrap">Hora</th>'
      +'<th style="padding:10px 14px;text-align:left;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase">Fecha</th>'
      +'<th style="padding:10px 14px;text-align:left;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase">DTE</th>'
      +'<th style="padding:10px 14px;text-align:left;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase">Productor</th>'
      +'<th style="padding:10px 14px;text-align:left;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase">Transporte</th>'
      +'<th style="padding:10px 14px;text-align:right;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase">Cab.</th>'
      +'<th style="padding:10px 14px;text-align:left;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase">Categorías</th>'
      +'<th style="padding:10px 14px;text-align:left;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase">Obs.</th>'
      +'<th style="padding:10px 14px;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase">PDF</th>'
      +'<th style="padding:10px 14px;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase">Fotos</th>'
      +thAcciones
      +'</tr></thead><tbody>'+rows+'</tbody></table></div>';

    document.getElementById('closeModal').onclick=closeDetalle;

    // ── Listeners editar / eliminar ──────────────────────
    // WhatsApp — disponible para todos
    modal.querySelectorAll('.ing-wsp-btn').forEach(btn=>{
      btn.onclick=()=>{
        const reg=regs.find(r=>String(r.id)===String(btn.dataset.id));
        if(reg) compartirWhatsAppReg(reg);
      };
    });
    if(esLeo){
      modal.querySelectorAll('.ing-edit-btn').forEach(btn=>{
        btn.onclick=()=>mostrarFormEdicion(btn.dataset.id, regs, codigoRemate);
      });
      modal.querySelectorAll('.ing-del-btn').forEach(btn=>{
        btn.onclick=()=>confirmarEliminar(btn.dataset.id, codigoRemate);
      });
    }
  }

  // ── Formulario de edición ─────────────────────────────
  function mostrarFormEdicion(id, regs, codigoRemate){
    const reg=regs.find(r=>String(r.id)===String(id));
    if(!reg) return;
    // Cargar fusionado: registros viejos con "Novillito":N aparecen sumados en el input "Novillo".
    const cats=agruparCategoriasReg(reg.categorias);
    const catInputs=CATS_INGRESO.map(cat=>`
      <div style="background:rgba(7,17,18,.8);border:1px solid rgba(21,48,51,.8);border-radius:10px;padding:10px 12px">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">${esc(cat)}</div>
        <input type="number" min="0" id="ecat_${cat.replace(/[^a-z]/gi,'_')}" value="${cats[canonizarCategoria(cat)]||cats[cat]||0}"
          style="background:transparent;border:none;border-bottom:1px solid rgba(21,48,51,.9);color:var(--text);font-size:20px;font-weight:800;width:100%;outline:none;padding:2px 0">
      </div>`).join('');

    modal.innerHTML=
      '<div class="modal-head"><div><div class="modal-title-top">Editando Remito</div><div class="modal-title" style="font-size:18px">'+esc(reg.nro_dte||'—')+' · '+esc(reg.fecha||'—')+'</div></div>'
        +'<button id="closeModal" class="modal-close">Cancelar ✕</button></div>'
      +'<div style="padding:20px 24px 32px;overflow:auto">'

        // Campos simples
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">'
          +'<div class="box"><div class="k">Nro. DTE</div><input id="e_nro_dte" class="input" value="'+esc(reg.nro_dte||'')+'" style="margin-top:6px;width:100%"></div>'
          +'<div class="box"><div class="k">Hora descarga</div><input id="e_hora" class="input" type="time" value="'+esc(reg.hora_descarga||'')+'" style="margin-top:6px;width:100%"></div>'
          +'<div class="box"><div class="k">Productor / Procedencia</div><input id="e_productor" class="input" value="'+esc(reg.productor||'')+'" style="margin-top:6px;width:100%"></div>'
          +'<div class="box"><div class="k">Transportista</div><input id="e_transportista" class="input" value="'+esc(reg.transportista||'')+'" style="margin-top:6px;width:100%"></div>'
          +'<div class="box"><div class="k">Patente</div><input id="e_patente" class="input" value="'+esc(reg.patente||'')+'" style="margin-top:6px;width:100%;text-transform:uppercase"></div>'
          +'<div class="box"><div class="k">Observaciones</div><input id="e_obs" class="input" value="'+esc(reg.observaciones||'')+'" style="margin-top:6px;width:100%"></div>'
        +'</div>'

        // Categorías
        +'<div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:10px">Cantidad por categoría</div>'
        +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px">'+catInputs+'</div>'

        // Botón guardar
        +'<button id="e_guardar" class="btn" style="width:100%;background:var(--primary);color:#031011;font-weight:800;font-size:15px;padding:14px">✓ Guardar cambios</button>'
        +'<div id="e_msg" style="margin-top:10px;text-align:center;font-size:12px"></div>'
      +'</div>';

    document.getElementById('closeModal').onclick=()=>cargarYRenderizar();

    document.getElementById('e_guardar').onclick=async()=>{
      const btn=document.getElementById('e_guardar');
      const msg=document.getElementById('e_msg');
      btn.disabled=true; btn.textContent='Guardando...';

      // Armar categorías
      const nuevasCats={};
      let total=0;
      CATS_INGRESO.forEach(cat=>{
        const inp=document.getElementById('ecat_'+cat.replace(/[^a-z]/gi,'_'));
        const v=parseInt(inp?.value||0)||0;
        if(v>0){nuevasCats[cat]=v; total+=v;}
      });
      // Preservar categorías legacy no canonizables del registro original (ej. "Mamón")
      // para que la edición no pierda datos históricos que el form nuevo no muestra.
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
        msg.style.color='var(--green)';
        msg.textContent='✅ Remito actualizado correctamente';
        setTimeout(()=>cargarYRenderizar(),1200);
      }catch(e){
        msg.style.color='var(--red)';
        msg.textContent='❌ Error al guardar: '+e.message;
        btn.disabled=false; btn.textContent='✓ Guardar cambios';
      }
    };
  }

  // ── Confirmar eliminación ─────────────────────────────
  function confirmarEliminar(id, codigoRemate){
    const reg=modal.querySelector('tr[data-id="'+id+'"]');
    const info=reg?reg.querySelector('td:nth-child(3)')?.textContent:'este registro';
    if(!confirm('⚠️ ¿Eliminar el remito '+info+'?\n\nEsta acción no se puede deshacer.')) return;
    fetch(SB_URL+'/rest/v1/ingresos_hacienda?id=eq.'+encodeURIComponent(id),{
      method:'DELETE',
      headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Prefer':'return=minimal'}
    }).then(r=>{
      if(!r.ok) throw new Error('Error '+r.status);
      cargarYRenderizar();
    }).catch(e=>alert('❌ No se pudo eliminar: '+e.message));
  }

  try{
    await cargarYRenderizar();
  }catch(e){
    modal.innerHTML='<div class="modal-head"><div><div class="modal-title-top">Error</div><div class="modal-title" style="font-size:20px">No se pudo cargar</div></div><button id="closeModal" class="modal-close">Cerrar ✕</button></div><div style="padding:24px;color:var(--red)">'+esc(e.message)+'</div>';
    document.getElementById('closeModal').onclick=closeDetalle;
  }
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
  const SB_URL='https://qkrrumlbvspbxjoxvxho.supabase.co';
  const SB_KEY='sb_publishable_ZKjsxf9lkh4tgkhAayDvbA_6DOE7E6d';
  const modalBg=document.getElementById('modalBg');
  const modal=document.getElementById('modal');
  modal.innerHTML='<div class="modal-head"><div><div class="modal-title-top">⬆ Registros de Egreso</div><div class="modal-title" style="font-size:20px">'+esc(codigoRemate)+'</div></div><button id="closeModal" class="modal-close">Cerrar ✕</button></div><div style="padding:32px;text-align:center;color:var(--muted)">Cargando egresos...</div>';
  modalBg.style.display='flex';
  document.getElementById('closeModal').onclick=closeDetalle;
  try{
    const res=await fetch(SB_URL+'/rest/v1/egresos_hacienda?remate=eq.'+encodeURIComponent(codigoRemate)+'&order=ts.desc',{
      headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY}
    });
    const rows=await res.json();
    if(!Array.isArray(rows)||!rows.length){
      modal.innerHTML='<div class="modal-head"><div><div class="modal-title-top">⬆ Registros de Egreso</div><div class="modal-title" style="font-size:20px">'+esc(codigoRemate)+'</div></div><button id="closeModal" class="modal-close">Cerrar ✕</button></div><div style="padding:32px;text-align:center;color:var(--muted)">Sin egresos registrados.<br><br><a href="egreso.html?remate='+encodeURIComponent(codigoRemate)+'" target="_blank" style="color:#ff6b7a">→ Registrar primer egreso</a></div>';
      document.getElementById('closeModal').onclick=closeDetalle;
      return;
    }
    const totalCab=rows.reduce((a,r)=>a+(r.total_cabezas||0),0);
    const filas=rows.map(r=>{
      // Agrupar por canónica (claves lowercase de Supabase egresos_hacienda como "vaquillona","torito" se mapean correctamente)
      const cats=Object.entries(agruparCategoriasReg(r.categorias))
        .map(([k,v])=>'<span style="background:rgba(255,77,90,.1);border:1px solid rgba(255,77,90,.25);border-radius:5px;padding:2px 7px;font-size:10px;color:#ff6b7a;margin-right:3px">'+esc(k)+': '+v+'</span>').join('');
      const pdfLink=r.pdf_url?'<a href="'+esc(r.pdf_url)+'" target="_blank" style="color:var(--amber);font-size:11px">📄 PDF</a>':'—';
      const ts=r.ts?new Date(r.ts).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
      return '<tr>'
        +'<td style="padding:8px 10px;border-bottom:1px solid rgba(0,208,132,.08);font-size:12px">'+esc(ts)+'</td>'
        +'<td style="padding:8px 10px;border-bottom:1px solid rgba(0,208,132,.08);font-size:12px;font-weight:700">'+esc(r.tropa||'—')+'</td>'
        +'<td style="padding:8px 10px;border-bottom:1px solid rgba(0,208,132,.08);font-size:12px">'+esc(r.nro_dte||'—')+'</td>'
        +'<td style="padding:8px 10px;border-bottom:1px solid rgba(0,208,132,.08);font-size:12px">'+esc(r.destino||'—')+'</td>'
        +'<td style="padding:8px 10px;border-bottom:1px solid rgba(0,208,132,.08);font-size:12px">'+esc(r.transportista||'—')+'</td>'
        +'<td style="padding:8px 10px;border-bottom:1px solid rgba(0,208,132,.08);font-weight:900;color:#ff6b7a;text-align:right;font-size:14px">'+(r.total_cabezas||0)+'</td>'
        +'<td style="padding:8px 10px;border-bottom:1px solid rgba(0,208,132,.08)">'+cats+'</td>'
        +'<td style="padding:8px 10px;border-bottom:1px solid rgba(0,208,132,.08)">'+pdfLink+'</td>'
        +'</tr>';
    }).join('');
    modal.innerHTML=
      '<div class="modal-head"><div><div class="modal-title-top">⬆ Registros de Egreso</div><div class="modal-title" style="font-size:20px">'+esc(codigoRemate)+'</div></div><button id="closeModal" class="modal-close">Cerrar ✕</button></div>'
      +'<div style="padding:16px 20px;overflow-x:auto">'
      +'<div style="display:flex;align-items:center;gap:16px;margin-bottom:14px">'
      +'<span style="font-size:12px;color:var(--muted)">'+rows.length+' egreso'+(rows.length>1?'s':'')+' registrado'+(rows.length>1?'s':'')+'</span>'
      +'<span style="font-size:20px;font-weight:900;color:#ff6b7a">'+totalCab+' cab. egresadas</span></div>'
      +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">'
      +'<thead><tr style="background:rgba(255,77,90,.06)">'
      +'<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--muted);font-weight:700;letter-spacing:1px">FECHA</th>'
      +'<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--muted);font-weight:700;letter-spacing:1px">TROPA</th>'
      +'<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--muted);font-weight:700;letter-spacing:1px">DTE</th>'
      +'<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--muted);font-weight:700;letter-spacing:1px">DESTINO</th>'
      +'<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--muted);font-weight:700;letter-spacing:1px">TRANSPORTISTA</th>'
      +'<th style="padding:8px 10px;text-align:right;font-size:10px;color:var(--muted);font-weight:700;letter-spacing:1px">CAB.</th>'
      +'<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--muted);font-weight:700;letter-spacing:1px">CATEGORÍAS</th>'
      +'<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--muted);font-weight:700;letter-spacing:1px">PDF</th>'
      +'</tr></thead>'
      +'<tbody>'+filas+'</tbody></table></div></div>';
    document.getElementById('closeModal').onclick=closeDetalle;
  }catch(e){
    modal.innerHTML='<div class="modal-head"><div><div class="modal-title-top">Error</div></div><button id="closeModal" class="modal-close">Cerrar ✕</button></div><div style="padding:24px;color:var(--red)">'+esc(e.message)+'</div>';
    document.getElementById('closeModal').onclick=closeDetalle;
  }
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
  content.appendChild(remView);
  content.appendChild(dteView);
  dteView.style.display='none';

  // Sidebar nav (reemplaza .tab → .nav-item, dataset.tab → dataset.view)
  document.querySelectorAll('.nav-item').forEach(btn=>btn.onclick=function(){
    document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    const isRem=btn.dataset.view==='rem';
    remView.style.display=isRem?'block':'none';
    dteView.style.display=isRem?'none':'block';
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
