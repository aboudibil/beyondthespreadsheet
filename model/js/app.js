/* ╔════════════════════════════════════════════════════════════════════════════╗
   ║  CPAF v6 - app.js                                                           ║
   ║  Main Application Controller                                                ║
   ╚════════════════════════════════════════════════════════════════════════════╝ */

const App = (function() {
  'use strict';

  let simInterval = null;
  let running = false;
  let _policyPanel = null;

  // ========== INITIALIZATION ==========
  function init() {
    console.log('CPAF v6 Initializing...');
    precomputeBifurcationCards();      // compute explainer cards from the engine; the initState below resets the run clean
    Simulation.initState('chikankari');
    Charts.initCharts();
    renderPoliciesList();
    renderCLD();
    renderLoopLegend();
    renderPolicyMatrix();
    updateUI();
    Charts.updateCharts(Simulation.getState());
    Admin.updateCaseStudyDropdown();
    setupEventListeners();
    // Policy Interaction Analysis panel — reads the app's current selection & case; protects the live run
    try {
      if (typeof PolicyExplorer !== 'undefined' && PolicyExplorer.mount) {
        const _userSel = () => {
          const S = Simulation.getState();
          const casc = S.cascadeActivated || new Set();
          return Array.from(S.activePolicies || []).filter(id => !casc.has(id));
        };
        PolicyExplorer.mount(document.getElementById('policyAnalysisPanel'), {
          mode: 'embedded', dark: false,
          getCase: () => Simulation.getState().caseStudy || 'chikankari',
          getSelection: _userSel,
          isSimRunning: () => running,
          pauseSim: () => { if (running) toggleSim(); },
          resumeSim: () => { if (!running) toggleSim(); }
        });
        _policyPanel = document.getElementById('policyAnalysisPanel');
      }
    } catch (e) { console.warn('Policy analysis panel mount skipped:', e); }
    
    // Initialize 3D Attractor (NEW)
    if (typeof Attractor3D !== 'undefined') {
      Attractor3D.init();
    }
    // keep the attractor legend in sync with the live thresholds (recut/recalibrated), not hardcoded
    try {
      const th = Config.THRESHOLDS;
      const lt = document.getElementById('legTrap'), lg = document.getElementById('legGrowth');
      if (lt && th) lt.innerHTML = '■ TRAP (₹&lt;' + (th.TRAP / 1000).toFixed(1) + 'k)';
      if (lg && th) lg.innerHTML = '■ GROWTH (₹&gt;' + (th.GROWTH / 1000).toFixed(1) + 'k)';
    } catch (e) {}

    console.log('CPAF v6 Ready');
  }

  function setupEventListeners() {
    const speedSlider = document.getElementById('speedSlider');
    if (speedSlider) {
      speedSlider.addEventListener('input', () => {
        if (running) {
          clearInterval(simInterval);
          simInterval = setInterval(stepAndUpdate, 550 - speedSlider.value);
        }
      });
    }
    document.getElementById('detailModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'detailModal') closeModal();
    });
    document.getElementById('adminPanel')?.addEventListener('click', (e) => {
      if (e.target.id === 'adminPanel') Admin.closePanel();
    });
  }

  // ========== SIMULATION CONTROL ==========
  function toggleSim() {
    running = !running;
    const btn = document.getElementById('btnRun');
    if (running) {
      btn.textContent = '⏸ Pause';
      btn.classList.add('running');
      Simulation.logEvent('SIM', 'Simulation STARTED');
      updateEventLog();
      const speed = document.getElementById('speedSlider')?.value || 200;
      simInterval = setInterval(stepAndUpdate, 550 - speed);
    } else {
      btn.textContent = '▶ Run';
      btn.classList.remove('running');
      clearInterval(simInterval);
      Simulation.logEvent('SIM', 'Simulation PAUSED');
      updateEventLog();
    }
  }

  function stepAndUpdate() {
    Simulation.step();
    updateUI();
    Charts.updateCharts(Simulation.getState());
    updateCLD();
    updateEventLog();
    
    // Update 3D Attractor (NEW) — isolated so any WebGL/trail error can't break the sim loop or the UI
    if (typeof Attractor3D !== 'undefined') {
      try {
        Attractor3D.update(Simulation.getState());
        // FIX N2: Throttle landscape/bifurcation rebuild to every 12 ticks (was every tick → memory bomb)
        if (Attractor3D.currentMode && Attractor3D.currentMode !== 'trajectory') {
          const st = Simulation.getState();
          if (st.month % 12 === 0 || st.tipping) { // Only rebuild monthly or on tipping events
            const pi = (Simulation.effectivePolicyCount ? Simulation.effectivePolicyCount() : (st.activePolicies ? st.activePolicies.size : 0)) / 5;
            Attractor3D.setMode(Attractor3D.currentMode, st, pi);
          }
        }
      } catch (e) { if (window.console) console.warn('Attractor3D update skipped:', e && e.message); }
    }
  }

  function resetSim() {
    running = false;
    clearInterval(simInterval);
    document.getElementById('btnRun').textContent = '▶ Run';
    document.getElementById('btnRun').classList.remove('running');
    const S = Simulation.getState();
    Simulation.initState(S.caseStudy);
    Simulation.logEvent('SIM', 'Simulation RESET');  // Log after init so it appears in fresh log
    Charts.destroyCharts();
    Charts.initCharts();
    updateUI();
    Charts.updateCharts(Simulation.getState());
    renderCLD();
    updateCLD();
    renderPoliciesList();
    updateEventLog();
    document.querySelectorAll('.policy-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.btn-scenario').forEach(el => el.classList.remove('active'));
    
    // Reset 3D Attractor (NEW)
    if (typeof Attractor3D !== 'undefined') {
      Attractor3D.reset();
    }
    if (_policyPanel && _policyPanel._peReset) try { _policyPanel._peReset(); } catch(e){}
  }

  function switchCaseStudy(caseId) {
    running = false;
    clearInterval(simInterval);
    document.getElementById('btnRun').textContent = '▶ Run';
    document.getElementById('btnRun').classList.remove('running');
    
    // Check custom case studies first
    const customCases = Admin.getCustomCaseStudies();
    const customCase = customCases.find(c => c.id === caseId);
    // No need to mutate Config.CASE_STUDIES — getCaseStudy() checks custom cases first
    
    Simulation.initState(caseId);
    if (_policyPanel && _policyPanel._peReset) try { _policyPanel._peReset(); } catch(e){}
    Charts.destroyCharts();
    Charts.initCharts();
    renderPoliciesList();
    updateUI();
    Charts.updateCharts(Simulation.getState());
    renderCLD();
    updateEventLog();
  }

  // ========== CLD RENDERING (CODE-VERIFIED v4 — matches simulation.js) ==========
  // Audit: 6 stocks, 2R+3B loops, NO Production Capacity (phantom stock removed)
  // Every arrow references a simulation.js line number
  function renderLoopLegend() {
    const el = document.getElementById('loopLegendBody');
    if (!el || !Config.LOOPS) return;
    const policyDriven = { 'R-COHERE': 1, 'B-FRAG': 1 };
    const rows = Object.keys(Config.LOOPS).map(id => {
      const L = Config.LOOPS[id];
      const tag = (L.type === 'Reinforcing') ? 'r' : 'b';
      const nm = (L.name || id).replace(id + ': ', '');
      const cls = policyDriven[id] ? 'policy-driven' : 'endogenous';
      const clsCol = cls === 'endogenous' ? '#16a34a' : '#94a3b8';
      return '<tr style="border-bottom:1px solid #f1f5f9;cursor:pointer" onclick="App.showLoopModal(\'' + id + '\')">'
        + '<td style="padding:5px 6px;white-space:nowrap;vertical-align:top"><span class="leg-' + tag + '" style="font-weight:700">' + id + '</span></td>'
        + '<td style="padding:5px 6px;vertical-align:top"><b>' + nm + '</b><div style="opacity:0.65;font-size:11px;margin-top:1px">' + (L.path || '') + '</div></td>'
        + '<td style="padding:5px 6px;font-size:11px;opacity:0.7;vertical-align:top">' + (L.reference || '') + (L.leverage ? '<div style="opacity:0.7">🎯 Meadows #' + L.leverage.pt + '</div>' : '') + '</td>'
        + '<td style="padding:5px 6px;font-size:11px;color:' + clsCol + ';vertical-align:top">' + cls + '</td>'
        + '</tr>';
    }).join('');
    el.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:12px">'
      + '<thead><tr style="text-align:left;color:#64748b;font-size:11px;border-bottom:1px solid #cbd5e1">'
      + '<th style="padding:5px 6px">Loop</th><th style="padding:5px 6px">Name &amp; causal path</th><th style="padding:5px 6px">Reference</th><th style="padding:5px 6px">Class</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function renderPolicyMatrix() {
    const el = document.getElementById('policyMatrixBody');
    if (!el || !Config.POLICIES) return;
    const P = Config.POLICIES;
    const cols = [['skills','Skills'],['market','Market'],['income','Income'],['middlemen','Middlemen'],['heritage','Heritage'],['coordination','Co-op'],['coh','Coherence']];
    const order = [
      { grp:'Umbrella programmes — containers (own effect inert; delivered via children)', ids:['NHDP','AMBEDKAR_HASTSHILP','MARKETING_SUPPORT','HERITAGE_AWARDS','USTTAD','HUNAR_HAAT'] },
      { grp:'Standalone policies — effects apply directly', ids:['SFURTI','CLUSTER_DEV','PMEGP','PM_VISHWAKARMA','GI_REGISTRATION','MAI','TIES','ODOP','ECOMMERCE','NAI_ROSHNI','GURU_SHISHYA'] }
    ];
    const cell = (p, k) => {
      if (p.isUmbrella) return '<td style="text-align:center;color:#94a3b8;background:#f1f5f9">·</td>';
      const v = k === 'coh' ? (p.coherenceContribution || 0) : ((p.effects && p.effects[k]) || 0);
      if (!v) return '<td style="text-align:center;color:#cbd5e1">·</td>';
      const pos = v > 0, col = pos ? '#166534' : '#991b1b', bg = pos ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)';
      return '<td style="text-align:center;font-weight:600;color:' + col + ';background:' + bg + '">' + (pos ? '+' : '\u2212') + Math.abs(v).toFixed(2) + '</td>';
    };
    let html = '<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="color:#64748b;text-align:left">'
      + '<th style="padding:3px 5px">Instrument</th><th style="padding:3px 5px">Type</th>';
    cols.forEach(([k, lab]) => { const c = k === 'coordination' ? '#16a34a' : k === 'coh' ? '#4f46e5' : '#334155'; html += '<th style="padding:3px 5px;text-align:center;color:' + c + '">' + lab + '</th>'; });
    html += '</tr></thead><tbody>';
    order.forEach(g => {
      html += '<tr><td colspan="' + (2 + cols.length) + '" style="background:#eef2ff;color:#3730a3;font-weight:700;padding:4px 5px">' + g.grp + '</td></tr>';
      g.ids.forEach(id => {
        const p = P[id]; if (!p) return;
        const inert = !!p.isUmbrella;
        const child = p.parentProgramme && !p.isUmbrella && (p.parentProgramme === 'NHDP' || p.parentProgramme === 'USTTAD');
        const nm = (child ? '↳ ' : '') + (p.name || id);
        html += '<tr style="border-bottom:1px solid #f1f5f9;cursor:pointer;' + (inert ? 'background:#f1f5f9' : '') + '" onclick="App.showPolicyModal(\'' + id + '\')">'
          + '<td style="padding:3px 5px;' + (inert ? 'font-style:italic;color:#64748b' : '') + '">' + nm + '</td>'
          + '<td style="padding:3px 5px;color:#64748b">' + (inert ? 'umbrella' : (p.type || '')) + '</td>';
        cols.forEach(([k]) => html += cell(p, k));
        html += '</tr>';
      });
    });
    html += '</tbody></table><div style="font-size:10px;color:#94a3b8;margin-top:4px">+ raises · − lowers · · = no direct link · grey = umbrella container (own effect inert; delivered via its children). Co-op = artisan coordination; Coherence = inter-ministry C_eff. Click a row for the policy detail.</div>';
    el.innerHTML = html;
  }

  function renderCLD() {
    const svg = document.getElementById('cldSvg');
    if (!svg) return;
    svg.innerHTML = `
      <defs>
        <marker id="arr" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto"><polygon points="0 0,7 2.5,0 5" fill="#94a3b8"/></marker>
        <marker id="arr-g" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto"><polygon points="0 0,7 2.5,0 5" fill="#16a34a"/></marker>
        <marker id="arr-r" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto"><polygon points="0 0,7 2.5,0 5" fill="#dc2626"/></marker>
        <marker id="arr-i" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto"><polygon points="0 0,7 2.5,0 5" fill="#4f46e5"/></marker>
      </defs>
      <rect width="100%" height="100%" fill="#fafbfc"/>

      <!-- LEFT COLUMN: active policies -->
      <text x="92" y="34" font-size="11" fill="#94a3b8" font-weight="600" text-anchor="middle">POLICIES</text>
      <g id="gPol"><text id="noPolicyTxt" x="92" y="80" font-size="11" fill="#94a3b8" text-anchor="middle" opacity="0.6">none active</text></g>

      <!-- RIGHT COLUMN: dimensions (each couples to a DIFFERENT element, not all to Income) -->
      <text x="918" y="92" font-size="11" fill="#94a3b8" font-weight="600" text-anchor="middle">DIMENSIONS</text>
      <path class="flow dim-flow" id="fD1" d="M 900,124 Q 600,110 378,156" fill="none" stroke="#16a34a" stroke-width="1.5" opacity="0.3" stroke-dasharray="5,3" marker-end="url(#arr-g)" pointer-events="none"/>
      <path class="flow dim-flow" id="fD5" d="M 901,182 Q 812,150 694,124" fill="none" stroke="#16a34a" stroke-width="1.5" opacity="0.45" marker-end="url(#arr-g)" pointer-events="none"/>
      <path class="flow dim-flow" id="fD2" d="M 900,250 Q 740,244 564,238" fill="none" stroke="#16a34a" stroke-width="1.5" opacity="0.45" marker-end="url(#arr-g)" pointer-events="none"/>
      <path class="flow dim-flow" id="fD3" d="M 900,316 Q 580,362 325,242" fill="none" stroke="#16a34a" stroke-width="1.5" opacity="0.45" marker-end="url(#arr-g)" pointer-events="none"/>
      <path class="flow dim-flow" id="fD6" d="M 900,378 Q 700,388 504,256" fill="none" stroke="#16a34a" stroke-width="1.5" opacity="0.45" marker-end="url(#arr-g)" pointer-events="none"/>
      <circle class="aux dim" cx="918" cy="120" r="18" onclick="App.showDimModal('D1')"/>
      <text class="aux-lbl" x="918" y="116" font-size="8" fill="#166534" text-anchor="middle" dominant-baseline="central">D1:Net</text>
      <text class="aux-lbl" x="918" y="125" font-size="8" fill="#166534" text-anchor="middle" dominant-baseline="central">Density</text>
      <circle class="aux dim" cx="918" cy="185" r="18" onclick="App.showDimModal('D5')"/>
      <text class="aux-lbl" x="918" y="181" font-size="8" fill="#0891b2" text-anchor="middle" dominant-baseline="central">D5:Spat</text>
      <text class="aux-lbl" x="918" y="190" font-size="8" fill="#0891b2" text-anchor="middle" dominant-baseline="central">Mult</text>
      <circle class="aux dim" cx="918" cy="250" r="18" onclick="App.showDimModal('D2')"/>
      <text class="aux-lbl" x="918" y="246" font-size="8" fill="#d97706" text-anchor="middle" dominant-baseline="central">D2:Attr</text>
      <text class="aux-lbl" x="918" y="255" font-size="8" fill="#d97706" text-anchor="middle" dominant-baseline="central">State</text>
      <circle class="aux dim" cx="918" cy="315" r="18" onclick="App.showDimModal('D3')"/>
      <text class="aux-lbl" x="918" y="311" font-size="8" fill="#7c3aed" text-anchor="middle" dominant-baseline="central">D3:NPF</text>
      <text class="aux-lbl" x="918" y="320" font-size="8" fill="#7c3aed" text-anchor="middle" dominant-baseline="central">P-val</text>
      <circle class="aux dim" cx="918" cy="380" r="18" onclick="App.showDimModal('D6')"/>
      <text class="aux-lbl" x="918" y="376" font-size="8" fill="#db2777" text-anchor="middle" dominant-baseline="central">D6:ABM</text>
      <text class="aux-lbl" x="918" y="385" font-size="8" fill="#db2777" text-anchor="middle" dominant-baseline="central">Gini</text>
      <text x="918" y="424" font-size="7.5" fill="#94a3b8" text-anchor="middle">D4 = this diagram</text>
      <text x="918" y="435" font-size="7.5" fill="#94a3b8" text-anchor="middle">D7 = Monte Carlo</text>

      <!-- CENTER: causal loop diagram -->
      <g transform="translate(160,0)">
      <!-- SECONDARY LINKS (dashed, clickable) -->
      <path class="flow" id="fMidMkt" d="M 112,254 Q 340,420 466,152" stroke="#94a3b8" stroke-dasharray="4,3" opacity="0.5" marker-end="url(#arr)" style="cursor:pointer" onclick="App.showSecondaryLinkModal('mid_mkt')"/>
      <text x="250" y="360" font-size="11" fill="#94a3b8">−</text>
      <path class="flow" id="fHerSkill" d="M 560,222 C 640,110 540,52 360,52 C 300,52 255,80 232,104" stroke="#94a3b8" stroke-dasharray="4,3" opacity="0.5" marker-end="url(#arr)" style="cursor:pointer" onclick="App.showSecondaryLinkModal('her_skill')"/>
      <text x="358" y="44" font-size="11" fill="#94a3b8">+</text>
      <path class="flow" id="fCoopMid" d="M 150,180 Q 120,201 108,216" stroke="#dc2626" stroke-width="2" marker-end="url(#arr-r)"/>
      <text x="124" y="199" font-size="11" fill="#dc2626" font-weight="700">−</text>

      <!-- R1 -->
      <path class="flow" id="fSkillInc" d="M 198,138 Q 232,188 300,215" stroke="#16a34a" marker-end="url(#arr-g)"/>
      <text x="288" y="206" font-size="11" fill="#16a34a" font-weight="600">+</text>
      <path class="flow" id="fIncSkill" d="M 320,215 Q 282,180 238,138" stroke="#16a34a" marker-end="url(#arr-g)"/>
      <text x="240" y="150" font-size="11" fill="#16a34a" font-weight="600">+</text>
      <!-- R2 -->
      <path class="flow" id="fSkillMkt" d="M 260,113 Q 340,93 420,113" stroke="#16a34a" marker-end="url(#arr-g)"/>
      <text x="335" y="103" font-size="11" fill="#16a34a" font-weight="600">+</text>
      <path class="flow" id="fMktInc" d="M 478,138 Q 440,188 374,216" stroke="#16a34a" marker-end="url(#arr-g)"/>
      <text x="436" y="186" font-size="11" fill="#16a34a" font-weight="600">+</text>
      <!-- Coherence × delivery -> Income (R-COHERE) -->
      <path class="flow" id="fCoord" d="M 350,176 L 344,215" stroke="#4f46e5" stroke-width="2" marker-end="url(#arr-i)"/>
      <text x="358" y="199" font-size="12" fill="#4f46e5" font-weight="700">×</text>
      <!-- B1 -->
      <path class="flow" id="fMidInc" d="M 159,231 Q 225,219 280,231" stroke="#dc2626" marker-end="url(#arr-r)"/>
      <text x="210" y="222" font-size="11" fill="#dc2626" font-weight="700">−</text>
      <path class="flow" id="fIncMid" d="M 280,245 Q 225,259 159,245" stroke="#dc2626" marker-end="url(#arr-r)"/>
      <text x="210" y="263" font-size="11" fill="#dc2626" font-weight="700">−</text>
      <!-- B2 -->
      <path class="flow" id="fIncPop" d="M 358,257 Q 396,325 358,375" stroke="#16a34a" marker-end="url(#arr-g)"/>
      <text x="392" y="320" font-size="11" fill="#16a34a" font-weight="600">+</text>
      <path class="flow" id="fPopInc" d="M 322,375 Q 284,325 322,257" stroke="#dc2626" marker-end="url(#arr-r)"/>
      <text x="278" y="320" font-size="11" fill="#dc2626" font-weight="600">−</text>
      <!-- B3 -->
      <path class="flow" id="fMktHer" d="M 510,138 Q 562,176 576,214" stroke="#dc2626" marker-end="url(#arr-r)"/>
      <text x="558" y="178" font-size="11" fill="#dc2626" font-weight="600">−</text>
      <path class="flow" id="fHerInc" d="M 520,233 Q 460,231 402,234" stroke="#16a34a" marker-end="url(#arr-g)"/>
      <text x="452" y="224" font-size="11" fill="#16a34a" font-weight="600">+</text>

      <!-- STOCKS -->
      <rect class="stock-box" id="sSkill" x="150" y="100" width="110" height="38" rx="6" fill="#E1F5EE" stroke="#0F6E56" onclick="App.showStockModal('skills')"/>
      <text class="stock-lbl" x="205" y="119" fill="#065F46" dominant-baseline="central">Skills</text>
      <rect class="stock-box" id="sMkt" x="420" y="100" width="110" height="38" rx="6" fill="#E1F5EE" stroke="#0F6E56" onclick="App.showStockModal('market')"/>
      <text class="stock-lbl" x="475" y="119" fill="#065F46" dominant-baseline="central">Market</text>
      <rect class="stock-box" id="sInc" x="280" y="215" width="120" height="42" rx="6" fill="#DBEAFE" stroke="#2563eb" stroke-width="2.5" onclick="App.showStockModal('income')"/>
      <text class="stock-lbl" x="340" y="236" fill="#1E40AF" font-size="12" dominant-baseline="central">Income</text>
      <rect class="stock-box" id="sMid" x="47" y="216" width="112" height="38" rx="6" fill="#FEE2E2" stroke="#DC2626" onclick="App.showStockModal('middlemen')"/>
      <text class="stock-lbl" x="103" y="235" fill="#991B1B" dominant-baseline="central">Middlemen</text>
      <rect class="stock-box" id="sHer" x="520" y="216" width="110" height="38" rx="6" fill="#EDE9FE" stroke="#7C3AED" onclick="App.showStockModal('heritage')"/>
      <text class="stock-lbl" x="575" y="235" fill="#5B21B6" dominant-baseline="central">Heritage</text>
      <rect class="stock-box" id="sPop" x="285" y="375" width="110" height="38" rx="6" fill="#DCFCE7" stroke="#16A34A" onclick="App.showStockModal('population')"/>
      <text class="stock-lbl" x="340" y="394" fill="#166534" dominant-baseline="central">Population</text>

      <!-- SPLIT: Artisan Co-op (coordination) + Inter-Ministry Coherence (C_eff) -->
      <rect class="aux" id="aCoop" x="118" y="150" width="100" height="30" rx="6" fill="#dcfce7" stroke="#16a34a" stroke-width="1.8" onclick="App.showStockModal('coordination')"/>
      <text class="aux-lbl" x="168" y="161" font-size="9" font-weight="700" fill="#166534">Artisan Co-op</text>
      <text class="aux-lbl" x="168" y="172" font-size="7" fill="#166534">bargaining</text>
      <rect class="aux" id="aCoherence" x="298" y="146" width="104" height="30" rx="6" fill="#e0e7ff" stroke="#4f46e5" stroke-width="1.8" onclick="App.showStockModal('policyCoherence')"/>
      <text class="aux-lbl" x="350" y="158" font-size="9" font-weight="700" fill="#3730a3">Coherence</text>
      <text class="aux-lbl" x="350" y="169" font-size="7" fill="#4f46e5">C_eff (× delivery)</text>

      <!-- LOOP BADGES -->
      <path class="loop-arc r" id="arcR1" d="M 247,173 A 9 9 0 1 1 265,173"/>
      <text class="loop-lbl r" id="lblR1" x="256" y="180" text-anchor="middle" dominant-baseline="central" onclick="App.showLoopModal('R1')">R1</text>
      <path class="loop-arc r" id="arcR2" d="M 421,159 A 9 9 0 1 1 439,159"/>
      <text class="loop-lbl r" id="lblR2" x="430" y="166" text-anchor="middle" dominant-baseline="central" onclick="App.showLoopModal('R2')">R2</text>
      <path class="loop-arc b" id="arcB1" d="M 209,231 A 9 9 0 1 1 227,231"/>
      <text class="loop-lbl b" id="lblB1" x="218" y="238" text-anchor="middle" dominant-baseline="central" onclick="App.showLoopModal('B1')">B1</text>
      <path class="loop-arc b" id="arcB2" d="M 331,315 A 9 9 0 1 1 349,315"/>
      <text class="loop-lbl b" id="lblB2" x="340" y="322" text-anchor="middle" dominant-baseline="central" onclick="App.showLoopModal('B2')">B2</text>
      <path class="loop-arc b" id="arcB3" d="M 507,179 A 9 9 0 1 1 525,179"/>
      <text class="loop-lbl b" id="lblB3" x="516" y="186" text-anchor="middle" dominant-baseline="central" onclick="App.showLoopModal('B3')">B3</text>

      <text id="txtR1act" x="256" y="202" font-size="7" fill="#16a34a" text-anchor="middle" opacity="0.75">R1: --%</text>
      <text id="txtR2act" x="430" y="148" font-size="7" fill="#16a34a" text-anchor="middle" opacity="0.75">R2: --%</text>

      <!-- R-CREDIT: credit lock-in Income -> Middlemen (− link; reinforcing vicious trap) -->
      <path class="flow" id="fCredit" d="M 300,255 Q 230,285 165,252" stroke="#dc2626" stroke-width="1.6" marker-end="url(#arr-r)"/>
      <text x="234" y="284" font-size="10" fill="#dc2626" font-weight="600">−</text>

      <!-- NEW LOOP LABELS (all 10 loops drawn; clickable) -->
      <text class="loop-lbl r" id="lblRCohere" x="300" y="204" text-anchor="middle" font-size="8" onclick="App.showLoopModal('R-COHERE')">R-COHERE</text>
      <text class="loop-lbl r" id="lblRCounter" x="96" y="196" text-anchor="middle" font-size="8" onclick="App.showLoopModal('R-COUNTER')">R-COUNTER</text>
      <text class="loop-lbl b" id="lblBFrag" x="352" y="136" text-anchor="middle" font-size="8" onclick="App.showLoopModal('B-FRAG')">B-FRAG</text>
      <text class="loop-lbl r" id="lblRCoop" x="168" y="142" text-anchor="middle" font-size="8" onclick="App.showLoopModal('R-COOP')">R-COOP</text>
      <text class="loop-lbl r" id="lblRCredit" x="234" y="270" text-anchor="middle" font-size="8" onclick="App.showLoopModal('R-CREDIT')">R-CREDIT</text>
      </g>
    `;
  }

  const POLICY_SHORT = {
    NHDP:'NHDP', AMBEDKAR_HASTSHILP:'AHVY', MARKETING_SUPPORT:'MKT', SFURTI:'SFR',
    PMEGP:'PMEG', PM_VISHWAKARMA:'PMVY', CLUSTER_DEV:'CLST', USTTAD:'USTD',
    HUNAR_HAAT:'HAAT', NAI_ROSHNI:'NR', GURU_SHISHYA:'GS', GI_REGISTRATION:'GI',
    HERITAGE_AWARDS:'HA', MAI:'MAI', TIES:'TIES', ODOP:'ODOP', ECOMMERCE:'ECOM'
  };
  // Policy-arrow targets: LEFT-edge entry point of each stock in VISUAL coords (loop block is translate(160))
  const STOCK_TARGETS = {
    skills:      { x: 310, y: 119 },
    market:      { x: 580, y: 119 },
    income:      { x: 440, y: 236 },
    middlemen:   { x: 207, y: 235 },
    heritage:    { x: 680, y: 235 },
    coordination:{ x: 278, y: 165 },
    policyCoherence:{ x: 458, y: 161 }
  };

  function renderActivePolicies(S) {
    const gPol = document.getElementById('gPol');
    if (!gPol) return;
    gPol.innerHTML = '';
    const active = (Simulation.effectiveActivePolicyIds ? Simulation.effectiveActivePolicyIds() : (S.activePolicies ? Array.from(S.activePolicies) : []));
    if (active.length === 0) {
      gPol.innerHTML = '<text id="noPolicyTxt" x="92" y="236" font-size="11" fill="#94a3b8" text-anchor="middle" opacity="0.6">none active</text>';
      return;
    }
    const spacing = Math.min(38, Math.floor(360 / active.length));
    const startY = Math.max(60, 236 - (active.length * spacing / 2));
    active.forEach((pId, i) => {
      const policy = Config.getPolicy(pId);
      if (!policy) return;
      const cy = startY + i * spacing;
      const cx = 92;
      const label = POLICY_SHORT[pId] || pId.substring(0, 4);

      // arrows to each affected stock (drawn first, under the circle)
      const effects = policy.effects || {};
      Object.keys(effects).forEach(stockKey => {
        const val = effects[stockKey];
        if (Math.abs(val) < 0.03) return;           // skip negligible effects
        const target = STOCK_TARGETS[stockKey];
        if (!target) return;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const midX = cx + (target.x - cx) * 0.45;
        const midY = cy + (target.y - cy) * 0.35;
        line.setAttribute('d', `M ${cx + 14},${cy} Q ${midX},${midY} ${target.x},${target.y}`);
        line.setAttribute('fill', 'none');
        line.setAttribute('marker-end', val > 0 ? 'url(#arr-g)' : 'url(#arr-r)');
        const w = Math.min(2, 0.5 + Math.abs(val) * 6).toFixed(1);
        if (val > 0) {                               // positive: amber solid
          line.setAttribute('stroke', '#d97706');
          line.setAttribute('stroke-width', w);
          line.setAttribute('opacity', '0.5');
        } else {                                     // negative: red dashed
          line.setAttribute('stroke', '#ef4444');
          line.setAttribute('stroke-width', w);
          line.setAttribute('stroke-dasharray', '3,2');
          line.setAttribute('opacity', '0.5');
        }
        gPol.appendChild(line);
      });

      // coherenceContribution is a SEPARATE field (not in effects) -> arrow to the Coherence node
      const _coh = policy.coherenceContribution || 0;
      if (_coh >= 0.03 && STOCK_TARGETS.policyCoherence) {
        const t = STOCK_TARGETS.policyCoherence;
        const cl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const mX = cx + (t.x - cx) * 0.45, mY = cy + (t.y - cy) * 0.35;
        cl.setAttribute('d', `M ${cx + 14},${cy} Q ${mX},${mY} ${t.x},${t.y}`);
        cl.setAttribute('fill', 'none');
        cl.setAttribute('marker-end', 'url(#arr-g)');
        cl.setAttribute('stroke', '#d97706');
        cl.setAttribute('stroke-width', Math.min(2, 0.6 + _coh * 6).toFixed(1));
        cl.setAttribute('opacity', '0.5');
        gPol.appendChild(cl);
      }

      // policy node + label
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'aux pol');
      circle.setAttribute('cx', cx); circle.setAttribute('cy', cy); circle.setAttribute('r', '14');
      circle.setAttribute('onclick', `App.showPolicyModal('${pId}')`);
      gPol.appendChild(circle);
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('class', 'aux-lbl'); txt.setAttribute('x', cx); txt.setAttribute('y', cy);
      txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('dominant-baseline', 'central');
      txt.setAttribute('font-size', label.length > 4 ? '6' : '7'); txt.setAttribute('pointer-events', 'none');
      txt.textContent = label;
      gPol.appendChild(txt);
    });
  }

  // Highlights active loops, stocks, and flows based on simulation state
  function updateCLD() {
    const S = Simulation.getState();
    
    // Reset all active states
    document.querySelectorAll('.loop-lbl, .loop-arc').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.stock-box').forEach(el => el.classList.remove('pulse'));
    document.querySelectorAll('.flow').forEach(el => el.classList.remove('active'));

    // Dynamic policy rendering — shows only active policies with impact arrows
    renderActivePolicies(S);

    // R1/R2 activation level display
    const txtR1 = document.getElementById('txtR1act');
    const txtR2 = document.getElementById('txtR2act');
    if (txtR1) txtR1.textContent = `R1: ${(S._R1_activation * 100).toFixed(0)}%`;
    if (txtR2) txtR2.textContent = `R2: ${(S._R2_activation * 100).toFixed(0)}%`;

    // GROWTH state → R1 + R2 reinforcing loops active
    if (S.attractorState === 'GROWTH') {
      document.getElementById('lblR1')?.classList.add('active');
      document.getElementById('arcR1')?.classList.add('active');
      document.getElementById('lblR2')?.classList.add('active');
      document.getElementById('arcR2')?.classList.add('active');
      document.getElementById('sSkill')?.classList.add('pulse');
      document.getElementById('sMkt')?.classList.add('pulse');
      document.getElementById('sInc')?.classList.add('pulse');
      document.getElementById('fSkillInc')?.classList.add('active');
      document.getElementById('fIncSkill')?.classList.add('active');
      document.getElementById('fMktInc')?.classList.add('active');
      document.getElementById('fSkillMkt')?.classList.add('active');
    }

    // R1 partially active (activation > 50% even outside GROWTH)
    if (S._R1_activation > 0.5 && S.attractorState !== 'GROWTH') {
      document.getElementById('fSkillInc')?.classList.add('active');
      document.getElementById('fIncSkill')?.classList.add('active');
    }

    // TRAP state → B1 middlemen exploitation loop active
    if (S.attractorState === 'TRAP') {
      document.getElementById('lblB1')?.classList.add('active');
      document.getElementById('arcB1')?.classList.add('active');
      document.getElementById('sMid')?.classList.add('pulse');
      document.getElementById('fMidInc')?.classList.add('active');
      document.getElementById('fIncMid')?.classList.add('active');
    }

    // B2: Population competition active when competitionFactor depressed
    if (S.competitionFactor < 0.9) {
      document.getElementById('lblB2')?.classList.add('active');
      document.getElementById('arcB2')?.classList.add('active');
      document.getElementById('sPop')?.classList.add('pulse');
      document.getElementById('fPopInc')?.classList.add('active');
    }

    // B3: Heritage dilution — active when market > 0.6 AND skills < 0.6 (L750)
    if (S.market > 0.6 && S.skills < 0.6) {
      document.getElementById('lblB3')?.classList.add('active');
      document.getElementById('arcB3')?.classList.add('active');
      document.getElementById('sHer')?.classList.add('pulse');
      document.getElementById('fMktHer')?.classList.add('active');
    }

    // Heritage premium active when heritage deviates from 0.5
    if (Math.abs(S.heritage - 0.5) > 0.1) {
      document.getElementById('fHerInc')?.classList.add('active');
    }

    // Middlemen drain highlighted when middlemen high
    if (S.middlemen > 0.7) {
      document.getElementById('fMidInc')?.classList.add('active');
      document.getElementById('sMid')?.classList.add('pulse');
    }

    // Highlight active inter-dimensional couplings
    S.couplings.forEach(c => {
      if (c === 'D1-D4') { document.getElementById('fCoord')?.classList.add('active'); document.getElementById('fD1')?.classList.add('active'); }
      if (c === 'D2-D4') document.getElementById('fD2')?.classList.add('active');
      if (c === 'D3-D4') document.getElementById('fD3')?.classList.add('active');
      if (c === 'D5-D4') document.getElementById('fD5')?.classList.add('active');
      if (c === 'D6-D4') document.getElementById('fD6')?.classList.add('active');
      if (c === 'D4-B3') document.getElementById('fMktHer')?.classList.add('active');
      if (c === 'B3-D4') document.getElementById('fHerInc')?.classList.add('active');
    });

    // Tipping alert
    const alert = document.getElementById('tippingAlert');
    if (alert) {
      alert.classList.toggle('visible', S.tipping);
      if (S.tipping) {
        const _inc = Math.round(S.income).toLocaleString();
        let _where;
        if (S.tippingType === 'escape') {
          _where = `near ₹${S.thresholds.TRAP.toLocaleString()} escape threshold`;
        } else {
          _where = (S.income >= S.thresholds.GROWTH)
            ? `crossing ₹${S.thresholds.GROWTH.toLocaleString()} growth line`
            : `approaching ₹${S.thresholds.GROWTH.toLocaleString()} growth threshold`;
        }
        alert.textContent = `⚠️ TIPPING: Income ₹${_inc} ${_where}`;
      }
    }
  }

  // ========== UI UPDATES ==========
  function updateUI() {
    const S = Simulation.getState();
    const cs = Config.getCaseStudy(S.caseStudy);

    // Time display
    document.getElementById('curMonth').textContent = S.month;
    document.getElementById('curYear').textContent = S.year;

    // D1: Coordination
    document.getElementById('D1val').textContent = S.coordination.toFixed(2);
    document.getElementById('D1bar').style.width = `${S.coordination * 100}%`;
    const coordStatus = S.coordination < 0.4 ? 'FRAGMENTED' : S.coordination < 0.6 ? 'MODERATE' : 'INTEGRATED';
    // FIX N5: Read coord_multiplier from Config instead of hardcoding 0.3+0.7
    const coordRange = Config.EQUATION_PARAMS.income.coord_multiplier.value;
    // Delivery multiplier tracks POLICY COHERENCE (inter-ministry), matching the engine's _coordEffect
    // after the two-stream split — NOT the artisan co-op stock. Keeps the D1 read-out aligned with what
    // actually scales policy delivery.
    const coordEffect = ((1 - coordRange) + coordRange * (S.policyCoherence != null ? S.policyCoherence : S.coordination)).toFixed(2);
    document.getElementById('D1status').textContent = `${coordStatus} (co-op) — Policy delivery ×${coordEffect} (coherence ${(S.policyCoherence != null ? S.policyCoherence : 0).toFixed(2)})`;

    // D2: Attractor State
    const d2val = document.getElementById('D2val');
    d2val.textContent = S.attractorState;
    d2val.className = 'dim-value ' + S.attractorState.toLowerCase();
    // FIX N4: Use S.thresholds (dynamic, admin-editable) instead of Config.THRESHOLDS (static)
    const stateDesc = {
      'TRAP': `Income ₹${Math.round(S.income).toLocaleString()} < ₹${S.thresholds.TRAP.toLocaleString()} threshold`,
      'TRANSITION': `Income ₹${Math.round(S.income).toLocaleString()} — unstable state`,
      'GROWTH': `Income ₹${Math.round(S.income).toLocaleString()} > ₹${S.thresholds.GROWTH.toLocaleString()} threshold`
    };
    document.getElementById('D2status').textContent = stateDesc[S.attractorState];

    // D3: Political
    document.getElementById('D3val').textContent = S.political.toFixed(2);
    document.getElementById('D3bar').style.width = `${S.political * 100}%`;
    const polStatus = S.political < 0.3 ? 'MARKET-FOCUSED' : S.political > 0.7 ? 'WELFARE-FOCUSED' : 'BALANCED';
    document.getElementById('D3status').textContent = `${polStatus} — ${S.political < 0.3 ? 'Welfare blocked' : S.political > 0.7 ? 'Market blocked' : 'All policies feasible'}`;

    // NPF Narrative Display (NEW)
    if (S.npf) {
      const narrativeLabels = {
        'exploitation': '📖 Exploitation Narrative',
        'empowerment': '🌟 Empowerment Narrative',
        'heritage_loss': '🏛️ Heritage Loss Narrative',
        'modernization': '🚀 Modernization Narrative',
        'transition': '⚖️ Transition Narrative',
        'inequality': '📊 Inequality Narrative'
      };
      document.getElementById('npfNarrative').textContent = narrativeLabels[S.npf.dominantNarrative] || '📖 Narrative';
      document.getElementById('npfHero').textContent = `🦸 ${S.npf.characters.hero}`;
      document.getElementById('npfVillain').textContent = `👹 ${S.npf.characters.villain}`;
      document.getElementById('npfVictim').textContent = `🎭 ${S.npf.characters.victim}`;
      document.getElementById('coalitionWelfare').style.width = `${S.npf.coalitions.welfare * 100}%`;
      document.getElementById('coalitionMarket').style.width = `${S.npf.coalitions.market * 100}%`;
      document.querySelector('#coalitionWelfare + .coalition-label').textContent = `Welfare ${Math.round(S.npf.coalitions.welfare * 100)}%`;
      document.querySelector('#coalitionMarket + .coalition-label').textContent = `Market ${Math.round(S.npf.coalitions.market * 100)}%`;
    }

    // D4: Feedback Loops — show R-loop activation
    const r1pct = Math.round((S._R1_activation || 1) * 100);
    const r2pct = Math.round((S._R2_activation || 1) * 100);
    const dominantLoop = S.attractorState === 'TRAP' ? 'B1 (Exploitation)' : S.attractorState === 'GROWTH' ? 'R1 (Skills-Income)' : 'Mixed';
    document.getElementById('D4status').textContent = `${dominantLoop} | R1:${r1pct}% R2:${r2pct}%`;

    // D5: Spatial — FIX #20: Compute from actual spatial state
    // FIX N9: This shows spatial access multiplier average (urban+peri_urban+rural)/3, not infrastructure
    const d5composite = S.spatial ? ((S.spatial.urban || 1) + (S.spatial.peri_urban || 0.7) + (S.spatial.rural || 0.4)) / 3 : 0.70;
    document.getElementById('D5val').textContent = d5composite.toFixed(2);
    document.getElementById('D5bar').style.width = `${d5composite * 100}%`;

    // D6: Segments
    const gini = Simulation.calculateGini();
    document.getElementById('D6status').textContent = `A:${(S.segments.A.share*100).toFixed(0)}% B:${(S.segments.B.share*100).toFixed(0)}% C:${(S.segments.C.share*100).toFixed(0)}%`;
    document.getElementById('D6gini').textContent = `Gini: ${gini.toFixed(2)}`;

    // D7: Monte Carlo
    if (S.monteCarloResults) {
      document.getElementById('D7status').textContent = `Escape prob: ${(S.monteCarloResults.stats.escapeProb * 100).toFixed(1)}%`;
    }

    // Segments display
    document.getElementById('segAbar').style.width = `${S.segments.A.share * 100}%`;
    document.getElementById('segApct').textContent = `${(S.segments.A.share * 100).toFixed(0)}%`;
    document.getElementById('segAinc').textContent = `₹${Math.round(S.segments.A.income).toLocaleString()}`;

    document.getElementById('segBbar').style.width = `${S.segments.B.share * 100}%`;
    document.getElementById('segBpct').textContent = `${(S.segments.B.share * 100).toFixed(0)}%`;
    document.getElementById('segBinc').textContent = `₹${Math.round(S.segments.B.income).toLocaleString()}`;

    document.getElementById('segCbar').style.width = `${S.segments.C.share * 100}%`;
    document.getElementById('segCpct').textContent = `${(S.segments.C.share * 100).toFixed(0)}%`;
    document.getElementById('segCinc').textContent = `₹${Math.round(S.segments.C.income).toLocaleString()}`;

    // Outcome cards
    const outState = document.getElementById('outState');
    outState.textContent = S.attractorState;
    outState.className = 'outcome-value ' + S.attractorState.toLowerCase();
    document.getElementById('outStateDesc').textContent = S.attractorState === 'TRAP' ? 'Self-reinforcing decline' : S.attractorState === 'GROWTH' ? 'Virtuous cycle active' : 'Unstable transition';

    document.getElementById('outIncome').textContent = `₹${Math.round(S.income).toLocaleString()}`;
    document.getElementById('outGini').textContent = gini.toFixed(2);
    // Policy efficiency: income gained above subsistence per 100 crore of active budget (cost-effectiveness).
    const effEl = document.getElementById('outEfficiency');
    if (effEl) {
      const active = (Simulation.effectiveActivePolicyIds ? Simulation.effectiveActivePolicyIds() : Array.from(S.activePolicies || []));
      const totalBudget = active.reduce((s, id) => s + ((Config.getPolicy(id) || {}).budget || 0), 0);
      const sub = (Config.EQUATION_PARAMS.income.subsistence || { value: 2000 }).value;
      const gain = Math.max(0, S.income - sub);
      effEl.textContent = totalBudget > 0 ? '₹' + Math.round(gain / totalBudget * 100).toLocaleString() : '—';
    }
    
    const policyReach = S.coordination * 0.7 + 0.3;
    document.getElementById('outReach').textContent = `${(policyReach * 100).toFixed(0)}%`;

    // Complexity indicators with interpretations
    const cxPanel = document.getElementById('complexityPanel');
    if (cxPanel) {
      const r1 = (S._R1_activation || 1) * 100;
      const r2 = (S._R2_activation || 1) * 100;
      const credit = (S._creditDependency || 0) * 100;
      const comp = S.competitionFactor || 1;
      const netDensity = S.networkDensity || 0;
      const exits = Math.round(S.craftExits || 0);
      
      document.getElementById('cxR1bar').style.width = `${r1}%`;
      document.getElementById('cxR1val').textContent = `${r1.toFixed(0)}%`;
      document.getElementById('cxR1bar').style.background = r1 < 50 ? '#ef4444' : r1 < 80 ? '#f59e0b' : '#22c55e';
      
      document.getElementById('cxR2bar').style.width = `${r2}%`;
      document.getElementById('cxR2val').textContent = `${r2.toFixed(0)}%`;
      document.getElementById('cxR2bar').style.background = r2 < 50 ? '#ef4444' : r2 < 80 ? '#f59e0b' : '#3b82f6';
      
      document.getElementById('cxCreditbar').style.width = `${Math.min(credit / 0.8 * 100, 100)}%`;
      document.getElementById('cxCreditval').textContent = `${credit.toFixed(0)}%`;
      document.getElementById('cxCreditbar').style.background = credit > 30 ? '#ef4444' : credit > 10 ? '#f59e0b' : '#22c55e';
      
      document.getElementById('cxCompbar').style.width = `${comp * 100}%`;
      document.getElementById('cxCompval').textContent = `×${comp.toFixed(2)}`;
      
      document.getElementById('cxNetval').textContent = `${netDensity} links`;
      document.getElementById('cxExitsval').textContent = `${exits.toLocaleString()}`;
      
      // Dynamic interpretations — plain-English meaning for each indicator
      const r1i = document.getElementById('cxR1interpret');
      if (r1i) {
        if (r1 < 15) r1i.textContent = 'Middlemen capture nearly all skill premium';
        else if (r1 < 40) r1i.textContent = 'Most skill premium captured by middlemen';
        else if (r1 < 70) r1i.textContent = 'Partial skill premium reaching artisans';
        else r1i.textContent = 'Skill premium flowing to artisans';
      }
      
      const r2i = document.getElementById('cxR2interpret');
      if (r2i) {
        if (r2 < 15) r2i.textContent = 'No direct market access — all through middlemen';
        else if (r2 < 40) r2i.textContent = 'Limited market channels, mostly intermediated';
        else if (r2 < 70) r2i.textContent = 'Some direct market access emerging';
        else r2i.textContent = 'Direct market channels active';
      }
      
      const ci = document.getElementById('cxCreditinterpret');
      if (ci) {
        if (credit > 60) ci.textContent = 'Severe: middlemen control working capital';
        else if (credit > 30) ci.textContent = 'High dependency — exploitative pricing likely';
        else if (credit > 10) ci.textContent = 'Moderate — some alternative credit sources';
        else ci.textContent = 'Low — artisans have independent credit access';
      }
      
      const coi = document.getElementById('cxCompinterpret');
      if (coi) {
        if (comp < 0.7) coi.textContent = 'Severe crowding — market oversaturated';
        else if (comp < 0.85) coi.textContent = 'Significant competition pressure';
        else if (comp < 0.95) coi.textContent = 'Mild competitive pressure';
        else coi.textContent = 'No crowding — market absorbs production';
      }
      
      const ni = document.getElementById('cxNetinterpret');
      if (ni) {
        if (netDensity > 10) ni.textContent = 'Tightly coupled — high fragility risk';
        else if (netDensity > 5) ni.textContent = 'Moderate coupling across dimensions';
        else if (netDensity > 0) ni.textContent = 'Weak cross-dimension interactions';
        else ni.textContent = 'No active couplings';
      }
      
      const ei = document.getElementById('cxExitsinterpret');
      if (ei) {
        const initPop = S.history.population?.[0] || S.population;
        if (exits <= 0) { ei.textContent = 'No departures yet'; }
        else if (initPop > 0 && exits >= initPop) {
          ei.textContent = `${exits.toLocaleString()} cumulative departures — more than the starting workforce of ${Math.round(initPop).toLocaleString()}, because this counts everyone who left over the run (ongoing turnover), not a share of a fixed group`;
        } else {
          const exitPct = initPop > 0 ? (exits / initPop * 100) : 0;
          const tail = exitPct > 50 ? 'tradition at risk' : exitPct > 20 ? 'significant knowledge drain' : exitPct > 5 ? 'moderate attrition' : 'within normal turnover';
          ei.textContent = `${exits.toLocaleString()} cumulative departures (~${exitPct.toFixed(exitPct > 5 ? 0 : 1)}% of the starting workforce) — ${tail}`;
        }
      }
    }

    // Update coupling badges
    document.querySelectorAll('.coupling-badge').forEach(badge => {
      badge.classList.toggle('active', S.couplings.has(badge.dataset.c));
    });

    // Update coupling network edges (NEW)
    document.querySelectorAll('.coupling-edge').forEach(edge => {
      edge.classList.remove('active');
    });
    S.couplings.forEach(coupling => {
      const edge = document.getElementById(`edge-${coupling}`);
      if (edge) edge.classList.add('active');
    });

    // Update summary bar (NEW)
    const summaryState = document.getElementById('summaryState');
    if (summaryState) {
      const stateIcons = { TRAP: '⚠️', TRANSITION: '⏳', GROWTH: '✅' };
      summaryState.querySelector('.summary-icon').textContent = stateIcons[S.attractorState];
      summaryState.querySelector('.summary-text').textContent = `System in ${S.attractorState}`;
      summaryState.className = 'summary-item ' + (S.attractorState === 'TRAP' ? 'warning' : S.attractorState === 'GROWTH' ? 'success' : '');
    }
    const summaryIncome = document.getElementById('summaryIncome');
    if (summaryIncome) {
      summaryIncome.textContent = `₹${Math.round(S.income).toLocaleString()}/mo`;
    }
    const summaryPolicies = document.getElementById('summaryPolicies');
    if (summaryPolicies) {
      summaryPolicies.textContent = `${Simulation.effectivePolicyCount()} policies active`;
    }
    const summaryAlert = document.getElementById('summaryAlert');
    if (summaryAlert) {
      if (S.coordination < 0.3) {
        summaryAlert.style.display = 'flex';
        summaryAlert.querySelector('.summary-text').textContent = 'Coordination failing';
        summaryAlert.className = 'summary-item warning';
      } else if (S.tipping) {
        summaryAlert.style.display = 'flex';
        summaryAlert.querySelector('.summary-text').textContent = 'Near tipping point!';
        summaryAlert.className = 'summary-item warning';
      } else {
        summaryAlert.style.display = 'none';
      }
    }

    // Update active shocks display
    const shocksPanel = document.getElementById('activeShocksPanel');
    const shocksList = document.getElementById('activeShocksList');
    if (shocksPanel && shocksList && S.activeShocks) {
      if (S.activeShocks.length > 0) {
        shocksPanel.style.display = 'block';
        shocksList.innerHTML = S.activeShocks.map(shock => `
          <div class="shock-item">
            <span class="shock-name">${shock.name || shock.id}</span>
            <span class="shock-remaining">${shock.remainingMonths} months remaining</span>
          </div>
        `).join('');
      } else {
        shocksPanel.style.display = 'none';
      }
    }

    // Update Decision Insights Panel
    updateDecisionInsights(S);

    // Update policy feasibility
    updatePolicyFeasibility();
  }

  function updateDecisionInsights(S) {
    // 1. Distance to Threshold
    const insightThreshold = document.getElementById('insightThreshold');
    if (insightThreshold) {
      let distanceText, itemClass;
      if (S.attractorState === 'GROWTH') {
        distanceText = '✓ In GROWTH state';
        itemClass = 'positive';
      } else if (S.attractorState === 'TRANSITION') {
        const toGrowth = Math.round(S.thresholds.GROWTH - S.income);
        if (toGrowth > 0) {
          distanceText = `₹${toGrowth.toLocaleString()} to GROWTH`;
          itemClass = 'warning';
        } else {
          distanceText = '✓ Above growth line — confirming growth';
          itemClass = 'positive';
        }
      } else {
        const toTransition = Math.round(S.thresholds.TRAP - S.income);
        if (toTransition > 0) {
          distanceText = `₹${toTransition.toLocaleString()} below TRAP exit`;
          itemClass = 'negative';
        } else {
          const toGrowth = Math.round(S.thresholds.GROWTH - S.income);
          if (toGrowth > 0) {
            distanceText = `₹${toGrowth.toLocaleString()} to GROWTH`;
            itemClass = 'warning';
          } else {
            distanceText = '✓ Above growth line — confirming growth';
            itemClass = 'positive';
          }
        }
      }
      insightThreshold.querySelector('.insight-text').textContent = distanceText;
      insightThreshold.className = `insight-item ${itemClass}`;
    }

    // 2. Monte Carlo Badge
    const insightMC = document.getElementById('insightMC');
    if (insightMC && S.monteCarloResults) {
      insightMC.style.display = 'flex';
      const escapeProb = (S.monteCarloResults.stats.escapeProb * 100).toFixed(0);
      insightMC.querySelector('.insight-text').textContent = `Escape: ${escapeProb}%`;
      insightMC.className = `insight-item ${escapeProb >= 50 ? 'positive' : escapeProb >= 25 ? 'warning' : 'negative'}`;
    }

    // 3. Synergy/Conflict/Risk Indicators
    const synergyList = document.getElementById('synergyList');
    if (synergyList) {
      const indicators = [];
      const activePolicies = Simulation.effectiveActivePolicyIds();

      // FIX N1: Read synergies/conflicts/redundancies dynamically from CALIBRATION
      const cal = Simulation.getCalibration();
      const policyInteractions = cal.policyInteractions || {};
      Object.entries(policyInteractions).forEach(([combo, data]) => {
        const [p1, p2] = combo.split('+');
        if (activePolicies.includes(p1) && activePolicies.includes(p2)) {
          const pctChange = Math.round((data.modifier - 1) * 100);
          const sign = pctChange >= 0 ? '+' : '';
          if (data.type === 'synergy') {
            indicators.push({ type: 'synergy', icon: '⚡', text: `${p1}+${p2} synergy: ${sign}${pctChange}% effectiveness` });
          } else if (data.type === 'conflict') {
            indicators.push({ type: 'conflict', icon: '⚠️', text: `${p1}+${p2} conflict: ${sign}${pctChange}% effectiveness` });
          } else if (data.type === 'redundancy') {
            indicators.push({ type: 'risk', icon: '🔄', text: `${p1}+${p2} redundancy: ${sign}${pctChange}% effectiveness` });
          }
        }
      });

      // FIX N5: Read coord_multiplier from Config instead of hardcoding 0.3+0.7
      if (Simulation.effectivePolicyCount() >= 2) {
        const coordRange = Config.EQUATION_PARAMS.income.coord_multiplier.value;
        const coordEffect = ((1 - coordRange) + coordRange * S.coordination).toFixed(2);
        if (S.coordination < 0.4) {
          indicators.push({ type: 'risk', icon: '⚠️', text: `Low coordination: Policies at ${(coordEffect * 100).toFixed(0)}% effectiveness` });
        } else if (S.coordination > 0.6) {
          indicators.push({ type: 'synergy', icon: '📈', text: `High coordination: Policies at ${(coordEffect * 100).toFixed(0)}% effectiveness` });
        }
      }

      // Check for risks
      if (S.market > 0.6 && S.skills < 0.5) {
        indicators.push({ type: 'risk', icon: '⚠️', text: 'B3 Risk: Heritage dilution (high market, low skills)' });
      }
      if (S.attractorState === 'TRAP' && S.middlemen > 0.7) {
        indicators.push({ type: 'risk', icon: '⚠️', text: 'B1 Risk: Middlemen exploitation increasing' });
      }

      // Check for conflicts
      if (activePolicies.some(p => Config.getPolicy(p)?.type === 'market') && S.political < 0.3) {
        indicators.push({ type: 'conflict', icon: '❌', text: 'Political climate unfavorable for market policies' });
      }

      synergyList.innerHTML = indicators.map(ind => `
        <div class="synergy-item ${ind.type}">
          <span>${ind.icon}</span>
          <span>${ind.text}</span>
        </div>
      `).join('');
    }
  }

  // Event log filtering (NEW)
  let activeLogFilter = 'ALL';

  function filterLog(type) {
    activeLogFilter = type;
    document.querySelectorAll('.log-filter').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
    updateEventLog();
  }

  function updateEventLog() {
    const log = Simulation.getEventLog();
    const container = document.getElementById('eventLog');
    if (!container) return;

    // Apply filter
    let filtered = log;
    if (activeLogFilter !== 'ALL') {
      filtered = log.filter(e => e.type === activeLogFilter);
    }

    // Show all entries (newest first), cap at 500 for performance
    const maxDisplay = 500;
    const totalFiltered = filtered.length;
    const displayEvents = filtered.slice(-maxDisplay).reverse();
    
    let countInfo = '';
    if (totalFiltered > maxDisplay) {
      countInfo = `<div class="log-count">Showing ${maxDisplay} of ${totalFiltered} events (export for full log)</div>`;
    } else if (totalFiltered > 0) {
      countInfo = `<div class="log-count">${totalFiltered} event${totalFiltered !== 1 ? 's' : ''}</div>`;
    }
    
    container.innerHTML = countInfo + displayEvents.map(e => `
      <div class="log-entry">
        <span class="log-time">[Y${e.year} M${e.month}]</span>
        <span class="log-type ${e.type}">${e.type}</span>
        <span class="log-msg">${e.message}</span>
      </div>
    `).join('');
  }

  // ========== POLICIES ==========
  function renderPoliciesList() {
    const container = document.getElementById('policiesList');
    if (!container) return;

    const allPolicies = [...Object.values(Config.POLICIES), ...Admin.getCustomPolicies()];
    const ministries = [...new Set(allPolicies.map(p => p.ministry))];

    const childIds = new Set();
    allPolicies.forEach(p => { if (p.isUmbrella && Array.isArray(p.cascadeChildren)) p.cascadeChildren.forEach(c => childIds.add(c)); });

    const effLine = (policy) => Object.entries(policy.effects)
      .filter(([k, v]) => v !== 0).slice(0, 2)
      .map(([k, v]) => `${k.slice(0,3)} ${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`).join(', ');

    const itemHTML = (policy, cls) => `
          <div class="policy-item ${cls || ''}" data-id="${policy.id}" onclick="App.togglePolicy('${policy.id}')">
            <div class="policy-check"><span class="check-mark">\u2713</span></div>
            <div class="policy-info">
              <div class="policy-name">${policy.name}</div>
              <div class="policy-effect">${effLine(policy)}</div>
              <div class="policy-blocked"></div>
            </div>
          </div>`;

    const umbrellaHTML = (policy) => `
          <div class="policy-item policy-umbrella" data-id="${policy.id}" onclick="App.togglePolicy('${policy.id}')">
            <div class="policy-check"><span class="check-mark">\u2713</span></div>
            <div class="policy-info">
              <div class="policy-name">${policy.name}<span class="policy-umbrella-tag">\u25B8 programme \u00B7 activates components</span></div>
              <div class="policy-effect">effect = sum of active components</div>
              <div class="policy-blocked"></div>
            </div>
          </div>`;

    let html = `<div class="policy-note">Instruments shown are a <b>representative selection for demonstration</b> \u2014 real programmes (e.g. NHDP) contain further components not modelled here. <b>Effect sizes are illustrative.</b><br>A policy may be greyed with \u26A0 when it is <b>gated</b> by <b>political feasibility</b> (the governing coalition blocks the opposing policy type).</div>`;

    ministries.forEach(ministry => {
      const policies = allPolicies.filter(p => p.ministry === ministry);
      html += `<div class="policy-group"><div class="policy-group-title">${ministry}</div>`;
      policies.forEach(policy => {
        if (childIds.has(policy.id)) return;
        if (policy.isUmbrella && Array.isArray(policy.cascadeChildren)) {
          html += umbrellaHTML(policy);
          policy.cascadeChildren.forEach(cid => {
            const child = Config.getPolicy(cid);
            if (child) html += itemHTML(child, 'policy-child');
          });
        } else {
          html += itemHTML(policy);
        }
      });
      html += '</div>';
    });

    container.innerHTML = html;
  }

  function togglePolicy(policyId) {
    const result = Simulation.togglePolicy(policyId);
    const el = document.querySelector(`.policy-item[data-id="${policyId}"]`);
    if (result.blocked) {
      if (el) el.querySelector('.policy-blocked').textContent = `\u26A0 ${result.reason}`;
      return;
    }
    const active = Simulation.getState().activePolicies;
    document.querySelectorAll('.policy-item').forEach(item => {
      item.classList.toggle('active', active.has(item.dataset.id));
      const b = item.querySelector('.policy-blocked'); if (b) b.textContent = '';
    });
    updateEventLog();
    renderActivePolicies(Simulation.getState());
    const sp = document.getElementById('summaryPolicies');
    if (sp) sp.textContent = `${Simulation.effectivePolicyCount()} policies active`;
    if (_policyPanel && _policyPanel._peRefresh) try { _policyPanel._peRefresh(); } catch(e){}
  }

  function syncPolicyPanel() {
    const active = Simulation.getState().activePolicies;
    document.querySelectorAll('.policy-item').forEach(item => {
      item.classList.toggle('active', active.has(item.dataset.id));
    });
    const sp = document.getElementById('summaryPolicies');
    if (sp) sp.textContent = `${Simulation.effectivePolicyCount()} policies active`;
  }

  function updatePolicyFeasibility() {
    syncPolicyPanel(); // re-derive active state from the model every update (covers cascades/presets)
    const S = Simulation.getState();
    const hasActivePolicies = S.activePolicies && S.activePolicies.size > 0;
    
    document.querySelectorAll('.policy-item').forEach(el => {
      const policyId = el.dataset.id;
      const isActive = S.activePolicies && S.activePolicies.has(policyId);
      const feasibility = Simulation.checkPolicyFeasibility(policyId);
      
      // Only show blocked styling on inactive policies
      // Active policies should never appear blocked (they're already running)
      if (!isActive && !feasibility.feasible) {
        el.classList.add('blocked');
        // Show subtle precondition text only — not alarm-style
        el.querySelector('.policy-blocked').textContent = feasibility.reason ? `⚠ ${feasibility.reason}` : '';
      } else {
        el.classList.remove('blocked');
        el.querySelector('.policy-blocked').textContent = '';
      }
    });
  }

  function loadScenario(scenario, evt) {
    const S = Simulation.getState();
    // Full reset of policy state (active set + cascade tracking + ramp tracking)
    S.activePolicies.clear();
    if (S.cascadeActivated) S.cascadeActivated.clear();
    if (S.policyActivationMonth) Object.keys(S.policyActivationMonth).forEach(k => delete S.policyActivationMonth[k]);

    const scenarios = {
      none: [],
      market: ['MARKETING_SUPPORT', 'ECOMMERCE', 'MAI'],
      welfare: ['PM_VISHWAKARMA', 'USTTAD', 'NAI_ROSHNI'],
      integrated: ['SFURTI', 'ODOP', 'NHDP', 'GI_REGISTRATION', 'ECOMMERCE']
    };

    const policiesToActivate = scenarios[scenario] || [];
    const blocked = [];
    policiesToActivate.forEach(policyId => {
      const result = Simulation.togglePolicy(policyId);
      if (result && result.blocked) blocked.push(`${policyId} (${result.reason})`);
    });
    if (_policyPanel && _policyPanel._peRefresh) try { _policyPanel._peRefresh(); } catch(e){}

    // Re-sync the WHOLE panel from state \u2014 covers cascaded children, not just the listed ids
    syncPolicyPanel();
    renderActivePolicies(Simulation.getState());

    if (blocked.length) {
      Simulation.logEvent('POLICY', `Preset "${scenario}": ${blocked.length} blocked \u2014 ${blocked.join('; ')}`);
      updateEventLog();
    }

    document.querySelectorAll('.btn-scenario').forEach(btn => btn.classList.remove('active'));
    if (evt && evt.target) evt.target.classList.add('active');
  }

  // ========== MODALS ==========
  function showModal(icon, title, type, typeClass, body) {
    console.log('showModal called:', title);
    const modal = document.getElementById('detailModal');
    if (!modal) { console.error('Modal element not found!'); return; }
    
    document.getElementById('modalIcon').textContent = icon;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalType').textContent = type;
    document.getElementById('modalType').className = 'modal-type ' + typeClass;
    document.getElementById('modalBody').innerHTML = body;
    modal.classList.add('visible');
    console.log('Modal should now be visible');
  }

  function closeModal() {
    document.getElementById('detailModal').classList.remove('visible');
  }

  // Substitute live admin parameter values into formula templates so displayed
  // equations always match what the engine computes (no stale constants).
  function fillFormula(str) {
    if (!str || str.indexOf('{{') === -1) return str;
    const P = Config.EQUATION_PARAMS, T = Config.THRESHOLDS;
    const w = P.income.coord_multiplier.value;
    const fmt = n => String(parseFloat(Number(n).toFixed(3)));
    const map = {
      COORD_WEIGHT: fmt(w),
      COORD_FLOOR: fmt(1 - w),
      THR_TRAP: '₹' + Math.round(T.TRAP).toLocaleString(),
      THR_GROWTH: '₹' + Math.round(T.GROWTH).toLocaleString(),
      TRAP_DUR: String(T.TRAP_DURATION),
      GROWTH_DUR: String(T.GROWTH_DURATION || 12),
      MASS_PROD: fmt(P.heritage.mass_prod_effect.value)
    };
    return str.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in map ? map[k] : m));
  }

  const SECONDARY_LINKS = {
    coord_mid: { name: 'Coordination → Middlemen', polarity: '(−) suppression', formula: 'Middlemen_Suppression = Coordination × suppression_rate', description: 'Stronger inter-ministry coordination curbs middlemen capture in the value chain — better-aligned implementation leaves less room for intermediary extraction.', reference: 'Provan & Milward (2001)' },
    her_skill: { name: 'Heritage → Skills', polarity: '(+) transmission', formula: 'Skills_Transmission = Heritage × transmission_rate', description: 'Living craft heritage sustains the intergenerational transmission of skill; where heritage capital is high, skill is renewed across generations.', reference: 'UNESCO Convention for the Safeguarding of the Intangible Cultural Heritage (2003)' },
    mid_mkt: { name: 'Middlemen → Market', polarity: '(−) erosion', formula: 'Market_Erosion = Middlemen × erosion_rate', description: "Intermediary capture weakens artisans' direct market access and bargaining position, eroding market reputation built on direct buyer relationships.", reference: 'Gereffi (2005)' }
  };

  function showSecondaryLinkModal(id) {
    const lk = SECONDARY_LINKS[id];
    if (!lk) return;
    const body = `
      <div class="modal-section"><div class="modal-section-title">📝 Description</div><p>${lk.description}</p></div>
      <div class="modal-section"><div class="modal-section-title">🔄 Polarity</div><p>${lk.polarity}</p></div>
      <div class="modal-section"><div class="modal-section-title">📐 Relationship</div><div class="modal-eq">${lk.formula}</div></div>
      <div class="modal-section"><div class="modal-ref">📚 ${lk.reference}</div></div>
    `;
    showModal('🔗', lk.name, 'Secondary cross-link', 'coupling', body);
  }

  function showDimModal(dimId) {
    console.log('showDimModal called with:', dimId);
    const dim = Config.getDimension(dimId);
    console.log('Dimension data:', dim);
    if (!dim) { console.error('Dimension not found:', dimId); return; }
    const body = `
      <div class="modal-section"><div class="modal-section-title">📚 Theoretical Foundation</div><p><strong>${dim.theory}</strong></p><div class="modal-ref">${dim.references}</div></div>
      <div class="modal-section"><div class="modal-section-title">📝 Description</div><p>${dim.description}</p></div>
      <div class="modal-section"><div class="modal-section-title">📐 Core Equation</div><div class="modal-eq">${fillFormula(dim.formula).replace(/\n/g, '<br>')}</div></div>
      <div class="modal-section"><div class="modal-section-title">⚙️ Mechanism</div><p>${dim.mechanism}</p></div>
      <div class="modal-section"><div class="modal-section-title">📊 Basis of the values</div><p>${dim.empirical}</p></div>
      <div class="modal-section"><div class="modal-section-title">🔗 Key Variables</div><div class="modal-grid">${dim.variables.map(v => `<div class="modal-item"><div class="modal-item-value">${v}</div></div>`).join('')}</div></div>
    `;
    showModal('📊', `${dimId}: ${dim.name}`, 'Dimension', 'dim', body);
  }

  function showLoopModal(loopId) {
    const loop = Config.getLoop(loopId);
    if (!loop) return;
    const body = `
      <div class="modal-section"><div class="modal-section-title">📝 Description</div><p>${loop.description}</p></div>
      <div class="modal-section"><div class="modal-section-title">🔄 Causal Path</div><div class="modal-eq">${loop.path}</div></div>
      <div class="modal-section"><div class="modal-section-title">📐 Representative Equation</div><div class="modal-eq">${fillFormula(loop.equation)}</div></div>
      <div class="modal-section"><div class="modal-ref">📚 ${loop.reference}</div></div>
      ${loop.leverage ? '<div class="modal-section"><div class="modal-section-title">🎯 Meadows leverage point</div><p><b>#' + loop.leverage.pt + '</b> — ' + loop.leverage.name + ' <span style="opacity:0.6">(12 = shallow parameters · 1 = paradigm; deeper = higher return)</span></p></div>' : ''}
    `;
    showModal(loop.type === 'Reinforcing' ? '🔄' : '⚖️', loop.name, loop.type, loop.type === 'Reinforcing' ? 'loop-r' : 'loop-b', body);
  }

  function showCouplingModal(couplingId) {
    console.log('showCouplingModal called with:', couplingId);
    const coupling = Config.getCoupling(couplingId);
    console.log('Coupling data:', coupling);
    if (!coupling) { console.error('Coupling not found:', couplingId); return; }
    
    const S = Simulation.getState();
    const isActive = S.couplings && S.couplings.has(couplingId);
    
    const body = `
      <div class="modal-section">
        <div class="modal-grid">
          <div class="modal-item"><div class="modal-item-label">Status</div><div class="modal-item-value" style="color: ${isActive ? '#16a34a' : '#94a3b8'}">${isActive ? '✅ ACTIVE' : '⚪ Inactive'}</div></div>
          <div class="modal-item"><div class="modal-item-label">Trigger</div><div class="modal-item-value">${coupling.trigger}</div></div>
        </div>
      </div>
      <div class="modal-section"><div class="modal-section-title">🔗 Linked Dimensions</div><p>${coupling.dimensions.join(' ↔ ')}</p></div>
      <div class="modal-section"><div class="modal-section-title">📝 Description</div><p>${coupling.description}</p></div>
      <div class="modal-section"><div class="modal-section-title">📐 Transfer Function</div><div class="modal-eq">${fillFormula(coupling.formula)}</div></div>
      <div class="modal-section"><div class="modal-ref">📚 ${coupling.reference}</div></div>
    `;
    showModal('🔗', coupling.name, 'Dimension Coupling', isActive ? 'coupling-active' : 'coupling', body);
  }

  function showStockModal(stockId) {
    const stock = Config.getStock(stockId);
    if (!stock) return;
    const S = Simulation.getState();
    const currentVal = stockId === 'income' ? `₹${Math.round(S.income).toLocaleString()}` : 
                       stockId === 'population' ? Math.round(S.population).toLocaleString() :
                       S[stockId]?.toFixed(2) || 'N/A';
    const body = `
      <div class="modal-section"><div class="modal-section-title">📝 Description</div><p>${stock.description}</p></div>
      <div class="modal-section"><div class="modal-section-title">📐 Equation</div><div class="modal-eq">${fillFormula(stock.equation)}</div></div>
      <div class="modal-section"><div class="modal-grid">
        <div class="modal-item"><div class="modal-item-label">Unit</div><div class="modal-item-value">${stock.unit}</div></div>
        <div class="modal-item"><div class="modal-item-label">Current</div><div class="modal-item-value">${currentVal}</div></div>
      </div></div>
      <div class="modal-section"><div class="modal-ref">📚 Source: ${stock.source}</div></div>
    `;
    showModal('📦', stock.name, 'Stock Variable', 'stock', body);
  }

  function showPolicyModal(policyId) {
    const policy = Config.getPolicy(policyId);
    if (!policy) return;
    const body = `
      <div class="modal-section"><div class="modal-grid">
        <div class="modal-item"><div class="modal-item-label">Ministry</div><div class="modal-item-value">${policy.ministry}</div></div>
        <div class="modal-item"><div class="modal-item-label">Budget</div><div class="modal-item-value">₹${policy.budget}Cr</div></div>
        <div class="modal-item"><div class="modal-item-label">Coverage</div><div class="modal-item-value">${(policy.coverage * 100).toFixed(0)}%</div></div>
      </div></div>
      <div class="modal-section"><div class="modal-section-title">⚙️ Implementation Mechanism</div><p>${policy.mechanism}</p></div>
      <div class="modal-section"><div class="modal-section-title">🎯 Effects</div><div class="modal-grid">${Object.entries(policy.effects).filter(([k,v]) => v !== 0).map(([k, v]) => `<div class="modal-item"><div class="modal-item-label">${k}</div><div class="modal-item-value ${v > 0 ? 'positive' : 'negative'}">${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%</div></div>`).join('')}</div></div>
      <div class="modal-section"><div class="modal-section-title">⚠️ Limitations</div><ul class="modal-list">${policy.limitations.map(l => `<li>${l}</li>`).join('')}</ul></div>
      <div class="modal-section"><div class="modal-ref">📚 ${policy.source}</div></div>
    `;
    showModal('🏛️', policy.name, 'Government Policy', 'policy', body);
  }

  // ========== MONTE CARLO ==========
  function runMonteCarlo() {
    console.log('runMonteCarlo called');
    const mcStats = document.getElementById('mcStats');
    if (mcStats) mcStats.innerHTML = '<em>Running Monte Carlo simulation...</em>';
    
    // Run with delay to allow UI update
    setTimeout(() => {
      try {
        console.log('Running Simulation.runMonteCarlo...');
        const results = Simulation.runMonteCarlo(100); // FIX R5: Duration auto-matches deterministic sim
        console.log('Monte Carlo results:', results);
        
        // Render histogram
        const canvas = document.getElementById('chartMC');
        if (canvas && results) {
          console.log('Rendering MC chart...');
          Charts.renderMonteCarloChart(canvas, results);
        }
        
        // Update stats display
        if (mcStats && results && results.stats) {
          mcStats.innerHTML = `
            <strong>Escape: ${(results.stats.escapeProb * 100).toFixed(0)}%</strong> | 
            Mean: ₹${Math.round(results.stats.mean).toLocaleString()} | 
            95% CI: [₹${Math.round(results.stats.ci95_low).toLocaleString()} - ₹${Math.round(results.stats.ci95_high).toLocaleString()}]
          `;
          console.log('MC stats updated');
        } else {
          console.warn('Missing mcStats or results:', { mcStats: !!mcStats, results: !!results, stats: results?.stats });
        }
      } catch (e) {
        console.error('Monte Carlo error:', e);
        if (mcStats) mcStats.innerHTML = 'Error running Monte Carlo: ' + e.message;
      }
    }, 50);
  }

  function showComplexityRefsModal() {
    const refs = Config.getComplexityReferences();
    if (!refs) return;
    
    let body = `
      <div class="modal-section">
        <div class="modal-section-title">🎯 ${refs.framework.title}</div>
        <p>${refs.framework.description}</p>
        <div class="modal-ref">${refs.framework.references.map(r => `<div class="ref-entry">• ${r}</div>`).join('')}</div>
      </div>
    `;
    
    refs.layers.forEach(layer => {
      body += `
        <div class="modal-section">
          <div class="modal-section-title">${layer.id}: ${layer.title}</div>
          <p style="font-style:italic; color:#64748b; margin-bottom:8px;">${layer.subtitle}</p>
      `;
      
      layer.mechanisms.forEach(mech => {
        body += `
          <div style="margin-bottom:12px; padding:8px; background:#f8fafc; border-radius:6px; border-left:3px solid ${mech.id.startsWith('T') ? '#f59e0b' : '#3b82f6'};">
            <div style="font-weight:600; font-size:11px; margin-bottom:4px;">${mech.name}</div>
            <div style="font-size:10px; color:#475569; margin-bottom:4px;">${mech.description}</div>
            <div style="font-size:9px; color:#64748b; margin-bottom:4px;">📊 ${mech.indicator}</div>
            <div class="modal-ref" style="font-size:9px;">
              ${mech.references.map(r => `<div class="ref-entry">• ${r}</div>`).join('')}
            </div>
          </div>
        `;
      });
      
      body += `</div>`;
    });
    
    showModal('🧬', 'Complexity Layer — Academic References', 'Framework Documentation', 'dim', body);
  }

  function showAboutModal() {
    const body = `
      <div class="modal-section">
        <div class="modal-section-title">What this is</div>
        <p>CPAF v6 is a complexity-based policy simulation that couples seven analytical dimensions — graph/network theory, attractor analysis, the Narrative Policy Framework, system dynamics, spatiotemporal analysis, agent-based modelling, and Monte Carlo simulation — into one model of how craft-sector policy plays out over time. It is a research instrument for structured reasoning, not a calibrated forecaster: it is built to show how mechanisms interact, not to predict specific numbers.</p>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">How to read the numbers</div>
        <p>The grounding of the model's parameters is uneven, and this is stated plainly rather than implying a uniform empirical base. Across the model's parameters, roughly <b>3% are empirical, 9% mechanism-grounded, 27% literature-grounded, and 61% are declared modelling assumptions</b>. "Assumption" here means a declared, adjustable modelling choice — a plausible value and, often, a theory-based equation form — not invented or fabricated data. Every assumption is visible and can be changed in the admin panel, and the outputs are only as strong as those choices. That is why results are reported as reliability and ranges rather than single point predictions.</p>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">The four tiers</div>
        <p><b>Empirical</b> — drawn from a documented measurement or dataset (for example, each case's population and income figures, from their cited sources).<br>
        <b>Mechanism-grounded</b> — the form follows from an accounting identity or definitional relationship (for example, production capacity computed from population, skills, and infrastructure).<br>
        <b>Literature-grounded</b> — the relationship and its direction are supported by published research, while the exact value is a reasoned quantification (for example, the middlemen-extraction effect, grounded in Wilkinson-Weber 1999 and Liebl &amp; Roy 2003).<br>
        <b>Assumption</b> — a declared, adjustable starting value or equation form chosen for plausibility and theoretical fit, with no measurement behind the specific number.</p>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">What is posited versus what emerges</div>
        <p>Some behaviours are built into the model by construction; others arise from the interaction of its parts. Keeping these apart is essential to reading the results honestly.</p>
        <p><b>Posited by construction (assumed, not findings):</b> that a low-income poverty trap exists and is self-reinforcing; that coordination decays under institutional friction; that an income threshold separates the trap from growth. These are design choices encoded in the equations.</p>
        <p><b>Emergent (produced by the model, not hard-coded):</b> whether and when a case escapes the trap; that very different policy combinations can reach similar outcomes; that the composition of a policy portfolio — and the order in which policies mature — matters more than the number of instruments; and where in a run the cross-dimensional tensions actually bite. These are the model's outputs, not its assumptions.</p>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">How the pieces fit together</div>
        <p>The seven dimensions are not run side by side — they are coupled at runtime, so each feeds the others: coordination scales the effect of every policy, the system's state (trap or growth) modifies the stock-and-flow dynamics, and inequality erodes coordination. On top of these couplings sits a complexity layer — seven cross-dimensional tensions (for example, market versus heritage, coordination friction, brain drain) together with the reinforcing and balancing feedback loops. Sequencing matters too: through policy prerequisites, a policy is more effective when an enabling policy is already mature, and weaker without it, so the order in which policies mature — not just their presence — shapes the outcome. Together these are the parts that produce the emergent behaviour above.</p>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Three worked examples</div>
        <p><b>The trap (posited).</b> Below the income threshold, exit pressure is high and entry low — the system is designed to pull downward. A no-policy run that declines toward the floor confirms the assumption is wired correctly; it is not a discovery.</p>
        <p><b>Coordination collapse (emergent).</b> Coordination is not scripted to fall. It falls because each added policy raises institutional friction faster than the policies add capacity. The downward path, and where it settles, emerge from that interaction.</p>
        <p><b>The threshold (posited boundary, emergent crossing).</b> The income level separating trap from growth is set by design, but whether and when a given policy mix carries a case across it is produced by the run.</p>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Authorship</div>
        <p>The model's patterns are drawn from theory and written as equations by design — they are constructed, not discovered in data. The framework, the choice of dimensions and mechanisms, and the judgement throughout are the author's. AI assistance was used to help translate that design into code, implement it, and test it. Responsibility for the model and its claims rests with the author.</p>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Validation scope</div>
        <p>These are the subset of the Barlas, Forrester–Senge, Sargent and Saltelli tests that suit a theory-driven structural model with illustrative parameters. Tests requiring empirical time-series, statistical fit to historical data, or predictive accuracy are deliberately excluded — the model is a structured-reasoning tool, not an empirically-calibrated forecaster, and its effect sizes are illustrative. What is validated is the soundness and transferability of the structure and the qualitative reproduction of a real sector's patterns — not the numerical prediction of outcomes.</p>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Method references</div>
        <p style="font-size:12px;line-height:1.6">Network (D1): Provan &amp; Milward (2001); Granovetter (1973). Attractor (D2): Meadows (2008); Azariadis &amp; Stachurski (2005); Scheffer et al. (2001). Narrative (D3): Jones &amp; McBeth (2010); Sabatier (1988). System dynamics (D4): Sterman (2000); Forrester (1961). Spatiotemporal (D5): Anselin (1988); Tobler (1970). Agent-based (D6): Epstein &amp; Axtell (1996); Schelling (1971). Monte Carlo (D7): Saltelli et al. (2008); Metropolis &amp; Ulam (1949). Validation standard: Barlas (1996).</p>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Copyright</div>
        <p>© 2026 Bilel Abboudi<br>
        <span style="font-style:italic;font-size:0.92em">CPAF v6 — an elaborated implementation extending the original framework developed in the author's thesis.</span><br>
        <span style="font-size:0.92em">Abboudi, B. (2026). <i>Modelling Policy Complexity: A Novel Computational Framework for Analysing Multi-Ministry Coordination in India's Handicrafts Sector</i> (Master of Arts in Public Policy thesis). O.P. Jindal Global University.</span></p>
      </div>
    `;
    showModal('\u2139\ufe0f', 'About this model', 'Provenance & method', 'dim', body);
  }

  // Public API
  // ===== Bifurcation & bistability explainer (case-aware, computed from the engine, not hardcoded) =====
  let _bifCards = null;
  function precomputeBifurcationCards() {
    try {
      const CH = ['ECOMMERCE', 'MARKETING_SUPPORT', 'GI_REGISTRATION'];
      const coopSets = [[], ['SFURTI'], ['SFURTI', 'CLUSTER_DEV'], ['SFURTI', 'CLUSTER_DEV', 'TIES']];
      const labels = ['0 cluster', '1 cluster', '2 cluster', '3 cluster'];
      const out = {};
      ['chikankari', 'cheriyal'].forEach(cs => {
        out[cs] = coopSets.map((coop, i) => {
          Simulation.setSeed(1); Simulation.initState(cs);
          const st0 = Simulation.getState();
          if (st0.activePolicies && st0.activePolicies.clear) st0.activePolicies.clear();
          [...coop, ...CH].forEach(p => Simulation.togglePolicy(p));
          for (let m = 0; m < 240; m++) Simulation.step(false);
          const st = Simulation.getState();
          return { label: labels[i], coop: +st.coordination.toFixed(2), state: st.attractorState, income: Math.round(st.income), mid: +st.middlemen.toFixed(2) };
        });
      });
      _bifCards = out;
    } catch (e) { _bifCards = null; }
  }

  function _bifCardSVG(card, isHere) {
    const c = Math.max(0, Math.min(1, (card.coop - 0.3) / 0.6)); // co-op 0.3..0.9 -> 0..1
    const trapY = 48 + 30 * (1 - c);   // left (trap) valley bottom — deeper when co-op low
    const growY = 48 + 30 * c;         // right (growth) valley bottom — deeper when co-op high
    const isTrap = card.state === 'TRAP';
    const col = isTrap ? '#dc2626' : card.state === 'GROWTH' ? '#16a34a' : '#f59e0b';
    const ballX = isTrap ? 42 : 108, ballY = (isTrap ? trapY : growY) - 7;
    const path = `M8,38 Q42,${trapY} 75,44 Q108,${growY} 142,38`;
    return `<svg viewBox="0 0 150 96" width="100%" height="86" preserveAspectRatio="xMidYMid meet">
      <path d="${path} L142,90 L8,90 Z" fill="#eef2f7" stroke="#cbd5e1" stroke-width="1"/>
      <path d="${path}" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
      <line x1="75" y1="24" x2="75" y2="90" stroke="#f59e0b" stroke-width="1" stroke-dasharray="3 3"/>
      <circle cx="${ballX}" cy="${ballY}" r="6.5" fill="${col}" stroke="#fff" stroke-width="1.5"/>
    </svg>`;
  }

  function renderBifurcationExplainer() {
    const body = document.getElementById('bifExplainerBody');
    if (!body) return;
    if (!_bifCards) precomputeBifurcationCards();
    const S = Simulation.getState();
    const cs = S.caseStudy;
    const cards = _bifCards && _bifCards[cs];
    let html = '';

    if (cs === 'cheriyal') {
      html += `<div style="font-size:12px;color:#334155;line-height:1.5;margin-bottom:8px">
        <b>Cheriyal is not monopsony-trapped</b>, so it has no deep second basin. Its middleman starts near zero
        (~0.05), so there is nothing to break — the craft escapes on <i>either</i> lever, not an AND-gate.</div>
        <div style="display:flex;gap:10px;font-size:11px">
          <div style="flex:1;background:#dcfce7;border:1px solid #86efac;border-radius:6px;padding:8px">Co-op only → <b>GROWTH</b></div>
          <div style="flex:1;background:#dcfce7;border:1px solid #86efac;border-radius:6px;padding:8px">Channel only → <b>GROWTH</b></div>
          <div style="flex:1;background:#dcfce7;border:1px solid #86efac;border-radius:6px;padding:8px">Both → <b>GROWTH</b></div>
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:8px"><b>Why it matters:</b> the same intervention logic produces a
        different basin structure by craft — the trap is a property of the craft's market, not a universal law.</div>`;
    } else if (cards) {
      const live = S.coordination;
      // nearest card to the live co-op → "you are here"
      let hereIdx = 0, best = 1e9;
      cards.forEach((cd, i) => { const d = Math.abs(cd.coop - live); if (d < best) { best = d; hereIdx = i; } });
      html += `<div style="font-size:12px;color:#334155;line-height:1.5;margin-bottom:10px">
        The craft doesn't change — <b>the landscape does</b>. As cluster investment builds the <b>artisan co-op</b>
        past critical mass (at full channel), the trap valley fills in and the growth valley opens.</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">`;
      cards.forEach((cd, i) => {
        const here = i === hereIdx;
        const badge = cd.state === 'TRAP' ? '#dc2626' : cd.state === 'GROWTH' ? '#16a34a' : '#f59e0b';
        html += `<div style="border:2px solid ${here ? '#1e40af' : '#e2e8f0'};border-radius:8px;padding:6px;background:${here ? '#eff6ff' : '#fff'}">
          ${_bifCardSVG(cd, here)}
          <div style="font-size:10px;font-weight:700;color:#0f172a;margin-top:2px">${cd.label}</div>
          <div style="font-size:10px;color:#475569">co-op ${cd.coop.toFixed(2)}</div>
          <div style="font-size:9.5px;font-weight:700;color:${badge}">${cd.state} · ₹${cd.income.toLocaleString()}</div>
          ${here ? '<div style="font-size:9px;font-weight:700;color:#1e40af;margin-top:2px">◀ you are here</div>' : ''}
        </div>`;
      });
      html += `</div>
        <div style="font-size:11px;color:#64748b;margin-top:10px"><b>The ridge moves with channel access:</b> these cards hold
        the channel at full. With a weaker channel the tipping co-op sits higher; with <i>no</i> channel there is no growth
        basin at all (the AND-gate — co-op × channel).</div>`;
    } else {
      html = '<div style="font-size:12px;color:#64748b">Explainer data unavailable.</div>';
    }
    html += `<div style="font-size:10px;color:#94a3b8;font-style:italic;margin-top:8px;border-top:1px solid #e2e8f0;padding-top:6px">
      These profiles illustrate the mechanism (fold / saddle-node bifurcation; Scheffer 2009 on critical transitions).
      The model computes trajectories and thresholds, not a literal energy surface.</div>`;
    body.innerHTML = html;
  }

  function showBifurcationExplainer() {
    const panel = document.getElementById('bifExplainerPanel');
    if (!panel) return;
    const open = panel.style.display !== 'none';
    if (open) { panel.style.display = 'none'; return; }
    renderBifurcationExplainer();
    panel.style.display = 'block';
  }

  return {
    init,
    toggleSim,
    resetSim,
    switchCaseStudy,
    togglePolicy,
    loadScenario,
    showDimModal,
    showLoopModal,
    showStockModal,
    showPolicyModal,
    showCouplingModal,
    showComplexityRefsModal,
    showAboutModal,
    showSecondaryLinkModal,
    closeModal,
    updateUI,
    updatePolicyFeasibility,
    updateCLD,
    updateEventLog,
    renderPoliciesList,
    renderPolicyMatrix,
    showBifurcationExplainer,
    filterLog,
    runMonteCarlo
  };
})();

// Event log helper for use by other modules
const EventLog = {
  export: () => Export.exportEventLog()
};

// FIX #47/48: 3D visualization mode switcher
function set3DMode(mode) {
  if (typeof Attractor3D === 'undefined' || !Attractor3D.setMode) return;
  const S = Simulation.getState();
  const policyIntensity = S.activePolicies ? S.activePolicies.size / 5 : 0; // Normalize 0-5 policies
  Attractor3D.setMode(mode, S, policyIntensity);
  // Update button active states
  document.querySelectorAll('.attractor-controls .btn-small').forEach(btn => btn.classList.remove('active'));
  const btnId = mode === 'trajectory' ? 'btn3dTrajectory' : mode === 'landscape' ? 'btn3dLandscape' : 'btn3dBifurcation';
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('active');
}
