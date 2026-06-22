'use client'

import { useEffect, useMemo, useState } from 'react'
import {
    FiCalendar,
    FiCheck,
    FiChevronDown,
    FiClock,
    FiRefreshCw,
    FiSave,
    FiSearch,
} from 'react-icons/fi'

const statusOptions = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'present', label: 'มาทำงาน' },
    { value: 'late', label: 'มาสาย' },
    { value: 'absent', label: 'ขาดงาน' },
    { value: 'leave', label: 'ลา' },
]

const attendanceStatusOptions = [
    { value: 'present', label: 'มาทำงาน' },
    { value: 'late', label: 'มาสาย' },
    { value: 'absent', label: 'ขาดงาน' },
    { value: 'leave', label: 'ลา' },
]

function getTodayInputDate() {
    return new Date().toISOString().slice(0, 10)
}

function getStatusLabel(status) {
    switch (status) {
        case 'present':
            return 'มาทำงาน'
        case 'late':
            return 'มาสาย'
        case 'absent':
            return 'ขาดงาน'
        case 'leave':
            return 'ลา'
        default:
            return status || '-'
    }
}

function getStatusClass(status) {
    switch (status) {
        case 'present':
            return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
        case 'late':
            return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
        case 'absent':
            return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
        case 'leave':
            return 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
        default:
            return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    }
}

function formatTimeInput(value) {
    if (!value) return ''

    const text = String(value)

    // ถ้า API ส่งมาเป็น HH:mm อยู่แล้ว
    if (/^\d{2}:\d{2}$/.test(text)) {
        return text
    }

    // ถ้าเป็น MySQL DATETIME แบบ 2026-06-22 08:30:00
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text)) {
        return text.slice(11, 16)
    }

    // ถ้าเป็น ISO UTC ให้แปลงกลับเป็นเวลาไทย
    const date = new Date(text)

    if (Number.isNaN(date.getTime())) {
        return ''
    }

    return date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Bangkok',
    })
}

function buildDateTime(date, time) {
    if (!date || !time) return null

    return `${date} ${time}:00`
}

function getInitial(name) {
    return name?.trim()?.charAt(0) || '?'
}

async function requestAttendance(filters, signal) {
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

    const res = await fetch(`/api/v1/attendance?${params.toString()}`, {
        cache: 'no-store',
        signal,
    })

    const data = await res.json()

    if (!res.ok) {
        throw new Error(
            data.error_detail ||
            data.message ||
            'โหลดข้อมูล Attendance ไม่สำเร็จ'
        )
    }

    return data
}

function normalizeAttendanceRows(rows = []) {
    return rows.map((row) => ({
        ...row,
        check_in_time:
            row.check_in_time ||
            formatTimeInput(row.check_in),
        check_out_time:
            row.check_out_time ||
            formatTimeInput(row.check_out),
        note: row.note || '',
        saving: false,
    }))
}

function SelectWithArrow({
    value,
    onChange,
    disabled = false,
    children,
    className = '',
}) {
    return (
        <div className="relative w-full">
            <select
                value={value}
                onChange={onChange}
                disabled={disabled}
                className={`
                    w-full appearance-none rounded-2xl
                    border border-slate-300 bg-white
                    px-4 py-3 pr-12 text-sm
                    outline-none transition
                    focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20
                    disabled:cursor-not-allowed disabled:opacity-60
                    dark:border-slate-700 dark:bg-slate-950
                    ${className}
                `}
            >
                {children}
            </select>

            <FiChevronDown
                className="
                    pointer-events-none absolute right-4 top-1/2
                    -translate-y-1/2 text-slate-400
                "
            />
        </div>
    )
}

