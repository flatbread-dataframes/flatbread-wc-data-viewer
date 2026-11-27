import { baseSheet } from "../../styles/base.js"
import { TRUNCATABLE_CELLS } from "./cell-layout.js"

export class Stylesheet {
    constructor(dataTable, data, options) {
        this.dataTable = dataTable
        this.data = data
        this.options = options
        // Text columns a user narrowed below their content; written by updateNarrowedColumns
        this._narrowedSheet = new CSSStyleSheet()
    }

    // MARK: setup
    setupStyles() {
        this._componentSheet = this.getIntegratedStyleSheet()
        this.dataTable.shadowRoot.adoptedStyleSheets = [baseSheet, this._componentSheet, this._narrowedSheet]
    }

    // MARK: get/set
    get dataViewer() {
        return this.dataTable.dataViewer
    }

    get table() {
        return this.dataTable.shadowRoot.querySelector("table")
    }

    getIntegratedStyleSheet() {
        const sheet = new CSSStyleSheet()
        sheet.replaceSync(`
            ${this.getBaseStyles()}
            ${this.getStickyStyles()}
            ${this.getComposedStyles()}
        `)
        return sheet
    }

    // MARK: base
    getBaseStyles() {
        return `
            :root {
                box-sizing: border-box;
            }
            :host {
                display: block;
                padding-bottom: 12px;
                /* a window update replaces the rows; anchoring to them would make the content jump */
                overflow-anchor: none;
            }
            table {
                border-collapse: separate;
                border-spacing: 0;
            }
            /* fixed layout once the colgroup is written; width 0 makes the table the sum of its cols */
            table:has(> colgroup > col) {
                table-layout: fixed;
                width: 0;
            }
            th {
                background-color: var(--dv-bg, white);
            }
            th, td {
                padding: .25em .5em;
                white-space: nowrap;
                cursor: var(--cursor, auto);
            }
            tbody th { text-align: left; }
            td { text-align: left; }
            :where(td, tbody th)[data-dtype="int"],
            :where(td, tbody th)[data-dtype="float"] {
                text-align: right;
            }
            tbody th:not(.group) {
                vertical-align: middle;
            }
            thead th.columnLevelNameLabel {
                text-align: right;
                vertical-align: middle;
            }
            thead th > span {
                display: flex;
                width: max-content;
                gap: .25em;
                align-items: center;
            }
            thead th.columnLevelNameLabel > span {
                margin-left: auto;
            }
            /* an empty label would add a flex gap and widen the column */
            thead .label:empty {
                display: none;
            }
            .columnFilter, .indexFilter {
                border-top: 1px solid var(--dv-border);
            }
            /* spacers stand in for the rows outside the window; their height is set inline.
               Their cells keep the borders, so the index and column group lines continue. */
            tbody tr.spacer > :where(th, td) {
                padding: 0;
            }

            /* full value of a truncated cell (CellTooltip), anchored to the hovered cell */
            .cell-tooltip {
                position-anchor: --cell-tooltip;
                position-area: block-end span-inline-end;
                /* max-content: a squeezed tooltip would wrap instead of overflowing,
                   and only overflow makes it try the other side */
                position-try-fallbacks: flip-inline, flip-block, flip-block flip-inline;
                margin: 0;
                margin-block: .125rem;
                padding: .25em .5em;
                width: max-content;
                max-width: min(40em, 90vw);
                border: 1px solid var(--dv-border);
                border-radius: .25em;
                background: var(--dv-bg, white);
                color: inherit;
                font: inherit;
                white-space: pre-wrap;
                overflow-wrap: anywhere;
                /* never under the pointer, so it cannot take the hover from its cell */
                pointer-events: none;
            }

            /* general button styling */
            button {
                position: relative;
                padding: 0;
                width: 1rem;
                height: 1rem;
                border: none;
                cursor: pointer;
                color: inherit;
                border-radius: 50%;
            }
            button > span {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -55%);
                pointer-events: none
            }

            /* hide button */
            .hide-button {
                opacity: 0;
                background-color: transparent;
                font-size: 0.6125em;
                transition: opacity 0.2s;
            }
            thead th:hover .hide-button {
                background-color: color-mix(in srgb, currentColor 15%, var(--dv-bg));
                opacity: 1;
            }
            thead th .hide-button:hover {
                background-color: color-mix(in srgb, currentColor 35%, var(--dv-bg));
            }
            .hide-button:focus-visible {
                background-color: color-mix(in srgb, var(--focus-color) 15%, var(--dv-bg));
                opacity: 1;
            }

            /* sort button */
            sort-button {
                display: grid;
                place-items: center;
                margin-left: .125rem;
            }
            sort-button button {
                opacity: 0;
                background-color: transparent;
                font-size: 0.6125em;
                transition: opacity 0.2s;
            }
            thead th:hover sort-button button {
                background-color: color-mix(in srgb, currentColor 15%, var(--dv-bg));
                opacity: 1;
            }
            thead th sort-button button:hover {
                background-color: color-mix(in srgb, currentColor 30%, var(--dv-bg));
            }
            sort-button[sort-state="asc"] button,
            sort-button[sort-state="desc"] button {
                opacity: 1;
            }
            sort-button button:focus-visible {
                background-color: color-mix(in srgb, currentColor 15%, var(--dv-bg));
                opacity: 1;
            }

            /* record view button */
            .recordViewIcon {
                left: var(--index-col-${this.data.index.nlevels}-offset);
                width: 1.5rem;
                z-index: 1;
            }
            .recordViewIcon button {
                opacity: 0;
                background: transparent;
                font-size: .8125em;
                transition: opacity 0.2s;
            }
            tr:hover .recordViewIcon button {
                background-color: color-mix(in srgb, currentColor 15%, var(--dv-bg));
                opacity: 1;
            }
            tr .recordViewIcon:hover button {
                background-color: color-mix(in srgb, currentColor 30%, var(--dv-bg));
            }

            /* column resizing (ColumnResizer): a handle at the right edge of a data column header,
               with a guide line down to the last visible row while hovered or dragged */
            thead .columns-row th[data-col] {
                position: relative;
            }
            .resize-handle {
                position: absolute;
                top: 0;
                right: 0;
                bottom: 0;
                width: 6px;
                cursor: col-resize;
                touch-action: none;
            }
            .resize-handle::after {
                content: "";
                position: absolute;
                top: 0;
                right: 0;
                width: 2px;
                height: var(--resize-guide-height, 100%);
                background-color: var(--focus-color);
                opacity: 0;
                pointer-events: none;
            }
            .resize-handle:hover::after,
            .resize-handle.dragging::after {
                opacity: 1;
            }
        `
    }

