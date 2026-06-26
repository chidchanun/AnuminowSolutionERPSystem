'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
    FiCheckCircle,
    FiChevronLeft,
    FiChevronRight,
    FiClock,
    FiInbox,
    FiRefreshCw,
    FiSearch,
    FiSend,
    FiX,
} from 'react-icons/fi'

const scopeOptions = [
    {
        value: 'pending_approval',
        label: 'รอฉันอนุมัติ',
        icon: FiClock,
    },
    {
        value: 'my_submissions',
        label: 'เอกสารที่ฉันส่ง',
        icon: FiSend,
    },
    {
        value: 'decided',
        label: 'อนุมัติแล้ว / ถูกปฏิเสธ',
        icon: FiCheckCircle,
    },
]

const initialFilters = {
    scope: 'pending_approval',
    search: '',
    page: 1,
    limit: 20,
}

function getStatusTone(status) {
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

async function requestInbox(filters, signal) {
    const params = new URLSearchParams()

    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            params.set(key, value)
        }
    })

    const res = await fetch(`/api/v1/form-submission/inbox?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
        signal,
    })

    const data = await res.json()

    if (!res.ok) {
        throw new Error(data.message || 'โหลด Form Inbox ไม่สำเร็จ')
    }

    return data
}

export default function FormInboxPage() {
    const [filters, setFilters] = useState(initialFilters)
    const [draftSearch, setDraftSearch] = useState('')
    const [submissions, setSubmissions] = useState([])
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        total_pages: 0,
    })
    const [canApprove, setCanApprove] = useState(false)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState('')

    const applyInboxData = (data) => {
        setSubmissions(data.submissions || [])
        setCanApprove(Boolean(data.can_approve))
        setPagination(data.pagination || {
            page: 1,
            limit: 20,
            total: 0,
            total_pages: 0,
        })
    }

    const loadInbox = async ({
        nextFilters = filters,
        signal,
        refresh = false,
    } = {}) => {
        if (refresh) {
            setRefreshing(true)
        } else {
            setLoading(true)
        }
        setError('')

        try {
            const data = await requestInbox(nextFilters, signal)
            applyInboxData(data)
        } catch (err) {
            if (err.name === 'AbortError') return
            setError(err.message || 'โหลด Form Inbox ไม่สำเร็จ')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => {
        const controller = new AbortController()
        let ignore = false

        requestInbox(filters, controller.signal)
            .then((data) => {
                if (ignore) return
                applyInboxData(data)
            })
            .catch((err) => {
                if (ignore || err.name === 'AbortError') return
                setError(err.message || 'โหลด Form Inbox ไม่สำเร็จ')
            })
            .finally(() => {
                if (ignore) return
                setLoading(false)
            })

        return () => {
            ignore = true
            controller.abort()
        }
    }, [filters])

    const setScope = (scope) => {
        const nextFilters = {
            ...filters,
            scope,
            page: 1,
        }
        setFilters(nextFilters)
    }

    const applySearch = (event) => {
        event.preventDefault()
        setFilters((prev) => ({
            ...prev,
            search: draftSearch.trim(),
            page: 1,
        }))
    }

    const resetSearch = () => {
        setDraftSearch('')
        setFilters((prev) => ({
            ...prev,
            search: '',
            page: 1,
        }))
    }

    const goToPage = (page) => {
        const nextPage = Math.max(
            1,
            Math.min(page, pagination.total_pages || 1)
        )

        setFilters((prev) => ({
            ...prev,
            page: nextPage,
        }))
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 md:px-8">
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300">
                            <FiInbox className="text-xl" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            Form Inbox
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            ติดตามเอกสารที่ต้องอนุมัติและเอกสารที่ส่งแล้ว
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => loadInbox({ refresh: true })}
                        disabled={loading || refreshing}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                        <FiRefreshCw className={refreshing ? 'animate-spin' : ''} />
                        รีเฟรช
                    </button>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="grid gap-2 md:grid-cols-3">
                        {scopeOptions.map(({ value, label, icon: Icon }) => {
                            const active = filters.scope === value
                            const disabled =
                                value === 'pending_approval' && !canApprove

                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setScope(value)}
                                    disabled={disabled}
                                    className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition disabled:opacity-50 ${
                                        active
                                            ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                                            : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {label}
                                </button>
                            )
                        })}
                    </div>

                    <form
                        onSubmit={applySearch}
                        className="mt-4 flex flex-col gap-2 sm:flex-row"
                    >
                        <div className="flex min-w-0 flex-1 items-center rounded-2xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950">
                            <FiSearch className="h-4 w-4 text-slate-400" />
                            <input
                                value={draftSearch}
                                onChange={(event) =>
                                    setDraftSearch(event.target.value)
                                }
                                placeholder="เลขเอกสาร, ชื่อฟอร์ม, ผู้ส่ง"
                                className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex">
                            <button
                                type="submit"
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 text-sm font-medium text-white hover:bg-sky-600"
                            >
                                <FiSearch className="h-4 w-4" />
                                ค้นหา
                            </button>
                            <button
                                type="button"
                                onClick={resetSearch}
                                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                                aria-label="Reset search"
                            >
                                <FiX className="h-4 w-4" />
                            </button>
                        </div>
                    </form>
                </section>

                {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        {error}
                    </div>
                )}

                <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    {loading ? (
                        <div className="p-6 text-sm text-slate-500">
                            กำลังโหลด...
                        </div>
                    ) : submissions.length === 0 ? (
                        <div className="p-8 text-center text-sm text-slate-500">
                            ไม่มีเอกสารในกล่องนี้
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {submissions.map((item) => (
                                <div
                                    key={item.form_submission_id}
                                    className="grid gap-4 p-4 md:grid-cols-[1.3fr_1fr_auto] md:items-center"
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                                                {item.submission_no}
                                            </p>
                                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusTone(item.status)}`}>
                                                {item.status}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                            {item.form_name}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            {item.form_code} · v{item.template_version || 1}
                                        </p>
                                    </div>

                                    <div className="grid gap-2 text-sm text-slate-500 sm:grid-cols-2 md:grid-cols-1">
                                        <div>
                                            <span className="text-xs text-slate-400">ผู้ส่ง</span>
                                            <p className="font-medium text-slate-700 dark:text-slate-200">
                                                {item.submitted_by_name || item.submitted_by}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {formatDateTime(item.submitted_at)}
                                            </p>
                                        </div>

                                        {item.decided_by && (
                                            <div>
                                                <span className="text-xs text-slate-400">ผู้ตัดสิน</span>
                                                <p className="font-medium text-slate-700 dark:text-slate-200">
                                                    {item.decided_by_name || item.decided_by}
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    {formatDateTime(item.decided_at)}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <Link
                                        href={`/dashboard/form/submission/${item.form_submission_id}`}
                                        className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
                                    >
                                        เปิดเอกสาร
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-slate-500 dark:text-slate-400">
                            ทั้งหมด {pagination.total.toLocaleString('th-TH')} รายการ · หน้า {pagination.page.toLocaleString('th-TH')} จาก {(pagination.total_pages || 1).toLocaleString('th-TH')}
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:flex">
                            <button
                                type="button"
                                onClick={() => goToPage(pagination.page - 1)}
                                disabled={loading || pagination.page <= 1}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                                <FiChevronLeft className="h-4 w-4" />
                                ก่อนหน้า
                            </button>
                            <button
                                type="button"
                                onClick={() => goToPage(pagination.page + 1)}
                                disabled={
                                    loading ||
                                    pagination.page >= (pagination.total_pages || 1)
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                                ถัดไป
                                <FiChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    )
}
