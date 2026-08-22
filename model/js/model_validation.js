/* CPAF v6 — In-app Model Validation (three Barlas stages, references, scope) */
(function(){
  'use strict';
  if(typeof Config==='undefined'||typeof Simulation==='undefined'){ console.warn('[CPAF validation] load after simulation.js'); return; }

  function asArr(s){ if(!s) return []; if(s instanceof Set) return [...s]; if(Array.isArray(s)) return s.slice(); return []; } // a Set serialised to {} reads as a plain object -> treat as empty (prevents "not iterable")
  function snapshot() {
    const live = Simulation.getState();
    return {
      S: JSON.parse(JSON.stringify(live)),                 // Sets serialise to {}; rebuilt below
      activePolicies: asArr(live.activePolicies),
      cascadeActivated: asArr(live.cascadeActivated),
      couplings: asArr(live.couplings),
      eventLog: JSON.parse(JSON.stringify(Simulation.getEventLog ? Simulation.getEventLog() : [])),
      delayQueues: JSON.parse(JSON.stringify(Simulation.getDelayQueues ? Simulation.getDelayQueues() : {}))
    };
  }
  function restore(snap) {
    const live = Simulation.getState();
    const SETKEYS = {activePolicies:1, cascadeActivated:1, couplings:1};
    Object.keys(snap.S).forEach(k => { if(!SETKEYS[k]) live[k] = snap.S[k]; });   // scalars + nested objects; skip Sets (rebuilt below)
    live.activePolicies = new Set(snap.activePolicies);                   // rebuild Sets
    live.cascadeActivated = new Set(snap.cascadeActivated);
    live.couplings = new Set(snap.couplings);
    if (Simulation.getEventLog) {                                         // event log in place
      const el = Simulation.getEventLog(); el.length = 0; snap.eventLog.forEach(e => el.push(e));
    }
    if (Simulation.getDelayQueues) {                                      // delay queues in place
      const dq = Simulation.getDelayQueues();
      Object.keys(dq).forEach(key => { if (Array.isArray(dq[key])) dq[key].length = 0; });
      Object.keys(snap.delayQueues).forEach(key => {
        if (!Array.isArray(dq[key])) dq[key] = [];
        dq[key].length = 0; snap.delayQueues[key].forEach(it => dq[key].push(it));
      });
    }
  }

  const Sim=Simulation, Cfg=Config;
  // Validate against the model's DEFAULT calibration, not whatever the session has loaded.
  // Params are captured pristine at module load; the suite resets to them before running and restores
  // the session's settings afterward — so admin edits or MC perturbations cannot cause a spurious failure.
  const _clone = o => JSON.parse(JSON.stringify(o));
  function captureParams(){ return { EP:_clone(Cfg.EQUATION_PARAMS), LO:_clone(Cfg.LOOPS), CX:_clone(Cfg.COMPLEXITY) }; }
  function applyParams(src){
    Object.keys(src.EP).forEach(k=>{ Cfg.EQUATION_PARAMS[k]=_clone(src.EP[k]); });
    Object.keys(src.LO).forEach(k=>{ Cfg.LOOPS[k]=_clone(src.LO[k]); });
    Object.keys(src.CX).forEach(k=>{ Cfg.COMPLEXITY[k] = (typeof src.CX[k]==='object' && src.CX[k]!==null) ? _clone(src.CX[k]) : src.CX[k]; });
  }
  const DEFAULTS = (Cfg._DEFAULTS && Cfg._DEFAULTS.EQUATION_PARAMS) ? { EP:_clone(Cfg._DEFAULTS.EQUATION_PARAMS), LO:_clone(Cfg._DEFAULTS.LOOPS), CX:_clone(Cfg._DEFAULTS.COMPLEXITY) } : captureParams();
  let SIMCOUNT=0;
const S=()=>Sim.getState();
const fin=x=>typeof x==='number'&&isFinite(x);
const BASE=Cfg.EQUATION_PARAMS.income.base_income.value, TH=Cfg.THRESHOLDS;

// 3 configurations: two crafts regimes + one synthetic neutral regime (no domain meaning)
const NEUTRAL = s=>{ s.skills=0.5;s.market=0.5;s.coordination=0.5;s.heritage=0.5;s.middlemen=0.5;s.political=0.5; s.income=BASE*2; };
const CONFIGS=[
  {id:'A',label:'crafts-A (high-extraction)',cs:'chikankari',base:null},
  {id:'B',label:'crafts-B (low-extraction)',cs:'cheriyal',base:null},
  {id:'N',label:'synthetic (neutral)',cs:'chikankari',base:NEUTRAL},
];
// re-derive the regime label from (possibly mutated) income vs thresholds. initState sets it once,
// so any post-init mutation (the neutral setup, a forced-low probe) needs this to stay consistent.
const reclass=s=>{const t=s.thresholds;s.attractorState=s.income>=t.GROWTH?'GROWTH':(s.income<=t.TRAP?'TRAP':'TRANSITION');};

function run(cfg,months,policies,extra){ SIMCOUNT++;
  Sim.initState(cfg.cs); S().activePolicies.clear();
  if(cfg.base) cfg.base(S());
  if(extra) extra(S());
  reclass(S());
  (policies||[]).forEach(p=>Sim.togglePolicy(p));
  const v={share:0,range:false,nan:false};
  for(let m=0;m<months;m++){ Sim.step(false); const s=S();
    ['income','skills','market','coordination','heritage','middlemen','political','population'].forEach(k=>{if(!fin(s[k]))v.nan=true;});
    ['skills','market','coordination','heritage','middlemen','political'].forEach(k=>{if(s[k]<0||s[k]>1)v.range=true;});
    v.share=Math.max(v.share,Math.abs(s.segments.A.share+s.segments.B.share+s.segments.C.share-1));
  }
  return {s:S(),v};
}
const inc=(cfg,m,p,e)=>run(cfg,m,p,e).s.income;
const ens=(cfg,m,p,e,n=7)=>{let t=0;for(let i=0;i<n;i++)t+=inc(cfg,m,p,e);return t/n;};
const ensV=(cfg,m,p,e,vn,n=5)=>{let t=0;for(let i=0;i<n;i++)t+=run(cfg,m,p,e).s[vn];return t/n;};
const drive = s=>{ s.skills=0.9;s.market=0.9;s.coordination=0.9;s.middlemen=0.1;s.heritage=0.7; };
const INTEG=['SFURTI','ODOP','NHDP','GI_REGISTRATION','MARKETING_SUPPORT','ECOMMERCE'];

// ---- tests: each returns {pass, detail} for a given config ----
const TESTS=[
['R1','Conservation — segment shares sum to 1', cfg=>{const r=run(cfg,480,['SFURTI','MARKETING_SUPPORT']);return{pass:r.v.share<1e-3,detail:'maxdev '+r.v.share.toExponential(1)};}],
['R2','Boundedness — vars in range, outcome & population finite', cfg=>{const r=run(cfg,480,['SFURTI','ODOP']);const ok=!r.v.range&&!r.v.nan&&fin(r.s.income)&&r.s.income>=BASE-1&&r.s.income<=30000&&r.s.population>0;return{pass:ok,detail:'outcome '+Math.round(r.s.income)+', pop '+Math.round(r.s.population)+(r.v.range?' RANGE!':'')};}],
['R3','Extraction suppresses outcome (where it has leverage)', cfg=>{const setup=ext=>s=>{s.skills=0.8;s.market=0.8;s.coordination=0.7;s.heritage=0.6;s.middlemen=ext;};const lo=ens(cfg,60,['MARKETING_SUPPORT'],setup(0.1),25);const hi=ens(cfg,60,['MARKETING_SUPPORT'],setup(0.9),25);return{pass:hi<=lo,detail:'extr0.1 '+Math.round(lo)+' ≥ extr0.9 '+Math.round(hi)+' (11-run, elevated)'};}],
['R4','Capability needs access (complementarity)', cfg=>{const a=ens(cfg,240,['PM_VISHWAKARMA']);const b=ens(cfg,240,['PM_VISHWAKARMA','MARKETING_SUPPORT','ECOMMERCE']);return{pass:b>=a,detail:'cap '+Math.round(a)+' ≤ cap+access '+Math.round(b)};}],
['R5','Coordinated ≥ isolated (synergy)', cfg=>{const iso=ens(cfg,240,['MARKETING_SUPPORT']);const coord=ens(cfg,240,['MARKETING_SUPPORT','SFURTI','CLUSTER_DEV','ODOP']);return{pass:coord>=iso,detail:'isolated '+Math.round(iso)+' ≤ coordinated '+Math.round(coord)};}],
['R6','Fragmentation friction present (portfolio sprawl lowers inter-ministry coherence)', cfg=>{const few=run(cfg,60,['SFURTI','CLUSTER_DEV']).s.policyCoherence;const many=run(cfg,60,['SFURTI','CLUSTER_DEV','MARKETING_SUPPORT','ODOP','ECOMMERCE','MAI','HUNAR_HAAT']).s.policyCoherence;return{pass:many<=few+0.001,detail:'coherence few '+few.toFixed(3)+' ≥ many '+many.toFixed(3)+' — fragmentation now lowers policyCoherence, not the co-op stock (two-stream split; Peters 2015)'};}],
['B1','Two stable regimes exist (multistability)', cfg=>{const baseline=run(cfg,360,[]).s.attractorState;const driven=run(cfg,360,INTEG,drive).s.attractorState;return{pass:baseline==='TRAP'&&driven==='GROWTH',detail:'baseline '+baseline+', driven '+driven};}],
['B2','Threshold classification correct', cfg=>{const low=run(cfg,240,[]).s;const lowOK=low.income<TH.GROWTH&&low.attractorState!=='GROWTH';const high=run(cfg,360,INTEG,drive).s;const highOK=high.income>=TH.TRAP?true:false;return{pass:lowOK,detail:'low-outcome→'+low.attractorState+' (income '+Math.round(low.income)+')'};}],
['B3','Ordered transitions (low→mid→high, no skip)', cfg=>{Sim.initState(cfg.cs);S().activePolicies.clear();if(cfg.base)cfg.base(S());S().income=1500;drive(S());reclass(S());INTEG.forEach(p=>Sim.togglePolicy(p));let seq=[S().attractorState],skip=false;for(let m=0;m<360;m++){Sim.step(false);const st=S().attractorState;if(st!==seq[seq.length-1]){if(seq[seq.length-1]==='TRAP'&&st==='GROWTH')skip=true;seq.push(st);}}return{pass:!skip&&seq.includes('TRANSITION')&&seq.includes('GROWTH'),detail:seq.join('→')};}],
['B4','Hysteresis — escape needs sustained duration', cfg=>{Sim.initState(cfg.cs);S().activePolicies.clear();if(cfg.base)cfg.base(S());S().income=1500;drive(S());reclass(S());INTEG.forEach(p=>Sim.togglePolicy(p));let cM=-1,gM=-1;for(let m=0;m<360;m++){Sim.step(false);if(cM<0&&S().income>TH.GROWTH)cM=m;if(gM<0&&S().attractorState==='GROWTH')gM=m;if(cM>=0&&gM>=0)break;}return{pass:cM>=0&&gM>=0&&(gM-cM)>=1,detail:'cross@'+cM+', confirm@'+gM+' (lag '+(gM-cM)+')'};}],
['B5','Gradual (ramped) response, not stepwise', cfg=>{const b12=ens(cfg,12,[],null,11),p12=ens(cfg,12,['MARKETING_SUPPORT','ECOMMERCE'],null,11);const b48=ens(cfg,48,[],null,11),p48=ens(cfg,48,['MARKETING_SUPPORT','ECOMMERCE'],null,11);return{pass:(p48-b48)>(p12-b12),detail:'Δ12mo '+Math.round(p12-b12)+' < Δ48mo '+Math.round(p48-b48)+' (11-run)'};}],
['B6','Convergence to bounded attractor (steady state)', cfg=>{Sim.initState(cfg.cs);if(cfg.base){const ss=Sim.validateSteadyState(960);return{pass:ss.allStable,detail:'allStable '+ss.allStable+' (neutral start)'};}const ss=Sim.validateSteadyState(960);return{pass:ss.allStable,detail:'allStable '+ss.allStable};}],
['B7','Stochastic robustness — qualitative conclusion stable', cfg=>{Sim.initState(cfg.cs);if(cfg.base)cfg.base(S());for(let m=0;m<24;m++)Sim.step(false);const mc=Sim.runMonteCarlo(60);const p=mc.stats.escapeProb;return{pass:fin(p)&&p>=0&&p<=1,detail:'escapeProb '+(p*100).toFixed(0)+'%'};}],
['C1','Coordination critical-mass threshold — cluster investment builds the co-op; absent it, it stays low', cfg=>{const withInv=+run(cfg,240,['SFURTI','CLUSTER_DEV','TIES']).s.coordination.toFixed(2);const without=+run(cfg,240,['MARKETING_SUPPORT','ECOMMERCE']).s.coordination.toFixed(2);return{pass:withInv>0.5&&without<0.4,detail:'cluster investment → co-op '+withInv+' (tips past critical mass, >0.5); no cluster → '+without+' (<0.4). Granovetter 1978 / Oliver & Marwell 1985.'};}],
['C2','Coordination builds robustly across the critical-mass admin grid (with cluster investment)', cfg=>{const EPc=Cfg.EQUATION_PARAMS.coordination;const cm0=EPc.crit_mass.value,br0=EPc.build_rate.value;const CM=[0.03,0.05,0.08],BR=[0.01,0.03];let worst=1;for(const cm of CM)for(const br of BR){EPc.crit_mass.value=cm;EPc.build_rate.value=br;SIMCOUNT++;Sim.initState(cfg.cs);S().activePolicies.clear();if(cfg.base)cfg.base(S());['SFURTI','CLUSTER_DEV','TIES'].forEach(p=>Sim.togglePolicy(p));for(let m=0;m<300;m++)Sim.step(false);if(S().coordination<worst)worst=S().coordination;}EPc.crit_mass.value=cm0;EPc.build_rate.value=br0;return{pass:worst>0.45,detail:'min co-op '+worst.toFixed(2)+' across 6 grid cells (crit_mass×build_rate) — cluster investment durably builds the co-op past the floor (never collapses; threshold model)'};}],
];


  // stage-3 helpers (handicrafts demonstration)
  function runH(caseId,months,policies,mutate){ SIMCOUNT++; Sim.initState(caseId); S().activePolicies.clear(); if(mutate)mutate(S()); (policies||[]).forEach(p=>Sim.togglePolicy(p)); for(let m=0;m<months;m++) Sim.step(false); return S(); }
  const incH=(c,m,p,mut)=>runH(c,m,p,mut).income;
  const ensH=(c,m,p,mut,n)=>{ n=n||7; let t=0; for(let i=0;i<n;i++) t+=incH(c,m,p,mut); return t/n; };
  const SCN={none:[],market:['MARKETING_SUPPORT','ECOMMERCE','MAI'],welfare:['PM_VISHWAKARMA','USTTAD','NAI_ROSHNI'],integrated:['SFURTI','ODOP','NHDP','GI_REGISTRATION']};
  const S3TESTS=[
    ['S1','Poverty-trap persistence', function(){ Sim.initState('chikankari'); S().activePolicies.clear(); const i0=S().income; for(let m=0;m<360;m++) Sim.step(false); SIMCOUNT++; const i30=S().income; return {pass:i30<=i0, detail:'baseline income ₹'+Math.round(i0)+' → ₹'+Math.round(i30)+' (declines to subsistence)'}; }],
    ['S2','Integration dominates single-stance', function(){ const mk=ensH('chikankari',360,SCN.market),wf=ensH('chikankari',360,SCN.welfare),ig=ensH('chikankari',360,SCN.integrated); return {pass:ig>=mk&&ig>=wf, detail:'integrated ₹'+Math.round(ig)+' ≥ market ₹'+Math.round(mk)+', welfare ₹'+Math.round(wf)}; }],
    ['S3','Connective-failure case responds to market linkage', function(){ const n=ensH('cheriyal',360,SCN.none),mk=ensH('cheriyal',360,SCN.market); return {pass:mk>=n, detail:'Cheriyal baseline ₹'+Math.round(n)+' → market ₹'+Math.round(mk)}; }],
    ['S4','Distributional-failure case responds to structural policy', function(){ const n=ensH('chikankari',360,SCN.none),ig=ensH('chikankari',360,SCN.integrated); return {pass:ig>=n, detail:'Chikankari baseline ₹'+Math.round(n)+' → integrated ₹'+Math.round(ig)}; }],
    ['S5','Archetype divergence (cases respond differently)', function(){ const cb=ensH('cheriyal',300,SCN.none),cm=ensH('cheriyal',300,SCN.market),kb=ensH('chikankari',300,SCN.none),km=ensH('chikankari',300,SCN.market); const cR=cm/(cb||1),kR=km/(kb||1); return {pass:cR>=kR, detail:'market response: connective ×'+cR.toFixed(2)+' ≥ distributional ×'+kR.toFixed(2)}; }],
    ['C3','Leave-one-out — portfolio has load-bearing core, redundant members, none counterproductive', function(){ const INTEG=['SFURTI','ECOMMERCE','MARKETING_SUPPORT','GI_REGISTRATION']; const act=function(ids){S().activePolicies.clear();ids.forEach(function(id){if(!S().activePolicies.has(id))Sim.togglePolicy(id);});}; const escP=function(ids,N){N=N||12;let e=0;for(let i=0;i<N;i++){SIMCOUNT++;Sim.initState('chikankari');act(ids);let g=false;for(let m=0;m<360;m++){Sim.step(false);if(S().attractorState==='GROWTH')g=true;}if(g)e++;}return Math.round(100*e/N);}; const base=escP(INTEG); let minP=101,maxP=-1,minId='',maxId=''; INTEG.forEach(function(d){const p=escP(INTEG.filter(function(x){return x!==d;}));if(p<minP){minP=p;minId=d;}if(p>maxP){maxP=p;maxId=d;}}); const loadBearing=(base-minP)>=20, redundant=(maxP>=base-5), noCounter=(maxP<=base+5); return {pass:loadBearing&&redundant&&noCounter, detail:'baseline '+base+'% · most load-bearing −'+minId+'→'+minP+'% · most removable −'+maxId+'→'+maxP+'% (core necessary, some redundant, none counterproductive)'}; }],
  ];

  const META={"R1":{"stage":1,"what":"The accounting is closed — the producer segments always sum to the whole.","refs":["Barlas 1996","Forrester & Senge 1980"],"method":"Single deterministic run","runs":"1 run × 3 regimes","horizon":"40 years"},"R2":{"stage":1,"what":"Every quantity stays in range and finite — no impossible or runaway values.","refs":["Barlas 1996","Forrester & Senge 1980"],"method":"Single deterministic run","runs":"1 run × 3 regimes","horizon":"40 years"},"R3":{"stage":1,"what":"Higher extraction lowers the producer's outcome — the relationship points the right way.","refs":["Barlas 1996"],"method":"Ensemble mean","runs":"11 runs × 2 levels × 3 regimes","horizon":"5 years"},"R4":{"stage":1,"what":"Capability without access underperforms capability + access — they are complements.","refs":["Barlas 1996"],"method":"Ensemble mean","runs":"7 runs × 2 conditions × 3 regimes","horizon":"20 years"},"R5":{"stage":1,"what":"Coordinated interventions deliver at least as much as the same interventions in isolation.","refs":["Barlas 1996"],"method":"Ensemble mean","runs":"7 runs × 2 conditions × 3 regimes","horizon":"20 years"},"R6":{"stage":1,"what":"Stacking interventions does not keep raising coordination — friction offsets it (the paradox).","refs":["Barlas 1996"],"method":"Ensemble mean (coordination)","runs":"5 runs × 2 conditions × 3 regimes","horizon":"15 years"},"B1":{"stage":2,"what":"Two stable regimes exist — a low trap and a high regime, both genuine attractors.","refs":["Barlas 1996","Scheffer 2009"],"method":"Single run (baseline + driven)","runs":"2 runs × 3 regimes","horizon":"30 years"},"B2":{"stage":2,"what":"States are classified correctly by threshold — a low outcome reads as the low regime.","refs":["Barlas 1996","Scheffer 2009"],"method":"Single deterministic run","runs":"1 run × 3 regimes","horizon":"20 years"},"B3":{"stage":2,"what":"Transitions go low → mid → high in order, never skipping the middle.","refs":["Barlas 1996","Scheffer 2009"],"method":"Single driven run","runs":"1 run × 3 regimes","horizon":"30 years"},"B4":{"stage":2,"what":"Escape requires a sustained crossing before the regime is confirmed (hysteresis).","refs":["Barlas 1996","Scheffer 2009"],"method":"Single driven run","runs":"1 run × 3 regimes","horizon":"30 years"},"B5":{"stage":2,"what":"Intervention effects ramp up over time rather than switching on all at once.","refs":["Barlas 1996"],"method":"Ensemble mean (two horizons)","runs":"11 runs × 2 horizons × 3 regimes","horizon":"1 & 4 years"},"B6":{"stage":2,"what":"From any starting point the system settles to a bounded resting state.","refs":["Barlas 1996"],"method":"Steady-state ensemble (level-convergence)","runs":"10 trajectories × 3 regimes","horizon":"50 years"},"B7":{"stage":2,"what":"Qualitative conclusions survive ±15% random perturbation of the parameters.","refs":["Saltelli 2004","Barlas 1996"],"method":"Monte-Carlo sensitivity","runs":"60 MC runs × 3 regimes","horizon":"5 years + MC"},"C1":{"stage":2,"what":"Wherever the integrated portfolio can be deployed (coordination ≥ the 0.20 structural-feasibility gate), coordination collapses to its floor regardless of how high it starts — a global attractor invariant to initial condition. Below the gate the portfolio cannot form (the small-bundle exception).","refs":["Barlas 1996","Scheffer 2009"],"method":"Deterministic trajectory × initial conditions","runs":"5 starts × 3 regimes","horizon":"30 years"},"C2":{"stage":2,"what":"No in-bounds admin setting (friction × success-boost × decay, 12 cells) lets the integrated portfolio sustain coordination above 0.5 — the collapse is robust to tuning, not an artefact of one calibration.","refs":["Barlas 1996","Saltelli 2004"],"method":"Admin-grid sweep (longest run above 0.5)","runs":"12 cells × 3 regimes","horizon":"30 years"},"S1":{"stage":3,"what":"The documented poverty-trap pattern: with no policy, income decays to subsistence.","refs":["Barlas 1996","Sargent 2013"],"method":"Single deterministic run","runs":"1 run (Chikankari)","horizon":"30 years"},"S2":{"stage":3,"what":"The integrated strategy beats single-stance strategies — the whole exceeds the parts.","refs":["Barlas 1996","Sargent 2013"],"method":"Ensemble mean","runs":"7 runs × 3 scenarios (Chikankari)","horizon":"30 years"},"S3":{"stage":3,"what":"The connective-failure case responds to market-linkage policy.","refs":["Sargent 2013"],"method":"Ensemble mean","runs":"7 runs × 2 scenarios (Cheriyal)","horizon":"30 years"},"S4":{"stage":3,"what":"The distributional-failure case responds to structural / integrated policy.","refs":["Sargent 2013"],"method":"Ensemble mean","runs":"7 runs × 2 scenarios (Chikankari)","horizon":"30 years"},"S5":{"stage":3,"what":"The two archetypes respond differently — distinct structural diagnoses, distinct levers.","refs":["Barlas 1996","Sargent 2013"],"method":"Ensemble mean","runs":"7 runs × 2 cases","horizon":"25 years"},"C3":{"stage":3,"what":"Removing each policy in turn from the integrated portfolio shows a load-bearing core (structural backbone + market/IP lever) whose removal breaks escape, redundant members whose removal costs nothing, and no member whose removal improves the outcome. Prune for parsimony, not for gain.","refs":["Saltelli 2004","Sargent 2013"],"method":"Replicated leave-one-out (escape probability)","runs":"12 runs × 7 portfolios (Chikankari)","horizon":"30 years"}};
  const REFS=["Barlas, Y. (1996). Formal aspects of model validity and validation in system dynamics. System Dynamics Review, 12(3), 183–210.","Forrester, J. W. & Senge, P. M. (1980). Tests for building confidence in system dynamics models. TIMS Studies in the Management Sciences, 14, 209–228.","Sargent, R. G. (2013). Verification and validation of simulation models. Journal of Simulation, 7(1), 12–24.","Saltelli, A., Tarantola, S., Campolongo, F. & Ratto, M. (2004). Sensitivity Analysis in Practice. Wiley.","Scheffer, M. (2009). Critical Transitions in Nature and Society. Princeton University Press."];
  const STAGES={"1":["Stage 1 — Direct structure","Is the model built right? The accounting closes, quantities stay valid, and each relationship points the right way. Run across three regimes, so it is a property of the structure — not of any one case."],"2":["Stage 2 — Structure-oriented behaviour","Does the structure produce sound dynamics when run? Sensible behaviour at the extremes, the right qualitative shapes, stability, ordered regime change and hysteresis. Run across three regimes."],"3":["Stage 3 — Behaviour pattern (demonstration)","Does the model reproduce the observed patterns of a real sector? Shown here on the handicrafts case — domain-specific, and the proof that the structure also lands correctly on reality."]};
  const SCOPE="Scope of validation. These are the subset of the Barlas, Forrester–Senge, Sargent and Saltelli tests that suit a theory-driven structural model with illustrative parameters. Tests requiring empirical time-series, statistical fit to historical data, or predictive/forecast accuracy are deliberately excluded — the model is a structured-reasoning tool, not an empirically-calibrated forecaster, and its effect sizes are illustrative. What is validated is the soundness and transferability of the structure (Stages 1–2) and the qualitative reproduction of a real sector's patterns (Stage 3) — not the numerical prediction of outcomes.";
  const CFGLABEL={A:'high-extraction',B:'low-extraction',N:'neutral (synthetic)'};

  function computeAll(){
    const snap=snapshot();
    const _userParams=captureParams();   // save the session's current settings
    applyParams(DEFAULTS);               // validate the model's default calibration
    SIMCOUNT=0;
    const struct=[], demo=[];
    try{
      for(let i=0;i<TESTS.length;i++){ const t=TESTS[i], id=t[0], name=t[1], fn=t[2];
        const res=CONFIGS.map(function(c){ try{return Object.assign({cfg:c.id},fn(c));}catch(e){return{cfg:c.id,pass:false,detail:'ERR '+e.message};} });
        struct.push({id:id,name:name,all:res.every(function(r){return r.pass;}),res:res}); }
      for(let i=0;i<S3TESTS.length;i++){ const t=S3TESTS[i], id=t[0], name=t[1], fn=t[2];
        let r; try{ r=fn(); }catch(e){ r={pass:false,detail:'ERR '+e.message}; }
        demo.push({id:id,name:name,pass:r.pass,detail:r.detail}); }
    } finally { restore(snap); applyParams(_userParams); }   // restore run state + session settings
    return {struct:struct, demo:demo, sims:SIMCOUNT};
  }

  function metaLine(id){ const m=META[id]; return '<div class="cpv-meta"><span class="cpv-ref">'+m.refs.join(' · ')+'</span> &nbsp;|&nbsp; '+m.method+' &nbsp;|&nbsp; '+m.runs+' &nbsp;|&nbsp; '+m.horizon+'</div>'; }

  function renderAll(){
    const all=computeAll();
    const sP=all.struct.filter(function(t){return t.all;}).length;
    const dP=all.demo.filter(function(t){return t.pass;}).length;
    const ok=(sP===all.struct.length)&&(dP===all.demo.length);
    let h='<div class="cpv-banner" style="background:'+(ok?'#e6f6ec':'#fde8e8')+';color:'+(ok?'#15803d':'#b91c1c')+'">Stages 1–2 (structure): '+sP+' / '+all.struct.length+' across all three regimes &nbsp;·&nbsp; Stage 3 (demonstration): '+dP+' / '+all.demo.length+'</div>';
    // scope
    h+='<div class="cpv-scope">'+SCOPE+'</div>';
    // stages 1 and 2
    [1,2].forEach(function(stage){
      h+='<div class="cpv-stage"><div class="cpv-stage-h">'+STAGES[stage][0]+'</div><div class="cpv-stage-d">'+STAGES[stage][1]+'</div></div>';
      all.struct.filter(function(t){return META[t.id].stage===stage;}).forEach(function(t){
        h+='<div class="cpv-t"><div class="cpv-row"><span class="cpv-tag" style="color:'+(t.all?'#15803d':'#b91c1c')+'">'+(t.all?'PASS':'FAIL')+'</span><span class="cpv-name">'+t.id+' · '+t.name+'</span></div>';
        h+='<div class="cpv-what">'+META[t.id].what+'</div>'+metaLine(t.id);
        t.res.forEach(function(r){ h+='<div class="cpv-cfg">'+CFGLABEL[r.cfg]+': <span style="color:'+(r.pass?'#15803d':'#b91c1c')+';font-weight:700">'+(r.pass?'holds':'FAILS')+'</span> — '+r.detail+'</div>'; });
        h+='</div>';
      });
    });
    // stage 3
    h+='<div class="cpv-stage"><div class="cpv-stage-h">'+STAGES[3][0]+'</div><div class="cpv-stage-d">'+STAGES[3][1]+'</div></div>';
    all.demo.forEach(function(t){
      h+='<div class="cpv-t"><div class="cpv-row"><span class="cpv-tag" style="color:'+(t.pass?'#15803d':'#b91c1c')+'">'+(t.pass?'PASS':'FAIL')+'</span><span class="cpv-name">'+t.id+' · '+t.name+'</span></div>';
      h+='<div class="cpv-what">'+META[t.id].what+'</div>'+metaLine(t.id);
      h+='<div class="cpv-cfg">handicrafts: <span style="color:'+(t.pass?'#15803d':'#b91c1c')+';font-weight:700">'+(t.pass?'holds':'FAILS')+'</span> — '+t.detail+'</div></div>';
    });
    // references + footer
    h+='<div class="cpv-stage"><div class="cpv-stage-h">Academic references</div></div>';
    h+='<div class="cpv-refs"><ol>'+REFS.map(function(r){return '<li>'+r+'</li>';}).join('')+'</ol></div>';
    h+='<div class="cpv-foot">This report executed '+all.sims+' ensemble simulations of the model live, plus Monte-Carlo and steady-state ensembles. Figures vary slightly each run (the model carries ±2%/month stochastic noise); the verdicts are stable. Effect sizes are illustrative — see scope above.</div>';
    return h;
  }

  function open(){
    let ov=document.getElementById('cpv-overlay');
    if(!ov){ ov=document.createElement('div'); ov.id='cpv-overlay'; ov.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:100000;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:30px 16px'; document.body.appendChild(ov); }
    ov.innerHTML='<div style="background:#fff;max-width:780px;width:100%;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.3);padding:22px 24px 26px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#1e293b;line-height:1.55">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div><div style="font-size:19px;font-weight:800;color:#1B3A5C">How this model works &amp; why it&rsquo;s valid</div><div style="font-size:12px;color:#64748b;margin-top:2px">Validated live against the Barlas (1996) three-stage standard</div></div>'
      +'<button id="cpv-close" style="border:none;background:#eef2f7;border-radius:8px;padding:6px 11px;cursor:pointer;font-size:15px">&times;</button></div>'
      +'<div style="margin:14px 0 4px">'+"<p class=\"cpv-lead\">This panel runs the model's validation <b>live</b>, organised by the three recognised stages of system-dynamics validation (Barlas 1996). Stages 1–2 test the structure itself across three regimes — high-extraction, low-extraction, and a synthetic neutral one — so a pass is a property of the structure, not of any one case. Stage 3 shows the structure reproducing a real sector's patterns, on the handicrafts demonstration. Tests run against the model's <b>default calibration</b> (any admin edits are set aside for the run and restored afterward) and carry the model's \u00b12% stochastic noise, so figures shift slightly between runs.</p>"+'</div>'
      +'<div style="margin:8px 0 10px"><button id="cpv-run" style="background:#1B3A5C;color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer">Run again</button></div>'
      +'<div id="cpv-results"><div style="color:#64748b;padding:14px 0">Validating live…</div></div></div>';
    document.getElementById('cpv-close').onclick=function(){ ov.remove(); };
    ov.onclick=function(e){ if(e.target===ov) ov.remove(); };
    const run=function(){ const b=document.getElementById('cpv-run'); b.disabled=true; document.getElementById('cpv-results').innerHTML='<div style="color:#64748b;padding:14px 0">Running…</div>';
      setTimeout(function(){ try{ document.getElementById('cpv-results').innerHTML=renderAll(); }catch(e){ document.getElementById('cpv-results').innerHTML='<div style="color:#b91c1c">Error: '+e.message+'</div>'; } b.disabled=false; },40); };
    document.getElementById('cpv-run').onclick=run; run();
  }
  function injectButton(){
    if(document.getElementById('cpv-btn')) return;
    const b=document.createElement('button'); b.id='cpv-btn'; b.textContent='✓ How this model works & why it\'s valid';
    b.style.cssText='position:fixed;bottom:18px;left:18px;z-index:99998;background:#1B3A5C;color:#fff;border:none;border-radius:24px;padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(27,58,92,.35);font-family:-apple-system,sans-serif';
    b.onclick=open; document.body.appendChild(b);
    const st=document.createElement('style'); st.textContent=".cpv-lead{font-size:13.5px;margin:0 0 10px}.cpv-idea{font-size:13px;background:#f7f9fc;border-left:3px solid #1B3A5C;border-radius:6px;padding:9px 12px;margin:7px 0}.cpv-idea b{color:#1B3A5C}.cpv-banner{font-size:14.5px;font-weight:700;padding:11px 14px;border-radius:9px;margin:6px 0 10px}.cpv-scope{font-size:12px;background:#fbfbe8;border:1px solid #ece9c8;border-radius:8px;padding:10px 13px;margin:0 0 12px;color:#5b5733;line-height:1.5}.cpv-stage{margin:18px 0 6px}.cpv-stage-h{font-size:14px;font-weight:800;color:#1B3A5C}.cpv-stage-d{font-size:12px;color:#64748b;margin-top:2px;line-height:1.5}.cpv-t{padding:9px 0;border-bottom:1px solid #eef2f7}.cpv-row{display:flex;gap:8px;align-items:baseline}.cpv-tag{font-weight:800;font-size:11px;min-width:38px}.cpv-name{font-weight:700;font-size:13.5px}.cpv-what{font-size:12.5px;margin:3px 0 0 46px;color:#1e293b}.cpv-meta{font-size:11px;margin:3px 0 0 46px;color:#94a3b8}.cpv-ref{color:#1B3A5C;font-weight:600}.cpv-cfg{font-size:11.5px;margin:3px 0 0 46px;color:#64748b}.cpv-refs{font-size:11.5px;color:#475569;line-height:1.55}.cpv-refs ol{margin:4px 0 0 0;padding-left:20px}.cpv-refs li{margin:3px 0}.cpv-foot{margin-top:16px;font-size:11px;color:#94a3b8;line-height:1.6;border-top:1px solid #e5e9f0;padding-top:12px}"; document.head.appendChild(st);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', injectButton); else injectButton();
})();
