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

import * as javascript from '../javascript.js';
import { defineTool } from './tool.js';
import { generateLocator } from './utils.js';

const fillForm = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_fill_form',
    title: 'Fill form',
    description: 'Fill multiple form fields',
    inputSchema: z.object({
      fields: z.array(z.object({
        name: z.string().describe('Human-readable field name'),
        type: z.enum(['textbox', 'checkbox', 'radio', 'combobox', 'slider']).describe('Type of the field'),
        ref: z.string().describe('Exact target field reference from the page snapshot'),
        value: z.string().describe('Value to fill in the field'),
      })),
    }),
    type: 'destructive',
  },
  handle: async (context, params) => {
    const snapshot = context.currentTabOrDie().snapshotOrDie();
    const code: string[] = [];
    const steps: Array<() => Promise<void>> = [];

    for (const field of params.fields) {
      const locator = snapshot.refLocator({ element: field.name, ref: field.ref });
      const locatorString = await generateLocator(locator);
      if (field.type === 'textbox' || field.type === 'slider') {
        code.push(`await page.${locatorString}.fill(${javascript.quote(field.value)});`);
        steps.push(() => locator.fill(field.value));
      } else if (field.type === 'checkbox' || field.type === 'radio') {
        const shouldCheck = field.value === 'true';
        code.push(`await page.${locatorString}.${shouldCheck ? 'check' : 'uncheck'}();`);
        steps.push(() => shouldCheck ? locator.check() : locator.uncheck());
      } else {
        code.push(`await page.${locatorString}.selectOption({ label: ${javascript.quote(field.value)} });`);
        steps.push(() => locator.selectOption({ label: field.value }).then(() => {}));
      }
    }

    return {
      code,
      action: () => steps.reduce((promise, step) => promise.then(step), Promise.resolve()),
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});

export default [
  fillForm,
];
