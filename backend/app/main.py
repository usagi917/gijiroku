# app/main.py

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import uuid
import shutil
from datetime import datetime
from typing import List
from dotenv import load_dotenv

from .models import (
    UploadResponse,
    TranscriptionResponse,
    DocumentRequest,
    DocumentResponse,
    ChatRequest,
    ChatResponse,
    ChatMessage
)
from .utils import (
    save_upload_file,
    transcribe_audio,
    generate_document,
    generate_chat_response,
    compress_audio_file
)

load_dotenv()  # .envファイルを読み込む

app = FastAPI()

origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = os.path.join(os.getcwd(), "app", "temp_files")
os.makedirs(TEMP_DIR, exist_ok=True)

@app.post("/api/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    allowed_types = [
        'audio/wav',
        'audio/mpeg',
        'audio/mp4',
        'audio/x-m4a',
        'audio/aac',
        'audio/ogg'     # Oggフォーマットを追加
    ]
    
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="無効なファイル形式です。WAV、MP3、M4A、OGG形式のみ許可されています。"
        )
    
    # ファイルサイズをチェック
    file_size = await file.read()
    if len(file_size) > 300 * 1024 * 1024:  # 300MB
        raise HTTPException(
            status_code=400, 
                detail="ファイルサイズが大きすぎます。最大300MBまで許可されています。"
        )
    await file.seek(0)  # ファイルポインタを先頭に戻す

    try:
        file_path, file_id = save_upload_file(file, TEMP_DIR)
        upload_date = datetime.utcnow().isoformat()
        response = UploadResponse(
            file_id=file_id,
            filename=file.filename,
            upload_date=upload_date,
            file_path=file_path
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/transcribe/{file_id}", response_model=TranscriptionResponse)
async def transcribe(file_id: str):
    try:
        # ファイルの存在確認を強化
        if not os.path.exists(TEMP_DIR):
            raise HTTPException(status_code=404, detail="一時ディレクトリが存在しません。")

        files = os.listdir(TEMP_DIR)
        target_file = None
        for f in files:
            if f.startswith(file_id):
                target_file = os.path.join(TEMP_DIR, f)
                break

        if not target_file:
            raise HTTPException(status_code=404, detail="指定されたファイルが見つかりません。")

        if not os.path.isfile(target_file):
            raise HTTPException(status_code=404, detail="ファイルが存在しません。")

        # 必要に応じてファイルを圧縮
        compressed_file = compress_audio_file(target_file)
        
        # 文字起こし処理
        text = transcribe_audio(compressed_file)
        
        # 圧縮ファイルの削除
        if compressed_file != target_file:
            try:
                os.remove(compressed_file)
            except OSError as e:
                print(f"Warning: Failed to remove compressed file: {e}")

        if not text:
            raise HTTPException(status_code=500, detail="文字起こしの結果が空です。")

        transcription_id = str(uuid.uuid4())
        created_at = datetime.utcnow().isoformat()

        # ファイル削除を try-except で囲む
        try:
            os.remove(target_file)
        except OSError as e:
            print(f"Warning: Failed to remove temporary file: {e}")

        return TranscriptionResponse(
            transcription_id=transcription_id,
            file_id=file_id,
            text=text,
            created_at=created_at
        )

    except HTTPException:
        raise
    except Exception as e:
        # より詳細なエラーログ
        import traceback
        print(f"Transcription error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"文字起こし処理中にエラーが発生しました: {str(e)}"
        )

@app.post("/api/summarize", response_model=DocumentResponse)
async def summarize(request: DocumentRequest):
    try:
        summary = generate_document(request.text, "summary")
        document_id = str(uuid.uuid4())
        transcription_id = str(uuid.uuid4())
        created_at = datetime.utcnow().isoformat()
        response = DocumentResponse(
            document_id=document_id,
            transcription_id=transcription_id,
            type="summary",
            content=summary,
            created_at=created_at
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/minutes", response_model=DocumentResponse)
async def minutes(request: DocumentRequest):
    try:
        minutes = generate_document(request.text, "minutes")
        document_id = str(uuid.uuid4())
        transcription_id = str(uuid.uuid4())
        created_at = datetime.utcnow().isoformat()
        response = DocumentResponse(
            document_id=document_id,
            transcription_id=transcription_id,
            type="minutes",
            content=minutes,
            created_at=created_at
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        response_message = generate_chat_response(request.messages, request.context)
        response = ChatResponse(message=response_message)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
