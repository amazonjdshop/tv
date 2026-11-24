/**
 * CCTV 栏目大全 QuickJS 爬虫 (tv.cctv.com/lm)
 * 适配 FongMi / TVBox / CatVod / 潘多拉影视 (type: 3)
 *
 * 特性：
 * 1. 直连央视官方栏目大全接口（349 个央视栏目，含新闻联播、焦点访谈、今日说法、百家讲坛等）
 * 2. 多维筛选（频道 CCTV-1 ~ CCTV-17、分类、首字母 A-Z）
 * 3. 自动解析栏目最新 100 期完整正片 (mode=0 倒序，兜底 mode=2)
 * 4. 仅播放公开无加密、海外可访问流 (is_protected=0 & is_invalid_copyright=0)
 * 5. 直出 2000K 超清 H5E HLS，配合 CctvProxy 解密播放 (parse: 0)
 */

const API_BASE = "https://api.cntv.cn";
const VDN_BASE = "https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do";
const HLS_BASE = "https://dh5.cntv.cdn20.com/asp/h5e/hls";

const DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://tv.cctv.com/"
};

const colMetaCache = {};
const topcCache = {};
let allColumnsCache = null;
let allColumnsCacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000;

// 隐藏海外版权/加密受限栏目（is_protected=1 / is_invalid_copyright=1）及无正片空栏目
const HIDDEN_COLUMN_IDS = {
    // CCTV-5 体育（含国际赛事版权片段，海外受限）
    "EPGM1387361853688238": 1, // 天下足球
    "EPGM1387361853688232": 1, // 体坛快讯
    "EPGM1387361853688233": 1, // 体育新闻
    "EPGM1387361853688234": 1, // 体育世界
    "EPGM1387361853688231": 1, // 体坛晨报
    // CCTV-16 奥林匹克（奥运版权海外受限）
    "EPGM1634809261472738": 1, // 逐冰追雪
    "EPGM1634809536535805": 1, // 五环纪事
    "EPGM1462949870664633": 1, // 北京2022
    "EPGM1634808804931562": 1, // 艺术里的奥林匹克
    "EPGM1634810533673110": 1, // 奥秘无穷
    "EPGM1634810762190161": 1, // 奥林匹克人
    // 无可播正片的归档/空栏目
    "EPGM1387361853673133": 1, // 梦想星搭档第一季
    "EPGM1387361853688244": 1, // 运动空间
    "EPGM1387361853688248": 1, // 体育星探
    "EPGM1387361853688243": 1, // 精彩F1
    "EPGM1387361853688241": 1, // 城市之间
    "EPGM1387361853688246": 1, // 爆笑体育
    "EPGM1571631085336616": 1, // 9视频
    "EPGM1571631176689507": 1, // 活力·源
    "EPGM1387361853688293": 1, // 寰宇视野
    "EPGM1571631271228678": 1, // 故事·中国
    "EPGM1571630750228389": 1, // 全景自然
    "EPGM1387361853688290": 1, // 特别呈现
    "EPGM1387361853688291": 1, // 真相
    "EPGM1453293320641407": 1, // 万象
    "EPGM1453292976728190": 1, // 自然
    "EPGM1387361853688289": 1, // 时代
    "EPGM1387361853688292": 1, // 发现
    "EPGM1387361853688288": 1  // 人文地理
};

function isHiddenColumn(doc) {
    if (!doc) return true;
    const colId = (doc.column_id || "").trim();
    if (colId && HIDDEN_COLUMN_IDS[colId]) return true;
    const ch = (doc.channel_name || "").trim();
    if (ch.indexOf("CCTV-16") !== -1) return true;
    return false;
}

function init(ext) {
    // 爬虫初始化
}

