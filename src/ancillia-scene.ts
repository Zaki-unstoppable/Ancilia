 codex/implement-electrodynamic-dust-physics-simulation-46k6tb
// @ts-nocheck

 main
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EdgesGeometry, LineBasicMaterial, LineSegments } from 'three';

 codex/implement-electrodynamic-dust-physics-simulation-46k6tb
const HEX_FLAT = 0.38; // flat-to-flat width (m)
const HEX_POINT = 0.44; // point-to-point width (m)
const HEX_APOTHEM = HEX_FLAT / 2; // center to flat
const HEX_RADIUS = HEX_POINT / 2; // center to vertex

const BASE_THICKNESS = 0.004; // 4 mm carbon fiber / anodized aluminium
const SUBSTRATE_THICKNESS = 0.0016; // fused silica / borosilicate
const PANEL_THICKNESS = 0.0025; // electrode mesh layer encapsulation
const COVER_THICKNESS = 0.0012; // transparent protective cap
const COVER_OFFSET = 0.0009; // visible separation between cover and panel

const LANE_COUNT = 12;
const LANE_WIDTH = 0.018;
const LANE_HEIGHT = 0.0022;
const CABLE_RADIUS = 0.012;
const CABLE_SWEEP = 0.35;

const PANEL_LENGTH = 4.0;
const PANEL_WIDTH = 2.0;
const PANEL_THICKNESS = 0.05;
const LANE_COUNT = 12;
const LANE_WIDTH = 0.06;
const LANE_HEIGHT = 0.012;
const CABLE_RADIUS = 0.03;
const CABLE_SWEEP = 0.7;
 main

const NUM_DUST_PARTICLES = 260;
const DUST_RADIUS_MIN = 8e-6;
const DUST_RADIUS_MAX = 38e-6;
const DUST_DENSITY = 3100; // kg/m^3 (basaltic regolith simulant)
const DUST_CHARGE_MIN = 2e-15;
const DUST_CHARGE_MAX = 9e-14;
const ADHESION_PER_AREA = 50; // N/m^2 approximate to reach ~1e-7 N at 30 µm
const MARTIAN_GRAVITY = 3.71;
const FIELD_BASE = 1.2e5; // V/m static lift component
const FIELD_TRAVEL = 6.5e4; // V/m travelling wave component
 codex/implement-electrodynamic-dust-physics-simulation-46k6tb
const FIELD_LATERAL = 3.1e4; // V/m lateral push along the lanes
const WAVE_FREQUENCY = 42; // Hz, scaled for visual legibility
const PHASE_SHIFT = (2 * Math.PI) / 3; // travelling wave between adjacent lanes
const DRAG_COEFF = 0.45;
const DIRECTIONAL_DRIFT = new THREE.Vector3(0.15, 0, -0.08); // bias dust toward a collector edge
const TRENCH_INNER_SCALE = 1.02; // dust runs off the panel into the trench just beyond the active area
const TRENCH_OUTER_SCALE = 1.12; // removable cartridge span
const CARTRIDGE_HEIGHT = 0.012;
const PANEL_SURFACE_Y = BASE_THICKNESS / 2 + SUBSTRATE_THICKNESS + PANEL_THICKNESS / 2;

const ELECTRODE_SEGMENTS = 6; // radial segments for traveling-wave drive

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
  r>ail: MaterialPreset;
  connector: MaterialPreset;
  docking: MaterialPreset;
  conduit: MaterialPreset;
};

const MODE_PRESETS: Record<'concept' | 'blueprint', ModePresets> = {
  blueprint: {
    cover: {
      color: 0xa5bfff,
      transmission: 0.98,
      opacity: 0.62,
      roughness: 0.03,
      metalness: 0.05,
      clearcoat: 0.85,
      clearcoatRoughness: 0.04,
      ior: 1.52,
      envMapIntensity: 1.5
    },
    substrate: {
      color: 0x4466aa,
      transmission: 0.75,
      opacity: 0.82,
      roughness: 0.12,
      metalness: 0.05,
      clearcoat: 0.4,
      clearcoatRoughness: 0.25,
      ior: 1.48,
      envMapIntensity: 1.2
    },
    panel: {
      color: 0x8fb0ff,
      metalness: 0.72,
      roughness: 0.28,
      bumpScale: 0.08,
      envMapIntensity: 1.0
    },
    lanes: {
      color: 0xffd080,
      metalness: 0.92,
      roughness: 0.18,
      emissive: 0x332100,
      emissiveIntensity: 0.35
    },
    frame: { color: 0x30343f, metalness: 0.78, roughness: 0.32 },
    chassis: { color: 0x1c1f26, metalness: 0.85, roughness: 0.45 },
    rail: { color: 0x3c404a, metalness: 0.65, roughness: 0.4 },
    connector: {
      color: 0xffac4b,
      metalness: 1.0,
      roughness: 0.3,
      emissive: 0x332000,
      emissiveIntensity: 0.2
    },
    docking: { color: 0x5a6472, metalness: 0.7, roughness: 0.35 },
    conduit: { color: 0x1f222c, metalness: 0.4, roughness: 0.6 }
  },
  concept: {
    cover: {
      color: 0xe4f0ff,
      transmission: 0.72,
      opacity: 0.72,
      roughness: 0.08,
      metalness: 0.02,
      clearcoat: 0.35,
      clearcoatRoughness: 0.18,
      ior: 1.49,
      envMapIntensity: 0.8
    },
    substrate: {
      color: 0x9ab3d1,
      transmission: 0.55,
      opacity: 0.9,
      roughness: 0.2,
      metalness: 0.02,
      clearcoat: 0.2,
      clearcoatRoughness: 0.3,
      ior: 1.45,
      envMapIntensity: 0.7
    },
    panel: {
      color: 0xb6c8f0,
      metalness: 0.46,
      roughness: 0.48,
      bumpScale: 0.04,
      envMapIntensity: 0.7
    },
    lanes: {
      color: 0xffc56b,
      metalness: 0.6,
      roughness: 0.32,
      emissive: 0x221400,
      emissiveIntensity: 0.08
    },
    frame: { color: 0x4d5561, metalness: 0.55, roughness: 0.46 },
    chassis: { color: 0x2b313a, metalness: 0.55, roughness: 0.55 },
    rail: { color: 0x565e6c, metalness: 0.5, roughness: 0.5 },
    connector: {
      color: 0xe9c08a,
      metalness: 0.72,
      roughness: 0.45,
      emissive: 0x221100,
      emissiveIntensity: 0.1
    },
    docking: { color: 0x707a8c, metalness: 0.55, roughness: 0.48 },
    conduit: { color: 0x373d47, metalness: 0.32, roughness: 0.62 }
  }
};

