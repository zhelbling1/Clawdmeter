# Clawd originals

Pop-culture gag scenes made for this fork. They are AI-drawn with the scene
kit in `kit/` (start at `kit/index.js`), follow the rules in
`docs/originals-style.md`, and use Clawd's official poses cell for cell, with
costumes and props layered on top. Each folder has one authoring script per
scene, a `catalog.json` the converter reads, and `preview/` GIFs and contact
sheets. Re-render a scene with `node <folder>/<script>.js`.

## Gaming

Made for this fork; AI-drawn with the originals kit. All references are
caricature: generic costumes and props, no game sprites, logos or UI rips.
Shared helpers for these scenes (rotation, cartoon eyes, fireworks, the
in-front gap) are in `gaming/props.js`.

| Scene | Script | Mood | References |
| --- | --- | --- | --- |
| The cake is a lie | `gaming/cake.js` | active | Portal (2007): orange jumpsuit tied at the waist, white tank top, long-fall boots, a ceiling portal, the cake that turns out to be a hologram. |
| YOU DIED → Praise the Sun | `gaming/youdied.js` | heavy | Dark Souls (2011): the red "YOU DIED" caption, the bonfire checkpoint, a sun-emblem knight and the arms-up sun salute. |
| Level up! | `gaming/levelup.js` | active | Old School RuneScape woodcutting: chopping a yew until the level-up fireworks. |
| Selling lobbies | `gaming/lobbies.js` | calm | Old School RuneScape: cage-fishing lobsters and the "selling lobbies" trade-chat cry (a crab catching lobsters). |
| Party hat drop | `gaming/partyhat.js` | active | Old School RuneScape: the rare blue party hat and the scramble for a holiday drop. |
| Cardboard box | `gaming/box.js` | active | Metal Gear Solid (1998): hiding under a cardboard box, bandana and sneaking suit, the red "!" alert. |
| Barrel roll | `gaming/barrelroll.js` | active | Star Fox 64 (1997): "Do a barrel roll!" Generic aviator costume; no ships or characters. |
| Arrow to the knee | `gaming/knee.js` | heavy | The Elder Scrolls V: Skyrim (2011): the guard who took an arrow in the knee. Slapstick, no blood. |
