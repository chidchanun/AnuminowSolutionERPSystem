'use client'

import { useEffect, useMemo, useState } from 'react'
import {
    FiChevronDown,
    FiChevronLeft,
    FiChevronRight,
    FiClock,
    FiDownload,
    FiInfo,
    FiRefreshCw,
    FiSearch,
    FiShield,
    FiTrendingUp,
    FiUser,
    FiX,
} from 'react-icons/fi'

const initialFilters = {
    search: '',
    action: '',
    entity_type: '',
    actor_id: '',
    from: '',
    to: '',
    page: 1,
    limit: 20,
}

const entityOptions = [
    { value: '', label: 'ทุกประเภทข้อมูล' },
    { value: 'auth', label: 'Auth' },
    { value: 'department', label: 'Department' },
    { value: 'project', label: 'Project' },
    { value: 'role', label: 'Role' },
    { value: 'employee', label: 'Employee' },
    { value: 'attendance', label: 'Attendance' },
    { value: 'leave_request', label: 'Leave Request' },
    { value: 'permission_role', label: 'Permission Role' },
    { value: 'task', label: 'Task' },
    { value: 'task_comment', label: 'Task Comment' },
    { value: 'task_attachment', label: 'Task Attachment' },
]

const actionOptions = [
    { value: '', label: 'ทุก Action' },
    { value: 'auth.login_success', label: 'Auth Login Success' },
    { value: 'auth.login_failed', label: 'Auth Login Failed' },
    { value: 'auth.logout', label: 'Auth Logout' },
    { value: 'auth.refresh_success', label: 'Auth Refresh Success' },
    { value: 'auth.refresh_failed', label: 'Auth Refresh Failed' },
    { value: 'master.department.create', label: 'Department Create' },
    { value: 'master.department.update', label: 'Department Update' },
    { value: 'master.department.delete', label: 'Department Delete' },
    { value: 'master.role.create', label: 'Role Create' },
    { value: 'master.role.update', label: 'Role Update' },
    { value: 'master.role.delete', label: 'Role Delete' },
    { value: 'permission_role.create', label: 'Permission Role Create' },
    { value: 'permission_role.update', label: 'Permission Role Update' },
    { value: 'permission_role.delete', label: 'Permission Role Delete' },
    { value: 'project.create', label: 'Project Create' },
    { value: 'project.update', label: 'Project Update' },
    { value: 'project.delete', label: 'Project Delete' },
    { value: 'employee.create', label: 'Employee Create' },
    { value: 'employee.update', label: 'Employee Update' },
    { value: 'employee.delete', label: 'Employee Delete' },
    { value: 'attendance.upsert', label: 'Attendance Upsert' },
    { value: 'leave.create', label: 'Leave Create' },
    { value: 'leave.approve', label: 'Leave Approve' },
    { value: 'leave.reject', label: 'Leave Reject' },
    { value: 'leave.delete', label: 'Leave Delete' },
    {
        value: 'permission_matrix.update',
        label: 'Permission Matrix Update',
    },
    { value: 'task.create', label: 'Task Create' },
    { value: 'task.update', label: 'Task Update' },
    { value: 'task.delete', label: 'Task Delete' },
    { value: 'task.status_change', label: 'Task Status Change' },
    { value: 'task.comment.create', label: 'Task Comment Create' },
    { value: 'task.reply.create', label: 'Task Reply Create' },
    { value: 'task.comment.update', label: 'Task Comment Update' },
    { value: 'task.comment.delete', label: 'Task Comment Delete' },
    { value: 'task.attachment.create', label: 'Task Attachment Create' },
    { value: 'task.attachment.delete', label: 'Task Attachment Delete' },
]

function formatDateTime(value) {
    if (!value) return '-'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return String(value)
    }

    return new Intl.DateTimeFormat('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date)
}

function getActionTone(action = '') {
    if (action.includes('delete') || action.includes('reject')) {
        return 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
    }

    if (action.includes('create') || action.includes('approve')) {
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
    }

    if (action.includes('permission')) {
        return 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
    }

    return 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
}

