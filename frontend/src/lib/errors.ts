import { AxiosError } from "axios";

type ApiErrorShape = {
  message?: string;
  errors?: string[];
};

const looksTechnical = (message: string): boolean => {
  const normalized = message.toLowerCase();

  return [
    "failed query:",
    "insert into",
    "select ",
    "update ",
    "delete from",
    "stack",
    "syntaxerror",
    "typeerror",
    "referenceerror",
    "enotfound",
    "econnrefused",
    "timeout",
    "<!doctype",
    "<html",
    "duplicate key",
  ].some((token) => normalized.includes(token));
};

export const getErrorMessage = (error: unknown, fallback = "Something went wrong. Please try again."): string => {
  if (error instanceof AxiosError) {
    if (!error.response) {
      return "Unable to connect to server. Please try again.";
    }

    const data = error.response.data as ApiErrorShape | undefined;
    const responseMessage = data?.message?.trim();

    if (responseMessage && !looksTechnical(responseMessage)) {
      return responseMessage;
    }

    const firstDetailedError = data?.errors?.find((item) => item && !looksTechnical(item));
    if (firstDetailedError) {
      return firstDetailedError;
    }

    if (error.response.status === 403) {
      return "You do not have permission to perform this action.";
    }

    if (error.response.status === 503) {
      return "Server is temporarily unavailable. Please try again in a moment.";
    }

    if (error.response.status >= 500) {
      return "Server error occurred. Please try again.";
    }

    return fallback;
  }

  if (error instanceof Error) {
    if (error.message && !looksTechnical(error.message)) {
      return error.message;
    }
  }

  return fallback;
};
