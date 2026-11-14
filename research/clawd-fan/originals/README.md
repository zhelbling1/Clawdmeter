# Original gag scenes

Clawd parodying games, music and movies. **Made for this fork and AI-drawn**
with the originals kit (`kit/`), following the rules in
`docs/originals-style.md`. Not official Anthropic art. Clawd's body and eyes
come cell for cell from the official frames; costumes, props and effects are
drawn around them. Each folder's `catalog.json` lists its scenes for
`tools/convert_official_clawd.js`, and every scene is rebuilt by its own
script (`node <folder>/<scene>.js`), which also writes `preview/<scene>.gif`
and a contact sheet.

## Movies, set 1

Scripts in `movies/`; shared props and costume pieces (chopper, BMX,
convertible, lava pool, code rain, bullets with ripples, moon, bats, tiny
shades, open coat, tinted aviators, hoodie, Hawaiian shirt, cigarette holder,
thumbs-up glove; some are unused since Moon bike was cut) in `movies/props_m1.js`.

| Scene | Script | Mood | References |
|---|---|---|---|
| Zed's dead | `movies/zeds_dead.js` | active | The chopper getaway from *Pulp Fiction* (1994): slicked hair, leather jacket, a raked chopper with ape-hanger bars, the two-word caption "ZED'S DEAD". |
| Bullet time | `movies/bullet_time.js` | active | The slow-motion dodge from *The Matrix* (1999): tiny black shades, long black coat, falling green code, bullets with ripple trails. His "bend back" is the official squash pose, since his body can't be redrawn. |
| Thumbs up in lava | `movies/lava_thumbs.js` | heavy | The molten-steel farewell from *Terminator 2: Judgment Day* (1991): leather jacket, dark shades, a slow sink and a last thumbs-up (a white cartoon glove). Slapstick: he pops back out fine. |
| Bat country | `movies/bat_country.js` | heavy | The desert drive in *Fear and Loathing in Las Vegas* (1998): bucket hat, tinted aviators, cigarette holder, Hawaiian shirt, a red convertible, cartoon bats, the caption "BAT COUNTRY". |

All of these are caricature: costumes and situations only, no actor
likenesses, no logos or studio marks, captions of two words.
## Movies (movies2 set)

Made for this fork; AI-drawn with the originals kit. Caricature only: no
likenesses, logos or quoted lines. Shared helpers for these scenes live in
`movies/props_m2.js` (bookends, curly / floppy / shaggy / messy hair,
eyebrows, grin, laser sword, clash sparks, gold chain, sweat drop, gull).

| Scene | Script | References |
| --- | --- | --- |
| Saber duel | `movies/saber_duel.js` | The laser-sword duel from *The Empire Strikes Back* (1980): a hero with a blue blade against a dark armoured lord (helmet-mask, breathing vent, cape, red blade), and the dramatic reach. No lines quoted. |
| Cup ripples | `movies/cup_ripples.js` | The rippling water glass from *Jurassic Park* (1993): safari hat, denim shirt, red neckerchief, rings in the water at each distant thump. |
| Boulder run | `movies/boulder_run.js` | The temple escape from *Raiders of the Lost Ark* (1981): brown fedora, leather jacket, satchel, whip, a golden idol and the rolling boulder. |
| Here's Clawdy! | `movies/heres_clawdy.js` | The axe-through-the-door scene from *The Shining* (1980), as a cartoon: messy hair, wild eyebrows, a grin through a chopped hole. The caption is a two-word pun. |
## Gaming

Made for this fork; AI-drawn with the originals kit. All references are
caricature: generic costumes and props, no game sprites, logos or UI rips.
Shared helpers for these scenes (rotation, cartoon eyes, fireworks, the
in-front gap) are in `gaming/props.js`.

| Scene | Script | Mood | References |
| --- | --- | --- | --- |
| Level up! | `gaming/levelup.js` | active | Old School RuneScape woodcutting: chopping a yew until the level-up fireworks. |
| Cardboard box | `gaming/box.js` | active | Metal Gear Solid (1998): hiding under a cardboard box, bandana and sneaking suit, the red "!" alert. |
| Portal fall | `gaming/portal.js` | active | Portal (2007): the infinite fall between a blue portal on the floor and an orange one on the ceiling, faster every pass, until they snap shut and he lands dizzy. Generic oval portals; no logos, game UI or cake. |
| Barrel roll | `gaming/barrelroll.js` | active | Star Fox 64 (1997): "Do a barrel roll!" He turns into a Clawd-shaped starfighter (his own body turned on its side as the fuselage, his legs as four engines, drawn-on nose cone, canopy, wing roots and cannons) and rolls with a corkscrew trail. No ships or characters copied. |
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
| Wrecking ball | `music/wreckingball.js` | The 2013 power-ballad music video: riding a giant wrecking ball while hugging its chain, short platinum hair, one tear. The chain runs up through the headroom rows. Mood: heavy. |
| Zombie dance | `music/zombie.js` | The famous early-80s horror music video's dance: full moon, zombie shuffle with an arm out, sideways claw dance, shoulder shrugs, a bow; red jacket with black V stripes and shoulder pads. |

| Rise and shine | `gaming/hl2.js` | active | Half-Life 2 (2004): a Clawd in an orange-and-grey hazard suit (little glasses, goatee, red crowbar) smashes crates while a Clawd in a blue-grey suit with a briefcase flickers in, watches, straightens his tie ("WAKE UP") and glitches away. Costumes only: no lambda or other logos, no game UI or sprites. |