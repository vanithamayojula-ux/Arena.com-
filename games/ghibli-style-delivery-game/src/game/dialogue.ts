import type { Look } from "./characters";

export interface ClientDef {
  name: string;
  look: Look;
  idle: string[];
}

export const CLIENT_DEFS: ClientDef[] = [
  { name: "Granny Willow", look: { skin: "#f2d0b5", hair: "#e8e4dc", hairStyle: 3, shirt: "#9b7bb0", pants: "#6b5a7a", dress: true, glasses: true }, idle: ["The wind smells like rain.", "Mind the cobbles, dear!"] },
  { name: "Baker Nell", look: { skin: "#f4c9a4", hair: "#b0602f", hairStyle: 1, shirt: "#e8a34f", pants: "#7a5236", apron: "#fffaf0", dress: true }, idle: ["Fresh bread at dawn!", "Smell that? Melon buns."] },
  { name: "Professor Kettle", look: { skin: "#eac3a0", hair: "#9a9a9a", hairStyle: 4, shirt: "#5b6e5a", pants: "#4b4238", glasses: true, beard: "#d5d2cc" }, idle: ["Clouds are just slow rivers.", "Hmm? Oh, hello!"] },
  { name: "Rosa the Florist", look: { skin: "#f0c7a7", hair: "#d0543b", hairStyle: 2, shirt: "#f19aa8", pants: "#7a4a5a", dress: true, hat: { color: "#f6e27a", type: "straw" } }, idle: ["The poppies bloomed!", "Take a daisy for luck."] },
  { name: "Captain Gull", look: { skin: "#d9a882", hair: "#3b3b3b", hairStyle: 0, shirt: "#2f4f7a", pants: "#26324a", beard: "#5a5a5a", hat: { color: "#26324a", type: "cap" } }, idle: ["Fair winds, lad!", "The river runs to the sea."] },
  { name: "Little Hana", look: { skin: "#f7d6bd", hair: "#2b2321", hairStyle: 1, shirt: "#e75a4b", pants: "#f2c94c", dress: true, hat: { color: "#ffffff", type: "bow" }, scale: 0.85 }, idle: ["Have you seen a big fluffy cat?", "I found an acorn!"] },
  { name: "Madame Plume", look: { skin: "#f3d2b8", hair: "#3a2a4a", hairStyle: 3, shirt: "#6c4a8a", pants: "#3a2a4a", dress: true, hat: { color: "#c0435a", type: "beret" } }, idle: ["Ah, the post! Magnifique.", "I write poems for the pigeons."] },
  { name: "Inventor Pip", look: { skin: "#e7bf9c", hair: "#e0b13a", hairStyle: 0, shirt: "#8a6a4a", pants: "#4a4a4a", glasses: true, apron: "#6e5a46" }, idle: ["My flying machine almost works!", "Gears, springs, a little hope."] },
  { name: "Grandpa Oak", look: { skin: "#dcb08c", hair: "#f0f0f0", hairStyle: 4, shirt: "#6b8f5a", pants: "#5a4a3a", beard: "#f0f0f0", hat: { color: "#d9c27a", type: "straw" } }, idle: ["My tomatoes are winning.", "Slow down, son. Look up!"] },
  { name: "Theo the Painter", look: { skin: "#f1cba9", hair: "#6a3b25", hairStyle: 1, shirt: "#4f8aa8", pants: "#3b3b4b", hat: { color: "#2f2f3f", type: "beret" } }, idle: ["The light is perfect today.", "Can you hold still? No? Fine."] },
  { name: "Aunt Clementine", look: { skin: "#eec4a1", hair: "#d98a3a", hairStyle: 3, shirt: "#e9c46a", pants: "#7a6a3a", dress: true, apron: "#9fc5a8" }, idle: ["Jam season is coming!", "You look thin. Eat something!"] },
  { name: "Fisherman Ivo", look: { skin: "#c99a76", hair: "#2a2a2a", hairStyle: 0, shirt: "#4a7a6a", pants: "#3a4a4a", beard: "#2a2a2a", hat: { color: "#c9a75a", type: "straw" } }, idle: ["Caught nothing. Again.", "The fish are shy today."] },
  { name: "Miss Juniper", look: { skin: "#f5d5c0", hair: "#1f1a24", hairStyle: 2, shirt: "#5e9e8a", pants: "#2f4f4a", dress: true }, idle: ["Is that a letter for me?", "I'm reading by the window."] },
  { name: "Old Tobias", look: { skin: "#e2b996", hair: "#bdbdbd", hairStyle: 0, shirt: "#8a4a3a", pants: "#4a3a3a", glasses: true, hat: { color: "#4a3a3a", type: "cap" } }, idle: ["Back in my day, we walked uphill.", "Good lad. Good lad."] },
  { name: "Sora", look: { skin: "#f6d0b0", hair: "#5a7ab0", hairStyle: 1, shirt: "#ffffff", pants: "#3f5f8a", dress: true }, idle: ["I want to fly someday.", "The sky looks endless."] },
  { name: "Mister Barnaby", look: { skin: "#eab995", hair: "#7a4a2a", hairStyle: 0, shirt: "#a85a4a", pants: "#3a3a4a", beard: "#7a4a2a", apron: "#5a4a3a" }, idle: ["Need a shoe fixed?", "Every step tells a story."] },
  { name: "Lily & Lou", look: { skin: "#f7d8c2", hair: "#e8c26a", hairStyle: 2, shirt: "#9ad1d4", pants: "#5a8a8a", dress: true, scale: 0.85 }, idle: ["We're twins! Well, one of us is.", "Tag! You're it!"] },
  { name: "Signora Bianca", look: { skin: "#efc9a8", hair: "#2a1a1a", hairStyle: 3, shirt: "#c9573f", pants: "#5a2a2a", dress: true, glasses: true }, idle: ["Mamma mia, what a day.", "Come by for tea sometime!"] },
  { name: "Doctor Fenn", look: { skin: "#ddb18f", hair: "#4a4a4a", hairStyle: 0, shirt: "#e8e8e0", pants: "#4a5a6a", glasses: true }, idle: ["Drink water, young man.", "Don't run too fast!"] },
  { name: "Mira the Witch", look: { skin: "#f4d2b9", hair: "#2a2030", hairStyle: 2, shirt: "#2f2a3f", pants: "#2f2a3f", dress: true, hat: { color: "#d0543b", type: "bow" } }, idle: ["My broom is in the shop.", "The cat says hello."] },
];