function applyPreset(material: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial, preset: MaterialPreset) {
  if (preset.color !== undefined) material.color.set(preset.color);
  if (preset.metalness !== undefined && 'metalness' in material) material.metalness = preset.metalness;
  if (preset.roughness !== undefined && 'roughness' in material) material.roughness = preset.roughness;
  if ('transmission' in material && preset.transmission !== undefined) material.transmission = preset.transmission;
  if (preset.opacity !== undefined) material.opacity = preset.opacity;
  if ('clearcoat' in material && preset.clearcoat !== undefined) (material as THREE.MeshPhysicalMaterial).clearcoat = preset.clearcoat;
  if ('clearcoatRoughness' in material && preset.clearcoatRoughness !== undefined)
    (material as THREE.MeshPhysicalMaterial).clearcoatRoughness = preset.clearcoatRoughness;
  if (preset.envMapIntensity !== undefined && 'envMapIntensity' in material) material.envMapIntensity = preset.envMapIntensity;
  if ('emissive' in material && preset.emissive !== undefined) material.emissive = new THREE.Color(preset.emissive);
  if ('emissiveIntensity' in material && preset.emissiveIntensity !== undefined)
    (material as THREE.MeshStandardMaterial).emissiveIntensity = preset.emissiveIntensity;
  if ('ior' in material && preset.ior !== undefined) (material as THREE.MeshPhysicalMaterial).ior = preset.ior;
  if ('bumpScale' in material && preset.bumpScale !== undefined) (material as THREE.MeshStandardMaterial).bumpScale = preset.bumpScale;
  material.needsUpdate = true;
}

