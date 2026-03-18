import { useEffect, useState } from "react";
import client from "../api/client";

interface AuthImageProps {
  src: string;
  alt: string;
  className?: string;
}

export default function AuthImage({ src, alt, className }: AuthImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return;
    let currentUrl: string | null = null;
    client
      .get(src, { responseType: "blob" })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        currentUrl = url;
        setObjectUrl(url);
      })
      .catch(() => setObjectUrl(null));
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [src]);

  if (!objectUrl) return null;
  return <img src={objectUrl} alt={alt} className={className} />;
}
