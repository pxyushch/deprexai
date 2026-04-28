import {
  startTransition,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  BrainCircuit,
  LoaderCircle,
  ScanText,
  Sparkles,
  TimerReset,
  Waves,
} from "lucide-react";
import { toast } from "sonner";

import { PageTransition } from "@/components/layout/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { severityTone } from "@/lib/presentation";
import { cn } from "@/lib/utils";
import type { ExplanationToken, PredictionResponse } from "@/types/api";

const sampleInputs = [
  {
    label: "Burnout signal",
    text: "I feel emotionally numb lately and I cannot find joy in anything anymore.",
  },
  {
    label: "Overwhelm signal",
    text: "Every day feels heavier and I am struggling to keep myself going.",
  },
  {
    label: "Isolation signal",
    text: "I have support, but I still feel isolated and exhausted most of the time.",
  },
];

function hasMeaningfulPrompt(value: string) {
  return /[a-z]{2,}/i.test(value);
}

function strongestTokenByWord(tokens: ExplanationToken[]) {
  const lookup = new Map<string, ExplanationToken>();
  for (const token of tokens) {
    const key = token.token.toLowerCase();
    const current = lookup.get(key);
    if (!current || token.magnitude > current.magnitude) {
      lookup.set(key, token);
    }
  }
  return lookup;
}

