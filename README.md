# Patchwork

Patchwork is a documentation-first project for a maintainable coding agent.

The project records the working rules that make an implementation agent useful
over time: establish facts before changing code, make the smallest correct
change, verify the affected behavior, and report what actually happened.

It does not currently ship a plugin, prompt, executable, or installer. Those
should be designed only after the intended DSH integration and acceptance
criteria are clear.

## Documents

- [Engineering agent guide](docs/engineering-agent-guide.md): the operating
  rules for investigation, implementation, debugging, and verification.
- [Preset and release lessons](docs/preset-and-release-lessons.md): reusable
  lessons from deploying an agent preset into a changing host environment.
- [Source notes](docs/source-notes.md): the materials consolidated here and
  the boundaries of this migration.

## Intended outcome

Patchwork should eventually help with implementation, debugging, maintenance,
and refactoring without treating a successful-looking answer as proof. Its
future behavior should be guided by the documents in this repository and by
the conventions of the project it is asked to change.
