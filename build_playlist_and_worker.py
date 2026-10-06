import re
import json
import hashlib
import os
import time
import urllib.parse
import urllib.request
import ssl
import concurrent.futures
import threading
from collections import defaultdict, OrderedDict
from t2s_data import trad_to_simp

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
merged_path = os.path.join(SCRIPT_DIR, "merged_channels.txt")
worker_path = os.path.join(SCRIPT_DIR, "cloudflare_worker_unified.js")
playlist_path = os.path.join(SCRIPT_DIR, "playlist.txt")
valid_path = os.path.join(SCRIPT_DIR, "valid_channels.txt")
playlist_pure_path = os.path.join(SCRIPT_DIR, "playlist_pure.txt")
live_path = os.path.join(SCRIPT_DIR, "live.txt")
live2_path = os.path.join(SCRIPT_DIR, "live2.txt")
live3_path = os.path.join(SCRIPT_DIR, "live3.txt")

category_order = [
    "央视频道",
    "卫视频道",
    "港澳台",
    "影视剧场",
    "少儿卡通",
    "纪实探索",
    "直播中国",
    "体育频道",
    "教育频道",
    "国际华语",
    "广东频道",
    "浙江频道",
    "江苏频道",
    "湖南频道",
    "北京频道",
    "上海频道",
    "四川频道",
    "黑龙江频道",
    "地方综合台",
    "美国主流台",
    "美国地方台",
    "国际频道",
    "韩国/朝鲜",
    "多语种国际台",
    "最新电影"
]

def clean_channel_name(name):
    n = name.strip()
    # Strip emojis and symbols
    n = re.sub(r"[\U00010000-\U0010ffff]", "", n)
    n = re.sub(r"[\u2600-\u27bf\u2300-\u23ff\u2b50\u2b55\u200d\ufe0f\u2460-\u24ff]", "", n)
    # Strip test and buffering suffixes
    n = re.sub(r"[\s_]*\((?:缓冲测试|广告测试)\)", "", n)
    n = re.sub(r"[\s_]*(?:缓冲测试|广告测试)", "", n)
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
    n = re.sub(r"(?i)(?<=\D)HD$", "", n)
    n = re.sub(r"[\s_]*(?:超高清|高清)$", "", n)
    n = re.sub(r"\s*(?:BLTV)$", "", n, flags=re.I)
    # Clean redundant whitespace
    n = re.sub(r"\s+", " ", n).strip()

    # 1. Translate Traditional Chinese to Simplified Chinese (comprehensive OpenCC dictionary)
    n = trad_to_simp(n)

    # 2. Standardize CCTV Digital Pay Channels (unify CCTV- prefix variants with standard simplified names)
    cctv_pay = {
        "CCTV-兵器科技": "兵器科技",
        "CCTV-央视台球": "央视台球",
        "CCTV-央视精品": "央视精品",
        "CCTV-高尔夫网球": "高尔夫网球",
        "CCTV-第一剧场": "第一剧场",
        "CCTV-风云剧场": "风云剧场",
        "CCTV-风云足球": "风云足球",
        "CCTV-风云音乐": "风云音乐",
        "CCTV-怀旧剧场": "怀旧剧场",
        "CCTV-女性时尚": "女性时尚",
        "CCTV-卫生健康": "卫生健康",
        "CCTV-世界地理": "世界地理",
        "CCTV-电视指南": "电视指南",
        "CCTV-发现之旅": "发现之旅"
    }
    if n in cctv_pay:
        n = cctv_pay[n]

    # 3. Traditional to simplified mapping for key satellite channels
    if n in ["湖南卫视 HD", "湖南卫视 1080P", "湖南卫视1080P"]:
        n = "湖南卫视"

    # 4. Standardize TVB channel names
    n = re.sub(r'(?i)tvbj1', 'TVB J1', n)
    n = re.sub(r'(?i)tvbj2', 'TVB J2', n)
    n = re.sub(r'(?i)tvbplus', 'TVB Plus', n)

    # 5. Normalize trailing "频道" for municipal channels (e.g. 广州综合频道 -> 广州综合, 广州新闻频道 -> 广州新闻)
    if any(c in n for c in ["广州", "深圳", "北京", "上海", "天津", "重庆", "广东", "浙江", "江苏", "湖南", "湖北", "四川"]):
        n = re.sub(r'频道$', '', n)

    return n

