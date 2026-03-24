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

const moveMouse: ToolFactory = captureSnapshot => defineTool({
  capability: 'core',
  schema: {
    name: 'browser_mouse_move',
    title: 'Move mouse',
    description: 'Move the mouse to page coordinates',
    inputSchema: z.object({
      x: z.number(),
      y: z.number(),
      steps: z.number().optional(),
    }),
    type: 'destructive',
  },
  handle: async (context, params) => {
    const page = context.currentTabOrDie().page;
    return {
      code: [
        `// Move mouse to (${params.x}, ${params.y})`,
        `await page.mouse.move(${params.x}, ${params.y}${params.steps !== undefined ? `, { steps: ${params.steps} }` : ''});`,
      ],
      action: () => page.mouse.move(params.x, params.y, params.steps !== undefined ? { steps: params.steps } : undefined),
      captureSnapshot,
      waitForNetwork: false,
    };
  },
});

const moveMouseCompat: ToolFactory = captureSnapshot => defineTool({
  capability: 'core',
  schema: {
    name: 'browser_mouse_move_xy',
    title: 'Move mouse',
    description: 'Move the mouse to page coordinates',
    inputSchema: z.object({
      x: z.number(),
      y: z.number(),
    }),
    type: 'destructive',
  },
  handle: async (context, params) => moveMouse(captureSnapshot).handle(context, params),
});

function defineMouseButtonTool(name: 'browser_mouse_down' | 'browser_mouse_up', title: string, actionName: 'down' | 'up') {
  return defineTool({
    capability: 'core',
    schema: {
      name,
      title,
      description: `${title} at the current mouse location`,
      inputSchema: z.object({
        button: z.enum(['left', 'middle', 'right']).optional(),
        clickCount: z.number().optional(),
      }),
      type: 'destructive' as const,
    },
    handle: async (context, params) => {
      const page = context.currentTabOrDie().page;
      const options = { button: params.button, clickCount: params.clickCount };
      return {
        code: [
          `// Mouse ${actionName}`,
          `await page.mouse.${actionName}(${Object.values(options).some(v => v !== undefined) ? `{ button: '${params.button ?? 'left'}'${params.clickCount !== undefined ? `, clickCount: ${params.clickCount}` : ''} }` : ''});`,
        ],
        action: () => page.mouse[actionName](options),
        captureSnapshot: true,
        waitForNetwork: false,
      };
    },
  });
}

const mouseDown = defineMouseButtonTool('browser_mouse_down', 'Mouse down', 'down');
const mouseUp = defineMouseButtonTool('browser_mouse_up', 'Mouse up', 'up');

const mouseWheel: ToolFactory = captureSnapshot => defineTool({
  capability: 'core',
  schema: {
    name: 'browser_mouse_wheel',
    title: 'Mouse wheel',
    description: 'Scroll using the mouse wheel',
    inputSchema: z.object({
      deltaX: z.number(),
      deltaY: z.number(),
    }),
    type: 'destructive',
  },
  handle: async (context, params) => {
    const page = context.currentTabOrDie().page;
    return {
      code: [
        `// Mouse wheel by (${params.deltaX}, ${params.deltaY})`,
        `await page.mouse.wheel(${params.deltaX}, ${params.deltaY});`,
      ],
      action: () => page.mouse.wheel(params.deltaX, params.deltaY),
      captureSnapshot,
      waitForNetwork: false,
    };
  },
});

export default (captureSnapshot: boolean) => [
  moveMouse(captureSnapshot),
  moveMouseCompat(captureSnapshot),
  mouseDown,
  mouseUp,
  mouseWheel(captureSnapshot),
];
