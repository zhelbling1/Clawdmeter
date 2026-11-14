#!/usr/bin/env node
/**
 * Costume and effect catalogue: writes kit/costumes.png (every costume on
 * the front idle pose and on a 3/4 pose) and kit/effects.png (poof phases,
 * sparkles, motion lines, notes, beam, font).
 * Usage: node kit/costume_sheet.js
 */
const fs = require('fs');
const path = require('path');
const k = require('./index');
const { sheet } = require('./render');
const C = k.C;

const looks = [
  ['slick', (g, P) => k.slick(g, P)],
  ['platinum', (g, P) => k.platinum(g, P)],
  ['quiff', (g, P) => k.quiff(g, P)],
  ['wild', (g, P) => k.wild(g, P)],
  ['long hair', (g, P) => k.longHair(g, P, { wind: 2, phase: 1 })],
  ['fedora', (g, P) => k.fedora(g, P)],
  ['white fedora', (g, P) => k.fedora(g, P, { c: C.ivory, band: C.charcoal })],
  ['bucket hat', (g, P) => k.bucketHat(g, P)],
  ['knight', (g, P) => k.knightHelmet(g, P)],
  ['guard', (g, P) => k.guardHelmet(g, P)],
  ['party hat', (g, P) => k.partyHat(g, P)],
  ['bandana', (g, P) => k.bandana(g, P, { phase: 1 })],
  ['pointy cap', (g, P) => k.pointyCap(g, P)],
  ['safari', (g, P) => k.safariHat(g, P)],
  ['shades', (g, P) => k.shades(g, P)],
  ['aviators', (g, P) => k.aviators(g, P)],
  ['round glasses', (g, P) => k.roundGlasses(g, P)],
  ['tie', (g, P) => k.tie(g, P)],
  ['suit', (g, P) => { k.suit(g, P); k.tie(g, P, { collar: null }); }],
  ['long coat', (g, P) => k.longCoat(g, P)],
  ['leather', (g, P) => k.leatherJacket(g, P)],
  ['red jacket', (g, P) => k.redJacket(g, P)],
  ['trench', (g, P) => k.trench(g, P)],
  ['jumpsuit', (g, P) => k.jumpsuit(g, P, { c: C.gold, dark: C.amber, zip: C.charcoal })],
  ['cape', null, (g, P) => k.cape(g, P, { wind: 1 }), (g, P) => k.capeClasp(g, P)],
  ['villain', (g, P) => k.villainHelmet(g, P)],
  ['glove', (g, P) => { const t = k.glove(g, P, { side: 'R' }); if (t) k.sparkle(g, t.x + 2, t.y - 2, 2); }],
];

const items = [];
for (const [name, over, under, over2] of looks) {
  for (const pose of ['idle', 'walk_1', 'wave_2']) {
    const g = new k.Canvas(11);
    k.clawd(g, pose, { under, over: [over, over2].filter(Boolean) });
    items.push({ cell: (x, y) => g.get(x, y), top: -9, label: name, sub: pose === 'idle' ? '' : pose === 'wave_2' ? 'W' : '3/4' });
  }
}
fs.writeFileSync(path.join(__dirname, 'costumes.png'), sheet(items, { per: 9, scale: 4 }).png());

const fx = [];
const add = (label, draw) => { const g = new k.Canvas(11); draw(g); fx.push({ cell: (x, y) => g.get(x, y), top: -9, label }); };
for (let ph = 0; ph < 4; ph++) add(`poof ${ph}`, g => { if (ph > 1) k.clawd(g, 'idle'); k.poof(g, 26.5, 25, ph); });
add('poof small', g => { k.clawd(g, 'idle'); k.poof(g, 26.5, 20, 1, { scale: 0.6 }); });
add('sparkles', g => { k.sparkle(g, 10, 10, 1); k.sparkle(g, 18, 10, 2); k.sparkle(g, 28, 10, 3); k.sparkle(g, 40, 10, 3, C.gold); });
add('motion', g => { k.clawd(g, 'walk_1', { dx: 6 }); k.motionLines(g, 12, 24, { dir: 'left', len: 5, count: 3, gap: 3 }); });
add('notes', g => { k.note(g, 10, 8); k.note(g, 20, 6, C.gold, { double: true }); k.note(g, 32, 9, C.sky, { flip: true }); });
add('beam', g => { k.beam(g, [44, 30], [24, 14], [24, 24]); });
add('dust', g => { k.clawd(g, 'squash'); k.dust(g, 26, 36, 0); k.dust(g, 26, 33, 2); });
add('font', g => { k.caption(g, 'YOU DIED', 27, 2, C.red, { align: 'center' }); k.caption(g, "ZED'S DEAD!", 27, 9, C.ivory, { align: 'center' });
  k.caption(g, 'ABCDEFGHIJKLM', 27, 16, C.gold, { align: 'center' }); k.caption(g, 'NOPQRSTUVWXYZ', 27, 22, C.sky, { align: 'center' });
  k.caption(g, '0123456789?-+*', 27, 28, C.lime, { align: 'center' }); });
add('big text', g => { k.caption(g, 'LEVEL UP', 27, 4, C.gold, { align: 'center', scale: 2, shadow: C.amber }); k.exclaim(g, 26, 20); });
fs.writeFileSync(path.join(__dirname, 'effects.png'), sheet(fx, { per: 6, scale: 4 }).png());
console.log(`Wrote kit/costumes.png (${looks.length} looks) and kit/effects.png`);

// Close-up: node kit/costume_sheet.js <look> [<look> …] → kit/costumes-zoom.png
const pick = process.argv.slice(2);
if (pick.length) {
  const zoom = items.filter(it => pick.includes(it.label));
  fs.writeFileSync(path.join(__dirname, 'costumes-zoom.png'), sheet(zoom, { per: 3, scale: 9 }).png());
  console.log(`Wrote kit/costumes-zoom.png (${zoom.length} panels)`);
}
