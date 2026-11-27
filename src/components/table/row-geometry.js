// Maps scroll positions to view rows and back, for rows of one fixed height.
// Positions are relative to the top of the tbody.
export class UniformRowGeometry {
    constructor(count, height) {
        this._count = count
        this._height = height
    }

    // MARK: get/set
    get count() {
        return this._count
    }

    get height() {
        return this._height
    }

    get total() {
        return this._count * this._height
    }

    // MARK: geometry
    offsetOf(index) {
        return index * this._height
    }

    indexAt(y) {
        if (this._count === 0 || this._height === 0) return 0
        return Math.min(this._count - 1, Math.max(0, Math.floor(y / this._height)))
    }

    // Uniform rows: measured heights are not used
    setMeasured(start, heights) {}
}
