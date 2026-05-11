let currentToken: string | null = null;

export function setAccessToken(token: string | null) {
  currentToken = token;
}

export function getAccessToken(): string | null {
  return currentToken;
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized() {
  unauthorizedHandler?.();
}
