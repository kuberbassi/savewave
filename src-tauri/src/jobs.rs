use crate::models::DownloadProgress;
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri_plugin_shell::process::CommandChild;

struct JobEntry {
    progress: DownloadProgress,
    child: Option<CommandChild>,
    temp_dir: Option<PathBuf>,
}
#[derive(Clone)]
pub struct JobStore(Arc<Mutex<HashMap<String, JobEntry>>>);
impl Default for JobStore {
    fn default() -> Self {
        Self(Arc::new(Mutex::new(HashMap::new())))
    }
}
impl JobStore {
    pub fn insert(
        &self,
        progress: DownloadProgress,
        child: Option<CommandChild>,
        temp_dir: Option<PathBuf>,
    ) {
        self.0.lock().expect("job lock").insert(
            progress.job_id.clone(),
            JobEntry {
                progress,
                child,
                temp_dir,
            },
        );
    }
    pub fn update(&self, progress: DownloadProgress) {
        if let Some(job) = self.0.lock().expect("job lock").get_mut(&progress.job_id) {
            job.progress = progress;
        }
    }
    pub fn get(&self, id: &str) -> Option<DownloadProgress> {
        self.0
            .lock()
            .expect("job lock")
            .get(id)
            .map(|job| job.progress.clone())
    }
    pub fn cancel(&self, id: &str) -> Result<(), String> {
        let mut jobs = self.0.lock().map_err(|_| "DOWNLOAD_FAILED")?;
        let job = jobs.get_mut(id).ok_or("DOWNLOAD_FAILED")?;
        if let Some(child) = job.child.take() {
            child.kill().map_err(|_| "DOWNLOAD_FAILED")?;
        }
        if let Some(temp_dir) = job.temp_dir.take() {
            let _ = std::fs::remove_dir_all(temp_dir);
        }
        job.progress.state = "cancelled".into();
        job.progress.percent = None;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn progress(id: &str) -> DownloadProgress {
        DownloadProgress {
            job_id: id.into(),
            state: "downloading".into(),
            percent: None,
            downloaded_bytes: None,
            total_bytes: None,
            speed: None,
            eta: None,
            filename: None,
            error_code: None,
            error_message: None,
        }
    }
    #[test]
    fn cancellation_is_job_scoped() {
        let store = JobStore::default();
        store.insert(progress("a"), None, None);
        assert!(store.cancel("missing").is_err());
        store.cancel("a").unwrap();
        assert_eq!(store.get("a").unwrap().state, "cancelled");
    }
}
