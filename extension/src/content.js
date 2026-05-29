chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'getVideoPreviewMetadata') {
    sendResponse(findBestVideoMetadata());
    return false;
  }

  if (message?.type === 'rescanVideoSources') {
    sendResponse({ sources: findVideoSources() });
    return false;
  }

  return false;
});

function findBestVideoMetadata() {
  const videos = [...document.querySelectorAll('video')];
  const selected = videos
    .map(readVideoMetadata)
    .filter(Boolean)
    .sort((a, b) => b.area - a.area)[0];

  if (!selected) {
    return {};
  }

  return {
    duration: selected.duration,
    previewImageUrl: selected.frameDataUrl || selected.posterUrl || '',
    previewRect: selected.rect,
    viewport: selected.viewport
  };
}

function readVideoMetadata(video) {
  const rect = video.getBoundingClientRect();
  const width = video.videoWidth || rect.width || 0;
  const height = video.videoHeight || rect.height || 0;
  const area = width * height;

  if (area <= 0 && !video.poster) {
    return null;
  }

  return {
    area,
    duration: Number.isFinite(video.duration) ? video.duration : 0,
    posterUrl: resolvePoster(video.poster),
    frameDataUrl: captureFrame(video),
    rect: normalizeRect(rect),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  };
}

function findVideoSources() {
  return [...document.querySelectorAll('video')]
    .flatMap((video) => readVideoSources(video))
    .filter((source, index, all) => source.url && all.findIndex((item) => item.url === source.url) === index);
}

function readVideoSources(video) {
  const urls = [
    video.currentSrc,
    video.src,
    ...[...video.querySelectorAll('source')].map((source) => source.src)
  ].filter(Boolean);
  const metadata = readVideoMetadata(video) || {};

  return urls.map((url) => ({
    url,
    contentType: guessContentType(url),
    duration: metadata.duration || 0,
    previewImageUrl: metadata.frameDataUrl || metadata.posterUrl || '',
    previewRect: metadata.rect,
    viewport: metadata.viewport
  }));
}

function guessContentType(url) {
  const normalized = String(url || '').toLowerCase();
  if (normalized.includes('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (normalized.includes('.mpd')) return 'application/dash+xml';
  if (normalized.includes('.mp4')) return 'video/mp4';
  if (normalized.includes('.webm')) return 'video/webm';
  return '';
}

function normalizeRect(rect) {
  return {
    x: Math.max(0, rect.left),
    y: Math.max(0, rect.top),
    width: Math.max(0, Math.min(rect.width, window.innerWidth - Math.max(0, rect.left))),
    height: Math.max(0, Math.min(rect.height, window.innerHeight - Math.max(0, rect.top)))
  };
}

function resolvePoster(poster) {
  if (!poster) {
    return '';
  }

  try {
    return new URL(poster, window.location.href).href;
  } catch {
    return poster;
  }
}

function captureFrame(video) {
  if (!video.videoWidth || !video.videoHeight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return '';
  }

  try {
    const canvas = document.createElement('canvas');
    const width = 320;
    const height = Math.round((video.videoHeight / video.videoWidth) * width);
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return '';
  }
}
