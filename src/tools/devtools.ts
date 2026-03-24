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

import fs from 'node:fs/promises';

import { z } from 'zod';

import { outputFile } from '../config.js';
import { defineTool } from './tool.js';
import { resolveLocator } from './utils.js';

const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor as new (...args: string[]) => (...fnArgs: any[]) => Promise<any>;

const evaluate = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_evaluate',
    title: 'Evaluate JavaScript',
    description: 'Evaluate JavaScript expression on page or element',
    inputSchema: z.object({
      function: z.string(),
      filename: z.string().optional(),
      element: z.string().optional(),
      ref: z.string().optional(),
      selector: z.string().optional(),
    }).refine(value => {
      const targets = Number(!!value.ref) + Number(!!value.selector);
      if (value.element)
        return targets === 1;
      return targets === 0;
    }, {
      message: 'Provide element with exactly one of ref or selector, or provide no target.',
      path: ['ref'],
    }),
    type: 'destructive',
  },
  handle: async (context, params) => ({
    code: ['// <internal code to evaluate JavaScript>'],
    action: async () => {
      const page = context.currentTabOrDie().page;
      const fn = new Function(`return (${params.function});`)();
      const result = params.element
        ? await resolveLocator(context.currentTabOrDie(), { element: params.element, ref: params.ref, selector: params.selector }).evaluate(fn as any)
        : await page.evaluate(fn as any);
      const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      if (params.filename) {
        const fileName = await outputFile(context.config, params.filename);
        await fs.writeFile(fileName, text, 'utf8');
        return { content: [{ type: 'text', text: fileName }] };
      }
      return { content: [{ type: 'text', text }] };
    },
    captureSnapshot: false,
    waitForNetwork: false,
  }),
});

const runCode = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_run_code',
    title: 'Run Playwright code',
    description: 'Run a Playwright code snippet against the current page',
    inputSchema: z.object({
      code: z.string(),
    }),
    type: 'destructive',
  },
  handle: async (context, params) => ({
    code: ['// <internal code to run Playwright snippet>'],
    action: async () => {
      const page = context.currentTabOrDie().page;
      const fn = new AsyncFunction('page', `return (${params.code})(page);`);
      const result = await fn(page);
      if (result === undefined)
        return;
      return {
        content: [{
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        }],
      };
    },
    captureSnapshot: true,
    waitForNetwork: true,
  }),
});

const startTracing = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_start_tracing',
    title: 'Start tracing',
    description: 'Start Playwright tracing',
    inputSchema: z.object({}),
    type: 'destructive',
  },
  handle: async context => ({
    code: ['// <internal code to start tracing>'],
    action: async () => {
      await context.startTracing();
    },
    captureSnapshot: false,
    waitForNetwork: false,
  }),
});

const stopTracing = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_stop_tracing',
    title: 'Stop tracing',
    description: 'Stop Playwright tracing and save the trace to a file',
    inputSchema: z.object({
      filename: z.string().optional(),
    }),
    type: 'destructive',
  },
  handle: async (context, params) => ({
    code: ['// <internal code to stop tracing>'],
    action: async () => {
      const fileName = await context.stopTracing(params.filename);
      return { content: [{ type: 'text', text: fileName }] };
    },
    captureSnapshot: false,
    waitForNetwork: false,
  }),
});

const getConfig = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_get_config',
    title: 'Get config',
    description: 'Return the resolved browser config',
    inputSchema: z.object({}),
    type: 'readOnly',
  },
  handle: async context => ({
    code: ['// <internal code to get config>'],
    action: async () => ({
      content: [{ type: 'text', text: JSON.stringify(context.config, null, 2) }],
    }),
    captureSnapshot: false,
    waitForNetwork: false,
  }),
});

function unsupportedTool(name: string, title: string, description: string) {
  return defineTool({
    capability: 'core',
    schema: {
      name,
      title,
      description,
      inputSchema: z.object({
        filename: z.string().optional(),
        step: z.boolean().optional(),
        location: z.string().optional(),
      }).partial(),
      type: 'readOnly' as const,
    },
    handle: async () => ({
      code: [`// ${name} is not supported in camoufox-mcp`],
      captureSnapshot: false,
      waitForNetwork: false,
      resultOverride: {
        content: [{
          type: 'text',
          text: `${name} is not supported by camoufox-mcp yet.`,
        }],
        isError: true,
      },
    }),
  });
}

export default [
  evaluate,
  runCode,
  startTracing,
  stopTracing,
  getConfig,
  unsupportedTool('browser_start_video', 'Start video', 'Start video recording'),
  unsupportedTool('browser_stop_video', 'Stop video', 'Stop video recording'),
  unsupportedTool('browser_resume', 'Resume debugger', 'Resume or step a paused debugging session'),
];
