package com.hm.tvlauncher.ui;

import android.os.Bundle;
import android.view.KeyEvent;
import android.view.LayoutInflater;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.hm.tvlauncher.R;
import com.hm.tvlauncher.databinding.ActivityAllAppsBinding;
import com.hm.tvlauncher.databinding.ItemDesktopAppBinding;
import com.hm.tvlauncher.manager.AppManager;
import com.hm.tvlauncher.model.AppInfo;
import com.hm.tvlauncher.ui.dialog.AppMenuDialog;

import java.util.ArrayList;
import java.util.List;

public class AllAppsActivity extends AppCompatActivity implements AppManager.AppChangeListener {

    private ActivityAllAppsBinding binding;
    private AllAppsAdapter adapter;
    private final List<AppInfo> appsList = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityAllAppsBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        AppManager.getInstance().addListener(this);

        binding.rvAllApps.setLayoutManager(new GridLayoutManager(this, 6));
        adapter = new AllAppsAdapter();
        binding.rvAllApps.setAdapter(adapter);

        loadApps();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        AppManager.getInstance().removeListener(this);
    }

    @Override
    public void onAppsChanged() {
        loadApps();
    }

    private void loadApps() {
        appsList.clear();
        appsList.addAll(AppManager.getInstance().getInstalledApps());
        binding.tvAppCountTotal.setText(String.format("已安装 %d 个应用", appsList.size()));
        adapter.notifyDataSetChanged();

        if (!appsList.isEmpty()) {
            binding.rvAllApps.post(() -> {
                RecyclerView.ViewHolder vh = binding.rvAllApps.findViewHolderForAdapterPosition(0);
                if (vh != null) {
                    vh.itemView.requestFocus();
                }
            });
        }
    }

    private class AllAppsAdapter extends RecyclerView.Adapter<AllAppsAdapter.VH> {

        @NonNull
        @Override
        public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            ItemDesktopAppBinding b = ItemDesktopAppBinding.inflate(LayoutInflater.from(parent.getContext()), parent, false);
            return new VH(b);
        }

        @Override
        public void onBindViewHolder(@NonNull VH holder, int position) {
            AppInfo app = appsList.get(position);
            holder.binding.tvAppName.setText(app.getAppName());
            if (app.getIcon() != null) {
                holder.binding.ivAppIcon.setImageDrawable(app.getIcon());
            } else {
                holder.binding.ivAppIcon.setImageResource(R.drawable.ic_launcher_tv);
            }

            holder.binding.cardView.setOnClickListener(v -> {
                AppManager.getInstance().launchApp(AllAppsActivity.this, app);
            });

            holder.binding.cardView.setOnLongClickListener(v -> {
                new AppMenuDialog(AllAppsActivity.this, app, null).show();
                return true;
            });

            holder.binding.cardView.setOnKeyListener((v, keyCode, event) -> {
                if (event.getAction() == KeyEvent.ACTION_DOWN && keyCode == KeyEvent.KEYCODE_MENU) {
                    new AppMenuDialog(AllAppsActivity.this, app, null).show();
                    return true;
                }
                return false;
            });
        }

        @Override
        public int getItemCount() {
            return appsList.size();
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
