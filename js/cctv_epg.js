/**
 * CCTV 央视官方节目单回看 QuickJS 爬虫 (含腾讯云时移切片域名本地代理)
 * 适配电视端 FongMi / TVBox / CatVod (type: 3)
 *
 * 特性：
 * 1. 覆盖央视全套频道（CCTV-1 到 CCTV-17）最近 7 天全天节目单回看
 * 2. 自动同步北京时间（CST UTC+8），精准定位“今天”、“昨天”、“前天”及过去一周
 * 3. 采用官方原装 HLS 时移技术（720P / 540P 高清切片流），非模糊的 270P
 * 4. 内置 NanoHTTPD 本地代理，自动修正腾讯云 -test 假域名防盗链
 */

const API_BASE = "https://api.cntv.cn";

const DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://tv.cctv.com/"
};

// 央视 17 套完整频道清单及标准台标
const CHANNELS = [
    { id: "cctv1", name: "CCTV-1 综合", logo: "https://epg.112114.xyz/logo/CCTV1.png" },
    { id: "cctv2", name: "CCTV-2 财经", logo: "https://epg.112114.xyz/logo/CCTV2.png" },
    { id: "cctv3", name: "CCTV-3 综艺", logo: "https://epg.112114.xyz/logo/CCTV3.png" },
    { id: "cctv4", name: "CCTV-4 中文国际", logo: "https://epg.112114.xyz/logo/CCTV4.png" },
    { id: "cctv5", name: "CCTV-5 体育", logo: "https://epg.112114.xyz/logo/CCTV5.png" },
    { id: "cctv5plus", name: "CCTV-5+ 体育赛事", logo: "https://epg.112114.xyz/logo/CCTV5%2B.png" },
    { id: "cctv6", name: "CCTV-6 电影", logo: "https://epg.112114.xyz/logo/CCTV6.png" },
    { id: "cctv7", name: "CCTV-7 国防军事", logo: "https://epg.112114.xyz/logo/CCTV7.png" },
    { id: "cctv8", name: "CCTV-8 电视剧", logo: "https://epg.112114.xyz/logo/CCTV8.png" },
    { id: "cctv9", name: "CCTV-9 纪录", logo: "https://epg.112114.xyz/logo/CCTV9.png" },
    { id: "cctv10", name: "CCTV-10 科教", logo: "https://epg.112114.xyz/logo/CCTV10.png" },
    { id: "cctv11", name: "CCTV-11 戏曲", logo: "https://epg.112114.xyz/logo/CCTV11.png" },
    { id: "cctv12", name: "CCTV-12 社会与法", logo: "https://epg.112114.xyz/logo/CCTV12.png" },
    { id: "cctv13", name: "CCTV-13 新闻", logo: "https://epg.112114.xyz/logo/CCTV13.png" },
    { id: "cctv14", name: "CCTV-14 少儿", logo: "https://epg.112114.xyz/logo/CCTV14.png" },
    { id: "cctv15", name: "CCTV-15 音乐", logo: "https://epg.112114.xyz/logo/CCTV15.png" },
    { id: "cctv16", name: "CCTV-16 奥林匹克", logo: "https://epg.112114.xyz/logo/CCTV16.png" },
    { id: "cctv17", name: "CCTV-17 农业农村", logo: "https://epg.112114.xyz/logo/CCTV17.png" }
];

// 计算北京时间 (CST UTC+8) 的指定偏移日期
function getCstDate(offsetDays = 0) {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const cst = new Date(utc + (3600000 * 8) - (offsetDays * 86400000));
    const y = cst.getFullYear();
    const m = String(cst.getMonth() + 1).padStart(2, '0');
    const d = String(cst.getDate()).padStart(2, '0');
    return {
        dateStr: `${y}${m}${d}`,
        monthDay: `${m}-${d}`,
        timestamp: Math.floor(cst.getTime() / 1000)
    };
}

function init(ext) {
    // 爬虫初始化
}

