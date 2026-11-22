// Temporary built-in admin login so no host configuration is needed.
// Only a scrypt hash is stored (not the password). Env vars override these when set.
// SECURITY: while the repo is private this is fine. Before making the repo public,
// move these to environment variables and rotate the secret and password.
export const adminDefaults = {
  username: "niravadmin",
  passwordHash: "scrypt:45c0b4d0bc51b2ab19e3b53585a2e8ed:18e3905aafa517f5db6f16443e537d42e1dbf5fab30f436e7d01ed5ef99d8820",
  sessionSecret: "D+UMlg9w6fxqpsncCS8Cb4EFRtSl/vm2gdbEpuQ4EWY=",
};
