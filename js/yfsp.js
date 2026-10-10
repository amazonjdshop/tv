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

// ==================== 筛选项静态配置 ====================
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

const docClasses = [
    { n: "全部", v: "0,1,7" },
    { n: "文化", v: "0,1,7,50" },
    { n: "探索", v: "0,1,7,59" },
    { n: "军事", v: "0,1,7,60" },
    { n: "解密", v: "0,1,7,61" },
    { n: "科技", v: "0,1,7,62" },
    { n: "历史", v: "0,1,7,63" },
    { n: "人物", v: "0,1,7,64" },
    { n: "自然", v: "0,1,7,66" },
    { n: "其它", v: "0,1,7,67" }
];

const sportClasses = [
    { n: "全部", v: "0,1,95" },
    { n: "奥运", v: "0,1,95,99" },
    { n: "综合", v: "0,1,95,98" },
    { n: "篮球", v: "0,1,95,97" },
    { n: "足球", v: "0,1,95,96" }
];

const newsClasses = [
    { n: "全部", v: "all" },
    { n: "国际新闻", v: "国际新闻" },
    { n: "中国新闻", v: "中国新闻" },
    { n: "华人资讯", v: "华人资讯" },
    { n: "财经", v: "财经" },
    { n: "军事", v: "军事" }
];

const chineseClasses = [
    { n: "全部", v: "all" },
    { n: "留学", v: "留学" },
    { n: "生活", v: "生活" },
    { n: "活动", v: "活动" },
    { n: "演出", v: "演出" },
    { n: "推广", v: "推广" }
];

const yuleClasses = [
    { n: "全部", v: "all" },
    { n: "娱乐资讯", v: "娱乐资讯" },
    { n: "影视周边", v: "影视周边" },
    { n: "明星", v: "明星" },
    { n: "达人", v: "达人" },
    { n: "动画", v: "动画" }
];

const lifeClasses = [
    { n: "全部", v: "all" },
    { n: "搞笑", v: "搞笑" },
    { n: "日常", v: "日常" },
    { n: "美食", v: "美食" },
    { n: "动物", v: "动物" },
    { n: "奇葩", v: "奇葩" },
    { n: "旅游", v: "旅游" },
    { n: "知识", v: "知识" },
    { n: "星座", v: "星座" },
    { n: "婚恋", v: "婚恋" },
    { n: "赶海", v: "赶海" }
];

const gamesClasses = [
    { n: "全部", v: "all" },
    { n: "电竞", v: "电竞" },
    { n: "网游", v: "网游" },
    { n: "单机", v: "单机" },
    { n: "主机", v: "主机" },
    { n: "手游", v: "手游" }
];

const commonAreas = [
    { n: "全部", v: "" },
    { n: "大陆", v: "大陆" },
    { n: "香港", v: "香港" },
    { n: "台湾", v: "台湾" },
    { n: "欧美", v: "欧美" },
    { n: "韩国", v: "韩国" },
    { n: "日本", v: "日本" },
    { n: "英国", v: "英国" },
    { n: "泰国", v: "泰国" },
    { n: "其它", v: "其它" }
];

const commonLangs = [
    { n: "全部", v: "" },
    { n: "国语", v: "国语" },
    { n: "粤语", v: "粤语" },
    { n: "英语", v: "英语" },
    { n: "韩语", v: "韩语" },
    { n: "日语", v: "日语" },
    { n: "泰语", v: "泰国语" },
    { n: "法语", v: "法语" },
    { n: "德语", v: "德语" },
    { n: "西语", v: "西班牙语" },
    { n: "其它", v: "其它" }
];

const commonYears = [
    { n: "全部", v: "" },
    { n: "2026", v: "2026" },
    { n: "2025", v: "2025" },
    { n: "2024", v: "2024" },
    { n: "2023", v: "2023" },
    { n: "2022", v: "2022" },
    { n: "2021", v: "2021" },
    { n: "2020", v: "2020" },
    { n: "2019", v: "2019" },
    { n: "2018", v: "2018" },
    { n: "2017", v: "2017" },
    { n: "2016", v: "2016" },
    { n: "2015", v: "2015" },
    { n: "2014", v: "2014" },
    { n: "2013", v: "2013" },
    { n: "2012", v: "2012" },
    { n: "2011", v: "2011" },
    { n: "2010", v: "2010" },
    { n: "2009", v: "2009" },
    { n: "2008", v: "2008" },
    { n: "90年代", v: "90年代" },
    { n: "80年代", v: "80年代" },
    { n: "更早", v: "更早" }
];

const commonSorts = [
    { n: "热门精选", v: "4" },
    { n: "最新添加", v: "0" },
    { n: "最多播放", v: "1" },
    { n: "评分最高", v: "2" }
];

