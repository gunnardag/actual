import { useQuery } from '@tanstack/react-query';

import { loanQueries } from '#loans/queries';

export function useLoans() {
  return useQuery(loanQueries.list());
}

export function useLoansAccountId() {
  return useQuery(loanQueries.loansAccount()).data ?? null;
}
