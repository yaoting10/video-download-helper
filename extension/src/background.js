import { candidateKeyFor } from './candidate-model.js';

const MEDIA_EXTENSIONS = ['.m3u8', '.mpd', '.mp4', '.webm', '.mov', '.m4v', '.mkv', '.mp3', '.m4a', '.aac'];
const MEDIA_TYPES = [
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
  'audio/mpegurl',
  'application/dash+xml',
  'video/mp4',
  'video/webm',
  'audio/mp4',
  'audio/mpeg'
];

const candidatesByTab = new Map();
const requestHeadersByRequest = new Map();
const MAX_CANDIDATES_PER_TAB = 80;

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (details.tabId < 0 || !isLikelyMediaUrl(details.url)) {
      return;
    }

    requestHeadersByRequest.set(details.requestId, headersArrayToObject(details.requestHeaders || []));
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders', 'extraHeaders']
);

chrome.webRequest.onResponseStarted.addListener(
  async (details) => {
    if (details.tabId < 0) {
      return;
    }

    const responseHeaders = headersArrayToObject(details.responseHeaders || []);
    const contentType = responseHeaders['Content-Type'] || responseHeaders['content-type'] || '';

    if (!isSupportedMedia(details.url, contentType)) {
      return;
    }

    const tab = await getTab(details.tabId);
    const requestHeaders = requestHeadersByRequest.get(details.requestId) || {};
    requestHeadersByRequest.delete(details.requestId);

    const headers = await buildForwardHeaders({
      mediaUrl: details.url,
      pageUrl: tab?.url || '',
      requestHeaders
    });

    const previewMetadata = await getVideoPreviewMetadata(details.tabId, tab);

    const pageUrl = tab?.url || '';
    addCandidate(details.tabId, {
      id: candidateKeyFor({ url: details.url, pageUrl }),
      url: details.url,
      pageUrl,
      tabTitle: tab?.title || 'video',
      contentType,
      headers,
      ...previewMetadata,
      discoveredAt: new Date().toISOString()
    });
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

chrome.tabs.onRemoved.addListener((tabId) => {
  candidatesByTab.delete(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'getCandidates') {
    sendResponse({ candidates: candidatesByTab.get(message.tabId) || [] });
    return false;
  }

  if (message?.type === 'clearCandidates') {
    candidatesByTab.set(message.tabId, []);
    updateBadge(message.tabId);
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === 'removeCandidate') {
    removeCandidate(message.tabId, message.candidateId);
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === 'markCandidateJob') {
    updateCandidate(message.tabId, message.candidateId, {
      jobId: message.job?.id || '',
      job: message.job || null
    });
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

function isSupportedMedia(url, contentType = '') {
  return isLikelyMediaUrl(url) || MEDIA_TYPES.some((type) => contentType.toLowerCase().includes(type));
}

function isLikelyMediaUrl(url) {
  let pathname = '';
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    return false;
  }

  return MEDIA_EXTENSIONS.some((extension) => pathname.endsWith(extension));
}

function addCandidate(tabId, candidate) {
  const current = candidatesByTab.get(tabId) || [];
  const existing = current.find((item) => item.id === candidate.id);
  const nextCandidate = {
    ...existing,
    ...candidate,
    jobId: existing?.jobId || candidate.jobId || '',
    job: existing?.job || candidate.job || null,
    discoveredAt: existing?.discoveredAt || candidate.discoveredAt
  };
  const withoutDuplicate = current.filter((item) => item.id !== candidate.id);
  withoutDuplicate.unshift(nextCandidate);
  candidatesByTab.set(tabId, withoutDuplicate.slice(0, MAX_CANDIDATES_PER_TAB));
  updateBadge(tabId);
}

function updateCandidate(tabId, candidateId, updates) {
  const current = candidatesByTab.get(tabId) || [];
  candidatesByTab.set(tabId, current.map((candidate) => (
    candidate.id === candidateId ? { ...candidate, ...updates } : candidate
  )));
}

function removeCandidate(tabId, candidateId) {
  const current = candidatesByTab.get(tabId) || [];
  candidatesByTab.set(tabId, current.filter((candidate) => candidate.id !== candidateId));
  updateBadge(tabId);
}

function updateBadge(tabId) {
  const count = candidatesByTab.get(tabId)?.length || 0;
  chrome.action.setBadgeText({
    tabId,
    text: count > 0 ? String(Math.min(count, 99)) : ''
  });
  if (count > 0) {
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#0f766e' });
  }
}

async function buildForwardHeaders({ mediaUrl, pageUrl, requestHeaders }) {
  const headers = {};

  const userAgent = requestHeaders['User-Agent'] || requestHeaders['user-agent'];
  if (userAgent) {
    headers['User-Agent'] = userAgent;
  }

  const authorization = requestHeaders.Authorization || requestHeaders.authorization;
  if (authorization) {
    headers.Authorization = authorization;
  }

  headers.Referer = requestHeaders.Referer || requestHeaders.referer || pageUrl;

  const cookie = await getCookieHeader(mediaUrl);
  if (cookie) {
    headers.Cookie = cookie;
  }

  return headers;
}

async function getCookieHeader(url) {
  try {
    const cookies = await chrome.cookies.getAll({ url });
    return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  } catch {
    return '';
  }
}

async function getTab(tabId) {
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return null;
  }
}

async function getVideoPreviewMetadata(tabId, tab) {
  try {
    const metadata = await chrome.tabs.sendMessage(tabId, { type: 'getVideoPreviewMetadata' });
    if (metadata?.previewImageUrl || !metadata?.previewRect || !tab?.windowId) {
      return metadata || {};
    }

    return {
      ...metadata,
      previewImageUrl: await capturePreviewRect(tab.windowId, metadata.previewRect, metadata.viewport)
    };
  } catch {
    return {};
  }
}

async function capturePreviewRect(windowId, rect, viewport) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
      format: 'jpeg',
      quality: 70
    });
    return await cropDataUrl(dataUrl, rect, viewport);
  } catch {
    return '';
  }
}

async function cropDataUrl(dataUrl, rect, viewport) {
  const response = await fetch(dataUrl);
  const bitmap = await createImageBitmap(await response.blob());
  const scaleX = viewport?.width ? bitmap.width / viewport.width : 1;
  const scaleY = viewport?.height ? bitmap.height / viewport.height : scaleX;
  const sx = Math.max(0, Math.round(rect.x * scaleX));
  const sy = Math.max(0, Math.round(rect.y * scaleY));
  const sw = Math.max(1, Math.min(bitmap.width - sx, Math.round(rect.width * scaleX)));
  const sh = Math.max(1, Math.min(bitmap.height - sy, Math.round(rect.height * scaleY)));
  const canvas = new OffscreenCanvas(320, Math.max(1, Math.round((sh / sw) * 320)));
  const context = canvas.getContext('2d');
  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.74 });
  return await blobToDataUrl(blob);
}

async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

function headersArrayToObject(headers) {
  const result = {};
  for (const header of headers) {
    result[header.name] = header.value || '';
  }
  return result;
}
