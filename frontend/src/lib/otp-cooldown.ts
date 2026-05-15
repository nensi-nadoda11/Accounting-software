const key = (email: string, purpose: string) => `otp_cooldown:${email}:${purpose}`;

export const setOtpCooldown = (email: string, purpose: string, seconds: number) => {
  window.localStorage.setItem(key(email, purpose), String(Date.now() + seconds * 1000));
};

export const getOtpCooldown = (email: string, purpose: string) => {
  const raw = window.localStorage.getItem(key(email, purpose));
  if (!raw) {
    return 0;
  }

  const remaining = Number(raw) - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
};
