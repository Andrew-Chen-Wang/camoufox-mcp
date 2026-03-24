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
const networkRequests = defineTool({
    capability: 'core',
    schema: {
        name: 'browser_network_requests',
        title: 'List network requests',
        description: 'Returns all network requests since loading the page',
        inputSchema: z.object({
            static: z.boolean().optional().describe('Include static resources like images, scripts, fonts, and stylesheets'),
            requestBody: z.boolean().optional().describe('Include request body'),
            requestHeaders: z.boolean().optional().describe('Include request headers'),
            filter: z.string().optional().describe('Only include requests whose URL matches this regular expression'),
        }),
        type: 'readOnly',
    },
    handle: async (context, params) => {
        const entries = [...context.currentTabOrDie().requests().entries()]
            .filter(([request, response]) => includeRequest(request, response, !!params.static, params.filter));
        const log = entries.map(([request, response]) => renderRequest(request, response, !!params.requestBody, !!params.requestHeaders)).join('\n\n');
        return {
            code: ['// <internal code to list network requests>'],
            action: async () => ({ content: [{ type: 'text', text: log }] }),
            captureSnapshot: false,
            waitForNetwork: false,
        };
    },
});
const networkClear = defineTool({
    capability: 'core',
    schema: {
        name: 'browser_network_clear',
        title: 'Clear network requests',
        description: 'Clear the collected network request log',
        inputSchema: z.object({}),
        type: 'destructive',
    },
    handle: async (context) => {
        context.currentTabOrDie().clearRequests();
        return {
            code: ['// <internal code to clear network requests>'],
            captureSnapshot: false,
            waitForNetwork: false,
        };
    },
});
const route = defineTool({
    capability: 'core',
    schema: {
        name: 'browser_route',
        title: 'Mock route',
        description: 'Mock network requests matching a URL pattern',
        inputSchema: z.object({
            pattern: z.string(),
            status: z.number().optional(),
            body: z.string().optional(),
            contentType: z.string().optional(),
            headers: z.array(z.string()).optional(),
            removeHeaders: z.array(z.string()).optional(),
        }),
        type: 'destructive',
    },
    handle: async (context, params) => ({
        code: ['// <internal code to add route>'],
        action: async () => {
            await context.addRouteRule(params.pattern, async (route) => {
                const headers = parseHeaders(params.headers);
                if (params.removeHeaders) {
                    for (const name of params.removeHeaders)
                        delete headers[name.toLowerCase()];
                }
                if (params.contentType)
                    headers['content-type'] = params.contentType;
                await route.fulfill({
                    status: params.status ?? 200,
                    body: params.body ?? '',
                    headers,
                });
            });
        },
        captureSnapshot: false,
        waitForNetwork: false,
    }),
});
const routeList = defineTool({
    capability: 'core',
    schema: {
        name: 'browser_route_list',
        title: 'List routes',
        description: 'List active network route patterns',
        inputSchema: z.object({}),
        type: 'readOnly',
    },
    handle: async (context) => ({
        code: ['// <internal code to list routes>'],
        action: async () => ({ content: [{ type: 'text', text: context.listRouteRules().join('\n') }] }),
        captureSnapshot: false,
        waitForNetwork: false,
    }),
});
const unroute = defineTool({
    capability: 'core',
    schema: {
        name: 'browser_unroute',
        title: 'Remove routes',
        description: 'Remove route mocks matching a pattern, or all routes',
        inputSchema: z.object({
            pattern: z.string().optional(),
        }),
        type: 'destructive',
    },
    handle: async (context, params) => ({
        code: ['// <internal code to remove routes>'],
        action: async () => {
            await context.removeRouteRule(params.pattern);
        },
        captureSnapshot: false,
        waitForNetwork: false,
    }),
});
const networkState = defineTool({
    capability: 'core',
    schema: {
        name: 'browser_network_state_set',
        title: 'Set network state',
        description: 'Set the browser network state to online or offline',
        inputSchema: z.object({
            state: z.enum(['online', 'offline']),
        }),
        type: 'destructive',
    },
    handle: async (context, params) => ({
        code: [`// Set network state to ${params.state}`],
        action: async () => {
            await context.setNetworkOffline(params.state === 'offline');
        },
        captureSnapshot: false,
        waitForNetwork: false,
    }),
});
function includeRequest(request, response, includeStatic, filter) {
    if (filter && !(new RegExp(filter).test(request.url())))
        return false;
    if (includeStatic)
        return true;
    const staticTypes = new Set(['image', 'media', 'font', 'stylesheet', 'script']);
    if (response && response.ok() && staticTypes.has(request.resourceType()))
        return false;
    return true;
}
function renderRequest(request, response, includeBody, includeHeaders) {
    const result = [];
    result.push(`[${request.method().toUpperCase()}] ${request.url()}`);
    if (response)
        result.push(`=> [${response.status()}] ${response.statusText()}`);
    if (includeHeaders)
        result.push(`headers: ${JSON.stringify(request.headers(), null, 2)}`);
    if (includeBody) {
        const body = request.postData();
        if (body)
            result.push(`body: ${body}`);
    }
    return result.join('\n');
}
function parseHeaders(headers) {
    const result = {};
    for (const entry of headers ?? []) {
        const separator = entry.indexOf(':');
        if (separator === -1)
            continue;
        result[entry.slice(0, separator).trim().toLowerCase()] = entry.slice(separator + 1).trim();
    }
    return result;
}
export default [
    networkRequests,
    networkClear,
    route,
    routeList,
    unroute,
    networkState,
];
