import { TableBuilder } from "./table-builder.js"
import { Stylesheet } from "./stylesheet.js"

export class DataTable extends HTMLElement {
    constructor() {
        super()
        this.attachShadow({ mode: "open" })

        this.handleClick = this.handleClick.bind(this)
        this.handleFilterInput = this.handleFilterInput.bind(this)
        this.handleColumnSort = this.handleColumnSort.bind(this)
        this.handleIndexSort = this.handleIndexSort.bind(this)
        this.handleScroll = this.handleScroll.bind(this)

        this._dataViewer = null
        this._tableBuilder = null
        this._stylesheet = null
    }

    // MARK: setup
    connectedCallback() {
        this.addEventListeners()
        this.render()
    }

    disconnectedCallback() {
        if (this._stylesheet) {
            this._stylesheet.disconnect()
        }
    }

    addEventListeners() {
        this.shadowRoot.addEventListener("click", this.handleClick)
        this.shadowRoot.addEventListener("filter-input", this.handleFilterInput)
        this.shadowRoot.addEventListener("column-sort", this.handleColumnSort)
        this.shadowRoot.addEventListener("index-sort", this.handleIndexSort)
        this.addEventListener("scroll", this.handleScroll)
    }

    removeEventListeners() {
        this.shadowRoot.removeEventListener("click", this.handleClick)
        this.shadowRoot.removeEventListener("filter-input", this.handleFilterInput)
        this.shadowRoot.removeEventListener("column-sort", this.handleColumnSort)
        this.shadowRoot.removeEventListener("index-sort", this.handleIndexSort)
        this.shadowRoot.removeEventListener("scroll", this.handleScroll)
    }

    // MARK: get/set
    get dataViewer() {
        return this._dataViewer
    }

    set dataViewer(value) {
        this._dataViewer = value
        if (value) {
            this._tableBuilder = new TableBuilder(value, value.options)
            this._stylesheet = new Stylesheet(this, value.data, value.options)
            if (this.isConnected) {
                this.render()
            }
        }
    }

    get view() {
        return this._dataViewer?.view
    }

    get options() {
        return this._dataViewer?.options
    }

    // MARK: render
    render() {
        if (!this.dataViewer) return

        this.shadowRoot.innerHTML = `
            <table>
                <thead>${this._tableBuilder.buildThead()}</thead>
                <tbody>${this._tableBuilder.buildTbody(0, this.options.buffer)}</tbody>
            </table>
        `

        this._stylesheet.setupStyles()
        this._stylesheet.updateTheadOffset()
        this._stylesheet.updateIndexOffset()
        this._stylesheet.updateColumnWidths()
    }

    renderTbody() {
        const tbody = this.shadowRoot.querySelector("tbody")
        if (tbody && this._tableBuilder) {
            tbody.innerHTML = this._tableBuilder.buildTbody(0, this.options.buffer)
            this._stylesheet.updateIndexOffset()
            this._stylesheet.updateColumnWidths()
        }
    }

