const { languageOf, errorBody, MESSAGES } = require('./messages');

describe('plugin messages', () => {
  test('uses the requested language, then Accept-Language, defaulting to Spanish', () => {
    expect(languageOf({ query: { lang: 'en' }, headers: {} })).toBe('en');
    expect(languageOf({ query: {}, headers: { 'accept-language': 'en-US,en;q=0.9' } })).toBe('en');
    expect(languageOf({ query: { lang: 'es' }, headers: { 'accept-language': 'en' } })).toBe('es');
    expect(languageOf({ query: {}, headers: {} })).toBe('es');
    expect(languageOf({ query: { lang: 'fr' }, headers: {} })).toBe('es');
  });

  test('every error code exists in both languages', () => {
    for (const code of Object.keys(MESSAGES.es)) expect(MESSAGES.en[code]).toBeTruthy();
    expect(errorBody('en', 'sourceGone')).toEqual({ code: 'sourceGone', error: MESSAGES.en.sourceGone });
  });
});
