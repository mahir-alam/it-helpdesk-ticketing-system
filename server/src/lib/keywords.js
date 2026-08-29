const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out',
  'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who',
  'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'with', 'this', 'that', 'from',
  'have', 'been', 'when', 'will', 'they', 'them', 'then', 'than', 'were', 'what', 'your', 'about',
  'into', 'unable', 'cannot', 'error', 'issue', 'please', 'after', 'since', 'help', 'need', 'user',
  'users', 'ticket', 'getting', 'seeing', 'today', 'still', 'again', 'some', 'when', 'while',
]);

/** Lower-cased, de-duplicated content words of length >= 4, minus stopwords. */
export function extractKeywords(...texts) {
  const seen = new Set();
  for (const text of texts) {
    if (!text) continue;
    for (const raw of String(text).toLowerCase().split(/[^a-z0-9]+/)) {
      if (raw.length < 4 || STOPWORDS.has(raw)) continue;
      seen.add(raw);
    }
  }
  return [...seen];
}

export function sharedKeywordCount(a, b) {
  const setB = new Set(b);
  return a.filter((k) => setB.has(k)).length;
}
