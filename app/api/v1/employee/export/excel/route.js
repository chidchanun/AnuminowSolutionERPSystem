import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import {
    canExportEmployee,
    getEmployeeExportAuthUser,
    getEmployeeExportData,
    getEmployeeExportFilters,
    getEmployeeStatusLabel,
} from '@/app/lib/employeeExportData'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
    try {
        const user = await getEmployeeExportAuthUser(request)

        if (!user) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized' },
                { status: 401 }
            )
        }

        if (!canExportEmployee(user)) {
            return NextResponse.json(
                { success: false, message: 'ไม่มีสิทธิ์ Export Employee' },
                { status: 403 }
            )
        }

        const filters = getEmployeeExportFilters(request)
        const data = await getEmployeeExportData(filters)

        const workbook = new ExcelJS.Workbook()
        workbook.creator = 'ERP System'
        workbook.created = new Date()

        const sheet = workbook.addWorksheet('Employees')

        sheet.columns = [
            { header: 'รหัสพนักงาน', key: 'id', width: 18 },
            { header: 'ชื่อไทย', key: 'full_name_th', width: 30 },
            { header: 'ชื่ออังกฤษ', key: 'full_name_en', width: 30 },
            { header: 'Email', key: 'email', width: 35 },
            { header: 'แผนก', key: 'department_name', width: 25 },
            { header: 'ตำแหน่ง', key: 'role_name', width: 25 },
            { header: 'สถานะ', key: 'status', width: 18 },
            { header: 'วันที่สร้าง', key: 'created_at', width: 22 },
        ]

        data.employees.forEach((employee) => {
            sheet.addRow({
                id: employee.id,
                full_name_th: `${employee.prefix || ''}${employee.first_name_th || ''} ${employee.last_name_th || ''}`.trim(),
                full_name_en: `${employee.first_name_en || ''} ${employee.last_name_en || ''}`.trim(),
                email: employee.email || '-',
                department_name: employee.department_name || '-',
                role_name: employee.role_name || '-',
                status: getEmployeeStatusLabel(employee.status),
                created_at: employee.created_at
                    ? new Date(employee.created_at).toLocaleString('th-TH')
                    : '-',
            })
        })

        sheet.getRow(1).font = {
            bold: true,
            color: { argb: 'FFFFFFFF' },
        }

        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0F172A' },
        }

        sheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.alignment = {
                    vertical: 'top',
                    wrapText: true,
                }
            })
        })

        const buffer = await workbook.xlsx.writeBuffer()

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type':
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition':
                    `attachment; filename="employees-${Date.now()}.xlsx"`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (error) {
        console.error('Export Employee Excel error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'Export Employee Excel ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}