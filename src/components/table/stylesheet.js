import { baseSheet } from "../../styles/base.js"

export class Stylesheet {
    constructor(dataTable, data, options) {
        this.dataTable = dataTable
        this.data = data
        this.options = options
        this.updateColumnWidths = this.updateColumnWidths.bind(this)
        this.resizeObserver = new ResizeObserver(() => {
            this.updateColumnWidths()
            this.updateIndexOffset()
        })
    }

    // MARK: setup
    setupStyles() {
        this._componentSheet = this.getIntegratedStyleSheet()
        this.dataTable.shadowRoot.adoptedStyleSheets = [baseSheet, this._componentSheet]

        const tbody = this.dataTable.shadowRoot.querySelector("tbody")
        if (tbody) this.resizeObserver.observe(tbody)
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
            }
            table {
                border-collapse: separate;
                border-spacing: 0;
            }
            th {
                background-color: var(--dv-bg, white);
            }
            tbody th { text-align: left; }
            td { text-align: right; }
            th, td {
                padding: .25em .5em;
                cursor: var(--cursor, auto);
            }
            tbody th:not([rowspan]) {
                vertical-align: middle;
            }
            thead th.columnLevelNameLabel {
                text-align: right;
                vertical-align: middle;
            }
            thead th > span {
                display: flex;
                gap: .25em;
                align-items: center;
            }
            .columnFilter, .indexFilter {
                border-top: 1px solid var(--dv-border);
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

        `
    }

    // MARK: sticky
    getStickyStyles() {
        const calcs = this.data.index.ilevels.map(i => `
            [data-level="${i}"] {
                left: var(--index-col-${i}-offset);
            }`)
        return `
            thead {
                position: sticky;
                top: 0;
                z-index: 7;
            }
            thead th[colspan]:not(.columnLevelNameLabel) {
                text-align: left;
            }
            thead th[colspan]:not(.columnLevelNameLabel) > span {
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
                    border-left: 1px solid color-mix(in srgb, currentColor 60%, transparent);
                }
            `,
            rowBorders: `
                tbody tr:not(:first-of-type):has(th[rowspan]) :where(th, td) {
                    border-top: 1px solid color-mix(in srgb, currentColor 75%, transparent);
                }
            `,
            hoverEffect: `
                tbody tr:hover :where(td, th:not([rowspan])) {
                    background-color: var(--dv-hover);
                }
            `,
            theadBorder: `
                thead tr:last-of-type th {
                    border-bottom: var(--axes-width, 2px) solid color-mix(in srgb, currentColor 75%, transparent);
                }
            `,
            indexBorder: `
                tbody tr th:last-of-type,
                thead th:has(+ [index-edge]) {
                    border-right: var(--axes-width, 2px) solid color-mix(in srgb, currentColor 75%, transparent);
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
                tbody tr:focus {
                    outline: none;
                }
                tbody tr:focus :where(td, th) {
                    background-color: color-mix(in srgb, var(--focus-color) 25%, var(--dv-bg));
                }
            `,
            noWrap: `
                th, td {
                    white-space: nowrap;
                }
            `,
        }

        return Object.entries(styleBlocks)
            .filter(([key]) => key === "rowFocus" || this.options.styling[key])
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

    updateColumnWidths() {
        const tbody = this.dataTable.shadowRoot.querySelector("tbody")
        if (!tbody) return

        const firstRow = tbody.querySelector("tr")
        if (!firstRow) return

        const indexHeaders = firstRow.querySelectorAll("th")

        let cumulativeWidth = 0
        indexHeaders.forEach((header, index) => {
            this.table.style.setProperty(`--index-col-${index}-offset`, `${cumulativeWidth}px`)
            cumulativeWidth += header.getBoundingClientRect().width
        })
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

    disconnect() {
        this.resizeObserver.disconnect()
    }
}
