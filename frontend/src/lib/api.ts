"use client";

export type EmailCategory = "Produtivo" | "Improdutivo";

export interface EmailAnalysisResponse {
  category: EmailCategory;
  suggested_response: string;
  confidence: number;
  justification?: string | null;
  highlights?: string[] | null;
  normalized_text?: string | null;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  } | null;
  raw_labels?: string[] | null;
}

const RAW_API_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim() ?? "http://localhost:8000";

function normalizeApiUrl(rawUrl: string): string {
  const withoutTrailingSlash = rawUrl.replace(/\/+$/, "");

  if (typeof window === "undefined") {
    return withoutTrailingSlash;
  }

  try {
    const parsedUrl = new URL(withoutTrailingSlash, window.location.origin);
    const isLocalhost =
      parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1";

    if (
      window.location.protocol === "https:" &&
      parsedUrl.protocol === "http:" &&
      !isLocalhost
    ) {
      parsedUrl.protocol = "https:";
    }

    return parsedUrl.toString().replace(/\/+$/, "");
  } catch {
    return withoutTrailingSlash;
  }
}

const API_URL = normalizeApiUrl(RAW_API_URL);

export interface AnalyzePayload {
  text?: string;
  file?: File | null;
  signal?: AbortSignal;
}

export async function analyzeEmail({
  text,
  file,
  signal,
}: AnalyzePayload): Promise<EmailAnalysisResponse> {
  const formData = new FormData();
  if (text) {
    formData.append("text", text);
  }
  if (file) {
    formData.append("file", file);
  }

  const response = await fetch(`${API_URL}/analyze`, {
    method: "POST",
    body: formData,
    signal,
  });

  if (!response.ok) {
    const message = await response
      .json()
      .then((payload) => payload.detail ?? response.statusText)
      .catch(() => response.statusText);
    throw new Error(message || "Falha ao analisar email.");
  }

  const payload = (await response.json()) as EmailAnalysisResponse;
  return payload;
}

