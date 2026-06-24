import { db } from '@/app/lib/db'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/app/lib/permission'

export async function GET(request) {
  try {
    const auth = await requirePermission(request, 'dashboard.view')
    if (auth.response) return auth.response

    const url = new URL(request.url)
    const type = url.searchParams.get('type')

    if (type === 'employee') {
      const [employeeRows] = await db.query("SELECT COUNT(*) AS count FROM `user`");
      return NextResponse.json({ employees: employeeRows[0]?.count ?? 0 });
    }

    if (type === 'department') {
      const [departmentRows] = await db.query('SELECT COUNT(*) AS count FROM department');
      return NextResponse.json({ departments: departmentRows[0]?.count ?? 0 });
    }

    const [employeeRows] = await db.query("SELECT COUNT(*) AS count FROM `user`");
    const [departmentRows] = await db.query('SELECT COUNT(*) AS count FROM department');

    return NextResponse.json({
      employees: employeeRows[0]?.count ?? 0,
      departments: departmentRows[0]?.count ?? 0,
    });
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}
