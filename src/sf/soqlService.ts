import { quoteArg, runSf } from './sfCli';

export interface SoqlQueryResult {
	columns: string[];
	rows: string[][];
	totalSize: number;
}

interface SfRecord {
	attributes?: unknown;
	[key: string]: unknown;
}

interface SfDataQueryResponse {
	records: SfRecord[];
	totalSize: number;
	done: boolean;
}

/**
 * Runs a SOQL query against the org and returns it flattened into columns + rows ready to
 * render as a table. Parent-relationship fields are flattened to dot-notation columns (e.g.
 * `Account.Name`); child subqueries and other nested structures are stringified as JSON.
 */
export async function runSoqlQuery(org: string, query: string): Promise<SoqlQueryResult> {
	const response = await runSf<SfDataQueryResponse>([
		'data', 'query', '--query', quoteArg(query), '--target-org', org, '--json'
	]);
	const records = response.records ?? [];
	const flattened = records.map((record) => flattenRecord(record));
	const columns = collectColumns(flattened);
	const rows = flattened.map((record) => columns.map((column) => record[column] ?? ''));
	return { columns, rows, totalSize: response.totalSize ?? records.length };
}

function flattenRecord(record: SfRecord, prefix = ''): Record<string, string> {
	const flat: Record<string, string> = {};
	for (const [key, value] of Object.entries(record)) {
		if (key === 'attributes') {
			continue;
		}
		const column = prefix ? `${prefix}.${key}` : key;
		if (value === null || value === undefined) {
			flat[column] = '';
		} else if (Array.isArray(value)) {
			flat[column] = JSON.stringify(value);
		} else if (typeof value === 'object') {
			const nested = value as SfRecord;
			if ('records' in nested) {
				// Child-relationship subquery — show the raw records as JSON in a single cell.
				flat[column] = JSON.stringify((nested as { records: unknown }).records);
			} else {
				Object.assign(flat, flattenRecord(nested, column));
			}
		} else {
			flat[column] = String(value);
		}
	}
	return flat;
}

// Builds the column list as the first-seen union of keys across all records, preserving the
// order Salesforce returns them in (which follows the SELECT clause).
function collectColumns(records: Record<string, string>[]): string[] {
	const columns: string[] = [];
	const seen = new Set<string>();
	for (const record of records) {
		for (const key of Object.keys(record)) {
			if (!seen.has(key)) {
				seen.add(key);
				columns.push(key);
			}
		}
	}
	return columns;
}
