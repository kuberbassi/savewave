package com.kuberbassi.savewave;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import java.net.URI;
import org.junit.Test;

public class AndroidMediaPolicyTest {
    @Test
    public void acceptsPublicHttpsAndRejectsUnsafeSchemes() throws Exception {
        assertEquals(new URI("https://1.1.1.1/media.mp4"), AndroidMediaPolicy.publicHttpUri("https://1.1.1.1/media.mp4"));
        assertThrows(IllegalArgumentException.class, () -> AndroidMediaPolicy.httpUri("file:///private.txt"));
    }

    @Test
    public void rejectsLoopbackAndPrivateNetworkTargets() {
        assertThrows(IllegalArgumentException.class, () -> AndroidMediaPolicy.publicHttpUri("http://127.0.0.1/media"));
        assertThrows(IllegalArgumentException.class, () -> AndroidMediaPolicy.publicHttpUri("http://192.168.1.4/media"));
    }

    @Test
    public void sanitizesFilenamesAndMapsMimeTypes() {
        assertEquals("Song Live", AndroidMediaPolicy.safeStem(" Song: Live? "));
        assertEquals("audio/mp4", AndroidMediaPolicy.mimeType("track.m4a", "audio"));
        assertEquals("video/mp4", AndroidMediaPolicy.mimeType("clip.mp4", "video"));
        assertEquals("image/webp", AndroidMediaPolicy.mimeType("photo.webp", "video"));
        assertEquals("image/gif", AndroidMediaPolicy.mimeType("animation.gif", "video"));
    }

    @Test
    public void boundsInstagramCarouselsWithoutExpandingOtherProviders() throws Exception {
        assertEquals(20, AndroidMediaPolicy.maxItemsForUrl("https://www.instagram.com/p/example/"));
        assertEquals(1, AndroidMediaPolicy.maxItemsForUrl("https://instagram.com/reel/example/"));
        assertEquals(20, AndroidMediaPolicy.maxItemsForUrl("https://x.com/example/status/123"));
        assertEquals(20, AndroidMediaPolicy.maxItemsForUrl("https://twitter.com/example/status/123"));
        assertEquals(20, AndroidMediaPolicy.maxItemsForUrl("https://www.threads.net/@example/post/123"));
        assertEquals(1, AndroidMediaPolicy.maxItemsForUrl("https://www.youtube.com/watch?v=example"));
        assertEquals(1, AndroidMediaPolicy.maxItemsForUrl("https://evilinstagram.com/p/example"));
    }

    @Test
    public void rejectsUnavailableProvidersWithoutBlockingWorkingSources() throws Exception {
        for (String url : new String[]{"https://www.instagram.com/p/example/", "https://m.facebook.com/watch?v=1",
            "https://fb.watch/example", "https://x.com/user/status/1", "https://twitter.com/user/status/1"}) {
            assertEquals(true, AndroidMediaPolicy.isUnavailableSourceUrl(url));
        }
        assertEquals(false, AndroidMediaPolicy.isUnavailableSourceUrl("https://www.youtube.com/watch?v=example"));
        assertEquals(false, AndroidMediaPolicy.isUnavailableSourceUrl("https://www.instagram.com/reel/DUl354timp1/?utm_source=copy"));
        assertEquals(true, AndroidMediaPolicy.isUnavailableSourceUrl("https://www.instagram.com/reel/DUl354timp1/extra"));
        assertEquals(false, AndroidMediaPolicy.isUnavailableSourceUrl("https://evilinstagram.com/reel/DUl354timp1/"));
        assertEquals(false, AndroidMediaPolicy.isUnavailableSourceUrl("https://www.threads.net/@example/post/123"));
    }

    @Test
    public void mapsStableErrorCategories() {
        assertEquals("TIMEOUT", AndroidMediaPolicy.errorCode(new Exception("connection timed out")));
        assertEquals("RATE_LIMITED", AndroidMediaPolicy.errorCode(new Exception("HTTP 429")));
        assertEquals("SOURCE_REJECTED", AndroidMediaPolicy.errorCode(new Exception("HTTP 403 Forbidden")));
        assertEquals("SOURCE_REJECTED", AndroidMediaPolicy.errorCode(new Exception("Instagram sent an empty media response")));
        assertEquals("SOURCE_FORBIDDEN", AndroidMediaPolicy.errorCode(new Exception("Private post. Login required")));
        assertEquals("NETWORK_FAILED", AndroidMediaPolicy.errorCode(new Exception("IncompleteRead: 121474 bytes read")));
        assertEquals("STORAGE_FAILED", AndroidMediaPolicy.errorCode(new Exception("MediaStore failed")));
        assertEquals("FFMPEG_FAILED", AndroidMediaPolicy.errorCode(new Exception("ffmpeg merge failed at /private/path")));
        assertEquals("Media processing could not be completed.", AndroidMediaPolicy.publicMessage("FFMPEG_FAILED"));
    }
}
