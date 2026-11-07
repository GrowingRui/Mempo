// Hand-made corrections to the automatic inflection merge in scrape.ts.
// Use word ids: the slug of the headword or of any spelling variant, e.g. "carbon-dioxide".
// Check data/reports/phase0.md after each run and add words here as needed.

/** Words that look like an inflection of another listed word but deserve their own card. */
export const KEEP_SEPARATE = new Set<string>([
  // Plurals with a meaning of their own
  'savings', // money saved
  'nerves', // anxiety ("pre-exam nerves")
  'premises', // a building and its land
  'proceedings', // legal action; events
  'provisions', // food supplies; legal clauses
  'overalls', // a garment
  'shambles', // a mess
  'acoustics', // sound quality of a room
  'acrobatics', // the activity
  'coordinates', // map position
  'guts', // courage
  'statistics', // the subject
  'ethics', // moral principles; the subject
  'dynamics', // forces / how a group behaves
  'odds', // probability
  'computing', // the field
  'biased', // adjective, more common than the verb
  // The suffix rule would attach these to "aide" (an assistant); their base "aid" is not listed.
  'aided',
  'aiding',
]);

/** Words the automatic rule keeps separate but that are only an inflected form. */
export const MERGE = new Set<string>([
  'beneficiaries', // plain plural; listed at C1 while the singular is C2
  'methodologies',
]);
