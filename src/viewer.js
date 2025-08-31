import { Data } from "./data/data.js"
import { View } from "./data/view.js"
import "./components/record/data-record.js"
import "./components/table/data-table.js"
import "./components/control-panel.js"
import "./components/filter-input.js"
import "./components/sortable-column-header.js"
import "https://lcvriend.github.io/wc-multi-selector/src/wc-multi-selector.js"


export class DataViewer extends HTMLElement {
    static get observedAttributes() {
        return [
            "view", "src", "locale", "na-rep",
            "hide-group-borders", "hide-row-borders",
            "hide-thead-border", "hide-index-border",
        ]
    }

    static get defaults() {
        return {
            locale: "default",
            naRep: "-",
            buffer: 30,
            styling: {
                groupBorders: true,
                rowBorders: true,
                hoverEffect: true,
                theadBorder: true,
                indexBorder: true,
            }
        }
    }

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
        this.options = { ...DataViewer.defaults }

        this.handleDataChange = this.handleDataChange.bind(this)
        this.handleTableClick = this.handleTableClick.bind(this)
        this.handleEnterRecordView = this.handleEnterRecordView.bind(this)
        this.handleExitRecordView = this.handleExitRecordView.bind(this)

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
        this.shadowRoot.addEventListener("click", this.handleTableClick)
        this.shadowRoot.addEventListener("enter-record-view", this.handleEnterRecordView)
        this.shadowRoot.addEventListener("exit-record-view", this.handleExitRecordView)
        this.shadowRoot.addEventListener("filters-changed", this.handleFiltersChanged)
        this.shadowRoot.addEventListener("clear-all-filters", this.handleClearAllFilters)
        this.shadowRoot.addEventListener("column-sort", this.handleColumnSort)
        this.shadowRoot.addEventListener("index-sort", this.handleIndexSort)
        this.shadowRoot.addEventListener("column-selection-changed", this.handleColumnSelectionChange)
        this.shadowRoot.addEventListener("load-more-rows", this.handleLoadMoreRows)
    }

    removeEventListeners() {
        this.data.removeEventListener("data-changed", this.handleDataChange)
        this.shadowRoot.removeEventListener("click", this.handleTableClick)
        this.shadowRoot.removeEventListener("exit-record-view", this.handleExitRecordView)
        this.shadowRoot.removeEventListener("clear-all-filters", this.handleClearAllFilters)
        this.shadowRoot.removeEventListener("column-sort", this.handleColumnSort)
        this.shadowRoot.removeEventListener("index-sort", this.handleIndexSort)
        this.shadowRoot.removeEventListener("column-selection-changed", this.handleColumnSelectionChange)
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return
        switch (name) {
            case "view":
                this._viewMode = newValue === "record" ? "record" : "table"
                if (this.isConnected && this._data.hasColumns) { // Only render if we have data
                    this.render()
                }
                break
            case "src":
                this.loadDataFromSrc(newValue)
                break
            case "locale":
                this.options.locale = newValue ?? DataViewer.defaults.locale
                this.render()
                break
            case "na-rep":
                this.options.naRep = newValue ?? DataViewer.defaults.naRep
                this.render()
                break
            case "hide-group-borders":
                this.options.styling.groupBorders = newValue === null
                this.render()
                break
            case "hide-row-borders":
                this.options.styling.rowBorders = newValue === null
                this.render()
                break
            case "hide-index-border":
                this.options.styling.indexBorder = newValue === null
                this.render()
                break
            case "hide-thead-border":
                this.options.styling.theadBorder = newValue === null
                this.render()
                break
        }
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

    // MARK: render
    render() {
        if (!this.shadowRoot.querySelector("control-panel")) {
            this.shadowRoot.innerHTML = `
                <style>
                    :root {
                        box-sizing: border-box;
                    }
                    :host {
                        display: grid;
                        cursor: var(--cursor, auto);
                        max-height: var(--height, 600px);
                        grid-template-areas:
                            "control-panel"
                            "view";
                    }

                    data-table,
                    data-record {
                        grid-area: view;
                        overflow-y: auto;
                        overscroll-behavior: none;
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

                    control-panel {
                        --background-color: var(--background-color);
                        grid-area: control-panel;
                    }

                </style>
                <control-panel></control-panel>
                <data-table></data-table>
                <data-record></data-record>
            `
        }
        if (this.data.hasColumns) {
            this.updateDataTable()
            this.updateDataRecord()
        }
    }

    updateDataTable() {
        const dataTable = this.shadowRoot.querySelector("data-table")
        if (dataTable) {
            dataTable.dataViewer = this
        }
    }

    updateControlPanel() {
        if (!this.data.hasColumns) return

        const columnTree = this.buildColumnTree()
        const controlPanel = this.shadowRoot.querySelector("control-panel")
        controlPanel.columnData = columnTree
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
        }

        this.dispatchEvent(new CustomEvent("data-changed", { detail: this.data }))
}

    handleTableClick(event) {
        if (event.target.matches(".recordViewIcon button")) {
            event.stopPropagation()
            const viewRowIndex = parseInt(event.target.closest("th").dataset.viewRow)
            this.enterRecordView(viewRowIndex)
            return
        }

        const cell = event.target.closest("th, td")
        if (!cell) return

        const tr = cell.closest("tr")
        const isInHead = tr.closest("thead") !== null
        const isInBody = tr.closest("tbody") !== null

        let source, row, col

        if (isInHead) {
            source = "column"
            row = Array.from(tr.parentNode.children).indexOf(tr)
            col = Array.from(tr.children).indexOf(cell)
        } else if (isInBody) {
            if (cell.tagName === "TH") {
                source = "index"
                row = Array.from(tr.parentNode.children).indexOf(tr)
                col = Array.from(tr.children).filter(c => c.tagName === "TH").indexOf(cell)
            } else {
                source = "values"
                row = Array.from(tr.parentNode.children).indexOf(tr)
                col = Array.from(tr.children).filter(c => c.tagName === "TD").indexOf(cell)
            }
        } else {
            return // Not in thead or tbody, ignore
        }

        const value = cell.textContent

        this.dispatchEvent(new CustomEvent("cell-click", {
            detail: { value, source, row, col },
            bubbles: true,
            composed: true
        }))
    }

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

    updateDataRecord() {
        const dataRecord = this.shadowRoot.querySelector("data-record")
        if (dataRecord) {
            dataRecord.dataViewer = this
        }
    }

    // MARK: @filter
    handleFiltersChanged(event) {
        const { indexFilters, columnFilters } = event.detail
        this.applyFiltersWithData(indexFilters, columnFilters)
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
    }

    applyColumnFilter(selectedColumnIndices) {
        if (selectedColumnIndices.length === 0) {
            this.view.filterColumns(null)
        } else {
            this.view.filterColumns(selectedColumnIndices)
        }

        this.render()
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
