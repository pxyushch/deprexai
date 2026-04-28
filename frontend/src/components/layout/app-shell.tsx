import { motion } from "framer-motion";
import { BrainCircuit, MoonStar, ShieldAlert, SunMedium } from "lucide-react";
import type { PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

const navigation = [
  { to: "/", label: "Overview" },
  { to: "/analyzer", label: "Analyzer" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/research", label: "Research" },
];

export function AppShell({ children }: PropsWithChildren) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 grid-glow opacity-40" />
        <div className="absolute left-[8%] top-24 size-56 rounded-full bg-primary/18 blur-[120px]" />
        <div className="absolute right-[6%] top-[18rem] size-72 rounded-full bg-accent/14 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 size-80 rounded-full bg-severity-moderate/10 blur-[150px]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/8 bg-slate-950/55 backdrop-blur-2xl">
        <div className="container flex min-h-20 items-center justify-between gap-4">
          <NavLink to="/" className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-white/12 bg-white/8 shadow-soft">
              <BrainCircuit className="size-5 text-primary" />
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.34em] text-primary/90">
                DepreXAI
              </div>
              <div className="text-sm text-muted-foreground">
                Explainable mental health research console
              </div>
            </div>
          </NavLink>

          <nav className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 md:flex">
            {navigation.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/"}>
                {({ isActive }) => (
                  <span
                    className={cn(
                      "inline-flex rounded-full px-4 py-2 text-sm transition",
                      isActive
                        ? "bg-white/10 text-foreground shadow-inner"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="secondary" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "dark" ? <SunMedium className="size-4" /> : <MoonStar className="size-4" />}
            </Button>
            <Button asChild className="hidden md:inline-flex">
              <NavLink to="/analyzer">Analyze Text</NavLink>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10">{children}</main>

      <footer className="relative z-10 border-t border-white/8 py-8">
        <div className="container flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-primary" />
            This tool is for research purposes only and not a medical diagnosis system.
          </div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-mono text-xs uppercase tracking-[0.28em]"
          >
            Experimental ensemble inference • LIME explainability • regional analytics
          </motion.div>
        </div>
      </footer>
    </div>
  );
}
