import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgAdd } from '@actual-app/components/icons/v1';
import { SpaceBetween } from '@actual-app/components/space-between';
import { View } from '@actual-app/components/view';

import { Page } from '#components/Page';
import { useLoans } from '#hooks/useLoans';

import { LoanBookSummary } from './LoanBookSummary';
import { LoansTable } from './LoansTable';
import { NewLoanForm } from './NewLoanForm';

export function LoanBookPage() {
  const { t } = useTranslation();
  const { data: loans = [] } = useLoans();
  const [isCreating, setIsCreating] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const openLoans = loans.filter(loan => !loan.closed);
  const closedLoans = loans.filter(loan => loan.closed);

  return (
    <Page header={t('Loans')}>
      <LoanBookSummary loans={openLoans} />

      <SpaceBetween gap={10} style={{ marginTop: 20, alignItems: 'center' }}>
        <Button variant="bare" onPress={() => setIsCreating(true)}>
          <SvgAdd width={10} height={10} style={{ marginRight: 3 }} />
          <Trans>New loan</Trans>
        </Button>
      </SpaceBetween>

      {isCreating && <NewLoanForm onClose={() => setIsCreating(false)} />}

      <LoansTable loans={openLoans} />

      {closedLoans.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <Button
            variant="bare"
            style={{ alignSelf: 'flex-start' }}
            onPress={() => setShowClosed(show => !show)}
          >
            {showClosed ? (
              <Trans count={closedLoans.length}>
                Hide {{ count: closedLoans.length }} closed loans
              </Trans>
            ) : (
              <Trans count={closedLoans.length}>
                Show {{ count: closedLoans.length }} closed loans
              </Trans>
            )}
          </Button>
          {showClosed && <LoansTable loans={closedLoans} />}
        </View>
      )}
    </Page>
  );
}
