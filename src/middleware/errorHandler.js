// function notFound(req, res, next) {
//   res.status(404);
//   next(new Error(`Route not found - ${req.originalUrl}`));
// }

// // eslint-disable-next-line no-unused-vars
// function errorHandler(err, req, res, next) {
//   let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
//   let message = err.message || "Server error";

//   // Mongoose bad ObjectId
//   if (err.name === "CastError" && err.kind === "ObjectId") {
//     statusCode = 400;
//     message = "Invalid ID format";
//   }

//   // Mongoose validation error
//   if (err.name === "ValidationError") {
//     statusCode = 400;
//     message = Object.values(err.errors)
//       .map((e) => e.message)
//       .join(", ");
//   }

//   // Duplicate key
//   if (err.code === 11000) {
//     statusCode = 409;
//     const field = Object.keys(err.keyValue || {}).join(", ");
//     message = `Duplicate value for field: ${field}`;
//   }

//   res.status(statusCode).json({
//     success: false,
//     message,
//     stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
//   });
// }

// module.exports = { notFound, errorHandler };









function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Route not found - ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Honour an explicit err.statusCode first: services and helpers throw with it
  // set, and they have no access to `res` to call res.status() beforehand.
  // Without this, a validation error raised inside a helper surfaced as a 500.
  let statusCode =
    Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode <= 599
      ? err.statusCode
      : res.statusCode && res.statusCode !== 200
      ? res.statusCode
      : 500;

  let message = err.message || "Server error";

  // Mongoose bad ObjectId
  if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = 400;
    message = "Invalid ID format";
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  // Duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {}).join(", ");
    message = `Duplicate value for field: ${field}`;
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
}

module.exports = { notFound, errorHandler };