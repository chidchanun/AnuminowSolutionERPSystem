'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
    FiActivity,
    FiAlertTriangle,
    FiBell,
    FiBriefcase,
    FiCheckCircle,
    FiClock,
    FiRefreshCw,
    FiUsers,
} from 'react-icons/fi'

function StatCard({
    title,
    value,
    icon: Icon,
    href,
    loading,
}) {
    const content = (
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {title}
                    </p>

                    <p className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">
                        {loading ? '...' : value}
                    </p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <Icon className="h-6 w-6" />
                </div>
            </div>
        </article>
    )

    if (!href) return content

    return (
        <Link href={href}>
            {content}
        </Link>
    )
}

function ErrorPanel({ message, loading, onRetry }) {
    return (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800 shadow-sm dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200">
                        <FiAlertTriangle className="h-5 w-5" />
                    </div>

                    <div>
                        <h2 className="text-sm font-semibold">
                            โหลดข้อมูล Dashboard ไม่สำเร็จ
                        </h2>

                        <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                            {message || 'เกิดข้อผิดพลาดระหว่างโหลดข้อมูล'}
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onRetry}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200 dark:hover:bg-rose-900"
                >
                    <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    ลองใหม่
                </button>
            </div>
        </section>
    )
}

function EmptyState({ children }) {
    return (
        <div className="flex min-h-28 items-center justify-center rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            {children}
        </div>
    )
}

function getStatusLabel(status) {
    switch (status) {
        case 'todo':
            return 'Todo'
        case 'in_progress':
            return 'In Progress'
        case 'review':
            return 'Review'
        case 'done':
            return 'Done'
        default:
            return status || '-'
    }
}

function getPriorityLabel(priority) {
    switch (priority) {
        case 'low':
            return 'Low'
        case 'medium':
            return 'Medium'
        case 'high':
            return 'High'
        case 'critical':
            return 'Critical'
        default:
            return priority || '-'
    }
}

function formatDate(date) {
    if (!date) return '-'

    return new Date(date).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })
}

function formatDateTime(date) {
    if (!date) return '-'

    return new Date(date).toLocaleString('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
    })
}

async function requestDashboard(signal) {
    const res = await fetch('/api/v1/dashboard', {
        cache: 'no-store',
        signal,
    })
    const data = await res.json()

    if (!res.ok) {
        throw new Error(
            data.message ||
                'โหลดข้อมูล Dashboard ไม่สำเร็จ'
        )
    }

    return data
}

function normalizeDashboard(data) {
    return {
        stats: data.stats || {},
        task_status: data.task_status || [],
        weekly_activity: data.weekly_activity || [],
        due_soon_tasks: data.due_soon_tasks || [],
        latest_activities: data.latest_activities || [],
    }
}

