/**
 * Sift engine — dependency-free, DOM-free search engine.
 * Everything exported here runs identically in Node, a Web Worker and tests.
 */
export * from './types.ts'
export { tokenize, tokenizeToStrings, normalizeWord, type Token } from './tokenizer.ts'
export { damerauLevenshtein } from './levenshtein.ts'
export { Trie, type FuzzyMatch } from './trie.ts'
export { Bitset, popcount32 } from './bitset.ts'
export { InvertedIndex, ATTR_BITS, ATTR_MASK, type PostingList } from './inverted-index.ts'
export {
  FacetIndex,
  DEFAULT_FACETS,
  RATING_BUCKETS,
  decadeOf,
  ratingBucket,
  parseFacetFilters,
  type FacetDefinition,
  type FacetFilters,
} from './facets.ts'
export {
  planQuery,
  expandWord,
  typoBudget,
  describePlan,
  MAX_QUERY_WORDS,
  type Candidate,
  type PlannedWord,
  type QueryPlan,
} from './query-planner.ts'
export { compareCriteria, findTieBreak, packScore, CRITERION_DIRECTION } from './ranker.ts'
export { Scorer, PROXIMITY_CAP } from './scorer.ts'
export { highlight, snippet, escapeHtml, findMarks, wrapMarks } from './highlight.ts'
export { suggestQueries, alternativesFor } from './suggest.ts'
export { TopK } from './topk.ts'
export { SearchIndex, DEFAULT_HITS_PER_PAGE, MAX_HITS_PER_PAGE, type SearchIndexOptions } from './search-index.ts'
