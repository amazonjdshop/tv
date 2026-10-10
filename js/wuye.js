/**
 * 午夜TV (wuye.tv) QuickJS 点播爬虫
 * 适用于 FongMi (潘多拉影视) / CatVod / TVBox QuickJS 引擎
 */

// ==================== MD5 纯 JS 极速实现 ====================
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
        lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
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
    function utf8Encode(string) {
        string = string.replace(/\r\n/g, '\n');
        let utftext = '';
        for (let n = 0; n < string.length; n++) {
            const c = string.charCodeAt(n);
            if (c < 128) {
                utftext += String.fromCharCode(c);
            } else if ((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            } else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }
        }
        return utftext;
    }

    let x = [];
    let k, AA, BB, CC, DD, a, b, c, d;
    const S11=7, S12=12, S13=17, S14=22;
    const S21=5, S22=9, S23=14, S24=20;
    const S31=4, S32=11, S33=16, S34=23;
    const S41=6, S42=10, S43=15, S44=21;

    string = utf8Encode(string);
    x = convertToWordArray(string);
    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;

    for (k = 0; k < x.length; k += 16) {
        AA = a; BB = b; CC = c; DD = d;
        a = FF(a, b, c, d, x[k+0], S11, 0xD76AA478);
        d = FF(d, a, b, c, x[k+1], S12, 0xE8C7B756);
        c = FF(c, d, a, b, x[k+2], S13, 0x242070DB);
        b = FF(b, c, d, a, x[k+3], S14, 0xC1BDCEEE);
        a = FF(a, b, c, d, x[k+4], S11, 0xF57C0FAF);
        d = FF(d, a, b, c, x[k+5], S12, 0x4787C62A);
        c = FF(c, d, a, b, x[k+6], S13, 0xA8304613);
        b = FF(b, c, d, a, x[k+7], S14, 0xFD469501);
        a = FF(a, b, c, d, x[k+8], S11, 0x698098D8);
        d = FF(d, a, b, c, x[k+9], S12, 0x8B44F7AF);
        c = FF(c, d, a, b, x[k+10], S13, 0xFFFF5BB1);
        b = FF(b, c, d, a, x[k+11], S14, 0x895CD7BE);
        a = FF(a, b, c, d, x[k+12], S11, 0x6B901122);
        d = FF(d, a, b, c, x[k+13], S12, 0xFD987193);
        c = FF(c, d, a, b, x[k+14], S13, 0xA679438E);
        b = FF(b, c, d, a, x[k+15], S14, 0x49B40821);

        a = GG(a, b, c, d, x[k+1], S21, 0xF61E2562);
        d = GG(d, a, b, c, x[k+6], S22, 0xC040B340);
        c = GG(c, d, a, b, x[k+11], S23, 0x265E5A51);
        b = GG(b, c, d, a, x[k+0], S24, 0xE9B6C7AA);
        a = GG(a, b, c, d, x[k+5], S21, 0xD62F105D);
        d = GG(d, a, b, c, x[k+10], S22, 0x2441453);
        c = GG(c, d, a, b, x[k+15], S23, 0xD8A1E681);
        b = GG(b, c, d, a, x[k+4], S24, 0xE7D3FBC8);
        a = GG(a, b, c, d, x[k+9], S21, 0x21E1CDE6);
        d = GG(d, a, b, c, x[k+14], S22, 0xC33707D6);
        c = GG(c, d, a, b, x[k+3], S23, 0xF4D50D87);
        b = GG(b, c, d, a, x[k+8], S24, 0x455A14ED);
        a = GG(a, b, c, d, x[k+13], S21, 0xA9E3E905);
        d = GG(d, a, b, c, x[k+2], S22, 0xFCEFA3F8);
        c = GG(c, d, a, b, x[k+7], S23, 0x676F02D9);
        b = GG(b, c, d, a, x[k+12], S24, 0x8D2A4C8A);

        a = HH(a, b, c, d, x[k+5], S31, 0xFFFA3942);
        d = HH(d, a, b, c, x[k+8], S32, 0x8771F681);
        c = HH(c, d, a, b, x[k+11], S33, 0x6D9D6122);
        b = HH(b, c, d, a, x[k+14], S34, 0xFDE5380C);
        a = HH(a, b, c, d, x[k+1], S31, 0xA4BEEA44);
        d = HH(d, a, b, c, x[k+4], S32, 0x4BDECFA9);
        c = HH(c, d, a, b, x[k+7], S33, 0xF6BB4B60);
        b = HH(b, c, d, a, x[k+10], S34, 0xBEBFBC70);
        a = HH(a, b, c, d, x[k+13], S31, 0x289B7EC6);
        d = HH(d, a, b, c, x[k+0], S32, 0xEAA127FA);
        c = HH(c, d, a, b, x[k+3], S33, 0xD4EF3085);
        b = HH(b, c, d, a, x[k+6], S34, 0x4881D05);
        a = HH(a, b, c, d, x[k+9], S31, 0xD9D4D039);
        d = HH(d, a, b, c, x[k+12], S32, 0xE6DB99E5);
        c = HH(c, d, a, b, x[k+15], S33, 0x1FA27CF8);
        b = HH(b, c, d, a, x[k+2], S34, 0xC4AC5665);

        a = II(a, b, c, d, x[k+0], S41, 0xF4292244);
        d = II(d, a, b, c, x[k+7], S42, 0x432AFF97);
        c = II(c, d, a, b, x[k+14], S43, 0xAB9423A7);
        b = II(b, c, d, a, x[k+5], S44, 0xFC93A039);
        a = II(a, b, c, d, x[k+12], S41, 0x655B59C3);
        d = II(d, a, b, c, x[k+3], S42, 0x8F0CCC92);
        c = II(c, d, a, b, x[k+10], S43, 0xFFEFF47D);
        b = II(b, c, d, a, x[k+1], S44, 0x85845DD1);
        a = II(a, b, c, d, x[k+8], S41, 0x6FA87E4F);
        d = II(d, a, b, c, x[k+15], S42, 0xFE2CE6E0);
        c = II(c, d, a, b, x[k+6], S43, 0xA3014314);
        b = II(b, c, d, a, x[k+13], S44, 0x4E0811A1);
        a = II(a, b, c, d, x[k+4], S41, 0xF7537E82);
        d = II(d, a, b, c, x[k+11], S42, 0xBD3AF235);
        c = II(c, d, a, b, x[k+2], S43, 0x2AD7D2BB);
        b = II(b, c, d, a, x[k+9], S44, 0xEB86D391);

        a = addUnsigned(a, AA);
        b = addUnsigned(b, BB);
        c = addUnsigned(c, CC);
        d = addUnsigned(d, DD);
    }
    return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

