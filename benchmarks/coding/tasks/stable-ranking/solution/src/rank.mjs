export function rankItems(items) {
  return items.map((item, index) => ({ item, index })).sort((a, b) => b.item.score - a.item.score || a.index - b.index).map(({ item }) => item)
}
