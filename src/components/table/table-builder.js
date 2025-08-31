import { Formatter } from "../../build/formatter.js"


export class TableBuilder {
    constructor(dataViewer, options) {
        this.dataViewer = dataViewer
        this.options = options
        this.formatter = new Formatter(options)
    }

    buildTable(buffer) {
        return `
            <table>
                <thead>${this.buildThead()}</thead>
                <tbody>${this.buildTbody(0, buffer)}</tbody>
            </table>
        `
    }

    // MARK: Thead
    buildThead() {
        const columnGroupsRows =
            this.dataViewer.view.columns.ilevels
            .slice(0, -1)
            .map(level => this.buildColumnGroupsRow(level))
            .join("")
        return `${columnGroupsRows}${this.buildColumnsRow()}${this.buildIndexLabelRow()}${this.buildFilterRow()}`
    }

    buildColumnLevelNameLabel(level) {
        // build the label for the level name of the column row
        const columnLevelNameLabel =
            this.dataViewer.view.columnNames
            ? this.dataViewer.view.columnNames.at(level) ?? ""
            : ""

        const columnLevelNameLabelElement =
            `<th colspan="${this.dataViewer.view.index.nlevels + 1}"
            class="columnLevelNameLabel">${columnLevelNameLabel}</th>`

        return columnLevelNameLabelElement
    }

    buildIndexLevelNameLabels() {
        // build the index level name labels (to be used in filter row)
        const indexLevelNameLabels =
            this.dataViewer.view.index.ilevels.map(level => this.buildIndexLevelNameLabel(level))
        return indexLevelNameLabels
    }

    buildIndexLevelNameLabel(level) {
        const indexLevelNameLabel =
            this.dataViewer.view.indexNames
            ? this.dataViewer.view.indexNames.at(level) ?? ""
            : ""
        const colspan =
            this.dataViewer.view.indexNames.length - 1 === level
            ? `colspan="2"`
            : ""
        const indexLevelNameLabelElement =
        `<th data-level="${level}" class="indexLevelNameLabel" ${colspan}>
            <sortable-column-header data-level="${level}">
                ${indexLevelNameLabel}
            </sortable-column-header>
        </th>`
        return indexLevelNameLabelElement
    }

    buildColumnFilter(iloc) {
        // build a column filter
        const attrs = this.dataViewer.view.columns.attrs[iloc]
        const groups = attrs.groups.join(" ")

        const isIndexEdge = iloc === 0
        const isGroupEdge = this.dataViewer.view.columns.edges.slice(1).includes(iloc)

        return `<th
            data-col="${iloc}"
            data-groups="${groups}"
            ${isIndexEdge ? ' index-edge' : ''}
            ${isGroupEdge ? ' group-edge' : ''}
            class="columnFilter"
        >
            <filter-input></filter-input>
        </th>`
    }

    buildIndexLabelRow() {
        const indexLevelNameLabels = this.buildIndexLevelNameLabels()
        const emptyCells = this.dataViewer.view.columns.ilocs.map(iloc => {
            const isIndexEdge = iloc === 0
            const isGroupEdge = this.dataViewer.view.columns.edges.slice(1).includes(iloc)
            return `<th
                ${isIndexEdge ? ' index-edge' : ''}
                ${isGroupEdge ? ' group-edge' : ''}
            ></th>`
        })
        return `<tr>${indexLevelNameLabels.join("")}${emptyCells.join("")}</tr>`
    }

    buildFilterRow() {
        const indexFilters = this.buildIndexFilters()
        const columnFilters = this.dataViewer.view.columns.ilocs.map(iloc =>
            this.buildColumnFilter(iloc)
        )
        return `<tr class="filter-row">${indexFilters.join("")}${columnFilters.join("")}</tr>`
    }

    buildIndexFilters() {
        return this.dataViewer.view.index.ilevels.map(level => {
            const isLastLevel = level === this.dataViewer.view.index.nlevels - 1
            const colspan = isLastLevel ? `colspan="2"` : ""

            return `<th
                data-level="${level}"
                class="indexFilter"
                ${colspan}
            >
                <filter-input></filter-input>
            </th>`
        })
    }

    getIndexLevelName(level) {
        return this.dataViewer.view.indexNames?.[level] || `Level ${level}`
    }

    buildColumnFilterRow() {
        // build the bottom row of the thead containing the index labels and column filters
        const indexLevelNameLabels = this.buildIndexLevelNameLabels()
        const filterItems = this.dataViewer.view.columns.ilocs.map(iloc => this.buildColumnFilter(iloc))
        return `<tr>${indexLevelNameLabels.join("")}${filterItems.join("")}`
    }

