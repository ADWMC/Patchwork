export function isPassed(receipt) {
  return receipt.exitCode === 0 || receipt.isError === false
}
