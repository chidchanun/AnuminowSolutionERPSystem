'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import {
    FiCheck,
    FiRefreshCw,
    FiSave,
    FiShield,
} from 'react-icons/fi'

function groupPermissionsByModule(permissions) {
    return permissions.reduce((groups, permission) => {
        const moduleName = permission.module_name || 'Other'

        if (!groups[moduleName]) {
            groups[moduleName] = []
        }

        groups[moduleName].push(permission)

        return groups
    }, {})
}

function buildMatrix(rolePermissions) {
    const matrix = {}

    rolePermissions.forEach((item) => {
        const roleId = String(item.permission_role_id)

        if (!matrix[roleId]) {
            matrix[roleId] = []
        }

        matrix[roleId].push(Number(item.permission_id))
    })

    return matrix
}

async function requestPermissionMatrix(signal) {
    const res = await fetch('/api/v1/permission-matrix', {
        cache: 'no-store',
        signal,
    })

    const data = await res.json()

    if (!res.ok) {
        throw new Error(data.message || 'โหลด Permission ไม่สำเร็จ')
    }

    return data
}

export default function PermissionPage() {
    const [roles, setRoles] = useState([])
    const [permissions, setPermissions] = useState([])
    const [matrix, setMatrix] = useState({})
    const [canManage, setCanManage] = useState(false)

    const [loading, setLoading] = useState(true)
    const [savingRoleId, setSavingRoleId] = useState(null)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const groupedPermissions = useMemo(
        () => groupPermissionsByModule(permissions),
        [permissions]
    )

    const applyPermissionData = (data) => {
        setRoles(data.roles || [])
        setPermissions(data.permissions || [])
        setMatrix(buildMatrix(data.role_permissions || []))
        setCanManage(Boolean(data.permission?.can_manage))
    }

    const loadPermissionMatrix = async () => {
        setLoading(true)
        setError('')
        setSuccess('')

        try {
            const data = await requestPermissionMatrix()
            applyPermissionData(data)
        } catch (err) {
            console.error('Load permission matrix error:', err)
            setError(err.message || 'โหลด Permission ไม่สำเร็จ')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const controller = new AbortController()
        let ignore = false

        requestPermissionMatrix(controller.signal)
            .then((data) => {
                if (ignore) return
                applyPermissionData(data)
            })
            .catch((err) => {
                if (ignore || err.name === 'AbortError') return

                console.error('Load permission matrix error:', err)
                setError(err.message || 'โหลด Permission ไม่สำเร็จ')
            })
            .finally(() => {
                if (ignore) return
                setLoading(false)
            })

        return () => {
            ignore = true
            controller.abort()
        }
    }, [])

    const hasPermission = (roleId, permissionId) => {
        const key = String(roleId)
        return matrix[key]?.includes(Number(permissionId))
    }

    const togglePermission = (roleId, permissionId) => {
        if (!canManage) return

        const key = String(roleId)

        setMatrix((prev) => {
            const current = prev[key] || []
            const id = Number(permissionId)

            const next = current.includes(id)
                ? current.filter((item) => item !== id)
                : [...current, id]

            return {
                ...prev,
                [key]: next,
            }
        })
    }

    const saveRolePermission = async (roleId) => {
        setSavingRoleId(roleId)
        setError('')
        setSuccess('')

        try {
            const res = await fetch('/api/v1/permission-matrix', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    permission_role_id: roleId,
                    permission_ids: matrix[String(roleId)] || [],
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.message || 'บันทึก Permission ไม่สำเร็จ')
            }

            setSuccess('บันทึก Permission สำเร็จ')
            await loadPermissionMatrix()
        } catch (err) {
            console.error('Save permission error:', err)
            setError(err.message || 'บันทึก Permission ไม่สำเร็จ')
        } finally {
            setSavingRoleId(null)
        }
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 md:px-8">
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300">
                            <FiShield className="text-xl" />
                        </div>

                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            Permission Matrix
                        </h1>

                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            จัดการสิทธิ์การเข้าถึงของแต่ละ Permission Role
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={loadPermissionMatrix}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                        รีเฟรช
                    </button>
                </section>

                {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
                        {success}
                    </div>
                )}

                {!canManage && !loading && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                        คุณมีสิทธิ์ดูเท่านั้น ไม่สามารถแก้ไข Permission ได้
                    </div>
                )}

                <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    {loading ? (
                        <div className="p-8 text-center text-sm text-slate-500">
                            กำลังโหลด Permission...
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-[950px] w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800">
                                        <th className="sticky left-0 z-10 bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                            Permission
                                        </th>

                                        {roles.map((role) => (
                                            <th
                                                key={role.permission_role_id}
                                                className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-200"
                                            >
                                                <div className="space-y-2">
                                                    <p>{role.permission_role_name}</p>

                                                    {canManage && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                saveRolePermission(
                                                                    role.permission_role_id
                                                                )
                                                            }
                                                            disabled={
                                                                savingRoleId ===
                                                                role.permission_role_id
                                                            }
                                                            className="inline-flex items-center justify-center gap-1 rounded-xl bg-sky-500 px-3 py-1.5 text-xs text-white hover:bg-sky-600 disabled:opacity-60"
                                                        >
                                                            {savingRoleId ===
                                                                role.permission_role_id ? (
                                                                <>
                                                                    <FiRefreshCw className="animate-spin" />
                                                                    Saving
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <FiSave />
                                                                    Save
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                <tbody>
                                    {Object.entries(groupedPermissions).map(
                                        ([moduleName, modulePermissions]) => (
                                            <Fragment key={moduleName}>
                                                <tr key={`${moduleName}-header`}>
                                                    <td
                                                        colSpan={roles.length + 1}
                                                        className="bg-slate-50 px-4 py-3 font-bold text-slate-900 dark:bg-slate-950 dark:text-slate-100"
                                                    >
                                                        {moduleName}
                                                    </td>
                                                </tr>

                                                {modulePermissions.map((permission) => (
                                                    <tr
                                                        key={permission.permission_id}
                                                        className="border-t border-slate-100 dark:border-slate-800"
                                                    >
                                                        <td className="sticky left-0 z-10 bg-white px-4 py-3 dark:bg-slate-900">
                                                            <p className="font-medium text-slate-900 dark:text-slate-100">
                                                                {
                                                                    permission.permission_name
                                                                }
                                                            </p>

                                                            <p className="mt-1 text-xs text-slate-400">
                                                                {
                                                                    permission.permission_key
                                                                }
                                                            </p>
                                                        </td>

                                                        {roles.map((role) => {
                                                            const checked =
                                                                hasPermission(
                                                                    role.permission_role_id,
                                                                    permission.permission_id
                                                                )

                                                            return (
                                                                <td
                                                                    key={`${role.permission_role_id}-${permission.permission_id}`}
                                                                    className="px-4 py-3 text-center"
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            togglePermission(
                                                                                role.permission_role_id,
                                                                                permission.permission_id
                                                                            )
                                                                        }
                                                                        disabled={!canManage}
                                                                        className={`
                                                                            mx-auto flex h-7 w-7 items-center justify-center rounded-lg border transition
                                                                            ${checked
                                                                                ? 'border-sky-500 bg-sky-500 text-white'
                                                                                : 'border-slate-300 bg-white text-transparent dark:border-slate-700 dark:bg-slate-950'
                                                                            }
                                                                            ${canManage
                                                                                ? 'cursor-pointer hover:border-sky-500'
                                                                                : 'cursor-not-allowed opacity-70'
                                                                            }
                                                                        `}
                                                                    >
                                                                        <FiCheck />
                                                                    </button>
                                                                </td>
                                                            )
                                                        })}
                                                    </tr>
                                                ))}
                                            </Fragment>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </main>
    )
}