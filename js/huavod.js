/**
 * 华视影院 (huavod.com) QuickJS 点播爬虫
 * 适用于 FongMi (潘多拉影视) / TVBox QuickJS 引擎
 */

let host = 'https://huavod.com';
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://huavod.com/'
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function init(cfg) {
    if (cfg && cfg.ext) {
        if (typeof cfg.ext === 'string' && cfg.ext.startsWith('http')) {
            host = cfg.ext.replace(/\/+$/, '');
        } else if (cfg.ext.host) {
            host = cfg.ext.host.replace(/\/+$/, '');
        }
    }
}

async function home(filter) {
    const classes = [
        { type_id: '1', type_name: '电影' },
        { type_id: '2', type_name: '电视剧' },
        { type_id: '3', type_name: '综艺' },
        { type_id: '4', type_name: '动漫' },
        { type_id: '5', type_name: '短剧' }
    ];
    return JSON.stringify({ class: classes });
}

async function homeVod() {
    try {
        const r = await req(host, { headers });
        const html = r.content || '';
        let videos = [];
        let seen = new Set();

        const pattern = /<a[^>]*href="\/voddetail\/(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/g;
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const id = match[1];
            if (seen.has(id)) continue;

            const inner = match[2];
            const nameMatch = inner.match(/title="([^"]+)"/) || inner.match(/alt="([^"]+?)(?:封面图)?"/) || inner.match(/<(?:h3|span|div)[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)/);
            const picMatch = inner.match(/data-(?:src|original)="([^"]+)"/) || inner.match(/src="([^"]+)"/) || inner.match(/url\(['"]?([^'")]+)/);
            const remarkMatch = inner.match(/class="[^"]*(?:remarks|public-list-prb)[^"]*"[^>]*>([\s\S]*?)<\/span>/) || inner.match(/<i[^>]*class="ft4"[^>]*>([^<]+)<\/i>/);

            const name = nameMatch ? nameMatch[1].replace('封面图', '').trim() : '';
            const pic = picMatch ? picMatch[1].trim() : '';
            const remarks = remarkMatch ? remarkMatch[1].replace(/<[^>]+>/g, '').trim() : '';

            if (name && pic && !pic.startsWith('data:')) {
                seen.add(id);
                videos.push({
                    vod_id: id,
                    vod_name: name,
                    vod_pic: pic,
                    vod_remarks: remarks
                });
            }
        }
        return JSON.stringify({ list: videos });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function category(tid, pg, filter, extend = {}) {
    try {
        const page = pg || 1;
        const pageUrl = `${host}/vodshow/${tid}/page/${page}.html`;
        const r = await req(pageUrl, { headers });
        const html = r.content || '';

        let videos = [];
        let seen = new Set();

        const pattern = /<a[^>]*class="public-list-exp"[^>]*href="\/voddetail\/(\d+)\.html"[^>]*title="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const id = match[1];
            if (seen.has(id)) continue;
            seen.add(id);

            const name = match[2].trim();
            const inner = match[3];
            const picMatch = inner.match(/data-(?:src|original)="([^"]+)"/) || inner.match(/src="([^"]+)"/);
            const remarkMatch = inner.match(/class="[^"]*(?:remarks|public-list-prb)[^"]*"[^>]*>.*?<i[^>]*>([^<]+)<\/i>/) || inner.match(/class="[^"]*(?:remarks|public-list-prb)[^"]*"[^>]*>([^<]+)/);

            const pic = picMatch ? picMatch[1].trim() : '';
            const remarks = remarkMatch ? remarkMatch[1].trim() : '';

            videos.push({
                vod_id: id,
                vod_name: name,
                vod_pic: pic,
                vod_remarks: remarks
            });
        }

        let pageCount = parseInt(page);
        const pageMatches = html.match(new RegExp(`/vodshow/${tid}/page/(\\d+)\\.html`, 'g'));
        if (pageMatches) {
            for (let pm of pageMatches) {
                let m = pm.match(/page\/(\d+)\.html/);
                if (m) {
                    let p = parseInt(m[1]);
                    if (p > pageCount) pageCount = p;
                }
            }
        }

        return JSON.stringify({
            page: parseInt(page),
            pagecount: pageCount,
            list: videos
        });
    } catch (e) {
        return JSON.stringify({ page: parseInt(pg || 1), pagecount: 1, list: [] });
    }
}

async function detail(id) {
    try {
        const detailUrl = `${host}/voddetail/${id}.html`;
        const r = await req(detailUrl, { headers });
        const html = r.content || '';

        // Title
        let name = '';
        const nameMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+?)(?:\s*-\s*华视影院)?"/i) || html.match(/<h1>([^<]+)<\/h1>/);
        if (nameMatch) name = nameMatch[1].replace(/- 华视影院$/, '').trim();

        // Poster
        let pic = '';
        const picMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) || html.match(/class="[^"]*gen-movie-img[^"]*"[^>]*data-src="([^"]+)"/);
        if (picMatch) pic = picMatch[1].trim();

        // Description
        let desc = '';
        const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i) || html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
        if (descMatch) desc = descMatch[1].trim();

        // Actor & Director
        let actor = '';
        const actorMatch = html.match(/主演[：:]([\s\S]*?)<\/div>/) || html.match(/主演[：:]([\s\S]*?)<\/p>/);
        if (actorMatch) actor = actorMatch[1].replace(/<[^>]+>/g, '').replace(/#/g, ',').trim();

        let director = '';
        const dirMatch = html.match(/导演[：:]([\s\S]*?)<\/div>/) || html.match(/导演[：:]([\s\S]*?)<\/p>/);
        if (dirMatch) director = dirMatch[1].replace(/<[^>]+>/g, '').trim();

        // Year
        let year = '';
        const yearMatch = html.match(/(\d{4})年/);
        if (yearMatch) year = yearMatch[1];

        // Tabs & Playlist boxes
        let tabs = [];
        const tabMatches = html.match(/<a[^>]*class="swiper-slide"[^>]*>.*?<\/i>&nbsp;([^<]+)<\/a>/g);
        if (tabMatches) {
            for (let t of tabMatches) {
                let tm = t.match(/&nbsp;([^<]+)<\/a>/);
                if (tm) tabs.push(tm[1].trim());
            }
        }
        if (tabs.length === 0) tabs = ['华视影院'];

        let playSources = [];
        let playUrlsList = [];

        const boxPattern = /<ul[^>]*class="anthology-list-play[^"]*"[^>]*>([\s\S]*?)<\/ul>/g;
        let boxMatch;
        let boxIndex = 0;
        while ((boxMatch = boxPattern.exec(html)) !== null) {
            const boxContent = boxMatch[1];
            let epList = [];
            const epPattern = /<a[^>]*href="(\/vodplay\/\d+-\d+-\d+\.html)"[^>]*>([^<]+)<\/a>/g;
            let epMatch;
            while ((epMatch = epPattern.exec(boxContent)) !== null) {
                const epUrl = epMatch[1];
                const epName = epMatch[2].trim();
                epList.push(`${epName}$${epUrl}`);
            }

            if (epList.length > 0) {
                const tabName = tabs[boxIndex] || `播放线路${boxIndex + 1}`;
                playSources.push(tabName);
                playUrlsList.push(epList.join('#'));
            }
            boxIndex++;
        }

        return JSON.stringify({
            list: [{
                vod_id: id,
                vod_name: name,
                vod_pic: pic,
                vod_remarks: year,
                vod_year: year,
                vod_actor: actor,
                vod_director: director,
                vod_content: desc,
                vod_play_from: playSources.join('$$$'),
                vod_play_url: playUrlsList.join('$$$')
            }]
        });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function search(wd, quick, pg = 1) {
    try {
        const searchUrl = `${host}/vodsearch/wd/${encodeURIComponent(wd)}.html`;
        const r = await req(searchUrl, { headers });
        const html = r.content || '';

        let results = [];
        let seen = new Set();

        const pattern = /<a[^>]*class="public-list-exp"[^>]*href="\/voddetail\/(\d+)\.html"[^>]*>([\s\S]*?)<\/a>\s*<\/div>\s*<div[^>]*class="right[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const id = match[1];
            if (seen.has(id)) continue;

            const leftInner = match[2];
            const rightInner = match[3];

            const nameMatch = rightInner.match(/<a[^>]*href="\/voddetail\/\d+\.html"[^>]*>([^<]+)<\/a>/);
            const picMatch = leftInner.match(/data-src="([^"]+)"/) || leftInner.match(/src="([^"]+)"/);
            const remarkMatch = leftInner.match(/class="public-list-prb[^"]*"[^>]*>([^<]+)/);

            const name = nameMatch ? nameMatch[1].trim() : '';
            const pic = picMatch ? picMatch[1].trim() : '';
            const remarks = remarkMatch ? remarkMatch[1].trim() : '';

            if (name) {
                seen.add(id);
                results.push({
                    vod_id: id,
                    vod_name: name,
                    vod_pic: pic,
                    vod_remarks: remarks
                });
            }
        }

        // Fallback to ajax suggest if HTML search returns empty
        if (results.length === 0) {
            const suggestUrl = `${host}/index.php/ajax/suggest?mid=1&wd=${encodeURIComponent(wd)}`;
            const sr = await req(suggestUrl, { headers });
            const sjson = JSON.parse(sr.content || '{}');
            if (sjson && sjson.list && Array.isArray(sjson.list)) {
                for (let item of sjson.list) {
                    if (item.id && item.name) {
                        results.push({
                            vod_id: item.id.toString(),
                            vod_name: item.name,
                            vod_pic: item.pic || '',
                            vod_remarks: ''
                        });
                    }
                }
            }
        }

        return JSON.stringify({ page: parseInt(pg || 1), list: results });
    } catch (e) {
        return JSON.stringify({ page: parseInt(pg || 1), list: [] });
    }
}

