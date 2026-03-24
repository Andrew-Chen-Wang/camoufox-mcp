# camoufox-mcp

A [Camoufox](https://camoufox.com/)-backed MCP (Model Context Protocol) browser automation server. Drop-in replacement for [`@playwright/mcp`](https://github.com/nichochar/playwright-mcp) that uses Camoufox's anti-fingerprinting Firefox browser instead of stock Chromium/Firefox.

## Why

Standard browser automation is trivially detected by anti-bot systems. Camoufox patches Firefox to rotate and mask browser fingerprints, making automated sessions look like real users. This package wraps `@playwright/mcp` so you get the full MCP tool surface (navigation, clicking, screenshots, network interception, etc.) with Camoufox under the hood.

## Installation

```bash
npm install @andrew-chen-wang/camoufox-mcp
```

Camoufox will be downloaded automatically on first launch via `camoufox-js`.

Requires Node.js >= 18.

## Quick start

### As an MCP HTTP server

```js
import { createMCPHTTPServer } from '@andrew-chen-wang/camoufox-mcp';

const server = await createMCPHTTPServer({ port: 3000 });
const addr = server.address();
console.log(`MCP server listening on http://${addr.address}:${addr.port}`);
```

Point any MCP client at the server URL. Each MCP session gets its own Camoufox browser context.

### Programmatic connection

```js
import { createConnection } from '@andrew-chen-wang/camoufox-mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const connection = await createConnection({
  browser: {
    launchOptions: { headless: true },
  },
});

const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
await connection.connect(transport);
```

### With a custom browser context

```js
import { createConnection } from '@andrew-chen-wang/camoufox-mcp';
import { firefox } from 'playwright';
import { launchOptions } from 'camoufox-js';

const browser = await firefox.launch(await launchOptions({ headless: true }));
const context = await browser.newContext();

const connection = await createConnection({}, async () => context);
```

## Configuration

`createConnection` and `createMCPHTTPServer` accept a `Config` object:

| Option | Type | Description |
|---|---|---|
| `browser.isolated` | `boolean` | Use a fresh context per session instead of a persistent profile (default: `false`) |
| `browser.userDataDir` | `string` | Path to a persistent Firefox profile directory |
| `browser.launchOptions` | `object` | Playwright [LaunchOptions](https://playwright.dev/docs/api/class-browsertype#browser-type-launch) passed through to Camoufox |
| `browser.contextOptions` | `object` | Playwright [BrowserContextOptions](https://playwright.dev/docs/api/class-browser#browser-new-context) |
| `browser.remoteEndpoint` | `string` | Connect to a running browser via WebSocket |
| `capabilities` | `string[]` | Restrict exposed MCP tools (e.g. `["core", "vision"]`) |
| `vision` | `boolean` | Enable screenshot-based tools |
| `saveTrace` | `boolean` | Save Playwright traces to `outputDir/traces` |
| `saveVideo` | `{ width, height }` | Record video of sessions to `outputDir/videos` |
| `outputDir` | `string` | Base directory for traces/videos (defaults to a temp dir) |
| `secrets` | `Record<string, string>` | Secrets available to the MCP session |
| `network.allowedOrigins` | `string[]` | Restrict which origins the browser can access |
| `network.blockedOrigins` | `string[]` | Block specific origins |

See [`index.d.ts`](./index.d.ts) for the full type definition.

## Limitations

- **Firefox only** -- Camoufox is Firefox-based, so Chromium/WebKit are not supported.
- **No CDP** -- `cdpEndpoint` is not available (Firefox does not use the Chrome DevTools Protocol).
- **No extension mode** -- browser extensions are not supported.

## License

[Apache-2.0](./LICENSE)
