import re
import json
import hashlib
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
merged_path = os.path.join(SCRIPT_DIR, "merged_channels.txt")
worker_path = os.path.join(SCRIPT_DIR, "cloudflare_worker_unified.js")
playlist_path = os.path.join(SCRIPT_DIR, "playlist.txt")
valid_path = os.path.join(SCRIPT_DIR, "valid_channels.txt")
playlist_pure_path = os.path.join(SCRIPT_DIR, "playlist_pure.txt")
live_path = os.path.join(SCRIPT_DIR, "live.txt")
live2_path = os.path.join(SCRIPT_DIR, "live2.txt")
live3_path = os.path.join(SCRIPT_DIR, "live3.txt")

from collections import defaultdict

category_order = [
    "央视频道",
    "卫视频道",
    "港澳台",
    "影视剧场",
    "少儿卡通",
    "纪实探索",
    "体育频道",
    "教育频道",
    "国际华语",
    "浙江频道",
    "黑龙江频道",
    "广东频道",
    "江苏频道",
    "地方综合台",
    "美国主流台",
    "美国地方台",
    "国际频道",
    "多语种国际台",
    "最新电影"
]

def clean_channel_name(name):
    n = name.strip()
    # Strip emojis and symbols
    n = re.sub(r"[\U00010000-\U0010ffff]", "", n)
    n = re.sub(r"[\u2600-\u27bf\u2300-\u23ff\u2b50\u2b55\u200d\ufe0f]", "", n)
    # Strip line markers at the end before replacing underscores
    n = re.sub(r"_\d+$", "", n)
    n = re.sub(r"[\(\[]\d+[\)\]]$", "", n)
    n = re.sub(r"[\s_]*(?:线路|源|line|src)\s*\d+$", "", n, flags=re.I)
    # Replace underscores with spaces
    n = n.replace("_", " ")
    # Remove resolution tags (preserve CCTV-4K and CCTV-8K)
    n = re.sub(r"(?i)[\[\(]?(?:1080[pi]?|720[pi]?|(?<!cctv-)4k|(?<!cctv-)8k|fhd)[\]\)]?", "", n)
    # Remove trailing HD/SD tag
    n = re.sub(r"(?i)\s+[-_]?\s*(?:HD|SD)\s*$", "", n)
    # Clean redundant whitespace
    n = re.sub(r"\s+", " ", n).strip()
    # Traditional to simplified mapping for key satellite channels
    if n in ["湖南衛視", "湖南卫视 HD", "湖南卫视 1080P", "湖南卫视1080P"]:
        n = "湖南卫视"
    return n

