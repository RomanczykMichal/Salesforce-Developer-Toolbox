(function () {
	const vscode = acquireVsCodeApi();
	const titleEl = document.getElementById('title');
	const subtitleEl = document.getElementById('subtitle');
	const statusEl = document.getElementById('status');
	const table = document.getElementById('resultsTable');
	const headRow = document.getElementById('headRow');
	const body = document.getElementById('body');
	const exportButton = document.getElementById('exportCsv');
	const copyButton = document.getElementById('copyTsv');

	let columns = [];
	let rows = [];
	let sortState = { index: -1, dir: 1 };

	function isNumericColumn(index) {
		let sawValue = false;
		for (const row of rows) {
			const value = row[index];
			if (value === '' || value == null) {
				continue;
			}
			sawValue = true;
			if (isNaN(Number(value))) {
				return false;
			}
		}
		return sawValue;
	}

	function renderHead() {
		headRow.innerHTML = '';
		columns.forEach((column, index) => {
			const th = document.createElement('th');
			th.textContent = column;
			th.title = column;
			if (sortState.index === index) {
				const arrow = document.createElement('span');
				arrow.className = 'sort-arrow';
				arrow.textContent = sortState.dir === 1 ? ' ▲' : ' ▼';
				th.appendChild(arrow);
			}
			th.addEventListener('click', () => sortBy(index));
			headRow.appendChild(th);
		});
	}

	function renderBody() {
		const fragment = document.createDocumentFragment();
		for (const row of rows) {
			const tr = document.createElement('tr');
			for (const cell of row) {
				const td = document.createElement('td');
				td.textContent = cell == null ? '' : String(cell);
				td.title = td.textContent;
				tr.appendChild(td);
			}
			fragment.appendChild(tr);
		}
		body.innerHTML = '';
		body.appendChild(fragment);
	}

	function sortBy(index) {
		if (sortState.index === index) {
			sortState.dir = -sortState.dir;
		} else {
			sortState = { index: index, dir: 1 };
		}
		const numeric = isNumericColumn(index);
		rows.sort((a, b) => {
			const av = a[index] == null ? '' : a[index];
			const bv = b[index] == null ? '' : b[index];
			// Keep empty values at the bottom regardless of direction.
			if (av === '' && bv === '') { return 0; }
			if (av === '') { return 1; }
			if (bv === '') { return -1; }
			const cmp = numeric ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
			return cmp * sortState.dir;
		});
		renderHead();
		renderBody();
	}

	function render(message) {
		columns = message.columns || [];
		rows = (message.rows || []).map((row) => row.slice());
		sortState = { index: -1, dir: 1 };
		titleEl.textContent = message.label || 'SOQL Results';
		subtitleEl.textContent = message.query || '';

		if (columns.length === 0) {
			const total = typeof message.totalSize === 'number' ? message.totalSize : 0;
			statusEl.textContent = total + ' row' + (total === 1 ? '' : 's') + ' returned (no columns to display).';
			table.classList.add('hidden');
			exportButton.disabled = true;
			copyButton.disabled = true;
			return;
		}

		let summary = rows.length + ' row' + (rows.length === 1 ? '' : 's');
		if (typeof message.totalSize === 'number' && message.totalSize !== rows.length) {
			summary += ' of ' + message.totalSize;
		}
		statusEl.textContent = summary + '.';
		renderHead();
		renderBody();
		table.classList.remove('hidden');
		exportButton.disabled = rows.length === 0;
		copyButton.disabled = rows.length === 0;
	}

	exportButton.addEventListener('click', () => {
		// Send the rows in their current (possibly sorted) display order.
		vscode.postMessage({ command: 'exportCsv', rows: rows });
	});

	copyButton.addEventListener('click', () => {
		vscode.postMessage({ command: 'copyTsv', rows: rows });
	});

	window.addEventListener('message', (event) => {
		const message = event.data;
		if (!message) {
			return;
		}
		if (message.command === 'results') {
			render(message);
		}
	});

	vscode.postMessage({ command: 'ready' });
}());
