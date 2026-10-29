#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Huavod (华视影院) VIP Auto-Renewal & Referral Script
Runs in GitHub Actions on a daily randomized schedule using dynamic Azure IPs.
Registers a referral account under linda1030 (uid=78018) via Emailnator temporary Gmail,
extending linda1030's VIP membership by 1 day every day, and sending notifications to Telegram.
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

LINDA_UID = '78018'
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
TG_BOT_TOKEN = os.environ.get('TG_BOT_TOKEN', '8910371400:AAEsf5iTAwnC6DJtKynW49Z0xuc4IMQ7Ru0')
TG_CHAT_ID = os.environ.get('TG_CHAT_ID', '8539933298')

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


def get_linda_vip_status():
    """Query linda1030's current VIP expiration date by logging in."""
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    login_data = urllib.parse.urlencode({
        'user_name': 'linda1030',
        'user_pwd': 'Qwer1234'
    }).encode('utf-8')

    req_login = urllib.request.Request(
        'https://huavod.net/index.php/user/login.html',
        data=login_data,
        headers={
            'User-Agent': USER_AGENT,
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://huavod.net/index.php/user/login.html',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        }
    )

    try:
        opener.open(req_login, timeout=10)
        req_idx = urllib.request.Request(
            'https://huavod.net/index.php/user/index.html',
            headers={'User-Agent': USER_AGENT}
        )
        with opener.open(req_idx, timeout=10) as resp:
            content = resp.read().decode('utf-8')
            for line in content.split('\n'):
                if '会员至' in line:
                    clean = re.sub(r'<[^>]+>', '', line).strip()
                    return clean
    except Exception as e:
        print(f"[!] Error checking VIP status: {e}")
    return 'Unknown'


def generate_temp_gmail(max_tries=10):
    """Generate temporary Gmail dotGmail address via Emailnator with <= 2 dots."""
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
    raise RuntimeError(f"Could not generate a valid Gmail with <= 2 dots after {max_tries} tries")


def poll_verification_code(email, max_retries=30, delay=3, resend_fn=None):
    """Poll Emailnator inbox for verification code from huavod / huaren."""
    url_list = 'https://www.emailnator.com/api/message-list'
    for attempt in range(1, max_retries + 1):
        if attempt == 12 and resend_fn:
            print("[*] Re-sending verification code (SMTP retry)...")
            resend_fn()
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
                        print(f"[*] Found email: '{subject}' from '{sender}' (ID: {msg_id})")
                        # Fetch message content
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
            print(f"[!] Inbox poll error (attempt {attempt}): {e}")
        print(f"[*] Polling inbox for {email}... (attempt {attempt}/{max_retries})")
    return None


POPULAR_NAMES = [
    'alex', 'kevin', 'daniel', 'jason', 'brian', 'david', 'eric', 'leo', 'lucas',
    'charlie', 'oliver', 'marcus', 'ryan', 'ethan', 'justin', 'victor', 'george',
    'claire', 'emma', 'grace', 'sophia', 'chloe', 'olivia', 'mia', 'linda', 'amy',
    'sunny', 'felix', 'harry', 'frank', 'oscar', 'henry', 'albert', 'mason', 'aaron',
    'steven', 'gary', 'simon', 'samuel', 'edward', 'alan', 'cathy', 'diana', 'fiona'
]

def generate_random_username():
    """Generate natural, human-like username with no predictable prefix (letters + numbers only)."""
    style = random.choice([1, 2, 3])
    if style == 1:
        # name + 2 to 4 digits (e.g. kevin8821)
        return f"{random.choice(POPULAR_NAMES)}{random.randint(10, 9999)}"
    elif style == 2:
        # name + 1-2 random letters + 2-3 digits (e.g. jasonk92)
        letters = ''.join(random.choices(string.ascii_lowercase, k=random.randint(1, 2)))
        return f"{random.choice(POPULAR_NAMES)}{letters}{random.randint(10, 999)}"
    else:
        # random 8-10 natural alphanumeric string starting with a letter
        first = random.choice(string.ascii_lowercase)
        rest = ''.join(random.choices(string.ascii_lowercase + string.digits, k=random.randint(7, 9)))
        return f"{first}{rest}"

def generate_random_password(length=12):
    """Generate high-entropy random password with mixed cases, numbers, and symbols."""
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


def register_referral_account(inviter_uid=LINDA_UID):
    """Perform full referral registration on huavod.net."""
    print("=" * 60)
    print("=== Huavod VIP Auto-Renewal & Referral Job ===")
    print("=" * 60)

    # 1. Output Public IP
    public_ip = get_public_ip()
    print(f"[*] Runner Public IP: {public_ip}")

    # 2. Check linda1030 VIP baseline
    vip_before = get_linda_vip_status()
    print(f"[*] linda1030 VIP Before: {vip_before}")

    # 3. Generate temp Gmail
    email = generate_temp_gmail()
    print(f"[*] Generated Email: {email}")

    # 4. Prepare CookieJar and visit referral link
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

    ref_url = f"https://huavod.net/index.php/user/reg.html?uid={inviter_uid}"
    print(f"[*] Visiting referral link: {ref_url}")
    req_ref = urllib.request.Request(ref_url, headers={'User-Agent': USER_AGENT})
    opener.open(req_ref, timeout=10)

    cookies = {c.name: c.value for c in cj}
    print(f"[*] Initial session cookies: {cookies}")

    # 5. Send verification code
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
            print(f"[*] reg_msg response: {res_json}")
            if res_json.get('code') != 1:
                raise RuntimeError(f"Failed to send verification code: {res_json}")

    print("[*] Requesting verification code...")
    send_code()

    # 6. Retrieve verification code
    code = poll_verification_code(email, max_retries=30, delay=3, resend_fn=send_code)
    if not code:
        raise RuntimeError("Timed out waiting for verification code email.")
    print(f"[+] Verification code received: {code}")

    # 7. Submit registration
    new_username = generate_random_username()
    new_password = generate_random_password()

    print(f"[*] Submitting registration for new user: {new_username}")
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
        print(f"[*] Registration response: {reg_res}")
        if reg_res.get('code') != 1:
            raise RuntimeError(f"Registration failed: {reg_res}")

    print("[+] Registration successful!")

    # 8. Check linda1030 VIP after registration
    time.sleep(3)
    vip_after = get_linda_vip_status()
    print("=" * 60)
    print(f"[*] linda1030 VIP Before: {vip_before}")
    print(f"[+] linda1030 VIP After : {vip_after}")
    print("=" * 60)

    # 9. Send Telegram Notification
    tg_msg = (
        f"🎉 <b>华视影院 VIP 自动续期成功</b>\n\n"
        f"🌐 <b>出口 IP</b>: <code>{public_ip}</code> (Azure)\n"
        f"👤 <b>新注册小号</b>: <code>{new_username}</code>\n"
        f"🔑 <b>小号密码</b>: <code>{new_password}</code>\n"
        f"📧 <b>临时邮箱</b>: <code>{email}</code>\n\n"
        f"💎 <b>主账号</b>: <code>linda1030</code> (UID: {inviter_uid})\n"
        f"⏳ <b>续期前状态</b>: {vip_before}\n"
        f"✅ <b>续期后状态</b>: <b>{vip_after}</b>\n\n"
        f"📺 潘多拉 TV 华盛顿专线保持 VIP 极速免广告！"
    )
    send_telegram(tg_msg)


if __name__ == '__main__':
    import traceback
    try:
        register_referral_account()
    except Exception as err:
        err_str = str(err)
        tb_str = traceback.format_exc()
        print(f"[ERROR] Script encountered an error: {err_str}")
        print(tb_str)

        # Notify Telegram on failure
        fail_msg = (
            f"⚠️ <b>华视影院 VIP 自动续期任务异常</b>\n\n"
            f"❌ <b>错误详情</b>: <code>{html.escape(err_str)}</code>\n"
            f"请检查 GitHub Actions 执行详情。"
        )
        try:
            send_telegram(fail_msg)
        except Exception:
            pass

        sys.exit(1)
