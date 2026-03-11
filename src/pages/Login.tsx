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

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">{t('login_title')}</h1>
          <p className="login-subtitle">{t('login_subtitle')}</p>
        </div>
        <p className="login-description">
          {t('login_feature_1')}. {t('login_feature_2')}. {t('login_feature_3')}.
        </p>
        <div className="login-button-wrapper">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => showError("Google login failed.")}
            theme="filled_black"
            size="large"
            width="300"
          />
        </div>
      </div>
    </div>
  );
}
