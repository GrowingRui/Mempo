// Notes for offensive and sensitive words, shown on the card so a learner knows what the word
// means, why it can hurt, and what to say instead. Keyed by word id (see data/raw.json).
//
// These words stay in the vocabulary on purpose (PLAN.md, decision 5): a learner will meet them
// in films, books and the news and needs to understand them.
// The report (data/reports/phase1.md) lists words whose Wiktionary senses are labelled offensive,
// vulgar or derogatory. Most of those are false alarms (one rare slang sense of "plumber" or
// "rainbow"), so only words a learner really should be warned about are here.
//
// level:
//   offensive  the word itself is a slur or insult. "Offensive" tag on the front of the card.
//   careful    a normal word with a rude, vulgar or hurtful use. Note on the back only.
// Style: plain English for a B2 learner, 1-3 short sentences: what is offensive, how strong, what to say instead.

export interface SensitiveNote {
  level: 'offensive' | 'careful';
  note: string;
}

export const SENSITIVE: Record<string, SensitiveNote> = {
  // ---------------------------------------------------------------- offensive
  gook: {
    level: 'offensive',
    note: 'This word has two meanings. Informally it means sticky dirt ("gunk"). But it is also a very offensive racist slur for people from East and Southeast Asia, used by American soldiers in the Korean and Vietnam Wars. Say "gunk" or "goo" for dirt, and never use it about people.',
  },
  retard: {
    level: 'offensive',
    note: 'As a noun for a person ("a retard") it is a very offensive insult for someone with an intellectual disability, or for anyone seen as stupid. Say "a person with an intellectual disability". The verb "to retard" (to slow something down) is formal and not offensive.',
  },
  cripple: {
    level: 'offensive',
    note: 'As a noun for a disabled person ("a cripple") it is offensive and old-fashioned; say "a disabled person" or "a wheelchair user". The verb is fine: "The strike crippled the economy" means it badly damaged it.',
  },
  gypsy: {
    level: 'offensive',
    note: 'An old name for the Roma people. Many Roma find it offensive, because it has been used with prejudice for centuries; say "Roma" or, in Britain, "Gypsy and Traveller communities" as they call themselves. It also appears in fixed phrases like "gypsy jazz".',
  },

  // ---------------------------------------------------------------- careful: hurtful about people
  queer: {
    level: 'careful',
    note: 'For a long time an insult for gay people. Today many LGBTQ+ people use it proudly about themselves ("queer culture", "queer studies"), but as an insult it still hurts. The old meaning "strange" sounds old-fashioned.',
  },
  dwarf: {
    level: 'careful',
    note: 'Fine for creatures in stories and for stars and plants ("a dwarf planet"). Calling a person "a dwarf" can be hurtful; say "a person with dwarfism".',
  },
  lame: {
    level: 'careful',
    note: 'The meaning "unable to walk well" is old-fashioned and can offend disabled people. In slang, "lame" means boring or weak ("a lame excuse"); many people avoid it for the same reason.',
  },
  dumb: {
    level: 'careful',
    note: 'The meaning "unable to speak" is old-fashioned and offensive; say "non-speaking" or "unable to speak". "Dumb" meaning "stupid" is informal and rude when said about a person.',
  },
  idiot: {
    level: 'careful',
    note: 'An insult: calling someone an idiot is rude. It was once a medical term for a person with an intellectual disability, which is no longer used.',
  },
  freak: {
    level: 'careful',
    note: 'Calling a person "a freak" because they look or act differently is an insult. In phrases like "a fitness freak" or "a control freak" it means someone who is very keen on something, and is informal but not as strong.',
  },
  fat: {
    level: 'careful',
    note: 'Saying a person is "fat" is usually rude. People say "big", "overweight" or "plus-size" instead. It is fine for food ("low-fat milk").',
  },
  alien: {
    level: 'careful',
    note: 'In law, "alien" means a person who is not a citizen. Many people find "illegal alien" dehumanising; news writers often say "undocumented migrant" instead.',
  },
  ghetto: {
    level: 'careful',
    note: 'The historical meaning (a part of a city where Jews were forced to live, as in the Warsaw Ghetto) is not offensive. As a slang adjective meaning "cheap" or "low-class" ("That\'s so ghetto") it is offensive and racist.',
  },
  tramp: {
    level: 'careful',
    note: 'An old-fashioned word for a homeless person; today people say "a homeless person". In American English it was also an insult for a woman, suggesting she has many sexual partners.',
  },
  bum: {
    level: 'careful',
    note: 'In British English it is an informal word for your bottom, used jokingly. In American English "a bum" is an insulting word for a homeless or lazy person.',
  },
  peasant: {
    level: 'careful',
    note: 'Neutral when talking about farm workers in history or in poor countries. Calling someone a peasant today is an insult meaning rude or uneducated.',
  },
  tinker: {
    level: 'careful',
    note: 'The verb "to tinker" (to make small repairs or changes) is fine. As a noun for a person it was used for Irish Travellers, and in Britain and Ireland it is now considered offensive.',
  },
  heifer: {
    level: 'careful',
    note: 'A normal farming word for a young cow. Used about a woman, mostly in American slang, it is an offensive insult about her weight.',
  },
  coconut: {
    level: 'careful',
    note: 'The fruit is fine. As slang for a person ("brown on the outside, white on the inside") it is a racist insult, so you may meet it in news stories about racism.',
  },

  // ---------------------------------------------------------------- careful: swearing and vulgar uses
  bloody: {
    level: 'careful',
    note: 'Its first meaning, covered in blood ("a bloody battle"), is fine. In British and Australian English "bloody" is also a mild swear word for emphasis ("It\'s bloody cold"): common in casual speech, but avoid it at work or in writing.',
  },
  damn: {
    level: 'careful',
    note: 'A mild swear word ("Damn! I missed the bus", "I don\'t give a damn"). Common in films and casual speech, but avoid it in formal situations.',
  },
  hell: {
    level: 'careful',
    note: 'Fine for the religious place and for "a hell of a time". Phrases like "What the hell?" or "Go to hell!" are mild swearing and can sound rude.',
  },
  screw: {
    level: 'careful',
    note: 'Fine for the metal pin and the verb "screw in". Slang uses are vulgar: "screw" can mean to have sex, and "Screw you!" is rude. "To screw up" (to make a mistake) is informal but common.',
  },
  suck: {
    level: 'careful',
    note: '"It sucks" (it is bad) is very common but informal and a little rude; don\'t use it in formal writing. Some slang uses of "suck" are sexual and vulgar.',
  },
  prick: {
    level: 'careful',
    note: 'Fine for a small hole or a sharp feeling ("the prick of a needle"). "A prick" said about a man is a vulgar insult.',
  },
  rape: {
    level: 'careful',
    note: 'A serious crime. Use it only in that meaning; jokes like "we got raped in the match" are very offensive and hurt survivors.',
  },
};
