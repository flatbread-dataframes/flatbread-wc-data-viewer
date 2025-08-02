export class Stylesheet {
    constructor(host, data, options) {
        this.host = host
        this.data = data
        this.options = options
        this.updateColumnWidths = this.updateColumnWidths.bind(this)
        this.resizeObserver = new ResizeObserver(this.updateColumnWidths)
    }

    setupStyles() {
        const sheet = this.getIntegratedStyleSheet()
        this.host.shadowRoot.adoptedStyleSheets = [sheet]

        // Start observing for resize
        const tbody = this.host.shadowRoot.querySelector("tbody")
        if (tbody) this.resizeObserver.observe(tbody)
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

    getBaseStyles() {
        return `
            :host {
                display: block;
                cursor: var(--cursor, auto);
                max-height: var(--height, 600px);
                overflow-y: auto;
                overscroll-behavior: none;
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
            .columnLabel { text-align: right; }
        `
    }

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
                text-align: right;
            }
            thead th span {
                position: sticky;
                left: 0;
                right: 0;
            }
            thead th:where(.columnLabel, .indexLabel),
            tbody th {
                position: sticky;
                left: 0;
                z-index: 1;
            }
            ${calcs.join("\n")}
        `
    }

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
            `
        }

        return Object.entries(styleBlocks)
            .filter(([key]) => this.options.styling[key])
            .map(([, style]) => style)
            .join("\n")
    }

    updateColumnWidths() {
        const tbody = this.host.shadowRoot.querySelector("tbody")
        if (!tbody) return

        const firstRow = tbody.querySelector("tr")
        if (!firstRow) return

        const indexHeaders = firstRow.querySelectorAll("th")

        let newWidth = 0
        indexHeaders.forEach((header, index) => {
            this.host.style.setProperty(`--index-col-${index}-offset`, newWidth)
            newWidth = `${header.offsetWidth}px`
        })
    }

    disconnect() {
        this.resizeObserver.disconnect()
    }
}
