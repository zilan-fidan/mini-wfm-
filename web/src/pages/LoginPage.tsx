import { LockOutlined, LoginOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input } from 'antd';
import { useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router';
import { extractErrorMessage } from '../api/http';
import { useAuth } from '../auth/AuthContext';
import type { RedirectState } from '../auth/RequireAuth';
import BrandMark from '../components/BrandMark';
import type { LoginPayload } from '../types/auth';
import './LoginPage.css';

// Animasyonlu vardiya panosu: her satır bir ekip, her çubuk bir vardiya (başlangıç/uzunluk % olarak)
const HOURS = ['06', '09', '12', '15', '18', '21', '00'];
const BOARD_ROWS: { team: string; shifts: { start: number; length: number; tone: string }[] }[] = [
  { team: 'Saha A', shifts: [{ start: 0, length: 34, tone: 'blue' }, { start: 52, length: 30, tone: 'amber' }] },
  { team: 'Saha B', shifts: [{ start: 14, length: 40, tone: 'teal' }] },
  { team: 'Bakım', shifts: [{ start: 6, length: 22, tone: 'amber' }, { start: 40, length: 26, tone: 'blue' }] },
  { team: 'Destek', shifts: [{ start: 30, length: 46, tone: 'coral' }] },
  { team: 'Gece', shifts: [{ start: 66, length: 34, tone: 'teal' }] },
];

const FEATURES = ['Vardiya planlama', 'Ekip rotasyonu', 'İş emri takibi'];

export default function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();
  const redirectedFrom = (location.state as RedirectState | null)?.from;

  const [form] = Form.useForm<LoginPayload>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0); // aynı hata tekrar gelirse sallanma animasyonu yeniden oynasın

  // Başarılı girişte yönlendirmeyi GuestOnly yapar (gidilmek istenen adrese döner)
  const handleFinish = async (values: LoginPayload) => {
    setSubmitting(true);
    setError(null);
    try {
      await login({ username: values.username.trim(), password: values.password });
    } catch (err) {
      setError(extractErrorMessage(err)); // backend'in mesajı aynen gösterilir
      setErrorKey((k) => k + 1);
      form.setFieldValue('password', '');
      setSubmitting(false);
    }
  };

  return (
    <div className="login">
      {/* Sol: marka ve animasyon paneli */}
      <section className="login__showcase" aria-hidden="true">
        <div className="login__grid" />
        <div className="login__orb login__orb--one" />
        <div className="login__orb login__orb--two" />
        <div className="login__orb login__orb--three" />

        <div className="login__brand">
          <BrandMark size={44} animated />
          <span>Mini WFM</span>
        </div>

        <div className="login__pitch">
          <h1>
            Ekipleriniz, vardiyalarınız <br />
            ve iş emirleriniz <em>tek ekranda.</em>
          </h1>
          <p>Planlayın, atayın, takip edin. Saha operasyonlarınız her an kontrol altında.</p>
        </div>

        <div className="board">
          <div className="board__head">
            <span className="board__title">Bugünkü vardiyalar</span>
            <span className="board__live">
              <i /> Canlı
            </span>
          </div>
          <div className="board__hours">
            <span />
            {HOURS.map((h) => (
              <span key={h}>{h}</span>
            ))}
          </div>
          <div className="board__body">
            {BOARD_ROWS.map((row, rowIndex) => (
              <div className="board__row" key={row.team}>
                <span className="board__team">{row.team}</span>
                <div className="board__track">
                  {row.shifts.map((shift, i) => (
                    <span
                      key={i}
                      className={`board__shift board__shift--${shift.tone}`}
                      style={
                        {
                          left: `${shift.start}%`,
                          width: `${shift.length}%`,
                          '--delay': `${0.35 + rowIndex * 0.12 + i * 0.18}s`,
                        } as CSSProperties
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
            <div className="board__now">
              <span />
            </div>
          </div>
        </div>

        <ul className="login__features">
          {FEATURES.map((f, i) => (
            <li key={f} style={{ '--delay': `${1.2 + i * 0.15}s` } as CSSProperties}>
              {f}
            </li>
          ))}
        </ul>
      </section>

      {/* Sağ: giriş formu */}
      <section className="login__panel">
        <div className="login__card">
          <div className="login__mobile-brand">
            <BrandMark size={36} animated />
            <span>Mini WFM</span>
          </div>

          <h2 className="login__title">Tekrar hoş geldiniz</h2>
          <p className="login__subtitle">Devam etmek için hesabınızla giriş yapın.</p>

          {redirectedFrom && !error && (
            <Alert
              className="login__alert"
              type="info"
              showIcon
              message="Bu sayfayı görüntülemek için giriş yapmalısınız."
            />
          )}

          {error && (
            <Alert
              key={errorKey}
              className="login__alert login__alert--shake"
              type="error"
              showIcon
              message={error}
            />
          )}

          <Form<LoginPayload>
            form={form}
            layout="vertical"
            requiredMark={false}
            size="large"
            onFinish={handleFinish}
            onValuesChange={() => error && setError(null)}
            disabled={submitting}
          >
            <Form.Item
              label="Kullanıcı adı"
              name="username"
              rules={[{ required: true, whitespace: true, message: 'Kullanıcı adı zorunludur' }]}
            >
              <Input
                prefix={<UserOutlined className="login__icon" />}
                placeholder="kullanici.adi"
                autoComplete="username"
                autoFocus
              />
            </Form.Item>

            <Form.Item
              label="Şifre"
              name="password"
              rules={[{ required: true, message: 'Şifre zorunludur' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="login__icon" />}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting}
              icon={<LoginOutlined />}
              className="login__submit"
            >
              Giriş yap
            </Button>
          </Form>

          <p className="login__footnote">
            Hesabınız yoksa sistem yöneticinizden hesap talep edin.
          </p>
        </div>
      </section>
    </div>
  );
}