function applyMode(mode: 'concept' | 'blueprint', materials: ModuleMaterials, statusEl?: HTMLElement | null) {
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

const FIELD_LATERAL = 2.8e4; // V/m lateral push along the lanes
const WAVE_FREQUENCY = 42; // Hz, scaled for visual legibility
const PHASE_SHIFT = (2 * Math.PI) / 3; // travelling wave between adjacent lanes
const DRAG_COEFF = 0.45;
 main

function makeStripedBumpTexture(stripes = 12) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create 2D context');

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const stripeWidth = size / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#a0a0a0' : '#606060';
    ctx.fillRect(i * stripeWidth, 0, stripeWidth * 0.6, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

function makeNoiseTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create 2D context');

  const imageData = ctx.createImageData(size, size);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = 100 + Math.random() * 80;
    imageData.data[i] = v;
    imageData.data[i + 1] = v;
    imageData.data[i + 2] = v;
    imageData.data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
}

 codex/implement-electrodynamic-dust-physics-simulation-46k6tb
function hexVertices(scale = 1) {
  const verts: THREE.Vector2[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 6 + (Math.PI / 3) * i; // flat-top orientation
    const r = HEX_RADIUS * scale;
    verts.push(new THREE.Vector2(r * Math.cos(angle), r * Math.sin(angle)));
  }
  return verts;
}

function hexShape(scale = 1) {
  const verts = hexVertices(scale);
  const shape = new THREE.Shape();
  verts.forEach((v, idx) => {
    if (idx === 0) shape.moveTo(v.x, v.y);
    else shape.lineTo(v.x, v.y);
  });
  shape.closePath();
  return shape;
}

function makeHexExtrude(thickness: number, scale = 1, bevel = false) {
  return new THREE.ExtrudeGeometry(hexShape(scale), {
    depth: thickness,
    bevelEnabled: bevel,
    bevelSegments: 1,
    bevelThickness: bevel ? thickness * 0.12 : 0,
    bevelSize: bevel ? 0.004 : 0
  });
}

function isInsideHex(point: THREE.Vector3, scale = 1) {
  const verts = hexVertices(scale);
  let sign = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const cross = (b.x - a.x) * (point.z - a.y) - (b.y - a.y) * (point.x - a.x);
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

function createElectrodeLanes(material: THREE.Material, yPosition: number) {
  const group = new THREE.Group();
  const radialLength = HEX_APOTHEM * 1.7;
  for (let i = 0; i < ELECTRODE_SEGMENTS; i++) {
    const laneGeom = new THREE.BoxGeometry(radialLength, LANE_HEIGHT, LANE_WIDTH);
    const lane = new THREE.Mesh(laneGeom, material);
    const angle = (i / ELECTRODE_SEGMENTS) * Math.PI * 2;
    lane.rotation.y = angle;
    lane.position.y = yPosition - 0.0006;
    lane.castShadow = true;
    lane.receiveShadow = true;
    group.add(lane);

    const laneEdge = new LineSegments(new EdgesGeometry(laneGeom, 12), new LineBasicMaterial({ color: 0x3a2b1c }));
    laneEdge.position.copy(lane.position);
    laneEdge.rotation.copy(lane.rotation);
    group.add(laneEdge);
  }

  const ringGeom = new THREE.RingGeometry(HEX_APOTHEM * 0.25, HEX_APOTHEM * 0.48, 48, 1);
  const ring = new THREE.Mesh(ringGeom, material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = yPosition;
  ring.castShadow = true;
  ring.receiveShadow = true;
  group.add(ring);

  return group;
}

function createModule(scene: THREE.Scene): { group: THREE.Group; materials: ModuleMaterials } {

function createElectrodeLanes(material: THREE.Material) {
  const group = new THREE.Group();
  const spacing = PANEL_WIDTH / LANE_COUNT;
  for (let i = 0; i < LANE_COUNT; i++) {
    const geom = new THREE.BoxGeometry(PANEL_LENGTH * 0.92, LANE_HEIGHT, LANE_WIDTH);
    const lane = new THREE.Mesh(geom, material);
    const x = 0;
    const y = PANEL_THICKNESS / 2 + LANE_HEIGHT / 2 + 0.001;
    const z = -PANEL_WIDTH / 2 + spacing * i + spacing / 2;
    lane.position.set(x, y, z);
    lane.castShadow = true;
    lane.receiveShadow = true;
    group.add(lane);
  }
  return group;
}

function createDockingHardware(material: THREE.Material) {
  const group = new THREE.Group();
  const tongueGeom = new THREE.BoxGeometry(0.35, 0.12, 0.22);
  const socketGeom = new THREE.BoxGeometry(0.38, 0.14, 0.26);

  const tongue1 = new THREE.Mesh(tongueGeom, material);
  const tongue2 = new THREE.Mesh(tongueGeom, material);
  tongue1.position.set(PANEL_LENGTH / 2 + 0.15, 0, 0.25);
  tongue2.position.set(PANEL_LENGTH / 2 + 0.15, 0, -0.25);

  const socket1 = new THREE.Mesh(socketGeom, material);
  const socket2 = new THREE.Mesh(socketGeom, material);
  socket1.position.set(-PANEL_LENGTH / 2 - 0.19, -0.02, 0.28);
  socket2.position.set(-PANEL_LENGTH / 2 - 0.19, -0.02, -0.28);

  [tongue1, tongue2, socket1, socket2].forEach((mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  return group;
}

function createConnector(material: THREE.Material) {
  const connectorGroup = new THREE.Group();

  const shellGeom = new THREE.CylinderGeometry(0.065, 0.065, 0.24, 28);
  const shell = new THREE.Mesh(shellGeom, material);
  shell.rotation.z = Math.PI / 2;
  shell.position.set(PANEL_LENGTH / 2 + 0.06, 0.05, 0);
  shell.castShadow = true;
  shell.receiveShadow = true;
  connectorGroup.add(shell);

  const pinMaterial = new THREE.MeshStandardMaterial({
    color: 0xffe0b0,
    metalness: 0.95,
    roughness: 0.25
  });

  const pinGeom = new THREE.CylinderGeometry(0.01, 0.01, 0.05, 12);
  const pinOffset = 0.024;
  const pinPositions: [number, number, number][] = [
    [0, 0, 0],
    [pinOffset, 0, pinOffset],
    [-pinOffset, 0, pinOffset],
    [pinOffset, 0, -pinOffset],
    [-pinOffset, 0, -pinOffset]
  ];

  for (const [x, y, z] of pinPositions) {
    const pin = new THREE.Mesh(pinGeom, pinMaterial);
    pin.rotation.z = Math.PI / 2;
    pin.position.set(shell.position.x + 0.08 + x * 0.12, y + 0.05, z);
    pin.castShadow = true;
    pin.receiveShadow = true;
    connectorGroup.add(pin);
  }

  const cableMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b2f38,
    metalness: 0.2,
    roughness: 0.55
  });

  const cableCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(shell.position.x + 0.12, 0.04, 0),
    new THREE.Vector3(shell.position.x + CABLE_SWEEP * 0.45, 0.14, 0.12),
    new THREE.Vector3(shell.position.x + CABLE_SWEEP, 0.02, 0.2)
  );
  const cableGeom = new THREE.TubeGeometry(cableCurve, 24, CABLE_RADIUS, 12, false);
  const cable = new THREE.Mesh(cableGeom, cableMaterial);
  cable.castShadow = true;
  cable.receiveShadow = true;
  connectorGroup.add(cable);

  connectorGroup.rotation.y = Math.PI / 14;

  return connectorGroup;
}

function createModule(scene: THREE.Scene) {
 main
  const group = new THREE.Group();

  const bumpTexture = makeStripedBumpTexture(LANE_COUNT * 2);
  const roughnessTexture = makeNoiseTexture();

 codex/implement-electrodynamic-dust-physics-simulation-46k6tb

  const metalDark = new THREE.MeshStandardMaterial({
    color: 0x1c1f26,
    metalness: 0.85,
    roughness: 0.45,
    roughnessMap: roughnessTexture
  });

  const chassisGeom = new RoundedBoxGeometry(PANEL_LENGTH + 0.45, 0.16, PANEL_WIDTH + 0.45, 8, 0.08);
  const chassis = new THREE.Mesh(chassisGeom, metalDark);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  chassis.position.y = -0.06;
  group.add(chassis);

  const frameGeom = new RoundedBoxGeometry(PANEL_LENGTH + 0.15, 0.05, PANEL_WIDTH + 0.15, 4, 0.04);
 main
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x30343f,
    metalness: 0.78,
    roughness: 0.32,
    roughnessMap: roughnessTexture
  });
 codex/implement-electrodynamic-dust-physics-simulation-46k6tb

  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x1c1f26,
    metalness: 0.85,
    roughness: 0.45,
    roughnessMap: roughnessTexture
  });

  const frame = new THREE.Mesh(frameGeom, frameMat);
  frame.position.y = 0.02;
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);
 main

  const substrateMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x4466aa,
    transparent: true,
 codex/implement-electrodynamic-dust-physics-simulation-46k6tb
    transmission: 0.78,
    opacity: 0.82,
    metalness: 0.05,
    roughness: 0.16,
    clearcoat: 0.42,
    clearcoatRoughness: 0.28,
    ior: 1.48,
    envMapIntensity: 1.3,
    thickness: SUBSTRATE_THICKNESS
  });


    transmission: 0.75,
    opacity: 0.82,
    metalness: 0.05,
    roughness: 0.12,
    clearcoat: 0.4,
    clearcoatRoughness: 0.25,
    ior: 1.48,
    envMapIntensity: 1.2
  });

  const substrateGeom = new THREE.BoxGeometry(PANEL_LENGTH * 0.94, 0.028, PANEL_WIDTH * 0.94);
  const substrate = new THREE.Mesh(substrateGeom, substrateMaterial);
  substrate.position.y = -0.004;
  substrate.castShadow = true;
  substrate.receiveShadow = true;
  group.add(substrate);

 main
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0x8fb0ff,
    metalness: 0.72,
    roughness: 0.28,
    bumpMap: bumpTexture,
    bumpScale: 0.08,
    roughnessMap: roughnessTexture
  });

 codex/implement-electrodynamic-dust-physics-simulation-46k6tb
  const laneMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f1810,
    metalness: 0.95,
    roughness: 0.18,
    emissive: new THREE.Color(0x6b3e05),
    emissiveIntensity: 0.26,
    bumpMap: bumpTexture,
    bumpScale: 0.12
  });

  const panelGeom = new RoundedBoxGeometry(PANEL_LENGTH * 0.92, PANEL_THICKNESS, PANEL_WIDTH * 0.92, 2, 0.02);
  const panel = new THREE.Mesh(panelGeom, panelMaterial);
  panel.position.y = PANEL_THICKNESS / 2 + 0.01;
  panel.castShadow = true;
  panel.receiveShadow = true;
  group.add(panel);

  const laneMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd080,
    metalness: 0.92,
    roughness: 0.18,
    emissive: new THREE.Color(0x332100),
    emissiveIntensity: 0.35
  });
  const lanes = createElectrodeLanes(laneMaterial);
  group.add(lanes);
 main

  const coverMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xa5bfff,
    transparent: true,
    transmission: 0.98,
    opacity: 0.62,
 codex/implement-electrodynamic-dust-physics-simulation-46k6tb
    roughness: 0.018,
    metalness: 0.07,
    clearcoat: 0.95,
    clearcoatRoughness: 0.028,
    ior: 1.52,
    thickness: COVER_THICKNESS,
    attenuationColor: new THREE.Color(0xd6e7ff),
    attenuationDistance: 0.3,
    envMapIntensity: 1.8
  });

  // Base structural plate with beveled edge
  const baseGeom = makeHexExtrude(BASE_THICKNESS, 1.08, true);
  baseGeom.rotateX(Math.PI / 2);
  const chassis = new THREE.Mesh(baseGeom, chassisMat);
  chassis.position.y = BASE_THICKNESS / 2;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  // Perimeter frame / trench
  const frameGeom = makeHexExtrude(0.003, 1.05, true);
  frameGeom.rotateX(Math.PI / 2);
  const frame = new THREE.Mesh(frameGeom, frameMat);
  frame.position.y = BASE_THICKNESS + 0.0015;
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  const trenchShape = hexShape(TRENCH_OUTER_SCALE);
  const inner = hexShape(TRENCH_INNER_SCALE);
  trenchShape.holes.push(inner);
  const trenchGeom = new THREE.ExtrudeGeometry(trenchShape, { depth: CARTRIDGE_HEIGHT, bevelEnabled: false });
  trenchGeom.rotateX(Math.PI / 2);
  const trenchMat = new THREE.MeshStandardMaterial({ color: 0x2b2f38, metalness: 0.4, roughness: 0.55 });
  const trench = new THREE.Mesh(trenchGeom, trenchMat);
  trench.position.y = BASE_THICKNESS + 0.0005;
  trench.receiveShadow = true;
  group.add(trench);

  // Removable dust cartridge wedges
  const cartridgeMat = new THREE.MeshStandardMaterial({ color: 0x3d434f, metalness: 0.35, roughness: 0.62 });
  const cartridgeGeom = makeHexExtrude(CARTRIDGE_HEIGHT * 0.9, TRENCH_OUTER_SCALE * 0.98);
  cartridgeGeom.rotateX(Math.PI / 2);
  const cartridge = new THREE.Mesh(cartridgeGeom, cartridgeMat);
  cartridge.position.y = BASE_THICKNESS + CARTRIDGE_HEIGHT / 2;
  cartridge.receiveShadow = true;
  group.add(cartridge);

  // Substrate (transparent dielectric base for electrodes)
  const substrateGeom = makeHexExtrude(SUBSTRATE_THICKNESS, 0.96);
  substrateGeom.rotateX(Math.PI / 2);
  const substrate = new THREE.Mesh(substrateGeom, substrateMaterial);
  substrate.position.y = BASE_THICKNESS + SUBSTRATE_THICKNESS / 2 + 0.00025;
  substrate.castShadow = true;
  substrate.receiveShadow = true;
  group.add(substrate);

  const substrateEdges = new LineSegments(
    new EdgesGeometry(substrateGeom, 30),
    new LineBasicMaterial({ color: 0x9cb2ff, transparent: true, opacity: 0.65 })
  );
  substrateEdges.position.copy(substrate.position);
  group.add(substrateEdges);

  // Electrode support layer (mesh encapsulation)
  const panelGeom = makeHexExtrude(PANEL_THICKNESS, 0.94);
  panelGeom.rotateX(Math.PI / 2);
  const panel = new THREE.Mesh(panelGeom, panelMaterial);
  panel.position.y = BASE_THICKNESS + SUBSTRATE_THICKNESS + PANEL_THICKNESS / 2 + 0.0002;
  panel.castShadow = true;
  panel.receiveShadow = true;
  group.add(panel);

  // Radial + concentric electrode pattern
  const lanes = createElectrodeLanes(
    laneMaterial,
    panel.position.y + PANEL_THICKNESS / 2 - LANE_HEIGHT / 2 - 0.0002
  );
  group.add(lanes);

  // Transparent cover plate
  const coverGeom = makeHexExtrude(COVER_THICKNESS, 0.96, true);
  coverGeom.rotateX(Math.PI / 2);
  const cover = new THREE.Mesh(coverGeom, coverMaterial);
  cover.position.y = panel.position.y + PANEL_THICKNESS / 2 + COVER_THICKNESS / 2 + COVER_OFFSET;

    roughness: 0.03,
    metalness: 0.05,
    clearcoat: 0.85,
    clearcoatRoughness: 0.04,
    ior: 1.52,
    thickness: 0.03,
    envMapIntensity: 1.5
  });
  const coverGeom = new RoundedBoxGeometry(PANEL_LENGTH * 0.93, 0.022, PANEL_WIDTH * 0.93, 2, 0.02);
  const cover = new THREE.Mesh(coverGeom, coverMaterial);
  cover.position.y = PANEL_THICKNESS + 0.028;
 main
  cover.castShadow = true;
  cover.receiveShadow = true;
  group.add(cover);

  const coverEdges = new LineSegments(
    new EdgesGeometry(coverGeom, 30),
    new LineBasicMaterial({ color: 0xbdd5ff, transparent: true, opacity: 0.9 })
  );
  coverEdges.position.copy(cover.position);
  group.add(coverEdges);

 codex/implement-electrodynamic-dust-physics-simulation-46k6tb
  const coverBezelGeom = makeHexExtrude(0.002, 0.99);
  coverBezelGeom.rotateX(Math.PI / 2);

 main
  const coverBezelMat = new THREE.MeshStandardMaterial({
    color: 0xbfc5d4,
    metalness: 0.9,
    roughness: 0.18,
    envMapIntensity: 1.25
  });
 codex/implement-electrodynamic-dust-physics-simulation-46k6tb
  const coverBezel = new THREE.Mesh(coverBezelGeom, coverBezelMat);
  coverBezel.position.y = cover.position.y + COVER_THICKNESS / 2 + 0.0015;

  const coverBezelGeom = new RoundedBoxGeometry(PANEL_LENGTH * 0.96, 0.01, PANEL_WIDTH * 0.96, 2, 0.016);
  const coverBezel = new THREE.Mesh(coverBezelGeom, coverBezelMat);
  coverBezel.position.y = cover.position.y + 0.008;
 main
  coverBezel.castShadow = true;
  coverBezel.receiveShadow = true;
  group.add(coverBezel);

 codex/implement-electrodynamic-dust-physics-simulation-46k6tb
  const coverEdgeOutline = new LineSegments(
    new EdgesGeometry(coverBezelGeom),
    new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 })
  );
  coverEdgeOutline.position.copy(coverBezel.position);
  group.add(coverEdgeOutline);

  // Mounting holes on each corner
  const mountHoleGeom = new THREE.CylinderGeometry(0.007, 0.007, BASE_THICKNESS * 1.8, 18);
  const mountHoleMat = new THREE.MeshStandardMaterial({ color: 0x1a1d27, metalness: 0.3, roughness: 0.8 });
  const verts = hexVertices(1.05);
  verts.forEach((v) => {
    const hole = new THREE.Mesh(mountHoleGeom, mountHoleMat);
    hole.rotation.z = Math.PI / 2;
    hole.position.set(v.x, BASE_THICKNESS / 2, v.y);
    group.add(hole);
  });

  // Embedded conduit for telemetry wiring
  const conduitMat = new THREE.MeshStandardMaterial({
    color: 0x1f222c,
    metalness: 0.4,
    roughness: 0.6,
    roughnessMap: roughnessTexture
  });
  const conduitGeom = new THREE.TubeGeometry(
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-HEX_APOTHEM * 0.2, BASE_THICKNESS * 0.4, -HEX_APOTHEM * 0.4),
      new THREE.Vector3(0, BASE_THICKNESS * 0.8, 0),
      new THREE.Vector3(HEX_APOTHEM * 0.35, BASE_THICKNESS * 0.45, HEX_APOTHEM * 0.25)
    ),
    18,
    CABLE_RADIUS,
    12,
    false
  );
  const conduit = new THREE.Mesh(conduitGeom, conduitMat);

  const substrateEdges = new LineSegments(
    new EdgesGeometry(substrateGeom, 30),
    new LineBasicMaterial({ color: 0x9cb2ff, transparent: true, opacity: 0.65 })
  );
  substrateEdges.position.copy(substrate.position);
  group.add(substrateEdges);

  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0x3c404a,
    metalness: 0.65,
    roughness: 0.4,
    roughnessMap: roughnessTexture
  });
  const railGeom = new RoundedBoxGeometry(PANEL_LENGTH * 0.96, 0.12, 0.12, 2, 0.03);
  const railLeft = new THREE.Mesh(railGeom, railMaterial);
  railLeft.position.set(0, 0.04, PANEL_WIDTH / 2 + 0.05);
  const railRight = railLeft.clone();
  railRight.position.z = -PANEL_WIDTH / 2 - 0.05;
  [railLeft, railRight].forEach((rail) => {
    rail.castShadow = true;
    rail.receiveShadow = true;
    group.add(rail);
  });

  const conduitMat = new THREE.MeshStandardMaterial({
    color: 0x1f222c,
    metalness: 0.4,
    roughness: 0.6
  });
  const conduitGeom = new RoundedBoxGeometry(PANEL_LENGTH * 0.7, 0.035, 0.16, 2, 0.016);
  const conduit = new THREE.Mesh(conduitGeom, conduitMat);
  conduit.position.set(0, -0.01, PANEL_WIDTH / 2 + 0.16);
 main
  conduit.castShadow = true;
  conduit.receiveShadow = true;
  group.add(conduit);

 codex/implement-electrodynamic-dust-physics-simulation-46k6tb
  // Edge connectors: alternating male/female rails with pogo pins
  const dockingMat = new THREE.MeshStandardMaterial({ color: 0x5a6472, metalness: 0.7, roughness: 0.35 });
  const connectorMat = new THREE.MeshStandardMaterial({
    color: 0xffac4b,
    metalness: 1.0,
    roughness: 0.3,
    emissive: new THREE.Color(0x332000),
    emissiveIntensity: 0.2
  });

  const railGeom = new RoundedBoxGeometry(0.12, 0.04, 0.08, 4, 0.014);
  const pogoGeom = new THREE.CylinderGeometry(0.005, 0.005, 0.02, 10);
  const edgeVerts = hexVertices(1.02);
  for (let i = 0; i < edgeVerts.length; i++) {
    const a = edgeVerts[i];
    const b = edgeVerts[(i + 1) % edgeVerts.length];
    const mid = new THREE.Vector3((a.x + b.x) / 2, BASE_THICKNESS + 0.01, (a.y + b.y) / 2);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);

    const rail = new THREE.Mesh(railGeom, dockingMat);
    rail.position.copy(mid);
    rail.rotation.y = -angle;
    rail.castShadow = true;
    rail.receiveShadow = true;
    group.add(rail);

    const pogo = new THREE.Mesh(pogoGeom, connectorMat);
    pogo.position.copy(mid).add(new THREE.Vector3(0, 0.02, 0));
    pogo.rotation.x = Math.PI / 2;
    pogo.castShadow = true;
    pogo.receiveShadow = true;
    group.add(pogo);
  }

  // Telemetry connector on one edge
  const shellGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.11, 24);
  const shell = new THREE.Mesh(shellGeom, connectorMat);
  shell.rotation.z = Math.PI / 2;
  shell.position.set(edgeVerts[0].x + 0.04, BASE_THICKNESS + 0.04, edgeVerts[0].y);
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  const socketBaseGeom = new RoundedBoxGeometry(0.09, 0.018, 0.06, 5, 0.006);
  socketBaseGeom.rotateZ(Math.PI / 2);
  const socketBase = new THREE.Mesh(socketBaseGeom, dockingMat);
  socketBase.position.set(shell.position.x - 0.012, BASE_THICKNESS + 0.021, shell.position.z);
  socketBase.castShadow = true;
  socketBase.receiveShadow = true;
  group.add(socketBase);

  const grommetGeom = new THREE.TorusGeometry(0.032, 0.005, 12, 24);
  const grommet = new THREE.Mesh(grommetGeom, conduitMat);
  grommet.rotation.y = Math.PI / 2;
  grommet.position.copy(shell.position);
  group.add(grommet);

  const cableCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(shell.position.x + 0.05, BASE_THICKNESS + 0.05, shell.position.z),
    new THREE.Vector3(shell.position.x + CABLE_SWEEP * 0.4, BASE_THICKNESS + 0.08, shell.position.z + 0.06),
    new THREE.Vector3(shell.position.x + CABLE_SWEEP, BASE_THICKNESS + 0.04, shell.position.z + 0.1)
  );
  const cableGeom = new THREE.TubeGeometry(cableCurve, 24, CABLE_RADIUS, 12, false);
  const cable = new THREE.Mesh(cableGeom, conduitMat);
  cable.castShadow = true;
  cable.receiveShadow = true;
  group.add(cable);

  const cableShroudGeom = new THREE.TubeGeometry(cableCurve, 16, CABLE_RADIUS * 1.35, 8, false);
  const cableShroud = new THREE.Mesh(cableShroudGeom, conduitMat.clone());
  cableShroud.material.opacity = 0.7;
  cableShroud.material.transparent = true;
  cableShroud.position.y -= 0.002;
  group.add(cableShroud);

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

  const dockingMaterial = new THREE.MeshStandardMaterial({
    color: 0x5a6472,
    metalness: 0.7,
    roughness: 0.35
  });
  const dockingHardware = createDockingHardware(dockingMaterial);
  group.add(dockingHardware);

  const connectorMaterial = new THREE.MeshStandardMaterial({
    color: 0xffac4b,
    metalness: 1.0,
    roughness: 0.3,
    emissive: 0x332000,
    emissiveIntensity: 0.2
  });
  const connector = createConnector(connectorMaterial);
  group.add(connector);

  const labelGeom = new THREE.BoxGeometry(PANEL_LENGTH * 0.95, 0.001, PANEL_WIDTH * 0.95);
  const labelMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.03 });
  const label = new THREE.Mesh(labelGeom, labelMaterial);
  label.position.y = cover.position.y + 0.009;
  group.add(label);

  scene.add(group);
  return group;
}

 main
