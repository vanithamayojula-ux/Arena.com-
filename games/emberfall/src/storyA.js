// EMBERFALL — the whole tour, written down. All narrative content lives here as data;
// the scenes are just good stages. Prose rules of this world: short lines, specific
// images, jokes told at funerals, hope kept small enough to carry.

export const GAME = {
  title: 'EMBERFALL',
  subtitle: 'A LANTERN-TROUPE STORY',
  kicker: 'ARENA ARCADE PRESENTS · A NARRATIVE ACTION-ADVENTURE',
};

export const FRAGMENTS = {
  dimming: {
    title: 'ON THE DIMMING',
    text: 'It was not an event. It was a weather: a season of ash from forty burning cities that simply forgot to end. The sun was not extinguished, only — as the almanacs put it — "persistently overcast at the source." The astronomers stopped correcting people who called it the end of the world. It was easier on the handwriting.',
  },
  fortyseventh: {
    title: 'THE 47TH LIGHT INFANTRY',
    text: 'Raised to hold lit ground: lamps, wells, refineries, anything the maps drew with a small flame on it. Their motto was stamped on every lamp housing: WE KEEP IT BURNING. Their muster-out papers were stamped, on the same presses, with WE ARE SORRY. The troupe keeps both mottoes. The second one gets the applause.',
  },
  millpond: {
    title: 'THE MILLPOND SONG (FIRST VERSE, AS WRITTEN)',
    text: 'Sleep, small sun, your hour is done / we\'ll keep the cheaper kind / a fistful of flame, a borrowed name / and let the dark look blind. // (The second verse exists but the troupe only sings it when someone is about to be brave, or shortly after.)',
  },
  citation: {
    title: 'AUDITOR PELL\'S MARGINALIA',
    text: 'Found folded in the Hollow Mill citation: "Ambient daylight — not billable. Candle — billable. Starlight — under review. Note to self: if the sky is a tenant, tax it. — P." Someone has written underneath, in a soldier\'s block capitals: "WE TRIED."',
  },
  mothsguild: {
    title: 'THE GILDED MOTHS, CARD OF FIVE',
    text: 'A playbill, sun-faded: THE GILDED MOTHS — "Sorrow, Curated." Five faces in greasepaint. Four of them. The fifth name has been inked out, and where the ink pools, someone has scratched: "he took the quiet money."',
  },
  ashenorder: {
    title: 'THE ASHEN ORDER',
    text: 'Signed 6 weeks before the Armistice: the 47th is to render the Cape Ashen light "unusable by any party" — the soft way the high command said "burn it." The order was never countersigned by anyone living. The 47th, being retired rather than dead, filed it in the only place filing goes these days: a song.',
  },
  keeperlog: {
    title: 'KEEPER\'S LOG, YEAR 19',
    text: 'Lamp full. Sea flat. Ate the last of the onion — it ate some of me. Heard music up the cliff road tonight. Have not heard music in — checked the tally — do not need to check the tally. If it\'s the Choir I\'ll be polite. If it\'s players I\'ll be *generous*. Kettle on regardless. They\'ll come.',
  },
  nunepre: {
    title: 'BROTHER NUNE, BEFORE',
    text: 'An old guild letter, before his robes: "Singer N. of the Cape Ashen Cathedral Choir — leave of sine die granted on account of *voice loss, grief, and the fact of the sky.*" Beneath, in the same hand: "The voice came back. I did not."',
  },
  slowburn: {
    title: 'THE SLOW-BURN TRICK',
    text: 'Fenn\'s trick, taught on request: a lamp trimmed late burns half as fast and twice as sad — but sad burns long. "People share sad," Fenn says. "Nobody shares bright." The Wickwright Union lists it as a "misuse of apparatus." Three villages list it as how they got here.',
  },
};

const SP = {
  vera: 'VERA', odile: 'ODILE', bram: 'BRAM', fenn: 'FENN', cinder: 'CINDER · TICKER',
  ouda: 'OUDA, THE MILLER', pell: 'AUDITOR PELL', hessa: 'FOREMAN HESSA',
  prim: 'PRIM OF THE MOTHS', nune: 'BROTHER NUNE', keeper: 'THE KEEPER', boy: 'COLL, HER BOY',
  troupe: 'THE TROUPE',
};

