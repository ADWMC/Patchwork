export function isPassed(receipt) {
  return receipt?.outcome === 'passed' && receipt.exitCode === 0
}
