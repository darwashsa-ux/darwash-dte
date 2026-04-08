let DATOS_DTES = {};
let DATOS_REMATES = {};
const USUARIOS = {"leoqui1991@gmail.com": {"pass": "36604114", "nombre": "Leo", "mustChange": false}, "lorenzolavaselli@gmail.com": {"pass": "123456", "nombre": "Lorenzo", "mustChange": true}, "fernandodavidurcelay@gmail.com": {"pass": "123456", "nombre": "Fernando", "mustChange": true}, "darwashsa@gmail.com": {"pass": "123456", "nombre": "Darwash SA", "mustChange": true}};
function hashStr(s){let h=0;for(let i=0;i<s.length;i++)h=(Math.imul(31,h)+s.charCodeAt(i))|0;return String(h);} function getUsuarios(){const base={};for(const [email,u] of Object.entries(USUARIOS))base[email]={passHash:hashStr(u.pass),nombre:u.nombre,mustChange:u.mustChange};return base;} function getSession(){try{const s=JSON.parse(localStorage.getItem('dw_session')||'null');if(s&&s.exp>Date.now())return s;}catch(e){}return null;} function setSession(email,nombre){localStorage.setItem('dw_session',JSON.stringify({email,nombre,exp:Date.now()+8*3600*1000}));} function clearSession(){localStorage.removeItem('dw_session');}
function esc(v){return String(v??'—').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}
function badgeClass(s){s=(s||'').toLowerCase(); if(s.includes('vig')) return 'vigente'; if(s.includes('cerr')) return 'cerrado'; if(s.includes('anul')) return 'anulado'; if(s.includes('venc')) return 'vencido'; return '';}
function consClass(v){const s=(v||'').toUpperCase(); if(s.includes('DARWASH')) return 'dar'; if(s.includes('BULLTRADE')) return 'bull'; return 'other';}
function prettyCons(v){return '<span class="cons-chip"><span class="dot '+(consClass(v)==='dar'?'dar':consClass(v)==='bull'?'bull':'')+'"></span>'+esc(v||'-')+'</span>'}
function abreviarCategoria(cat){const map={novillo:'NOV',novillos:'NOV',novillito:'NTO',novillitos:'NTO',vaquillona:'VQ',vaquillonas:'VQ',vaquilla:'VQ',vaquillas:'VQ',vaca:'VA',vacas:'VA',ternero:'TRO',terneros:'TRO',ternera:'TRA',terneras:'TRA',toro:'TO',toros:'TO',torito:'TTO',toritos:'TTO',mamón:'MAM',mamones:'MAM','sin categoria':'S/C'}; const k=String(cat||'').toLowerCase().trim(); return map[k] || String(cat||'').substring(0,3).toUpperCase();}
const app=document.getElementById('app'); const modalBg=document.getElementById('modalBg'); const modal=document.getElementById('modal');
function renderLogin(err=''){app.innerHTML='<div class="login"><div class="login-card"><div class="login-brand"><div class="brand-badge"><div class="brand-drw">DRW</div><div class="brand-sub">DARWASH</div></div><div><div class="title" style="font-size:13px">Livestock dashboard</div><div class="small" style="margin-top:4px">Ingresá con tu usuario autorizado</div></div></div><div class="small" style="margin-bottom:6px">Email</div><input class="input" id="lemail" style="width:100%;margin-bottom:14px"><div class="small" style="margin-bottom:6px">Contraseña</div><input class="input" id="lpass" type="password" style="width:100%;margin-bottom:14px">'+(err?'<div class="login-error">⚠ '+esc(err)+'</div>':'')+'<button id="loginBtn" class="btn" style="width:100%;background:var(--primary);color:#031011;font-weight:800;border-color:rgba(0,210,211,.4)">Ingresar →</button></div></div>'; document.getElementById('loginBtn').onclick=function(){const email=(document.getElementById('lemail').value||'').trim().toLowerCase();const pass=document.getElementById('lpass').value||'';const u=getUsuarios()[email]; if(!u) return renderLogin('Email no registrado.'); if(u.passHash!==hashStr(pass)) return renderLogin('Contraseña incorrecta.'); setSession(email,u.nombre); 
async function init() {
  try {
    const [r1, r2] = await Promise.all([
      fetch('dtes_maestro.json'),
      fetch('remates_maestro.json')
    ]);
    DATOS_DTES = await r1.json();
    DATOS_REMATES = await r2.json();
  } catch(e) { console.error('Error cargando datos:', e); }
  renderApp();
}
init();
};}
function openDetalle(d){ if(!d) return; const items=[['Consignatario',d.consignatario_nombre],['Motivo',d.motivo_detalle],['Categoría',d.categoria_detalle],['Cantidad enviados',d.cantidad_enviados],['TRI',d.nro_tri],['Guía',d.nro_guia],['Certificado faena',d.nro_certificado_faena],['Última aftosa',d.fecha_ultima_aftosa],['Anteúltima aftosa',d.fecha_anteultima_aftosa],['Última brucelosis',d.fecha_ultima_brucelosis],['Emisión detalle',d.fecha_emision_detalle],['Vencimiento detalle',d.fecha_vencimiento_detalle],['Caduca',d.fecha_caduca],['Estado detalle',d.estado_detalle],['Tipo detalle',d.tipo_movimiento_detalle]]; modal.innerHTML='<div class="modal-head"><div><div class="modal-title-top">Detalle DTE</div><div class="modal-title">'+esc(d.nro_dte)+'</div></div><button id="closeModal" class="modal-close">Cerrar ✕</button></div><div class="grid">'+items.map(it=>'<div class="box"><div class="k">'+esc(it[0])+'</div><div class="vv">'+esc(it[1])+'</div></div>').join('')+'</div>'; modalBg.style.display='flex'; document.getElementById('closeModal').onclick=closeDetalle;}
function closeDetalle(){modalBg.style.display='none';} modalBg.onclick=function(e){if(e.target===modalBg) closeDetalle();};
function remateTipoClass(t){const s=String(t||'').toLowerCase(); if(s.includes('entrada')) return 'row-entrada'; if(s.includes('salida')) return 'row-salida'; return '';}
function calcMovSummary(filas){const ingresos={total:0,categorias:{}};const egresos={total:0,categorias:{}};const stats={faena:0,invernada:0,aptoSi:0,aptoNo:0,vacaFaenaNoApto:0};(filas||[]).forEach(f=>{const cantidad=Number(f.recibido)||Number(f.enviado)||0;const cat=f.categoria||'Sin categoria';const t=String(f.tipo_movimiento||'').toLowerCase();const motivo=String(f.motivo||'').toLowerCase();const apto=String(f.apto_china||'').toLowerCase();if(t.includes('entrada')){ingresos.total+=cantidad;ingresos.categorias[cat]=(ingresos.categorias[cat]||0)+cantidad;}else if(t.includes('salida')){egresos.total+=cantidad;egresos.categorias[cat]=(egresos.categorias[cat]||0)+cantidad;}if(motivo.includes('faena'))stats.faena+=cantidad;else if(motivo.includes('invernada'))stats.invernada+=cantidad;if(/^si$/i.test(apto))stats.aptoSi+=cantidad;else if(/^no$/i.test(apto))stats.aptoNo+=cantidad;if(/vaca/i.test(cat)&&motivo.includes('faena')&&/^no$/i.test(apto))stats.vacaFaenaNoApto+=cantidad;});return{ingresos,egresos,stats};}
function renderSummaryBox(title,total,categorias,inOut){const entries=Object.entries(categorias).sort((a,b)=>b[1]-a[1]); return '<div class="summary-box"><div class="summary-head '+inOut+'"><div><div class="small" style="text-transform:uppercase;letter-spacing:1px">'+title+'</div><div class="summary-big">'+total.toLocaleString()+'</div></div></div><div class="summary-cats">'+(entries.length?entries.map(([cat,cant])=>'<div class="cat-pill '+inOut+'" title="'+esc(cat)+'"><span class="cat-code">'+esc(abreviarCategoria(cat))+'</span><span class="cat-num">'+esc(cant)+'</span></div>').join(''):'<div class="small">Sin movimientos</div>')+'</div></div>';}
function renderRemates(){const rems=DATOS_REMATES.remates||[]; const host=document.createElement('div'); let selected=0,q='',tipo='todos',estado='todos',categoria='todos',motivo='todos',aptoChina='todos',sortKey=null,sortDir='asc'; function aptoChinaVal(f){const v=f.apto_china||f['Apto China']||f.aptoChina; return !v?'sin':/^si$/i.test(String(v))?'si':'no';} function draw(){const rem=rems[selected]||null; const cards=rems.map((r,i)=>{const dtes=new Set((r.filas||[]).map(f=>f.documento)).size; const cls='rem-card '+(i===selected?'active ':'')+(((r.info||{}).consignataria||'').toUpperCase().includes('BULLTRADE')?'rem-bulltrade':'rem-darwash'); const rLink='ingreso.html?remate='+encodeURIComponent(r.codigo||'');return '<div class="'+cls+'" data-i="'+i+'"><div class="rem-title">'+esc(r.codigo||'Remate')+'</div><div class="small">'+esc((r.info||{})['Inicio']||'-')+' → '+esc((r.info||{})['Fin']||'-')+'</div><div class="rem-stats"><div><div class="rem-stat-num">'+esc(r.total_animales||0)+'</div><div class="small">ANIMALES</div></div><div><div class="rem-stat-num" style="color:var(--amber)">'+dtes+'</div><div class="small">DTES</div></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px"><a href="'+rLink+'" target="_blank" onclick="event.stopPropagation()" style="display:block;background:rgba(0,208,132,.08);border:1px solid rgba(0,208,132,.25);border-radius:8px;padding:7px 6px;font-size:11px;font-weight:700;color:var(--green);text-align:center;text-decoration:none">📋 Registrar</a><button class="ver-ing-btn" data-codigo="'+esc(r.codigo||'')+'" onclick="event.stopPropagation()" style="background:rgba(62,162,255,.1);border:1px solid rgba(62,162,255,.3);border-radius:8px;padding:7px 6px;font-size:11px;font-weight:700;color:var(--blue);cursor:pointer;width:100%">👁 Ver Ingresos</button></div></div>';}).join(''); let detail=''; if(rem){ const tipos=['todos',...Array.from(new Set((rem.filas||[]).map(f=>f.tipo_movimiento).filter(Boolean)))].sort(); const estados=['todos',...Array.from(new Set((rem.filas||[]).map(f=>f.estado).filter(Boolean)))].sort(); const categorias=['todos',...Array.from(new Set((rem.filas||[]).map(f=>f.categoria).filter(Boolean)))].sort(); const motivos=['todos',...Array.from(new Set((rem.filas||[]).map(f=>f.motivo).filter(Boolean)))].sort(); let rows=(rem.filas||[]).filter(f=>(tipo==='todos'||f.tipo_movimiento===tipo)&&(estado==='todos'||f.estado===estado)&&(categoria==='todos'||(f.categoria||'')===categoria)&&(motivo==='todos'||(f.motivo||'')===motivo)&&(aptoChina==='todos'||aptoChinaVal(f)===aptoChina)); if(q){const qq=q.toLowerCase(); rows=rows.filter(f=>Object.values(f).some(v=>String(v||'').toLowerCase().includes(qq)));} if(sortKey){ rows=[...rows].sort((a,b)=>{const av=a[sortKey]??''; const bv=b[sortKey]??''; const anum=['enviado','recibido'].includes(sortKey)?(Number(av)||0):null; const bnum=['enviado','recibido'].includes(sortKey)?(Number(bv)||0):null; const cmp=anum!==null?(anum-bnum):String(av).localeCompare(String(bv)); return sortDir==='asc'?cmp:-cmp;}); } const sums=calcMovSummary(rows); const s=sums.stats;const alertVaca=s.vacaFaenaNoApto>0?'<div style="background:rgba(255,77,90,.15);border:1px solid rgba(255,77,90,.6);border-radius:10px;padding:10px 16px;margin-bottom:12px;display:flex;align-items:center;gap:10px;font-weight:800;color:var(--red)"><span style="font-size:18px">⚠</span><span>'+s.vacaFaenaNoApto+' VACAS FAENA — NO APTO CHINA</span></div>':'';const statPanel='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">'+'<div style="background:rgba(7,17,18,.9);border:1px solid rgba(21,48,51,.9);border-radius:12px;padding:12px 14px"><div style="font-size:11px;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Faena</div><div style="font-size:28px;font-weight:800;color:var(--red)">'+s.faena+'</div></div>'+'<div style="background:rgba(7,17,18,.9);border:1px solid rgba(21,48,51,.9);border-radius:12px;padding:12px 14px"><div style="font-size:11px;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Invernada</div><div style="font-size:28px;font-weight:800;color:var(--green)">'+s.invernada+'</div></div>'+'<div style="background:rgba(7,17,18,.9);border:1px solid rgba(0,208,132,.25);border-radius:12px;padding:12px 14px"><div style="font-size:11px;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Apto China</div><div style="font-size:28px;font-weight:800;color:var(--green)">'+s.aptoSi+'</div></div>'+'<div style="background:rgba(7,17,18,.9);border:1px solid rgba(255,77,90,.25);border-radius:12px;padding:12px 14px"><div style="font-size:11px;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin-bottom:4px">No Apto China</div><div style="font-size:28px;font-weight:800;color:var(--red)">'+s.aptoNo+'</div></div>'+'</div>'; const summary=alertVaca+'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">'+renderSummaryBox('Ingresos',sums.ingresos.total,sums.ingresos.categorias,'in')+renderSummaryBox('Egresos',sums.egresos.total,sums.egresos.categorias,'out')+'</div>'+statPanel; const header='<div class="filters rem-filters"><input class="input" id="r-q" placeholder="Buscar..." value="'+esc(q)+'"><select class="select" id="r-tipo">'+'<option disabled style="color:#4a6669;font-size:10px;letter-spacing:1px">── TIPO ──</option><option '+(tipo==="todos"?'selected':'')+' value="todos">Todos</option>'+tipos.filter(v=>v!=='todos').map(v=>'<option '+(v===tipo?'selected':'')+' value="'+esc(v)+'">'+esc(v)+'</option>').join('')+'</select><select class="select" id="r-est">'+'<option disabled style="color:#4a6669;font-size:10px;letter-spacing:1px">── ESTADO ──</option><option '+(estado==="todos"?'selected':'')+' value="todos">Todos</option>'+estados.filter(v=>v!=='todos').map(v=>'<option '+(v===estado?'selected':'')+' value="'+esc(v)+'">'+esc(v)+'</option>').join('')+'</select><select class="select" id="r-cat">'+'<option disabled style="color:#4a6669;font-size:10px;letter-spacing:1px">── CATEGORÍA ──</option><option '+(categoria==="todos"?'selected':'')+' value="todos">Todas</option>'+categorias.filter(v=>v!=='todos').map(v=>'<option '+(v===categoria?'selected':'')+' value="'+esc(v)+'">'+esc(v)+'</option>').join('')+'</select><select class="select" id="r-motivo">'+'<option disabled style="color:#4a6669;font-size:10px;letter-spacing:1px">── MOTIVO ──</option><option '+(motivo==="todos"?'selected':'')+' value="todos">Todos</option>'+motivos.filter(v=>v!=='todos').map(v=>'<option '+(v===motivo?'selected':'')+' value="'+esc(v)+'">'+esc(v)+'</option>').join('')+'</select><select class="select" id="r-apto">'+'<option disabled style="color:#4a6669;font-size:10px;letter-spacing:1px">── APTO CHINA ──</option><option '+(aptoChina==="todos"?'selected':'')+' value="todos">Todos</option><option '+(aptoChina==="si"?'selected':'')+' value="si">Apto</option><option '+(aptoChina==="no"?'selected':'')+' value="no">No apto</option><option '+(aptoChina==="sin"?'selected':'')+' value="sin">Sin dato</option>'+'</select><span class="result-count">'+rows.length+' de '+(rem.filas||[]).length+'</span>'+'<button id="r-export" class="ghost-btn" style="margin-left:auto;white-space:nowrap;padding:6px 16px;font-size:12px;font-weight:700;border-color:rgba(0,208,132,.35);color:var(--green)">⬇ Excel</button></div>'; ; const cols=[['tipo_movimiento','Tipo'],['documento','Documento'],['emisor_nombre','Emisor'],['receptor_nombre','Receptor'],['categoria','Categoría'],['fecha_movimiento','Fecha Mov.'],['motivo','Motivo'],['estado','Estado'],['apto_china','Apto China'],['enviado','Env.'],['recibido','Rec.']]; const th=cols.map(([k,l])=>'<th data-sort="'+k+'" class="sorter">'+l+(sortKey===k?(sortDir==='asc'?' ↑':' ↓'):' ↕')+'</th>').join(''); function aptoChinaBadge(f){const v=f.apto_china||f['Apto China']||f.aptoChina; const lbl=!v?'Sin dato':/^si$/i.test(String(v))?'Apto':'No apto'; const cls=!v?'apto-sin':/^si$/i.test(String(v))?'apto-si':'apto-no'; return {lbl,cls};} const body=rows.map(f=>{const ac=aptoChinaBadge(f); return '<tr class="'+remateTipoClass(f.tipo_movimiento)+'"><td class="nowrap col-tipo">'+esc(f.tipo_movimiento||'-')+'</td><td class="link dte-link nowrap numcol col-dte" data-doc="'+esc(f.documento||'')+'">'+esc(f.documento||'-')+'</td><td>'+esc(f.emisor_nombre||'-')+'</td><td>'+esc(f.receptor_nombre||'-')+'</td><td class="nowrap">'+esc(f.categoria||'-')+'</td><td class="nowrap numcol col-fecha">'+esc(f.fecha_movimiento||'-')+'</td><td>'+esc(f.motivo||'-')+'</td><td class="nowrap col-estado"><span class="badge '+badgeClass(f.estado)+'">'+esc(f.estado||'-')+'</span></td><td class="nowrap col-apto-china"><span class="badge apto-china '+ac.cls+'">'+esc(ac.lbl)+'</span></td><td style="text-align:right" class="nowrap numcol">'+esc(f.enviado||0)+'</td><td style="text-align:right" class="nowrap numcol">'+esc(f.recibido||0)+'</td></tr>';}).join(''); detail='<div class="detail-head"><div class="section-title">'+esc(rem.codigo||'Remate')+'</div><div class="small">'+esc((rem.info||{})['Predio ferial']||'')+'</div></div>'+header+summary+'<div class="table-wrap"><table><thead><tr>'+th+'</tr></thead><tbody>'+body+'</tbody></table></div>'; } else { detail='<div class="small">No hay remates cargados.</div>'; } const wasSearch=document.activeElement&&document.activeElement.id==='r-q'&&host.contains(document.activeElement); const selStart=wasSearch?document.activeElement.selectionStart:0; const selEnd=wasSearch?document.activeElement.selectionEnd:0; host.innerHTML='<div class="wrap"><div class="small" style="margin-bottom:12px">EVENTOS REGISTRADOS</div><div class="rem-grid">'+cards+'</div>'+detail+'</div>'; host.querySelectorAll('.rem-card').forEach(el=>el.onclick=function(){const prev=selected; selected=Number(el.dataset.i); if(prev!==selected){q=''; tipo='todos'; estado='todos'; categoria='todos'; motivo='todos'; aptoChina='todos';} draw();}); host.querySelectorAll('.dte-link').forEach(el=>el.onclick=function(){const d=(DATOS_DTES.dtes||[]).find(x=>String(x.nro_dte)===String(el.dataset.doc)); openDetalle(d);});
    host.querySelectorAll('.ver-ing-btn').forEach(el=>el.onclick=function(){verIngresos(el.dataset.codigo);}); const rq=host.querySelector('#r-q'); if(rq){rq.oninput=e=>{q=e.target.value; draw();}; if(wasSearch){rq.focus(); rq.setSelectionRange(selStart,selEnd);}} const rt=host.querySelector('#r-tipo'); if(rt) rt.onchange=e=>{tipo=e.target.value; draw();}; const re=host.querySelector('#r-est'); if(re) re.onchange=e=>{estado=e.target.value; draw();}; const rc=host.querySelector('#r-cat'); if(rc) rc.onchange=e=>{categoria=e.target.value; draw();}; const rmo=host.querySelector('#r-motivo'); if(rmo) rmo.onchange=e=>{motivo=e.target.value; draw();}; const ra=host.querySelector('#r-apto'); if(ra) ra.onchange=e=>{aptoChina=e.target.value; draw();}; host.querySelectorAll('.sorter').forEach(th=>th.onclick=function(){const k=this.dataset.sort; if(sortKey===k){sortDir=sortDir==='asc'?'desc':'asc';} else {sortKey=k; sortDir='asc';} draw();}); const rexp=host.querySelector('#r-export'); if(rexp) rexp.onclick=()=>exportRemates(rows); }
 draw(); return host; }
