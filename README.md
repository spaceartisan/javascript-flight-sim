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
| Toggle flight audio | U |
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

## Authored texture & material overhaul (v0.3)

AERONAUT's live GLBs now include **actual authored color maps, roughness maps, normal maps, and vector decals** baked into the shipped models. This pass modifies the production aircraft, drone, missile and airfield kit rather than creating unused demonstrations.

- **Inkscape 1.4:** original SVG decal sheet, rasterized into a transparent texture atlas. Wing roundels, tactical stencils, hangar signage and fuel warnings are visible on real 3D model surfaces.
- **Krita 5.3.4:** multilayer OpenRaster weathering passes for aircraft paint and hangar panels, exported and optimized for GLB textures.
- **Blender 5.2.1:** planar mapped UV coordinates on every mesh, material color/roughness/normal image nodes and packed textures in the editable source. All four exported GLBs include textures and UVs.
- **GIMP 3.0.4:** attempted from the provided tool installation, but its batch interpreter could not initialize, so no GIMP export was used. No claim is made otherwise.
- **Runtime:** unchanged GLTFLoader integration and flight systems, with no extra texture requests because the maps are embedded in the GLBs. Material source artwork lives in two ZIP parts under `assets/materials`. The generator reassembles them on demand.

Actual Blender Cycles previews: [textured Kestrel](docs/previews/jet-material-pass.png) · [textured airfield](docs/previews/airfield-material-pass.png). These are genuine project renders, not stock/reference images.

To reproduce after any geometry refresh:

```bash
blender --background --python tools/build-model-library.py
blender --background --python tools/apply-materials.py
```

See [materials source and licenses](assets/materials/README.md) for editable sources, texture maps and tool-specific details.

## Blender-authored visual overhaul (v0.2)

The aircraft, drones, missile model, main airbase architecture, ground service equipment and environmental props now come from **actual Blender-exported GLB files loaded directly by the running Three.js game**. This replaces the previous in-browser procedural art, rather than merely distributing separate sample models.

The source `assets/models/aeronaut-assets.blend` is an editable Blender 5.2.1 scene, generated and exportable with `tools/build-model-library.py`. Full model and runtime integration details: [assets/models/README.md](assets/models/README.md).

The airfield uses a 12-module Blender kit — detailed hangars, an octagonal control tower, operations building, fuel tanks, radar, service carts, maintenance crates, airfield signs, precision approach indicator housings, rocks, bushes, and conifers. Existing runway and terrain geometry stays procedural because it feeds the collision/flight model, but visible aircraft/structure/prop geometry is now authored in Blender.

- `models.js`: asynchronous GLB loading, pilot aircraft replacement, attachment rebinds, drone and missile swaps, modular airbase population and source-geometry fallback.
- `assets/models/*.glb`: four production aircraft/drone/missile/architecture assets.
- `assets/models/aeronaut-assets.blend`: editable source geometry and materials.
- `tools/build-model-library.py`: reproducible Blender authoring and glTF export.
- `tools/render-preview.py`: studio preview renders of the real Blender exports.

Shaders and realistic environment can still be improved further (texture atlases, ground clutter LOD, cockpit interior). The model swap preserves physics and gameplay.

## Project structure

- `index.html` — flight deck UI, help/manual, mobile controls and import map.
- `styles.css` — responsive aviation UI design.
- `world.js` — procedural terrain/runway/lighting, temporary geometry fallbacks, and entry point for Blender GLB integration.
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

The Blender export is now used in-game as imported GLB artwork; Blender remains the authoritative editable geometry source.

### GeneralUser GS v2.0.3 sound upgrade (v0.1.2)

The game's sounds now use **ten actual GeneralUser GS recordings rendered from the GeneralUser GS v2.0.3 SoundFont**, packaged as compact Ogg Vorbis assets in `assets/audio/`. FluidSynth renders the SoundFont instruments offline, and Web Audio performs adaptive playback in the browser. No 31 MB SF2 is downloaded at runtime.

- **Engine:** sampled GeneralUser helicopter, polysynth and warm pad presets, with live pitch, filtering and gain driven by turbine spool.
- **Afterburner:** GeneralUser sweep pad, atmosphere and helicopter layers; only rises audibly above 78% spool.
- **Airflow:** GeneralUser seashore and helicopter layers, modulated by IAS, camera view and filtering.
- **Systems:** GeneralUser glockenspiel/crystal selector, seeker-lock, woodblock/taiko gear/flap, and synth-lead caution cues.
- **Combat:** GeneralUser gunshot/synth-drum/orchestral-hit missile launch and target impact cues.
- **Sortie complete:** GeneralUser music-box and warm-pad victory motif.

The procedural oscillators and noise remain intentionally **quiet**: they fill the broadband attack and smooth transitions and provide a fallback if loading or decoding an Ogg sample fails. Audio starts only on the player's **INITIATE FLIGHT** gesture. **U** toggles mute. All samples are static assets, served from relative URLs on GitHub Pages; `audio.js` preloads them asynchronously and degrades gracefully.

To rerender from the actual SoundFont in `DEV_TOOLS/audio.zip`:

```sh
python3 tools/render-generaluser.py /path/to/GeneralUser-GS.sf2 assets/audio
npm test
```

Requires Python 3, numpy, scipy, soundfile, and `libfluidsynth.so.3`. The generator and SoundFont license notes are kept in source control; the original SF2 is not bundled. See `assets/audio/README.md` for instruments and attribution.

## Validation

```sh
npm test
```

This runs JavaScript module syntax checks and basic source/API/instrument consistency checks. A full visual/browser test requires an actual GPU-capable browser with network access to the Three.js CDN. If the CDN is blocked, the 3D scene cannot initialize.

## Roadmap

Proper cockpit meshes and MFDs; higher-resolution UV seam treatment; LODs; joystick/Gamepad API and rebinding; instrumented flight surfaces and and MFDs; joystick/Gamepad API and rebinding; instrument landing system, ATC and approach cues; weather and cloud layers; enemy aircraft with dogfight AI; runway lighting and navigation aids; audio bank exports from Csound; stronger automated Playwright flight tests.
