package com.kuberbassi.savewave;

import java.net.InetAddress;
import java.net.URI;
import java.util.Locale;

final class AndroidMediaPolicy {
    private AndroidMediaPolicy() {}

    static URI httpUri(String value) throws Exception {
        URI uri = new URI(value);
        String scheme = uri.getScheme();
        String host = uri.getHost();
        if (host == null || uri.getUserInfo() != null ||
            !("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))) {
            throw new IllegalArgumentException("Unsupported media link");
        }
        return uri;
    }

    static URI publicHttpUri(String value) throws Exception {
        URI uri = httpUri(value);
        for (InetAddress address : InetAddress.getAllByName(uri.getHost())) {
            if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress() ||
                address.isSiteLocalAddress() || address.isMulticastAddress()) {
                throw new IllegalArgumentException("Private network media links are unsupported");
            }
        }
        return uri;
    }

    static int maxItemsForUrl(String value) throws Exception {
        String host = httpUri(value).getHost().toLowerCase(Locale.ROOT);
        return isSocialHost(host) ? 20 : 1;
    }

    static String canonicalMediaUrl(String value) throws Exception {
        URI uri = httpUri(value);
        String host = uri.getHost().toLowerCase(Locale.ROOT);
        if (!host.equals("youtube.com") && !host.endsWith(".youtube.com")) return value;
        String path = uri.getPath();
        if (path == null || !path.matches("/shorts/[A-Za-z0-9_-]{11}/?")) return value;
        String id = path.split("/")[2];
        return "https://www.youtube.com/watch?v=" + id;
    }

    static boolean isSocialUrl(String value) throws Exception {
        return isSocialHost(httpUri(value).getHost().toLowerCase(Locale.ROOT));
    }

    static boolean isUnavailableSourceUrl(String value) throws Exception {
        String host = httpUri(value).getHost().toLowerCase(Locale.ROOT);
        return host.equals("instagram.com") || host.endsWith(".instagram.com") ||
            host.equals("facebook.com") || host.endsWith(".facebook.com") || host.equals("fb.watch") ||
            host.equals("twitter.com") || host.endsWith(".twitter.com") ||
            host.equals("x.com") || host.endsWith(".x.com");
    }

    private static boolean isSocialHost(String host) {
        return host.equals("instagram.com") || host.endsWith(".instagram.com") ||
            host.equals("facebook.com") || host.endsWith(".facebook.com") || host.equals("fb.watch") ||
            host.equals("threads.net") || host.endsWith(".threads.net") ||
            host.equals("twitter.com") || host.endsWith(".twitter.com") || host.equals("x.com") || host.endsWith(".x.com");
    }

    static String safeStem(String value) {
        String safe = value == null ? "media" : value
            .replaceAll("[<>:\"/\\\\|?*\\x00-\\x1F]", " ")
            .replaceAll("\\s+", " ")
            .trim();
        safe = safe.replaceAll("[. ]+$", "");
        if (safe.isBlank()) safe = "media";
        return safe.substring(0, Math.min(safe.length(), 120));
    }

    static String mimeType(String filename, String mode) {
        String extension = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        return switch (extension) {
            case "opus", "ogg", "oga" -> "audio/ogg";
            case "m4a", "mp4" -> "audio".equals(mode) ? "audio/mp4" : "video/mp4";
            case "mp3" -> "audio/mpeg";
            case "wav" -> "audio/wav";
            case "flac" -> "audio/flac";
            case "aac" -> "audio/aac";
            case "webm" -> "audio".equals(mode) ? "audio/webm" : "video/webm";
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "webp" -> "image/webp";
            case "gif" -> "image/gif";
            default -> "application/octet-stream";
        };
    }

    static String errorCode(Throwable error) {
        String message = error.getMessage() == null ? "" : error.getMessage().toLowerCase(Locale.ROOT);
        if (message.contains("cancel")) return "CANCELLED";
        if ((message.contains("instagram") && message.contains("no video formats found")) ||
            message.contains("instagram carousel item could not be resolved")) return "POST_IMAGES_UNSUPPORTED";
        if (message.contains("private network") || message.contains("unsupported media link")) return "INVALID_URL";
        if (message.contains("timed out") || message.contains("timeout")) return "TIMEOUT";
        if (message.contains("login required") || message.contains("log in") || message.contains("sign in") || message.contains("private post") ||
            message.contains("private video") || message.contains("private account")) return "SOURCE_FORBIDDEN";
        if (message.contains("403") || message.contains("forbidden")) return "SOURCE_REJECTED";
        if (message.contains("404") || message.contains("not found")) return "SOURCE_NOT_FOUND";
        if (message.contains("no video formats found") || message.contains("requested format is not available")) return "NO_MEDIA_FOUND";
        if (message.contains("429") || message.contains("too many requests")) return "RATE_LIMITED";
        if (message.contains("storage") || message.contains("mediastore")) return "STORAGE_FAILED";
        if (message.contains("ffmpeg") || message.contains("postprocess") || message.contains("merge failed")) return "FFMPEG_FAILED";
        if (message.contains("dns") || message.contains("name resolution") || message.contains("connection refused") ||
            message.contains("network is unreachable") || message.contains("incompleteread") ||
            message.contains("record layer failure") || message.contains("connection reset")) return "NETWORK_FAILED";
        if (message.contains("unsupported url") || message.contains("no suitable extractor") ||
            message.contains("unable to extract client id")) return "EXTRACTOR_FAILED";
        return "DOWNLOAD_FAILED";
    }

    static String publicMessage(String code) {
        return switch (code) {
            case "INVALID_URL" -> "Unsupported media link.";
            case "CANCELLED" -> "Download cancelled.";
            case "TIMEOUT" -> "The source took too long to respond.";
            case "SOURCE_FORBIDDEN" -> "This source requires access Savewave does not have.";
            case "SOURCE_REJECTED" -> "The source temporarily rejected this request. Please try again later.";
            case "SOURCE_NOT_FOUND" -> "This media no longer exists or is unavailable.";
            case "RATE_LIMITED" -> "The source is busy. Please wait and try again.";
            case "NETWORK_FAILED" -> "Could not reach the source. Check your connection.";
            case "STORAGE_FAILED" -> "The file could not be added to Downloads.";
            case "FFMPEG_FAILED" -> "Media processing could not be completed.";
            case "EXTRACTOR_FAILED" -> "The media source changed and needs an engine update.";
            case "SOURCE_UNAVAILABLE" -> "This media is unavailable.";
            case "NO_MEDIA_FOUND" -> "No downloadable media was found.";
            case "POST_IMAGES_UNSUPPORTED" -> "This photo post cannot be extracted by the current local engine.";
            default -> "Download failed.";
        };
    }
}
