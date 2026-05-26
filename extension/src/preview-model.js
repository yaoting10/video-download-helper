export function summarizeCandidate(candidate) {
  const mediaUrl = parseUrl(candidate.url);
  const pageUrl = parseUrl(candidate.pageUrl);
  const host = pageUrl?.hostname || mediaUrl?.hostname || 'unknown source';
  const path = mediaUrl?.pathname || '';
  const format = inferFormat(candidate);
  const filename = describeMediaPath(path, format);

  return {
    host,
    format,
    filename,
    title: buildDisplayTitle(candidate, filename, format)
  };
}

export function canPreviewInBrowser(candidate) {
  const url = String(candidate.url || '').toLowerCase();
  return /\.(mp4|webm|mov|m4v|mp3|m4a|aac)(?:$|\?)/.test(url);
}

export function previewHint(candidate) {
  if (canPreviewInBrowser(candidate)) {
    return 'Browser preview';
  }

  if (String(candidate.url || '').toLowerCase().includes('.m3u8')) {
    return 'HLS preview may require opening the source';
  }

  if (String(candidate.url || '').toLowerCase().includes('.mpd')) {
    return 'DASH preview may require opening the source';
  }

  return 'Preview may not be available in this browser';
}

export function inferFormat(candidate) {
  const explicit = String(candidate.type || '').toUpperCase();
  if (explicit === 'HLS') {
    return 'M3U8';
  }
  if (explicit === 'DASH') {
    return 'MPD';
  }

  const url = String(candidate.url || '').toLowerCase();
  if (url.includes('.m3u8')) return 'M3U8';
  if (url.includes('.mpd')) return 'MPD';
  return url.match(/\.([a-z0-9]+)(?:$|\?)/)?.[1]?.toUpperCase() || 'FILE';
}

export function formatDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }

  const total = Math.floor(value);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  return [hours, minutes, secs]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function buildDisplayTitle(candidate, filename, format) {
  const base = String(candidate.tabTitle || candidate.title || filename || 'video').trim();
  const extension = format === 'M3U8' || format === 'MPD' ? 'mp4' : format.toLowerCase();
  const withoutMediaExtension = base.replace(/\.(m3u8|mpd|mp4|webm|mov|m4v|mkv|mp3|m4a|aac)$/i, '');
  return `${withoutMediaExtension}.${extension}`;
}

function describeMediaPath(path, format) {
  const filename = path.split('/').filter(Boolean).at(-1) || '';
  if (filename) {
    return filename;
  }

  return `${format} media`;
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
