'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    FiArrowDown,
    FiArrowUp,
    FiCheckSquare,
    FiClipboard,
    FiCopy,
    FiFileText,
    FiImage,
    FiMove,
    FiPlus,
    FiSave,
    FiTrash2,
} from 'react-icons/fi'

import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core'

import {
    SortableContext,
    arrayMove,
    rectSortingStrategy,
    sortableKeyboardCoordinates,
    useSortable,
} from '@dnd-kit/sortable'

import { CSS } from '@dnd-kit/utilities'

const fieldTypes = [
    { type: 'text', label: 'ข้อความสั้น' },
    { type: 'textarea', label: 'ข้อความยาว' },
    { type: 'date', label: 'วันที่' },
    { type: 'select', label: 'Dropdown' },
    { type: 'radio', label: 'Radio' },
    { type: 'checkbox', label: 'Checkbox' },
    { type: 'table', label: 'ตาราง' },
    { type: 'signature', label: 'ลายเซ็น' },
    { type: 'page_break', label: 'ขึ้นหน้าใหม่' },
]

function createId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID()
    }

    return `field_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function getDefaultFieldLabel(type) {
    switch (type) {
        case 'text':
            return 'ข้อความสั้น'
        case 'textarea':
            return 'ข้อความยาว'
        case 'date':
            return 'วันที่'
        case 'select':
            return 'Dropdown'
        case 'radio':
            return 'Radio'
        case 'checkbox':
            return 'Checkbox'
        case 'table':
            return 'ตาราง'
        case 'signature':
            return 'ลายเซ็น'
        case 'page_break':
            return 'ขึ้นหน้าใหม่'
        default:
            return 'Field'
    }
}

function createField(type) {
    const id = createId()

    if (type === 'page_break') {
        return {
            id,
            type: 'page_break',
            label: 'ขึ้นหน้าใหม่',
            required: false,
            width: 'full',
            options: [],
        }
    }

    if (type === 'table') {
        return {
            id,
            type: 'table',
            label: 'ตารางรายการ',
            placeholder: '',
            required: false,
            width: 'full',
            columns: ['รายการ', 'จำนวน', 'หมายเหตุ'],
            rows: 3,
            options: [],
        }
    }

    return {
        id,
        type,
        label: getDefaultFieldLabel(type),
        placeholder: '',
        required: false,
        width: 'full',
        options:
            type === 'select' || type === 'radio' || type === 'checkbox'
                ? ['ตัวเลือกที่ 1', 'ตัวเลือกที่ 2']
                : [],
    }
}

function duplicateFieldWithNewId(field) {
    return {
        ...field,
        id: createId(),
        label:
            field.type === 'page_break'
                ? field.label
                : `${field.label || 'Field'} copy`,
    }
}

function safeLayout(layout) {
    return {
        title: layout?.title || '',
        fields: Array.isArray(layout?.fields) ? layout.fields : [],
        document: {
            header: {
                enabled: Boolean(layout?.document?.header?.enabled),
                text: layout?.document?.header?.text || '',
                showLogo: Boolean(layout?.document?.header?.showLogo),
                logoUrl: layout?.document?.header?.logoUrl || '',
            },
            footer: {
                enabled: Boolean(layout?.document?.footer?.enabled),
                text: layout?.document?.footer?.text || '',
            },
            pageNumber: {
                enabled: Boolean(layout?.document?.pageNumber?.enabled),
            },
        },
    }
}

function paginateFields(fields = []) {
    const pages = [
        {
            fields: [],
            breakField: null,
        },
    ]

    fields.forEach((field) => {
        if (field.type === 'page_break') {
            pages[pages.length - 1].breakField = field

            pages.push({
                fields: [],
                breakField: null,
            })

            return
        }

        pages[pages.length - 1].fields.push(field)
    })

    return pages
}

async function requestTemplate(templateId, signal) {
    const res = await fetch(`/api/v1/form-template/${templateId}`, {
        cache: 'no-store',
        signal,
    })

    const data = await res.json()

    if (!res.ok) {
        throw new Error(data.message || 'โหลดแบบฟอร์มไม่สำเร็จ')
    }

    return data.template
}

function DocumentHeader({ meta }) {
    const hasHeader =
        meta.header_enabled ||
        meta.header_text ||
        (meta.show_logo && meta.logo_url)

    if (!hasHeader) return null

    return (
        <div className="mb-6 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-4">
                {meta.show_logo && meta.logo_url && (
                    <img
                        src={meta.logo_url}
                        alt="Logo"
                        className="h-14 w-14 object-contain"
                    />
                )}

                <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap text-sm font-medium text-slate-700">
                        {meta.header_text || 'Header'}
                    </p>
                </div>
            </div>
        </div>
    )
}

function DocumentFooter({ meta, pageIndex, totalPages }) {
    const hasFooter = meta.footer_enabled || meta.footer_text || meta.show_page_number

    if (!hasFooter) return null

    return (
        <div className="mt-8 border-t border-slate-200 pt-3 text-xs text-slate-500">
            <div className="flex items-center justify-between gap-4">
                <p className="whitespace-pre-wrap">
                    {meta.footer_text || ''}
                </p>

                {meta.show_page_number && (
                    <p className="shrink-0">
                        หน้า {pageIndex + 1} / {totalPages}
                    </p>
                )}
            </div>
        </div>
    )
}

function PreviewField({ field, selected, onSelect }) {
    const options = Array.isArray(field.options) ? field.options : []
    const columns = Array.isArray(field.columns) ? field.columns : []
    const rowCount = Number(field.rows) || 3

    return (
        <button
            type="button"
            onClick={onSelect}
            className={`
                a4-field w-full text-left
                rounded-xl border p-3 transition
                ${
                    selected
                        ? 'border-sky-500 bg-sky-50'
                        : 'border-slate-200 bg-white hover:border-sky-300'
                }
            `}
        >
            <div className="mb-2 flex items-center justify-between gap-2 pr-10">
                <p className="text-sm font-semibold text-slate-900">
                    {field.label || 'ไม่มีชื่อ field'}
                    {field.required && (
                        <span className="ml-1 text-red-500">*</span>
                    )}
                </p>

                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                    {field.type}
                </span>
            </div>

            {field.type === 'text' && (
                <div className="h-9 border-b border-dashed border-slate-400 text-xs text-slate-400">
                    {field.placeholder}
                </div>
            )}

            {field.type === 'date' && (
                <div className="h-9 border-b border-dashed border-slate-400 text-xs text-slate-400">
                    วัน / เดือน / ปี
                </div>
            )}

            {field.type === 'textarea' && (
                <div className="min-h-24 rounded-lg border border-dashed border-slate-300 p-2 text-xs text-slate-400">
                    {field.placeholder || 'พื้นที่กรอกข้อความ'}
                </div>
            )}

            {field.type === 'select' && (
                <div className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-500">
                    เลือกข้อมูล
                </div>
            )}

            {field.type === 'radio' && (
                <div className="space-y-2">
                    {options.map((option, index) => (
                        <div
                            key={`${field.id}-${option}-${index}`}
                            className="flex items-center gap-2 text-xs text-slate-600"
                        >
                            <span className="h-3 w-3 rounded-full border border-slate-400" />
                            {option}
                        </div>
                    ))}
                </div>
            )}

            {field.type === 'checkbox' && (
                <div className="space-y-2">
                    {options.map((option, index) => (
                        <div
                            key={`${field.id}-${option}-${index}`}
                            className="flex items-center gap-2 text-xs text-slate-600"
                        >
                            <span className="h-3 w-3 rounded border border-slate-400" />
                            {option}
                        </div>
                    ))}
                </div>
            )}

            {field.type === 'table' && (
                <div className="overflow-hidden rounded-xl border border-slate-300">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-slate-100">
                                {columns.map((column, index) => (
                                    <th
                                        key={`${field.id}-col-${index}`}
                                        className="border border-slate-300 px-2 py-2 text-left font-semibold"
                                    >
                                        {column}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: rowCount }).map((_, rowIndex) => (
                                <tr key={`${field.id}-row-${rowIndex}`}>
                                    {columns.map((column, colIndex) => (
                                        <td
                                            key={`${field.id}-${rowIndex}-${colIndex}`}
                                            className="h-8 border border-slate-300 px-2 text-slate-400"
                                        >
                                            -
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {field.type === 'signature' && (
                <div className="mt-8 border-t border-dashed border-slate-400 pt-2 text-center text-xs text-slate-500">
                    ลงชื่อ / Signature
                </div>
            )}
        </button>
    )
}

function SortablePreviewField({ field, selected, onSelect }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: field.id,
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
        zIndex: isDragging ? 50 : 'auto',
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={field.width === 'half' ? 'col-span-1' : 'col-span-2'}
        >
            <div className="group relative">
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-100 active:cursor-grabbing"
                    title="ลากเพื่อจัดเรียง"
                    onClick={(e) => e.stopPropagation()}
                >
                    <FiMove />
                </button>

                <PreviewField
                    field={field}
                    selected={selected}
                    onSelect={onSelect}
                />
            </div>
        </div>
    )
}

function SortablePageBreak({ field, selected, onSelect }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: field.id,
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="no-print mx-auto w-[210mm]"
        >
            <div
                className={`
                    my-4 rounded-2xl border-2 border-dashed p-3 text-center text-xs font-semibold transition
                    ${
                        selected
                            ? 'border-sky-500 bg-sky-50 text-sky-700'
                            : 'border-slate-300 bg-slate-50 text-slate-500'
                    }
                `}
            >
                <button
                    type="button"
                    onClick={onSelect}
                    className="mr-3"
                >
                    Page Break / ขึ้นหน้าใหม่
                </button>

                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="inline-flex cursor-grab items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1 text-slate-500 active:cursor-grabbing"
                >
                    <FiMove />
                    ลาก
                </button>
            </div>
        </div>
    )
}

export default function FormBuilderEditor({ templateId = null }) {
    const router = useRouter()
    const isEditMode = Boolean(templateId)

    const [meta, setMeta] = useState({
        form_name: '',
        form_code: '',
        description: '',
        status: 'draft',
        orientation: 'portrait',

        header_enabled: false,
        header_text: '',
        footer_enabled: false,
        footer_text: '',
        show_page_number: true,
        show_logo: false,
        logo_url: '',
    })

    const [fields, setFields] = useState([])
    const [selectedFieldId, setSelectedFieldId] = useState(null)
    const [copiedField, setCopiedField] = useState(null)
    const [previewScale, setPreviewScale] = useState(1)

    const [loading, setLoading] = useState(Boolean(templateId))
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const pages = useMemo(() => paginateFields(fields), [fields])

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 6,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const selectedField = useMemo(
        () => fields.find((field) => field.id === selectedFieldId) || null,
        [fields, selectedFieldId]
    )

    const layoutJson = useMemo(
        () => ({
            title: meta.form_name,
            paper: {
                size: 'A4',
                orientation: meta.orientation,
            },
            document: {
                header: {
                    enabled: meta.header_enabled,
                    text: meta.header_text,
                    showLogo: meta.show_logo,
                    logoUrl: meta.logo_url,
                },
                footer: {
                    enabled: meta.footer_enabled,
                    text: meta.footer_text,
                },
                pageNumber: {
                    enabled: meta.show_page_number,
                },
            },
            fields,
        }),
        [meta, fields]
    )

    useEffect(() => {
        if (!templateId) return

        const controller = new AbortController()
        let ignore = false

        requestTemplate(templateId, controller.signal)
            .then((template) => {
                if (ignore) return

                const layout = safeLayout(template.layout_json)

                setMeta({
                    form_name: template.form_name || '',
                    form_code: template.form_code || '',
                    description: template.description || '',
                    status: template.status || 'draft',
                    orientation: template.orientation || 'portrait',

                    header_enabled: layout.document.header.enabled,
                    header_text: layout.document.header.text,
                    footer_enabled: layout.document.footer.enabled,
                    footer_text: layout.document.footer.text,
                    show_page_number: layout.document.pageNumber.enabled,
                    show_logo: layout.document.header.showLogo,
                    logo_url: layout.document.header.logoUrl,
                })

                setFields(layout.fields)
                setSelectedFieldId(layout.fields[0]?.id || null)
            })
            .catch((err) => {
                if (ignore || err.name === 'AbortError') return
                setError(err.message || 'โหลดแบบฟอร์มไม่สำเร็จ')
            })
            .finally(() => {
                if (ignore) return
                setLoading(false)
            })

        return () => {
            ignore = true
            controller.abort()
        }
    }, [templateId])

    const updateMeta = (key, value) => {
        setMeta((prev) => ({
            ...prev,
            [key]: value,
        }))
    }

    const handleDragEnd = (event) => {
        const { active, over } = event

        if (!over || active.id === over.id) return

        setFields((prev) => {
            const oldIndex = prev.findIndex((field) => field.id === active.id)
            const newIndex = prev.findIndex((field) => field.id === over.id)

            if (oldIndex === -1 || newIndex === -1) return prev

            return arrayMove(prev, oldIndex, newIndex)
        })
    }

    const addField = (type) => {
        const field = createField(type)

        setFields((prev) => [...prev, field])
        setSelectedFieldId(field.id)
    }

    const updateField = (key, value) => {
        if (!selectedFieldId) return

        setFields((prev) =>
            prev.map((field) =>
                field.id === selectedFieldId
                    ? {
                          ...field,
                          [key]: value,
                      }
                    : field
            )
        )
    }

    const deleteField = () => {
        if (!selectedFieldId) return

        setFields((prev) => {
            const next = prev.filter((field) => field.id !== selectedFieldId)
            setSelectedFieldId(next[0]?.id || null)
            return next
        })
    }

    const moveField = (direction) => {
        if (!selectedFieldId) return

        setFields((prev) => {
            const index = prev.findIndex((field) => field.id === selectedFieldId)

            if (index === -1) return prev

            const targetIndex = direction === 'up' ? index - 1 : index + 1

            if (targetIndex < 0 || targetIndex >= prev.length) return prev

            const next = [...prev]
            const temp = next[index]

            next[index] = next[targetIndex]
            next[targetIndex] = temp

            return next
        })
    }

    const duplicateSelectedField = () => {
        if (!selectedField) return

        const duplicated = duplicateFieldWithNewId(selectedField)

        setFields((prev) => {
            const index = prev.findIndex((field) => field.id === selectedField.id)
            const next = [...prev]

            next.splice(index + 1, 0, duplicated)

            return next
        })

        setSelectedFieldId(duplicated.id)
    }

    const copySelectedField = () => {
        if (!selectedField) return
        setCopiedField(selectedField)
        setSuccess('Copy field แล้ว')
    }

    const pasteCopiedField = () => {
        if (!copiedField) return

        const pasted = duplicateFieldWithNewId(copiedField)

        setFields((prev) => [...prev, pasted])
        setSelectedFieldId(pasted.id)
    }

    const updateOptionsFromText = (value) => {
        const options = value
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean)

        updateField('options', options)
    }

    const updateColumnsFromText = (value) => {
        const columns = value
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean)

        updateField('columns', columns)
    }

    const saveTemplate = async () => {
        setSaving(true)
        setError('')
        setSuccess('')

        try {
            if (!meta.form_name || !meta.form_code) {
                setError('กรุณากรอกชื่อฟอร์มและรหัสฟอร์ม')
                setSaving(false)
                return
            }

            const realFields = fields.filter((field) => field.type !== 'page_break')

            if (realFields.length === 0) {
                setError('กรุณาเพิ่ม field อย่างน้อย 1 รายการ')
                setSaving(false)
                return
            }

            const payload = {
                ...meta,
                layout_json: layoutJson,
            }

            const url = isEditMode
                ? `/api/v1/form-template/${templateId}`
                : '/api/v1/form-template'

            const method = isEditMode ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.message || 'บันทึกแบบฟอร์มไม่สำเร็จ')
            }

            setSuccess('บันทึกแบบฟอร์มสำเร็จ')

            if (!isEditMode && data.form_template_id) {
                router.replace(`/dashboard/form/${data.form_template_id}/builder`)
            }
        } catch (err) {
            setError(err.message || 'บันทึกแบบฟอร์มไม่สำเร็จ')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 md:px-8">
                <div className="mx-auto max-w-7xl rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                    กำลังโหลด Form Builder...
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 md:px-8">
            <div className="mx-auto max-w-[1700px] space-y-6">
                <section className="no-print flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300">
                            <FiFileText className="text-xl" />
                        </div>

                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            {isEditMode ? 'แก้ไขแบบฟอร์ม' : 'สร้างแบบฟอร์มใหม่'}
                        </h1>

                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            ออกแบบแบบฟอร์ม A4 หลายหน้า พร้อม Header, Footer, Logo และ Table
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <select
                            value={previewScale}
                            onChange={(e) => setPreviewScale(Number(e.target.value))}
                            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                        >
                            <option value={0.75}>Preview 75%</option>
                            <option value={1}>Preview 100%</option>
                            <option value={1.25}>Preview 125%</option>
                        </select>

                        <button
                            type="button"
                            onClick={saveTemplate}
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-60"
                        >
                            <FiSave />
                            {saving ? 'กำลังบันทึก...' : 'บันทึกแบบฟอร์ม'}
                        </button>
                    </div>
                </section>

                {error && (
                    <div className="no-print rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="no-print rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
                        {success}
                    </div>
                )}

                <div className="grid gap-6 xl:grid-cols-[360px_1fr_360px]">
                    <aside className="no-print space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div>
                            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                                ข้อมูลแบบฟอร์ม
                            </h2>

                            <div className="mt-4 space-y-4">
                                <div>
                                    <label className="text-sm text-slate-500">
                                        ชื่อฟอร์ม
                                    </label>
                                    <input
                                        value={meta.form_name}
                                        onChange={(e) =>
                                            updateMeta('form_name', e.target.value)
                                        }
                                        className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                                        placeholder="เช่น ใบขอลา"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm text-slate-500">
                                        รหัสฟอร์ม
                                    </label>
                                    <input
                                        value={meta.form_code}
                                        onChange={(e) =>
                                            updateMeta('form_code', e.target.value)
                                        }
                                        className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                                        placeholder="เช่น LEAVE-FORM"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm text-slate-500">
                                        คำอธิบาย
                                    </label>
                                    <textarea
                                        value={meta.description}
                                        onChange={(e) =>
                                            updateMeta('description', e.target.value)
                                        }
                                        className="mt-1 min-h-20 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm text-slate-500">
                                        สถานะ
                                    </label>
                                    <select
                                        value={meta.status}
                                        onChange={(e) =>
                                            updateMeta('status', e.target.value)
                                        }
                                        className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                                    >
                                        <option value="draft">Draft</option>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
                            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                                Header / Footer
                            </h2>

                            <div className="mt-4 space-y-4">
                                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 text-sm dark:border-slate-800">
                                    <input
                                        type="checkbox"
                                        checked={meta.header_enabled}
                                        onChange={(e) =>
                                            updateMeta('header_enabled', e.target.checked)
                                        }
                                    />
                                    เปิด Header
                                </label>

                                <textarea
                                    value={meta.header_text}
                                    onChange={(e) =>
                                        updateMeta('header_text', e.target.value)
                                    }
                                    className="min-h-20 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                                    placeholder="ข้อความ Header เช่น ชื่อบริษัท / ที่อยู่"
                                />

                                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 text-sm dark:border-slate-800">
                                    <input
                                        type="checkbox"
                                        checked={meta.show_logo}
                                        onChange={(e) =>
                                            updateMeta('show_logo', e.target.checked)
                                        }
                                    />
                                    แสดง Logo
                                </label>

                                <div>
                                    <label className="mb-1 flex items-center gap-2 text-sm text-slate-500">
                                        <FiImage />
                                        Logo URL
                                    </label>
                                    <input
                                        value={meta.logo_url}
                                        onChange={(e) =>
                                            updateMeta('logo_url', e.target.value)
                                        }
                                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                                        placeholder="/uploads/company/logo.png"
                                    />
                                </div>

                                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 text-sm dark:border-slate-800">
                                    <input
                                        type="checkbox"
                                        checked={meta.footer_enabled}
                                        onChange={(e) =>
                                            updateMeta('footer_enabled', e.target.checked)
                                        }
                                    />
                                    เปิด Footer
                                </label>

                                <textarea
                                    value={meta.footer_text}
                                    onChange={(e) =>
                                        updateMeta('footer_text', e.target.value)
                                    }
                                    className="min-h-16 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                                    placeholder="ข้อความ Footer"
                                />

                                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 text-sm dark:border-slate-800">
                                    <input
                                        type="checkbox"
                                        checked={meta.show_page_number}
                                        onChange={(e) =>
                                            updateMeta('show_page_number', e.target.checked)
                                        }
                                    />
                                    แสดงเลขหน้า
                                </label>
                            </div>
                        </div>

                        <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
                            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                                เพิ่ม Field
                            </h2>

                            <div className="mt-4 grid grid-cols-2 gap-2">
                                {fieldTypes.map((item) => (
                                    <button
                                        key={item.type}
                                        type="button"
                                        onClick={() => addField(item.type)}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 px-3 py-3 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                                    >
                                        <FiPlus />
                                        {item.label}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={pasteCopiedField}
                                disabled={!copiedField}
                                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 px-3 py-3 text-sm hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                                <FiClipboard />
                                Paste Field
                            </button>
                        </div>
                    </aside>

                    <section className="overflow-x-auto rounded-3xl border border-slate-200 bg-slate-200/60 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        {fields.length === 0 ? (
                            <div className="a4-page">
                                <DocumentHeader meta={meta} />

                                <div className="mb-8 text-center">
                                    <h1 className="text-2xl font-bold">
                                        {meta.form_name || 'ชื่อแบบฟอร์ม'}
                                    </h1>

                                    {meta.description && (
                                        <p className="mt-2 text-sm text-slate-500">
                                            {meta.description}
                                        </p>
                                    )}
                                </div>

                                <div className="flex min-h-[160mm] items-center justify-center rounded-2xl border border-dashed border-slate-300 text-sm text-slate-400">
                                    เพิ่ม Field ทางด้านซ้ายเพื่อเริ่มออกแบบฟอร์ม
                                </div>

                                <DocumentFooter
                                    meta={meta}
                                    pageIndex={0}
                                    totalPages={1}
                                />
                            </div>
                        ) : (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={fields.map((field) => field.id)}
                                    strategy={rectSortingStrategy}
                                >
                                    <div
                                        style={{
                                            transform: `scale(${previewScale})`,
                                            transformOrigin: 'top center',
                                        }}
                                    >
                                        <div className="a4-pages">
                                            {pages.map((page, pageIndex) => (
                                                <div key={`page-wrap-${pageIndex}`}>
                                                    <div className="a4-page">
                                                        <DocumentHeader meta={meta} />

                                                        <div className="mb-8 text-center">
                                                            <h1 className="text-2xl font-bold">
                                                                {meta.form_name || 'ชื่อแบบฟอร์ม'}
                                                            </h1>

                                                            {meta.description && (
                                                                <p className="mt-2 text-sm text-slate-500">
                                                                    {meta.description}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {page.fields.length === 0 ? (
                                                            <div className="flex min-h-[150mm] items-center justify-center rounded-2xl border border-dashed border-slate-300 text-sm text-slate-400">
                                                                หน้านี้ยังไม่มี Field
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-2 gap-4">
                                                                {page.fields.map((field) => (
                                                                    <SortablePreviewField
                                                                        key={field.id}
                                                                        field={field}
                                                                        selected={field.id === selectedFieldId}
                                                                        onSelect={() =>
                                                                            setSelectedFieldId(field.id)
                                                                        }
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}

                                                        <DocumentFooter
                                                            meta={meta}
                                                            pageIndex={pageIndex}
                                                            totalPages={pages.length}
                                                        />
                                                    </div>

                                                    {page.breakField && (
                                                        <SortablePageBreak
                                                            field={page.breakField}
                                                            selected={
                                                                page.breakField.id === selectedFieldId
                                                            }
                                                            onSelect={() =>
                                                                setSelectedFieldId(page.breakField.id)
                                                            }
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </SortableContext>
                            </DndContext>
                        )}
                    </section>

                    <aside className="no-print rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                                ตั้งค่า Field
                            </h2>

                            {selectedField && (
                                <FiCheckSquare className="text-sky-500" />
                            )}
                        </div>

                        {!selectedField ? (
                            <p className="mt-4 text-sm text-slate-500">
                                เลือก field จากหน้า A4 เพื่อแก้ไข
                            </p>
                        ) : selectedField.type === 'page_break' ? (
                            <div className="mt-4 space-y-4">
                                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950">
                                    Page Break ใช้สำหรับขึ้นหน้าใหม่
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => moveField('up')}
                                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                                    >
                                        <FiArrowUp />
                                        ขึ้น
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => moveField('down')}
                                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                                    >
                                        <FiArrowDown />
                                        ลง
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={deleteField}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm text-white hover:bg-red-600"
                                >
                                    <FiTrash2 />
                                    ลบ Page Break
                                </button>
                            </div>
                        ) : (
                            <div className="mt-4 space-y-4">
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => moveField('up')}
                                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                                    >
                                        <FiArrowUp />
                                        ขึ้น
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => moveField('down')}
                                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                                    >
                                        <FiArrowDown />
                                        ลง
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={duplicateSelectedField}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                                    >
                                        <FiCopy />
                                        Duplicate
                                    </button>

                                    <button
                                        type="button"
                                        onClick={copySelectedField}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                                    >
                                        <FiClipboard />
                                        Copy
                                    </button>
                                </div>

                                <div>
                                    <label className="text-sm text-slate-500">
                                        Label
                                    </label>
                                    <input
                                        value={selectedField.label || ''}
                                        onChange={(e) =>
                                            updateField('label', e.target.value)
                                        }
                                        className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                                    />
                                </div>

                                {!['table'].includes(selectedField.type) && (
                                    <div>
                                        <label className="text-sm text-slate-500">
                                            Placeholder
                                        </label>
                                        <input
                                            value={selectedField.placeholder || ''}
                                            onChange={(e) =>
                                                updateField('placeholder', e.target.value)
                                            }
                                            className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="text-sm text-slate-500">
                                        ความกว้าง
                                    </label>
                                    <select
                                        value={selectedField.width || 'full'}
                                        onChange={(e) =>
                                            updateField('width', e.target.value)
                                        }
                                        className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                                    >
                                        <option value="full">เต็มแถว</option>
                                        <option value="half">ครึ่งแถว</option>
                                    </select>
                                </div>

                                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 text-sm dark:border-slate-800">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(selectedField.required)}
                                        onChange={(e) =>
                                            updateField('required', e.target.checked)
                                        }
                                    />
                                    จำเป็นต้องกรอก
                                </label>

                                {['select', 'radio', 'checkbox'].includes(
                                    selectedField.type
                                ) && (
                                    <div>
                                        <label className="text-sm text-slate-500">
                                            ตัวเลือก แยกบรรทัดละ 1 ตัวเลือก
                                        </label>
                                        <textarea
                                            value={(selectedField.options || []).join('\n')}
                                            onChange={(e) =>
                                                updateOptionsFromText(e.target.value)
                                            }
                                            className="mt-1 min-h-32 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                                        />
                                    </div>
                                )}

                                {selectedField.type === 'table' && (
                                    <>
                                        <div>
                                            <label className="text-sm text-slate-500">
                                                Column ตาราง แยกบรรทัดละ 1 Column
                                            </label>
                                            <textarea
                                                value={(selectedField.columns || []).join('\n')}
                                                onChange={(e) =>
                                                    updateColumnsFromText(e.target.value)
                                                }
                                                className="mt-1 min-h-32 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-sm text-slate-500">
                                                จำนวนแถว
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="30"
                                                value={selectedField.rows || 3}
                                                onChange={(e) =>
                                                    updateField('rows', Number(e.target.value))
                                                }
                                                className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                                            />
                                        </div>
                                    </>
                                )}

                                <button
                                    type="button"
                                    onClick={deleteField}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm text-white hover:bg-red-600"
                                >
                                    <FiTrash2 />
                                    ลบ Field
                                </button>
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        </main>
    )
}