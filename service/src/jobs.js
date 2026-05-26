import crypto from 'node:crypto';

export class JobStore {
  constructor(idFactory = () => crypto.randomUUID()) {
    this.idFactory = idFactory;
    this.jobs = new Map();
  }

  create(input) {
    const now = new Date().toISOString();
    const job = {
      id: this.idFactory(),
      status: 'queued',
      url: input.url,
      title: input.title || 'video',
      pageUrl: input.pageUrl || '',
      type: input.type || 'file',
      outputDir: input.outputDir || '',
      progress: {
        percent: 0,
        statusText: 'Queued'
      },
      logs: [],
      createdAt: now,
      updatedAt: now
    };

    this.jobs.set(job.id, job);
    return { ...job, logs: [...job.logs] };
  }

  get(id) {
    const job = this.jobs.get(id);
    return job ? { ...job, logs: [...job.logs] } : null;
  }

  list() {
    return [...this.jobs.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((job) => ({ ...job, logs: [...job.logs] }));
  }

  markRunning(id, pid) {
    this.patch(id, { status: 'running', pid });
  }

  appendLog(id, line) {
    const job = this.require(id);
    job.logs.push(line);
    if (job.logs.length > 200) {
      job.logs.splice(0, job.logs.length - 200);
    }
    job.updatedAt = new Date().toISOString();
  }

  updateProgress(id, progress) {
    const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
    this.patch(id, {
      progress: {
        percent,
        statusText: progress.statusText || `${percent}%`
      }
    });
  }

  markCompleted(id, exitCode) {
    this.patch(id, {
      status: 'completed',
      progress: {
        percent: 100,
        statusText: 'Completed'
      },
      exitCode,
      finishedAt: new Date().toISOString()
    });
  }

  markFailed(id, error, exitCode = null) {
    this.patch(id, {
      status: 'failed',
      error,
      exitCode,
      finishedAt: new Date().toISOString()
    });
  }

  patch(id, updates) {
    const job = this.require(id);
    Object.assign(job, updates, { updatedAt: new Date().toISOString() });
  }

  require(id) {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error(`Unknown job: ${id}`);
    }
    return job;
  }
}
