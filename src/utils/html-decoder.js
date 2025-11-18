/**
 * Decodes HTML entities in text
 * Converts things like &#x27; to ', &amp; to &, etc.
 */
export function decodeHtmlEntities(text) {
  if (!text) return text;

  const htmlEntities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&ndash;': '-',
    '&mdash;': '-',
    '&hellip;': '...',
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&lsquo;': "'",
    '&rsquo;': "'",
  };

  let decoded = text;

  // Replace named entities
  Object.entries(htmlEntities).forEach(([entity, char]) => {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  });

  // Replace numeric entities (&#123; format)
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
    return String.fromCharCode(dec);
  });

  // Replace hex entities (&#x27; format)
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  // Replace Unicode escape sequences (\u00d6 format)
  decoded = decoded.replace(/\\u([0-9a-f]{4})/gi, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  // Replace Unicode escape sequences with colon format (:u00d6: format - used by some systems)
  decoded = decoded.replace(/:u([0-9a-f]{4}):/gi, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  return decoded;
}
