/* AFTERGLOW — the book. Every word, waypoint, cue sheet and deal on the table.
   The engine runs these steps; nothing here knows how a canvas works.
   Line format: [who, text, mood?]  · moods: 0 flat 1 warm 2 angry 3 sad 4 wary */

import { clamp, TAU } from './util.js';
import { drawFlame } from './paint.js';

export const ACT_NAMES = ['The Dimming', 'Permit for Collective Joy', 'The Cold Road', 'The Two Lamps of Halloway', 'What the Dark Owes', 'Dawn, Technically'];
export const SAVE_TITLE = n => ACT_NAMES[n] || ACT_NAMES[0];

/* ---------------- helpers to paint a world ---------------- */
function house(g, x, y, w, h, col, lit = [], sign = null) {
  g.fillStyle = col;
  g.fillRect(x, y - h, w, h);
  g.beginPath();
  g.moveTo(x - 5, y - h); g.lineTo(x + w / 2, y - h - w * 0.34); g.lineTo(x + w + 5, y - h);
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,196,120,0.5)';
  for (const [wx, wy] of lit) g.fillRect(x + wx, y - h + wy, 5, 7);
  if (sign) {
    g.strokeStyle = 'rgba(180,160,120,0.4)';
    g.strokeRect(x + w / 2 - 14, y - h + 14, 28, 12);
  }
}
function pines(g, W, y, R, s = 1) {
  g.fillStyle = '#060b13';
  for (let x = -20; x < W + 20; x += 26 + R() * 30) {
    const h = (34 + R() * 44) * s;
    g.beginPath();
    g.moveTo(x - 10 * s, y); g.lineTo(x, y - h); g.lineTo(x + 10 * s, y);
    g.closePath(); g.fill();
  }
}

