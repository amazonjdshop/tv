/**
 * 独播库最新官网 (dbku.tv) 电视端 QuickJS 点播爬虫
 * 适配电视端 FongMi / TVBox / CatVod 架构
 * 
 * 特性：
 * 1. 30分钟 LRU 内存安全缓存池 (最多 300 条)，杜绝重复请求与内存泄漏
 * 2. 请求防并发击穿 (Pending Promise Deduplication)
 * 3. 首页 home() 零延迟秒开与多级分类支持 (陆剧/日韩/短剧/台泰)
 * 4. 高速 原画 M3U8 免嗅探直连解析播放 (parse: 0)
 * 5. 线路名称统一定制为「北美专线」
 * 6. 兼容 TVBox QuickJS 与 Node 调试环境
 */

let HOST = 'https://www.dbku.tv';

const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.dbku.tv/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
};

// ==================== 轻量 Base64 与 URL 解码层 ====================

function base64Decode(str) {
    if (typeof atob === 'function') {
        try {
            return atob(str);
        } catch (e) {}
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let clean = String(str || '').replace(/[\r\n\s=]/g, '');
    let bin = '';
    for (let i = 0; i < clean.length; i += 4) {
        let n = (chars.indexOf(clean.charAt(i)) << 18)
            | (chars.indexOf(clean.charAt(i + 1)) << 12)
            | (chars.indexOf(clean.charAt(i + 2)) << 6)
            | (chars.indexOf(clean.charAt(i + 3)));
        bin += String.fromCharCode((n >> 16) & 255, (n >> 8) & 255, n & 255);
    }
    return bin.replace(/\0+$/, '');
}

function decodeUrl(encoded) {
    let decoded = encoded;
    try {
        decoded = decodeURIComponent(encoded);
    } catch (e) {
        try {
            decoded = unescape(encoded);
        } catch (e2) {}
    }
    return decoded;
}

// ==================== 高性能 LRU 内存缓存与防抖并发层 ====================
const CACHE_TTL_DEFAULT = 1800 * 1000; // 默认 30 分钟 (1,800,000 毫秒)
const CACHE_MAX_ENTRIES = 300;         // 最多保留 300 条记录，LRU 淘汰

const memoryCache = new Map();
const pendingRequests = new Map();

function setCacheSafe(key, data, ttl = CACHE_TTL_DEFAULT) {
    if (!key || data === undefined || data === null) return;
    if (memoryCache.has(key)) {
        memoryCache.delete(key);
    } else if (memoryCache.size >= CACHE_MAX_ENTRIES) {
        const oldestKey = memoryCache.keys().next().value;
        if (oldestKey) memoryCache.delete(oldestKey);
    }
    memoryCache.set(key, {
        expire: Date.now() + ttl,
        data: data
    });
}

function getCacheSafe(key) {
    if (!memoryCache.has(key)) return null;
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expire) {
        memoryCache.delete(key);
        return null;
    }
    memoryCache.delete(key);
    memoryCache.set(key, entry);
    return entry.data;
}

async function request(url, options = {}) {
    if (typeof req === 'function') {
        const res = await req(url, options);
        if (res && typeof res === 'object') {
            return res.content || '';
        }
        return String(res || '');
    }
    // Node.js 仿真环境 fallback
    if (typeof globalThis !== 'undefined' && globalThis.fetch) {
        const resp = await globalThis.fetch(url, {
            method: options.method || 'GET',
            headers: options.headers || defaultHeaders
        });
        return await resp.text();
    }
    return '';
}

async function fetchWithCache(url, ttl = CACHE_TTL_DEFAULT) {
    const cached = getCacheSafe(url);
    if (cached !== null) {
        return cached;
    }

    if (pendingRequests.has(url)) {
        return pendingRequests.get(url);
    }

    const fetchPromise = (async () => {
        try {
            const content = await request(url, {
                method: 'get',
                headers: defaultHeaders,
                timeout: 8000
            });
            if (content && content.length > 20) {
                setCacheSafe(url, content, ttl);
            }
            return content;
        } catch (e) {
            return '';
        } finally {
            pendingRequests.delete(url);
        }
    })();

    pendingRequests.set(url, fetchPromise);
    return fetchPromise;
}