// ==================== 接口与密钥基础配置 ====================
const HOME_URL = 'https://www.wuye.tv';
const API_BASE = 'https://api8.wuye.tv';
const RANK_BASE = 'https://rankv21.wuye.tv';

const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.wuye.tv/',
    'Origin': 'https://www.wuye.tv'
};

// 预置默认密钥对
let publicKey = 'CJSvCJKvDJSsE2uoD35VLLDVDZSkCZGrBZ4sCIurCryRcRASiPWR79mSiJAQCPaPiB4o69WncB2Sd3CQCnanCQzPZHZDcDZDMCmPM8qOM8mPJTYCsOnCs5aCpTaCpGpOc6';
let privateKey = 'SvCJJSvCJKvDJSsE2uoD';
let keyLastUpdate = 0;
const KEY_REFRESH_INTERVAL = 3600 * 1000 * 2; // 每 2 小时后台自动轮换一次密钥

async function refreshKeys() {
    const now = Date.now();
    if (now - keyLastUpdate < KEY_REFRESH_INTERVAL) return;
    try {
        const res = await req(HOME_URL, {
            headers: defaultHeaders,
            timeout: 5000
        });
        if (res && res.content) {
            const m = res.content.match(/var\s+injectJson\s*=\s*(\{[\s\S]*?\});\s*(?:var|<\/script>)/);
            if (m) {
                const data = JSON.parse(m[1]);
                if (data && data.config && data.config[0] && data.config[0].pConfig) {
                    const cfg = data.config[0].pConfig;
                    if (cfg.publicKey && cfg.privateKey && cfg.privateKey[0]) {
                        publicKey = cfg.publicKey;
                        privateKey = cfg.privateKey[0];
                        keyLastUpdate = now;
                    }
                }
            }
        }
    } catch (e) {}
}

