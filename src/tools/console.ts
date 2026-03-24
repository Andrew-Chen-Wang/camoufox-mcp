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

import { z } from 'zod';
import { defineTool } from './tool.js';

const levels = ['debug', 'info', 'warning', 'error'] as const;
const levelWeight: Record<(typeof levels)[number], number> = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
};

const consoleMessages = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_console_messages',
    title: 'Get console messages',
    description: 'Returns all console messages',
    inputSchema: z.object({
      level: z.enum(levels).optional().describe('Minimum console level to include.'),
    }),
    type: 'readOnly',
  },
  handle: async (context, params) => {
    const messages = context.currentTabOrDie().consoleMessages().filter(message => {
      const normalized = normalizeConsoleType(message.type());
      const threshold = params.level ?? 'info';
      return levelWeight[normalized] >= levelWeight[threshold];
    });
    const log = messages.map(message => `[${message.type().toUpperCase()}] ${message.text()}`).join('\n');
    return {
      code: ['// <internal code to get console messages>'],
      action: async () => ({ content: [{ type: 'text', text: log }] }),
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

const consoleClear = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_console_clear',
    title: 'Clear console messages',
    description: 'Clear collected console messages',
    inputSchema: z.object({}),
    type: 'destructive',
  },
  handle: async context => {
    context.currentTabOrDie().clearConsoleMessages();
    return {
      code: ['// <internal code to clear console messages>'],
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

function normalizeConsoleType(type: string): (typeof levels)[number] {
  if (type === 'error' || type === 'warning' || type === 'info')
    return type;
  return 'debug';
}

export default [
  consoleMessages,
  consoleClear,
];
