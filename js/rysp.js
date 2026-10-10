/**
 * 北美如意视频 (rysp.tv) 电视端 QuickJS 点播爬虫
 * 适配电视端 FongMi / TVBox / CatVod 架构
 * 
 * 特性：
 * 1. 30分钟 LRU 内存安全缓存池 (最多 300 条)，杜绝重复请求与内存泄漏
 * 2. 请求防并发击穿 (Pending Promise Deduplication)
 * 3. 首页 home() 零延迟秒开与标签全支持
 * 4. 高速 M3U8 免嗅探直连解析播放 (parse: 0)
 * 5. 兼容 TVBox QuickJS 与 Node 调试环境
 */

let HOST = 'https://rysp.tv';

const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://rysp.tv/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'X-Requested-With': 'XMLHttpRequest'
};

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
    fetchWithCache(`${HOST}/video/refresh-cate?channel_id=2&page_num=1&page_size=24`).catch(() => {});
}

async function home(filter) {
    const classes = [
        { type_id: '2', type_name: '电视剧' },
        { type_id: '1', type_name: '电影' },
        { type_id: '3', type_name: '综艺' },
        { type_id: '4', type_name: '动漫' },
        { type_id: '32', type_name: '纪录片' }
    ];

    const commonAreas = [
        { n: '全部', v: '0' },
        { n: '国产', v: '18' },
        { n: '欧美', v: '19' },
        { n: '香港', v: '20' },
        { n: '韩国', v: '21' },
        { n: '日本', v: '24' },
        { n: '台湾', v: '23' },
        { n: '英国', v: '22' },
        { n: '泰国', v: '31' },
        { n: '东南亚', v: '29' },
        { n: '其它', v: '30' }
    ];

    const commonYears = [
        { n: '全部', v: '0' },
        { n: '2026', v: '132' },
        { n: '2025', v: '131' },
        { n: '2024', v: '130' },
        { n: '2023', v: '129' },
        { n: '2022', v: '21' },
        { n: '2021', v: '22' },
        { n: '2020', v: '23' },
        { n: '2019', v: '24' },
        { n: '2018', v: '25' },
        { n: '更早', v: '127' }
    ];

    const commonSorts = [
        { n: '最新添加', v: 'new' },
        { n: '人气最高', v: 'hot' },
        { n: '评分最高', v: 'score' }
    ];

    const tvTags = [
        { n: '全部', v: '0' },
        { n: '短剧', v: '364' }, { n: '古装', v: '254' }, { n: '都市', v: '259' },
        { n: '言情', v: '253' }, { n: '爱情', v: '252' }, { n: '悬疑', v: '269' },
        { n: '武侠', v: '263' }, { n: '玄幻', v: '256' }, { n: '历史', v: '255' },
        { n: '谍战', v: '257' }, { n: '偶像', v: '251' }, { n: '科幻', v: '260' },
        { n: '军旅', v: '261' }, { n: '喜剧', v: '262' }, { n: '罪案', v: '265' },
        { n: '家庭', v: '267' }, { n: '战争', v: '268' }, { n: '穿越', v: '270' },
        { n: '动作', v: '275' }, { n: '惊悚', v: '385' }, { n: '恐怖', v: '386' },
        { n: '其他', v: '231' }
    ];

    const movieTags = [
        { n: '全部', v: '0' },
        { n: '动作', v: '154' }, { n: '喜剧', v: '153' }, { n: '爱情', v: '155' },
        { n: '科幻', v: '159' }, { n: '悬疑', v: '160' }, { n: '犯罪', v: '157' },
        { n: '惊悚', v: '156' }, { n: '恐怖', v: '169' }, { n: '剧情', v: '161' },
        { n: '奇幻', v: '226' }, { n: '魔幻', v: '179' }, { n: '战争', v: '164' },
        { n: '动画', v: '283' }, { n: '冒险', v: '280' }, { n: '灾难', v: '281' },
        { n: '歌舞', v: '282' }, { n: '经典', v: '284' }, { n: '其他', v: '178' }
    ];

    const zyTags = [
        { n: '全部', v: '0' },
        { n: '真人秀', v: '227' }, { n: '生活', v: '229' }, { n: '脱口秀', v: '228' },
        { n: '搞笑', v: '289' }, { n: '访谈', v: '168' }, { n: '选秀', v: '287' },
        { n: '竞技', v: '290' }, { n: '情感', v: '291' }, { n: '晚会', v: '293' },
        { n: '演唱会', v: '292' }, { n: '其他', v: '232' }
    ];

    const dmTags = [
        { n: '全部', v: '0' },
        { n: '热血', v: '165' }, { n: '科幻', v: '296' }, { n: '魔幻', v: '299' },
        { n: '冒险', v: '300' }, { n: '搞笑', v: '297' }, { n: '机战', v: '166' },
        { n: '少女', v: '294' }, { n: '恋爱', v: '301' }, { n: '校园', v: '302' },
        { n: '治愈', v: '303' }, { n: '推理', v: '298' }, { n: '穿越', v: '305' },
        { n: '其他', v: '170' }
    ];

    const docTags = [
        { n: '全部', v: '0' },
        { n: '文化', v: '234' }, { n: '历史', v: '310' }, { n: '科技', v: '309' },
        { n: '人物', v: '311' }, { n: '自然', v: '312' }, { n: '军事', v: '236' },
        { n: '解密', v: '237' }, { n: '探索', v: '235' }, { n: '其他', v: '238' }
    ];

    function buildFilter(tagList) {
        return [
            { key: 'tag', name: '类型', value: tagList },
            { key: 'area', name: '地区', value: commonAreas },
            { key: 'year', name: '年代', value: commonYears },
            { key: 'sort', name: '排序', value: commonSorts }
        ];
    }

    const filters = {
        '2': buildFilter(tvTags),
        '1': buildFilter(movieTags),
        '3': buildFilter(zyTags),
        '4': buildFilter(dmTags),
        '32': buildFilter(docTags)
    };

    return JSON.stringify({
        class: classes,
        filters: filters
    });
}

