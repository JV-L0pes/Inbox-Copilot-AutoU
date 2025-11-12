"use client";

export const dynamic = "force-static";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cpu, Flame, LayoutDashboard, Moon, Sun, Zap } from "lucide-react";

import { HistoryItem, HistoryTimeline } from "@/components/history-timeline";
import { ResultCard } from "@/components/result-card";
import { UploadZone, UploadZoneHandle } from "@/components/upload-zone";
import { EmailAnalysisResponse, analyzeEmail } from "@/lib/api";

export default function Home() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [emailText, setEmailText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(
    process.env.NEXT_PUBLIC_SHOW_COLD_START_HINT === "true"
      ? "Se esta for a primeira requisição após algum tempo, a API pode demorar alguns segundos para acordar. Se aparecer um erro 502, aguarde e tente novamente."
      : null,
  );
  const [result, setResult] = useState<EmailAnalysisResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [lastSample, setLastSample] = useState<string | null>(null);
  const uploadZoneRef = useRef<UploadZoneHandle | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("autou-theme");
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      document.documentElement.dataset.theme = stored;
    } else {
      document.documentElement.dataset.theme = "dark";
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("autou-theme", theme);
  }, [theme]);

  const canAnalyze = useMemo(
    () => Boolean(emailText.trim()) || selectedFile !== null,
    [emailText, selectedFile],
  );

  const toggleTheme = useCallback(() => {
    setTheme((previous) => (previous === "dark" ? "light" : "dark"));
  }, []);

  const analyze = useCallback(async () => {
    if (!canAnalyze || isLoading) {
      if (!canAnalyze) {
        setError("Informe um texto ou selecione um arquivo para continuar.");
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload = await analyzeEmail({
        text: emailText.trim() || undefined,
        file: selectedFile ?? undefined,
      });

      if (payload.normalized_text) {
        setEmailText(payload.normalized_text);
      }

      const sourceText = payload.normalized_text ?? emailText;
      const snippet = sourceText
        ? sourceText.slice(0, 160)
        : selectedFile?.name ?? "";

      const entry: HistoryItem = {
        id: `${Date.now()}`,
        timestamp: new Date(),
        snippet,
        ...payload,
      };

      setResult(payload);
      setHistory((prev) => [entry, ...prev].slice(0, 6));
    } catch (apiError) {
      const message =
        apiError instanceof Error ? apiError.message : "Erro desconhecido";
      setError(message);
      if (message.includes("502")) {
        setInfoMessage(
          "A API estava hibernada e está iniciando agora. Aguarde alguns segundos e envie novamente.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [canAnalyze, emailText, isLoading, selectedFile]);

  const handleCopy = useCallback(() => {
    if (!result) return;
    navigator.clipboard
      .writeText(result.suggested_response)
      .catch(() => setError("Não foi possível copiar a resposta automática."));
  }, [result]);

  const onHistorySelect = useCallback((item: HistoryItem) => {
    setResult(item);
  }, []);

  return (
    <div className="min-h-screen scroll-smooth text-slate-50 transition-colors duration-500">
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-12 px-6 pb-20 pt-12 lg:px-12">
        <Navigation theme={theme} onToggleTheme={toggleTheme} />

        <header
          id="overview"
          className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]"
        >
          <Hero
            lastSample={lastSample}
            totalAnalyses={history.length}
            onAnalyze={analyze}
            canAnalyze={canAnalyze}
            isLoading={isLoading}
          />
          <HeroMetrics history={history} />
        </header>

        <main className="space-y-10">
          <section id="automation" className="space-y-6">
            <UploadZone
              ref={uploadZoneRef}
              text={emailText}
              selectedFile={selectedFile}
              onTextChange={setEmailText}
              onFileSelect={setSelectedFile}
              onSamplePick={setLastSample}
              onAnalyze={analyze}
              canAnalyze={canAnalyze}
              isLoading={isLoading}
            />

            <ActionToolbar
              canAnalyze={canAnalyze}
              isLoading={isLoading}
              clear={() => {
                setEmailText("");
                setSelectedFile(null);
                setError(null);
              }}
              openFileDialog={() => uploadZoneRef.current?.openFileDialog()}
            />

            {error ? (
              <div className="rounded-3xl border border-rose-400/60 bg-rose-500/10 p-5 text-sm text-rose-100 shadow-[0_30px_90px_-50px_rgba(225,29,72,0.5)]">
                {error}
              </div>
            ) : null}

          {infoMessage ? (
            <div className="rounded-3xl border border-white/10 bg-white/3 p-5 text-xs text-slate-300/90 shadow-[0_25px_70px_-55px_rgba(249,115,22,0.3)]">
              {infoMessage}
            </div>
          ) : null}

            <div id="results">
              {result ? (
                <ResultCard result={result} onCopyResponse={handleCopy} />
              ) : (
                <ResultPlaceholder />
              )}
            </div>
          </section>

          <section id="history">
            <HistoryTimeline items={history} onSelect={onHistorySelect} />
          </section>
        </main>
      </div>
    </div>
  );
}

interface NavigationProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

function Navigation({ theme, onToggleTheme }: NavigationProps) {
  const links = [
    { label: "Visão geral", href: "#overview" },
    { label: "Automação", href: "#automation" },
    { label: "Monitoramento", href: "#history" },
    { label: "Beta público", href: "#cta" },
  ];
  const isLight = theme === "light";
  const toggleLabel = isLight ? "Ativar modo escuro" : "Ativar modo claro";
  return (
    <nav className="flex items-center justify-between rounded-full border border-white/10 bg-white/[0.02] px-6 py-4 shadow-[0_25px_60px_-50px_rgba(249,115,22,0.25)] backdrop-blur-xl">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-orange-200/70">
          Inbox Copilot
        </p>
        <p className="text-sm font-semibold text-white">
          Financial productivity
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-3 text-xs font-medium text-slate-300 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-1.5 text-white/70 transition hover:bg-orange-500/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-300/60"
            >
              {link.label}
            </a>
          ))}
        </div>
        <button
          type="button"
          onClick={onToggleTheme}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] transition focus:outline-none focus:ring-2 focus:ring-orange-300/60 ${
            isLight
              ? "border-orange-400/50 bg-orange-500/10 text-orange-700 hover:bg-orange-500/15"
              : "border-orange-500/30 bg-orange-500/10 text-orange-200/80 hover:bg-orange-500/15"
          }`}
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          {isLight ? "Escuro" : "Claro"}
        </button>
      </div>
    </nav>
  );
}

interface HeroProps {
  lastSample: string | null;
  totalAnalyses: number;
  onAnalyze: () => void;
  canAnalyze: boolean;
  isLoading: boolean;
}

function Hero({
  lastSample,
  totalAnalyses,
  onAnalyze,
  canAnalyze,
  isLoading,
}: HeroProps) {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] p-8 shadow-[0_50px_140px_-60px_rgba(249,115,22,0.35)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.16),_transparent_70%)]" />
      <div className="relative space-y-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-orange-100/80">
          <Zap className="h-3.5 w-3.5" />
          resposta em segundos
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Transforme a caixa de entrada em pipeline acionável
        </h1>
        <p className="max-w-2xl text-base text-slate-200">
          Analise emails complexos, identifique intenção e gere respostas
          obedecendo padrões financeiros com zero esforço manual. Libere sua
          equipe para o que realmente importa.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200/80">
          <Chip icon={<Cpu className="h-3.5 w-3.5" />} text="OpenAI gpt-5-mini com otimização de custo" />
          <Chip icon={<LayoutDashboard className="h-3.5 w-3.5" />} text={`Último exemplo: ${lastSample ?? "nenhum"}`} />
        </div>
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold leading-none text-white shadow-lg transition hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300/60"
            onClick={onAnalyze}
            disabled={!canAnalyze || isLoading}
          >
            {isLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Analisando...
              </>
            ) : (
              <>
                <Flame className="h-4 w-4" />
                Rodar análise agora
              </>
            )}
          </button>
          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
            {canAnalyze
              ? "Pronto para processar"
              : "Cole um email ou arraste um arquivo"}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <HeroMetric label="Análises hoje" value={totalAnalyses} />
          <HeroMetric label="Precisão média" value="92%" />
          <HeroMetric label="SLA configurado" value="5 min" />
        </div>
      </div>
    </div>
  );
}

interface ChipProps {
  icon: React.ReactNode;
  text: string;
}

function Chip({ icon, text }: ChipProps) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-xs text-orange-100">
      {icon}
      {text}
    </span>
  );
}

interface HeroMetricProps {
  label: string;
  value: string | number;
}

function HeroMetric({ label, value }: HeroMetricProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

interface HeroMetricsProps {
  history: HistoryItem[];
}

function HeroMetrics({ history }: HeroMetricsProps) {
  const productive = history.filter((item) => item.category === "Produtivo").length;
  const unproductive = history.filter((item) => item.category === "Improdutivo").length;

  return (
    <div
      className="flex h-full flex-col justify-between gap-6 rounded-[32px] border p-8 text-sm text-slate-200 shadow-[0_40px_120px_-80px_rgba(249,115,22,0.3)] backdrop-blur-2xl"
      style={{
        background: "var(--panel-hero-gradient)",
        borderColor: "var(--panel-hero-border)",
      }}
    >
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Painel instantâneo</h2>
        <p className="text-sm text-slate-300/80">
          Entenda o mix de emails analisados nesta sessão. Os dados são locais e
          desaparecem ao fechar o navegador.
        </p>
      </div>

      <div className="grid gap-4 text-white">
        <HeroMetric label="Emails analisados" value={history.length} />
        <HeroMetric label="Produtivos" value={productive} />
        <HeroMetric label="Improdutivos" value={unproductive} />
      </div>
    </div>
  );
}

interface ActionToolbarProps {
  canAnalyze: boolean;
  isLoading: boolean;
  clear: () => void;
  openFileDialog: () => void;
}

function ActionToolbar({
  canAnalyze,
  isLoading,
  clear,
  openFileDialog,
}: ActionToolbarProps) {
  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_35px_120px_-70px_rgba(249,115,22,0.25)] backdrop-blur-xl md:flex-row md:items-center md:justify-between">
      <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
        <span>
          {isLoading
            ? "Processando análise"
            : canAnalyze
              ? "Conteúdo pronto para revisão"
              : "Cole um email ou selecione um arquivo"}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 px-4 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
          onClick={clear}
          disabled={isLoading}
        >
          Limpar entrada
        </button>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-full bg-orange-500 px-4 text-sm font-semibold leading-none text-white shadow-lg transition hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300/60"
          onClick={openFileDialog}
          disabled={isLoading}
        >
          Procurar arquivo
        </button>
      </div>
    </div>
  );
}

function ResultPlaceholder() {
  return (
    <section className="flex min-h-[260px] flex-col items-center justify-center rounded-[32px] border border-dashed border-white/15 bg-white/3 p-10 text-center text-sm text-slate-400 backdrop-blur-xl">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-200 shadow-lg">
        <Zap className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-white">
        Resultado aparecerá aqui
      </h3>
      <p className="mt-2 max-w-md text-sm text-slate-300/80">
        Cole um email ou envie um arquivo para descobrir automaticamente se a
        mensagem é produtiva e gere uma resposta pronta para enviar.
      </p>
    </section>
  );
}
