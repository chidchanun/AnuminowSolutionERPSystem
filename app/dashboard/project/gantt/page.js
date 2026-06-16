'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
    FiChevronDown,
    FiRefreshCw,
    FiSearch,
    FiShield,
    FiUser,
    FiCalendar,
} from 'react-icons/fi'

const LEFT_COLUMN_WIDTH = 280
const PROJECT_TASK_PREVIEW_LIMIT = 5

const zoomConfig = {
    day: {
        label: 'Day',
        unitWidth: 42,
    },
    week: {
        label: 'Week',
        unitWidth: 92,
    },
    month: {
        label: 'Month',
        unitWidth: 140,
    },
}

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

function parseDateOnly(value) {
    if (!value) return null

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return null
    }

    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    )
}

function startOfMonth(date) {
    return new Date(
        date.getFullYear(),
        date.getMonth(),
        1
    )
}

function endOfMonth(date) {
    return new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0
    )
}

function startOfWeekMonday(date) {
    const next = new Date(date)
    const day = next.getDay()
    const diff = day === 0 ? -6 : 1 - day
    next.setDate(next.getDate() + diff)

    return new Date(
        next.getFullYear(),
        next.getMonth(),
        next.getDate()
    )
}

function endOfWeekSunday(date) {
    const start = startOfWeekMonday(date)
    start.setDate(start.getDate() + 6)
    return start
}

function addDays(date, days) {
    const next = new Date(date)
    next.setDate(next.getDate() + days)
    return next
}

function addMonths(date, months) {
    const next = new Date(date)
    next.setMonth(next.getMonth() + months)
    return next
}

function diffDays(start, end) {
    const oneDay = 1000 * 60 * 60 * 24
    return Math.round((end - start) / oneDay)
}

function formatDate(dateValue) {
    if (!dateValue) return '-'

    const date = parseDateOnly(dateValue)

    if (!date) return '-'

    return new Intl.DateTimeFormat('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date)
}

function formatDateShort(dateValue) {
    if (!dateValue) return '-'

    const date = parseDateOnly(dateValue)

    if (!date) return '-'

    return new Intl.DateTimeFormat('th-TH', {
        day: '2-digit',
        month: 'short',
    }).format(date)
}

function formatDay(date) {
    return new Intl.DateTimeFormat('th-TH', {
        day: '2-digit',
    }).format(date)
}

function formatMonth(date) {
    return new Intl.DateTimeFormat('th-TH', {
        month: 'short',
    }).format(date)
}

function formatMonthYear(date) {
    return new Intl.DateTimeFormat('th-TH', {
        month: 'short',
        year: 'numeric',
    }).format(date)
}

function formatYear(date) {
    return new Intl.DateTimeFormat('th-TH', {
        year: 'numeric',
    }).format(date)
}

function isWeekend(date) {
    const day = date.getDay()
    return day === 0 || day === 6
}

function isSameDay(a, b) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    )
}

function isTodayInRange({
    today,
    start,
    end,
}) {
    return today >= start && today <= end
}

function normalizeValue(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
}

function getProjectStatusClass(status) {
    const normalized = normalizeStatus(status)

    switch (normalized) {
        case 'planning':
            return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'

        case 'active':
            return 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'

        case 'completed':
            return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'

        case 'cancelled':
        case 'canceled':
            return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'

        default:
            return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    }
}

function getTaskBarColor(status) {
    const normalized = normalizeValue(status)

    switch (normalized) {
        case 'todo':
            return '#94a3b8' // slate-400

        case 'in_progress':
            return '#0ea5e9' // sky-500

        case 'review':
            return '#f59e0b' // amber-500

        case 'done':
            return '#22c55e' // green-500

        default:
            return '#94a3b8'
    }
}

function getPriorityClass(priority) {
    const normalized = normalizeValue(priority)

    switch (normalized) {
        case 'low':
            return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'

        case 'medium':
            return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'

        case 'high':
            return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'

        case 'critical':
            return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'

        default:
            return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    }
}
function normalizeStatus(status) {
    return String(status || '')
        .trim()
        .toLowerCase()
}

