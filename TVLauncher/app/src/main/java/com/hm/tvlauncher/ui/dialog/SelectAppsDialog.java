package com.hm.tvlauncher.ui.dialog;

import android.app.Dialog;
import android.content.Context;
import android.os.Bundle;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.hm.tvlauncher.R;
import com.hm.tvlauncher.databinding.DialogSelectAppsBinding;
import com.hm.tvlauncher.databinding.ItemSelectableAppBinding;
import com.hm.tvlauncher.manager.AppManager;
import com.hm.tvlauncher.manager.FolderManager;
import com.hm.tvlauncher.model.AppInfo;
import com.hm.tvlauncher.model.FolderInfo;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class SelectAppsDialog extends Dialog {

    public interface OnAppsSelectedListener {
        void onSelected(List<String> selectedPackages);
    }

    private final String folderId;
    private final OnAppsSelectedListener listener;
    private DialogSelectAppsBinding binding;
    private final Set<String> selectedPackages = new HashSet<>();
    private List<AppInfo> allApps = new ArrayList<>();

    public SelectAppsDialog(@NonNull Context context, String folderId, OnAppsSelectedListener listener) {
        super(context, R.style.TVDialogTheme);
        this.folderId = folderId;
        this.listener = listener;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = DialogSelectAppsBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        Window window = getWindow();
        if (window != null) {
            window.setLayout(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT);
            window.setGravity(Gravity.CENTER);
        }

        allApps = AppManager.getInstance().getInstalledApps();

        // Pre-check currently included apps
        FolderInfo folder = FolderManager.getInstance().getFolderById(folderId);
        if (folder != null) {
            binding.tvSelectTitle.setText(String.format("管理【%s】的应用", folder.getName()));
            selectedPackages.addAll(folder.getPackageNames());
        }

        binding.rvSelectableApps.setLayoutManager(new GridLayoutManager(getContext(), 5));
        SelectAppsAdapter adapter = new SelectAppsAdapter();
        binding.rvSelectableApps.setAdapter(adapter);

        binding.btnConfirmSelection.setOnClickListener(v -> {
            if (listener != null) {
                listener.onSelected(new ArrayList<>(selectedPackages));
            }
            dismiss();
        });

        binding.btnCancelSelection.setOnClickListener(v -> dismiss());
    }

    private class SelectAppsAdapter extends RecyclerView.Adapter<SelectAppsAdapter.VH> {

        @NonNull
        @Override
        public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            ItemSelectableAppBinding b = ItemSelectableAppBinding.inflate(LayoutInflater.from(parent.getContext()), parent, false);
            return new VH(b);
        }

        @Override
        public void onBindViewHolder(@NonNull VH holder, int position) {
            AppInfo app = allApps.get(position);
            holder.binding.tvAppName.setText(app.getAppName());
            if (app.getIcon() != null) {
                holder.binding.ivAppIcon.setImageDrawable(app.getIcon());
            } else {
                holder.binding.ivAppIcon.setImageResource(R.drawable.ic_launcher_tv);
            }

            boolean isChecked = selectedPackages.contains(app.getPackageName());
            holder.binding.ivCheckMark.setVisibility(isChecked ? View.VISIBLE : View.GONE);

            holder.binding.cardView.setOnClickListener(v -> {
                if (selectedPackages.contains(app.getPackageName())) {
                    selectedPackages.remove(app.getPackageName());
                    holder.binding.ivCheckMark.setVisibility(View.GONE);
                } else {
                    selectedPackages.add(app.getPackageName());
                    holder.binding.ivCheckMark.setVisibility(View.VISIBLE);
                }
            });
        }

        @Override
        public int getItemCount() {
            return allApps.size();
        }

        class VH extends RecyclerView.ViewHolder {
            ItemSelectableAppBinding binding;
            VH(ItemSelectableAppBinding binding) {
                super(binding.getRoot());
                this.binding = binding;
            }
        }
    }
}
