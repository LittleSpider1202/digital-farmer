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

export async function diagnose(
  image: File,
  description: string,
): Promise<DiagnosisResult> {
  const formData = new FormData();
  formData.append("image", image);
  if (description.trim()) {
    formData.append("description", description);
  }

  const res = await fetch(`${API_BASE}/api/diagnose`, {
    method: "POST",
    body: formData,
  });

  const json: ApiResponse = await res.json();

  if (!json.success) {
    throw new ApiError(json.error_code, json.message);
  }

  return json.data;
}
