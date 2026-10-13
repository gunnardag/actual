import { v4 as uuidv4 } from 'uuid';

import * as db from '#server/db';
import { fromDateRepr } from '#server/models';
import type {
  LoanDirection,
  LoanEntity,
  LoanHistoryItem,
  LoanSummary,
  TransactionEntity,
} from '#types/models';

const LOANS_ACCOUNT_PREF = 'loans-account';

/** The default categories the loan book creates on first use (Q13). */
export type DefaultLoanCategory = 'borrowed' | 'repayments' | 'lent' | 'repaid';

const DEFAULT_CATEGORIES: Record<
  DefaultLoanCategory,
  { name: string; isIncome: boolean }
> = {
  borrowed: { name: 'Borrowed money', isIncome: true },
  repayments: { name: 'Loan repayments', isIncome: false },
  lent: { name: 'Money lent', isIncome: false },
  repaid: { name: 'Loans repaid to me', isIncome: true },
};

const LOANS_GROUP_NAME = 'Loans';
const LOANS_ACCOUNT_NAME = 'Loans';

async function getPref(id: string): Promise<string | null> {
  const row = await db.first<Pick<db.DbPreference, 'value'>>(
    'SELECT value FROM preferences WHERE id = ?',
    [id],
  );
  return row?.value ?? null;
}

export async function getLoansAccountId(): Promise<string | null> {
  const id = await getPref(LOANS_ACCOUNT_PREF);
  if (!id) {
    return null;
  }
  const account = await db.first<Pick<db.DbAccount, 'id'>>(
    'SELECT id FROM accounts WHERE id = ? AND tombstone = 0',
    [id],
  );
  return account ? account.id : null;
}

/** The shared on-budget account that holds covered purchases (ADR 0001). */
export async function ensureLoansAccount(): Promise<string> {
  const existing = await getLoansAccountId();
  if (existing) {
    return existing;
  }

  const id = await db.insertAccount({
    name: LOANS_ACCOUNT_NAME,
    offbudget: 0,
  });
  await db.insertPayee({ name: '', transfer_acct: id });
  await db.update('preferences', { id: LOANS_ACCOUNT_PREF, value: id });
  return id;
}

async function getLoansAccountTransferPayee(
  loansAccountId: string,
): Promise<string | null> {
  const payee = await db.first<Pick<db.DbPayee, 'id'>>(
    'SELECT id FROM payees WHERE transfer_acct = ? AND tombstone = 0',
    [loansAccountId],
  );
  return payee ? payee.id : null;
}

async function findOrCreateGroup(isIncome: boolean): Promise<string> {
  if (isIncome) {
    const group = await db.first<Pick<db.DbCategoryGroup, 'id'>>(
      'SELECT id FROM category_groups WHERE is_income = 1 AND tombstone = 0 ORDER BY sort_order, id LIMIT 1',
    );
    if (group) {
      return group.id;
    }
    return db.insertCategoryGroup({ name: 'Income', is_income: 1 });
  }

  const group = await db.first<Pick<db.DbCategoryGroup, 'id'>>(
    'SELECT id FROM category_groups WHERE is_income = 0 AND tombstone = 0 AND UPPER(name) = ? LIMIT 1',
    [LOANS_GROUP_NAME.toUpperCase()],
  );
  if (group) {
    return group.id;
  }
  return db.insertCategoryGroup({ name: LOANS_GROUP_NAME, is_income: 0 });
}

export async function ensureDefaultCategory(
  kind: DefaultLoanCategory,
): Promise<string> {
  const prefId = `loans-category-${kind}`;
  const savedId = await getPref(prefId);
  if (savedId) {
    const category = await db.first<Pick<db.DbCategory, 'id'>>(
      'SELECT id FROM categories WHERE id = ? AND tombstone = 0',
      [savedId],
    );
    if (category) {
      return category.id;
    }
  }

  const { name, isIncome } = DEFAULT_CATEGORIES[kind];
  const groupId = await findOrCreateGroup(isIncome);
  const existing = await db.first<Pick<db.DbCategory, 'id'>>(
    'SELECT id FROM categories WHERE cat_group = ? AND UPPER(name) = ? AND tombstone = 0 LIMIT 1',
    [groupId, name.toUpperCase()],
  );
  const id =
    existing?.id ??
    (await db.insertCategory(
      { name, cat_group: groupId, is_income: isIncome ? 1 : 0 },
      { atEnd: true },
    ));

  await db.update('preferences', { id: prefId, value: id });
  return id;
}

export function defaultCategoryKinds(direction: LoanDirection): {
  income: DefaultLoanCategory;
  expense: DefaultLoanCategory;
} {
  return direction === 'owe'
    ? { income: 'borrowed', expense: 'repayments' }
    : { income: 'repaid', expense: 'lent' };
}

