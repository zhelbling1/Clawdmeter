# clawd-tank: fan-made Clawd animations

Pixel-art Clawd animations by Marcio Granzotto
([@marciogranzotto](https://github.com/marciogranzotto)), from his
[clawd-tank](https://github.com/marciogranzotto/clawd-tank) project
(`assets/svg-animations/`, commit `ee5c079`), MIT licensed: see `LICENSE`.
The same SVGs are vendored by [unrarp/Clawdmeter](https://github.com/unrarp/Clawdmeter)
(`tools/svg_pipeline/svg/`, byte-identical), whose splash screen first played
them on a Clawdmeter; the clips and moods here follow its choice of twelve.

This is fan art, not Anthropic's. The official animations are in
`../../clawd-official/`.

## Files

- `svg/`: the source SVGs, unchanged (only the ones the firmware uses).
- `*.gif`: each SVG rendered onto Clawd's cell grid by
  `tools/render_clawd_tank.js`, which `tools/convert_official_clawd.js` reads
  (its `TANK_ANIMS` block) into `firmware/src/splash_animations.h`. Re-render
  after changing an SVG or a clip's window, then re-run the converter.

## How they're drawn and converted

The SVGs draw a 15×9-unit Clawd from axis-aligned rects on a 1-unit grid, but
animate them with CSS (rotations, half-unit moves, opacity fades), so a frame
only exists at a point in time. The renderer loads each SVG in headless
Chrome, pauses every animation at a time, screenshots it and samples cell
centres:

- **Scale**: 1 SVG unit = 2 cells, the size of one of Clawd's body pixels in
  the official art (its idle pose is built from 2×2-cell blocks), so every
  rect and half-unit offset lands on whole cells. This Clawd has its own
  proportions (11 units wide, 30 cells with the arms; the official one is
  24), so he's a little bigger than the official Clawd.
- **Placement**: feet on the stage floor (row 37), centred on the official
  idle pose. The GIFs are 48 rows: the 37-row stage plus the performer
  grid's 11 rows above it, for the wizard's hat, the thought bubble and the
  sleeping Zs (`rows: 48` in the converter; those clips get a negative `oy`).
- **Colours**: each clip's own SVG fills, plus the most frequent blends of its
  translucent props (the magnifier lens) while the 16-entry palette has
  room. The body `#DE886D` becomes the official `#D87656`, so the palette's
  Clawd colour repaints him like the official art, and black becomes the
  official eye ink `#141413`. The ground shadow (black on the black panel)
  is dropped; anything under 50 % opacity is background.
- **Timing**: one loop of each clip's main motion, sampled every 50–250 ms
  (slow, long clips coarser). Converted, the 13 clips are about 405 KB of
  cell data (the official set is about 406 KB).

| GIF | Clip | Loop | Plays as |
|---|---|---|---|
| `clawd-idle-living` | tank idle | 16 s @ 200 ms | calm dip, corner act (idle, normal) |
| `clawd-sleeping` | tank sleeping | 6 s @ 200 ms | calm dip |
| `clawd-idle-low-battery` | tank low battery | 8 s @ 250 ms | the calm dip on battery ≤ 20 % |
| `clawd-working-typing` | tank typing | 1.2 s @ 60 ms | Active show |
| `clawd-working-thinking` | tank thinking | 4 s @ 125 ms | Active show |
| `clawd-working-debugger` | tank debugger | 4 s @ 100 ms | Active show |
| `clawd-grooving` | tank grooving | 1.6 s @ 80 ms | Active show |
| `clawd-working-conducting` | tank conducting | 2 s @ 80 ms | Active show |
| `clawd-working-juggling` | tank juggling | 1.2 s @ 60 ms | Active show |
| `clawd-working-wizard` | tank wizard | 3 s @ 100 ms | Active show |
| `clawd-working-carrying` | tank carrying | 2 s @ 50 ms | Heavy show |
| `clawd-working-builder` | tank builder | 3.6 s @ 120 ms | Heavy show |
| `clawd-working-building` | tank building | 2 s @ 100 ms | Heavy show |

Where each plays is in `docs/clawd-director.md`. Not converted: the rest of
the clawd-tank set (crab walking, dizzy, eureka, happy, hat mishap, pushing,
sweeping, …); happy jumps past the headroom, eureka has 18 colours, sweeping
walks off the stage, and the others fit no beat or the flash budget.

```bash
node tools/render_clawd_tank.js            # all clips, 4 tabs in parallel
node tools/render_clawd_tank.js --only "tank wizard" --jobs 1
node tools/render_clawd_tank.js --survey   # each SVG's extent over time
node tools/convert_official_clawd.js       # then regenerate the header
```

The renderer needs Node 22+ and Chrome, Chromium or Edge (`--chrome PATH` or
`$CHROME` if it isn't found).
