import re

channels = []
with open("/Users/jundelin/Dev/HMTV_Channels/valid_channels.txt", "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line or "," not in line:
            continue
        parts = line.split(",", 1)
        name = parts[0].strip()
        url = parts[1].strip()
        channels.append((name, url))

# Rebuild the exact same keys as in the Worker map
channel_keys = []
used_names = {}
for name, url in channels:
    base_name = name
    if name not in used_names:
        used_names[name] = 0
        key = name
    else:
        used_names[name] += 1
        key = f"{name}_{used_names[name]}"
    channel_keys.append((name, key))

# Categories mapping
categories = {
    "CCTV央视频道": [],
    "港澳台": [],
    "地方卫视": [],
    "体育频道": [],
    "电影经典": [],
    "其他频道": []
}

def get_category(name):
    name_lower = name.lower()
    if "cctv" in name_lower:
        return "CCTV央视频道"
    if "体育" in name or "赛事" in name or "奥林匹克" in name:
        return "体育频道"
    if any(x in name_lower for x in ["tvb", "翡翠", "明珠台", "无线", "hoy", "viu", "now", "rthk", "千禧", "星河", "澳", "macau", "中天", "tvbs", "寰宇", "台视", "中视", "华视", "东森", "三立", "民视", "台湾", "客家", "凤凰", "wcetv"]):
        return "港澳台"
    if any(x in name for x in ["广东", "广州", "湖南", "云南", "卫视"]):
        return "地方卫视"
    if any(x in name for x in ["电影", "经典", "剧集", "戏剧", "武侠", "布袋戏", "美亚", "天映", "龙华", "aod", "aec", "欢喜", "爱奇艺", "iqiyi"]):
        return "电影经典"
    return "其他频道"

for name, key in channel_keys:
    cat = get_category(name)
    categories[cat].append((name, key))

# Sort helper for CCTV to sort numerically
def cctv_sort_key(item):
    name = item[0]
    match = re.search(r'cctv[-]?(\d+)', name.lower())
    if match:
        return (0, int(match.group(1)), name)
    return (1, 0, name)

categories["CCTV央视频道"].sort(key=cctv_sort_key)

# Sort other categories alphabetically by name
for cat in categories:
    if cat != "CCTV央视频道":
        categories[cat].sort(key=lambda x: (x[0], x[1]))

domain = "round-snowflake-2d83.linda11-28-2022.workers.dev"

# Generate output
output_lines = []
for cat, items in categories.items():
    if not items:
        continue
    output_lines.append(f"{cat},#genre#")
    for name, key in items:
        output_lines.append(f"{name},https://{domain}/live/{key}/index.m3u8")

with open("/Users/jundelin/Dev/HMTV_Channels/playlist.txt", "w", encoding="utf-8") as out_f:
    out_f.write("\n".join(output_lines) + "\n")

print("Playlist TXT generated successfully.")
