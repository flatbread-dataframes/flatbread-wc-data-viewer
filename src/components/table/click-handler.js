export class ClickHandler {
    constructor(dataTable) {
        this.dataTable = dataTable
        this.handleClick = this.handleClick.bind(this)
    }

    addEventListeners() {
        this.dataTable.shadowRoot.addEventListener("click", this.handleClick)
    }

    removeEventListeners() {
        this.dataTable.shadowRoot.removeEventListener("click", this.handleClick)
    }

    handleClick(event) {
        if (this.handleHideClick(event)) return

        if (event.shiftKey || event.ctrlKey) {
            return this.handleDataExtractionClick(event)
        }

        if (event.target.matches(".recordViewIcon button")) {
            return this.handleRecordViewClick(event)
        }

        return this.handleCellClick(event)
    }

    handleHideClick(event) {
        const hideButton = event.target.closest(".hide-button")
        if (!hideButton) return false

        event.stopPropagation()

        const hideType = hideButton.dataset.hideType
        const multiSelector = this.dataTable.dataViewer.controlPanel.shadowRoot.querySelector("multi-selector")

        if (hideType === "group") {
            const level = parseInt(hideButton.dataset.level)
            const groupIndex = parseInt(hideButton.dataset.group)
            const span = this.dataTable.dataViewer.view.columns.spans[level][groupIndex]
            multiSelector.removeSelectedValues(span.value[level])
        } else if (hideType === "column") {
            const originalColIndex = parseInt(hideButton.closest("th").dataset.originalCol)
            multiSelector.removeSelectedValues(originalColIndex)
        }

        return true
    }

    handleDataExtractionClick(event) {
        const cell = event.target.closest("th, td")
        if (!cell) return

        const tr = cell.closest("tr")
        const isInBody = tr.closest("tbody") !== null

        if (event.shiftKey && isInBody) {
            const viewRowIndex = Array.from(tr.parentNode.children).indexOf(tr)
            this.dispatchRowData(viewRowIndex)
            return
        }

        if (event.ctrlKey) {
            if (isInBody && cell.tagName === "TH") {
                const level = parseInt(cell.dataset.level)
                if (!isNaN(level)) {
                    this.dispatchIndexColumnData(level)
                    return
                }
            }

            const colIndex = this.getColumnIndex(cell, tr)
            if (colIndex !== -1) {
                this.dispatchColumnData(colIndex)
                return
            }
        }
    }

    handleRecordViewClick(event) {
        event.stopPropagation()
        const viewRowIndex = parseInt(event.target.closest("th").dataset.viewRow)

        this.dataTable.dispatchEvent(new CustomEvent("enter-record-view", {
            detail: { viewRowIndex },
            bubbles: true,
            composed: true
        }))
    }

    handleCellClick(event) {
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
        } else return

        const value = cell.textContent

        this.dataTable.dispatchEvent(new CustomEvent("cell-click", {
            detail: { value, source, row, col },
            bubbles: true,
            composed: true
        }))
    }

    dispatchRowData(viewRowIndex) {
        const rowData = {
            index: this.dataTable.dataViewer.view.index.values[viewRowIndex],
            values: this.dataTable.dataViewer.view.values[viewRowIndex],
            originalIndex: this.dataTable.dataViewer.view.visibleIndices[viewRowIndex]
        }

        this.dataTable.dispatchEvent(new CustomEvent("row-data", {
            detail: rowData,
            bubbles: true,
            composed: true
        }))
    }

    dispatchIndexColumnData(level) {
        const view = this.dataTable.dataViewer.view
        const indexValues = view.index.values.map(indexValue => {
            return Array.isArray(indexValue) ? indexValue[level] : indexValue
        })

        const indexData = {
            header: view.indexNames?.[level] || `Index Level ${level}`,
            values: indexValues,
            dtype: null // index columns don't have dtypes like data columns
        }

        this.dataTable.dispatchEvent(new CustomEvent("column-data", {
            detail: indexData,
            bubbles: true,
            composed: true
        }))
    }

    dispatchColumnData(colIndex) {
        const columnValues = this.dataTable.dataViewer.view.values.map(row => row[colIndex])
        const columnData = {
            header: this.dataTable.dataViewer.view.columns.values[colIndex],
            values: columnValues,
            dtype: this.dataTable.dataViewer.view.columns.attrs[colIndex]?.dtype
        }

        this.dataTable.dispatchEvent(new CustomEvent("column-data", {
            detail: columnData,
            bubbles: true,
            composed: true
        }))
    }

    getColumnIndex(cell, tr) {
        if (cell.dataset.originalCol) {
            return parseInt(cell.dataset.originalCol)
        }

        const tdIndex = Array.from(tr.querySelectorAll('td')).indexOf(cell)
        const table = tr.closest('table')
        const headerRow = table.querySelector('thead tr:has(.columnFilter)')
        const correspondingTh = headerRow.querySelectorAll('th[data-original-col]')[tdIndex]

        return correspondingTh ? parseInt(correspondingTh.dataset.originalCol) : -1
    }
}