// ==================== 接口定义与实现 ====================

async function init(cfg) {
    if (cfg) {
        if (typeof cfg === 'string' && cfg.startsWith('http')) {
            HOST = cfg.replace(/\/+$/, '');
        } else if (cfg.ext) {
            if (typeof cfg.ext === 'string' && cfg.ext.startsWith('http')) {
                HOST = cfg.ext.replace(/\/+$/, '');
            } else if (cfg.ext.api) {
                HOST = cfg.ext.api.replace(/\/+$/, '');
            }
        }
    }

    // 静默预加载电视剧首页
    fetchWithCache(`${HOST}/vodtype/2.html`).catch(() => {});
}

async function home(filter) {
    const classes = [
        { type_id: '2', type_name: '连续剧' },
        { type_id: '13', type_name: '陆剧' },
        { type_id: '15', type_name: '日韩剧' },
        { type_id: '21', type_name: '短剧' },
        { type_id: '14', type_name: '台泰剧' },
        { type_id: '1', type_name: '电影' },
        { type_id: '3', type_name: '综艺' },
        { type_id: '4', type_name: '动漫' }
    ];

    const commonAreas = [
        { n: '全部', v: '' },
        { n: '大陆', v: '大陆' },
        { n: '台湾', v: '台湾' },
        { n: '韩国', v: '韩国' },
        { n: '日本', v: '日本' },
        { n: '香港', v: '香港' },
        { n: '泰国', v: '泰国' },
        { n: '新加坡', v: '新加坡' },
        { n: '美国', v: '美国' },
        { n: '英国', v: '英国' }
    ];

    const commonYears = [
        { n: '全部', v: '' },
        { n: '2026', v: '2026' },
        { n: '2025', v: '2025' },
        { n: '2024', v: '2024' },
        { n: '2023', v: '2023' },
        { n: '2022', v: '2022' },
        { n: '2021', v: '2021' },
        { n: '2020', v: '2020' },
        { n: '2019', v: '2019' },
        { n: '2018', v: '2018' },
        { n: '2017', v: '2017' }
    ];

    const commonSorts = [
        { n: '最新时间', v: '' },
        { n: '最高人气', v: '人气' },
        { n: '最高评分', v: '评分' }
    ];

    const dramaClasses = [
        { n: '全部', v: '' },
        { n: '古装', v: '古装' }, { n: '悬疑', v: '悬疑' }, { n: '都市', v: '都市' },
        { n: '爱情', v: '爱情' }, { n: '武侠', v: '武侠' }, { n: '科幻', v: '科幻' },
        { n: '战争', v: '战争' }, { n: '青春', v: '青春' }, { n: '偶像', v: '偶像' },
        { n: '喜剧', v: '喜剧' }, { n: '家庭', v: '家庭' }, { n: '历险', v: '历险' },
        { n: '谍战', v: '谍战' }, { n: '奇幻', v: '奇幻' }, { n: '动作', v: '动作' }
    ];

    const movieClasses = [
        { n: '全部', v: '' },
        { n: '动作', v: '动作' }, { n: '喜剧', v: '喜剧' }, { n: '爱情', v: '爱情' },
        { n: '科幻', v: '科幻' }, { n: '惊悚', v: '惊悚' }, { n: '犯罪', v: '犯罪' },
        { n: '剧情', v: '剧情' }, { n: '悬疑', v: '悬疑' }, { n: '奇幻', v: '奇幻' },
        { n: '战争', v: '战争' }, { n: '恐怖', v: '恐怖' }, { n: '动画', v: '动画' },
        { n: '冒险', v: '冒险' }, { n: '灾难', v: '灾难' }
    ];

    const zyClasses = [
        { n: '全部', v: '' },
        { n: '真人秀', v: '真人秀' }, { n: '脱口秀', v: '脱口秀' }, { n: '生活', v: '生活' },
        { n: '访谈', v: '访谈' }, { n: '搞笑', v: '搞笑' }, { n: '竞技', v: '竞技' },
        { n: '选秀', v: '选秀' }, { n: '晚会', v: '晚会' }
    ];

    const dmClasses = [
        { n: '全部', v: '' },
        { n: '热血', v: '热血' }, { n: '科幻', v: '科幻' }, { n: '魔幻', v: '魔幻' },
        { n: '冒险', v: '冒险' }, { n: '搞笑', v: '搞笑' }, { n: '机战', v: '机战' },
        { n: '少女', v: '少女' }, { n: '恋爱', v: '恋爱' }, { n: '校园', v: '校园' },
        { n: '治愈', v: '治愈' }, { n: '推理', v: '推理' }, { n: '穿越', v: '穿越' }
    ];

    function buildFilter(classList) {
        return [
            { key: 'class', name: '剧情', value: classList },
            { key: 'area', name: '地区', value: commonAreas },
            { key: 'year', name: '年代', value: commonYears },
            { key: 'by', name: '排序', value: commonSorts }
        ];
    }

    const filters = {
        '2': buildFilter(dramaClasses),
        '13': buildFilter(dramaClasses),
        '15': buildFilter(dramaClasses),
        '21': buildFilter(dramaClasses),
        '14': buildFilter(dramaClasses),
        '1': buildFilter(movieClasses),
        '3': buildFilter(zyClasses),
        '4': buildFilter(dmClasses)
    };

    return JSON.stringify({
        class: classes,
        filters: filters
    });
}

