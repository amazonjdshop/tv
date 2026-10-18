package com.hm.tvlauncher.manager;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;

import com.hm.tvlauncher.model.AppInfo;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class AppManager {
    private static final String TAG = "AppManager";

    public interface AppChangeListener {
        void onAppsChanged();
    }

    private static AppManager instance;
    private Context context;
    private final List<AppInfo> installedApps = new ArrayList<>();
    private final Map<String, AppInfo> appMap = new HashMap<>();
    private final List<AppChangeListener> listeners = new ArrayList<>();

    private final BroadcastReceiver packageReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            Log.d(TAG, "Package broadcast received: " + intent.getAction());
            loadInstalledApps();
            notifyAppsChanged();
        }
    };

    public static synchronized AppManager getInstance() {
        if (instance == null) {
            instance = new AppManager();
        }
        return instance;
    }

    public void init(Context context) {
        this.context = context.getApplicationContext();
        loadInstalledApps();
        registerPackageReceiver();
    }

    private void registerPackageReceiver() {
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_PACKAGE_ADDED);
        filter.addAction(Intent.ACTION_PACKAGE_REMOVED);
        filter.addAction(Intent.ACTION_PACKAGE_REPLACED);
        filter.addDataScheme("package");
        context.registerReceiver(packageReceiver, filter);
    }

    public synchronized void loadInstalledApps() {
        installedApps.clear();
        appMap.clear();

        PackageManager pm = context.getPackageManager();
        String myPackage = context.getPackageName();

        // 1. Query standard launcher apps
        Intent mainIntent = new Intent(Intent.ACTION_MAIN, null);
        mainIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> resolveInfos = pm.queryIntentActivities(mainIntent, 0);

        // 2. Query Leanback TV launcher apps
        Intent leanbackIntent = new Intent(Intent.ACTION_MAIN, null);
        leanbackIntent.addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER);
        List<ResolveInfo> leanbackInfos = pm.queryIntentActivities(leanbackIntent, 0);

        Map<String, ResolveInfo> merged = new HashMap<>();
        if (resolveInfos != null) {
            for (ResolveInfo ri : resolveInfos) {
                if (ri.activityInfo != null) {
                    merged.put(ri.activityInfo.packageName, ri);
                }
            }
        }
        if (leanbackInfos != null) {
            for (ResolveInfo ri : leanbackInfos) {
                if (ri.activityInfo != null) {
                    merged.put(ri.activityInfo.packageName, ri);
                }
            }
        }

        for (ResolveInfo ri : merged.values()) {
            ActivityInfo ai = ri.activityInfo;
            if (ai == null || ai.packageName.equals(myPackage)) {
                continue;
            }

            try {
                String pkg = ai.packageName;
                String cls = ai.name;
                String label = ri.loadLabel(pm).toString();
                Drawable icon = ri.loadIcon(pm);

                ApplicationInfo appInfo = pm.getApplicationInfo(pkg, 0);
                boolean isSystem = (appInfo.flags & ApplicationInfo.FLAG_SYSTEM) != 0;
                long installTime = pm.getPackageInfo(pkg, 0).firstInstallTime;

                AppInfo info = new AppInfo(pkg, cls, label, icon, isSystem, installTime);
                installedApps.add(info);
                appMap.put(pkg, info);
            } catch (Exception e) {
                Log.w(TAG, "Error loading app info for " + ai.packageName, e);
            }
        }

        // Sort alphabetically by app name
        Collections.sort(installedApps, (a, b) -> a.getAppName().compareToIgnoreCase(b.getAppName()));
    }

    public List<AppInfo> getInstalledApps() {
        return new ArrayList<>(installedApps);
    }

    public AppInfo getAppByPackage(String pkg) {
        return appMap.get(pkg);
    }

    public void addListener(AppChangeListener listener) {
        if (!listeners.contains(listener)) {
            listeners.add(listener);
        }
    }

    public void removeListener(AppChangeListener listener) {
        listeners.remove(listener);
    }

    private void notifyAppsChanged() {
        for (AppChangeListener l : listeners) {
            l.onAppsChanged();
        }
    }

    public void launchApp(Context ctx, AppInfo appInfo) {
        if (appInfo == null) return;
        try {
            PackageManager pm = ctx.getPackageManager();
            Intent intent = pm.getLaunchIntentForPackage(appInfo.getPackageName());
            if (intent != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(intent);
            } else {
                Toast.makeText(ctx, "无法启动应用: " + appInfo.getAppName(), Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) {
            Toast.makeText(ctx, "启动失败: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    public void openAppDetails(Context ctx, String pkg) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + pkg));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(ctx, "无法打开应用详情", Toast.LENGTH_SHORT).show();
        }
    }

    public void uninstallApp(Context ctx, String pkg) {
        try {
            Intent intent = new Intent(Intent.ACTION_DELETE);
            intent.setData(Uri.parse("package:" + pkg));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(ctx, "无法发起卸载", Toast.LENGTH_SHORT).show();
        }
    }
}
