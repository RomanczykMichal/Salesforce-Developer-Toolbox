import * as os from 'os';
import * as vscode from 'vscode';
import { SoqlQueryResult } from './sf/soqlService';
import { renderSoqlResultsHtml } from './webview';

const VIEW_TYPE = 'salesforceDeveloperToolbox.soqlResults';

let currentPanel: vscode.WebviewPanel | undefined;
let currentResult: SoqlQueryResult | undefined;
let currentOrg = '';
let currentQuery = '';

/** Opens (or reveals) the SOQL results page for a query result. */
export function showSoqlResults(extensionUri: vscode.Uri, result: SoqlQueryResult, org: string, query: string): void {
	currentResult = result;
	currentOrg = org;
	currentQuery = query;
	const existed = !!currentPanel;
	const panel = ensurePanel(extensionUri);
	panel.title = panelTitle(org);
	panel.reveal(vscode.ViewColumn.Active);
	// A freshly created panel delivers once its webview posts "ready"; an existing one is
	// already listening, so push the new results now.
	if (existed) {
		deliver(panel);
	}
}

function ensurePanel(extensionUri: vscode.Uri): vscode.WebviewPanel {
	if (currentPanel) {
		return currentPanel;
	}
	const panel = vscode.window.createWebviewPanel(
		VIEW_TYPE,
		panelTitle(currentOrg),
		vscode.ViewColumn.Active,
		{
			enableScripts: true,
			enableFindWidget: true,
			retainContextWhenHidden: true,
			localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
		}
	);
	currentPanel = panel;
	panel.onDidDispose(() => {
		if (currentPanel === panel) {
			currentPanel = undefined;
		}
	});
	panel.webview.html = renderSoqlResultsHtml(panel.webview, extensionUri);
	panel.webview.onDidReceiveMessage((message) => {
		if (!message) {
			return;
		}
		if (message.command === 'ready') {
			deliver(panel);
		} else if (message.command === 'exportCsv') {
			void exportCsv(message.rows);
		} else if (message.command === 'copyTsv') {
			void copyForSpreadsheet(message.rows);
		}
	});
	return panel;
}

function deliver(panel: vscode.WebviewPanel): void {
	if (!currentResult) {
		return;
	}
	panel.webview.postMessage({
		command: 'results',
		columns: currentResult.columns,
		rows: currentResult.rows,
		totalSize: currentResult.totalSize,
		label: `Query against ${currentOrg}`,
		query: currentQuery
	});
}

async function exportCsv(orderedRows?: string[][]): Promise<void> {
	if (!currentResult || currentResult.columns.length === 0) {
		vscode.window.showWarningMessage('There is no query result to export.');
		return;
	}
	// Prefer the rows in the order the webview is currently showing them (e.g. after sorting);
	// fall back to the original query order.
	const rows = Array.isArray(orderedRows) && orderedRows.length > 0 ? orderedRows : currentResult.rows;
	const csv = toDelimited(currentResult.columns, rows, ',');

	const fileName = `soql-export-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
	const folders = vscode.workspace.workspaceFolders;
	const baseUri = folders && folders.length > 0 ? folders[0].uri : vscode.Uri.file(os.homedir());
	const uri = await vscode.window.showSaveDialog({
		saveLabel: 'Export CSV',
		defaultUri: vscode.Uri.joinPath(baseUri, fileName),
		filters: { 'CSV files': ['csv'], 'All files': ['*'] }
	});
	if (!uri) {
		return;
	}

	try {
		// Prepend a UTF-8 BOM so Excel opens non-ASCII values correctly.
		await vscode.workspace.fs.writeFile(uri, Buffer.from('﻿' + csv, 'utf8'));
		vscode.window.showInformationMessage(`Exported ${rows.length} row${rows.length === 1 ? '' : 's'} to ${uri.fsPath}.`);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		vscode.window.showErrorMessage(`Failed to export CSV: ${message}`);
	}
}

/**
 * Copies the result to the clipboard as tab-separated values, which Excel and Google Sheets
 * parse directly into cells when pasted.
 */
async function copyForSpreadsheet(orderedRows?: string[][]): Promise<void> {
	if (!currentResult || currentResult.columns.length === 0) {
		vscode.window.showWarningMessage('There is no query result to copy.');
		return;
	}
	const rows = Array.isArray(orderedRows) && orderedRows.length > 0 ? orderedRows : currentResult.rows;
	await vscode.env.clipboard.writeText(toDelimited(currentResult.columns, rows, '\t'));
	vscode.window.showInformationMessage(
		`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard. Paste into Excel or Google Sheets.`
	);
}

function toDelimited(columns: string[], rows: string[][], delimiter: string): string {
	const lines = [columns.map((value) => escapeField(value, delimiter)).join(delimiter)];
	for (const row of rows) {
		lines.push(row.map((value) => escapeField(value, delimiter)).join(delimiter));
	}
	return lines.join('\r\n');
}

// Quotes a field (doubling embedded quotes) when it contains the delimiter, a quote, or a
// line break — the convention Excel/Sheets understand for both CSV files and pasted TSV.
function escapeField(value: string, delimiter: string): string {
	const text = value ?? '';
	return text.includes(delimiter) || /["\r\n]/.test(text)
		? `"${text.replace(/"/g, '""')}"`
		: text;
}

function panelTitle(org: string): string {
	return org ? `SOQL Results — ${org}` : 'SOQL Results';
}