const commonStatus = [
    { n: "全部", v: "" },
    { n: "连载中", v: "1" },
    { n: "全集完结", v: "0" }
];

function makeFilter(classList, hasStatus = false) {
    const res = [];
    if (classList && classList.length > 0) {
        res.push({ key: 'class', name: '类型', value: classList });
    }
    res.push({ key: 'area', name: '地区', value: commonAreas });
    res.push({ key: 'lang', name: '语言', value: commonLangs });
    res.push({ key: 'year', name: '年份', value: commonYears });
    res.push({ key: 'sort', name: '排序', value: commonSorts });
    if (hasStatus) {
        res.push({ key: 'status', name: '状态', value: commonStatus });
    }
    return res;
}

function formatRemarks(item) {
    if (item.lastName) return item.lastName;
    if (item.score || item.rating) {
        const sc = String(item.score || item.rating).trim();
        if (sc !== '0' && sc !== '') {
            if (sc.includes('分') || sc.includes('暂无')) return sc;
            return `${sc}分`;
        }
    }
    if (item.year) return String(item.year);
    return '';
}

async function home(filter) {
    refreshKeys().catch(() => {});

    const classes = [
        { type_id: '0,1,3', type_name: '电影' },
        { type_id: '0,1,4', type_name: '连续剧' },
        { type_id: '0,1,5', type_name: '综艺' },
        { type_id: '0,1,6', type_name: '动漫' },
        { type_id: '0,1,7', type_name: '纪录片' },
        { type_id: '0,1,95', type_name: '体育' },
        { type_id: 'news', type_name: '新闻' },
        { type_id: 'chinese', type_name: '华人' },
        { type_id: 'yule', type_name: '娱乐' },
        { type_id: 'life', type_name: '生活' },
        { type_id: 'games', type_name: '游戏' }
    ];

    const filters = {
        '0,1,3': makeFilter(movieClasses, false),
        '0,1,4': makeFilter(tvClasses, true),
        '0,1,5': makeFilter(showClasses, true),
        '0,1,6': makeFilter(animeClasses, true),
        '0,1,7': makeFilter(docClasses, false),
        '0,1,95': [
            { key: 'class', name: '分类', value: sportClasses },
            { key: 'sort', name: '排序', value: commonSorts }
        ],
        'news': [{ key: 'class', name: '分类', value: newsClasses }],
        'chinese': [{ key: 'class', name: '分类', value: chineseClasses }],
        'yule': [{ key: 'class', name: '分类', value: yuleClasses }],
        'life': [{ key: 'class', name: '分类', value: lifeClasses }],
        'games': [{ key: 'class', name: '分类', value: gamesClasses }],
        '1': makeFilter(movieClasses, false),
        '2': makeFilter(tvClasses, true),
        '3': makeFilter(showClasses, true),
        '4': makeFilter(animeClasses, true)
    };

    return JSON.stringify({
        class: classes,
        filters: filters
    });
}

