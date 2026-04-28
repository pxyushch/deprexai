import { AnimatePresence } from "framer-motion";
import { lazy, Suspense } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

const LandingPage = lazy(async () => ({
  default: (await import("@/pages/landing-page")).LandingPage,
}));
const AnalyzerPage = lazy(async () => ({
  default: (await import("@/pages/analyzer-page")).AnalyzerPage,
}));
const DashboardPage = lazy(async () => ({
  default: (await import("@/pages/dashboard-page")).DashboardPage,
}));
const ResearchPage = lazy(async () => ({
  default: (await import("@/pages/research-page")).ResearchPage,
}));

const routeFallback = (
  <div className="container py-14 md:py-16">
    <div className="mx-auto max-w-6xl space-y-6">
      <Skeleton className="h-8 w-40 rounded-full" />
      <Skeleton className="h-14 w-3/4 rounded-[1.75rem]" />
      <Skeleton className="h-6 w-1/2 rounded-full" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[360px] rounded-[2rem]" />
        <Skeleton className="h-[360px] rounded-[2rem]" />
      </div>
    </div>
  </div>
);

export default function App() {
  const location = useLocation();

  return (
    <>
      <AppShell>
        <AnimatePresence mode="wait">
          <Suspense fallback={routeFallback}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/analyzer" element={<AnalyzerPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/research" element={<ResearchPage />} />
            </Routes>
          </Suspense>
        </AnimatePresence>
      </AppShell>
      <Toaster
        closeButton
        richColors
        position="top-right"
        toastOptions={{
          classNames: {
            toast:
              "border border-white/10 bg-slate-950/90 text-white shadow-[0_18px_45px_rgba(0,0,0,0.35)]",
          },
        }}
      />
    </>
  );
}
