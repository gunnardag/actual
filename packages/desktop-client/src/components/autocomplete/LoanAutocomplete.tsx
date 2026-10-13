import React from 'react';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { useLoans } from '#hooks/useLoans';
import { usePayeesById } from '#hooks/usePayees';

import { Autocomplete } from './Autocomplete';
import { LoanList } from './LoanList';
import type { LoanItem } from './LoanList';

type LoanAutocompleteProps = {
  embedded?: boolean;
} & ComponentProps<typeof Autocomplete<LoanItem>>;

export function LoanAutocomplete({
  embedded,
  ...props
}: LoanAutocompleteProps) {
  const { t } = useTranslation();
  const { data: loans = [] } = useLoans();
  const { data: payeesById = {} } = usePayeesById();

  // Closed loans are only offered when the transaction is already on one
  const suggestions: LoanItem[] = [
    { id: '', name: t('No loan') },
    ...loans
      .filter(loan => !loan.closed || loan.id === props.value)
      .map(loan => ({
        id: loan.id,
        name: `${loan.name} · ${payeesById[loan.payee]?.name ?? ''}`,
      })),
  ];

  return (
    <Autocomplete
      {...props}
      strict
      highlightFirst
      embedded={embedded}
      suggestions={suggestions}
      renderItems={(items, getItemProps, highlightedIndex) => (
        <LoanList
          items={items}
          getItemProps={getItemProps}
          highlightedIndex={highlightedIndex}
          embedded={embedded}
        />
      )}
    />
  );
}