async function homeVod() {
    return await category('2', 1);
}

async function category(tid, pg, filter, extend = {}) {
    try {
        const page = parseInt(pg || 1);
        const channelId = tid || '2';
        const tag = extend.tag || '0';
        const area = extend.area || '0';
        const year = extend.year || '0';
        const sort = extend.sort || 'new';

        const url = `${HOST}/video/refresh-cate?channel_id=${channelId}&page_num=${page}&page_size=24&tag=${tag}&area=${area}&year=${year}&sort=${sort}`;
        const raw = await fetchWithCache(url, 600 * 1000);
        
        let json = {};
        try {
            json = JSON.parse(raw);
        } catch (e) {
            return JSON.stringify({ page: page, pagecount: 0, limit: 24, total: 0, list: [] });
        }

        const data = json.data || {};
        const rawList = Array.isArray(data.list) ? data.list : [];
        const totalCount = data.total_count || 0;
        const pageCount = Math.ceil(totalCount / 24) || (rawList.length > 0 ? page + 1 : page);

        const list = rawList.map(item => ({
            vod_id: String(item.video_id),
            vod_name: item.video_name || '',
            vod_pic: item.cover || '',
            vod_remarks: item.flag || (item.score ? `${item.score}分` : ''),
            vod_year: item.year || ''
        }));

        // 下一页静默预加载 (无感丝滑翻页，最多预加载至第 15 页)
        if (rawList.length > 0 && page < pageCount && page <= 15) {
            const nextUrl = `${HOST}/video/refresh-cate?channel_id=${channelId}&tag=${tag}&area=${area}&year=${year}&sort=${sort}&page_num=${page + 1}&page_size=24`;
            Promise.resolve().then(() => {
                fetchWithCache(nextUrl, 600 * 1000).catch(() => {});
            }).catch(() => {});
        }

        return JSON.stringify({
            page: page,
            pagecount: pageCount,
            limit: 24,
            total: totalCount,
            list: list
        });
    } catch (e) {
        return JSON.stringify({ page: pg || 1, pagecount: 0, limit: 24, total: 0, list: [] });
    }
}

