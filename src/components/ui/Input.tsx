import type { InputHTMLAttributes } from 'react';
import './Input.css';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`field-input ${className}`.trim()} {...props} />;
}

export function Textarea({
  className = '',
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`field-input field-textarea ${className}`.trim()} {...props} />;
}

export function Select({
  className = '',
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`field-input field-select ${className}`.trim()} {...props}>
      {children}
    </select>
  );
}
