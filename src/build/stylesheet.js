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
                display: grid;
                cursor: var(--cursor, auto);
                max-height: var(--height, 600px);
                grid-template-areas:
                    "control-panel"
                    "view";
            }

            .table-container,
            .record-container {
                grid-area: view;
                overflow-y: auto;
                overscroll-behavior: none;
                scrollbar-gutter: stable;
            }
            :host([view="record"]) {
                .table-container {
                    visibility: hidden;
                }
                .record-container {
                    display: block;
                }
            }
            :host([view="table"]) {
                .table-container {
                    visibility: visible;
                }
                .record-container {
                    display: none;
                }
            }

            .control-panel {
                --background-color: var(--background-color);
                grid-area: control-panel;
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
            .columnLabel { text-align: right; }
            /* tbody tr:hover .recordViewIcon button {
                opacity: 0.4;
            } */
            tbody tr .recordViewIcon button:hover {
                opacity: 1;
                background-color: var(--hover-color, #f4f3ee);
            }

            .record-container {
                padding: 12px;
            }
            .record-view {
                margin: 0 auto;
            }
            .record-navigation {
                display: grid;
                grid-template-columns: auto 1fr auto;
                gap: 1rem;
                align-items: center;
                padding: 0.5rem 0;
                margin-bottom: 1.5rem;
                border-bottom: 1px solid var(--border-color, currentColor);
            }
            .nav-buttons {
                display: flex;
                gap: 0.25rem;
            }
            .nav-buttons button,
            .exit-button {
                padding: 0.25rem 0.5rem;
                border: 1px solid var(--border-color, currentColor);
                border-radius: 0.25rem;
                background: var(--background-color, white);
                cursor: pointer;
                font: inherit;
                color: inherit;
            }
            .nav-buttons button:hover,
            .exit-button:hover {
                background-color: var(--hover-color, #f4f3ee);
            }
            .record-info {
                justify-self: center;
                display: flex;
                align-items: center;
                gap: 1.5em;
            }
            .record-position {
                font-weight: 500;
                font-size: 0.9em;
                opacity: 0.8;
            }
            .record-index {
                font-weight: 600;
                font-size: 1.1em;
            }
            .field-group {
                margin-bottom: 2rem;
            }
            .group-title {
                margin: 0 0 1rem 0;
                padding-bottom: 0.5rem;
                border-bottom: 1px solid var(--border-color, currentColor);
                font-size: 1.1em;
                font-weight: 600;
            }
            .record-fields {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1rem;
            }
            .record-field {
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 0.5rem;
                align-items: baseline;
            }
            .field-label {
                font-weight: 500;
                text-align: right;
                white-space: nowrap;
            }
            .field-value {
                padding: 0.25rem 0.5rem;
                background-color: var(--hover-color, #f4f3ee);
                border-radius: 0.25rem;
                font-family: monospace;
            }
            .field-value[data-dtype="int"],
            .field-value[data-dtype="float"] {
                text-align: right;
            }
            .recordViewIcon {
                left: var(--index-col-${this.data.index.nlevels}-offset);
                z-index: 1;
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
            thead th[colspan] {
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

        const newOffset = `calc(${thead.offsetHeight}px + .25em)`
        this.table.style.setProperty(`--thead-offset`, newOffset)
    }

    updateIndexOffset() {
        const columnLevelName = this.table.querySelector(".columnLevelNameLabel")
        if (!columnLevelName) return

        const newOffset = `calc(${columnLevelName.offsetWidth}px + .5em)`
        this.table.style.setProperty(`--index-offset`, newOffset)
        console.log(newOffset)
    }

    disconnect() {
        this.resizeObserver.disconnect()
    }
}
