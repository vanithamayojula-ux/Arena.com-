// Prints an ASCII map of Vaelune straight out of the ground-height field, which is
// the fastest way to check that the layout still makes sense after a change.
//   node tests/map.mjs
import * as THREE from 'three';
import './dom-stub.mjs';

const { createCity } = await import(new URL('../src/city.js', import.meta.url).href);
const { MEMORIES } = await import(new URL('../src/content.js', import.meta.url).href);

const city = createCity(new THREE.Scene(), { seed: 20240410 });
const W = 116, H = 44, EXT = 122;
const ramp = (h) => (h <= -8 ? ' ' : h < -1.4 ? '~' : h < 0 ? ':' : h < 0.6 ? '.' : h < 2 ? 'o' : h < 3.5 ? 'O' : '#');

let out = '';
for (let j = 0; j < H; j++) {
  let line = '';
  for (let i = 0; i < W; i++) {
    const x = -EXT + (i / (W - 1)) * EXT * 2;
    const z = -EXT + (j / (H - 1)) * EXT * 2;
    let ch = ramp(city.groundHeight(x, z));
    for (const m of MEMORIES) {
      const a = city.shardAnchors[m.id];
      if (Math.hypot(a.x - x, a.z - z) < 4.5) ch = String(m.order);
    }
    line += ch;
  }
  out += line + '\n';
}
console.log(out);
console.log('blank=deep water  ~=drowned basin  :=wading  .=dry  o/O/#=platforms and tiers   1-6 = the six memories');
console.log('plaza at the centre · market +x · observatory −x−z · amphitheatre +x−z · temple −x+z · sea-gates +x+z');
