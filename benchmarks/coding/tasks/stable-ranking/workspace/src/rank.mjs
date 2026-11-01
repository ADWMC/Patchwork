export function rankItems(items) {
  return items.sort((a, b) => b.score - a.score)
}
