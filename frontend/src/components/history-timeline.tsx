"use client";

import { EmailAnalysisResponse } from "@/lib/api";
import { Clock, History as HistoryIcon } from "lucide-react";

export interface HistoryItem extends EmailAnalysisResponse {
  id: string;
  timestamp: Date;
  snippet: string;
}

export interface HistoryTimelineProps {
  items: HistoryItem[];
  onSelect?: (item: HistoryItem) => void;
}

export function HistoryTimeline({ items, onSelect }: HistoryTimelineProps) {
  if (items.length === 0) {
    return (
      <aside className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center text-sm text-slate-400 backdrop-blur-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-200">
          <HistoryIcon className="h-5 w-5" />
        </div>
        <p className="mt-4 text-base font-semibold text-white">
          Sem análises ainda
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Classifique o primeiro email e acompanhe o histórico inteligente por aqui.
        </p>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col gap-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_35px_90px_-70px_rgba(99,102,241,0.7)] backdrop-blur-xl">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Histórico recente</h3>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
          {items.length} análises
        </span>
      </header>
      <p className="text-xs leading-relaxed text-slate-400">
        Salvo apenas nesta sessão. Clique para revisitar a resposta sugerida.
      </p>

      <div className="space-y-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="group w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-indigo-500/40 hover:bg-indigo-500/10"
            onClick={() => onSelect?.(item)}
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-indigo-300" />
                {item.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-[11px] font-medium text-indigo-200">
                {item.category}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-slate-200">
              {item.snippet}
            </p>
            <p className="mt-2 text-xs text-indigo-200/80">
              Confiança {Math.round(item.confidence * 100)}%
            </p>
          </button>
        ))}
      </div>
    </aside>
  );
}

