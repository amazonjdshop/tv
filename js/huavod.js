let host = "https://huavod.net";
let cachedCookie = "";
let cookieExpire = 0;
let lastForceCookie = 0;
let cookieMap = {};
let cookiePromise = null;

function textOf(res) {
    if (!res) return "";
    if (typeof res === "string") return res;
    if (typeof res === "object") {
        if (res.content !== undefined) return res.content;
        if (res.body !== undefined) return res.body;
        if (res.text !== undefined) return res.text;
        if (res.data !== undefined) return typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    }
    return String(res);
}

function parseJson(val) {
    if (!val) return null;
    if (typeof val === "object") return val;
    try { return JSON.parse(val); } catch (e) { return null; }
}

function getCookieHeader() {
    return Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join("; ") + ";";
}

function mergeCookies(input) {
    if (!input) return;
    if (typeof input === "string") {
        for (const part of input.split(";")) {
            const seg = part.trim();
            const idx = seg.indexOf("=");
            if (idx !== -1) {
                const k = seg.substring(0, idx).trim();
                const v = seg.substring(idx + 1).trim();
                if (k && v) cookieMap[k] = v;
            }
        }
        return;
    }
    if (typeof input === "object" && input.headers) {
        const raw = input.headers["set-cookie"] || input.headers["Set-Cookie"];
        if (!raw) return;
        const list = Array.isArray(raw) ? raw : [raw];
        for (const item of list) {
            for (const part of String(item).split(/,(?=[a-zA-Z0-9_-]+=)/)) {
                const seg = part.split(";")[0].trim();
                const idx = seg.indexOf("=");
                if (idx !== -1) {
                    const k = seg.substring(0, idx).trim();
                    const v = seg.substring(idx + 1).trim();
                    if (k && v) cookieMap[k] = v;
                }
            }
        }
    }
}

const DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Referer: "https://huavod.net/"
};

function getHosts() {
    return Array.from(new Set([host, "https://huavod.net", "https://huavod.com"]));
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function statusCodeOf(res) {
    if (!res || typeof res !== "object") return 0;
    const raw = (res.code !== undefined && res.code !== "") ? res.code : res.statusCode;
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
}

async function ensureCookie(force = false) {
    const now = Date.now();
    if (!force && cachedCookie && now < cookieExpire && cookieMap.user_check) {
        return getCookieHeader();
    }
    if (force && now - lastForceCookie < 15000 && cachedCookie && cookieMap.user_check) {
        return getCookieHeader();
    }
    if (cookiePromise) return cookiePromise;
    cookiePromise = (async () => {
        if (force) lastForceCookie = Date.now();
        try {
            const url = "https://uvod-t4.vercel.app/huavod/cookie" + (force ? "?force=1" : "");
            const res = await req(url, { headers: { "User-Agent": DEFAULT_HEADERS["User-Agent"] }, timeout: 6000 });
            const json = parseJson(textOf(res));
            if (json && json.cookie && json.cookie.includes("user_check=")) {
                cachedCookie = json.cookie;
                mergeCookies(json.cookie);
                cookieExpire = Date.now() + 600000;
                return getCookieHeader();
            }
        } catch (e) {}
        try {
            const res = await req("https://round-snowflake-2d83.linda11-28-2022.workers.dev/cookie", {
                headers: { "User-Agent": DEFAULT_HEADERS["User-Agent"] },
                timeout: 5000
            });
            const json = parseJson(textOf(res));
            if (json && json.cookie && json.cookie.includes("user_check=")) {
                cachedCookie = json.cookie;
                mergeCookies(json.cookie);
                cookieExpire = Date.now() + 600000;
                return getCookieHeader();
            }
        } catch (e) {}
        return getCookieHeader();
    })();
    try {
        return await cookiePromise;
    } finally {
        cookiePromise = null;
    }
}

async function fetchWithCookie(url, opts = {}) {
    await ensureCookie();
    const timeout = opts.timeout || 10000;
    const headers = Object.assign({
        "User-Agent": DEFAULT_HEADERS["User-Agent"],
        Referer: `${host}/`,
        Cookie: getCookieHeader()
    }, opts.headers || {});
    let res = await req(url, Object.assign({}, opts, { headers, timeout }));
    mergeCookies(res);
    let content = textOf(res);
    const code = statusCodeOf(res);
    const needRefresh = code === 403 || (content && content.includes("window.location.href"));
    const needRetry = !content || needRefresh || code === 429 || code >= 500 || code === 0;
    if (needRetry) {
        if (needRefresh) await ensureCookie(true);
        await sleep(code === 429 ? 900 : 450);
        headers.Cookie = getCookieHeader();
        res = await req(url, Object.assign({}, opts, { headers, timeout }));
        mergeCookies(res);
        content = textOf(res);
    }
    return { res, content };
}

let homeCache = null;
let homeCacheExpire = 0;
let homePromise = null;

function parseVodList(html) {
    const list = [];
    const seen = new Set();
    const re = /<a[^>]*href="\/voddetail\/(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const id = m[1];
        if (seen.has(id)) continue;
        const full = m[0];
        const inner = m[2];
        const titleM = full.match(/title="([^"]+)"/) || inner.match(/alt="([^"]+)"/) || inner.match(/class="[^"]*title[^"]*"[^>]*>([^<]+)/);
        const picM = inner.match(/data-(?:src|original)="([^"]+)"/) || inner.match(/src="([^"]+)"/);
        const remM = inner.match(/class="[^"]*(?:remarks|public-list-prb|public-prt|vod-rank-state)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/)
            || inner.match(/<div[^>]*class="[^"]*vod-rank-state[^"]*"[^>]*>([^<]+)<\/div>/)
            || inner.match(/<i[^>]*class="ft4"[^>]*>([^<]+)<\/i>/);
        const name = titleM ? titleM[1].replace("封面图", "").trim() : "";
        const pic = picM ? picM[1].trim() : "";
        const remarks = remM ? remM[1].replace(/<[^>]+>/g, "").trim() : "";
        if (name && pic && !pic.startsWith("data:")) {
            seen.add(id);
            list.push({ vod_id: id, vod_name: name, vod_pic: pic, vod_remarks: remarks });
        }
    }
    return list;
}

