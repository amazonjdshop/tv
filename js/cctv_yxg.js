/**
 * CCTV 央视片库 QuickJS 爬虫（纪录片 / 动画片 / 特别节目）
 * 适配 FongMi / TVBox / CatVod / 潘多拉影视 (type: 3)
 *
 * 特性：
 * 1. 直连央视官方片库接口（纪录片 2000+ / 动画片 1100+ / 特别节目 2000+）
 * 2. 完整多维筛选（题材/类型、年份、地区、频道）
 * 3. 自动拉取完整分集（支持超过 100 集的长篇动画分页拉取）
 * 4. 仅播放公开无加密、海外可访问片源（自动校验 is_protected=0 & is_invalid_copyright=0）
 * 5. 直出 2000K 超清 HLS (parse: 0)
 */

const API_BASE = "https://api.cntv.cn";
const VDN_BASE = "https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do";
const SEARCH_BASE = "https://search.cctv.com/ifsearch.php";
const HLS_BASE = "https://dh5.cntv.cdn20.com/asp/h5e/hls";

const DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://tv.cctv.com/"
};

const CATEGORIES = {
    jlp: { cid: "CHAL1460955924871139", fc: "纪录片", modeOrder: [0, 2] },
    dhp: { cid: "CHAL1460955899450127", fc: "动画片", modeOrder: [2, 0] },
    tbjm: { cid: "CHAL1460955953877151", fc: "特别节目", modeOrder: [0, 2] }
};

// 内存元信息缓存，点进详情页时可直接展示简介/年份/分类
const albumMetaCache = {};

function init(ext) {
    // 爬虫初始化
}

function safeJsonParse(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (e) {
        try {
            // 央视接口 brief 字段常包含未转义的换行/制表控制字符
            const cleaned = text.replace(/[\u0000-\u001F]+/g, " ");
            return JSON.parse(cleaned);
        } catch (e2) {
            return null;
        }
    }
}

function httpGetText(url) {
    try {
        const res = req(url, { headers: DEFAULT_HEADERS });
        return (res && res.content) ? String(res.content) : "";
    } catch (e) {
        return "";
    }
}

function httpGetJson(url) {
    return safeJsonParse(httpGetText(url));
}

function fixUrl(u) {
    if (!u) return "";
    if (u.startsWith("//")) return "https:" + u;
    return u;
}

function stripTags(str) {
    return (str || "").replace(/<[^>]+>/g, "").trim();
}

function buildChannelsFilter() {
    return [
        { n: "全部频道", v: "" },
        { n: "CCTV-1 综合", v: "CCTV-1综合,CCTV-1高清,CCTV-1综合高清" },
        { n: "CCTV-2 财经", v: "CCTV-2财经,CCTV-2高清,CCTV-2财经高清" },
        { n: "CCTV-3 综艺", v: "CCTV-3综艺,CCTV-3综艺高清" },
        { n: "CCTV-4 中文国际", v: "CCTV-4中文国际,CCTV-4高清,CCTV-4中文国际(亚)高清" },
        { n: "CCTV-7 国防军事", v: "CCTV-7军事农业,CCTV-7军事农业高清,CCTV-7国防军事高清" },
        { n: "CCTV-9 纪录", v: "CCTV-9纪录,CCTV-9高清,CCTV-9纪录高清" },
        { n: "CCTV-10 科教", v: "CCTV-10科教,CCTV-10高清,CCTV-10科教高清" },
        { n: "CCTV-11 戏曲", v: "CCTV-11戏曲,CCTV-11高清,CCTV-11戏曲高清" },
        { n: "CCTV-12 社会与法", v: "CCTV-12社会与法,CCTV-12高清,CCTV-12社会与法高清" },
        { n: "CCTV-13 新闻", v: "CCTV-13新闻,CCTV-13高清,CCTV-13新闻高清" },
        { n: "CCTV-14 少儿", v: "CCTV-14少儿,CCTV-14高清,CCTV-14少儿高清" },
        { n: "CCTV-15 音乐", v: "CCTV-15音乐,CCTV-15高清,CCTV-15音乐高清" },
        { n: "CCTV-17 农业农村", v: "CCTV-17农业农村高清" }
    ];
}

