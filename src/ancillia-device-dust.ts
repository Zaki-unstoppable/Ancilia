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
const WIND_DRIFT = new THREE.Vector3(0.06, 0, -0.04);
const TRENCH_RADIUS = HEX_RADIUS * 0.08;

let dustEnabled = true; // <--- Toggle with D

// ======================================================================================
// MATERIAL HELPERS
// ======================================================================================

function brushedNormalMap(size = 512, intensity = 0.3) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const n = Math.sin((x / size) * Math.PI * 24 + Math.random() * 0.35);
      const v = 128 + n * 64 * intensity + Math.random() * 6;
      img.data[idx] = 128;
      img.data[idx + 1] = v;
      img.data[idx + 2] = 128;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.repeat.set(2, 2);
  return tex;
}

function microNoiseRoughness(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 130 + Math.random() * 100;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

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

function trenchField(pos: THREE.Vector3) {
  const radial = new THREE.Vector2(pos.x, pos.z).length();
  if (radial > HEX_RADIUS * 0.35) return new THREE.Vector3();
  const dir = new THREE.Vector3(-pos.x, -0.003, -pos.z);
  const falloff = THREE.MathUtils.smoothstep(radial, 0, HEX_RADIUS * 0.35);
  dir.multiplyScalar((0.5 - falloff) * 2.1e4);
  return dir;
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

    const F = fieldAt(this.pos, t).add(trenchField(this.pos));
    const ax = (this.q * F.x) / 1e-8;
    const ay = (this.q * F.y) / 1e-8 - GRAV;
    const az = (this.q * F.z) / 1e-8;

    // ambient martian breeze + panel tilt drift
    const drift = WIND_DRIFT.clone().multiplyScalar(0.2 + 0.8 * Math.abs(Math.sin(t * 0.35)));

    this.vel.x += (ax + drift.x) * dt;
    this.vel.y += ay * dt;
    this.vel.z += (az + drift.z) * dt;

    this.vel.multiplyScalar(1 - DRAG * dt);
    this.pos.addScaledVector(this.vel, dt);

    if (this.pos.y < 0.0) {
      this.pos.y = 0.0;
      this.vel.y *= -0.2;
    }

    if (!insideHex(this.pos)) this.respawn();

    // speed-based stretching
    const s = 1 + this.vel.length() * 6.5;
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

  const controls = new OrbitControls(cam, renderer.domElement);
  controls.target.set(0, 0.2, 0);

  // Lights
  scene.add(new THREE.AmbientLight(0xe5d2c2, 0.55));

  const key = new THREE.DirectionalLight(0xfff4e0, 1.2);
  key.position.set(5, 8, 6);
  key.castShadow = false;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x88aaff, 0.55);
  rim.position.set(-4, 5, -5);
  scene.add(rim);

  const labBounce = new THREE.HemisphereLight(0xfff2d5, 0x19202a, 0.4);
  scene.add(labBounce);

  // ---------------------------------------------------------------------------------
  // DEVICE BASE (ultra-realistic panel)
  // ---------------------------------------------------------------------------------

  const panelGeom = new THREE.CircleGeometry(HEX_RADIUS, 64);
  const panelNormal = brushedNormalMap();
  const panelRough = microNoiseRoughness();
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x1c232d,
    metalness: 0.9,
    roughness: 0.26,
    normalMap: panelNormal ?? undefined,
    roughnessMap: panelRough ?? undefined,
    normalScale: new THREE.Vector2(0.7, 1.1),
  });
  const panel = new THREE.Mesh(panelGeom, panelMat);
  panel.rotation.x = -Math.PI / 2;
  panel.position.y = 0;
  scene.add(panel);

  // Bezel
  const bezelGeom = new THREE.RingGeometry(HEX_RADIUS * 0.96, HEX_RADIUS * 1.1, 64);
  const bezelMat = new THREE.MeshStandardMaterial({
    color: 0x5c6473,
    metalness: 0.94,
    roughness: 0.2,
    normalMap: panelNormal ?? undefined,
    normalScale: new THREE.Vector2(0.5, 0.9),
  });
  const bezel = new THREE.Mesh(bezelGeom, bezelMat);
  bezel.rotation.x = -Math.PI / 2;
  bezel.position.y = 0.001;
  scene.add(bezel);

  // Layered dielectric rings to catch rim light
  const layers = new THREE.Group();
  const layerOffsets = [0.003, 0.004, 0.005];
  layerOffsets.forEach((off, i) => {
    const g = new THREE.RingGeometry(HEX_RADIUS * (0.25 + i * 0.08), HEX_RADIUS * (0.9 - i * 0.06), 72);
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color().setHSL(0.56 + i * 0.03, 0.35, 0.62),
      metalness: 0.08,
      roughness: 0.5,
      transparent: true,
      opacity: 0.18,
      transmission: 0.35,
      thickness: 0.002,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = off;
    layers.add(mesh);
  });
  scene.add(layers);

  const coverGlass = new THREE.Mesh(
    new THREE.CircleGeometry(HEX_RADIUS * 0.94, 64),
    new THREE.MeshPhysicalMaterial({
      color: 0x9fb7d8,
      transmission: 0.8,
      roughness: 0.08,
      metalness: 0.05,
      thickness: 0.006,
      reflectivity: 0.35,
      envMapIntensity: 0.4,
      transparent: true,
      opacity: 0.72,
    })
  );
  coverGlass.rotation.x = -Math.PI / 2;
  coverGlass.position.y = 0.006;
  coverGlass.material.onBeforeCompile = (shader) => {
    shader.uniforms.chromaticSpread = { value: 0.18 };
    shader.uniforms.edgeFalloff = { value: 0.65 };
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <output_fragment>',
      `
        #include <output_fragment>
        float vAngle = abs(dot(normalize(vNormal), normalize(vViewPosition)));
        float spread = pow(1.0 - vAngle, 1.2) * chromaticSpread;
        vec3 tint = vec3(1.0 + spread * 0.6, 1.0, 1.0 + spread * -0.4);
        gl_FragColor.rgb *= tint;
        gl_FragColor.a *= mix(edgeFalloff, 1.0, vAngle);
      `
    );
  };
  scene.add(coverGlass);

  // Electrodes
  const laneMat = new THREE.ShaderMaterial({
    uniforms: {
      baseColor: { value: new THREE.Color(0xe1b56b) },
      thickness: { value: 420e-9 },
      iorLayer: { value: 1.5 },
      iorSubstrate: { value: 1.9 },
      emissiveBoost: { value: 0.22 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      uniform vec3 baseColor;
      uniform float thickness;
      uniform float iorLayer;
      uniform float iorSubstrate;
      uniform float emissiveBoost;

      float fresnelReflectance(float cosI, float n1, float n2) {
        float r0 = (n1 - n2) / (n1 + n2);
        r0 = r0 * r0;
        return r0 + (1.0 - r0) * pow(1.0 - cosI, 5.0);
      }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vViewDir);
        float cosI = clamp(dot(N, V), 0.0, 1.0);

        float lambda = 550e-9;
        float phase = 4.0 * 3.14159 * thickness * iorLayer / lambda * cosI;

        float shiftR = 0.5 + 0.5 * sin(phase * 1.00 + 0.3);
        float shiftG = 0.5 + 0.5 * sin(phase * 1.18 + 1.1);
        float shiftB = 0.5 + 0.5 * sin(phase * 1.35 + 2.3);

        vec3 film = baseColor * vec3(shiftR, shiftG, shiftB);
        float F = fresnelReflectance(cosI, 1.0, iorLayer);
        vec3 color = mix(baseColor, film, F);
        gl_FragColor = vec4(color + film * emissiveBoost, 1.0);
      }
    `,
    transparent: false,
    metalness: 1.0,
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

  // recessed trench collector visualization
  const trenchGeom = new THREE.RingGeometry(TRENCH_RADIUS * 0.7, TRENCH_RADIUS, 48);
  const trenchMat = new THREE.MeshStandardMaterial({
    color: 0x1c2a3a,
    emissive: 0x0c1a33,
    emissiveIntensity: 0.4,
    metalness: 0.4,
    roughness: 0.55,
  });
  const trench = new THREE.Mesh(trenchGeom, trenchMat);
  trench.rotation.x = -Math.PI / 2;
  trench.position.y = 0.001;
  scene.add(trench);

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
