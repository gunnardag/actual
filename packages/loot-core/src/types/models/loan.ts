import type { IntegerAmount } from '#shared/util';

import type { CategoryEntity } from './category';
import type { PayeeEntity } from './payee';

/** `owe`: money I owe the counterparty. `owed`: money owed to me. */
export type LoanDirection = 'owe' | 'owed';

export type LoanEntity = {
  id: string;
  name: string;
  payee: PayeeEntity['id'];
  direction: LoanDirection;
  start_date: string;
  opening_balance: IntegerAmount;
  income_category?: CategoryEntity['id'] | null;
  expense_category?: CategoryEntity['id'] | null;
  closed?: boolean;
  tombstone?: boolean;
};

/** Entries that change a loan's balance without a transaction. */
export type LoanEntryKind = 'interest' | 'adjustment';

export type LoanEntryEntity = {
  id: string;
  loan: LoanEntity['id'];
  date: string;
  kind: LoanEntryKind;
  /** Positive raises the balance, negative lowers it. */
  amount: IntegerAmount;
  notes?: string | null;
  tombstone?: boolean;
};

export type LoanSummary = LoanEntity & {
  /** What is owed right now, in the loan's direction. */
  balance: IntegerAmount;
  /** The part of `balance` that comes from covered purchases. */
  covered: IntegerAmount;
  /** Opening balance plus everything that ever raised the loan. */
  original: IntegerAmount;
  last_activity: string | null;
};

export type LoanHistoryItem = {
  id: string;
  type: 'opening' | 'transaction' | LoanEntryKind;
  date: string;
  /** How much this changed what is owed. */
  delta: IntegerAmount;
  /** What was owed after this item. */
  balance: IntegerAmount;
  account?: string | null;
  payee?: PayeeEntity['id'] | null;
  notes?: string | null;
};
