let authBootstrapPromise: Promise<unknown> | null = null;

export const authBootstrap = {
  get: () => authBootstrapPromise,
  set: (promise: Promise<unknown>) => {
    authBootstrapPromise = promise;
  },
  clear: (promise?: Promise<unknown>) => {
    if (!promise || authBootstrapPromise === promise) {
      authBootstrapPromise = null;
    }
  },
};
