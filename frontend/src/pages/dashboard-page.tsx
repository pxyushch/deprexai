import {
  startTransition,
  useEffect,
  useMemo,
  useState,
} from "react";
import { motion } from "framer-motion";
import {
  Activity,
  BadgeAlert,
  Database,
  Flame,
  LoaderCircle,
  Radar,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Waves,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { PageTransition } from "@/components/layout/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { severityTone } from "@/lib/presentation";
import { cn } from "@/lib/utils";
import type { StatsResponse } from "@/types/api";

const SEVERITY_COLORS = ["#F6D365", "#FB923C", "#FB7185"];
const DEMO_MIN_POSTS = 2000;
const DASHBOARD_CACHE_KEY = "deprexai.dashboard.stats.v4";
const CHART_TOOLTIP_STYLE = {
  backgroundColor: "rgba(2,6,23,0.94)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "16px",
  color: "#F8FAFC",
  boxShadow: "0 22px 60px rgba(15,23,42,0.45)",
  padding: "12px 14px",
};
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});
const PROCESS_PRESETS = [
  {
    key: "quick",
    label: "Quick",
    limit: 256,
    note: "Fast smoke test before you present",
  },
  {
    key: "demo",
    label: "Demo",
    limit: 2000,
    note: "Recommended stage-ready sample",
  },
  {
    key: "showcase",
    label: "Showcase",
    limit: 5000,
    note: "Broader spread for a larger presentation screen",
  },
] as const;

const EMPTY_STATS: StatsResponse = {
  regions: {},
  summary: {
    total_posts: 0,
    average_confidence: 0,
    highest_alert_region: null,
    highest_alert_zone: null,
    severe_share: 0,
  },
  meta: {
    status: "empty",
    cached: false,
    generated_at: null,
    limit: null,
    source_path: null,
    processed_path: null,
    stats_path: null,
    processing_profile: "balanced",
  },
};

function formatFreshness(generatedAt: string | null, nowMs: number) {
  if (!generatedAt) {
    return "Awaiting first processing run";
  }

  const diffSeconds = Math.max(0, Math.round((nowMs - new Date(generatedAt).getTime()) / 1000));
  if (diffSeconds < 60) {
    return "Updated moments ago";
  }
  if (diffSeconds < 3600) {
    const minutes = Math.floor(diffSeconds / 60);
    return `Updated ${minutes} min ago`;
  }
  if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    return `Updated ${hours} hr ago`;
  }
  const days = Math.floor(diffSeconds / 86400);
  return `Updated ${days} day${days === 1 ? "" : "s"} ago`;
}

function formatTimestamp(generatedAt: string | null) {
  if (!generatedAt) {
    return "No processing run yet";
  }
  return DATE_TIME_FORMATTER.format(new Date(generatedAt));
}

function describeSampleLimit(limit: number | null) {
  if (!limit) {
    return "No active dashboard sample";
  }

  const preset = PROCESS_PRESETS.find((item) => item.limit === limit);
  if (preset) {
    return `${limit.toLocaleString()}-post ${preset.label.toLowerCase()} sample`;
  }
  return `${limit.toLocaleString()}-post cached sample`;
}

function SeverityMixTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    payload?: {
      share?: number;
      color?: string;
    };
  }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const entry = payload[0];
  return (
    <div className="min-w-[160px] rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3 text-sm text-slate-50 shadow-[0_22px_60px_rgba(15,23,42,0.5)]">
      <div className="flex items-center gap-2">
        <span
          className="size-2.5 rounded-full"
          style={{ backgroundColor: entry.payload?.color ?? "#F8FAFC" }}
        />
        <span className="font-medium">{entry.name}</span>
      </div>
      <div className="mt-2 text-lg font-semibold">{(entry.value ?? 0).toLocaleString()} posts</div>
      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
        {entry.payload?.share ?? 0}% of region sample
      </div>
    </div>
  );
}

function readCachedStats(): StatsResponse {
  if (typeof window === "undefined") {
    return EMPTY_STATS;
  }

  try {
    const raw = window.localStorage.getItem(DASHBOARD_CACHE_KEY);
    return raw ? (JSON.parse(raw) as StatsResponse) : EMPTY_STATS;
  } catch {
    return EMPTY_STATS;
  }
}

