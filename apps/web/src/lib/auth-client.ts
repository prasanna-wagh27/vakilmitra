import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { API_BASE } from "./api";

export const authClient = createAuthClient({
  baseURL: `${API_BASE || window.location.origin}/api/auth`,
  fetchOptions: { credentials: "include" },
  plugins: [
    inferAdditionalFields({
      user: {
        phone: { type: "string", required: false },
        barCouncilNo: { type: "string", required: false },
        locale: { type: "string", required: false },
      },
    }),
  ],
});
