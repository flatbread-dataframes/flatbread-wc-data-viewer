import { Axis } from "./axis.js"

export class Columns extends Axis {
    constructor({ values = [], names, dtypes, formatOptions, nlevels, sourceIlocs } = {}) {
        super(values, { names, nlevels: nlevels ?? names?.length, sourceIlocs })
        this.dtypes = dtypes
        this.formatOptions = formatOptions
        this.spans = this.getSpans()
        this.attrs = this.getAttrs()
    }

    get dtypes() { return this._dtypes }
    set dtypes(value) {
        this._dtypes = value
        this.attrs = this.getAttrs()
    }

    get formatOptions() { return this._formatOptions }
    set formatOptions(value) {
        this._formatOptions = value
        this.attrs = this.getAttrs()
    }

    // Constructor options for the columns at ilocs (see Axis.take): dtypes and formatOptions are per column
    subset(ilocs) {
        return {
            values: ilocs.map(iloc => this.values[iloc]),
            names: this.names,
            dtypes: ilocs.map(iloc => this.dtypes?.[iloc]),
            formatOptions: ilocs.map(iloc => this.formatOptions?.[iloc]),
            nlevels: this.nlevels,
        }
    }

    getAttrs() {
        return this.ilocs.map(this.getAttrsFromIloc.bind(this))
    }

    // Return an array of column attributes
    getAttrsFromIloc(iloc) {
        // Collect the groups the column belongs to
        const groups = []
        if (this.spans) {
            this.spans.forEach(level => {
                let group
                for (const span of level) {
                    if (span.iloc > iloc) break
                    group = span.group
                }
                groups.push(group)
            })
        }
        return {
            iloc: iloc,
            dtype: this.dtypes?.[iloc],
            formatOptions: this.formatOptions?.[iloc],
            groups: groups,
        }
    }
}
