# Shared Contracts

Shared TypeScript types used by the dashboard, server, and test engine,
including transient capture sessions/review drafts and the stable normalized
flow contract they produce.

`NormalizedFlow` supports an optional critical action, an optional legacy final
`successAssertion`, and ordered assertions attached to flow steps. At least one
assertion form is required at validated API/execution boundaries.
