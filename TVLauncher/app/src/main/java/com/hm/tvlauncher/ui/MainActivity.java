package com.hm.tvlauncher.ui;

import android.app.AlertDialog;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.hm.tvlauncher.R;
import com.hm.tvlauncher.databinding.ActivityMainBinding;
import com.hm.tvlauncher.databinding.ItemDesktopAddBinding;
import com.hm.tvlauncher.databinding.ItemDesktopAppBinding;
import com.hm.tvlauncher.databinding.ItemDesktopFolderBinding;
import com.hm.tvlauncher.manager.AppManager;
import com.hm.tvlauncher.manager.DesktopConfigManager;
import com.hm.tvlauncher.manager.FolderManager;
import com.hm.tvlauncher.model.AppInfo;
import com.hm.tvlauncher.model.DesktopItem;
import com.hm.tvlauncher.model.FolderInfo;
import com.hm.tvlauncher.model.WeatherData;
import com.hm.tvlauncher.ui.dialog.AppMenuDialog;
import com.hm.tvlauncher.ui.dialog.FolderDialog;
import com.hm.tvlauncher.ui.dialog.WeatherDetailDialog;
import com.hm.tvlauncher.util.LunarCalendarUtil;
import com.hm.tvlauncher.util.MemoryCleanUtil;
import com.hm.tvlauncher.util.NetworkMonitor;
import com.hm.tvlauncher.weather.WeatherCodeMapper;
import com.hm.tvlauncher.weather.WeatherService;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class MainActivity extends AppCompatActivity implements
        WeatherService.WeatherCallback,
        NetworkMonitor.NetworkCallback,
        DesktopConfigManager.DesktopChangeListener,
        FolderManager.FolderChangeListener,
        AppManager.AppChangeListener {

    private ActivityMainBinding binding;
    private final Handler timeHandler = new Handler(Looper.getMainLooper());
    private DesktopAdapter desktopAdapter;
    private final List<DesktopItem> desktopItems = new ArrayList<>();
    private int lastFocusedIndex = 0;

    // Time ticker
    private final Runnable timeRunnable = new Runnable() {
        @Override
        public void run() {
            updateClockAndCalendar();
            timeHandler.postDelayed(this, 1000);
        }
    };

    // USB Receiver
    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (Intent.ACTION_MEDIA_MOUNTED.equals(action)) {
                binding.ivUsb.setVisibility(View.VISIBLE);
                Toast.makeText(MainActivity.this, "已检测到U盘设备", Toast.LENGTH_SHORT).show();
            } else if (Intent.ACTION_MEDIA_UNMOUNTED.equals(action) || Intent.ACTION_MEDIA_REMOVED.equals(action)) {
                binding.ivUsb.setVisibility(View.GONE);
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityMainBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        // Initialize utilities and listeners
        NetworkMonitor.getInstance().init(this);
        NetworkMonitor.getInstance().registerCallback(this);
        WeatherService.getInstance().registerCallback(this);
        DesktopConfigManager.getInstance().addListener(this);
        FolderManager.getInstance().addListener(this);
        AppManager.getInstance().addListener(this);

        setupTopBar();
        setupDesktopGrid();
        registerUsbReceiver();

        // Refresh weather on launch
        WeatherService.getInstance().refreshWeather();
    }

    @Override
    protected void onResume() {
        super.onResume();
        timeHandler.post(timeRunnable);
        reloadDesktopItems();
    }

    @Override
    protected void onPause() {
        super.onPause();
        timeHandler.removeCallbacks(timeRunnable);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        try {
            unregisterReceiver(usbReceiver);
        } catch (Exception ignored) {}
        NetworkMonitor.getInstance().unregisterCallback(this);
        WeatherService.getInstance().unregisterCallback(this);
        DesktopConfigManager.getInstance().removeListener(this);
        FolderManager.getInstance().removeListener(this);
        AppManager.getInstance().removeListener(this);
    }

    private void registerUsbReceiver() {
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_MEDIA_MOUNTED);
        filter.addAction(Intent.ACTION_MEDIA_UNMOUNTED);
        filter.addAction(Intent.ACTION_MEDIA_REMOVED);
        filter.addDataScheme("file");
        registerReceiver(usbReceiver, filter);
    }

    private void setupTopBar() {
        updateClockAndCalendar();

        // Weather Click
        binding.btnWeather.setOnClickListener(v -> new WeatherDetailDialog(this).show());

        // Memory Clean Click
        binding.btnCleanMemory.setOnClickListener(v -> {
            long freedMb = MemoryCleanUtil.cleanMemory(this);
            Toast.makeText(this, getString(R.string.memory_cleaned, freedMb), Toast.LENGTH_LONG).show();
        });

        // All Apps Click
        binding.btnAllApps.setOnClickListener(v -> {
            startActivity(new Intent(this, AllAppsActivity.class));
        });

        // Settings Click
        binding.btnSettings.setOnClickListener(v -> {
            try {
                Intent intent = new Intent(Settings.ACTION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception e) {
                Toast.makeText(this, "无法打开系统设置", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void updateClockAndCalendar() {
        Calendar cal = Calendar.getInstance();
        Date now = cal.getTime();

        SimpleDateFormat timeFmt = new SimpleDateFormat("HH:mm", Locale.getDefault());
        binding.tvTime.setText(timeFmt.format(now));

        SimpleDateFormat dateFmt = new SimpleDateFormat("MM月dd日 E", Locale.CHINA);
        binding.tvDate.setText(dateFmt.format(now));

        // Lunar calendar
        binding.tvLunar.setText(LunarCalendarUtil.getLunarString(cal));
    }

    private void setupDesktopGrid() {
        binding.rvDesktop.setLayoutManager(new GridLayoutManager(this, 6));
        desktopAdapter = new DesktopAdapter();
        binding.rvDesktop.setAdapter(desktopAdapter);
        reloadDesktopItems();
    }

    private void reloadDesktopItems() {
        desktopItems.clear();
        desktopItems.addAll(DesktopConfigManager.getInstance().buildDesktopItems());
        desktopAdapter.notifyDataSetChanged();

        binding.rvDesktop.post(() -> {
            if (lastFocusedIndex >= 0 && lastFocusedIndex < desktopItems.size()) {
                RecyclerView.ViewHolder vh = binding.rvDesktop.findViewHolderForAdapterPosition(lastFocusedIndex);
                if (vh != null) {
                    vh.itemView.requestFocus();
                }
            }
        });
    }

    @Override
    public void onWeatherUpdated(WeatherData data) {
        if (data == null) return;
        binding.tvTemperature.setText(String.format("%d°C", data.getTemperature()));
        binding.tvWeatherCondition.setText(data.getConditionName());
        binding.tvCity.setText(data.getCityName());
        binding.ivWeatherIcon.setImageResource(WeatherCodeMapper.getWeatherIcon(data.getWeatherCode()));
    }

    @Override
    public void onNetworkChanged(int status) {
        if (status == NetworkMonitor.TYPE_ETHERNET) {
            binding.ivNetwork.setImageResource(R.drawable.ic_ethernet);
            binding.ivNetwork.setImageAlpha(255);
        } else if (status == NetworkMonitor.TYPE_WIFI) {
            binding.ivNetwork.setImageResource(R.drawable.ic_wifi);
            binding.ivNetwork.setImageAlpha(255);
        } else {
            binding.ivNetwork.setImageResource(R.drawable.ic_wifi);
            binding.ivNetwork.setImageAlpha(80); // Dimmed when disconnected
        }
    }

    @Override
    public void onDesktopChanged() {
        reloadDesktopItems();
    }

    @Override
    public void onFoldersChanged() {
        reloadDesktopItems();
    }

    @Override
    public void onAppsChanged() {
        reloadDesktopItems();
    }

    // Handle (+) Click: Add App to Home or Create Folder
    private void showAddOptionsDialog() {
        String[] options = {"添加应用到主屏", "新建文件夹"};
        new AlertDialog.Builder(this, R.style.TVDialogTheme)
                .setTitle("添加")
                .setItems(options, (dialog, which) -> {
                    if (which == 0) {
                        startActivity(new Intent(this, AllAppsActivity.class));
                    } else {
                        showCreateFolderDialog();
                    }
                })
                .show();
    }

    private void showCreateFolderDialog() {
        EditText input = new EditText(this);
        input.setHint("输入文件夹名称 (如: 直播频道)");
        input.setTextColor(getResources().getColor(R.color.text_white));
        input.setHintTextColor(getResources().getColor(R.color.text_dim));

        new AlertDialog.Builder(this, R.style.TVDialogTheme)
                .setTitle("新建文件夹")
                .setView(input)
                .setPositiveButton("确定", (d, w) -> {
                    String name = input.getText().toString().trim();
                    if (name.isEmpty()) name = "新建文件夹";
                    FolderManager.getInstance().createFolder(name);
                    Toast.makeText(this, "文件夹已创建: " + name, Toast.LENGTH_SHORT).show();
                })
                .setNegativeButton("取消", null)
                .show();
    }

    // Intercept Back key on TV: Don't exit launcher on Back press
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            // Refocus first item on desktop
            if (!desktopItems.isEmpty()) {
                RecyclerView.ViewHolder vh = binding.rvDesktop.findViewHolderForAdapterPosition(0);
                if (vh != null) {
                    vh.itemView.requestFocus();
                    return true;
                }
            }
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    // Desktop Adapter
    private class DesktopAdapter extends RecyclerView.Adapter<RecyclerView.ViewHolder> {

        @Override
        public int getItemViewType(int position) {
            return desktopItems.get(position).getType();
        }

        @NonNull
        @Override
        public RecyclerView.ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            LayoutInflater inflater = LayoutInflater.from(parent.getContext());
            if (viewType == DesktopItem.TYPE_FOLDER) {
                ItemDesktopFolderBinding b = ItemDesktopFolderBinding.inflate(inflater, parent, false);
                return new FolderViewHolder(b);
            } else if (viewType == DesktopItem.TYPE_ADD) {
                ItemDesktopAddBinding b = ItemDesktopAddBinding.inflate(inflater, parent, false);
                return new AddViewHolder(b);
            } else {
                ItemDesktopAppBinding b = ItemDesktopAppBinding.inflate(inflater, parent, false);
                return new AppViewHolder(b);
            }
        }

        @Override
        public void onBindViewHolder(@NonNull RecyclerView.ViewHolder holder, int position) {
            DesktopItem item = desktopItems.get(position);

            if (holder instanceof FolderViewHolder) {
                FolderViewHolder fvh = (FolderViewHolder) holder;
                FolderInfo f = item.getFolderInfo();
                fvh.binding.tvFolderName.setText(f.getName());

                // Load preview mini-icons
                List<AppInfo> previewApps = new ArrayList<>();
                for (String pkg : f.getPackageNames()) {
                    AppInfo ai = AppManager.getInstance().getAppByPackage(pkg);
                    if (ai != null) {
                        previewApps.add(ai);
                    }
                }
                fvh.binding.tvAppCount.setText(String.format("(%d)", previewApps.size()));
                fvh.binding.folderPreview.setPreviewApps(previewApps);

                fvh.binding.cardView.setOnClickListener(v -> {
                    lastFocusedIndex = position;
                    new FolderDialog(MainActivity.this, f.getId()).show();
                });

                fvh.binding.cardView.setOnLongClickListener(v -> {
                    showFolderManageDialog(f);
                    return true;
                });

                fvh.binding.cardView.setOnKeyListener((v, keyCode, event) -> {
                    if (event.getAction() == KeyEvent.ACTION_DOWN && keyCode == KeyEvent.KEYCODE_MENU) {
                        showFolderManageDialog(f);
                        return true;
                    }
                    return false;
                });

            } else if (holder instanceof AppViewHolder) {
                AppViewHolder avh = (AppViewHolder) holder;
                AppInfo app = item.getAppInfo();
                avh.binding.tvAppName.setText(app.getAppName());
                if (app.getIcon() != null) {
                    avh.binding.ivAppIcon.setImageDrawable(app.getIcon());
                } else {
                    avh.binding.ivAppIcon.setImageResource(R.drawable.ic_launcher_tv);
                }

                avh.binding.cardView.setOnClickListener(v -> {
                    lastFocusedIndex = position;
                    AppManager.getInstance().launchApp(MainActivity.this, app);
                });

                avh.binding.cardView.setOnLongClickListener(v -> {
                    lastFocusedIndex = position;
                    new AppMenuDialog(MainActivity.this, app, null).show();
                    return true;
                });

                avh.binding.cardView.setOnKeyListener((v, keyCode, event) -> {
                    if (event.getAction() == KeyEvent.ACTION_DOWN && keyCode == KeyEvent.KEYCODE_MENU) {
                        lastFocusedIndex = position;
                        new AppMenuDialog(MainActivity.this, app, null).show();
                        return true;
                    }
                    return false;
                });

            } else if (holder instanceof AddViewHolder) {
                AddViewHolder addVh = (AddViewHolder) holder;
                addVh.binding.cardView.setOnClickListener(v -> {
                    lastFocusedIndex = position;
                    showAddOptionsDialog();
                });
            }
        }

        @Override
        public int getItemCount() {
            return desktopItems.size();
        }

        private void showFolderManageDialog(FolderInfo f) {
            String[] options = {"打开文件夹", "重命名文件夹", "解散文件夹"};
            new AlertDialog.Builder(MainActivity.this, R.style.TVDialogTheme)
                    .setTitle(f.getName())
                    .setItems(options, (d, which) -> {
                        if (which == 0) {
                            new FolderDialog(MainActivity.this, f.getId()).show();
                        } else if (which == 1) {
                            showRenameFolderDialog(f);
                        } else if (which == 2) {
                            FolderManager.getInstance().deleteFolder(f.getId());
                            Toast.makeText(MainActivity.this, "文件夹已解散", Toast.LENGTH_SHORT).show();
                        }
                    })
                    .show();
        }

        private void showRenameFolderDialog(FolderInfo f) {
            EditText input = new EditText(MainActivity.this);
            input.setText(f.getName());
            input.setTextColor(getResources().getColor(R.color.text_white));
            input.setSelectAllOnFocus(true);

            new AlertDialog.Builder(MainActivity.this, R.style.TVDialogTheme)
                    .setTitle("重命名文件夹")
                    .setView(input)
                    .setPositiveButton("确定", (d, w) -> {
                        String name = input.getText().toString().trim();
                        if (!name.isEmpty()) {
                            FolderManager.getInstance().renameFolder(f.getId(), name);
                        }
                    })
                    .setNegativeButton("取消", null)
                    .show();
        }

        class FolderViewHolder extends RecyclerView.ViewHolder {
            ItemDesktopFolderBinding binding;
            FolderViewHolder(ItemDesktopFolderBinding binding) {
                super(binding.getRoot());
                this.binding = binding;
            }
        }

        class AppViewHolder extends RecyclerView.ViewHolder {
            ItemDesktopAppBinding binding;
            AppViewHolder(ItemDesktopAppBinding binding) {
                super(binding.getRoot());
                this.binding = binding;
            }
        }

        class AddViewHolder extends RecyclerView.ViewHolder {
            ItemDesktopAddBinding binding;
            AddViewHolder(ItemDesktopAddBinding binding) {
                super(binding.getRoot());
                this.binding = binding;
            }
        }
    }
}
