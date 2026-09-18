# Gerador de Vídeos IA

App para gerar músicas com IA e montar vídeos automaticamente para alimentar um canal do YouTube:

- **🎵 Gerador de música IA** (`/musica`) — título, letra, estilo e voz (masculina/feminina/instrumental).
- **🖼️ Biblioteca de mídia** (`/midia`) — upload de imagens, vídeos e áudios.
- **🎬 Editor de projetos** (`/projetos`) — monta a ordem de imagens/vídeos + trilha sonora e renderiza o vídeo final.
- **🏭 Esteira em lote** (`/lote`) — gera N músicas de uma vez, cada uma vira automaticamente um vídeo completo (pool de mídia compartilhado).

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind — front-end e API routes.
- **Prisma + Postgres** — banco de dados.
- **BullMQ + Redis** — filas para geração de música (polling assíncrono do provedor) e renderização de vídeo.
- **Remotion** (`@remotion/bundler` + `@remotion/renderer`) — monta a timeline (imagens/vídeos/áudio) em um MP4 real via Chromium headless.
- **Storage**: disco local em dev, [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) em produção (`src/lib/storage.ts` decide sozinho qual usar).

### Por que isso não é um app 100% serverless

A Vercel só roda **funções sob demanda** — nada fica de pé entre requisições. Este app tem duas partes que precisam ficar rodando o tempo todo:

1. **O worker** (`npm run worker:start`) — processa a fila de geração de música (fica fazendo polling no provedor) e roda o Remotion pra renderizar vídeo (pode levar minutos). Nenhuma das duas coisas cabe no modelo de função curta da Vercel.
2. **Redis** — a fila do BullMQ precisa de um Redis de verdade, que a Vercel não hospeda.

