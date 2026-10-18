package com.hm.tvlauncher.ui.dialog;

import android.app.Dialog;
import android.content.Context;
import android.os.Bundle;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;

import com.hm.tvlauncher.R;
import com.hm.tvlauncher.databinding.DialogWeatherDetailBinding;
import com.hm.tvlauncher.model.WeatherData;
import com.hm.tvlauncher.weather.WeatherCodeMapper;
import com.hm.tvlauncher.weather.WeatherService;

import java.util.List;

public class WeatherDetailDialog extends Dialog {

    private DialogWeatherDetailBinding binding;

    public WeatherDetailDialog(@NonNull Context context) {
        super(context, R.style.TVDialogTheme);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = DialogWeatherDetailBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        Window window = getWindow();
        if (window != null) {
            window.setLayout(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT);
            window.setGravity(Gravity.CENTER);
        }

        setupData();

        binding.btnWeatherClose.setOnClickListener(v -> dismiss());
        binding.btnWeatherClose.requestFocus();
    }

    private void setupData() {
        WeatherData data = WeatherService.getInstance().getCurrentWeatherData();
        if (data == null) return;

        binding.tvWeatherCity.setText(String.format("当前城市: %s", data.getCityName()));
        binding.ivDetailIcon.setImageResource(WeatherCodeMapper.getWeatherIcon(data.getWeatherCode()));
        binding.tvDetailTemp.setText(String.format("%d°C", data.getTemperature()));
        binding.tvDetailCondition.setText(data.getConditionName());
        binding.tvDetailHumidity.setText(String.format("空气湿度: %s", data.getHumidity()));
        binding.tvDetailWind.setText(String.format("当前风速: %s", data.getWindSpeed()));

        // Populate 5-day forecast
        List<WeatherData.DailyForecast> dailyList = data.getDailyList();
        binding.llForecastContainer.removeAllViews();

        LayoutInflater inflater = LayoutInflater.from(getContext());
        for (WeatherData.DailyForecast df : dailyList) {
            View card = inflater.inflate(R.layout.item_weather_forecast, binding.llForecastContainer, false);
            TextView tvDate = card.findViewById(R.id.tvForecastDate);
            ImageView ivIcon = card.findViewById(R.id.ivForecastIcon);
            TextView tvCondition = card.findViewById(R.id.tvForecastCondition);
            TextView tvTempRange = card.findViewById(R.id.tvForecastTempRange);

            tvDate.setText(df.date);
            ivIcon.setImageResource(WeatherCodeMapper.getWeatherIcon(df.weatherCode));
            tvCondition.setText(df.condition);
            tvTempRange.setText(String.format("%d° ~ %d°", df.minTemp, df.maxTemp));

            binding.llForecastContainer.addView(card);
        }
    }
}