const b = (sp, tx, o = {}) => ({ sp, tx, ...o });

// ------------------------------------------------------------------ PROLOGUE

const prologue = {
  id: 'prologue',
  name: 'PROLOGUE — HOLLOW MILL',
  steps: [
    {
      type: 'vignette', bg: 'road', place: 'THE LOW ROAD · DUSK',
      cast: { vera: { x: 0.42 }, cart: { x: 0.68 } },
      beats: [
        b(SP.vera, 'Thirty years ago the sun caught a cold, and nobody brought it soup.'),
        b(SP.vera, 'That\'s the whole of cosmology now. *A sixpence behind wet wool*, the almanacs call it. We call it Tuesday.'),
        b(SP.odile, 'The captain is doing the thing.'),
        b(SP.bram, 'What thing.'),
        b(SP.odile, 'The narrating thing. When she narrates, it means we are short on oil.'),
        b(SP.fenn, 'We are not short on oil. We are *concentrated.*'),
        b(SP.cinder, 'BAD NEWS: HOLLOW MILL\'S LAMP IS UNDER SEAL. I ATE HALF OF IT. THE REST IS IN YOUR POCKET, CAPTAIN.'),
        b(SP.vera, 'Thank you, Cinder. — All right. Listen in. We are the Lantern Troupe, late of the 47th Light Infantry, retired mostly. Two roads from here, Hollow Mill pays our tab in lamp oil if we\'re charming, cabbage if we\'re not.', { fx: { fragment: 'fortyseventh' } }),
        b(SP.bram, 'I prefer the cabbage weeks. Less responsibility.'),
        b(SP.vera, 'The mill\'s lamp is under Wickwright seal until they pay an ambient-light fee. The auditor\'s there tonight with a string and a clipboard. So we do what we always do: we play, we sweet-talk a functionary, and *nothing* has to be shot at.'),
        b(SP.odile, 'When *does* something have to be shot at?'),
        b(SP.vera, 'Hard to say. I hear the dark is developing opinions.'),
        b(SP.fenn, 'Signals up the road gone quiet, three villages back. Nobody says it, but everybody\'s walked that road lately. Keep the Sunkey lit, keep in my light, don\'t be heroic. In that order.'),
      ],
    },
    {
      type: 'road',
      route: {
        name: 'THE LOW ROAD', place: 'TO HOLLOW MILL', seed: 3, len: 46, burn: 0.10,
        hint: 'MOVE — A / D or ARROWS · WALK OVER GLITTER TO PICK IT UP',
        glimmers: [
          { at: 0.30, kind: 'oil', amount: 9, label: 'A cache of lamp oil under a milepost. The Wickwright sticker reads: FEE PAID. It was not.' },
          { at: 0.62, kind: 'fragment', id: 'dimming' },
        ],
        encounters: [
          {
            at: 0.80,
            prompt: {
              kicker: 'ON THE ROAD', title: 'A HAY CART, SIDWAYS',
              body: 'A boy has blocked the mill road with a hay cart, standing on it like a herald. "Nobody passes the Mill," he says, "unless the troupe sings. My mother says you always sing." He looks nine. The hay is going to smell of him.',
              timer: 20,
              choices: [
                { label: '♪ SING THE MILLPOND SONG', note: 'It costs nothing and it is, actually, very good.', set: { morale: 4 }, do: (s, g) => g.toast('The boy sings the second verse better than you. Let it stand.', 'cold'), result: 'pass' },
                { label: 'PAY HIM THE ROAD FEE HE EARNED', cost: '2 ✦', set: { silver: -2 }, do: (s, g) => g.toast('He counts it twice to be rude. Fair.'), result: 'pass' },
                { label: 'SEND BRAM TO MOVE THE CART', note: 'He is gentle. The cart is not guaranteed.', set: { morale: -2, 'bonds.bram': 2 }, do: (s, g) => g.toast('Bram moves the cart, the hay, and the boy\'s whole concept of personal space.'), result: 'pass' },
              ],
            },
          },
        ],
      },
    },
    {
      type: 'vignette', bg: 'village', place: 'HOLLOW MILL · THE SQUARE',
      beats: [
        b(SP.ouda, 'He can\'t just take the *square\'s* lamp. The square is where weddings point.'),
        b(SP.pell, 'The Union can and does. Form 12-C: seizure of illumination pending payment. I measure, you pay, the lamp waits. It is patient. It will learn.'),
        b(SP.vera, 'Auditor. Lantern Troupe. We\'re playing tonight — benefit for the lamp, collection for the fee.'),
        b(SP.pell, 'Players. Wonderful. Be advised that public performance is a taxable amenity, and I do mean *be* advised. I shall be in the front row. With the ledger.'),
        b(SP.odile, 'Everyone\'s favourite thing. A man whose job is saying "that\'ll be a fee."'),
        b(SP.pell, 'I can hear the *entire* troop, madam.'),
        b(SP.vera, 'That\'s the point, Auditor. Play the set, keep the crowd, and when the hat goes round even he has to count with the rest of us.'),
        b(SP.pell, '[ NEGOTIATION ] Read him, answer him, and mind — functionaries only respect two things: pressure, and a better joke than theirs.'),
      ],
    },
    {
      type: 'negotiation',
      npc: {
        id: 'pell', name: 'AUDITOR PELL', role: 'WICKWRIGHT UNION · SEIZURES & SOUVENIRS', tone: 'cold',
        guard: 58, exchanges: 5,
        intro: [
          b(SP.pell, 'The collection is *taxable.* The applause is *ambient.* Guess which one I bill.'),
          b(SP.vera, '//low, to the troupe// He\'s wound up. He enjoys this. Find the loose thread.'),
        ],
        lines: {
          anxious: ['The… well. The procedure does not *require* an audience reaction, merely a quorum—', 'If the lamp is unshipped I need a form. There are no forms. *Why are there no forms?*'],
          proud: ['The Union\'s seal is on this lamp now, captain. The seal does not *haggle.*', 'You are a soldier of the 47th. We billed your regiment for the war, remember? Interest compounding. Lovely thing, compound—'],
          greedy: ['A benefit. How charming. What percentage goes to the *process?*', 'The fee is the fee. Though — an expedited hearing is… discretionary. Discretion is discretionary.'],
          hostile: ['Perform, then leave. The lamp stays with me. I said what I said.', 'You performers. Borrowed light, all of you. Burn other people\'s oil and call it art.'],
        },
        levers: [
          { key: 'juggledCitation', label: 'REMIND HIM: BRAM CAN JUGGLE THE CITATION', note: 'The crowd has seen it. So has he.', req: (s) => !!s.flags.juggledCitation, guard: 14, set: { morale: 3 } },
          { key: 'repVoice', label: 'CITE THE ROADS\' OPINION OF YOU', note: 'REP 12+. He checks whether it is true. It is.', req: (s) => s.rep >= 12, guard: 12 },
          { key: 'dillRead', label: 'LET ODILE FIND THE THREAD', note: 'ODILE\'S BOND 55+. She has read ten thousand men at triage.', req: (s) => s.bonds.dill >= 55, guard: 16, reveal: true },
        ],
        winBeats: [
          b(SP.pell, '…The seal *slides.* I am noting for the record that the seal slides. The lamp is released pending tonight\'s collection meeting the fee. Good evening. I hate the theatre.'),
          b(SP.odile, 'He doesn\'t hate the theatre. He had a seat pass once. Long ago. Nobody asks.'),
        ],
        loseBeats: [
          b(SP.pell, 'The hour is out, captain. The lamp stays. Play to it if you like — applause is ambient, but the *wood* is mine.'),
        ],
        endgame: {
          body: 'Pell is counting the minutes, and they are costing him something. What\'s left?',
          choices: [
            { label: 'PAY THE FEE OUT OF TROUPE OIL', cost: '14 OIL', req: (s) => s.oil >= 14, set: { oil: -14 }, win: true, note: 'Cheaper than a funeral, uglier than a receipt.' },
            { label: 'PLAY ANYWAY. MAKE THE CROWD THE ESCROW.', note: 'Odds on the village being louder than his ledger.', bluff: true, winChance: 0.72 },
            { label: 'LET IT GO. SING TO THE SEALED LAMP.', set: { morale: -6, rep: 1 }, win: false, note: 'It is, genuinely, a beautiful song about defeat.' },
          ],
        },
        stake: { lampName: 'THE SQUARE LAMP' },
        win: { set: { oil: 16, rep: 2, relit: 1 }, toast: 'THE MILL LAMP IS UNSEALED — one lamp relit in the ledger.' },
        lose: { set: { oil: -4, morale: -3 } },
      },
    },
    {
      type: 'performance',
      show: {
        name: 'BENEFIT FOR THE LAMP', place: 'HOLLOW MILL · THE SQUARE',
        tutorial: true, mood0: 46, target: 52,
        acts: [
          { kind: 'tap', bpm: 88, bars: 6, density: 0.5, intro: 'BRAM JUGGLES — catch the beat: one tap per orb as it peaks. D · F · J.' },
          { kind: 'hold', bpm: 66, bars: 5, density: 0.35, intro: 'ODILE\'S ARIA — press and *hold* through the long notes. Let her breathe when she breathes.' },
          { kind: 'pattern', bpm: 80, bars: 5, density: 0.4, intro: 'FENN\'S ILLUCTIONS — watch Cinder flash the pattern, then answer it back.' },
        ],
        events: [
          {
            atAct: 1, atBar: 3,
            title: 'THE AUDITOR WRITES',
            body: 'Mid-aria, Pell stands at the rail, pen moving: writing you up. The crowd notices. The aria notices. Everything you do now is part of the show.',
            timer: 8,
            choices: [
              { label: 'BOW INTO THE BILL — MAKE IT A BIT', set: { mood: 7, flag: 'juggledCitation' }, note: 'Bram plucks the citation from his hand mid-juggle. The square erupts.' },
              { label: 'PLAY STRAIGHT. DIGNITY IS CURRENCY.', set: { mood: 2, rep: 1 }, note: 'The aria finishes like a church. So does his pen.' },
              { label: 'STOP. CONFRONT HIM', set: { mood: -6, flag: 'confrontedPell' }, note: 'You will win the moment and lose the room.' },
            ],
          },
        ],
        outroWin: [
          b(SP.ouda, 'THE LAMP\'S FULL. The square\'s full. Both are full! Take three measures, take the stew — take *anything*, don\'t let me die grateful.'),
          b(SP.fenn, 'Hat\'s counted. Oil: three measures. Applause: taxed at ambient, obviously.'),
          b(SP.odile, 'The miller sings the Millpond Song back at us while we pack — wrong words, right century. Somebody wrote it down. Somebody should.', { fx: { fragment: 'millpond' } }),
        ],
        outroFlop: [
          b(SP.ouda, 'It\'s the *sealed lamp,* people. It curdles a crowd. Between us — you\'re fine. The lamp\'s the problem. Nobody dances under a seized light.'),
        ],
      },
    },
    {
      type: 'vignette', bg: 'square', place: 'THE MILLPOND · NIGHT', night: true,
      beats: [
        b('', 'Later. The millpond holds the only two lights for forty kilometres: the freed lamp, and the sun\'s sixpence. They float next to each other, equal.'),
        b(SP.boy, 'Are you going away tomorrow? My mother says everyone in a troupe is everyone else\'s funeral waiting to happen.'),
        b(SP.bram, 'Your mother\'s a *poet,* Coll. Tell her Bram says so, then tell her what happens if she calls me at dawn.'),
        b(SP.boy, 'She says: then eat our bread while it\'s bread.'),
        b(SP.odile, 'Rider in the square. Off a big horse. Dust like he borrowed it from the road itself and never plans to give it back.'),
        b(SP.vera, 'Ashvale. They\'re hiring — the beacon there is the only light on the whole coast, and it\'s dying by a hand-width a month. Six months, the letter says, and then a dark shore for a hundred kilometres.'),
        b(SP.fenn, 'The beacon\'s keeper\'s name is in the letter. Aldous Reeve. It is, statistically, not possible for names to be smaller than that.'),
        b(SP.odile, '//low// He was at the Cape. With us. With *her.*'),
        {
          tx: 'She could tell the village the whole truth — the beacon is dying, the coast is scared, and a troupe is going because it\'s cheaper than an army and half as honest. Or she could tell it the way the roads like it: heroes, and a lighthouse, and the dark as something that loses.',
          choices: [
            { label: 'TELL THEM THE TRUTH. FLAT.', set: { flag: 'toldTruth', morale: 2, rep: 1 }, do: (s, g) => g.toast('Ouda nods slowly. Truth, in a debt town, is a payment.', 'cold'), note: 'Hollow Mill will talk plainly for years now — including when it hurts.' },
            { label: 'TELL THEM THE LEGEND', set: { flag: 'toldLegend', rep: 2, mood: 4, morale: 3 }, do: (s, g) => g.toast('They cheer a little. Legends travel better than facts.'), note: 'The 47th always got the story wrong and the tip right.' },
          ],
        },
      ],
    },
    {
      type: 'campfire', bg: 'camp', place: 'THE MILLPOND BANK · LAST NIGHT OF THE OLD TOUR',
      beats: [
        b('', 'Fire makes the troupe honest, which is its main use. Three shapes sit around it. Three different kinds of tired.'),
        b(SP.cinder, 'REMINDERS: TOLL ROADS AHEAD. GRIEF, IF REQUIRED, IS SOLD SEPARATELY.'),
        {
          tx: 'The night is short. You get one of them.',
          choices: [
            {
              label: 'SIT WITH ODILE — SHE\'S PATCHING MORE THAN COSTUMES',
              do: (s, g) => g.bonds('dill', 6),
              set: { 'bonds.dill': 6 },
              after: [
                b(SP.odile, 'You\'re brooding beside me. That\'s either a compliment or a triage position.'),
                b(SP.vera, 'The cape. That winter. You kept the tents lit and the lists short and you never once—'),
                b(SP.odile, 'Never what? *Kept count?* Someone had to. — Captain. Whatever Ashvale is, don\'t let anyone hand you a rope and call it a stage light. Promise me the dark doesn\'t get the arithmetic.'),
                b(SP.vera, 'Promise.'),
              ],
            },
            {
              label: 'SIT WITH BRAM — THE FIRE IS HIS, BY RIGHTS',
              do: (s, g) => g.bonds('bram', 6),
              set: { 'bonds.bram': 6 },
              after: [
                b(SP.bram, 'Don\'t sit on my side. I keep the fire. It\'s not a metaphor, I\'m just… particular. Fire\'s fine. *Unlit* isn\'t. We\'re clear? We\'re clear.'),
                b(SP.vera, 'Bram. If the dark gets opinionated on this tour—'),
                b(SP.bram, 'Then we sing at it until it apologises. That\'s the whole doctrine. I invented it, it\'s on the banner, it\'s *good* doctrine.'),
              ],
            },
            {
              label: 'SIT WITH FENN — HE\'S TUNING CINDER, NOT ASKING FOR HELP',
              do: (s, g) => g.bonds('fenn', 6),
              set: { 'bonds.fenn': 6 },
              after: [
                b(SP.fenn, 'I\'m fourteen. I did the cape at nine with a radio on my back like a backpack full of bad news. Don\'t *mother* me, just — if the coast gets bad, I get to talk to it. Signals are a performance too.'),
                b(SP.vera, 'Denied.'),
                b(SP.fenn, 'You said it with your whole chest. That means maybe. I\'ll take maybe.'),
                b(SP.cinder, 'BAD NEWS CONSUMED: FEAR, HOPE, AND A RECEIPT FOR AMBIENT APPLAUSE. ALL DELICIOUS. ALL NOTED.'),
              ],
            },
          ],
        },
        b(SP.vera, 'To Ashvale, then. Play the coast, keep the lamps, and if the dark wants a word — it can queue behind the bill.'),
      ],
    },
    { type: 'transition', title: 'CHAPTER ONE', place: 'THE GREYWATER TOLL', sub: 'where rival troupes and a bridge learn our names' },
  ],
};

