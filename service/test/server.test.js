import test from 'node:test';
import assert from 'node:assert/strict';

import { createServer } from '../src/server.js';
import { JobStore } from '../src/jobs.js';

test('routes job control actions to the download controller', async () => {
  const store = new JobStore(() => 'job-1');
  const job = store.create({ url: 'https://example.com/video.mp4' });
  const actions = [];
  const controller = {
    pause(id) {
      actions.push(['pause', id]);
      return { ...job, id, status: 'paused' };
    },
    resume(id) {
      actions.push(['resume', id]);
      return { ...job, id, status: 'running' };
    },
    stop(id) {
      actions.push(['stop', id]);
      return { ...job, id, status: 'stopped' };
    }
  };

  const server = createServer({ store, controller });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    const pause = await fetch(`http://127.0.0.1:${port}/api/jobs/job-1/pause`, { method: 'POST' });
    const resume = await fetch(`http://127.0.0.1:${port}/api/jobs/job-1/resume`, { method: 'POST' });
    const stop = await fetch(`http://127.0.0.1:${port}/api/jobs/job-1/stop`, { method: 'POST' });

    assert.equal(pause.status, 200);
    assert.equal((await pause.json()).job.status, 'paused');
    assert.equal(resume.status, 200);
    assert.equal((await resume.json()).job.status, 'running');
    assert.equal(stop.status, 200);
    assert.equal((await stop.json()).job.status, 'stopped');
    assert.deepEqual(actions, [
      ['pause', 'job-1'],
      ['resume', 'job-1'],
      ['stop', 'job-1']
    ]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
