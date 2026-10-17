# AERONAUT / Blender HD Model Library

This directory contains **the real 3D meshes used by AERONAUT**. They are not unused concept files. The game loads these files with Three.js `GLTFLoader` via `models.js`; old procedural airplane/building meshes are fallback-only.

## Source / outputs

- `aeronaut-assets.blend` — editable Blender 5.2.1 source file containing the complete hard-surface asset library.
- `kestrel-hd.glb` — 136-object F-27 Kestrel model: airfoil/fuselage loft, leading-edge slats, intake splitters, tinted framed canopy, tail, wheel struts, twin detailed exhaust iris assemblies, pitot, blade antenna, service details, four missiles on named pylons.
- `skua-drone-hd.glb` — swept UAV with intake/wing geometry, sensor fairings, dorsal panel, rear duct and target accents.
- `razor9-missile-hd.glb` — casing, seeker, cruciform fins and aft nozzle; loaded for actual launched missiles.
- `airfield-kit-hd.glb` — modular Hangar, Tower, Operations, FuelTank, RadarStation, ServiceCart, EquipmentPallet, PAPI, TaxiSign, Rock, Conifer and Bush.

## Regeneration

The authoritative generative/parametric modeling script is `tools/build-model-library.py`:

```sh
blender --background --threads 4 --python tools/build-model-library.py
```

It writes all four GLBs and the editable Blender source to `assets/models/`. To render previews of the saved GLBs:

```sh
blender --background --threads 4 --python tools/render-preview.py -- jet
blender --background --threads 4 --python tools/render-preview.py -- airfield
```

The model preview images are authored and inspected during production and are not loaded by the runtime.

## Runtime integration

`models.js` loads each model independently with relative URLs so GitHub Pages works when served from a subpath. Airplane, drones and missiles replace their procedural counterparts after loading. The airfield kit is cloned/shared for five hangars, tower, operations building, radar installation, tanks, service equipment, taxiway signs, PAPI modules and terrain dressing.

**Stable rig/attachment names:** `Gear`, `Flame_L`, `Flame_R`, `Store_0`, `Store_1`, `Store_2`, `Store_3`. Do not rename these Blender nodes without updating `models.js`; they are connected to flight controls and weapons.

Blender source coordinate convention is X right, Y forward, Z up. glTF 2.0 exports +Y up and maps model forward to the Three.js -Z direction. Runtime placement uses SI meters. Reused props share GLB meshes and materials without downloading per-instance copies.

The procedural terrain and runway *surfaces* intentionally remain real-time geometry (terrain heightfield and collision are gameplay state); authored buildings, vehicles, weapons and aircraft are all GLB meshes. The kit does not assume a specific airfield world origin until placement by `models.js`.

## Visual quality and performance

This is a cohesive, mid-poly real-time art pass, not a CAD-accurate reproduction of a specific military airframe. A restrained painted metal / ceramic / glass material palette and real modeled bevels/rims/seams aim for strong silhouettes without requiring multi-megabyte 4K maps. Shared kit modules and bounded shadows keep static-site rendering manageable. If a GLB fails to load, the aircraft can still be flown with fallback geometry.

Future improvements: UV-unwrapped AO/normal/roughness atlases, close-up cockpit internals, mechanical surface animation, damage states and LODs.
