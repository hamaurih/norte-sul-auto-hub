/**
 * Bling OAuth 2.0 callback — migration bridge.
 *
 * This legacy project no longer exchanges authorization_code for tokens nor
 * persists Bling credentials. We only receive the OAuth parameters from Bling
 * and forward them securely to the official production domain.
 */
import { createFileRoute } from "@tanstack/react-router";

const OFFICIAL_CALLBACK = "https://www.nortesulauto.com.br/api/public/bling/callback";
const INVALID_DESTINATION = "https://www.nortesulauto.com.br/admin/ecossistema/bling?oauth=invalid";

export const Route = createFileRoute("/api/public/bling/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");

        const hasRelevantParam = code || state || error || errorDescription;
        if (!hasRelevantParam) {
          return new Response(null, {
            status: 303,
            headers: {
              Location: INVALID_DESTINATION,
              "Cache-Control": "no-store",
              "Referrer-Policy": "no-referrer",
            },
          });
        }

        const target = new URL(OFFICIAL_CALLBACK);
        if (code) target.searchParams.set("code", code);
        if (state) target.searchParams.set("state", state);
        if (error) target.searchParams.set("error", error);
        if (errorDescription) target.searchParams.set("error_description", errorDescription);

        return new Response(null, {
          status: 302,
          headers: {
            Location: target.toString(),
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
          },
        });
      },
    },
  },
});