type DustParticle = {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  mass: number;
  charge: number;
  adhesion: number;
  attached: boolean;
 codex/implement-electrodynamic-dust-physics-simulation-46k6tb
  collected: boolean;
  collectTimer: number;

 main
};

function sampleRadius() {
  const t = Math.random();
  return DUST_RADIUS_MIN + (DUST_RADIUS_MAX - DUST_RADIUS_MIN) * Math.pow(t, 1.8);
}

function spawnDustParticle(geom: THREE.SphereGeometry, material: THREE.Material) {
  const mesh = new THREE.Mesh(geom, material);
  mesh.castShadow = true;

  const particle = {
    mesh,
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    radius: 0,
    mass: 0,
    charge: 0,
    adhesion: 0,
 codex/implement-electrodynamic-dust-physics-simulation-46k6tb
    attached: true,
    collected: false,
    collectTimer: 0

    attached: true
 main
  } as DustParticle;

  respawnParticle(particle, true);
  return particle;
}

function respawnParticle(particle: DustParticle, fresh = false) {
  const radius = sampleRadius();
  const volume = (4 / 3) * Math.PI * Math.pow(radius, 3);
  const mass = volume * DUST_DENSITY;
  const charge = THREE.MathUtils.lerp(DUST_CHARGE_MIN, DUST_CHARGE_MAX, Math.random());
  const adhesion = ADHESION_PER_AREA * Math.PI * radius * radius;

  particle.radius = radius;
  particle.mass = mass;
  particle.charge = charge;
  particle.adhesion = adhesion;
  particle.attached = true;
 codex/implement-electrodynamic-dust-physics-simulation-46k6tb
  particle.collected = false;
  particle.collectTimer = 0;

  const spawnPoint = samplePointInHex(0.88);
  particle.position.set(spawnPoint.x, PANEL_SURFACE_Y + 0.002 + Math.random() * 0.02, spawnPoint.z);


  particle.position.set(
    (Math.random() - 0.5) * PANEL_LENGTH * 0.9,
    PANEL_THICKNESS * 0.6 + Math.random() * 0.05,
    (Math.random() - 0.5) * PANEL_WIDTH * 0.9
  );
 main
  particle.velocity.set((Math.random() - 0.5) * 0.01, 0, (Math.random() - 0.5) * 0.01);

  particle.mesh.position.copy(particle.position);

  if (!fresh) {
    particle.mesh.rotation.set(0, 0, 0);
  }
}

