import * as db from '#server/db';
import { loadMappings } from '#server/db/mappings';
import { app } from '#server/loans/app';
import { batchUpdateTransactions } from '#server/transactions';

beforeEach(async () => {
  await global.emptyDatabase()();
  await loadMappings();
});

async function setup() {
  await db.insertCategoryGroup({ id: 'food', name: 'Food', is_income: 0 });
  await db.insertCategory({
    id: 'restaurants',
    name: 'Restaurants',
    cat_group: 'food',
    is_income: 0,
  });
  await db.insertAccount({ id: 'bank', name: 'Bank' });
  await db.insertPayee({ name: '', transfer_acct: 'bank' });
  const jon = await db.insertPayee({ name: 'Jón' });
  const shop = await db.insertPayee({ name: 'Kaffi Vest' });
  return { jon, shop };
}

async function getTransaction(id: string) {
  return db.first<{
    id: string;
    loan: string | null;
    category: string | null;
    payee: string | null;
    amount: number;
    is_parent: number;
    transfer_id: string | null;
  }>(
    'SELECT id, loan, category, payee, amount, is_parent, transfer_id FROM v_transactions_internal WHERE id = ?',
    [id],
  );
}

async function getChildren(parentId: string) {
  return db.all<{
    loan: string | null;
    category: string | null;
    payee: string | null;
    amount: number;
  }>(
    'SELECT loan, category, payee, amount FROM v_transactions_internal_alive WHERE parent_id = ? ORDER BY amount',
    [parentId],
  );
}

async function getSummary(id: string) {
  const loans = await app.handlers['loans-get']();
  const loan = loans.find(item => item.id === id);
  if (!loan) {
    throw new Error('loan missing');
  }
  return loan;
}

async function categoryName(id: string | null | undefined) {
  if (!id) {
    return null;
  }
  const row = await db.first<{ name: string }>(
    'SELECT name FROM categories WHERE id = ?',
    [id],
  );
  return row?.name ?? null;
}

async function add(transaction: {
  id: string;
  account: string;
  amount: number;
  payee?: string | null;
  category?: string;
  loan?: string | null;
  date?: string;
}) {
  await batchUpdateTransactions({
    added: [{ date: '2026-10-01', ...transaction }],
  });
}