    buildColumnsRow() {
        // build the level of the thead containing the column labels
        // in a multiindex this is the lowest level
        const columnLevelNameLabelElement = this.buildColumnLevelNameLabel(-1)
        const columnHeaders = this.dataViewer.view.columns.map((value, idx) => this.buildColumnLabel(value, idx))
        return `<tr>${columnLevelNameLabelElement}${columnHeaders.join("")}</tr>`
    }

    buildColumnLabel(value, iloc) {
        // build the th element containing the column labels
        // in a multiindex this label belongs to the lowest level
        const attrs = this.dataViewer.view.columns.attrs[iloc]
        const selectedValue = Array.isArray(value) ? value.at(-1) : value
        const groups = attrs.groups.join(" ")

        const isIndexEdge = iloc === 0
        const isGroupEdge = this.dataViewer.view.columns.edges.slice(1).includes(iloc)

        return `<th
            data-col="${iloc}"
            data-groups="${groups}"
            ${isIndexEdge ? ' index-edge' : ''}
            ${isGroupEdge ? ' group-edge' : ''}
        >
            <sortable-column-header data-col="${iloc}">
            ${selectedValue}
            </sortable-column-header>
        </th>`
    }

    buildColumnGroupsRow(level) {
        // build a row of column group labels
        // in a multiindex these are the upper levels
        const columnLevelNameLabelElement = this.buildColumnLevelNameLabel(level)

        const headers =
            this.dataViewer.view.columns.spans[level]
            .map((span, iloc) => this.buildColumnGroupLabel(span, iloc, level))
            .join("")

        return `<tr>${columnLevelNameLabelElement}${headers}</tr>`
    }

    buildColumnGroupLabel(span, iloc, level) {
        // build the spanned th of a column group label
        // in a multiindex this label belongs to an upper level
        const isIndexEdge = iloc === 0
        const isGroupEdge = iloc > 0
        return `<th
            colspan="${span.count}"
            data-level="${level}"
            data-group="${iloc}"
            ${isIndexEdge ? ' index-edge' : ''}
            ${isGroupEdge ? ' group-edge' : ''}
        ><span>${span.value[level]}</span></th>`
    }

    // MARK: Tbody
    buildTbody(start, end) {
        const indexRows = this.buildIndexRows(start, end)
        const dataView = this.dataViewer.view.values.slice(start, end)
        dataView.forEach((row, idx) => {
            const rowElements = row.map((value, iloc) => this.buildCell(value, iloc))
            indexRows[idx] = indexRows[idx].concat(rowElements)
        })
        return indexRows.map(row => `<tr>${row.join("")}</tr>`).join("")
    }

    buildIndexRows(start, end) {
        const indexRows =
            this.dataViewer.view.index.values.slice(start, end).map((value, idx) => [
                this.buildIndex(value),
                this.buildRecordViewIcon(start + idx)
            ])
        // Reverse levels because outer levels need to be added last
        const levelsReversed = this.dataViewer.view.index.ilevels.slice(0, -1).reverse()
        levelsReversed.forEach(level => {
            for (const span of this.dataViewer.view.index.spans[level]) {
                const th = `<th
                    rowspan="${span.count}"
                    data-level="${level}"
                    data-group="${span.group}"
                ><span>${span.value[level]}</span></th>`
                if (end <= span.iloc) break
                if (span.iloc >= start) { indexRows[span.iloc - start].unshift(th) }
            }
        })
        return indexRows
    }

    buildIndex(value) {
        value = Array.isArray(value) ? value.at(-1) : value
        const level = this.dataViewer.view.index.nlevels - 1
        return `<th data-level=${level}>${value}</th>`
    }

    buildRecordViewIcon(viewRowIndex) {
        return `<th class="recordViewIcon" data-view-row="${viewRowIndex}">
            <button type="button" aria-label="View record details">👁</button>
        </th>`
    }

    buildCell(value, iloc) {
        const attrs = this.dataViewer.view.columns.attrs[iloc]
        const formatOptions = attrs.formatOptions ?? this.options
        const formattedValue = this.formatter.formatValue(value, attrs.dtype, formatOptions)
        const groups = attrs.groups.join(" ")
        const isIndexEdge = iloc === 0
        const isGroupEdge = this.dataViewer.view.columns.edges.slice(1).includes(iloc)
        return `<td
            data-col="${iloc}"
            data-groups="${groups}"
            data-dtype="${attrs.dtype}"
            ${isIndexEdge ? ' index-edge' : ''}
            ${isGroupEdge ? ' group-edge' : ''}
        >${formattedValue}</td>`
    }
}
