/* CPAF v6 — Policy Interaction Analysis
   Shared engine + renderer. Used by (a) the in-app panel and (b) the generated exports.
   Reads the real Simulation/Config. All headline numbers are REPLICATED (no single-seed point estimates).
   Honesty rules baked in:
     - reliability (escape probability) is the headline; escape time is shown as a median + range, never one number
     - structural backbone is found via the smallest set that still escapes, NOT full-portfolio leave-one-out
     - every output records which case and which selection it analysed
*/
var PolicyExplorer = (function(){
  "use strict";

  // ---- state guard: never clobber the app's live run ----
  function asArr(s){ if(!s) return []; if(s instanceof Set) return [...s]; if(Array.isArray(s)) return s.slice(); return []; }
  function save(){
    const live=Simulation.getState();
    return { S:JSON.parse(JSON.stringify(live)),
             activePolicies:asArr(live.activePolicies),
             cascadeActivated:asArr(live.cascadeActivated),
             couplings:asArr(live.couplings),
             log:(Simulation.getEventLog?JSON.parse(JSON.stringify(Simulation.getEventLog())):null),
             dq:(Simulation.getDelayQueues?JSON.parse(JSON.stringify(Simulation.getDelayQueues())):null) };
  }
  function restore(snap){
    const live=Simulation.getState(); const SET={activePolicies:1,cascadeActivated:1,couplings:1};
    Object.keys(snap.S).forEach(k=>{ if(!SET[k]) live[k]=snap.S[k]; });
    live.activePolicies=new Set(snap.activePolicies);
    live.cascadeActivated=new Set(snap.cascadeActivated);
    live.couplings=new Set(snap.couplings);
    if(snap.log&&Simulation.getEventLog){const el=Simulation.getEventLog();el.length=0;snap.log.forEach(e=>el.push(e));}
    if(snap.dq&&Simulation.getDelayQueues){const dq=Simulation.getDelayQueues();Object.keys(dq).forEach(k=>{if(Array.isArray(dq[k]))dq[k].length=0;});Object.keys(snap.dq).forEach(k=>{if(!Array.isArray(dq[k]))dq[k]=[];snap.dq[k].forEach(v=>dq[k].push(v));});}
  }

  // ---- seeded PRNG ----
  function mulberry(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

  // ---- activate exactly the desired set (cascades are genuine additions, never double-toggled off) ----
  function activate(ids){ const st=Simulation.getState(); st.activePolicies.clear();
    ids.forEach(id=>{ if(!Simulation.getState().activePolicies.has(id)) Simulation.togglePolicy(id); }); }

  function currentCase(){ try{ return Simulation.getState().caseStudy||'chikankari'; }catch(e){ return 'chikankari'; } }
  function TH(){ return (typeof Config!=='undefined'&&Config.THRESHOLDS)?Config.THRESHOLDS:{TRAP:2000,GROWTH:4122}; }

  // ---- one trajectory (returns time-series + escape month or null) ----
  function runSeries(ids, seed, caseId){
    caseId=caseId||currentCase();
    const orig=Math.random; Math.random=mulberry(seed);
    try{
      Simulation.initState(caseId); if(Simulation.setSeed)Simulation.setSeed(seed); activate(ids);
      const cf=Config.COMPLEXITY.tensions.coordinationFriction;
      const active=Array.from(Simulation.getState().activePolicies);
      const keys=active.filter(id=>{const p=Config.getPolicy(id);return p&&!p.isUmbrella;});
      const out={coord:[],coherence:[],income:[],state:[],eff:[],friction:[],coordEffect:[],pe:{},keys:keys.slice(),esc:null};
      keys.forEach(id=>out.pe[id]=[]);
      for(let m=0;m<360;m++){
        Simulation.step(false); const S=Simulation.getState();
        out.coord.push(S.coordination); out.coherence.push(S.policyCoherence!=null?S.policyCoherence:1); out.income.push(S.income); out.state.push(S.attractorState);
        const ec=Simulation.effectivePolicyCount?Simulation.effectivePolicyCount():active.length;
        out.eff.push(ec);
        out.friction.push(ec>2?Math.min(cf.maxFriction,cf.frictionPerPolicy*Math.pow(ec-2,2)):0);
        const cE=S._coordEffect||0.5; out.coordEffect.push(cE);
        keys.forEach(id=>{const p=Config.getPolicy(id);let mg=0;if(p&&S.activePolicies.has(id)){const cov=p.coverage==null?1:p.coverage;for(const k in p.effects)mg+=Math.abs(p.effects[k])*cov*cE;}out.pe[id].push(mg);});
        if(out.esc===null&&S.attractorState==='GROWTH')out.esc=S.totalMonths;
      }
      out.final=Simulation.getState().income;
      return out;
    } finally { Math.random=orig; }
  }

  // ---- per-analysis memo cache: escapeStats is deterministic (fixed seeds), so the same
  // (ids,N,case) always yields the same result. backbone and leave-one-out overlap heavily,
  // so caching within one analysis run removes that redundant work with zero change to results.
  let _escCache=null;
  const _escKey=(ids,caseId,N)=>caseId+'|'+N+'|'+ids.slice().sort().join(',');
  function clearEscCache(on){ _escCache = on ? {} : null; }
  // ---- replicated escape statistics (the honest headline) ----
  function escapeStats(ids, caseId, N){
    N=N||24; caseId=caseId||currentCase();
    const _k=_escCache?_escKey(ids,caseId,N):null; if(_k&&_escCache[_k]) return _escCache[_k];
    let p=0, escs=[], finals=[];
    for(let i=0;i<N;i++){ const s=runSeries(ids,1000+i*97,caseId);
      finals.push(s.final);
      if(s.state[s.state.length-1]==='GROWTH'){ p++; if(s.esc!=null) escs.push(s.esc); } }
    escs.sort((a,b)=>a-b); finals.sort((a,b)=>a-b);
    const q=f=>escs.length?escs[Math.min(escs.length-1,Math.floor(escs.length*f))]:null;
    const ret={ prob:Math.round(100*p/N), n:N, median:escs.length?escs[escs.length>>1]:null,
             min:escs[0]??null, max:escs[escs.length-1]??null, p10:q(0.1), p90:q(0.9),
             medianFinal: finals.length?finals[finals.length>>1]:null };
    if(_k&&_escCache)_escCache[_k]=ret; return ret;
  }

  function _cacheSet(k,v){ if(k&&_escCache) _escCache[k]=v; return v; }

  // ---- leave-one-out RELATIVE to a given selection (necessity) ----
  function leaveOneOut(ids, caseId, N){
    N=N||16; caseId=caseId||currentCase();
    const base=escapeStats(ids,caseId,N).prob;
    const rows=ids.map(d=>{ const p=escapeStats(ids.filter(x=>x!==d),caseId,N).prob; const dP=p-base;
      const cls=dP<=-15?'load':(dP>=15?'counter':'redundant'); return {id:d,prob:p,dProb:dP,cls:cls}; });
    rows.sort((a,b)=>a.dProb-b.dProb);
    const allRedundant = rows.every(r=>r.cls==='redundant');
    return { base:base, rows:rows, allRedundant:allRedundant };
  }

  // ---- BACKBONE: smallest set that still escapes (greedy shedding) ----
  // Repeatedly drop the policy whose removal leaves the HIGHEST escape probability
  // (the most redundant), until no policy can be dropped without falling below `keepAbove`.
  function backbone(ids, caseId, N, keepAbove){
    N=N||16; caseId=caseId||currentCase(); keepAbove=(keepAbove==null?90:keepAbove);
    const baseStats=escapeStats(ids,caseId,N);
    let cur=ids.slice(); const shed=[];
    let guard=0;
    while(cur.length>1 && guard++<ids.length+2){
      let best=null;
      for(const d of cur){ const p=escapeStats(cur.filter(x=>x!==d),caseId,N).prob;
        if(best===null||p>best.prob) best={id:d,prob:p}; }
      if(best && best.prob>=keepAbove){ shed.push(best); cur=cur.filter(x=>x!==best.id); }
      else break;
    }
    // classify remaining core members by how far each one's removal drops escape
    const core=cur.map(id=>{ const p=escapeStats(cur.filter(x=>x!==id),caseId,N).prob;
      return {id:id, probWhenRemoved:p, drop:baseStats.prob-p, tier:(p<=15?'hard':'soft')}; });
    core.sort((a,b)=>b.drop-a.drop);
    // redundancy flag: if many policies were shed, the minimal set is not unique (other small sets also suffice)
    const highlyRedundant = shed.length >= 4;
    return { baseStats:baseStats, core:core, shed:shed, keepAbove:keepAbove, caseId:caseId, selection:ids.slice(),
             hardEssential:core.filter(c=>c.tier==='hard').map(c=>c.id),
             highlyRedundant:highlyRedundant };
  }

  // ---- ASYNC twins: same maths, but yield to the browser every few runs so the page never freezes ----
  // Each atomic runSeries is individually guarded (save→run→restore), so the live simulation is
  // untouched even though the browser gets control between runs. onRun ticks a live counter.
  const _tick = () => new Promise(r=>setTimeout(r,0));
  async function escapeStatsAsync(ids, caseId, N, onRun){
    N=N||24; caseId=caseId||currentCase();
    const _k=_escCache?_escKey(ids,caseId,N):null; if(_k&&_escCache[_k]) return _escCache[_k];
    let p=0, escs=[], finals=[];
    for(let i=0;i<N;i++){
      guarded(()=>{ const s=runSeries(ids,1000+i*97,caseId); finals.push(s.final);
        if(s.state[s.state.length-1]==='GROWTH'){ p++; if(s.esc!=null) escs.push(s.esc); } });
      if(onRun) onRun();
      if(i%3===2) await _tick();
    }
    escs.sort((a,b)=>a-b); finals.sort((a,b)=>a-b);
    const q=f=>escs.length?escs[Math.min(escs.length-1,Math.floor(escs.length*f))]:null;
    const ret={ prob:Math.round(100*p/N), n:N, median:escs.length?escs[escs.length>>1]:null,
             min:escs[0]??null, max:escs[escs.length-1]??null, p10:q(0.1), p90:q(0.9),
             medianFinal: finals.length?finals[finals.length>>1]:null };
    if(_k&&_escCache)_escCache[_k]=ret; return ret;
  }
  async function leaveOneOutAsync(ids, caseId, N, onRun){
    N=N||16; caseId=caseId||currentCase();
    const base=(await escapeStatsAsync(ids,caseId,N,onRun)).prob;
    const rows=[];
    for(const d of ids){ const p2=(await escapeStatsAsync(ids.filter(x=>x!==d),caseId,N,onRun)).prob; const dP=p2-base;
      const cls=dP<=-15?'load':(dP>=15?'counter':'redundant'); rows.push({id:d,prob:p2,dProb:dP,cls:cls}); }
    rows.sort((a,b)=>a.dProb-b.dProb);
    return { base:base, rows:rows, allRedundant:rows.every(r=>r.cls==='redundant') };
  }
  async function backboneAsync(ids, caseId, N, keepAbove, onRun){
    N=N||16; caseId=caseId||currentCase(); keepAbove=(keepAbove==null?90:keepAbove);
    const baseStats=await escapeStatsAsync(ids,caseId,N,onRun);
    let cur=ids.slice(); const shed=[];
    let g=0;
    while(cur.length>1 && g++<ids.length+2){
      let best=null;
      for(const d of cur){ const p2=(await escapeStatsAsync(cur.filter(x=>x!==d),caseId,N,onRun)).prob;
        if(best===null||p2>best.prob) best={id:d,prob:p2}; }
      if(best && best.prob>=keepAbove){ shed.push(best); cur=cur.filter(x=>x!==best.id); }
      else break;
    }
    const core=[];
    for(const id of cur){ const p2=(await escapeStatsAsync(cur.filter(x=>x!==id),caseId,N,onRun)).prob;
      core.push({id:id, probWhenRemoved:p2, drop:baseStats.prob-p2, tier:(p2<=15?'hard':'soft')}); }
    core.sort((a,b)=>b.drop-a.drop);
    return { baseStats:baseStats, core:core, shed:shed, keepAbove:keepAbove, caseId:caseId, selection:ids.slice(),
             hardEssential:core.filter(c=>c.tier==='hard').map(c=>c.id),
             highlyRedundant: shed.length>=4 };
  }

  // ---- ghost trajectories: income with each core policy pulled (for the outcome chart) ----
  function ghosts(coreIds, ids, caseId, seed){
    caseId=caseId||currentCase(); seed=seed||4242;
    const full=runSeries(ids,seed,caseId);
    const lines=coreIds.map(id=>({id:id, income:runSeries(ids.filter(x=>x!==id),seed,caseId).income}));
    return { full:full, lines:lines };
  }

  // formatting
  function ym(mo){ return mo==null?'—':(Math.floor(mo/12)+'y'+(mo%12)+'m'); }
  function rupee(v){ try{return '₹'+Math.round(v).toLocaleString('en-IN');}catch(e){return '₹'+Math.round(v);} }

  // plain-language "why this happens" — only the tensions actually active in this scenario (no T-codes in the words)
  function tensionNotes(ids, caseId, rep){
    caseId=caseId||currentCase();
    const out=[];
    const eff = rep ? rep.keys.length : ids.length;
    const coordStart = rep ? rep.coord[0] : null;
    const coordFinal = rep ? rep.coord[rep.coord.length-1] : null;
    const coordRose = rep && coordFinal > coordStart + 0.02;
    const coordFell = rep && coordFinal < coordStart - 0.02;
    const maxFric = (rep && rep.friction && rep.friction.length) ? Math.max.apply(null, rep.friction) : 0;
    const fricMaterial = rep ? (maxFric >= 0.05) : (eff > 3);
    if(coordFell && eff>2 && fricMaterial) out.push({code:'T3', title:'Coordination friction',
      text:'Inter-agency friction (meetings, reporting, competing mandates) grows faster than the number of policies, and here it outweighs co-op building — coordination slips from about '+coordStart.toFixed(2)+' to '+coordFinal.toFixed(2)+'. More policies can mean weaker delivery.'});
    else if(coordFell) out.push({code:'T3', title:'Coordination decay in the trap',
      text:'Inter-policy friction is minor here — the fall from about '+coordStart.toFixed(2)+' to '+coordFinal.toFixed(2)+' comes from the trap itself: while incomes stay low, failed initiatives outweigh successes and coordination erodes. The cure is momentum (structural policies that lift income), not fewer policies.'});
    if(rep && rep.coherence && rep.coherence.length){
      const cohStart = rep.coherence[0], cohFinal = rep.coherence[rep.coherence.length-1];
      if(eff>=3 && cohFinal < cohStart - 0.03) out.push({code:'B-FRAG', title:'Delivery coherence erodes',
        text:'Inter-ministry delivery coherence (C_eff, the multiplier on every policy effect) slips from about '+cohStart.toFixed(2)+' to '+cohFinal.toFixed(2)+' as the portfolio grows — this, not the artisan co-op, is where "more policies can mean weaker delivery" actually bites.'});
      else if(eff>=3) out.push({code:'R-COHERE', title:'Delivery coherence holds',
        text:'Inter-ministry delivery coherence (C_eff, the multiplier on every policy effect) holds around '+cohFinal.toFixed(2)+' — coherence-building instruments offset portfolio friction, so delivery stays intact as the number of policies grows. This is a separate stream from the artisan co-op (which the cluster policies build).'});
    }
    if(/chikankari/i.test(caseId)) out.push({code:'T2', title:'Middlemen adaptation',
      text:'Intermediaries re-capture income as it rises, so a policy that breaks their grip (GI registration) stays essential even when other policies look interchangeable.'});
    const market=['GI_REGISTRATION','MARKETING_SUPPORT','ECOMMERCE','MAI','PMEGP','HUNAR_HAAT'];
    if(ids.some(id=>market.indexOf(id)>=0)) out.push({code:'T1', title:'Market vs heritage',
      text:'Commercial policies lift income but can erode authenticity — a culture-policy trade-off worth watching as market access grows.'});
    return out;
  }

  // umbrella → cascade children, for transparency about effective vs selected instruments
  function cascadeInfo(ids){
    return ids.map(id=>{ const p=Config.getPolicy(id);
      return (p&&p.isUmbrella&&p.cascadeChildren&&p.cascadeChildren.length)?{umbrella:id, name:(p.name||id), children:p.cascadeChildren.slice()}:null;
    }).filter(Boolean);
  }

  // run any analysis with the live state protected
  function guarded(fn){ const snap=save(); try{ return fn(); } finally { restore(snap); } }

  // ================= RENDERING =================
  let THEME={ grid:'#3a3326', dim:'#a99e86', line:'#e0b86a', trap:'#b9684e', growth:'#7fa45f', gate:'#d8923f', teal:'#5fa3a0', amber:'#d8923f', brass:'#c79a52' };
  function setTheme(t){ Object.assign(THEME,t||{}); }
  const PAL=['#c79a52','#5fa3a0','#d8923f','#7fa45f','#b9684e','#8d7bc0','#cf9fb0','#6f97c4','#b0a05a','#9bb05a','#cf7f55','#69a3b0','#c0a36b','#a8779a','#7aa6a0','#caa05a','#8fa36a'];
  const PAD={l:48,r:14,t:12,b:22};
  function setup(cv){const r=window.devicePixelRatio||1;const w=cv.clientWidth||cv.width,h=cv.clientHeight||cv.height;cv.width=w*r;cv.height=h*r;const c=cv.getContext('2d');if(c)c.setTransform(r,0,0,r,0,0);if(c)c.clearRect(0,0,w,h);return {c,w,h};}
  function px(i,n,w){return PAD.l+(w-PAD.l-PAD.r)*(i/(n-1));}
  function py(v,mx,mn,h){mn=mn||0;return PAD.t+(h-PAD.t-PAD.b)*(1-(v-mn)/(mx-mn));}
  function yaxis(c,w,h,mx,mn,ticks,fmt,xl){mn=mn||0;c.strokeStyle=THEME.grid;c.fillStyle=THEME.dim;c.font='10px "IBM Plex Mono",monospace';c.lineWidth=1;ticks.forEach(t=>{const y=py(t,mx,mn,h);c.globalAlpha=.45;c.beginPath();c.moveTo(PAD.l,y);c.lineTo(w-PAD.r,y);c.stroke();c.globalAlpha=1;c.textAlign='right';c.fillText(fmt(t),PAD.l-6,y+3);});c.textAlign='left';c.fillText(xl||'',PAD.l,h-6);c.textAlign='right';c.fillText('30y',w-PAD.r,h-6);}
  function lineOn(c,d,mx,mn,w,h,col,wd,dash){c.strokeStyle=col;c.lineWidth=wd||1.5;c.setLineDash(dash||[]);c.beginPath();d.forEach((v,i)=>{const X=px(i,d.length,w),Y=py(v,mx,mn,h);i?c.lineTo(X,Y):c.moveTo(X,Y);});c.stroke();c.setLineDash([]);}
  function href(c,v,mx,mn,w,h,col,lab){const Y=py(v,mx,mn,h);c.strokeStyle=col;c.globalAlpha=.7;c.setLineDash([4,3]);c.lineWidth=1;c.beginPath();c.moveTo(PAD.l,Y);c.lineTo(w-PAD.r,Y);c.stroke();c.setLineDash([]);c.globalAlpha=1;c.fillStyle=col;c.font='9px "IBM Plex Mono",monospace';c.textAlign='left';c.fillText(lab,PAD.l+3,Y-3);}

  function drawPanels(els, series, ghostData){
    const th=TH();
    // P1 coordination
    let o=setup(els.coord); if(o.c){ yaxis(o.c,o.w,o.h,1,0,[0,.25,.5,.75,1],t=>t,'coordination');
      href(o.c,.10,1,0,o.w,o.h,THEME.trap,'0.10 floor'); href(o.c,.20,1,0,o.w,o.h,THEME.gate,'0.20 gate'); href(o.c,.50,1,0,o.w,o.h,THEME.teal,'0.50 coupling');
      if(series) lineOn(o.c,series.coord,1,0,o.w,o.h,THEME.line,2); }
    // P2 outcome + ghosts
    o=setup(els.outcome); if(o.c){ const _dm=series?Math.max.apply(null,series.income)*1.15:6000; const mx=Math.max(6000, Math.ceil(_dm/1000)*1000); const _st=mx<=8000?2000:mx<=16000?3000:5000; const _tk=[]; for(let _t=0;_t<=mx+1;_t+=_st)_tk.push(_t);
      yaxis(o.c,o.w,o.h,mx,0,_tk,t=>t/1000+'k','outcome ₹/mo');
      href(o.c,th.GROWTH,mx,0,o.w,o.h,THEME.growth,'GROWTH'); href(o.c,th.TRAP,mx,0,o.w,o.h,THEME.trap,'TRAP');
      if(ghostData&&ghostData.lines){ ghostData.lines.forEach(g=>{ o.c.globalAlpha=.55; lineOn(o.c,g.income,mx,0,o.w,o.h,THEME.trap,1,[3,3]); o.c.globalAlpha=1; });
        // label the lowest ghost
        if(ghostData.lines.length){ o.c.fillStyle=THEME.trap; o.c.font='9px "IBM Plex Mono",monospace'; o.c.textAlign='left'; o.c.fillText('dashed = core policy pulled', PAD.l+3, o.h-PAD.b-3); } }
      if(series){ lineOn(o.c,series.income,mx,0,o.w,o.h,THEME.line,2);
        if(series.esc!=null){const X=px(series.esc,360,o.w);o.c.strokeStyle=THEME.growth;o.c.setLineDash([2,2]);o.c.beginPath();o.c.moveTo(X,PAD.t);o.c.lineTo(X,o.h-PAD.b);o.c.stroke();o.c.setLineDash([]);o.c.fillStyle=THEME.growth;o.c.font='9px "IBM Plex Mono"';o.c.textAlign='center';o.c.fillText('escape '+ym(series.esc),X,PAD.t+9);} } }
    // P3 burden
    o=setup(els.burden); if(o.c){ yaxis(o.c,o.w,o.h,12,0,[0,3,6,9,12],t=>t,'effective instruments');
      if(series){ lineOn(o.c,series.eff,12,0,o.w,o.h,THEME.brass,1.8); lineOn(o.c,series.friction.map(f=>f/0.12*12),12,0,o.w,o.h,THEME.amber,1.4,[5,3]); }
      o.c.fillStyle=THEME.brass;o.c.font='9px "IBM Plex Mono"';o.c.textAlign='right';o.c.fillText('— instruments   ⋯ friction (0–0.12)',o.w-PAD.r,o.h-PAD.b-4); }
    // P4 applied effect (stacked)
    o=setup(els.effect); if(o.c){ let smax=0; if(series&&series.keys.length){for(let m=0;m<360;m++){let s=0;series.keys.forEach(k=>s+=series.pe[k][m]);if(s>smax)smax=s;}} smax=Math.max(smax,.5);
      yaxis(o.c,o.w,o.h,smax,0,[0,smax/2,smax].map(v=>+v.toFixed(2)),t=>t.toFixed(2),'applied effect Σ|e|×cov×coord-mult');
      if(series&&series.keys.length){const base=new Array(360).fill(0);
        series.keys.forEach((k,ki)=>{o.c.fillStyle=PAL[ki%PAL.length];o.c.globalAlpha=.78;o.c.beginPath();
          for(let m=0;m<360;m++){const X=px(m,360,o.w),Y=py(base[m]+series.pe[k][m],smax,0,o.h);m?o.c.lineTo(X,Y):o.c.moveTo(X,Y);}
          for(let m=359;m>=0;m--){const X=px(m,360,o.w),Y=py(base[m],smax,0,o.h);o.c.lineTo(X,Y);}o.c.closePath();o.c.fill();o.c.globalAlpha=1;
          for(let m=0;m<360;m++)base[m]+=series.pe[k][m];}); } }
    // effect legend
    if(els.legend){ els.legend.innerHTML=''; if(series&&series.keys.length){ series.keys.forEach((k,ki)=>{const sp=document.createElement('span');sp.className='pe-lg';sp.innerHTML='<i style="background:'+PAL[ki%PAL.length]+'"></i>'+k;els.legend.appendChild(sp);}); } }
  }

  return {
    analysis:{ runSeries, escapeStats, leaveOneOut, backbone, ghosts, escapeStatsAsync, leaveOneOutAsync, backboneAsync, clearEscCache, currentCase, guarded, save, restore, activate, cascadeInfo, tensionNotes },
    fmt:{ ym, rupee }, PAL:PAL, drawPanels:drawPanels, setTheme:setTheme,
    mount:null  // assigned by policy_explorer_ui.js (in-app) — kept separate so this file is DOM-free to load
  };
})();
if (typeof module!=='undefined' && module.exports) module.exports = PolicyExplorer;
