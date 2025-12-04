// @ts-nocheck

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EdgesGeometry, LineBasicMaterial, LineSegments } from 'three';
import { enhanceAncilliaDevice } from './ancillia-enhancements';

// ─────────────────────────────────────────────────────────────
// Geometric + stack constants (hex module)
// ─────────────────────────────────────────────────────────────

const HEX_FLAT = 0.38;            // flat-to-flat (m)
const HEX_POINT = 0.44;           // point-to-point (m)
const HEX_APOTHEM = HEX_FLAT / 2; // center → flat
const HEX_RADIUS = HEX_POINT / 2; // center → vertex

const BASE_THICKNESS = 0.0042;       // chassis slab
const SUBSTRATE_THICKNESS = 0.0016;  // glass dielectric
const PANEL_THICKNESS = 0.0025;      // encapsulated electrodes
const COVER_THICKNESS = 0.0014;      // protective glass
const COVER_OFFSET = 0.0009;         // visible air gap

const TRENCH_INNER_SCALE = 1.02;
const TRENCH_OUTER_SCALE = 1.12;
const CARTRIDGE_HEIGHT = 0.0115;

const PANEL_SURFACE_Y =
  BASE_THICKNESS +
  SUBSTRATE_THICKNESS +
  PANEL_THICKNESS; // nominal electrode surface

// Radial traveling-wave electrode pattern
const ELECTRODE_SEGMENTS = 12;

// ─────────────────────────────────────────────────────────────
// Dust physics + field constants
// ─────────────────────────────────────────────────────────────

const NUM_DUST_PARTICLES = 260;
const DUST_RADIUS_MIN = 8e-6;
const DUST_RADIUS_MAX = 38e-6;
const DUST_DENSITY = 3100; // kg/m^3 (basaltic simulant)
const DUST_CHARGE_MIN = 2e-15;
const DUST_CHARGE_MAX = 9e-14;
const ADHESION_PER_AREA = 50; // N/m^2
const MARTIAN_GRAVITY = 3.71; // m/s^2

const FIELD_BASE = 1.2e5;    // V/m vertical lift
const FIELD_TRAVEL = 6.5e4;  // V/m traveling component
const FIELD_LATERAL = 3.1e4; // V/m tangential push
const WAVE_FREQUENCY = 42;   // Hz (visual scale)
const PHASE_SHIFT = (2 * Math.PI) / 3;
const DRAG_COEFF = 0.45;

const DIRECTIONAL_DRIFT = new THREE.Vector3(0.15, 0, -0.08);

// Bounds for respawn / collection
const BOUNDS_SCALE = TRENCH_OUTER_SCALE * 1.08;
const MAX_DUST_HEIGHT = 2.5;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type ModuleMaterials = {
  cover: THREE.MeshPhysicalMaterial;
  substrate: THREE.MeshPhysicalMaterial;
  panel: THREE.MeshStandardMaterial;
  lanes: THREE.MeshStandardMaterial;
  frame: THREE.MeshStandardMaterial;
  chassis: THREE.MeshStandardMaterial;
  rail: THREE.MeshStandardMaterial;
  connector: THREE.MeshStandardMaterial;
  docking: THREE.MeshStandardMaterial;
  conduit: THREE.MeshStandardMaterial;
};

type MaterialPreset = {
  color?: number;
  metalness?: number;
  roughness?: number;
  transmission?: number;
  opacity?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  envMapIntensity?: number;
  emissive?: number;
  emissiveIntensity?: number;
  ior?: number;
  bumpScale?: number;
};

type ModePresets = {
  cover: MaterialPreset;
  substrate: MaterialPreset;
  panel: MaterialPreset;
  lanes: MaterialPreset;
  frame: MaterialPreset;
  chassis: MaterialPreset;
  rail: MaterialPreset;
  connector: MaterialPreset;
  docking: MaterialPreset;
  conduit: MaterialPreset;
};

// ─────────────────────────────────────────────────────────────
// Visual modes: concept vs blueprint
// ─────────────────────────────────────────────────────────────

