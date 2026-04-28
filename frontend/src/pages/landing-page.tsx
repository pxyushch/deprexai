import { motion } from "framer-motion";
import { ArrowRight, Brain, Globe2, Microscope, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";

import { PageTransition } from "@/components/layout/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { researchBenchmarks } from "@/lib/presentation";

const features = [
  {
    icon: Brain,
    title: "Explainable severity analysis",
    description: "Predict Mild, Moderate, or Severe states with class probabilities and local LIME evidence.",
  },
  {
    icon: Globe2,
    title: "Regional monitoring dashboard",
    description: "Process a depression-related dataset, simulate geographic regions, and surface zone-based monitoring signals.",
  },
  {
    icon: Microscope,
    title: "Research-grade transparency",
    description: "Show the ensemble logic, checkpoint lineage, benchmark data, and non-breaking optimization paths clearly.",
  },
];

export function LandingPage() {
  return (
    <PageTransition>
      <section className="relative overflow-hidden">
        <div className="container grid min-h-[calc(100svh-5rem)] items-center gap-16 py-16 md:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-5"
            >
              <Badge className="w-fit" variant="neutral">
                Research Platform
              </Badge>
              <div className="space-y-4">
                <div className="font-mono text-xs uppercase tracking-[0.36em] text-primary/85">
                  DepreXAI
                </div>
                <h1 className="max-w-3xl text-5xl font-semibold leading-[0.92] tracking-tight md:text-7xl">
                  Explainable AI for
                  <span className="block bg-gradient-to-r from-white via-orange-100 to-rose-200 bg-clip-text text-transparent">
                    Depression Severity Detection and Monitoring
                  </span>
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
                  A premium research console for ensemble text classification, interpretable evidence,
                  and region-wise surveillance storytelling across depression-related social data.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.08 }}
              className="flex flex-wrap gap-4"
            >
              <Button asChild size="lg">
                <NavLink to="/analyzer">
                  Analyze Text
                  <ArrowRight className="size-4" />
                </NavLink>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <NavLink to="/dashboard">Open Dashboard</NavLink>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.14 }}
              className="grid gap-4 sm:grid-cols-3"
            >
              {features.map((feature) => (
                <div key={feature.title} className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                  <feature.icon className="mb-4 size-5 text-primary" />
                  <div className="mb-2 text-sm font-semibold">{feature.title}</div>
                  <div className="text-sm leading-6 text-muted-foreground">{feature.description}</div>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.16 }}
            className="relative"
          >
            <div className="glass-panel relative overflow-hidden p-6 md:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(244,95,72,0.18),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(71,149,255,0.18),transparent_24%)]" />
              <div className="relative space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-xs uppercase tracking-[0.28em] text-primary/85">
                      Live Signal
                    </div>
                    <div className="mt-2 text-2xl font-semibold">Severity monitoring surface</div>
                  </div>
                  <div className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-muted-foreground">
                    Demo-ready
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_0.92fr]">
                  <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/45 p-5 shadow-soft">
                    <div className="mb-6 flex items-center justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">Inference pulse</div>
                        <div className="mt-1 text-3xl font-semibold">Ensemble 3x</div>
                      </div>
                      <Sparkles className="size-5 text-primary" />
                    </div>
                    <div className="space-y-4">
                      {[
                        ["ESG / Electra", "98.35% validation"],
                        ["XDL / XtremeDistil", "97.11% validation"],
                        ["ABV / ALBERT", "85.47% validation"],
                      ].map(([name, value], index) => (
                        <motion.div
                          key={name}
                          initial={{ opacity: 0, x: 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.24 + index * 0.08 }}
                          className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3"
                        >
                          <span className="text-sm">{name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{value}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[1.75rem] border border-rose-300/15 bg-gradient-to-br from-rose-500/20 via-rose-400/10 to-transparent p-5 shadow-soft">
                      <div className="text-sm text-rose-100/80">Signal confidence</div>
                      <div className="mt-3 text-5xl font-semibold text-white">0.87</div>
                      <div className="mt-4 text-sm leading-6 text-rose-100/80">
                        Heat-mapped LIME words illuminate the strongest evidence behind each prediction.
                      </div>
                    </div>
                    <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/40 p-5 shadow-soft">
                      <div className="mb-4 text-sm text-muted-foreground">Monitoring spectrum</div>
                      <div className="flex items-end gap-3">
                        {[32, 54, 80, 46, 68].map((value, index) => (
                          <motion.div
                            key={value}
                            initial={{ height: 20 }}
                            animate={{ height: value }}
                            transition={{ repeat: Infinity, repeatType: "mirror", duration: 2.2, delay: index * 0.18 }}
                            className="w-full rounded-t-2xl bg-gradient-to-t from-primary to-rose-200/80"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="container pb-24">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle>Operational story</CardTitle>
              <CardDescription>
                A single flow from raw text to severity label, confidence, explanation, and regional analytics.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-4">
              {[
                "Input text enters the analyzer with preprocessing aligned to the training notebook.",
                "Three independent models score the same sample and return class probabilities.",
                "LIME exposes influential tokens behind the final ensemble outcome.",
                "Batch processing projects aggregate severity into region-level monitoring zones.",
              ].map((step, index) => (
                <div key={step} className="space-y-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-sm font-semibold">
                    0{index + 1}
                  </div>
                  <p className="text-sm leading-7 text-muted-foreground">{step}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Artifact snapshot</CardTitle>
              <CardDescription>
                Benchmarks below are derived from the supplied training artifacts and result archives.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {researchBenchmarks.map((benchmark, index) => (
                <div key={benchmark.alias}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">{benchmark.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{benchmark.family}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">{benchmark.validationAccuracy.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{benchmark.checkpoint}</div>
                    </div>
                  </div>
                  {index !== researchBenchmarks.length - 1 ? <Separator className="mt-4" /> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </PageTransition>
  );
}
