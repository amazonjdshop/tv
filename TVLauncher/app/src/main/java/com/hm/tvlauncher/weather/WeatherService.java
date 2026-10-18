package com.hm.tvlauncher.weather;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.google.gson.Gson;
import com.hm.tvlauncher.model.WeatherData;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class WeatherService {
    private static final String TAG = "WeatherService";
    private static final String PREF_NAME = "weather_pref";
    private static final String KEY_CACHED_WEATHER = "cached_weather_json";

    private static WeatherService instance;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Context context;
    private SharedPreferences sp;
    private WeatherData currentWeatherData;
    private final List<WeatherCallback> callbacks = new ArrayList<>();

    public interface WeatherCallback {
        void onWeatherUpdated(WeatherData data);
    }

    public static synchronized WeatherService getInstance() {
        if (instance == null) {
            instance = new WeatherService();
        }
        return instance;
    }

    public void init(Context context) {
        this.context = context.getApplicationContext();
        this.sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        loadFromCache();
    }

    public WeatherData getCurrentWeatherData() {
        if (currentWeatherData == null) {
            currentWeatherData = new WeatherData();
        }
        return currentWeatherData;
    }

    public void registerCallback(WeatherCallback callback) {
        if (!callbacks.contains(callback)) {
            callbacks.add(callback);
            if (currentWeatherData != null) {
                callback.onWeatherUpdated(currentWeatherData);
            }
        }
    }

    public void unregisterCallback(WeatherCallback callback) {
        callbacks.remove(callback);
    }

    private void loadFromCache() {
        String json = sp.getString(KEY_CACHED_WEATHER, null);
        if (json != null) {
            try {
                currentWeatherData = new Gson().fromJson(json, WeatherData.class);
            } catch (Exception e) {
                Log.e(TAG, "Failed to parse cached weather", e);
            }
        }
        if (currentWeatherData == null) {
            currentWeatherData = new WeatherData();
        }
    }

    public void refreshWeather() {
        executor.execute(() -> {
            try {
                // 1. IP Geolocation
                double lat = 39.9042; // Fallback Beijing
                double lon = 116.4074;
                String city = "北京";

                try {
                    String ipResp = getHttpRequest("http://ip-api.com/json/?fields=status,country,city,lat,lon");
                    JSONObject ipJson = new JSONObject(ipResp);
                    if ("success".equalsIgnoreCase(ipJson.optString("status"))) {
                        lat = ipJson.getDouble("lat");
                        lon = ipJson.getDouble("lon");
                        city = ipJson.optString("city", "未知城市");
                    }
                } catch (Exception e) {
                    Log.w(TAG, "IP Geolocation failed, using fallback or default", e);
                }

                // 2. Open-Meteo Weather API (Free, high accuracy, worldwide)
                String weatherUrl = String.format(Locale.US,
                        "https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto",
                        lat, lon);

                String weatherResp = getHttpRequest(weatherUrl);
                JSONObject wJson = new JSONObject(weatherResp);

                JSONObject current = wJson.getJSONObject("current");
                int currentTemp = (int) Math.round(current.getDouble("temperature_2m"));
                int humidityVal = current.getInt("relative_humidity_2m");
                int wCode = current.getInt("weather_code");
                double wind = current.getDouble("wind_speed_10m");

                WeatherData data = new WeatherData();
                data.setCityName(city);
                data.setTemperature(currentTemp);
                data.setWeatherCode(wCode);
                data.setConditionName(WeatherCodeMapper.getConditionText(wCode));
                data.setHumidity(humidityVal + "%");
                data.setWindSpeed(String.format(Locale.US, "%.1f m/s", wind));
                data.setUpdateTime(System.currentTimeMillis());

                // 3. Daily Forecast
                if (wJson.has("daily")) {
                    JSONObject daily = wJson.getJSONObject("daily");
                    JSONArray timeArr = daily.getJSONArray("time");
                    JSONArray codeArr = daily.getJSONArray("weather_code");
                    JSONArray maxArr = daily.getJSONArray("temperature_2m_max");
                    JSONArray minArr = daily.getJSONArray("temperature_2m_min");

                    List<WeatherData.DailyForecast> forecasts = new ArrayList<>();
                    SimpleDateFormat inFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.CHINA);
                    SimpleDateFormat outFormat = new SimpleDateFormat("E MM/dd", Locale.CHINA);

                    int count = Math.min(timeArr.length(), 5);
                    for (int i = 0; i < count; i++) {
                        String rawDate = timeArr.getString(i);
                        String formattedDate = rawDate;
                        try {
                            Date d = inFormat.parse(rawDate);
                            if (d != null) {
                                formattedDate = (i == 0) ? "今天" : outFormat.format(d);
                            }
                        } catch (Exception ignored) {}

                        int fcCode = codeArr.getInt(i);
                        int maxT = (int) Math.round(maxArr.getDouble(i));
                        int minT = (int) Math.round(minArr.getDouble(i));
                        forecasts.add(new WeatherData.DailyForecast(formattedDate, fcCode, WeatherCodeMapper.getConditionText(fcCode), maxT, minT));
                    }
                    data.setDailyList(forecasts);
                    if (!forecasts.isEmpty()) {
                        data.setMaxTemp(forecasts.get(0).maxTemp);
                        data.setMinTemp(forecasts.get(0).minTemp);
                    }
                }

                currentWeatherData = data;
                // Save cache
                sp.edit().putString(KEY_CACHED_WEATHER, new Gson().toJson(data)).apply();

                // Notify UI
                mainHandler.post(() -> {
                    for (WeatherCallback cb : callbacks) {
                        cb.onWeatherUpdated(data);
                    }
                });

            } catch (Exception e) {
                Log.e(TAG, "Error fetching weather data", e);
            }
        });
    }

    private String getHttpRequest(String urlStr) throws Exception {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(8000);
        conn.connect();

        int responseCode = conn.getResponseCode();
        if (responseCode == HttpURLConnection.HTTP_OK) {
            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            reader.close();
            return sb.toString();
        } else {
            throw new Exception("HTTP request failed with code: " + responseCode);
        }
    }
}