async function homeVod() {
    try {
        const url = signUrl(`${API_BASE}/api/list/Search`, {
            cinema: '1',
            cid: '0,1,3',
            page: '1',
            size: '24',
            orderby: '4',
            desc: '1'
        });
        const res = await fetchJsonWithCache(url, CACHE_TTL_DEFAULT);
        const info = (res && res.data && Array.isArray(res.data.info) && res.data.info[0]) ? res.data.info[0] : null;
        const rawList = (info && Array.isArray(info.result)) ? info.result : [];
        const videos = rawList.map(item => ({
            vod_id: String(item.key || item.contxt || ''),
            vod_name: item.title || '',
            vod_pic: item.image || item.imgPath || '',
            vod_remarks: formatRemarks(item),
            vod_year: item.year ? String(item.year) : ''
        })).filter(v => v.vod_id);

        return JSON.stringify({ list: videos });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function category(tid, pg, filter, extend = {}) {
    try {
        const page = parseInt(pg || 1);

        // 1. 资讯与短视频类板块 (新闻, 华人, 娱乐, 生活, 游戏)
        const shortVideoTypes = ['news', 'chinese', 'yule', 'life', 'games'];
        if (shortVideoTypes.includes(tid)) {
            const url = `https://upload.yfsp.tv/api/home/GetSubList?cid=${tid}`;
            const res = await fetchJsonWithCache(url, CACHE_TTL_DEFAULT, (j) => j && j.ret === 200);
            const info = (res && res.data && Array.isArray(res.data.info) && res.data.info[0]) ? res.data.info[0] : {};
            const subClass = (extend && extend.class) || 'all';
            let rawList = [];

            if (subClass && subClass !== 'all' && info.subList && Array.isArray(info.subList[subClass])) {
                rawList = info.subList[subClass];
            } else {
                const seen = new Set();
                if (Array.isArray(info.hotList)) {
                    for (const item of info.hotList) {
                        if (item && item.key && !seen.has(item.key)) {
                            seen.add(item.key);
                            rawList.push(item);
                        }
                    }
                }
                if (info.subList && typeof info.subList === 'object') {
                    for (const group of Object.values(info.subList)) {
                        if (Array.isArray(group)) {
                            for (const item of group) {
                                if (item && item.key && !seen.has(item.key)) {
                                    seen.add(item.key);
                                    rawList.push(item);
                                }
                            }
                        }
                    }
                }
            }

            const list = rawList.map(item => ({
                vod_id: String(item.key || ''),
                vod_name: item.title || '',
                vod_pic: item.image || '',
                vod_remarks: item.views ? `${item.views}播放` : (item.lastseconds || ''),
                vod_year: item.add_Date ? String(item.add_Date).substring(0, 4) : ''
            })).filter(v => v.vod_id && v.vod_name);

            return JSON.stringify({
                page: 1,
                pagecount: 1,
                limit: list.length,
                total: list.length,
                list: list
            });
        }

        // 3. 影视长视频类板块 (电影, 电视剧, 综艺, 动漫, 纪录片, 体育)
        let cid = (extend && extend.class) || tid || '0,1,3';
        const tidMap = {
            '1': '0,1,3',
            '2': '0,1,4',
            '3': '0,1,5',
            '4': '0,1,6'
        };
        if (tidMap[cid]) {
            cid = tidMap[cid];
        }

        const region = (extend && (extend.area || extend.region)) || '';
        let language = (extend && (extend.lang || extend.language)) || '';
        if (language === '泰语') language = '泰国语';
        if (language === '西语') language = '西班牙语';
        const year = (extend && extend.year) || '';
        const orderby = (extend && (extend.sort || extend.by || extend.orderBy)) || '4';
        const status = (extend && extend.status) || '';

        const params = {
            cinema: '1',
            cid: cid,
            page: String(page),
            size: '24',
            orderby: orderby,
            desc: '1'
        };
        if (region) params.region = region;
        if (language) params.language = language;
        if (year) params.year = year;
        if (status) params.isserial = status;

        const url = signUrl(`${API_BASE}/api/list/Search`, params);
        const res = await fetchJsonWithCache(url, CACHE_TTL_DEFAULT);
        const info = (res && res.data && Array.isArray(res.data.info) && res.data.info[0]) ? res.data.info[0] : null;
        let rawList = (info && Array.isArray(info.result)) ? info.result : [];
        let recordCount = (info && info.recordcount !== undefined) ? parseInt(info.recordcount) : rawList.length;

        // 降级兜底
        if (rawList.length === 0 && !region && !language && !year && !status) {
            const fallbackUrl = signUrl(`${API_BASE}/api/list/index`, {
                cinema: '1',
                cid: cid,
                page: String(page),
                size: '24',
                isn: '0',
                isfree: '-1'
            });
            const fbRes = await fetchJsonWithCache(fallbackUrl, CACHE_TTL_DEFAULT);
            if (fbRes && fbRes.data && Array.isArray(fbRes.data.info)) {
                rawList = fbRes.data.info;
                recordCount = 9999;
            }
        }

        const list = rawList.map(item => ({
            vod_id: String(item.key || item.contxt || ''),
            vod_name: item.title || '',
            vod_pic: item.image || item.imgPath || '',
            vod_remarks: formatRemarks(item),
            vod_year: item.year ? String(item.year) : ''
        })).filter(v => v.vod_id);

        const pageCount = Math.ceil(recordCount / 24) || (list.length < 24 ? page : page + 1);

        if (list.length >= 24 && page < pageCount && page < 20) {
            Promise.resolve().then(() => {
                const nextParams = Object.assign({}, params, { page: String(page + 1) });
                const nextUrl = signUrl(`${API_BASE}/api/list/Search`, nextParams);
                fetchJsonWithCache(nextUrl, CACHE_TTL_DEFAULT).catch(() => {});
            }).catch(() => {});
        }

        return JSON.stringify({
            page: page,
            pagecount: pageCount,
            limit: 24,
            total: recordCount,
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

        // 1. 长视频主体详情
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
        const info = (res && res.data && Array.isArray(res.data.info) && res.data.info[0]) ? res.data.info[0] : null;

        // 如果长视频 detail 未命中，尝试短视频播放接口获取详情
        if (!info || !info.title) {
            const shortPlayUrl = signUrl('https://upload.yfsp.tv/api/video/play', {
                id: vodKey,
                alluser: '1',
                ispath: '1',
                device: '1',
                region: 'GL.'
            });
            const sRes = await fetchJsonWithCache(shortPlayUrl, CACHE_TTL_DEFAULT);
            const sItem = (sRes && sRes.data && Array.isArray(sRes.data.info) && sRes.data.info[0]) ? sRes.data.info[0] : null;
            if (sItem && sItem.title) {
                const sVod = [{
                    vod_id: vodKey,
                    vod_name: sItem.title,
                    vod_pic: sItem.image || '',
                    vod_type_name: sItem.videoType || '短视频',
                    vod_year: sItem.add_Date ? String(sItem.add_Date).substring(0, 4) : '',
                    vod_area: (sItem.tags && sItem.tags[0]) || '',
                    vod_remarks: sItem.add_Date || '',
                    vod_actor: (sItem.publisher && sItem.publisher.title) || '',
                    vod_director: (sItem.publisher && sItem.publisher.from) || '',
                    vod_content: (sItem.contxt || sItem.title || '').trim(),
                    vod_play_from: '超清专线',
                    vod_play_url: `正片$${vodKey}@@0`
                }];
                return JSON.stringify({ list: sVod });
            }
        }

        const validInfo = info || {};

        // 3. 获取长视频分集列表
        const epList = [];
        const cid = validInfo.cid || '';
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
            if (playList.length === 1 && (playList[0].name.includes('P') || !validInfo.isSerial)) {
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

        if (epList.length === 0) {
            epList.push(`正片$${vodKey}@@1`);
        }

        const typeName = [validInfo.channel, validInfo.videoType].filter(Boolean).join(' / ');
        const actors = Array.isArray(validInfo.stars) ? validInfo.stars.join(' / ') : (validInfo.stars || '');
        const directors = Array.isArray(validInfo.directors) ? validInfo.directors.join(' / ') : (validInfo.directors || '');

        const vod = [{
            vod_id: vodKey,
            vod_name: validInfo.title || '',
            vod_pic: validInfo.imgPath || '',
            vod_type_name: typeName,
            vod_year: String(validInfo.post_Year || '').substring(0, 4),
            vod_area: validInfo.regional || '',
            vod_remarks: formatRemarks(validInfo),
            vod_actor: actors,
            vod_director: directors,
            vod_content: (validInfo.contxt || '').trim(),
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

        // 1. 优先使用 Solr 快速搜索 (rankv21/v3/list/briefsearch)
        const solrUrl = signUrl(`${RANK_BASE}/v3/list/briefsearch`, {
            cinema: '1',
            tags: query,
            page: String(page),
            size: '20'
        });
        let res = await fetchJsonWithCache(solrUrl, CACHE_TTL_DEFAULT);
        let info = (res && res.data && Array.isArray(res.data.info) && res.data.info[0]) ? res.data.info[0] : null;
        let rawList = (info && Array.isArray(info.result)) ? info.result : [];

        // 2. 若 Solr 搜索无果，降级到标准 Search (m10/api/list/Search)
        if (rawList.length === 0) {
            const searchUrl = signUrl(`${API_BASE}/api/list/Search`, {
                cinema: '1',
                tags: query,
                page: String(page),
                size: '20'
            });
            const sRes = await fetchJsonWithCache(searchUrl, CACHE_TTL_DEFAULT);
            const sInfo = (sRes && sRes.data && Array.isArray(sRes.data.info) && sRes.data.info[0]) ? sRes.data.info[0] : null;
            if (sInfo && Array.isArray(sInfo.result) && sInfo.result.length > 0) {
                rawList = sInfo.result;
            }
        }

        const list = rawList.map(item => ({
            vod_id: String(item.contxt || item.key || ''),
            vod_name: item.title || '',
            vod_pic: item.image || item.imgPath || '',
            vod_remarks: formatRemarks(item),
            vod_year: item.year ? String(item.year) : (item.postTime ? String(item.postTime).substring(0, 4) : '')
        })).filter(v => v.vod_id && v.vod_name);

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

        // 1. 尝试长视频接口
        let playInfo = await fetchPlayUrl(mediaKey, aType);
        if (!playInfo) {
            const altA = aType === '1' ? '0' : '1';
            playInfo = await fetchPlayUrl(mediaKey, altA);
        }

        // 2. 若长视频接口未命中，尝试短视频接口
        if (!playInfo) {
            const shortPlayUrl = signUrl('https://upload.yfsp.tv/api/video/play', {
                id: mediaKey,
                alluser: '1',
                ispath: '1',
                device: '1',
                region: 'GL.'
            });
            const sRes = await req(shortPlayUrl, {
                headers: defaultHeaders,
                timeout: 6000
            });
            if (sRes && sRes.content) {
                try {
                    const sd = JSON.parse(sRes.content);
                    if (sd && sd.data && sd.data.code === 0 && Array.isArray(sd.data.info) && sd.data.info[0]) {
                        playInfo = sd.data.info[0];
                    }
                } catch (e) {}
            }
        }

        let m3u8Url = '';
        if (playInfo) {
            // 优先提取 flvPathList 中的 HLS 流
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

            // 备用清晰度 clarity 流
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
var spider = {
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
