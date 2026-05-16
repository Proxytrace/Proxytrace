import { createContext } from "react";

export interface ErrorToastOptions {
  stacktrace?: string;
  errorType?: string;
  url?: string;
  sendReport?: (details: { description: string; timestamp: string }) => void;
}

export interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
  stacktrace?: string;
  errorType?: string;
  url?: string;
  sendReport?: (details: { description: string; timestamp: string }) => void;
}

export interface ToastContextValue {
  show: (
    message: string,
    type?: ToastItem["type"],
    options?: ErrorToastOptions,
  ) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });
export default ToastContext;
