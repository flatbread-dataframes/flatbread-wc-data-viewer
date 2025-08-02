export class HTMLBuilder {
    constructor(data, options) {
        this.data = data
        this.options = options
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
        if (!this.data.columns.isMultiIndex) return this.buildColumnsRow()

        const columnGroupsRows = this.data.columns.ilevels
            .slice(0, -1)
            .map(level => this.buildColumnGroupsRow(level))
            .join("")
        return `${columnGroupsRows}${this.buildColumnsRow()}`
    }

    buildColumnsRow() {
        const indexLabels = this.data.indexNames
            ? this.data.indexNames.map((name, idx) => `<th data-level="${idx}" class="indexLabel">${name}</th>`)
            : this.data.index.ilevels.map(level => `<th data-level="${level}"></th>`)
        const columnHeaders = this.data.columns.map((value, idx) => this.buildColumnLabel(value, idx))
        return `<tr>${indexLabels.join("")}${columnHeaders.join("")}</tr>`
    }

    buildColumnLabel(value, iloc) {
        const attrs = this.data.columns.attrs[iloc]
        const selectedValue = Array.isArray(value) ? value.at(-1) : value
        const groups = attrs.groups.join(" ")
        const isIndexEdge = iloc === 0
        const isGroupEdge = this.data.columns.edges.slice(1).includes(iloc)
        return `<th
            data-col="${iloc}"
            data-groups="${groups}"
            ${isIndexEdge ? ' index-edge' : ''}
            ${isGroupEdge ? ' group-edge' : ''}
        >${selectedValue}</td>`
    }

    buildColumnGroupsRow(level) {
        const columnLabel = this.data.columnNames ? this.data.columnNames[level] ?? "" : ""
        const columnLabelElement = `<th colspan="${this.data.index.nlevels}" class="columnLabel">${columnLabel}</th>`
        const headers = this.data.columns.spans[level]
            .map((span, iloc) => this.buildColumnGroupLabel(span, iloc, level))
            .join("")
        return `<tr>${columnLabelElement}${headers}</tr>`
    }

    buildColumnGroupLabel(span, iloc, level) {
        const isIndexEdge = iloc === 0
        const isGroupEdge = iloc > 0
        return `<th
            colspan="${span.count}"
            data-level="${level}"
            data-group="${iloc}"
            ${isIndexEdge ? ' index-edge' : ''}
            ${isGroupEdge ? ' group-edge' : ''}
        >${span.value[level]}</th>`
    }

    // MARK: Tbody
    buildTbody(start, end) {
        const indexRows = this.buildIndexRows(start, end)
        const dataView = this.data.values.slice(start, end)
        dataView.forEach((row, idx) => {
            const rowElements = row.map((value, iloc) => this.buildCell(value, iloc))
            indexRows[idx] = indexRows[idx].concat(rowElements)
        })
        return indexRows.map(row => `<tr>${row.join("")}</tr>`).join("")
    }

    buildIndexRows(start, end) {
        const indexRows = this.data.index.values.slice(start, end).map(value => [this.buildIndex(value)])
        // Reverse levels because outer levels need to be added last
        const levelsReversed = this.data.index.ilevels.slice(0, -1).reverse()
        levelsReversed.forEach(level => {
            for (const span of this.data.index.spans[level]) {
                const th = `<th
                    rowspan="${span.count}"
                    data-level="${level}"
                    data-group="${span.group}"
                >${span.value[level]}</th>`
                if (end <= span.iloc) break
                if (span.iloc >= start) { indexRows[span.iloc - start].unshift(th) }
            }
        })
        return indexRows
    }

    buildIndex(value) {
        value = Array.isArray(value) ? value.at(-1) : value
        const level = this.data.index.nlevels - 1
        return `<th data-level=${level}>${value}</th>`
    }

    buildCell(value, iloc) {
        const attrs = this.data.columns.attrs[iloc]
        const formatOptions = attrs.formatOptions ?? this.options
        const formattedValue = this.formatValue(value, attrs.dtype, formatOptions)
        const groups = attrs.groups.join(" ")
        const isIndexEdge = iloc === 0
        const isGroupEdge = this.data.columns.edges.slice(1).includes(iloc)
        return `<td
            data-col="${iloc}"
            data-groups="${groups}"
            data-dtype="${attrs.dtype}"
            ${isIndexEdge ? ' index-edge' : ''}
            ${isGroupEdge ? ' group-edge' : ''}
        >${formattedValue}</td>`
    }

    // MARK: formatting
    formatValue(value, dtype, formatOptions) {
        if (value === null || value === "") return this.options.naRep
        if (!dtype) return value

        switch (dtype) {
            case 'int':
            case 'float':
                return this.formatNumber(value, formatOptions)
            case 'datetime':
                return this.formatDate(value, formatOptions)
            default:
                return value.toString()
        }
    }

    formatNumber(value, options) {
        return value.toLocaleString(this.options.locale, options)
    }

    formatDate(value, options) {
        return new Date(value).toLocaleString(this.options.locale, options)
    }
}
