export function candidateKeyFor(input) {
  const url = normalizeMediaUrl(input.url);
  const pageUrl = normalizePageUrl(input.pageUrl);
  return `${pageUrl}|${url}`;
}

export function normalizeMediaUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.href;
  } catch {
    return String(value || '');
  }
}

function normalizePageUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    return `${url.origin}${url.pathname}`;
  } catch {
    return '';
  }
}
