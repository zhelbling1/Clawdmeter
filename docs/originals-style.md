# Pop-culture scenes: design rules

Rules for the original gag scenes made for this fork (Clawd parodying games,
music and movies). Every scene's authoring script follows these. Edit freely.

## Identity

1. **Clawd is always Clawd.** His body shape and eyes come cell for cell from
   the official frames. His body stays the official orange (`#D87656`) and his
   eyes the official ink (`#141413`), so theme colours still recolour him.
3. **Costumes: go wild.** Wigs, hats, helmets, masks, shades, jackets, ties,
   gloves, armour, capes, full suits. They can cover most of him, but some
   orange body or his eyes must show so he still reads as Clawd (a helmet
   visor may hide the eyes when the gag needs it). Costumes are caricature
   (slicked hair, a fedora, a bandana), never a portrait of an actor.

## Structure

4. **Setup → gag → reaction.** One clear joke, landing in the first few
   seconds, then his reaction.
5. **Start and end on the official idle pose**, so the walk-on and walk-off
   join. The costume appears with a *poof* (a little smoke puff) at the start
   and vanishes with one at the end.
6. **3–8 seconds**, with a loopable middle section (shows hold a scene for
   about 16 s, so the middle repeats).

## Pixel art

7. **Same 55×37-cell stage and scale** as the official animations, plus up to
   11 extra rows above for tall props (hats, the wrecking-ball chain,
   fireworks). At most 16 colours per scene (converter limit).
8. **Chunky and readable:** no detail finer than one cell, strong contrast,
   and the main action kept in the middle so it survives round screens and
   small 240 px panels.
9. **Size budget:** about 40 KB per scene, about 1 MB total. Only on boards
   with 8 MB+ flash (the C6, the S3 boards); the classic ESP32 boards (3 MB
   app slot, 2.56 MB used) keep the current set.

## Pop culture

10. **Reference, don't copy:** props, poses, colours, costumes and situations.
    No logos or trademarks (no studio logos, no Nintendo "?" blocks), no
    ripped game sprites (no OSRS or MGS sprite rips), no actor likenesses.
11. **Text only as a short gag caption** of a few words in a pixel font
    ("!", "LEVEL UP", "ZED'S DEAD"). No song lyrics, no long
    movie quotes.
12. **Cartoon tone:** dying, lava and axes stay slapstick, like "this is
    fine". Nothing gory.

## Where they play

13. **Each scene gets a mood slot:** dances and action go to the active
    shows; dramatic ones (lava, boulder, the saber duel) to the heavy shows; quiet
    ones (cup ripples, the briefcase) to the screensaver's calm dips. All of them
    also join the Next/Previous animation button cycle.

## Process

14. **Every scene comes from a small authoring script** in
    `research/clawd-fan/originals/`. A README credits it as made for this
    fork, notes it's AI-drawn, and lists what it references.
15. **You approve before anything ships.** All scenes go on one preview page
    as big animated GIFs; keep, cut or request changes per scene. Only
    approved ones go on the board.

## The scene list

Kept after the first review (2026-11-14); \* marks a scene being redrawn
or reworked.

**Gaming:** Portal fall\* (Clawd drops through a blue floor portal and out of
an orange ceiling portal, faster each pass); OSRS "Level up!" (chopping a
yew, level-up fireworks); Metal Gear Solid cardboard box + "!" (bandana); Do
a barrel roll\* (he turns into a Clawd-shaped spaceship and rolls); Half-Life
2\* (a Clawd in the orange hazard suit with a crowbar meets a Clawd in the
blue suit with a briefcase).

**Music:** Moonwalk; Wrecking ball; Zombie dance.

**Movies:** The briefcase (slicked hair, black tie); Zed's dead\* (chopper,
gag plays once); Bullet time\*; Thumbs up in lava; Fear and Loathing car
scene\*; Empire lightsaber duel\*; Cup ripples; Boulder run\*; Here's
Clawdy!

Cut in the review: Moon bike, the opal, King of the world, YOU DIED,
Selling lobbies, Party hat drop, the cake is a lie, Arrow to the knee, the
Dougie, the Bernie, the Jerk, Crank That, the arm shuffle.
