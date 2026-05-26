import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { DownloadController } from './controller.js';
import { startDownload } from './downloader.js';
import { JobStore } from './jobs.js';
import { normalizeCandidate } from './media.js';

const PORT = Number(process.env.PORT || 17321);
const OUTPUT_DIR = process.env.DOWNLOAD_DIR || path.join(os.homedir(), 'Downloads', 'Video Download Helper');
const YT_DLP_PATH = process.env.YT_DLP_PATH || 'yt-dlp';

const store = new JobStore();
const controller = new DownloadController(store);

export function createServer(options = {}) {
  const jobStore = options.store || store;
  const downloadController = options.controller || controller;
  const outputDir = options.outputDir || OUTPUT_DIR;
  const ytDlpPath = options.ytDlpPath || YT_DLP_PATH;

  return http.createServer(async (request, response) => {
    setCorsHeaders(response);

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    try {
      const url = new URL(request.url, `http://${request.headers.host}`);

      if (request.method === 'GET' && url.pathname === '/api/health') {
        sendJson(response, 200, {
          ok: true,
          service: 'video-download-helper',
          outputDir
        });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/jobs') {
        sendJson(response, 200, { jobs: jobStore.list() });
        return;
      }

      if (request.method === 'GET' && url.pathname.startsWith('/api/jobs/')) {
        const id = decodeURIComponent(url.pathname.replace('/api/jobs/', ''));
        const job = jobStore.get(id);
        sendJson(response, job ? 200 : 404, job ? { job } : { error: 'Job not found.' });
        return;
      }

      const jobAction = matchJobAction(url.pathname);
      if (request.method === 'POST' && jobAction) {
        const { id, action } = jobAction;
        const job = applyJobAction(downloadController, id, action);
        sendJson(response, 200, { job });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/downloads') {
        const body = await readJson(request);
        const candidate = normalizeCandidate(body);
        const job = await startDownload(candidate, {
          outputDir,
          ytDlpPath,
          format: body.format || 'best',
          remux: body.remux || 'mp4'
        }, jobStore, downloadController);

        sendJson(response, 202, { job });
        return;
      }

      sendJson(response, 404, { error: 'Not found.' });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
  });
}

function matchJobAction(pathname) {
  const match = pathname.match(/^\/api\/jobs\/([^/]+)\/(pause|resume|stop)$/);
  if (!match) {
    return null;
  }

  return {
    id: decodeURIComponent(match[1]),
    action: match[2]
  };
}

function applyJobAction(downloadController, id, action) {
  if (action === 'pause') {
    return downloadController.pause(id);
  }
  if (action === 'resume') {
    return downloadController.resume(id);
  }
  return downloadController.stop(id);
}

function setCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Max-Age', '86400');
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload, null, 2));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer().listen(PORT, '127.0.0.1', () => {
    console.log(`Video Download Helper service listening on http://127.0.0.1:${PORT}`);
    console.log(`Downloads will be saved to ${OUTPUT_DIR}`);
  });
}
