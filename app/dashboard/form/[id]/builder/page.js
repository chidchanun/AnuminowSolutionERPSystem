'use client'

import { useParams } from 'next/navigation'
import FormBuilderEditor from '@/app/components/FormBuilderEditor'

export default function FormBuilderPage() {
    const params = useParams()

    return <FormBuilderEditor templateId={params.id} />
}