async function detail(id) {
    try {
        const vid = String(id).split('@')[0];
        const url = `${HOST}/video/detail?video_id=${vid}`;
        const html = await fetchWithCache(url, 900 * 1000);

        // 标题
        const titleMatch = html.match(/<title>([^-<]+)/);
        const name = titleMatch ? titleMatch[1].trim() : '';

        // 封面
        const coverMatch = html.match(/<div class="GNbox-xq-img">[\s\S]*?(?:originalSrc|src)="([^"]+)"/);
        let pic = coverMatch ? coverMatch[1].trim() : '';
        if (pic.startsWith('//')) pic = 'https:' + pic;

        // 导演
        const directorMatch = html.match(/导演：\s*<span>([\s\S]*?)<\/span>/);
        const director = directorMatch ? directorMatch[1].replace(/<[^>]+>/g, '').replace(/[\/\s]+/g, ' ').trim() : '';

        // 主演
        const actorMatch = html.match(/主演：\s*<span>([\s\S]*?)<\/span>/);
        const actor = actorMatch ? actorMatch[1].replace(/<[^>]+>/g, '').replace(/[\/\s]+/g, ' ').trim() : '';

        // 简介
        const descMatch = html.match(/简介：\s*<span>([\s\S]*?)<\/span>/);
        const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        // 更新状态 / 备注
        const updateMatch = html.match(/更新：\s*<span>([\s\S]*?)<\/span>/);
        const remarks = updateMatch ? updateMatch[1].trim() : '';

        // 添加时间 / 年代
        const timeMatch = html.match(/添加时间：\s*<span>(?:(\d{4})年)?/);
        const year = timeMatch && timeMatch[1] ? timeMatch[1] : '';

        // 提取章节剧集列表
        const epRegex = /<a[^>]+href="[^"]*video\/detail\?video_id=(\d+)&chapter_id=(\d+)"[^>]*>([\s\S]*?)<\/a>/g;
        const epList = [];
        let m;
        while ((m = epRegex.exec(html)) !== null) {
            const rawTitle = m[3].replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '').trim();
            const chapterId = m[2];
            let epName = rawTitle || `第${epList.length + 1}集`;
            if (/^\d+$/.test(epName)) {
                epName = `第${epName}集`;
            }
            epList.push(`${epName}$${vid}@${chapterId}`);
        }

        // 如果没有章节列表 (如单集电影)，提供正片入口
        if (epList.length === 0) {
            epList.push(`正片$${vid}@0`);
        }

        const vod = [{
            vod_id: vid,
            vod_name: name,
            vod_pic: pic,
            vod_remarks: remarks,
            vod_year: year,
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
        const url = `${HOST}/video/refresh-video?keyword=${encodeURIComponent(wd)}&page_num=${page}&page_size=24`;
        const html = await fetchWithCache(url, 300 * 1000);

        const list = [];
        const parts = html.split(/<li\s+class="Movie-list">/i);

        for (let i = 1; i < parts.length; i++) {
            const block = parts[i];
            const idM = block.match(/href="\/video\/detail\?video_id=(\d+)"/);
            const nameM = block.match(/<a class="Movie-name02"[^>]*>([\s\S]*?)<\/a>/) ||
                         block.match(/<div class="Movie-name01"[^>]*>([\s\S]*?)<\/div>/);
            const picM = block.match(/originalSrc="([^"]+)"/) || block.match(/src="([^"]+)"/);
            const remM = block.match(/<div class="Movie-type02"[^>]*>[\s\S]*?<div>\s*([^<]+?)\s*<\/div>\s*<\/div>/);
            const scoreM = block.match(/<div class="oth-time"[^>]*>([\s\S]*?)<\/div>/);

            if (idM) {
                let pic = picM ? picM[1].trim() : '';
                if (pic.startsWith('//')) pic = 'https:' + pic;

                let remarks = '';
                if (remM) {
                    remarks = remM[1].trim();
                } else if (scoreM) {
                    remarks = scoreM[1].replace(/<!--[\s\S]*?-->/g, '').trim();
                }

                list.push({
                    vod_id: idM[1],
                    vod_name: nameM ? nameM[1].trim() : '',
                    vod_pic: pic,
                    vod_remarks: remarks
                });
            }
        }

        return JSON.stringify({
            page: page,
            pagecount: list.length > 0 ? page + 1 : page,
            limit: 24,
            total: list.length,
            list: list
        });
    } catch (e) {
        return JSON.stringify({
            page: pg || 1,
            pagecount: 0,
            limit: 24,
            total: 0,
            list: []
        });
    }
}

async function play(flag, id, flags) {
    try {
        let playTargetUrl = '';
        if (id.startsWith('http')) {
            playTargetUrl = id;
        } else {
            const parts = id.split('@');
            const vid = parts[0];
            const cid = parts[1];
            if (cid && cid !== '0') {
                playTargetUrl = `${HOST}/video/detail?video_id=${vid}&chapter_id=${cid}`;
            } else {
                playTargetUrl = `${HOST}/video/detail?video_id=${vid}`;
            }
        }

        const cacheKey = `m3u8_${playTargetUrl}`;
        const cachedStream = getCacheSafe(cacheKey);
        if (cachedStream) {
            return JSON.stringify({
                parse: 0,
                url: cachedStream,
                header: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Origin': `${HOST}`,
                    'Referer': `${HOST}/`
                }
            });
        }

        const html = await fetchWithCache(playTargetUrl, 600 * 1000);

        // 提取 qualitystr 内的真实 M3U8 地址
        const m3u8Match = html.match(/url:\s*'([^']+\.m3u8)'/);
        if (m3u8Match && m3u8Match[1]) {
            let streamUrl = m3u8Match[1];
            if (streamUrl.startsWith('//')) {
                streamUrl = 'https:' + streamUrl;
            }
            setCacheSafe(cacheKey, streamUrl, 900 * 1000); // 缓存 15 分钟
            return JSON.stringify({
                parse: 0,
                url: streamUrl,
                header: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Origin': `${HOST}`,
                    'Referer': `${HOST}/`
                }
            });
        }

        // 兜底返回由播放器内核解析
        return JSON.stringify({
            parse: 1,
            url: playTargetUrl
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