// ------------------------------------------------------------------ CHAPTER 1

const chapter1 = {
  id: 'ch1',
  name: 'CHAPTER ONE — THE GREYWATER TOLL',
  steps: [
    {
      type: 'vignette', bg: 'road', place: 'THE NORTH ROAD · DUSK, OF COURSE', seed: 17,
      cast: { vera: { x: 0.4 }, cart: { x: 0.66 } },
      beats: [
        b(SP.fenn, 'Wire traffic ahead: the Greywater bridge is *toll-gated.* By the Gilded Moths.'),
        b(SP.odile, 'The Gilded Moths. I thought they were a joke people told about other troupes.'),
        b(SP.fenn, 'They tour the coast for the Quiet Choir now. Sponsored mourning. Their encore is an oil advertisement read by a boy.'),
        b(SP.bram, 'We had one member join the Choir once, didn\'t we? Before us. Before everyone.'),
        b(SP.vera, 'Before. Then. Pass it round.'),
        b(SP.cinder, 'CHOIR POLICY, POSTED AT TOLL: "LIGHT, EXCEPT AS REQUIRED, IS A WOUND." — THE BOY READING THE ADVERTISEMENT LOOKS ALSO, BUT SMALLER.'),
        b(SP.vera, 'The Choir doesn\'t burn lamps, that\'s the trick of them. They *instantiate* them. Paper, patience, and a murmur of "mercy." We are going to need to out-speak a eulogy.'),
        b(SP.odile, 'We out-spoke a *functionary* last night. With an aria.'),
        b(SP.vera, 'Which is precisely the kind of story I want Ashvale to believe about us. Tighten the mantles. Bridge in front.'),
      ],
    },
    {
      type: 'road',
      route: {
        name: 'GREYWATER APPROACH', place: 'THE BRIDGE ROAD', seed: 17, len: 58, burn: 0.13, gloom: 0.15,
        glimmers: [
          { at: 0.25, kind: 'fragment', id: 'citation' },
          { at: 0.55, kind: 'silver', amount: 6, label: 'A toll-box someone already robbed. It was so poor, the thief left a candle.' },
        ],
        encounters: [
          {
            at: 0.55,
            prompt: {
              kicker: 'THE BRIDGE ROAD', title: 'TOLL: SORROW, CURATED',
              body: 'A rope-and-plank toll gate, all painted black and silver. Two Moths in mourning greasepaint sweep a stage nobody\'s watching. Their poster: "THE GILDED MOTHS — Sorrow, Curated. Presented by the Quiet Choir. *First weep free.*"',
              timer: 16,
              choices: [
                { label: 'APPROACH THE GATE FORMAL', note: 'Negotiate with Prim, whoever Prim is.', go: 'next' },
                { label: 'PAY THE TOLL IN SILENCE', cost: '8 OIL', req: (s) => s.oil >= 8, set: { oil: -8, morale: -3, flag: 'paidToll' }, do: (s, g) => g.toast('The Moths stamp your papers with a tiny crying moon. Cross with dignity.'), result: 'pass' },
                { label: 'HAVE BRAM "STRETCH" NEAR THE GATE', note: 'No words. Just geometry.', set: { rep: -1 }, risk: true, go: 'next' },
              ],
            },
          },
        ],
      },
    },
    {
      type: 'vignette', bg: 'bridge', place: 'GREYWATER BRIDGE · THE TOLL HOUSE',
      condition: (s) => !s.flags.paidToll,
      beats: [
        b(SP.prim, 'The 47th. *The* 47th. We grew up on your banner song, we did — before we professionalised. Prim. Compère of the Gilded Moths, agent of the Choir, excellent rates.'),
        b(SP.odile, 'You sweep a stage for a cult that bills grief by the hour.'),
        b(SP.prim, 'We sweep a stage for the only sponsor that *pays.* The Choir owns three bridges and a philosophy, darling. Pick which one you want to talk to me about.'),
        b(SP.vera, 'The crossing. We\'re engaged to Ashvale; the beacon won\'t read your terms to itself.'),
        b(SP.prim, 'And the Choir has pre-purchased silence at this crossing — that\'s the clause. So. Am I to bill you for it? Shall we make a night of it? I can do *anything* you can do, only sadder and with better lighting.'),
        b(SP.vera, '//to the troupe// Read him. Moths don\'t want our bridge. They want to be reminded they could still be a *troupe.*'),
      ],
    },
    {
      type: 'negotiation',
      condition: (s) => !s.flags.paidToll,
      npc: {
        id: 'prim', name: 'PRIM', role: 'COMPÈRE OF THE GILDED MOTHS', tone: 'villain',
        guard: 66, exchanges: 6,
        intro: [
          b(SP.prim, 'Terms, players. The bridge is a *mood.* Moods cost.'),
        ],
        lines: {
          smug: ['Yes, yes — the benefit, the aria, the little auditor cried. We have *tours* now. The Choir schedules tears on Tuesdays.'],
          envious: ['Ashvale. *Ashvale.* We applied for that. They wrote to you. Do you know what that feels like, being written to?'],
          pious: ['The crossing is closed in the interest of quiet. The Choir says light attracts what\'s coming. I say: it\'s in my contract. Same sentence, different—same—'],
          scared: ['Look. If you force this, I have to *bill* it, and billing goes up the chain, and the chain has us doing a wake in the Gloom next week. You don\'t want the Gloom. Nobody books the Gloom twice.'],
        },
        levers: [
          { key: 'ashvaleWrit', label: 'PRODUCE THE ASHVALE WRIT', note: 'The town\'s own seal. It makes him feel like the road.', req: (s) => s.flags.toldLegend || s.flags.toldTruth, guard: 14 },
          { key: 'fiveFaces', label: 'ASK ABOUT THE FIFTH MOTH', note: 'The scratched-out name. He never expects it.', guard: 16, set: { morale: -2, flag: 'askedFifth' }, do: (s, g) => g.toast('Prim goes very still. "He took the quiet money. He also took our second act."', 'cold') },
          { key: 'mothsong', label: 'HUM THE OLD BANNER SONG', note: 'Their old song. Yours too, once, in the 47th.', req: (s) => s.bonds.dill >= 50, guard: 15, set: { 'bonds.dill': 3 } },
        ],
        winBeats: [
          b(SP.prim, '…Fine. Cross. — And when you\'re on that coast, *remember* the Moths play a mean wake. The Choir needs it. The Choir needs us. — Get out of my lighting.'),
        ],
        loseBeats: [
          b(SP.prim, 'The bridge stays *mood-locked,* captain. Take the long way through the Gloom — or don\'t take it at all. Either way I\'m billing the fence.'),
        ],
        endgame: {
          body: 'Prim\'s hand is on the chain that raises the gate. He\'s enjoying this, which is the only sad thing about him.',
          choices: [
            { label: 'PROPOSE A JOINT BILL', note: 'Their sorrow, our fire, one stage, split the hat — and the bridge as the encore.', joint: true, win: true, set: { rep: 2, flag: 'jointBill' } },
            { label: 'PAY FOR THE CROSSING', cost: '12 OIL', req: (s) => s.oil >= 12, set: { oil: -12, 'bonds.bram': -1 }, win: true, note: 'Bram carries the last crate himself, saying nothing. That\'s the tax.' },
            { label: 'FORCE THE GATE', note: 'No. Actually — yes, if you must. It will cost more than oil.', force: true, win: true, set: { morale: -6, 'bonds.fenn': -3, flag: 'pushedGate' }, beats: [
              b(SP.bram, 'Bram takes the chain in both hands, and becomes, for four seconds, the load-bearing wall the 47th always needed him to be. The gate lifts. Nobody bills what is already moved.'),
              b(SP.prim, '…Enjoy the *acoustics,* captain. The Choir hears everything, and I hear *you.*'),
            ] },
          ],
        },
        stake: { lampName: 'THE BRIDGE GATE' },
        win: { set: { rep: 2, silver: 5 }, toast: 'THE BRIDGE OPENS. Prim takes a playbill "for the archives."' },
        lose: { set: { oil: -6, morale: -2 } },
      },
    },
    {
      type: 'performance', condition: (s) => !!s.flags.jointBill,
      show: {
        name: 'JOINT BILL: FIRE & MOURNING', place: 'THE BRIDGE STAGE', mood0: 40, target: 58,
        acts: [
          { kind: 'tap', bpm: 100, bars: 7, density: 0.62, intro: 'THE MOTHS OPEN — a dirge. You come in on the off-beat and turn it up. D · F · J.' },
          { kind: 'pattern', bpm: 92, bars: 6, density: 0.55, intro: 'ANSWER THEIR PATTERN, BEAT FOR BEAT. A moth duels a Lantern.' },
          { kind: 'hold', bpm: 72, bars: 6, density: 0.45, intro: 'THE FINALE DUET — Odile up top, Prim below, hold the note until the bridge hums.' },
        ],
        events: [
          {
            atAct: 2, atBar: 2,
            title: 'A ROPE SNAPS',
            body: 'One of the Moths\' mourning banners comes down — *right* onto the lantern line. Their sabotage to make your act look cursed, or their stagehand being one of them. Either way: it\'s an audience moment now.',
            timer: 7,
            choices: [
              { label: 'MAKE IT THE BIT — "EVEN THE DARK TRIES TO JOIN"', set: { mood: 10, rep: 2 }, note: 'You dance with the fallen banner. Prim, caught live, has to laugh.' },
              { label: 'CALL IT OUT LOUD, MID-SONG', set: { mood: -5, rep: 1, flag: 'calledOut' }, note: 'The truth lands, the room chills, the Choir gets a headline.' },
              { label: 'FIX IT WHILE PLAYING — BRAM, HAND ME THE—', set: { mood: 3, 'bonds.bram': 4 }, note: 'One-handed, on tempo. It becomes the thing they tell.' },
            ],
          },
        ],
        outroWin: [
          b(SP.prim, '…We used to get an encore. Before the sponsorship. — The bridge is yours, players. Keep your *fire.* We\'ll keep our *terms.*'),
          b(SP.fenn, 'Hat split 60/40. They tried to argue. Then they saw what 60 buys: *our* exit music.'),
        ],
        outroFlop: [
          b(SP.prim, 'Oh, *darling.* You can retune a lute, you cannot retune a funeral. Off with you — the bridge stays ours and so does the mood.'),
        ],
      },
    },
    {
      type: 'vignette', bg: 'bridge', place: 'THE FAR TOLL HOUSE · AFTER',
      beats: [
        b('', 'The bridge gate lifts. The boy with the advertisement reads it at you, apologetically, as if for practice, then puts the paper away and looks at the dark water a long time.'),
        b(SP.odile, 'I read his ledger while he bowed. Six members listed. Five faces drawn.'),
        b(SP.vera, 'The Choir doesn\'t just buy stages. They buy the *space between* the players.'),
        b(SP.bram, 'There\'s a lantern burning on the toll roof. Whoever lives in this little box keeps their own light, unpaid, unbilled, uncalled-for. I hope they\'re happy.'),
        b(SP.cinder, 'FRAGMENT SCAVENGED FROM THE FENCE: A PLAYBILL CARD, "GUILD OF FIVE." ONE NAME SCRATCHED OUT.', { fx: { fragment: 'mothsguild' } }),
      ],
    },
    {
      type: 'campfire', bg: 'camp', place: 'PAST THE BRIDGE · THE LAST FRIENDLY FIELD',
      beats: [
        b('', 'The fire\'s built wrong on purpose, tonight — wind off the coast finds the gap and makes it dance. Bram likes that. Nobody asks why.'),
        b(SP.fenn, 'Ashvale\'s beacon log is on the open guild-wire. Out of oil since March, out of *hope* since the relay lamp at the Gloom milestone went dark.'),
        b(SP.odile, 'A lamp going dark twenty kilometres inland and the coast hears it. Lamps are a chorus, that\'s what they are. You lose voices, the song goes thin.'),
        {
          tx: 'Odile has the triage kit out. She\'s mending the strap of it so it hangs on the correct shoulder — the one she can reach after the Cape. She won\'t say that. You can say the next thing.',
          choices: [
            {
              label: 'ASK HER ABOUT THE CAPE',
              set: { 'bonds.dill': 5, flag: 'askedCape', trust: -1 },
              do: (s, g) => g.bonds('dill', 5),
              after: [
                b(SP.odile, 'Six weeks. I kept two lists: living, and *not yet.* The pen ran out first and we used the same column. Ask me the *kind* question instead, captain, I prefer it.'),
                b(SP.vera, 'Then: are you ready to play that coast? Under a dying lamp?'),
                b(SP.odile, 'No. Next.'),
              ],
            },
            {
              label: 'SAY NOTHING. HAND HER THE GOOD STRAP.',
              set: { 'bonds.dill': 3, trust: 2 },
              do: (s, g) => g.bonds('dill', 3),
              after: [
                b(SP.odile, '…The good strap. You keep a spare, for *me.* Fine. Forget I have feelings; they\'re on my tab. — Thank you, Vera.'),
              ],
            },
          ],
        },
        b(SP.vera, 'To Ashvale, then — tomorrow, past the last lit field. Keep the Sunkey low and your voices up. That\'s the formation. That\'s always been the formation.'),
      ],
    },
    { type: 'transition', title: 'CHAPTER TWO', place: 'ASHVALE', sub: 'a wake, a warning, and a collection at midnight' },
  ],
};

export { prologue as PROLOGUE, chapter1 as CHAPTER1, SP, b };
