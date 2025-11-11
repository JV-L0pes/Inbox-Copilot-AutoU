# Inbox Copilot AutoU

Aplicação full-stack para classificar emails (Produtivo/Improdutivo) e sugerir respostas automáticas usando FastAPI + OpenAI no backend e Next.js 16 no frontend.

Pensada para o cenário do desafio: uma grande empresa financeira que recebe alto volume de emails diários e precisa automatizar a triagem entre mensagens que exigem ação imediata (Produtivo) e comunicações informais/improdutivas, entregando respostas curtas para liberar a equipe de atendimento.

## Arquitetura

- **Backend (`backend/`)**: FastAPI, pré-processamento com spaCy (fallback próprio quando o pacote não estiver disponível) e chamada ao Responses API (`gpt-4o-mini`). Endpoint principal `POST /analyze` aceita texto ou upload `.txt/.pdf`, extraindo conteúdo de PDFs com PyPDF2.
- **Frontend (`frontend/`)**: Next.js App Router, Tailwind v4 e componentes client-side com upload drag-and-drop, painel de inspirações, cards dinamicamente atualizados e histórico local em sessão.
- **Deploy**: Backend publicado em AWS Elastic Beanstalk (Free Tier) com imagem Docker armazenada no ECR; frontend gerado estático e hospedado em AWS S3 (opcionalmente via CloudFront). Alternativamente, Render/Vercel continuam suportados.
- **Docker**: Arquivos `Dockerfile.dev` (backend/frontend) e `docker-compose.yml` para ambiente local com hot reload (`uvicorn --reload` e `npm run dev`).

## Requisitos

- Python 3.11 (recomendo 3.11 para compatibilidade com spaCy).
- Node.js 20+.
- Chave válida da OpenAI (modelo `gpt-4o-mini`, ~US$5 disponíveis cobrem os testes).

## Estrutura

```
backend/
  app/
    main.py
    services/...
  data/
  tests/
  Dockerfile
  Dockerfile.dev

frontend/
  src/
    app/
    components/
    lib/api.ts
  Dockerfile
  Dockerfile.dev

docker-compose.yml
```

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

### Ambiente com Docker (local)

Subir frontend e backend com hot reload:

```powershell
docker compose up --build
```

Rodar lint:

```powershell
cd frontend
npm run lint
```

## Deploy

### Backend (AWS Elastic Beanstalk – Free Tier)
1. **Build + push da imagem Docker para o ECR**
   ```powershell
   cd backend
   docker build -t inbox-backend:latest .
   $ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)
   $REGION = "us-east-1"
   aws ecr create-repository --repository-name inbox-backend
   aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
   docker tag inbox-backend:latest "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/inbox-backend:latest"
   docker push "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/inbox-backend:latest"
   ```
2. **Gerar pacote `Dockerrun`** (usa placeholders e evita subir credenciais/template pronto):
   ```powershell
   cd ..\deploy\backend-eb
   .\prepare.ps1 -AccountId $ACCOUNT_ID -Region $REGION
   Compress-Archive -Path Dockerrun.aws.json -DestinationPath backend-eb.zip -Force
   ```
3. **Elastic Beanstalk (console)**  
   - Plataforma: *Docker running on 64bit Amazon Linux 2023*.  
   - Upload `backend-eb.zip`.  
   - Perfis IAM: `aws-elasticbeanstalk-service-role` (service) e `aws-elasticbeanstalk-ec2-role` (instance) com política `AmazonEC2ContainerRegistryReadOnly`.  
   - Preset: *Single instance (free tier)*.
4. **Configurações pós-criação**  
   - Configuration → Software → Environment properties: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_MAX_OUTPUT_TOKENS`, `OPENAI_TIMEOUT_SECONDS`, `USE_OPENAI_STUB=false`.  
   - Configuration → Load balancer → Health check path `/health`, port `8000`.
5. **Testar**  
   - `http://<env>.elasticbeanstalk.com/health` → `{"status":"ok"}`.  
   - `POST /analyze` via frontend hospedado ou `Invoke-WebRequest` (exemplo abaixo).

### Frontend (AWS S3 – Static Website)
1. **Build estático**
   ```powershell
   cd frontend
   npm install
   npm run build
   ```
   (o build gera a pasta `out/` graças ao `output: "export"` do `next.config.ts`).
