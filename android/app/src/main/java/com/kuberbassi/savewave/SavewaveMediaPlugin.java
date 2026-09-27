package com.kuberbassi.savewave;

import android.content.ContentValues;
import android.content.Intent;
import android.os.Environment;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yausername.ffmpeg.FFmpeg;
import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLException;
import com.yausername.youtubedl_android.YoutubeDLRequest;
import com.yausername.youtubedl_android.YoutubeDLResponse;
import java.io.File;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import kotlin.Unit;
import org.json.JSONObject;
import org.json.JSONArray;

@CapacitorPlugin(name = "SavewaveMedia")
public class SavewaveMediaPlugin extends Plugin {
    private static final String TAG = "SavewaveMedia";
    private static final String APP_VERSION = "1.0.14";
    private static final Set<String> TERMINAL_STATES = Set.of("completed", "cancelled", "error");
    private static final Pattern SPOTIFY_TRACK = Pattern.compile("^/track/([A-Za-z0-9]{22})/?$");
    private static final Pattern NEXT_DATA = Pattern.compile("(?s)<script[^>]*id=[\\\"']__NEXT_DATA__[\\\"'][^>]*>(.*?)</script>");
    private static final Pattern YTM_API_KEY = Pattern.compile("\\\"INNERTUBE_API_KEY\\\":\\\"([^\\\"]+)\\\"");
    private static final Pattern YTM_CLIENT_VERSION = Pattern.compile("\\\"INNERTUBE_CLIENT_VERSION\\\":\\\"([^\\\"]+)\\\"");
    private static final long MAX_IMAGE_BYTES = 50L * 1024 * 1024;
    private static final long MAX_POST_VIDEO_BYTES = 500L * 1024 * 1024;

    private final ExecutorService executor = Executors.newFixedThreadPool(2);
    private final ConcurrentHashMap<String, JSObject> jobs = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, CachedGallery> galleries = new ConcurrentHashMap<>();
    private final CountDownLatch engineReady = new CountDownLatch(1);
    private volatile boolean initializing = true;
    private volatile boolean available;
    private volatile boolean ffmpegReady;
    private volatile String engineVersion;
    private volatile String engineError;
    private volatile long engineStartedAt = SystemClock.elapsedRealtime();

    @Override
    public void load() {
        executor.execute(this::initializeEngine);
    }