type LinkedRow = {
  id: string;
  loan: string;
  account: string;
  amount: number;
  date: number;
  payee: string | null;
  notes: string | null;
  transfer_id: string | null;
  transfer_acct: string | null;
};

/**
 * How much a linked transaction changes a loan's balance, and how much of
 * that is covered purchases. Positive means more is owed (in the loan's
 * direction).
 */
export function linkedTransactionEffect(
  direction: LoanDirection,
  transaction: Pick<LinkedRow, 'account' | 'amount' | 'transfer_id'> & {
    transfer_acct?: string | null;
  },
  loansAccountId: string | null,
): { delta: number; covered: number } {
  if (loansAccountId && transaction.account === loansAccountId) {
    // The Loans-account side of a repayment transfer is only a mirror; the
    // bank side carries the link
    if (transaction.transfer_id) {
      return { delta: 0, covered: 0 };
    }
    return { delta: -transaction.amount, covered: -transaction.amount };
  }

  const delta = direction === 'owe' ? transaction.amount : -transaction.amount;
  const isCoveredRepayment =
    direction === 'owe' &&
    loansAccountId != null &&
    transaction.transfer_acct === loansAccountId;
  return { delta, covered: isCoveredRepayment ? delta : 0 };
}

async function getLinkedRows(loanIds?: string[]): Promise<LinkedRow[]> {
  const filter =
    loanIds && loanIds.length > 0
      ? `AND t.loan IN (${loanIds.map(() => '?').join(', ')})`
      : '';
  return db.all<LinkedRow>(
    `SELECT t.id, t.loan, t.account, t.amount, t.date, t.payee, t.notes,
            t.transfer_id, p.transfer_acct
       FROM v_transactions_internal_alive t
       LEFT JOIN payees p ON p.id = t.payee
      WHERE t.loan IS NOT NULL AND t.is_parent = 0 ${filter}`,
    loanIds ?? [],
  );
}

function toLoanEntity(row: db.DbLoan): LoanEntity {
  return {
    id: row.id,
    name: row.name,
    payee: row.payee,
    direction: row.direction,
    start_date: fromDateRepr(row.start_date),
    opening_balance: row.opening_balance ?? 0,
    income_category: row.income_category ?? null,
    expense_category: row.expense_category ?? null,
    closed: row.closed === 1,
  };
}

export async function getLoan(id: string): Promise<LoanEntity | null> {
  const row = await db.first<db.DbLoan>(
    'SELECT * FROM loans WHERE id = ? AND tombstone = 0',
    [id],
  );
  return row ? toLoanEntity(row) : null;
}

export async function getLoanSummaries(): Promise<LoanSummary[]> {
  const loans = await db.all<db.DbLoan>(
    'SELECT * FROM loans WHERE tombstone = 0 ORDER BY start_date, id',
  );
  if (loans.length === 0) {
    return [];
  }

  const loansAccountId = await getLoansAccountId();
  const entries = await db.all<db.DbLoanEntry>(
    'SELECT * FROM loan_entries WHERE tombstone = 0',
  );
  const linked = await getLinkedRows();

  return loans.map(row => {
    const loan = toLoanEntity(row);
    let balance = loan.opening_balance;
    let covered = 0;
    let original = loan.opening_balance;
    let lastActivity: number | null = null;

    const touch = (date: number) => {
      if (lastActivity == null || date > lastActivity) {
        lastActivity = date;
      }
    };

    for (const entry of entries) {
      if (entry.loan !== loan.id) {
        continue;
      }
      balance += entry.amount;
      if (entry.amount > 0) {
        original += entry.amount;
      }
      touch(entry.date);
    }

    for (const transaction of linked) {
      if (transaction.loan !== loan.id) {
        continue;
      }
      const effect = linkedTransactionEffect(
        loan.direction,
        transaction,
        loansAccountId,
      );
      balance += effect.delta;
      covered += effect.covered;
      if (effect.delta > 0) {
        original += effect.delta;
      }
      touch(transaction.date);
    }

    return {
      ...loan,
      balance,
      covered: Math.max(covered, 0),
      original,
      last_activity:
        lastActivity != null ? fromDateRepr(lastActivity) : loan.start_date,
    };
  });
}

