"use client";

import { ExternalLink, X } from "lucide-react";
import Image from "next/image";

const DOWNLOAD_URL = "https://dongflix-download.vercel.app";

export function ComingSoonDialog({
  feature,
  onClose,
}: {
  feature: string | null;
  onClose: () => void;
}) {
  if (!feature) return null;

  return (
    <div className="feature-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="feature-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feature-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="feature-dialog-close" type="button" onClick={onClose} aria-label="Tutup">
          <X />
        </button>
        <span className="feature-dialog-icon">
          <Image src="/icons/app_icon.png" alt="Ikon DongFlix" width={46} height={46} />
        </span>
        <h2 id="feature-dialog-title">{feature} segera hadir di web</h2>
        <p>
          Fitur ini sedang kami siapkan. Untuk menikmati fitur DongFlix yang lebih lengkap,
          gunakan aplikasi DongFlix.
        </p>
        <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer">
          Unduh aplikasi DongFlix <ExternalLink />
        </a>
        <button className="feature-dialog-later" type="button" onClick={onClose}>Nanti saja</button>
      </section>
    </div>
  );
}
