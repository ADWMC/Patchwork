export class MemoryStore {
  constructor() { this.revision = 0; this.value = null }
  put(value, expectedRevision) {
    if (expectedRevision !== this.revision) throw new Error('REVISION_CONFLICT')
    this.value = value; this.revision += 1
    return { value: this.value, revision: this.revision }
  }
}
