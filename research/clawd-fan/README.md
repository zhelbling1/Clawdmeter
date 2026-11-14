# Fan-made Clawd animations

**Not official Anthropic art.** Everything here was drawn or authored by fans
of Clawd, Anthropic's mascot, and is kept apart from `../clawd-official/`,
which holds only Anthropic's own assets. The user's fork plays these on the
device alongside the official ones; `tools/convert_official_clawd.js` reads
both folders and tags the fan-made entries `category "fan"` in the generated
`firmware/src/splash_animations.h`.

**Licence status: none of these forks has a licence file** (GitHub reports no
licence for any of them), so there is no grant to redistribute or modify. They
are included with credit, by the fork owner's choice to publish them openly;
if an author objects, delete the files and their `ANIMS` entries and
regenerate. The characters themselves are Anthropic's.

## Sources

| Item | Author / fork | Files here | Where it plays |
|---|---|---|---|
| Baking | rizowski, <https://github.com/rizowski/Clawdmeter> (default branch `main`, imported at commit `a0dda1d4`) | `Clawd-Baking.gif`, authored by `tools/author_clawd_baking.js` | Heavy mood group |
| Eating | rizowski, same fork | `Clawd-Eating.gif`, authored by `tools/author_clawd_eating.js` | Idle mood group, calm dip |
| TB1982's drawn set (10) | TB1982 ("Nova"), <https://github.com/TB1982/Clawdmeter>, branch `nova` (imported at `32396867`), `tools/drawn_anims/*.json`; preview <https://tb1982.github.io/Clawdmeter/> | `tb1982/*.json` | see below |

rizowski's GIFs are 2750x1850 (50 px per art-pixel), the official core canvas,
so they enter the converter exactly as the official GIFs do. `tools/` holds
rizowski's authoring scripts and their shared drawing kit `clawd_art.js`
(`node tools/author_clawd_baking.js` re-renders the GIF; it needs ImageMagick).
They are copied verbatim.

The converted JSON files are TB1982's palette-index grids (`palette` of hex
colours, `frames[].grid` of palette indices, `frames[].hold` in ms), copied
verbatim from `tools/drawn_anims/` of the `nova` branch; `tb1982/README.upstream.md`
is his format note. 20x20 grids draw Clawd with a finer pixel than the
official art, so the converter stretches each source column and row to a fixed
number of stage cells (`GRID_SPECS` in the converter): his body, arms, 2x2
eyes and 4-row legs land exactly on the official Clawd's silhouette, and his
body and eye colours snap to the official `#D87656` and `#141413` so the
palette recolour still applies. The 40x40 `jumping blossom` is already at the
official scale and is only offset onto the stage. A drawing's bottom source
row (the 20th) falls one cell below the 55x37 stage and is clipped; that only
trims backdrop (water, roof, fire) in the scenic ones.

Skipped from his fork: the claudepix-derived `custom_anims/` versions and
corrections, the weather and market animations, `work mode` (152 frames),
`waiting`, `opening`, and the dance/expression/work sets that only correct
claudepix originals.

## TB1982's animations and where they play

| Name | Frames | Plays in |
|---|---|---|
| idle blossom | 6 | Idle group, calm dip |
| idle hearts | 13 | Idle group, calm dip, and a corner act (24x28, same left edge as the seated Clawd) |
| fm listening (headphones) | 16 | Normal group |
| swim summer (sunglasses, ring) | 14 | Normal group |
| space | 8 | Normal group |
| work out (dumbbells) | 8 | Active group |
| surfing | 8 | Active group |
| hanabi (fireworks over a roof; Clawd himself is not drawn) | 30 | Active group |
| jumping blossom (40x40) | 14 | Active group |
| this is fine | 10 | Heavy group |

Frame counts are after the converter collapses repeated frames.
