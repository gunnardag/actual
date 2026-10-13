---
status: accepted
---

# Loans are their own records, with covered purchases in one shared Loans account

A loan is a new kind of record that transactions link to, not an Actual account. Each counterparty, and each loan, is deliberately *not* its own account. The obvious "a loan is an off-budget or on-budget account plus transfers" model can't follow the loan book's budget rules: a transfer between two on-budget accounts always clears the category, so cash received couldn't count as income and repayments of cash loans couldn't count as spending.

Covered purchases (a counterparty paid for something of mine) still need an account, because the budget only counts categorized spending in on-budget accounts. They go into a single on-budget "Loans" account owned by the loan book, which works like a credit card shared by every counterparty. Repaying a covered purchase is a transfer into that account.

## Considered options

- **One on-budget account per loan**: a per-loan view inside Actual, but it clutters the account list and duplicates the loan book page.
- **Transactions with no account**: fights the account-centric balance, reconciliation and budget engine.

## Consequences

- The Loans account's balance is the total of unrepaid covered purchases, not the total I owe. The loan book is the source of truth for loan balances.
- Linking a transaction to a loan adds a column to `transactions`. Fork migrations must stay additive (see `ADDITIVE_ONLY_CUTOFF`), and a budget migrated by the fork can't be opened by a newer upstream release.
