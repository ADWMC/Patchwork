export async function retry(operation, { retries = 2, wait = async () => {} } = {}) {
  let attempt = 0
  while (true) {
    try { return await operation() } catch (error) {
      if (attempt >= retries) throw error
      attempt += 1
      await wait(attempt)
    }
  }
}
