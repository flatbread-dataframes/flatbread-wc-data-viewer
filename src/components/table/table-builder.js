export class TableBuilder {
    constructor(dataViewer) {
        this.dataViewer = dataViewer
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

    buildHideButton(type, value, level = null, group = null) {
        const dataAttrs = type === 'group'
            ? `data-level="${level}" data-group="${group}"`
            : `data-col="${value}"`

        return `<button class="hide-button" tabindex="-1" data-hide-type="${type}" ${dataAttrs}><span>✕</span></button>`
    }

    buildSortButton(type, value) {
        const dataAttr = type === "column"
            ? `data-col="${value}"`
            : `data-level="${value}"`

        return `<sort-button ${dataAttr}></sort-button>`
    }

    buildColumnLevelNameLabel(level) {
        // build the label for the level name of the column row
        const columnLevelNameLabel =
            this.dataViewer.view.columns.names
                ? this.dataViewer.view.columns.names.at(level) ?? ""
                : ""

        const columnLevelNameLabelElement =
            `<th colspan="${this.dataViewer.view.index.nlevels + 1}"
            class="columnLevelNameLabel"><span>${columnLevelNameLabel}</span></th>`

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
            this.dataViewer.view.index.names
                ? this.dataViewer.view.index.names.at(level) ?? ""
                : ""
        const colspan =
            this.dataViewer.view.index.names.length - 1 === level
                ? `colspan="2"`
                : ""
        const sortButton = this.buildSortButton("index", level)
        const indexLevelNameLabelElement = `
            <th data-level="${level}" class="indexLevelNameLabel" ${colspan}>
                <span>
                    <span class="label">${indexLevelNameLabel}</span>
                    ${sortButton}
                </span>
            </th>
        `
        return indexLevelNameLabelElement
    }

    buildColumnFilter(iloc) {
        const attrs = this.dataViewer.view.columns.attrs[iloc]
        const groups = attrs.groups.join(" ")
        const originalColIndex = this.getOriginalColumnIndex(iloc)

        const isIndexEdge = iloc === 0
        const isGroupEdge = this.dataViewer.view.columns.edges.slice(1).includes(iloc)

        return `<th
            data-col="${iloc}"
            data-original-col="${originalColIndex}"
            data-groups="${groups}"
            ${isIndexEdge ? ' index-edge' : ''}
            ${isGroupEdge ? ' group-edge' : ''}
            class="columnFilter"
        >
            <filter-combo></filter-combo>
        </th>`
    }

    buildIndexLabelRow() {
        const indexLevelNameLabels = this.buildIndexLevelNameLabels()
        const emptyCells = this.dataViewer.view.columns.ilocs.map(iloc => {
            const isIndexEdge = iloc === 0
            const isGroupEdge = this.dataViewer.view.columns.edges.slice(1).includes(iloc)
            return `<th
                ${isIndexEdge ? " index-edge" : ""}
                ${isGroupEdge ? " group-edge" : ""}
            ></th>`
        })
        return `<tr class="index-labels-row">${indexLevelNameLabels.join("")}${emptyCells.join("")}</tr>`
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
                <filter-combo></filter-combo>
            </th>`
        })
    }

    buildColumnsRow() {
        // build the level of the thead containing the column labels
        // in a multiindex this is the lowest level
        const columnLevelNameLabelElement = this.buildColumnLevelNameLabel(-1)
        const columnHeaders = this.dataViewer.view.columns.map((value, idx) => this.buildColumnLabel(value, idx))
        return `<tr class="columns-row">${columnLevelNameLabelElement}${columnHeaders.join("")}</tr>`
    }

    getOriginalColumnIndex(viewColIndex) {
        return this.dataViewer.view.getOriginalColumnIndex(viewColIndex)
    }

    buildColumnLabel(value, iloc) {
        // build the th element containing the column labels
        // in a multiindex this label belongs to the lowest level
        const attrs = this.dataViewer.view.columns.attrs[iloc]
        const selectedValue = Array.isArray(value) ? value.at(-1) : value
        const groups = attrs.groups.join(" ")
        const hideButton = this.buildHideButton('column', iloc)
        const sortButton = this.buildSortButton('column', iloc)
        const originalColIndex = this.getOriginalColumnIndex(iloc)

        const isIndexEdge = iloc === 0
        const isGroupEdge = this.dataViewer.view.columns.edges.slice(1).includes(iloc)

        return `<th
            data-col="${iloc}"
            data-original-col="${originalColIndex}"
            data-groups="${groups}"
            ${isIndexEdge ? ' index-edge' : ''}
            ${isGroupEdge ? ' group-edge' : ''}
        >
            <span>
                <span class="label">${selectedValue}</span>
                ${sortButton}
                ${hideButton}
            </span>
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
        return `<tr class="column-groups-row" data-level="${level}">${columnLevelNameLabelElement}${headers}</tr>`
    }

    buildColumnGroupLabel(span, iloc, level) {
        // build the spanned th of a column group label
        // in a multiindex this label belongs to an upper level
        const isIndexEdge = iloc === 0
        const isGroupEdge = iloc > 0
        const hideButton = this.buildHideButton('group', span.value, level, iloc)

        return `<th
            colspan="${span.count}"
            data-level="${level}"
            data-group="${iloc}"
            ${isIndexEdge ? ' index-edge' : ''}
            ${isGroupEdge ? ' group-edge' : ''}
        >
            <span>
                ${hideButton}
                <span class="label">${span.value[level]}</span>
            </span>
        </th>`
    }

    // MARK: Colgroup
    buildColgroup(widths) {
        return widths.map(width => `<col style="width: ${width}px">`).join("")
    }

    // MARK: Tbody
    buildTbody(start, end) {
        const indexRows = this.buildIndexRows(start, end)
        const groupStarts = this.getGroupStarts(start, indexRows.length)
        const dataView = this.dataViewer.view.valuesSlice(start, end)
        dataView.forEach((row, idx) => {
            const rowElements = row.map((value, iloc) => this.buildCell(value, iloc))
            indexRows[idx] = indexRows[idx].concat(rowElements)
        })
        return indexRows.map((row, idx) => {
            const attributes = {
                tabindex: -1,
                "data-view-row": start + idx,
                "data-group-start": groupStarts[idx].join(" ") || null,
            }
            return `<tr ${this.buildAttributeString(attributes)}>${row.join("")}</tr>`
        }).join("")
    }

    // Every span overlapping [start, end) gets a cell in its first row within the window,
    // with its rowspan clipped to the window, so a group crossing the top edge keeps its label
    buildIndexRows(start, end) {
        const index = this.dataViewer.view.index
        const indexRows = index.values.slice(start, end).map((value, idx) => [
            this.buildIndex(value),
            this.buildRecordViewIcon(start + idx)
        ])
        // Reverse levels because outer levels need to be added last
        const levelsReversed = index.ilevels.slice(0, -1).reverse()
        levelsReversed.forEach(level => {
            const hasGrouping = index.groupingLevels[level]
            for (const span of index.overlappingSpans(level, start, indexRows.length + start)) {
                const first = Math.max(span.iloc, start)
                const rowspan = Math.min(span.iloc + span.count, start + indexRows.length) - first
                // Only add rowspan if this level has meaningful grouping
                indexRows[first - start].unshift(this.buildGroupCell(span, level, hasGrouping ? rowspan : null))
            }
        })
        return indexRows
    }

    buildGroupCell(span, level, rowspan) {
        const attrs = this.dataViewer.view.index.attrs[level]
        const attributes = {
            class: rowspan ? "group" : null,
            rowspan,
            "data-level": level,
            "data-group": span.group,
            "data-dtype": attrs.dtype,
        }
        const formattedValue = this.dataViewer.formatter.formatValue(span.value[level], attrs.dtype, attrs.formatOptions)
        return `<th ${this.buildAttributeString(attributes)}>
            <span>${formattedValue}</span>
        </th>`
    }

    // Per row from start: the grouping levels whose group starts in that row (not at a window edge)
    getGroupStarts(start, count) {
        const index = this.dataViewer.view.index
        const starts = Array.from({ length: count }, () => [])
        index.ilevels.slice(0, -1).forEach(level => {
            if (!index.groupingLevels[level]) return
            for (const span of index.overlappingSpans(level, start, start + count)) {
                if (span.iloc >= start) starts[span.iloc - start].push(level)
            }
        })
        return starts
    }

    buildIndex(value) {
        value = Array.isArray(value) ? value.at(-1) : value
        const level = this.dataViewer.view.index.nlevels - 1
        const attrs = this.dataViewer.view.index.attrs[level]
        const formattedValue = this.dataViewer.formatter.formatValue(value, attrs.dtype, attrs.formatOptions)
        return `<th data-level=${level} data-dtype="${attrs.dtype}">${formattedValue}</th>`
    }

    buildRecordViewIcon(viewRowIndex) {
        return `<th class="recordViewIcon" data-view-row="${viewRowIndex}">
            <button type="button" aria-label="View record details"><span>☰</span></button>
        </th>`
    }

    buildCell(value, iloc) {
        const attrs = this.dataViewer.view.columns.attrs[iloc]
        const formattedValue = this.dataViewer.formatter.formatValue(value, attrs.dtype, attrs.formatOptions)
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

    buildAttributeString(attributes) {
        return Object.entries(attributes)
            .map(([key, value]) => this.formatAttribute(key, value))
            .filter(Boolean)
            .join(" ")
    }

    formatAttribute(key, value) {
        if (value == null) {
            return ""
        }

        if (typeof value === "boolean") {
            return value ? key : ""
        }

        return `${key}="${value}"`
    }
}
