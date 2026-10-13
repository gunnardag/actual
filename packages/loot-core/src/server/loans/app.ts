import { createApp } from '#server/app';
import * as db from '#server/db';
import { toDateRepr } from '#server/models';
import { mutator } from '#server/mutators';
import { undoable } from '#server/undo';
import type {
  LoanEntity,
  LoanEntryEntity,
  LoanEntryKind,
  LoanSummary,
} from '#types/models';

import {
  defaultCategoryKinds,
  ensureDefaultCategory,
  ensureLoansAccount,
  getLoan,
  getLoansAccountId,
  getLoanSummaries,
} from './core';

export type LoansHandlers = {
  'loans-get': typeof getLoans;
  'loans-account-get': typeof getLoansAccountId;
  'loan-entries-get': typeof getLoanEntries;
  'loan-create': typeof createLoan;
  'loan-update': typeof updateLoan;
  'loan-delete': typeof deleteLoan;
  'loan-entry-create': typeof createLoanEntry;
  'loan-entry-delete': typeof deleteLoanEntry;
  'loan-adjust-to': typeof adjustLoanTo;
};

export const app = createApp<LoansHandlers>();
app.method('loans-get', getLoans);
app.method('loans-account-get', getLoansAccountId);
app.method('loan-entries-get', getLoanEntries);
app.method('loan-create', mutator(undoable(createLoan)));
app.method('loan-update', mutator(undoable(updateLoan)));
app.method('loan-delete', mutator(undoable(deleteLoan)));
app.method('loan-entry-create', mutator(undoable(createLoanEntry)));
app.method('loan-entry-delete', mutator(undoable(deleteLoanEntry)));
app.method('loan-adjust-to', mutator(undoable(adjustLoanTo)));

async function getLoans(): Promise<LoanSummary[]> {
  return getLoanSummaries();
}

async function getLoanEntries({
  loan,
}: {
  loan: LoanEntity['id'];
}): Promise<LoanEntryEntity[]> {
  const rows = await db.all<db.DbLoanEntry>(
    'SELECT * FROM loan_entries WHERE loan = ? AND tombstone = 0 ORDER BY date DESC, id',
    [loan],
  );
  return rows.map(row => ({
    id: row.id,
    loan: row.loan,
    date: db.fromDateRepr(row.date),
    kind: row.kind,
    amount: row.amount,
    notes: row.notes ?? null,
  }));
}

async function createLoan({
  name,
  payee,
  direction,
  start_date,
  opening_balance = 0,
  income_category,
  expense_category,
}: Pick<LoanEntity, 'name' | 'payee' | 'direction' | 'start_date'> &
  Partial<
    Pick<LoanEntity, 'opening_balance' | 'income_category' | 'expense_category'>
  >): Promise<LoanEntity['id']> {
  if (!name.trim()) {
    throw new Error('A loan needs a name');
  }
  if (!payee) {
    throw new Error('A loan needs a counterparty');
  }

  // Covered purchases only exist on loans I owe (Q27)
  if (direction === 'owe') {
    await ensureLoansAccount();
  }

  const kinds = defaultCategoryKinds(direction);
  return db.insertWithUUID('loans', {
    name: name.trim(),
    payee,
    direction,
    start_date: toDateRepr(start_date),
    opening_balance,
    income_category:
      income_category ?? (await ensureDefaultCategory(kinds.income)),
    expense_category:
      expense_category ?? (await ensureDefaultCategory(kinds.expense)),
    closed: 0,
  });
}

async function updateLoan(
  loan: Pick<LoanEntity, 'id'> &
    Partial<
      Pick<
        LoanEntity,
        | 'name'
        | 'start_date'
        | 'opening_balance'
        | 'income_category'
        | 'expense_category'
        | 'closed'
      >
    >,
): Promise<void> {
  const { start_date, closed, name, ...rest } = loan;
  await db.update('loans', {
    ...rest,
    ...(name !== undefined ? { name: name.trim() } : {}),
    ...(start_date !== undefined ? { start_date: toDateRepr(start_date) } : {}),
    ...(closed !== undefined ? { closed: closed ? 1 : 0 } : {}),
  });
}

/** Only a loan with nothing linked to it can be deleted (Q24). */
async function deleteLoan({ id }: Pick<LoanEntity, 'id'>): Promise<void> {
  const linked = await db.first<{ id: string }>(
    `SELECT id FROM transactions WHERE loan = ? AND tombstone = 0 LIMIT 1`,
    [id],
  );
  const entry = await db.first<{ id: string }>(
    `SELECT id FROM loan_entries WHERE loan = ? AND tombstone = 0 LIMIT 1`,
    [id],
  );
  if (linked || entry) {
    throw new Error('Unlink its transactions and entries before deleting');
  }
  await db.delete_('loans', id);
}

async function createLoanEntry({
  loan,
  date,
  kind,
  amount,
  notes,
}: Pick<LoanEntryEntity, 'loan' | 'date' | 'kind' | 'amount'> &
  Partial<Pick<LoanEntryEntity, 'notes'>>): Promise<LoanEntryEntity['id']> {
  if (!(await getLoan(loan))) {
    throw new Error('Loan not found');
  }
  return db.insertWithUUID('loan_entries', {
    loan,
    date: toDateRepr(date),
    kind,
    amount,
    notes: notes ?? null,
  });
}

async function deleteLoanEntry({
  id,
}: Pick<LoanEntryEntity, 'id'>): Promise<void> {
  await db.delete_('loan_entries', id);
}

/** Bring the balance to a figure from a statement (Q4, Q21). */
async function adjustLoanTo({
  loan,
  date,
  balance,
  notes,
}: {
  loan: LoanEntity['id'];
  date: string;
  balance: number;
  notes?: string | null;
}): Promise<LoanEntryEntity['id'] | null> {
  const summary = (await getLoanSummaries()).find(item => item.id === loan);
  if (!summary) {
    throw new Error('Loan not found');
  }
  const difference = balance - summary.balance;
  if (difference === 0) {
    return null;
  }
  const kind: LoanEntryKind = 'adjustment';
  return createLoanEntry({ loan, date, kind, amount: difference, notes });
}
