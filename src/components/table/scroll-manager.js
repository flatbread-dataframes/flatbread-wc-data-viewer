export class ScrollManager {
    constructor(dataTable) {
        this.dataTable = dataTable
        this.handleScroll = this.handleScroll.bind(this)
    }

    addEventListeners() {
        this.dataTable.addEventListener("scroll", this.handleScroll)
    }

    removeEventListeners() {
        this.dataTable.removeEventListener("scroll", this.handleScroll)
    }

    handleScroll(event) {
        event.stopPropagation()
        const table = event.target
        const tbody = this.dataTable.shadowRoot.querySelector("tbody")

        const scrollThreshold = 150
        const nearBottom = table.scrollHeight - (table.scrollTop + table.clientHeight) < scrollThreshold

        if (nearBottom && tbody) {
            this.dataTable.dispatchEvent(new CustomEvent("load-more-rows", {
                detail: {
                    currentRowCount: tbody.rows.length,
                    bufferSize: this.dataTable.dataViewer.options.buffer
                },
                bubbles: true,
                composed: true
            }))
        }
    }
}
