'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
    FiBarChart2,
    FiCheckCircle,
    FiClock,
    FiDownload,
    FiFileText,
    FiFilter,
    FiPlus,
    FiRefreshCw,
    FiTrash2,
    FiX,
    FiXCircle,
} from 'react-icons/fi'

const statusOptions = [
    { value: 'all', label: 'ทุกสถานะ' },
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
]

function getStatusTone(status) {
    switch (status) {
        case 'active':
            return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
        case 'inactive':
            return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
        default:
            return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
    }
}

function getSubmissionStatusTone(status) {
    switch (status) {
        case 'approved':
            return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
        case 'rejected':
            return 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
        case 'cancelled':
            return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
        default:
            return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
    }
}

function formatDateTime(value) {
    if (!value) return '-'

    return new Date(value).toLocaleString('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
    })
}

async function requestTemplates(status = 'all', signal) {
    const params = new URLSearchParams()

    if (status && status !== 'all') {
        params.set('status', status)
    }

    const query = params.toString()
    const res = await fetch(`/api/v1/form-template${query ? `?${query}` : ''}`, {
        cache: 'no-store',
        signal,
    })

    const data = await res.json()

    if (!res.ok) {
        throw new Error(data.message || 'โหลดแบบฟอร์มไม่สำเร็จ')
    }

    return data.templates || []
}

async function requestPermissions(signal) {
    const res = await fetch('/api/v1/me/permissions', {
        cache: 'no-store',
        credentials: 'include',
        signal,
    })

    const data = await res.json()

    if (!res.ok) {
        throw new Error(data.message || 'โหลด Permission ไม่สำเร็จ')
    }

    return data.permissions || []
}

async function requestFormSummary(signal) {
    const res = await fetch('/api/v1/form-submission/summary', {
        cache: 'no-store',
        credentials: 'include',
        signal,
    })

    const data = await res.json()

    if (!res.ok) {
        throw new Error(data.message || 'โหลดรายงานฟอร์มไม่สำเร็จ')
    }

    return {
        summary: data.summary || {},
        pending_submissions: data.pending_submissions || [],
    }
}

async function deleteTemplate(templateId) {
    const res = await fetch(`/api/v1/form-template/${templateId}`, {
        method: 'DELETE',
    })

    const data = await res.json()

    if (!res.ok) {
        throw new Error(data.message || 'ลบแบบฟอร์มไม่สำเร็จ')
    }

    return data
}

