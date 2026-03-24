/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createConnection as createConnectionImpl } from './connection.js';
import { createMCPHTTPServer } from './mcpHttpServer.js';
import { resolveConfig } from './config.js';
import { contextFactory } from './browserContextFactory.js';

import type { Config } from '../config.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { BrowserContext } from 'playwright-core';
import type { BrowserContextFactory } from './browserContextFactory.js';

export async function createConnection(userConfig: Config = {}, contextGetter?: () => Promise<BrowserContext>): Promise<Server> {
  const config = await resolveConfig(userConfig);
  const factory = contextGetter ? new SimpleBrowserContextFactory(contextGetter) : contextFactory(config.browser);
  const connection = createConnectionImpl(config, factory);
  return bindConnectionLifecycle(connection);
}

export { createMCPHTTPServer };

class SimpleBrowserContextFactory implements BrowserContextFactory {
  private readonly _contextGetter: () => Promise<BrowserContext>;

  constructor(contextGetter: () => Promise<BrowserContext>) {
    this._contextGetter = contextGetter;
  }

  async createContext(): Promise<{ browserContext: BrowserContext, close: () => Promise<void> }> {
    const browserContext = await this._contextGetter();
    return {
      browserContext,
      close: () => browserContext.close()
    };
  }
}

function bindConnectionLifecycle(connection: Awaited<ReturnType<typeof createConnectionImpl>>): Server {
  const server = connection.server;
  const originalConnect = server.connect.bind(server);
  const originalClose = server.close.bind(server);
  let closed = false;

  const closeConnection = async () => {
    if (closed)
      return;
    closed = true;
    await originalClose();
    await connection.context.close();
  };

  server.close = closeConnection;
  server.connect = async (transport: Transport) => {
    const previousOnClose = transport.onclose;
    transport.onclose = async () => {
      try {
        await previousOnClose?.();
      } finally {
        await closeConnection();
      }
    };
    await originalConnect(transport);
  };

  return server;
}
