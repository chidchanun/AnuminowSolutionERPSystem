'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
    FiActivity,
    FiChevronDown,
    FiChevronLeft,
    FiChevronRight,
    FiFilter,
    FiRefreshCw,
    FiSearch,
} from 'react-icons/fi'

const actionOptions = [
    {
        value: 'all',
        label: 'ทั้งหมด',
    },
    {
        value: 'create',
        label: 'สร้าง',
    },
    {
        value: 'update',
        label: 'แก้ไข',
    },
    {
        value: 'assign',
        label: 'มอบหมาย',
    },
    {
        value: 'unassign',
        label: 'ยกเลิกมอบหมาย',
    },
    {
        value: 'status_change',
        label: 'เปลี่ยนสถานะ',
    },
    {
        value: 'comment',
        label: 'Comment',
    },
    {
        value: 'delete',
        label: 'ลบ',
    },
]


function getActionLabel(actionType) {
    switch (actionType) {
        case 'create':
            return 'สร้าง'
        case 'update':
            return 'แก้ไข'
        case 'assign':
            return 'มอบหมาย'
        case 'unassign':
            return 'ยกเลิกมอบหมาย'
        case 'status_change':
            return 'เปลี่ยนสถานะ'
        case 'comment':
            return 'Comment'
        case 'delete':
            return 'ลบ'
        default:
            return actionType || '-'
    }
}

function getActionClass(actionType) {
    switch (actionType) {
        case 'create':
            return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
        case 'update':
            return 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
        case 'assign':
            return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
        case 'unassign':
            return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
        case 'status_change':
            return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
        case 'comment':
            return 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
        case 'delete':
            return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
        default:
            return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    }
}

function formatDateTime(value) {
    if (!value) return '-'

    return new Date(value).toLocaleString('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
    })
}

function getInitial(name) {
    return name?.trim()?.charAt(0) || '?'
}

function UserAvatar({
    src,
    name,
}) {
    return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {src ? (
                <Image
                    src={src}
                    alt={name || 'user'}
                    width={40}
                    height={40}
                    className="h-full w-full object-cover"
                />
            ) : (
                getInitial(name)
            )}
        </div>
    )
}

function buildActivityText(activity) {
    if (activity.description) {
        return activity.description
    }

    if (activity.action_type === 'status_change') {
        return `เปลี่ยนสถานะจาก ${activity.old_value || '-'} เป็น ${activity.new_value || '-'}`
    }

    if (activity.action_type === 'assign') {
        return `มอบหมายงานให้ ${activity.new_value || '-'}`
    }

    if (activity.action_type === 'unassign') {
        return `ยกเลิกการมอบหมายจาก ${activity.old_value || '-'}`
    }

    return getActionLabel(activity.action_type)
}

