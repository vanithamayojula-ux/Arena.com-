// EMBERFALL story, part B — Ashvale, Cape Ashen, the Long Watch, and whatever the
// morning decides to be.

import { b, SP } from './storyA.js';

// ------------------------------------------------------------------ CHAPTER 2

const chapter2 = {
  id: 'ch2',
  name: 'CHAPTER TWO — ASHVALE',
  steps: [
    {
      type: 'vignette', bg: 'village', place: 'ASHVALE · THE SLOW LAMP', seed: 23, dark: true,
      cast: { vera: { x: 0.44 }, cart: { x: 0.7 } },
      beats: [
        b('', 'Ashvale squats under its beacon like a moth under a bedside lamp: closer than is wise, warmer than is safe. The great light above the mine stacks turns the colour of a healing bruise, bright, dim, bright. A lamp with a pulse. They should call a physician.'),
        b(SP.hessa, 'You\'re the performers. Good. Play the wake.'),
        b(SP.odile, 'The *wake.* The beacon has, by my watch, an entire decade of pallor left in it.'),
        b(SP.hessa, 'Then we\'ll have a long wake and a short funeral. I\'m foreman here. I also ring the lamp bell, I also bury people, I also sign for the oil that doesn\'t come. We\'ve been *quarter-rationed* since March. The Union says "supply chain." I say "supply."'),
        b(SP.vera, 'You wrote to the guild wires: "troupe, any troupe, come sing to the beacon." Ashvale doesn\'t hire acts. It hires *witnesses.*'),
        b(SP.hessa, 'A dying light wants an audience the way a dying man does. Play true, and I\'ll pay in the only coin that spends here: oil, stew, and generous lies about the lamp\'s health.'),
        b(SP.bram, '//low// There are Choir candles at the back of the square. Twelve. They count as seating.'),
        b(SP.vera, 'Then we play full. The way the 47th used to stand to — *heavier than the room.* If Brother Nune wants a word, he can queue.'),
      ],
    },
    {
      type: 'performance',
      show: {
        name: 'A WAKE AND A WARNING', place: 'THE MINESHAFT PLAYHOUSE', mood0: 42, target: 60,
        acts: [
          { kind: 'tap', bpm: 96, bars: 7, density: 0.6, intro: 'THE STRIKING ACT — the whole cast taps the old shift-bell rhythm. It is Ashvale\'s heartbeat; don\'t miss it. D · F · J.' },
          { kind: 'hold', bpm: 60, bars: 6, density: 0.45, intro: 'ODILE\'S WAKE HYMN — long, low, patient. Hold each flame-note; the miners will hum the rests.' },
          { kind: 'pattern', bpm: 88, bars: 6, density: 0.55, intro: 'FENN\'S SHADOW-PLAY — the relay of the lamps, told in moths. Answer his pattern exactly.' },
        ],
        events: [
          {
            atAct: 1, atBar: 2,
            title: 'BROTHER NUNE ENTERS',
            body: 'The doors open on the hymn\'s first line, like it was timed. Brother Nune, Choir of the Sixth Silence, walks the aisle with one candle — unlit, which is the whole sermon. The pit goes quiet in a way a pit shouldn\'t.',
            timer: 9,
            choices: [
              { label: 'SOFTEN THE LYRICS — A HYMN ANYONE CAN SING', set: { mood: 5, flag: 'softVerse' }, note: 'You keep the room. The beacon gets a lullaby instead of a sermon of its own.' },
              { label: 'DEDICATE IT, OUT LOUD, TO THE BEACON', set: { mood: 7, rep: 2, flag: 'dedicated' }, note: 'Dangerous, honest, exactly what a witness is for.' },
              { label: 'CUE FENN — THE SUNRISE ILLUSION', note: 'FENN\'S BOND 55+. A painted sunrise over the pit. On purpose. At a wake.', req: (s) => s.bonds.fenn >= 55, set: { mood: 12, rep: 3, 'bonds.fenn': 4, flag: 'sunriseShown' }, note: 'The room gasps like a man seeing colour. The Choir will remember every face that cheered.' },
            ],
          },
        ],
        outroWin: [
          b(SP.hessa, 'My miners *stomped.* My miners! They\'ve been quiet since March, the ones the road let keep. Whatever you\'re selling, the mine is buying — and the lamp\'s oil is coming from *somewhere* now. Mostly.'),
          b(SP.odile, 'We are a troupe, not a refinery.'),
          b(SP.hessa, 'Then be a very loud refinery.'),
        ],
        outroFlop: [
          b(SP.hessa, 'Quiet crowd. I\'ll not call it your fault — the lamp\'s grey is in every throat — but I\'ll call it *my* bad luck. Stew\'s still stew.'),
        ],
      },
    },
    {
      type: 'vignette', bg: 'hall', place: 'THE PLAYHOUSE, EMPTYING · NIGHT', lamps: [{ x: 0.9, y: 0.42 }],
      beats: [
        b('', 'He waits in the empty hall, standing at a footlight as if it were a pulpit. Up close, Brother Nune is less menace and more weather: long-rained-on.'),
        b(SP.nune, 'You painted a sunrise in a mine town. I felt the *draft* of it. Kind. Unwise. Both at once, which is how kindness usually arrives.'),
        b(SP.vera, 'Brother. We read your posting — "light, except as required, is a wound." Who is doing the requiring?'),
        b(SP.nune, 'We are. We ask each settlement to sign a cessation of *unnecessary* light. The Gloom tracks lamplight the way your forefathers tracked game. Every lamp is a lure dressed as a comfort. We are not abolishing your fire, captain. We are *triaging* it.'),
        b(SP.odile, 'With paperwork. At midnight. From a man holding his own candle unlit. He hasn\'t struck it — I\'ve been watching for an hour — he\'s *mourning* it.'),
        b(SP.nune, 'Singer Nune. Cape Ashen Cathedral Choir, before. Voice loss, grief, and the fact of the sky. — I will take your answer now, Lanterns. Sign the cessation for Ashvale, and the Choir will shield its *last* lamp from the Union\'s bills. Refuse, and I must pursue it by gentler means, which are slower than you will like.', { fx: { fragment: 'nunepre' } }),
        b(SP.vera, '//to the troupe, arranging sleeves// Nobody signs anything. Nobody swings anything. We talk to him the way he actually wants to be talked to. Which he won\'t say. Odile — read the crack in the plaster.'),
      ],
    },
    {
      type: 'negotiation',
      npc: {
        id: 'nune', name: 'BROTHER NUNE', role: 'QUIET CHOIR · SIXTH SILENCE', tone: 'villain',
        guard: 82, exchanges: 6,
        intro: [
          b(SP.nune, 'The pen is not sharp. It is only *patient.* Your choice, Lanterns.'),
        ],
        lines: {
          pious: ['Consider the lighthouse and how it dies: seen, admired, *snuffed* — the snuffer\'s grief is also grief. Sign, and that grief becomes a smaller one, mine.', 'The Dimming was not a punishment. Punishment implies a principal. It was the world learning to whisper. We are merely... fluent.'],
          mournful: ['I have extinguished forty lamps with my own hands. I kept a tally and then I kept a drink and then I kept only the tally.', 'You should know — the last one was a chapel. Children had drawn the wick-guard. I filed it under "required."'],
          tired: ['You want me to *say* it. That I haven\'t slept properly in nineteen years. That the dark is quieter for me than my own voice. Fine. I am tired, captain. Sign, and I rest somewhere, and you all rest eventually. Together. Non-coercively.'],
          guarded: ['We are not your enemy. That is the tragedy and I am asked to lead it. — The cessation, Lanterns, or the gentler means.', 'I will ask you one time not to make me brief the arbitration. Brief arbitrations are for people who still believe in rooms.'],
        },
        levers: [
          { key: 'letterBefore', label: 'READ HIS OLD CHOIR LETTER, ALOUD', note: 'FRRAGMENT: "BROTHER NUNE, BEFORE." He does not know anyone kept it.', req: (s) => !!s.fragments.nunepre, guard: 20, set: { flag: 'nuneRead' }, do: (s, g) => g.toast('"The voice came back. I did not." — He mouths the line along with you.', 'cold') },
          { key: 'sunrise', label: 'HOLD UP THE SUNRISE — "THE ROOM, LAST NIGHT"', note: 'Only if you actually painted it.', req: (s) => !!s.flags.sunriseShown, guard: 14 },
          { key: 'lampLedger', label: 'SHOW THE LEDGER OF LAMPS YOU\'VE KEPT', note: 'REP 16+. Relit, not captured. Every one still lit.', req: (s) => s.rep >= 16, guard: 14, set: { rep: 1 } },
          { key: 'millpond', label: 'SING THE MILLPOND SONG. NO OFFER, NO ARGUMENT.', note: 'A verse for someone who lost a voice.', req: (s) => s.bonds.dill >= 55 || !!s.flags.softVerse, guard: 18, set: { flag: 'sangToNune', 'bonds.dill': 3 } },
        ],
        winBeats: [
          b(SP.nune, '…You have given me a file full of *counterevidence* and I have nothing but a policy and a sore throat. The Choir may still take Ashvale\'s oil. I will not be the hand. I will be — the *delay.* Enjoy the winter.'),
          b(SP.odile, '//exhale// That\'s not a loss for him, is it. That\'s the first breath he\'s taken in nineteen years.'),
        ],
        loseBeats: [
          b(SP.nune, 'Then it is arbitration, and arbitration is midnight, and midnight is *short.* — I am sorry in the professional sense. It is the larger one.'),
        ],
        endgame: {
          body: 'The pen lies between you like a moat. Somewhere outside, a bell rings the lamp\'s hour: bright, dim, bright.',
          choices: [
            { label: '"OUR CONTRACT IS WITH THE TOWN." STALL HIM.', note: 'Paperwork against prophecy. It is his weakness and our trade.', stall: true, winChance: 0.7 },
            { label: 'SIGN. TRADE ASHVALE\'S OIL FOR A SHIELD.', note: 'The lamp lives. The town learns to flinch.', sign: true, set: { oil: -12, morale: -5, flag: 'signedCessation' }, win: false },
            { label: 'REFUSE OUTRIGHT AND SHOW HIM THE DOOR.', refuse: true, set: { morale: 2, flag: 'nuneHostile' }, win: false, note: 'It feels enormous. It buys two days. He will be back with midnight.' },
          ],
        },
        stake: { lampName: 'ASHVALE\'S CESSION' },
        win: { set: { rep: 3, morale: 4, flag: 'nuneWavered' }, toast: 'NUNE withdraws to "consult the silence." The night is not yours — merely rented.' },
        lose: { set: { morale: -3 } },
      },
    },
    {
      type: 'watch',
      arena: {
        name: 'THE COLLECTION', place: 'THE LAMPHALL · MIDNIGHT',
        duration: 80, lamps: 5, gloom: 0.9, relightOil: 3, spawn: 1.15,
        intro: [
          b('', 'Midnight comes wearing ledgers. Six Choir brothers and two men of the Union — a *collection* is legal, and legality has hammers — file into the lamphall where Ashvale keeps its reserve lamps. They are not killing anyone. That is somehow so much worse: they are *processing* light. Unlit candles are just furniture.'),
          b(SP.hessa, 'Five reserves on the rail. If the hall goes dark, the beacon goes to quarter-ration quarter, and quarter to the coast. Sing if you must. *Hold the rail.*'),
          b(SP.vera, 'Rings up, flames long. Whatever grabs you — shove, don\'t swing. They have families in the pews; that\'s not a joke, it\'s the *tactic.*'),
        ],
        winBeats: [
          b(SP.hessa, 'Not one. Not one went dark. — Take the wick, captain. It\'s the beacon\'s spare, brass-mounted, my grandfather\'s. If the Cape ever needs a new heart, it\'s yours. Don\'t make me file a form for sentiment.'),
        ],
        loseBeats: [
          b(SP.hessa, 'They\'ve *stamped* it. Two reserves, seized for the greater quiet. My ledger says law. My hands say we were closer to the dark than I\'ll ever write down.'),
          b(SP.odile, 'Nobody died, which is the troupe\'s new favourite statistic.'),
        ],
      },
    },
    {
      type: 'vignette', bg: 'village', place: 'ASHVALE · DAWN THAT ISN\'T', seed: 23, dark: true,
      beats: [
        b('', 'Dawn, which is to say: the lamp of the sky turns up by a *waxing of the grey.* The square smells of stew, brass polish, and the particular relief of a town that got to keep its night-lights.'),
        b(SP.fenn, 'Wire from the Cape. One line. He\'s reading it to me and going pale, so I\'ll read it to all of us: "Lamp full. Ate the last of the onion. Heard music up the cliff road tonight. Kettle on regardless. They\'ll come."'),
        b(SP.odile, 'That was *two nights* ago. He heard the bridge show.'),
        b(SP.vera, 'Aldous Reeve kept the Cape light by disobeying a burn order, and hid in the wrong end of his own tower for nineteen years, because the *right* answer had a court-martial shape to it. That\'s the ledger entry nobody filed. Until tonight.'),
        b(SP.fenn, 'The Cape file came up on the wire with the letter. Signed 6 weeks before the Armistice. FRAGMENT: "THE ASHEN ORDER."', { fx: { fragment: 'ashenorder' } }),
      ],
    },
    {
      type: 'campfire', bg: 'camp', place: 'ASHVALE\'S EDGE · THE NIGHT BEFORE THE GLOOM',
      beats: [
        b('', 'Tomorrow: the Gloom, twenty kilometres of dead lamp-country between here and the Cape. Tonight, the fire, because the fire is the only hospital that works on all of you.'),
        {
          when: (s) => !!s.injury,
          tx: () => 'The injured one sits where the light finds them. You have a choice of medicine.',
          choices: [
            {
              label: 'TELL THEM WHAT THE CAPE REALLY WAS',
              set: { trust: 4, flag: 'confided', morale: -2 },
              do: (s, g) => { g.bonds('bram', 6); g.bonds('dill', 2); },
              after: [
                b(SP.vera, 'We were told to burn the tower so the enemy couldn\'t have it. Reeve said no with his whole body, and I — filed it as "unburnable weather." Nineteen years. He\'s been keeping our secret and his own lamp, and I have been *touring.*'),
                b(SP.bram, 'Vera. That\'s not a confession. That\'s a *lyric.* You\'re allowed to sing it somewhere now. That\'s what we became.'),
              ],
            },
            {
              label: 'LIE GENTLY. IT\'S A KINDNESS AND A DEBT.',
              set: { 'bonds.dill': -2, trust: -2, flag: 'kindLie', morale: 2 },
              do: (s, g) => g.bonds('dill', -2),
              after: [
                b(SP.odile, '//low// You told it smoother than truth sits. I heard the seam. — We all need the lie sometimes, captain. Just remember which of us paid for it.'),
              ],
            },
          ],
        },
        {
          when: (s) => !s.injury,
          tx: 'Nobody is hurt. It\'s suspicious, and you all raise to it, in tin mugs, with the last of the good stew.',
          choices: [
            { label: 'TO QUIET BLESSINGS AND LOUD LEDGERS.', set: { trust: 2, morale: 2 }, do: (s, g) => { g.bonds('bram', 2); g.bonds('fenn', 2); } },
            { label: 'PRACTICE THE FINALE. IN THE DARK. BY SOUND ONLY.', note: 'If the Gloom takes the lamps, the act must outlast them.', set: { trust: 3, morale: -1 }, do: (s, g) => g.toast('You play the whole finale blind. Nobody flinches. It is somehow a victory and a funeral.', 'cold') },
          ],
        },
        b(SP.cinder, 'ROUTE FORECAST: 20KM GLOOM, 0 LAMPS, SOMEONE\'S COW MOVED ACROSS THE MILESTONE ROAD RECENTLY. PACK SONGS.'),
        b(SP.vera, 'To the Cape, at first grey. And when the sun comes up — if it comes up — there\'s a kettle on for us at the top of the world.'),
      ],
    },
    { type: 'transition', title: 'CHAPTER THREE', place: 'THE GLOOM & CAPE ASHEN', sub: 'twenty kilometres of dark, one kettle, and the Long Watch' },
  ],
};

