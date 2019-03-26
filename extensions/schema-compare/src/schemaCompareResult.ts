/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';

const localize = nls.loadMessageBundle();

export class SchemaCompareResult {
	private differencesTable: azdata.TableComponent;
	private loader: azdata.LoadingComponent;
	private editor: azdata.workspace.ModelViewEditor;
	private diffEditor: azdata.DiffEditorComponent;
	private splitView: azdata.SplitViewContainer;
	private flexModel: azdata.FlexContainer;
	private noDifferencesLabel: azdata.TextComponent;
	private sourceDropdown: azdata.DropDownComponent;
	private targetDropdown: azdata.DropDownComponent;
	private sourceTargetFlexLayout: azdata.FlexContainer;
	private switchButton: azdata.ButtonComponent;
	private compareButton: azdata.ButtonComponent;
	private generateScriptButton: azdata.ButtonComponent;
	private SchemaCompareActionMap: Map<Number, string>;
	private comparisonResult: azdata.SchemaCompareResult;

	constructor(private sourceName: string, private targetName: string, private sourceEndpointInfo: azdata.SchemaCompareEndpointInfo, private targetEndpointInfo: azdata.SchemaCompareEndpointInfo) {
		this.SchemaCompareActionMap = new Map<Number, string>();
		this.SchemaCompareActionMap[azdata.SchemaUpdateAction.Delete] = localize('schemaCompare.deleteAction', 'Delete');
		this.SchemaCompareActionMap[azdata.SchemaUpdateAction.Change] = localize('schemaCompare.changeAction', 'Change');
		this.SchemaCompareActionMap[azdata.SchemaUpdateAction.Add] = localize('schemaCompare.addAction', 'Add');

		this.editor = azdata.workspace.createModelViewEditor(localize('schemaCompare.Title', 'Schema Compare'), { retainContextWhenHidden: true, supportsSave: true });

		this.editor.registerContent(async view => {
			this.differencesTable = view.modelBuilder.table().withProperties({
				data: [],
				height: 300,
			}).component();

			this.diffEditor = view.modelBuilder.diffeditor().withProperties({
				contentLeft: '\n',
				contentRight: '\n',
				height: 500,
				title: localize('schemaCompare.ObjectDefinitionsTitle', 'Object Definitions')
			}).component();

			this.splitView = view.modelBuilder.splitViewContainer().component();

			this.sourceDropdown = view.modelBuilder.dropDown().withProperties({
				values: [sourceName],
				enabled: false
			}).component();

			this.targetDropdown = view.modelBuilder.dropDown().withProperties({
				values: [targetName],
				enabled: false
			}).component();

			this.sourceTargetFlexLayout = view.modelBuilder.flexContainer()
				.withProperties({
					alignItems: 'stretch',
					horizontal: true
				}).component();

			this.createSwitchButton(view);
			this.createCompareButton(view);
			this.createGenerateScriptButton(view);

			let toolBar = view.modelBuilder.toolbarContainer();
			toolBar.addToolbarItems([{
				component: this.compareButton
			}, {
				component: this.generateScriptButton
			},
			{
				component: this.switchButton
			}]);

			let sourceLabel = view.modelBuilder.text().withProperties({
				value: localize('schemaCompare.sourceLabel', 'Source:')
			}).component();

			let targetLabel = view.modelBuilder.text().withProperties({
				value: localize('schemaCompare.targetLabel', 'Target:')
			}).component();

			let switchLabel = view.modelBuilder.text().withProperties({
				value: localize('schemaCompare.switchLabel', '🡲')
			}).component();

			this.sourceTargetFlexLayout.addItem(sourceLabel, { CSSStyles: { 'width': '5%', 'margin-left': '1em' } });
			this.sourceTargetFlexLayout.addItem(this.sourceDropdown, { CSSStyles: { 'width': '40%', 'margin': '1em' } });
			this.sourceTargetFlexLayout.addItem(switchLabel, { CSSStyles: { 'width': '3em', 'font-size': 'larger', 'text-align-last':'center'} });
			this.sourceTargetFlexLayout.addItem(targetLabel, { CSSStyles: { 'width': '5%', 'margin-left': '1em' } });
			this.sourceTargetFlexLayout.addItem(this.targetDropdown, { CSSStyles: { 'width': '40%', 'margin': '1em' } });

			this.loader = view.modelBuilder.loadingComponent().component();
			this.noDifferencesLabel = view.modelBuilder.text().withProperties({
				value: localize('schemaCompare.noDifferences', 'No schema differences were found')
			}).component();

			this.flexModel = view.modelBuilder.flexContainer().component();
			this.flexModel.addItem(toolBar.component(), { flex: 'none'});
			this.flexModel.addItem(this.sourceTargetFlexLayout, { flex: 'none'});
			this.flexModel.addItem(this.loader);
			this.flexModel.setLayout({
				flexFlow: 'column',
				height: '100%'
			});

			await view.initializeModel(this.flexModel);
		});
	}