const MODE_PRESETS: Record<'concept' | 'blueprint', ModePresets> = {
  blueprint: {
    cover: {
      color: 0xd4e3ff,
      transmission: 0.97,
      opacity: 0.16,
      roughness: 0.03,
      metalness: 0.02,
      clearcoat: 0.95,
      clearcoatRoughness: 0.04,
      ior: 1.52,
      envMapIntensity: 1.8
    },
    substrate: {
      color: 0x7ba2dc,
      transmission: 0.7,
      opacity: 0.9,
      roughness: 0.15,
      metalness: 0.03,
      clearcoat: 0.45,
      clearcoatRoughness: 0.23,
      ior: 1.48,
      envMapIntensity: 1.4
    },
    panel: {
      color: 0x9fb4dd,
      metalness: 0.75,
      roughness: 0.32,
      bumpScale: 0.09,
      envMapIntensity: 1.1
    },
    lanes: {
      color: 0xf4c676,
      metalness: 0.98,
      roughness: 0.16,
      emissive: 0x331c00,
      emissiveIntensity: 0.4
    },
    frame: { color: 0x2b3038, metalness: 0.9, roughness: 0.28 },
    chassis: { color: 0x151921, metalness: 0.92, roughness: 0.4 },
    rail: { color: 0x313741, metalness: 0.9, roughness: 0.32 },
    connector: {
      color: 0xf4b654,
      metalness: 1.0,
      roughness: 0.26,
      emissive: 0x3b2400,
      emissiveIntensity: 0.25
    },
    docking: {
      color: 0x5e6672,
      metalness: 0.8,
      roughness: 0.34
    },
    conduit: {
      color: 0x171b22,
      metalness: 0.5,
      roughness: 0.65
    }
  },
  concept: {
    cover: {
      color: 0xeaf1ff,
      transmission: 0.8,
      opacity: 0.3,
      roughness: 0.06,
      metalness: 0.06,
      clearcoat: 0.55,
      clearcoatRoughness: 0.2,
      ior: 1.49,
      envMapIntensity: 1.0
    },
    substrate: {
      color: 0xa5bddc,
      transmission: 0.55,
      opacity: 0.92,
      roughness: 0.23,
      metalness: 0.04,
      clearcoat: 0.25,
      clearcoatRoughness: 0.3,
      ior: 1.45,
      envMapIntensity: 0.9
    },
    panel: {
      color: 0xbac9e6,
      metalness: 0.55,
      roughness: 0.5,
      bumpScale: 0.05,
      envMapIntensity: 0.8
    },
    lanes: {
      color: 0xffd08a,
      metalness: 0.75,
      roughness: 0.25,
      emissive: 0x241100,
      emissiveIntensity: 0.12
    },
    frame: { color: 0x4b5560, metalness: 0.7, roughness: 0.45 },
    chassis: { color: 0x262c35, metalness: 0.7, roughness: 0.54 },
    rail: { color: 0x565f6b, metalness: 0.6, roughness: 0.5 },
    connector: {
      color: 0xe4bf7a,
      metalness: 0.8,
      roughness: 0.4,
      emissive: 0x241000,
      emissiveIntensity: 0.12
    },
    docking: {
      color: 0x707a8c,
      metalness: 0.6,
      roughness: 0.48
    },
    conduit: {
      color: 0x343a44,
      metalness: 0.4,
      roughness: 0.65
    }
  }
};

function applyPreset(
  material: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial,
  preset: MaterialPreset
) {
  if (preset.color !== undefined) material.color.set(preset.color);
  if ('metalness' in material && preset.metalness !== undefined)
    material.metalness = preset.metalness;
  if ('roughness' in material && preset.roughness !== undefined)
    material.roughness = preset.roughness;
  if ('transmission' in material && preset.transmission !== undefined)
    (material as THREE.MeshPhysicalMaterial).transmission =
      preset.transmission;
  if (preset.opacity !== undefined) material.opacity = preset.opacity;
  if ('clearcoat' in material && preset.clearcoat !== undefined)
    (material as THREE.MeshPhysicalMaterial).clearcoat = preset.clearcoat;
  if (
    'clearcoatRoughness' in material &&
    preset.clearcoatRoughness !== undefined
  )
    (material as THREE.MeshPhysicalMaterial).clearcoatRoughness =
      preset.clearcoatRoughness;
  if ('envMapIntensity' in material && preset.envMapIntensity !== undefined)
    material.envMapIntensity = preset.envMapIntensity;
  if ('emissive' in material && preset.emissive !== undefined)
    (material as THREE.MeshStandardMaterial).emissive = new THREE.Color(
      preset.emissive
    );
  if (
    'emissiveIntensity' in material &&
    preset.emissiveIntensity !== undefined
  )
    (material as THREE.MeshStandardMaterial).emissiveIntensity =
      preset.emissiveIntensity;
  if ('ior' in material && preset.ior !== undefined)
    (material as THREE.MeshPhysicalMaterial).ior = preset.ior;
  if ('bumpScale' in material && preset.bumpScale !== undefined)
    (material as THREE.MeshStandardMaterial).bumpScale = preset.bumpScale;

  material.needsUpdate = true;
}

function applyMode(
  mode: 'concept' | 'blueprint',
  materials: ModuleMaterials,
  statusEl?: HTMLElement | null
) {
  const preset = MODE_PRESETS[mode];
  applyPreset(materials.cover, preset.cover);
  applyPreset(materials.substrate, preset.substrate);
  applyPreset(materials.panel, preset.panel);
  applyPreset(materials.lanes, preset.lanes);
  applyPreset(materials.frame, preset.frame);
  applyPreset(materials.chassis, preset.chassis);
  applyPreset(materials.rail, preset.rail);
  applyPreset(materials.connector, preset.connector);
  applyPreset(materials.docking, preset.docking);
  applyPreset(materials.conduit, preset.conduit);

  if (statusEl) {
    statusEl.textContent =
      mode === 'concept'
        ? 'Mode: Concept Demo (benchtop buildable today)'
        : 'Mode: Blueprint (high-grade reference)';
  }
}

// ─────────────────────────────────────────────────────────────
// Small procedural textures (no assets)
// ─────────────────────────────────────────────────────────────

function makeStripedBumpTexture(stripes = 32) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context');

  // base
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const stripeWidth = size / stripes;
  for (let i = 0; i < stripes; i++) {
    const v = i % 2 === 0 ? 176 : 128;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(i * stripeWidth, 0, stripeWidth * 0.7, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.repeat.set(5, 5);
  return tex;
}

function makeNoiseTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context');

  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 70 + Math.random() * 40;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v + Math.random() * 10;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.repeat.set(4, 4);
  return tex;
}