    // MARK: handlers
    handleClick(event) {
        if (event.shiftKey || event.ctrlKey) {
            const cell = event.target.closest("th, td")
            if (!cell) return

            const tr = cell.closest("tr")
            const isInBody = tr.closest("tbody") !== null

            if (event.shiftKey && isInBody) {
                // Dispatch entire row data
                const viewRowIndex = Array.from(tr.parentNode.children).indexOf(tr)
                this.dispatchRowData(viewRowIndex)
                return
            }

            if (event.ctrlKey) {
                // Dispatch entire column data
                const colIndex = this.getColumnIndex(cell, tr)
                if (colIndex !== -1) {
                    this.dispatchColumnData(colIndex)
                    return
                }
            }
        }

        if (event.target.matches(".recordViewIcon button")) {
            event.stopPropagation()
            const viewRowIndex = parseInt(event.target.closest("th").dataset.viewRow)

            this.dispatchEvent(new CustomEvent("enter-record-view", {
                detail: { viewRowIndex },
                bubbles: true,
                composed: true
            }))
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

    handleFilterInput(event) {
        const allFilters = {
            indexFilters: this.getIndexFilters(),
            columnFilters: this.getColumnFilters()
        }

        this.dispatchEvent(new CustomEvent("filters-changed", {
            detail: allFilters,
            bubbles: true,
            composed: true
        }))
    }

    handleColumnSort(event) {
        this.clearAllSorts()
        const clickedHeader = event.target
        if (clickedHeader && event.detail.sortState !== "none") {
            clickedHeader.sortState = event.detail.sortState
        }

        this.dispatchEvent(new CustomEvent("column-sort", {
            detail: event.detail,
            bubbles: true,
            composed: true
        }))
    }

    handleIndexSort(event) {
        this.clearAllSorts()
        const clickedHeader = event.target
        if (clickedHeader && event.detail.sortState !== "none") {
            clickedHeader.sortState = event.detail.sortState
        }

        this.dispatchEvent(new CustomEvent("index-sort", {
            detail: event.detail,
            bubbles: true,
            composed: true
        }))
    }

    handleScroll(event) {
        event.stopPropagation()
        const table = event.target
        const tbody = this.shadowRoot.querySelector("tbody")

        const scrollThreshold = 150
        const nearBottom = table.scrollHeight - (table.scrollTop + table.clientHeight) < scrollThreshold

        if (nearBottom && tbody) {
            this.dispatchEvent(new CustomEvent("load-more-rows", {
                detail: {
                    currentRowCount: tbody.rows.length,
                    bufferSize: this.dataViewer.options.buffer
                },
                bubbles: true,
                composed: true
            }))
        }
    }

    // MARK: @filter
    getIndexFilters() {
        const indexFilterInputs = this.shadowRoot.querySelectorAll(".indexFilter filter-input")
        return Array.from(indexFilterInputs).map(filterEl => {
            const th = filterEl.closest("th")
            const level = parseInt(th.dataset.level)
            return { level, value: filterEl.value.trim() }
        }).filter(filter => filter.value !== "")
    }

    getColumnFilters() {
        const columnFilterInputs = this.shadowRoot.querySelectorAll(".columnFilter filter-input")
        return Array.from(columnFilterInputs).map(filterEl => {
            const th = filterEl.closest("th")
            const col = parseInt(th.dataset.col)
            return { col, value: filterEl.value.trim() }
        }).filter(filter => filter.value !== "")
    }

    clearAllFilters() {
        const allFilterInputs = this.shadowRoot.querySelectorAll("filter-input")
        allFilterInputs.forEach(filterInput => filterInput.clear())

        this.dispatchEvent(new CustomEvent("filters-changed", {
            detail: {
                indexFilters: [],
                columnFilters: []
            },
            bubbles: true,
            composed: true
        }))
    }

    // MARK: @sort
    clearAllSorts() {
        this.shadowRoot.querySelectorAll('sortable-column-header').forEach(header => {
            header.clearSort()
        })
    }

    // MARK: @click
    dispatchRowData(viewRowIndex) {
        const rowData = {
            index: this.dataViewer.view.index.values[viewRowIndex],
            values: this.dataViewer.view.values[viewRowIndex],
            originalIndex: this.dataViewer.view.visibleIndices[viewRowIndex]
        }

        this.dispatchEvent(new CustomEvent("row-data", {
            detail: rowData,
            bubbles: true,
            composed: true
        }))
    }

    dispatchColumnData(colIndex) {
        const columnValues = this.dataViewer.view.values.map(row => row[colIndex])
        const columnData = {
            header: this.dataViewer.view.columns.values[colIndex],
            values: columnValues,
            dtype: this.dataViewer.view.columns.attrs[colIndex]?.dtype
        }

        this.dispatchEvent(new CustomEvent("column-data", {
            detail: columnData,
            bubbles: true,
            composed: true
        }))
    }

    getColumnIndex(cell, tr) {
        const isInHead = tr.closest("thead") !== null
        const isInBody = tr.closest("tbody") !== null

        if (isInHead || (isInBody && cell.tagName === "TD")) {
            // For thead or tbody data cells, find the column index
            const cells = Array.from(tr.children)
            const cellIndex = cells.indexOf(cell)

            if (isInBody) {
                // In tbody, subtract the number of th elements (index columns)
                const thCount = cells.filter(c => c.tagName === "TH").length
                return cellIndex - thCount
            }

            // In thead, need to account for the column level name label
            const columnLevelLabel = tr.querySelector(".columnLevelNameLabel")
            return columnLevelLabel ? cellIndex - 1 : cellIndex
        }

        return -1 // Not a data column
    }
}

customElements.define("data-table", DataTable)
