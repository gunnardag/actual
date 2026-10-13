import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { Button } from '@actual-app/components/button';
import { SpaceBetween } from '@actual-app/components/space-between';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { useQuery } from '@tanstack/react-query';

import { Link } from '#components/common/Link';
import { Page } from '#components/Page';
import { useFormat } from '#hooks/useFormat';
import { useLoans } from '#hooks/useLoans';
import { useNavigate } from '#hooks/useNavigate';
import { usePayeesById } from '#hooks/usePayees';
import {
  loanQueries,
  useDeleteLoanMutation,
  useUpdateLoanMutation,
} from '#loans';

import { LoanEntryForm } from './LoanEntryForm';
import type { LoanEntryFormMode } from './LoanEntryForm';
import { LoanHistoryTable } from './LoanHistoryTable';
import { SummaryFigure } from './SummaryFigure';

export function LoanDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const format = useFormat();
  const navigate = useNavigate();
  const { data: loans = [], isFetched } = useLoans();
  const { data: history = [] } = useQuery(loanQueries.history(id));
  const { data: payeesById = {} } = usePayeesById();
  const updateLoan = useUpdateLoanMutation();
  const deleteLoan = useDeleteLoanMutation();
  const [entryMode, setEntryMode] = useState<LoanEntryFormMode | null>(null);

  const loan = loans.find(item => item.id === id);
  if (!loan) {
    return (
      <Page header={t('Loan')}>
        {isFetched && (
          <Text>
            <Trans>This loan doesn't exist.</Trans>{' '}
            <Link variant="text" onClick={() => navigate('/loans')}>
              <Trans>Back to loans</Trans>
            </Link>
          </Text>
        )}
      </Page>
    );
  }

  const counterparty = payeesById[loan.payee]?.name ?? '';
  const isPaidOff = loan.balance === 0 && history.length > 1;
  // Only the opening row means nothing is linked yet (Q24)
  const canDelete = history.length <= 1;

  return (
    <Page header={loan.name}>
      <View style={{ color: theme.pageTextSubdued, marginBottom: 15 }}>
        <Link variant="text" onClick={() => navigate('/loans')}>
          <Trans>All loans</Trans>
        </Link>
      </View>

      <SpaceBetween gap={40} style={{ alignItems: 'flex-start' }}>
        <SummaryFigure
          label={
            loan.direction === 'owe'
              ? t('I owe {{name}}', { name: counterparty })
              : t('{{name}} owes me', { name: counterparty })
          }
          value={format(loan.balance, 'financial')}
        />
        {loan.covered > 0 && (
          <SummaryFigure
            label={t('Of which covered purchases')}
            value={format(loan.covered, 'financial')}
          />
        )}
      </SpaceBetween>

      {isPaidOff && !loan.closed && (
        <View
          style={{
            marginTop: 15,
            padding: 10,
            borderRadius: 4,
            backgroundColor: theme.noticeBackground,
            color: theme.noticeTextDark,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Text style={{ flex: 1 }}>
            <Trans>This loan is paid off.</Trans>
          </Text>
          <Button
            onPress={() => updateLoan.mutate({ id: loan.id, closed: true })}
          >
            <Trans>Close loan</Trans>
          </Button>
        </View>
      )}

      <SpaceBetween gap={10} style={{ marginTop: 20 }}>
        <Button onPress={() => setEntryMode('interest')}>
          <Trans>Add interest</Trans>
        </Button>
        <Button onPress={() => setEntryMode('adjust')}>
          <Trans>Adjust to statement</Trans>
        </Button>
        <View style={{ flex: 1 }} />
        <Button
          variant="bare"
          onPress={() =>
            updateLoan.mutate({ id: loan.id, closed: !loan.closed })
          }
        >
          {loan.closed ? <Trans>Reopen loan</Trans> : <Trans>Close loan</Trans>}
        </Button>
        {canDelete && (
          <Button
            variant="bare"
            onPress={() =>
              deleteLoan.mutate(
                { id: loan.id },
                { onSuccess: () => navigate('/loans') },
              )
            }
          >
            <Trans>Delete loan</Trans>
          </Button>
        )}
      </SpaceBetween>

      {entryMode && (
        <LoanEntryForm
          loan={loan}
          mode={entryMode}
          onClose={() => setEntryMode(null)}
        />
      )}

      <LoanHistoryTable history={history} />
    </Page>
  );
}
