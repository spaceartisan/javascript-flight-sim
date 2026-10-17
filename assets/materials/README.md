# AERONAUT v0.3 – physically mapped materials and vector decals

**These maps are used in the shipped Blender-exported GLBs.** They are not standalone mockups. The original aircraft, drones, weapons and airfield continue to render through Three.js `GLTFLoader`, but now their UV texture maps and decals are embedded inside those GLBs.

## Authoring tools

- **Inkscape 1.4**: authored and rasterized the original `aeronaut-decals.svg` vector sheet containing Kestrel tactical wing markings, designation stencil, SIERRA 07 hangar signage, and JP-8 hazard signage.
- **Krita 5.3.4**: opened and exported multilayer OpenRaster image artwork for the airframe and hangar painted surfaces. Sources: `airframe.ora`, `hangar.ora`; rendered files: `airframe_krita.png`, `hangar_krita.png`. The optimized runtime maps are converted from those actual Krita exports.
- **GIMP 3.0.4**: launch and batch processing were attempted using the supplied distribution. Its environment lacks the compatible GObject introspection/plug-in batch registration required to finish a usable texture export, so **GIMP did not produce a shipped image**. No GIMP usage is claimed beyond that attempt.
- **Blender 5.2.1**: created physical, per-polygon UVs; assigned linked color/roughness/normal-map image nodes and actual Inkscape decal cards; packed images into the editable source `.blend`; exported four GLBs with embedded texture maps.

## Packaged authoring sources

`texture-sources.zip.part01` and `.part02` reassemble into a ZIP that includes a full material map set for airframe, hangar, concrete, metal, roof, service olive and stone, with 512px color, normal and roughness JPEGs; the Inkscape source SVG and transparent PNG decal atlas; Krita layered `.ora` sources; and deterministic Python texture-design scripts. JPG maps intentionally minimize download size. The playable GLBs embed their own map images and do **not** download the ZIP.

## Rebuild

First generate the base source model with Blender, then apply materials, decals and UV projection:

```bash
blender --background --python tools/build-model-library.py
blender --background --python tools/apply-materials.py
```

`apply-materials.py` extracts the authored maps from the two ZIP parts as needed, applies them, packs them into `.blend`, and exports the named GLBs. The source `.blend` remains editable in Blender, including node graphs and UVs.

Visual QA: `docs/previews/jet-material-pass.png`, `docs/previews/airfield-material-pass.png` are **actual Cycles renders of the textured production GLBs**. They are not external reference images.
