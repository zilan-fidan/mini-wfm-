import { Tooltip } from 'antd';
import { useState } from 'react';
import { palette } from '../../theme/theme';

export type WeeklyPoint = { label: string; fullLabel: string; a: number; b: number };

type Props = {
  data: WeeklyPoint[];
  seriesA: string;
  seriesB: string;
};

const HEIGHT = 190;
const PAD = { top: 18, right: 8, bottom: 26, left: 30 };
const WIDTH = 520;

// Okunaklı eksen adımı: 1, 2, 5, 10, 20...
const niceStep = (max: number) => {
  if (max <= 4) return 1;
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
};

// Üst köşeleri 4px yuvarlak, tabana oturan çubuk
const barPath = (x: number, y: number, w: number, h: number) => {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

// İki serili gruplu çubuk grafik (legend + gün bazında tooltip)
export default function WeeklyBarChart({ data, seriesA, seriesB }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b]));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = plotW / data.length;
  const barW = Math.min(18, (band - 16) / 2);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;

  return (
    <div className="wchart">
      <div className="wchart__legend">
        <span>
          <i style={{ background: palette.chartA }} /> {seriesA}
        </span>
        <span>
          <i style={{ background: palette.chartB }} /> {seriesB}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${seriesA} ve ${seriesB}, gün bazında: ${data.map((d) => `${d.fullLabel} ${d.a}/${d.b}`).join(', ')}`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} className="wchart__grid" />
            <text x={PAD.left - 8} y={y(t)} className="wchart__tick" textAnchor="end" dominantBaseline="middle">
              {t}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = PAD.left + band * i + band / 2;
          const xA = cx - barW - 1; // seriler arasında 2px boşluk
          const xB = cx + 1;
          return (
            <g key={d.label}>
              {hover === i && (
                <rect x={PAD.left + band * i + 4} y={PAD.top} width={band - 8} height={plotH} rx={8} className="wchart__hover" />
              )}
              <path d={barPath(xA, y(d.a), barW, y(0) - y(d.a))} fill={palette.chartA} />
              <path d={barPath(xB, y(d.b), barW, y(0) - y(d.b))} fill={palette.chartB} />
              {/* Değer etiketleri: pastel sütun zeminle düşük kontrastlı olduğu için sayı da yazılır */}
              {d.a > 0 && (
                <text x={xA + barW / 2} y={y(d.a) - 5} textAnchor="middle" className="wchart__value">
                  {d.a}
                </text>
              )}
              {d.b > 0 && (
                <text x={xB + barW / 2} y={y(d.b) - 5} textAnchor="middle" className="wchart__value">
                  {d.b}
                </text>
              )}
              <text x={cx} y={HEIGHT - 6} textAnchor="middle" className="wchart__label">
                {d.label}
              </text>
              <Tooltip
                title={
                  <>
                    <b>{d.fullLabel}</b>
                    <br />
                    {seriesA}: {d.a}
                    <br />
                    {seriesB}: {d.b}
                  </>
                }
              >
                {/* İmlecin isabet alanı çubuktan büyük: tüm gün sütunu */}
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={plotH + PAD.bottom}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              </Tooltip>
            </g>
          );
        })}
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(0)} y2={y(0)} className="wchart__axis" />
      </svg>
    </div>
  );
}