export function AnalyzerPage() {
  const [input, setInput] = useState(sampleInputs[0].text);
  const deferredInput = useDeferredValue(input);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftWordCount = useMemo(() => {
    const words = deferredInput.trim();
    return words ? words.split(/\s+/).length : 0;
  }, [deferredInput]);

  const heatmapLookup = useMemo(
    () => strongestTokenByWord(result?.explanation.tokens ?? []),
    [result],
  );

  const cleanedHeatmapTokens = useMemo(() => {
    if (!result?.meta.cleaned_text) {
      return [];
    }

    return result.meta.cleaned_text.split(/\s+/).filter(Boolean).map((word) => ({
      word,
      token: heatmapLookup.get(word.toLowerCase()) ?? null,
    }));
  }, [heatmapLookup, result]);

  async function handleAnalyze() {
    if (!input.trim()) {
      setResult(null);
      setError("Enter a valid prompt.");
      toast.error("Enter a valid prompt.");
      return;
    }

    if (!hasMeaningfulPrompt(input)) {
      setResult(null);
      setError("Enter a valid prompt.");
      toast.error("Enter a valid prompt.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.predict(input.trim());
      startTransition(() => {
        setResult(response);
      });
      toast.success("Analysis complete.");
    } catch (analysisError) {
      const message =
        analysisError instanceof Error ? analysisError.message : "Prediction failed.";
      setResult(null);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const severity = result?.prediction ?? "Moderate";
  const tone = severityTone[severity];
  const probabilityEntries = result ? Object.entries(result.probabilities) : [];
  const supporting = result?.explanation.supporting.slice(0, 4) ?? [];
  const opposing = result?.explanation.opposing.slice(0, 4) ?? [];
  const calibrationTitle = result?.meta.calibration.strategy?.includes("recovery")
    ? "Recovery-aware adjustment applied"
    : "Context-aware adjustment applied";
  const calibrationSummary = result?.meta.calibration.strategy?.includes("recovery")
    ? "Raw classifier output leaned toward higher severity, but the sentence also contains recovery or improvement wording."
    : "Raw classifier output leaned toward higher severity, but the text also reads as clearly positive or stable without matching distress cues.";

  return (
    <PageTransition>
      <div className="container py-12 md:py-16">
        <div className="mx-auto max-w-6xl space-y-10">
          <div className="max-w-4xl space-y-4">
            <Badge variant="neutral" className="w-fit">
              Analyzer Workspace
            </Badge>
            <h1 className="section-title">
              Production-grade free-form text analysis with interpretable ensemble reasoning.
            </h1>
            <p className="text-lg leading-8 text-muted-foreground">
              DepreXAI keeps notebook-aligned preprocessing, runs real local checkpoints, and surfaces
              model confidence plus token-level rationale in one operator-facing workspace.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <Card className="overflow-hidden border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))]">
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>Inference console</CardTitle>
                    <CardDescription>
                      Paste a tweet, post, diary note, or short passage. The analyzer returns severity,
                      probability spread, and explainable token evidence.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="neutral">Real model ensemble</Badge>
                    <Badge variant="neutral">Notebook-aligned preprocessing</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/45 p-4 md:p-5">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,95,72,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.14),transparent_26%)]" />
                  <Textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Describe the text you want to analyze..."
                    className="relative min-h-[280px] border-white/10 bg-transparent text-base leading-8"
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <div className="grid gap-4 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
                    <div className="min-w-0 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                      <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                        Draft words
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{draftWordCount}</div>
                    </div>
                    <div className="min-w-0 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                      <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                        Ready for
                      </div>
                      <div className="mt-3 break-words text-lg font-semibold leading-snug sm:text-xl">
                        Severity classification
                      </div>
                    </div>
                    <div className="min-w-0 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                      <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                        Returns
                      </div>
                      <div className="mt-3 break-words text-lg font-semibold leading-snug sm:text-xl">
                        Probabilities + rationale
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleAnalyze}
                    disabled={loading}
                    size="lg"
                    className="w-full min-w-[220px] sm:w-fit lg:justify-self-end"
                  >
                    {loading ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Running ensemble
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        Analyze text
                      </>
                    )}
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                    Try sample input
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {sampleInputs.map((sample) => (
                      <button
                        key={sample.label}
                        type="button"
                        onClick={() => setInput(sample.text)}
                        className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-muted-foreground transition hover:-translate-y-0.5 hover:border-white/20 hover:text-foreground"
                      >
                        {sample.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]">
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>Model decision surface</CardTitle>
                    <CardDescription>
                      Premium presentation output for severity, latency, confidence spread, and local evidence.
                    </CardDescription>
                  </div>
                  {result ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                    >
                      <Badge variant={tone.badge}>{result.prediction}</Badge>
                    </motion.div>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {loading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-32 w-full rounded-[1.75rem]" />
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Skeleton className="h-24 rounded-[1.5rem]" />
                      <Skeleton className="h-24 rounded-[1.5rem]" />
                      <Skeleton className="h-24 rounded-[1.5rem]" />
                    </div>
                    <Skeleton className="h-48 rounded-[1.75rem]" />
                  </div>
                ) : result ? (
                  <>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn(
                        "relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br p-6",
                        tone.bg,
                        tone.glow,
                      )}
                    >
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_32%)]" />
                      <div className="relative space-y-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/70">
                              Predicted severity
                            </div>
                            <motion.div
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-3 text-5xl font-semibold text-white"
                            >
                              {result.prediction}
                            </motion.div>
                          </div>
                          <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/80">
                            {result.meta.cached ? "Cache-assisted response" : "Fresh inference"}
                          </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/25 p-4">
                            <div className="text-sm text-white/70">
                              Confidence in {result.prediction}
                            </div>
                            <div className="mt-2 text-3xl font-semibold text-white">
                              {(result.confidence * 100).toFixed(1)}%
                            </div>
                            <div className="mt-2 text-xs text-white/65">
                              This is model confidence for the predicted label, not a severity
                              percentage.
                            </div>
                            <Progress
                              className="mt-4"
                              value={result.confidence * 100}
                              indicatorClassName={tone.progress}
                            />
                          </div>
                          <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/25 p-4">
                            <div className="text-sm text-white/70">Latency</div>
                            <div className="mt-2 flex items-end gap-2">
                              <span className="text-3xl font-semibold text-white">
                                {result.meta.total_ms.toFixed(0)}
                              </span>
                              <span className="pb-1 text-sm text-white/70">ms</span>
                            </div>
                            <div className="mt-4 flex items-center gap-2 text-sm text-white/70">
                              <TimerReset className="size-4" />
                              Inference {result.meta.inference_ms.toFixed(0)} ms
                            </div>
                          </div>
                          <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/25 p-4">
                            <div className="text-sm text-white/70">Models used</div>
                            <div className="mt-2 text-2xl font-semibold text-white">
                              {result.meta.models_used.length}
                            </div>
                            <div className="mt-4 text-sm leading-6 text-white/70">
                              {result.meta.models_used.join(" · ")}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    {result.meta.calibration.applied ? (
                      <div className="rounded-[1.5rem] border border-amber-300/20 bg-amber-500/8 p-4 text-sm text-amber-50">
                        <div className="font-semibold">{calibrationTitle}</div>
                        <div className="mt-2 text-amber-100/80">
                          Raw classifier output leaned {result.meta.calibration.raw_prediction} at{" "}
                          {(result.meta.calibration.raw_confidence * 100).toFixed(1)}%. {calibrationSummary}
                        </div>
                        {result.meta.calibration.reason ? (
                          <div className="mt-2 text-amber-100/70">
                            {result.meta.calibration.reason}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                      <div className="mb-4 flex items-center gap-3">
                        <BrainCircuit className="size-4 text-primary" />
                        <div>
                          <div className="text-sm font-semibold">Probability distribution</div>
                          <div className="text-sm text-muted-foreground">
                            Gradient rails reveal how far apart the class outcomes are.
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {probabilityEntries.map(([key, value], index) => {
                          const label = key.charAt(0).toUpperCase() + key.slice(1);
                          const indicatorClassName =
                            label === "Severe"
                              ? severityTone.Severe.progress
                              : label === "Moderate"
                                ? severityTone.Moderate.progress
                                : severityTone.Mild.progress;
                          return (
                            <motion.div
                              key={key}
                              initial={{ opacity: 0, x: 12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="space-y-2"
                            >
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{label}</span>
                                <span className="font-mono text-xs text-foreground">
                                  {(value * 100).toFixed(1)}%
                                </span>
                              </div>
                              <Progress
                                value={value * 100}
                                indicatorClassName={indicatorClassName}
                                className="h-3.5"
                              />
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-[1.75rem] border border-emerald-400/15 bg-emerald-500/5 p-5">
                        <div className="mb-4 flex items-center gap-3">
                          <Waves className="size-4 text-emerald-300" />
                          <div>
                            <div className="text-sm font-semibold text-emerald-50">
                              Supports the prediction
                            </div>
                            <div className="text-sm text-emerald-100/70">
                              Positive evidence for the predicted label.
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {supporting.map((token) => (
                            <div key={token.token} className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-emerald-50">{token.token}</span>
                                <span className="font-mono text-xs text-emerald-100/80">
                                  +{token.weight.toFixed(3)}
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-white/10">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${token.magnitude * 100}%` }}
                                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[1.75rem] border border-rose-400/15 bg-rose-500/5 p-5">
                        <div className="mb-4 flex items-center gap-3">
                          <ScanText className="size-4 text-rose-300" />
                          <div>
                            <div className="text-sm font-semibold text-rose-50">
                              Pulls away from the prediction
                            </div>
                            <div className="text-sm text-rose-100/70">
                              Negative evidence that counters the current label.
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {opposing.length ? opposing.map((token) => (
                            <div key={token.token} className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-rose-50">{token.token}</span>
                                <span className="font-mono text-xs text-rose-100/80">
                                  {token.weight.toFixed(3)}
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-white/10">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${token.magnitude * 100}%` }}
                                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-300"
                                />
                              </div>
                            </div>
                          )) : (
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-rose-100/70">
                              This sample has very little opposing evidence in the top-ranked rationale.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-5">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Normalized text heatmap</div>
                          <div className="text-sm text-muted-foreground">
                            Tokens are colored by normalized LIME weight after preprocessing.
                          </div>
                        </div>
                        <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
                          cleaned view
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {cleanedHeatmapTokens.map(({ word, token }, index) => {
                          const magnitude = token?.magnitude ?? 0;
                          const positive = token?.direction === "supports";
                          return (
                            <motion.span
                              key={`${word}-${index}`}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.015 }}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-sm transition",
                                token
                                  ? positive
                                    ? "border-emerald-300/20 text-emerald-50"
                                    : "border-sky-300/20 text-sky-50"
                                  : "border-white/8 bg-white/5 text-muted-foreground",
                              )}
                              style={
                                token
                                  ? {
                                      background: positive
                                        ? `rgba(52, 211, 153, ${0.18 + magnitude * 0.42})`
                                        : `rgba(96, 165, 250, ${0.18 + magnitude * 0.42})`,
                                    }
                                  : undefined
                              }
                            >
                              {word}
                            </motion.span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                        <div className="text-sm text-muted-foreground">Input to cleaned ratio</div>
                        <div className="mt-2 text-2xl font-semibold">
                          {result.meta.cleaned_words}/{result.meta.input_words}
                        </div>
                      </div>
                      <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                        <div className="text-sm text-muted-foreground">Explanation pass</div>
                        <div className="mt-2 text-2xl font-semibold">
                          {result.meta.explanation_ms.toFixed(0)} ms
                        </div>
                      </div>
                      <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                        <div className="text-sm text-muted-foreground">Max contribution</div>
                        <div className="mt-2 text-2xl font-semibold">
                          {result.explanation.max_abs_weight.toFixed(3)}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/4 p-8 text-sm leading-7 text-muted-foreground">
                    Run the analyzer to surface a severity decision, class spread, explanation polarity, and
                    a cleaned-text heatmap suitable for a polished demo walkthrough.
                  </div>
                )}

                {error ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    {error}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
