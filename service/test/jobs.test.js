import test from 'node:test';
import assert from 'node:assert/strict';

import { JobStore } from '../src/jobs.js';

test('tracks queued, running, completed, and failed job states', () => {
  let nextId = 0;
  const store = new JobStore(() => `job-${++nextId}`);
  const job = store.create({ url: 'https://example.com/video.mp4', title: 'Video' });

  assert.equal(job.status, 'queued');
  store.markRunning(job.id, 1234);
  assert.equal(store.get(job.id).status, 'running');
  assert.equal(store.get(job.id).pid, 1234);

  store.appendLog(job.id, '50%');
  assert.deepEqual(store.get(job.id).logs, ['50%']);

  store.updateProgress(job.id, {
    percent: 42.5,
    statusText: '42.5% 1.2MiB/s ETA 00:10'
  });
  assert.deepEqual(store.get(job.id).progress, {
    percent: 42.5,
    statusText: '42.5% 1.2MiB/s ETA 00:10'
  });

  store.markCompleted(job.id, 0);
  assert.equal(store.get(job.id).status, 'completed');
  assert.equal(store.get(job.id).progress.percent, 100);
  assert.equal(store.get(job.id).exitCode, 0);

  const failed = store.create({ url: 'https://example.com/fail.mp4' });
  store.markFailed(failed.id, 'boom', 1);
  assert.equal(store.get(failed.id).status, 'failed');
  assert.equal(store.get(failed.id).error, 'boom');
  assert.equal(store.list().length, 2);
});
