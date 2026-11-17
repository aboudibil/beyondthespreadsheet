// Loads editable settings + renders the commons from data the CMS manages.
async function loadSettings(){
  try{
    const r=await fetch('/assets/data/settings.json'); if(!r.ok) return;
    const s=await r.json();
    if(s.newsletter){document.querySelectorAll('[data-subscribe]').forEach(a=>{a.href=s.newsletter;a.target='_blank';a.rel='noopener';});}
    if(s.contribute){const f=document.querySelector('form[data-contribute]'); if(f) f.setAttribute('action',s.contribute);}
  }catch(e){}
}
function toolCard(t){
  const tags=(t.tags||'').split(',').map(x=>x.trim()).filter(Boolean).map(x=>`<span class="tag">${x}</span>`).join('');
  const st=(t.status||'planned').toLowerCase();
  const stLabel={live:'Live',next:'Next',planned:'Planned'}[st]||'Planned';
  let cta='';
  if(t.open) cta+=`<a class="mini g" href="${t.open}" target="_blank" rel="noopener">Open</a>`;
  if(t.download) cta+=`<a class="mini d" href="${t.download}" download>&#8595; Download</a>`;
  if(t.docs) cta+=`<a class="mini" href="${t.docs}">Docs</a>`;
  const theory=t.theory?`<div class="row"><span class="rk">Theory</span><span class="rv ${t.status==='live'?'':'dim'}">${t.theory}</span></div>`:'';
  return `<div class="card"><div class="tags">${tags}<span class="status st-${st}">${stLabel}</span></div>
    <h3>${t.name||''}</h3><div class="sub">${t.question||''}</div>
    <div class="kv">${theory}</div>
    <div class="cardcta">${cta}</div></div>`;
}
function contributeCard(){
  return `<div class="card dashed"><div class="tags"><span class="tag">Invited experts</span><span class="status st-open">Open</span></div>
    <h3>Your tool here</h3><div class="sub">Public-sector-native and grounded in theory? It belongs in the commons.</div>
    <div class="cardcta"><a class="mini" href="/contribute.html">Contribute &#8594;</a></div></div>`;
}
async function loadTools(){
  const grid=document.getElementById('tools-grid'); if(!grid) return;
  try{
    const r=await fetch('/assets/data/tools.json'); const d=await r.json();
    grid.innerHTML=(d.tools||[]).map(toolCard).join('')+contributeCard();
  }catch(e){ grid.innerHTML=contributeCard(); }
}
loadSettings(); loadTools();

// Proof-of-concept gallery (problems page). Empty list = keep the static placeholder cards.
function pocCard(p){
  const tags=[p.domain,p.pattern].filter(Boolean).map(x=>`<span class="tag">${x}</span>`).join('');
  let cta='';
  if(p.document) cta+=`<a class="mini g" href="${p.document}" target="_blank" rel="noopener">Read</a>`;
  if(p.download) cta+=`<a class="mini d" href="${p.download}" download>&#8595; Download</a>`;
  const row=(k,v)=>v?`<div class="row"><span class="rk">${k}</span><span class="rv">${v}</span></div>`:'';
  return `<div class="card"><div class="tags">${tags}<span class="status st-live">Published</span></div>
    <h3>${p.name||''}</h3><div class="sub">${p.question||''}</div>
    <div class="kv">${row('Approach',p.approach)}${row('Theory',p.theory)}</div>
    <div class="cardcta">${cta}</div></div>`;
}
async function loadPocs(){
  const grid=document.getElementById('pocs-grid'); if(!grid) return;
  try{
    const r=await fetch('/assets/data/pocs.json'); if(!r.ok) return;
    const d=await r.json(); const list=(d.pocs||[]).filter(p=>p.published!==false);
    if(!list.length) return;
    const suggest=`<div class="card dashed"><div class="tags"><span class="tag">Open</span><span class="status st-open">Open</span></div>
      <h3>Your policy here?</h3><div class="sub">Suggest a public policy you'd like to see explored.</div>
      <div class="cardcta"><a class="mini" href="#suggest">Suggest &#8594;</a></div></div>`;
    grid.innerHTML=list.map(pocCard).join('')+suggest;
  }catch(e){}
}
loadPocs();
