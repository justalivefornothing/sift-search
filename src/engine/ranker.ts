/**
 * Tiered ranking.
 *
 * Hits are ordered by a strict sequence of criteria; a later criterion is only
 * consulted when every earlier one ties:
 *
 *   typos ↑ → words ↓ → proximity ↑ → attribute ↑ → exactness ↓ → popularity ↓
 *
 * Because every criterion is a small bounded integer the whole vector packs
 * into one double (46 bits of a 53-bit mantissa) so the hot path sorts plain
 * numbers, while the same vector is exposed unpacked for the explainer.
 */
import { CRITERIA, type Criteria, type Criterion, type TieBreak } from './types.ts'

export const TYPOS_MAX = 63
export const WORDS_MAX = 31
export const PROXIMITY_MAX = 127
export const ATTRIBUTE_MAX = 3
export const EXACT_MAX = 31
/** 2^21 popularity ranks → up to ~2M records */
export const POP_SPAN = 2097152

/** Higher score ranks first. `popScore` must be a unique integer in [0, POP_SPAN). */
export function packScore(c: Criteria, popScore: number): number {
  return packScoreParts(c.typos, c.words, c.proximity, c.attribute, c.exactness, popScore)
}

/** Allocation-free variant used on the hot path. */
export function packScoreParts(
  typos: number,
  words: number,
  proximity: number,
  attribute: number,
  exactness: number,
  popScore: number,
): number {
  let s = TYPOS_MAX - (typos < TYPOS_MAX ? typos : TYPOS_MAX)
  s = s * (WORDS_MAX + 1) + (words < WORDS_MAX ? words : WORDS_MAX)
  s = s * (PROXIMITY_MAX + 1) + (PROXIMITY_MAX - (proximity < PROXIMITY_MAX ? proximity : PROXIMITY_MAX))
  s = s * (ATTRIBUTE_MAX + 1) + (ATTRIBUTE_MAX - (attribute < ATTRIBUTE_MAX ? attribute : ATTRIBUTE_MAX))
  s = s * (EXACT_MAX + 1) + (exactness < EXACT_MAX ? exactness : EXACT_MAX)
  s = s * POP_SPAN + popScore
  return s
}

/** Negative when `a` should rank before `b`. */
export function compareCriteria(a: Criteria, b: Criteria): number {
  if (a.typos !== b.typos) return a.typos - b.typos
  if (a.words !== b.words) return b.words - a.words
  if (a.proximity !== b.proximity) return a.proximity - b.proximity
  if (a.attribute !== b.attribute) return a.attribute - b.attribute
  if (a.exactness !== b.exactness) return b.exactness - a.exactness
  if (a.popularity !== b.popularity) return b.popularity - a.popularity
  return 0
}

/** Which criterion separated `current` from the better-ranked `previous` hit (null when identical). */
export function findTieBreak(previous: Criteria, current: Criteria): TieBreak | null {
  for (const criterion of CRITERIA) {
    if (previous[criterion] !== current[criterion]) {
      return { criterion, previous: previous[criterion], current: current[criterion] }
    }
  }
  return null
}

/** Direction of each criterion for UI copy: does a lower or a higher value rank first? */
export const CRITERION_DIRECTION: Record<Criterion, 'lower' | 'higher'> = {
  typos: 'lower',
  words: 'higher',
  proximity: 'lower',
  attribute: 'lower',
  exactness: 'higher',
  popularity: 'higher',
}
