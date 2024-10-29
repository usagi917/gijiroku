# app/utils.py

import os
import uuid
import datetime
from fastapi import UploadFile
import openai
import subprocess
import requests

# Whisperモデルの参照を削除
# whisper_model = whisper.load_model("medium") は不要になります

def save_upload_file(upload_file: UploadFile, destination: str) -> str:
    """
    アップロードされたファイルを保存し、ファイルパスを返します。
    """
    file_id = str(uuid.uuid4())
    filename = f"{file_id}_{upload_file.filename}"
    file_path = os.path.join(destination, filename)

    with open(file_path, "wb") as buffer:
        buffer.write(upload_file.file.read())

    return file_path, file_id

def transcribe_audio(file_path: str) -> str:
    """
    OpenAI WhisperAPIを使用して音声ファイルを文字起こしします。
    """
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    with open(file_path, "rb") as audio_file:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",  # OpenAIの最新のWhisperモデル
            file=audio_file,
            response_format="text"  # テキスト形式で応答を取得
        )
    
    return transcript

def generate_document(text: str, doc_type: str) -> str:
    # OpenAI clientの初期化
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    if doc_type == "summary":
        prompt = """
        以下の「会議内容」の要点を「出力結果」にまとめてください。

        # フォーマット
        1. サマリー
        2. 決定事項
        3. 次回課題

        会議内容:
        {text}
        """
    elif doc_type == "minutes":
        prompt = """
        以下の会議内容から議事録を作成してください。
        トピックごとに分けて、重要なポイントを箇条書きでまとめてください。

        会議内容:
        {text}
        """
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "あなたはプロの議事録作成者です。"},
                {"role": "user", "content": prompt.format(text=text)}
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        raise Exception(f"文書生成中にエラーが発生しました: {str(e)}")

def generate_chat_response(messages: list, context: dict) -> str:
    """
    GPT-4o-miniを使用してチャットの応答を生成します。
    """
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    # コンテキストを含めたシステムメッセージを作成
    context_text = "以下の情報を参考にして回答してください:\n"
    if context.get("transcription"):
        context_text += f"文字起こし:\n{context['transcription']}\n\n"
    if context.get("summary"):
        context_text += f"要約:\n{context['summary']}\n\n"
    if context.get("minutes"):
        context_text += f"議事録:\n{context['minutes']}\n\n"

    # メッセージの形式を新しいAPIに合わせて変換
    formatted_messages = [{"role": "system", "content": context_text}]
    for msg in messages:
        formatted_messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=formatted_messages,
        temperature=0.7,
    )

    return response.choices[0].message.content

def compress_audio_file(input_file):
    """
    音声ファイルを圧縮して返す
    """
    try:
        # 入力ファイルのサイズを確認
        file_size = os.path.getsize(input_file)
        
        # 25MB以下の場合は圧縮せずに返す
        if file_size <= 25 * 1024 * 1024:  # 25MB
            return input_file
            
        # 出力ファイル名を生成
        output_file = input_file.replace(os.path.splitext(input_file)[1], '_compressed.mp3')
        
        # ffmpegを使用して音声を圧縮
        command = [
            'ffmpeg',
            '-i', input_file,
            '-b:a', '64k',  # ビットレートを64kbpsに設定
            '-ac', '1',     # モノラルに変換
            output_file
        ]
        
        subprocess.run(command, check=True, capture_output=True)
        
        return output_file
        
    except Exception as e:
        print(f"Compression error: {str(e)}")
        return input_file  # 圧縮に失敗した場合は元のファイルを返す
