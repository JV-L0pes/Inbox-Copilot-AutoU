# Inbox Copilot AutoU

Aplicação full-stack para classificar emails (Produtivo/Improdutivo) e sugerir respostas automáticas usando FastAPI + OpenAI no backend e Next.js 16 no frontend.

## Arquitetura

- **Backend (`backend/`)**: FastAPI, pré-processamento com spaCy (fallback próprio quando o pacote não estiver disponível) e chamada ao Responses API (`gpt-4o-mini`). Endpoint principal `POST /analyze` aceita texto ou upload `.txt/.pdf`.
- **Frontend (`frontend/`)**: Next.js App Router, Tailwind v4 e componentes client-side para upload drag-and-drop, histórico local e cards dinâmicos.
- **Deploy**: Backend preparado para Render via `render.yaml` + `backend/Dockerfile`. Frontend pronto para Vercel; basta apontar `NEXT_PUBLIC_API_URL` para o backend publicado.

## Requisitos

- Python 3.11 (recomendo 3.11 para compatibilidade com spaCy).
- Node.js 20+.
- Chave válida da OpenAI (modelo `gpt-4o-mini`, ~US$5 disponíveis cobrem os testes).

## Backend

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # preencha a chave OPENAI_API_KEY
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Executar testes:

```powershell
.\.venv\Scripts\activate
$env:PYTHONPATH='.'
pytest tests -q
```

## Frontend

```powershell
cd frontend
cp .env.example .env.local  # ajuste NEXT_PUBLIC_API_URL se necessário
npm install
npm run dev
```

Rodar lint:

```powershell
npm run lint
```

## Deploy

### Backend (Render)
1. Conectar repositório GitHub.
2. Selecionar `render.yaml`; Render criará o serviço dockerizado automaticamente.
3. Definir variável `OPENAI_API_KEY` no painel.
4. Após o deploy, anotar a URL pública (ex.: `https://case-email-backend.onrender.com`).

### Frontend (Vercel)
1. Importar o diretório `frontend/` pelo painel da Vercel.
2. Configurar `NEXT_PUBLIC_API_URL` apontando para a URL do backend.
3. Deploy automático com `npm install && npm run build`.

## Teste rápido da API

```powershell
Invoke-WebRequest `
  -Uri http://localhost:8000/analyze `
  -Method POST `
  -Body @{ text = "Preciso do status da solicitação 45821." } `
  -ContentType "application/x-www-form-urlencoded"
```

## Dados de exemplo

- `backend/data/sample_productive.txt`
- `backend/data/sample_unproductive.txt`

## Vídeo demonstrativo

- Placeholder: `[adicione aqui o link público do vídeo de 3-5 minutos apresentando a solução]`

## Observações

- O pipeline prioriza GPU quando disponível (dependente da infraestrutura Render).
- Nenhum dado de email é persistido; histórico mostrado no frontend vive apenas na sessão.
- Ao treinar/ajustar prompts, monitore métricas e interrompa caso qualquer métrica de qualidade piore, conforme diretriz do case.