function renderDtes(){
  const wrap=document.createElement('div');
  let q='',cons='todas',est='todos',periodo='7d',fechaDesde='',fechaHasta='';
  let sortKey=null,sortDir='asc';

  const COLS=[
    ['consignataria','Consignataria'],['nro_dte','Nro. DTE'],['emisor_nombre','Emisor'],
    ['emisor_cuit','CUIT Emisor'],['renspa_origen','RENSPA Origen'],['receptor_nombre','Receptor'],
    ['receptor_cuit','CUIT Receptor'],['renspa_destino','RENSPA Destino'],['tipo','Tipo'],
    ['estado','Estado'],['fecha_carga','Carga'],['fecha_vencimiento','Vencimiento'],[null,'']
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
      if(est!=='todos'&&(d.estado||'')!==est) return false;
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
    const estOpts=['todos',...Array.from(new Set(all.map(x=>x.estado).filter(Boolean)))];
    const total=all.length,vig=all.filter(x=>/vigente/i.test(x.estado||'')).length,venc=all.filter(x=>/vencido/i.test(x.estado||'')).length,anu=all.filter(x=>/anulado/i.test(x.estado||'')).length;

    const periodos=[['hoy','Hoy'],['7d','7 días'],['30d','30 días'],['mes','Este mes'],['todo','Todos'],['custom','Personalizado']];
    const periodoSelect='<select class="select" id="d-periodo">'+periodos.map(([v,l])=>'<option '+(periodo===v?'selected':'')+' value="'+v+'">'+l+'</option>').join('')+'</select>';
    const customInputs=periodo==='custom'
      ?'<input type="date" class="input" id="d-desde" style="max-width:150px" value="'+fechaDesde+'" title="Desde"><input type="date" class="input" id="d-hasta" style="max-width:150px" value="'+fechaHasta+'" title="Hasta">'
      :'';

    const rowsHtml=rows.map(d=>{
      const rc=consClass(d.consignataria)==='dar'?'row-darwash':consClass(d.consignataria)==='bull'?'row-bulltrade':'';
      return '<tr class="'+rc+'"><td class="nowrap col-consig">'+prettyCons(d.consignataria)+'</td><td class="link dte-open nowrap numcol col-dte" data-dte="'+esc(d.nro_dte)+'">'+esc(d.nro_dte)+'</td><td>'+esc(d.emisor_nombre)+'</td><td class="nowrap numcol col-cuit">'+esc(d.emisor_cuit)+'</td><td class="nowrap numcol" style="font-size:11px;color:var(--muted)">'+esc(d.renspa_origen||'—')+'</td><td>'+esc(d.receptor_nombre)+'</td><td class="nowrap numcol col-cuit">'+esc(d.receptor_cuit)+'</td><td class="nowrap numcol" style="font-size:11px;color:var(--muted)">'+esc(d.renspa_destino||'—')+'</td><td class="nowrap col-tipo">'+esc(d.tipo)+'</td><td class="nowrap col-estado"><span class="badge '+badgeClass(d.estado)+'">'+esc(d.estado)+'</span></td><td class="nowrap numcol col-fecha">'+esc(d.fecha_carga)+'</td><td class="nowrap numcol col-fecha">'+esc(d.fecha_vencimiento)+'</td><td class="nowrap"><button class="ghost-btn ver-btn" data-dte="'+esc(d.nro_dte)+'">Ver detalle</button></td></tr>';
    }).join('');

    const ultimaFecha=DATOS_DTES.fecha_extraccion?new Date(DATOS_DTES.fecha_extraccion).toLocaleString('es-AR'):'—';

    const thHtml=COLS.map(([k,l])=>{
      if(!k) return '<th class="nowrap"></th>';
      const icon=sortKey===k?(sortDir==='asc'?' ↑':' ↓'):'<span style="opacity:.35"> ↕</span>';
      return '<th class="sorter nowrap" data-sort="'+k+'" style="cursor:pointer;user-select:none">'+l+icon+'</th>';
    }).join('');

    wrap.innerHTML='<div class="wrap">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">'
      +'<div class="cards" style="margin:0;flex:1">'
      +'<div class="card total"><div class="k">Total DTEs</div><div class="v">'+total+'</div></div>'
      +'<div class="card vig"><div class="k">Vigentes</div><div class="v">'+vig+'</div></div>'
      +'<div class="card ven"><div class="k">Vencidos</div><div class="v">'+venc+'</div></div>'
      +'<div class="card anu"><div class="k">Anulados</div><div class="v">'+anu+'</div></div>'
      +'</div>'
      +'<div style="font-size:11px;color:var(--muted);text-align:right;padding-left:16px;white-space:nowrap">🕐 Última actualización<br><span style="color:var(--text)">'+ultimaFecha+'</span></div>'
      +'</div>'
      +'<div class="filters">'
      +'<input class="input" id="q" placeholder="Buscar por emisor, receptor, DTE, RENSPA..." value="'+esc(q)+'">'
      +periodoSelect
      +customInputs
      +'<select class="select" id="cons">'
      +'<option disabled style="color:#4a6669;font-size:10px;letter-spacing:1px">── CONSIGNATARIA ──</option>'
      +'<option '+(cons==='todas'?'selected':'')+' value="todas">Todas</option>'
      +consOpts.filter(v=>v!=='todas').map(v=>'<option '+(v===cons?'selected':'')+' value="'+esc(v)+'">'+esc(v)+'</option>').join('')
      +'</select>'
      +'<select class="select" id="est">'
      +'<option disabled style="color:#4a6669;font-size:10px;letter-spacing:1px">── ESTADO ──</option>'
      +'<option '+(est==='todos'?'selected':'')+' value="todos">Todos</option>'
      +estOpts.filter(v=>v!=='todos').map(v=>'<option '+(v===est?'selected':'')+' value="'+esc(v)+'">'+esc(v)+'</option>').join('')
      +'</select>'
      +'<span class="result-count">'+rows.length+' de '+all.length+'</span>'
      +'<button id="d-export" class="ghost-btn" style="margin-left:auto;white-space:nowrap;padding:6px 16px;font-size:12px;font-weight:700;border-color:rgba(0,208,132,.35);color:var(--green)">⬇ Excel</button>'
      +'</div>'
      +'<div class="table-wrap"><table><thead><tr>'+thHtml+'</tr></thead><tbody>'+rowsHtml+'</tbody></table></div></div>';

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
  }
  draw(); return wrap;
}
const SB_URL='https://qkrrumlbvspbxjoxvxho.supabase.co';
const SB_KEY='sb_publishable_ZKjsxf9lkh4tgkhAayDvbA_6DOE7E6d';

