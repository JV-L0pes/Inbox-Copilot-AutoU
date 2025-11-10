"use client";

import { ChangeEvent, DragEvent, useCallback, useMemo, useRef, useState } from "react";
import { FileText, Loader2, Sparkles, Upload, Wand2 } from "lucide-react";

const samples: Record<string, { text: string; hint: string }> = {
  "Solicitação urgente": {
    text: "Olá time,\n\nPoderiam verificar o chamado #98452? O cliente está sem acesso ao portal desde ontem e precisamos priorizar.\n\nObrigada,\nBianca",
    hint: "Escalonamento de ticket em ambiente crítico",
  },
  Networking: {
    text: "Oi pessoal,\n\nPassando só para agradecer o suporte recente e desejar uma ótima semana a todos!\n\nAbraços,\nHenrique",
    hint: "Mensagem cordial sem ação imediata",
  },
  "Documentação anexada": {
    text: "Prezados,\n\nSegue anexo o relatório financeiro consolidado do trimestre. Podem confirmar o recebimento?\n\nAtt.,\nLuiz",
    hint: "Compartilhamento de arquivo com pedido de confirmação",
  },
};

export interface UploadZoneProps {
  text: string;
  selectedFile: File | null;
  onTextChange: (value: string) => void;
  onFileSelect: (file: File | null) => void;
  onSamplePick?: (value: string) => void;
  isLoading?: boolean;
}

export function UploadZone({
  text,
  selectedFile,
  onTextChange,
  onFileSelect,
  onSamplePick,
  isLoading = false,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const file = fileList[0];
      onFileSelect(file);
    },
    [onFileSelect],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      handleFile(event.target.files);
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      handleFile(event.dataTransfer.files);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const characters = text.length;
  const capacityLabel = characters > 1500 ? "ideal revisar" : "ótimo para IA";

  const currentStatus = useMemo(() => {
    if (isLoading) {
      return {
        label: "Processando",
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
      };
    }
    if (selectedFile) {
      return {
        label: "Arquivo anexado",
        icon: <FileText className="h-3 w-3" />,
      };
    }
    if (text.trim().length > 0) {
      return {
        label: "Texto pronto",
        icon: <Sparkles className="h-3 w-3" />,
      };
    }
    return {
      label: "Aguardando conteúdo",
      icon: <Wand2 className="h-3 w-3" />,
    };
  }, [isLoading, selectedFile, text]);

  return (
    <section className="space-y-6 text-slate-200">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-indigo-200/80">Conteúdo do email</p>
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-[2.5rem] sm:leading-tight">
            Capture o contexto em segundos
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-300/85">
            Aceitamos texto livre, PDFs e arquivos `.txt`. A IA analisa intenção, urgência e tom, sugerindo uma resposta pronta para enviar.
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-slate-200 shadow-[0_25px_60px_-45px_rgba(99,102,241,0.5)] sm:flex-row sm:items-center sm:gap-4">
          <span className="inline-flex items-center gap-2 text-indigo-200">
            {currentStatus.icon}
            {currentStatus.label}
          </span>
          <span className="hidden h-5 w-px bg-white/10 sm:block" />
          <span className="text-slate-400">
            {characters} caracteres — {capacityLabel}
          </span>
        </div>
      </header>

      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2.6fr)_minmax(0,1fr)] xl:items-start">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/85 shadow-[0_40px_90px_-45px_rgba(15,23,42,0.8)] transition hover:border-indigo-500/30">
            <div className="flex flex-col gap-4 p-6 pt-10 xl:px-10">
            <textarea
              className="min-h-[360px] w-full resize-y rounded-3xl border border-slate-800/70 bg-slate-900/70 px-7 py-6 text-base leading-relaxed text-slate-100 outline-none ring-1 ring-transparent transition placeholder:text-slate-600 focus:border-indigo-400/40 focus:ring-indigo-400/35"
              placeholder="Cole aqui o conteúdo do email..."
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
              disabled={isLoading}
            />

            <div
              className={`flex flex-col gap-3 rounded-2xl border border-dashed border-slate-800/70 bg-slate-900/75 p-5 transition ${
                isDragging ? "border-indigo-400 bg-indigo-500/10" : ""
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-800/60 bg-slate-950/80">
                    <Upload className="h-5 w-5 text-indigo-300" />
                  </span>
                  <div>
                    <p className="font-medium text-slate-100">
                      Arraste seu arquivo aqui
                    </p>
                    <p className="text-xs text-slate-500">
                      PDF ou TXT · até 5 MB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-full bg-indigo-500/90 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 focus:ring-offset-slate-900"
                  onClick={() => inputRef.current?.click()}
                  disabled={isLoading}
                >
                  Procurar arquivo
                </button>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept=".txt,.pdf"
                className="hidden"
                onChange={handleChange}
              />

              <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                <span className="rounded-full bg-slate-800/70 px-3 py-1">
                  Extraímos texto automaticamente de PDFs
                </span>
                <span className="rounded-full bg-slate-800/70 px-3 py-1">
                  Dados não são usados para treinar modelos
                </span>
                <span className="rounded-full bg-slate-800/70 px-3 py-1">
                  Português e Inglês suportados
                </span>
              </div>
            </div>

            {selectedFile && (
              <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-sm text-emerald-100">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200">
                    <FileText className="h-[18px] w-[18px]" />
                  </span>
                  <div className="flex flex-col">
                    <span className="font-semibold text-emerald-100">
                      {selectedFile.name}
                    </span>
                    <span className="text-xs text-emerald-200/80">
                      {(selectedFile.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-emerald-200 transition hover:text-white"
                  onClick={() => onFileSelect(null)}
                >
                  remover
                </button>
              </div>
            )}
          </div>
          </div>

          <aside className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_30px_80px_-50px_rgba(99,102,241,0.6)] backdrop-blur-xl xl:sticky xl:top-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Inspirações</h3>
              <span className="rounded-full bg-slate-900/70 px-3 py-1 text-[11px] font-medium text-slate-300">
                IA trainer
              </span>
            </div>
            <p className="text-sm leading-relaxed text-slate-300/85">
              Use prompts prontos para testar cenários recorrentes e acelerar o onboarding da equipe.
            </p>
            <div className="space-y-3">
              {Object.entries(samples).map(([label, value]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    onTextChange(value.text);
                    onFileSelect(null);
                    onSamplePick?.(label);
                  }}
                  className="group w-full rounded-2xl border border-slate-800/60 bg-slate-950/70 p-4 text-left transition hover:border-indigo-500/40 hover:bg-indigo-500/10"
                  disabled={isLoading}
                >
                  <div className="flex items-center justify-between text-sm text-slate-200">
                    <span className="font-medium">{label}</span>
                    <Sparkles className="h-4 w-4 text-indigo-300 transition group-hover:rotate-6" />
                  </div>
                  <span className="mt-2 block text-xs text-slate-400">
                    {value.hint}
                  </span>
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-sm text-indigo-100">
              <p className="font-medium text-indigo-100">
                Dica de especialista
              </p>
              <p className="mt-2 text-xs leading-relaxed text-indigo-100/80">
                Contextualize SLA, tom desejado e próximos passos para refinar a resposta sugerida automaticamente.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

