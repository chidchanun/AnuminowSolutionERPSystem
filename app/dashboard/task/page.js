'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
    FiPlus,
    FiUser,
    FiShield,
    FiRefreshCw,
} from 'react-icons/fi'

const emptyDashboard = {
    summary: {
        total_projects: 0,
        total_tasks: 0,
        completed_tasks: 0,
        in_progress_tasks: 0,
        overdue_tasks: 0,
    },
    available_projects: [],
    upcoming_tasks: [],
    recent_activities: [],
    my_tasks: [],
    kanban: {
        todo: [],
        in_progress: [],
        review: [],
        done: [],
    },
}

const statusLabel = {
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

const kanbanColumns = [
    {
        key: 'todo',
        title: 'TODO',
    },
    {
        key: 'in_progress',
        title: 'IN PROGRESS',
    },
    {
        key: 'review',
        title: 'REVIEW',
    },
    {
        key: 'done',
        title: 'DONE',
    },
]

function getStatusClass(status) {
    switch (status) {
        case 'todo':
            return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'

        case 'in_progress':
            return 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'

        case 'review':
            return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'

        case 'done':
            return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'

        default:
            return 'bg-slate-100 text-slate-700'
    }
}

function getPriorityClass(priority) {
    switch (priority) {
        case 'low':
            return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'

        case 'medium':
            return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'

        case 'high':
            return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'

        case 'critical':
            return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'

        default:
            return 'bg-slate-100 text-slate-700'
    }
}

function formatDate(dateValue) {
    if (!dateValue) return '-'

    return new Intl.DateTimeFormat('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(dateValue))
}

function formatDueText(daysLeft) {
    if (daysLeft === null || daysLeft === undefined) {
        return '-'
    }

    if (daysLeft < 0) {
        return `เกิน ${Math.abs(daysLeft)} วัน`
    }

    if (daysLeft === 0) {
        return 'วันนี้'
    }

    return `${daysLeft} วัน`
}

function getActivityText(activity) {
    if (activity.description) {
        return activity.description
    }

    switch (activity.action_type) {
        case 'create':
            return 'สร้างงาน'

        case 'update':
            return 'แก้ไขงาน'

        case 'assign':
            return 'มอบหมายงาน'

        case 'unassign':
            return 'ยกเลิกการมอบหมายงาน'

        case 'status_change':
            return `เปลี่ยนสถานะจาก ${activity.old_value || '-'} เป็น ${activity.new_value || '-'}`

        case 'comment':
            return 'แสดงความคิดเห็น'

        case 'delete':
            return 'ลบงาน'

        default:
            return activity.action_type
    }
}

function EmptyMessage({ text }) {
    return (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-center text-sm text-slate-500">
            {text}
        </div>
    )
}

export default function TaskPage() {
    const [dashboard, setDashboard] = useState(emptyDashboard)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [viewMode, setViewMode] = useState('mine')
    const [canViewAdmin, setCanViewAdmin] = useState(false)

    const [filters, setFilters] = useState({
        project_id: 'all',
        status: 'all',
        priority: 'all',
        due: 'all',
    })

    const handleFilterChange = (name, value) => {
        setFilters((prev) => ({
            ...prev,
            [name]: value,
        }))
    }

    const resetFilters = () => {
        setFilters({
            project_id: 'all',
            status: 'all',
            priority: 'all',
            due: 'all',
        })
    }

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                setLoading(true)
                setError('')

                const query = new URLSearchParams({
                    view: viewMode,
                    project_id: filters.project_id,
                    status: filters.status,
                    priority: filters.priority,
                    due: filters.due,
                })

                const res = await fetch(
                    `/api/v1/task/dashboard?${query.toString()}`,
                    {
                        cache: 'no-store',
                    }
                )

                const data = await res.json()

                if (!res.ok) {
                    throw new Error(
                        data.message || 'โหลดข้อมูลไม่สำเร็จ'
                    )
                }

                setDashboard(data)
                setCanViewAdmin(Boolean(data.can_view_admin))

                if (
                    data.view_mode &&
                    data.view_mode !== viewMode
                ) {
                    setViewMode(data.view_mode)
                }
            } catch (error) {
                console.error(error)
                setError(error.message)
            } finally {
                setLoading(false)
            }
        }

        fetchDashboard()
    }, [viewMode, filters])

    const summary =
        dashboard.summary || emptyDashboard.summary

    const upcomingTasks =
        dashboard.upcoming_tasks || []

    const recentActivities =
        dashboard.recent_activities || []

    const myTasks =
        dashboard.my_tasks || []

    const kanban =
        dashboard.kanban || emptyDashboard.kanban

    if (loading) {
        return (
            <div className="py-6">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    กำลังโหลดข้อมูล Dashboard งาน...
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="py-6">
                <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-red-500">
                        โหลดข้อมูลไม่สำเร็จ
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                        {error}
                    </p>

                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 rounded-xl bg-sky-500 px-4 py-2 text-white hover:bg-sky-600"
                    >
                        โหลดใหม่
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col w-full h-full py-6 gap-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">

                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                            Task Dashboard
                        </h1>

                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {
                                viewMode === 'admin'
                                    ? 'มุมมองผู้ดูแลระบบ แสดงงานทั้งหมดในระบบ'
                                    : 'มุมมองของฉัน แสดงเฉพาะงานที่ได้รับมอบหมาย'
                            }
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">

                        <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1">

                            <button
                                type="button"
                                onClick={() =>
                                    setViewMode('mine')
                                }
                                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${viewMode === 'mine'
                                        ? 'bg-white text-sky-600 shadow-sm dark:bg-slate-950'
                                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer'
                                    }`}
                            >
                                <FiUser />
                                ของฉัน
                            </button>

                            {
                                canViewAdmin && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setViewMode('admin')
                                        }
                                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${viewMode === 'admin'
                                                ? 'bg-white text-sky-600 shadow-sm dark:bg-slate-950'
                                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer'
                                            }`}
                                    >
                                        <FiShield />
                                        Admin
                                    </button>
                                )
                            }

                        </div>

                    </div>

                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">

                    <select
                        value={filters.project_id}
                        onChange={(e) =>
                            handleFilterChange(
                                'project_id',
                                e.target.value
                            )
                        }
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    >
                        <option value="all">
                            ทุกโปรเจกต์
                        </option>

                        {
                            dashboard.available_projects?.map(
                                (project) => (
                                    <option
                                        key={project.project_id}
                                        value={project.project_id}
                                    >
                                        {project.project_name}
                                    </option>
                                )
                            )
                        }
                    </select>

                    <select
                        value={filters.status}
                        onChange={(e) =>
                            handleFilterChange(
                                'status',
                                e.target.value
                            )
                        }
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    >
                        <option value="all">
                            ทุกสถานะ
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
                    </select>

                    <select
                        value={filters.priority}
                        onChange={(e) =>
                            handleFilterChange(
                                'priority',
                                e.target.value
                            )
                        }
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
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
                    </select>

                    <select
                        value={filters.due}
                        onChange={(e) =>
                            handleFilterChange(
                                'due',
                                e.target.value
                            )
                        }
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    >
                        <option value="all">
                            ทุกช่วงเวลา
                        </option>

                        <option value="overdue">
                            เกินกำหนด
                        </option>

                        <option value="next7">
                            7 วันข้างหน้า
                        </option>

                        <option value="next30">
                            30 วันข้างหน้า
                        </option>
                    </select>

                    <button
                        type="button"
                        onClick={resetFilters}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                        <FiRefreshCw />
                        Reset Filter
                    </button>

                </div>

            </div>
            {/* KPI Cards */}
            <div className="grid gap-4 xl:grid-cols-5">

                <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {
                            viewMode === 'admin'
                                ? 'โปรเจกต์ทั้งหมด'
                                : 'โปรเจกต์ที่รับผิดชอบ'
                        }
                    </p>

                    <p className="mt-4 text-2xl font-semibold">
                        {summary.total_projects}
                    </p>
                </article>

                <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        งานทั้งหมด
                    </p>

                    <p className="mt-4 text-2xl font-semibold">
                        {summary.total_tasks}
                    </p>
                </article>

                <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        งานที่เสร็จแล้ว
                    </p>

                    <p className="mt-4 text-2xl font-semibold">
                        {summary.completed_tasks}
                    </p>
                </article>

                <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        กำลังดำเนินการ
                    </p>

                    <p className="mt-4 text-2xl font-semibold">
                        {summary.in_progress_tasks}
                    </p>
                </article>

                <article className="rounded-2xl border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <p className="text-sm text-red-500">
                        งานเกินกำหนด
                    </p>

                    <p className="mt-4 text-2xl font-semibold text-red-500">
                        {summary.overdue_tasks}
                    </p>
                </article>

            </div>

            {/* Upcoming + Activity */}
            <div className="grid gap-6 lg:grid-cols-2">

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold">
                        งานใกล้ถึงกำหนด
                    </h2>

                    <div className="mt-4 space-y-3">
                        {
                            upcomingTasks.length === 0 ? (
                                <EmptyMessage text="ยังไม่มีงานใกล้ถึงกำหนด" />
                            ) : (
                                upcomingTasks.map((task) => (
                                    <div
                                        key={task.task_id}
                                        className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800 p-4"
                                    >
                                        <div>
                                            <p className="font-medium">
                                                {task.task_name}
                                            </p>

                                            <p className="text-sm text-slate-500">
                                                {task.project_name}
                                            </p>
                                        </div>

                                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                                            เหลือ {formatDueText(task.days_left)}
                                        </span>
                                    </div>
                                ))
                            )
                        }
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold">
                        กิจกรรมล่าสุด
                    </h2>

                    <div className="mt-4 space-y-4">
                        {
                            recentActivities.length === 0 ? (
                                <EmptyMessage text="ยังไม่มีกิจกรรมล่าสุด" />
                            ) : (
                                recentActivities.map((activity) => (
                                    <div
                                        key={activity.history_id}
                                        className="flex gap-3"
                                    >
                                        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sky-500" />

                                        <div>
                                            <p className="font-medium">
                                                {getActivityText(activity)}
                                            </p>

                                            <p className="text-xs text-slate-500">
                                                {activity.task_name}
                                                {' • '}
                                                {activity.project_name}
                                                {' • '}
                                                {activity.action_by_name}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )
                        }
                    </div>
                </div>

            </div>

            {/* My Tasks */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">

                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-slate-500">
                            {
                                viewMode === 'admin'
                                    ? 'มุมมองผู้ดูแลระบบ'
                                    : 'งานที่ได้รับมอบหมาย'
                            }
                        </p>

                        <h2 className="mt-2 text-xl font-semibold">
                            {
                                viewMode === 'admin'
                                    ? 'งานทั้งหมดในระบบ'
                                    : 'งานของฉัน'
                            }
                        </h2>
                    </div>

                    <Link
                        href="/dashboard/task/new"
                        className="inline-flex items-center rounded-2xl bg-sky-500 px-4 py-2 text-white hover:bg-sky-600"
                    >
                        <FiPlus className="mr-2" />
                        เพิ่มงาน
                    </Link>
                </div>

                <div className="mt-6 overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800">
                                <th className="py-3 text-left">
                                    งาน
                                </th>

                                <th className="py-3 text-left">
                                    โปรเจกต์
                                </th>

                                <th className="py-3 text-left">
                                    กำหนดส่ง
                                </th>

                                <th className="py-3 text-left">
                                    Priority
                                </th>

                                <th className="py-3 text-left">
                                    สถานะ
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {
                                myTasks.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="py-6 text-center text-slate-500"
                                        >
                                            ยังไม่มีงานที่ได้รับมอบหมาย
                                        </td>
                                    </tr>
                                ) : (
                                    myTasks.map((task) => (
                                        <tr
                                            key={task.task_id}
                                            className="border-b border-slate-100 dark:border-slate-800"
                                        >
                                            <td className="py-4">
                                                <Link
                                                    href={`/dashboard/task/${task.task_id}`}
                                                    className="font-medium hover:text-sky-500"
                                                >
                                                    {task.task_name}
                                                </Link>
                                            </td>

                                            <td>
                                                {task.project_name}
                                            </td>

                                            <td>
                                                {formatDate(task.due_date)}
                                            </td>

                                            <td>
                                                <span className={`rounded-full px-3 py-1 text-xs font-medium ${getPriorityClass(task.priority)}`}>
                                                    {priorityLabel[task.priority]}
                                                </span>
                                            </td>

                                            <td>
                                                <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(task.status)}`}>
                                                    {statusLabel[task.status]}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )
                            }
                        </tbody>
                    </table>
                </div>

            </div>

            {/* Kanban */}
            <div className="grid gap-6 xl:grid-cols-4 lg:grid-cols-2">

                {
                    kanbanColumns.map((column) => {
                        const tasks =
                            kanban[column.key] || []

                        return (
                            <div
                                key={column.key}
                                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
                            >
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="font-semibold">
                                        {column.title}
                                    </h3>

                                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs">
                                        {tasks.length}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {
                                        tasks.length === 0 ? (
                                            <EmptyMessage text="ไม่มีงาน" />
                                        ) : (
                                            tasks.map((task) => (
                                                <Link
                                                    key={task.task_id}
                                                    href={`/dashboard/task/${task.task_id}`}
                                                    className="block rounded-xl bg-slate-50 dark:bg-slate-800 p-3 hover:ring-2 hover:ring-sky-400"
                                                >
                                                    <p className="font-medium">
                                                        {task.task_name}
                                                    </p>

                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {task.project_name}
                                                    </p>

                                                    <div className="mt-3 flex items-center justify-between gap-2">
                                                        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${getPriorityClass(task.priority)}`}>
                                                            {priorityLabel[task.priority]}
                                                        </span>

                                                        <span className="text-[11px] text-slate-500">
                                                            {formatDate(task.due_date)}
                                                        </span>
                                                    </div>
                                                </Link>
                                            ))
                                        )
                                    }
                                </div>
                            </div>
                        )
                    })
                }

            </div>

        </div>
    )
}