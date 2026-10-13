import React from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import type { TransactionEntity } from '@actual-app/core/types/models';

import { LoanAutocomplete } from '#components/autocomplete/LoanAutocomplete';
import { Cell, CustomCell } from '#components/table';
import { useLoans, useLoansAccountId } from '#hooks/useLoans';

type LoanCellProps = {
  transaction: Pick<
    TransactionEntity,
    'id' | 'account' | 'loan' | 'is_parent' | 'transfer_id'
  >;
  focused: boolean;
  isPreview: boolean;
  valueStyle?: CSSProperties;
  onEdit: (id: TransactionEntity['id'], field: string) => void;
  onUpdate: (value: TransactionEntity['loan']) => void;
};

export function LoanCell({
  transaction,
  focused,
  isPreview,
  valueStyle,
  onEdit,
  onUpdate,
}: LoanCellProps) {
  const { t } = useTranslation();
  const { data: loans = [] } = useLoans();
  const loansAccountId = useLoansAccountId();

  // Split parents carry no loan; their child rows do
  if (transaction.is_parent) {
    return <Cell name="loan" width="flex" value="" />;
  }

  // Every covered purchase in the Loans account needs a loan (Q23)
  const isMissingRequiredLoan =
    !transaction.loan &&
    !transaction.transfer_id &&
    loansAccountId != null &&
    transaction.account === loansAccountId;

  return (
    <CustomCell
      name="loan"
      width="flex"
      textAlign="flex"
      value={transaction.loan ?? ''}
      formatter={id =>
        loans.find(loan => loan.id === id)?.name ??
        (isMissingRequiredLoan ? t('Loan required') : '')
      }
      valueStyle={
        isMissingRequiredLoan
          ? { ...valueStyle, color: theme.errorText, fontStyle: 'italic' }
          : valueStyle
      }
      exposed={focused}
      onExpose={name => !isPreview && onEdit(transaction.id, name)}
      onUpdate={value => {
        // Blur reports the current value too; only save a real change
        const loan = value || null;
        if (loan !== (transaction.loan ?? null)) {
          onUpdate(loan);
        }
      }}
    >
      {({
        onBlur,
        onKeyDown,
        onUpdate,
        onSave,
        shouldSaveFromKey,
        inputStyle,
      }) => (
        <LoanAutocomplete
          value={transaction.loan ?? ''}
          shouldSaveFromKey={shouldSaveFromKey}
          clearOnBlur={false}
          focused
          inputProps={{ onBlur, onKeyDown, style: inputStyle }}
          onUpdate={onUpdate}
          onSelect={onSave}
        />
      )}
    </CustomCell>
  );
}
