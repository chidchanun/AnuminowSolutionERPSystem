'use client'

function paginateFields(fields = []) {
    const pages = [
        {
            fields: [],
        },
    ]

    fields.forEach((field) => {
        if (field.type === 'page_break') {
            pages.push({
                fields: [],
            })
            return
        }

        pages[pages.length - 1].fields.push(field)
    })

    return pages
}

function normalizeDocumentConfig(config = {}) {
    return {
        header: {
            enabled: Boolean(config?.header?.enabled),
            text: config?.header?.text || '',
            showLogo: Boolean(config?.header?.showLogo),
            logoUrl: config?.header?.logoUrl || '',
        },
        footer: {
            enabled: Boolean(config?.footer?.enabled),
            text: config?.footer?.text || '',
        },
        pageNumber: {
            enabled: Boolean(config?.pageNumber?.enabled),
        },
    }
}

function getFieldValue(data, fieldId, fallback = '') {
    const value = data?.[fieldId]

    if (value === undefined || value === null) {
        return fallback
    }

    return value
}

function getWidthClass(field) {
    return field.width === 'half'
        ? 'col-span-1'
        : 'col-span-2'
}

function normalizeOptions(field) {
    return Array.isArray(field.options)
        ? field.options
        : []
}

function normalizeColumns(field) {
    return Array.isArray(field.columns) && field.columns.length
        ? field.columns
        : ['รายการ']
}

function DocumentHeader({ config }) {
    const hasHeader =
        config.header.enabled ||
        config.header.text ||
        (config.header.showLogo && config.header.logoUrl)

    if (!hasHeader) return null

    return (
        <div className="mb-6 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-4">
                {config.header.showLogo && config.header.logoUrl && (
                    <img
                        src={config.header.logoUrl}
                        alt="Logo"
                        className="h-14 w-14 object-contain"
                    />
                )}

                <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap text-sm font-medium text-slate-700">
                        {config.header.text || ''}
                    </p>
                </div>
            </div>
        </div>
    )
}

function DocumentFooter({ config, pageIndex, totalPages }) {
    const hasFooter =
        config.footer.enabled ||
        config.footer.text ||
        config.pageNumber.enabled

    if (!hasFooter) return null

    return (
        <div className="mt-8 border-t border-slate-200 pt-3 text-xs text-slate-500">
            <div className="flex items-center justify-between gap-4">
                <p className="whitespace-pre-wrap">
                    {config.footer.text || ''}
                </p>

                {config.pageNumber.enabled && (
                    <p className="shrink-0">
                        หน้า {pageIndex + 1} / {totalPages}
                    </p>
                )}
            </div>
        </div>
    )
}

