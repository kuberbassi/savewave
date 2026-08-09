# SavewaveMediaPlugin is registered by its fully-qualified class name from
# Rust. Preserve it when a consuming release build enables R8.
-keep class com.kuberbassi.savewave.media.SavewaveMediaPlugin { *; }
-keepclassmembers class com.kuberbassi.savewave.media.SavewaveMediaPlugin {
    @app.tauri.annotation.Command <methods>;
}