function compactMetadata(metadata) {
    if (!metadata) return '-'

    const entries = Object.entries(metadata)
        .filter(([, value]) => value !== null && value !== undefined)
        .slice(0, 4)

    if (entries.length === 0) return '-'

    return entries
        .map(([key, value]) => {
            const text = Array.isArray(value)
                ? value.join(', ')
                : String(value)

            return `${key}: ${text}`
        })
        .join(' · ')
}

function formatMetadata(metadata) {
    if (!metadata) return '-'

    return JSON.stringify(metadata, null, 2)
}

function DetailItem({ label, value, children }) {
    return (
        <div>
            <p className="text-xs font-medium uppercase text-slate-400">
                {label}
            </p>
            <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                {children || value || '-'}
            </div>
        </div>
    )
}

async function requestAuditLogs(filters, signal) {
    const params = new URLSearchParams()

    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            params.set(key, value)
        }
    })

    const res = await fetch(`/api/v1/audit-log?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
        signal,
    })

    const data = await res.json()

    if (!res.ok) {
        throw new Error(
            data.error_detail ||
            data.message ||
            'โหลด Audit Log ไม่สำเร็จ'
        )
    }

    return data
}

async function requestAuditSummary(signal) {
    const res = await fetch('/api/v1/audit-log/summary', {
        cache: 'no-store',
        credentials: 'include',
        signal,
    })

    const data = await res.json()

    if (!res.ok) {
        throw new Error(
            data.error_detail ||
            data.message ||
            'โหลดสรุป Audit Log ไม่สำเร็จ'
        )
    }

    return data
}

function SummaryCard({ label, value, helper, icon: Icon }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {label}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {Number(value || 0).toLocaleString('th-TH')}
                    </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <Icon className="h-5 w-5" />
                </div>
            </div>
            {helper && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    {helper}
                </p>
            )}
        </div>
    )
}

export default function AuditLogPage() {
    const [filters, setFilters] = useState(initialFilters)
    const [draftFilters, setDraftFilters] = useState(initialFilters)
    const [logs, setLogs] = useState([])
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        total_pages: 0,
    })
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [selectedLog, setSelectedLog] = useState(null)
    const [summaryLoading, setSummaryLoading] = useState(true)
    const [summaryData, setSummaryData] = useState({
        summary: {
            total_logs: 0,
            today_logs: 0,
            permission_logs: 0,
            task_logs: 0,
        },
        top_actors: [],
        top_actions: [],
        latest_logs: [],
    })
    const [permission, setPermission] = useState({
        can_export: false,
    })
    const [error, setError] = useState('')

    const hasFilters = useMemo(
        () => Object.entries(draftFilters).some(([key, value]) =>
            !['page', 'limit'].includes(key) && value
        ),
        [draftFilters]
    )

    const getExportUrl = (type) => {
        const params = new URLSearchParams()

        Object.entries(filters).forEach(([key, value]) => {
            if (
                !['page', 'limit'].includes(key) &&
                value !== undefined &&
                value !== null &&
                value !== ''
            ) {
                params.set(key, value)
            }
        })

        return `/api/v1/audit-log/export/${type}?${params.toString()}`
    }

    const loadLogs = async ({
        nextFilters = filters,
        signal,
        refresh = false,
    } = {}) => {
        try {
            if (refresh) {
                setRefreshing(true)
            } else {
                setLoading(true)
            }

            const data = await requestAuditLogs(nextFilters, signal)

            setLogs(data.data || [])
            setPermission(data.permission || {
                can_export: false,
            })
            setPagination(
                data.pagination || {
                    page: 1,
                    limit: 20,
                    total: 0,
                    total_pages: 0,
                }
            )
            setError('')
        } catch (err) {
            if (err.name === 'AbortError') return

            console.error('Load audit log error:', err)
            setError(err.message)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    const loadSummary = async (signal) => {
        try {
            setSummaryLoading(true)
            const data = await requestAuditSummary(signal)

            setSummaryData({
                summary: data.summary || {
                    total_logs: 0,
                    today_logs: 0,
                    permission_logs: 0,
                    task_logs: 0,
                },
                top_actors: data.top_actors || [],
                top_actions: data.top_actions || [],
                latest_logs: data.latest_logs || [],
            })
        } catch (err) {
            if (err.name === 'AbortError') return

            console.error('Load audit summary error:', err)
        } finally {
            setSummaryLoading(false)
        }
    }

    useEffect(() => {
        let ignore = false
        const controller = new AbortController()

        requestAuditLogs(filters, controller.signal)
            .then((data) => {
                if (ignore) return

                setLogs(data.data || [])
                setPermission(data.permission || {
                    can_export: false,
                })
                setPagination(
                    data.pagination || {
                        page: 1,
                        limit: 20,
                        total: 0,
                        total_pages: 0,
                    }
                )
                setError('')
            })
            .catch((err) => {
                if (ignore || err.name === 'AbortError') return

                console.error('Load audit log error:', err)
                setError(err.message)
            })
            .finally(() => {
                if (!ignore) {
                    setLoading(false)
                }
            })

        requestAuditSummary(controller.signal)
            .then((data) => {
                if (ignore) return

                setSummaryData({
                    summary: data.summary || {
                        total_logs: 0,
                        today_logs: 0,
                        permission_logs: 0,
                        task_logs: 0,
                    },
                    top_actors: data.top_actors || [],
                    top_actions: data.top_actions || [],
                    latest_logs: data.latest_logs || [],
                })
            })
            .catch((err) => {
                if (ignore || err.name === 'AbortError') return

                console.error('Load audit summary error:', err)
            })
            .finally(() => {
                if (!ignore) {
                    setSummaryLoading(false)
                }
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
        <main className="min-h-screen bg-slate-50 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>

                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            Audit Log
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            ตรวจสอบการเปลี่ยนแปลงข้อมูลและสิทธิ์ในระบบ
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {permission.can_export && (
                            <>
                                <a
                                    href={getExportUrl('excel')}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600"
                                >
                                    <FiDownload className="h-4 w-4" />
                                    Export Excel
                                </a>
                                <a
                                    href={getExportUrl('pdf')}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
                                >
                                    <FiDownload className="h-4 w-4" />
                                    Export PDF
                                </a>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                loadLogs({ refresh: true })
                                loadSummary()
                            }}
                            disabled={refreshing}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            <FiRefreshCw
                                className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                            />
                            Refresh
                        </button>
                    </div>
                </div>

                <section className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <SummaryCard
                            label="Audit วันนี้"
                            value={summaryData.summary.today_logs}
                            helper="รายการที่เกิดขึ้นในวันนี้"
                            icon={FiClock}
                        />
                        <SummaryCard
                            label="Audit ทั้งหมด"
                            value={summaryData.summary.total_logs}
                            helper="จำนวน log ที่บันทึกในระบบ"
                            icon={FiShield}
                        />
                        <SummaryCard
                            label="Task Audit"
                            value={summaryData.summary.task_logs}
                            helper="กิจกรรมจาก task/comment/attachment"
                            icon={FiTrendingUp}
                        />
                        <SummaryCard
                            label="Permission Changes"
                            value={summaryData.summary.permission_logs}
                            helper="การเปลี่ยนแปลงสิทธิ์ทั้งหมด"
                            icon={FiUser}
                        />
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    Top Actors 7 วันล่าสุด
                                </h2>
                                {summaryLoading && (
                                    <FiRefreshCw className="h-4 w-4 animate-spin text-slate-400" />
                                )}
                            </div>
                            <div className="space-y-2">
                                {summaryData.top_actors.length === 0 ? (
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        ยังไม่มีข้อมูล
                                    </p>
                                ) : (
                                    summaryData.top_actors.map((actor) => (
                                        <div
                                            key={actor.actor_id || 'unknown'}
                                            className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                                                    {actor.actor_name?.trim() || actor.actor_id || '-'}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {actor.actor_id || '-'}
                                                </p>
                                            </div>
                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                {Number(actor.total || 0).toLocaleString('th-TH')}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    Top Actions 7 วันล่าสุด
                                </h2>
                                {summaryLoading && (
                                    <FiRefreshCw className="h-4 w-4 animate-spin text-slate-400" />
                                )}
                            </div>
                            <div className="space-y-2">
                                {summaryData.top_actions.length === 0 ? (
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        ยังไม่มีข้อมูล
                                    </p>
                                ) : (
                                    summaryData.top_actions.map((action) => (
                                        <div
                                            key={action.action}
                                            className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950"
                                        >
                                            <span className={`truncate rounded-full px-3 py-1 text-xs font-medium ${getActionTone(action.action)}`}>
                                                {action.action}
                                            </span>
                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                {Number(action.total || 0).toLocaleString('th-TH')}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                <form
                    onSubmit={applyFilters}
                    className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                        <label>
                            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                                ค้นหา
                            </span>
                            <div className="relative">
                                <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={draftFilters.search}
                                    onChange={(event) =>
                                        setDraftFilters((prev) => ({
                                            ...prev,
                                            search: event.target.value,
                                        }))
                                    }
                                    placeholder="summary, action, entity"
                                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition-colors focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                />
                            </div>
                        </label>

                        <label>
                            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                                ผู้ทำรายการ
                            </span>
                            <input
                                type="text"
                                value={draftFilters.actor_id}
                                onChange={(event) =>
                                    setDraftFilters((prev) => ({
                                        ...prev,
                                        actor_id: event.target.value,
                                    }))
                                }
                                placeholder="User ID"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            />
                        </label>

                        <label>
                            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                                Action
                            </span>
                            <div className="relative">
                                <select
                                    value={draftFilters.action}
                                    onChange={(event) =>
                                        setDraftFilters((prev) => ({
                                            ...prev,
                                            action: event.target.value,
                                        }))
                                    }
                                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none transition-colors focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                >
                                    {actionOptions.map((item) => (
                                        <option key={item.value} value={item.value}>
                                            {item.label}
                                        </option>
                                    ))}
                                </select>
                                <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            </div>
                        </label>

                        <label>
                            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                                Entity
                            </span>
                            <div className="relative">
                                <select
                                    value={draftFilters.entity_type}
                                    onChange={(event) =>
                                        setDraftFilters((prev) => ({
                                            ...prev,
                                            entity_type: event.target.value,
                                        }))
                                    }
                                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none transition-colors focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                >
                                    {entityOptions.map((item) => (
                                        <option key={item.value} value={item.value}>
                                            {item.label}
                                        </option>
                                    ))}
                                </select>
                                <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            </div>
                        </label>

                        <label>
                            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
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
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            />
                        </label>

                        <label>
                            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
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
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            />
                        </label>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            พบ {pagination.total.toLocaleString('th-TH')} รายการ
                        </p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={resetFilters}
                                disabled={!hasFilters}
                                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                ล้างตัวกรอง
                            </button>
                            <button
                                type="submit"
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                            >
                                <FiSearch className="h-4 w-4" />
                                ค้นหา
                            </button>
                        </div>
                    </div>
                </form>

                {error && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
                        {error}
                    </div>
                )}

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, index) => (
                                <div key={index} className="space-y-3 p-4">
                                    <div className="h-4 w-32 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                                    <div className="h-5 w-48 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                                    <div className="h-4 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                                    <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                                </div>
                            ))
                        ) : logs.length === 0 ? (
                            <div className="px-4 py-14 text-center">
                                <FiClock className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                                <p className="font-medium text-slate-700 dark:text-slate-200">
                                    ไม่พบ Audit Log
                                </p>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    ลองปรับตัวกรองหรือรีเฟรชอีกครั้ง
                                </p>
                            </div>
                        ) : (
                            logs.map((item) => (
                                <article
                                    key={item.audit_id}
                                    className="p-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getActionTone(item.action)}`}>
                                                {item.action}
                                            </span>
                                            <p className="mt-3 font-medium text-slate-900 dark:text-slate-100">
                                                {item.summary || '-'}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setSelectedLog(item)}
                                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                            aria-label="View audit log detail"
                                        >
                                            <FiInfo className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <p className="text-slate-400">เวลา</p>
                                            <p className="mt-1 text-slate-600 dark:text-slate-300">
                                                {formatDateTime(item.created_at)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400">Entity</p>
                                            <p className="mt-1 break-all text-slate-600 dark:text-slate-300">
                                                {item.entity_type} #{item.entity_id || '-'}
                                            </p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-slate-400">ผู้ทำรายการ</p>
                                            <p className="mt-1 break-all text-slate-600 dark:text-slate-300">
                                                {item.actor_name?.trim() || item.actor_id || '-'}
                                            </p>
                                        </div>
                                    </div>

                                    <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                        {compactMetadata(item.metadata)}
                                    </p>
                                </article>
                            ))
                        )}
                    </div>

                    <div className="hidden overflow-x-auto md:block">
                        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                            <thead className="bg-slate-50 dark:bg-slate-950">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">
                                        เวลา
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">
                                        Action
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">
                                        Entity
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">
                                        รายละเอียด
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">
                                        ผู้ทำรายการ
                                    </th>
                                    <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">
                                        รายละเอียด
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loading ? (
                                    Array.from({ length: 6 }).map((_, index) => (
                                        <tr key={index}>
                                            {Array.from({ length: 6 }).map((__, cellIndex) => (
                                                <td key={cellIndex} className="px-4 py-4">
                                                    <div className="h-4 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-4 py-14 text-center"
                                        >
                                            <FiClock className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                                            <p className="font-medium text-slate-700 dark:text-slate-200">
                                                ไม่พบ Audit Log
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                ลองปรับตัวกรองหรือรีเฟรชอีกครั้ง
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((item) => (
                                        <tr
                                            key={item.audit_id}
                                            className="align-top transition-colors hover:bg-slate-50 dark:hover:bg-slate-950"
                                        >
                                            <td className="whitespace-nowrap px-4 py-4 text-slate-600 dark:text-slate-300">
                                                {formatDateTime(item.created_at)}
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getActionTone(item.action)}`}>
                                                    {item.action}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                                    {item.entity_type}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    ID: {item.entity_id || '-'}
                                                </p>
                                            </td>
                                            <td className="min-w-80 px-4 py-4">
                                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                                    {item.summary || '-'}
                                                </p>
                                                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">
                                                    {compactMetadata(item.metadata)}
                                                </p>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4">
                                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                                    {item.actor_name?.trim() || item.actor_id || '-'}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    {item.actor_email || item.actor_id || '-'}
                                                </p>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedLog(item)}
                                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                                >
                                                    <FiInfo className="h-4 w-4" />
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-slate-500 dark:text-slate-400">
                            หน้า {pagination.page.toLocaleString('th-TH')} จาก {(pagination.total_pages || 1).toLocaleString('th-TH')}
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                            <button
                                type="button"
                                onClick={() => goToPage(pagination.page - 1)}
                                disabled={loading || pagination.page <= 1}
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                ถัดไป
                                <FiChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {selectedLog && (
                <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-950/50 sm:items-stretch">
                    <button
                        type="button"
                        aria-label="Close audit log detail"
                        className="hidden flex-1 cursor-default sm:block"
                        onClick={() => setSelectedLog(null)}
                    />

                    <aside className="flex max-h-[92vh] w-full flex-col rounded-t-lg border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:h-full sm:max-h-none sm:max-w-xl sm:rounded-none">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                            <div className="min-w-0">
                                <div className="mb-2 flex items-center gap-2">
                                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getActionTone(selectedLog.action)}`}>
                                        {selectedLog.action}
                                    </span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        #{selectedLog.audit_id}
                                    </span>
                                </div>
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                    Audit Detail
                                </h2>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    {selectedLog.summary || '-'}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSelectedLog(null)}
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                aria-label="Close"
                            >
                                <FiX className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <DetailItem
                                    label="เวลา"
                                    value={formatDateTime(selectedLog.created_at)}
                                />
                                <DetailItem
                                    label="ผู้ทำรายการ"
                                    value={
                                        selectedLog.actor_name?.trim() ||
                                        selectedLog.actor_id ||
                                        '-'
                                    }
                                />
                                <DetailItem
                                    label="Actor ID"
                                    value={selectedLog.actor_id}
                                />
                                <DetailItem
                                    label="Actor Email"
                                    value={selectedLog.actor_email}
                                />
                                <DetailItem
                                    label="Entity Type"
                                    value={selectedLog.entity_type}
                                />
                                <DetailItem
                                    label="Entity ID"
                                    value={selectedLog.entity_id}
                                />
                            </div>

                            <div className="mt-6 space-y-3">
                                <DetailItem label="Summary" value={selectedLog.summary} />

                                <div>
                                    <p className="text-xs font-medium uppercase text-slate-400">
                                        Metadata
                                    </p>
                                    <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs leading-5 text-slate-100 dark:border-slate-800">
                                        {formatMetadata(selectedLog.metadata)}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            )}
        </main>

    )
}
