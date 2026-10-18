package com.hm.tvlauncher.util;

import java.util.Calendar;

/**
 * Chinese Lunar Calendar Calculator (1900 - 2100)
 */
public class LunarCalendarUtil {

    private static final long[] LUNAR_INFO = new long[]{
            0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
            0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
            0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
            0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
            0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
            0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5d0, 0x14573, 0x052d0, 0x0a9a8, 0x0e950, 0x06aa0,
            0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
            0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b5a0, 0x195a6,
            0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
            0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
            0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
            0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
            0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
            0x05aa0, 0x076a3, 0x096d0, 0x04bd7, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
            0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0
    };

    private static final String[] CHINESE_NUMBER = {"一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"};
    private static final String[] CHINESE_DAY = {
            "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
            "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
            "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"
    };

    public static String getLunarString(Calendar cal) {
        int year = cal.get(Calendar.YEAR);
        int month = cal.get(Calendar.MONTH) + 1;
        int day = cal.get(Calendar.DAY_OF_MONTH);

        Calendar baseDate = Calendar.getInstance();
        baseDate.set(1900, Calendar.JANUARY, 31, 0, 0, 0);

        long offset = (cal.getTimeInMillis() - baseDate.getTimeInMillis()) / 86400000L;

        int iYear = 1900;
        int daysOfYear = 0;
        for (iYear = 1900; iYear < 2050 && offset > 0; iYear++) {
            daysOfYear = yearDays(iYear);
            offset -= daysOfYear;
        }

        if (offset < 0) {
            offset += daysOfYear;
            iYear--;
        }

        int leapMonth = leapMonth(iYear);
        boolean isLeap = false;
        int iMonth = 1;
        int daysOfMonth = 0;

        for (iMonth = 1; iMonth < 13 && offset > 0; iMonth++) {
            if (leapMonth > 0 && iMonth == (leapMonth + 1) && !isLeap) {
                --iMonth;
                isLeap = true;
                daysOfMonth = leapDays(iYear);
            } else {
                daysOfMonth = monthDays(iYear, iMonth);
            }

            if (isLeap && iMonth == (leapMonth + 1)) {
                isLeap = false;
            }

            offset -= daysOfMonth;
        }

        if (offset == 0 && leapMonth > 0 && iMonth == leapMonth + 1) {
            if (isLeap) {
                isLeap = false;
            } else {
                isLeap = true;
                --iMonth;
            }
        }

        if (offset < 0) {
            offset += daysOfMonth;
            --iMonth;
        }

        int iDay = (int) offset + 1;

        String monthStr = (isLeap ? "闰" : "") + (iMonth == 1 ? "正" : CHINESE_NUMBER[iMonth - 1]) + "月";
        String dayStr = (iDay <= 30 && iDay >= 1) ? CHINESE_DAY[iDay - 1] : "";

        return "农历" + monthStr + dayStr;
    }

    private static int yearDays(int y) {
        int i, sum = 348;
        for (i = 0x8000; i > 0x8; i >>= 1) {
            if ((LUNAR_INFO[y - 1900] & i) != 0) sum += 1;
        }
        return (sum + leapDays(y));
    }

    private static int leapDays(int y) {
        if (leapMonth(y) != 0) {
            if ((LUNAR_INFO[y - 1900] & 0x10000) != 0)
                return 30;
            else
                return 29;
        } else
            return 0;
    }

    private static int leapMonth(int y) {
        return (int) (LUNAR_INFO[y - 1900] & 0xf);
    }

    private static int monthDays(int y, int m) {
        if ((LUNAR_INFO[y - 1900] & (0x10000 >> m)) == 0)
            return 29;
        else
            return 30;
    }
}
