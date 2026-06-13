import { format, parseISO } from 'date-fns';
import './DateBadge.css';

interface DateBadgeProps {
  date: string;
  className?: string;
}

export function DateBadge({ date, className = '' }: DateBadgeProps) {
  const parsed = parseISO(date);
  const day = format(parsed, 'd');
  const month = format(parsed, 'MMM');
  const year = format(parsed, 'yyyy');

  return (
    <div className={`date-badge ${className}`.trim()} aria-label={format(parsed, 'MMMM d, yyyy')}>
      <span className="date-badge__day">{day}</span>
      <span className="date-badge__month">{month}</span>
      <span className="date-badge__year">{year}</span>
    </div>
  );
}