function makeBrushedMetalTexture(direction: 'x' | 'y' = 'x') {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context');

  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const base = 120 + (direction === 'x' ? (x % 16) * 4 : (y % 16) * 4);
      const noise = (Math.random() - 0.5) * 18;
      const v = THREE.MathUtils.clamp(base + noise, 80, 220);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v + 5;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.repeat.set(3, 3);
  return tex;
}

// ─────────────────────────────────────────────────────────────
// Hex geometry helpers
// ─────────────────────────────────────────────────────────────

function hexVertices(scale = 1): THREE.Vector2[] {
  const verts: THREE.Vector2[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 6 + (Math.PI / 3) * i; // flat-top
    const r = HEX_RADIUS * scale;
    verts.push(new THREE.Vector2(r * Math.cos(angle), r * Math.sin(angle)));
  }
  return verts;
}

function hexShape(scale = 1) {
  const verts = hexVertices(scale);
  const shape = new THREE.Shape();
  verts.forEach((v, i) => {
    if (i === 0) shape.moveTo(v.x, v.y);
    else shape.lineTo(v.x, v.y);
  });
  shape.closePath();
  return shape;
}

function makeHexExtrude(thickness: number, scale = 1, bevel = false) {
  return new THREE.ExtrudeGeometry(hexShape(scale), {
    depth: thickness,
    bevelEnabled: bevel,
    bevelSegments: bevel ? 2 : 0,
    bevelThickness: bevel ? thickness * 0.18 : 0,
    bevelSize: bevel ? 0.0045 : 0
  });
}

function isInsideHex(point: THREE.Vector3, scale = 1) {
  const verts = hexVertices(scale);
  let sign = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const cross =
      (b.x - a.x) * (point.z - a.y) - (b.y - a.y) * (point.x - a.x);
    if (cross === 0) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

function samplePointInHex(scale = 0.9) {
  while (true) {
    const x = (Math.random() * 2 - 1) * HEX_RADIUS * scale;
    const z = (Math.random() * 2 - 1) * HEX_RADIUS * scale;
    const p = new THREE.Vector3(x, 0, z);
    if (isInsideHex(p, scale)) return p;
  }
}

// ─────────────────────────────────────────────────────────────
// Simple iridescent Fresnel tweak for electrode lanes
// ─────────────────────────────────────────────────────────────

function addIridescentFresnel(material: THREE.MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.iridescenceStrength = { value: 0.35 };
    shader.uniforms.iridescenceTintA = { value: new THREE.Color(0xffe2a0) };
    shader.uniforms.iridescenceTintB = { value: new THREE.Color(0xa5c7ff) };

    shader.fragmentShader =
      `
      uniform float iridescenceStrength;
      uniform vec3 iridescenceTintA;
      uniform vec3 iridescenceTintB;
      ` +
      shader.fragmentShader.replace(
        '#include <envmap_physical_pars_fragment>',
        `
        #include <envmap_physical_pars_fragment>

        float fresnelLock(vec3 viewDir, vec3 normal) {
          float cosTheta = clamp(dot(viewDir, normal), 0.0, 1.0);
          float f = pow(1.0 - cosTheta, 3.0);
          return f;
        }
        `
      ).replace(
        '#include <output_fragment>',
        `
        // Original lighting
        #include <output_fragment>

        // Iridescent thin-film tint on top of metals
        vec3 V = normalize( vViewPosition );
        float fTerm = fresnelLock( V, geometryNormal );
        vec3 tint = mix( iridescenceTintA, iridescenceTintB, saturate(fTerm * 1.4) );
        float strength = iridescenceStrength * fTerm;
        gl_FragColor.rgb = mix( gl_FragColor.rgb, gl_FragColor.rgb * tint, strength );
        `
      );
  };

  material.needsUpdate = true;
}

// ─────────────────────────────────────────────────────────────
// Radial electrode lanes
// ─────────────────────────────────────────────────────────────