async function homeVod() {
    return await category('2', 1);
}

function parseCards(html) {
    const list = [];
    let boxes = html.split(/<div class="myui-vodlist__box">/i);
    if (boxes.length <= 1) {
        boxes = html.split(/<li class="clearfix">/i);
    }

    for (let i = 1; i < boxes.length; i++) {
        const b = boxes[i];
        const idM = b.match(/href="\/voddetail\/(\d+)\.html"/);
        const titleM = b.match(/title="([^"]+)"/);
        const picM = b.match(/data-original="([^"]+)"/) || b.match(/src="([^"]+)"/);
        const remM = b.match(/<span class="pic-text[^"]*">([^<]+)<\/span>/);
        const tagM = b.match(/<span class="tag"[^>]*>([^<]+)<\/span>/);

        if (idM && titleM) {
            let pic = picM ? picM[1].trim() : '';
            if (pic.startsWith('//')) pic = 'https:' + pic;

            let remarks = '';
            if (remM) {
                remarks = remM[1].trim();
            } else if (tagM) {
                remarks = tagM[1].trim();
            }

            list.push({
                vod_id: idM[1],
                vod_name: titleM[1].trim(),
                vod_pic: pic,
                vod_remarks: remarks
            });
        }
    }

    return list;
}

async function category(tid, pg, filter, extend = {}) {
    try {
        const page = parseInt(pg || 1);
        const cateId = tid || '2';
        const area = extend.area ? encodeURIComponent(extend.area) : '';
        const by = extend.by ? encodeURIComponent(extend.by) : '';
        const cls = extend.class ? encodeURIComponent(extend.class) : '';
        const year = extend.year || '';

        // MacCMS vodshow 严格 12 段 URL 规范:
        // [0:id, 1:area, 2:by, 3:class, 4:lang, 5:letter, 6:level, 7:tag, 8:page, 9:empty, 10:empty, 11:year]
        const parts = [
            cateId,
            area,
            by,
            cls,
            '',
            '',
            '',
            '',
            String(page),
            '',
            '',
            year
        ];
        const url = `${HOST}/vodshow/${parts.join('-')}.html`;
        const html = await fetchWithCache(url, 600 * 1000);
        const list = parseCards(html);

        return JSON.stringify({
            page: page,
            pagecount: list.length > 0 ? page + 1 : page,
            limit: 48,
            total: list.length * 10,
            list: list
        });
    } catch (e) {
        return JSON.stringify({ page: pg || 1, pagecount: 0, limit: 48, total: 0, list: [] });
    }
}

