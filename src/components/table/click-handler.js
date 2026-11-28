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
        // the click that ends a drag or a reset (ColumnResizer) is not a header click
        if (event.target.closest(".resize-handle")) return
        if (this.handleHideClick(event)) return

        if (event.target.closest(".filter-row, .spacer")) return

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
            const iloc = Number(hideButton.dataset.col)
            multiSelector.removeSelectedValues(this.dataTable.view.columns.sourceIlocs[iloc])
        }

        return true
    }

    handleDataExtractionClick(event) {
        const cell = event.target.closest("th, td")
        if (!cell) return

        const tr = cell.closest("tr")
        const isInBody = tr.closest("tbody") !== null

        if (event.shiftKey && isInBody) {
            const viewRowIndex = Number(tr.dataset.viewRow)
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

            const colIndex = this.getColumnIndex(cell)
            if (colIndex !== -1) {
                this.dispatchColumnData(colIndex)
                return
            }
        }
    }

    handleRecordViewClick(event) {
        event.stopPropagation()
        const viewRowIndex = parseInt(event.target.closest("th").dataset.viewRow)
        // The record view opens on the focused row; a click does not focus the button in every browser
        this.dataTable.focusTbodyRow(viewRowIndex)

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
                if (cell.matches(".recordViewIcon")) return
                source = "index"
                col = Number(cell.dataset.level)
                // A group cell reports the first row of its group; its tr can be the first row of the window
                row = cell.matches(".group")
                    ? this.dataTable.view.index.spans[col][Number(cell.dataset.group)].iloc
                    : Number(tr.dataset.viewRow)
            } else {
                source = "values"
                row = Number(tr.dataset.viewRow)
                col = Array.from(tr.children).filter(c => c.tagName === "TD").indexOf(cell)
            }
        } else return

        const value = isInHead ? this.getHeaderLabel(cell) : cell.textContent

        this.dataTable.dispatchEvent(new CustomEvent("cell-click", {
            detail: { value, source, row, col },
            bubbles: true,
            composed: true
        }))
    }

    // The label of a header cell, without the sort and hide buttons
    getHeaderLabel(cell) {
        return cell.querySelector(".label")?.textContent ?? cell.textContent.trim()
    }

    dispatchRowData(viewRowIndex) {
        const view = this.dataTable.view
        const rowData = {
            index: view.index.values[viewRowIndex],
            values: view.valuesSlice(viewRowIndex, viewRowIndex + 1)[0],
            originalIndex: view.index.sourceIlocs[viewRowIndex]
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
            header: view.index.names?.[level] || `Index Level ${level}`,
            values: indexValues,
            dtype: view.index.attrs[level]?.dtype ?? null
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

    // View iloc of a column header, filter or value cell; -1 for other cells
    getColumnIndex(cell) {
        return cell.dataset.col === undefined ? -1 : Number(cell.dataset.col)
    }
}
