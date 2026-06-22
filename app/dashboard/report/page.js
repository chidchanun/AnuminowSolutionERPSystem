'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
    FiAlertTriangle,
    FiBarChart2,
    FiCheckCircle,
    FiChevronDown,
    FiClock,
    FiFlag,
    FiFolder,
    FiRefreshCw,
    FiSearch,
    FiTrendingUp,
} from 'react-icons/fi'

const projectStatusLabel = {
    planning: 'Planning',
    active: 'Active',
    completed: 'Completed',
    cancelled: 'Cancelled',
}

const taskStatusLabel = {
    todo: 'Todo',
    in_progress: 'In Progress',
    review: 'Review',
    done: 'Done',
}

const priorityLabel = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
}

function normalizeValue(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
}

function toNumber(value) {
    return Number(value || 0)
}

function formatDate(value) {
    if (!value) return '-'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return '-'
    }

    return new Intl.DateTimeFormat('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date)
}

function SelectBox({
    value,
    onChange,
    children,
}) {
    return (
        <div className="relative w-full">
            <select
                value={value}
                onChange={onChange}
                className="
                    w-full appearance-none rounded-xl
                    border border-slate-300 bg-white
                    px-3 py-2 text-sm
                    dark:border-slate-700 dark:bg-slate-950
                "
            >
                {children}
            </select>

            <FiChevronDown
                className="
                    pointer-events-none absolute right-3 top-1/2
                    -translate-y-1/2 text-slate-400 
                "
            />
        </div>
    )
}

function SummaryCard({
    title,
    value,
    icon: Icon,
    tone = 'slate',
}) {
    const toneStyle = {
        slate: {
            bg: 'rgba(100, 116, 139, 0.12)',
            border: 'rgba(100, 116, 139, 0.35)',
            color: '#64748b',
        },
        sky: {
            bg: 'rgba(14, 165, 233, 0.12)',
            border: 'rgba(14, 165, 233, 0.35)',
            color: '#0ea5e9',
        },
        green: {
            bg: 'rgba(34, 197, 94, 0.12)',
            border: 'rgba(34, 197, 94, 0.35)',
            color: '#22c55e',
        },
        red: {
            bg: 'rgba(239, 68, 68, 0.12)',
            border: 'rgba(239, 68, 68, 0.35)',
            color: '#ef4444',
        },
        amber: {
            bg: 'rgba(245, 158, 11, 0.12)',
            border: 'rgba(245, 158, 11, 0.35)',
            color: '#f59e0b',
        },
    }

    const currentTone =
        toneStyle[tone] || toneStyle.slate

    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm text-slate-500">
                        {title}
                    </p>

                    <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
                        {value}
                    </p>
                </div>

                <div
                    className="
                        flex h-12 w-12 shrink-0 items-center justify-center
                        rounded-2xl border
                    "
                    style={{
                        backgroundColor: currentTone.bg,
                        borderColor: currentTone.border,
                    }}
                >
                    <Icon
                        className="h-5 w-5"
                        style={{
                            color: currentTone.color,
                        }}
                    />
                </div>
            </div>
        </article>
    )
}