function createDustField(scene: THREE.Scene) {
  const dustGeom = new THREE.SphereGeometry(0.008, 10, 10);
  const dustMat = new THREE.MeshStandardMaterial({
    color: 0xffdcb0,
    emissive: 0x331f0a,
    emissiveIntensity: 0.3,
    metalness: 0.05,
    roughness: 0.4
  });

  const particles: DustParticle[] = [];
  for (let i = 0; i < NUM_DUST_PARTICLES; i++) {
    const p = spawnDustParticle(dustGeom, dustMat);
    p.mesh.position.copy(p.position);
    particles.push(p);
    scene.add(p.mesh);
  }
  return particles;
}

function computeFieldAt(position: THREE.Vector3, time: number) {
 codex/implement-electrodynamic-dust-physics-simulation-46k6tb
  const angle = Math.atan2(position.z, position.x);
  const sector = ((angle + Math.PI) / (2 * Math.PI)) * ELECTRODE_SEGMENTS;
  const laneIndex = Math.max(0, Math.min(ELECTRODE_SEGMENTS - 1, Math.floor(sector)));
  const phase = time * 2 * Math.PI * WAVE_FREQUENCY + laneIndex * PHASE_SHIFT;

  const Ey = FIELD_BASE + FIELD_TRAVEL * Math.sin(phase);
  const tangential = FIELD_LATERAL * Math.cos(phase);
  const radialKick = FIELD_LATERAL * 0.25 * Math.sin(phase + Math.PI / 4);

  const radialDir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const tangentDir = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
  const horizontal = radialDir.multiplyScalar(radialKick).add(tangentDir.multiplyScalar(tangential)).add(DIRECTIONAL_DRIFT);

  return new THREE.Vector3(horizontal.x, Ey, horizontal.z);
}

