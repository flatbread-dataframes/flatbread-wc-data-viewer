import { Data } from "./data/data.js"
import { View } from "./data/view.js"
import { Formatter } from "./build/formatter.js"
import { ColumnWidths } from "./build/column-widths.js"
import { EventCoordinator } from "./managers/event-coordinator.js"
import { NavigationController } from "./managers/navigation-controller.js"
import "./components/record/data-record.js"
import "./components/table/data-table.js"
import "./components/control-panel.js"
import "./components/filter-combo.js"
import "./components/sort-button.js"
import "./vendor/wc-multi-selector.js"

// The height is set per viewer, in its own sheet (see updateHeight)
const viewerSheet = new CSSStyleSheet()
viewerSheet.replaceSync(`
    :root {
        box-sizing: border-box;
    }
    :host {
        --dv-bg: var(--background-color, white);
        --dv-hover: color-mix(in srgb, var(--dv-bg) 90%, currentColor 5%);
        --dv-border: var(--border-color, color-mix(in srgb, var(--dv-bg) 90%, currentColor 70%));
        --focus-color: color-mix(in srgb, var(--dv-bg) 90%, currentColor 50%);

        display: grid;
        grid-template-areas:
            "control-panel"
            "view";
        grid-template-rows: auto 1fr;

        outline: none;
    }

    control-panel {
        grid-area: control-panel;
    }

    data-table,
    data-record {
        grid-area: view;
        overflow-y: auto;
        scrollbar-gutter: stable;
    }

    :host([view="record"]) data-table {
        visibility: hidden;
    }
    :host([view="record"]) data-record {
        display: block;
    }
    :host([view="table"]) data-table {
        visibility: visible;
    }
    :host([view="table"]) data-record {
        display: none;
    }
`)

// Before there is data, targets cannot be resolved: equal when they name the same column or level the same way
const sameTarget = (a, b) => ["column", "level", "ilevel"].some(name =>
    name in a && name in b && JSON.stringify(a[name]) === JSON.stringify(b[name]))

export class FlatbreadDataViewer extends HTMLElement {
    static get observedAttributes() {
        return [
            "view", "src", "locale", "na-rep", "height",
            "hide-group-borders", "hide-row-borders",
            "hide-thead-border", "hide-index-border",
            "hide-filter-row", "cell-layout",
        ]
    }

    static get defaults() {
        return {
            locale: "default",
            naRep: "-",
            overscan: 20,
            height: "600px",
            cellLayout: "no-wrap",
            styling: {
                groupBorders: true,
                rowBorders: true,
                hoverEffect: true,
                theadBorder: true,
                indexBorder: true,
                hideFilters: false,
            }
        }
    }

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
        this.options = { ...FlatbreadDataViewer.defaults }
        this._heightSheet = new CSSStyleSheet()
        this.shadowRoot.adoptedStyleSheets = [viewerSheet, this._heightSheet]
        this.updateHeight()

