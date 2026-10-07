/**
 * 瓜子影视 (gz360.tv) QuickJS 点播爬虫
 * 适用于 FongMi (潘多拉影视) / CatVod / TVBox QuickJS 引擎
 */

let host = 'https://gz360.tv';
let apiUrl = 'https://haiwaiapi.1fc8ab0.com/Pc';

const KEY = '181cc88340ae5b2b';
const IV = '4423d1e2773476ce';

const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://gz360.tv',
    'Referer': 'https://gz360.tv/',
    'Content-Type': 'application/json'
};

const b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function b64_encode(str) {
    if (typeof btoa === 'function') {
        try { return btoa(str); } catch (e) {}
    }
    let out = '', i = 0, len = str.length;
    while (i < len) {
        const c1 = str.charCodeAt(i++) & 255;
        if (i === len) {
            out += b64chars.charAt(c1 >> 2) + b64chars.charAt((c1 & 3) << 4) + '==';
            break;
        }
        const c2 = str.charCodeAt(i++) & 255;
        if (i === len) {
            out += b64chars.charAt(c1 >> 2) + b64chars.charAt(((c1 & 3) << 4) | (c2 >> 4)) + b64chars.charAt((c2 & 15) << 2) + '=';
            break;
        }
        const c3 = str.charCodeAt(i++) & 255;
        out += b64chars.charAt(c1 >> 2) + b64chars.charAt(((c1 & 3) << 4) | (c2 >> 4)) + b64chars.charAt(((c2 & 15) << 2) | (c3 >> 6)) + b64chars.charAt(c3 & 63);
    }
    return out;
}

function b64_decode(str) {
    if (typeof atob === 'function') {
        try { return atob(str); } catch (e) {}
    }
    str = (str || '').replace(/[^A-Za-z0-9+/=]/g, '');
    let out = '', i = 0;
    while (i < str.length) {
        const enc1 = b64chars.indexOf(str.charAt(i++));
        const enc2 = b64chars.indexOf(str.charAt(i++));
        const enc3 = b64chars.indexOf(str.charAt(i++));
        const enc4 = b64chars.indexOf(str.charAt(i++));

        const chr1 = (enc1 << 2) | (enc2 >> 4);
        const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        const chr3 = ((enc3 & 3) << 6) | enc4;

        out += String.fromCharCode(chr1);
        if (enc3 !== 64 && enc3 !== -1 && enc3 < 64) out += String.fromCharCode(chr2);
        if (enc4 !== 64 && enc4 !== -1 && enc4 < 64) out += String.fromCharCode(chr3);
    }
    return out;
}

