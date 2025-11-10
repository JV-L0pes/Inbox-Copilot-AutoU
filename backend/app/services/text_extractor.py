from __future__ import annotations

import io
from typing import Optional

from fastapi import HTTPException, UploadFile, status
from PyPDF2 import PdfReader

ALLOWED_MIME_TYPES = {
    "text/plain",
    "application/pdf",
    "application/octet-stream",
}


async def extract_text(file: UploadFile) -> str:
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato não suportado: {file.content_type}",
        )

    raw = await file.read()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arquivo vazio.",
        )

    if file.filename and file.filename.lower().endswith(".pdf"):
        return _read_pdf(raw)
    return raw.decode("utf-8", errors="ignore")


def _read_pdf(raw: bytes) -> str:
    try:
        buffer = io.BytesIO(raw)
        reader = PdfReader(buffer)
        pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n".join(pages).strip()
    except Exception as exc:  # pragma: no cover - PyPDF2 exceptions variam bastante
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Falha ao ler PDF: {exc}",
        ) from exc
    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível extrair texto do PDF.",
        )
    return text


