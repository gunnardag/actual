import { format as formatDate, parseISO } from 'date-fns';

export function formatLoanDate(date: string | null, dateFormat: string) {
  return date ? formatDate(parseISO(date), dateFormat) : '';
}
