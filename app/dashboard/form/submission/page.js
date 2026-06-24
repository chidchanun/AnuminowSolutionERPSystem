'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
    FiChevronLeft,
    FiChevronRight,
    FiFileText,
    FiRefreshCw,
    FiSearch,
    FiX,
} from 'react-icons/fi'

const initialFilters = {
    search: '',
    status: 'all',
    from: '',
    to: '',
    page: 1,
    limit: 20,
}

const statusOptions = [
    { value: 'all', label: 'ทุกสถานะ' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'cancelled', label: 'Cancelled' },
]

function getInitialFiltersFromLocation() {
    if (typeof window === 'undefined') {
        return initialFilters
    }

    const searchParams = new URLSearchParams(window.location.search)
    const status = searchParams.get('status') || 'all'

    return {
        ...initialFilters,
        status: statusOptions.some((item) => item.value === status)
            ? status
            : 'all',
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

async function requestSubmissions(filters, signal) {
    const params = new URLSearchParams()

    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            params.set(key, value)
        }
    })

    const res = await fetch(`/api/v1/form-submission?${params.toString()}`, {
        cache: 'no-store',
        signal,
    })

    const data = await res.json()

    if (!res.ok) {
        throw new Error(data.message || 'โหลดรายการเอกสารไม่สำเร็จ')
    }

    return data
}

function formatDateTime(value) {
    if (!value) return '-'

    return new Date(value).toLocaleString('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
    })
}

export default function FormSubmissionPage() {
    const [submissions, setSubmissions] = useState([])
    const [filters, setFilters] = useState(getInitialFiltersFromLocation)
    const [draftFilters, setDraftFilters] = useState(getInitialFiltersFromLocation)
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        total_pages: 0,
    })
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState('')

    const applySubmissionData = (data) => {
        setSubmissions(data.submissions || [])
        setPagination(data.pagination || {
            page: 1,
            limit: 20,
            total: 0,
            total_pages: 0,
        })
    }

    const loadSubmissions = async ({
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
            const data = await requestSubmissions(nextFilters, signal)
            applySubmissionData(data)
        } catch (err) {
            if (err.name === 'AbortError') return
            setError(err.message || 'โหลดรายการเอกสารไม่สำเร็จ')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => {
        const controller = new AbortController()
        let ignore = false

        requestSubmissions(filters, controller.signal)
            .then((data) => {
                if (ignore) return
                applySubmissionData(data)
            })
            .catch((err) => {
                if (ignore || err.name === 'AbortError') return
                setError(err.message || 'โหลดรายการเอกสารไม่สำเร็จ')
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

    const applyFilters = (event) => {
        event.preventDefault()

        const nextFilters = {
            ...draftFilters,
            page: 1,
        }

        setFilters(nextFilters)
    }

    const resetFilters = () => {
        setDraftFilters(initialFilters)
        setFilters(initialFilters)
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
        setDraftFilters((prev) => ({
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
                            <FiFileText className="text-xl" />
                        </div>

                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            เอกสารที่ส่งแล้ว
                        </h1>

                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            รายการข้อมูลที่ user ส่งผ่านแบบฟอร์ม
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => loadSubmissions({ refresh: true })}
                        disabled={loading || refreshing}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                        <FiRefreshCw className={refreshing ? 'animate-spin' : ''} />
                        รีเฟรช
                    </button>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <form
                        onSubmit={applyFilters}
                        className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"
                    >
                        <label className="xl:col-span-2">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                ค้นหา
                            </span>
                            <div className="mt-2 flex items-center rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950">
                                <FiSearch className="h-4 w-4 text-slate-400" />
                                <input
                                    value={draftFilters.search}
                                    onChange={(event) =>
                                        setDraftFilters((prev) => ({
                                            ...prev,
                                            search: event.target.value,
                                        }))
                                    }
                                    placeholder="เลขที่เอกสาร, ฟอร์ม, ผู้ส่ง"
                                    className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
                                />
                            </div>
                        </label>

                        <label>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                สถานะ
                            </span>
                            <select
                                value={draftFilters.status}
                                onChange={(event) =>
                                    setDraftFilters((prev) => ({
                                        ...prev,
                                        status: event.target.value,
                                    }))
                                }
                                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950"
                            >
                                {statusOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                จากวันที่
                            </span>
                            <input
                                type="date"
                                value={draftFilters.from}
                                onChange={(event) =>
                                    setDraftFilters((prev) => ({
                                        ...prev,
                                        from: event.target.value,
                                    }))
                                }
                                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </label>

                        <label>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                ถึงวันที่
                            </span>
                            <input
                                type="date"
                                value={draftFilters.to}
                                onChange={(event) =>
                                    setDraftFilters((prev) => ({
                                        ...prev,
                                        to: event.target.value,
                                    }))
                                }
                                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </label>

                        <div className="flex items-end gap-2">
                            <button
                                type="submit"
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
                            >
                                <FiSearch className="h-4 w-4" />
                                ค้นหา
                            </button>
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                                aria-label="Reset filters"
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
                            ยังไม่มีเอกสารที่ส่งแล้ว
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-[900px] w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-800 dark:bg-slate-950">
                                        <th className="px-4 py-3">เลขที่เอกสาร</th>
                                        <th className="px-4 py-3">แบบฟอร์ม</th>
                                        <th className="px-4 py-3">ผู้ส่ง</th>
                                        <th className="px-4 py-3">สถานะ</th>
                                        <th className="px-4 py-3">วันที่ส่ง</th>
                                        <th className="px-4 py-3 text-right">จัดการ</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {submissions.map((item) => (
                                        <tr
                                            key={item.form_submission_id}
                                            className="border-b border-slate-100 dark:border-slate-800"
                                        >
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                                                {item.submission_no}
                                            </td>

                                            <td className="px-4 py-3">
                                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                                    {item.form_name}
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    {item.form_code} · v{item.template_version || 1}
                                                </p>
                                            </td>

                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                {item.submitted_by_name || item.submitted_by}
                                            </td>

                                            <td className="px-4 py-3">
                                                <span className={`rounded-full px-3 py-1 text-xs font-medium ${getSubmissionStatusTone(item.status)}`}>
                                                    {item.status}
                                                </span>
                                            </td>

                                            <td className="px-4 py-3 text-slate-500">
                                                {formatDateTime(item.submitted_at)}
                                            </td>

                                            <td className="px-4 py-3 text-right">
                                                <Link
                                                    href={`/dashboard/form/submission/${item.form_submission_id}`}
                                                    className="rounded-2xl bg-sky-500 px-4 py-2 text-sm text-white hover:bg-sky-600"
                                                >
                                                    เปิดเอกสาร
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
