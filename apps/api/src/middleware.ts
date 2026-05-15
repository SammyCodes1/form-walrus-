import { Request, Response, NextFunction } from "express";
import { WalrusFormError } from "@form-walrus/client";
import { ZodError } from "zod";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Validation Error", details: err.errors });
  }

  const isWalrusError = err instanceof WalrusFormError || err.name === "WalrusFormError";

  if (isWalrusError) {
    const status = (err.code && err.code.includes("NOT_FOUND")) ? 404 : 400;
    return res.status(status).json({
      error: err.name || "WalrusFormError",
      message: err.message,
      code: err.code,
      txDigest: err.txDigest,
    });
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ 
    error: "Internal Server Error", 
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined
  });
}
