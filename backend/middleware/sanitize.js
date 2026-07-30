const xss = require('xss');

// Recursively strips dangerous HTML/script content from string fields in req.body.
// Applied on top of express-mongo-sanitize (which handles NoSQL operator injection)
// and hpp (which handles HTTP parameter pollution).
function sanitizeBody(req, res, next) {
  const clean = (value) => {
    if (typeof value === 'string') return xss(value.trim());
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v)]));
    }
    return value;
  };

  if (req.body && typeof req.body === 'object') {
    req.body = clean(req.body);
  }
  next();
}

module.exports = sanitizeBody;