async function detail(id) {
    try {
        const vid = String(id).replace(/^\/voddetail\//, '').replace(/\.html$/, '');
        const url = `${HOST}/voddetail/${vid}.html`;
        const html = await fetchWithCache(url, 900 * 1000);

        // 标题
        const titleMatch = html.match(/<h1 class="title">([^<]+)<\/h1>/) || html.match(/<title>([^-<]+)/);
        const name = titleMatch ? titleMatch[1].trim() : '';

        // 封面
        const coverMatch = html.match(/<a class="myui-vodlist__thumb[^"]*"[^>]+(?:data-original|src)="([^"]+)"/);
        let pic = coverMatch ? coverMatch[1].trim() : '';
        if (pic.startsWith('//')) pic = 'https:' + pic;

        // 导演
        const directorMatch = html.match(/<span class="text-muted">导演：<\/span>([\s\S]*?)<\/p>/);
        const director = directorMatch ? directorMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() : '';

        // 主演
        const actorMatch = html.match(/<span class="text-muted">主演：<\/span>([\s\S]*?)<\/p>/);
        const actor = actorMatch ? actorMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() : '';

        // 简介
        const descMatch = html.match(/<span class="data"[^>]*>([\s\S]*?)<\/span>/) || html.match(/<span class="content"[^>]*>([\s\S]*?)<\/span>/);
        const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() : '';

        // 选集列表
        const epRegex = /<a[^>]+href="(\/vodplay\/\d+-\d+-\d+\.html)"[^>]*>([^<]+)<\/a>/gi;
        const epList = [];
        let m;
        while ((m = epRegex.exec(html)) !== null) {
            const epPath = m[1];
            const epTitle = m[2].trim();
            epList.push(`${epTitle}$${epPath}`);
        }

        const vod = [{
            vod_id: vid,
            vod_name: name,
            vod_pic: pic,
            vod_remarks: '',
            vod_actor: actor,
            vod_director: director,
            vod_content: desc,
            vod_play_from: '北美专线',
            vod_play_url: epList.join('#')
        }];

        return JSON.stringify({ list: vod });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function search(wd, quick, pg = 1) {
    try {
        const page = parseInt(pg || 1);
        const url = `${HOST}/vodsearch/-------------.html?wd=${encodeURIComponent(wd)}`;
        const html = await fetchWithCache(url, 300 * 1000);
        const list = parseCards(html);

        return JSON.stringify({
            page: page,
            pagecount: list.length > 0 ? page + 1 : page,
            limit: 20,
            total: list.length,
            list: list
        });
    } catch (e) {
        return JSON.stringify({
            page: pg || 1,
            pagecount: 0,
            limit: 20,
            total: 0,
            list: []
        });
    }
}

async function play(flag, id, flags) {
    try {
        const playPath = id.startsWith('http') ? id : (id.startsWith('/') ? `${HOST}${id}` : `${HOST}/${id}`);
        const html = await fetchWithCache(playPath, 600 * 1000);

        // 提取 player_data 内的加密 M3U8 地址
        const m = html.match(/var\s+player_data\s*=\s*({[\s\S]*?});/);
        let encUrl = '';
        if (m) {
            try {
                const pObj = JSON.parse(m[1]);
                encUrl = pObj.url || '';
            } catch (e) {
                const urlMatch = m[1].match(/"url"\s*:\s*"([^"]+)"/);
                if (urlMatch) encUrl = urlMatch[1];
            }
        }

        if (!encUrl) {
            const fallbackMatch = html.match(/"url"\s*:\s*"([^"]+)"/);
            if (fallbackMatch) encUrl = fallbackMatch[1];
        }

        if (encUrl) {
            let streamUrl = encUrl;
            // 判断是否为 Base64 编码
            if (!streamUrl.startsWith('http')) {
                streamUrl = decodeUrl(base64Decode(encUrl));
            }

            if (streamUrl.startsWith('//')) {
                streamUrl = 'https:' + streamUrl;
            }

            if (streamUrl.startsWith('http')) {
                return JSON.stringify({
                    parse: 0,
                    url: streamUrl,
                    header: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Origin': HOST,
                        'Referer': `${HOST}/`
                    }
                });
            }
        }

        // 兜底返回原播放页让播放器自行解析
        return JSON.stringify({
            parse: 1,
            url: playPath
        });
    } catch (e) {
        return JSON.stringify({
            parse: 1,
            url: id
        });
    }
}

export default {
    init: init,
    home: home,
    homeVod: homeVod,
    category: category,
    detail: detail,
    play: play,
    search: search
};
