export const logger = {
  info: (message: string, metadata?: unknown) => {
    console.log(message, metadata ?? "");
  },
  warn: (message: string, metadata?: unknown) => {
    console.warn(message, metadata ?? "");
  },
  error: (message: string, metadata?: unknown) => {
    console.error(message, metadata ?? "");
  }
};