export interface Reply {
  text: string;
  q: 0 | 1 | 2; // 0 awkward, 1 polite, 2 heartfelt
  react: string;
}
export interface Prompt {
  line: string;
  replies: Reply[];
}

export const PROMPTS: Prompt[] = [
  {
    line: "Oh! Is that from my grandson? He hasn't written in ages!",
    replies: [
      { text: "He must miss you terribly!", q: 2, react: "Oh, you sweet boy!" },
      { text: "Sign here, please.", q: 1, react: "Ah... yes, of course." },
      { text: "Maybe he forgot you.", q: 0, react: "...Well, I never!" },
    ],
  },
  {
    line: "A letter? I hope it's not another bill...",
    replies: [
      { text: "It smells like perfume—surely not a bill!", q: 2, react: "Hee hee! A secret admirer?" },
      { text: "I just deliver them, sorry!", q: 1, react: "Fair enough." },
      { text: "It's definitely a bill.", q: 0, react: "Ugh. Thanks." },
    ],
  },
  {
    line: "You're out of breath! Did you run all the way here?",
    replies: [
      { text: "For you? Of course I ran!", q: 2, react: "Ha! What a charmer!" },
      { text: "The wind pushed me along.", q: 1, react: "Lucky wind!" },
      { text: "Your house is too far.", q: 0, react: "Hmph. Sorry, I guess." },
    ],
  },
  {
    line: "Seeds from the mountain village! My garden will be so happy.",
    replies: [
      { text: "I can't wait to see them bloom!", q: 2, react: "I'll save you a flower!" },
      { text: "Seeds are nice.", q: 1, react: "They are, aren't they?" },
      { text: "Gardening sounds boring.", q: 0, react: "...Oh." },
    ],
  },
  {
    line: "It's my birthday today, you know. Nobody remembered...",
    replies: [
      { text: "Happy birthday! This letter remembered!", q: 2, react: "You made my whole day!" },
      { text: "Oh, many happy returns.", q: 1, react: "Thank you, dear." },
      { text: "That's rough. Bye!", q: 0, react: "...Bye." },
    ],
  },
  {
    line: "Lovely weather for flying, isn't it? The clouds are like castles.",
    replies: [
      { text: "Maybe there's a city up there!", q: 2, react: "Oh, I hope so!" },
      { text: "It's quite nice, yes.", q: 1, react: "Mm-hm." },
      { text: "Clouds are just water.", q: 0, react: "Where's the magic in that?" },
    ],
  },
  {
    line: "Is this from the sea? I can almost hear the waves in the envelope.",
    replies: [
      { text: "Hold it to your ear—maybe gulls!", q: 2, react: "Ha ha! I hear them!" },
      { text: "It came on the morning boat.", q: 1, react: "Ah, the morning boat." },
      { text: "Envelopes can't make noise.", q: 0, react: "Killjoy." },
    ],
  },
  {
    line: "My cat ran off this morning. Have you seen a fat orange one?",
    replies: [
      { text: "I'll keep my eyes open on my route!", q: 2, react: "Bless you, postman!" },
      { text: "Cats come home eventually.", q: 1, react: "I suppose so..." },
      { text: "Cats are all the same to me.", q: 0, react: "How rude!" },
    ],
  },
  {
    line: "I baked too many cookies. Would you like one?",
    replies: [
      { text: "I'd love one, thank you!", q: 2, react: "Take two, growing boy!" },
      { text: "Maybe after my route.", q: 1, react: "I'll save it for you." },
      { text: "No time for cookies.", q: 0, react: "Suit yourself..." },
    ],
  },
  {
    line: "A letter from my old friend overseas! We haven't spoken in years.",
    replies: [
      { text: "Real friends are never truly far.", q: 2, react: "That's beautiful... thank you." },
      { text: "It came a long way.", q: 1, react: "It certainly did!" },
      { text: "Years? Yikes.", q: 0, react: "...Yes. Yikes." },
    ],
  },
  {
    line: "I'm so nervous—this could be about my application to art school!",
    replies: [
      { text: "Whatever it says, your art is wonderful!", q: 2, react: "You really think so?!" },
      { text: "Good luck!", q: 1, react: "Thanks, I need it!" },
      { text: "Art school is expensive.", q: 0, react: "Way to help, thanks." },
    ],
  },
  {
    line: "Do you ever get tired, walking the whole city every day?",
    replies: [
      { text: "Never! Every street has a story.", q: 2, react: "What a lovely way to see it." },
      { text: "Sometimes, but it's fine.", q: 1, react: "Rest when you can!" },
      { text: "My feet are killing me.", q: 0, react: "Er... sorry to hear." },
    ],
  },
  {
    line: "Oh dear, the rain last night soaked my laundry...",
    replies: [
      { text: "The sun will dry it by noon!", q: 2, react: "Optimist! I like it." },
      { text: "That happens.", q: 1, react: "It does, I suppose." },
      { text: "Should've checked the sky.", q: 0, react: "Thanks for the tip. Hmph." },
    ],
  },
  {
    line: "I wrote my first song! Do you want to hear it someday?",
    replies: [
      { text: "Yes! Play it for the whole street!", q: 2, react: "Ahh! Okay, I will!" },
      { text: "Maybe someday.", q: 1, react: "Someday, then!" },
      { text: "I'm more of a quiet type.", q: 0, react: "Oh. Okay." },
    ],
  },
  {
    line: "A parcel! Heavy, too. You carried this all the way?",
    replies: [
      { text: "Light as a feather for a good neighbor!", q: 2, react: "You're too kind!" },
      { text: "Just doing my job!", q: 1, react: "And doing it well." },
      { text: "My back hurts now.", q: 0, react: "Oh... um, sorry?" },
    ],
  },
  {
    line: "Have you heard? They say a spirit lives in the big camphor tree.",
    replies: [
      { text: "I'll leave it an acorn on my way!", q: 2, react: "Ho ho! It'll like that!" },
      { text: "Really? Interesting.", q: 1, react: "Isn't it?" },
      { text: "Spirits aren't real.", q: 0, react: "Shh! It'll hear you!" },
    ],
  },
  {
    line: "My daughter is getting married! This must be the invitation reply.",
    replies: [
      { text: "Congratulations! What wonderful news!", q: 2, react: "Thank you! You must come!" },
      { text: "That's nice.", q: 1, react: "It is, it is!" },
      { text: "Weddings are so expensive.", q: 0, react: "...Don't remind me." },
    ],
  },
  {
    line: "I haven't left the house in days. How's the city today?",
    replies: [
      { text: "The bakery smells divine—come walk with me!", q: 2, react: "Maybe I will!" },
      { text: "Busy, as usual.", q: 1, react: "Ah, the bustle." },
      { text: "Same old, same old.", q: 0, react: "How dreary." },
    ],
  },
];

export const QUALITY_LABEL = ["Awkward...", "Polite", "Heartfelt!"];
