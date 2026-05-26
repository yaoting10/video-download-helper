const SERVICE_URL = 'http://127.0.0.1:17321';

const stateEl = document.querySelector('#service-state');
const candidatesEl = document.querySelector('#candidates');
const emptyEl = document.querySelector('#empty');
const refreshEl = document.querySelector('#refresh');
const clearEl = document.querySelector('#clear');

let activeTab = null;
let candidates = [];
const jobsByCandidateId = new Map();
let pollTimer = null;

document.addEventListener('DOMContentLoaded', init);
refreshEl.addEventListener('click', load);
clearEl.addEventListener('click', clearCandidates);

async function init() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tabs[0] || null;
  await load();
}

async function load() {
  await Promise.all([checkService(), loadCandidates()]);
  render();
}

async function checkService() {
  try {
    const response = await fetch(`${SERVICE_URL}/api/health`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    stateEl.textContent = `Service ready · ${data.outputDir}`;
  } catch {
    stateEl.textContent = 'Start local service with: npm start';
  }
}

async function loadCandidates() {
  if (!activeTab) {
    candidates = [];
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: 'getCandidates',
    tabId: activeTab.id
  });

  candidates = response?.candidates || [];
}

async function clearCandidates() {
  if (!activeTab) {
    return;
  }

  await chrome.runtime.sendMessage({
    type: 'clearCandidates',
    tabId: activeTab.id
  });

  candidates = [];
  render();
}

function render() {
  candidatesEl.replaceChildren();
  emptyEl.hidden = candidates.length > 0;

  for (const candidate of candidates) {
    candidatesEl.appendChild(renderCandidate(candidate));
  }
}

function renderCandidate(candidate) {
  const item = document.createElement('article');
  item.className = 'candidate';

  const title = document.createElement('div');
  title.className = 'candidate-title';
  title.textContent = candidate.tabTitle || 'video';

  const url = document.createElement('div');
  url.className = 'candidate-url';
  url.textContent = candidate.url;

  const meta = document.createElement('div');
  meta.className = 'candidate-meta';
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = inferType(candidate);
  const time = document.createElement('span');
  time.textContent = new Date(candidate.discoveredAt).toLocaleTimeString();
  meta.append(badge, time);

  const actions = document.createElement('div');
  actions.className = 'actions';
  const download = document.createElement('button');
  download.className = 'primary';
  const job = jobsByCandidateId.get(candidate.id);
  download.textContent = job ? labelForJob(job) : 'Download';
  download.disabled = Boolean(job && ['queued', 'running', 'completed'].includes(job.status));
  download.addEventListener('click', () => startDownload(candidate, download));
  actions.append(download);

  item.append(title, url, meta, actions);
  if (job) {
    item.append(renderProgress(job));
  }
  return item;
}

async function startDownload(candidate, button) {
  button.disabled = true;
  button.textContent = 'Sending...';

  try {
    const response = await fetch(`${SERVICE_URL}/api/downloads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(candidate)
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    jobsByCandidateId.set(candidate.id, payload.job);
    button.textContent = 'Queued';
    render();
    startPolling();
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Retry';
    stateEl.textContent = error.message;
  }
}

function startPolling() {
  if (pollTimer) {
    return;
  }

  pollTimer = setInterval(pollJobs, 1500);
  pollJobs();
}

async function pollJobs() {
  const running = [...jobsByCandidateId.values()].filter((job) => ['queued', 'running'].includes(job.status));
  if (running.length === 0) {
    clearInterval(pollTimer);
    pollTimer = null;
    return;
  }

  await Promise.all(running.map(refreshJob));
  render();
}

async function refreshJob(job) {
  try {
    const response = await fetch(`${SERVICE_URL}/api/jobs/${encodeURIComponent(job.id)}`);
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    for (const [candidateId, currentJob] of jobsByCandidateId) {
      if (currentJob.id === job.id) {
        jobsByCandidateId.set(candidateId, payload.job);
      }
    }
  } catch {
    stateEl.textContent = 'Cannot reach local service while polling progress.';
  }
}

function renderProgress(job) {
  const progress = job.progress || { percent: 0, statusText: job.status };
  const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));

  const panel = document.createElement('div');
  panel.className = 'progress-panel';

  const row = document.createElement('div');
  row.className = 'progress-row';

  const status = document.createElement('span');
  status.textContent = progress.statusText || job.status;

  const value = document.createElement('span');
  value.textContent = `${percent.toFixed(percent % 1 === 0 ? 0 : 1)}%`;

  const track = document.createElement('div');
  track.className = 'progress-track';

  const fill = document.createElement('div');
  fill.className = `progress-fill${job.status === 'failed' ? ' failed' : ''}`;
  fill.style.width = `${percent}%`;

  track.append(fill);
  row.append(status, value);
  panel.append(row, track);

  if (job.status === 'failed' && job.error) {
    const error = document.createElement('div');
    error.className = 'candidate-url';
    error.textContent = job.error;
    panel.append(error);
  }

  return panel;
}

function labelForJob(job) {
  if (job.status === 'completed') return 'Done';
  if (job.status === 'failed') return 'Retry';
  return 'Downloading';
}

function inferType(candidate) {
  const url = candidate.url.toLowerCase();
  if (url.includes('.m3u8')) return 'HLS';
  if (url.includes('.mpd')) return 'DASH';
  return 'File';
}
