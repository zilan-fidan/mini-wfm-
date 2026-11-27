import { LeftOutlined, MoonOutlined, PlusOutlined, RightOutlined, TeamOutlined } from '@ant-design/icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button, Card, DatePicker, Empty, Flex, Space, Spin, Statistic, Tooltip } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { listShifts } from '../api/shifts.api';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';
import ShiftFormModal from '../components/ShiftFormModal';
import TeamSelect from '../components/TeamSelect';
import TeamShiftModal from '../components/TeamShiftModal';
import WorkforceUserSelect from '../components/WorkforceUserSelect';
import type { Shift } from '../types/shift';
import { durationHours, formatDateTime, formatHours, formatTime, toIso } from '../utils/date';
import './ShiftsPage.css';

// Gece vardiyası: yerel 20.00–06.00 arasında başlayan
const isNight = (shift: Shift) => {
  const hour = dayjs(shift.startAt).hour();
  return hour >= 20 || hour < 6;
};

type Row = {
  userId: number;
  name: string;
  team: { id: number; name: string } | null;
  byDay: Shift[][]; // haftanın 7 günü
  hours: number;
};

export default function ShiftsPage() {
  const { canPlan } = useAuth();
  const [weekStart, setWeekStart] = useState(() => dayjs().startOf('week')); // tr: pazartesi
  const [teamId, setTeamId] = useState<number>();
  const [workforceUserId, setWorkforceUserId] = useState<number>();
  const [editing, setEditing] = useState<{ shift: Shift | null; start?: Dayjs } | null>(null);
  const [teamModalOpen, setTeamModalOpen] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day')), [weekStart]);
  const from = toIso(weekStart);
  const to = toIso(weekStart.add(7, 'day'));

  const { data: shifts = [], isFetching } = useQuery({
    queryKey: ['shifts', { from, to, teamId, workforceUserId }],
    queryFn: () => listShifts({ from, to, teamId, workforceUserId }),
    placeholderData: keepPreviousData,
  });

  // Personel bazında satırlar; vardiya başladığı güne yerleşir
  const rows = useMemo<Row[]>(() => {
    const map = new Map<number, Row>();
    for (const shift of shifts) {
      const u = shift.workforceUser;
      let row = map.get(u.id);
      if (!row) {
        row = { userId: u.id, name: `${u.firstname} ${u.lastname}`, team: u.team, byDay: days.map(() => []), hours: 0 };
        map.set(u.id, row);
      }
      const dayIndex = dayjs(shift.startAt).startOf('day').diff(weekStart, 'day');
      // Önceki haftadan taşan vardiya ilk güne yazılır
      row.byDay[Math.min(Math.max(dayIndex, 0), 6)].push(shift);
      row.hours += durationHours(shift.startAt, shift.endAt);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [shifts, days, weekStart]);

  const totalHours = rows.reduce((sum, r) => sum + r.hours, 0);
  const today = dayjs();
  const weekLabel = `${weekStart.format('D MMM')} – ${weekStart.add(6, 'day').format('D MMM YYYY')}`;

  return (
    <>
      <PageHeader
        title="Vardiyalar"
        subtitle="Haftalık vardiya planı"
        extra={
          canPlan && (
            <Space wrap>
              <Button icon={<TeamOutlined />} onClick={() => setTeamModalOpen(true)}>
                Ekibe Toplu Vardiya
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({ shift: null })}>
                Yeni Vardiya
              </Button>
            </Space>
          )
        }
      />

      <Card className="page-card">
        <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 20 }}>
          <Space wrap>
            <Space.Compact>
              <Button icon={<LeftOutlined />} aria-label="Önceki hafta" onClick={() => setWeekStart((w) => w.subtract(1, 'week'))} />
              <DatePicker
                picker="week"
                allowClear={false}
                value={weekStart}
                format={() => weekLabel}
                onChange={(value) => value && setWeekStart(value.startOf('week'))}
                style={{ width: 210 }}
              />
              <Button icon={<RightOutlined />} aria-label="Sonraki hafta" onClick={() => setWeekStart((w) => w.add(1, 'week'))} />
            </Space.Compact>
            <Button onClick={() => setWeekStart(dayjs().startOf('week'))}>Bu hafta</Button>
          </Space>
          <Space wrap>
            <TeamSelect value={teamId} onChange={setTeamId} placeholder="Tüm ekipler" style={{ width: 200 }} />
            <WorkforceUserSelect value={workforceUserId} onChange={setWorkforceUserId} placeholder="Tüm personeller" style={{ width: 220 }} />
          </Space>
        </Flex>

        <Flex gap={40} wrap style={{ marginBottom: 20 }}>
          <Statistic title="Vardiya" value={shifts.length} />
          <Statistic title="Personel" value={rows.length} />
          <Statistic title="Toplam süre" value={formatHours(totalHours)} />
        </Flex>

        <Spin spinning={isFetching}>
          <div className="shift-board">
            <div className="shift-board__grid">
              <div className="shift-board__corner">Personel</div>
              {days.map((day) => (
                <div key={day.toString()} className={`shift-board__day${day.isSame(today, 'day') ? ' is-today' : ''}`}>
                  <span>{day.format('ddd')}</span>
                  <strong>{day.format('D')}</strong>
                </div>
              ))}

              {rows.map((row) => (
                <div className="shift-board__row" key={row.userId}>
                  <div className="shift-board__person">
                    <Link to={`/workforce-users/${row.userId}`}>{row.name}</Link>
                    <span>
                      {row.team?.name ?? 'Ekipsiz'} · {formatHours(row.hours)}
                    </span>
                  </div>
                  {row.byDay.map((cell, i) => (
                    <div
                      key={i}
                      className={`shift-board__cell${days[i].isSame(today, 'day') ? ' is-today' : ''}`}
                      onDoubleClick={() => canPlan && setEditing({ shift: null, start: days[i] })}
                    >
                      {cell.map((shift) => (
                        <Tooltip
                          key={shift.id}
                          title={
                            <>
                              {formatDateTime(shift.startAt)} – {formatDateTime(shift.endAt)}
                              <br />
                              {formatHours(durationHours(shift.startAt, shift.endAt))}
                              {shift.note && (
                                <>
                                  <br />
                                  {shift.note}
                                </>
                              )}
                            </>
                          }
                        >
                          <button
                            type="button"
                            className={`shift-chip${isNight(shift) ? ' shift-chip--night' : ''}`}
                            onClick={() => canPlan && setEditing({ shift })}
                            style={{ cursor: canPlan ? 'pointer' : 'default' }}
                          >
                            <span className="shift-chip__time">
                              {isNight(shift) && <MoonOutlined />} {formatTime(shift.startAt)}–{formatTime(shift.endAt)}
                              {!dayjs(shift.endAt).isSame(dayjs(shift.startAt), 'day') && <sup>+1</sup>}
                            </span>
                            {shift.note && <span className="shift-chip__note">{shift.note}</span>}
                          </button>
                        </Tooltip>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {rows.length === 0 && !isFetching && (
              <Empty style={{ padding: '40px 0' }} description="Bu hafta için vardiya bulunamadı" />
            )}
          </div>
        </Spin>
        {canPlan && rows.length > 0 && (
          <div className="shift-board__hint">İpucu: Vardiyayı düzenlemek için üzerine tıklayın, boş güne çift tıklayıp yeni vardiya ekleyin.</div>
        )}
      </Card>

      {canPlan && (
        <>
          <ShiftFormModal
            open={editing !== null}
            shift={editing?.shift ?? null}
            defaultStart={editing?.start}
            onClose={() => setEditing(null)}
          />
          <TeamShiftModal open={teamModalOpen} onClose={() => setTeamModalOpen(false)} />
        </>
      )}
    </>
  );
}
