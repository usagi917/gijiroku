# app/models.py

from pydantic import BaseModel
from typing import List, Optional

class UploadResponse(BaseModel):
    file_id: str
    filename: str
    upload_date: str
    file_path: str

class TranscriptionResponse(BaseModel):
    transcription_id: str
    file_id: str
    text: str
    created_at: str

class DocumentRequest(BaseModel):
    text: str

class DocumentResponse(BaseModel):
    document_id: str
    transcription_id: str
    type: str  # 'summary' or 'minutes'
    content: str
    created_at: str

class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: dict

class ChatResponse(BaseModel):
    message: str
