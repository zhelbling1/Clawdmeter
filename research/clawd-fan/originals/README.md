# Originals: pop-culture gag scenes

Short scenes of Clawd parodying games, music and movies, **made for this
fork and AI-drawn** with the kit in `kit/` (start at `kit/index.js`). They
are not official Anthropic art; Clawd himself is Anthropic's character, and
his body and eyes in every frame come from the official animations. The
design rules are in `docs/originals-style.md`.

Each folder holds one authoring script per scene, the scene GIF the
converter reads, `catalog.json` (mood, loop window, credit, references) and
`preview/` (an 8 px-per-cell GIF and a contact sheet). Re-render a scene with
`node <folder>/<scene>.js`.

## Dances (`music/`)

Dance moves only: no song titles, no lyrics, no likenesses. `music/props.js`
holds what these scenes share: dance poses rearranged from official cells
(arm nubs moved as whole blocks, a rigid head with a body lean, knee bends,
a kicked leg, an arm grafted from another official frame), costume pieces the
kit lacks (backwards cap, gold chain, open party shirt, skinny jeans,
high-tops, flat-brim cap, oversized tee, shoulder pads, wristbands, a full
moon) and the poof-on / poof-off bookends.

| Scene | Script | References |
|---|---|---|
| Moonwalk | `music/moonwalk.js` | The moonwalk and its 1980s stagecraft: white fedora, one sparkly glove, toe stand, hat tip. |
| The Dougie | `music/dougie.js` | The 2010-era dance craze: a hand sliding over the side of the head while leaning and rocking side to side; backwards fitted cap, gold chain. |
| The Bernie | `music/bernie.js` | The late-2010s "Bernie lean": leaning way back, arms loose, swaying; sunglasses and a loud open shirt, with a friend in shades and a bandana leaning beside him. |
| The Jerk | `music/jerk.js` | The late-2000s West Coast street dance: one foot kicked out as the body jerks back, then a step back and rock forward; skinny jeans, bright high-tops, flat-brim cap, shades. |
| Crank That | `music/crank.js` | The 2007 dance craze: the crank, the jump-and-lean on one leg, the flying superhero punch; oversized white tee, bucket hat. |
| Wrecking ball | `music/wreckingball.js` | The 2013 power-ballad music video: riding a giant wrecking ball while hugging its chain, short platinum hair, one tear. The chain runs up through the headroom rows. Mood: heavy. |
| Arm shuffle | `music/shuffle.js` | The famous late-80s music-video dance: a side-to-side shuffle with bent arms, more committed each pass; ginger quiff, trench coat. |
| Zombie dance | `music/zombie.js` | The famous early-80s horror music video's dance: full moon, zombie shuffle with an arm out, sideways claw dance, shoulder shrugs, a bow; red jacket with black V stripes and shoulder pads. |
