"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabaseClient";
import { signOut } from "@/lib/auth";
import {
  ALLOWED_AVATAR_TYPES,
  AVATAR_BUCKET,
  MAX_AVATAR_SIZE_BYTES,
} from "@/lib/storage";
import {
  getUserAvatarUrl,
  getUserInitials,
} from "@/lib/profile";
import ConfigNotice from "./ConfigNotice";
import ProfileInfoCard from "./profile/ProfileInfoCard";
import { useLanguage } from "./LanguageProvider";

export default function ProfileClient() {
  const { t } = useLanguage();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setUser(null);
      return;
    }

    let active = true;
    const supabase = getSupabaseClient();

    supabase.auth.getSession().then(({ data }) => {
      if (active) setUser(data.session?.user ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active) setUser(session?.user ?? null);
      }
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function handleFileChange(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0]!;
    setUploadError(null);

    if (!isSupabaseConfigured()) {
      setUploadError(t("profile.avatar.error.config"));
      return;
    }

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setUploadError(t("profile.avatar.error.type"));
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setUploadError(t("profile.avatar.error.size"));
      return;
    }

    setUploading(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        setUploadError(t("profile.needLogin.title"));
        return;
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${currentUser.id}-${Date.now()}-${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { upsert: false });

      if (uploadErr) {
        setUploadError(
          t("profile.avatar.error.upload", { error: uploadErr.message })
        );
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(path);

      const { data: updated, error: updateErr } =
        await supabase.auth.updateUser({
          data: { avatar_url: publicUrlData.publicUrl },
        });

      if (updateErr) {
        setUploadError(
          t("profile.avatar.error.upload", { error: updateErr.message })
        );
        return;
      }

      setUser(updated.user);
    } catch (err) {
      setUploadError(
        t("profile.avatar.error.upload", {
          error: err instanceof Error ? err.message : "",
        })
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    await signOut();
    router.push("/login");
    router.refresh();
  }

  if (!isSupabaseConfigured()) {
    return <ConfigNotice />;
  }

  if (user === undefined) {
    return (
      <div className="rounded-2xl border border-neutral-100 bg-white p-6 text-neutral-800 sm:p-8">
        <p className="text-sm text-neutral-500">{t("profile.loading")}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-neutral-100 bg-white p-6 text-neutral-800 sm:p-8">
        <h2 className="text-lg font-bold">{t("profile.needLogin.title")}</h2>
        <p className="mt-2 text-sm text-neutral-600">
          {t("profile.needLogin.body")}
        </p>
      </div>
    );
  }

  const avatarUrl = getUserAvatarUrl(user);
  const initials = getUserInitials(user);
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-neutral-100 bg-white p-6 sm:p-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <span className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#7a9a5a] text-2xl font-bold text-white">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden="true">{initials}</span>
            )}
          </span>

          <div className="flex flex-col items-center gap-2 sm:items-start">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-full border border-[#7a9a5a] px-4 py-2 text-sm font-bold text-[#4f7a37] transition hover:bg-[#f2f6ec] disabled:opacity-60"
            >
              {uploading
                ? t("profile.avatar.uploading")
                : t("profile.avatar.change")}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              onChange={(e) => {
                handleFileChange(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />
            <p className="text-xs text-neutral-400">
              {t("profile.avatar.hint")}
            </p>
          </div>
        </div>

        {uploadError && (
          <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
            {uploadError}
          </div>
        )}
      </div>

      <ProfileInfoCard user={user} />

      <div className="rounded-2xl border border-neutral-100 bg-white p-6 sm:p-8">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="w-full rounded-full bg-[#7a9a5a] px-6 py-3 text-center text-sm font-extrabold text-[#0d0f0c] transition hover:brightness-95 disabled:opacity-60 sm:w-auto"
        >
          {isSigningOut
            ? t("profile.signout.pending")
            : t("profile.signout")}
        </button>
      </div>
    </div>
  );
}
