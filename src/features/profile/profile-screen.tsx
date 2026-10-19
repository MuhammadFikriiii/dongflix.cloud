"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronLeft,
  Clapperboard,
  Crown,
  Eye,
  Film,
  LockKeyhole,
  LogOut,
  Mail,
  MessageCircle,
  Paintbrush,
  Palette,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
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
  cultivation_path: string | null;
  name_color: string | null;
  premium_name_color: string | null;
  premium_badge_hex: string | null;
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
      .select("display_name, avatar_path, exp, premium_until, premium_badge_visible, premium_verified_color, is_admin, show_admin_badge, profile_header_colors, cultivation_path, name_color, premium_name_color, premium_badge_hex")
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
  const nameColor = premium ? profile?.premium_name_color : profile?.name_color;
  const expForNextLevel = level >= 100 ? exp : Math.round(level * level * 1020.3);
  const expBase = level <= 1 ? 0 : Math.round((level - 1) * (level - 1) * 1020.3);
  const expProgress = level >= 100 ? 100 : Math.max(0, Math.min(100, ((exp - expBase) / Math.max(1, expForNextLevel - expBase)) * 100));

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
          <h2>Selamat datang kembali</h2>
          <p>Masuk untuk menyinkronkan daftar tontonan dan melanjutkan aktivitas DongFlix di semua perangkat.</p>
          <div className="profile-login-fields" aria-label="Formulir login">
            <label className="profile-input-wrap">
              <Mail aria-hidden="true" />
              <input type="email" placeholder="Email" aria-label="Email" autoComplete="email" />
            </label>
            <label className="profile-input-wrap">
              <LockKeyhole aria-hidden="true" />
              <input type="password" placeholder="Kata sandi" aria-label="Kata sandi" autoComplete="current-password" />
            </label>
            <button type="button" className="profile-submit-button" disabled title="Login email akan segera tersedia">Masuk</button>
          </div>
          <div className="profile-or-divider"><span>atau</span></div>
          <button type="button" className="google-login-button" onClick={() => void signIn()} disabled={busy}>
            <span className="google-g">G</span>{busy ? "Mengarahkan ke Google..." : "Lanjutkan dengan Google"}
          </button>
          <p className="profile-login-footnote">Gunakan akun Google yang sama dengan aplikasi DongFlix.</p>
          {error ? <p className="profile-error">{error}</p> : null}
        </section>
      ) : null}

      {!loading && user ? (
        <div className="profile-content">
          <section className="profile-shell-card">
            <div className="profile-identity-block">
              <ProfileHeader colors={colors}>
                <button type="button" className="profile-color-button" title="Fitur segera tersedia"><Palette /> Ganti warna</button>
                <div className="profile-avatar" aria-label={`Avatar ${name}`}>
                  {avatar ? <Image src={avatar} alt="" fill sizes="96px" unoptimized referrerPolicy="no-referrer" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
                  <span className="profile-camera-badge"><Camera /></span>
                </div>
                <div className="profile-identity">
                  <div className="profile-name-row">
                    <strong style={nameColor ? { color: nameColor } : undefined}>{name}</strong>
                    {verified ? <CheckCircle2 size={18} color={premium ? profile?.premium_verified_color || "#F8C35A" : "#2196F3"} fill="currentColor" /> : null}
                    {premium ? <span className="premium-chip" style={profile?.premium_badge_hex ? { color: profile.premium_badge_hex } : undefined}><Crown size={12} /> Premium</span> : null}
                  </div>
                  <span>{email}</span>
                </div>
              </ProfileHeader>

              <div className="profile-rank-chip"><Sparkles /> {profile?.cultivation_path === "level" || !profile?.cultivation_path ? `Level ${level}` : `${profile.cultivation_path} • Level ${level}`}</div>

              <div className="profile-preview-actions">
                <button type="button" title="Fitur segera tersedia"><Eye /> Preview profil</button>
                <button type="button" title="Fitur segera tersedia"><MessageCircle /> Preview komentar</button>
              </div>

              <div className="profile-custom-actions">
                <button type="button" title="Fitur segera tersedia"><Paintbrush /> Warna nama</button>
                <button type="button" title="Fitur segera tersedia"><Sparkles /> Kultivasi</button>
              </div>
            </div>

            <section className="profile-level-card" aria-label="Level dan EXP akun">
              <div className="profile-level-head">
                <strong>Level {level}</strong>
                <span>{level >= 100 ? "MAX ✨" : `${formatNumber(exp)} / ${formatNumber(expForNextLevel)} EXP`}</span>
              </div>
              <div className="profile-exp-track"><span style={{ width: `${expProgress}%` }} /></div>
              {level < 100 ? <small>{formatNumber(Math.max(0, expForNextLevel - exp))} EXP menuju Level {level + 1}</small> : null}
            </section>

            <section className="profile-social-card">
              <div className="profile-social-counters">
                <div><strong>0</strong><span>Pengikut</span></div>
                <div><strong>0</strong><span>Mengikuti</span></div>
                <div><strong>0</strong><span>Koin</span></div>
              </div>
              <div className="profile-social-actions">
                <button type="button" title="Fitur segera tersedia"><Users /> Koneksi</button>
                <button type="button" title="Fitur segera tersedia"><Search /> Cari</button>
              </div>
              <div className="profile-social-divider" />
              <h2>Jejak tontonan</h2>
              <div className="profile-watch-counters">
                <div><Film /><strong>0</strong><span>Anime</span></div>
                <div><Play /><strong>0</strong><span>Donghua</span></div>
                <div><Clapperboard /><strong>0</strong><span>Movie</span></div>
                <div><BookOpen /><strong>0</strong><span>Bab Novel</span></div>
              </div>
            </section>
          </section>

          <div className="profile-sync-note"><ShieldCheck /><span>Login tersinkron dengan APK, EXE, dan web</span></div>
          <button type="button" className="profile-signout" onClick={() => void signOut()} disabled={busy}><LogOut /> Keluar</button>
          {error ? <p className="profile-error">{error}</p> : null}
        </div>
      ) : null}
    </main>
  );
}
