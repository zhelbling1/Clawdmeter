/**
 * The originals kit: one require for everything.
 *   const k = require('../kit');
 * See ../README.md for the guide.
 */
module.exports = {
  ...require('./canvas'),
  ...require('./poses'),
  ...require('./costumes'),
  ...require('./effects'),
  ...require('./scene'),
  encodeGif: require('./gif_encode').encodeGif,
};
