import { Skeleton } from 'antd';
import type { ReactNode } from 'react';
import './dashboard.css';

type Props = {
  icon: ReactNode;
  title: string;
  value: ReactNode;
  tone?: 'lavender' | 'danger' | 'navy';
  badge?: ReactNode; // gerçek veriden küçük bir not (ör. "3 gecikmiş")
  badgeTone?: 'neutral' | 'danger' | 'success';
  loading?: boolean;
};

export default function KpiCard({ icon, title, value, tone = 'lavender', badge, badgeTone = 'neutral', loading }: Props) {
  return (
    <div className="kpi">
      <div className={`kpi__icon kpi__icon--${tone}`}>{icon}</div>
      <div className="kpi__body">
        <div className="kpi__title">{title}</div>
        <div className="kpi__value-row">
          <span className="kpi__value">{loading ? <Skeleton.Button active size="small" /> : value}</span>
          {badge !== undefined && !loading && <span className={`kpi__badge kpi__badge--${badgeTone}`}>{badge}</span>}
        </div>
      </div>
    </div>
  );
}
