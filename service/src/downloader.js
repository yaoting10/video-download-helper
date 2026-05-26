import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { parseYtDlpProgress } from './progress.js';

export function sanitizeFilename(value) {
  const sanitized = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return sanitized || 'video';
}

export function buildYtDlpArgs({ url, title, outputDir, headers = {}, format = 'best', remux = 'mp4' }) {
  if (!url) {
    throw new Error('A download URL is required.');
  }

  const args = [
    '--newline',
    '--no-playlist',
    '--progress-template',
    'download:%(progress._percent_str)s %(progress._speed_str)s ETA %(progress._eta_str)s',
    '--paths',
    outputDir,
    '--output',
    `${sanitizeFilename(title)}.%(ext)s`
  ];

  if (format) {
    args.push('--format', format);
  }

  if (remux) {
    args.push('--remux-video', remux);
  }

  if (headers.Cookie) {
    args.push('--add-header', `Cookie: ${headers.Cookie}`);
  }

  if (headers.Referer) {
    args.push('--referer', headers.Referer);
  }

  if (headers['User-Agent']) {
    args.push('--user-agent', headers['User-Agent']);
  }

  if (headers.Authorization) {
    args.push('--add-header', `Authorization: ${headers.Authorization}`);
  }

  args.push(url);
  return args;
}

export async function startDownload(candidate, options, store) {
  const outputDir = path.resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });

  const job = store.create({
    url: candidate.url,
    title: candidate.title,
    pageUrl: candidate.pageUrl,
    type: candidate.type,
    outputDir
  });

  const args = buildYtDlpArgs({
    url: candidate.url,
    title: candidate.title,
    outputDir,
    headers: candidate.headers,
    format: options.format || 'best',
    remux: options.remux || 'mp4'
  });

  const child = spawn(options.ytDlpPath || 'yt-dlp', args, {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  store.markRunning(job.id, child.pid);

  child.stdout.on('data', (chunk) => {
    for (const line of splitLines(chunk)) {
      store.appendLog(job.id, line);
      updateProgressFromLine(store, job.id, line);
    }
  });

  child.stderr.on('data', (chunk) => {
    for (const line of splitLines(chunk)) {
      store.appendLog(job.id, line);
      updateProgressFromLine(store, job.id, line);
    }
  });

  child.on('error', (error) => {
    store.markFailed(job.id, error.message);
  });

  child.on('close', (code) => {
    if (code === 0) {
      store.markCompleted(job.id, code);
    } else {
      store.markFailed(job.id, `yt-dlp exited with code ${code}`, code);
    }
  });

  return { ...store.get(job.id), command: ['yt-dlp', ...args] };
}

function updateProgressFromLine(store, jobId, line) {
  const progress = parseYtDlpProgress(line);
  if (progress) {
    store.updateProgress(jobId, progress);
  }
}

function splitLines(chunk) {
  return String(chunk)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
