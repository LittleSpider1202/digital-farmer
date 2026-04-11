const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Product {
  keyword: string;
  name: string;
  image_url: string;
  price: number;
  sales: number;
  buy_url: string;
}

export interface DiagnosisResult {
  diagnosis: {
    disease_name: string;
    confidence: number;
    description: string;
    pathogen: string;
  };
  conditions: {
    climate: string;
    variety: string;
    cultivation: string;
  };
  symptoms: {
    initial: string;
    typical: string;
    late: string;
  };
  treatment: {
    agricultural: string;
    seed_treatment: string;
    chemical: string;
    products: Product[];
  };
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip "data:image/jpeg;base64," prefix
      const base64 = result.split(",", 2)[1];
      if (!base64) {
        reject(new Error("图片编码失败"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

export async function diagnose(
  images: File[],
  description: string,
): Promise<DiagnosisResult> {
  const imagePayloads = await Promise.all(
    images.map(async (file) => ({
      data: await fileToBase64(file),
      mime: file.type,
    })),
  );

  const body = JSON.stringify({
    images: imagePayloads,
    ...(description.trim() ? { description } : {}),
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/diagnose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
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