function stepDust(particles: DustParticle[], dt: number, time: number) {
  const panelY = PANEL_SURFACE_Y;
  const boundsScale = TRENCH_OUTER_SCALE * 1.05;

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

  const laneSpacing = PANEL_WIDTH / LANE_COUNT;
  const laneIndex = Math.max(0, Math.min(LANE_COUNT - 1, Math.floor((position.z + PANEL_WIDTH / 2) / laneSpacing)));
  const phase = time * 2 * Math.PI * WAVE_FREQUENCY + laneIndex * PHASE_SHIFT;

  const Ey = FIELD_BASE + FIELD_TRAVEL * Math.sin(phase);
  const Ez = FIELD_LATERAL * Math.cos(phase);

  return new THREE.Vector3(0, Ey, Ez);
}

function stepDust(particles: DustParticle[], dt: number, time: number) {
  const panelY = PANEL_THICKNESS / 2 + 0.01;
  const boundsX = PANEL_LENGTH * 0.55;
  const boundsZ = PANEL_WIDTH * 0.55;

  for (const p of particles) {
    const field = computeFieldAt(p.position, time);
    const Fy = p.charge * field.y - p.mass * MARTIAN_GRAVITY;
 main
    const Fz = p.charge * field.z;

    if (p.attached) {
      const upwardForce = Fy;
      if (upwardForce > p.adhesion) {
        p.attached = false;
        p.velocity.y += (upwardForce - p.adhesion) / p.mass * dt;
      } else {
        p.velocity.setScalar(0);
        p.position.y = panelY;
        p.mesh.position.copy(p.position);
        continue;
      }
    }

    const ay = Fy / p.mass;
 codex/implement-electrodynamic-dust-physics-simulation-46k6tb
    const ax = Fx / p.mass;
    const az = Fz / p.mass;

    p.velocity.x += ax * dt;

    const az = Fz / p.mass;

 main
    p.velocity.y += ay * dt;
    p.velocity.z += az * dt;

    p.velocity.multiplyScalar(1 - DRAG_COEFF * dt);
    p.position.addScaledVector(p.velocity, dt);

    if (p.position.y < panelY) {
      p.position.y = panelY;
 codex/implement-electrodynamic-dust-physics-simulation-46k6tb
      p.velocity.y *= -0.22;
      p.velocity.x *= 0.92;
      p.velocity.z *= 0.92;
    }

    const speed = p.velocity.length();
    const stretch = THREE.MathUtils.clamp(1 + speed * 12, 1, 3.8);
    if (speed > 1e-4) {
      const dir = p.velocity.clone().normalize();
      const quat = new THREE.Quaternion();
      quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      p.mesh.quaternion.copy(quat);
    }
    p.mesh.scale.set(1, Math.max(0.7, 1 + speed * 2.4), stretch);

    if (!isInsideHex(p.position, TRENCH_INNER_SCALE) && p.position.y < BASE_THICKNESS + CARTRIDGE_HEIGHT * 2) {
      if (isInsideHex(p.position, TRENCH_OUTER_SCALE)) {
        p.collected = true;
        p.collectTimer = 0;
        p.position.y = BASE_THICKNESS + CARTRIDGE_HEIGHT / 2;
        p.velocity.setScalar(0);
        p.mesh.position.copy(p.position);
        continue;
      }
    }

    if (!isInsideHex(p.position, boundsScale) || p.position.y > 2.5) {

      p.velocity.y *= -0.2;
    }

    if (Math.abs(p.position.x) > boundsX || Math.abs(p.position.z) > boundsZ || p.position.y > 2.5) {
 main
      respawnParticle(p);
      continue;
    }

    p.mesh.position.copy(p.position);
  }
}