/* ---------------- WORLDS ---------------- */
export const WORLDS = {
  camp: {
    id: 'camp', follow: [], worldW: 1180, dark: 0.62, wind: 0.15, spawn: { x: 150 },
    lights: [{ x: 560, y: null, r: 230 }],
    music: 'camp',
    objective: 'meet the troupe · one last night before the levy comes due',
    npcs: [
      { char: 'bod', x: 640, dir: -1 },
      { char: 'nadia', x: 470, dir: 1, phase: 2 },
      { char: 'tomas', x: 545, y: null, dir: 1, phase: 4, state: 'act' },
    ],
    decor: (g, W, H, c) => {
      const R = c.R;
      g.fillStyle = '#0a1220';
      g.beginPath();
      g.moveTo(W * 0.05, c.groundY); g.lineTo(W * 0.05 + 30, c.groundY - 66); g.lineTo(W * 0.05 + 120, c.groundY - 66); g.lineTo(W * 0.05 + 150, c.groundY);
      g.closePath(); g.fill();
      g.fillStyle = '#101a2a';
      g.beginPath(); g.arc(W * 0.9 + 20, c.groundY - 20, 54, Math.PI, 0); g.fill(); // wagon hood
      g.strokeStyle = '#0a1018'; g.lineWidth = 4;
      g.beginPath(); g.arc(W * 0.9 - 8, c.groundY - 6, 10, 0, 7); g.moveTo(W * 0.9 + 52, c.groundY - 6); g.arc(W * 0.9 + 52, c.groundY - 6, 10, 0, 7); g.stroke();
      pines(g, W, c.groundY + 4, R, 1.4);
      // washing line with costume parts
      g.strokeStyle = 'rgba(150,165,190,0.25)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(W * 0.16, c.groundY - 90); g.quadraticCurveTo(W * 0.2, c.groundY - 78, W * 0.24, c.groundY - 90); g.stroke();
      g.fillStyle = 'rgba(107,61,74,0.6)'; g.fillRect(W * 0.18, c.groundY - 84, 12, 16);
      g.fillStyle = 'rgba(61,90,107,0.6)'; g.fillRect(W * 0.21, c.groundY - 82, 14, 20);
    },
    points: [
      {
        x: 470, label: 'Nadia, polishing a promise', icon: '✦', once: true,
        run: [{
          s: 'talk', lines: [
            ['nadia', 'You count the rounds every night, Miri. Two. I counted for you. Don’t make me count like it’s arithmetic.'],
            ['miri', 'It is arithmetic, Nadia. It was always arithmetic. Six years of it.'],
            ['nadia', 'Then solve me this: how many songs does it take to carry two bullets all the way to the sea?'],
            { who: 'nadia', text: 'She hands you the pistol case like a communion. Inside: two rounds and a folded lullaby, just in case.' },
          ],
          after: { ammo: 0 }, nodes: null, effect: null,
          start: null,
          out: null,
          then: [{ s: 'do', fn: (app, G) => { G.ammo = Math.max(G.ammo, 2); } }, { s: 'toast', text: 'the case is yours now', color: '#c9a27b' }],
        }],
      },
      {
        x: 640, label: 'Bod, oiling Siegfried', icon: '✦', once: true,
        run: [{
          s: 'talk', lines: [
            ['bod', 'Siegfried’s third valve sticks. Also I have packed the good rope twice. Also, Corporal —'],
            ['bod', '— if the levy men come for the flame, I move the cart. That’s the plan. I have made it a plan so it can’t be sad.'],
            ['narrator', 'Bodfrie Kell, former combat engineer, currently professional tuba. Has never once been asked to defuse anything since the sun went out. He checks, anyway.'],
            ['miri', 'Plan approved. Tuba blessed. Rope count: still twice.'],
            ['bod', 'Three times, tomorrow.'],
          ],
          then: [{ s: 'do', fn: (app, G) => { G.emitTrustFX(G.applyFX({ trust: { bod: 1 } })); } }],
        }],
      },
      {
        x: 545, label: 'Tomas, feeding the fire', icon: '✦', once: true,
        run: [{
          s: 'talk', lines: [
            ['tomas', 'Oil’s not fuel, Corporal — the old keepers were right — it’s memory. Fire remembers the last minute. Feed the memory, keep the light.'],
            ['miri', 'You’ve been reading the keeper’s log again.'],
            ['tomas', 'Page forty. “Dawn: not observed. Continuing to describe it, in case anyone asks.”'],
            ['narrator', 'The fire leans toward him the way fires do. Seventeen and already a quartermaster of hope.'],
          ],
          then: [
            { s: 'do', fn: (app, G) => { G.emitTrustFX(G.applyFX({ trust: { tomas: 1 }, oil: 10 })); } },
            { s: 'toast', text: '+10 lantern oil — he was saving it', color: '#a8e0c5' },
          ],
        }],
      },
      {
        x: 1020, label: 'the road north', icon: '➤', exit: true,
        run: [{
          s: 'talk', lines: [
            ['narrator', 'Vellum Hollow is one day’s walk, and the levy is due in two. Twelve years the sun has been a coal. Twelve years we have performed at its funeral, gratis. Not anymore.'],
            ['miri', 'Formation, players. From today, the dark pays cover.'],
            ['bod', 'It does not have pockets.'],
            ['nadia', 'Everything has pockets, Bodfrie.'],
          ],
          then: [{ s: 'sceneExit' }],
        }],
      },
    ],
  },

  hollow_gate: {
    id: 'hollow_gate', worldW: 900, dark: 0.34, spawn: { x: 90 }, wind: 0.2,
    music: 'road',
    objective: 'the checkpoint will not move on its own',
    lights: [{ x: 560, r: 120, if: null }],
    npcs: [
      { char: 'hask', x: 560, dir: -1 },
      { char: 'crowd', x: 620, dir: -1, scale: 0.94 },
      { char: 'crowd', x: 505, dir: -1, scale: 0.9, phase: 3 },
    ],
    decor: (g, W, H, c) => {
      g.fillStyle = '#0c1420';
      g.fillRect(470, c.groundY - 92, 190, 92); // guard hut
      g.fillStyle = '#151f2e';
      g.fillRect(470, c.groundY - 100, 190, 10);
      g.strokeStyle = '#202d40'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(430, c.groundY - 8); g.lineTo(700, c.groundY - 8); g.stroke(); // boom gate
      g.fillStyle = 'rgba(200,80,60,0.35)';
      for (let x = 440; x < 690; x += 52) g.fillRect(x, c.groundY - 11, 26, 6);
    },
    points: [
      {
        x: 560, label: 'Sergeant Hask and one (1) clipboard', icon: '✦',
        run: [
          {
            s: 'talk', lines: [
              ['narrator', 'Vellum Hollow: eight hundred souls, one shared brazier, and a militia that has survived by writing everything down.'],
              ['hask', 'Papers.'],
              ['miri', 'We’re a troupe.'],
              ['hask', 'Exactly. Troupes perform. Performances require a permit. Permit for Collective Joy, Form 7-B. Fee is one chit per lamp you intend to light.'],
              ['bod', 'We brought a tuba.'],
              ['hask', 'Siegfried requires two.'],
              ['narrator', 'The line behind you is not a queue. It’s a village, and it is looking at you the way people look at weather that might, this time, be on their side.'],
            ],
            nodes: {
              start: 's',
              s: {
                lines: [['hask', 'Let’s not make this a production. I’m told you people are good with productions.', 4]],
                choices: [
                  { t: '“The production is the point. Name your price, Sergeant.”', kind: 'barter', go: 'neg' },
                  { t: '“We lit the mill at Kettle Row with half a lantern. You’re welcome, by the way.”', kind: 'respect', go: 'neg' },
                  { t: '“Your gate is down and your ledger’s wet. Which of us needs this to be a scene?”', kind: 'threat', go: 'neg' },
                ],
              },
              neg: { lines: [] },
            },
          },
          {
            s: 'negotiate', save: 'gateDeal', who: 'hask',
            stakes: 'entry for the troupe, the tuba, and whatever hope we can carry past the pike',
            tension: 0.55, likes: 'respect', hates: 'threat',
            rounds: [
              {
                line: ['hask', 'Fee first, feelings later. The Trust audits the levy at month’s end. I don’t get away with warm hearts.'],
                hint: 'He keeps angling the ledger toward you — he wants a witness that he did this by the book.',
                opts: [
                  { t: '“Post it by the rules, Sergeant. I’ll sign the receipt so they audit you kindly.”', kind: 'respect', dT: -0.14, react: [{ who: 'hask', text: '“…You’d sign?” He files nothing, but he looks like a man unshouldering a log.' }] },
                  { t: '“Two chits, and one song performed to the garrison, gratis, tonight.”', kind: 'barter', dT: -0.08, cost: 2, react: [{ who: 'hask', text: '“Music stays off the books. Make it a march.”' }] },
                  { t: '“Audit this: the form number is wrong. 7-B is livestock. You’re taxing us as cattle.”', kind: 'read', dT: 0.1, note: 'a gamble', react: [{ who: 'hask', text: 'The page turns the color of porch ash. “Livestock don’t get a line, then. Get in.”' }, { who: 'narrator', text: 'He waves you through — then writes something down that will cost you later.' }], effect: { trust: { hask: -1 } } },
                ],
              },
              {
                line: ['hask', 'Word is you people solved the mill at Kettle Row with fire-breathers and nerve. My council wants assurances about the nerve part.'],
                hint: '“My council.” Hask has no council. He wants to be quoted.',
                opts: [
                  { t: '“Put it in your own words: the nerve held for twelve years. It’s licensed now.”', kind: 'respect', dT: -0.12, react: [{ who: 'hask', text: 'He mouths it once, likes how it sounds, writes it down for the minutes.' }] },
                  { t: '“We’ll post the whole permit number on the playbill. Free press, Sergeant.”', kind: 'jest', dT: -0.07, react: [{ who: 'hask', text: '“…Font matters,” he says, which is the most alive he has ever been.' }] },
                  { t: '“Your council can come inspect the nerve personally.”', kind: 'threat', dT: 0.14, react: [{ who: 'hask', text: 'His hand finds the pike he does not need. “Noted,” he says, in the voice people use right before it’s a problem.' }] },
                ],
              },
              {
                line: ['hask', 'Last thing. The Choir says performances are a sacrament. The Trust says they’re taxable. I say you’ll do me the favor of not being either in my square.'],
                hint: 'He is genuinely asking. It shows on him like a wound.',
                opts: [
                  { t: '“No sacraments, no ledgers. Just a show, and a crowd that forgets, briefly. That’s all we ever are.”', kind: 'honest', dT: -0.13, react: [{ who: 'narrator', text: 'Something gets unscrewed behind his eyes and put back the right way up.' }] },
                  { t: '“The square stays neutral while we’re in it. On that, we have a deal.”', kind: 'barter', dT: -0.06, react: [{ who: 'hask', text: '“In writing,” he says. “Obviously in writing.”' }] },
                  { t: '“The square is full of people who can’t pay you. We’ll be the reason they laugh anyway.”', kind: 'threat', dT: 0.05, react: [{ who: 'hask', text: '“That is a value judgement,” he says. “In my square.”' }] },
                ],
              },
            ],
            concessions: [
              { t: 'Slip him the whole purse — "for the ledger’s comfort"', cost: 3, dT: -0.22, once: 'paidHask', note: 'quietly', react: [{ who: 'hask', text: 'He palms it the way men handle a lit cigarette, out of sight and out of shame. "Form 7-B," he whispers. "Approved."' }] },
              { t: 'Promise the garrison a song at roll-call, forever', dT: -0.1, once: 'haskSong', note: 'no cost', react: [{ who: 'hask', text: '“No marches.” Beat. “Small marches.”' }] },
            ],
            out: {
              win: [{
                s: 'talk', lines: [
                  ['hask', 'In you go, troupe. And — sign the receipt. By the gate. In ink.'],
                  ['narrator', 'Sergeant Hask, one joke in twelve years, has just handed you a second one. He will tell it for a decade. It will still work.'],
                ],
                then: [{ s: 'sceneExit' }],
              }],
              even: [{
                s: 'talk', lines: [
                  ['hask', 'Approved, with prejudice. Mind the square, mind the Trust, mind my mood.'],
                  ['bod', 'Which is the most fragile?'],
                  ['hask', 'The square.'],
                ],
                then: [{ s: 'sceneExit' }],
              }],
              bad: [{
                s: 'talk', lines: [
                  ['hask', 'That’s the face. That’s exactly the face. Through the gate, troupe — and a line at dawn.'],
                  ['nadia', 'He will remember the threat. Men with clipboards always do.'],
                  ['narrator', 'You enter Vellum Hollow the way storms enter a valley: legal, but noted.'],
                ],
                effect: { chits: -2 },
                then: [{ s: 'sceneExit' }],
              }],
            },
          },
        ],
      },
    ],
  },

  hollow_square: {
    id: 'hollow_square', worldW: 1500, dark: 0.42, spawn: { x: 80 }, wind: 0.25, music: 'town',
    objective: 'the square needs a show more than it needs a savior — but bring both',
    lights: [{ x: 640, r: 170 }, { x: 1130, r: 120 }, { x: 300, r: 90 }],
    npcs: [
      { char: 'anna', x: 342, dir: 1 },
      { char: 'fenn', x: 1160, dir: -1, scale: 0.92 },
      { char: 'crowd', x: 700, dir: -1, patrol: [660, 780], speed: 22 },
      { char: 'crowd', x: 900, dir: 1, patrol: [860, 980], speed: 18 },
    ],
    decor: (g, W, H, c) => {
      const R = c.R;
      house(g, 180, c.groundY, 150, 96, '#121b28', [[30, 40], [90, 40]], true);
      house(g, 950, c.groundY, 170, 110, '#111a26', [[40, 52], [110, 52]], true);
      house(g, 1250, c.groundY, 140, 88, '#0f1824', [[60, 36]]);
      // the great brazier in the square
      g.fillStyle = '#20160e';
      g.beginPath();
      g.moveTo(600, c.groundY); g.lineTo(612, c.groundY - 26); g.lineTo(668, c.groundY - 26); g.lineTo(680, c.groundY);
      g.closePath(); g.fill();
      // market stalls (bare)
      for (const x of [430, 500, 800, 860]) {
        g.fillStyle = '#0d1522';
        g.fillRect(x, c.groundY - 4, 44, 4);
        g.strokeStyle = '#1a2436'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(x + 2, c.groundY); g.lineTo(x + 8, c.groundY - 40); g.moveTo(x + 42, c.groundY); g.lineTo(x + 36, c.groundY - 40); g.stroke();
      }
      // the board
      g.fillStyle = '#1a1409';
      g.fillRect(1040, c.groundY - 120, 74, 52);
      g.strokeStyle = '#2c2416'; g.lineWidth = 2; g.strokeRect(1040, c.groundY - 120, 74, 52);
    },
    live: (g, s, t, cam) => {
      // playbill you can nail up after signing
      if (s.app.G.flags.showOn) {
        const x = 1044 - cam, y = s.groundY - 116;
        g.save();
        g.fillStyle = 'rgba(214,196,150,0.9)';
        g.fillRect(x, y, 66, 44);
        g.fillStyle = 'rgba(30,20,10,0.9)';
        g.font = '8px "Spectral", serif';
        g.fillText('ASHFALL', x + 6, y + 12);
        g.fillText('TONIGHT', x + 6, y + 22);
        g.fillText('BY THE GREAT', x + 6, y + 32);
        g.fillText('BRAZIER', x + 6, y + 40);
        g.restore();
      }
    },
    points: [
      {
        x: 342, label: 'Anna, the Inn of Reasonable Expectations', icon: '✦',
        run: [{
          s: 'talk',
          nodes: {
            start: 'a',
            a: {
              lines: [
                ['anna', 'Rooms cost, soup costs, water costs, optimism is complimentary. You’re the performing soldiers?'],
                ['miri', 'The performing former—'],
                ['anna', 'Honey, in this valley everything is former. I’m “former young.” Sit or don’t, but the square’s cold by dusk.'],
              ],
              choices: [
                { t: '“Two bowls of stew, and the good chairs out of the back.” (−2⌾)', if: { minChits: 2 }, effect: { chits: -2, hp: 1, trust: { bod: 1, tomas: 1 } }, go: 'fed', note: 'warmth, taxed' },
                { t: '“What’s the town afraid of right now?”', go: 'gossip' },
                { t: '“Optimism’ll do, thanks.”', go: 'nope' },
              ],
            },
            fed: {
              lines: [
                ['narrator', 'The stew is turnip-forward. It is also the first hot thing any of you have eaten since Kettle Row, and nobody lies about that.'],
                ['anna', 'There. Now you’re locals. Locals can afford two more bowls, theoretically.'],
              ],
              next: null,
            },
            gossip: {
              lines: [
                ['anna', 'Afraid? Two things. The Wick Trust auditing the tithe again — they count flame the way vultures count limps.'],
                ['anna', 'And the Choir. They mean well. They sing at the sun like it’s a sleeping dog. Worst part is the wind keeps turning their music sheets the wrong way and they think that’s an answer.'],
                ['miri', 'What about the dark? Actual, physical dark?'],
                ['anna', '…Wise of you not to name it in the square.'],
              ],
              next: 'a2',
            },
            a2: {
              lines: [['anna', 'Wisest I get. Ask the old man by the east fire. He remembers weather.']],
              next: null,
            },
            nope: {
              lines: [
                ['anna', 'Optimism, then. Extra charge for the visit.'],
                ['narrator', 'She grins the way people grin when they like a troupe before the troupe needs liking.'],
              ],
              next: null,
            },
          },
        }],
      },
      {
        x: 1066, label: 'the notice board', icon: '✦',
        run: [{
          s: 'talk', nodes: {
            start: 'b',
            b: {
              lines: [['narrator', 'WANTED: a mood. The Wick Trust reminds all citizens that unsanctioned singing near braziers is arson with harmonies. The Lamplight Choir counters with “SING ANYWAY (reconciled with fire marshal, Sundays).” Someone has drawn a sun with both of their arrows through it. Below, smaller, in chalk: “it’s still in there.”']],
              choices: [
                { t: 'Nail up tonight’s playbill.', effect: { flags: null }, go: 'post' },
                { t: 'Leave the quarrel alone and go.', next: null },
              ],
            },
            post: {
              lines: [['narrator', 'You post it. A crowd of two reads it over each other’s shoulders, the way grief reads letters. By noon there are seven. By dusk, the square smells like someone remembered a market.']],
              effect: { chits: 1 },
              then: [{ s: 'do', fn: (app, G) => { G.flags.showOn = true; } }, { s: 'toast', text: 'the square now expects something', color: '#e8d5a8' }],
            },
          },
        }],
      },
      {
        x: 1160, label: 'Grandsire Fenn, daylight’s last witness', icon: '✦', once: true,
        run: [{
          s: 'talk', lines: [
            ['narrator', 'The old man sits by the east fire where the heat is communal and the questions are free.'],
            ['fenn', 'You want what it was like. Everyone wants what it was like.'],
            ['miri', 'We want what it did to people, mostly.'],
            ['fenn', 'It made them generous. That’s the ugly answer. When every scrap of light was borrowed, everyone kept passing it along, terrified and proud. The Trust learned to sell that. The Choir learned to sing that.'],
            ['fenn', 'You four learned to perform it. Don’t let anyone tell you that’s less.'],
            ['narrator', 'He gives you a twist of lampwick, braided red. The old trade, the first trade: something small that says keep going.'],
          ],
          then: [{ s: 'do', fn: (app, G) => { G.flags.wickGift = true; G.emitTrustFX(G.applyFX({ oil: 15, trust: { tomas: 1 } })); } }, { s: 'toast', text: '+15 oil — braided wick, a keeper’s luck-piece', color: '#a8e0c5' }],
        }],
      },
      {
        x: 640, label: 'set the stage (one hour to dusk)', icon: '✦',
        run: [{
          s: 'talk',
          nodes: {
            start: 'pre',
            pre: {
              lines: [
                ['bod', 'The brazier’s the chandelier. The crowd’s the balcony. Miri — we’re playing the sun’s wake for people who already have a wreath.'],
                ['nadia', 'Good. We open with the juggling. People trust a person who can drop three things and catch two.'],
                ['tomas', 'Or we open with the rope. If I get it up first, they’ll look up the whole show.'],
                ['miri', 'We open with—'],
              ],
              choices: [
                { t: '“…Bod. Siegfried’s solo. Loud, warm, ridiculous. That’s an anchor.”', effect: { trust: { bod: 1, nadia: -0 } }, go: 'go' },
                { t: '“Tomas on the rope first. We make them look up, they’ll stay for everything.”', effect: { trust: { tomas: 1 } }, go: 'go' },
                { t: '“Nadia’s puppet. Corporal Chalk can insult the militia before they wake up to it.”', effect: { trust: { nadia: 1 } }, go: 'go' },
              ],
            },
            go: { lines: [['narrator', 'The Ashfall Players take the square at dusk — the hour when lanterns are lit by hand, and the valley does its small daily miracle of deciding to see tomorrow.']], next: null },
          },
        },
        {
          s: 'perf', save: 'show1', bars: 10, every: 2, target: 0.6, members: ['miri'],
          hitLines: ['someone starts clapping on the wrong beat and no one cares', 'a child is on their father’s shoulders, conducting with both arms', 'the fire leans in the way fires do', 'two of the Trust’s auditors have forgotten to audit'],
          pattern: ['ball', 'fire', 'ball', { type: 'fire', off: 1 }, 'ball', 'note', 'fire', 'ball'],
          crowd: 34, seed: 11,
          out: {
            great: [{ s: 'talk', lines: [['narrator', 'By the fire-breather’s second pass, the square has stopped being a queue and started being a crowd. Someone throws a chit and misses badly enough that you thank them anyway.']], then: [{ s: 'do', fn: (a, G) => { G.chits += 5; G.emitTrustFX(G.applyFX({ trust: { bod: 1, nadia: 1, tomas: 1 } })); } }, { s: 'toast', text: '+5 chits — a good show is a mint', color: '#e8d5a8' }] }],
            ok: [{ s: 'talk', lines: [['narrator', 'Solid. Warm. The third row laughs exactly where you taught the third row to laugh. Not glory. Rent.']], then: [{ s: 'do', fn: (a, G) => { G.chits += 3; } }, { s: 'toast', text: '+3 chits', color: '#e8d5a8' }] }],
            poor: [{ s: 'talk', lines: [['narrator', 'The juggling does not. A ball finds a cabbage, the cabbage finds a face, and the face belongs to somebody’s father. The crowd gives you that soft pity people give the dying, which is worse.'], ['bod', '…we’re still booked tomorrow, right? Right.']], then: [{ s: 'do', fn: (a, G) => { G.chits += 1; G.emitTrustFX(G.applyFX({ trust: { bod: -1 } })); } }] }],
          },
        },
        {
          s: 'talk', lines: [['narrator', 'After: the square smells of roasting turnip and approval. At the edge of it stands a man in a grey coat, holding an abacus like a weapon.']],
          nodes: {
            start: 'vek1',
            vek1: {
              lines: [
                ['vek', 'Almoner Vek, Wick Trust. Beautiful show. Taxable, but beautiful.'],
                ['vek', 'Light Tithe: for every flame you lit tonight — brazier, torch, that regrettable fire-breath — one chit per head, per hour. I count the crowd. It is how we afford the counting.'],
                ['bod', 'He counts the crowd.'],
                ['vek', 'I monetize joy. It’s the only honest business left. Pay the tithe — three chits — or the Trust declines to guarantee your lamps on the road. Cold things happen on unguaranteed roads.'],
              ],
              choices: [
                { t: 'Pay the tithe. (−3⌾)', if: { minChits: 3 }, go: 'paid', effect: { chits: -3 } },
                { t: '“The crowd paid us in chits because we made them feel warm. That’s your market research, free.”', go: 'defy' },
                { t: '“Guarantee our lamps? Or light them? Which is it, Almoner?”', go: 'bluff' },
              ],
            },
            paid: {
              lines: [
                ['vek', 'A receipt! Delightful. Do try the Choir before you leave; they tip in hymns.'],
                ['nadia', 'You just bought a coat for a wolf.'],
                ['miri', 'I bought the wolf not eating us tonight. I know the difference. I used to do paperwork.'],
              ],
              next: null,
            },
            defy: {
              lines: [
                ['vek', 'Then the Trust’s compassion is noted in the minutes.'],
                ['narrator', 'He smiles like a drawbridge. Behind him, two lamplighters quietly stop lighting his streetlamp. Small victories. Real ones.'],
                ['bod', 'Did we win?'],
                ['nadia', 'We refused. In this economy, that counts as winning twice.'],
              ],
              effect: { trust: { nadia: 1 }, set: { vekSpurned: true } },
              next: null,
            },
            bluff: {
              lines: [
                ['vek', '…Both. The guarantee is the light. The light is the guarantee. It’s in the bylaws.'],
                ['narrator', 'The crowd around you starts, very softly, to laugh. The almoner hears it in stereo and prices the delay of his retaliation at one song.'],
                ['vek', 'A song. On the record. Or the tithe.'],
              ],
              choices: [
                { t: 'Give them the shortest, angriest song you know.', go: 'song', effect: { set: { sangOfficer: true }, trust: { bod: 1, nadia: 1, tomas: 1 } } },
                { t: 'Pay instead. (−3⌾)', if: { minChits: 3 }, go: 'paid', effect: { chits: -3 } },
              ],
            },
            song: {
              lines: [
                ['narrator', 'You sing the one from the retreat — no melody, just enough of it to remember the marching step. The square joins on the second line, badly, on purpose. Vek, outvoted by acoustics, waives the tithe “pending review.”'],
                ['tomas', 'You did that on purpose.'],
                ['miri', 'I did that army-on-purpose. Same word, different war.'],
              ],
              next: null,
            },
          },
        },
        { s: 'toast', text: 'Vellum Hollow: one night down, one debt unpaid', color: '#cfd8e6' },
        { s: 'sceneExit' }],
      },
    ],
  },

  hollow_night: {
    id: 'hollow_night', follow: [], worldW: 900, dark: 0.78, spawn: { x: 120 }, music: 'sad', wind: 0.1,
    objective: 'choose who you sit with. the fire keeps its own counsel',
    lights: [{ x: 560, r: 210 }],
    npcs: [
      { char: 'bod', x: 615, dir: -1 }, { char: 'nadia', x: 500, dir: 1 }, { char: 'tomas', x: 560, dir: -1, state: 'idle' },
    ],
    decor: (g, W, H, c) => {
      house(g, 120, c.groundY, 130, 80, '#0b1220', [[40, 30]]);
      house(g, 720, c.groundY, 120, 74, '#0a111d', []);
      g.fillStyle = '#20160e';
      g.beginPath();
      g.moveTo(530, c.groundY); g.lineTo(540, c.groundY - 20); g.lineTo(584, c.groundY - 20); g.lineTo(594, c.groundY);
      g.closePath(); g.fill();
    },
    points: [
      {
        x: 500, label: 'Nadia, not cleaning anything', icon: '✦', once: true,
        run: [{
          s: 'talk', lines: [
            ['nadia', 'You kept them laughing. I kept counting exits. We’re both doing jobs; only one of them smells like a hobby.'],
            ['miri', 'Chalk talked back tonight. He’s learning from the worst.'],
            ['nadia', 'Corporal Chalk has better instincts than his operator.'],
            ['nadia', 'Miri. On the road — if it comes to aiming — I don’t want a thank-you afterward. That’s the whole conversation.'],
            ['miri', 'No thank-yous, only debts, that’s the troupe charter.'],
            ['nadia', 'I wrote the charter.'],
          ],
          then: [{ s: 'do', fn: (app, G) => { G.emitTrustFX(G.applyFX({ trust: { nadia: 1 } })); G.flags.nightNadia = true; } }],
        }],
      },
      {
        x: 615, label: 'Bod, keeping watch on a mine that isn’t there', icon: '✦', once: true,
        run: [{
          s: 'talk', lines: [
            ['narrator', 'Bod walks the same six steps by the fire, every night, and taps nothing. It used to be mines. It’s snow now. He taps anyway.'],
            ['bod', 'Sorry. Tactile habit.'],
            ['miri', 'Take the long way. The snow is fine.'],
            ['bod', 'How do you know?'],
            ['miri', 'Because if it weren’t, you’d have eaten it by now, that’s how you check for— never mind.'],
            ['bod', '…we’re not saying the word “mine” on the road.'],
            ['miri', 'We’re saying “surprise fertilizer.” You coined it. You’re stuck with it.'],
          ],
          then: [{ s: 'do', fn: (app, G) => { G.emitTrustFX(G.applyFX({ trust: { bod: 1 } })); G.flags.nightBod = true; } }],
        }],
      },
      {
        x: 560, label: 'Tomas, doing arithmetic on hope', icon: '✦', once: true,
        run: [{
          s: 'talk', lines: [
            ['tomas', 'I made the numbers. If we do Halloway, the canal shows, and the coast road, we earn two full winters of oil. Or one lamp, at the lighthouse. One lamp that shows ships the cliff instead of the rocks.'],
            ['miri', 'And the troupe?'],
            ['tomas', 'One lamp keeps the troupe. Every town that sleeps because of it leaves a chit in a bowl. I did the arithmetic twice in case I was being naïve. I wasn’t.'],
            ['narrator', 'He’s seventeen and he has done the math of mercy and come out at solvency. You find you believe him, which is the danger.'],
          ],
          then: [{ s: 'do', fn: (app, G) => { G.emitTrustFX(G.applyFX({ trust: { tomas: 1 } })); G.flags.nightTomas = true; G.flags.lampPlan = true; } }],
        }],
      },
      {
        x: 830, label: 'north, into the cold', icon: '➤', exit: true,
        run: [{
          s: 'talk', lines: [
            ['narrator', 'You sleep under an awning with all four watches posted, the way the army taught and the troupe keeps. Vellum Hollow stays awake a little longer than usual, humming in the wrong key, on purpose.'],
          ],
          then: [{ s: 'sceneExit' }],
        }],
      },
    ],
  },

  bridge_toll: {
    id: 'bridge_toll', follow: [], worldW: 1000, dark: 0.66, spawn: { x: 110 }, music: 'camp', wind: 0.3,
    objective: 'count them. everyone’s still everyone',
    lights: [{ x: 500, r: 180 }],
    npcs: [{ char: 'tomas', x: 430, dir: 1 }, { char: 'bod', x: 570, dir: -1 }, { char: 'nadia', x: 640, dir: -1 }],
    decor: (g, W, H, c) => {
      g.fillStyle = '#0c1422';
      g.fillRect(300, c.groundY - 6, 400, 8); // bridge plank, mended
      g.strokeStyle = '#0a1018'; g.lineWidth = 3;
      for (let x = 310; x < 700; x += 46) { g.beginPath(); g.moveTo(x, c.groundY); g.lineTo(x - 10, c.groundY + 40); g.stroke(); }
      const R = c.R;
      pines(g, W, c.groundY + 10, R, 1.2);
    },
    points: [
      {
        x: 430, label: 'Tomas, playing field medic', icon: '✦',
        run: [{
          s: 'talk', lines: [
            ['tomas', 'Hold still. There. Twelve years since the war and the worst thing I’ve had to stitch is Bodfrie’s ego on a rope.'],
            ['narrator', 'The fire’s light holds steady on his hands. You note that. Everyone’s hands shake by the second winter; his learned not to, for you.'],
          ],
          then: [{ s: 'do', fn: (app, G) => { if (G.hp < G.hpMax) { G.emitTrustFX(G.applyFX({ hp: 1 })); } } }],
        }],
      },
      {
        x: 570, label: 'Bod, counting the cart', icon: '✦',
        run: [{
          s: 'talk', lines: [
            ['bod', 'Everything survived. The tuba dented. Siegfried says it adds character and I quote him accurately.'],
            ['bod', 'Miri — back there, on the bridge. You moved like it was Tuesday. I keep waiting for you to move like it isn’t.'],
            ['miri', 'It wasn’t. We’re performers now.'],
            ['bod', 'You shot one out of the sky, Corporal.'],
            ['miri', 'It was a very large moth.'],
          ],
          then: [{ s: 'do', fn: (app, G) => { G.emitTrustFX(G.applyFX({ trust: { bod: 1 } })); } }],
        }],
      },
      {
        x: 640, label: 'Nadia, counting the case', icon: '✦', once: true,
        run: [{
          s: 'talk', nodes: {
            start: 'n',
            n: {
              lines: [['nadia', 'Two rounds. We used one, or you didn’t, and I’d rather not audit the past tense out loud. How many are in the case, Miri?']],
              nextFn: (G) => G.flags.firedShot ? 'used' : 'kept',
            },
            used: {
              lines: [['miri', 'One.'], ['nadia', 'Then the next one’s mine to place, and I’ll do it in a word instead. We agreed.'], ['narrator', 'She does not take the case back. That is either trust or a loan on a soul. You can’t tell yet.'] ],
              effect: { ammo: 1 },
              then: [{ s: 'toast', text: '+1 round — her share of the burden', color: '#c9a27b' }],
            },
            kept: {
              lines: [['miri', 'Two. Not one. Two.'], ['nadia', 'Good. Keep counting for me. Your counting is better than mine was at Kettle Row.'], ['narrator', '“At Kettle Row” is Nadia for “when I aimed at people and was called a hero,” which you have never once heard her finish.']],
              next: null,
            },
          },
        }],
      },
      {
        x: 890, label: 'Halloway, through the haze', icon: '➤', exit: true,
        run: [{ s: 'do', fn: (app, G) => { G.oil = clamp(G.oil + 20, 0, G.oilMax); } }, { s: 'toast', text: '+20 oil — a kind farmer, an unkind world', color: '#a8e0c5' }, { s: 'talk', lines: [['narrator', 'You smell smoke that isn’t desperate — chimney smoke, cooking smoke, theatre smoke — before you see the lamps of Halloway strung across the frozen canal like a second, braver sky.']] }, { s: 'sceneExit' }],
      },
    ],
  },

  halloway: {
    id: 'halloway', worldW: 1800, dark: 0.46, spawn: { x: 90 }, music: 'town', wind: 0.15,
    objective: 'two powers, one troupe. be at the Guild by noon, the Chapel by vespers, everywhere by curtain',
    lights: [{ x: 520, r: 130 }, { x: 1240, r: 130 }, { x: 890, r: 90 }, { x: 1560, r: 80 }],
    npcs: [
      { char: 'crowd', x: 700, dir: -1, patrol: [660, 760], speed: 20 },
      { char: 'sable', x: 1240, dir: -1 },
      { char: 'vek', x: 520, dir: 1 },
    ],
    decor: (g, W, H, c) => {
      house(g, 380, c.groundY, 240, 150, '#151d2b', [[50, 70], [120, 70], [180, 70]], true);
      g.fillStyle = '#151d2b';
      g.beginPath(); g.moveTo(380, c.groundY - 150); g.lineTo(500, c.groundY - 210); g.lineTo(620, c.groundY - 150); g.closePath(); g.fill(); // guild hall
      g.fillStyle = '#0f1a28';
      g.beginPath(); g.moveTo(1150, c.groundY); g.lineTo(1150, c.groundY - 170); g.lineTo(1330, c.groundY - 170); g.lineTo(1330, c.groundY); g.closePath(); g.fill();
      g.beginPath(); g.arc(1240, c.groundY - 170, 90, Math.PI, 0); g.fill(); // chapel dome
      g.fillStyle = 'rgba(200,220,255,0.5)';
      g.beginPath(); g.arc(1240, c.groundY - 200, 10, 0, 7); g.fill();
      // canal
      g.fillStyle = 'rgba(30,44,66,0.9)';
      g.fillRect(0, c.groundY + 30, W, H - c.groundY - 30);
      g.strokeStyle = 'rgba(140,170,210,0.14)';
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, c.groundY + 44 + i * 9); g.lineTo(W, c.groundY + 40 + i * 9); g.stroke(); }
      // strung lamps
      g.strokeStyle = 'rgba(180,160,120,0.4)'; g.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        const y0 = c.groundY - 120 - i * 26;
        g.beginPath();
        g.moveTo(140, y0);
        for (let x = 140; x < W - 100; x += 60) g.lineTo(x, y0 + Math.sin(x / 60) * 8 + 6);
        g.stroke();
        g.fillStyle = 'rgba(255,200,130,0.55)';
        for (let x = 170; x < W - 100; x += 120) g.fillRect(x, y0 + 6, 4, 6);
      }
    },
    points: [
      {
        x: 520, label: 'The Wick Trust — Guild Hall', icon: '✦', once: true,
        run: [
          { s: 'talk', lines: [['narrator', 'Almoner Vek receives you in a ledger, then in a chair, then in person, in that order.'], ['vek', 'The Ashfall Players. Kettle Row. Vellum Hollow. The bridge — I heard a shot.'], ['vek', 'The Trust would like to buy you. Exclusively. Candlelit parlor shows, four chits a seat, and the crowd files past a tray on the way out feeling “moved.” The tray is ours. What the crowd gives after the tray, you keep.'], ['bod', 'That’s almost generous.'], ['vek', 'It’s arithmetic with candles in it. Do we have an arrangement?'] ] },
          {
            s: 'negotiate', save: 'negGuild', who: 'vek', stakes: 'the best stage in the north — and who owns the light on it',
            tension: 0.5, likes: 'barter', hates: 'honest',
            rounds: [
              {
                line: ['vek', 'Exclusivity has no price. It has a floor.'],
                hint: 'His thumb is on the ledger line where numbers should be. He wants a number invented.',
                opts: [
                  { t: '“Three seats for the troupe, sixty-forty on the tray, and we advertise your wax in every program.”', kind: 'barter', dT: -0.16, react: [{ who: 'vek', text: 'His pupils dilate. To Vek, terms are poetry.' }] },
                  { t: '“Our price is that the poor get in free and you call it advertising.”', kind: 'honest', dT: 0.12, react: [{ who: 'vek', text: '“Altruism,” he says, like a man spitting gristle. “Audit it and you’ll find it’s a cost.”' }] },
                  { t: '“You counted the bridge shot in that ledger of yours. What’s a gunshot worth to you, Almoner?”', kind: 'read', dT: -0.05, react: [{ who: 'vek', text: '“Insurance,” he says, too fast.' }] },
                ],
              },
              {
                line: ['vek', 'There is also the Choir, singing at the sun. Do you know what they call my candles, players?'],
                hint: 'He is furious. He has dressed the fury in ledger-skin. It wants to be acknowledged.',
                opts: [
                  { t: '“Let me guess — inventory.” (respect his wound)', kind: 'respect', dT: -0.12, react: [{ who: 'vek', text: 'A blink of gratitude, filed before it escapes.' }] },
                  { t: '“They call them prayers with a price on them. I’d take it as a compliment.”', kind: 'jest', dT: -0.05, react: [{ who: 'vek', text: '“…with a margin,” he concedes. He does not smile. He stops not-smiling, which is adjacent.' }] },
                  { t: '“They’re right.”', kind: 'honest', dT: 0.18, react: [{ who: 'narrator', text: 'The pen stops. In this office, that is a gunshot.' }] },
                ],
              },
            ],
            concessions: [
              { t: 'Offer him a solo in the show: “The Almoner’s Waltz,” one bow, nothing else.', dT: -0.1, once: 'vekSolo', react: [{ who: 'vek', text: '“One bow,” he says. “The ledger records it as an investment in morale.”' }, { who: 'narrator', text: 'He has already stood in front of the mirror once this week for this exact possibility.' }] },
            ],
            out: {
              win: [{ s: 'talk', lines: [['vek', 'Contract’s the Guild’s and the troupe’s. Neutral ground: your theatre. And players — the Choir’s candle bill doubles ours now. Make it worth my pen.']], then: [{ s: 'do', fn: (a, G) => { G.flags.guildDeal = true; G.chits += 3; } }] }],
              even: [{ s: 'talk', lines: [['vek', 'Provisional. The Trust hosts, the troupe obeys, and the tray is “strategically placed.” Don’t make me regret adjectives.']], then: [{ s: 'do', fn: (a, G) => { G.flags.guildDeal = true; } }] }],
              bad: [{ s: 'talk', lines: [['vek', 'Then the Trust withdraws from the conversation. And the conversation was the only warm thing in this town.'], ['narrator', 'Behind you, the Guild’s lamp posts go out, all six of them, like a slow door.']], then: [{ s: 'do', fn: (a, G) => { G.flags.guildSpurned = true; } }] }],
            },
          },
        ],
      },
      {
        x: 1240, label: 'The Lamplight Choir — Chapel of the Listening Sun', icon: '✦', once: true,
        run: [
          { s: 'talk', lines: [['narrator', 'The Chapel is where Halloway hangs its grief to dry. Cantor Sable has a voice like a cello’s opinion and candles by the hundred, unlit, “until the sun asks.”'], ['sable', 'You perform at braziers. The Choir has noticed that your braziers work. Light is a conversation — the Trust thinks it is a meter.'], ['sable', 'Sing with us at vespers. No pay. The sun hears payment songs poorly.'], ['bod', 'I like her. I hate that I like her.'], ] },
          {
            s: 'negotiate', save: 'negChoir', who: 'sable', stakes: 'the chapel’s hundred candles, our show’s second half, and a truce in this town',
            tension: 0.45, likes: 'honest', hates: 'barter', meterLabel: 'HER SERENITY',
            rounds: [
              {
                line: ['sable', 'Tell me plainly: when you breathe fire, what are you saying to the sky?'],
                hint: 'She means it. She has watched a hundred performers and is only asking this of the ones she thinks hear the question.',
                opts: [
                  { t: '“We’re saying: we’re still here, we’re cold, and we’re rude enough to light a lamp anyway.”', kind: 'honest', dT: -0.17, react: [{ who: 'sable', text: '“Rude enough.” She files it inside a hymn; you can hear it fit.' }] },
                  { t: '“We’re saying nothing. It’s a show. God doesn’t book the second act.”', kind: 'read', dT: 0.06, react: [{ who: 'sable', text: '“Then you’ll be the first honest atheists in this chapel,” she says, and it is not a compliment, yet.' }] },
                  { t: '“What are the candles paying attention to, Cantor?”', kind: 'barter', dT: 0.1, react: [{ who: 'sable', text: 'Her smile turns to marble. “Don’t price the sky with me.”' }] },
                ],
              },
              {
                line: ['sable', 'The Trust calls your show taxable. We call it a psalm with stage fright. Choose what we are singing it as.'],
                hint: 'She’s offering you a label. Labels, here, are alliances.',
                opts: [
                  { t: '“Call it a psalm. But we keep the tray money — psalms pay rent.”', kind: 'honest', dT: -0.1, react: [{ who: 'sable', text: '“A psalm with… overhead,” she says, testing it, and keeps it.' }] },
                  { t: '“Call it neither. Call it Tuesday.”', kind: 'jest', dT: -0.04, react: [{ who: 'sable', text: '“Tuesday,” she repeats, and the Choir, hearing it through the walls, sighs like one body amused.' }] },
                  { t: '“Twenty chits and we’ll call it a collaboration.”', kind: 'barter', dT: 0.16, react: [{ who: 'sable', text: 'The hundred candles gutter at once. That is not physics. That is her.' }] },
                ],
              },
            ],
            concessions: [
              { t: 'Promise the Choir a new ending for the vespers — something with a door in it', dT: -0.1, once: 'choirEnding', react: [{ who: 'sable', text: '“Doors are good,” she says. “They let the song out.”' }] },
              { t: 'Give the chapel your braided wick (if Fenn gave you one)', if: { true: 'wickGift' }, dT: -0.2, once: 'wickGiven', react: [{ who: 'sable', text: 'She takes it like a relic and lights her own first candle from it, without a match, without a word.' }, { who: 'narrator', text: 'The Choir will tell the story wrong, kindly, for years.' }] },
            ],
            out: {
              win: [{ s: 'talk', lines: [['sable', 'Then we light the show. Both halves. The Trust will invoice the miracle and we’ll sing through the paperwork.']], then: [{ s: 'do', fn: (a, G) => { G.flags.choirAlly = true; G.oil = clamp(G.oil + 25, 0, G.oilMax); } }, { s: 'toast', text: '+25 oil — the Chapel’s whole winter tray', color: '#a8e0c5' }] }],
              even: [{ s: 'talk', lines: [['sable', 'We’ll light the candles if you can bear the quiet between your jokes. It’s mostly quiet between jokes, you know.']], then: [{ s: 'do', fn: (a, G) => { G.flags.choirAlly = true; } }] }],
              bad: [{ s: 'talk', lines: [['sable', 'Go, then. Perform to your ledgers. The sun, at least, never once cashed in.'], ['narrator', 'You leave with the taste of a hymn you almost knew.']] , then: [{ s: 'do', fn: (a, G) => { G.flags.choirSpurned = true; } }] }],
            },
          },
        ],
      },
      {
        x: 890, label: 'the Gilded Moth (your theatre now, allegedly)', icon: '✦',
        run: [{ s: 'sceneExit' }],
      },
    ],
  },

  moth_backstage: {
    id: 'moth_backstage', follow: [], worldW: 760, dark: 0.5, spawn: { x: 90 }, music: 'camp',
    objective: 'curtain in ten minutes. pick your battles and your bill',
    lights: [{ x: 380, r: 130 }, { x: 660, r: 80 }],
    npcs: [{ char: 'bod', x: 300, dir: 1 }, { char: 'nadia', x: 470, dir: -1 }, { char: 'tomas', x: 560, dir: -1 }],
    decor: (g, W, H, c) => {
      // a theatre in better decades
      g.fillStyle = '#131c2b';
      g.fillRect(0, 0, W, c.groundY - 180);
      g.strokeStyle = 'rgba(200,170,110,0.18)'; g.lineWidth = 2;
      for (let x = 40; x < W; x += 90) { g.beginPath(); g.moveTo(x, c.groundY - 200); g.lineTo(x, c.groundY - 180); g.stroke(); }
      g.fillStyle = 'rgba(120,40,50,0.22)'; // curtain
      g.beginPath();
      g.moveTo(180, c.groundY - 190);
      for (let x = 180; x < 560; x += 20) g.lineTo(x, c.groundY - 190 + Math.sin(x / 18) * 6);
      g.lineTo(560, c.groundY - 60);
      g.lineTo(180, c.groundY - 60);
      g.closePath(); g.fill();
      // moth sigil over the door
      g.fillStyle = 'rgba(232,182,76,0.5)';
      g.beginPath();
      g.ellipse(664, c.groundY - 130, 10, 14, 0, 0, TAU);
      g.ellipse(664 - 12, c.groundY - 134, 9, 6, -0.5, 0, TAU);
      g.ellipse(664 + 12, c.groundY - 134, 9, 6, 0.5, 0, TAU);
      g.fill();
    },
    points: [
      {
        x: 300, label: 'Bod, nervous inventory', icon: '✦',
        run: [{ s: 'talk', lines: [
          ['bod', 'Ropes: three. Chalk: one (Nadia’s argument, keep it off the floor). Chits: enough for one bad week.'],
          ['bod', 'The whole town’s in tonight. Guild, Choir, both. Trust to Choir in the same hall.'],
          ['miri', 'We’ve played minefields with better acoustics.'],
          ['bod', 'Minefields applaud less, but they also don’t grade you.'],
        ] }],
      },
      {
        x: 470, label: 'Nadia and Corporal Chalk, rehearsing insults', icon: '✦',
        run: [{ s: 'talk', lines: [
          ['nadia', 'Chalk says the Guild will try to own us and the Choir will try to adopt us and both will be surprised when we belong to the crowd.'],
          ['miri', 'Chalk is due you an apology.'],
          ['nadia', 'Chalk apologizes nightly. Chalk does not mean it nightly. There is a craft to it.'],
          ['narrator', 'She sets the marionette on her knee like an old comrade, and for a half-second you see the sniper, not the ventriloquist, in how gently she handles anything with a neck.'],
        ] }],
      },
      {
        x: 560, label: 'Tomas, tuning a rope to the room', icon: '✦',
        run: [{ s: 'talk', nodes: {
          start: 't',
          t: { lines: [['tomas', 'I measured the hall. If I walk the rope over the middle, they’ll all look up together — Guild, Choir, everyone. Nobody can be enemies looking at the same sky, Corporal. It’s in my notes.']],
            choices: [
              { t: '“Walk it. And Tomas — after, we go for the lighthouse. All of it, on one show.”', go: 'yes' },
              { t: '“The rope after the crowd is warm. Promise me after.”', go: 'after' },
            ] },
          yes: { lines: [['tomas', 'One show, one sea, one light. I’ll write it down so the war doesn’t get it back.']], effect: { trust: { tomas: 1 } }, then: [{ s: 'do', fn: (a, G) => { G.flags.ropePromise = true; } }] },
          after: { lines: [['tomas', 'After. Fine. Warm crowds first. You’re not wrong, you’re just older than me, which is unfair, and I’ll allow it.']], effect: { trust: { tomas: -1, bod: 1 } } },
        } }],
      },
      {
        x: 660, label: 'curtain up — the two lamps of Halloway await', icon: '➤', exit: true,
        run: [
          { s: 'music', name: 'waltz' },
          {
            s: 'perf', save: 'show2', bars: 16, every: 2, target: 0.72, bpm: 104,
            members: ['bod', 'nadia', 'tomas'],
            hitLines: ['the Guild auditor has forgotten which column he’s in', 'a Choir candle answers your cue — that is either God or a draft', 'Bod hits a note that rattles the chandelier and bows to it', 'somebody is crying and laughing at once; the best combination', 'two children on the balcony have started conducting in unison', 'even the Trust’s hats are tapping'],
            pattern: [
              { type: 'note', lane: 0 }, 'ball', { type: 'puppet', lane: 1 }, { rand: true, type: 'note' },
              { type: 'rope', lane: 2 }, 'fire', { rand: true, type: 'ball' }, { type: 'note', lane: 0, off: 1 },
              { type: 'puppet', lane: 1 }, 'ball', { type: 'rope', lane: 2 }, { rand: true, type: 'fire' },
            ],
            crowd: 80, seed: 3, decay: 0.052,
            out: {
              great: [
                { s: 'talk', lines: [
                  ['narrator', 'You have built the impossible: in one hall, the Guild and the Choir have spent forty minutes holding the same light over their heads — one paying for it, one blessing it, both pretending the other doesn’t exist while sharing the exact same gasp.'],
                  ['sable', 'Cantor, in the aisle, to nobody: it worked.'],
                  ['vek', 'Almoner, also in the aisle: marginally.'],
                  ['vek', '…Fund the lighthouse. All of us. Before I change my mind or die of feeling.'],
                ], then: [{ s: 'do', fn: (a, G) => { G.flags.fundedLamp = true; G.chits += 6; G.emitTrustFX(G.applyFX({ trust: { bod: 1, nadia: 1, tomas: 2 } })); } }, { s: 'toast', text: 'the lamp is funded · +6 chits', color: '#e8d5a8' }] },
              ],
              ok: [
                { s: 'talk', lines: [
                  ['narrator', 'It lands. Not glory — rent, again, but rent with witnesses. The Guild frowns warmly; the Choir hums approvingly; between the two, the town pays for its feelings the way it always has, quietly, all at once.'],
                  ['vek', 'A footnote in the minutes: the Trust will… co-underwrite… one expedition. Strictly as a line item.'],
                ], then: [{ s: 'do', fn: (a, G) => { G.flags.fundedLamp = true; G.chits += 3; G.emitTrustFX(G.applyFX({ trust: { tomas: 1 } })); } }] },
              ],
              poor: [
                { s: 'talk', lines: [
                  ['narrator', 'The rope snaps loose at the walk; Bod catches it, the chandelier, and both halves of the argument at once — the show ends as a rescue, which the town will call “the best bit” for twenty years, and you will never be able to explain the difference.'],
                  ['vek', 'The Trust will fund one expedition, marked “loss mitigation.”'],
                  ['bod', 'In showbiz, that’s a standing ovation with extra paperwork.'],
                ], then: [{ s: 'do', fn: (a, G) => { G.flags.fundedLamp = true; G.flags.mothLegend = true; } }] },
              ],
            },
          },
          { s: 'talk', lines: [['narrator', 'Outside, the canal lamps burn at double — a courtesy, or a warning, from a town that has decided to hope on credit. The coast road waits.'], ['miri', 'Pack the flame, players. We’re going to light something very large and very stupid.'], ['nadia', 'Our whole repertoire.']], then: [{ s: 'sceneExit' }] },
        ],
      },
    ],
  },

  lamp_yard: {
    id: 'lamp_yard', follow: [], pell: false, worldW: 1200, dark: 0.8, spawn: { x: 90 }, music: 'tension', wind: 0.35,
    objective: 'the lamp room is above. the dark is all around. set the braziers, then hold until the bells',
    lights: [{ x: 1040, r: 60 }],
    npcs: [{ char: 'tomas', x: 980, dir: -1 }, { char: 'bod', x: 260, dir: 1 }, { char: 'nadia', x: 320, dir: 1 }],
    decor: (g, W, H, c) => {
      // the dead lighthouse, close
      g.fillStyle = '#0d1524';
      g.beginPath();
      g.moveTo(W * 0.86 - 70, c.groundY); g.lineTo(W * 0.86 - 40, c.groundY - 340); g.lineTo(W * 0.86 + 40, c.groundY - 340); g.lineTo(W * 0.86 + 70, c.groundY);
      g.closePath(); g.fill();
      g.fillStyle = '#101b2c'; g.fillRect(W * 0.86 - 50, c.groundY - 386, 100, 48);
      g.save(); g.globalAlpha = 0.1; g.fillStyle = '#8a453a';
      for (let i = 0; i < 5; i++) g.fillRect(W * 0.86 - 62 + i, c.groundY - 60 - i * 64, 124 - i * 2, 20);
      g.restore();
      // broken fence to the sea
      g.strokeStyle = '#0a1018'; g.lineWidth = 3;
      for (let x = 60; x < 700; x += 40) { g.beginPath(); g.moveTo(x, c.groundY); g.lineTo(x + (x % 3 ? -6 : 5), c.groundY - 30 - (x % 40) / 2); g.stroke(); }
      // the keeper’s cottage
      house(g, 120, c.groundY, 110, 70, '#0c1522', []);
    },
    points: [
      {
        x: 980, label: 'Tomas, at the foot of the tower', icon: '✦',
        run: [{ s: 'talk', nodes: {
          start: 't',
          t: {
            lines: [
              ['narrator', 'The log is where Tomas said it would be, under a stone, in a tin: The keeper kept a journal to the last page. “Cold tonight. Lamp fueled to dawn. Ships passed three, rang the bell for us. Someone is always passing. Light it, whoever finds this.”'],
              ['tomas', 'Three braziers on the yard. If they hold, the reflector stays hot till the bells. If they hold and I climb — I can light the lamp. It’s that simple, Corporal. It’s that stupid.'],
            ],
            choices: [
              { t: '“Then we hold. Like we held the mill, the ford, the whole rotten line. We hold.”', go: 'brave', effect: { trust: { tomas: 1 } } },
              { t: '“If it breaks, it breaks while we’re standing. That’s the whole plan and it’s a good one.”', go: 'brave' },
              { t: '“If the wisps take it, we chase it down with songs and shoves like the circus men we claim to be.”', go: 'brave', effect: { trust: { bod: 1, nadia: 1 } } },
            ],
          },
          brave: { lines: [['narrator', 'Above you, the dead lens waits with twelve years of frost on its ambition. Below you, the dark has started, very quietly, to assemble.']], next: null },
        } }],
      },
      {
        x: 300, label: 'a parley flag, on a spear, in the snow', icon: '✦', once: true,
        run: [
          { s: 'music', name: 'tension' },
          {
            s: 'negotiate', save: 'negSlat', who: 'slat', meterLabel: 'HIS INTEREST',
            stakes: 'the night. possibly the season. possibly the story they tell after',
            tension: 0.62, likes: 'read', hates: 'respect',
            opener: [
              ['narrator', 'The Reavers of the Wisp keep a strange economy: they collect extinguishers, snuffers, the tools of ending light — and never use them. Slat, their chief, walks to the firelight alone, and talks like weather with manners.'],
              ['slat', 'Keepers of a dead lamp. Adorable. Here is the offer the dark extends, gratis: leave the braziers to us, take the troupe, take the road, take our blessing. The tower goes cold, everyone stays warm elsewhere. This is mercy. It has a deadline.'],
            ],
            rounds: [
              {
                line: ['slat', 'Your lamp will out-argue theirs. Ours, I mean. The Choir’s. One more hope in a valley that eats hope like turnip. Why is yours different?'],
                hint: 'He wants the answer that convinces him. That means he came this far wanting to be talked down.',
                opts: [
                  { t: '“It isn’t different. It’s louder, and louder is what light is for.”', kind: 'read', dT: -0.15, react: [{ who: 'slat', text: 'He laughs once, the way rocks do. “Answer accepted, provisionally.”' }] },
                  { t: '“Because the boy who carries it counts every ship that passes. He’s up to nine hundred.”', kind: 'honest', dT: -0.1, react: [{ who: 'slat', text: '“…Nine hundred,” he repeats. He has done the arithmetic. He hates that it pays.' }] },
                  { t: '“You collect extinguishers and never snuff with them. Don’t get noble at my fire, Slat.”', kind: 'threat', dT: 0.12, react: [{ who: 'slat', text: '“Careful,” he says, gently. “The dark has a temper and I’m its landlord.”' }] },
                ],
              },
              {
                line: ['slat', 'Price, then, since you insist on trading. The tower’s oil — all of it, and your troupe’s whole purse. We will even call it theft, so your history books stay honest.'],
                hint: 'The price is theater. He has already priced his own exit. Give him a face-saving one.',
                opts: [
                  { t: '“Take the purse. Call it tithe. We’ve been taxed by worse lamps.”', kind: 'barter', dT: -0.2, cost: 3, onceFlag: 'slatPaid', react: [{ who: 'slat', text: '“…Tithe,” he tries the word like borrowed boots. It fits. He hates that it fits.' }] },
                  { t: '“Keep the purse. Take a show instead — the wisps loved Kettle Row, you know. Word travels, even in the dark.”', kind: 'jest', dT: -0.12, onceFlag: 'slatShow', react: [{ who: 'slat', text: '“The dark does not applaud,” he says, but he looks at the fire like a man considering a reservation.' }] },
                  { t: '“No. The lamp burns free or it doesn’t burn, and you know what that costs.”', kind: 'honest', dT: 0.08, react: [{ who: 'slat', text: '“Then it’s free,” he says, “and so are we.” He does not step back.' }] },
                ],
              },
            ],
            out: {
              win: [{
                s: 'talk', lines: [
                  ['slat', 'The dark declines tonight’s business. Tomorrow, though — the dark is patient and it has your ledger, Almoner’s cousin’s friend.'],
                  ['narrator', 'He walks backward into the black until the black is keeping him, and the wisps follow like a question that agreed to wait.'],
                  ['bod', 'Did we win?'],
                  ['nadia', 'We negotiated with weather, Bodfrie. Nobody wins. We only get to keep the umbrella.'],
                ], then: [{ s: 'do', fn: (a, G) => { G.flags.slatSpared = true; G.flags.wispsCalm = true; G.emitTrustFX(G.applyFX({ trust: { bod: 1, nadia: 1 } })); } }],
              }],
              even: [{
                s: 'talk', lines: [['slat', 'A stay of execution, then, which is how all stays feel from the wrong side. We’ll watch. We’re very good at watching.']],
                then: [{ s: 'do', fn: (a, G) => { G.flags.wispsCalm = true; } }],
              }],
              bad: [{
                s: 'talk', lines: [['slat', 'Then we collect.'], ['narrator', 'He does not raise his voice; the firelight does, and goes out at the edges of the yard, all at once, like an auditor closing a book.'], ['miri', 'To arms, players. And I mean the whistles, the rope and the lantern — not the other. Not unless.']], next: null,
              }],
            },
          },
        ],
      },
      {
        x: 640, label: 'light the vigil braziers', icon: '➤', exit: true,
        run: [
          {
            s: 'talk', lines: [
              ['narrator', 'Three braziers, one lens, one night, until the dawn bells at the town hall carry across the ice. Tomas climbs with the last of the oil. Below, the troupe forms a ring of light — and the dark, on schedule, arrives.'],
            ],
          },
          {
            s: 'guard', save: 'vigil', time: 95, minLit: 2, firstAt: 5, every: 8.5, maxWisps: 7,
            leaderAt: 62, leaderInterrupts: 3,
            braziers: [0.22, 0.5, 0.78],
            out: {
              win: [{
                s: 'talk', lines: [
                  ['narrator', 'The bells arrive with the color of apricot on ice. Above the yard, the dead lens wakes — and the lamp of Vellum Point, twelve years cold, throws its first long beam out over the black water.'],
                  ['tomas', 'One ship! One ship answered! That’s the log, that’s the last page — “someone is always passing.” Bodfrie — they answered back. They rang.'],
                  ['bod', 'They rang, Corporal.'],
                  ['narrator', 'You stand in a ring of exhausted light, four soldiers who have won something that will not be taken by being forgotten.'],
                ], then: [{ s: 'do', fn: (a, G) => { G.flags.lampLit = true; G.emitTrustFX(G.applyFX({ trust: { tomas: 2, bod: 1, nadia: 1 } })); } }, { s: 'sfx', sting: 'triumph' }],
              }],
              lose: [{
                s: 'talk', lines: [
                  ['narrator', 'The bells come anyway, and with them something the yard did not plan for: light, moving across the snow. Halloway’s people — the Choir with chapel candles, the Guild’s apprentices with lanterns on carts, militia with braziers on poles. They form the ring themselves and hold it until dawn.'],
                  ['vek', 'Don’t read into it. It’s a tax shelter.'],
                  ['sable', 'It’s a psalm with overhead.'],
                  ['tomas', '…It worked. The lamp didn’t need me. It needed all of it. That’s better. I don’t like how much better it is.'],
                ], then: [{ s: 'do', fn: (a, G) => { G.flags.lampLit = true; G.flags.lampLitByAll = true; G.emitTrustFX(G.applyFX({ trust: { tomas: 1 } })); } }],
              }],
            },
          },
          { s: 'sceneExit' },
        ],
      },
    ],
  },

  lamp_top: {
    id: 'lamp_top', follow: [], pell: false, worldW: 700, dark: 0.35, spawn: { x: 90 }, music: 'dawn',
    objective: 'there is nowhere to be until morning',
    lights: [{ x: 560, r: 260, mul: 1, warm: '255,214,150' }],
    npcs: [{ char: 'tomas', x: 520, dir: -1 }, { char: 'bod', x: 380, dir: 1 }, { char: 'nadia', x: 430, dir: -1 }],
    decor: (g, W, H, c) => {
      // parapet + the great lens
      g.fillStyle = '#101a2b';
      g.fillRect(0, c.groundY, W, H - c.groundY);
      g.strokeStyle = 'rgba(190,210,240,0.2)'; g.lineWidth = 2;
      for (let x = 30; x < W; x += 46) { g.beginPath(); g.moveTo(x, c.groundY); g.lineTo(x, c.groundY - 26); g.stroke(); }
      g.strokeRect(534, c.groundY - 96, 52, 52);
      g.fillStyle = 'rgba(255,222,160,0.32)';
      g.beginPath(); g.arc(560, c.groundY - 70, 26, 0, TAU); g.fill();
      // the sea below, with one light answering
      g.fillStyle = 'rgba(8,14,26,0.9)';
      g.fillRect(0, c.groundY + 60, W, H - c.groundY - 60);
      g.fillStyle = 'rgba(255,230,180,0.8)';
      g.beginPath(); g.arc(W * 0.2, c.groundY + 92, 2.4, 0, TAU); g.fill();
    },
    points: [
      {
        x: 300, label: 'Pell, on the parapet, counting', icon: '✦', once: true,
        run: [{ s: 'talk', lines: [
          ['narrator', 'Pell sits at the edge with his legs in the drop because he can hear the light better here, he signs, which is nonsense, which is exactly true.'],
          ['narrator', 'He signs, holding up nine fingers, then two, then counting on both hands again: nine hundred and two. Then he signs the word he invented for the lamp, the one he has been saving since the road: WARM.'],
          ['miri', '…Nine hundred and two. Then we owe the next one too, I suppose.'],
          ['narrator', 'He signs yes so fast it is one motion. Somewhere below, the bells start early, on their own, all across the valley.'],
        ], then: [{ s: 'do', fn: (a, G) => { G.emitTrustFX(G.applyFX({ trust: { tomas: 1 } })); G.flags.pellWord = true; } }] }],
      },
      {
        x: 640, label: 'the coast road, and whatever comes after', icon: '➤', exit: true,
        run: [{ s: 'talk', lines: [
          ['nadia', 'The case has one round left. I’ve decided it’s a firework. Don’t argue; I’ve been arguing with Chalk all night and he agrees with me.'],
          ['bod', 'Where to, Corporal?'],
          ['miri', 'Everywhere the light shows. It’s a big coast, and we’re booked.'],
        ] }, { s: 'sceneExit' }],
      },
    ],
  },

  festival: {
    id: 'festival', follow: [], pell: false, worldW: 1600, dark: 0.42, spawn: { x: 80 }, music: 'dawn', wind: 0.05,
    objective: 'walk it slow. you earned the walk',
    lights: [],
    npcs: [
      { char: 'bod', x: 300, dir: 1 }, { char: 'nadia', x: 700, dir: -1, phase: 2 }, { char: 'tomas', x: 1120, dir: 1, phase: 3 }, { char: 'pell', x: 1150, dir: 1, phase: 5 },
      { char: 'hask', x: 480, dir: -1 }, { char: 'anna', x: 520, dir: 1, phase: 1 },
    ],
    decor: (g, W, H, c) => {
      house(g, 180, c.groundY, 130, 80, '#131c2b', [[30, 30], [80, 30]]);
      house(g, 760, c.groundY, 150, 96, '#121b29', [[40, 34], [96, 34]]);
      house(g, 1280, c.groundY, 140, 84, '#131c2b', [[50, 30]]);
      // a thousand lanterns: strung, held, floated
      g.save();
      const R = c.R;
      for (let i = 0; i < 60; i++) {
        const x = R() * W, y = c.groundY - 40 - R() * 210;
        g.fillStyle = 'rgba(255,190,110,0.16)';
        g.beginPath(); g.arc(x, y, 9 + R() * 6, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,214,140,0.9)';
        g.fillRect(x - 2, y - 3, 4, 6);
      }
      g.strokeStyle = 'rgba(200,180,130,0.25)';
      for (let row = 0; row < 3; row++) {
        const y0 = c.groundY - 150 - row * 34;
        g.beginPath(); g.moveTo(0, y0);
        for (let x = 0; x <= W; x += 54) g.lineTo(x, y0 + Math.sin(x / 54 * 2 + row) * 10);
        g.stroke();
      }
      g.restore();
    },
    live: (g, s, t, cam) => {
      // everyone carries a flame
      const G = s.app.G;
      const n = 26;
      for (let i = 0; i < n; i++) {
        const x = ((i / n) * (s.worldW + 300) + t * 18) % (s.worldW + 300) - 150;
        const sx = x - cam;
        if (sx < -30 || sx > s.W + 30) continue;
        drawFlame(g, sx, s.groundY - 26, 1.8, t, i * 31);
      }
    },
    points: [
      { x: 300, label: 'Bod, teaching Siegfried to waltz', icon: '✦', run: [{ s: 'talk', lines: [['bod', 'Three towns have offered residency. Four. I lost count because a child kept adding to the number.']], then: [{ s: 'do', fn: (a, G) => { G.emitTrustFX(G.applyFX({ trust: { bod: 1 } })); } }] }] },
      { x: 490, label: 'Sergeant Hask, saluting in triplicate', icon: '✦', run: [{ s: 'talk', lines: [
        ['hask', 'Permit for Collective Joy. Renewed. Annually. Indefinitely.'],
        ['hask', '…I signed it first. Before the meeting. For the record, I did say it was an emergency.'],
        ['miri', 'Sergeant. That’s a standing ovation, in bureaucrat.'],
      ] }] },
      { x: 700, label: 'Nadia, on the roof, aiming at nothing', icon: '✦', run: [{ s: 'talk', lines: [
        ['nadia', 'One round. I put it in the lantern, like a coin in a fountain. Chalk says it’s sentimental. Chalk and I have agreed to disagree on everything but aim.'],
        ['narrator', 'From up here the festival looks like an amphitheater the valley built by accident. She stays up here the whole walk, which is how you know it got to her.'],
      ] }] },
      { x: 1120, label: 'Tomas and Pell, keepers both', icon: '✦', run: [{ s: 'talk', lines: [
        ['tomas', 'New page, same line. “Dawn: observed.” The town council made us keepers. Us. The players. They say it’s symbolic. I say it’s overtime, and I said it smiling, so we’re even.'],
        ['narrator', 'Pell hands you a small book: the counting, nine hundred and two, and one more line in handwriting that is definitely not his: “The performers are the light too. Don’t forget.”'],
      ] }] },
      { x: 1520, label: 'the road, as always', icon: '➤', exit: true, run: [{ s: 'sceneExit' }] },
    ],
  },
};