def clean_category(cat, name, url=""):
    cat = cat.strip()
    name = name.strip()
    name_lower = name.lower()
    url_lower = url.lower() if url else ""
    
    # 1. CCTV/pay-TV channels
    is_cctv = "cctv" in name_lower or "央视" in name or "风云" in name or "怀旧" in name or "兵器" in name or "世界地理" in name or "--服务器" in name_lower
    if is_cctv:
        return "央视频道"

    # 2. Weather channels (MUST NOT be Sports!)
    if any(x in name_lower for x in ["weather", "accuweather"]):
        if any(x in name_lower for x in ["fox weather", "the weather channel", "weathernation", "accuweather"]):
            return "美国主流台"
        return "国际频道"

    # 3. International Chinese (Singapore, Overseas Chinese)
    is_chinese_intl = any(x in name for x in ["新傳媒", "新传媒", "CNA", "ABN華語", "看中國", "中國旅遊", "金磚電視", "美國之音中文"])
    if is_chinese_intl or cat == "国际华语":
        return "国际华语"

    # 4. Satellite check (mainland satellite stations)
    if "卫视" in name or "衛視" in name or cat in ["地方卫视", "卫视频道"] or name in ["看东方", "海峡卫视"]:
        if not any(x in name for x in ["澳门莲花卫视", "澳門蓮花衛視", "香港卫视", "TVBS", "凤凰"]):
            return "卫视频道"

    # 5. HK / Macau / Taiwan Broadcasters (check before Sports to rescue 凤凰香港, 莲花电影, ViuTV, 天映)
    if any(x in name for x in ["纬来体育", "緯來體育", "爱尔达体育", "愛爾達體育"]):
        return "体育频道"
    is_hk_now = bool(re.search(r'(^|\b)now\s*(tv|新闻|财经|剧集|华剧|宽频|爆谷|直播|\d{2,3})', name_lower))
    hk_tw_keywords = [
        "tvb", "翡翠", "明珠", "无线", "hoy", "viu", "rthk", "千禧", "星河", 
        "中天", "tvbs", "寰宇", "台视", "中视", "华视", "东森", "三立", "民视", 
        "台湾", "客家", "凤凰", "astro", "澳视", "澳視", "莲花", "澳門", "澳门", 
        "公视", "原住民族", "原视", "天映", "龙华", "美亞", "美亚", "亞洲劇台", 
        "信大", "环球电视台", "axn台灣", "axn", "cgn中文", "新唐人", "dali tv", "good tv", 
        "bltv", "taiwan", "人間衛視", "好消息", "大立電視", "纬来", "緯來"
    ]
    is_hk_tw = is_hk_now or any(x in name_lower for x in hk_tw_keywords)
    is_foreign_english = any(x in name_lower for x in ["pet club", "supreme master", "pluto", "electric", "now_90", "true crime"])
    if (is_hk_tw or cat in ["澳门频道", "港台", "港台频道", "港澳台"]) and not is_foreign_english:
        return "港澳台"

    # 6. Kids & Animation (少儿卡通)
    kids_keywords = [
        "少儿", "卡通", "动画", "动漫", "卡酷", "炫动", "金鹰卡通", "哈哈炫动", "优漫卡通",
        "kids", "cartoon", "animation", "anime", "toon", "disney", "nick", "nickelodeon",
        "boomerang", "baby", "ducktv", "junior", "happy kids", "children"
    ]
    if any(x in name_lower for x in kids_keywords) or any(x in cat.lower() for x in ["少儿", "卡通", "动画", "动漫", "kids", "cartoon"]):
        return "少儿卡通"

    # 7. Documentary & Science (纪实探索)
    doc_keywords = [
        "纪录", "记录", "纪实", "探索", "发现", "之江纪录", "地理", "历史",
        "docu", "documentary", "discovery", "history", "nat geo", "national geographic",
        "animal planet", "science", "nature", "curiosity", "wild", "planet", "smithsonian"
    ]
    if any(x in name_lower for x in doc_keywords) or any(x in cat.lower() for x in ["纪录", "记录", "纪实", "探索", "discovery", "documentary"]):
        return "纪实探索"

    # 8. Education & Culture (教育频道)
    edu_keywords = [
        "教育", "科教", "课堂", "cetv", "中小学", "空中课堂", "高考", "招考",
        "戏曲", "梨园", "曲艺", "文物宝库", "国学", "书画", "文化"
    ]
    if any(x in name_lower for x in edu_keywords) or any(x in cat.lower() for x in ["教育", "科教", "课堂", "cetv"]):
        return "教育频道"

    # 9. Provincial mainland categories & channels
    major_provinces = {
        "浙江": "浙江频道",
        "黑龙江": "黑龙江频道",
        "广东": "广东频道",
        "江苏": "江苏频道",
        "湖南": "湖南频道",
        "北京": "北京频道",
        "上海": "上海频道",
        "四川": "四川频道"
    }
    jiangsu_cities = ["苏州", "无锡", "常州", "南通", "扬州", "镇江", "泰州", "宿迁", "淮安", "盐城", "连云港", "徐州"]
    if any(city in name for city in jiangsu_cities) or any(city in cat for city in jiangsu_cities):
        return "江苏频道"

    provincial_prefixes = [
        "浙江", "江苏", "江西", "广东", "广西", "福建", "河北", "湖北", 
        "吉林", "内蒙古", "黑龙江", "甘肃", "山东", "陕西", "四川", "青海", 
        "新疆", "上海", "湖南", "北京", "河南", "贵州", "山西", "大庆", 
        "逊克", "乌海", "乌兰察布", "锡林郭勒", "每日经济新闻", "兵团", "海南", "辽宁", "云南", "西藏", "天津", "重庆"
    ]
    if name in ["广东体育", "五星体育", "五星体育HD"]:
        return "体育频道"
    for mp, target_cat in major_provinces.items():
        if name.startswith(mp) or cat.startswith(mp):
            return target_cat

    is_provincial_name = any(name.startswith(p) for p in provincial_prefixes)
    is_provincial_cat = any(cat.startswith(p) for p in provincial_prefixes) or cat in ["更多地方频道", "地方频道", "其他地方台", "地方综合台", "吉林&内蒙古", "黑龙江&甘肃", "福建&广东&广西", "贵州&四川", "山东&西安"]
    if is_provincial_name or is_provincial_cat:
        return "地方综合台"

    # 10. Sports
    sports_keywords = [
        "足球", "台球", "体育", "sport", "sports", "combat", "kickboxing", 
        "billiards", "fight", "espn", "dazn", "fite", "fanduel", "billiard", 
        "lacrosse", "eurosport", "stadium", "sportsgrid", "poker", "golf", 
        "tennis", "racing", "boxing", "wrestling", "fifa", "nhra", "acc network", 
        "bein", "draftkings", "golazo", "pac-12", "red bull tv", "rally tv", 
        "slopes tv", "speed sport"
    ]
    is_sports_acronym = bool(re.search(r'\b(nfl|nba|mlb|nhl|mma|ufc)\b', name_lower))
    is_sports_name = is_sports_acronym or any(x in name_lower for x in sports_keywords)
    is_sports_cat = "体育" in cat or "sports" in cat.lower() or cat == "体育频道"
    if is_sports_name or is_sports_cat:
        if not ("cctv-5" in name_lower or "cctv5" in name_lower):
            return "体育频道"

    # 11. US Major Networks / News / Weather / Finance
    us_major_keywords = [
        "abc news", "cbs news", "nbc news", "livenow from fox", "fox live now", "fox news", "fox weather",
        "bloomberg", "cnbc", "newsmax", "scripps news", "weathernation", "accuweather", "court tv",
        "cheddar", "nasa tv", "c-span", "cspan", "america's voice", "america teve", "buzzr", "pbs news", "accuweathernow"
    ]
    if any(k in name_lower for k in us_major_keywords):
        return "美国主流台"

    # 12. Western Movies / Series / Entertainment (影视剧场)
    movie_keywords = [
        "chc", "电影", "影院", "剧场", "movie", "movies", "cinema", "film", "series", "filmrise", "cinevault", "retro tv", 
        "drybar", "comedy", "thriller", "drama", "action", "sci-fi", "horror", "crime", 
        "mystery", "western", "electric now", "true crime now", "重温经典", "猫和老鼠"
    ]
    if any(k in name_lower for k in movie_keywords) or cat in ["电影经典", "影视经典", "欧美影视", "影视剧场"]:
        return "影视剧场"

    # 13. US Local Affiliates
    if re.match(r'^(abc|cbs|nbc|fox|cw|pbs)\s+[a-z0-9\-]+', name_lower) or any(x in name_lower for x in ["channel 1", "channel 2", "channel 3", "channel 4", "channel 5", "channel 6", "channel 7", "channel 8", "channel 9", "channel 10", "channel 11", "channel 12", "channel 13"]):
        return "美国地方台"
    if "stvp-us" in url_lower or "wsoc now" in name_lower or "wcetv" in name_lower or "rightnow" in name_lower or any(x in name_lower for x in ["bek", "bke"]):
        return "美国地方台"

    # 14. Multilingual International (Korean, Spanish, French, German, Italian, Hindi)
    if re.search(r'[\uac00-\ud7a3]', name) or "stvp-kr" in url_lower:
        return "多语种国际台"
    if any(x in url_lower for x in ["stvp-es", "stvp-mx"]) or re.search(r'[áéíóúñ¿¡]', name):
        return "多语种国际台"
    if "stvp-fr" in url_lower or re.search(r'[àâçèéêëîïôûùüÿœ]', name):
        return "多语种国际台"
    if "stvp-de" in url_lower or "stvp-at" in url_lower or "stvp-ch" in url_lower or re.search(r'[äöüß]', name):
        return "多语种国际台"
    if "stvp-it" in url_lower or name in ["WXTV", "WXTV-DT1"]:
        return "多语种国际台"
    if "stvp-in" in url_lower or any(x in name_lower for x in ["aaj tak", "abp news", "zee", "9x ", "ndtv", "rtm malaysia", "sbt brazil"]):
        return "多语种国际台"

    # 15. Latest Movies
    if cat in ["最新电影", "影视点播"]:
        return "最新电影"

    # 16. Fallback: International English
    if cat in ["English合集", "电影频道 (英文)", "电视剧频道 (英文)", "动漫卡通频道 (英文)", "记录频道", "户外旅行频道 (英文)", "新闻频道 (英文)", "北美频道", "国际频道"] or is_foreign_english or "his glory" in name_lower:
        return "国际频道"

    if name == "直播中国":
        return "地方综合台"
    if any("\u4e00" <= ch <= "\u9fff" for ch in name):
        return "地方综合台"
    return "国际频道"

