// The domain: what an award is, how words become a citation, how an award
// becomes a URL. Pure functions only — no DOM, no canvas.

export type Category =
  | 'physics'
  | 'chemistry'
  | 'medicine'
  | 'literature'
  | 'peace'
  | 'economics'

export interface Award {
  recipient: string
  achievement: string
  category: Category
  serial: number
  dateISO: string
}

export const CATEGORIES: Record<
  Category,
  { label: string; motto: string; emblem: string }
> = {
  physics: { label: 'Physics', motto: 'in motion and matter', emblem: 'atom' },
  chemistry: { label: 'Chemistry', motto: 'of bonds and reactions', emblem: 'flask' },
  medicine: { label: 'Medicine', motto: "for the body's quiet work", emblem: 'staff' },
  literature: { label: 'Literature', motto: 'in the precise word', emblem: 'book' },
  peace: { label: 'Peace', motto: 'for the absence of thunder', emblem: 'olive' },
  economics: { label: 'Economics', motto: 'of means and ends', emblem: 'coins' },
}

export const CATEGORY_ORDER: Category[] = [
  'physics',
  'chemistry',
  'medicine',
  'literature',
  'peace',
  'economics',
]

// Committee grammar. Each template wraps the raw achievement phrase.
const TEMPLATES: Record<Category, string[]> = {
  physics: [
    'for establishing {a} as a force of nature',
    'in recognition of {a}, observed at every scale',
    'for demonstrating that {a} conserves energy, dignity excepted',
    'for isolating {a} from all competing phenomena',
    'for proof that {a} exerts measurable pull on nearby observers',
    'for experiments in {a} conducted without adult supervision',
  ],
  chemistry: [
    'for catalysing {a} under everyday conditions',
    'for the synthesis of {a} from common materials',
    'for a reaction, namely {a}, that proceeds without stirring',
    'for bonds formed in the course of {a}, unusually stable',
    'for reducing the complex matter of {a} to its essence',
    'for {a}, achieved at room temperature and considerable pressure',
  ],
  medicine: [
    'for the sustained treatment of {a}, patient unharmed',
    'for a remedy, being {a}, effective in all recorded cases',
    'for restoring order where {a} had spread unchecked',
    'for the careful nursing of {a} back to health',
    'for clinical excellence in the field of {a}',
    'for preventing the recurrence of {a} through sheer vigilance',
  ],
  literature: [
    'for {a}, rendered with unusual grace',
    'for a body of work consisting chiefly of {a}',
    'for {a}, a sentence the Committee could not improve',
    'for finding le mot juste in the matter of {a}',
    'for {a}, narrated so well it became true',
    'for advancing the literature of {a} beyond all reasonable need',
  ],
  peace: [
    'for keeping the peace through {a}',
    'for {a}, a small armistice honoured daily',
    'for resolving {a} without convening a summit',
    'for the quiet diplomacy of {a}',
    'for {a}, which de-escalated a room in under a minute',
    'for an accord reached, against the odds, on {a}',
  ],
  economics: [
    'for a rigorous accounting of {a}',
    'for optimising {a} to within an inch of its life',
    'for proving that {a} scales, at least domestically',
    'for the efficient allocation of {a} under scarcity',
    'for settling the true cost of {a} once and for all',
    'for marginal gains in {a} that compounded beautifully',
  ],
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function normaliseAchievement(raw: string): string {
  let a = raw.trim().replace(/\s+/g, ' ')
  a = a.replace(/[.\s]+$/, '')
  if (/^for\s+/i.test(a)) a = a.slice(4)
  return a.charAt(0).toLowerCase() + a.slice(1)
}

export function mint(raw: {
  recipient: string
  achievement: string
  category: Category
  dateISO?: string
}): Award {
  const achievement = normaliseAchievement(raw.achievement)
  const recipient = raw.recipient.trim().replace(/\s+/g, ' ')
  const serial = 1000 + (hashString(`${recipient}|${achievement}|${raw.category}`) % 9000)
  return {
    recipient,
    achievement,
    category: raw.category,
    serial,
    dateISO: raw.dateISO ?? new Date().toISOString().slice(0, 10),
  }
}

export function citation(award: Award): string {
  const pool = TEMPLATES[award.category]
  const t = pool[award.serial % pool.length]
  return t.replace('{a}', award.achievement)
}

const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
]

export function roman(n: number): string {
  let out = ''
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v }
  return out
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const ORDINAL = [
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh',
  'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth',
  'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth',
  'nineteenth', 'twentieth', 'twenty-first', 'twenty-second',
  'twenty-third', 'twenty-fourth', 'twenty-fifth', 'twenty-sixth',
  'twenty-seventh', 'twenty-eighth', 'twenty-ninth', 'thirtieth',
  'thirty-first',
]

export function ceremonyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `this ${ORDINAL[d - 1]} day of ${MONTHS[m - 1]}, ${roman(y)}`
}

// URL codec — the whole award in the hash, so every medal is a permalink.
export function encodeAward(a: Award): string {
  const json = JSON.stringify([
    a.recipient, a.achievement, a.category, a.serial, a.dateISO,
  ])
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeAward(hash: string): Award | null {
  try {
    const b64 = hash.replace(/^#a=/, '').replace(/-/g, '+').replace(/_/g, '/')
    const [recipient, achievement, category, serial, dateISO] = JSON.parse(
      decodeURIComponent(escape(atob(b64))),
    )
    if (!CATEGORIES[category as Category] || typeof serial !== 'number') return null
    if (typeof achievement !== 'string' || !achievement) return null
    return { recipient: recipient ?? '', achievement, category, serial, dateISO }
  } catch {
    return null
  }
}

export const GHOST_EXAMPLES = [
  'exemplary silence in a meeting that could have been an email',
  'leaving the group chat on read with total composure',
  'finishing the leftovers before they became a science project',
  'remembering every birthday without a single notification',
  'knowing exactly which cable goes in which box of cables',
  'replying "perfect, thanks" to a message that deserved more',
  'parallel parking on the first attempt, with witnesses',
  'keeping a houseplant alive through two house moves',
]