2. **Bucket S3**
   - Criar bucket (ex.: `inbox-frontend-demo`) em `us-east-1`.  
   - Properties → *Static website hosting* → Enable → `index.html` e `404.html`.
3. **Política de acesso público**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::inbox-frontend-demo/*"
       }
     ]
   }
   ```
4. **Upload do build**
   ```powershell
   aws s3 sync .\out s3://inbox-frontend-demo --delete
   ```
5. **URL final**  
   `http://inbox-frontend-demo.s3-website-us-east-1.amazonaws.com`.  
   Para HTTPS e cache, crie uma distribuição CloudFront apontando para o bucket (opcional) e invalide ao publicar novas versões.

### Links públicos
- Frontend (CloudFront): `https://d2efiung7co051.cloudfront.net`
- Backend (CloudFront): `https://d221hdcnee4vgx.cloudfront.net` (`/health`, `POST /analyze`)
- Recursos originais (fallback): S3 static site (`http://inbox-frontend-demo.s3-website-us-east-1.amazonaws.com`) e Elastic Beanstalk (`http://inbox-backend-env.us-east-1.elasticbeanstalk.com`)

> Mantive os domínios padrão gerados pelo CloudFront para não incorrer em custos adicionais com Route 53 ou certificados customizados; os identificadores alfanuméricos fazem parte do endereço gratuito fornecido pela AWS.

### Alternativas de deploy
- **Backend (Render)**: conectar GitHub, usar `render.yaml`, definir `OPENAI_API_KEY`.  
- **Frontend (Vercel)**: importar `frontend/`, configurar `NEXT_PUBLIC_API_URL`, build automático.

### Ambiente local com Docker
```powershell
docker compose up --build
```
> Se surgir o alerta `Não foi possível adicionar o sistema de arquivos: <illegal path>`, compartilhe a unidade nas configurações do Docker Desktop (**Settings → Resources → File Sharing**) e suba novamente.

### Escalabilidade e custos
- Elastic Beanstalk roda em `t3.micro` free tier; autoscaling pode ser ligado em **Capacity** se desejar.  
- Rate limit interno (`RATE_LIMIT_*`) protege o uso da OpenAI.  
- Para throttle externo, posicionar API Gateway + Usage Plan.  
- CloudFront + S3 reduzem custo de banda e oferecem HTTPS sem custo adicional.

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

## Variáveis de ambiente

### Backend (`backend/.env`)
- `OPENAI_API_KEY` — chave da OpenAI (obrigatório).
- `OPENAI_MODEL` — modelo a utilizar (`gpt-4o-mini` por padrão).
- `OPENAI_MAX_OUTPUT_TOKENS` — limite de tokens para resposta (600 default).
- `OPENAI_TIMEOUT_SECONDS` — timeout de chamadas (60 default).
- `RATE_LIMIT_REQUESTS` — número máximo de requisições por janela (60 por padrão).
- `RATE_LIMIT_WINDOW_SECONDS` — duração da janela em segundos (60 por padrão).

### Frontend (`frontend/.env.local`)
- `NEXT_PUBLIC_API_URL` — URL do backend (ex.: `https://d221hdcnee4vgx.cloudfront.net`).

## Observações

- O pipeline prioriza GPU quando disponível (dependente da infraestrutura Render).
- Nenhum dado de email é persistido; histórico mostrado no frontend vive apenas na sessão.
- Ao treinar/ajustar prompts, monitore métricas e interrompa caso qualquer métrica de qualidade piore, conforme diretriz do case.
- Rate limit in-memory (padrão 60 req/min/IP) protege o uso pay-as-you-go da OpenAI; ajuste via variáveis e veja cabeçalho `Retry-After`.
- A arquitetura está pronta para autoscaling (Elastic Beanstalk/ECS). Autoscaling não está habilitado por padrão para evitar custos inesperados, mas a containerização facilita a ativação quando for necessário.
- Ao hospedar em provedores com cold start (ex.: Render free tier), a primeira requisição pode retornar 502/timeout. Basta aguardar alguns segundos e reenviar; depois disso, o serviço segue estável. Para informar usuários, defina `NEXT_PUBLIC_SHOW_COLD_START_HINT=true` no frontend (exibe alerta na interface).
- Para desenvolvimento offline/sem custo, defina `USE_OPENAI_STUB=true` no backend. O pipeline retorna respostas simuladas usando heurísticas locais.

