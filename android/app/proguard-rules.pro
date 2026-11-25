# Keep JNI native bridge methods called by libsavewave_core.so
-keep class com.kuberbassi.savewave.bridge.SavewaveRustBridge {
    native <methods>;
    public static <methods>;
}

# Keep youtubedl-android and ffmpeg runtime classes
-keep class com.yausername.** { *; }
-dontwarn com.yausername.**
-dontwarn org.apache.commons.**
