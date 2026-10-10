/**
/**
 * 华人影视 (huarw.com) 爬虫脚本 (QuickJS ES Module)
 * 适配电视端 FongMi / TVBox 协议架构
 * 
 * 特性：
 * 1. 30分钟 LRU 内存安全缓存池 (最多 300 条)，杜绝重复请求与内存泄漏
 * 2. 请求防并发击穿 (Pending Promise Deduplication)
 * 3. 首页 home() 零延迟秒开
 * 4. 静默预热 (init 阶段预充热门首屏)
 * 5. 下一页静默预加载 (Background Prefetching)
 * 6. 多专线聚合 (暴风无广、魔都无广、天涯超清、非凡高速、量子备用等)
 * 7. m3u8 直链秒播 (免 WebView 嗅探，直连播放)
 */

let HOST = 'https://huarw.com';

const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://huarw.com/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
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
    // 命中缓存：刷新在 Map 迭代器中的位置 (LRU)
    memoryCache.delete(key);
    memoryCache.set(key, entry);
    return entry.data;
}

async function fetchHtmlWithCache(url, ttl = CACHE_TTL_DEFAULT) {
    const cached = getCacheSafe(url);
    if (cached !== null) {
        return cached;
    }

    if (pendingRequests.has(url)) {
        return pendingRequests.get(url);
    }

    const fetchPromise = (async () => {
        try {
            const res = await req(url, {
                method: 'get',
                headers: defaultHeaders,
                timeout: 8000
            });
            const content = (typeof res === 'object' && res.content) ? res.content : String(res || '');
            if (content && content.length > 50) {
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

// ==================== 接口实现 ====================

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

    // 启动多任务后台静默预热：并发缓存首页与电影第1页
    Promise.all([
        fetchHtmlWithCache(`${HOST}/`),
        fetchHtmlWithCache(`${HOST}/show/dianying/page/1`)
    ]).catch(() => {});
}

async function home(filter) {
    const classes = [
        { type_id: 'dianying', type_name: '电影' },
        { type_id: 'dianshiju', type_name: '电视剧' },
        { type_id: 'zongyi', type_name: '综艺' },
        { type_id: 'dongman', type_name: '动漫' },
        { type_id: 'duanju', type_name: '短剧' }
    ];

    const commonAreas = [
        { n: '全部', v: '' },
        { n: '大陆', v: '大陆' },
        { n: '香港', v: '香港' },
        { n: '台湾', v: '台湾' },
        { n: '美国', v: '美国' },
        { n: '韩国', v: '韩国' },
        { n: '日本', v: '日本' },
        { n: '法国', v: '法国' },
        { n: '英国', v: '英国' },
        { n: '德国', v: '德国' },
        { n: '泰国', v: '泰国' },
        { n: '印度', v: '印度' },
        { n: '意大利', v: '意大利' },
        { n: '西班牙', v: '西班牙' },
        { n: '加拿大', v: '加拿大' },
        { n: '其他', v: '其他' }
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
        { n: '2017', v: '2017' },
        { n: '2016', v: '2016' },
        { n: '2015', v: '2015' },
        { n: '2014', v: '2014' },
        { n: '2013', v: '2013' },
        { n: '2012', v: '2012' },
        { n: '2011', v: '2011' },
        { n: '2010', v: '2010' }
    ];

    const commonLangs = [
        { n: '全部', v: '' },
        { n: '国语', v: '国语' },
        { n: '粤语', v: '粤语' },
        { n: '英语', v: '英语' },
        { n: '韩语', v: '韩语' },
        { n: '日语', v: '日语' },
        { n: '法语', v: '法语' },
        { n: '德语', v: '德语' },
        { n: '闽南语', v: '闽南语' }
    ];

    const movieClasses = [
        { n: '全部', v: '' },
        { n: '喜剧片', v: 'xijupian' },
        { n: '动作片', v: 'dongzuopian' },
        { n: '爱情片', v: 'aiqingpian' },
        { n: '科幻片', v: 'kehuanpian' },
        { n: '恐怖片', v: 'kongbupian' },
        { n: '剧情片', v: 'juqingpian' },
        { n: '战争片', v: 'zhanzhengpian' },
        { n: '动画片', v: 'donghuapian' }
    ];

    const tvClasses = [
        { n: '全部', v: '' },
        { n: '国产剧', v: 'guochangju' },
        { n: '欧美剧', v: 'oumeiju' },
        { n: '日韩剧', v: 'hanguoju' },
        { n: '日本剧', v: 'ribenju' },
        { n: '韩国剧', v: 'hanguoju' },
        { n: '海外剧', v: 'haiwaiju' }
    ];

    function makeFilter(classList) {
        const res = [];
        if (classList && classList.length > 0) {
            res.push({ key: 'class', name: '分类', value: classList });
        }
        res.push({ key: 'area', name: '地区', value: commonAreas });
        res.push({ key: 'year', name: '年份', value: commonYears });
        res.push({ key: 'lang', name: '语言', value: commonLangs });
        return res;
    }

    const filters = {
        'dianying': makeFilter(movieClasses),
        'dianshiju': makeFilter(tvClasses),
        'zongyi': makeFilter([]),
        'dongman': makeFilter([]),
        'duanju': makeFilter([])
    };

    return JSON.stringify({
        class: classes,
        filters: filters
    });
}

function parseCards(html) {
    const list = [];
    const seen = new Set();
    const parts = html.split('class="public-list-box');
    for (let i = 1; i < parts.length; i++) {
        const block = parts[i];
        const idM = block.match(/href="\/movie\/(\d+)"/);
        if (!idM) continue;
        const id = idM[1];
        if (seen.has(id)) continue;
        seen.add(id);

        const nameM = block.match(/<h3>[\s\S]*?<a[^>]*>\s*([^<]+)\s*<\/a>/) ||
                      block.match(/title="([^"<]+)"/) ||
                      block.match(/alt="([^"<]+)封面图"/);
        const name = nameM ? nameM[1].trim() : '';

        const picM = block.match(/data-src="([^"<]+)"/) || block.match(/src="([^"<]+)"/);
        let pic = picM ? picM[1].trim() : '';
        if (pic.startsWith('//')) pic = 'https:' + pic;

        const remM = block.match(/class="public-list-prb[^"]*">\s*([^<]+)\s*<\/span>/);
        const remarks = remM ? remM[1].trim() : '';

        list.push({
            vod_id: id,
            vod_name: name,
            vod_pic: pic,
            vod_remarks: remarks
        });
    }
    return list;
}

async function homeVod() {
    try {
        const html = await fetchHtmlWithCache(`${HOST}/`);
        const list = parseCards(html);
        return JSON.stringify({ list: list });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function category(tid, pg, filter, extend = {}) {
    try {
        const page = parseInt(pg || 1);
        let base = tid;
        if (extend && extend.class) {
            base = extend.class;
        }

        let path = `/show/${base}`;
        if (extend && extend.area) path += `/area/${encodeURIComponent(extend.area)}`;
        if (extend && extend.year) path += `/year/${encodeURIComponent(extend.year)}`;
        if (extend && extend.lang) path += `/lang/${encodeURIComponent(extend.lang)}`;
        path += `/page/${page}`;

        const url = `${HOST}${path}`;
        const html = await fetchHtmlWithCache(url);
        const list = parseCards(html);

        // 提取最大页码
        let pageCount = page;
        const maxPageMatch = html.match(/\/page\/(\d+)[^"]*"[^>]*title=["']尾页["']/);
        if (maxPageMatch && maxPageMatch[1]) {
            pageCount = parseInt(maxPageMatch[1]);
        } else {
            const allPages = html.match(/\/page\/(\d+)/g);
            if (allPages) {
                for (const p of allPages) {
                    const num = parseInt(p.replace('/page/', ''));
                    if (num > pageCount) pageCount = num;
                }
            }
        }

        // 下一页静默预加载 (最多预加载至第 15 页)
        if (page < pageCount && page <= 15) {
            let nextPath = `/show/${base}`;
            if (extend && extend.area) nextPath += `/area/${encodeURIComponent(extend.area)}`;
            if (extend && extend.year) nextPath += `/year/${encodeURIComponent(extend.year)}`;
            if (extend && extend.lang) nextPath += `/lang/${encodeURIComponent(extend.lang)}`;
            nextPath += `/page/${page + 1}`;
            const nextUrl = `${HOST}${nextPath}`;
            Promise.resolve().then(() => fetchHtmlWithCache(nextUrl)).catch(() => {});
        }

        return JSON.stringify({
            page: page,
            pagecount: pageCount,
            limit: 24,
            total: pageCount * 24,
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

function formatLineName(name, index) {
    if (!name) return `专线${index + 1}`;
    let n = name.replace(/[【】]/g, '').trim();
    if (n.includes('无广①')) return '暴风专线【无广】';
    if (n.includes('无广②')) return '专线②【无广】';
    if (n.includes('无广③')) return '魔都专线【无广】';
    if (n.includes('超清①')) return '天涯超清专线';
    if (n.includes('高速')) return '非凡高速专线';
    if (n.includes('国内①')) return '国内专线';
    if (n.includes('备用①')) return '量子备用专线';
    if (n.includes('备用②')) return '无尽备用专线';
    return n;
}

async function detail(id) {
    try {
        const url = `${HOST}/movie/${id}`;
        const html = await fetchHtmlWithCache(url);

        const titleMatch = html.match(/<div class="slide-info-title[^"]*">([^<]+)<\/div>/);
        const name = titleMatch ? titleMatch[1].trim() : '';

        const picMatch = html.match(/<div class="picture">[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"/);
        let pic = picMatch ? picMatch[1].trim() : '';
        if (pic.startsWith('//')) pic = 'https:' + pic;

        const remarksMatch = html.match(/<div class="slide-info hide"><strong class="r6">备注 :<\/strong>([^<]+)<\/div>/);
        const remarks = remarksMatch ? remarksMatch[1].trim() : '';

        const directorMatch = html.match(/<div class="slide-info hide"><strong class="r6">导演 :<\/strong>([\s\S]*?)<\/div>/);
        let director = '';
        if (directorMatch) {
            director = directorMatch[1].replace(/<[^>]+>/g, '').replace(/[\/\s]+/g, ' ').trim();
        }

        const actorMatch = html.match(/<div class="slide-info hide"><strong class="r6">演员 :<\/strong>([\s\S]*?)<\/div>/);
        let actor = '';
        if (actorMatch) {
            actor = actorMatch[1].replace(/<[^>]+>/g, '').replace(/[\/\s]+/g, ' ').trim();
        }

        const descMatch = html.match(/<div id="height_limit"[^>]*class="[^"]*text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        const yearMatch = html.match(/<a href="\/search\/year\/(\d+)"/);
        const year = yearMatch ? yearMatch[1] : '';

        const areaMatch = html.match(/<a href="\/search\/area\/([^"]+)"/);
        const area = areaMatch ? decodeURIComponent(areaMatch[1]) : '';

        // 提取线路名称
        const tabRegex = /<a class="swiper-slide[^"]*">(?:<i[^>]*><\/i>&nbsp;)?【([^】]+)】/g;
        const lineNames = [];
        let tm;
        while ((tm = tabRegex.exec(html)) !== null) {
            lineNames.push(formatLineName(tm[1], lineNames.length));
        }

        function getLinePriority(name) {
            if (!name) return 50;
            if (name.includes('无广') || name.includes('暴风') || name.includes('魔都')) return 100;
            if (name.includes('超清') || name.includes('天涯')) return 90;
            if (name.includes('高速') || name.includes('非凡')) return 80;
            if (name.includes('国内')) return 70;
            if (name.includes('备用') || name.includes('量子') || name.includes('无尽')) return 30;
            if (name.includes('快车') || name.includes('广告')) return 20;
            return 50;
        }

        // 提取每条线路的播放列表
        const listBoxRegex = /<ul class="anthology-list-play[^"]*">([\s\S]*?)<\/ul>/g;
        const sources = [];
        let listIndex = 0;
        let lbm;

        while ((lbm = listBoxRegex.exec(html)) !== null) {
            const lineName = lineNames[listIndex] || `专线${listIndex + 1}`;
            const epRegex = /<a[^>]+data-play-sid="(\d+)"[^>]+href="\/play\/(\d+)-(\d+)"[^>]*>\s*([^<]+)\s*<\/a>/g;
            const epList = [];
            let epm;
            while ((epm = epRegex.exec(lbm[1])) !== null) {
                const sid = epm[1];
                const vodId = epm[2];
                const nid = epm[3];
                const epTitle = epm[4].trim();
                const epPlayId = `${vodId}-${sid}-${nid}`;
                epList.push(`${epTitle}$${epPlayId}`);
            }

            if (epList.length > 0) {
                sources.push({
                    name: lineName,
                    urls: epList.join('#'),
                    priority: getLinePriority(lineName),
                    index: listIndex
                });
            }
            listIndex++;
        }

        // 智能优选：无广/超清专线置顶，备用/广告源排后
        sources.sort((a, b) => b.priority - a.priority || a.index - b.index);

        const playFromList = sources.map(s => s.name);
        const playUrlList = sources.map(s => s.urls);

        const vod = [{
            vod_id: String(id),
            vod_name: name,
            vod_pic: pic,
            vod_remarks: remarks,
            vod_year: year,
            vod_area: area,
            vod_actor: actor,
            vod_director: director,
            vod_content: desc,
            vod_play_from: playFromList.join('$$$'),
            vod_play_url: playUrlList.join('$$$')
        }];

        return JSON.stringify({ list: vod });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function play(flag, id, flags) {
    try {
        const url = `${HOST}/play/${id}`;
        // 播放页缓存 10 分钟
        const html = await fetchHtmlWithCache(url, 600 * 1000);

        const playerMatch = html.match(/var\s+player_aaaa\s*=\s*({.+?})(?:;|<\/script>)/);
        if (playerMatch && playerMatch[1]) {
            let pObj = null;
            try {
                pObj = JSON.parse(playerMatch[1]);
            } catch (err) {}

            if (pObj && pObj.url) {
                let playUrl = pObj.url;
                if (pObj.encrypt === 1) {
                    playUrl = unescape(playUrl);
                } else if (pObj.encrypt === 2) {
                    try {
                        playUrl = unescape(atob(playUrl));
                    } catch (e) {}
                }

                if (playUrl.startsWith('//')) {
                    playUrl = 'https:' + playUrl;
                }

                if (playUrl.startsWith('http')) {
                    return JSON.stringify({
                        parse: 0,
                        playUrl: '',
                        url: playUrl,
                        header: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Origin': 'https://huarw.com',
                            'Referer': 'https://huarw.com/'
                        }
                    });
                }
            }
        }

        // 兜底返回，由客户端内核解析
        return JSON.stringify({
            parse: 1,
            url: url
        });
    } catch (e) {
        return JSON.stringify({
            parse: 1,
            url: `${HOST}/play/${id}`
        });
    }
}

async function search(wd, quick, pg = 1) {
    try {
        const page = parseInt(pg || 1);
        const url = `${HOST}/search?wd=${encodeURIComponent(wd)}&page=${page}`;
        const html = await fetchHtmlWithCache(url, 300 * 1000);
        const list = parseCards(html);

        return JSON.stringify({
            page: page,
            pagecount: list.length >= 20 ? page + 1 : page,
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

export default {
    init: init,
    home: home,
    homeVod: homeVod,
    category: category,
    detail: detail,
    play: play,
    search: search
};
