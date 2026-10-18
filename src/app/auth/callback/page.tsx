"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function AuthCallbackPage() {
  const [failed, setFailed] = useState(() => {
    if (typeof window === "undefined") return false;
    return !new URLSearchParams(window.location.search).get("code");
  });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const code = new URLSearchParams(window.location.search).get("code");
    if (!supabase || !code) return;
    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) setFailed(true);
      else window.location.replace("/profile");
    });
  }, []);

  return (
    <main className="auth-callback-page">
      {failed ? <><h1>Login belum selesai</h1><p>Silakan kembali lalu coba masuk dengan Google lagi.</p><Link href="/profile">Kembali ke Profil</Link></> : <><h1>Menyambungkan akun...</h1><p>Mohon tunggu sebentar.</p></>}
    </main>
  );
}
