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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import debug from 'debug';
import { launchOptions as createCamoufoxLaunchOptions } from 'camoufox-js';
import { firefox } from 'playwright-core';
const testDebug = debug('camoufox:mcp:test');
export function contextFactory(browserConfig) {
    if (browserConfig.remoteEndpoint)
        return new RemoteContextFactory(browserConfig);
    if (browserConfig.cdpEndpoint)
        return new CdpContextFactory(browserConfig);
    if (browserConfig.isolated)
        return new IsolatedContextFactory(browserConfig);
    return new PersistentContextFactory(browserConfig);
}
class BaseContextFactory {
    browserConfig;
    _browserPromise;
    name;
    constructor(name, browserConfig) {
        this.name = name;
        this.browserConfig = browserConfig;
    }
    async _obtainBrowser() {
        if (this._browserPromise)
            return this._browserPromise;
        testDebug(`obtain browser (${this.name})`);
        this._browserPromise = this._doObtainBrowser();
        void this._browserPromise.then(browser => {
            browser.on('disconnected', () => {
                this._browserPromise = undefined;
            });
        }).catch(() => {
            this._browserPromise = undefined;
        });
        return this._browserPromise;
    }
    async _doObtainBrowser() {
        throw new Error('Not implemented');
    }
    async createContext() {
        testDebug(`create browser context (${this.name})`);
        const browser = await this._obtainBrowser();
        const browserContext = await this._doCreateContext(browser);
        return { browserContext, close: () => this._closeBrowserContext(browserContext, browser) };
    }
    async _doCreateContext(browser) {
        throw new Error('Not implemented');
    }
    async _closeBrowserContext(browserContext, browser) {
        testDebug(`close browser context (${this.name})`);
        if (browser.contexts().length === 1)
            this._browserPromise = undefined;
        await browserContext.close().catch(() => { });
        if (browser.contexts().length === 0) {
            testDebug(`close browser (${this.name})`);
            await browser.close().catch(() => { });
        }
    }
}
class IsolatedContextFactory extends BaseContextFactory {
    constructor(browserConfig) {
        super('isolated', browserConfig);
    }
    async _doObtainBrowser() {
        return firefox.launch({
            ...(await toCamoufoxLaunchOptions(this.browserConfig)),
            handleSIGINT: false,
            handleSIGTERM: false,
        }).catch(error => {
            if (String(error.message).includes('Executable doesn\'t exist'))
                throw new Error('Camoufox is not installed. Run `npx camoufox-js fetch` and retry.');
            throw error;
        });
    }
    async _doCreateContext(browser) {
        return browser.newContext(this.browserConfig.contextOptions);
    }
}
class CdpContextFactory extends BaseContextFactory {
    constructor(browserConfig) {
        super('cdp', browserConfig);
    }
    async _doObtainBrowser() {
        throw new Error('camoufox-mcp does not support cdpEndpoint because Camoufox is Firefox-based.');
    }
    async _doCreateContext() {
        throw new Error('Not implemented');
    }
}
class RemoteContextFactory extends BaseContextFactory {
    constructor(browserConfig) {
        super('remote', browserConfig);
    }
    async _doObtainBrowser() {
        return firefox.connect(this.browserConfig.remoteEndpoint);
    }
    async _doCreateContext(browser) {
        return browser.newContext(this.browserConfig.contextOptions);
    }
}
class PersistentContextFactory {
    browserConfig;
    _userDataDirs = new Set();
    constructor(browserConfig) {
        this.browserConfig = browserConfig;
    }
    async createContext() {
        testDebug('create browser context (persistent)');
        const userDataDir = this.browserConfig.userDataDir ?? await this._createUserDataDir();
        this._userDataDirs.add(userDataDir);
        testDebug('lock user data dir', userDataDir);
        for (let i = 0; i < 5; i++) {
            try {
                const browserContext = await firefox.launchPersistentContext(userDataDir, {
                    ...(await toCamoufoxLaunchOptions(this.browserConfig)),
                    ...this.browserConfig.contextOptions,
                    handleSIGINT: false,
                    handleSIGTERM: false,
                });
                const close = () => this._closeBrowserContext(browserContext, userDataDir);
                return { browserContext, close };
            }
            catch (error) {
                if (String(error.message).includes('Executable doesn\'t exist'))
                    throw new Error('Camoufox is not installed. Run `npx camoufox-js fetch` and retry.');
                if (String(error.message).includes('ProcessSingleton') || String(error.message).includes('Invalid URL')) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
                throw error;
            }
        }
        throw new Error(`Browser is already in use for ${userDataDir}, use --isolated to run multiple instances of the same browser`);
    }
    async _closeBrowserContext(browserContext, userDataDir) {
        testDebug('close browser context (persistent)');
        testDebug('release user data dir', userDataDir);
        await browserContext.close().catch(() => { });
        this._userDataDirs.delete(userDataDir);
        testDebug('close browser context complete (persistent)');
    }
    async _createUserDataDir() {
        let cacheDirectory;
        if (process.platform === 'linux')
            cacheDirectory = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
        else if (process.platform === 'darwin')
            cacheDirectory = path.join(os.homedir(), 'Library', 'Caches');
        else if (process.platform === 'win32')
            cacheDirectory = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
        else
            throw new Error('Unsupported platform: ' + process.platform);
        const result = path.join(cacheDirectory, 'camoufox-mcp', `mcp-${this.browserConfig.launchOptions?.channel ?? this.browserConfig?.browserName}-profile`);
        await fs.promises.mkdir(result, { recursive: true });
        return result;
    }
}
async function toCamoufoxLaunchOptions(browserConfig) {
    return createCamoufoxLaunchOptions({
        ...browserConfig.launchOptions,
    });
}
