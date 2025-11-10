"use client";

import { EmailAnalysisResponse, EmailCategory } from "@/lib/api";
import { ArrowUpRight, Copy, Lightbulb, Send, Target } from "lucide-react";

const categoryStyle: Record<
  EmailCategory,
  {
    gradient: string;
    chip: string;
    tone: string;
    descriptor: string;
    icon: React.ReactNode;
  }
> = {
  Produtivo: {
    gradient:
      "from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-400/40",
    chip:
      "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/40 shadow-[0_18px_45px_-28px_rgba(16,185,129,0.8)]",
    tone: "Foco em resolução rápida. Priorize follow-up com prazo claro.",
    descriptor: "Requer ação imediata ou resposta direcionada.",
    icon: <Send className="h-4 w-4" />,
  },
  Improdutivo: {
    gradient:
      "from-amber-400/20 via-amber-400/5 to-transparent border-amber-300/40",
    chip:
      "bg-amber-400/10 text-amber-200 ring-1 ring-amber-300/40 shadow-[0_18px_45px_-28px_rgba(251,191,36,0.9)]",
    tone: "Gentileza funciona. Agradeça e mantenha proximidade.",
    descriptor: "Não exige ação imediata. Apenas monitore relacionamento.",
    icon: <Lightbulb className="h-4 w-4" />,
  },
};

export interface ResultCardProps {
  result: EmailAnalysisResponse;
  onCopyResponse?: () => void;
}

export function ResultCard({ result, onCopyResponse }: ResultCardProps) {
  const style = categoryStyle[result.category];

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] p-8 shadow-[0_40px_120px_-50px_rgba(30,64,175,0.8)] backdrop-blur-2xl">
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-br ${style.gradient} blur-3xl`}
      />

      <header className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] ${style.chip}`}
          >
            {style.icon}
            {result.category}
          </span>
          <h3 className="text-2xl font-semibold text-slate-100">
            Classificação pronta para acionamento
          </h3>
          <p className="text-sm text-slate-300/80">{style.descriptor}</p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right text-xs text-slate-400">
          <span className="uppercase tracking-[0.3em]">Confiança</span>
          <span className="text-3xl font-semibold text-white">
            {(result.confidence * 100).toFixed(0)}%
          </span>
          <span className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
            Ajuste fino recomendado
          </span>
        </div>
      </header>

      <div className="relative mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <article className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-inner">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200/80">
                Resposta sugerida
              </span>
              <p className="mt-2 text-xs uppercase tracking-[0.3em] text-slate-500">
                Recomendada para envio imediato
              </p>
            </div>
            {onCopyResponse && (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200 transition hover:bg-indigo-500/20"
                onClick={onCopyResponse}
              >
                <Copy className="h-3.5 w-3.5" />
                copiar
              </button>
            )}
          </div>
          <p className="mt-5 whitespace-pre-line text-base leading-relaxed text-slate-100">
            {result.suggested_response}
          </p>
        </article>

        <aside className="flex flex-col justify-between gap-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-200">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
              <span>Destaques</span>
              <ArrowUpRight className="h-4 w-4 text-indigo-300" />
            </div>
            <ul className="mt-3 space-y-2">
              {result.highlights?.length ? (
                result.highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="rounded-2xl border border-slate-800/60 bg-slate-900/80 px-4 py-2 text-xs text-slate-300"
                  >
                    {highlight}
                  </li>
                ))
              ) : (
                <li className="text-xs text-slate-500">
                  Nenhum trecho destacado, IA usou o contexto completo.
                </li>
              )}
            </ul>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <MetricCard
              label="Tokens prompt"
              value={result.usage?.promptTokens}
              tone="text-slate-400"
            />
            <MetricCard
              label="Tokens resposta"
              value={result.usage?.completionTokens}
              tone="text-slate-400"
            />
            <MetricCard
              label="Tokens totais"
              value={result.usage?.totalTokens}
              tone="text-slate-200"
              highlight
            />
            <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-xs text-indigo-100">
              <p className="font-semibold uppercase tracking-[0.3em]">
                Diretriz de ação
              </p>
              <p className="mt-2 leading-relaxed text-indigo-100/80">{style.tone}</p>
            </div>
          </div>

          {result.raw_labels?.length ? (
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 text-[11px] uppercase tracking-[0.3em] text-slate-400">
              <span className="text-xs font-semibold text-slate-300">
                Labels auxiliares{" "}
              </span>
              {result.raw_labels.join(" · ")}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

interface MetricCardProps {
  label: string;
  value?: number | null;
  tone: string;
  highlight?: boolean;
}

function MetricCard({ label, value, tone, highlight = false }: MetricCardProps) {
  if (value === undefined || value === null) return null;
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-xs uppercase tracking-[0.3em] ${tone} ${
        highlight ? "shadow-[0_20px_60px_-45px_rgba(129,140,248,0.9)]" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <Target className="h-3.5 w-3.5 text-indigo-300" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

