import type { ReactNode } from 'react';
import './EmptyState.css';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <svg
        className="empty-state__illustration"
        viewBox="0 0 120 120"
        aria-hidden="true"
      >
        <ellipse cx="60" cy="95" rx="35" ry="8" fill="rgba(61,90,62,0.15)" />
        <path
          d="M60 85 C60 85 45 70 48 55 C51 40 60 25 60 25 C60 25 69 40 72 55 C75 70 60 85 60 85"
          fill="none"
          stroke="var(--color-forest)"
          strokeWidth="2"
        />
        <path
          d="M60 55 C55 50 40 48 35 52 M60 55 C65 50 80 48 85 52"
          fill="none"
          stroke="var(--color-forest-light)"
          strokeWidth="1.5"
        />
        <circle cx="60" cy="30" r="6" fill="none" stroke="var(--color-gold)" strokeWidth="1.5" />
      </svg>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
