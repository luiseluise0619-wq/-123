// cmdk(command-score.ts)의 점수 알고리즘을 옮긴 것. MIT, Paco Coursey.
// 연속 일치 1점, 단어 시작 점프 0.9/0.8, 글자 점프 0.17, 전위 0.1.
const SCORE_CONTINUE_MATCH = 1,
  SCORE_SPACE_WORD_JUMP = 0.9,
  SCORE_NON_SPACE_WORD_JUMP = 0.8,
  SCORE_CHARACTER_JUMP = 0.17,
  SCORE_TRANSPOSITION = 0.1,
  PENALTY_SKIPPED = 0.999,
  PENALTY_CASE_MISMATCH = 0.9999,
  PENALTY_NOT_COMPLETE = 0.99;

const IS_GAP_REGEXP = /[\\\/_+.#"@\[\(\{&]/,
  COUNT_GAPS_REGEXP = /[\\\/_+.#"@\[\(\{&]/g,
  IS_SPACE_REGEXP = /[\s-]/,
  COUNT_SPACE_REGEXP = /[\s-]/g;

function inner(string, abbr, lowerString, lowerAbbr, si, ai, memo) {
  if (ai === abbr.length) return si === string.length ? SCORE_CONTINUE_MATCH : PENALTY_NOT_COMPLETE;
  const key = si + ',' + ai;
  if (memo[key] !== undefined) return memo[key];

  const ch = lowerAbbr.charAt(ai);
  let index = lowerString.indexOf(ch, si);
  let high = 0, score, transposed, wordBreaks, spaceBreaks;

  while (index >= 0) {
    score = inner(string, abbr, lowerString, lowerAbbr, index + 1, ai + 1, memo);
    if (score > high) {
      if (index === si) {
        score *= SCORE_CONTINUE_MATCH;
      } else if (IS_GAP_REGEXP.test(string.charAt(index - 1))) {
        score *= SCORE_NON_SPACE_WORD_JUMP;
        wordBreaks = string.slice(si, index - 1).match(COUNT_GAPS_REGEXP);
        if (wordBreaks && si > 0) score *= Math.pow(PENALTY_SKIPPED, wordBreaks.length);
      } else if (IS_SPACE_REGEXP.test(string.charAt(index - 1))) {
        score *= SCORE_SPACE_WORD_JUMP;
        spaceBreaks = string.slice(si, index - 1).match(COUNT_SPACE_REGEXP);
        if (spaceBreaks && si > 0) score *= Math.pow(PENALTY_SKIPPED, spaceBreaks.length);
      } else {
        score *= SCORE_CHARACTER_JUMP;
        if (si > 0) score *= Math.pow(PENALTY_SKIPPED, index - si);
      }
      if (string.charAt(index) !== abbr.charAt(ai)) score *= PENALTY_CASE_MISMATCH;
    }

    if (
      (score < SCORE_TRANSPOSITION && lowerString.charAt(index - 1) === lowerAbbr.charAt(ai + 1)) ||
      (lowerAbbr.charAt(ai + 1) === lowerAbbr.charAt(ai) && lowerString.charAt(index - 1) !== lowerAbbr.charAt(ai))
    ) {
      transposed = inner(string, abbr, lowerString, lowerAbbr, index + 1, ai + 2, memo);
      if (transposed * SCORE_TRANSPOSITION > score) score = transposed * SCORE_TRANSPOSITION;
    }

    if (score > high) high = score;
    index = lowerString.indexOf(ch, index + 1);
  }

  memo[key] = high;
  return high;
}

function format(s) {
  return s.toLowerCase().replace(COUNT_SPACE_REGEXP, ' ');
}

// aliases: 같은 항목을 부르는 다른 말들(통계 코드명 등)
export function commandScore(string, abbreviation, aliases) {
  const s = aliases && aliases.length ? string + ' ' + aliases.join(' ') : string;
  return inner(s, abbreviation, format(s), format(abbreviation), 0, 0, {});
}
