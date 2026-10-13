import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { InitialFocus } from '@actual-app/components/initial-focus';
import { Input } from '@actual-app/components/input';
import { SpaceBetween } from '@actual-app/components/space-between';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import type { LoanSummary } from '@actual-app/core/types/models';

import { FormField, FormLabel } from '#components/forms';
import { DateSelect } from '#components/select/DateSelect';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import { useAdjustLoanMutation, useCreateLoanEntryMutation } from '#loans';

export type LoanEntryFormMode = 'interest' | 'adjust';

type LoanEntryFormProps = {
  loan: LoanSummary;
  mode: LoanEntryFormMode;
  onClose: () => void;
};

export function LoanEntryForm({ loan, mode, onClose }: LoanEntryFormProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const createEntry = useCreateLoanEntryMutation();
  const adjustLoan = useAdjustLoanMutation();

  const [date, setDate] = useState(monthUtils.currentDay());
  const [amount, setAmount] = useState(
    mode === 'adjust' ? format.forEdit(loan.balance) : '',
  );
  const [notes, setNotes] = useState('');

  const value = format.fromEdit(amount, null);

  const onSave = () => {
    if (value == null) {
      return;
    }
    if (mode === 'interest') {
      createEntry.mutate(
        { loan: loan.id, date, kind: 'interest', amount: value, notes },
        { onSuccess: onClose },
      );
    } else {
      adjustLoan.mutate(
        { loan: loan.id, date, balance: value, notes },
        { onSuccess: onClose },
      );
    }
  };

  return (
    <View
      style={{
        marginTop: 12,
        padding: 15,
        borderRadius: 4,
        backgroundColor: theme.tableBackground,
        border: `1px solid ${theme.tableBorder}`,
      }}
    >
      <SpaceBetween gap={15} style={{ alignItems: 'flex-end' }}>
        <FormField>
          <FormLabel title={t('Date')} />
          <DateSelect value={date} dateFormat={dateFormat} onSelect={setDate} />
        </FormField>
        <FormField>
          <FormLabel
            title={
              mode === 'interest'
                ? t('Interest or indexation')
                : t('Balance on the statement')
            }
            htmlFor="loan-entry-amount"
          />
          <InitialFocus>
            <Input
              id="loan-entry-amount"
              value={amount}
              onChangeValue={setAmount}
              style={{ width: 160 }}
            />
          </InitialFocus>
        </FormField>
        <FormField style={{ flex: 1 }}>
          <FormLabel title={t('Note')} htmlFor="loan-entry-notes" />
          <Input id="loan-entry-notes" value={notes} onChangeValue={setNotes} />
        </FormField>
        <Button onPress={onClose}>
          <Trans>Cancel</Trans>
        </Button>
        <Button variant="primary" isDisabled={value == null} onPress={onSave}>
          <Trans>Save</Trans>
        </Button>
      </SpaceBetween>
    </View>
  );
}
