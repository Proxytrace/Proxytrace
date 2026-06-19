import { createContext } from "react";

export interface ErrorToastOptions {
  stacktrace?: string;
  /** Id of the captured Error Log entry, when the backend persisted one — enables an admin
   *  deep-link from the toast into the Error Log. */
  errorId?: string;
}

export interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
  stacktrace?: string;
  errorId?: string;
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