/* ---------------- the acts ---------------- */

const PROLOGUE = [
  { s: 'card', kicker: 'Prologue', title: 'The Dimming', music: 'sad', dur: 5.2,
    sub: (G) => 'Twelve years ago the sun became a coal.\nNot gone — reduced. Eleven parts in a hundred of what it was.\nThe maps stayed. The calendars lied. The cold learned the names of our towns.',
    hint: 'arrows / A D — move · E — speak · SPACE — continue · ESC — pause' },
  { s: 'talk', lines: [
    ['narrator', 'In the first winters, people still faced south at noon like it owed them something. Now the light is where you make it: braziers, lamp rooms, the borrowed glow of other people’s suppers.'],
    ['narrator', 'What the cold could not finish, the ledgers tried. The Wick Trust priced the flame. The Lamplight Choir promised to sing it back. And on every road, in every square, at every brazier — the soldiers nobody needed anymore became the only thing the world still needed.'],
    ['narrator', 'The entertainers.'],
    ['narrator', 'The Ashfall Players, for one: a juggler with a corporal’s rank and a habit of counting exits; a sapper with a tuba; a sniper with a puppet; and a medic of seventeen, who is writing the future in a keeper’s log he hasn’t earned yet.'],
  ] },
  { s: 'music', name: 'camp' },
  { s: 'scene', id: 'camp' },
  { s: 'sfx', sting: 'reveal' },
  { s: 'endact' },
];

