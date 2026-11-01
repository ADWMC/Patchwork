import { boundedText } from './policy.mjs'

// Match ZCode's observation-first interaction: use accessible facts, require
// uniqueness, and ask for a fresh snapshot when the page no longer matches.
export async function observedLocator(page, args, currentObservation) {
  if (!args.target) return page.locator(boundedText(args.selector, 'selector', 1000))
  if (args.selector !== undefined) throw new Error('Use either target or selector, not both')
  if (!args.observationId || args.observationId !== currentObservation) throw new Error('Page observation expired; take a fresh snapshot before acting')
  const { by, value, name } = args.target
  const text = boundedText(value, 'target value', 1000)
  let locator
  switch (by) {
    case 'role': locator = page.getByRole(text, name === undefined ? {} : { name: boundedText(name, 'target name', 1000), exact: true }); break
    case 'text': locator = page.getByText(text, { exact: true }); break
    case 'label': locator = page.getByLabel(text, { exact: true }); break
    case 'placeholder': locator = page.getByPlaceholder(text, { exact: true }); break
    case 'testId': locator = page.getByTestId(text); break
    default: throw new Error('Unsupported semantic locator')
  }
  const count = await locator.count()
  if (count !== 1) throw new Error(count === 0 ? 'Target disappeared; take a fresh snapshot' : 'Target is ambiguous; narrow the locator using a fresh snapshot')
  return locator
}
