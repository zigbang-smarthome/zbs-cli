export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class ApiError extends Error {
  readonly endpoint: string;
  readonly status: number;
  readonly responseBody: string;
  constructor(endpoint: string, status: number, message: string, responseBody: string) {
    super(`${endpoint} (${status}): ${message}`);
    this.name = "ApiError";
    this.endpoint = endpoint;
    this.status = status;
    this.responseBody = responseBody;
  }
}
