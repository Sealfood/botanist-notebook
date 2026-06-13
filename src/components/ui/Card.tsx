import type { HTMLAttributes, ReactNode } from 'react';
import './Card.css';

interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  variant?: 'default' | 'ruled' | 'field-note';
}

export function Card({
  children,
  variant = 'default',
  className = '',
  ...props
}: CardProps) {
  return (
    <article className={`card card--${variant} ${className}`.trim()} {...props}>
      {children}
    </article>
  );
}
