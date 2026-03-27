import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import FeedbackModal from "@/components/FeedbackModal";
import ChatFAB from "@/components/ChatFAB";
import AppLogo from "@/components/AppLogo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", user!.id)
    .maybeSingle();

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/app"><AppLogo /></Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/app/settings"
              className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Settings
            </Link>
            <FeedbackModal />
            <span className="text-xs text-zinc-400 dark:text-zinc-600">|</span>
            <Link
              href="/app/profile"
              className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              {profile?.display_name ?? "Profile"}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {children}
      </main>

      <ChatFAB />
    </div>
  );
}