// ------------------------------------------------------------------ CHAPTER 3

const chapter3 = {
  id: 'ch3',
  name: 'CHAPTER THREE — THE LONG WATCH',
  steps: [
    {
      type: 'vignette', bg: 'gloom', place: 'THE EDGE OF THE GLOOM', seed: 5,
      cast: { vera: { x: 0.4 }, cart: { x: 0.64 } },
      beats: [
        b('', 'The Gloom begins where the lamp-posts end, which is to say it begins where the *map* loses interest.'),
        b(SP.bram, 'I\'m not afraid of it. I want that in the record. I\'m afraid of what it *does* to other people. There\'s a difference. Mainly volume.'),
        b(SP.vera, 'The difference is noted, Sergeant. Twenty kilometres, three way-lamps between here and the Cape, all of them dark and relightable if we have the oil and the nerve. We burn what we carry and we feed the Sunkey first. Song second, song always.'),
        b(SP.fenn, 'Mothings will tail us. Not hunting — *attending.* They keep a respectful swarm-distance. That\'s new. Swarms don\'t do etiquette. They\'ve learned it from something.'),
        b(SP.odile, 'The Choir. They walk the Gloom with unlit candles. Mothings follow like a congregation. If the dark is developing opinions, someone is *editorialising.*'),
        b(SP.cinder, 'SUNKEY: FULL. VOICES: ADEQUATE. COURAGE: TACTICAL. LET US BE UNROMANTIC AND ARRIVE.'),
      ],
    },
    {
      type: 'road',
      route: {
        name: 'THE GLOOM', place: 'MILESTONE ROAD · NO LAMPS', seed: 5, len: 74, burn: 0.2, gloom: 0.8, moths: 3,
        glimmers: [
          { at: 0.22, kind: 'oil', amount: 7, label: 'A dead courier\'s satchel, professionally looted — but nobody steals lamp oil in the Gloom. Except you, and it\'s for the light.' },
          { at: 0.48, kind: 'fragment', id: 'keeperlog' },
          { at: 0.7, kind: 'silver', amount: 5, label: 'The first way-lamp. Cold, empty, honest: someone left a candle in it anyway. The candle is worth a coin. The gesture is not sellable.' },
        ],
        encounters: [
          {
            at: 0.40,
            prompt: {
              kicker: 'THE MILESTONE', title: 'A FAMILY AND A DYING LAMP',
              body: 'Under the milestone: a family of four around a lamp the size of a fist, burning so low it\'s practically a rumour. The mother is singing to keep the children\'s tempo steady — a slow-burn trick, half-learned. They are not begging. That is the worst of it.',
              timer: 26,
              choices: [
                { label: 'GIVE THEM OIL — A FULL MEASURE', cost: '10 OIL', req: (s) => s.oil >= 10, set: { oil: -10, morale: 6, flag: 'gaveOil' }, do: (s, g) => g.toast('The children\'s faces in true light. You will see it at the worst possible moments for years.', 'cold'), note: 'They try to pay in a button. You take the button.' },
                { label: 'TEACH THEM THE SLOW-BURN, PROPERLY', note: 'FENN\'S BOND 55+. Half the cost, twice the sad — and sad burns long.', req: (s) => s.bonds.fenn >= 55, set: { oil: -4, morale: 3, flag: 'taughtTrick', fragment: 'slowburn' }, do: (s, g) => g.toast('Fenn teaches the kids the trick and the verse together. It will outlive the lamp. That\'s the point.', 'cold'), note: 'You cannot relight a village that never learned to burn slow.' },
                { label: 'THE HARD TRUTH: "WE CAN\'T STAY. SING ANYWAY."', set: { morale: -2, rep: 1, flag: 'hardTruth' }, do: (s, g) => g.toast('The mother nods like a sergeant. "Aye. We were singing before you. Singing\'s just *cheaper* with an audience."', 'cold'), note: 'Cruel, honest, and somehow the most respectful thing on offer.' },
                { label: 'WALK ON. THE SUNKEY COMES FIRST.', set: { morale: -6, trust: -4, flag: 'walkedOn' }, do: (s, g) => g.toast('Nobody says it. Bram says it, by not saying it.', 'bad') },
              ],
            },
          },
          {
            at: 0.82,
            prompt: {
              kicker: 'THE SWARM CLOSES', title: 'ATTENDANCE BECOMES A CIRCLE',
              body: 'The respectful distance stops being respectful. A hundred soft collisions in the dark — Mothings, folding the road into a corridor, faces like half-remembered faces. They want the Sunkey. They want the *song.* They do not, quite, know the difference.',
              timer: 18,
              choices: [
                { label: 'SING THEM OFF THE ROAD', note: 'A verse with your whole chest. FENN\'S TINGE on the wires as it goes.', go: 'sing', },
                { label: 'LEAVE THE TITHE AT THE CROSSROADS', cost: '12 OIL', req: (s) => s.oil >= 12, set: { oil: -12, morale: -4, flag: 'paidDark' }, do: (s, g) => g.toast('You pour a cross of oil and the dark eats it politely. This is a *relationship* now.', 'bad') },
                { label: 'FIRE. IT\'S WHAT WE WERE FOR.', note: 'Four soldiers, one corridor, no song. The brutal way ends the *argument.*', go: 'fight', risk: true },
                { label: 'WALK THROUGH UNLIT. OFFER THE SUNKEY.', req: (s) => s.trust >= 55, note: 'TROUPE TRUST 55+. Walk dark, together, singing without light. The oldest encore.', set: { morale: -3, flag: 'walkedDark', 'bonds.bram': 6 }, do: (s, g) => g.toast('The swarm parts at the dark, not the flame. Bram laughs once, wet, at the sky.', 'cold') },
              ],
            },
          },
        ],
      },
    },
    {
      type: 'performance', condition: (s) => !!s.flags.sangAway,
      show: {
        name: 'THE SONG FOR THE SWARM', place: 'THE MILESTONE ROAD · UNDER ATTACK OF WINGS', mood0: 55, target: 58, oneAct: true, onRoad: true,
        acts: [
          { kind: 'tap', bpm: 92, bars: 4, density: 0.5, intro: 'ONE VERSE, THREE VOICES, NO STAGE. D · F · J — the swarm keeps time whether you do or not.' },
        ],
        outroWin: [
          b('', 'The corridor opens like a held breath set down. The Mothings fold back to their respectful distance — and you will swear, in the Sunkey\'s light, that one of them *bows.*'),
          b(SP.fenn, 'Wire\'s alive. Three villages heard it. Two lit lamps they said they wouldn\'t. The dark has been *out-performed* and it noticed.'),
        ],
        outroFlop: [
          b('', 'They don\'t attack — they *attend* closer now, a congregation of one bad review. You walk the rest of the Gloom inside the circle of what you failed to move.'),
        ],
      },
    },
    {
      type: 'fight', condition: (s) => !!s.flags.foughtMoths,
      fight: {
        name: 'THE BRUTAL WAY', place: 'THE MILESTONE CORRIDOR',
        intro: [
          b('', 'No fanfare. Bram says "sorry" to the dark, because he was raised to apologise, and then the corridor stops being a road.'),
        ],
        exchanges: 4,
        winBeats: [
          b('', 'Ninety seconds. That\'s the whole combat. The corridor breaks apart in every direction, soft bodies, harder silence — and you stand in the middle of it, four of four, unhurt, *outraged,* which is the correct response.'),
          b(SP.vera, 'There were families in the pews. I keep saying it out loud so it keeps being true.'),
        ],
        loseBeats: [
          b('', 'You clear the road. Someone carried the cost so someone else could. It is always the arithmetic. It is *only ever* the arithmetic.'),
        ],
        after: [
          b(SP.odile, 'Triage done. Living and not-yet, same column, old habit. — Nobody says a word the whole next kilometre. It\'s the most respectful audience you\'ve ever played.'),
        ],
      },
    },
    {
      type: 'vignette', bg: 'cliff', place: 'CAPE ASHEN · THE WRONG END OF THE TOWER', lit: true,
      cast: { vera: { x: 0.42 }, bram: { x: 0.55 } },
      beats: [
        b('', 'The Cape. The tower stands on its rock like a thumb on the scale of the sea. At its base, in the lee, a *door* with a kettle on it, and beside the door a man with a lamp keeper\'s shoulders and a deserter\'s eyes.'),
        b(SP.keeper, 'Vera Solt. You\'ve gone grey in a distinguished way, and you\'ve brought the only two medical facilities I rate — the big one with the biceps and the singing one. Kettle\'s boiled twice. I was going to pour it out. I didn\'t.'),
        b(SP.vera, 'Aldous. The order to burn your tower was countersigned by nobody, and you kept this light unlit-for-nineteen-years with one wick and a stolen greatcoat, and I *filed* you as unburnable weather.'),
        b(SP.keeper, 'You *promoted* me, is what you did. "Weather." The one thing the high command couldn\'t court-martial. — I heard about it, you know. From the wires. A troupe singing Moths off the Gloom / playing a mine wake to standing ovation / the auditor crying. I heard all of it, standing in my dark, like a man hearing the sea in a shell, except the sea is my actual neighbours.'),
        {
          tx: 'Nineteen years. He has been keeping the fire and the secret in the same drawer. What does a captain say standing at the door of the life she didn\'t burn down?',
          choices: [
            { label: '"I\'M SORRY. LATE, BUT IT WAS ALWAYS GOING TO BE LATE."', set: { trust: 5, 'bonds.dill': 2, flag: 'sorry' }, do: (s, g) => g.toast('He nods like it\'s a bill finally settled in his favour.', 'cold') },
            { label: '"YOU KEPT THE BEST RECORD OF THE 47TH. WE JUST Toured IT."', set: { morale: 4, rep: 1, 'bonds.bram': 2, flag: 'joked' }, do: (s, g) => g.toast('Bram laughs loud enough to startle the sea, which flinches, which is historic.', 'cold') },
            { label: 'HAND HIM THE SUNKEY. LIGHT THE TOWER DOOR-LAMP FROM IT.', set: { trust: 3, relit: 1, flag: 'sunkeyShared' }, do: (s, g) => g.toast('One flame becomes two. He doesn\'t trust his hands and pretends he does.', 'cold'), note: 'The first lamp he\'s lit in nineteen years with anyone else\'s fire.' },
          ],
        },
        b(SP.keeper, 'The Choir\'s coming, by the way. Not next week. *Tonight* — I\'ve watched their candles cross the Gloom since dusk. Nune with a procession and a patience to match yours. Whatever this is going to be — I\'m in. Old legs, new reason.'),
        b(SP.vera, 'Then we hold the light till dawn, together, the way the banner said. We keep it burning. — Troupe. The lamp room. *Places.*'),
      ],
    },
    {
      type: 'watch',
      arena: {
        name: 'THE LONG WATCH', place: 'CAPE ASHEN · THE GREAT LAMP',
        duration: 100, lamps: 5, gloom: 1, relightOil: 3, spawn: 1.25, finale: true,
        intro: [
          b('', 'The great lamp stands on its plinth at the centre of the room — the Sunkey\'s big sister, a flame the size of a reliquary. Four way-lamps ring the gallery out on the rock. Below: the procession\'s candles, a slow vein of silver climbing the cliff path.'),
          b(SP.nune, '[from the stair] I am not coming up to fight you, Lanterns. I am coming up to *be here* when the arithmetic is done. Hold your fire. We will hold our breath.'),
          b(SP.vera, 'Then hold the ring of lamps till dawn. Every one that stays lit is a village that hears the Cape is awake. Fenn — wire the relay. Bram — be the immovable object. Odile — if anyone gets low, sing at them. *I* hold the great lamp.'),
        ],
        winBeats: [
          b('', 'The lamp holds. The ring holds. And then, up the tower windows, the grey turns the colour of a healing bruise, and then — *copper.* Dawn. Actual, unimproved dawn.'),
          b(SP.keeper, 'Nineteen years and the light never went out. Nineteen years, and the light never went out *and a minute ago* it nearly did, and it didn\'t, and there are *witnesses* this time. I think I\'m going to be insufferable about it for years.'),
        ],
        loseBeats: [
          b('', 'The great lamp gutters, catches, gutters again — and the room learns the true colour of a dark that has won an argument. Somewhere down the stair, a hundred candles are singing something with the words "mercy" in it.'),
        ],
      },
    },
    { type: 'ending' },
  ],
};

