export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "TOKEN_EXPIRED"
  | "INVALID_CREDENTIALS"
  | "REFRESH_TOKEN_INVALID"
  | "REFRESH_TOKEN_REUSED"
  | "FORBIDDEN"
  | "CONSENT_REQUIRED"
  | "NOT_FOUND"
  | "EMAIL_TAKEN"
  | "REQUEST_IN_PROGRESS"
  | "SOURCE_NOT_READY"
  | "JOB_NOT_RETRYABLE"
  | "IDEMPOTENCY_KEY_REUSED"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "TOO_MANY_FILES"
  | "FILE_CORRUPT"
  | "PDF_ENCRYPTED"
  | "TOO_MANY_PAGES"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "AI_NOT_CONFIGURED"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_TIMEOUT"
  | "AI_CONTENT_BLOCKED"
  | "AI_OUTPUT_INVALID"
  | "IMAGE_UNREADABLE"
  | "NO_EXTRACTABLE_CONTENT"
  | "EXTRACTION_FAILED"
  | "INTERNAL_ERROR";

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  requestId?: string;
  details: Record<string, any> | null;
}

const ERROR_METADATA: Record<
  ErrorCode,
  { httpStatus: number; retryable: boolean; th: string; en: string }
> = {
  VALIDATION_ERROR: {
    httpStatus: 422,
    retryable: false,
    th: "ข้อมูลที่ส่งมาไม่ถูกต้อง",
    en: "Invalid request data",
  },
  UNAUTHENTICATED: {
    httpStatus: 401,
    retryable: false,
    th: "กรุณาเข้าสู่ระบบก่อนใช้งาน",
    en: "Authentication required",
  },
  TOKEN_EXPIRED: {
    httpStatus: 401,
    retryable: true,
    th: "โทเคนหมดอายุ กรุณาต่ออายุโทเคน",
    en: "Access token expired",
  },
  INVALID_CREDENTIALS: {
    httpStatus: 401,
    retryable: false,
    th: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    en: "Invalid email or password",
  },
  REFRESH_TOKEN_INVALID: {
    httpStatus: 401,
    retryable: false,
    th: "รีเฟรชโทเคนไม่ถูกต้องหรือหมดอายุ",
    en: "Refresh token is invalid or expired",
  },
  REFRESH_TOKEN_REUSED: {
    httpStatus: 401,
    retryable: false,
    th: "ตรวจพบการใช้โทเคนซ้ำ กรุณาเข้าสู่ระบบใหม่",
    en: "Refresh token reuse detected; session revoked",
  },
  FORBIDDEN: {
    httpStatus: 403,
    retryable: false,
    th: "ไม่มีสิทธิ์เข้าถึงข้อมูลนี้",
    en: "Action not permitted",
  },
  CONSENT_REQUIRED: {
    httpStatus: 403,
    retryable: false,
    th: "กรุณายินยอมให้ประมวลผลข้อมูลด้วย AI ก่อนใช้งาน",
    en: "User consent required for AI processing",
  },
  NOT_FOUND: {
    httpStatus: 404,
    retryable: false,
    th: "ไม่พบข้อมูลที่ต้องการ",
    en: "Resource not found",
  },
  EMAIL_TAKEN: {
    httpStatus: 409,
    retryable: false,
    th: "อีเมลนี้ถูกใช้งานแล้ว",
    en: "Email is already registered",
  },
  REQUEST_IN_PROGRESS: {
    httpStatus: 409,
    retryable: true,
    th: "กำลังประมวลผลคำขอที่ซ้ำกัน กรุณารอสักครู่",
    en: "Duplicate request is already in progress",
  },
  SOURCE_NOT_READY: {
    httpStatus: 409,
    retryable: true,
    th: "เอกสารยังประมวลผลไม่เสร็จ หรือเกิดข้อผิดพลาด",
    en: "Source is not ready or failed processing",
  },
  JOB_NOT_RETRYABLE: {
    httpStatus: 409,
    retryable: false,
    th: "งานนี้ไม่สามารถลองใหม่ได้ในสถานะปัจจุบัน",
    en: "Job state does not allow retry or cancel",
  },
  IDEMPOTENCY_KEY_REUSED: {
    httpStatus: 422,
    retryable: false,
    th: "คีย์ Idempotency ถูกใช้ซ้ำกับข้อมูลคำขอที่แตกต่างกัน",
    en: "Idempotency key reused with different body",
  },
  FILE_TOO_LARGE: {
    httpStatus: 413,
    retryable: false,
    th: "ขนาดไฟล์ใหญ่เกินกว่าที่กำหนด",
    en: "File size exceeds maximum limit",
  },
  UNSUPPORTED_MEDIA_TYPE: {
    httpStatus: 415,
    retryable: false,
    th: "ประเภทไฟล์ไม่รองรับ หรือเนื้อหาไฟล์ไม่ตรงกับนามสกุล",
    en: "Unsupported media type or format mismatch",
  },
  TOO_MANY_FILES: {
    httpStatus: 422,
    retryable: false,
    th: "จำนวนไฟล์เกินกว่าที่กำหนด",
    en: "Too many files uploaded",
  },
  FILE_CORRUPT: {
    httpStatus: 422,
    retryable: false,
    th: "ไฟล์เสียหายหรือไม่สามารถเปิดอ่านได้",
    en: "File is corrupt or cannot be parsed",
  },
  PDF_ENCRYPTED: {
    httpStatus: 422,
    retryable: false,
    th: "เอกสาร PDF มีรหัสผ่านป้องกัน",
    en: "PDF file is password protected",
  },
  TOO_MANY_PAGES: {
    httpStatus: 422,
    retryable: false,
    th: "จำนวนหน้าเกินกว่าที่กำหนด",
    en: "Document exceeds maximum page count",
  },
  RATE_LIMITED: {
    httpStatus: 429,
    retryable: true,
    th: "ส่งคำขอถี่เกินไป กรุณารอสักครู่",
    en: "Too many requests; please slow down",
  },
  QUOTA_EXCEEDED: {
    httpStatus: 429,
    retryable: false,
    th: "โควตาการใช้งาน AI ประจำวันเต็มแล้ว",
    en: "Daily AI generation or chat quota exceeded",
  },
  AI_NOT_CONFIGURED: {
    httpStatus: 503,
    retryable: false,
    th: "ระบบ AI ยังไม่ได้กำหนดค่า",
    en: "AI provider or model is not configured",
  },
  AI_PROVIDER_UNAVAILABLE: {
    httpStatus: 503,
    retryable: true,
    th: "ระบบ AI ไม่พร้อมให้บริการในขณะนี้ กรุณาลองใหม่",
    en: "AI provider is temporarily unavailable",
  },
  AI_TIMEOUT: {
    httpStatus: 504,
    retryable: true,
    th: "ระบบ AI ตอบสนองช้าเกินเวลาที่กำหนด กรุณาลองใหม่",
    en: "AI provider request timed out",
  },
  AI_CONTENT_BLOCKED: {
    httpStatus: 422,
    retryable: false,
    th: "เนื้อหาถูกระงับเนื่องจากนโยบายความปลอดภัย",
    en: "Content was blocked by safety policy",
  },
  AI_OUTPUT_INVALID: {
    httpStatus: 502,
    retryable: true,
    th: "ผลลัพธ์จาก AI ไม่สมบูรณ์หรือไม่ตรงตามรูปแบบ กรุณาลองใหม่",
    en: "AI output was invalid after repair retry",
  },
  IMAGE_UNREADABLE: {
    httpStatus: 422,
    retryable: false,
    th: "ภาพไม่ชัดเจนหรือไม่สามารถอ่านข้อความได้",
    en: "Images are unreadable or illegible",
  },
  NO_EXTRACTABLE_CONTENT: {
    httpStatus: 422,
    retryable: false,
    th: "ไม่พบข้อความที่สามารถนำมาใช้งานได้",
    en: "No extractable text found in document",
  },
  EXTRACTION_FAILED: {
    httpStatus: 502,
    retryable: true,
    th: "การสกัดข้อความล้มเหลว กรุณาลองใหม่",
    en: "Document text extraction failed",
  },
  INTERNAL_ERROR: {
    httpStatus: 500,
    retryable: true,
    th: "เกิดข้อผิดพลาดภายในระบบ",
    en: "An internal server error occurred",
  },
};

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly retryable: boolean;
  public readonly details: Record<string, any> | null;

  constructor(
    code: ErrorCode,
    options?: {
      message?: string;
      details?: Record<string, any> | null;
      httpStatus?: number;
      retryable?: boolean;
    },
  ) {
    const meta = ERROR_METADATA[code] || {
      httpStatus: 500,
      retryable: true,
      th: "เกิดข้อผิดพลาด",
      en: "An error occurred",
    };
    super(options?.message || meta.th);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = options?.httpStatus ?? meta.httpStatus;
    this.retryable = options?.retryable ?? meta.retryable;
    this.details = options?.details ?? null;
  }

  public toResponse(lang: "th" | "en" = "th", requestId?: string): { error: ErrorBody } {
    const meta = ERROR_METADATA[this.code];
    const message =
      this.message && this.message !== meta.th && this.message !== meta.en
        ? this.message
        : lang === "en"
          ? meta.en
          : meta.th;

    return {
      error: {
        code: this.code,
        message,
        retryable: this.retryable,
        ...(requestId ? { requestId } : {}),
        details: this.details,
      },
    };
  }
}

export function formatErrorBody(
  code: ErrorCode,
  lang: "th" | "en" = "th",
  details: Record<string, any> | null = null,
): Omit<ErrorBody, "requestId"> {
  const meta = ERROR_METADATA[code] || ERROR_METADATA.INTERNAL_ERROR;
  return {
    code,
    message: lang === "en" ? meta.en : meta.th,
    retryable: meta.retryable,
    details,
  };
}