def get_category_index(cat):
    try:
        return category_order.index(cat)
    except ValueError:
        return len(category_order)

def cctv_sort_key(name):
    if "4k" in name.lower():
        return (0, 998, 0, name)
    if "8k" in name.lower():
        return (0, 999, 0, name)
    match = re.search(r'cctv[-]?(\d+)(\+)?', name.lower())
    if match:
        num = int(match.group(1))
        has_plus = 1 if match.group(2) else 0
        return (0, num, has_plus, name)
    return (1, 0, 0, name)

def main():
    channels = []
    stream_counts = defaultdict(int)
    with open(merged_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or "|" not in line:
                continue
            parts = line.split("|")
            if len(parts) < 3:
                continue
            category = parts[0].strip()
            raw_name = parts[1].strip()
            url = parts[2].strip()
            
            # Filter out adware restreamer, ad networks, and looping test streams
            if any(k in url.lower() for k in ["107.150.60.122", "lantian/channel001", "198.204.228.26", "appadhw", "tvzb", "47.97.252.137", "3y1.xyz", "nosignal", "epg.pw/stream", "applive", "cnlive.club", "sailei", "dpdns.org"]):
                continue
            if any(k in raw_name for k in ["支持作者", "关注公众号", "防失联", "微信", "更新时间"]):
                continue
            if url.lower().endswith(".mp4") and "春晚" not in raw_name and "电影" not in raw_name and category not in ["最新电影", "春晚"]:
                continue
            
            # Normalize CCTV names (CCTV-1 to CCTV-17, CCTV-4K, CCTV-8K, including CCTV-5+ and CCTV-16)
            name_lower = raw_name.lower()
            # Strip emojis / non-alphanumeric prefixes to match CCTV names correctly
            clean_name_match = re.sub(r'^[^\w\s\-]+', '', name_lower).strip()
            cctv_match = re.search(r'(cctv[-]?\d+)', clean_name_match)
            if "cctv-4k" in name_lower or "cctv4k" in name_lower:
                name = "CCTV-4K"
            elif "cctv-8k" in name_lower or "cctv8k" in name_lower:
                name = "CCTV-8K"
            elif cctv_match:
                cctv_base = cctv_match.group(1).upper()
                # Ensure standard format (e.g. CCTV-5 instead of CCTV5)
                if not cctv_base.startswith("CCTV-"):
                    cctv_base = "CCTV-" + cctv_base[4:]
                
                if "cctv-5+" in name_lower or "cctv5+" in name_lower or ("cctv5" in name_lower and "+" in raw_name):
                    name = "CCTV-5+体育赛事"
                elif cctv_base == "CCTV-5":
                    name = "CCTV-5体育"
                elif cctv_base == "CCTV-16":
                    name = "CCTV-16奥林匹克"
                else:
                    name = cctv_base
            else:
                name = clean_channel_name(raw_name)
            
            # Normalize Singapore, Macau and regional channels to standard Chinese names
            sg_mo_map = {
                'CH8': '新傳媒8頻道',
                'Channel 8': '新傳媒8頻道',
                'CHU': '新傳媒U頻道',
                'CHANNEL U': '新傳媒U頻道',
                'CH5': '新傳媒5頻道',
                'CHANNEL 5': '新傳媒5頻道',
                'CNA': 'CNA亞洲新聞台',
                '澳门莲花': '澳門蓮花衛視',
                'Lotus TV': '澳門蓮花衛視',
                '澳门体育': '澳視體育',
                '澳门综艺': '澳視綜藝',
                '澳门资讯': '澳視資訊',
                '澳门咨询': '澳視資訊',
                '澳视澳门': '澳視澳門',
                '澳视卫星': '澳門衛星頻道',
                '澳门Macau': '澳視澳門',
                'Beautiful Life TV': '人間衛視 BLTV',
                'Good': 'GOOD TV 好消息 1台',
                'Good 2': 'GOOD TV 好消息 2台',
                'Dali TV': '大立電視'
            }
            stripped_prefix = re.sub(r'^[^\w\s\-]+', '', name).strip()
            if stripped_prefix in sg_mo_map:
                name = sg_mo_map[stripped_prefix]
            elif name in sg_mo_map:
                name = sg_mo_map[name]
                
            cleaned_cat = clean_category(category, name, url)
            
            channels.append({
                "category": cleaned_cat,
                "name": name,
                "raw_name": raw_name,
                "url": url
            })
            
            # Cross-listing: CCTV-14 to 少儿卡通, CCTV-9 to 纪实探索
            if name == "CCTV-14":
                channels.append({
                    "category": "少儿卡通",
                    "name": "CCTV-14少儿",
                    "raw_name": raw_name,
                    "url": url
                })
            elif name == "CCTV-9":
                channels.append({
                    "category": "纪实探索",
                    "name": "CCTV-9纪录",
                    "raw_name": raw_name,
                    "url": url
                })
            
    # Prioritize higher quality streams for each channel before key assignment and capping
    from collections import OrderedDict
    name_groups = OrderedDict()
    for c in channels:
        name_groups.setdefault((c["category"], c["name"]), []).append(c)

    def stream_quality_score(c):
        score = 0
        u_lower = c["url"].lower()
        raw_lower = c.get("raw_name", "").lower()
        combined = f"{raw_lower} {u_lower}"

        # 1. 分辨率 / 画质基准分 (Resolution / Codec)
        # 4K / 8K 超高清
        if any(k in combined for k in ["4k", "8k", "2160p", "uhd"]):
            score += 25
        # 1080P 全高清
        elif any(k in combined for k in ["1080p", "1080", "fhd", "超清"]):
            score += 18
        # 720P 高清
        elif any(k in combined for k in ["720p", "720", "hd", "高清"]):
            score += 10
        # 576P / 480P / 标清
        elif any(k in combined for k in ["576", "480", "sd", "标清"]):
            score -= 6

        # 2. 稳定性与长效直连加分 (Stability Bonus - 确保主力源 Line 1 为永久无 Token / 长效专线)
        # 广播级专网 GSLB 直链 (永不超时、50fps高码率稳定)
        if any(k in u_lower for k in ["gslb/zbdq", "gslb/dsdq", "gslb/"]):
            score += 40
        # 永久固定端口直连 (纯净专线，无任何短期 Token)
        elif any(k in u_lower for k in [":8181/3m1080p", ":8181/1080p", ":82/live/"]):
            score += 35
        elif ":8181/720p" in u_lower:
            score += 28
        # 官方直连 / 自建稳定中转代理
        elif any(k in u_lower for k in ["jdshipin.com", "cztv.com/live", "kylintv", "skygo.mn", "bestv.cn", "mgtv.com"]):
            score += 30
        # 电信/移动专网 IPTV 且无短期动态参数
        elif "chinamobile" in u_lower or "unicom" in u_lower:
            score += 25
        # 没有任何 query 参数的纯净 m3u8 直链（天然无 Token，永不过期）
        elif "?" not in u_lower and not any(k in u_lower for k in ["cctvnews.cctv.com", "newlive", "wd_r2"]):
            score += 20

        # 3. 短效动态 Token 严重降权 (Demote to Line 3/4/5 Backup Lines)
        # 央视新闻客户端 App 抓取动态 HLS (Token 有效期 30~60 分钟)
        if "cctvnews.cctv.com" in u_lower:
            score -= 60
        # 咪咕移动端临时切片 (Token 极短)
        if "wd_r2/cctv" in u_lower:
            score -= 60
        # 酒店/私网动态切片 (易会话超时)
        if "newlive" in u_lower:
            score -= 50
        # 带有动态过期时间戳/防盗链特征参数
        if "wssecret=" in u_lower or "wstime=" in u_lower:
            score -= 50
        if any(k in u_lower for k in ["auth_key=", "sign=", "token="]) and not any(k in u_lower for k in ["auth=test", "key=txiptv"]):
            score -= 30

        # 已知低码率压缩转码源 (如 800x600 的 kankanlive)
        if "kankanlive" in u_lower:
            score -= 10

        return score

    sorted_channels = []
    for cat_name, grp in name_groups.items():
        # Deduplicate identical or case-insensitive duplicate URLs within the same channel
        seen_urls = set()
        dedup_grp = []
        for x in grp:
            norm_u = x["url"].strip().lower()
            if norm_u not in seen_urls:
                seen_urls.add(norm_u)
                dedup_grp.append(x)
        # Sort descending by stream quality score
        dedup_grp.sort(key=lambda x: stream_quality_score(x), reverse=True)
        # Cap at max 5 highest-quality lines per channel
        sorted_channels.extend(dedup_grp[:5])
    channels = sorted_channels

    # Assign unique keys for duplicate names in quality-sorted order
    used_names = {}
    for c in channels:
        name = c["name"]
        if name not in used_names:
            used_names[name] = 0
            key = name
        else:
            used_names[name] += 1
            key = f"{name}_{used_names[name]}"
        c["key"] = key

    def get_key_suffix_num(key):
        if "_" in key:
            parts = key.rsplit("_", 1)
            if parts[-1].isdigit():
                return int(parts[-1])
        return 0

    # Sort channels: 
    # 1. By category order in category_order
    # 2. Within category:
    #    - If CCTV, numerically by CCTV number
    #    - High priority channels first (CCTV-14 in 少儿, CCTV-9 in 纪实, CETV in 教育, NBA in 体育)
    #    - Chinese channels first, then English/foreign
    #    - Alphabetically by name, and then by url to be stable
    def sort_key(c):
        cat_idx = get_category_index(c["category"])
        is_cctv_cat = "cctv" in c["category"].lower() or "央视" in c["category"]
        suffix_num = get_key_suffix_num(c["key"])
        if is_cctv_cat:
            return (cat_idx, cctv_sort_key(c["name"]), suffix_num, c["url"])
        else:
            cat = c["category"]
            n = c["name"]
            n_lower = n.lower()
            
            prio = 0
            if cat == "影视剧场":
                if n.upper().startswith("CHC") or "chc电影" in n_lower:
                    prio = -3
                elif any(k in n for k in ["重温经典", "电影", "影院"]):
                    prio = -2
            elif cat == "少儿卡通":
                if any(k in n for k in ["CCTV-14", "金鹰卡通", "卡酷", "优漫", "炫动"]):
                    prio = -3
                elif any(k in n_lower for k in ["迪士尼", "尼克", "cartoon", "animax"]):
                    prio = -2
            elif cat == "纪实探索":
                if any(k in n for k in ["CCTV-9", "探索", "国家地理", "动物星球", "历史"]):
                    prio = -3
                elif any(k in n_lower for k in ["discovery", "nat geo", "animal planet", "history"]):
                    prio = -2
            elif cat == "教育频道":
                if n.startswith("CETV"):
                    prio = -3
                elif n.startswith("CCTV"):
                    prio = -2
            elif cat == "体育频道":
                if any(k in n_lower for k in ["爱尔达", "緯來", "纬来", "nba", "cctv"]):
                    prio = -3
                
            is_ascii = bool(n and n[0].isascii())
            return (cat_idx, prio, is_ascii, (n_lower, n), suffix_num, c["url"])
            
    channels.sort(key=sort_key)
    channels_with_keys = channels
    print(f"Assigned unique keys for {len(channels_with_keys)} channels.")
    
    # 1. Write to valid_channels.txt
    with open(valid_path, "w", encoding="utf-8") as f:
        for c in channels_with_keys:
            f.write(f"{c['name']}, {c['url']}\n")
    print(f"Updated {valid_path}")
            
    # Load YueChan URLs to bypass Cloudflare
    yuechan_urls_file = os.path.join(SCRIPT_DIR, "yuechan_urls.txt")
    yuechan_urls = set()
    if os.path.exists(yuechan_urls_file):
        with open(yuechan_urls_file, "r", encoding="utf-8") as f:
            for line in f:
                u = line.strip().lower()
                if u:
                    yuechan_urls.add(u)

    # 2. Write to playlist.txt & live3.txt (All-inclusive playlist)
    domain = "round-snowflake-2d83.linda11-28-2022.workers.dev"
    playlist_lines = []
    current_cat = None
    for c in channels_with_keys:
        if c["category"] != current_cat:
            current_cat = c["category"]
            playlist_lines.append(f"{current_cat},#genre#")
            
        url_lower = c["url"].lower()
        is_movie = c["category"] in ["最新电影", "影视点播"]
        # Direct links for YouTube, YueChan, or Movies
        if "youtube.com" in url_lower or "youtu.be" in url_lower or url_lower in yuechan_urls or is_movie:
            playlist_lines.append(f"{c['name']},{c['url']}")
        else:
            playlist_lines.append(f"{c['name']},https://{domain}/live/{c['key']}/index.m3u8")
        
    playlist_content = "\n".join(playlist_lines) + "\n"
    with open(playlist_path, "w", encoding="utf-8") as f:
        f.write(playlist_content)
    with open(live3_path, "w", encoding="utf-8") as f:
        f.write(playlist_content)
    print(f"Updated {playlist_path} and {live3_path}")
    
    # 2.1 Write to playlist_pure.txt, live.txt & live2.txt (Pure playlist: No YouTube, Includes Direct TV & Worker TV)
    playlist_pure_lines = []
    current_cat_pure = None
    for c in channels_with_keys:
        url_lower = c["url"].lower()
        if "youtube.com" in url_lower or "youtu.be" in url_lower:
            continue
        if c["category"] != current_cat_pure:
            current_cat_pure = c["category"]
            playlist_pure_lines.append(f"{current_cat_pure},#genre#")
        
        is_movie = c["category"] in ["最新电影", "影视点播"]
        if is_movie or url_lower in yuechan_urls:
            playlist_pure_lines.append(f"{c['name']},{c['url']}")
        else:
            playlist_pure_lines.append(f"{c['name']},https://{domain}/live/{c['key']}/index.m3u8")
        
    playlist_pure_content = "\n".join(playlist_pure_lines) + "\n"
    with open(playlist_pure_path, "w", encoding="utf-8") as f:
        f.write(playlist_pure_content)
    with open(live_path, "w", encoding="utf-8") as f:
        f.write(playlist_pure_content)
    with open(live2_path, "w", encoding="utf-8") as f:
        f.write(playlist_pure_content)
    print(f"Updated {playlist_pure_path}, {live_path} and {live2_path}")
    
    # 3. Write to cloudflare_worker_unified.js
    # Build CHANNEL_MAP javascript object string
    map_lines = []
    for c in channels_with_keys:
        url_lower = c["url"].lower()
        is_movie = c["category"] in ["最新电影", "影视点播"]
        # Skip YouTube, YueChan, and Movies in the Worker CHANNEL_MAP
        if "youtube.com" in url_lower or "youtu.be" in url_lower or url_lower in yuechan_urls or is_movie:
            continue
        escaped_key = json.dumps(c["key"], ensure_ascii=False)
        escaped_url = json.dumps(c["url"], ensure_ascii=False)
        map_lines.append(f"  {escaped_key}: {escaped_url},")
        
    map_str = "\n".join(map_lines)
    
    worker_template = f"""/**
 * Cloudflare Worker - 多频道统一 HLS 重写/代理服务 (全直连重定向版)
 * 
 * 访问格式：
 *   https://[你的Worker域名]/live/[频道名称]/index.m3u8
 *   例如：https://tvb-proxy.username.workers.dev/live/翡翠台/index.m3u8
 */

// {len(channels_with_keys)}个有效电视频道映射表
const CHANNEL_MAP = {{
{map_str}
}};

export default {{
  async fetch(request, env, ctx) {{
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').map(segment => decodeURIComponent(segment));
    
    // 期望的路由路径结构是：/live/[频道名称]/index.m3u8
    if (pathSegments.length < 4 || pathSegments[1] !== 'live') {{
      return new Response('欢迎使用统一电视直播代理服务。使用格式：/live/[频道名称]/index.m3u8', {{
        status: 200,
        headers: {{ 'Content-Type': 'text/plain; charset=utf-8' }}
      }});
    }}

    const channelName = pathSegments[2];
    const requestedFile = pathSegments.slice(3).join('/');

    // 1. 从映射表中查找该频道真实的 URL
    const channelUrl = CHANNEL_MAP[channelName];
    if (!channelUrl) {{
      return new Response(`未找到频道: ${{channelName}}`, {{ status: 404 }});
    }}

    // 2. 计算当前请求在原站对应的完整真实 URL
    let targetUrl = "";
    const queryUrl = url.searchParams.get('_url');
    const queryHost = url.searchParams.get('_host');
    
    if (queryUrl) {{
      targetUrl = queryUrl;
    }} else if (queryHost) {{
      targetUrl = new URL(requestedFile, queryHost).toString();
    }} else {{
      targetUrl = getTargetUrl(channelUrl, requestedFile, url.search);
    }}

    // 3. 只在请求主播放列表（即点击播放的瞬间）打印一次日志记录
    if (requestedFile === 'index.m3u8' || requestedFile === '') {{
      const clientIP = request.headers.get('CF-Connecting-IP') || '未知IP';
      console.log(`[播放日志] 客户端IP: ${{clientIP}} 正在启动播放频道: ${{channelName}}`);
    }}

    // 4. 【核心直连优化】：
    // 为了防止电视盒子（如 Android TV / Apple TV）因安全策略拦截 HTTPS 到 HTTP 的跨协议跳转（Mixed Content）
    // 或者因防火墙屏蔽非标准端口，对这些不安全或非标准端口的视频源采用【代理反代模式】；
    // 对于常规的标准端口 HTTPS 视频源，采用最节省资源的【302 重定向模式】。
    try {{
      const targetUrlObj = new URL(targetUrl);
      const isHttp = targetUrlObj.protocol === "http:";
      const hasNonStandardPort = targetUrlObj.port && targetUrlObj.port !== "" && targetUrlObj.port !== "80" && targetUrlObj.port !== "443";
      
      if (isHttp || hasNonStandardPort) {{
        let currentUrl = targetUrl;
        let targetResponse = null;
        let redirectCount = 0;
        
        while (redirectCount < 5) {{
          const ipMatch = currentUrl.match(/\\/\\/([0-9]{{1,3}}\\.[0-9]{{1,3}}\\.[0-9]{{1,3}}\\.[0-9]{{1,3}})(:\\d+)?/);
          if (ipMatch) {{
            const ip = ipMatch[1];
            currentUrl = currentUrl.replace(ip, ip + ".nip.io");
          }}
          
          targetResponse = await fetch(currentUrl, {{
            headers: {{
              'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0',
              'Accept': '*/*'
            }},
            method: request.method,
            redirect: 'manual'
          }});
          
          if ([301, 302, 303, 307, 308].includes(targetResponse.status)) {{
            const redirectUrl = targetResponse.headers.get('location');
            if (redirectUrl) {{
              currentUrl = new URL(redirectUrl, currentUrl).toString();
              redirectCount++;
              continue;
            }}
          }}
          break;
        }}
        
        if (!targetResponse || !targetResponse.ok) {{
          return Response.redirect(targetUrl, 302);
        }}
        
        // 动态改写 M3U8 播放列表内容，将相对 TS 切片路径转换为走代理的绝对路径
        let bodyText = await targetResponse.text();
        if (bodyText.includes("#EXTM3U")) {{
          const finalBaseUrl = getBaseUrl(currentUrl);
          const lines = bodyText.split('\\n');
          const rewrittenLines = lines.map(line => {{
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {{
              if (trimmed.startsWith('http')) {{
                return `https://${{url.host}}/live/${{encodeURIComponent(channelName)}}/ts_segment?_url=${{encodeURIComponent(trimmed)}}`;
              }} else {{
                return `https://${{url.host}}/live/${{encodeURIComponent(channelName)}}/${{trimmed}}?_host=${{encodeURIComponent(finalBaseUrl)}}`;
              }}
            }}
            return line;
          }});
          bodyText = rewrittenLines.join('\\n');
          
          const responseHeaders = new Headers(targetResponse.headers);
          responseHeaders.set("Access-Control-Allow-Origin", "*");
          responseHeaders.set("Content-Type", "application/vnd.apple.mpegurl");
          
          return new Response(bodyText, {{
            status: targetResponse.status,
            statusText: targetResponse.statusText,
            headers: responseHeaders
          }});
        }}
        
        const responseHeaders = new Headers(targetResponse.headers);
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        
        return new Response(targetResponse.body, {{
          status: targetResponse.status,
          statusText: targetResponse.statusText,
          headers: responseHeaders
        }});
      }}
    }} catch (err) {{
      // 容错处理：如果 URL 解析出错，走常规 302
    }}

    return Response.redirect(targetUrl, 302);
  }}
}};

// 辅助函数：根据原站的 URL 结构计算其基础目录路径
function getBaseUrl(url) {{
  if (url.endsWith('/')) {{
    return url;
  }}
  const lastSlash = url.lastIndexOf('/');
  return url.substring(0, lastSlash + 1);
}}

// 辅助函数：计算请求在原站对应的完整真实 URL
function getTargetUrl(channelUrl, requestedFile, searchParams) {{
  if (!requestedFile || requestedFile === 'index.m3u8') {{
    return channelUrl;
  }}
  const base = getBaseUrl(channelUrl);
  return base + requestedFile + searchParams;
}}
"""
    
    with open(worker_path, "w", encoding="utf-8") as f:
        f.write(worker_template)
    print(f"Updated {worker_path}")

if __name__ == "__main__":
    main()