Por isso o deploy é em duas partes: **o site (Next.js) na Vercel** + **o worker rodando em outro lugar sempre ativo** (Railway, Fly.io, um VPS). Veja a seção [Deploy](#deploy-vercel--worker-externo) abaixo.

## Setup local

```bash
npm install
cp .env.example .env
# ajuste DATABASE_URL no .env pra um Postgres (local ou hospedado, ex: Neon)
npx prisma migrate dev
redis-server &           # a fila BullMQ precisa de um Redis rodando

npm run dev      # Next.js em http://localhost:3000
npm run worker   # processa as filas de música e render (rodar em paralelo)
```

Os dois processos (`dev` e `worker`) precisam estar rodando ao mesmo tempo: o app web enfileira os jobs, o worker é quem de fato chama o provedor de música e roda o Remotion.

Sem Postgres instalado localmente? A forma mais rápida é criar um banco grátis no [Neon](https://neon.tech) e colar a connection string em `DATABASE_URL` — funciona igual em dev e produção.

## Geração de música: providers

Não existe API oficial pública do Suno. `MUSIC_PROVIDER` no `.env` escolhe a implementação:

- `mock` (padrão) — gera um tom placeholder via ffmpeg, instantâneo e sem custo. Serve para testar todo o pipeline (fila, timeline, render, lote) sem contratar nada.
- `suno-api` — adapter para provedores terceiros que fazem proxy do Suno real (ex: kie.ai, sunoapi.org, goapi.ai) — a forma mais próxima de ter a qualidade do Suno sem API oficial. Configure `MUSIC_API_KEY` (e opcionalmente `MUSIC_API_BASE_URL`/`MUSIC_API_MODEL`). Esses provedores não são oficiais e mudam o formato da resposta de tempos em tempos — se a integração parar de funcionar, o único arquivo a ajustar é `src/lib/music/providers/sunoApi.ts`. O resto do app só conhece a interface `MusicProvider` (`src/lib/music/types.ts`), então trocar de provedor no futuro é só implementar essa interface e apontar `MUSIC_PROVIDER` para ela.

## Renderização de vídeo

O worker usa Remotion para transformar a timeline de um projeto num MP4:

- Cada item da timeline vira uma `Series.Sequence` (imagem ou vídeo) na composição `Timeline` (`src/remotion/`).
- A trilha sonora é uma faixa `<Audio>` global.
- O worker resolve um binário Chromium local (`REMOTION_BROWSER_EXECUTABLE`, ou autodetecta um Chromium/`chrome-headless-shell` instalado via Playwright em `PLAYWRIGHT_BROWSERS_PATH`) para não depender de download de browser em produção.
- Se nenhum Chromium local for encontrado, o Remotion tenta baixar um automaticamente (precisa de acesso à internet na primeira renderização — é o caso padrão rodando o `worker.Dockerfile` no Railway/Fly).

## Esteira em lote

Em `/lote` você define N "specs" de música (título/letra/estilo/voz) e um pool de imagens/vídeos compartilhado. Ao enviar:

1. N `MusicGeneration`s são criadas e enfileiradas.
2. Assim que cada música termina, o app monta automaticamente um `Project` com itens da pool (opcionalmente embaralhados) até cobrir a duração exata da faixa, e enfileira o render.
3. A página lista o progresso de cada vídeo do lote e o link de download quando pronto.

## Variáveis de ambiente

Veja `.env.example`. Principais:

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Conexão Postgres do Prisma |
| `REDIS_URL` | Redis usado pelo BullMQ |
| `STORAGE_DIR` | Pasta onde os arquivos ficam salvos (driver local) |
| `STORAGE_DRIVER` / `BLOB_READ_WRITE_TOKEN` | `local` ou `blob` (Vercel Blob) — auto-detecta `blob` se o token estiver setado |
| `APP_BASE_URL` | URL pública do app (o worker monta URLs de mídia a partir dela) |
| `MUSIC_PROVIDER` | `mock` ou `suno-api` |
| `MUSIC_API_KEY` / `MUSIC_API_BASE_URL` / `MUSIC_API_MODEL` | Config do provedor real de música |
| `REMOTION_BROWSER_EXECUTABLE` | Caminho de um Chromium local (opcional) |

## Deploy: Vercel + worker externo

### 1. Banco de dados (Postgres)

No painel da Vercel do projeto: **Storage → Create Database → Postgres** (ou conecte um Neon/Supabase existente). Isso injeta `DATABASE_URL` automaticamente nas env vars do projeto. Depois, rode a migration uma vez apontando pra esse banco:

```bash
DATABASE_URL="<connection string de produção>" npx prisma migrate deploy
```

### 2. Storage (Vercel Blob)

No painel: **Storage → Create Database → Blob**. Isso injeta `BLOB_READ_WRITE_TOKEN` automaticamente — `src/lib/storage.ts` já detecta essa variável e passa a salvar tudo (uploads, músicas e vídeos gerados) no Blob em vez de disco local. Nenhuma mudança de código necessária.

### 3. Redis (Upstash)

No painel: **Storage → Create Database → Upstash Redis** (ou crie direto em [upstash.com](https://upstash.com), tem plano grátis). Pegue a connection string `rediss://...` e defina como `REDIS_URL` — tanto no projeto Vercel quanto no host do worker (precisam apontar pro mesmo Redis).

### 4. Deploy do site na Vercel

Como você já conectou o repositório pelo GitHub, a Vercel builda e publica automaticamente a cada push. Só falta configurar as env vars do projeto (Settings → Environment Variables) com os valores gerados nos passos 1–3, mais:

- `APP_BASE_URL` = a URL de produção do seu projeto (ex: `https://seu-app.vercel.app`)
- `MUSIC_PROVIDER`, `MUSIC_API_KEY` etc. se for usar geração de música real

### 5. Worker (fora da Vercel)

O worker (`worker.Dockerfile` na raiz do repo) precisa rodar em um host sempre ativo, com as **mesmas** env vars do site (`DATABASE_URL`, `REDIS_URL`, `BLOB_READ_WRITE_TOKEN`, `APP_BASE_URL`, `MUSIC_PROVIDER`/`MUSIC_API_KEY`). Recomendado: [Railway](https://railway.app) (tem plano gratuito/trial, deploy direto do GitHub, detecta o `worker.Dockerfile` sozinho):

1. New Project → Deploy from GitHub repo (mesmo repositório).
2. Em Settings → defina o Dockerfile como `worker.Dockerfile` (Railway pode perguntar isso se detectar mais de um Dockerfile, ou você renomeia/move pra raiz como `Dockerfile` num serviço dedicado).
3. Cole as mesmas env vars do passo 4.
4. Deploy — o log deve mostrar `Workers em execução: geração de música + renderização de vídeo.`

Qualquer outro host que rode um container sempre ativo (Fly.io, um VPS com Docker, etc.) funciona do mesmo jeito — é só `docker build -f worker.Dockerfile -t worker . && docker run --env-file .env worker`.

### Checklist rápido

- [ ] Postgres criado, `DATABASE_URL` setada, `prisma migrate deploy` rodado
- [ ] Blob criado, `BLOB_READ_WRITE_TOKEN` setada
- [ ] Redis (Upstash) criado, `REDIS_URL` setada no site **e** no worker
- [ ] Site na Vercel com todas as env vars, `APP_BASE_URL` apontando pra URL real
- [ ] Worker rodando em host separado, mesmas env vars, log confirma que subiu

## Limitações conhecidas / próximos passos

- Sem autenticação — assume uso pessoal/single-user. Adicionar login antes de expor publicamente.
- Sem transições reais entre clipes (`transitionIn` existe no schema mas a composição Remotion ainda faz apenas corte seco) — dá pra evoluir com `@remotion/transitions`.
- Sem upload direto para o YouTube — a esteira entrega os `.mp4` prontos para download; publicar no canal ainda é manual (ou pode virar uma integração futura com a YouTube Data API).
- Renderização de vídeo em Lambda-first (ex: `@remotion/lambda`) é uma alternativa a manter um worker sempre ativo, se o volume de vídeos crescer muito — não implementado aqui por simplicidade.
