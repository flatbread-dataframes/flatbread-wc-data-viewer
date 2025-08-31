export class Stylesheet {
    constructor(host, data, options) {
        this.host = host
        this.data = data
        this.options = options
        this.updateColumnWidths = this.updateColumnWidths.bind(this)
        this.resizeObserver = new ResizeObserver(() => {
            this.updateColumnWidths()
            this.updateIndexOffset()
        })
    }

    setupStyles() {
        const sheet = this.getIntegratedStyleSheet()
        this.host.shadowRoot.adoptedStyleSheets = [sheet]

        const tbody = this.host.shadowRoot.querySelector("tbody")
        if (tbody) this.resizeObserver.observe(tbody)
    }

    get table() {
        return this.host.shadowRoot.querySelector("table")
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
                padding-right: 12px;
                padding-bottom: 12px;
            }
            table {
                border-collapse: separate;
                border-spacing: 0;
            }
            thead th {
                background-color: var(--background-color, white);
            }
            tbody th { text-align: left; }
            td { text-align: right; }
            th, td { padding: .25em .5em; }
            tbody th:not([rowspan]) {
                vertical-align: middle;
            }
            thead th.columnLevelNameLabel {
                text-align: right;
                vertical-align: middle;
            }
            .recordViewIcon {
                left: var(--index-col-${this.data.index.nlevels}-offset);
                width: 1.5em;
                z-index: 1;
                text-align: center;
                vertical-align: middle;
            }
            .recordViewIcon button {
                opacity: 0;
                border: none;
                background: transparent;
                cursor: pointer;
                font-size: 1.25em;
                color: inherit;
                transition: opacity 0.2s;
            }
            .recordViewIcon button:hover {
                opacity: 1;
                background-color: var(--hover-color, #f4f3ee);
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
            th {
                background: var(--background-color, white);
            }
            thead th[colspan]:not(.columnLevelNameLabel) {
                text-align: left;
            }
            thead th span {
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
            tbody th span {
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
                    border-left: 1px solid var(--border-color, currentColor);
                }
            `,
            rowBorders: `
                tbody tr:not(:first-of-type):has(th[rowspan]) :where(th, td) {
                    border-top: 1px solid var(--border-color, currentColor);
                }
            `,
            hoverEffect: `
                tbody tr:hover :where(td, th:not([rowspan])) {
                    background-color: var(--hover-color, #f4f3ee);
                }
            `,
            theadBorder: `
                thead tr:last-of-type th {
                    border-bottom: var(--axes-width, 2px) solid var(--border-color, currentColor);
                }
            `,
            indexBorder: `
                tbody tr th:last-of-type,
                thead th:has(+ [index-edge]) {
                    border-right: var(--axes-width, 2px) solid var(--border-color, currentColor);
                }
            `,
            hideFilters: `
                .filter-row filter-input {
                    display: none;
                }
            `,
        }

        return Object.entries(styleBlocks)
            .filter(([key]) => this.options.styling[key])
            .map(([, style]) => style)
            .join("\n")
    }

    // MARK: updates
    updateColumnWidths() {
        const tbody = this.host.shadowRoot.querySelector("tbody")
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
