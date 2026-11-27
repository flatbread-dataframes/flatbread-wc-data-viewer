// Detects changes of the viewport (scrolling, resizing) and lets the row window follow
export class ScrollManager {
    constructor(dataTable) {
        this.dataTable = dataTable
        this.handleScroll = this.handleScroll.bind(this)
        this.handleResize = this.handleResize.bind(this)
        this._resizeObserver = new ResizeObserver(this.handleResize)
    }

    addEventListeners() {
        this.dataTable.addEventListener("scroll", this.handleScroll)
        this._resizeObserver.observe(this.dataTable)
    }

    removeEventListeners() {
        this.dataTable.removeEventListener("scroll", this.handleScroll)
        this._resizeObserver.disconnect()
    }

    handleScroll(event) {
        event.stopPropagation()
        this.dataTable.cellTooltip.hide()
        this.dataTable.rowWindow.update()
    }

    // Also fires when the table gets a layout box, e.g. when a hidden ancestor is shown
    handleResize() {
        this.dataTable.rowWindow.resize()
    }
}
