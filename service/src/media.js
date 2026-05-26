const MEDIA_EXTENSIONS = new Map([
  ['.m3u8', 'hls'],
  ['.mpd', 'dash'],
  ['.mp4', 'file'],
  ['.webm', 'file'],
  ['.mov', 'file'],
  ['.m4v', 'file'],
  ['.mkv', 'file'],
  ['.mp3', 'file'],
  ['.m4a', 'file'],
  ['.aac', 'file']
]);

const MEDIA_CONTENT_TYPES = new Map([
  ['application/vnd.apple.mpegurl', 'hls'],
  ['application/x-mpegurl', 'hls'],
  ['audio/mpegurl', 'hls'],
  ['application/dash+xml', 'dash'],
  ['video/mp4', 'file'],
  ['video/webm', 'file'],
  ['audio/mp4', 'file'],
  ['audio/mpeg', 'file']
]);

export function classifyMediaUrl(url, contentType = '') {
  const normalizedContentType = contentType.split(';')[0].trim().toLowerCase();
  if (MEDIA_CONTENT_TYPES.has(normalizedContentType)) {
    return MEDIA_CONTENT_TYPES.get(normalizedContentType);
  }

  let pathname;
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    return null;
  }

  for (const [extension, type] of MEDIA_EXTENSIONS) {
    if (pathname.endsWith(extension)) {
      return type;
    }
  }

  return null;
}

export function normalizeCandidate(input) {
  if (!input || typeof input.url !== 'string') {
    throw new Error('A candidate URL is required.');
  }

  const type = classifyMediaUrl(input.url, input.contentType);
  if (!type) {
    throw new Error('The URL is not a supported media resource.');
  }

  return {
    url: input.url,
    type,
    title: input.tabTitle || input.title || 'video',
    pageUrl: input.pageUrl || '',
    contentType: input.contentType || '',
    headers: normalizeHeaders(input.headers || {}),
    discoveredAt: input.discoveredAt || new Date().toISOString()
  };
}

export function normalizeHeaders(headers) {
  const allowed = new Set(['Cookie', 'Referer', 'User-Agent', 'Authorization']);
  const normalized = {};

  for (const [name, value] of Object.entries(headers)) {
    const canonical = canonicalHeaderName(name);
    if (allowed.has(canonical) && typeof value === 'string' && value.trim()) {
      normalized[canonical] = value.trim();
    }
  }

  return normalized;
}

function canonicalHeaderName(name) {
  return String(name)
    .toLowerCase()
    .split('-')
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join('-');
}