export default function AttendancePage() {
    const [filters, setFilters] = useState({
        date: getTodayInputDate(),
        department_id: '',
        role_id: '',
        status: 'all',
    })

    const [draftFilters, setDraftFilters] = useState(filters)

    const [departments, setDepartments] = useState([])
    const [roles, setRoles] = useState([])

    const [summary, setSummary] = useState({
        present: 0,
        late: 0,
        absent: 0,
        leave: 0,
    })

    const [attendanceRows, setAttendanceRows] = useState([])
    const [permission, setPermission] = useState({
        can_manage: false,
    })

    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState('')

    const filteredRoles = useMemo(() => {
        if (!draftFilters.department_id) return roles

        return roles.filter(
            (role) =>
                String(role.department_id) ===
                String(draftFilters.department_id)
        )
    }, [roles, draftFilters.department_id])

    const summaryCards = [
        {
            label: 'มาทำงาน',
            value: summary.present,
            status: 'present',
        },
        {
            label: 'มาสาย',
            value: summary.late,
            status: 'late',
        },
        {
            label: 'ขาดงาน',
            value: summary.absent,
            status: 'absent',
        },
        {
            label: 'ลา',
            value: summary.leave,
            status: 'leave',
        },
    ]

    useEffect(() => {
        let ignore = false
        const controller = new AbortController()

        Promise.all([
            fetch('/api/v1/department', {
                cache: 'no-store',
                signal: controller.signal,
            }).then((res) => res.json()),
            fetch('/api/v1/role', {
                cache: 'no-store',
                signal: controller.signal,
            }).then((res) => res.json()),
        ])
            .then(([departmentData, roleData]) => {
                if (ignore) return

                setDepartments(
                    Array.isArray(departmentData)
                        ? departmentData
                        : departmentData.departments || []
                )

                setRoles(
                    Array.isArray(roleData)
                        ? roleData
                        : roleData.roles || []
                )
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

        requestAttendance(filters, controller.signal)
            .then((data) => {
                if (ignore) return

                setSummary(
                    data.summary || {
                        present: 0,
                        late: 0,
                        absent: 0,
                        leave: 0,
                    }
                )

                setAttendanceRows(
                    normalizeAttendanceRows(
                        data.daily_attendance || data.attendance || []
                    )
                )

                setPermission(data.permission || {})
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
                    setRefreshing(false)
                }
            })

        return () => {
            ignore = true
            controller.abort()
        }
    }, [filters])

    const applyFilter = () => {
        setLoading(true)
        setFilters({
            ...draftFilters,
        })
    }

    const refreshAttendance = () => {
        setRefreshing(true)
        setFilters((prev) => ({
            ...prev,
        }))
    }

    const updateRow = (userId, field, value) => {
        setAttendanceRows((prev) =>
            prev.map((row) =>
                String(row.user_id) === String(userId)
                    ? {
                        ...row,
                        [field]: value,
                    }
                    : row
            )
        )
    }

    const setRowSaving = (userId, saving) => {
        setAttendanceRows((prev) =>
            prev.map((row) =>
                String(row.user_id) === String(userId)
                    ? {
                        ...row,
                        saving,
                    }
                    : row
            )
        )
    }

    const saveAttendance = async (row) => {
        try {
            setRowSaving(row.user_id, true)
            setError('')

            const shouldHaveTime =
                row.status === 'present' ||
                row.status === 'late'

            const body = {
                user_id: row.user_id,
                work_date: filters.date,
                status: row.status,
                check_in: shouldHaveTime
                    ? buildDateTime(filters.date, row.check_in_time)
                    : null,
                check_out: shouldHaveTime
                    ? buildDateTime(filters.date, row.check_out_time)
                    : null,
                note: row.note || null,
            }

            const res = await fetch('/api/v1/attendance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(
                    data.error_detail ||
                    data.message ||
                    'บันทึก Attendance ไม่สำเร็จ'
                )
            }

            setRefreshing(true)
            setFilters((prev) => ({
                ...prev,
            }))
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setRowSaving(row.user_id, false)
        }
    }

    const getAttendanceExportUrl = (type) => {
        const params = new URLSearchParams()

        params.set('from', filters.date)
        params.set('to', filters.date)

        if (filters.department_id) {
            params.set('department_id', filters.department_id)
        }

        if (filters.role_id) {
            params.set('role_id', filters.role_id)
        }

        if (filters.status && filters.status !== 'all') {
            params.set('status', filters.status)
        }

        return `/api/v1/attendance/export/${type}?${params.toString()}`
    }

    return (
        <main className="min-h-screen bg-slate-50 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">
                            Attendance
                        </h1>

                        <p className="text-sm text-slate-500">
                            จัดการข้อมูลการมาทำงานของพนักงาน
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <a
                            href={getAttendanceExportUrl('excel')}
                            className="inline-flex items-center justify-center rounded-2xl bg-green-500 px-4 py-2 text-sm text-white hover:bg-green-600"
                        >
                            Export Excel
                        </a>

                        <a
                            href={getAttendanceExportUrl('pdf')}
                            className="inline-flex items-center justify-center rounded-2xl bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600"
                        >
                            Export PDF
                        </a>

                        <button
                            type="button"
                            onClick={refreshAttendance}
                            disabled={refreshing}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
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

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {summaryCards.map((item) => (
                        <article
                            key={item.status}
                            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm text-slate-500">
                                    {item.label}
                                </p>

                                <span
                                    className={`rounded-full px-3 py-1 text-xs ${getStatusClass(item.status)}`}
                                >
                                    {getStatusLabel(item.status)}
                                </span>
                            </div>

                            <p className="mt-4 text-3xl font-bold">
                                {loading ? '-' : item.value}
                            </p>
                        </article>
                    ))}
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-5 flex items-center gap-2">
                        <FiSearch className="text-sky-500" />
                        <h2 className="font-semibold">
                            ตัวกรอง
                        </h2>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-500">
                                วันที่
                            </label>

                            <input
                                type="date"
                                value={draftFilters.date}
                                onChange={(e) =>
                                    setDraftFilters((prev) => ({
                                        ...prev,
                                        date: e.target.value,
                                    }))
                                }
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-500">
                                แผนก
                            </label>

                            <SelectWithArrow
                                value={draftFilters.department_id}
                                onChange={(e) =>
                                    setDraftFilters((prev) => ({
                                        ...prev,
                                        department_id: e.target.value,
                                        role_id: '',
                                    }))
                                }
                            >
                                <option value="">ทุกแผนก</option>

                                {departments.map((department) => (
                                    <option
                                        key={department.department_id}
                                        value={department.department_id}
                                    >
                                        {department.department_name}
                                    </option>
                                ))}
                            </SelectWithArrow>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-500">
                                ตำแหน่ง
                            </label>

                            <SelectWithArrow
                                value={draftFilters.role_id}
                                onChange={(e) =>
                                    setDraftFilters((prev) => ({
                                        ...prev,
                                        role_id: e.target.value,
                                    }))
                                }
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                            >
                                <option value="">
                                    ทุกตำแหน่ง
                                </option>

                                {filteredRoles.map((role) => (
                                    <option
                                        key={role.role_id}
                                        value={role.role_id}
                                    >
                                        {role.role_name}
                                    </option>
                                ))}
                            </SelectWithArrow>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-500">
                                สถานะ
                            </label>

                            <SelectWithArrow
                                value={draftFilters.status}
                                onChange={(e) =>
                                    setDraftFilters((prev) => ({
                                        ...prev,
                                        status: e.target.value,
                                    }))
                                }
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                            >
                                {statusOptions.map((item) => (
                                    <option
                                        key={item.value}
                                        value={item.value}
                                    >
                                        {item.label}
                                    </option>
                                ))}
                            </SelectWithArrow>
                        </div>

                        <div className="flex items-end">
                            <button
                                type="button"
                                onClick={applyFilter}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 text-white hover:bg-sky-600"
                            >
                                <FiSearch />
                                ค้นหา
                            </button>
                        </div>
                    </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="font-semibold">
                                รายการ Attendance
                            </h2>

                            <p className="text-sm text-slate-500">
                                วันที่ {filters.date} · {attendanceRows.length} รายการ
                            </p>
                        </div>

                        <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800">
                            <FiCalendar />
                            Daily Attendance
                        </div>
                    </div>

                    <div className="hidden overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 md:block">
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-950">
                                    <tr className="border-b border-slate-200 dark:border-slate-800">
                                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            พนักงาน
                                        </th>
                                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            สถานะ
                                        </th>
                                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Check In
                                        </th>
                                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Check Out
                                        </th>
                                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Note
                                        </th>
                                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            จัดการ
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {loading ? (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-5 py-8 text-center text-slate-500"
                                            >
                                                กำลังโหลดข้อมูล...
                                            </td>
                                        </tr>
                                    ) : attendanceRows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-5 py-8 text-center text-slate-500"
                                            >
                                                ไม่พบข้อมูล Attendance
                                            </td>
                                        </tr>
                                    ) : (
                                        attendanceRows.map((row) => (
                                            <tr
                                                key={row.user_id}
                                                className="transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                            >
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                                                            {getInitial(row.full_name_th)}
                                                        </div>

                                                        <div>
                                                            <p className="font-medium text-slate-900 dark:text-slate-100">
                                                                {row.full_name_th || '-'}
                                                            </p>
                                                            <p className="text-xs text-slate-500">
                                                                {row.department_name || '-'} · {row.role_name || '-'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <SelectWithArrow
                                                        value={row.status}
                                                        disabled={!permission.can_manage}
                                                        onChange={(e) =>
                                                            updateRow(row.user_id, 'status', e.target.value)
                                                        }
                                                        className="py-2"
                                                    >
                                                        {attendanceStatusOptions.map((item) => (
                                                            <option
                                                                key={item.value}
                                                                value={item.value}
                                                            >
                                                                {item.label}
                                                            </option>
                                                        ))}
                                                    </SelectWithArrow>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <input
                                                        type="time"
                                                        value={row.check_in_time}
                                                        disabled={
                                                            !permission.can_manage ||
                                                            !['present', 'late'].includes(row.status)
                                                        }
                                                        onChange={(e) =>
                                                            updateRow(row.user_id, 'check_in_time', e.target.value)
                                                        }
                                                        className="rounded-2xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                                                    />
                                                </td>

                                                <td className="px-5 py-4">
                                                    <input
                                                        type="time"
                                                        value={row.check_out_time}
                                                        disabled={
                                                            !permission.can_manage ||
                                                            !['present', 'late'].includes(row.status)
                                                        }
                                                        onChange={(e) =>
                                                            updateRow(row.user_id, 'check_out_time', e.target.value)
                                                        }
                                                        className="rounded-2xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                                                    />
                                                </td>

                                                <td className="px-5 py-4">
                                                    <input
                                                        value={row.note}
                                                        disabled={!permission.can_manage}
                                                        onChange={(e) =>
                                                            updateRow(row.user_id, 'note', e.target.value)
                                                        }
                                                        placeholder="หมายเหตุ"
                                                        className="w-56 rounded-2xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                                                    />
                                                </td>

                                                <td className="px-5 py-4 text-right">
                                                    <button
                                                        type="button"
                                                        disabled={!permission.can_manage || row.saving}
                                                        onClick={() => saveAttendance(row)}
                                                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-2 text-sm text-white hover:bg-sky-600 disabled:opacity-50"
                                                    >
                                                        <FiSave />
                                                        {row.saving ? 'บันทึก...' : 'บันทึก'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-3 md:hidden">
                        {loading ? (
                            <div className="rounded-3xl border border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-800">
                                กำลังโหลดข้อมูล...
                            </div>
                        ) : attendanceRows.length === 0 ? (
                            <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
                                ไม่พบข้อมูล Attendance
                            </div>
                        ) : (
                            attendanceRows.map((row) => (
                                <article
                                    key={row.user_id}
                                    className="rounded-3xl border border-slate-200 p-4 shadow-sm dark:border-slate-800"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-100 font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                                            {getInitial(row.full_name_th)}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold">
                                                {row.full_name_th || '-'}
                                            </p>

                                            <p className="text-sm text-slate-500">
                                                {row.department_name || '-'} · {row.role_name || '-'}
                                            </p>

                                            <span
                                                className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs ${getStatusClass(row.status)}`}
                                            >
                                                {getStatusLabel(row.status)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-3">
                                        <div>
                                            <label className="mb-1 block text-sm text-slate-500">
                                                สถานะ
                                            </label>

                                            <select
                                                value={row.status}
                                                disabled={!permission.can_manage}
                                                onChange={(e) =>
                                                    updateRow(row.user_id, 'status', e.target.value)
                                                }
                                                className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950"
                                            >
                                                {attendanceStatusOptions.map((item) => (
                                                    <option
                                                        key={item.value}
                                                        value={item.value}
                                                    >
                                                        {item.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="mb-1 block text-sm text-slate-500">
                                                    Check In
                                                </label>

                                                <input
                                                    type="time"
                                                    value={row.check_in_time}
                                                    disabled={
                                                        !permission.can_manage ||
                                                        !['present', 'late'].includes(row.status)
                                                    }
                                                    onChange={(e) =>
                                                        updateRow(row.user_id, 'check_in_time', e.target.value)
                                                    }
                                                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950"
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-1 block text-sm text-slate-500">
                                                    Check Out
                                                </label>

                                                <input
                                                    type="time"
                                                    value={row.check_out_time}
                                                    disabled={
                                                        !permission.can_manage ||
                                                        !['present', 'late'].includes(row.status)
                                                    }
                                                    onChange={(e) =>
                                                        updateRow(row.user_id, 'check_out_time', e.target.value)
                                                    }
                                                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-sm text-slate-500">
                                                Note
                                            </label>

                                            <input
                                                value={row.note}
                                                disabled={!permission.can_manage}
                                                onChange={(e) =>
                                                    updateRow(row.user_id, 'note', e.target.value)
                                                }
                                                placeholder="หมายเหตุ"
                                                className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950"
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            disabled={!permission.can_manage || row.saving}
                                            onClick={() => saveAttendance(row)}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 text-sm text-white hover:bg-sky-600 disabled:opacity-50"
                                        >
                                            <FiSave />
                                            {row.saving ? 'กำลังบันทึก...' : 'บันทึก'}
                                        </button>
                                    </div>
                                </article>
                            ))
                        )}
                    </div>
                </section>
            </div>
        </main>
    )
}