        this._data = new Data()
        // State set through the API before there is data, as the host passed it; applied to the first view
        this._pending = {}
        this._eventCoordinator = new EventCoordinator(this)
        this._navigationController = new NavigationController(this)
        this._formatter = new Formatter(this.options)
    }

    // MARK: setup
    connectedCallback() {
        // set default mode if not provided
        if (!this.hasAttribute("view")) {
            this.setAttribute("view", "table")
        }

        this.setAttribute("tabindex", "0")

        // initialize internal state
        this._viewMode = this.getAttribute("view") === "record" ? "record" : "table"

        // setup
        this.addEventListeners()

        const src = this.getAttribute("src")
        if (src) {
            this.loadDataFromSrc(src)
        }
    }

    disconnectedCallback() {
        this.removeEventListeners()
    }

    addEventListeners() {
        this._eventCoordinator.addEventListeners()
        this._navigationController.addEventListeners()
    }

    removeEventListeners() {
        this._eventCoordinator.removeEventListeners()
        this._navigationController.removeEventListeners()
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return

        // Handle special cases first
        switch (name) {
            case "view":
                this._viewMode = newValue === "record" ? "record" : "table"
                if (this.isConnected && this._data.hasColumns) {
                    // The record view opens on the focused row, whatever switched the view (Enter, Ctrl+R,
                    // the record view icon or the host)
                    if (this._viewMode === "record") this.dataRecord.recordIndex = this.dataTable.tbodyPosition
                    this.render()
                    this._viewMode === "record" ? this.dataRecord.focus() : this.focusTable()
                }
                return
            case "src":
                this.loadDataFromSrc(newValue)
                return
            case "height":
                this.options.height = newValue ?? FlatbreadDataViewer.defaults.height
                this.updateHeight()
                return
            case "cell-layout":
                // anything else, including no attribute, is no-wrap
                this.options.cellLayout = ["wrap", "truncate"].includes(newValue) ? newValue : "no-wrap"
                this.dataTable?.updateCellLayout()
                this.controlPanel?.updateCellLayout()
                return
        }

        // Styling-only attributes - update stylesheet
        const stylingAttributes = [
            "hide-group-borders",
            "hide-row-borders",
            "hide-index-border",
            "hide-thead-border",
            "hide-filter-row",
        ]
        if (stylingAttributes.includes(name)) {
            switch (name) {
                case "hide-group-borders":
                    this.options.styling.groupBorders = newValue === null
                    break
                case "hide-row-borders":
                    this.options.styling.rowBorders = newValue === null
                    break
                case "hide-index-border":
                    this.options.styling.indexBorder = newValue === null
                    break
                case "hide-thead-border":
                    this.options.styling.theadBorder = newValue === null
                    break
                case "hide-filter-row":
                    this.options.styling.hideFilters = newValue !== null
                    break
            }
            this.updateStylesheet()
            return
        }

        // Attributes that require full render
        switch (name) {
            case "locale":
                this.options.locale = newValue ?? FlatbreadDataViewer.defaults.locale
                this._formatter = new Formatter(this.options)
                this.view.locale = this.options.locale
                this.invalidateColumnWidths()
                break
            case "na-rep":
                this.options.naRep = newValue ?? FlatbreadDataViewer.defaults.naRep
                this.invalidateColumnWidths()
                break
        }
        this.render()
    }

    async loadDataFromSrc(src) {
        try {
            const response = await fetch(src)
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
            const rawData = await response.json()
            this.data = rawData // This should trigger handleDataChange
        } catch (error) {
            console.error("Failed to fetch data:", error)
            this.showErrorMessage("Failed to load data")
        }
    }

    // MARK: get/set
    get data() {
        return this._data
    }

    set data(value) {
        this._data.setData(value)
    }

    // Applying the pending state here covers every order of setting state, data and connecting the element
    get view() {
        if (!this._view || this._viewNeedsUpdate) {
            this._view = new View(this.data, { locale: this.options.locale })
            this._viewNeedsUpdate = false
            if (this.data.hasColumns) this.applyPendingState()
        }
        return this._view
    }

    get viewMode() {
        return this._viewMode
    }

    get formatter() {
        return this._formatter
    }

    // Built on first use; formats the full dataset, so kept until data, locale or naRep change
    get columnWidths() {
        return this._columnWidths ??= new ColumnWidths(this.data, this.formatter)
    }

    invalidateColumnWidths() {
        this._columnWidths = null
    }

    get navigationController() {
        return this._navigationController
    }

    get controlPanel() {
        return this.shadowRoot.querySelector("control-panel")
    }

    get dataTable() {
        return this.shadowRoot.querySelector("data-table")
    }

    // User widths of the visible columns, for the layout popover's reset button
    get userColumnWidthCount() {
        return this.dataTable?.userWidthCount ?? 0
    }

    get dataRecord() {
        return this.shadowRoot.querySelector("data-record")
    }

    get currentRecordIndex() {
        const dataRecord = this.shadowRoot.querySelector("data-record")
        return dataRecord ? dataRecord.recordIndex : 0
    }

    get currentRecord() {
        const dataRecord = this.shadowRoot.querySelector("data-record")
        return dataRecord ? dataRecord.currentRecord : null
    }

    // MARK: api
    // Filters, sort and columns by label (see the readme). Before there is data, the state is kept as given
    // and applied to the first data; the getters return it until then.
    get filters() {
        if (!this.data.hasColumns) return this._pending.filters ?? []
        return [...this.view.filters].map(([key, expression]) => ({ ...this.view.targetOf(key), expression }))
    }

    set filters(filters) {
        this.state = { filters }
    }

    // target: { column: label }, { level: name } or { ilevel: n }; a blank expression removes the filter.
    // With data the target is resolved, so { level: "id" } and { ilevel: 0 } are the same filter
    setFilter(target, expression) {
        if (!this.data.hasColumns) {
            const others = (this._pending.filters ?? []).filter(filter => !sameTarget(filter, target))
            this._pending.filters = expression.trim() ? [...others, { ...target, expression }] : others
            return
        }
        const key = this.keyOf(target)
        if (!key) return
        this.view.setFilter(key, expression)
        this.updateRows()
    }

    clearFilters() {
        this.filters = []
    }

    get sort() {
        if (!this.data.hasColumns) return this._pending.sort ?? null
        const sort = this.view.sort
        return sort && { ...this.view.targetOf(sort.key), direction: sort.direction }
    }

    // { column | level | ilevel, direction: "asc" | "desc" } or null
    set sort(sort) {
        this.state = { sort }
    }

    // Labels of the visible columns, in data order. null before there is data, unless a selection was set
    get selectedColumns() {
        if (!this.data.hasColumns) {
            return this._pending.columnChanges?.length ? null : this._pending.columns ?? null
        }
        return [...this.view.columns.values]
    }

    // Labels; on a multi-index a shorter tuple is a group. A repeated label selects every match. null: all columns
    set selectedColumns(columns) {
        this.state = { columns }
    }

    hideColumns(columns) {
        this.changeColumns({ hide: columns })
    }

    showColumns(columns) {
        this.changeColumns({ show: columns })
    }

    // { columns, filters, sort }: plain data, so a quick selection or a saved setting is a (partial) state.
    // Keys left out are kept; one update and one render for the whole set.
    get state() {
        if (!this.data.hasColumns) {
            const { columnChanges, ...pending } = this._pending
            return pending
        }
        return { columns: this.selectedColumns, filters: this.filters, sort: this.sort }
    }

    set state(state) {
        if (!this.data.hasColumns) {
            const { columns, filters, sort } = state
            if (columns !== undefined) this._pending = { ...this._pending, columns, columnChanges: [] }
            if (filters !== undefined) this._pending.filters = filters
            if (sort !== undefined) this._pending.sort = sort
            return
        }
        this.applyState(state)
        this.commitState({ columns: state.columns !== undefined })
    }

    changeColumns(change) {
        if (!this.data.hasColumns) {
            this._pending.columnChanges = [...this._pending.columnChanges ?? [], change]
            return
        }
        this.applyState({ columnChanges: [change] })
        this.commitState({ columns: true })
    }

    applyPendingState() {
        const pending = this._pending
        this._pending = {}
        this.applyState(pending)
    }

    // Resolves labels and writes the state into the view, without rendering. Unknown labels are warned and left out
    applyState({ columns, columnChanges = [], filters, sort }) {
        if (columns !== undefined || columnChanges.length) {
            let ilocs = columns === undefined ? this.view.columns.sourceIlocs
                : columns === null ? this.data.columns.ilocs
                : this.locateColumns(columns)
            for (const { hide, show } of columnChanges) {
                if (hide) {
                    const hidden = new Set(this.locateColumns(hide))
                    ilocs = ilocs.filter(iloc => !hidden.has(iloc))
                }
                if (show) ilocs = [...ilocs, ...this.locateColumns(show)]
            }
            this.selectColumns(ilocs)
        }
        if (filters !== undefined || sort !== undefined) {
            this.view.setState({
                filters: filters && new Map(filters.flatMap(({ expression, ...target }) => {
                    const key = this.keyOf(target)
                    return key ? [[key, expression]] : []
                })),
                sort: sort === undefined ? undefined : this.sortFor(sort),
            })
        }
    }

    // Renders what changed: a column change rebuilds the table, a filter or sort change the rows
    commitState({ columns }) {
        if (!columns) return this.updateRows()
        this.dataTable?.render()
        this.updateDataRecord()
        this.updateControlPanel()
    }

    // Source ilocs of labels, every match; unknown labels are warned
    locateColumns(columns) {
        return columns.flatMap(label => {
            const ilocs = this.data.columns.locate(label)
            if (!ilocs.length) console.warn("flatbread-data-viewer: unknown column", label)
            return ilocs
        })
    }

    // Key of a filter or sort target; unknown targets are warned, a repeated column label uses the first match
    keyOf(target) {
        const key = this.view.keyOf(target)
        if (key === null) {
            console.warn("flatbread-data-viewer: unknown target (or a repeated level name)", target)
        } else if ("column" in target && this.data.columns.locate(target.column).length > 1) {
            console.warn("flatbread-data-viewer: repeated column label, using the first", target.column)
        }
        return key
    }

    sortFor(sort) {
        if (sort === null) return null
        const { direction, ...target } = sort
        if (direction !== "asc" && direction !== "desc") {
            console.warn("flatbread-data-viewer: sort direction must be \"asc\" or \"desc\"", sort)
            return this.view.sort
        }
        const key = this.keyOf(target)
        return key ? { key, direction } : this.view.sort
    }

    // MARK: render
    render() {
        if (!this.shadowRoot.querySelector("control-panel")) {
            this.shadowRoot.innerHTML = `
                <control-panel></control-panel>
                <data-table></data-table>
                <data-record></data-record>
            `
        }
        if (this.data.hasColumns) {
            this.updateDataTable()
            this.updateDataRecord()
            this.updateControlPanel()
        }
    }

    updateDataTable() {
        if (this.dataTable) {
            this.dataTable.dataViewer = this
        }
    }

    // The container resizes; the table follows through its ResizeObserver
    updateHeight() {
        this._heightSheet.replaceSync(`:host { height: ${this.options.height}; }`)
    }

    updateStylesheet() {
        if (this.dataTable && this.dataTable._stylesheet) {
            this.dataTable._stylesheet.updateComposedStyles()
        }
    }

    updateDataRecord() {
        const dataRecord = this.shadowRoot.querySelector("data-record")
        if (dataRecord) {
            dataRecord.dataViewer = this
            dataRecord.render()
        }
    }

    updateControlPanel() {
        if (!this.data.hasColumns) return

        const columnTree = this.buildColumnTree()
        this.controlPanel.dataViewer = this
        this.controlPanel.columnData = columnTree
        this.controlPanel.selectedColumns = this.view.columns.sourceIlocs
        this.updateControlPanelStatus()
    }

    // MARK: @rows
    // After a change of the filters or the sort in the view; the record view renders only when shown
    updateRows() {
        this.dataTable?.updateRows()
        this.updateDataRecord()
        this.updateControlPanelStatus()
    }

    // MARK: @column
    // The multi-selector's own change: it shows the new selection already, so only the status is updated
    applyColumnSelection(ilocs) {
        this.selectColumns(ilocs)
        this.dataTable?.render()
        this.updateDataRecord()
        this.updateControlPanelStatus()
    }

    // Header ✕: by source iloc, so of two columns with the same label only the clicked one is hidden
    hideColumnsAt(ilocs) {
        const hidden = new Set(ilocs)
        this.selectColumns(this.view.columns.sourceIlocs.filter(iloc => !hidden.has(iloc)))
        this.commitState({ columns: true })
    }

    // Source ilocs, in any order and with repeats; an empty selection shows only the index
    selectColumns(ilocs) {
        const selected = [...new Set(ilocs)].sort((a, b) => a - b)
        this.view.filterColumns(selected.length === this.data.columns.length ? null : selected)
    }

    // Structure only: the selection is set separately (updateControlPanel), so the tree changes only with the columns
    buildColumnTree() {
        if (!this.data.columns.isMultiIndex) {
            return this.buildFlatColumnTree()
        }
        return this.buildLevel(0, 0, this.data.columns.length)
    }

    buildFlatColumnTree() {
        return this.data.columns.values.map((value, iloc) => ({
            label: value,
            value: iloc,
            children: [],
        }))
    }

    buildLevel(level, start, end) {
        if (level === this.data.columns.nlevels - 1) {
            // leaf level: create actual column nodes
            const result = []
            for (let iloc = start; iloc < end; iloc++) {
                const columnValue = this.data.columns.values[iloc]
                const label = Array.isArray(columnValue) ? columnValue[level] : columnValue
                result.push({
                    label: label,
                    value: iloc,
                    children: []
                })
            }
            return result
        }

        // intermediate level: group by spans
        const result = []
        const spans = this.data.columns.spans[level]

        for (const span of spans) {
            const spanEnd = span.iloc + span.count
            if (spanEnd <= start || span.iloc >= end) continue

            const spanStart = Math.max(span.iloc, start)
            const clampedEnd = Math.min(spanEnd, end)

            const children = this.buildLevel(level + 1, spanStart, clampedEnd)

            result.push({
                value: span.value[level],
                children: children
            })
        }

        return result
    }

    updateControlPanelStatus() {
        const controlPanel = this.shadowRoot.querySelector("control-panel")
        if (controlPanel) {
            controlPanel.viewInfo = {
                visibleRows: this.view.length,
                totalRows: this.data.index.length,
                visibleColumns: this.view.columns.length,
                totalColumns: this.data.columns.length
            }
            controlPanel.updateClearButtonState(this.view.hasFilters)
        }
    }

    // MARK: @keyboard
    toggleViewMode() {
        const newView = this._viewMode === "table" ? "record" : "table"
        if (newView === "record" && this.view.length === 0) return
        this.setAttribute("view", newView)
    }

    // Focuses the row of the record shown last, so the table continues where the record view left off
    focusTable() {
        if (this.view.length) {
            this.dataTable.focusTbodyRow(this.dataRecord.recordIndex)
        } else {
            this.focus()
        }
    }

    focusFirstFilter() {
        if (this.dataTable && this._viewMode === "table") {
            const firstFilter = this.dataTable.shadowRoot.querySelector(".columnFilter filter-combo")
            if (firstFilter) {
                firstFilter.focus()
            }
        }
    }

    // MARK: @error
    showErrorMessage(message) {
        this.shadowRoot.innerHTML = `<p style="color: red;">${message}</p>`
    }
}


window.customElements.define('flatbread-data-viewer', FlatbreadDataViewer)
