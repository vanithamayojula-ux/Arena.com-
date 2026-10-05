/* LUMEN PROTOCOL — the script. Every line, every consequence, every version
   of the night the lantern market burned. Nodes: {lines:[[who,text]…], fx,
   then | choices:[{t, tag, need, fx, then|goto}]}. Effects are permanent —
   that is the whole promise. */

export const CHAPTERS = [
  { name: 'THE DESCENT JOB', scenes: ['lift', 'bar', 'alley'] },
  { name: 'THREE TESTIMONIES', scenes: ['market', 'mh2', 'recon', 'delivery', 'stowaway'] },
  { name: 'THE CLIENT IS THE CARGO', scenes: ['front', 'vault', 'slice', 'final'] },
];

export const SCENES = {

/* ════════════════════════ CHAPTER ONE ═══════════════════════════════════ */

  lift: {
    chapter: 1, bg: 'shaft', title: 'DESCENT LINE 9 · TIER 12 → TIER 38',
    start: 'n1',
    nodes: {
      n1: {
        lines: [
          ['sys', 'The capsule drops through nine tiers of weather. Your receipt for the job scrolls the glass upside-down: ONE (1) SEALED MORNING. HAND TO SERA, THE DROWNED LANTERN. DO NOT OPEN. — do people say that to couriers like it helps.'],
          ['kess', 'You’re humming again. It’s the song from the lift in the building that burned. You don’t remember noticing you know it.'],
        ],
        choices: [
          { t: '“Kess. You riding with me on purpose today?”', then: 'n2', fx: { trait: { empathy: 1 } } },
          { t: 'Run a diagnostic instead. The voice is cargo noise.', tag: 'LUCIDITY', then: 'n3', fx: { trait: { lucidity: 1 } } },
        ],
      },
      n2: {
        lines: [
          ['kess', 'Purpose is strong. I’m what’s left in the pocket when somebody folds a memory away. You folded me. I’m not angry — the angry ones got folded deeper.'],
          ['me', 'Then hold on. Whatever I deliver tonight, at least one of us gets to watch.'],
          ['kess', 'That’s the worst thing to say to a stowaway. Now I’ll have opinions about the whole evening.'],
        ],
        then: 'n4',
      },
      n3: {
        lines: [
          ['sys', 'DIAGNOSTIC: 1 UNROUTED CONSCIOUSNESS FRAGMENT (V.O.) — NON-CRITICAL. The implant files it where you asked it to file things: nowhere that costs.'],
          ['kess', '…fine. Cold storage. It’s quieter there, and colder, and I’ll still be here when you run out of reasons not to talk to me.'],
        ],
        fx: { flag: { kess_quiet: true } },
        then: 'n4',
      },
      n4: {
        lines: [
          ['sys', 'TIER 38. The Drowned Lantern smells like a river pretending to be a bar. The package hums once, polite, like a knuckle on glass.'],
        ],
        then: 'END',
      },
    },
  },

  bar: {
    chapter: 1, bg: 'bar', title: 'THE DROWNED LANTERN · A BAR AT THE BOTTOM OF THE RAIN',
    start: 'b1',
    nodes: {
      b1: {
        lines: [
          ['sera', 'You’re the courier. You’re nine minutes late and I’ve decided that matters, so make it stop mattering.'],
          ['me', 'The elevator filed a weather complaint against the entire tier. I move at the speed of bureaucratic precipitation.'],
          ['sera', '…that was almost funny. Sit. Not at the bar. The bar is where I did “fine” for three months.'],
        ],
        choices: [
          { t: 'Sit. Let her set the pace.', then: 'b2', fx: { trait: { empathy: 1 } } },
          { t: '“The package is the job, Sera. Do you want the morning or not?”', tag: 'LUCIDITY', then: 'b2c', fx: { trait: { lucidity: 1 } } },
          { t: 'Order two whiskeys and bill the Guild. Confidence is a delivery method.', tag: 'DEFIANCE 1', need: { trait: { defiance: 1 } }, then: 'b2d', fx: { trait: { defiance: 1 } } },
        ],
      },
      b2: {
        lines: [
          ['sera', 'He uploaded it the morning of. Forty-one minutes, he said. I said who counts minutes. He said: the people who know how fast they go.'],
          ['sera', 'Then the Lantern Fire and… the count stopped mattering. I paid the Guild to keep it. I couldn’t pay them to keep him.'],
        ],
        then: 'b3',
      },
      b2c: {
        lines: [
          ['sera', '“Or not” — said like a man holding a lamp he’s already decided to leave on. Yes. I want the morning. No. I want to not want it. Do you take both orders?'],
          ['me', 'We take both. We just deliver one at a time.'],
        ],
        then: 'b3',
      },
      b2d: {
        lines: [
          ['sys', 'You drink like a person with paperwork. It seems to work on her: Sera laughs once, catastrophically, and then talks.'],
          ['sera', 'Forty-one minutes. Coffee, an argument about a lamp, sunlight at a bad angle. He made the sun look guilty. That’s the last thing he did — put the best light on it and called it morning.'],
        ],
        then: 'b3',
      },
      b3: {
        lines: [
          ['sys', 'THE PACKAGE: A WIDOW’S LAST MORNING. Your implant lays it out for you like a choice it respects too much to recommend.'],
          ['me', 'Standard delivery is the ORIGINAL — I carry his forty-one minutes into her, and they go out of me. Whole, gone. The way things leave.'],
          ['me', 'Or a COPY. She gets the morning; I keep a ghost of it. It’s not theft. It’s… insurance the Guild invented and the priests pretend not to bless.'],
        ],
        choices: [
          {
            t: 'Deliver the ORIGINAL. He made it for her, not for the cargo.',
            then: 'b_orig', fx: { trait: { empathy: 1 }, deliver: { pack: 'widows_morning', mode: 'original', to: 'sera' }, flag: { sera_whole: true } },
          },
          {
            t: 'Deliver a COPY. Keep the morning folded in your pocket. (A copied memory sharpens a courier. Usually.)',
            tag: 'LUCIDITY 2', need: { trait: { lucidity: 2 } },
            then: 'b_copy', fx: { trait: { lucidity: 1 }, deliver: { pack: 'widows_morning', mode: 'copy', to: 'sera' }, flag: { sera_seam: true }, skill: 'frost_read', scar: 'Kept a copy of someone else’s morning. You know what sunlight at a bad angle buys.' },
          },
          {
            t: 'Deliver a certified morning that never happened. The Guild issues blanks to no one — but you were holding one.',
            tag: 'FROST READ', need: { skill: 'frost_read' },
            then: 'b_forge', fx: { trait: { defiance: 1 }, skill: 'jury_rig', deliver: { pack: 'widows_morning', mode: 'forged', to: 'sera' }, flag: { sera_forge: true }, scar: 'Sold a widow a better morning. It is, technically, true now.' },
          },
        ],
      },
      b_orig: {
        lines: [
          ['sys', 'DELIVERY: 41:00 · INTEGRITY: ABSOLUTE · COURIER COPY: NONE. The hum in your implant goes out like someone setting down a tray.'],
          ['sera', '…coffee. He lets it get cold on purpose, the bastard. And the lamp — the lamp was OFF. He was setting it down when he said it, the light was—'],
          ['sera', 'Thank you for not keeping a receipt of me.'],
        ],
        then: 'b_end',
      },
      b_copy: {
        lines: [
          ['sys', 'DELIVERY: 41:00 · INTEGRITY: NINETY-TWO PERCENT · COURIER COPY: RETAINED. Somewhere in you, forty-one minutes keep happening quietly, like a clock you can’t give away.'],
          ['sera', 'It’s… it’s all here. All of it. Almost like it loves me a little less for being watched over. That’s stupid. It’s his, that’s not stupid. Thank you.'],
          ['kess', 'Frost Read unlocked. Congratulations: you can now tell a remembered moment from an invented one. It’s like being a weather system for liars.'],
        ],
        then: 'b_end',
      },
      b_forge: {
        lines: [
          ['sys', 'DELIVERY: 41:00 · INTEGRITY: CERTIFIED (FABRICATION) · GUILD SEASON: IRRELEVANT. The morning you assembled is nicer than any morning and structurally true in the ways grief requires.'],
          ['sera', '…oh. Oh, that’s — we did have a day like that. Did we? Of course we did. Of COURSE we did. You’re not getting a refund.'],
          ['kess', '…I hope the audit gods are kind. I hope she never needs a receipt. Mostly I hope you remember which one of you wrote it.'],
        ],
        then: 'b_end',
      },
      b_end: {
        lines: [
          ['sys', 'ONE (1) SEALED MORNING · DELIVERED. Your log signs itself; the rain logs back. On the bar, Sera laughs and cries in the same breath like they were always the same word.'],
          ['sys', 'Vaun wants you at the alley. Vaun always wants you at the alley. It’s what he means by “casually.”'],
        ],
        then: 'END',
      },
    },
  },

  alley: {
    chapter: 1, bg: 'alley', title: 'THE SHORT ALLEY · VOUN BROKERAGE (UN)LICENSED',
    start: 'a1',
    nodes: {
      a1: {
        lines: [
          ['vaun', 'Courier. Beautiful courier. You look like a person who just made someone else’s worst night slightly obsolete. Sit on the crate. Don’t touch the cat. The cat is a camera.'],
          ['me', 'You have a job. Your “casual” has a price sheet.'],
          ['vaun', 'The Lantern Fire. It’s had three testimonies and one claimant the whole time — Sera, who paid to forget and is paying now to remember. Three witnesses, three versions. I broker deliveries of truth like it’s produce.'],
        ],
        choices: [
          { t: '“Which version is right?”', then: 'a2' },
          { t: '“Which version PAYS?”', then: 'a2b', fx: { trait: { defiance: 1 } } },
        ],
      },
      a2: {
        lines: [
          ['vaun', '“Right.” Listen — everyone at the fire was right at different seconds. The sister saw corp flamethrowers. The cult priest swears it was holy accident. And the fishmonger on tier thirty-eight sells carp and, I’d wager, doesn’t have a face that survived the night.'],
          ['me', 'You think the victim is alive.'],
          ['vaun', 'I think the memory of a victim has an unclaimed-forward shipping label. Splice a version, courier, and the truth bills itself.'],
        ],
        then: 'a3',
      },
      a2b: {
        lines: [
          ['vaun', 'All three pay, differently. A spliced truth carries the highest broker rate and the lowest regret tax. You, specifically, get paid in the rarest currency: the feeling of having chosen.'],
          ['me', 'That’s not a currency, Vaun.'],
          ['vaun', 'It’s the ONLY one. Everything else inflates.'],
        ],
        then: 'a3',
      },
      a3: {
        lines: [
          ['sys', 'On the crate beside you: an unclaimed locker, warm as a hand. Inside — GRIEF, TIER 38 (UNCLAIMED). An elevator man’s flood-mourning, rejected by every recipient address. It hums at you like it knows you take returns personally.'],
        ],
        choices: [
          { t: 'Carry it. Grief with nowhere to go should at least have somewhere to be.', tag: 'RELIC', then: 'a4take', fx: { trait: { relic: 1 }, gain: 'elevator_grief', skill: 'steel_memo', flag: { took_grief: true } } },
          { t: '“Unclaimed is a legal status, not a personality.” Leave it.', tag: 'LUCIDITY', then: 'a4leave', fx: { trait: { lucidity: 1 } } },
        ],
      },
      a4take: {
        lines: [
          ['kess', '…oh, you’ve invited the tide into the apartment. Fine. You sink, you float, you sink. That’s his cadence. You’ll hum it before the week is out.'],
          ['me', 'Noted. Stowaway filing an opinion.'],
        ],
        then: 'a5',
      },
      a4leave: {
        lines: [
          ['sys', 'The locker cools as you stand. Some of the rain sounds offended on its behalf. You catalog this: leaving is also a delivery.'],
        ],
        then: 'a5',
      },
      a5: {
        lines: [
          ['vaun', 'Three stalls, one fire. Go be a courier with opinions. And courier — at the market, the grieving perform. If you can SEE the performance, it changes what they can pay you with. Most people can’t. Some can after a night like yours.'],
        ],
        choices: [
          { t: 'Ask him to teach you the tell. Offer an afternoon of frost-read favors in trade.', tag: 'FROST READ', need: { skill: 'frost_read' }, then: 'a6', fx: { skill: 'echo_sight', trait: { lucidity: 1 }, flag: { learned_tell: true } } },
          { t: 'You can read a room that files itself away. You always could. Decide to trust it.', tag: 'RELIC 3', need: { trait: { relic: 3 } }, then: 'a6b', fx: { skill: 'echo_sight', trait: { relic: 1 } } },
          { t: 'Testimonies are doors. You have a face keys like.', tag: 'EMPATHY 3', need: { trait: { empathy: 3 } }, then: 'a6c', fx: { skill: 'echo_sight', trait: { empathy: 1 } } },
          { t: '“The vault at nine. Teach me the knock — in case tonight ends somewhere expensive.”', tag: 'DEFIANCE 2', need: { trait: { defiance: 2 } }, then: 'a_knock', fx: { skill: 'ghost_key' } },
          { t: '“Then most people shouldn’t. I’ll take my chances raw.”', then: 'a_end' },
        ],
      },
      a6: {
        lines: [
          ['vaun', 'The tell is the pause BEFORE the answer, not after. A lie rehearses on the way out; a memory rehearses on the way IN. Watch the inhale. Tuition paid by your silence about my cat.'],
          ['sys', 'SKILL GAINED — ECHO SIGHT: you read the tells of the grieving. Contradictions become doors; the grieving, doors that open.', 'sys'],
        ],
        then: 'a_end',
      },
      a6b: {
        lines: [
          ['me', 'I’ve been carrying other people’s minds for years. I know the sound a memory makes coming in. I just hadn’t called it a skill.'],
          ['sys', 'SKILL GAINED — ECHO SIGHT. The dead nod, all of you at once.'],
        ],
        then: 'a_end',
      },
      a6c: {
        lines: [
          ['me', 'You don’t need a trick. Grief is honest in its body even when its mouth is under contract. I just have to agree to look.'],
          ['sys', 'SKILL GAINED — ECHO SIGHT. Vaun looks briefly like a man who has been out-philosophized by his own brochure.'],
        ],
        then: 'a_end',
      },
      a_knock: {
        lines: [
          ['vaun', 'Knock-knock-pause. The warden’s old cipher — half of a door is etiquette. You were always going to need a door. For this courtesy the cat saw nothing, which is technically a bribe.'],
          ['sys', 'SKILL GAINED — GHOST KEY. Locked doors remember you kindly.'],
        ],
        then: 'a_end',
      },
      a_end: {
        lines: [
          ['sys', 'JOB FILED · THE LANTERN FIRE (FRAGMENTED). Three versions, one claimant, forty tiers of rain between. The market at tier thirty-eight stays open late. It always does. It’s the only tier where night has a floor plan.'],
        ],
        fx: { gain: 'lantern_fire' },
        then: 'END',
      },
    },
  },

/* ════════════════════════ CHAPTER TWO ═══════════════════════════════════ */

  market: {
    chapter: 2, bg: 'market', title: 'FLOODED MARKET · TIER 38 · NIGHT WITHOUT A ROOF',
    start: 'm1',
    nodes: {
      m1: {
        lines: [
          ['sys', 'Neon lies in the water the way news lies on the tongue: faithfully. Stalls float. The carp are rude. Somewhere in the market a lantern is being mourned that the city can’t admit it had.'],
          ['kess', 'Three stalls, courier. The sister on the left with the grief that keeps appointments. The priest mid-market with the grief that kneels. And the fishmonger, right, whose grief is suspiciously well-fed.'],
        ],
        choices: [
          { t: 'Work the stalls like a courier: receipts first, hearts later.', then: 'm_end' },
          { t: 'Stand in it a minute first. The market deserves a witness, not just a broker.', tag: 'EMPATHY 2', need: { trait: { empathy: 2 } }, then: 'm_soft', fx: { trait: { empathy: 1 } } },
          { t: 'Let the carried grief teach you the cadence of the drowned tiers. You sink, you float, you sink.', tag: 'CARGO: TIER-38 GRIEF', need: { pack: 'elevator_grief' }, then: 'm_cadence', fx: { skill: 'flood_tongue' } },
        ],
      },
      m_cadence: {
        lines: [
          ['kess', '…there it is. He’s teaching you through the cargo hold. Say it with the water: you sink, you float, you sink.'],
          ['sys', 'SKILL GAINED — FLOOD TONGUE. The cadence of the tiers now answers soothing checks that words alone would sink.', 'sys'],
        ],
        then: 'm_end',
      },
      m_soft: {
        lines: [
          ['sys', 'You stand in the rain’s echo until the market forgets you’re auditing it. A kid hands back a dropped chit you didn’t drop. The tide is doing paperwork on your behalf.'],
          ['kess', 'Careful. Witnessing is a load-bearing act.'],
        ],
        then: 'm_end',
      },
      m_end: {
        lines: [
          ['sys', 'THE TESTIMONY HUB. Three versions of one night. Nobody will hand you theirs for the price of curiosity — but memory discounts for the right posture.'],
        ],
        then: 'END',
      },
    },
  },

  ilo: {
    chapter: 2, bg: 'market', title: 'THE SISTER · A STALL OF SECOND-HAND LAMPS',
    start: 'i1',
    nodes: {
      i1: {
        lines: [
          ['ilo', 'You’re Guild. Or courier, which is Guild with better shoes. My brother died holding a lamp he’d argued about, and the corp says “accident” like it’s a brand name. I saw the flamethrowers. I saw the survey flags the week before.'],
          ['me', 'Give me the morning of the fire, Ilo. All of it. I carry truths the way other people carry umbrellas.'],
        ],
        choices: [
          { t: 'Ask what the fire sounded like. Grief answers sensors before questions.', tag: 'EMPATHY 2', need: { trait: { empathy: 2 } }, then: 'i2', fx: { trait: { empathy: 1 } } },
          { t: 'Let the silence run long enough that she fills it with the true version.', tag: 'FLOOD TONGUE', need: { skill: 'flood_tongue' }, then: 'i2', fx: { trait: { empathy: 1 }, flag: { ilo_warm: true } } },
          { t: '“Take your time. My meter’s already running.”', then: 'i2b', fx: { trait: { lucidity: 1 } } },
          { t: 'Ask if she’s sure it was the corp. Sure is a number, not a feeling.', tag: 'ECHO SIGHT', need: { skill: 'echo_sight' }, then: 'i2c' },
        ],
      },
      i2: {
        lines: [
          ['ilo', 'It sounded like the market laughing, and then not. That’s not evidence, I know. Evidence is a lamp that remembers being held. If you carry mine to Sera, you carry it as TRUTH-AS-FILED, not truth-as-was. I’m the sister. I’m allowed to be a version.'],
          ['sys', 'TESTIMONY #1 ON RECORD — “THE COMPANY LIT IT.” (arson · the corp cleared the tier; the cult is cover; the victim is a martyr.)'],
        ],
        fx: { flag: { frag_ilo: true } },
        then: 'i_end',
      },
      i2b: {
        lines: [
          ['ilo', 'Fine. Short version, paid version: the corp burned it. Flamethrowers, survey flags, the priest’s candle as the official excuse. I’d stake the lamp collection on it. I have staked the lamp collection on it.'],
          ['sys', 'TESTIMONY #1 ON RECORD (PARTIAL) — “THE COMPANY LIT IT.” She kept the sound of it, as payment.'],
        ],
        fx: { flag: { frag_ilo: true, ilo_cold: true } },
        then: 'i_end',
      },
      i2c: {
        lines: [
          ['sys', 'ECHO SIGHT: she rehearses on the way IN. The flamethrowers are real — she SAW them. The survey flags: a pause. A pause someone installed.'],
          ['me', 'The flags. Someone told you about the flags after. Who?'],
          ['ilo', '…Quill. The priest came to me after and “helped me sort it.” Ilo doesn’t get sorted. The fire I saw is mine. The flags are his gift-wrap.'],
          ['sys', 'TESTIMONY #1 ON RECORD + CONTRADICTION FLAGGED — “THE COMPANY LIT IT (partly inherited memory).” Ilo looks at you like you’ve returned something stolen.'],
        ],
        fx: { flag: { frag_ilo: true, contra_ilo: true, ilo_warm: true } },
        then: 'i_end',
      },
      i_end: {
        lines: [['sys', 'One down. Grief discounts rarely survive three transactions.']],
        goto: 'mh2',
      },
    },
  },

  quill: {
    chapter: 2, bg: 'market', title: 'THE PRIEST · A SHRINE OF MELTED LANTERNS',
    start: 'q1',
    nodes: {
      q1: {
        lines: [
          ['quill', 'Blessed be the flame that asks nothing back. You’ve come for the accident. Everyone at the fire was mine that night, and the Lanternites’ candles caught the rain-roof’s oil, and holiness is flammable, courier — did you know that? Nobody budgets for it.'],
        ],
        choices: [
          { t: '“Nobody budgets for it.” Agree with him. Guilt hates an audit and loves a witness.', tag: 'EMPATHY 2', need: { trait: { empathy: 2 } }, then: 'q2', fx: { trait: { empathy: 1 } } },
          { t: 'Check the pause. Priest-crafted pauses are load-bearing.', tag: 'ECHO SIGHT', need: { skill: 'echo_sight' }, then: 'q2c' },
          { t: 'Take the accident as filed. It pays Sera nothing but it costs her less.', then: 'q2b', fx: { trait: { lucidity: 1 } } },
        ],
      },
      q2: {
        lines: [
          ['quill', 'It was us. We lit the sky to bless a market and the market, understandably, declined. I told the sister about the survey flags — she needed a villain with an address, and I needed it not to be us. Forgive the geometry. It was a mercy with edges.'],
          ['sys', 'TESTIMONY #2 ON RECORD — “HOLY ACCIDENT.” And his confession, free, because you made a place the size of agreement for it.'],
        ],
        fx: { flag: { frag_quill: true, quill_confessed: true } },
        then: 'q_end',
      },
      q2b: {
        lines: [
          ['quill', 'You take it clean? No charge for the knees? …Fine. The candle, the oil, the roof. The accident. File it. I’ll be here, indefinitely, on my knees, rent-free.'],
          ['sys', 'TESTIMONY #2 ON RECORD (PARTIAL) — “HOLY ACCIDENT.” The confession stays in him like a splint.'],
        ],
        fx: { flag: { frag_quill: true } },
        then: 'q_end',
      },
      q2c: {
        lines: [
          ['sys', 'ECHO SIGHT: the accident has no rehearsal at all — it arrives in him raw, which means it happened exactly as the grief says. The “we meant to” is the lie. You watch him decide whether to be found out.'],
          ['quill', '…you see like that. Then you already own the rest: we lit it to bless the tier. The survey flags were my mercy, given to the sister with my hands shaking. I have wanted, terribly, to tell a professional.'],
          ['sys', 'TESTIMONY #2 ON RECORD — “HOLY ACCIDENT” + FULL CONFESSION. He hands you both truths like a man setting down two cups at once.'],
        ],
        fx: { flag: { frag_quill: true, quill_confessed: true, contra_quill: true } },
        then: 'q_end',
      },
      q_end: {
        lines: [['sys', 'The candles gutter in what may be applause. Two versions, one market, still a fishmonger on the right with too much muscle for his grief.']],
        then: 'END',
      },
    },
  },

  dren: {
    chapter: 2, bg: 'market', title: 'THE FISHMONGER · CARP, SALTED AND UNBELIEVING',
    start: 'd1',
    nodes: {
      d1: {
        lines: [
          ['dren', 'I sell carp and I grieve in private. You’re the courier carrying the fire. Sera sent you? She sends everyone eventually, like weather with invoices.'],
          ['me', '“Dren.” The victim of the Lantern Fire had a different name. And no face that made it out, the file says. The file has been wrong before; you can see me notice.'],
          ['dren', 'The file is a coffin with a stamp. Here’s a free sample of the truth, courier: I planned my death for six months, and the fire was my alibi, not my accident. The candles caught early. The corp’s flamethrowers caught LATE, on their survey day, when there was nothing left to burn but the version I needed the tier to see.'],
        ],
        choices: [
          { t: '“You left her a forty-one-minute morning as an exit wound.” Look at him while you hear it.', tag: 'EMPATHY 3', need: { trait: { empathy: 3 } }, then: 'd2', fx: { trait: { empathy: 1 } } },
          { t: '“Three testimonies, all true, all incomplete. You faked dying and got burned anyway by the timing.” Price it.', then: 'd2b', fx: { trait: { lucidity: 1 } } },
          { t: '“Why tell me at all.” (You have the tell now. You both know you have the tell.)', tag: 'ECHO SIGHT', need: { skill: 'echo_sight' }, then: 'd2c' },
        ],
      },
      d2: {
        lines: [
          ['dren', 'The morning was my last honest invoice. He — me — uploaded it so she’d have SOMETHING with the sun in it, and I walked out of my own file into carp and weather. Deliver me if you must. Deliver me WHOLE and she learns her widowhood is a costume I forgot to mail back.'],
          ['me', 'And if I don’t deliver it.'],
          ['dren', 'Then I’m a ghost who feeds himself, and she’s a widow who gets to be one, and the lie is a kind of mercy with a mortgage on it. Choose like you mean it, courier. That’s the only skill that carries.'],
          ['sys', 'TESTIMONY #3 ON RECORD — “THE VICTIM LIVES. THE FIRE WAS HIS.” Dren goes back to the carp. The carp, at least, are honest about being dead.'],
        ],
        fx: { flag: { frag_dren: true, dren_asks: true } },
        then: 'd_end',
      },
      d2b: {
        lines: [
          ['dren', 'Price it, sure. The truth where Sera can buy it: two chits, or the version where I’m dead — free, framed, market rate for the bereaved.'],
          ['sys', 'TESTIMONY #3 ON RECORD (BITTER) — “THE VICTIM LIVES.” He kept the part where he loved her. That was extra. That was the whole margin.'],
        ],
        fx: { flag: { frag_dren: true, dren_cold: true } },
        then: 'd_end',
      },
      d2c: {
        lines: [
          ['sys', 'ECHO SIGHT: no rehearsal either way — which means the confession was always going to leak. He picked the professional because the professional is the only one who can be TRUSTED to lie on his schedule.'],
          ['dren', '…clever eyes. Fine: I WANT it delivered, and I want to beg you not to. Both are load-bearing. Take both truths. Choose with them.'],
          ['sys', 'TESTIMONY #3 ON RECORD + META — “THE VICTIM LIVES, AND ASKS TO BE BOTH EXPOSED AND PROTECTED.”'],
        ],
        fx: { flag: { frag_dren: true, dren_asks: true, contra_dren: true } },
        then: 'd_end',
      },
      d_end: {
        lines: [['sys', 'THREE TESTIMONIES ON HAND. Your implant lays them side by side like fish at market. They are all true. That is the problem.']],
        goto: 'mh2',
      },
    },
  },

  mh2: {
    chapter: 2, bg: 'market', title: 'THE TESTIMONY HUB · WHO DO YOU MAKE RICH?',
    start: 'h1',
    nodes: {
      h1: {
        lines: [
          ['sys', 'The three stalls, three versions, one delivery address — Sera. The Lantern Fire (FRAGMENTED) hums, waiting to be spliced into a self.'],
        ],
        choices: [
          { t: 'The SISTER. Ask again, softer; she kept details like receipts.', then: 'goto:ilo', need: { noFlag: 'frag_ilo' } },
          { t: 'The PRIEST. Guilt takes a second appointment easily.', then: 'goto:quill', need: { noFlag: 'frag_quill' } },
          { t: 'The FISHMONGER. You have questions a receipt can’t answer.', then: 'goto:dren', need: { noFlag: 'frag_dren' } },
          { t: 'Splice the fire. Whatever you believe becomes what Sera survives.', then: 'goto:recon', need: { anyFlag: ['frag_ilo', 'frag_quill', 'frag_dren'] } },
        ],
      },
    },
  },

  recon: {
    chapter: 2, bg: 'market', title: 'RECONCILIATION · SPLICING THE NIGHT',
    fx: { trait: { relic: 1 } },
    start: 'r1',
    nodes: {
      r1: {
        lines: [
          ['sys', 'RECONCILIATION PROTOCOL. The three testimonies hover in your vision like tabs that refuse to close. Splice one and the others go dark in the file — alive in you, unbillable to the world.'],
        ],
        choices: [
          {
            t: 'SPICE: ARSON. The corp lit it; Sera gets a villain with an address. The cult stays a cover story. (A widow with a defendant grieves like a litigant: forward.)',
            need: { flag: 'frag_ilo' },
            then: 'r_ilo', fx: { flag: { fire_ver: 'arson' }, trait: { defiance: 1 } },
          },
          {
            t: 'SPICE: HOLY ACCIDENT. Candle, oil, roof. Nobody is a monster; everybody is a warning. (Grief with no defendant spirals — but it spirals honest.)',
            need: { flag: 'frag_quill' },
            then: 'r_quill', fx: { flag: { fire_ver: 'accident' }, trait: { empathy: 1 } },
          },
          {
            t: 'SPICE: THE VICTIM LIVES. Full truth, full cost. Her widowhood becomes a costume he forgot to mail back — and Sera chooses, for the first time since the fire, what to feel.',
            need: { flag: 'frag_dren' },
            then: 'r_dren', fx: { flag: { fire_ver: 'alive' }, trait: { lucidity: 1 } },
          },
          {
            t: 'WEAVE ALL THREE. A beautiful lie that carries every truth like a reef carries weather. The city gets a paradox it can live inside.',
            tag: 'ECHO SIGHT · RELIC 4', need: { skill: 'echo_sight', trait: { relic: 4 } },
            then: 'r_weave', fx: { flag: { fire_ver: 'weave' }, trait: { relic: 2, empathy: 1 }, scar: 'You wove three truths into one load-bearing lie. Somewhere a reef approves.' },
          },
          { t: 'Deliver ALL THREE unspliced. Let Sera choose what to believe from raw testimony.', tag: 'STEEL MEMORY', need: { skill: 'steel_memo' }, then: 'r_all', fx: { flag: { fire_ver: 'triple' }, trait: { defiance: 1, empathy: 1 } } },
        ],
      },
      r_ilo: {
        lines: [
          ['sys', 'SPLICED · ARSON. The other two go quiet in your implant — not deleted. Deferred. The difference is what you can afford later.'],
          ['kess', 'You made her a plaintiff. Is that mercy with a sword in it? …Careful. Swords cut the hand that files them.'],
        ],
        then: 'r_end',
      },
      r_quill: {
        lines: [
          ['sys', 'SPLICED · HOLY ACCIDENT. Nobody’s fault, everybody’s candle. Sera will grieve like weather now — enormous, impersonal, survivable.'],
          ['kess', 'The priest will hear it, you know. That she chose his version. He’ll add it to the list of mercies he can’t afford.'],
        ],
        then: 'r_end',
      },
      r_dren: {
        lines: [
          ['sys', 'SPLICED · THE VICTIM LIVES. The truth, fully addressed: “DREN, ALIVE, TIER 38, SELLS CARP, LOVES YOU IN THE PAST TENSE OUT OF HIS OWN MOUTH.”'],
          ['kess', '…this is the version that can kill. Or start something unlabeled. This is the one you can’t refund, courier.'],
        ],
        then: 'r_end',
      },
      r_weave: {
        lines: [
          ['sys', 'WEAVED. All three load-bearing: the corp DID clear land; the candles DID catch; the victim DID walk out. Sera gets a truth like the market gets rain — total, and survivable because it isn’t trying to be one thing.'],
          ['kess', 'That’s not a splice. That’s architecture. What is it going to cost YOU, carrying a roof nobody else has to stand under?'],
          ['me', 'Ask me in forty tiers. I’ll still be humming it.'],
        ],
        then: 'r_end',
      },
      r_all: {
        lines: [
          ['sys', 'UNRAVELING. You hand her all three at once and let her choose. It is either the most respect or the most cowardice a courier has ever delivered. The implant declines to log its opinion. (It has one.)'],
        ],
        then: 'r_end',
      },
      r_end: {
        lines: [['sys', 'THE LANTERN FIRE (SPLICED) is one package tonight. The Drowned Lantern is still warm. Go make it history.']],
        then: 'END',
      },
    },
  },

  delivery: {
    chapter: 2, bg: 'bar', title: 'THE DROWNED LANTERN · SECOND ROUND',
    start: 'v1',
    nodes: {
      v1: {
        lines: [
          ['sera', 'You came back with the fire in your teeth. Everyone who has ever owed me an apology has the same look. Sit. Is that… a package, or a verdict?'],
        ],
        choices: [
          { t: 'Deliver it the way it was spliced. Original. Whole. Unkept.', tag: 'EMPATHY', then: 'v_orig', fx: { deliver: { pack: 'lantern_fire', mode: 'original', to: 'sera' } } },
          { t: 'Deliver a copy of the fire. You keep one version in your pocket — couriers shouldn’t walk out of weather empty-handed.', tag: 'LUCIDITY', then: 'v_copy', fx: { deliver: { pack: 'lantern_fire', mode: 'copy', to: 'sera' }, trait: { lucidity: 1, relic: 1 }, scar: 'Kept a fire because it fit you.' } },
          { t: 'Withhold it. Some truths should ship COD: she decides by paying in forward years, not grief.', tag: 'DEFIANCE 4', need: { trait: { defiance: 4 } }, then: 'v_hold', fx: { trait: { defiance: 1 }, flag: { fire_held: true }, scar: 'You kept the fire she paid for. The interest is yours to carry.' } },
        ],
      },
      v_orig: {
        lines: [
          ['sys', 'DELIVERY: THE NIGHT OF THE LANTERN MARKET · COURIER COPY: NONE. You watch a woman receive her own history like weather — no refund counter, no exchange.'],
          ['sera', '…an address for the villain. A candle for the priest. A husband for… oh. Oh, the carp man. The CARP MAN. You brought me a—'],
          ['sera', '…thank you. It’s too much. That’s the first true thing anyone’s said to me in a year. Too much is exactly the amount.'],
        ],
        then: 'v_end',
      },
      v_copy: {
        lines: [
          ['sys', 'DELIVERY: SPLICE + COPY RETAINED. Somewhere behind your ribs, a lantern market keeps burning, politely, at your own volume.'],
          ['sera', 'You kept some of it. I can hear it — you hum like a fire when you think nobody’s pricing you. Don’t apologize. Nobody returns a package like you return a kept one: honestly.'],
        ],
        then: 'v_end',
      },
      v_hold: {
        lines: [
          ['sera', 'You won’t give it to me. You’ve decided I need to want it at a price. …You know what the tiers say about couriers like you? They say you’re the only ones who ever made grief cost the right amount.'],
          ['sys', 'FILED: DELIVERY HELD · INTEREST ACCRUING TO: YOU. The fire rides with you. It has started to feel like a resident.'],
        ],
        then: 'v_end',
      },
      v_end: {
        lines: [
          ['sys', 'JOB CLOSED: THE LANTERN FIRE (FRAGMENTED) → SERA. Your log auto-signs; the rain co-signs like it’s been there the whole time and just now got the paperwork. Tomorrow the tier will call this “the night Sera decided.” History always does.'],
        ],
        fx: { flag: { ch2_done: true } },
        then: 'END',
      },
    },
  },

  stowaway: {
    chapter: 2, bg: 'shaft', title: 'ASCENT LINE 9 · THE QUIET NINE MINUTES',
    start: 'k1',
    nodes: {
      k1: {
        lines: [
          ['kess', 'Nine minutes up. Say something true while I’m a passenger.'],
          ['me', 'The fire hums in me and I don’t want to give it back. Is that professional?'],
          ['kess', 'It’s the only part of the job that’s honest. So — do I get an answer too? When you were deciding what Sera deserved, I was deciding if you notice me. You do. Both of us are going to be insufferable now.'],
        ],
        choices: [
          { t: '“You were never cargo. I’m just bad at naming passengers.”', then: 'k2', fx: { trait: { empathy: 1, relic: 1 }, flag: { kess_named: true } } },
          { t: '“You’re a load. Loads are loved like loads are loved.” (The lie rehearses on the way out. Neither of you buys it.)', tag: 'LUCIDITY 4', need: { trait: { lucidity: 4 } }, then: 'k2b', fx: { trait: { lucidity: 1 }, flag: { kess_pushed: true } } },
          { t: 'Say nothing. Some ascents are the answer.', then: 'k2c', fx: { trait: { relic: 1 }, flag: { kess_wait: true } } },
        ],
      },
      k2: {
        lines: [
          ['kess', '…named. I’ll try that size. Careful, courier — named things start taking up the whole apartment.'],
        ], then: 'k_end',
      },
      k2b: {
        lines: [
          ['kess', 'Right. Cold storage again. I’ve built a whole life in there, you know. It has a chair.'],
        ], then: 'k_end',
      },
      k2c: {
        lines: [
          ['sys', 'The hum of you two is one hum now, and neither signs a paper about it.'],
        ], then: 'k_end',
      },
      k_end: {
        lines: [
          ['sys', 'TIER 20. A memo waits where the mail slot used to be, because the city has upgraded its threats: M. ARDENT REQUESTS THE FINAL DELIVERY. THE CLIENT IS THE CARGO.'],
        ],
        then: 'END',
      },
    },
  },

/* ═══════════════════════ CHAPTER THREE ══════════════════════════════════ */

  front: {
    chapter: 3, bg: 'tower', title: 'ARDENT HOUSE · THE TOP OF THE RAIN',
    start: 'f1',
    nodes: {
      f1: {
        lines: [
          ['sys', 'Above the clouds the city’s weather is only ambition with a plumbing problem. Ardent House has an elevator that apologizes for you.'],
          ['ardent', 'Courier. I’ve read your deliveries like love letters, which is a joke from me but not from the Protocol. Sit. You carried a man’s morning to a widow and a fire to a future. I’m offering you the last job: yourself.'],
        ],
        choices: [
          { t: '“The sealed slice. My enlistment deletion.” Don’t flinch. It’s load-bearing now.', then: 'f2' },
          { t: '“You don’t have me. Couriers keep copies of people like you.” (Frost Read. You hear your own lie rehearse on the way IN.)', tag: 'FROST READ', need: { skill: 'frost_read' }, then: 'f2b', fx: { trait: { lucidity: 1 } } },
          { t: '“Why.” One syllable. Let the silence bid first.', tag: 'EMPATHY 4', need: { trait: { empathy: 4 } }, then: 'f2c', fx: { trait: { empathy: 1 } } },
        ],
      },
      f2: {
        lines: [
          ['ardent', 'LUMEN PROTOCOL, plainly: the city cannot feel its own weather, so it pays couriers to. Every sealed mind you carry is a server we can’t audit, in a rack we can’t search. Tonight every courier in the tiers carries one honest night toward one broadcast — and everyone in the city wakes up able to forgive each other for exactly one minute. I have seen the math, courier. One minute is load-bearing.'],
          ['me', 'And the pilot key is the courier nobody was allowed to delete. My enlistment slice. Which is in my implant. Riding. Humming.'],
          ['ardent', 'Yours. Return it, and the Protocol rests until someone worth less tries again. Or turn it. The choice was always going to be yours — I needed a courier whose deliveries already change them. That’s the certification, not the gun.'],
        ],
        then: 'f_end',
      },
      f2b: {
        lines: [
          ['ardent', '“Keep copies.” You can tell a remembered moment from an invented one and you STILL let me sell you the better version of yourself? Good. The Protocol needs couriers who check. Sit. I’ll show you the engine instead of the brochure.'],
          ['sys', 'He shows you the engine: a rack of courier hums, every sealed mind in the tiers, arranged like a chord.'],
        ], then: 'f_end',
      },
      f2c: {
        lines: [
          ['ardent', '“Why.” …Nobody has asked me “why” since the founding, and the founding was a typo. Why: because I built the Protocol to be a mercy and ran the numbers on mercy in a city of vertical weather, and it needs a person who keeps failing the job by succeeding at it. You carried grief to a widow and a fire to a future. That’s not logistics. That’s a proof of concept with a pulse.'],
        ], then: 'f_end',
      },
      f_end: {
        lines: [
          ['sys', 'THE VAULT OF SELVES is below us — nine floors down, above the rain line. Your own memory is filed like evidence in the only place nobody can subpoena: a courier who refuses to know where.'],
        ],
        then: 'END',
      },
    },
  },

  vault: {
    chapter: 3, bg: 'vault', title: 'THE VAULT OF SELVES · FILED UNDER: YOU',
    start: 'v0',
    nodes: {
      v0: {
        lines: [
          ['sys', 'The vault door is a question in nine languages. Your implant translates none of them and simply… stands differently.'],
        ],
        choices: [
          { t: 'Knock in the warden’s cipher. You picked it up in a life you can’t bill for.', tag: 'GHOST KEY', need: { skill: 'ghost_key' }, then: 'v1k' },
          { t: 'Ask the door who else has been carrying this long. (Empathy opens hinges too.)', tag: 'EMPATHY 5', need: { trait: { empathy: 5 } }, then: 'v1e' },
          { t: 'Shoulder it. The city files force under “policy.”', tag: 'DEFIANCE 5', need: { trait: { defiance: 5 } }, then: 'v1d' },
          { t: 'Stand in front of it until it realizes you’re both on duty.', then: 'v1p' },
        ],
      },
      v1k: { lines: [['sys', 'KNOCK-KNOCK-PAUSE. The door laughs mechanically and opens like it’s been waiting to be addressed properly.']], then: 'v2' },
      v1e: { lines: [['sys', 'You ask it about its day. The vault has never been asked. Its hinges decide this is a working relationship.']], then: 'v2' },
      v1d: { lines: [['ardent', 'You — that door is a legal instrument. …It opened anyway. I’m updating the brochure to say “policy.”']], then: 'v2' },
      v1p: { lines: [['sys', 'Eleven minutes of two people refusing to blink. The door yields on minute twelve; you were also waiting to see which one of you would.']], then: 'v2' },
      v2: {
        lines: [
          ['sys', 'FILED: SEALED SLICE — COURIER [REDACTED]. It rides out of the rack and into your hum like it never left, which is, of course, how the file describes it: “never left; formerly mislabeled.”'],
          ['kess', '…hi. It’s the same room in here. The chair survived.'],
          ['me', 'Kess. Your name isn’t a stowaway’s name. You’re not the courier who got folded away. You’re the child who watched a courier get folded away and decided to stay useful.'],
          ['kess', 'Forty-one minutes a day, every life: leaving the lamp on, so someone gets the best light on it. You didn’t delete a witness. You filed a witness.'],
        ],
        fx: { gain: 'own_slice', flag: { self_known: true } },
        then: 'END',
      },
    },
  },

  slice: {
    chapter: 3, bg: 'vault', title: 'RELIVING · ENLISTMENT DAY, IN YOUR HANDS',
    start: 's1',
    nodes: {
      s1: {
        lines: [
          ['sys', 'ENLISTMENT DAY. A young you signs the courier contract and reads the clause: “one (1) foundational memory may be sealed for liability.” The clerk — who has your current face in an older, meaner light — asks which one.'],
          ['you', 'I pick the morning I decided to be useful. If I’m going to carry everyone else’s weather, I’d rather not have my own forecast in here.'],
          ['sys', 'The seal takes. A seven-year-old in the hallway outside picks up everything you put down, because that is what children do. Her name is going to be Kess.'],
        ],
        choices: [
          { t: 'Take it back. All of it. Become the whole, unbearable ledger.', tag: 'RELIC 5', need: { trait: { relic: 5 } }, then: 's_take', fx: { trait: { relic: 2 }, flag: { self_taken: true }, scar: 'You opened your own seal. The hinge held. Barely.' } },
          { t: 'Leave it sealed — but not deleted. You can visit a file. You can even say good morning to it.', then: 's_visit', fx: { trait: { empathy: 1 }, flag: { self_visited: true } } },
          { t: 'Copy yourself. Keep the courier; hand the child her own morning. (Yes. THIS is what a copy is for.)', tag: 'EMPATHY 5', need: { trait: { empathy: 5 } }, then: 's_give', fx: { trait: { empathy: 2 }, flag: { self_given: true }, skill: 'choir_static', scar: 'Gave a seven-year-old the morning you were too brave to keep.' } },
        ],
      },
      s_take: {
        lines: [
          ['sys', 'UNSEALED. You are every weather at once and the hum stops being plural. Somewhere below, a market that forgot itself remembers, briefly, kindly, entirely through your ears.'],
          ['kess', '…the chair is gone. It’s just — the room. It was always going to be just the room. Hi. For real, now. Hi.'],
        ], then: 's_end',
      },
      s_visit: {
        lines: [
          ['sys', 'SEALED · VISITABLE. It becomes the door you check on Tuesdays. The file, for its part, starts leaving the light on.'],
          ['kess', 'That’s the first time I’ve been a room with a window instead of a wall. I’ll… I’ll put out a cup.'],
        ], then: 's_end',
      },
      s_give: {
        lines: [
          ['sys', 'COPY — NOT FOR THE FILE. FOR THE HALLWAY. You hand the seven-year-old a morning in your own handwriting. She takes it the way everyone takes weather from you: like it was always the forecast.'],
          ['kess', 'You always did leave the lamp on. EVERY life. …I can see it from here. It has the best light on it.'],
        ], then: 's_end',
      },
      s_end: {
        lines: [['sys', 'TIER ONE, THE RAIN ROOFS. Ardent is waiting with the broadcast window open like a held breath. Whatever you are now, you arrive as it.']],
        then: 'END',
      },
    },
  },

  final: {
    chapter: 3, bg: 'roof', title: 'THE BROADCAST ROOF · ONE MINUTE OF WEATHER',
    start: 'z1',
    fx: { flag: { ch3_done: true } },
    nodes: {
      z1: {
        lines: [
          ['ardent', 'The rack is tuned. Every courier hum in the tiers, aligned. Turn the pilot key and the city gets one minute where every delivered truth is everyone’s — the Lumen Protocol. You get… whatever you were always going to get. Choose like you mean it. Somebody filed a quote under that.'],
        ],
        choices: [
          {
            t: 'RETURN THE KEY. Give Ardent the protocol’s engine; let the city keep its polite weather. The courier keeps carrying. The courier stops being carried.',
            then: 'z_return', fx: { flag: { ending: 'returned' }, skillRemove: 'choir_static', trait: { lucidity: 1 }, scar: 'You handed back the one memory that would have made you legible to everyone. You kept being one person instead. That is the harder superpower.' },
          },
          {
            t: 'INTEGRATE. Turn no key — turn yourself. You become the Choir the city already suspects you are: every sealed mind you carried, heard, all at once, at courier volume, from you.',
            tag: 'RELIC 6', need: { trait: { relic: 6 } },
            then: 'z_choir', fx: { flag: { ending: 'choir' }, trait: { relic: 1 }, scar: 'You integrated. The hum is load-bearing for the whole tier now, and it sounds almost like weather.' },
          },
          {
            t: 'BROADCAST. The city gets its minute. Everybody’s grief, delivered to everybody, once. The tier learns what Sera learned; the tier is not Sera; that’s either the point or the risk. Take the job.',
            tag: 'EMPATHY 6', need: { trait: { empathy: 6 } },
            then: 'z_broadcast', fx: { flag: { ending: 'broadcast' }, trait: { empathy: 2, relic: 1 }, scar: 'You broadcast one honest minute into a vertical city. The rain took the rest of the shift.' },
          },
          {
            t: 'GLITCH IT. Copy yourself into the broadcast instead of the city — everyone gets your deliveries, nobody gets the pilot, the Protocol runs on mercy and can never be audited, because you filed yourself where nothing can subpoena it.',
            tag: 'DEFIANCE 6', need: { trait: { defiance: 6 } },
            then: 'z_glitch', fx: { flag: { ending: 'glitch' }, trait: { defiance: 1 }, scar: 'You turned the Lumen Protocol into a courier rumor: load-bearing, unauditable, kind.' },
          },
        ],
      },
      z_return: {
        lines: [
          ['sys', 'THE KEY GOES BACK LIKE A TAB CLOSED. Ardent pockets one minute forever and files you, correctly, under “force of nature, declined.”'],
          ['kess', '…the apartment’s just an apartment again. I’m just a voice that got to watch. Do you regret making room for me at all?'],
          ['me', 'Regret is a file I left unsealed, Kess. No. Obviously no. The lamp stays on.'],
        ], then: 'z_end',
      },
      z_choir: {
        lines: [
          ['sys', 'YOU TURN YOURSELF INTO THE ANTENNA. The rack reads you as one of its own — all of its own, in fact — and the Protocol, finding no key, simply uses the door that is already standing open: you.'],
          ['sys', 'The tiers hear their own weather in plural, tonight, and nobody can bill it. Somewhere Sera laughs with three mouths of memory and none of the debt.'],
        ], then: 'z_end',
      },
      z_broadcast: {
        lines: [
          ['sys', 'SIXTY SECONDS. Every courier hum in the city goes live at once. A priest gets a widow’s morning; a sister gets a fishmonger’s timing; a clerk gets a child in a hallway. The minute ends. Nobody can prove it happened except everyone.'],
          ['ardent', '…the math was load-bearing. It was load-bearing and it was still the least of what you did with it. Good delivery, courier. Best of the year. Of the century. I’m writing that in the file like it matters to you.'],
        ], then: 'z_end',
      },
      z_glitch: {
        lines: [
          ['sys', 'COPY YOURSELF. Every resident of the city gets a courier: the habit of carrying truth in better light, unauditable because it’s filed as folklore. The Protocol runs. The Protocol can’t be run. Ardent audits his own brochure for a week.'],
          ['kess', 'So we’re both. Everywhere. In everyone, small and load-bearing. Do you know what the tiers will call a rumor that leaves the light on?'],
          ['me', 'Morning.'],
        ], then: 'z_end',
      },
      z_end: {
        lines: [['sys', 'THE RAIN LOGS BACK. Your final receipt prints itself on the inside of the sky and immediately decides not to bill anyone. The Lumen Protocol files this night under: DELIVERED.']],
        then: 'END',
      },
    },
  },
};