function signUrl(baseUrl, params = {}) {
    const rawParts = [];
    const encParts = [];
    const keys = Object.keys(params).sort();
    for (const k of keys) {
        const v = params[k];
        if (v !== undefined && v !== null && v !== '') {
            rawParts.push(`${k}=${v}`);
            encParts.push(`${k}=${encodeURIComponent(v)}`);
        }
    }
    let rawQs = rawParts.join('&');
    let encQs = encParts.join('&');
    if (!/[?&]v=/i.test(rawQs)) {
        rawQs += (rawQs ? '&' : '') + 'v=1';
        encQs += (encQs ? '&' : '') + 'v=1';
    }
    const sigStr = `${publicKey}&${rawQs.toLowerCase()}&${privateKey}`;
    const vv = md5(sigStr);
    const conn = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${conn}${encQs}&vv=${vv}&pub=${publicKey}`;
}

// ==================== 高性能 LRU 内存缓存层 ====================
const CACHE_TTL_DEFAULT = 1800 * 1000; // 30 分钟
const CACHE_MAX_ENTRIES = 300;
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

async function fetchJsonWithCache(url, ttl = CACHE_TTL_DEFAULT) {
    const cached = getCacheSafe(url);
    if (cached !== null) return cached;
    if (pendingRequests.has(url)) return pendingRequests.get(url);

    const fetchPromise = (async () => {
        try {
            const res = await req(url, {
                headers: defaultHeaders,
                timeout: 8000
            });
            if (!res || !res.content) return null;
            const data = JSON.parse(res.content);
            if (data && data.ret === 200) {
                setCacheSafe(url, data, ttl);
                return data;
            }
            return data;
        } catch (e) {
            return null;
        } finally {
            pendingRequests.delete(url);
        }
    })();

    pendingRequests.set(url, fetchPromise);
    return fetchPromise;
}

// ==================== 筛选项静态配置 ====================
const adultTags = [
    { n: "全部", v: "" },
    { n: "美女", v: "美女" },
    { n: "软妹", v: "软妹" },
    { n: "御姐", v: "御姐" },
    { n: "甜美", v: "甜美" },
    { n: "清纯", v: "清纯" },
    { n: "熟女", v: "熟女" },
    { n: "素人", v: "素人" },
    { n: "学生", v: "学生" },
    { n: "人妻", v: "人妻" },
    { n: "空姐", v: "空姐" },
    { n: "家教", v: "家教" },
    { n: "教师", v: "教师" },
    { n: "护士", v: "护士" },
    { n: "女仆", v: "女仆" },
    { n: "白领", v: "白领" },
    { n: "车模", v: "车模" },
    { n: "小姐", v: "小姐" },
    { n: "泳装", v: "泳装" },
    { n: "运动", v: "运动" },
    { n: "丝袜", v: "丝袜" },
    { n: "角色", v: "角色" },
    { n: "美腿", v: "美腿" },
    { n: "名模", v: "名模" },
    { n: "无毛", v: "无毛" },
    { n: "嫩穴", v: "嫩穴" },
    { n: "巨根", v: "巨根" },
    { n: "美臀", v: "美臀" },
    { n: "人妖", v: "人妖" },
    { n: "中出", v: "中出" },
    { n: "双飞", v: "双飞" },
    { n: "群交", v: "群交" },
    { n: "背伦", v: "背伦" },
    { n: "强插", v: "强插" },
    { n: "轮插", v: "轮插" },
    { n: "迷奸", v: "迷奸" },
    { n: "车震", v: "车震" },
    { n: "援交", v: "援交" },
    { n: "破处", v: "破处" },
    { n: "女同", v: "女同" },
    { n: "痴汉", v: "痴汉" },
    { n: "道具", v: "道具" },
    { n: "另类", v: "另类" },
    { n: "奇特", v: "奇特" },
    { n: "重口", v: "重口" },
    { n: "调教", v: "调教" },
    { n: "性虐", v: "性虐" },
    { n: "足交", v: "足交" },
    { n: "肛交", v: "肛交" },
    { n: "自拍", v: "自拍" },
    { n: "偷拍", v: "偷拍" },
    { n: "裸聊", v: "裸聊" },
    { n: "剧情", v: "剧情" },
    { n: "中字", v: "中字" },
    { n: "影视", v: "影视" },
    { n: "写真", v: "写真" },
    { n: "巨乳", v: "巨乳" }
];

function makeFilter() {
    return [
        { key: 'tag', name: '标签', value: adultTags }
    ];
}

// ==================== Spider 核心接口 ====================
async function init(cfg) {
    refreshKeys().catch(() => {});
}

async function home(filter) {
    refreshKeys().catch(() => {});

    const classes = [
        { type_id: '0,2,10,85', type_name: '日本' },
        { type_id: '0,2,10,87', type_name: '国产' },
        { type_id: '0,2,10,86', type_name: '欧美' },
        { type_id: '0,2,10,88', type_name: '卡通' }
    ];

    const filters = {
        '0,2,10,85': makeFilter(),
        '0,2,10,87': makeFilter(),
        '0,2,10,86': makeFilter(),
        '0,2,10,88': makeFilter()
    };

    return JSON.stringify({
        class: classes,
        filters: filters
    });
}

async function homeVod() {
    return category('0,2,10,85', 1, false, {});
}

async function category(tid, pg, filter, extend = {}) {
    try {
        const page = parseInt(pg || 1);
        const tag = (extend && (extend.tag || extend.class)) || '';

        const params = {
            cinema: '2',
            cid: tid || '0,2,10,85',
            page: String(page),
            size: '24'
        };
        if (tag) {
            params.tags = tag;
        }

        const url = signUrl(`${API_BASE}/api/list/index`, params);
        const res = await fetchJsonWithCache(url, CACHE_TTL_DEFAULT);
        const rawList = (res && res.data && Array.isArray(res.data.info)) ? res.data.info : [];

        const list = rawList.map(item => {
            let pic = item.image || '';
            if (pic.startsWith('//')) pic = 'https:' + pic;
            let remarks = item.sNo || '';
            if (item.starring) {
                remarks = remarks ? `${remarks} ${item.starring}` : item.starring;
            } else if (item.lastName) {
                remarks = remarks ? `${remarks} ${item.lastName}` : item.lastName;
            }
            return {
                vod_id: item.key || String(item.id),
                vod_name: item.title || '',
                vod_pic: pic,
                vod_remarks: remarks || (item.rating ? item.rating + '分' : ''),
                vod_year: item.year ? String(item.year) : ''
            };
        }).filter(v => v.vod_id && v.vod_name);

        const pageCount = list.length < 24 ? page : page + 1;

        return JSON.stringify({
            page: page,
            pagecount: pageCount,
            limit: 24,
            total: list.length < 24 ? (page - 1) * 24 + list.length : page * 24 + 24,
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

async function detail(id) {
    try {
        const vodKey = String(id).trim();

        // 1. 获取视频基本信息
        const detailUrl = signUrl(`${API_BASE}/v3/video/detail`, {
            id: vodKey,
            cinema: '2'
        });
        const res = await fetchJsonWithCache(detailUrl, CACHE_TTL_DEFAULT);
        const info = (res && res.data && Array.isArray(res.data.info) && res.data.info[0]) ? res.data.info[0] : {};

        // 2. 获取分集播放键 mediaKey
        const playlistUrl = signUrl(`${API_BASE}/v3/video/languagesplaylist`, {
            cinema: '2',
            vid: vodKey,
            cid: info.cid || '0,2,10,85',
            lsk: '1',
            taxis: '0'
        });
        const plRes = await fetchJsonWithCache(playlistUrl, CACHE_TTL_DEFAULT);
        const playlistInfo = (plRes && plRes.data && Array.isArray(plRes.data.info) && plRes.data.info[0]) ? plRes.data.info[0] : null;
        const playList = (playlistInfo && Array.isArray(playlistInfo.playList)) ? playlistInfo.playList : [];

        const epList = [];
        if (playList.length > 0) {
            for (let i = 0; i < playList.length; i++) {
                const ep = playList[i];
                let epName = ep.name || String(i + 1);
                if (epName === '01' || epName === '1') {
                    epName = info.sNo || '正片';
                }
                const epKey = ep.key || '';
                if (epKey) {
                    epList.push(`${epName}$${epKey}`);
                }
            }
        }

        if (epList.length === 0) {
            epList.push(`${info.sNo || '正片'}$${vodKey}`);
        }

        let pic = info.imgPath || '';
        if (pic.startsWith('//')) pic = 'https:' + pic;

        const typeName = [info.channel, info.videoType].filter(Boolean).join(' / ');
        const actors = Array.isArray(info.stars) ? info.stars.join(' / ') : (info.stars || '');
        const directors = Array.isArray(info.directors) ? info.directors.join(' / ') : (info.directors || '');

        const vod = [{
            vod_id: vodKey,
            vod_name: info.title || '',
            vod_pic: pic,
            vod_type_name: typeName || '成人视频',
            vod_year: info.post_Year || '',
            vod_area: info.videoType || '',
            vod_remarks: info.sNo || (info.add_date || ''),
            vod_actor: actors || '素人/演员',
            vod_director: directors || '',
            vod_content: (info.contxt || info.title || '').trim(),
            vod_play_from: '超清专线',
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
        const query = String(wd || '').trim();
        if (!query) {
            return JSON.stringify({
                page: 1,
                pagecount: 0,
                limit: 20,
                total: 0,
                list: []
            });
        }

        // 调用 Solr briefsearch 搜索
        const solrUrl = signUrl(`${RANK_BASE}/v3/list/briefsearch`, {
            cinema: '2',
            tags: query,
            page: String(page),
            size: '20'
        });
        const res = await fetchJsonWithCache(solrUrl, CACHE_TTL_DEFAULT);
        const info = (res && res.data && Array.isArray(res.data.info) && res.data.info[0]) ? res.data.info[0] : null;
        const rawList = (info && Array.isArray(info.result)) ? info.result : [];

        const list = rawList.map(item => {
            let pic = item.imgPath || '';
            if (pic.startsWith('//')) pic = 'https:' + pic;
            let remarks = item.sNo || '';
            if (item.starring) {
                remarks = remarks ? `${remarks} ${item.starring}` : item.starring;
            } else if (item.lastName) {
                remarks = remarks ? `${remarks} ${item.lastName}` : item.lastName;
            }
            return {
                vod_id: item.contxt || item.key || String(item.id),
                vod_name: item.title || '',
                vod_pic: pic,
                vod_remarks: remarks || '',
                vod_year: item.postTime ? String(item.postTime).substring(0, 4) : ''
            };
        }).filter(v => v.vod_id && v.vod_name);

        const recordCount = (info && info.recordcount !== undefined) ? parseInt(info.recordcount) : list.length;
        const pageCount = Math.ceil(recordCount / 20) || (list.length < 20 ? page : page + 1);

        return JSON.stringify({
            page: page,
            pagecount: pageCount,
            limit: 20,
            total: recordCount,
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
        const mediaKey = String(id || '').trim();

        const playUrl = signUrl(`${API_BASE}/v3/video/play`, {
            cinema: '2',
            id: mediaKey,
            a: '0',
            usersign: '1',
            region: 'GL.',
            device: '1',
            isMasterSupport: '0'
        });

        const res = await req(playUrl, {
            headers: defaultHeaders,
            timeout: 8000
        });

        let playInfo = null;
        if (res && res.content) {
            try {
                const d = JSON.parse(res.content);
                if (d && d.data && d.data.code === 0 && Array.isArray(d.data.info) && d.data.info[0]) {
                    playInfo = d.data.info[0];
                }
            } catch (e) {}
        }

        let m3u8Url = '';
        if (playInfo) {
            // 1. 优先提取 flvPathList 中的 HLS 播放流
            if (Array.isArray(playInfo.flvPathList)) {
                for (const flv of playInfo.flvPathList) {
                    if (flv && flv.isHls && (flv.result || flv.rtmp)) {
                        m3u8Url = flv.result || flv.rtmp;
                        break;
                    }
                }
                if (!m3u8Url) {
                    for (const flv of playInfo.flvPathList) {
                        const target = flv.result || flv.rtmp || '';
                        if (target.includes('.m3u8')) {
                            m3u8Url = target;
                            break;
                        }
                    }
                }
            }

            // 2. 备用 clarity 清晰度列表
            if (!m3u8Url && Array.isArray(playInfo.clarity)) {
                for (const c of playInfo.clarity) {
                    if (c && c.path && (c.path.result || c.path.rtmp)) {
                        m3u8Url = c.path.result || c.path.rtmp;
                        break;
                    }
                }
            }
        }

        if (m3u8Url) {
            return JSON.stringify({
                parse: 0,
                url: m3u8Url,
                header: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Origin': 'https://www.wuye.tv',
                    'Referer': 'https://www.wuye.tv/'
                }
            });
        }
    } catch (e) {}

    return JSON.stringify({
        parse: 1,
        url: id
    });
}

const spider = {
    init: init,
    home: home,
    homeVod: homeVod,
    category: category,
    detail: detail,
    play: play,
    search: search
};

export default spider;

if (typeof globalThis !== 'undefined') {
    globalThis.__jsEvalReturn = spider;
}
