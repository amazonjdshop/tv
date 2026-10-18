package com.hm.tvlauncher.model;

import java.util.ArrayList;
import java.util.List;

public class FolderInfo {
    private String id;
    private String name;
    private List<String> packageNames;
    private long createTime;

    public FolderInfo() {
        this.packageNames = new ArrayList<>();
    }

    public FolderInfo(String id, String name) {
        this.id = id;
        this.name = name;
        this.packageNames = new ArrayList<>();
        this.createTime = System.currentTimeMillis();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public List<String> getPackageNames() {
        if (packageNames == null) {
            packageNames = new ArrayList<>();
        }
        return packageNames;
    }

    public void setPackageNames(List<String> packageNames) {
        this.packageNames = packageNames;
    }

    public void addPackage(String pkg) {
        if (packageNames == null) {
            packageNames = new ArrayList<>();
        }
        if (!packageNames.contains(pkg)) {
            packageNames.add(pkg);
        }
    }

    public void removePackage(String pkg) {
        if (packageNames != null) {
            packageNames.remove(pkg);
        }
    }

    public boolean containsPackage(String pkg) {
        return packageNames != null && packageNames.contains(pkg);
    }

    public long getCreateTime() {
        return createTime;
    }

    public void setCreateTime(long createTime) {
        this.createTime = createTime;
    }
}
