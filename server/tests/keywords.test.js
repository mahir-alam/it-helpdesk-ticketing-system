import { extractKeywords, sharedKeywordCount } from '../src/lib/keywords.js';

describe('extractKeywords', () => {
  it('lower-cases, drops short words and stopwords', () => {
    const kw = extractKeywords('VPN connection failing from the Calgary remote office');
    expect(kw).toEqual(expect.arrayContaining(['connection', 'failing', 'calgary', 'remote', 'office']));
    expect(kw).not.toContain('vpn'); // length < 4
    expect(kw).not.toContain('the');
    expect(kw).not.toContain('from');
  });

  it('de-duplicates across multiple text fields', () => {
    const kw = extractKeywords('Outlook crash', 'Outlook keeps crashing after update');
    expect(kw.filter((k) => k === 'outlook')).toHaveLength(1);
  });

  it('returns an empty array for empty / null input', () => {
    expect(extractKeywords()).toEqual([]);
    expect(extractKeywords(null, undefined, '')).toEqual([]);
  });
});

describe('sharedKeywordCount', () => {
  it('counts the intersection size', () => {
    expect(sharedKeywordCount(['vpn', 'calgary', 'firewall'], ['calgary', 'firewall', 'update'])).toBe(2);
  });
  it('is zero for disjoint sets', () => {
    expect(sharedKeywordCount(['printer', 'toner'], ['active', 'directory'])).toBe(0);
  });

  it('two AD-lockout tickets share >= 2 keywords (detection threshold)', () => {
    const a = extractKeywords('Active Directory account locked out after invalid login attempts');
    const b = extractKeywords('AD account lockout following repeated invalid login attempts this morning');
    expect(sharedKeywordCount(a, b)).toBeGreaterThanOrEqual(2);
  });
});