function home(filter) {
    const classes = [
        { type_id: "jlp", type_name: "纪录片" },
        { type_id: "dhp", type_name: "动画片" },
        { type_id: "tbjm", type_name: "特别节目" }
    ];

    const years = [{ n: "全部年份", v: "" }];
    for (let y = 2026; y >= 2008; y--) {
        years.push({ n: y + "年", v: String(y) });
    }

    const channels = buildChannelsFilter();

    const filters = {
        jlp: [
            {
                key: "sc",
                name: "题材",
                value: [
                    { n: "全部", v: "" },
                    { n: "人文历史", v: "人文历史" },
                    { n: "人物", v: "人物" },
                    { n: "自然", v: "自然" },
                    { n: "探索", v: "探索" },
                    { n: "科技", v: "科技" },
                    { n: "军事", v: "军事" },
                    { n: "社会", v: "社会" },
                    { n: "经济", v: "经济" },
                    { n: "时政", v: "时政" }
                ]
            },
            { key: "year", name: "年份", value: years },
            { key: "channel", name: "频道", value: channels }
        ],
        dhp: [
            {
                key: "sc",
                name: "题材",
                value: [
                    { n: "全部", v: "" },
                    { n: "亲子", v: "亲子" },
                    { n: "搞笑", v: "搞笑" },
                    { n: "冒险", v: "冒险" },
                    { n: "益智", v: "益智" },
                    { n: "历史", v: "历史" },
                    { n: "教育", v: "教育" },
                    { n: "童话", v: "童话" },
                    { n: "神话", v: "神话" },
                    { n: "奇幻", v: "奇幻" },
                    { n: "校园", v: "校园" },
                    { n: "励志", v: "励志" },
                    { n: "经典", v: "经典" },
                    { n: "宠物", v: "宠物" },
                    { n: "动作", v: "动作" },
                    { n: "热血", v: "热血" },
                    { n: "体育", v: "体育" },
                    { n: "未来", v: "未来" },
                    { n: "古代", v: "古代" },
                    { n: "剧情", v: "剧情" },
                    { n: "其他", v: "其他" }
                ]
            },
            {
                key: "area",
                name: "地区",
                value: [
                    { n: "全部", v: "" },
                    { n: "内地（大陆）", v: "内地（大陆）" },
                    { n: "港澳台", v: "港澳台" },
                    { n: "欧美", v: "欧美" }
                ]
            }
        ],
        tbjm: [
            {
                key: "sc",
                name: "类型",
                value: [
                    { n: "全部", v: "" },
                    { n: "综艺", v: "综艺" },
                    { n: "文化", v: "文化" },
                    { n: "科教", v: "科教" },
                    { n: "音乐", v: "音乐" },
                    { n: "戏曲", v: "戏曲" },
                    { n: "军事", v: "军事" },
                    { n: "体育", v: "体育" },
                    { n: "影视", v: "影视" },
                    { n: "青少", v: "青少" },
                    { n: "新闻", v: "新闻" },
                    { n: "经济", v: "经济" },
                    { n: "社会", v: "社会" },
                    { n: "公益", v: "公益" },
                    { n: "其他", v: "其他" }
                ]
            },
            { key: "channel", name: "频道", value: channels }
        ]
    };

    return JSON.stringify({
        class: classes,
        filters: filters
    });
}

function mapAlbumItem(catKey, item) {
    const albumId = item.id || "";
    const title = (item.title || "").trim();
    const pic = fixUrl(item.image || item.image3 || item.image2 || "");
    const year = (item.year || "").trim();
    const sc = (item.sc || "").trim();
    const area = (item.area || "").trim();
    const count = item.count ? String(item.count).trim() : "";

    const remarksParts = [];
    if (count && count !== "0") remarksParts.push("全" + count + "集");
    if (sc) remarksParts.push(sc);
    else if (year) remarksParts.push(year);

    if (albumId) {
        albumMetaCache[albumId] = {
            title: title,
            pic: pic,
            year: year,
            sc: sc,
            area: area,
            channel: (item.channel || "").trim(),
            brief: (item.brief || "").trim(),
            fc: (item.fc || (CATEGORIES[catKey] && CATEGORIES[catKey].fc) || "").trim()
        };
    }

    return {
        vod_id: "album@@" + catKey + "@@" + albumId + "@@" + encodeURIComponent(title) + "@@" + encodeURIComponent(pic),
        vod_name: title,
        vod_pic: pic,
        vod_remarks: remarksParts.join(" · ") || (CATEGORIES[catKey] ? CATEGORIES[catKey].fc : "高清"),
        vod_year: year
    };
}

