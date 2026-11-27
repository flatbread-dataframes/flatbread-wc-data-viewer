import { TRUNCATABLE_CELLS } from "./cell-layout.js"

// Shows the full value of a truncated cell (truncate mode) after a short hover.
// One shared popover in the data-table shadow root, anchored to the hovered cell.
// Visual only (aria-hidden): the cell itself still holds the full value for screen readers.
export class CellTooltip {
    constructor(dataTable, delay = 400) {
        this.dataTable = dataTable
        this.delay = delay
        this._cell = null
        this._timer = null

        this.handlePointerOver = this.handlePointerOver.bind(this)
        this.handlePointerOut = this.handlePointerOut.bind(this)
        this.handleKeydown = this.handleKeydown.bind(this)
    }

    addEventListeners() {
        this.dataTable.shadowRoot.addEventListener("pointerover", this.handlePointerOver)
        this.dataTable.shadowRoot.addEventListener("pointerout", this.handlePointerOut)
        // capture: Escape closes the tooltip before it reaches anything else (e.g. clear filters)
        document.addEventListener("keydown", this.handleKeydown, true)
    }

    removeEventListeners() {
        this.dataTable.shadowRoot.removeEventListener("pointerover", this.handlePointerOver)
        this.dataTable.shadowRoot.removeEventListener("pointerout", this.handlePointerOut)
        document.removeEventListener("keydown", this.handleKeydown, true)
        this.hide()
    }

    // MARK: get/set
    get element() {
        return this.dataTable.shadowRoot.querySelector(".cell-tooltip")
    }

    get isOpen() {
        return this.element?.matches(":popover-open") ?? false
    }

    get isActive() {
        return this.dataTable.options?.cellLayout === "truncate"
    }

    // MARK: show/hide
    // Only when the value is actually cut off, and only while the cell is still rendered
    show(cell) {
        const tooltip = this.element
        if (!tooltip || !cell.isConnected || cell.scrollWidth <= cell.clientWidth) return
        tooltip.textContent = cell.textContent
        cell.style.setProperty("anchor-name", "--cell-tooltip")
        tooltip.showPopover()
    }

    // Also called when rows are replaced or the table scrolls: the anchor cell is gone or moves
    hide() {
        clearTimeout(this._timer)
        this._timer = null
        this._cell?.style.removeProperty("anchor-name")
        this._cell = null
        if (this.isOpen) this.element.hidePopover()
    }

    // MARK: handlers
    handlePointerOver(event) {
        const cell = event.target.closest(`tbody tr[data-view-row] > ${TRUNCATABLE_CELLS}`)
        if (cell === this._cell) return

        this.hide()
        if (!cell || !this.isActive) return

        this._cell = cell
        this._timer = setTimeout(() => this.show(cell), this.delay)
    }

    handlePointerOut(event) {
        if (this._cell && !this._cell.contains(event.relatedTarget)) this.hide()
    }

    handleKeydown(event) {
        if (event.key !== "Escape" || !this.isOpen) return
        this.hide()
        event.preventDefault()
        event.stopPropagation()
    }
}