function isPollutedMovies(list) {
    if (!list || list.length === 0) return true;
    const sample = list.slice(0, 5);
    const bad = sample.filter(x => /(动漫|综艺)/.test(x.vod_remarks || "")).length;
    return bad >= 2;
}

async function loadHomeSections(force = false) {
    if (!force && homeCache && Date.now() < homeCacheExpire && homeCache.all && homeCache.all.length > 0) {
        return homeCache;
    }
    if (!force && homePromise) return homePromise;
    homePromise = (async () => {
        let html = "";
        for (const h of getHosts()) {
            try {
                const { content } = await fetchWithCookie(h);
                if (content && content.includes("/voddetail/")) {
                    html = content;
                    if (h !== host) host = h;
                    break;
                }
            } catch (e) {}
        }
        if (!html) return homeCache || {};
        const names = ["热映排行", "豆瓣热播电影", "豆瓣热播电视", "豆瓣热播综艺", "豆瓣热播动漫", "最新电影", "最新剧集", "最新综艺", "最热动漫"];
        const sections = {};
        for (const n of names) sections[n] = [];
        sections.all = [];
        const seen = new Set();
        for (const n of names) {
            const start = html.indexOf(">" + n + "<");
            if (start === -1) continue;
            let end = html.indexOf("<h2", start + n.length);
            if (end === -1) end = start + 25000;
            const items = parseVodList(html.substring(start, end));
            sections[n] = items;
            const skipPolluted = n === "最新电影" && isPollutedMovies(items);
            if (!skipPolluted) {
                for (const item of items) {
                    if (!seen.has(item.vod_id)) {
                        seen.add(item.vod_id);
                        sections.all.push(item);
                    }
                }
            }
        }
        if (sections.all.length > 0) {
            homeCache = sections;
            homeCacheExpire = Date.now() + 1800000;
        }
        return sections;
    })();
    try {
        return await homePromise;
    } finally {
        homePromise = null;
    }
}