async function verIngresos(codigoRemate){
  const modalBg=document.getElementById('modalBg');
  const modal=document.getElementById('modal');
  modal.innerHTML='<div class="modal-head"><div><div class="modal-title-top">Registros de Ingreso</div><div class="modal-title" style="font-size:22px">'+esc(codigoRemate)+'</div></div><button id="closeModal" class="modal-close">Cerrar ✕</button></div><div style="padding:32px;text-align:center;color:var(--muted)">Cargando registros...</div>';
  modalBg.style.display='flex';
  document.getElementById('closeModal').onclick=closeDetalle;
  try{
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
    regs.forEach(r=>{Object.entries(r.categorias||{}).forEach(([k,v])=>{catTotals[k]=(catTotals[k]||0)+v;});});
    const catPills=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<span style="background:rgba(0,208,132,.1);border:1px solid rgba(0,208,132,.25);border-radius:6px;padding:2px 8px;font-size:11px">'+esc(k)+': '+v+'</span>').join(' ');
    const rows=regs.map(reg=>{
      const cats=Object.entries(reg.categorias||{}).map(([k,v])=>'<span style="font-size:10px;background:rgba(0,208,132,.08);border:1px solid rgba(0,208,132,.2);border-radius:4px;padding:1px 5px">'+esc(k)+':'+v+'</span>').join(' ');
      return '<tr style="border-bottom:1px solid rgba(15,27,28,.95)">'
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
        +'</tr>';
    }).join('');
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
      +'<th style="padding:10px 14px;text-align:left;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase">Obs.</th>'+'<th style="padding:10px 14px;text-align:left;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase">PDF</th>'+'<th style="padding:10px 14px;text-align:left;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase">Fotos</th>'
      +'</tr></thead><tbody>'+rows+'</tbody></table></div>';
    document.getElementById('closeModal').onclick=closeDetalle;
  }catch(e){
    modal.innerHTML='<div class="modal-head"><div><div class="modal-title-top">Error</div><div class="modal-title" style="font-size:20px">No se pudo cargar</div></div><button id="closeModal" class="modal-close">Cerrar ✕</button></div><div style="padding:24px;color:var(--red)">'+esc(e.message)+'</div>';
    document.getElementById('closeModal').onclick=closeDetalle;
  }
}

