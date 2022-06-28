import { ApiReponseError } from "./types";

export default function isApiResponseError(
  obj: ApiReponseError | Error
): obj is ApiReponseError {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return false;
  }

  return "response" in obj && Number.isInteger(obj.response?.statusCode);
}