export function initAncilliaScene(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
 codex/implement-electrodynamic-dust-physics-simulation-46k6tb
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
 main
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050711);

  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 120);
  camera.position.set(5.5, 3.6, 6.2);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGenerator.fromScene(new RoomEnvironment()).texture;
  scene.environment = envTex;
  pmremGenerator.dispose();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.target.set(0, 0.25, 0);

 codex/implement-electrodynamic-dust-physics-simulation-46k6tb
  const ambient = new THREE.AmbientLight(0x0d1018, 0.34);
  scene.add(ambient);


 main
  const hemi = new THREE.HemisphereLight(0xffffff, 0x1a1d27, 0.45);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
  keyLight.position.set(6, 9, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x88aaff, 0.5);
  rimLight.position.set(-6, 5, -4);
  scene.add(rimLight);

 codex/implement-electrodynamic-dust-physics-simulation-46k6tb
  const grazeLight = new THREE.DirectionalLight(0xb7ccff, 0.42);
  grazeLight.position.set(3.4, 1.2, -3.8);
  grazeLight.target.position.set(0, PANEL_SURFACE_Y, 0);
  scene.add(grazeLight);
  scene.add(grazeLight.target);

  const accent = new THREE.SpotLight(0xffe6c5, 0.55, 18, Math.PI / 6, 0.35, 1.2);
  accent.position.set(-3, 6, 3.4);
  accent.target.position.set(0.4, 0.4, 0.2);
  accent.castShadow = true;
  accent.shadow.mapSize.set(1024, 1024);
  scene.add(accent);
  scene.add(accent.target);


 main
  const groundGeom = new THREE.CircleGeometry(12, 64);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x0b0d16,
    metalness: 0.3,
    roughness: 0.9
  });
  const ground = new THREE.Mesh(groundGeom, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.16;
  ground.receiveShadow = true;
  scene.add(ground);

  const { group: module, materials: moduleMaterials } = createModule(scene);
  const dust = createDustField(scene);

  const modeStatusEl = document.getElementById('mode-status');
  applyMode('blueprint', moduleMaterials, modeStatusEl);

  let currentMode: 'concept' | 'blueprint' = 'blueprint';
  window.addEventListener('keydown', (event) => {
    if (event.key === '1' && currentMode !== 'concept') {
      currentMode = 'concept';
      applyMode('concept', moduleMaterials, modeStatusEl);
    }
    if (event.key === '2' && currentMode !== 'blueprint') {
      currentMode = 'blueprint';
      applyMode('blueprint', moduleMaterials, modeStatusEl);
    }
  });

  const clock = new THREE.Clock();
  function animate() {
    const delta = clock.getDelta();
    const elapsed = clock.elapsedTime;
    module.rotation.y += delta * 0.2;
    stepDust(dust, delta, elapsed);
    controls.update();
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(animate);

  const handleResize = () => {
    const { clientWidth, clientHeight } = container;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight);
  };
  window.addEventListener('resize', handleResize);
}
