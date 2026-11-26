// Shared cache key for values without format options (a WeakMap key must be an object)
const NO_OPTIONS = {}

// Date.prototype.toLocaleString shows date and time when none of these fields
// are given; Intl.DateTimeFormat would show only the date
const DATETIME_FIELDS = [
    "weekday", "year", "month", "day",
    "dayPeriod", "hour", "minute", "second", "fractionalSecondDigits",
    "dateStyle", "timeStyle",
]
const DATETIME_DEFAULTS = {
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
}

export class Formatter {
    constructor(options) {
        this.options = options
        // dtype -> WeakMap(format options object -> Intl formatter)
        this._cache = new Map()
    }

    formatValue(value, dtype, formatOptions) {
        if (value === null || value === "") return this.options.naRep
        if (!dtype) return value

        switch (dtype) {
            case "int":
            case "float":
                return this.formatNumber(value, formatOptions)
            case "date":
                return this.formatDate(value, formatOptions)
            case "datetime":
                return this.formatDatetime(value, formatOptions)
            default:
                return value.toString()
        }
    }

    formatNumber(value, options) {
        return this.getFormat("float", options).format(value)
    }

    formatDatetime(value, options) {
        return this.getFormat("datetime", options).format(new Date(value))
    }

    formatDate(value, options) {
        return this.getFormat("date", options).format(new Date(value))
    }

    // Returns the cached Intl formatter for this kind and options object, creating it on first use
    getFormat(kind, options) {
        options ??= NO_OPTIONS
        if (!this._cache.has(kind)) this._cache.set(kind, new WeakMap())
        const formats = this._cache.get(kind)
        if (!formats.has(options)) formats.set(options, this.createFormat(kind, options))
        return formats.get(options)
    }

    createFormat(kind, options) {
        const locale = this.options.locale
        switch (kind) {
            case "float":
                return new Intl.NumberFormat(locale, options)
            case "date":
                return new Intl.DateTimeFormat(locale, { dateStyle: "short", ...options })
            case "datetime": {
                const hasFields = DATETIME_FIELDS.some(field => options[field] !== undefined)
                return new Intl.DateTimeFormat(locale, hasFields ? options : { ...DATETIME_DEFAULTS, ...options })
            }
        }
    }
}