export default function FormDocumentRenderer({
    title,
    description,
    fields = [],
    data = {},
    editable = false,
    onChange,
    documentConfig = {},
}) {
    const config = normalizeDocumentConfig(documentConfig)
    const pages = paginateFields(fields)

    const updateValue = (fieldId, value) => {
        if (!editable || !onChange) return
        onChange(fieldId, value)
    }

    const toggleCheckboxValue = (fieldId, option) => {
        const currentValue = getFieldValue(data, fieldId, [])
        const currentArray = Array.isArray(currentValue)
            ? currentValue
            : []

        const nextValue = currentArray.includes(option)
            ? currentArray.filter((item) => item !== option)
            : [...currentArray, option]

        updateValue(fieldId, nextValue)
    }

    const updateTableCell = (fieldId, rowIndex, column, value) => {
        const currentValue = getFieldValue(data, fieldId, [])
        const rows = Array.isArray(currentValue) ? [...currentValue] : []

        rows[rowIndex] = {
            ...(rows[rowIndex] || {}),
            [column]: value,
        }

        updateValue(fieldId, rows)
    }

    return (
        <div className="a4-pages">
            {pages.map((page, pageIndex) => (
                <div
                    key={`page-${pageIndex}`}
                    className="a4-page"
                >
                    <DocumentHeader config={config} />

                    <div className="mb-8 text-center">
                        <h1 className="text-2xl font-bold text-slate-900">
                            {title || 'แบบฟอร์ม'}
                        </h1>

                        {description && (
                            <p className="mt-2 text-sm text-slate-500">
                                {description}
                            </p>
                        )}
                    </div>

                    {page.fields.length === 0 ? (
                        <div className="flex min-h-[170mm] items-center justify-center rounded-2xl border border-dashed border-slate-300 text-sm text-slate-400">
                            ไม่มี Field ในหน้านี้
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            {page.fields.map((field) => {
                                const value = getFieldValue(data, field.id, '')
                                const options = normalizeOptions(field)
                                const columns = normalizeColumns(field)
                                const rowCount = Number(field.rows) || 3

                                return (
                                    <div
                                        key={field.id}
                                        className={`a4-field ${getWidthClass(field)}`}
                                    >
                                        <label className="mb-2 block text-sm font-semibold text-slate-900">
                                            {field.label}
                                            {field.required && (
                                                <span className="ml-1 text-red-500">*</span>
                                            )}
                                        </label>

                                        {field.type === 'text' && (
                                            editable ? (
                                                <input
                                                    value={value}
                                                    onChange={(e) =>
                                                        updateValue(field.id, e.target.value)
                                                    }
                                                    placeholder={field.placeholder || ''}
                                                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                                                />
                                            ) : (
                                                <div className="min-h-9 border-b border-slate-400 px-1 py-2 text-sm text-slate-900">
                                                    {value || '-'}
                                                </div>
                                            )
                                        )}

                                        {field.type === 'date' && (
                                            editable ? (
                                                <input
                                                    type="date"
                                                    value={value}
                                                    onChange={(e) =>
                                                        updateValue(field.id, e.target.value)
                                                    }
                                                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                                                />
                                            ) : (
                                                <div className="min-h-9 border-b border-slate-400 px-1 py-2 text-sm text-slate-900">
                                                    {value || '-'}
                                                </div>
                                            )
                                        )}

                                        {field.type === 'textarea' && (
                                            editable ? (
                                                <textarea
                                                    value={value}
                                                    onChange={(e) =>
                                                        updateValue(field.id, e.target.value)
                                                    }
                                                    placeholder={field.placeholder || ''}
                                                    className="min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                                                />
                                            ) : (
                                                <div className="min-h-28 whitespace-pre-wrap rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900">
                                                    {value || '-'}
                                                </div>
                                            )
                                        )}

                                        {field.type === 'select' && (
                                            editable ? (
                                                <select
                                                    value={value}
                                                    onChange={(e) =>
                                                        updateValue(field.id, e.target.value)
                                                    }
                                                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                                                >
                                                    <option value="">เลือกข้อมูล</option>

                                                    {options.map((option, index) => (
                                                        <option
                                                            key={`${field.id}-${option}-${index}`}
                                                            value={option}
                                                        >
                                                            {option}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div className="min-h-9 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900">
                                                    {value || '-'}
                                                </div>
                                            )
                                        )}

                                        {field.type === 'radio' && (
                                            <div className="space-y-2">
                                                {options.map((option, index) => {
                                                    const checked = value === option

                                                    return (
                                                        <label
                                                            key={`${field.id}-${option}-${index}`}
                                                            className="flex items-center gap-2 text-sm text-slate-700"
                                                        >
                                                            <input
                                                                type="radio"
                                                                checked={checked}
                                                                disabled={!editable}
                                                                onChange={() =>
                                                                    updateValue(field.id, option)
                                                                }
                                                            />
                                                            {option}
                                                        </label>
                                                    )
                                                })}
                                            </div>
                                        )}

                                        {field.type === 'checkbox' && (
                                            <div className="space-y-2">
                                                {options.map((option, index) => {
                                                    const currentValue = Array.isArray(value)
                                                        ? value
                                                        : []
                                                    const checked = currentValue.includes(option)

                                                    return (
                                                        <label
                                                            key={`${field.id}-${option}-${index}`}
                                                            className="flex items-center gap-2 text-sm text-slate-700"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                disabled={!editable}
                                                                onChange={() =>
                                                                    toggleCheckboxValue(
                                                                        field.id,
                                                                        option
                                                                    )
                                                                }
                                                            />
                                                            {option}
                                                        </label>
                                                    )
                                                })}
                                            </div>
                                        )}

                                        {field.type === 'table' && (
                                            <div className="overflow-hidden rounded-xl border border-slate-300">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="bg-slate-100">
                                                            {columns.map((column, colIndex) => (
                                                                <th
                                                                    key={`${field.id}-head-${colIndex}`}
                                                                    className="border border-slate-300 px-2 py-2 text-left"
                                                                >
                                                                    {column}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>

                                                    <tbody>
                                                        {Array.from({ length: rowCount }).map(
                                                            (_, rowIndex) => (
                                                                <tr key={`${field.id}-row-${rowIndex}`}>
                                                                    {columns.map((column, colIndex) => {
                                                                        const tableRows = Array.isArray(value)
                                                                            ? value
                                                                            : []
                                                                        const cellValue =
                                                                            tableRows[rowIndex]?.[column] || ''

                                                                        return (
                                                                            <td
                                                                                key={`${field.id}-${rowIndex}-${colIndex}`}
                                                                                className="border border-slate-300 p-1"
                                                                            >
                                                                                {editable ? (
                                                                                    <input
                                                                                        value={cellValue}
                                                                                        onChange={(e) =>
                                                                                            updateTableCell(
                                                                                                field.id,
                                                                                                rowIndex,
                                                                                                column,
                                                                                                e.target.value
                                                                                            )
                                                                                        }
                                                                                        className="w-full border-none bg-transparent px-1 py-1 text-sm outline-none"
                                                                                    />
                                                                                ) : (
                                                                                    <span className="text-sm text-slate-900">
                                                                                        {cellValue || '-'}
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                        )
                                                                    })}
                                                                </tr>
                                                            )
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {field.type === 'signature' && (
                                            editable ? (
                                                <div className="pt-8">
                                                    <input
                                                        value={value}
                                                        onChange={(e) =>
                                                            updateValue(field.id, e.target.value)
                                                        }
                                                        placeholder="พิมพ์ชื่อผู้ลงนาม"
                                                        className="w-full border-b border-slate-400 bg-transparent px-2 py-2 text-center text-sm outline-none"
                                                    />
                                                    <p className="mt-2 text-center text-xs text-slate-500">
                                                        ลงชื่อ / Signature
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="pt-8">
                                                    <div className="border-b border-slate-400 px-2 py-2 text-center text-sm text-slate-900">
                                                        {value || '-'}
                                                    </div>
                                                    <p className="mt-2 text-center text-xs text-slate-500">
                                                        ลงชื่อ / Signature
                                                    </p>
                                                </div>
                                            )
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    <DocumentFooter
                        config={config}
                        pageIndex={pageIndex}
                        totalPages={pages.length}
                    />
                </div>
            ))}
        </div>
    )
}