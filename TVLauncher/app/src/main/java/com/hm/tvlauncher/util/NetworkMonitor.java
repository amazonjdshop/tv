package com.hm.tvlauncher.util;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;

import java.util.ArrayList;
import java.util.List;

public class NetworkMonitor {

    public static final int TYPE_NONE = 0;
    public static final int TYPE_WIFI = 1;
    public static final int TYPE_ETHERNET = 2;

    public interface NetworkCallback {
        void onNetworkChanged(int status);
    }

    private static NetworkMonitor instance;
    private Context context;
    private final List<NetworkCallback> callbacks = new ArrayList<>();
    private boolean isRegistered = false;

    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            notifyNetworkChange();
        }
    };

    public static synchronized NetworkMonitor getInstance() {
        if (instance == null) {
            instance = new NetworkMonitor();
        }
        return instance;
    }

    public void init(Context context) {
        this.context = context.getApplicationContext();
        register();
    }

    public void registerCallback(NetworkCallback cb) {
        if (!callbacks.contains(cb)) {
            callbacks.add(cb);
            cb.onNetworkChanged(getNetworkStatus());
        }
    }

    public void unregisterCallback(NetworkCallback cb) {
        callbacks.remove(cb);
    }

    private void register() {
        if (!isRegistered && context != null) {
            IntentFilter filter = new IntentFilter();
            filter.addAction(ConnectivityManager.CONNECTIVITY_ACTION);
            context.registerReceiver(receiver, filter);
            isRegistered = true;
        }
    }

    public int getNetworkStatus() {
        if (context == null) return TYPE_NONE;
        ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return TYPE_NONE;

        NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
        if (activeNetwork != null && activeNetwork.isConnected()) {
            if (activeNetwork.getType() == ConnectivityManager.TYPE_WIFI) {
                return TYPE_WIFI;
            } else if (activeNetwork.getType() == ConnectivityManager.TYPE_ETHERNET) {
                return TYPE_ETHERNET;
            }
            return TYPE_WIFI;
        }
        return TYPE_NONE;
    }

    private void notifyNetworkChange() {
        int status = getNetworkStatus();
        for (NetworkCallback cb : callbacks) {
            cb.onNetworkChanged(status);
        }
    }
}