function createRadialElectrodeLanes(
  material: THREE.MeshStandardMaterial,
  yPosition: number
) {
  const group = new THREE.Group();
  const radialLength = HEX_APOTHEM * 1.42;

  for (let i = 0; i < ELECTRODE_SEGMENTS; i++) {
    const laneGeom = new THREE.BoxGeometry(
      radialLength,
      PANEL_THICKNESS * 0.3,
      0.008
    );
    const lane = new THREE.Mesh(laneGeom, material);
    const angle = (i / ELECTRODE_SEGMENTS) * Math.PI * 2;

    lane.rotation.y = angle + Math.PI / 2;
    lane.position.y = yPosition;
    lane.castShadow = true;
    lane.receiveShadow = true;

    const edge = new LineSegments(
      new EdgesGeometry(laneGeom),
      new LineBasicMaterial({
        color: 0x5d3a12,
        transparent: true,
        opacity: 0.45
      })
    );
    edge.position.copy(lane.position);
    edge.rotation.copy(lane.rotation);

    group.add(lane);
    group.add(edge);
  }

  // Concentric ring near the center (collector / bus)
  const ringGeom = new THREE.RingGeometry(
    HEX_APOTHEM * 0.2,
    HEX_APOTHEM * 0.45,
    64,
    1
  );
  const ring = new THREE.Mesh(ringGeom, material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = yPosition + PANEL_THICKNESS * 0.12;
  ring.castShadow = true;
  ring.receiveShadow = true;
  group.add(ring);

  return group;
}

// ─────────────────────────────────────────────────────────────
// Module construction (geometry + materials)
// ─────────────────────────────────────────────────────────────

function createModule(scene: THREE.Scene): {
  group: THREE.Group;
  materials: ModuleMaterials;
} {
  const group = new THREE.Group();

  const bumpTexture = makeStripedBumpTexture(ELECTRODE_SEGMENTS * 2);
  const roughTexture = makeNoiseTexture();
  const brushedTex = makeBrushedMetalTexture('x');

  // Base chassis (machined aluminum)
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x1a1e25,
    metalness: 0.95,
    roughness: 0.42,
    roughnessMap: brushedTex
  });

  const baseGeom = makeHexExtrude(BASE_THICKNESS, 1.08, true);
  baseGeom.rotateX(Math.PI / 2);
  const chassis = new THREE.Mesh(baseGeom, chassisMat);
  chassis.position.y = BASE_THICKNESS / 2;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  const chassisEdges = new LineSegments(
    new EdgesGeometry(baseGeom, 30),
    new LineBasicMaterial({
      color: 0x0f1116,
      transparent: true,
      opacity: 0.45
    })
  );
  chassisEdges.position.copy(chassis.position);
  group.add(chassisEdges);

  // Perimeter frame (raised machining lip)
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x30353f,
    metalness: 0.92,
    roughness: 0.32,
    roughnessMap: brushedTex
  });

  const frameGeom = makeHexExtrude(0.0032, 1.05, true);
  frameGeom.rotateX(Math.PI / 2);
  const frame = new THREE.Mesh(frameGeom, frameMat);
  frame.position.y = BASE_THICKNESS + 0.0017;
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  // Collector trench (machined recess)
  const trenchShape = hexShape(TRENCH_OUTER_SCALE);
  const inner = hexShape(TRENCH_INNER_SCALE * 0.997);
  trenchShape.holes.push(inner);
  const trenchGeom = new THREE.ExtrudeGeometry(trenchShape, {
    depth: CARTRIDGE_HEIGHT,
    bevelEnabled: false
  });
  trenchGeom.rotateX(Math.PI / 2);
  const trenchMat = new THREE.MeshStandardMaterial({
    color: 0x21242c,
    metalness: 0.65,
    roughness: 0.55,
    roughnessMap: roughTexture
  });
  const trench = new THREE.Mesh(trenchGeom, trenchMat);
  trench.position.y = BASE_THICKNESS + 0.0006;
  trench.receiveShadow = true;
  group.add(trench);

  // Removable cartridge (dust collector)
  const cartridgeMat = new THREE.MeshStandardMaterial({
    color: 0x343943,
    metalness: 0.55,
    roughness: 0.64,
    roughnessMap: roughTexture
  });
  const cartridgeGeom = makeHexExtrude(
    CARTRIDGE_HEIGHT * 0.9,
    TRENCH_OUTER_SCALE * 0.985
  );
  cartridgeGeom.rotateX(Math.PI / 2);
  const cartridge = new THREE.Mesh(cartridgeGeom, cartridgeMat);
  cartridge.position.y = BASE_THICKNESS + CARTRIDGE_HEIGHT / 2;
  cartridge.receiveShadow = true;
  group.add(cartridge);

  const cartridgeEdges = new LineSegments(
    new EdgesGeometry(cartridgeGeom, 30),
    new LineBasicMaterial({
      color: 0x111318,
      transparent: true,
      opacity: 0.4
    })
  );
  cartridgeEdges.position.copy(cartridge.position);
  group.add(cartridgeEdges);

  // Transparent dielectric substrate
  const substrateMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x6789c8,
    transparent: true,
    transmission: 0.72,
    opacity: 0.92,
    metalness: 0.04,
    roughness: 0.18,
    clearcoat: 0.45,
    clearcoatRoughness: 0.26,
    ior: 1.48,
    envMapIntensity: 1.3,
    thickness: SUBSTRATE_THICKNESS,
    attenuationColor: new THREE.Color(0x7ea5ff),
    attenuationDistance: 0.3
  });

  const substrateGeom = makeHexExtrude(SUBSTRATE_THICKNESS, 0.96);
  substrateGeom.rotateX(Math.PI / 2);
  const substrate = new THREE.Mesh(substrateGeom, substrateMaterial);
  substrate.position.y =
    BASE_THICKNESS + SUBSTRATE_THICKNESS / 2 + 0.00025;
  substrate.castShadow = true;
  substrate.receiveShadow = true;
  group.add(substrate);

  const substrateEdges = new LineSegments(
    new EdgesGeometry(substrateGeom, 30),
    new LineBasicMaterial({
      color: 0xa2b8ff,
      transparent: true,
      opacity: 0.65
    })
  );
  substrateEdges.position.copy(substrate.position);
  group.add(substrateEdges);

  // Panel (electrode support mesh)
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0xa3b9e5,
    metalness: 0.78,
    roughness: 0.35,
    bumpMap: bumpTexture,
    bumpScale: 0.09,
    roughnessMap: roughTexture
  });

  const panelGeom = makeHexExtrude(PANEL_THICKNESS, 0.94);
  panelGeom.rotateX(Math.PI / 2);
  const panel = new THREE.Mesh(panelGeom, panelMaterial);
  panel.position.y =
    BASE_THICKNESS +
    SUBSTRATE_THICKNESS +
    PANEL_THICKNESS / 2 +
    0.0002;
  panel.castShadow = true;
  panel.receiveShadow = true;
  group.add(panel);

  // Radial electrodes (copper sputtered with iridescence)
  const laneMaterial = new THREE.MeshStandardMaterial({
    color: 0xf4c676,
    metalness: 1.0,
    roughness: 0.18,
    emissive: new THREE.Color(0x3a1f00),
    emissiveIntensity: 0.42,
    bumpMap: bumpTexture,
    bumpScale: 0.13
  });
  addIridescentFresnel(laneMaterial);

  const lanes = createRadialElectrodeLanes(
    laneMaterial,
    panel.position.y + PANEL_THICKNESS / 2 - PANEL_THICKNESS * 0.35
  );
  group.add(lanes);

  // Transparent cover plate (outer glass)
  const coverMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xdfe8ff,
    transparent: true,
    transmission: 0.97,
    opacity: 0.18,
    roughness: 0.02,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    ior: 1.52,
    thickness: COVER_THICKNESS,
    attenuationColor: new THREE.Color(0xc0d8ff),
    attenuationDistance: 0.25,
    envMapIntensity: 2.1
  });

  const coverGeom = makeHexExtrude(COVER_THICKNESS, 0.962, true);
  coverGeom.rotateX(Math.PI / 2);
  const cover = new THREE.Mesh(coverGeom, coverMaterial);
  cover.position.y =
    panel.position.y +
    PANEL_THICKNESS * 0.55 +
    COVER_THICKNESS * 0.7 +
    COVER_OFFSET;
  cover.castShadow = true;
  cover.receiveShadow = true;
  group.add(cover);

  const coverEdges = new LineSegments(
    new EdgesGeometry(coverGeom, 30),
    new LineBasicMaterial({
      color: 0xeaf1ff,
      transparent: true,
      opacity: 0.95
    })
  );
  coverEdges.position.copy(cover.position);
  group.add(coverEdges);

  // Thin metallic bezel hugging the glass edge
  const coverBezelGeom = makeHexExtrude(0.0018, 0.99);
  coverBezelGeom.rotateX(Math.PI / 2);
  const coverBezelMat = new THREE.MeshStandardMaterial({
    color: 0xcdd4e2,
    metalness: 0.95,
    roughness: 0.16,
    roughnessMap: brushedTex,
    envMapIntensity: 1.4
  });
  const coverBezel = new THREE.Mesh(coverBezelGeom, coverBezelMat);
  coverBezel.position.y = cover.position.y + COVER_THICKNESS / 2 + 0.0014;
  coverBezel.castShadow = true;
  coverBezel.receiveShadow = true;
  group.add(coverBezel);

  const coverEdgeOutline = new LineSegments(
    new EdgesGeometry(coverBezelGeom),
    new LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.16
    })
  );
  coverEdgeOutline.position.copy(coverBezel.position);
  group.add(coverEdgeOutline);

  // Mounting bosses + fasteners at each vertex
  const bossGeom = new THREE.CylinderGeometry(
    0.011,
    0.011,
    BASE_THICKNESS * 1.1,
    16
  );
  const bossMat = new THREE.MeshStandardMaterial({
    color: 0x222630,
    metalness: 0.7,
    roughness: 0.5
  });
  const screwGeom = new THREE.CylinderGeometry(0.005, 0.005, 0.006, 16);
  const screwMat = new THREE.MeshStandardMaterial({
    color: 0xd0d4e0,
    metalness: 1.0,
    roughness: 0.18
  });

  const verts = hexVertices(1.04);
  verts.forEach((v) => {
    const boss = new THREE.Mesh(bossGeom, bossMat);
    boss.rotation.z = Math.PI / 2;
    boss.position.set(v.x, BASE_THICKNESS * 0.55, v.y);
    boss.castShadow = true;
    boss.receiveShadow = true;
    group.add(boss);

    const screw = new THREE.Mesh(screwGeom, screwMat);
    screw.rotation.z = Math.PI / 2;
    screw.position.set(v.x, BASE_THICKNESS + 0.003, v.y);
    screw.castShadow = true;
    screw.receiveShadow = true;
    group.add(screw);
  });

  // Embedded conduit (curved tube through chassis)
  const conduitMat = new THREE.MeshStandardMaterial({
    color: 0x171b22,
    metalness: 0.55,
    roughness: 0.6,
    roughnessMap: roughTexture
  });

  const conduitCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-HEX_APOTHEM * 0.22, BASE_THICKNESS * 0.55, -HEX_APOTHEM * 0.42),
    new THREE.Vector3(0, BASE_THICKNESS * 1.15, 0),
    new THREE.Vector3(
      HEX_APOTHEM * 0.34,
      BASE_THICKNESS * 0.6,
      HEX_APOTHEM * 0.26
    )
  );
  const conduitGeom = new THREE.TubeGeometry(conduitCurve, 20, 0.011, 14, false);
  const conduit = new THREE.Mesh(conduitGeom, conduitMat);
  conduit.castShadow = true;
  conduit.receiveShadow = true;
  group.add(conduit);

  // Edge docking alignment blocks + pogo pads
  const dockingMat = new THREE.MeshStandardMaterial({
    color: 0x5e6672,
    metalness: 0.85,
    roughness: 0.34,
    roughnessMap: brushedTex
  });
  const connectorMat = new THREE.MeshStandardMaterial({
    color: 0xf4b654,
    metalness: 1.0,
    roughness: 0.26,
    emissive: new THREE.Color(0x3b2400),
    emissiveIntensity: 0.25
  });

  const railGeom = new RoundedBoxGeometry(0.09, 0.03, 0.05, 4, 0.01);
  const padGeom = new THREE.CylinderGeometry(0.006, 0.006, 0.004, 12);

  const edgeVerts = hexVertices(1.01);

  for (let i = 0; i < edgeVerts.length; i++) {
    const a = edgeVerts[i];
    const b = edgeVerts[(i + 1) % edgeVerts.length];

    const mid = new THREE.Vector3(
      (a.x + b.x) / 2,
      BASE_THICKNESS + PANEL_THICKNESS * 0.38,
      (a.y + b.y) / 2
    );

    const angle = Math.atan2(b.x - a.x, a.y - b.y);

    const rail = new THREE.Mesh(railGeom, dockingMat);
    rail.position.copy(mid);
    rail.rotation.y = angle;
    rail.castShadow = true;
    rail.receiveShadow = true;
    group.add(rail);

    // twin contact pads on top of the rail
    const padOffset = new THREE.Vector3(0, 0.02, 0.014);
    for (let s = -1; s <= 1; s += 2) {
      const pad = new THREE.Mesh(padGeom, connectorMat);
      pad.rotation.x = Math.PI / 2;
      const local = padOffset.clone();
      local.z *= s;
      pad.position.copy(mid).add(local);
      pad.castShadow = true;
      pad.receiveShadow = true;
      group.add(pad);
    }
  }

  // Telemetry connector + strain-relief + cable
  const shellGeom = new THREE.CylinderGeometry(0.028, 0.028, 0.085, 28);
  const shell = new THREE.Mesh(shellGeom, connectorMat);
  shell.rotation.z = Math.PI / 2;
  shell.position.set(edgeVerts[0].x + 0.05, BASE_THICKNESS + 0.05, edgeVerts[0].y);
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  const strainGeom = new THREE.ConeGeometry(0.028, 0.06, 24);
  const strain = new THREE.Mesh(strainGeom, conduitMat);
  strain.rotation.z = Math.PI / 2;
  strain.position.set(
    shell.position.x + 0.055,
    shell.position.y,
    shell.position.z
  );
  strain.castShadow = true;
  strain.receiveShadow = true;
  group.add(strain);

  const grommetGeom = new THREE.TorusGeometry(0.028, 0.0048, 12, 24);
  const grommet = new THREE.Mesh(grommetGeom, conduitMat);
  grommet.rotation.y = Math.PI / 2;
  grommet.position.copy(shell.position);
  group.add(grommet);

  const cableCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(strain.position.x + 0.03, BASE_THICKNESS + 0.05, strain.position.z),
    new THREE.Vector3(
      strain.position.x + 0.7 * 0.5,
      BASE_THICKNESS + 0.08,
      strain.position.z + 0.07
    ),
    new THREE.Vector3(
      strain.position.x + 0.75,
      BASE_THICKNESS + 0.045,
      strain.position.z + 0.12
    )
  );
  const cableGeom = new THREE.TubeGeometry(cableCurve, 32, 0.0125, 16, false);
  const cable = new THREE.Mesh(cableGeom, conduitMat);
  cable.castShadow = true;
  cable.receiveShadow = true;
  group.add(cable);

  const cableSleeveGeom = new THREE.TubeGeometry(
    cableCurve,
    24,
    0.0125 * 1.3,
    12,
    false
  );
  const cableSleeve = new THREE.Mesh(cableSleeveGeom, conduitMat.clone());
  (cableSleeve.material as THREE.MeshStandardMaterial).opacity = 0.75;
  (cableSleeve.material as THREE.MeshStandardMaterial).transparent = true;
  cableSleeve.position.y -= 0.002;
  group.add(cableSleeve);

  const materials: ModuleMaterials = {
    cover: coverMaterial,
    substrate: substrateMaterial,
    panel: panelMaterial,
    lanes: laneMaterial,
    frame: frameMat,
    chassis: chassisMat,
    rail: dockingMat,
    connector: connectorMat,
    docking: dockingMat,
    conduit: conduitMat
  };

  scene.add(group);
  return { group, materials };
}

