import { EnvironmentFilled, LockOutlined, LoginOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input } from 'antd';
import { useState } from 'react';
import { extractErrorMessage } from '../api/http';
import departingVan from '../assets/login-departing-van.webp';
import serviceVan from '../assets/login-service-van.webp';
import { useAuth } from '../auth/AuthContext';
import BrandMark from '../components/BrandMark';
import type { LoginPayload } from '../types/auth';
import './LoginPage.css';

export default function LoginPage() {
  const { login } = useAuth();

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
      <section className="login__showcase" aria-label="Mini WFM saha operasyonları">
        <div className="login-scene" aria-hidden="true">
          <div className="login-scene__route-light login-scene__route-light--upper" />
          <div className="login-scene__route-light login-scene__route-light--lower" />

          <div className="login-scene__vehicle login-scene__vehicle--upper">
            <img src={departingVan} alt="" />
          </div>
          <div className="login-scene__vehicle login-scene__vehicle--lower">
            <img src={serviceVan} alt="" />
          </div>

          <div className="login-scene__pin login-scene__pin--warehouse"><EnvironmentFilled /></div>
          <div className="login-scene__pin login-scene__pin--depot"><EnvironmentFilled /></div>
          <div className="login-scene__pin login-scene__pin--transformer"><EnvironmentFilled /></div>
        </div>

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