function homeVod() {
    try {
        // 首页推荐：混合展示最新纪录片 + 动画片 + 特别节目
        const list = [];
        const plan = [
            { key: "jlp", n: 8 },
            { key: "dhp", n: 8 },
            { key: "tbjm", n: 8 }
        ];
        for (let i = 0; i < plan.length; i++) {
            const p = plan[i];
            const cfg = CATEGORIES[p.key];
            const url = `${API_BASE}/list/getVideoAlbumList?channelid=${cfg.cid}&fc=${encodeURIComponent(cfg.fc)}&p=1&n=${p.n}&serviceId=tvcctv&topv=1&t=json`;
            const data = httpGetJson(url);
            const items = (data && data.data && data.data.list) || [];
            for (let j = 0; j < items.length; j++) {
                list.push(mapAlbumItem(p.key, items[j]));
            }
        }
        return JSON.stringify({ list: list });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

function category(tid, pg, filter, extend = {}) {
    try {
        const catKey = CATEGORIES[tid] ? tid : "jlp";
        const cfg = CATEGORIES[catKey];
        const page = parseInt(pg, 10) || 1;
        const pageSize = 24;
        const ext = extend || {};

        let url = `${API_BASE}/list/getVideoAlbumList?channelid=${cfg.cid}&fc=${encodeURIComponent(cfg.fc)}&p=${page}&n=${pageSize}&serviceId=tvcctv&topv=1&t=json`;
        if (ext.sc) url += `&sc=${encodeURIComponent(ext.sc)}`;
        if (ext.year) url += `&year=${encodeURIComponent(ext.year)}`;
        if (ext.area) url += `&area=${encodeURIComponent(ext.area)}`;
        if (ext.channel) url += `&channel=${encodeURIComponent(ext.channel)}`;

        const data = httpGetJson(url);
        const rawList = (data && data.data && data.data.list) || [];
        const total = (data && data.data && parseInt(data.data.total, 10)) || rawList.length;

        const list = [];
        for (let i = 0; i < rawList.length; i++) {
            list.push(mapAlbumItem(catKey, rawList[i]));
        }

        return JSON.stringify({
            page: page,
            pagecount: Math.ceil(total / pageSize) || 1,
            limit: pageSize,
            total: total,
            list: list
        });
    } catch (e) {
        return JSON.stringify({ page: 1, pagecount: 1, limit: 24, total: 0, list: [] });
    }
}

function fetchAlbumEpisodes(albumId, modeOrder) {
    const modes = modeOrder || [0, 2];
    for (let m = 0; m < modes.length; m++) {
        const mode = modes[m];
        const eps = [];
        const maxPages = 5; // 最多拉取 500 集
        for (let p = 1; p <= maxPages; p++) {
            const url = `${API_BASE}/NewVideo/getVideoListByAlbumIdNew?id=${albumId}&serviceId=tvcctv&p=${p}&n=100&sort=asc&mode=${mode}&pub=1&t=json`;
            const data = httpGetJson(url);
            const list = (data && data.data && data.data.list) || [];
            for (let i = 0; i < list.length; i++) {
                const ep = list[i];
                const guid = (ep.guid || "").trim();
                if (!guid) continue;
                const title = (ep.title || ("第" + (eps.length + 1) + "集")).replace(/[$#]/g, " ").trim();
                eps.push({ title: title, guid: guid });
            }
            const total = (data && data.data && parseInt(data.data.total, 10)) || 0;
            if (list.length < 100 || (total > 0 && eps.length >= total)) break;
        }
        if (eps.length > 0) return eps;
    }
    return [];
}

function checkVideoInfo(guid) {
    if (!guid) return null;
    try {
        const info = httpGetJson(`${VDN_BASE}?pid=${encodeURIComponent(guid)}`);
        if (!info || info.ack !== "yes") return null;
        // 严格过滤加密保护或海外版权受限内容
        if (String(info.is_protected) === "1" || String(info.is_invalid_copyright) === "1") {
            return { blocked: true };
        }
        return { blocked: false };
    } catch (e) {
        return null;
    }
}

function detail(id) {
    try {
        const parts = String(id || "").split("@@");
        const kind = parts[0];

        // 搜索结果单视频
        if (kind === "video") {
            const guid = parts[1] || "";
            const title = parts[2] ? decodeURIComponent(parts[2]) : "央视片库";
            const pic = parts[3] ? decodeURIComponent(parts[3]) : "";
            const channel = parts[4] ? decodeURIComponent(parts[4]) : "央视官方";

            const check = checkVideoInfo(guid);
            if (check && check.blocked) {
                return JSON.stringify({ list: [] });
            }

            return JSON.stringify({
                list: [{
                    vod_id: id,
                    vod_name: title,
                    vod_pic: pic,
                    type_name: channel,
                    vod_area: "中国大陆",
                    vod_remarks: "2000K超清",
                    vod_actor: "中央广播电视总台",
                    vod_content: title,
                    vod_play_from: "央视超清",
                    vod_play_url: "正片$" + guid
                }]
            });
        }

        // 专辑详情
        const catKey = parts[1] || "jlp";
        const albumId = parts[2] || "";
        const fallbackTitle = parts[3] ? decodeURIComponent(parts[3]) : "CCTV 片库";
        const fallbackPic = parts[4] ? decodeURIComponent(parts[4]) : "";
        const meta = albumMetaCache[albumId] || {};
        const cfg = CATEGORIES[catKey] || CATEGORIES.jlp;

        const eps = fetchAlbumEpisodes(albumId, cfg.modeOrder);
        if (eps.length === 0) {
            return JSON.stringify({ list: [] });
        }

        // 校验首集是否海外无加密可播，若受版权或加密限制则过滤
        const check = checkVideoInfo(eps[0].guid);
        if (check && check.blocked) {
            return JSON.stringify({ list: [] });
        }

        const playPairs = [];
        for (let i = 0; i < eps.length; i++) {
            playPairs.push(eps[i].title + "$" + eps[i].guid);
        }

        const vod = [{
            vod_id: id,
            vod_name: meta.title || fallbackTitle,
            vod_pic: meta.pic || fallbackPic,
            type_name: [meta.fc || cfg.fc, meta.sc].filter(Boolean).join(" / "),
            vod_year: meta.year || "",
            vod_area: meta.area || "中国大陆",
            vod_remarks: "全" + eps.length + "集",
            vod_actor: meta.channel || "中央广播电视总台",
            vod_director: "央视片库",
            vod_content: meta.brief || (meta.title || fallbackTitle),
            vod_play_from: "央视超清",
            vod_play_url: playPairs.join("#")
        }];

        return JSON.stringify({ list: vod });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

function play(flag, id, flags) {
    try {
        const rawId = String(id || "").trim();
        if (!rawId) return JSON.stringify({ parse: 0, url: "" });

        const playUrl = rawId.startsWith("http")
            ? rawId
            : `${HLS_BASE}/2000/0303000a/3/default/${rawId}/2000.m3u8`;

        return JSON.stringify({
            parse: 0,
            url: playUrl,
            header: DEFAULT_HEADERS
        });
    } catch (e) {
        return JSON.stringify({ parse: 0, url: "" });
    }
}

function search(wd, quick, pg) {
    try {
        const kw = (wd || "").trim();
        if (!kw) return JSON.stringify({ list: [] });
        const page = parseInt(pg, 10) || 1;
        const channels = ["CCTV纪录片", "CCTV动画片", "CCTV特别节目"];
        const buckets = [];
        let totalSum = 0;

        for (let c = 0; c < channels.length; c++) {
            const ch = channels[c];
            const url = `${SEARCH_BASE}?page=${page}&qtext=${encodeURIComponent(kw)}&sort=relevance&pageSize=8&type=video&channel=${encodeURIComponent(ch)}&pageflag=0`;
            const data = httpGetJson(url);
            const items = (data && data.list) || [];
            totalSum += (data && parseInt(data.total, 10)) || 0;
            buckets.push(items);
        }

        // 三个分类结果交错合并，避免单一分类霸屏
        const seen = {};
        const list = [];
        for (let idx = 0; idx < 8; idx++) {
            for (let c = 0; c < buckets.length; c++) {
                const it = buckets[c][idx];
                if (!it) continue;
                const img = fixUrl(it.imglink || "");
                const m = img.match(/([0-9a-f]{32})/i);
                if (!m) continue;
                const guid = m[1];
                if (seen[guid]) continue;
                seen[guid] = true;

                const title = stripTags(it.all_title || it.title || "");
                const chName = channels[c].replace("CCTV", "");
                const dur = it.durations ? Math.round(it.durations / 60) : 0;
                const remark = dur > 0 ? (chName + " · " + dur + "分钟") : chName;

                list.push({
                    vod_id: "video@@" + guid + "@@" + encodeURIComponent(title) + "@@" + encodeURIComponent(img) + "@@" + encodeURIComponent(chName),
                    vod_name: title,
                    vod_pic: img,
                    vod_remarks: remark
                });
            }
        }

        return JSON.stringify({
            page: page,
            pagecount: Math.ceil(totalSum / 24) || 1,
            limit: 24,
            total: totalSum,
            list: list
        });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

export default {
    init: init,
    home: home,
    homeVod: homeVod,
    category: category,
    detail: detail,
    search: search,
    play: play
};