function hexToBase64(hex) {
    let bin = '';
    for (let i = 0; i < hex.length; i += 2) {
        bin += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return b64_encode(bin);
}

function base64ToHex(b64) {
    const bin = b64_decode(b64);
    let hex = '';
    for (let i = 0; i < bin.length; i++) {
        const c = bin.charCodeAt(i).toString(16);
        hex += (c.length === 1 ? '0' : '') + c;
    }
    return hex;
}

function encrypt(obj) {
    const text = typeof obj === 'string' ? obj : JSON.stringify(obj);
    if (typeof aesX === 'function') {
        const b64 = aesX('AES/CBC/PKCS7', true, text, false, KEY, IV, true);
        return base64ToHex(b64);
    }
    if (typeof CryptoJS !== 'undefined') {
        const key = CryptoJS.enc.Utf8.parse(KEY);
        const iv = CryptoJS.enc.Utf8.parse(IV);
        const encrypted = CryptoJS.AES.encrypt(text, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        return encrypted.ciphertext.toString(CryptoJS.enc.Hex);
    }
    throw new Error('AES cipher not available');
}

function decrypt(hexStr) {
    if (!hexStr) return '';
    if (typeof aesX === 'function') {
        const b64 = hexToBase64(hexStr);
        return aesX('AES/CBC/PKCS7', false, b64, true, KEY, IV, false);
    }
    if (typeof CryptoJS !== 'undefined') {
        const key = CryptoJS.enc.Utf8.parse(KEY);
        const iv = CryptoJS.enc.Utf8.parse(IV);
        const cipherParams = CryptoJS.lib.CipherParams.create({
            ciphertext: CryptoJS.enc.Hex.parse(hexStr)
        });
        return CryptoJS.AES.decrypt(cipherParams, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        }).toString(CryptoJS.enc.Utf8);
    }
    throw new Error('AES cipher not available');
}

async function postApi(path, data = {}) {
    const hex = encrypt(data);
    const bodyStr = JSON.stringify({ params: hex });
    const res = await req(`${apiUrl}${path}`, {
        method: 'post',
        postType: 'json',
        data: { params: hex },
        body: bodyStr,
        headers: defaultHeaders
    });

    const resJson = JSON.parse(res.content || '{}');
    if (resJson && resJson.data) {
        const dec = decrypt(resJson.data);
        return JSON.parse(dec || '{}');
    }
    return resJson;
}

async function init(cfg) {
    if (cfg && cfg.ext) {
        if (typeof cfg.ext === 'string' && cfg.ext.startsWith('http')) {
            apiUrl = cfg.ext.replace(/\/+$/, '');
        } else if (cfg.ext.api) {
            apiUrl = cfg.ext.api.replace(/\/+$/, '');
        }
    }
}

async function home(filter) {
    const classes = [
        { type_id: '1', type_name: '电影' },
        { type_id: '2', type_name: '连续剧' },
        { type_id: '3', type_name: '综艺' },
        { type_id: '4', type_name: '动漫' },
        { type_id: '64', type_name: '短剧' },
        { type_id: '74', type_name: 'AI漫剧' },
        { type_id: '73', type_name: '电影解说' },
        { type_id: '70', type_name: '电竞解说' },
        { type_id: '71', type_name: '体育解说' },
        { type_id: '72', type_name: '音乐' }
    ];

    const commonAreas = [
        { n: '全部', v: '0' },
        { n: '大陆', v: '大陆' },
        { n: '香港', v: '香港' },
        { n: '台湾', v: '台湾' },
        { n: '欧美', v: '俄罗斯,加拿大,德国,意大利,法国,欧美,美国,英国,西班牙' },
        { n: '日本', v: '日本' },
        { n: '韩国', v: '韩国' },
        { n: '泰国', v: '泰国' },
        { n: '其他', v: '其他,印度,新加坡,马来西亚' }
    ];

    const commonYears = [
        { n: '全部', v: '0' },
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
        { n: '10-15年', v: '2015,2014,2013,2012,2011,2010' },
        { n: '00年代', v: '2000,2001,2002,2003,2004,2005,2006,2007,2008,2009' },
        { n: '90年代', v: '1990,1991,1992,1993,1994,1995,1996,1997,1998,1999' },
        { n: '80年代', v: '1980,1981,1982,1983,1984,1985,1986,1987,1988,1989' },
        { n: '更早', v: '更早' }
    ];

    const commonSorts = [
        { n: '综合', v: 'd_id' },
        { n: '最新', v: 'd_addtime' },
        { n: '高分', v: 'd_score' }
    ];

    const movieClasses = [
        { n: '全部', v: '0' },
        { n: '动作', v: '84' },
        { n: '喜剧', v: '66' },
        { n: '爱情', v: '71' },
        { n: '科幻', v: '3' },
        { n: '悬疑', v: '2' },
        { n: '惊悚', v: '1' },
        { n: '恐怖', v: '9' },
        { n: '犯罪', v: '77' },
        { n: '战争', v: '87' },
        { n: '冒险', v: '68' },
        { n: '奇幻', v: '86' },
        { n: '武侠', v: '93' },
        { n: '剧情', v: '82' },
        { n: '动画', v: '6' },
        { n: '纪录片', v: '69' },
        { n: '灾难', v: '5' },
        { n: '家庭', v: '83' },
        { n: '传记', v: '72' },
        { n: '历史', v: '12' },
        { n: '青春', v: '8' },
        { n: '音乐', v: '70' },
        { n: '西部', v: '73' },
        { n: '古装', v: '7' },
        { n: '励志', v: '13' },
        { n: '运动', v: '90' },
        { n: '同性', v: '88' }
    ];

    const tvClasses = [
        { n: '全部', v: '0' },
        { n: '古装', v: '22' },
        { n: '爱情', v: '15' },
        { n: '都市', v: '16' },
        { n: '喜剧', v: '20' },
        { n: '剧情', v: '81' },
        { n: '悬疑', v: '32' },
        { n: '动作', v: '80' },
        { n: '武侠', v: '23' },
        { n: '奇幻', v: '78' },
        { n: '冒险', v: '79' },
        { n: '犯罪', v: '33' },
        { n: '刑侦', v: '24' },
        { n: '战争', v: '25' },
        { n: '历史', v: '21' },
        { n: '家庭', v: '17' },
        { n: '偶像', v: '19' },
        { n: '军旅', v: '27' },
        { n: '谍战', v: '28' },
        { n: '商战', v: '29' },
        { n: '校园', v: '30' },
        { n: '穿越', v: '31' },
        { n: '科幻', v: '34' },
        { n: '惊悚', v: '76' },
        { n: '神话', v: '26' },
        { n: '生活', v: '18' },
        { n: '动画', v: '91' },
        { n: '纪录片', v: '74' },
        { n: '传记', v: '102' },
        { n: '音乐', v: '105' },
        { n: '西部', v: '92' },
        { n: '运动', v: '99' },
        { n: '恐怖', v: '100' },
        { n: '同性', v: '75' }
    ];

    const showClasses = [
        { n: '全部', v: '0' },
        { n: '真人秀', v: '37' },
        { n: '脱口秀', v: '36' },
        { n: '选秀', v: '38' },
        { n: '情感', v: '39' },
        { n: '访谈', v: '40' },
        { n: '时尚', v: '41' },
        { n: '晚会', v: '42' },
        { n: '音乐', v: '45' },
        { n: '游戏', v: '46' },
        { n: '美食', v: '48' },
        { n: '旅游', v: '49' },
        { n: '韩国真人秀', v: '59' }
    ];

    const animeClasses = [
        { n: '全部', v: '0' },
        { n: '热血', v: '51' },
        { n: '冒险', v: '50' },
        { n: '搞笑', v: '52' },
        { n: '恋爱', v: '53' },
        { n: '奇幻', v: '60' },
        { n: '动作', v: '94' },
        { n: '科幻', v: '96' },
        { n: '推理', v: '54' },
        { n: '悬疑', v: '97' },
        { n: '校园', v: '61' },
        { n: '青春', v: '65' },
        { n: '竞技', v: '55' },
        { n: '益智', v: '56' },
        { n: '童话', v: '57' },
        { n: '经典', v: '58' },
        { n: '励志', v: '62' },
        { n: '剧情', v: '63' },
        { n: '后宫', v: '64' },
        { n: '动画', v: '98' }
    ];

    function makeFilter(classList) {
        const res = [];
        if (classList && classList.length > 0) {
            res.push({ key: 'class', name: '类型', value: classList });
        }
        res.push({ key: 'area', name: '地区', value: commonAreas });
        res.push({ key: 'year', name: '年份', value: commonYears });
        res.push({ key: 'sort', name: '排序', value: commonSorts });
        return res;
    }

    const filters = {
        '1': makeFilter(movieClasses),
        '2': makeFilter(tvClasses),
        '3': makeFilter(showClasses),
        '4': makeFilter(animeClasses),
        '64': makeFilter([]),
        '74': makeFilter([]),
        '73': makeFilter([]),
        '70': makeFilter([]),
        '71': makeFilter([]),
        '72': makeFilter([])
    };

    return JSON.stringify({
        class: classes,
        filters: filters
    });
}

async function homeVod() {
    try {
        const res = await postApi('/Index/CategoryList', {});
        let videos = [];
        let seen = new Set();
        if (res && res.list && Array.isArray(res.list)) {
            for (let section of res.list) {
                if (section.list && Array.isArray(section.list)) {
                    for (let item of section.list) {
                        const id = String(item.vod_id || '');
                        if (!id || seen.has(id)) continue;
                        seen.add(id);
                        videos.push({
                            vod_id: id,
                            vod_name: item.c_name || item.vod_name || '',
                            vod_pic: item.c_pic || item.vod_pic || '',
                            vod_remarks: item.vod_continu || (item.vod_douban_score ? item.vod_douban_score + '分' : '') || ''
                        });
                    }
                }
            }
        }
        return JSON.stringify({ list: videos });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function category(tid, pg, filter, extend = {}) {
    try {
        const page = parseInt(pg || 1);
        const payload = {
            tid: parseInt(tid || 1),
            page: page,
            pageSize: 24,
            keywords: ''
        };

        if (extend) {
            if (extend.class && extend.class !== '0') payload.class = extend.class;
            if (extend.area && extend.area !== '0') payload.area = extend.area;
            if (extend.year && extend.year !== '0') payload.year = extend.year;
            if (extend.sort) payload.sort = extend.sort;
        }

        const res = await postApi('/Search/GetConditionList', payload);
        const list = (res.list || []).map(item => ({
            vod_id: String(item.vod_id),
            vod_name: item.vod_name || item.c_name || '',
            vod_pic: item.vod_pic || item.c_pic || '',
            vod_remarks: item.new_continue || item.vod_title || item.vod_continu || (item.vod_scroe ? item.vod_scroe + '分' : ''),
            vod_year: item.vod_year || ''
        }));

        return JSON.stringify({
            page: page,
            pagecount: Math.ceil((res.total || 0) / 24) || page,
            limit: 24,
            total: res.total || 0,
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
        const [infoRes, playRes] = await Promise.all([
            postApi('/Resource/GetVodInfo', { vod_id: parseInt(id) }),
            postApi('/Resource/GetOnePlayList', { vod_id: parseInt(id), pageSize: 2000 })
        ]);

        const info = (infoRes && infoRes.vodInfo) ? infoRes.vodInfo : {};
        const urls = (playRes && playRes.urls && Array.isArray(playRes.urls)) ? playRes.urls : [];

        let epList = [];
        for (let ep of urls) {
            const epName = ep.name || `第${ep.episode || ep.sort || 1}集`;
            const epUrl = ep.url || '';
            if (epUrl) {
                epList.push(`${epName}$${epUrl}`);
            }
        }

        if (epList.length === 0 && info.play_url) {
            epList.push(`${info.default_play_name || '正片'}$${info.play_url}`);
        }

        const vod = [{
            vod_id: String(info.vod_id || id),
            vod_name: info.vod_name || '',
            vod_pic: info.pic || '',
            vod_type_name: (info.videoTag && Array.isArray(info.videoTag)) ? info.videoTag.join(' / ') : '',
            vod_year: (info.vod_year || '').substring(0, 4),
            vod_area: info.vod_area || '',
            vod_remarks: info.vod_continu || (info.vod_scroe ? info.vod_scroe + '分' : ''),
            vod_actor: info.vod_actor || '',
            vod_director: info.vod_director || '',
            vod_content: (info.vod_use_content || '').trim(),
            vod_play_from: '瓜子影视',
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
        const res = await postApi('/Search/GetConditionList', {
            keywords: wd,
            page: page,
            pageSize: 24
        });
        const list = (res.list || []).map(item => ({
            vod_id: String(item.vod_id),
            vod_name: item.vod_name || '',
            vod_pic: item.vod_pic || '',
            vod_remarks: item.new_continue || item.vod_title || item.vod_continu || (item.vod_scroe ? item.vod_scroe + '分' : ''),
            vod_year: item.vod_year || ''
        }));
        return JSON.stringify({
            page: page,
            pagecount: Math.ceil((res.total || 0) / 24) || page,
            limit: 24,
            total: res.total || 0,
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
    return JSON.stringify({
        parse: 0,
        url: id,
        header: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': 'https://gz360.tv',
            'Referer': 'https://gz360.tv/'
        }
    });
}

export function __jsEvalReturn() {
    return {
        init: init,
        home: home,
        homeVod: homeVod,
        category: category,
        detail: detail,
        play: play,
        search: search
    };
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