function safeJsonParse(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (e) {
        try {
            return JSON.parse(text.replace(/[\u0000-\u001F]+/g, " "));
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

function buildChannelFilter() {
    return [
        { n: "全部频道", v: "" },
        { n: "CCTV-1 综合", v: "EPGC1386744804340101" },
        { n: "CCTV-2 财经", v: "EPGC1386744804340102" },
        { n: "CCTV-3 综艺", v: "EPGC1386744804340103" },
        { n: "CCTV-4 中文国际", v: "EPGC1386744804340104" },
        { n: "CCTV-5 体育", v: "EPGC1386744804340107" },
        { n: "CCTV-6 电影", v: "EPGC1386744804340108" },
        { n: "CCTV-7 国防军事", v: "EPGC1386744804340109" },
        { n: "CCTV-8 电视剧", v: "EPGC1386744804340110" },
        { n: "CCTV-9 纪录", v: "EPGC1386744804340112" },
        { n: "CCTV-10 科教", v: "EPGC1386744804340113" },
        { n: "CCTV-11 戏曲", v: "EPGC1386744804340114" },
        { n: "CCTV-12 社会与法", v: "EPGC1386744804340115" },
        { n: "CCTV-13 新闻", v: "EPGC1386744804340116" },
        { n: "CCTV-14 少儿", v: "EPGC1386744804340117" },
        { n: "CCTV-15 音乐", v: "EPGC1386744804340118" },
        { n: "CCTV-17 农业农村", v: "EPGC1563932742616872" }
    ];
}

function buildLetterFilter() {
    const list = [{ n: "全部", v: "" }];
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let i = 0; i < letters.length; i++) {
        const c = letters.charAt(i);
        list.push({ n: c, v: c });
    }
    return list;
}

function home(filter) {
    const classes = [
        { type_id: "all", type_name: "全部栏目" },
        { type_id: "新闻", type_name: "新闻" },
        { type_id: "法治", type_name: "法治" },
        { type_id: "科教", type_name: "科教" },
        { type_id: "经济", type_name: "经济" },
        { type_id: "军事", type_name: "军事" },
        { type_id: "纪实", type_name: "纪实" },
        { type_id: "综艺", type_name: "综艺" },
        { type_id: "健康", type_name: "健康" },
        { type_id: "生活", type_name: "生活" },
        { type_id: "戏曲", type_name: "戏曲" },
        { type_id: "音乐", type_name: "音乐" },
        { type_id: "少儿", type_name: "少儿" },
        { type_id: "体育", type_name: "体育" },
        { type_id: "农业", type_name: "农业" }
    ];

    const channels = buildChannelFilter();
    const letters = buildLetterFilter();
    const categories = [
        { n: "全部分类", v: "" },
        { n: "新闻", v: "新闻" },
        { n: "法治", v: "法治" },
        { n: "科教", v: "科教" },
        { n: "经济", v: "经济" },
        { n: "军事", v: "军事" },
        { n: "纪实", v: "纪实" },
        { n: "综艺", v: "综艺" },
        { n: "健康", v: "健康" },
        { n: "生活", v: "生活" },
        { n: "戏曲", v: "戏曲" },
        { n: "音乐", v: "音乐" },
        { n: "少儿", v: "少儿" },
        { n: "动画", v: "动画" },
        { n: "体育", v: "体育" },
        { n: "农业", v: "农业" },
        { n: "影视", v: "电影电视剧" }
    ];

    const filters = {};
    for (let i = 0; i < classes.length; i++) {
        const tid = classes[i].type_id;
        const f = [];
        if (tid === "all") {
            f.push({ key: "fc", name: "分类", value: categories });
        }
        f.push({ key: "cid", name: "频道", value: channels });
        f.push({ key: "fl", name: "首字母", value: letters });
        filters[tid] = f;
    }

    return JSON.stringify({
        class: classes,
        filters: filters
    });
}

function mapColumnItem(doc) {
    const colId = (doc.column_id || "").trim();
    const name = (doc.column_name || "").trim();
    const pic = fixUrl(doc.column_logo || doc.column_photo || "");
    const ch = (doc.channel_name || "").trim();
    const fc = (doc.column_firstclass || "").trim();
    const website = fixUrl(doc.column_website || doc.column_backvideoaddress || "");
    const playdate = (doc.column_playdate || "").trim();
    const brief = (doc.column_brief || "").trim();
    const last = doc.lastVIDE || {};
    const lastGuid = (last.videoSharedCode || "").trim();
    const lastTitle = (last.videoTitle || "").trim();

    if (colId) {
        colMetaCache[colId] = {
            name: name,
            pic: pic,
            ch: ch,
            fc: fc,
            website: website,
            playdate: playdate,
            brief: brief,
            lastGuid: lastGuid,
            lastTitle: lastTitle
        };
    }

    const remarks = [ch, playdate].filter(Boolean).join(" · ") || fc || "央视栏目";
    return {
        vod_id: colId + "@@" + encodeURIComponent(name) + "@@" + encodeURIComponent(website) + "@@" + encodeURIComponent(lastGuid) + "@@" + encodeURIComponent(pic),
        vod_name: name,
        vod_pic: pic,
        vod_remarks: remarks
    };
}

function homeVod() {
    return category("all", 1, false, {});
}

function category(tid, pg, filter, extend = {}) {
    try {
        const page = parseInt(pg, 10) || 1;
        const pageSize = 24;
        const ext = extend || {};
        const fc = (tid && tid !== "all") ? tid : (ext.fc || "");
        const cid = ext.cid || "";
        const fl = ext.fl || "";

        const url = `${API_BASE}/lanmu/columnSearch?fl=${encodeURIComponent(fl)}&fc=${encodeURIComponent(fc)}&cid=${encodeURIComponent(cid)}&p=${page}&n=${pageSize}&serviceId=tvcctv&t=json`;
        const data = httpGetJson(url);
        const resp = (data && data.response) || {};
        const docs = resp.docs || [];
        const total = parseInt(resp.numFound, 10) || docs.length;

        const list = [];
        for (let i = 0; i < docs.length; i++) {
            if (isHiddenColumn(docs[i])) continue;
            list.push(mapColumnItem(docs[i]));
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

function resolveTopcId(website) {
    if (!website) return "";
    if (topcCache[website]) return topcCache[website];
    const html = httpGetText(website);
    const m = html.match(/TOPC[0-9]{10,}/);
    const topc = m ? m[0] : "";
    if (topc) topcCache[website] = topc;
    return topc;
}

function fetchColumnEpisodes(topc) {
    if (!topc) return [];
    const modes = [0, 2];
    for (let m = 0; m < modes.length; m++) {
        const url = `${API_BASE}/NewVideo/getVideoListByColumn?id=${encodeURIComponent(topc)}&n=100&sort=desc&p=1&mode=${modes[m]}&serviceId=tvcctv&t=json`;
        const data = httpGetJson(url);
        const list = (data && data.data && data.data.list) || [];
        const eps = [];
        for (let i = 0; i < list.length; i++) {
            const ep = list[i];
            const guid = (ep.guid || "").trim();
            if (!guid) continue;
            const title = (ep.title || ("第" + (i + 1) + "期")).replace(/[$#]/g, " ").trim();
            eps.push({ title: title, guid: guid });
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
        const colId = parts[0] || "";
        const fallbackName = parts[1] ? decodeURIComponent(parts[1]) : "CCTV栏目大全";
        const fallbackWeb = parts[2] ? decodeURIComponent(parts[2]) : "";
        const fallbackGuid = parts[3] ? decodeURIComponent(parts[3]) : "";
        const fallbackPic = parts[4] ? decodeURIComponent(parts[4]) : "";
        const meta = colMetaCache[colId] || {};

        const website = meta.website || fallbackWeb;
        const topc = resolveTopcId(website);
        let eps = fetchColumnEpisodes(topc);

        if (eps.length === 0) {
            const lastGuid = meta.lastGuid || fallbackGuid;
            if (lastGuid) {
                eps.push({ title: meta.lastTitle || "最新一期", guid: lastGuid });
            }
        }
        if (eps.length === 0) {
            return JSON.stringify({ list: [] });
        }

        // 校验最新一期是否海外无加密可播
        const check = checkVideoInfo(eps[0].guid);
        if (check && check.blocked) {
            return JSON.stringify({ list: [] });
        }

        const playPairs = [];
        for (let i = 0; i < eps.length; i++) {
            playPairs.push(eps[i].title + "$" + eps[i].guid);
        }

        const descParts = [];
        if (meta.ch) descParts.push("播出频道：" + meta.ch);
        if (meta.playdate) descParts.push("播出时间：" + meta.playdate);
        if (meta.brief) descParts.push(meta.brief);
        if (meta.lastTitle) descParts.push("最新一期：" + meta.lastTitle);

        return JSON.stringify({
            list: [{
                vod_id: id,
                vod_name: meta.name || fallbackName,
                vod_pic: meta.pic || fallbackPic,
                type_name: [meta.fc, meta.ch].filter(Boolean).join(" / ") || "央视栏目",
                vod_area: "中国大陆",
                vod_remarks: "更新至 " + eps.length + " 期",
                vod_actor: meta.ch || "中央广播电视总台",
                vod_director: "CCTV 栏目大全",
                vod_content: descParts.join("\n") || (meta.name || fallbackName),
                vod_play_from: "央视栏目",
                vod_play_url: playPairs.join("#")
            }]
        });
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

function getAllColumns() {
    const now = Date.now();
    if (allColumnsCache && (now - allColumnsCacheTime < CACHE_TTL)) {
        return allColumnsCache;
    }
    const items = [];
    for (let p = 1; p <= 4; p++) {
        const url = `${API_BASE}/lanmu/columnSearch?fl=&fc=&cid=&p=${p}&n=100&serviceId=tvcctv&t=json`;
        const data = httpGetJson(url);
        const docs = (data && data.response && data.response.docs) || [];
        for (let i = 0; i < docs.length; i++) {
            if (isHiddenColumn(docs[i])) continue;
            items.push(docs[i]);
        }
        if (docs.length < 100) break;
    }
    if (items.length > 0) {
        allColumnsCache = items;
        allColumnsCacheTime = now;
    }
    return items;
}

function search(wd, quick, pg) {
    try {
        const kw = (wd || "").trim().toLowerCase();
        if (!kw) return JSON.stringify({ list: [] });
        const all = getAllColumns();
        const list = [];
        for (let i = 0; i < all.length; i++) {
            const d = all[i];
            const hay = ((d.column_name || "") + " " + (d.channel_name || "") + " " + (d.column_firstclass || "") + " " + (d.column_brief || "")).toLowerCase();
            if (hay.indexOf(kw) !== -1) {
                list.push(mapColumnItem(d));
            }
        }
        return JSON.stringify({
            page: 1,
            pagecount: 1,
            limit: list.length || 20,
            total: list.length,
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
