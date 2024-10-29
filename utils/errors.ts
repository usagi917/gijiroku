export class TranscriptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TranscriptionError'
  }
}

export class AudioProcessingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AudioProcessingError'
  }
}

export class FileUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileUploadError'
  }
} 