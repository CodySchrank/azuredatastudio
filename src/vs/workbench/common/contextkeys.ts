/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { isMacintosh, isLinux, isWindows } from 'vs/base/common/platform';

export const IsMacContext = new RawContextKey<boolean>('isMac', isMacintosh);
export const IsLinuxContext = new RawContextKey<boolean>('isLinux', isLinux);
export const IsWindowsContext = new RawContextKey<boolean>('isWindows', isWindows);

export const RemoteAuthorityContext = new RawContextKey<string>('remoteAuthority', '');

export const HasMacNativeTabsContext = new RawContextKey<boolean>('hasMacNativeTabs', false);

export const SupportsWorkspacesContext = new RawContextKey<boolean>('supportsWorkspaces', true);

export const IsDevelopmentContext = new RawContextKey<boolean>('isDevelopment', false);

export const WorkbenchStateContext = new RawContextKey<string>('workbenchState', undefined);

export const WorkspaceFolderCountContext = new RawContextKey<number>('workspaceFolderCount', 0);

export const RemoteFileDialogContext = new RawContextKey<boolean>('remoteFileDialogVisible', false);