	public async start() {
		this.editor.openEditor();
		this.execute();
	}

	private async execute() {
		let service = await SchemaCompareResult.getService('MSSQL');
		this.comparisonResult = await service.schemaCompare(this.sourceEndpointInfo, this.targetEndpointInfo, azdata.TaskExecutionMode.execute);
		if (!this.comparisonResult || !this.comparisonResult.success) {
			vscode.window.showErrorMessage(
				localize('schemaCompare.compareErrorMessage', "Schema Compare failed '{0}'", this.comparisonResult.errorMessage ? this.comparisonResult.errorMessage : 'Unknown'));
		}

		let data = this.getAllDifferences(this.comparisonResult.differences);

		this.differencesTable.updateProperties({
			data: data,
			columns: [
				{
					value: localize('schemaCompare.typeColumn', 'Type'),
					cssClass: 'align-with-header',
					width: 50
				},
				{
					value: localize('schemaCompare.sourceNameColumn', 'Source Name'),
					cssClass: 'align-with-header'
				},
				{
					value: localize('schemaCompare.actionColumn', 'Action'),
					cssClass: 'align-with-header',
					width: 30
				},
				{
					value: localize('schemaCompare.targetNameColumn', 'Target Name'),
					cssClass: 'align-with-header'
				}]
		});

		this.splitView.addItem(this.differencesTable);
		this.splitView.addItem(this.diffEditor);
		this.splitView.setLayout({
			orientation: 'vertical',
			splitViewHeight: 800
		});

		this.flexModel.removeItem(this.loader);
		this.switchButton.enabled = true;
		this.compareButton.enabled = true;

		// only enable generate script button if the target is a db
		if (this.targetEndpointInfo.endpointType === azdata.SchemaCompareEndpointType.database) {
			this.generateScriptButton.enabled = true;
		}

		if (this.comparisonResult.differences.length > 0) {
			this.flexModel.addItem(this.splitView);
		} else {
			this.flexModel.addItem(this.noDifferencesLabel, { CSSStyles: { 'margin': 'auto' } });
		}

		this.differencesTable.onRowSelected(e => {
			let difference = this.comparisonResult.differences[this.differencesTable.selectedRows[0]];
			if (difference !== undefined) {
				sourceText = difference.sourceScript === null ? '\n' : this.getAggregatedScript(difference, true);
				targetText = difference.targetScript === null ? '\n' : this.getAggregatedScript(difference, false);

				this.diffEditor.updateProperties({
					contentLeft: sourceText,
					contentRight: targetText
				});
			}
		});

		let sourceText = '';
		let targetText = '';
		vscode.workspace.registerTextDocumentContentProvider('source', {
			provideTextDocumentContent() {
				return sourceText;
			}
		});

		vscode.workspace.registerTextDocumentContentProvider('target', {
			provideTextDocumentContent() {
				return targetText;
			}
		});
	}

	private getAllDifferences(differences: azdata.DiffEntry[]): string[][] {
		let data = [];
		differences.forEach(difference => {
			if (difference.differenceType === azdata.SchemaDifferenceType.Object) {
				if (difference.sourceValue !== null || difference.targetValue !== null) {
					data.push([difference.name, difference.sourceValue, this.SchemaCompareActionMap[difference.updateAction], difference.targetValue]);
				}
			}
		});

		return data;
	}

