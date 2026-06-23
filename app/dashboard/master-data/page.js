'use client'

import { useEffect, useMemo, useState } from 'react'
import {
    FiEdit2,
    FiRefreshCw,
    FiSave,
    FiTrash2,
    FiX,
} from 'react-icons/fi'

const emptyDepartmentForm = {
    department_id: '',
    department_name: '',
    department_code: '',
}

const emptyRoleForm = {
    role_id: '',
    role_name: '',
    department_id: '',
}

const emptyPermissionRoleForm = {
    permission_role_id: '',
    permission_role_name: '',
}

async function requestJson(url, options = {}) {
    const res = await fetch(url, {
        cache: 'no-store',
        ...options,
    })
    const data = await res.json()

    if (!res.ok) {
        throw new Error(
            data.error_detail ||
                data.message ||
                'ไม่สามารถทำรายการได้'
        )
    }

    return data
}

async function requestMasterData() {
    const [departmentData, roleData, userPermissionData] = await Promise.all([
        requestJson('/api/v1/department'),
        requestJson('/api/v1/role'),
        requestJson('/api/v1/me/permissions'),
    ])
    const currentPermissions = userPermissionData.permissions || []
    const permissionData = currentPermissions.includes('permission.manage')
        ? await requestJson('/api/v1/permission-matrix')
        : { roles: [] }

    return {
        departments: departmentData.departments || [],
        roles: Array.isArray(roleData) ? roleData : roleData.roles || [],
        permissionRoles: permissionData.roles || [],
        currentPermissions,
    }
}

function EmptyState({ children }) {
    return (
        <div className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            {children}
        </div>
    )
}

