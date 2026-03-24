import type http from "node:http";

import type { BrowserContext } from "playwright-core";
import type { Config } from "./config.js";

export type CreateMCPHTTPServerOptions = {
  config?: Config;
  headless?: boolean;
  host?: string;
  port?: number;
};

export declare function createConnection(
  config?: Config,
  contextGetter?: () => Promise<BrowserContext>,
): Promise<import("@modelcontextprotocol/sdk/server/index.js").Server>;

export declare function createMCPHTTPServer(
  options?: CreateMCPHTTPServerOptions,
): Promise<http.Server>;

export type { Config } from "./config.js";
