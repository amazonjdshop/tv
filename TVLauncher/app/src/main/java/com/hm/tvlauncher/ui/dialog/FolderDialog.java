package com.hm.tvlauncher.ui.dialog;

import android.app.AlertDialog;
import android.app.Dialog;
import android.content.Context;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.hm.tvlauncher.R;
import com.hm.tvlauncher.databinding.DialogFolderBinding;
import com.hm.tvlauncher.databinding.ItemDesktopAppBinding;
import com.hm.tvlauncher.manager.AppManager;
import com.hm.tvlauncher.manager.FolderManager;
import com.hm.tvlauncher.model.AppInfo;
import com.hm.tvlauncher.model.FolderInfo;

import java.util.ArrayList;
import java.util.List;

public class FolderDialog extends Dialog implements FolderManager.FolderChangeListener {

    private final String folderId;
    private DialogFolderBinding binding;
    private FolderAppsAdapter adapter;
    private final List<AppInfo> appsInFolder = new ArrayList<>();

    public FolderDialog(@NonNull Context context, String folderId) {
        super(context, R.style.TVDialogTheme);
        this.folderId = folderId;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = DialogFolderBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        Window window = getWindow();
        if (window != null) {
            window.setLayout(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT);
            window.setGravity(Gravity.CENTER);
        }

        FolderManager.getInstance().addListener(this);

        binding.rvFolderApps.setLayoutManager(new GridLayoutManager(getContext(), 5));
        adapter = new FolderAppsAdapter();
        binding.rvFolderApps.setAdapter(adapter);

        refreshData();

        // Add app to folder button
        binding.btnAddApp.setOnClickListener(v -> {
            new SelectAppsDialog(getContext(), folderId, selectedPackages -> {
                FolderInfo f = FolderManager.getInstance().getFolderById(folderId);
                if (f != null) {
                    f.setPackageNames(selectedPackages);
                    FolderManager.getInstance().saveFolders();
                }
            }).show();
        });

        // Rename folder button
        binding.btnRenameFolder.setOnClickListener(v -> showRenameDialog());

        // Delete folder button
        binding.btnDeleteFolder.setOnClickListener(v -> {
            new AlertDialog.Builder(getContext(), R.style.TVDialogTheme)
                    .setTitle("解散文件夹")
                    .setMessage("确定要解散此文件夹吗？内部应用不会被删除。")
                    .setPositiveButton("解散", (d, w) -> {
                        FolderManager.getInstance().deleteFolder(folderId);
                        dismiss();
                    })
                    .setNegativeButton("取消", null)
                    .show();
        });
    }

    @Override
    public void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        FolderManager.getInstance().removeListener(this);
    }

    @Override
    public void onFoldersChanged() {
        refreshData();
    }

    private void refreshData() {
        FolderInfo folder = FolderManager.getInstance().getFolderById(folderId);
        if (folder == null) {
            dismiss();
            return;
        }

        binding.tvFolderName.setText(folder.getName());
        appsInFolder.clear();

        for (String pkg : folder.getPackageNames()) {
            AppInfo app = AppManager.getInstance().getAppByPackage(pkg);
            if (app != null) {
                appsInFolder.add(app);
            }
        }

        binding.tvFolderAppCount.setText(String.format("共 %d 个应用", appsInFolder.size()));
        binding.tvEmptyFolder.setVisibility(appsInFolder.isEmpty() ? View.VISIBLE : View.GONE);
        adapter.notifyDataSetChanged();

        if (!appsInFolder.isEmpty()) {
            binding.rvFolderApps.post(() -> {
                RecyclerView.ViewHolder vh = binding.rvFolderApps.findViewHolderForAdapterPosition(0);
                if (vh != null) {
                    vh.itemView.requestFocus();
                }
            });
        }
    }

    private void showRenameDialog() {
        FolderInfo folder = FolderManager.getInstance().getFolderById(folderId);
        if (folder == null) return;

        EditText input = new EditText(getContext());
        input.setText(folder.getName());
        input.setTextColor(getContext().getResources().getColor(R.color.text_white));
        input.setSelectAllOnFocus(true);

        new AlertDialog.Builder(getContext(), R.style.TVDialogTheme)
                .setTitle("重命名文件夹")
                .setView(input)
                .setPositiveButton("确定", (d, w) -> {
                    String name = input.getText().toString().trim();
                    if (!name.isEmpty()) {
                        FolderManager.getInstance().renameFolder(folderId, name);
                    }
                })
                .setNegativeButton("取消", null)
                .show();
    }

    private class FolderAppsAdapter extends RecyclerView.Adapter<FolderAppsAdapter.VH> {

        @NonNull
        @Override
        public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            ItemDesktopAppBinding b = ItemDesktopAppBinding.inflate(LayoutInflater.from(parent.getContext()), parent, false);
            return new VH(b);
        }

        @Override
        public void onBindViewHolder(@NonNull VH holder, int position) {
            AppInfo app = appsInFolder.get(position);
            holder.binding.tvAppName.setText(app.getAppName());
            if (app.getIcon() != null) {
                holder.binding.ivAppIcon.setImageDrawable(app.getIcon());
            } else {
                holder.binding.ivAppIcon.setImageResource(R.drawable.ic_launcher_tv);
            }

            // Click -> Launch app
            holder.binding.cardView.setOnClickListener(v -> {
                AppManager.getInstance().launchApp(getContext(), app);
                dismiss();
            });

            // Long Click / Menu key -> Open AppMenuDialog
            holder.binding.cardView.setOnLongClickListener(v -> {
                new AppMenuDialog(getContext(), app, folderId).show();
                return true;
            });

            holder.binding.cardView.setOnKeyListener((v, keyCode, event) -> {
                if (event.getAction() == KeyEvent.ACTION_DOWN && keyCode == KeyEvent.KEYCODE_MENU) {
                    new AppMenuDialog(getContext(), app, folderId).show();
                    return true;
                }
                return false;
            });
        }

        @Override
        public int getItemCount() {
            return appsInFolder.size();
        }

        class VH extends RecyclerView.ViewHolder {
            ItemDesktopAppBinding binding;
            VH(ItemDesktopAppBinding binding) {
                super(binding.getRoot());
                this.binding = binding;
            }
        }
    }
}
