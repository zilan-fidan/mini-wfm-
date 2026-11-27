import { Alert } from 'antd';

type Detail = {
  firstname?: string;
  lastname?: string;
  registrationNumber?: string;
  rule?: string;
  message?: string;
  date?: string;
  slotName?: string;
  missing?: number;
};

// Backend'in 409 details alanını okunur bir listeye çevirir
const describe = (d: Detail): string => {
  if (d.rule) return d.message ? `${d.rule}: ${d.message}` : d.rule;
  if (d.slotName) return `${d.date} · ${d.slotName}: ${d.missing} kişi eksik`;
  if (d.firstname) return `${d.firstname} ${d.lastname}${d.registrationNumber ? ` (${d.registrationNumber})` : ''}`;
  if (d.message) return d.message;
  return JSON.stringify(d);
};

export default function ErrorDetails({ title, details }: { title: string; details: unknown[] }) {
  if (details.length === 0) return null;
  return (
    <Alert
      type="error"
      showIcon
      style={{ marginBottom: 16 }}
      message={title}
      description={
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {details.map((d, i) => (
            <li key={i}>{describe(d as Detail)}</li>
          ))}
        </ul>
      }
    />
  );
}
