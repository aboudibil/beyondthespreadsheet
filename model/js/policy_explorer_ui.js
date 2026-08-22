/* CPAF v6 — Policy Interaction Analysis: mountable UI
   Builds the four-section bench (reliability / backbone / leave-one-out / panels) and drives the engine.
   mount(root, opts):
     opts.mode      'embedded' (reads host selection, no rail) | 'standalone' (own policy rail + presets)
     opts.dark      true -> dark editorial theme; default light (matches the app)
     opts.getCase   () => caseId         (default: current Simulation case)
     opts.getSelection () => [ids]       (embedded mode: the host's user-selected policies)
*/
(function(){
  if(typeof PolicyExplorer==='undefined') return;
  const A=PolicyExplorer.analysis, F=PolicyExplorer.fmt;

  const GROUPS=[
    ['Structural', ['SFURTI','ODOP','NHDP','CLUSTER_DEV','TIES']],
    ['Market / access', ['GI_REGISTRATION','MARKETING_SUPPORT','ECOMMERCE','MAI','PMEGP','HUNAR_HAAT']],
    ['Welfare / capability', ['PM_VISHWAKARMA','USTTAD','NAI_ROSHNI','GURU_SHISHYA','AMBEDKAR_HASTSHILP','HERITAGE_AWARDS']]
  ];
  const ALL=[].concat.apply([],GROUPS.map(g=>g[1]));
  const PRESETS={ integrated:['SFURTI','ODOP','NHDP','GI_REGISTRATION','ECOMMERCE'], lean:['SFURTI','ODOP','GI_REGISTRATION'], all:ALL, clear:[] };

  const CSS=`
  .pe-root{--pe-bg:#ffffff;--pe-panel:#f8fafc;--pe-line:#e2e8f0;--pe-ink:#1e293b;--pe-dim:#64748b;--pe-accent:#1e40af;--pe-brass:#b45309;--pe-load:#b91c1c;--pe-red:#64748b;--pe-ok:#15803d;
    font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--pe-ink);background:var(--pe-bg);border:1px solid var(--pe-line);border-radius:12px;padding:16px 18px}
  .pe-root.pe-dark{--pe-bg:#16130d;--pe-panel:#1d1810;--pe-line:#3a3326;--pe-ink:#ece4d2;--pe-dim:#a99e86;--pe-accent:#e0b86a;--pe-brass:#c79a52;--pe-load:#e0584a;--pe-red:#a99e86;--pe-ok:#7fa45f;font-family:"Spectral",Georgia,serif}
  .pe-h{font-size:18px;font-weight:700;margin:0 0 2px}
  .pe-sub{font-size:13px;color:var(--pe-dim);margin:0 0 14px}
  .pe-layout{display:grid;grid-template-columns:auto 1fr;gap:18px}
  .pe-layout.norail{grid-template-columns:1fr}
  .pe-rail{width:230px;background:var(--pe-panel);border:1px solid var(--pe-line);border-radius:9px;padding:12px}
  .pe-presets{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
  .pe-presets button,.pe-btn{font:500 12px ui-monospace,"IBM Plex Mono",monospace;background:transparent;color:var(--pe-ink);border:1px solid var(--pe-line);border-radius:6px;padding:6px 11px;cursor:pointer}
  .pe-presets button:hover,.pe-btn:hover{border-color:var(--pe-accent);color:var(--pe-accent)}
  .pe-btn.primary{background:var(--pe-accent);color:var(--pe-bg);border-color:var(--pe-accent);font-weight:600}
  .pe-grp{margin-bottom:10px}
  .pe-grp-h{font:600 10px ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--pe-dim);border-bottom:1px solid var(--pe-line);padding-bottom:3px;margin-bottom:4px}
  .pe-pol{display:flex;align-items:center;gap:7px;padding:2px;font:12px ui-monospace,monospace;cursor:pointer}
  .pe-pol input{cursor:pointer}
  .pe-selbar{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:14px;font-size:13px;color:var(--pe-dim)}
  .pe-selbar b{color:var(--pe-ink)}
  .pe-cards{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:8px}
  .pe-card{background:var(--pe-panel);border:1px solid var(--pe-line);border-radius:8px;padding:9px 14px;min-width:120px}
  .pe-card .l{font:600 9.5px ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--pe-dim)}
  .pe-card .v{font:600 19px ui-monospace,monospace;color:var(--pe-accent);margin-top:2px}
  .pe-card .v.small{font-size:14px}
  .pe-note{font-size:12px;color:var(--pe-dim);font-style:italic;margin:4px 0 16px;line-height:1.5}
  .pe-sec{margin:16px 0}
  .pe-sec h4{font-size:14px;margin:0 0 7px;display:flex;align-items:center;gap:8px}
  .pe-sec h4 .tag{font:600 9px ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--pe-dim);border:1px solid var(--pe-line);border-radius:4px;padding:1px 6px}
  .pe-chip{display:inline-block;font:600 12px ui-monospace,monospace;border-radius:5px;padding:3px 9px;margin:3px 4px 0 0}
  .pe-chip.hard{background:color-mix(in srgb,var(--pe-load) 16%,transparent);color:var(--pe-load);border:1px solid var(--pe-load)}
  .pe-chip.soft{background:color-mix(in srgb,var(--pe-brass) 14%,transparent);color:var(--pe-brass);border:1px solid var(--pe-brass)}
  .pe-chip.shed{background:transparent;color:var(--pe-dim);border:1px dashed var(--pe-line)}
  .pe-loo-row{display:grid;grid-template-columns:160px 1fr 60px 96px;align-items:center;gap:8px;margin:3px 0;font:12px ui-monospace,monospace}
  .pe-bar{background:var(--pe-line);border-radius:3px;height:13px;overflow:hidden}
  .pe-bar i{display:block;height:100%}
  .pe-bar i.load{background:var(--pe-load)}.pe-bar i.redundant{background:var(--pe-red)}.pe-bar i.counter{background:var(--pe-ok)}
  .pe-tag2{font:9.5px ui-monospace,monospace;text-transform:uppercase}
  .pe-tag2.load{color:var(--pe-load)}.pe-tag2.redundant{color:var(--pe-dim)}.pe-tag2.counter{color:var(--pe-ok)}
  .pe-autonote{background:color-mix(in srgb,var(--pe-brass) 10%,transparent);border:1px solid var(--pe-brass);border-radius:7px;padding:9px 12px;font-size:12.5px;color:var(--pe-ink);margin:8px 0}
  .pe-panels{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:760px){.pe-panels{grid-template-columns:1fr}.pe-layout{grid-template-columns:1fr}}
  .pe-pan{background:var(--pe-panel);border:1px solid var(--pe-line);border-radius:8px;padding:9px 10px}
  .pe-pan h5{margin:0 0 1px;font-size:13px}
  .pe-pan .cap{font-size:11px;color:var(--pe-dim);margin:0 0 4px}
  .pe-pan canvas{width:100%;height:138px;display:block}
  .pe-legend{display:flex;flex-wrap:wrap;gap:4px 11px;margin-top:6px}
  .pe-lg{font:10px ui-monospace,monospace;color:var(--pe-dim);display:flex;align-items:center;gap:4px}
  .pe-lg i{width:9px;height:9px;border-radius:2px;display:inline-block}
  .pe-foot{font-size:11px;color:var(--pe-dim);line-height:1.55;margin-top:14px;border-top:1px solid var(--pe-line);padding-top:9px}
  .pe-busy{color:var(--pe-dim);font-style:italic;font-size:13px;padding:10px 0}
  .pe-mech{display:flex;flex-wrap:wrap;align-items:stretch;gap:6px;margin:2px 0 14px}
  .pe-mech-step{flex:1 1 0;min-width:120px;background:var(--pe-panel);border:1px solid var(--pe-line);border-radius:8px;padding:9px 11px}
  .pe-mech-step .t{font:600 13px ui-monospace,"IBM Plex Mono",monospace;color:var(--pe-ink)}
  .pe-mech-step .c{font-size:11px;color:var(--pe-dim);margin-top:3px;line-height:1.35}
  .pe-mech-arr{align-self:center;color:var(--pe-accent);font-size:16px;font-weight:700}
  .pe-tensions{display:flex;flex-direction:column;gap:7px}
  .pe-tension{background:var(--pe-panel);border:1px solid var(--pe-line);border-left:3px solid var(--pe-accent);border-radius:6px;padding:8px 12px;font-size:12.5px;line-height:1.5}
  @media(max-width:760px){.pe-mech-arr{display:none}.pe-mech-step{flex:1 1 100%}}
  `;

  function el(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}

  function mount(root, opts){
    opts=opts||{};
    const mode=opts.mode||'standalone';
    const dark=!!opts.dark;
    if(!document.getElementById('pe-css')){const st=el('style');st.id='pe-css';st.textContent=CSS;document.head.appendChild(st);}
    PolicyExplorer.setTheme(dark
      ? { grid:'#3a3326',dim:'#a99e86',line:'#e0b86a',trap:'#cf7f55',growth:'#7fa45f',gate:'#d8923f',teal:'#5fa3a0',amber:'#d8923f',brass:'#c79a52' }
      : { grid:'#e2e8f0',dim:'#64748b',line:'#1e40af',trap:'#b91c1c',growth:'#15803d',gate:'#b45309',teal:'#0891b2',amber:'#b45309',brass:'#b45309' });

    root.className='pe-root'+(dark?' pe-dark':'');
    root.innerHTML='';
    root.appendChild(el('div','pe-h','Policy interaction analysis'));
    root.appendChild(el('div','pe-sub','Which instruments are the structural backbone for this case — and which are redundant. Headline figures are replicated across many runs; escape time is shown as a range, never a single number.'));

    const layout=el('div','pe-layout'+(mode==='embedded'?' norail':''));
    let selection = (mode==='embedded' && opts.getSelection) ? opts.getSelection().slice() : PRESETS.integrated.slice();

    // rail (standalone only)
    if(mode!=='embedded'){
      const rail=el('aside','pe-rail');
      const pre=el('div','pe-presets');
      [['Integrated','integrated'],['Lean core','lean'],['All 17','all'],['Clear','clear']].forEach(([lab,k])=>{
        const b=el('button',null,lab); b.onclick=()=>{selection=PRESETS[k].slice();syncRail();}; pre.appendChild(b);
      });
      rail.appendChild(pre);
      GROUPS.forEach(g=>{ const sec=el('div','pe-grp'); sec.appendChild(el('div','pe-grp-h',g[0]));
        g[1].forEach(id=>{ const p=Config.getPolicy(id); if(!p)return;
          const row=el('label','pe-pol'); const cb=el('input'); cb.type='checkbox'; cb.dataset.id=id; cb.checked=selection.indexOf(id)>=0;
          cb.onchange=()=>{ if(cb.checked){if(selection.indexOf(id)<0)selection.push(id);} else selection=selection.filter(x=>x!==id); };
          row.appendChild(cb); row.appendChild(el('span',null,id)); sec.appendChild(row); });
        rail.appendChild(sec); });
      function syncRail(){ rail.querySelectorAll('input').forEach(cb=>cb.checked=selection.indexOf(cb.dataset.id)>=0); }
      layout._sync=syncRail;
      layout.appendChild(rail);
    }

    const main=el('div','pe-main'); layout.appendChild(main); root.appendChild(layout);

    const selbar=el('div','pe-selbar'); main.appendChild(selbar);
    const out=el('div'); main.appendChild(out);
    root.appendChild(el('div','pe-foot','Honesty notes — escape reliability (probability) is the headline; escape time is a median with a range because any single run varies a year or two. The structural backbone is found by shedding the most-redundant instrument repeatedly until escape would break, not by a one-at-a-time test on the full portfolio (which hides the backbone). “Hard-essential” means removing it collapses escape; “soft-essential” means escape drops but survives. Necessity is relative to the rest of the set, and findings are specific to the case shown. The model carries ±2%/month noise.'));

    function caseId(){ return opts.getCase?opts.getCase():A.currentCase(); }
    function refreshSelbar(){
      if(mode==='embedded' && opts.getSelection) selection=opts.getSelection().slice();
      selbar.innerHTML='';
      selbar.appendChild(el('span',null,'Case: <b>'+caseId()+'</b>'));
      selbar.appendChild(el('span',null,'<b>'+selection.length+'</b> instruments selected'));
      const btn=el('button','pe-btn primary', root._peRunning ? 'Analysing\u2026' : 'Analyse policy interactions'); btn.onclick=run;
      if(root._peRunning){ btn.disabled=true; btn.style.opacity='0.6'; btn.style.cursor='progress'; }
      selbar.appendChild(btn);
      const hint=el('span',null,'Runs ~150 replicated simulations to get stable reliability — allow a few seconds; the button shows \u201cAnalysing\u2026\u201d while it works.'); hint.style.cssText='font-size:11px;color:var(--pe-dim);display:block;margin-top:5px;flex-basis:100%'; selbar.appendChild(hint);
      // stale-notice: analysis on screen no longer matches the current selection
      const sig=selection.slice().sort().join('|');
      const oldNote=out.querySelector('#pe-stale-note'); if(oldNote) oldNote.remove();
      if(root._peLastSig!=null && root._peLastSig!==sig && out.querySelector('.pe-cards') && !root._peRunning){
        const n=document.createElement('div'); n.id='pe-stale-note';
        n.style.cssText='margin:0 0 10px;padding:8px 12px;border:1px solid var(--pe-gate);border-left:4px solid var(--pe-gate);border-radius:6px;font-size:12.5px;color:var(--pe-ink);background:var(--pe-panel)';
        n.innerHTML='\u26a0 The policy selection has changed since this analysis \u2014 the results below describe the previous selection. Press <b>Analyse policy interactions</b> to update.';
        out.insertBefore(n, out.firstChild);
      }
    }
    root._peReset=function(){ root._peLastSig=null; refreshSelbar(); out.innerHTML='<div class="pe-busy">Pick one or more policies above to analyse how they interact \u2014 which form the structural backbone, how coordination holds up as the portfolio grows, and whether the case escapes the trap.</div>'; };
    refreshSelbar();

    function run(){
      if(mode==='embedded' && opts.getSelection) selection=opts.getSelection().slice();
      if(selection.length<1){ out.innerHTML='<div class="pe-busy">Pick one or more policies above to analyse how they interact \u2014 which form the structural backbone, how coordination holds up as the portfolio grows, and whether the case escapes the trap.</div>'; return; }
      if(root._peRunning){ const note=root.querySelector('.pe-busy'); if(note) note.innerHTML += ' <b>(already running \u2014 one moment)</b>'; return; }
      root._peRunning = true;
      const btn = root.querySelector('.pe-btn.primary');
      if(btn){ btn.textContent = 'Analysing\u2026'; btn.disabled = true; btn.style.opacity = '0.6'; btn.style.cursor = 'progress'; }
      const ids=selection.slice(), cid=caseId();
      let done=0;
      const tickRun=()=>{ done++; if(done%6===0){ const el=out.querySelector('#pe-run-count'); if(el) el.textContent=done; } };
      const prog = label => { out.innerHTML='<div class="pe-busy">Analysing\u2026 <b><span id="pe-run-count">'+done+'</span> simulations run</b> \u2014 '+label+'<br><span style="opacity:.75">The page stays live; your run is protected and restored around every simulation.</span></div>'; };
      try { out.scrollIntoView({ behavior:'smooth', block:'nearest' }); } catch(e){}
      const pre={};
      if(A.clearEscCache) A.clearEscCache(true);   // memoize within this analysis run
      let resumeAfter=false;
      if(opts.isSimRunning && opts.pauseSim && opts.isSimRunning()){ try{ opts.pauseSim(); resumeAfter=true; }catch(e){} }
      (async ()=>{
        try {
          prog('escape reliability'+(resumeAfter?' \u2014 simulation paused during analysis; it resumes automatically':''));
          pre.stats = await A.escapeStatsAsync(ids, cid, 24, tickRun);
          prog('structural backbone \u2014 the longest step; selections with many redundant policies take longer');
          pre.bb = await A.backboneAsync(ids, cid, 12, 90, tickRun);
          prog('leave-one-out');
          pre.loo = await A.leaveOneOutAsync(ids, cid, 12, tickRun);
          prog('trajectories');
          A.guarded(()=>{ pre.rep=A.runSeries(ids,4242,cid); pre.gh=A.ghosts(pre.bb.core.map(c=>c.id),ids,cid,4242); });
          A.guarded(()=>renderAll(out, ids, cid, dark, pre));
          root._peLastSig=ids.slice().sort().join('|');
        } catch(e){
          out.innerHTML='<div class="pe-busy">Could not complete the analysis: '+((e&&e.message)?e.message:e)+'. Try again, or reduce the number of selected policies.</div>';
          console.error('PE analysis failed:', e);
        } finally {
          root._peRunning = false;
          const b2 = root.querySelector('.pe-btn.primary');
          if(b2){ b2.textContent = 'Analyse policy interactions'; b2.disabled = false; b2.style.opacity=''; b2.style.cursor=''; }
          if(A.clearEscCache) A.clearEscCache(false);
          if(resumeAfter && opts.resumeSim){ try{ opts.resumeSim(); }catch(e){} }
        }
      })();
    }
    // expose so host can trigger
    root._peRun=run; root._peRefresh=refreshSelbar;
    return { run, refresh:refreshSelbar };
  }

  function renderAll(out, ids, cid, dark, pre){
    const N=24;
    const stats=(pre&&pre.stats)||A.escapeStats(ids,cid,N);
    const bb=(pre&&pre.bb)||A.backbone(ids,cid,12,90);
    const loo=(pre&&pre.loo)||A.leaveOneOut(ids,cid,12);
    const rep=(pre&&pre.rep)||A.runSeries(ids,4242,cid);
    const core=bb.core.map(c=>c.id);
    const gh=(pre&&pre.gh)||A.ghosts(core,ids,cid,4242);

    out.innerHTML='';
    // (a) reliability
    const cards=document.createElement('div'); cards.className='pe-cards';
    function card(l,v,small){const c=document.createElement('div');c.className='pe-card';c.innerHTML='<div class="l">'+l+'</div><div class="v'+(small?' small':'')+'">'+v+'</div>';return c;}
    cards.appendChild(card('Escape reliability', stats.prob+'%'));
    cards.appendChild(card('Escape time (median)', F.ym(stats.median), true));
    cards.appendChild(card('Time range', (stats.min?F.ym(stats.min)+'–'+F.ym(stats.max):'—'), true));
    cards.appendChild(card('Final income (median)', F.rupee(stats.medianFinal!=null?stats.medianFinal:rep.income[359]), true));
    cards.appendChild(card('Instruments', rep.keys.length, true));
    out.appendChild(secWrap('a','Reliability',cards,'Reliability is the share of runs that escape. Escape time and its range are taken over the runs that escaped; final income is the median across all runs. A single run varies — reliability and the range are the stable facts.'));

    // zero-escape guard: when escape is too rare to decompose, don't imply structure that isn't there
    const LOWREL=10;
    const noEscape = stats.prob < LOWREL;
    if(noEscape){
      const msg=document.createElement('div'); msg.className='pe-autonote';
      msg.innerHTML = stats.prob===0
        ? 'This selection does not escape the trap in any run, so there is no escape structure to decompose. Try adding a structural policy (SFURTI, ODOP, or GI registration) \u2014 the backbone that drives escape \u2014 or, secondarily, a market-access one (ECOMMERCE, MAI).'
        : 'This selection escapes in only <b>'+stats.prob+'%</b> of runs \u2014 too rarely to read a reliable backbone or leave-one-out. The reliability, mechanism, and tensions below still apply.';
      out.appendChild(secWrap('b','No escape structure to decompose',msg,'The backbone and leave-one-out need a reliable escape; the mechanism panels and tensions below apply regardless.'));
      const _gp = id => (typeof Config!=='undefined' && Config.getPolicy && Config.getPolicy(id) && Config.getPolicy(id).name) ? Config.getPolicy(id).name : id;
      const selBox=document.createElement('div'); selBox.style.cssText='margin:2px 0 4px';
      selBox.innerHTML='<div style="font-size:12px;color:var(--pe-dim);margin-bottom:6px">Policies in this selection ('+ids.length+'):</div>'+ids.map(id=>'<span class="pe-chip soft" style="margin:0 6px 6px 0;display:inline-block">'+_gp(id)+'</span>').join('');
      out.appendChild(secWrap('b2','Selected policies',selBox,'What you funded \u2014 shown even though this mix does not escape.'));
    }

    if(!noEscape){
    // umbrella transparency — name the cascade children so "selected" vs "effective" is clear
    const casc=A.cascadeInfo(ids);
    if(casc.length){ const box=document.createElement('div');
      box.style.cssText='background:var(--pe-panel);border:1px solid var(--pe-line);border-radius:8px;padding:9px 12px;font-size:12.5px;margin:2px 0 14px';
      box.innerHTML='<b>'+ids.length+'</b> instruments selected → <b>'+rep.keys.length+'</b> effective. '+
        casc.map(c=>'<b>'+c.umbrella+'</b> is an umbrella that also activates: '+c.children.join(', ')).join(' · ');
      out.appendChild(box);
    }

    // (b) backbone
    const bbBox=document.createElement('div');
    bb.core.forEach(c=>{ const ch=document.createElement('span'); ch.className='pe-chip '+(c.tier==='hard'?'hard':'soft'); ch.textContent=c.id+(c.tier==='hard'?'  (pull → '+c.probWhenRemoved+'%)':'  (pull → '+c.probWhenRemoved+'%)'); bbBox.appendChild(ch); });
    if(bb.shed.length){ const lab=document.createElement('div'); lab.style.cssText='margin-top:9px;font-size:12px;color:var(--pe-dim)'; lab.textContent='Removable, in shed order (no escape cost): '; bbBox.appendChild(lab);
      bb.shed.forEach(s=>{const ch=document.createElement('span');ch.className='pe-chip shed';ch.textContent=s.id;bbBox.appendChild(ch);}); }
    let bbNote='Hard-essential (red) = removing it collapses escape — the true backbone. Soft-essential (amber) = escape drops but survives.';
    if(bb.highlyRedundant) bbNote+=' This portfolio is highly redundant, so the minimal set is not unique — other small sets also work; this is one of them.';
    out.appendChild(secWrap('b','Structural backbone — smallest set that still escapes',bbBox,bbNote));

    // (c) leave-one-out
    const looBox=document.createElement('div');
    if(loo.allRedundant){ const n=document.createElement('div'); n.className='pe-autonote'; n.innerHTML='With this whole portfolio active, removing any <b>single</b> instrument still escapes — nothing reads as individually essential. That doesn’t mean nothing matters; it means the portfolio is redundant. The backbone above shows what’s actually load-bearing.'; looBox.appendChild(n); }
    const base=document.createElement('div'); base.style.cssText='font-size:12px;color:var(--pe-dim);margin:4px 0 6px'; base.innerHTML='Baseline (this selection): <b style="color:var(--pe-ink)">'+loo.base+'%</b> · bars = change in escape reliability if that one instrument is removed'; looBox.appendChild(base);
    loo.rows.forEach(r=>{ const row=document.createElement('div'); row.className='pe-loo-row';
      const mag=Math.min(100,Math.abs(r.dProb)); const sign=r.dProb>0?'+':'';
      row.innerHTML='<span>'+r.id+'</span><span class="pe-bar"><i class="'+r.cls+'" style="width:'+mag+'%"></i></span><span style="color:var(--pe-'+(r.cls==='load'?'load':r.cls==='counter'?'ok':'dim')+')">'+sign+r.dProb+'pp</span><span class="pe-tag2 '+r.cls+'">'+(r.cls==='load'?'load-bearing':r.cls==='counter'?'counterproductive':'redundant')+'</span>';
      looBox.appendChild(row); });
    out.appendChild(secWrap('c','Leave-one-out — relative to this selection',looBox,'Read alongside the backbone: a policy can be redundant here yet essential in a leaner set.'));
    } // backbone + leave-one-out shown only when escape is reliable enough to decompose

    // (d) panels
    const panels=document.createElement('div'); panels.className='pe-panels';
    function pan(title,cap,id){const d=document.createElement('div');d.className='pe-pan';d.innerHTML='<h5>'+title+'</h5><div class="cap">'+cap+'</div><canvas id="'+id+'"></canvas>'+(id==='pe-cv-effect'?'<div class="pe-legend" id="pe-eff-legend"></div>':'');panels.appendChild(d);return d;}
    // live values (shared with the mechanism strip below) so each caption describes THIS selection
    const eff=rep.keys.length;
    const coordStart=rep.coord[0];
    const coordFinal=rep.coord[rep.coord.length-1];
    const coordFloor=Math.min.apply(null,rep.coord);
    const coordRose=coordFinal > coordStart + 0.02;
    const coordFell=coordFinal < coordStart - 0.02;
    const hcEff=Math.min.apply(null,rep.coordEffect);
    const cut=Math.max(0,Math.round((1-hcEff)*100));
    const maxFric=(rep.friction&&rep.friction.length)?Math.max.apply(null,rep.friction):0;
    const hasFriction=maxFric>=0.05 && eff>2;   // friction must be MATERIAL (\u2248 4+ policies), not merely present — at 2-3 policies the collapse is trap-decay, not crowding
    const escaped=stats.median!=null;
    pan('Coordination', coordRose ? ('builds from '+coordStart.toFixed(2)+' to '+coordFinal.toFixed(2)+' as the co-op forms') : coordFell ? (hasFriction ? ('weakens from '+coordStart.toFixed(2)+' to '+coordFinal.toFixed(2)+' as policies stack') : ('falls from '+coordStart.toFixed(2)+' to '+coordFinal.toFixed(2)+' by trap-decay \u2014 crowding is minor at '+eff+' polic'+(eff===1?'y':'ies'))) : ('holds around '+coordFinal.toFixed(2)+' \u2014 steady across the run'),'pe-cv-coord');
    pan('Outcome (with backbone pulled)', escaped ? 'solid = your package reaching growth; each dashed line removes one core policy and income drops back' : 'solid = your package \u2014 it stays in the trap; there is no escape here to pull apart','pe-cv-outcome');
    pan('Coordination burden', hasFriction ? ('administrative load \u2014 '+eff+' policies plus the friction between them, not money') : ('administrative load \u2014 '+eff+' polic'+(eff===1?'y':'ies')+', with little inter-agency friction at this size'),'pe-cv-burden');
    pan('Applied policy effect', cut>5 ? ('how hard each policy pushes \u2014 weak coordination cuts about '+cut+'% before it reaches artisans') : ('how hard each policy pushes \u2014 coordination lets most of it reach artisans here'),'pe-cv-effect');
    out.appendChild(secWrap('d','How it moves through time — one representative run',panels,'These four are a single representative run (one seed) to show the shape, so the escape marker here can differ from the median above; the headline numbers are the replicated facts.'));

    // ---- WHY THIS HAPPENS: mechanism strip + active tensions ----
    const why=document.createElement('div');
    // mechanism strip (coordination cascade) — reuses the live values computed for the captions above
    const strip=document.createElement('div'); strip.className='pe-mech';
    const steps=[['<b>'+eff+'</b> polic'+(eff===1?'y':'ies')+' active','what you funded']];
    if(coordRose){
      steps.push(['coordination \u2191 '+coordFinal.toFixed(2),'the co-op builds past critical mass (from '+coordStart.toFixed(2)+')']);
    } else if(coordFell){
      if(hasFriction) steps.push(['friction rises','grows faster than the number of policies']);
      steps.push(['coordination \u2193 '+coordFinal.toFixed(2), hasFriction ? ('from '+coordStart.toFixed(2)+' as policies crowd') : ('from '+coordStart.toFixed(2)+' \u2014 decay in the trap (failures outweigh successes); with only '+eff+' polic'+(eff===1?'y':'ies')+', crowding adds little')]);
      if(cut>0) steps.push(['~'+cut+'% of effort lost', hasFriction ? 'the policies pull against each other' : 'low coordination wastes the effort \u2014 not inter-policy friction']);
    } else {
      steps.push(['coordination holds '+coordFinal.toFixed(2),'steady across the run']);
    }
    if(!escaped) steps.push(['no escape in 30 years','this mix does not cross the threshold']);
    else if(coordFell&&cut>0) steps.push(['escape '+F.ym(stats.median),'held back by the coordination loss']);
    else if(coordRose) steps.push(['escape '+F.ym(stats.median),'the co-op powered the escape']);
    else steps.push(['escape '+F.ym(stats.median),'coordination was not the brake']);
    steps.forEach((s,i)=>{ const b=document.createElement('div'); b.className='pe-mech-step'; b.innerHTML='<div class="t">'+s[0]+'</div><div class="c">'+s[1]+'</div>'; strip.appendChild(b);
      if(i<steps.length-1){ const a=document.createElement('div'); a.className='pe-mech-arr'; a.textContent='→'; strip.appendChild(a); } });
    why.appendChild(strip);
    // active tensions in plain words
    const tens=A.tensionNotes(ids,cid,rep);
    if(tens.length){ const tl=document.createElement('div'); tl.className='pe-tensions';
      tens.forEach(t=>{ const r=document.createElement('div'); r.className='pe-tension'; r.innerHTML='<b>'+t.title+'</b> — '+t.text; tl.appendChild(r); });
      why.appendChild(tl); }
    out.appendChild(secWrap('e','Why this happens',why,'The strip reads left to right as cause and effect, using this run\u2019s numbers. The notes name only the forces actually active in this scenario.'));

    PolicyExplorer.drawPanels({coord:document.getElementById('pe-cv-coord'),outcome:document.getElementById('pe-cv-outcome'),burden:document.getElementById('pe-cv-burden'),effect:document.getElementById('pe-cv-effect'),legend:document.getElementById('pe-eff-legend')}, rep, gh);
  }

  function secWrap(letter,title,bodyEl,note){
    const s=document.createElement('div'); s.className='pe-sec';
    const h=document.createElement('h4'); h.innerHTML='<span class="tag">'+letter+'</span>'+title; s.appendChild(h);
    s.appendChild(bodyEl);
    if(note){const n=document.createElement('div');n.className='pe-note';n.textContent=note;s.appendChild(n);}
    return s;
  }

  PolicyExplorer.mount=mount;
})();
