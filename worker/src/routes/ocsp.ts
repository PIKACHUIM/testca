/**
 * /ocsp 路由：
 *   POST /ocsp        Content-Type: application/ocsp-request，body=DER
 *   GET  /ocsp/:b64   path 参数为 base64url 编码的 OCSP Request
 */
import { Hono } from "hono";

import type { HonoBindings } from "../env";

import {
  buildOcspResponse,
  buildStatusOnlyOcspResponse,
  OCSPResponseStatus,
} from "../lib/ocsp";
import { resolveCertsOrigin } from "../lib/ca-registry";
import { fromBase64Url } from "../lib/bytes";

export const ocspRoutes = new Hono<HonoBindings>();

ocspRoutes.post("/", async (c) => {
  const buf = new Uint8Array(await c.req.arrayBuffer());
  return respond(c, buf);
});

ocspRoutes.get("/:b64{.+}", async (c) => {
  const b64 = decodeURIComponent(c.req.param("b64"));
  let buf: Uint8Array;
  try {
    // 先按 base64url 解；失败再按 std base64 解
    buf = fromBase64Url(b64);
  } catch {
    try {
      buf = fromBase64Url(b64.replace(/=/g, ""));
    } catch {
      // 注：TS 5.7+ 下 Hono 的 c.body 要求 Uint8Array<ArrayBuffer>，而函数返回
      // 的是 Uint8Array<ArrayBufferLike>（仅类型不兼容，运行期无差别）。
      const der: any = buildStatusOnlyOcspResponse(
        OCSPResponseStatus.malformedRequest,
      );
      return c.body(der, 200, { "Content-Type": "application/ocsp-response" });
    }
  }
  return respond(c, buf);
});

async function respond(c: any, reqDer: Uint8Array) {
  try {
    const origin = resolveCertsOrigin(c.env, c.req.url);
    const der = await buildOcspResponse(c.env, origin, reqDer);
    return c.body(der, 200, {
      "Content-Type": "application/ocsp-response",
      "Cache-Control": "no-store",
    });
  } catch (e) {
    console.error("[ocsp] internal error", e);
    return c.body(
      buildStatusOnlyOcspResponse(OCSPResponseStatus.internalError),
      200,
      { "Content-Type": "application/ocsp-response" },
    );
  }
}
