import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EdgesGeometry, LineBasicMaterial, LineSegments } from 'three';

const PANEL_LENGTH = 4.0;
const PANEL_WIDTH = 2.0;
const PANEL_THICKNESS = 0.05;
const LANE_COUNT = 12;
const LANE_WIDTH = 0.06;
const LANE_HEIGHT = 0.012;
const CABLE_RADIUS = 0.03;
const CABLE_SWEEP = 0.7;

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
const FIELD_LATERAL = 2.8e4; // V/m lateral push along the lanes
const WAVE_FREQUENCY = 42; // Hz, scaled for visual legibility
const PHASE_SHIFT = (2 * Math.PI) / 3; // travelling wave between adjacent lanes
const DRAG_COEFF = 0.45;

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
  const group = new THREE.Group();

  const bumpTexture = makeStripedBumpTexture(LANE_COUNT * 2);
  const roughnessTexture = makeNoiseTexture();

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
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x30343f,
    metalness: 0.78,
    roughness: 0.32,
    roughnessMap: roughnessTexture
  });
  const frame = new THREE.Mesh(frameGeom, frameMat);
  frame.position.y = 0.02;
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  const substrateMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x4466aa,
    transparent: true,
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

  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0x8fb0ff,
    metalness: 0.72,
    roughness: 0.28,
    bumpMap: bumpTexture,
    bumpScale: 0.08,
    roughnessMap: roughnessTexture
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

  const coverMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xa5bfff,
    transparent: true,
    transmission: 0.98,
    opacity: 0.62,
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
  cover.castShadow = true;
  cover.receiveShadow = true;
  group.add(cover);

  const coverEdges = new LineSegments(
    new EdgesGeometry(coverGeom, 30),
    new LineBasicMaterial({ color: 0xbdd5ff, transparent: true, opacity: 0.9 })
  );
  coverEdges.position.copy(cover.position);
  group.add(coverEdges);

  const coverBezelMat = new THREE.MeshStandardMaterial({
    color: 0xbfc5d4,
    metalness: 0.9,
    roughness: 0.18,
    envMapIntensity: 1.25
  });
  const coverBezelGeom = new RoundedBoxGeometry(PANEL_LENGTH * 0.96, 0.01, PANEL_WIDTH * 0.96, 2, 0.016);
  const coverBezel = new THREE.Mesh(coverBezelGeom, coverBezelMat);
  coverBezel.position.y = cover.position.y + 0.008;
  coverBezel.castShadow = true;
  coverBezel.receiveShadow = true;
  group.add(coverBezel);

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
  conduit.castShadow = true;
  conduit.receiveShadow = true;
  group.add(conduit);

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

type DustParticle = {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  mass: number;
  charge: number;
  adhesion: number;
  attached: boolean;
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
    attached: true
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

  particle.position.set(
    (Math.random() - 0.5) * PANEL_LENGTH * 0.9,
    PANEL_THICKNESS * 0.6 + Math.random() * 0.05,
    (Math.random() - 0.5) * PANEL_WIDTH * 0.9
  );
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
    const az = Fz / p.mass;

    p.velocity.y += ay * dt;
    p.velocity.z += az * dt;

    p.velocity.multiplyScalar(1 - DRAG_COEFF * dt);
    p.position.addScaledVector(p.velocity, dt);

    if (p.position.y < panelY) {
      p.position.y = panelY;
      p.velocity.y *= -0.2;
    }

    if (Math.abs(p.position.x) > boundsX || Math.abs(p.position.z) > boundsZ || p.position.y > 2.5) {
      respawnParticle(p);
      continue;
    }

    p.mesh.position.copy(p.position);
  }
}

export function initAncilliaScene(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
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

  const module = createModule(scene);
  const dust = createDustField(scene);

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
