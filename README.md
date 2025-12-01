# Ancilia

Electrodynamic Dust Shielding Module (EDSM)

## Quick start

This repo contains a small Three.js demo that visualizes a layered Ancillia module with:

- Transparent cover plate and substrate to represent the dielectric stack, now rim-lit with subtle edge outlines for visual separation.
- Electrode lanes on the EDS surface with metallic rails and docking hardware.
- Rounded chassis with perimeter frame, recessed conduit, and external telemetry cable/connector.
- Traveling-wave dust animation driven by per-particle charge, mass, and adhesion thresholds for a lab-inspired EDS response.
- Simple reflective environment lighting (PMREM) over a dark backdrop plus procedural textures (no external assets required).
- Metallic bezel around the cover plate to make the transparent stack visually distinct.

### Run the viewer

1. Install dependencies (Three + Vite):

   ```bash
   npm install
   ```

2. Start the dev server:

   ```bash
   npm run dev
   ```

3. Open the printed local URL and drag to orbit the model.

> If dependency installs are blocked in your environment, vendor the packages or swap the registry URL, then rerun `npm install`.

### Troubleshooting npm install

If you see a `403 Forbidden` when fetching `three` or other packages, try:

- Explicitly pointing npm at the public registry:

  ```bash
  npm install --registry=https://registry.npmjs.org
  ```

- Verifying that no proxy or offline mirror is overriding the registry (check `npm config get registry`).

Once dependencies resolve successfully, start the dev server with `npm run dev`.
