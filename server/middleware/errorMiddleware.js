// A known, safe-to-show error: carries an HTTP status and a friendly message
class AppError extends Error {
  constructor(message, statusCode = 500, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}

// Used after all routes: any request that matched nothing ends up here
const notFound = (req, res, next) =>
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));

// Turns well-known library and database errors into friendly AppErrors
function normalizeError(err) {
  if (err instanceof AppError) return err;

  if (err.type === 'entity.parse.failed') return new AppError('Request body is not valid JSON', 400);
  if (err.type === 'entity.too.large') return new AppError('Request body is too large', 413);
  if (err.name === 'MulterError') {
    return new AppError(err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 5 MB)' : err.message, 400);
  }
  if (err.name === 'TokenExpiredError') return new AppError('Your session has expired. Please log in again.', 401);
  if (err.name === 'JsonWebTokenError') return new AppError('Invalid authentication token', 401);

  switch (err.code) {
    case 'ER_DUP_ENTRY':
      return new AppError('That record already exists', 409);
    case 'ER_NO_REFERENCED_ROW_2':
      return new AppError('A related record does not exist', 400);
    case 'ER_ROW_IS_REFERENCED_2':
      return new AppError('This record is in use and cannot be removed', 409);
    case 'ER_DATA_TOO_LONG':
      return new AppError('One of the values is too long', 400);
    case 'ER_BAD_NULL_ERROR':
      return new AppError('A required value is missing', 400);
    case 'ECONNREFUSED':
    case 'PROTOCOL_CONNECTION_LOST':
    case 'ER_CON_COUNT_ERROR':
      return new AppError('The service is temporarily unavailable. Please try again shortly.', 503);
    default:
      break;
  }

  // Errors raised by Express itself (for example a malformed URL) already carry a 4xx status
  if (err.status >= 400 && err.status < 500) return new AppError(err.message, err.status);
  return null;
}

// The single place where every error becomes a JSON response. Must have 4 parameters.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const appError =
    normalizeError(err) || new AppError('Something went wrong on our side. Please try again.', 500);

  // Only server-side failures are logged. Clients never see the real error text.
  if (appError.statusCode >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl} -> ${appError.statusCode}`, err);
  }

  const body = { success: false, message: appError.message };
  if (appError.details) body.details = appError.details;
  if (process.env.NODE_ENV === 'development' && appError.statusCode >= 500) body.stack = err.stack;

  return res.status(appError.statusCode).json(body);
}

module.exports = { AppError, notFound, errorHandler };