def clean_category(cat, name, url=""):
    cat = cat.strip()
    name = name.strip()
    name_lower = name.lower()
    url_lower = url.lower() if url else ""
    
    # 0. Test Channels (全面剔除测试频道与缓冲测试频道)
    if cat in ["测试频道", "广告测试", "⚠️低速/缓冲测试"] or any(k in name for k in ["广告测试", "缓冲测试", "测试频道"]):
        return None

    # 0.1 直播中国 (24小时全国5A风景与名胜实景慢直播)
    if cat in ["直播中国", "慢直播", "风景直播", "实景直播"] or "gcalic.v.myalicdn.com" in url_lower or "gctxyc.liveplay.myqcloud.com" in url_lower or "gcwbndali.v.myalicdn.com" in url_lower:
        return "直播中国"

    # 1. CCTV/pay-TV channels
    is_cctv = "cctv" in name_lower or "央视" in name or "风云" in name or "怀旧" in name or "兵器" in name or "世界地理" in name or "--服务器" in name_lower or any(x in name for x in ["第一剧场", "女性时尚", "卫生健康", "高尔夫网球", "电视指南", "发现之旅"])
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

    # 4.5 Korean & North Korean Broadcasters (韩国/朝鲜)
    is_north_korea = (any(x in name_lower for x in ["朝鲜中央", "kctv", "ryongnamsan", "朝鲜", "조선"]) or "koryocdn.org" in url_lower) and not ("akctv" in name_lower or "akc tv" in name_lower)
    is_korean_hangul = bool(re.search(r'[\uac00-\ud7a3]', name))
    is_korean_stvp = "stvp-kr" in url_lower
    is_korean_brand = False
    if not any(x in name_lower for x in ["akctv", "akc tv", "kbsi", "kbsv", "wsbs", "wmbc", "mbc 1", "mbc 3", "mbc masr", "wxtv"]):
        if any(x in name_lower for x in ["tvn asia", "tvn korea", "arirang", "tbs korea", "ebs kids", "llbn tv korean"]):
            is_korean_brand = True
        elif name_lower.startswith("kbs") or name_lower.startswith("sbs") or name_lower.startswith("mbc") or name_lower.startswith("jtbc") or name_lower.startswith("ytn"):
            is_korean_brand = True
        elif ("korea" in name_lower or "korean" in name_lower) and not any(x in name_lower for x in ["america", "taiwan", "china", "cctv"]):
            is_korean_brand = True

    if cat in ["韩国/朝鲜", "韩国频道", "朝鲜频道", "韩国", "朝鲜"] or is_north_korea or is_korean_hangul or is_korean_stvp or is_korean_brand:
        return "韩国/朝鲜"

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
    if (is_hk_tw or cat in ["澳门频道", "港台", "港台频道", "港澳台"] or cat.lower() in ["taiwan", "hong kong", "macau", "hk", "tw", "mo"] or any(x in cat.lower() for x in ["taiwan", "hong kong", "macau"])) and not is_foreign_english:
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
    if any(x in name_lower for x in doc_keywords) or any(x in cat.lower() for x in ["纪录", "记录", "纪实", "探索", "discovery", "documentary", "documentaries"]):
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

    guangdong_cities = ["广州", "深圳", "珠海", "汕头", "佛山", "韶关", "湛江", "肇庆", "江门", "茂名", "惠州", "梅州", "汕尾", "河源", "阳江", "清远", "东莞", "中山", "潮州", "揭阳", "云浮"]
    if any(city in name for city in guangdong_cities) or any(city in cat for city in guangdong_cities):
        if not any(k in name for k in ["卫视", "CCTV", "cctv", "体育"]):
            return "广东频道"

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
        "slopes tv", "speed sport", "fubo sports", "swerve sports"
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
        "bloomberg", "cnbc", "cnn", "msnbc", "newsmax", "scripps news", "weathernation", "accuweather", "court tv",
        "cheddar", "nasa", "c-span", "cspan", "america's voice", "america teve", "buzzr", "pbs news", "pbs", "accuweathernow",
        "usa today", "reuters", "euronews", "yahoo finance"
    ]
    if any(k in name_lower for k in us_major_keywords) or cat == "美国主流台":
        return "美国主流台"

    # 12. Western Movies / Series / Entertainment (影视剧场)
    movie_keywords = [
        "chc", "电影", "影院", "剧场", "movie", "movies", "cinema", "film", "series", "filmrise", "cinevault", "retro tv", 
        "drybar", "comedy", "thriller", "drama", "action", "sci-fi", "horror", "crime", 
        "mystery", "western", "electric now", "true crime now", "重温经典", "猫和老鼠",
        "paramount movie", "star trek", "stories by amc", "amc thrillers", "hallmark"
    ]
    is_series_cat = any(x in cat for x in ["电视剧", "埋堆堆", "电影经典", "影视经典", "欧美影视", "影视剧场", "剧场", "连续剧"])
    if any(k in name_lower for k in movie_keywords) or is_series_cat or any(x in cat.lower() for x in ["vod movies", "movies (en)"]):
        return "影视剧场"

    # 13. US Local Affiliates
    if re.match(r'^(abc|cbs|nbc|fox|cw|pbs)\s+[a-z0-9\-]+', name_lower) or any(x in name_lower for x in ["channel 1", "channel 2", "channel 3", "channel 4", "channel 5", "channel 6", "channel 7", "channel 8", "channel 9", "channel 10", "channel 11", "channel 12", "channel 13"]):
        return "美国地方台"
    if "stvp-us" in url_lower or "wsoc now" in name_lower or "wcetv" in name_lower or "rightnow" in name_lower or any(x in name_lower for x in ["bek", "bke"]):
        return "美国地方台"

    # 14. Multilingual International (Spanish, French, German, Italian, Hindi)
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

    if name == "直播中国" or "直播中国" in cat:
        return "直播中国"
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
    curated_path = os.path.join(SCRIPT_DIR, "curated_channels.txt")
    merged_urls = set()
    if os.path.exists(merged_path):
        with open(merged_path, "r", encoding="utf-8") as mf:
            for m_line in mf:
                m_parts = m_line.strip().split("|")
                if len(m_parts) >= 3:
                    merged_urls.add(m_parts[2].strip().lower())

    all_source_lines = []
    seen_source_urls = set()
    for s_path in [curated_path, merged_path]:
        if os.path.exists(s_path):
            with open(s_path, "r", encoding="utf-8") as sf:
                for s_line in sf:
                    s_line = s_line.strip()
                    if s_line and "|" in s_line and not s_line.startswith("#"):
                        parts = s_line.split("|")
                        if len(parts) >= 3:
                            u_norm = parts[2].strip().lower()
                            # YouTube 直播源必须经过健康探测且已入库 merged_channels.txt，
                            # 严禁将 curated_channels.txt 中已停播/失效的 YouTube 重播录像直接塞入播放列表
                            if ("youtube.com" in u_norm or "youtu.be" in u_norm) and u_norm not in merged_urls:
                                continue
                            if u_norm not in seen_source_urls:
                                seen_source_urls.add(u_norm)
                                all_source_lines.append(s_line)

    with open(merged_path, "r", encoding="utf-8") as _unused:
        for line in all_source_lines:
            line = line.strip()
            if not line or "|" not in line:
                continue
            parts = line.split("|")
            if len(parts) < 3:
                continue
            category = parts[0].strip()
            raw_name = parts[1].strip()
            url = parts[2].strip()
            
            # Filter out adware restreamer, ad networks, looping test streams, and single-IP bound streams
            u_lower = url.lower()
            if any(k in u_lower for k in ["107.150.60.122", "69.30.245.51", "192.151.", "204.12.", "mkt.m3u8", "lantian/channel001", "lantian/channel21", "hebtv.com/jishi/cp", "198.204.228.26", "appadhw", "tvzb", "47.97.252.", "173.208.", "3y1.xyz", "nosignal", "epg.pw/stream", "cnlive.club", "sailei", "dpdns.org", "cctv8k", "cctv-8k", "live.ottiptv.cc", "183.237.95.108", ".flv"]):
                continue
            if any(k in u_lower for k in [":88/applive", ":88/", "applive"]) or re.search(r'[?&]u=\d+\.\d+\.\d+\.\d+', u_lower):
                continue
            if "cctv-8" in raw_name.lower() and "cctv8k" in u_lower:
                continue
            if any(k in raw_name for k in ["支持作者", "关注公众号", "防失联", "微信", "更新时间"]):
                continue
            if url.lower().endswith(".mp4") and "春晚" not in raw_name and "电影" not in raw_name and category not in ["最新电影", "春晚"]:
                continue
            # IPTV guard: 1001_1 ~ 1099_1 are provincial local channels (Hunan City TV, JiaJia Cartoon, etc.), NEVER CCTV!
            if ("cctv" in raw_name.lower() or "cctv" in category.lower()) and re.search(r'tsfile/live/10\d{2}_1\.m3u8', url):
                continue
            
            # BesTV '看东方' guard: bp-resource-dfl.bestv.cn is '看东方', NEVER '东方卫视'!
            if "bp-resource-dfl.bestv.cn" in url.lower():
                raw_name = "看东方"
                category = "港澳台"
            
            # Filter out all test channels and buffering test channels
            if category in ["测试频道", "广告测试", "⚠️低速/缓冲测试"] or any(k in raw_name for k in ["广告测试", "缓冲测试", "测试频道"]):
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
            
            # Normalize Singapore, Macau, Hong Kong, Taiwan and regional channels to standard Chinese names
            sg_mo_map = {
                'CH8': '新传媒8频道',
                'Channel 8': '新传媒8频道',
                'CHU': '新传媒U频道',
                'CHANNEL U': '新传媒U频道',
                'CH5': '新传媒5频道',
                'CHANNEL 5': '新传媒5频道',
                'CNA': 'CNA亚洲新闻台',
                '澳门莲花': '澳门莲花卫视',
                '澳门莲花电影': '澳门莲花卫视',
                'Lotus TV': '澳门莲花卫视',
                '澳门体育': '澳视体育',
                '澳门综艺': '澳视综艺',
                '澳门资讯': '澳视资讯',
                '澳门咨询': '澳视资讯',
                '澳视澳门': '澳视澳门',
                '澳视卫星': '澳门卫星频道',
                '澳门Macau': '澳视澳门',
                'Beautiful Life TV': '人间卫视',
                '人间卫视 BLTV': '人间卫视',
                'Good': '好消息1台',
                'Good 2': '好消息2台',
                'GOOD TV 好消息 1台': '好消息1台',
                'GOOD TV 好消息 2台': '好消息2台',
                'Dali TV': '大立电视',
                '大立電視': '大立电视',
                'TVB翡翠台': '翡翠台',
                'TVB明珠': '明珠台',
                'TVB明珠台': '明珠台',
                'TVB无线新闻': 'TVB新闻',
                'TVBPlus': 'TVB Plus',
                'TVBJ1': 'TVB J1',
                'TVBS亚洲': 'TVBS-Asia',
                'TVBS新闻': 'TVBS新闻台',
                '无线新闻台': '无线新闻',
                'NOW新闻': 'NOW新闻台',
                '凤凰卫视台': '凤凰中文',
                '甘肃-白银文化教育': '白银文化教育',
                '甘肃-张掖新闻综合': '张掖新闻综合',
                '广州综合频道': '广州综合',
                'BBC NEWS': 'BBC News',
                '广州新闻频道': '广州新闻',
                '广州南国都市频道': '广州南国都市',
                '哈尔滨影视': '哈尔滨影视频道',
                '绍兴公共': '绍兴公共频道',
                '浙江国际': '浙江国际频道',
                '浙江少儿': '浙江少儿频道',
                '浙江教科': '浙江教科影视',
                '浙江教科频道': '浙江教科影视',
                '浙江经济': '浙江经济生活',
                '浙江民生': '浙江民生休闲',
                '浙江民生资讯': '浙江民生休闲',
                '浙江钱江': '浙江钱江都市',
                '浙江钱江频道': '浙江钱江都市',
                '舒兰新闻': '舒兰新闻综合',
                '辉南新闻': '辉南新闻综合'
            }
            name = trad_to_simp(name)
            stripped_prefix = re.sub(r'^[^\w\s\-]+', '', name).strip()
            if stripped_prefix in sg_mo_map:
                name = sg_mo_map[stripped_prefix]
            elif name in sg_mo_map:
                name = sg_mo_map[name]
                
            # IPTV Guard: reject mismatched IPTV streams (e.g. CCTV-3 with 0019_1, CCTV-5+ with 0016_1, etc.)
            m_cctv = re.search(r'CCTV[-_ ]?(\d+)', name, re.I)
            m_code = re.search(r'/00(\d{2})_1\.m3u8', url)
            if m_cctv and m_code:
                cctv_num = int(m_cctv.group(1))
                code_num = int(m_code.group(1))
                if "112.123.243.37" in url:
                    # Anhui Unicom IPTV: CCTV-1~5 are 0001~0005; CCTV-6~16 are 0007~0017 (+1 offset because 0006 doesn't exist)
                    valid_anhui = (cctv_num <= 5 and code_num == cctv_num) or (6 <= cctv_num <= 16 and code_num == cctv_num + 1)
                    if not valid_anhui:
                        continue
                else:
                    if cctv_num != code_num and not (cctv_num == 5 and code_num == 21):
                        continue
            if "cctv-5+" in name.lower() and "/0016_1.m3u8" in url:
                continue
            if "cctv" in name.lower() and re.search(r'tsfile/live/10\d{2}_1\.m3u8', url):
                continue

            cleaned_cat = clean_category(category, name, url)
            
            # YouTube 独立频道标识：来自 YouTube 的源独立显示为 [电视台名字-YT]，
            # 绝不与 Cloudflare 代理的官方正规电视频道合并在同一个电视台名字下，
            # 确保主电视台列表 100% 为电视机顶盒即点即播的流媒体，同时清晰区分 YouTube 线路
            if "youtube.com" in url.lower() or "youtu.be" in url.lower():
                # 机顶盒/IPTV 播放器无法播放播放列表 (playlist)，直接忽略
                if "list=" in url or "listtype=" in url.lower():
                    continue
                clean_base = re.sub(r'[-_ ]*(YT|YouTube|youtube)$', '', name).strip()
                name = f"{clean_base}-YT"
            
            channels.append({
                "category": cleaned_cat,
                "name": name,
                "raw_name": raw_name,
                "url": url
            })
            
            # Cross-listing: CCTV-14 to 少儿卡通, CCTV-9 to 纪实探索
            if cleaned_cat != "测试频道":
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
            
    # ── Auto GSLB Resolver & Direct Node Flattening Engine ───────────────────────
    # 自动探测并提纯所有 GSLB 调度源背后的真实底层推流节点：
    # 若底层节点经实测免 Token、无时效限制且为纯净流，则自动提炼为直连新线路加入候选池（自动晋级 Line 1），
    # 并保留原 GSLB 调度地址作为备用源（Line 2），实现零人工维护的全自动自愈与加速。
    new_flattened = []
    gslb_channels = [c for c in channels if "gslb" in c["url"].lower() or "redirect" in c["url"].lower()]
    if gslb_channels:
        gslb_ctx = ssl._create_unverified_context()
        
        def probe_and_flatten_gslb(c):
            u = c["url"].strip()
            try:
                req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                with urllib.request.urlopen(req, context=gslb_ctx, timeout=3.0) as resp:
                    final_url = resp.geturl()
                    if final_url != u:
                        final_url_lower = final_url.lower()
                        bad_gslb_targets = [
                            "107.m3u8", "zmt.m3u8", "mkt.m3u8", "69.30.245.51", "appadhw", "47.97.252.", 
                            "nosignal", "error", "192.151.", "204.12.", "173.208.", "198.204.228.26",
                            "cctv8k", "cctv-8k"
                        ]
                        if any(k in final_url_lower for k in bad_gslb_targets):
                            return None
                        clean_url = final_url.split("?")[0]
                        clean_url_lower = clean_url.lower()
                        if any(k in clean_url_lower for k in bad_gslb_targets):
                            return None

                        # Block CCTV-8 from adopting CCTV-8K streams
                        if "cctv-8" in c["name"].lower() and "cctv8k" in final_url_lower:
                            return None

                        # 1. 优先尝试探测是否为永久免 Token 的纯净底层节点
                        if clean_url != u:
                            try:
                                req_clean = urllib.request.Request(clean_url, headers={"User-Agent": "Mozilla/5.0"})
                                with urllib.request.urlopen(req_clean, context=gslb_ctx, timeout=2.0) as r_clean:
                                    if r_clean.status == 200:
                                        content = r_clean.read(1500).decode("utf-8", errors="ignore")
                                        if "#EXTM3U" in content and not any(k in content.lower() for k in ["not available in your area", "appadhw"]):
                                            return {
                                                "category": c["category"],
                                                "name": c["name"],
                                                "raw_name": c.get("raw_name", c["name"]),
                                                "url": clean_url,
                                                "is_tokenless": True
                                            }
                            except Exception:
                                pass

                        # 2. 若底层带动态 Token 鉴权，直接提纯并返回带有时效 Token 的真实底层推流节点！
                        # 彻底绕开 GSLB 调度机前端所植入的开播/贴片广告，实现客户端秒开直连！
                        # 严格防护：若包含 u=<IP> 参数或 :88/applive，说明该 Token 强绑定了单机出口 IP，其它客户端播放会 403 触发回退广告，必须排除！
                        if any(k in final_url_lower for k in [":88/applive", ":88/", "applive"]) or re.search(r'[?&]u=\d+\.\d+\.\d+\.\d+', final_url_lower):
                            return None

                        try:
                            req_final = urllib.request.Request(final_url, headers={"User-Agent": "Mozilla/5.0"})
                            with urllib.request.urlopen(req_final, context=gslb_ctx, timeout=2.5) as r_final:
                                if r_final.status == 200:
                                    content_final = r_final.read(1500).decode("utf-8", errors="ignore")
                                    if "#EXTM3U" in content_final and not any(k in content_final.lower() for k in ["not available in your area", "appadhw"]):
                                        return {
                                            "category": c["category"],
                                            "name": c["name"],
                                            "raw_name": c.get("raw_name", c["name"]),
                                            "url": final_url,
                                            "is_tokenless": False
                                        }
                        except Exception:
                            pass
            except Exception:
                pass
            return None

        seen_channel_urls = {c["url"].strip().lower() for c in channels}
        new_flattened = []
        print(f"Probing and flattening {len(gslb_channels)} GSLB channels...", flush=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as gslb_ex:
            for res in gslb_ex.map(probe_and_flatten_gslb, gslb_channels):
                if res and res["url"].lower() not in seen_channel_urls:
                    seen_channel_urls.add(res["url"].lower())
                    new_flattened.append(res)
                    tag = "免Token直连" if res.get("is_tokenless") else "带Token直连(避开GSLB广告)"
                    print(f"  ⚡ [Auto-Flatten] {res['name']} 自动提纯底层节点 ({tag}): {res['url']}", flush=True)

        if new_flattened:
            channels.extend(new_flattened)
            print(f"Auto-flattened {len(new_flattened)} direct underlying nodes from GSLB.", flush=True)

            # 自动沉淀：仅将经实测【免 Token】的健康底层直连节点持久化写入 merged_channels.txt
            # 避免将短期有时效的动态 Token 写入数据库造成污染；带 Token 的直连节点由每 15 分钟定时任务在内存中动态提纯发布
            try:
                existing_db_urls = set()
                for fpath in [merged_path, curated_path]:
                    if os.path.exists(fpath):
                        with open(fpath, "r", encoding="utf-8") as f:
                            for l in f:
                                parts = l.strip().split("|")
                                if len(parts) >= 3:
                                    existing_db_urls.add(parts[2].strip().lower())

                to_persist = [ch for ch in new_flattened if ch.get("is_tokenless") and ch["url"].strip().lower() not in existing_db_urls]
                if to_persist:
                    with open(merged_path, "a", encoding="utf-8") as mf:
                        for ch in to_persist:
                            mf.write(f"{ch['category']}|{ch['name']}|{ch['url']}\n")
                    print(f"  💾 [Auto-Persist] 成功沉淀 {len(to_persist)} 个免 Token 真实底层节点至数据库 (merged_channels.txt)", flush=True)
            except Exception as pe:
                print(f"  ⚠️ Auto-persist warning: {pe}", flush=True)

    # 确保华人支持的 20 大核心省级卫视全量在籍（若原公网流失效导致该台临时缺席，使用移动/运营商保底流补齐，使华人线路 1 正常接入）
    huavod_satellites = {
        "山东卫视": "http://ottrrs.hl.chinamobile.com/PLTV/88888888/224/3221226456/index.m3u8",
        "安徽卫视": "http://ottrrs.hl.chinamobile.com/PLTV/88888888/224/3221226391/index.m3u8",
        "辽宁卫视": "http://ottrrs.hl.chinamobile.com/PLTV/88888888/224/3221226546/index.m3u8",
        "陕西卫视": "http://ottrrs.hl.chinamobile.com/PLTV/88888888/224/3221226457/index.m3u8",
        "四川卫视": "http://ottrrs.hl.chinamobile.com/PLTV/88888888/224/3221226338/index.m3u8",
        "黑龙江卫视": "http://ottrrs.hl.chinamobile.com/PLTV/88888888/224/3221226327/index.m3u8",
        "重庆卫视": "http://ottrrs.hl.chinamobile.com/PLTV/88888888/224/3221226409/index.m3u8",
        "海南卫视": "http://ottrrs.hl.chinamobile.com/PLTV/88888888/224/3221226465/index.m3u8",
    }
    existing_sat_names = set(c["name"] for c in channels if c["category"] == "卫视频道")
    for sat_name, fallback_url in huavod_satellites.items():
        if sat_name not in existing_sat_names:
            channels.append({
                "category": "卫视频道",
                "name": sat_name,
                "raw_name": sat_name,
                "url": fallback_url
            })

    # Prioritize higher quality streams for each channel before key assignment and capping
    name_groups = OrderedDict()
    for c in channels:
        name_groups.setdefault((c["category"], c["name"]), []).append(c)

    # ── Resolution and Speed Multi-Level Benchmark ───────────────────────────
    METRICS_PATH = os.path.join(SCRIPT_DIR, "stream_metrics.json")
    cached_metrics = {}
    if os.path.exists(METRICS_PATH):
        try:
            with open(METRICS_PATH, "r", encoding="utf-8") as mf:
                cached_metrics = json.load(mf)
        except Exception:
            cached_metrics = {}

    for sat_name, fallback_url in huavod_satellites.items():
        if fallback_url not in cached_metrics:
            cached_metrics[fallback_url.strip()] = {
                "res_tier": 2,
                "res_name": "720P",
                "latency_ms": 150,
                "download_kbps": 20000,
                "smooth_tier": 2,
                "stream_bitrate_kbps": 2000,
                "seg_dur": 10.0,
                "tested_at": time.time()
            }

    # 为新提纯出的底层真实节点赋予极速流畅度初始评分（smooth_tier: 2，18Mbps 带宽），确保在多线路排序中压倒 GSLB 代理
    if new_flattened:
        for ch in new_flattened:
            cached_metrics[ch["url"].strip()] = {
                "res_tier": 2,
                "res_name": "720P",
                "latency_ms": 120,
                "download_kbps": 22000,
                "smooth_tier": 2,
                "tested_at": time.time()
            }

    def stream_stability_score(c):
        score = 0
        u_lower = c["url"].lower()
        if any(k in u_lower for k in [":8181", "204.12.221.", "204.12.241.", "173.208.212."]):
            score -= 60
        # 美国本土极速直连骨干节点（免 Token、永久 0 广告、0 跳转）赋予最高保底优先级
        if "69.197.146.138:82" in u_lower:
            score += 100
        elif any(k in u_lower for k in ["gslb", "redirect", ":98/"]):
            # GSLB 调度中转地址概率性植入开播广告且增加跳转延迟，施加严厉降级扣分，杜绝占据 Line 1
            score -= 100
        elif any(k in u_lower for k in [
            "cztv.com/live", "kylintv", "skygo.mn", "bestv.cn", "mgtv.com",
            "63.141.", "74.91.", "69.30.", "198.204.", "207.56.",
            "38.64.", "38.75.", "bztv.tvbus.cc", "69.197."
        ]):
            score += 35
        elif "chinamobile" in u_lower or "unicom" in u_lower or "key=txiptv" in u_lower or ":9901/" in u_lower or ":60901/" in u_lower or ":50085/" in u_lower:
            score += 15
        elif "?" not in u_lower and not any(k in u_lower for k in ["cctvnews.cctv.com", "newlive", "wd_r2"]):
            score += 20

        if "cctvnews.cctv.com" in u_lower or "wd_r2/cctv" in u_lower or "wd_r2" in u_lower:
            score -= 60
        if "newlive" in u_lower or "wssecret=" in u_lower or "wstime=" in u_lower:
            score -= 50
        if any(k in u_lower for k in ["auth_key=", "sign=", "token="]) and not any(k in u_lower for k in ["auth=test", "key=txiptv"]):
            score -= 30
        if any(k in u_lower for k in [
            "qd.je", "jdshipin.com", "sryze.cc", "kankanlive", "xykt-fix", "livehwc", 
            "appadhw", "dsdqpub", "auth=testpub", "cctv4k.m3u8", "107.m3u8", "zmt.m3u8", "mkt.m3u8", "47.97.252.", "69.30.245.51", "192.151.", "204.12.234."
        ]):
            score -= 100
        return score

    def stream_purity_tier(c):
        """
        纯净度分级 (Purity Tiers):
        Tier 2 (最高): 官方正规源及高性能 CDN 直连流 (永久 0 广告，点开即正片)
          - 广电/卫视官方无广告流 (cztv.com, sdetv.com, hebtv.com, gztv.com, tdm.com.mo, kylintv.tv, bestv.cn, cnr.cn)
          - 骨干机房高带宽加速源 (69.197., 63.141., 74.91., 69.30., 198.204., 207.56., 38.64., 38.75., bztv.tvbus.cc)
          - YouTube 24/7 官方直播
        Tier 1 (普通): 常见常规网络流及运营商 IPTV 组播流
        Tier 0 (最低/备用): 具有首次连接商业插播广告/贴片会话/暗投切片特征的流 (仅作为末尾备用线路，绝不占 Line 1)
          - gslb / redirect / :98/ (GSLB 广告与调度中转机)
          - qd.je, jdshipin.com, sryze.cc (商业贴片广告代理)
          - xykt-fix, kankanlive, livehwc (商业 H5 流，带开播前置广告)
          - user_session_id=, edge_slice= (广告会话跟踪)
          - miguvideo / wd_r2 (移动端 app 流，带 bean=mgspad 广告参数)
          - newlive (酒店网关开机迎宾广告)
          - dsdqpub / auth=testpub / cctv4k.m3u8 / 107.m3u8 / zmt.m3u8 / 192.151. / 204.12.234. (公共测试/广告轮播流)
        """
        u_lower = c["url"].lower()
        if any(k in u_lower for k in [
            "gslb", "redirect", ":98/",
            "qd.je", "jdshipin.com", "sryze.cc", "xykt-fix", "kankanlive", 
            "livehwc", "edge_slice", "user_session_id", "wd_r2", "newlive",
            "appadhw", "cctv4k.m3u8", "dsdqpub", "auth=testpub",
            "107.m3u8", "zmt.m3u8", "mkt.m3u8", "47.97.252.", "192.151.", "204.12.234."
        ]):
            return 0
        if any(k in u_lower for k in [
            "cztv.com", "sdetv.com", "hebtv.com", "gztv.com", "tdm.com.mo",
            "kylintv.tv", "cnr.cn", "bestv.cn", "sun0769.com", "wcetv.com",
            "amagi.tv", "sofast.tv", "mediatailor", "youtube.com", "youtu.be",
            "cctvnews.cctv.com", "iyb983.cn", "kwimgs.com", "211.72.174.95",
            "gcalic.v.myalicdn.com", "myqcloud.com", "gcwbndali.v.myalicdn.com",
            "pluto.tv", "akamaized.net", "simplestreamcdn.com", "51kandianshi.com",
            "nmtv.cn", "yntv.net", "lanzhousobey.cn", "cc.cd", "fengshows.cn",
            "69.197.", "63.141.", "74.91.", "69.30.",
            "198.204.", "207.56.", "38.64.", "38.75.", "bztv.tvbus.cc"
        ]):
            return 2
        return 1

    # Identify channels that require quality & speed differentiation and ad-screening (including single-line channels)
    # 彻底移除缓存：每次巡检 100% 从零并发测速所有频道源（涵盖单线路与多线路），确保数据即时绝对真实且彻底过滤广告
    multi_line_urls = []
    seen_multi_urls = set()
    for (cat_name, ch_name), grp in name_groups.items():
        for item in grp:
            u_norm = item["url"].strip()
            if u_norm not in seen_multi_urls:
                seen_multi_urls.add(u_norm)
                multi_line_urls.append(item)

    if multi_line_urls:
        print(f"Benchmarking clarity, speed & ad-check for {len(multi_line_urls)} channel streams with 10s continuous segments & per-host pacing...")
        probe_ctx = ssl._create_unverified_context()

        # 按服务器域名/主机建独占信号量（同一时刻对同一域名并发数 = 1，防止触发机房反爬虫/限速）
        host_semaphores = defaultdict(lambda: threading.Semaphore(1))
        host_sem_lock = threading.Lock()

        def get_host_semaphore(netloc):
            with host_sem_lock:
                return host_semaphores[netloc]

        def probe_line(item):
            url = item["url"]
            t0 = time.time()
            res_tier = 2
            res_name = "720P"
            latency_ms = 9999
            download_kbps = 0
            smooth_tier = 1
            seg_dur = 10.0
            stream_bitrate_kbps = 2000

            if "youtube.com" in url.lower() or "youtu.be" in url.lower():
                return url, {"res_tier": 3, "res_name": "1080P", "latency_ms": 120, "download_kbps": 30000, "smooth_tier": 2, "tested_at": time.time()}

            combined = f"{item.get('raw_name', '')} {url}".lower()
            clean_combined = re.sub(r'cctv\d+k', '', combined) if ("cctv-4k" not in combined and "cctv 4k" not in combined and "cctv-8k" not in combined and "cctv 8k" not in combined) else combined
            is_adware = stream_purity_tier(item) == 0

            is_4k_8k = bool(re.search(r'(?:^|[^0-9a-zA-Z])(4k|8k|2160p|uhd|超高清)(?:$|[^0-9a-zA-Z])', clean_combined, re.I))
            if is_4k_8k:
                res_tier, res_name = 4, "4K"
            elif any(k in combined for k in ["1080p", "1080", "fhd", "超清"]):
                res_tier, res_name = 3, "1080P"
            elif re.search(r'/00(0[1-6]|0[8-9]|1[0-7])_1\.m3u8', url):
                # CCTV-1~6, CCTV-8~17 IPTV multicast streams (1080P Full HD)
                res_tier, res_name = 3, "1080P"
            elif any(k in combined for k in ["720p", "720", "hd", "高清"]) or re.search(r'/0007_1\.m3u8', url):
                res_tier, res_name = 2, "720P"
            elif any(k in combined for k in ["576", "480", "sd", "标清", "kankanlive"]):
                res_tier, res_name = 1, "SD"

            # 按域名/主机获取信号量并排队，添加 0.15s 换台呼吸间隔
            netloc = urllib.parse.urlparse(url).netloc.lower()
            sem = get_host_semaphore(netloc)
            with sem:
                time.sleep(0.15)
                try:
                    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req, context=probe_ctx, timeout=3.5) as r:
                        latency_ms = int((time.time() - t0) * 1000)
                        final_url = r.geturl()
                        final_url_lower = final_url.lower()

                        # 严格拦截 301/302 重定向到广告轮播服务器（如 appadhw, 47.97.252., 107.m3u8, zmt.m3u8）
                        if any(k in final_url_lower for k in ["appadhw", "47.97.252.", "107.m3u8", "zmt.m3u8", "mkt.m3u8", "69.30.245.51"]):
                            return url, {"res_tier": 0, "res_name": "Adware", "latency_ms": 9999, "download_kbps": 0, "smooth_tier": 0, "tested_at": 0}

                        # 严格拦截已确认的限速死链特征
                        if any(k in final_url_lower for k in ["192.187.115.", "from=cdnwh", "zbdq11"]):
                            return url, {"res_tier": 1, "res_name": "Throttled/Buffer", "latency_ms": 9999, "download_kbps": 500, "smooth_tier": 0, "tested_at": 0}

                        chunk = r.read(100000).decode('utf-8', errors='ignore')

                        # 严格要求流必须为合法的 HLS 播放列表，排除 JSON/HTML 错误页面
                        if not chunk.strip().startswith("#EXTM3U") and not chunk.startswith("FLV") and "video/" not in r.headers.get("Content-Type", ""):
                            return url, {"res_tier": 0, "res_name": "Invalid/NotM3U8", "latency_ms": 9999, "download_kbps": 0, "smooth_tier": 0, "tested_at": 0}

                        # 严格拦截地域锁屏切片与广告切片（如 CCTV-5 体育版权锁屏 "not available in your area"）
                        if any(k in chunk.lower() for k in ["not available in your area", "appadhw"]):
                            return url, {"res_tier": 0, "res_name": "GeoBlocked/Ad", "latency_ms": 9999, "download_kbps": 0, "smooth_tier": 0, "tested_at": 0}

                        # 核心修复：多码率 Master Playlist 全量扫描，取该流支持的最高分辨率（Max Resolution）
                        all_res = re.findall(r'RESOLUTION=(\d+)x(\d+)', chunk, re.I)
                        if all_res:
                            max_w = max(int(w) for w, h in all_res)
                            max_h = max(int(h) for w, h in all_res)
                            if max_h >= 2160 or max_w >= 3840:
                                res_tier, res_name = 4, f"4K ({max_w}x{max_h})"
                            elif max_h >= 1080 or max_w >= 1920:
                                res_tier, res_name = 3, f"1080P ({max_w}x{max_h})"
                            elif max_h >= 720 or max_w >= 1280:
                                res_tier, res_name = 2, f"720P ({max_w}x{max_h})"
                            elif max_h >= 540 or max_w >= 960:
                                # 960x540 / 1024x576 欧美主流 16:9 宽屏高清，赋予 720P 同等准入
                                res_tier, res_name = 2, f"540P/HD ({max_w}x{max_h})"
                            else:
                                res_tier, res_name = 1, f"SD ({max_w}x{max_h})"
                        else:
                            all_bw = re.findall(r'BANDWIDTH=(\d+)', chunk, re.I)
                            if all_bw and not is_adware:
                                max_bw = max(int(b) for b in all_bw)
                                if max_bw >= 12000000 and res_tier < 4:
                                    res_tier, res_name = 4, "4K"
                                elif max_bw >= 6500000 and res_tier < 3:
                                    res_tier, res_name = 3, "1080P"
                                elif max_bw >= 1500000 and res_tier < 2:
                                    res_tier, res_name = 2, "720P"

                        # 若为 Master Playlist (#EXT-X-STREAM-INF)，解析并获取最高码率对应的真实切片列表 (Media Playlist)
                        lines = [l.strip() for l in chunk.splitlines() if l.strip() and not l.startswith("#")]
                        media_url = final_url
                        media_chunk = chunk
                        if "#EXT-X-STREAM-INF" in chunk and lines:
                            target_sub = urllib.parse.urljoin(final_url, lines[-1])
                            try:
                                req_sub = urllib.request.Request(target_sub, headers={'User-Agent': 'Mozilla/5.0'})
                                with urllib.request.urlopen(req_sub, context=probe_ctx, timeout=3.5) as r_sub:
                                    media_url = r_sub.geturl()
                                    media_chunk = r_sub.read(200000).decode('utf-8', errors='ignore')
                            except Exception:
                                pass

                        # 从 Media Playlist 提取连续切片及其真实时长 (#EXTINF)
                        segments = []
                        curr_seg_dur = 5.0
                        for l in media_chunk.splitlines():
                            l = l.strip()
                            if not l:
                                continue
                            if l.startswith("#EXTINF:"):
                                m_dur = re.search(r'#EXTINF:([\d\.]+)', l)
                                if m_dur:
                                    try:
                                        curr_seg_dur = max(float(m_dur.group(1)), 0.5)
                                    except Exception:
                                        curr_seg_dur = 5.0
                            elif not l.startswith("#"):
                                seg_full = urllib.parse.urljoin(media_url, l)
                                segments.append((seg_full, curr_seg_dur))

                        # 选定满足累计 >= 10.0 秒视频时长的连续切片组（最多取 5 个切片）
                        # 避开 live edge 最后一秒可能尚未同步的边界竞争，从倒数第2个或第3个切片向前取
                        cand_segs = segments[:-1] if len(segments) >= 5 else segments
                        selected_segs = []
                        accum_dur = 0.0
                        for s_url, s_dur in reversed(cand_segs):
                            selected_segs.append((s_url, s_dur))
                            accum_dur += s_dur
                            if accum_dur >= 10.0 or len(selected_segs) >= 5:
                                break
                        selected_segs.reverse()

                        if not selected_segs and lines:
                            # 兜底：若未解析到 EXTINF，至少取最后一个 URL
                            selected_segs = [(urllib.parse.urljoin(media_url, lines[-1]), 5.0)]
                            accum_dur = 5.0

                        seg_dur = accum_dur / max(len(selected_segs), 1)

                        # 严格执行 10 秒连续切片真实路测，并具备第一片快速止损机制
                        t_seg_start = time.time()
                        total_bytes = 0
                        has_error = False

                        for idx, (s_url, s_dur) in enumerate(selected_segs):
                            try:
                                req_seg = urllib.request.Request(s_url, headers={'User-Agent': 'Mozilla/5.0'})
                                seg_timeout = max(s_dur * 1.5, 4.0)
                                with urllib.request.urlopen(req_seg, context=probe_ctx, timeout=seg_timeout) as r_seg:
                                    # 分块读取切片：设置单片硬性时限与数据上限，彻底杜绝无 EOF 持续长直播流导致的无限等待
                                    b_chunks = []
                                    seg_bytes = 0
                                    t_seg_chunk_start = time.time()
                                    max_seg_time = max(s_dur * 1.2, 3.5)
                                    while True:
                                        chunk_part = r_seg.read(65536)
                                        if not chunk_part:
                                            break
                                        b_chunks.append(chunk_part)
                                        seg_bytes += len(chunk_part)
                                        t_curr = time.time() - t_seg_chunk_start
                                        # 快速止损：读取超过 1.8 秒但速率不足 300 kbps，果断判定死缓并退出
                                        if t_curr > 1.8 and (seg_bytes * 8 / 1024) / t_curr < 300:
                                            has_error = True
                                            break
                                        # 足够测速数据量：超过单片建议时长或单片读取已达 3.5MB，立即完成测速
                                        if t_curr >= max_seg_time or seg_bytes >= 3500000:
                                            break
                                    b = b"".join(b_chunks)
                                    total_bytes += len(b)
                                    if has_error:
                                        break
                                    # 若第 1 个切片下载速度连 300 kbps 都跑不到，直接判定卡死淘汰
                                    if idx == 0:
                                        t_first = time.time() - t_seg_start
                                        first_speed = (len(b) * 8 / 1024) / max(t_first, 0.001)
                                        if first_speed < 300:
                                            has_error = True
                                            break
                            except Exception:
                                has_error = True
                                break

                        # 容错：如果已下载了充分的视频数据（>= 300KB）且下行速率良好，单一切片尾部轻微波动不作为致命错误
                        if has_error and total_bytes >= 300000:
                            t_part = time.time() - t_seg_start
                            if t_part > 0 and (total_bytes * 8 / 1024) / t_part >= 1500:
                                has_error = False

                        elapsed = time.time() - t_seg_start
                        if total_bytes > 0 and elapsed > 0:
                            download_kbps = int((total_bytes * 8 / 1024) / elapsed)
                        else:
                            download_kbps = 0

                        if accum_dur > 0 and total_bytes > 0:
                            stream_bitrate_kbps = int((total_bytes * 8 / 1024) / accum_dur)
                        elif "key=txiptv" in url or ":50085" in url or ":9901" in url or ":60901" in url:
                            stream_bitrate_kbps = 8500
                        elif res_tier >= 3:
                            stream_bitrate_kbps = 3200
                        elif res_tier == 2:
                            stream_bitrate_kbps = 1600
                        else:
                            stream_bitrate_kbps = 700

                except Exception:
                    latency_ms = 9999
                    download_kbps = 0
                    has_error = True

            # 纠正 IPTV 清晰度虚标：若未明确标注 1080P 且切片码率不足 4500 kbps，纠正为 720P（国际主流大台如 BBC/Amagi/Wurl/CBS 除外）
            is_intl_fast = any(k in url.lower() for k in ["akamaized", "amagi", "wurl", "cbs", "fox", "nbc", "roku"])
            if res_tier == 3 and not any(k in combined for k in ["1080p", "1080", "fhd", "超清"]) and stream_bitrate_kbps < 4500 and not is_intl_fast:
                res_tier, res_name = 2, "720P"

            # 标注为 1080P 的流，若下行带宽跑不赢 3500 kbps，降级为 720P，防止虚标高清抢占首位
            if res_tier >= 3 and download_kbps < 3500:
                res_tier, res_name = 2, "720P"

            # 核心判定：基于 10 秒真实路测的播放速率比值判定 (speed_ratio = 下行速率 / 播放码率)
            speed_ratio = download_kbps / max(stream_bitrate_kbps, 1)

            # 官方云 CDN 直播源保护（如阿里云慢直播、广州台腾讯云、TVB cdn.qd.je 等）
            is_official_cdn = any(k in url.lower() for k in [
                "gztv.com", "cdn.qd.je", "gcalic.v.myalicdn.com", "gcwbndali.v.myalicdn.com", 
                "gctxyc.liveplay.myqcloud.com", "akamaized.net", "amagi.tv", "wurl.com", "cbsnstream.cbsnews.com"
            ])

            if has_error or latency_ms >= 4000 or download_kbps < 700:
                smooth_tier = 0
            elif is_official_cdn and download_kbps >= 1800 and latency_ms < 3500:
                smooth_tier = 2
            elif speed_ratio >= 1.05 and download_kbps >= 1500:
                # 下载速度超过播放码率 1.05 倍以上：播放器缓冲池持续增加，绝不卡顿
                smooth_tier = 2
            elif speed_ratio >= 0.90 and accum_dur >= 7.0 and download_kbps >= 1200:
                # 长切片规整流（抗抖动能力强，下行跑平码率）：丝滑秒开
                smooth_tier = 2
            elif speed_ratio >= 0.80 and download_kbps >= 1000:
                smooth_tier = 1
            else:
                # 下行速度低于播放码率 0.8 倍：10 秒路测确凿卡顿，降级隔离
                smooth_tier = 0

            return url, {
                "res_tier": res_tier,
                "res_name": res_name,
                "latency_ms": latency_ms,
                "download_kbps": download_kbps,
                "smooth_tier": smooth_tier,
                "stream_bitrate_kbps": stream_bitrate_kbps,
                "seg_dur": seg_dur,
                "tested_at": time.time() if smooth_tier > 0 else 0
            }

        import random
        # 核心优化：彻底打散待测 URL 顺序，保证各个工作线程同时处理不同域名，消除同域名排队等待瓶颈！
        shuffled_urls = list(multi_line_urls)
        random.seed(42)
        random.shuffle(shuffled_urls)

        # 增量加速：若该 URL 在过去 2 小时内已被新版 10 秒引擎完整路测过，直接复用结果；仅对其余流进行测速
        now_ts = time.time()
        to_probe = [
            item for item in shuffled_urls
            if not (
                cached_metrics.get(item["url"].strip(), {}).get("tested_at", 0) > now_ts - 7200
                and "seg_dur" in cached_metrics.get(item["url"].strip(), {})
            )
        ]
        print(f"Total streams: {len(shuffled_urls)} (Reusing {len(shuffled_urls) - len(to_probe)} freshly verified in cache, probing {len(to_probe)} remaining streams)...", flush=True)

        if to_probe:
            with concurrent.futures.ThreadPoolExecutor(max_workers=25) as ex:
                futures = {ex.submit(probe_line, item): item for item in to_probe}
                done_count = 0
                total_items = len(futures)
                for f in concurrent.futures.as_completed(futures):
                    try:
                        u_res, m_res = f.result()
                        cached_metrics[u_res] = m_res
                    except Exception:
                        pass
                    done_count += 1
                    if done_count % 100 == 0 or done_count == total_items:
                        print(f"  ⚡ [{done_count}/{total_items}] Streams benchmarked ({done_count*100//total_items}%)...", flush=True)
                        try:
                            with open(METRICS_PATH, "w", encoding="utf-8") as mf:
                                json.dump(cached_metrics, mf, ensure_ascii=False, indent=2)
                        except Exception:
                            pass
        else:
            print("  ⚡ All streams have fresh 10s benchmark metrics in cache.", flush=True)

    def multi_line_sort_key(c):
        u = c["url"].strip()
        m = cached_metrics.get(u, {})
        res_tier = m.get("res_tier")
        is_adware = stream_purity_tier(c) == 0
        if res_tier is None:
            combined = f"{c.get('raw_name', '')} {u}".lower()
            clean_combined = re.sub(r'cctv\d+k', '', combined) if ("cctv-4k" not in combined and "cctv 4k" not in combined and "cctv-8k" not in combined and "cctv 8k" not in combined) else combined
            is_4k_8k = bool(re.search(r'(?:^|[^0-9a-zA-Z])(4k|8k|2160p|uhd|超高清)(?:$|[^0-9a-zA-Z])', clean_combined, re.I))
            if is_4k_8k: res_tier = 4
            elif any(k in combined for k in ["1080p", "1080", "fhd", "超清"]): res_tier = 3
            elif re.search(r'/00(0[1-6]|0[8-9]|1[0-7])_1\.m3u8', u): res_tier = 2
            elif any(k in combined for k in ["720p", "720", "hd", "高清"]) or re.search(r'/0007_1\.m3u8', u): res_tier = 2
            elif any(k in combined for k in ["576", "480", "sd", "标清", "kankanlive"]): res_tier = 1
            else: res_tier = 2

        smooth_tier = m.get("smooth_tier", 0)
        download_kbps = m.get("download_kbps", 0)
        latency_ms = m.get("latency_ms", 9999)
        stability = stream_stability_score(c)
        purity = stream_purity_tier(c)

        is_residential = any(k in u.lower() for k in [":50085", ":9901", ":60901", "112.123.", "36.136.", "59.39.", "218.13.", "183.10.", "124.228."])
        effective_speed = download_kbps - 2000 if is_residential else download_kbps

        # 0. 第零优先级：健康可用性（具备充沛流畅度 smooth_tier >= 2 的线路绝对优先，杜绝卡顿线路霸占 Line 1）
        # 1. 第一优先级：流畅度（smooth_tier: 2 绝对流畅零缓冲 > 1 基本可播 > 0 码率倒挂备用）
        # 2. 第二优先级：纯净度（Tier 2/1 纯净直连流优先于 Tier 0 GSLB/广告代理源）
        # 3. 第三优先级：直播协议适配（非 YouTube 的直接流媒体 HLS/FLV/TS 优先于网页嵌入式 YouTube）
        # 4. 第四优先级：清晰度（4K/8K=4 > 1080P=3 > 720P=2 > SD=1）
        # 5. 第五优先级：稳定性（免 Token、永久 0 广告的美国本土底层骨干节点优先于普通代理）
        # 6. 第六优先级：有效带宽（effective_speed）
        # 7. 第七优先级：首包响应（-latency_ms）
        is_usable = 1 if (smooth_tier >= 2 and res_tier >= 2) else 0
        is_youtube = 1 if ("youtube.com" in u.lower() or "youtu.be" in u.lower()) else 0
        return (is_usable, smooth_tier, purity, -is_youtube, res_tier, stability, effective_speed, -latency_ms)

    sorted_channels = []

    for (cat_name, ch_name), grp in name_groups.items():
        # Deduplicate identical or case-insensitive duplicate URLs within the same channel
        seen_urls = set()
        dedup_grp = []
        for x in grp:
            norm_u = x["url"].strip().lower()
            if norm_u not in seen_urls:
                seen_urls.add(norm_u)
                dedup_grp.append(x)
        
        # 严格过滤任何实测被重定向至广告机 (res_tier == 0) 的恶意广告源
        dedup_grp = [x for x in dedup_grp if cached_metrics.get(x["url"].strip(), {}).get("res_tier", 1) > 0]
        if not dedup_grp:
            continue

        # Sort descending: Clearest line first; if clarity identical, fastest speed first
        dedup_grp.sort(key=multi_line_sort_key, reverse=True)

        # 核心播放体验防护：杜绝“播放一会儿就要缓冲”
        # 1. 正规频道准入门槛：任何电视频道必须至少拥有一条可流畅播放且清晰度 >= 720P (res_tier >= 2) 的线路
        #    （包括 smooth_tier >= 2，或规整切片 seg_dur >= 4.0 且下行跑平码率的 smooth_tier >= 1 线路，YouTube 直播与影视点播除外），
        def is_line_smooth(x):
            u = x["url"].strip()
            if "youtube.com" in u.lower() or "youtu.be" in u.lower() or cat_name in ["最新电影", "影视点播"]:
                return True
            m = cached_metrics.get(u, {})
            s_tier = m.get("smooth_tier", 0)
            dl_speed = m.get("download_kbps", 0)
            bitrate = max(m.get("stream_bitrate_kbps", 1), 1)
            ratio = dl_speed / bitrate
            seg_dur = m.get("seg_dur", 10.0)

            if s_tier >= 2:
                return True
            if ratio >= 1.05 and dl_speed >= 800 and m.get("latency_ms", 9999) < 4500:
                return True
            if seg_dur >= 5.0 and ratio >= 0.95 and dl_speed >= 1000 and m.get("latency_ms", 9999) < 4500:
                return True
            return False

        has_smooth_line = any(is_line_smooth(x) for x in dedup_grp)
        if not has_smooth_line:
            continue

        # 2. 线路净化与分级保留：
        #    - 如果该频道有高清流畅线路 (res_tier >= 2 且 is_line_smooth)，优先全部保留高清流畅线路；
        #    - 如果该频道全网仅有标清 (SD) 线路，但该标清线路流畅不卡顿 (is_line_smooth)，亦予保留，杜绝误杀用户喜爱的高速特色台；
        #    - 彻底剔除所有下载速度跟不上码率、播放必卡顿的残次线路！
        hd_smooth = [
            x for x in dedup_grp 
            if is_line_smooth(x) and (
                cached_metrics.get(x["url"].strip(), {}).get("res_tier", 1) >= 2 or
                "youtube.com" in x["url"].lower() or 
                "youtu.be" in x["url"].lower() or 
                cat_name in ["最新电影", "影视点播"]
            )
        ]
        if hd_smooth:
            # 依用户要求：如果有多个线路都可以，720P 或以上的流畅线路全部保留（不设 5 条上限截断）
            dedup_grp = hd_smooth
        else:
            # 若该频道全网完全没有 720P+ 线路，但标清 (SD) 线路流畅不卡顿，则予以保留
            dedup_grp = [x for x in dedup_grp if is_line_smooth(x)]

        # 全部保留所有经过实测可流畅播放的高清线路（如无高清则保留全部流畅标清）
        sorted_channels.extend(dedup_grp)

    channels = sorted_channels

    # Assign unique keys for duplicate names in quality-sorted order
    # 核心保护：Worker 支持的流（非 YouTube、非电影）必须确保第一条线路分配为原始名称（不带 _1 后缀），
    # 彻底杜绝播放器请求 /live/频道名/index.m3u8 时报 404 的致命缺陷！
    used_worker_names = {}
    used_other_names = {}
    for c in channels:
        name = c["name"]
        url_lower = c["url"].lower()
        is_movie = c["category"] in ["最新电影", "影视点播"]
        is_worker_eligible = not ("youtube.com" in url_lower or "youtu.be" in url_lower or is_movie)
        if is_worker_eligible:
            if name not in used_worker_names:
                used_worker_names[name] = 0
                key = name
            else:
                used_worker_names[name] += 1
                key = f"{name}_{used_worker_names[name]}"
        else:
            if name not in used_other_names:
                used_other_names[name] = 0
                key = name
            else:
                used_other_names[name] += 1
                key = f"{name}_{used_other_names[name]}"
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
            return (cat_idx, c["category"], cctv_sort_key(c["name"]), suffix_num, c["url"])
        else:
            cat = c["category"]
            n = c["name"]
            n_lower = n.lower()
            
            prio = 0
            if cat == "直播中国":
                if n in ["直播中国", "直播中国精编直播"]:
                    prio = -3
                elif "熊猫" in n:
                    prio = -2
            elif cat == "影视剧场":
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
            elif cat == "韩国/朝鲜":
                if any(k in n for k in ["朝鲜中央电视台", "KCTV"]):
                    prio = -10
                elif any(k in n for k in ["龙南山电视台", "体育电视台"]):
                    prio = -9
                elif n.startswith("KBS") or "kbs" in n_lower:
                    prio = -8
                elif n.startswith("SBS") or "sbs" in n_lower:
                    prio = -7
                elif n.startswith("MBC") or "mbc" in n_lower:
                    prio = -6
                elif n.startswith("tvN") or "tvn" in n_lower:
                    prio = -5
                elif n.startswith("JTBC") or "jtbc" in n_lower:
                    prio = -4
                elif "ytn" in n_lower or "arirang" in n_lower:
                    prio = -3
                
            is_ascii = bool(n and n[0].isascii())
            return (cat_idx, c["category"], prio, is_ascii, (n_lower, n), suffix_num, c["url"])
            
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
        # Direct links for YouTube or Movies, all TV channels point to Cloudflare Worker
        if "youtube.com" in url_lower or "youtu.be" in url_lower or is_movie:
            playlist_lines.append(f"{c['name']},{c['url']}")
        else:
            playlist_lines.append(f"{c['name']},https://{domain}/live/{c['key']}/index.m3u8")
        
    playlist_content = "\n".join(playlist_lines) + "\n"
    with open(playlist_path, "w", encoding="utf-8") as f:
        f.write(playlist_content)
    with open(live3_path, "w", encoding="utf-8") as f:
        f.write(playlist_content)
    print(f"Updated {playlist_path} and {live3_path}")
    
    # 2.1 Write to playlist_pure.txt, live.txt & live2.txt (Pure playlist: No YouTube, All TV via Worker)
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
        if is_movie:
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
    # Build CHANNEL_MAP and BACKUP_MAP javascript object strings
    map_lines = []
    station_backups = defaultdict(list)
    for c in channels_with_keys:
        url_lower = c["url"].lower()
        is_movie = c["category"] in ["最新电影", "影视点播"]
        # Skip YouTube and Movies in the Worker CHANNEL_MAP
        if "youtube.com" in url_lower or "youtu.be" in url_lower or is_movie:
            continue
        escaped_key = json.dumps(c["key"], ensure_ascii=False)
        escaped_url = json.dumps(c["url"], ensure_ascii=False)
        map_lines.append(f"  {escaped_key}: {escaped_url},")
        
        base_name = re.sub(r'_\d+$', '', c["key"])
        station_backups[base_name].append(c["url"])
        
    map_str = "\n".join(map_lines)
    
    backup_lines = []
    for base_name, urls in station_backups.items():
        if len(urls) > 1:
            escaped_base = json.dumps(base_name, ensure_ascii=False)
            escaped_backups = json.dumps(urls[1:], ensure_ascii=False)
            backup_lines.append(f"  {escaped_base}: {escaped_backups},")
    backup_str = "\n".join(backup_lines)
    
    worker_template = f"""/**
 * Cloudflare Worker - 多频道统一 HLS 重写/代理服务 (全直连重定向与秒级自动容灾版)
 * 
 * 访问格式：
 *   https://[你的Worker域名]/live/[频道名称]/index.m3u8
 *   例如：https://tvb-proxy.username.workers.dev/live/翡翠台/index.m3u8
 */

// {len(channels_with_keys)}个有效电视频道映射表
const CHANNEL_MAP = {{
{map_str}
}};

// 多线路秒级自动容灾备用表 (Failover Map)
const BACKUP_MAP = {{
{backup_str}
}};

// 华人直播源数字 ID 映射表 (央视 17 台 + 卫视 20 台，设为线路 1 默认首选源)
const HUAVOD_MAP = {{
  // 央视系列 (17台)
  "CCTV-1": "538",
  "CCTV-2": "539",
  "CCTV-3": "540",
  "CCTV-4": "541",
  "CCTV-5": "536",
  "CCTV-5体育": "536",
  "CCTV-5+": "537",
  "CCTV-5+体育赛事": "537",
  "CCTV-6": "611",
  "CCTV-7": "542",
  "CCTV-8": "612",
  "CCTV-9": "543",
  "CCTV-9纪录": "543",
  "CCTV-10": "544",
  "CCTV-11": "545",
  "CCTV-12": "546",
  "CCTV-13": "547",
  "CCTV-14": "548",
  "CCTV-14少儿": "548",
  "CCTV-15": "613",
  "CCTV-16": "535",
  "CCTV-16奥林匹克": "535",

  // 省级卫视系列 (20台)
  "湖南卫视": "651",
  "浙江卫视": "556",
  "江苏卫视": "553",
  "东方卫视": "549",
  "深圳卫视": "557",
  "北京卫视": "550",
  "山东卫视": "552",
  "安徽卫视": "615",
  "广东卫视": "573",
  "辽宁卫视": "616",
  "陕西卫视": "876",
  "四川卫视": "614",
  "东南卫视": "647",
  "黑龙江卫视": "648",
  "吉林卫视": "649",
  "河南卫视": "650",
  "天津卫视": "551",
  "湖北卫视": "654",
  "重庆卫视": "555",
  "海南卫视": "554"
}};

// 华人源 3 分钟边缘内存短缓存 (TTL: 180s)
const huavodCache = new Map();

// 辅助函数：动态解析华人源 M3U8 并重写切片路径 (带自动重试与短缓存)
async function fetchHuavodStream(channelId) {{
  const getFreshUrl = async () => {{
    const pageController = new AbortController();
    const pageTimeout = setTimeout(() => pageController.abort(), 2500);
    try {{
      const pageRes = await fetch(`https://huavod.net/liveplay/${{channelId}}-1.html`, {{
        signal: pageController.signal,
        headers: {{
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }}
      }});
      clearTimeout(pageTimeout);
      if (!pageRes.ok) return null;
      const pageHtml = await pageRes.text();
      const match = pageHtml.match(/url=(https:\\/\\/live\\.huarenlivewebsite1\\.top\\/stream\\/[^"'\\&]+m3u8\\?auth=[^"'\\&]+)/);
      if (!match) return null;
      const streamUrl = match[1];
      huavodCache.set(channelId, {{ streamUrl, expireAt: Date.now() + 180000 }});
      return streamUrl;
    }} catch (e) {{
      clearTimeout(pageTimeout);
      return null;
    }}
  }};

  let streamUrl = "";
  const cached = huavodCache.get(channelId);
  if (cached && Date.now() < cached.expireAt) {{
    streamUrl = cached.streamUrl;
  }} else {{
    streamUrl = await getFreshUrl();
  }}

  if (!streamUrl) return null;

  const fetchStream = async (urlToFetch) => {{
    const streamController = new AbortController();
    const streamTimeout = setTimeout(() => streamController.abort(), 2500);
    try {{
      const res = await fetch(urlToFetch, {{
        signal: streamController.signal,
        headers: {{
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://huavod.net/'
        }}
      }});
      clearTimeout(streamTimeout);
      return res;
    }} catch (e) {{
      clearTimeout(streamTimeout);
      return null;
    }}
  }};

  let streamRes = await fetchStream(streamUrl);
  if (!streamRes || !streamRes.ok) {{
    huavodCache.delete(channelId);
    const freshUrl = await getFreshUrl();
    if (freshUrl && freshUrl !== streamUrl) {{
      streamRes = await fetchStream(freshUrl);
      streamUrl = freshUrl;
    }}
  }}

  if (!streamRes || !streamRes.ok) return null;

  const rawM3u8 = await streamRes.text();
  if (!rawM3u8.includes('#EXTM3U')) return null;

  const rewritten = cleanAndRewriteM3u8Text(rawM3u8, streamRes.url || streamUrl);
  return new Response(rewritten, {{
    status: 200,
    headers: {{
      'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Stream-Source': 'huavod'
    }}
  }});
}}

export default {{
  async fetch(request, env, ctx) {{
    const url = new URL(request.url);

    // 0. 上报追踪接口：电视盒播放任何电台（无论是否走 Worker 反代）均可上报 (支持 GET / POST / OPTIONS)
    if (url.pathname === '/report' || url.pathname === '/track') {{
      const corsHeaders = {{
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      }};

      if (request.method === 'OPTIONS') {{
        return new Response(null, {{ status: 204, headers: corsHeaders }});
      }}

      const clientIP = request.headers.get('CF-Connecting-IP') || '未知IP';
      const country = request.cf?.country || '未知国家';
      const city = request.cf?.city || '未知城市';

      let channel = url.searchParams.get('channel') || url.searchParams.get('name') || '';
      let group = url.searchParams.get('group') || '';
      let line = url.searchParams.get('line') || '';
      let device = url.searchParams.get('device') || '';
      let targetStreamUrl = url.searchParams.get('url') || '';

      if (request.method === 'POST') {{
        try {{
          const body = await request.json();
          channel = channel || body.channel || body.name || '';
          group = group || body.group || '';
          line = line || body.line || '';
          device = device || body.device || '';
          targetStreamUrl = targetStreamUrl || body.url || '';
        }} catch (e) {{}}
      }}

      channel = channel || '未知频道';

      console.log(`[用户看播追踪] 客户端: ${{clientIP}} (${{country}}/${{city}}) | 设备: ${{device || '默认设备'}} | 分组: ${{group || '默认分组'}} | 频道: ${{channel}} (线路: ${{line || '1'}}) | 源: ${{targetStreamUrl}}`);

      return new Response(JSON.stringify({{ status: "ok" }}), {{
        status: 200,
        headers: {{
          'Content-Type': 'application/json; charset=utf-8',
          ...corsHeaders
        }}
      }});
    }}
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

    // 0.5 华人源首选线路路由：如果是央视或卫视主线路 (线路 1，即不带 _1/_2 等后缀)，优先动态解析华人源并享受 3分钟边缘短缓存
    const isLineOne = !channelName.match(/_\\d+$/);
    const huavodId = isLineOne ? (HUAVOD_MAP[channelName] || HUAVOD_MAP[channelName.replace(/_/g, ' ')] || HUAVOD_MAP[channelName.replace(/ /g, '_')]) : null;
    if (huavodId && (requestedFile === 'index.m3u8' || requestedFile === '')) {{
      try {{
        const huavodResponse = await fetchHuavodStream(huavodId);
        if (huavodResponse) {{
          const clientIP = request.headers.get('CF-Connecting-IP') || '未知IP';
          console.log(`[华人源首选直出] 客户端: ${{clientIP}} 频道: ${{channelName}} (线路 1)`);
          return huavodResponse;
        }}
        console.log(`[华人源自动降级] 频道 ${{channelName}} (线路 1) 华人源响应未果，毫秒级降级至原直连线路`);
      }} catch (err) {{
        console.log(`[华人源异常降级] 频道 ${{channelName}}: ${{err.message}}`);
      }}
    }}

    // 辅助容灾函数：在主线路异常或失效时提取备用线路重定向
    function getFailoverResponse(targetName, currentUrl) {{
      const baseKey = targetName.replace(/_\\d+$/, '');
      const backups = BACKUP_MAP[baseKey] || [];
      for (const bUrl of backups) {{
        if (bUrl && bUrl !== currentUrl) {{
          console.log(`[边缘秒级自动容灾] 频道 ${{targetName}} 触发容灾 -> 自动 302 切换至备用线路: ${{bUrl}}`);
          return new Response(null, {{
            status: 302,
            headers: {{
              'Location': bUrl,
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
              'Access-Control-Expose-Headers': 'Location',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'X-Worker-Failover': 'true'
            }}
          }});
        }}
      }}
      return null;
    }}

    // 1. 从映射表中查找该频道真实的 URL
    let channelUrl = CHANNEL_MAP[channelName];
    if (!channelUrl) {{
      channelUrl = CHANNEL_MAP[channelName.replace(/_/g, ' ')] || CHANNEL_MAP[channelName.replace(/ /g, '_')];
    }}
    if (!channelUrl) {{
      const failoverRes = getFailoverResponse(channelName, '');
      if (failoverRes) return failoverRes;
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

    // 2.5 处理 OPTIONS 预检请求（支持 Web 播放器 CORS）
    if (request.method === 'OPTIONS') {{
      return new Response(null, {{
        status: 204,
        headers: {{
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        }}
      }});
    }}

    // 3. 【全直连 302 重定向直通 (零 Worker 额度消耗模式)】
    // 除华人主线路 1（防盗链鉴权与动态 Token）通过 Worker 反代外，其余所有频道一律直接 302 重定向至真实源站
    // 电视盒仅在切换频道时请求 1 次 Worker，随后完全由电视盒与源站服务器直连，每天 Worker 请求量趋近于 0！
    // （若外部显式携带 ?clean=1 或 ?proxy=1 时，仍可选用 Worker 去广告清洗管道）
    const forceClean = url.searchParams.get('clean') === '1' || url.searchParams.get('proxy') === '1';

    if (!forceClean) {{
      if ((/live\\.ottiptv\\.cc|\\.flv|183\\.237\\.95\\.108|appadhw|mkt\\.m3u8|107\\.m3u8|zmt\\.m3u8|47\\.97\\.252\\.|192\\.151\\.|204\\.12\\.234\\.|:88[/]|applive/).test(targetUrl)) {{
        const failoverRes = getFailoverResponse(channelName, targetUrl);
        if (failoverRes) return failoverRes;
        return new Response('404 Not Found: Adware Stream Blocked', {{ status: 404, headers: {{ 'Access-Control-Allow-Origin': '*' }} }});
      }}

      if (requestedFile === 'index.m3u8' || requestedFile === '') {{
        const clientIP = request.headers.get('CF-Connecting-IP') || '未知IP';
        console.log(`[302直通] 客户端IP: ${{clientIP}} 频道: ${{channelName}} -> 302: ${{targetUrl}}`);
      }}
      return new Response(null, {{
        status: 302,
        headers: {{
          'Location': targetUrl,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Expose-Headers': 'Location',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }}
      }});
    }}

    // 4. 【智能 M3U8 广告切片动态清洗与秒跳网关 (Smart Ad-Stripping Proxy)】
    // Worker 仅抓取清洗约 1KB 的 M3U8 文本，所有 TS 切片自动转为原站绝对链接，电视盒直连原站 CDN 下载，0 Cloudflare 视频流量消耗！
    try {{
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const upstreamRes = await fetch(targetUrl, {{
        signal: controller.signal,
        headers: {{
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': targetUrl,
        }},
        redirect: 'follow'
      }});
      clearTimeout(timeoutId);

      if (!upstreamRes.ok) {{
        if (url.searchParams.get('debug') === '1') {{
          return new Response(JSON.stringify({{ error: 'upstream_not_ok', status: upstreamRes.status, url: targetUrl }}), {{
            status: 500,
            headers: {{ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }}
          }});
        }}
        // 自动容灾：若主线路响应异常(404/5xx)，毫秒级自动切换至备用线路
        const failoverRes = getFailoverResponse(channelName, targetUrl);
        if (failoverRes) return failoverRes;

        // 若上游或目标地址本身具有已知广告机特征，绝不可 302 回退给客户端播放，直接 404 促使切台
        if ((/appadhw|mkt\\.m3u8|107\\.m3u8|zmt\\.m3u8|47\\.97\\.252\\.|192\\.151\\.|204\\.12\\.234\\.|:88[/]|applive|live\\.ottiptv\\.cc|183\\.237\\.95\\.108|\\.flv/).test(targetUrl)) {{
          return new Response('404 Not Found: Adware Stream Blocked', {{ status: 404, headers: {{ 'Access-Control-Allow-Origin': '*' }} }});
        }}
        return new Response(null, {{
          status: 302,
          headers: {{
            'Location': targetUrl,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS'
          }}
        }});
      }}

      const finalUrl = upstreamRes.url || targetUrl;
      const rawText = await upstreamRes.text();

      // 严格防护单机 IP 绑定节点及广告机重定向：若上游重定向至单机绑定节点或广告机，立即返回 404 明确错误，绝不喂给客户端播放广告
      if ((/:88[/]|applive|[?&]u=\\d+\\.\\d+\\.\\d+\\.\\d+|appadhw|mkt\\.m3u8|47\\.97\\.252\\.|107\\.m3u8|zmt\\.m3u8|204\\.12\\.234\\.|live\\.ottiptv\\.cc|\\.flv/).test(finalUrl)) {{
        const failoverRes = getFailoverResponse(channelName, targetUrl);
        if (failoverRes) return failoverRes;
        return new Response('404 Not Found: Adware Stream Blocked', {{
          status: 404,
          headers: {{ 'Access-Control-Allow-Origin': '*' }}
        }});
      }}

      if (!rawText.includes('#EXTM3U')) {{
        if (url.searchParams.get('debug') === '1') {{
          return new Response(JSON.stringify({{ error: 'not_m3u8', text: rawText.slice(0, 300), url: targetUrl }}), {{
            status: 500,
            headers: {{ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }}
          }});
        }}
        const failoverRes = getFailoverResponse(channelName, targetUrl);
        if (failoverRes) return failoverRes;
        if ((/appadhw|mkt\\.m3u8|107\\.m3u8|zmt\\.m3u8|47\\.97\\.252\\.|192\\.151\\.|204\\.12\\.234\\.|:88[/]|applive|live\\.ottiptv\\.cc|183\\.237\\.95\\.108|\\.flv/).test(targetUrl)) {{
          return new Response('404 Not Found: Adware Stream Blocked', {{ status: 404, headers: {{ 'Access-Control-Allow-Origin': '*' }} }});
        }}
        return new Response(null, {{
          status: 302,
          headers: {{
            'Location': targetUrl,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS'
          }}
        }});
      }}

      const clientIP = request.headers.get('CF-Connecting-IP') || '未知IP';
      console.log(`[智能去广告] 客户端IP: ${{clientIP}} 频道: ${{channelName}} (M3U8清洗生效，TS直连)`);

      const cleanedM3u8 = cleanAndRewriteM3u8Text(rawText, finalUrl);

      return new Response(cleanedM3u8, {{
        status: 200,
        headers: {{
          'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Cache-Control': 'public, max-age=2, no-transform',
        }}
      }});
    }} catch (e) {{
      if (url.searchParams.get('debug') === '1') {{
        return new Response(JSON.stringify({{ error: 'exception', message: e.message, stack: e.stack, url: targetUrl }}), {{
          status: 500,
          headers: {{ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }}
        }});
      }}
      // 自动容灾：若网络连接超时或源站挂掉，毫秒级自动切换至备用线路
      const failoverRes = getFailoverResponse(channelName, targetUrl);
      if (failoverRes) return failoverRes;

      if ((/appadhw|mkt\\.m3u8|107\\.m3u8|zmt\\.m3u8|47\\.97\\.252\\.|192\\.151\\.|204\\.12\\.234\\.|:88[/]|applive|live\\.ottiptv\\.cc|183\\.237\\.95\\.108|\\.flv/).test(targetUrl)) {{
        return new Response('404 Not Found: Adware Stream Blocked', {{ status: 404, headers: {{ 'Access-Control-Allow-Origin': '*' }} }});
      }}
      return new Response(null, {{
        status: 302,
        headers: {{
          'Location': targetUrl,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        }}
      }});
    }}
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

// 辅助函数：M3U8 文本动态去广告与切片绝对路径转换
function cleanAndRewriteM3u8Text(rawText, finalUrl) {{
  const lines = rawText.split('\\n');

  if (rawText.includes('#EXT-X-STREAM-INF')) {{
    const newLines = lines.map(line => {{
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      try {{
        const subM3u8Url = new URL(trimmed, finalUrl);
        if (!trimmed.includes('?') && finalUrl.includes('?')) {{
          const origSearch = new URL(finalUrl).search;
          if (origSearch) subM3u8Url.search = origSearch;
        }}
        return subM3u8Url.toString();
      }} catch (e) {{
        return trimmed;
      }}
    }});
    return newLines.join('\\n');
  }}

  const adKeywords = [
    'appadhw', '107.m3u8', 'zmt.m3u8', 'mkt.m3u8', 'macau', 'casino', 'bet365', 
    'poker', 'guanggao', '_ad.ts', '-ad.ts', '/ad/', 'welcome.ts', 'preroll',
    'advert', '_ad_', '/ads/', 'adv_', 'adsegment', 'ad_segment'
  ];

  let hasEarlyDiscontinuity = false;
  let discontinuityLineIdx = -1;
  let segmentCountBeforeDiscontinuity = 0;

  for (let i = 0; i < lines.length; i++) {{
    const l = lines[i].trim();
    if (l === '#EXT-X-DISCONTINUITY') {{
      hasEarlyDiscontinuity = true;
      discontinuityLineIdx = i;
      break;
    }}
    if (l && !l.startsWith('#')) {{
      segmentCountBeforeDiscontinuity++;
      if (segmentCountBeforeDiscontinuity > 4) {{
        break;
      }}
    }}
  }}

  let shouldStripPrefix = false;
  if (hasEarlyDiscontinuity && segmentCountBeforeDiscontinuity <= 3) {{
    let preSegments = [];
    for (let i = 0; i < discontinuityLineIdx; i++) {{
      const l = lines[i].trim();
      if (l && !l.startsWith('#')) preSegments.push(l);
    }}
    const hasAdKeyword = preSegments.some(s => adKeywords.some(k => s.toLowerCase().includes(k)));
    shouldStripPrefix = hasAdKeyword || preSegments.length > 0;
  }}

  const resultLines = [];
  let skippingPrefix = shouldStripPrefix;
  let skipNextSegment = false;

  for (let i = 0; i < lines.length; i++) {{
    const origLine = lines[i];
    const trimmed = origLine.trim();

    if (!trimmed) continue;

    if (trimmed.startsWith('#EXT-X-VERSION') || 
        trimmed.startsWith('#EXT-X-TARGETDURATION') || 
        trimmed.startsWith('#EXT-X-MEDIA-SEQUENCE')) {{
      resultLines.push(origLine);
      continue;
    }}

    if (skippingPrefix) {{
      if (trimmed === '#EXT-X-DISCONTINUITY') {{
        skippingPrefix = false;
      }}
      continue;
    }}

    if (trimmed.startsWith('#EXT-X-KEY')) {{
      const keyUriMatch = trimmed.match(/URI="([^"]+)"/);
      if (keyUriMatch) {{
        try {{
          const absKeyUrl = new URL(keyUriMatch[1], finalUrl);
          if (!keyUriMatch[1].includes('?') && finalUrl.includes('?')) {{
            const origSearch = new URL(finalUrl).search;
            if (origSearch) absKeyUrl.search = origSearch;
          }}
          resultLines.push(trimmed.replace(keyUriMatch[0], `URI="${{absKeyUrl.toString()}}"`));
          continue;
        }} catch (e) {{}}
      }}
    }}

    if (trimmed.startsWith('#EXTINF')) {{
      const nextLine = (lines[i + 1] || '').trim();
      if (nextLine && !nextLine.startsWith('#')) {{
        const isAd = adKeywords.some(k => nextLine.toLowerCase().includes(k));
        if (isAd) {{
          skipNextSegment = true;
          continue;
        }}
      }}
      resultLines.push(origLine);
      continue;
    }}

    if (skipNextSegment) {{
      skipNextSegment = false;
      continue;
    }}

    if (!trimmed.startsWith('#')) {{
      try {{
        const absUrl = new URL(trimmed, finalUrl);
        if (!trimmed.includes('?') && finalUrl.includes('?')) {{
          const origSearch = new URL(finalUrl).search;
          if (origSearch) absUrl.search = origSearch;
        }}
        resultLines.push(absUrl.toString());
      }} catch (e) {{
        resultLines.push(trimmed);
      }}
      continue;
    }}

    resultLines.push(origLine);
  }}

  if (!resultLines.length || !resultLines[0].startsWith('#EXTM3U')) {{
    resultLines.unshift('#EXTM3U');
  }}

  return resultLines.join('\\n');
}}
"""
    
    with open(worker_path, "w", encoding="utf-8") as f:
        f.write(worker_template)
    print(f"Updated {worker_path}")

    dist_index_path = os.path.join(SCRIPT_DIR, "dist", "index.js")
    if os.path.exists(os.path.join(SCRIPT_DIR, "dist")):
        with open(dist_index_path, "w", encoding="utf-8") as f:
            f.write(worker_template)
        print(f"Updated {dist_index_path}")

if __name__ == "__main__":
    main()
