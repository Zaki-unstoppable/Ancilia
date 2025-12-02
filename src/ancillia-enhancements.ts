// @ts-nocheck

import * as THREE from 'three';

// Match main scene geometry (point-to-point 0.44 m → radius)
const HEX_POINT = 0.44;
const HEX_RADIUS = HEX_POINT / 2;

function anisotropicNormal(size = 512, density = 26) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const streak = Math.sin((x / size) * Math.PI * density) * 0.5 + 0.5;
      const noise = Math.random() * 0.15;
      const v = 128 + (streak - 0.5) * 80 + noise * 255;
      img.data[idx] = 128;
      img.data[idx + 1] = v;
      img.data[idx + 2] = 128;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = 4;
  return tex;
}

// ===============================================================
//  ADD-ON FOR: ancillia-scene.ts
//  Enhances visuals WITHOUT modifying your core file.
// ===============================================================

export function enhanceAncilliaDevice(scene, module, materials) {
  // -------------------------------------------------------------
  // 0) Mars-ish lighting tweak (warmer, dustier)
  // -------------------------------------------------------------
  scene.background = new THREE.Color(0x050306); // deep, warm black

  scene.traverse((obj: any) => {
    if (obj.isHemisphereLight) {
      obj.skyColor.set(0xfff0cf);
      obj.groundColor.set(0x3a1405);
      obj.intensity = 0.55;
    }
    if (obj.isDirectionalLight) {
      obj.color.set(0xffdfb0);
      obj.intensity *= 0.95;
    }
    if (obj.isSpotLight) {
      obj.color.set(0xffe2b8);
    }
  });

  // soft rim highlight to catch machined edges
  const rimRing = new THREE.Mesh(
    new THREE.RingGeometry(HEX_RADIUS * 0.95, HEX_RADIUS * 1.08, 6 * 8),
    new THREE.MeshBasicMaterial({
      color: 0x9fc8ff,
      transparent: true,
      opacity: 0.08,
    })
  );
  rimRing.rotation.x = -Math.PI / 2;
  rimRing.position.y = 0.0005;
  scene.add(rimRing);

  // -------------------------------------------------------------
  // 1) THIN-FILM INTERFERENCE (Rainbow Gold Electrodes)
  // -------------------------------------------------------------
  const thinFilmMat = new THREE.ShaderMaterial({
    uniforms: {
      baseColor: { value: new THREE.Color(0xdba85e) },
      thickness: { value: 420e-9 }, // center wavelength ~500–600nm
      iorLayer: { value: 1.45 },
      iorSubstrate: { value: 1.9 },
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

      float fresnelReflectance(float cosI, float n1, float n2) {
          float r0 = (n1 - n2) / (n1 + n2);
          r0 = r0 * r0;
          return r0 + (1.0 - r0) * pow(1.0 - cosI, 5.0);
      }

      void main() {
          vec3 N = normalize(vNormal);
          vec3 V = normalize(vViewDir);
          float cosI = clamp(dot(N, V), 0.0, 1.0);

          // single-layer phase term
          float lambda = 550e-9;
          float phase = 4.0 * 3.14159 * thickness * iorLayer / lambda * cosI;

          float shiftR = 0.5 + 0.5 * sin(phase * 1.00 + 0.3);
          float shiftG = 0.5 + 0.5 * sin(phase * 1.18 + 1.1);
          float shiftB = 0.5 + 0.5 * sin(phase * 1.35 + 2.3);

          vec3 film = baseColor * vec3(shiftR, shiftG, shiftB);

          float F = fresnelReflectance(cosI, 1.0, iorLayer);
          vec3 color = mix(baseColor, film, F);

          gl_FragColor = vec4(color, 1.0);
      }
    `,
    transparent: false,
  });

  // Replace only the metallic lane meshes with thin-film shader
  module.traverse((obj: any) => {
    if (obj.isMesh && obj.material === materials.lanes) {
      obj.material = thinFilmMat;
    }
  });

  // -------------------------------------------------------------
  // 2) CHROMATIC FALLOFF + MICRO-DUST on COVER GLASS
  // -------------------------------------------------------------

  // add micro-scratch normal to sell physical glass
  const scratchNormal = anisotropicNormal(512, 18);
  if (scratchNormal) {
    materials.cover.normalMap = scratchNormal;
    materials.cover.normalScale = new THREE.Vector2(0.2, 0.45);
  }

  // Tiny noise texture as roughness map (micro dust)
  const dustSize = 256;
  const dustCanvas = document.createElement('canvas');
  dustCanvas.width = dustCanvas.height = dustSize;
  const dctx = dustCanvas.getContext('2d');
  if (dctx) {
    const img = dctx.createImageData(dustSize, dustSize);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 180 + Math.random() * 65; // bright-ish
      img.data[i] = v;
      img.data[i + 1] = v - 10;
      img.data[i + 2] = v - 20;
      img.data[i + 3] = 255;
    }
    dctx.putImageData(img, 0, 0);
  }
  const dustTex = new THREE.CanvasTexture(dustCanvas);
  dustTex.wrapS = dustTex.wrapT = THREE.RepeatWrapping;
  dustTex.repeat.set(8, 8);

  materials.cover.roughnessMap = dustTex;
  materials.cover.needsUpdate = true;

  // Chromatic edge tint + animated shimmer
  materials.cover.onBeforeCompile = (shader: any) => {
    shader.uniforms.chromaticSpread = { value: 0.14 };
    shader.uniforms.shimmerPhase = { value: 0.0 };

    // save ref so we can animate later
    materials.cover.userData.shader = shader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <output_fragment>',
      `
        #include <output_fragment>

        // chromatic dispersion by view angle + shimmer phase
        float viewAngle = dot(normalize(vNormal), normalize(vViewPosition));
        float dispersion = pow(abs(viewAngle), 1.3);

        float phase = shimmerPhase * 3.14159 * 2.0;
        float wobble = 0.5 + 0.5 * sin(phase + viewAngle * 6.0);

        vec3 tint = vec3(
          1.0 - dispersion * chromaticSpread * 0.8,
          1.0,
          1.0 + dispersion * chromaticSpread * 1.4 * wobble
        );

        gl_FragColor.rgb *= tint;
      `
    );
  };
  materials.cover.needsUpdate = true;

  // -------------------------------------------------------------
  // 3) DIELECTRIC STACK RINGS NEAR TOP SURFACE
  // -------------------------------------------------------------
  const bbox = new THREE.Box3().setFromObject(module);
  const topY = bbox.max.y;

  const stackGroup = new THREE.Group();
  const offsets = [0.0004, 0.0008, 0.0012];

  offsets.forEach((off, i) => {
    const inner = HEX_RADIUS * (0.28 + i * 0.04);
    const outer = HEX_RADIUS * (0.9 - i * 0.03);
    const g = new THREE.RingGeometry(inner, outer, 6 * 4, 1);
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.58 + i * 0.02, 0.35, 0.65),
      roughness: 0.5,
      metalness: 0.08,
      opacity: 0.28,
      transparent: true,
    });
    const layer = new THREE.Mesh(g, m);
    layer.rotation.x = -Math.PI / 2;
    layer.position.y = topY + off;
    stackGroup.add(layer);
  });

  module.add(stackGroup);

  // -------------------------------------------------------------
  // 4) TRENCH COLLECTOR GLOW (heuristic)
  // -------------------------------------------------------------
  const trenchMaterial = new THREE.MeshStandardMaterial({
    color: 0x405070,
    emissive: 0x18284f,
    emissiveIntensity: 0.0,
    transparent: true,
    opacity: 0.55,
  });

  const trenchTargets: any[] = [];

  module.traverse((obj: any) => {
    if (!obj.isMesh || !obj.material) return;

    // Heuristic: original trench material was dark grey; geometry is an Extrude
    const mat = obj.material;
    if (
      obj.geometry &&
      obj.geometry.type === 'ExtrudeGeometry' &&
      mat.color &&
      mat.color.getHex &&
      mat.color.getHex() === 0x2b2f38 // matches your trenchMat color
    ) {
      obj.material = trenchMaterial;
      trenchTargets.push(obj);
    }
  });

  // -------------------------------------------------------------
  // 5) CABLE DEFORMATION (TubeGeometry instead of .name)
  // -------------------------------------------------------------
  const cableTargets: any[] = [];
  module.traverse((obj: any) => {
    if (
      obj.isMesh &&
      obj.geometry &&
      obj.geometry.type === 'TubeGeometry'
    ) {
      cableTargets.push(obj);
      if (obj.material && obj.material.roughness !== undefined) {
        obj.material.roughness = 0.9;
        obj.material.metalness = 0.15;
      }
    }
  });

  function deformCable(mesh: any, t: number) {
    const geo = mesh.geometry;
    if (!geo.isBufferGeometry) return;

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const r = Math.sqrt(x * x + z * z);
      const wave =
        0.0018 * Math.sin(r * 18.0 + t * 2.2) +
        0.001 * Math.sin(x * 10.0 - t * 1.7);
      pos.setY(i, y - wave);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  // -------------------------------------------------------------
  // 6) GLOBAL ENHANCEMENT ANIMATION LOOP
  //    - heat shimmer on glass via chromaticSpread & shimmerPhase
  //    - thin-film thickness breathing
  //    - trench pulsing
  //    - cable sag/waves
  // -------------------------------------------------------------
  const clock = new THREE.Clock();

  function animateEnhancements() {
    const t = clock.getElapsedTime();

    // Animate trench glow (collector active)
    trenchMaterial.emissiveIntensity = 0.25 + 0.25 * Math.sin(t * 3.8);

    // Animate thin-film (slight phase breathing)
    if (thinFilmMat.uniforms.thickness) {
      const base = 420e-9;
      thinFilmMat.uniforms.thickness.value =
        base * (1.0 + 0.12 * Math.sin(t * 1.3));
    }

    // Animate glass shimmer if shader is ready
    const shader = materials.cover.userData.shader;
    if (shader && shader.uniforms && shader.uniforms.shimmerPhase) {
      shader.uniforms.shimmerPhase.value = t * 0.3;
    }

    // Cable deformation
    cableTargets.forEach((mesh) => deformCable(mesh, t));

    requestAnimationFrame(animateEnhancements);
  }

  animateEnhancements();
}
