chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'getVideoPreviewMetadata') {
    return false;
  }

  sendResponse(findBestVideoMetadata());
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