function exportToExcel(rows, cols, filename) {
  if (!rows || rows.length === 0) { alert('No hay datos para exportar.'); return; }
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
  XLSX.writeFile(wb, filename + '_' + date + '.xlsx');
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
function renderApp(){const s=getSession(); if(!s) return renderLogin(); app.innerHTML='<div class="header"><div class="brand-wrap"><div class="brand-badge"><div class="brand-drw">DRW</div><div class="brand-sub">DARWASH</div></div><div class="title">Tablero DTEs SIGSA / SENASA</div></div><div class="user-pill">'+esc(s.nombre)+' <button id="logoutBtn" class="logout-btn">Salir</button></div></div><div class="tabs"><button class="tab active" data-tab="rem">Remates</button><button class="tab" data-tab="dte">DTEs</button></div><div id="content"></div>'; const content=document.getElementById('content'); const remView=renderRemates(); const dteView=renderDtes(); content.appendChild(remView); content.appendChild(dteView); dteView.style.display='none'; document.querySelectorAll('.tab').forEach(btn=>btn.onclick=function(){document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); const isRem=btn.dataset.tab==='rem'; remView.style.display=isRem?'block':'none'; dteView.style.display=isRem?'none':'block';}); document.getElementById('logoutBtn').onclick=function(){clearSession(); renderLogin();};}

async function init() {
  try {
    const [r1, r2] = await Promise.all([
      fetch('dtes_maestro.json'),
      fetch('remates_maestro.json')
    ]);
    DATOS_DTES = await r1.json();
    DATOS_REMATES = await r2.json();
  } catch(e) { console.error('Error cargando datos:', e); }
  renderApp();
}
init();