function getProjectBarColor(status) {
    const normalized = normalizeStatus(status)

    switch (normalized) {
        case 'planning':
            return '#64748b' // slate-500

        case 'active':
            return '#0ea5e9' // sky-500

        case 'completed':
            return '#22c55e' // green-500

        case 'cancelled':
        case 'canceled':
            return '#ef4444' // red-500

        default:
            return '#64748b'
    }
}

function buildTimeline({
    zoomMode,
    projects,
    tasks,
}) {
    const dates = []

    projects.forEach((project) => {
        const start = parseDateOnly(project.start_date)
        const end = parseDateOnly(project.end_date)

        if (start) dates.push(start)
        if (end) dates.push(end)
    })

    tasks.forEach((task) => {
        const start = parseDateOnly(task.start_date)
        const due = parseDateOnly(task.due_date)
        const completed = parseDateOnly(task.completed_at)

        if (start) dates.push(start)
        if (due) dates.push(due)
        if (completed) dates.push(completed)
    })

    const today = parseDateOnly(new Date())

    let minDate = today || new Date()
    let maxDate = addDays(minDate, 30)

    if (dates.length > 0) {
        minDate = new Date(
            Math.min(...dates.map((date) => date.getTime()))
        )

        maxDate = new Date(
            Math.max(...dates.map((date) => date.getTime()))
        )
    }

    let start
    let end

    if (zoomMode === 'day') {
        start = startOfMonth(minDate)
        end = endOfMonth(maxDate)
    } else if (zoomMode === 'week') {
        start = startOfWeekMonday(startOfMonth(minDate))
        end = endOfWeekSunday(endOfMonth(maxDate))
    } else {
        start = startOfMonth(minDate)
        end = endOfMonth(maxDate)
    }

    const units = []

    if (zoomMode === 'day') {
        let cursor = new Date(start)

        while (cursor <= end) {
            units.push({
                start: new Date(cursor),
                end: new Date(cursor),
                label: formatDay(cursor),
                subLabel:
                    cursor.getDate() === 1
                        ? formatMonth(cursor)
                        : '',
                groupKey: `${cursor.getFullYear()}-${cursor.getMonth()}`,
                groupLabel: formatMonthYear(cursor),
                isWeekend: isWeekend(cursor),
            })

            cursor = addDays(cursor, 1)
        }
    }

    if (zoomMode === 'week') {
        let cursor = new Date(start)
        let weekNumber = 1

        while (cursor <= end) {
            const weekStart = new Date(cursor)
            const weekEnd = endOfWeekSunday(weekStart)

            units.push({
                start: weekStart,
                end: weekEnd,
                label: `W${weekNumber}`,
                subLabel: `${formatDateShort(weekStart)} - ${formatDateShort(weekEnd)}`,
                groupKey: `${weekStart.getFullYear()}-${weekStart.getMonth()}`,
                groupLabel: formatMonthYear(weekStart),
                isWeekend: false,
            })

            cursor = addDays(cursor, 7)
            weekNumber += 1
        }
    }

    if (zoomMode === 'month') {
        let cursor = new Date(start)

        while (cursor <= end) {
            const monthStart = startOfMonth(cursor)
            const monthEnd = endOfMonth(cursor)

            units.push({
                start: monthStart,
                end: monthEnd,
                label: formatMonth(cursor),
                subLabel: formatYear(cursor),
                groupKey: `${cursor.getFullYear()}`,
                groupLabel: formatYear(cursor),
                isWeekend: false,
            })

            cursor = addMonths(cursor, 1)
        }
    }

    const groups = []
    let currentGroup = null

    units.forEach((unit, index) => {
        if (
            !currentGroup ||
            currentGroup.key !== unit.groupKey
        ) {
            currentGroup = {
                key: unit.groupKey,
                label: unit.groupLabel,
                startIndex: index,
                endIndex: index,
            }

            groups.push(currentGroup)
        } else {
            currentGroup.endIndex = index
        }
    })

    return {
        start,
        end,
        units,
        groups,
    }
}

