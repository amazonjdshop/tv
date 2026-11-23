/**
 * CCTV 央视回看专区电视端 QuickJS 爬虫 (含本地高码率流代理)
 * 适配电视端 FongMi / TVBox / CatVod (type: 3)
 *
 * 特性：
 * 1. 深度聚合央视王牌栏目库（新闻联播、焦点访谈、今日说法、朝闻天下、天下足球、东方时空、晚间新闻、防务新观察等）
 * 2. 独家支持「多段高清 MP4 虚拟 HLS 缝合技术」：
 *    - 针对新闻联播等栏目，自动将 chapters4（1280x720P / 1920x1080P 高码率）无缝合成为虚拟 M3U8
 *    - 通过本地回环代理（127.0.0.1:9978/proxy?do=cctv）秒吐给 ExoPlayer 原生硬件解码器
 *    - 彻底告别 270P 模糊流，真 720P/1080P 极清大屏呈现！
 * 3. 完美适配遥控器选期、全天播放、快进倒退
 */

const API_BASE = "https://api.cntv.cn";

const DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://tv.cctv.com/"
};

// 央视核心王牌栏目映射字典
const COLUMNS = [
    { id: "TOPC1451528971114112", name: "新闻联播", channel: "CCTV-1 / CCTV-13", pic: "https://p1.img.cctvpic.com/photoAlbum/page/performance/img/2021/12/21/1640068472534_828.jpg" },
    { id: "TOPC1451558976694518", name: "焦点访谈", channel: "CCTV-1 / CCTV-13", pic: "https://p4.img.cctvpic.com/photoAlbum/page/performance/img/2021/12/21/1640068525042_484.jpg" },
    { id: "TOPC1451558496100826", name: "朝闻天下", channel: "CCTV-1 / CCTV-13", pic: "https://p1.img.cctvpic.com/photoAlbum/page/performance/img/2021/12/21/1640068494793_128.jpg" },
    { id: "TOPC1451464665008914", name: "今日说法", channel: "CCTV-1 综合", pic: "https://p1.img.cctvpic.com/photoAlbum/page/performance/img/2021/12/21/1640068547466_662.jpg" },
    { id: "TOPC1451558532019883", name: "东方时空", channel: "CCTV-13 新闻", pic: "https://p1.img.cctvpic.com/photoAlbum/page/performance/img/2021/12/21/1640068564883_229.jpg" },
    { id: "TOPC1451528792881669", name: "晚间新闻", channel: "CCTV-1 综合", pic: "https://p1.img.cctvpic.com/photoAlbum/page/performance/img/2021/12/21/1640068583492_328.jpg" },
    { id: "TOPC1451526164984187", name: "防务新观察", channel: "CCTV-7 国防军事", pic: "https://p1.img.cctvpic.com/photoAlbum/page/performance/img/2021/12/21/1640068615392_512.jpg" },
    { id: "TOPC1451551777876756", name: "天下足球", channel: "CCTV-5 体育", pic: "https://p1.img.cctvpic.com/photoAlbum/page/performance/img/2021/12/21/1640068638421_934.jpg" },
    { id: "TOPC1451464884159276", name: "开讲啦", channel: "CCTV-1 综合", pic: "https://p1.img.cctvpic.com/photoAlbum/page/performance/img/2021/12/21/1640068659102_447.jpg" },
    { id: "TOPC1451557893544236", name: "探索发现", channel: "CCTV-10 科教", pic: "https://p1.img.cctvpic.com/photoAlbum/page/performance/img/2021/12/21/1640068679198_183.jpg" }
];

function init(ext) {
    // 爬虫初始化
}

function home(filter) {
    try {
        const classes = [
            { type_id: "news", type_name: "📢 核心时政" },
            { type_id: "social", type_name: "⚖️ 法治民生" },
            { type_id: "military", type_name: "🎖️ 军事天下" },
            { type_id: "culture", type_name: "🏛️ 人文探索" },
            { type_id: "sports", type_name: "⚽ 体育巅峰" }
        ];

        return JSON.stringify({
            class: classes,
            filters: {}
        });
    } catch (e) {
        return JSON.stringify({ class: [] });
    }
}

