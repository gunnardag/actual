import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { InitialFocus } from '@actual-app/components/initial-focus';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { SpaceBetween } from '@actual-app/components/space-between';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import type { LoanDirection } from '@actual-app/core/types/models';

import { FormField, FormLabel } from '#components/forms';
import { DateSelect } from '#components/select/DateSelect';
import { GenericInput } from '#components/util/GenericInput';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import { useCreateLoanMutation } from '#loans';
import { useCreatePayeeMutation } from '#payees';

type NewLoanFormProps = {
  onClose: () => void;
};

export function NewLoanForm({ onClose }: NewLoanFormProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const createLoan = useCreateLoanMutation();
  const createPayee = useCreatePayeeMutation();

  const [name, setName] = useState('');
  const [payee, setPayee] = useState<string | null>(null);
  const [direction, setDirection] = useState<LoanDirection>('owe');
  const [startDate, setStartDate] = useState(monthUtils.currentDay());
  const [openingBalance, setOpeningBalance] = useState('');

  const canSave = name.trim() !== '' && !!payee;

  const onSave = async () => {
    if (!payee) {
      return;
    }
    // The payee picker hands back `new:<name>` for a payee it offers to create
    const payeeId = payee.startsWith('new:')
      ? await createPayee.mutateAsync({ name: payee.slice('new:'.length) })
      : payee;
    createLoan.mutate(
      {
        name,
        payee: payeeId,
        direction,
        start_date: startDate,
        opening_balance: Math.abs(format.fromEdit(openingBalance, 0) ?? 0),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <View
      style={{
        marginTop: 12,
        padding: 15,
        borderRadius: 4,
        backgroundColor: theme.tableBackground,
        border: `1px solid ${theme.tableBorder}`,
        gap: 12,
      }}
    >
      <SpaceBetween gap={15} style={{ alignItems: 'flex-end' }}>
        <FormField style={{ flex: 1 }}>
          <FormLabel title={t('Name')} htmlFor="loan-name" />
          <InitialFocus>
            <Input
              id="loan-name"
              value={name}
              placeholder={t('e.g. Car money')}
              onChangeValue={setName}
            />
          </InitialFocus>
        </FormField>
        <FormField style={{ flex: 1 }}>
          <FormLabel title={t('Counterparty')} htmlFor="loan-payee" />
          <GenericInput
            type="id"
            field="payee"
            value={payee ?? ''}
            onChange={(id: string) => setPayee(id || null)}
          />
        </FormField>
        <FormField>
          <FormLabel title={t('Direction')} />
          <Select<LoanDirection>
            options={[
              ['owe', t('I owe')],
              ['owed', t('Owed to me')],
            ]}
            value={direction}
            onChange={setDirection}
          />
        </FormField>
      </SpaceBetween>

      <SpaceBetween gap={15} style={{ alignItems: 'flex-end' }}>
        <FormField>
          <FormLabel title={t('Start date')} />
          <DateSelect
            value={startDate}
            dateFormat={dateFormat}
            onSelect={setStartDate}
          />
        </FormField>
        <FormField>
          <FormLabel
            title={t('Already owed when added')}
            htmlFor="loan-opening"
          />
          <Input
            id="loan-opening"
            value={openingBalance}
            placeholder={format(0, 'financial')}
            onChangeValue={setOpeningBalance}
            style={{ width: 160 }}
          />
        </FormField>
        <View style={{ flex: 1 }} />
        <Button onPress={onClose}>
          <Trans>Cancel</Trans>
        </Button>
        <Button variant="primary" isDisabled={!canSave} onPress={onSave}>
          <Trans>Create loan</Trans>
        </Button>
      </SpaceBetween>
    </View>
  );
}
