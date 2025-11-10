from __future__ import annotations

from fastapi import FastAPI, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from .schemas import EmailAnalysisResult, ErrorResponse
from .services import analyzer, text_extractor

app = FastAPI(
    title="Email AI Classifier",
    version="0.1.0",
    description="API para classificar emails entre Produtivo/Improdutivo e sugerir respostas automáticas.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_credentials=True,
    allow_headers=["*"],
)


@app.get("/health")
def healthcheck() -> dict:
    return {"status": "ok"}


@app.post(
    "/analyze",
    response_model=EmailAnalysisResult,
    responses={400: {"model": ErrorResponse}, 502: {"model": ErrorResponse}},
)
async def analyze_email(
    text: str | None = Form(default=None, description="Texto bruto do email."),
    file: UploadFile | None = None,
) -> EmailAnalysisResult:
    if not text and not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Envie um texto ou arquivo para análise.",
        )

    email_text = text or ""
    if file is not None:
        email_text = await text_extractor.extract_text(file)

    try:
        result = analyzer.analyze(email_text)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return result


