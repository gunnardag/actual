import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { LoanSummary } from '@actual-app/core/types/models';

import { Cell, Field, Row, TableHeader } from '#components/table';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import { useNavigate } from '#hooks/useNavigate';
import { usePayeesById } from '#hooks/usePayees';

import { formatLoanDate } from './loanFormatting';

export function LoansTable({ loans }: { loans: LoanSummary[] }) {
  const { t } = useTranslation();
  const format = useFormat();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const navigate = useNavigate();
  const { data: payeesById = {} } = usePayeesById();

  return (
    <View style={{ marginTop: 12, ...styles.tableContainer, flex: 'none' }}>
      <TableHeader>
        <Field width="flex">
          <Trans>Loan</Trans>
        </Field>
        <Field width="flex">
          <Trans>Counterparty</Trans>
        </Field>
        <Field width={110}>
          <Trans>Direction</Trans>
        </Field>
        <Field width={120} style={{ textAlign: 'right' }}>
          <Trans>Balance</Trans>
        </Field>
        <Field width={120} style={{ textAlign: 'right' }}>
          <Trans>Original</Trans>
        </Field>
        <Field width={120}>
          <Trans>Last activity</Trans>
        </Field>
      </TableHeader>
      {loans.length === 0 ? (
        <View
          style={{ background: theme.tableBackground, fontStyle: 'italic' }}
        >
          <Text style={{ margin: 'auto', padding: 20 }}>
            <Trans>No loans</Trans>
          </Text>
        </View>
      ) : (
        loans.map(loan => (
          <Row
            key={loan.id}
            height="auto"
            style={{
              cursor: 'pointer',
              backgroundColor: theme.tableBackground,
            }}
            onClick={() => navigate(`/loans/${loan.id}`)}
          >
            <Cell width="flex" value={loan.name} />
            <Cell width="flex" value={payeesById[loan.payee]?.name ?? ''} />
            <Cell
              width={110}
              value={loan.direction === 'owe' ? t('I owe') : t('Owed to me')}
            />
            <Cell
              width={120}
              style={{ textAlign: 'right', ...styles.tnum }}
              value={format(loan.balance, 'financial')}
            />
            <Cell
              width={120}
              style={{
                textAlign: 'right',
                color: theme.pageTextSubdued,
                ...styles.tnum,
              }}
              value={format(loan.original, 'financial')}
            />
            <Cell
              width={120}
              value={formatLoanDate(loan.last_activity, dateFormat)}
            />
          </Row>
        ))
      )}
    </View>
  );
}
