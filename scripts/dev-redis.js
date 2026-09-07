// Starts a real local Redis instance for development, mirroring how this
// project self-manages a local Postgres on a custom port instead of
// requiring a system-wide install. Uses redis-memory-server's prebuilt
// binary so no Docker/WSL/system package manager is required.
const { RedisMemoryServer } = require('redis-memory-server');

const PORT = Number(process.env.ANCHOR_DEV_REDIS_PORT) || 6390;

async function main() {
  const server = await RedisMemoryServer.create({ instance: { port: PORT } });
  const host = await server.getHost();
  const port = await server.getPort();

  console.log(`Redis (dev) running on: redis://${host}:${port}`);
  console.log('Add this to apps/api/.env: REDIS_URL=redis://' + host + ':' + port);

  const shutdown = async () => {
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Failed to start dev Redis instance:', error);
  process.exit(1);
});
