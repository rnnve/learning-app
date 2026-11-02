import { Elysia } from "elysia";
import { generateId, isValidUuid } from "../lib/ids.ts";

export const requestIdPlugin = new Elysia({ name: "request-id" })
  .derive({ as: "global" }, ({ request }) => {
    const headerId = request.headers.get("x-request-id");
    const requestId = headerId && isValidUuid(headerId) ? headerId : generateId();
    return { requestId };
  })
  .onAfterHandle({ as: "global" }, ({ set, requestId }) => {
    set.headers["x-request-id"] = requestId;
  });
