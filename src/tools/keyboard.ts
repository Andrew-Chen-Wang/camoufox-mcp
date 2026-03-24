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
import { defineTool, type ToolFactory } from './tool.js';

const pressKey: ToolFactory = captureSnapshot => defineTool({
  capability: 'core',

  schema: {
    name: 'browser_press_key',
    title: 'Press a key',
    description: 'Press a key on the keyboard',
    inputSchema: z.object({
      key: z.string().describe('Name of the key to press or a character to generate, such as `ArrowLeft` or `a`'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();

    const code = [
      `// Press ${params.key}`,
      `await page.keyboard.press('${params.key}');`,
    ];

    const action = () => tab.page.keyboard.press(params.key);

    return {
      code,
      action,
      captureSnapshot,
      waitForNetwork: true
    };
  },
});

const keyDown: ToolFactory = captureSnapshot => defineTool({
  capability: 'core',
  schema: {
    name: 'browser_key_down',
    title: 'Key down',
    description: 'Press and hold a key on the keyboard',
    inputSchema: z.object({
      key: z.string().describe('Name of the key to press down'),
    }),
    type: 'destructive',
  },
  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    return {
      code: [
        `// Press and hold ${params.key}`,
        `await page.keyboard.down('${params.key}');`,
      ],
      action: () => tab.page.keyboard.down(params.key),
      captureSnapshot,
      waitForNetwork: false,
    };
  },
});

const keyUp: ToolFactory = captureSnapshot => defineTool({
  capability: 'core',
  schema: {
    name: 'browser_key_up',
    title: 'Key up',
    description: 'Release a previously held key on the keyboard',
    inputSchema: z.object({
      key: z.string().describe('Name of the key to release'),
    }),
    type: 'destructive',
  },
  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    return {
      code: [
        `// Release ${params.key}`,
        `await page.keyboard.up('${params.key}');`,
      ],
      action: () => tab.page.keyboard.up(params.key),
      captureSnapshot,
      waitForNetwork: false,
    };
  },
});

const keyDownCompat: ToolFactory = captureSnapshot => defineTool({
  capability: 'core',
  schema: {
    name: 'browser_keydown',
    title: 'Key down',
    description: 'Press and hold a key on the keyboard',
    inputSchema: z.object({
      key: z.string().describe('Name of the key to press down'),
    }),
    type: 'destructive',
  },
  handle: async (context, params) => keyDown(captureSnapshot).handle(context, params),
});

const keyUpCompat: ToolFactory = captureSnapshot => defineTool({
  capability: 'core',
  schema: {
    name: 'browser_keyup',
    title: 'Key up',
    description: 'Release a previously held key on the keyboard',
    inputSchema: z.object({
      key: z.string().describe('Name of the key to release'),
    }),
    type: 'destructive',
  },
  handle: async (context, params) => keyUp(captureSnapshot).handle(context, params),
});

const pressSequentially: ToolFactory = captureSnapshot => defineTool({
  capability: 'core',
  schema: {
    name: 'browser_press_sequentially',
    title: 'Type text sequentially',
    description: 'Type text into the currently focused element one character at a time',
    inputSchema: z.object({
      text: z.string(),
      submit: z.boolean().optional(),
    }),
    type: 'destructive',
  },
  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    const code = [
      `// Press "${params.text}" sequentially into the focused element`,
      `await page.keyboard.type(${JSON.stringify(params.text)});`,
    ];
    const action = async () => {
      await tab.page.keyboard.type(params.text);
      if (params.submit)
        await tab.page.keyboard.press('Enter');
    };
    if (params.submit)
      code.push(`await page.keyboard.press('Enter');`);
    return {
      code,
      action,
      captureSnapshot,
      waitForNetwork: true,
    };
  },
});

export default (captureSnapshot: boolean) => [
  pressKey(captureSnapshot),
  keyDown(captureSnapshot),
  keyDownCompat(captureSnapshot),
  keyUp(captureSnapshot),
  keyUpCompat(captureSnapshot),
  pressSequentially(captureSnapshot),
];
