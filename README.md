# Ancilia

Electrodynamic Dust Shielding Module (EDSM)

## Quick start

This repo contains a small Three.js demo that visualizes a layered Ancillia module with:

- Hexagonal 38 cm flat-to-flat footprint with a beveled carbon/metal base, perimeter frame, recessed conduit, removable trench, and cartridge-like dust collector ring for chaining modules.
- Transparent cover plate and substrate (dielectric stack) with rim-lit edges, tuned IOR, and a visible metallic bezel so the glass layers read distinctly against the chassis.
- Radial + concentric electrode mesh on fused-silica support, inset pogo-pin edge rails, curved telemetry cable breakout, and visible electrode lanes with docking hardware and rounded chassis detailing.
- Traveling-wave dust animation driven by per-particle charge, mass, adhesion thresholds, and a radial sector electric field tuned for Mars gravity.
- Simple reflective environment lighting (PMREM) over a dark backdrop plus procedural textures (no external assets required).
- Mode toggle: press **1** for the "Concept Demo" palette (benchtop prototype vibe) or **2** for the "Blueprint" palette (production-grade reference).

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

## Two-track build narrative

Use the in-scene mode toggle to align visuals with how you'll present the hardware strategy:

- **Concept Demo (Track A, key `1`)**
  - Represents a benchtop prototype using acrylic/polycarbonate plates, aluminum or 3D-printed frames, and an off-the-shelf HV driver with simple wiring harnesses.
  - Ideal for live demos: shows electric-field-driven dust motion, lets you record clearance percentages, and keeps the bill of materials cheap and fast to fabricate.

- **Blueprint (Track B, key `2`)**
  - Represents the production vision: stainless/graphene traces, carbon-fiber or PEEK isolation, conformal dielectric/anti-stick coatings, and higher-spec telemetry harnessing.
  - Use this view for proposal decks, showing the target materials stack and chained-module interfaces while the physics animation runs.

Pair the visual mode with slides or captions that call out which parts are validated today (Track A) and which are roadmap (Track B).

## Syncing with the latest Codex changes

If you’re editing in Codex and pulling locally, use this flow to keep your machine in sync:

1. Verify the most recent commits exist on GitHub (Codex auto-pushes):
   - <https://github.com/Zaki-unstoppable/Ancilia/tree/work>
2. Pull the updates on your workstation:
   ```bash
   git pull
   ```
3. Start the dev server locally:
   ```bash
   npm run dev
   ```

With Vite running, subsequent `git pull` commands will trigger live reloads so you always preview the newest Codex changes.

## Merge hygiene

If you ever resolve conflicts locally, make sure to remove any leftover `<<<<<<<`, `=======`, or `>>>>>>>` markers before committing. A quick `rg "<<<<<<<"` from the repo root will confirm the workspace is clean.
