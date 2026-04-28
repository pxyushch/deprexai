export const severityTone = {
  Mild: {
    badge: "mild" as const,
    text: "text-yellow-100",
    glow: "shadow-[0_0_40px_rgba(245,205,79,0.3)]",
    bg: "from-yellow-400/20 to-yellow-200/5",
    progress: "bg-gradient-to-r from-yellow-400 to-amber-300",
  },
  Moderate: {
    badge: "moderate" as const,
    text: "text-orange-100",
    glow: "shadow-[0_0_40px_rgba(249,115,22,0.35)]",
    bg: "from-orange-400/20 to-orange-100/5",
    progress: "bg-gradient-to-r from-orange-500 to-amber-400",
  },
  Severe: {
    badge: "severe" as const,
    text: "text-rose-100",
    glow: "shadow-[0_0_40px_rgba(244,63,94,0.35)]",
    bg: "from-rose-500/20 to-rose-100/5",
    progress: "bg-gradient-to-r from-rose-500 to-red-400",
  },
  Green: {
    badge: "safe" as const,
    text: "text-emerald-100",
    glow: "shadow-[0_0_40px_rgba(34,197,94,0.3)]",
    bg: "from-emerald-500/20 to-emerald-100/5",
    progress: "bg-gradient-to-r from-emerald-500 to-green-400",
  },
  Yellow: {
    badge: "mild" as const,
    text: "text-yellow-100",
    glow: "shadow-[0_0_40px_rgba(245,205,79,0.3)]",
    bg: "from-yellow-400/20 to-yellow-100/5",
    progress: "bg-gradient-to-r from-yellow-400 to-amber-300",
  },
  Orange: {
    badge: "moderate" as const,
    text: "text-orange-100",
    glow: "shadow-[0_0_40px_rgba(249,115,22,0.35)]",
    bg: "from-orange-400/20 to-orange-100/5",
    progress: "bg-gradient-to-r from-orange-500 to-amber-400",
  },
  Red: {
    badge: "severe" as const,
    text: "text-rose-100",
    glow: "shadow-[0_0_40px_rgba(244,63,94,0.35)]",
    bg: "from-rose-500/20 to-rose-100/5",
    progress: "bg-gradient-to-r from-rose-500 to-red-400",
  },
};

export const researchBenchmarks = [
  {
    alias: "ESG",
    name: "Electra Small Generator",
    family: "google/electra-small-generator",
    validationAccuracy: 98.35,
    checkpoint: "checkpoint-7500",
    archiveSizeMb: 50.5,
  },
  {
    alias: "XDL",
    name: "XtremeDistil",
    family: "microsoft/xtremedistil-l6-h384-uncased",
    validationAccuracy: 97.11,
    checkpoint: "checkpoint-7500",
    archiveSizeMb: 43.8,
  },
  {
    alias: "ABV",
    name: "ALBERT Base V2",
    family: "albert-base-v2",
    validationAccuracy: 85.47,
    checkpoint: "checkpoint-7500",
    archiveSizeMb: 43.8,
  },
];
