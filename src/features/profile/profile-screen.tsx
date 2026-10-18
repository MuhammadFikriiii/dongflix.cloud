"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, ChevronLeft, Crown, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type ProfileRow = {
  display_name: string | null;
  avatar_path: string | null;
  exp: number | string | null;
  premium_until: string | null;
  premium_badge_visible: boolean | null;
  premium_verified_color: string | null;
  is_admin: boolean | null;
  show_admin_badge: boolean | null;
  profile_header_colors: string[] | null;
};

const fallbackColors = ["#5865F2"];

function levelFromExp(rawExp: number) {
  return Math.max(1, Math.min(100, Math.floor(Math.sqrt(Math.max(0, rawExp) / 1020.3)) + 1));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function ProfileHeader({ children, colors }: { children: React.ReactNode; colors: string[] }) {
  const palette = colors.length ? colors.slice(0, 3) : fallbackColors;
  const background = palette.length === 1
    ? palette[0]
    : `linear-gradient(120deg, ${palette.join(", ")})`;
  return <section className="profile-header" style={{ background }}>{children}</section>;
}

export function ProfileScreen() {
  const hasAuthConfig = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(hasAuthConfig);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (currentUser: User | null) => {
    setUser(currentUser);
    if (!currentUser) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Login web belum dikonfigurasi.");
      setLoading(false);
      return;
    }
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("display_name, avatar_path, exp, premium_until, premium_badge_visible, premium_verified_color, is_admin, show_admin_badge, profile_header_colors")
      .eq("id", currentUser.id)
      .maybeSingle();
    setProfile(profileError ? null : data as ProfileRow | null);
    if (profileError) setError("Profil belum dapat dimuat. Coba buka kembali halaman ini.");
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => void loadProfile(data.user));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadProfile(session?.user ?? null);
    });
    return () => subscription.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Konfigurasi Google Login belum tersedia.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setError("Google Login belum dapat dimulai. Coba lagi sesaat lagi.");
      setBusy(false);
    }
  };

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    await supabase.auth.signOut();
    setBusy(false);
  };

  const metadata = user?.user_metadata ?? {};
  const name = profile?.display_name?.trim() || metadata.full_name || metadata.name || user?.email?.split("@")[0] || "Pengguna DongFlix";
  const email = user?.email ?? "";
  const avatar = profile?.avatar_path || metadata.avatar_url || metadata.picture || "";
  const exp = Number(profile?.exp ?? 0) || 0;
  const level = levelFromExp(exp);
  const premiumUntil = profile?.premium_until ? new Date(profile.premium_until) : null;
  const premium = Boolean(premiumUntil && premiumUntil > new Date());
  const verified = (profile?.is_admin && profile.show_admin_badge) || (premium && profile?.premium_badge_visible);
  const colors = profile?.profile_header_colors?.filter((color) => /^#[0-9a-f]{6}$/i.test(color)) ?? fallbackColors;

  return (
    <main className="profile-page">
      <header className="profile-topbar">
        <Link href="/" aria-label="Kembali ke beranda"><ChevronLeft /></Link>
        <h1>Profil</h1>
        <span aria-hidden="true" />
      </header>

      {loading ? <div className="profile-loading">Memuat profil...</div> : null}

      {!loading && !user ? (
        <section className="profile-login-card">
          <span className="profile-login-mark"><Sparkles /></span>
          <h2>Masuk ke DongFlix</h2>
          <p>Masuk dengan akun Google yang sama seperti di aplikasi DongFlix untuk melanjutkan data akunmu.</p>
          <button type="button" className="google-login-button" onClick={() => void signIn()} disabled={busy}>
            <span className="google-g">G</span>{busy ? "Mengarahkan ke Google..." : "Lanjutkan dengan Google"}
          </button>
          {error ? <p className="profile-error">{error}</p> : null}
        </section>
      ) : null}

      {!loading && user ? (
        <div className="profile-content">
          <ProfileHeader colors={colors}>
            <div className="profile-avatar" aria-label={`Avatar ${name}`}>
              {avatar ? <Image src={avatar} alt="" fill sizes="94px" unoptimized referrerPolicy="no-referrer" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
            </div>
            <div className="profile-identity">
              <div className="profile-name-row">
                <strong>{name}</strong>
                {verified ? <CheckCircle2 size={18} color={premium ? profile?.premium_verified_color || "#F8C35A" : "#2196F3"} fill="currentColor" /> : null}
                {premium ? <span className="premium-chip"><Crown size={12} /> Premium</span> : null}
              </div>
              <span>{email}</span>
            </div>
          </ProfileHeader>

          <section className="profile-stats" aria-label="Statistik akun">
            <div><span>Level</span><strong>{level}</strong></div>
            <div><span>EXP</span><strong>{formatNumber(exp)}</strong></div>
            <div><span>Status</span><strong>{premium ? "Premium" : "Gratis"}</strong></div>
          </section>

          <section className="profile-section">
            <h2>Akun & sinkronisasi</h2>
            <div className="profile-row"><ShieldCheck /><span>Login tersinkron dengan APK, EXE, dan web</span></div>
            <button type="button" className="profile-signout" onClick={() => void signOut()} disabled={busy}><LogOut /> Keluar dari akun</button>
          </section>
          {error ? <p className="profile-error">{error}</p> : null}
        </div>
      ) : null}
    </main>
  );
}
