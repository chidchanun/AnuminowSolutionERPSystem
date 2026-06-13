'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'

export default function ProjectDetailPage() {
    const params = useParams()

    const [project, setProject] = useState(null)
    const [members, setMembers] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchProject = async () => {
            try {
                const res = await fetch(
                    `/api/v1/project/${params.id}`
                )

                if (!res.ok) return

                const data = await res.json()

                setProject(data.project)
                setMembers(data.members || [])
            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
            }
        }

        if (params.id) {
            fetchProject()
        }
    }, [params.id])

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

    const getStatusText = (status) => {
        switch (status) {
            case 'active':
                return 'กำลังดำเนินการ'

            case 'planning':
                return 'วางแผน'

            case 'completed':
                return 'เสร็จสิ้น'

            case 'cancelled':
                return 'ยกเลิก'

            default:
                return status
        }
    }

    const formatDate = (date) => {
        if (!date) return '-'

        return new Date(date).toLocaleDateString(
            'th-TH',
            {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            }
        )
    }

    if (loading) {
        return (
            <div className="py-6">
                กำลังโหลดข้อมูล...
            </div>
        )
    }

    if (!project) {
        return (
            <div className="py-6">
                ไม่พบข้อมูลโปรเจกต์
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6 py-6">

            {/* Header */}

            <div className="flex items-center justify-between">

                <div>
                    <h1 className="text-3xl font-bold">
                        {project.project_name}
                    </h1>

                    <p className="text-slate-500 mt-1">
                        {project.project_code}
                    </p>
                </div>

                <div className="flex gap-2">

                    <Link
                        href="/dashboard/project"
                        className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100"
                    >
                        กลับ
                    </Link>

                    <Link
                        href={`/dashboard/project/${project.project_id}/edit`}
                        className="px-4 py-2 rounded-xl bg-sky-500 text-white hover:bg-sky-600"
                    >
                        แก้ไข
                    </Link>

                </div>

            </div>

            {/* Summary */}

            <div className="grid gap-4 md:grid-cols-4">

                <StatCard
                    title="สมาชิก"
                    value={members.length}
                />

                <StatCard
                    title="วันเริ่ม"
                    value={formatDate(project.start_date)}
                />

                <StatCard
                    title="วันสิ้นสุด"
                    value={formatDate(project.end_date)}
                />

                <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">

                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        สถานะ
                    </p>

                    <div className="mt-5">
                        <span
                            className={` px-3 py-1 rounded-full font-medium text-lg max-lg:text-[14px] ${getStatusColor(project.status)}`}
                        >
                            {getStatusText(project.status)}
                        </span>
                    </div>

                </article>

            </div>

            {/* Project Info */}

            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">

                <h2 className="text-lg font-semibold text-slate-500 dark:text-slate-400">
                    รายละเอียดโปรเจกต์
                </h2>

                <div className="grid gap-6 md:grid-cols-2">

                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            ชื่อโปรเจกต์
                        </p>

                        <p className="mt-1 font-medium text-black dark:text-white">
                            {project.project_name}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            รหัสโปรเจกต์
                        </p>

                        <p className="mt-1 font-medium text-black dark:text-white">
                            {project.project_code}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            ผู้สร้าง
                        </p>

                        <p className="mt-1 font-medium text-black dark:text-white">
                            {project.created_name}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            วันที่สร้าง
                        </p>

                        <p className="mt-1 font-medium text-black dark:text-white">
                            {formatDate(project.created_at)}
                        </p>
                    </div>

                </div>

                <div className="mt-6">

                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        รายละเอียด
                    </p>

                    <div className="mt-2 rounded-xl  text-black dark:text-white">
                        <div
                            className="
                                mt-2
                                rounded-xl
                                text-black
                                dark:text-white

                                [&_ul]:list-disc
                                [&_ul]:pl-6

                                [&_ol]:list-decimal
                                [&_ol]:pl-6

                                [&_li]:my-1
                            "
                            dangerouslySetInnerHTML={{
                                __html: project.description || '-'
                            }}
                        />
                    </div>

                </div>

            </div>

            {/* Members */}

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">

                <div className="flex items-center justify-between mb-4">

                    <h2 className="text-lg font-semibold text-black dark:text-white">
                        สมาชิกในโปรเจกต์
                    </h2>

                    <span className="text-sm text-slate-500 dark:text-slate-400">
                        {members.length} คน
                    </span>

                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

                    {members.map((member) => (
                        <div
                            key={member.id}
                            className="rounded-xl border border-slate-200 p-4"
                        >

                            <div className="flex items-center gap-3">

                                <div className="h-12 w-12 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center font-semibold">
                                    {/* {member.full_name?.charAt(0)} */}
                                    {member.picture_path ?
                                        <Image
                                            src={member.picture_path}
                                            alt='User Profile'
                                            width={48}
                                            height={48}
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

                        </div>
                    ))}

                </div>

            </div>

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