const ACT1 = [
  { s: 'card', kicker: 'Act One', title: 'Permit for Collective Joy', dur: 3.6, sub: 'Vellum Hollow — one brazier, eight hundred souls, and a militia with forms for everything, including hope.' },
  { s: 'scene', id: 'hollow_gate' },
  { s: 'music', name: 'town' },
  { s: 'scene', id: 'hollow_square' },
  { s: 'music', name: 'sad' },
  { s: 'scene', id: 'hollow_night' },
  { s: 'endact' },
];

const ACT2 = [
  { s: 'card', kicker: 'Act Two', title: 'The Cold Road', dur: 3.6, sub: 'Between valleys, the rules are older than the Trust: keep a flame, keep together, don’t be a hero, don’t be alone.' },
  {
    s: 'road', save: 'road', len: 2600, gustEvery: 8, drain: 0.42, cartX: 900,
    torches: [340, 620, 980, 1290, 1680, 2020, 2300],
    onDone: [
      { s: 'card', title: 'and then it comes to this', sub: 'the bridge at Harrow Ford — three shapes, one lantern, and the arithmetic of old reflexes', dur: 2.6 },
      {
        s: 'combat', save: 'ambush', title: 'THE BRIDGE', arena: 900,
        foes: ['reaver', 'reaver', 'boss'],
        out: {
          win: [{ s: 'talk', lines: [
            ['narrator', 'It is over in twenty seconds and it will be in your ears for years. Nobody thanks you. Nobody has to. Bodfrie puts his tuba down and Nadia has not moved from the tree line at all, which tells you everything about how this almost went.'],
            ['miri', 'Formation. Nobody say the word “fine” unless it rhymes with “shrine,” because we are not allowed to feel fine about this.'],
            ['bod', '“Divine?”'],
            ['miri', 'We’ll take it.'],
          ], then: [{ s: 'do', fn: (a, G) => { G.emitTrustFX(G.applyFX({ trust: { bod: 1, nadia: 1 } })); } }] }],
          standdown: [{ s: 'talk', lines: [
            ['narrator', 'You step back. You bow — the deep one, the theatre one, boots and all — and the fight falls out of the evening like a tooth. They run. You keep the road.'],
            ['slat', 'from the dark, almost fond: The troupe bows at bandits. The dark is going to talk about this.'],
            ['nadia', 'Let it. Good stories travel free.'],
          ], then: [{ s: 'do', fn: (a, G) => { G.flags.mercyBridge = true; G.emitTrustFX(G.applyFX({ trust: { nadia: 1, bod: 1 } })); } }] }],
          rob: [{ s: 'talk', lines: [
            ['narrator', 'You take the coats, the candle-money, and (from the big one’s boot) a stolen extinguisher, engraved, with the tenderness people reserve for weapons: “Property of the Wick Trust — Do Not Hope.”'],
            ['bod', 'Is it wrong that this feels like logistics?'],
            ['nadia', 'It’s wrong that it feels easy. Take the money anyway. Buy oil. Confess later.'],
          ], then: [{ s: 'do', fn: (a, G) => { G.flags.robbedBridge = true; G.chits += 4; G.emitTrustFX(G.applyFX({ trust: { tomas: -1 } })); } }] }],
          talk: [{ s: 'talk', lines: [
            ['narrator', 'Nadia steps into the light with her hands open and her voice doing the thing it does to mugs and arguments, and for four minutes nobody breathes. Then they go. Nobody fired anything. You will all mention this, at exactly one future dinner, for the rest of your lives.'],
            ['nadia', 'What did I say?'],
            ['tomas', 'You said, “we’re the Ashfall Players, you have three coats and we have a tuba, let’s all be less poor.”'],
            ['nadia', '…Efficient.'],
          ], then: [{ s: 'do', fn: (a, G) => { G.flags.talkedDown = true; G.emitTrustFX(G.applyFX({ trust: { nadia: 2 } })); } }] }],
          finish: [{ s: 'talk', lines: [
            ['narrator', 'You do it. It is quick, it is worse than quick, and afterward the snow has opinions. Bodfrie says nothing for a day and a half, which is the loudest any of you have ever heard him.'],
            ['nadia', 'Don’t. Don’t thank me for not saying it’s fine.'],
            ['narrator', 'You carry the weight down the road like a prop you forgot to strike after the show.'],
          ], then: [{ s: 'do', fn: (a, G) => { G.flags.bloodOn = true; G.emitTrustFX(G.applyFX({ trust: { bod: -1, tomas: -1, nadia: -1 } })); } }] }],
          pyrrhic: [{ s: 'talk', lines: [
            ['narrator', 'The last thing you see standing is Tomas between you and the second blow, holding a medical kit like a shield, which — absurd, impossible — he survives. Nadia’s one round ends the argument for good.'],
            ['nadia', 'The firework. I’m using the firework.'],
            ['tomas', '…You aimed away from them. Both times.'],
            ['nadia', 'I aimed away from them both times. That was the whole skill, seventeen.'],
          ], then: [{ s: 'do', fn: (a, G) => { G.flags.pellHero = true; G.emitTrustFX(G.applyFX({ trust: { tomas: 2 }, ammo: -1 })); } }] }],
        },
      },
    ],
    events: [
      {
        at: 1180,
        steps: [{
          s: 'talk', nodes: {
            start: 'pell',
            pell: {
              lines: [
                ['narrator', 'In the wheel well of a burned-out coach: a child, maybe nine, inside a coat three sizes of courage too big, keeping a small flame in a tin with a wick of braided hair. He does not run. He holds the tin up like evidence.'],
                ['bod', 'He’s been feeding it. Look at the tin — he’s been feeding it for who knows how long.'],
                ['nadia', 'He can’t hear us. I signed at him. Nothing.'],
                ['tomas', 'He watches hands. He’s been watching hands his whole small life and learning what they’ll do next.'],
              ],
              choices: [
                { t: '“He walks with us. Hand signals first day one. Nobody’s tin goes empty on my watch.”', go: 'take', effect: { trust: { tomas: 1, bod: 1 } } },
                { t: '“We can’t. Halloway’s two days of road in both directions and half an oil can.” (Leave him chits and the second lantern.)', go: 'leave', effect: { chits: -1, trust: { nadia: 1 } } },
              ],
            },
            take: {
              lines: [
                ['narrator', 'He gives the tin to Tomas without being asked, which is the most terrifying thing any of you have witnessed all winter: a child trusting the distribution of a flame.'],
              ],
              then: [{ s: 'do', fn: (a, G) => { G.applyFX({ pell: true }); G.flags.hasPell = true; } }, { s: 'toast', text: 'Pell joins the troupe', color: '#a8e0c5' }],
              next: null,
            },
            leave: {
              lines: [
                ['narrator', 'You leave the chits, the spare lantern, and a bow from the troupe — four people bowing to a child with a tin, formally, like officers. He bows back. Somewhere behind the wind, he catches up to you two miles later and never explains it.'],
              ],
              then: [{ s: 'do', fn: (a, G) => { G.applyFX({ pell: true }); G.flags.pellPersistent = true; } }, { s: 'toast', text: 'he followed anyway. of course he did', color: '#a8e0c5' }],
              next: null,
            },
          },
        }],
      },
    ],
  },
  { s: 'music', name: 'camp' },
  { s: 'scene', id: 'bridge_toll' },
  { s: 'endact' },
];

