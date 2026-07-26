const AD_CARD_GOTOS = new Set([
  "ad_av",
  "ad_inline_3d",
  "ad_inline_av",
  "ad_inline_eggs",
  "ad_inline_live",
  "ad_player",
  "ad_web_gif",
  "ad_web_s",
  "vertical_ad_av",
  "vertical_ad_live",
  "vertical_ad_picture",
]);

const PROMOTION_MODULE_IDS = new Set([241, 1283, 1284, 1441]);
const VIEW_UNITE_PROMOTION_TYPES = new Set([18, 29, 55]);

function envBoolean(env, key, fallback) {
  const value = env?.[key];
  if (value === undefined || value === null || value === "") return fallback;
  return !["0", "false", "no", "off"].includes(String(value).toLowerCase());
}

export function settingsFromEnv(env = {}) {
  return {
    cleanHotSearch: envBoolean(env, "CLEAN_HOT_SEARCH", true),
    cleanPromotionModules: envBoolean(env, "CLEAN_PROMOTION_MODULES", true),
    cleanDynamicExtras: envBoolean(env, "CLEAN_DYNAMIC_EXTRAS", false),
    dynamicDiagnostics: envBoolean(env, "DYNAMIC_DIAGNOSTICS", true),
    cleanCommandDms: envBoolean(env, "CLEAN_COMMAND_DMS", true),
    debug: envBoolean(env, "DEBUG", false),
  };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasTruthyAdMarker(item) {
  return Boolean(
    item?.ad_info ||
      item?.adInfo ||
      item?.cm ||
      item?.commercial ||
      item?.creative_id ||
      item?.creativeId ||
      item?.is_ad === true ||
      item?.is_ad === 1 ||
      item?.isAd === true ||
      item?.isAd === 1,
  );
}

function isAdCard(item, settings) {
  if (!isObject(item)) return false;

  const cardType = String(item.card_type ?? item.cardType ?? "").toLowerCase();
  const cardGoto = String(item.card_goto ?? item.cardGoto ?? "").toLowerCase();
  const goto = String(item.goto ?? "").toLowerCase();

  if (hasTruthyAdMarker(item)) return true;
  if (cardType.startsWith("cm_")) return true;
  if (cardGoto.startsWith("ad_") || cardGoto.startsWith("vertical_ad_")) return true;
  if (AD_CARD_GOTOS.has(cardGoto) || goto === "ad") return true;
  if (settings.cleanPromotionModules && cardType === "small_cover_v10" && cardGoto === "game") {
    return true;
  }
  return false;
}

function cleanBannerCard(item, settings) {
  const cardType = String(item?.card_type ?? item?.cardType ?? "").toLowerCase();
  const cardGoto = String(item?.card_goto ?? item?.cardGoto ?? "").toLowerCase();
  if (!["banner_v8", "banner_ipad_v8"].includes(cardType) || cardGoto !== "banner") {
    return item;
  }

  if (Array.isArray(item.banner_item)) {
    item.banner_item = item.banner_item.filter((banner) => {
      return String(banner?.type ?? "").toLowerCase() !== "ad" && !isAdCard(banner, settings);
    });
  }
  return item;
}

function cleanFeedItems(items, settings) {
  if (!Array.isArray(items)) return items;
  return items
    .map((item) => cleanBannerCard(item, settings))
    .filter((item) => {
      if (isAdCard(item, settings)) return false;
      if (Array.isArray(item?.banner_item) && item.banner_item.length === 0) return false;
      return true;
    });
}

function cleanPgcModules(modules, settings) {
  if (!Array.isArray(modules)) return modules;
  for (const module of modules) {
    if (!Array.isArray(module?.items)) continue;
    module.items = module.items.filter((item) => !isAdCard(item, settings));
    if (!settings.cleanPromotionModules) continue;

    const style = String(module.style ?? "").toLowerCase();
    if (style.startsWith("banner")) {
      module.items = module.items.filter((item) => String(item?.link ?? "").includes("play"));
    } else if (style.startsWith("function")) {
      module.items = module.items.filter((item) => String(item?.blink ?? "").startsWith("bilibili"));
    } else if (style.startsWith("tip") || PROMOTION_MODULE_IDS.has(Number(module.module_id))) {
      module.items = [];
    }
  }
  return modules;
}

export function cleanJsonBody(body, urlLike, settings = settingsFromEnv()) {
  const url = urlLike instanceof URL ? urlLike : new URL(urlLike);
  const path = url.pathname;

  if ([
    "/x/v2/splash/show",
    "/x/v2/splash/list",
    "/x/v2/splash/brand/list",
    "/x/v2/splash/event/list2",
  ].includes(path)) {
    if (isObject(body?.data)) {
      for (const key of ["account", "event_list", "preload", "show"]) delete body.data[key];
    }
  } else if (path === "/x/v2/feed/index" || path === "/x/v2/feed/index/story") {
    if (isObject(body?.data)) body.data.items = cleanFeedItems(body.data.items, settings);
  } else if (path === "/x/v2/search/square") {
    if (settings.cleanHotSearch && Array.isArray(body?.data)) {
      body.data = body.data.filter((item) => String(item?.type ?? "").toLowerCase() !== "trending");
    }
  } else if (path === "/pgc/page/bangumi" || path === "/pgc/page/cinema/tab") {
    if (isObject(body?.result)) body.result.modules = cleanPgcModules(body.result.modules, settings);
  } else if (path === "/x/web-interface/wbi/index/top/feed/rcmd") {
    if (isObject(body?.data) && Array.isArray(body.data.item)) {
      body.data.item = body.data.item.filter((item) => !isAdCard(item, settings));
    }
  } else if (path === "/xlive/app-room/v1/index/getInfoByRoom" && isObject(body?.data)) {
    delete body.data.activity_banner_info;
    if (settings.cleanPromotionModules && isObject(body.data.shopping_info)) {
      body.data.shopping_info = { is_show: 0 };
    }
    const outerList = body.data.new_tab_info?.outer_list;
    if (settings.cleanPromotionModules && Array.isArray(outerList)) {
      body.data.new_tab_info.outer_list = outerList.filter((item) => Number(item?.biz_id) !== 33);
    }
  }

  return body;
}

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return new Uint8Array(value ?? []);
}

