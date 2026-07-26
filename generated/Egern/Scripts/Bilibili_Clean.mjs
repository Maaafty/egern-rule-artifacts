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

function envList(env, key) {
  const value = env?.[key];
  if (value === undefined || value === null || value === "") return [];
  return String(value)
    .split(/[\n,，;；|]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function settingsFromEnv(env = {}) {
  return {
    cleanHotSearch: envBoolean(env, "CLEAN_HOT_SEARCH", true),
    cleanPromotionModules: envBoolean(env, "CLEAN_PROMOTION_MODULES", true),
    cleanDynamicExtras: envBoolean(env, "CLEAN_DYNAMIC_EXTRAS", false),
    cleanCommandDms: envBoolean(env, "CLEAN_COMMAND_DMS", true),
    showTabHome: envBoolean(env, "SHOW_TAB_HOME", true),
    showTabChannel: envBoolean(env, "SHOW_TAB_CHANNEL", true),
    showTabDynamic: envBoolean(env, "SHOW_TAB_DYNAMIC", true),
    showTabPublish: envBoolean(env, "SHOW_TAB_PUBLISH", true),
    showTabPgc: envBoolean(env, "SHOW_TAB_PGC", true),
    showTabMall: envBoolean(env, "SHOW_TAB_MALL", true),
    showTabMessages: envBoolean(env, "SHOW_TAB_MESSAGES", true),
    showTabMine: envBoolean(env, "SHOW_TAB_MINE", true),
    showMineOffline: envBoolean(env, "SHOW_MINE_OFFLINE", true),
    showMineHistory: envBoolean(env, "SHOW_MINE_HISTORY", true),
    showMineFavorites: envBoolean(env, "SHOW_MINE_FAVORITES", true),
    showMineWatchLater: envBoolean(env, "SHOW_MINE_WATCH_LATER", true),
    showMineCourse: envBoolean(env, "SHOW_MINE_COURSE", true),
    showMineFreeData: envBoolean(env, "SHOW_MINE_FREE_DATA", true),
    showMineDress: envBoolean(env, "SHOW_MINE_DRESS", true),
    showMineGame: envBoolean(env, "SHOW_MINE_GAME", true),
    showMineWallet: envBoolean(env, "SHOW_MINE_WALLET", true),
    showMineLive: envBoolean(env, "SHOW_MINE_LIVE", true),
    showMinePromotions: envBoolean(env, "SHOW_MINE_PROMOTIONS", true),
    showMineMall: envBoolean(env, "SHOW_MINE_MALL", true),
    showMineAudio: envBoolean(env, "SHOW_MINE_AUDIO", true),
    showMineTeen: envBoolean(env, "SHOW_MINE_TEEN", true),
    showMineSupport: envBoolean(env, "SHOW_MINE_SUPPORT", true),
    showMineCreatorSection: envBoolean(env, "SHOW_MINE_CREATOR_SECTION", true),
    showMineRecommendSection: envBoolean(env, "SHOW_MINE_RECOMMEND_SECTION", true),
    showMineMoreSection: envBoolean(env, "SHOW_MINE_MORE_SECTION", true),
    mineHideItems: envList(env, "MINE_HIDE_ITEMS"),
    mineHideSections: envList(env, "MINE_HIDE_SECTIONS"),
    mineHideBlocks: envList(env, "MINE_HIDE_BLOCKS"),
    removeDynamicAdParam: envBoolean(env, "REMOVE_DYNAMIC_AD_PARAM", true),
    dynamicRequestDiagnostics: envBoolean(env, "DYNAMIC_REQUEST_DIAGNOSTICS", false),
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

function normalizedText(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/gu, "");
}

function searchableValues(item, keys) {
  if (!isObject(item)) return [];
  return keys.map((key) => normalizedText(item[key])).filter(Boolean);
}

function matchesTokenList(item, tokens, keys) {
  if (!Array.isArray(tokens) || tokens.length === 0) return false;
  const values = searchableValues(item, keys);
  return tokens.some((rawToken) => {
    const token = normalizedText(rawToken);
    if (!token) return false;
    if (/^\d+$/u.test(token)) return normalizedText(item?.id) === token;
    return values.some((value) => value.includes(token));
  });
}

function bottomTabSetting(item) {
  const tabId = normalizedText(item?.tab_id);
  const name = normalizedText(item?.name);
  const uri = normalizedText(item?.uri);
  if (tabId === "home" || name === "首页" || uri.startsWith("bilibili://main/home")) return "showTabHome";
  if (tabId === "频道bottom" || name === "频道" || uri.startsWith("bilibili://pegasus/channel")) {
    return "showTabChannel";
  }
  if (tabId === "dynamic" || name === "动态" || uri.startsWith("bilibili://following/home/")) {
    return "showTabDynamic";
  }
  if (tabId === "publish" || name === "发布" || uri.includes("center_plus")) return "showTabPublish";
  if (
    ["ogv", "番剧", "影视"].includes(tabId) ||
    ["节目", "番剧", "影视"].includes(name) ||
    uri.includes("home_bottom_tab_activity_tab")
  ) {
    return "showTabPgc";
  }
  if (tabId === "会员购bottom" || name === "会员购" || uri.startsWith("bilibili://mall")) {
    return "showTabMall";
  }
  if (tabId === "消息bottom" || name === "消息" || uri.startsWith("bilibili://link/im_home")) {
    return "showTabMessages";
  }
  if (tabId === "我的bottom" || name === "我的" || uri.startsWith("bilibili://user_center")) {
    return "showTabMine";
  }
  return null;
}

function cleanBottomTabs(body, settings) {
  const tabs = body?.data?.bottom;
  if (!Array.isArray(tabs)) return;

  const filtered = tabs.filter((item) => {
    const setting = bottomTabSetting(item);
    return setting === null || settings[setting] !== false;
  });

  // Keep navigation usable if every known button was disabled accidentally.
  if (!filtered.some((item) => bottomTabSetting(item) !== null)) return;
  body.data.bottom = filtered.map((item, index) => ({ ...item, pos: index + 1 }));
}

const MINE_ITEM_KEYS = ["id", "title", "name", "text", "label", "uri", "url"];
const MINE_SECTION_KEYS = ["id", "title", "up_title", "name", "type", "style"];

const MINE_ITEM_SETTING_RULES = [
  ["showMineOffline", new Set([396]), ["离线缓存"]],
  ["showMineHistory", new Set([397]), ["历史记录"]],
  ["showMineFavorites", new Set([398]), ["我的收藏"]],
  ["showMineWatchLater", new Set([399]), ["稍后再看"]],
  ["showMineCourse", new Set([400, 794]), ["我的课程"]],
  ["showMineFreeData", new Set([401]), ["看视频免流量", "免流量"]],
  ["showMineDress", new Set([402]), ["个性装扮"]],
  ["showMineGame", new Set([403, 2542]), ["游戏中心", "我的游戏"]],
  ["showMineWallet", new Set([404, 741, 791]), ["我的钱包"]],
  ["showMineLive", new Set([406, 707, 708, 709, 710, 792]), ["直播中心", "主播中心", "主播活动", "开播福利", "我的直播"]],
  ["showMinePromotions", new Set([174, 423, 533, 990]), ["有奖活动", "任务中心", "邀好友赚红包", "能量加油站"]],
  ["showMineMall", new Set([622]), ["会员购中心"]],
  ["showMineAudio", new Set([812]), ["听视频"]],
  ["showMineTeen", new Set([950, 964, 1070]), ["青少年模式", "青少年守护"]],
  ["showMineSupport", new Set([407, 797]), ["联系客服", "我的客服"]],
];

const MINE_SECTION_SETTING_RULES = [
  ["showMineCreatorSection", ["创作中心"]],
  ["showMineRecommendSection", ["推荐服务"]],
  ["showMineMoreSection", ["更多服务"]],
];

function configuredMineItemSetting(item) {
  const id = Number(item?.id);
  const title = normalizedText(item?.title ?? item?.name);
  for (const [setting, ids, titles] of MINE_ITEM_SETTING_RULES) {
    if (ids.has(id) || titles.some((candidate) => title === normalizedText(candidate))) return setting;
  }
  return null;
}

function configuredMineSectionSetting(section) {
  const title = normalizedText(section?.title ?? section?.up_title ?? section?.name);
  for (const [setting, titles] of MINE_SECTION_SETTING_RULES) {
    if (titles.some((candidate) => title === normalizedText(candidate))) return setting;
  }
  return null;
}

function cleanMineItemList(items, settings) {
  if (!Array.isArray(items)) return items;
  return items.filter((item) => {
    if (matchesTokenList(item, settings.mineHideItems, MINE_ITEM_KEYS)) return false;
    const setting = configuredMineItemSetting(item);
    return setting === null || settings[setting] !== false;
  });
}

function cleanMinePage(body, settings) {
  if (!isObject(body?.data)) return;

  const hiddenBlocks = new Set((settings.mineHideBlocks ?? []).map(normalizedText));
  for (const key of Object.keys(body.data)) {
    if (hiddenBlocks.has(normalizedText(key))) delete body.data[key];
  }

  for (const key of ["sections_v2", "sections"]) {
    if (!Array.isArray(body.data[key])) continue;
    body.data[key] = body.data[key]
      .filter((section) => {
        if (matchesTokenList(section, settings.mineHideSections, MINE_SECTION_KEYS)) return false;
        const setting = configuredMineSectionSetting(section);
        return setting === null || settings[setting] !== false;
      })
      .map((section) => {
        if (!isObject(section) || !Array.isArray(section.items)) return section;
        return { ...section, items: cleanMineItemList(section.items, settings) };
      })
      .filter((section) => !isObject(section) || !Array.isArray(section.items) || section.items.length > 0);
  }

  for (const key of ["ipad_upper_sections", "ipad_recommend_sections", "ipad_more_sections"]) {
    if (Array.isArray(body.data[key])) body.data[key] = cleanMineItemList(body.data[key], settings);
  }
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
  } else if (path === "/x/resource/show/tab/v2") {
    cleanBottomTabs(body, settings);
  } else if (path === "/x/v2/account/mine" || path === "/x/v2/account/mine/ipad") {
    cleanMinePage(body, settings);
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

export function cleanDynamicRequestMessage(input, path, settings = settingsFromEnv()) {
  const bytes = asBytes(input);
  if (!settings.removeDynamicAdParam) return bytes;
  if (path.endsWith("/bilibili.app.dynamic.v2.Dynamic/DynAll")) {
    return removeFields(bytes, new Set([9]));
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

async function transformGrpcBody(input, transform, ctx, grpcEncoding = "identity") {
  const bytes = asBytes(input);
  const frames = parseGrpcFrames(bytes);
  if (!frames) return transform(bytes);

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
    const cleaned = transform(payload);
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

export async function cleanGrpcBody(input, path, settings, ctx, grpcEncoding = "identity") {
  return transformGrpcBody(
    input,
    (payload) => cleanProtobufMessage(payload, path, settings),
    ctx,
    grpcEncoding,
  );
}

export async function cleanDynamicGrpcRequestBody(
  input,
  path,
  settings,
  ctx,
  grpcEncoding = "identity",
) {
  return transformGrpcBody(
    input,
    (payload) => cleanDynamicRequestMessage(payload, path, settings),
    ctx,
    grpcEncoding,
  );
}

function headerValue(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) ?? "";
  return headers[name] ?? headers[name.toLowerCase()] ?? "";
}

function debugLog(settings, message, error) {
  if (!settings.debug) return;
  console.log(`[Bilibili Clean] ${message}${error ? `: ${String(error)}` : ""}`);
}

export default async function bilibiliClean(ctx) {
  const settings = settingsFromEnv(ctx?.env);
  if (!ctx?.request) return undefined;

  if (!ctx.response) {
    if (!settings.removeDynamicAdParam) return undefined;
    let original;
    try {
      const url = new URL(ctx.request.url);
      if (!url.pathname.endsWith("/bilibili.app.dynamic.v2.Dynamic/DynAll")) return undefined;
      const contentType = String(headerValue(ctx.request.headers, "content-type")).toLowerCase();
      if (!contentType.includes("grpc") && !contentType.includes("protobuf")) return undefined;

      original = new Uint8Array(await ctx.request.arrayBuffer());
      const encoding = String(headerValue(ctx.request.headers, "grpc-encoding") || "identity").toLowerCase();
      const cleaned = await cleanDynamicGrpcRequestBody(original, url.pathname, settings, ctx, encoding);
      const changed = !bytesEqual(original, cleaned);
      if (changed && typeof ctx.request.headers?.delete === "function") {
        ctx.request.headers.delete("content-length");
      }
      if (settings.dynamicRequestDiagnostics && typeof ctx.notify === "function") {
        await ctx.notify({
          title: "Bilibili 动态请求实验",
          subtitle: changed ? "已移除 DynAll ad_param" : "请求中未发现 ad_param",
          body: `bytes=${original.length}->${cleaned.length} response=untouched`,
          sound: false,
        });
      }
      debugLog(settings, `${changed ? "removed" : "kept"} DynAll request ad_param`);
      // The Fetch-style request body is single-use; always restore it after reading.
      return { body: cleaned, headers: ctx.request.headers };
    } catch (error) {
      debugLog(settings, "request fail-open", error);
      return original ? { body: original } : undefined;
    }
  }

  try {
    const url = new URL(ctx.request.url);
    const contentType = String(headerValue(ctx.response.headers, "content-type")).toLowerCase();
    if (contentType.includes("grpc") || contentType.includes("protobuf")) {
      const original = new Uint8Array(await ctx.response.arrayBuffer());
      const encoding = String(headerValue(ctx.response.headers, "grpc-encoding") || "identity").toLowerCase();
      const cleaned = await cleanGrpcBody(original, url.pathname, settings, ctx, encoding);
      if (bytesEqual(original, cleaned)) return undefined;
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
    return undefined;
  }
}
