use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    InvalidUrl,
    UnsupportedSource,
    EngineUnavailable,
    AuthRequired,
    SourceForbidden,
    SourceRejected,
    SourceNotFound,
    RateLimited,
    NetworkError,
    Timeout,
    MatchConfidenceLow,
    NoMediaFound,
    DownloadNotFound,
    DownloadFailed,
    Cancelled,
    UnknownError,
}

impl ErrorCode {
    pub fn as_str(&self) -> &'static str {
        match self {
            ErrorCode::InvalidUrl => "INVALID_URL",
            ErrorCode::UnsupportedSource => "UNSUPPORTED_SOURCE",
            ErrorCode::EngineUnavailable => "ENGINE_UNAVAILABLE",
            ErrorCode::AuthRequired => "AUTH_REQUIRED",
            ErrorCode::SourceForbidden => "SOURCE_FORBIDDEN",
            ErrorCode::SourceRejected => "SOURCE_REJECTED",
            ErrorCode::SourceNotFound => "SOURCE_NOT_FOUND",
            ErrorCode::RateLimited => "RATE_LIMITED",
            ErrorCode::NetworkError => "NETWORK_ERROR",
            ErrorCode::Timeout => "TIMEOUT",
            ErrorCode::MatchConfidenceLow => "MATCH_CONFIDENCE_LOW",
            ErrorCode::NoMediaFound => "NO_MEDIA_FOUND",
            ErrorCode::DownloadNotFound => "DOWNLOAD_NOT_FOUND",
            ErrorCode::DownloadFailed => "DOWNLOAD_FAILED",
            ErrorCode::Cancelled => "CANCELLED",
            ErrorCode::UnknownError => "UNKNOWN_ERROR",
        }
    }

    pub fn user_message(&self) -> &'static str {
        match self {
            ErrorCode::InvalidUrl => "Please paste a valid public HTTP or HTTPS link.",
            ErrorCode::UnsupportedSource => "This source is not currently supported by Savewave.",
            ErrorCode::EngineUnavailable => "The local media engine is unavailable right now.",
            ErrorCode::AuthRequired => {
                "Instagram blocked anonymous access to this Reel. Log in once to proceed."
            }
            ErrorCode::SourceForbidden => {
                "This media is private, age-restricted, or blocked in your region."
            }
            ErrorCode::SourceRejected => {
                "The source rejected this request. Please retry in a moment."
            }
            ErrorCode::SourceNotFound => "This media link could not be found or was removed.",
            ErrorCode::RateLimited => "Too many requests to this platform. Wait a moment and retry.",
            ErrorCode::NetworkError => "Network connection failed. Check your internet and retry.",
            ErrorCode::Timeout => "The request timed out. Please retry in a moment.",
            ErrorCode::MatchConfidenceLow => {
                "Could not confidently match this Spotify track. Try a direct YouTube link instead."
            }
            ErrorCode::NoMediaFound => "No downloadable media was found at this link.",
            ErrorCode::DownloadNotFound => "That download job could not be found.",
            ErrorCode::DownloadFailed => "Download failed. Please retry in a moment.",
            ErrorCode::Cancelled => "Download was cancelled.",
            ErrorCode::UnknownError => "Something went wrong while processing this media link.",
        }
    }
}

#[derive(Debug, Error)]
pub enum SavewaveError {
    #[error("{code:?}: {message}")]
    Coded { code: ErrorCode, message: String },
}

impl SavewaveError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self::Coded {
            code,
            message: message.into(),
        }
    }

    pub fn from_code(code: ErrorCode) -> Self {
        Self::Coded {
            code,
            message: code.user_message().to_string(),
        }
    }

    pub fn code(&self) -> ErrorCode {
        match self {
            SavewaveError::Coded { code, .. } => *code,
        }
    }

    pub fn message(&self) -> &str {
        match self {
            SavewaveError::Coded { message, .. } => message,
        }
    }
}

pub fn classify_error_text(raw: &str) -> ErrorCode {
    let lower = raw.to_lowercase();
    if lower.contains("login required")
        || lower.contains("rate-limit reached or login required")
        || lower.contains("instagram sent an empty media response")
        || lower.contains("auth_required")
        || lower.contains("cookies are needed")
        || lower.contains("sign in to confirm")
    {
        return ErrorCode::AuthRequired;
    }
    if lower.contains("http error 429") || lower.contains("too many requests") {
        return ErrorCode::RateLimited;
    }
    if lower.contains("http error 403")
        || lower.contains("private video")
        || lower.contains("members-only")
        || lower.contains("geo-restricted")
        || lower.contains("drm")
    {
        return ErrorCode::SourceForbidden;
    }
    if lower.contains("http error 404")
        || lower.contains("video unavailable")
        || lower.contains("this video is unavailable")
    {
        return ErrorCode::SourceNotFound;
    }
    if lower.contains("timed out") || lower.contains("timeout") {
        return ErrorCode::Timeout;
    }
    if lower.contains("unable to download webpage")
        || lower.contains("name or service not known")
        || lower.contains("connection reset")
        || lower.contains("getaddrinfo")
    {
        return ErrorCode::NetworkError;
    }
    if lower.contains("unsupported url") || lower.contains("unsupported_source") {
        return ErrorCode::UnsupportedSource;
    }
    if lower.contains("could not confidently match") || lower.contains("match_confidence_low") {
        return ErrorCode::MatchConfidenceLow;
    }
    ErrorCode::DownloadFailed
}
