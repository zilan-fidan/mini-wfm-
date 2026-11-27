import { useQuery } from '@tanstack/react-query';
import { Card, DatePicker, Flex, Statistic, Table, Tabs, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { getTimesheet } from '../api/reports.api';
import type { Timesheet } from '../types/report';
import { formatHours } from '../utils/date';
import './TimesheetCard.css';

const KPIS: { key: keyof Timesheet['totals']; title: string; hint: string }[] = [
  { key: 'totalHours', title: 'Toplam', hint: 'Vardiyaların bu ay içinde kalan süresi' },
  { key: 'nightHours', title: 'Gece', hint: 'Yerel 20.00–06.00 arası' },
  { key: 'weekendHours', title: 'Hafta sonu', hint: 'Cumartesi–pazar (tatile denk gelen hariç)' },
  { key: 'holidayHours', title: 'Resmî tatil', hint: 'Yarım gün tatiller 13.00’te başlar' },
  { key: 'overtimeHours', title: 'Fazla mesai', hint: 'Haftalık 45 saati aşan kısım' },
];

// Personelin aylık puantajı: özet + gün gün mini çubuklar + haftalık tablo
export default function TimesheetCard({ workforceUserId }: { workforceUserId: number }) {
  const [month, setMonth] = useState(() => dayjs().startOf('month'));
  const monthKey = month.format('YYYY-MM');

  const { data, isFetching, isError } = useQuery({
    queryKey: ['timesheet', workforceUserId, monthKey],
    queryFn: () => getTimesheet(workforceUserId, monthKey),
  });

  const maxDay = Math.max(1, ...(data?.days.map((d) => d.totalHours) ?? [0]));

  return (
    <Card
      className="page-card"
      title="Aylık Puantaj"
      loading={isFetching && !data}
      extra={
        <DatePicker
          picker="month"
          allowClear={false}
          value={month}
          // antd kendi dayjs kopyasıyla biçimlendirir; Türkçe ay adı için biçimi biz veriyoruz
          format={(v) => dayjs(v.toDate()).format('MMMM YYYY')}
          style={{ width: 170 }}
          onChange={(v) => v && setMonth(v.startOf('month'))}
          // Resmî tatil takvimi yalnızca 2026–2027 için tanımlı
          disabledDate={(d) => d.year() < 2026 || d.year() > 2027}
        />
      }
    >
      {isError || !data ? (
        <div style={{ color: '#8a92a6' }}>Puantaj yüklenemedi.</div>
      ) : (
        <>
          <Flex gap={32} wrap style={{ marginBottom: 20 }}>
            {KPIS.map((k) => (
              <Tooltip key={k.key} title={k.hint}>
                <Statistic title={k.title} value={formatHours(data.totals[k.key])} />
              </Tooltip>
            ))}
          </Flex>

          <Tabs
            items={[
              {
                key: 'days',
                label: 'Günlük',
                children: (
                  <div className="ts-days" role="list">
                    {data.days.map((d) => {
                      const date = dayjs(d.date);
                      const weekend = date.day() === 0 || date.day() === 6;
                      return (
                        <Tooltip
                          key={d.date}
                          title={
                            <>
                              <b>{date.format('D MMMM dddd')}</b>
                              <br />
                              Toplam {formatHours(d.totalHours)}
                              {d.nightHours > 0 && <><br />Gece {formatHours(d.nightHours)}</>}
                              {d.holidayHours > 0 && <><br />Tatil {formatHours(d.holidayHours)}</>}
                              {d.overtimeHours > 0 && <><br />Fazla mesai {formatHours(d.overtimeHours)}</>}
                            </>
                          }
                        >
                          <div className={`ts-day${weekend ? ' is-weekend' : ''}${d.holidayHours > 0 ? ' is-holiday' : ''}`} role="listitem">
                            <div className="ts-day__bar">
                              <div style={{ height: `${(d.totalHours / maxDay) * 100}%` }} />
                            </div>
                            <span>{date.date()}</span>
                          </div>
                        </Tooltip>
                      );
                    })}
                  </div>
                ),
              },
              {
                key: 'weeks',
                label: 'Haftalık',
                children: (
                  <Table
                    size="small"
                    rowKey="weekStart"
                    pagination={false}
                    dataSource={data.weeks}
                    columns={[
                      {
                        title: 'Hafta',
                        dataIndex: 'weekStart',
                        render: (w: string) => `${dayjs(w).format('DD.MM')} – ${dayjs(w).add(6, 'day').format('DD.MM')}`,
                      },
                      { title: 'Bu ay içinde', dataIndex: 'monthTotalHours', align: 'right', render: formatHours },
                      { title: 'Tam hafta', dataIndex: 'totalHours', align: 'right', render: formatHours },
                      {
                        title: 'Fazla mesai',
                        dataIndex: 'monthOvertimeHours',
                        align: 'right',
                        render: (v: number) => (v > 0 ? <b style={{ color: '#D46B08' }}>{formatHours(v)}</b> : formatHours(v)),
                      },
                    ]}
                  />
                ),
              },
            ]}
          />
        </>
      )}
    </Card>
  );
}
