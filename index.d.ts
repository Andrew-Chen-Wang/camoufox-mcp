import type http from "node:http";
import type * as playwright from "playwright";

export type ToolCapability =
  | "config"
  | "core"
  | "core-navigation"
  | "core-tabs"
  | "core-input"
  | "core-install"
  | "network"
  | "pdf"
  | "storage"
  | "testing"
  | "vision"
  | "devtools";

export type Config = {
  browser?: {
    browserName?: "chromium" | "firefox" | "webkit";
    isolated?: boolean;
    userDataDir?: string;
    launchOptions?: playwright.LaunchOptions & Record<string, any>;
    contextOptions?: playwright.BrowserContextOptions;
    cdpEndpoint?: string;
    cdpHeaders?: Record<string, string>;
    cdpTimeout?: number;
    remoteEndpoint?: string;
    initPage?: string[];
    initScript?: string[];
  };
  extension?: boolean;
  server?: {
    port?: number;
    host?: string;
    allowedHosts?: string[];
  };
  capabilities?: ToolCapability[];
  saveSession?: boolean;
  vision?: boolean;
  saveTrace?: boolean;
  saveVideo?: {
    width: number;
    height: number;
  };
  sharedBrowserContext?: boolean;
  secrets?: Record<string, string>;
  allowUnrestrictedFileAccess?: boolean;
  outputDir?: string;
  outputMode?: "file" | "stdout";
  console?: {
    level?: "error" | "warning" | "info" | "debug";
  };
  network?: {
    allowedOrigins?: string[];
    blockedOrigins?: string[];
  };
  testIdAttribute?: string;
  timeouts?: {
    action?: number;
    navigation?: number;
  };
  imageResponses?: "allow" | "omit";
  snapshot?: {
    mode?: "incremental" | "full" | "none";
  };
  codegen?: "typescript" | "none";
};

export type CreateMCPHTTPServerOptions = {
  config?: Config;
  headless?: boolean;
  host?: string;
  port?: number;
};

export declare function createConnection(
  config?: Config,
  contextGetter?: () => Promise<playwright.BrowserContext>,
): Promise<import("@playwright/mcp").createConnection extends (...args: any[]) => Promise<infer T> ? T : never>;

export declare function createMCPHTTPServer(
  options?: CreateMCPHTTPServerOptions,
): Promise<http.Server>;
