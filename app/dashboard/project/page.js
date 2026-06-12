'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const availableColumns = [
    { id: 'project_code', label: 'รหัสโปรเจ็ก' },
    { id: 'project_name', label: 'ชื่อโปรเจ็ก' },
    { id: 'project_status', label: 'สถานะ' },
    { id: 'project_start_date', label: 'วันเริ่มต้น' },
    { id: 'project_end_date', label: 'วันสิ้นสุด' },
]

export default function ProjectPage() {
    const [projects, setProjects] = useState([])
    const [statusFilter, setStatusFilter] = useState('all')

    const [searchText, setSearchText] = useState('')
    const [selectedColumns, setSelectedColumns] = useState([
        'project_code',
        'project_name',
        'project_status',
        'project_start_date',
        'project_end_date',
    ])

    const fixedColumns = [
        'project_code',
        'project_name',
    ]

    const toggleColumn = (columnId) => {
        setSelectedColumns((prev) => {
            // ปิดคอลัมน์
            if (prev.includes(columnId)) {
                return prev.filter(
                    (id) => id !== columnId
                )
            }

            // เปิดคอลัมน์ใหม่
            const newColumns = [...prev, columnId]

            // เรียงตาม availableColumns เสมอ
            return availableColumns
                .map((column) => column.id)
                .filter((id) =>
                    newColumns.includes(id)
                )
        })
    }

    const filteredProjects = projects.filter((project) => {

        const matchStatus =
            statusFilter === 'all'
                ? true
                : project.status === statusFilter

        const matchSearch =
            project.project_name
                .toLowerCase()
                .includes(searchText.toLowerCase()) ||
            project.project_code
                .toLowerCase()
                .includes(searchText.toLowerCase())

        return matchStatus && matchSearch
    })

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await fetch('/api/v1/project')

                if (!res.ok) return

                const data = await res.json()
                setProjects(data.projects || [])
            } catch (error) {
                console.error(error)
            }
        }

        fetchProjects()
    }, [])


    const totalProjects = projects.length
    console.log(totalProjects)
    const activeProjects = projects.filter(
        (item) => item.status === 'active'
    ).length

    const planningProjects = projects.filter(
        (item) => item.status === 'planning'
    ).length

    const completedProjects = projects.filter(
        (item) => item.status === 'completed'
    ).length

    const cancelledProjects = projects.filter(
        (item) => item.status === 'cancelled'
    ).length

    const getStatusColor = (status) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-700'

            case 'planning':
                return 'bg-blue-100 text-blue-700'

            case 'completed':
                return 'bg-slate-100 text-slate-700'

            case 'cancelled':
                return 'bg-red-100 text-red-700'

            default:
                return 'bg-gray-100 text-gray-700'
        }
    }

    return (
        <div className="flex flex-col gap-6 py-6">

            {/* KPI */}

            <div className="grid gap-4 xl:grid-cols-5">

                <StatCard
                    title="โปรเจกต์ทั้งหมด"
                    value={totalProjects}
                />

                <StatCard
                    title="กำลังดำเนินการ"
                    value={activeProjects}
                />

                <StatCard
                    title="วางแผน"
                    value={planningProjects}
                />

                <StatCard
                    title="เสร็จสิ้น"
                    value={completedProjects}
                />

                <StatCard
                    title="ยกเลิก"
                    value={cancelledProjects}
                />

            </div>

            {/* Header */}

            <div className='flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors gap-4'>
                <div className="flex items-center justify-between">

                    <div className='flex flex-col gap-2'>
                        <h2 className="text-xl font-semibold text-slate-500 dark:text-slate-400">
                            รายการโปรเจกต์
                        </h2>
                        <p className="text-sm text-slate-900 dark:text-slate-100">
                            จัดการโปรเจกต์ทั้งหมดในระบบ
                        </p>
                    </div>

                    <Link
                        href="/dashboard/project/new"
                        className="rounded-xl bg-sky-500 text-white px-4 py-2 hover:bg-sky-400"
                    >
                        สร้างโปรเจกต์
                    </Link>

                </div>


                <div className='grid gap-4 sm:grid-cols-2'>
                    <label className='block text-sm text-slate-500'>
                        ชื่อโปรเจ็ก
                        <div className="relative mt-2">

                            <input
                                type="text"
                                placeholder="ค้นหาโปรเจกต์..."
                                value={searchText}
                                onChange={(e) =>
                                    setSearchText(e.target.value)
                                }
                                className="appearance-none w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 pr-12 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            />

                        </div>
                    </label>
                    <label className='block text-sm text-slate-500'>
                        สถานะโปรเจ็ก
                        <div className='relative mt-2'>
                            <select
                                value={statusFilter}
                                onChange={(e) =>
                                    setStatusFilter(e.target.value)
                                }
                                className="appearance-none w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 pr-12 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
                            </select>
                            <svg
                                className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                        </div>

                    </label>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                        <p className="text-sm text-slate-500">เลือกข้อมูลที่จะแสดง</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {availableColumns.map((column) => (
                                <label
                                    key={column.id}
                                    className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedColumns.includes(column.id)}
                                        onChange={() => toggleColumn(column.id)}
                                        className="h-4 w-4 rounded border-slate-300 text-sky-600"
                                    />
                                    {column.label}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                <div className='w-full h-0.5 bg-slate-300 dark:bg-slate-700 opacity-80'></div>
                <div className="grid gap-4 lg:hidden">
                    {filteredProjects.map((project) => (
                        <div
                            key={project.project_id}
                            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                                        {project.project_name}
                                    </h3>

                                    <p className="text-sm text-slate-500">
                                        {project.project_code}
                                    </p>
                                </div>

                                <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                        project.status
                                    )}`}
                                >
                                    {project.status}
                                </span>
                            </div>

                            {project.description && (
                                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                                    {project.description}
                                </p>
                            )}

                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                {selectedColumns.includes('project_start_date') && (
                                    <div>
                                        <p className="text-slate-500">
                                            วันเริ่มต้น
                                        </p>

                                        <p className="font-medium">
                                            {project.start_date
                                                ? new Date(
                                                    project.start_date
                                                ).toLocaleDateString('th-TH', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                })
                                                : '-'}
                                        </p>
                                    </div>
                                )}

                                {selectedColumns.includes('project_end_date') && (
                                    <div>
                                        <p className="text-slate-500">
                                            วันสิ้นสุด
                                        </p>

                                        <p className="font-medium">
                                            {project.end_date
                                                ? new Date(
                                                    project.end_date
                                                ).toLocaleDateString('th-TH', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                })
                                                : '-'}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <Link
                                href={`/dashboard/project/${project.project_id}`}
                                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-white hover:bg-sky-600"
                            >
                                ดูรายละเอียด
                            </Link>
                        </div>
                    ))}
                </div>
                <div className="hidden lg:block overflow-hidden">

                    <table className="w-full">

                        <thead>
                            <tr>
                                {selectedColumns.map((columnId) => {
                                    const column = availableColumns.find((item) => item.id === columnId)
                                    return (
                                        <th
                                            key={columnId}
                                            className="whitespace-nowrap px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200"
                                        >
                                            {column?.label || columnId}
                                        </th>
                                    )
                                })}
                            </tr>
                        </thead>

                        <tbody>
                            {filteredProjects.map((project) => (
                                <tr
                                    key={project.project_id}
                                    className="border-t border-slate-200 dark:border-slate-800"
                                >
                                    {selectedColumns.includes('project_code') && (
                                        <td className="px-4 py-3">
                                            {project.project_code}
                                        </td>
                                    )}

                                    {selectedColumns.includes('project_name') && (
                                        <td className="px-4 py-3">
                                            <div className="font-medium">
                                                {project.project_name}
                                            </div>

                                            <div className="text-xs text-slate-500">
                                                {project.description}
                                            </div>
                                        </td>
                                    )}

                                    {selectedColumns.includes('project_status') && (
                                        <td className="px-4 py-3">
                                            <span
                                                className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                                    project.status
                                                )}`}
                                            >
                                                {project.status}
                                            </span>
                                        </td>
                                    )}

                                    {selectedColumns.includes('project_start_date') && (
                                        <td className="px-4 py-3">
                                            {project.start_date
                                                ? new Date(
                                                    project.start_date
                                                ).toLocaleDateString('th-TH', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                })
                                                : '-'}
                                        </td>
                                    )}

                                    {selectedColumns.includes('project_end_date') && (
                                        <td className="px-4 py-3">
                                            {project.end_date
                                                ? new Date(
                                                    project.end_date
                                                ).toLocaleDateString('th-TH', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                })
                                                : '-'}
                                        </td>
                                    )}

                                    <td className="px-4 py-3 text-center">
                                        <Link
                                            href={`/dashboard/project/${project.project_id}`}
                                            className="text-sky-600 hover:underline"
                                        >
                                            ดูรายละเอียด
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>

                    </table>

                </div>
            </div>


            {/* Table */}


        </div>

    )
}

function StatCard({
    title,
    value,
}) {
    return (
        <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
            <p className="text-sm text-slate-500 dark:text-slate-400">
                {title}
            </p>

            <p className="mt-4 text-2xl font-semibold text-slate-900 dark:text-slate-100 max-md:text-lg">
                {value}
            </p>
        </article>
    )
}