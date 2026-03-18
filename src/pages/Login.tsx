import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { googleLogin } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../context/FeedbackContext";
import { useTranslation } from "react-i18next";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation();
  const { showError } = useFeedback();

  async function handleGoogleSuccess(credentialResponse: { credential?: string }) {
    if (!credentialResponse.credential) {
      showError("Google login failed. No credential received.");
      return;
    }
    try {
      const res = await googleLogin(credentialResponse.credential);
      login(res.data.token, res.data.user);
      navigate("/");
    } catch {
      showError("Login failed. Please try again.");
    }
  }

  const features = [
    { icon: '🏅', titleKey: 'landing_feature_1_title', subKey: 'landing_feature_1_sub' },
    { icon: '📋', titleKey: 'landing_feature_2_title', subKey: 'landing_feature_2_sub' },
    { icon: '📊', titleKey: 'landing_feature_3_title', subKey: 'landing_feature_3_sub' },
  ];

  return (
    <div className="landing-page">
      {/* Mini-navbar */}
      <nav className="landing-navbar">
        <div className="landing-logo">
          <span className="landing-logo-fit">Fit</span>
          <span className="landing-logo-reg">Reg</span>
        </div>
        <span className="landing-tagline">{t('app_tagline')}</span>
      </nav>

      {/* Two-panel body */}
      <div className="landing-panels">

        {/* Left — value proposition */}
        <div className="landing-left">
          {/* Anti-AI badge */}
          <div className="landing-badge">
            <span className="landing-badge-dot" />
            <span className="landing-badge-text">{t('landing_badge')}</span>
          </div>

          {/* Headline */}
          <div>
            <h1 className="landing-headline">{t('landing_headline')}</h1>
            <p className="landing-subheadline"
              dangerouslySetInnerHTML={{ __html: t('landing_subheadline').replace(
                'verificados por nuestra comunidad',
                '<strong>verificados por nuestra comunidad</strong>'
              ).replace(
                'verified by our community',
                '<strong>verified by our community</strong>'
              )}}
            />
          </div>

          {/* Feature list */}
          <div className="landing-features">
            {features.map((f) => (
              <div key={f.titleKey} className="landing-feature">
                <div className="landing-feature-icon">{f.icon}</div>
                <div>
                  <p className="landing-feature-title">{t(f.titleKey)}</p>
                  <p className="landing-feature-sub">{t(f.subKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — login card */}
        <div className="landing-right">
          <div>
            <h2 className="landing-login-title">{t('landing_login_title')}</h2>
            <p className="landing-login-desc">{t('landing_login_desc')}</p>
          </div>

          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => showError("Google login failed.")}
            theme="filled_black"
            size="large"
            width="260"
            text="continue_with"
          />

          {/* Separator */}
          <div className="landing-separator">
            <div className="landing-separator-line" />
            <span className="landing-separator-label">{t('landing_free_label')}</span>
            <div className="landing-separator-line" />
          </div>

          {/* Trust signals */}
          <div className="landing-trust">
            <p className="landing-trust-title">{t('landing_trust_title')}</p>
            <p className="landing-trust-item">
              <span className="landing-trust-check">✓</span>
              {t('landing_trust_1')}
            </p>
            <p className="landing-trust-item">
              <span className="landing-trust-check">✓</span>
              {t('landing_trust_2')}
            </p>
            <p className="landing-trust-item">
              <span className="landing-trust-check">✓</span>
              {t('landing_trust_3')}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
