import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { googleLogin } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation();
  const [error, setError] = useState("");

  async function handleGoogleSuccess(credentialResponse: { credential?: string }) {
    if (!credentialResponse.credential) {
      setError("Google login failed. No credential received.");
      return;
    }

    try {
      const res = await googleLogin(credentialResponse.credential);
      login(res.data.token, res.data.user);
      navigate("/");
    } catch {
      setError("Login failed. Please try again.");
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
        {error && <div className="error">{error}</div>}
        <div className="login-button-wrapper">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError("Google login failed.")}
            theme="filled_black"
            size="large"
            width="300"
          />
        </div>
      </div>
    </div>
  );
}
