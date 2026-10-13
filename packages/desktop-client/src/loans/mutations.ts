import { useTranslation } from 'react-i18next';

import { send } from '@actual-app/core/platform/client/connection';
import type { Handlers } from '@actual-app/core/types/handlers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';

import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';

import { loanQueries } from './queries';

type LoanHandler =
  | 'loan-create'
  | 'loan-update'
  | 'loan-delete'
  | 'loan-entry-create'
  | 'loan-entry-delete'
  | 'loan-adjust-to';

function useLoanMutation<Name extends LoanHandler>(
  name: Name,
  errorMessage: string,
) {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  return useMutation({
    mutationFn: (args: Parameters<Handlers[Name]>[0]) => send(name, args),
    onSuccess: () => {
      // Creating the first loan can also create the Loans account and
      // categories, so refresh everything loan related
      void queryClient.invalidateQueries({ queryKey: loanQueries.all() });
    },
    onError: error => {
      console.error(`Error in ${name}:`, error);
      dispatch(
        addNotification({
          notification: {
            id: uuidv4(),
            type: 'error',
            message: errorMessage,
            pre: error instanceof Error ? error.message : undefined,
          },
        }),
      );
    },
  });
}

export function useCreateLoanMutation() {
  const { t } = useTranslation();
  return useLoanMutation('loan-create', t('Could not create the loan.'));
}

export function useUpdateLoanMutation() {
  const { t } = useTranslation();
  return useLoanMutation('loan-update', t('Could not update the loan.'));
}

export function useDeleteLoanMutation() {
  const { t } = useTranslation();
  return useLoanMutation('loan-delete', t('Could not delete the loan.'));
}

export function useCreateLoanEntryMutation() {
  const { t } = useTranslation();
  return useLoanMutation('loan-entry-create', t('Could not add the entry.'));
}

export function useDeleteLoanEntryMutation() {
  const { t } = useTranslation();
  return useLoanMutation('loan-entry-delete', t('Could not delete the entry.'));
}

export function useAdjustLoanMutation() {
  const { t } = useTranslation();
  return useLoanMutation('loan-adjust-to', t('Could not adjust the loan.'));
}
