'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { FiArrowLeft, FiSave } from 'react-icons/fi'

export default function EmployeeEditPage() {
    const params = useParams()
    const router = useRouter()
    const employeeId = params?.id

    const [formData, setFormData] = useState({
        prefix: '',
        first_name_th: '',
        last_name_th: '',
        first_name_en: '',
        last_name_en: '',
        email: '',
        department_id: '',
        role_id: '',
        status: 'active',
    })

    const [departments, setDepartments] = useState([])
    const [roles, setRoles] = useState([])

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const filteredRoles = useMemo(() => {
        if (!formData.department_id) return roles

        return roles.filter(
            (role) =>
                String(role.department_id) ===
                String(formData.department_id)
        )
    }, [roles, formData.department_id])

    useEffect(() => {
        let ignore = false
        const controller = new AbortController()

        Promise.all([
            fetch(`/api/v1/employee/${employeeId}`, {
                cache: 'no-store',
                signal: controller.signal,
            }).then(async (res) => {
                const data = await res.json()
                if (!res.ok) throw new Error(data.message || 'โหลดข้อมูลพนักงานไม่สำเร็จ')
                return data
            }),
            fetch('/api/v1/department', {
                cache: 'no-store',
                signal: controller.signal,
            }).then((res) => res.json()),
            fetch('/api/v1/role', {
                cache: 'no-store',
                signal: controller.signal,
            }).then((res) => res.json()),
        ])
            .then(([employeeData, departmentData, roleData]) => {
                if (ignore) return

                const employee = employeeData.employee

                setFormData({
                    prefix: employee.prefix || '',
                    first_name_th: employee.first_name_th || '',
                    last_name_th: employee.last_name_th || '',
                    first_name_en: employee.first_name_en || '',
                    last_name_en: employee.last_name_en || '',
                    email: employee.email || '',
                    department_id: employee.department_id || '',
                    role_id: employee.role_id || '',
                    status: employee.status || 'active',
                })

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
    }, [employeeId])

    const updateField = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }))
    }

    const handleSubmit = async (event) => {
        event.preventDefault()

        try {
            setSaving(true)
            setError('')

            const res = await fetch(
                `/api/v1/employee/${employeeId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData),
                }
            )

            const data = await res.json()

            if (!res.ok) {
                throw new Error(
                    data.error_detail ||
                    data.message ||
                    'บันทึกข้อมูลไม่สำเร็จ'
                )
            }

            router.push(`/dashboard/employee/${employeeId}`)
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-50 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
                <div className="rounded-3xl bg-white p-6 shadow-sm dark:bg-slate-900">
                    กำลังโหลดข้อมูล...
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-slate-50 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <div className="space-y-6">
                <div>
                    <Link
                        href={`/dashboard/employee/${employeeId}`}
                        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-sky-600"
                    >
                        <FiArrowLeft />
                        กลับหน้ารายละเอียด
                    </Link>

                    <h1 className="mt-2 text-2xl font-bold">
                        แก้ไขข้อมูลพนักงาน
                    </h1>
                </div>

                {error && (
                    <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                        {error}
                    </div>
                )}

                <form
                    onSubmit={handleSubmit}
                    className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                    <div className="grid gap-5 md:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                คำนำหน้า
                            </label>

                            <input
                                value={formData.prefix}
                                onChange={(e) =>
                                    updateField('prefix', e.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Email
                            </label>

                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) =>
                                    updateField('email', e.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                ชื่อไทย
                            </label>

                            <input
                                value={formData.first_name_th}
                                onChange={(e) =>
                                    updateField('first_name_th', e.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                นามสกุลไทย
                            </label>

                            <input
                                value={formData.last_name_th}
                                onChange={(e) =>
                                    updateField('last_name_th', e.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                First name
                            </label>

                            <input
                                value={formData.first_name_en}
                                onChange={(e) =>
                                    updateField('first_name_en', e.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Last name
                            </label>

                            <input
                                value={formData.last_name_en}
                                onChange={(e) =>
                                    updateField('last_name_en', e.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                แผนก
                            </label>

                            <select
                                value={formData.department_id}
                                onChange={(e) => {
                                    updateField('department_id', e.target.value)
                                    updateField('role_id', '')
                                }}
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                            >
                                <option value="">
                                    เลือกแผนก
                                </option>

                                {departments.map((department) => (
                                    <option
                                        key={department.department_id}
                                        value={department.department_id}
                                    >
                                        {department.department_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                ตำแหน่ง
                            </label>

                            <select
                                value={formData.role_id}
                                onChange={(e) =>
                                    updateField('role_id', e.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                            >
                                <option value="">
                                    เลือกตำแหน่ง
                                </option>

                                {filteredRoles.map((role) => (
                                    <option
                                        key={role.role_id}
                                        value={role.role_id}
                                    >
                                        {role.role_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                สถานะ
                            </label>

                            <select
                                value={formData.status}
                                onChange={(e) =>
                                    updateField('status', e.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                            >
                                <option value="active">
                                    ทำงานอยู่
                                </option>
                                <option value="inactive">
                                    ปิดใช้งาน
                                </option>
                                <option value="resigned">
                                    ลาออก
                                </option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-5 py-3 text-white hover:bg-sky-600 disabled:opacity-60"
                        >
                            <FiSave />
                            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                        </button>
                    </div>
                </form>
            </div>
        </main>
    )
}