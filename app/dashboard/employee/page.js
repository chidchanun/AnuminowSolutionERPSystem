'use client'

import Link from 'next/link'
import { FiPlus } from 'react-icons/fi'
import { useEffect, useMemo, useState } from 'react'



const thaiDayLabels = [
  'อา.',
  'จ.',
  'อ.',
  'พ.',
  'พฤ.',
  'ศ.',
  'ส.',
]

function toDateKey(value) {
  if (!value) return ''

  if (typeof value === 'string') {
    return value.slice(0, 10)
  }

  return new Date(value).toISOString().slice(0, 10)
}

function getCurrentWeekDays() {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day

  const monday = new Date(now)
  monday.setHours(12, 0, 0, 0)
  monday.setDate(now.getDate() + diffToMonday)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)

    return {
      key: date.toISOString().slice(0, 10),
      day: thaiDayLabels[date.getDay()],
      dateLabel: date.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
      }),
    }
  })
}

const availableColumns = [
  { id: 'full_name_th', label: 'ชื่อ-นามสกุล (ไทย)' },
  { id: 'full_name_en', label: 'ชื่อ-นามสกุล (อังกฤษ)' },
  { id: 'department_name', label: 'แผนก' },
  { id: 'role_name', label: 'ตำแหน่ง' },
]