    private void initializeEngine() {
        engineStartedAt = SystemClock.elapsedRealtime();
        try {
            YoutubeDL.getInstance().init(getContext().getApplicationContext());
            available = true;
            engineError = null;
            try {
                engineVersion = installedVersion();
                Log.i(TAG, "Android yt-dlp ready: " + engineVersion);
            } catch (Exception versionError) {
                engineVersion = "bundled";
                Log.w(TAG, "Engine version probe failed; bundled engine remains available", versionError);
            }
        } catch (Exception error) {
            available = false;
            engineError = "Engine initialization failed";
            Log.e(TAG, "Engine initialization failed", error);
        } finally {
            initializing = false;
            engineReady.countDown();
        }
    }

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        JSObject sources = new JSObject();
        for (String source : new String[]{"youtube", "threads", "direct"}) {
            sources.put(source, capability(true, true, true, false));
        }
        sources.put("instagram", capability(true, true, false, false));
        for (String source : new String[]{"facebook", "twitter"}) sources.put(source, new JSObject());
        sources.put("soundcloud", capability(false, true, false, false));
        sources.put("spotify", capability(false, true, false, true));
        sources.put("unknown", new JSObject());
        call.resolve(new JSObject().put("platform", "android").put("sources", sources));
    }

    @PluginMethod
    public void getEngineStatus(PluginCall call) {
        if (initializing && SystemClock.elapsedRealtime() - engineStartedAt > 30_000) {
            initializing = false;
            engineError = "Engine initialization timed out";
            Log.e(TAG, engineError);
        }
        JSObject result = new JSObject()
            .put("available", available)
            .put("initializing", initializing)
            .put("version", APP_VERSION)
            .put("engineVersion", engineVersion == null ? "bundled" : engineVersion)
            .put("updateAvailable", false);
        if (engineError != null) result.put("error", engineError);
        call.resolve(result);
    }

    @PluginMethod
    public void getReleaseInfo(PluginCall call) {
        executor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                URI endpoint = new URI("https://raw.githubusercontent.com/kuberbassi/savewave/main/public/client-version.json");
                connection = (HttpURLConnection) endpoint.toURL().openConnection();
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(8000);
                connection.setRequestProperty("Cache-Control", "no-cache");
                if (connection.getResponseCode() != 200) { call.resolve(); return; }
                byte[] bytes;
                try (InputStream stream = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[4096];
                    int count;
                    while ((count = stream.read(buffer)) != -1 && output.size() <= 16_384) output.write(buffer, 0, count);
                    bytes = output.toByteArray();
                }
                if (bytes.length > 16_384) { call.resolve(); return; }
                JSONObject manifest = new JSONObject(new String(bytes, StandardCharsets.UTF_8));
                String version = manifest.getString("version");
                String asset = manifest.getString("androidDownloadUrl");
                URI apk = new URI(asset);
                if (!version.matches("[0-9]+\\.[0-9]+\\.[0-9]+") || !"https".equals(apk.getScheme())
                    || !"github.com".equalsIgnoreCase(apk.getHost())
                    || !apk.getPath().equals("/kuberbassi/savewave/releases/download/v" + version + "/Savewave-android-arm64.apk")) {
                    call.resolve(); return;
                }
                String[] newer = version.split("\\.");
                String[] installed = APP_VERSION.split("\\.");
                boolean update = false;
                for (int index = 0; index < 3; index++) {
                    int difference = Integer.parseInt(newer[index]) - Integer.parseInt(installed[index]);
                    if (difference != 0) { update = difference > 0; break; }
                }
                call.resolve(new JSObject()
                    .put("version", version).put("downloadUrl", asset).put("androidDownloadUrl", asset)
                    .put("releaseUrl", "https://github.com/kuberbassi/savewave/releases/tag/v" + version)
                    .put("changelogUrl", "https://github.com/kuberbassi/savewave/releases/tag/v" + version)
                    .put("summary", manifest.optString("summary", "A Savewave update is available."))
                    .put("updateAvailable", update));
            } catch (Exception error) {
                Log.w(TAG, "Update check unavailable", error);
                call.resolve();
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    @PluginMethod
    public void openExternal(PluginCall call) {
        try {
            URI uri = new URI(required(call.getString("url")));
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null || uri.getUserInfo() != null
                || !(host.equalsIgnoreCase("github.com") || host.equalsIgnoreCase("kuberbassi.com")
                    || host.equalsIgnoreCase("www.kuberbassi.com"))) {
                throw new IllegalArgumentException("External link is not allowed");
            }
            Intent intent = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(uri.toString()));
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("External link could not be opened", "EXTERNAL_URL_REJECTED", error);
        }
    }

    @PluginMethod
    public void resolveMedia(PluginCall call) {
        executor.execute(() -> {
            try {
                String url = AndroidMediaPolicy.canonicalMediaUrl(required(call.getString("url")));
                String mode = call.getString("mode", "video");
                if (AndroidMediaPolicy.isUnavailableSourceUrl(url)) {
                    call.reject("This source is not currently supported by Savewave.", "UNSUPPORTED_SOURCE");
                    return;
                }
                AndroidMediaPolicy.publicHttpUri(url);
                requireEngine();
                InstagramGallery gallery = resolveSocialGallery(url);
                if (gallery != null) {
                    call.resolve(new JSObject()
                        .put("success", true)
                        .put("platform", isInstagramUrl(url) ? "instagram" : "twitter")
                        .put("title", gallery.title)
                        .put("creator", gallery.creator)
                        .put("thumbnail", gallery.thumbnail)
                        .put("type", "image")
                        .put("qualityLabel", gallery.items.size() + " original post items")
                        .put("sourceUrl", url));
                    return;
                }
                YoutubeDLRequest request = commonRequest(url);
                request.addOption("--dump-single-json");
                request.addOption("--skip-download");
                addItemPolicy(request, AndroidMediaPolicy.maxItemsForUrl(url));
                YoutubeDLResponse response;
                try {
                    response = YoutubeDL.getInstance().execute(request);
                } catch (YoutubeDLException firstError) {
                    if (!isInstagramUrl(url) || !isTransientInstagramFailure(firstError)) throw firstError;
                    Log.w(TAG, "Retrying interrupted Instagram metadata request");
                    response = YoutubeDL.getInstance().execute(request);
                }
                requireSuccess(response);
                JSONObject info = new JSONObject(response.getOut());
                String extractor = info.optString("extractor_key", info.optString("extractor", "unknown")).toLowerCase(Locale.ROOT);
                call.resolve(new JSObject()
                    .put("success", true)
                    .put("platform", sourceName(extractor, url))
                    .put("title", info.optString("title", "Media"))
                    .put("creator", info.optString("uploader", info.optString("creator", "Unknown creator")))
                    .put("thumbnail", info.optString("thumbnail", null))
                    .put("duration", info.optDouble("duration", 0))
                    .put("type", mode)
                    .put("qualityLabel", "Best available")
                    .put("sourceUrl", url));
            } catch (Exception error) {
                reject(call, error, "SOURCE_UNAVAILABLE", "This media is unavailable.");
            }
        });
    }

    @PluginMethod
    public void downloadMedia(PluginCall call) {
        final String url;
        final String mode;
        final String title;
        final JSObject policy;
        try {
            url = AndroidMediaPolicy.canonicalMediaUrl(required(call.getString("url")));
            mode = call.getString("mode", "video");
            title = AndroidMediaPolicy.safeStem(call.getString("title", "media"));
            policy = requiredPolicy(call.getObject("policy"), mode, url);
            AndroidMediaPolicy.httpUri(url);
        } catch (Exception error) {
            reject(call, error, "INVALID_URL", "Unsupported media link.");
            return;
        }

        try {
            if (AndroidMediaPolicy.isUnavailableSourceUrl(url)) {
                call.reject("This source is not currently supported by Savewave.", "UNSUPPORTED_SOURCE");
                return;
            }
        } catch (Exception error) {
            reject(call, error, "INVALID_URL", "Unsupported media link.");
            return;
        }

        String jobId = UUID.randomUUID().toString();
        jobs.put(jobId, progress(jobId, "downloading", 0));
        call.resolve(new JSObject().put("jobId", jobId).put("state", "downloading"));
        executor.execute(() -> runDownload(jobId, url, mode, title, policy));
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        String jobId = call.getString("jobId");
        if (jobId == null || !jobs.containsKey(jobId)) {
            call.reject("Download job was not found.", "DOWNLOAD_FAILED");
            return;
        }
        YoutubeDL.getInstance().destroyProcessById(jobId);
        jobs.put(jobId, progress(jobId, "cancelled", null));
        call.resolve();
    }

    @PluginMethod
    public void getDownloadProgress(PluginCall call) {
        JSObject state = jobs.get(call.getString("jobId"));
        if (state == null) call.reject("Download job was not found.", "DOWNLOAD_FAILED");
        else call.resolve(state);
    }

    @PluginMethod
    public void searchCandidates(PluginCall call) {
        executor.execute(() -> {
            try {
                String query = required(call.getString("query"));
                if (query.length() > 500) throw new IllegalArgumentException("Search query is too long");
                requireEngine();
                YoutubeDLRequest request = commonRequest("ytsearch15:" + query);
                request.addOption("--dump-single-json");
                request.addOption("--flat-playlist");
                request.addOption("--playlist-end", 15);
                request.addOption("--skip-download");
                YoutubeDLResponse response = YoutubeDL.getInstance().execute(request);
                requireSuccess(response);
                JSONArray entries = new JSONObject(response.getOut()).optJSONArray("entries");
                JSONArray results = new JSONArray();
                for (int index = 0; entries != null && index < Math.min(entries.length(), 15); index++) {
                    JSONObject item = entries.optJSONObject(index);
                    if (item == null) continue;
                    String id = item.optString("id", "");
                    String title = item.optString("title", "");
                    if (id.isBlank() || title.isBlank() || title.length() > 300) continue;
                    JSObject candidate = new JSObject()
                        .put("videoId", id)
                        .put("url", "https://www.youtube.com/watch?v=" + id)
                        .put("sourceUrl", "https://www.youtube.com/watch?v=" + id)
                        .put("resultType", "generic-video")
                        .put("title", title)
                        .put("artist", item.optString("artist", ""))
                        .put("uploader", item.optString("uploader", item.optString("channel", "")))
                        .put("verified", item.optBoolean("channel_is_verified", false));
                    double duration = item.optDouble("duration", Double.NaN);
                    if (Double.isFinite(duration) && duration > 0) candidate.put("duration", duration);
                    results.put(candidate);
                }
                call.resolve(new JSObject().put("results", results));
            } catch (Exception error) {
                reject(call, error, "SOURCE_UNAVAILABLE", "Search is temporarily unavailable.");
            }
        });
    }

    @PluginMethod
    public void getSpotifyMetadata(PluginCall call) {
        executor.execute(() -> {
            try {
                String url = required(call.getString("url"));
                URI uri = AndroidMediaPolicy.publicHttpUri(url);
                String host = uri.getHost().toLowerCase(Locale.ROOT);
                Matcher trackMatch = SPOTIFY_TRACK.matcher(uri.getPath());
                if (!(host.equals("open.spotify.com") || host.endsWith(".open.spotify.com")) || !trackMatch.matches()) {
                    throw new IllegalArgumentException("Paste an individual Spotify track link");
                }
                JSONObject entity = spotifyEntity(trackMatch.group(1));
                if (!entity.optBoolean("isPlayable", true)) throw new IllegalStateException("This Spotify track is unavailable");
                String trackTitle = entity.optString("title", entity.optString("name", "")).trim();
                JSONArray artistObjects = entity.optJSONArray("artists");
                JSONArray artists = new JSONArray();
                for (int index = 0; artistObjects != null && index < artistObjects.length(); index++) {
                    JSONObject artist = artistObjects.optJSONObject(index);
                    String name = artist == null ? "" : artist.optString("name", "").trim();
                    if (!name.isBlank()) artists.put(name);
                }
                if (trackTitle.isBlank() || artists.length() == 0) throw new IllegalStateException("Spotify metadata is incomplete");
                String thumbnail = bestSpotifyImage(entity.optJSONObject("visualIdentity"));
                double duration = entity.optDouble("duration", Double.NaN);
                JSObject result = new JSObject()
                    .put("title", trackTitle)
                    .put("primaryArtist", artists.getString(0))
                    .put("artists", artists)
                    .put("album", "");
                if (Double.isFinite(duration) && duration > 0) result.put("duration", duration / 1000.0);
                if (thumbnail != null) result.put("thumbnail", thumbnail);
                call.resolve(result);
            } catch (Exception error) {
                reject(call, error, "SOURCE_UNAVAILABLE", "Spotify metadata is unavailable.");
            }
        });
    }

    @PluginMethod
    public void searchYoutubeMusic(PluginCall call) {
        executor.execute(() -> {
            try {
                String query = required(call.getString("query"));
                String filter = required(call.getString("filter"));
                if (query.length() > 500 || !(filter.equals("songs") || filter.equals("videos"))) {
                    throw new IllegalArgumentException("Invalid YouTube Music search");
                }
                call.resolve(new JSObject().put("payload", youtubeMusicSearch(query, filter)));
            } catch (Exception error) {
                reject(call, error, "SOURCE_UNAVAILABLE", "YouTube Music search is unavailable.");
            }
        });
    }

    private void runDownload(String jobId, String url, String mode, String title, JSObject policy) {
        File directory = new File(getContext().getCacheDir(), "savewave/" + jobId);
        List<android.net.Uri> published = new ArrayList<>();
        try {
            AndroidMediaPolicy.publicHttpUri(url);
            requireEngine();
            if (!directory.mkdirs() && !directory.isDirectory()) throw new IllegalStateException("Storage directory failed");
            InstagramGallery gallery = resolveSocialGallery(url);
            if (gallery != null) {
                JSONArray filenames = new JSONArray();
                for (int index = 0; index < gallery.items.size(); index++) {
                    JSObject current = jobs.get(jobId);
                    if (current != null && "cancelled".equals(current.getString("state"))) return;
                    SocialItem item = gallery.items.get(index);
                    String filename = AndroidMediaPolicy.safeStem(gallery.title) + "-" + String.format(Locale.ROOT, "%02d", index + 1) + (item.video ? ".mp4" : ".jpg");
                    File media = downloadSocialItem(item, directory, filename);
                    published.add(publish(media, item.video ? "video" : "image"));
                    filenames.put(filename);
                    jobs.put(jobId, progress(jobId, "downloading", ((index + 1.0) / gallery.items.size()) * 100));
                }
                jobs.put(jobId, progress(jobId, "completed", 100)
                    .put("filename", filenames.getString(filenames.length() - 1))
                    .put("filenames", filenames));
                return;
            }
            requireFfmpeg();
            YoutubeDLRequest request = commonRequest(url, policy);
            int maxItems = policy.getInteger("maxItems", 1);
            addItemPolicy(request, maxItems);
            request.addOption("--newline");
            request.addOption("--continue");
            request.addOption("--no-overwrites");
            String outputTemplate = maxItems > 1 ? title + "-%(playlist_index)02d-%(id)s.%(ext)s" : title + "-%(id)s.%(ext)s";
            request.addOption("-o", new File(directory, outputTemplate).getAbsolutePath());
            request.addOption("-f", policy.getString("formatSelector"));
            if (Boolean.TRUE.equals(policy.getBoolean("extractAudio", false))) {
                request.addOption("--extract-audio");
                request.addOption("--audio-format", policy.getString("audioFormat"));
            } else if (policy.has("mergeOutputFormat")) {
                request.addOption("--merge-output-format", policy.getString("mergeOutputFormat"));
            }
            kotlin.jvm.functions.Function3<Float, Long, String, Unit> onProgress = (percent, eta, line) -> {
                JSObject current = jobs.get(jobId);
                if (current != null && !"cancelled".equals(current.getString("state"))) {
                    JSObject update = progress(jobId, "downloading", Math.max(0, Math.min(100, percent.doubleValue())));
                    if (eta != null && eta >= 0) update.put("eta", eta);
                    jobs.put(jobId, update);
                }
                return Unit.INSTANCE;
            };
            YoutubeDLResponse response;
            try {
                response = YoutubeDL.getInstance().execute(request, jobId, onProgress);
            } catch (YoutubeDLException firstError) {
                if (isInstagramUrl(url) && isTransientInstagramFailure(firstError)) {
                    Log.w(TAG, "Retrying interrupted Instagram download");
                    response = YoutubeDL.getInstance().execute(request, jobId, onProgress);
                } else {
                    if (!isYouTubeLink(url) || !String.valueOf(firstError.getMessage()).contains("403") ||
                        "cancelled".equals(jobs.get(jobId).getString("state"))) throw firstError;
                    Log.w(TAG, "YouTube rejected bundled yt-dlp; checking for an engine update", firstError);
                    try {
                        YoutubeDL.UpdateStatus status = YoutubeDL.getInstance().updateYoutubeDL(getContext().getApplicationContext(), YoutubeDL.UpdateChannel._STABLE);
                        engineVersion = installedVersion();
                        Log.i(TAG, "Android yt-dlp update: " + status + ", version " + engineVersion);
                    } catch (Exception updateError) {
                        Log.w(TAG, "Android yt-dlp update unavailable", updateError);
                        throw firstError;
                    }
                    response = YoutubeDL.getInstance().execute(request, jobId, onProgress);
                }
            }
            requireSuccess(response);
            if ("cancelled".equals(jobs.get(jobId).getString("state"))) return;
            jobs.put(jobId, progress(jobId, "processing", 98));
            File[] outputs = completedFiles(directory, maxItems);
            JSONArray filenames = new JSONArray();
            for (File output : outputs) {
                published.add(publish(output, mode));
                filenames.put(output.getName());
            }
            jobs.put(jobId, progress(jobId, "completed", 100)
                .put("filename", outputs[outputs.length - 1].getName())
                .put("filenames", filenames));
        } catch (Exception error) {
            for (android.net.Uri uri : published) getContext().getContentResolver().delete(uri, null, null);
            JSObject current = jobs.get(jobId);
            if (current == null || !"cancelled".equals(current.getString("state"))) {
                jobs.put(jobId, progress(jobId, "error", null)
                    .put("errorCode", AndroidMediaPolicy.errorCode(error))
                    .put("errorMessage", AndroidMediaPolicy.publicMessage(AndroidMediaPolicy.errorCode(error))));
            }
            Log.e(TAG, "Download failed", error);
        } finally {
            deleteRecursively(directory);
            trimJobs();
        }
    }

    private YoutubeDLRequest commonRequest(String url) {
        return commonRequest(url, null);
    }

    private static boolean isYouTubeLink(String url) throws Exception {
        String host = AndroidMediaPolicy.httpUri(url).getHost().toLowerCase(Locale.ROOT);
        return host.equals("youtube.com") || host.endsWith(".youtube.com") || host.equals("youtu.be");
    }

    private static boolean isTransientInstagramFailure(Throwable error) {
        String reason = String.valueOf(error.getMessage()).toLowerCase(Locale.ROOT);
        return reason.contains("incompleteread") || reason.contains("record layer failure") || reason.contains("connection reset");
    }

    private YoutubeDLRequest commonRequest(String url, JSObject policy) {
        YoutubeDLRequest request = new YoutubeDLRequest(url);
        request.addOption("--no-warnings");
        request.addOption("--socket-timeout", policy == null ? 20 : policy.getInteger("socketTimeoutSeconds", 20));
        request.addOption("--retries", policy == null ? 5 : policy.getInteger("retries", 5));
        request.addOption("--fragment-retries", policy == null ? 5 : policy.getInteger("fragmentRetries", 5));
        request.addOption("--extractor-retries", policy == null ? 3 : policy.getInteger("extractorRetries", 3));
        request.addOption("--force-ipv4");
        request.addOption("--remote-components", "ejs:github");
        return request;
    }

    private void requireEngine() throws Exception {
        if (initializing && !engineReady.await(20, TimeUnit.SECONDS)) throw new IllegalStateException("Engine initialization timed out");
        if (!available) throw new IllegalStateException(engineError == null ? "The local engine is unavailable" : engineError);
    }

    private synchronized void requireFfmpeg() throws Exception {
        if (ffmpegReady) return;
        FFmpeg.getInstance().init(getContext().getApplicationContext());
        ffmpegReady = true;
    }

    private String installedVersion() throws Exception {
        String version = YoutubeDL.getInstance().version(getContext().getApplicationContext());
        return version == null || version.isBlank() ? "bundled" : version.trim();
    }

    private void requireSuccess(YoutubeDLResponse response) {
        if (response.getExitCode() == 0) return;
        String message = "The source rejected extraction";
        for (String line : response.getErr().split("\\R")) {
            String trimmed = line.trim();
            if (trimmed.startsWith("ERROR:")) message = trimmed.replaceFirst("^ERROR:\\s*", "");
        }
        throw new IllegalStateException(message.substring(0, Math.min(message.length(), 240)));
    }

    private android.net.Uri publish(File file, String mode) throws Exception {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, file.getName());
        values.put(MediaStore.Downloads.MIME_TYPE, AndroidMediaPolicy.mimeType(file.getName(), mode));
        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Savewave");
        values.put(MediaStore.Downloads.IS_PENDING, 1);
        android.net.Uri uri = getContext().getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) throw new IllegalStateException("MediaStore insert failed");
        try (OutputStream output = getContext().getContentResolver().openOutputStream(uri); java.io.FileInputStream input = new java.io.FileInputStream(file)) {
            if (output == null) throw new IllegalStateException("MediaStore output failed");
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            getContext().getContentResolver().update(uri, values, null, null);
            return uri;
        } catch (Exception error) {
            getContext().getContentResolver().delete(uri, null, null);
            throw error;
        }
    }

    private static File[] completedFiles(File directory, int maximum) {
        File[] files = directory.listFiles(file -> file.isFile() && !file.getName().endsWith(".part") && !file.getName().endsWith(".ytdl"));
        if (files == null || files.length == 0) throw new IllegalStateException("Downloaded output is missing");
        Arrays.sort(files, Comparator.comparing(File::getName));
        if (files.length > maximum) throw new IllegalStateException("Downloaded output exceeded the item limit");
        return files;
    }

    private static void addItemPolicy(YoutubeDLRequest request, int maximum) {
        if (maximum > 1) {
            request.addOption("--yes-playlist");
            request.addOption("--playlist-end", maximum);
        } else request.addOption("--no-playlist");
    }

    private InstagramGallery resolveSocialGallery(String url) throws Exception {
        boolean instagram = isInstagramUrl(url);
        if (!instagram && !isXUrl(url)) return null;
        if (instagram && isInstagramReelUrl(url)) return null;
        CachedGallery cached = galleries.get(url);
        if (cached != null && SystemClock.elapsedRealtime() - cached.createdAt < TimeUnit.MINUTES.toMillis(10)) {
            return cached.gallery;
        }
        galleries.remove(url);
        YoutubeDLRequest request = commonRequest(url);
        request.addOption("--ignore-no-formats");
        request.addOption("--ignore-errors");
        request.addOption("--dump-json");
        request.addOption("--playlist-end", 20);
        request.addOption("--skip-download");
        String output;
        try {
            output = YoutubeDL.getInstance().execute(request).getOut();
        } catch (YoutubeDLException firstError) {
            String reason = String.valueOf(firstError.getMessage());
            if (instagram && reason.contains("No video formats found")) {
                // This Android wrapper discards stdout on a non-zero exit for photo-only posts.
                output = galleryOutputDespitePhotoWarnings(request);
            } else {
                if (!reason.contains("IncompleteRead") && !reason.contains("timed out")) throw firstError;
                Log.w(TAG, "Retrying interrupted public post metadata request");
                try {
                    output = YoutubeDL.getInstance().execute(request).getOut();
                } catch (YoutubeDLException retryError) {
                    if (!instagram || !String.valueOf(retryError.getMessage()).contains("No video formats found")) throw retryError;
                    output = galleryOutputDespitePhotoWarnings(request);
                }
            }
        }
        JSONArray entries = new JSONArray();
        for (String line : output.split("\\R")) {
            if (!line.trim().startsWith("{")) continue;
            entries.put(new JSONObject(line));
        }
        if (entries.length() == 0) return null;
        JSONObject info = entries.getJSONObject(0);
        List<SocialItem> items = new ArrayList<>();
        String thumbnail = null;
        if (instagram) {
            for (int index = 0; index < entries.length() && index < 20; index++) {
                JSONObject entry = entries.optJSONObject(index);
                if (entry == null) continue;
                JSONArray formats = entry.optJSONArray("formats");
                boolean video = formats != null && formats.length() > 0;
                JSONArray thumbnails = entry.optJSONArray("thumbnails");
                String best = null;
                long area = -1;
                for (int thumb = 0; thumbnails != null && thumb < thumbnails.length(); thumb++) {
                    JSONObject candidate = thumbnails.optJSONObject(thumb);
                    if (candidate == null) continue;
                    String image = candidate.optString("url", "");
                    if (!isSocialImageUrl(image)) continue;
                    long size = (long) candidate.optInt("width", 0) * candidate.optInt("height", 0);
                    if (size > area) { best = image; area = size; }
                }
                if (thumbnail == null) thumbnail = best;
                if (video) {
                    String videoUrl = entry.optString("url", "");
                    if (!isInstagramMediaUrl(videoUrl)) throw new IllegalStateException("Instagram carousel item could not be resolved");
                    items.add(new SocialItem(videoUrl, true));
                } else if (best != null) {
                    items.add(new SocialItem(best, false));
                } else throw new IllegalStateException("Instagram carousel item could not be resolved");
            }
            if (items.size() == 1 && items.get(0).video) return null;
        } else {
            JSONArray formats = info.optJSONArray("formats");
            if (formats != null && formats.length() > 0) return null;
            String html = fetchBoundedText(url, "Mozilla/5.0", 3 * 1024 * 1024).replace("&amp;", "&");
            Matcher matcher = Pattern.compile("https://pbs\\.twimg\\.com/media/[A-Za-z0-9_-]+\\?format=(?:jpg|jpeg|png|webp)&name=(?:small|medium|large|orig)").matcher(html);
            Map<String, String> unique = new LinkedHashMap<>();
            while (matcher.find() && unique.size() < 4) {
                String image = matcher.group();
                URI parsed = new URI(image);
                if (isSocialImageUrl(image)) unique.put(parsed.getPath(), image.replaceAll("format=(?:jpg|jpeg|png|webp)&name=(?:small|medium|large|orig)", "format=jpg&name=orig"));
            }
            for (String image : unique.values()) items.add(new SocialItem(image, false));
            if (!items.isEmpty()) thumbnail = items.get(0).url;
        }
        if (items.isEmpty()) return null;
        String resolvedTitle = info.optString("title", instagram ? "Instagram post" : "X post").trim();
        if (resolvedTitle.isBlank()) resolvedTitle = instagram ? "Instagram post" : "X post";
        String creator = info.optString("uploader", info.optString("channel", instagram ? "Instagram creator" : "X creator")).trim();
        if (creator.isBlank()) creator = instagram ? "Instagram creator" : "X creator";
        InstagramGallery gallery = new InstagramGallery(resolvedTitle, creator, thumbnail, items);
        if (galleries.size() >= 16) galleries.clear();
        galleries.put(url, new CachedGallery(gallery));
        return gallery;
    }

    private String galleryOutputDespitePhotoWarnings(YoutubeDLRequest request) throws Exception {
        File base = new File(getContext().getNoBackupFilesDir(), "youtubedl-android");
        File packages = new File(base, "packages");
        File python = new File(packages, "python/usr");
        File ffmpeg = new File(packages, "ffmpeg/usr");
        File libraries = new File(getContext().getApplicationInfo().nativeLibraryDir);
        File binary = new File(libraries, "libpython.so");
        File script = new File(base, "yt-dlp/yt-dlp");
        if (!binary.isFile() || !script.isFile()) throw new IllegalStateException("Android extractor is unavailable");
        List<String> command = new ArrayList<>();
        command.add(binary.getAbsolutePath());
        command.add(script.getAbsolutePath());
        command.addAll(request.buildCommand());
        command.add("--no-cache-dir");
        ProcessBuilder builder = new ProcessBuilder(command).redirectErrorStream(true);
        Map<String, String> environment = builder.environment();
        environment.put("LD_LIBRARY_PATH", new File(python, "lib").getAbsolutePath() + ":" + new File(ffmpeg, "lib").getAbsolutePath());
        environment.put("SSL_CERT_FILE", new File(python, "etc/tls/cert.pem").getAbsolutePath());
        environment.put("PYTHONHOME", python.getAbsolutePath());
        environment.put("HOME", python.getAbsolutePath());
        environment.put("TMPDIR", getContext().getCacheDir().getAbsolutePath());
        environment.put("PATH", environment.getOrDefault("PATH", "") + ":" + libraries.getAbsolutePath());
        Process process = builder.start();
        try {
            return readBounded(process.getInputStream(), 20 * 1024 * 1024, "Photo metadata is too large");
        } finally {
            if (process.isAlive()) process.destroy();
        }
    }

    private JSONObject spotifyEntity(String trackId) throws Exception {
        String html = fetchBoundedText("https://open.spotify.com/embed/track/" + trackId, "Savewave/1.0", 2 * 1024 * 1024);
        Matcher matcher = NEXT_DATA.matcher(html);
        if (!matcher.find()) throw new IllegalStateException("Spotify metadata is unavailable");
        return new JSONObject(matcher.group(1)).getJSONObject("props").getJSONObject("pageProps")
            .getJSONObject("state").getJSONObject("data").getJSONObject("entity");
    }

    private static String bestSpotifyImage(JSONObject visualIdentity) {
        JSONArray images = visualIdentity == null ? null : visualIdentity.optJSONArray("image");
        String best = null;
        long area = -1;
        for (int index = 0; images != null && index < images.length(); index++) {
            JSONObject image = images.optJSONObject(index);
            if (image == null) continue;
            String url = image.optString("url", "");
            long candidateArea = image.optLong("maxWidth", 0) * image.optLong("maxHeight", 0);
            if (!url.isBlank() && candidateArea > area) { best = url; area = candidateArea; }
        }
        return best;
    }

    private JSONObject youtubeMusicSearch(String query, String filter) throws Exception {
        String home = fetchBoundedText("https://music.youtube.com/", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36", 5 * 1024 * 1024)
            .replace("\\\"", "\"");
        Matcher keyMatch = YTM_API_KEY.matcher(home);
        Matcher versionMatch = YTM_CLIENT_VERSION.matcher(home);
        if (!keyMatch.find() || !versionMatch.find()) throw new IllegalStateException("YouTube Music session is unavailable");
        String params = filter.equals("songs") ? "EgWKAQIIAWoKEAkQBRAKEAMQBA==" : "EgWKAQIQAWoKEAkQChAFEAMQBA==";
        String endpoint = "https://music.youtube.com/youtubei/v1/search?key=" + URLEncoder.encode(keyMatch.group(1), StandardCharsets.UTF_8.name()) + "&prettyPrint=false";
        HttpURLConnection connection = (HttpURLConnection) new URI(endpoint).toURL().openConnection();
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setConnectTimeout(8_000);
        connection.setReadTimeout(8_000);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Origin", "https://music.youtube.com");
        connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36");
        JSONObject body = new JSONObject()
            .put("context", new JSONObject().put("client", new JSONObject()
                .put("clientName", "WEB_REMIX").put("clientVersion", versionMatch.group(1)).put("hl", "en")))
            .put("query", query)
            .put("params", params);
        try {
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            int status = connection.getResponseCode();
            if (status < 200 || status > 299) throw new IllegalStateException("YouTube Music search failed: " + status);
            return new JSONObject(readBounded(connection.getInputStream(), 5 * 1024 * 1024, "YouTube Music response is too large"));
        } finally { connection.disconnect(); }
    }

    private String fetchBoundedText(String url, String userAgent, int maximumBytes) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URI(url).toURL().openConnection();
        connection.setConnectTimeout(8_000);
        connection.setReadTimeout(12_000);
        connection.setRequestProperty("User-Agent", userAgent);
        connection.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
        try {
            int status = connection.getResponseCode();
            if (status < 200 || status > 299) throw new IllegalStateException("Metadata request failed: " + status);
            return readBounded(connection.getInputStream(), maximumBytes, "Metadata response is too large");
        } finally { connection.disconnect(); }
    }

    private static String readBounded(InputStream input, int maximumBytes, String overflowMessage) throws Exception {
        try (InputStream source = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int total = 0;
            int count;
            while ((count = source.read(buffer)) != -1) {
                total += count;
                if (total > maximumBytes) throw new IllegalStateException(overflowMessage);
                output.write(buffer, 0, count);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private File downloadSocialItem(SocialItem item, File directory, String filename) throws Exception {
        URI uri = new URI(item.url);
        if (item.video ? !isInstagramMediaUrl(item.url) : !isSocialImageUrl(item.url)) {
            throw new IllegalArgumentException("Invalid social media host");
        }
        long maximumBytes = item.video ? MAX_POST_VIDEO_BYTES : MAX_IMAGE_BYTES;
        HttpURLConnection connection = (HttpURLConnection) uri.toURL().openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(12_000);
        connection.setReadTimeout(45_000);
        connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36");
        connection.setRequestProperty("Referer", "pbs.twimg.com".equalsIgnoreCase(uri.getHost()) ? "https://x.com/" : "https://www.instagram.com/");
        connection.setRequestProperty("Accept", item.video ? "video/mp4,*/*;q=0.8" : "image/avif,image/webp,image/*,*/*;q=0.8");
        try {
            int status = connection.getResponseCode();
            String contentType = connection.getContentType();
            if (status < 200 || status > 299 || contentType == null ||
                !contentType.toLowerCase(Locale.ROOT).startsWith(item.video ? "video/" : "image/")) {
                throw new IllegalStateException("Instagram post item download failed: " + status);
            }
            if (connection.getContentLengthLong() > maximumBytes) throw new IllegalStateException("Instagram post item is too large");
            File target = new File(directory, filename);
            try (InputStream input = connection.getInputStream(); OutputStream output = new java.io.FileOutputStream(target)) {
                byte[] buffer = new byte[64 * 1024];
                long total = 0;
                int count;
                while ((count = input.read(buffer)) != -1) {
                    total += count;
                    if (total > maximumBytes) throw new IllegalStateException("Instagram post item is too large");
                    output.write(buffer, 0, count);
                }
            }
            if (target.length() == 0) throw new IllegalStateException("Instagram post item download failed");
            return target;
        } finally { connection.disconnect(); }
    }

    private static boolean isInstagramUrl(String url) {
        try {
            String host = new URI(url).getHost();
            return host != null && (host.equalsIgnoreCase("instagram.com") || host.toLowerCase(Locale.ROOT).endsWith(".instagram.com"));
        } catch (Exception ignored) { return false; }
    }

    private static boolean isInstagramReelUrl(String url) {
        try {
            String path = new URI(url).getPath();
            return path != null && (path.startsWith("/reel/") || path.startsWith("/reels/"));
        } catch (Exception ignored) { return false; }
    }

    private static boolean isXUrl(String url) {
        try {
            String host = new URI(url).getHost();
            return host != null && (host.equalsIgnoreCase("x.com") || host.equalsIgnoreCase("www.x.com")
                || host.equalsIgnoreCase("twitter.com") || host.equalsIgnoreCase("www.twitter.com"));
        } catch (Exception ignored) { return false; }
    }

    private static boolean isSocialImageUrl(String url) {
        try {
            URI uri = new URI(url);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getUserInfo() == null
                && (isInstagramImageHost(uri.getHost()) || "pbs.twimg.com".equalsIgnoreCase(uri.getHost()));
        } catch (Exception ignored) { return false; }
    }

    private static boolean isInstagramMediaUrl(String url) {
        try {
            URI uri = new URI(url);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getUserInfo() == null
                && isInstagramImageHost(uri.getHost());
        } catch (Exception ignored) { return false; }
    }

    private static boolean isInstagramImageHost(String host) {
        if (host == null) return false;
        String value = host.toLowerCase(Locale.ROOT);
        return value.equals("cdninstagram.com") || value.endsWith(".cdninstagram.com") || value.equals("fbcdn.net") || value.endsWith(".fbcdn.net");
    }

    private static final class InstagramGallery {
        final String title;
        final String creator;
        final String thumbnail;
        final List<SocialItem> items;

        InstagramGallery(String title, String creator, String thumbnail, List<SocialItem> items) {
            this.title = title;
            this.creator = creator;
            this.thumbnail = thumbnail;
            this.items = items;
        }
    }

    private static final class SocialItem {
        final String url;
        final boolean video;

        SocialItem(String url, boolean video) {
            this.url = url;
            this.video = video;
        }
    }

    private static final class CachedGallery {
        final InstagramGallery gallery;
        final long createdAt = SystemClock.elapsedRealtime();

        CachedGallery(InstagramGallery gallery) { this.gallery = gallery; }
    }

    private static JSObject progress(String jobId, String state, Number percent) {
        JSObject value = new JSObject().put("jobId", jobId).put("state", state);
        if (percent != null) value.put("percent", percent);
        return value;
    }

    private static JSObject capability(boolean video, boolean audio, boolean media, boolean smartMatch) {
        JSObject value = new JSObject();
        if (video) value.put("video", true);
        if (audio) value.put("audio", true);
        if (media) value.put("media", true);
        if (smartMatch) value.put("smartMatch", true);
        return value;
    }

    private static String sourceName(String extractor, String url) {
        String value = (extractor + " " + url).toLowerCase(Locale.ROOT);
        if (value.contains("youtube") || value.contains("youtu.be")) return "youtube";
        if (value.contains("instagram")) return "instagram";
        if (value.contains("facebook") || value.contains("fb.watch")) return "facebook";
        if (value.contains("soundcloud")) return "soundcloud";
        if (value.contains("twitter") || value.contains("x.com")) return "twitter";
        if (value.contains("threads.net")) return "threads";
        return "direct";
    }

    private static String required(String value) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Unsupported media link");
        return value;
    }

    private static JSObject requiredPolicy(JSObject policy, String mode, String url) throws Exception {
        if (policy == null) throw new IllegalArgumentException("Download policy is missing");
        String format = policy.getString("formatSelector");
        boolean audio = "audio".equals(mode);
        if (audio) {
            if (!"bestaudio/best".equals(format) || !Boolean.TRUE.equals(policy.getBoolean("extractAudio", false)) ||
                !"best".equals(policy.getString("audioFormat"))) {
                throw new IllegalArgumentException("Invalid audio download policy");
            }
        } else if (Boolean.TRUE.equals(policy.getBoolean("extractAudio", false)) ||
            (AndroidMediaPolicy.isSocialUrl(url)
                ? !"best".equals(format) || policy.has("mergeOutputFormat")
                : !"bestvideo+bestaudio/best".equals(format) || !"mp4/mkv".equals(policy.getString("mergeOutputFormat")))) {
            throw new IllegalArgumentException("Invalid video download policy");
        }
        for (String key : new String[]{"socketTimeoutSeconds", "retries", "fragmentRetries", "extractorRetries"}) {
            Integer value = policy.getInteger(key);
            if (value == null || value < 0 || value > 60) throw new IllegalArgumentException("Invalid reliability policy");
        }
        Integer maxItems = policy.getInteger("maxItems");
        if (maxItems == null || maxItems != AndroidMediaPolicy.maxItemsForUrl(url)) throw new IllegalArgumentException("Invalid item policy");
        return policy;
    }

    private static void reject(PluginCall call, Exception error, String fallbackCode, String fallbackMessage) {
        Log.w(TAG, "Native media request failed", error);
        String code = AndroidMediaPolicy.errorCode(error);
        if ("DOWNLOAD_FAILED".equals(code)) code = fallbackCode;
        String message = AndroidMediaPolicy.publicMessage(code);
        if ("DOWNLOAD_FAILED".equals(code)) message = fallbackMessage;
        call.reject(message, code, error);
    }

    private void trimJobs() {
        if (jobs.size() <= 64) return;
        jobs.entrySet().stream().filter(entry -> TERMINAL_STATES.contains(entry.getValue().getString("state")))
            .limit(jobs.size() - 48L).forEach(entry -> jobs.remove(entry.getKey(), entry.getValue()));
    }

    private static void deleteRecursively(File value) {
        File[] children = value.listFiles();
        if (children != null) for (File child : children) deleteRecursively(child);
        if (value.exists() && !value.delete()) Log.w(TAG, "Could not delete temporary path");
    }

    @Override
    protected void handleOnDestroy() {
        jobs.forEach((jobId, state) -> {
            if (!TERMINAL_STATES.contains(state.getString("state"))) YoutubeDL.getInstance().destroyProcessById(jobId);
        });
        executor.shutdownNow();
        deleteRecursively(new File(getContext().getCacheDir(), "savewave"));
        jobs.clear();
    }
}
