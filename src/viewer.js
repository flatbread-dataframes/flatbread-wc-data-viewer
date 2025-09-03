import { Data } from "./data/data.js"
import { View } from "./data/view.js"
import "./components/record/data-record.js"
import "./components/table/data-table.js"
import "./components/control-panel.js"
import "./components/filter-input.js"
import "./components/sortable-column-header.js"
import "https://lcvriend.github.io/wc-multi-selector/src/wc-multi-selector.js"


export class DataViewer extends HTMLElement {
    get styles() {
        return `
            :root {
                box-sizing: border-box;
            }
            :host {
                display: grid;
                cursor: var(--cursor, auto);
                height: ${this.options.height};
                grid-template-areas:
                    "control-panel"
                    "view";
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
        `
    }

    static get observedAttributes() {
        return [
            "view", "src", "locale", "na-rep", "height",
            "hide-group-borders", "hide-row-borders",
            "hide-thead-border", "hide-index-border",
            "hide-filter-row",
        ]
    }

    static get defaults() {
        return {
            locale: "default",
            naRep: "-",
            buffer: 30,
            height: "600px",
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
        this.options = { ...DataViewer.defaults }

        this.handleDataChange = this.handleDataChange.bind(this)

        this.handleCellClick = this.handleCellClick.bind(this)
        this.handleFieldClick = this.handleFieldClick.bind(this)

        this.handleEnterRecordView = this.handleEnterRecordView.bind(this)
        this.handleExitRecordView = this.handleExitRecordView.bind(this)

        this.handleToggleFilterRow = this.handleToggleFilterRow.bind(this)
        this.handleFiltersChanged = this.handleFiltersChanged.bind(this)
        this.handleClearAllFilters = this.handleClearAllFilters.bind(this)

        this.handleColumnSelectionChange = this.handleColumnSelectionChange.bind(this)

        this.handleColumnSort = this.handleColumnSort.bind(this)
        this.handleIndexSort = this.handleIndexSort.bind(this)

        this.handleLoadMoreRows = this.handleLoadMoreRows.bind(this)

        this._data = new Data()
    }

    // MARK: setup
    connectedCallback() {
        // set default mode if not provided
        if (!this.hasAttribute("view")) {
            this.setAttribute("view", "table")
        }

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
        this.data.removeEventListener("data-changed", this.handleDataChange)
        this.removeEventListeners()
        this.stylesheet.disconnect()
    }

    addEventListeners() {
        this.data.addEventListener("data-changed", this.handleDataChange)
        this.shadowRoot.addEventListener("cell-click", this.handleCellClick)
        this.shadowRoot.addEventListener("field-click", this.handleFieldClick)
        this.shadowRoot.addEventListener("enter-record-view", this.handleEnterRecordView)
        this.shadowRoot.addEventListener("exit-record-view", this.handleExitRecordView)
        this.shadowRoot.addEventListener("toggle-filter-row", this.handleToggleFilterRow)
        this.shadowRoot.addEventListener("filters-changed", this.handleFiltersChanged)
        this.shadowRoot.addEventListener("clear-all-filters", this.handleClearAllFilters)
        this.shadowRoot.addEventListener("column-sort", this.handleColumnSort)
        this.shadowRoot.addEventListener("index-sort", this.handleIndexSort)
        this.shadowRoot.addEventListener("column-selection-changed", this.handleColumnSelectionChange)
        this.shadowRoot.addEventListener("load-more-rows", this.handleLoadMoreRows)
    }

    removeEventListeners() {
        this.data.removeEventListener("data-changed", this.handleDataChange)
        this.shadowRoot.removeEventListener("cell-click", this.handleCellClick)
        this.shadowRoot.removeEventListener("field-click", this.handleFieldClick)
        this.shadowRoot.removeEventListener("enter-record-view", this.handleEnterRecordView)
        this.shadowRoot.removeEventListener("exit-record-view", this.handleExitRecordView)
        this.shadowRoot.removeEventListener("toggle-filter-row", this.handleToggleFilterRow)
        this.shadowRoot.removeEventListener("filters-changed", this.handleFiltersChanged)
        this.shadowRoot.removeEventListener("clear-all-filters", this.handleClearAllFilters)
        this.shadowRoot.removeEventListener("column-sort", this.handleColumnSort)
        this.shadowRoot.removeEventListener("index-sort", this.handleIndexSort)
        this.shadowRoot.removeEventListener("column-selection-changed", this.handleColumnSelectionChange)
        this.shadowRoot.removeEventListener("load-more-rows", this.handleLoadMoreRows)
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return
        switch (name) {
            case "view":
                this._viewMode = newValue === "record" ? "record" : "table"
                if (this.isConnected && this._data.hasColumns) { // Only render if we have data
                    this.render()
                }
                return
            case "src":
                this.loadDataFromSrc(newValue)
                return
            case "locale":
                this.options.locale = newValue ?? DataViewer.defaults.locale
                break
            case "na-rep":
                this.options.naRep = newValue ?? DataViewer.defaults.naRep
                break
            case "height":
                this.options.height = newValue ?? DataViewer.defaults.height
                break
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

    get view() {
        if (!this._view || this._viewNeedsUpdate) {
            this._view = new View(this.data)
            this._viewNeedsUpdate = false
        }
        return this._view
    }

    get viewMode() {
        return this._viewMode
    }

    get currentRecordIndex() {
        const dataRecord = this.shadowRoot.querySelector("data-record")
        return dataRecord ? dataRecord.recordIndex : 0
    }

    get currentRecord() {
        const dataRecord = this.shadowRoot.querySelector("data-record")
        return dataRecord ? dataRecord.currentRecord : null
    }

    get resolvedColors() {
        const background = getComputedStyle(this).backgroundColor || 'white'

        return {
            background,
            hover: `color-mix(in srgb, ${background} 90%, currentColor 10%)`,
            border: 'currentColor'
        }
    }

    // MARK: render
    render() {
        if (!this.shadowRoot.querySelector("control-panel")) {
            this.shadowRoot.innerHTML = `
                <style>${this.styles}</style>
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
        const dataTable = this.shadowRoot.querySelector("data-table")
        if (dataTable) {
            dataTable.dataViewer = this
        }
    }

    updateDataRecord() {
        const dataRecord = this.shadowRoot.querySelector("data-record")
        if (dataRecord) {
            dataRecord.dataViewer = this
        }
    }

    updateControlPanel() {
        if (!this.data.hasColumns) return

        const columnTree = this.buildColumnTree()
        const controlPanel = this.shadowRoot.querySelector("control-panel")
        controlPanel.dataViewer = this
        controlPanel.columnData = columnTree

        // Add view info for status display
        controlPanel.viewInfo = {
            visibleRows: this.view.visibleIndices.length,
            totalRows: this.data.index.length,
            visibleColumns: this.view.columns.length,
            totalColumns: this.data.columns.length
        }

        controlPanel.showFilters = !this.hasAttribute("hide-filter-row")
    }

    // MARK: handlers
    handleDataChange(event) {
        this._viewNeedsUpdate = true

        if (event.detail.isValuesOnly) {
            this.updateDataTable()
            this.updateDataRecord()
            const dataTable = this.shadowRoot.querySelector("data-table")
            if (dataTable) dataTable.renderTbody()
        } else {
            this.render()
            this.updateControlPanel()
        }

        this.dispatchEvent(new CustomEvent("data-changed", { detail: this.data }))
    }

    handleCellClick(event) {
        this.dispatchEvent(new CustomEvent("cell-click", {
            detail: event.detail,
            bubbles: true,
            composed: true
        }))
    }

    handleFieldClick(event) {
        this.dispatchEvent(new CustomEvent("field-click", {
            detail: event.detail,
            bubbles: true,
            composed: true
        }))
    }

    // MARK: @record
    handleEnterRecordView(event) {
        const { viewRowIndex } = event.detail
        this.enterRecordView(viewRowIndex)
    }

    enterRecordView(viewRowIndex) {
        const dataRecord = this.shadowRoot.querySelector("data-record")
        if (dataRecord) {
            dataRecord.recordIndex = viewRowIndex
        }
        this.setAttribute("view", "record")
    }

    handleExitRecordView(event) {
        event.stopPropagation()
        this.setAttribute("view", "table")
    }

    // MARK: @filter
    handleToggleFilterRow(event) {
        if (this.hasAttribute("hide-filter-row")) {
            this.removeAttribute("hide-filter-row")
        } else {
            this.setAttribute("hide-filter-row", "")
        }
        this.updateControlPanel()
    }

    handleFiltersChanged(event) {
        const { indexFilters, columnFilters } = event.detail

        // Update control panel button state
        const controlPanel = this.shadowRoot.querySelector("control-panel")
        if (controlPanel) {
            const hasActiveFilters = indexFilters.length > 0 || columnFilters.length > 0
            controlPanel.updateClearButtonState(hasActiveFilters)
        }

        this.applyFiltersWithData(indexFilters, columnFilters)
        this.updateControlPanelStatus()
    }

    applyFiltersWithData(indexFilters, columnFilters) {
        if (indexFilters.length === 0 && columnFilters.length === 0) {
            this.view.reset()
        } else {
            const predicates = []
            if (indexFilters.length > 0) predicates.push(this.createIndexPredicate(indexFilters))
            if (columnFilters.length > 0) predicates.push(this.createColumnPredicate(columnFilters))

            const combinedPredicate = (rowValues, rowIndex) => {
                return predicates.every(predicate => predicate(rowValues, rowIndex))
            }

            this.view.filter(combinedPredicate)
        }

        const dataTable = this.shadowRoot.querySelector("data-table")
        if (dataTable) {
            dataTable.renderTbody()
        }
    }

    createIndexPredicate(indexFilters) {
        return (rowValues, rowIndex) => {
            return indexFilters.every(filter => {
                const indexValue = this.data.index.values[rowIndex]
                const levelValue = Array.isArray(indexValue)
                    ? indexValue[filter.level]
                    : indexValue
                return levelValue != null &&
                    levelValue.toString().toLowerCase().includes(filter.value.toLowerCase())
            })
        }
    }

    createColumnPredicate(columnFilters) {
        return (rowValues, rowIndex) => {
            return columnFilters.every(filter => {
                const originalColumnIndex = this.view._visibleColumnIndices
                    ? this.view._visibleColumnIndices[filter.col]
                    : filter.col
                const cellValue = rowValues[originalColumnIndex]
                return cellValue != null &&
                    cellValue.toString().toLowerCase().includes(filter.value.toLowerCase())
            })
        }
    }

    handleClearAllFilters() {
        const dataTable = this.shadowRoot.querySelector("data-table")
        if (dataTable) {
            dataTable.clearAllFilters()
        }
    }

    // MARK: @column
    handleColumnSelectionChange(event) {
        const selectedColumnIndices = event.detail.selectedColumns
        this.applyColumnFilter(selectedColumnIndices)
        this.updateControlPanelStatus()
    }

    applyColumnFilter(selectedColumnIndices) {
        if (selectedColumnIndices.length === 0) {
            this.view.filterColumns(null)
        } else {
            this.view.filterColumns(selectedColumnIndices)
        }

        const dataTable = this.shadowRoot.querySelector("data-table")
        if (dataTable) {
            dataTable.render()
        }
        this.updateDataRecord()
    }

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
            selected: true,
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
                    selected: true,
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
                visibleRows: this.view.visibleIndices.length,
                totalRows: this.data.index.length,
                visibleColumns: this.view.columns.length,
                totalColumns: this.data.columns.length
            }
        }
    }

    // MARK: @sort
    handleColumnSort(event) {
        const { columnIndex, sortState } = event.detail
        if (sortState === "none") {
            this.view.reset()
        } else {
            this.view.sortByColumn(columnIndex, sortState)
        }

        const dataTable = this.shadowRoot.querySelector("data-table")
        if (dataTable) {
            dataTable.renderTbody()
        }
    }

    handleIndexSort(event) {
        const { level, sortState } = event.detail
        if (sortState === "none") {
            this.view.reset()
        } else {
            this.view.sortByIndex(level, sortState)
        }

        const dataTable = this.shadowRoot.querySelector("data-table")
        if (dataTable) {
            dataTable.renderTbody()
        }
    }

    // MARK: @scroll
    handleLoadMoreRows(event) {
        const { currentRowCount, bufferSize } = event.detail

        const dataTable = this.shadowRoot.querySelector("data-table")
        if (dataTable) {
            const tbody = dataTable.shadowRoot.querySelector("tbody")
            if (tbody) {
                const start = currentRowCount
                const end = start + bufferSize
                tbody.innerHTML += dataTable._tableBuilder.buildTbody(start, end)
            }
        }
    }

    showErrorMessage(message) {
        this.shadowRoot.innerHTML = `
            ${this.getStyleSheet()}
            <p style="color: red;">${message}</p>
        `
    }
}


window.customElements.define('data-viewer', DataViewer)
