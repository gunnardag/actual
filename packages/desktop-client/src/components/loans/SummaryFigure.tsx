import React from 'react';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { FinancialText } from '#components/FinancialText';

export function SummaryFigure({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View>
      <Text style={{ color: theme.pageTextSubdued }}>{label}</Text>
      <FinancialText style={{ ...styles.veryLargeText, fontWeight: 600 }}>
        {value}
      </FinancialText>
    </View>
  );
}
