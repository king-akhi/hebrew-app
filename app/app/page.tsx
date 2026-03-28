import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StatsPanel from "@/components/StatsPanel";
import AddCardsMenu from "@/components/AddCardsMenu";
import ReviewPrefetch from "@/components/ReviewPrefetch";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [profileResult, dueCountResult, verbCountResult] = await Promise.all([
    supabase
      .from("users")
      .select("display_name, level, daily_card_limit")
      .eq("id", user!.id)
      .maybeSingle(),
    supabase
      .from("fsrs_state")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .lte("due", new Date().toISOString()),
    supabase
      .from("fsrs_state")
      .select("card_id, cards!inner(word_type)", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .eq("direction", "he_to_en")
      .eq("cards.word_type", "verb"),
  ]);

  const profile = profileResult.data;
  const dueCount = dueCountResult.count ?? 0;
  const verbCount = verbCountResult.count ?? 0;
  const level = profile?.level as "A1" | "A2" | "B1" | "B2" | undefined;

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12 ? "בוקר טוב" : greetingHour < 18 ? "צהריים טובים" : "ערב טוב";

  return (
    <div className="space-y-5">
      <ReviewPrefetch />
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">{greeting}</p>
          <h1 className="text-xl font-semibold mt-0.5">
            {profile?.display_name ?? "there"} 👋
          </h1>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Link
            href="/app/vocabulary"
            className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium transition-colors"
          >
            All cards
          </Link>
          <AddCardsMenu level={level} />
        </div>
      </div>

      {/* LEARN section */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Learn
          </span>
          <div className="flex-1 h-px bg-blue-200 dark:bg-blue-900/60" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Words */}
          <Link
            href="/app/review"
            className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors overflow-hidden border-l-4 border-l-blue-500"
          >
            <div className="px-4 py-3 flex flex-col gap-2">
              <span className="text-xl">🗃️</span>
              <div>
                <p className="text-sm font-semibold">Words</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {dueCount > 0 ? `${dueCount} card${dueCount > 1 ? "s" : ""} due` : "All caught up"}
                </p>
              </div>
              <span className="self-start text-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                Review →
              </span>
            </div>
          </Link>

          {/* Verbs */}
          <Link
            href="/app/verbs"
            className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors overflow-hidden border-l-4 border-l-blue-500"
          >
            <div className="px-4 py-3 flex flex-col gap-2">
              <span className="text-xl">🔤</span>
              <div>
                <p className="text-sm font-semibold">Verbs</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {verbCount > 0 ? `${verbCount} verb${verbCount > 1 ? "s" : ""}` : "No verbs yet"}
                </p>
              </div>
              <span className="self-start text-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                Conjugate →
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* PRACTICE section */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Practice
          </span>
          <div className="flex-1 h-px bg-emerald-200 dark:bg-emerald-900/60" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Translate */}
          <Link
            href="/app/practice"
            className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors overflow-hidden border-l-4 border-l-emerald-500"
          >
            <div className="px-4 py-3 flex flex-col gap-2">
              <span className="text-xl">✍️</span>
              <div>
                <p className="text-sm font-semibold">Sentences</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Write or talk</p>
              </div>
              <span className="self-start text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                Start →
              </span>
            </div>
          </Link>

          {/* Talk — coming soon */}
          <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 overflow-hidden border-l-4 border-l-emerald-200 dark:border-l-emerald-900 opacity-60 cursor-not-allowed">
            <div className="px-4 py-3 flex flex-col gap-2">
              <span className="text-xl">💬</span>
              <div>
                <p className="text-sm font-semibold">Conversation</p>
                <p className="text-xs text-zinc-400">Discuss with AI Tutor</p>
              </div>
              <span className="self-start text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-medium">
                Soon
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
            Stats
          </span>
          <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <StatsPanel />
      </div>
    </div>
  );
}
