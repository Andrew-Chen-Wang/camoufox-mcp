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

import * as javascript from '../javascript.js';
import { outputFile } from '../config.js';
import { defineTool } from './tool.js';

const storageState = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_storage_state',
    title: 'Save storage state',
    description: 'Save the current browser storage state to a file',
    inputSchema: z.object({
      filename: z.string().optional(),
    }),
    type: 'readOnly',
  },
  handle: async (context, params) => {
    const browserContext = await context.browserContext();
    const fileName = await outputFile(context.config, params.filename ?? `storage-state-${new Date().toISOString()}.json`);
    return {
      code: [`await context.storageState({ path: ${javascript.quote(fileName)} });`],
      action: async () => {
        await browserContext.storageState({ path: fileName });
        return { content: [{ type: 'text', text: fileName }] };
      },
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

const setStorageState = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_set_storage_state',
    title: 'Load storage state',
    description: 'Load browser storage state from a file',
    inputSchema: z.object({
      filename: z.string(),
    }),
    type: 'destructive',
  },
  handle: async (context, params) => {
    return {
      code: [`// Load storage state from ${params.filename}`],
      action: async () => {
        const browserContext = await context.browserContext();
        const page = context.currentTabOrDie().page;
        const state = JSON.parse(await fs.readFile(params.filename, 'utf8')) as { cookies?: any[]; origins?: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }> };
        await browserContext.clearCookies();
        if (state.cookies?.length)
          await browserContext.addCookies(state.cookies);
        for (const originState of state.origins ?? []) {
          await page.goto(originState.origin, { waitUntil: 'domcontentloaded' });
          await page.evaluate(entries => {
            localStorage.clear();
            for (const entry of entries)
              localStorage.setItem(entry.name, entry.value);
          }, originState.localStorage);
        }
      },
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});

const cookieList = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_cookie_list',
    title: 'List cookies',
    description: 'List cookies for the current browser context',
    inputSchema: z.object({
      domain: z.string().optional(),
      path: z.string().optional(),
    }),
    type: 'readOnly',
  },
  handle: async (context, params) => ({
    code: ['// <internal code to list cookies>'],
    action: async () => {
      const browserContext = await context.browserContext();
      const cookies = (await browserContext.cookies()).filter(cookie => {
        if (params.domain && cookie.domain !== params.domain)
          return false;
        if (params.path && cookie.path !== params.path)
          return false;
        return true;
      });
      return { content: [{ type: 'text', text: JSON.stringify(cookies, null, 2) }] };
    },
    captureSnapshot: false,
    waitForNetwork: false,
  }),
});

const cookieGet = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_cookie_get',
    title: 'Get cookie',
    description: 'Get a cookie by name',
    inputSchema: z.object({
      name: z.string(),
    }),
    type: 'readOnly',
  },
  handle: async (context, params) => ({
    code: ['// <internal code to get cookie>'],
    action: async () => {
      const browserContext = await context.browserContext();
      const cookie = (await browserContext.cookies()).find(entry => entry.name === params.name);
      return { content: [{ type: 'text', text: JSON.stringify(cookie ?? null, null, 2) }] };
    },
    captureSnapshot: false,
    waitForNetwork: false,
  }),
});

const cookieSet = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_cookie_set',
    title: 'Set cookie',
    description: 'Set a cookie in the current browser context',
    inputSchema: z.object({
      name: z.string(),
      value: z.string(),
      domain: z.string().optional(),
      path: z.string().optional(),
      expires: z.number().optional(),
      httpOnly: z.boolean().optional(),
      secure: z.boolean().optional(),
      sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
    }),
    type: 'destructive',
  },
  handle: async (context, params) => ({
    code: ['// <internal code to set cookie>'],
    action: async () => {
      const browserContext = await context.browserContext();
      const pageUrl = context.currentTabOrDie().page.url();
      const cookie: Record<string, any> = {
        ...params,
      };
      if (!cookie.domain) {
        if (!/^https?:/.test(pageUrl))
          throw new Error('cookie domain is required when the current page does not have an http(s) URL.');
        cookie.url = pageUrl;
      }
        await browserContext.addCookies([cookie as any]);
    },
    captureSnapshot: false,
    waitForNetwork: false,
  }),
});

const cookieDelete = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_cookie_delete',
    title: 'Delete cookie',
    description: 'Delete a cookie by name',
    inputSchema: z.object({
      name: z.string(),
    }),
    type: 'destructive',
  },
  handle: async (context, params) => ({
    code: ['// <internal code to delete cookie>'],
    action: async () => {
      const browserContext = await context.browserContext();
      const cookies = await browserContext.cookies();
      const remaining = cookies.filter(cookie => cookie.name !== params.name);
      await browserContext.clearCookies();
      if (remaining.length)
        await browserContext.addCookies(remaining.map(toSetCookie));
    },
    captureSnapshot: false,
    waitForNetwork: false,
  }),
});