    // MARK: sticky
    getStickyStyles() {
        const calcs = this.data.index.ilevels.map(i => `
            th[data-level="${i}"] {
                left: var(--index-col-${i}-offset);
            }`)
        return `
            thead {
                position: sticky;
                top: 0;
                z-index: 7;
            }
            /* clip, not hidden: hidden makes the th a scroll container and the label would stick to it */
            thead .column-groups-row th:not(.columnLevelNameLabel) {
                text-align: left;
                overflow: clip;
            }
            thead .column-groups-row th:not(.columnLevelNameLabel) > span {
                display: inline-flex;
                position: sticky;
                left: var(--index-offset);
            }
            thead th:where(.columnLevelNameLabel, .indexLevelNameLabel),
            tbody th,
            .indexFilter {
                position: sticky;
                left: 0;
                z-index: 1;
                vertical-align: top;
            }
            tbody th > span {
                position: sticky;
                top: var(--thead-offset);
            }
            ${calcs.join("\n")}
        `
    }

    // MARK: composed
    getComposedStyles() {
        const styleBlocks = {
            groupBorders: `
                [group-edge] {
                    border-left: 1px solid color-mix(in srgb, var(--border-color, currentColor) 60%, transparent);
                }
            `,
            rowBorders: `
                /* box-shadow, not border: a border would make group start rows taller */
                tbody tr[data-group-start]:not([data-view-row="0"]) :where(th, td) {
                    box-shadow: inset 0 1px 0 0 color-mix(in srgb, var(--border-color, currentColor) 75%, transparent);
                }
            `,
            hoverEffect: `
                tbody tr:not(.spacer):hover :where(td, th:not(.group)) {
                    background-color: var(--dv-hover);
                }
            `,
            theadBorder: `
                thead tr:last-of-type th {
                    border-bottom: var(--axes-width, 2px) solid color-mix(in srgb, var(--border-color, currentColor) 75%, transparent);
                }
            `,
            indexBorder: `
                tbody tr th:last-of-type,
                thead th:has(+ [index-edge]) {
                    border-right: var(--axes-width, 2px) solid color-mix(in srgb, var(--border-color, currentColor) 75%, transparent);
                }
            `,
            hideFilters: `
                .filter-row filter-combo {
                    display: none;
                }
                .indexFilter, .columnFilter {
                    border-top: none;
                    padding: 0;
                }
            `,
            rowFocus: `
                tbody:focus {
                    outline: none;
                }
                tbody tr:focus {
                    outline: none;
                }
                tbody tr:focus :where(td, th) {
                    background-color: color-mix(in srgb, var(--focus-color) 25%, var(--dv-bg));
                }
            `,
            // Only in truncate mode: in no-wrap the small difference between canvas and DOM text
            // widths would turn the last characters of a fitting value into an ellipsis
            truncate: `
                tbody ${TRUNCATABLE_CELLS} {
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            `,
            // Text wraps within the header width, also inside long words (codes, URLs) that would
            // otherwise run into the next column; cells align at the top, with the first line
            wrap: `
                tbody ${TRUNCATABLE_CELLS} {
                    white-space: normal;
                    overflow-wrap: anywhere;
                }
                tbody td,
                tbody th:not(.group) {
                    vertical-align: top;
                }
            `,
        }
        // blocks not toggled by a styling option
        const enabled = {
            rowFocus: true,
            truncate: this.options.cellLayout === "truncate",
            wrap: this.options.cellLayout === "wrap",
        }

        return Object.entries(styleBlocks)
            .filter(([key]) => enabled[key] ?? this.options.styling[key])
            .map(([, style]) => style)
            .join("\n")
    }

