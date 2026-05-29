export function candidateKeyFor(input) {
  const url = normalizeMediaUrl(input.url);
  const pageUrl = normalizePageUrl(input.pageUrl);
  return `${pageUrl}|${url}`;
}

export function normalizeMediaUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    for (const name of [...url.searchParams.keys()]) {
      if (isVolatileParam(name)) {
        url.searchParams.delete(name);
      }
    }
    return url.href;
  } catch {
    return String(value || '');
  }
}

export function shouldShowCandidate(input) {
  const url = parseUrl(input.url);
  if (!url) {
    return false;
  }

  const pathname = url.pathname.toLowerCase();
  if (isSegmentUrl(pathname)) {
    return false;
  }

  if (pathname.endsWith('.m3u8') && isLowValueHlsPlaylist(pathname)) {
    return false;
  }

  return true;
}

function isVolatileParam(name) {
  return /^(sign|signature|sig|token|auth|expires?|expire|time|timestamp|t|uuid|us|key|session|x-[a-z0-9-]+)$/i.test(name);
}

function isSegmentUrl(pathname) {
  return /\.(ts|m4s|cmfv|cmfa|aac|vtt)(?:$|\.)/.test(pathname);
}

function isLowValueHlsPlaylist(pathname) {
  const filename = pathname.split('/').at(-1) || '';
  return /(?:^|[_-])(?:audio|subtitle|subtitles|chunk|segment|seg|index_\d+|rendition_\d+)(?:[_-]|\.)/.test(filename);
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

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
