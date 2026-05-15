export const successResponse = <T>(message: string, data?: T) => ({
  success: true as const,
  message,
  data: data ?? ({} as T)
});

export const errorResponse = (message: string, errors: string[] = []) => ({
  success: false as const,
  message,
  errors
});
