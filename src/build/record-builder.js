import { Formatter } from "./formatter.js"


export class RecordBuilder {
    constructor(dataViewer, options) {
        this.dataViewer = dataViewer
        this.options = options
        this.formatter = new Formatter(options)
    }

    buildRecord() {
        const record = this.dataViewer.currentRecord
        if (!record) return "<p>No record selected</p>"

        return `
            <div class="record-view">
                ${this.buildRecordNavigation()}
                ${this.buildRecordFields()}
            </div>
        `
    }

    buildRecordNavigation() {
        const current = this.dataViewer.currentRecordIndex + 1
        const total = this.dataViewer.view.visibleIndices.length
        const record = this.dataViewer.currentRecord

        const indexDisplay = Array.isArray(record.indexValue)
            ? record.indexValue.join(" | ")
            : record.indexValue

        return `
            <nav class="record-navigation">
                <div class="nav-buttons">
                    <button data-nav="first">⏮</button>
                    <button data-nav="prev">◀</button>
                    <button data-nav="next">▶</button>
                    <button data-nav="last">⏭</button>
                </div>
                <div class="record-info">
                    <span class="record-position">Record ${current} of ${total}</span>
                    <span class="record-index">${indexDisplay}</span>
                </div>
                <button data-nav="exit" class="exit-button">✕</button>
            </nav>
        `
    }

    buildRecordFields() {
        if (!this.dataViewer.view.columns.isMultiIndex) {
            return this.buildFlatFields()
        }
        return this.buildGroupedFields()
    }

    buildFlatFields() {
        const record = this.dataViewer.currentRecord
        const fields = this.dataViewer.view.columns.values.map((columnValue, iloc) => {
            const value = record.values[iloc]
            const attrs = this.dataViewer.view.columns.attrs[iloc]
            const formatOptions = attrs.formatOptions ?? this.options
            return this.buildRecordField(columnValue, value, attrs.dtype, formatOptions)
        })

        return `<div class="record-fields">${fields.join("")}</div>`
    }

    buildGroupedFields() {
        const groups = this.buildFieldGroups()
        return groups.map(group => this.buildFieldGroup(group)).join("")
    }

    buildFieldGroups() {
        const record = this.dataViewer.currentRecord
        const groups = new Map()

        this.dataViewer.view.columns.values.forEach((columnValue, iloc) => {
            const value = record.values[iloc]
            const attrs = this.dataViewer.view.columns.attrs[iloc]

            const groupPath = Array.isArray(columnValue) ? columnValue.slice(0, -1) : []
            const fieldLabel = Array.isArray(columnValue) ? columnValue.at(-1) : columnValue

            const groupKey = groupPath.join(" > ") || "Fields"

            if (!groups.has(groupKey)) {
                groups.set(groupKey, {
                    path: groupPath,
                    fields: []
                })
            }

            groups.get(groupKey).fields.push({
                label: fieldLabel,
                value: value,
                dtype: attrs.dtype,
                formatOptions: attrs.formatOptions ?? this.options
            })
        })

        return Array.from(groups.values())
    }

    buildFieldGroup(group) {
        const fields = group.fields.map(field =>
            this.buildRecordField(field.label, field.value, field.dtype, field.formatOptions)
        ).join("")

        const groupTitle = group.path.length > 0 ? group.path.at(-1) : "Fields"

        return `
            <div class="field-group">
                <h3 class="group-title">${groupTitle}</h3>
                <div class="record-fields">${fields}</div>
            </div>
        `
    }

    buildRecordField(label, value, dtype, formatOptions) {
        const formattedValue = this.formatter.formatValue(value, dtype, formatOptions)

        return `
            <div class="record-field">
                <label class="field-label">${label}:</label>
                <span class="field-value" data-dtype="${dtype}">${formattedValue}</span>
            </div>
        `
    }
}
