package com.hm.tvlauncher.ui.view;

import android.animation.AnimatorSet;
import android.animation.ObjectAnimator;
import android.content.Context;
import android.graphics.Rect;
import android.util.AttributeSet;
import android.view.animation.DecelerateInterpolator;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.view.ViewCompat;

import com.hm.tvlauncher.R;

public class TVFocusCardView extends FrameLayout {

    private static final float SCALE_FOCUSED = 1.08f;
    private static final float SCALE_NORMAL = 1.0f;
    private static final int DURATION = 180;

    private AnimatorSet focusAnimator;

    public TVFocusCardView(@NonNull Context context) {
        this(context, null);
    }

    public TVFocusCardView(@NonNull Context context, @Nullable AttributeSet attrs) {
        this(context, attrs, 0);
    }

    public TVFocusCardView(@NonNull Context context, @Nullable AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        init();
    }

    private void init() {
        setFocusable(true);
        setFocusableInTouchMode(false);
        setClickable(true);
        setBackgroundResource(R.drawable.selector_tv_card);
    }

    @Override
    protected void onFocusChanged(boolean gainFocus, int direction, @Nullable Rect previouslyFocusedRect) {
        super.onFocusChanged(gainFocus, direction, previouslyFocusedRect);
        animateFocus(gainFocus);
    }

    private void animateFocus(boolean focused) {
        if (focusAnimator != null && focusAnimator.isRunning()) {
            focusAnimator.cancel();
        }

        float targetScale = focused ? SCALE_FOCUSED : SCALE_NORMAL;
        float targetElevation = focused ? 16f : 0f;

        ObjectAnimator scaleX = ObjectAnimator.ofFloat(this, "scaleX", getScaleX(), targetScale);
        ObjectAnimator scaleY = ObjectAnimator.ofFloat(this, "scaleY", getScaleY(), targetScale);

        focusAnimator = new AnimatorSet();
        focusAnimator.playTogether(scaleX, scaleY);
        focusAnimator.setDuration(DURATION);
        focusAnimator.setInterpolator(new DecelerateInterpolator());
        focusAnimator.start();

        ViewCompat.setElevation(this, targetElevation);
        ViewCompat.setTranslationZ(this, targetElevation);
    }
}
