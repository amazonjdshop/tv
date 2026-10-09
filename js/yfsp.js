/**
 * 爱壹帆国际版 (yfsp.tv) QuickJS 点播爬虫
 * 兼容 TVBox / CatVod / drpy 运行环境
 */

// ==================== 轻量纯 JS MD5 算法 ====================
function md5(string) {
    if (typeof md5X === 'function') {
        try {
            const h = md5X(string);
            if (h && typeof h === 'string' && h.length === 32) return h.toLowerCase();
        } catch (e) {}
    }
    function rotateLeft(lValue, iShiftBits) {
        return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }
    function addUnsigned(lX, lY) {
        var lX4, lY4, lX8, lY8, lResult;
        lX8 = (lX & 0x80000000);
        lY8 = (lY & 0x80000000);
        lX4 = (lX & 0x40000000);
        lY4 = (lY & 0x40000000);
        lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
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
    function convertToWordArray(string) {
        var lWordCount;
        var lMessageLength = string.length;
        var lNumberOfWordsTempOne = lMessageLength + 8;
        var lNumberOfWordsTempTwo = (lNumberOfWordsTempOne - (lNumberOfWordsTempOne % 64)) / 64;
        var lNumberOfWords = (lNumberOfWordsTempTwo + 1) * 16;
        var lWordArray = Array(lNumberOfWords - 1);
        var lBytePosition = 0;
        var lByteCount = 0;
        while (lByteCount < lMessageLength) {
            lWordCount = (lByteCount - (lByteCount % 4)) / 4;
            lBytePosition = (lByteCount % 4) * 8;
            lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
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
        var WordToHexValue = "", WordToHexValueTemp = "", lByte, lCount;
        for (lCount = 0; lCount <= 3; lCount++) {
            lByte = (lValue >>> (lCount * 8)) & 255;
            WordToHexValueTemp = "0" + lByte.toString(16);
            WordToHexValue = WordToHexValue + WordToHexValueTemp.substr(WordToHexValueTemp.length - 2, 2);
        }
        return WordToHexValue;
    }
    function utf8Encode(string) {
        string = String(string || '').replace(/\r\n/g, "\n");
        var utftext = "";
        for (var n = 0; n < string.length; n++) {
            var c = string.charCodeAt(n);
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
    var x = Array();
    var k, AA, BB, CC, DD, a, b, c, d;
    var S11 = 7, S12 = 12, S13 = 17, S14 = 22;
    var S21 = 5, S22 = 9, S23 = 14, S24 = 20;
    var S31 = 4, S32 = 11, S33 = 16, S34 = 23;
    var S41 = 6, S42 = 10, S43 = 15, S44 = 21;
    string = utf8Encode(string);
    x = convertToWordArray(string);
    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
    for (k = 0; k < x.length; k += 16) {
        AA = a; BB = b; CC = c; DD = d;
        a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
        d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
        c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB);
        b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
        a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
        d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
        c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613);
        b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
        a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8);
        d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
        c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
        b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
        a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122);
        d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
        c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E);
        b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
        a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
        d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
        c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51);
        b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
        a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
        d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
        c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
        b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
        a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
        d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
        c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
        b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
        a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
        d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
        c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9);
        b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
        a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
        d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
        c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
        b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
        a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
        d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
        c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
        b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
        a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
        d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
        c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
        b = HH(b, c, d, a, x[k + 6], S34, 0x4881D05);
        a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
        d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
        c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
        b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
        a = II(a, b, c, d, x[k + 0], S41, 0xF4292244);
        d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
        c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
        b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
        a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3);
        d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
        c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
        b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
        a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
        d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
        c = II(c, d, a, b, x[k + 6], S43, 0xA3014314);
        b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
        a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82);
        d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
        c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
        b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
        a = addUnsigned(a, AA);
        b = addUnsigned(b, BB);
        c = addUnsigned(c, CC);
        d = addUnsigned(d, DD);
    }
    return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

// ==================== 接口配置与防盗链密钥管理 ====================
const API_BASE = 'https://m10.yfsp.tv';
const RANK_BASE = 'https://rankv21.yfsp.tv';
const HOME_URL = 'https://www.yfsp.tv/';

const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.yfsp.tv/',
    'Origin': 'https://www.yfsp.tv'
};