function StatusBadge({
    value,
    type = 'project',
}) {
    const normalized =
        normalizeValue(value)

    let className =
        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'

    if (type === 'project') {
        if (normalized === 'active') {
            className =
                'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
        }

        if (normalized === 'completed') {
            className =
                'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
        }

        if (
            normalized === 'cancelled' ||
            normalized === 'canceled'
        ) {
            className =
                'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
        }
    }

    if (type === 'task') {
        if (normalized === 'in_progress') {
            className =
                'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
        }

        if (normalized === 'review') {
            className =
                'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
        }

        if (normalized === 'done') {
            className =
                'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
        }
    }

    if (type === 'priority') {
        if (normalized === 'medium') {
            className =
                'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
        }

        if (normalized === 'high') {
            className =
                'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
        }

        if (normalized === 'critical') {
            className =
                'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
        }
    }

    let label = value

    if (type === 'project') {
        label =
            projectStatusLabel[normalized] ||
            value ||
            '-'
    }

    if (type === 'task') {
        label =
            taskStatusLabel[normalized] ||
            value ||
            '-'
    }

    if (type === 'priority') {
        label =
            priorityLabel[normalized] ||
            value ||
            '-'
    }

    return (
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${className}`}>
            {label}
        </span>
    )
}

function getBarColor(key) {
    const normalized =
        normalizeValue(key)

    switch (normalized) {
        case 'active':
        case 'in_progress':
            return '#0ea5e9'

        case 'completed':
        case 'done':
            return '#22c55e'

        case 'cancelled':
        case 'canceled':
        case 'critical':
            return '#ef4444'

        case 'review':
            return '#f59e0b'

        case 'high':
            return '#f97316'

        case 'medium':
            return '#3b82f6'

        case 'low':
            return '#64748b'

        case 'planning':
        case 'todo':
        default:
            return '#64748b'
    }
}

function ChartCard({
    title,
    rows,
    labelKey,
    type,
}) {
    const total =
        rows.reduce(
            (sum, row) =>
                sum + toNumber(row.count),
            0
        )

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
                <FiBarChart2 className="text-slate-400" />

                <h2 className="font-semibold text-slate-900 dark:text-white">
                    {title}
                </h2>
            </div>

            {rows.length === 0 ? (
                <p className="text-sm text-slate-500">
                    ไม่มีข้อมูล
                </p>
            ) : (
                <div className="space-y-4">
                    {rows.map((row) => {
                        const key =
                            normalizeValue(row[labelKey])

                        const value =
                            toNumber(row.count)

                        const percent =
                            total === 0
                                ? 0
                                : Math.round(
                                    value * 100 / total
                                )

                        return (
                            <div key={key || row[labelKey]}>
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <StatusBadge
                                        value={row[labelKey]}
                                        type={type}
                                    />

                                    <span className="text-sm text-slate-500">
                                        {value} รายการ
                                    </span>
                                </div>

                                <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                    <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                            width: `${percent}%`,
                                            backgroundColor: getBarColor(key),
                                        }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </section>
    )
}

function ProgressBar({
    percent,
}) {
    const safePercent =
        Math.max(
            0,
            Math.min(
                toNumber(percent),
                100
            )
        )

    return (
        <div>
            <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>Progress</span>
                <span>{safePercent}%</span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                    className="
                        h-full rounded-full bg-sky-500
                    "
                    style={{
                        width: `${safePercent}%`,
                    }}
                />
            </div>
        </div>
    )
}

export default function ReportPage() {
    const [report, setReport] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [filters, setFilters] = useState({
        project_id: 'all',
        project_status: 'all',
        task_status: 'all',
        priority: 'all',
        from: '',
        to: '',
    })

    const getExportUrl = (type, reportType = 'overview') => {
        const params = new URLSearchParams()

        Object.entries(filters).forEach(([key, value]) => {
            if (
                value !== undefined &&
                value !== null &&
                value !== ''
            ) {
                params.set(key, value)
            }
        })

        params.set('report_type', reportType)

        return `/api/v1/report/export/${type}?${params.toString()}`
    }

    const queryString = useMemo(() => {
        const params =
            new URLSearchParams()

        Object.entries(filters).forEach(([key, value]) => {
            if (value) {
                params.set(key, value)
            }
        })

        return params.toString()
    }, [filters])

    useEffect(() => {
        let ignore = false
        const controller =
            new AbortController()

        async function loadReport() {
            try {
                setLoading(true)

                const res =
                    await fetch(
                        `/api/v1/report?${queryString}`,
                        {
                            cache: 'no-store',
                            signal: controller.signal,
                        }
                    )

                const data =
                    await res.json()

                if (!res.ok) {
                    throw new Error(
                        data.error_detail ||
                        data.message ||
                        'โหลดรายงานไม่สำเร็จ'
                    )
                }

                if (ignore) return

                setReport(data)
                setError('')
            } catch (error) {
                if (
                    error.name === 'AbortError' ||
                    ignore
                ) {
                    return
                }

                console.error(error)
                setError(error.message)
            } finally {
                if (!ignore) {
                    setLoading(false)
                }
            }
        }

        loadReport()

        return () => {
            ignore = true
            controller.abort()
        }
    }, [queryString])

    const handleFilterChange = (name, value) => {
        setFilters((prev) => ({
            ...prev,
            [name]: value,
        }))
    }

    const resetFilters = () => {
        setFilters({
            project_id: 'all',
            project_status: 'all',
            task_status: 'all',
            priority: 'all',
            from: '',
            to: '',
        })
    }

    const projectSummary =
        report?.summary?.project || {}

    const taskSummary =
        report?.summary?.task || {}

    const projectRows =
        report?.charts?.project_status || []

    const taskStatusRows =
        report?.charts?.task_status || []

    const taskPriorityRows =
        report?.charts?.task_priority || []

    const overdueTasks =
        report?.overdue_tasks || []

    const performance =
        report?.performance || []

    const projectOptions =
        report?.options?.projects || []

    return (
        <div className="flex w-full max-w-full min-w-0 flex-col gap-6 overflow-x-hidden py-6">
            <div className="flex flex-wrap gap-3">
                <a
                    href={getExportUrl('excel', 'overview')}
                    className="rounded-xl bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
                >
                    Excel ภาพรวม
                </a>

                <a
                    href={getExportUrl('pdf', 'overview')}
                    className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
                >
                    PDF ภาพรวม
                </a>

                <a
                    href={getExportUrl('excel', 'project')}
                    className="rounded-xl bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
                >
                    Excel โปรเจกต์
                </a>

                <a
                    href={getExportUrl('pdf', 'project')}
                    className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
                >
                    PDF โปรเจกต์
                </a>

                <a
                    href={getExportUrl('excel', 'task')}
                    className="rounded-xl bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
                >
                    Excel งาน
                </a>

                <a
                    href={getExportUrl('pdf', 'task')}
                    className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
                >
                    PDF งาน
                </a>

                <a
                    href={getExportUrl('excel', 'overdue')}
                    className="rounded-xl bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
                >
                    Excel งานเกินกำหนด
                </a>

                <a
                    href={getExportUrl('pdf', 'overdue')}
                    className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
                >
                    PDF งานเกินกำหนด
                </a>
            </div>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Report Dashboard
                        </h1>

                        <p className="text-sm text-slate-500">
                            รายงานโปรเจกต์ งาน สถานะ Priority และ Performance ต่อโปรเจกต์
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={resetFilters}
                        className="
                            inline-flex items-center justify-center gap-2
                            rounded-xl border border-slate-300 px-4 py-2 text-sm
                            hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800
                        "
                    >
                        <FiRefreshCw />
                        Reset Filter
                    </button>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <SelectBox
                        value={filters.project_id}
                        onChange={(e) =>
                            handleFilterChange(
                                'project_id',
                                e.target.value
                            )
                        }
                    >
                        <option value="all">
                            ทุกโปรเจกต์
                        </option>

                        {projectOptions.map((project) => (
                            <option
                                key={project.project_id}
                                value={project.project_id}
                            >
                                {project.project_name}
                            </option>
                        ))}
                    </SelectBox>

                    <SelectBox
                        value={filters.project_status}
                        onChange={(e) =>
                            handleFilterChange(
                                'project_status',
                                e.target.value
                            )
                        }
                    >
                        <option value="all">
                            ทุกสถานะโปรเจกต์
                        </option>

                        <option value="planning">
                            Planning
                        </option>

                        <option value="active">
                            Active
                        </option>

                        <option value="completed">
                            Completed
                        </option>

                        <option value="cancelled">
                            Cancelled
                        </option>
                    </SelectBox>

                    <SelectBox
                        value={filters.task_status}
                        onChange={(e) =>
                            handleFilterChange(
                                'task_status',
                                e.target.value
                            )
                        }
                    >
                        <option value="all">
                            ทุกสถานะงาน
                        </option>

                        <option value="todo">
                            Todo
                        </option>

                        <option value="in_progress">
                            In Progress
                        </option>

                        <option value="review">
                            Review
                        </option>

                        <option value="done">
                            Done
                        </option>
                    </SelectBox>

                    <SelectBox
                        value={filters.priority}
                        onChange={(e) =>
                            handleFilterChange(
                                'priority',
                                e.target.value
                            )
                        }
                    >
                        <option value="all">
                            ทุก Priority
                        </option>

                        <option value="low">
                            Low
                        </option>

                        <option value="medium">
                            Medium
                        </option>

                        <option value="high">
                            High
                        </option>

                        <option value="critical">
                            Critical
                        </option>
                    </SelectBox>

                    <input
                        type="date"
                        value={filters.from}
                        onChange={(e) =>
                            handleFilterChange(
                                'from',
                                e.target.value
                            )
                        }
                        className="
                            rounded-xl border border-slate-300 bg-white
                            px-3 py-2 text-sm
                            dark:border-slate-700 dark:bg-slate-950
                        "
                    />

                    <input
                        type="date"
                        value={filters.to}
                        onChange={(e) =>
                            handleFilterChange(
                                'to',
                                e.target.value
                            )
                        }
                        className="
                            rounded-xl border border-slate-300 bg-white
                            px-3 py-2 text-sm
                            dark:border-slate-700 dark:bg-slate-950
                        "
                    />
                </div>
            </section>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-950">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    กำลังโหลดรายงาน...
                </div>
            ) : (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <SummaryCard
                            title="โปรเจกต์ทั้งหมด"
                            value={toNumber(projectSummary.total_projects)}
                            icon={FiFolder}
                            tone="sky"
                        />

                        <SummaryCard
                            title="โปรเจกต์ Active"
                            value={toNumber(projectSummary.active_projects)}
                            icon={FiTrendingUp}
                            tone="green"
                        />

                        <SummaryCard
                            title="งานทั้งหมด"
                            value={toNumber(taskSummary.total_tasks)}
                            icon={FiFlag}
                            tone="slate"
                        />

                        <SummaryCard
                            title="งานเกินกำหนด"
                            value={toNumber(taskSummary.overdue_tasks)}
                            icon={FiAlertTriangle}
                            tone="red"
                        />
                    </div>

                    <div className="grid gap-4 xl:grid-cols-3">
                        <ChartCard
                            title="รายงานโปรเจกต์ตามสถานะ"
                            rows={projectRows}
                            labelKey="status"
                            type="project"
                        />

                        <ChartCard
                            title="รายงานงานตามสถานะ"
                            rows={taskStatusRows}
                            labelKey="status"
                            type="task"
                        />

                        <ChartCard
                            title="รายงานงานตาม Priority"
                            rows={taskPriorityRows}
                            labelKey="priority"
                            type="priority"
                        />
                    </div>

                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex items-center gap-2">
                            <FiAlertTriangle className="text-red-500" />

                            <h2 className="font-semibold text-slate-900 dark:text-white">
                                งานเกินกำหนด
                            </h2>
                        </div>

                        {overdueTasks.length === 0 ? (
                            <p className="text-sm text-slate-500">
                                ไม่มีงานเกินกำหนด
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[900px] text-left text-sm">
                                    <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
                                        <tr>
                                            <th className="px-3 py-3">
                                                งาน
                                            </th>

                                            <th className="px-3 py-3">
                                                โปรเจกต์
                                            </th>

                                            <th className="px-3 py-3">
                                                Status
                                            </th>

                                            <th className="px-3 py-3">
                                                Priority
                                            </th>

                                            <th className="px-3 py-3">
                                                Due Date
                                            </th>

                                            <th className="px-3 py-3">
                                                ผู้รับผิดชอบ
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {overdueTasks.map((task) => (
                                            <tr key={task.task_id}>
                                                <td className="px-3 py-3">
                                                    <Link
                                                        href={`/dashboard/task/${task.task_id}`}
                                                        className="font-medium text-slate-900 hover:text-sky-500 dark:text-white"
                                                    >
                                                        {task.task_name}
                                                    </Link>
                                                </td>

                                                <td className="px-3 py-3 text-slate-500">
                                                    <Link
                                                        href={`/dashboard/project/${task.project_id}`}
                                                        className="hover:text-sky-500"
                                                    >
                                                        {task.project_name}
                                                    </Link>
                                                </td>

                                                <td className="px-3 py-3">
                                                    <StatusBadge
                                                        value={task.status}
                                                        type="task"
                                                    />
                                                </td>

                                                <td className="px-3 py-3">
                                                    <StatusBadge
                                                        value={task.priority}
                                                        type="priority"
                                                    />
                                                </td>

                                                <td className="px-3 py-3 text-red-500">
                                                    {formatDate(task.due_date)}
                                                </td>

                                                <td className="px-3 py-3 text-slate-500">
                                                    {task.assignee_names || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex items-center gap-2">
                            <FiCheckCircle className="text-green-500" />

                            <h2 className="font-semibold text-slate-900 dark:text-white">
                                Performance ต่อโปรเจกต์
                            </h2>
                        </div>

                        {performance.length === 0 ? (
                            <p className="text-sm text-slate-500">
                                ไม่มีข้อมูล Performance
                            </p>
                        ) : (
                            <div className="grid gap-4 xl:grid-cols-2">
                                {performance.map((project) => (
                                    <article
                                        key={project.project_id}
                                        className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                                    >
                                        <div className="mb-4 flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <Link
                                                    href={`/dashboard/project/${project.project_id}`}
                                                    className="block truncate font-semibold text-slate-900 hover:text-sky-500 dark:text-white"
                                                >
                                                    {project.project_name}
                                                </Link>

                                                <p className="text-xs text-slate-500">
                                                    {project.project_code}
                                                </p>
                                            </div>

                                            <StatusBadge
                                                value={project.status}
                                                type="project"
                                            />
                                        </div>

                                        <ProgressBar
                                            percent={
                                                project.progress_percent
                                            }
                                        />

                                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                                            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
                                                <p className="text-xs text-slate-500">
                                                    งานทั้งหมด
                                                </p>

                                                <p className="mt-1 font-semibold">
                                                    {toNumber(project.total_tasks)}
                                                </p>
                                            </div>

                                            <div className="rounded-xl bg-green-50 p-3 text-green-700 dark:bg-green-950 dark:text-green-300">
                                                <p className="text-xs">
                                                    Done
                                                </p>

                                                <p className="mt-1 font-semibold">
                                                    {toNumber(project.done_tasks)}
                                                </p>
                                            </div>

                                            <div className="rounded-xl bg-amber-50 p-3 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                                <p className="text-xs">
                                                    Review
                                                </p>

                                                <p className="mt-1 font-semibold">
                                                    {toNumber(project.review_tasks)}
                                                </p>
                                            </div>

                                            <div className="rounded-xl bg-red-50 p-3 text-red-700 dark:bg-red-700 dark:text-red-300">
                                                <p className="text-xs">
                                                    Overdue
                                                </p>

                                                <p className="mt-1 font-semibold">
                                                    {toNumber(project.overdue_tasks)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                                            <FiClock />

                                            <span>
                                                On-time rate: {toNumber(project.on_time_percent)}%
                                            </span>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                </>
            )}

        </div>
    )
}