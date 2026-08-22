/* ╔════════════════════════════════════════════════════════════════════════════╗
   ║  CPAF v6 - admin.js                                                         ║
   ║  Admin Panel: Policies, Case Studies, Calibration, Data Management          ║
   ╠════════════════════════════════════════════════════════════════════════════╣
   ║  SECTION MAP:                                                               ║
   ║  Line 1-50:      File header & state                                        ║
   ║  Line 51-150:    PANEL_CONTROL                                              ║
   ║  Line 151-350:   POLICIES_TAB                                               ║
   ║  Line 351-550:   CASE_STUDIES_TAB                                           ║
   ║  Line 551-750:   DATA_TAB                                                   ║
   ║  Line 751-950:   CALIBRATION_TAB                                            ║
   ║  Line 951-1100:  EXPORT_TAB                                                 ║
   ╚════════════════════════════════════════════════════════════════════════════╝ */

const Admin = (function() {
  'use strict';

  let currentTab = 'policies';
  
  // Custom data storage (persists in session)
  let customPolicies = [];
  let customCaseStudies = [];
  let customShocks = [];
  let timeSeriesData = [];

  // ========== SECTION: PANEL_CONTROL ==========
  function openPanel() {
    document.getElementById('adminPanel').classList.add('visible');
    renderTab(currentTab);
  }

  function closePanel() {
    document.getElementById('adminPanel').classList.remove('visible');
  }

  function switchTab(tabName) {
    currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    renderTab(tabName);
  }

  function renderTab(tabName) {
    const content = document.getElementById('adminContent');
    
    switch (tabName) {
      case 'policies':
        content.innerHTML = renderPoliciesTab();
        attachPoliciesHandlers();
        break;
      case 'cases':
        content.innerHTML = renderCasesTab();
        attachCasesHandlers();
        break;
      case 'data':
        content.innerHTML = renderDataTab();
        attachDataHandlers();
        break;
      case 'calibration':
        content.innerHTML = renderCalibrationTab();
        attachCalibrationHandlers();
        break;
      case 'export':
        content.innerHTML = renderExportTab();
        attachExportHandlers();
        break;
      case 'complexity':
        content.innerHTML = renderComplexityTab();
        attachComplexityHandlers();
        break;
    }
  }
  // ========== END: PANEL_CONTROL ==========

  // ========== SECTION: POLICIES_TAB ==========
  function renderPoliciesTab() {
    // De-duplicate: if a custom policy overrides a built-in, show only the custom version
    const customIds = new Set(customPolicies.map(p => p.id));
    const builtInPolicies = Object.values(Config.POLICIES).filter(p => !customIds.has(p.id));
    const allPolicies = [...builtInPolicies, ...customPolicies];
    const ministries = [...new Set(allPolicies.map(p => p.ministry))];
    
    let html = `
      <div class="admin-section">
        <div class="admin-section-header">
          <h3>📋 Policy Manager</h3>
          <button class="btn btn-primary" onclick="Admin.showAddPolicyForm()">+ Add Policy</button>
        </div>
        <p class="admin-desc">Manage government policies and their effects on the model.</p>
      </div>
      
      <div id="addPolicyForm" class="admin-form hidden"></div>
    `;

    ministries.forEach(ministry => {
      const policies = allPolicies.filter(p => p.ministry === ministry);
      html += `
        <div class="admin-section">
          <h4 class="ministry-header">${ministry}</h4>
          <div class="policy-list">
      `;
      
      policies.forEach(policy => {
        const isCustom = customPolicies.some(cp => cp.id === policy.id);
        const S = Simulation.getState();
        const isActive = S.activePolicies && S.activePolicies.has(policy.id);
        
        html += `
          <div class="policy-item ${isActive ? 'active' : ''}" data-id="${policy.id}">
            <div class="policy-item-header">
              <span class="policy-name">${policy.name}</span>
              ${isCustom && policy.editedFrom ? '<span class="badge edited">Edited</span>' : ''}
              ${isCustom && !policy.editedFrom ? '<span class="badge custom">Custom</span>' : ''}
              ${policy.isUmbrella ? '<span class="badge" style="background:#6B3FA0;color:#fff">Umbrella</span>' : ''}
              ${policy.parentProgramme ? `<span class="badge" style="background:#e5e7eb;color:#444">↳ ${policy.parentProgramme}</span>` : ''}
            </div>
            <div class="policy-item-details">
              <span>Budget: ₹${policy.budget}Cr</span>
              <span>Coverage: ${(policy.coverage * 100).toFixed(0)}%</span>
              <span>Type: ${policy.type}</span>
            </div>
            <div class="policy-item-effects">
              ${policy.isUmbrella
                ? '<span class="effect" style="opacity:.7">container — effect = sum of active components</span>'
                : Object.entries(policy.effects)
                    .filter(([k, v]) => v !== 0)
                    .map(([k, v]) => `<span class="effect ${v > 0 ? 'positive' : 'negative'}">${k}: ${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%</span>`)
                    .join('')}
            </div>
            <div class="policy-item-actions">
              <button class="btn btn-small" onclick="Admin.editPolicy('${policy.id}')">✏️ Edit</button>
              ${isCustom && policy.editedFrom === 'built-in' 
                ? `<button class="btn btn-small btn-warning" onclick="Admin.revertPolicy('${policy.id}')">↩️ Revert</button>` 
                : ''}
              ${isCustom && !policy.editedFrom 
                ? `<button class="btn btn-small btn-danger" onclick="Admin.deletePolicy('${policy.id}')">🗑️ Remove</button>` 
                : ''}
            </div>
          </div>
        `;
      });
      
      html += `</div></div>`;
    });

    return html;
  }

  function showAddPolicyForm(existingPolicy = null) {
    const isEdit = existingPolicy !== null;
    const policy = existingPolicy || {
      id: '',
      name: '',
      ministry: 'Textiles',
      type: 'structural',
      budget: 100,
      coverage: 0.30,
      effects: { skills: 0, market: 0, income: 0, middlemen: 0, coordination: 0, heritage: 0 },
      targeting: (existing && existing.targeting) ? existing.targeting : { segments: ['A', 'B', 'C'], minority_only: false },
      mechanism: '',
      limitations: [],
      source: ''
    };

    const formHtml = `
      <div class="form-card">
        <h4>${isEdit ? 'Edit' : 'Add New'} Policy</h4>
        <div class="form-grid">
          <div class="form-group">
            <label>Policy ID (no spaces)</label>
            <input type="text" id="policyId" value="${policy.id}" ${isEdit ? 'disabled' : ''} placeholder="POLICY_ID">
          </div>
          <div class="form-group">
            <label>Policy Name</label>
            <input type="text" id="policyName" value="${policy.name}" placeholder="Full policy name">
          </div>
          <div class="form-group">
            <label>Ministry</label>
            <select id="policyMinistry">
              ${['Textiles', 'MSME', 'Minority Affairs', 'Culture', 'Commerce', 'Cross-Ministry'].map(m => 
                `<option value="${m}" ${policy.ministry === m ? 'selected' : ''}>${m}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Type</label>
            <select id="policyType">
              ${['structural', 'welfare', 'market'].map(t => 
                `<option value="${t}" ${policy.type === t ? 'selected' : ''}>${t}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Budget (₹ Crores)</label>
            <input type="number" id="policyBudget" value="${policy.budget}" min="0">
          </div>
          <div class="form-group">
            <label>Coverage (0-1)</label>
            <input type="number" id="policyCoverage" value="${policy.coverage}" min="0" max="1" step="0.05">
          </div>
        </div>
        
        <h5>Effects (as decimals, e.g., 0.15 = 15%)</h5>
        <div class="form-grid effects-grid">
          ${['skills', 'market', 'income', 'middlemen', 'coordination', 'heritage'].map(effect => `
            <div class="form-group">
              <label>${effect}</label>
              <input type="number" id="effect_${effect}" value="${policy.effects[effect] || 0}" step="0.01" min="-1" max="1">
            </div>
          `).join('')}
        </div>

        <h5>Inter-ministry coherence <span style="font-weight:400;opacity:0.7">(delivery coordination — distinct from the artisan "coordination" effect above)</span></h5>
        <div class="form-group">
          <label>coherence contribution</label>
          <input type="number" id="policyCoherenceContribution" value="${policy.coherenceContribution || 0}" step="0.01" min="0" max="1" title="How much this policy's design builds inter-agency delivery coordination (nodal institutions, convergence). Feeds policyCoherence, which gates all delivery (C_eff).">
        </div>

        <div class="form-group">
          <label>Mechanism (description)</label>
          <textarea id="policyMechanism" rows="2">${policy.mechanism || ''}</textarea>
        </div>
        
        <div class="form-group">
          <label>Source/Reference</label>
          <input type="text" id="policySource" value="${policy.source || ''}" placeholder="Ministry report, year">
        </div>
        
        <div class="form-actions">
          <button class="btn btn-secondary" onclick="Admin.hideAddPolicyForm()">Cancel</button>
          <button class="btn btn-primary" onclick="Admin.savePolicy(${isEdit})">${isEdit ? 'Update' : 'Add'} Policy</button>
        </div>
      </div>
    `;

    document.getElementById('addPolicyForm').innerHTML = formHtml;
    document.getElementById('addPolicyForm').classList.remove('hidden');
  }

  function hideAddPolicyForm() {
    document.getElementById('addPolicyForm').classList.add('hidden');
    document.getElementById('addPolicyForm').innerHTML = '';
  }

  function savePolicy(isEdit) {
    const pid = document.getElementById('policyId').value.toUpperCase().replace(/\s+/g, '_');
    // Preserve fields not exposed in the form (parentProgramme, isUmbrella, cascadeChildren,
    // sharesBudgetWith, linkedProgramme, targeting) by spreading the existing policy first.
    const existing = (typeof Config !== 'undefined' && Config.getPolicy) ? Config.getPolicy(pid) : null;
    const policy = {
      ...(existing || {}),
      id: pid,
      name: document.getElementById('policyName').value,
      ministry: document.getElementById('policyMinistry').value,
      type: document.getElementById('policyType').value,
      budget: parseFloat(document.getElementById('policyBudget').value),
      coverage: parseFloat(document.getElementById('policyCoverage').value),
      effects: {
        skills: parseFloat(document.getElementById('effect_skills').value) || 0,
        market: parseFloat(document.getElementById('effect_market').value) || 0,
        income: parseFloat(document.getElementById('effect_income').value) || 0,
        middlemen: parseFloat(document.getElementById('effect_middlemen').value) || 0,
        coordination: parseFloat(document.getElementById('effect_coordination').value) || 0,
        heritage: parseFloat(document.getElementById('effect_heritage').value) || 0
      },
      coherenceContribution: parseFloat((document.getElementById('policyCoherenceContribution') || {}).value) || 0,
      targeting: { segments: ['A', 'B', 'C'], minority_only: false },
      mechanism: document.getElementById('policyMechanism').value,
      limitations: (existing && existing.limitations) ? existing.limitations : [],
      source: document.getElementById('policySource').value,
      active: false,
      isCustom: true
    };

    if (!policy.id || !policy.name) {
      alert('Please fill in Policy ID and Name');
      return;
    }

    if (isEdit) {
      // FIX #12: Handle both custom AND built-in policy edits
      const customIdx = customPolicies.findIndex(p => p.id === policy.id);
      if (customIdx >= 0) {
        // Preserve editedFrom flag from previous edit
        if (customPolicies[customIdx].editedFrom) policy.editedFrom = customPolicies[customIdx].editedFrom;
        customPolicies[customIdx] = policy;
      } else if (Config.POLICIES[policy.id]) {
        // Built-in policy: copy to custom with edits (preserves original)
        policy.isCustom = true;
        policy.editedFrom = 'built-in';
        customPolicies.push(policy);
      }
    } else {
      // Check for duplicates
      if (Config.POLICIES[policy.id] || customPolicies.some(p => p.id === policy.id)) {
        alert('A policy with this ID already exists');
        return;
      }
      customPolicies.push(policy);
    }

    hideAddPolicyForm();
    renderTab('policies');
    Simulation.logEvent('ADMIN', `Policy ${isEdit ? 'updated' : 'added'}: ${policy.name}`);
  }

  function editPolicy(policyId) {
    const policy = customPolicies.find(p => p.id === policyId) || Config.POLICIES[policyId];
    if (policy) {
      showAddPolicyForm(policy);
      // Scroll form into view so user sees it
      const formEl = document.getElementById('addPolicyForm');
      if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function deletePolicy(policyId) {
    if (confirm('Delete this custom policy?')) {
      // Remove from custom policies array
      customPolicies = customPolicies.filter(p => p.id !== policyId);
      
      // Also remove from active policies if currently active
      const S = Simulation.getState();
      if (S.activePolicies && S.activePolicies.has(policyId)) {
        S.activePolicies.delete(policyId);
      }
      
      // Update main UI policies list
      if (typeof App !== 'undefined' && App.renderPoliciesList) {
        App.renderPoliciesList();
      }
      
      renderTab('policies');
      Simulation.logEvent('ADMIN', `Policy deleted: ${policyId}`);
    }
  }

  function revertPolicy(policyId) {
    if (confirm('Revert this policy to its original built-in values?')) {
      customPolicies = customPolicies.filter(p => p.id !== policyId);
      if (typeof App !== 'undefined' && App.renderPoliciesList) {
        App.renderPoliciesList();
      }
      renderTab('policies');
      Simulation.logEvent('ADMIN', `Policy reverted to original: ${policyId}`);
    }
  }

  function attachPoliciesHandlers() {
    // Additional event handlers if needed
  }
  // ========== END: POLICIES_TAB ==========

  // ========== SECTION: CASE_STUDIES_TAB ==========
  function renderCasesTab() {
    // De-duplicate: if a custom case overrides a built-in, show only the custom version
    const customIds = new Set(customCaseStudies.map(c => c.id));
    const builtInCases = Object.values(Config.CASE_STUDIES).filter(c => !customIds.has(c.id));
    const allCases = [...builtInCases, ...customCaseStudies];
    const S = Simulation.getState();
    
    let html = `
      <div class="admin-section">
        <div class="admin-section-header">
          <h3>🗺️ Case Study Manager</h3>
          <button class="btn btn-primary" onclick="Admin.showAddCaseForm()">+ Add Case Study</button>
        </div>
        <p class="admin-desc">Manage regional craft clusters for analysis.</p>
      </div>
      
      <div id="addCaseForm" class="admin-form hidden"></div>
      
      <div class="case-list">
    `;

    allCases.forEach(cs => {
      const isActive = S.caseStudy === cs.id;
      const isCustom = customCaseStudies.some(c => c.id === cs.id);
      
      html += `
        <div class="case-item ${isActive ? 'active' : ''}" data-id="${cs.id}">
          <div class="case-item-header">
            <span class="case-name">${cs.name}</span>
            <span class="case-location">${cs.location.district}, ${cs.location.state}</span>
            ${isCustom && cs.editedFrom ? '<span class="badge edited">Edited</span>' : ''}
            ${isCustom && !cs.editedFrom ? '<span class="badge custom">Custom</span>' : ''}
            ${isActive ? '<span class="badge active">Active</span>' : ''}
          </div>
          <div class="case-item-details">
            <div class="detail-row">
              <span>Population: ${cs.initial.population.toLocaleString()}</span>
              <span>Income: ₹${cs.initial.income.toLocaleString()}</span>
              <span>Middlemen: ${(cs.initial.middlemen * 100).toFixed(0)}%</span>
            </div>
            <div class="detail-row">
              <span>Craft: ${cs.craft_type}</span>
              <span>GI: ${cs.gi_registered ? '✓ Registered' : '✗ No'}</span>
              <span>Challenge: ${cs.context.key_challenge.replace('_', ' ')}</span>
            </div>
          </div>
          <div class="case-item-segments">
            <span class="seg seg-a">A: ${(cs.segments.A.share * 100).toFixed(0)}%</span>
            <span class="seg seg-b">B: ${(cs.segments.B.share * 100).toFixed(0)}%</span>
            <span class="seg seg-c">C: ${(cs.segments.C.share * 100).toFixed(0)}%</span>
          </div>
          <div class="case-item-actions">
            ${!isActive ? `<button class="btn btn-small btn-primary" onclick="Admin.switchCase('${cs.id}')">▶ Switch To</button>` : ''}
            <button class="btn btn-small" onclick="Admin.editCase('${cs.id}')">✏️ Edit</button>
            ${isCustom && cs.editedFrom === 'built-in' 
              ? `<button class="btn btn-small btn-warning" onclick="Admin.revertCase('${cs.id}')">↩️ Revert</button>` 
              : ''}
            ${isCustom && !cs.editedFrom 
              ? `<button class="btn btn-small btn-danger" onclick="Admin.deleteCase('${cs.id}')">🗑️ Remove</button>` 
              : ''}
          </div>
        </div>
      `;
    });

    html += `</div>`;
    return html;
  }

  function showAddCaseForm(existingCase = null) {
    const isEdit = existingCase !== null;
    const cs = existingCase || {
      id: '',
      name: '',
      craft_type: '',
      location: { district: '', state: '', coordinates: [0, 0] },
      gi_registered: false,
      initial: {
        population: 10000,
        income: 5000,
        skills: 0.50,
        market: 0.30,
        middlemen: 0.50,
        coordination: 0.30,
        heritage: 0.60,
        political: 0.50
      },
      segments: {
        A: { share: 0.50, multiplier: 0.85, name: 'Subsistence' },
        B: { share: 0.35, multiplier: 1.00, name: 'Traditional' },
        C: { share: 0.15, multiplier: 1.30, name: 'Market-Ready' }
      },
      spatial: { urban: 1.0, peri_urban: 0.7, rural: 0.4 },
      context: { key_challenge: 'market_visibility', primary_ministry: 'Textiles', gender_ratio: 0.50, urban_rural: 0.40 },
      source: '',
      notes: ''
    };

    const formHtml = `
      <div class="form-card">
        <h4>${isEdit ? 'Edit' : 'Add New'} Case Study</h4>
        
        <h5>Basic Information</h5>
        <div class="form-grid">
          <div class="form-group">
            <label>Case ID (no spaces)</label>
            <input type="text" id="caseId" value="${cs.id}" ${isEdit ? 'disabled' : ''} placeholder="case_id">
          </div>
          <div class="form-group">
            <label>Craft Name</label>
            <input type="text" id="caseName" value="${cs.name}" placeholder="Craft name">
          </div>
          <div class="form-group">
            <label>Craft Type</label>
            <input type="text" id="caseType" value="${cs.craft_type}" placeholder="Embroidery, Painting, etc.">
          </div>
          <div class="form-group">
            <label>District</label>
            <input type="text" id="caseDistrict" value="${cs.location.district}" placeholder="District name">
          </div>
          <div class="form-group">
            <label>State</label>
            <input type="text" id="caseState" value="${cs.location.state}" placeholder="State name">
          </div>
          <div class="form-group">
            <label>GI Registered</label>
            <select id="caseGI">
              <option value="true" ${cs.gi_registered ? 'selected' : ''}>Yes</option>
              <option value="false" ${!cs.gi_registered ? 'selected' : ''}>No</option>
            </select>
          </div>
        </div>
        
        <h5>Initial Conditions</h5>
        <div class="form-grid">
          <div class="form-group">
            <label>Population</label>
            <input type="number" id="casePop" value="${cs.initial.population}" min="1">
          </div>
          <div class="form-group">
            <label>Avg Income (₹/month)</label>
            <input type="number" id="caseIncome" value="${cs.initial.income}" min="500">
          </div>
          <div class="form-group">
            <label>Skills (0-1)</label>
            <input type="number" id="caseSkills" value="${cs.initial.skills}" min="0" max="1" step="0.05">
          </div>
          <div class="form-group">
            <label>Market Access (0-1)</label>
            <input type="number" id="caseMarket" value="${cs.initial.market}" min="0" max="1" step="0.05">
          </div>
          <div class="form-group">
            <label>Middlemen (0-1)</label>
            <input type="number" id="caseMiddlemen" value="${cs.initial.middlemen}" min="0" max="1" step="0.05">
          </div>
          <div class="form-group">
            <label>Coordination (0-1)</label>
            <input type="number" id="caseCoord" value="${cs.initial.coordination}" min="0" max="1" step="0.05">
          </div>
          <div class="form-group">
            <label>Heritage (0-1)</label>
            <input type="number" id="caseHeritage" value="${cs.initial.heritage || 0.6}" min="0" max="1" step="0.05">
          </div>
          <div class="form-group">
            <label>Political Orientation (0-1)</label>
            <input type="number" id="casePolitical" value="${cs.initial.political || 0.5}" min="0" max="1" step="0.05">
          </div>
        </div>
        
        <h5>Segment Distribution (must total 100%)</h5>
        <div class="form-grid">
          <div class="form-group">
            <label>A (Subsistence) %</label>
            <input type="number" id="caseSegA" value="${cs.segments.A.share * 100}" min="0" max="100">
          </div>
          <div class="form-group">
            <label>B (Traditional) %</label>
            <input type="number" id="caseSegB" value="${cs.segments.B.share * 100}" min="0" max="100">
          </div>
          <div class="form-group">
            <label>C (Market-Ready) %</label>
            <input type="number" id="caseSegC" value="${cs.segments.C.share * 100}" min="0" max="100">
          </div>
        </div>
        
        <h5>Segment Income Multipliers</h5>
        <div class="form-grid">
          <div class="form-group">
            <label>A Multiplier</label>
            <input type="number" id="caseMultA" value="${cs.segments.A.multiplier || 0.85}" min="0.5" max="1.5" step="0.05">
          </div>
          <div class="form-group">
            <label>B Multiplier</label>
            <input type="number" id="caseMultB" value="${cs.segments.B.multiplier || 1.0}" min="0.5" max="1.5" step="0.05">
          </div>
          <div class="form-group">
            <label>C Multiplier</label>
            <input type="number" id="caseMultC" value="${cs.segments.C.multiplier || 1.3}" min="0.5" max="2.0" step="0.05">
          </div>
        </div>
        
        <h5>Spatial Multipliers (D5)</h5>
        <div class="form-grid">
          <div class="form-group">
            <label>Urban</label>
            <input type="number" id="caseSpatialUrban" value="${cs.spatial?.urban || 1.0}" min="0.5" max="1.5" step="0.1">
          </div>
          <div class="form-group">
            <label>Peri-Urban</label>
            <input type="number" id="caseSpatialPeri" value="${cs.spatial?.peri_urban || 0.7}" min="0.3" max="1.2" step="0.1">
          </div>
          <div class="form-group">
            <label>Rural</label>
            <input type="number" id="caseSpatialRural" value="${cs.spatial?.rural || 0.4}" min="0.2" max="1.0" step="0.1">
          </div>
        </div>
        
        <h5>Context (D3/D6)</h5>
        <div class="form-grid">
          <div class="form-group">
            <label>Primary Ministry</label>
            <select id="casePrimaryMinistry">
              <option value="Textiles" ${(cs.context?.primary_ministry || 'Textiles') === 'Textiles' ? 'selected' : ''}>Textiles</option>
              <option value="MSME" ${cs.context?.primary_ministry === 'MSME' ? 'selected' : ''}>MSME</option>
              <option value="Minority Affairs" ${cs.context?.primary_ministry === 'Minority Affairs' ? 'selected' : ''}>Minority Affairs</option>
              <option value="Culture" ${cs.context?.primary_ministry === 'Culture' ? 'selected' : ''}>Culture</option>
              <option value="Commerce" ${cs.context?.primary_ministry === 'Commerce' ? 'selected' : ''}>Commerce</option>
            </select>
          </div>
          <div class="form-group">
            <label>Key Challenge</label>
            <select id="caseChallenge">
              <option value="market_visibility" ${(cs.context?.key_challenge || 'market_visibility') === 'market_visibility' ? 'selected' : ''}>Market Visibility</option>
              <option value="skill_erosion" ${cs.context?.key_challenge === 'skill_erosion' ? 'selected' : ''}>Skill Erosion</option>
              <option value="middlemen_exploitation" ${cs.context?.key_challenge === 'middlemen_exploitation' ? 'selected' : ''}>Middlemen Exploitation</option>
              <option value="middlemen" ${cs.context?.key_challenge === 'middlemen' ? 'selected' : ''}>Middlemen Dominance</option>
              <option value="coordination" ${cs.context?.key_challenge === 'coordination' ? 'selected' : ''}>Policy Fragmentation</option>
              <option value="heritage_loss" ${cs.context?.key_challenge === 'heritage_loss' ? 'selected' : ''}>Heritage Loss</option>
            </select>
          </div>
          <div class="form-group">
            <label>Female Artisan Ratio (0-1)</label>
            <input type="number" id="caseGenderRatio" value="${cs.context?.gender_ratio || 0.5}" min="0" max="1" step="0.05">
          </div>
          <div class="form-group">
            <label>Urban-Rural Mix (0=Rural, 1=Urban)</label>
            <input type="number" id="caseUrbanRural" value="${cs.context?.urban_rural || 0.4}" min="0" max="1" step="0.1">
          </div>
        </div>
        
        <h5>Engine Bounds (Case-Specific)</h5>
        <p style="font-size:11px;color:#888;margin:2px 0 8px;">Floors and ceilings the simulation engine enforces for this cluster.</p>
        <div class="form-grid">
          <div class="form-group">
            <label>Population Floor</label>
            <input type="number" id="caseBoundsPopFloor" value="${cs.bounds?.populationFloor || 1000}" min="1" max="100000">
          </div>
          <div class="form-group">
            <label>Middlemen Floor (0-1)</label>
            <input type="number" id="caseBoundsMidFloor" value="${cs.bounds?.middlemenFloor || 0.20}" min="0" max="0.95" step="0.01">
          </div>
          <div class="form-group">
            <label>Middlemen Ceiling (0-1)</label>
            <input type="number" id="caseBoundsMidCeil" value="${cs.bounds?.middlemenCeiling || 0.95}" min="0.20" max="0.95" step="0.01">
          </div>
        </div>
        
        <h5>Case Modifiers (Calibration)</h5>
        <p style="font-size:11px;color:#888;margin:2px 0 8px;">Rates that scale universal dynamics for this cluster's context.</p>
        <div class="form-grid">
          <div class="form-group">
            <label>Heritage Erosion Rate</label>
            <input type="number" id="caseModHeritage" value="${(typeof Simulation !== 'undefined' ? Simulation.getCalibration().caseModifiers[cs.id]?.heritage_erosion : null) || 1.0}" min="0" max="2" step="0.1">
          </div>
          <div class="form-group">
            <label>Middlemen Growth Rate</label>
            <input type="number" id="caseModMiddlemen" value="${(typeof Simulation !== 'undefined' ? Simulation.getCalibration().caseModifiers[cs.id]?.middlemen_growth : null) || 1.0}" min="0" max="2" step="0.1">
          </div>
          <div class="form-group">
            <label>Competition Start (pop)</label>
            <input type="number" id="caseModCompStart" value="${(typeof Simulation !== 'undefined' ? Simulation.getCalibration().caseModifiers[cs.id]?.competition_start : null) || Math.round(cs.initial.population * 1.12)}" min="1">
          </div>
        </div>
        
        <div class="form-group">
          <label>Data Source</label>
          <input type="text" id="caseSource" value="${cs.source || ''}" placeholder="Reference / citation">
        </div>
        
        <div class="form-group">
          <label>Notes</label>
          <textarea id="caseNotes" rows="2">${cs.notes || ''}</textarea>
        </div>
        
        <div class="form-actions">
          <button class="btn btn-secondary" onclick="Admin.hideAddCaseForm()">Cancel</button>
          <button class="btn btn-primary" onclick="Admin.saveCase(${isEdit})">${isEdit ? 'Update' : 'Add'} Case Study</button>
        </div>
      </div>
    `;

    document.getElementById('addCaseForm').innerHTML = formHtml;
    document.getElementById('addCaseForm').classList.remove('hidden');
  }

  function hideAddCaseForm() {
    document.getElementById('addCaseForm').classList.add('hidden');
  }

  function saveCase(isEdit) {
    const segA = parseFloat(document.getElementById('caseSegA').value) / 100;
    const segB = parseFloat(document.getElementById('caseSegB').value) / 100;
    const segC = parseFloat(document.getElementById('caseSegC').value) / 100;
    
    if (Math.abs(segA + segB + segC - 1) > 0.01) {
      alert('Segment shares must total 100%');
      return;
    }

    const cs = {
      id: document.getElementById('caseId').value.toLowerCase().replace(/\s+/g, '_'),
      name: document.getElementById('caseName').value,
      craft_type: document.getElementById('caseType').value,
      location: {
        district: document.getElementById('caseDistrict').value,
        state: document.getElementById('caseState').value,
        coordinates: [0, 0]
      },
      gi_registered: document.getElementById('caseGI').value === 'true',
      initial: {
        population: parseInt(document.getElementById('casePop').value),
        income: parseInt(document.getElementById('caseIncome').value),
        skills: parseFloat(document.getElementById('caseSkills').value),
        market: parseFloat(document.getElementById('caseMarket').value),
        middlemen: parseFloat(document.getElementById('caseMiddlemen').value),
        coordination: parseFloat(document.getElementById('caseCoord').value),
        heritage: parseFloat(document.getElementById('caseHeritage').value),
        political: parseFloat(document.getElementById('casePolitical').value)
      },
      segments: {
        A: { share: segA, multiplier: parseFloat(document.getElementById('caseMultA').value), name: 'Subsistence' },
        B: { share: segB, multiplier: parseFloat(document.getElementById('caseMultB').value), name: 'Traditional' },
        C: { share: segC, multiplier: parseFloat(document.getElementById('caseMultC').value), name: 'Market-Ready' }
      },
      spatial: { 
        urban: parseFloat(document.getElementById('caseSpatialUrban').value), 
        peri_urban: parseFloat(document.getElementById('caseSpatialPeri').value), 
        rural: parseFloat(document.getElementById('caseSpatialRural').value) 
      },
      context: { 
        key_challenge: document.getElementById('caseChallenge').value, 
        primary_ministry: document.getElementById('casePrimaryMinistry').value, 
        gender_ratio: parseFloat(document.getElementById('caseGenderRatio').value), 
        urban_rural: parseFloat(document.getElementById('caseUrbanRural').value) 
      },
      source: document.getElementById('caseSource').value,
      notes: document.getElementById('caseNotes').value,
      bounds: {
        populationFloor: parseInt(document.getElementById('caseBoundsPopFloor').value) || 1000,
        middlemenFloor: parseFloat(document.getElementById('caseBoundsMidFloor').value) || 0.20,
        middlemenCeiling: parseFloat(document.getElementById('caseBoundsMidCeil').value) || 0.95
      },
      isCustom: true
    };

    // Update caseModifiers in simulation CALIBRATION
    if (typeof Simulation !== 'undefined' && Simulation.getCalibration) {
      const cal = Simulation.getCalibration();
      if (!cal.caseModifiers) cal.caseModifiers = {};
      cal.caseModifiers[cs.id] = {
        heritage_erosion: parseFloat(document.getElementById('caseModHeritage').value) || 1.0,
        middlemen_growth: parseFloat(document.getElementById('caseModMiddlemen').value) || 1.0,
        competition_start: parseInt(document.getElementById('caseModCompStart').value) || Math.round(cs.initial.population * 1.12)
      };
    }

    if (!cs.id || !cs.name) {
      alert('Please fill in Case ID and Name');
      return;
    }

    if (isEdit) {
      const idx = customCaseStudies.findIndex(c => c.id === cs.id);
      if (idx >= 0) {
        // Preserve editedFrom flag from previous edit
        if (customCaseStudies[idx].editedFrom) cs.editedFrom = customCaseStudies[idx].editedFrom;
        customCaseStudies[idx] = cs;
      } else if (Config.CASE_STUDIES[cs.id]) {
        // Built-in case study: copy to custom with edits (preserves original)
        cs.isCustom = true;
        cs.editedFrom = 'built-in';
        customCaseStudies.push(cs);
      }
    } else {
      if (Config.CASE_STUDIES[cs.id] || customCaseStudies.some(c => c.id === cs.id)) {
        alert('A case study with this ID already exists');
        return;
      }
      customCaseStudies.push(cs);
    }

    // Update dropdown
    updateCaseStudyDropdown();
    
    hideAddCaseForm();
    renderTab('cases');
    Simulation.logEvent('ADMIN', `Case study ${isEdit ? 'updated' : 'added'}: ${cs.name}`);
  }

  function editCase(caseId) {
    const cs = customCaseStudies.find(c => c.id === caseId) || Config.CASE_STUDIES[caseId];
    if (cs) {
      showAddCaseForm(cs);
      // Scroll form into view so user sees it
      const formEl = document.getElementById('addCaseForm');
      if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function deleteCase(caseId) {
    const S = Simulation.getState();
    
    // Prevent deleting the currently active case study
    if (S.caseStudy === caseId) {
      alert('Cannot delete the currently active case study. Switch to another case first.');
      return;
    }
    
    if (confirm('Delete this custom case study?')) {
      customCaseStudies = customCaseStudies.filter(c => c.id !== caseId);
      updateCaseStudyDropdown();
      renderTab('cases');
      Simulation.logEvent('ADMIN', `Case study deleted: ${caseId}`);
    }
  }

  function revertCase(caseId) {
    if (confirm('Revert this case study to its original built-in values?')) {
      customCaseStudies = customCaseStudies.filter(c => c.id !== caseId);
      updateCaseStudyDropdown();
      renderTab('cases');
      Simulation.logEvent('ADMIN', `Case study reverted to original: ${caseId}`);
    }
  }

  function switchCase(caseId) {
    if (typeof App !== 'undefined' && App.switchCaseStudy) {
      App.switchCaseStudy(caseId);
      renderTab('cases');
    }
  }

  function updateCaseStudyDropdown() {
    const select = document.getElementById('caseStudySelect');
    if (!select) return;
    
    // De-duplicate: custom overrides take precedence
    const customIds = new Set(customCaseStudies.map(c => c.id));
    const builtInCases = Object.values(Config.CASE_STUDIES).filter(c => !customIds.has(c.id));
    const allCases = [...builtInCases, ...customCaseStudies];
    const S = Simulation.getState();
    
    select.innerHTML = allCases.map(cs => 
      `<option value="${cs.id}" ${S.caseStudy === cs.id ? 'selected' : ''}>${cs.name} (${cs.location.district})${cs.editedFrom ? ' ✎' : ''}</option>`
    ).join('');
  }

  function attachCasesHandlers() {}
  // ========== END: CASE_STUDIES_TAB ==========

  // ========== SECTION: DATA_TAB ==========
  function renderDataTab() {
    return `
      <div class="admin-section">
        <h3>📊 Data Manager</h3>
        <p class="admin-desc">Import time series data, add shock events, and manage external data inputs.</p>
      </div>
      
      <div class="admin-section">
        <div class="admin-section-header">
          <h4>💥 Shock Events</h4>
          <button class="btn btn-primary" onclick="Admin.showAddShockForm()">+ Add Shock</button>
        </div>
        <div id="shockList" class="shock-list">
          ${renderShockList()}
        </div>
      </div>
      
      <div id="addShockForm" class="admin-form hidden"></div>
      
      <div class="admin-section">
        <h4>📈 Time Series Import</h4>
        <p class="admin-desc">Import historical data to calibrate the model.</p>
        <div class="form-group">
          <label>Paste CSV data (format: month,income,population)</label>
          <textarea id="csvInput" rows="4" placeholder="1,4200,250000&#10;2,4150,249500&#10;..."></textarea>
        </div>
        <button class="btn btn-secondary" onclick="Admin.parseCSV()">Import CSV</button>
        <div id="csvPreview" class="csv-preview"></div>
      </div>
      
      <div class="admin-section">
        <h4>📋 Shock Templates</h4>
        <div class="template-list">
          ${Object.values(Config.SHOCK_TEMPLATES).map(t => `
            <div class="template-item" onclick="Admin.applyShockTemplate('${t.id}')">
              <span class="template-name">${t.name}</span>
              <span class="template-duration">${t.duration} months</span>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="admin-section">
        <h4>🗺️ Spatial/GIS Data (D5)</h4>
        <p class="admin-desc">Configure geographic parameters for spatiotemporal analysis.</p>
        <div class="gis-grid">
          <div class="gis-card">
            <h5>Location Coordinates</h5>
            <div class="form-grid">
              <div class="form-group">
                <label>Latitude</label>
                <input type="number" id="gis_lat" value="${getCurrentCaseCoords()[0]}" step="0.0001">
              </div>
              <div class="form-group">
                <label>Longitude</label>
                <input type="number" id="gis_lng" value="${getCurrentCaseCoords()[1]}" step="0.0001">
              </div>
            </div>
          </div>
          <div class="gis-card">
            <h5>Spatial Multipliers</h5>
            <div class="form-grid">
              <div class="form-group">
                <label>Urban (×)</label>
                <input type="number" id="spatial_urban" value="${getSpatialValue('urban')}" step="0.1" min="0" max="2">
              </div>
              <div class="form-group">
                <label>Peri-urban (×)</label>
                <input type="number" id="spatial_peri" value="${getSpatialValue('peri_urban')}" step="0.1" min="0" max="2">
              </div>
              <div class="form-group">
                <label>Rural (×)</label>
                <input type="number" id="spatial_rural" value="${getSpatialValue('rural')}" step="0.1" min="0" max="2">
              </div>
            </div>
          </div>
          <div class="gis-card">
            <h5>Infrastructure Index</h5>
            <div class="form-grid">
              <div class="form-group">
                <label>Road Connectivity (0-1)</label>
                <input type="number" id="infra_road" value="${getInfraValue('road')}" step="0.1" min="0" max="1">
              </div>
              <div class="form-group">
                <label>Market Distance (km)</label>
                <input type="number" id="infra_distance" value="${getInfraValue('distance')}" min="0" max="500">
              </div>
              <div class="form-group">
                <label>Digital Access (0-1)</label>
                <input type="number" id="infra_digital" value="${getInfraValue('digital')}" step="0.1" min="0" max="1">
              </div>
            </div>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" onclick="Admin.applySpatialData()">Apply Spatial Data</button>
        </div>
      </div>
    `;
  }

  function renderShockList() {
    const S = Simulation.getState();
    const shocks = S.activeShocks || [];
    
    if (shocks.length === 0) {
      return '<p class="empty-state">No active shocks. Add a shock event to simulate external disruptions.</p>';
    }
    
    return shocks.map((shock, i) => `
      <div class="shock-item">
        <span class="shock-name">${shock.name}</span>
        <span class="shock-remaining">${shock.remainingMonths} months remaining</span>
        <button class="btn btn-small btn-danger" onclick="Admin.removeShock(${i})">Remove</button>
      </div>
    `).join('');
  }

  // GIS Helper Functions
  function getCurrentCaseCoords() {
    const S = Simulation.getState();
    const cs = Config.getCaseStudy(S.caseStudy);
    return cs.location.coordinates || [0, 0];
  }
  
  function getSpatialValue(key) {
    const S = Simulation.getState();
    return S.spatial && S.spatial[key] !== undefined ? S.spatial[key] : 1.0;
  }
  
  function getInfraValue(key) {
    const S = Simulation.getState();
    const defaults = { road: 0.6, distance: 15, digital: 0.4 };
    return S.infrastructure && S.infrastructure[key] !== undefined ? S.infrastructure[key] : defaults[key];
  }
  
  function applySpatialData() {
    const S = Simulation.getState();
    
    // Update spatial multipliers
    S.spatial.urban = parseFloat(document.getElementById('spatial_urban')?.value || 1.0);
    S.spatial.peri_urban = parseFloat(document.getElementById('spatial_peri')?.value || 0.7);
    S.spatial.rural = parseFloat(document.getElementById('spatial_rural')?.value || 0.4);
    
    // Store infrastructure data (for future use in equations)
    S.infrastructure = {
      road: parseFloat(document.getElementById('infra_road')?.value || 0.6),
      distance: parseFloat(document.getElementById('infra_distance')?.value || 15),
      digital: parseFloat(document.getElementById('infra_digital')?.value || 0.4)
    };
    
    Simulation.logEvent('SPATIAL', `Updated: Urban=${S.spatial.urban}, Peri=${S.spatial.peri_urban}, Rural=${S.spatial.rural}`);
    alert('Spatial data applied successfully!');
  }

  function showAddShockForm() {
    const formHtml = `
      <div class="form-card">
        <h4>Add Shock Event</h4>
        <div class="form-grid">
          <div class="form-group">
            <label>Shock Name</label>
            <input type="text" id="shockName" placeholder="e.g., Monsoon Flood">
          </div>
          <div class="form-group">
            <label>Duration (months)</label>
            <input type="number" id="shockDuration" value="12" min="1" max="60">
          </div>
        </div>
        <h5>Effects (as decimals, negative for decrease)</h5>
        <div class="form-grid effects-grid">
          <div class="form-group">
            <label>Income</label>
            <input type="number" id="shockIncome" value="-0.20" step="0.05" min="-1" max="1">
          </div>
          <div class="form-group">
            <label>Market</label>
            <input type="number" id="shockMarket" value="-0.30" step="0.05" min="-1" max="1">
          </div>
          <div class="form-group">
            <label>Coordination</label>
            <input type="number" id="shockCoord" value="-0.10" step="0.05" min="-1" max="1">
          </div>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="shockDesc" rows="2" placeholder="Brief description of the shock"></textarea>
        </div>
        <div class="form-actions">
          <button class="btn btn-secondary" onclick="Admin.hideShockForm()">Cancel</button>
          <button class="btn btn-primary" onclick="Admin.saveShock()">Add Shock</button>
        </div>
      </div>
    `;
    document.getElementById('addShockForm').innerHTML = formHtml;
    document.getElementById('addShockForm').classList.remove('hidden');
  }

  function hideShockForm() {
    document.getElementById('addShockForm').classList.add('hidden');
  }

  function saveShock() {
    const shock = {
      name: document.getElementById('shockName').value,
      duration: parseInt(document.getElementById('shockDuration').value),
      effects: {
        income: parseFloat(document.getElementById('shockIncome').value),
        market: parseFloat(document.getElementById('shockMarket').value),
        coordination: parseFloat(document.getElementById('shockCoord').value)
      },
      description: document.getElementById('shockDesc').value
    };

    if (!shock.name) {
      alert('Please enter a shock name');
      return;
    }

    Simulation.addShock(shock);
    hideShockForm();
    document.getElementById('shockList').innerHTML = renderShockList();
  }

  function applyShockTemplate(templateId) {
    const template = Config.SHOCK_TEMPLATES[templateId];
    if (template) {
      Simulation.addShock({
        name: template.name,
        duration: template.duration,
        effects: template.effects,
        description: template.description
      });
      document.getElementById('shockList').innerHTML = renderShockList();
    }
  }

  function removeShock(index) {
    const S = Simulation.getState();
    if (S.activeShocks && S.activeShocks[index]) {
      S.activeShocks.splice(index, 1);
      document.getElementById('shockList').innerHTML = renderShockList();
    }
  }

  // FIX #42: CSV import stores time series for validation. Data stored in timeSeriesData
  // but not yet connected to model validation. Future: compare simulated vs empirical trajectories.
  function parseCSV() {
    const input = document.getElementById('csvInput').value;
    const lines = input.trim().split('\n');
    const data = [];
    
    lines.forEach((line, i) => {
      const parts = line.split(',').map(s => s.trim());
      if (parts.length >= 2) {
        data.push({
          month: parseInt(parts[0]) || i + 1,
          income: parseFloat(parts[1]) || 0,
          population: parseInt(parts[2]) || 0
        });
      }
    });

    timeSeriesData = data;
    
    const preview = document.getElementById('csvPreview');
    if (data.length > 0) {
      preview.innerHTML = `
        <p>Parsed ${data.length} data points</p>
        <table class="data-table">
          <tr><th>Month</th><th>Income</th><th>Population</th></tr>
          ${data.slice(0, 5).map(d => `<tr><td>${d.month}</td><td>₹${d.income}</td><td>${d.population}</td></tr>`).join('')}
          ${data.length > 5 ? '<tr><td colspan="3">...</td></tr>' : ''}
        </table>
      `;
      Simulation.logEvent('DATA', `Imported ${data.length} time series data points`);
    } else {
      preview.innerHTML = '<p class="error">No valid data found</p>';
    }
  }

  function attachDataHandlers() {}
  // ========== END: DATA_TAB ==========

  // ========== SECTION: CALIBRATION_TAB ==========
  function renderCalibrationTab() {
    const params = Config.EQUATION_PARAMS;
    const loops = Config.LOOPS;
    // FIX #18: Capture default loops on first render
    if (!DEFAULT_LOOPS) {
      DEFAULT_LOOPS = JSON.parse(JSON.stringify(loops));
    }
    
    let html = `
      <div class="admin-section">
        <h3>🔧 Model Calibration</h3>
        <p class="admin-desc">Adjust equation parameters and feedback loop strengths.</p>
      </div>
      
      <div class="admin-section">
        <h4>📐 Thresholds</h4>
        <div class="calibration-grid">
          <div class="calib-item">
            <label>TRAP Threshold (₹)</label>
            <input type="number" id="thresh_trap" value="${Config.THRESHOLDS.TRAP}" min="1000" max="20000">
            <span class="calib-help">Income below = poverty trap</span>
          </div>
          <div class="calib-item">
            <label>GROWTH Threshold (₹)</label>
            <input type="number" id="thresh_growth" value="${Config.THRESHOLDS.GROWTH}" min="2000" max="25000">
            <span class="calib-help">Income above = growth regime</span>
          </div>
          <div class="calib-item">
            <label>TRAP Duration (months)</label>
            <input type="number" id="thresh_trap_dur" value="${Config.THRESHOLDS.TRAP_DURATION}" min="1" max="24">
            <span class="calib-help">Months to confirm trap state</span>
          </div>
          <div class="calib-item">
            <label>GROWTH Duration (months)</label>
            <input type="number" id="thresh_growth_dur" value="${Config.THRESHOLDS.GROWTH_DURATION || 12}" min="1" max="36">
            <span class="calib-help">Months to confirm growth state</span>
          </div>
          <div class="calib-item">
            <label>FALL Duration (months)</label>
            <input type="number" id="thresh_fall_dur" value="${Config.THRESHOLDS.FALL_DURATION || 3}" min="1" max="12">
            <span class="calib-help">Months to confirm fall-back</span>
          </div>
        </div>
      </div>
      
      <div class="admin-section">
        <h4>🔄 Feedback Loops</h4>
        <div class="loops-grid">
    `;

    Object.values(loops).forEach(loop => {
      html += `
        <div class="loop-item ${loop.type.toLowerCase()}">
          <div class="loop-header">
            <label>
              <input type="checkbox" id="loop_${loop.id}_enabled" ${loop.enabled ? 'checked' : ''}>
              ${loop.id}: ${loop.name.split(':')[1] || loop.name}
            </label>
            <span class="loop-type">${loop.type}</span>
          </div>
          <div class="loop-strength">
            <label>Strength:</label>
            <input type="range" id="loop_${loop.id}_strength" min="0" max="150" value="${loop.strength * 100}">
            <span id="loop_${loop.id}_value">${(loop.strength * 100).toFixed(0)}%</span>
          </div>
          <p class="loop-desc">${loop.description}</p>
        </div>
      `;
    });

    html += `
        </div>
      </div>
      
      <div class="admin-section">
        <h4>📊 Equation Parameters</h4>
    `;

    Object.entries(params).forEach(([category, categoryParams]) => {
      html += `
        <div class="param-category">
          <h5>${category.charAt(0).toUpperCase() + category.slice(1)}</h5>
          <div class="param-grid">
      `;
      
      Object.entries(categoryParams).forEach(([key, param]) => {
        html += `
          <div class="param-item">
            <label>${param.label}</label>
            <input type="number" 
                   id="param_${category}_${key}" 
                   value="${param.value}" 
                   min="${param.min}" 
                   max="${param.max}" 
                   step="${(param.max - param.min) / 20}">
            <span class="param-range">${param.min} - ${param.max}</span>
          </div>
        `;
      });
      
      html += `</div></div>`;
    });

    html += `
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="Admin.resetCalibration()">Reset to Default</button>
        <button class="btn btn-primary" onclick="Admin.applyCalibration()">Apply Changes</button>
      </div>
      
      <div class="admin-section">
        <h4>⏱️ Time Delays (months)</h4>
        <p class="admin-desc">Effects are queued and applied after these delays.</p>
        <div class="calibration-grid">
          <div class="calib-item">
            <label>Skills Delay</label>
            <input type="number" id="delay_skills" value="${typeof Simulation !== 'undefined' ? Simulation.getCalibration().delays.skills : 6}" min="0" max="24">
            <span class="calib-help">Training effect delay</span>
          </div>
          <div class="calib-item">
            <label>Market Delay</label>
            <input type="number" id="delay_market" value="${typeof Simulation !== 'undefined' ? Simulation.getCalibration().delays.market : 3}" min="0" max="12">
            <span class="calib-help">Reputation build time</span>
          </div>
          <div class="calib-item">
            <label>Coordination Delay</label>
            <input type="number" id="delay_coordination" value="${typeof Simulation !== 'undefined' ? Simulation.getCalibration().delays.coordination : 12}" min="0" max="24">
            <span class="calib-help">Network formation time</span>
          </div>
          <div class="calib-item">
            <label>Income Delay</label>
            <input type="number" id="delay_income" value="${typeof Simulation !== 'undefined' ? Simulation.getCalibration().delays.income : 1}" min="0" max="6">
            <span class="calib-help">Economic response time</span>
          </div>
          <div class="calib-item">
            <label>Population Delay</label>
            <input type="number" id="delay_population" value="${typeof Simulation !== 'undefined' ? Simulation.getCalibration().delays.population : 6}" min="0" max="24">
            <span class="calib-help">Migration response time</span>
          </div>
        </div>
      </div>
      
      <div class="admin-section">
        <h4>📊 Engine Limits</h4>
        <p class="admin-desc">Global simulation boundaries.</p>
        <div class="calibration-grid">
          <div class="calib-item">
            <label>Income Ceiling (₹)</label>
            <input type="number" id="calib_income_ceiling" value="${typeof Simulation !== 'undefined' ? Simulation.getCalibration().incomeCeiling : 25000}" min="10000" max="100000" step="1000">
            <span class="calib-help">Maximum achievable income</span>
          </div>
        </div>
      </div>
      
      <div class="admin-section">
        <h4>👩‍🦰 Gender Parameters</h4>
        <p class="admin-desc">Configure gender-disaggregated analysis.</p>
        <div class="calibration-grid">
          <div class="calib-item">
            <label>Gender Analysis</label>
            <select id="gender_enabled">
              <option value="true" ${(typeof Simulation !== 'undefined' && Simulation.getCalibration().gender.enabled) ? 'selected' : ''}>Enabled</option>
              <option value="false" ${(typeof Simulation !== 'undefined' && !Simulation.getCalibration().gender.enabled) ? 'selected' : ''}>Disabled</option>
            </select>
          </div>
          <div class="calib-item">
            <label>Wage Gap Ratio</label>
            <input type="number" id="gender_wage_gap" value="${typeof Simulation !== 'undefined' ? Simulation.getCalibration().gender.wageGap : 0.75}" min="0.5" max="1" step="0.05">
            <span class="calib-help">Women earn X of men (0-1)</span>
          </div>
          <div class="calib-item">
            <label>Female % Seg A</label>
            <input type="number" id="gender_seg_a" value="${typeof Simulation !== 'undefined' ? Math.round(Simulation.getCalibration().gender.segmentFemaleShare.A * 100) : 80}" min="0" max="100">
            <span class="calib-help">% women in subsistence</span>
          </div>
          <div class="calib-item">
            <label>Female % Seg B</label>
            <input type="number" id="gender_seg_b" value="${typeof Simulation !== 'undefined' ? Math.round(Simulation.getCalibration().gender.segmentFemaleShare.B * 100) : 65}" min="0" max="100">
            <span class="calib-help">% women in traditional</span>
          </div>
          <div class="calib-item">
            <label>Female % Seg C</label>
            <input type="number" id="gender_seg_c" value="${typeof Simulation !== 'undefined' ? Math.round(Simulation.getCalibration().gender.segmentFemaleShare.C * 100) : 45}" min="0" max="100">
            <span class="calib-help">% women in market-ready</span>
          </div>
        </div>
      </div>
      
      <div class="admin-section">
        <h4>🔗 Policy Interactions</h4>
        <p class="admin-desc">Synergies and conflicts when policies are combined.</p>
        <div class="interaction-grid">
          <div class="interaction-item synergy">
            <span class="interaction-pair">SFURTI + ODOP</span>
            <input type="number" id="pi_sfurti_odop" value="${typeof Simulation !== 'undefined' ? Simulation.getCalibration().policyInteractions['SFURTI+ODOP']?.modifier || 1.25 : 1.25}" min="0.5" max="2" step="0.05">
            <span class="interaction-type">Synergy</span>
          </div>
          <div class="interaction-item synergy">
            <span class="interaction-pair">NHDP + AHVY (Ambedkar Hastshilp)</span>
            <input type="number" id="pi_nhdp_ahvy" value="${typeof Simulation !== 'undefined' ? Simulation.getCalibration().policyInteractions['NHDP+AMBEDKAR_HASTSHILP']?.modifier || 1.15 : 1.15}" min="0.5" max="2" step="0.05">
            <span class="interaction-type">Synergy</span>
          </div>
          <div class="interaction-item conflict">
            <span class="interaction-pair">ECOMMERCE + HUNAR_HAAT</span>
            <input type="number" id="pi_ecommerce_hunar" value="${typeof Simulation !== 'undefined' ? Simulation.getCalibration().policyInteractions['ECOMMERCE+HUNAR_HAAT']?.modifier || 0.85 : 0.85}" min="0.5" max="2" step="0.05">
            <span class="interaction-type">Conflict</span>
          </div>
          <div class="interaction-item redundancy">
            <span class="interaction-pair">PMEGP + PM_VISHWAKARMA</span>
            <input type="number" id="pi_pmegp_vishwa" value="${typeof Simulation !== 'undefined' ? Simulation.getCalibration().policyInteractions['PMEGP+PM_VISHWAKARMA']?.modifier || 0.80 : 0.80}" min="0.5" max="2" step="0.05">
            <span class="interaction-type">Redundancy</span>
          </div>
        </div>
      </div>
    `;

    return html;
  }

  function applyCalibration() {
    // Update thresholds — FIX #22: Include GROWTH_DUR and FALL_DUR
    Config.THRESHOLDS.TRAP = parseInt(document.getElementById('thresh_trap').value);
    Config.THRESHOLDS.GROWTH = parseInt(document.getElementById('thresh_growth').value);
    Config.THRESHOLDS.TRAP_DURATION = parseInt(document.getElementById('thresh_trap_dur').value);
    Config.THRESHOLDS.GROWTH_DURATION = parseInt(document.getElementById('thresh_growth_dur')?.value || 12);
    Config.THRESHOLDS.FALL_DURATION = parseInt(document.getElementById('thresh_fall_dur')?.value || 3);

    // Update loops
    Object.keys(Config.LOOPS).forEach(loopId => {
      const enabledEl = document.getElementById(`loop_${loopId}_enabled`);
      const strengthEl = document.getElementById(`loop_${loopId}_strength`);
      if (enabledEl && strengthEl) {
        Config.LOOPS[loopId].enabled = enabledEl.checked;
        Config.LOOPS[loopId].strength = parseInt(strengthEl.value) / 100;
      }
    });

    // Update equation parameters
    Object.entries(Config.EQUATION_PARAMS).forEach(([category, params]) => {
      Object.keys(params).forEach(key => {
        const input = document.getElementById(`param_${category}_${key}`);
        if (input) {
          Config.EQUATION_PARAMS[category][key].value = parseFloat(input.value);
        }
      });
    });

    // Update time delays in simulation
    const delays = {};
    ['skills', 'market', 'coordination', 'income', 'population'].forEach(d => {
      const el = document.getElementById(`delay_${d}`);
      if (el) delays[d] = parseInt(el.value);
    });
    
    // Update income ceiling
    const incomeCeilingEl = document.getElementById('calib_income_ceiling');
    const incomeCeiling = incomeCeilingEl ? parseInt(incomeCeilingEl.value) : null;
    
    // Update gender parameters
    const gender = {
      enabled: document.getElementById('gender_enabled')?.value === 'true',
      wageGap: parseFloat(document.getElementById('gender_wage_gap')?.value || 0.75),
      segmentFemaleShare: {
        A: parseInt(document.getElementById('gender_seg_a')?.value || 80) / 100,
        B: parseInt(document.getElementById('gender_seg_b')?.value || 65) / 100,
        C: parseInt(document.getElementById('gender_seg_c')?.value || 45) / 100
      }
    };
    
    // Update policy interactions
    const policyInteractions = {};
    const piMappings = {
      'pi_sfurti_odop': 'SFURTI+ODOP',
      'pi_nhdp_ahvy': 'NHDP+AMBEDKAR_HASTSHILP',
      'pi_ecommerce_hunar': 'ECOMMERCE+HUNAR_HAAT',
      'pi_pmegp_vishwa': 'PMEGP+PM_VISHWAKARMA'
    };
    Object.entries(piMappings).forEach(([elId, key]) => {
      const el = document.getElementById(elId);
      if (el) {
        const val = parseFloat(el.value);
        policyInteractions[key] = { 
          modifier: val, 
          type: val > 1 ? 'synergy' : val < 1 ? 'conflict' : 'neutral' 
        };
      }
    });
    
    // Apply to Simulation calibration
    if (typeof Simulation !== 'undefined' && Simulation.updateCalibration) {
      const calUpdate = { delays, gender, policyInteractions };
      if (incomeCeiling) calUpdate.incomeCeiling = incomeCeiling;
      Simulation.updateCalibration(calUpdate);
    }
    
    // Update case-specific thresholds
    if (typeof Simulation !== 'undefined' && Simulation.updateCaseThresholds) {
      Simulation.updateCaseThresholds({
        TRAP: Config.THRESHOLDS.TRAP,
        GROWTH: Config.THRESHOLDS.GROWTH,
        TRAP_DUR: Config.THRESHOLDS.TRAP_DURATION || 6,
        GROWTH_DUR: Config.THRESHOLDS.GROWTH_DURATION || 12,
        FALL_DUR: Config.THRESHOLDS.FALL_DURATION || 3
      });
    }

    Simulation.logEvent('CALIBRATE', 'All parameters updated');
    alert('Calibration applied successfully! Changes will affect simulation immediately.');
  }

  // FIX #18: Store original defaults for reset
  const DEFAULT_THRESHOLDS = JSON.parse(JSON.stringify(Config.THRESHOLDS));
  const DEFAULT_EQUATION_PARAMS = JSON.parse(JSON.stringify(Config.EQUATION_PARAMS));
  let DEFAULT_LOOPS = null; // Set on first render
  
  function resetCalibration() {
    if (confirm('Reset all parameters to default values?')) {
      // FIX #18: Actually reset the values, not just re-render
      Object.assign(Config.THRESHOLDS, DEFAULT_THRESHOLDS);
      if (DEFAULT_LOOPS) {
        Object.keys(DEFAULT_LOOPS).forEach(id => {
          if (Config.LOOPS[id]) Object.assign(Config.LOOPS[id], DEFAULT_LOOPS[id]);
        });
      }
      Object.entries(DEFAULT_EQUATION_PARAMS).forEach(([cat, params]) => {
        Object.entries(params).forEach(([key, val]) => {
          if (Config.EQUATION_PARAMS[cat] && Config.EQUATION_PARAMS[cat][key]) {
            Config.EQUATION_PARAMS[cat][key].value = val.value;
          }
        });
      });
      // Reset CALIBRATION in simulation
      if (typeof Simulation !== 'undefined' && Simulation.updateCalibration) {
        Simulation.updateCalibration({
          delays: { skills: 6, market: 3, coordination: 12, income: 1, population: 6 },
          gender: { enabled: true, wageGap: 0.75, segmentFemaleShare: { A: 0.80, B: 0.65, C: 0.45 } },
          policyInteractions: {
            'SFURTI+ODOP': { modifier: 1.25, type: 'synergy' },
            'NHDP+AMBEDKAR_HASTSHILP': { modifier: 1.15, type: 'synergy' },
            'ECOMMERCE+HUNAR_HAAT': { modifier: 0.85, type: 'conflict' },
            'PMEGP+PM_VISHWAKARMA': { modifier: 0.80, type: 'redundancy' }
          }
        });
      }
      Simulation.logEvent('CALIBRATE', 'All parameters reset to defaults');
      renderTab('calibration');
    }
  }

  function attachCalibrationHandlers() {
    // Add live update for loop strength display
    Object.keys(Config.LOOPS).forEach(loopId => {
      const slider = document.getElementById(`loop_${loopId}_strength`);
      const display = document.getElementById(`loop_${loopId}_value`);
      if (slider && display) {
        slider.addEventListener('input', () => {
          display.textContent = `${slider.value}%`;
        });
      }
    });
  }
  // ========== END: CALIBRATION_TAB ==========

  // ========== SECTION: EXPORT_TAB ==========
  function renderExportTab() {
    return `
      <div class="admin-section">
        <h3>📤 Export & Import</h3>
        <p class="admin-desc">Export configuration, results, and reports.</p>
      </div>
      
      <div class="admin-section">
        <h4>💾 Configuration</h4>
        <p>Export/import full model configuration including custom policies and case studies.</p>
        <div class="export-buttons">
          <button class="btn btn-primary" onclick="Export.exportConfig()">📥 Export Config (JSON)</button>
          <button class="btn btn-secondary" onclick="Admin.triggerImportConfig()">📤 Import Config</button>
          <input type="file" id="configFileInput" accept=".json" style="display:none" onchange="Admin.importConfig(event)">
        </div>
      </div>
      
      <div class="admin-section">
        <h4>📊 Simulation Results</h4>
        <p>Export current simulation data and event log.</p>
        <div class="export-buttons">
          <button class="btn btn-secondary" onclick="Export.exportCSV()">📊 Export Data (CSV)</button>
          <button class="btn btn-secondary" onclick="Export.exportEventLog()">📋 Export Event Log</button>
        </div>
      </div>

      <div class="admin-section">
        <h4>🧭 Policy Interaction Analysis</h4>
        <p>Analyse your current policy selection for this case — escape reliability, the structural backbone (smallest set that still escapes), and which instruments are redundant.</p>
        <div class="export-buttons">
          <button class="btn btn-primary" onclick="Export.exportPolicyReport()">📄 Policy Analysis Report</button>
          <button class="btn btn-secondary" onclick="Export.exportPolicyTool()">🛠️ Interactive Analysis Tool</button>
        </div>
      </div>
      
      <div class="admin-section">
        <h4>📄 Report Generation</h4>
        <p>Generate printable reports for thesis or presentations.</p>
        <div class="report-options">
          <label><input type="checkbox" id="rep_summary" checked> Executive Summary</label>
          <label><input type="checkbox" id="rep_config" checked> Model Configuration</label>
          <label><input type="checkbox" id="rep_charts" checked> Charts & Visualizations</label>
          <label><input type="checkbox" id="rep_policies" checked> Active Policies</label>
          <label><input type="checkbox" id="rep_log" checked> Event Log</label>
        </div>
        <div class="btn-row" style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-primary" onclick="Export.generateReport()">📄 Technical Report</button>
          <button class="btn btn-primary" onclick="Export.generateExecutiveBrief()">📊 Executive Brief</button>
        </div>
        <p style="margin-top: 10px; font-size: 10px; color: #64748b;">
          <strong>Technical Report:</strong> Full details for thesis documentation<br>
          <strong>Executive Brief:</strong> 1-2 page summary with recommendations
        </p>
      </div>
    `;
  }

  function triggerImportConfig() {
    document.getElementById('configFileInput').click();
  }

  function importConfig(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result);
        
        // Import custom policies
        if (config.customPolicies) {
          customPolicies = config.customPolicies;
        }
        
        // Import custom case studies
        if (config.customCaseStudies) {
          customCaseStudies = config.customCaseStudies;
          updateCaseStudyDropdown();
        }
        
        // Import calibration
        if (config.thresholds) {
          Object.assign(Config.THRESHOLDS, config.thresholds);
        }
        if (config.loops) {
          Object.keys(config.loops).forEach(id => {
            if (Config.LOOPS[id]) {
              Object.assign(Config.LOOPS[id], config.loops[id]);
            }
          });
        }
        // FIX #14: Import equation params
        if (config.equationParams) {
          Object.entries(config.equationParams).forEach(([cat, params]) => {
            if (Config.EQUATION_PARAMS[cat]) {
              Object.entries(params).forEach(([key, val]) => {
                if (Config.EQUATION_PARAMS[cat][key] && typeof val.value === 'number' && isFinite(val.value)) {
                  Config.EQUATION_PARAMS[cat][key].value = val.value;
                }
              });
            }
          });
        }
        // FIX #14: Import full CALIBRATION (delays, gender, interactions, etc.)
        if (config.calibration && typeof Simulation !== 'undefined') {
          Simulation.updateCalibration(config.calibration);
        }
        
        Simulation.logEvent('IMPORT', 'Configuration imported successfully');
        alert('Configuration imported successfully');
        renderTab(currentTab);
      } catch (err) {
        alert('Error importing configuration: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function runMonteCarlo() {
    const runs = parseInt(document.getElementById('mcRuns').value);
    const months = parseInt(document.getElementById('mcMonths').value);
    
    const resultsDiv = document.getElementById('monteCarloResults');
    resultsDiv.innerHTML = '<p>Running Monte Carlo simulation...</p>';
    
    // Run async to not block UI
    setTimeout(() => {
      const results = Simulation.runMonteCarlo(runs, months);
      
      resultsDiv.innerHTML = `
        <div class="mc-summary">
          <h5>Results (${runs} runs, ${months} months)</h5>
          <div class="mc-stats">
            <div class="stat">
              <span class="stat-label">Mean Final Income</span>
              <span class="stat-value">₹${Math.round(results.stats.mean).toLocaleString()}</span>
            </div>
            <div class="stat">
              <span class="stat-label">95% CI</span>
              <span class="stat-value">₹${Math.round(results.stats.ci95_low).toLocaleString()} - ₹${Math.round(results.stats.ci95_high).toLocaleString()}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Escape Probability</span>
              <span class="stat-value">${(results.stats.escapeProb * 100).toFixed(1)}%</span>
            </div>
            <div class="stat">
              <span class="stat-label">Final States</span>
              <span class="stat-value">TRAP: ${results.finalStates.TRAP}, TRANS: ${results.finalStates.TRANSITION}, GROWTH: ${results.finalStates.GROWTH}</span>
            </div>
          </div>
          <canvas id="mcChart" height="200"></canvas>
        </div>
      `;
      
      // Render histogram
      setTimeout(() => {
        const canvas = document.getElementById('mcChart');
        if (canvas) {
          Charts.renderMonteCarloChart(canvas, results);
        }
      }, 100);
    }, 100);
  }

  function attachExportHandlers() {}
  // ========== END: EXPORT_TAB ==========

  // ========== SECTION: COMPLEXITY_TAB ==========
  function renderComplexityTab() {
    const CX = Config.COMPLEXITY;
    if (!CX) {
      return '<div class="admin-section"><p>Complexity layer not available. Check Config.COMPLEXITY.</p></div>';
    }
    
    try {
    const enabled = CX && CX.enabled;
    
    // Helper to create a toggle row
    const toggle = (label, path, checked, desc) => `
      <div class="cal-row">
        <label title="${desc || ''}">${label}</label>
        <label class="switch"><input type="checkbox" data-cx="${path}" ${checked ? 'checked' : ''}><span class="slider"></span></label>
      </div>`;
    
    // Helper to create a number input row
    const numInput = (label, path, value, min, max, step, desc) => `
      <div class="cal-row">
        <label title="${desc || ''}">${label}</label>
        <input type="number" data-cx="${path}" value="${value}" min="${min}" max="${max}" step="${step || 0.01}" class="cal-input">
      </div>`;
    
    let html = `
      <div class="admin-section">
        <div class="admin-section-header">
          <h3>🧬 Complexity Layer Controls</h3>
          ${toggle('Master Switch', 'enabled', enabled, 'Enable/disable entire complexity layer')}
        </div>
        <p class="admin-desc">Transforms model from L1 (linear dampening) to L3-L4 (genuinely complex). All parameters tunable without code changes.</p>
      </div>`;
    
    // Layer 1: Within-Dimension Resistance
    html += `
      <div class="admin-section">
        <h4>📈 Layer 1: Within-Dimension Resistance</h4>
        <p class="admin-desc">"Success breeds its own friction" — each variable resists its own improvement</p>
        
        <div class="admin-subsection">
          <h5>Policy Ramp-Up & Fatigue <small>(Baumgartner & Jones 1993)</small></h5>
          ${toggle('Enabled', 'policyRampup.enabled', CX.policyRampup.enabled, 'Policies follow S-curve to full effectiveness')}
          ${numInput('Ramp-up months', 'policyRampup.rampMonths', CX.policyRampup.rampMonths, 6, 60, 1, 'Months to reach full effectiveness')}
          ${numInput('Initial effectiveness', 'policyRampup.initialEffectiveness', CX.policyRampup.initialEffectiveness, 0.05, 0.50, 0.05, 'Starting effectiveness (0-1)')}
          ${numInput('Fatigue start (years)', 'policyRampup.fatigueStartYear', CX.policyRampup.fatigueStartYear, 2, 15, 1, 'Years before diminishing returns')}
          ${numInput('Fatigue rate (annual)', 'policyRampup.fatigueRate', CX.policyRampup.fatigueRate, 0.01, 0.10, 0.01, 'Annual decline after peak')}
        </div>
        
        <div class="admin-subsection">
          <h5>Demand Saturation <small>(Market saturation theory)</small></h5>
          ${toggle('Enabled', 'demandSaturation.enabled', CX.demandSaturation.enabled)}
          ${numInput('Saturation income (₹)', 'demandSaturation.saturationIncome', CX.demandSaturation.saturationIncome, 8000, 25000, 1000)}
          ${numInput('Saturation strength', 'demandSaturation.saturationStrength', CX.demandSaturation.saturationStrength, 0.1, 1.0, 0.1)}
        </div>
        
        <div class="admin-subsection">
          <h5>Stochastic Shocks <small>(Regime-dependent disruptions)</small></h5>
          ${toggle('Enabled', 'stochasticShocks.enabled', CX.stochasticShocks.enabled)}
          ${numInput('Base frequency (monthly)', 'stochasticShocks.baseFrequency', CX.stochasticShocks.baseFrequency, 0.01, 0.10, 0.005)}
          ${numInput('TRAP vulnerability', 'stochasticShocks.trapVulnerability', CX.stochasticShocks.trapVulnerability, 1.0, 3.0, 0.1)}
          ${numInput('GROWTH vulnerability', 'stochasticShocks.growthVulnerability', CX.stochasticShocks.growthVulnerability, 0.1, 1.0, 0.1)}
          ${numInput('Min magnitude', 'stochasticShocks.magnitudeMin', CX.stochasticShocks.magnitudeMin, 0.01, 0.10, 0.01)}
          ${numInput('Max magnitude', 'stochasticShocks.magnitudeMax', CX.stochasticShocks.magnitudeMax, 0.05, 0.30, 0.01)}
          ${numInput('Recovery rate', 'stochasticShocks.recoveryRate', CX.stochasticShocks.recoveryRate, 0.1, 0.9, 0.05, 'Speed of recovery from shocks (lower = slower)')}
        </div>
      </div>`;
    
    // Layer 2: Between-Dimension Tensions
    html += `
      <div class="admin-section">
        <h4>⚡ Layer 2: Between-Dimension Tensions (T1–T7)</h4>
        <p class="admin-desc">Dimensions in tension — improving one necessarily resists another</p>
        
        <div class="admin-subsection">
          <h5>T1: Market ↔ Heritage <small>(Liebl & Roy 2003; Scrase 2003)</small></h5>
          ${toggle('Enabled', 'tensions.marketHeritage.enabled', CX.tensions.marketHeritage.enabled)}
          ${numInput('Market threshold', 'tensions.marketHeritage.marketThreshold', CX.tensions.marketHeritage.marketThreshold, 0.3, 0.8, 0.05)}
          ${numInput('Erosion strength', 'tensions.marketHeritage.erosionStrength', CX.tensions.marketHeritage.erosionStrength, 0.005, 0.05, 0.005)}
          ${numInput('Heritage market brake', 'tensions.marketHeritage.heritageMarketBrake', CX.tensions.marketHeritage.heritageMarketBrake, 0.4, 0.9, 0.05)}
          ${numInput('Brake strength', 'tensions.marketHeritage.brakeStrength', CX.tensions.marketHeritage.brakeStrength, 0.1, 0.8, 0.1)}
        </div>
        
        <div class="admin-subsection">
          <h5>T2: Income ↔ Middlemen Adaptation <small>(Gereffi et al. 2005)</small></h5>
          ${toggle('Enabled', 'tensions.middlemenAdaptation.enabled', CX.tensions.middlemenAdaptation.enabled)}
          ${numInput('Adaptation rate', 'tensions.middlemenAdaptation.adaptationRate', CX.tensions.middlemenAdaptation.adaptationRate, 0.05, 0.50, 0.05)}
          ${numInput('Trigger growth rate', 'tensions.middlemenAdaptation.triggerGrowth', CX.tensions.middlemenAdaptation.triggerGrowth, 0.01, 0.05, 0.005)}
          ${numInput('Max resurgence', 'tensions.middlemenAdaptation.maxResurgence', CX.tensions.middlemenAdaptation.maxResurgence, 0.005, 0.03, 0.005)}
        </div>
        
        <div class="admin-subsection">
          <h5>T3: Coordination ↔ Institutional Friction <small>(Ostrom 1990; Bardhan 2002)</small></h5>
          ${toggle('Enabled', 'tensions.coordinationFriction.enabled', CX.tensions.coordinationFriction.enabled)}
          ${numInput('Friction per policy', 'tensions.coordinationFriction.frictionPerPolicy', CX.tensions.coordinationFriction.frictionPerPolicy, 0.005, 0.05, 0.005)}
          ${numInput('Max friction', 'tensions.coordinationFriction.maxFriction', CX.tensions.coordinationFriction.maxFriction, 0.02, 0.15, 0.01)}
          <p class="admin-desc" style="font-size:11px;opacity:0.8;margin-top:6px">Note: once several policies are active, coordination is already pinned near its 0.10 floor, so raising this cap rarely shifts outcomes on its own — the friction is saturated. Escape timing responds mainly to <b>initial conditions</b> (which need a fresh run), not to friction edits made mid-run.</p>
        </div>
        
        <div class="admin-subsection">
          <h5>T4: Skills ↔ Brain Drain <small>(Harris-Todaro 1970; Breman 2013)</small></h5>
          ${toggle('Enabled', 'tensions.brainDrain.enabled', CX.tensions.brainDrain.enabled)}
          ${numInput('Skill threshold', 'tensions.brainDrain.skillThreshold', CX.tensions.brainDrain.skillThreshold, 0.5, 0.9, 0.05)}
          ${numInput('Income threshold (₹)', 'tensions.brainDrain.incomeThreshold', CX.tensions.brainDrain.incomeThreshold, 5000, 20000, 1000)}
          ${numInput('Drain rate', 'tensions.brainDrain.drainRate', CX.tensions.brainDrain.drainRate, 0.001, 0.01, 0.001)}
        </div>
        
        <div class="admin-subsection">
          <h5>T5: Political Attention Cycles <small>(Kingdon 1984)</small></h5>
          ${toggle('Enabled', 'tensions.politicalCycles.enabled', CX.tensions.politicalCycles.enabled)}
          ${numInput('Cycle length (months)', 'tensions.politicalCycles.cycleLengthMonths', CX.tensions.politicalCycles.cycleLengthMonths, 36, 84, 6)}
          ${numInput('Attention amplitude', 'tensions.politicalCycles.attentionAmplitude', CX.tensions.politicalCycles.attentionAmplitude, 0.05, 0.25, 0.01)}
          ${numInput('Election implementation dip', 'tensions.politicalCycles.implementationDip', CX.tensions.politicalCycles.implementationDip, 0.05, 0.30, 0.05)}
        </div>
        
        <div class="admin-subsection">
          <h5>T6: Population ↔ Competition <small>(Carrying capacity models)</small></h5>
          ${toggle('Enabled', 'tensions.populationCompetition.enabled', CX.tensions.populationCompetition.enabled)}
          ${numInput('Base intensity (log-norm)', 'tensions.populationCompetition.baseIntensity', CX.tensions.populationCompetition.baseIntensity, 0.01, 0.15, 0.005)}
          ${numInput('Market capacity mult', 'tensions.populationCompetition.marketCapacityMult', CX.tensions.populationCompetition.marketCapacityMult, 0.5, 2.0, 0.1)}
        </div>
        
        <div class="admin-subsection">
          <h5>T7: Inequality ↔ Coordination <small>(Olson 1965)</small></h5>
          ${toggle('Enabled', 'tensions.inequalityCoordination.enabled', CX.tensions.inequalityCoordination.enabled)}
          ${numInput('C:A ratio threshold', 'tensions.inequalityCoordination.ratioThreshold', CX.tensions.inequalityCoordination.ratioThreshold, 1.5, 3.0, 0.1)}
          ${numInput('Penalty rate', 'tensions.inequalityCoordination.penaltyRate', CX.tensions.inequalityCoordination.penaltyRate, 0.005, 0.05, 0.005)}
        </div>
      </div>`;
    
    // Dormant Dimension Activation
    html += `
      <div class="admin-section">
        <h4>🔓 Dormant Dimension Activation (D1, D2, D3, D5, D6)</h4>
        <p class="admin-desc">Transforms decorative dimensions into dynamically participatory ones</p>
        
        <div class="admin-subsection">
          <h5>D1: Graph Theory → Network Density <small>(Perrow 1984)</small></h5>
          ${toggle('Enabled', 'graphTheory.enabled', CX.graphTheory.enabled)}
          ${toggle('Density → fragility', 'graphTheory.densityFeedback', CX.graphTheory.densityFeedback)}
          ${numInput('Fragility coupling', 'graphTheory.fragilityCoupling', CX.graphTheory.fragilityCoupling, 0.05, 0.50, 0.05)}
          ${numInput('Rigidity threshold', 'graphTheory.rigidityThreshold', CX.graphTheory.rigidityThreshold, 4, 15, 1)}
        </div>
        
        <div class="admin-subsection">
          <h5>D2: Attractor → Basin Dynamics <small>(Scheffer 2009)</small></h5>
          ${toggle('Enabled', 'attractorDynamics.enabled', CX.attractorDynamics.enabled)}
          ${toggle('Hysteresis', 'attractorDynamics.hysteresis', CX.attractorDynamics.hysteresis)}
          ${numInput('Escape multiplier', 'attractorDynamics.escapeMultiplier', CX.attractorDynamics.escapeMultiplier, 1.0, 2.0, 0.1)}
          ${numInput('Pull strength', 'attractorDynamics.pullStrength', CX.attractorDynamics.pullStrength, 0.005, 0.05, 0.005)}
          ${toggle('Remove GROWTH bonus', 'attractorDynamics.removeGrowthBonus', CX.attractorDynamics.removeGrowthBonus)}
        </div>
        
        <div class="admin-subsection">
          <h5>D3: NPF → Narrative Feedback <small>(Shanahan et al. 2011)</small></h5>
          ${toggle('Enabled', 'npfFeedback.enabled', CX.npfFeedback.enabled)}
          ${numInput('Narrative boost', 'npfFeedback.narrativeBoost', CX.npfFeedback.narrativeBoost, 0.05, 0.25, 0.01)}
          ${numInput('Narrative penalty', 'npfFeedback.narrativePenalty', CX.npfFeedback.narrativePenalty, 0.03, 0.20, 0.01)}
          ${numInput('Coalition friction', 'npfFeedback.coalitionFriction', CX.npfFeedback.coalitionFriction, 0.01, 0.10, 0.01)}
          ${numInput('Narrative inertia', 'npfFeedback.narrativeInertia', CX.npfFeedback.narrativeInertia, 0.5, 0.99, 0.05)}
        </div>
        
        <div class="admin-subsection">
          <h5>D5: Spatiotemporal → Dynamic Infrastructure <small>(Hägerstrand 1967)</small></h5>
          ${toggle('Enabled', 'spatialDynamics.enabled', CX.spatialDynamics.enabled)}
          ${numInput('Digital growth rate', 'spatialDynamics.digitalGrowthRate', CX.spatialDynamics.digitalGrowthRate, 0.001, 0.01, 0.001)}
          ${numInput('Road growth rate', 'spatialDynamics.roadGrowthRate', CX.spatialDynamics.roadGrowthRate, 0.001, 0.01, 0.001)}
          ${numInput('Diffusion decay', 'spatialDynamics.diffusionDecay', CX.spatialDynamics.diffusionDecay, 0.2, 1.0, 0.1)}
        </div>
        
        <div class="admin-subsection">
          <h5>D6: ABM → Decision-Based Mobility <small>(Harris-Todaro 1970)</small></h5>
          ${toggle('Enabled', 'abmDecisions.enabled', CX.abmDecisions.enabled)}
          ${numInput('Aspiration strength', 'abmDecisions.aspirationStrength', CX.abmDecisions.aspirationStrength, 0.01, 0.10, 0.01)}
          ${toggle('Exit enabled', 'abmDecisions.exitEnabled', CX.abmDecisions.exitEnabled)}
          ${numInput('Exit skill threshold', 'abmDecisions.exitSkillThreshold', CX.abmDecisions.exitSkillThreshold, 0.5, 0.9, 0.05)}
          ${numInput('Exit income threshold (₹)', 'abmDecisions.exitIncomeThreshold', CX.abmDecisions.exitIncomeThreshold, 4000, 15000, 1000)}
        </div>
      </div>
      
      <div class="admin-section">
        <h4>🔗 STEP 3: Policy Prerequisites <small>(Howlett & Rayner 2007)</small></h4>
        <p class="admin-desc">Policy effectiveness depends on which other policies are active and mature. These are defined in the CALIBRATION object.</p>
        ${renderPrerequisiteMatrix()}
      </div>`;
    
    return html;
    } catch(e) {
      console.error('renderComplexityTab error:', e);
      return '<div class="admin-section"><p style="color:#dc2626;">Error rendering complexity tab: ' + e.message + '</p></div>';
    }
  }
  
  function renderPrerequisiteMatrix() {
    try {
      const cal = Simulation.getCalibration();
      const prereqs = cal.policyPrerequisites;
      if (!prereqs || Object.keys(prereqs).length === 0) {
        return '<p style="font-size:10px;color:#64748b;">No prerequisites configured.</p>';
      }
      
      let html = '<table style="width:100%;font-size:10px;border-collapse:collapse;margin-top:8px;">';
      html += '<tr><th style="border:1px solid #e2e8f0;padding:4px;background:#f8fafc;">Policy</th><th style="border:1px solid #e2e8f0;padding:4px;background:#f8fafc;">Enhanced By</th><th style="border:1px solid #e2e8f0;padding:4px;background:#f8fafc;">Boost</th><th style="border:1px solid #e2e8f0;padding:4px;background:#f8fafc;">Penalty</th><th style="border:1px solid #e2e8f0;padding:4px;background:#f8fafc;">Maturity</th></tr>';
      
      Object.entries(prereqs).forEach(([policyId, config]) => {
        if (!config.enhancedBy || config.enhancedBy.length === 0) return; // Skip PM_VISHWAKARMA etc.
        const policyName = Config.getPolicy(policyId)?.name || policyId;
        const prereqNames = config.enhancedBy.map(id => Config.getPolicy(id)?.name || id).join(', ');
        html += `<tr>
          <td style="border:1px solid #e2e8f0;padding:4px;font-weight:600;">${policyName}</td>
          <td style="border:1px solid #e2e8f0;padding:4px;">${prereqNames}</td>
          <td style="border:1px solid #e2e8f0;padding:4px;color:#16a34a;">+${((config.boost - 1) * 100).toFixed(0)}%</td>
          <td style="border:1px solid #e2e8f0;padding:4px;color:#dc2626;">${((config.penalty - 1) * 100).toFixed(0)}%</td>
          <td style="border:1px solid #e2e8f0;padding:4px;">${config.maturityMonths}mo</td>
        </tr>`;
      });
      
      html += '</table>';
      return html;
    } catch(e) {
      console.error('renderPrerequisiteMatrix error:', e);
      return '<p style="font-size:10px;color:#dc2626;">Error loading prerequisites. Check console.</p>';
    }
  }

  function attachComplexityHandlers() {
    // Toggle handlers
    document.querySelectorAll('[data-cx]').forEach(el => {
      const handler = () => {
        const path = el.dataset.cx;
        const parts = path.split('.');
        let target = Config.COMPLEXITY;
        
        for (let i = 0; i < parts.length - 1; i++) {
          if (!target[parts[i]]) return;
          target = target[parts[i]];
        }
        
        const key = parts[parts.length - 1];
        if (el.type === 'checkbox') {
          target[key] = el.checked;
        } else if (el.type === 'number') {
          target[key] = parseFloat(el.value);
        }
        
        Simulation.logEvent('COMPLEXITY', `Updated ${path} = ${target[key]}`);
      };
      
      if (el.type === 'checkbox') {
        el.addEventListener('change', handler);
      } else if (el.type === 'number') {
        el.addEventListener('change', handler);
        el.addEventListener('blur', handler);
      }
    });
  }
  // ========== END: COMPLEXITY_TAB ==========

  // Public API
  return {
    openPanel,
    closePanel,
    switchTab,
    
    // Policies
    showAddPolicyForm,
    hideAddPolicyForm,
    savePolicy,
    editPolicy,
    deletePolicy,
    revertPolicy,
    
    // Case Studies
    showAddCaseForm,
    hideAddCaseForm,
    saveCase,
    editCase,
    deleteCase,
    revertCase,
    switchCase,
    updateCaseStudyDropdown,
    
    // Data
    showAddShockForm,
    hideShockForm,
    saveShock,
    applyShockTemplate,
    removeShock,
    parseCSV,
    applySpatialData,
    
    // Calibration
    applyCalibration,
    resetCalibration,
    
    // Export
    triggerImportConfig,
    importConfig,
    runMonteCarlo,
    
    // Getters
    getCustomPolicies: () => customPolicies,
    getCustomCaseStudies: () => customCaseStudies,
    getTimeSeriesData: () => timeSeriesData
  };
})();
