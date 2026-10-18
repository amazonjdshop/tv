package com.hm.tvlauncher.model;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class WeatherData implements Serializable {
    private String cityName = "自动定位";
    private int temperature = 25;
    private int maxTemp = 28;
    private int minTemp = 20;
    private int weatherCode = 0;
    private String conditionName = "晴";
    private String humidity = "60%";
    private String windSpeed = "3.2 m/s";
    private long updateTime = 0;
    private List<DailyForecast> dailyList = new ArrayList<>();

    public static class DailyForecast implements Serializable {
        public String date;      // e.g. "周一 10/19"
        public int weatherCode;  // WMO
        public String condition; // "晴"
        public int maxTemp;      // 28
        public int minTemp;      // 20

        public DailyForecast() {}

        public DailyForecast(String date, int weatherCode, String condition, int maxTemp, int minTemp) {
            this.date = date;
            this.weatherCode = weatherCode;
            this.condition = condition;
            this.maxTemp = maxTemp;
            this.minTemp = minTemp;
        }
    }

    public String getCityName() {
        return cityName;
    }

    public void setCityName(String cityName) {
        this.cityName = cityName;
    }

    public int getTemperature() {
        return temperature;
    }

    public void setTemperature(int temperature) {
        this.temperature = temperature;
    }

    public int getMaxTemp() {
        return maxTemp;
    }

    public void setMaxTemp(int maxTemp) {
        this.maxTemp = maxTemp;
    }

    public int getMinTemp() {
        return minTemp;
    }

    public void setMinTemp(int minTemp) {
        this.minTemp = minTemp;
    }

    public int getWeatherCode() {
        return weatherCode;
    }

    public void setWeatherCode(int weatherCode) {
        this.weatherCode = weatherCode;
    }

    public String getConditionName() {
        return conditionName;
    }

    public void setConditionName(String conditionName) {
        this.conditionName = conditionName;
    }

    public String getHumidity() {
        return humidity;
    }

    public void setHumidity(String humidity) {
        this.humidity = humidity;
    }

    public String getWindSpeed() {
        return windSpeed;
    }

    public void setWindSpeed(String windSpeed) {
        this.windSpeed = windSpeed;
    }

    public long getUpdateTime() {
        return updateTime;
    }

    public void setUpdateTime(long updateTime) {
        this.updateTime = updateTime;
    }

    public List<DailyForecast> getDailyList() {
        if (dailyList == null) {
            dailyList = new ArrayList<>();
        }
        return dailyList;
    }

    public void setDailyList(List<DailyForecast> dailyList) {
        this.dailyList = dailyList;
    }
}