describe('loans app', () => {
  it('creates the Loans account and default categories for a loan I owe', async () => {
    const { jon } = await setup();
    const id = await app.handlers['loan-create']({
      name: 'Jón',
      payee: jon,
      direction: 'owe',
      start_date: '2026-01-01',
    });

    const loansAccount = await app.handlers['loans-account-get']();
    expect(loansAccount).not.toBeNull();

    const loan = await getSummary(id);
    expect(await categoryName(loan.income_category)).toBe('Borrowed money');
    expect(await categoryName(loan.expense_category)).toBe('Loan repayments');
    expect(loan.balance).toBe(0);
  });

  it('reuses the default categories for later loans', async () => {
    const { jon, shop } = await setup();
    const first = await app.handlers['loan-create']({
      name: 'A',
      payee: jon,
      direction: 'owe',
      start_date: '2026-01-01',
    });
    const second = await app.handlers['loan-create']({
      name: 'B',
      payee: shop,
      direction: 'owe',
      start_date: '2026-01-01',
    });
    const [a, b] = [await getSummary(first), await getSummary(second)];
    expect(a.income_category).toBe(b.income_category);
    expect(a.expense_category).toBe(b.expense_category);
  });

  it('links by payee to the oldest open loan and treats cash as income', async () => {
    const { jon } = await setup();
    const older = await app.handlers['loan-create']({
      name: 'Car money',
      payee: jon,
      direction: 'owe',
      start_date: '2026-01-01',
    });
    await app.handlers['loan-create']({
      name: 'Concert',
      payee: jon,
      direction: 'owe',
      start_date: '2026-06-01',
    });

    await add({ id: 'cash', account: 'bank', amount: 100000, payee: jon });

    const transaction = await getTransaction('cash');
    expect(transaction?.loan).toBe(older);
    expect(await categoryName(transaction?.category)).toBe('Borrowed money');
    expect((await getSummary(older)).balance).toBe(100000);
  });

  it('keeps a category the user picked', async () => {
    const { jon } = await setup();
    await app.handlers['loan-create']({
      name: 'Jón',
      payee: jon,
      direction: 'owe',
      start_date: '2026-01-01',
    });

    await add({
      id: 't',
      account: 'bank',
      amount: -5000,
      payee: jon,
      category: 'restaurants',
    });
    expect((await getTransaction('t'))?.category).toBe('restaurants');
  });

  it('does not link when the loan is set to none', async () => {
    const { jon } = await setup();
    await app.handlers['loan-create']({
      name: 'Jón',
      payee: jon,
      direction: 'owe',
      start_date: '2026-01-01',
    });
    await add({
      id: 'bike',
      account: 'bank',
      amount: -20000,
      payee: jon,
      loan: null,
    });
    expect((await getTransaction('bike'))?.loan).toBeNull();
  });

  it('turns a repayment of covered purchases into a transfer to the Loans account', async () => {
    const { jon, shop } = await setup();
    const loan = await app.handlers['loan-create']({
      name: 'Jón',
      payee: jon,
      direction: 'owe',
      start_date: '2026-01-01',
    });
    const loansAccount = (await app.handlers['loans-account-get']()) as string;

    // Jón pays for dinner: a covered purchase in the Loans account
    await add({
      id: 'dinner',
      account: loansAccount,
      amount: -8000,
      payee: shop,
      category: 'restaurants',
      loan,
    });
    let summary = await getSummary(loan);
    expect(summary.balance).toBe(8000);
    expect(summary.covered).toBe(8000);

    // I pay Jón back from the bank
    await add({ id: 'repay', account: 'bank', amount: -8000, payee: jon });

    const repay = await getTransaction('repay');
    expect(repay?.loan).toBe(loan);
    expect(repay?.transfer_id).not.toBeNull();
    expect(repay?.category).toBeNull();

    summary = await getSummary(loan);
    expect(summary.balance).toBe(0);
    expect(summary.covered).toBe(0);
  });

  it('splits a repayment that covers both covered purchases and cash', async () => {
    const { jon, shop } = await setup();
    const loan = await app.handlers['loan-create']({
      name: 'Jón',
      payee: jon,
      direction: 'owe',
      start_date: '2026-01-01',
    });
    const loansAccount = (await app.handlers['loans-account-get']()) as string;

    await add({
      id: 'dinner',
      account: loansAccount,
      amount: -8000,
      payee: shop,
      category: 'restaurants',
      loan,
    });
    await add({ id: 'cash', account: 'bank', amount: 100000, payee: jon });
    await add({ id: 'repay', account: 'bank', amount: -20000, payee: jon });

    const parent = await getTransaction('repay');
    expect(parent?.is_parent).toBe(1);
    expect(parent?.loan).toBeNull();

    const children = await getChildren('repay');
    expect(children.map(child => child.amount)).toEqual([-12000, -8000]);
    expect(children.every(child => child.loan === loan)).toBe(true);
    expect(await categoryName(children[0].category)).toBe('Loan repayments');

    const summary = await getSummary(loan);
    expect(summary.balance).toBe(8000 + 100000 - 20000);
    expect(summary.covered).toBe(0);
  });

  it('treats lending as spending and being repaid as income', async () => {
    const { jon } = await setup();
    const loan = await app.handlers['loan-create']({
      name: 'Jón owes me',
      payee: jon,
      direction: 'owed',
      start_date: '2026-01-01',
    });

    await add({ id: 'lend', account: 'bank', amount: -50000, payee: jon });
    await add({ id: 'back', account: 'bank', amount: 20000, payee: jon });

    expect(await categoryName((await getTransaction('lend'))?.category)).toBe(
      'Money lent',
    );
    expect(await categoryName((await getTransaction('back'))?.category)).toBe(
      'Loans repaid to me',
    );
    expect((await getSummary(loan)).balance).toBe(30000);
  });

  it('adds interest entries and adjusts to a statement figure', async () => {
    const { jon } = await setup();
    const loan = await app.handlers['loan-create']({
      name: 'Mortgage',
      payee: jon,
      direction: 'owe',
      start_date: '2026-01-01',
      opening_balance: 3000000,
    });

    await app.handlers['loan-entry-create']({
      loan,
      date: '2026-02-01',
      kind: 'interest',
      amount: 15000,
    });
    expect((await getSummary(loan)).balance).toBe(3015000);

    await app.handlers['loan-adjust-to']({
      loan,
      date: '2026-03-01',
      balance: 3020000,
    });
    expect((await getSummary(loan)).balance).toBe(3020000);

    const entries = await app.handlers['loan-entries-get']({ loan });
    expect(entries.map(entry => [entry.kind, entry.amount])).toEqual([
      ['adjustment', 5000],
      ['interest', 15000],
    ]);
  });

  it('only deletes a loan with nothing linked', async () => {
    const { jon } = await setup();
    const loan = await app.handlers['loan-create']({
      name: 'Jón',
      payee: jon,
      direction: 'owe',
      start_date: '2026-01-01',
    });
    await add({ id: 'cash', account: 'bank', amount: 1000, payee: jon });

    await expect(app.handlers['loan-delete']({ id: loan })).rejects.toThrow();

    await batchUpdateTransactions({ updated: [{ id: 'cash', loan: null }] });
    await app.handlers['loan-delete']({ id: loan });
    expect(await app.handlers['loans-get']()).toEqual([]);
  });

  it('links an existing transaction when its payee changes', async () => {
    const { jon, shop } = await setup();
    const loan = await app.handlers['loan-create']({
      name: 'Jón',
      payee: jon,
      direction: 'owe',
      start_date: '2026-01-01',
    });
    await add({ id: 't', account: 'bank', amount: 1000, payee: shop });
    expect((await getTransaction('t'))?.loan).toBeNull();

    await batchUpdateTransactions({ updated: [{ id: 't', payee: jon }] });
    const transaction = await getTransaction('t');
    expect(transaction?.loan).toBe(loan);
    expect(await categoryName(transaction?.category)).toBe('Borrowed money');
  });
});
