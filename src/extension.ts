import * as vscode from 'vscode';
import { ApexExecutionViewProvider } from './apexExecutionViewProvider';
import { SavedSnippetsStore } from './savedSnippetsStore';

export function activate(context: vscode.ExtensionContext) {
	const provider = new ApexExecutionViewProvider(
		context.extensionUri,
		new SavedSnippetsStore(context.globalState, 'salesforceDeveloperToolbox.savedScripts'),
		new SavedSnippetsStore(context.globalState, 'salesforceDeveloperToolbox.savedQueries')
	);
	context.subscriptions.push(provider);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ApexExecutionViewProvider.viewType, provider, {
			// Keep the webview alive when the user switches to another activity bar item and
			// back, so the selected org and already-fetched data are preserved instead of
			// being re-fetched every time the view becomes visible again.
			webviewOptions: { retainContextWhenHidden: true }
		})
	);
}

export function deactivate() {}