function concatBytes(chunks) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function bytesEqual(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export function encodeVarint(value) {
  let remaining = typeof value === "bigint" ? value : BigInt(value);
  if (remaining < 0n) throw new Error("negative varint is not supported");
  const output = [];
  do {
    let byte = Number(remaining & 0x7fn);
    remaining >>= 7n;
    if (remaining !== 0n) byte |= 0x80;
    output.push(byte);
  } while (remaining !== 0n);
  return Uint8Array.from(output);
}

function readVarint(bytes, start) {
  let value = 0n;
  let shift = 0n;
  let offset = start;
  while (offset < bytes.length && shift <= 63n) {
    const byte = bytes[offset];
    value |= BigInt(byte & 0x7f) << shift;
    offset += 1;
    if ((byte & 0x80) === 0) return { value, next: offset };
    shift += 7n;
  }
  throw new Error("invalid protobuf varint");
}

export function parseFields(input) {
  const bytes = asBytes(input);
  const fields = [];
  let offset = 0;
  while (offset < bytes.length) {
    const start = offset;
    const tag = readVarint(bytes, offset);
    offset = tag.next;
    const number = Number(tag.value >> 3n);
    const wireType = Number(tag.value & 7n);
    if (number <= 0) throw new Error("invalid protobuf field number");
    const tagEnd = offset;
    let valueStart = offset;
    let valueEnd;

    if (wireType === 0) {
      const value = readVarint(bytes, offset);
      valueEnd = value.next;
    } else if (wireType === 1) {
      valueEnd = offset + 8;
    } else if (wireType === 2) {
      const length = readVarint(bytes, offset);
      const numericLength = Number(length.value);
      if (!Number.isSafeInteger(numericLength)) throw new Error("protobuf field is too large");
      valueStart = length.next;
      valueEnd = valueStart + numericLength;
    } else if (wireType === 5) {
      valueEnd = offset + 4;
    } else {
      throw new Error(`unsupported protobuf wire type ${wireType}`);
    }
    if (valueEnd > bytes.length) throw new Error("truncated protobuf field");

    fields.push({ number, wireType, start, tagEnd, valueStart, valueEnd, end: valueEnd });
    offset = valueEnd;
  }
  return fields;
}

function rawField(bytes, field) {
  return bytes.subarray(field.start, field.end);
}

function fieldPayload(bytes, field) {
  return bytes.subarray(field.valueStart, field.valueEnd);
}

function replacementField(bytes, field, payload) {
  return concatBytes([
    bytes.subarray(field.start, field.tagEnd),
    encodeVarint(payload.length),
    payload,
  ]);
}

function rewriteMessage(input, rewriter) {
  const bytes = asBytes(input);
  const fields = parseFields(bytes);
  const chunks = [];
  let changed = false;
  for (const field of fields) {
    const decision = rewriter(field, bytes);
    if (decision === null) {
      changed = true;
      continue;
    }
    if (decision instanceof Uint8Array) {
      const originalPayload = fieldPayload(bytes, field);
      if (!bytesEqual(originalPayload, decision)) {
        chunks.push(replacementField(bytes, field, decision));
        changed = true;
        continue;
      }
    }
    chunks.push(rawField(bytes, field));
  }
  return changed ? concatBytes(chunks) : bytes;
}

function removeFields(input, numbers) {
  return rewriteMessage(input, (field) => (numbers.has(field.number) ? null : undefined));
}

function rewriteNestedFields(input, number, transform) {
  return rewriteMessage(input, (field, bytes) => {
    if (field.number !== number || field.wireType !== 2) return undefined;
    return transform(fieldPayload(bytes, field));
  });
}

function filterNestedFields(input, number, shouldRemove) {
  return rewriteMessage(input, (field, bytes) => {
    if (field.number !== number || field.wireType !== 2) return undefined;
    return shouldRemove(fieldPayload(bytes, field)) ? null : undefined;
  });
}

function messageHasField(input, number, wireType) {
  return parseFields(input).some((field) => {
    return field.number === number && (wireType === undefined || field.wireType === wireType);
  });
}

function varintField(input, number) {
  const bytes = asBytes(input);
  const field = parseFields(bytes).find((candidate) => candidate.number === number && candidate.wireType === 0);
  if (!field) return undefined;
  return Number(readVarint(bytes, field.valueStart).value);
}

function hasNonEmptyBytesField(input, number) {
  const bytes = asBytes(input);
  return parseFields(bytes).some((field) => {
    return field.number === number && field.wireType === 2 && field.valueEnd > field.valueStart;
  });
}

function isRelateCardAd(card) {
  const cardType = varintField(card, 1);
  if ([4, 5, 11].includes(cardType)) return true;
  if (messageHasField(card, 6, 2) || messageHasField(card, 11, 2)) return true;

  const bytes = asBytes(card);
  return parseFields(bytes).some((field) => {
    if (field.number !== 12 || field.wireType !== 2) return false;
    return hasNonEmptyBytesField(fieldPayload(bytes, field), 6);
  });
}

function cleanDynamicAll(input, settings) {
  let output = input;
  if (settings.cleanDynamicExtras) output = removeFields(output, new Set([2, 3]));
  return rewriteNestedFields(output, 1, (dynamicList) => {
    return filterNestedFields(dynamicList, 1, (item) => varintField(item, 1) === 15);
  });
}

function cleanLegacyView(input) {
  let output = removeFields(input, new Set([30, 31, 41]));
  output = filterNestedFields(output, 10, (relate) => messageHasField(relate, 28, 2));
  return output;
}

function cleanRelates(input) {
  return filterNestedFields(input, 1, isRelateCardAd);
}

function cleanViewUniteModule(module, settings) {
  const type = varintField(module, 1);
  if (settings.cleanPromotionModules && VIEW_UNITE_PROMOTION_TYPES.has(type)) return null;
  if (type !== 28) return module;
  return rewriteNestedFields(module, 22, cleanRelates);
}

function cleanViewUnite(input, settings) {
  let output = removeFields(input, new Set([7]));
  output = rewriteNestedFields(output, 5, (tab) => {
    return rewriteNestedFields(tab, 1, (tabModule) => {
      return rewriteNestedFields(tabModule, 2, (introduction) => {
        return rewriteMessage(introduction, (field, bytes) => {
          if (field.number !== 2 || field.wireType !== 2) return undefined;
          const cleaned = cleanViewUniteModule(fieldPayload(bytes, field), settings);
          return cleaned === null ? null : cleaned;
        });
      });
    });
  });
  return output;
}

function cleanReplyMainList(input) {
  let output = removeFields(input, new Set([11]));
  output = filterNestedFields(output, 28, (card) => varintField(card, 1) === 3);
  return output;
}

function cleanSearchAll(input) {
  return filterNestedFields(input, 4, (item) => {
    return messageHasField(item, 25, 2) || messageHasField(item, 11, 2);
  });
}

export function cleanProtobufMessage(input, path, settings = settingsFromEnv()) {
  const bytes = asBytes(input);
  if (path.endsWith("/bilibili.app.dynamic.v2.Dynamic/DynAll")) {
    return cleanDynamicAll(bytes, settings);
  }
  if (path.endsWith("/bilibili.app.dynamic.v2.Dynamic/DynVideo")) {
    return settings.cleanDynamicExtras ? removeFields(bytes, new Set([2])) : bytes;
  }
  if (path.endsWith("/bilibili.app.view.v1.View/View")) return cleanLegacyView(bytes);
  if (path.endsWith("/bilibili.app.view.v1.View/TFInfo")) return removeFields(bytes, new Set([2, 3]));
  if (path.endsWith("/bilibili.app.viewunite.v1.View/View")) return cleanViewUnite(bytes, settings);
  if (path.endsWith("/bilibili.app.viewunite.v1.View/RelatesFeed")) return cleanRelates(bytes);
  if (path.endsWith("/bilibili.community.service.dm.v1.DM/DmView")) {
    const fields = settings.cleanCommandDms ? new Set([18, 22]) : new Set([18]);
    return removeFields(bytes, fields);
  }
  if (path.endsWith("/bilibili.main.community.reply.v1.Reply/MainList")) {
    return cleanReplyMainList(bytes);
  }
  if (path.endsWith("/bilibili.polymer.app.search.v1.Search/SearchAll")) {
    return cleanSearchAll(bytes);
  }
  return bytes;
}

function parseGrpcFrames(input) {
  const bytes = asBytes(input);
  if (bytes.length < 5) return null;
  const frames = [];
  let offset = 0;
  while (offset < bytes.length) {
    if (offset + 5 > bytes.length) return null;
    const flags = bytes[offset];
    if ((flags & ~0x81) !== 0) return null;
    const length =
      bytes[offset + 1] * 0x1000000 +
      bytes[offset + 2] * 0x10000 +
      bytes[offset + 3] * 0x100 +
      bytes[offset + 4];
    const end = offset + 5 + length;
    if (end > bytes.length) return null;
    frames.push({ flags, payload: bytes.subarray(offset + 5, end), raw: bytes.subarray(offset, end) });
    offset = end;
  }
  return frames;
}

function encodeGrpcFrame(flags, payload) {
  const frame = new Uint8Array(5 + payload.length);
  frame[0] = flags;
  frame[1] = (payload.length >>> 24) & 0xff;
  frame[2] = (payload.length >>> 16) & 0xff;
  frame[3] = (payload.length >>> 8) & 0xff;
  frame[4] = payload.length & 0xff;
  frame.set(payload, 5);
  return frame;
}

async function decompressGrpcPayload(ctx, payload, encoding) {
  if (encoding === "gzip") return ctx.compress.gunzip(payload);
  if (encoding === "deflate") return ctx.compress.inflate(payload);
  throw new Error(`unsupported grpc encoding: ${encoding || "unknown"}`);
}

async function compressGrpcPayload(ctx, payload, encoding) {
  if (encoding === "gzip") return ctx.compress.gzip(payload);
  if (encoding === "deflate") return ctx.compress.deflate(payload);
  throw new Error(`unsupported grpc encoding: ${encoding || "unknown"}`);
}

function dynamicDiagnosticsSnapshot(input, path) {
  if (!path.endsWith("/bilibili.app.dynamic.v2.Dynamic/DynAll") &&
      !path.endsWith("/bilibili.app.dynamic.v2.Dynamic/DynVideo")) return null;
  const reply = asBytes(input);
  const dynamicListField = parseFields(reply).find((field) => field.number === 1 && field.wireType === 2);
  if (!dynamicListField) return null;
  const dynamicList = fieldPayload(reply, dynamicListField);
  const items = parseFields(dynamicList)
    .filter((field) => field.number === 1 && field.wireType === 2)
    .map((field) => fieldPayload(dynamicList, field));
  return {
    items: items.length,
    matched: items.filter((item) => varintField(item, 1) === 15).length,
    hasMore: varintField(dynamicList, 5) === 1,
    hasHistoryOffset: messageHasField(dynamicList, 3, 2),
    hasUpdateBaseline: messageHasField(dynamicList, 4, 2),
  };
}

async function reportDynamicDiagnostics(ctx, path, before, after) {
  if (!before) return;
  const endpoint = path.endsWith("/DynVideo") ? "DynVideo" : "DynAll";
  const body = [
    `cards=${before.items}`,
    `matched=${before.matched}`,
    `delivered=${after?.items ?? before.items}`,
    `has_more=${before.hasMore}`,
    `history_offset=${before.hasHistoryOffset}`,
    `update_baseline=${before.hasUpdateBaseline}`,
  ].join(" ");
  console.log(`[Bilibili Clean Diagnostic] ${endpoint} ${body}`);
  if (typeof ctx?.notify !== "function") return;
  try {
    await ctx.notify({ title: "Bilibili Clean 分页诊断", subtitle: endpoint, body, sound: false });
  } catch (error) {
    console.log(`[Bilibili Clean Diagnostic] notification failed: ${String(error)}`);
  }
}

export async function cleanGrpcBody(input, path, settings, ctx, grpcEncoding = "identity") {
  const bytes = asBytes(input);
  const frames = parseGrpcFrames(bytes);
  if (!frames) {
    const before = settings.dynamicDiagnostics ? dynamicDiagnosticsSnapshot(bytes, path) : null;
    const cleaned = cleanProtobufMessage(bytes, path, settings);
    if (settings.dynamicDiagnostics) {
      await reportDynamicDiagnostics(ctx, path, before, dynamicDiagnosticsSnapshot(cleaned, path));
    }
    return cleaned;
  }

  const output = [];
  let changed = false;
  for (const frame of frames) {
    if ((frame.flags & 0x80) !== 0) {
      output.push(frame.raw);
      continue;
    }

    let payload = frame.payload;
    if ((frame.flags & 1) !== 0) {
      payload = await decompressGrpcPayload(ctx, payload, grpcEncoding);
      if (!payload) throw new Error("failed to decompress grpc frame");
    }
    const before = settings.dynamicDiagnostics ? dynamicDiagnosticsSnapshot(payload, path) : null;
    const cleaned = cleanProtobufMessage(payload, path, settings);
    if (settings.dynamicDiagnostics) {
      await reportDynamicDiagnostics(ctx, path, before, dynamicDiagnosticsSnapshot(cleaned, path));
    }
    if (bytesEqual(payload, cleaned)) {
      output.push(frame.raw);
      continue;
    }
    changed = true;
    let encoded = cleaned;
    if ((frame.flags & 1) !== 0) {
      encoded = await compressGrpcPayload(ctx, cleaned, grpcEncoding);
      if (!encoded) throw new Error("failed to compress grpc frame");
    }
    output.push(encodeGrpcFrame(frame.flags, encoded));
  }
  return changed ? concatBytes(output) : bytes;
}

function headerValue(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) ?? "";
  return headers[name] ?? headers[name.toLowerCase()] ?? "";
}

