import "dotenv/config";
import { createMusicWorker } from "@/lib/workers/music-worker";
import { createRenderWorker } from "@/lib/workers/render-worker";

const musicWorker = createMusicWorker();
const renderWorker = createRenderWorker();

musicWorker.on("failed", (job, err) => {
  console.error(`[music] job ${job?.id} falhou:`, err);
});
renderWorker.on("failed", (job, err) => {
  console.error(`[render] job ${job?.id} falhou:`, err);
});

console.log("Workers em execução: geração de música + renderização de vídeo.");

function shutdown() {
  console.log("Encerrando workers…");
  Promise.all([musicWorker.close(), renderWorker.close()]).finally(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