export default function ProjectGanttPage() {
    const [projects, setProjects] = useState([])
    const [tasks, setTasks] = useState([])
    const [projectOptions, setProjectOptions] = useState([])

    const [viewMode, setViewMode] = useState('mine')
    const [canViewAdmin, setCanViewAdmin] = useState(false)
    const [zoomMode, setZoomMode] = useState('day')

    const [searchText, setSearchText] = useState('')

    const [filters, setFilters] = useState({
        q: '',
        project_id: 'all',
        status: 'all',
    })

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [expandedProjectIds, setExpandedProjectIds] = useState({})

    const queryString = useMemo(() => {
        return new URLSearchParams({
            view: viewMode,
            q: filters.q,
            project_id: filters.project_id,
            status: filters.status,
        }).toString()
    }, [
        viewMode,
        filters.q,
        filters.project_id,
        filters.status,
    ])

    useEffect(() => {
        let ignore = false
        const controller = new AbortController()

        async function loadGantt() {
            try {
                const res = await fetch(
                    `/api/v1/project/gantt?${queryString}`,
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
                        'โหลด Gantt Chart ไม่สำเร็จ'
                    )
                }

                if (ignore) return

                setProjects(data.projects || [])
                setTasks(data.tasks || [])
                setProjectOptions(data.options?.projects || [])
                setCanViewAdmin(Boolean(data.can_view_admin))

                if (
                    data.view_mode &&
                    data.view_mode !== viewMode
                ) {
                    setViewMode(data.view_mode)
                }

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

        loadGantt()

        return () => {
            ignore = true
            controller.abort()
        }
    }, [queryString])

    const taskMapByProject = useMemo(() => {
        const map = {}

        tasks.forEach((task) => {
            if (!map[task.project_id]) {
                map[task.project_id] = []
            }

            map[task.project_id].push(task)
        })

        return map
    }, [tasks])

    const timeline = useMemo(() => {
        return buildTimeline({
            zoomMode,
            projects,
            tasks,
        })
    }, [
        zoomMode,
        projects,
        tasks,
    ])

    const unitWidth =
        zoomConfig[zoomMode]?.unitWidth ||
        zoomConfig.day.unitWidth

    const gridTemplateColumns = useMemo(() => {
        return `${LEFT_COLUMN_WIDTH}px repeat(${timeline.units.length}, ${unitWidth}px)`
    }, [
        timeline.units.length,
        unitWidth,
    ])

    const ganttWidth = useMemo(() => {
        return (
            LEFT_COLUMN_WIDTH +
            timeline.units.length * unitWidth
        )
    }, [
        timeline.units.length,
        unitWidth,
    ])

    const todayIndex = useMemo(() => {
        const today = parseDateOnly(new Date())

        if (!today) return -1

        return timeline.units.findIndex((unit) =>
            isTodayInRange({
                today,
                start: unit.start,
                end: unit.end,
            })
        )
    }, [timeline.units])

    const getBarStyle = ({
        startDate,
        endDate,
    }) => {
        let start =
            parseDateOnly(startDate) || timeline.start

        let end =
            parseDateOnly(endDate) || start

        if (end < start) {
            end = start
        }

        let startIndex = 0
        let endIndex = 0

        if (zoomMode === 'day') {
            startIndex =
                diffDays(timeline.start, start)

            endIndex =
                diffDays(timeline.start, end)
        } else {
            startIndex =
                timeline.units.findIndex((unit) =>
                    unit.end >= start
                )

            endIndex =
                timeline.units.findIndex((unit) =>
                    unit.end >= end
                )

            if (startIndex === -1) {
                startIndex = 0
            }

            if (endIndex === -1) {
                endIndex =
                    timeline.units.length - 1
            }
        }

        startIndex =
            Math.max(
                Math.min(
                    startIndex,
                    timeline.units.length - 1
                ),
                0
            )

        endIndex =
            Math.max(
                Math.min(
                    endIndex,
                    timeline.units.length - 1
                ),
                startIndex
            )

        return {
            gridColumn: `${startIndex + 2} / ${endIndex + 3}`,
            gridRow: 1,
        }
    }

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
            status: 'all',
        })
    }

    const toggleProjectExpanded = (projectId) => {
        setExpandedProjectIds((prev) => ({
            ...prev,
            [projectId]: !prev[projectId],
        }))
    }

    const totalTasks = tasks.length

    const completedTasks =
        tasks.filter(
            (task) => task.status === 'done'
        ).length

    const activeProjects =
        projects.filter(
            (project) => project.status === 'active'
        ).length

    return (
        <div className="flex w-full max-w-full min-w-0 flex-col gap-6 overflow-x-hidden py-6">

            <div className="w-full max-w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">

                <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Project Gantt Chart
                        </h1>

                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            แสดง timeline ของโปรเจกต์และงานภายในโปรเจกต์
                        </p>
                    </div>

                    <div className="flex shrink-0 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
                        <button
                            type="button"
                            onClick={() => {
                                setLoading(true)
                                setViewMode('mine')
                            }}
                            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${viewMode === 'mine'
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
                                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${viewMode === 'admin'
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

                <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">

                    <div className="flex w-full rounded-2xl bg-slate-100 p-1 dark:bg-slate-800 xl:w-auto">
                        {Object.entries(zoomConfig).map(([key, item]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() =>
                                    setZoomMode(key)
                                }
                                className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium xl:flex-none ${zoomMode === key
                                    ? 'bg-white text-sky-600 shadow-sm dark:bg-slate-950'
                                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                        <form
                            onSubmit={handleSearchSubmit}
                            className="relative min-w-0 xl:col-span-2"
                        >
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                            <input
                                type="text"
                                value={searchText}
                                onChange={(e) =>
                                    setSearchText(e.target.value)
                                }
                                placeholder="ค้นหาโปรเจกต์ / งาน"
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

            </div>

            <div className="grid w-full max-w-full min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-sm text-slate-500">
                        โปรเจกต์ทั้งหมด
                    </p>

                    <p className="mt-3 text-2xl font-semibold">
                        {projects.length}
                    </p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-sm text-slate-500">
                        โปรเจกต์ Active
                    </p>

                    <p className="mt-3 text-2xl font-semibold">
                        {activeProjects}
                    </p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-sm text-slate-500">
                        งานทั้งหมด
                    </p>

                    <p className="mt-3 text-2xl font-semibold">
                        {totalTasks}
                    </p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-sm text-slate-500">
                        งานเสร็จแล้ว
                    </p>

                    <p className="mt-3 text-2xl font-semibold">
                        {completedTasks}
                    </p>
                </article>
            </div>

            {error && (
                <div className="w-full max-w-full rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-950">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="w-full max-w-full rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    กำลังโหลด Gantt Chart...
                </div>
            ) : projects.length === 0 ? (
                <div className="w-full max-w-full rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    ไม่พบข้อมูลโปรเจกต์
                </div>
            ) : (
                <div className="w-full max-w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

                    <div className="flex min-w-0 items-center gap-2 border-b border-slate-200 p-4 dark:border-slate-800">
                        <FiCalendar className="shrink-0 text-slate-400" />

                        <p className="min-w-0 truncate text-sm text-slate-500">
                            ช่วงเวลา {formatDate(timeline.start)} - {formatDate(timeline.end)}
                        </p>
                    </div>

                    <div
                        className="
                            relative block h-[70vh] w-full max-w-full min-w-0
                            overflow-x-scroll overflow-y-auto
                            overscroll-contain rounded-b-2xl
                            scrollbar-thin scrollbar-thumb-slate-500 scrollbar-track-slate-900
                        "
                        style={{
                            WebkitOverflowScrolling: 'touch',
                        }}
                    >
                        <div
                            className="relative block"
                            style={{
                                width: `${ganttWidth}px`,
                                minWidth: `${ganttWidth}px`,
                                maxWidth: 'none',
                            }}
                        >

                            ถ้าใช้ Ta
                            <div className="sticky top-0 z-50 bg-white dark:bg-slate-900">

                                <div
                                    className="grid border-b border-slate-200 dark:border-slate-800"
                                    style={{
                                        gridTemplateColumns,
                                    }}
                                >
                                    <div
                                        className="
                                            sticky left-0 z-[60]
                                            w-[280px] max-w-[280px]
                                            overflow-hidden bg-slate-900 p-3
                                            text-sm font-semibold text-white
                                            dark:bg-slate-950
                                        "
                                    >
                                        Timeline
                                    </div>

                                    {timeline.groups.map((group) => (
                                        <div
                                            key={group.key}
                                            className="
                                                border-l border-slate-200 bg-slate-800
                                                px-3 py-2 text-center text-xs
                                                font-semibold text-white
                                                dark:border-slate-700 dark:bg-slate-950
                                            "
                                            style={{
                                                gridColumn: `${group.startIndex + 2} / ${group.endIndex + 3}`,
                                                gridRow: 1,
                                            }}
                                        >
                                            {group.label}
                                        </div>
                                    ))}
                                </div>

                                <div
                                    className="grid border-b border-slate-200 dark:border-slate-800"
                                    style={{
                                        gridTemplateColumns,
                                    }}
                                >
                                    <div
                                        className="
                                            sticky left-0 z-[60]
                                            w-[280px] max-w-[280px]
                                            overflow-hidden bg-white p-3
                                            text-sm font-semibold
                                            dark:bg-slate-900
                                        "
                                    >
                                        โปรเจกต์ / งาน
                                    </div>

                                    {timeline.units.map((unit, index) => (
                                        <div
                                            key={index}
                                            className={`
                                                min-h-[46px] border-l border-slate-100
                                                p-1 text-center text-[11px]
                                                dark:border-slate-800
                                                ${unit.isWeekend
                                                    ? 'bg-slate-50 dark:bg-slate-950'
                                                    : ''
                                                }
                                                ${todayIndex === index
                                                    ? 'bg-sky-50 text-sky-600 dark:bg-sky-950'
                                                    : 'text-slate-500'
                                                }
                                            `}
                                        >
                                            <div className="font-medium">
                                                {unit.label}
                                            </div>

                                            {unit.subLabel && (
                                                <div className="text-[10px]">
                                                    {unit.subLabel}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                            </div>

                            <div>
                                {projects.map((project) => {
                                    const projectTasks =
                                        taskMapByProject[
                                        project.project_id
                                        ] || []

                                    const isExpanded =
                                        Boolean(
                                            expandedProjectIds[
                                            project.project_id
                                            ]
                                        )

                                    const visibleTasks =
                                        isExpanded
                                            ? projectTasks
                                            : projectTasks.slice(
                                                0,
                                                PROJECT_TASK_PREVIEW_LIMIT
                                            )

                                    const hiddenTaskCount =
                                        Math.max(
                                            projectTasks.length -
                                            PROJECT_TASK_PREVIEW_LIMIT,
                                            0
                                        )

                                    return (
                                        <div
                                            key={project.project_id}
                                            className="border-b border-slate-200 dark:border-slate-800"
                                        >
                                            <div
                                                className="grid min-h-[82px] items-center"
                                                style={{
                                                    gridTemplateColumns,
                                                }}
                                            >
                                                <div
                                                    className="
                                                        sticky left-0 z-30 h-full
                                                        w-[280px] max-w-[280px]
                                                        overflow-hidden bg-white p-3
                                                        dark:bg-slate-900
                                                    "
                                                >
                                                    <Link
                                                        href={`/dashboard/project/${project.project_id}`}
                                                        className="
                                                            block truncate font-semibold
                                                            text-slate-900 hover:text-sky-500
                                                            dark:text-white
                                                        "
                                                    >
                                                        {project.project_name}
                                                    </Link>

                                                    <p className="truncate text-xs text-slate-500">
                                                        {project.project_code}
                                                    </p>

                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${getProjectStatusClass(project.status)}`}>
                                                            {projectStatusLabel[project.status]}
                                                        </span>

                                                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-500 dark:bg-slate-800">
                                                            {project.task_count || 0} งาน
                                                        </span>
                                                    </div>
                                                </div>

                                                {timeline.units.map((unit, index) => (
                                                    <div
                                                        key={index}
                                                        className={`
                                                            h-full border-l border-slate-100
                                                            dark:border-slate-800
                                                            ${unit.isWeekend
                                                                ? 'bg-slate-50 dark:bg-slate-950'
                                                                : ''
                                                            }
                                                            ${todayIndex === index
                                                                ? 'bg-sky-50 dark:bg-sky-950'
                                                                : ''
                                                            }
                                                        `}
                                                        style={{
                                                            gridColumn:
                                                                index + 2,
                                                            gridRow: 1,
                                                        }}
                                                    />
                                                ))}

                                                <div
                                                    className="
                                                        z-10 mx-1 h-8 overflow-hidden rounded-full
                                                        px-3 text-xs font-medium text-white shadow-sm
                                                    "
                                                    style={{
                                                        ...getBarStyle({
                                                            startDate: project.start_date,
                                                            endDate: project.end_date,
                                                        }),
                                                        backgroundColor: getProjectBarColor(project.status),
                                                    }}
                                                >
                                                    <div className="flex h-full items-center truncate">
                                                        {formatDate(project.start_date)} - {formatDate(project.end_date)}
                                                    </div>
                                                </div>
                                            </div>

                                            {visibleTasks.map((task) => (
                                                <div
                                                    key={task.task_id}
                                                    className="grid min-h-[60px] items-center bg-slate-50/70 dark:bg-slate-950/30"
                                                    style={{
                                                        gridTemplateColumns,
                                                    }}
                                                >
                                                    <div
                                                        className="
                                                            sticky left-0 z-30 h-full
                                                            w-[280px] max-w-[280px]
                                                            overflow-hidden bg-slate-50 p-3 pl-7
                                                            dark:bg-slate-950
                                                        "
                                                    >
                                                        <Link
                                                            href={`/dashboard/task/${task.task_id}`}
                                                            className="block truncate text-sm font-medium hover:text-sky-500"
                                                        >
                                                            {task.task_name}
                                                        </Link>

                                                        <div className="mt-1 flex flex-wrap gap-2 items-center">
                                                            <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${getPriorityClass(task.priority)}`}>
                                                                {priorityLabel[normalizeValue(task.priority)] || task.priority}
                                                            </span>

                                                            <span className="text-[11px] text-slate-500">
                                                                {taskStatusLabel[normalizeValue(task.status)] || task.status}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {timeline.units.map((unit, index) => (
                                                        <div
                                                            key={index}
                                                            className={`
                                                                h-full border-l border-slate-100
                                                                dark:border-slate-800
                                                                ${unit.isWeekend
                                                                    ? 'bg-slate-100/60 dark:bg-slate-900'
                                                                    : ''
                                                                }
                                                                ${todayIndex === index
                                                                    ? 'bg-sky-50 dark:bg-sky-950'
                                                                    : ''
                                                                }
                                                            `}
                                                            style={{
                                                                gridColumn:
                                                                    index + 2,
                                                                gridRow: 1,
                                                            }}
                                                        />
                                                    ))}

                                                    <div
                                                        className="
                                                            z-10 mx-1 h-7 overflow-hidden rounded-full
                                                            px-3 text-[11px] font-medium text-white shadow-sm
                                                        "
                                                        style={{
                                                            ...getBarStyle({
                                                                startDate:
                                                                    task.start_date ||
                                                                    project.start_date,
                                                                endDate:
                                                                    task.due_date ||
                                                                    task.completed_at ||
                                                                    task.start_date ||
                                                                    project.end_date,
                                                            }),
                                                            backgroundColor: getTaskBarColor(task.status),
                                                        }}
                                                        title={
                                                            task.assignee_names ||
                                                            ''
                                                        }
                                                    >
                                                        <div className="flex h-full items-center truncate ">
                                                            {formatDate(task.start_date || project.start_date)}
                                                            {' '}
                                                            -
                                                            {' '}
                                                            {formatDate(task.due_date || task.completed_at)}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            {hiddenTaskCount > 0 && (
                                                <div
                                                    className="grid min-h-[48px] items-center bg-slate-50/70 dark:bg-slate-950/30"
                                                    style={{
                                                        gridTemplateColumns,
                                                    }}
                                                >
                                                    <div
                                                        className="
                                                            sticky left-0 z-30 h-full
                                                            w-[280px] max-w-[280px]
                                                            overflow-hidden bg-slate-50 p-3 pl-7
                                                            dark:bg-slate-950
                                                        "
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                toggleProjectExpanded(
                                                                    project.project_id
                                                                )
                                                            }
                                                            className="text-sm font-medium text-sky-500 hover:text-sky-400"
                                                        >
                                                            {isExpanded
                                                                ? 'ซ่อนงาน'
                                                                : `แสดงอีก ${hiddenTaskCount} งาน`}
                                                        </button>
                                                    </div>

                                                    <div
                                                        className="text-sm text-slate-500"
                                                        style={{
                                                            gridColumn: `2 / ${timeline.units.length + 2}`,
                                                            gridRow: 1,
                                                        }}
                                                    >
                                                        {isExpanded
                                                            ? 'แสดงงานทั้งหมดในโปรเจกต์นี้'
                                                            : `มีงานทั้งหมด ${projectTasks.length} งาน`}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}