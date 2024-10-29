'use client'

import { useEffect } from 'react'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // エラーロギングサービスへの送信などを行う
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>エラーが発生しました</AlertTitle>
        <AlertDescription>
          {error.message || 'アプリケーションでエラーが発生しました。'}
        </AlertDescription>
      </Alert>
      <Button onClick={reset} variant="outline">
        もう一度試す
      </Button>
    </div>
  )
}