/** Every change to a loan, newest first, with the balance after each. */
export async function getLoanHistory(
  loanId: string,
): Promise<LoanHistoryItem[]> {
  const loan = await getLoan(loanId);
  if (!loan) {
    return [];
  }
  const loansAccountId = await getLoansAccountId();
  const entries = await db.all<db.DbLoanEntry>(
    'SELECT * FROM loan_entries WHERE loan = ? AND tombstone = 0',
    [loanId],
  );
  const linked = await getLinkedRows([loanId]);

  type Item = Omit<LoanHistoryItem, 'balance' | 'date'> & { date: number };
  const items: Item[] = [
    ...entries.map(
      (entry): Item => ({
        id: entry.id,
        type: entry.kind,
        date: entry.date,
        delta: entry.amount,
        notes: entry.notes ?? null,
      }),
    ),
    ...linked
      .map(
        (row): Item => ({
          id: row.id,
          type: 'transaction',
          date: row.date,
          delta: linkedTransactionEffect(loan.direction, row, loansAccountId)
            .delta,
          account: row.account,
          payee: row.payee,
          notes: row.notes,
        }),
      )
      .filter(item => item.delta !== 0),
  ].sort((a, b) => a.date - b.date || a.id.localeCompare(b.id));

  let balance = loan.opening_balance;
  const history: LoanHistoryItem[] = [
    {
      id: `${loan.id}-opening`,
      type: 'opening',
      date: loan.start_date,
      delta: loan.opening_balance,
      balance,
    },
  ];
  for (const item of items) {
    balance += item.delta;
    history.push({ ...item, date: fromDateRepr(item.date), balance });
  }
  return history.reverse();
}

async function getCoveredOutstanding(
  loanId: string,
  loansAccountId: string | null,
): Promise<number> {
  if (!loansAccountId) {
    return 0;
  }
  const rows = await getLinkedRows([loanId]);
  return Math.max(
    rows.reduce(
      (sum, row) =>
        sum + linkedTransactionEffect('owe', row, loansAccountId).covered,
      0,
    ),
    0,
  );
}

type LoanContext = {
  loans: Map<string, LoanEntity>;
  openLoansByPayee: Map<string, LoanEntity[]>;
  loansAccountId: string | null;
  loansTransferPayee: string | null;
  transferPayees: Set<string>;
  offbudgetAccounts: Set<string>;
  /** Covered purchases still to repay, per loan, as allocated so far. */
  coveredLeft: Map<string, number>;
};

async function loadContext(): Promise<LoanContext | null> {
  const rows = await db.all<db.DbLoan>(
    'SELECT * FROM loans WHERE tombstone = 0 ORDER BY start_date, id',
  );
  if (rows.length === 0) {
    return null;
  }

  const loans = new Map<string, LoanEntity>();
  const openLoansByPayee = new Map<string, LoanEntity[]>();
  for (const row of rows) {
    const loan = toLoanEntity(row);
    loans.set(loan.id, loan);
    if (!loan.closed) {
      const list = openLoansByPayee.get(loan.payee) ?? [];
      list.push(loan);
      openLoansByPayee.set(loan.payee, list);
    }
  }

  const loansAccountId = await getLoansAccountId();
  const transferPayees = new Set(
    (
      await db.all<Pick<db.DbPayee, 'id'>>(
        'SELECT id FROM payees WHERE transfer_acct IS NOT NULL',
      )
    ).map(payee => payee.id),
  );
  const offbudgetAccounts = new Set(
    (
      await db.all<Pick<db.DbAccount, 'id'>>(
        'SELECT id FROM accounts WHERE offbudget = 1',
      )
    ).map(account => account.id),
  );

  return {
    loans,
    openLoansByPayee,
    loansAccountId,
    loansTransferPayee: loansAccountId
      ? await getLoansAccountTransferPayee(loansAccountId)
      : null,
    transferPayees,
    offbudgetAccounts,
    coveredLeft: new Map(),
  };
}

/** The oldest open loan with this payee (Q26). */
function pickLoan(
  context: LoanContext,
  payee: string | null | undefined,
): string | null {
  if (!payee || context.transferPayees.has(payee)) {
    return null;
  }
  return context.openLoansByPayee.get(payee)?.[0]?.id ?? null;
}

async function coveredLeft(
  context: LoanContext,
  loanId: string,
): Promise<number> {
  if (!context.coveredLeft.has(loanId)) {
    context.coveredLeft.set(
      loanId,
      await getCoveredOutstanding(loanId, context.loansAccountId),
    );
  }
  return context.coveredLeft.get(loanId) ?? 0;
}

/**
 * Apply the loan book's rules to a transaction that is linked to a loan and
 * has no category yet (Q9, Q14, Q17, Q19). Returns extra split children to
 * insert when a repayment covers both covered purchases and cash.
 */
