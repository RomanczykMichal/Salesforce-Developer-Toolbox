# Salesforce Developer Toolbox

A set of everyday Salesforce developer tools in VS Code's side panel, driven by the [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`). A target-org picker sits at the top of the panel at all times; the tabs below switch between tools.

## Features

The extension adds a **Salesforce Developer Toolbox** view to the Activity Bar. A shared org picker at the top lists every org your `sf` CLI is connected to and is used by every tool. Your selection (and already-fetched data) is kept when you switch to another Activity Bar item and back.

### Anonymous Apex

- **Write Apex** in a syntax-highlighted editor (keywords, types, strings, comments, numbers, annotations, and inline SOQL keywords are colored to match your VS Code theme).
- **Execute** the code with one click — it's run via `sf apex run --target-org <org>` against the selected org.
- **Review the result** on the Debug Log page: compile errors, exceptions and stack traces, and the full debug log open in an editor page (the same viewer used for stored logs, with search, filtering, and download). The outcome is also mirrored to the "Salesforce Developer Toolbox" output channel.
- **Reopen the last result** with the **Open Debug Log** button if you closed the page.
- **Save your favorite scripts** under the **Saved Scripts** list: click **Save current script**, give it a (unique) name, and it's stored for every workspace. Click a saved script to load it back into the editor, or use its trash icon (with a confirmation) to remove it.

### SOQL Query

- **Write a SOQL query** in a syntax-highlighted editor (SOQL keywords, strings, numbers, and date literals are colored).
- **Run it** with one click against the selected org via `sf data query --target-org <org>`.
- **Review the results** on a dedicated editor page that shows the records in a table. Parent-relationship fields are flattened to dot-notation columns (e.g. `Account.Name`); child subqueries are shown as JSON in a single cell.
- **Sort any column** by clicking its header (click again to reverse); empty values sort to the bottom. Numeric columns sort numerically.
- **Copy for Excel** copies the results to the clipboard as tab-separated values — paste straight into Excel or Google Sheets and it lands in cells.
- **Export to CSV** with the **Export CSV** button — the file reflects the current sort order and includes a UTF-8 BOM so Excel reads non-ASCII values correctly.
- **Save your favorite queries** under the **Saved Queries** list: click **Save current query**, give it a (unique) name, and it's stored for every workspace. Click a saved query to load it back into the editor, or use its trash icon (with a confirmation) to remove it.

### Debug Logs Manager

The Debug Logs Manager tab has a **Manage Trace Flags** button and a **Log Entries** table.

**Manage Trace Flags** opens a dedicated editor page where you can:

- **Set a trace flag** for a user by choosing the user, a debug level (from the org's existing debug levels, defaulting to an auto-created `ApexExecutioner` level), and a duration.
- **Review every trace flag** (active and expired) for users in the org in a table showing the user, log type, debug level, start/expiry, and time left. Expired flags are dimmed.
- **Extend** an existing flag by the selected duration, or **Remove** it, right from its row. Use **Refresh** to re-query.

**Log Entries** lists the debug logs stored in the org (user, operation, status, size, time), with its own **Refresh** button:

- **Click a log** to open its full body on the Debug Log page.
- **Search the log** with a built-in search bar: highlight all matches with a match counter, jump between them (▲/▼ or Enter / Shift+Enter), toggle case sensitivity, collapse to only matching lines, or filter to **System Debug Only** (`System.debug` output). VS Code's native find (`Ctrl+F`) also works in the log view.
- **Download the log** to a file with the **Download** button on the Debug Log page.

> Logs are fetched on demand via the `sf` CLI and shown from memory — no files are written unless you use **Download**. A single log is limited by the CLI output buffer (~10 MB).

## Requirements

- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`) must be installed and on your `PATH`.
- You must already be authenticated to at least one org via the CLI (e.g. `sf org login web`) — the org picker only lists orgs with a `Connected` status.

## Known Issues/Future improvements

- Syntax highlighting uses a lightweight built-in tokenizer rather than a full Apex grammar, so some edge cases (e.g. nested string escapes) may be colored slightly differently than in the main editor.
- Trace flag management targets users only; trace flags on Apex classes or triggers are not shown or editable.