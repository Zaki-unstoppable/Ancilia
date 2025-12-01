// @ts-nocheck

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ======================================================================================
// CONFIGURATION
// ======================================================================================

const NUM_DUST = 260;
const HEX_RADIUS = 0.45;
const ELECTRODE_SEGMENTS = 12;

const FIELD_BASE = 1.2e5;
const FIELD_TRAVEL = 6.5e4;
const FIELD_LATERAL = 3.1e4;
const WAVE_FREQ = 42;
const PHASE_SHIFT = (2 * Math.PI) / 3;

const GRAV = 3.71;
const DRAG = 0.45;

let dustEnabled = true;   // <--- Toggle with D

// ======================================================================================
// HEX HELPERS
// ======================================================================================

function hexVerts(r = HEX_RADIUS) {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    out.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)));
  }
  return out;
}

function insideHex(pos: THREE.Vector3) {
  const verts = hexVerts();
  let sign = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const cross =
      (b.x - a.x) * (pos.z - a.y) - (b.y - a.y) * (pos.x - a.x);
    if (cross === 0) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

function randomHexPoint() {
  while (true) {
    const x = (Math.random() * 2 - 1) * HEX_RADIUS * 0.87;
    const z = (Math.random() * 2 - 1) * HEX_RADIUS * 0.87;
    const v = new THREE.Vector3(x, 0.004, z);
    if (insideHex(v)) return v;
  }
}

// ======================================================================================
// ELECTRIC FIELD MODEL
// ======================================================================================

function fieldAt(pos: THREE.Vector3, t: number) {
  const ang = Math.atan2(pos.z, pos.x);
  const rad = new THREE.Vector2(pos.x, pos.z).length() / HEX_RADIUS;

  const laneIndex = Math.floor(
    ((ang + Math.PI) / (2 * Math.PI)) * ELECTRODE_SEGMENTS
  );

  const phase = t * 2 * Math.PI * WAVE_FREQ + laneIndex * PHASE_SHIFT;

  const Ey = FIELD_BASE + FIELD_TRAVEL * Math.sin(phase);

  const tangMag = FIELD_LATERAL * Math.cos(phase) * (0.4 + 0.6 * rad);
  const tangent = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang));

  return new THREE.Vector3(tangent.x * tangMag, Ey, tangent.z * tangMag);
}

// ======================================================================================
// DUST PARTICLE
// ======================================================================================

class DustParticle {
  mesh: THREE.Mesh;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  q = 2e-15 + Math.random() * 9e-14; // charge

  constructor(scene: THREE.Scene, geom: THREE.SphereGeometry, mat: THREE.Material) {
    this.mesh = new THREE.Mesh(geom, mat);
    scene.add(this.mesh);
    this.respawn();
  }

  respawn() {
    this.pos.copy(randomHexPoint());
    this.vel.set(
      (Math.random() - 0.5) * 0.02,
      0,
      (Math.random() - 0.5) * 0.02
    );
    this.mesh.scale.setScalar(1);
  }

  step(dt: number, t: number) {
    if (!dustEnabled) return;

    const F = fieldAt(this.pos, t);
    const ax = (this.q * F.x) / 1e-8;
    const ay = (this.q * F.y) / 1e-8 - GRAV;
    const az = (this.q * F.z) / 1e-8;

    this.vel.x += ax * dt;
    this.vel.y += ay * dt;
    this.vel.z += az * dt;

    this.vel.multiplyScalar(1 - DRAG * dt);
    this.pos.addScaledVector(this.vel, dt);

    if (this.pos.y < 0.0) {
      this.pos.y = 0.0;
      this.vel.y *= -0.2;
    }

    if (!insideHex(this.pos)) this.respawn();

    // speed-based stretching
    const s = 1 + this.vel.length() * 6;
    this.mesh.scale.set(1, s, 1);

    this.mesh.position.copy(this.pos);
  }
}

// ======================================================================================
// MAIN DEVICE + DUST SCENE
// ======================================================================================

export function initDeviceDustDemo(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04070d);

  const cam = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    50
  );
  cam.position.set(3.2, 2.6, 3.3);

  const controls = new THREE.OrbitControls(cam, renderer.domElement);
  controls.target.set(0, 0.2, 0);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.38));

  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(5, 8, 6);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x88aaff, 0.4);
  rim.position.set(-4, 5, -5);
  scene.add(rim);

  // ---------------------------------------------------------------------------------
  // DEVICE BASE (ultra-realistic panel)
  // ---------------------------------------------------------------------------------

  const panelGeom = new THREE.CircleGeometry(HEX_RADIUS, 6);
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x151a21,
    metalness: 0.75,
    roughness: 0.32,
  });
  const panel = new THREE.Mesh(panelGeom, panelMat);
  panel.rotation.x = -Math.PI / 2;
  panel.position.y = 0;
  scene.add(panel);

  // Bezel
  const bezelGeom = new THREE.RingGeometry(
    HEX_RADIUS * 0.96,
    HEX_RADIUS * 1.1,
    6
  );
  const bezelMat = new THREE.MeshStandardMaterial({
    color: 0x3f4653,
    metalness: 0.85,
    roughness: 0.25
  });
  const bezel = new THREE.Mesh(bezelGeom, bezelMat);
  bezel.rotation.x = -Math.PI / 2;
  bezel.position.y = 0.001;
  scene.add(bezel);

  // Electrodes
  const laneMat = new THREE.MeshStandardMaterial({
    color: 0xffd080,
    metalness: 1.0,
    roughness: 0.25,
    emissive: new THREE.Color(0x331b00),
    emissiveIntensity: 0.2
  });

  const lanes = new THREE.Group();
  for (let i = 0; i < ELECTRODE_SEGMENTS; i++) {
    const g = new THREE.BoxGeometry(HEX_RADIUS * 1.2, 0.002, 0.01);
    const m = new THREE.Mesh(g, laneMat);
    m.rotation.y = (i / ELECTRODE_SEGMENTS) * Math.PI * 2 + Math.PI / 2;
    m.position.y = 0.003;
    lanes.add(m);
  }
  scene.add(lanes);

  // ---------------------------------------------------------------------------------
  // DUST
  // ---------------------------------------------------------------------------------

  const dustGeom = new THREE.SphereGeometry(0.006, 12, 12);
  const dustMat = new THREE.MeshStandardMaterial({
    color: 0xf7eadc,
    metalness: 0,
    roughness: 0.65
  });

  const dust: DustParticle[] = [];
  for (let i = 0; i < NUM_DUST; i++) {
    dust.push(new DustParticle(scene, dustGeom, dustMat));
  }

  // ---------------------------------------------------------------------------------
  // TOGGLE
  // ---------------------------------------------------------------------------------

  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'd') {
      dustEnabled = !dustEnabled;
      console.log("Dust enabled?", dustEnabled);
    }
  });

  // ---------------------------------------------------------------------------------
  // ANIMATION LOOP
  // ---------------------------------------------------------------------------------

  const clock = new THREE.Clock();

  function animate() {
    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    for (const d of dust) d.step(dt, t);

    controls.update();
    renderer.render(scene, cam);
  }

  renderer.setAnimationLoop(animate);

  // Resize
  window.addEventListener('resize', () => {
    renderer.setSize(container.clientWidth, container.clientHeight);
    cam.aspect = container.clientWidth / container.clientHeight;
    cam.updateProjectionMatrix();
  });
}
