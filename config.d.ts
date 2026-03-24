import type * as playwright from "playwright-core";
export type ToolCapability =
  | "core"
  | "tabs"
  | "pdf"
  | "history"
  | "wait"
  | "files"
  | "install"
  | "testing";

export type Config = {
  browser?: {
    browserAgent?: string;
    browserName?: "chromium" | "firefox" | "webkit";
    isolated?: boolean;
    userDataDir?: string;
    launchOptions?: playwright.LaunchOptions & Record<string, any>;
    contextOptions?: playwright.BrowserContextOptions;
    cdpEndpoint?: string;
    remoteEndpoint?: string;
  };
  server?: {
    port?: number;
    host?: string;
  };
  capabilities?: ToolCapability[];
  vision?: boolean;
  saveTrace?: boolean;
  saveVideo?: {
    width: number;
    height: number;
  };
  allowUnrestrictedFileAccess?: boolean;
  outputDir?: string;
  network?: {
    allowedOrigins?: string[];
    blockedOrigins?: string[];
  };
  imageResponses?: "allow" | "omit" | "auto";
};
