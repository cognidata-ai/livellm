import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const TABLE_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .table-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    overflow: hidden;
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    background: var(--livellm-bg-component, #ffffff);
  }
  .table-toolbar {
    padding: 10px 16px;
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .search-input {
    padding: 6px 10px;
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: 6px;
    font-family: inherit;
    font-size: 13px;
    outline: none;
    width: 200px;
    max-width: 50%;
  }
  .search-input:focus {
    border-color: var(--livellm-primary, #6c5ce7);
  }
  .row-count {
    font-size: 12px;
    color: var(--livellm-text-muted, #adb5bd);
  }
  .table-scroll { overflow-x: auto; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th {
    padding: 10px 16px;
    text-align: left;
    font-weight: 600;
    color: var(--livellm-text-secondary, #6c757d);
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-bottom: 2px solid var(--livellm-border, #e0e0e0);
    white-space: nowrap;
    user-select: none;
  }
  th.sortable {
    cursor: pointer;
  }
  th.sortable:hover { color: var(--livellm-primary, #6c5ce7); }
  th .sort-arrow {
    margin-left: 4px;
    opacity: 0.3;
    font-size: 10px;
  }
  th.sorted-asc .sort-arrow,
  th.sorted-desc .sort-arrow { opacity: 1; color: var(--livellm-primary, #6c5ce7); }
  td {
    padding: 10px 16px;
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
  }
  tr:last-child td { border-bottom: none; }
  tr.clickable { cursor: pointer; }
  tr.clickable:hover { background: rgba(108, 92, 231, 0.04); }
  tr.selected { background: rgba(108, 92, 231, 0.08); }
  .pagination {
    padding: 10px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-top: 1px solid var(--livellm-border, #e0e0e0);
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
  }
  .page-btn {
    padding: 4px 10px;
    border: 1px solid var(--livellm-border, #e0e0e0);
    background: var(--livellm-bg, #ffffff);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }
  .page-btn:hover { background: var(--livellm-bg-secondary, #f8f9fa); }
  .page-btn:disabled { opacity: 0.5; cursor: default; }
  .page-btns { display: flex; gap: 4px; }
  .no-results {
    padding: 24px;
    text-align: center;
    color: var(--livellm-text-muted, #adb5bd);
  }
`;

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  type?: string;
}

export class LiveLLMTablePlus extends LiveLLMComponent {
  private sortKey: string = '';
  private sortDir: 'asc' | 'desc' = 'asc';
  private searchQuery: string = '';
  private currentPage: number = 0;
  private selectedRows: Set<number> = new Set();

  render(): void {
    const rawRows = this._props.rows || this._props.data || this._props.items || this._props.records || [];
    const rows: Record<string, any>[] = Array.isArray(rawRows) ? rawRows : [];
    const rawColumns = this._props.columns || this._props.headers || [];
    let columns: Column[] = Array.isArray(rawColumns)
      ? rawColumns.map((col: any) => this.normalizeColumn(col))
      : [];
    // Auto-generate columns from first row if none provided
    if (columns.length === 0 && rows.length > 0) {
      columns = Object.keys(rows[0]).map((key) => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        sortable: true,
      }));
    }
    const searchable = this._props.searchable !== false;
    const sortable = this._props.sortable !== false;
    const pageSize = this._props.pageSize || 0;
    const selectable = this._props.selectable || false;

    this.setStyles(TABLE_STYLES);

    let filteredRows = rows;
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filteredRows = rows.filter((row) =>
        columns.some((col) => String(row[col.key] ?? '').toLowerCase().includes(q))
      );
    }

    if (this.sortKey) {
      const col = columns.find((c) => c.key === this.sortKey);
      filteredRows = [...filteredRows].sort((a, b) => {
        const av = a[this.sortKey] ?? '';
        const bv = b[this.sortKey] ?? '';
        const cmp = col?.type === 'number'
          ? (parseFloat(av) || 0) - (parseFloat(bv) || 0)
          : String(av).localeCompare(String(bv));
        return this.sortDir === 'asc' ? cmp : -cmp;
      });
    }

    let displayRows = filteredRows;
    const totalPages = pageSize > 0 ? Math.ceil(filteredRows.length / pageSize) : 1;
    if (pageSize > 0) {
      const start = this.currentPage * pageSize;
      displayRows = filteredRows.slice(start, start + pageSize);
    }

    // Build HTML
    const toolbarHtml = searchable ? `
      <div class="table-toolbar">
        <input class="search-input" type="text" placeholder="Search..." value="${this.escapeAttr(this.searchQuery)}"/>
        <span class="row-count">${filteredRows.length} row${filteredRows.length !== 1 ? 's' : ''}</span>
      </div>` : '';

    const headCells = columns.map((col) => {
      const isSortable = sortable && col.sortable !== false;
      const cls = [
        isSortable ? 'sortable' : '',
        this.sortKey === col.key ? `sorted-${this.sortDir}` : '',
      ].filter(Boolean).join(' ');
      const arrow = isSortable
        ? `<span class="sort-arrow">${this.sortKey === col.key ? (this.sortDir === 'asc' ? '▲' : '▼') : '▲'}</span>`
        : '';
      return `<th class="${cls}" data-sort-key="${this.escapeAttr(col.key)}">${this.escapeHtml(col.label)}${arrow}</th>`;
    }).join('');

    let bodyHtml = '';
    if (displayRows.length === 0) {
      bodyHtml = `<tr><td colspan="${columns.length}" class="no-results">No results found</td></tr>`;
    } else {
      bodyHtml = displayRows.map((row, i) => {
        const origIdx = filteredRows.indexOf(row);
        const cls = [
          selectable || true ? 'clickable' : '',
          this.selectedRows.has(origIdx) ? 'selected' : '',
        ].filter(Boolean).join(' ');
        const cells = columns.map((col) =>
          `<td>${this.escapeHtml(String(row[col.key] ?? ''))}</td>`
        ).join('');
        return `<tr class="${cls}" data-row-index="${origIdx}">${cells}</tr>`;
      }).join('');
    }

    const paginationHtml = pageSize > 0 && totalPages > 1 ? `
      <div class="pagination">
        <span>Page ${this.currentPage + 1} of ${totalPages}</span>
        <div class="page-btns">
          <button class="page-btn page-prev" ${this.currentPage === 0 ? 'disabled' : ''}>Prev</button>
          <button class="page-btn page-next" ${this.currentPage >= totalPages - 1 ? 'disabled' : ''}>Next</button>
        </div>
      </div>` : '';

    this.setContent(`
      <div class="table-container">
        ${toolbarHtml}
        <div class="table-scroll">
          <table>
            <thead><tr>${headCells}</tr></thead>
            <tbody>${bodyHtml}</tbody>
          </table>
        </div>
        ${paginationHtml}
      </div>
    `);

    this.bindTableEvents(columns, filteredRows, sortable, selectable);
  }

  private bindTableEvents(columns: Column[], rows: Record<string, any>[], sortable: boolean, selectable: boolean): void {
    // Search
    this.shadowRoot?.querySelector('.search-input')?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.currentPage = 0;
      this.render();
    });

    // Sort
    if (sortable) {
      this.shadowRoot?.querySelectorAll('th.sortable').forEach((th) => {
        th.addEventListener('click', () => {
          const key = (th as HTMLElement).getAttribute('data-sort-key') || '';
          if (this.sortKey === key) {
            this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            this.sortKey = key;
            this.sortDir = 'asc';
          }
          this.render();
        });
      });
    }

    // Row click
    this.shadowRoot?.querySelectorAll('tr.clickable').forEach((tr) => {
      tr.addEventListener('click', () => {
        const idx = parseInt((tr as HTMLElement).getAttribute('data-row-index') || '0', 10);
        const row = rows[idx];
        if (row) {
          this.emitAction('row-click', {
            value: { row, index: idx },
            label: `Selected row: ${Object.values(row).join(', ')}`,
          });
        }
      });
    });

    // Pagination
    this.shadowRoot?.querySelector('.page-prev')?.addEventListener('click', () => {
      if (this.currentPage > 0) { this.currentPage--; this.render(); }
    });
    this.shadowRoot?.querySelector('.page-next')?.addEventListener('click', () => {
      this.currentPage++;
      this.render();
    });
  }

  private normalizeColumn(col: any): Column {
    if (typeof col === 'string') {
      return { key: col, label: col };
    }
    if (!col || typeof col !== 'object') {
      return { key: String(col ?? ''), label: String(col ?? '') };
    }
    return {
      key: String(col.key ?? col.field ?? col.id ?? col.name ?? col.label ?? ''),
      label: String(col.label ?? col.title ?? col.header ?? col.name ?? col.key ?? ''),
      sortable: col.sortable,
      type: col.type,
    };
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  private escapeAttr(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const TABLE_PLUS_REGISTRATION: RegisterOptions = {
  schema: {
    columns: { type: 'array' },
    headers: { type: 'array' },
    rows: { type: 'array' },
    data: { type: 'array' },
    items: { type: 'array' },
    records: { type: 'array' },
    searchable: { type: 'boolean', default: true },
    sortable: { type: 'boolean', default: true },
    pageSize: { type: 'number', default: 0 },
    selectable: { type: 'boolean', default: false },
  },
  category: 'block',
  skeleton: {
    html: '<div class="livellm-skeleton" style="height:200px;border-radius:8px;background:#f0f0f0;"><div class="shimmer"></div></div>',
    height: '200px',
  },
};