function writeCachedStats(stats: StatsResponse) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage write failures and keep the in-memory state.
  }
}

const initialDashboardStats = readCachedStats();

export function DashboardPage() {
  const [stats, setStats] = useState<StatsResponse>(initialDashboardStats);
  const [selectedRegion, setSelectedRegion] = useState("India");
  const [selectedPresetKey, setSelectedPresetKey] = useState<(typeof PROCESS_PRESETS)[number]["key"]>("demo");
  const [loading, setLoading] = useState(initialDashboardStats.summary.total_posts === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [datasetBusy, setDatasetBusy] = useState(false);
  const [processBusy, setProcessBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clockMs, setClockMs] = useState(() => Date.now());

  async function fetchStats(silent = false) {
    if (!silent && stats.summary.total_posts === 0) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const response = await api.stats();
      startTransition(() => {
        setStats(response);
      });
      writeCachedStats(response);
      setError(null);
    } catch (statsError) {
      const message = statsError instanceof Error ? statsError.message : "Unable to fetch stats.";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchStats(false);
    const interval = window.setInterval(() => {
      fetchStats(true);
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClockMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const selectedPreset = PROCESS_PRESETS.find((preset) => preset.key === selectedPresetKey) ?? PROCESS_PRESETS[1];
  const recommendedDemoPreset =
    PROCESS_PRESETS.find((preset) => preset.limit >= DEMO_MIN_POSTS) ?? PROCESS_PRESETS[1];
  const regions = useMemo(() => Object.keys(stats.regions), [stats.regions]);
  const hasStats = stats.summary.total_posts > 0 && regions.length > 0;
  const selected = stats.regions[selectedRegion] ?? stats.regions[regions[0] ?? ""];
  const zoneTone = severityTone[selected?.zone ?? "Yellow"];
  const pieBreakdown = selected
    ? [
        { name: "Mild", value: selected.mild },
        { name: "Moderate", value: selected.moderate },
        { name: "Severe", value: selected.severe },
      ].map((entry, index) => ({
        ...entry,
        color: SEVERITY_COLORS[index],
        share: selected.total ? Math.round((entry.value / selected.total) * 100) : 0,
      }))
    : [];
  const comparisonData = Object.entries(stats.regions).map(([region, values]) => ({
    region,
    mild: values.mild,
    moderate: values.moderate,
    severe: values.severe,
  }));
  const trendData = Object.entries(stats.regions).map(([region, values]) => ({
    region,
    severeRate: values.severe_share,
    confidence: Number((values.average_confidence * 100).toFixed(1)),
  }));
  const generatedLabel = formatTimestamp(stats.meta.generated_at);
  const freshnessLabel = formatFreshness(stats.meta.generated_at, clockMs);
  const currentClockLabel = DATE_TIME_FORMATTER.format(new Date(clockMs));
  const sampleDescriptor = describeSampleLimit(stats.meta.limit);
  const hasDemoScale = stats.summary.total_posts >= DEMO_MIN_POSTS;
  const sampleShortfall = hasStats && stats.summary.total_posts < DEMO_MIN_POSTS;

  useEffect(() => {
    if (!regions.length) {
      return;
    }

    if (!stats.regions[selectedRegion]) {
      setSelectedRegion(stats.summary.highest_alert_region ?? regions[0]);
    }
  }, [regions, selectedRegion, stats.regions, stats.summary.highest_alert_region]);

  async function handleLoadDataset() {
    setDatasetBusy(true);
    try {
      const response = await api.loadDataset();
      toast.success(
        response.cached
          ? `Dataset already staged with ${response.rows} rows.`
          : `Dataset downloaded and normalized with ${response.rows} rows.`,
      );
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "Dataset load failed.");
    } finally {
      setDatasetBusy(false);
    }
  }

  async function handleProcessData() {
    setProcessBusy(true);
    try {
      const response = await api.processData(selectedPreset.limit);
      toast.success(
        response.cached
          ? `Reused cached ${response.rows_processed}-row ${selectedPreset.label.toLowerCase()} view.`
          : `Processed ${response.rows_processed} rows in ${selectedPreset.label.toLowerCase()} mode.`,
      );
      await fetchStats(true);
    } catch (processError) {
      toast.error(processError instanceof Error ? processError.message : "Processing failed.");
    } finally {
      setProcessBusy(false);
    }
  }

  const kpis = [
    {
      label: "Processed posts",
      value: hasStats ? stats.summary.total_posts.toLocaleString() : "0",
      note: hasStats
        ? hasDemoScale
          ? "Demo-ready dashboard scale"
          : `Below the ${DEMO_MIN_POSTS.toLocaleString()}-post demo target`
        : `Target sample ${DEMO_MIN_POSTS.toLocaleString()}+ posts`,
      icon: Database,
    },
    {
      label: "Highest alert",
      value: stats.summary.highest_alert_region ?? "Awaiting run",
      note: stats.summary.highest_alert_zone ?? "No regional zone yet",
      icon: stats.summary.highest_alert_zone === "Red" ? ShieldAlert : BadgeAlert,
    },
    {
      label: "Severe share",
      value: `${stats.summary.severe_share.toFixed(1)}%`,
      note: "Across the active processed sample",
      icon: Flame,
    },
    {
      label: "Average confidence",
      value: `${(stats.summary.average_confidence * 100).toFixed(1)}%`,
      note: hasStats ? freshnessLabel : "Awaiting first processed snapshot",
      icon: Sparkles,
    },
  ];

  return (
    <PageTransition>
      <div className="container py-12 md:py-16">
        <div className="space-y-10">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl space-y-4">
              <Badge variant="neutral" className="w-fit">
                Monitoring Dashboard
              </Badge>
              <h1 className="section-title">Regional depression-severity monitoring with premium demo clarity.</h1>
              <p className="text-lg leading-8 text-muted-foreground">
                Process a dataset into cached regional summaries, compare severity composition, and spotlight
                the highest-risk zone with cleaner operator-facing context.
              </p>
            </div>

            <div className="w-full max-w-2xl space-y-4 rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <div className="flex flex-wrap gap-2">
                {PROCESS_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setSelectedPresetKey(preset.key)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm transition",
                      preset.key === selectedPresetKey
                        ? "border-primary/30 bg-primary/15 text-white shadow-[0_12px_30px_rgba(244,95,72,0.18)]"
                        : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20 hover:text-foreground",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={handleLoadDataset} disabled={datasetBusy}>
                  {datasetBusy ? <LoaderCircle className="size-4 animate-spin" /> : <Database className="size-4" />}
                  Load dataset
                </Button>
                <Button onClick={handleProcessData} disabled={processBusy}>
                  {processBusy ? <LoaderCircle className="size-4 animate-spin" /> : <Radar className="size-4" />}
                  Build {selectedPreset.limit.toLocaleString()}-post {selectedPreset.label.toLowerCase()} view
                </Button>
                <Button variant="outline" onClick={() => fetchStats(true)} disabled={refreshing || processBusy}>
                  {refreshing ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                  Refresh
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/35 p-4">
                  <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                    Local clock
                  </div>
                  <div className="mt-2 text-base font-semibold leading-snug">{currentClockLabel}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Live browser date and time, updated every second
                  </div>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/35 p-4">
                  <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                    Last processed
                  </div>
                  <div className="mt-2 text-base font-semibold leading-snug">{generatedLabel}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{freshnessLabel}</div>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/35 p-4">
                  <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                    Active sample
                  </div>
                  <div className="mt-2 text-lg font-semibold">
                    {stats.summary.total_posts.toLocaleString()}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{sampleDescriptor}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <div>{selectedPreset.note}</div>
                <div className="font-mono text-[11px] uppercase tracking-[0.28em]">
                  {hasDemoScale ? "Demo-ready scale" : "Promote to demo scale"}
                </div>
              </div>

              {sampleShortfall ? (
                <div className="rounded-[1.4rem] border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  Current snapshot has only {stats.summary.total_posts.toLocaleString()} processed posts.
                  Build the {recommendedDemoPreset.limit.toLocaleString()}-post{" "}
                  {recommendedDemoPreset.label.toLowerCase()} view to reach a safer demo scale.
                </div>
              ) : null}
            </div>
          </div>

          {error ? (
            <div
              className={cn(
                "rounded-[1.75rem] border p-4 text-sm",
                hasStats
                  ? "border-amber-300/20 bg-amber-400/10 text-amber-100"
                  : "border-rose-300/20 bg-rose-400/10 text-rose-100",
              )}
            >
              {hasStats
                ? "Live refresh is temporarily unavailable. Showing the latest cached dashboard snapshot."
                : error}
            </div>
          ) : null}

          {processBusy ? (
            <div className="rounded-[1.75rem] border border-sky-300/20 bg-sky-400/10 p-4 text-sm text-sky-100">
              Building a fresh {selectedPreset.limit.toLocaleString()}-post dashboard snapshot. The last completed
              view stays visible until the new dataset finishes processing.
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-4">
            {kpis.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-muted-foreground">{item.label}</div>
                    <div className="mt-3 text-3xl font-semibold">{item.value}</div>
                  </div>
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/8">
                    <item.icon className="size-5 text-primary" />
                  </div>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">{item.note}</div>
              </motion.div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <Card className="overflow-hidden border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]">
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Region spotlight</CardTitle>
                  <CardDescription>
                    Inspect one region with clearer zone state, severity mix, and sample distribution.
                  </CardDescription>
                </div>
                <div className="w-full md:w-[220px]">
                  <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a region" />
                    </SelectTrigger>
                    <SelectContent>
                      {(regions.length ? regions : ["India", "USA", "UK", "Canada", "Australia"]).map((region) => (
                        <SelectItem key={region} value={region}>
                          {region}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {loading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-24 rounded-[1.75rem]" />
                    <Skeleton className="h-[360px] rounded-[1.75rem]" />
                  </div>
                ) : !selected ? (
                  <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/4 p-6 text-sm leading-7 text-muted-foreground">
                    No dashboard data is ready yet. Load the dataset and process one of the cached dashboard
                    profiles to populate this view.
                  </div>
                ) : (
                  <>
                    <div className={cn(
                      "rounded-[2rem] border border-white/10 bg-gradient-to-br p-6",
                      zoneTone.bg,
                      zoneTone.glow,
                    )}>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/70">
                            Current zone
                          </div>
                          <div className="mt-3 text-5xl font-semibold text-white">{selected.zone}</div>
                        </div>
                        <div className="flex size-16 items-center justify-center rounded-full border border-white/15 bg-white/10">
                          <Activity className="size-6 text-white" />
                        </div>
                      </div>
                      <div className="mt-5 grid gap-4 sm:grid-cols-3">
                        <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/25 p-4">
                          <div className="text-sm text-white/70">Posts in region</div>
                          <div className="mt-2 text-3xl font-semibold text-white">{selected.total}</div>
                        </div>
                        <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/25 p-4">
                          <div className="text-sm text-white/70">Severe share</div>
                          <div className="mt-2 text-3xl font-semibold text-white">
                            {selected.severe_share.toFixed(1)}%
                          </div>
                        </div>
                        <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/25 p-4">
                          <div className="text-sm text-white/70">Avg confidence</div>
                          <div className="mt-2 text-3xl font-semibold text-white">
                            {(selected.average_confidence * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      {[
                        { label: "Mild", value: selected.mild },
                        { label: "Moderate", value: selected.moderate },
                        { label: "Severe", value: selected.severe },
                      ].map((item, index) => (
                        <div key={item.label} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                          <div className="text-sm text-muted-foreground">{item.label}</div>
                          <div className="mt-2 text-3xl font-semibold">{item.value}</div>
                          <div
                            className="mt-4 h-2 rounded-full"
                            style={{ backgroundColor: `${SEVERITY_COLORS[index]}33` }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${selected.total ? (item.value / selected.total) * 100 : 0}%`,
                                backgroundColor: SEVERITY_COLORS[index],
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">Severity mix</div>
                          <div className="text-sm text-muted-foreground">
                            Active dashboard sample: {stats.summary.total_posts.toLocaleString()} processed posts across {regions.length} regions.
                          </div>
                        </div>
                        <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
                          {selectedRegion} focus • {selected.total.toLocaleString()} posts
                        </div>
                      </div>

                      {selected.total ? (
                        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
                          <div className="relative h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={pieBreakdown}
                                  dataKey="value"
                                  nameKey="name"
                                  innerRadius={62}
                                  outerRadius={108}
                                  paddingAngle={4}
                                  stroke="#F8FAFC"
                                  strokeWidth={2}
                                  isAnimationActive
                                  animationDuration={850}
                                >
                                  {pieBreakdown.map((entry, index) => (
                                    <Cell key={entry.name} fill={SEVERITY_COLORS[index]} />
                                  ))}
                                </Pie>
                                <RechartsTooltip content={<SeverityMixTooltip />} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                              <div className="text-4xl font-semibold text-white">{selected.total.toLocaleString()}</div>
                              <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                                {selectedRegion} sample
                              </div>
                              <div className="mt-2 text-sm text-muted-foreground">
                                {stats.summary.total_posts.toLocaleString()} processed total
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {pieBreakdown.map((entry) => (
                              <div
                                key={entry.name}
                                className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <span className="size-3 rounded-full" style={{ backgroundColor: entry.color }} />
                                    <span className="text-sm font-medium text-foreground">{entry.name}</span>
                                  </div>
                                  <span className="text-sm text-muted-foreground">{entry.share}%</span>
                                </div>
                                <div className="mt-3 flex items-end justify-between gap-3">
                                  <div className="text-2xl font-semibold text-white">{entry.value.toLocaleString()}</div>
                                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                                    posts
                                  </div>
                                </div>
                                <div className="mt-3 h-2 rounded-full bg-white/8">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${entry.share}%` }}
                                    className="h-full rounded-full"
                                    style={{ backgroundColor: entry.color }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/4 p-6 text-sm leading-7 text-muted-foreground">
                          No posts are assigned to this region in the current sample yet.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6">
              <Card className="border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]">
                <CardHeader>
                  <CardTitle>Regional comparison</CardTitle>
                  <CardDescription>
                    Compare class counts across each simulated geography with clearer spacing and hover detail.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-[320px] rounded-[1.75rem]" />
                  ) : !hasStats ? (
                    <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/4 p-6 text-sm leading-7 text-muted-foreground">
                      Regional comparison will appear here after the first processing run.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span className="size-3 rounded-full bg-[#F6D365]" />
                          Mild
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="size-3 rounded-full bg-[#FB923C]" />
                          Moderate
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="size-3 rounded-full bg-[#FB7185]" />
                          Severe
                        </div>
                      </div>
                      <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={comparisonData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                            <XAxis dataKey="region" stroke="#94A3B8" tickLine={false} axisLine={false} />
                            <YAxis stroke="#94A3B8" tickLine={false} axisLine={false} />
                            <RechartsTooltip
                              contentStyle={CHART_TOOLTIP_STYLE}
                              labelStyle={{ color: "#CBD5E1" }}
                              itemStyle={{ color: "#F8FAFC" }}
                            />
                            <Bar dataKey="mild" stackId="a" fill={SEVERITY_COLORS[0]} radius={[0, 0, 12, 12]} />
                            <Bar dataKey="moderate" stackId="a" fill={SEVERITY_COLORS[1]} />
                            <Bar dataKey="severe" stackId="a" fill={SEVERITY_COLORS[2]} radius={[12, 12, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]">
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>Refresh pulse</CardTitle>
                    <CardDescription>
                      A compact trend view for severe share and confidence, refreshed every 30 seconds.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm">
                    <motion.span
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ repeat: Infinity, duration: 1.8 }}
                      className="size-2 rounded-full bg-primary"
                    />
                    {refreshing ? "Refreshing" : stats.meta.cached ? "Cache-backed" : "Watching"}
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-[300px] rounded-[1.75rem]" />
                  ) : !hasStats ? (
                    <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/4 p-6 text-sm leading-7 text-muted-foreground">
                      Trend lines start once processed regional summaries are available.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trendData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                            <XAxis dataKey="region" stroke="#94A3B8" tickLine={false} axisLine={false} />
                            <YAxis stroke="#94A3B8" tickLine={false} axisLine={false} />
                            <RechartsTooltip
                              contentStyle={CHART_TOOLTIP_STYLE}
                              labelStyle={{ color: "#CBD5E1" }}
                              itemStyle={{ color: "#F8FAFC" }}
                            />
                            <Line type="monotone" dataKey="severeRate" stroke={SEVERITY_COLORS[2]} strokeWidth={3} />
                            <Line type="monotone" dataKey="confidence" stroke="#7DD3FC" strokeWidth={3} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Waves className="size-4 text-rose-300" />
                          Severe share by region
                        </div>
                        <div className="flex items-center gap-2">
                          <Waves className="size-4 text-sky-300" />
                          Confidence by region
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
