package com.hm.tvlauncher.weather;

import com.hm.tvlauncher.R;

public class WeatherCodeMapper {

    public static String getConditionText(int code) {
        switch (code) {
            case 0:
                return "晴";
            case 1:
            case 2:
                return "多云";
            case 3:
                return "阴";
            case 45:
            case 48:
                return "有雾";
            case 51:
            case 53:
            case 55:
                return "毛毛雨";
            case 61:
                return "小雨";
            case 63:
                return "中雨";
            case 65:
                return "大雨";
            case 71:
            case 73:
            case 75:
                return "降雪";
            case 80:
            case 81:
            case 82:
                return "阵雨";
            case 95:
            case 96:
            case 99:
                return "雷阵雨";
            default:
                return "晴";
        }
    }

    public static int getWeatherIcon(int code) {
        switch (code) {
            case 0:
                return R.drawable.ic_weather_sunny;
            case 1:
            case 2:
                return R.drawable.ic_weather_cloudy;
            case 3:
            case 45:
            case 48:
                return R.drawable.ic_weather_overcast;
            case 51:
            case 53:
            case 55:
            case 61:
            case 63:
            case 65:
            case 80:
            case 81:
            case 82:
                return R.drawable.ic_weather_rain;
            case 71:
            case 73:
            case 75:
            case 77:
            case 85:
            case 86:
                return R.drawable.ic_weather_snow;
            case 95:
            case 96:
            case 99:
                return R.drawable.ic_weather_thunder;
            default:
                return R.drawable.ic_weather_sunny;
        }
    }
}
