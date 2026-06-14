'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { FiChevronDown } from 'react-icons/fi'
import TextEditor from '@/app/components/TextEditor'
import Image from 'next/image'

export default function EditProjectPage() {
    const params = useParams()
    const router = useRouter()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [formData, setFormData] = useState({
        project_name: '',
        project_code: '',
        description: '',
        start_date: '',
        end_date: '',
        status: 'planning',
    })

    const [members, setMembers] = useState([])
    const [allUsers, setAllUsers] = useState([])
    const [showMemberModal, setShowMemberModal] = useState(false)
    const [search, setSearch] = useState('')

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [projectRes, userRes] = await Promise.all([
                    fetch(`/api/v1/project/${params.id}`),
                    fetch('/api/v1/user')
                ])

                const projectData = await projectRes.json()
                const userData = await userRes.json()

                setFormData({
                    project_name: projectData.project.project_name || '',
                    project_code: projectData.project.project_code || '',
                    description: projectData.project.description || '',
                    start_date:
                        projectData.project.start_date?.split('T')[0] || '',
                    end_date:
                        projectData.project.end_date?.split('T')[0] || '',
                    status:
                        projectData.project.status || 'planning',
                })

                setMembers(projectData.members || [])
                setAllUsers(userData.userData || [])
            }
            catch (error) {
                console.error(error)
            }
            finally {
                setLoading(false)
            }
        }

        if (params.id) {
            fetchData()
        }
    }, [params.id])

    const handleChange = (e) => {
        const { name, value } = e.target

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        try {
            setSaving(true)

            const res = await fetch(
                `/api/v1/project/${params.id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ...formData,
                        member_ids: members.map(
                            (member) => member.id
                        )
                    }),
                }
            )

            const data = await res.json()

            if (!res.ok) {
                alert(data.message)
                return
            }

            alert('แก้ไขโปรเจกต์สำเร็จ')

            router.push(
                `/dashboard/project/${params.id}`
            )
        } catch (error) {
            console.error(error)
            alert('เกิดข้อผิดพลาด')
        } finally {
            setSaving(false)
        }
    }

    const filteredUsers = allUsers.filter(
        (user) =>
            `${user.first_name_th} ${user.last_name_th}`
                .toLowerCase()
                .includes(search.toLowerCase())
    )


    const addMember = (user) => {
        const exists = members.some(
            (m) => m.id === user.id
        )

        if (exists) return

        setMembers((prev) => [...prev, user])
    }

    const removeMember = (id) => {
        setMembers((prev) =>
            prev.filter((m) => m.id !== id)
        )
    }

    if (loading) {
        return (
            <div className="py-6">
                กำลังโหลดข้อมูล...
            </div>
        )
    }

    console.log(members)

    return (
        <div className="py-6">

            <div className="max-w-4xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">

                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        แก้ไขโปรเจกต์
                    </h1>

                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        แก้ไขข้อมูลโปรเจกต์ในระบบ
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-6"
                >

                    <div>
                        <label className="block text-sm mb-2">
                            ชื่อโปรเจกต์
                        </label>

                        <input
                            type="text"
                            name="project_name"
                            value={formData.project_name}
                            onChange={handleChange}
                            className="w-full rounded-3xl border border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 text-black dark:text-slate-100 focus:border-sky-300 focus:dark:border-sky-500 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500/20"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-2">
                            รหัสโปรเจกต์
                        </label>

                        <input
                            type="text"
                            name="project_code"
                            value={formData.project_code}
                            onChange={handleChange}
                            className="w-full rounded-3xl border border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 text-black dark:text-slate-100 focus:border-sky-300 focus:dark:border-sky-500 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500/20"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-2">
                            รายละเอียด
                        </label>



                        <TextEditor
                            value={formData.description}
                            onChange={(html) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    description: html
                                }))
                            }
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">

                        <div>
                            <label className="block text-sm mb-2">
                                วันเริ่มต้น
                            </label>

                            <input
                                type="date"
                                name="start_date"
                                value={formData.start_date}
                                onChange={handleChange}
                                className="w-full rounded-3xl border border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 text-black dark:text-slate-100 focus:border-sky-300 focus:dark:border-sky-500 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500/20"
                            />
                        </div>

                        <div>
                            <label className="block text-sm mb-2">
                                วันสิ้นสุด
                            </label>

                            <input
                                type="date"
                                name="end_date"
                                value={formData.end_date}
                                onChange={handleChange}
                                className="w-full rounded-3xl border border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 text-black dark:text-slate-100 focus:border-sky-300 focus:dark:border-sky-500 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500/20"
                            />
                        </div>

                    </div>

                    <div className=''>
                        <label className="block text-sm mb-2">
                            สถานะ
                        </label>
                        <div className='relative'>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="w-full rounded-3xl border border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 px-4 py-3 pr-12 text-black dark:text-slate-100 outline-none appearance-none focus:border-sky-300 focus:dark:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                            >
                                <option value="planning">
                                    วางแผน
                                </option>

                                <option value="active">
                                    กำลังดำเนินการ
                                </option>

                                <option value="completed">
                                    เสร็จสิ้น
                                </option>

                                <option value="cancelled">
                                    ยกเลิก
                                </option>
                            </select>
                            <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600 dark:text-slate-400" />
                        </div>

                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="block text-sm font-medium">
                                สมาชิกโปรเจกต์
                            </label>

                            <button
                                type="button"
                                onClick={() =>
                                    setShowMemberModal(true)
                                }
                                className="px-3 py-2 rounded-xl bg-sky-500 text-white"
                            >
                                + เพิ่มสมาชิก
                            </button>
                        </div>

                        <div className="space-y-2">
                            {members.length === 0 && (
                                <div className="text-slate-500 text-sm">
                                    ยังไม่มีสมาชิก
                                </div>
                            )}

                            {members.map((member) => (
                                <div
                                    key={member.id}
                                    className="rounded-xl border border-slate-200 p-4"
                                >

                                    <div className="flex items-center justify-between">

                                        <div className='flex justify-center gap-2 items-center'>
                                            <div className="h-12 w-12 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center font-semibold">
                                                {/* {member.full_name?.charAt(0)} */}
                                                {member.picture_path ?
                                                    <Image
                                                        src={member.picture_path}
                                                        alt="User Profile"
                                                        width={48}
                                                        height={48}
                                                        sizes="48px"
                                                        className='rounded-full'
                                                    /> :
                                                    member.full_name?.charAt(0)
                                                }
                                            </div>

                                            <div>
                                                <p className="font-medium text-black dark:text-white">
                                                    {member.full_name}
                                                </p>

                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    {member.role_name}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                removeMember(member.id)
                                            }
                                            className="text-red-500"
                                        >
                                            ลบ
                                        </button>
                                    </div>

                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">

                        <button
                            type="button"
                            onClick={() =>
                                router.back()
                            }
                            className="px-4 py-2 rounded-xl border border-slate-300"
                        >
                            ยกเลิก
                        </button>

                        <button
                            type="submit"
                            disabled={saving}
                            className="px-5 py-2 rounded-xl bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-50"
                        >
                            {saving
                                ? 'กำลังบันทึก...'
                                : 'บันทึกข้อมูล'}
                        </button>

                    </div>

                </form>

            </div>
            {
                showMemberModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">

                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-2xl">

                            <div className="flex justify-between mb-4">
                                <h2 className="text-xl font-semibold">
                                    เพิ่มสมาชิก
                                </h2>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowMemberModal(false)
                                    }
                                >
                                    ✕
                                </button>
                            </div>

                            <input
                                type="text"
                                placeholder="ค้นหาพนักงาน"
                                value={search}
                                onChange={(e) =>
                                    setSearch(e.target.value)
                                }
                                className="w-full border rounded-xl px-4 py-3 mb-4"
                            />

                            <div className="max-h-96 overflow-y-auto space-y-2">

                                {filteredUsers.map((user) => {

                                    const exists = members.some(
                                        (m) => m.id === user.id
                                    )

                                    return (
                                        <div
                                            key={user.id}
                                            className="flex items-center justify-between border rounded-xl p-3"
                                        >
                                            <div>
                                                <div className="font-medium">
                                                    {user.first_name_th}
                                                    {' '}
                                                    {user.last_name_th}
                                                </div>

                                                <div className="text-sm text-slate-500">
                                                    {user.role_name}
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                disabled={exists}
                                                onClick={() =>
                                                    addMember(user)
                                                }
                                                className={`px-3 py-2 rounded-lg text-white ${exists
                                                    ? 'bg-slate-400'
                                                    : 'bg-sky-500'
                                                    }`}
                                            >
                                                {
                                                    exists
                                                        ? 'เพิ่มแล้ว'
                                                        : 'เพิ่ม'
                                                }
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>

                        </div>

                    </div>
                )
            }
        </div>
    )
}