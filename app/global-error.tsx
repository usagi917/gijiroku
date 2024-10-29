'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html>
      <body>
        <div className="flex h-screen flex-col items-center justify-center">
          <h2 className="text-2xl font-bold mb-4">予期せぬエラーが発生しました</h2>
          <p className="text-gray-600 mb-4">申し訳ありませんが、システムエラーが発生しました。</p>
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            もう一度試す
          </button>
        </div>
      </body>
    </html>
  )
}