// 预置密钥对（即使首次请求无网也能立即正常工作）
let publicKey = 'CJSvCJKsEJOnDYunCJXVLLDVDZSkCZGrBZ4sCIurCryOC9mOifoRc38SCPeQCp4R7B4oc3CocfiOCp6R61oPiYzDZCnOJXbEJDXOcKuCs5XEJ5ZCp8qOpTcOpGuCpXcDJ7';
let privateKey = 'SvCJJSvCJKsEJOnDYunC';
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
    const qsParts = [];
    for (const k in params) {
        const v = params[k];
        if (v !== undefined && v !== null && v !== '') {
            qsParts.push(`${k}=${v}`);
        }
    }
    let qs = qsParts.join('&');
    if (!/[?&]v=/i.test(qs)) {
        qs += (qs ? '&' : '') + 'v=1';
    }
    const sigStr = `${publicKey}&${qs.toLowerCase()}&${privateKey}`;
    const vv = md5(sigStr);
    const conn = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${conn}${qs}&vv=${vv}&pub=${publicKey}`;
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

async function fetchJsonWithCache(url, ttl = CACHE_TTL_DEFAULT, isValid = null) {
    const cached = getCacheSafe(url);
    if (cached !== null) return cached;

    if (pendingRequests.has(url)) {
        return pendingRequests.get(url);
    }

    const fetchPromise = (async () => {
        try {
            const res = await req(url, {
                method: 'get',
                headers: defaultHeaders,
                timeout: 6000
            });
            if (!res || !res.content) return null;
            let json;
            try {
                json = JSON.parse(res.content);
            } catch (e) {
                return null;
            }
            let canCache = false;
            if (typeof isValid === 'function') {
                canCache = Boolean(isValid(json));
            } else if (json && json.ret === 200 && json.data) {
                canCache = true;
            }
            if (canCache) {
                setCacheSafe(url, json, ttl);
            }
            return json;
        } catch (e) {
            return null;
        } finally {
            pendingRequests.delete(url);
        }
    })();

    pendingRequests.set(url, fetchPromise);
    return fetchPromise;
}

// ==================== QuickJS Spider 标准接口 ====================

async function init(cfg) {
    // 异步后台静默刷新密钥与预热首页数据
    Promise.resolve().then(() => {
        refreshKeys().catch(() => {});
    }).catch(() => {});
}

async function home(filter) {
    // 异步触发一次密钥轮换检查
    refreshKeys().catch(() => {});

    const classes = [
        { type_id: '0,1,3', type_name: '电影' },
        { type_id: '0,1,4', type_name: '连续剧' },
        { type_id: '0,1,5', type_name: '综艺' },
        { type_id: '0,1,6', type_name: '动漫' }
    ];

    const movieClasses = [
        { n: "全部", v: "0,1,3" },
        { n: "喜剧", v: "0,1,3,19" },
        { n: "爱情", v: "0,1,3,20" },
        { n: "动作", v: "0,1,3,21" },
        { n: "犯罪", v: "0,1,3,22" },
        { n: "科幻", v: "0,1,3,23" },
        { n: "奇幻", v: "0,1,3,24" },
        { n: "冒险", v: "0,1,3,25" },
        { n: "灾难", v: "0,1,3,26" },
        { n: "恐怖", v: "0,1,3,123" },
        { n: "惊悚", v: "0,1,3,27" },
        { n: "剧情", v: "0,1,3,28" },
        { n: "战争", v: "0,1,3,29" },
        { n: "歌舞", v: "0,1,3,30" },
        { n: "经典", v: "0,1,3,31" },
        { n: "悬疑", v: "0,1,3,32" },
        { n: "动画", v: "0,1,3,113" },
        { n: "网络电影", v: "0,1,3,125" }
    ];

    const tvClasses = [
        { n: "全部", v: "0,1,4" },
        { n: "偶像", v: "0,1,4,129" },
        { n: "爱情", v: "0,1,4,146" },
        { n: "古装", v: "0,1,4,126" },
        { n: "历史", v: "0,1,4,141" },
        { n: "玄幻", v: "0,1,4,142" },
        { n: "谍战", v: "0,1,4,136" },
        { n: "都市", v: "0,1,4,132" },
        { n: "科幻", v: "0,1,4,144" },
        { n: "军旅", v: "0,1,4,135" },
        { n: "喜剧", v: "0,1,4,133" },
        { n: "武侠", v: "0,1,4,128" },
        { n: "罪案", v: "0,1,4,138" },
        { n: "青春", v: "0,1,4,131" },
        { n: "家庭", v: "0,1,4,130" },
        { n: "战争", v: "0,1,4,134" },
        { n: "悬疑", v: "0,1,4,137" },
        { n: "穿越", v: "0,1,4,139" },
        { n: "警匪", v: "0,1,4,149" },
        { n: "动作", v: "0,1,4,150" },
        { n: "剧情", v: "0,1,4,152" }
    ];

    const showClasses = [
        { n: "全部", v: "0,1,5" },
        { n: "真人秀", v: "0,1,5,39" },
        { n: "选秀", v: "0,1,5,38" },
        { n: "网综", v: "0,1,5,94" },
        { n: "脱口秀", v: "0,1,5,43" },
        { n: "搞笑", v: "0,1,5,40" },
        { n: "竞技", v: "0,1,5,91" },
        { n: "情感", v: "0,1,5,33" },
        { n: "访谈", v: "0,1,5,34" },
        { n: "晚会", v: "0,1,5,92" },
        { n: "其它", v: "0,1,5,45" }
    ];

    const animeClasses = [
        { n: "全部", v: "0,1,6" },
        { n: "热血", v: "0,1,6,46" },
        { n: "格斗", v: "0,1,6,47" },
        { n: "机战", v: "0,1,6,48" },
        { n: "少女", v: "0,1,6,49" },
        { n: "竞技", v: "0,1,6,51" },
        { n: "科幻", v: "0,1,6,52" },
        { n: "魔幻", v: "0,1,6,53" },
        { n: "爆笑", v: "0,1,6,54" },
        { n: "推理", v: "0,1,6,55" },
        { n: "冒险", v: "0,1,6,121" },
        { n: "恋爱", v: "0,1,6,120" },
        { n: "校园", v: "0,1,6,119" },
        { n: "穿越", v: "0,1,6,116" },
        { n: "剧场版", v: "0,1,6,57" }
    ];

    function makeFilter(classList) {
        return [{ key: 'class', name: '类型', value: classList }];
    }

    const filters = {
        '0,1,3': makeFilter(movieClasses),
        '0,1,4': makeFilter(tvClasses),
        '0,1,5': makeFilter(showClasses),
        '0,1,6': makeFilter(animeClasses)
    };

    return JSON.stringify({
        class: classes,
        filters: filters
    });
}

function formatRemarks(item) {
    if (item.lastName) return item.lastName;
    if (item.score) {
        const sc = String(item.score).trim();
        if (sc.includes('分') || sc.includes('暂无')) return sc;
        return `${sc}分`;
    }
    return '';
}

async function homeVod() {
    try {
        const url = signUrl(`${API_BASE}/api/list/index`, {
            cinema: '1',
            cid: '0',
            page: '1',
            size: '24',
            isn: '0',
            isfree: '-1'
        });
        const res = await fetchJsonWithCache(url, CACHE_TTL_DEFAULT);
        const rawList = (res && res.data && Array.isArray(res.data.info)) ? res.data.info : [];
        const videos = rawList.map(item => ({
            vod_id: String(item.key || item.contxt || ''),
            vod_name: item.title || '',
            vod_pic: item.image || item.imgPath || '',
            vod_remarks: formatRemarks(item),
            vod_year: item.year || ''
        })).filter(v => v.vod_id);

        return JSON.stringify({ list: videos });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function category(tid, pg, filter, extend = {}) {
    try {
        const page = parseInt(pg || 1);
        let cid = tid || '0,1,3';
        const tidMap = {
            '1': '0,1,3',
            '2': '0,1,4',
            '3': '0,1,5',
            '4': '0,1,6'
        };
        if (tidMap[cid]) {
            cid = tidMap[cid];
        }
        if (extend && extend.class) {
            cid = extend.class;
        }

        const url = signUrl(`${API_BASE}/api/list/index`, {
            cinema: '1',
            cid: cid,
            page: String(page),
            size: '24',
            isn: '0',
            isfree: '-1'
        });

        const res = await fetchJsonWithCache(url, CACHE_TTL_DEFAULT);
        const rawList = (res && res.data && Array.isArray(res.data.info)) ? res.data.info : [];
        const list = rawList.map(item => ({
            vod_id: String(item.key || item.contxt || ''),
            vod_name: item.title || '',
            vod_pic: item.image || item.imgPath || '',
            vod_remarks: formatRemarks(item),
            vod_year: item.year || ''
        })).filter(v => v.vod_id);

        // 静默后台预拉取下一页
        if (list.length >= 24 && page < 20) {
            Promise.resolve().then(() => {
                const nextUrl = signUrl(`${API_BASE}/api/list/index`, {
                    cinema: '1',
                    cid: cid,
                    page: String(page + 1),
                    size: '24',
                    isn: '0',
                    isfree: '-1'
                });
                fetchJsonWithCache(nextUrl, CACHE_TTL_DEFAULT).catch(() => {});
            }).catch(() => {});
        }

        return JSON.stringify({
            page: page,
            pagecount: list.length < 24 ? page : page + 1,
            limit: 24,
            total: list.length < 24 ? (page - 1) * 24 + list.length : 9999,
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

        // 1. 获取视频主体详情
        const detailUrl = signUrl(`${API_BASE}/v3/video/detail`, {
            id: vodKey,
            cinema: '1',
            device: 'desktop',
            player: 'CkPlayer',
            tech: 'HLS',
            country: 'HU',
            lang: 'cns',
            v: '1',
            region: 'GL.'
        });

        const res = await fetchJsonWithCache(detailUrl, CACHE_TTL_DEFAULT);
        const info = (res && res.data && Array.isArray(res.data.info) && res.data.info[0]) ? res.data.info[0] : {};

        // 2. 获取分集列表
        const epList = [];
        const cid = info.cid || '';
        const playlistUrl = signUrl(`${API_BASE}/v3/video/languagesplaylist`, {
            cinema: '1',
            vid: vodKey,
            lsk: '1',
            taxis: '0',
            cid: cid
        });

        const plRes = await fetchJsonWithCache(playlistUrl, CACHE_TTL_DEFAULT);
        const playlistInfo = (plRes && plRes.data && Array.isArray(plRes.data.info) && plRes.data.info[0]) ? plRes.data.info[0] : null;
        const playList = (playlistInfo && Array.isArray(playlistInfo.playList)) ? playlistInfo.playList : [];

        if (playList.length > 0) {
            if (playList.length === 1 && (playList[0].name.includes('P') || !info.isSerial)) {
                epList.push(`正片$${playList[0].key || vodKey}@@0`);
            } else {
                for (let i = 0; i < playList.length; i++) {
                    const ep = playList[i];
                    let epName = ep.name || String(i + 1);
                    if (!epName.includes('集') && !epName.includes('期') && !epName.includes('话') && !epName.includes('片') && !epName.startsWith('20')) {
                        epName = `第${epName}集`;
                    }
                    const epKey = ep.key || '';
                    if (epKey) {
                        epList.push(`${epName}$${epKey}@@0`);
                    }
                }
            }
        }

        // 若分集列表为空（如单部电影），默认采用正片播放
        if (epList.length === 0) {
            epList.push(`正片$${vodKey}@@1`);
        }

        const typeName = [info.channel, info.videoType].filter(Boolean).join(' / ');
        const actors = Array.isArray(info.stars) ? info.stars.join(' / ') : (info.stars || '');
        const directors = Array.isArray(info.directors) ? info.directors.join(' / ') : (info.directors || '');

        const vod = [{
            vod_id: vodKey,
            vod_name: info.title || '',
            vod_pic: info.imgPath || '',
            vod_type_name: typeName,
            vod_year: String(info.post_Year || '').substring(0, 4),
            vod_area: info.regional || '',
            vod_remarks: formatRemarks(info),
            vod_actor: actors,
            vod_director: directors,
            vod_content: (info.contxt || '').trim(),
            vod_play_from: '爱壹帆超清专线',
            vod_play_url: epList.join('#')
        }];

        return JSON.stringify({ list: vod });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function search(wd, quick, pg = 1) {
    // 根据要求关闭搜索功能，搜索时不展示任何影片
    return JSON.stringify({
        page: pg || 1,
        pagecount: 0,
        limit: 20,
        total: 0,
        list: []
    });
}

async function play(flag, id, flags) {
    try {
        const parts = String(id || '').split('@@');
        const mediaKey = parts[0];
        let aType = parts.length > 1 ? parts[1] : '0';

        async function fetchPlayUrl(mKey, aVal) {
            const playUrl = signUrl(`${API_BASE}/v3/video/play`, {
                cinema: '1',
                id: mKey,
                a: aVal,
                usersign: '1',
                region: 'GL.',
                device: '1',
                isMasterSupport: '0'
            });
            const res = await req(playUrl, {
                headers: defaultHeaders,
                timeout: 6000
            });
            if (!res || !res.content) return null;
            try {
                const d = JSON.parse(res.content);
                if (d && d.data && d.data.code === 0 && Array.isArray(d.data.info) && d.data.info[0]) {
                    return d.data.info[0];
                }
            } catch (e) {}
            return null;
        }

        // 首次尝试指定 aType
        let playInfo = await fetchPlayUrl(mediaKey, aType);
        // 若失败，尝试对偶类型（0 互换 1）以确保绝对命中播放
        if (!playInfo) {
            const altA = aType === '1' ? '0' : '1';
            playInfo = await fetchPlayUrl(mediaKey, altA);
        }

        let m3u8Url = '';
        if (playInfo) {
            // 1. 优先提取 flvPathList 中的 HLS 流
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

            // 2. 备用清晰度 clarity 流
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
                    'Origin': 'https://www.yfsp.tv',
                    'Referer': 'https://www.yfsp.tv/'
                }
            });
        }
    } catch (e) {}

    return JSON.stringify({
        parse: 1,
        url: id
    });
}

// 导出模块规范支持
const spider = {
    init: init,
    home: home,
    homeVod: homeVod,
    category: category,
    detail: detail,
    play: play,
    search: search
};

if (typeof exports !== 'undefined') {
    exports.default = spider;
    exports.init = init;
    exports.home = home;
    exports.homeVod = homeVod;
    exports.category = category;
    exports.detail = detail;
    exports.play = play;
    exports.search = search;
}

export default spider;
