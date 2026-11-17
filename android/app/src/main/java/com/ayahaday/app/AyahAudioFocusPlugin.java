package com.ayahaday.app;

import android.content.Context;
import android.content.BroadcastReceiver;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AyahAudioFocus")
public class AyahAudioFocusPlugin extends Plugin {
    private AudioManager manager;
    private AudioFocusRequest request;
    private boolean focused;
    private final AudioManager.OnAudioFocusChangeListener listener = change -> {
        if (change != AudioManager.AUDIOFOCUS_GAIN) {
            focused = false;
            JSObject event = new JSObject();
            event.put("interrupted", true);
            notifyListeners("interruption", event);
        }
        // Never restart recitation automatically after a call or navigation prompt.
    };
    private final BroadcastReceiver unplugged = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) {
                JSObject event = new JSObject(); event.put("interrupted", true);
                notifyListeners("interruption", event);
            }
        }
    };
    private boolean receiverRegistered;
    @Override public void load() {
        manager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        IntentFilter filter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
        if (Build.VERSION.SDK_INT >= 33) getContext().registerReceiver(unplugged, filter, Context.RECEIVER_NOT_EXPORTED);
        else getContext().registerReceiver(unplugged, filter);
        receiverRegistered = true;
    }
    @PluginMethod public void requestFocus(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (manager == null) { call.reject("Audio service unavailable"); return; }
            if (!focused) {
                int result;
                if (Build.VERSION.SDK_INT >= 26) {
                    request = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                        .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                        .setWillPauseWhenDucked(true).setOnAudioFocusChangeListener(listener).build();
                    result = manager.requestAudioFocus(request);
                } else {
                    result = manager.requestAudioFocus(listener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
                }
                focused = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
            }
            JSObject result = new JSObject(); result.put("granted", focused); call.resolve(result);
        });
    }
    private void release() {
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= 26 && request != null) manager.abandonAudioFocusRequest(request);
        else manager.abandonAudioFocus(listener);
        focused = false; request = null;
    }
    @PluginMethod public void releaseFocus(PluginCall call) {
        getActivity().runOnUiThread(() -> { release(); call.resolve(); });
    }
    @Override protected void handleOnDestroy() { release(); if (receiverRegistered) { getContext().unregisterReceiver(unplugged); receiverRegistered = false; } }
}
