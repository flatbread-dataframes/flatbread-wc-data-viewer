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
        if (event.shiftKey || event.ctrlKey) {
            return this.handleDataExtractionClick(event)
        }

        if (event.target.matches(".recordViewIcon button")) {
            return this.handleRecordViewClick(event)
        }

        return this.handleCellClick(event)
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
        } else {
            return
        }

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
        const isInHead = tr.closest("thead") !== null
        const isInBody = tr.closest("tbody") !== null

        if (isInHead || (isInBody && cell.tagName === "TD")) {
            const cells = Array.from(tr.children)
            const cellIndex = cells.indexOf(cell)

            if (isInBody) {
                const thCount = cells.filter(c => c.tagName === "TH").length
                return cellIndex - thCount
            }

            const columnLevelLabel = tr.querySelector(".columnLevelNameLabel")
            return columnLevelLabel ? cellIndex - 1 : cellIndex
        }

        return -1
    }
}