/* ------------------------------------------------------------- epilogue -- */
export function buildEpilogue(g) {
  const cards = [];
  const f = g.flags;
  const t = g.traits;
  cards.push({
    who: 'SER', head: 'SERA · THE DROWNED LANTERN',
    body:
      f.sera_whole ? 'She got him whole. She keeps the bar open late now, on purpose, the way a lighthouse keeps a light — for weather, for strangers, for anyone who needs a room where grief is the house specialty and no one charges for it.' :
      f.sera_seam ? 'She felt the seam in the copy — “it loves me a little less for being watched over” — and forgave the universe anyway, out loud, nightly. The bar has a shelf for mornings. It’s labeled: NOT FOR SALE, EXCEPT TO EACH OTHER.' :
      f.sera_forge ? 'The morning you assembled out of blanks is her favorite morning. She tells the story of it better than anyone. The sun in it is guilty and she forgives it, and the forgery forgives her, and the ledger is closed in a column nobody audits.' :
      'The bar still smells like a river pretending to be a bar. Sera still sets two cups for the forty-one minutes she owns. Somewhere, a courier keeps hers honest, and that is the whole ending; that is plenty.',
  });
  const ver = f.fire_ver;
  cards.push({
    who: 'FIR', head: 'THE LANTERN FIRE · AS FILED',
    body:
      ver === 'arson' ? 'The corp got a plaintiff with a lamp for evidence. Sera grieves like a litigant now — forward, documented, occasionally winning. The cult’s candles relit themselves out of professional embarrassment.' :
      ver === 'accident' ? 'Nobody is a monster; everybody is a warning. Quill preaches flammability as a virtue and means it, and the market rebuilt around a shrine of melted lanterns that accepts donations in the form of testimony.' :
      ver === 'alive' ? 'Dren came out of the file into the bar, at closing, with the carp scaled and salted and his own mouth. What Sera felt for him now is unlabeled and load-bearing and, in the end, the closest thing either of them has to a morning.' :
      ver === 'weave' ? 'Three truths, one roof. The tier believes all of them simultaneously, like weather, like lore. On dark nights the market smells of candles, accelerant, and carp — and everyone forgives the rain for the whole list.' :
      ver === 'triple' ? 'Sera chose from raw testimony and chose correctly the way only an owner can: she now keeps three copies of that night, none of them mine, and none of them wrong. The Guild has stopped filing that address.' :
      'The fire rides a courier indefinitely, accruing interest against a future nobody can bill. Held truth is still load-bearing. Ask the roof.',
  });
  if (f.frag_ilo || f.frag_quill || f.frag_dren) {
    cards.push({
      who: 'MAR', head: 'TIER 38 · THE STALLS',
      body: (f.ilo_warm ? 'Ilo sets out a cup for whoever asks about flags. ' : 'Ilo no longer sorts her own grief; she sells it, certified. ') +
        (f.quill_confessed ? 'Quill’s sermons have gotten shorter and truer; the candles gutter like applause. ' : 'The candles gutter on schedule, rent-free. ') +
        (f.dren_asks ? 'And the fishmonger feeds the carp better now — they’re the only witnesses left who are honest about being dead.' : 'The carp remain rude. The market remains open late. It’s the only tier where night has a floor plan.'),
    });
  }
  cards.push({
    who: 'KES', head: 'KES · THE HALLWAY, THEN THE HUM',
    body:
      f.kess_named ? 'You named her on the way up, so the apartment has a window now. The cup she puts out is warm by the time you remember to notice. She has opinions about the whole evening, all of the time, and the whole evening keeps deserving them.' :
      f.kess_pushed ? 'Cold storage got a chair, then a shelf, then a whole morning you keep forgetting to unseal — and on Tuesdays, a light left on. She files it under: visitable.' :
      f.self_given ? 'You handed the seven-year-old her own morning. She took it the way everyone takes weather from a courier: like it was always the forecast. Somewhere in the hum, the lamp is on. It is always going to be on. That was the deal, and it is load-bearing.' :
      'She waits in the part of you that doesn’t bill. Named or not, the stowaway keeps the log: forty-one minutes a day, every life, leaving the light on.',
  });
  cards.push({
    who: 'YOU', head: 'THE COURIER · FINAL CALIBRATION',
    body:
      (f.ending === 'returned' ? 'The Protocol rests. You keep carrying, which turns out to be the only superseding power: one person, legible to no one, load-bearing anyway.' :
        f.ending === 'choir' ? 'The city hears its own weather through you, in plural, at courier volume. Ardent retires the brochure and starts a candle.' :
        f.ending === 'broadcast' ? 'The minute holds. Nobody can prove it — everyone can. The tiers have begun greeting each other with the phrase “was that you?” and meaning it kindly.' :
        f.ending === 'glitch' ? 'The Protocol runs on folklore now: unauditable, distributed, kind. Ardent’s audit came back signed in everyone’s handwriting. The city calls a rumor that leaves the light on “morning.”' :
        'Whatever the Protocol became, you stayed a courier: the habit of carrying truth in better light. The file on you closes itself and files itself back out, stamped: DELIVERED.') +
      `  [EMPATHY ${t.empathy} · LUCIDITY ${t.lucidity} · DEFIANCE ${t.defiance} · RELIC ${t.relic}]`,
  });
  return cards;
}
