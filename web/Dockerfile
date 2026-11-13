FROM oven/bun:1.4.4
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile && chown -R bun:bun /app

COPY --chown=bun:bun . .
USER bun
EXPOSE 5173

CMD ["bun", "run", "dev"]