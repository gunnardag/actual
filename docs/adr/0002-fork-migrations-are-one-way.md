---
status: accepted
---

# Fork migrations are additive-only, and lock the budget to the fork

The loan book needs budget-file migrations that upstream doesn't have: new tables and a loan link column on `transactions`. They must be additive-only (new tables and columns, never changing or dropping existing ones), in line with upstream's `ADDITIVE_ONLY_CUTOFF` rule, so that upstream migrations keep applying cleanly when the fork is rebased onto new releases.

This fork is personal and won't be contributed upstream for now. We accept that once a fork migration has run on a budget, a *newer* upstream release refuses to open it with `out-of-sync-migrations`: it sees an unknown migration next to one of its own that hasn't run. The same upstream version still opens it.

## Consequences

- Every client that opens the budget must run the fork: the web UI served by the fork's sync-server image, or a desktop build of the fork. Stock desktop and mobile apps are out.
- The way back to upstream is restoring a backup, removing the fork's rows from `__migrations__` (and its tables), or getting the feature merged upstream.
- Take a backup and an export before deploying any fork build that adds a migration.
