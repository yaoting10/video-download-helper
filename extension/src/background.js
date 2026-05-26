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

    addCandidate(details.tabId, {
      id: `${details.requestId}:${details.url}`,
      url: details.url,
      pageUrl: tab?.url || '',
      tabTitle: tab?.title || 'video',
      contentType,
      headers,
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
  const withoutDuplicate = current.filter((item) => item.url !== candidate.url);
  withoutDuplicate.unshift(candidate);
  candidatesByTab.set(tabId, withoutDuplicate.slice(0, MAX_CANDIDATES_PER_TAB));
  chrome.action.setBadgeText({ tabId, text: String(Math.min(withoutDuplicate.length, 99)) });
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#0f766e' });
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

function headersArrayToObject(headers) {
  const result = {};
  for (const header of headers) {
    result[header.name] = header.value || '';
  }
  return result;
}
