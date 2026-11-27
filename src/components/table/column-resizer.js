// Resizes data columns by dragging the handle at the right edge of their header.
// During a drag only the column's <col> and its truncation change (DataTable.previewColumnWidth);
// on release DataTable.setColumnWidth recomputes the layout once (in wrap mode that re-estimates
// all row heights, too slow for every move).
// A double click resets the column to its automatic width.
export class ColumnResizer {
    constructor(dataTable) {
        this.dataTable = dataTable
        // { handle, iloc, x, start, width, min } while dragging
        this._drag = null

        this.handlePointerOver = this.handlePointerOver.bind(this)
        this.handlePointerDown = this.handlePointerDown.bind(this)
        this.handlePointerMove = this.handlePointerMove.bind(this)
        this.handlePointerUp = this.handlePointerUp.bind(this)
        this.handlePointerCancel = this.handlePointerCancel.bind(this)
        this.handleDoubleClick = this.handleDoubleClick.bind(this)
    }

    addEventListeners() {
        this.root.addEventListener("pointerover", this.handlePointerOver)
        this.root.addEventListener("pointerdown", this.handlePointerDown)
        this.root.addEventListener("dblclick", this.handleDoubleClick)
    }

    removeEventListeners() {
        this.root.removeEventListener("pointerover", this.handlePointerOver)
        this.root.removeEventListener("pointerdown", this.handlePointerDown)
        this.root.removeEventListener("dblclick", this.handleDoubleClick)
        if (this._drag) this.handlePointerCancel()
    }

    // MARK: get/set
    get root() {
        return this.dataTable.shadowRoot
    }

    get columnSizer() {
        return this.dataTable.columnSizer
    }

    get isDragging() {
        return this._drag !== null
    }

    // MARK: guide
    // The guide line runs from the top of the header down to the last visible row: the bottom of
    // the viewport or of the table, whichever comes first. Not the full scroll height: a line past
    // the end of a short table would add scrollable overflow.
    updateGuide(handle) {
        const top = handle.closest("th").getBoundingClientRect().top
        const viewport = this.dataTable.getBoundingClientRect().top + this.dataTable.clientHeight
        const table = this.root.querySelector("table").getBoundingClientRect().bottom
        handle.style.setProperty("--resize-guide-height", `${Math.min(viewport, table) - top}px`)
    }

    // MARK: drag
    endDrag() {
        const drag = this._drag
        this._drag = null
        drag.handle.classList.remove("dragging")
        drag.handle.removeEventListener("pointermove", this.handlePointerMove)
        drag.handle.removeEventListener("pointerup", this.handlePointerUp)
        drag.handle.removeEventListener("pointercancel", this.handlePointerCancel)
        return drag
    }

    // MARK: handlers
    handlePointerOver(event) {
        const handle = event.target.closest(".resize-handle")
        if (handle && !this.isDragging) this.updateGuide(handle)
    }

    handlePointerDown(event) {
        const handle = event.target.closest(".resize-handle")
        if (!handle || event.button !== 0 || this.isDragging) return
        // no text selection and no focus change (the compatibility mouse events are not fired)
        event.preventDefault()

        const iloc = Number(handle.closest("th").dataset.col)
        const start = this.columnSizer.widthOf(iloc)
        this._drag = {
            handle,
            iloc,
            x: event.clientX,
            start,
            width: start,
            min: this.columnSizer.minWidth(iloc),
        }
        handle.setPointerCapture(event.pointerId)
        handle.addEventListener("pointermove", this.handlePointerMove)
        handle.addEventListener("pointerup", this.handlePointerUp)
        handle.addEventListener("pointercancel", this.handlePointerCancel)
        handle.classList.add("dragging")
        this.updateGuide(handle)
    }

    handlePointerMove(event) {
        const drag = this._drag
        drag.width = Math.max(drag.min, Math.round(drag.start + event.clientX - drag.x))
        this.dataTable.previewColumnWidth(drag.iloc, drag.width)
    }

    handlePointerUp() {
        const { iloc, start, width } = this.endDrag()
        // a click without movement changes nothing (also not the two clicks of a double click)
        if (width !== start) this.dataTable.setColumnWidth(this.columnSizer.keyOf(iloc), width)
    }

    handlePointerCancel() {
        const { iloc, start } = this.endDrag()
        this.dataTable.previewColumnWidth(iloc, start)
    }

    handleDoubleClick(event) {
        const handle = event.target.closest(".resize-handle")
        if (!handle) return
        const iloc = Number(handle.closest("th").dataset.col)
        this.dataTable.resetColumnWidth(this.columnSizer.keyOf(iloc))
    }
}