	private getAggregatedScript(diffEntry: azdata.DiffEntry, getSourceScript: boolean): string {
		let script = '';
		if(diffEntry !== null) {
			script += getSourceScript ? diffEntry.sourceScript : diffEntry.targetScript;
			diffEntry.children.forEach(child => {
				let childScript = this.getAggregatedScript(child, getSourceScript);
				if(childScript !== 'null') {
					script += childScript;
				}
			});
		}
		return script;
	}

	private reExecute() {
		this.flexModel.removeItem(this.splitView);
		this.flexModel.removeItem(this.noDifferencesLabel);
		this.flexModel.addItem(this.loader);
		this.diffEditor.updateProperties({
			contentLeft: '\n',
			contentRight: '\n'
		});
		this.differencesTable.selectedRows = null;
		this.compareButton.enabled = false;
		this.switchButton.enabled = false;
		this.generateScriptButton.enabled = false;
		this.execute();
	}

	private createCompareButton(view: azdata.ModelView) {
		let runIcon = path.join(__dirname, '.', 'media', 'start.svg');

		this.compareButton = view.modelBuilder.button().withProperties({
			label: localize('schemaCompare.compareButton', 'Compare'),
			iconPath: runIcon,
			enabled: false,
			title: localize('schemaCompare.compareButtonTitle','Compare')
		}).component();

		this.compareButton.onDidClick(async (click) => {
			this.reExecute();
		});
	}

	private createGenerateScriptButton(view: azdata.ModelView) {
		let fileIcon = path.join(__dirname, '.', 'media', 'file.svg');

		this.generateScriptButton = view.modelBuilder.button().withProperties({
			label: localize('schemaCompare.generateScriptButton', 'Generate Script'),
			iconPath: fileIcon,
			enabled: false,
			title: localize('schemaCompare.generateScriptButtonTitle', 'Generate Script is enabled when the target is a database')
		}).component();

		this.generateScriptButton.onDidClick(async (click) => {
			// get file path
			let now = new Date();
			let datetime = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + '-' + now.getHours() + '-' + now.getMinutes();
			let defaultFilePath = path.join(os.homedir(), this.targetName + '_Update_'+ datetime + '.sql');
			let fileUri = await vscode.window.showSaveDialog(
				{
					defaultUri: vscode.Uri.file(defaultFilePath),
					saveLabel: localize('schemaCompare.saveFile', 'Save'),
					filters: {
						'SQL Files': ['sql'],
					}
				}
			);

			if (!fileUri) {
				return;
			}

			let service = await SchemaCompareResult.getService('MSSQL');
			let result = await service.schemaCompareGenerateScript(this.comparisonResult.operationId, this.targetEndpointInfo.databaseName, fileUri.fsPath, azdata.TaskExecutionMode.execute);
			if (!result || !result.success) {
				vscode.window.showErrorMessage(
					localize('schemaCompare.generateScriptErrorMessage', "Generate Script failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
			}
		});
	}

	private createSwitchButton(view: azdata.ModelView) {
		let swapIcon = path.join(__dirname, '.', 'media', 'swap.png');

		this.switchButton = view.modelBuilder.button().withProperties({
			label: localize('schemaCompare.switchDirectionButton', 'Switch Direction'),
			iconPath: swapIcon,
			enabled: false
		}).component();

		this.switchButton.onDidClick(async (click) => {
			// switch source and target
			[this.sourceDropdown.values, this.targetDropdown.values] = [this.targetDropdown.values, this.sourceDropdown.values];
			[this.sourceEndpointInfo, this.targetEndpointInfo] = [this.targetEndpointInfo, this.sourceEndpointInfo];
			[this.sourceName, this.targetName] = [this.targetName, this.sourceName];
			this.reExecute();
		});
	}

	private static async getService(providerName: string): Promise<azdata.DacFxServicesProvider> {
		let service = azdata.dataprotocol.getProvider<azdata.DacFxServicesProvider>(providerName, azdata.DataProviderType.DacFxServicesProvider);
		return service;
	}
}