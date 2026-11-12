import { app } from './app';

const server = Bun.serve({
    hostname: "0.0.0.0",
    port: 3000,
    fetch: app.fetch,
});