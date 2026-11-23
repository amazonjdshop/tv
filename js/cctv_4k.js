/**
 * CCTV 4K 专区电视端 QuickJS 爬虫 (含全功能多维筛选 + 缓存加速)
 * 适配电视端 FongMi / TVBox / CatVod (type: 3)
 *
 * 特性：
 * 1. 直连央视官方 4K 专区底层 API (CHAL1558416868484111)
 * 2. 多级联动筛选（支持「类型/子类」、「年份」、「排序」三维交叉筛选）
 * 3. 内存缓存池（30分钟缓存 211 部全量超清片源，切换筛选 0ms 秒开）
 * 4. 自动解析剧集专辑，完整拉取全部集数（第1集~第N集）
 * 5. 直出 4000K 码率超清免嗅探无加密 Master M3U8 (parse: 0)
 */

const API_BASE = "https://api.cntv.cn";
const CDN_BASE = "https://hls.cntv.cdn20.com/asp/hls/4000/0303000a/3/default";

const DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://tv.cctv.com/4K/index.shtml"
};

// 全量节目缓存池 (211 部全量数据)
let cachedItems = null;
let lastCacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 分钟

function init(ext) {
    // 爬虫初始化
}

function getAll4KItems() {
    const now = Date.now();
    if (cachedItems && (now - lastCacheTime < CACHE_TTL)) {
        return cachedItems;
    }

    const items = [];
    try {
        // CCTV 4K 专区全量约 211 条，分页拉取 3 页合并
        for (let p = 1; p <= 3; p++) {
            const url = `${API_BASE}/NewVideo/getLastVideoList4K?serviceId=cctv4k&cid=CHAL1558416868484111&p=${p}&n=100&t=json`;
            const res = req(url, { headers: DEFAULT_HEADERS });
            if (res && res.content) {
                const data = JSON.parse(res.content);
                const list = (data && data.data && data.data.list) || [];
                for (let i = 0; i < list.length; i++) {
                    const it = list[i];
                    // 补充年份
                    const u = (it.last_video && it.last_video.url) || "";
                    const m = u.match(/\/20(\d\d)\//);
                    it._year = m ? ("20" + m[1]) : "";
                    items.push(it);
                }
                if (list.length < 100) break;
            }
        }
        cachedItems = items;
        lastCacheTime = now;
    } catch (e) {
        if (!cachedItems) cachedItems = [];
    }
    return cachedItems;
}

function home(filter) {
    try {
        const classes = [
            { type_id: "all", type_name: "全部精选" },
            { type_id: "电视剧", type_name: "经典好剧" },
            { type_id: "纪录片", type_name: "人文纪录" },
            { type_id: "生活", type_name: "华夏美食" },
            { type_id: "科教", type_name: "文化旅游" },
            { type_id: "特别节目", type_name: "特别呈现" },
            { type_id: "综艺", type_name: "综艺大赏" },
            { type_id: "新闻", type_name: "专题新闻" }
        ];

        // 共通排序
        const commonSorts = [
            { n: "最新发布", v: "new" },
            { n: "名称排序", v: "title" }
        ];

        // 年份筛选
        const commonYears = [
            { n: "全部年份", v: "all" },
            { n: "2026年", v: "2026" },
            { n: "2025年", v: "2025" },
            { n: "2024年", v: "2024" },
            { n: "2023年", v: "2023" },
            { n: "2022年", v: "2022" },
            { n: "2021年", v: "2021" },
            { n: "2020年", v: "2020" },
            { n: "2019年", v: "2019" }
        ];

        // 电视剧题材子类
        const dramaSubTypes = [
            { n: "全部题材", v: "all" },
            { n: "革命/谍战", v: "革命" },
            { n: "年代/励志", v: "年代" },
            { n: "历史/战争", v: "历史" },
            { n: "军旅/军事", v: "军旅" },
            { n: "都市/生活", v: "都市" },
            { n: "农村/社会", v: "农村" }
        ];

        // 纪录片题材子类
        const docSubTypes = [
            { n: "全部题材", v: "all" },
            { n: "人文历史", v: "人文历史" },
            { n: "自然探索", v: "探索" },
            { n: "地理风物", v: "旅游" },
            { n: "经典人物", v: "人物" },
            { n: "大国科技", v: "科技" }
        ];

        // 统一构建各分类下的筛选器
        function buildFilters(subTypes) {
            const f = [];
            if (subTypes && subTypes.length > 0) {
                f.push({ key: "class", name: "类型", value: subTypes });
            }
            f.push({ key: "year", name: "年份", value: commonYears });
            f.push({ key: "sort", name: "排序", value: commonSorts });
            return f;
        }

        const filters = {
            "all": buildFilters([
                { n: "全部类型", v: "all" },
                { n: "电视剧", v: "电视剧" },
                { n: "纪录片", v: "纪录片" },
                { n: "生活美食", v: "生活" },
                { n: "文化旅游", v: "科教" },
                { n: "特别节目", v: "特别节目" },
                { n: "综艺新闻", v: "综艺" }
            ]),
            "电视剧": buildFilters(dramaSubTypes),
            "纪录片": buildFilters(docSubTypes),
            "生活": buildFilters([]),
            "科教": buildFilters([]),
            "特别节目": buildFilters([]),
            "综艺": buildFilters([]),
            "新闻": buildFilters([])
        };

        return JSON.stringify({
            class: classes,
            filters: filters
        });
    } catch (e) {
        return JSON.stringify({ class: [] });
    }
}

function homeVod() {
    try {
        return category("all", 1, false, {});
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

function category(tid, pg, filter, extend = {}) {
    try {
        const page = parseInt(pg) || 1;
        const pageSize = 20;

        // 确保从全局缓存池加载全部片源
        const all = getAll4KItems();

        // 1. 提取筛选条件
        const selClass = extend.class || "all";
        const selYear = extend.year || "all";
        const selSort = extend.sort || "new";

        // 2. 内存过滤
        let filtered = [];
        for (let i = 0; i < all.length; i++) {
            const it = all[i];
            const fc = (it.fc || "").trim();
            const sc = (it.sc || "").trim();
            const year = it._year || "";

            // 主分类过滤
            if (tid && tid !== "all") {
                if (tid === "科教") {
                    if (fc !== "科教" && fc !== "文化") continue;
                } else {
                    if (fc !== tid) continue;
                }
            }

            // 二级子类过滤 (extend.class)
            if (selClass !== "all") {
                if (tid === "all") {
                    if (fc !== selClass && !fc.includes(selClass)) continue;
                } else {
                    // 在 sc 题材标签中匹配
                    if (!sc.includes(selClass) && !fc.includes(selClass)) continue;
                }
            }

            // 年份过滤 (extend.year)
            if (selYear !== "all") {
                if (year !== selYear) continue;
            }

            filtered.push(it);
        }

        // 3. 排序处理
        if (selSort === "title") {
            filtered.sort((a, b) => (a.title || "").localeCompare(b.title || "", "zh-CN"));
        }

        // 4. 分页截取
        const total = filtered.length;
        const startIndex = (page - 1) * pageSize;
        const pageItems = filtered.slice(startIndex, startIndex + pageSize);

        const list = [];
        for (let i = 0; i < pageItems.length; i++) {
            const item = pageItems[i];
            const lastVideo = item.last_video || {};
            const title = (item.title || lastVideo.title || "").trim();
            const pic = item.image || item.image3 || lastVideo.image || "";
            const albumId = item.id || "";
            const guid = lastVideo.id || "";
            const vsetid = item.vsetid || "";
            const fc = (item.fc || "").trim();
            const year = item._year ? `${item._year}·` : "";

            const vodId = `${albumId}@@${vsetid}@@${guid}@@${encodeURIComponent(title)}`;

            list.push({
                vod_id: vodId,
                vod_name: title,
                vod_pic: pic.startsWith("//") ? "https:" + pic : pic,
                vod_remarks: fc ? `4K超清·${year}${fc}` : "4K超清",
                vod_year: item._year || ""
            });
        }

        return JSON.stringify({
            page: page,
            pagecount: Math.ceil(total / pageSize) || 1,
            limit: pageSize,
            total: total,
            list: list
        });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

function detail(id) {
    try {
        const parts = id.split("@@");
        const albumId = parts[0] || "";
        const vsetid = parts[1] || "";
        const defaultGuid = parts[2] || "";
        const name = parts[3] ? decodeURIComponent(parts[3]) : "CCTV 4K超清";

        let epList = [];

        // 优先拉取全部分集
        if (albumId) {
            const listUrl = `${API_BASE}/NewVideo/getVideoListByAlbumIdNew?id=${albumId}&serviceId=cctv4k&p=1&n=100&sort=asc&mode=0&pub=1&t=json`;
            const res = req(listUrl, { headers: DEFAULT_HEADERS });
            if (res && res.content) {
                try {
                    const data = JSON.parse(res.content);
                    const rawEps = (data && data.data && data.data.list) || [];
                    for (let i = 0; i < rawEps.length; i++) {
                        const ep = rawEps[i];
                        const epTitle = (ep.title || `第${i + 1}集`).trim();
                        const epGuid = ep.guid || "";
                        if (epGuid) {
                            epList.push(`${epTitle}$${epGuid}`);
                        }
                    }
                } catch (e) {}
            }
        }

        // 若无分集，兜底用默认 GUID
        if (epList.length === 0 && defaultGuid) {
            epList.push(`4K超清正片$${defaultGuid}`);
        }

        const vod = [{
            vod_id: id,
            vod_name: name,
            vod_pic: "",
            type_name: "CCTV 4K",
            vod_year: "2026",
            vod_area: "中国",
            vod_remarks: `全${epList.length}集`,
            vod_actor: "中央广播电视总台",
            vod_director: "央视制作",
            vod_content: "中央广播电视总台 CCTV 4K超清专区，提供 4000K 极清画质呈现。",
            vod_play_from: "央视超清",
            vod_play_url: epList.join("#")
        }];

        return JSON.stringify({ list: vod });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

function play(flag, id, flags) {
    try {
        let playUrl = "";
        if (id.startsWith("http")) {
            playUrl = id;
        } else {
            playUrl = `${CDN_BASE}/${id}/4000.m3u8`;
        }

        return JSON.stringify({
            parse: 0,
            url: playUrl,
            header: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://tv.cctv.com/"
            }
        });
    } catch (e) {
        return JSON.stringify({ parse: 0, url: "" });
    }
}

function search(wd, quick) {
    try {
        if (!wd) return JSON.stringify({ list: [] });
        const all = getAll4KItems();
        const kw = wd.toLowerCase().trim();
        const matched = [];

        for (let i = 0; i < all.length; i++) {
            const item = all[i];
            const title = (item.title || (item.last_video && item.last_video.title) || "").trim();
            if (title.toLowerCase().includes(kw)) {
                const pic = item.image || item.image3 || (item.last_video && item.last_video.image) || "";
                const albumId = item.id || "";
                const guid = (item.last_video && item.last_video.id) || "";
                const vsetid = item.vsetid || "";
                const fc = (item.fc || "").trim();
                const vodId = `${albumId}@@${vsetid}@@${guid}@@${encodeURIComponent(title)}`;

                matched.push({
                    vod_id: vodId,
                    vod_name: title,
                    vod_pic: pic.startsWith("//") ? "https:" + pic : pic,
                    vod_remarks: fc ? `4K超清·${fc}` : "4K超清",
                    vod_year: item._year || ""
                });
            }
        }
        return JSON.stringify({ list: matched });
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
