/**
 * Deterministic synthetic movie-style dataset.
 *
 * generateDataset(seed, total) always yields the same records for the same
 * inputs: a handful of hand-written anchor titles followed by procedurally
 * assembled titles, loglines, genres, years, ratings and popularity scores.
 */
import type { SearchRecord } from '../../src/engine/types.ts'
import { anchorRecords } from './anchors.ts'
import { Rng } from './rng.ts'

export const GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy',
  'History', 'Horror', 'Music', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western',
] as const

const ADJECTIVES = [
  'Silent', 'Crimson', 'Hollow', 'Last', 'Broken', 'Golden', 'Quiet', 'Burning', 'Frozen', 'Wicked', 'Velvet', 'Distant',
  'Electric', 'Paper', 'Iron', 'Glass', 'Midnight', 'Restless', 'Lonely', 'Savage', 'Gentle', 'Neon', 'Ancient', 'Bitter',
  'Wild', 'Pale', 'Scarlet', 'Endless', 'Forgotten', 'Perfect', 'Little', 'Strange', 'Dark', 'Bright', 'Blue', 'Hidden',
  'Secret', 'Rusted', 'Sacred', 'Cold', 'Slow', 'Loud', 'Northern', 'Southern', 'Wandering', 'Fearless', 'Faithful', 'Empty',
]

const NOUNS = [
  'Harbor', 'Orchard', 'Signal', 'Lantern', 'Compass', 'Cathedral', 'Machine', 'Garden', 'Kingdom', 'River', 'Hunter', 'Empire',
  'Horizon', 'Shadow', 'Engine', 'Voyage', 'Winter', 'Summer', 'Fortress', 'Passenger', 'Detective', 'Astronaut', 'Thief',
  'Orphan', 'Stranger', 'Witness', 'Colony', 'Frontier', 'Labyrinth', 'Comet', 'Meridian', 'Parade', 'Circus', 'Lighthouse',
  'Archive', 'Clockwork', 'Vineyard', 'Tundra', 'Canyon', 'Monsoon', 'Whisper', 'Rebellion', 'Requiem', 'Serenade', 'Carnival',
  'Bridge', 'Station', 'Tower', 'Island', 'Mirror', 'Letter', 'Promise', 'Debt', 'Verdict', 'Heist', 'Echo', 'Storm', 'Ember',
  'Satellite', 'Pilgrim', 'Gambit', 'Cipher', 'Anthem', 'Odyssey', 'Ballad', 'Cartographer', 'Alchemist', 'Locksmith', 'Gardener',
]

const PLURAL_NOUNS = [
  'Shadows', 'Giants', 'Kings', 'Ghosts', 'Wolves', 'Stars', 'Rivers', 'Strangers', 'Thieves', 'Machines', 'Dreams', 'Sparrows',
  'Tides', 'Lanterns', 'Rebels', 'Sisters', 'Brothers', 'Pilgrims', 'Ashes', 'Signals', 'Echoes', 'Embers', 'Drifters',
]

const PLACES = [
  'Marseille', 'Kyoto', 'Lagos', 'Reykjavík', 'Bogotá', 'Nairobi', 'Lisbon', 'Havana', 'Tbilisi', 'Oslo', 'Montréal', 'Zürich',
  'São Paulo', 'Kraków', 'Mumbai', 'Seoul', 'Cairo', 'Valparaíso', 'Tromsø', 'Málaga', 'Antwerp', 'Odessa', 'Hanoi', 'Perth',
  'the Atlas Mountains', 'the Baltic', 'the Outer Rim', 'Andromeda', 'the Yukon', 'Patagonia', 'Sector Nine', 'Titan',
  'the Salt Flats', 'the Undercity', 'Tannhäuser Gate', 'the Northern Reach', 'New Babylon', 'the Sunken Coast',
]

const FIRST_NAMES = [
  'Amélie', 'Zoë', 'José', 'Søren', 'Chloé', 'Renée', 'Björn', 'Núria', 'Łukasz', 'Ingrid', 'Mateo', 'Yuki', 'Kwame', 'Priya',
  'Elena', 'Tomas', 'Nadia', 'Hugo', 'Imani', 'Rafael', 'Sofia', 'Anouk', 'Dmitri', 'Leila', 'Otto', 'Mira', 'Kenji', 'Ada',
  'Isla', 'Jonah', 'Freya', 'Emil', 'Ravi', 'Céline', 'Matías', 'Ayşe', 'Niamh', 'Ólafur', 'Esmé', 'Lior',
]

const PROFESSIONS = [
  'cartographer', 'locksmith', 'jazz pianist', 'lighthouse keeper', 'forensic accountant', 'sous-chef', 'deep-sea welder',
  'court stenographer', 'radio astronomer', 'stunt driver', 'archivist', 'beekeeper', 'smuggler', 'translator', 'orbital mechanic',
  'pickpocket', 'schoolteacher', 'war photographer', 'chess prodigy', 'night-shift nurse', 'glassblower', 'bounty hunter',
  'puppeteer', 'ferry captain', 'code-breaker', 'pastry chef', 'rookie detective', 'retired boxer', 'street magician', 'botanist',
]

