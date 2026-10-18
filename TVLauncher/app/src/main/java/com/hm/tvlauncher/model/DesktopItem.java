package com.hm.tvlauncher.model;

public class DesktopItem {
    public static final int TYPE_APP = 1;
    public static final int TYPE_FOLDER = 2;
    public static final int TYPE_ADD = 3;

    private int type;
    private AppInfo appInfo;
    private FolderInfo folderInfo;

    public DesktopItem(int type) {
        this.type = type;
    }

    public static DesktopItem createAppItem(AppInfo appInfo) {
        DesktopItem item = new DesktopItem(TYPE_APP);
        item.setAppInfo(appInfo);
        return item;
    }

    public static DesktopItem createFolderItem(FolderInfo folderInfo) {
        DesktopItem item = new DesktopItem(TYPE_FOLDER);
        item.setFolderInfo(folderInfo);
        return item;
    }

    public static DesktopItem createAddItem() {
        return new DesktopItem(TYPE_ADD);
    }

    public int getType() {
        return type;
    }

    public void setType(int type) {
        this.type = type;
    }

    public AppInfo getAppInfo() {
        return appInfo;
    }

    public void setAppInfo(AppInfo appInfo) {
        this.appInfo = appInfo;
    }

    public FolderInfo getFolderInfo() {
        return folderInfo;
    }

    public void setFolderInfo(FolderInfo folderInfo) {
        this.folderInfo = folderInfo;
    }
}
