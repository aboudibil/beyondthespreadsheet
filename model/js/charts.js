/* ╔════════════════════════════════════════════════════════════════════════════╗
   ║  CPAF v6 - charts.js                                                        ║
   ║  Chart.js Visualizations - FIXED line display, added MC and ABM charts      ║
   ╚════════════════════════════════════════════════════════════════════════════╝ */

const Charts = (function() {
  'use strict';

  let incomeChart = null;
  let dimensionsChart = null;
  let popGiniChart = null;
  let middlemenChart = null;
  let monteCarloChart = null;
  let abmScatterChart = null;
  let heritageChart = null;
  let genderChart = null;
  let spatialChart = null;

  // ========== BASE OPTIONS ==========
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: { boxWidth: 8, font: { size: 8 }, padding: 4 }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        titleFont: { size: 9 },
        bodyFont: { size: 8 },
        padding: 4
      }
    },
    scales: {
      x: {
        display: true,
        ticks: { font: { size: 7 }, maxTicksLimit: 8 },
        grid: { display: false }
      },
      y: {
        display: true,
        beginAtZero: false,
        ticks: { font: { size: 7 } },
        grid: { color: '#e2e8f0' }
      }
    },
    elements: {
      point: { radius: 0, hoverRadius: 3 },
      line: { tension: 0.3, borderWidth: 2 }
    }
  };

  // ========== INIT CHARTS ==========
  function initCharts() {
    // Income Chart
    const incomeCtx = document.getElementById('chartIncome');
    if (incomeCtx) {
      incomeChart = new Chart(incomeCtx, {
        type: 'line',
        data: {
          labels: [0],
          datasets: [
            { label: 'Seg A', data: [0], borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: false, borderWidth: 2 },
            { label: 'Seg B', data: [0], borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', fill: false, borderWidth: 2 },
            { label: 'Seg C', data: [0], borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', fill: false, borderWidth: 2 },
            { label: 'Avg', data: [0], borderColor: '#6366f1', borderWidth: 2.5, pointRadius: 0, fill: false }, // FIX #34
            { label: 'TRAP', data: [0], borderColor: '#dc2626', borderDash: [5, 5], borderWidth: 1, pointRadius: 0, fill: false }
          ]
        },
        options: {
          ...baseOptions,
          scales: {
            ...baseOptions.scales,
            y: { ...baseOptions.scales.y, title: { display: true, text: '₹/mo', font: { size: 8 } } }
          }
        }
      });
    }

    // Dimensions Chart
    const dimCtx = document.getElementById('chartDimensions');
    if (dimCtx) {
      dimensionsChart = new Chart(dimCtx, {
        type: 'line',
        data: {
          labels: [0],
          datasets: [
            { label: 'Coord (C)', data: [0], borderColor: '#059669', fill: false, borderWidth: 2 },
            { label: 'Political (P)', data: [0], borderColor: '#7c3aed', fill: false, borderWidth: 2 },
            { label: 'Skills (S)', data: [0], borderColor: '#2563eb', fill: false, borderWidth: 2 }
          ]
        },
        options: {
          ...baseOptions,
          scales: {
            x: baseOptions.scales.x,
            y: { type: 'linear', display: true, min: 0, max: 1, ticks: { font: { size: 7 } }, grid: { color: '#e2e8f0' } }
          }
        }
      });
    }

    // Population & Gini Chart
    const popGiniCtx = document.getElementById('chartPopGini');
    if (popGiniCtx) {
      popGiniChart = new Chart(popGiniCtx, {
        type: 'line',
        data: {
          labels: [0],
          datasets: [
            { label: 'Pop (k)', data: [0], borderColor: '#0891b2', fill: false, borderWidth: 2, yAxisID: 'y' },
            { label: 'Gini', data: [0], borderColor: '#db2777', fill: false, borderWidth: 2, yAxisID: 'y1' }
          ]
        },
        options: {
          ...baseOptions,
          scales: {
            x: baseOptions.scales.x,
            y: { type: 'linear', display: true, position: 'left', ticks: { font: { size: 7 } }, grid: { color: '#e2e8f0' }, title: { display: true, text: 'Pop(k)', font: { size: 7 } } },
            y1: { type: 'linear', display: true, position: 'right', min: 0, max: 1, ticks: { font: { size: 7 } }, grid: { drawOnChartArea: false }, title: { display: true, text: 'Gini', font: { size: 7 } } }
          }
        }
      });
    }

    // Middlemen & Market Chart
    const midMktCtx = document.getElementById('chartMiddlemen');
    if (midMktCtx) {
      middlemenChart = new Chart(midMktCtx, {
        type: 'line',
        data: {
          labels: [0],
          datasets: [
            { label: 'Middlemen', data: [0], borderColor: '#ef4444', fill: false, borderWidth: 2 },
            { label: 'Market', data: [0], borderColor: '#22c55e', fill: false, borderWidth: 2 }
          ]
        },
        options: {
          ...baseOptions,
          scales: {
            x: baseOptions.scales.x,
            y: { type: 'linear', display: true, min: 0, max: 1, ticks: { font: { size: 7 } }, grid: { color: '#e2e8f0' } }
          }
        }
      });
    }

    // ABM Scatter Chart (segment positions)
    const abmCtx = document.getElementById('chartABM');
    if (abmCtx) {
      abmScatterChart = new Chart(abmCtx, {
        type: 'scatter',
        data: {
          datasets: [
            { label: 'Seg A', data: [], backgroundColor: 'rgba(239,68,68,0.7)', borderColor: '#ef4444', pointRadius: 8 },
            { label: 'Seg B', data: [], backgroundColor: 'rgba(245,158,11,0.7)', borderColor: '#f59e0b', pointRadius: 8 },
            { label: 'Seg C', data: [], backgroundColor: 'rgba(34,197,94,0.7)', borderColor: '#22c55e', pointRadius: 8 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 300 },
          plugins: {
            legend: { display: true, position: 'bottom', labels: { boxWidth: 8, font: { size: 8 } } },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: Share ${ctx.raw.x.toFixed(0)}%, Income ₹${ctx.raw.y.toLocaleString()}`
              }
            }
          },
          scales: {
            x: { type: 'linear', display: true, min: 0, max: 100, title: { display: true, text: 'Share %', font: { size: 8 } }, ticks: { font: { size: 7 } } },
            y: { type: 'linear', display: true, min: 0, title: { display: true, text: 'Income ₹', font: { size: 8 } }, ticks: { font: { size: 7 } } }
          }
        }
      });
    }

    // FIX #31: Heritage & Gender Chart
    const herCtx = document.getElementById('chartHeritage');
    if (herCtx) {
      heritageChart = new Chart(herCtx, {
        type: 'line',
        data: { labels: [0], datasets: [
          { label: 'Heritage', data: [0], borderColor: '#b45309', backgroundColor: 'rgba(180,83,9,0.08)', fill: true, borderWidth: 2 }
        ]},
        options: { ...baseOptions, scales: { x: baseOptions.scales.x,
          y: { type: 'linear', min: 0, max: 1, ticks: { font: { size: 7 } }, grid: { color: '#e2e8f0' }, title: { display: true, text: 'Heritage (0\u20131)', font: { size: 7 } } } } }
      });
    }
    const genCtx = document.getElementById('chartGender');
    if (genCtx) {
      genderChart = new Chart(genCtx, {
        type: 'line',
        data: { labels: [0], datasets: [
          { label: 'M Income', data: [0], borderColor: '#2563eb', fill: false, borderWidth: 2 },
          { label: 'F Income', data: [0], borderColor: '#db2777', fill: false, borderWidth: 2, borderDash: [4, 2] }
        ]},
        options: { ...baseOptions, scales: { x: baseOptions.scales.x,
          y: { type: 'linear', ticks: { font: { size: 7 } }, grid: { color: '#e2e8f0' }, title: { display: true, text: '\u20b9/mo', font: { size: 7 } } } } }
      });
    }
    const spaCtx = document.getElementById('chartSpatial');
    if (spaCtx) {
      spatialChart = new Chart(spaCtx, {
        type: 'line',
        data: { labels: [0], datasets: [
          { label: 'Spatial reach', data: [0], borderColor: '#0891b2', backgroundColor: 'rgba(8,145,178,0.08)', fill: true, borderWidth: 2 }
        ]},
        options: { ...baseOptions, scales: { x: baseOptions.scales.x,
          y: { type: 'linear', min: 0, max: 1, ticks: { font: { size: 7 } }, grid: { color: '#e2e8f0' }, title: { display: true, text: 'reach (0\u20131)', font: { size: 7 } } } } }
      });
    }
  }

  // ========== UPDATE CHARTS ==========
  function updateCharts(state) {
    if (!state || !state.history) return;
    
    const histLen = state.history.income.length;
    // Generate year-based labels: "Y1", "Y2"... for every 12th month
    const labels = state.history.income.map((_, i) => {
      if (i === 0) return 'Start';
      if (i % 12 === 0) return `Y${Math.floor(i / 12)}`;
      return '';
    });
    const trapThreshold = state.thresholds ? state.thresholds.TRAP : (Config.THRESHOLDS ? Config.THRESHOLDS.TRAP : 2000);
    const trapLine = Array(histLen).fill(trapThreshold);

    // Income Chart
    if (incomeChart && histLen > 0) {
      incomeChart.data.labels = labels;
      incomeChart.data.datasets[0].data = state.history.segA || [];
      incomeChart.data.datasets[1].data = state.history.segB || [];
      incomeChart.data.datasets[2].data = state.history.segC || [];
      // FIX #34: Compute weighted average income
      const avgIncome = (state.history.segA || []).map((a, i) => {
        const b = (state.history.segB || [])[i] || 0;
        const c = (state.history.segC || [])[i] || 0;
        const sA = state.segments ? state.segments.A.share : 0.6;
        const sB = state.segments ? state.segments.B.share : 0.3;
        const sC = state.segments ? state.segments.C.share : 0.1;
        return Math.round(a * sA + b * sB + c * sC);
      });
      incomeChart.data.datasets[3].data = avgIncome;
      incomeChart.data.datasets[4].data = trapLine;
      incomeChart.update('none');
    }

    // Dimensions Chart
    if (dimensionsChart && histLen > 0) {
      dimensionsChart.data.labels = labels;
      dimensionsChart.data.datasets[0].data = state.history.coordination || [];
      dimensionsChart.data.datasets[1].data = state.history.political || [];
      dimensionsChart.data.datasets[2].data = state.history.skills || [];
      dimensionsChart.update('none');
    }

    // Population & Gini Chart
    if (popGiniChart && histLen > 0) {
      popGiniChart.data.labels = labels;
      popGiniChart.data.datasets[0].data = (state.history.population || []).map(p => p / 1000);
      popGiniChart.data.datasets[1].data = state.history.gini || [];
      popGiniChart.update('none');
    }

    // Middlemen & Market Chart
    if (middlemenChart && histLen > 0) {
      middlemenChart.data.labels = labels;
      middlemenChart.data.datasets[0].data = state.history.middlemen || [];
      middlemenChart.data.datasets[1].data = state.history.market || [];
      middlemenChart.update('none');
    }

    // ABM Scatter Chart
    if (abmScatterChart && state.segments) {
      abmScatterChart.data.datasets[0].data = [{ x: state.segments.A.share * 100, y: state.segments.A.income }];
      abmScatterChart.data.datasets[1].data = [{ x: state.segments.B.share * 100, y: state.segments.B.income }];
      abmScatterChart.data.datasets[2].data = [{ x: state.segments.C.share * 100, y: state.segments.C.income }];
      
      // Size points by population share
      abmScatterChart.data.datasets[0].pointRadius = Math.max(5, state.segments.A.share * 30);
      abmScatterChart.data.datasets[1].pointRadius = Math.max(5, state.segments.B.share * 30);
      abmScatterChart.data.datasets[2].pointRadius = Math.max(5, state.segments.C.share * 30);
      
      abmScatterChart.update('none');
    }

    // Heritage (B3 stock) \u2014 split from gender
    if (heritageChart && histLen > 0) {
      heritageChart.data.labels = labels;
      heritageChart.data.datasets[0].data = state.history.heritage || [];
      heritageChart.update('none');
    }
    // Income by gender \u2014 reporting overlay (not a driver)
    if (genderChart && histLen > 0) {
      genderChart.data.labels = labels;
      genderChart.data.datasets[0].data = state.history.maleIncome || [];
      genderChart.data.datasets[1].data = state.history.femaleIncome || [];
      genderChart.update('none');
    }
    // Spatial reach (D5) \u2014 composite urban/peri/rural access
    if (spatialChart && histLen > 0) {
      spatialChart.data.labels = labels;
      spatialChart.data.datasets[0].data = state.history.spatial || [];
      spatialChart.update('none');
    }
  }

  // ========== MONTE CARLO CHART ==========
  function renderMonteCarloChart(container, results) {
    if (!results || !results.finalIncomes) return null;

    // Destroy existing
    if (monteCarloChart) {
      monteCarloChart.destroy();
      monteCarloChart = null;
    }

    // Create histogram
    const bins = 15;
    const minIncome = results.stats.min;
    const maxIncome = results.stats.max;
    const binWidth = (maxIncome - minIncome) / bins;
    
    const histogram = Array(bins).fill(0);
    results.finalIncomes.forEach(income => {
      const binIndex = Math.min(Math.floor((income - minIncome) / binWidth), bins - 1);
      histogram[binIndex]++;
    });

    const labels = Array(bins).fill(0).map((_, i) => `₹${Math.round(minIncome + i * binWidth / 1000)}k`);
    
    // Color bars based on the LIVE thresholds (were: TRAP-or-8000 and a hardcoded 15000, which painted
    // every re-rooted escape ~₹8k yellow because 8k < 15k). Now green above the real GROWTH threshold.
    const thresh = Config.THRESHOLDS ? Config.THRESHOLDS.TRAP : 2000;
    const growthThresh = Config.THRESHOLDS ? Config.THRESHOLDS.GROWTH : 4122;
    const colors = labels.map((_, i) => {
      const binCenter = minIncome + (i + 0.5) * binWidth;
      return binCenter < thresh ? 'rgba(239,68,68,0.7)' : binCenter < growthThresh ? 'rgba(245,158,11,0.7)' : 'rgba(34,197,94,0.7)';
    });

    const ctx = container.getContext('2d');
    monteCarloChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Runs',
          data: histogram,
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace('0.7', '1')),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: `Monte Carlo (n=${results.finalIncomes.length}) | Escape: ${(results.stats.escapeProb * 100).toFixed(0)}%`, font: { size: 10 } },
          tooltip: {
            callbacks: {
              title: (items) => `Income: ${items[0].label}`,
              label: (item) => `${item.raw} runs (${(item.raw / results.finalIncomes.length * 100).toFixed(1)}%)`
            }
          }
        },
        scales: {
          x: { ticks: { font: { size: 7 }, maxRotation: 45 } },
          y: { title: { display: true, text: 'Runs', font: { size: 8 } }, ticks: { font: { size: 7 } } }
        }
      }
    });

    return monteCarloChart;
  }

  // ========== CONFIDENCE BANDS ==========
  function addConfidenceBands(results) {
    if (!incomeChart || !results || !results.trajectories) return;
    
    // Calculate percentiles at each time point
    const months = results.trajectories[0].length;
    const p5 = [], p25 = [], p75 = [], p95 = [];
    
    for (let m = 0; m < months; m++) {
      const values = results.trajectories.map(t => t[m]).sort((a, b) => a - b);
      const n = values.length;
      p5.push(values[Math.floor(n * 0.05)]);
      p25.push(values[Math.floor(n * 0.25)]);
      p75.push(values[Math.floor(n * 0.75)]);
      p95.push(values[Math.floor(n * 0.95)]);
    }
    
    // Add to income chart (if not already present)
    // Datasets: [0]SegA [1]SegB [2]SegC [3]Avg [4]TRAP [5]MC95% [6]MC5%
    if (incomeChart.data.datasets.length < 7) {
      incomeChart.data.datasets.push({
        label: 'MC 95% CI',
        data: p95,
        borderColor: 'rgba(100,116,139,0.3)',
        backgroundColor: 'rgba(100,116,139,0.1)',
        fill: '+1',
        borderWidth: 1,
        pointRadius: 0
      });
      incomeChart.data.datasets.push({
        label: 'MC 5%',
        data: p5,
        borderColor: 'rgba(100,116,139,0.3)',
        fill: false,
        borderWidth: 1,
        pointRadius: 0
      });
    } else {
      incomeChart.data.datasets[5].data = p95;
      incomeChart.data.datasets[6].data = p5;
    }
    
    incomeChart.update('none');
  }

  // ========== EXPORT ==========
  function exportChartAsImage(chartId, filename = 'chart.png') {
    let chart;
    if (chartId === 'income') chart = incomeChart;
    else if (chartId === 'dimensions') chart = dimensionsChart;
    else if (chartId === 'popgini') chart = popGiniChart;
    else if (chartId === 'middlemen') chart = middlemenChart;
    else if (chartId === 'montecarlo') chart = monteCarloChart;
    else if (chartId === 'abm') chart = abmScatterChart;
    else if (chartId === 'heritage') chart = heritageChart;  // FIX #32
    
    if (!chart) return null;
    return chart.toBase64Image('image/png', 1);
  }

  // ========== DESTROY ==========
  function destroyCharts() {
    [incomeChart, dimensionsChart, popGiniChart, middlemenChart, monteCarloChart, abmScatterChart, heritageChart, genderChart, spatialChart].forEach(chart => {
      if (chart) chart.destroy();
    });
    incomeChart = dimensionsChart = popGiniChart = middlemenChart = monteCarloChart = abmScatterChart = heritageChart = genderChart = spatialChart = null;
  }

  // Public API
  return {
    initCharts,
    updateCharts,
    renderMonteCarloChart,
    addConfidenceBands,
    exportChartAsImage,
    destroyCharts,
    getIncomeChart: () => incomeChart,
    getDimensionsChart: () => dimensionsChart,
    getMonteCarloChart: () => monteCarloChart
  };
})();