const GERUNDS = [
  'Chasing', 'Burning', 'Leaving', 'Finding', 'Breaking', 'Stealing', 'Crossing', 'Waking', 'Losing', 'Saving', 'Forgetting',
  'Haunting', 'Running', 'Hunting', 'Dreaming of', 'Waiting for', 'Racing', 'Escaping', 'Mapping', 'Painting',
]

const SUBTITLES = [
  'Rise of the Machines', 'The Long Winter', 'A Love Story', 'Dead Reckoning', 'Zero Hour', 'The Final Cut', 'Origins',
  'Blood and Sand', 'Last Light', 'The Reckoning', 'Ghost Protocol', 'First Contact', 'Homecoming', 'The Awakening',
  'Salvation', 'Legacy', 'Afterlife', 'Point of No Return', 'Second Chance', 'The Lost Chapter',
]

const ROMAN = ['II', 'III', 'IV', 'V']

const OPENERS = [
  'In the dying days of a long war', 'On the eve of a record-breaking heatwave', 'After a botched robbery', 'Years after a scandal',
  'During one sleepless summer', 'In a city that never sees the sun', 'Somewhere off the map', 'On the last ferry of the season',
  'When the power grid fails', 'Weeks before the wedding', 'At the edge of known space', 'In the winter the river froze solid',
  'Following a mysterious broadcast', 'On the night of the blackout', 'Deep in the mountains', 'In the year the rains stopped',
]

const GOALS: Record<string, string[]> = {
  default: [
    'uncover the truth behind a decades-old disappearance', 'repay a debt to the wrong people', 'win back the family bakery',
    'smuggle a priceless manuscript across the border', 'find the sibling who vanished without a word', 'clear their name before the trial',
    'keep a struggling theatre alive for one more season', 'track down a stolen violin', 'confront the mentor who betrayed them',
  ],
  'Sci-Fi': [
    'repair a failing orbital station before it falls from the sky', 'decode a signal arriving from a dead star', 'stop a rogue AI from rewriting history',
    'smuggle a synthetic child out of a corporate colony', 'survive a planet where time runs backwards', 'reach a wormhole before the fleet does',
  ],
  Horror: [
    'survive a night in a house that rearranges itself', 'break a curse passed down through the women of a village',
    'find out why the neighbours never leave after dark', 'escape a forest that swallows anyone who lies',
  ],
  Crime: [
    'pull off one last job before the crew disbands', 'bring down a syndicate from the inside', 'launder a fortune through a failing casino',
    'find the informant before the informant finds them', 'steal back what was stolen from them',
  ],
  Romance: [
    'decide between a safe life and a reckless love', 'find a stranger met once on a delayed train', 'fake an engagement that starts to feel real',
    'answer a stack of letters written to someone else',
  ],
  Western: ['guide a wagon train through hostile canyon country', 'protect a frontier town from a returning outlaw', 'bury a brother in the town that hanged him'],
  War: ['carry a message across enemy lines', 'evacuate a village before the front line arrives', 'keep a squad alive for one more day'],
  Comedy: ['pass off a stolen painting as a school project', 'host the perfect dinner for the in-laws', 'win a small-town talent contest by any means'],
  Fantasy: ['return a stolen crown to a sleeping queen', 'close the door between two worlds', 'outwit a trickster who trades in names'],
  Animation: ['find a way home from the land of lost things', 'reunite a runaway kite with the boy who built it', 'save a city built entirely of paper'],
  Documentary: ['piece together the story of a vanished neighbourhood', 'follow one season of a struggling minor-league team', 'trace a folk song back to its source'],
  Music: ['record one perfect album before the studio closes', 'reunite a band that split on stage', 'win a battle of the orchestras'],
}

const COMPLICATIONS = [
  'before the tide turns', 'while the whole town watches', 'as old enemies close in', 'with only a stolen map to guide them',
  'before the money runs out', 'without telling anyone why', 'while pretending to be someone else', 'as the past catches up',
  'with a rival always one step ahead', 'before the last train leaves', 'under the eye of a suspicious inspector',
  'while the city prepares to celebrate', 'as a storm bears down on the coast', 'with the clock running out',
]

const TONES = ['Tense', 'Tender', 'Sly', 'Sprawling', 'Melancholy', 'Brash', 'Lyrical', 'Nervy', 'Warm', 'Bleak', 'Playful', 'Stately']
const TONES_2 = ['unexpectedly funny', 'quietly devastating', 'relentlessly paced', 'gorgeously shot', 'sharply written', 'strangely hopeful', 'deeply strange', 'refreshingly unsentimental']
const RECEPTIONS = [
  'it earned a cult following on the festival circuit', 'it became a surprise word-of-mouth hit', 'it divided critics on release and aged well',
  'it launched the careers of its two leads', 'it won the top prize at three festivals', 'it was quietly rediscovered decades later',
  'it turned a modest budget into a box-office phenomenon', 'it remains the director’s most personal work', 'it is remembered for a final shot nobody saw coming',
  'it was shot in twenty-one days on a single location', 'it sparked a small revival of the genre', 'it is the rare sequel that outgrows its original',
]

