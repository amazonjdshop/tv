/**
 * 欧乐影院 (olevod.com) 电视端 QuickJS 点播爬虫
 * 适配电视端 FongMi / TVBox / CatVod 架构
 * 
 * 特性：
 * 1. 30分钟 LRU 内存安全缓存池 (最多 300 条)，杜绝重复请求与内存泄漏
 * 2. 请求防并发击穿 (Pending Promise Deduplication)
 * 3. 逆向提取 api.olelive.com 核心底层接口，动态计算时间戳 _vv 校验特征码
 * 4. 高速 原画 Master M3U8 直播/点播免嗅探秒播 (parse: 0)
 * 5. 线路名称统一定制为「北美专线」
 * 6. 精炼 5 大核心分类（连续剧/电影/综艺/动漫/短剧）
 * 7. 纯 JS 极速 MD5 与加密运算，无任何原生二进制依赖，完美兼容 QuickJS 与 Node
 */

const API_HOST = 'https://api.olelive.com';
const WEB_HOST = 'https://www.olevod.com';
const IMG_HOST = 'https://static.olelive.com/';

const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.olevod.com/',
    'Origin': 'https://www.olevod.com',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
};

// ==================== 纯 JS 极速 MD5 实现 ====================
function md5(string) {
    if (typeof md5X === 'function') {
        try {
            const res = md5X(string);
            if (res) return res.toLowerCase();
        } catch (e) {}
    }

    function rotateLeft(lValue, iShiftBits) {
        return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }
    function addUnsigned(lX, lY) {
        const lX4 = (lX & 0x40000000);
        const lY4 = (lY & 0x40000000);
        const lX8 = (lX & 0x80000000);
        const lY8 = (lY & 0x80000000);
        const lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
        if (lX4 & lY4) return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
        if (lX4 | lY4) {
            if (lResult & 0x40000000) return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
            else return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
        } else {
            return (lResult ^ lX8 ^ lY8);
        }
    }
    function F(x, y, z) { return (x & y) | ((~x) & z); }
    function G(x, y, z) { return (x & z) | (y & (~z)); }
    function H(x, y, z) { return (x ^ y ^ z); }
    function I(x, y, z) { return (y ^ (x | (~z))); }
    function FF(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function GG(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function HH(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function II(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function convertToWordArray(str) {
        let lWordCount;
        const lMessageLength = str.length;
        const lNumberOfWords_temp1 = lMessageLength + 8;
        const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
        const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
        const lWordArray = Array(lNumberOfWords - 1);
        let lBytePosition = 0;
        let lByteCount = 0;
        while (lByteCount < lMessageLength) {
            lWordCount = (lByteCount - (lByteCount % 4)) / 4;
            lBytePosition = (lByteCount % 4) * 8;
            lWordArray[lWordCount] = (lWordArray[lWordCount] | (str.charCodeAt(lByteCount) << lBytePosition));
            lByteCount++;
        }
        lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = (lWordArray[lWordCount] | (0x80 << lBytePosition));
        lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
        lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
        return lWordArray;
    }
    function wordToHex(lValue) {
        let WordToHexValue = '', WordToHexValue_temp = '', lByte, lCount;
        for (lCount = 0; lCount <= 3; lCount++) {
            lByte = (lValue >>> (lCount * 8)) & 255;
            WordToHexValue_temp = '0' + lByte.toString(16);
            WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
        }
        return WordToHexValue;
    }
    const x = convertToWordArray(string);
    let k, AA, BB, CC, DD, a, b, c, d;
    const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
    const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
    const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
    const S41 = 6, S42 = 10, S43 = 15, S44 = 21;
    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
    for (k = 0; k < x.length; k += 16) {
        AA = a; BB = b; CC = c; DD = d;
        a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478); d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
        c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB); b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
        a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF); d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
        c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613); b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
        a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8); d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
        c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1); b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
        a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122); d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
        c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E); b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
        a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562); d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
        c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51); b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
        a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D); d = GG(d, a, b, c, x[k + 10], S22, 0x02441453);
        c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681); b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
        a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6); d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
        c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87); b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
        a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905); d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
        c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9); b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
        a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942); d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
        c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122); b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
        a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44); d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
        c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60); b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
        a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6); d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
        c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085); b = HH(b, c, d, a, x[k + 6], S34, 0x04881D05);
        a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039); d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
        c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8); b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
        a = II(a, b, c, d, x[k + 0], S41, 0xF4292244); d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
        c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7); b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
        a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3); d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
        c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D); b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
        a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F); d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
        c = II(c, d, a, b, x[k + 6], S43, 0xA3014314); b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
        a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82); d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
        c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB); b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
        a = addUnsigned(a, AA); b = addUnsigned(b, BB); c = addUnsigned(c, CC); d = addUnsigned(d, DD);
    }
    return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

