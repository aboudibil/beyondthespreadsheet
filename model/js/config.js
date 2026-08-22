/* ╔════════════════════════════════════════════════════════════════════════════╗
   ║  CPAF v6 - config.js                                                        ║
   ║  Configuration: Thresholds, Case Studies, Policies, Dimensions              ║
   ╠════════════════════════════════════════════════════════════════════════════╣
   ║  SECTION MAP:                                                               ║
   ║  Line 1-50:      File header & section map                                  ║
   ║  Line 51-100:    THRESHOLDS                                                 ║
   ║  Line 101-200:   CASE_STUDIES                                               ║
   ║  Line 201-450:   POLICIES                                                   ║
   ║  Line 451-600:   DIMENSIONS_DATA                                            ║
   ║  Line 601-700:   LOOPS_DATA                                                 ║
   ║  Line 701-800:   STOCKS_DATA                                                ║
   ║  Line 801-900:   EQUATION_PARAMS                                            ║
   ╚════════════════════════════════════════════════════════════════════════════╝ */

const Config = (function() {
  'use strict';

  // ========== SECTION: THRESHOLDS ==========
  const THRESHOLDS = {
    TRAP: 2000,           // ₹/mo. Poverty line (World Bank $3.00/day 2021 PPP ≈ Rangarajan rural line, 2023-24). Below = poverty trap.
    GROWTH: 4122,         // ₹/mo. Rural average MPCE, HCES 2023-24 (PIB, India's Poverty Story Transformed, Jun 2025). Above sustained = viable livelihood.
    TRAP_DURATION: 6,     // Months to confirm trap state
    GROWTH_DURATION: 12,  // Months to confirm growth state
    FALL_DURATION: 3,     // Months to confirm fall back
    COMPETITION_START: 280000,  // Population where competition kicks in
    CAPACITY_LIMIT: 350000,     // Maximum sustainable population
    // FIX #41: Configurable recommendation thresholds
    COORD_LOW: 0.3,       // Below = "coordination crisis"
    COORD_MED: 0.5,       // Below = "coordination limited"
    GINI_HIGH: 0.45,      // Above = "high inequality"
    POLITICAL_LOW: 0.3    // Below = "low political support"
  };
  // ========== END: THRESHOLDS ==========

  // ========== SECTION: ENTRY_EXIT_RATES ==========
  const RATES = {
    TRAP: { entry: 0.01, exit: 0.05 },
    TRANSITION: { entry: 0.03, exit: 0.03 },
    GROWTH: { entry: 0.05, exit: 0.01 }
  };
  // ========== END: ENTRY_EXIT_RATES ==========

  // ========== SECTION: CASE_STUDIES ==========
  const CASE_STUDIES = {
    chikankari: {
      id: 'chikankari',
      name: 'Chikankari',
      craft_type: 'Embroidery',
      location: {
        district: 'Lucknow',
        state: 'Uttar Pradesh',
        coordinates: [26.8467, 80.9462]
      },
      gi_registered: true,
      initial: {
        population: 250000,
        income: 4100,
        skills: 0.55,
        market: 0.30,
        middlemen: 0.80,
        coordination: 0.30,
        heritage: 0.70,
        political: 0.50
      },
      segments: {
        A: { share: 0.60, multiplier: 0.85, name: 'Subsistence' },
        B: { share: 0.30, multiplier: 1.00, name: 'Traditional' },
        C: { share: 0.10, multiplier: 1.40, name: 'Market-Ready' }
      },
      spatial: {
        urban: 1.0,
        peri_urban: 0.7,
        rural: 0.4
      },
      context: {
        key_challenge: 'middlemen_exploitation',
        primary_ministry: 'Textiles',
        gender_ratio: 0.70,  // 70% women
        urban_rural: 0.40    // 40% urban
      },
      bounds: {
        populationFloor: 1000,
        middlemenFloor: 0.20,
        middlemenCeiling: 0.95
      },
      source: "Population (250,000): Singh, L. B. (2020), ODOP Scheme for Local Craft Governance — Chikankari Entrepreneur's Perspective, GRFCG, Corporate Governance Insight 2(1). Income (₹4,100/mo): Singh, R. & Shah, P. (2023), The Pharma Innovation Journal 12(1), 1276–1279.",
      notes: 'Lucknow embroidery cluster, severe middlemen control (80%), mostly women workers'
    },
    
    cheriyal: {
      id: 'cheriyal',
      name: 'Cheriyal',
      craft_type: 'Scroll Painting',
      location: {
        district: 'Warangal',
        state: 'Telangana',
        coordinates: [17.9784, 79.6010]
      },
      gi_registered: true,
      initial: {
        population: 20,
        income: 5000,
        skills: 0.75,
        market: 0.25,
        middlemen: 0.05,
        coordination: 0.45,
        heritage: 0.85,
        political: 0.55
      },
      segments: {
        A: { share: 0.30, multiplier: 0.90, name: 'Subsistence' },
        B: { share: 0.50, multiplier: 1.00, name: 'Traditional' },
        C: { share: 0.20, multiplier: 1.30, name: 'Market-Ready' }
      },
      spatial: {
        urban: 1.0,
        peri_urban: 0.8,
        rural: 0.5
      },
      context: {
        key_challenge: 'market_visibility',
        primary_ministry: 'Textiles',
        gender_ratio: 0.40,  // 40% women
        urban_rural: 0.30    // 30% urban
      },
      bounds: {
        populationFloor: 5,
        middlemenFloor: 0.05,
        middlemenCeiling: 0.95
      },
      source: 'Population (20): Fernandes, K. (2025), ETV Bharat, 30 Sep 2025. Income (₹5,000/mo): TNM Staff (2020), The News Minute, 7 Sep 2020.',
      notes: 'Near-extinction cluster: 3-4 families (~25 individuals), no middlemen, direct sales, heritage preservation case'
    }
  };
  // ========== END: CASE_STUDIES ==========

  // ========== SECTION: POLICIES ==========
  const POLICIES = {
    // MINISTRY OF TEXTILES
    NHDP: {
      id: 'NHDP',
      name: 'National Handicraft Development Programme',
      isUmbrella: true,
      cascadeChildren: ['AMBEDKAR_HASTSHILP','MARKETING_SUPPORT','HERITAGE_AWARDS'],
      ministry: 'Textiles',
      type: 'structural',
      budget: 200,  // Crores
      coverage: 0.40,
      effects: {
        skills: 0.15,
        market: 0.10,
        income: 0.05,
        middlemen: 0,
        coordination: 0.05,
        heritage: 0.05
      },
      targeting: {
        segments: ['A', 'B', 'C'],
        minority_only: false
      },
      mechanism: 'Design development centers, exhibitions, credit linkage',
      limitations: ['Effect sizes from policy documents', 'Assumes uniform implementation'],
      source: 'https://indian.handicrafts.gov.in/static-pdf/scheme-guideline.pdf',
      active: false
    },
    
    AMBEDKAR_HASTSHILP: {
      id: 'AMBEDKAR_HASTSHILP',
      name: 'Ambedkar Hastshilp Vikas Yojana',
      parentProgramme: 'NHDP',
      ministry: 'Textiles',
      type: 'welfare',
      budget: 30,
      coverage: 0.15,
      effects: {
        skills: 0.10,
        market: 0.05,
        income: 0.03,
        middlemen: 0,
        coordination: 0.02,
        heritage: 0.02
      },
      targeting: {
        segments: ['A', 'B'],
        minority_only: false
      },
      mechanism: 'SC/ST artisan development, toolkits, training',
      limitations: ['Targets SC/ST artisans specifically'],
      source: 'https://indian.handicrafts.gov.in/static-pdf/scheme-guideline.pdf',
      active: false
    },
    
    MARKETING_SUPPORT: {
      id: 'MARKETING_SUPPORT',
      name: 'Marketing Support & Services',
      parentProgramme: 'NHDP',
      ministry: 'Textiles',
      type: 'market',
      budget: 50,
      coverage: 0.25,
      effects: {
        skills: 0,
        market: 0.15,
        income: 0.08,
        middlemen: -0.05,
        coordination: 0.03,
        heritage: 0
      },
      targeting: {
        segments: ['A', 'B', 'C'],
        minority_only: false
      },
      mechanism: 'Exhibitions, buyer-seller meets, e-commerce facilitation',
      limitations: ['Access biased toward connected artisans', 'Subsistence artisans need facilitation to participate'],
      source: 'https://indian.handicrafts.gov.in/static-pdf/scheme-guideline.pdf',
      active: false
    },
    
    // MINISTRY OF MSME
    SFURTI: {
      id: 'SFURTI',
      name: 'Scheme of Fund for Regeneration of Traditional Industries',
      ministry: 'MSME',
      type: 'structural',
      budget: 150,
      coverage: 0.30,
      effects: {
        skills: 0.10,
        market: 0.12,
        income: 0.08,
        middlemen: -0.10,
        coordination: 0.15,
        heritage: 0.05
      },
      targeting: {
        segments: ['A', 'B', 'C'],
        minority_only: false
      },
      mechanism: 'Common Facility Centers, raw material banks, design inputs, cluster development',
      limitations: ['Cluster-level effects vary by implementation quality'],
      source: 'https://msme.gov.in/sites/default/files/SFURTI_GUIDELINES_REVISED_0.pdf',
      active: false
    },
    
    PMEGP: {
      id: 'PMEGP',
      name: 'PM Employment Generation Programme',
      ministry: 'MSME',
      type: 'market',
      budget: 2500,
      coverage: 0.20,
      effects: {
        skills: 0.05,
        market: 0.08,
        income: 0.10,
        middlemen: -0.03,
        coordination: 0.02,
        heritage: 0
      },
      targeting: {
        segments: ['B', 'C'],
        minority_only: false
      },
      mechanism: 'Subsidy for new unit setup, 25-35% of project cost',
      limitations: ['Targets general MSME, not craft-specific', 'Requires bank linkage'],
      source: 'https://msme.gov.in/sites/default/files/PMEGP%20guidelinesfinal.pdf',
      active: false
    },
    
    PM_VISHWAKARMA: {
      id: 'PM_VISHWAKARMA',
      name: 'PM Vishwakarma Yojana',
      ministry: 'MSME',
      type: 'welfare',
      budget: 13000,
      coverage: 0.50,
      effects: {
        skills: 0.12,
        market: 0.05,
        income: 0.15,
        middlemen: -0.05,
        coordination: 0.05,
        heritage: 0.08
      },
      targeting: {
        segments: ['A', 'B', 'C'],
        minority_only: false
      },
      mechanism: 'Recognition, skill training, toolkit, credit support, digital empowerment',
      limitations: ['New policy (2023), effects projected'],
      source: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=1959098',
      active: false
    },
    
    CLUSTER_DEV: {
      id: 'CLUSTER_DEV',
      name: 'MSME Cluster Development Programme',
      ministry: 'MSME',
      type: 'structural',
      budget: 100,
      coverage: 0.25,
      effects: {
        skills: 0.08,
        market: 0.10,
        income: 0.06,
        middlemen: -0.05,
        coordination: 0.12,
        heritage: 0.03
      },
      targeting: {
        segments: ['A', 'B', 'C'],
        minority_only: false
      },
      mechanism: 'Soft interventions, hard interventions, CFC establishment',
      limitations: ['Cluster selection criteria may exclude remote areas'],
      source: 'https://dcmsme.gov.in/schemes/New%20MSE-CDP.pdf',
      active: false
    },
    
    // MINISTRY OF MINORITY AFFAIRS
    USTTAD: {
      id: 'USTTAD',
      name: 'USTTAD (Upgrading Skills & Training in Traditional Arts/Crafts)',
      parentProgramme: 'PM Vikas',
      isUmbrella: true,
      cascadeChildren: ['HUNAR_HAAT'],
      ministry: 'Minority Affairs',
      type: 'welfare',
      budget: 50,
      coverage: 0.30,
      effects: {
        skills: 0.15,
        market: 0.08,
        income: 0.08,
        middlemen: 0,
        coordination: 0.05,
        heritage: 0.20
      },
      targeting: {
        segments: ['A', 'B'],
        minority_only: true
      },
      mechanism: 'Skill upgradation, design development, market linkage for minority artisans',
      limitations: ['Minority community targeting', 'Limited scale'],
      source: 'https://pmvikas.minorityaffairs.gov.in/uploads/documents/Guidelines-PM-VIKAS.pdf',
      active: false
    },
    
    HUNAR_HAAT: {
      id: 'HUNAR_HAAT',
      name: 'Hunar Haat',
      parentProgramme: 'USTTAD',
      sharesBudgetWith: 'USTTAD',
      ministry: 'Minority Affairs',
      type: 'market',
      budget: 30,
      coverage: 0.15,
      effects: {
        skills: 0,
        market: 0.12,
        income: 0.10,
        middlemen: -0.08,
        coordination: 0.03,
        heritage: 0.02
      },
      targeting: {
        segments: ['A', 'B', 'C'],
        minority_only: true
      },
      mechanism: 'Exhibition-cum-sale events for minority artisans',
      limitations: ['Periodic events, not continuous support'],
      source: 'https://www.pib.gov.in/newsite/PrintRelease.aspx?relid=200151',
      active: false
    },
    
    NAI_ROSHNI: {
      id: 'NAI_ROSHNI',
      name: 'Nai Roshni',
      parentProgramme: 'PM Vikas',
      ministry: 'Minority Affairs',
      type: 'welfare',
      budget: 40,
      coverage: 0.20,
      effects: {
        skills: 0.08,
        market: 0.03,
        income: 0.05,
        middlemen: 0,
        coordination: 0.02,
        heritage: 0
      },
      targeting: {
        segments: ['A'],
        minority_only: true
      },
      mechanism: 'Leadership development for minority women',
      limitations: ['Women-focused', 'Indirect craft impact'],
      source: 'https://pmvikas.minorityaffairs.gov.in/uploads/documents/Guidelines-PM-VIKAS.pdf',
      active: false
    },
    
    // MINISTRY OF CULTURE
    GURU_SHISHYA: {
      id: 'GURU_SHISHYA',
      name: 'Hamari Dharohar',
      parentProgramme: 'PM Vikas',
      ministry: 'Minority Affairs',
      type: 'welfare',
      budget: 12,
      coverage: 0.08,
      effects: {
        skills: 0.03,
        market: 0,
        income: 0.02,
        middlemen: 0,
        coordination: 0.02,
        heritage: 0.30
      },
      targeting: {
        segments: ['A', 'B', 'C'],
        minority_only: true
      },
      mechanism: 'Curation and preservation of minority heritage \u2014 exhibitions, documentation, literature',
      limitations: ['Very small budget (RE \u20B92\u201312 Cr/yr)', 'Historically under-utilised', 'Effect sizes illustrative'],
      source: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=1909889',
      active: false
    },
    
    GI_REGISTRATION: {
      id: 'GI_REGISTRATION',
      name: 'GI Registration & Enforcement',
      linkedProgramme: 'PM Vikas (run by Commerce/DPIIT)',
      ministry: 'Commerce',
      type: 'market',
      budget: 10,
      coverage: 0.60,
      effects: {
        skills: 0,
        market: 0.12,
        income: 0.08,
        middlemen: -0.02,
        coordination: 0.05,
        heritage: 0.15
      },
      targeting: {
        segments: ['A', 'B', 'C'],
        minority_only: false
      },
      mechanism: 'Legal IP protection, brand differentiation, premium pricing',
      limitations: ['Requires awareness', 'Enforcement challenges'],
      source: 'https://ipindia.gov.in/gi-introduction',
      active: false
    },
    
    HERITAGE_AWARDS: {
      id: 'HERITAGE_AWARDS',
      name: 'National Heritage Awards',
      parentProgramme: 'NHDP',
      ministry: 'Textiles',
      type: 'welfare',
      budget: 5,
      coverage: 0.02,
      effects: {
        skills: 0.05,
        market: 0.08,
        income: 0.05,
        middlemen: 0,
        coordination: 0.01,
        heritage: 0.10
      },
      targeting: {
        segments: ['C'],
        minority_only: false
      },
      mechanism: 'Recognition and cash awards for master craftspersons',
      limitations: ['Very limited coverage', 'Individual recognition only'],
      source: 'https://indian.handicrafts.gov.in/static-pdf/scheme-guideline.pdf',
      active: false
    },
    
    // MINISTRY OF COMMERCE
    MAI: {
      id: 'MAI',
      name: 'Market Access Initiative',
      linkedProgramme: 'PM Vikas (run by Commerce)',
      ministry: 'Commerce',
      type: 'market',
      budget: 200,
      coverage: 0.15,
      effects: {
        skills: 0,
        market: 0.18,
        income: 0.12,
        middlemen: -0.05,
        coordination: 0.03,
        heritage: 0
      },
      targeting: {
        segments: ['C'],
        minority_only: false
      },
      mechanism: 'Export promotion, international exhibitions, market research',
      limitations: ['Export-oriented only', 'Benefits larger producers'],
      source: 'https://www.epch.in/marketing-access-assistance',
      active: false
    },
    
    TIES: {
      id: 'TIES',
      name: 'Trade Infrastructure for Export Scheme',
      ministry: 'Commerce',
      type: 'structural',
      budget: 100,
      coverage: 0.10,
      effects: {
        skills: 0,
        market: 0.10,
        income: 0.05,
        middlemen: -0.02,
        coordination: 0.08,
        heritage: 0
      },
      targeting: {
        segments: ['B', 'C'],
        minority_only: false
      },
      mechanism: 'Export infrastructure, testing facilities, warehousing',
      limitations: ['Infrastructure focus, not direct artisan support'],
      source: 'https://capexil.org/ties-scheme/',
      active: false
    },
    
    // CROSS-MINISTRY / STATE
    ODOP: {
      id: 'ODOP',
      name: 'One District One Product',
      ministry: 'Commerce',
      type: 'structural',
      budget: 500,
      coverage: 0.40,
      effects: {
        skills: 0.08,
        market: 0.15,
        income: 0.10,
        middlemen: -0.05,
        coordination: 0.10,
        heritage: 0.08
      },
      targeting: {
        segments: ['A', 'B', 'C'],
        minority_only: false
      },
      mechanism: 'District-level branding, export facilitation, cluster development',
      limitations: ['Implementation varies significantly by state'],
      source: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2217539',
      active: false
    },
    
    ECOMMERCE: {
      id: 'ECOMMERCE',
      name: 'E-Commerce Platforms (GeM, Amazon Karigar)',
      linkedProgramme: 'PM Vikas (run by MSME)',
      ministry: 'MSME',
      type: 'market',
      budget: 50,
      coverage: 0.20,
      effects: {
        skills: 0.02,
        market: 0.20,
        income: 0.15,
        middlemen: -0.15,
        coordination: 0.02,
        heritage: 0
      },
      targeting: {
        segments: ['B', 'C'],
        minority_only: false
      },
      mechanism: 'Direct market access via online platforms',
      limitations: ['Digital literacy required', 'Logistics challenges for rural artisans'],
      source: 'https://msme.gov.in/sites/default/files/Scheme-booklet-Eng.pdf',
      active: false
    }
  };
  // ========== END: POLICIES ==========

  // ========== SECTION: DIMENSIONS_DATA ==========
  const DIMENSIONS = {
    D1: {
      id: 'D1',
      name: 'Graph Theory / Network Analysis',
      shortName: 'Coordination',
      theory: 'Network Governance Theory',
      references: 'Provan & Milward (2001); Granovetter (1973)',
      description: 'Network density across TWO distinct streams: (a) the ARTISAN co-op (artisans organising with each other, building bargaining power) and (b) INTER-MINISTRY coherence between the 5 agencies (Textiles, MSME, Minority Affairs, Commerce, Culture, giving delivery quality). Low inter-ministry density = fragmented implementation.',
      formula: 'C_eff = {{COORD_FLOOR}} + {{COORD_WEIGHT}} × Inter-Ministry_Density   (the delivery multiplier)',
      mechanism: 'Two streams, not one: denser inter-ministry links raise C_eff so every policy effect is delivered better; denser artisan links build bargaining capacity that, with a market channel, breaks the middleman. Separating these two is the re-rooting.',
      empirical: 'The actor network follows network-governance theory. Coordination values are assumed, illustrative of how Indian craft-policy bodies relate.',
      variables: ['Network Density', 'Coordination Effect', 'Ministry Linkages'],
      color: '#059669'
    },
    D2: {
      id: 'D2',
      name: 'Attractor Analysis',
      shortName: 'System State',
      theory: 'Dynamical Systems / Poverty Trap Theory',
      references: 'Meadows (2008); Azariadis & Stachurski (2005); Scheffer et al. (2001)',
      description: 'System exists in one of three states: TRAP (self-reinforcing decline), TRANSITION (unstable), GROWTH (self-reinforcing improvement).',
      formula: 'T ∈ {TRAP, TRANSITION, GROWTH}\nTRAP→TRANS: Income > {{THR_TRAP}} for {{TRAP_DUR}}mo\nTRANS→GROWTH: Income > {{THR_GROWTH}} for {{GROWTH_DUR}}mo',
      mechanism: 'Below threshold = high exit, low entry. Above = virtuous cycle.',
      empirical: 'The trap and growth states follow attractor theory. The income thresholds are plausible values informed by the livelihoods literature.',
      variables: ['System State', 'Income Threshold', 'Retention Rate'],
      color: '#d97706'
    },
    D3: {
      id: 'D3',
      name: 'Narrative Policy Framework',
      shortName: 'Political',
      theory: 'NPF / Coalition Theory',
      references: 'Jones & McBeth (2010); Sabatier (1988)',
      description: 'Political feasibility modeled as P ∈ [0,1]. P<0.3 blocks welfare. P>0.7 blocks market. Shifts based on policy outcomes.',
      formula: 'P_new = P + ΔP_outcome + ΔP_inequality + ΔP_crisis',
      mechanism: 'Policy success → narrative shifts toward that type. Crisis → welfare pressure.',
      empirical: 'The coalition and narrative structure follows the Narrative Policy Framework, and is illustrative.',
      variables: ['Political Orientation (P)', 'Coalition Strength', 'Narrative Dominance'],
      color: '#7c3aed'
    },
    D4: {
      id: 'D4',
      name: 'System Dynamics',
      shortName: 'Feedback Loops',
      theory: 'Stock-Flow Modeling',
      references: 'Sterman (2000); Forrester (1961)',
      description: 'Core simulation engine with 5 stocks, 2 reinforcing loops (R1-R2), 3 balancing loops (B1-B3).',
      formula: 'dStock/dt = Inflows − Outflows\nIncome = f(Market, Skills, Middlemen, Coordination)',
      mechanism: 'Feedback loops create non-linear dynamics, delays, and emergent behavior.',
      empirical: 'The stock-and-flow structure follows system-dynamics theory. The initial population and average-income values are drawn from documented sources for each case (Singh 2020 and Singh & Shah 2023 for Chikankari; ETV Bharat 2025 and The News Minute 2020 for Cheriyal); the rates and flows connecting them are literature-informed or assumed.',
      variables: ['Population', 'Income', 'Skills', 'Market Access', 'Middlemen Control'],
      color: '#2563eb'
    },
    D5: {
      id: 'D5',
      name: 'Spatiotemporal Analysis',
      shortName: 'Geography',
      theory: "Spatial Economics / Tobler's Law",
      references: 'Anselin (1988); Tobler (1970)',
      description: 'Geography modifies policy reach. Urban clusters have full access (×1.0), peri-urban partial (×0.7), rural limited (×0.4).',
      formula: 'Spatial_Mult = f(Infrastructure, Distance)\nPolicy_Reach = Base × Spatial_Mult',
      mechanism: 'Distance decay reduces policy effectiveness in remote areas.',
      empirical: 'The spatial structure follows spatial-analysis theory. The location multipliers are assumed and illustrative.',
      variables: ['Infrastructure Index', 'Distance (km)', 'Spatial Multiplier'],
      color: '#0891b2'
    },
    D6: {
      id: 'D6',
      name: 'Agent-Based Modeling',
      shortName: 'Segments',
      theory: 'Computational Social Science',
      references: 'Epstein & Axtell (1996); Schelling (1971)',
      description: 'Heterogeneous artisan segments with different income levels and policy access.',
      formula: 'Segment_Income = Avg × Multiplier × Spatial\nGini = Σ|diff| / (2n×mean)',
      mechanism: 'Micro-level heterogeneity produces macro-level inequality.',
      empirical: "The artisan segments follow agent-based modelling. The case income figures draw on the documented sources above; the segment proportions and behavioural rules are assumed, illustrative values.",
      variables: ['Segment Shares', 'Segment Incomes', 'Gini Coefficient'],
      color: '#db2777'
    },
    D7: {
      id: 'D7',
      name: 'Monte Carlo Simulation',
      shortName: 'Uncertainty',
      theory: 'Uncertainty Quantification',
      references: 'Saltelli et al. (2008); Metropolis & Ulam (1949)',
      description: 'All parameters varied ±15% across runs to generate confidence intervals.',
      formula: 'CI_95 = [Percentile_2.5, Percentile_97.5]\nSensitivity = Var(Output|Param) / Var(Output)',
      mechanism: 'Quantifies robustness of conclusions under parameter uncertainty.',
      empirical: 'The parameter ranges are reasoned assumptions, some informed by the literature.',
      variables: ['Mean Outcome', '95% CI', 'Sensitivity Indices'],
      color: '#64748b'
    }
  };
  // ========== END: DIMENSIONS_DATA ==========

  // ========== SECTION: LOOPS_DATA ==========
  const LOOPS = {
    R1: {
      id: 'R1',
      name: 'R1: Skill-Income Reinforcing',
      type: 'Reinforcing',
      description: 'Higher income enables skill investment → higher quality → higher demand → higher income.',
      path: 'Income →(+) Training →(+) Skills →(+) Quality →(+) Demand →(+) Income',
      equation: 'dSkills/dt = income_effect × training_efficiency × (1 - skills)',
      reference: 'Sterman (2000); Human capital theory',
      strength: 1.0,
      enabled: true
    },
    R2: {
      id: 'R2',
      name: 'R2: Market Access Cycle',
      type: 'Reinforcing',
      description: 'Market reputation drives income: better products reach more buyers, generating revenue that funds further quality improvements. In the income equation, market access multiplied by premium yields the market effect on income.',
      path: 'Market_Access →(+) Revenue →(+) Quality_Investment →(+) Market_Reputation',
      equation: 'Market_Effect = Market × market_premium × R2_strength',
      reference: 'Market access theory; Gereffi (2005) Value Chain Governance',
      strength: 1.0,
      enabled: true
    },
    B1: {
      id: 'B1',
      name: 'B1: Middlemen Exploitation',
      type: 'Balancing',
      description: 'Higher production → more supply → stronger middlemen power → lower prices.',
      path: 'Production →(+) Supply →(+) Middlemen_Power →(−) Price →(−) Income',
      equation: 'Income = Market_Price × (1 − Middlemen_Capture)',
      reference: 'Value chain analysis; Gereffi (2005)',
      strength: 1.0,
      enabled: true
    },
    B2: {
      id: 'B2',
      name: 'B2: Resource Constraints',
      type: 'Balancing',
      description: 'Higher capacity → material demand → cost increases → margin squeeze.',
      path: 'Capacity →(+) Material_Demand →(+) Costs →(−) Margin',
      equation: 'Margin = Revenue − (Fixed + Variable_Costs)',
      reference: 'Production economics; Sterman (2000)',
      strength: 1.0,
      enabled: true
    },
    B3: {
      id: 'B3',
      name: 'B3: Heritage Dilution',
      type: 'Balancing',
      description: 'High market demand with low skills → mass production shortcuts → heritage erosion → loss of authenticity premium → lower income. Loop closes via heritage affecting price premium.',
      path: 'Market(+) & Skills(−) →(+) Mass_Production →(−) Heritage →(−) Price_Premium →(−) Income',
      equation: 'Heritage_Erosion = (market > 0.6 & skills < 0.6) × {{MASS_PROD}}; Income_Premium = (heritage − 0.5) × rate',
      reference: 'Liebl & Roy (2003); UNESCO intangible heritage',
      strength: 1.0,
      enabled: true
    },
    'R-COHERE': {
      id: 'R-COHERE',
      name: 'R-COHERE: Inter-Ministry Delivery Coherence',
      type: 'Reinforcing',
      description: 'Coordinated agencies deliver policy more effectively (higher C_eff), and effective delivery builds further institutional coordination. C_eff scales EVERY policy effect. This is the INTER-MINISTRY stream — distinct from artisan co-op capacity: a well-coordinated state can still deliver a badly-designed programme perfectly.',
      path: 'Institution_Policies →(+) Policy_Coherence →(+) Delivery_Effectiveness (C_eff) →(+) Policy_Impact',
      equation: 'C_eff = base + Σ coherenceContribution − fragmentation ; effect_delivered = effect × C_eff',
      reference: 'Peters (2015) Pursuing Horizontal Management of Government',
      strength: 1.0,
      enabled: true
    },
    'R-COOP': {
      id: 'R-COOP',
      name: 'R-COOP: Artisan Collective Action',
      type: 'Reinforcing',
      description: 'Artisans organising WITH EACH OTHER build collective bargaining capacity through a critical-mass threshold; visible success reinforces participation. This is the ARTISAN stream — the co-op is the lever that, combined with a market channel, breaks the middleman.',
      path: 'Cluster/Institution_Policies →(+) Artisan_Coordination →(critical mass) →(+) Bargaining_Capacity',
      equation: 'dCoordination = Σ(cluster coordination × coverage) shaped by an S-curve (critical mass)',
      reference: 'Ostrom (1990) Governing the Commons; Granovetter (1978) threshold models; SEWA',
      strength: 1.0,
      enabled: true
    },
    'R-COUNTER': {
      id: 'R-COUNTER',
      name: 'R-COUNTER: Countervailing Power (co-op × channel)',
      type: 'Reinforcing',
      description: 'Organised artisans WITH an outside market channel gain a credible threat to sell elsewhere, breaking the middleman monopsony and raising the share the artisan keeps. The AND-gate: neither the co-op alone (no leverage) nor the channel alone (price-taker) suffices — only their product.',
      path: 'Artisan_Coordination × Market_Channel →(−) Middleman_Markdown →(+) Artisan_Share →(+) Income',
      equation: 'Δmiddlemen ∝ −(coordination × channel_access)',
      reference: 'Galbraith (1952) American Capitalism: The Concept of Countervailing Power',
      strength: 1.0,
      enabled: true
    },
    'B-FRAG': {
      id: 'B-FRAG',
      name: 'B-FRAG: Portfolio Fragmentation',
      type: 'Balancing',
      description: 'A sprawling, uncoordinated policy portfolio lowers inter-ministry coherence, throttling the delivery of every policy at once. Six coordinated policies can out-deliver seventeen fragmented ones (C_eff 0.79 vs 0.37).',
      path: 'Policy_Count →(+) Fragmentation →(−) Policy_Coherence →(−) Delivery_Effectiveness',
      equation: 'policyCoherence = base + Σ coherenceContribution − frag_coeff × active_count',
      reference: 'Peters (2015); Bardhan (2002) Decentralization of Governance',
      strength: 1.0,
      enabled: true
    },
    'R-CREDIT': {
      id: 'R-CREDIT',
      name: 'R-CREDIT: Middleman Credit Lock-in (vicious trap)',
      type: 'Reinforcing',
      description: 'While trapped, artisans depend on middleman advances (thread, dye, raw materials), which deepen dependency and GROW the middleman\'s power — a self-reinforcing trap that actively resists escape while income is low.',
      path: 'Low_Income →(+) Credit_Dependency →(+) Middleman_Power →(−) Artisan_Share →(−) Income',
      equation: 'Δmiddlemen += credit_lock_in  while  income < subsistence × 1.15',
      reference: 'Harriss-White (2003) India Working; interlocked factor markets',
      strength: 1.0,
      enabled: true
    }
  };
  // ========== END: LOOPS_DATA ==========

  // ========== SECTION: STOCKS_DATA ==========
  const STOCKS = {
    coordination: { id:'coordination', name:'Artisan Co-op (coordination)', unit:'Index (0-1)',
      description:'How far artisans are organised WITH EACH OTHER — the cluster/co-op bargaining stream. Built by cluster-investment policies once they cross a critical-mass threshold; combined with a market channel it breaks the middleman monopsony (countervailing power).',
      equation:'dCoordination = S-curve( Sum of cluster coordination x coverage ) - Olson inequality drag',
      source:'Ostrom (1990) Governing the Commons; Granovetter (1978) threshold models; SEWA. Weights illustrative, calibratable.' },
    policyCoherence: { id:'policyCoherence', name:'Inter-Ministry Coherence (C_eff)', unit:'Index (0-1)',
      description:'Inter-ministry delivery quality — how well the agencies coordinate to DELIVER policy. Distinct from the artisan co-op: it is the multiplier (C_eff) scaling EVERY policy effect, so a well-coordinated state can still deliver a badly-designed programme perfectly.',
      equation:'policyCoherence = base + Sum of coherenceContribution - frag x active_count ; effect_delivered = effect x C_eff',
      source:'Peters (2015) Pursuing Horizontal Management of Government; Bardhan (2002). Weights illustrative, calibratable.' },
    skills: {
      id: 'skills',
      name: 'Skilled Artisans',
      unit: 'Index (0-1)',
      description: 'Proportion of artisans with traditional craft skills.',
      equation: 'dSkills/dt = Training − Exit − Erosion',
      source: 'Assumed starting value for the case (0–1 index).'
    },
    market: {
      id: 'market',
      name: 'Market Reputation',
      unit: 'Index (0-1)',
      description: 'Brand recognition and market access level.',
      equation: 'dMarket/dt = Marketing + Quality − Erosion',
      source: 'Assumed starting value for the case (0–1 index).'
    },
    population: {
      id: 'population',
      name: 'Artisan Population',
      unit: 'Persons',
      description: 'Total artisans in craft cluster.',
      equation: 'dPop/dt = Entry − Exit',
      source: "Documented per-case figure — see each case's Source."
    },
    heritage: {
      id: 'heritage',
      name: 'Cultural Heritage Capital',
      unit: 'Index (0-1)',
      description: 'Accumulated traditional knowledge and techniques.',
      equation: 'dHeritage/dt = Transmission − Erosion',
      source: 'The framing of craft skill as intergenerationally-transmitted heritage subject to erosion follows the UNESCO Convention for the Safeguarding of the Intangible Cultural Heritage (2003); the 0–1 level used per case is a reasoned quantification.'
    },
    income: {
      id: 'income',
      name: 'Artisan Income',
      unit: '₹/month',
      description: 'Average monthly income per artisan — a LEVEL set by the current stocks, not a compounding accumulator. It sits on a documented ladder: destitution ₹1,450 (World Bank $2.15/day) < poverty line ₹2,000 (WB $3.00/day, the TRAP threshold) < viable ₹4,122 (rural MPCE, HCES 2023-24, the GROWTH threshold). The AND-gate: rising needs BOTH quality (skills and market) AND a broken middleman (high share) — quality alone with a low share stays trapped, and income falls to destitution when either collapses.',
      equation: 'Income = subsistence + headroom × quality(skills, market) × share(1 − middlemen)',
      source: "Documented per-case figure — see each case's Source."
    },
    middlemen: {
      id: 'middlemen',
      name: 'Middlemen Control',
      unit: 'Index (0-1)',
      description: 'Degree of value chain intermediation. High values indicate artisans sell through middlemen rather than direct market access. Middlemen extract surplus through information asymmetry and credit dependency.',
      equation: 'dMiddlemen/dt = f(Coordination, Market, Income, Policies)',
      source: 'Middlemen extraction in the craft value chain is documented by Wilkinson-Weber (1999) for Lucknow chikankari and, sector-wide, by Liebl & Roy (2003); the 0–1 level used per case is a reasoned quantification of that.'
    },
    capacity: {
      id: 'capacity',
      name: 'Production Capacity',
      unit: 'Units/month',
      description: 'Aggregate production capacity of the craft cluster. Determined by artisan population, skill levels, and available infrastructure. Excess capacity relative to demand triggers competition effects.',
      equation: 'Capacity = Population × Skills × Infrastructure',
      source: 'Computed as Population × Skills × Infrastructure — not a measured or assumed input.'
    }
  };
  // ========== END: STOCKS_DATA ==========

  // ========== SECTION: EQUATION_PARAMS ==========
  const EQUATION_PARAMS = {
    income: {
      base_income: { value: 800, min: 500, max: 2000, label: 'Subsistence Floor (₹)' },
      skill_premium: { value: 0.15, min: 0.05, max: 0.30, label: 'Skill Premium' },
      market_premium: { value: 0.12, min: 0.05, max: 0.25, label: 'Market Premium' },
      coord_multiplier: { value: 0.70, min: 0.50, max: 0.90, label: 'Coordination Range' },
      middlemen_extraction: { value: 0.65, min: 0.30, max: 0.85, label: 'Middlemen Extraction' },
      subsistence: { value: 1450, min: 1000, max: 4000, label: 'Destitution Floor ₹ (level model — WB $2.15/day 2017-PPP extreme-poverty line ≈ ₹1,450, below the ₹2,000 poverty line so a fully-collapsed craft reads TRAP)' },
      headroom: { value: 8000, min: 2000, max: 20000, label: 'Income Headroom ₹ (level model)' }
    },
    skills: {
      training_rate: { value: 0.02, min: 0.01, max: 0.05, label: 'Training Rate' },
      erosion_rate: { value: 0.01, min: 0.005, max: 0.03, label: 'Skill Erosion' },
      income_effect: { value: 0.04, min: 0.02, max: 0.08, label: 'Income Effect on Training' },
      policy_gain: { value: 0.8, min: 0.1, max: 1.0, label: 'Training Delivery (skill gain / policy effect)' }
    },
    market: {
      growth_rate: { value: 0.005, min: 0.001, max: 0.02, label: 'Market Growth Rate' },
      erosion_rate: { value: 0.003, min: 0.001, max: 0.01, label: 'Market Erosion' },
      quality_effect: { value: 0.10, min: 0.05, max: 0.20, label: 'Quality Effect' }
    },
    population: {
      base_entry: { value: 0.03, min: 0.01, max: 0.08, label: 'Base Entry Rate' },
      base_exit: { value: 0.03, min: 0.01, max: 0.08, label: 'Base Exit Rate' },
      income_sensitivity: { value: 0.5, min: 0.2, max: 1.0, label: 'Income Sensitivity' }
    },
    heritage: {
      transmission_rate: { value: 0.02, min: 0.01, max: 0.05, label: 'Transmission Rate' },
      erosion_rate: { value: 0.01, min: 0.005, max: 0.03, label: 'Heritage Erosion' },
      mass_prod_effect: { value: 0.05, min: 0.02, max: 0.10, label: 'Mass Production Impact' }
    },
    coordination: {
      success_boost: { value: 0.05, min: 0.02, max: 0.10, label: 'Success Boost' },
      failure_penalty: { value: 0.08, min: 0.03, max: 0.15, label: 'Failure Penalty' },
      base_decay: { value: 0.01, min: 0.005, max: 0.03, label: 'Base Decay' },
      crit_mass: { value: 0.05, min: 0.02, max: 0.12, label: 'Co-op Critical Mass (organized investment)' },
      threshold_steep: { value: 60, min: 20, max: 120, label: 'Co-op Threshold Steepness' },
      build_rate: { value: 0.02, min: 0.005, max: 0.05, label: 'Co-op Build Rate / step' },
      break_strength: { value: 0.75, min: 0.3, max: 0.9, label: 'Middleman Break Strength (coord×channel)' },
      break_rate: { value: 0.05, min: 0.01, max: 0.1, label: 'Middleman Break Rate / step' }
    }
  };
  // ========== END: EQUATION_PARAMS ==========

  // ========== SECTION: COMPLEXITY_LAYER ==========
  // COMPLEXITY: Transforms model from L1 (linear + dampening) to L3-L4 (genuinely complex)
  // Every parameter is admin-adjustable. Theoretical citations in comments.
  const COMPLEXITY = {
    enabled: true,  // Master switch for entire complexity layer
    
    // --- LAYER 1: Within-Dimension Resistance ---
    // "Success breeds its own friction" — each variable resists its own improvement
    
    policyRampup: {
      enabled: true,
      rampMonths: 36,              // Months to reach full effectiveness (sigmoid curve)
      initialEffectiveness: 0.10,  // Starting at 10% effectiveness (SFURTI takes 2-3 years)
      fatigueStartYear: 4,        // Years before diminishing returns begin
      fatigueRate: 0.06,          // Annual decline in effectiveness after peak (was 0.03)
      // Reference: Baumgartner & Jones (1993) — punctuated equilibrium;
      // SFURTI clusters take 2-3 years to establish (MSME Annual Report 2023)
    },
    
    demandSaturation: {
      enabled: true,
      saturationIncome: 10000,     // Income level where market saturation kicks in (was 16000)
      saturationStrength: 0.85,    // Strength of saturation resistance (was 0.6)
      // Reference: Market saturation theory — demand is finite; craft products
      // at ₹10k+ price points face steep demand curve
    },
    
    stochasticShocks: {
      enabled: true,
      baseFrequency: 0.04,         // Monthly probability (~1 shock per 2 years)
      trapVulnerability: 1.8,      // TRAP state = 80% more vulnerable (was 1.5)
      growthVulnerability: 0.5,    // GROWTH state = 50% less vulnerable
      magnitudeMin: 0.05,          // Minimum income impact (5%, was 3%)
      magnitudeMax: 0.20,          // Maximum income impact (20%, was 15%)
      recoveryRate: 0.4,           // Slower recovery (was 0.7 — shocks were healing too fast)
      // Reference: Real-world non-stationarity — monsoons, demand slumps, 
      // demonetization-like events, political instability
    },
    
    // --- LAYER 2: Between-Dimension Tensions ---
    // "Dimensions in tension" — improving one necessarily resists another
    
    tensions: {
      // T1: Market ↔ Heritage — commercialization erodes authenticity
      marketHeritage: {
        enabled: true,
        marketThreshold: 0.40,     // Market level where heritage erosion begins (was 0.5)
        erosionStrength: 0.025,    // Monthly erosion when market > threshold (was 0.015)
        heritageMarketBrake: 0.60, // Heritage level that brakes market scaling (was 0.7)
        brakeStrength: 0.55,       // How strongly heritage constrains market (was 0.4)
        // Reference: Liebl & Roy (2003) — commercialization of Indian crafts;
        // Scrase (2003) — precarious production under globalization
      },
      
      // T2: Income growth ↔ Middlemen adaptation — they fight back
      middlemenAdaptation: {
        enabled: true,
        adaptationRate: 0.40,      // How aggressively middlemen counter-adapt (was 0.25)
        triggerGrowth: 0.015,      // Lower threshold triggers adaptation sooner (was 0.02)
        maxResurgence: 0.02,       // Maximum monthly middlemen resurgence (was 0.01)
        // Reference: Gereffi, Humphrey & Sturgeon (2005) — "captive" value chains;
        // Middlemen offer credit, lock artisans into relationships when threatened
      },
      
      // T3: Coordination ↔ Institutional friction — more policies = more friction
      coordinationFriction: {
        enabled: true,
        frictionPerPolicy: 0.025,  // Quadratic friction per active policy above 2 (was 0.008)
        maxFriction: 0.12,         // Annual friction cap (was 0.06)
        // Reference: Ostrom (1990) — Governing the Commons;
        // Bardhan (2002) — decentralization and coordination costs
      },
      
      // T4: Skills ↔ Brain drain — success pulls artisans to factories/cities
      brainDrain: {
        enabled: true,
        skillThreshold: 0.60,      // Skills above which drain pressure begins (was 0.65)
        incomeThreshold: 8000,     // Income above which external options compete (was 10000)
        drainRate: 0.006,          // Monthly population drain rate at full pressure (was 0.003)
        // Reference: Harris & Todaro (1970) — migration model;
        // Breman (2013) — footloose labour in India's informal economy
      },
      
      // T5: Political attention cycles — 5-year election rhythms
      politicalCycles: {
        enabled: true,
        cycleLengthMonths: 60,     // 5-year cycle
        attentionAmplitude: 0.18,  // Peak attention swing (±18%, was 0.12)
        implementationDip: 0.25,   // Policy effectiveness drops near elections (was 0.15)
        // Reference: Kingdon (1984) — policy windows;
        // Baumgartner & Jones (1993) — attention cycles
      },
      
      // T6: Population ↔ Competition — log-scaled, always active
      populationCompetition: {
        enabled: true,
        baseIntensity: 0.065,      // Competition intensity (log-normalized) (was 0.00015 — broken)
        marketCapacityMult: 1.0,   // Market access offsets competition
        // Reference: Carrying capacity models — competition intensifies
        // with density regardless of arbitrary population thresholds
      },
      
      // T7: Inequality ↔ Coordination — divergent interests break cooperation
      inequalityCoordination: {
        enabled: true,
        ratioThreshold: 1.6,       // C:A income ratio above which coordination suffers (was 2.0)
        penaltyRate: 0.05,         // Annual coordination penalty per unit above threshold (was 0.015)
        // Reference: Olson (1965) — Logic of Collective Action;
        // Divergent segment interests undermine coordination
      }
    },
    
    // --- DORMANT DIMENSION ACTIVATION ---
    // Transforms D1, D2, D3, D5, D6 from decorative to dynamically participatory
    
    // D1: Graph Theory → Network Density Feedback
    graphTheory: {
      enabled: true,
      densityFeedback: true,       // Coupling density → system rigidity
      fragilityCoupling: 0.35,     // Tight coupling increases shock vulnerability (was 0.25)
      rigidityThreshold: 6,        // Coupling count above which system becomes rigid (was 8)
      // Reference: Perrow (1984) — Normal Accidents: tight coupling = systemic risk
    },
    
    // D2: Attractor → Genuine Basin Dynamics
    attractorDynamics: {
      enabled: true,
      hysteresis: true,            // Asymmetric transition thresholds
      escapeMultiplier: 1.5,       // 50% harder to escape TRAP than to fall back (was 1.3)
      pullStrength: 0.025,         // Attractor pull force near boundaries (was 0.015)
      removeGrowthBonus: true,     // Remove the ×1.02 GROWTH auto-reinforce
      // Reference: Scheffer (2009) — Critical Transitions in Nature and Society;
      // Holling (1973) — resilience and stability
    },
    
    // D3: NPF → Narrative-Policy Feedback Loop
    npfFeedback: {
      enabled: true,
      narrativeBoost: 0.15,        // Aligned narrative boosts policy effectiveness (was 0.12)
      narrativePenalty: 0.12,      // Misaligned narrative reduces effectiveness (was 0.08)
      coalitionFriction: 0.06,     // Competing coalitions slow implementation (was 0.04)
      narrativeInertia: 0.80,      // How resistant narratives are to change (was 0.85)
      // Reference: Shanahan, Jones & McBeth (2011) — Policy Narratives;
      // Jones & McBeth (2010) — NPF framework
    },
    
    // D5: Spatiotemporal → Dynamic Infrastructure + Spatial Diffusion
    spatialDynamics: {
      enabled: true,
      digitalGrowthRate: 0.003,    // Monthly digital access improvement (was 0.004)
      roadGrowthRate: 0.001,       // Monthly road connectivity improvement (was 0.002)
      diffusionDecay: 0.5,         // Urban→rural benefit diffusion (was 0.6)
      incomeInfraBoost: 0.00008,   // Income contribution to infrastructure improvement (was 0.0001)
      // Reference: Hägerstrand (1967) — Innovation Diffusion as a Spatial Process;
      // Anselin (1988) — Spatial Econometrics
    },
    
    // D6: ABM → Decision-Based Segment Mobility
    abmDecisions: {
      enabled: true,
      aspirationStrength: 0.03,    // How strongly income differentials drive mobility
      exitEnabled: true,           // Artisans can leave the craft entirely
      exitSkillThreshold: 0.65,    // Skills above which artisans have exit options (was 0.7)
      exitIncomeThreshold: 9000,   // Income below which exit pressure is high (was 8000)
      returnRate: 0.003,           // Monthly rate skilled artisans may return (was 0.005)
      // Reference: Harris & Todaro (1970) — migration;
      // Aspiration-based models of occupational choice
    }
  };
  // ========== END: COMPLEXITY_LAYER ==========

  // ========== SECTION: COMPLEXITY_REFERENCES ==========
  // Full academic citations for every complexity mechanism
  // Accessible via UI modal and included in exported reports
  const COMPLEXITY_REFERENCES = {
    framework: {
      title: 'Overall Complexity Approach',
      description: 'The complexity layer transforms the model from linear policy analysis (L1) to a genuinely complex adaptive system (L3-L4). It introduces non-linear dynamics, path dependence, emergent tensions, and stochastic perturbations.',
      references: [
        'Meadows, D. (2008). Thinking in Systems: A Primer. Chelsea Green Publishing.',
        'Arthur, W.B. (2015). Complexity and the Economy. Oxford University Press.',
        'Cairney, P. (2012). Complexity Theory in Political Science and Public Policy. Political Studies Review, 10(3), 346-358.'
      ]
    },
    layers: [
      {
        id: 'L1',
        title: 'Layer 1: Within-Dimension Resistance',
        subtitle: '"Success breeds its own friction"',
        mechanisms: [
          {
            id: 'policyRampup',
            name: 'Policy Ramp-Up & Fatigue',
            description: 'Policies follow an S-curve from initial low effectiveness to peak, then experience fatigue. Captures institutional learning curves and diminishing returns.',
            indicator: 'Visible in: policy effectiveness over time',
            references: [
              'Baumgartner, F.R. & Jones, B.D. (1993). Agendas and Instability in American Politics. University of Chicago Press.',
              'Kingdon, J.W. (1984). Agendas, Alternatives, and Public Policies. Little, Brown.',
              'MSME Annual Report (2023) — SFURTI clusters take 2-3 years to establish.'
            ]
          },
          {
            id: 'demandSaturation',
            name: 'Demand Saturation',
            description: 'Income growth faces increasing resistance as craft products enter higher price segments with thinner demand. Creates a natural ceiling on income growth.',
            indicator: 'Saturation is set near the top of the income range; on the current scale (ceiling ≈ ₹9,450) it rarely engages.',
            references: [
              'Standard market saturation theory — finite demand for handicraft products at higher price segments (Kotler & Keller, 2016).'
            ]
          },
          {
            id: 'stochasticShocks',
            name: 'Stochastic Shocks',
            description: 'Random disruptions (monsoons, demand slumps, input cost spikes, policy discontinuities) with regime-dependent vulnerability. TRAP systems are more fragile than GROWTH systems.',
            indicator: 'Visible in: event log shock entries, income volatility',
            references: [
              'Scheffer, M. et al. (2001). Catastrophic shifts in ecosystems. Nature, 413, 591-596.',
              'Perrow, C. (1984). Normal Accidents: Living with High-Risk Technologies. Basic Books.'
            ]
          }
        ]
      },
      {
        id: 'L2',
        title: 'Layer 2: Between-Dimension Tensions (T1-T7)',
        subtitle: 'Improving one dimension necessarily resists another',
        mechanisms: [
          {
            id: 'T1',
            name: 'T1: Market ↔ Heritage',
            description: 'Market scaling erodes traditional techniques (standardization pressure). Conversely, strong heritage attachment brakes market expansion (refusal to adapt designs).',
            indicator: 'Visible in: heritage decline when market > 0.4, market growth slowing when heritage > 0.6',
            references: [
              'Liebl, M. & Roy, T. (2003). Handmade in India: Traditional Craft Skills in a Changing World. Poor People\'s Knowledge, World Bank.',
              'Scrase, T.J. (2003). Precarious production: Globalisation and artisan labour in the Third World. Third World Quarterly, 24(3), 449-461.'
            ]
          },
          {
            id: 'T2',
            name: 'T2: Income ↔ Middlemen Adaptation',
            description: 'When middlemen control decreases and artisan income rises, middlemen adapt by finding new extraction mechanisms (quality gatekeeping, logistics control, credit tightening).',
            indicator: 'Visible in: middlemen rebounding after initial decline',
            references: [
              'Gereffi, G., Humphrey, J. & Sturgeon, T. (2005). The governance of global value chains. Review of International Political Economy, 12(1), 78-104.',
              'Wilkinson-Weber, C.M. (1999). Embroidering Lives: Women\'s Work and Skill in the Lucknow Chikankari Industry. SUNY Press.'
            ]
          },
          {
            id: 'T3',
            name: 'T3: Coordination Friction',
            description: 'More simultaneous policies create institutional friction — meetings, reporting, competing mandates. Friction grows quadratically with number of active policies.',
            indicator: 'Visible in: coordination declining despite policy effort',
            references: [
              'Ostrom, E. (1990). Governing the Commons. Cambridge University Press.',
              'Bardhan, P. (2002). Decentralization of Governance and Development. Journal of Economic Perspectives, 16(4), 185-205.',
              'Peters, B.G. (2015). Pursuing Horizontal Management: The Politics of Public Sector Coordination. University Press of Kansas.'
            ]
          },
          {
            id: 'T4',
            name: 'T4: Skills → Brain Drain',
            description: 'Skilled artisans have exit options (factory work, urban migration). Higher skills + low craft income = higher exit probability, causing irreversible knowledge loss.',
            indicator: 'Visible in: Cumulative Departures counter, population decline',
            references: [
              'Harris, J.R. & Todaro, M.P. (1970). Migration, Unemployment and Development: A Two-Sector Analysis. American Economic Review, 60(1), 126-142.',
              'Breman, J. (2013). At Work in the Informal Economy of India. Oxford University Press.'
            ]
          },
          {
            id: 'T5',
            name: 'T5: Political Attention Cycles',
            description: 'Political attention to craft sector oscillates with election cycles and crisis events. All policy effects are modulated by a sine wave representing attention fluctuations.',
            indicator: 'Visible in: periodic policy effectiveness variation',
            references: [
              'Kingdon, J.W. (1984). Agendas, Alternatives, and Public Policies. Little, Brown.',
              'Baumgartner, F.R. & Jones, B.D. (1993). Agendas and Instability in American Politics. University of Chicago Press.'
            ]
          },
          {
            id: 'T6',
            name: 'T6: Population Competition',
            description: 'Market demand is finite. More artisans competing for the same market reduces per-capita income. Uses carrying capacity model normalized by market access.',
            indicator: 'Visible in: Competition factor (×value)',
            references: [
              'Standard carrying capacity models from ecological economics.',
              'Sen, A. (1981). Poverty and Famines: An Essay on Entitlement and Deprivation. Oxford University Press.'
            ]
          },
          {
            id: 'T7',
            name: 'T7: Inequality → Coordination Erosion',
            description: 'When income ratio between top and bottom segments exceeds threshold, collective action becomes harder. Inequality undermines the social trust needed for coordination.',
            indicator: 'Visible in: coordination penalty when Seg C/A ratio > 1.6',
            references: [
              'Olson, M. (1965). The Logic of Collective Action. Harvard University Press.',
              'Ostrom, E. (1990). Governing the Commons. Cambridge University Press.'
            ]
          }
        ]
      },
      {
        id: 'L3',
        title: 'Layer 3: Cross-Dimension Coupling',
        subtitle: 'Dimensions interact through emergent feedback pathways',
        mechanisms: [
          {
            id: 'attractorDynamics',
            name: 'Attractor Dynamics & Hysteresis',
            description: 'System states (TRAP, TRANSITION, GROWTH) exhibit hysteresis — it is harder to escape a TRAP than to fall into one. Near-threshold pull forces resist state transitions.',
            indicator: 'Visible in: D2 Attractor card, income dynamics near thresholds',
            references: [
              'Scheffer, M. (2009). Critical Transitions in Nature and Society. Princeton University Press.',
              'Azariadis, C. & Stachurski, J. (2005). Poverty Traps. Handbook of Economic Growth, 1, 295-384.'
            ]
          },
          {
            id: 'graphTheory',
            name: 'Network Density & Fragility',
            description: 'Active couplings between dimensions create a network. High density means tight coupling, which increases efficiency but also fragility — shocks propagate faster.',
            indicator: 'Visible in: Net Density counter, coupling badges',
            references: [
              'Perrow, C. (1984). Normal Accidents: Living with High-Risk Technologies. Basic Books.',
              'Provan, K.G. & Kenis, P. (2008). Modes of Network Governance. Journal of Public Administration Research and Theory, 18(2), 229-252.'
            ]
          },
          {
            id: 'creditLockin',
            name: 'Credit Dependency Lock-In',
            description: 'In TRAP state, artisans become dependent on middlemen for working capital. This creates an additional income drain through exploitative pricing (putting-out system), reinforcing the TRAP.',
            indicator: 'Visible in: Credit Lock-in bar',
            references: [
              'Wilkinson-Weber, C.M. (1999). Embroidering Lives: Chikankari putting-out system documentation.',
              'Banerjee, A. & Duflo, E. (2011). Poor Economics. Public Affairs.'
            ]
          },
          {
            id: 'conditionalLoops',
            name: 'Conditional R-Loop Activation',
            description: 'Reinforcing loops (R1: Skill→Income, R2: Market→Income) are not always active. R1 requires: income above subsistence, skills above threshold, AND low middlemen. R2 requires: market access above threshold, digital infrastructure, AND unsaturated demand.',
            indicator: 'Visible in: R1 and R2 activation bars',
            references: [
              'Sterman, J.D. (2000). Business Dynamics: Systems Thinking and Modeling for a Complex World. McGraw-Hill.',
              'Forrester, J.W. (1961). Industrial Dynamics. MIT Press.'
            ]
          }
        ]
      },
      {
        id: 'L4',
        title: 'Layer 4: Uncertainty Quantification',
        subtitle: 'Robustness under parameter uncertainty',
        mechanisms: [
          {
            id: 'monteCarlo',
            name: 'Monte Carlo Simulation',
            description: 'All parameters varied ±15% across 100 runs. Generates confidence intervals, escape probabilities, and sensitivity analysis. Tests whether conclusions hold under systematic uncertainty.',
            indicator: 'Visible in: D7 card, MC histogram, 95% CI in reports',
            references: [
              'Saltelli, A. et al. (2008). Global Sensitivity Analysis: The Primer. John Wiley & Sons.',
              'Metropolis, N. & Ulam, S. (1949). The Monte Carlo Method. Journal of the American Statistical Association, 44(247), 335-341.'
            ]
          }
        ]
      }
    ]
  };
  // ========== END: COMPLEXITY_REFERENCES ==========

  // ========== SECTION: SHOCK_TEMPLATES ==========
  const SHOCK_TEMPLATES = {
    covid: {
      id: 'covid',
      name: 'COVID-19 Pandemic',
      effects: { income: -0.50, market: -0.80, coordination: -0.20 },
      duration: 24,
      description: 'Severe market disruption, lockdowns, supply chain breakdown'
    },
    demonetization: {
      id: 'demonetization',
      name: 'Demonetization (2016)',
      effects: { income: -0.30, market: -0.40, coordination: -0.10 },
      duration: 6,
      description: 'Cash crunch affecting informal economy'
    },
    flood: {
      id: 'flood',
      name: 'Flood/Natural Disaster',
      effects: { income: -0.40, market: -0.30, population: -0.05 },
      duration: 12,
      description: 'Regional disaster affecting production and infrastructure'
    },
    export_boom: {
      id: 'export_boom',
      name: 'Export Market Boom',
      effects: { income: 0.30, market: 0.40, middlemen: 0.10 },
      duration: 24,
      description: 'Surge in international demand'
    }
  };
  // ========== END: SHOCK_TEMPLATES ==========

  // ========== SECTION: COUPLINGS_DATA ==========
  const COUPLINGS = {
    'D1-D4': {
      id: 'D1-D4',
      name: 'Coordination → System Dynamics',
      dimensions: ['D1: Graph Theory', 'D4: System Dynamics'],
      description: 'Inter-ministry delivery coherence (C_eff) scales policy effectiveness — the better agencies coordinate to DELIVER, the more of each policy effect reaches artisans. This is the coherence stream, distinct from the artisan co-op that builds bargaining power.',
      formula: 'Policy_Effectiveness = Base_Effect × ({{COORD_FLOOR}} + {{COORD_WEIGHT}} × Coordination)',
      trigger: 'Active every simulation step',
      reference: 'Provan & Milward (2001) - Network Governance'
    },
    'D2-D4': {
      id: 'D2-D4',
      name: 'Attractor State → System Dynamics',
      dimensions: ['D2: Attractor Analysis', 'D4: System Dynamics'],
      description: 'System state (TRAP/TRANSITION/GROWTH) modifies stock-flow dynamics. Trap state applies a 0.95 drag; the growth auto-reinforce bonus was removed (Scheffer 2009).',
      formula: 'State_Multiplier = TRAP: 0.95 | TRANSITION: 1.0 | GROWTH: 1.0',
      trigger: 'Active every simulation step',
      reference: 'Azariadis & Stachurski (2005) - Poverty Traps'
    },
    'D3-D4': {
      id: 'D3-D4',
      name: 'Political Feasibility → Policy Effects',
      dimensions: ['D3: NPF', 'D4: System Dynamics'],
      description: 'Political orientation determines which policy types are feasible. Low P blocks welfare policies; high P blocks market policies.',
      formula: 'P < 0.3: Welfare blocked | P > 0.7: Market blocked',
      trigger: 'When policies are activated',
      reference: 'Jones & McBeth (2010) - Narrative Policy Framework'
    },
    'D5-D4': {
      id: 'D5-D4',
      name: 'Spatial Factors → Policy Reach',
      dimensions: ['D5: Spatiotemporal', 'D4: System Dynamics'],
      description: 'Geographic location affects policy reach. Urban clusters receive full policy benefits; rural areas receive reduced benefits.',
      formula: 'Spatial_Mult = Urban: 1.0 | Peri-urban: 0.7 | Rural: 0.4',
      trigger: 'When segment incomes are calculated',
      reference: "Tobler (1970) - First Law of Geography"
    },
    'D6-D4': {
      id: 'D6-D4',
      name: 'Agent Heterogeneity → Income Distribution',
      dimensions: ['D6: ABM', 'D4: System Dynamics'],
      description: 'Different artisan segments receive differentiated policy impacts based on their characteristics and access levels.',
      formula: 'Segment_Income = Avg_Income × Segment_Multiplier × Spatial × Policy_Bonus',
      trigger: 'When segment outcomes are updated',
      reference: 'Epstein & Axtell (1996) - Growing Artificial Societies'
    },
    'D6-D1': {
      id: 'D6-D1',
      name: 'Market-Ready Segment → Coordination',
      dimensions: ['D6: ABM', 'D1: Graph Theory'],
      description: 'A growing market-ready segment (C > 15%) enables better coordination by creating organized producer groups.',
      formula: 'if (Segment_C > 15%) Coordination += success_boost × 0.2',
      trigger: 'When C segment share exceeds 15%',
      reference: 'Granovetter (1973) - Weak Ties'
    },
    'D6-D3': {
      id: 'D6-D3',
      name: 'Inequality → Political Pressure',
      dimensions: ['D6: ABM', 'D3: NPF'],
      description: 'High inequality (Gini > 0.45) creates political pressure for welfare interventions.',
      formula: 'if (Gini > 0.45) Political += 0.10',
      trigger: 'When Gini coefficient exceeds 0.45',
      reference: 'Sabatier (1988) - Advocacy Coalition Framework'
    },
    'D1-D3': {
      id: 'D1-D3',
      name: 'Coordination → Political Voice',
      dimensions: ['D1: Graph Theory', 'D3: NPF'],
      description: 'High coordination (> 0.6) amplifies artisan political voice, shifting political feasibility.',
      formula: 'if (Coordination > 0.6) Political += 0.02',
      trigger: 'Annual political update when coordination high',
      reference: 'Provan & Milward (2001) - Network Effectiveness'
    },
    'D1-D2': {
      id: 'D1-D2',
      name: 'Coordination → System Resilience',
      dimensions: ['D1: Graph Theory', 'D2: Attractor Analysis'],
      description: 'Well-coordinated systems are more resilient to shocks and can escape poverty traps more easily.',
      formula: 'Resilience = f(Coordination, Network_Density)',
      trigger: 'During shock recovery',
      reference: 'Scheffer et al. (2001) - Catastrophic Shifts'
    },
    'D2-D3': {
      id: 'D2-D3',
      name: 'Crisis State → Political Shift',
      dimensions: ['D2: Attractor Analysis', 'D3: NPF'],
      description: 'Being in TRAP state creates political pressure for intervention, shifting political orientation toward welfare.',
      formula: 'if (State == TRAP) Political += 0.03',
      trigger: 'Annual political update when in TRAP',
      reference: 'Birkland (1998) - Focusing Events'
    },
    'D4-B1': {
      id: 'D4-B1',
      name: 'B1 Loop: Middlemen Exploitation',
      dimensions: ['D4: System Dynamics', 'B1: Balancing Loop'],
      description: 'In TRAP state, middlemen power increases, extracting more surplus and reinforcing the poverty trap.',
      formula: 'if (State == TRAP && Middlemen < 0.8) Middlemen += 0.002',
      trigger: 'When in TRAP with room for middlemen increase',
      reference: 'Gereffi (2005) - Value Chain Governance'
    },
    'D4-B3': {
      id: 'D4-B3',
      name: 'B3 Loop: Heritage Dilution',
      dimensions: ['D4: System Dynamics', 'B3: Balancing Loop'],
      description: 'High market access with low skills leads to mass production pressure, eroding cultural heritage.',
      formula: 'if (Market > 0.6 && Skills < 0.6) Heritage -= mass_prod_effect',
      trigger: 'When market high but skills low',
      reference: 'Liebl & Roy (2003) - Handmade in India'
    }
  };
  // ========== END: COUPLINGS_DATA ==========

  // Public API
  return {
    THRESHOLDS,
    RATES,
    CASE_STUDIES,
    POLICIES,
    DIMENSIONS,
    LOOPS,
    STOCKS,
    EQUATION_PARAMS,
    COMPLEXITY,
    SHOCK_TEMPLATES,
    COUPLINGS,
    
    // Helper methods
    getCaseStudy: (id) => {
      // Check custom case studies FIRST (they may override built-ins)
      if (typeof Admin !== 'undefined' && Admin.getCustomCaseStudies) {
        const custom = Admin.getCustomCaseStudies().find(c => c.id === id);
        if (custom) return custom;
      }
      if (CASE_STUDIES[id]) return CASE_STUDIES[id];
      return CASE_STUDIES.chikankari;
    },
    getPolicy: (id) => {
      // Check custom policies FIRST (they may override built-ins)
      if (typeof Admin !== 'undefined' && Admin.getCustomPolicies) {
        const custom = Admin.getCustomPolicies().find(p => p.id === id);
        if (custom) return custom;
      }
      if (POLICIES[id]) return POLICIES[id];
      return null;
    },
    getAllPolicies: () => {
      const customPolicies = (typeof Admin !== 'undefined' && Admin.getCustomPolicies) ? Admin.getCustomPolicies() : [];
      const customIds = new Set(customPolicies.map(p => p.id));
      const builtIn = Object.values(POLICIES).filter(p => !customIds.has(p.id));
      return [...builtIn, ...customPolicies];
    },
    getPoliciesByMinistry: (ministry) => Object.values(POLICIES).filter(p => p.ministry === ministry),
    getDimension: (id) => DIMENSIONS[id],
    getLoop: (id) => LOOPS[id],
    getStock: (id) => STOCKS[id],
    getCoupling: (id) => COUPLINGS[id],
    getComplexityReferences: () => COMPLEXITY_REFERENCES,
    getBounds: (caseStudyId) => {
      const cs = CASE_STUDIES[caseStudyId] || CASE_STUDIES.chikankari;
      const defaults = { populationFloor: 1000, middlemenFloor: 0.20, middlemenCeiling: 0.95 };
      return Object.assign({}, defaults, cs.bounds || {});
    }
  };
})();

