export class DownloadController {
  constructor(store) {
    this.store = store;
    this.children = new Map();
  }

  register(jobId, child) {
    this.children.set(jobId, child);
  }

  unregister(jobId) {
    this.children.delete(jobId);
  }

  pause(jobId) {
    const job = this.requireJob(jobId);
    if (job.status !== 'running') {
      throw new Error('You can only pause running jobs.');
    }

    this.signal(jobId, 'SIGSTOP');
    this.store.markPaused(jobId);
    return this.store.get(jobId);
  }

  resume(jobId) {
    const job = this.requireJob(jobId);
    if (job.status !== 'paused') {
      throw new Error('You can only resume paused jobs.');
    }

    this.signal(jobId, 'SIGCONT');
    this.store.markRunning(jobId, job.pid);
    return this.store.get(jobId);
  }

  stop(jobId) {
    const job = this.requireJob(jobId);
    if (!['queued', 'running', 'paused'].includes(job.status)) {
      throw new Error('You can only stop queued, running, or paused jobs.');
    }

    if (this.children.has(jobId)) {
      this.signal(jobId, 'SIGTERM');
    }

    this.store.markStopped(jobId);
    this.unregister(jobId);
    return this.store.get(jobId);
  }

  signal(jobId, signal) {
    const child = this.children.get(jobId);
    if (!child) {
      throw new Error('Download process is not available.');
    }

    child.kill(signal);
  }

  requireJob(jobId) {
    const job = this.store.get(jobId);
    if (!job) {
      throw new Error('Job not found.');
    }
    return job;
  }
}
