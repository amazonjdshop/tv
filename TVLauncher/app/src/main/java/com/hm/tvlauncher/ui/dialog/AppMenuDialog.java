package com.hm.tvlauncher.ui.dialog;

import android.app.AlertDialog;
import android.app.Dialog;
import android.content.Context;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.hm.tvlauncher.R;
import com.hm.tvlauncher.databinding.DialogAppMenuBinding;
import com.hm.tvlauncher.manager.AppManager;
import com.hm.tvlauncher.manager.DesktopConfigManager;
import com.hm.tvlauncher.manager.FolderManager;
import com.hm.tvlauncher.model.AppInfo;
import com.hm.tvlauncher.model.FolderInfo;

import java.util.List;

public class AppMenuDialog extends Dialog {

    private final AppInfo appInfo;
    private final String currentFolderId; // Null if on desktop or all apps drawer
    private DialogAppMenuBinding binding;

    public AppMenuDialog(@NonNull Context context, AppInfo appInfo, String currentFolderId) {
        super(context, R.style.TVDialogTheme);
        this.appInfo = appInfo;
        this.currentFolderId = currentFolderId;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = DialogAppMenuBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        Window window = getWindow();
        if (window != null) {
            window.setLayout(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT);
            window.setGravity(Gravity.CENTER);
        }

        if (appInfo == null) {
            dismiss();
            return;
        }

        binding.tvMenuAppName.setText(appInfo.getAppName());
        if (appInfo.getIcon() != null) {
            binding.ivMenuAppIcon.setImageDrawable(appInfo.getIcon());
        }

        // Toggle "从文件夹移出"
        if (currentFolderId != null) {
            binding.btnMenuRemoveFromFolder.setVisibility(View.VISIBLE);
            binding.btnMenuRemoveFromFolder.setOnClickListener(v -> {
                FolderManager.getInstance().removeAppFromFolder(currentFolderId, appInfo.getPackageName());
                Toast.makeText(getContext(), "已从文件夹移出", Toast.LENGTH_SHORT).show();
                dismiss();
            });
        } else {
            binding.btnMenuRemoveFromFolder.setVisibility(View.GONE);
        }

        // Move to folder
        binding.btnMenuMoveToFolder.setOnClickListener(v -> {
            showFolderSelectDialog();
            dismiss();
        });

        // Toggle "从桌面移除" or "固定到桌面"
        boolean isPinned = DesktopConfigManager.getInstance().isAppPinned(appInfo.getPackageName());
        if (isPinned) {
            binding.btnMenuRemoveFromHome.setText(R.string.menu_remove_from_home);
            binding.btnMenuRemoveFromHome.setOnClickListener(v -> {
                DesktopConfigManager.getInstance().unpinApp(appInfo.getPackageName());
                Toast.makeText(getContext(), "已从主屏移除", Toast.LENGTH_SHORT).show();
                dismiss();
            });
        } else {
            binding.btnMenuRemoveFromHome.setText(R.string.menu_pin_to_home);
            binding.btnMenuRemoveFromHome.setOnClickListener(v -> {
                DesktopConfigManager.getInstance().pinApp(appInfo.getPackageName());
                Toast.makeText(getContext(), "已添加到主屏", Toast.LENGTH_SHORT).show();
                dismiss();
            });
        }

        // App Info
        binding.btnMenuAppInfo.setOnClickListener(v -> {
            AppManager.getInstance().openAppDetails(getContext(), appInfo.getPackageName());
            dismiss();
        });

        // Uninstall
        binding.btnMenuUninstall.setOnClickListener(v -> {
            AppManager.getInstance().uninstallApp(getContext(), appInfo.getPackageName());
            dismiss();
        });

        binding.btnMenuMoveToFolder.requestFocus();
    }

    private void showFolderSelectDialog() {
        List<FolderInfo> folders = FolderManager.getInstance().getAllFolders();
        String[] folderNames = new String[folders.size() + 1];
        folderNames[0] = "+ [新建文件夹]";
        for (int i = 0; i < folders.size(); i++) {
            folderNames[i + 1] = folders.get(i).getName();
        }

        new AlertDialog.Builder(getContext(), R.style.TVDialogTheme)
                .setTitle("选择目标文件夹")
                .setItems(folderNames, (dialog, which) -> {
                    if (which == 0) {
                        // Create new folder
                        showCreateFolderPrompt();
                    } else {
                        FolderInfo chosen = folders.get(which - 1);
                        FolderManager.getInstance().addAppToFolder(chosen.getId(), appInfo.getPackageName());
                        Toast.makeText(getContext(), "已将 " + appInfo.getAppName() + " 放入 " + chosen.getName(), Toast.LENGTH_SHORT).show();
                    }
                })
                .show();
    }

    private void showCreateFolderPrompt() {
        EditText input = new EditText(getContext());
        input.setHint("输入新文件夹名称 (如: 游戏客厅)");
        input.setTextColor(getContext().getResources().getColor(R.color.text_white));
        input.setHintTextColor(getContext().getResources().getColor(R.color.text_dim));

        new AlertDialog.Builder(getContext(), R.style.TVDialogTheme)
                .setTitle("新建文件夹")
                .setView(input)
                .setPositiveButton("确定", (d, w) -> {
                    String name = input.getText().toString().trim();
                    if (name.isEmpty()) name = "新建文件夹";
                    FolderInfo created = FolderManager.getInstance().createFolder(name);
                    FolderManager.getInstance().addAppToFolder(created.getId(), appInfo.getPackageName());
                    Toast.makeText(getContext(), "已创建并放入 " + created.getName(), Toast.LENGTH_SHORT).show();
                })
                .setNegativeButton("取消", null)
                .show();
    }
}