// Pristine default calibration — captured the instant Config is defined, before any other
// script runs. The validation panel resets to this so no session state can skew a test.
try {
  Config._DEFAULTS = {
    EQUATION_PARAMS: JSON.parse(JSON.stringify(Config.EQUATION_PARAMS)),
    COMPLEXITY:      JSON.parse(JSON.stringify(Config.COMPLEXITY)),
    LOOPS:           JSON.parse(JSON.stringify(Config.LOOPS))
  };
} catch(e) { /* defaults capture optional */ }

// ── INTER-MINISTRY COHERENCE CONTRIBUTION (per-policy, admin-editable) ──────────
// How much each policy's DESIGN builds inter-agency delivery coordination (nodal institutions,
// convergence platforms). DISTINCT from effects.coordination (artisan co-op capacity). Illustrative
// defaults — calibrate to anchors. (Peters 2015, horizontal management of policy.)
(function () {
  var COH = { SFURTI: 0.15, CLUSTER_DEV: 0.15, TIES: 0.10, NHDP: 0.08 };
  Object.keys(Config.POLICIES).forEach(function (id) {
    if (Config.POLICIES[id].coherenceContribution === undefined)
      Config.POLICIES[id].coherenceContribution = COH[id] || 0.0;
  });
})();

// ── MEADOWS LEVERAGE POINTS (Meadows 1999, "Leverage Points: Places to Intervene in a System") ──
// Each loop tagged with the leverage point where intervening on it acts (12 = shallow parameters,
// 1 = paradigm). The model shows efficiency rising with leverage DEPTH: subsidies (pt 12) are least
// efficient; changing the monopsony RULE (pt 5) and enabling self-organization (pt 4) are most.
(function () {
  var LEV = {
    R1:  { pt: 7, name: 'Reinforcing loop gain (skill→income virtuous cycle)' },
    R2:  { pt: 7, name: 'Reinforcing loop gain (market→income)' },
    B1:  { pt: 5, name: 'Rules of the system (the middleman monopsony rule)' },
    B2:  { pt: 8, name: 'Balancing loop (resource constraint)' },
    B3:  { pt: 6, name: 'Information flows (heritage as a quality/credence signal)' },
    'R-COHERE':  { pt: 3, name: 'Goals of the system (align inter-ministry goals)' },
    'R-COOP':    { pt: 4, name: 'Self-organization (artisans form a co-op — Ostrom)' },
    'R-COUNTER': { pt: 5, name: 'Rules of the system (break the monopsony via countervailing power)' },
    'B-FRAG':    { pt: 3, name: 'Goals of the system (fragmentation vs coherent goals)' },
    'R-CREDIT':  { pt: 8, name: 'Reinforcing trap loop (credit lock-in that deepens the poverty trap)' }
  };
  if (Config.LOOPS) Object.keys(LEV).forEach(function (id) { if (Config.LOOPS[id]) Config.LOOPS[id].leverage = LEV[id]; });
  // Policy instrument → leverage point (for the efficiency read-out): subsidies shallow, structure deep
  Config.POLICY_LEVERAGE = { subsidy: 12, credit: 12, grant: 12, skill: 11, channel: 6, certificate: 6, facility: 4, institution: 4 };
})();
