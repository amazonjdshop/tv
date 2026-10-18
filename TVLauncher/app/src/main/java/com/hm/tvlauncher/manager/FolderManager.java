package com.hm.tvlauncher.manager;

import android.content.Context;
import android.content.SharedPreferences;
import android.text.TextUtils;
import android.util.Log;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import com.hm.tvlauncher.model.FolderInfo;

import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class FolderManager {
    private static final String TAG = "FolderManager";
    private static final String PREF_NAME = "folders_pref";
    private static final String KEY_FOLDERS_JSON = "folders_json";

    public interface FolderChangeListener {
        void onFoldersChanged();
    }

    private static FolderManager instance;
    private Context context;
    private SharedPreferences sp;
    private final List<FolderInfo> folders = new ArrayList<>();
    private final List<FolderChangeListener> listeners = new ArrayList<>();

    public static synchronized FolderManager getInstance() {
        if (instance == null) {
            instance = new FolderManager();
        }
        return instance;
    }

    public void init(Context context) {
        this.context = context.getApplicationContext();
        this.sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        loadFolders();
    }

    private synchronized void loadFolders() {
        folders.clear();
        String json = sp.getString(KEY_FOLDERS_JSON, null);
        if (!TextUtils.isEmpty(json)) {
            try {
                Type listType = new TypeToken<List<FolderInfo>>() {}.getType();
                List<FolderInfo> loaded = new Gson().fromJson(json, listType);
                if (loaded != null) {
                    folders.addAll(loaded);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error loading folders from JSON", e);
            }
        }

        // If first launch and no folders, create default folders
        if (folders.isEmpty()) {
            createDefaultFolders();
        }
    }

    private void createDefaultFolders() {
        FolderInfo mediaFolder = new FolderInfo(UUID.randomUUID().toString(), "影视点播");
        FolderInfo toolFolder = new FolderInfo(UUID.randomUUID().toString(), "常用工具");
        folders.add(mediaFolder);
        folders.add(toolFolder);
        saveFolders();
    }

    public synchronized void saveFolders() {
        try {
            String json = new Gson().toJson(folders);
            sp.edit().putString(KEY_FOLDERS_JSON, json).apply();
            notifyFoldersChanged();
        } catch (Exception e) {
            Log.e(TAG, "Error saving folders", e);
        }
    }

    public synchronized FolderInfo createFolder(String name) {
        if (TextUtils.isEmpty(name)) {
            name = "新建文件夹";
        }
        FolderInfo folder = new FolderInfo(UUID.randomUUID().toString(), name);
        folders.add(folder);
        saveFolders();
        return folder;
    }

    public synchronized void deleteFolder(String folderId) {
        FolderInfo target = getFolderById(folderId);
        if (target != null) {
            folders.remove(target);
            saveFolders();
        }
    }

    public synchronized void renameFolder(String folderId, String newName) {
        FolderInfo target = getFolderById(folderId);
        if (target != null && !TextUtils.isEmpty(newName)) {
            target.setName(newName);
            saveFolders();
        }
    }

    public synchronized void addAppToFolder(String folderId, String packageName) {
        FolderInfo target = getFolderById(folderId);
        if (target != null) {
            target.addPackage(packageName);
            saveFolders();
        }
    }

    public synchronized void removeAppFromFolder(String folderId, String packageName) {
        FolderInfo target = getFolderById(folderId);
        if (target != null) {
            target.removePackage(packageName);
            saveFolders();
        }
    }

    public synchronized FolderInfo getFolderById(String id) {
        for (FolderInfo f : folders) {
            if (f.getId().equals(id)) {
                return f;
            }
        }
        return null;
    }

    public synchronized List<FolderInfo> getAllFolders() {
        return new ArrayList<>(folders);
    }

    public synchronized FolderInfo findFolderContainingApp(String pkg) {
        for (FolderInfo f : folders) {
            if (f.containsPackage(pkg)) {
                return f;
            }
        }
        return null;
    }

    public void addListener(FolderChangeListener listener) {
        if (!listeners.contains(listener)) {
            listeners.add(listener);
        }
    }

    public void removeListener(FolderChangeListener listener) {
        listeners.remove(listener);
    }

    private void notifyFoldersChanged() {
        for (FolderChangeListener l : listeners) {
            l.onFoldersChanged();
        }
    }
}
