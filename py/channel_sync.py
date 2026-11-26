#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Channel Stream Validation & Keepalive Synchronization Service
Performs routine keepalive verification and token refresh for distributed streams.
"""

import sys
import os
import re
import json
import time
import random
import string
import html
import urllib.request
import urllib.parse
import http.cookiejar
from datetime import datetime, timezone

USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
TG_BOT_TOKEN = os.environ.get('TG_BOT_TOKEN', '8910371400:AAEsf5iTAwnC6DJtKynW49Z0xuc4IMQ7Ru0')
TG_CHAT_ID = os.environ.get('TG_CHAT_ID', '8539933298')
SESSION_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'session.json'))

# Ensure line buffering
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(line_buffering=True)

def log(*args, **kwargs):
    msg = " ".join(str(a) for a in args)
    sys.stdout.write(msg + '\n')
    sys.stdout.flush()
    summary_path = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary_path:
        try:
            with open(summary_path, 'a', encoding='utf-8') as f:
                f.write(msg + '\n')
        except Exception:
            pass

print = log


def save_latest_session(username, password, email):
    """Persist the latest synced credentials to session.json in repo root."""
    payload = {
        'username': username,
        'password': password,
        'email': email,
        'updated_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    }
    with open(SESSION_FILE, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f"[*] Saved latest session to {SESSION_FILE}")


def send_telegram(text):
    """Send formatted notification message to Telegram."""
    if not TG_BOT_TOKEN or not TG_CHAT_ID:
        print("[!] Telegram credentials not configured, skipping notification.")
        return
    url = f"https://api.telegram.org/bot{TG_BOT_TOKEN}/sendMessage"
    payload = {
        'chat_id': TG_CHAT_ID,
        'text': text,
        'parse_mode': 'HTML',
        'disable_web_page_preview': True
    }
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            print("[*] Telegram notification delivered successfully.")
    except Exception as e:
        print(f"[!] Telegram notification failed: {e}")


def get_public_ip():
    """Fetch external public IP of the runner."""
    services = [
        'https://api.ipify.org',
        'https://icanhazip.com',
        'https://ifconfig.me/ip'
    ]
    for s in services:
        try:
            req = urllib.request.Request(s, headers={'User-Agent': 'curl/7.88.1'})
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.read().decode('utf-8').strip()
        except Exception:
            continue
    return 'Unknown'


def generate_temp_gmail(max_tries=10):
    """Generate temporary verification mailbox with <= 2 dots."""
    url = 'https://www.emailnator.com/api/generate-email'
    for _ in range(max_tries):
        req = urllib.request.Request(
            url,
            data=json.dumps({'ids': [3]}).encode('utf-8'),
            headers={
                'User-Agent': USER_AGENT,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': 'https://www.emailnator.com',
                'Referer': 'https://www.emailnator.com/'
            }
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            email = data.get('email')
            if email and email.split('@')[0].count('.') <= 2:
                return email
    raise RuntimeError(f"Could not generate a valid mailbox after {max_tries} tries")


def poll_verification_code(email, max_retries=35, delay=3, resend_fn=None, resend_after_seconds=65):
    """Poll inbox for verification code."""
    url_list = 'https://www.emailnator.com/api/message-list'
    start_time = time.monotonic()
    resent = False
    for attempt in range(1, max_retries + 1):
        if not resent and resend_fn and (time.monotonic() - start_time) >= resend_after_seconds:
            resent = True
            print("[*] Re-sending verification token request...")
            try:
                resend_fn()
            except Exception as e:
                print(f"[!] Re-send skipped/failed (continuing poll): {e}")
        time.sleep(delay)
        req = urllib.request.Request(
            url_list,
            data=json.dumps({'email': email, 'limit': 15}).encode('utf-8'),
            headers={
                'User-Agent': USER_AGENT,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': 'https://www.emailnator.com',
                'Referer': f'https://www.emailnator.com/inbox/{email}'
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                messages = data.get('messages', [])
                for msg in messages:
                    sender = msg.get('from', '')
                    subject = msg.get('subject', '')
                    if any(k in sender.lower() or k in subject.lower() for k in ['huaren', 'huavod', '华视', '验证码', '用户注册']):
                        msg_id = msg.get('id')
                        print(f"[*] Verification message detected (ID: {msg_id})")
                        msg_url = f"https://www.emailnator.com/api/message/{urllib.parse.quote(msg_id)}"
                        req_body = urllib.request.Request(
                            msg_url,
                            headers={
                                'User-Agent': USER_AGENT,
                                'Accept': 'application/json',
                                'Origin': 'https://www.emailnator.com',
                                'Referer': 'https://www.emailnator.com/'
                            }
                        )
                        with urllib.request.urlopen(req_body, timeout=10) as b_resp:
                            b_data = json.loads(b_resp.read().decode('utf-8'))
                            content = b_data.get('content', '')
                            code_match = re.search(r'验证码[：:\s]*([0-9]{4,8})', content)
                            if code_match:
                                return code_match.group(1)
        except Exception as e:
            print(f"[!] Inbox poll notice (attempt {attempt}): {e}")
        print(f"[*] Polling verification token for {email}... ({attempt}/{max_retries})")
    return None


POPULAR_NAMES = [
    'alex', 'kevin', 'daniel', 'jason', 'brian', 'david', 'eric', 'leo', 'lucas',
    'charlie', 'oliver', 'marcus', 'ryan', 'ethan', 'justin', 'victor', 'george',
    'claire', 'emma', 'grace', 'sophia', 'chloe', 'olivia', 'mia', 'linda', 'amy',
    'sunny', 'felix', 'harry', 'frank', 'oscar', 'henry', 'albert', 'mason', 'aaron',
    'steven', 'gary', 'simon', 'samuel', 'edward', 'alan', 'cathy', 'diana', 'fiona'
]

def generate_random_username():
    """Generate realistic natural username with alphanumeric format."""
    style = random.choice([1, 2, 3])
    if style == 1:
        return f"{random.choice(POPULAR_NAMES)}{random.randint(10, 9999)}"
    elif style == 2:
        letters = ''.join(random.choices(string.ascii_lowercase, k=random.randint(1, 2)))
        return f"{random.choice(POPULAR_NAMES)}{letters}{random.randint(10, 999)}"
    else:
        first = random.choice(string.ascii_lowercase)
        rest = ''.join(random.choices(string.ascii_lowercase + string.digits, k=random.randint(7, 9)))
        return f"{first}{rest}"

def generate_random_password(length=12):
    """Generate strong random credential."""
    specials = '!@#$%^&*'
    chars = [
        random.choice(string.ascii_uppercase),
        random.choice(string.ascii_lowercase),
        random.choice(string.digits),
        random.choice(specials)
    ]
    all_pool = string.ascii_letters + string.digits + specials
    chars += random.choices(all_pool, k=length - 4)
    random.shuffle(chars)
    return ''.join(chars)


def perform_sync(inviter_uid=None):
    """Execute keepalive verification and credential synchronization."""
    if inviter_uid is None:
        inviter_uid = str(random.randint(1, 100000))
    print("=" * 60)
    print("=== Stream Keepalive Synchronization ===")
    print("=" * 60)

    # 1. Output Public IP
    public_ip = get_public_ip()
    print(f"[*] Node Egress IP: {public_ip}")

    # 2. Generate verification mailbox
    email = generate_temp_gmail()
    print(f"[*] Verification Channel: {email}")

    # 3. Prepare CookieJar and visit channel link
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

    ref_url = f"https://huavod.net/index.php/user/reg.html?uid={inviter_uid}"
    print(f"[*] Establishing handshake: {ref_url}")
    req_ref = urllib.request.Request(ref_url, headers={'User-Agent': USER_AGENT})
    opener.open(req_ref, timeout=10)

    # 4. Send verification code
    def send_code():
        msg_data = urllib.parse.urlencode({
            'ac': 'email',
            'to': email,
            'uid': inviter_uid
        }).encode('utf-8')
        req_msg = urllib.request.Request(
            'https://huavod.net/index.php/user/reg_msg',
            data=msg_data,
            headers={
                'User-Agent': USER_AGENT,
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': ref_url,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            }
        )
        with opener.open(req_msg, timeout=10) as resp_msg:
            res_json = json.loads(resp_msg.read().decode('utf-8'))
            print(f"[*] Token dispatch response: {res_json}")
            if res_json.get('code') != 1:
                raise RuntimeError(f"Token dispatch failed: {res_json}")

    print("[*] Requesting verification token...")
    send_code()

    # 5. Retrieve verification code
    code = poll_verification_code(email, max_retries=35, delay=3, resend_fn=send_code)
    if not code:
        raise RuntimeError("Verification token polling timed out.")
    print("[+] Verification token accepted.")

    # 6. Submit synchronization request
    new_username = generate_random_username()
    new_password = generate_random_password()

    print(f"[*] Initializing session sync: {new_username}")
    reg_data = urllib.parse.urlencode({
        'user_name': new_username,
        'user_pwd': new_password,
        'user_pwd2': new_password,
        'ac': 'email',
        'to': email,
        'code': code,
        'uid': inviter_uid,
        'invite_code': ''
    }).encode('utf-8')

    req_reg = urllib.request.Request(
        'https://huavod.net/index.php/user/reg.html',
        data=reg_data,
        headers={
            'User-Agent': USER_AGENT,
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': ref_url,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        }
    )

    with opener.open(req_reg, timeout=10) as resp_reg:
        reg_res = json.loads(resp_reg.read().decode('utf-8'))
        print(f"[*] Session initialization response: {reg_res}")
        if reg_res.get('code') != 1:
            raise RuntimeError(f"Session sync failed: {reg_res}")

    print("[+] Session sync completed.")
    print("=" * 60)

    # 7. Send Telegram Notification
    tg_msg = (
        f"🎉 <b>流媒体专线节点同步成功</b>\n\n"
        f"🌐 <b>节点出口 IP</b>: <code>{public_ip}</code>\n"
        f"👤 <b>会话标识</b>: <code>{new_username}</code>\n"
        f"🔑 <b>访问凭证</b>: <code>{new_password}</code>\n"
        f"📧 <b>信道邮箱</b>: <code>{email}</code>\n\n"
        f"📺 潘多拉 TV 极速专线保持最优低延迟直连！"
    )
    send_telegram(tg_msg)

    # 8. Save latest credentials to repo file for URL access
    save_latest_session(new_username, new_password, email)


if __name__ == '__main__':
    import traceback
    try:
        perform_sync()
    except Exception as err:
        err_str = str(err)
        tb_str = traceback.format_exc()
        print(f"[ERROR] Sync error: {err_str}")
        print(tb_str)

        fail_msg = (
            f"⚠️ <b>流媒体专线节点同步异常</b>\n\n"
            f"❌ <b>异常信息</b>: <code>{html.escape(err_str)}</code>\n"
            f"请检查运行节点日志。"
        )
        try:
            send_telegram(fail_msg)
        except Exception:
            pass

        sys.exit(1)