function debugLog(settings, message, error) {
  if (!settings.debug && !settings.dynamicDiagnostics) return;
  console.log(`[Bilibili Clean] ${message}${error ? `: ${String(error)}` : ""}`);
}

export default async function bilibiliClean(ctx) {
  const settings = settingsFromEnv(ctx?.env);
  if (!ctx?.request || !ctx?.response) return undefined;
  let originalBinary;

  try {
    const url = new URL(ctx.request.url);
    const contentType = String(headerValue(ctx.response.headers, "content-type")).toLowerCase();
    if (contentType.includes("grpc") || contentType.includes("protobuf")) {
      const original = new Uint8Array(await ctx.response.arrayBuffer());
      originalBinary = original;
      const encoding = String(headerValue(ctx.response.headers, "grpc-encoding") || "identity").toLowerCase();
      const cleaned = await cleanGrpcBody(original, url.pathname, settings, ctx, encoding);
      if (bytesEqual(original, cleaned)) {
        debugLog(settings, `returned unchanged protobuf ${url.pathname}`);
        return { body: original };
      }
      debugLog(settings, `cleaned protobuf ${url.pathname}`);
      return { body: cleaned };
    }

    const body = await ctx.response.json();
    const before = JSON.stringify(body);
    cleanJsonBody(body, url, settings);
    const after = JSON.stringify(body);
    if (before === after) return undefined;
    debugLog(settings, `cleaned json ${url.pathname}`);
    return { body };
  } catch (error) {
    debugLog(settings, "fail-open", error);
    if (settings.dynamicDiagnostics && typeof ctx?.notify === "function") {
      try {
        await ctx.notify({
          title: "Bilibili Clean 分页诊断异常",
          body: `fail-open: ${String(error)}`,
          sound: false,
        });
      } catch (_) {
        // Notification failures must not affect the original response.
      }
    }
    return originalBinary ? { body: originalBinary } : undefined;
  }
}
