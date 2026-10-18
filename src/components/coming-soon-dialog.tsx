"use client";

import { ExternalLink, Sparkles, X } from "lucide-react";

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
        <span className="feature-dialog-icon"><Sparkles /></span>
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
