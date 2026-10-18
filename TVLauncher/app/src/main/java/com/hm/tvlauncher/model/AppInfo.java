package com.hm.tvlauncher.model;

import android.graphics.drawable.Drawable;

public class AppInfo {
    private String packageName;
    private String className;
    private String appName;
    private transient Drawable icon;
    private boolean isSystemApp;
    private long firstInstallTime;

    public AppInfo() {}

    public AppInfo(String packageName, String className, String appName, Drawable icon, boolean isSystemApp, long firstInstallTime) {
        this.packageName = packageName;
        this.className = className;
        this.appName = appName;
        this.icon = icon;
        this.isSystemApp = isSystemApp;
        this.firstInstallTime = firstInstallTime;
    }

    public String getPackageName() {
        return packageName;
    }

    public void setPackageName(String packageName) {
        this.packageName = packageName;
    }

    public String getClassName() {
        return className;
    }

    public void setClassName(String className) {
        this.className = className;
    }

    public String getAppName() {
        return appName;
    }

    public void setAppName(String appName) {
        this.appName = appName;
    }

    public Drawable getIcon() {
        return icon;
    }

    public void setIcon(Drawable icon) {
        this.icon = icon;
    }

    public boolean isSystemApp() {
        return isSystemApp;
    }

    public void setSystemApp(boolean systemApp) {
        isSystemApp = systemApp;
    }

    public long getFirstInstallTime() {
        return firstInstallTime;
    }

    public void setFirstInstallTime(long firstInstallTime) {
        this.firstInstallTime = firstInstallTime;
    }
}