export default function EmployeePage() {
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [roles, setRoles] = useState([])
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [selectedColumns, setSelectedColumns] = useState([
    'full_name_th',
    'full_name_en',
    'department_name',
    'role_name',
  ])
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const pageSize = 10
  const [search, setSearch] = useState('')
  const [attendanceSummary, setAttendanceSummary] = useState({
    present: 0,
    leave: 0,
    absent: 0,
    late: 0,
  })

  const [weeklyAttendance, setWeeklyAttendance] = useState([])
  const attendanceCards = [
    {
      label: 'มาทำงาน',
      value: attendanceSummary.present,
      color: '#22c55e',
    },
    {
      label: 'ลางาน',
      value: attendanceSummary.leave,
      color: '#0ea5e9',
    },
    {
      label: 'ขาดงาน',
      value: attendanceSummary.absent,
      color: '#f97316',
    },
    {
      label: 'มาสาย',
      value: attendanceSummary.late,
      color: '#f43f5e',
    },
  ]
  const weeklyGraphData = useMemo(() => {
    const weeklyMap = new Map(
      weeklyAttendance.map((item) => [
        toDateKey(item.work_date),
        {
          attended: Number(item.attended || 0),
          leave: Number(item.leave_count || 0),
          absent: Number(item.absent_count || 0),
          late: Number(item.late_count || 0),
        },
      ])
    )

    return getCurrentWeekDays().map((day) => {
      const data = weeklyMap.get(day.key) || {
        attended: 0,
        leave: 0,
        absent: 0,
        late: 0,
      }

      return {
        ...day,
        ...data,
      }
    })
  }, [weeklyAttendance])
  useEffect(() => {
    let ignore = false
    const controller = new AbortController()

    fetch('/api/v1/attendance', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (ignore || !data.success) return

        setAttendanceSummary(data.summary || {
          present: 0,
          leave: 0,
          absent: 0,
          late: 0,
        })

        setWeeklyAttendance(data.weekly || [])
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        console.error(error)
      })

    return () => {
      ignore = true
      controller.abort()
    }
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError('')

      try {
        const [employeeRes, departmentRes, roleRes] = await Promise.all([
          fetch('/api/v1/employee'),
          fetch('/api/v1/department'),
          fetch('/api/v1/role'),
        ])

        if (!employeeRes.ok || !departmentRes.ok || !roleRes.ok) {
          throw new Error('ไม่สามารถโหลดข้อมูลได้ทั้งหมด')
        }

        const [employeeData, departmentData, roleData] = await Promise.all([
          employeeRes.json(),
          departmentRes.json(),
          roleRes.json(),
        ])

        setEmployees(
          Array.isArray(employeeData)
            ? employeeData
            : employeeData.employee || []
        )
        setDepartments(Array.isArray(departmentData) ? departmentData : departmentData.departments || [])
        setRoles(Array.isArray(roleData) ? roleData : roleData.roles || [])
      } catch (err) {
        console.error(err)
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูลพนักงาน')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const filteredRoles = useMemo(() => {
    if (!selectedDepartmentId) return roles
    return roles.filter((item) => String(item.department_id) === String(selectedDepartmentId))
  }, [roles, selectedDepartmentId])

  const selectedDepartmentName = useMemo(() => {
    return departments.find((item) => String(item.department_id) === String(selectedDepartmentId))?.department_name || ''
  }, [departments, selectedDepartmentId])


  const selectedRoleName = useMemo(() => {
    return roles.find((item) => String(item.role_id) === String(selectedRoleId))?.role_name || ''
  }, [roles, selectedRoleId])

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase()

    return employees.filter((employee) => {
      const departmentMatch = selectedDepartmentId
        ? employee.department_name === selectedDepartmentName
        : true

      const roleMatch = selectedRoleId
        ? employee.role_name === selectedRoleName
        : true

      const searchText = [
        employee.id,
        employee.email,
        employee.prefix,
        employee.first_name_th,
        employee.last_name_th,
        employee.first_name_en,
        employee.last_name_en,
        employee.department_name,
        employee.role_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const searchMatch = q
        ? searchText.includes(q)
        : true

      return departmentMatch && roleMatch && searchMatch
    })
  }, [
    employees,
    selectedDepartmentId,
    selectedDepartmentName,
    selectedRoleId,
    selectedRoleName,
    search,
  ])

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize))
  const currentPageClamped = Math.min(currentPage, totalPages)

  const pagedEmployees = useMemo(() => {
    const startIndex = (currentPageClamped - 1) * pageSize
    return filteredEmployees.slice(startIndex, startIndex + pageSize)
  }, [filteredEmployees, currentPageClamped, pageSize])

  const toggleColumn = (columnId) => {
    setSelectedColumns((prev) => {
      if (prev.includes(columnId)) {
        if (prev.length === 1) return prev
        return prev.filter((id) => id !== columnId)
      }

      return [...prev, columnId]
    })
  }

  const getValue = (employee, columnId) => {
    switch (columnId) {
      case 'full_name_th':
        return `${employee.prefix || ''}${employee.first_name_th || ''} ${employee.last_name_th || ''}`

      case 'full_name_en':
        return `${employee.first_name_en || ''} ${employee.last_name_en || ''}`

      default:
        return employee[columnId] || '-'
    }
  }

  const getEmployeeExportUrl = (type) => {
    const params = new URLSearchParams()

    if (selectedDepartmentId) {
      params.set('department_id', selectedDepartmentId)
    }

    if (selectedRoleId) {
      params.set('role_id', selectedRoleId)
    }

    if (search.trim()) {
      params.set('search', search.trim())
    }

    params.set('status', 'active')

    return `/api/v1/employee/export/${type}?${params.toString()}`
  }

  return (
    <main className="h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 w-full">
      <div className="w-full">
        <div className="py-6 flex flex-col gap-8">
          <div className="grid gap-4 xl:grid-cols-5">
            <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
              <p className="text-sm text-slate-500 dark:text-slate-400">จำนวนพนักงานทั้งหมด</p>
              <p className="mt-4 text-2xl font-semibold text-slate-900 dark:text-slate-100 max-md:text-lg">
                {loading ? 'กำลังโหลด...' : employees.length}
              </p>
            </article>
            {
              attendanceCards.map((item) => (
                <article key={item.label} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <p className="text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
                  </div>
                  <p className="mt-4 text-2xl font-semibold text-slate-900 dark:text-slate-100 max-md:text-lg">{item.value}</p>
                </article>
              ))
            }
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">กราฟยอดการมาทำงาน</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100 max-md:text-[16px]">สัปดาห์นี้</h2>
              </div>
            </div>
            <div className="mt-8 space-y-4">
              {weeklyGraphData.map((item) => {
                const percent = employees.length > 0
                  ? Math.min(100, (item.attended / employees.length) * 100)
                  : 0

                return (
                  <div
                    key={item.key}
                    className="grid grid-cols-[0.8fr_1fr_auto] items-center gap-4 text-sm max-md:grid-cols-[0.7fr_1fr_auto]"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {item.day}
                      </p>
                      <p className="text-xs text-slate-400">
                        {item.dateLabel}
                      </p>
                    </div>

                    <div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-3 rounded-full bg-sky-500 transition-all"
                          style={{
                            width: `${percent}%`,
                          }}
                        />
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                        <span>
                          ลา {item.leave}
                        </span>
                        <span>
                          ขาด {item.absent}
                        </span>
                        <span>
                          สาย {item.late}
                        </span>
                      </div>
                    </div>

                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {item.attended}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm text-slate-400">ระบบรายชื่อพนักงาน</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">ดูข้อมูลพนักงาน</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={getEmployeeExportUrl('excel')}
                  className="rounded-2xl bg-green-500 px-4 py-2 text-sm text-white hover:bg-green-600"
                >
                  Export Excel
                </a>

                <a
                  href={getEmployeeExportUrl('pdf')}
                  className="rounded-2xl bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600"
                >
                  Export PDF
                </a>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="mb-4">
                  <label className="block text-sm text-slate-500">
                    ค้นหาพนักงาน
                  </label>

                  <input
                    type="text"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value)
                      setCurrentPage(1)
                    }}
                    placeholder="ค้นหาชื่อ, email, แผนก, ตำแหน่ง"
                    className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <label className="block text-sm text-slate-500">
                  แผนก

                  <div className="relative mt-2">
                    <select
                      value={selectedDepartmentId}
                      onChange={(event) => {
                        setSelectedDepartmentId(event.target.value)
                        setSelectedRoleId('')
                        setCurrentPage(1)
                      }}
                      className="appearance-none w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 pr-12 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      <option value="">ทุกแผนก</option>

                      {departments.map((item) => (
                        <option
                          key={item.department_id}
                          value={item.department_id}
                        >
                          {item.department_name}
                        </option>
                      ))}
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
                <label className="block text-sm text-slate-500">
                  ตำแหน่ง

                  <div className="relative mt-2">
                    <select
                      value={selectedRoleId}
                      onChange={(event) => {
                        setSelectedRoleId(event.target.value)
                        setCurrentPage(1)
                      }}
                      className="appearance-none w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 pr-12 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      <option value="">ทุกตำแหน่ง</option>

                      {filteredRoles.map((item) => (
                        <option
                          key={item.role_id}
                          value={item.role_id}
                        >
                          {item.role_name}
                        </option>
                      ))}
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
              </div>

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

            <div className="mt-6">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    รายชื่อพนักงาน
                  </p>
                  <p className="text-sm text-slate-500">
                    แสดง {filteredEmployees.length} จาก {employees.length} รายการ
                  </p>
                </div>

                {error ? (
                  <span className="rounded-2xl bg-rose-50 px-4 py-2 text-sm text-rose-600 dark:bg-rose-950 dark:text-rose-300">
                    {error}
                  </span>
                ) : null}
              </div>

              {/* Desktop / Tablet Table */}
              <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:block">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-950">
                      <tr className="border-b border-slate-200 dark:border-slate-800">
                        <th className="whitespace-nowrap px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          #
                        </th>

                        {selectedColumns.map((columnId) => {
                          const column = availableColumns.find((item) => item.id === columnId)

                          return (
                            <th
                              key={columnId}
                              className="whitespace-nowrap px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                            >
                              {column?.label || columnId}
                            </th>
                          )
                        })}

                        <th className="whitespace-nowrap px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          จัดการ
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {loading ? (
                        <tr>
                          <td
                            className="px-5 py-8 text-center text-slate-500"
                            colSpan={selectedColumns.length + 2}
                          >
                            กำลังโหลดข้อมูล...
                          </td>
                        </tr>
                      ) : filteredEmployees.length === 0 ? (
                        <tr>
                          <td
                            className="px-5 py-8 text-center text-slate-500"
                            colSpan={selectedColumns.length + 2}
                          >
                            ไม่พบข้อมูลพนักงาน
                          </td>
                        </tr>
                      ) : (
                        pagedEmployees.map((employee, idx) => (
                          <tr
                            key={`${employee.id || employee.email || employee.first_name_th}-${idx}`}
                            className="transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                          >
                            <td className="whitespace-nowrap px-5 py-4 text-slate-400">
                              {(currentPageClamped - 1) * pageSize + idx + 1}
                            </td>

                            {selectedColumns.map((columnId) => (
                              <td
                                key={columnId}
                                className="whitespace-nowrap px-5 py-4 text-slate-700 dark:text-slate-200"
                              >
                                {columnId === 'full_name_th' ? (
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                                      {(employee.first_name_th || employee.first_name_en || '?').charAt(0)}
                                    </div>

                                    <div>
                                      <p className="font-medium text-slate-900 dark:text-slate-100">
                                        {getValue(employee, columnId)}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {employee.email || '-'}
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  getValue(employee, columnId)
                                )}
                              </td>
                            ))}

                            <td className="whitespace-nowrap px-5 py-4 text-right">
                              <Link
                                href={`/dashboard/employee/${employee.id}`}
                                className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600"
                              >
                                ดูรายละเอียด
                              </Link>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Card */}
              <div className="space-y-3 lg:hidden">
                {loading ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                    กำลังโหลดข้อมูล...
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                    ไม่พบข้อมูลพนักงาน
                  </div>
                ) : (
                  pagedEmployees.map((employee, idx) => (
                    <article
                      key={`${employee.id || employee.email || employee.first_name_th}-card-${idx}`}
                      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-100 text-base font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                          {(employee.first_name_th || employee.first_name_en || '?').charAt(0)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                            {getValue(employee, 'full_name_th')}
                          </p>

                          <p className="truncate text-sm text-slate-500">
                            {employee.email || '-'}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {employee.department_name || 'ไม่ระบุแผนก'}
                            </span>

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {employee.role_name || 'ไม่ระบุตำแหน่ง'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
                        {selectedColumns.map((columnId) => {
                          const column = availableColumns.find((item) => item.id === columnId)

                          return (
                            <div
                              key={columnId}
                              className="flex items-start justify-between gap-3 text-sm"
                            >
                              <span className="shrink-0 text-slate-500">
                                {column?.label || columnId}
                              </span>

                              <span className="text-right font-medium text-slate-800 dark:text-slate-100">
                                {getValue(employee, columnId)}
                              </span>
                            </div>
                          )
                        })}
                      </div>

                      <Link
                        href={`/dashboard/employee/${employee.id}`}
                        className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-sky-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-600"
                      >
                        ดูรายละเอียด
                      </Link>
                    </article>
                  ))
                )}
              </div>

              {/* Pagination */}
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  หน้า {currentPageClamped} / {totalPages} ({filteredEmployees.length} รายการ)
                </p>

                <div className="grid grid-cols-2 gap-2 sm:inline-flex sm:items-center">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPageClamped === 1}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                  >
                    ก่อนหน้า
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPageClamped === totalPages}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                  >
                    ถัดไป
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
