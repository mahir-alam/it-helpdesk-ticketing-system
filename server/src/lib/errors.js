export class ApiError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg = 'Bad request', details) => new ApiError(400, msg, details);
export const unauthorized = (msg = 'Unauthorized') => new ApiError(401, msg);
export const forbidden = (msg = 'Forbidden') => new ApiError(403, msg);
export const notFound = (msg = 'Not found') => new ApiError(404, msg);
export const conflict = (msg = 'Conflict') => new ApiError(409, msg);

// Wrap an async route handler so thrown/rejected errors reach the error middleware.
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