async function fetchCategoryPage(path) {
    let html = "";
    for (const h of getHosts()) {
        try {
            const { content } = await fetchWithCookie(`${h}${path}`);
            if (content && content.includes("/voddetail/")) {
                html = content;
                if (h !== host) host = h;
                break;
            }
        } catch (e) {}
    }
    return html;
}

function parseMaxPage(html, curPage) {
    let maxPage = curPage;
    const matches = html.match(/\/page\/(\d+)\.html/g);
    if (matches) {
        for (const m of matches) {
            const p = m.match(/page\/(\d+)\.html/);
            if (p) {
                const num = parseInt(p[1], 10);
                if (num > maxPage) maxPage = num;
            }
        }
    }
    return maxPage;
}

export default {
    init: async function (cfg) {
        if (cfg && cfg.ext) {
            if (typeof cfg.ext === "string" && cfg.ext.startsWith("http")) {
                host = cfg.ext.replace(/\/+$/, "");
            } else if (cfg.ext.host) {
                host = cfg.ext.host.replace(/\/+$/, "");
            }
        }
        loadHomeSections().catch(() => {});
    },

    home: async function () {
        const filters = {
            topics: [
                {
                    key: "topic",
                    name: "专题",
                    value: [
                        { n: "全部", v: "0" },
                        { n: "热映排行", v: "热映排行" },
                        { n: "豆瓣热播电影", v: "豆瓣热播电影" },
                        { n: "豆瓣热播电视", v: "豆瓣热播电视" },
                        { n: "豆瓣热播综艺", v: "豆瓣热播综艺" },
                        { n: "豆瓣热播动漫", v: "豆瓣热播动漫" },
                        { n: "最新电影", v: "最新电影" },
                        { n: "最新剧集", v: "最新剧集" },
                        { n: "最新综艺", v: "最新综艺" },
                        { n: "最热动漫", v: "最热动漫" }
                    ]
                }
            ],
            1: [
                {
                    key: "class",
                    name: "类型",
                    value: [
                        { n: "全部", v: "" },
                        { n: "奇幻科幻", v: "6" },
                        { n: "动作冒险", v: "7" },
                        { n: "悬疑惊悚", v: "8" },
                        { n: "爱情喜剧", v: "9" },
                        { n: "战争犯罪", v: "10" },
                        { n: "动画电影", v: "11" },
                        { n: "网络电影", v: "12" },
                        { n: "4K影库", v: "53" },
                        { n: "其他", v: "13" }
                    ]
                },
                {
                    key: "area",
                    name: "地区",
                    value: [
                        { n: "全部", v: "" }, { n: "大陆", v: "大陆" }, { n: "香港", v: "香港" },
                        { n: "台湾", v: "台湾" }, { n: "美国", v: "美国" }, { n: "韩国", v: "韩国" },
                        { n: "日本", v: "日本" }, { n: "英国", v: "英国" }, { n: "法国", v: "法国" },
                        { n: "德国", v: "德国" }, { n: "欧美", v: "欧美" }, { n: "泰国", v: "泰国" },
                        { n: "印度", v: "印度" }, { n: "加拿大", v: "加拿大" }, { n: "意大利", v: "意大利" },
                        { n: "西班牙", v: "西班牙" }, { n: "澳大利亚", v: "澳大利亚" }
                    ]
                },
                {
                    key: "year",
                    name: "年份",
                    value: [
                        { n: "全部", v: "" }, { n: "2026", v: "2026" }, { n: "2025", v: "2025" },
                        { n: "2024", v: "2024" }, { n: "2023", v: "2023" }, { n: "2022", v: "2022" },
                        { n: "2021", v: "2021" }, { n: "2020", v: "2020" }, { n: "2019", v: "2019" },
                        { n: "2018", v: "2018" }, { n: "2017", v: "2017" }, { n: "2016", v: "2016" }
                    ]
                },
                {
                    key: "lang",
                    name: "语言",
                    value: [
                        { n: "全部", v: "" }, { n: "国语", v: "国语" }, { n: "英语", v: "英语" },
                        { n: "粤语", v: "粤语" }, { n: "闽南语", v: "闽南语" }, { n: "韩语", v: "韩语" },
                        { n: "日语", v: "日语" }, { n: "法语", v: "法语" }, { n: "德语", v: "德语" },
                        { n: "其它", v: "其它" }
                    ]
                },
                {
                    key: "by",
                    name: "排序",
                    value: [
                        { n: "按最热", v: "hits" },
                        { n: "按最新", v: "time" },
                        { n: "按评分", v: "score" }
                    ]
                }
            ],
            2: [
                {
                    key: "class",
                    name: "类型",
                    value: [
                        { n: "全部", v: "" }, { n: "大陆剧", v: "14" }, { n: "港台剧", v: "15" },
                        { n: "日韩剧", v: "16" }, { n: "欧美剧", v: "17" }, { n: "其他剧", v: "18" }
                    ]
                },
                {
                    key: "year",
                    name: "年份",
                    value: [
                        { n: "全部", v: "" }, { n: "2026", v: "2026" }, { n: "2025", v: "2025" },
                        { n: "2024", v: "2024" }, { n: "2023", v: "2023" }, { n: "2022", v: "2022" },
                        { n: "2021", v: "2021" }, { n: "2020", v: "2020" }, { n: "2019", v: "2019" },
                        { n: "2018", v: "2018" }, { n: "2017", v: "2017" }, { n: "2016", v: "2016" }
                    ]
                },
                {
                    key: "lang",
                    name: "语言",
                    value: [
                        { n: "全部", v: "" }, { n: "国语", v: "国语" }, { n: "英语", v: "英语" },
                        { n: "日语", v: "日语" }, { n: "韩语", v: "韩语" }, { n: "泰语", v: "泰语" },
                        { n: "粤语", v: "粤语" }, { n: "西班牙语", v: "西班牙语" }
                    ]
                },
                {
                    key: "by",
                    name: "排序",
                    value: [
                        { n: "按最新", v: "time" }, { n: "按最热", v: "hits" }, { n: "按评分", v: "score" }
                    ]
                }
            ],
            3: [
                {
                    key: "class",
                    name: "类型",
                    value: [
                        { n: "全部", v: "" }, { n: "大陆综艺", v: "19" }, { n: "港台综艺", v: "20" },
                        { n: "日韩综艺", v: "21" }, { n: "其他综艺", v: "22" }
                    ]
                },
                {
                    key: "year",
                    name: "年份",
                    value: [
                        { n: "全部", v: "" }, { n: "2026", v: "2026" }, { n: "2025", v: "2025" },
                        { n: "2024", v: "2024" }, { n: "2023", v: "2023" }, { n: "2022", v: "2022" },
                        { n: "2021", v: "2021" }, { n: "2020", v: "2020" }, { n: "2019", v: "2019" },
                        { n: "2018", v: "2018" }, { n: "2017", v: "2017" }, { n: "2016", v: "2016" }
                    ]
                },
                {
                    key: "lang",
                    name: "语言",
                    value: [
                        { n: "全部", v: "" }, { n: "国语", v: "国语" }, { n: "英语", v: "英语" },
                        { n: "粤语", v: "粤语" }, { n: "闽南语", v: "闽南语" }, { n: "韩语", v: "韩语" },
                        { n: "日语", v: "日语" }, { n: "其它", v: "其它" }
                    ]
                },
                {
                    key: "by",
                    name: "排序",
                    value: [
                        { n: "按最新", v: "time" }, { n: "按最热", v: "hits" }, { n: "按评分", v: "score" }
                    ]
                }
            ],
            4: [
                {
                    key: "class",
                    name: "类型",
                    value: [
                        { n: "全部", v: "" }, { n: "国产动漫", v: "23" },
                        { n: "日本动漫", v: "24" }, { n: "其它动漫", v: "25" }
                    ]
                },
                {
                    key: "year",
                    name: "年份",
                    value: [
                        { n: "全部", v: "" }, { n: "2026", v: "2026" }, { n: "2025", v: "2025" },
                        { n: "2024", v: "2024" }, { n: "2023", v: "2023" }, { n: "2022", v: "2022" },
                        { n: "2021", v: "2021" }, { n: "2020", v: "2020" }, { n: "2019", v: "2019" },
                        { n: "2018", v: "2018" }, { n: "2017", v: "2017" }, { n: "2016", v: "2016" }
                    ]
                },
                {
                    key: "lang",
                    name: "语言",
                    value: [
                        { n: "全部", v: "" }, { n: "国语", v: "国语" }, { n: "英语", v: "英语" },
                        { n: "粤语", v: "粤语" }, { n: "闽南语", v: "闽南语" }, { n: "韩语", v: "韩语" },
                        { n: "日语", v: "日语" }, { n: "其它", v: "其它" }
                    ]
                },
                {
                    key: "by",
                    name: "排序",
                    value: [
                        { n: "按最新", v: "time" }, { n: "按最热", v: "hits" }, { n: "按评分", v: "score" }
                    ]
                }
            ],
            5: [
                {
                    key: "year",
                    name: "年份",
                    value: [
                        { n: "全部", v: "" }, { n: "2026", v: "2026" }, { n: "2025", v: "2025" },
                        { n: "2024", v: "2024" }, { n: "2023", v: "2023" }, { n: "2022", v: "2022" },
                        { n: "2021", v: "2021" }, { n: "2020", v: "2020" }, { n: "2019", v: "2019" },
                        { n: "2018", v: "2018" }, { n: "2017", v: "2017" }, { n: "2016", v: "2016" },
                        { n: "2015", v: "2015" }
                    ]
                },
                {
                    key: "by",
                    name: "排序",
                    value: [
                        { n: "按最新", v: "time" }, { n: "按最热", v: "hits" }, { n: "按评分", v: "score" }
                    ]
                }
            ],
            42: [
                {
                    key: "class",
                    name: "类型",
                    value: [
                        { n: "全部", v: "" }, { n: "文化", v: "43" }, { n: "探索", v: "44" },
                        { n: "军事", v: "45" }, { n: "解密", v: "46" }, { n: "科技", v: "47" },
                        { n: "历史", v: "48" }, { n: "人物", v: "49" }, { n: "自然", v: "50" },
                        { n: "其他", v: "51" }
                    ]
                },
                {
                    key: "year",
                    name: "年份",
                    value: [
                        { n: "全部", v: "" }, { n: "2026", v: "2026" }, { n: "2025", v: "2025" },
                        { n: "2024", v: "2024" }, { n: "2023", v: "2023" }, { n: "2022", v: "2022" },
                        { n: "2021", v: "2021" }, { n: "2020", v: "2020" }, { n: "2019", v: "2019" },
                        { n: "2018", v: "2018" }, { n: "2017", v: "2017" }, { n: "2016", v: "2016" }
                    ]
                },
                {
                    key: "lang",
                    name: "语言",
                    value: [
                        { n: "全部", v: "" }, { n: "国语", v: "国语" }, { n: "英语", v: "英语" },
                        { n: "粤语", v: "粤语" }, { n: "闽南语", v: "闽南语" }, { n: "韩语", v: "韩语" },
                        { n: "日语", v: "日语" }, { n: "法语", v: "法语" }, { n: "德语", v: "德语" },
                        { n: "其它", v: "其它" }
                    ]
                },
                {
                    key: "by",
                    name: "排序",
                    value: [
                        { n: "按最新", v: "time" }, { n: "按最热", v: "hits" }, { n: "按评分", v: "score" }
                    ]
                }
            ]
        };
        return JSON.stringify({
            class: [
                { type_id: "topics", type_name: "🔥精选专题" },
                { type_id: "1", type_name: "电影" },
                { type_id: "2", type_name: "电视剧" },
                { type_id: "3", type_name: "综艺" },
                { type_id: "4", type_name: "动漫" },
                { type_id: "5", type_name: "短剧" },
                { type_id: "42", type_name: "纪录片" }
            ],
            filters
        });
    },

    homeVod: async function () {
        try {
            const sections = await loadHomeSections();
            return JSON.stringify({ list: sections.all || [] });
        } catch (e) {
            return JSON.stringify({ list: [] });
        }
    },

    category: async function (tid, pg, filter, extend = {}) {
        try {
            const page = parseInt(pg || 1, 10);
            if (tid === "topics" || String(tid) === "topics") {
                const topic = extend && extend.topic ? extend.topic : "0";
                if (page === 1) {
                    const sections = await loadHomeSections();
                    let list = topic && topic !== "0" && sections[topic] ? sections[topic] : (sections.all || []);
                    if (topic === "最新电影" && isPollutedMovies(list)) {
                        const html = await fetchCategoryPage("/vodshow/1/by/hits.html");
                        const alt = parseVodList(html);
                        if (alt.length > 0) list = alt;
                    }
                    return JSON.stringify({ page: 1, pagecount: 50, limit: list.length, total: 50 * list.length, list });
                }
                let path = `/label/rank/page/${page}.html`;
                if (topic === "热映排行") path = `/label/rank/page/${page}.html`;
                else if (topic === "豆瓣热播电影") path = `/vodshow/1/by/score/page/${page}.html`;
                else if (topic === "豆瓣热播电视") path = `/vodshow/2/by/score/page/${page}.html`;
                else if (topic === "豆瓣热播综艺") path = `/vodshow/3/by/score/page/${page}.html`;
                else if (topic === "豆瓣热播动漫") path = `/vodshow/4/by/score/page/${page}.html`;
                else if (topic === "最新电影") path = `/vodshow/1/by/hits/page/${page}.html`;
                else if (topic === "最新剧集") path = `/vodshow/2/page/${page}.html`;
                else if (topic === "最新综艺") path = `/vodshow/3/page/${page}.html`;
                else if (topic === "最热动漫") path = `/vodshow/4/page/${page}.html`;

                const html = await fetchCategoryPage(path);
                const list = parseVodList(html);
                const maxPage = parseMaxPage(html, page);
                return JSON.stringify({ page, pagecount: Math.max(maxPage, page + 1), list });
            }

            let showId = tid;
            if (extend && extend.class) showId = extend.class;
            let path = `/vodshow/${showId}`;
            const sortBy = (extend && extend.by) ? extend.by : (String(tid) === "1" ? "hits" : "");
            if (extend && extend.area) path += `/area/${encodeURIComponent(extend.area)}`;
            if (extend && extend.lang) path += `/lang/${encodeURIComponent(extend.lang)}`;
            if (extend && extend.year) path += `/year/${encodeURIComponent(extend.year)}`;
            if (sortBy) path += `/by/${encodeURIComponent(sortBy)}`;
            if (page > 1) path += `/page/${page}`;
            path += ".html";

            const html = await fetchCategoryPage(path);
            const list = parseVodList(html);
            const maxPage = parseMaxPage(html, page);
            return JSON.stringify({ page, pagecount: maxPage, list });
        } catch (e) {
            return JSON.stringify({ page: parseInt(pg || 1, 10), pagecount: 1, list: [] });
        }
    },

    detail: async function (id) {
        try {
            let html = "";
            for (const h of getHosts()) {
                try {
                    const { content } = await fetchWithCookie(`${h}/voddetail/${id}.html`);
                    if (content && (content.includes("anthology-list") || content.includes("vodplay") || content.includes("og:title"))) {
                        html = content;
                        if (h !== host) host = h;
                        break;
                    }
                } catch (e) {}
            }
            if (!html) return JSON.stringify({ list: [] });

            let name = "";
            const titleM = html.match(/<meta\s+property="og:title"\s+content="([^"]+?)(?:\s*-\s*华视影院)?"/i) || html.match(/<h1>([^<]+)<\/h1>/);
            if (titleM) name = titleM[1].replace(/- 华视影院$/, "").trim();

            let pic = "";
            const picM = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) || html.match(/class="[^"]*gen-movie-img[^"]*"[^>]*data-src="([^"]+)"/);
            if (picM) pic = picM[1].trim();

            let desc = "";
            const descM = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i) || html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
            if (descM) desc = descM[1].trim();

            let actor = "";
            const actorM = html.match(/主演[：:]([\s\S]*?)<\/div>/) || html.match(/主演[：:]([\s\S]*?)<\/p>/);
            if (actorM) {
                actor = actorM[1].replace(/<[^>]+>/g, "").replace(/#/g, ",").replace(/[,，\s]*导演[：:][\s\S]*$/, "").trim();
            }

            let director = "";
            const dirM = html.match(/导演[：:]([\s\S]*?)<\/div>/) || html.match(/导演[：:]([\s\S]*?)<\/p>/);
            if (dirM) director = dirM[1].replace(/<[^>]+>/g, "").trim();

            let year = "";
            const yearM = html.match(/(\d{4})年/);
            if (yearM) year = yearM[1];

            const tabs = [];
            const tabMatches = html.match(/<a[^>]*class="swiper-slide"[^>]*>.*?<\/i>&nbsp;([^<]+)<\/a>/g);
            if (tabMatches) {
                for (const t of tabMatches) {
                    const tm = t.match(/&nbsp;([^<]+)<\/a>/);
                    if (tm) tabs.push(tm[1].trim());
                }
            }
            if (tabs.length === 0) tabs.push("华视影院");

            const playFrom = [];
            const playUrl = [];
            const ulRe = /<ul[^>]*class="anthology-list-play[^"]*"[^>]*>([\s\S]*?)<\/ul>/g;
            let um;
            let idx = 0;
            while ((um = ulRe.exec(html)) !== null) {
                const eps = [];
                const epRe = /<a[^>]*href="(\/vodplay\/\d+-\d+-\d+\.html)"[^>]*>([^<]+)<\/a>/g;
                let em;
                while ((em = epRe.exec(um[1])) !== null) {
                    eps.push(`${em[2].trim()}$${em[1]}`);
                }
                if (eps.length > 0) {
                    playFrom.push(tabs[idx] || `播放线路${idx + 1}`);
                    playUrl.push(eps.join("#"));
                }
                idx++;
            }

            return JSON.stringify({
                list: [{
                    vod_id: id,
                    vod_name: name,
                    vod_pic: pic,
                    vod_remarks: year,
                    vod_year: year,
                    vod_actor: actor,
                    vod_director: director,
                    vod_content: desc,
                    vod_play_from: playFrom.join("$$$"),
                    vod_play_url: playUrl.join("$$$")
                }]
            });
        } catch (e) {
            return JSON.stringify({ list: [] });
        }
    },

    search: async function (wd, quick, pg = 1) {
        try {
            let html = "";
            for (const h of getHosts()) {
                try {
                    const { content } = await fetchWithCookie(`${h}/vodsearch/wd/${encodeURIComponent(wd)}.html`);
                    if (content && content.includes("/voddetail/")) {
                        html = content;
                        if (h !== host) host = h;
                        break;
                    }
                } catch (e) {}
            }
            const list = [];
            const seen = new Set();
            const re = /<a[^>]*class="public-list-exp"[^>]*href="\/voddetail\/(\d+)\.html"[^>]*>([\s\S]*?)<\/a>\s*<\/div>\s*<div[^>]*class="right[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
            let m;
            while ((m = re.exec(html)) !== null) {
                const id = m[1];
                if (seen.has(id)) continue;
                const nameM = m[3].match(/<a[^>]*href="\/voddetail\/\d+\.html"[^>]*>([^<]+)<\/a>/);
                const picM = m[2].match(/data-src="([^"]+)"/) || m[2].match(/src="([^"]+)"/);
                const remM = m[2].match(/class="public-list-prb[^"]*"[^>]*>([^<]+)/);
                const name = nameM ? nameM[1].trim() : "";
                if (name) {
                    seen.add(id);
                    list.push({
                        vod_id: id,
                        vod_name: name,
                        vod_pic: picM ? picM[1].trim() : "",
                        vod_remarks: remM ? remM[1].trim() : ""
                    });
                }
            }
            if (list.length === 0) {
                for (const h of getHosts()) {
                    try {
                        const { content } = await fetchWithCookie(`${h}/index.php/ajax/suggest?mid=1&wd=${encodeURIComponent(wd)}`);
                        const json = parseJson(content);
                        if (json && Array.isArray(json.list) && json.list.length > 0) {
                            for (const item of json.list) {
                                if (item.id && item.name) {
                                    list.push({
                                        vod_id: String(item.id),
                                        vod_name: item.name,
                                        vod_pic: item.pic || "",
                                        vod_remarks: ""
                                    });
                                }
                            }
                            if (h !== host) host = h;
                            break;
                        }
                    } catch (e) {}
                }
            }
            return JSON.stringify({ page: parseInt(pg || 1, 10), list });
        } catch (e) {
            return JSON.stringify({ page: parseInt(pg || 1, 10), list: [] });
        }
    },

    play: async function (flag, id, vipFlags) {
        try {
            let epId = id;
            const epM = id.match(/(\d+-\d+-\d+)/);
            if (epM) epId = epM[1];

            let ecUrl = `${host}/Player/ec?episode=${epId}`;
            let { content } = await fetchWithCookie(ecUrl, { headers: { Referer: `${host}/vodplay/${epId}.html` } });
            if (!content || (!content.includes('"mt"') && !content.includes('"channel_key"'))) {
                const altHost = host.includes(".net") ? "https://huavod.com" : "https://huavod.net";
                ecUrl = `${altHost}/Player/ec?episode=${epId}`;
                const altRes = await fetchWithCookie(ecUrl, { headers: { Referer: `${altHost}/vodplay/${epId}.html` } });
                if (altRes.content && (altRes.content.includes('"mt"') || altRes.content.includes('"channel_key"'))) {
                    content = altRes.content;
                    host = altHost;
                }
            }

            const ckM = content.match(/"channel_key":\s*"([^"]+)"/);
            if (ckM && ckM[1] && ckM[1].startsWith("http") && !ckM[1].includes("b-cdn.net")) {
                return JSON.stringify({
                    parse: 0,
                    url: ckM[1],
                    header: { "User-Agent": DEFAULT_HEADERS["User-Agent"], Referer: `${host}/` }
                });
            }

            const urlM = content.match(/"url":\s*"([^"]+)"/);
            if (urlM && urlM[1] && urlM[1].startsWith("http")) {
                return JSON.stringify({
                    parse: 0,
                    url: urlM[1],
                    header: { "User-Agent": DEFAULT_HEADERS["User-Agent"], Referer: `${host}/` }
                });
            }

            const mtM = content.match(/"mt":\s*"([^"]+)"/);
            if (!mtM) return JSON.stringify({ parse: 0, url: "" });

            let token = mtM[1];
            let playUrl = "";
            for (let attempt = 0; attempt < 3; attempt++) {
                const { content: resText } = await fetchWithCookie(`${host}/Player/resolveUrl`, {
                    method: "post",
                    postType: "form",
                    data: { token },
                    body: `token=${encodeURIComponent(token)}`,
                    headers: {
                        Referer: ecUrl,
                        Origin: host,
                        "Content-Type": "application/x-www-form-urlencoded",
                        "X-Requested-With": "XMLHttpRequest"
                    }
                });
                try {
                    const json = parseJson(resText);
                    if (json && json.code === 1 && json.data && json.data.url) {
                        playUrl = json.data.url;
                        break;
                    }
                    if (attempt === 0 && (!json || json.code !== 1)) {
                        await ensureCookie(true);
                        const refreshed = await fetchWithCookie(ecUrl, { headers: { Referer: `${host}/vodplay/${epId}.html` } });
                        const newMt = (refreshed.content || "").match(/"mt":\s*"([^"]+)"/);
                        if (newMt && newMt[1]) token = newMt[1];
                    }
                } catch (e) {}
                if (attempt < 2) await sleep(500);
            }
            return playUrl
                ? JSON.stringify({ parse: 0, url: playUrl, header: { "User-Agent": DEFAULT_HEADERS["User-Agent"], Referer: `${host}/` } })
                : JSON.stringify({ parse: 0, url: "" });
        } catch (e) {
            return JSON.stringify({ parse: 0, url: "" });
        }
    }
};
