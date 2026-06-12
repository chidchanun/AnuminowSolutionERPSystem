'use client'

import Link from 'next/link'
import { FiPlus } from 'react-icons/fi'
import { useEffect, useMemo, useState } from 'react'

const Attendance = [
  { label: 'มาทำงาน', value: 92, color: '#22c55e' },
  { label: 'ลางาน', value: 12, color: '#0ea5e9' },
  { label: 'ขาดงาน', value: 5, color: '#f97316' },
  { label: 'มาสาย', value: 7, color: '#f43f5e' },
]

const mockGraphData = [
  { day: 'จ.', value: 12 },
  { day: 'อ.', value: 18 },
  { day: 'พ.', value: 20 },
  { day: 'พฤ.', value: 16 },
  { day: 'ศ.', value: 14 },
  { day: 'ส.', value: 8 },
  { day: 'อา.', value: 10 },
]

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

        console.log(employeeData)

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
    return employees.filter((employee) => {
      const departmentMatch = selectedDepartmentId
        ? employee.department_name === selectedDepartmentName
        : true
      const roleMatch = selectedRoleId ? employee.role_name === selectedRoleName : true
      return departmentMatch && roleMatch
    })
  }, [employees, selectedDepartmentId, selectedDepartmentName, selectedRoleId, selectedRoleName])

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
              Attendance.map((item) => (
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
              {mockGraphData.map((item) => (
                <div key={item.day} className="grid grid-cols-[1.1fr_1fr_auto] max-md:grid-cols-[0.5fr_1fr_auto] items-center gap-4 text-sm">
                  <span className="text-slate-900 dark:text-slate-100">{item.day}</span>
                  <div className="h-3 rounded-full bg-slate-300 dark:bg-slate-700">
                    <div
                      className="h-3 rounded-full bg-sky-500"
                      style={{ width: `${Math.min(100, item.value * 4)}%` }}
                    />
                  </div>
                  <span className="text-slate-900 dark:text-slate-100 font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm text-slate-400">ระบบรายชื่อพนักงาน</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">ดูข้อมูลพนักงาน</h2>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
              <div className="grid gap-4 sm:grid-cols-2">
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

            <div className="mt-6 overflow-x-auto">
              <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
                <span>แสดง {filteredEmployees.length} จาก {employees.length} รายการ</span>
                {error ? <span className="text-rose-500">{error}</span> : null}
              </div>
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
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
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-500" colSpan={selectedColumns.length}>
                        กำลังโหลดข้อมูล...
                      </td>
                    </tr>
                  ) : filteredEmployees.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-500" colSpan={selectedColumns.length}>
                        ไม่พบข้อมูลพนักงาน
                      </td>
                    </tr>
                  ) : (
                    pagedEmployees.map((employee, idx) => (
                      <tr key={`${employee.email || employee.first_name_th}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                        {selectedColumns.map((columnId) => (
                          <td key={columnId} className="whitespace-nowrap px-4 py-4 text-slate-700 dark:text-slate-200">
                            {getValue(employee, columnId)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  หน้า {currentPageClamped} / {totalPages} ({filteredEmployees.length} รายการ)
                </p>
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPageClamped === 1}
                    className="rounded-3xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                  >
                    ก่อนหน้า
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPageClamped === totalPages}
                    className="rounded-3xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-900"
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
