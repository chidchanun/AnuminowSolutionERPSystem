'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
    FiChevronDown,
    FiRefreshCw,
    FiSearch,
    FiShield,
    FiUser,
} from 'react-icons/fi'

const columnConfig = [
    {
        key: 'todo',
        title: 'TODO',
        description: 'งานที่ยังไม่ได้เริ่ม',
    },
    {
        key: 'in_progress',
        title: 'IN PROGRESS',
        description: 'งานที่กำลังดำเนินการ',
    },
    {
        key: 'review',
        title: 'REVIEW',
        description: 'งานที่รอตรวจสอบ',
    },
    {
        key: 'done',
        title: 'DONE',
        description: 'งานที่เสร็จแล้ว',
    },
]

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

const emptyBoard = {
    todo: [],
    in_progress: [],
    review: [],
    done: [],
}

export default function TaskBoardPage() {
    const [board, setBoard] = useState(emptyBoard)
    const [projects, setProjects] = useState([])
    const [assignees, setAssignees] = useState([])

    const [summary, setSummary] = useState({
        total: 0,
        todo: 0,
        in_progress: 0,
        review: 0,
        done: 0,
    })

    const [viewMode, setViewMode] = useState('mine')
    const [canViewAdmin, setCanViewAdmin] = useState(false)

    const [searchText, setSearchText] = useState('')

    const [filters, setFilters] = useState({
        q: '',
        project_id: 'all',
        priority: 'all',
        assignee_id: 'all',
        due: 'all',
    })

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [draggingTask, setDraggingTask] = useState(null)
    const [updatingTaskId, setUpdatingTaskId] = useState(null)

    const queryString = useMemo(() => {
        return new URLSearchParams({
            view: viewMode,
            q: filters.q,
            project_id: filters.project_id,
            priority: filters.priority,
            assignee_id: filters.assignee_id,
            due: filters.due,
        }).toString()
    }, [
        viewMode,
        filters.q,
        filters.project_id,
        filters.priority,
        filters.assignee_id,
        filters.due,
    ])

    useEffect(() => {
        let ignore = false
        const controller = new AbortController()

        fetch(`/api/v1/task/board?${queryString}`, {
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(async (res) => {
                const data = await res.json()

                if (!res.ok) {
                    throw new Error(
                        data.error_detail ||
                        data.message ||
                        'โหลด Kanban Board ไม่สำเร็จ'
                    )
                }

                return data
            })
            .then((data) => {
                if (ignore) return

                setBoard(data.board || emptyBoard)
                setProjects(data.options?.projects || [])
                setAssignees(data.options?.assignees || [])
                setSummary(data.summary || {})
                setCanViewAdmin(Boolean(data.can_view_admin))

                if (
                    data.view_mode &&
                    data.view_mode !== viewMode
                ) {
                    setViewMode(data.view_mode)
                }

                setError('')
            })
            .catch((error) => {
                if (
                    error.name === 'AbortError' ||
                    ignore
                ) {
                    return
                }

                console.error(error)
                setError(error.message)
            })
            .finally(() => {
                if (!ignore) {
                    setLoading(false)
                }
            })

        return () => {
            ignore = true
            controller.abort()
        }
    }, [queryString, viewMode])

    const handleFilterChange = (name, value) => {
        setLoading(true)

        setFilters((prev) => ({
            ...prev,
            [name]: value,
        }))
    }

    const handleSearchSubmit = (e) => {
        e.preventDefault()

        setLoading(true)

        setFilters((prev) => ({
            ...prev,
            q: searchText,
        }))
    }

    const resetFilters = () => {
        setLoading(true)
        setSearchText('')

        setFilters({
            q: '',
            project_id: 'all',
            priority: 'all',
            assignee_id: 'all',
            due: 'all',
        })
    }

    const updateTaskStatus = async ({
        task,
        newStatus,
    }) => {
        if (!task || task.status === newStatus) return

        try {
            setUpdatingTaskId(task.task_id)

            const res = await fetch(
                `/api/v1/task/${task.task_id}/status`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        status: newStatus,
                    }),
                }
            )

            const data = await res.json()

            if (!res.ok) {
                throw new Error(
                    data.error_detail ||
                    data.message ||
                    'เปลี่ยนสถานะไม่สำเร็จ'
                )
            }

            setBoard((prev) => {
                const next = {
                    todo: [...(prev.todo || [])],
                    in_progress: [...(prev.in_progress || [])],
                    review: [...(prev.review || [])],
                    done: [...(prev.done || [])],
                }

                next[task.status] =
                    next[task.status].filter(
                        (item) =>
                            item.task_id !== task.task_id
                    )

                next[newStatus] = [
                    {
                        ...task,
                        status: newStatus,
                    },
                    ...next[newStatus],
                ]

                return next
            })

            setSummary((prev) => ({
                ...prev,
                [task.status]:
                    Math.max(
                        Number(prev[task.status] || 0) - 1,
                        0
                    ),
                [newStatus]:
                    Number(prev[newStatus] || 0) + 1,
            }))
        } catch (error) {
            console.error(error)
            alert(error.message)
        } finally {
            setUpdatingTaskId(null)
            setDraggingTask(null)
        }
    }

    const handleDragStart = (task) => {
        setDraggingTask(task)
    }

    const handleDrop = (newStatus) => {
        if (!draggingTask) return

        updateTaskStatus({
            task: draggingTask,
            newStatus,
        })
    }

    return (
        <div className="flex flex-col gap-6 py-6">

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">

                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Kanban Board
                        </h1>

                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            จัดการสถานะงานแบบกระดาน
                        </p>
                    </div>

                    <div className="flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
                        <button
                            type="button"
                            onClick={() => {
                                setLoading(true)
                                setViewMode('mine')
                            }}
                            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${
                                viewMode === 'mine'
                                    ? 'bg-white text-sky-600 shadow-sm dark:bg-slate-950'
                                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <FiUser />
                            ของฉัน
                        </button>

                        {canViewAdmin && (
                            <button
                                type="button"
                                onClick={() => {
                                    setLoading(true)
                                    setViewMode('admin')
                                }}
                                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${
                                    viewMode === 'admin'
                                        ? 'bg-white text-sky-600 shadow-sm dark:bg-slate-950'
                                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <FiShield />
                                Admin
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <form
                        onSubmit={handleSearchSubmit}
                        className="relative xl:col-span-2"
                    >
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
                    </form>

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
                        value={filters.assignee_id}
                        onChange={(e) =>
                            handleFilterChange(
                                'assignee_id',
                                e.target.value
                            )
                        }
                    >
                        <option value="all">
                            ทุกผู้รับผิดชอบ
                        </option>

                        {assignees.map((user) => (
                            <option
                                key={user.id}
                                value={user.id}
                            >
                                {user.full_name}
                            </option>
                        ))}
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
                </div>

            </div>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-950">
                    {error}
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-sm text-slate-500">
                        งานทั้งหมด
                    </p>
                    <p className="mt-3 text-2xl font-semibold">
                        {summary.total || 0}
                    </p>
                </article>

                {columnConfig.map((column) => (
                    <article
                        key={column.key}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                        <p className="text-sm text-slate-500">
                            {column.title}
                        </p>

                        <p className="mt-3 text-2xl font-semibold">
                            {summary[column.key] || 0}
                        </p>
                    </article>
                ))}
            </div>

            {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    กำลังโหลด Kanban Board...
                </div>
            ) : (
                <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-4">

                    {columnConfig.map((column) => {
                        const tasks =
                            board[column.key] || []

                        return (
                            <section
                                key={column.key}
                                onDragOver={(e) =>
                                    e.preventDefault()
                                }
                                onDrop={() =>
                                    handleDrop(column.key)
                                }
                                className="
                                    min-h-[400px] rounded-2xl border border-slate-200
                                    bg-white p-4 shadow-sm
                                    dark:border-slate-800 dark:bg-slate-900
                                "
                            >
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="font-semibold">
                                            {column.title}
                                        </h2>

                                        <p className="text-xs text-slate-500">
                                            {column.description}
                                        </p>
                                    </div>

                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">
                                        {tasks.length}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {tasks.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
                                            ไม่มีงาน
                                        </div>
                                    ) : (
                                        tasks.map((task) => (
                                            <article
                                                key={task.task_id}
                                                draggable
                                                onDragStart={() =>
                                                    handleDragStart(task)
                                                }
                                                className={`
                                                    rounded-2xl border border-slate-200
                                                    bg-slate-50 p-4 shadow-sm
                                                    transition hover:border-sky-300
                                                    dark:border-slate-800 dark:bg-slate-800
                                                    ${
                                                        updatingTaskId === task.task_id
                                                            ? 'opacity-50'
                                                            : ''
                                                    }
                                                `}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <Link
                                                            href={`/dashboard/task/${task.task_id}`}
                                                            className="line-clamp-2 font-semibold hover:text-sky-500"
                                                        >
                                                            {task.task_name}
                                                        </Link>

                                                        <p className="mt-1 text-xs text-slate-500">
                                                            #{task.task_id}
                                                        </p>
                                                    </div>

                                                    <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${getPriorityClass(task.priority)}`}>
                                                        {priorityLabel[task.priority]}
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
                                                                ผู้รับผิดชอบ
                                                            </p>

                                                            <p>
                                                                {task.assignee_count || 0} คน
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <p className="line-clamp-2 text-xs text-slate-500">
                                                        {task.assignee_names || '-'}
                                                    </p>
                                                </div>

                                                <div className="mt-4">
                                                    <SelectBox
                                                        value={task.status}
                                                        onChange={(e) =>
                                                            updateTaskStatus({
                                                                task,
                                                                newStatus:
                                                                    e.target.value,
                                                            })
                                                        }
                                                    >
                                                        {columnConfig.map((item) => (
                                                            <option
                                                                key={item.key}
                                                                value={item.key}
                                                            >
                                                                {statusLabel[item.key]}
                                                            </option>
                                                        ))}
                                                    </SelectBox>
                                                </div>
                                            </article>
                                        ))
                                    )}
                                </div>
                            </section>
                        )
                    })}

                </div>
            )}

        </div>
    )
}