const cookieClear = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_cookie_clear',
    title: 'Clear cookies',
    description: 'Clear all cookies',
    inputSchema: z.object({}),
    type: 'destructive',
  },
  handle: async context => ({
    code: ['// <internal code to clear cookies>'],
    action: async () => {
      const browserContext = await context.browserContext();
      await browserContext.clearCookies();
    },
    captureSnapshot: false,
    waitForNetwork: false,
  }),
});

function createWebStorageTools(kind: 'localStorage' | 'sessionStorage') {
  const prefix = kind === 'localStorage' ? 'browser_localstorage_' : 'browser_sessionstorage_';
  const titlePrefix = kind === 'localStorage' ? 'localStorage' : 'sessionStorage';

  const list = defineTool({
    capability: 'core',
    schema: {
      name: `${prefix}list`,
      title: `List ${titlePrefix}`,
      description: `List all ${titlePrefix} key-value pairs`,
      inputSchema: z.object({}),
      type: 'readOnly',
    },
    handle: async context => ({
      code: [`// <internal code to list ${titlePrefix}>`],
      action: async () => {
        const page = context.currentTabOrDie().page;
        const result = await page.evaluate(storageKind => Object.fromEntries(Array.from((window as any)[storageKind].entries()) as Array<[string, string]>), kind);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
      captureSnapshot: false,
      waitForNetwork: false,
    }),
  });

  const get = defineTool({
    capability: 'core',
    schema: {
      name: `${prefix}get`,
      title: `Get ${titlePrefix} item`,
      description: `Get a ${titlePrefix} item by key`,
      inputSchema: z.object({
        key: z.string(),
      }),
      type: 'readOnly',
    },
    handle: async (context, params) => ({
      code: [`// <internal code to get ${titlePrefix} item>`],
      action: async () => {
        const page = context.currentTabOrDie().page;
        const value = await page.evaluate(({ storageKind, key }) => window[storageKind].getItem(key), { storageKind: kind, key: params.key });
        return { content: [{ type: 'text', text: value ?? '' }] };
      },
      captureSnapshot: false,
      waitForNetwork: false,
    }),
  });

  const set = defineTool({
    capability: 'core',
    schema: {
      name: `${prefix}set`,
      title: `Set ${titlePrefix} item`,
      description: `Set a ${titlePrefix} item`,
      inputSchema: z.object({
        key: z.string(),
        value: z.string(),
      }),
      type: 'destructive',
    },
    handle: async (context, params) => ({
      code: [`// <internal code to set ${titlePrefix} item>`],
      action: async () => {
        const page = context.currentTabOrDie().page;
        await page.evaluate(({ storageKind, key, value }) => window[storageKind].setItem(key, value), { storageKind: kind, key: params.key, value: params.value });
      },
      captureSnapshot: false,
      waitForNetwork: false,
    }),
  });

  const del = defineTool({
    capability: 'core',
    schema: {
      name: `${prefix}delete`,
      title: `Delete ${titlePrefix} item`,
      description: `Delete a ${titlePrefix} item`,
      inputSchema: z.object({
        key: z.string(),
      }),
      type: 'destructive',
    },
    handle: async (context, params) => ({
      code: [`// <internal code to delete ${titlePrefix} item>`],
      action: async () => {
        const page = context.currentTabOrDie().page;
        await page.evaluate(({ storageKind, key }) => window[storageKind].removeItem(key), { storageKind: kind, key: params.key });
      },
      captureSnapshot: false,
      waitForNetwork: false,
    }),
  });

  const clear = defineTool({
    capability: 'core',
    schema: {
      name: `${prefix}clear`,
      title: `Clear ${titlePrefix}`,
      description: `Clear all ${titlePrefix}`,
      inputSchema: z.object({}),
      type: 'destructive',
    },
    handle: async context => ({
      code: [`// <internal code to clear ${titlePrefix}>`],
      action: async () => {
        const page = context.currentTabOrDie().page;
        await page.evaluate(storageKind => window[storageKind].clear(), kind);
      },
      captureSnapshot: false,
      waitForNetwork: false,
    }),
  });

  return [list, get, set, del, clear];
}

function toSetCookie(cookie: any): any {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    expires: cookie.expires,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
  };
}

export default [
  storageState,
  setStorageState,
  cookieList,
  cookieGet,
  cookieSet,
  cookieDelete,
  cookieClear,
  ...createWebStorageTools('localStorage'),
  ...createWebStorageTools('sessionStorage'),
];