// ==================== 欧乐接口特征签名层 (_vv) ====================
function he(e) {
    let t = [], r = e.split('');
    for (let i = 0; i < r.length; i++) {
        if (i !== 0) t.push(' ');
        let code = r[i].charCodeAt().toString(2);
        t.push(code);
    }
    return t.join('');
}

function fe(e) {
    let t = e.toString(), r = [[], [], [], []];
    for (let i = 0; i < t.length; i++) {
        let eStr = he(t[i]);
        r[0] += eStr.slice(2, 3);
        r[1] += eStr.slice(3, 4);
        r[2] += eStr.slice(4, 5);
        r[3] += eStr.slice(5);
    }
    let a = [];
    for (let i = 0; i < r.length; i++) {
        let hex = parseInt(r[i], 2).toString(16);
        if (hex.length === 2) hex = '0' + hex;
        if (hex.length === 1) hex = '00' + hex;
        if (hex.length === 0) hex = '000';
        a[i] = hex;
    }
    let n = md5(t);
    return n.slice(0, 3) + a[0] + n.slice(6, 11) + a[1] + n.slice(14, 19) + a[2] + n.slice(22, 27) + a[3] + n.slice(30);
}

function getVv() {
    const timestamp = Math.floor(Date.now() / 1000);
    return fe(timestamp);
}

// ==================== 高性能 LRU 内存缓存与防抖并发层 ====================
const CACHE_TTL_DEFAULT = 1800 * 1000; // 默认 30 分钟
const CACHE_MAX_ENTRIES = 300;         // 最多保留 300 条记录

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
            headers: options.headers || defaultHeaders,
            body: options.data || options.body
        });
        return await resp.text();
    }
    return '';
}

async function fetchWithCache(url, ttl = CACHE_TTL_DEFAULT) {
    const cached = getCacheSafe(url);
    if (cached) return cached;

    if (pendingRequests.has(url)) {
        return await pendingRequests.get(url);
    }

    const p = (async () => {
        try {
            const res = await request(url, { headers: defaultHeaders });
            if (res && res.length > 0) {
                setCacheSafe(url, res, ttl);
            }
            return res;
        } finally {
            pendingRequests.delete(url);
        }
    })();

    pendingRequests.set(url, p);
    return await p;
}

// ==================== 爬虫生命周期函数 ====================

async function init(cfg) {
    // 静默预热电视连续剧首屏缓存
    const preUrl = `${API_HOST}/v1/pub/vod/list/true/3/0/0/2/0/0/desc/1/20?_vv=${getVv()}`;
    fetchWithCache(preUrl).catch(() => {});
}

