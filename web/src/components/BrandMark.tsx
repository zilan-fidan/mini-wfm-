import { useId } from 'react';
import './BrandMark.css';

type Props = {
  size?: number;
  animated?: boolean; // saat ibresi döner
};

// Mini WFM logosu: zaman (saat) + plan (vardiya çizgileri)
export default function BrandMark({ size = 32, animated = false }: Props) {
  // Sayfada birden çok logo olabilir; gradyan id'si her birinde benzersiz olmalı
  const gradientId = `brand-gradient-${useId()}`;
  return (
    <svg
      className={`brand-mark${animated ? ' brand-mark--animated' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--lilac-detail)" />
          <stop offset="100%" stopColor="var(--lilac-detail)" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${gradientId})`} />
      <circle cx="24" cy="24" r="13" fill="none" stroke="#fff" strokeWidth="3" />
      <line className="brand-mark__hour" x1="24" y1="24" x2="24" y2="17" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <line className="brand-mark__minute" x1="24" y1="24" x2="31" y2="24" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="24" r="2.2" fill="#fff" />
    </svg>
  );
}
