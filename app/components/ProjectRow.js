import Link from 'next/link'
import React from 'react'

function ProjectRow({
    project,
    selectedColumns,
    getStatusColor,
}) {
    const formatDate = (date) =>
        date
            ? new Intl.DateTimeFormat('th-TH', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            }).format(new Date(date))
            : '-'
    const stripHtml = (html) => {
        if (!html) return ''

        const doc = new DOMParser().parseFromString(
            html,
            'text/html'
        )

        return doc.body.textContent || ''
    }
    return (
        <tr className="border-t border-slate-200 dark:border-slate-800">
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

                    <div className="text-xs text-slate-500 line-clamp-2">
                        {stripHtml(project.description)}
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
                    <div className="font-medium">
                        {formatDate(project.start_date)}
                    </div>
                </td>
            )}
            {selectedColumns.includes('project_end_date') && (
                <td className="px-4 py-3">
                    <div className="font-medium">
                        {formatDate(project.end_date)}
                    </div>
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
    )
}

export default React.memo(ProjectRow)