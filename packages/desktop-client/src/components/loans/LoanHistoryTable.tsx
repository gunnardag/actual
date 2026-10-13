import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { LoanHistoryItem } from '@actual-app/core/types/models';

import { Cell, Field, Row, TableHeader } from '#components/table';
import { useAccounts } from '#hooks/useAccounts';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import { usePayeesById } from '#hooks/usePayees';

import { formatLoanDate } from './loanFormatting';

type LoanHistoryTableProps = {
  history: LoanHistoryItem[];
};

export function LoanHistoryTable({ history }: LoanHistoryTableProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const { data: payeesById = {} } = usePayeesById();
  const { data: accounts = [] } = useAccounts();

  const describe = (item: LoanHistoryItem) => {
    switch (item.type) {
      case 'opening':
        return t('Opening balance');
      case 'interest':
        return t('Interest');
      case 'adjustment':
        return t('Adjustment');
      default: {
        const payee = item.payee ? payeesById[item.payee] : undefined;
        const account = accounts.find(acct => acct.id === item.account);
        const payeeName = payee?.transfer_acct
          ? accounts.find(acct => acct.id === payee.transfer_acct)?.name
          : payee?.name;
        return [payeeName, account?.name].filter(Boolean).join(' · ');
      }
    }
  };

  return (
    <View style={{ marginTop: 20, ...styles.tableContainer, flex: 'none' }}>
      <TableHeader>
        <Field width={110}>
          <Trans>Date</Trans>
        </Field>
        <Field width="flex">
          <Trans>What</Trans>
        </Field>
        <Field width="flex">
          <Trans>Notes</Trans>
        </Field>
        <Field width={120} style={{ textAlign: 'right' }}>
          <Trans>Change</Trans>
        </Field>
        <Field width={120} style={{ textAlign: 'right' }}>
          <Trans>Balance</Trans>
        </Field>
      </TableHeader>
      {history.map(item => (
        <Row
          key={item.id}
          height="auto"
          style={{ backgroundColor: theme.tableBackground }}
        >
          <Cell width={110} value={formatLoanDate(item.date, dateFormat)} />
          <Cell width="flex" value={describe(item)} />
          <Cell
            width="flex"
            style={{ color: theme.pageTextSubdued }}
            value={item.notes ?? ''}
          />
          <Cell
            width={120}
            style={{ textAlign: 'right', ...styles.tnum }}
            value={format(item.delta, 'financial-with-sign')}
          />
          <Cell
            width={120}
            style={{ textAlign: 'right', ...styles.tnum }}
            value={format(item.balance, 'financial')}
          />
        </Row>
      ))}
    </View>
  );
}