function ConfirmCard({ item, onCancel, onConfirm, saving }) {
    if (!item) return null

    return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p>
                    ต้องการลบ <span className="font-semibold">{item.label}</span> ใช่ไหม?
                </p>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        <FiX className="h-4 w-4" />
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <FiTrash2 className="h-4 w-4" />
                        ลบ
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function MasterDataPage() {
    const [activeTab, setActiveTab] = useState('department')
    const [departments, setDepartments] = useState([])
    const [roles, setRoles] = useState([])
    const [permissionRoles, setPermissionRoles] = useState([])
    const [currentPermissions, setCurrentPermissions] = useState([])
    const [departmentForm, setDepartmentForm] = useState(emptyDepartmentForm)
    const [roleForm, setRoleForm] = useState(emptyRoleForm)
    const [permissionRoleForm, setPermissionRoleForm] = useState(emptyPermissionRoleForm)
    const [confirmDelete, setConfirmDelete] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const departmentMap = useMemo(() => {
        return new Map(
            departments.map((department) => [
                String(department.department_id),
                department.department_name,
            ])
        )
    }, [departments])

    const loadMasterData = async () => {
        setLoading(true)
        setError('')

        try {
            const data = await requestMasterData()

            setDepartments(data.departments)
            setRoles(data.roles)
            setPermissionRoles(data.permissionRoles)
            setCurrentPermissions(data.currentPermissions)
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        requestMasterData()
            .then((data) => {
                setDepartments(data.departments)
                setRoles(data.roles)
                setPermissionRoles(data.permissionRoles)
                setCurrentPermissions(data.currentPermissions)
                setError('')
            })
            .catch((error) => {
                console.error(error)
                setError(error.message)
            })
            .finally(() => {
                setLoading(false)
            })
    }, [])

    const resetMessages = () => {
        setError('')
        setSuccess('')
    }

    const canManageMasterData = currentPermissions.includes('master_data.manage')
    const canManagePermissionRoles = currentPermissions.includes('permission.manage')

    const saveDepartment = async (event) => {
        event.preventDefault()
        resetMessages()
        setSaving(true)

        try {
            const editing = Boolean(departmentForm.department_id)

            await requestJson('/api/v1/department', {
                method: editing ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(departmentForm),
            })

            setDepartmentForm(emptyDepartmentForm)
            setSuccess(editing ? 'แก้ไขแผนกสำเร็จ' : 'สร้างแผนกสำเร็จ')
            await loadMasterData()
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setSaving(false)
        }
    }

    const saveRole = async (event) => {
        event.preventDefault()
        resetMessages()
        setSaving(true)

        try {
            const editing = Boolean(roleForm.role_id)

            await requestJson('/api/v1/role', {
                method: editing ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(roleForm),
            })

            setRoleForm(emptyRoleForm)
            setSuccess(editing ? 'แก้ไขตำแหน่งสำเร็จ' : 'สร้างตำแหน่งสำเร็จ')
            await loadMasterData()
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setSaving(false)
        }
    }

    const savePermissionRole = async (event) => {
        event.preventDefault()
        resetMessages()
        setSaving(true)

        try {
            const editing = Boolean(permissionRoleForm.permission_role_id)

            await requestJson('/api/v1/permission-matrix', {
                method: editing ? 'PATCH' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(permissionRoleForm),
            })

            setPermissionRoleForm(emptyPermissionRoleForm)
            setSuccess(editing ? 'แก้ไข Permission Role สำเร็จ' : 'สร้าง Permission Role สำเร็จ')
            await loadMasterData()
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setSaving(false)
        }
    }

    const deleteItem = async () => {
        if (!confirmDelete) return

        resetMessages()
        setSaving(true)

        try {
            await requestJson(confirmDelete.url, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(confirmDelete.body),
            })

            setSuccess('ลบข้อมูลสำเร็จ')
            setConfirmDelete(null)
            await loadMasterData()
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <main className="min-h-screen bg-slate-50 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Master Data</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            จัดการแผนกและตำแหน่งที่ใช้ในข้อมูลพนักงาน
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={loadMasterData}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    {[
                        { id: 'department', label: 'Department' },
                        { id: 'role', label: 'Role' },
                        { id: 'permission-role', label: 'Permission Role' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                                setActiveTab(tab.id)
                                setConfirmDelete(null)
                                resetMessages()
                            }}
                            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
                                activeTab === tab.id
                                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                        {success}
                    </div>
                )}

                <ConfirmCard
                    item={confirmDelete}
                    onCancel={() => setConfirmDelete(null)}
                    onConfirm={deleteItem}
                    saving={saving}
                />

                {activeTab === 'department' ? (
                    <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
                        <form
                            onSubmit={saveDepartment}
                            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                        >
                            <div>
                                <h2 className="font-semibold">
                                    {departmentForm.department_id ? 'Edit Department' : 'New Department'}
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    ใช้รหัสแผนกสำหรับสร้างรหัสพนักงาน
                                </p>
                            </div>

                            {!canManageMasterData && (
                                <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                    ต้องมี master_data.manage เพื่อแก้ไขข้อมูล
                                </div>
                            )}

                            <label className="block text-sm">
                                <span className="font-medium">ชื่อแผนก</span>
                                <input
                                    value={departmentForm.department_name}
                                    onChange={(event) =>
                                        setDepartmentForm((prev) => ({
                                            ...prev,
                                            department_name: event.target.value,
                                        }))
                                    }
                                    disabled={!canManageMasterData}
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                                />
                            </label>

                            <label className="block text-sm">
                                <span className="font-medium">รหัสแผนก</span>
                                <input
                                    value={departmentForm.department_code}
                                    onChange={(event) =>
                                        setDepartmentForm((prev) => ({
                                            ...prev,
                                            department_code: event.target.value,
                                        }))
                                    }
                                    disabled={!canManageMasterData}
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                                />
                            </label>

                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    disabled={saving || !canManageMasterData}
                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <FiSave className="h-4 w-4" />
                                    Save
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setDepartmentForm(emptyDepartmentForm)}
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                >
                                    Clear
                                </button>
                            </div>
                        </form>

                        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h2 className="font-semibold">Departments</h2>

                            <div className="mt-4 space-y-3">
                                {loading ? (
                                    <EmptyState>กำลังโหลดข้อมูล...</EmptyState>
                                ) : departments.length === 0 ? (
                                    <EmptyState>ยังไม่มีข้อมูลแผนก</EmptyState>
                                ) : (
                                    departments.map((department) => (
                                        <div
                                            key={department.department_id}
                                            className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div>
                                                <p className="font-medium">
                                                    {department.department_name}
                                                </p>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    Code: {department.department_code || '-'}
                                                </p>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    disabled={!canManageMasterData}
                                                    onClick={() => setDepartmentForm({
                                                        department_id: department.department_id,
                                                        department_name: department.department_name || '',
                                                        department_code: department.department_code || '',
                                                    })}
                                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                                >
                                                    <FiEdit2 className="h-4 w-4" />
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={!canManageMasterData}
                                                    onClick={() => setConfirmDelete({
                                                        label: department.department_name,
                                                        url: '/api/v1/department',
                                                        body: {
                                                            department_id: department.department_id,
                                                        },
                                                    })}
                                                    className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950"
                                                >
                                                    <FiTrash2 className="h-4 w-4" />
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </section>
                ) : activeTab === 'role' ? (
                    <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
                        <form
                            onSubmit={saveRole}
                            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                        >
                            <div>
                                <h2 className="font-semibold">
                                    {roleForm.role_id ? 'Edit Role' : 'New Role'}
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    ตำแหน่งจะถูกใช้กับข้อมูลพนักงาน
                                </p>
                            </div>

                            {!canManageMasterData && (
                                <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                    ต้องมี master_data.manage เพื่อแก้ไขข้อมูล
                                </div>
                            )}

                            <label className="block text-sm">
                                <span className="font-medium">ชื่อตำแหน่ง</span>
                                <input
                                    value={roleForm.role_name}
                                    onChange={(event) =>
                                        setRoleForm((prev) => ({
                                            ...prev,
                                            role_name: event.target.value,
                                        }))
                                    }
                                    disabled={!canManageMasterData}
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                                />
                            </label>

                            <label className="block text-sm">
                                <span className="font-medium">แผนก</span>
                                <select
                                    value={roleForm.department_id}
                                    onChange={(event) =>
                                        setRoleForm((prev) => ({
                                            ...prev,
                                            department_id: event.target.value,
                                        }))
                                    }
                                    disabled={!canManageMasterData}
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                                >
                                    <option value="">เลือกแผนก</option>
                                    {departments.map((department) => (
                                        <option
                                            key={department.department_id}
                                            value={department.department_id}
                                        >
                                            {department.department_name}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    disabled={saving || !canManageMasterData}
                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <FiSave className="h-4 w-4" />
                                    Save
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setRoleForm(emptyRoleForm)}
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                >
                                    Clear
                                </button>
                            </div>
                        </form>

                        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h2 className="font-semibold">Roles</h2>

                            <div className="mt-4 space-y-3">
                                {loading ? (
                                    <EmptyState>กำลังโหลดข้อมูล...</EmptyState>
                                ) : roles.length === 0 ? (
                                    <EmptyState>ยังไม่มีข้อมูลตำแหน่ง</EmptyState>
                                ) : (
                                    roles.map((role) => (
                                        <div
                                            key={role.role_id}
                                            className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div>
                                                <p className="font-medium">
                                                    {role.role_name}
                                                </p>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    {role.department_name ||
                                                        departmentMap.get(String(role.department_id)) ||
                                                        '-'}
                                                </p>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    disabled={!canManageMasterData}
                                                    onClick={() => setRoleForm({
                                                        role_id: role.role_id,
                                                        role_name: role.role_name || '',
                                                        department_id: role.department_id || '',
                                                    })}
                                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                                >
                                                    <FiEdit2 className="h-4 w-4" />
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={!canManageMasterData}
                                                    onClick={() => setConfirmDelete({
                                                        label: role.role_name,
                                                        url: '/api/v1/role',
                                                        body: {
                                                            role_id: role.role_id,
                                                        },
                                                    })}
                                                    className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950"
                                                >
                                                    <FiTrash2 className="h-4 w-4" />
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </section>
                ) : (
                    <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
                        <form
                            onSubmit={savePermissionRole}
                            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                        >
                            <div>
                                <h2 className="font-semibold">
                                    {permissionRoleForm.permission_role_id ? 'Edit Permission Role' : 'New Permission Role'}
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    ใช้สร้างกลุ่มสิทธิ์สำหรับนำไป map ในหน้า Permission
                                </p>
                            </div>

                            {!canManagePermissionRoles && (
                                <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                    ต้องมี permission.manage เพื่อจัดการ Permission Role
                                </div>
                            )}

                            <label className="block text-sm">
                                <span className="font-medium">ชื่อ Permission Role</span>
                                <input
                                    value={permissionRoleForm.permission_role_name}
                                    onChange={(event) =>
                                        setPermissionRoleForm((prev) => ({
                                            ...prev,
                                            permission_role_name: event.target.value,
                                        }))
                                    }
                                    disabled={!canManagePermissionRoles}
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                                />
                            </label>

                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    disabled={saving || !canManagePermissionRoles}
                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <FiSave className="h-4 w-4" />
                                    Save
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setPermissionRoleForm(emptyPermissionRoleForm)}
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                >
                                    Clear
                                </button>
                            </div>
                        </form>

                        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h2 className="font-semibold">Permission Roles</h2>

                            <div className="mt-4 space-y-3">
                                {loading ? (
                                    <EmptyState>กำลังโหลดข้อมูล...</EmptyState>
                                ) : permissionRoles.length === 0 ? (
                                    <EmptyState>ยังไม่มี Permission Role</EmptyState>
                                ) : (
                                    permissionRoles.map((role) => (
                                        <div
                                            key={role.permission_role_id}
                                            className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div>
                                                <p className="font-medium">
                                                    {role.permission_role_name}
                                                </p>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    ID: {role.permission_role_id}
                                                </p>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    disabled={!canManagePermissionRoles}
                                                    onClick={() => setPermissionRoleForm({
                                                        permission_role_id: role.permission_role_id,
                                                        permission_role_name: role.permission_role_name || '',
                                                    })}
                                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                                >
                                                    <FiEdit2 className="h-4 w-4" />
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={!canManagePermissionRoles}
                                                    onClick={() => setConfirmDelete({
                                                        label: role.permission_role_name,
                                                        url: '/api/v1/permission-matrix',
                                                        body: {
                                                            permission_role_id: role.permission_role_id,
                                                        },
                                                    })}
                                                    className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950"
                                                >
                                                    <FiTrash2 className="h-4 w-4" />
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </section>
                )}
            </div>
        </main>
    )
}