async function home(filter) {
    const classes = [
        { type_id: '2', type_name: '连续剧' },
        { type_id: '1', type_name: '电影' },
        { type_id: '3', type_name: '综艺' },
        { type_id: '4', type_name: '动漫' },
        { type_id: '14', type_name: '短剧' }
    ];

    const commonSorts = [
        { n: '最新更新', v: 'desc' },
        { n: '最高人气', v: 'hot' },
        { n: '最高评分', v: 'score' }
    ];

    const dramaSubTypes = [
        { n: '全部', v: '0' },
        { n: '国产剧', v: '202' },
        { n: '欧美剧', v: '201' },
        { n: '港台剧', v: '203' },
        { n: '日韩剧', v: '204' }
    ];

    const movieSubTypes = [
        { n: '全部', v: '0' },
        { n: '动作片', v: '101' },
        { n: '喜剧片', v: '102' },
        { n: '爱情片', v: '103' },
        { n: '科幻片', v: '104' },
        { n: '恐怖片', v: '105' },
        { n: '剧情片', v: '106' },
        { n: '战争片', v: '107' },
        { n: '动画片', v: '108' },
        { n: '悬疑片', v: '109' },
        { n: '惊悚片', v: '110' },
        { n: '纪录片', v: '111' },
        { n: '犯罪片', v: '113' }
    ];

    const zySubTypes = [
        { n: '全部', v: '0' },
        { n: '真人秀', v: '305' },
        { n: '音乐', v: '302' },
        { n: '搞笑', v: '304' },
        { n: '家庭', v: '301' },
        { n: '曲艺', v: '303' }
    ];

    const dmSubTypes = [
        { n: '全部', v: '0' },
        { n: '日本动漫', v: '401' },
        { n: '国产动漫', v: '402' },
        { n: '欧美动漫', v: '403' }
    ];

    const djSubTypes = [
        { n: '全部', v: '0' },
        { n: '言情', v: '1209' },
        { n: '都市', v: '1210' },
        { n: '甜宠', v: '1211' },
        { n: '逆袭', v: '1212' },
        { n: '玄幻', v: '1213' }
    ];

    function buildFilter(subTypes) {
        return [
            { key: 'class', name: '分类', value: subTypes },
            { key: 'by', name: '排序', value: commonSorts }
        ];
    }

    const filters = {
        '2': buildFilter(dramaSubTypes),
        '1': buildFilter(movieSubTypes),
        '3': buildFilter(zySubTypes),
        '4': buildFilter(dmSubTypes),
        '14': buildFilter(djSubTypes)
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
        const cateId = tid || '2';
        const subClass = extend.class || '0';
        const sort = extend.by || 'desc';

        // 欧乐分类 API 格式:
        // /v1/pub/vod/list/true/3/0/0/{cateId}/{subClass}/0/{sort}/{page}/20
        const url = `${API_HOST}/v1/pub/vod/list/true/3/0/0/${cateId}/${subClass}/0/${sort}/${page}/20?_vv=${getVv()}`;
        const raw = await fetchWithCache(url, 600 * 1000);
        const res = JSON.parse(raw);

        const list = [];
        if (res && res.data && Array.isArray(res.data.list)) {
            for (let item of res.data.list) {
                let pic = item.pic || item.picThumb || '';
                if (pic && !pic.startsWith('http')) {
                    pic = IMG_HOST + pic.replace(/^\/+/, '');
                }

                list.push({
                    vod_id: String(item.id),
                    vod_name: item.name || '',
                    vod_pic: pic,
                    vod_remarks: item.remarks || (item.score ? item.score + '分' : '')
                });
            }
        }

        const total = (res && res.data && res.data.total) ? res.data.total : list.length;
        const pagecount = Math.ceil(total / 20) || (page + 1);

        return JSON.stringify({
            page: page,
            pagecount: pagecount,
            limit: 20,
            total: total,
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

async function search(wd, quick, pg = 1) {
    try {
        const page = parseInt(pg || 1);
        const url = `${API_HOST}/v1/pub/index/search/${encodeURIComponent(wd)}/vod/0/${page}/20?_vv=${getVv()}`;
        const raw = await fetchWithCache(url, 300 * 1000);
        const res = JSON.parse(raw);

        const list = [];
        const seen = new Set();

        if (res && res.data && Array.isArray(res.data.data)) {
            for (let block of res.data.data) {
                if (block && Array.isArray(block.list)) {
                    for (let item of block.list) {
                        const sid = String(item.id);
                        if (!seen.has(sid)) {
                            seen.add(sid);
                            let pic = item.pic || item.picThumb || '';
                            if (pic && !pic.startsWith('http')) {
                                pic = IMG_HOST + pic.replace(/^\/+/, '');
                            }

                            list.push({
                                vod_id: sid,
                                vod_name: item.name || '',
                                vod_pic: pic,
                                vod_remarks: item.remarks || (item.year ? String(item.year) : '')
                            });
                        }
                    }
                }
            }
        }

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

async function detail(id) {
    try {
        const url = `${API_HOST}/v1/pub/vod/detail/${id}/1?_vv=${getVv()}`;
        const raw = await fetchWithCache(url, 1800 * 1000);
        const res = JSON.parse(raw);
        const data = res && res.data ? res.data : null;

        if (!data) return JSON.stringify({ list: [] });

        let pic = data.pic || data.picThumb || '';
        if (pic && !pic.startsWith('http')) {
            pic = IMG_HOST + pic.replace(/^\/+/, '');
        }

        const epList = [];
        if (Array.isArray(data.urls) && data.urls.length > 0) {
            for (let u of data.urls) {
                const epTitle = (u.title || ('第' + (u.index || 1) + '集')).trim();
                const epUrl = u.url || (u.vip_urls && u.vip_urls[0] && u.vip_urls[0].url) || '';
                if (epUrl) {
                    epList.push(`${epTitle}$${epUrl}`);
                }
            }
        }

        // 如果 urls 为空，检查备用 url 字段
        if (epList.length === 0 && data.url) {
            epList.push(`高清播放$${data.url}`);
        }

        const vod = [{
            vod_id: String(data.id),
            vod_name: data.name || '',
            vod_pic: pic,
            type_name: data.typeIdName || '',
            vod_year: data.year ? String(data.year) : '',
            vod_area: data.area || '',
            vod_remarks: data.remarks || '',
            vod_actor: data.actor || '',
            vod_director: data.director || '',
            vod_content: (data.content || data.blurb || '').replace(/<[^>]+>/g, '').trim(),
            vod_play_from: '北美专线',
            vod_play_url: epList.join('#')
        }];

        return JSON.stringify({ list: vod });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function play(flag, id, flags) {
    // id 即为 Master M3U8 直播/点播地址，直接原画免嗅探直链播放 (parse: 0)
    return JSON.stringify({
        parse: 0,
        url: id,
        header: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': 'https://www.olevod.com',
            'Referer': 'https://www.olevod.com/'
        }
    });
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
