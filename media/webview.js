(function () {
	const vscode = acquireVsCodeApi();
	const orgSelect = document.getElementById('org');
	const input = document.getElementById('input');
	const status = document.getElementById('status');
	const highlightCode = document.getElementById('highlightCode');
	const tabButtons = document.querySelectorAll('.tab-button');
	const tabContents = document.querySelectorAll('.tab-content');
	const soqlInput = document.getElementById('soqlInput');
	const soqlHighlightCode = document.getElementById('soqlHighlightCode');
	const soqlStatus = document.getElementById('soqlStatus');
	const savedList = document.getElementById('savedList');
	const saveCurrentItem = document.getElementById('saveCurrent');
	const savedQueriesList = document.getElementById('savedQueriesList');
	const saveCurrentQueryItem = document.getElementById('saveCurrentQuery');
	const traceStatus = document.getElementById('traceStatus');
	const refreshLogsButton = document.getElementById('refreshLogs');
	const logsTable = document.getElementById('logsTable');
	const logsBody = document.getElementById('logsBody');
	const logsStatus = document.getElementById('logsStatus');

	const APEX_KEYWORDS = new Set(['public', 'private', 'protected', 'global', 'class', 'interface', 'enum', 'extends', 'implements', 'static', 'final', 'abstract', 'virtual', 'override', 'void', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'on', 'case', 'default', 'break', 'continue', 'new', 'this', 'super', 'try', 'catch', 'finally', 'throw', 'trigger', 'before', 'after', 'insert', 'update', 'delete', 'undelete', 'upsert', 'merge', 'instanceof', 'null', 'true', 'false', 'transient', 'testmethod', 'with', 'without', 'sharing', 'get', 'set', 'when']);
	const APEX_TYPES = new Set(['integer', 'string', 'boolean', 'object', 'list', 'set', 'map', 'decimal', 'double', 'long', 'date', 'datetime', 'time', 'id', 'blob', 'sobject']);
	const SOQL_KEYWORDS = new Set(['select', 'from', 'where', 'order', 'by', 'group', 'having', 'limit', 'offset', 'and', 'or', 'not', 'in', 'like', 'asc', 'desc', 'count']);
	const SOQL_QUERY_KEYWORDS = new Set(['select', 'from', 'where', 'order', 'by', 'group', 'having', 'limit', 'offset', 'and', 'or', 'not', 'in', 'like', 'asc', 'desc', 'nulls', 'first', 'last', 'count', 'count_distinct', 'sum', 'avg', 'min', 'max', 'with', 'data', 'category', 'for', 'view', 'reference', 'update', 'tracking', 'viewstat', 'using', 'scope', 'typeof', 'when', 'then', 'else', 'end', 'null', 'true', 'false', 'includes', 'excludes', 'above', 'below', 'at']);

	function isWordStart(ch) {
		return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
	}
	function isWordChar(ch) {
		return isWordStart(ch) || (ch >= '0' && ch <= '9');
	}
	function isDigit(ch) {
		return ch >= '0' && ch <= '9';
	}

	function tokenizeApex(code) {
		const tokens = [];
		const n = code.length;
		let i = 0;
		while (i < n) {
			const ch = code[i];

			if (ch === '/' && code[i + 1] === '/') {
				let j = code.indexOf('\n', i);
				if (j === -1) { j = n; }
				tokens.push(['comment', code.slice(i, j)]);
				i = j;
				continue;
			}

			if (ch === '/' && code[i + 1] === '*') {
				let j = code.indexOf('*/', i + 2);
				j = j === -1 ? n : j + 2;
				tokens.push(['comment', code.slice(i, j)]);
				i = j;
				continue;
			}

			if (ch === "'") {
				let j = i + 1;
				while (j < n && code[j] !== "'") {
					if (code[j] === '\\') { j++; }
					j++;
				}
				j = Math.min(j + 1, n);
				tokens.push(['string', code.slice(i, j)]);
				i = j;
				continue;
			}

			if (ch === '@') {
				let j = i + 1;
				while (j < n && isWordChar(code[j])) { j++; }
				tokens.push(['annotation', code.slice(i, j)]);
				i = j;
				continue;
			}

			if (isDigit(ch)) {
				let j = i;
				while (j < n && (isDigit(code[j]) || code[j] === '.')) { j++; }
				tokens.push(['number', code.slice(i, j)]);
				i = j;
				continue;
			}

			if (isWordStart(ch)) {
				let j = i;
				while (j < n && isWordChar(code[j])) { j++; }
				const word = code.slice(i, j);
				const lower = word.toLowerCase();
				let cls = null;
				if (APEX_KEYWORDS.has(lower)) { cls = 'keyword'; }
				else if (APEX_TYPES.has(lower)) { cls = 'type'; }
				else if (SOQL_KEYWORDS.has(lower)) { cls = 'soql'; }
				tokens.push([cls, word]);
				i = j;
				continue;
			}

			tokens.push([null, ch]);
			i++;
		}
		return tokens;
	}

	function tokenizeSoql(code) {
		const tokens = [];
		const n = code.length;
		let i = 0;
		while (i < n) {
			const ch = code[i];

			if (ch === "'") {
				let j = i + 1;
				while (j < n && code[j] !== "'") {
					if (code[j] === '\\') { j++; }
					j++;
				}
				j = Math.min(j + 1, n);
				tokens.push(['string', code.slice(i, j)]);
				i = j;
				continue;
			}

			if (isDigit(ch)) {
				// Capture plain numbers and SOQL date/datetime literals (e.g. 2020-01-01T00:00:00Z).
				let j = i;
				while (j < n && (isWordChar(code[j]) || code[j] === '.' || code[j] === '-' || code[j] === ':' || code[j] === '+')) { j++; }
				tokens.push(['number', code.slice(i, j)]);
				i = j;
				continue;
			}

			if (isWordStart(ch)) {
				let j = i;
				while (j < n && isWordChar(code[j])) { j++; }
				const word = code.slice(i, j);
				tokens.push([SOQL_QUERY_KEYWORDS.has(word.toLowerCase()) ? 'soql' : null, word]);
				i = j;
				continue;
			}

			tokens.push([null, ch]);
			i++;
		}
		return tokens;
	}

	function escapeHtml(text) {
		return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	function highlightWith(tokenize, code) {
		let html = '';
		for (const [cls, text] of tokenize(code)) {
			const escaped = escapeHtml(text);
			html += cls ? '<span class="tok-' + cls + '">' + escaped + '</span>' : escaped;
		}
		return html;
	}

	// Wires a transparent textarea over a syntax-highlighted <pre> layer (the <pre> is the
	// parent of the given <code> element), keeping them in sync as the user types and scrolls.
	function setupEditor(textarea, code, tokenize) {
		const pre = code.parentElement;
		function refresh() {
			code.innerHTML = highlightWith(tokenize, textarea.value);
		}
		function sync() {
			pre.scrollTop = textarea.scrollTop;
			pre.scrollLeft = textarea.scrollLeft;
		}
		textarea.addEventListener('input', refresh);
		textarea.addEventListener('scroll', sync);
		refresh();
	}

	setupEditor(input, highlightCode, tokenizeApex);
	setupEditor(soqlInput, soqlHighlightCode, tokenizeSoql);

	document.getElementById('execute').addEventListener('click', () => {
		vscode.postMessage({ command: 'execute', org: orgSelect.value, text: input.value });
	});

	document.getElementById('openResult').addEventListener('click', () => {
		vscode.postMessage({ command: 'showLastResult' });
	});

	const TRASH_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M6.5 1a.5.5 0 0 0-.5.5V2H3.5a.5.5 0 0 0 0 1H4v9.5A1.5 1.5 0 0 0 5.5 14h5a1.5 1.5 0 0 0 1.5-1.5V3h.5a.5.5 0 0 0 0-1H10v-.5a.5.5 0 0 0-.5-.5h-3zM5 3h6v9.5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5V3zm1.5 1.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5zm3 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5z"/></svg>';

	// Wires up a "saved snippets" list (the editor's Save current / load / delete UI). Returns
	// a setter the message handler calls when the host pushes a refreshed list.
	function setupSavedList(options) {
		let items = [];

		function render() {
			// Remove every rendered row, keeping the static "Save current..." item first.
			while (options.listEl.children.length > 1) {
				options.listEl.removeChild(options.listEl.lastChild);
			}
			if (items.length === 0) {
				const empty = document.createElement('li');
				empty.className = 'saved-empty';
				empty.textContent = options.emptyText;
				options.listEl.appendChild(empty);
				return;
			}
			for (const item of items) {
				const li = document.createElement('li');
				li.className = 'saved-item';

				const name = document.createElement('span');
				name.className = 'saved-name';
				name.textContent = item.name;
				name.title = 'Load "' + item.name + '" into the editor';
				name.addEventListener('click', () => options.onLoad(item));

				const del = document.createElement('button');
				del.className = 'saved-delete';
				del.type = 'button';
				del.title = 'Delete "' + item.name + '"';
				del.innerHTML = TRASH_ICON;
				del.addEventListener('click', (event) => {
					event.stopPropagation();
					del.disabled = true;
					vscode.postMessage({ command: options.deleteCommand, id: item.id, name: item.name });
				});

				li.appendChild(name);
				li.appendChild(del);
				options.listEl.appendChild(li);
			}
		}

		function saveCurrent() {
			if (!options.getValue().trim()) {
				options.statusEl.textContent = options.emptyWarning;
				return;
			}
			vscode.postMessage({ command: options.saveCommand, content: options.getValue() });
		}

		options.addEl.addEventListener('click', saveCurrent);
		options.addEl.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				saveCurrent();
			}
		});
		render();

		return function set(newItems) {
			items = newItems || [];
			render();
		};
	}

	function loadInto(textarea, statusEl, item) {
		textarea.value = item.content;
		textarea.dispatchEvent(new Event('input'));
		textarea.focus();
		statusEl.textContent = 'Loaded "' + item.name + '".';
	}

	const setSavedScripts = setupSavedList({
		listEl: savedList,
		addEl: saveCurrentItem,
		getValue: () => input.value,
		statusEl: status,
		emptyText: 'No saved scripts yet.',
		emptyWarning: 'Write some Apex before saving a script.',
		saveCommand: 'saveScript',
		deleteCommand: 'deleteScript',
		onLoad: (item) => loadInto(input, status, item)
	});

	const setSavedQueries = setupSavedList({
		listEl: savedQueriesList,
		addEl: saveCurrentQueryItem,
		getValue: () => soqlInput.value,
		statusEl: soqlStatus,
		emptyText: 'No saved queries yet.',
		emptyWarning: 'Write a SOQL query before saving it.',
		saveCommand: 'saveQuery',
		deleteCommand: 'deleteQuery',
		onLoad: (item) => loadInto(soqlInput, soqlStatus, item)
	});

	document.getElementById('runSoql').addEventListener('click', () => {
		const org = orgSelect.value;
		if (!org) {
			soqlStatus.textContent = 'Select an org first.';
			return;
		}
		const query = soqlInput.value.trim();
		if (!query) {
			soqlStatus.textContent = 'Enter a SOQL query before running.';
			return;
		}
		soqlStatus.textContent = 'Running query against ' + org + '...';
		vscode.postMessage({ command: 'runSoql', org: org, query: query });
	});

	function isDebugTabActive() {
		const activeTab = document.querySelector('.tab-content.active');
		return !!activeTab && activeTab.id === 'tab-debug';
	}

	function loadLogs() {
		const org = orgSelect.value;
		if (!org) {
			logsStatus.textContent = 'Select an org to see log entries.';
			logsTable.classList.add('hidden');
			return;
		}
		logsStatus.textContent = 'Loading log entries...';
		vscode.postMessage({ command: 'loadLogs', org });
	}

	function formatLogTime(iso) {
		if (!iso) {
			return '';
		}
		const date = new Date(iso);
		return isNaN(date.getTime()) ? iso : date.toLocaleString();
	}

	function formatSize(bytes) {
		if (typeof bytes !== 'number' || isNaN(bytes)) {
			return '';
		}
		if (bytes < 1024) {
			return bytes + ' B';
		}
		const kb = bytes / 1024;
		if (kb < 1024) {
			return kb.toFixed(1) + ' KB';
		}
		return (kb / 1024).toFixed(1) + ' MB';
	}

	function renderLogs(logs, error) {
		logsBody.innerHTML = '';
		if (error) {
			logsStatus.textContent = 'Failed to load log entries: ' + error;
			logsTable.classList.add('hidden');
			return;
		}
		if (!logs || logs.length === 0) {
			logsStatus.textContent = 'No log entries found.';
			logsTable.classList.add('hidden');
			return;
		}
		for (const log of logs) {
			const tr = document.createElement('tr');
			const cells = [log.user, log.operation, log.status, formatSize(log.logLength), formatLogTime(log.startTime)];
			for (const cell of cells) {
				const td = document.createElement('td');
				td.textContent = cell == null ? '' : String(cell);
				td.title = td.textContent;
				tr.appendChild(td);
			}
			tr.addEventListener('click', () => {
				const label = (log.user || 'Log') + ' · ' + formatLogTime(log.startTime);
				vscode.postMessage({ command: 'openLog', org: orgSelect.value, id: log.id, label: label });
			});
			logsBody.appendChild(tr);
		}
		logsStatus.textContent = logs.length + ' log entr' + (logs.length === 1 ? 'y' : 'ies') + '.';
		logsTable.classList.remove('hidden');
	}

	function activateTab(tab) {
		tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
		tabContents.forEach((content) => content.classList.toggle('active', content.id === 'tab-' + tab));
		if (tab === 'debug') {
			loadLogs();
		}
	}

	tabButtons.forEach((btn) => {
		btn.addEventListener('click', () => activateTab(btn.dataset.tab));
	});

	orgSelect.addEventListener('change', () => {
		traceStatus.textContent = '';
		vscode.postMessage({ command: 'orgChanged', org: orgSelect.value });
		if (isDebugTabActive()) {
			loadLogs();
		}
	});

	refreshLogsButton.addEventListener('click', loadLogs);

	document.getElementById('manageTraceFlags').addEventListener('click', () => {
		const org = orgSelect.value;
		if (!org) {
			traceStatus.textContent = 'Select an org first.';
			return;
		}
		vscode.postMessage({ command: 'manageTraceFlags', org });
	});

	window.addEventListener('message', (event) => {
		const message = event.data;
		if (!message) {
			return;
		}
		if (message.command === 'orgs') {
			orgSelect.innerHTML = '';
			if (!message.orgs || message.orgs.length === 0) {
				const option = document.createElement('option');
				option.value = '';
				option.textContent = message.error ? 'Failed to load orgs' : 'No connected orgs found';
				orgSelect.appendChild(option);
				return;
			}
			for (const org of message.orgs) {
				const option = document.createElement('option');
				option.value = org.username;
				option.textContent = org.label;
				orgSelect.appendChild(option);
			}
		} else if (message.command === 'status') {
			status.textContent = message.text;
		} else if (message.command === 'soqlStatus') {
			soqlStatus.textContent = message.text;
		} else if (message.command === 'savedScripts') {
			setSavedScripts(message.scripts);
		} else if (message.command === 'savedQueries') {
			setSavedQueries(message.queries);
		} else if (message.command === 'logs') {
			renderLogs(message.logs, message.error);
		}
	});

	vscode.postMessage({ command: 'ready' });
}());
