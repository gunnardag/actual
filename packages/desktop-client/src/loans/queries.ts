import { send } from '@actual-app/core/platform/client/connection';
import type {
  LoanEntity,
  LoanEntryEntity,
  LoanHistoryItem,
  LoanSummary,
} from '@actual-app/core/types/models';
import { queryOptions } from '@tanstack/react-query';

export const loanQueries = {
  all: () => ['loans'],
  lists: () => [...loanQueries.all(), 'lists'],
  // Balances depend on transactions, so these refetch whenever they're used
  list: () =>
    queryOptions<LoanSummary[]>({
      queryKey: [...loanQueries.lists()],
      queryFn: () => send('loans-get'),
      placeholderData: [],
    }),
  entries: (loan: LoanEntity['id']) =>
    queryOptions<LoanEntryEntity[]>({
      queryKey: [...loanQueries.all(), 'entries', loan],
      queryFn: () => send('loan-entries-get', { loan }),
      placeholderData: [],
    }),
  history: (loan: LoanEntity['id']) =>
    queryOptions<LoanHistoryItem[]>({
      queryKey: [...loanQueries.all(), 'history', loan],
      queryFn: () => send('loan-history-get', { loan }),
      placeholderData: [],
    }),
  loansAccount: () =>
    queryOptions<string | null>({
      queryKey: [...loanQueries.all(), 'account'],
      queryFn: () => send('loans-account-get'),
    }),
};
