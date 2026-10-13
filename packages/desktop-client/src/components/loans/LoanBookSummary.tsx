import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { SpaceBetween } from '@actual-app/components/space-between';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { LoanSummary } from '@actual-app/core/types/models';

import { FinancialText } from '#components/FinancialText';
import { useFormat } from '#hooks/useFormat';
import { usePayeesById } from '#hooks/usePayees';

import { SummaryFigure } from './SummaryFigure';

export function LoanBookSummary({ loans }: { loans: LoanSummary[] }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { data: payeesById = {} } = usePayeesById();

  const owe = loans
    .filter(loan => loan.direction === 'owe')
    .reduce((sum, loan) => sum + loan.balance, 0);
  const owed = loans
    .filter(loan => loan.direction === 'owed')
    .reduce((sum, loan) => sum + loan.balance, 0);

  // Net per counterparty: positive means they owe me (Q10, Q27)
  const perPerson = new Map<string, number>();
  for (const loan of loans) {
    const signed = loan.direction === 'owed' ? loan.balance : -loan.balance;
    perPerson.set(loan.payee, (perPerson.get(loan.payee) ?? 0) + signed);
  }
  const people = [...perPerson.entries()].filter(([, net]) => net !== 0);

  return (
    <View>
      <SpaceBetween gap={40} style={{ alignItems: 'flex-start' }}>
        <SummaryFigure label={t('I owe')} value={format(owe, 'financial')} />
        <SummaryFigure
          label={t('Owed to me')}
          value={format(owed, 'financial')}
        />
      </SpaceBetween>

      {people.length > 0 && (
        <View style={{ marginTop: 15, color: theme.pageTextSubdued }}>
          {people.map(([payee, net]) => (
            <Text key={payee} style={{ marginTop: 3 }}>
              {net > 0 ? (
                <Trans>{{ name: payeesById[payee]?.name ?? '' }} owes me</Trans>
              ) : (
                <Trans>I owe {{ name: payeesById[payee]?.name ?? '' }}</Trans>
              )}{' '}
              <FinancialText>
                {format(Math.abs(net), 'financial')}
              </FinancialText>
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
