import { Axis } from "../axis/axis.js"
import { Columns } from "../axis/columns.js"

export class Data extends EventTarget {
    constructor(data={}) {
        super()
        this._isUpdating = false
        this.setData(data)
    }

    _setter(prop, value) {
        if (this[prop] !== value) {
            this[prop] = value
            if (!this._isUpdating) {
                this.dispatchEvent(new Event("data-changed"))
            }
        }
    }

    setData(data) {
        this._isUpdating = true
        this._rawData = data

        const { columns = [], index = [], values = [] } = data
        const { columnNames, indexNames, dtypes, formatOptions } = data

        // mandatory
        this._columns = columns instanceof Columns
            ? columns
            : new Columns(columns, dtypes, formatOptions)
        this._index = index instanceof Axis
            ? index
            : new Axis(index)
        this._values = values

        // optional
        this._columnNames = columnNames
        this._indexNames = indexNames
        this._dtypes = dtypes
        this._formatOptions = formatOptions

        this._isUpdating = false
        this.dispatchEvent(new Event("data-changed"))
    }

    update(changes) {
        this._isUpdating = true
        for (const [key, value] of Object.entries(changes)) {
            if (key in this && typeof this[key] !== "function") {
                this[key] = value
            }
        }
        this._isUpdating = false
        this.dispatchEvent(new Event("data-changed"))
    }

    // MARK: columns
    get columns() { return this._columns }
    set columns(value) {
        const columns = new Columns(value, this.dtypes, this.formatOptions)
        this._setter("_columns", columns)
    }

    get dtypes() { return this.columns.dtypes }
    set dtypes(value) {
        const columns = new Columns(this.columns.values, value, this.formatOptions)
        this._setter("_columns", columns)
    }

    get formatOptions() { return this.columns.formatOptions }
    set formatOptions(value) {
        const columns = new Columns(this.columns.values, this.dtypes, value)
        this._setter("_columns", columns)
    }

    get columnNames() { return this._columnNames }
    set columnNames(value) { this._setter("_columnNames", value) }

    // MARK: index
    get index() { return this._index }
    set index(value) { this._setter("_index", new Axis(value)) }

    get indexNames() { return this._indexNames }
    set indexNames(value) { this._setter("_indexNames", value) }

    // MARK: values
    get values() { return this._values }
    set values(value) { this._setter("_values", value) }
}
