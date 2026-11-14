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
thumbs-up glove) in `movies/props_m1.js`.

| Scene | Script | Mood | References |
|---|---|---|---|
| Zed's dead | `movies/zeds_dead.js` | active | The chopper getaway from *Pulp Fiction* (1994): slicked hair, leather jacket, a raked chopper with ape-hanger bars, the two-word caption "ZED'S DEAD". |
| Bullet time | `movies/bullet_time.js` | active | The slow-motion dodge from *The Matrix* (1999): tiny black shades, long black coat, falling green code, bullets with ripple trails. His "bend back" is the official squash pose, since his body can't be redrawn. |
| Thumbs up in lava | `movies/lava_thumbs.js` | heavy | The molten-steel farewell from *Terminator 2: Judgment Day* (1991): leather jacket, dark shades, a slow sink and a last thumbs-up (a white cartoon glove). Slapstick: he pops back out fine. |
| Moon bike | `movies/moon_bike.js` | calm | The flying bicycle crossing the full moon in *E.T. the Extra-Terrestrial* (1982): red hoodie, a BMX with a basket holding a blanket bundle (no character drawn). |
| Bat country | `movies/bat_country.js` | heavy | The desert drive in *Fear and Loathing in Las Vegas* (1998): bucket hat, tinted aviators, cigarette holder, Hawaiian shirt, a red convertible, cartoon bats, the caption "BAT COUNTRY". |

**One deliberate exception to "his body stays orange":** in *Moon bike*,
the cells of Clawd and the bike that pass in front of the moon are drawn as a
dark silhouette (the shot being referenced); everywhere else he keeps his
official colours. The catalog entry carries the same note.

All of these are caricature: costumes and situations only, no actor
likenesses, no logos or studio marks, captions of two words.
