# Runs the BullMQ worker (music generation + Remotion video rendering) as a
# standalone, always-on process — this is NOT deployed to Vercel, which only
# runs short-lived serverless functions. Deploy this image to any always-on
# host (Railway, Fly.io, a small VPS, etc.) alongside the Next.js app on
# Vercel. See README.md "Deploy" section for the full runbook.
FROM node:22-bookworm-slim

# System libraries required by headless Chromium, which Remotion uses to
# render the timeline. If REMOTION_BROWSER_EXECUTABLE isn't set, Remotion
# downloads its own Chrome Headless Shell on first render (needs outbound
# internet access from this container).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates wget fonts-liberation \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 libcups2 \
    libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 \
    libx11-xcb1 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libxshmfence1 libxss1 xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npx prisma generate

CMD ["npm", "run", "worker:start"]
