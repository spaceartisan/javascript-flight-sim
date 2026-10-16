# AERONAUT — Tactical Flight Simulator

A **browser-native 3D flight simulator** with a fighter cockpit/HUD, aerodynamic forces, an explorable mountain airbase, runway takeoff and landing, moving drone contacts, infrared missile combat, and synthesized audio. Built for **GitHub Pages** as a static web app.

## Play

Once GitHub Pages is enabled, visit **https://spaceartisan.github.io/javascript-flight-sim/**. You can also serve the repository locally:

```sh
python3 -m http.server 8080
# then open http://localhost:8080
```

Three.js 0.168.0 is pinned via an import map and loaded from jsDelivr. An internet connection is required to load it (and the optional fonts); no build server, npm install, database, or backend is required for gameplay. The hosting path is relative, including assets and modules.

**GitHub Pages setup:** Repository → Settings → Pages → Build and deployment → Deploy from a branch → main → /(root) → Save. The repo contains a `.nojekyll` marker. You can alternatively use a GitHub Pages Actions workflow if configured.

## Controls

| Action | Key |
|---|---|
| Pitch down / up | W / S, or Up / Down |
| Roll left / right | A / D, or Left / Right |
| Rudder left / right | Q / E |
| Increase / decrease throttle | Shift / Ctrl (hold) |
| Afterburner / throttle idle | R / T |
| Wheel brakes | Space (hold while grounded) |
| Landing gear | G |
| Flaps (0°, 12°, 25°) | F |
| Target selection | Tab |
| Launch locked RAZOR-9 missile | M or Enter |
| Camera (chase/cockpit/wing/tower) | V |
| Compact / detailed flight HUD | F2 |
| Stability assist | C |
| Pause | P |
| Controls/help | H |
| Restart after crash | Enter |

Mobile view includes a touch flight-control stick, throttle slider, missile button and gear/flaps/camera buttons. For a complete takeoff and landing, keyboard controls on desktop are recommended.

### Flight-deck presentation (v0.1.1)

The default **Compact HUD** leaves essential speed/altitude/heading/G, attitude, target tracking, radar and weapons on screen without persistent side banners or a keyboard legend. Press **F2**, or use **FULL HUD** in the top-right, to expand the mission panel, system readouts, keyboard help bar and other details.

Warnings use a **single priority annunciator** instead of stacking banners, and transient radio notices fade quickly. The airfield has explicit pavement layer heights, non-overlapping taxiway/runway geometry and polygon depth bias for painted markings. Long-range scenes use logarithmic depth buffering to reduce terrain/pavement flicker. Clouds have fewer, more rounded clusters.

### First flight

1. Click **INITIATE FLIGHT**, then hold Shift (or press R) to spool up.
2. Keep heading down the runway. Once around **145–165 KT**, hold S gently to rotate. Don't over-rotate.
3. When airborne, press G to raise the gear, F to clean up the flaps, and V to try the cockpit.
4. Fly toward the radar contacts; Tab cycles selection. Align your nose until **IR LOCK ACQUIRED** and press M.
5. Eliminate all three moving drones, return to Sierra runway, lower gear, choose flaps, reduce throttle, and land. Brake on rollout using Space. Stopping safely after all contacts are destroyed completes the sortie.
6. If you crash, press Enter to restart.

## Flight model

All forces and motion are integrated in **SI units** at a fixed 90 Hz step. The flight model is designed to be believable, accessible, and tunable — **not aeronautical certification, a full six-degree-of-freedom CFD model, or a real F-16/F-18 simulation**.

- Aircraft mass: **10,600 kg**; wing reference area: **35 m²**.
- Air-density approximation: ρ = 1.225 e^(−altitude/8500) kg/m³.
- Aerodynamic dynamic pressure: q = ½ρV².
- Lift: q × area × C_L; C_L varies with local angle of attack and three flap states.
- Drag: q × area × C_D; incorporates parasitic, induced, landing gear, flap and high-speed compressibility penalties.
- Engine thrust spools toward commanded throttle, with an afterburner regime above 84%.
- Local roll, pitch and rudder rates, coordinated turning response, configurable pitch stability assist, stall-related lift loss, G and AoA indications, wind-relative indicated airspeed proxy, gravity, gear/flap drag, ground friction and brakes.
- Ground detection evaluates gear height, terrain, runway position, bank angle, and vertical impact speed; high-energy impacts result in aircraft loss.
- Missiles steer toward moving targets with finite acceleration, life, range and proximity fuse; this is stylized heat-seeker behavior, not a classified or real weapons model.

Physics shortcuts/known limitations: no detailed engine inlet model, no atmospheric turbulence, no ground effect, no sophisticated landing-gear suspension, no damage accumulation, no multiplayer, and no AI enemy weapons. The HUD uses approximate magnetic heading and uncalibrated airspeed. The world is a fictional training airbase.

## Project structure

- `index.html` — flight deck UI, help/manual, mobile controls and import map.
- `styles.css` — responsive aviation UI design.
- `world.js` — procedural terrain, runway, airbase, clouds, fighters, drone meshes and lighting.
- `sim.js` — flight equations, controls, landing state, AI tracks, guided missiles and mission logic.
- `main.js` — rendering loop, sound runtime, camera, radar, input and live HUD.
- `assets/mark.svg` and `assets/concrete.svg` — scale-independent vector UI/airfield assets. Designed to be editable with **Inkscape** and raster-exportable/editable with **Krita/GIMP**.
- `tools/build-kestrel.py` — Blender 5.x procedural **source** model that exports a separate editable .blend and glTF/GLB aircraft; in-game aircraft is currently procedurally built in Three.js for zero binary downloads and simple GitHub Pages deployment.
- `tools/aeronaut-soundbank.csd` — Csound sound-design source; prototype preview contains turbine spool, missile motor, radar lock chirp and detonation. The runtime currently uses equivalent interactive Web Audio synthesis with throttle- and airspeed-sensitive layers, because offline Csound is not supported directly on GitHub Pages.
- `tests/validate.mjs` — source-sanity check.

### Art and audio asset pipeline

Edit the source vector textures in Inkscape; optionally rasterize/export variants in Krita or GIMP. For geometry iteration run:

```sh
blender --background --python tools/build-kestrel.py
# build/kestrel.blend and build/kestrel.glb
```

For the audio source use:

```sh
csound -d -W -o assets-preview.wav tools/aeronaut-soundbank.csd
```

The Blender export is a source-model development asset, not an in-game imported GLB in this revision. Web Audio handles procedural dynamic engine sounds, air rush, missile launch, warnings and explosions without downloadable sample assets.

## Validation

```sh
npm test
```

This runs JavaScript module syntax checks and basic source/API/instrument consistency checks. A full visual/browser test requires an actual GPU-capable browser with network access to the Three.js CDN. If the CDN is blocked, the 3D scene cannot initialize.

## Roadmap

Higher-detail GLB aircraft and PBR texture atlas; proper cockpit meshes and MFDs; joystick/Gamepad API and rebinding; instrument landing system, ATC and approach cues; weather and cloud layers; enemy aircraft with dogfight AI; runway lighting and navigation aids; audio bank exports from Csound; stronger automated Playwright flight tests.