function SearchableSelect({
    label,
    value,
    onChange,
    options = [],
    placeholder = 'เลือกข้อมูล',
}) {
    const [open, setOpen] = useState(false)
    const [keyword, setKeyword] = useState('')

    const selected =
        options.find((item) => String(item.value) === String(value))

    const filteredOptions = useMemo(() => {
        const q = keyword.trim().toLowerCase()

        if (!q) return options

        return options.filter((item) =>
            item.label.toLowerCase().includes(q)
        )
    }, [options, keyword])

    return (
        <div className="relative">
            <label className="mb-2 block text-sm font-medium">
                {label}
            </label>

            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="
                    flex w-full items-center justify-between gap-3
                    rounded-2xl border border-slate-300 bg-white
                    px-4 py-3 text-left text-sm
                    dark:border-slate-700 dark:bg-slate-950
                "
            >
                <span className={selected ? '' : 'text-slate-400'}>
                    {selected ? selected.label : placeholder}
                </span>

                <span className="text-slate-400">
                    ▼
                </span>
            </button>

            {open && (
                <div className="absolute z-40 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                    <input
                        type="text"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="พิมพ์เพื่อค้นหา..."
                        className="
                            mb-2 w-full rounded-xl border border-slate-300
                            bg-white px-3 py-2 text-sm outline-none
                            focus:border-sky-500
                            dark:border-slate-700 dark:bg-slate-950
                        "
                    />

                    <button
                        type="button"
                        onClick={() => {
                            onChange('')
                            setKeyword('')
                            setOpen(false)
                        }}
                        className="
                            mb-1 w-full rounded-xl px-3 py-2 text-left text-sm
                            text-slate-500 hover:bg-slate-100
                            dark:hover:bg-slate-800
                        "
                    >
                        ทั้งหมด
                    </button>

                    <div className="max-h-56 overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-3 text-sm text-slate-500">
                                ไม่พบข้อมูล
                            </div>
                        ) : (
                            filteredOptions.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(item.value)
                                        setKeyword('')
                                        setOpen(false)
                                    }}
                                    className={`
                                        w-full rounded-xl px-3 py-2 text-left text-sm
                                        hover:bg-slate-100 dark:hover:bg-slate-800
                                        ${String(value) === String(item.value)
                                            ? 'bg-sky-50 text-sky-600 dark:bg-sky-950'
                                            : ''
                                        }
                                    `}
                                >
                                    {item.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

async function requestActivities(filters, signal) {
    const params =
        new URLSearchParams()

    Object.entries(filters).forEach(([key, value]) => {
        if (
            value !== undefined &&
            value !== null &&
            value !== ''
        ) {
            params.set(key, value)
        }
    })

    const res = await fetch(
        `/api/v1/activity?${params.toString()}`,
        {
            cache: 'no-store',
            signal,
        }
    )

    const data = await res.json()

    if (!res.ok) {
        throw new Error(
            data.error_detail ||
            data.message ||
            'โหลด Activity Log ไม่สำเร็จ'
        )
    }

    return data
}

export default function ActivityPage() {
    const [filters, setFilters] = useState({
        action_type: 'all',
        project_id: '',
        task_id: '',
        action_by: '',
        from: '',
        to: '',
        page: 1,
        limit: 10,
    })

    const [draftFilters, setDraftFilters] = useState(filters)

    const [activities, setActivities] = useState([])
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        total_pages: 1,
    })

    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState('')

    const [filterOptions, setFilterOptions] = useState({
        projects: [],
        tasks: [],
        users: [],
    })

    const loadActivities = async ({
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

            const data =
                await requestActivities(nextFilters, signal)

            setActivities(data.activities || [])
            setPagination(
                data.pagination || {
                    page: 1,
                    limit: 10,
                    total: 0,
                    total_pages: 1,
                }
            )
            setError('')
        } catch (error) {
            if (error.name === 'AbortError') return

            console.error(error)
            setError(error.message)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => {
        let ignore = false
        const controller = new AbortController()

        fetch('/api/v1/activity/filter-options', {
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(async (res) => {
                const data = await res.json()

                if (!res.ok) {
                    throw new Error(
                        data.message ||
                        'โหลดตัวเลือกตัวกรองไม่สำเร็จ'
                    )
                }

                return data
            })
            .then((data) => {
                if (ignore) return

                setFilterOptions({
                    projects:
                        data.projects?.map((project) => ({
                            value: String(project.project_id),
                            label: `${project.project_name} (${project.project_code || project.project_id})`,
                        })) || [],
                    tasks:
                        data.tasks?.map((task) => ({
                            value: String(task.task_id),
                            label: `#${task.task_id} ${task.task_name} · ${task.project_name}`,
                        })) || [],
                    users:
                        data.users?.map((user) => ({
                            value: String(user.id),
                            label: `${user.full_name} · ${user.role_name || '-'} · ${user.department_name || '-'}`,
                        })) || [],
                })
            })
            .catch((error) => {
                if (
                    ignore ||
                    error.name === 'AbortError'
                ) {
                    return
                }

                console.error(error)
            })

        return () => {
            ignore = true
            controller.abort()
        }
    }, [])

    useEffect(() => {
        let ignore = false
        const controller = new AbortController()

        requestActivities(filters, controller.signal)
            .then((data) => {
                if (ignore) return

                setActivities(data.activities || [])
                setPagination(
                    data.pagination || {
                        page: 1,
                        limit: 10,
                        total: 0,
                        total_pages: 1,
                    }
                )
                setError('')
            })
            .catch((error) => {
                if (
                    ignore ||
                    error.name === 'AbortError'
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
    }, [filters])

    const applyFilter = () => {
        setFilters({
            ...draftFilters,
            page: 1,
        })
    }

    const clearFilter = () => {
        const empty = {
            action_type: 'all',
            project_id: '',
            task_id: '',
            action_by: '',
            from: '',
            to: '',
            page: 1,
            limit: 10,
        }

        setDraftFilters(empty)
        setFilters(empty)
    }

    const goToPage = (page) => {
        setFilters((prev) => ({
            ...prev,
            page,
        }))

        setDraftFilters((prev) => ({
            ...prev,
            page,
        }))
    }

    const activeFilterCount = useMemo(() => {
        return [
            draftFilters.action_type !== 'all',
            draftFilters.project_id,
            draftFilters.task_id,
            draftFilters.action_by,
            draftFilters.from,
            draftFilters.to,
        ].filter(Boolean).length
    }, [draftFilters])

    const getExportUrl = (type) => {
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

        return `/api/v1/activity/export/${type}?${params.toString()}`
    }

    return (
        <main className="min-h-screen bg-slate-50 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <div className="space-y-6">

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">
                            Activity Log
                        </h1>

                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            ประวัติการทำงานทั้งหมดในระบบ
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <a
                            href={getExportUrl('excel')}
                            className="
                                inline-flex items-center justify-center
                                rounded-2xl bg-green-500 px-4 py-2
                                text-sm font-medium text-white hover:bg-green-600
                            "
                        >
                            Export Excel
                        </a>

                        <a
                            href={getExportUrl('pdf')}
                            className="
                                inline-flex items-center justify-center
                                rounded-2xl bg-red-500 px-4 py-2
                                text-sm font-medium text-white hover:bg-red-600
                            "
                        >
                            Export PDF
                        </a>

                        <button
                            type="button"
                            onClick={() =>
                                loadActivities({
                                    nextFilters: filters,
                                    refresh: true,
                                })
                            }
                            disabled={refreshing}
                            className="
                                inline-flex items-center justify-center gap-2
                                rounded-2xl border border-slate-300 px-4 py-2
                                text-sm hover:bg-slate-100 disabled:opacity-60
                                dark:border-slate-700 dark:hover:bg-slate-800
                            "
                        >
                            <FiRefreshCw
                                className={refreshing ? 'animate-spin' : ''}
                            />
                            รีเฟรช
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                        {error}
                    </div>
                )}

                <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                    <div className="mb-5 flex items-center gap-2">
                        <FiFilter className="text-sky-500" />

                        <h2 className="font-semibold">
                            ตัวกรอง
                        </h2>

                        {activeFilterCount > 0 && (
                            <span className="rounded-full bg-sky-100 px-2 py-1 text-xs text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                                {activeFilterCount}
                            </span>
                        )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Action
                            </label>

                            <div className="relative">
                                <select
                                    value={draftFilters.action_type}
                                    onChange={(e) =>
                                        setDraftFilters((prev) => ({
                                            ...prev,
                                            action_type: e.target.value,
                                        }))
                                    }
                                    className="
                                        w-full appearance-none rounded-2xl
                                        border border-slate-300 bg-white
                                        px-4 py-3 pr-12 text-sm
                                        dark:border-slate-700 dark:bg-slate-950
                                    "
                                >
                                    {actionOptions.map((item) => (
                                        <option
                                            key={item.value}
                                            value={item.value}
                                        >
                                            {item.label}
                                        </option>
                                    ))}
                                </select>

                                <FiChevronDown
                                    className="
                                        pointer-events-none absolute right-4 top-1/2
                                        -translate-y-1/2 text-slate-400
                                    "
                                />
                            </div>
                        </div>

                        <SearchableSelect
                            label="Project"
                            value={draftFilters.project_id}
                            onChange={(value) =>
                                setDraftFilters((prev) => ({
                                    ...prev,
                                    project_id: value,
                                }))
                            }
                            options={filterOptions.projects}
                            placeholder="เลือก Project"
                        />

                        <SearchableSelect
                            label="Task"
                            value={draftFilters.task_id}
                            onChange={(value) =>
                                setDraftFilters((prev) => ({
                                    ...prev,
                                    task_id: value,
                                }))
                            }
                            options={filterOptions.tasks}
                            placeholder="เลือก Task"
                        />

                        <SearchableSelect
                            label="User"
                            value={draftFilters.action_by}
                            onChange={(value) =>
                                setDraftFilters((prev) => ({
                                    ...prev,
                                    action_by: value,
                                }))
                            }
                            options={filterOptions.users}
                            placeholder="เลือก User"
                        />

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                From
                            </label>

                            <input
                                type="date"
                                value={draftFilters.from}
                                onChange={(e) =>
                                    setDraftFilters((prev) => ({
                                        ...prev,
                                        from: e.target.value,
                                    }))
                                }
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                To
                            </label>

                            <input
                                type="date"
                                value={draftFilters.to}
                                onChange={(e) =>
                                    setDraftFilters((prev) => ({
                                        ...prev,
                                        to: e.target.value,
                                    }))
                                }
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                        </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={clearFilter}
                            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                            ล้างตัวกรอง
                        </button>

                        <button
                            type="button"
                            onClick={applyFilter}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-2 text-sm text-white hover:bg-sky-600"
                        >
                            <FiSearch />
                            ค้นหา
                        </button>
                    </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="font-semibold">
                                รายการ Activity
                            </h2>

                            <p className="text-sm text-slate-500">
                                ทั้งหมด {pagination.total} รายการ
                            </p>
                        </div>

                        <FiActivity className="text-slate-400" />
                    </div>

                    {loading ? (
                        <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500 dark:bg-slate-950">
                            กำลังโหลด Activity Log...
                        </div>
                    ) : activities.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
                            ไม่พบ Activity Log
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {activities.map((activity) => (
                                <article
                                    key={activity.history_id}
                                    className="rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                                >
                                    <div className="flex gap-4">
                                        <UserAvatar
                                            src={activity.action_by_picture}
                                            name={activity.action_by_name}
                                        />

                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span
                                                            className={`rounded-full px-3 py-1 text-xs font-medium ${getActionClass(activity.action_type)}`}
                                                        >
                                                            {getActionLabel(activity.action_type)}
                                                        </span>

                                                        <span className="text-xs text-slate-500">
                                                            {activity.target_table}.{activity.target_column}
                                                        </span>
                                                    </div>

                                                    <p className="mt-3 font-medium text-slate-900 dark:text-white">
                                                        {buildActivityText(activity)}
                                                    </p>

                                                    <p className="mt-1 text-sm text-slate-500">
                                                        โดย {activity.action_by_name || activity.action_by || '-'}
                                                    </p>
                                                </div>

                                                <p className="shrink-0 text-xs text-slate-400">
                                                    {formatDateTime(activity.created_at)}
                                                </p>
                                            </div>

                                            <div className="mt-4 flex flex-wrap gap-2 text-xs">
                                                <Link
                                                    href={`/dashboard/task/${activity.task_id}`}
                                                    className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 hover:bg-sky-100 hover:text-sky-700 dark:bg-slate-800 dark:text-slate-300"
                                                >
                                                    Task #{activity.task_id}: {activity.task_name || '-'}
                                                </Link>

                                                {activity.project_id && (
                                                    <Link
                                                        href={`/dashboard/project/${activity.project_id}`}
                                                        className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 hover:bg-sky-100 hover:text-sky-700 dark:bg-slate-800 dark:text-slate-300"
                                                    >
                                                        Project: {activity.project_name || '-'}
                                                    </Link>
                                                )}

                                                {activity.old_value && (
                                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-500 dark:bg-slate-800">
                                                        เดิม: {activity.old_value}
                                                    </span>
                                                )}

                                                {activity.new_value && (
                                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-500 dark:bg-slate-800">
                                                        ใหม่: {activity.new_value}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}

                    {!loading && pagination.total > 0 && (
                        <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-slate-500">
                                หน้า {pagination.page} จาก {pagination.total_pages}
                            </p>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={pagination.page <= 1}
                                    onClick={() =>
                                        goToPage(pagination.page - 1)
                                    }
                                    className="
                                        inline-flex items-center gap-2 rounded-xl
                                        border border-slate-300 px-3 py-2 text-sm
                                        disabled:cursor-not-allowed disabled:opacity-50
                                        dark:border-slate-700
                                    "
                                >
                                    <FiChevronLeft />
                                    ก่อนหน้า
                                </button>

                                <button
                                    type="button"
                                    disabled={
                                        pagination.page >=
                                        pagination.total_pages
                                    }
                                    onClick={() =>
                                        goToPage(pagination.page + 1)
                                    }
                                    className="
                                        inline-flex items-center gap-2 rounded-xl
                                        border border-slate-300 px-3 py-2 text-sm
                                        disabled:cursor-not-allowed disabled:opacity-50
                                        dark:border-slate-700
                                    "
                                >
                                    ถัดไป
                                    <FiChevronRight />
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </main>
    )
}