function ConfirmDeleteCard({
    template,
    onCancel,
    onConfirm,
    deleting,
}) {
    if (!template) return null

    return (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="font-medium">
                        ต้องการลบแบบฟอร์ม {'"'}
                        {template.form_name}
                        {'"'} ใช่ไหม?
                    </p>
                    <p className="mt-1 text-rose-700/80 dark:text-rose-200/80">
                        รายการจะถูกซ่อนจากการใช้งาน แต่ audit log จะยังเก็บประวัติไว้
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={deleting}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        <FiX className="h-4 w-4" />
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={deleting}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                        <FiTrash2 className="h-4 w-4" />
                        {deleting ? 'กำลังลบ...' : 'ลบแบบฟอร์ม'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function SummaryCard({ icon: Icon, label, value, tone }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        {label}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {Number(value || 0).toLocaleString('th-TH')}
                    </p>
                </div>
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </div>
    )
}

export default function FormPage() {
    const [templates, setTemplates] = useState([])
    const [permissions, setPermissions] = useState([])
    const [summary, setSummary] = useState({})
    const [pendingSubmissions, setPendingSubmissions] = useState([])
    const [statusFilter, setStatusFilter] = useState('all')
    const [confirmDelete, setConfirmDelete] = useState(null)
    const [loading, setLoading] = useState(true)
    const [deleting, setDeleting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const canCreateForm = permissions.includes('form.create')
    const canUpdateForm = permissions.includes('form.update')
    const canFillForm = permissions.includes('form.fill')
    const canDeleteForm = permissions.includes('form.delete')
    const canExportForm = permissions.includes('form.export')

    const loadTemplates = async () => {
        setLoading(true)
        setError('')
        setSuccess('')

        try {
            const [rows, report] = await Promise.all([
                requestTemplates(statusFilter),
                requestFormSummary(),
            ])
            setTemplates(rows)
            setSummary(report.summary)
            setPendingSubmissions(report.pending_submissions)
        } catch (err) {
            setError(err.message || 'โหลดแบบฟอร์มไม่สำเร็จ')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const controller = new AbortController()
        let ignore = false

        Promise.all([
            requestTemplates(statusFilter, controller.signal),
            requestPermissions(controller.signal),
            requestFormSummary(controller.signal),
        ])
            .then(([rows, permissionItems, report]) => {
                if (ignore) return
                setTemplates(rows)
                setPermissions(permissionItems)
                setSummary(report.summary)
                setPendingSubmissions(report.pending_submissions)
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
    }, [statusFilter])

    const confirmDeleteTemplate = async () => {
        if (!confirmDelete) return

        setDeleting(true)
        setError('')
        setSuccess('')

        try {
            await deleteTemplate(confirmDelete.form_template_id)
            setSuccess(`ลบแบบฟอร์ม ${confirmDelete.form_name} สำเร็จ`)
            setConfirmDelete(null)
            const [rows, report] = await Promise.all([
                requestTemplates(statusFilter),
                requestFormSummary(),
            ])
            setTemplates(rows)
            setSummary(report.summary)
            setPendingSubmissions(report.pending_submissions)
        } catch (err) {
            setError(err.message || 'ลบแบบฟอร์มไม่สำเร็จ')
        } finally {
            setDeleting(false)
        }
    }

    const summaryCards = [
        {
            label: 'Submitted',
            value: summary.submitted,
            icon: FiClock,
            tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
        },
        {
            label: 'Approved',
            value: summary.approved,
            icon: FiCheckCircle,
            tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
        },
        {
            label: 'Rejected',
            value: summary.rejected,
            icon: FiXCircle,
            tone: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
        },
        {
            label: 'Total',
            value: summary.total_submissions,
            icon: FiBarChart2,
            tone: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
        },
    ]

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 md:px-8">
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300">
                            <FiFileText className="text-xl" />
                        </div>

                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            แบบฟอร์ม
                        </h1>

                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            สร้างและจัดการแบบฟอร์มเอกสาร A4
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={loadTemplates}
                            disabled={loading}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                            รีเฟรช
                        </button>

                        {canCreateForm && (
                            <Link
                                href="/dashboard/form/new"
                                className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-2 text-sm text-white hover:bg-sky-600"
                            >
                                <FiPlus />
                                สร้างแบบฟอร์ม
                            </Link>
                        )}
                    </div>
                </section>

                {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {success}
                    </div>
                )}

                <ConfirmDeleteCard
                    template={confirmDelete}
                    onCancel={() => setConfirmDelete(null)}
                    onConfirm={confirmDeleteTemplate}
                    deleting={deleting}
                />

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {summaryCards.map((item) => (
                        <SummaryCard
                            key={item.label}
                            icon={item.icon}
                            label={item.label}
                            value={item.value}
                            tone={item.tone}
                        />
                    ))}
                </section>

                <section className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                                    เอกสารรออนุมัติ
                                </h2>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    เรียงจากเอกสารที่รอนานที่สุดก่อน
                                </p>
                            </div>

                            <Link
                                href="/dashboard/form/submission?status=submitted"
                                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                                ดูทั้งหมด
                            </Link>
                        </div>

                        <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                            {pendingSubmissions.length === 0 ? (
                                <p className="py-6 text-sm text-slate-500">
                                    ไม่มีเอกสารรออนุมัติ
                                </p>
                            ) : (
                                pendingSubmissions.map((item) => (
                                    <div
                                        key={item.form_submission_id}
                                        className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                                    {item.submission_no}
                                                </p>
                                                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getSubmissionStatusTone(item.status)}`}>
                                                    {item.status}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {item.form_name} · {item.submitted_by_name || item.submitted_by}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-400">
                                                {formatDateTime(item.submitted_at)}
                                            </p>
                                        </div>

                                        <Link
                                            href={`/dashboard/form/submission/${item.form_submission_id}`}
                                            className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-4 py-2 text-sm text-white hover:bg-sky-600"
                                        >
                                            เปิดเอกสาร
                                        </Link>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            Report
                        </h2>
                        <div className="mt-4 space-y-3 text-sm">
                            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
                                <span className="text-slate-500">Active templates</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                    {Number(summary.active_templates || 0).toLocaleString('th-TH')}
                                </span>
                            </div>
                            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
                                <span className="text-slate-500">Today submissions</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                    {Number(summary.today_submissions || 0).toLocaleString('th-TH')}
                                </span>
                            </div>
                        </div>

                        {canExportForm && (
                            <button
                                type="button"
                                onClick={() => {
                                    window.location.href =
                                        '/api/v1/form-submission/summary?format=csv'
                                }}
                                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-green-500 px-4 py-3 text-sm font-medium text-white hover:bg-green-600"
                            >
                                <FiDownload className="h-4 w-4" />
                                Export Summary
                            </button>
                        )}
                    </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div>
                            <label
                                htmlFor="form-status-filter"
                                className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200"
                            >
                                <FiFilter className="h-4 w-4" />
                                สถานะแบบฟอร์ม
                            </label>
                            <select
                                id="form-status-filter"
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value)}
                                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 md:w-60"
                            >
                                {statusOptions.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            พบ {templates.length.toLocaleString('th-TH')} แบบฟอร์ม
                        </p>
                    </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    {loading ? (
                        <p className="text-sm text-slate-500">กำลังโหลด...</p>
                    ) : templates.length === 0 ? (
                        <p className="text-sm text-slate-500">ยังไม่มีแบบฟอร์ม</p>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {templates.map((item) => (
                                <div
                                    key={item.form_template_id}
                                    className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                                                {item.form_name}
                                            </h2>
                                            <p className="mt-1 text-xs text-slate-400">
                                                {item.form_code}
                                            </p>
                                        </div>

                                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusTone(item.status)}`}>
                                            {item.status}
                                        </span>
                                    </div>

                                    <p className="mt-3 line-clamp-2 text-sm text-slate-500">
                                        {item.description || 'ไม่มีคำอธิบาย'}
                                    </p>

                                    <div className="mt-5 flex flex-wrap gap-2">
                                        {canFillForm && (
                                            <Link
                                                href={`/dashboard/form/${item.form_template_id}/fill`}
                                                className="rounded-2xl bg-sky-500 px-4 py-2 text-sm text-white hover:bg-sky-600"
                                            >
                                                กรอกฟอร์ม
                                            </Link>
                                        )}

                                        {canUpdateForm && (
                                            <Link
                                                href={`/dashboard/form/${item.form_template_id}/builder`}
                                                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                                            >
                                                แก้ไข
                                            </Link>
                                        )}

                                        {canDeleteForm && (
                                            <button
                                                type="button"
                                                onClick={() => setConfirmDelete(item)}
                                                className="rounded-2xl border border-rose-200 px-4 py-2 text-sm text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                                            >
                                                ลบ
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    )
}
