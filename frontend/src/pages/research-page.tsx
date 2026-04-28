import { motion } from "framer-motion";
import { Braces, Files, GitMerge, Lightbulb, Search } from "lucide-react";

import { PageTransition } from "@/components/layout/page-transition";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { researchBenchmarks } from "@/lib/presentation";

const architecture = [
  {
    icon: Files,
    title: "Input and preprocessing",
    body: "User text is normalized with the same cleaning logic from the training notebook: lowercase conversion, URL and mention stripping, hashtag removal, ASCII normalization, punctuation removal, and whitespace compression.",
  },
  {
    icon: GitMerge,
    title: "Three-model ensemble",
    body: "ESG, ABV, and XDL each produce class probabilities. The production path keeps the project brief intact with equal averaging: final_prob = (p1 + p2 + p3) / 3.",
  },
  {
    icon: Search,
    title: "LIME explainability",
    body: "A LIME text explainer queries the same ensemble inference function and returns high-impact tokens for the predicted label, making local reasoning inspectable during demos and paper discussions.",
  },
  {
    icon: Braces,
    title: "Dataset processing and monitoring",
    body: "Batch predictions assign severity to dataset rows, map them into deterministic simulated regions, and aggregate mild, moderate, and severe totals into color-coded monitoring zones.",
  },
];

const optimizationNotes = [
  "Keep tokenizer and max length fixed at 128 unless you intentionally regenerate models.",
  "If calibration becomes important, add reliability-based ensemble weights or temperature scaling as an optional post-processing layer.",
  "Use batch inference for dataset processing to reduce latency without touching the trained checkpoints.",
  "Leave custom loader hooks in place so `.pt`, `.pth`, or `.pkl` models can be attached through `models/manifest.json` later.",
];

export function ResearchPage() {
  return (
    <PageTransition>
      <div className="container py-12 md:py-16">
        <div className="space-y-10">
          <div className="max-w-4xl space-y-4">
            <Badge variant="neutral" className="w-fit">
              Research Notes
            </Badge>
            <h1 className="section-title">Architecture, ensemble logic, explainability, and compatibility notes.</h1>
            <p className="text-lg leading-8 text-muted-foreground">
              This page is designed for demos, viva presentations, and interview walkthroughs. It makes the
              system structure understandable without replacing or retraining your supplied models.
            </p>
          </div>

          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>System architecture</CardTitle>
                <CardDescription>
                  The production flow keeps your trained artifacts central and wraps them with safer loading,
                  observability, and explainability layers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {architecture.map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ delay: index * 0.08 }}
                    className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-white/4 p-5 md:grid-cols-[auto_1fr]"
                  >
                    <div className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/8">
                      <item.icon className="size-5 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-lg font-semibold">{item.title}</div>
                      <p className="text-sm leading-7 text-muted-foreground">{item.body}</p>
                    </div>
                  </motion.div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Attached benchmark artifacts</CardTitle>
                <CardDescription>
                  Validation metrics below are extracted from the supplied result archives, not invented placeholders.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {researchBenchmarks.map((benchmark, index) => (
                  <div key={benchmark.alias}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-mono text-xs uppercase tracking-[0.28em] text-primary/85">
                          {benchmark.alias}
                        </div>
                        <div className="mt-2 text-lg font-semibold">{benchmark.name}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{benchmark.family}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-semibold">{benchmark.validationAccuracy.toFixed(2)}%</div>
                        <div className="text-sm text-muted-foreground">{benchmark.checkpoint}</div>
                      </div>
                    </div>
                    <div className="mt-4 text-sm leading-7 text-muted-foreground">
                      Approx. artifact size: {benchmark.archiveSizeMb} MB
                    </div>
                    {index !== researchBenchmarks.length - 1 ? <Separator className="mt-4" /> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
            <Card>
              <CardHeader>
                <CardTitle>Ensemble logic</CardTitle>
                <CardDescription>
                  The current deployment path preserves your requested equal-weight fusion.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-6 font-mono text-sm leading-8 text-emerald-100">
                  final_prob = (p1 + p2 + p3) / 3
                </div>
                <p className="text-sm leading-7 text-muted-foreground">
                  Because the architecture is modular, you can later introduce optional weighted averaging or
                  calibration without touching the existing checkpoints or API contract.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Non-breaking improvement path</CardTitle>
                <CardDescription>
                  These are optional tuning directions only, kept compatible with the provided models.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {optimizationNotes.map((note) => (
                  <div key={note} className="flex gap-3 rounded-[1.4rem] border border-white/10 bg-white/4 p-4">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
                    <p className="text-sm leading-7 text-muted-foreground">{note}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </PageTransition>
  );
}
