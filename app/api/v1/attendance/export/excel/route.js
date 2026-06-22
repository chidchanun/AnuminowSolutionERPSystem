import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import {
    canExportAttendance,
    getAttendanceExportAuthUser,
    getAttendanceExportData,
    getAttendanceExportFilters,
    getAttendanceStatusLabel,
} from '@/app/lib/attendanceExportData'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function setupSheet(sheet) {
    sheet.views = [
        {
            state: 'frozen',
            ySplit: 1,
        },
    ]

    sheet.getRow(1).font = {
        bold: true,
        color: {
            argb: 'FFFFFFFF',
        },
    }

    sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
            argb: 'FF0F172A',
        },
    }

    sheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.alignment = {
                vertical: 'top',
                wrapText: true,
            }

            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            }
        })
    })
}

function addInfoSheet(workbook, data, user) {
    const sheet = workbook.addWorksheet('ข้อมูล Export')

    sheet.columns = [
        { header: 'หัวข้อ', key: 'label', width: 28 },
        { header: 'ข้อมูล', key: 'value', width: 55 },
    ]

    const filters = data.filters

    sheet.addRows([
        { label: 'ชื่อรายงาน', value: 'Attendance Report' },
        { label: 'Export โดย', value: user.id },
        { label: 'วันที่ Export', value: new Date(data.generated_at).toLocaleString('th-TH') },
        { label: 'From', value: filters.from },
        { label: 'To', value: filters.to },
        { label: 'Department ID', value: filters.department_id || 'ทั้งหมด' },
        { label: 'Role ID', value: filters.role_id || 'ทั้งหมด' },
        { label: 'User ID', value: filters.user_id || 'ทั้งหมด' },
        { label: 'Status', value: filters.status === 'all' ? 'ทั้งหมด' : getAttendanceStatusLabel(filters.status) },
        { label: 'จำนวนรายการ', value: data.attendance.length },
        { label: 'มาทำงาน', value: data.summary.present },
        { label: 'มาสาย', value: data.summary.late },
        { label: 'ขาดงาน', value: data.summary.absent },
        { label: 'ลา', value: data.summary.leave },
    ])

    setupSheet(sheet)
}

function addAttendanceSheet(workbook, rows) {
    const sheet = workbook.addWorksheet('Attendance')

    sheet.columns = [
        { header: 'วันที่', key: 'work_date', width: 16 },
        { header: 'รหัสพนักงาน', key: 'user_id', width: 18 },
        { header: 'ชื่อไทย', key: 'full_name_th', width: 30 },
        { header: 'ชื่ออังกฤษ', key: 'full_name_en', width: 30 },
        { header: 'Email', key: 'email', width: 35 },
        { header: 'แผนก', key: 'department_name', width: 25 },
        { header: 'ตำแหน่ง', key: 'role_name', width: 25 },
        { header: 'สถานะ', key: 'status', width: 16 },
        { header: 'Check In', key: 'check_in_time', width: 14 },
        { header: 'Check Out', key: 'check_out_time', width: 14 },
        { header: 'หมายเหตุ', key: 'note', width: 35 },
    ]

    rows.forEach((row) => {
        sheet.addRow({
            work_date: row.work_date
                ? new Date(row.work_date).toLocaleDateString('th-TH')
                : '-',
            user_id: row.user_id,
            full_name_th: row.full_name_th || '-',
            full_name_en: row.full_name_en || '-',
            email: row.email || '-',
            department_name: row.department_name || '-',
            role_name: row.role_name || '-',
            status: getAttendanceStatusLabel(row.status),
            check_in_time: row.check_in_time || '-',
            check_out_time: row.check_out_time || '-',
            note: row.note || '-',
        })
    })

    setupSheet(sheet)
}

export async function GET(request) {
    try {
        const user = await getAttendanceExportAuthUser(request)

        if (!user) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized' },
                { status: 401 }
            )
        }

        if (!canExportAttendance(user)) {
            return NextResponse.json(
                { success: false, message: 'ไม่มีสิทธิ์ Export Attendance' },
                { status: 403 }
            )
        }

        const filters = getAttendanceExportFilters(request)

        const data = await getAttendanceExportData(filters)

        const workbook = new ExcelJS.Workbook()

        workbook.creator = 'ERP System'
        workbook.created = new Date()

        addInfoSheet(workbook, data, user)
        addAttendanceSheet(workbook, data.attendance)

        const buffer = await workbook.xlsx.writeBuffer()

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type':
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition':
                    `attachment; filename="attendance-${Date.now()}.xlsx"`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (error) {
        console.error('Export Attendance Excel Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'Export Attendance Excel ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}