async function applyLoanRules(
  context: LoanContext,
  transaction: Partial<TransactionEntity>,
  { allowSplit }: { allowSplit: boolean },
): Promise<TransactionEntity[]> {
  const loan = transaction.loan ? context.loans.get(transaction.loan) : null;
  const amount = transaction.amount ?? 0;
  if (
    !loan ||
    transaction.category ||
    transaction.is_parent ||
    transaction.starting_balance_flag ||
    amount === 0 ||
    !transaction.account ||
    transaction.account === context.loansAccountId ||
    context.offbudgetAccounts.has(transaction.account) ||
    (transaction.payee && context.transferPayees.has(transaction.payee))
  ) {
    return [];
  }

  if (loan.direction === 'owed' || amount > 0) {
    transaction.category =
      (amount > 0 ? loan.income_category : loan.expense_category) ?? undefined;
    return [];
  }

  // A repayment of money I owe: covered purchases first, then cash (Q19)
  const repaying = -amount;
  const covered = context.loansTransferPayee
    ? await coveredLeft(context, loan.id)
    : 0;

  if (covered <= 0) {
    transaction.category = loan.expense_category ?? undefined;
    return [];
  }

  if (covered >= repaying || !allowSplit) {
    if (covered >= repaying && context.loansTransferPayee) {
      transaction.payee = context.loansTransferPayee;
      context.coveredLeft.set(loan.id, covered - repaying);
    } else {
      transaction.category = loan.expense_category ?? undefined;
    }
    return [];
  }

  // Part covered purchases, part cash: split it
  const { account, date, id: parentId } = transaction;
  if (!date || !parentId) {
    transaction.category = loan.expense_category ?? undefined;
    return [];
  }
  context.coveredLeft.set(loan.id, 0);
  const child = (
    data: Pick<TransactionEntity, 'amount'> & Partial<TransactionEntity>,
  ): TransactionEntity => ({
    id: uuidv4(),
    account,
    date,
    cleared: transaction.cleared,
    reconciled: transaction.reconciled,
    sort_order: transaction.sort_order,
    is_child: true,
    parent_id: parentId,
    loan: loan.id,
    ...data,
  });
  const children = [
    child({ amount: -covered, payee: context.loansTransferPayee }),
    child({
      amount: amount + covered,
      payee: transaction.payee,
      category: loan.expense_category ?? undefined,
    }),
  ];
  transaction.is_parent = true;
  transaction.loan = null;
  transaction.category = undefined;
  return children;
}

/**
 * Runs before transactions are saved: links them to loans by payee (Q18,
 * Q26) and fills in the category the loan book's rules call for. Changes the
 * given arrays in place and returns any split children to add.
 */
export async function prepareLoanTransactions({
  added,
  updated,
}: {
  added?: TransactionEntity[];
  updated?: Partial<TransactionEntity>[];
}): Promise<TransactionEntity[]> {
  if (!added?.length && !updated?.length) {
    return [];
  }
  const context = await loadContext();
  if (!context) {
    return [];
  }

  const extra: TransactionEntity[] = [];

  for (const transaction of added ?? []) {
    if (transaction.loan === undefined && !transaction.is_parent) {
      transaction.loan = pickLoan(context, transaction.payee);
    }
    if (transaction.loan) {
      extra.push(
        ...(await applyLoanRules(context, transaction, {
          allowSplit: !transaction.is_child,
        })),
      );
    }
  }

  for (const update of updated ?? []) {
    if (!update.id) {
      continue;
    }
    const linksLoan = 'loan' in update && update.loan;
    const changesPayee = 'payee' in update && !('loan' in update);
    if (!linksLoan && !changesPayee) {
      continue;
    }

    const existing = await db.first<
      Pick<
        TransactionEntity,
        'account' | 'amount' | 'category' | 'payee' | 'loan' | 'is_parent'
      > & { transfer_id: string | null }
    >(
      'SELECT account, amount, category, payee, loan, is_parent, transfer_id FROM v_transactions_internal WHERE id = ?',
      [update.id],
    );
    if (!existing || existing.is_parent || existing.transfer_id) {
      continue;
    }

    if (changesPayee) {
      if (existing.loan) {
        continue;
      }
      const loan = pickLoan(context, update.payee);
      if (!loan) {
        continue;
      }
      update.loan = loan;
    }

    if ('category' in update || existing.category) {
      continue;
    }
    const { transfer_id: _transferId, ...existingFields } = existing;
    const merged: Partial<TransactionEntity> = {
      ...existingFields,
      ...update,
    };
    await applyLoanRules(context, merged, { allowSplit: false });
    if (merged.category) {
      update.category = merged.category;
    }
    if (merged.payee !== (update.payee ?? existing.payee)) {
      update.payee = merged.payee;
    }
  }

  return extra;
}