// ─────────────────────────────────────────────────────────────
// Dust particles + dynamics (physics unchanged, visuals improved)
// ─────────────────────────────────────────────────────────────

type DustParticle = {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  mass: number;
  charge: number;
  adhesion: number;
  attached: boolean;
  collected: boolean;
  collectTimer: number;
};

function sampleRadius() {
  const t = Math.random();
  return DUST_RADIUS_MIN + (DUST_RADIUS_MAX - DUST_RADIUS_MIN) * Math.pow(t, 1.8);
}

function respawnParticle(p: DustParticle, fresh = false) {
  const radius = sampleRadius();
  const volume = (4 / 3) * Math.PI * Math.pow(radius, 3);
  const mass = volume * DUST_DENSITY;
  const charge = THREE.MathUtils.lerp(
    DUST_CHARGE_MIN,
    DUST_CHARGE_MAX,
    Math.random()
  );
  const adhesion = ADHESION_PER_AREA * Math.PI * radius * radius;

  p.radius = radius;
  p.mass = mass;
  p.charge = charge;
  p.adhesion = adhesion;
  p.attached = true;
  p.collected = false;
  p.collectTimer = 0;

  const spawnPoint = samplePointInHex(0.88);
  p.position.set(
    spawnPoint.x,
    PANEL_SURFACE_Y + 0.002 + Math.random() * 0.02,
    spawnPoint.z
  );
  p.velocity.set((Math.random() - 0.5) * 0.01, 0, (Math.random() - 0.5) * 0.01);

  p.mesh.position.copy(p.position);

  if (!fresh) {
    p.mesh.rotation.set(0, 0, 0);
    p.mesh.scale.set(1, 1, 1);
  }
}

