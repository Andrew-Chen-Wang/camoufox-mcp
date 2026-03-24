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
import * as javascript from '../javascript.js';
import { generateLocator, resolveLocator } from './utils.js';
const snapshot = defineTool({
    capability: 'core',
    schema: {
        name: 'browser_snapshot',
        title: 'Page snapshot',
        description: 'Capture accessibility snapshot of the current page, this is better than screenshot',
        inputSchema: z.object({
            filename: z.string().optional().describe('Ignored compatibility field accepted for Playwright CLI parity.'),
            selector: z.string().optional().describe('Ignored compatibility field accepted for Playwright CLI parity.'),
            depth: z.number().optional().describe('Ignored compatibility field accepted for Playwright CLI parity.'),
        }),
        type: 'readOnly',
    },
    handle: async (context) => {
        await context.ensureTab();
        return {
            code: ['// <internal code to capture accessibility snapshot>'],
            captureSnapshot: true,
            waitForNetwork: false,
        };
    },
});
const elementBaseSchema = z.object({
    element: z.string().optional().describe('Optional human-readable element description'),
    ref: z.string().optional().describe('Exact target element reference from the page snapshot'),
    selector: z.string().optional().describe('Selector for the target element'),
});
const elementSchema = elementBaseSchema.refine(value => !!value.ref !== !!value.selector, {
    message: 'Provide exactly one of ref or selector.',
    path: ['ref'],
});
const click = defineTool({
    capability: 'core',
    schema: {
        name: 'browser_click',
        title: 'Click',
        description: 'Perform click on a web page',
        inputSchema: elementBaseSchema.extend({
            button: z.enum(['left', 'middle', 'right']).optional(),
            modifiers: z.array(z.enum(['Alt', 'Control', 'ControlOrMeta', 'Meta', 'Shift'])).optional(),
            doubleClick: z.boolean().optional(),
        }).refine(value => !!value.ref !== !!value.selector, {
            message: 'Provide exactly one of ref or selector.',
            path: ['ref'],
        }),
        type: 'destructive',
    },
    handle: async (context, params) => {
        const tab = context.currentTabOrDie();
        const locator = resolveLocator(tab, params);
        const options = {
            button: params.button,
            modifiers: params.modifiers,
        };
        return {
            code: [
                `// Click ${params.element ?? params.selector ?? params.ref}`,
                `await page.${await generateLocator(locator)}.${params.doubleClick ? 'dblclick' : 'click'}(${javascript.formatObject(options)});`,
            ],
            action: () => params.doubleClick ? locator.dblclick(options) : locator.click(options),
            captureSnapshot: true,
            waitForNetwork: true,
        };
    },
});
const doubleClick = defineTool({
    capability: 'core',
    schema: {
        name: 'browser_double_click',
        title: 'Double click',
        description: 'Perform double click on a web page',
        inputSchema: elementSchema,
        type: 'destructive',
    },
    handle: async (context, params) => {
        const tab = context.currentTabOrDie();
        const locator = resolveLocator(tab, params);
        return {
            code: [
                `// Double click ${params.element ?? params.selector ?? params.ref}`,
                `await page.${await generateLocator(locator)}.dblclick();`,
            ],
            action: () => locator.dblclick(),
            captureSnapshot: true,
            waitForNetwork: true,
        };
    },
});
const drag = defineTool({
    capability: 'core',
    schema: {
        name: 'browser_drag',
        title: 'Drag mouse',
        description: 'Perform drag and drop between two elements',
        inputSchema: z.object({
            startElement: z.string().optional().describe('Optional human-readable source element description'),
            startRef: z.string().optional().describe('Exact source element reference from the page snapshot'),
            startSelector: z.string().optional().describe('Selector for the source element'),
            endElement: z.string().optional().describe('Optional human-readable target element description'),
            endRef: z.string().optional().describe('Exact target element reference from the page snapshot'),
            endSelector: z.string().optional().describe('Selector for the target element'),
        }).refine(value => !!value.startRef !== !!value.startSelector, {
            message: 'Provide exactly one of startRef or startSelector.',
            path: ['startRef'],
        }).refine(value => !!value.endRef !== !!value.endSelector, {
            message: 'Provide exactly one of endRef or endSelector.',
            path: ['endRef'],
        }),
        type: 'destructive',
    },
    handle: async (context, params) => {
        const tab = context.currentTabOrDie();
        const startLocator = resolveLocator(tab, { element: params.startElement, ref: params.startRef, selector: params.startSelector });
        const endLocator = resolveLocator(tab, { element: params.endElement, ref: params.endRef, selector: params.endSelector });
        return {
            code: [
                `// Drag ${params.startElement ?? params.startSelector ?? params.startRef} to ${params.endElement ?? params.endSelector ?? params.endRef}`,
                `await page.${await generateLocator(startLocator)}.dragTo(page.${await generateLocator(endLocator)});`,
            ],
            action: () => startLocator.dragTo(endLocator),
            captureSnapshot: true,
            waitForNetwork: true,
        };
    },
});
const hover = defineTool({
    capability: 'core',
    schema: {
        name: 'browser_hover',
        title: 'Hover mouse',
        description: 'Hover over element on page',
        inputSchema: elementSchema,
        type: 'readOnly',
    },
    handle: async (context, params) => {
        const tab = context.currentTabOrDie();
        const locator = resolveLocator(tab, params);
        return {
            code: [
                `// Hover over ${params.element ?? params.selector ?? params.ref}`,
                `await page.${await generateLocator(locator)}.hover();`,
            ],
            action: () => locator.hover(),
            captureSnapshot: true,
            waitForNetwork: true,
        };
    },
});
const fill = defineTool({
    capability: 'core',
    schema: {
        name: 'browser_fill',
        title: 'Fill text',
        description: 'Fill text into editable element',
        inputSchema: elementBaseSchema.extend({
            text: z.string().describe('Text to fill into the element'),
        }).refine(value => !!value.ref !== !!value.selector, {
            message: 'Provide exactly one of ref or selector.',
            path: ['ref'],
        }),
        type: 'destructive',
    },
    handle: async (context, params) => {
        const tab = context.currentTabOrDie();
        const locator = resolveLocator(tab, params);
        return {
            code: [
                `// Fill "${params.text}" into "${params.element ?? params.selector ?? params.ref}"`,
                `await page.${await generateLocator(locator)}.fill(${javascript.quote(params.text)});`,
            ],
            action: () => locator.fill(params.text),
            captureSnapshot: true,
            waitForNetwork: true,
        };
    },
});
const typeSchema = elementBaseSchema.extend({
    text: z.string().describe('Text to type into the element'),
    submit: z.boolean().optional().describe('Whether to submit entered text (press Enter after)'),
    slowly: z.boolean().optional().describe('Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.'),
}).refine(value => !!value.ref !== !!value.selector, {
    message: 'Provide exactly one of ref or selector.',
    path: ['ref'],
});
const type = defineTool({
    capability: 'core',
    schema: {
        name: 'browser_type',
        title: 'Type text',
        description: 'Type text into editable element',
        inputSchema: typeSchema,
        type: 'destructive',
    },
    handle: async (context, params) => {
        const tab = context.currentTabOrDie();
        const locator = resolveLocator(tab, params);
        const code = [];
        const steps = [];
        if (params.slowly) {
            code.push(`// Press "${params.text}" sequentially into "${params.element ?? params.selector ?? params.ref}"`);
            code.push(`await page.${await generateLocator(locator)}.pressSequentially(${javascript.quote(params.text)});`);
            steps.push(() => locator.pressSequentially(params.text));
        }
        else {
            code.push(`// Fill "${params.text}" into "${params.element ?? params.selector ?? params.ref}"`);
            code.push(`await page.${await generateLocator(locator)}.fill(${javascript.quote(params.text)});`);
            steps.push(() => locator.fill(params.text));
        }
        if (params.submit) {
            code.push('// Submit text');
            code.push(`await page.${await generateLocator(locator)}.press('Enter');`);
            steps.push(() => locator.press('Enter'));
        }
        return {
            code,
            action: () => steps.reduce((acc, step) => acc.then(step), Promise.resolve()),
            captureSnapshot: true,
            waitForNetwork: true,
        };
    },
});
const selectOption = defineTool({
    capability: 'core',
    schema: {
        name: 'browser_select_option',
        title: 'Select option',
        description: 'Select an option in a dropdown',
        inputSchema: elementBaseSchema.extend({
            values: z.array(z.string()).describe('Array of values to select in the dropdown. This can be a single value or multiple values.'),
        }).refine(value => !!value.ref !== !!value.selector, {
            message: 'Provide exactly one of ref or selector.',
            path: ['ref'],
        }),
        type: 'destructive',
    },
    handle: async (context, params) => {
        const tab = context.currentTabOrDie();
        const locator = resolveLocator(tab, params);
        return {
            code: [
                `// Select options [${params.values.join(', ')}] in ${params.element ?? params.selector ?? params.ref}`,
                `await page.${await generateLocator(locator)}.selectOption(${javascript.formatObject(params.values)});`,
            ],
            action: () => locator.selectOption(params.values).then(() => { }),
            captureSnapshot: true,
            waitForNetwork: true,
        };
    },
});
function defineCheckTool(name, title, checked) {
    return defineTool({
        capability: 'core',
        schema: {
            name,
            title,
            description: checked ? 'Check a checkbox or radio input' : 'Uncheck a checkbox input',
            inputSchema: elementSchema,
            type: 'destructive',
        },
        handle: async (context, params) => {
            const tab = context.currentTabOrDie();
            const locator = resolveLocator(tab, params);
            return {
                code: [
                    `// ${checked ? 'Check' : 'Uncheck'} ${params.element ?? params.selector ?? params.ref}`,
                    `await page.${await generateLocator(locator)}.${checked ? 'check' : 'uncheck'}();`,
                ],
                action: () => checked ? locator.check() : locator.uncheck(),
                captureSnapshot: true,
                waitForNetwork: true,
            };
        },
    });
}
const check = defineCheckTool('browser_check', 'Check element', true);
const uncheck = defineCheckTool('browser_uncheck', 'Uncheck element', false);
export default [
    snapshot,
    click,
    doubleClick,
    drag,
    hover,
    fill,
    type,
    selectOption,
    check,
    uncheck,
];
