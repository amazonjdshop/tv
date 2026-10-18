package com.hm.tvlauncher.manager;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import com.hm.tvlauncher.model.AppInfo;
import com.hm.tvlauncher.model.DesktopItem;
import com.hm.tvlauncher.model.FolderInfo;

import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;

public class DesktopConfigManager {
    private static final String TAG = "DesktopConfigManager";
    private static final String PREF_NAME = "desktop_pref";
    private static final String KEY_PINNED_APPS = "pinned_apps_json";

    public interface DesktopChangeListener {
        void onDesktopChanged();
    }

    private static DesktopConfigManager instance;
    private Context context;
    private SharedPreferences sp;
    private final List<String> pinnedAppPackages = new ArrayList<>();
    private final List<DesktopChangeListener> listeners = new ArrayList<>();

    public static synchronized DesktopConfigManager getInstance() {
        if (instance == null) {
            instance = new DesktopConfigManager();
        }
        return instance;
    }

    public void init(Context context) {
        this.context = context.getApplicationContext();
        this.sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        loadPinnedApps();
    }

    private synchronized void loadPinnedApps() {
        pinnedAppPackages.clear();
        String json = sp.getString(KEY_PINNED_APPS, null);
        if (json != null) {
            try {
                Type listType = new TypeToken<List<String>>() {}.getType();
                List<String> loaded = new Gson().fromJson(json, listType);
                if (loaded != null) {
                    pinnedAppPackages.addAll(loaded);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error loading pinned apps", e);
            }
        }

        // On first launch, pin top 6 installed apps
        if (pinnedAppPackages.isEmpty()) {
            List<AppInfo> all = AppManager.getInstance().getInstalledApps();
            int count = Math.min(all.size(), 6);
            for (int i = 0; i < count; i++) {
                pinnedAppPackages.add(all.get(i).getPackageName());
            }
            savePinnedApps();
        }
    }

    public synchronized void savePinnedApps() {
        try {
            String json = new Gson().toJson(pinnedAppPackages);
            sp.edit().putString(KEY_PINNED_APPS, json).apply();
            notifyDesktopChanged();
        } catch (Exception e) {
            Log.e(TAG, "Error saving pinned apps", e);
        }
    }

    public synchronized void pinApp(String pkg) {
        if (!pinnedAppPackages.contains(pkg)) {
            pinnedAppPackages.add(pkg);
            savePinnedApps();
        }
    }

    public synchronized void unpinApp(String pkg) {
        if (pinnedAppPackages.remove(pkg)) {
            savePinnedApps();
        }
    }

    public synchronized boolean isAppPinned(String pkg) {
        return pinnedAppPackages.contains(pkg);
    }

    public synchronized List<DesktopItem> buildDesktopItems() {
        List<DesktopItem> items = new ArrayList<>();

        // 1. Add all folders
        List<FolderInfo> folders = FolderManager.getInstance().getAllFolders();
        for (FolderInfo f : folders) {
            items.add(DesktopItem.createFolderItem(f));
        }

        // 2. Add pinned apps
        for (String pkg : pinnedAppPackages) {
            AppInfo app = AppManager.getInstance().getAppByPackage(pkg);
            if (app != null) {
                items.add(DesktopItem.createAppItem(app));
            }
        }

        // 3. Add (+) Button
        items.add(DesktopItem.createAddItem());

        return items;
    }

    public void addListener(DesktopChangeListener listener) {
        if (!listeners.contains(listener)) {
            listeners.add(listener);
        }
    }

    public void removeListener(DesktopChangeListener listener) {
        listeners.remove(listener);
    }

    private void notifyDesktopChanged() {
        for (DesktopChangeListener l : listeners) {
            l.onDesktopChanged();
        }
    }
}
