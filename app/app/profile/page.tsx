"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/actions/auth";

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => { if (data.display_name) setName(data.display_name); });
  }, []);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setNameSaving(true);
    setNameError(null);
    setNameSaved(false);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: name || null }),
    });
    setNameSaving(false);
    if (res.ok) {
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
      router.refresh(); // refresh server components (header display name)
    } else {
      setNameError("Save failed. Please try again.");
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSaved(false);
    if (newPassword.length < 8) {
      setPwError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords don't match.");
      return;
    }
    setPwSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (error) {
      setPwError(error.message);
    } else {
      setPwSaved(true);
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwSaved(false), 2500);
    }
  }

  return (
    <div className="space-y-10 max-w-lg">
      <h1 className="text-xl font-semibold">Profile</h1>

      {/* ── Display name ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Display name</h2>
        <form onSubmit={handleSaveName} className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={nameSaving}
              className="rounded-lg bg-blue-600 text-white px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {nameSaving ? "Saving…" : "Save"}
            </button>
            {nameSaved && <span className="text-sm text-green-600 dark:text-green-400">Saved!</span>}
            {nameError && <span className="text-sm text-red-500">{nameError}</span>}
          </div>
        </form>
      </section>

      {/* ── Password ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Change password</h2>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={pwSaving || !newPassword}
              className="rounded-lg bg-blue-600 text-white px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {pwSaving ? "Updating…" : "Update password"}
            </button>
            {pwSaved && <span className="text-sm text-green-600 dark:text-green-400">Password updated!</span>}
            {pwError && <span className="text-sm text-red-500">{pwError}</span>}
          </div>
        </form>
      </section>

      {/* ── Sign out ── */}
      <section className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-red-500 hover:text-red-600 dark:hover:text-red-400"
          >
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}
