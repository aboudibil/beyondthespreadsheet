/* ╔════════════════════════════════════════════════════════════════════════════╗
   ║  CPAF v6 - export.js                                                        ║
   ║  Export Functions: JSON, CSV, Reports, Event Log                            ║
   ╠════════════════════════════════════════════════════════════════════════════╣
   ║  SECTION MAP:                                                               ║
   ║  Line 1-30:      File header                                                ║
   ║  Line 31-100:    CONFIG_EXPORT                                              ║
   ║  Line 101-200:   CSV_EXPORT                                                 ║
   ║  Line 201-350:   REPORT_GENERATION                                          ║
   ║  Line 351-450:   EVENT_LOG_EXPORT                                           ║
   ╚════════════════════════════════════════════════════════════════════════════╝ */

const Export = (function() {
  'use strict';

  // ========== SECTION: UTILITIES ==========
  function downloadFile(content, filename, mimeType) {
    // CSV: prepend a UTF-8 BOM so Excel decodes special characters (₹, →) correctly instead of as mojibake
    if (mimeType === 'text/csv' && typeof content === 'string' && content.charCodeAt(0) !== 0xFEFF) {
      content = '\uFEFF' + content;
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function getTimestamp() {
    return new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  }
  // rollover-correct "Xy Ym" from a month count (fixes the "17y 12m" glitch)
  function fmtMonths(m) {
    if (m == null || isNaN(m)) return '—';
    const y = Math.floor(m / 12), mo = m % 12;
    return `${y} year${y === 1 ? '' : 's'}, ${mo} month${mo === 1 ? '' : 's'}`;
  }
  // the REAL time the current run first reached GROWTH (observer); null if it never escaped
  function escapeMonths(S) { return (S && S.firstGrowthMonth != null) ? S.firstGrowthMonth : null; }
  function runMonths(S) { return (S && S.totalMonths != null) ? S.totalMonths : ((S.year || 0) * 12 + (S.month || 0)); }
  // ========== END: UTILITIES ==========

  // ========== SECTION: CONFIG_EXPORT ==========
  function exportConfig() {
    const S = Simulation.getState();
    
    const config = {
      version: 'CPAF v6',
      exportDate: new Date().toISOString(),
      
      // Current state
      currentCaseStudy: S.caseStudy,
      activePolicies: Array.from(S.activePolicies),
      
      // Custom data
      customPolicies: Admin.getCustomPolicies(),
      customCaseStudies: Admin.getCustomCaseStudies(),
      
      // Calibration
      thresholds: { ...Config.THRESHOLDS },
      loops: Object.fromEntries(
        Object.entries(Config.LOOPS).map(([id, loop]) => [id, {
          enabled: loop.enabled,
          strength: loop.strength
        }])
      ),
      equationParams: JSON.parse(JSON.stringify(Config.EQUATION_PARAMS)),
      
      // FIX #14: Include full CALIBRATION (delays, gender, interactions, etc.)
      calibration: JSON.parse(JSON.stringify(Simulation.getCalibration()))
    };

    const json = JSON.stringify(config, null, 2);
    // FIX N8: Log before download (was removed to fix self-reference, now placed correctly)
    Simulation.logEvent('EXPORT', 'Configuration exported');
    downloadFile(json, `cpaf_config_${getTimestamp()}.json`, 'application/json');
  }
  // ========== END: CONFIG_EXPORT ==========

  // ========== SECTION: CSV_EXPORT ==========
  function exportCSV() {
    const S = Simulation.getState();
    const history = S.history;
    
    if (!history || history.income.length === 0) {
      alert('No simulation data to export. Run the simulation first.');
      return;
    }

    // Build CSV header
    // FIX #13: Added Heritage, Middlemen, Female_Income, Male_Income
    const headers = [
      'Month',
      'Avg_Income',
      'Seg_A_Income',
      'Seg_B_Income', 
      'Seg_C_Income',
      'Skills',
      'Market',
      'Coordination',
      'Political',
      'Population',
      'Gini',
      'Heritage',
      'Middlemen',
      'Female_Income',
      'Male_Income',
      'R1_Activation',
      'R2_Activation',
      'Credit_Dependency',
      'Competition_Factor',
      'Network_Density'
    ];

    // Build rows
    const rows = history.income.map((_, i) => [
      i + 1,
      history.income[i]?.toFixed(0) || '',
      history.segA[i]?.toFixed(0) || '',
      history.segB[i]?.toFixed(0) || '',
      history.segC[i]?.toFixed(0) || '',
      history.skills[i]?.toFixed(3) || '',
      history.market[i]?.toFixed(3) || '',
      history.coordination[i]?.toFixed(3) || '',
      history.political[i]?.toFixed(3) || '',
      history.population[i]?.toFixed(0) || '',
      history.gini[i]?.toFixed(3) || '',
      history.heritage[i]?.toFixed(3) || '',
      history.middlemen[i]?.toFixed(3) || '',
      history.femaleIncome[i]?.toFixed(0) || '',
      history.maleIncome[i]?.toFixed(0) || '',
      history.r1Activation?.[i]?.toFixed(3) || '',
      history.r2Activation?.[i]?.toFixed(3) || '',
      history.creditDependency?.[i]?.toFixed(3) || '',
      history.competitionFactor?.[i]?.toFixed(3) || '',
      history.networkDensity?.[i]?.toFixed(0) || ''
    ]);

    // Combine
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    Simulation.logEvent('EXPORT', `Data exported: ${rows.length} rows`);
    downloadFile(csv, `cpaf_data_${S.caseStudy}_${getTimestamp()}.csv`, 'text/csv');
  }
  // ========== END: CSV_EXPORT ==========

  // ========== SECTION: EVENT_LOG_EXPORT ==========
  function exportEventLog() {
    const log = Simulation.getEventLog();
    
    if (log.length === 0) {
      alert('No events to export');
      return;
    }

    const headers = ['Year', 'Month', 'Type', 'Message', 'Timestamp'];
    const rows = log.map(e => [
      e.year,
      e.month,
      e.type,
      `"${e.message.replace(/"/g, '""')}"`,
      new Date(e.timestamp).toISOString()
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    Simulation.logEvent('EXPORT', `Event log exported: ${log.length} events`);
    downloadFile(csv, `cpaf_events_${getTimestamp()}.csv`, 'text/csv');
  }

  function exportEventLogText() {
    const log = Simulation.getEventLog();
    
    const text = log.map(e => 
      `[Y${e.year} M${e.month}] [${e.type}] ${e.message}`
    ).join('\n');
    
    downloadFile(text, `cpaf_events_${getTimestamp()}.txt`, 'text/plain');
  }
  // ========== END: EVENT_LOG_EXPORT ==========

  // ========== SECTION: REPORT_GENERATION ==========
  function generateReport() {
    const S = Simulation.getState();
    const cs = Config.getCaseStudy(S.caseStudy);
    const log = Simulation.getEventLog();
    
    // Get options
    const includeSummary = document.getElementById('rep_summary')?.checked ?? true;
    const includeConfig = document.getElementById('rep_config')?.checked ?? true;
    const includeCharts = document.getElementById('rep_charts')?.checked ?? true;
    const includePolicies = document.getElementById('rep_policies')?.checked ?? true;
    const includeLog = document.getElementById('rep_log')?.checked ?? true;

    // Calculate summary statistics
    const gini = Simulation.calculateGini();
    const incomeChange = cs ? ((S.income - cs.initial.income) / cs.initial.income * 100).toFixed(1) : 0;
    const coordChange = cs ? ((S.coordination - cs.initial.coordination) * 100).toFixed(1) : 0;
    // reconciling replicated median (N=24) so the single-run headline is read against the settled figure
    const _PEa = (typeof PolicyExplorer !== 'undefined') ? PolicyExplorer.analysis : null;
    let _repOutcome = null; try { if (_PEa) _repOutcome = _PEa.escapeStats(S.activePolicies instanceof Set ? Array.from(S.activePolicies) : S.activePolicies, S.caseStudy, 24); } catch(e) {}
    const repMedian = (_repOutcome && _repOutcome.medianFinal != null) ? Math.round(_repOutcome.medianFinal) : null;

    // Build HTML report
    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>CPAF Simulation Report - ${cs?.name || 'Unknown'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; padding: 40px; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 24pt; color: #1e40af; margin-bottom: 5px; }
    h2 { font-size: 16pt; color: #1e40af; margin-top: 30px; margin-bottom: 15px; padding-bottom: 5px; border-bottom: 2px solid #e2e8f0; }
    h3 { font-size: 12pt; color: #475569; margin-top: 20px; margin-bottom: 10px; }
    .header-sub { color: #64748b; font-size: 10pt; margin-bottom: 20px; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
    .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; }
    .summary-value { font-size: 24pt; font-weight: 700; color: #1e40af; }
    .summary-value.trap { color: #dc2626; }
    .summary-value.transition { color: #f59e0b; }
    .summary-value.growth { color: #16a34a; }
    .summary-label { font-size: 9pt; color: #64748b; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 10pt; }
    th, td { padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left; }
    th { background: #f8fafc; font-weight: 600; }
    .positive { color: #16a34a; }
    .negative { color: #dc2626; }
    .log-entry { font-family: monospace; font-size: 9pt; padding: 3px 0; border-bottom: 1px solid #f1f5f9; }
    .log-time { color: #64748b; }
    .log-type { font-weight: 600; margin: 0 5px; }
    .log-type.STATE { color: #d97706; }
    .log-type.POLICY { color: #2563eb; }
    .log-type.SHOCK { color: #dc2626; }
    .log-type.COUPLING { color: #7c3aed; }
    .log-type.COMPLEXITY { color: #059669; }
    .log-type.NPF { color: #d97706; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 9pt; color: #64748b; text-align: center; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>CPAF Simulation Report</h1>
  <div class="header-sub">
    Case Study: ${cs?.name || 'Unknown'} (${cs?.location?.district || ''}, ${cs?.location?.state || ''})<br>
    Generated: ${new Date().toLocaleString()}<br>
    Simulation Duration: ${fmtMonths(runMonths(S))}${escapeMonths(S) != null ? `<br>\n    Escape to GROWTH reached at: ${fmtMonths(escapeMonths(S))}` : ''}
  </div>
`;

    // Methods (always included) — #14
    html += `
  <h2>Methods</h2>
  <p>CPAF couples seven analytical dimensions at runtime — a coordination network (D1), an attractor/state model (D2), a narrative-policy layer (D3), the system-dynamics core (D4), spatial reach (D5), an agent/segment model (D6) and Monte-Carlo uncertainty (D7) — over a complexity layer of cross-dimensional tensions and reinforcing/balancing feedback loops. A run steps the coupled stocks month by month under the selected policies; income, coordination, market access, middlemen control, heritage and population co-evolve, and the case is classified TRAP / TRANSITION / GROWTH by sustained income thresholds. <b>This is a structured-reasoning instrument, not a calibrated forecaster.</b></p>
`;

    // Executive Summary
    if (includeSummary) {
      html += `
  <h2>Result — one simulation run</h2>\n  <p style="color:#64748b;font-size:10pt;margin-bottom:10px">A single stochastic realisation of the configuration below. Because the engine carries ±2% monthly noise, re-running gives a different trajectory — see <b>Reproducibility</b>.</p>
  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-value ${S.attractorState.toLowerCase()}">${S.attractorState}</div>
      <div class="summary-label">System State</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">₹${Math.round(S.income).toLocaleString()}</div>
      <div class="summary-label">Income — this run${repMedian != null ? `; median ₹${repMedian.toLocaleString()} (N=24)` : ''}</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${gini.toFixed(2)}</div>
      <div class="summary-label">Gini Coefficient</div>
    </div>
    <div class="summary-card">
      <div class="summary-value ${parseFloat(incomeChange) > 0 ? 'positive' : 'negative'}">${incomeChange}%</div>
      <div class="summary-label">Income Change</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${S.coordination.toFixed(2)}</div>
      <div class="summary-label">Coordination Index</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${S.activePolicies instanceof Set ? S.activePolicies.size : (Array.isArray(S.activePolicies) ? S.activePolicies.length : 0)}</div>
      <div class="summary-label">Active Policies</div>
    </div>
  </div>
  
  <h3>Key Findings</h3>
  <ul>
    <li>System ${S.attractorState === 'TRAP' ? 'remains in poverty trap' : S.attractorState === 'GROWTH' ? (escapeMonths(S) != null ? `reached the GROWTH regime at ${fmtMonths(escapeMonths(S))}` : 'is in the GROWTH regime') : 'is in transition'}</li>
    <li>Income ${parseFloat(incomeChange) > 0 ? 'increased' : 'decreased'} by ${Math.abs(parseFloat(incomeChange))}% from baseline</li>
    <li>Coordination ${parseFloat(coordChange) > 0 ? 'improved' : 'declined'} by ${Math.abs(parseFloat(coordChange))} percentage points</li>
    <li>Inequality (Gini): ${gini < 0.35 ? 'Low' : gini < 0.45 ? 'Moderate' : 'High'} (${gini.toFixed(2)})</li>
  </ul>
`;
    }

    // Configuration
    if (includeConfig) {
      html += `
  <h2>Model Configuration</h2>
  
  <h3>Case Study: ${cs?.name || 'Unknown'}</h3>
  <table>
    <tr><th>Parameter</th><th>Initial Value</th><th>Current Value</th><th>Change</th></tr>
    <tr>
      <td>Population</td>
      <td>${cs?.initial?.population?.toLocaleString() || 'N/A'}</td>
      <td>${Math.round(S.population).toLocaleString()}</td>
      <td class="${S.population > (cs?.initial?.population || 0) ? 'positive' : 'negative'}">${cs ? ((S.population - cs.initial.population) / cs.initial.population * 100).toFixed(1) : 0}%</td>
    </tr>
    <tr>
      <td>Average Income</td>
      <td>₹${cs?.initial?.income?.toLocaleString() || 'N/A'}</td>
      <td>₹${Math.round(S.income).toLocaleString()}</td>
      <td class="${parseFloat(incomeChange) > 0 ? 'positive' : 'negative'}">${incomeChange}%</td>
    </tr>
    <tr>
      <td>Skills Index</td>
      <td>${cs?.initial?.skills?.toFixed(2) || 'N/A'}</td>
      <td>${S.skills.toFixed(2)}</td>
      <td class="${S.skills > (cs?.initial?.skills || 0) ? 'positive' : 'negative'}">${cs ? ((S.skills - cs.initial.skills) * 100).toFixed(1) : 0}%</td>
    </tr>
    <tr>
      <td>Market Access</td>
      <td>${cs?.initial?.market?.toFixed(2) || 'N/A'}</td>
      <td>${S.market.toFixed(2)}</td>
      <td class="${S.market > (cs?.initial?.market || 0) ? 'positive' : 'negative'}">${cs ? ((S.market - cs.initial.market) * 100).toFixed(1) : 0}%</td>
    </tr>
    <tr>
      <td>Middlemen Control</td>
      <td>${cs?.initial?.middlemen?.toFixed(2) || 'N/A'}</td>
      <td>${S.middlemen.toFixed(2)}</td>
      <td class="${S.middlemen < (cs?.initial?.middlemen || 0) ? 'positive' : 'negative'}">${cs ? ((S.middlemen - cs.initial.middlemen) * 100).toFixed(1) : 0}%</td>
    </tr>
    <tr>
      <td>Coordination</td>
      <td>${cs?.initial?.coordination?.toFixed(2) || 'N/A'}</td>
      <td>${S.coordination.toFixed(2)}</td>
      <td class="${S.coordination > (cs?.initial?.coordination || 0) ? 'positive' : 'negative'}">${coordChange}%</td>
    </tr>
    <tr>
      <td>Heritage</td>
      <td>${cs?.initial?.heritage?.toFixed(2) || 'N/A'}</td>
      <td>${S.heritage.toFixed(2)}</td>
      <td class="${S.heritage > (cs?.initial?.heritage || 0) ? 'positive' : 'negative'}">${cs ? ((S.heritage - cs.initial.heritage) * 100).toFixed(1) : 0}%</td>
    </tr>
    <tr>
      <td>Political Orientation</td>
      <td>${cs?.initial?.political?.toFixed(2) || 'N/A'}</td>
      <td>${S.political.toFixed(2)}</td>
      <td class="${Math.abs(S.political - 0.5) < Math.abs((cs?.initial?.political || 0.5) - 0.5) ? 'positive' : ''}">${cs ? ((S.political - cs.initial.political) * 100).toFixed(1) : 0}%</td>
    </tr>
    <tr>
      <td>Wage Gap (F/M)</td>
      <td>${(Simulation.getCalibration().gender?.wageGap || 0.75).toFixed(2)}</td>
      <td>${S.gender?.wageGapRatio?.toFixed(2) || 'N/A'}</td>
      <td>${S.gender?.wageGapRatio ? ((S.gender.wageGapRatio - (Simulation.getCalibration().gender?.wageGap || 0.75)) * 100).toFixed(1) + '%' : '—'}</td>
    </tr>
  </table>
  
  <h3>Thresholds</h3>
  <table>
    <tr><th>Threshold</th><th>Value</th></tr>
    <tr><td>TRAP (poverty line)</td><td>₹${S.thresholds.TRAP.toLocaleString()}/month</td></tr>
    <tr><td>GROWTH (prosperity)</td><td>₹${S.thresholds.GROWTH.toLocaleString()}/month</td></tr>
    <tr><td>State confirmation</td><td>${Config.THRESHOLDS.TRAP_DURATION} months</td></tr>
  </table>
`;
    }

    // Active Policies
    const activePoliciesCount = S.activePolicies instanceof Set ? S.activePolicies.size : 
                                (Array.isArray(S.activePolicies) ? S.activePolicies.length : 0);
    const activePoliciesArray = S.activePolicies instanceof Set ? Array.from(S.activePolicies) :
                                (Array.isArray(S.activePolicies) ? S.activePolicies : []);
    
    if (includePolicies && activePoliciesCount > 0) {
      html += `
  <h2>Active Policies (${activePoliciesCount})</h2>
  <table>
    <tr><th>Policy</th><th>Ministry</th><th>Type</th><th>Coverage</th><th>Key Effects</th></tr>
`;
      activePoliciesArray.forEach(policyId => {
        const policy = Config.getPolicy(policyId);
        if (policy) {
          const effects = Object.entries(policy.effects)
            .filter(([k, v]) => v !== 0)
            .map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`)
            .join(', ');
          
          html += `
    <tr>
      <td>${policy.name}</td>
      <td>${policy.ministry}</td>
      <td>${policy.type}</td>
      <td>${(policy.coverage * 100).toFixed(0)}%</td>
      <td>${effects}</td>
    </tr>
`;
        }
      });
      html += `</table>`;
    } else if (includePolicies) {
      html += `
  <h2>Active Policies</h2>
  <p><em>No policies were active during this simulation.</em></p>
`;
    }

    // Complexity Layer Status
    const CX = Config.COMPLEXITY;
    if (CX && CX.enabled) {
      html += `
  <h2>Complexity Layer (Active)</h2>
  
  <h3>Reinforcing Loop Activation</h3>
  <table>
    <tr><th>Loop</th><th>Activation</th><th>Binding Constraint</th></tr>
    <tr>
      <td>R1 (Skill→Income)</td>
      <td>${(S._R1_activation * 100).toFixed(0)}%</td>
      <td>${S._R1_activation < 0.6 ? (S.middlemen > 0.5 ? 'Middlemen capturing premium' : S.income < S.thresholds.TRAP * 0.65 ? 'Subsistence poverty' : 'Low skills') : 'Unconstrained'}</td>
    </tr>
    <tr>
      <td>R2 (Market→Income)</td>
      <td>${(S._R2_activation * 100).toFixed(0)}%</td>
      <td>${S._R2_activation < 0.6 ? (S.market < 0.3 ? 'No direct market channels' : S.infrastructure?.digital < 0.3 ? 'Low digital infrastructure' : 'Demand saturation') : 'Unconstrained'}</td>
    </tr>
  </table>
  
  <h3>TRAP Mechanisms</h3>
  <table>
    <tr><th>Mechanism</th><th>Status</th><th>Value</th></tr>
    <tr>
      <td>Credit dependency</td>
      <td>${S._creditDependency > 0.3 ? '<span class="negative">Active</span>' : S._creditDependency > 0 ? 'Mild' : 'Inactive'}</td>
      <td>${(S._creditDependency * 100).toFixed(0)}%</td>
    </tr>
    <tr>
      <td>Cumulative departures (brain drain)</td>
      <td>${S.craftExits > 0 ? '<span class="negative">' + Math.round(S.craftExits) + ' artisans</span>' : 'None'}</td>
      <td>${S.craftExits > 0 ? (S.craftExits < S.population ? ((S.craftExits / S.population) * 100).toFixed(1) + '% of current workforce' : 'exceeds current workforce (cumulative turnover)') : '—'}</td>
    </tr>
    <tr>
      <td>Network density</td>
      <td>${S.networkDensity > (CX.graphTheory?.rigidityThreshold || 6) ? '<span class="negative">Rigid</span>' : 'Flexible'}</td>
      <td>${S.networkDensity || 0} couplings</td>
    </tr>
  </table>
  
  <h3>Active Tensions</h3>
  <table>
    <tr><th>Tension</th><th>Status</th><th>Effect</th></tr>
    <tr><td>T1: Market ↔ Heritage</td><td>${S.market > (CX.tensions.marketHeritage.marketThreshold || 0.4) ? '<span class="negative">Active</span>' : 'Dormant'}</td><td>Heritage erosion / Market brake</td></tr>
    <tr><td>T2: Income ↔ Middlemen</td><td>${S.middlemen < 0.7 ? 'Active' : 'Dormant'}</td><td>Middlemen counter-adaptation</td></tr>
    <tr><td>T3: Coordination friction</td><td>${activePoliciesCount > 2 ? '<span class="negative">Active (' + activePoliciesCount + ' policies)</span>' : 'Dormant'}</td><td>Quadratic institutional friction</td></tr>
    <tr><td>T4: Skills → Brain drain</td><td>${S.skills > (CX.tensions.brainDrain.skillThreshold || 0.6) ? 'Active' : 'Dormant'}</td><td>Artisan exit to factories</td></tr>
    <tr><td>T5: Political cycles</td><td>Always active</td><td>±${((CX.tensions.politicalCycles.attentionAmplitude || 0.18) * 100).toFixed(0)}% policy modulation</td></tr>
    <tr><td>T6: Population competition</td><td>Always active</td><td>Competition factor: ${(S.competitionFactor || 1).toFixed(2)}</td></tr>
    <tr><td>T7: Inequality → Coordination</td><td>${S.segments?.C?.income / Math.max(1, S.segments?.A?.income) > (CX.tensions.inequalityCoordination.ratioThreshold || 1.6) ? '<span class="negative">Active</span>' : 'Dormant'}</td><td>Coordination penalty</td></tr>
  </table>

  ${Object.keys(S._prereqModifiers || {}).length > 0 ? `
  <h3>Policy Prerequisites</h3>
  <table>
    <tr><th>Policy</th><th>Prerequisite Modifier</th><th>Effect</th></tr>
    ${Object.entries(S._prereqModifiers).map(([id, mod]) => `
    <tr>
      <td>${Config.getPolicy(id)?.name || id}</td>
      <td>${mod > 1 ? '<span class="positive">+' + ((mod-1)*100).toFixed(0) + '%</span>' : mod < 1 ? '<span class="negative">' + ((mod-1)*100).toFixed(0) + '%</span>' : '—'}</td>
      <td>${mod > 1 ? 'Prerequisites met → boosted' : mod < 1 ? 'Missing prerequisites → penalized' : 'No prerequisites'}</td>
    </tr>`).join('')}
  </table>` : ''}
`;
    }

    // Active Shocks
    if (S.activeShocks && S.activeShocks.length > 0) {
      html += `
  <h2>Active Shocks</h2>
  <table>
    <tr><th>Shock</th><th>Remaining Duration</th><th>Effects</th></tr>
`;
      S.activeShocks.forEach(shock => {
        const effects = Object.entries(shock.effects || {})
          .filter(([k, v]) => v !== 0)
          .map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`)
          .join(', ');
        html += `
    <tr>
      <td>${shock.name || shock.id}</td>
      <td>${shock.remainingMonths} months</td>
      <td>${effects}</td>
    </tr>
`;
      });
      html += `</table>`;
    }

    // Segment Distribution — FIX #15: Removed spatial column (segments ≠ zones)
    html += `
  <h2>Segment Distribution (D6)</h2>
  <table>
    <tr><th>Segment</th><th>Share</th><th>Income</th><th>Female Share</th></tr>
    <tr>
      <td>A (Subsistence)</td>
      <td>${(S.segments.A.share * 100).toFixed(1)}%</td>
      <td>₹${Math.round(S.segments.A.income).toLocaleString()}</td>
      <td>${(S.segments.A.femaleShare * 100).toFixed(0)}%</td>
    </tr>
    <tr>
      <td>B (Traditional)</td>
      <td>${(S.segments.B.share * 100).toFixed(1)}%</td>
      <td>₹${Math.round(S.segments.B.income).toLocaleString()}</td>
      <td>${(S.segments.B.femaleShare * 100).toFixed(0)}%</td>
    </tr>
    <tr>
      <td>C (Market-Ready)</td>
      <td>${(S.segments.C.share * 100).toFixed(1)}%</td>
      <td>₹${Math.round(S.segments.C.income).toLocaleString()}</td>
      <td>${(S.segments.C.femaleShare * 100).toFixed(0)}%</td>
    </tr>
  </table>

  <h3>Spatial Multipliers (D5)</h3>
  <table>
    <tr><th>Zone</th><th>Multiplier</th></tr>
    <tr><td>Urban</td><td>${S.spatial.urban?.toFixed(2) || '1.00'}</td></tr>
    <tr><td>Peri-urban</td><td>${S.spatial.peri_urban?.toFixed(2) || '0.70'}</td></tr>
    <tr><td>Rural</td><td>${S.spatial.rural?.toFixed(2) || '0.40'}</td></tr>
  </table>
`;

    // FIX #32: Chart images in report
    if (includeCharts && typeof Charts !== 'undefined') {
      html += `<h2>Charts & Visualizations</h2>`;
      const chartIds = ['income', 'dimensions', 'popgini', 'middlemen', 'heritage', 'abm'];
      const chartTitles = {
        income: 'Income Trajectories by Segment',
        dimensions: 'System Dimensions (D1-D3)',
        popgini: 'Population & Inequality',
        middlemen: 'Middlemen & Market Access',
        heritage: 'Heritage & Gender Income',
        abm: 'ABM Segment Positions'
      };
      chartIds.forEach(id => {
        try {
          const img = Charts.exportChartAsImage(id);
          if (img) {
            html += `
      <div style="margin: 15px 0; text-align: center;">
        <h3>${chartTitles[id] || id}</h3>
        <img src="${img}" style="max-width: 100%; border: 1px solid #e2e8f0; border-radius: 4px;" alt="${chartTitles[id]}">
      </div>`;
          }
        } catch(e) { /* Chart not available */ }
      });
    }

    // Event Log
    if (includeLog && log.length > 0) {
      const significantEvents = log.filter(e => 
        ['STATE', 'POLICY', 'SHOCK', 'COUPLING', 'COMPLEXITY', 'NPF'].includes(e.type)
      ).slice(-50);  // Last 50 significant events (was 30)
      
      html += `
  <h2>Event Log (Key Events)</h2>
  <div style="max-height: 400px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px;">
`;
      significantEvents.forEach(e => {
        html += `
    <div class="log-entry">
      <span class="log-time">[Y${e.year} M${e.month}]</span>
      <span class="log-type ${e.type}">${e.type}</span>
      <span>${e.message}</span>
    </div>
`;
      });
      html += `</div>`;
    }

    // ===== Rigour elements + appendix (#14) =====
    const TH = Config.THRESHOLDS || {};
    const EP = Config.EQUATION_PARAMS || {};
    let appendixRows = '';
    Object.keys(EP).forEach(dim => {
      const ps = EP[dim]; const keys = Object.keys(ps);
      keys.forEach((k, i) => { appendixRows += `<tr><td>${i===0?('<b>'+dim+'</b>'):''}</td><td>${k}</td><td>${ps[k].value}</td></tr>`; });
    });
    const actIds = (S.activePolicies instanceof Set ? [...S.activePolicies] : (Array.isArray(S.activePolicies) ? S.activePolicies : []));
    const polNames = actIds.length ? actIds.map(id => { const p = Config.getPolicy(id); return p ? p.name : id; }).join('; ') : 'none';
    html += `
  <h2>Reproducibility &amp; run identity</h2>
  <p><b>This report describes one stochastic realisation.</b> The engine carries \u00b12% monthly income noise and occasional random shocks, so re-running the same configuration produces a different trajectory. Single-run figures are draws, not point predictions — for stable estimates use the Monte-Carlo mode (many runs), which reports an escape-reliability percentage and a range rather than a single number.</p>
  <table>
    <tr><th>Run identity</th><th>Value</th></tr>
    <tr><td>Case</td><td>${cs?.name || S.caseStudy}</td></tr>
    <tr><td>Active policies</td><td>${polNames}</td></tr>
    <tr><td>Duration simulated</td><td>${fmtMonths(runMonths(S))}</td></tr>
    <tr><td>Generated</td><td>${new Date().toLocaleString()}</td></tr>
    <tr><td>Determinism</td><td>Stochastic (unseeded) — one realisation; use Monte Carlo for stable estimates</td></tr>
  </table>

  <h2>Provenance &amp; assumptions</h2>
  <p>Figures describe one run and are specific to the case shown. This is a research instrument, not a calibrated forecaster: of its parameters, about <b>3% are empirical, 9% mechanism-grounded, 27% literature-grounded, and 61% are declared modelling assumptions</b> — plausible values and theory-based equation forms, not invented data. Built with AI assistance under citation discipline; the framework, theoretical choices, and judgement are the author&rsquo;s, and responsibility rests with the author.</p>

  <h2>Validation summary</h2>
  <p>The structure is validated live against the Barlas (1996) three-stage system-dynamics standard: <b>Stage 1</b> — direct structure (6 tests: accounting closure, bounds, correct signs); <b>Stage 2</b> — structure-oriented behaviour (9 tests: bistability, ordered regime change, hysteresis, stability, parameter robustness); <b>Stage 3</b> — behaviour-pattern demonstration on the handicrafts sector (6 tests). Stages 1&ndash;2 run across three regimes, so a pass is a property of the structure, not of one case.</p>
  <p style="color:#64748b;font-size:10pt"><b>Scope.</b> Tests requiring empirical time-series, statistical fit to historical data, or forecast accuracy are deliberately excluded — the model is a structured-reasoning tool with illustrative effect sizes, not an empirically-calibrated forecaster. What is validated is the soundness and transferability of the structure and its qualitative reproduction of a real sector&rsquo;s patterns — not numerical prediction. Run the in-app validation panel for the live pass/fail. References: Barlas (1996); Forrester &amp; Senge (1980); Sargent (2013); Saltelli et al. (2004); Scheffer (2009).</p>

  <h2>Limitations</h2>
  <ul>
    <li>Most parameters (~61%) are declared modelling assumptions; effect sizes are plausible and theory-based, not empirically calibrated.</li>
    <li>Every run is stochastic — a single trajectory is one draw; read escape as a Monte-Carlo reliability %, not a yes/no.</li>
    <li>Two demonstration cases (Chikankari, Cheriyal); the framework is transferable but not a general forecaster.</li>
    <li>Not fitted to historical time-series; the model validates structure and pattern, not numerical outcomes.</li>
    <li>Under stacked policies, coordination is pinned near its floor by institutional friction — a structural finding of the model, and why friction edits move outcomes little mid-run.</li>
  </ul>

  <h2>Appendix — equation parameters (live)</h2>
  <table>
    <tr><th>Dimension</th><th>Parameter</th><th>Value</th></tr>
    ${appendixRows}
  </table>
  <p style="color:#64748b;font-size:9pt">Thresholds: TRAP \u20b9${(TH.TRAP||2000).toLocaleString()} sustained ${TH.TRAP_DURATION||6}mo \u00b7 GROWTH \u20b9${(TH.GROWTH||4122).toLocaleString()} sustained ${TH.GROWTH_DURATION||12}mo. Parameters are live (reflect any admin edits).</p>
`;

    // Footer
    html += `
  <div class="footer">
    Generated by CPAF v6 — Complexity-Based Policy Analysis Framework<br>
    Abboudi, B. (${new Date().getFullYear()}) • Jindal School of Government and Public Policy
  </div>
</body>
</html>
`;

    // Download as HTML
    Simulation.logEvent('EXPORT', 'Report generated');
    downloadFile(html, `cpaf_report_${S.caseStudy}_${getTimestamp()}.html`, 'text/html');
  }
  // ========== END: REPORT_GENERATION ==========

  // ========== SECTION: RECOMMENDATIONS ENGINE ==========
  function generateRecommendations(S) {
    const recs = [];
    const activePolicies = Array.from(S.activePolicies);
    // FIX #41: Use configurable thresholds instead of hardcoded values
    const coordLow = Config.THRESHOLDS.COORD_LOW || 0.3;
    const coordMed = Config.THRESHOLDS.COORD_MED || 0.5;
    const giniHigh = Config.THRESHOLDS.GINI_HIGH || 0.45;
    const politicalLow = Config.THRESHOLDS.POLITICAL_LOW || 0.3;
    
    // Coordination-based recommendations
    if (S.coordination < coordLow) {
      recs.push({
        priority: 'HIGH',
        category: 'Coordination',
        action: 'Establish inter-ministerial coordination mechanism',
        rationale: `Current coordination (${S.coordination.toFixed(2)}) reduces policy effectiveness by ${((1 - (0.3 + 0.7*S.coordination))*100).toFixed(0)}%`
      });
    } else if (S.coordination < coordMed) {
      recs.push({
        priority: 'MEDIUM',
        category: 'Coordination',
        action: 'Strengthen policy coordination before adding new interventions',
        rationale: `Coordination at ${S.coordination.toFixed(2)} limits policy synergies`
      });
    }
    
    // State-based recommendations
    if (S.attractorState === 'TRAP' && activePolicies.length < 3) {
      recs.push({
        priority: 'HIGH',
        category: 'Policy Portfolio',
        action: 'Implement integrated policy package (minimum 3 complementary policies)',
        rationale: 'Single policies rarely sufficient for escaping poverty trap'
      });
    }
    
    if (S.attractorState === 'TRANSITION') {
      recs.push({
        priority: 'MEDIUM',
        category: 'Sustainability',
        action: 'Maintain current policy mix to consolidate transition',
        rationale: 'System is vulnerable to reverting to TRAP state'
      });
    }
    
    // Synergy opportunities
    if (activePolicies.includes('SFURTI') && !activePolicies.includes('ODOP')) {
      recs.push({
        priority: 'MEDIUM',
        category: 'Synergy',
        action: 'Consider adding ODOP for synergy with SFURTI',
        rationale: 'SFURTI+ODOP combination provides +25% effectiveness boost'
      });
    }
    
    if (activePolicies.includes('ODOP') && !activePolicies.includes('SFURTI')) {
      recs.push({
        priority: 'MEDIUM',
        category: 'Synergy',
        action: 'Consider adding SFURTI for synergy with ODOP',
        rationale: 'SFURTI+ODOP combination provides +25% effectiveness boost'
      });
    }
    
    if (activePolicies.includes('ECOMMERCE') && !activePolicies.includes('GI_REGISTRATION')) {
      recs.push({
        priority: 'HIGH',
        category: 'Heritage Protection',
        action: 'Add GI Registration before expanding e-commerce',
        rationale: 'Market expansion without GI protection risks heritage dilution'
      });
    }
    
    // Risk warnings
    if (S.market > 0.6 && S.skills < 0.5) {
      recs.push({
        priority: 'WARNING',
        category: 'Heritage Risk',
        action: 'Invest in skill development before further market expansion',
        rationale: 'B3 loop active: Mass production pressure eroding traditional skills'
      });
    }
    
    if (S.attractorState === 'TRAP' && S.middlemen > 0.7) {
      recs.push({
        priority: 'WARNING',
        category: 'Value Chain',
        action: 'Address middlemen dominance through direct market linkages',
        rationale: 'B1 loop active: Middlemen extracting increasing surplus'
      });
    }
    
    // Income-based recommendations
    if (S.income < S.thresholds.TRAP) {
      const gap = S.thresholds.TRAP - S.income;
      recs.push({
        priority: 'HIGH',
        category: 'Income Support',
        action: 'Add direct income support (PM Vishwakarma, PMEGP)',
        rationale: `Income ₹${Math.round(gap).toLocaleString()} below trap exit threshold`
      });
    }
    
    // STEP 3: Prerequisite-aware recommendations
    // SFURTI is the foundation — recommend it first if not active
    if (activePolicies.length > 0 && !activePolicies.includes('SFURTI') && !activePolicies.includes('CLUSTER_DEV')) {
      const penalizedPolicies = ['USTTAD', 'GURU_SHISHYA', 'GI_REGISTRATION', 'ODOP']
        .filter(id => activePolicies.includes(id));
      if (penalizedPolicies.length > 0) {
        recs.push({
          priority: 'HIGH',
          category: 'Policy Sequencing',
          action: 'Add SFURTI cluster infrastructure as foundation',
          rationale: `${penalizedPolicies.join(', ')} operating at reduced effectiveness without cluster support (prerequisite penalty)`
        });
      }
    }
    
    // Warn if e-commerce without GI/skills
    if (activePolicies.includes('ECOMMERCE') && !activePolicies.includes('GI_REGISTRATION') && !activePolicies.includes('USTTAD')) {
      recs.push({
        priority: 'HIGH',
        category: 'Policy Sequencing',
        action: 'Establish GI Registration and skills training before e-commerce expansion',
        rationale: 'E-commerce without brand identity (GI) and quality products (USTTAD) leads to undifferentiated competition — 40% effectiveness penalty'
      });
    }
    
    // Credit dependency warning
    if (S._creditDependency > 0.3) {
      recs.push({
        priority: 'HIGH',
        category: 'TRAP Escape',
        action: 'Break credit dependency through cooperative credit (SHGs) or PM Vishwakarma lending',
        rationale: `Credit lock-in at ${(S._creditDependency * 100).toFixed(0)}% — middlemen capturing income through debt cycles`
      });
    }
    
    // R-loop activation warnings
    if (S._R1_activation < 0.5 && S.middlemen > 0.6) {
      recs.push({
        priority: 'HIGH',
        category: 'Value Chain',
        action: 'Reduce middlemen control to unlock skill-income premium',
        rationale: `R1 loop at ${(S._R1_activation * 100).toFixed(0)}% — middlemen capturing ${((1 - S._R1_activation) * 100).toFixed(0)}% of artisan skill premium`
      });
    }
    
    if (S._R2_activation < 0.5 && S.infrastructure?.digital < 0.3) {
      recs.push({
        priority: 'MEDIUM',
        category: 'Infrastructure',
        action: 'Improve digital infrastructure to make market access operational',
        rationale: `R2 loop at ${(S._R2_activation * 100).toFixed(0)}% — market access is theoretical without digital connectivity`
      });
    }
    
    // Inequality-based recommendations
    const gini = Simulation.calculateGini();
    if (gini > giniHigh) {
      recs.push({
        priority: 'MEDIUM',
        category: 'Equity',
        action: 'Add targeted support for subsistence segment (Segment A)',
        rationale: `High inequality (Gini: ${gini.toFixed(2)}) may trigger political instability`
      });
    }
    
    // Political feasibility
    if (S.political < politicalLow && activePolicies.some(p => Config.getPolicy(p)?.type === 'market')) {
      recs.push({
        priority: 'WARNING',
        category: 'Political Feasibility',
        action: 'Balance market policies with welfare measures',
        rationale: 'Current political climate may resist pure market approach'
      });
    }
    
    return recs;
  }
  // ========== END: RECOMMENDATIONS ENGINE ==========

  // ========== SECTION: EXECUTIVE_BRIEF ==========
  function generateExecutiveBrief() {
    const S = Simulation.getState();
    const cs = Config.getCaseStudy(S.caseStudy);
    const recommendations = generateRecommendations(S);
    const gini = Simulation.calculateGini();
    
    // Calculate key metrics
    const incomeChange = cs ? ((S.income - cs.initial.income) / cs.initial.income * 100).toFixed(1) : 0;
    const coordChange = cs ? ((S.coordination - cs.initial.coordination) * 100).toFixed(1) : 0;
    
    // Get active policies details
    const activePoliciesArray = S.activePolicies instanceof Set ? Array.from(S.activePolicies) : S.activePolicies;
    const policyNames = activePoliciesArray.map(id => Config.getPolicy(id)?.name || id).join(', ');
    // #15: computed outcome via replicated escapeStats + one recommendation + key risk
    const PEa = (typeof PolicyExplorer !== 'undefined') ? PolicyExplorer.analysis : null;
    let outcome = null; try { if (PEa) outcome = PEa.escapeStats(activePoliciesArray, S.caseStudy, 24); } catch(e) {}
    const relPct = outcome ? outcome.prob : null;
    const medIncome = (outcome && outcome.medianFinal != null) ? Math.round(outcome.medianFinal) : null;
    // brief headline uses the replicated median (trustworthy) rather than the single mid-trajectory run
    const briefIncome = (medIncome != null) ? medIncome : Math.round(S.income);
    const briefChange = cs ? ((briefIncome - cs.initial.income) / cs.initial.income * 100).toFixed(1) : String(incomeChange);
    const escMed = (outcome && outcome.median != null) ? fmtMonths(outcome.median) : null;
    const escRange = (outcome && outcome.p10 != null && outcome.p90 != null && fmtMonths(outcome.p10) !== fmtMonths(outcome.p90)) ? (fmtMonths(outcome.p10) + '\u2013' + fmtMonths(outcome.p90)) : null;
    const _rank = { HIGH:0, MEDIUM:1, WARNING:2 };
    const topRecs = [...recommendations].sort((a,b)=>(_rank[a.priority]??9)-(_rank[b.priority]??9)).slice(0,4); // top-ranked, up to 4
    let keyRisk;
    if (relPct != null && relPct < 60) keyRisk = 'Escape is <b>unreliable</b> \u2014 this portfolio reaches the growth regime in only ' + relPct + '% of replicated runs. Treat any single run with caution; a stronger or better-sequenced portfolio is needed.';
    else if (S.coordination < 0.20) keyRisk = 'Coordination sits near its floor (' + S.coordination.toFixed(2) + '). As policies stack, institutional friction offsets added capacity \u2014 <b>delivery, not funding, is the binding constraint</b>.';
    else if ((S._creditDependency || 0) > 0.30) keyRisk = 'Credit dependency is high (' + Math.round((S._creditDependency||0)*100) + '%) \u2014 middlemen can re-capture income gains through debt, eroding the distributional benefit.';
    else keyRisk = 'Escape is reliable and the co-op is healthy (coordination ' + S.coordination.toFixed(2) + '). The forward risk is <b>sustaining the gains</b>: as the portfolio grows it is inter-ministry delivery coherence \u2014 not the co-op \u2014 that can erode, and middlemen may re-adapt. The challenge is maintenance over time, not initial impact.';
    
    // Determine scenario
    let scenarioName = 'Custom';
    if (activePoliciesArray.length === 0) scenarioName = 'No Policy (Baseline)';
    else if (activePoliciesArray.includes('SFURTI') && activePoliciesArray.includes('ODOP')) scenarioName = 'Integrated';
    else if (activePoliciesArray.some(id => Config.getPolicy(id)?.type === 'market')) scenarioName = 'Market-Focused';
    else if (activePoliciesArray.some(id => Config.getPolicy(id)?.type === 'welfare')) scenarioName = 'Welfare-Focused';
    
    // Monte Carlo results
    const mcResults = S.monteCarloResults;
    const escapeProb = mcResults ? (mcResults.stats.escapeProb * 100).toFixed(0) : 'Not run';
    const ci95 = mcResults ? `₹${Math.round(mcResults.stats.ci95_low).toLocaleString()} - ₹${Math.round(mcResults.stats.ci95_high).toLocaleString()}` : 'N/A';
    
    // FIX #3: Read synergies/conflicts/redundancies from CALIBRATION dynamically
    const synergies = [];
    const cal = Simulation.getCalibration();
    const policyInteractions = cal.policyInteractions || {};
    Object.entries(policyInteractions).forEach(([combo, data]) => {
      const [p1, p2] = combo.split('+');
      if (activePoliciesArray.includes(p1) && activePoliciesArray.includes(p2)) {
        const pctChange = Math.round((data.modifier - 1) * 100);
        const sign = pctChange >= 0 ? '+' : '';
        const label = data.type === 'synergy' ? '⚡ Synergy' : data.type === 'conflict' ? '⚠️ Conflict' : '🔄 Redundancy';
        synergies.push(`${label}: ${p1}+${p2} (${sign}${pctChange}%)`);
      }
    });
    
    // Build HTML
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>CPAF Executive Brief - ${cs?.name || 'Unknown'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #1e293b; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { border-bottom: 3px solid #1e40af; padding-bottom: 15px; margin-bottom: 25px; }
    h1 { font-size: 22pt; color: #1e40af; margin-bottom: 5px; }
    .subtitle { color: #64748b; font-size: 11pt; }
    .scenario-badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 4px; font-weight: 600; font-size: 10pt; margin-top: 10px; }
    
    .outcomes-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .outcomes-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 15px; }
    .outcome-item { text-align: center; }
    .outcome-value { font-size: 24pt; font-weight: 700; }
    .outcome-value.trap { color: #dc2626; }
    .outcome-value.transition { color: #f59e0b; }
    .outcome-value.growth { color: #16a34a; }
    .outcome-value.positive { color: #16a34a; }
    .outcome-value.negative { color: #dc2626; }
    .outcome-label { font-size: 9pt; color: #64748b; text-transform: uppercase; }
    
    .section { margin: 25px 0; }
    .section-title { font-size: 14pt; color: #1e40af; font-weight: 600; margin-bottom: 12px; padding-bottom: 5px; border-bottom: 1px solid #e2e8f0; }
    
    .policies-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .policy-tag { background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 4px; font-size: 10pt; }
    
    .synergy-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #dcfce7; border-radius: 4px; margin-bottom: 6px; font-size: 10pt; color: #166534; }
    
    .recommendations { margin: 25px 0; }
    .rec-item { padding: 12px 15px; border-radius: 6px; margin-bottom: 10px; }
    .rec-item.HIGH { background: #fee2e2; border-left: 4px solid #dc2626; }
    .rec-item.MEDIUM { background: #fef3c7; border-left: 4px solid #f59e0b; }
    .rec-item.WARNING { background: #fef9c3; border-left: 4px solid #eab308; }
    .rec-priority { font-size: 9pt; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
    .rec-item.HIGH .rec-priority { color: #dc2626; }
    .rec-item.MEDIUM .rec-priority { color: #b45309; }
    .rec-item.WARNING .rec-priority { color: #a16207; }
    .rec-action { font-weight: 600; margin-bottom: 4px; }
    .rec-rationale { font-size: 10pt; color: #64748b; }
    
    .confidence-box { background: #f0f9ff; border: 1px solid #7dd3fc; border-radius: 8px; padding: 15px; margin: 20px 0; }
    .confidence-title { font-weight: 600; color: #0369a1; margin-bottom: 8px; }
    .confidence-item { font-size: 10pt; margin-bottom: 4px; }
    
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 9pt; color: #94a3b8; text-align: center; }
    
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>CPAF Executive Brief</h1>
    <div class="subtitle">${cs?.name || 'Unknown'} | ${cs?.location?.district || ''}, ${cs?.location?.state || ''}</div>
    <div class="scenario-badge">📊 ${scenarioName} Scenario</div>
  </div>
  
  <div class="outcomes-box">
    <div class="outcomes-grid">
      <div class="outcome-item">
        <div class="outcome-value ${S.attractorState.toLowerCase()}">${S.attractorState}</div>
        <div class="outcome-label">Final State</div>
      </div>
      <div class="outcome-item">
        <div class="outcome-value">₹${briefIncome.toLocaleString()}</div>
        <div class="outcome-label">${medIncome != null ? 'Median Monthly Income' : 'Avg Monthly Income'}</div>
      </div>
      <div class="outcome-item">
        <div class="outcome-value ${parseFloat(briefChange) >= 0 ? 'positive' : 'negative'}">${briefChange}%</div>
        <div class="outcome-label">Income Change</div>
      </div>
    </div>
    <div class="outcomes-grid">
      <div class="outcome-item">
        <div class="outcome-value">${relPct != null ? relPct + '%' : '\u2014'}</div>
        <div class="outcome-label">Escape Reliability</div>
      </div>
      <div class="outcome-item">
        <div class="outcome-value">${S.coordination.toFixed(2)}</div>
        <div class="outcome-label">Coordination Index</div>
      </div>
      <div class="outcome-item">
        <div class="outcome-value">${gini.toFixed(2)}</div>
        <div class="outcome-label">Gini Coefficient</div>
      </div>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">📋 Active Policies (${activePoliciesArray.length})</div>
    ${activePoliciesArray.length > 0 ? `
    <div class="policies-list">
      ${activePoliciesArray.map(id => `<span class="policy-tag">${Config.getPolicy(id)?.name || id}</span>`).join('')}
    </div>
    ` : '<p><em>No policies active (baseline scenario)</em></p>'}
  </div>
  

  <div class="section recommendations">
    <div class="section-title">💡 Recommendations <span style="font-weight:400;font-size:0.8em;color:#94a3b8">(ranked; highest priority first)</span></div>
    ${topRecs.length > 0 ? topRecs.map(rec => `
    <div class="rec-item ${rec.priority}">
      <div class="rec-priority">${rec.priority} - ${rec.category}</div>
      <div class="rec-action">${rec.action}</div>
      <div class="rec-rationale">${rec.rationale}</div>
    </div>
    `).join('') : '<p><em>No single dominant recommendation for this configuration.</em></p>'}
  </div>
  
  <div class="section">
    <div class="section-title">⚠️ Key risk</div>
    <div class="rec-item WARNING"><div class="rec-rationale" style="color:#1e293b">${keyRisk}</div></div>
  </div>
  
  <div class="confidence-box">
    <div class="confidence-title">📊 Computed outcome${outcome ? ` (replicated, N=${outcome.n} runs)` : ''}</div>
    ${outcome ? `
    <div class="confidence-item">• Escape reliability: <b>${relPct}%</b> of replicated runs reach the growth regime</div>
    <div class="confidence-item">• Median final income: <b>₹${medIncome != null ? medIncome.toLocaleString() : '\u2014'}</b>/month</div>
    ${escMed ? `<div class="confidence-item">• Escape timing: median <b>${escMed}</b>${escRange ? `, typical range ${escRange}` : ` (little run-to-run variation)`}</div>` : `<div class="confidence-item">• Escape timing: \u2014 (this configuration rarely escapes)</div>`}
    <div class="confidence-item" style="color:#64748b;margin-top:6px">Computed by replication under the model&rsquo;s \u00b12% monthly noise. Reliability is the headline \u2014 not any single run&rsquo;s outcome.</div>
    ` : `<div class="confidence-item">Computed outcome unavailable (analysis module not loaded).</div>`}
  </div>
  
  <div class="section">
    <div class="section-title">📝 Key Findings</div>
    <ul style="margin-left: 20px;">
      <li>System ${S.attractorState === 'TRAP' ? `remains in the poverty trap after ${fmtMonths(runMonths(S))}` : S.attractorState === 'GROWTH' ? (escapeMonths(S) != null ? `reached sustainable growth at ${fmtMonths(escapeMonths(S))} (simulation run so far: ${fmtMonths(runMonths(S))})` : `is in the growth regime (simulation run: ${fmtMonths(runMonths(S))})`) : `is transitioning (simulation run: ${fmtMonths(runMonths(S))})`}</li>
      <li>Income ${parseFloat(briefChange) >= 0 ? 'increased' : 'decreased'} by ${Math.abs(parseFloat(briefChange))}% from baseline${medIncome != null ? ' (replicated median)' : ''}</li>
      <li>Coordination ${parseFloat(coordChange) >= 0 ? 'improved' : 'declined'} by ${Math.abs(parseFloat(coordChange))} percentage points</li>
      <li>Inequality: ${gini < 0.35 ? 'Low' : gini < 0.45 ? 'Moderate' : 'High'} (Gini ${gini.toFixed(2)})</li>
      ${S.activeShocks?.length > 0 ? `<li>Active shocks: ${S.activeShocks.map(s => s.name).join(', ')}</li>` : ''}
      <li>R-loop activation: R1 (skill→income) at ${Math.round((S._R1_activation || 1) * 100)}%, R2 (market→income) at ${Math.round((S._R2_activation || 1) * 100)}%</li>
      ${(S._creditDependency || 0) > 0.1 ? `<li>⚠️ Credit dependency active at ${Math.round(S._creditDependency * 100)}% — middlemen locking artisans into debt cycles</li>` : ''}
      ${(S.craftExits || 0) > 0 ? `<li>Cumulative departures: ~${Math.round(S.craftExits).toLocaleString()} artisans over the run${S.attractorState === 'GROWTH' && escapeMonths(S) != null ? `, concentrated in the trap years before escape at ${fmtMonths(escapeMonths(S))} — the outflow eases once growth is reached` : ''}</li>` : ''}
    </ul>
  </div>
  
  <div style="margin-top:24px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:9pt;color:#475569;line-height:1.55">
    <b>Scope &amp; lineage.</b> Figures are computed by replication and specific to the case shown. This is a research instrument, not a calibrated forecaster: about 3% of its parameters are empirical, 9% mechanism-grounded, 27% literature-grounded, and 61% declared modelling assumptions. The framework, theoretical choices and judgement are the author&rsquo;s; built with AI assistance under citation discipline; responsibility rests with the author.<br>
    <span style="color:#64748b">Abboudi, B. (${new Date().getFullYear()}). CPAF v6 — Complexity-Based Policy Analysis Framework. Jindal School of Government and Public Policy.</span>
  </div>
  <div class="footer">
    CPAF v6 | Complexity-Based Policy Analysis Framework<br>
    Generated: ${new Date().toLocaleString()} | Simulation: ${Math.floor(runMonths(S)/12)}y ${runMonths(S)%12}m
  </div>
</body>
</html>
`;

    Simulation.logEvent('EXPORT', 'Executive Brief generated');
    downloadFile(html, `cpaf_executive_brief_${S.caseStudy}_${getTimestamp()}.html`, 'text/html');
  }
  // ========== END: EXECUTIVE_BRIEF ==========

  // ========== SECTION: POLICY_INTERACTION_ANALYSIS ==========
  function _peSelection(){ const S=Simulation.getState(); const casc=S.cascadeActivated||new Set(); return Array.from(S.activePolicies||[]).filter(id=>!casc.has(id)); }

  // (A) Static report — results computed now and baked in (no engine inside)
  function exportPolicyReport(){
    if (typeof PolicyExplorer==='undefined'){ alert('Policy analysis module not loaded.'); return; }
    const A=PolicyExplorer.analysis, F=PolicyExplorer.fmt;
    const cid=Simulation.getState().caseStudy; const sel=_peSelection();
    if (sel.length<1){ alert('Switch on at least one policy first — the report analyses your current selection.'); return; }
    const d = A.guarded(function(){ const stats=A.escapeStats(sel,cid,24); const bb=A.backbone(sel,cid,16,90);
      const loo=A.leaveOneOut(sel,cid,16); const gh=A.ghosts(bb.core.map(c=>c.id),sel,cid,4242); return {stats,bb,loo,gh}; });
    const th=(Config.THRESHOLDS)||{TRAP:2000,GROWTH:4122};
    // LOO bars (SVG)
    const W=620, rowH=22, bx=170, bw=300;
    let bars=''; d.loo.rows.forEach((r,i)=>{ const y=i*rowH+14; const mag=Math.min(1,Math.abs(r.dProb)/100); const col=r.cls==='load'?'#b91c1c':(r.cls==='counter'?'#15803d':'#94a3b8');
      bars+=`<text x="0" y="${y+4}" font-size="11" font-family="monospace" fill="#1e293b">${r.id}</text>`
          + `<rect x="${bx}" y="${y-7}" width="${bw}" height="12" fill="#eef2f7"/>`
          + `<rect x="${bx}" y="${y-7}" width="${(bw*mag).toFixed(0)}" height="12" fill="${col}"/>`
          + `<text x="${bx+bw+8}" y="${y+4}" font-size="11" font-family="monospace" fill="${col}">${r.dProb>0?'+':''}${r.dProb}pp · ${r.cls==='load'?'load-bearing':r.cls==='counter'?'counterproductive':'redundant'}</text>`; });
    const looSvg=`<svg width="${W}" height="${d.loo.rows.length*rowH+18}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
    // ghost outcome chart (SVG)
    const GW=620, GH=200, gl=46, gr=10, gt=10, gb=20; const mx=Math.max(th.GROWTH*1.5, Math.max.apply(null,d.gh.full.income)*1.1);
    const gx=i=>gl+(GW-gl-gr)*(i/359), gy=v=>gt+(GH-gt-gb)*(1-v/mx);
    const pathOf=arr=>arr.map((v,i)=>(i?'L':'M')+gx(i).toFixed(1)+' '+gy(v).toFixed(1)).join('');
    let ghs=d.gh.lines.map(l=>`<path d="${pathOf(l.income)}" fill="none" stroke="#b91c1c" stroke-width="1" stroke-dasharray="3 3" opacity="0.6"/>`).join('');
    const hl=(v,c,t)=>`<line x1="${gl}" y1="${gy(v)}" x2="${GW-gr}" y2="${gy(v)}" stroke="${c}" stroke-dasharray="4 3" opacity="0.7"/><text x="${gl+3}" y="${gy(v)-3}" font-size="9" font-family="monospace" fill="${c}">${t}</text>`;
    const ghostSvg=`<svg width="${GW}" height="${GH}" xmlns="http://www.w3.org/2000/svg"><rect width="${GW}" height="${GH}" fill="#f8fafc"/>${hl(th.GROWTH,'#15803d','GROWTH ₹'+(th.GROWTH/1000)+'k')}${hl(th.TRAP,'#b91c1c','TRAP ₹'+(th.TRAP/1000)+'k')}${ghs}<path d="${pathOf(d.gh.full.income)}" fill="none" stroke="#1e40af" stroke-width="2"/></svg>`;
    // backbone chips
    const chip=(t,c)=>`<span style="display:inline-block;font:600 12px monospace;border:1px solid ${c};color:${c};border-radius:5px;padding:3px 9px;margin:3px 5px 0 0">${t}</span>`;
    const coreHtml=d.bb.core.map(c=>chip(c.id+' (pull → '+c.probWhenRemoved+'%)', c.tier==='hard'?'#b91c1c':'#b45309')).join('');
    const shedHtml=d.bb.shed.length?d.bb.shed.map(s=>chip(s.id,'#94a3b8')).join(''):'<i style="color:#64748b">none — every selected instrument is in the core</i>';
    const looTable=d.loo.rows.map(r=>`<tr><td>${r.id}</td><td>${r.prob}%</td><td style="color:${r.cls==='load'?'#b91c1c':r.cls==='counter'?'#15803d':'#64748b'}">${r.dProb>0?'+':''}${r.dProb}pp</td><td>${r.cls==='load'?'load-bearing':r.cls==='counter'?'counterproductive':'redundant'}</td></tr>`).join('');
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>CPAF Policy Interaction Analysis — ${cid}</title>
<style>body{font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#1e293b;max-width:760px;margin:0 auto;padding:28px 22px;line-height:1.5}
h1{font-size:22px;margin:0 0 2px}h2{font-size:15px;margin:22px 0 6px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
.k{font:600 11px monospace;letter-spacing:.12em;text-transform:uppercase;color:#b45309}.dim{color:#64748b;font-size:13px}
.cards{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0}.card{border:1px solid #e2e8f0;border-radius:8px;padding:8px 13px;min-width:110px}
.card .l{font:600 9px monospace;letter-spacing:.08em;text-transform:uppercase;color:#64748b}.card .v{font:600 18px monospace;color:#1e40af;margin-top:2px}
table{border-collapse:collapse;width:100%;font-size:13px;margin-top:6px}td,th{border-bottom:1px solid #eef2f7;padding:5px 8px;text-align:left}th{color:#64748b;font-size:11px;text-transform:uppercase}
.note{font-size:12px;color:#64748b;font-style:italic;margin:6px 0 0}</style></head><body>
<div class="k">CPAF v6 · generated analysis</div><h1>Policy Interaction Analysis</h1>
<div class="dim">Case: <b>${cid}</b> · selection: ${sel.join(', ')} · generated ${new Date().toLocaleString()}</div>
${(function(){ const casc=A.cascadeInfo(sel); return casc.length?('<div class="dim" style="margin-top:4px">'+sel.length+' selected → '+d.gh.full.keys.length+' effective. '+casc.map(c=>'<b>'+c.umbrella+'</b> (umbrella) also activates: '+c.children.join(', ')).join(' · ')+'</div>'):''; })()}
<h2>Reliability</h2>
<div class="cards"><div class="card"><div class="l">Escape reliability</div><div class="v">${d.stats.prob}%</div></div>
<div class="card"><div class="l">Escape time (median)</div><div class="v">${F.ym(d.stats.median)}</div></div>
<div class="card"><div class="l">Time range</div><div class="v">${d.stats.min?(F.ym(d.stats.min)===F.ym(d.stats.max)?F.ym(d.stats.min):F.ym(d.stats.min)+'–'+F.ym(d.stats.max)):'—'}</div></div></div>
<div class="note">Across ${d.stats.n} runs. ${d.stats.min&&F.ym(d.stats.min)===F.ym(d.stats.max)?'Escape timing is tight run-to-run here; reliability is the stable fact.':'Escape time varies run to run; reliability and the range are the stable facts.'}</div>
${d.stats.prob<10 ? `<div class="note" style="margin:10px 0 0">${d.stats.prob===0 ? 'This selection does not escape the trap in any run, so there is no escape structure to analyse. Try adding a structural policy (SFURTI, ODOP, or GI registration) — the backbone that drives escape — or, secondarily, a market-access one (ECOMMERCE, MAI).' : 'This selection escapes in only <b>'+d.stats.prob+'%</b> of runs — too rarely to read a reliable backbone or leave-one-out. The reliability and range above are the honest summary; a stronger combination is needed.'}</div>` : `<h2>Structural backbone — smallest set that still escapes</h2>
<div>${coreHtml}</div>
<div style="margin-top:9px;font-size:13px;color:#64748b">Removable, in shed order (no escape cost): </div><div>${shedHtml}</div>
<div class="note">Red = hard-essential (removing it collapses escape — the true backbone). Amber = soft-essential (escape drops but survives).${d.bb.highlyRedundant?' This portfolio is highly redundant, so the minimal set is not unique — other small sets also work; this is one of them.':''}</div>
<h2>Outcome with each backbone policy pulled</h2>${ghostSvg}
<div class="note">Blue = full selection. Dashed red = a core policy removed; it falls back below the growth line into the trap.</div>
<h2>Leave-one-out (relative to this selection)</h2>
${d.loo.allRedundant?'<div style="background:#fff7ed;border:1px solid #b45309;border-radius:7px;padding:9px 12px;font-size:13px;margin-bottom:8px">With this whole selection active, removing any single instrument still escapes — nothing reads as individually essential. That means the portfolio is redundant, not that nothing matters; the backbone above shows what is load-bearing.</div>':''}
<table><tr><th>removed</th><th>escape</th><th>change</th><th>role</th></tr>${looTable}</table>
${looSvg}
<h2>Why this happens</h2>
${(function(){ const rep=d.gh.full; const eff=rep.keys.length; const coordStart=rep.coord[0]; const coordFinal=rep.coord[rep.coord.length-1]; const coordFloor=Math.min.apply(null,rep.coord); const coordRose=coordFinal>coordStart+0.02; const coordFell=coordFinal<coordStart-0.02; const cut=Math.max(0,Math.round((1-Math.min.apply(null,rep.coordEffect))*100)); const maxFric=(rep.friction&&rep.friction.length)?Math.max.apply(null,rep.friction):0; const hasFriction=maxFric>0.001&&eff>2; const escaped=d.stats.median!=null;
  const steps=[['<b>'+eff+'</b> polic'+(eff===1?'y':'ies')+' active','what you funded']];
  if(coordRose){ steps.push(['coordination \u2191 '+coordFinal.toFixed(2),'the co-op builds past critical mass (from '+coordStart.toFixed(2)+')']); } else if(coordFell){ if(hasFriction) steps.push(['friction rises','grows faster than the number of policies']); steps.push(['coordination \u2193 '+coordFinal.toFixed(2), hasFriction?('from '+coordStart.toFixed(2)+' as policies crowd'):('from '+coordStart.toFixed(2)+' over time')]); if(cut>0) steps.push(['~'+cut+'% of effort lost', hasFriction?'the policies pull against each other':'low coordination wastes effort']); } else { steps.push(['coordination holds '+coordFinal.toFixed(2),'steady across the run']); }
  if(!escaped) steps.push(['no escape in 30 years','this mix does not cross the threshold']); else if(coordFell&&cut>0) steps.push(['escape '+F.ym(d.stats.median),'held back by the coordination loss']); else if(coordRose) steps.push(['escape '+F.ym(d.stats.median),'the co-op powered the escape']); else steps.push(['escape '+F.ym(d.stats.median),'coordination was not the brake']);
  let strip='<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:stretch;margin:6px 0 12px">';
  steps.forEach((s,i)=>{ strip+='<div style="flex:1 1 0;min-width:110px;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px"><div style="font:600 13px monospace;color:#1e293b">'+s[0]+'</div><div style="font-size:11px;color:#64748b;margin-top:3px">'+s[1]+'</div></div>'; if(i<steps.length-1) strip+='<div style="align-self:center;color:#1e40af;font-weight:700">→</div>'; });
  strip+='</div>';
  const tens=A.tensionNotes(sel,cid,rep);
  let tl=tens.map(t=>'<div style="border:1px solid #e2e8f0;border-left:3px solid #1e40af;border-radius:6px;padding:8px 11px;font-size:12.5px;line-height:1.5;margin-bottom:6px"><b>'+t.title+'</b> — '+t.text+'</div>').join('');
  const tlead = tens.length ? '<div style="font-size:12px;color:#64748b;margin:12px 0 6px">Cross-dimensional tensions at work in this selection (the model&rsquo;s interaction layer, analysed here):</div>' : '';
  return strip+tlead+tl;
})()}`}
<div class="note" style="margin-top:18px">Honesty notes — reliability (probability) is the headline; escape time is a range because any single run varies. The backbone is found by shedding the most-redundant instrument until escape would break, not by one-at-a-time removal on the full set (which hides the backbone). Necessity is relative to the rest of the selection. Findings are specific to ${cid}. The model carries ±2%/month noise.</div>
<div style="margin-top:22px;border-top:1px solid #e2e8f0;padding-top:13px;font-size:11px;line-height:1.6;color:#64748b">
<div style="color:#1e293b;font-size:12px;margin-bottom:7px">CPAF v6 · Abboudi, B. (2026) · Jindal School of Government and Public Policy, O.P. Jindal Global University — an elaborated implementation extending the original framework, not a reproduction of the thesis.</div>
<div><b style="color:#1e40af">Method references.</b> Network (D1): Provan &amp; Milward (2001); Granovetter (1973). Attractor (D2): Meadows (2008); Azariadis &amp; Stachurski (2005); Scheffer et al. (2001). Narrative (D3): Jones &amp; McBeth (2010); Sabatier (1988). System dynamics (D4): Sterman (2000); Forrester (1961). Spatiotemporal (D5): Anselin (1988); Tobler (1970). Agent-based (D6): Epstein &amp; Axtell (1996); Schelling (1971). Monte Carlo (D7): Saltelli et al. (2008); Metropolis &amp; Ulam (1949). Validation standard: Barlas (1996).</div>
<div style="margin-top:7px"><b style="color:#1e40af">Provenance.</b> Figures are replicated across runs and specific to the case shown. This is a research instrument, not a calibrated forecaster: of its parameters, about 3% are empirical, 9% mechanism-grounded, 27% literature-grounded, and 61% are declared modelling assumptions — plausible values and theory-based equation forms, not invented data. Built with AI assistance under citation discipline; the framework, theoretical choices, and judgement are the author's, and responsibility rests with the author.</div>
</div>
</body></html>`;
    Simulation.logEvent('EXPORT', 'Policy interaction report generated');
    downloadFile(html, `cpaf_policy_report_${cid}_${getTimestamp()}.html`, 'text/html');
  }

  const PE_TOOL_HEAD = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>CPAF · Policy Interaction Analysis</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap');
body{margin:0;background:#16130d;color:#ece4d2;font-family:"Spectral",Georgia,serif}.page{max-width:1180px;margin:0 auto;padding:22px 18px 48px}
.ph{border-bottom:1px solid #3a3326;padding-bottom:13px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
.ph .k{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c79a52}.ph h1{font-size:25px;font-weight:600;margin:4px 0 0}
.ph .cs{font-family:"IBM Plex Mono",monospace;font-size:12px;color:#a99e86}.ph select{background:#1d1810;color:#ece4d2;border:1px solid #3a3326;border-radius:6px;padding:5px 9px;font-family:"IBM Plex Mono",monospace;font-size:12px;margin-left:6px}
.by{font-family:"IBM Plex Mono",monospace;font-size:11.5px;color:#a99e86;margin-top:5px}.attrib{margin-top:26px;border-top:1px solid #3a3326;padding-top:14px;font-size:11px;line-height:1.6;color:#a99e86}.attrib .cite{color:#ece4d2;font-size:12px;margin-bottom:7px}.attrib b{color:#c79a52;font-weight:600}</style></head>
<body><div class="page"><div class="ph"><div><div class="k">CPAF v6 · generated analysis</div><h1>Policy Interaction Analysis</h1><div class="by">Abboudi, B. (2026) · Jindal School of Government and Public Policy, O.P. Jindal Global University · elaborated implementation, not a reproduction of the thesis</div></div>
<div class="cs">Case: <select id="caseSel"><option value="chikankari">Chikankari (high-extraction)</option><option value="cheriyal">Cheriyal (low-extraction)</option></select></div></div><div id="pe"></div>
<div class="attrib"><div class="cite">CPAF v6 · Abboudi, B. (2026) · Jindal School of Government and Public Policy, O.P. Jindal Global University — an elaborated implementation extending the original framework, not a reproduction of the thesis.</div>
<div><b>Method references.</b> Network (D1): Provan &amp; Milward (2001); Granovetter (1973). Attractor (D2): Meadows (2008); Azariadis &amp; Stachurski (2005); Scheffer et al. (2001). Narrative (D3): Jones &amp; McBeth (2010); Sabatier (1988). System dynamics (D4): Sterman (2000); Forrester (1961). Spatiotemporal (D5): Anselin (1988); Tobler (1970). Agent-based (D6): Epstein &amp; Axtell (1996); Schelling (1971). Monte Carlo (D7): Saltelli et al. (2008); Metropolis &amp; Ulam (1949). Validation standard: Barlas (1996).</div>
<div style="margin-top:7px"><b>Provenance.</b> Figures are replicated across runs and specific to the case shown. This is a research instrument, not a calibrated forecaster: of its parameters, about 3% are empirical, 9% mechanism-grounded, 27% literature-grounded, and 61% are declared modelling assumptions — plausible values and theory-based equation forms, not invented data. Built with AI assistance under citation discipline; the framework, theoretical choices, and judgement are the author's, and responsibility rests with the author.</div></div></div><script>
`;

  // (B) Interactive tool — self-contained. Uses a base64 engine bundle (works from file://, unlike fetch).
  function _peToolMount(cid){
    return "(function(){var sel=document.getElementById('caseSel');sel.value="+JSON.stringify(cid)+";var inst=PolicyExplorer.mount(document.getElementById('pe'),{mode:'standalone',dark:true,getCase:function(){return sel.value;}});sel.addEventListener('change',function(){inst.refresh();});})();";
  }
  function _peToolFromEngine(engine, cid){
    const html=PE_TOOL_HEAD+engine+"\n/* MOUNT */\n"+_peToolMount(cid)+"\n</scr"+"ipt></body></html>";
    Simulation.logEvent('EXPORT', 'Policy interaction tool generated');
    downloadFile(html, "cpaf_policy_tool_"+cid+"_"+getTimestamp()+".html", 'text/html');
  }
  function _peDecodeBundle(){
    try { const bin=atob(window.__PE_BUNDLE); const bytes=Uint8Array.from(bin, c=>c.charCodeAt(0)); return new TextDecoder('utf-8').decode(bytes); }
    catch(e){ return null; }
  }
  function exportPolicyTool(){
    const cid=Simulation.getState().caseStudy;
    // already loaded?
    if (typeof window!=='undefined' && window.__PE_BUNDLE){ const eng=_peDecodeBundle(); if(eng){ _peToolFromEngine(eng,cid); return; } }
    // lazy-load the bundle via a <script> tag (allowed from file://; fetch is not)
    const s=document.createElement('script'); s.src='js/pe_bundle.js';
    s.onload=function(){ const eng=_peDecodeBundle(); if(eng){ _peToolFromEngine(eng,cid); } else { _peToolFetch(cid); } };
    s.onerror=function(){ _peToolFetch(cid); };
    document.head.appendChild(s);
  }
  // fallback for a served app without the bundle file
  function _peToolFetch(cid){
    if (typeof fetch==='undefined'){ alert('Interactive tool export needs the bundle file (js/pe_bundle.js) or a served app.'); return; }
    const files=['js/config.js','js/simulation.js','js/policy_explorer.js','js/policy_explorer_ui.js'];
    Promise.all(files.map(f=>fetch(f).then(r=>{ if(!r.ok) throw new Error(f); return r.text(); })))
      .then(function(p){ _peToolFromEngine("/* CONFIG */\n"+p[0]+"\n/* SIMULATION */\n"+p[1]+"\n/* PE ENGINE */\n"+p[2]+"\n/* PE UI */\n"+p[3], cid); })
      .catch(function(e){ alert('Could not build the interactive tool. Make sure js/pe_bundle.js is present (it ships with the build).'); });
  }
  // ========== END: POLICY_INTERACTION_ANALYSIS ==========

  // Public API
  return {
    exportConfig,
    exportCSV,
    exportEventLog,
    exportEventLogText,
    generateReport,
    generateExecutiveBrief,
    generateRecommendations,
    exportPolicyReport,
    exportPolicyTool,
    downloadFile,
    getTimestamp
  };
})();
