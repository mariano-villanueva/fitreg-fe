import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface ErrorStateProps {
  type: "not_found" | "forbidden" | "generic";
  backTo?: string;
}

export default function ErrorState({ type, backTo = "/" }: ErrorStateProps) {
  const { t } = useTranslation();

  const config = {
    not_found: { icon: "🔍", title: t("error_not_found_title"), message: t("error_not_found_message") },
    forbidden: { icon: "🔒", title: t("error_forbidden_title"), message: t("error_forbidden_message") },
    generic: { icon: "⚠️", title: t("error_generic_title"), message: t("error_generic_message") },
  };

  const { icon, title, message } = config[type];

  return (
    <div className="page">
      <div className="error-state">
        <span className="error-state-icon">{icon}</span>
        <h2>{title}</h2>
        <p>{message}</p>
        <Link to={backTo} className="btn btn-primary">{t("detail_back")}</Link>
      </div>
    </div>
  );
}
