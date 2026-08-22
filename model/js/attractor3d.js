/* ╔════════════════════════════════════════════════════════════════════════════╗
   ║  CPAF v6 - attractor3d.js                                                   ║
   ║  3D Attractor Visualization - FIXED: Immediate updates, proper basins       ║
   ╚════════════════════════════════════════════════════════════════════════════╝ */

const Attractor3D = (function() {
  'use strict';

  let scene, camera, renderer;
  let trajectoryLine, currentPoint, trailPoints = [];
  let trapMesh, transMesh, growthMesh;
  let thresholdPlanes = [];
  let autoRotate = true;
  let container;
  let initialized = false;
  let animationId = null;

  // Coordinate system: X=Income (LOG SCALE), Y=Coordination, Z=Skills
  // FIX #7: Log scale for income axis to handle ₹2k–₹25k range
  const BOUNDS = {
    income: { min: 2000, max: 12000, size: 12, logScale: true },
    coord: { min: 0, max: 1, size: 8 },
    skills: { min: 0, max: 1, size: 8 }
  };

  function init() {
    container = document.getElementById('attractor3D');
    if (!container || typeof THREE === 'undefined') {
      console.warn('Attractor3D: Missing container or Three.js');
      return;
    }

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 200;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);

    // Camera
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(20, 12, 16);
    camera.lookAt(6, 4, 4);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(15, 20, 10);
    scene.add(dirLight);

    // Build scene
    createAxes();
    createBasins();
    createThresholdPlanes();
    createTrajectory();
    createCurrentPoint();
    addMouseControls();

    initialized = true;
    animate();
    window.addEventListener('resize', onResize);
    
    console.log('Attractor3D initialized');
  }

  function createAxes() {
    const group = new THREE.Group();
    
    // X axis (Income) - Blue
    const xMat = new THREE.LineBasicMaterial({ color: 0x2563eb, linewidth: 2 });
    const xGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(BOUNDS.income.size, 0, 0)
    ]);
    group.add(new THREE.Line(xGeom, xMat));
    
    // Y axis (Coordination) - Green
    const yMat = new THREE.LineBasicMaterial({ color: 0x059669, linewidth: 2 });
    const yGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, BOUNDS.coord.size, 0)
    ]);
    group.add(new THREE.Line(yGeom, yMat));
    
    // Z axis (Skills) - Purple
    const zMat = new THREE.LineBasicMaterial({ color: 0x7c3aed, linewidth: 2 });
    const zGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, BOUNDS.skills.size)
    ]);
    group.add(new THREE.Line(zGeom, zMat));

    // Grid floor
    const grid = new THREE.GridHelper(BOUNDS.income.size, 12, 0x94a3b8, 0xcbd5e1);
    grid.rotation.x = 0;
    grid.position.set(BOUNDS.income.size / 2, 0, BOUNDS.skills.size / 2);
    group.add(grid);

    // Axis labels
    addLabel('Income ₹', BOUNDS.income.size + 1, 0, 0, 0x2563eb);
    addLabel('Artisan co-op', 0, BOUNDS.coord.size + 0.5, 0, 0x059669);
    addLabel('Skills', 0, 0, BOUNDS.skills.size + 0.5, 0x7c3aed);
    
    // Tick marks (FIX #7: use log-scale positions)
    addLabel('₹' + (Config.THRESHOLDS.TRAP / 1000).toFixed(1) + 'k', normalize(Config.THRESHOLDS.TRAP, 'income'), -0.3, 0, 0x64748b, 0.6);
    addLabel('₹' + (Config.THRESHOLDS.GROWTH / 1000).toFixed(1) + 'k', normalize(Config.THRESHOLDS.GROWTH, 'income'), -0.3, 0, 0x64748b, 0.6);

    scene.add(group);
  }

  function addLabel(text, x, y, z, color, scale = 1) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 64;
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, y, z);
    sprite.scale.set(1.5 * scale, 0.75 * scale, 1);
    scene.add(sprite);
  }

  function createBasins() {
    // TRAP basin (red, low income region)
    const trapGeom = new THREE.BoxGeometry(
      normalize(Config.THRESHOLDS.TRAP, 'income'),
      BOUNDS.coord.size * 0.5,
      BOUNDS.skills.size
    );
    const trapMat = new THREE.MeshPhongMaterial({
      color: 0xdc2626,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    });
    trapMesh = new THREE.Mesh(trapGeom, trapMat);
    trapMesh.position.set(
      normalize(Config.THRESHOLDS.TRAP, 'income') / 2,
      BOUNDS.coord.size * 0.25,
      BOUNDS.skills.size / 2
    );
    scene.add(trapMesh);

    // TRANSITION basin (amber, middle region)
    const transGeom = new THREE.BoxGeometry(
      normalize(Config.THRESHOLDS.GROWTH, 'income') - normalize(Config.THRESHOLDS.TRAP, 'income'),
      BOUNDS.coord.size * 0.6,
      BOUNDS.skills.size
    );
    const transMat = new THREE.MeshPhongMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide
    });
    transMesh = new THREE.Mesh(transGeom, transMat);
    transMesh.position.set(
      normalize(Config.THRESHOLDS.TRAP, 'income') + (normalize(Config.THRESHOLDS.GROWTH, 'income') - normalize(Config.THRESHOLDS.TRAP, 'income')) / 2,
      BOUNDS.coord.size * 0.3,
      BOUNDS.skills.size / 2
    );
    scene.add(transMesh);

    // GROWTH basin (green, high income region)
    const growthGeom = new THREE.BoxGeometry(
      BOUNDS.income.size - normalize(Config.THRESHOLDS.GROWTH, 'income'),
      BOUNDS.coord.size * 0.5,
      BOUNDS.skills.size * 0.7
    );
    const growthMat = new THREE.MeshPhongMaterial({
      color: 0x16a34a,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    });
    growthMesh = new THREE.Mesh(growthGeom, growthMat);
    growthMesh.position.set(
      normalize(Config.THRESHOLDS.GROWTH, 'income') + (BOUNDS.income.size - normalize(Config.THRESHOLDS.GROWTH, 'income')) / 2,
      BOUNDS.coord.size * 0.75,
      BOUNDS.skills.size * 0.65
    );
    scene.add(growthMesh);
  }

  function createThresholdPlanes() {
    // TRAP threshold plane at ₹8,000
    const trapPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(BOUNDS.coord.size, BOUNDS.skills.size),
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
    );
    trapPlane.position.set(normalize(Config.THRESHOLDS.TRAP, 'income'), BOUNDS.coord.size / 2, BOUNDS.skills.size / 2);
    trapPlane.rotation.y = Math.PI / 2;
    scene.add(trapPlane);
    thresholdPlanes.push(trapPlane);

    // GROWTH threshold plane at ₹15,000
    const growthPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(BOUNDS.coord.size, BOUNDS.skills.size),
      new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
    );
    growthPlane.position.set(normalize(Config.THRESHOLDS.GROWTH, 'income'), BOUNDS.coord.size / 2, BOUNDS.skills.size / 2);
    growthPlane.rotation.y = Math.PI / 2;
    scene.add(growthPlane);
    thresholdPlanes.push(growthPlane);
  }

  function createTrajectory() {
    const material = new THREE.LineBasicMaterial({ 
      color: 0x1e40af, 
      linewidth: 2,
      transparent: true,
      opacity: 0.9,
      depthTest: false
    });
    const geometry = new THREE.BufferGeometry();
    trajectoryLine = new THREE.Line(geometry, material);
    trajectoryLine.frustumCulled = false; // never cull the trail
    trajectoryLine.renderOrder = 999;      // draw on top of the transparent planes
    scene.add(trajectoryLine);
  }

  function createCurrentPoint() {
    // Main point
    const geometry = new THREE.SphereGeometry(0.25, 24, 24);
    const material = new THREE.MeshPhongMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.5
    });
    currentPoint = new THREE.Mesh(geometry, material);
    currentPoint.position.set(0, 0, 0);
    scene.add(currentPoint);

    // Glow
    const glowGeom = new THREE.SphereGeometry(0.4, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.3
    });
    const glow = new THREE.Mesh(glowGeom, glowMat);
    currentPoint.add(glow);
  }

  function update(state) {
    if (!initialized || !state) return;

    const x = normalize(state.income || 0, 'income');
    const y = normalize(state.coordination || 0, 'coord');
    const z = normalize(state.skills || 0, 'skills');
    
    const point = new THREE.Vector3(x, y, z);

    // Add to trail
    trailPoints.push(point.clone());
    if (trailPoints.length > 2000) trailPoints.shift(); // full trajectory kept (2000-pt safety cap only)

    // Update trajectory line — rebuild from the actual points each step. The previous pre-allocated
    // buffer + setDrawRange ("FIX N7") rendered intermittently: unused slots sat at the origin and the
    // draw-range wasn't reliably honoured, so the trail vanished on some trajectories. setFromPoints sizes
    // the geometry exactly and computeBoundingSphere keeps it renderable. 100 pts/step is cheap.
    if (trailPoints.length > 1) {
      trajectoryLine.geometry.setFromPoints(trailPoints);
      trajectoryLine.geometry.setDrawRange(0, trailPoints.length); // draw all points (was stuck at 0)
      trajectoryLine.geometry.computeBoundingSphere();
    }

    // Update current point position
    currentPoint.position.copy(point);

    // Color based on state
    const stateColors = {
      'TRAP': 0xdc2626,
      'TRANSITION': 0xf59e0b,
      'GROWTH': 0x16a34a
    };
    const color = stateColors[state.attractorState] || 0xf59e0b;
    currentPoint.material.color.setHex(color);
    currentPoint.material.emissive.setHex(color);
    currentPoint.children[0].material.color.setHex(color);

    // Highlight active basin
    trapMesh.material.opacity = state.attractorState === 'TRAP' ? 0.25 : 0.1;
    transMesh.material.opacity = state.attractorState === 'TRANSITION' ? 0.2 : 0.08;
    growthMesh.material.opacity = state.attractorState === 'GROWTH' ? 0.25 : 0.1;
  }

  function normalize(value, axis) {
    const b = BOUNDS[axis];
    // FIX #7: Log scale for income axis
    if (b.logScale) {
      const logMin = Math.log(Math.max(1, b.min));
      const logMax = Math.log(Math.max(1, b.max));
      const logVal = Math.log(Math.max(1, value));
      return Math.max(0, Math.min(b.size, ((logVal - logMin) / (logMax - logMin)) * b.size));
    }
    return Math.max(0, Math.min(b.size, ((value - b.min) / (b.max - b.min)) * b.size));
  }

  function addMouseControls() {
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };

    renderer.domElement.addEventListener('mousedown', (e) => {
      isDragging = true;
      autoRotate = false;
      prevMouse = { x: e.offsetX, y: e.offsetY };
    });

    renderer.domElement.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const deltaX = e.offsetX - prevMouse.x;
      const deltaY = e.offsetY - prevMouse.y;
      
      // Rotate around center
      camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), deltaX * 0.01);
      camera.position.y = Math.max(3, Math.min(20, camera.position.y - deltaY * 0.05));
      camera.lookAt(6, 4, 4);
      
      prevMouse = { x: e.offsetX, y: e.offsetY };
    });

    renderer.domElement.addEventListener('mouseup', () => isDragging = false);
    renderer.domElement.addEventListener('mouseleave', () => isDragging = false);

    renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const dist = camera.position.length();
      const newDist = dist * (1 + e.deltaY * 0.001);
      if (newDist > 10 && newDist < 40) {
        camera.position.setLength(newDist);
      }
    }, { passive: false });
  }

  function animate() {
    if (!initialized) return;
    animationId = requestAnimationFrame(animate);

    if (autoRotate) {
      camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.003);
      camera.lookAt(6, 4, 4);
    }

    // Pulse current point
    if (currentPoint) {
      const scale = 1 + Math.sin(Date.now() * 0.005) * 0.15;
      currentPoint.scale.set(scale, scale, scale);
    }

    renderer.render(scene, camera);
  }

  function onResize() {
    if (!container || !initialized) return;
    const w = container.clientWidth || 400;
    const h = container.clientHeight || 200;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function reset() {
    trailPoints = [];
    if (trajectoryLine && trajectoryLine.geometry) {
      trajectoryLine.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    }
    if (currentPoint) {
      currentPoint.position.set(0, 0, 0);
    }
  }

  function resetView() {
    camera.position.set(20, 12, 16);
    camera.lookAt(6, 4, 4);
    autoRotate = true;
  }

  function toggleRotate() {
    autoRotate = !autoRotate;
    return autoRotate;
  }

  // FIX #47: Resilience Landscape (Potential Surface)
  // Ball-in-cup visualization: trap basin vs growth basin with tipping ridge
  let landscapeMesh = null, landscapeBall = null;
  function showResilienceLandscape(S, policyIntensity = 0) {
    if (!scene) return;
    
    // Remove old landscape elements
    if (landscapeMesh) { scene.remove(landscapeMesh); landscapeMesh.geometry.dispose(); landscapeMesh.material.dispose(); }
    if (landscapeBall) { scene.remove(landscapeBall); landscapeBall.geometry.dispose(); landscapeBall.material.dispose(); }
    // Hide trajectory elements
    if (trajectoryLine) trajectoryLine.visible = false;
    if (currentPoint) currentPoint.visible = false;
    
    const gridSize = 40;
    const geometry = new THREE.PlaneGeometry(12, 8, gridSize, gridSize);
    const positions = geometry.attributes.position.array;
    
    // Potential function: V(income, coordination) = double-well potential
    // Trap basin at low income/coord, Growth basin at high income/coord
    // Policy lowers the ridge between basins
    const trapIncome = 0.2, growthIncome = 0.75; // normalized positions
    const ridgeHeight = Math.max(0.3, 1.5 - policyIntensity * 0.8); // Policy lowers ridge
    
    for (let i = 0; i <= gridSize; i++) {
      for (let j = 0; j <= gridSize; j++) {
        const idx = (i * (gridSize + 1) + j) * 3;
        const x = j / gridSize; // income (0-1)
        const z = i / gridSize; // coordination (0-1)
        
        // Double-well potential surface
        const trapWell = -1.2 * Math.exp(-((x - trapIncome)**2 + (z - 0.2)**2) / 0.08);
        const growthWell = -0.8 * Math.exp(-((x - growthIncome)**2 + (z - 0.7)**2) / 0.12);
        const ridge = ridgeHeight * Math.exp(-((x - 0.45)**2) / 0.15) * (1 - z * 0.5);
        const slope = 0.3 * (1 - x); // General slope toward growth
        
        const potential = trapWell + growthWell + ridge + slope;
        
        positions[idx] = x * 12;     // X: income
        positions[idx + 1] = potential * 3 + 4; // Y: potential height
        positions[idx + 2] = z * 8;   // Z: coordination
      }
    }
    geometry.computeVertexNormals();
    
    // Color by potential height (blue=deep basin, red=high ridge)
    const colors = new Float32Array((gridSize + 1) * (gridSize + 1) * 3);
    for (let i = 0; i < positions.length / 3; i++) {
      const h = (positions[i * 3 + 1] - 1) / 6; // normalize height
      colors[i * 3] = Math.min(1, h + 0.3);     // R
      colors[i * 3 + 1] = 0.3 - h * 0.2;        // G
      colors[i * 3 + 2] = Math.max(0, 0.8 - h);  // B
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const material = new THREE.MeshPhongMaterial({
      vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.85,
      shininess: 30, flatShading: false
    });
    landscapeMesh = new THREE.Mesh(geometry, material);
    scene.add(landscapeMesh);
    
    // Add ball at current state position
    if (S) {
      const normIncome = Math.log(S.income / 2000) / Math.log(25000 / 2000);
      const normCoord = S.coordination;
      const ballGeom = new THREE.SphereGeometry(0.25, 16, 16);
      const ballMat = new THREE.MeshPhongMaterial({ color: 0xffd700, emissive: 0x996600 });
      landscapeBall = new THREE.Mesh(ballGeom, ballMat);
      
      // Find surface height at ball position
      const bx = Math.max(0, Math.min(1, normIncome));
      const bz = Math.max(0, Math.min(1, normCoord));
      const trapW = -1.2 * Math.exp(-((bx - trapIncome)**2 + (bz - 0.2)**2) / 0.08);
      const growthW = -0.8 * Math.exp(-((bx - growthIncome)**2 + (bz - 0.7)**2) / 0.12);
      const ridgeH = ridgeHeight * Math.exp(-((bx - 0.45)**2) / 0.15) * (1 - bz * 0.5);
      const slopeH = 0.3 * (1 - bx);
      const surfaceY = (trapW + growthW + ridgeH + slopeH) * 3 + 4;
      
      landscapeBall.position.set(bx * 12, surfaceY + 0.3, bz * 8);
      scene.add(landscapeBall);
    }
  }

  // FIX #48: Bifurcation Surface
  // Shows fold catastrophe: how equilibrium income changes with coordination × policy intensity
  let bifurcationMesh = null, bifurcationLine = null, bifurcationBall = null;
  function showBifurcationSurface(S, policyIntensity) {
    if (!scene) return;
    
    // Remove old bifurcation elements
    if (bifurcationMesh) { scene.remove(bifurcationMesh); bifurcationMesh.geometry.dispose(); bifurcationMesh.material.dispose(); }
    if (bifurcationLine) { scene.remove(bifurcationLine); bifurcationLine.geometry.dispose(); bifurcationLine.material.dispose(); }
    if (bifurcationBall) { scene.remove(bifurcationBall); bifurcationBall.geometry.dispose(); bifurcationBall.material.dispose(); }
    if (trajectoryLine) trajectoryLine.visible = false;
    if (currentPoint) currentPoint.visible = false;
    
    const gridSize = 40;
    const geometry = new THREE.PlaneGeometry(12, 8, gridSize, gridSize);
    const positions = geometry.attributes.position.array;
    
    // Bifurcation surface: income_eq = f(coordination, policyIntensity)
    // Uses cusp catastrophe normal form: x^3 - a*x - b = 0
    // where x=income, a=coordination, b=policyIntensity
    
    for (let i = 0; i <= gridSize; i++) {
      for (let j = 0; j <= gridSize; j++) {
        const idx = (i * (gridSize + 1) + j) * 3;
        const coord = j / gridSize;       // coordination (0-1)
        const policy = i / gridSize;      // policy intensity (0-1)
        
        // Cusp catastrophe: equilibrium income surface
        // Multiple equilibria exist in the fold region
        const a = coord * 3 - 1;  // bifurcation parameter a
        const b = policy * 2 - 0.5; // bifurcation parameter b
        
        // Approximate the upper sheet (stable growth equilibrium)
        const upper = 0.5 + 0.5 * Math.tanh(2 * (a + b));
        // With fold: income jumps when crossing critical coordination
        const critCoord = 0.35 - policy * 0.15; // Critical threshold depends on policy
        const foldEffect = coord > critCoord ? 
          upper * (1 + 0.3 * Math.exp(-(Math.pow((coord - critCoord) / 0.1, 2)))) : 
          upper * 0.3;
        
        positions[idx] = coord * 12;          // X: coordination
        positions[idx + 1] = foldEffect * 8;  // Y: equilibrium income (normalized)
        positions[idx + 2] = policy * 8;      // Z: policy intensity
      }
    }
    geometry.computeVertexNormals();
    
    // Color: green=growth equilibrium, red=trap equilibrium
    const colors = new Float32Array((gridSize + 1) * (gridSize + 1) * 3);
    for (let i = 0; i < positions.length / 3; i++) {
      const h = positions[i * 3 + 1] / 8;
      colors[i * 3] = 1 - h;          // R (high when trapped)
      colors[i * 3 + 1] = h * 0.8;    // G (high when growing)
      colors[i * 3 + 2] = 0.2;        // B
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const material = new THREE.MeshPhongMaterial({
      vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.85,
      shininess: 40
    });
    bifurcationMesh = new THREE.Mesh(geometry, material);
    scene.add(bifurcationMesh);
    
    // Add fold line (critical coordination threshold)
    const foldPoints = [];
    for (let i = 0; i <= 20; i++) {
      const policy = i / 20;
      const critCoord = 0.35 - policy * 0.15;
      foldPoints.push(new THREE.Vector3(critCoord * 12, 3.5, policy * 8));
    }
    const foldGeom = new THREE.BufferGeometry().setFromPoints(foldPoints);
    const foldMat = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
    bifurcationLine = new THREE.Line(foldGeom, foldMat);
    scene.add(bifurcationLine);

    // FIX R5: Add gold state marker ball at current (coordination, policyIntensity) position
    if (S) {
      const pi = typeof policyIntensity === 'number' ? policyIntensity : 0;
      const coord = Math.max(0, Math.min(1, S.coordination || 0));
      const policy = Math.max(0, Math.min(1, pi));

      // Compute surface height at current position (same formula as surface generation)
      const a = coord * 3 - 1;
      const b = policy * 2 - 0.5;
      const upper = 0.5 + 0.5 * Math.tanh(2 * (a + b));
      const critCoord = 0.35 - policy * 0.15;
      const foldEffect = coord > critCoord ?
        upper * (1 + 0.3 * Math.exp(-(Math.pow((coord - critCoord) / 0.1, 2)))) :
        upper * 0.3;

      const ballGeom = new THREE.SphereGeometry(0.25, 16, 16);
      const ballMat = new THREE.MeshPhongMaterial({ color: 0xffd700, emissive: 0x996600 });
      bifurcationBall = new THREE.Mesh(ballGeom, ballMat);
      bifurcationBall.position.set(coord * 12, foldEffect * 8 + 0.3, policy * 8);
      scene.add(bifurcationBall);
    }
  }

  // Switch visualization mode
  let currentMode = 'trajectory';
  function setMode(mode, S, policyIntensity) {
    currentMode = mode;
    // Show/hide elements based on mode
    if (trajectoryLine) trajectoryLine.visible = mode === 'trajectory';
    if (currentPoint) currentPoint.visible = mode === 'trajectory';
    if (landscapeMesh) { scene.remove(landscapeMesh); landscapeMesh.geometry.dispose(); landscapeMesh.material.dispose(); landscapeMesh = null; }
    if (landscapeBall) { scene.remove(landscapeBall); landscapeBall.geometry.dispose(); landscapeBall.material.dispose(); landscapeBall = null; }
    if (bifurcationMesh) { scene.remove(bifurcationMesh); bifurcationMesh.geometry.dispose(); bifurcationMesh.material.dispose(); bifurcationMesh = null; }
    if (bifurcationLine) { scene.remove(bifurcationLine); bifurcationLine.geometry.dispose(); bifurcationLine.material.dispose(); bifurcationLine = null; }
    if (bifurcationBall) { scene.remove(bifurcationBall); bifurcationBall.geometry.dispose(); bifurcationBall.material.dispose(); bifurcationBall = null; }
    
    if (mode === 'landscape') {
      showResilienceLandscape(S, policyIntensity || 0);
    } else if (mode === 'bifurcation') {
      showBifurcationSurface(S, policyIntensity || 0);
    }
    // 'trajectory' mode uses existing update() logic
  }

  function destroy() {
    // FIX N6: Full cleanup — dispose ALL geometries, materials, textures; remove listener
    if (animationId) cancelAnimationFrame(animationId);
    if (scene) {
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      });
    }
    if (landscapeMesh) { landscapeMesh.geometry.dispose(); landscapeMesh.material.dispose(); landscapeMesh = null; }
    if (landscapeBall) { landscapeBall.geometry.dispose(); landscapeBall.material.dispose(); landscapeBall = null; }
    if (bifurcationMesh) { bifurcationMesh.geometry.dispose(); bifurcationMesh.material.dispose(); bifurcationMesh = null; }
    if (bifurcationLine) { bifurcationLine.geometry.dispose(); bifurcationLine.material.dispose(); bifurcationLine = null; }
    if (bifurcationBall) { bifurcationBall.geometry.dispose(); bifurcationBall.material.dispose(); bifurcationBall = null; }
    if (renderer) renderer.dispose();
    window.removeEventListener('resize', onResize);
    trailPoints = [];
    initialized = false;
  }

  return { init, update, reset, resetView, toggleRotate, destroy, setMode, showResilienceLandscape, showBifurcationSurface, get currentMode() { return currentMode; } };
})();
