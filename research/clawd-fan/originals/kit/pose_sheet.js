#!/usr/bin/env node
/**
 * Pose browser. Writes
 *   kit/poses.png       every named pose with its anchors marked
 *                       (eyes cyan, head top / chin / waist / feet yellow,
 *                       hands green, centre magenta)
 *   kit/poses_all.png   every distinct official frame, labelled clip:frame
 *                       (use any of them as pose('clip:frame'))
 * Usage: node kit/pose_sheet.js
 */
const fs = require('fs');
const path = require('path');
const { Canvas } = require('./canvas');
const P = require('./poses');
const { sheet } = require('./render');

function item(nameOrPose, label) {
  const g = new Canvas(11);
  const pl = P.clawd(g, nameOrPose);
  const a = pl.anchors, marks = [];
  const Y = [255, 220, 0], G = [60, 255, 90], M = [255, 60, 220];
  const cx = a.head.cx;
  marks.push({ x: cx, y: a.head.top, c: Y }, { x: cx, y: a.chin, c: Y }, { x: cx, y: a.waist, c: Y }, { x: cx, y: a.feet, c: Y });
  marks.push({ x: a.centre.x, y: a.centre.y, c: M });
  for (const h of [a.handL, a.handR]) if (h) marks.push({ x: h.x, y: h.y, c: G });
  return { cell: (x, y) => g.get(x, y), top: -6, label, marks, sub: a.facing === 'front' ? '' : a.facing[0].toUpperCase() };
}

const named = P.poseNames().map(n => item(n, n));
fs.writeFileSync(path.join(__dirname, 'poses.png'), sheet(named, { per: 7, scale: 5 }).png());
const all = [];
for (const [clip, c] of Object.entries(P.data.clips))
  for (const f of c.frames) all.push(item(P.frame(clip, f.src[0]), `${clip}:${f.src[0]}`));
fs.writeFileSync(path.join(__dirname, 'poses_all.png'), sheet(all, { per: 10, scale: 3 }).png());
console.log(`Wrote kit/poses.png (${named.length} named) and kit/poses_all.png (${all.length} frames)`);
