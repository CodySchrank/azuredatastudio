/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { AppContext } from '../appContext';
import { CmsResourceTreeProvider } from './tree/treeProvider';
import { registerCMSServerCommand, deleteCMSServerCommand, addRegisteredServerCommand, deleteRegisteredServerCommand, deleteServerGroupCommand, addServerGroupCommand, refreshCommand } from './cmsResourceCommands';

export function registerCmsResourceCommands(appContext: AppContext, tree: CmsResourceTreeProvider): void {

	registerCMSServerCommand(appContext, tree);
	deleteCMSServerCommand(appContext, tree);
	addRegisteredServerCommand(appContext, tree);
	deleteRegisteredServerCommand(appContext, tree);
	addServerGroupCommand(appContext, tree);
	deleteServerGroupCommand(appContext, tree);
	refreshCommand(appContext, tree);

}
