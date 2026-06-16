import { Columns } from "../axis/columns.js"
import { Index } from "../axis/index.js"

export class Data extends EventTarget {
    constructor(data={}) {
        super()
        this._isUpdating = false
        this.setData(data)
    }

    _dispatchDataChanged(isValuesOnly = false) {
        this.dispatchEvent(new CustomEvent("data-changed", {
            detail: {
                data: this,
                isValuesOnly: isValuesOnly
            }
        }))
    }

    _setter(prop, value, isValuesOnly = false) {
        if (this[prop] !== value) {
            this[prop] = value
            if (!this._isUpdating) {
                this._dispatchDataChanged(isValuesOnly)
            }
        }
    }

    setData(data) {
        this._isUpdating = true
        this._rawData = data

        const { columns = {}, index = {}, values = [] } = data

        this._columns = columns instanceof Columns
            ? columns
            : new Columns(columns)
        this._index = index instanceof Index
            ? index
            : new Index(index)
        this._values = values

        this._isUpdating = false
        this._dispatchDataChanged()
    }

    update(changes) {
        this._isUpdating = true

        const isValuesOnly = Object.keys(changes).length === 1 && "values" in changes

        if ("columns" in changes) {
            this._columns = new Columns({
                values: this._columns.values,
                names: this._columns.names,
                dtypes: this._columns.dtypes,
                formatOptions: this._columns.formatOptions,
                ...changes.columns
            })
        }

        if ("index" in changes) {
            this._index = new Index({
                values: this._index.values,
                names: this._index.names,
                dtypes: this._index.dtypes,
                formatOptions: this._index.formatOptions,
                ...changes.index
            })
        }

        if ("values" in changes) {
            this._values = changes.values
        }

        this._isUpdating = false
        this._dispatchDataChanged(isValuesOnly)
    }

    // MARK: columns
    get columns() { return this._columns }
    set columns(value) {
        const columns = value instanceof Columns ? value : new Columns(value)
        this._setter("_columns", columns)
    }

    get hasColumns() {
        return this.columns.length > 0
    }

    // MARK: index
    get index() { return this._index }
    set index(value) {
        const index = value instanceof Index ? value : new Index(value)
        this._setter("_index", index)
    }

    // MARK: values
    get values() { return this._values }
    set values(value) { this._setter("_values", value, true) }
}
