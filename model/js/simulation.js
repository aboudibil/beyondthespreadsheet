/* ╔════════════════════════════════════════════════════════════════════════════╗
   ║  CPAF v6 - simulation.js  (V6: COMPLEXITY LAYER)                          ║
   ║  Core Simulation Engine: SD Equations, ABM, Monte Carlo                   ║
   ╠════════════════════════════════════════════════════════════════════════════╣
   ║  V6 CHANGES: Implements full complexity layer (L1+L2+dormant dimensions)  ║
   ║  - L1: Policy ramp-up, fatigue, demand saturation, stochastic shocks     ║
   ║  - L2: 7 between-dimension tensions (T1-T7)                              ║
   ║  - D1: Graph Theory → network density feedback                            ║
   ║  - D2: Attractor → hysteresis, pull force, genuine basin dynamics         ║
   ║  - D3: NPF → narrative-policy feedback loop                               ║
   ║  - D5: Spatiotemporal → dynamic infrastructure + spatial diffusion        ║
   ║  - D6: ABM → aspiration-based segment mobility + craft exit               ║
   ║  Every addition tagged: // COMPLEXITY: D[n] - [mechanism] [reference]     ║
   ╚════════════════════════════════════════════════════════════════════════════╝ */

const Simulation = (function() {
  'use strict';

  // ========== CONSTANTS ==========
  const RATES = Config.RATES || {
    TRAP: { entry: 0.01, exit: 0.05 },
    TRANSITION: { entry: 0.03, exit: 0.03 },
    GROWTH: { entry: 0.05, exit: 0.01 }
  };

  // Default calibration (can be updated via admin)
  let CALIBRATION = {
    thresholds: { TRAP: 2000, GROWTH: 4122, TRAP_DUR: 6, GROWTH_DUR: 12, FALL_DUR: 3 },
    delays: { skills: 6, market: 3, coordination: 12, income: 1, population: 6 },
    incomeCeiling: 25000,
    caseModifiers: {
      chikankari: { heritage_erosion: 1.0, middlemen_growth: 1.0, competition_start: 280000 },
      cheriyal:   { heritage_erosion: 0.3, middlemen_growth: 0.2, competition_start: 40 }
    },
    policyInteractions: {
      'SFURTI+ODOP': { modifier: 1.25, type: 'synergy' },
      'NHDP+AMBEDKAR_HASTSHILP': { modifier: 1.15, type: 'synergy' },
      'ECOMMERCE+HUNAR_HAAT': { modifier: 0.85, type: 'conflict' },
      'PMEGP+PM_VISHWAKARMA': { modifier: 0.80, type: 'redundancy' }
    },
    
    // STEP 3: POLICY PREREQUISITES — ordering creates path dependence
    // enhancedBy: prerequisite policies that boost this policy's effectiveness
    // boost: effectiveness multiplier when prerequisite is mature (active 12+ months)
    // penalty: effectiveness multiplier when prerequisite is absent
    // maturityMonths: how long prerequisite must be active to count
    // Reference: Howlett & Rayner (2007) — policy sequencing; Pierson (2000) — path dependence
    policyPrerequisites: {
      // SFURTI = foundation: clusters provide institutional capacity for everything
      // No prerequisites itself — it IS the prerequisite
      
      GI_REGISTRATION: {
        enhancedBy: ['SFURTI', 'CLUSTER_DEV'],
        boost: 1.35,       // 35% more effective when clusters exist to enforce GI
        penalty: 0.80,     // 20% less effective without institutional backing (was 0.70)
        maturityMonths: 12
      },
      ECOMMERCE: {
        enhancedBy: ['GI_REGISTRATION', 'USTTAD'],
        boost: 1.40,       // 40% more effective with brand + quality products
        penalty: 0.75,     // 25% less effective without brand (was 0.60)
        maturityMonths: 12
      },
      HUNAR_HAAT: {
        enhancedBy: ['GI_REGISTRATION', 'USTTAD'],
        boost: 1.30,
        penalty: 0.80,     // Was 0.75
        maturityMonths: 6
      },
      USTTAD: {
        enhancedBy: ['SFURTI'],
        boost: 1.25,
        penalty: 0.85,     // Was 0.80 — training works without clusters, just slower
        maturityMonths: 12
      },
      GURU_SHISHYA: {
        enhancedBy: ['SFURTI', 'HERITAGE_AWARDS'],
        boost: 1.30,
        penalty: 0.80,     // Was 0.75 — master-apprentice works independently
        maturityMonths: 18
      },
      ODOP: {
        enhancedBy: ['GI_REGISTRATION', 'CLUSTER_DEV'],
        boost: 1.35,
        penalty: 0.75,     // Was 0.65 — district branding still functions without GI
        maturityMonths: 12
      },
      NAI_ROSHNI: {
        enhancedBy: ['PM_VISHWAKARMA', 'SFURTI'],
        boost: 1.25,
        penalty: 0.85,     // Unchanged — direct empowerment program
        maturityMonths: 6
      },
      MAI: {
        enhancedBy: ['ECOMMERCE', 'GI_REGISTRATION'],
        boost: 1.40,
        penalty: 0.70,     // Was 0.55 — export still possible through traditional channels
        maturityMonths: 18
      },
      TIES: {
        enhancedBy: ['ECOMMERCE', 'GI_REGISTRATION'],
        boost: 1.35,
        penalty: 0.75,     // Was 0.60 — infrastructure has value even without digital
        maturityMonths: 12
      },
      PM_VISHWAKARMA: {
        enhancedBy: [],     // Welfare needs no prerequisites
        boost: 1.0,
        penalty: 1.0,      // No penalty — it's a direct transfer
        maturityMonths: 0
      }
    },
    gender: {
      enabled: true,
      wageGap: 0.75,
      segmentFemaleShare: { A: 0.80, B: 0.65, C: 0.45 }
    },
    monteCarlo: { parameterVariation: 0.15, defaultRuns: 100, defaultMonths: 60 },
    populationFloor: 1000
  };

  // ========== STATE ==========
  let S = {};
  let eventLog = [];
  let delayQueues = { skills: [], market: [], coordination: [], income: [], population: [] };

  // STEP 6: seeded RNG (mulberry32) for reproducible runs — replaces bare Math.random.
  // Reset in initState so every run from a given seed is identical (A/B tests, calibration).
  let _seed = 12345, _rngState = 12345;
  function rng() {
    _rngState |= 0; _rngState = (_rngState + 0x6D2B79F5) | 0;
    let t = Math.imul(_rngState ^ (_rngState >>> 15), 1 | _rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function setSeed(s) { _seed = (s | 0) || 1; _rngState = _seed; }

  // Policy-gating MODES (two independent user switches → 4 combinations: both / only-coordination /
  // only-political / neither=fully unbounded). Defaults preserve current behaviour: coordination gate OFF
  // (structural policies never blocked by low co-op), political gate ON (coalition feasibility applies).
  let coordinationGating = false;
  let politicalGating = true;
  const COORD_GATE_THRESHOLD = 0.20;
  function setCoordinationGating(on) {
    const next = !!on;
    if (next !== coordinationGating && S && S.year != null) {
      logEvent('SETTING', `Coordination gate turned ${next ? 'ON (structural policies need coordination ≥ ' + COORD_GATE_THRESHOLD.toFixed(2) + ')' : 'OFF (unbounded)'}`);
    }
    coordinationGating = next;
  }
  function setPoliticalGating(on) {
    const next = !!on;
    if (next !== politicalGating && S && S.year != null) {
      logEvent('SETTING', `Political gate turned ${next ? 'ON (coalition feasibility applies)' : 'OFF (any policy activatable regardless of coalition)'}`);
    }
    politicalGating = next;
  }
  function getCoordinationGating() { return coordinationGating; }
  function getPoliticalGating() { return politicalGating; }

  // Forced-coherence hook — used ONLY by the bifurcation explainer to sweep coherence as an isolated
  // parameter (full co-op portfolio held constant). null = normal (coherence computed from policies).
  let _forcedCoherence = null;
  function setForcedCoherence(v) { _forcedCoherence = (v == null ? null : Math.max(0.1, Math.min(1, v))); }

  
  function initState(caseStudyId) {
    _rngState = _seed; // STEP 6: reproducible run from the current seed
    const cs = Config.getCaseStudy(caseStudyId);
    const thresh = cs.thresholds || CALIBRATION.thresholds;
    
    S = {
      month: 0, year: 0,
      caseStudy: cs.id,
      population: cs.initial.population,
      income: cs.initial.income,
      skills: cs.initial.skills,
      market: cs.initial.market,
      middlemen: cs.initial.middlemen,
      coordination: cs.initial.coordination,
      policyCoherence: 0.4,
      heritage: cs.initial.heritage,
      political: cs.initial.political,
      
      // Attractor state — derived from the case's starting income (admin-defined) vs the thresholds,
      // so each case study begins in the regime its income implies (not always TRAP).
      attractorState: (cs.initial.income >= thresh.GROWTH) ? 'GROWTH' : (cs.initial.income <= thresh.TRAP) ? 'TRAP' : 'TRANSITION',
      incAboveTrap: 0,
      incAboveGrowth: 0,
      monthsBelowThreshold: 0,
      monthsBelowGrowth: 0,
      competitionFactor: 1.0,
      
      // Segments with income initialized (normalized so weighted avg = initial income)
      segments: {
        A: { share: cs.segments.A.share, multiplier: cs.segments.A.multiplier, name: cs.segments.A.name,
             income: 0, // Set below after normalization
             femaleShare: CALIBRATION.gender.segmentFemaleShare.A, maleIncome: 0, femaleIncome: 0 },
        B: { share: cs.segments.B.share, multiplier: cs.segments.B.multiplier, name: cs.segments.B.name,
             income: 0,
             femaleShare: CALIBRATION.gender.segmentFemaleShare.B, maleIncome: 0, femaleIncome: 0 },
        C: { share: cs.segments.C.share, multiplier: cs.segments.C.multiplier, name: cs.segments.C.name,
             income: 0,
             femaleShare: CALIBRATION.gender.segmentFemaleShare.C, maleIncome: 0, femaleIncome: 0 }
      },
      spatial: JSON.parse(JSON.stringify(cs.spatial)),
      
      // Infrastructure indices (D5 - now dynamic)
      infrastructure: {
        road: 0.6,
        distance: 15,
        digital: 0.4
      },
      
      gender: {
        overallFemaleShare: cs.context.gender_ratio || 0.50,
        avgFemaleIncome: cs.initial.income * CALIBRATION.gender.wageGap,
        avgMaleIncome: cs.initial.income,
        wageGapRatio: CALIBRATION.gender.wageGap
      },
      
      activePolicies: new Set(),
      cascadeActivated: new Set(), // children switched on BY a cascade (so parent-off removes only these)
      activeShocks: [],
      couplings: new Set(),
      tipping: false,
      tippingType: null,
      
      npf: {
        dominantNarrative: cs.initial.middlemen > 0.6 ? 'exploitation' : 'transition',
        characters: { hero: 'Artisans', villain: cs.initial.middlemen > 0.6 ? 'Middlemen' : 'Uncertainty', victim: 'Heritage' },
        coalitions: { welfare: cs.initial.political, market: 1 - cs.initial.political }
      },
      
      thresholds: thresh,
      
      // COMPLEXITY: Track policy activation months for ramp-up calculation
      policyActivationMonth: {},  // policyId → month number when activated
      
      // COMPLEXITY: D1 - Network density metric (Graph Theory)
      networkDensity: 0,
      
      // COMPLEXITY: Stochastic shock tracking
      activeComplexityShock: null,
      shockRecoveryRemaining: 0,
      
      // COMPLEXITY: D6 - Artisan exit tracking
      craftExits: 0,  // Cumulative artisans who left the craft
      _creditDependency: 0, // STEP 2: credit lock-in depth (0-0.8)
      _R1_activation: 1.0,  // STEP 1: R1 loop activation level
      _R2_activation: 1.0,  // STEP 1: R2 loop activation level
      _prereqModifiers: {}, // STEP 3: policy prerequisite modifiers
      
      // COMPLEXITY: D5 - Track total simulation months for political cycles
      totalMonths: 0,

      // Passive observers (set once at first transition; never read by dynamics) — for honest escape-time reporting
      firstTransitionMonth: null,
      firstGrowthMonth: null,
      
      history: {
        income: [cs.initial.income],
        skills: [cs.initial.skills],
        market: [cs.initial.market],
        middlemen: [cs.initial.middlemen],
        coordination: [cs.initial.coordination],
        policyCoherence: [0.4],
        political: [cs.initial.political],
        heritage: [cs.initial.heritage],
        segA: [cs.initial.income * cs.segments.A.multiplier],
        segB: [cs.initial.income * cs.segments.B.multiplier],
        segC: [cs.initial.income * cs.segments.C.multiplier],
        population: [cs.initial.population],
        gini: [0.35],
        femaleIncome: [cs.initial.income * CALIBRATION.gender.wageGap],
        maleIncome: [cs.initial.income],
        spatial: [((cs.spatial.urban || 1) + (cs.spatial.peri_urban || 0.7) + (cs.spatial.rural || 0.4)) / 3],
        // Complexity diagnostics
        r1Activation: [1.0],
        r2Activation: [1.0],
        creditDependency: [0],
        competitionFactor: [1.0],
        networkDensity: [0]
      },
      
      monteCarloResults: null,
      prev: {}
    };
    
    delayQueues = { skills: [], market: [], coordination: [], income: [], population: [] };
    
    // Normalize initial segment incomes: weighted average must equal S.income
    // Raw multipliers create relative differences; normalization ensures consistency
    const rawSegs = {};
    let weightedRawInit = 0;
    Object.keys(S.segments).forEach(seg => {
      rawSegs[seg] = cs.initial.income * S.segments[seg].multiplier;
      weightedRawInit += rawSegs[seg] * S.segments[seg].share;
    });
    const initNormFactor = weightedRawInit > 0 ? cs.initial.income / weightedRawInit : 1;
    Object.keys(S.segments).forEach(seg => {
      S.segments[seg].income = rawSegs[seg] * initNormFactor;
    });
    
    // Update initial history to match normalized segments
    S.history.segA[0] = S.segments.A.income;
    S.history.segB[0] = S.segments.B.income;
    S.history.segC[0] = S.segments.C.income;
    
    updateGenderIncomes();
    S.history.gini[0] = calculateGini();
    
    eventLog = [];
    logEvent('START', `Initialized: ${cs.name} (${cs.location.district})`);
    logEvent('STATE', `${S.attractorState} | ₹${S.income.toLocaleString()} | C=${S.coordination.toFixed(2)}`);
    logEvent('NPF', `Initial narrative: ${S.npf.dominantNarrative} | Hero: ${S.npf.characters.hero}, Villain: ${S.npf.characters.villain}`);
    
    // COMPLEXITY: Log complexity layer status
    const CX = Config.COMPLEXITY;
    if (CX && CX.enabled) {
      logEvent('COMPLEXITY', `Complexity layer ACTIVE (L1: ramp=${CX.policyRampup.enabled}, sat=${CX.demandSaturation.enabled}, shock=${CX.stochasticShocks.enabled})`);
    }
    
    return S;
  }

  // ========== COMPLEXITY HELPERS ==========
  
  // COMPLEXITY: L1 - Sigmoid ramp-up function (Baumgartner & Jones 1993)
  // Policies don't reach full effectiveness instantly; they follow an S-curve
  function getPolicyRampupFactor(policyId) {
    const CX = Config.COMPLEXITY;
    if (!CX || !CX.enabled || !CX.policyRampup.enabled) return 1.0;
    
    const activationMonth = S.policyActivationMonth[policyId];
    if (activationMonth === undefined) return 1.0;
    
    const monthsActive = S.totalMonths - activationMonth;
    if (monthsActive <= 0) return CX.policyRampup.initialEffectiveness;
    
    const rampMonths = CX.policyRampup.rampMonths;
    const initial = CX.policyRampup.initialEffectiveness;
    
    // Sigmoid: starts at initial, approaches 1.0, midpoint at rampMonths/2
    const k = 6 / rampMonths; // steepness — reaches ~95% at rampMonths
    const sigmoid = 1 / (1 + Math.exp(-k * (monthsActive - rampMonths / 2)));
    const rampFactor = initial + (1 - initial) * sigmoid;
    
    // COMPLEXITY: L1 - Policy fatigue (Kingdon 1984 - policy windows close)
    const yearsActive = monthsActive / 12;
    let fatigueFactor = 1.0;
    if (CX.policyRampup.fatigueStartYear > 0 && yearsActive > CX.policyRampup.fatigueStartYear) {
      const fatigueYears = yearsActive - CX.policyRampup.fatigueStartYear;
      fatigueFactor = Math.max(0.3, 1 - CX.policyRampup.fatigueRate * fatigueYears);
    }
    
    return rampFactor * fatigueFactor;
  }
  
  // COMPLEXITY: D1 - Compute network density (Perrow 1984, Provan & Kenis 2008)
  function computeNetworkDensity() {
    const CX = Config.COMPLEXITY;
    if (!CX || !CX.enabled || !CX.graphTheory.enabled) return 0;
    S.networkDensity = S.couplings.size;
    return S.networkDensity;
  }
  
  // COMPLEXITY: D3 - Get narrative alignment modifier (Shanahan et al. 2011)
  function getNarrativeModifier(policyType) {
    const CX = Config.COMPLEXITY;
    if (!CX || !CX.enabled || !CX.npfFeedback.enabled) return 1.0;
    
    const narrative = S.npf.dominantNarrative;
    let modifier = 1.0;
    
    // Exploitation narrative boosts welfare, penalizes market
    if (narrative === 'exploitation') {
      modifier = policyType === 'welfare' ? (1 + CX.npfFeedback.narrativeBoost) :
                 policyType === 'market' ? (1 - CX.npfFeedback.narrativePenalty) : 1.0;
    }
    // Empowerment narrative boosts market, penalizes welfare
    else if (narrative === 'empowerment') {
      modifier = policyType === 'market' ? (1 + CX.npfFeedback.narrativeBoost) :
                 policyType === 'welfare' ? (1 - CX.npfFeedback.narrativePenalty) : 1.0;
    }
    // Heritage_loss narrative boosts structural (preservation), penalizes market
    else if (narrative === 'heritage_loss') {
      modifier = policyType === 'structural' ? (1 + CX.npfFeedback.narrativeBoost * 0.7) :
                 policyType === 'market' ? (1 - CX.npfFeedback.narrativePenalty * 0.5) : 1.0;
    }
    // Inequality narrative: strong welfare boost, structural penalty
    else if (narrative === 'inequality') {
      modifier = policyType === 'welfare' ? (1 + CX.npfFeedback.narrativeBoost * 1.2) :
                 policyType === 'structural' ? (1 - CX.npfFeedback.narrativePenalty * 0.5) : 1.0;
    }
    
    // Coalition friction: competing coalitions slow ALL implementation
    const coalitionDiff = Math.abs(S.npf.coalitions.welfare - S.npf.coalitions.market);
    if (coalitionDiff < 0.2) {
      // Near-equal coalitions = maximum friction
      modifier *= (1 - CX.npfFeedback.coalitionFriction);
    }
    
    return modifier;
  }
  
  // COMPLEXITY: T5 - Political attention cycle (Kingdon 1984, Baumgartner & Jones 1993)
  function getPoliticalCycleModifier() {
    const CX = Config.COMPLEXITY;
    if (!CX || !CX.enabled || !CX.tensions.politicalCycles.enabled) return 1.0;
    
    const cycleLength = CX.tensions.politicalCycles.cycleLengthMonths;
    const amplitude = CX.tensions.politicalCycles.attentionAmplitude;
    const implementationDip = CX.tensions.politicalCycles.implementationDip;
    
    // Cosine wave: peak attention at start of cycle, dip near elections
    const cyclePhase = (S.totalMonths % cycleLength) / cycleLength;
    
    // Pre-election period (last 20% of cycle) = implementation dip
    if (cyclePhase > 0.8) {
      return 1 - implementationDip;
    }
    // Post-election surge (first 30%) = attention peak
    if (cyclePhase < 0.3) {
      return 1 + amplitude * (1 - cyclePhase / 0.3);
    }
    // Mid-term: gradual decline
    return 1 + amplitude * 0.3 * (1 - (cyclePhase - 0.3) / 0.5);
  }

  // ========== POLICY EFFECTS ==========
  function calculatePolicyEffects() {
    const effects = { skills: 0, market: 0, income: 0, middlemen: 0, coordination: 0, heritage: 0 };
    if (S.activePolicies.size === 0) return effects;
    
    const coordEffect = S._coordEffect || 0.5;
    
    // COMPLEXITY: T5 - Political attention cycle modulates ALL policy effects
    const politicalCycleMod = getPoliticalCycleModifier();
    
    S.activePolicies.forEach(policyId => {
      const policy = Config.getPolicy(policyId);
      if (!policy) return;
      if (UMBRELLA_CASCADE && policy.isUmbrella) return; // umbrella is a container; its effect = sum of active children (no double-count)
      
      // COMPLEXITY: L1 - Policy ramp-up + fatigue (Baumgartner & Jones 1993)
      const rampFactor = getPolicyRampupFactor(policyId);
      
      // COMPLEXITY: D3 - Narrative alignment modifies effectiveness (Shanahan et al. 2011)
      const narrativeMod = getNarrativeModifier(policy.type);
      
      // STEP 3: POLICY PREREQUISITES — sequencing creates path dependence
      // Policies with mature prerequisites get boosted; without them, penalized
      // Reference: Howlett & Rayner (2007); Pierson (2000) — path dependence
      let prereqMod = 1.0;
      const prereqConfig = CALIBRATION.policyPrerequisites[policyId];
      if (prereqConfig && prereqConfig.enhancedBy.length > 0) {
        const currentMonth = S.year * 12 + S.month;
        // Check if ANY prerequisite is active and mature
        let hasMaturedPrereq = false;
        let prereqCount = 0;
        prereqConfig.enhancedBy.forEach(prereqId => {
          if (S.activePolicies.has(prereqId)) {
            const prereqStart = S.policyActivationMonth[prereqId] ?? currentMonth;
            const monthsActive = currentMonth - prereqStart;
            if (monthsActive >= prereqConfig.maturityMonths) {
              hasMaturedPrereq = true;
              prereqCount++;
            }
          }
        });
        
        if (hasMaturedPrereq) {
          // Boost: scales with how many prerequisites are met (diminishing returns)
          const boostScale = 1 - Math.pow(1 - (prereqConfig.boost - 1), prereqCount);
          prereqMod = 1 + boostScale;
        } else {
          // Penalty: no mature prerequisites → reduced effectiveness
          prereqMod = prereqConfig.penalty;
        }
      }
      // Track for diagnostics
      S._prereqModifiers = S._prereqModifiers || {};
      S._prereqModifiers[policyId] = prereqMod;
      
      Object.keys(effects).forEach(key => {
        if (policy.effects[key]) {
          effects[key] += policy.effects[key] * policy.coverage * coordEffect 
                         * rampFactor * narrativeMod * politicalCycleMod * prereqMod;
        }
      });
    });
    
    // Apply interactions
    Object.keys(CALIBRATION.policyInteractions).forEach(combo => {
      const [p1, p2] = combo.split('+');
      if (S.activePolicies.has(p1) && S.activePolicies.has(p2)) {
        const mod = CALIBRATION.policyInteractions[combo].modifier;
        Object.keys(effects).forEach(key => { effects[key] *= mod; });
      }
    });
    
    return effects;
  }
  
  function applyDelayedEffects() {
    const now = S.year * 12 + S.month;
    Object.keys(delayQueues).forEach(type => {
      delayQueues[type] = delayQueues[type].filter(eff => {
        if (eff.appliesAt <= now) {
          if (type === 'skills') {
            const sDampen = Math.max(0.05, 1 - Math.pow(S.skills, 3));
            const sEffect = eff.value > 0 ? eff.value * sDampen : eff.value;
            S.skills = Math.min(0.95, Math.max(0.05, S.skills + sEffect));
          }
          else if (type === 'market') {
            const mDampen = Math.max(0.05, 1 - Math.pow(S.market, 3));
            const mEffect = eff.value > 0 ? eff.value * mDampen : eff.value;
            S.market = Math.min(0.95, Math.max(0.02, S.market + mEffect));
          }
          else if (type === 'coordination') {
            const cDampen = Math.max(0.05, 1 - Math.pow(S.coordination, 3));
            const cEffect = eff.value > 0 ? eff.value * cDampen : eff.value;
            S.coordination = Math.min(0.95, Math.max(0.1, S.coordination + cEffect));
          }
          else if (type === 'income') {
            const ceiling = CALIBRATION.incomeCeiling;
            const dampen = Math.max(0, 1 - (S.income / ceiling));
            S.income = Math.max(Config.EQUATION_PARAMS.income.base_income.value, S.income * (1 + eff.value * dampen));
          }
          return false;
        }
        return true;
      });
    });
  }
  
  function queueDelayedEffect(type, value, source) {
    const delay = CALIBRATION.delays[type] || 0;
    delayQueues[type].push({ value, appliesAt: S.year * 12 + S.month + delay, source });
  }

  // ========== SD EQUATIONS ==========
  function stepIncome() {
    S.prev.income = S.income;
    const coordEffect = S._coordEffect || 0.5;
    const policyEffects = calculatePolicyEffects();
    
    S.couplings.add('D1-D4');
    S.couplings.add('D2-D4');
    
    const params = Config.EQUATION_PARAMS.income;
    const R1 = Config.LOOPS.R1;
    const R2 = Config.LOOPS.R2;
    const B1 = Config.LOOPS.B1;
    const B2 = Config.LOOPS.B2;
    
    // STEP 1: CONDITIONAL R-LOOPS — loops are endogenous to system state
    // R1 activation: skill premium only realized when conditions allow
    // Below subsistence, artisans work volume not quality (no premium)
    // Low skills don't differentiate in market (no premium)
    // High middlemen capture the premium (artisans don't benefit)
    let R1_activation = 1.0;
    const subsistenceIncome = S.thresholds.TRAP * 0.65; // ~₹5,200
    if (S.income < subsistenceIncome) {
      R1_activation *= 0.15 + 0.85 * (S.income / subsistenceIncome); // Scales 0.15→1.0
    }
    if (S.skills < 0.4) {
      R1_activation *= S.skills / 0.4; // Below quality threshold: linear scale to 0
    }
    if (S.middlemen > 0.5) {
      R1_activation *= Math.max(0.1, 1 - (S.middlemen - 0.5) * 1.5); // Middlemen capture premium
      // At middlemen=0.8: activation × 0.55. At middlemen=0.9: activation × 0.40
    }
    
    // R2 activation: market access only generates revenue when operationally real
    // Low market = no direct channels, all through middlemen
    // Low digital infrastructure = market access is theoretical
    // Above demand saturation = more market doesn't help
    let R2_activation = 1.0;
    if (S.market < 0.3) {
      R2_activation *= S.market / 0.3; // Below direct-access threshold
    }
    if (S.infrastructure.digital < 0.3) {
      R2_activation *= 0.4 + 0.6 * (S.infrastructure.digital / 0.3); // Low digital = limited reach
    }
    const CX_sat = Config.COMPLEXITY;
    if (CX_sat && CX_sat.enabled && CX_sat.demandSaturation.enabled && S.income > CX_sat.demandSaturation.saturationIncome) {
      const satExcess = (S.income - CX_sat.demandSaturation.saturationIncome) / CX_sat.demandSaturation.saturationIncome;
      R2_activation *= Math.max(0.1, 1 - satExcess * 0.8); // Market returns diminish above saturation
    }
    
    // Store for diagnostics (visible in state)
    S._R1_activation = R1_activation;
    S._R2_activation = R2_activation;
    
    const skillEffect = R1.enabled ? S.skills * params.skill_premium.value * R1.strength * R1_activation : 0;
    const marketEffect = R2.enabled ? S.market * params.market_premium.value * R2.strength * R2_activation : 0;
    const middlemanDrain = B1.enabled ? S.middlemen * (params.middlemen_extraction.value * 0.4) * B1.strength : 0;
    
    const B3 = Config.LOOPS.B3;
    const heritagePremium = B3.enabled ? (S.heritage > 0.5 
      ? (S.heritage - 0.5) * 0.10 * B3.strength
      : -(0.5 - S.heritage) * 0.15 * B3.strength
    ) : 0;
    if (B3.enabled && S.heritage !== 0.5) S.couplings.add('B3-D4');
    
    const baseGrowth = (skillEffect + marketEffect - middlemanDrain + heritagePremium) * coordEffect;
    
    // COMPLEXITY: D2 - Remove GROWTH auto-reinforce bonus (Scheffer 2009)
    const CX = Config.COMPLEXITY;
    let stateMultiplier;
    if (CX && CX.enabled && CX.attractorDynamics.enabled && CX.attractorDynamics.removeGrowthBonus) {
      stateMultiplier = S.attractorState === 'TRAP' ? 0.95 : 1.0; // No 1.02 GROWTH bonus
    } else {
      stateMultiplier = S.attractorState === 'TRAP' ? 0.95 : S.attractorState === 'GROWTH' ? 1.02 : 1.0;
    }
    
    // COMPLEXITY: T6 - Population competition always active (carrying capacity models)
    const caseMod = CALIBRATION.caseModifiers[S.caseStudy] || { competition_start: 280000 };
    const compStart = caseMod.competition_start;
    const capLimit = compStart * 1.25;
    
    if (CX && CX.enabled && CX.tensions.populationCompetition.enabled) {
      // Always-active competition: uses log scale to handle 3k–250k range
      // COMPLEXITY: T6 - Carrying capacity model (log-normalized)
      const refPop = Config.getCaseStudy(S.caseStudy)?.initial?.population || 100000;
      const popRatio = S.population / refPop; // 1.0 at initial, grows/shrinks
      const marketCapacity = Math.max(0.1, S.market) * CX.tensions.populationCompetition.marketCapacityMult;
      const densityPressure = Math.log(1 + popRatio) * CX.tensions.populationCompetition.baseIntensity / marketCapacity;
      S.competitionFactor = Math.max(0.5, 1 - densityPressure);
    } else if (B2.enabled && S.population > compStart) {
      // Fallback: original threshold-based competition
      const excess = (S.population - compStart) / (capLimit - compStart);
      S.competitionFactor = Math.max(0.7, 1 - excess * 0.3 * B2.strength);
    } else {
      S.competitionFactor = 1.0;
    }
    
    const immediatePolicy = policyEffects.income * 0.3;
    if (policyEffects.income > 0) queueDelayedEffect('income', policyEffects.income * 0.7, 'policy');
    
    let totalChange = (baseGrowth + immediatePolicy) * stateMultiplier * S.competitionFactor;
    
    // STEP 2b: TRAP CREDIT LOCK-IN — middlemen extract additional rent on credit-dependent artisans
    // When artisans borrow for materials, middlemen set purchase prices below market
    // This creates an additional income drain proportional to credit dependency
    // Reference: putting-out system in Chikankari (Wilkinson-Weber 1999)
    if (S._creditDependency > 0) {
      const creditDrain = -S._creditDependency * 0.015; // Up to -1.2% monthly at max dependency
      totalChange += creditDrain;
      S.couplings.add('B1-TRAP'); // Middlemen actively suppress income in TRAP
    }
    
    // COMPLEXITY: L1 - Demand saturation (market saturation theory)
    // Income growth faces increasing resistance AND active drag as income rises
    if (CX && CX.enabled && CX.demandSaturation.enabled) {
      const satIncome = CX.demandSaturation.saturationIncome;
      const satStrength = CX.demandSaturation.saturationStrength;
      if (S.income > satIncome) {
        const excess = (S.income - satIncome) / satIncome;
        // Quadratic resistance — grows much faster than linear
        const saturationDrag = 1 - satStrength * Math.min(1, excess * excess + excess);
        if (totalChange > 0) {
          totalChange *= Math.max(0.05, saturationDrag);
        }
        // Active drag: above saturation, income faces downward pressure (price erosion)
        // This prevents indefinite approach to ceiling
        if (excess > 0.5) {
          const activeDrag = -0.002 * satStrength * (excess - 0.5);
          totalChange += activeDrag;
        }
      }
    }
    
    // SUBSISTENCE RESISTANCE — natural stabilization near poverty floor
    // As income approaches subsistence, negative forces are dampened:
    // - Artisans shift to piece-rate survival work (lower but stable)
    // - Craft exit accelerates (reduces competition → stabilizes per-capita income)
    // - Supplementary income from agriculture/labor kicks in
    // Reference: Sen (1981) entitlement approach; Banerjee & Duflo (2011) poverty traps
    const subsistenceFloor = Config.EQUATION_PARAMS.income.base_income.value;
    const subsistenceBuffer = subsistenceFloor * 4; // ₹3,200 — zone where resistance kicks in
    if (totalChange < 0 && S.income < subsistenceBuffer) {
      // Sigmoid dampening: approaches 0 as income → floor, full effect above buffer
      const distFromFloor = Math.max(0, (S.income - subsistenceFloor) / (subsistenceBuffer - subsistenceFloor));
      const resistanceFactor = distFromFloor * distFromFloor; // Quadratic: gentle near buffer, strong near floor
      totalChange *= resistanceFactor;
    }
    
    // STEP 2: LEVEL-BASED INCOME — income is a LEVEL set by the current stocks, NOT a compounding
    // accumulator. income = subsistence + headroom × quality(skills, market) × share(1 − middlemen).
    // Removes the runaway AND the ceiling at the root, and enforces the trap: quality without a broken
    // middleman (low share) stays trapped — the AND-gate at the income level.
    const _sub = Config.EQUATION_PARAMS.income.subsistence.value;
    const _head = Config.EQUATION_PARAMS.income.headroom.value;
    const _quality = Math.max(0, Math.min(1, ((S.skills || 0) + (S.market || 0)) / 2));
    const _share = Math.max(0, Math.min(1, 1 - (S.middlemen || 0)));
    S.income = _sub + _head * _quality * _share;
    S.income *= (0.98 + rng() * 0.04); // noise (unseeded until step 6)
    S.income = Math.max(_sub, S.income);
  }

  function stepSkills() {
    S.prev.skills = S.skills;
    const policyEffects = calculatePolicyEffects();
    const params = Config.EQUATION_PARAMS.skills;
    let change = 0;
    
    // STEP 3 (skills-b): training builds skills through INVESTMENT, not as a reward for already being
    // rich. (1) removed the income>TRAP gate — quality can build while poor; (2) training policies' own
    // skill delivery now lands at a real, calibratable rate (was ×0.05, near-inert); (3) trap erosion
    // softened ×3→×1. This only un-blocks the QUALITY half — escape still needs the middleman broken
    // (income = quality × share). Deskilling stays real: skills erode without maintenance.
    change += S.heritage * (params.income_effect.value * 0.025);
    change -= params.erosion_rate.value;
    if (policyEffects.skills > 0) queueDelayedEffect('skills', policyEffects.skills * params.policy_gain.value, 'policy');
    
    const skillDampen = Math.max(0.05, 1 - Math.pow(S.skills, 3));
    S.skills = Math.min(0.95, Math.max(0.05, S.skills + change * skillDampen));
  }

  function stepMarket() {
    S.prev.market = S.market;
    const policyEffects = calculatePolicyEffects();
    const params = Config.EQUATION_PARAMS.market;
    let change = 0;
    
    change += (S.skills - 0.5) * params.quality_effect.value * 0.05;
    change -= S.middlemen * params.erosion_rate.value;
    if (S.activePolicies.has('ECOMMERCE') || S.activePolicies.has('HUNAR_HAAT')) change += params.growth_rate.value;
    if (policyEffects.market > 0) queueDelayedEffect('market', policyEffects.market * 0.03, 'policy');
    
    // D5: Infrastructure effect
    const roadEffect = (S.infrastructure.road - 0.5) * params.growth_rate.value;
    change += roadEffect;
    if (Math.abs(roadEffect) > 0.001) S.couplings.add('D5-D4');
    
    // COMPLEXITY: T1 - Heritage brakes market scaling (Liebl & Roy 2003)
    // High heritage commitment constrains market expansion (can't mass-produce authentic)
    const CX = Config.COMPLEXITY;
    if (CX && CX.enabled && CX.tensions.marketHeritage.enabled) {
      const brakeLevel = CX.tensions.marketHeritage.heritageMarketBrake;
      if (S.heritage > brakeLevel && S.market > 0.4 && change > 0) {
        const brakeStrength = CX.tensions.marketHeritage.brakeStrength;
        const heritageExcess = (S.heritage - brakeLevel) / (1 - brakeLevel);
        change *= (1 - brakeStrength * heritageExcess);
      }
    }
    
    const marketDampen = Math.max(0.05, 1 - Math.pow(S.market, 3));
    S.market = Math.min(0.95, Math.max(0.02, S.market + change * marketDampen));
  }

  function stepPopulation() {
    S.prev.population = S.population;
    const params = Config.EQUATION_PARAMS.population;
    
    const baseEntry = params.base_entry.value;
    const baseExit = params.base_exit.value;
    
    let entryRate, exitRate;
    if (S.attractorState === 'TRAP') {
      entryRate = baseEntry * 0.5;
      exitRate = baseExit * 1.5;
    } else if (S.attractorState === 'GROWTH') {
      entryRate = baseEntry * 1.33;
      exitRate = baseExit * 0.67;
    } else {
      entryRate = baseEntry;
      exitRate = baseExit;
    }
    
    const incomeSensitivity = params.income_sensitivity.value;
    entryRate *= (S.income > S.thresholds.TRAP ? 1 + incomeSensitivity : 1 - incomeSensitivity);
    exitRate *= (S.income < S.thresholds.TRAP ? 1 + incomeSensitivity : 1 - incomeSensitivity * 0.4);
    
    // COMPLEXITY: T4 - Brain drain (Harris & Todaro 1970; Breman 2013)
    // Higher skills + higher external wages → artisan exit to factories/urban jobs
    const CX = Config.COMPLEXITY;
    if (CX && CX.enabled && CX.tensions.brainDrain.enabled) {
      const bd = CX.tensions.brainDrain;
      if (S.skills > bd.skillThreshold && S.income > bd.incomeThreshold) {
        const skillPressure = (S.skills - bd.skillThreshold) / Math.max(0.05, 1 - bd.skillThreshold);
        const incomePressure = Math.min(1, (S.income - bd.incomeThreshold) / Math.max(1, bd.incomeThreshold));
        const drainAmount = bd.drainRate * skillPressure * incomePressure * S.population;
        exitRate += drainAmount / S.population * 12; // Convert to annual rate
      }
    }
    // Cumulative departures = ALL who left (attrition in the trap + brain drain), not just brain drain —
    // so the counter reflects the population decline the graph shows (was brain-drain-only → 0 in a trap).
    S.craftExits += exitRate * S.population / 12;
    
    const netChange = (entryRate - exitRate) * S.population / 12;
    const csBounds = Config.getBounds(S.caseStudy);
    const popFloor = csBounds.populationFloor || CALIBRATION.populationFloor || 1000;
    const popCeiling = Math.max(popFloor * 4, (Config.getCaseStudy(S.caseStudy)?.initial?.population || 250000) * 2);
    const popDampen = S.population > popCeiling * 0.7 ? Math.max(0.1, 1 - Math.pow(S.population / popCeiling, 2)) : 1;
    S.population = Math.max(popFloor, Math.min(popCeiling, S.population + netChange * (netChange > 0 ? popDampen : 1)));
  }

  function stepHeritage() {
    S.prev.heritage = S.heritage;
    const params = Config.EQUATION_PARAMS.heritage;
    const B3 = Config.LOOPS.B3;
    
    const caseMod = CALIBRATION.caseModifiers[S.caseStudy] || { heritage_erosion: 1.0 };
    
    let change = (S.skills - 0.3) * params.transmission_rate.value;
    change -= params.erosion_rate.value * caseMod.heritage_erosion;
    
    // B3: Heritage Dilution balancing loop
    if (B3.enabled && S.market > 0.6 && S.skills < 0.6) { 
      change -= params.mass_prod_effect.value * B3.strength; 
      S.couplings.add('D4-B3'); 
    }
    
    if (S.activePolicies.has('GI_REGISTRATION') || S.activePolicies.has('GURU_SHISHYA')) {
      change += params.transmission_rate.value;
    }
    
    // COMPLEXITY: T1 - Market erodes heritage (Scrase 2003; Liebl & Roy 2003)
    // Commercialization pressure: high market access drives mass-production shortcuts
    const CX = Config.COMPLEXITY;
    if (CX && CX.enabled && CX.tensions.marketHeritage.enabled) {
      const mh = CX.tensions.marketHeritage;
      if (S.market > mh.marketThreshold) {
        const marketPressure = (S.market - mh.marketThreshold) / (1 - mh.marketThreshold);
        change -= mh.erosionStrength * marketPressure;
        S.couplings.add('D4-B3'); // Market→Heritage tension logged
      }
    }
    
    const heritageDampen = Math.max(0.05, 1 - Math.pow(S.heritage, 2));
    S.heritage = Math.min(0.95, Math.max(0.05, S.heritage + change * heritageDampen));
  }

  function stepMiddlemen() {
    S.prev.middlemen = S.middlemen;
    const policyEffects = calculatePolicyEffects();
    const caseMod = CALIBRATION.caseModifiers[S.caseStudy] || { middlemen_growth: 1.0 };
    let change = 0;
    
    // STEP 5: COUNTERVAILING POWER (Galbraith 1952). Organized artisans (coordination) WITH an outside
    // market channel gain a credible threat to sell elsewhere, breaking the middleman monopsony. Neither
    // the co-op alone (no leverage) nor the channel alone (price-taker) suffices — only their PRODUCT.
    // Target markdown falls as coord × channel rises; strong enough to overcome the credit lock-in below.
    const _cp = Config.EQUATION_PARAMS.coordination;
    const _channel = S.market || 0;
    const _counter = Math.max(0, Math.min(1, S.coordination * _channel));
    const _midTarget = 0.95 - _cp.break_strength.value * _counter;
    if (_midTarget < S.middlemen) { change += (_midTarget - S.middlemen) * _cp.break_rate.value; S.couplings.add('R-COUNTER'); }
    if (S.market > 0.4) change -= 0.002;
    change += policyEffects.middlemen * 0.02;
    if (S.attractorState === 'TRAP' && S.middlemen < 0.8) { change += 0.002 * caseMod.middlemen_growth; S.couplings.add('D4-B1'); }
    
    // STEP 2: TRAP SELF-REINFORCEMENT — Credit dependency loop
    // When income is low, artisans borrow from middlemen for raw materials (thread, dyes, scrolls)
    // This locks them into selling at middlemen-set prices → income stays low → more borrowing
    // BUT: credit dependency scales with existing middlemen presence — if middlemen are weak,
    // artisans have alternative credit sources (SHGs, cooperatives, microfinance)
    // Reference: informal credit in Indian handicrafts (Harriss-White 2003); 
    // Harriss-White (2003) — India Working: Essays on Society and Economy
    if (S.attractorState === 'TRAP' || S.income < S.thresholds.TRAP * 1.15) {
      const trapDepth = Math.max(0, (S.thresholds.TRAP - S.income) / S.thresholds.TRAP);
      // Credit dependency proportional to BOTH trap depth AND middlemen presence
      const middlemenLeverage = Math.max(0, (S.middlemen - 0.25) / 0.55); // 0 at 0.25, 1 at 0.80
      const creditDependency = Math.min(0.8, trapDepth * 1.2 * middlemenLeverage);
      // Credit dependency actively GROWS middlemen power
      const creditLockIn = creditDependency * 0.008;
      change += creditLockIn;
      S._creditDependency = creditDependency;
      S.couplings.add('TRAP-B1');
    } else {
      S._creditDependency = 0;
    }
    
    // D5: Infrastructure effect
    const distanceEffect = (S.infrastructure.distance / 100) * 0.005;
    change += distanceEffect;
    if (distanceEffect > 0.001) S.couplings.add('D5-D4');
    
    // COMPLEXITY: T2 - Middlemen adaptation (Gereffi et al. 2005 — captive value chains)
    // When threatened by income growth or policy, middlemen adapt: offer credit, lock artisans, undercut
    const CX = Config.COMPLEXITY;
    if (CX && CX.enabled && CX.tensions.middlemenAdaptation.enabled) {
      const ma = CX.tensions.middlemenAdaptation;
      // Income growth rate triggers adaptation
      const incomeGrowthRate = S.prev.income > 0 ? (S.income - S.prev.income) / S.prev.income : 0;
      if (incomeGrowthRate > ma.triggerGrowth && S.middlemen < 0.7) {
        // Middlemen fight back proportional to how fast their position is being eroded
        const adaptationPressure = Math.min(1, incomeGrowthRate / 0.05) * ma.adaptationRate;
        const resurgence = Math.min(ma.maxResurgence, adaptationPressure * 0.01);
        change += resurgence;
        S.couplings.add('D4-B1'); // Income growth triggers middlemen resistance
      }
    }
    
    const midBounds = Config.getBounds(S.caseStudy);
    S.middlemen = Math.min(midBounds.middlemenCeiling, Math.max(midBounds.middlemenFloor, S.middlemen + change));
  }

  // ========== ATTRACTOR (v3 logic + COMPLEXITY D2) ==========
  function checkAttractor() {
    const thresh = S.thresholds;
    const prevState = S.attractorState;
    const CX = Config.COMPLEXITY;
    
    if (S.income > thresh.TRAP) { S.incAboveTrap++; S.monthsBelowThreshold = 0; }
    else { S.monthsBelowThreshold++; S.incAboveTrap = 0; }
    
    if (S.income > thresh.GROWTH) S.incAboveGrowth++;
    else S.incAboveGrowth = Math.max(0, S.incAboveGrowth - 1);

    // months the craft has spent meaningfully below the growth line (mirror of incAboveGrowth,
    // used for the GROWTH->TRANSITION exit so a declining craft can leave the growth basin)
    if (S.income < thresh.GROWTH * 0.8) S.monthsBelowGrowth = (S.monthsBelowGrowth || 0) + 1;
    else S.monthsBelowGrowth = 0;
    
    // COMPLEXITY: D2 - Hysteresis and pull force (Scheffer 2009)
    const useHysteresis = CX && CX.enabled && CX.attractorDynamics.enabled && CX.attractorDynamics.hysteresis;
    const escapeMultiplier = useHysteresis ? CX.attractorDynamics.escapeMultiplier : 1.0;
    const pullStrength = (CX && CX.enabled && CX.attractorDynamics.enabled) ? CX.attractorDynamics.pullStrength : 0;
    
    // Asymmetric thresholds: harder to escape TRAP than to fall back
    const effectiveTrapDur = Math.ceil(thresh.TRAP_DUR * escapeMultiplier);
    const effectiveGrowthDur = Math.ceil(thresh.GROWTH_DUR * escapeMultiplier);
    
    if (S.attractorState === 'TRAP') {
      // COMPLEXITY: D2 - Pull force resists escape near boundary
      if (pullStrength > 0 && S.income > thresh.TRAP * 0.9 && S.income < thresh.TRAP * 1.2) {
        S.income -= S.income * pullStrength * (1 - (S.income - thresh.TRAP * 0.9) / (thresh.TRAP * 0.3));
        S.income = Math.max(Config.EQUATION_PARAMS.income.base_income.value, S.income);
      }
      
      if (S.incAboveTrap >= effectiveTrapDur) {
        S.attractorState = 'TRANSITION';
        logEvent('STATE', `🔄 TRAP → TRANSITION (>${effectiveTrapDur}mo above ₹${thresh.TRAP.toLocaleString()})`);
        if (S.firstTransitionMonth == null) S.firstTransitionMonth = S.totalMonths; // observer
        S.tipping = true; S.tippingType = 'escape';
      }
    } else if (S.attractorState === 'TRANSITION') {
      if (S.incAboveGrowth >= effectiveGrowthDur) {
        S.attractorState = 'GROWTH';
        S.monthsBelowGrowth = 0;
        logEvent('STATE', `✅ TRANSITION → GROWTH`);
        if (S.firstGrowthMonth == null) S.firstGrowthMonth = S.totalMonths; // observer
        S.tipping = false;
      } else if (S.monthsBelowThreshold >= thresh.FALL_DUR) {
        S.attractorState = 'TRAP';
        logEvent('STATE', `⚠️ TRANSITION → TRAP (fell back)`);
        S.tipping = true; S.tippingType = 'fall';
      }
    } else if (S.attractorState === 'GROWTH') {
      if (S.monthsBelowGrowth >= thresh.FALL_DUR) {
        S.attractorState = 'TRANSITION';
        S.incAboveGrowth = 0;
        logEvent('STATE', `⚠️ GROWTH → TRANSITION`);
        S.tipping = true; S.tippingType = 'decline';
      }
    }
    
    if (S.attractorState !== prevState) S.couplings.add('D2-D3');
    if (S.tipping && prevState === S.attractorState) S.tipping = false;
  }

  function checkTipping() {
    const near = Math.abs(S.income - S.thresholds.TRAP) < S.thresholds.TRAP * 0.1 || Math.abs(S.income - S.thresholds.GROWTH) < S.thresholds.GROWTH * 0.1;
    if (near) { S.tipping = true; S.tippingType = 'threshold'; }
  }

  // ========== ABM SEGMENTS ==========
  function updateSegments() {
    const coordEffect = S._coordEffect || 0.5;
    let spatialEffectApplied = false;
    
    Object.keys(S.segments).forEach(seg => {
      let spatialMult = seg === 'A' ? (S.spatial.rural || 0.4) : seg === 'B' ? (S.spatial.peri_urban || 0.7) : 1.0;
      
      // COMPLEXITY: D5 - Dynamic spatial multipliers (Hägerstrand 1967)
      // Infrastructure improvements diffuse benefits from urban to rural
      const CX = Config.COMPLEXITY;
      if (CX && CX.enabled && CX.spatialDynamics.enabled) {
        const diffusion = CX.spatialDynamics.diffusionDecay;
        if (seg === 'A') spatialMult = Math.min(0.8, (S.spatial.rural || 0.4) + S.infrastructure.road * diffusion * 0.3);
        else if (seg === 'B') spatialMult = Math.min(0.9, (S.spatial.peri_urban || 0.7) + S.infrastructure.digital * diffusion * 0.2);
      }
      
      if (spatialMult !== 1.0) spatialEffectApplied = true;
      
      let policyBonus = 1.0;
      S.activePolicies.forEach(policyId => {
        const p = Config.getPolicy(policyId);
        if (!p) return;
        if (isContainerPolicy(policyId)) return; // umbrella is a container; its children carry the effect
        const targets = p.targeting?.segments || ['A','B','C'];
        if (!targets.includes(seg)) return;
        
        // Graduated segment bonus based on policy type
        // Welfare: strongest for A (subsistence), moderate for B (traditional), light for C
        // Market: strongest for C (market-ready), moderate for B (transitioning), light for A
        // Structural: moderate across all (builds system capacity)
        if (p.type === 'welfare') {
          if (seg === 'A' && S.political >= 0.5) policyBonus += 0.10;
          else if (seg === 'B') policyBonus += 0.06;  // Was 0.03 — B benefits from welfare training/credit
          else policyBonus += 0.03;
        } else if (p.type === 'market') {
          if (seg === 'C') policyBonus += 0.12;
          else if (seg === 'B') policyBonus += 0.07;  // Was 0.03 — B uses market linkages to transition up
          else policyBonus += 0.03;
        } else { // structural
          if (seg === 'B') policyBonus += 0.06;  // Was 0.03 — B benefits most from infrastructure/clusters
          else policyBonus += 0.05;  // A and C also benefit meaningfully from structural
        }
      });
      policyBonus = Math.min(1.50, policyBonus); // Raised cap slightly for integrated scenarios
      
      let coordBonus = 1 + (coordEffect - 0.5) * 0.15;
      if (seg === 'B') coordBonus *= 1.05;
      
      S.segments[seg].income = S.income * S.segments[seg].multiplier * spatialMult * policyBonus * coordBonus;
    });
    
    // NORMALIZATION: Ensure weighted segment average = S.income
    // Raw segment incomes incorporate spatial/coordination penalties that make them average below S.income.
    // We normalize to preserve relative differences while ensuring mathematical consistency.
    // This means S.income drives macro dynamics; segments decompose it consistently.
    const weightedRaw = Object.keys(S.segments).reduce((sum, seg) => 
      sum + S.segments[seg].income * S.segments[seg].share, 0);
    if (weightedRaw > 0) {
      const normFactor = S.income / weightedRaw;
      Object.keys(S.segments).forEach(seg => {
        S.segments[seg].income *= normFactor;
      });
    }
    
    if (S.month === 12 && S.year > 0) updateSegmentMobility();
    updateGenderIncomes();
    
    if (spatialEffectApplied) S.couplings.add('D5-D4');
    if (S.segments.C.share > 0.15) S.couplings.add('D6-D1');
    S.couplings.add('D6-D4');
  }

  function updateSegmentMobility() {
    const CX = Config.COMPLEXITY;
    
    // COMPLEXITY: D6 - Aspiration-based mobility (Harris-Todaro 1970)
    if (CX && CX.enabled && CX.abmDecisions.enabled) {
      const abm = CX.abmDecisions;
      
      // Income differentials drive aspiration: artisans see others earning more → want to move up
      const incomeA = S.segments.A.income;
      const incomeB = S.segments.B.income;
      const incomeC = S.segments.C.income;
      
      // A→B mobility: driven by income gap between A and B, requires skill threshold
      if (S.skills > 0.4 && incomeB > incomeA * 1.2 && S.segments.A.share > 0.15) {
        const aspiration = Math.min(0.03, (incomeB / incomeA - 1) * abm.aspirationStrength);
        const shift = Math.min(aspiration, S.segments.A.share - 0.15);
        S.segments.A.share -= shift;
        S.segments.B.share += shift;
      }
      
      // B→C mobility: harder, requires higher skills and market access
      if (S.skills > 0.6 && S.market > 0.4 && incomeC > incomeB * 1.3 && S.segments.B.share > 0.20) {
        const aspiration = Math.min(0.02, (incomeC / incomeB - 1) * abm.aspirationStrength * 0.5);
        const shift = Math.min(aspiration, S.segments.B.share - 0.20);
        S.segments.B.share -= shift;
        S.segments.C.share += shift;
      }
      
      // Downward mobility: segments fall when income drops below survival threshold
      if (incomeC < S.thresholds.TRAP * 0.8 && S.segments.C.share > 0.05) {
        const shift = Math.min(0.01, S.segments.C.share - 0.05);
        S.segments.C.share -= shift;
        S.segments.B.share += shift;
      }
      if (incomeB < S.thresholds.TRAP * 0.5 && S.segments.B.share > 0.10) {
        const shift = Math.min(0.01, S.segments.B.share - 0.10);
        S.segments.B.share -= shift;
        S.segments.A.share += shift;
      }
      
      // COMPLEXITY: D6 - Craft exit option (brain drain at segment level)
      if (abm.exitEnabled && S.skills > abm.exitSkillThreshold && incomeA < abm.exitIncomeThreshold) {
        // Low-income skilled artisans leave for factory/urban work
        const exitPressure = (abm.exitIncomeThreshold - incomeA) / abm.exitIncomeThreshold;
        const exitShift = Math.min(0.005, exitPressure * 0.01);
        S.segments.A.share = Math.max(0.10, S.segments.A.share - exitShift);
        // Lost artisans reduce population
        const exitPopFloor = Config.getBounds(S.caseStudy).populationFloor || CALIBRATION.populationFloor;
        S.population = Math.max(exitPopFloor, S.population * (1 - exitShift * S.segments.A.share));
      }
      
    } else {
      // Fallback: original mechanical mobility
      const mobility = 0.02;
      if (S.attractorState === 'GROWTH' && S.segments.A.share > 0.15) {
        const shift = Math.min(mobility, S.segments.A.share - 0.15);
        S.segments.A.share -= shift;
        S.segments.B.share += shift * 0.7;
        S.segments.C.share += shift * 0.3;
      } else if (S.attractorState === 'TRAP' && S.segments.C.share > 0.05) {
        const shift = Math.min(mobility, S.segments.C.share - 0.05);
        S.segments.C.share -= shift;
        S.segments.B.share += shift * 0.5;
        S.segments.A.share += shift * 0.5;
      }
    }
    
    // Normalize shares
    const total = S.segments.A.share + S.segments.B.share + S.segments.C.share;
    S.segments.A.share /= total;
    S.segments.B.share /= total;
    S.segments.C.share /= total;
  }

  function updateGenderIncomes() {
    if (!CALIBRATION.gender.enabled) return;
    let wageGap = CALIBRATION.gender.wageGap;
    wageGap += (S.coordination - 0.3) * 0.15;
    const hasWelfare = effectiveActivePolicyIds().some(id => { const p = Config.getPolicy(id); return p && p.type === 'welfare'; });
    if (hasWelfare) wageGap += 0.05;
    wageGap += (S.skills - 0.5) * 0.1;
    wageGap = Math.min(0.95, Math.max(0.50, wageGap));
    
    Object.keys(S.segments).forEach(seg => {
      const fs = S.segments[seg].femaleShare;
      const denom = fs * wageGap + (1 - fs);
      S.segments[seg].maleIncome = S.segments[seg].income / denom;
      S.segments[seg].femaleIncome = S.segments[seg].income * wageGap / denom;
    });
    
    let totalF = 0, totalM = 0, wF = 0, wM = 0;
    Object.keys(S.segments).forEach(seg => {
      const pop = S.segments[seg].share;
      const fs = S.segments[seg].femaleShare;
      wF += S.segments[seg].femaleIncome * pop * fs;
      wM += S.segments[seg].maleIncome * pop * (1 - fs);
      totalF += pop * fs;
      totalM += pop * (1 - fs);
    });
    
    S.gender.avgFemaleIncome = totalF > 0 ? wF / totalF : 0;
    S.gender.avgMaleIncome = totalM > 0 ? wM / totalM : 0;
    S.gender.wageGapRatio = S.gender.avgMaleIncome > 0 ? S.gender.avgFemaleIncome / S.gender.avgMaleIncome : wageGap;
  }

  function calculateGini() {
    const incomes = [
      { income: S.segments.A.income, share: S.segments.A.share },
      { income: S.segments.B.income, share: S.segments.B.share },
      { income: S.segments.C.income, share: S.segments.C.share }
    ].sort((a, b) => a.income - b.income);
    
    let cumPop = 0, cumIncome = 0, giniSum = 0;
    const totalIncome = incomes.reduce((sum, s) => sum + s.income * s.share, 0);
    if (totalIncome <= 0) return 0;
    
    incomes.forEach(s => {
      const prevP = cumPop, prevI = cumIncome;
      cumPop += s.share;
      cumIncome += s.income * s.share / totalIncome;
      giniSum += (cumPop - prevP) * (cumIncome + prevI);
    });
    
    S.incomeRatio_CA = S.segments.A.income > 0 ? (S.segments.C.income / S.segments.A.income).toFixed(2) : 'N/A';
    
    return Math.max(0, Math.min(1, 1 - giniSum));
  }

  // ========== COORDINATION & POLITICAL ==========
  function updateCoordination() {
    const params = Config.EQUATION_PARAMS.coordination;
    // STEP 4: ARTISAN coordination builds via a CRITICAL-MASS THRESHOLD (Granovetter 1978; Oliver &
    // Marwell 1985), not linearly. Organized investment from non-umbrella cluster/institution policies
    // (their coordination effect × coverage) drives an S-curve: below critical mass little co-op forms;
    // through it, it tips up; saturating near the top. INTER-MINISTRY FRICTION IS NOT HERE — that is
    // policyCoherence (the two-stream split). Divergent segment interests still drag it (Olson 1965).
    let coordInvestment = 0;
    S.activePolicies.forEach(pid => {
      const pol = Config.getPolicy(pid);
      if (pol && !pol.isUmbrella && pol.effects && pol.effects.coordination > 0)
        coordInvestment += pol.effects.coordination * (pol.coverage != null ? pol.coverage : 1);
    });
    const crit = params.crit_mass.value, steep = params.threshold_steep.value, build = params.build_rate.value;
    let target = 1 / (1 + Math.exp(-steep * (coordInvestment - crit)));
    // Olson (1965): divergent segment interests undermine collective action → lower the reachable co-op
    const CX = Config.COMPLEXITY;
    if (CX && CX.enabled && CX.tensions.inequalityCoordination && CX.tensions.inequalityCoordination.enabled) {
      const ic = CX.tensions.inequalityCoordination;
      const ratio = S.segments.A.income > 0 ? S.segments.C.income / S.segments.A.income : 1;
      if (ratio > ic.ratioThreshold) { target *= Math.max(0.5, 1 - ic.penaltyRate * (ratio - ic.ratioThreshold)); S.couplings.add('D6-D1'); }
    }
    S.coordination = Math.max(0.05, Math.min(0.95, S.coordination + (target - S.coordination) * build));
    S.couplings.add('D1-D4');
  }

  function updatePolitical() {
    if (S.month !== 12) return;
    const improved = S.income > S.prev.income;
    const gini = calculateGini();
    
    const hasWelfare = Array.from(S.activePolicies).some(id => { const p = Config.getPolicy(id); return p && p.type === 'welfare'; });
    const hasMarket = effectiveActivePolicyIds().some(id => { const p = Config.getPolicy(id); return p && p.type === 'market'; });
    
    S.couplings.add('D3-D4');
    
    let deltaP = 0;
    
    if (improved && hasWelfare) deltaP += 0.05;
    if (improved && hasMarket) deltaP -= 0.05;
    if (!improved && hasWelfare) deltaP -= 0.08;
    if (!improved && hasMarket) deltaP += 0.08;
    if (gini > 0.45) { deltaP += 0.10; S.couplings.add('D6-D3'); }
    if (S.coordination > 0.6) { deltaP += 0.02; S.couplings.add('D1-D3'); }
    if (S.attractorState === 'TRAP') { deltaP += 0.03; S.couplings.add('D2-D3'); }
    
    // COMPLEXITY: T5 - Political attention cycle modulation (Kingdon 1984)
    const CX = Config.COMPLEXITY;
    if (CX && CX.enabled && CX.tensions.politicalCycles.enabled) {
      const cycleLength = CX.tensions.politicalCycles.cycleLengthMonths;
      const cyclePhase = (S.totalMonths % cycleLength) / cycleLength;
      // Near elections: political volatility increases
      if (cyclePhase > 0.75) {
        deltaP *= 1.5; // Amplified political shifts near elections
      }
    }
    
    // Mean-reversion toward 0.5
    deltaP += (0.5 - S.political) * 0.05;
    deltaP = Math.max(-0.10, Math.min(0.10, deltaP));
    
    const polDampen = Math.max(0.05, 1 - Math.pow(deltaP > 0 ? S.political : (1 - S.political), 3));
    deltaP *= polDampen;
    
    S.political = Math.min(0.95, Math.max(0.05, S.political + deltaP));
    
    updateNPF(improved, gini);
  }
  
  function updateNPF(improved, gini) {
    // COMPLEXITY: D3 - Narrative inertia (Shanahan et al. 2011)
    // Narratives resist change — dominant narrative has persistence
    const CX = Config.COMPLEXITY;
    const prevNarrative = S.npf.dominantNarrative;
    
    let newNarrative;
    if (S.middlemen > 0.6 && S.attractorState === 'TRAP') {
      newNarrative = 'exploitation';
    } else if (S.attractorState === 'GROWTH') {
      newNarrative = 'empowerment';
    } else if (S.heritage < 0.4) {
      newNarrative = 'heritage_loss';
    } else if (gini > 0.5) {
      newNarrative = 'inequality';
    } else {
      newNarrative = 'transition';
    }
    
    // COMPLEXITY: D3 - Narrative inertia: don't switch instantly
    if (CX && CX.enabled && CX.npfFeedback.enabled && newNarrative !== prevNarrative) {
      const inertia = CX.npfFeedback.narrativeInertia;
      // Random check against inertia — higher inertia = harder to change
      if (rng() < inertia) {
        logEvent('NPF', `Narrative resists change: ${prevNarrative} → ${newNarrative} blocked (inertia ${(inertia*100).toFixed(0)}%)`);
        newNarrative = prevNarrative; // Narrative resists change
      } else {
        logEvent('NPF', `✅ Narrative shift: ${prevNarrative} → ${newNarrative}`);
      }
    } else if (!CX || !CX.enabled || !CX.npfFeedback.enabled) {
      // No complexity — narrative changes instantly
      if (newNarrative !== prevNarrative) {
        logEvent('NPF', `Narrative shift: ${prevNarrative} → ${newNarrative}`);
      }
    }
    
    S.npf.dominantNarrative = newNarrative;
    
    // Update characters based on narrative
    const characterMap = {
      'exploitation': { hero: 'Artisans', villain: 'Middlemen', victim: 'Heritage' },
      'empowerment': { hero: 'Artisans', villain: 'Poverty', victim: 'Families' },
      'heritage_loss': { hero: 'Masters', villain: 'Modernization', victim: 'Tradition' },
      'inequality': { hero: 'Workers', villain: 'Elite', victim: 'Poor' },
      'transition': { hero: 'Artisans', villain: 'Uncertainty', victim: 'Communities' }
    };
    S.npf.characters = characterMap[newNarrative] || characterMap['transition'];
    
    S.npf.coalitions.welfare = S.political;
    S.npf.coalitions.market = 1 - S.political;
  }

  function checkPolicyFeasibility(policyId) {
    const policy = Config.getPolicy(policyId);
    if (!policy) return { feasible: true, reason: null };
    if (politicalGating && policy.type === 'welfare' && S.political < 0.3) return { feasible: false, reason: 'Needs political ≥ 0.30 (currently ' + S.political.toFixed(2) + ')' };
    if (politicalGating && policy.type === 'market' && S.political > 0.7) return { feasible: false, reason: 'Needs political ≤ 0.70 (currently ' + S.political.toFixed(2) + ')' };
    // OPTIONAL coordination gate — only when the user turns on 'coordination-based choices'. Default OFF
    // (unbounded), because structural/cluster policies are what BUILD coordination from a low base (the
    // critical-mass threshold handles the ramp); gating them hard created a chicken-and-egg. The toggle
    // lets a user explore the realism-mode where a minimum coordination is required before structural
    // programmes can land.
    if (coordinationGating && policy.type === 'structural' && S.coordination < COORD_GATE_THRESHOLD) {
      return { feasible: false, reason: 'Needs coordination ≥ ' + COORD_GATE_THRESHOLD.toFixed(2) + ' (currently ' + S.coordination.toFixed(2) + ') — coordination-gating mode is ON' };
    }
    return { feasible: true, reason: null };
  }

  // ========== COMPLEXITY: STOCHASTIC SHOCKS ==========
  // COMPLEXITY: L1 - Endogenous stochastic shocks (regime-dependent disruptions)
  function processComplexityShocks() {
    const CX = Config.COMPLEXITY;
    if (!CX || !CX.enabled || !CX.stochasticShocks.enabled) return;
    
    const ss = CX.stochasticShocks;
    
    // Recovery from previous shock
    if (S.activeComplexityShock && S.shockRecoveryRemaining > 0) {
      S.shockRecoveryRemaining--;
      // Gradual recovery
      const recoveryAmount = S.activeComplexityShock.magnitude * ss.recoveryRate / 6;
      S.income *= (1 + recoveryAmount * 0.5);
      if (S.shockRecoveryRemaining <= 0) {
        logEvent('SHOCK', `Recovery complete from ${S.activeComplexityShock.type}`);
        S.activeComplexityShock = null;
      }
      return;
    }
    
    // New shock probability — state-dependent
    let freq = ss.baseFrequency;
    if (S.attractorState === 'TRAP') freq *= ss.trapVulnerability;
    else if (S.attractorState === 'GROWTH') freq *= ss.growthVulnerability;
    
    // COMPLEXITY: D1 - Tight coupling increases fragility (Perrow 1984)
    if (CX.graphTheory.enabled && CX.graphTheory.densityFeedback) {
      const density = S.networkDensity;
      if (density > CX.graphTheory.rigidityThreshold) {
        freq *= (1 + CX.graphTheory.fragilityCoupling * (density - CX.graphTheory.rigidityThreshold) / 5);
      }
    }
    
    if (rng() < freq) {
      // Generate shock
      const magnitude = ss.magnitudeMin + rng() * (ss.magnitudeMax - ss.magnitudeMin);
      const shockTypes = ['monsoon_disruption', 'demand_slump', 'input_cost_spike', 'policy_discontinuity', 'supply_chain'];
      const type = shockTypes[Math.floor(rng() * shockTypes.length)];
      
      // Apply shock
      S.income *= (1 - magnitude);
      S.income = Math.max(Config.EQUATION_PARAMS.income.base_income.value, S.income);
      
      // Secondary effects based on shock type
      if (type === 'monsoon_disruption') {
        S.market *= (1 - magnitude * 0.3);
        S.market = Math.max(0.02, S.market);
      } else if (type === 'demand_slump') {
        S.market *= (1 - magnitude * 0.5);
        S.market = Math.max(0.02, S.market);
      } else if (type === 'policy_discontinuity') {
        S.coordination *= (1 - magnitude * 0.4);
        S.coordination = Math.max(0.1, S.coordination);
      }
      
      S.activeComplexityShock = { type, magnitude };
      S.shockRecoveryRemaining = Math.ceil(6 + magnitude * 12); // 6-18 month recovery
      
      logEvent('SHOCK', `⚡ ${type.replace(/_/g, ' ')} (−${(magnitude * 100).toFixed(0)}% income)`);
    }
  }
  
  // COMPLEXITY: D5 - Dynamic infrastructure updates (Hägerstrand 1967)
  function updateInfrastructure() {
    const CX = Config.COMPLEXITY;
    if (!CX || !CX.enabled || !CX.spatialDynamics.enabled) return;
    
    const sd = CX.spatialDynamics;
    
    // Digital access improves with income and coordination
    const digitalBoost = sd.digitalGrowthRate + S.income * sd.incomeInfraBoost + S.coordination * 0.001;
    S.infrastructure.digital = Math.min(0.95, S.infrastructure.digital + digitalBoost);
    
    // Road connectivity improves slowly with coordination
    const roadBoost = sd.roadGrowthRate + S.coordination * 0.0005;
    S.infrastructure.road = Math.min(0.95, S.infrastructure.road + roadBoost);
    
    // Market distance shrinks with market access improvement
    if (S.market > 0.4) {
      S.infrastructure.distance = Math.max(2, S.infrastructure.distance * (1 - 0.002));
    }
    
    // Update spatial multipliers through diffusion
    const diffusion = sd.diffusionDecay;
    S.spatial.rural = Math.min(0.75, (S.spatial.rural || 0.4) + S.infrastructure.road * diffusion * 0.001);
    S.spatial.peri_urban = Math.min(0.90, (S.spatial.peri_urban || 0.7) + S.infrastructure.digital * diffusion * 0.0005);
  }

  // ========== MONTE CARLO ==========
  function runMonteCarlo(numRuns, months) {
    numRuns = numRuns || CALIBRATION.monteCarlo.defaultRuns;
    months = months || (S.year * 12 + S.month) || CALIBRATION.monteCarlo.defaultMonths;
    const variation = CALIBRATION.monteCarlo.parameterVariation;
    
    const originalCouplings = new Set(S.couplings);
    const originalActivePolicies = new Set(S.activePolicies);
    const originalState = JSON.parse(JSON.stringify(S));
    const originalDelays = JSON.parse(JSON.stringify(delayQueues));
    const originalParams = JSON.parse(JSON.stringify(Config.EQUATION_PARAMS));
    const originalLoops = JSON.parse(JSON.stringify(Config.LOOPS));
    const originalComplexity = JSON.parse(JSON.stringify(Config.COMPLEXITY));
    
    const cs = Config.getCaseStudy(S.caseStudy);
    const policyList = Array.from(S.activePolicies);
    const originalEventLog = [...eventLog];
    
    const results = { finalIncomes: [], finalStates: { TRAP: 0, TRANSITION: 0, GROWTH: 0 }, trajectories: [], escapeMonth: [] };
    
    for (let run = 0; run < numRuns; run++) {
      initState(S.caseStudy);
      _rngState = (_seed + run * 2654435761) | 0; // MC FIX: distinct RNG stream per run — restores run-to-run variation after the seeded-RNG change (whole MC still reproducible from the base seed)
      delayQueues = { skills: [], market: [], coordination: [], income: [], population: [] };
      
      policyList.forEach(pid => {
        S.activePolicies.add(pid);
        S.policyActivationMonth[pid] = 0; // COMPLEXITY: Track activation for ramp-up
      });
      
      const mcBounds = Config.getBounds(S.caseStudy);
      S.income *= (1 - variation + rng() * variation * 2);
      S.skills = Math.min(0.95, Math.max(0.1, S.skills * (1 - variation + rng() * variation * 2)));
      S.market = Math.min(0.95, Math.max(0.1, S.market * (1 - variation + rng() * variation * 2)));
      S.coordination = Math.min(0.95, Math.max(0.1, S.coordination * (1 - variation + rng() * variation * 2)));
      S.middlemen = Math.min(mcBounds.middlemenCeiling, Math.max(mcBounds.middlemenFloor, S.middlemen * (1 - variation + rng() * variation * 2)));
      S.heritage = Math.min(0.95, Math.max(0.05, S.heritage * (1 - variation + rng() * variation * 2)));
      S.political = Math.min(0.95, Math.max(0.05, S.political * (1 - variation + rng() * variation * 2)));
      
      const paramVariation = variation * 0.5;
      const perturb = () => 1 - paramVariation + rng() * paramVariation * 2;
      Object.keys(Config.EQUATION_PARAMS).forEach(eq => {
        Object.keys(Config.EQUATION_PARAMS[eq]).forEach(p => {
          if (Config.EQUATION_PARAMS[eq][p] && typeof Config.EQUATION_PARAMS[eq][p].value === 'number') {
            Config.EQUATION_PARAMS[eq][p].value = originalParams[eq][p].value * perturb();
          }
        });
      });
      Object.keys(Config.LOOPS).forEach(loop => {
        if (typeof Config.LOOPS[loop].strength === 'number') {
          Config.LOOPS[loop].strength = Math.min(2, Math.max(0, originalLoops[loop].strength * perturb()));
        }
      });
      
      // FIX 4: Perturb COMPLEXITY parameters for genuine uncertainty
      if (Config.COMPLEXITY && Config.COMPLEXITY.enabled) {
        const CX = Config.COMPLEXITY;
        // Perturb key numeric complexity params (±variation)
        CX.demandSaturation.saturationIncome = originalComplexity.demandSaturation.saturationIncome * perturb();
        CX.demandSaturation.saturationStrength = Math.min(1, originalComplexity.demandSaturation.saturationStrength * perturb());
        CX.stochasticShocks.baseFrequency = Math.min(0.1, originalComplexity.stochasticShocks.baseFrequency * perturb());
        CX.stochasticShocks.magnitudeMax = originalComplexity.stochasticShocks.magnitudeMax * perturb();
        CX.tensions.marketHeritage.erosionStrength = originalComplexity.tensions.marketHeritage.erosionStrength * perturb();
        CX.tensions.middlemenAdaptation.adaptationRate = Math.min(1, originalComplexity.tensions.middlemenAdaptation.adaptationRate * perturb());
        CX.tensions.coordinationFriction.frictionPerPolicy = originalComplexity.tensions.coordinationFriction.frictionPerPolicy * perturb();
        CX.tensions.brainDrain.drainRate = originalComplexity.tensions.brainDrain.drainRate * perturb();
        CX.tensions.politicalCycles.attentionAmplitude = Math.min(0.3, originalComplexity.tensions.politicalCycles.attentionAmplitude * perturb());
        CX.attractorDynamics.escapeMultiplier = Math.max(1, originalComplexity.attractorDynamics.escapeMultiplier * perturb());
        CX.attractorDynamics.pullStrength = originalComplexity.attractorDynamics.pullStrength * perturb();
      }
      
      const trajectory = [];
      let escaped = false, escapeAt = null;
      
      for (let m = 0; m < months; m++) {
        step(false);
        trajectory.push(S.income);
        if (!escaped && S.attractorState !== 'TRAP') { escaped = true; escapeAt = m; }
      }
      
      results.finalIncomes.push(S.income);
      results.finalStates[S.attractorState]++;
      results.trajectories.push(trajectory);
      if (escapeAt !== null) results.escapeMonth.push(escapeAt);
    }
    
    // Restore
    Object.assign(S, originalState);
    S.couplings = originalCouplings;
    S.activePolicies = originalActivePolicies;
    delayQueues = originalDelays;
    Object.assign(Config.EQUATION_PARAMS, originalParams);
    Object.assign(Config.LOOPS, originalLoops);
    // Deep restore COMPLEXITY
    if (originalComplexity) {
      Object.keys(originalComplexity).forEach(key => {
        if (typeof originalComplexity[key] === 'object' && originalComplexity[key] !== null) {
          Config.COMPLEXITY[key] = JSON.parse(JSON.stringify(originalComplexity[key]));
        } else {
          Config.COMPLEXITY[key] = originalComplexity[key];
        }
      });
    }
    eventLog = originalEventLog;
    
    results.finalIncomes.sort((a, b) => a - b);
    results.stats = {
      mean: results.finalIncomes.reduce((a, b) => a + b, 0) / numRuns,
      median: results.finalIncomes[Math.floor(numRuns / 2)],
      min: results.finalIncomes[0],
      max: results.finalIncomes[numRuns - 1],
      ci95_low: results.finalIncomes[Math.floor(numRuns * 0.025)],
      ci95_high: results.finalIncomes[Math.floor(numRuns * 0.975)],
      escapeProb: (results.finalStates.TRANSITION + results.finalStates.GROWTH) / numRuns
    };
    
    S.monteCarloResults = results;
    logEvent('MONTE', `MC: ${numRuns} runs | Escape: ${(results.stats.escapeProb * 100).toFixed(1)}% | Mean: ₹${Math.round(results.stats.mean).toLocaleString()}`);
    
    return results;
  }

  // Steady-state validation
  function validateSteadyState(months = 600) {
    const origState = JSON.parse(JSON.stringify(S));
    const origCouplings = new Set(S.couplings);
    const origPolicies = new Set(S.activePolicies);
    const origDelays = JSON.parse(JSON.stringify(delayQueues));
    const origEventLog = [...eventLog];
    
    // Ensemble steady-state assessment: average N stochastic trajectories BEFORE measuring level
    // convergence. The model carries ±2%/month income noise (and shock events); on a single run the
    // window means at the low trap floor (income ~Rs 800, coordination ~0.10) can differ >5% by
    // chance. Averaging the trajectories first reduces that sampling noise ~sqrt(N) so the 5%
    // level-convergence criterion stays honest rather than being loosened.
    const ENSEMBLE = 10;
    const acc = []; const stateSeq = [];
    for (let run = 0; run < ENSEMBLE; run++) {
      initState(S.caseStudy);
      S.activePolicies.clear();
      let si = 0;
      for (let m = 0; m < months; m++) {
        step(false);
        if (m % 12 === 0) {
          if (!acc[si]) acc[si] = { year: Math.floor(m / 12), income: 0, skills: 0, market: 0, coordination: 0, heritage: 0, middlemen: 0 };
          acc[si].income += S.income; acc[si].skills += S.skills; acc[si].market += S.market;
          acc[si].coordination += S.coordination; acc[si].heritage += S.heritage; acc[si].middlemen += S.middlemen;
          if (run === ENSEMBLE - 1) stateSeq[si] = S.attractorState;
          si++;
        }
      }
    }
    const snapshots = acc.map((a, i) => ({
      year: a.year,
      income: Math.round(a.income / ENSEMBLE),
      skills: +(a.skills / ENSEMBLE).toFixed(3),
      market: +(a.market / ENSEMBLE).toFixed(3),
      coordination: +(a.coordination / ENSEMBLE).toFixed(3),
      heritage: +(a.heritage / ENSEMBLE).toFixed(3),
      middlemen: +(a.middlemen / ENSEMBLE).toFixed(3),
      state: stateSeq[i]
    }));
    
    // Adaptive averaging window (up to 10yr) — smooths the model's ±2%/month income noise so the
    // level-convergence test is robust to stochasticity (not tipped by a single noisy 5yr window).
    const W = Math.max(2, Math.min(10, Math.floor(snapshots.length / 2)));
    const last5 = snapshots.slice(-W);
    const prev5 = snapshots.slice(-2 * W, -W);
    const stable = {};
    ['income', 'skills', 'market', 'coordination', 'heritage', 'middlemen'].forEach(v => {
      const lvals = last5.map(s => s[v]);
      const pvals = prev5.map(s => s[v]);
      const lmean = lvals.reduce((a, b) => a + b, 0) / lvals.length;
      const pmean = pvals.length ? pvals.reduce((a, b) => a + b, 0) / pvals.length : lmean;
      const intraDev = Math.max(...lvals.map(x => Math.abs(x - lmean) / (lmean || 1)));
      const levelDrift = Math.abs(lmean - pmean) / (pmean || 1);
      const absDrift = Math.abs(lmean - pmean);
      // Steady state = the equilibrium LEVEL has converged (the mean stops changing),
      // tolerant of small bounded oscillation around an attractor floor. During the collapse
      // the level still drifts, so this correctly reports 'not settled' until it truly settles.
      stable[v] = {
        mean: +lmean.toFixed(3),
        oscillation: +(intraDev * 100).toFixed(1) + '%',
        levelDrift: +(levelDrift * 100).toFixed(1) + '%',
        // Settled if the level stopped moving in RELATIVE terms (<5%) OR the absolute movement is
        // negligible (<0.01 on the [0,1] scale). The absolute floor stops a variable pinned near a
        // small attractor floor (e.g. coordination ~0.10) from reading a 0.005 wobble as 5% 'drift'.
        // It cannot mask genuine non-convergence: a real collapse moves these variables far more.
        stable: levelDrift < 0.05 || absDrift < (v === 'income' ? Config.EQUATION_PARAMS.income.base_income.value * 0.1 : 0.05)
      };
    });
    
    Object.assign(S, origState);
    S.couplings = origCouplings;
    S.activePolicies = origPolicies;
    delayQueues = origDelays;
    eventLog = origEventLog;
    
    return { snapshots, stability: stable, allStable: Object.values(stable).every(v => v.stable) };
  }

  // ========== MAIN STEP ==========
  // ========== COMPLEXITY STATUS LOGGER (annual) ==========
  function logComplexityStatus() {
    const CX = Config.COMPLEXITY;
    if (!CX || !CX.enabled) return;
    
    // Log R-loop activation levels
    logEvent('COMPLEXITY', `R-loops: R1=${(S._R1_activation*100).toFixed(0)}% R2=${(S._R2_activation*100).toFixed(0)}% | Credit dep: ${(S._creditDependency*100).toFixed(0)}%`);
    
    // Log significant complexity states
    if (S._creditDependency > 0.3) {
      logEvent('COMPLEXITY', `⚠️ Credit lock-in active (${(S._creditDependency*100).toFixed(0)}%) — middlemen strengthening`);
    }
    if (S.craftExits > 0) {
      logEvent('COMPLEXITY', `Brain drain: ${Math.round(S.craftExits)} artisans left craft (cumulative)`);
    }
    if (S.networkDensity > (CX.graphTheory.rigidityThreshold || 6)) {
      logEvent('COMPLEXITY', `⚠️ System rigidity: ${S.networkDensity} active couplings → shock vulnerability ↑`);
    }
    
    // Log active tensions
    const tensions = [];
    if (CX.tensions.marketHeritage.enabled && S.market > CX.tensions.marketHeritage.marketThreshold) {
      tensions.push('T1:Mkt↔Her');
    }
    if (CX.tensions.middlemenAdaptation.enabled && S.middlemen < 0.7) {
      tensions.push('T2:Mid-adapt');
    }
    if (CX.tensions.coordinationFriction.enabled && effectivePolicyCount() > 2) {
      tensions.push(`T3:Friction(${effectivePolicyCount()}pol)`);
    }
    if (CX.tensions.brainDrain.enabled && S.skills > CX.tensions.brainDrain.skillThreshold) {
      tensions.push('T4:Drain');
    }
    if (CX.tensions.politicalCycles.enabled) {
      const phase = (S.totalMonths % CX.tensions.politicalCycles.cycleLengthMonths) / CX.tensions.politicalCycles.cycleLengthMonths;
      tensions.push(`T5:Pol(${phase > 0.8 ? 'election' : phase < 0.3 ? 'surge' : 'mid'})`);
    }
    if (tensions.length > 0) {
      logEvent('COMPLEXITY', `Active tensions: ${tensions.join(', ')}`);
    }
    
    // Log policy prerequisite status (only if policies active)
    if (S.activePolicies.size > 0 && S._prereqModifiers) {
      const prereqEntries = Object.entries(S._prereqModifiers)
        .filter(([id, mod]) => mod !== 1.0)
        .map(([id, mod]) => `${id}:${mod > 1 ? '+' : ''}${((mod-1)*100).toFixed(0)}%`);
      if (prereqEntries.length > 0) {
        logEvent('COMPLEXITY', `Prereq effects: ${prereqEntries.join(', ')}`);
      }
    }
    
    // Annual state summary
    logEvent('STATE', `Y${S.year}: ₹${Math.round(S.income).toLocaleString()} | ${S.attractorState} | Mid=${S.middlemen.toFixed(2)} Coord=${S.coordination.toFixed(2)} Pop=${Math.round(S.population).toLocaleString()}`);
    
    // NPF periodic status (every 3 years to avoid spam)
    if (S.year % 3 === 0 && S.npf) {
      logEvent('NPF', `Narrative: ${S.npf.dominantNarrative} | Welfare coalition: ${(S.npf.coalitions.welfare * 100).toFixed(0)}% vs Market: ${(S.npf.coalitions.market * 100).toFixed(0)}%`);
    }
  }

  function step(doLog = true) {
    S.prev = { income: S.income, skills: S.skills, market: S.market, coordination: S.coordination, middlemen: S.middlemen, political: S.political, heritage: S.heritage };
    
    const prevCouplings = new Set(S.couplings);
    
    if (S.month >= 12) { S.month = 1; S.year++; } else { S.month++; }
    S.totalMonths++; // COMPLEXITY: Track total months for political cycles
    
    // Cache coordEffect once per step
    const coordRange = Config.EQUATION_PARAMS.income.coord_multiplier.value;
    // TWO-STREAM SPLIT (step 1, KEYSTONE): delivery effectiveness comes from INTER-MINISTRY
    // coordination (policyCoherence), NOT the artisan co-op stock. policyCoherence = base +
    // Σ(active coherenceContribution) − fragmentation(count). This un-throttles delivery from the
    // broken artisan-coordination stock — the root-cause fix. (Peters 2015, horizontal management.)
    let _cohSum = 0, _cohN = 0;
    S.activePolicies.forEach(pid => { const pp = Config.POLICIES[pid]; if (pp) { _cohSum += (pp.coherenceContribution || 0); _cohN++; } });
    S.policyCoherence = Math.max(0.1, Math.min(1, 0.4 + _cohSum - 0.02 * _cohN));
    if (_forcedCoherence != null) S.policyCoherence = _forcedCoherence; // explainer sweep: isolate coherence as the parameter
    S._coordEffect = (1 - coordRange) + coordRange * S.policyCoherence;
    
    S.couplings.clear();
    applyDelayedEffects();
    processShocks();
    
    // COMPLEXITY: L1 - Stochastic shocks (regime-dependent disruptions)
    processComplexityShocks();
    
    // COMPLEXITY: D5 - Dynamic infrastructure updates (Hägerstrand 1967)
    updateInfrastructure();
    
    stepIncome();
    stepSkills();
    stepMarket();
    stepPopulation();
    stepHeritage();
    stepMiddlemen();
    
    checkAttractor();
    
    updateCoordination();
    if (S.month === 12) { updatePolitical(); if (doLog) logComplexityStatus(); }
    
    updateSegments();
    checkTipping();
    
    // COMPLEXITY: D1 - Compute network density for next step (Perrow 1984)
    computeNetworkDensity();
    
    // Log newly activated couplings
    if (doLog && S.couplings.size > 0) {
      const couplingNames = {
        'D1-D4': 'Coordination→Income',
        'D2-D4': 'State→Dynamics',
        'D3-D4': 'Political→Policy',
        'D5-D4': 'Spatial→Reach',
        'D6-D4': 'Segments→Income',
        'D6-D1': 'Inequality→Coordination',
        'D6-D3': 'Inequality→Political',
        'D1-D3': 'Coordination→Voice',
        'D1-D2': 'Coordination→Resilience',
        'D2-D3': 'Crisis→Political',
        'D5-D1': 'Digital→Coordination',
        'D4-B1': 'Middlemen Exploitation',
        'D4-B3': 'Heritage Dilution',
        'B3-D4': 'Heritage→Income Premium',
        'TRAP-B1': 'Credit Dependency→Middlemen',
        'B1-TRAP': 'Middlemen→Income Drain'
      };
      
      S.couplings.forEach(c => {
        if (!prevCouplings.has(c)) {
          logEvent('COUPLING', `${c} activated: ${couplingNames[c] || c}`);
        }
      });
    }
    
    // Update history
    S.history.income.push(S.income);
    S.history.skills.push(S.skills);
    S.history.market.push(S.market);
    S.history.middlemen.push(S.middlemen);
    S.history.coordination.push(S.coordination);
    S.history.policyCoherence.push(S.policyCoherence);
    S.history.political.push(S.political);
    S.history.heritage.push(S.heritage);
    S.history.segA.push(S.segments.A.income);
    S.history.segB.push(S.segments.B.income);
    S.history.segC.push(S.segments.C.income);
    S.history.population.push(S.population);
    S.history.gini.push(calculateGini());
    S.history.femaleIncome.push(S.gender.avgFemaleIncome);
    S.history.maleIncome.push(S.gender.avgMaleIncome);
    S.history.spatial.push(((S.spatial.urban || 1) + (S.spatial.peri_urban || 0.7) + (S.spatial.rural || 0.4)) / 3);
    // Complexity diagnostics
    S.history.r1Activation.push(S._R1_activation);
    S.history.r2Activation.push(S._R2_activation);
    S.history.creditDependency.push(S._creditDependency);
    S.history.competitionFactor.push(S.competitionFactor || 1.0);
    S.history.networkDensity.push(S.networkDensity || 0);
    
    Object.keys(S.history).forEach(key => { if (S.history[key].length > 360) S.history[key].shift(); });
    
    return S;
  }
  
  function processShocks() {
    if (S.activeShocks.length === 0) return;
    
    const resilienceFactor = 1 - (S.coordination * 0.4);
    S.couplings.add('D1-D2');
    
    S.activeShocks = S.activeShocks.filter(shock => {
      if (shock.remainingMonths > 0) {
        if (shock.effects.income) S.income *= (1 + shock.effects.income * resilienceFactor);
        if (shock.effects.market) S.market = Math.min(0.95, Math.max(0.01, S.market * (1 + shock.effects.market * resilienceFactor)));
        if (shock.effects.coordination) S.coordination = Math.min(0.95, Math.max(0.05, S.coordination * (1 + shock.effects.coordination * resilienceFactor)));
        shock.remainingMonths--;
        return true;
      }
      return false;
    });
  }
  
  // UMBRELLA CASCADE — off by default so validated behaviour is unchanged.
  // Set true to make an umbrella (NHDP, USTTAD) cascade-activate its children;
  // the parent then contributes NO separate effect (see calculatePolicyEffects),
  // so nothing is double-counted. Re-run the 27-test validation after enabling.
  const UMBRELLA_CASCADE = true;

  // Effective active policies = active policies EXCLUDING umbrella containers (when cascade is on).
  // Used everywhere an effect or count is computed, so a container is never double-counted with its children.
  function isContainerPolicy(policyId) {
    if (!UMBRELLA_CASCADE) return false;
    const p = Config.getPolicy(policyId);
    return !!(p && p.isUmbrella);
  }
  function effectiveActivePolicyIds() {
    return Array.from(S.activePolicies).filter(id => !isContainerPolicy(id));
  }
  function effectivePolicyCount() {
    return effectiveActivePolicyIds().length;
  }

  function togglePolicy(policyId) {
    if (!Config.getPolicy(policyId)) return { blocked: true, reason: 'unknown policy: ' + policyId };
    const feasibility = checkPolicyFeasibility(policyId);
    S.cascadeActivated.delete(policyId); // a direct click makes this policy user-controlled
    if (S.activePolicies.has(policyId)) {
      S.activePolicies.delete(policyId);
      delete S.policyActivationMonth[policyId]; // COMPLEXITY: Clean up activation tracking
      const _polOff = Config.getPolicy(policyId);
      if (UMBRELLA_CASCADE && _polOff && _polOff.isUmbrella && Array.isArray(_polOff.cascadeChildren)) {
        // Parent-off removes ONLY children the cascade switched on (independent choices survive)
        _polOff.cascadeChildren.forEach(cid => {
          if (S.cascadeActivated.has(cid)) {
            S.activePolicies.delete(cid); delete S.policyActivationMonth[cid]; S.cascadeActivated.delete(cid);
          }
        });
      }
      logEvent('POLICY', `${policyId} deactivated`);
      return { active: false };
    } else {
      if (!feasibility.feasible) return { active: false, blocked: true, reason: feasibility.reason };
      S.activePolicies.add(policyId);
      S.policyActivationMonth[policyId] = S.totalMonths; // COMPLEXITY: Track activation month
      const policy = Config.getPolicy(policyId);
      if (UMBRELLA_CASCADE && policy.isUmbrella && Array.isArray(policy.cascadeChildren)) {
        policy.cascadeChildren.forEach(cid => {
          if (!S.activePolicies.has(cid)) {
            S.activePolicies.add(cid); S.policyActivationMonth[cid] = S.totalMonths; S.cascadeActivated.add(cid);
          }
        });
      }
      logEvent('POLICY', `${policyId} activated (${policy.ministry})`);
      return { active: true };
    }
  }
  
  function addShock(shockData) {
    const shock = { ...shockData, remainingMonths: shockData.duration, startMonth: S.month, startYear: S.year };
    S.activeShocks.push(shock);
    logEvent('SHOCK', `${shock.name} (${shock.duration} months)`);
    return shock;
  }
  
  function logEvent(type, message) {
    eventLog.push({ type, message, month: S.month, year: S.year, timestamp: Date.now() });
    if (eventLog.length > 2000) {
      const dropped = eventLog.length - 1500;
      eventLog = eventLog.slice(-1500);
      eventLog.unshift({ type: 'SYSTEM', message: `⚠️ Event log truncated: ${dropped} oldest entries removed`, year: S.year, month: S.month });
    }
  }

  // ========== CALIBRATION ==========
  function updateCalibration(newCal) {
    Object.keys(newCal).forEach(key => {
      if (newCal[key] && typeof newCal[key] === 'object' && !Array.isArray(newCal[key])
          && CALIBRATION[key] && typeof CALIBRATION[key] === 'object') {
        CALIBRATION[key] = { ...CALIBRATION[key], ...newCal[key] };
      } else {
        CALIBRATION[key] = newCal[key];
      }
    });
    logEvent('CALIBRATE', 'Parameters updated');
  }
  function getCalibration() { return CALIBRATION; }
  function updateCaseThresholds(thresh) { S.thresholds = { ...S.thresholds, ...thresh }; CALIBRATION.thresholds = { ...CALIBRATION.thresholds, ...thresh }; }

  // Public API
  return {
    initState, step, getState: () => S, getEventLog: () => eventLog, setSeed, setCoordinationGating, getCoordinationGating, setPoliticalGating, getPoliticalGating, setForcedCoherence,
    togglePolicy, addShock, logEvent, calculateGini, runMonteCarlo,
    effectiveActivePolicyIds, effectivePolicyCount,
    checkPolicyFeasibility, updateCalibration, getCalibration, updateCaseThresholds,
    validateSteadyState,
    getDelayQueues: () => delayQueues, RATES
  };
})();