// ------------------------------------------------------------------ ENDINGS

export const ENDINGS = {
  chain: {
    title: 'THE CHAIN OF SMALL SUNS',
    kicker: 'THE LEDGER, CLOSED IN GOLD',
    lines: [
      'Eight bells, Hollow Mill to the Cape. Every village on that coast lights its lamp at the same minute — not to see by. To answer.',
      'The sun stays a sixpence behind wet wool. Nobody has "fixed" the sky. Fixing was never the job; *keeping* was. The dark files an objection and is, for the first time in thirty years, out-voted by a chorus of small fires.',
      'The Quiet Choir splits down the middle: half keep the old policy, half take up wicks and learn a worse trade that pays better in sleep. Nune is in the second half. He has begun, badly, to sing.',
      'The Lantern Troupe tours on. The 47th motto got stamped on a lamp housing after all — the good press, the one that fits. WE KEEP IT BURNING.',
      'The sun will not come back this century. Fine. Nobody was ever good at mornings. — But there are evenings now, and there are players, and there is, always, the *next lamp.*',
    ],
    epigraph: '*Sleep, small sun, your hour is done — we\'ll keep the cheaper kind.*',
  },
  sorrow: {
    title: 'SORROW, SPONSORED',
    kicker: 'THE LEDGER, KEPT Afloat BY TERMS',
    lines: [
      'The lamps are lit — with sponsorship. The poster reads "Ashvale Keeps Its Light, Presented by the Quiet Choir," in a typeface nobody liked. The billboards say *Sorrow, Improved.* The Moths play to sold rooms. Their new encore is the troupe\'s old banner song, slowed, with a chime before the ad.',
      'Nobody is harmed. Everything is *managed.* The auditor smiles with both mouth-halves. This is what winning looked like once the war ended — the terms were soft, the terms were *indefinite.*',
      'Fenn took a job on the Choir wires. "It\'s intelligence, captain, and you can\'t cancel the mail." Bram carries the crates himself now, saying nothing; that is the tax. Odile still sings the aria — every night, off-script, unbilled. It is the one item the sponsorship cannot spell.',
      'The troupe tours. The lights hold. The songs are *sponsored* and still, underneath, *true.* Small mercies. We\'ll take them, put a price on them, and hand them out at the gate.',
      'The dark is patient. So are you. You have always been better at patience than the dark expects — it just costs more than applause.',
    ],
    epigraph: 'We keep it burning. The invoice keeps it *rented.*',
  },
  silence: {
    title: 'THE SIXTH SILENCE',
    kicker: 'THE LEDGER, HELD IN THE THROAT',
    lines: [
      'The beacon went dark at half-past the wrong hour, and a hundred kilometres of coast slept unlit like a town learning the word "quiet" from the inside. The Choir called it mercy. Nobody thanked them. Nobody threw anything, either, which is how you know the town is tired, not defeated. Not yet.',
      'But Fenn recorded the Long Watch — every lamp, every shove, the last aria played to the dark for an audience of Mothings — and put it on the open wires at the exact hour it ended. Every village with a receiver heard the fight and heard the quiet after it. Then, one at a time, inland: small lamps came on. Then smaller ones. A child\'s candle in Hollow Mill\'s square, burning against a law, with the shutters open on purpose.',
      'Vera kept the Cape\'s base-door lamp for a winter. One small flame, no tower, no arithmetic. On the first morning the tide gave back a lantern, and beside it, folded to keep, a Wickwright citation, stamped: FEE WAIVED. INDEFINITELY. Someone in that union can read a ledger and still have a soul. Cinder ate the paper. It was delicious, said the ticker, and honest.',
      'The song outlived the light it was keeping. That is not the ending the banner promised. It is, however, a *seed,* and seeds, unlike lamps, prefer the dark. — It\'s a small light. It\'ll have to do. For now, for years, for whoever comes singing next, it does.',
    ],
    epigraph: '//It is a small light. It will have to do. It will have to do. It will//',
  },
};