const COMPANIONS = ['a talkative parolee', 'an estranged daughter', 'a retired spy', 'a stray dog', 'a rookie partner', 'a rival from school', 'a stowaway', 'a skeptical journalist', 'a grieving widow', 'a runaway heiress']

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function pickTitle(rng: Rng): string {
  const t = rng.int(0, 11)
  switch (t) {
    case 0: return `The ${rng.pick(ADJECTIVES)} ${rng.pick(NOUNS)}`
    case 1: return `${rng.pick(NOUNS)} of ${rng.pick(PLACES)}`
    case 2: return `${rng.pick(ADJECTIVES)} ${rng.pick(PLURAL_NOUNS)}`
    case 3: return `${rng.pick(NOUNS)} and ${rng.pick(NOUNS)}`
    case 4: return `The Last ${rng.pick(NOUNS)}`
    case 5: return `${rng.pick(FIRST_NAMES)}’s ${rng.pick(NOUNS)}`
    case 6: return `${rng.pick(GERUNDS)} ${rng.pick(PLURAL_NOUNS)}`
    case 7: return `${rng.pick(NOUNS)}: ${rng.pick(SUBTITLES)}`
    case 8: return `A ${rng.pick(NOUNS)} in ${rng.pick(PLACES)}`
    case 9: return `${rng.pick(FIRST_NAMES)} ${rng.pick(NOUNS)}` // e.g. "Zoë Lantern" — name-as-title
    case 10: return `${rng.pick(PLURAL_NOUNS)} of the ${rng.pick(ADJECTIVES)} ${rng.pick(NOUNS)}`
    default: return `${rng.pick(ADJECTIVES)}${rng.pick(NOUNS)}` // camelCase brand-style title, e.g. "IronCompass"
  }
}

function pickGenres(rng: Rng): string[] {
  const n = rng.chance(0.15) ? 1 : rng.chance(0.55) ? 2 : 3
  const genres = rng.sample(GENRES, n)
  // sort for stable presentation, but keep the first pick as the primary genre
  const primary = genres[0]
  const rest = genres.slice(1).sort()
  return [primary, ...rest]
}

function pickYear(rng: Rng): number {
  // skew toward recent decades: 1920–2025
  const u = rng.next()
  return 2025 - Math.floor(105 * Math.pow(u, 1.7))
}

function pickRating(rng: Rng): number {
  const r = rng.normal(6.4, 1.1)
  return Math.round(Math.min(9.6, Math.max(2.1, r)) * 10) / 10
}

function pickPopularity(rng: Rng, rating: number): number {
  // heavy-tailed, mildly correlated with rating
  const base = Math.exp(rng.normal(6.2 + (rating - 6.4) * 0.35, 1.5))
  // capped just under the anchor titles so the empty-query browse view starts on familiar names
  return Math.max(1, Math.min(90000, Math.round(base)))
}

function describe(rng: Rng, primary: string): string {
  const goals = GOALS[primary] ?? GOALS.default
  const pool = rng.chance(0.7) ? goals : GOALS.default
  const protagonist = rng.chance(0.5)
    ? `a ${rng.pick(ADJECTIVES).toLowerCase()} ${rng.pick(PROFESSIONS)}`
    : `${rng.pick(FIRST_NAMES)}, a ${rng.pick(PROFESSIONS)}`
  const withCompanion = rng.chance(0.45) ? ` and ${rng.pick(COMPANIONS)}` : ''
  const first = `${rng.pick(OPENERS)}, ${protagonist}${withCompanion} must ${rng.pick(pool)} ${rng.pick(COMPLICATIONS)}.`
  const second = `${rng.pick(TONES)} and ${rng.pick(TONES_2)}, ${rng.pick(RECEPTIONS)}.`
  return capitalize(first) + ' ' + second
}

export function generateDataset(seed = 20260907, total = 10000): SearchRecord[] {
  const rng = new Rng(seed)
  const records: SearchRecord[] = anchorRecords()
  const titles = new Set(records.map((r) => r.title.toLowerCase()))

  while (records.length < total) {
    let title = pickTitle(rng)
    let attempts = 0
    while (titles.has(title.toLowerCase()) && attempts < 3) {
      title = pickTitle(rng)
      attempts++
    }
    if (titles.has(title.toLowerCase())) title = `${title} ${rng.pick(ROMAN)}`
    if (titles.has(title.toLowerCase())) continue
    titles.add(title.toLowerCase())

    const genres = pickGenres(rng)
    const rating = pickRating(rng)
    const id = `rec-${String(records.length + 1).padStart(5, '0')}`
    records.push({
      id,
      title,
      description: describe(rng, genres[0]),
      genres,
      year: pickYear(rng),
      rating,
      popularity: pickPopularity(rng, rating),
    })
  }
  return records
}