export default function DashboardPage() {
    const [dashboard, setDashboard] = useState({
        stats: {},
        task_status: [],
        weekly_activity: [],
        due_soon_tasks: [],
        latest_activities: [],
    })

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const loadDashboard = useCallback(async (signal) => {
        try {
            const data = await requestDashboard(signal)

            setDashboard(normalizeDashboard(data))
            setError('')
        } catch (error) {
            if (error.name === 'AbortError') {
                return
            }

            console.error(error)
            setError(error.message)
        } finally {
            if (!signal?.aborted) {
                setLoading(false)
            }
        }
    }, [])

    const retryDashboard = useCallback(() => {
        setLoading(true)
        loadDashboard()
    }, [loadDashboard])

    useEffect(() => {
        const controller = new AbortController()

        requestDashboard(controller.signal)
            .then((data) => {
                setDashboard(normalizeDashboard(data))
                setError('')
            })
            .catch((error) => {
                if (error.name === 'AbortError') {
                    return
                }

                console.error(error)
                setError(error.message)
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false)
                }
            })

        return () => {
            controller.abort()
        }
    }, [])

    const maxWeeklyActivity = useMemo(() => {
        const values =
            dashboard.weekly_activity.map((item) =>
                Number(item.count || 0)
            )

        return Math.max(...values, 1)
    }, [dashboard.weekly_activity])

    const totalTaskStatus = useMemo(() => {
        return dashboard.task_status.reduce(
            (sum, item) => sum + Number(item.count || 0),
            0
        )
    }, [dashboard.task_status])

    const stats = dashboard.stats

    return (
        <main className="min-h-screen bg-slate-50 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">
                            Dashboard
                        </h1>

                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            ภาพรวมระบบ ERP และสถานะงานล่าสุด
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Link
                            href="/dashboard/task/new"
                            className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
                        >
                            เพิ่มงาน
                        </Link>

                        <Link
                            href="/dashboard/report"
                            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                            ดูรายงาน
                        </Link>
                    </div>
                </div>

                {error && (
                    <ErrorPanel
                        message={error}
                        loading={loading}
                        onRetry={retryDashboard}
                    />
                )}

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        title="พนักงานทั้งหมด"
                        value={stats.employees || 0}
                        icon={FiUsers}
                        href="/dashboard/employee"
                        loading={loading}
                    />

                    <StatCard
                        title="โปรเจกต์ทั้งหมด"
                        value={stats.total_projects || 0}
                        icon={FiBriefcase}
                        href="/dashboard/project"
                        loading={loading}
                    />

                    <StatCard
                        title="งานวันนี้"
                        value={stats.today_tasks || 0}
                        icon={FiClock}
                        href="/dashboard/task"
                        loading={loading}
                    />

                    <StatCard
                        title="แจ้งเตือนยังไม่อ่าน"
                        value={stats.unread_notifications || 0}
                        icon={FiBell}
                        href="/dashboard/notification"
                        loading={loading}
                    />
                </div>

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        title="งานทั้งหมด"
                        value={stats.total_tasks || 0}
                        icon={FiActivity}
                        href="/dashboard/task"
                        loading={loading}
                    />

                    <StatCard
                        title="โปรเจกต์กำลังดำเนินการ"
                        value={stats.active_projects || 0}
                        icon={FiBriefcase}
                        href="/dashboard/project"
                        loading={loading}
                    />

                    <StatCard
                        title="โปรเจกต์เสร็จสิ้น"
                        value={stats.completed_projects || 0}
                        icon={FiCheckCircle}
                        href="/dashboard/project"
                        loading={loading}
                    />

                    <StatCard
                        title="งานเกินกำหนด"
                        value={stats.overdue_tasks || 0}
                        icon={FiAlertTriangle}
                        href="/dashboard/report"
                        loading={loading}
                    />
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    กิจกรรมในระบบ
                                </p>

                                <h2 className="mt-1 text-xl font-semibold">
                                    สรุป 7 วันล่าสุด
                                </h2>
                            </div>
                        </div>

                        <div className="mt-6 flex h-56 items-end gap-3 rounded-3xl bg-slate-50 p-5 dark:bg-slate-950">
                            {dashboard.weekly_activity.length === 0 ? (
                                <EmptyState>
                                    ยังไม่มีข้อมูลกิจกรรม
                                </EmptyState>
                            ) : (
                                dashboard.weekly_activity.map((item) => {
                                    const value =
                                        Number(item.count || 0)

                                    const height =
                                        Math.max(
                                            (value / maxWeeklyActivity) * 100,
                                            8
                                        )

                                    return (
                                        <div
                                            key={String(item.activity_date)}
                                            className="flex flex-1 flex-col items-center justify-end gap-2"
                                        >
                                            <div className="text-xs text-slate-500">
                                                {value}
                                            </div>

                                            <div
                                                className="w-full rounded-t-2xl bg-sky-500"
                                                style={{
                                                    height: `${height}%`,
                                                }}
                                            />

                                            <div className="text-xs text-slate-500">
                                                {new Date(item.activity_date).toLocaleDateString('th-TH', {
                                                    weekday: 'short',
                                                })}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                สถานะงาน
                            </p>

                            <h2 className="mt-1 text-xl font-semibold">
                                Task Status
                            </h2>
                        </div>

                        <div className="mt-5 space-y-4">
                            {dashboard.task_status.length === 0 ? (
                                <EmptyState>
                                    ยังไม่มีข้อมูลงาน
                                </EmptyState>
                            ) : (
                                dashboard.task_status.map((item) => {
                                    const count =
                                        Number(item.count || 0)

                                    const percent =
                                        totalTaskStatus > 0
                                            ? Math.round(
                                                (count * 100) / totalTaskStatus
                                            )
                                            : 0

                                    return (
                                        <div key={item.status}>
                                            <div className="mb-2 flex items-center justify-between text-sm">
                                                <span>
                                                    {getStatusLabel(item.status)}
                                                </span>

                                                <span className="text-slate-500">
                                                    {count} งาน
                                                </span>
                                            </div>

                                            <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                                <div
                                                    className="h-full rounded-full bg-sky-500"
                                                    style={{
                                                        width: `${percent}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </section>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    งานที่ต้องติดตาม
                                </p>

                                <h2 className="mt-1 text-xl font-semibold">
                                    งานใกล้ครบกำหนด
                                </h2>
                            </div>

                            <Link
                                href="/dashboard/task"
                                className="text-sm text-sky-500 hover:text-sky-600"
                            >
                                ดูทั้งหมด
                            </Link>
                        </div>

                        <div className="mt-5 space-y-3">
                            {dashboard.due_soon_tasks.length === 0 ? (
                                <EmptyState>
                                    ไม่มีงานใกล้ครบกำหนด
                                </EmptyState>
                            ) : (
                                dashboard.due_soon_tasks.map((task) => (
                                    <Link
                                        key={task.task_id}
                                        href={`/dashboard/task/${task.task_id}`}
                                        className="block rounded-2xl bg-slate-50 p-4 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate font-medium">
                                                    {task.task_name}
                                                </p>

                                                <p className="mt-1 truncate text-xs text-slate-500">
                                                    {task.project_name}
                                                </p>
                                            </div>

                                            <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                                                {formatDate(task.due_date)}
                                            </span>
                                        </div>

                                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                            <span className="rounded-full bg-slate-200 px-2 py-1 dark:bg-slate-800">
                                                {getPriorityLabel(task.priority)}
                                            </span>

                                            <span className="rounded-full bg-slate-200 px-2 py-1 dark:bg-slate-800">
                                                {getStatusLabel(task.status)}
                                            </span>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Activity Log
                                </p>

                                <h2 className="mt-1 text-xl font-semibold">
                                    กิจกรรมล่าสุด
                                </h2>
                            </div>
                        </div>

                        <div className="mt-5 space-y-3">
                            {dashboard.latest_activities.length === 0 ? (
                                <EmptyState>
                                    ยังไม่มีกิจกรรมล่าสุด
                                </EmptyState>
                            ) : (
                                dashboard.latest_activities.map((item) => (
                                    <Link
                                        key={item.history_id}
                                        href={`/dashboard/task/${item.task_id}`}
                                        className="block rounded-2xl bg-slate-50 p-4 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800"
                                    >
                                        <p className="text-sm font-medium">
                                            {item.description || item.action_type}
                                        </p>

                                        <p className="mt-1 text-xs text-slate-500">
                                            {item.task_name} · {item.project_name}
                                        </p>

                                        <p className="mt-2 text-xs text-slate-400">
                                            โดย {item.action_by_name || '-'} · {formatDateTime(item.created_at)}
                                        </p>
                                    </Link>
                                ))
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    )
}