function spawnDustParticle(
  geom: THREE.SphereGeometry,
  material: THREE.Material
): DustParticle {
  const mesh = new THREE.Mesh(geom, material);
  mesh.castShadow = false; // they’re micron-sized; shadowing is negligible visually

  const p: DustParticle = {
    mesh,
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    radius: 0,
    mass: 0,
    charge: 0,
    adhesion: 0,
    attached: true,
    collected: false,
    collectTimer: 0
  };

  respawnParticle(p, true);
  return p;
}

function createDustField(scene: THREE.Scene) {
  // visual radius ~0.003 m for readability, even though physical radius is µm-scale
  const dustGeom = new THREE.SphereGeometry(0.003, 12, 12);
  const dustMat = new THREE.MeshStandardMaterial({
    color: 0xf7f2e6,
    emissive: 0x1a0e04,
    emissiveIntensity: 0.08,
    metalness: 0.0,
    roughness: 0.7
  });

  const particles: DustParticle[] = [];
  for (let i = 0; i < NUM_DUST_PARTICLES; i++) {
    const p = spawnDustParticle(dustGeom, dustMat);
    particles.push(p);
    scene.add(p.mesh);
  }
  return particles;
}

// Electric field: vertical + tangential traveling wave + drift (unchanged)
function computeFieldAt(position: THREE.Vector3, time: number) {
  const angle = Math.atan2(position.z, position.x);
  const radius = Math.sqrt(position.x * position.x + position.z * position.z);
  const rNorm = THREE.MathUtils.clamp(radius / HEX_APOTHEM, 0, 1);

  const sector = ((angle + Math.PI) / (2 * Math.PI)) * ELECTRODE_SEGMENTS;
  const laneIndex = Math.max(
    0,
    Math.min(ELECTRODE_SEGMENTS - 1, Math.floor(sector))
  );
  const phase =
    time * 2 * Math.PI * WAVE_FREQUENCY + laneIndex * PHASE_SHIFT;

  const Ey =
    FIELD_BASE + FIELD_TRAVEL * Math.sin(phase) * (1 - 0.35 * rNorm);

  const tangentialMag = FIELD_LATERAL * Math.cos(phase) * (0.4 + 0.6 * rNorm);
  const radialMag = FIELD_LATERAL * 0.25 * Math.sin(phase + Math.PI / 4);

  const radialDir = new THREE.Vector3(
    Math.cos(angle),
    0,
    Math.sin(angle)
  ).normalize();
  const tangentialDir = new THREE.Vector3(
    -Math.sin(angle),
    0,
    Math.cos(angle)
  ).normalize();

  const horizontal = radialDir
    .clone()
    .multiplyScalar(radialMag)
    .add(tangentialDir.clone().multiplyScalar(tangentialMag))
    .add(DIRECTIONAL_DRIFT);

  return new THREE.Vector3(horizontal.x, Ey, horizontal.z);
}

