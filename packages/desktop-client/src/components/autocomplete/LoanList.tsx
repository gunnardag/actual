import React from 'react';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { ItemHeader } from './ItemHeader';

export type LoanItem = { id: string; name: string };

type LoanListProps = {
  items: LoanItem[];
  getItemProps: (arg: { item: LoanItem }) => ComponentProps<typeof View>;
  highlightedIndex: number;
  embedded?: boolean;
};

export function LoanList({
  items,
  getItemProps,
  highlightedIndex,
  embedded,
}: LoanListProps) {
  const { t } = useTranslation();
  return (
    <View
      style={{
        overflow: 'auto',
        padding: '5px 0',
        ...(!embedded && { maxHeight: 175 }),
      }}
    >
      <ItemHeader title={t('Loans')} />
      {items.map((item, idx) => (
        <div
          key={item.id || 'none'}
          {...(getItemProps ? getItemProps({ item }) : null)}
          style={{
            backgroundColor:
              highlightedIndex === idx
                ? theme.menuAutoCompleteBackgroundHover
                : 'transparent',
            color: item.id ? undefined : theme.pageTextSubdued,
            padding: 4,
            paddingLeft: 20,
            borderRadius: embedded ? 4 : 0,
          }}
          data-highlighted={highlightedIndex === idx || undefined}
        >
          {item.name}
        </div>
      ))}
    </View>
  );
}
