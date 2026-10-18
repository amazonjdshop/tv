package com.hm.tvlauncher;

import android.app.Application;
import android.content.Context;
import com.hm.tvlauncher.manager.AppManager;
import com.hm.tvlauncher.manager.FolderManager;
import com.hm.tvlauncher.manager.DesktopConfigManager;
import com.hm.tvlauncher.weather.WeatherService;

public class App extends Application {

    private static App instance;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;

        // Initialize Managers
        AppManager.getInstance().init(this);
        FolderManager.getInstance().init(this);
        DesktopConfigManager.getInstance().init(this);
        WeatherService.getInstance().init(this);
    }

    public static App getInstance() {
        return instance;
    }

    public static Context getContext() {
        return instance.getApplicationContext();
    }
}