function stepDust(particles: DustParticle[], dt: number, time: number) {
  const panelY = PANEL_SURFACE_Y;
  const boundsScale = BOUNDS_SCALE;

  for (const p of particles) {
    if (p.collected) {
      p.collectTimer += dt;
      if (p.collectTimer > 1.2) {
        respawnParticle(p);
      }
      continue;
    }

    const field = computeFieldAt(p.position, time);

    const Fy = p.charge * field.y - p.mass * MARTIAN_GRAVITY;
    const Fx = p.charge * field.x;
    const Fz = p.charge * field.z;

    if (p.attached) {
      const upwardForce = Fy;
      if (upwardForce > p.adhesion) {
        p.attached = false;
        p.velocity.y += ((upwardForce - p.adhesion) / p.mass) * dt;
      } else {
        p.velocity.setScalar(0);
        p.position.y = panelY;
        p.mesh.position.copy(p.position);
        continue;
      }
    }

    const ax = Fx / p.mass;
    const ay = Fy / p.mass;
    const az = Fz / p.mass;

    p.velocity.x += ax * dt;
    p.velocity.y += ay * dt;
    p.velocity.z += az * dt;

    // simple drag
    p.velocity.multiplyScalar(1 - DRAG_COEFF * dt);

    p.position.addScaledVector(p.velocity, dt);

    // panel collision / bounce
    if (p.position.y < panelY) {
      p.position.y = panelY;
      p.velocity.y *= -0.22;
      p.velocity.x *= 0.92;
      p.velocity.z *= 0.92;
    }

    // elongate particles when fast → streaking effect
    const speed = p.velocity.length();
    const stretch = THREE.MathUtils.clamp(1 + speed * 10, 1, 3.2);
    if (speed > 1e-4) {
      const dir = p.velocity.clone().normalize();
      const quat = new THREE.Quaternion();
      quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      p.mesh.quaternion.copy(quat);
    }
    p.mesh.scale.set(1, Math.max(0.75, 1 + speed * 1.4), stretch);

    // Trench collection region
    if (
      !isInsideHex(p.position, TRENCH_INNER_SCALE) &&
      p.position.y < BASE_THICKNESS + CARTRIDGE_HEIGHT * 2
    ) {
      if (isInsideHex(p.position, TRENCH_OUTER_SCALE)) {
        p.collected = true;
        p.collectTimer = 0;
        p.position.y = BASE_THICKNESS + CARTRIDGE_HEIGHT / 2;
        p.velocity.setScalar(0);
        p.mesh.position.copy(p.position);
        continue;
      }
    }

    // Bounds / escape → respawn
    if (
      !isInsideHex(p.position, boundsScale) ||
      p.position.y > MAX_DUST_HEIGHT
    ) {
      respawnParticle(p);
      continue;
    }

    p.mesh.position.copy(p.position);
  }
}

