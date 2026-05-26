import test from 'node:test';
import assert from 'node:assert/strict';

import { DownloadController } from '../src/controller.js';
import { JobStore } from '../src/jobs.js';

test('pauses, resumes, and stops a registered download process', () => {
  let nextId = 0;
  const store = new JobStore(() => `job-${++nextId}`);
  const job = store.create({ url: 'https://example.com/video.mp4' });
  store.markRunning(job.id, 4321);

  const signals = [];
  const child = {
    pid: 4321,
    kill(signal) {
      signals.push(signal);
      return true;
    }
  };

  const controller = new DownloadController(store);
  controller.register(job.id, child);

  const paused = controller.pause(job.id);
  assert.equal(paused.status, 'paused');
  assert.equal(signals.at(-1), 'SIGSTOP');

  const resumed = controller.resume(job.id);
  assert.equal(resumed.status, 'running');
  assert.equal(signals.at(-1), 'SIGCONT');

  const stopped = controller.stop(job.id);
  assert.equal(stopped.status, 'stopped');
  assert.equal(signals.at(-1), 'SIGTERM');
});

test('rejects invalid control transitions', () => {
  const store = new JobStore(() => 'job-1');
  const job = store.create({ url: 'https://example.com/video.mp4' });
  const controller = new DownloadController(store);

  assert.throws(() => controller.pause(job.id), /can only pause running jobs/);
  assert.throws(() => controller.resume(job.id), /can only resume paused jobs/);
  assert.throws(() => controller.stop('missing'), /Job not found/);
});