// ------------------------------------------------------------------ card copy

export const TITLE_BLURB =
  'The sun shrank to a sixpence behind wet wool, and the last lit places went to war. ' +
  'The 47th Light Infantry held the light and was mustered out sideways. Now they travel with a cart, ' +
  'a puppet, and one perfect song — the Lantern Troupe — playing villages that pay in lamp-oil, ' +
  'keeping the last small lights of the world from going out. <b>Combat is rare and brutal. The rest is a show.</b>';

export const HOWTO = [
  ['MOVE', 'A / D or ◀ ▶'],
  ['ADVANCE', 'SPACE / CLICK'],
  ['PERFORM', 'D F J lane keys or the on-screen buttons'],
  ['WATCH', 'AIM WITH MOUSE, CLICK LAMPS TO RELIGHT, SPACE TO SHOVE'],
  ['TALK', 'WARM · FIRM · WIT · READ — match the mood, spend the levers'],
  ['CAMPFIRE', 'choices move BONDS — bonds open the good lines later'],
];

export const LEDGER_NOTE =
  'The only scores here are the ones that stay lit. Oil spends; lamps keep. The roads talk about you, for good or ill, and the troupe trusts you with what\'s left of its arithmetic.';

export const TRIBUTE = {
  // small easter-egg lines sprinkled by main.js as toasts
  opening: 'WE KEEP IT BURNING — 47TH LIGHT INFANTRY',
  curtain: 'applause is ambient. it is not billable. — PELL, RELUCTANTLY',
};

export { chapter2 as CHAPTER2, chapter3 as CHAPTER3 };
