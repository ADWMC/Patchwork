export async function retry(operation, { retries = 2, wait = async () => {} } = {}) {
  let attempt = 0
  while (attempt < retries) {
    try { return await operation() } catch (error) {
      attempt += 1
      if (attempt >= retries) throw error
      await wait(attempt)
    }
  }
  throw new Error('no attempt made')
}
