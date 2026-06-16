'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
    FiChevronDown,
    FiChevronLeft,
    FiChevronRight,
    FiFolder,
    FiRefreshCw,
    FiSearch,
    FiUsers,
} from 'react-icons/fi'

const statusLabel = {
    planning: 'Planning',
    active: 'Active',
    completed: 'Completed',
    cancelled: 'Cancelled',
}

function getStatusClass(status) {
    switch (status) {
        case 'planning':
            return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'

        case 'active':
            return 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'

        case 'completed':
            return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'

        case 'cancelled':
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

function stripHtml(html) {
    if (!html) return '-'

    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || '-'
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

export default function MyProjectPage() {
    const [projects, setProjects] = useState([])

    const [summary, setSummary] = useState({
        total_projects: 0,
        planning_projects: 0,
        active_projects: 0,
        completed_projects: 0,
        cancelled_projects: 0,
    })

    const [searchText, setSearchText] = useState('')

    const [filters, setFilters] = useState({
        q: '',
        status: 'all',
        sort: 'updated',
    })

    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        total_pages: 1,
    })

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const queryString = useMemo(() => {
        return new URLSearchParams({
            page: String(pagination.page),
            limit: String(pagination.limit),
            q: filters.q,
            status: filters.status,
            sort: filters.sort,
        }).toString()
    }, [
        pagination.page,
        pagination.limit,
        filters.q,
        filters.status,
        filters.sort,
    ])

    useEffect(() => {
        let ignore = false
        const controller = new AbortController()

        async function loadProjects() {
            try {
                const res = await fetch(
                    `/api/v1/project/my-project?${queryString}`,
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
                        'โหลดโปรเจกต์ของฉันไม่สำเร็จ'
                    )
                }

                if (ignore) return

                setProjects(data.projects || [])
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

        loadProjects()

        return () => {
            ignore = true
            controller.abort()
        }
    }, [queryString])

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

    const resetFilters = () => {
        setLoading(true)
        setSearchText('')

        setFilters({
            q: '',
            status: 'all',
            sort: 'updated',
        })

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
        <div className="flex flex-col gap-6 py-6">

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    โปรเจกต์ของฉัน
                </h1>

                <p className="text-sm text-slate-500 dark:text-slate-400">
                    แสดงโปรเจกต์ที่คุณสร้างหรือเป็นสมาชิกในโปรเจกต์
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-sm text-slate-500">
                        ทั้งหมด
                    </p>

                    <p className="mt-3 text-2xl font-semibold">
                        {summary.total_projects || 0}
                    </p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-sm text-slate-500">
                        Planning
                    </p>

                    <p className="mt-3 text-2xl font-semibold">
                        {summary.planning_projects || 0}
                    </p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-sm text-slate-500">
                        Active
                    </p>

                    <p className="mt-3 text-2xl font-semibold">
                        {summary.active_projects || 0}
                    </p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-sm text-slate-500">
                        Completed
                    </p>

                    <p className="mt-3 text-2xl font-semibold">
                        {summary.completed_projects || 0}
                    </p>
                </article>

                <article className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm dark:border-red-900 dark:bg-slate-900">
                    <p className="text-sm text-red-500">
                        Cancelled
                    </p>

                    <p className="mt-3 text-2xl font-semibold text-red-500">
                        {summary.cancelled_projects || 0}
                    </p>
                </article>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <form
                    onSubmit={handleSearchSubmit}
                    className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5"
                >
                    <div className="relative xl:col-span-2">
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                        <input
                            type="text"
                            value={searchText}
                            onChange={(e) =>
                                setSearchText(e.target.value)
                            }
                            placeholder="ค้นหาโปรเจกต์ / รหัสโปรเจกต์"
                            className="
                                w-full rounded-xl border border-slate-300
                                bg-white px-10 py-2 text-sm
                                dark:border-slate-700 dark:bg-slate-950
                            "
                        />
                    </div>

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

                        <option value="start_asc">
                            วันเริ่มต้นใกล้สุด
                        </option>

                        <option value="end_asc">
                            วันสิ้นสุดใกล้สุด
                        </option>

                        <option value="name">
                            เรียงตามชื่อ
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

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">

                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">
                            รายการโปรเจกต์ของฉัน
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
                        <div className="rounded-xl border border-slate-200 p-4 text-center text-sm text-slate-500 dark:border-slate-800">
                            กำลังโหลดโปรเจกต์...
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 p-4 text-center text-sm text-slate-500 dark:border-slate-800">
                            ไม่พบโปรเจกต์
                        </div>
                    ) : (
                        projects.map((project) => (
                            <Link
                                key={project.project_id}
                                href={`/dashboard/project/${project.project_id}`}
                                className="
                                    block rounded-2xl border border-slate-200
                                    bg-slate-50 p-4 shadow-sm
                                    dark:border-slate-800 dark:bg-slate-800
                                "
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h3 className="truncate font-semibold text-slate-900 dark:text-white">
                                            {project.project_name}
                                        </h3>

                                        <p className="mt-1 text-xs text-slate-500">
                                            {project.project_code}
                                        </p>
                                    </div>

                                    <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${getStatusClass(project.status)}`}>
                                        {statusLabel[project.status]}
                                    </span>
                                </div>

                                <p className="mt-3 line-clamp-2 text-sm text-slate-500">
                                    {stripHtml(project.description)}
                                </p>

                                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="text-xs text-slate-500">
                                            เริ่มต้น
                                        </p>

                                        <p>
                                            {formatDate(project.start_date)}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-slate-500">
                                            สิ้นสุด
                                        </p>

                                        <p>
                                            {formatDate(project.end_date)}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 dark:bg-slate-900">
                                        <FiUsers />
                                        {project.member_count || 0} สมาชิก
                                    </span>

                                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 dark:bg-slate-900">
                                        <FiFolder />
                                        {project.task_count || 0} งาน
                                    </span>

                                    {Number(project.is_owner) === 1 && (
                                        <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-600 dark:bg-sky-950">
                                            เจ้าของ
                                        </span>
                                    )}

                                    {Number(project.is_member) === 1 && (
                                        <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                            สมาชิก
                                        </span>
                                    )}
                                </div>
                            </Link>
                        ))
                    )}
                </div>

                <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[1000px]">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800">
                                <th className="py-3 text-left">
                                    โปรเจกต์
                                </th>

                                <th className="py-3 text-left">
                                    สถานะ
                                </th>

                                <th className="py-3 text-left">
                                    วันที่
                                </th>

                                <th className="py-3 text-left">
                                    สมาชิก
                                </th>

                                <th className="py-3 text-left">
                                    งาน
                                </th>

                                <th className="py-3 text-left">
                                    ผู้สร้าง
                                </th>

                                <th className="py-3 text-left">
                                    บทบาท
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="py-8 text-center text-slate-500"
                                    >
                                        กำลังโหลดโปรเจกต์...
                                    </td>
                                </tr>
                            ) : projects.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="py-8 text-center text-slate-500"
                                    >
                                        ไม่พบโปรเจกต์
                                    </td>
                                </tr>
                            ) : (
                                projects.map((project) => (
                                    <tr
                                        key={project.project_id}
                                        className="border-b border-slate-100 dark:border-slate-800"
                                    >
                                        <td className="py-4">
                                            <Link
                                                href={`/dashboard/project/${project.project_id}`}
                                                className="font-medium text-slate-900 hover:text-sky-500 dark:text-white"
                                            >
                                                {project.project_name}
                                            </Link>

                                            <p className="mt-1 text-xs text-slate-500">
                                                {project.project_code}
                                            </p>

                                            <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                                                {stripHtml(project.description)}
                                            </p>
                                        </td>

                                        <td>
                                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(project.status)}`}>
                                                {statusLabel[project.status]}
                                            </span>
                                        </td>

                                        <td>
                                            <p className="text-sm">
                                                {formatDate(project.start_date)}
                                            </p>

                                            <p className="text-xs text-slate-500">
                                                ถึง {formatDate(project.end_date)}
                                            </p>
                                        </td>

                                        <td>
                                            {project.member_count || 0} คน
                                        </td>

                                        <td>
                                            <p>
                                                {project.task_count || 0} งาน
                                            </p>

                                            <p className="text-xs text-slate-500">
                                                เสร็จ {project.done_task_count || 0}
                                            </p>
                                        </td>

                                        <td>
                                            {project.created_by_name}
                                        </td>

                                        <td>
                                            <div className="flex flex-wrap gap-2">
                                                {Number(project.is_owner) === 1 && (
                                                    <span className="rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-600 dark:bg-sky-950">
                                                        เจ้าของ
                                                    </span>
                                                )}

                                                {Number(project.is_member) === 1 && (
                                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                        สมาชิก
                                                    </span>
                                                )}
                                            </div>
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