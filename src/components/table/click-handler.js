import { columnKey, levelKey } from "../../data/view.js"

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
        // a click on a sort button sorts; it is not a click on its header cell
        if (event.target.closest("sort-button")) return
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
            this.dispatchRowData(Number(tr.dataset.viewRow))
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

            const viewCol = this.getColumnIndex(cell)
            if (viewCol !== -1) {
                this.dispatchColumnData(viewCol)
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

        const detail = this.cellDetail(cell)
        if (!detail) return

        this.dataTable.dispatchEvent(new CustomEvent("cell-click", {
            detail,
            bubbles: true,
            composed: true
        }))
    }

    // MARK: cell detail
    // The public detail of a cell: labels and source positions, never view positions (see the readme).
    // null for cells that report nothing (record view icons, empty header cells).
    cellDetail(cell) {
        const section = cell.closest("thead, tbody")?.tagName
        if (section === "THEAD") return this.headerCellDetail(cell)
        if (section === "TBODY") return this.bodyCellDetail(cell)
        return null
    }

    headerCellDetail(cell) {
        if (cell.matches(".columnLevelNameLabel")) return this.columnNameDetail(cell)
        if (cell.matches(".indexLevelNameLabel")) return this.indexNameDetail(cell)
        if (cell.dataset.group !== undefined) return this.columnGroupDetail(cell)
        if (cell.dataset.col !== undefined) return this.columnLabelDetail(cell)
        return null
    }

    bodyCellDetail(cell) {
        if (cell.tagName === "TD") return this.valueDetail(cell)
        if (cell.matches(".recordViewIcon") || cell.dataset.level === undefined) return null
        return cell.dataset.group !== undefined ? this.indexGroupDetail(cell) : this.indexDetail(cell)
    }

    valueDetail(cell) {
        const view = this.dataTable.view
        const viewRow = Number(cell.closest("tr").dataset.viewRow)
        const viewCol = Number(cell.dataset.col)
        return {
            source: "values",
            value: view.valuesSlice(viewRow, viewRow + 1)[0][viewCol],
            text: cell.textContent,
            row: view.index.entry(viewRow),
            column: view.columns.entry(viewCol),
        }
    }

    indexDetail(cell) {
        const index = this.dataTable.view.index
        const level = Number(cell.dataset.level)
        const row = index.entry(Number(cell.closest("tr").dataset.viewRow))
        return {
            source: "index",
            value: index.isMultiIndex ? row.loc[level] : row.loc,
            text: cell.textContent,
            row,
            level: index.levelEntry(level),
        }
    }

    // A group cell stands for its group: the prefix tuple, and no iloc, as a group's rows need not be adjacent in the data
    indexGroupDetail(cell) {
        const index = this.dataTable.view.index
        const level = Number(cell.dataset.level)
        const span = index.spans[level][Number(cell.dataset.group)]
        return {
            source: "index",
            value: span.value[level],
            text: cell.textContent,
            row: { loc: span.value },
            level: index.levelEntry(level),
        }
    }

    columnLabelDetail(cell) {
        const columns = this.dataTable.view.columns
        const column = columns.entry(Number(cell.dataset.col))
        return {
            source: "column",
            value: columns.isMultiIndex ? column.loc.at(-1) : column.loc,
            text: this.getHeaderLabel(cell),
            column,
        }
    }

    // As indexGroupDetail: the prefix tuple, no iloc
    columnGroupDetail(cell) {
        const columns = this.dataTable.view.columns
        const level = Number(cell.dataset.level)
        const span = columns.spans[level][Number(cell.dataset.group)]
        return {
            source: "column",
            value: span.value[level],
            text: this.getHeaderLabel(cell),
            column: { loc: span.value },
            level: columns.levelEntry(level),
        }
    }

    // The name cell of a column group row carries its row's level; the one in the columns row is the last level
    columnNameDetail(cell) {
        const columns = this.dataTable.view.columns
        const { level } = cell.closest("tr").dataset
        const entry = columns.levelEntry(level === undefined ? columns.nlevels - 1 : Number(level))
        return { source: "column-name", value: entry.loc, text: cell.textContent.trim(), level: entry }
    }

    indexNameDetail(cell) {
        const entry = this.dataTable.view.index.levelEntry(Number(cell.dataset.level))
        return { source: "index-name", value: entry.loc, text: this.getHeaderLabel(cell), level: entry }
    }

    // The label of a header cell, without the sort and hide buttons
    getHeaderLabel(cell) {
        return cell.querySelector(".label")?.textContent ?? cell.textContent.trim()
    }

    // MARK: data extraction
    // The cells as shown (hidden columns and filtered rows are left out), each with its identity
    dispatchRowData(viewRow) {
        const view = this.dataTable.view
        const rowData = {
            row: view.index.entry(viewRow),
            columns: view.columns.entries(),
            values: view.valuesSlice(viewRow, viewRow + 1)[0],
        }

        this.dataTable.dispatchEvent(new CustomEvent("row-data", {
            detail: rowData,
            bubbles: true,
            composed: true
        }))
    }

    dispatchIndexColumnData(level) {
        const view = this.dataTable.view
        const valueAt = view.valueGetter(levelKey(level))
        const indexData = {
            level: view.index.levelEntry(level),
            dtype: view.index.attrs[level]?.dtype ?? null,
            rows: view.index.entries(),
            values: view.index.sourceIlocs.map(valueAt),
        }

        this.dataTable.dispatchEvent(new CustomEvent("column-data", {
            detail: indexData,
            bubbles: true,
            composed: true
        }))
    }

    // Reads the column through the data rather than building every row of the view (view.values)
    dispatchColumnData(viewCol) {
        const view = this.dataTable.view
        const column = view.columns.entry(viewCol)
        const valueAt = view.valueGetter(columnKey(column.iloc))
        const columnData = {
            column,
            dtype: view.columns.attrs[viewCol]?.dtype ?? null,
            rows: view.index.entries(),
            values: view.index.sourceIlocs.map(valueAt),
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
