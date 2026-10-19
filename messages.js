// Texts the plugin returns to the app. The app sends its language (?lang=es|en) or the
// browser sends Accept-Language; unknown or missing languages fall back to Spanish.
const MESSAGES = {
  es: {
    sourceGone: 'Esta fuente ya no esta disponible; actualiza las fuentes del juego.',
    sourceUnavailable: 'Fuente no disponible.',
    browserOnly: 'Esta fuente requiere descarga en el navegador; todavia no hay desbloqueo PLUS para este host.',
  },
  en: {
    sourceGone: 'This source is no longer available; refresh the game sources.',
    sourceUnavailable: 'Source not available.',
    browserOnly: 'This source needs a browser download; PLUS unlock is not available for this host yet.',
  },
};

function languageOf(req) {
  const requested = typeof req.query.lang === 'string' ? req.query.lang : '';
  const accepted = String(req.headers['accept-language'] || '');
  return (requested || accepted).toLowerCase().startsWith('en') ? 'en' : 'es';
}

// Every error body carries a stable code, so the app can translate it with its own catalog.
function errorBody(lang, code) {
  return { code, error: (MESSAGES[lang] || MESSAGES.es)[code] || MESSAGES.es[code] };
}

module.exports = { MESSAGES, languageOf, errorBody };
