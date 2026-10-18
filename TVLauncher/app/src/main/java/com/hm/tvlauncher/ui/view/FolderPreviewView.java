package com.hm.tvlauncher.ui.view;

import android.content.Context;
import android.graphics.drawable.Drawable;
import android.util.AttributeSet;
import android.view.Gravity;
import android.widget.GridLayout;
import android.widget.ImageView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.hm.tvlauncher.R;
import com.hm.tvlauncher.model.AppInfo;

import java.util.List;

public class FolderPreviewView extends GridLayout {

    private final ImageView[] previewIcons = new ImageView[4];

    public FolderPreviewView(@NonNull Context context) {
        this(context, null);
    }

    public FolderPreviewView(@NonNull Context context, @Nullable AttributeSet attrs) {
        this(context, attrs, 0);
    }

    public FolderPreviewView(@NonNull Context context, @Nullable AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        init(context);
    }

    private void init(Context context) {
        setRowCount(2);
        setColumnCount(2);
        setBackgroundResource(R.drawable.bg_card_default);

        int pad = dpToPx(context, 6);
        setPadding(pad, pad, pad, pad);

        int iconSize = dpToPx(context, 32);
        int margin = dpToPx(context, 2);

        for (int i = 0; i < 4; i++) {
            ImageView iv = new ImageView(context);
            GridLayout.LayoutParams params = new GridLayout.LayoutParams();
            params.width = iconSize;
            params.height = iconSize;
            params.setMargins(margin, margin, margin, margin);
            params.setGravity(Gravity.CENTER);
            iv.setLayoutParams(params);
            iv.setScaleType(ImageView.ScaleType.FIT_CENTER);
            previewIcons[i] = iv;
            addView(iv);
        }
    }

    public void setPreviewApps(List<AppInfo> apps) {
        for (int i = 0; i < 4; i++) {
            if (apps != null && i < apps.size() && apps.get(i) != null) {
                Drawable icon = apps.get(i).getIcon();
                if (icon != null) {
                    previewIcons[i].setImageDrawable(icon);
                    previewIcons[i].setVisibility(VISIBLE);
                } else {
                    previewIcons[i].setImageResource(R.drawable.ic_launcher_tv);
                    previewIcons[i].setVisibility(VISIBLE);
                }
            } else {
                previewIcons[i].setImageDrawable(null);
                previewIcons[i].setVisibility(INVISIBLE);
            }
        }
    }

    private int dpToPx(Context context, int dp) {
        return (int) (dp * context.getResources().getDisplayMetrics().density + 0.5f);
    }
}