// ─────────────────────────────────────────────────────────────
// Scene bootstrap
// ─────────────────────────────────────────────────────────────

export function initAncilliaScene(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02040a);

  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    120
  );
  camera.position.set(5.1, 3.5, 6.0);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGenerator.fromScene(new RoomEnvironment()).texture;
  scene.environment = envTex;
  pmremGenerator.dispose();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.target.set(0, 0.25, 0);

  // Lighting: key, rim, low-level environment
  const ambient = new THREE.AmbientLight(0x060711, 0.48);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xbfcfff, 0x05070c, 0.4);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
  keyLight.position.set(5.5, 8.8, 4.7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x90a8ff, 0.6);
  rimLight.position.set(-6, 5, -4.2);
  scene.add(rimLight);

  const grazeLight = new THREE.DirectionalLight(0xbecfff, 0.52);
  grazeLight.position.set(3.4, 1.2, -3.8);
  grazeLight.target.position.set(0, PANEL_SURFACE_Y, 0);
  scene.add(grazeLight);
  scene.add(grazeLight.target);

  const accent = new THREE.SpotLight(
    0xffe1be,
    0.6,
    18,
    Math.PI / 6,
    0.35,
    1.2
  );
  accent.position.set(-3, 6.2, 3.4);
  accent.target.position.set(0.4, 0.4, 0.2);
  accent.castShadow = true;
  accent.shadow.mapSize.set(1024, 1024);
  scene.add(accent);
  scene.add(accent.target);

  // Ground disk – subtle, so panel pops
  const groundGeom = new THREE.CircleGeometry(12, 64);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x05060b,
    metalness: 0.25,
    roughness: 0.92
  });
  const ground = new THREE.Mesh(groundGeom, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.16;
  ground.receiveShadow = true;
  scene.add(ground);

  // Module + dust
const { group: module, materials } = createModule(scene);
const dust = createDustField(scene);

// Make scene + module available in DevTools
(window as any).scene = scene;
(window as any).module = module;

//  ADD ENHANCEMENTS HERE (correct placement)

// Apply mode presets
const modeStatusEl = document.getElementById('mode-status');
applyMode('blueprint', materials, modeStatusEl);

let currentMode: 'concept' | 'blueprint' = 'blueprint';
window.addEventListener('keydown', (event) => {
  if (event.key === '1' && currentMode !== 'concept') {
    currentMode = 'concept';
    applyMode('concept', materials, modeStatusEl);
  }
  if (event.key === '2' && currentMode !== 'blueprint') {
    currentMode = 'blueprint';
    applyMode('blueprint', materials, modeStatusEl);
  }
});

const clock = new THREE.Clock();

function animate() {
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;

  // Module animation
  module.rotation.y += delta * 0.16;

  // Dust physics
  stepDust(dust, delta, elapsed);

  controls.update();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

// Resize handling
const handleResize = () => {
  const { clientWidth, clientHeight } = container;
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(clientWidth, clientHeight);
};

window.addEventListener('resize', handleResize);

//  ADD ENHANCEMENTS HERE (correct placement inside function)
enhanceAncilliaDevice(scene, module, materials);


  }
  if (event.key === '2' && currentMode !== 'blueprint') {
    currentMode = 'blueprint';
    applyMode('blueprint', materials, modeStatusEl);
  }
});

const clock = new THREE.Clock();

function animate() {
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;

  // Module animation
  module.rotation.y += delta * 0.16;

  // Dust physics
  stepDust(dust, delta, elapsed);

  controls.update();
  renderer.render(scene, camera);
 main
}

renderer.setAnimationLoop(animate);

// Resize handling
const handleResize = () => {
  const { clientWidth, clientHeight } = container;
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(clientWidth, clientHeight);
};

window.addEventListener('resize', handleResize);

//  ADD ENHANCEMENTS HERE (correct placement inside function)
enhanceAncilliaDevice(scene, module, materials);

}