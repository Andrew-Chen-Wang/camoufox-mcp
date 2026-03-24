import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createConnection as createPlaywrightConnection } from '@playwright/mcp';
import { launchOptions as camoufoxLaunchOptions } from 'camoufox-js';
import { firefox } from 'playwright';

export async function createConnection(userConfig = {}, contextGetter) {
  const config = normalizeConfig(userConfig);
  let managedContext;
  let providedContext;

  const upstreamContextGetter = contextGetter
    ? async () => {
        const context = await contextGetter();
        providedContext = context;
        return context;
      }
    : undefined;

  if (!upstreamContextGetter && !config.browser.remoteEndpoint)
    managedContext = await createManagedContext(config);

  const connection = await createPlaywrightConnection(
    toUpstreamConfig(config, { usingProvidedContext: !!(managedContext || upstreamContextGetter) }),
    managedContext ? async () => managedContext.context : upstreamContextGetter,
  );

  return bindConnectionLifecycle(connection, async () => {
    if (managedContext)
      await managedContext.close();
    else if (providedContext)
      await providedContext.close().catch(() => {});
  });
}

export async function createMCPHTTPServer(options = {}) {
  const sessions = new Map();
  const config = mergeHeadlessOverride(options.config, options.headless);

  const server = http.createServer((req, res) => {
    void handleRequest(req, res, config, sessions);
  });

  await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(options.port ?? 0, options.host ?? '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  const closeSessions = async () => {
    await Promise.all([...sessions.values()].map(async session => {
      await session.connection.close().catch(() => {});
    }));
    sessions.clear();
  };

  const originalClose = server.close.bind(server);
  const shutdown = () => {
    void closeSessions().finally(() => {
      server.closeAllConnections();
      originalClose();
    });
  };

  const onSigint = () => shutdown();
  const onSigterm = () => shutdown();
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);

  server.close = (callback) => {
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
    void closeSessions().finally(() => {
      server.closeAllConnections();
      originalClose(callback);
    });
    return server;
  };

  return server;
}

async function handleRequest(req, res, config, sessions) {
  const sessionId = req.headers['mcp-session-id'];
  const existingSession = typeof sessionId === 'string' ? sessions.get(sessionId) : undefined;
  if (existingSession) {
    await existingSession.transport.handleRequest(req, res);
    return;
  }

  const connection = await createConnection(config);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  transport.onclose = async () => {
    if (transport.sessionId)
      sessions.delete(transport.sessionId);
    await connection.close().catch(() => {});
  };

  try {
    await connection.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    await connection.close().catch(() => {});
    throw error;
  }

  if (transport.sessionId)
    sessions.set(transport.sessionId, { connection, transport });
}

function normalizeConfig(config = {}) {
  validateConfig(config);

  const outputDir = config.outputDir ?? path.join(os.tmpdir(), 'camoufox-mcp-output', sanitizeSegment(new Date().toISOString()));
  const launchOptions = {
    headless: os.platform() === 'linux' && !process.env.DISPLAY,
    ...(config.browser?.launchOptions ?? {}),
  };
  const contextOptions = {
    ...(config.browser?.contextOptions ?? {}),
  };

  if (config.saveTrace)
    launchOptions.tracesDir = path.join(outputDir, 'traces');

  if (config.saveVideo) {
    contextOptions.recordVideo = {
      dir: path.join(outputDir, 'videos'),
      size: config.saveVideo,
    };
  }

  return {
    ...config,
    browser: {
      ...(config.browser ?? {}),
      browserName: 'firefox',
      isolated: config.browser?.isolated ?? false,
      launchOptions,
      contextOptions,
    },
    outputDir,
  };
}

function toUpstreamConfig(config, { usingProvidedContext }) {
  return {
    ...config,
    browser: {
      ...config.browser,
      isolated: usingProvidedContext ? false : config.browser.isolated,
      launchOptions: { ...config.browser.launchOptions },
      contextOptions: { ...config.browser.contextOptions },
    },
  };
}

function validateConfig(config) {
  const browserName = config.browser?.browserName;
  if (browserName && browserName !== 'firefox')
    throw new Error(`camoufox-mcp only supports Firefox-compatible browsers. Received "${browserName}".`);
  if (config.browser?.cdpEndpoint)
    throw new Error('camoufox-mcp does not support cdpEndpoint because Camoufox is Firefox-based.');
  if (config.extension)
    throw new Error('camoufox-mcp does not support extension mode.');
}

async function createManagedContext(config) {
  await ensureOutputDirectories(config);

  if (config.browser.isolated)
    return createIsolatedContext(config);
  return createPersistentContext(config);
}

async function createIsolatedContext(config) {
  const browser = await firefox.launch(await toCamoufoxLaunchOptions(config.browser.launchOptions));
  const context = await browser.newContext(config.browser.contextOptions);
  return {
    context,
    close: async () => {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}

async function createPersistentContext(config) {
  const createdUserDataDir = !config.browser.userDataDir;
  const userDataDir =
    config.browser.userDataDir ??
    await fs.mkdtemp(path.join(os.tmpdir(), 'camoufox-mcp-profile-'));

  const persistentOptions = {
    ...(await toCamoufoxLaunchOptions(config.browser.launchOptions)),
    ...config.browser.contextOptions,
  };
  const context = await firefox.launchPersistentContext(userDataDir, persistentOptions);

  return {
    context,
    close: async () => {
      await context.close().catch(() => {});
      if (createdUserDataDir)
        await fs.rm(userDataDir, { force: true, recursive: true }).catch(() => {});
    },
  };
}

async function toCamoufoxLaunchOptions(launchOptions) {
  return camoufoxLaunchOptions({
    ...launchOptions,
    headless: launchOptions.headless,
  });
}

async function ensureOutputDirectories(config) {
  await fs.mkdir(config.outputDir, { recursive: true });
  if (config.saveTrace)
    await fs.mkdir(path.join(config.outputDir, 'traces'), { recursive: true });
  if (config.saveVideo)
    await fs.mkdir(path.join(config.outputDir, 'videos'), { recursive: true });
}

function bindConnectionLifecycle(connection, cleanup) {
  const originalConnect = connection.connect.bind(connection);
  const originalClose = connection.close.bind(connection);
  let closed = false;

  const closeConnection = async () => {
    if (closed)
      return;
    closed = true;
    try {
      await originalClose();
    } finally {
      await cleanup();
    }
  };

  connection.close = closeConnection;
  connection.connect = async (transport) => {
    const previousOnClose = transport.onclose;
    transport.onclose = async () => {
      try {
        await previousOnClose?.();
      } finally {
        await closeConnection();
      }
    };

    try {
      await originalConnect(transport);
    } catch (error) {
      await closeConnection();
      throw error;
    }
  };

  return connection;
}

function mergeHeadlessOverride(config, headless) {
  if (headless === undefined)
    return config ?? {};

  return {
    ...config,
    browser: {
      ...config?.browser,
      launchOptions: {
        ...config?.browser?.launchOptions,
        headless,
      },
    },
  };
}

function sanitizeSegment(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
}
