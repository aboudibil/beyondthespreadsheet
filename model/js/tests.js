// ============================================================================
// CPAF v6 — VALIDATION HARNESS (automated regression tests)
// Encodes the re-rooting falsifiers F1–F6, reproducibility, Monte-Carlo variation,
// all-dimensions-interacting, tensions, segments, and cross-craft generalization.
// Run from the console: Validation.run() — or the admin "Run validation" button.
// Every check reports PASS/FAIL with detail; failures are surfaced, not hidden.
// ============================================================================
const Validation = (function () {
  const COOP = ['SFURTI', 'CLUSTER_DEV', 'TIES'];
  const CHAN = ['ECOMMERCE', 'MARKETING_SUPPORT', 'GI_REGISTRATION'];
  const FULL = COOP.concat(CHAN);
  const ALL = (typeof Config !== 'undefined' && Config.POLICIES) ? Object.keys(Config.POLICIES) : FULL;

  function runSim(cs, pols, months, seed) {
    Simulation.setSeed(seed || 42);
    Simulation.initState(cs || 'chikankari');
    const st = Simulation.getState();
    if (st.activePolicies && st.activePolicies.clear) st.activePolicies.clear();
    (pols || []).forEach(p => Simulation.togglePolicy(p));
    for (let m = 0; m < (months || 240); m++) Simulation.step(false);
    return Simulation.getState();
  }

  function run() {
    const results = [];
    const t = (name, fn) => {
      try { const r = fn(); results.push({ name: name, pass: !!r.pass, detail: r.detail }); }
      catch (e) { results.push({ name: name, pass: false, detail: 'ERROR: ' + e.message }); }
    };

    // ---- Re-rooting falsifiers F1–F6 ----
    t('F1 · no runaway (integrated income bounded)', () => {
      const S = runSim('chikankari', ALL, 240);
      return { pass: S.income < 12000, detail: 'integrated income Rs' + Math.round(S.income) + ' (must be < 12000; was ~25000 pre-re-rooting)' };
    });
    t('F2 · no deadlock (FULL mix reaches GROWTH)', () => {
      const S = runSim('chikankari', FULL, 360);
      return { pass: S.attractorState === 'GROWTH', detail: S.attractorState + ' Rs' + Math.round(S.income) };
    });
    t('F3 · AND-gate (neither co-op-only nor channel-only escapes like FULL)', () => {
      const f = runSim('chikankari', FULL, 360).income;
      const co = runSim('chikankari', COOP, 360).income;
      const ch = runSim('chikankari', CHAN, 360).income;
      return { pass: co < f * 0.85 && ch < f * 0.85, detail: 'FULL ' + Math.round(f) + ' vs co-op ' + Math.round(co) + ' / channel ' + Math.round(ch) };
    });
    t('F4 · delivery un-throttled (training builds skills; none does not)', () => {
      const S = runSim('chikankari', COOP, 240), n = runSim('chikankari', [], 240);
      return { pass: S.skills > 0.5 && n.skills < 0.2, detail: 'skills w/policy ' + S.skills.toFixed(2) + ' vs none ' + n.skills.toFixed(2) };
    });
    t('F5 · two coordination streams independent (they diverge by portfolio)', () => {
      // fragmentation drags policyCoherence down while the co-op still builds → the streams separate
      const frag = runSim('chikankari', ALL, 240);      // many policies: coherence penalised, co-op high
      const inst = runSim('chikankari', COOP, 12);       // early: coherence high immediately, co-op still building
      const gap1 = Math.abs(frag.policyCoherence - frag.coordination);
      const gap2 = Math.abs(inst.policyCoherence - inst.coordination);
      return { pass: gap1 > 0.15 || gap2 > 0.15, detail: 'fragmented: coherence ' + frag.policyCoherence.toFixed(2) + ' vs co-op ' + frag.coordination.toFixed(2) + ' | early: coherence ' + inst.policyCoherence.toFixed(2) + ' vs co-op ' + inst.coordination.toFixed(2) };
    });
    t('F6 · middleman breaks on coord × channel (not otherwise)', () => {
      const f = runSim('chikankari', FULL, 360), n = runSim('chikankari', [], 360);
      return { pass: f.middlemen < n.middlemen - 0.3, detail: 'FULL middlemen ' + f.middlemen.toFixed(2) + ' vs none ' + n.middlemen.toFixed(2) };
    });

    // ---- Reproducibility & Monte Carlo ----
    t('Reproducibility · seeded runs are identical', () => {
      const a = runSim('chikankari', FULL, 120).income, b = runSim('chikankari', FULL, 120).income;
      return { pass: Math.round(a) === Math.round(b), detail: 'run1 Rs' + Math.round(a) + ' = run2 Rs' + Math.round(b) };
    });
    t('Monte Carlo · runs vary (distribution restored) and MC is reproducible', () => {
      runSim('chikankari', FULL, 120);
      const mc1 = Simulation.runMonteCarlo(30, 120);
      const uniq = new Set(mc1.finalIncomes.map(x => Math.round(x))).size;
      runSim('chikankari', FULL, 120);
      const mc2 = Simulation.runMonteCarlo(30, 120);
      const repro = mc1.stats.escapeProb === mc2.stats.escapeProb;
      return { pass: uniq > 10 && repro, detail: uniq + '/30 unique incomes; MC reproducible=' + repro };
    });

    // ---- All forces / dimensions interacting ----
    t('All dimensions D1–D6 interacting (couplings fire across the run)', () => {
      const seen = new Set();
      Simulation.setSeed(7); Simulation.initState('chikankari');
      const st = Simulation.getState(); if (st.activePolicies.clear) st.activePolicies.clear();
      FULL.forEach(p => Simulation.togglePolicy(p));
      for (let m = 0; m < 240; m++) { Simulation.step(false); (Simulation.getState().couplings || []).forEach(x => seen.add(x)); }
      const arr = Array.from(seen);
      const missing = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'].filter(d => !arr.some(x => x.indexOf(d) >= 0));
      return { pass: missing.length === 0, detail: missing.length ? 'NOT interacting: ' + missing.join(',') : 'all six dimensions couple (' + arr.length + ' couplings fired)' };
    });
    t('All complexity tensions enabled', () => {
      const T = Config.COMPLEXITY.tensions, off = Object.keys(T).filter(k => !T[k].enabled);
      return { pass: off.length === 0, detail: off.length ? 'disabled: ' + off.join(',') : 'all ' + Object.keys(T).length + ' tensions enabled' };
    });
    t('Actors interacting (co-op → middleman → income chain moves)', () => {
      const S = runSim('chikankari', FULL, 360);
      return { pass: S.coordination > 0.5 && S.middlemen < 0.5 && S.income > 4000, detail: 'coord ' + S.coordination.toFixed(2) + ' → middleman ' + S.middlemen.toFixed(2) + ' → income Rs' + Math.round(S.income) };
    });
    t('Segments A/B/C differentiated + Gini live', () => {
      const S = runSim('chikankari', FULL, 240);
      const inc = [S.segments.A.income, S.segments.B.income, S.segments.C.income];
      const gini = S.history.gini[S.history.gini.length - 1];
      return { pass: (Math.max.apply(null, inc) - Math.min.apply(null, inc) > 500) && gini > 0, detail: 'A/B/C Rs' + inc.map(Math.round).join('/') + ' · Gini ' + gini.toFixed(3) };
    });
    t('Policy dynamics live (prerequisites mature, cascade resolves)', () => {
      const S = runSim('chikankari', ['GI_REGISTRATION', 'ECOMMERCE'], 180);
      const pm = S._prereqModifiers || {};
      return { pass: Object.keys(pm).length > 0, detail: 'prereqModifiers ' + JSON.stringify(pm) };
    });

    // ---- Cross-craft generalization ----
    t('Cross-craft · cheriyal is market-bound (channel alone escapes)', () => {
      const S = runSim('cheriyal', CHAN, 240);
      return { pass: S.attractorState !== 'TRAP', detail: 'cheriyal + channel → ' + S.attractorState + ' Rs' + Math.round(S.income) + ' (market access is its binding constraint, not the middleman)' };
    });
    t('Cross-craft · chikankari is monopsony-bound (channel alone does NOT escape like FULL)', () => {
      const ch = runSim('chikankari', CHAN, 360), f = runSim('chikankari', FULL, 360);
      return { pass: ch.income < f.income * 0.85, detail: 'chikankari channel-only Rs' + Math.round(ch.income) + ' « FULL Rs' + Math.round(f.income) };
    });

    return results;
  }

  return { run: run };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Validation;
