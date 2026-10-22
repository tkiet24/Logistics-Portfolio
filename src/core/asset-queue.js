/** Cache downloads/parsing once, limit concurrency, and prioritize visible scenes. */
export class AssetQueue {
  constructor({
    load,
    clone = (value) => value,
    concurrency = 3,
    onChange = () => {},
  }) {
    this.fetch = load;
    this.clone = clone;
    this.limit = concurrency;
    this.onChange = onChange;
    this.cache = new Map();
    this.pending = [];
    this.active = 0;
    this.completed = 0;
    this.failed = 0;
  }
  load(key, { priority = 0 } = {}) {
    let entry = this.cache.get(key);
    if (!entry) {
      let resolve, reject;
      const promise = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
      });
      entry = { key, priority, promise, resolve, reject };
      this.cache.set(key, entry);
      this.pending.push(entry);
      this.pump();
    } else if (priority < entry.priority) {
      entry.priority = priority;
    }
    return entry.promise.then((value) => this.clone(value));
  }
  pump() {
    this.pending.sort((a, b) => a.priority - b.priority);
    while (this.active < this.limit && this.pending.length) {
      const job = this.pending.shift();
      this.active++;
      Promise.resolve()
        .then(() => this.fetch(job.key))
        .then(
          (value) => {
            this.completed++;
            job.resolve(value);
          },
          (error) => {
            this.failed++;
            this.cache.delete(job.key); // A later request can retry a failed model.
            job.reject(error);
          },
        )
        .finally(() => {
          this.active--;
          this.onChange(this.stats());
          this.pump();
        });
    }
  }
  stats() {
    return {
      active: this.active,
      queued: this.pending.length,
      completed: this.completed,
      failed: this.failed,
      cached: this.cache.size,
    };
  }
}
