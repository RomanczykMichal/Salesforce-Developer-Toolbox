import * as crypto from 'crypto';
import * as vscode from 'vscode';

export interface SavedSnippet {
	id: string;
	name: string;
	content: string;
	savedAt: string;
}

// On-disk shape, tolerant of the legacy `code` field used before the store was generalized.
interface StoredSnippet {
	id: string;
	name: string;
	content?: string;
	code?: string;
	savedAt: string;
}

/**
 * Persists a named list of text snippets (e.g. Apex scripts or SOQL queries) in the
 * extension's global state under the given key, so they survive reloads and are available in
 * every workspace.
 */
export class SavedSnippetsStore {
	constructor(private readonly memento: vscode.Memento, private readonly key: string) {}

	getAll(): SavedSnippet[] {
		const stored = this.memento.get<StoredSnippet[]>(this.key, []);
		return stored.map((item) => ({
			id: item.id,
			name: item.name,
			content: item.content ?? item.code ?? '',
			savedAt: item.savedAt
		}));
	}

	/** True when a snippet with the given name already exists (case-insensitive). */
	hasName(name: string): boolean {
		const target = name.trim().toLowerCase();
		return this.getAll().some((item) => item.name.toLowerCase() === target);
	}

	/** Adds a snippet to the top of the list and returns the updated list. */
	async save(name: string, content: string): Promise<SavedSnippet[]> {
		const items = this.getAll();
		items.unshift({ id: crypto.randomUUID(), name, content, savedAt: new Date().toISOString() });
		await this.memento.update(this.key, items);
		return items;
	}

	/** Removes the snippet with the given id and returns the updated list. */
	async remove(id: string): Promise<SavedSnippet[]> {
		const items = this.getAll().filter((item) => item.id !== id);
		await this.memento.update(this.key, items);
		return items;
	}
}
