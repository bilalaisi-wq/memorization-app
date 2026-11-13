package com.ayahaday.app;

import static org.junit.Assert.*;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Run on an emulator/physical device with connectedDebugAndroidTest after native:sync. */
@RunWith(AndroidJUnit4.class)
public class NativePackageTest {
    private String asset(Context context, String path) throws Exception {
        try (InputStream input = context.getAssets().open(path)) {
            java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int length;
            while ((length = input.read(buffer)) != -1) bytes.write(buffer, 0, length);
            return bytes.toString(StandardCharsets.UTF_8.name());
        }
    }
    @Test public void packageContainsLocalFrontendAndPrivateAppContainer() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("com.ayahaday.app", context.getPackageName());
        assertEquals(0, context.getApplicationInfo().flags & ApplicationInfo.FLAG_ALLOW_BACKUP);
        assertTrue(asset(context, "public/index.html").contains("id=\"app\""));
        JSONObject config = new JSONObject(asset(context, "capacitor.config.json"));
        assertEquals("com.ayahaday.app", config.getString("appId"));
        assertFalse(config.getJSONObject("server").has("url"));
    }
}
