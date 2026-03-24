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
import common from './tools/common.js';
import console from './tools/console.js';
import devtools from './tools/devtools.js';
import dialogs from './tools/dialogs.js';
import files from './tools/files.js';
import forms from './tools/forms.js';
import install from './tools/install.js';
import keyboard from './tools/keyboard.js';
import mouse from './tools/mouse.js';
import navigate from './tools/navigate.js';
import network from './tools/network.js';
import pdf from './tools/pdf.js';
import snapshot from './tools/snapshot.js';
import storage from './tools/storage.js';
import tabs from './tools/tabs.js';
import screenshot from './tools/screenshot.js';
import testing from './tools/testing.js';
import vision from './tools/vision.js';
import wait from './tools/wait.js';
export const snapshotTools = [
    ...common(true),
    ...console,
    ...dialogs(true),
    ...files(true),
    ...forms,
    ...install,
    ...keyboard(true),
    ...mouse(true),
    ...navigate(true),
    ...network,
    ...pdf,
    ...screenshot,
    ...snapshot,
    ...storage,
    ...tabs(true),
    ...testing,
    ...devtools,
    ...wait(true),
];
export const visionTools = [
    ...common(false),
    ...console,
    ...dialogs(false),
    ...files(false),
    ...forms,
    ...install,
    ...keyboard(false),
    ...mouse(false),
    ...navigate(false),
    ...network,
    ...pdf,
    ...storage,
    ...tabs(false),
    ...testing,
    ...devtools,
    ...vision,
    ...wait(false),
];
