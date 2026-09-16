/**
 * LCM product media: preserve card geometry and accessible context when an
 * external or stored product image cannot be loaded.
 */
import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

type LcmProductImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  loading?: "eager" | "lazy";
};

export function LcmProductImage({ src, alt, className = "", fallbackClassName = "", loading = "lazy" }: LcmProductImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return <div role="img" aria-label={`${alt}（画像を表示できません）`} className={`grid h-full w-full place-items-center bg-[#eeeae0] text-center text-black/35 ${fallbackClassName}`}><span className="grid place-items-center gap-2 px-3 text-[10px] font-black"><ImageOff className="h-7 w-7" />画像を表示できません</span></div>;
  }

  return <img src={src} alt={alt} loading={loading} onError={() => setFailed(true)} className={className} />;
}