async function play(flag, id, flags) {
    try {
        let episodeId = id;
        let epMatch = id.match(/(\d+-\d+-\d+)/);
        if (epMatch) {
            episodeId = epMatch[1];
        }

        const playerUrl = `${host}/Player/ec?episode=${episodeId}`;
        const r = await req(playerUrl, {
            headers: {
                'User-Agent': headers['User-Agent'],
                'Referer': `${host}/vodplay/${episodeId}.html`
            }
        });

        const html = r.content || '';

        // Extract mt token
        const mtMatch = html.match(/"mt":\s*"([^"]+)"/);
        if (!mtMatch) {
            // Check if there is an inline direct stream url
            const inlineMatch = html.match(/"url":\s*"([^"]+)"/);
            if (inlineMatch && inlineMatch[1] && inlineMatch[1].startsWith('http')) {
                return JSON.stringify({
                    parse: 0,
                    url: inlineMatch[1],
                    header: {
                        'User-Agent': headers['User-Agent'],
                        'Referer': `${host}/`
                    }
                });
            }
            return JSON.stringify({ parse: 0, url: '' });
        }

        const mt = mtMatch[1];
        const adMatch = html.match(/"ad_duration_ms":\s*"?(\d+)"?/);
        const adMs = adMatch ? parseInt(adMatch[1]) : 22000;
        const initialDelayMs = adMs > 0 ? Math.max(0, adMs - 2000) : 0;

        // The site's backend enforces a ~20s delay before granting the stream link
        if (initialDelayMs > 0) {
            await sleep(initialDelayMs);
        }

        let playUrl = '';
        const maxTries = 4;
        for (let i = 0; i < maxTries; i++) {
            const resolveRes = await req(`${host}/Player/resolveUrl`, {
                method: 'post',
                postType: 'form',
                data: { token: mt },
                body: `token=${encodeURIComponent(mt)}`,
                headers: {
                    'User-Agent': headers['User-Agent'],
                    'Referer': playerUrl,
                    'Origin': host,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            try {
                const resJson = JSON.parse(resolveRes.content || '{}');
                if (resJson && resJson.code === 1 && resJson.data && resJson.data.url) {
                    playUrl = resJson.data.url;
                    break;
                }
            } catch (e) {}

            if (i < maxTries - 1) {
                await sleep(2000);
            }
        }

        if (!playUrl) {
            return JSON.stringify({ parse: 0, url: '' });
        }

        return JSON.stringify({
            parse: 0,
            url: playUrl,
            header: {
                'User-Agent': headers['User-Agent'],
                'Referer': `${host}/`
            }
        });
    } catch (e) {
        return JSON.stringify({ parse: 0, url: '' });
    }
}

export default { init, home, homeVod, category, detail, search, play };
