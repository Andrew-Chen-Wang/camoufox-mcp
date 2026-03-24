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
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createConnection } from './index.js';
export async function createMCPHTTPServer(options = {}) {
    const sessions = new Map();
    const config = mergeConfig(options.config, options.headless);
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
        await Promise.all([...sessions.values()].map(session => session.connection.close().catch(() => { })));
        sessions.clear();
    };
    const originalClose = server.close.bind(server);
    server.close = ((callback) => {
        void closeSessions().finally(() => {
            server.closeAllConnections();
            originalClose(callback);
        });
        return server;
    });
    const shutdown = () => {
        void closeSessions().finally(() => {
            server.closeAllConnections();
            originalClose();
        });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    return server;
}
async function handleRequest(req, res, config, sessions) {
    const sessionId = req.headers['mcp-session-id'];
    const existingSession = sessionId ? sessions.get(sessionId) : undefined;
    if (existingSession) {
        await existingSession.transport.handleRequest(req, res);
        return;
    }
    const connection = await createConnection(config);
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
    });
    transport.onclose = () => {
        if (transport.sessionId) {
            sessions.delete(transport.sessionId);
            void connection.close().catch(() => { });
        }
    };
    await connection.connect(transport);
    await transport.handleRequest(req, res);
    if (transport.sessionId)
        sessions.set(transport.sessionId, { connection, transport });
}
function mergeConfig(config, headless) {
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
