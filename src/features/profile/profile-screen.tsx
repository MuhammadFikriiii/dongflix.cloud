"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

type SocialStats = {
  followers_count?: number; following_count?: number; coins_total?: number;
  anime_watched_count?: number; donghua_watched_count?: number;
  movie_watched_count?: number; novel_read_count?: number;
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
  const [social, setSocial] = useState<SocialStats>({});
  const [preview, setPreview] = useState<"profile" | "comment" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const [profileResult, socialResult] = await Promise.all([
      supabase.from("profiles")
        .select("display_name, avatar_path, exp, premium_until, premium_badge_visible, premium_verified_color, is_admin, show_admin_badge, profile_header_colors, cultivation_path, name_color, premium_name_color, premium_badge_hex")
        .eq("id", currentUser.id).maybeSingle(),
      supabase.rpc("get_public_social_profile", { p_user_id: currentUser.id }),
    ]);
    const { data, error: profileError } = profileResult;
    setProfile(profileError ? null : data as ProfileRow | null);
    setSocial((socialResult.data ?? {}) as SocialStats);
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

  const refresh = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    await loadProfile(data.user);
  };

  const editName = async () => {
    if (!user) return;
    const next = window.prompt("Nama profil", name)?.trim();
    if (!next || next === name) return;
    const supabase = getSupabaseBrowserClient();
    const result = await supabase?.from("profiles").update({ display_name: next }).eq("id", user.id);
    if (result?.error) return setError("Nama belum dapat diperbarui.");
    await refresh();
  };

  const editHeaderColors = async () => {
    const raw = window.prompt("Masukkan maksimal 3 warna HEX, pisahkan dengan koma", colors.join(", "));
    if (!raw) return;
    const next = raw.split(",").map((value) => value.trim()).filter((value) => /^#[0-9a-f]{6}$/i.test(value)).slice(0, 3);
    if (!next.length) return setError("Gunakan kode warna HEX, contoh #5865F2.");
    const result = await getSupabaseBrowserClient()?.rpc("set_profile_header_colors", { p_colors: next });
    if (result?.error) return setError("Warna header belum dapat disimpan.");
    await refresh();
  };

  const editCultivation = async () => {
    const next = window.prompt("Pilih tampilan: level, renegade_immortal, perfect_world, atau battle_through_the_heavens", profile?.cultivation_path || "level")?.trim();
    if (!next) return;
    const result = await getSupabaseBrowserClient()?.rpc("set_cultivation_path", { p_path: next });
    if (result?.error) return setError("Pilihan tingkat kultivasi belum dapat disimpan.");
    await refresh();
  };

  const editNameColor = async () => {
    if (!user) return;
    const next = window.prompt("Warna nama (HEX)", nameColor || "#FFFFFF")?.trim();
    if (!next || !/^#[0-9a-f]{6}$/i.test(next)) return setError("Gunakan kode warna HEX, contoh #F59E0B.");
    const result = await getSupabaseBrowserClient()?.from("profiles").update({ name_color: next.toUpperCase() }).eq("id", user.id);
    if (result?.error) return setError("Warna ini belum terbuka untuk akunmu.");
    await refresh();
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!file || !user) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return setError("Pilih gambar maksimal 5 MB.");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const objectPath = `${user.id}/${Date.now()}.${extension}`;
    const uploaded = await supabase.storage.from("avatars").upload(objectPath, file, { upsert: false });
    if (!uploaded.error) await supabase.from("profiles").update({ avatar_path: objectPath }).eq("id", user.id);
    setBusy(false);
    if (uploaded.error) return setError("Foto profil belum dapat diunggah.");
    await refresh();
  };

  const showConnections = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const [followers, following] = await Promise.all([
      supabase.rpc("list_my_social_connections", { p_kind: "followers", p_offset: 0, p_limit: 30 }),
      supabase.rpc("list_my_social_connections", { p_kind: "following", p_offset: 0, p_limit: 30 }),
    ]);
    const names = [...(followers.data ?? []), ...(following.data ?? [])].map((item: { display_name?: string }) => item.display_name).filter(Boolean);
    window.alert(names.length ? `Koneksi:\n${[...new Set(names)].join("\n")}` : "Belum ada koneksi.");
  };

  const searchPeople = async () => {
    const query = window.prompt("Cari nama pengguna")?.trim();
    if (!query || query.length < 2) return;
    const result = await getSupabaseBrowserClient()?.rpc("search_social_profiles", { p_query: query, p_limit: 20 });
    const names = (result?.data ?? []).map((item: { display_name?: string; account_level?: number }) => `${item.display_name ?? "Pengguna"} • Level ${item.account_level ?? 1}`);
    window.alert(names.length ? names.join("\n") : "Pengguna tidak ditemukan.");
  };

  const metadata = user?.user_metadata ?? {};
  const name = profile?.display_name?.trim() || metadata.full_name || metadata.name || user?.email?.split("@")[0] || "Pengguna DongFlix";
  const email = user?.email ?? "";
  const storedAvatar = profile?.avatar_path || "";
  const avatar = storedAvatar.startsWith("http")
    ? storedAvatar
    : storedAvatar
      ? getSupabaseBrowserClient()?.storage.from("avatars").getPublicUrl(storedAvatar).data.publicUrl || ""
      : metadata.avatar_url || metadata.picture || "";
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
                <button type="button" className="profile-color-button" onClick={() => void editHeaderColors()}><Palette /> Ganti warna</button>
                <button type="button" className="profile-avatar" aria-label={`Ganti avatar ${name}`} onClick={() => fileInputRef.current?.click()}>
                  {avatar ? <Image src={avatar} alt="" fill sizes="96px" unoptimized referrerPolicy="no-referrer" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
                  <span className="profile-camera-badge"><Camera /></span>
                </button>
                <input ref={fileInputRef} className="profile-file-input" type="file" accept="image/*" onChange={(event) => void uploadAvatar(event.target.files?.[0])} />
                <button type="button" className="profile-identity" onClick={() => void editName()}>
                  <div className="profile-name-row">
                    <strong style={nameColor ? { color: nameColor } : undefined}>{name}</strong>
                    {verified ? <CheckCircle2 size={18} color={premium ? profile?.premium_verified_color || "#F8C35A" : "#2196F3"} fill="currentColor" /> : null}
                    {premium ? <span className="premium-chip" style={profile?.premium_badge_hex ? { color: profile.premium_badge_hex } : undefined}><Crown size={12} /> Premium</span> : null}
                  </div>
                  <span>{email}</span>
                </button>
              </ProfileHeader>

              <div className="profile-rank-chip"><Sparkles /> {profile?.cultivation_path === "level" || !profile?.cultivation_path ? `Level ${level}` : `${profile.cultivation_path.replaceAll("_", " ")} • Level ${level}`}</div>

              <div className="profile-preview-actions">
                <button type="button" onClick={() => setPreview("profile")}><Eye /> Preview profil</button>
                <button type="button" onClick={() => setPreview("comment")}><MessageCircle /> Preview komentar</button>
              </div>

              <div className="profile-custom-actions">
                <button type="button" onClick={() => void editNameColor()}><Paintbrush /> Warna nama</button>
                <button type="button" onClick={() => void editCultivation()}><Sparkles /> Kultivasi</button>
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
                <div><strong>{social.followers_count ?? 0}</strong><span>Pengikut</span></div>
                <div><strong>{social.following_count ?? 0}</strong><span>Mengikuti</span></div>
                <div><strong>{social.coins_total ?? 0}</strong><span>Koin</span></div>
              </div>
              <div className="profile-social-actions">
                <button type="button" onClick={() => void showConnections()}><Users /> Koneksi</button>
                <button type="button" onClick={() => void searchPeople()}><Search /> Cari</button>
              </div>
              <div className="profile-social-divider" />
              <h2>Jejak tontonan</h2>
              <div className="profile-watch-counters">
                <div><Film /><strong>{social.anime_watched_count ?? 0}</strong><span>Anime</span></div>
                <div><Play /><strong>{social.donghua_watched_count ?? 0}</strong><span>Donghua</span></div>
                <div><Clapperboard /><strong>{social.movie_watched_count ?? 0}</strong><span>Movie</span></div>
                <div><BookOpen /><strong>{social.novel_read_count ?? 0}</strong><span>Bab Novel</span></div>
              </div>
            </section>
          </section>

          <div className="profile-sync-note"><ShieldCheck /><span>Login tersinkron dengan APK, EXE, dan web</span></div>
          <button type="button" className="profile-signout" onClick={() => void signOut()} disabled={busy}><LogOut /> Keluar</button>
          {error ? <p className="profile-error">{error}</p> : null}
          {preview ? (
            <div className="profile-preview-modal" role="dialog" aria-modal="true" aria-label={preview === "profile" ? "Preview profil" : "Preview komentar"} onClick={() => setPreview(null)}>
              <div onClick={(event) => event.stopPropagation()}>
                <button type="button" className="profile-preview-close" onClick={() => setPreview(null)}>×</button>
                <p>{preview === "profile" ? "Tampilan profilmu untuk orang lain" : "Tampilan komentarmu untuk orang lain"}</p>
                <div className={preview === "comment" ? "profile-comment-preview" : "profile-public-preview"}>
                  <span className="profile-mini-avatar">{avatar ? <Image src={avatar} alt="" fill sizes="44px" unoptimized /> : name.slice(0, 1).toUpperCase()}</span>
                  <div><strong style={nameColor ? { color: nameColor } : undefined}>{name}</strong>{verified ? <CheckCircle2 size={14} color="#2196F3" fill="currentColor" /> : null}<small>Level {level}</small>{preview === "comment" ? <p>Ini contoh tampilan komentar kamu. Preview ini tidak akan dipublikasikan.</p> : null}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