const ACT3 = [
  { s: 'card', kicker: 'Act Three', title: 'The Two Lamps of Halloway', dur: 3.8, sub: 'A canal town where the Trust sells the light and the Choir borrows it back —\nand both have just heard that a troupe with a rope, a tuba and a pistol is coming to stay.' },
  { s: 'scene', id: 'halloway' },
  { s: 'scene', id: 'moth_backstage' },
  { s: 'endact' },
];

const ACT4 = [
  { s: 'card', kicker: 'Act Four', title: 'What the Dark Owes', dur: 3.8, sub: 'Vellum Point. A dead lighthouse, a keeper’s log, one lens, and\na reaver with a parley flag and the patience of the permanently night-shifted.' },
  { s: 'scene', id: 'lamp_yard' },
  { s: 'music', name: 'dawn' },
  { s: 'scene', id: 'lamp_top' },
  { s: 'endact' },
];

const EPILOGUE = [
  { s: 'card', kicker: 'Epilogue', title: 'Dawn, Technically', dur: 4.2,
    music: 'dawn',
    sub: (G) => {
      const lines = [];
      lines.push('The sun is still a coal. Nobody is calling that a lie anymore.');
      lines.push('What has changed is smaller and harder to audit: a lamp on Point, a troupe on the road,');
      lines.push('a valley that leaves its doors unlatched for performers the way it once did for weather.');
      return lines.join('\n');
    } },
  { s: 'scene', id: 'festival' },
  { s: 'card', title: (G) => 'The Company Keeps', kicker: 'the final page of the keeper’s log', dur: 6.5, music: 'dawn',
    sub: (G) => {
      const L = [];
      const t = G.trust;
      L.push('Bodfrie: ' + (t.bod >= 4 ? 'accepted a chair in four towns and a chorus in all of them. Siegfried has a plaque now.' : t.bod <= 1 ? 'quiet, quieter; he still taps the snow. But he taps it beside you.' : 'the tuba is louder; the jokes are landing on the new towns like the old ones. Good trade.'));
      L.push('Nadia: ' + (t.nadia >= 4 ? 'Corporal Chalk now has his own dressing tin. She lets you read the one page she keeps under it: names, all of them, none of them heroes.' : t.nadia <= 1 ? 'she counts exits again the way she used to. The troupe walks a little slower.' : '“no thank-yous, only debts,” she reminds you, before every show, like a prayer with a budget.'));
      L.push('Tomas: ' + (t.tomas >= 4 ? 'Page one of his own log: “Dawn: observed. Continuing the description for anyone who asks.” He is earning it.' : t.tomas <= 1 ? 'the arithmetic of mercy gave him a remainder he shouldn’t have to carry at seventeen.' : 'the keeper’s apprentice, officially. The pay is symbolic. He has made it literal.'));
      if (G.pell) L.push('Pell: nine hundred and nine ships. He has started keeping the tally on the lighthouse wall in soot.');
      if (G.flags.mercyBridge || G.flags.talkedDown) L.push('On the coast road, a song exists with four verses and no chords. The Reavers hum the third one. Nobody has stopped it.');
      if (G.flags.bloodOn) L.push('There is one name none of you say. Bodfrie carved a notch for it on the tuba’s bell. It sounds better, now. That’s the part nobody forgives or fixes.');
      if (G.flags.slatSpared) L.push('Slat sends word each winter, billed formally to the troupe: “The dark declines to comment. It applauds the lamp. — S.”');
      if (G.flags.lampLitByAll) L.push('Every year the valley relights the Point without the Trust, without the Choir, together and badly, which is how all real ceremonies run.');
      L.push('');
      L.push('The sun stays reduced. The light stays distributed. The tour continues.');
      return L.join('\n');
    },
    hint: '— end of tour —' },
  { s: 'do', fn: (app, G) => { G.flags.completed = true; app.save(); } },
  { s: 'credits' },
];

export const ACTS = [PROLOGUE, ACT1, ACT2, ACT3, ACT4, EPILOGUE];
