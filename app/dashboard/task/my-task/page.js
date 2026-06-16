'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
    FiSearch,
    FiRefreshCw,
    FiChevronLeft,
    FiChevronRight,
    FiChevronDown,
} from 'react-icons/fi'

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

function SelectBox({
    value,
    onChange,
    children,
    className = '',
}) {
    return (
        <div className={`relative w-full ${className}`}>
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

export default function MyTaskPage() {
    const [tasks, setTasks] = useState([])
    const [projects, setProjects] = useState([])

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [searchText, setSearchText] = useState('')

    const [filters, setFilters] = useState({
        q: '',
        project_id: 'all',
        status: 'all',
        priority: 'all',
        due: 'all',
        sort: 'updated',
    })

    const [summary, setSummary] = useState({
        total_tasks: 0,
        todo_tasks: 0,
        in_progress_tasks: 0,
        review_tasks: 0,
        done_tasks: 0,
        overdue_tasks: 0,
    })

    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        total_pages: 1,
    })

    const handleFilterChange = (name, value) => {
        setLoading(true)

        setFilters((prev) => ({
            ...prev,
            [name]: value,
        }))

        setPagination((prev) => ({
            ...prev,
            page: 1,
        }))
    }

    const resetFilters = () => {
        setLoading(true)
        setSearchText('')

        setFilters({
            q: '',
            project_id: 'all',
            status: 'all',
            priority: 'all',
            due: 'all',
            sort: 'updated',
        })

        setPagination((prev) => ({
            ...prev,
            page: 1,
        }))
    }

    const queryString = useMemo(() => {
        return new URLSearchParams({
            page: String(pagination.page),
            limit: String(pagination.limit),
            q: filters.q,
            project_id: filters.project_id,
            status: filters.status,
            priority: filters.priority,
            due: filters.due,
            sort: filters.sort,
        }).toString()
    }, [
        pagination.page,
        pagination.limit,
        filters.q,
        filters.project_id,
        filters.status,
        filters.priority,
        filters.due,
        filters.sort,
    ])

    useEffect(() => {
        let ignore = false

        const controller = new AbortController()

        async function loadTasks() {
            try {
                const res = await fetch(
                    `/api/v1/task/my-task?${queryString}`,
                    {
                        cache: 'no-store',
                        signal: controller.signal,
                    }
                )

                const data = await res.json()

                if (!res.ok) {
                    throw new Error(
                        data.error_detail ||
                        data.message ||
                        'โหลดข้อมูลงานของฉันไม่สำเร็จ'
                    )
                }

                if (ignore) return

                setTasks(data.tasks || [])
                setProjects(data.options?.projects || [])
                setSummary(data.summary || {})
                setError('')

                setPagination((prev) => ({
                    ...prev,
                    total: data.pagination?.total || 0,
                    total_pages:
                        data.pagination?.total_pages || 1,
                }))
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

        loadTasks()

        return () => {
            ignore = true
            controller.abort()
        }
    }, [queryString])

    const handleSearchSubmit = (e) => {
        e.preventDefault()

        setLoading(true)

        setFilters((prev) => ({
            ...prev,
            q: searchText,
        }))

        setPagination((prev) => ({
            ...prev,
            page: 1,
        }))
    }

    const canGoPrev =
        pagination.page > 1

    const canGoNext =
        pagination.page < pagination.total_pages

    return (
        <div className="flex flex-col w-full h-full py-6 gap-6">

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    งานของฉัน
                </h1>

                <p className="text-sm text-slate-500 dark:text-slate-400">
                    แสดงเฉพาะงานที่คุณได้รับมอบหมาย
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                    <p className="text-sm text-slate-500">
                        งานทั้งหมด
                    </p>
                    <p className="mt-3 text-2xl font-semibold">
                        {summary.total_tasks || 0}
                    </p>
                </article>

                <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                    <p className="text-sm text-slate-500">
                        Todo
                    </p>
                    <p className="mt-3 text-2xl font-semibold">
                        {summary.todo_tasks || 0}
                    </p>
                </article>

                <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                    <p className="text-sm text-slate-500">
                        In Progress
                    </p>
                    <p className="mt-3 text-2xl font-semibold">
                        {summary.in_progress_tasks || 0}
                    </p>
                </article>

                <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                    <p className="text-sm text-slate-500">
                        Review
                    </p>
                    <p className="mt-3 text-2xl font-semibold">
                        {summary.review_tasks || 0}
                    </p>
                </article>

                <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                    <p className="text-sm text-slate-500">
                        Done
                    </p>
                    <p className="mt-3 text-2xl font-semibold">
                        {summary.done_tasks || 0}
                    </p>
                </article>

                <article className="rounded-2xl border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 p-4 shadow-sm">
                    <p className="text-sm text-red-500">
                        เกินกำหนด
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-red-500">
                        {summary.overdue_tasks || 0}
                    </p>
                </article>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                <form
                    onSubmit={handleSearchSubmit}
                    className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6"
                >
                    <div className="relative xl:col-span-2">
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                        <input
                            type="text"
                            value={searchText}
                            onChange={(e) =>
                                setSearchText(e.target.value)
                            }
                            placeholder="ค้นหางาน / โปรเจกต์"
                            className="
                                w-full rounded-xl border border-slate-300
                                bg-white px-10 py-2 text-sm
                                dark:border-slate-700 dark:bg-slate-950
                            "
                        />
                    </div>

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

                        {projects.map((project) => (
                            <option
                                key={project.project_id}
                                value={project.project_id}
                            >
                                {project.project_name}
                            </option>
                        ))}
                    </SelectBox>

                    <SelectBox
                        value={filters.status}
                        onChange={(e) =>
                            handleFilterChange(
                                'status',
                                e.target.value
                            )
                        }
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

                    <SelectBox
                        value={filters.due}
                        onChange={(e) =>
                            handleFilterChange(
                                'due',
                                e.target.value
                            )
                        }
                    >
                        <option value="all">
                            ทุกกำหนดส่ง
                        </option>

                        <option value="overdue">
                            เกินกำหนด
                        </option>

                        <option value="today">
                            วันนี้
                        </option>

                        <option value="next7">
                            7 วันข้างหน้า
                        </option>

                        <option value="next30">
                            30 วันข้างหน้า
                        </option>

                        <option value="no_due">
                            ไม่มีกำหนดส่ง
                        </option>
                    </SelectBox>

                    <SelectBox
                        value={filters.sort}
                        onChange={(e) =>
                            handleFilterChange(
                                'sort',
                                e.target.value
                            )
                        }
                    >
                        <option value="updated">
                            แก้ไขล่าสุด
                        </option>

                        <option value="newest">
                            สร้างล่าสุด
                        </option>

                        <option value="due_asc">
                            กำหนดส่งใกล้สุด
                        </option>

                        <option value="due_desc">
                            กำหนดส่งไกลสุด
                        </option>

                        <option value="priority">
                            Priority สูงสุด
                        </option>
                    </SelectBox>

                    <button
                        type="button"
                        onClick={resetFilters}
                        className="
                            inline-flex w-full items-center justify-center gap-2
                            rounded-xl border border-slate-300 px-3 py-2 text-sm
                            hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800
                        "
                    >
                        <FiRefreshCw />
                        Reset
                    </button>
                </form>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm">

                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">
                            รายการงานของฉัน
                        </h2>

                        <p className="text-sm text-slate-500">
                            ทั้งหมด {pagination.total} รายการ
                        </p>
                    </div>

                    <SelectBox
                        className="sm:w-36"
                        value={pagination.limit}
                        onChange={(e) =>
                            setPagination((prev) => ({
                                ...prev,
                                page: 1,
                                limit: Number(e.target.value),
                            }))
                        }
                    >
                        <option value={10}>
                            10 / page
                        </option>

                        <option value={20}>
                            20 / page
                        </option>

                        <option value={50}>
                            50 / page
                        </option>
                    </SelectBox>
                </div>

                {error && (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-950">
                        {error}
                    </div>
                )}

                <div className="space-y-3 lg:hidden">
                    {loading ? (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center text-sm text-slate-500">
                            กำลังโหลดข้อมูลงาน...
                        </div>
                    ) : tasks.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center text-sm text-slate-500">
                            ไม่พบข้อมูลงาน
                        </div>
                    ) : (
                        tasks.map((task) => (
                            <Link
                                key={task.task_id}
                                href={`/dashboard/task/${task.task_id}`}
                                className="
                                    block rounded-2xl border border-slate-200
                                    bg-slate-50 p-4 shadow-sm
                                    dark:border-slate-800 dark:bg-slate-800
                                "
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h3 className="truncate font-semibold text-slate-900 dark:text-white">
                                            {task.task_name}
                                        </h3>

                                        <p className="mt-1 text-xs text-slate-500">
                                            #{task.task_id}
                                        </p>
                                    </div>

                                    <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${getStatusClass(task.status)}`}>
                                        {statusLabel[task.status]}
                                    </span>
                                </div>

                                <div className="mt-3 space-y-2 text-sm">
                                    <div>
                                        <p className="text-xs text-slate-500">
                                            โปรเจกต์
                                        </p>

                                        <p className="truncate font-medium">
                                            {task.project_name}
                                        </p>

                                        <p className="text-xs text-slate-500">
                                            {task.project_code}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-xs text-slate-500">
                                                กำหนดส่ง
                                            </p>

                                            <p>
                                                {formatDate(task.due_date)}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-slate-500">
                                                Priority
                                            </p>

                                            <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${getPriorityClass(task.priority)}`}>
                                                {priorityLabel[task.priority]}
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs text-slate-500">
                                            ผู้สร้าง
                                        </p>

                                        <p>
                                            {task.created_by_name}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>

                <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[900px]">
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

                                <th className="py-3 text-left">
                                    ผู้สร้าง
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="py-8 text-center text-slate-500"
                                    >
                                        กำลังโหลดข้อมูลงาน...
                                    </td>
                                </tr>
                            ) : tasks.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="py-8 text-center text-slate-500"
                                    >
                                        ไม่พบข้อมูลงาน
                                    </td>
                                </tr>
                            ) : (
                                tasks.map((task) => (
                                    <tr
                                        key={task.task_id}
                                        className="border-b border-slate-100 dark:border-slate-800"
                                    >
                                        <td className="py-4">
                                            <Link
                                                href={`/dashboard/task/${task.task_id}`}
                                                className="font-medium text-slate-900 hover:text-sky-500 dark:text-white"
                                            >
                                                {task.task_name}
                                            </Link>

                                            <p className="mt-1 text-xs text-slate-500">
                                                #{task.task_id}
                                            </p>
                                        </td>

                                        <td>
                                            <p className="font-medium">
                                                {task.project_name}
                                            </p>

                                            <p className="text-xs text-slate-500">
                                                {task.project_code}
                                            </p>
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

                                        <td>
                                            {task.created_by_name}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                        หน้า {pagination.page} จาก {pagination.total_pages || 1}
                    </p>

                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <button
                            type="button"
                            disabled={!canGoPrev}
                            onClick={() =>
                                setPagination((prev) => ({
                                    ...prev,
                                    page: prev.page - 1,
                                }))
                            }
                            className="
                                inline-flex w-full items-center justify-center gap-2
                                rounded-xl border border-slate-300 px-3 py-2 text-sm
                                disabled:cursor-not-allowed disabled:opacity-40
                                dark:border-slate-700 sm:w-auto
                            "
                        >
                            <FiChevronLeft />
                            ก่อนหน้า
                        </button>

                        <button
                            type="button"
                            disabled={!canGoNext}
                            onClick={() =>
                                setPagination((prev) => ({
                                    ...prev,
                                    page: prev.page + 1,
                                }))
                            }
                            className="
                                inline-flex w-full items-center justify-center gap-2
                                rounded-xl border border-slate-300 px-3 py-2 text-sm
                                disabled:cursor-not-allowed disabled:opacity-40
                                dark:border-slate-700 sm:w-auto
                            "
                        >
                            ถัดไป
                            <FiChevronRight />
                        </button>
                    </div>
                </div>

            </div>

        </div>
    )
}