const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface DiagnosisResult {
  diagnosis: {
    disease_name: string;
    confidence: number;
    description: string;
  };
  prevention: string[];
  intervention: {
    action: string;
    details: string;
    products: {
      keyword: string;
      name: string;
      image_url: string;
      price: number;
      sales: number;
      buy_url: string;
    }[];
  }[];
}

interface ApiSuccessResponse {
  success: true;
  data: DiagnosisResult;
}

interface ApiErrorResponse {
  success: false;
  error_code: string;
  message: string;
}

type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const REQUEST_TIMEOUT_MS = 90_000;

export async function diagnose(
  image: File,
  description: string,
): Promise<DiagnosisResult> {
  const formData = new FormData();
  formData.append("image", image);
  if (description.trim()) {
    formData.append("description", description);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/diagnose`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ApiError("TIMEOUT", "请求超时，请稍后重试");
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  let json: ApiResponse;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(
      `HTTP_${res.status}`,
      `服务器返回了无效的响应格式（状态码 ${res.status}）`,
    );
  }

  if (!json.success) {
    throw new ApiError(json.error_code, json.message);
  }

  return json.data;
}
