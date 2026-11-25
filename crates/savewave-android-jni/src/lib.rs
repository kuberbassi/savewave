use jni::objects::{JClass, JString};
use jni::sys::jstring;
use jni::JNIEnv;
use savewave_core::errors::classify_error_text;
use savewave_core::filename::sanitize_filename;
use savewave_core::models::PlatformType;
use savewave_core::sources::{canonical_media_url, detect_source, is_unavailable_source, validate_public_url};
use savewave_core::spotify::resolve_spotify_smart_match;
use savewave_core::updater::fetch_release_info;
use serde_json::json;
use std::sync::OnceLock;
use tokio::runtime::Runtime;

fn runtime() -> &'static Runtime {
    static RT: OnceLock<Runtime> = OnceLock::new();
    RT.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
            .expect("tokio runtime")
    })
}

fn read_jstring(env: &mut JNIEnv, input: JString) -> String {
    env.get_string(&input)
        .map(|s| s.into())
        .unwrap_or_default()
}

fn write_jstring(env: &JNIEnv, value: &str) -> jstring {
    env.new_string(value)
        .map(|s| s.into_raw())
        .unwrap_or(std::ptr::null_mut())
}

#[no_mangle]
pub extern "system" fn Java_com_kuberbassi_savewave_bridge_SavewaveRustBridge_nativeDetectSource(
    mut env: JNIEnv,
    _class: JClass,
    url: JString,
) -> jstring {
    let raw = read_jstring(&mut env, url);
    let source = detect_source(&raw);
    let unavailable = is_unavailable_source(source, Some(&raw));
    let canonical = canonical_media_url(&raw);
    let payload = json!({
        "source": source.as_str(),
        "unavailable": unavailable,
        "canonicalUrl": canonical,
    });
    write_jstring(&env, &payload.to_string())
}

#[no_mangle]
pub extern "system" fn Java_com_kuberbassi_savewave_bridge_SavewaveRustBridge_nativeValidateUrl(
    mut env: JNIEnv,
    _class: JClass,
    url: JString,
) -> jstring {
    let raw = read_jstring(&mut env, url);
    let payload = match validate_public_url(&raw) {
        Ok(u) => json!({ "valid": true, "url": u.to_string() }),
        Err(e) => json!({ "valid": false, "code": e.code().as_str(), "message": e.message() }),
    };
    write_jstring(&env, &payload.to_string())
}

#[no_mangle]
pub extern "system" fn Java_com_kuberbassi_savewave_bridge_SavewaveRustBridge_nativeResolveSpotify(
    mut env: JNIEnv,
    _class: JClass,
    url: JString,
) -> jstring {
    let raw = read_jstring(&mut env, url);
    let result = runtime().block_on(resolve_spotify_smart_match(&raw));
    let payload = match result {
        Ok(media) => json!({ "ok": true, "media": media }),
        Err(e) => json!({ "ok": false, "code": e.code().as_str(), "message": e.message() }),
    };
    write_jstring(&env, &payload.to_string())
}

#[no_mangle]
pub extern "system" fn Java_com_kuberbassi_savewave_bridge_SavewaveRustBridge_nativeClassifyError(
    mut env: JNIEnv,
    _class: JClass,
    raw_error: JString,
) -> jstring {
    let raw = read_jstring(&mut env, raw_error);
    let code = classify_error_text(&raw);
    let payload = json!({
        "code": code.as_str(),
        "message": code.user_message(),
    });
    write_jstring(&env, &payload.to_string())
}

#[no_mangle]
pub extern "system" fn Java_com_kuberbassi_savewave_bridge_SavewaveRustBridge_nativeSanitizeFilename(
    mut env: JNIEnv,
    _class: JClass,
    raw_name: JString,
) -> jstring {
    let raw = read_jstring(&mut env, raw_name);
    let safe = sanitize_filename(&raw, 100);
    write_jstring(&env, &safe)
}

#[no_mangle]
pub extern "system" fn Java_com_kuberbassi_savewave_bridge_SavewaveRustBridge_nativeFetchReleaseInfo(
    env: JNIEnv,
    _class: JClass,
) -> jstring {
    let info = runtime().block_on(fetch_release_info(PlatformType::Android));
    let payload = serde_json::to_string(&info).unwrap_or_else(|_| "null".to_string());
    write_jstring(&env, &payload)
}