    // MARK: updates
    updateComposedStyles() {
        if (this._componentSheet) {
            this._componentSheet.replaceSync(`
                ${this.getBaseStyles()}
                ${this.getStickyStyles()}
                ${this.getComposedStyles()}
            `)
        }
    }

    // Sticky left offsets of the index columns (levels + record view icon) from their fixed widths
    updateIndexOffsets(widths) {
        let offset = 0
        widths.forEach((width, i) => {
            this.table.style.setProperty(`--index-col-${i}-offset`, `${offset}px`)
            offset += width
        })
    }

    // A text column narrowed below its content truncates, also in no-wrap mode. Per column, not for
    // all text cells: in no-wrap the small difference between canvas and DOM text widths would turn
    // the last characters of a fitting value into an ellipsis (see the truncate block).
    updateNarrowedColumns(ilocs) {
        this._narrowedSheet.replaceSync(ilocs.map(iloc => `
            tbody td[data-col="${iloc}"] {
                overflow: hidden;
                text-overflow: ellipsis;
            }`).join(""))
    }

    updateTheadOffset() {
        const thead = this.table.querySelector("thead")
        if (!thead) return

        const newOffset = `calc(${thead.getBoundingClientRect().height}px + .25em)`
        this.table.style.setProperty(`--thead-offset`, newOffset)
    }

    updateIndexOffset() {
        const columnLevelName = this.table.querySelector(".columnLevelNameLabel")
        if (!columnLevelName) return

        const newOffset = `calc(${columnLevelName.getBoundingClientRect().width}px + .5em)`
        this.table.style.setProperty(`--index-offset`, newOffset)
    }
}
