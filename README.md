# Gerador de Vídeos IA

App para gerar músicas com IA e montar vídeos automaticamente para alimentar um canal do YouTube:

- **🎵 Gerador de música IA** (`/musica`) — título, letra, estilo e voz (masculina/feminina/instrumental).
- **🖼️ Biblioteca de mídia** (`/midia`) — upload de imagens, vídeos e áudios.
- **🎬 Editor de projetos** (`/projetos`) — monta a ordem de imagens/vídeos + trilha sonora e renderiza o vídeo final.
- **🏭 Esteira em lote** (`/lote`) — gera N músicas de uma vez, cada uma vira automaticamente um vídeo completo (pool de mídia compartilhado).

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind — front-end e API routes.
- **Prisma + SQLite** (dev) — troque `DATABASE_URL` no `.env` para Postgres em produção.
- **BullMQ + Redis** — filas para geração de música (polling assíncrono do provedor) e renderização de vídeo.
- **Remotion** (`@remotion/bundler` + `@remotion/renderer`) — monta a timeline (imagens/vídeos/áudio) em um MP4 real via Chromium headless.
- Armazenamento local em disco (`storage/`), servido por uma API route com suporte a `Range` (streaming de vídeo/áudio).

## Setup

```bash
npm install
cp .env.example .env
npx prisma migrate dev   # cria o SQLite e as tabelas
redis-server &           # a fila BullMQ precisa de um Redis rodando

npm run dev      # Next.js em http://localhost:3000
npm run worker   # processa as filas de música e render (rodar em paralelo)
```

Os dois processos (`dev` e `worker`) precisam estar rodando ao mesmo tempo: o app web enfileira os jobs, o worker é quem de fato chama o provedor de música e roda o Remotion.

## Geração de música: providers

Não existe API oficial pública do Suno. `MUSIC_PROVIDER` no `.env` escolhe a implementação:

- `mock` (padrão) — gera um tom placeholder via ffmpeg, instantâneo e sem custo. Serve para testar todo o pipeline (fila, timeline, render, lote) sem contratar nada.
- `suno-api` — adapter para provedores terceiros que fazem proxy do Suno real (ex: kie.ai, sunoapi.org, goapi.ai) — a forma mais próxima de ter a qualidade do Suno sem API oficial. Configure `MUSIC_API_KEY` (e opcionalmente `MUSIC_API_BASE_URL`/`MUSIC_API_MODEL`). Esses provedores não são oficiais e mudam o formato da resposta de tempos em tempos — se a integração parar de funcionar, o único arquivo a ajustar é `src/lib/music/providers/sunoApi.ts`. O resto do app só conhece a interface `MusicProvider` (`src/lib/music/types.ts`), então trocar de provedor no futuro é só implementar essa interface e apontar `MUSIC_PROVIDER` para ela.

## Renderização de vídeo

O worker usa Remotion para transformar a timeline de um projeto num MP4:

- Cada item da timeline vira uma `Series.Sequence` (imagem ou vídeo) na composição `Timeline` (`src/remotion/`).
- A trilha sonora é uma faixa `<Audio>` global.
- O worker resolve um binário Chromium local (`REMOTION_BROWSER_EXECUTABLE`, ou autodetecta um Chromium/`chrome-headless-shell` instalado via Playwright em `PLAYWRIGHT_BROWSERS_PATH`) para não depender de download de browser em produção.
- Se nenhum Chromium local for encontrado, o Remotion tenta baixar um automaticamente (precisa de acesso à internet na primeira renderização).

## Esteira em lote

Em `/lote` você define N "specs" de música (título/letra/estilo/voz) e um pool de imagens/vídeos compartilhado. Ao enviar:

1. N `MusicGeneration`s são criadas e enfileiradas.
2. Assim que cada música termina, o app monta automaticamente um `Project` com itens da pool (opcionalmente embaralhados) até cobrir a duração exata da faixa, e enfileira o render.
3. A página lista o progresso de cada vídeo do lote e o link de download quando pronto.

## Variáveis de ambiente

Veja `.env.example`. Principais:

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Conexão do Prisma (SQLite em dev) |
| `REDIS_URL` | Redis usado pelo BullMQ |
| `STORAGE_DIR` | Pasta onde os arquivos ficam salvos |
| `APP_BASE_URL` | URL pública do app (o worker monta URLs de mídia a partir dela) |
| `MUSIC_PROVIDER` | `mock` ou `suno-api` |
| `MUSIC_API_KEY` / `MUSIC_API_BASE_URL` / `MUSIC_API_MODEL` | Config do provedor real de música |
| `REMOTION_BROWSER_EXECUTABLE` | Caminho de um Chromium local (opcional) |

## Limitações conhecidas / próximos passos

- Sem autenticação — assume uso pessoal/single-user. Adicionar login antes de expor publicamente.
- Storage é local em disco; para múltiplas instâncias/produção séria, trocar `src/lib/storage.ts` por um adapter S3-compatível (a interface já é pequena o suficiente para isso).
- Sem transições reais entre clipes (`transitionIn` existe no schema mas a composição Remotion ainda faz apenas corte seco) — dá pra evoluir com `@remotion/transitions`.
- Sem upload direto para o YouTube — a esteira entrega os `.mp4` prontos para download; publicar no canal ainda é manual (ou pode virar uma integração futura com a YouTube Data API).