function homeVod() {
    try {
        return category("news", 1, false, {});
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

function category(tid, pg, filter, extend = {}) {
    try {
        let targets = [];
        if (tid === "news") {
            targets = ["新闻联播", "焦点访谈", "朝闻天下", "东方时空", "晚间新闻"];
        } else if (tid === "social") {
            targets = ["今日说法"];
        } else if (tid === "military") {
            targets = ["防务新观察"];
        } else if (tid === "culture") {
            targets = ["开讲啦", "探索发现"];
        } else if (tid === "sports") {
            targets = ["天下足球"];
        } else {
            targets = COLUMNS.map(c => c.name);
        }

        const list = [];
        for (let i = 0; i < COLUMNS.length; i++) {
            const col = COLUMNS[i];
            if (targets.includes(col.name)) {
                list.push({
                    vod_id: `${col.id}@@${encodeURIComponent(col.name)}`,
                    vod_name: `《${col.name}》往期回看`,
                    vod_pic: col.pic,
                    vod_remarks: col.channel,
                    vod_year: "每日更新"
                });
            }
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
        const topicId = parts[0];
        const name = parts[1] ? decodeURIComponent(parts[1]) : "央视回看";

        // 拉取最近 30 期节目列表
        const url = `${API_BASE}/NewVideo/getVideoListByColumn?id=${topicId}&n=30&sort=desc&p=1&mode=0&serviceId=tvcctv&t=json`;
        const res = req(url, { headers: DEFAULT_HEADERS });
        const epList = [];

        if (res && res.content) {
            try {
                const data = JSON.parse(res.content);
                const list = (data && data.data && data.data.list) || [];
                for (let i = 0; i < list.length; i++) {
                    const item = list[i];
                    let title = (item.title || "").trim();
                    const guid = item.guid || "";
                    if (!guid) continue;

                    // 优化标题展示（截取日期或主题）
                    title = title.replace(new RegExp(`《?${name}》?`, 'g'), '').trim();
                    if (!title) title = `第${list.length - i}期`;

                    epList.push(`${title}$${guid}`);
                }
            } catch (e) {}
        }

        const vod = [{
            vod_id: id,
            vod_name: `《${name}》回看合集`,
            vod_pic: "",
            type_name: "央视王牌栏目",
            vod_year: "2026",
            vod_area: "中国",
            vod_remarks: `收录最近${epList.length}期`,
            vod_actor: "总台主播群",
            vod_director: "中央广播电视总台",
            vod_content: `中央广播电视总台《${name}》官方往期节目回看，支持 720P/1080P 高清秒播。`,
            vod_play_from: "央视超清回看",
            vod_play_url: epList.join("#")
        }];

        return JSON.stringify({ list: vod });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

function play(flag, id, flags) {
    try {
        const guid = id;
        const vdnUrl = `https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do?pid=${guid}&from=000tv`;
        const res = req(vdnUrl, { headers: DEFAULT_HEADERS });

        let playUrl = "";
        let useProxy = false;

        if (res && res.content) {
            try {
                const data = JSON.parse(res.content);
                const video = data.video || {};
                const ch4 = video.chapters4 || [];
                const ch3 = video.chapters3 || [];

                // 1. 如果存在高质量的分段 MP4 (chapters4 / chapters3)，利用本地代理缝合成虚拟 720P/1080P HLS
                if ((ch4.length > 0 && ch4[0].url) || (ch3.length > 0 && ch3[0].url)) {
                    // 交给本地代理虚拟合成 M3U8
                    playUrl = `http://127.0.0.1:9978/proxy?do=cctv_m3u8&guid=${guid}`;
                    useProxy = true;
                } else {
                    // 2. 否则优先使用 720P 的 1200.m3u8
                    playUrl = `https://hls.cntv.cdn20.com/asp/hls/1200/0303000a/3/default/${guid}/1200.m3u8`;
                }
            } catch (e) {
                playUrl = `https://hls.cntv.cdn20.com/asp/hls/1200/0303000a/3/default/${guid}/1200.m3u8`;
            }
        } else {
            playUrl = `https://hls.cntv.cdn20.com/asp/hls/1200/0303000a/3/default/${guid}/1200.m3u8`;
        }

        return JSON.stringify({
            parse: 0,
            url: playUrl,
            header: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://tv.cctv.com/"
            }
        });
    } catch (e) {
        return JSON.stringify({ parse: 0, url: "" });
    }
}

/**
 * 潘多拉影视本地 HTTP 代理服务拦截器 (127.0.0.1:9978)
 */
function proxy(params) {
    try {
        const action = params.do;
        const guid = params.guid;

        if (action === "cctv_m3u8" && guid) {
            const vdnUrl = `https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do?pid=${guid}&from=000tv`;
            const res = req(vdnUrl, { headers: DEFAULT_HEADERS });
            if (res && res.content) {
                const data = JSON.parse(res.content);
                const video = data.video || {};
                const chapters = (video.chapters4 && video.chapters4.length > 0 && video.chapters4[0].url) ? video.chapters4 : video.chapters3;

                if (chapters && chapters.length > 0) {
                    let targetDur = 180;
                    for (let c of chapters) {
                        const d = parseFloat(c.duration || 0);
                        if (d > targetDur) targetDur = Math.ceil(d);
                    }

                    const lines = [
                        "#EXTM3U",
                        "#EXT-X-VERSION:3",
                        `#EXT-X-TARGETDURATION:${targetDur + 5}`,
                        "#EXT-X-MEDIA-SEQUENCE:0"
                    ];

                    for (let c of chapters) {
                        const dur = c.duration || "180.00";
                        const u = c.url || "";
                        if (u) {
                            lines.push(`#EXTINF:${dur},`);
                            lines.push(u);
                            lines.push("#EXT-X-DISCONTINUITY");
                        }
                    }
                    lines.push("#EXT-X-ENDLIST");

                    const m3u8Content = lines.join("\n");
                    return [
                        200,
                        "application/x-mpegURL",
                        m3u8Content,
                        {
                            "Content-Type": "application/x-mpegURL; charset=utf-8",
                            "Access-Control-Allow-Origin": "*"
                        }
                    ];
                }
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
