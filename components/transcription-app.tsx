'use client'

import React, { useState, useRef, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, Copy, Moon, Sun, Upload, Mic, FileText, FileCheck, Loader2, Send } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

type FileInfo = {
  file_id: string
  filename: string
  upload_date: string
  file_path: string
}

type TranscriptionResult = {
  transcription_id: string
  file_id: string
  text: string
  created_at: string
}

type DocumentResult = {
  document_id: string
  transcription_id: string
  type: 'summary' | 'minutes'
  content: string
  created_at: string
}

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export function TranscriptionAppComponent() {
  const [file, setFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [transcriptionProgress, setTranscriptionProgress] = useState(0)
  const [transcription, setTranscription] = useState<string>('')
  const [summary, setSummary] = useState<string>('')
  const [minutes, setMinutes] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState('transcription')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [currentMessage, setCurrentMessage] = useState('')

  const transcriptionRef = useRef<HTMLTextAreaElement>(null)
  const summaryRef = useRef<HTMLTextAreaElement>(null)
  const minutesRef = useRef<HTMLTextAreaElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  const { toast } = useToast()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) {
      setError('ファイルがアップロードされていません。')
      return
    }

    const file = acceptedFiles[0]
    const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a']
    const maxSize = 300 * 1024 * 1024 // 300MB

    // ファイル形式のチェック
    if (!allowedTypes.includes(file.type)) {
      setError('無効なファイル形式です。WAV、MP3、M4A形式のファイルをアップロードしてください。')
      return
    }

    // ファイルサイズのチェック
    if (file.size > maxSize) {
      setError(`ファイルサイズが大きすぎます。${maxSize / 1024 / 1024}MB以下のファイルをアップロードしてください。`)
      return
    }

    try {
      setFile(file)
      setError('')
      toast({
        title: "成功",
        description: "ファイルが正常にアップロードされました。",
      })
    } catch (error) {
      setError('ファイルの処理中にエラーが発生しました。もう一度お試しください。')
      console.error('File processing error:', error)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  const uploadFile = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsProcessing(true);
    try {
      const response = await axios.post('http://localhost:5001/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total ?? 1));
          setUploadProgress(percentCompleted);
        },
      });

      const fileInfo: FileInfo = response.data;
      await transcribeAudio(fileInfo.file_id);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.detail 
          || error.response?.data?.message 
          || error.message 
          || 'ファイルのアップロードに失敗しました。';

        const statusMessage = error.response?.status ? 
          `(エラーコード: ${error.response.status})` : '';

        const fullErrorMessage = `${errorMessage} ${statusMessage}`;
        
        setError(fullErrorMessage);
        toast({
          title: "アップロードエラー",
          description: fullErrorMessage,
          variant: "destructive",
        });

        console.error('Upload error details:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
      } else {
        const errorMessage = '予期せぬエラーが発生しました。';
        setError(errorMessage);
        toast({
          title: "エラー",
          description: errorMessage,
          variant: "destructive",
        });
        console.error('Unexpected error:', error);
      }
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  const transcribeAudio = async (fileId: string) => {
    try {
      const response = await axios.get(`http://localhost:5001/api/transcribe/${fileId}`)
      if (!response.data || !response.data.text) {
        throw new Error('文字起こしの結果が空です')
      }
      const result: TranscriptionResult = response.data
      setTranscription(result.text)
      setTranscriptionProgress(100)
      toast({
        title: "成功",
        description: "音声の文字起こしが完了しました。",
      })
    } catch (error) {
      setError('音声の文字起こしに失敗しました。')
      toast({
        title: "エラー",
        description: "音声の文字起こしに失敗しました。",
        variant: "destructive",
      })
      console.error('Transcription error:', error)
    }
  }

  const generateSummary = async () => {
    setIsProcessing(true)
    try {
      const response = await axios.post('http://localhost:5001/api/summarize', { text: transcription })
      const result: DocumentResult = response.data
      setSummary(result.content)
      setActiveTab('summary')
      toast({
        title: "成功",
        description: "要約の生成が完了しました。",
      })
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.data?.error?.code === 'insufficient_quota') {
          setError('OpenAIのAPI使用制限に達しました。請求情報を確認してください。')
          toast({
            title: "APIエラー",
            description: "OpenAIのAPI使用制限に達しました。",
            variant: "destructive",
          })
        } else {
          setError('要約の生成に失敗しました。')
          toast({
            title: "エラー",
            description: "要約の生成に失敗しました。",
            variant: "destructive",
          })
        }
      }
      console.error('Summary generation error:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const generateMinutes = async () => {
    setIsProcessing(true)
    try {
      const response = await axios.post('http://localhost:5001/api/minutes', { text: transcription })
      const result: DocumentResult = response.data
      setMinutes(result.content)
      setActiveTab('minutes')
      toast({
        title: "成功",
        description: "議事録の生成が完了しました。",
      })
    } catch (error) {
      setError('議事録の生成に失敗しました。')
      toast({
        title: "エラー",
        description: "議事録の生成に失敗しました。",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "コピー完了",
      description: "テキストがクリップボードにコピーされました。",
    })
  }

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
    document.documentElement.classList.toggle('dark')
  }

  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return

    const newMessage: ChatMessage = { role: 'user', content: currentMessage }
    setChatMessages([...chatMessages, newMessage])
    setCurrentMessage('')

    try {
      const response = await axios.post('http://localhost:5001/api/chat', {
        messages: [...chatMessages, newMessage],
        context: { transcription, summary, minutes }
      })
      const assistantMessage: ChatMessage = { role: 'assistant', content: response.data.message }
      setChatMessages([...chatMessages, newMessage, assistantMessage])
    } catch (error) {
      setError('チャットメッセージの送信に失敗しました。')
      toast({
        title: "エラー",
        description: "チャットメッセージの送信に失敗しました。",
        variant: "destructive",
      })
    }
  }

  return (
    <div className={`min-h-screen p-8 ${isDarkMode ? 'dark bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600"
          >
            音声文字起こしアプリ
          </motion.h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch id="dark-mode" checked={isDarkMode} onCheckedChange={toggleDarkMode} />
              <Label htmlFor="dark-mode">{isDarkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Label>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>エラー</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="mb-8 overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="h-5 w-5" />
                <span>ファイルアップロード</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-300 ${
                  isDragActive ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-300 dark:border-gray-700'
                }`}
              >
                <input {...getInputProps()} />
                <Mic className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2">クリックしてファイルを選択するか、ファイルをここにドラッグ＆ドロップしてください</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">WAV、MP3、M4A形式（最大100MB）</p>
              </div>
              {file && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-4"
                >
                  <p className="flex items-center space-x-2">
                    <FileCheck className="h-5 w-5 text-green-500" />
                    <span>選択されたファイル: {file.name}</span>
                  </p>
                  <Button onClick={uploadFile} className="mt-2" disabled={isProcessing}>
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        処理中...
                      </>
                    ) : (
                      'アップロード'
                    )}
                  </Button>
                </motion.div>
              )}
              {uploadProgress > 0 && uploadProgress < 100 && (
                <Progress value={uploadProgress} className="mt-4" />
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="transcription">文字起こし</TabsTrigger>
              <TabsTrigger value="summary">要約</TabsTrigger>
              <TabsTrigger value="minutes">議事録</TabsTrigger>
              <TabsTrigger value="chat">チャット</TabsTrigger>
            </TabsList>
            <TabsContent value="transcription">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>文字起こし結果</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    ref={transcriptionRef}
                    value={transcription}
                    onChange={(e) => setTranscription(e.target.value)}
                    className="w-full h-48 mb-4"
                    placeholder="文字起こし結果がここに表示されます..."
                  />
                  {transcriptionProgress > 0 && transcriptionProgress < 100 && (
                    <Progress value={transcriptionProgress} className="mb-4" />
                  )}
                  <div className="flex justify-between">
                    <Button onClick={generateSummary} disabled={!transcription || isProcessing}>
                      {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      要約作成
                    </Button>
                    <Button onClick={generateMinutes} disabled={!transcription || isProcessing}>
                      {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      議事録作成
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="summary">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>要約</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    ref={summaryRef}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className="w-full h-48 mb-4"
                    placeholder="要約がここに表示されます..."
                  />
                  <Button onClick={() => copyToClipboard(summary)} disabled={!summary}>
                    <Copy className="mr-2 h-4 w-4" /> コピー
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="minutes">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>議事録</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    ref={minutesRef}
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    className="w-full h-48 mb-4"
                    placeholder="議事録がここに表示されます..."
                  />
                  <Button onClick={() => copyToClipboard(minutes)} disabled={!minutes}>
                    <Copy className="mr-2 h-4 w-4" /> コピー
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="chat">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>チャット</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] mb-4">
                    {chatMessages.map((message, index) => (
                      <div key={index} className={`mb-2 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                        <span className={`inline-block p-2 rounded-lg ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                          {message.content}
                        </span>
                      </div>
                    ))}
                  </ScrollArea>
                  <div className="flex items-center space-x-2">
                    <Input
                      ref={chatInputRef}
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      placeholder="メッセージを入力..."
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <Button onClick={handleSendMessage}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  )
}