function home(filter) {
    try {
        const classes = CHANNELS.map(ch => ({
            type_id: ch.id,
            type_name: ch.name
        }));

        // 构造最近 7 天日期筛选器
        const dateFilterValues = [];
        for (let i = 0; i < 7; i++) {
            const d = getCstDate(i);
            let label = d.monthDay;
            if (i === 0) label = `今天 (${label})`;
            else if (i === 1) label = `昨天 (${label})`;
            else if (i === 2) label = `前天 (${label})`;
            dateFilterValues.push({ n: label, v: d.dateStr });
        }

        const filters = {};
        for (let ch of CHANNELS) {
            filters[ch.id] = [{
                key: "date",
                name: "日期",
                value: dateFilterValues
            }];
        }

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
        return category("cctv1", 1, false, {});
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

function category(tid, pg, filter, extend = {}) {
    try {
        const channelId = tid || "cctv1";
        const channelObj = CHANNELS.find(c => c.id === channelId) || CHANNELS[0];

        // 确定选中的日期（默认今天北京时间）
        const todayCst = getCstDate(0);
        const queryDate = (extend && extend.date) ? extend.date : todayCst.dateStr;

        const url = `${API_BASE}/epg/getEpgInfoByChannelNew?c=${channelId}&serviceId=tvcctv&d=${queryDate}&t=json`;
        const res = req(url, { headers: DEFAULT_HEADERS });

        const list = [];
        const nowSec = Math.floor(Date.now() / 1000);

        if (res && res.content) {
            try {
                const data = JSON.parse(res.content);
                const rawList = (data && data.data && data.data[channelId] && data.data[channelId].list) || [];

                for (let i = 0; i < rawList.length; i++) {
                    const item = rawList[i];
                    const title = (item.title || "未知节目").trim();
                    const showTime = (item.showTime || "--:--").trim();
                    const stime = parseInt(item.startTime || 0);
                    const etime = parseInt(item.endTime || 0);

                    if (!stime || !etime) continue;

                    let statusMark = "回看 720P";
                    if (nowSec < stime) {
                        statusMark = "未播出";
                    } else if (nowSec >= stime && nowSec <= etime) {
                        statusMark = "正在直播";
                    }

                    list.push({
                        vod_id: `${channelId}@@${stime}@@${etime}@@${encodeURIComponent(title)}@@${showTime}@@${queryDate}`,
                        vod_name: `${showTime} ${title}`,
                        vod_pic: channelObj.logo,
                        vod_remarks: statusMark,
                        vod_year: showTime
                    });
                }
            } catch (e) {}
        }

        return JSON.stringify({
            page: 1,
            pagecount: 1,
            limit: list.length,
            total: list.length,
            list: list
        });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

function detail(id) {
    try {
        const parts = id.split("@@");
        const channelId = parts[0];
        const stime = parts[1];
        const etime = parts[2];
        const title = parts[3] ? decodeURIComponent(parts[3]) : "节目回看";
        const showTime = parts[4] || "";
        const queryDate = parts[5] || "";

        const channelObj = CHANNELS.find(c => c.id === channelId) || CHANNELS[0];

        const vod = [{
            vod_id: id,
            vod_name: `${showTime} ${title}`,
            vod_pic: channelObj.logo,
            type_name: channelObj.name,
            vod_year: queryDate ? `${queryDate.slice(0, 4)}-${queryDate.slice(4, 6)}-${queryDate.slice(6, 8)}` : "2026",
            vod_area: "中国",
            vod_remarks: `播出时段: ${showTime}`,
            vod_actor: "中央广播电视总台",
            vod_director: channelObj.name,
            vod_content: `中央广播电视总台 ${channelObj.name}《${title}》官方时移回看，支持 720P/540P 原生硬件解码播放。`,
            vod_play_from: "央视高清回看",
            vod_play_url: `高清播放$${channelId}@${stime}@${etime}@${encodeURIComponent(title)}`
        }];

        return JSON.stringify({ list: vod });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

function play(flag, id, flags) {
    try {
        const parts = id.split("@");
        const channelId = parts[0];
        const stime = parts[1];
        const etime = parts[2];

        // 走本地回环代理，由 proxy() 重写 m3u8 并清洗假域名
        const playUrl = `http://127.0.0.1:9978/proxy/cctv.m3u8?do=js&siteKey=20261123_cctv_epg&ch=${channelId}&st=${stime}&et=${etime}`;

        return JSON.stringify({
            parse: 0,
            url: playUrl,
            format: "application/vnd.apple.mpegurl",
            header: {
                "User-Agent": DEFAULT_HEADERS["User-Agent"],
                "Referer": "https://tv.cctv.com/"
            }
        });
    } catch (e) {
        return JSON.stringify({ parse: 0, url: "" });
    }
}

/**
 * 潘多拉影视本地 HTTP 代理服务拦截器 (127.0.0.1:9978)
 * 核心任务：
 * 1. 向腾讯云拉取原生时移切片列表
 * 2. 将 -test.vod2.myqcloud.com 假域名替换为可通外网的真实域名 .vod2.myqcloud.com
 */
function proxy(params) {
    try {
        const ch = params.ch || "cctv1";
        const st = params.st;
        const et = params.et;

        if (st && et) {
            const stAbs = parseInt(st) * 1000;
            const etAbs = parseInt(et) * 1000;

            // 优先请求 td (720P 高码率)
            const m3u8Url = `https://ldncctvwbcdtxy.liveplay.myqcloud.com/ldncctvwbcd/cdrmld${ch}_1/index.m3u8?BR=td&use_tlive=0&endtimeabs=${etAbs}&begintimeabs=${stAbs}`;
            let res = req(m3u8Url, { headers: DEFAULT_HEADERS });

            // 若 td 档位无切片，自动降级请求无 BR 限制的 master/默认流
            if (!res || !res.content || res.content.indexOf("#EXTM3U") === -1) {
                const fallbackUrl = `https://ldncctvwbcdtxy.liveplay.myqcloud.com/ldncctvwbcd/cdrmld${ch}_1/index.m3u8?use_tlive=0&endtimeabs=${etAbs}&begintimeabs=${stAbs}`;
                res = req(fallbackUrl, { headers: DEFAULT_HEADERS });
            }

            if (res && res.content && res.content.indexOf("#EXTM3U") !== -1) {
                // 关键修正：将腾讯云防盗链假域名 1252894780-test.vod2 替换为真实公网域名 1252894780.vod2
                const cleanM3u8 = res.content.replace(/1252894780-test\.vod2\.myqcloud\.com/g, "1252894780.vod2.myqcloud.com");

                return [
                    200,
                    "application/vnd.apple.mpegurl",
                    cleanM3u8,
                    {
                        "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
                        "Access-Control-Allow-Origin": "*"
                    }
                ];
            }
        }
    } catch (e) {}

    return [404, "text/plain", "Not Found"];
}

function search(wd, quick) {
    return JSON.stringify({ list: [] });
}

export default {
    init: init,
    home: home,
    homeVod: homeVod,
    category: category,
    detail: detail,
    search: search,
    play: play,
    proxy: proxy
};
