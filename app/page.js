'use client'
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {

  const router = useRouter()

  useEffect(() => {
    const RequestChecktoken = async () => {
      const res = await fetch('/api/v1/auth/me', {
        method : 'GET',
        credentials : 'include'
      })

      if (!res.ok) {
        router.replace('/login')
      }

      router.replace('/dashboard')
    }

    RequestChecktoken()
  }, [router])

  return (
    <div className="">

    </div>
  );
}
