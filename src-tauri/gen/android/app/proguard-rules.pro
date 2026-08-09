# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Tauri discovers mobile plugins by their configured class name. R8 cannot see
# that reflective lookup, so a release build must retain the plugin class and
# its annotated command methods.
-keep @app.tauri.annotation.TauriPlugin class * extends app.tauri.plugin.Plugin { *; }
-keepclassmembers class * {
    @app.tauri.annotation.Command <methods>;
}

# Keep useful source locations in release crash reports.
-keepattributes SourceFile,LineNumberTable,*Annotation*
