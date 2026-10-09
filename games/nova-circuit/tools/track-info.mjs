import { buildTrack, minClearance } from '../src/track.js';
import { TRACKS } from '../src/trackdefs.js';
for (const d of TRACKS) {
  const t = buildTrack(d);
  const c = minClearance(t);
  let ymin=1e9,ymax=-1e9; for(let i=0;i<t.N;i++){ymin=Math.min(ymin,t.P[i*3+1]);ymax=Math.max(ymax,t.P[i*3+1]);}
  let kmax=0; for(let i=0;i<t.N;i++) kmax=Math.max(kmax,Math.abs(t.kR[i]));
  console.log(d.id.padEnd(10),'len',t.length.toFixed(0),'gap',t.closureGap.toFixed(0),'clear',c.distance.toFixed(0),'at',c.at.map(Math.round).join('/'),'y',ymin.toFixed(0),ymax.toFixed(0),'kmax r',(1/kmax).toFixed(0),'pads',t.pads.length);
}
